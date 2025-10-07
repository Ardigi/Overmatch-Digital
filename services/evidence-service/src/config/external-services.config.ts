import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface StorageServiceConfig {
  provider: 'minio' | 's3' | 'local';
  s3?: {
    endpoint?: string;
    accessKeyId: string;
    secretAccessKey: string;
    region: string;
    buckets: {
      evidence: string;
      reports: string;
      audit: string;
    };
    signedUrlExpiry: number;
    forcePathStyle?: boolean;
  };
  local?: {
    basePath: string;
    publicUrl: string;
  };
  limits: {
    fileSize: number;
    allowedTypes: string[];
    maxFiles: number;
  };
  security: {
    encryption: boolean;
    virusScan: boolean;
    contentValidation: boolean;
  };
}

@Injectable()
export class ExternalServicesConfig {
  private s3Client: S3Client | null = null;

  constructor(private configService: ConfigService) {
    this.initializeS3Client();
  }

  get storage(): StorageServiceConfig {
    const isDevelopment = this.configService.get('NODE_ENV') !== 'production';
    const provider = isDevelopment ? 'minio' : 's3';

    return {
      provider,
      s3: {
        endpoint: isDevelopment
          ? this.configService.get('MINIO_ENDPOINT') || 'http://localhost:9000'
          : undefined,
        accessKeyId:
          this.configService.get('AWS_ACCESS_KEY_ID') || (isDevelopment ? 'soc_admin' : ''),
        secretAccessKey:
          this.configService.get('AWS_SECRET_ACCESS_KEY') || (isDevelopment ? 'soc_password' : ''),
        region: this.configService.get('AWS_REGION') || 'us-east-1',
        buckets: {
          evidence: this.configService.get('S3_BUCKET_EVIDENCE') || 'soc-evidence',
          reports: this.configService.get('S3_BUCKET_REPORTS') || 'soc-reports',
          audit: this.configService.get('S3_BUCKET_AUDIT') || 'soc-audit-files',
        },
        signedUrlExpiry: isDevelopment ? 3600 : 7200,
        forcePathStyle: isDevelopment,
      },
      limits: {
        fileSize: isDevelopment ? 100 * 1024 * 1024 : 500 * 1024 * 1024,
        allowedTypes: [
          'application/pdf',
          'image/jpeg',
          'image/png',
          'image/gif',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'text/csv',
          'text/plain',
          'application/zip',
        ],
        maxFiles: isDevelopment ? 10 : 50,
      },
      security: {
        encryption: !isDevelopment,
        virusScan: !isDevelopment,
        contentValidation: true,
      },
    };
  }

  private initializeS3Client(): void {
    const storageConfig = this.storage;

    if (!storageConfig.s3) {
      return;
    }

    const s3Config: S3ClientConfig = {
      credentials: {
        accessKeyId: storageConfig.s3.accessKeyId,
        secretAccessKey: storageConfig.s3.secretAccessKey,
      },
      region: storageConfig.s3.region,
    };

    if (storageConfig.s3.endpoint) {
      s3Config.endpoint = storageConfig.s3.endpoint;
      s3Config.forcePathStyle = storageConfig.s3.forcePathStyle;
    }

    this.s3Client = new S3Client(s3Config);
  }

  getS3Client(): S3Client | null {
    return this.s3Client;
  }

  async uploadFile(
    bucket: string,
    key: string,
    body: Buffer | Uint8Array | string,
    metadata?: Record<string, string>
  ): Promise<{ Location: string; ETag?: string; Key: string; Bucket: string }> {
    if (!this.s3Client) {
      throw new Error('S3 client not initialized');
    }

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      Metadata: metadata,
      ServerSideEncryption:
        this.storage.security.encryption && this.storage.provider === 's3' ? 'AES256' : undefined,
    });

    const response = await this.s3Client.send(command);
    return {
      Location: `https://${bucket}.s3.${this.storage.s3?.region}.amazonaws.com/${key}`,
      ETag: response.ETag,
      Key: key,
      Bucket: bucket,
    };
  }

  async getSignedUrl(
    bucket: string,
    key: string,
    operation: 'getObject' | 'putObject' = 'getObject'
  ): Promise<string> {
    if (!this.s3Client) {
      throw new Error('S3 client not initialized');
    }

    const command =
      operation === 'getObject'
        ? new GetObjectCommand({ Bucket: bucket, Key: key })
        : new PutObjectCommand({ Bucket: bucket, Key: key });

    return getSignedUrl(this.s3Client, command, {
      expiresIn: this.storage.s3?.signedUrlExpiry || 3600,
    });
  }

  async deleteFile(
    bucket: string,
    key: string
  ): Promise<{ DeleteMarker?: boolean; VersionId?: string }> {
    if (!this.s3Client) {
      throw new Error('S3 client not initialized');
    }

    const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    const response = await this.s3Client.send(command);
    return {
      DeleteMarker: response.DeleteMarker,
      VersionId: response.VersionId,
    };
  }

  async listFiles(
    bucket: string,
    prefix?: string
  ): Promise<Array<{ Key?: string; LastModified?: Date; ETag?: string; Size?: number }>> {
    if (!this.s3Client) {
      throw new Error('S3 client not initialized');
    }

    const command = new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
    });

    const response = await this.s3Client.send(command);
    return response.Contents || [];
  }

  validateFileType(mimeType: string): boolean {
    return this.storage.limits.allowedTypes.includes(mimeType);
  }

  validateFileSize(size: number): boolean {
    return size <= this.storage.limits.fileSize;
  }
}
