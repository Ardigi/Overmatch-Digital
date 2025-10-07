import { Injectable, Logger, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as AWS from 'aws-sdk';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as sharp from 'sharp';
import { promisify } from 'util';
import { pipeline } from 'stream';
import { createReadStream, createWriteStream } from 'fs';
import { v4 as uuidv4 } from 'uuid';

const pipelineAsync = promisify(pipeline);
const unlinkAsync = promisify(fs.unlink);
const mkdirAsync = promisify(fs.mkdir);
const statAsync = promisify(fs.stat);

export interface StorageOptions {
  bucket?: string;
  prefix?: string;
  contentType?: string;
  metadata?: Record<string, string>;
  encryption?: boolean;
  public?: boolean;
  expiresIn?: number;
}

export interface UploadResult {
  id: string;
  location: string;
  bucket: string;
  key: string;
  size: number;
  contentType: string;
  checksum: string;
  etag?: string;
  versionId?: string;
  metadata?: Record<string, string>;
  thumbnailUrl?: string;
}

export interface StorageQuota {
  organizationId: string;
  used: number;
  limit: number;
  fileCount: number;
  lastUpdated: Date;
}

export interface DocumentVersion {
  versionId: string;
  timestamp: Date;
  size: number;
  checksum: string;
  uploadedBy: string;
  metadata?: Record<string, string>;
}

@Injectable()
export class AdvancedStorageService {
  private readonly logger = new Logger(AdvancedStorageService.name);
  private s3: AWS.S3;
  private readonly localStoragePath: string;
  private readonly encryptionKey: Buffer;
  private readonly storageQuotas = new Map<string, StorageQuota>();
  
  private readonly DEFAULT_BUCKET = 'soc-evidence';
  private readonly MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
  private readonly DEFAULT_QUOTA = 10 * 1024 * 1024 * 1024; // 10GB per organization
  private readonly THUMBNAIL_SIZE = { width: 200, height: 200 };
  
  // Supported image formats for thumbnail generation
  private readonly IMAGE_FORMATS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
  
  // Document preview formats
  private readonly PREVIEW_FORMATS = ['.pdf', '.doc', '.docx', '.xls', '.xlsx'];

  constructor(private configService: ConfigService) {
    this.localStoragePath = this.configService.get('STORAGE_PATH', '/app/uploads');
    
    // Initialize encryption key
    const masterKey = this.configService.get('MASTER_ENCRYPTION_KEY');
    this.encryptionKey = masterKey 
      ? Buffer.from(masterKey, 'hex')
      : crypto.randomBytes(32);
    
    // Initialize storage backend
    this.initializeStorage();
    
    // Ensure local storage directory exists
    this.ensureLocalStorage();
  }

  private initializeStorage() {
    const storageType = this.configService.get('STORAGE_TYPE', 'local');
    
    if (storageType === 's3' || storageType === 'minio') {
      const endpoint = this.configService.get('S3_ENDPOINT');
      const region = this.configService.get('AWS_REGION', 'us-east-1');
      
      this.s3 = new AWS.S3({
        endpoint: endpoint || undefined,
        accessKeyId: this.configService.get('AWS_ACCESS_KEY_ID'),
        secretAccessKey: this.configService.get('AWS_SECRET_ACCESS_KEY'),
        region: region,
        s3ForcePathStyle: storageType === 'minio', // Required for MinIO
        signatureVersion: 'v4',
        // Enable server-side encryption
        sseCustomerAlgorithm: this.configService.get('S3_SSE_ALGORITHM'),
        sseCustomerKey: this.configService.get('S3_SSE_KEY'),
      });
      
      // Create default bucket if it doesn't exist
      this.ensureBucket(this.DEFAULT_BUCKET);
    }
  }

  private async ensureLocalStorage() {
    try {
      await statAsync(this.localStoragePath);
    } catch (error) {
      await mkdirAsync(this.localStoragePath, { recursive: true });
      this.logger.log(`Created local storage directory: ${this.localStoragePath}`);
    }
  }

  private async ensureBucket(bucket: string) {
    if (!this.s3) return;
    
    try {
      await this.s3.headBucket({ Bucket: bucket }).promise();
    } catch (error) {
      if (error.code === 'NotFound') {
        await this.s3.createBucket({
          Bucket: bucket,
          CreateBucketConfiguration: {
            LocationConstraint: this.configService.get('AWS_REGION', 'us-east-1'),
          },
        }).promise();
        
        // Enable versioning for audit trail
        await this.s3.putBucketVersioning({
          Bucket: bucket,
          VersioningConfiguration: {
            Status: 'Enabled',
          },
        }).promise();
        
        // Enable encryption
        await this.s3.putBucketEncryption({
          Bucket: bucket,
          ServerSideEncryptionConfiguration: {
            Rules: [{
              ApplyServerSideEncryptionByDefault: {
                SSEAlgorithm: 'AES256',
              },
            }],
          },
        }).promise();
        
        // Set lifecycle policy for old versions
        await this.s3.putBucketLifecycleConfiguration({
          Bucket: bucket,
          LifecycleConfiguration: {
            Rules: [{
              Id: 'delete-old-versions',
              Status: 'Enabled',
              NoncurrentVersionExpiration: {
                NoncurrentDays: 90,
              },
            }],
          },
        }).promise();
        
        this.logger.log(`Created and configured S3 bucket: ${bucket}`);
      }
    }
  }

  /**
   * Upload a file with encryption and versioning
   */
  async uploadFile(
    file: Express.Multer.File | Buffer,
    organizationId: string,
    userId: string,
    options: StorageOptions = {},
  ): Promise<UploadResult> {
    // Check quota
    await this.checkQuota(organizationId, file instanceof Buffer ? file.length : file.size);
    
    const fileId = uuidv4();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileBuffer = file instanceof Buffer ? file : file.buffer;
    const fileName = file instanceof Buffer ? `file-${fileId}` : file.originalname;
    const fileSize = file instanceof Buffer ? file.length : file.size;
    
    // Calculate checksum
    const checksum = this.calculateChecksum(fileBuffer);
    
    // Check for duplicate files
    const duplicate = await this.checkDuplicate(organizationId, checksum);
    if (duplicate) {
      this.logger.debug(`Duplicate file detected, returning existing: ${duplicate.id}`);
      return duplicate;
    }
    
    // Prepare file key
    const prefix = options.prefix || `${organizationId}/evidence`;
    const key = `${prefix}/${timestamp}-${fileId}-${fileName}`;
    
    // Encrypt file if required
    const encryptedBuffer = options.encryption !== false 
      ? await this.encryptFile(fileBuffer)
      : fileBuffer;
    
    // Detect content type
    const contentType = options.contentType || 
                       (file instanceof Buffer ? 'application/octet-stream' : file.mimetype);
    
    // Prepare metadata
    const metadata = {
      ...options.metadata,
      'original-name': fileName,
      'uploaded-by': userId,
      'organization-id': organizationId,
      'checksum': checksum,
      'encrypted': String(options.encryption !== false),
      'upload-timestamp': new Date().toISOString(),
    };
    
    let uploadResult: UploadResult;
    
    if (this.s3) {
      // Upload to S3/MinIO
      uploadResult = await this.uploadToS3(
        encryptedBuffer,
        options.bucket || this.DEFAULT_BUCKET,
        key,
        contentType,
        metadata,
        options.public,
      );
    } else {
      // Upload to local storage
      uploadResult = await this.uploadToLocal(
        encryptedBuffer,
        key,
        contentType,
        metadata,
      );
    }
    
    // Generate thumbnail for images
    if (this.isImage(fileName)) {
      try {
        const thumbnailUrl = await this.generateThumbnail(fileBuffer, key);
        uploadResult.thumbnailUrl = thumbnailUrl;
      } catch (error) {
        this.logger.warn(`Failed to generate thumbnail: ${error.message}`);
      }
    }
    
    // Update quota
    await this.updateQuota(organizationId, fileSize);
    
    // Log upload for audit
    this.logger.log(`File uploaded: ${uploadResult.id} by ${userId} for ${organizationId}`);
    
    return uploadResult;
  }

  /**
   * Download a file with decryption
   */
  async downloadFile(
    key: string,
    organizationId: string,
    decrypt = true,
  ): Promise<Buffer> {
    let fileBuffer: Buffer;
    
    if (this.s3) {
      const bucket = this.DEFAULT_BUCKET;
      
      try {
        const response = await this.s3.getObject({
          Bucket: bucket,
          Key: key,
        }).promise();
        
        fileBuffer = response.Body as Buffer;
        
        // Check if file is encrypted
        const metadata = response.Metadata || {};
        if (metadata.encrypted === 'true' && decrypt) {
          fileBuffer = await this.decryptFile(fileBuffer);
        }
      } catch (error) {
        if (error.code === 'NoSuchKey') {
          throw new BadRequestException('File not found');
        }
        throw error;
      }
    } else {
      // Download from local storage
      const filePath = path.join(this.localStoragePath, key);
      
      try {
        fileBuffer = await fs.promises.readFile(filePath);
        
        // Check metadata file for encryption status
        const metadataPath = `${filePath}.metadata`;
        if (fs.existsSync(metadataPath)) {
          const metadata = JSON.parse(await fs.promises.readFile(metadataPath, 'utf8'));
          if (metadata.encrypted === 'true' && decrypt) {
            fileBuffer = await this.decryptFile(fileBuffer);
          }
        }
      } catch (error) {
        if (error.code === 'ENOENT') {
          throw new BadRequestException('File not found');
        }
        throw error;
      }
    }
    
    return fileBuffer;
  }

  /**
   * Generate a pre-signed URL for direct upload/download
   */
  async generatePresignedUrl(
    key: string,
    operation: 'getObject' | 'putObject',
    expiresIn = 3600,
  ): Promise<string> {
    if (!this.s3) {
      throw new BadRequestException('Pre-signed URLs not available with local storage');
    }
    
    const params = {
      Bucket: this.DEFAULT_BUCKET,
      Key: key,
      Expires: expiresIn,
    };
    
    return await this.s3.getSignedUrlPromise(operation, params);
  }

  /**
   * Delete a file (soft delete with versioning)
   */
  async deleteFile(
    key: string,
    organizationId: string,
    permanent = false,
  ): Promise<void> {
    if (this.s3) {
      const bucket = this.DEFAULT_BUCKET;
      
      if (permanent) {
        // Delete all versions
        const versions = await this.s3.listObjectVersions({
          Bucket: bucket,
          Prefix: key,
        }).promise();
        
        if (versions.Versions && versions.Versions.length > 0) {
          await this.s3.deleteObjects({
            Bucket: bucket,
            Delete: {
              Objects: versions.Versions.map(v => ({
                Key: v.Key!,
                VersionId: v.VersionId,
              })),
            },
          }).promise();
        }
      } else {
        // Soft delete (creates delete marker)
        await this.s3.deleteObject({
          Bucket: bucket,
          Key: key,
        }).promise();
      }
    } else {
      // Local storage deletion
      const filePath = path.join(this.localStoragePath, key);
      
      if (permanent) {
        await unlinkAsync(filePath);
        // Also delete metadata
        const metadataPath = `${filePath}.metadata`;
        if (fs.existsSync(metadataPath)) {
          await unlinkAsync(metadataPath);
        }
      } else {
        // Move to trash directory
        const trashPath = path.join(this.localStoragePath, '.trash', key);
        await mkdirAsync(path.dirname(trashPath), { recursive: true });
        await fs.promises.rename(filePath, trashPath);
      }
    }
    
    this.logger.log(`File deleted: ${key} (permanent: ${permanent})`);
  }

  /**
   * List file versions
   */
  async listVersions(key: string): Promise<DocumentVersion[]> {
    if (!this.s3) {
      throw new BadRequestException('Versioning not available with local storage');
    }
    
    const response = await this.s3.listObjectVersions({
      Bucket: this.DEFAULT_BUCKET,
      Prefix: key,
    }).promise();
    
    const versions: DocumentVersion[] = [];
    
    if (response.Versions) {
      for (const version of response.Versions) {
        const metadata = await this.s3.headObject({
          Bucket: this.DEFAULT_BUCKET,
          Key: version.Key!,
          VersionId: version.VersionId,
        }).promise();
        
        versions.push({
          versionId: version.VersionId!,
          timestamp: version.LastModified!,
          size: version.Size!,
          checksum: metadata.Metadata?.checksum || '',
          uploadedBy: metadata.Metadata?.['uploaded-by'] || 'unknown',
          metadata: metadata.Metadata,
        });
      }
    }
    
    return versions;
  }

  /**
   * Restore a specific version
   */
  async restoreVersion(
    key: string,
    versionId: string,
    userId: string,
  ): Promise<UploadResult> {
    if (!this.s3) {
      throw new BadRequestException('Versioning not available with local storage');
    }
    
    // Get the version
    const response = await this.s3.getObject({
      Bucket: this.DEFAULT_BUCKET,
      Key: key,
      VersionId: versionId,
    }).promise();
    
    // Create a new version with the old content
    const newVersion = await this.s3.putObject({
      Bucket: this.DEFAULT_BUCKET,
      Key: key,
      Body: response.Body,
      ContentType: response.ContentType,
      Metadata: {
        ...response.Metadata,
        'restored-from': versionId,
        'restored-by': userId,
        'restored-at': new Date().toISOString(),
      },
    }).promise();
    
    return {
      id: key,
      location: `s3://${this.DEFAULT_BUCKET}/${key}`,
      bucket: this.DEFAULT_BUCKET,
      key: key,
      size: (response.Body as Buffer).length,
      contentType: response.ContentType || 'application/octet-stream',
      checksum: response.Metadata?.checksum || '',
      etag: newVersion.ETag,
      versionId: newVersion.VersionId,
      metadata: response.Metadata,
    };
  }

  private async uploadToS3(
    buffer: Buffer,
    bucket: string,
    key: string,
    contentType: string,
    metadata: Record<string, string>,
    isPublic?: boolean,
  ): Promise<UploadResult> {
    const params: AWS.S3.PutObjectRequest = {
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      Metadata: metadata,
      ServerSideEncryption: 'AES256',
    };
    
    if (isPublic) {
      params.ACL = 'public-read';
    }
    
    const response = await this.s3.putObject(params).promise();
    
    return {
      id: key,
      location: `s3://${bucket}/${key}`,
      bucket: bucket,
      key: key,
      size: buffer.length,
      contentType: contentType,
      checksum: metadata.checksum,
      etag: response.ETag,
      versionId: response.VersionId,
      metadata: metadata,
    };
  }

  private async uploadToLocal(
    buffer: Buffer,
    key: string,
    contentType: string,
    metadata: Record<string, string>,
  ): Promise<UploadResult> {
    const filePath = path.join(this.localStoragePath, key);
    
    // Ensure directory exists
    await mkdirAsync(path.dirname(filePath), { recursive: true });
    
    // Write file
    await fs.promises.writeFile(filePath, buffer);
    
    // Write metadata
    const metadataPath = `${filePath}.metadata`;
    await fs.promises.writeFile(metadataPath, JSON.stringify({
      contentType,
      ...metadata,
    }, null, 2));
    
    return {
      id: key,
      location: `file://${filePath}`,
      bucket: 'local',
      key: key,
      size: buffer.length,
      contentType: contentType,
      checksum: metadata.checksum,
      metadata: metadata,
    };
  }

  private async encryptFile(buffer: Buffer): Promise<Buffer> {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', this.encryptionKey, iv);
    
    const encrypted = Buffer.concat([
      iv,
      cipher.update(buffer),
      cipher.final(),
    ]);
    
    return encrypted;
  }

  private async decryptFile(buffer: Buffer): Promise<Buffer> {
    const iv = buffer.slice(0, 16);
    const encrypted = buffer.slice(16);
    
    const decipher = crypto.createDecipheriv('aes-256-cbc', this.encryptionKey, iv);
    
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);
    
    return decrypted;
  }

  private calculateChecksum(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  private async checkDuplicate(
    organizationId: string,
    checksum: string,
  ): Promise<UploadResult | null> {
    // This would typically query a database to check for duplicates
    // For now, return null (no duplicate found)
    return null;
  }

  private async checkQuota(organizationId: string, fileSize: number): Promise<void> {
    let quota = this.storageQuotas.get(organizationId);
    
    if (!quota) {
      quota = {
        organizationId,
        used: 0,
        limit: this.DEFAULT_QUOTA,
        fileCount: 0,
        lastUpdated: new Date(),
      };
      this.storageQuotas.set(organizationId, quota);
    }
    
    if (quota.used + fileSize > quota.limit) {
      throw new BadRequestException({
        message: 'Storage quota exceeded',
        used: quota.used,
        limit: quota.limit,
        requested: fileSize,
      });
    }
  }

  private async updateQuota(organizationId: string, fileSize: number): Promise<void> {
    const quota = this.storageQuotas.get(organizationId);
    
    if (quota) {
      quota.used += fileSize;
      quota.fileCount++;
      quota.lastUpdated = new Date();
    }
  }

  private isImage(filename: string): boolean {
    const ext = path.extname(filename).toLowerCase();
    return this.IMAGE_FORMATS.includes(ext);
  }

  private async generateThumbnail(buffer: Buffer, key: string): Promise<string> {
    try {
      const thumbnail = await sharp(buffer)
        .resize(this.THUMBNAIL_SIZE.width, this.THUMBNAIL_SIZE.height, {
          fit: 'cover',
          position: 'center',
        })
        .jpeg({ quality: 80 })
        .toBuffer();
      
      const thumbnailKey = `${key}.thumbnail.jpg`;
      
      if (this.s3) {
        await this.s3.putObject({
          Bucket: this.DEFAULT_BUCKET,
          Key: thumbnailKey,
          Body: thumbnail,
          ContentType: 'image/jpeg',
          CacheControl: 'max-age=31536000',
        }).promise();
        
        return `s3://${this.DEFAULT_BUCKET}/${thumbnailKey}`;
      } else {
        const thumbnailPath = path.join(this.localStoragePath, thumbnailKey);
        await fs.promises.writeFile(thumbnailPath, thumbnail);
        return `file://${thumbnailPath}`;
      }
    } catch (error) {
      this.logger.warn(`Failed to generate thumbnail: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get storage statistics for an organization
   */
  async getStorageStats(organizationId: string): Promise<StorageQuota> {
    const quota = this.storageQuotas.get(organizationId);
    
    if (!quota) {
      return {
        organizationId,
        used: 0,
        limit: this.DEFAULT_QUOTA,
        fileCount: 0,
        lastUpdated: new Date(),
      };
    }
    
    return quota;
  }

  /**
   * Clean up expired files
   */
  async cleanupExpiredFiles(): Promise<number> {
    let deletedCount = 0;
    
    // This would typically query a database for expired files
    // and delete them from storage
    
    this.logger.log(`Cleaned up ${deletedCount} expired files`);
    return deletedCount;
  }
}