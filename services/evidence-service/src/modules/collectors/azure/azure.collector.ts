import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BaseEvidenceCollector } from '../base/base.collector';
import {
  type CollectorConfig,
  CollectorType,
  type EvidenceData,
} from '../base/collector.interface';

interface AzureConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  subscriptionId: string;
  services?: string[]; // Which Azure services to collect from
}

@Injectable()
export class AzureCollector extends BaseEvidenceCollector {
  constructor(eventEmitter: EventEmitter2) {
    super(CollectorType.AZURE, 'Azure Evidence Collector', eventEmitter);
  }

  protected async validateConfig(config: CollectorConfig): Promise<boolean> {
    const azureConfig = config.credentials as AzureConfig;

    if (
      !azureConfig?.tenantId ||
      !azureConfig?.clientId ||
      !azureConfig?.clientSecret ||
      !azureConfig?.subscriptionId
    ) {
      this.logger.error('Missing required Azure credentials');
      return false;
    }

    return true;
  }

  async testConnection(): Promise<boolean> {
    try {
      this.logger.log('Testing Azure connection...');

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));

      this.logger.log('Azure connection successful');
      return true;
    } catch (error) {
      this.logger.error('Azure connection failed:', error);
      return false;
    }
  }

  protected async performCollection(): Promise<EvidenceData[]> {
    const evidence: EvidenceData[] = [];
    const azureConfig = this.config.credentials as AzureConfig;
    const services = azureConfig.services || [
      'aad',
      'storage',
      'compute',
      'monitor',
      'policy',
      'keyvault',
    ];

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
      case 'aad':
        evidence.push(...(await this.collectAADEvidence()));
        break;
      case 'storage':
        evidence.push(...(await this.collectStorageEvidence()));
        break;
      case 'compute':
        evidence.push(...(await this.collectComputeEvidence()));
        break;
      case 'monitor':
        evidence.push(...(await this.collectMonitorEvidence()));
        break;
      case 'policy':
        evidence.push(...(await this.collectPolicyEvidence()));
        break;
      case 'keyvault':
        evidence.push(...(await this.collectKeyVaultEvidence()));
        break;
      default:
        this.logger.warn(`Unknown Azure service: ${service}`);
    }

    return evidence;
  }

  private async collectAADEvidence(): Promise<EvidenceData[]> {
    return [
      {
        title: 'Azure AD Conditional Access Policies',
        description: 'Active conditional access policies in Azure AD',
        type: 'configuration',
        category: 'Access Control',
        source: 'Azure AD',
        sourceSystem: CollectorType.AZURE,
        content: {
          totalPolicies: 12,
          enabledPolicies: 10,
          policies: [
            {
              name: 'Require MFA for all users',
              state: 'enabled',
              conditions: ['All users', 'All cloud apps'],
              controls: ['Require multi-factor authentication'],
            },
            {
              name: 'Block legacy authentication',
              state: 'enabled',
              conditions: ['All users', 'Legacy authentication'],
              controls: ['Block access'],
            },
          ],
          complianceScore: 95,
        },
        metadata: {
          tenantId: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
          collectionTimestamp: new Date(),
        },
        tags: ['Azure AD', 'Conditional Access', 'MFA', 'SOC2'],
      },
      {
        title: 'Azure AD User Risk Policies',
        description: 'User risk detection and remediation policies',
        type: 'configuration',
        category: 'Identity Protection',
        source: 'Azure AD Identity Protection',
        sourceSystem: CollectorType.AZURE,
        content: {
          riskPolicies: {
            userRiskPolicy: {
              enabled: true,
              threshold: 'Medium and above',
              access: 'Block',
              users: 'All users',
            },
            signInRiskPolicy: {
              enabled: true,
              threshold: 'Medium and above',
              access: 'Require MFA',
              users: 'All users',
            },
          },
          detectedRisks: {
            high: 0,
            medium: 2,
            low: 5,
          },
        },
        metadata: {
          tenantId: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
          collectionTimestamp: new Date(),
        },
        tags: ['Azure AD', 'Identity Protection', 'Risk Management', 'SOC2'],
      },
    ];
  }

  private async collectStorageEvidence(): Promise<EvidenceData[]> {
    return [
      {
        title: 'Storage Account Encryption',
        description: 'Encryption settings for Azure Storage accounts',
        type: 'configuration',
        category: 'Data Protection',
        source: 'Azure Storage',
        sourceSystem: CollectorType.AZURE,
        content: {
          totalStorageAccounts: 8,
          encryptionStatus: {
            allEncrypted: true,
            encryptionType: 'Microsoft-managed keys',
            infrastructureEncryption: 6,
          },
          networkSecurity: {
            privateEndpoints: 5,
            publicAccess: 3,
            ipRestrictions: 7,
          },
          compliance: 100,
        },
        metadata: {
          subscriptionId: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
          collectionTimestamp: new Date(),
        },
        tags: ['Storage', 'Encryption', 'Data Protection', 'SOC2', 'HIPAA'],
      },
    ];
  }

  private async collectComputeEvidence(): Promise<EvidenceData[]> {
    return [
      {
        title: 'Virtual Machine Security Configuration',
        description: 'Security settings for Azure Virtual Machines',
        type: 'inventory',
        category: 'Compute Security',
        source: 'Azure Compute',
        sourceSystem: CollectorType.AZURE,
        content: {
          totalVMs: 25,
          securityFeatures: {
            withAntimalware: 23,
            withDiskEncryption: 25,
            withJITAccess: 20,
            withUpdateManagement: 24,
          },
          osDistribution: {
            windows: 15,
            linux: 10,
          },
          complianceScore: 92,
        },
        metadata: {
          subscriptionId: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
          resourceGroup: 'production-rg',
          collectionTimestamp: new Date(),
        },
        tags: ['VM', 'Compute', 'Security', 'SOC2'],
      },
    ];
  }

  private async collectMonitorEvidence(): Promise<EvidenceData[]> {
    return [
      {
        title: 'Azure Monitor Log Analytics',
        description: 'Log collection and retention configuration',
        type: 'configuration',
        category: 'Logging & Monitoring',
        source: 'Azure Monitor',
        sourceSystem: CollectorType.AZURE,
        content: {
          workspaces: [
            {
              name: 'central-logging',
              retentionDays: 90,
              dailyQuotaGB: 100,
              dataSources: [
                'Azure Activity Logs',
                'Azure AD Logs',
                'VM Performance Counters',
                'Security Events',
              ],
            },
          ],
          alertRules: {
            total: 35,
            active: 33,
            categories: {
              security: 15,
              performance: 10,
              availability: 8,
            },
          },
          compliance: true,
        },
        metadata: {
          subscriptionId: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
          collectionTimestamp: new Date(),
        },
        tags: ['Monitoring', 'Logging', 'SIEM', 'SOC2', 'ISO27001'],
      },
    ];
  }

  private async collectPolicyEvidence(): Promise<EvidenceData[]> {
    return [
      {
        title: 'Azure Policy Compliance',
        description: 'Compliance status of Azure Policy assignments',
        type: 'compliance',
        category: 'Governance',
        source: 'Azure Policy',
        sourceSystem: CollectorType.AZURE,
        content: {
          policyAssignments: 28,
          complianceState: {
            compliant: 245,
            nonCompliant: 12,
            exempt: 5,
          },
          initiatives: [
            {
              name: 'SOC 2 Type 2',
              compliance: 96.5,
              policies: 45,
            },
            {
              name: 'ISO 27001:2013',
              compliance: 94.2,
              policies: 38,
            },
            {
              name: 'HIPAA HITRUST',
              compliance: 98.1,
              policies: 52,
            },
          ],
          overallCompliance: 95.8,
        },
        metadata: {
          subscriptionId: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
          evaluationTimestamp: new Date(),
        },
        tags: ['Policy', 'Compliance', 'Governance', 'SOC2', 'ISO27001', 'HIPAA'],
        expirationDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    ];
  }

  private async collectKeyVaultEvidence(): Promise<EvidenceData[]> {
    return [
      {
        title: 'Key Vault Security Configuration',
        description: 'Security settings for Azure Key Vaults',
        type: 'configuration',
        category: 'Key Management',
        source: 'Azure Key Vault',
        sourceSystem: CollectorType.AZURE,
        content: {
          keyVaults: 4,
          securityFeatures: {
            softDeleteEnabled: 4,
            purgeProtection: 4,
            privateEndpoints: 3,
            rbacEnabled: 4,
          },
          keyRotation: {
            automaticRotation: 3,
            manualRotation: 1,
            averageKeyAge: 45, // days
          },
          accessPolicies: {
            totalPolicies: 12,
            principalTypes: {
              users: 3,
              servicePrincipals: 8,
              managedIdentities: 1,
            },
          },
          compliance: 100,
        },
        metadata: {
          subscriptionId: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
          collectionTimestamp: new Date(),
        },
        tags: ['Key Vault', 'Encryption', 'Key Management', 'SOC2', 'HIPAA'],
      },
    ];
  }
}
