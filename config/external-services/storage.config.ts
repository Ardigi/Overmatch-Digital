/**
 * Storage Service Configuration
 * Development: MinIO (S3-compatible) or local filesystem
 * Production: AWS S3
 */

export interface StorageConfig {
  provider: 'minio' | 's3' | 'local';

  // S3/MinIO Configuration
  s3?: {
    endpoint?: string; // MinIO endpoint
    accessKeyId: string;
    secretAccessKey: string;
    region: string;
    buckets: {
      evidence: string;
      reports: string;
      audit: string;
    };
    signedUrlExpiry?: number; // seconds
    forcePathStyle?: boolean; // for MinIO
  };

  // Local filesystem Configuration
  local?: {
    basePath: string;
    publicUrl: string;
  };

  // Upload limits
  limits: {
    fileSize: number; // bytes
    allowedTypes: string[];
    maxFiles: number;
  };

  // Security
  security: {
    encryption: boolean;
    virusScan: boolean;
    contentValidation: boolean;
  };

  // Retention policies
  retention: {
    evidence: number; // days
    reports: number;
    audit: number;
  };
}

export const storageConfig = (): StorageConfig => {
  const isDevelopment = process.env.NODE_ENV === 'development';

  if (isDevelopment) {
    return {
      provider: 'minio',
      s3: {
        endpoint: process.env.MINIO_ENDPOINT || 'http://localhost:9000',
        accessKeyId: process.env.MINIO_ACCESS_KEY || 'soc_admin',
        secretAccessKey: process.env.MINIO_SECRET_KEY || 'soc_password',
        region: process.env.AWS_REGION || 'us-east-1',
        buckets: {
          evidence: process.env.S3_BUCKET_EVIDENCE || 'soc-evidence',
          reports: process.env.S3_BUCKET_REPORTS || 'soc-reports',
          audit: process.env.S3_BUCKET_AUDIT || 'soc-audit-files',
        },
        signedUrlExpiry: 3600, // 1 hour
        forcePathStyle: true,
      },
      limits: {
        fileSize: 100 * 1024 * 1024, // 100MB
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
        maxFiles: 10,
      },
      security: {
        encryption: false,
        virusScan: false,
        contentValidation: true,
      },
      retention: {
        evidence: 2555, // 7 years
        reports: 2555, // 7 years
        audit: 3650, // 10 years
      },
    };
  }

  // Production configuration
  return {
    provider: 's3',
    s3: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      region: process.env.AWS_REGION || 'us-east-1',
      buckets: {
        evidence: process.env.S3_BUCKET_EVIDENCE || 'soc-compliance-evidence',
        reports: process.env.S3_BUCKET_REPORTS || 'soc-compliance-reports',
        audit: process.env.S3_BUCKET_AUDIT || 'soc-compliance-audit',
      },
      signedUrlExpiry: 7200, // 2 hours
    },
    limits: {
      fileSize: 500 * 1024 * 1024, // 500MB
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
        'application/x-7z-compressed',
        'application/x-rar-compressed',
      ],
      maxFiles: 50,
    },
    security: {
      encryption: true,
      virusScan: true,
      contentValidation: true,
    },
    retention: {
      evidence: 2555, // 7 years
      reports: 2555, // 7 years
      audit: 3650, // 10 years
    },
  };
};

export default storageConfig;
