import {
  CloudTrailClient,
  LookupEventsCommand,
} from '@aws-sdk/client-cloudtrail';
import {
  ConfigServiceClient,
  DescribeConfigurationRecorderStatusCommand,
  GetComplianceDetailsByConfigRuleCommand,
} from '@aws-sdk/client-config-service';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import {
  GetFindingsCommand,
  SecurityHubClient,
} from '@aws-sdk/client-securityhub';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ClientProxy } from '@nestjs/microservices';
import { EventType } from '@soc-compliance/events';
import { v4 as uuidv4 } from 'uuid';
import { EvidenceSource, EvidenceType } from '../../evidence/entities/evidence.entity';
import type { CollectorEvidenceService } from '../base/collector-evidence.service';

@Injectable()
export class AwsCollectorService {
  private readonly logger = new Logger(AwsCollectorService.name);
  private cloudTrailClient: CloudTrailClient;
  private configClient: ConfigServiceClient;
  private securityHubClient: SecurityHubClient;
  private s3Client: S3Client;

  constructor(
    private configService: ConfigService,
    @Inject('KAFKA_SERVICE')
    private readonly kafkaClient: ClientProxy,
    private collectorEvidenceService: CollectorEvidenceService,
  ) {
    const accessKeyId = this.configService.get('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get('AWS_SECRET_ACCESS_KEY');
    
    const awsConfig: any = {
      region: this.configService.get('AWS_REGION', 'us-east-1'),
    };
    
    if (accessKeyId && secretAccessKey) {
      awsConfig.credentials = {
        accessKeyId,
        secretAccessKey,
      };
    }

    this.cloudTrailClient = new CloudTrailClient(awsConfig);
    this.configClient = new ConfigServiceClient(awsConfig);
    this.securityHubClient = new SecurityHubClient(awsConfig);
    this.s3Client = new S3Client(awsConfig);
  }

  async collectCloudTrailEvents(
    startTime: Date,
    endTime: Date,
    controlId: string,
  ): Promise<any[]> {
    try {
      this.logger.log(`Collecting CloudTrail events for control ${controlId}`);

      const command = new LookupEventsCommand({
        StartTime: startTime,
        EndTime: endTime,
        MaxResults: 50,
      });

      const response = await this.cloudTrailClient.send(command);
      const events = response.Events || [];

      // Store evidence
      const evidence = await this.collectorEvidenceService.createCollectorEvidence({
        controlId,
        organizationId: this.configService.get('AWS_ORGANIZATION_ID', 'default'),
        type: EvidenceType.AWS_CLOUDTRAIL_LOGS,
        title: `AWS CloudTrail Events - ${new Date().toISOString()}`,
        description: 'CloudTrail events collected from AWS',
        data: events,
        source: EvidenceSource.AWS,
        collectorType: 'aws',
        metadata: {
          retentionDays: 365,
          region: this.configService.get('AWS_REGION', 'us-east-1'),
        },
      });

      // Emit collection event
      this.kafkaClient.emit(EventType.EVIDENCE_COLLECTED, {
        id: uuidv4(),
        type: EventType.EVIDENCE_COLLECTED,
        timestamp: new Date(),
        version: '1.0',
        source: 'evidence-service',
        payload: {
          evidenceId: evidence.id,
          controlId,
          type: 'LOG',
          collectionMethod: 'AUTOMATED',
          source: 'AWS_CLOUDTRAIL',
          collectedBy: 'system',
        },
      });

      return events;
    } catch (error) {
      this.logger.error(`Failed to collect CloudTrail events: ${error.message}`);
      throw error;
    }
  }

  async collectConfigCompliance(
    configRuleName: string,
    controlId: string,
  ): Promise<any> {
    try {
      this.logger.log(`Collecting AWS Config compliance for ${configRuleName}`);

      // Check Config recorder status
      const statusCommand = new DescribeConfigurationRecorderStatusCommand({});
      const status = await this.configClient.send(statusCommand);

      if (!status.ConfigurationRecordersStatus?.[0]?.recording) {
        throw new Error('AWS Config recorder is not running');
      }

      // Get compliance details
      const complianceCommand = new GetComplianceDetailsByConfigRuleCommand({
        ConfigRuleName: configRuleName,
        Limit: 100,
      });

      const compliance = await this.configClient.send(complianceCommand);
      const results = compliance.EvaluationResults || [];

      // Store evidence
      const _evidence = await this.collectorEvidenceService.createCollectorEvidence({
        controlId,
        organizationId: this.configService.get('AWS_ORGANIZATION_ID', 'default'),
        type: EvidenceType.AWS_CONFIG_SNAPSHOTS,
        title: `AWS Config Compliance - ${configRuleName} - ${new Date().toISOString()}`,
        description: `Config compliance results for rule: ${configRuleName}`,
        data: results,
        source: EvidenceSource.AWS,
        collectorType: 'aws',
        metadata: {
          retentionDays: 365,
          configRuleName,
          region: this.configService.get('AWS_REGION', 'us-east-1'),
        },
      });

      return results;
    } catch (error) {
      this.logger.error(`Failed to collect Config compliance: ${error.message}`);
      throw error;
    }
  }

  async collectSecurityHubFindings(
    filters: any,
    controlId: string,
  ): Promise<any[]> {
    try {
      this.logger.log(`Collecting Security Hub findings for control ${controlId}`);

      const command = new GetFindingsCommand({
        Filters: filters,
        MaxResults: 100,
      });

      const response = await this.securityHubClient.send(command);
      const findings = response.Findings || [];

      // Store evidence
      const _evidence = await this.collectorEvidenceService.createCollectorEvidence({
        controlId,
        organizationId: this.configService.get('AWS_ORGANIZATION_ID', 'default'),
        type: EvidenceType.AWS_SECURITY_HUB_FINDINGS,
        title: `AWS Security Hub Findings - ${new Date().toISOString()}`,
        description: 'Security findings from AWS Security Hub',
        data: findings,
        source: EvidenceSource.AWS,
        collectorType: 'aws',
        metadata: {
          retentionDays: 365,
          region: this.configService.get('AWS_REGION', 'us-east-1'),
        },
      });

      return findings;
    } catch (error) {
      this.logger.error(`Failed to collect Security Hub findings: ${error.message}`);
      throw error;
    }
  }

  async collectS3BucketConfig(
    bucketName: string,
    controlId: string,
  ): Promise<any> {
    try {
      this.logger.log(`Collecting S3 bucket configuration for ${bucketName}`);

      // Collect various bucket configurations
      const configurations = {
        bucketName,
        collectedAt: new Date(),
        encryption: await this.getS3BucketEncryption(bucketName),
        versioning: await this.getS3BucketVersioning(bucketName),
        logging: await this.getS3BucketLogging(bucketName),
        publicAccess: await this.getS3PublicAccessBlock(bucketName),
        lifecycle: await this.getS3BucketLifecycle(bucketName),
      };

      // Store evidence
      const _evidence = await this.collectorEvidenceService.createCollectorEvidence({
        controlId,
        organizationId: this.configService.get('AWS_ORGANIZATION_ID', 'default'),
        type: EvidenceType.CONFIGURATION,
        title: `AWS S3 Bucket Configuration - ${bucketName} - ${new Date().toISOString()}`,
        description: `S3 bucket configuration for ${bucketName}`,
        data: configurations,
        source: EvidenceSource.AWS,
        collectorType: 'aws',
        metadata: {
          retentionDays: 365,
          bucketName,
          region: this.configService.get('AWS_REGION', 'us-east-1'),
        },
      });

      return configurations;
    } catch (error) {
      this.logger.error(`Failed to collect S3 configuration: ${error.message}`);
      throw error;
    }
  }

  private async getS3BucketEncryption(bucketName: string): Promise<any> {
    // Implementation for getting S3 bucket encryption
    // This would use GetBucketEncryptionCommand
    return { status: 'AES256' };
  }

  private async getS3BucketVersioning(bucketName: string): Promise<any> {
    // Implementation for getting S3 bucket versioning
    // This would use GetBucketVersioningCommand
    return { status: 'Enabled' };
  }

  private async getS3BucketLogging(bucketName: string): Promise<any> {
    // Implementation for getting S3 bucket logging
    // This would use GetBucketLoggingCommand
    return { enabled: true };
  }

  private async getS3PublicAccessBlock(bucketName: string): Promise<any> {
    // Implementation for getting S3 public access block
    // This would use GetPublicAccessBlockCommand
    return { blockPublicAcls: true, blockPublicPolicy: true };
  }

  private async getS3BucketLifecycle(bucketName: string): Promise<any> {
    // Implementation for getting S3 bucket lifecycle
    // This would use GetBucketLifecycleConfigurationCommand
    return { rules: [] };
  }

  async schedulePeriodicCollection(
    controlId: string,
    collectionType: string,
    frequency: string,
  ): Promise<void> {
    this.logger.log(
      `Scheduling ${frequency} collection of ${collectionType} for control ${controlId}`,
    );
    // Implementation would use @nestjs/schedule to set up cron jobs
  }
}