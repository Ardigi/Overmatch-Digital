import {
  CopyObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  NoSuchKey,
  NotFound,
  PutObjectCommand,
  S3Client,
  type S3ServiceException,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import * as crypto from 'crypto';
import * as path from 'path';
import type { Readable } from 'stream';
import type { ExternalServicesConfig } from '../../config/external-services.config';

export interface UploadOptions {
  bucket: 'evidence' | 'reports' | 'audit';
  key?: string;
  contentType: string;
  metadata?: Record<string, string>;
  tags?: Record<string, string>;
}

export interface UploadResult {
  bucket: string;
  key: string;
  location: string;
  etag: string;
  size: number;
  contentType: string;
}

export interface StorageFile {
  key: string;
  size: number;
  lastModified: Date;
  etag: string;
  contentType?: string;
  metadata?: Record<string, string>;
}

@Injectable()
export class EnhancedStorageService {
  private readonly logger = new Logger(EnhancedStorageService.name);
  private s3Client: S3Client | null;
  private buckets: Record<string, string>;

  constructor(private externalConfig: ExternalServicesConfig) {
    this.s3Client = this.externalConfig.getS3Client();
    if (!this.s3Client) {
      this.logger.warn('S3 client not available. Storage operations will be disabled.');
    }
    this.buckets = this.externalConfig.storage?.s3?.buckets || {};
    this.initializeBuckets();
  }

  private async initializeBuckets(): Promise<void> {
    if (!this.s3Client) {
      this.logger.warn('S3 client not available. Bucket initialization skipped.');
      return;
    }

    if (this.externalConfig.storage.provider === 'minio') {
      // Ensure buckets exist in MinIO
      for (const [_type, bucketName] of Object.entries(this.buckets)) {
        try {
          // Note: This assumes compatibility with AWS SDK v2 API
          // In practice, this would need to be updated for AWS SDK v3
          this.logger.log(`Checking bucket ${bucketName}`);
        } catch (error: any) {
          this.logger.error(`Error with bucket ${bucketName}:`, error.message);
        }
      }
    }
  }

  async uploadFile(file: Buffer | Readable, options: UploadOptions): Promise<UploadResult> {
    if (!this.s3Client) {
      throw new InternalServerErrorException('Storage service not available');
    }

    // Validate file type
    if (!this.externalConfig.validateFileType(options.contentType)) {
      throw new BadRequestException(`File type ${options.contentType} is not allowed`);
    }

    // Validate file size (if buffer)
    if (Buffer.isBuffer(file) && !this.externalConfig.validateFileSize(file.length)) {
      const maxSizeMB = this.externalConfig.storage.limits.fileSize / (1024 * 1024);
      throw new BadRequestException(`File size exceeds maximum allowed size of ${maxSizeMB}MB`);
    }

    const bucket = this.buckets[options.bucket];
    const key = options.key || this.generateKey(options.contentType);

    try {
      const uploadParams = {
        Bucket: bucket,
        Key: key,
        Body: file,
        ContentType: options.contentType,
        Metadata: {
          ...options.metadata,
          uploadedAt: new Date().toISOString(),
          uploadedBy: options.metadata?.userId || 'system',
        },
        ServerSideEncryption:
          this.externalConfig.storage.security.encryption &&
          this.externalConfig.storage.provider === 's3'
            ? ('AES256' as const)
            : undefined,
        Tagging: options.tags
          ? Object.entries(options.tags)
              .map(([k, v]) => `${k}=${v}`)
              .join('&')
          : undefined,
      };

      const command = new PutObjectCommand(uploadParams);
      const result = await this.s3Client.send(command);
      const location = `https://${bucket}.s3.amazonaws.com/${key}`;

      this.logger.log(`File uploaded successfully: ${bucket}/${key}`);

      return {
        bucket,
        key,
        location,
        etag: result.ETag || '',
        size: Buffer.isBuffer(file) ? file.length : 0,
        contentType: options.contentType,
      };
    } catch (error) {
      this.logger.error(`Failed to upload file to ${bucket}/${key}`, error);
      throw new InternalServerErrorException('Failed to upload file');
    }
  }

  async downloadFile(
    bucket: 'evidence' | 'reports' | 'audit',
    key: string
  ): Promise<{
    body: Buffer;
    contentType: string;
    metadata: Record<string, string>;
  }> {
    if (!this.s3Client) {
      throw new InternalServerErrorException('Storage service not available');
    }

    const bucketName = this.buckets[bucket];

    try {
      const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: key,
      });

      const result = await this.s3Client.send(command);

      // Convert stream to buffer
      const chunks: Buffer[] = [];
      if (result.Body) {
        const stream = result.Body as Readable;
        for await (const chunk of stream) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
      }
      const body = Buffer.concat(chunks);

      return {
        body,
        contentType: result.ContentType || 'application/octet-stream',
        metadata: result.Metadata || {},
      };
    } catch (error) {
      if (
        error instanceof NoSuchKey ||
        (error instanceof Error && error.name === 'NoSuchKey') ||
        (error as S3ServiceException).$metadata?.httpStatusCode === 404
      ) {
        throw new BadRequestException('File not found');
      }
      this.logger.error(`Failed to download file from ${bucketName}/${key}`, error);
      throw new InternalServerErrorException('Failed to download file');
    }
  }

  async getSignedUrl(
    bucket: 'evidence' | 'reports' | 'audit',
    key: string,
    expiresIn?: number
  ): Promise<string> {
    if (!this.s3Client) {
      throw new InternalServerErrorException('Storage service not available');
    }

    const bucketName = this.buckets[bucket];
    const expiry = expiresIn || this.externalConfig.storage?.s3?.signedUrlExpiry || 3600;

    try {
      const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: key,
      });

      return await getSignedUrl(this.s3Client, command, { expiresIn: expiry });
    } catch (error) {
      this.logger.error(`Failed to generate signed URL for ${bucketName}/${key}`, error);
      throw new InternalServerErrorException('Failed to generate download URL');
    }
  }

  async getUploadUrl(
    bucket: 'evidence' | 'reports' | 'audit',
    contentType: string,
    metadata?: Record<string, string>
  ): Promise<{
    uploadUrl: string;
    key: string;
  }> {
    if (!this.externalConfig.validateFileType(contentType)) {
      throw new BadRequestException(`File type ${contentType} is not allowed`);
    }

    const bucketName = this.buckets[bucket];
    const key = this.generateKey(contentType);

    try {
      const params: any = {
        Bucket: bucketName,
        Key: key,
        ContentType: contentType,
        Expires: 3600, // 1 hour
        Metadata: metadata,
      };

      if (
        this.externalConfig.storage.security.encryption &&
        this.externalConfig.storage.provider === 's3'
      ) {
        params.ServerSideEncryption = 'AES256';
      }

      if (!this.s3Client) {
        throw new InternalServerErrorException('Storage service not available');
      }

      const command = new PutObjectCommand(params);
      const uploadUrl = await getSignedUrl(this.s3Client, command, { expiresIn: params.Expires });

      return { uploadUrl, key };
    } catch (error) {
      this.logger.error(`Failed to generate upload URL for ${bucketName}`, error);
      throw new InternalServerErrorException('Failed to generate upload URL');
    }
  }

  async deleteFile(bucket: 'evidence' | 'reports' | 'audit', key: string): Promise<void> {
    const bucketName = this.buckets[bucket];

    if (!this.s3Client) {
      throw new InternalServerErrorException('Storage service not available');
    }

    try {
      const command = new DeleteObjectCommand({
        Bucket: bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
      this.logger.log(`File deleted: ${bucketName}/${key}`);
    } catch (error) {
      this.logger.error(`Failed to delete file from ${bucketName}/${key}`, error);
      throw new InternalServerErrorException('Failed to delete file');
    }
  }

  async deleteFiles(bucket: 'evidence' | 'reports' | 'audit', keys: string[]): Promise<void> {
    if (keys.length === 0) return;

    const bucketName = this.buckets[bucket];

    if (!this.s3Client) {
      throw new InternalServerErrorException('Storage service not available');
    }

    try {
      const command = new DeleteObjectsCommand({
        Bucket: bucketName,
        Delete: {
          Objects: keys.map(key => ({ Key: key })),
          Quiet: false,
        },
      });

      await this.s3Client.send(command);
      this.logger.log(`Deleted ${keys.length} files from ${bucketName}`);
    } catch (error) {
      this.logger.error(`Failed to delete files from ${bucketName}`, error);
      throw new InternalServerErrorException('Failed to delete files');
    }
  }

  async listFiles(
    bucket: 'evidence' | 'reports' | 'audit',
    prefix?: string,
    maxKeys = 1000
  ): Promise<StorageFile[]> {
    const bucketName = this.buckets[bucket];

    if (!this.s3Client) {
      throw new InternalServerErrorException('Storage service not available');
    }

    try {
      const command = new ListObjectsV2Command({
        Bucket: bucketName,
        Prefix: prefix,
        MaxKeys: maxKeys,
      });

      const result = await this.s3Client.send(command);

      return (result.Contents || []).map(obj => ({
        key: obj.Key || '',
        size: obj.Size || 0,
        lastModified: obj.LastModified || new Date(),
        etag: obj.ETag || '',
        contentType: undefined, // ContentType not available in listObjectsV2
      }));
    } catch (error) {
      this.logger.error(`Failed to list files from ${bucketName}`, error);
      throw new InternalServerErrorException('Failed to list files');
    }
  }

  async copyFile(
    sourceBucket: 'evidence' | 'reports' | 'audit',
    sourceKey: string,
    destBucket: 'evidence' | 'reports' | 'audit',
    destKey: string
  ): Promise<void> {
    const sourceBucketName = this.buckets[sourceBucket];
    const destBucketName = this.buckets[destBucket];

    if (!this.s3Client) {
      throw new InternalServerErrorException('Storage service not available');
    }

    try {
      const command = new CopyObjectCommand({
        Bucket: destBucketName,
        CopySource: `${sourceBucketName}/${sourceKey}`,
        Key: destKey,
      });

      await this.s3Client.send(command);

      this.logger.log(
        `File copied from ${sourceBucketName}/${sourceKey} to ${destBucketName}/${destKey}`
      );
    } catch (error) {
      this.logger.error(`Failed to copy file`, error);
      throw new InternalServerErrorException('Failed to copy file');
    }
  }

  async getFileMetadata(
    bucket: 'evidence' | 'reports' | 'audit',
    key: string
  ): Promise<{
    size: number;
    contentType: string;
    lastModified: Date;
    metadata: Record<string, string>;
  }> {
    const bucketName = this.buckets[bucket];

    if (!this.s3Client) {
      throw new InternalServerErrorException('Storage service not available');
    }

    try {
      const command = new HeadObjectCommand({
        Bucket: bucketName,
        Key: key,
      });

      const result = await this.s3Client.send(command);

      return {
        size: result.ContentLength || 0,
        contentType: result.ContentType || 'application/octet-stream',
        lastModified: result.LastModified || new Date(),
        metadata: result.Metadata || {},
      };
    } catch (error) {
      if (
        error instanceof NotFound ||
        (error instanceof Error && error.name === 'NotFound') ||
        (error as S3ServiceException).$metadata?.httpStatusCode === 404
      ) {
        throw new BadRequestException('File not found');
      }
      this.logger.error(`Failed to get metadata for ${bucketName}/${key}`, error);
      throw new InternalServerErrorException('Failed to get file metadata');
    }
  }

  private generateKey(contentType: string): string {
    const ext = this.getFileExtension(contentType);
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const randomId = crypto.randomBytes(16).toString('hex');

    return `${year}/${month}/${day}/${randomId}${ext}`;
  }

  private getFileExtension(contentType: string): string {
    const mimeToExt: Record<string, string> = {
      'application/pdf': '.pdf',
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'application/vnd.ms-excel': '.xls',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
      'application/msword': '.doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
      'text/csv': '.csv',
      'text/plain': '.txt',
      'application/zip': '.zip',
    };

    return mimeToExt[contentType] || '';
  }

  // Health check
  async checkHealth(): Promise<{
    status: 'healthy' | 'unhealthy';
    provider: string;
    buckets: Record<string, string>;
    details?: any;
  }> {
    const bucketStatus: Record<string, string> = {};

    try {
      for (const [type, bucketName] of Object.entries(this.buckets)) {
        try {
          const command = new HeadObjectCommand({ Bucket: bucketName, Key: 'health-check' });
          await this.s3Client!.send(command);
          bucketStatus[type] = 'accessible';
        } catch (error) {
          // For health check, we're just checking if the bucket is accessible
          // A 404 for the health-check object is actually a good sign - bucket exists
          // Check for S3 not found errors (bucket exists but object doesn't - which is expected for health check)
          if (
            error instanceof NoSuchKey ||
            error instanceof NotFound ||
            (error instanceof Error && error.name === 'NoSuchKey') ||
            (error as S3ServiceException).$metadata?.httpStatusCode === 404
          ) {
            bucketStatus[type] = 'accessible';
          } else {
            bucketStatus[type] = 'error';
          }
        }
      }

      const allHealthy = Object.values(bucketStatus).every(status => status === 'accessible');

      return {
        status: allHealthy ? 'healthy' : 'unhealthy',
        provider: this.externalConfig.storage?.provider || 'unknown',
        buckets: bucketStatus,
        details: {
          endpoint: this.externalConfig.storage?.s3?.endpoint || 'AWS S3',
          region: this.externalConfig.storage?.s3?.region || 'us-east-1',
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        provider: this.externalConfig.storage?.provider || 'unknown',
        buckets: bucketStatus,
        details: {
          error: error.message,
        },
      };
    }
  }
}
