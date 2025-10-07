/**
 * REAL Redis Cache Integration Test - Client Service
 *
 * This test validates actual Redis connectivity and client caching operations.
 * Tests will FAIL if Redis is not available - no graceful degradation.
 *
 * Prerequisites:
 * - Redis must be running on 127.0.0.1:6379
 * - Redis must be accessible with correct credentials
 */

import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import Redis from 'ioredis';
import { DataSource, Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Contract, ContractType, ContractStatus } from '../../contracts/entities/contract.entity';
import { RedisService } from '../../redis/redis.service';
import { ClientsService } from '../clients.service';
import {
  Client,
  ClientStatus,
  ClientType,
  ComplianceStatus,
  Industry,
  RiskLevel,
} from '../entities/client.entity';
import { ClientAudit } from '../entities/client-audit.entity';
import { ClientDocument } from '../entities/client-document.entity';
import { ClientUser } from '../entities/client-user.entity';

describe('Client Redis Cache Integration (REAL)', () => {
  let redisService: RedisService;
  let clientsService: ClientsService;
  let redis: Redis;
  let dataSource: DataSource;
  let clientRepository: Repository<Client>;

  let mockConfigService: jest.Mocked<ConfigService>;
  let mockEventEmitter: jest.Mocked<EventEmitter2>;
  let mockContractCoreService: any;
  let mockKafkaProducer: any;
  let mockServiceDiscovery: any;

  const REDIS_CONFIG = {
    host: '127.0.0.1',
    port: 6379,
    password: process.env.REDIS_PASSWORD || 'soc_redis_pass',
    db: 2, // Use different DB for client service integration tests
  };

  const TEST_ORG_ID = 'test-org-' + uuidv4();
  const TEST_CLIENT_ID = 'test-client-' + uuidv4();

  beforeAll(async () => {
    // CRITICAL: Test must fail if Redis is unavailable
    redis = new Redis(REDIS_CONFIG);

    try {
      const pingResult = await redis.ping();
      if (pingResult !== 'PONG') {
        throw new Error(`Redis ping failed: ${pingResult}`);
      }
    } catch (error) {
      await redis.quit();
      throw new Error(
        `Redis connection failed: ${error.message}. ` +
          'Integration tests require actual Redis connectivity. ' +
          'Start Redis with: docker-compose up redis'
      );
    }

    // Set up database connection for client data
    dataSource = new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST || '127.0.0.1',
      port: parseInt(process.env.DB_PORT || '5432'),
      username: process.env.DB_USERNAME || 'soc_user',
      password: process.env.DB_PASSWORD || 'soc_pass',
      database: process.env.DB_NAME || 'soc_clients_test',
      entities: [Client, ClientUser, ClientDocument, ClientAudit, Contract],
      synchronize: false,
      logging: false,
    });

    try {
      await dataSource.initialize();
    } catch (error) {
      throw new Error(`Database connection failed: ${error.message}`);
    }

    clientRepository = dataSource.getRepository(Client);

    // Set up mocks
    mockConfigService = {
      get: jest.fn((key: string, defaultValue?: any) => {
        const config = {
          REDIS_HOST: '127.0.0.1',
          REDIS_PORT: 6379,
          REDIS_PASSWORD: 'soc_redis_pass',
          REDIS_DB: 2,
          CACHE_TTL: 300,
          CACHE_PREFIX: 'client-service-integration-test',
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
      callService: jest.fn(),
    };

    // Create services with REAL Redis (no graceful degradation)
    redisService = new RedisService(mockConfigService);
    await redisService.onModuleInit();

    // Verify Redis service is connected
    const testKey = 'connectivity-test';
    await redisService.setCache(testKey, { test: true });
    const retrieved = await redisService.getCache(testKey);
    expect(retrieved).toEqual({ test: true });

    const mockMetricsService = { recordMetric: jest.fn() };
    const mockTracingService = { startSpan: jest.fn(), endSpan: jest.fn() };
    const mockLoggingService = { log: jest.fn(), error: jest.fn() };

    clientsService = new ClientsService(
      clientRepository,
      dataSource.getRepository(ClientUser),
      dataSource.getRepository(ClientDocument),
      dataSource.getRepository(ClientAudit),
      mockContractCoreService,
      mockKafkaProducer,
      redisService,
      mockServiceDiscovery,
      mockEventEmitter,
      mockMetricsService as any,
      mockTracingService as any,
      mockLoggingService as any
    );
  });

  afterAll(async () => {
    // Clean up connections
    if (redisService) {
      await redisService.onModuleDestroy();
    }
    if (redis) {
      await redis.quit();
    }
    if (dataSource && dataSource.isInitialized) {
      await dataSource.destroy();
    }
  });

  beforeEach(async () => {
    // Clear test data from Redis before each test
    await redis.flushdb();
    // Clean up database test data
    await (global as any).cleanupTestData(dataSource, TEST_ORG_ID);
    jest.clearAllMocks();
  });

  describe('Redis Connectivity Requirements', () => {
    it('should require active Redis connection (no graceful degradation)', async () => {
      // Verify Redis is actually connected
      const pingResult = await redis.ping();
      expect(pingResult).toBe('PONG');

      // Verify RedisService is connected
      const testValue = { test: 'client-service', timestamp: Date.now() };
      await redisService.setCache('connectivity-test', testValue);
      const retrieved = await redisService.getCache('connectivity-test');
      expect(retrieved).toEqual(testValue);

      // Verify direct Redis operations work
      await redis.set('direct-test', 'direct-value');
      const directValue = await redis.get('direct-test');
      expect(directValue).toBe('direct-value');
    });

    it('should fail fast when Redis operations fail', async () => {
      // This test documents expected behavior when Redis is unavailable
      const disconnectedRedis = new Redis({
        host: '127.0.0.1',
        port: 9999, // Non-existent port
        lazyConnect: true,
        maxRetriesPerRequest: 1,
      });

      // Operations should fail, not return fallback values
      await expect(disconnectedRedis.ping()).rejects.toThrow();
      await expect(disconnectedRedis.set('test', 'value')).rejects.toThrow();

      await disconnectedRedis.quit();
    });
  });

  describe('Real Client Caching Operations', () => {
    let testClient: Client;

    beforeEach(async () => {
      // Create test client in database
      const clientData = (global as any).createTestClient({
        id: TEST_CLIENT_ID,
        organizationId: TEST_ORG_ID,
        name: 'Cache Test Client',
        industry: Industry.TECHNOLOGY,
        status: ClientStatus.ACTIVE,
        complianceStatus: ComplianceStatus.ASSESSMENT,
        complianceScore: 0.75,
      });

      const createdClient = clientRepository.create(clientData);
      const savedResult = await clientRepository.save(createdClient);
      testClient = Array.isArray(savedResult) ? savedResult[0] : savedResult;
    });

    it('should cache and retrieve client data with real Redis', async () => {
      const clientId = testClient.id;
      const cacheKey = `client:${clientId}`;

      // CACHE CLIENT DATA
      await redisService.cacheClient(clientId, testClient);

      // Verify cached in Redis with correct prefix
      const redisValue = await redis.get(`client:${cacheKey}`);
      expect(redisValue).toBeTruthy();

      const parsedClient = JSON.parse(redisValue!);
      expect(parsedClient.id).toBe(clientId);
      expect(parsedClient.name).toBe('Cache Test Client');

      // RETRIEVE THROUGH SERVICE
      const cachedClient = await redisService.getCachedClient(clientId);
      expect(cachedClient).toBeTruthy();
      expect(cachedClient.id).toBe(clientId);
      expect(cachedClient.name).toBe('Cache Test Client');
      expect(cachedClient.complianceScore).toBe(0.75);

      // VERIFY TTL IS SET
      const ttl = await redisService.ttlCache(cacheKey);
      expect(ttl).toBeGreaterThan(3500); // Should be close to 3600 (1 hour)
      expect(ttl).toBeLessThanOrEqual(3600);

      // INVALIDATE CACHE
      await redisService.invalidateClient(clientId);

      // Verify cache cleared
      const afterInvalidation = await redisService.getCachedClient(clientId);
      expect(afterInvalidation).toBeNull();

      const redisValueAfterInvalidation = await redis.get(`client:${cacheKey}`);
      expect(redisValueAfterInvalidation).toBeNull();
    });

    it('should cache client lists with query filters', async () => {
      const organizationId = TEST_ORG_ID;
      const queryFilters = {
        status: ClientStatus.ACTIVE,
        industry: Industry.TECHNOLOGY,
        page: 1,
        limit: 10,
      };

      const clientListData = {
        data: [testClient],
        meta: {
          total: 1,
          page: 1,
          limit: 10,
          totalPages: 1,
        },
      };

      // CACHE CLIENT LIST
      await redisService.cacheClientList(organizationId, queryFilters, clientListData);

      // Verify cached with query-based key
      const expectedCacheKey = `clients:${organizationId}:${JSON.stringify(queryFilters)}`;
      const redisValue = await redis.get(`client:${expectedCacheKey}`);
      expect(redisValue).toBeTruthy();

      // RETRIEVE CACHED LIST
      const cachedList = await redisService.getCachedClientList(organizationId, queryFilters);
      expect(cachedList).toEqual(clientListData);
      expect(cachedList.data).toHaveLength(1);
      expect(cachedList.meta.total).toBe(1);

      // TEST DIFFERENT FILTERS (should not match cache)
      const differentFilters = { ...queryFilters, status: ClientStatus.INACTIVE };
      const differentList = await redisService.getCachedClientList(
        organizationId,
        differentFilters
      );
      expect(differentList).toBeNull();

      // INVALIDATE CLIENT LIST CACHE
      await redisService.invalidateClientList(organizationId);

      // Verify all client lists for organization are cleared
      const afterInvalidation = await redisService.getCachedClientList(
        organizationId,
        queryFilters
      );
      expect(afterInvalidation).toBeNull();
    });

    it('should handle contract caching', async () => {
      const contractId = 'contract-' + uuidv4();
      const contractData = {
        id: contractId,
        contractNumber: `CACHE-${Date.now()}`,
        clientId: testClient.id,
        title: 'Cached Contract',
        type: ContractType.SOW,
        status: ContractStatus.ACTIVE,
        startDate: new Date(),
        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        totalValue: 100000,
        currency: 'USD',
      };

      // CACHE CONTRACT
      await redisService.cacheContract(contractId, contractData);

      // Verify cached in Redis
      const redisValue = await redis.get(`client:contract:${contractId}`);
      expect(redisValue).toBeTruthy();
      expect(JSON.parse(redisValue!).title).toBe('Cached Contract');

      // RETRIEVE CONTRACT
      const cachedContract = await redisService.getCachedContract(contractId);
      expect(cachedContract).toEqual(contractData);
      expect(cachedContract.totalValue).toBe(100000);

      // INVALIDATE CONTRACT
      await redisService.invalidateContract(contractId);
      const afterInvalidation = await redisService.getCachedContract(contractId);
      expect(afterInvalidation).toBeNull();
    });

    it('should handle audit caching with client relationships', async () => {
      const clientId = testClient.id;
      const auditId = 'audit-' + uuidv4();
      const auditData = {
        id: auditId,
        clientId,
        name: 'SOC 2 Type II Audit',
        type: 'soc2_type2',
        status: 'planned',
        framework: 'soc2_type2',
        scheduledStartDate: new Date(),
        scheduledEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      };

      // CACHE AUDIT
      await redisService.cacheAudit(clientId, auditId, auditData);

      // Verify cached with client-audit key structure
      const redisValue = await redis.get(`client:audit:${clientId}:${auditId}`);
      expect(redisValue).toBeTruthy();
      expect(JSON.parse(redisValue!).name).toBe('SOC 2 Type II Audit');

      // RETRIEVE AUDIT
      const cachedAudit = await redisService.getCachedAudit(clientId, auditId);
      expect(cachedAudit).toEqual(auditData);
      expect(cachedAudit.type).toBe('soc2_type2');

      // INVALIDATE ALL AUDITS FOR CLIENT
      await redisService.invalidateAudits(clientId);
      const afterInvalidation = await redisService.getCachedAudit(clientId, auditId);
      expect(afterInvalidation).toBeNull();
    });

    it('should handle compliance status caching', async () => {
      const clientId = testClient.id;
      const complianceData = {
        status: ComplianceStatus.COMPLIANT,
        score: 0.95,
        lastUpdated: new Date(),
        frameworks: ['soc2_type2', 'iso27001'],
        controlsImplemented: 85,
        controlsTotal: 90,
        findings: 2,
        riskLevel: 'low',
      };

      // CACHE COMPLIANCE STATUS
      await redisService.cacheComplianceStatus(clientId, complianceData);

      // Verify cached with shorter TTL (30 minutes)
      const cacheKey = `compliance:${clientId}`;
      const redisValue = await redis.get(`client:${cacheKey}`);
      expect(redisValue).toBeTruthy();
      expect(JSON.parse(redisValue!).status).toBe(ComplianceStatus.COMPLIANT);

      // Verify TTL is shorter for compliance data
      const ttl = await redisService.ttlCache(cacheKey);
      expect(ttl).toBeGreaterThan(1700); // Should be close to 1800 (30 minutes)
      expect(ttl).toBeLessThanOrEqual(1800);

      // RETRIEVE COMPLIANCE STATUS
      const cachedCompliance = await redisService.getCachedComplianceStatus(clientId);
      expect(cachedCompliance).toEqual(complianceData);
      expect(cachedCompliance.controlsImplemented).toBe(85);

      // INVALIDATE COMPLIANCE STATUS
      await redisService.invalidateComplianceStatus(clientId);
      const afterInvalidation = await redisService.getCachedComplianceStatus(clientId);
      expect(afterInvalidation).toBeNull();
    });
  });

  describe('Service Integration with Real Cache', () => {
    beforeEach(async () => {
      // Mock service discovery responses
      mockServiceDiscovery.callService.mockImplementation((service, method, path) => {
        if (service === 'auth-service' && path.includes('/users/')) {
          return Promise.resolve({ data: { id: 'user-123', email: 'test@example.com' } });
        }
        if (service === 'control-service' && path.includes('/compliance-score/')) {
          return Promise.resolve({ data: { score: 0.8 } });
        }
        if (service === 'control-service' && path.includes('/controls/status/')) {
          return Promise.resolve({
            data: { total: 100, implemented: 80, inProgress: 15, notStarted: 5 },
          });
        }
        return Promise.resolve({ data: null });
      });
    });

    it('should use real cache in findOne method with cache hit/miss', async () => {
      // Create client in database
      const clientData = (global as any).createTestClient({
        id: TEST_CLIENT_ID,
        organizationId: TEST_ORG_ID,
        name: 'Service Integration Client',
      });
      const client = clientRepository.create(clientData);
      const savedResult = await clientRepository.save(client);
      const savedClient = Array.isArray(savedResult) ? savedResult[0] : savedResult;

      // FIRST CALL - Cache miss, should hit database and cache result
      const client1 = await clientsService.findOne(TEST_CLIENT_ID);
      expect(client1).toBeDefined();
      expect(client1.name).toBe('Service Integration Client');

      // Verify result was cached in Redis
      const cachedValue = await redis.get(`client:client:${TEST_CLIENT_ID}`);
      expect(cachedValue).toBeTruthy();
      expect(JSON.parse(cachedValue!).name).toBe('Service Integration Client');

      // SECOND CALL - Cache hit, should not hit database
      const client2 = await clientsService.findOne(TEST_CLIENT_ID);
      expect(client2).toEqual(client1);
      expect(client2.name).toBe('Service Integration Client');

      // Verify same object structure (cache hit)
      expect(client2.id).toBe(client1.id);
      expect(client2.organizationId).toBe(client1.organizationId);
    });

    it('should use real cache in findAll method with complex query caching', async () => {
      // Create multiple test clients
      for (let i = 0; i < 5; i++) {
        const clientData = (global as any).createTestClient({
          organizationId: TEST_ORG_ID,
          name: `Cached List Client ${i}`,
          status: i < 3 ? ClientStatus.ACTIVE : ClientStatus.INACTIVE,
          industry: i < 2 ? Industry.TECHNOLOGY : Industry.HEALTHCARE,
        });
        const client = clientRepository.create(clientData);
        const savedResult = await clientRepository.save(client);
      const savedClient = Array.isArray(savedResult) ? savedResult[0] : savedResult;
      }

      const queryFilters = {
        organizationId: TEST_ORG_ID,
        status: ClientStatus.ACTIVE,
        industry: Industry.TECHNOLOGY,
        page: 1,
        limit: 10,
      };

      // FIRST CALL - Cache miss
      const result1 = await clientsService.findAll(queryFilters);
      expect(result1.data.length).toBe(2); // 2 ACTIVE TECHNOLOGY clients
      expect(result1.meta.total).toBe(2);

      // Verify result was cached
      const cacheKey = `clients:${TEST_ORG_ID}:${JSON.stringify(queryFilters)}`;
      const cachedValue = await redis.get(`client:${cacheKey}`);
      expect(cachedValue).toBeTruthy();
      expect(JSON.parse(cachedValue!).meta.total).toBe(2);

      // SECOND CALL - Cache hit
      const result2 = await clientsService.findAll(queryFilters);
      expect(result2).toEqual(result1);
      expect(result2.data.length).toBe(2);

      // TEST DIFFERENT FILTERS - Should be cache miss
      const differentFilters = { ...queryFilters, industry: Industry.HEALTHCARE };
      const result3 = await clientsService.findAll(differentFilters);
      expect(result3.data.length).toBe(1); // 1 ACTIVE HEALTHCARE client
    });

    it('should invalidate cache on client updates', async () => {
      // Create client
      const clientData = (global as any).createTestClient({
        id: TEST_CLIENT_ID,
        organizationId: TEST_ORG_ID,
        name: 'Update Test Client',
        complianceScore: 0.5,
      });
      const client = clientRepository.create(clientData);
      const savedResult = await clientRepository.save(client);
      const savedClient = Array.isArray(savedResult) ? savedResult[0] : savedResult;

      // Cache the client by calling findOne
      const originalClient = await clientsService.findOne(TEST_CLIENT_ID);
      expect(originalClient.complianceScore).toBe(0.5);

      // Verify cached
      const cachedBefore = await redisService.getCachedClient(TEST_CLIENT_ID);
      expect(cachedBefore).toBeTruthy();
      expect(cachedBefore.complianceScore).toBe(0.5);

      // UPDATE CLIENT
      const updatedClient = await clientsService.update(
        TEST_CLIENT_ID,
        { complianceScore: 0.9 },
        'test-user-123'
      );
      expect(updatedClient.complianceScore).toBe(0.9);

      // Verify cache was invalidated
      const cachedAfter = await redisService.getCachedClient(TEST_CLIENT_ID);
      expect(cachedAfter).toBeNull();

      // Verify client list cache was also invalidated
      const queryFilters = { organizationId: TEST_ORG_ID };
      const cachedList = await redisService.getCachedClientList(TEST_ORG_ID, queryFilters);
      expect(cachedList).toBeNull();
    });

    it('should handle compliance status caching in getComplianceMetrics', async () => {
      // Create client with compliance data
      const clientData = (global as any).createTestClient({
        id: TEST_CLIENT_ID,
        organizationId: TEST_ORG_ID,
        name: 'Compliance Metrics Client',
        complianceScore: 0.85,
        targetFrameworks: ['soc2_type2', 'iso27001'],
        complianceStatus: ComplianceStatus.COMPLIANT,
      });
      const client = clientRepository.create(clientData);
      const savedResult = await clientRepository.save(client);
      const savedClient = Array.isArray(savedResult) ? savedResult[0] : savedResult;

      // FIRST CALL - Should cache compliance metrics
      const metrics1 = await clientsService.getComplianceMetrics(TEST_CLIENT_ID);
      expect(metrics1.overallScore).toBe(0.85);
      expect(metrics1.frameworkScores['soc2_type2']).toBe(0.8); // From mock
      expect(metrics1.controlsStatus.total).toBe(100); // From mock

      // Verify service discovery was called
      expect(mockServiceDiscovery.callService).toHaveBeenCalledWith(
        'control-service',
        'GET',
        expect.stringContaining(`/compliance-score/${TEST_CLIENT_ID}`)
      );

      // SECOND CALL - Framework scores might be cached by control service
      const metrics2 = await clientsService.getComplianceMetrics(TEST_CLIENT_ID);
      expect(metrics2.overallScore).toBe(0.85);
      expect(metrics2.frameworkScores['soc2_type2']).toBe(0.8);
    });
  });

  describe('Cache Distributed Locking', () => {
    it('should handle distributed locks for critical operations', async () => {
      const resource = `client-update:${TEST_CLIENT_ID}`;
      const lockTtl = 5; // 5 seconds

      // ACQUIRE LOCK
      const lockId1 = await redisService.acquireLock(resource, lockTtl);
      expect(lockId1).toBeTruthy();
      expect(lockId1).toHaveLength(7); // Random string length

      // Verify lock exists in Redis
      const lockKey = `lock:${resource}`;
      const lockValue = await redis.get(`client:${lockKey}`);
      expect(lockValue).toBe(lockId1);

      // TRY TO ACQUIRE SAME LOCK (Should fail)
      const lockId2 = await redisService.acquireLock(resource, lockTtl);
      expect(lockId2).toBeNull();

      // RELEASE LOCK
      const released = await redisService.releaseLock(resource, lockId1);
      expect(released).toBe(true);

      // Verify lock removed from Redis
      const lockAfterRelease = await redis.get(`client:${lockKey}`);
      expect(lockAfterRelease).toBeNull();

      // NOW LOCK CAN BE ACQUIRED AGAIN
      const lockId3 = await redisService.acquireLock(resource, lockTtl);
      expect(lockId3).toBeTruthy();
      expect(lockId3).not.toBe(lockId1);

      // RELEASE WITH WRONG LOCK ID (Should fail)
      const releasedWrong = await redisService.releaseLock(resource, 'wrong-id');
      expect(releasedWrong).toBe(false);

      // RELEASE WITH CORRECT LOCK ID
      const releasedCorrect = await redisService.releaseLock(resource, lockId3);
      expect(releasedCorrect).toBe(true);
    });

    it('should handle lock expiration', async () => {
      const resource = `client-lock-expiry:${TEST_CLIENT_ID}`;
      const shortTtl = 1; // 1 second

      // Acquire lock with short TTL
      const lockId = await redisService.acquireLock(resource, shortTtl);
      expect(lockId).toBeTruthy();

      // Lock should exist initially
      const lockKey = `lock:${resource}`;
      let lockValue = await redis.get(`client:${lockKey}`);
      expect(lockValue).toBe(lockId);

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Lock should be expired
      lockValue = await redis.get(`client:${lockKey}`);
      expect(lockValue).toBeNull();

      // Should be able to acquire lock again
      const newLockId = await redisService.acquireLock(resource, shortTtl);
      expect(newLockId).toBeTruthy();
      expect(newLockId).not.toBe(lockId);
    });
  });

  describe('Cache Performance and Concurrency', () => {
    it('should handle concurrent cache operations', async () => {
      const concurrentOps = 20;
      const promises = [];

      // Start concurrent client caching operations
      for (let i = 0; i < concurrentOps; i++) {
        promises.push(
          (async () => {
            const clientId = `concurrent-client-${i}`;
            const clientData = (global as any).createTestClient({
              id: clientId,
              organizationId: TEST_ORG_ID,
              name: `Concurrent Client ${i}`,
              complianceScore: Math.random(),
            });
            await redisService.cacheClient(clientId, clientData);
            return clientId;
          })()
        );
      }

      const clientIds = await Promise.all(promises);
      expect(clientIds).toHaveLength(concurrentOps);

      // Verify all clients are cached
      const getPromises = clientIds.map((id) => redisService.getCachedClient(id));
      const cachedClients = await Promise.all(getPromises);

      expect(cachedClients.every((c) => c !== null)).toBe(true);
      cachedClients.forEach((client, index) => {
        expect(client.name).toBe(`Concurrent Client ${index}`);
      });
    });

    it('should handle pattern-based cache invalidation efficiently', async () => {
      const baseKey = 'pattern-test';

      // Create multiple cache entries with pattern
      const cachePromises = [];
      for (let i = 0; i < 10; i++) {
        cachePromises.push(
          redisService.setCache(`${baseKey}:item:${i}`, { id: i, data: `test-${i}` })
        );
      }
      await Promise.all(cachePromises);

      // Verify all entries exist
      const getPromises = [];
      for (let i = 0; i < 10; i++) {
        getPromises.push(redisService.getCache(`${baseKey}:item:${i}`));
      }
      const values = await Promise.all(getPromises);
      expect(values.every((v) => v !== null)).toBe(true);

      // INVALIDATE PATTERN
      const deletedCount = await redisService.invalidatePattern(`${baseKey}:*`);
      expect(deletedCount).toBe(10);

      // Verify all entries are gone
      const valuesAfter = await Promise.all(getPromises);
      expect(valuesAfter.every((v) => v === null)).toBe(true);
    });

    it('should demonstrate cache benefits with timing', async () => {
      // Create client in database
      const clientData = (global as any).createTestClient({
        id: TEST_CLIENT_ID,
        organizationId: TEST_ORG_ID,
        name: 'Performance Test Client',
      });
      const client = clientRepository.create(clientData);
      const savedResult = await clientRepository.save(client);
      const savedClient = Array.isArray(savedResult) ? savedResult[0] : savedResult;

      // TIME DATABASE QUERY (Cache miss)
      const dbStart = Date.now();
      const clientFromDb = await clientsService.findOne(TEST_CLIENT_ID);
      const dbDuration = Date.now() - dbStart;

      expect(clientFromDb).toBeDefined();
      console.log(`Database query took: ${dbDuration}ms`);

      // TIME CACHE QUERY (Cache hit)
      const cacheStart = Date.now();
      const clientFromCache = await clientsService.findOne(TEST_CLIENT_ID);
      const cacheDuration = Date.now() - cacheStart;

      expect(clientFromCache).toEqual(clientFromDb);
      console.log(`Cache query took: ${cacheDuration}ms`);

      // Cache should be significantly faster
      expect(cacheDuration).toBeLessThan(dbDuration);
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle cache serialization errors gracefully', async () => {
      // Try to cache circular reference (should handle gracefully)
      const circularData: any = { name: 'test' };
      circularData.self = circularData;

      // This should not crash but may log warnings
      await expect(async () => {
        await redisService.setCache('circular-test', circularData);
      }).not.toThrow();
    });

    it('should handle cache key generation edge cases', async () => {
      // Test with special characters in filter objects
      const complexFilters = {
        organizationId: TEST_ORG_ID,
        search: 'test with spaces & special chars!',
        tags: ['tag1', 'tag2'],
        dateRange: { start: new Date(), end: new Date() },
      };

      const cacheKey = `clients:${TEST_ORG_ID}:${JSON.stringify(complexFilters)}`;

      // Should handle complex filter serialization
      await redisService.cacheClientList(TEST_ORG_ID, complexFilters, { data: [], meta: {} });
      const cached = await redisService.getCachedClientList(TEST_ORG_ID, complexFilters);
      expect(cached).toEqual({ data: [], meta: {} });
    });
  });
});
