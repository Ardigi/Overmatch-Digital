import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtAuthGuard } from '@soc-compliance/auth-common';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { BaseE2ETestSetup, E2ETestConfig } from '../../../../test/e2e/shared/BaseE2ETestSetup';
import { AppModule } from '../../src/app.module';

// Load test environment variables
dotenv.config({ path: path.join(__dirname, 'test.env') });

export class AIServiceE2ESetup extends BaseE2ETestSetup {
  constructor() {
    super({
      serviceName: 'ai-service',
      servicePort: 3011,
      databaseName: 'soc_ai_test', // Note: AI service uses MongoDB, but keeping for consistency
      moduleImports: [AppModule.forRoot()],
    });
  }

  protected async applyServiceSpecificConfig(app: INestApplication): Promise<void> {
    // Add any AI-specific configuration here
    // For example, custom interceptors, filters, etc.
  }

  // Method to create an app without guard overrides for authentication testing
  async createTestAppWithAuth(): Promise<INestApplication> {
    // Override environment variables for test
    process.env.NODE_ENV = 'test';
    process.env.DB_HOST = process.env.DB_HOST || 'localhost';
    process.env.DB_PORT = process.env.DB_PORT || '5433';
    process.env.DB_USERNAME = process.env.DB_USERNAME || 'test_user';
    process.env.DB_PASSWORD = process.env.DB_PASSWORD || 'test_pass';
    process.env.DB_NAME = this.config.databaseName;
    process.env.REDIS_HOST = process.env.REDIS_HOST || 'localhost';
    process.env.REDIS_PORT = process.env.REDIS_PORT || '6380';
    process.env.REDIS_PASSWORD = process.env.REDIS_PASSWORD || 'test_redis_pass';
    process.env.KAFKA_BROKERS = process.env.KAFKA_BROKERS || 'localhost:9093';

    // Create testing module WITHOUT guard overrides
    const moduleBuilder = Test.createTestingModule({
      imports: this.config.moduleImports,
    });

    // Do NOT override guards - let real authentication work
    this.moduleRef = await moduleBuilder.compile();

    // Create application
    this.app = this.moduleRef.createNestApplication();

    // Apply service-specific configuration
    await this.applyServiceSpecificConfig(this.app);

    // Initialize app
    await this.app.init();

    return this.app;
  }

  async seedTestData() {
    // Since AI service uses MongoDB and Elasticsearch, seeding is different
    // In a real implementation, you would:
    // 1. Connect to MongoDB
    // 2. Seed AI models and configurations
    // 3. Set up Elasticsearch indices
    // 4. Create test analysis results

    await this.seedAIModels();
    await this.seedAnalysisHistory();
    await this.seedTrainingData();
  }

  async seedAIModels() {
    // This would be implemented to seed AI model configurations in MongoDB
    const models = [
      {
        id: '11111111-1111-1111-1111-111111111111',
        name: 'Risk Scoring Model',
        type: 'risk_assessment',
        version: '1.0.0',
        status: 'active',
        accuracy: 0.92,
        config: {
          threshold: 0.75,
          features: ['control_count', 'evidence_age', 'finding_severity'],
        },
      },
      {
        id: '22222222-2222-2222-2222-222222222222',
        name: 'Control Effectiveness Predictor',
        type: 'control_prediction',
        version: '2.1.0',
        status: 'active',
        accuracy: 0.88,
        config: {
          minSamples: 10,
          confidenceThreshold: 0.8,
        },
      },
      {
        id: '33333333-3333-3333-3333-333333333333',
        name: 'Anomaly Detector',
        type: 'anomaly_detection',
        version: '1.5.0',
        status: 'training',
        accuracy: null,
        config: {
          algorithm: 'isolation_forest',
          contamination: 0.1,
        },
      },
    ];

    // In a real implementation, save these to MongoDB
  }

  async seedAnalysisHistory() {
    // This would be implemented to seed analysis results in MongoDB/Elasticsearch
    const analyses = [
      {
        id: '44444444-4444-4444-4444-444444444444',
        modelId: '11111111-1111-1111-1111-111111111111',
        type: 'risk_assessment',
        status: 'completed',
        input: {
          organizationId: 'test-org-123',
          controlIds: ['control-1', 'control-2', 'control-3'],
        },
        output: {
          riskScore: 0.72,
          riskLevel: 'medium',
          recommendations: ['Implement additional monitoring', 'Update access controls'],
        },
        executionTime: 1250,
        createdAt: new Date(),
      },
      {
        id: '55555555-5555-5555-5555-555555555555',
        modelId: '22222222-2222-2222-2222-222222222222',
        type: 'control_prediction',
        status: 'completed',
        input: {
          controlId: 'control-123',
          historicalData: [],
        },
        output: {
          predictedEffectiveness: 0.85,
          confidence: 0.9,
          factors: ['Strong evidence collection', 'Regular testing'],
        },
        executionTime: 800,
        createdAt: new Date(),
      },
    ];

    // In a real implementation, save these to MongoDB/Elasticsearch
  }

  async seedTrainingData() {
    // This would be implemented to seed training data for AI models
    const trainingData = [
      {
        id: '66666666-6666-6666-6666-666666666666',
        modelId: '33333333-3333-3333-3333-333333333333',
        datasetName: 'Q4 2024 Audit Logs',
        recordCount: 50000,
        features: ['timestamp', 'user_id', 'action', 'resource', 'result'],
        status: 'processed',
        createdAt: new Date(),
      },
    ];

    // In a real implementation, save these to appropriate storage
  }
}
