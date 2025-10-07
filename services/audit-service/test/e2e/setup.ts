import type { INestApplication } from '@nestjs/common';
import { BaseE2ETestSetup, E2ETestConfig } from '../../../../test/e2e/shared/BaseE2ETestSetup';
import { AppModule } from '../../src/app.module';

export class AuditServiceE2ESetup extends BaseE2ETestSetup {
  constructor() {
    super({
      serviceName: 'audit-service',
      servicePort: 3008,
      databaseName: 'soc_audits_test',
      moduleImports: [AppModule.forRoot()],
    });
  }

  protected async applyServiceSpecificConfig(app: INestApplication): Promise<void> {
    // Add any audit-specific configuration here
    // For example, custom interceptors, filters, etc.
  }

  async seedTestData() {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    try {
      // Seed test audits
      await queryRunner.query(`
        INSERT INTO soc_audits (
          id, "auditNumber", "clientId", "organizationId", "auditType", status, "currentPhase", 
          "auditPeriodStart", "auditPeriodEnd", "leadAuditorId", "engagementPartnerId", 
          "cpaFirmId", "cpaFirmName", "auditObjectives", "scopeDescription", 
          "createdAt", "updatedAt", "createdBy", "updatedBy"
        )
        VALUES 
          (
            '11111111-1111-1111-1111-111111111111', 'AUDIT-2025-001', 'client-123', 'test-org-123', 
            'SOC2_TYPE2', 'IN_FIELDWORK', 'CONTROL_TESTING', '2025-01-01', '2025-03-31', 
            'auditor-123', 'partner-123', 'cpa-firm-123', 'Test CPA Firm', 
            'Verify SOC 2 compliance controls', 'Full scope SOC 2 Type II audit', 
            NOW(), NOW(), 'system-test', 'system-test'
          ),
          (
            '22222222-2222-2222-2222-222222222222', 'AUDIT-2024-015', 'client-456', 'test-org-123', 
            'SOC2_TYPE2', 'COMPLETED', 'ISSUANCE', '2024-10-01', '2024-10-15', 
            'auditor-456', 'partner-456', 'cpa-firm-123', 'Test CPA Firm', 
            'Annual compliance audit', 'ISO 27001 certification audit', 
            NOW() - INTERVAL '3 months', NOW(), 'system-test', 'system-test'
          ),
          (
            '33333333-3333-3333-3333-333333333333', 'AUDIT-2025-002', 'client-789', 'test-org-456', 
            'SOC1_TYPE1', 'PLANNING', 'KICKOFF', '2025-04-01', '2025-04-30', 
            'auditor-789', 'partner-789', 'cpa-firm-456', 'Another CPA Firm', 
            'Internal security controls review', 'Security controls assessment', 
            NOW(), NOW(), 'system-test', 'system-test'
          )
      `);

      // Seed test audit findings
      await queryRunner.query(`
        INSERT INTO audit_findings (
          id, "findingNumber", "auditId", "controlId", "controlCode", "controlName", 
          "findingType", severity, status, title, description, condition, criteria, cause, effect, recommendation,
          "createdAt", "updatedAt", "createdBy", "updatedBy"
        )
        VALUES 
          (
            '44444444-4444-4444-4444-444444444444', 'F-2025-001', '11111111-1111-1111-1111-111111111111', 
            'control-123', 'CC1.1', 'Control Environment', 'CONTROL_DEFICIENCY', 'HIGH', 'IDENTIFIED',
            'Missing MFA for Admin Users', 'Some admin accounts lack multi-factor authentication',
            'Admin users can access systems without MFA', 'All admin accounts must have MFA enabled',
            'Insufficient access control policies', 'Increased risk of unauthorized access',
            'Implement MFA for all administrative accounts',
            NOW(), NOW(), 'system-test', 'system-test'
          ),
          (
            '55555555-5555-5555-5555-555555555555', 'F-2025-002', '11111111-1111-1111-1111-111111111111', 
            'control-456', 'CC2.1', 'Communication and Information', 'DOCUMENTATION_GAP', 'MEDIUM', 'REMEDIATED',
            'Outdated Security Policy', 'Security policy document has not been updated recently',
            'Current policy is dated 2023', 'Policies must be reviewed annually',
            'Lack of regular policy review process', 'Outdated security requirements',
            'Establish annual policy review process',
            NOW(), NOW(), 'system-test', 'system-test'
          ),
          (
            '66666666-6666-6666-6666-666666666666', 'F-2024-015', '22222222-2222-2222-2222-222222222222', 
            'control-789', 'CC3.1', 'Risk Assessment', 'OPERATING_EFFECTIVENESS', 'LOW', 'CLOSED',
            'Incomplete Access Reviews', 'Quarterly access reviews were not completed on time',
            'Q3 2024 access review completed 2 weeks late', 'Access reviews must be completed quarterly',
            'Resource constraints in security team', 'Delayed identification of inappropriate access',
            'Establish dedicated resources for access reviews',
            NOW() - INTERVAL '3 months', NOW(), 'system-test', 'system-test'
          )
      `);

      // Seed test audit programs
      await queryRunner.query(`
        INSERT INTO audit_programs (
          id, "auditId", "programName", description, version, "isActive", 
          sections, milestones, "riskAssessment", "testingStrategy", timeline, resources,
          "createdAt", "updatedAt", "createdBy", "updatedBy"
        )
        VALUES 
          (
            '99999999-9999-9999-9999-999999999999', '11111111-1111-1111-1111-111111111111', 
            'SOC 2 Type II Audit Program', 'Comprehensive SOC 2 audit program', '1.0', true,
            '{}', '{}', '{"overall": "moderate"}', '{"approach": "risk-based"}', 
            '{"phases": ["planning", "fieldwork", "reporting"]}', '{"team": ["Lead auditor", "2 specialists"]}',
            NOW(), NOW(), 'system-test', 'system-test'
          ),
          (
            'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', 
            'Internal Security Audit Program', 'Internal security controls assessment', '1.0', true,
            '{}', '{}', '{"overall": "low"}', '{"approach": "control-based"}', 
            '{"duration": "4 weeks"}', '{"team": ["Internal audit team"]}',
            NOW(), NOW(), 'system-test', 'system-test'
          )
      `);
    } catch (error) {
      console.error('Error seeding audit test data:', error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
