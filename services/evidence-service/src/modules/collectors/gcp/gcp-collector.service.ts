import { AccessApprovalClient } from '@google-cloud/access-approval';
import { AssetServiceClient } from '@google-cloud/asset';
import { Logging } from '@google-cloud/logging';
import { MetricServiceClient } from '@google-cloud/monitoring';
import { SecurityCenterClient } from '@google-cloud/security-center';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
// PolicyTroubleshooterClient removed - not available in current SDK
import { EventType } from '@soc-compliance/events';
import { KafkaService } from '../../../kafka/kafka.service';
import { EvidenceSource, EvidenceType } from '../../evidence/entities/evidence.entity';
import type { CollectorEvidenceService } from '../base/collector-evidence.service';

export interface GCPCollectorConfig {
  projectId: string;
  keyFilePath?: string;
  organizationId?: string;
}

@Injectable()
export class GCPCollectorService {
  private securityClient: any; // GCP SecurityCenterClient
  private loggingClient: Logging;
  private metricServiceClient: MetricServiceClient;
  private assetClient: AssetServiceClient;
  private accessApprovalClient: AccessApprovalClient;
  // private policyClient: PolicyTroubleshooterClient; // Not available in current SDK
  private projectId: string;
  private organizationId: string;

  constructor(
    private configService: ConfigService,
    private kafkaService: KafkaService,
    private collectorEvidenceService: CollectorEvidenceService
  ) {}

  async initialize(config: GCPCollectorConfig) {
    this.projectId = config.projectId;
    this.organizationId = config.organizationId || config.projectId;

    const clientConfig = config.keyFilePath ? { keyFilename: config.keyFilePath } : {};

    // Initialize GCP clients
    this.securityClient = new SecurityCenterClient(clientConfig);
    this.loggingClient = new Logging(clientConfig);
    this.metricServiceClient = new MetricServiceClient(clientConfig);
    this.assetClient = new AssetServiceClient(clientConfig);
    this.accessApprovalClient = new AccessApprovalClient(clientConfig);
    // this.policyClient = new PolicyTroubleshooterClient(clientConfig); // Not available
  }

  async collectAuditLogs(
    startTime: Date,
    endTime: Date,
    controlId: string,
    organizationId: string
  ): Promise<any> {
    try {
      const filter = `
        timestamp >= "${startTime.toISOString()}"
        AND timestamp <= "${endTime.toISOString()}"
        AND (
          protoPayload.serviceName = "cloudresourcemanager.googleapis.com"
          OR protoPayload.serviceName = "iam.googleapis.com"
          OR protoPayload.serviceName = "compute.googleapis.com"
          OR protoPayload.serviceName = "storage.googleapis.com"
        )
      `;

      const [entries] = await this.loggingClient.getEntries({
        filter,
        orderBy: 'timestamp desc',
        maxResults: 1000,
      });

      const auditLogs = entries.map((entry) => {
        const metadata = entry.metadata || {};
        const data = entry.data || {};
        return {
          insertId: metadata.insertId,
          timestamp: metadata.timestamp,
          severity: metadata.severity,
          resource: metadata.resource,
          operation: data.protoPayload?.methodName,
          authenticationInfo: data.protoPayload?.authenticationInfo,
          requestMetadata: data.protoPayload?.requestMetadata,
          response: data.protoPayload?.response,
          serviceName: data.protoPayload?.serviceName,
        };
      });

      // Store evidence
      const evidence = await this.collectorEvidenceService.createCollectorEvidence({
        controlId,
        organizationId,
        type: EvidenceType.GCP_AUDIT_LOGS,
        title: `GCP Audit Logs - ${new Date().toISOString()}`,
        description: 'Cloud audit logs from Google Cloud Platform',
        data: auditLogs,
        source: EvidenceSource.GCP,
        collectorType: 'gcp',
        metadata: {
          retentionDays: 365,
          projectId: this.projectId,
        },
      });

      await this.kafkaService.emit(EventType.EVIDENCE_COLLECTED, {
        evidenceId: evidence.id,
        controlId,
        source: 'GCP_AUDIT_LOGS',
        itemCount: auditLogs.length,
      });

      return auditLogs;
    } catch (error) {
      await this.kafkaService.emit(EventType.EVIDENCE_COLLECTION_FAILED, {
        controlId,
        source: 'GCP_AUDIT_LOGS',
        error: error.message,
      });
      throw error;
    }
  }

  async collectSecurityFindings(controlId: string, organizationId: string): Promise<any> {
    try {
      const parent = this.organizationId
        ? `organizations/${this.organizationId}/sources/-`
        : `projects/${this.projectId}/sources/-`;

      const [findings] = await this.securityClient.listFindings({
        parent,
        filter: 'state="ACTIVE"',
        pageSize: 1000,
      });

      const securityFindings = findings.map((finding: any) => ({
        name: finding.name,
        category: finding.category,
        resourceName: finding.resourceName,
        state: finding.state,
        severity: finding.severity,
        sourceProperties: finding.sourceProperties,
        createTime: finding.createTime,
        eventTime: finding.eventTime,
        findingClass: finding.findingClass,
        indicator: finding.indicator,
        vulnerability: finding.vulnerability,
      }));

      // Store evidence
      const evidence = await this.collectorEvidenceService.createCollectorEvidence({
        controlId,
        organizationId,
        type: EvidenceType.GCP_SECURITY_FINDINGS,
        title: `GCP Security Findings - ${new Date().toISOString()}`,
        description: 'Security findings from Google Security Command Center',
        data: securityFindings,
        source: EvidenceSource.GCP,
        collectorType: 'gcp',
        metadata: {
          retentionDays: 365,
          projectId: this.projectId,
        },
      });

      await this.kafkaService.emit(EventType.EVIDENCE_COLLECTED, {
        evidenceId: evidence.id,
        controlId,
        source: 'GCP_SECURITY_FINDINGS',
        itemCount: securityFindings.length,
      });

      return securityFindings;
    } catch (error) {
      await this.kafkaService.emit(EventType.EVIDENCE_COLLECTION_FAILED, {
        controlId,
        source: 'GCP_SECURITY_FINDINGS',
        error: error.message,
      });
      throw error;
    }
  }

  async collectAssetInventory(controlId: string, organizationId: string): Promise<any> {
    try {
      const parent = this.organizationId
        ? `organizations/${this.organizationId}`
        : `projects/${this.projectId}`;

      const [assets] = await this.assetClient.listAssets({
        parent,
        assetTypes: [
          'compute.googleapis.com/Instance',
          'storage.googleapis.com/Bucket',
          'iam.googleapis.com/ServiceAccount',
          'cloudkms.googleapis.com/CryptoKey',
          'sqladmin.googleapis.com/Instance',
        ],
        contentType: 'RESOURCE',
        pageSize: 1000,
      });

      const assetInventory = assets.map((asset) => ({
        name: asset.name,
        assetType: asset.assetType,
        resource: asset.resource,
        iamPolicy: asset.iamPolicy,
        updateTime: asset.updateTime,
        ancestors: asset.ancestors,
      }));

      // Store evidence
      const evidence = await this.collectorEvidenceService.createCollectorEvidence({
        controlId,
        organizationId,
        type: EvidenceType.GCP_ASSET_INVENTORY,
        title: `GCP Asset Inventory - ${new Date().toISOString()}`,
        description: 'Cloud asset inventory from GCP',
        data: assetInventory,
        source: EvidenceSource.GCP,
        collectorType: 'gcp',
        metadata: {
          retentionDays: 365,
          projectId: this.projectId,
        },
      });

      await this.kafkaService.emit(EventType.EVIDENCE_COLLECTED, {
        evidenceId: evidence.id,
        controlId,
        source: 'GCP_ASSET_INVENTORY',
        itemCount: assetInventory.length,
      });

      return assetInventory;
    } catch (error) {
      await this.kafkaService.emit(EventType.EVIDENCE_COLLECTION_FAILED, {
        controlId,
        source: 'GCP_ASSET_INVENTORY',
        error: error.message,
      });
      throw error;
    }
  }

  async collectIAMPolicies(controlId: string, organizationId: string): Promise<any> {
    try {
      const parent = this.organizationId
        ? `organizations/${this.organizationId}`
        : `projects/${this.projectId}`;

      const [assets] = await this.assetClient.listAssets({
        parent,
        contentType: 'IAM_POLICY',
        pageSize: 1000,
      });

      const iamPolicies = assets.map((asset) => ({
        resourceName: asset.name,
        assetType: asset.assetType,
        policy: asset.iamPolicy,
        updateTime: asset.updateTime,
      }));

      // Store evidence
      const evidence = await this.collectorEvidenceService.createCollectorEvidence({
        controlId,
        organizationId,
        type: EvidenceType.GCP_IAM_POLICIES,
        title: `GCP IAM Policies - ${new Date().toISOString()}`,
        description: 'IAM policies and bindings from GCP',
        data: iamPolicies,
        source: EvidenceSource.GCP,
        collectorType: 'gcp',
        metadata: {
          retentionDays: 365,
          projectId: this.projectId,
        },
      });

      await this.kafkaService.emit(EventType.EVIDENCE_COLLECTED, {
        evidenceId: evidence.id,
        controlId,
        source: 'GCP_IAM_POLICIES',
        itemCount: iamPolicies.length,
      });

      return iamPolicies;
    } catch (error) {
      await this.kafkaService.emit(EventType.EVIDENCE_COLLECTION_FAILED, {
        controlId,
        source: 'GCP_IAM_POLICIES',
        error: error.message,
      });
      throw error;
    }
  }

  async collectVPCFlowLogs(
    startTime: Date,
    endTime: Date,
    controlId: string,
    organizationId: string
  ): Promise<any> {
    try {
      const filter = `
        resource.type="gce_subnetwork"
        AND log_name="projects/${this.projectId}/logs/compute.googleapis.com%2Fvpc_flows"
        AND timestamp >= "${startTime.toISOString()}"
        AND timestamp <= "${endTime.toISOString()}"
      `;

      const [entries] = await this.loggingClient.getEntries({
        filter,
        orderBy: 'timestamp desc',
        maxResults: 1000,
      });

      const flowLogs = entries.map((entry) => {
        const metadata = entry.metadata || {};
        const data = entry.data || {};
        return {
          insertId: metadata.insertId,
          timestamp: metadata.timestamp,
          resource: metadata.resource,
          jsonPayload: data.jsonPayload || data,
          labels: metadata.labels,
        };
      });

      // Store evidence
      const evidence = await this.collectorEvidenceService.createCollectorEvidence({
        controlId,
        organizationId,
        type: EvidenceType.GCP_VPC_FLOW_LOGS,
        title: `GCP VPC Flow Logs - ${new Date().toISOString()}`,
        description: 'VPC flow logs from Google Cloud',
        data: flowLogs,
        source: EvidenceSource.GCP,
        collectorType: 'gcp',
        metadata: {
          retentionDays: 365,
          projectId: this.projectId,
        },
      });

      await this.kafkaService.emit(EventType.EVIDENCE_COLLECTED, {
        evidenceId: evidence.id,
        controlId,
        source: 'GCP_VPC_FLOW_LOGS',
        itemCount: flowLogs.length,
      });

      return flowLogs;
    } catch (error) {
      await this.kafkaService.emit(EventType.EVIDENCE_COLLECTION_FAILED, {
        controlId,
        source: 'GCP_VPC_FLOW_LOGS',
        error: error.message,
      });
      throw error;
    }
  }

  async collectAccessApprovals(controlId: string, organizationId: string): Promise<any> {
    try {
      const parent = `projects/${this.projectId}`;

      const [requests] = await this.accessApprovalClient.listApprovalRequests({
        parent,
        pageSize: 100,
      });

      const approvalRequests = requests.map((request) => ({
        name: request.name,
        requestedResourceName: request.requestedResourceName,
        requestedReason: request.requestedReason,
        requestedLocations: request.requestedLocations,
        requestTime: request.requestTime,
        expireTime: request.requestedExpiration,
        approve: request.approve,
        dismiss: request.dismiss,
      }));

      // Store evidence
      const evidence = await this.collectorEvidenceService.createCollectorEvidence({
        controlId,
        organizationId,
        type: EvidenceType.GCP_ACCESS_APPROVALS,
        title: `GCP Access Approvals - ${new Date().toISOString()}`,
        description: 'Access approval requests from GCP',
        data: approvalRequests,
        source: EvidenceSource.GCP,
        collectorType: 'gcp',
        metadata: {
          retentionDays: 365,
          projectId: this.projectId,
        },
      });

      await this.kafkaService.emit(EventType.EVIDENCE_COLLECTED, {
        evidenceId: evidence.id,
        controlId,
        source: 'GCP_ACCESS_APPROVALS',
        itemCount: approvalRequests.length,
      });

      return approvalRequests;
    } catch (error) {
      await this.kafkaService.emit(EventType.EVIDENCE_COLLECTION_FAILED, {
        controlId,
        source: 'GCP_ACCESS_APPROVALS',
        error: error.message,
      });
      throw error;
    }
  }

  async collectSecurityHealthAnalytics(controlId: string, organizationId: string): Promise<any> {
    try {
      const parent = this.organizationId
        ? `organizations/${this.organizationId}/sources/-`
        : `projects/${this.projectId}/sources/-`;

      const [findings] = await this.securityClient.listFindings({
        parent,
        filter: 'category="SECURITY_HEALTH_ANALYTICS" AND state="ACTIVE"',
        pageSize: 1000,
      });

      const healthAnalytics = findings.map((finding: any) => ({
        name: finding.name,
        category: finding.category,
        resourceName: finding.resourceName,
        severity: finding.severity,
        finding: finding.finding,
        recommendation: finding.sourceProperties?.Recommendation,
        explanation: finding.sourceProperties?.Explanation,
        createTime: finding.createTime,
      }));

      // Store evidence
      const evidence = await this.collectorEvidenceService.createCollectorEvidence({
        controlId,
        organizationId,
        type: EvidenceType.GCP_SECURITY_HEALTH_ANALYTICS,
        title: `GCP Security Health Analytics - ${new Date().toISOString()}`,
        description: 'Security health analytics findings from GCP',
        data: healthAnalytics,
        source: EvidenceSource.GCP,
        collectorType: 'gcp',
        metadata: {
          retentionDays: 365,
          projectId: this.projectId,
        },
      });

      await this.kafkaService.emit(EventType.EVIDENCE_COLLECTED, {
        evidenceId: evidence.id,
        controlId,
        source: 'GCP_SECURITY_HEALTH_ANALYTICS',
        itemCount: healthAnalytics.length,
      });

      return healthAnalytics;
    } catch (error) {
      await this.kafkaService.emit(EventType.EVIDENCE_COLLECTION_FAILED, {
        controlId,
        source: 'GCP_SECURITY_HEALTH_ANALYTICS',
        error: error.message,
      });
      throw error;
    }
  }

  async collectBillingAlerts(controlId: string, organizationId: string): Promise<any> {
    try {
      const projectPath = `projects/${this.projectId}`;

      // Alert policies would need AlertPolicyServiceClient
      // For now, return empty array as we removed monitoring client
      const alertPolicies: any[] = [];

      // This would be the proper implementation:
      // const alertClient = new AlertPolicyServiceClient(clientConfig);
      // const [alertPolicies] = await alertClient.listAlertPolicies({
      //   name: projectPath,
      //   filter: 'resource.type="global"',
      // });

      const billingAlerts = alertPolicies
        .filter(
          (policy: any) =>
            policy.displayName?.includes('billing') || policy.displayName?.includes('cost')
        )
        .map((policy) => ({
          name: policy.name,
          displayName: policy.displayName,
          conditions: policy.conditions,
          notificationChannels: policy.notificationChannels,
          enabled: policy.enabled,
          creationTime: policy.creationRecord?.mutateTime,
        }));

      // Store evidence
      const evidence = await this.collectorEvidenceService.createCollectorEvidence({
        controlId,
        organizationId,
        type: EvidenceType.GCP_BILLING_ALERTS,
        title: `GCP Billing Alerts - ${new Date().toISOString()}`,
        description: 'Billing and cost alerts from GCP',
        data: billingAlerts,
        source: EvidenceSource.GCP,
        collectorType: 'gcp',
        metadata: {
          retentionDays: 365,
          projectId: this.projectId,
        },
      });

      await this.kafkaService.emit(EventType.EVIDENCE_COLLECTED, {
        evidenceId: evidence.id,
        controlId,
        source: 'GCP_BILLING_ALERTS',
        itemCount: billingAlerts.length,
      });

      return billingAlerts;
    } catch (error) {
      await this.kafkaService.emit(EventType.EVIDENCE_COLLECTION_FAILED, {
        controlId,
        source: 'GCP_BILLING_ALERTS',
        error: error.message,
      });
      throw error;
    }
  }
}
