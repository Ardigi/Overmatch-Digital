import { Injectable, Logger } from '@nestjs/common';
import {
  type AuditFindingsSummaryResponse,
  type AuditMetricsResponse,
  Control,
  type ControlMetricsResponse,
  type ControlSummaryResponse,
  type EvidenceCountResponse,
  type EvidenceMetricsResponse,
  MetricsResponse,
  type OrganizationResponse,
  type PaginatedControlsResponse,
  type PaginatedEvidenceResponse,
  type PaginatedFindingsResponse,
  type PolicyComplianceResponse,
  type PolicyMetricsResponse,
} from '@soc-compliance/contracts';
import { ServiceDiscoveryService, ServiceResponse } from '@soc-compliance/http-common';

export interface CollectOptions {
  organizationId: string;
  type: string;
  periodStart?: Date;
  periodEnd?: Date;
  filters?: Record<string, any>;
  sections?: string[];
  includeEvidence?: boolean;
  includeMetrics?: boolean;
  includeFindings?: boolean;
}

@Injectable()
export class ReportDataCollector {
  private readonly logger = new Logger(ReportDataCollector.name);

  constructor(private readonly serviceDiscovery: ServiceDiscoveryService) {}

  async collect(options: CollectOptions): Promise<any> {
    this.logger.debug(`Collecting data for report type: ${options.type}`);

    const collectedData: any = {
      organization: await this.getOrganizationData(options.organizationId),
      period: this.formatPeriod(options.periodStart, options.periodEnd),
      summary: await this.getSummaryData(options),
    };

    // Collect data based on sections
    if (!options.sections || options.sections.length === 0) {
      // Collect all data if no specific sections
      collectedData.controls = await this.getControlsData(options);
      collectedData.findings = await this.getFindingsData(options);
      collectedData.evidence = await this.getEvidenceData(options);
      collectedData.metrics = await this.getMetricsData(options);
    } else {
      // Collect only requested sections
      for (const section of options.sections) {
        switch (section) {
          case 'controls':
          case 'control_assessment':
          case 'control_testing':
            collectedData.controls = await this.getControlsData(options);
            break;
          case 'findings':
            collectedData.findings = await this.getFindingsData(options);
            break;
          case 'evidence':
            if (options.includeEvidence) {
              collectedData.evidence = await this.getEvidenceData(options);
            }
            break;
          case 'metrics':
            if (options.includeMetrics) {
              collectedData.metrics = await this.getMetricsData(options);
            }
            break;
        }
      }
    }

    return collectedData;
  }

  private async getOrganizationData(organizationId: string): Promise<OrganizationResponse | any> {
    try {
      const response: ServiceResponse<OrganizationResponse> =
        await this.serviceDiscovery.callService(
          'client-service',
          'GET',
          `/api/organizations/${organizationId}`
        );

      if (response.success && response.data) {
        return response.data;
      } else {
        this.logger.error('Failed to fetch organization data from client service', response.error);
        throw new Error(response.error?.message || 'Unknown error');
      }
    } catch (error) {
      this.logger.error('Failed to fetch organization data from client service', error);
      // Return minimal data as fallback
      return {
        id: organizationId,
        name: 'Organization',
        error: 'Failed to fetch organization details',
      };
    }
  }

  private async getSummaryData(options: CollectOptions): Promise<any> {
    try {
      // Fetch data from multiple services in parallel
      const [controlsResponse, auditResponse, policyResponse] = await Promise.allSettled([
        this.serviceDiscovery.callService(
          'control-service',
          'GET',
          '/api/controls/summary',
          undefined,
          {
            params: {
              organizationId: options.organizationId,
              startDate: options.periodStart?.toISOString(),
              endDate: options.periodEnd?.toISOString(),
            },
          }
        ) as Promise<ServiceResponse<ControlSummaryResponse>>,
        this.serviceDiscovery.callService(
          'audit-service',
          'GET',
          '/api/audits/findings/summary',
          undefined,
          {
            params: {
              organizationId: options.organizationId,
              startDate: options.periodStart?.toISOString(),
              endDate: options.periodEnd?.toISOString(),
            },
          }
        ) as Promise<ServiceResponse<AuditFindingsSummaryResponse>>,
        this.serviceDiscovery.callService(
          'policy-service',
          'GET',
          '/api/policies/compliance-score',
          undefined,
          {
            params: {
              organizationId: options.organizationId,
            },
          }
        ) as Promise<ServiceResponse<PolicyComplianceResponse>>,
      ]);

      // Process control data
      const controlData =
        controlsResponse.status === 'fulfilled' && controlsResponse.value.success
          ? controlsResponse.value.data
          : {
              totalControls: 0,
              effectiveControls: 0,
              failedControls: 0,
            };

      // Process audit findings
      const auditData =
        auditResponse.status === 'fulfilled' && auditResponse.value.success
          ? auditResponse.value.data
          : {
              criticalFindings: 0,
              highFindings: 0,
              mediumFindings: 0,
              lowFindings: 0,
              recommendations: [],
            };

      // Process compliance score
      const policyData =
        policyResponse.status === 'fulfilled' && policyResponse.value.success
          ? policyResponse.value.data
          : {
              overallScore: 0,
            };

      return {
        overallScore:
          policyData.overallScore || (controlData as ControlSummaryResponse).complianceScore || 0,
        totalControls: controlData.totalControls || 0,
        effectiveControls: controlData.effectiveControls || 0,
        failedControls: controlData.failedControls || 0,
        criticalFindings: auditData.criticalFindings || 0,
        highFindings: auditData.highFindings || 0,
        mediumFindings: auditData.mediumFindings || 0,
        lowFindings: auditData.lowFindings || 0,
        recommendations: auditData.recommendations || [],
      };
    } catch (error) {
      this.logger.error('Failed to fetch summary data', error);
      return {
        overallScore: 0,
        totalControls: 0,
        effectiveControls: 0,
        failedControls: 0,
        criticalFindings: 0,
        highFindings: 0,
        mediumFindings: 0,
        lowFindings: 0,
        recommendations: [],
        error: 'Failed to aggregate summary data',
      };
    }
  }

  private async getControlsData(options: CollectOptions): Promise<any[]> {
    try {
      const params: any = {
        organizationId: options.organizationId,
        limit: 1000, // Get all controls for report
      };

      // Add filters if provided
      if (options.filters?.controlStatus) {
        params.status = options.filters.controlStatus;
      }
      if (options.filters?.framework) {
        params.frameworkId = options.filters.framework;
      }
      if (options.periodStart) {
        params.startDate = options.periodStart.toISOString();
      }
      if (options.periodEnd) {
        params.endDate = options.periodEnd.toISOString();
      }

      const response: ServiceResponse<PaginatedControlsResponse> =
        await this.serviceDiscovery.callService(
          'control-service',
          'GET',
          '/api/controls',
          undefined,
          { params }
        );

      if (!response.success) {
        this.logger.error('Failed to fetch controls data from control service', response.error);
        return [];
      }

      const controls = response.data?.items || [];

      // Enrich controls with evidence count if needed
      if (options.includeEvidence) {
        const enrichedControls = await Promise.all(
          controls.map(async (control) => {
            try {
              const evidenceResponse: ServiceResponse<EvidenceCountResponse> =
                await this.serviceDiscovery.callService(
                  'evidence-service',
                  'GET',
                  '/api/evidence/count',
                  undefined,
                  {
                    params: {
                      controlId: control.id,
                      organizationId: options.organizationId,
                    },
                  }
                );
              return {
                ...control,
                evidenceCount: evidenceResponse.success ? evidenceResponse.data?.count || 0 : 0,
              };
            } catch {
              return {
                ...control,
                evidenceCount: 0,
              };
            }
          })
        );
        return enrichedControls;
      }

      return controls;
    } catch (error) {
      this.logger.error('Failed to fetch controls data from control service', error);
      return [];
    }
  }

  private async getFindingsData(options: CollectOptions): Promise<any[]> {
    try {
      const params: any = {
        organizationId: options.organizationId,
        limit: 1000, // Get all findings for report
      };

      // Add filters if provided
      if (options.filters?.severity) {
        params.severity = Array.isArray(options.filters.severity)
          ? options.filters.severity
          : [options.filters.severity];
      }
      if (options.filters?.excludeResolved) {
        params.status = ['open', 'in_progress', 'risk_accepted'];
      }
      if (options.periodStart) {
        params.startDate = options.periodStart.toISOString();
      }
      if (options.periodEnd) {
        params.endDate = options.periodEnd.toISOString();
      }

      const response: ServiceResponse<PaginatedFindingsResponse> =
        await this.serviceDiscovery.callService(
          'audit-service',
          'GET',
          '/api/audits/findings',
          undefined,
          { params }
        );

      if (!response.success) {
        this.logger.error('Failed to fetch findings data from audit service', response.error);
        return [];
      }

      const findings = response.data?.items || [];

      // Enrich findings with control details if available
      if (findings.length > 0 && options.includeFindings) {
        const controlIds = [...new Set(findings.map((f) => f.controlId).filter(Boolean))];

        if (controlIds.length > 0) {
          try {
            const controlsResponse: ServiceResponse<PaginatedControlsResponse> =
              await this.serviceDiscovery.callService(
                'control-service',
                'GET',
                '/api/controls/bulk',
                undefined,
                {
                  params: {
                    ids: controlIds,
                    organizationId: options.organizationId,
                  },
                }
              );

            const controlsMap = new Map(
              (controlsResponse.success ? controlsResponse.data?.items || [] : []).map((c) => [
                c.id,
                c,
              ])
            );

            return findings.map((finding) => ({
              ...finding,
              control: controlsMap.get(finding.controlId) || null,
            }));
          } catch (error) {
            this.logger.warn('Failed to enrich findings with control data', error);
          }
        }
      }

      return findings;
    } catch (error) {
      this.logger.error('Failed to fetch findings data from audit service', error);
      return [];
    }
  }

  private async getEvidenceData(options: CollectOptions): Promise<any[]> {
    if (!options.includeEvidence) {
      return [];
    }

    try {
      const params: any = {
        organizationId: options.organizationId,
        limit: 1000, // Get all evidence for report
      };

      // Add date filters if provided
      if (options.periodStart) {
        params.startDate = options.periodStart.toISOString();
      }
      if (options.periodEnd) {
        params.endDate = options.periodEnd.toISOString();
      }

      // Add control filter if specified
      if (options.filters?.controlId) {
        params.controlId = options.filters.controlId;
      }

      const response: ServiceResponse<PaginatedEvidenceResponse> =
        await this.serviceDiscovery.callService(
          'evidence-service',
          'GET',
          '/api/evidence',
          undefined,
          { params }
        );

      if (!response.success) {
        this.logger.error('Failed to fetch evidence data from evidence service', response.error);
        return [];
      }

      const evidence = response.data?.items || [];

      // Group evidence by control if needed
      if (options.filters?.groupByControl) {
        const groupedEvidence = evidence.reduce<Record<string, typeof evidence>>((acc, item) => {
          const controlId = item.controlId || 'uncategorized';
          if (!acc[controlId]) {
            acc[controlId] = [];
          }
          acc[controlId].push(item);
          return acc;
        }, {});

        return Object.entries(groupedEvidence).map(([controlId, items]) => ({
          controlId,
          evidenceCount: items.length,
          evidence: items,
        }));
      }

      return evidence;
    } catch (error) {
      this.logger.error('Failed to fetch evidence data from evidence service', error);
      return [];
    }
  }

  private async getMetricsData(options: CollectOptions): Promise<any[]> {
    if (!options.includeMetrics) {
      return [];
    }

    try {
      // Fetch metrics from multiple services in parallel
      const metricsPromises = [
        // Control metrics
        this.serviceDiscovery
          .callService('control-service', 'GET', '/api/controls/metrics', undefined, {
            params: {
              organizationId: options.organizationId,
              startDate: options.periodStart?.toISOString(),
              endDate: options.periodEnd?.toISOString(),
            },
          })
          .catch((err) => {
            this.logger.warn('Failed to fetch control metrics', err);
            return {
              success: false,
              data: { metrics: [] },
            } as ServiceResponse<ControlMetricsResponse>;
          }) as Promise<ServiceResponse<ControlMetricsResponse>>,

        // Policy metrics
        this.serviceDiscovery
          .callService('policy-service', 'GET', '/api/policies/metrics', undefined, {
            params: {
              organizationId: options.organizationId,
              startDate: options.periodStart?.toISOString(),
              endDate: options.periodEnd?.toISOString(),
            },
          })
          .catch((err) => {
            this.logger.warn('Failed to fetch policy metrics', err);
            return {
              success: false,
              data: { metrics: [] },
            } as ServiceResponse<PolicyMetricsResponse>;
          }) as Promise<ServiceResponse<PolicyMetricsResponse>>,

        // Audit metrics
        this.serviceDiscovery
          .callService('audit-service', 'GET', '/api/audits/metrics', undefined, {
            params: {
              organizationId: options.organizationId,
              startDate: options.periodStart?.toISOString(),
              endDate: options.periodEnd?.toISOString(),
            },
          })
          .catch((err) => {
            this.logger.warn('Failed to fetch audit metrics', err);
            return {
              success: false,
              data: { metrics: [] },
            } as ServiceResponse<AuditMetricsResponse>;
          }) as Promise<ServiceResponse<AuditMetricsResponse>>,

        // Evidence metrics
        this.serviceDiscovery
          .callService('evidence-service', 'GET', '/api/evidence/metrics', undefined, {
            params: {
              organizationId: options.organizationId,
              startDate: options.periodStart?.toISOString(),
              endDate: options.periodEnd?.toISOString(),
            },
          })
          .catch((err) => {
            this.logger.warn('Failed to fetch evidence metrics', err);
            return {
              success: false,
              data: { metrics: [] },
            } as ServiceResponse<EvidenceMetricsResponse>;
          }) as Promise<ServiceResponse<EvidenceMetricsResponse>>,
      ];

      const responses = await Promise.all(metricsPromises);

      // Combine all metrics and normalize category types
      const allMetrics = responses.flatMap((response) =>
        response.success
          ? (response.data?.metrics || []).map((metric) => ({
              ...metric,
              category: this.normalizeMetricCategory(metric.category),
            }))
          : []
      );

      // Calculate derived metrics
      const derivedMetrics = this.calculateDerivedMetrics(allMetrics);

      return [...allMetrics, ...derivedMetrics];
    } catch (error) {
      this.logger.error('Failed to fetch metrics data', error);
      return [];
    }
  }

  private calculateDerivedMetrics(metrics: any[]): any[] {
    const derived: any[] = [];

    // Calculate overall compliance score if we have control metrics
    const controlsImplemented = metrics.find((m) => m.name === 'Controls Implemented')?.value || 0;
    const totalControls = metrics.find((m) => m.name === 'Total Controls')?.value || 0;

    if (totalControls > 0) {
      derived.push({
        name: 'Overall Compliance Score',
        value: Math.round((controlsImplemented / totalControls) * 100 * 100) / 100,
        unit: '%',
        category: 'calculated',
      });
    }

    // Calculate evidence coverage
    const controlsWithEvidence =
      metrics.find((m) => m.name === 'Controls with Evidence')?.value || 0;

    if (totalControls > 0) {
      derived.push({
        name: 'Evidence Coverage',
        value: Math.round((controlsWithEvidence / totalControls) * 100 * 100) / 100,
        unit: '%',
        category: 'calculated',
      });
    }

    return derived;
  }

  private formatPeriod(startDate?: Date, endDate?: Date): string {
    if (!startDate || !endDate) {
      return new Date().getFullYear().toString();
    }

    const start = startDate.toLocaleDateString();
    const end = endDate.toLocaleDateString();
    return `${start} - ${end}`;
  }

  private normalizeMetricCategory(
    category: string
  ): 'implementation' | 'effectiveness' | 'compliance' | 'coverage' {
    // Map various metric categories to the standard set
    switch (category.toLowerCase()) {
      case 'implementation':
        return 'implementation';
      case 'effectiveness':
        return 'effectiveness';
      case 'compliance':
        return 'compliance';
      case 'coverage':
        return 'coverage';
      case 'approval':
      case 'maintenance':
      case 'findings':
      case 'resolution':
      case 'effort':
      case 'collection':
      case 'verification':
      case 'quality':
        return 'compliance'; // Map these to compliance as a fallback
      default:
        return 'compliance';
    }
  }
}
