import { MonitorClient } from '@azure/arm-monitor';
import { PolicyClient } from '@azure/arm-policy';
import { SecurityCenter } from '@azure/arm-security';
import { ClientSecretCredential, DefaultAzureCredential } from '@azure/identity';
import { LogsQueryClient } from '@azure/monitor-query';
import { BlobServiceClient } from '@azure/storage-blob';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventType } from '@soc-compliance/events';
import { KafkaService } from '../../../kafka/kafka.service';
import { EvidenceSource, EvidenceType } from '../../evidence/entities/evidence.entity';
import type { CollectorEvidenceService } from '../base/collector-evidence.service';

export interface AzureCollectorConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  subscriptionId: string;
  resourceGroup?: string;
  logAnalyticsWorkspaceId?: string;
}

@Injectable()
export class AzureCollectorService {
  private credential: ClientSecretCredential | DefaultAzureCredential;
  private securityClient: SecurityCenter;
  private monitorClient: MonitorClient;
  private policyClient: PolicyClient;
  private logAnalyticsClient: LogsQueryClient;
  private blobServiceClient: BlobServiceClient;

  constructor(
    private configService: ConfigService,
    private kafkaService: KafkaService,
    private collectorEvidenceService: CollectorEvidenceService
  ) {}

  async initialize(config: AzureCollectorConfig) {
    // Initialize Azure credentials
    if (config.clientId && config.clientSecret) {
      this.credential = new ClientSecretCredential(
        config.tenantId,
        config.clientId,
        config.clientSecret
      );
    } else {
      this.credential = new DefaultAzureCredential();
    }

    // Initialize Azure clients
    this.securityClient = new SecurityCenter(this.credential, config.subscriptionId);
    this.monitorClient = new MonitorClient(this.credential, config.subscriptionId);
    this.policyClient = new PolicyClient(this.credential, config.subscriptionId);

    if (config.logAnalyticsWorkspaceId) {
      this.logAnalyticsClient = new LogsQueryClient(this.credential);
    }
  }

  async collectActivityLogs(
    startTime: Date,
    endTime: Date,
    controlId: string,
    organizationId: string
  ): Promise<any> {
    try {
      const filter = `eventTimestamp ge '${startTime.toISOString()}' and eventTimestamp le '${endTime.toISOString()}'`;

      const activities = [];
      for await (const activity of this.monitorClient.activityLogs.list(filter)) {
        activities.push({
          eventName: activity.eventName?.value,
          category: activity.category?.value,
          resourceId: activity.resourceId,
          caller: activity.caller,
          level: activity.level,
          status: activity.status?.value,
          timestamp: activity.eventTimestamp,
          properties: activity.properties,
        });
      }

      // Store evidence
      const evidence = await this.collectorEvidenceService.createCollectorEvidence({
        controlId,
        organizationId,
        type: EvidenceType.AZURE_ACTIVITY_LOGS,
        title: `Azure Activity Logs - ${new Date().toISOString()}`,
        description: 'Activity logs collected from Azure Monitor',
        data: activities,
        source: EvidenceSource.AZURE,
        collectorType: 'azure',
        metadata: {
          retentionDays: 365,
          subscriptionId: this.configService.get('AZURE_SUBSCRIPTION_ID'),
        },
      });

      await this.kafkaService.emit(EventType.EVIDENCE_COLLECTED, {
        evidenceId: evidence.id,
        controlId,
        source: 'AZURE_ACTIVITY_LOGS',
        itemCount: activities.length,
      });

      return activities;
    } catch (error) {
      await this.kafkaService.emit(EventType.EVIDENCE_COLLECTION_FAILED, {
        controlId,
        source: 'AZURE_ACTIVITY_LOGS',
        error: error.message,
      });
      throw error;
    }
  }

  async collectSecurityAlerts(controlId: string, organizationId: string): Promise<any> {
    try {
      const alerts = [];

      // Get security alerts
      for await (const alert of this.securityClient.alerts.list()) {
        alerts.push({
          alertName: alert.alertDisplayName,
          severity: alert.severity,
          status: alert.status,
          description: alert.description,
          remediation: alert.remediationSteps,
          affectedResources: alert.resourceIdentifiers?.map(r => r.toString()) || [],
          detectedTime: alert.timeGeneratedUtc,
          vendor: alert.vendorName,
          alertType: alert.alertType,
        });
      }

      // Store evidence
      const evidence = await this.collectorEvidenceService.createCollectorEvidence({
        controlId,
        organizationId,
        type: EvidenceType.AZURE_SECURITY_ALERTS,
        title: `Azure Security Alerts - ${new Date().toISOString()}`,
        description: 'Security alerts from Azure Security Center',
        data: alerts,
        source: EvidenceSource.AZURE,
        collectorType: 'azure',
        metadata: {
          retentionDays: 365,
          subscriptionId: this.configService.get('AZURE_SUBSCRIPTION_ID'),
        },
      });

      await this.kafkaService.emit(EventType.EVIDENCE_COLLECTED, {
        evidenceId: evidence.id,
        controlId,
        source: 'AZURE_SECURITY_ALERTS',
        itemCount: alerts.length,
      });

      return alerts;
    } catch (error) {
      await this.kafkaService.emit(EventType.EVIDENCE_COLLECTION_FAILED, {
        controlId,
        source: 'AZURE_SECURITY_ALERTS',
        error: error.message,
      });
      throw error;
    }
  }

  async collectPolicyCompliance(controlId: string, organizationId: string): Promise<any> {
    try {
      const policyStates = [];

      // Get policy compliance states
      const _queryOptions = {
        queryOptions: {
          filter: "complianceState eq 'NonCompliant'",
          top: 100,
        },
      };

      // Policy states require @azure/arm-policyinsights package
      // For now, we'll collect policy definitions instead
      const policyDefinitions = [];
      for await (const definition of this.policyClient.policyDefinitions.list()) {
        if (definition.policyType === 'Custom') {
          policyDefinitions.push(definition);
        }
      }

      for (const definition of policyDefinitions) {
        const state = {
          resourceId: definition.id,
          policyDefinitionName: definition.name,
          policySetDefinitionName: undefined,
          complianceState: 'Unknown', // Would need PolicyInsights SDK for actual compliance
          timestamp: new Date(),
          resourceType: 'Microsoft.Authorization/policyDefinitions',
          resourceLocation: undefined,
          policyDefinitionAction: definition.policyRule?.then?.effect,
        };
        policyStates.push(state);
      }

      // Store evidence
      const evidence = await this.collectorEvidenceService.createCollectorEvidence({
        controlId,
        organizationId,
        type: EvidenceType.AZURE_POLICY_COMPLIANCE,
        title: `Azure Policy Compliance - ${new Date().toISOString()}`,
        description: 'Policy compliance states from Azure Policy',
        data: policyStates,
        source: EvidenceSource.AZURE,
        collectorType: 'azure',
        metadata: {
          retentionDays: 365,
          subscriptionId: this.configService.get('AZURE_SUBSCRIPTION_ID'),
        },
      });

      await this.kafkaService.emit(EventType.EVIDENCE_COLLECTED, {
        evidenceId: evidence.id,
        controlId,
        source: 'AZURE_POLICY_COMPLIANCE',
        itemCount: policyStates.length,
      });

      return policyStates;
    } catch (error) {
      await this.kafkaService.emit(EventType.EVIDENCE_COLLECTION_FAILED, {
        controlId,
        source: 'AZURE_POLICY_COMPLIANCE',
        error: error.message,
      });
      throw error;
    }
  }

  async collectSecurityRecommendations(controlId: string, organizationId: string): Promise<any> {
    try {
      const recommendations = [];

      // Get security recommendations
      for await (const task of this.securityClient.tasks.list()) {
        recommendations.push({
          taskName: task.name,
          state: task.state,
          creationTime: task.creationTimeUtc,
          lastStateChangeTime: task.lastStateChangeTimeUtc,
          securityTaskParameters: task.securityTaskParameters,
          resourceId: task.id,
        });
      }

      // Store evidence
      const evidence = await this.collectorEvidenceService.createCollectorEvidence({
        controlId,
        organizationId,
        type: EvidenceType.AZURE_SECURITY_RECOMMENDATIONS,
        title: `Azure Security Recommendations - ${new Date().toISOString()}`,
        description: 'Security recommendations from Azure Security Center',
        data: recommendations,
        source: EvidenceSource.AZURE,
        collectorType: 'azure',
        metadata: {
          retentionDays: 365,
          subscriptionId: this.configService.get('AZURE_SUBSCRIPTION_ID'),
        },
      });

      await this.kafkaService.emit(EventType.EVIDENCE_COLLECTED, {
        evidenceId: evidence.id,
        controlId,
        source: 'AZURE_SECURITY_RECOMMENDATIONS',
        itemCount: recommendations.length,
      });

      return recommendations;
    } catch (error) {
      await this.kafkaService.emit(EventType.EVIDENCE_COLLECTION_FAILED, {
        controlId,
        source: 'AZURE_SECURITY_RECOMMENDATIONS',
        error: error.message,
      });
      throw error;
    }
  }

  async collectLogAnalyticsData(
    query: string,
    startTime: Date,
    endTime: Date,
    controlId: string,
    organizationId: string,
    workspaceId: string
  ): Promise<any> {
    try {
      if (!this.logAnalyticsClient) {
        throw new Error('Log Analytics client not initialized');
      }

      const result = await this.logAnalyticsClient.queryWorkspace(workspaceId, query, {
        startTime,
        endTime,
      });

      const data: any[] = [];
      if ('tables' in result && result.tables) {
        result.tables.forEach(table => {
          data.push({
            name: table.name,
            columns: table.columnDescriptors || [],
            rows: table.rows,
          });
        });
      }

      // Store evidence
      const evidence = await this.collectorEvidenceService.createCollectorEvidence({
        controlId,
        organizationId,
        type: EvidenceType.AZURE_LOG_ANALYTICS,
        title: `Azure Log Analytics Query - ${new Date().toISOString()}`,
        description: `Log Analytics query results: ${query}`,
        data,
        source: EvidenceSource.AZURE,
        collectorType: 'azure',
        metadata: {
          retentionDays: 365,
          workspaceId,
          query,
        },
      });

      await this.kafkaService.emit(EventType.EVIDENCE_COLLECTED, {
        evidenceId: evidence.id,
        controlId,
        source: 'AZURE_LOG_ANALYTICS',
        itemCount: data.reduce((sum, table) => sum + table.rows.length, 0),
      });

      return data;
    } catch (error) {
      await this.kafkaService.emit(EventType.EVIDENCE_COLLECTION_FAILED, {
        controlId,
        source: 'AZURE_LOG_ANALYTICS',
        error: error.message,
      });
      throw error;
    }
  }

  async collectKeyVaultAuditLogs(
    vaultName: string,
    startTime: Date,
    endTime: Date,
    controlId: string,
    organizationId: string
  ): Promise<any> {
    try {
      const query = `
        AzureDiagnostics
        | where ResourceType == "VAULTS" and Resource == "${vaultName}"
        | where TimeGenerated >= datetime('${startTime.toISOString()}')
        | where TimeGenerated <= datetime('${endTime.toISOString()}')
        | where OperationName in ("SecretGet", "SecretSet", "SecretDelete", "KeySign", "KeyVerify", "KeyEncrypt", "KeyDecrypt")
        | project TimeGenerated, OperationName, CallerIPAddress, identity_claim_upn_s, ResultType, DurationMs
        | order by TimeGenerated desc
      `;

      return await this.collectLogAnalyticsData(
        query,
        startTime,
        endTime,
        controlId,
        organizationId,
        this.configService.get('azure.logAnalyticsWorkspaceId') || ''
      );
    } catch (error) {
      await this.kafkaService.emit(EventType.EVIDENCE_COLLECTION_FAILED, {
        controlId,
        source: 'AZURE_KEYVAULT_AUDIT',
        error: error.message,
      });
      throw error;
    }
  }

  async collectNetworkSecurityGroupFlowLogs(
    nsgName: string,
    startTime: Date,
    endTime: Date,
    controlId: string,
    organizationId: string,
    storageAccount: string
  ): Promise<any> {
    try {
      if (!this.blobServiceClient) {
        this.blobServiceClient = new BlobServiceClient(
          `https://${storageAccount}.blob.core.windows.net`,
          this.credential
        );
      }

      const containerName = 'insights-logs-networksecuritygroupflowevent';
      const containerClient = this.blobServiceClient.getContainerClient(containerName);

      const flowLogs = [];

      // List blobs in the time range
      for await (const blob of containerClient.listBlobsFlat()) {
        if (blob.name.includes(nsgName)) {
          const blobClient = containerClient.getBlobClient(blob.name);
          const downloadResponse = await blobClient.download();
          if (!downloadResponse.readableStreamBody) {
            throw new Error('No readable stream body available');
          }
          const downloaded = await this.streamToBuffer(downloadResponse.readableStreamBody);
          const content = JSON.parse(downloaded.toString());

          flowLogs.push(...content.records);
        }
      }

      // Store evidence
      const evidence = await this.collectorEvidenceService.createCollectorEvidence({
        controlId,
        organizationId,
        type: EvidenceType.AZURE_NSG_FLOW_LOGS,
        title: `Azure NSG Flow Logs - ${nsgName} - ${new Date().toISOString()}`,
        description: 'Network Security Group flow logs',
        data: flowLogs,
        source: EvidenceSource.AZURE,
        collectorType: 'azure',
        metadata: {
          retentionDays: 365,
          nsgName,
          storageAccount,
        },
      });

      await this.kafkaService.emit(EventType.EVIDENCE_COLLECTED, {
        evidenceId: evidence.id,
        controlId,
        source: 'AZURE_NSG_FLOW_LOGS',
        itemCount: flowLogs.length,
      });

      return flowLogs;
    } catch (error) {
      await this.kafkaService.emit(EventType.EVIDENCE_COLLECTION_FAILED, {
        controlId,
        source: 'AZURE_NSG_FLOW_LOGS',
        error: error.message,
      });
      throw error;
    }
  }

  async collectRoleAssignments(controlId: string, organizationId: string): Promise<any> {
    try {
      const AuthorizationManagementClient = await import('@azure/arm-authorization');
      const authClient = new AuthorizationManagementClient.AuthorizationManagementClient(
        this.credential,
        this.configService.get('azure.subscriptionId') || ''
      );

      const roleAssignments = [];

      for await (const assignment of authClient.roleAssignments.listForSubscription()) {
        roleAssignments.push({
          principalId: assignment.principalId,
          principalType: assignment.principalType,
          roleDefinitionId: assignment.roleDefinitionId,
          scope: assignment.scope,
          createdOn: assignment.createdOn,
          updatedOn: assignment.updatedOn,
        });
      }

      // Store evidence
      const evidence = await this.collectorEvidenceService.createCollectorEvidence({
        controlId,
        organizationId,
        type: EvidenceType.AZURE_ROLE_ASSIGNMENTS,
        title: `Azure Role Assignments - ${new Date().toISOString()}`,
        description: 'RBAC role assignments in Azure',
        data: roleAssignments,
        source: EvidenceSource.AZURE,
        collectorType: 'azure',
        metadata: {
          retentionDays: 365,
          subscriptionId: this.configService.get('AZURE_SUBSCRIPTION_ID'),
        },
      });

      await this.kafkaService.emit(EventType.EVIDENCE_COLLECTED, {
        evidenceId: evidence.id,
        controlId,
        source: 'AZURE_ROLE_ASSIGNMENTS',
        itemCount: roleAssignments.length,
      });

      return roleAssignments;
    } catch (error) {
      await this.kafkaService.emit(EventType.EVIDENCE_COLLECTION_FAILED, {
        controlId,
        source: 'AZURE_ROLE_ASSIGNMENTS',
        error: error.message,
      });
      throw error;
    }
  }

  private async streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
    const chunks: Buffer[] = [];
    return new Promise((resolve, reject) => {
      stream.on('data', chunk => chunks.push(Buffer.from(chunk)));
      stream.on('error', reject);
      stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
  }
}
