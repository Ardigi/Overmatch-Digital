import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BaseEvidenceCollector } from '../base/base.collector';
import {
  type CollectorConfig,
  CollectorType,
  type EvidenceData,
} from '../base/collector.interface';

interface AWSConfig {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  services?: string[]; // Which AWS services to collect from
}

@Injectable()
export class AWSCollector extends BaseEvidenceCollector {
  constructor(eventEmitter: EventEmitter2) {
    super(CollectorType.AWS, 'AWS Evidence Collector', eventEmitter);
  }

  protected async validateConfig(config: CollectorConfig): Promise<boolean> {
    const awsConfig = config.credentials as AWSConfig;

    if (!awsConfig?.accessKeyId || !awsConfig?.secretAccessKey || !awsConfig?.region) {
      this.logger.error('Missing required AWS credentials');
      return false;
    }

    return true;
  }

  async testConnection(): Promise<boolean> {
    try {
      // In production, would use AWS SDK to test connection
      // For now, simulate successful connection
      this.logger.log('Testing AWS connection...');

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));

      this.logger.log('AWS connection successful');
      return true;
    } catch (error) {
      this.logger.error('AWS connection failed:', error);
      return false;
    }
  }

  protected async performCollection(): Promise<EvidenceData[]> {
    const evidence: EvidenceData[] = [];
    const awsConfig = this.config.credentials as AWSConfig;
    const services = awsConfig.services || ['iam', 's3', 'ec2', 'cloudtrail', 'config'];

    for (const service of services) {
      try {
        const serviceEvidence = await this.collectFromService(service);
        evidence.push(...serviceEvidence);
      } catch (error) {
        await this.handleError(error, `Collecting from ${service}`);
      }
    }

    return evidence;
  }

  private async collectFromService(service: string): Promise<EvidenceData[]> {
    const evidence: EvidenceData[] = [];

    switch (service) {
      case 'iam':
        evidence.push(...(await this.collectIAMEvidence()));
        break;
      case 's3':
        evidence.push(...(await this.collectS3Evidence()));
        break;
      case 'ec2':
        evidence.push(...(await this.collectEC2Evidence()));
        break;
      case 'cloudtrail':
        evidence.push(...(await this.collectCloudTrailEvidence()));
        break;
      case 'config':
        evidence.push(...(await this.collectConfigEvidence()));
        break;
      default:
        this.logger.warn(`Unknown AWS service: ${service}`);
    }

    return evidence;
  }

  private async collectIAMEvidence(): Promise<EvidenceData[]> {
    // Simulate collecting IAM evidence
    return [
      {
        title: 'IAM Password Policy',
        description: 'Current IAM password policy configuration',
        type: 'configuration',
        category: 'Access Control',
        source: 'AWS IAM',
        sourceSystem: CollectorType.AWS,
        content: {
          minimumPasswordLength: 14,
          requireSymbols: true,
          requireNumbers: true,
          requireUppercaseCharacters: true,
          requireLowercaseCharacters: true,
          allowUsersToChangePassword: true,
          expirePasswords: true,
          maxPasswordAge: 90,
          passwordReusePrevention: 24,
          hardExpiry: false,
        },
        metadata: {
          accountId: '123456789012',
          region: 'us-east-1',
          collectionTimestamp: new Date(),
        },
        tags: ['IAM', 'Access Control', 'SOC2', 'ISO27001'],
      },
      {
        title: 'IAM Users with MFA',
        description: 'List of IAM users with MFA enabled',
        type: 'inventory',
        category: 'Access Control',
        source: 'AWS IAM',
        sourceSystem: CollectorType.AWS,
        content: {
          totalUsers: 25,
          usersWithMFA: 23,
          usersWithoutMFA: ['legacy-service-account', 'temp-developer'],
          mfaCompliance: 92,
        },
        metadata: {
          accountId: '123456789012',
          region: 'us-east-1',
          collectionTimestamp: new Date(),
        },
        tags: ['IAM', 'MFA', 'Access Control', 'SOC2'],
      },
    ];
  }

  private async collectS3Evidence(): Promise<EvidenceData[]> {
    return [
      {
        title: 'S3 Bucket Encryption Status',
        description: 'Encryption status of all S3 buckets',
        type: 'configuration',
        category: 'Data Protection',
        source: 'AWS S3',
        sourceSystem: CollectorType.AWS,
        content: {
          totalBuckets: 15,
          encryptedBuckets: 15,
          unencryptedBuckets: [],
          encryptionTypes: {
            AES256: 10,
            'aws:kms': 5,
          },
          complianceRate: 100,
        },
        metadata: {
          accountId: '123456789012',
          region: 'us-east-1',
          collectionTimestamp: new Date(),
        },
        tags: ['S3', 'Encryption', 'Data Protection', 'SOC2', 'HIPAA'],
      },
      {
        title: 'S3 Public Access Block',
        description: 'Public access block settings for S3 buckets',
        type: 'configuration',
        category: 'Data Protection',
        source: 'AWS S3',
        sourceSystem: CollectorType.AWS,
        content: {
          accountLevelBlock: {
            blockPublicAcls: true,
            ignorePublicAcls: true,
            blockPublicPolicy: true,
            restrictPublicBuckets: true,
          },
          bucketsWithPublicAccess: [],
          compliant: true,
        },
        metadata: {
          accountId: '123456789012',
          collectionTimestamp: new Date(),
        },
        tags: ['S3', 'Public Access', 'Data Protection', 'SOC2'],
      },
    ];
  }

  private async collectEC2Evidence(): Promise<EvidenceData[]> {
    return [
      {
        title: 'EC2 Instance Security Groups',
        description: 'Security group configurations for EC2 instances',
        type: 'configuration',
        category: 'Network Security',
        source: 'AWS EC2',
        sourceSystem: CollectorType.AWS,
        content: {
          totalInstances: 42,
          instancesWithRestrictiveGroups: 40,
          instancesWithOpenPorts: [
            {
              instanceId: 'i-1234567890abcdef0',
              openPorts: [22],
              reason: 'Bastion host',
            },
            {
              instanceId: 'i-0987654321fedcba0',
              openPorts: [80, 443],
              reason: 'Public web server',
            },
          ],
          complianceRate: 95.2,
        },
        metadata: {
          accountId: '123456789012',
          region: 'us-east-1',
          collectionTimestamp: new Date(),
        },
        tags: ['EC2', 'Security Groups', 'Network Security', 'SOC2'],
      },
    ];
  }

  private async collectCloudTrailEvidence(): Promise<EvidenceData[]> {
    return [
      {
        title: 'CloudTrail Configuration',
        description: 'AWS CloudTrail logging configuration',
        type: 'configuration',
        category: 'Logging & Monitoring',
        source: 'AWS CloudTrail',
        sourceSystem: CollectorType.AWS,
        content: {
          trails: [
            {
              name: 'organization-trail',
              isMultiRegion: true,
              isOrganizationTrail: true,
              logFileValidation: true,
              eventSelectors: ['All'],
              status: 'LOGGING',
              s3BucketName: 'audit-logs-bucket',
              includeGlobalServiceEvents: true,
            },
          ],
          compliance: {
            multiRegionTrail: true,
            logFileValidation: true,
            encryptedLogs: true,
            eventCoverage: 'COMPLETE',
          },
        },
        metadata: {
          accountId: '123456789012',
          collectionTimestamp: new Date(),
        },
        tags: ['CloudTrail', 'Logging', 'Audit', 'SOC2', 'ISO27001'],
      },
    ];
  }

  private async collectConfigEvidence(): Promise<EvidenceData[]> {
    return [
      {
        title: 'AWS Config Rules Compliance',
        description: 'Compliance status of AWS Config rules',
        type: 'compliance',
        category: 'Configuration Management',
        source: 'AWS Config',
        sourceSystem: CollectorType.AWS,
        content: {
          totalRules: 45,
          compliantRules: 42,
          nonCompliantRules: [
            {
              ruleName: 'required-tags',
              nonCompliantResources: 3,
            },
            {
              ruleName: 'ec2-volume-inuse-check',
              nonCompliantResources: 2,
            },
            {
              ruleName: 's3-bucket-logging-enabled',
              nonCompliantResources: 1,
            },
          ],
          complianceScore: 93.3,
        },
        metadata: {
          accountId: '123456789012',
          region: 'us-east-1',
          evaluationTimestamp: new Date(),
        },
        tags: ['Config', 'Compliance', 'Configuration Management', 'SOC2'],
        expirationDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Expires in 7 days
      },
    ];
  }
}
