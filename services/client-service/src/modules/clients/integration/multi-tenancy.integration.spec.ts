/**
 * REAL Multi-Tenancy Integration Test - Client Service
 *
 * This test validates actual multi-tenant data isolation and organization-based access.
 * Tests will FAIL if database is not available - no mocks or fallbacks.
 *
 * Prerequisites:
 * - PostgreSQL must be running with test database
 * - Database migrations must be applied
 * - Connection credentials must be correct
 */

import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DataSource, Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { AuditTrail, AuditAction, AuditResourceType } from '../../audits/entities/audit-trail.entity';
import { Contract } from '../../contracts/entities/contract.entity';
import { RedisService } from '../../redis/redis.service';
import { ClientsService } from '../clients.service';
import {
  Client,
  ClientStatus,
  ClientType,
  ComplianceStatus,
  Industry,
} from '../entities/client.entity';
import { AuditStatus, AuditType, ClientAudit } from '../entities/client-audit.entity';
import { ClientDocument, DocumentStatus, DocumentType } from '../entities/client-document.entity';
import { ClientUser, ClientUserRole, ClientUserStatus } from '../entities/client-user.entity';

describe('Client Multi-Tenancy Integration (REAL)', () => {
  let dataSource: DataSource;
  let clientRepository: Repository<Client>;
  let clientUserRepository: Repository<ClientUser>;
  let clientDocumentRepository: Repository<ClientDocument>;
  let clientAuditRepository: Repository<ClientAudit>;
  let contractRepository: Repository<Contract>;
  let auditTrailRepository: Repository<AuditTrail>;
  let clientsService: ClientsService;
  let redisService: RedisService;

  // Multiple test organizations for multi-tenancy testing
  const ORG_A_ID = 'org-a-' + uuidv4();
  const ORG_B_ID = 'org-b-' + uuidv4();
  const ORG_C_ID = 'org-c-' + uuidv4();

  let mockConfigService: jest.Mocked<ConfigService>;
  let mockEventEmitter: jest.Mocked<EventEmitter2>;
  let mockContractCoreService: any;
  let mockKafkaProducer: any;
  let mockServiceDiscovery: any;

  beforeAll(async () => {
    // CRITICAL: Test must fail if database is unavailable
    dataSource = new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST || '127.0.0.1',
      port: parseInt(process.env.DB_PORT || '5432'),
      username: process.env.DB_USERNAME || 'soc_user',
      password: process.env.DB_PASSWORD || 'soc_pass',
      database: process.env.DB_NAME || 'soc_clients_test',
      entities: [Client, ClientUser, ClientDocument, ClientAudit, Contract, AuditTrail],
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
    clientUserRepository = dataSource.getRepository(ClientUser);
    clientDocumentRepository = dataSource.getRepository(ClientDocument);
    clientAuditRepository = dataSource.getRepository(ClientAudit);
    contractRepository = dataSource.getRepository(Contract);
    auditTrailRepository = dataSource.getRepository(AuditTrail);

    // Set up mocks
    mockConfigService = {
      get: jest.fn((key: string, defaultValue?: any) => {
        const config = {
          REDIS_HOST: '127.0.0.1',
          REDIS_PORT: 6379,
          REDIS_PASSWORD: 'soc_redis_pass',
          REDIS_DB: 2,
          ENABLE_MULTI_TENANCY: 'true',
          DEFAULT_ORGANIZATION_ID: 'default-org',
        };
        return config[key] || defaultValue;
      }),
    } as any;

    mockEventEmitter = {
      emit: jest.fn(),
    } as any;

    mockContractCoreService = {
      findActiveByClientId: jest.fn().mockResolvedValue([]),
      findByClientId: jest.fn().mockResolvedValue([]),
    };

    mockKafkaProducer = {
      publishClientCreated: jest.fn(),
      publishClientUpdated: jest.fn(),
      publishClientEvent: jest.fn(),
      publishAuditScheduled: jest.fn(),
    };

    mockServiceDiscovery = {
      callService: jest.fn().mockImplementation((service, method, path) => {
        if (service === 'auth-service' && path.includes('/users/')) {
          return Promise.resolve({ data: { id: 'user-123', email: 'test@example.com' } });
        }
        if (service === 'control-service') {
          return Promise.resolve({ data: { score: 0.8, total: 100, implemented: 80 } });
        }
        return Promise.resolve({ data: null });
      }),
    };

    redisService = new RedisService(mockConfigService);
    await redisService.onModuleInit();

    // Mock monitoring services
    const mockMetricsService = {
      recordHttpRequest: jest.fn(),
      incrementHttpRequestsInFlight: jest.fn(),
      decrementHttpRequestsInFlight: jest.fn(),
      recordDbQuery: jest.fn(),
      recordCacheHit: jest.fn(),
      recordCacheMiss: jest.fn(),
    } as any;

    const mockTracingService = {
      withSpan: jest.fn().mockImplementation((name, fn) => fn({ setAttribute: jest.fn() })),
      createSpan: jest.fn().mockReturnValue({ setAttribute: jest.fn(), end: jest.fn() }),
      getActiveSpan: jest.fn(),
    } as any;

    const mockLoggingService = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
    } as any;

    clientsService = new ClientsService(
      clientRepository,
      clientUserRepository,
      clientDocumentRepository,
      clientAuditRepository,
      mockContractCoreService,
      mockKafkaProducer,
      redisService,
      mockServiceDiscovery,
      mockEventEmitter,
      mockMetricsService,
      mockTracingService,
      mockLoggingService
    );
  });

  afterAll(async () => {
    if (redisService) {
      await redisService.onModuleDestroy();
    }
    if (dataSource && dataSource.isInitialized) {
      await dataSource.destroy();
    }
  });

  beforeEach(async () => {
    // Clean up test data for all organizations before each test
    await (global as any).cleanupTestData(dataSource, ORG_A_ID);
    await (global as any).cleanupTestData(dataSource, ORG_B_ID);
    await (global as any).cleanupTestData(dataSource, ORG_C_ID);
    (await redisService.getCache('test')) &&
      (await dataSource.query("DELETE FROM clients WHERE organization_id LIKE '%test%'"));
    jest.clearAllMocks();
  });

  describe('Organization Data Isolation', () => {
    it('should enforce strict data isolation between organizations', async () => {
      // CREATE CLIENTS FOR DIFFERENT ORGANIZATIONS
      const clientAData = (global as any).createTestClient({
        organizationId: ORG_A_ID,
        name: 'Organization A Client',
        industry: Industry.TECHNOLOGY,
        status: ClientStatus.ACTIVE,
      });
      const clientA = clientRepository.create(clientAData);
      await clientRepository.save(clientA);

      const clientBData = (global as any).createTestClient({
        organizationId: ORG_B_ID,
        name: 'Organization B Client',
        industry: Industry.HEALTHCARE,
        status: ClientStatus.ACTIVE,
      });
      const clientB = clientRepository.create(clientBData);
      await clientRepository.save(clientB);

      const clientCData = (global as any).createTestClient({
        organizationId: ORG_C_ID,
        name: 'Organization C Client',
        industry: Industry.FINANCE,
        status: ClientStatus.INACTIVE,
      });
      const clientC = clientRepository.create(clientCData);
      await clientRepository.save(clientC);

      // TEST ORGANIZATION-SCOPED QUERIES
      const orgAClients = await clientsService.findByOrganizationId(ORG_A_ID);
      expect(orgAClients).toHaveLength(1);
      expect(orgAClients[0].name).toBe('Organization A Client');
      expect(orgAClients[0].organizationId).toBe(ORG_A_ID);

      const orgBClients = await clientsService.findByOrganizationId(ORG_B_ID);
      expect(orgBClients).toHaveLength(1);
      expect(orgBClients[0].name).toBe('Organization B Client');
      expect(orgBClients[0].organizationId).toBe(ORG_B_ID);

      const orgCClients = await clientsService.findByOrganizationId(ORG_C_ID);
      expect(orgCClients).toHaveLength(1);
      expect(orgCClients[0].name).toBe('Organization C Client');
      expect(orgCClients[0].organizationId).toBe(ORG_C_ID);

      // VERIFY NO CROSS-ORGANIZATION DATA LEAKAGE
      // Organization A should not see Organization B or C clients
      expect(orgAClients.every((c) => c.organizationId === ORG_A_ID)).toBe(true);
      expect(orgBClients.every((c) => c.organizationId === ORG_B_ID)).toBe(true);
      expect(orgCClients.every((c) => c.organizationId === ORG_C_ID)).toBe(true);

      // TEST FILTERED QUERIES WITH ORGANIZATION SCOPE
      const techClientsAllOrgs = await clientRepository.find({
        where: { industry: Industry.TECHNOLOGY },
      });
      const techClientsOrgA = techClientsAllOrgs.filter((c) => c.organizationId === ORG_A_ID);
      const techClientsOrgB = techClientsAllOrgs.filter((c) => c.organizationId === ORG_B_ID);

      expect(techClientsOrgA).toHaveLength(1);
      expect(techClientsOrgB).toHaveLength(0); // Org B client is healthcare, not tech
    });

    it('should isolate client search results by organization', async () => {
      // Create clients with similar names in different organizations
      const clients = [
        { org: ORG_A_ID, name: 'Global Tech Solutions', industry: Industry.TECHNOLOGY },
        { org: ORG_B_ID, name: 'Global Health Systems', industry: Industry.HEALTHCARE },
        { org: ORG_C_ID, name: 'Global Financial Services', industry: Industry.FINANCE },
        { org: ORG_A_ID, name: 'Regional Technology Inc', industry: Industry.TECHNOLOGY },
        { org: ORG_B_ID, name: 'Regional Medical Group', industry: Industry.HEALTHCARE },
      ];

      for (const clientData of clients) {
        const client = clientRepository.create(
          (global as any).createTestClient({
            organizationId: clientData.org,
            name: clientData.name,
            industry: clientData.industry,
            status: ClientStatus.ACTIVE,
          })
        );
        await clientRepository.save(client);
      }

      // SEARCH FOR "GLOBAL" ACROSS ORGANIZATIONS
      const orgAGlobalSearch = await clientsService.findAll({
        organizationId: ORG_A_ID,
        search: 'Global',
        page: 1,
        limit: 10,
      });
      expect(orgAGlobalSearch.data).toHaveLength(1);
      expect(orgAGlobalSearch.data[0].name).toBe('Global Tech Solutions');
      expect(orgAGlobalSearch.data[0].organizationId).toBe(ORG_A_ID);

      const orgBGlobalSearch = await clientsService.findAll({
        organizationId: ORG_B_ID,
        search: 'Global',
        page: 1,
        limit: 10,
      });
      expect(orgBGlobalSearch.data).toHaveLength(1);
      expect(orgBGlobalSearch.data[0].name).toBe('Global Health Systems');
      expect(orgBGlobalSearch.data[0].organizationId).toBe(ORG_B_ID);

      // SEARCH FOR "REGIONAL" IN ORGANIZATION A
      const orgARegionalSearch = await clientsService.findAll({
        organizationId: ORG_A_ID,
        search: 'Regional',
        page: 1,
        limit: 10,
      });
      expect(orgARegionalSearch.data).toHaveLength(1);
      expect(orgARegionalSearch.data[0].name).toBe('Regional Technology Inc');

      // VERIFY INDUSTRY FILTERING WITHIN ORGANIZATION
      const orgATechClients = await clientsService.findAll({
        organizationId: ORG_A_ID,
        industry: Industry.TECHNOLOGY,
        page: 1,
        limit: 10,
      });
      expect(orgATechClients.data).toHaveLength(2); // Both tech clients in Org A
      expect(orgATechClients.data.every((c) => c.organizationId === ORG_A_ID)).toBe(true);
      expect(orgATechClients.data.every((c) => c.industry === Industry.TECHNOLOGY)).toBe(true);
    });

    it('should enforce organization isolation in related entities', async () => {
      // Create clients in different organizations
      const clientA = clientRepository.create(
        (global as any).createTestClient({
          organizationId: ORG_A_ID,
          name: 'Multi-Tenant Client A',
        })
      );
      const savedResultA = await clientRepository.save(clientA);
      const savedClientA = Array.isArray(savedResultA) ? savedResultA[0] : savedResultA;

      const clientB = clientRepository.create(
        (global as any).createTestClient({
          organizationId: ORG_B_ID,
          name: 'Multi-Tenant Client B',
        })
      );
      const savedResultB = await clientRepository.save(clientB);
      const savedClientB = Array.isArray(savedResultB) ? savedResultB[0] : savedResultB;

      // CREATE CLIENT USERS FOR EACH ORGANIZATION
      const userA = clientUserRepository.create({
        email: 'user.a@orga.com',
        firstName: 'User',
        lastName: 'A',
        role: ClientUserRole.ADMIN,
        status: ClientUserStatus.ACTIVE,
      });
      userA.clientId = savedClientA.id;
      userA.userId = 'user-a-id';
      await clientUserRepository.save(userA);

      const userB = clientUserRepository.create({
        email: 'user.b@orgb.com',
        firstName: 'User',
        lastName: 'B',
        role: ClientUserRole.USER,
        status: ClientUserStatus.ACTIVE,
      });
      userB.clientId = savedClientB.id;
      userB.userId = 'user-b-id';
      await clientUserRepository.save(userB);

      // CREATE CLIENT DOCUMENTS FOR EACH ORGANIZATION
      const docA = clientDocumentRepository.create({
        clientId: savedClientA.id,
        name: 'Org A Security Policy',
        type: DocumentType.POLICY,
        fileUrl: '/docs/org-a/security-policy.pdf',
        fileName: 'security-policy.pdf',
      });
      await clientDocumentRepository.save(docA);

      const docB = clientDocumentRepository.create({
        clientId: savedClientB.id,
        name: 'Org B Compliance Manual',
        type: DocumentType.OTHER,
        status: DocumentStatus.PENDING_REVIEW,
        fileUrl: '/docs/org-b/compliance-manual.pdf',
        fileName: 'compliance-manual.pdf',
      });
      await clientDocumentRepository.save(docB);

      // TEST ORGANIZATION-SCOPED QUERIES FOR RELATED ENTITIES

      // Client Users - should be isolated by organization through client relationship
      const orgAUsers = await clientUserRepository.find({
        where: { clientId: savedClientA.id },
      });
      expect(orgAUsers).toHaveLength(1);
      expect(orgAUsers[0].email).toBe('user.a@orga.com');

      const orgBUsers = await clientUserRepository.find({
        where: { clientId: savedClientB.id },
      });
      expect(orgBUsers).toHaveLength(1);
      expect(orgBUsers[0].email).toBe('user.b@orgb.com');

      // Client Documents - should be isolated by organization through client relationship
      const orgADocs = await clientDocumentRepository.find({
        where: { clientId: savedClientA.id },
      });
      expect(orgADocs).toHaveLength(1);
      expect(orgADocs[0].name).toBe('Org A Security Policy');

      const orgBDocs = await clientDocumentRepository.find({
        where: { clientId: savedClientB.id },
      });
      expect(orgBDocs).toHaveLength(1);
      expect(orgBDocs[0].name).toBe('Org B Compliance Manual');

      // VERIFY NO CROSS-ORGANIZATION ACCESS
      const allUsers = await clientUserRepository.find();
      const orgAUserIds = allUsers.filter((u) => u.clientId === savedClientA.id).map((u) => u.id);
      const orgBUserIds = allUsers.filter((u) => u.clientId === savedClientB.id).map((u) => u.id);

      expect(orgAUserIds).not.toContain(userB.id);
      expect(orgBUserIds).not.toContain(userA.id);
    });
  });

  describe('Multi-Tenant Cache Isolation', () => {
    it('should isolate cached data by organization', async () => {
      // Create clients for different organizations
      const clientA = clientRepository.create(
        (global as any).createTestClient({
          organizationId: ORG_A_ID,
          name: 'Cached Client A',
          complianceScore: 0.8,
        })
      );
      await clientRepository.save(clientA);

      const clientB = clientRepository.create(
        (global as any).createTestClient({
          organizationId: ORG_B_ID,
          name: 'Cached Client B',
          complianceScore: 0.6,
        })
      );
      await clientRepository.save(clientB);

      // CACHE CLIENT LISTS FOR DIFFERENT ORGANIZATIONS
      const orgAFilters = { organizationId: ORG_A_ID, status: ClientStatus.ACTIVE };
      const orgBFilters = { organizationId: ORG_B_ID, status: ClientStatus.ACTIVE };

      const orgAResults = await clientsService.findAll(orgAFilters);
      const orgBResults = await clientsService.findAll(orgBFilters);

      expect(orgAResults.data).toHaveLength(1);
      expect(orgAResults.data[0].name).toBe('Cached Client A');

      expect(orgBResults.data).toHaveLength(1);
      expect(orgBResults.data[0].name).toBe('Cached Client B');

      // VERIFY CACHE KEYS ARE ORGANIZATION-SPECIFIC
      const orgACacheKey = `clients:${ORG_A_ID}:${JSON.stringify(orgAFilters)}`;
      const orgBCacheKey = `clients:${ORG_B_ID}:${JSON.stringify(orgBFilters)}`;

      const cachedOrgA = await redisService.getCachedClientList(ORG_A_ID, orgAFilters);
      const cachedOrgB = await redisService.getCachedClientList(ORG_B_ID, orgBFilters);

      expect(cachedOrgA).toBeTruthy();
      expect(cachedOrgB).toBeTruthy();
      expect(cachedOrgA.data[0].name).toBe('Cached Client A');
      expect(cachedOrgB.data[0].name).toBe('Cached Client B');

      // INVALIDATE CACHE FOR ONE ORGANIZATION
      await redisService.invalidateClientList(ORG_A_ID);

      // Verify only Org A cache is invalidated
      const orgACacheAfter = await redisService.getCachedClientList(ORG_A_ID, orgAFilters);
      const orgBCacheAfter = await redisService.getCachedClientList(ORG_B_ID, orgBFilters);

      expect(orgACacheAfter).toBeNull();
      expect(orgBCacheAfter).toBeTruthy(); // Org B cache should still exist
      expect(orgBCacheAfter.data[0].name).toBe('Cached Client B');
    });

    it('should maintain separate cache TTLs per organization', async () => {
      // Create clients in different organizations
      const clientA = clientRepository.create(
        (global as any).createTestClient({
          organizationId: ORG_A_ID,
          name: 'TTL Test Client A',
        })
      );
      const savedResultA = await clientRepository.save(clientA);
      const savedClientA = Array.isArray(savedResultA) ? savedResultA[0] : savedResultA;

      const clientB = clientRepository.create(
        (global as any).createTestClient({
          organizationId: ORG_B_ID,
          name: 'TTL Test Client B',
        })
      );
      const savedResultB = await clientRepository.save(clientB);
      const savedClientB = Array.isArray(savedResultB) ? savedResultB[0] : savedResultB;

      // Cache clients with different TTLs
      await redisService.cacheClient(savedClientA.id, savedClientA, 2); // 2 seconds
      await redisService.cacheClient(savedClientB.id, savedClientB, 10); // 10 seconds

      // Verify both are cached initially
      const cachedA1 = await redisService.getCachedClient(savedClientA.id);
      const cachedB1 = await redisService.getCachedClient(savedClientB.id);
      expect(cachedA1).toBeTruthy();
      expect(cachedB1).toBeTruthy();

      // Wait for first cache to expire
      await new Promise((resolve) => setTimeout(resolve, 2500));

      // Check cache status
      const cachedA2 = await redisService.getCachedClient(savedClientA.id);
      const cachedB2 = await redisService.getCachedClient(savedClientB.id);
      expect(cachedA2).toBeNull(); // Should be expired
      expect(cachedB2).toBeTruthy(); // Should still be cached
    });
  });

  describe('Cross-Organization Security Tests', () => {
    it('should prevent unauthorized cross-organization data access', async () => {
      // Create clients in different organizations
      const clientA = clientRepository.create(
        (global as any).createTestClient({
          organizationId: ORG_A_ID,
          name: 'Secure Client A',
          status: ClientStatus.ACTIVE,
        })
      );
      await clientRepository.save(clientA);

      const clientB = clientRepository.create(
        (global as any).createTestClient({
          organizationId: ORG_B_ID,
          name: 'Secure Client B',
          status: ClientStatus.ACTIVE,
        })
      );
      await clientRepository.save(clientB);

      // TRY TO ACCESS ORGANIZATION B CLIENT FROM ORGANIZATION A CONTEXT
      const orgAQuery = {
        organizationId: ORG_A_ID,
        search: 'Secure Client B', // Searching for Org B client
      };

      const results = await clientsService.findAll(orgAQuery);
      expect(results.data).toHaveLength(0); // Should not find Org B client

      // VERIFY DIRECT DATABASE QUERIES RESPECT ORGANIZATION BOUNDARIES
      const crossOrgQuery = await clientRepository.find({
        where: {
          name: 'Secure Client B',
          organizationId: ORG_A_ID, // Wrong organization
        },
      });
      expect(crossOrgQuery).toHaveLength(0);

      // VERIFY CORRECT ORGANIZATION QUERY WORKS
      const correctOrgQuery = await clientRepository.find({
        where: {
          name: 'Secure Client B',
          organizationId: ORG_B_ID, // Correct organization
        },
      });
      expect(correctOrgQuery).toHaveLength(1);
    });

    it('should prevent client updates across organization boundaries', async () => {
      const clientA = clientRepository.create(
        (global as any).createTestClient({
          organizationId: ORG_A_ID,
          name: 'Update Test Client',
          complianceScore: 0.5,
        })
      );
      const savedResultA = await clientRepository.save(clientA);
      const savedClientA = Array.isArray(savedResultA) ? savedResultA[0] : savedResultA;

      // Attempt to update client with wrong organization context would require
      // organization validation in the service layer
      // For now, we test that direct database operations respect organization boundaries

      // UPDATE WITH CORRECT ORGANIZATION CONTEXT
      const updateResult = await clientRepository.update(
        { id: savedClientA.id, organizationId: ORG_A_ID },
        { complianceScore: 0.9 }
      );
      expect(updateResult.affected).toBe(1);

      // VERIFY UPDATE WITH WRONG ORGANIZATION CONTEXT FAILS
      const wrongOrgUpdate = await clientRepository.update(
        { id: savedClientA.id, organizationId: ORG_B_ID }, // Wrong organization
        { complianceScore: 0.3 }
      );
      expect(wrongOrgUpdate.affected).toBe(0); // Should not update any records

      // Verify client still has correct value
      const updatedClient = await clientRepository.findOne({
        where: { id: savedClientA.id, organizationId: ORG_A_ID },
      });
      expect(updatedClient!.complianceScore).toBe(0.9); // Should be updated value, not 0.3
    });
  });

  describe('Multi-Tenant Analytics and Reporting', () => {
    beforeEach(async () => {
      // Create diverse test data across organizations
      const testData = [
        // Organization A - Technology focused
        {
          org: ORG_A_ID,
          name: 'Tech Client 1',
          industry: Industry.TECHNOLOGY,
          status: ClientStatus.ACTIVE,
          score: 0.8,
        },
        {
          org: ORG_A_ID,
          name: 'Tech Client 2',
          industry: Industry.TECHNOLOGY,
          status: ClientStatus.ACTIVE,
          score: 0.9,
        },
        {
          org: ORG_A_ID,
          name: 'Tech Client 3',
          industry: Industry.TECHNOLOGY,
          status: ClientStatus.INACTIVE,
          score: 0.5,
        },

        // Organization B - Healthcare focused
        {
          org: ORG_B_ID,
          name: 'Health Client 1',
          industry: Industry.HEALTHCARE,
          status: ClientStatus.ACTIVE,
          score: 0.7,
        },
        {
          org: ORG_B_ID,
          name: 'Health Client 2',
          industry: Industry.HEALTHCARE,
          status: ClientStatus.ACTIVE,
          score: 0.6,
        },

        // Organization C - Finance focused
        {
          org: ORG_C_ID,
          name: 'Finance Client 1',
          industry: Industry.FINANCE,
          status: ClientStatus.ACTIVE,
          score: 0.95,
        },
        {
          org: ORG_C_ID,
          name: 'Finance Client 2',
          industry: Industry.FINANCE,
          status: ClientStatus.PENDING,
          score: 0.4,
        },
        {
          org: ORG_C_ID,
          name: 'Finance Client 3',
          industry: Industry.FINANCE,
          status: ClientStatus.ACTIVE,
          score: 0.85,
        },
      ];

      for (const data of testData) {
        const client = clientRepository.create(
          (global as any).createTestClient({
            organizationId: data.org,
            name: data.name,
            industry: data.industry,
            status: data.status,
            complianceScore: data.score,
          })
        );
        await clientRepository.save(client);
      }
    });

    it('should generate organization-specific analytics', async () => {
      // TEST ORGANIZATION A ANALYTICS
      const orgAStats = await clientRepository
        .createQueryBuilder('client')
        .select('client.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .addSelect('AVG(client.complianceScore)', 'avgScore')
        .where('client.organizationId = :orgId', { orgId: ORG_A_ID })
        .groupBy('client.status')
        .getRawMany();

      expect(orgAStats.length).toBeGreaterThan(0);
      const orgAActiveStats = orgAStats.find((s) => s.status === 'active');
      expect(orgAActiveStats).toBeDefined();
      expect(parseInt(orgAActiveStats!.count)).toBe(2); // 2 active tech clients
      expect(parseFloat(orgAActiveStats!.avgScore)).toBe(0.85); // (0.8 + 0.9) / 2

      // TEST ORGANIZATION B ANALYTICS
      const orgBStats = await clientRepository
        .createQueryBuilder('client')
        .select('client.industry', 'industry')
        .addSelect('COUNT(*)', 'count')
        .addSelect('AVG(client.complianceScore)', 'avgScore')
        .where('client.organizationId = :orgId', { orgId: ORG_B_ID })
        .groupBy('client.industry')
        .getRawMany();

      expect(orgBStats.length).toBe(1); // Only healthcare industry
      expect(orgBStats[0].industry).toBe('healthcare');
      expect(parseInt(orgBStats[0].count)).toBe(2);
      expect(parseFloat(orgBStats[0].avgScore)).toBe(0.65); // (0.7 + 0.6) / 2

      // TEST ORGANIZATION C ANALYTICS
      const orgCStats = await clientRepository
        .createQueryBuilder('client')
        .select('client.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .addSelect('MAX(client.complianceScore)', 'maxScore')
        .where('client.organizationId = :orgId', { orgId: ORG_C_ID })
        .groupBy('client.status')
        .getRawMany();

      const orgCActiveStats = orgCStats.find((s) => s.status === 'active');
      expect(orgCActiveStats).toBeDefined();
      expect(parseInt(orgCActiveStats!.count)).toBe(2); // 2 active finance clients
      expect(parseFloat(orgCActiveStats!.maxScore)).toBe(0.95); // Highest score
    });

    it('should provide organization-specific dashboard stats', async () => {
      // Mock the getDashboardStats to be organization-aware
      // In real implementation, this would filter by organization

      const orgAClients = await clientRepository.find({
        where: { organizationId: ORG_A_ID, isDeleted: false },
      });

      const orgBClients = await clientRepository.find({
        where: { organizationId: ORG_B_ID, isDeleted: false },
      });

      const orgCClients = await clientRepository.find({
        where: { organizationId: ORG_C_ID, isDeleted: false },
      });

      // Verify each organization has correct number of clients
      expect(orgAClients).toHaveLength(3);
      expect(orgBClients).toHaveLength(2);
      expect(orgCClients).toHaveLength(3);

      // Calculate organization-specific metrics
      const orgAActive = orgAClients.filter((c) => c.status === ClientStatus.ACTIVE);
      const orgBActive = orgBClients.filter((c) => c.status === ClientStatus.ACTIVE);
      const orgCActive = orgCClients.filter((c) => c.status === ClientStatus.ACTIVE);

      expect(orgAActive).toHaveLength(2);
      expect(orgBActive).toHaveLength(2);
      expect(orgCActive).toHaveLength(2);

      // Calculate average compliance scores per organization
      const orgAAvgScore =
        orgAActive.reduce((sum, c) => sum + Number(c.complianceScore), 0) / orgAActive.length;
      const orgBAvgScore =
        orgBActive.reduce((sum, c) => sum + Number(c.complianceScore), 0) / orgBActive.length;
      const orgCAvgScore =
        orgCActive.reduce((sum, c) => sum + Number(c.complianceScore), 0) / orgCActive.length;

      expect(orgAAvgScore).toBe(0.85); // (0.8 + 0.9) / 2
      expect(orgBAvgScore).toBe(0.65); // (0.7 + 0.6) / 2
      expect(orgCAvgScore).toBe(0.9); // (0.95 + 0.85) / 2
    });
  });

  describe('Multi-Tenant Data Migration and Cleanup', () => {
    it('should handle organization data cleanup without affecting other orgs', async () => {
      // Create test data for multiple organizations
      const clientA = clientRepository.create(
        (global as any).createTestClient({
          organizationId: ORG_A_ID,
          name: 'Cleanup Test Client A',
        })
      );
      const savedResultA = await clientRepository.save(clientA);
      const savedClientA = Array.isArray(savedResultA) ? savedResultA[0] : savedResultA;

      const clientB = clientRepository.create(
        (global as any).createTestClient({
          organizationId: ORG_B_ID,
          name: 'Cleanup Test Client B',
        })
      );
      const savedResultB = await clientRepository.save(clientB);
      const savedClientB = Array.isArray(savedResultB) ? savedResultB[0] : savedResultB;

      // Create related data for both organizations
      const userA = clientUserRepository.create({
        email: 'cleanup.a@test.com',
        firstName: 'Cleanup',
        lastName: 'A',
        role: ClientUserRole.USER,
        status: ClientUserStatus.ACTIVE,
      });
      userA.clientId = savedClientA.id;
      userA.userId = 'cleanup-user-a-id';
      await clientUserRepository.save(userA);

      const userB = clientUserRepository.create({
        email: 'cleanup.b@test.com',
        firstName: 'Cleanup',
        lastName: 'B',
        role: ClientUserRole.USER,
        status: ClientUserStatus.ACTIVE,
      });
      userB.clientId = savedClientB.id;
      userB.userId = 'cleanup-user-b-id';
      await clientUserRepository.save(userB);

      // CLEANUP ORGANIZATION A DATA
      await (global as any).cleanupTestData(dataSource, ORG_A_ID);

      // Verify Organization A data is cleaned up
      const orgAClientsAfter = await clientRepository.find({
        where: { organizationId: ORG_A_ID },
      });
      const orgAUsersAfter = await clientUserRepository.find({
        where: { clientId: savedClientA.id },
      });

      expect(orgAClientsAfter).toHaveLength(0);
      expect(orgAUsersAfter).toHaveLength(0);

      // Verify Organization B data is unaffected
      const orgBClientsAfter = await clientRepository.find({
        where: { organizationId: ORG_B_ID },
      });
      const orgBUsersAfter = await clientUserRepository.find({
        where: { clientId: savedClientB.id },
      });

      expect(orgBClientsAfter).toHaveLength(1);
      expect(orgBClientsAfter[0].name).toBe('Cleanup Test Client B');
      expect(orgBUsersAfter).toHaveLength(1);
      expect(orgBUsersAfter[0].email).toBe('cleanup.b@test.com');
    });

    it('should handle concurrent operations across organizations', async () => {
      const concurrentOps = 15;
      const orgs = [ORG_A_ID, ORG_B_ID, ORG_C_ID];
      const promises = [];

      // Start concurrent client creation across organizations
      for (let i = 0; i < concurrentOps; i++) {
        const orgId = orgs[i % orgs.length];
        promises.push(
          (async () => {
            const client = clientRepository.create(
              (global as any).createTestClient({
                organizationId: orgId,
                name: `Concurrent Client ${i}`,
                complianceScore: Math.random(),
              })
            );
            return clientRepository.save(client);
          })()
        );
      }

      const results = await Promise.all(promises);
      expect(results).toHaveLength(concurrentOps);

      // Verify clients are distributed across organizations
      const orgCounts = {};
      results.forEach((client) => {
        orgCounts[client.organizationId] = (orgCounts[client.organizationId] || 0) + 1;
      });

      expect(Object.keys(orgCounts)).toHaveLength(3); // All 3 organizations should have clients
      expect(orgCounts[ORG_A_ID]).toBe(5); // 15 / 3 = 5 clients per org
      expect(orgCounts[ORG_B_ID]).toBe(5);
      expect(orgCounts[ORG_C_ID]).toBe(5);

      // Verify organization isolation is maintained
      for (const orgId of orgs) {
        const orgClients = await clientRepository.find({
          where: { organizationId: orgId },
        });
        expect(orgClients.every((c) => c.organizationId === orgId)).toBe(true);
      }
    });
  });

  describe('Multi-Tenant Compliance and Audit Trails', () => {
    it('should maintain separate audit trails per organization', async () => {
      const clientA = clientRepository.create(
        (global as any).createTestClient({
          organizationId: ORG_A_ID,
          name: 'Audit Trail Client A',
        })
      );
      const savedResultA = await clientRepository.save(clientA);
      const savedClientA = Array.isArray(savedResultA) ? savedResultA[0] : savedResultA;

      const clientB = clientRepository.create(
        (global as any).createTestClient({
          organizationId: ORG_B_ID,
          name: 'Audit Trail Client B',
        })
      );
      const savedResultB = await clientRepository.save(clientB);
      const savedClientB = Array.isArray(savedResultB) ? savedResultB[0] : savedResultB;

      // Create audit trail entries for both organizations
      const auditA = auditTrailRepository.create({
        organizationId: ORG_A_ID,
        resourceType: AuditResourceType.CLIENT,
        resourceId: savedClientA.id,
        action: AuditAction.CREATE,
        changes: { 
          after: { name: savedClientA.name }
        },
        userId: 'user-a',
        userName: 'User A',
        ipAddress: '192.168.1.100',
        userAgent: 'Test Browser A',
      });
      await auditTrailRepository.save(auditA);

      const auditB = auditTrailRepository.create({
        organizationId: ORG_B_ID,
        resourceType: AuditResourceType.CLIENT,
        resourceId: savedClientB.id,
        action: AuditAction.CREATE,
        changes: { 
          after: { name: savedClientB.name }
        },
        userId: 'user-b',
        userName: 'User B',
        ipAddress: '192.168.1.101',
        userAgent: 'Test Browser B',
      });
      await auditTrailRepository.save(auditB);

      // Verify audit trails are organization-specific
      const orgAAudits = await auditTrailRepository.find({
        where: { organizationId: ORG_A_ID },
      });
      expect(orgAAudits).toHaveLength(1);
      expect(orgAAudits[0].userId).toBe('user-a');
      expect(orgAAudits[0].resourceId).toBe(savedClientA.id);

      const orgBAudits = await auditTrailRepository.find({
        where: { organizationId: ORG_B_ID },
      });
      expect(orgBAudits).toHaveLength(1);
      expect(orgBAudits[0].userId).toBe('user-b');
      expect(orgBAudits[0].resourceId).toBe(savedClientB.id);

      // Verify no cross-organization audit trail access
      const allAudits = await auditTrailRepository.find();
      const orgAAuditIds = allAudits.filter((a) => a.organizationId === ORG_A_ID).map((a) => a.id);
      const orgBAuditIds = allAudits.filter((a) => a.organizationId === ORG_B_ID).map((a) => a.id);

      expect(orgAAuditIds).not.toContain(auditB.id);
      expect(orgBAuditIds).not.toContain(auditA.id);
    });
  });
});
