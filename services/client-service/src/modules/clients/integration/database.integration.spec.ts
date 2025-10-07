/**
 * REAL Database Integration Test - Client Service
 *
 * This test validates actual database connectivity and client/organization operations.
 * Tests will FAIL if database is not available - no mocks or fallbacks.
 *
 * Prerequisites:
 * - PostgreSQL must be running with test database
 * - Database migrations must be applied
 * - Connection credentials must be correct
 */

import { DataSource, Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { AuditTrail, AuditAction, AuditResourceType } from '../../audits/entities/audit-trail.entity';
import { Contract, ContractType, ContractStatus } from '../../contracts/entities/contract.entity';
import {
  Client,
  ClientStatus,
  ClientType,
  CompanySize,
  ComplianceFramework,
  ComplianceStatus,
  Industry,
  RiskLevel,
} from '../entities/client.entity';
import { ClientAudit } from '../entities/client-audit.entity';
import { ClientDocument, DocumentType } from '../entities/client-document.entity';
import { ClientUser, ClientUserRole, ClientUserStatus } from '../entities/client-user.entity';

describe('Client Database Integration (REAL)', () => {
  let dataSource: DataSource;
  let clientRepository: Repository<Client>;
  let contractRepository: Repository<Contract>;
  let clientUserRepository: Repository<ClientUser>;
  let clientDocumentRepository: Repository<ClientDocument>;
  let clientAuditRepository: Repository<ClientAudit>;
  let auditTrailRepository: Repository<AuditTrail>;

  const TEST_ORG_ID = 'test-org-' + uuidv4();
  const TEST_CLIENT_ID = 'test-client-' + uuidv4();

  beforeAll(async () => {
    // CRITICAL: Test must fail if database is unavailable
    dataSource = new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST || '127.0.0.1',
      port: parseInt(process.env.DB_PORT || '5432'),
      username: process.env.DB_USERNAME || 'soc_user',
      password: process.env.DB_PASSWORD || 'soc_pass',
      database: process.env.DB_NAME || 'soc_clients_test',
      entities: [Client, Contract, ClientUser, ClientDocument, ClientAudit, AuditTrail],
      synchronize: false, // Use actual migrations
      logging: false,
    });

    try {
      await dataSource.initialize();
    } catch (error) {
      throw new Error(
        `Database connection failed: ${error.message}. ` +
          'Integration tests require actual database connectivity. ' +
          'Start database with: docker-compose up postgres'
      );
    }

    // Get repositories
    clientRepository = dataSource.getRepository(Client);
    contractRepository = dataSource.getRepository(Contract);
    clientUserRepository = dataSource.getRepository(ClientUser);
    clientDocumentRepository = dataSource.getRepository(ClientDocument);
    clientAuditRepository = dataSource.getRepository(ClientAudit);
    auditTrailRepository = dataSource.getRepository(AuditTrail);

    // Verify database schema exists
    const tables = await dataSource.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
    );
    const tableNames = tables.map((t) => t.table_name);

    expect(tableNames).toContain('clients');
    expect(tableNames).toContain('contracts');
    expect(tableNames).toContain('client_users');
    expect(tableNames).toContain('client_documents');
    expect(tableNames).toContain('audit_trails');
  });

  afterAll(async () => {
    if (dataSource && dataSource.isInitialized) {
      await dataSource.destroy();
    }
  });

  beforeEach(async () => {
    // Clean up test data before each test
    await (global as any).cleanupTestData(dataSource, TEST_ORG_ID);
  });

  describe('Database Connectivity Requirements', () => {
    it('should require active database connection', async () => {
      // Verify database is actually connected
      expect(dataSource.isInitialized).toBe(true);

      // Test actual database query
      const result = await dataSource.query('SELECT 1 as test');
      expect(result[0].test).toBe(1);
    });

    it('should have all required tables and columns', async () => {
      // Verify clients table structure
      const clientColumns = await dataSource.query(`
        SELECT column_name, data_type, is_nullable 
        FROM information_schema.columns 
        WHERE table_name = 'clients' 
        ORDER BY column_name
      `);

      const columnNames = clientColumns.map((c) => c.column_name);
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('name');
      expect(columnNames).toContain('slug');
      expect(columnNames).toContain('organization_id');
      expect(columnNames).toContain('status');
      expect(columnNames).toContain('compliance_status');
      expect(columnNames).toContain('compliance_score');
      expect(columnNames).toContain('created_at');
    });

    it('should enforce database constraints', async () => {
      // Test unique slug constraint
      const client1 = clientRepository.create({
        name: 'Constraint Test Client',
        slug: 'constraint-test-client-unique',
        organizationId: TEST_ORG_ID,
        clientType: ClientType.DIRECT,
        status: ClientStatus.ACTIVE,
      });
      await clientRepository.save(client1);

      const client2 = clientRepository.create({
        name: 'Another Client',
        slug: 'constraint-test-client-unique', // Same slug
        organizationId: TEST_ORG_ID,
        clientType: ClientType.DIRECT,
        status: ClientStatus.ACTIVE,
      });

      await expect(clientRepository.save(client2)).rejects.toThrow();
    });
  });

  describe('Real Client CRUD Operations', () => {
    it('should create, read, update, and delete clients with complex data', async () => {
      // CREATE - Complex client with all fields
      const clientData = (global as any).createTestClient({
        id: TEST_CLIENT_ID,
        organizationId: TEST_ORG_ID,
        name: 'Integration Test Corporation',
        legalName: 'Integration Test Corporation LLC',
        clientType: ClientType.DIRECT,
        industry: Industry.TECHNOLOGY,
        size: CompanySize.MEDIUM,
        employeeCount: 250,
        annualRevenue: '10000000',
        status: ClientStatus.ACTIVE,
        complianceStatus: ComplianceStatus.ASSESSMENT,
        targetFrameworks: [ComplianceFramework.SOC2_TYPE2, ComplianceFramework.ISO27001],
        riskLevel: RiskLevel.MEDIUM,
        complianceScore: 0.65,
        contactInfo: {
          primaryContact: {
            name: 'Jane Smith',
            title: 'CISO',
            email: 'jane.smith@integrationtest.com',
            phone: '+1-555-123-4567',
          },
          technicalContact: {
            name: 'Bob Johnson',
            title: 'IT Director',
            email: 'bob.johnson@integrationtest.com',
            phone: '+1-555-123-4568',
          },
        },
        address: {
          headquarters: {
            street1: '1234 Corporate Blvd',
            street2: 'Suite 500',
            city: 'Tech City',
            state: 'CA',
            postalCode: '94107',
            country: 'US',
          },
          locations: [
            {
              name: 'West Coast Office',
              type: 'regional',
              address: {
                street1: '5678 Innovation Drive',
                city: 'Seattle',
                state: 'WA',
                postalCode: '98101',
                country: 'US',
              },
            },
          ],
        },
        billingInfo: {
          currency: 'USD',
          paymentTerms: 'Net 30',
          paymentMethod: 'ACH',
          taxId: '12-3456789',
          purchaseOrderRequired: true,
          invoicePrefix: 'ITC',
          creditLimit: 100000,
        },
        integrations: {
          aws: {
            accountId: '123456789012',
            regions: ['us-east-1', 'us-west-2'],
            lastSync: new Date(),
          },
          azure: {
            tenantId: 'test-tenant-id',
            subscriptions: ['sub-1', 'sub-2'],
            lastSync: new Date(),
          },
        },
        settings: {
          timezone: 'America/Los_Angeles',
          dateFormat: 'MM/DD/YYYY',
          currency: 'USD',
          language: 'en',
          notifications: {
            email: true,
            sms: false,
            slack: true,
          },
          security: {
            ipWhitelist: ['192.168.1.0/24', '10.0.0.0/8'],
            mfaRequired: true,
            sessionTimeout: 3600,
            passwordPolicy: {
              minLength: 12,
              requireUppercase: true,
              requireLowercase: true,
              requireNumbers: true,
              requireSpecialChars: true,
              expirationDays: 90,
            },
          },
          features: {
            apiAccess: true,
            customBranding: true,
            advancedReporting: true,
            automatedEvidence: true,
            continuousMonitoring: true,
          },
        },
        metadata: {
          source: 'integration-test',
          migrationDate: new Date(),
          customFields: {
            priority: 'high',
            segment: 'enterprise',
          },
        },
        tags: ['enterprise', 'technology', 'high-priority'],
        onboardingStartDate: new Date('2024-01-01'),
        firstAuditDate: new Date('2024-06-01'),
        nextAuditDate: new Date('2024-12-01'),
        auditHistory: [
          {
            date: new Date('2023-12-01'),
            type: 'initial',
            framework: ComplianceFramework.SOC2_TYPE2,
            auditor: 'BigFour Auditing LLC',
            result: 'qualified',
            certificateNumber: 'SOC2-2023-001',
          },
        ],
        createdBy: 'integration-test-user',
      });

      const client = clientRepository.create(clientData);
      const savedResult = await clientRepository.save(client);
      const savedClient = Array.isArray(savedResult) ? savedResult[0] : savedResult;

      expect(savedClient.id).toBeDefined();
      expect(savedClient.slug).toMatch(/^integration-test-corporation-\d+$/);
      expect(savedClient.createdAt).toBeDefined();

      // READ - Verify complex data persisted correctly
      const foundClient = await clientRepository.findOne({
        where: { id: savedClient.id },
      });

      expect(foundClient).toBeDefined();
      expect(foundClient!.name).toBe('Integration Test Corporation');
      expect(foundClient!.contactInfo.primaryContact.email).toBe('jane.smith@integrationtest.com');
      expect(foundClient!.address.headquarters.city).toBe('Tech City');
      expect(foundClient!.billingInfo.creditLimit).toBe(100000);
      expect(foundClient!.integrations.aws.accountId).toBe('123456789012');
      expect(foundClient!.settings.security.mfaRequired).toBe(true);
      expect(foundClient!.targetFrameworks).toContain(ComplianceFramework.SOC2_TYPE2);
      expect(foundClient!.tags).toContain('enterprise');
      expect(foundClient!.auditHistory[0].certificateNumber).toBe('SOC2-2023-001');

      // Test helper methods
      expect(foundClient!.isActive()).toBe(true);
      expect(foundClient!.isCompliant()).toBe(false);
      expect(foundClient!.needsAudit()).toBe(false); // nextAuditDate is in future
      expect(foundClient!.getDaysUntilAudit()).toBeGreaterThan(0);

      // UPDATE - Modify complex nested data
      foundClient!.complianceStatus = ComplianceStatus.COMPLIANT;
      foundClient!.complianceScore = 0.95;
      foundClient!.contactInfo.primaryContact.title = 'VP of Security';
      foundClient!.settings.features.continuousMonitoring = false;
      foundClient!.integrations.gcp = {
        projectIds: ['project-1', 'project-2'],
        lastSync: new Date(),
      };
      foundClient!.tags.push('compliant');
      foundClient!.updatedBy = 'integration-test-updater';

      const updatedClient = await clientRepository.save(foundClient!);

      expect(updatedClient.complianceStatus).toBe(ComplianceStatus.COMPLIANT);
      expect(updatedClient.complianceScore).toBe(0.95);
      expect(updatedClient.contactInfo.primaryContact.title).toBe('VP of Security');
      expect(updatedClient.settings.features.continuousMonitoring).toBe(false);
      expect(updatedClient.integrations.gcp.projectIds).toContain('project-1');
      expect(updatedClient.tags).toContain('compliant');
      expect(updatedClient.isCompliant()).toBe(true);

      // DELETE (Soft delete)
      updatedClient.isDeleted = true;
      updatedClient.deletedAt = new Date();
      updatedClient.deletedBy = 'integration-test-deleter';
      await clientRepository.save(updatedClient);

      // Verify soft delete
      const deletedClient = await clientRepository.findOne({
        where: { id: savedClient.id },
      });
      expect(deletedClient!.isDeleted).toBe(true);
      expect(deletedClient!.deletedAt).toBeDefined();

      // HARD DELETE
      await clientRepository.remove(deletedClient!);
      const hardDeletedClient = await clientRepository.findOne({
        where: { id: savedClient.id },
      });
      expect(hardDeletedClient).toBeNull();
    });

    it('should handle client relationships and hierarchies', async () => {
      // Create parent client
      const parentClient = clientRepository.create({
        name: 'Parent Corporation',
        slug: 'parent-corp-' + Date.now(),
        organizationId: TEST_ORG_ID,
        clientType: ClientType.DIRECT,
        industry: Industry.FINANCE,
        status: ClientStatus.ACTIVE,
      });
      const savedParent = await clientRepository.save(parentClient) as Client;

      // Create subsidiary client
      const subsidiaryClient = clientRepository.create({
        name: 'Subsidiary LLC',
        slug: 'subsidiary-llc-' + Date.now(),
        organizationId: TEST_ORG_ID,
        clientType: ClientType.DIRECT,
        industry: Industry.FINANCE,
        status: ClientStatus.ACTIVE,
        parentClientId: savedParent.id,
      });
      const savedSubsidiary = await clientRepository.save(subsidiaryClient) as Client;

      // Test relationship queries
      const parentWithSubsidiaries = await clientRepository.findOne({
        where: { id: savedParent.id },
        relations: ['subsidiaries'],
      });
      expect(parentWithSubsidiaries!.subsidiaries).toHaveLength(1);
      expect(parentWithSubsidiaries!.subsidiaries[0].name).toBe('Subsidiary LLC');

      const subsidiaryWithParent = await clientRepository.findOne({
        where: { id: savedSubsidiary.id },
        relations: ['parentClient'],
      });
      expect(subsidiaryWithParent!.parentClient).toBeDefined();
      expect(subsidiaryWithParent!.parentClient.name).toBe('Parent Corporation');
    });

    it('should handle client contracts and related entities', async () => {
      // Create client
      const client = clientRepository.create({
        name: 'Contract Test Client',
        slug: 'contract-test-' + Date.now(),
        organizationId: TEST_ORG_ID,
        clientType: ClientType.DIRECT,
        status: ClientStatus.ACTIVE,
      });
      const savedClient = await clientRepository.save(client) as Client;

      // Create contract
      const contract = contractRepository.create({
        contractNumber: `SOC2-${Date.now()}`,
        clientId: savedClient.id,
        title: 'SOC 2 Type II Audit Contract',
        type: ContractType.SOW,
        status: ContractStatus.ACTIVE,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
        totalValue: 75000,
        currency: 'USD',
        description: 'Annual SOC 2 Type II audit and quarterly reviews',
        terms: {
          customTerms: ['quarterly payments', 'audit report delivery', 'quarterly reviews'],
          liability: 'Limited to contract value',
          confidentiality: true,
        },
        metadata: {
          salesRep: 'John Sales',
          signedDate: new Date('2023-12-15'),
        },
      });
      const savedContract = await contractRepository.save(contract) as Contract;

      // Create client user
      const clientUser = clientUserRepository.create({
        email: 'user@contracttest.com',
        firstName: 'Contract',
        lastName: 'User',
        role: ClientUserRole.ADMIN,
        permissions: ['read', 'write', 'admin'],
        status: ClientUserStatus.ACTIVE,
        lastLoginAt: new Date(),
      });
      clientUser.clientId = savedClient.id;
      clientUser.userId = 'test-user-id';
      await clientUserRepository.save(clientUser);

      // Create client document
      const clientDocument = clientDocumentRepository.create({
        clientId: savedClient.id,
        name: 'Security Policy',
        type: DocumentType.POLICY,
        fileUrl: '/documents/security-policy.pdf',
        fileName: 'security-policy.pdf',
        fileSize: 1024000,
        mimeType: 'application/pdf',
        checksum: 'sha256:abcd1234...',
        version: '1.0',
        tags: ['security', 'policy', 'required'],
        metadata: {
          author: 'Security Team',
          approver: 'CISO',
        },
      });
      clientDocument.approvedBy = 'CISO';
      clientDocument.approvedDate = new Date();
      await clientDocumentRepository.save(clientDocument);

      // Verify relationships with joins
      const clientWithRelations = await clientRepository.findOne({
        where: { id: savedClient.id },
        relations: ['contracts', 'clientUsers', 'documents'],
      });

      expect(clientWithRelations!.contracts).toHaveLength(1);
      expect(clientWithRelations!.contracts[0].title).toBe('SOC 2 Type II Audit Contract');
      expect(clientWithRelations!.contracts[0].totalValue).toBe(75000);

      expect(clientWithRelations!.clientUsers).toHaveLength(1);
      expect(clientWithRelations!.clientUsers[0].email).toBe('user@contracttest.com');

      expect(clientWithRelations!.documents).toHaveLength(1);
      expect(clientWithRelations!.documents[0].name).toBe('Security Policy');
    });
  });

  describe('Complex Database Queries', () => {
    beforeEach(async () => {
      // Create test data for complex queries
      const clients = [];
      const frameworks = [
        ComplianceFramework.SOC2_TYPE2,
        ComplianceFramework.ISO27001,
        ComplianceFramework.HIPAA,
      ];
      const statuses = [ClientStatus.ACTIVE, ClientStatus.PENDING, ClientStatus.INACTIVE];
      const complianceStatuses = [
        ComplianceStatus.NOT_STARTED,
        ComplianceStatus.ASSESSMENT,
        ComplianceStatus.COMPLIANT,
      ];
      const industries = [Industry.TECHNOLOGY, Industry.HEALTHCARE, Industry.FINANCE];

      for (let i = 0; i < 15; i++) {
        const client = clientRepository.create({
          name: `Query Test Client ${i}`,
          slug: `query-test-client-${i}-${Date.now()}`,
          organizationId: TEST_ORG_ID,
          clientType: ClientType.DIRECT,
          industry: industries[i % industries.length],
          status: statuses[i % statuses.length],
          complianceStatus: complianceStatuses[i % complianceStatuses.length],
          targetFrameworks: [frameworks[i % frameworks.length]],
          complianceScore: Math.random(),
          riskLevel: i < 5 ? RiskLevel.LOW : i < 10 ? RiskLevel.MEDIUM : RiskLevel.HIGH,
          employeeCount: 50 + i * 100,
          annualRevenue: (1000000 + i * 500000).toString(),
          createdAt: new Date(Date.now() - i * 24 * 60 * 60 * 1000), // Spread over 15 days
        });
        clients.push(client);
      }

      await clientRepository.save(clients) as Client[];
    });

    it('should perform complex client analytics queries', async () => {
      // Test query similar to ClientsService.getClientStats
      const clientStats = await clientRepository
        .createQueryBuilder('client')
        .select('client.status', 'status')
        .addSelect('client.complianceStatus', 'complianceStatus')
        .addSelect('COUNT(*)', 'count')
        .addSelect('AVG(client.complianceScore)', 'avgScore')
        .where('client.organizationId = :organizationId', { organizationId: TEST_ORG_ID })
        .groupBy('client.status')
        .addGroupBy('client.complianceStatus')
        .getRawMany();

      expect(clientStats.length).toBeGreaterThan(0);

      clientStats.forEach((stat) => {
        expect(stat).toHaveProperty('status');
        expect(stat).toHaveProperty('complianceStatus');
        expect(stat).toHaveProperty('count');
        expect(stat).toHaveProperty('avgScore');
        expect(parseInt(stat.count)).toBeGreaterThan(0);
      });

      // Verify specific counts
      const activeClients = clientStats.filter((s) => s.status === 'active');
      expect(activeClients.length).toBeGreaterThan(0);
    });

    it('should handle compliance reporting queries', async () => {
      // Complex query for compliance dashboard
      const complianceReport = await clientRepository
        .createQueryBuilder('client')
        .select('client.industry', 'industry')
        .addSelect('client.riskLevel', 'riskLevel')
        .addSelect('COUNT(*)', 'totalClients')
        .addSelect(
          'COUNT(CASE WHEN client.complianceStatus = :compliant THEN 1 END)',
          'compliantClients'
        )
        .addSelect('AVG(client.complianceScore)', 'avgComplianceScore')
        .addSelect('AVG(client.employeeCount)', 'avgEmployeeCount')
        .where('client.organizationId = :organizationId', { organizationId: TEST_ORG_ID })
        .andWhere('client.status = :active', { active: ClientStatus.ACTIVE })
        .setParameter('compliant', ComplianceStatus.COMPLIANT)
        .groupBy('client.industry')
        .addGroupBy('client.riskLevel')
        .orderBy('AVG(client.complianceScore)', 'DESC')
        .getRawMany();

      expect(complianceReport.length).toBeGreaterThan(0);

      complianceReport.forEach((report) => {
        expect(report).toHaveProperty('industry');
        expect(report).toHaveProperty('riskLevel');
        expect(report).toHaveProperty('totalClients');
        expect(report).toHaveProperty('avgComplianceScore');
        expect(parseInt(report.totalClients)).toBeGreaterThan(0);
      });
    });

    it('should perform full-text search on client data', async () => {
      // Test PostgreSQL ILIKE search across multiple fields
      const searchTerm = 'Query Test Client 5';
      const results = await clientRepository
        .createQueryBuilder('client')
        .where('client.organizationId = :organizationId', { organizationId: TEST_ORG_ID })
        .andWhere(
          '(client.name ILIKE :search OR client.legalName ILIKE :search OR client.description ILIKE :search)',
          { search: `%${searchTerm}%` }
        )
        .getMany();

      expect(results.length).toBe(1);
      expect(results[0].name).toBe('Query Test Client 5');
    });

    it('should handle date range and revenue filtering', async () => {
      const startDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000); // 10 days ago
      const endDate = new Date();
      const minRevenue = 2000000;

      const queryStart = Date.now();
      const clients = await clientRepository
        .createQueryBuilder('client')
        .where('client.organizationId = :organizationId', { organizationId: TEST_ORG_ID })
        .andWhere('client.createdAt BETWEEN :startDate AND :endDate', {
          startDate,
          endDate,
        })
        .andWhere('CAST(client.annualRevenue AS BIGINT) >= :minRevenue', { minRevenue })
        .orderBy('client.createdAt', 'DESC')
        .getMany();
      const queryDuration = Date.now() - queryStart;

      expect(clients.length).toBeGreaterThan(0);
      expect(queryDuration).toBeLessThan(1000); // Should complete within 1 second

      // Verify all results meet criteria
      clients.forEach((client) => {
        expect(client.createdAt.getTime()).toBeGreaterThanOrEqual(startDate.getTime());
        expect(client.createdAt.getTime()).toBeLessThanOrEqual(endDate.getTime());
        expect(parseInt(client.annualRevenue)).toBeGreaterThanOrEqual(minRevenue);
      });
    });

    it('should handle pagination with large datasets', async () => {
      const page = 1;
      const limit = 5;
      const offset = (page - 1) * limit;

      const [items, total] = await clientRepository
        .createQueryBuilder('client')
        .where('client.organizationId = :organizationId', { organizationId: TEST_ORG_ID })
        .orderBy('client.createdAt', 'DESC')
        .skip(offset)
        .take(limit)
        .getManyAndCount();

      expect(items.length).toBe(limit);
      expect(total).toBe(15); // Total test clients created

      // Verify items are properly ordered
      for (let i = 1; i < items.length; i++) {
        expect(items[i - 1].createdAt.getTime()).toBeGreaterThanOrEqual(
          items[i].createdAt.getTime()
        );
      }
    });
  });

  describe('Database Constraints and Transactions', () => {
    it('should enforce referential integrity', async () => {
      // Create client
      const client = clientRepository.create({
        name: 'Referential Test Client',
        slug: 'referential-test-' + Date.now(),
        organizationId: TEST_ORG_ID,
        clientType: ClientType.DIRECT,
        status: ClientStatus.ACTIVE,
      });
      const savedClient = await clientRepository.save(client) as Client;

      // Create dependent records
      const contract = contractRepository.create({
        contractNumber: `TEST-${Date.now()}`,
        clientId: savedClient.id,
        title: 'Test Contract',
        type: ContractType.SOW,
        status: ContractStatus.ACTIVE,
        startDate: new Date(),
        endDate: new Date(),
        totalValue: 50000,
        currency: 'USD',
      });
      await contractRepository.save(contract);

      // Verify dependent records exist
      const contractCount = await contractRepository.count({
        where: { clientId: savedClient.id },
      });
      expect(contractCount).toBe(1);

      // Try to delete client with dependent records
      // This should either cascade delete or throw an error depending on FK constraints
      try {
        await clientRepository.remove(savedClient);
        // If cascade delete is configured
        const remainingContracts = await contractRepository.count({
          where: { clientId: savedClient.id },
        });
        expect(remainingContracts).toBe(0);
      } catch (error) {
        // If FK constraint prevents deletion
        expect(error.message).toContain('foreign key');
      }
    });

    it('should handle database transactions', async () => {
      await dataSource.transaction(async (manager) => {
        // Create client
        const client = manager.create(Client, {
          name: 'Transaction Test Client',
          slug: 'transaction-test-' + Date.now(),
          organizationId: TEST_ORG_ID,
          clientType: ClientType.DIRECT,
          status: ClientStatus.ACTIVE,
        });
        const savedClient = await manager.save(client) as Client;

        // Create related contract
        const contract = manager.create(Contract, {
          contractNumber: `TXN-${Date.now()}`,
          clientId: savedClient.id,
          title: 'Transaction Test Contract',
          type: ContractType.SOW,
          status: ContractStatus.ACTIVE,
          startDate: new Date(),
          endDate: new Date(),
          totalValue: 25000,
          currency: 'USD',
        });
        await manager.save(contract);

        // Create audit trail entry
        const auditEntry = manager.create(AuditTrail, {
          organizationId: TEST_ORG_ID,
          resourceType: AuditResourceType.CLIENT,
          resourceId: savedClient.id,
          action: AuditAction.CREATE,
          userId: 'integration-test-user',
          userName: 'Integration Test',
          changes: {
            after: {
              name: savedClient.name,
              status: savedClient.status,
            }
          },
        });
        await manager.save(auditEntry);
      });

      // Verify all records were created atomically
      const clients = await clientRepository.find({
        where: { organizationId: TEST_ORG_ID },
      });
      const lastClient = clients[clients.length - 1];
      expect(lastClient.name).toBe('Transaction Test Client');

      const contracts = await contractRepository.find({
        where: { clientId: lastClient.id },
      });
      expect(contracts.length).toBe(1);

      const auditEntries = await auditTrailRepository.find({
        where: { resourceId: lastClient.id },
      });
      expect(auditEntries.length).toBe(1);
    });

    it('should handle concurrent client operations', async () => {
      const concurrentOps = 10;
      const promises = [];

      // Start concurrent client creation operations
      for (let i = 0; i < concurrentOps; i++) {
        promises.push(
          (async () => {
            const client = clientRepository.create({
              name: `Concurrent Client ${i}`,
              slug: `concurrent-client-${i}-${Date.now()}-${Math.random()}`,
              organizationId: TEST_ORG_ID,
              clientType: ClientType.DIRECT,
              status: ClientStatus.ACTIVE,
              complianceScore: Math.random(),
            });
            return clientRepository.save(client) as Promise<Client>;
          })()
        );
      }

      const results = await Promise.all(promises);
      expect(results.length).toBe(concurrentOps);

      // Verify all have unique IDs and slugs
      const ids = results.map((r) => r.id);
      const slugs = results.map((r) => r.slug);
      expect(new Set(ids).size).toBe(concurrentOps);
      expect(new Set(slugs).size).toBe(concurrentOps);
    });
  });

  describe('Performance and Indexing', () => {
    it('should perform efficiently with indexes', async () => {
      // Test query performance on indexed columns
      const queryStart = Date.now();
      await clientRepository.find({
        where: {
          organizationId: TEST_ORG_ID,
          status: ClientStatus.ACTIVE,
        },
        order: { createdAt: 'DESC' },
        take: 10,
      });
      const queryDuration = Date.now() - queryStart;

      // Should be fast with proper indexing
      expect(queryDuration).toBeLessThan(100);
    });

    it('should handle complex joins efficiently', async () => {
      const queryStart = Date.now();
      const results = await clientRepository
        .createQueryBuilder('client')
        .leftJoinAndSelect('client.contracts', 'contract')
        .leftJoinAndSelect('client.clientUsers', 'clientUser')
        .leftJoinAndSelect('client.documents', 'document')
        .where('client.organizationId = :organizationId', { organizationId: TEST_ORG_ID })
        .getMany();
      const queryDuration = Date.now() - queryStart;

      expect(queryDuration).toBeLessThan(500); // Should be reasonably fast
      expect(Array.isArray(results)).toBe(true);
    });
  });
});
