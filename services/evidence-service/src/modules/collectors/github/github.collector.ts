import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BaseEvidenceCollector } from '../base/base.collector';
import {
  type CollectorConfig,
  CollectorType,
  type EvidenceData,
} from '../base/collector.interface';

interface GitHubConfig {
  token: string;
  organization?: string;
  repositories?: string[]; // Specific repos to collect from
  includePrivate?: boolean;
}

@Injectable()
export class GitHubCollector extends BaseEvidenceCollector {
  constructor(eventEmitter: EventEmitter2) {
    super(CollectorType.GITHUB, 'GitHub Evidence Collector', eventEmitter);
  }

  protected async validateConfig(config: CollectorConfig): Promise<boolean> {
    const githubConfig = config.credentials as GitHubConfig;

    if (!githubConfig?.token) {
      this.logger.error('Missing required GitHub token');
      return false;
    }

    if (
      !githubConfig.organization &&
      (!githubConfig.repositories || githubConfig.repositories.length === 0)
    ) {
      this.logger.error('Must specify either organization or repositories');
      return false;
    }

    return true;
  }

  async testConnection(): Promise<boolean> {
    try {
      this.logger.log('Testing GitHub connection...');

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));

      this.logger.log('GitHub connection successful');
      return true;
    } catch (error) {
      this.logger.error('GitHub connection failed:', error);
      return false;
    }
  }

  protected async performCollection(): Promise<EvidenceData[]> {
    const evidence: EvidenceData[] = [];
    const githubConfig = this.config.credentials as GitHubConfig;

    // Collect organization-level evidence
    if (githubConfig.organization) {
      evidence.push(...(await this.collectOrganizationEvidence(githubConfig.organization)));
    }

    // Collect repository-specific evidence
    const repos = await this.getRepositories(githubConfig);
    for (const repo of repos) {
      try {
        evidence.push(...(await this.collectRepositoryEvidence(repo)));
      } catch (error) {
        await this.handleError(error, `Collecting from repository ${repo}`);
      }
    }

    return evidence;
  }

  private async getRepositories(config: GitHubConfig): Promise<string[]> {
    if (config.repositories && config.repositories.length > 0) {
      return config.repositories;
    }

    // In production, would fetch repos from GitHub API
    // For now, return sample repos
    return ['backend-api', 'frontend-app', 'infrastructure', 'documentation'];
  }

  private async collectOrganizationEvidence(org: string): Promise<EvidenceData[]> {
    return [
      {
        title: 'GitHub Organization Security Settings',
        description: 'Security configuration for GitHub organization',
        type: 'configuration',
        category: 'Source Code Security',
        source: `GitHub Organization: ${org}`,
        sourceSystem: CollectorType.GITHUB,
        content: {
          organization: org,
          securitySettings: {
            twoFactorRequired: true,
            samlEnabled: true,
            ipAllowList: true,
            verifiedDomains: ['overmatch.com'],
          },
          memberStats: {
            totalMembers: 45,
            membersWithTwoFactor: 45,
            admins: 5,
            outsideCollaborators: 3,
          },
          compliance: {
            twoFactorCompliance: 100,
            ssoCompliance: 100,
          },
        },
        metadata: {
          organization: org,
          collectionTimestamp: new Date(),
        },
        tags: ['GitHub', 'Source Code', 'Access Control', 'SOC2'],
      },
      {
        title: 'GitHub Organization Audit Log',
        description: 'Recent security-relevant audit events',
        type: 'audit_log',
        category: 'Audit Trail',
        source: `GitHub Organization: ${org}`,
        sourceSystem: CollectorType.GITHUB,
        content: {
          recentEvents: [
            {
              action: 'org.update_member',
              actor: 'admin@overmatch.com',
              timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
              details: 'Changed member role from member to admin',
            },
            {
              action: 'repo.create',
              actor: 'developer@overmatch.com',
              timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
              details: 'Created private repository: new-service',
            },
            {
              action: 'org.enable_two_factor_requirement',
              actor: 'security@overmatch.com',
              timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
              details: 'Enabled 2FA requirement for organization',
            },
          ],
          eventCategories: {
            authentication: 145,
            authorization: 89,
            repository: 234,
            organization: 67,
          },
        },
        metadata: {
          organization: org,
          logPeriod: '30 days',
          collectionTimestamp: new Date(),
        },
        tags: ['GitHub', 'Audit Log', 'Security Events', 'SOC2'],
        expirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    ];
  }

  private async collectRepositoryEvidence(repo: string): Promise<EvidenceData[]> {
    return [
      {
        title: `Repository Security: ${repo}`,
        description: `Security settings and compliance for ${repo}`,
        type: 'configuration',
        category: 'Repository Security',
        source: `GitHub Repository: ${repo}`,
        sourceSystem: CollectorType.GITHUB,
        content: {
          repository: repo,
          visibility: 'private',
          securityFeatures: {
            branchProtection: {
              enabled: true,
              requirePullRequestReviews: true,
              requiredReviewers: 2,
              dismissStaleReviews: true,
              requireCodeOwnerReviews: true,
              requireSignedCommits: true,
              includeAdministrators: true,
            },
            secretScanning: {
              enabled: true,
              alertsOpen: 0,
              alertsResolved: 3,
            },
            dependencyScanning: {
              enabled: true,
              vulnerabilities: {
                critical: 0,
                high: 1,
                medium: 3,
                low: 7,
              },
            },
            codeScanning: {
              enabled: true,
              languages: ['javascript', 'typescript', 'python'],
              lastScan: new Date(Date.now() - 2 * 60 * 60 * 1000),
              findings: {
                high: 0,
                medium: 2,
                low: 5,
              },
            },
          },
          compliance: {
            branchProtection: 100,
            secretScanning: 100,
            vulnerabilityManagement: 95,
          },
        },
        metadata: {
          repository: repo,
          defaultBranch: 'main',
          collectionTimestamp: new Date(),
        },
        tags: ['GitHub', 'Repository', 'Branch Protection', 'Code Security', 'SOC2'],
      },
      {
        title: `Code Review Process: ${repo}`,
        description: `Code review metrics and compliance for ${repo}`,
        type: 'metrics',
        category: 'Change Management',
        source: `GitHub Repository: ${repo}`,
        sourceSystem: CollectorType.GITHUB,
        content: {
          repository: repo,
          pullRequestMetrics: {
            last30Days: {
              totalPRs: 45,
              averageReviewers: 2.3,
              averageTimeToMerge: '4.2 hours',
              prsWithoutReview: 0,
              prsWithFailedChecks: 2,
            },
            reviewCompliance: {
              requiredReviews: 100,
              codeOwnerReviews: 98,
              passingChecks: 95.6,
            },
          },
          topContributors: [
            { username: 'developer1', commits: 89, prs: 23 },
            { username: 'developer2', commits: 67, prs: 18 },
            { username: 'developer3', commits: 45, prs: 12 },
          ],
        },
        metadata: {
          repository: repo,
          analysisPeriod: '30 days',
          collectionTimestamp: new Date(),
        },
        tags: ['GitHub', 'Code Review', 'Change Management', 'SOC2'],
      },
    ];
  }
}
