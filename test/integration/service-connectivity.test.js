const axios = require('axios');
const { Client } = require('pg');
const redis = require('redis');
const { Kafka } = require('kafkajs');
const fs = require('fs').promises;
const path = require('path');

/**
 * Comprehensive Service Connectivity Test Suite
 * Tests all service dependencies and connections
 */
class ServiceConnectivityTest {
  constructor() {
    this.results = {
      infrastructure: {},
      services: {},
      connections: {},
      errors: [],
      timestamp: new Date().toISOString(),
    };
  }

  async runAll() {
    console.log('🔍 Service Connectivity Test Suite\n');
    console.log('Testing all service dependencies and connections...\n');

    try {
      // Test infrastructure
      await this.testPostgreSQL();
      await this.testRedis();
      await this.testKafka();
      await this.testElasticsearch();
      await this.testMongoDB();

      // Test services
      await this.testAllServices();

      // Test inter-service communication
      await this.testServiceCommunication();

      // Generate report
      await this.generateReport();
    } catch (error) {
      console.error('❌ Critical test failure:', error.message);
      this.results.errors.push({
        test: 'main',
        error: error.message,
        stack: error.stack,
      });
    }
  }

  async testPostgreSQL() {
    console.log('📊 Testing PostgreSQL connections...');

    const databases = ['soc_auth', 'soc_clients', 'soc_policies', 'soc_controls'];

    for (const db of databases) {
      const client = new Client({
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        user: process.env.DB_USER || 'soc_user',
        password: process.env.DB_PASSWORD || 'soc_pass',
        database: db,
      });

      try {
        await client.connect();
        const result = await client.query('SELECT NOW()');

        this.results.infrastructure[`postgres_${db}`] = {
          status: 'connected',
          timestamp: result.rows[0].now,
          tables: await this.getTableCount(client),
        };

        console.log(`   ✅ ${db}: Connected`);
      } catch (error) {
        this.results.infrastructure[`postgres_${db}`] = {
          status: 'failed',
          error: error.message,
        };
        console.log(`   ❌ ${db}: ${error.message}`);
      } finally {
        await client.end();
      }
    }
  }

  async getTableCount(client) {
    try {
      const result = await client.query(`
        SELECT COUNT(*) 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
      `);
      return parseInt(result.rows[0].count);
    } catch {
      return 0;
    }
  }

  async testRedis() {
    console.log('\n💾 Testing Redis connection...');

    const client = redis.createClient({
      socket: {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
      },
      password: process.env.REDIS_PASSWORD || 'soc_redis_pass',
    });

    try {
      await client.connect();
      await client.ping();

      // Test basic operations
      await client.set('test:connectivity', 'ok', { EX: 60 });
      const value = await client.get('test:connectivity');

      this.results.infrastructure.redis = {
        status: 'connected',
        testValue: value,
        info: await client.info('server'),
      };

      console.log('   ✅ Redis: Connected and operational');
    } catch (error) {
      this.results.infrastructure.redis = {
        status: 'failed',
        error: error.message,
      };
      console.log(`   ❌ Redis: ${error.message}`);
    } finally {
      await client.quit();
    }
  }

  async testKafka() {
    console.log('\n📨 Testing Kafka connection...');

    const kafka = new Kafka({
      clientId: 'connectivity-test',
      brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
      connectionTimeout: 10000,
      retry: {
        retries: 3,
        initialRetryTime: 300,
      },
    });

    const admin = kafka.admin();

    try {
      await admin.connect();

      // List topics
      const topics = await admin.listTopics();

      // Get cluster info
      const cluster = await admin.describeCluster();

      this.results.infrastructure.kafka = {
        status: 'connected',
        brokers: cluster.brokers.length,
        controller: cluster.controller,
        topics: topics.length,
        topicList: topics,
      };

      console.log(
        `   ✅ Kafka: Connected (${cluster.brokers.length} brokers, ${topics.length} topics)`
      );
    } catch (error) {
      this.results.infrastructure.kafka = {
        status: 'failed',
        error: error.message,
        brokers: process.env.KAFKA_BROKERS || 'localhost:9092',
      };
      console.log(`   ❌ Kafka: ${error.message}`);
    } finally {
      await admin.disconnect();
    }
  }

  async testElasticsearch() {
    console.log('\n🔍 Testing Elasticsearch connection...');

    try {
      const response = await axios.get('http://localhost:9200/_cluster/health', {
        auth: {
          username: 'elastic',
          password: process.env.ELASTIC_PASSWORD || 'elastic_pass',
        },
        timeout: 5000,
      });

      this.results.infrastructure.elasticsearch = {
        status: 'connected',
        clusterName: response.data.cluster_name,
        clusterStatus: response.data.status,
        numberOfNodes: response.data.number_of_nodes,
      };

      console.log(
        `   ✅ Elasticsearch: ${response.data.status} (${response.data.number_of_nodes} nodes)`
      );
    } catch (error) {
      this.results.infrastructure.elasticsearch = {
        status: 'failed',
        error: error.message,
      };
      console.log(`   ❌ Elasticsearch: ${error.message}`);
    }
  }

  async testMongoDB() {
    console.log('\n🍃 Testing MongoDB connection...');

    try {
      // Simple HTTP check for MongoDB
      const response = await axios.get('http://localhost:27017', {
        timeout: 5000,
        validateStatus: () => true, // Accept any status
      });

      this.results.infrastructure.mongodb = {
        status: response.status === 200 ? 'connected' : 'accessible',
        statusCode: response.status,
      };

      console.log('   ✅ MongoDB: Accessible');
    } catch (error) {
      this.results.infrastructure.mongodb = {
        status: 'failed',
        error: error.message,
      };
      console.log(`   ❌ MongoDB: ${error.message}`);
    }
  }

  async testAllServices() {
    console.log('\n🚀 Testing microservices...');

    const services = [
      { name: 'auth-service', port: 3001, healthPath: '/health' },
      { name: 'client-service', port: 3002, healthPath: '/api/v1/health' },
      { name: 'policy-service', port: 3003, healthPath: '/health' },
      { name: 'control-service', port: 3004, healthPath: '/health' },
      { name: 'evidence-service', port: 3005, healthPath: '/health' },
      { name: 'workflow-service', port: 3006, healthPath: '/health' },
      { name: 'reporting-service', port: 3007, healthPath: '/health' },
      { name: 'audit-service', port: 3008, healthPath: '/health' },
      { name: 'integration-service', port: 3009, healthPath: '/health' },
      { name: 'notification-service', port: 3010, healthPath: '/health' },
      { name: 'ai-service', port: 3011, healthPath: '/health' },
    ];

    for (const service of services) {
      try {
        const response = await axios.get(`http://localhost:${service.port}${service.healthPath}`, {
          timeout: 5000,
        });

        this.results.services[service.name] = {
          status: 'healthy',
          port: service.port,
          healthData: response.data,
        };

        console.log(`   ✅ ${service.name}: Healthy`);
      } catch (error) {
        this.results.services[service.name] = {
          status: 'unhealthy',
          port: service.port,
          error: error.response?.data?.message || error.message,
          statusCode: error.response?.status,
        };

        console.log(`   ❌ ${service.name}: ${error.message}`);
      }
    }
  }

  async testServiceCommunication() {
    console.log('\n🔗 Testing inter-service communication...');

    // Test Kong Gateway
    try {
      const response = await axios.get('http://localhost:8001/services', {
        timeout: 5000,
      });

      this.results.connections.kong = {
        status: 'operational',
        services: response.data.data.length,
        serviceList: response.data.data.map((s) => s.name),
      };

      console.log(`   ✅ Kong Gateway: ${response.data.data.length} services configured`);
    } catch (error) {
      this.results.connections.kong = {
        status: 'failed',
        error: error.message,
      };
      console.log(`   ❌ Kong Gateway: ${error.message}`);
    }

    // Test service-to-service communication through Kong
    if (this.results.services['auth-service']?.status === 'healthy') {
      try {
        const response = await axios.get('http://localhost:8000/api/auth/health', {
          timeout: 5000,
        });

        this.results.connections.kongRouting = {
          status: 'working',
          authServiceViaKong: true,
        };

        console.log('   ✅ Kong routing: Working');
      } catch (error) {
        this.results.connections.kongRouting = {
          status: 'failed',
          error: error.message,
        };
        console.log(`   ❌ Kong routing: ${error.message}`);
      }
    }
  }

  async generateReport() {
    console.log('\n📋 Generating connectivity report...');

    // Calculate statistics
    const stats = {
      infrastructure: {
        total: Object.keys(this.results.infrastructure).length,
        connected: Object.values(this.results.infrastructure).filter(
          (i) => i.status === 'connected'
        ).length,
        failed: Object.values(this.results.infrastructure).filter((i) => i.status === 'failed')
          .length,
      },
      services: {
        total: Object.keys(this.results.services).length,
        healthy: Object.values(this.results.services).filter((s) => s.status === 'healthy').length,
        unhealthy: Object.values(this.results.services).filter((s) => s.status === 'unhealthy')
          .length,
      },
    };

    this.results.summary = {
      stats,
      healthScore: Math.round(
        ((stats.infrastructure.connected + stats.services.healthy) /
          (stats.infrastructure.total + stats.services.total)) *
          100
      ),
      criticalIssues: this.identifyCriticalIssues(),
    };

    // Save report
    const reportPath = path.join(__dirname, '..', '..', 'reports', 'connectivity-report.json');
    await fs.mkdir(path.dirname(reportPath), { recursive: true });
    await fs.writeFile(reportPath, JSON.stringify(this.results, null, 2));

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('CONNECTIVITY TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(
      `Infrastructure: ${stats.infrastructure.connected}/${stats.infrastructure.total} connected`
    );
    console.log(`Services: ${stats.services.healthy}/${stats.services.total} healthy`);
    console.log(`Overall Health Score: ${this.results.summary.healthScore}%`);

    if (this.results.summary.criticalIssues.length > 0) {
      console.log('\n⚠️  Critical Issues:');
      this.results.summary.criticalIssues.forEach((issue) => {
        console.log(`   - ${issue}`);
      });
    }

    console.log(`\nFull report saved to: ${reportPath}`);
  }

  identifyCriticalIssues() {
    const issues = [];

    // Check critical infrastructure
    if (this.results.infrastructure.postgres_soc_auth?.status === 'failed') {
      issues.push('Auth database is not accessible');
    }
    if (this.results.infrastructure.redis?.status === 'failed') {
      issues.push('Redis cache is not accessible');
    }
    if (this.results.infrastructure.kafka?.status === 'failed') {
      issues.push('Kafka message broker is not accessible');
    }

    // Check critical services
    if (this.results.services['auth-service']?.status === 'unhealthy') {
      issues.push('Authentication service is not healthy');
    }

    // Check Kong
    if (this.results.connections.kong?.status === 'failed') {
      issues.push('API Gateway (Kong) is not operational');
    }

    return issues;
  }
}

// Run the tests
const tester = new ServiceConnectivityTest();
tester.runAll().catch(console.error);
