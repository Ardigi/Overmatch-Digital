# AI Service

[![Tests](https://img.shields.io/badge/tests-206%20tests-brightgreen)](./src)
[![Coverage](https://img.shields.io/badge/coverage-enterprise--grade-blue)]()
[![TypeScript](https://img.shields.io/badge/typescript-100%25-blue)](./tsconfig.json)
[![Enterprise](https://img.shields.io/badge/enterprise-ready-success)](./docs)
[![Providers](https://img.shields.io/badge/providers-OpenAI%20%7C%20Claude-orange)](./src/config)

The AI Service is a comprehensive, enterprise-grade microservice built with NestJS that provides intelligent AI capabilities for the SOC Compliance Platform. It supports multiple AI providers including OpenAI and Claude/Anthropic, offering compliance analysis, risk prediction, control mapping, and intelligent automation.

## Table of Contents

- [Features](#features)
- [AI Providers](#ai-providers)
- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [API Documentation](#api-documentation)
- [AI Capabilities](#ai-capabilities)
- [Provider Switching](#provider-switching)
- [Testing](#testing)
- [Production Deployment](#production-deployment)
- [Contributing](#contributing)

## Features

### Core AI Capabilities
- **Compliance Analysis**: Intelligent SOC 1/SOC 2 compliance assessment and recommendations
- **Risk Prediction**: ML-powered risk assessment and trend analysis
- **Control Mapping**: Automated control framework mapping and gap analysis
- **Document Summarization**: AI-powered document analysis and key insight extraction
- **Anomaly Detection**: Behavioral pattern analysis and security anomaly detection
- **Natural Language Queries**: AI-powered natural language interface for compliance data
- **Intelligent Remediation**: Automated remediation plan generation and prioritization

### Multi-Provider Support
- **OpenAI Integration**: GPT-4, GPT-3.5 Turbo, and text-embedding models
- **Claude/Anthropic Integration**: Claude-3 Sonnet and Opus models
- **Provider Switching**: Dynamic switching between AI providers
- **Fallback Support**: Automatic fallback to mock responses for development
- **Cost Optimization**: Intelligent model selection based on task requirements

### Enterprise Features
- **Redis Caching**: High-performance caching for AI responses and embeddings
- **Rate Limiting**: Intelligent rate limiting and request queuing
- **Cost Management**: Token usage tracking and budget controls
- **Security**: Secure API key management and request sanitization
- **Observability**: Comprehensive monitoring and tracing for AI operations
- **Scalability**: Horizontal scaling with load balancing support

## AI Providers

### OpenAI Provider

**Supported Models**:
- **GPT-4 Turbo Preview**: Advanced reasoning for complex compliance analysis
- **GPT-3.5 Turbo**: Fast, cost-effective processing for routine tasks
- **Text-Embedding-3-Small**: High-quality embeddings for document similarity

**Key Features**:
- JSON mode for structured responses
- Function calling for complex workflows
- Vision capabilities for document analysis
- Advanced reasoning for complex compliance scenarios

**Best Use Cases**:
- Complex compliance analysis requiring detailed reasoning
- Large-scale document processing and summarization
- Advanced control mapping with cross-framework analysis
- Embedding generation for semantic search

### Claude/Anthropic Provider

**Supported Models**:
- **Claude-3 Sonnet**: Balanced performance for most compliance tasks
- **Claude-3 Opus**: Maximum capability for complex analysis

**Key Features**:
- Superior reasoning for compliance scenarios
- Large context windows (200K+ tokens)
- Strong safety and alignment
- Excellent instruction following

**Best Use Cases**:
- Complex regulatory analysis
- Long document analysis and summarization
- Detailed compliance recommendations
- Risk assessment with detailed explanations

**Note**: Claude doesn't provide embeddings API directly. The service falls back to mock embeddings or can be configured to use OpenAI for embeddings while using Claude for chat.

### Mock Provider

**Features**:
- Realistic mock responses for all AI capabilities
- Configurable delay and error simulation
- No API costs during development and testing
- Comprehensive test coverage

## Architecture

```mermaid
graph TB
    subgraph "AI Service"
        API[REST API Controller]
        Analysis[Analysis Service]
        Mappings[Mappings Service]
        Predictions[Predictions Service]
        Remediation[Remediation Service]
        
        subgraph "AI Provider Layer"
            ProviderConfig[External Services Config]
            OpenAIClient[OpenAI Client]
            ClaudeClient[Claude Client]
            MockProvider[Mock Provider]
        end
        
        subgraph "Caching & Performance"
            Cache[Redis Cache]
            RateLimit[Rate Limiter]
            TokenTracker[Token Usage Tracker]
        end
        
        subgraph "Data Layer"
            DB[(PostgreSQL)]
            Entities[AI Entities]
        end
        
        API --> Analysis
        API --> Mappings
        API --> Predictions
        API --> Remediation
        
        Analysis --> ProviderConfig
        Mappings --> ProviderConfig
        Predictions --> ProviderConfig
        Remediation --> ProviderConfig
        
        ProviderConfig --> OpenAIClient
        ProviderConfig --> ClaudeClient
        ProviderConfig --> MockProvider
        
        Analysis --> Cache
        Analysis --> RateLimit
        Analysis --> TokenTracker
        Analysis --> DB
    end
    
    subgraph "External AI Providers"
        OpenAI[OpenAI API]
        Anthropic[Anthropic API]
    end
    
    subgraph "Infrastructure"
        Redis[Redis Cache]
        PostgreSQL[PostgreSQL]
        Kafka[Apache Kafka]
    end
    
    OpenAIClient --> OpenAI
    ClaudeClient --> Anthropic
    Cache --> Redis
    DB --> PostgreSQL
```

### Key Components

#### AI Services
- **AnalysisService**: Compliance analysis, document summarization, and insights
- **MappingsService**: Control framework mapping and gap analysis
- **PredictionsService**: Risk prediction and trend analysis
- **RemediationService**: Intelligent remediation planning and automation

#### AI Entities
- **ComplianceAnalysis**: AI-generated compliance assessments
- **Prediction**: Risk predictions and trend analysis results
- **FrameworkMapping**: Control framework mapping and relationships
- **Remediation**: AI-generated remediation plans and progress tracking

#### Provider Management
- **ExternalServicesConfig**: Multi-provider configuration and client management
- **Dynamic Provider Switching**: Runtime provider selection based on requirements
- **Fallback Handling**: Graceful degradation and error handling
- **Cost Optimization**: Intelligent model selection and usage optimization

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 13+
- Redis 6+
- OpenAI API Key (optional)
- Anthropic API Key (optional)

### Development Setup

1. **Install Dependencies**
   ```bash
   cd services/ai-service
   npm install
   ```

2. **Environment Configuration**
   ```bash
   cp .env.example .env
   # Edit .env with your AI provider credentials
   ```

3. **Database Setup**
   ```bash
   # Run migrations
   npm run migration:run
   ```

4. **Start Infrastructure**
   ```bash
   # Start Docker services
   docker-compose up -d postgres redis kafka
   ```

5. **Start Development Server**
   ```bash
   npm run start:dev
   ```

The service will be available at `http://localhost:3011`

### Docker Deployment

```dockerfile
# Build and run with Docker
docker build -t ai-service .
docker run -p 3011:3011 ai-service
```

## Configuration

### Environment Variables

```bash
# Server Configuration
PORT=3011
NODE_ENV=development
SERVICE_NAME=ai-service

# Database
DATABASE_HOST=127.0.0.1
DATABASE_PORT=5432
DATABASE_NAME=soc_ai
DATABASE_USERNAME=soc_user
DATABASE_PASSWORD=soc_pass
DATABASE_SSL=false

# Redis
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=soc_redis_pass

# Kafka
KAFKA_BROKER=127.0.0.1:9092
KAFKA_CLIENT_ID=ai-service

# AI Provider Selection
AI_PROVIDER=openai  # Options: openai, claude, mock

# OpenAI Configuration
OPENAI_API_KEY=sk-your-openai-api-key
OPENAI_ORGANIZATION=org-your-organization-id
OPENAI_MODEL_CHAT=gpt-4-turbo-preview
OPENAI_MODEL_EMBEDDING=text-embedding-3-small
OPENAI_MODEL_COMPLETION=gpt-3.5-turbo-instruct
OPENAI_TEMPERATURE=0.7
OPENAI_MAX_TOKENS=2000

# Claude/Anthropic Configuration
ANTHROPIC_API_KEY=sk-ant-api-your-anthropic-key
CLAUDE_MODEL_CHAT=claude-3-sonnet-20240229
CLAUDE_MODEL_VISION=claude-3-opus-20240229
CLAUDE_TEMPERATURE=0.7
CLAUDE_MAX_TOKENS=4096

# Mock Provider Configuration (for development)
AI_MOCK_DELAY=500
AI_MOCK_ERROR_RATE=0.05

# Feature Flags
AI_FEATURE_COMPLIANCE=true
AI_FEATURE_RISK=true
AI_FEATURE_CONTROL=true
AI_FEATURE_SUMMARY=true
AI_FEATURE_ANOMALY=true
AI_FEATURE_NLQ=true

# Rate Limiting
AI_RATE_LIMIT_RPM=60
AI_RATE_LIMIT_TPM=90000
AI_CONCURRENT_REQUESTS=10
```

### Provider-Specific Configuration

#### OpenAI Setup
```bash
# Set OpenAI as primary provider
AI_PROVIDER=openai
OPENAI_API_KEY=sk-your-api-key

# Optional: Organization ID for team accounts
OPENAI_ORGANIZATION=org-your-org-id

# Model selection (use latest available models)
OPENAI_MODEL_CHAT=gpt-4-turbo-preview
OPENAI_MODEL_EMBEDDING=text-embedding-3-small
```

#### Claude/Anthropic Setup
```bash
# Set Claude as primary provider
AI_PROVIDER=claude
ANTHROPIC_API_KEY=sk-ant-api-your-key

# Model selection
CLAUDE_MODEL_CHAT=claude-3-sonnet-20240229
CLAUDE_MODEL_VISION=claude-3-opus-20240229

# Note: For embeddings, configure fallback or separate service
# Claude doesn't provide embeddings API
```

## API Documentation

### Compliance Analysis Endpoints

#### Analyze Compliance Data
```http
POST /api/analysis/compliance
Content-Type: application/json
Authorization: Bearer <jwt-token>

{
  "data": {
    "controlId": "CC6.1",
    "framework": "SOC2",
    "evidence": [
      {
        "type": "policy_document",
        "content": "Access control policy content...",
        "lastReviewed": "2025-01-01"
      },
      {
        "type": "audit_log",
        "content": "Access log entries...",
        "period": "Q4_2024"
      }
    ],
    "currentImplementation": "User access is managed through Active Directory...",
    "testResults": {
      "samplesSelected": 25,
      "exceptions": 2,
      "effectiveDate": "2024-10-01"
    }
  },
  "analysisType": "control_effectiveness",
  "includeRecommendations": true
}
```

**Response**:
```json
{
  "analysisId": "analysis-uuid",
  "complianceScore": 0.87,
  "findings": [
    "Control implementation meets SOC 2 requirements",
    "Evidence documentation is comprehensive",
    "Two minor exceptions identified in access reviews"
  ],
  "recommendations": [
    {
      "priority": "medium",
      "category": "process_improvement",
      "description": "Increase access review frequency to monthly",
      "effort": "low",
      "impact": "medium"
    },
    {
      "priority": "low",
      "category": "automation",
      "description": "Implement automated alerts for failed access attempts",
      "effort": "medium",
      "impact": "high"
    }
  ],
  "riskAssessment": {
    "overallRisk": "low",
    "riskFactors": ["Minor process gaps", "Manual review processes"],
    "mitigationPriority": "medium"
  },
  "confidence": 0.94,
  "provider": "openai",
  "tokensUsed": 1247,
  "processingTime": 3.2
}
```

#### Risk Prediction
```http
POST /api/predictions/risk
Content-Type: application/json
Authorization: Bearer <jwt-token>

{
  "context": {
    "organizationId": "org-uuid",
    "timeframe": "next_quarter",
    "scope": ["access_controls", "data_protection"]
  },
  "historicalData": {
    "controlTestResults": [...],
    "incidentHistory": [...],
    "changeLog": [...]
  },
  "currentState": {
    "controlMaturity": 0.78,
    "staffingChanges": 3,
    "systemChanges": 5,
    "externalFactors": ["regulatory_update", "industry_trends"]
  }
}
```

### Control Mapping Endpoints

#### Generate Control Mappings
```http
POST /api/mappings/generate
Content-Type: application/json
Authorization: Bearer <jwt-token>

{
  "sourceFramework": "SOC2",
  "targetFramework": "ISO27001",
  "scope": {
    "categories": ["access_controls", "monitoring"],
    "includeGapAnalysis": true,
    "includeSimilarityScore": true
  },
  "organizationContext": {
    "industry": "technology",
    "size": "medium",
    "riskProfile": "moderate"
  }
}
```

### Natural Language Query
```http
POST /api/analysis/nlq
Content-Type: application/json
Authorization: Bearer <jwt-token>

{
  "query": "What are the key risks for our access control implementation in Q1 2025?",
  "context": {
    "organizationId": "org-uuid",
    "includeHistoricalData": true,
    "includeRecommendations": true
  }
}
```

## AI Capabilities

### Compliance Analysis

The AI service provides comprehensive compliance analysis capabilities:

#### SOC 2 Control Analysis
```typescript
// Example compliance analysis workflow
const complianceAnalysis = await this.analysisService.analyzeCompliance({
  controlId: 'CC6.1',
  framework: 'SOC2',
  evidence: [
    {
      type: 'policy_document',
      content: accessControlPolicy,
      metadata: { lastReviewed: '2025-01-01', version: '2.1' }
    },
    {
      type: 'audit_logs',
      content: auditLogData,
      period: { start: '2024-10-01', end: '2024-12-31' }
    }
  ],
  currentImplementation: implementationDescription,
  testResults: controlTestResults
});

// AI analyzes and returns:
// - Compliance score (0-1)
// - Detailed findings
// - Specific recommendations
// - Risk assessment
// - Gap analysis
```

#### Intelligent Document Analysis
```typescript
// Document summarization and compliance relevance
const documentAnalysis = await this.analysisService.analyzeDocument({
  document: {
    content: policyDocument,
    type: 'security_policy',
    metadata: { author: 'CISO', date: '2025-01-01' }
  },
  analysisType: 'compliance_relevance',
  frameworks: ['SOC2', 'ISO27001', 'NIST']
});

// Returns:
// - Executive summary
// - Key compliance points
// - Framework mapping
// - Recommendations for improvement
// - Risk implications
```

### Risk Prediction Engine

#### Predictive Risk Analytics
```typescript
// Advanced risk prediction using AI
const riskPrediction = await this.predictionsService.predictRisk({
  timeframe: 'next_quarter',
  scope: ['access_controls', 'data_governance'],
  context: {
    organizationProfile: orgProfile,
    historicalIncidents: incidentHistory,
    controlMaturityData: maturityAssessment,
    externalFactors: ['regulatory_changes', 'threat_landscape']
  },
  analysisDepth: 'detailed'
});

// AI provides:
// - Risk probability scores
// - Contributing factor analysis
// - Trend predictions
// - Mitigation strategies
// - Early warning indicators
```

#### Behavioral Anomaly Detection
```typescript
// AI-powered anomaly detection
const anomalyAnalysis = await this.analysisService.detectAnomalies({
  dataSource: 'user_activity_logs',
  timeframe: 'last_30_days',
  baselineData: historicalNormalBehavior,
  currentData: recentActivityData,
  sensitivityLevel: 'high',
  includeContextualFactors: true
});

// Detects:
// - Unusual access patterns
// - Privilege escalations
// - Data export anomalies
// - Time-based irregularities
// - Cross-service correlations
```

### Control Framework Mapping

#### Intelligent Framework Alignment
```typescript
// AI-powered control mapping between frameworks
const frameworkMapping = await this.mappingsService.generateMapping({
  source: 'SOC2',
  target: 'ISO27001',
  mappingType: 'bidirectional',
  includeGapAnalysis: true,
  contextualFactors: {
    industryVertical: 'financial_services',
    organizationSize: 'enterprise',
    riskTolerance: 'conservative'
  }
});

// AI generates:
// - Precise control mappings
// - Similarity scores
// - Gap identification
// - Implementation recommendations
// - Effort estimations
```

### Intelligent Remediation

#### Automated Remediation Planning
```typescript
// AI-generated remediation plans
const remediationPlan = await this.remediationService.generatePlan({
  findings: complianceFindings,
  priority: 'high',
  constraints: {
    budget: 100000,
    timeline: '90_days',
    resources: availableTeamMembers
  },
  organizationContext: {
    maturityLevel: 'intermediate',
    changeCapacity: 'moderate',
    riskTolerance: 'low'
  }
});

// AI creates:
// - Prioritized action items
// - Resource allocation suggestions
// - Timeline recommendations
// - Success metrics
// - Risk mitigation strategies
```

## Provider Switching

### Dynamic Provider Configuration

The AI service supports seamless switching between providers:

#### Runtime Provider Selection
```typescript
// Provider selection based on task requirements
const getOptimalProvider = (taskType: string, complexity: string) => {
  if (taskType === 'embedding') {
    return 'openai'; // Claude doesn't support embeddings
  }
  
  if (complexity === 'high' && taskType === 'analysis') {
    return 'claude'; // Better reasoning for complex analysis
  }
  
  if (taskType === 'summarization' && complexity === 'low') {
    return 'openai'; // Cost-effective for simple tasks
  }
  
  return process.env.AI_PROVIDER || 'mock';
};
```

#### Cost Optimization Strategies
```typescript
// Intelligent model selection for cost optimization
const selectModel = (provider: string, taskComplexity: string, outputLength: number) => {
  if (provider === 'openai') {
    return taskComplexity === 'high' || outputLength > 1000 
      ? 'gpt-4-turbo-preview'  // High capability
      : 'gpt-3.5-turbo';       // Cost effective
  }
  
  if (provider === 'claude') {
    return taskComplexity === 'high'
      ? 'claude-3-opus-20240229'    // Maximum capability
      : 'claude-3-sonnet-20240229'; // Balanced performance
  }
};
```

#### Fallback and Error Handling
```typescript
// Robust fallback mechanisms
try {
  // Try primary provider
  result = await this.primaryProvider.analyze(data);
} catch (primaryError) {
  this.logger.warn(`Primary provider failed: ${primaryError.message}`);
  
  try {
    // Fallback to secondary provider
    result = await this.secondaryProvider.analyze(data);
  } catch (secondaryError) {
    this.logger.error(`Secondary provider failed: ${secondaryError.message}`);
    
    // Final fallback to mock responses
    result = await this.generateMockResponse(data.type);
    result.isMockResponse = true;
  }
}
```

### Provider Comparison

| Feature | OpenAI | Claude | Mock |
|---------|--------|--------|----- |
| Compliance Analysis | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| Risk Prediction | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| Control Mapping | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| Document Summarization | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| Embeddings | ⭐⭐⭐⭐⭐ | ❌ | ⭐⭐⭐ |
| Cost Efficiency | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Context Length | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| JSON Mode | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Function Calling | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ |
| Development Cost | ⭐ | ⭐ | ⭐⭐⭐⭐⭐ |

## Testing

### Test Suite Overview

The AI service includes **206 comprehensive tests** covering:

- **Unit Tests**: 142 tests covering core AI service logic
- **Integration Tests**: 38 tests for provider integration and caching
- **Controller Tests**: 26 tests for API endpoint validation

### Multi-Provider Testing

#### Provider-Agnostic Test Suite
```typescript
describe('AI Analysis Service - Multi-Provider', () => {
  const providers = ['openai', 'claude', 'mock'];
  
  providers.forEach(provider => {
    describe(`with ${provider} provider`, () => {
      beforeEach(() => {
        process.env.AI_PROVIDER = provider;
        service = new AnalysisService(mockConfig);
      });
      
      it('should perform compliance analysis', async () => {
        const result = await service.analyzeCompliance(mockData);
        
        expect(result).toHaveProperty('complianceScore');
        expect(result.complianceScore).toBeGreaterThanOrEqual(0);
        expect(result.complianceScore).toBeLessThanOrEqual(1);
        expect(result).toHaveProperty('findings');
        expect(result).toHaveProperty('recommendations');
        expect(result).toHaveProperty('confidence');
      });
      
      it('should handle provider-specific features', async () => {
        if (provider === 'openai') {
          // Test OpenAI-specific features
          const embeddings = await service.generateEmbedding('test text');
          expect(embeddings).toBeDefined();
          expect(Array.isArray(embeddings)).toBe(true);
        } else if (provider === 'claude') {
          // Test Claude-specific features
          const analysis = await service.analyzeCompliance(complexData);
          expect(analysis.confidence).toBeGreaterThan(0.8); // Claude's higher confidence
        }
      });
    });
  });
});
```

#### Mock Provider Testing
```typescript
describe('Mock Provider', () => {
  it('should generate realistic compliance analysis', async () => {
    const mockAnalysis = await externalServices.generateMockResponse('complianceAnalysis');
    
    expect(mockAnalysis).toHaveProperty('score');
    expect(mockAnalysis.score).toBeGreaterThanOrEqual(0);
    expect(mockAnalysis.score).toBeLessThanOrEqual(1);
    expect(mockAnalysis.findings).toBeInstanceOf(Array);
    expect(mockAnalysis.recommendations).toBeInstanceOf(Array);
    expect(mockAnalysis.confidence).toBeGreaterThan(0);
  });
  
  it('should simulate configurable delay and errors', async () => {
    // Configure mock for high error rate
    process.env.AI_MOCK_ERROR_RATE = '0.8';
    
    let errorCount = 0;
    const attempts = 10;
    
    for (let i = 0; i < attempts; i++) {
      try {
        await externalServices.generateMockResponse('riskPrediction');
      } catch (error) {
        errorCount++;
      }
    }
    
    expect(errorCount).toBeGreaterThan(attempts * 0.6); // Expect high error rate
  });
});
```

#### Provider Integration Tests
```typescript
describe('Provider Integration', () => {
  it('should handle OpenAI API calls', async () => {
    if (process.env.OPENAI_API_KEY) {
      const result = await externalServices.performComplianceAnalysis({
        control: 'CC6.1',
        evidence: 'Sample evidence data'
      });
      
      expect(result).toBeDefined();
      expect(typeof result.score).toBe('number');
    } else {
      console.log('Skipping OpenAI integration test - no API key');
    }
  });
  
  it('should handle Claude API calls', async () => {
    if (process.env.ANTHROPIC_API_KEY) {
      // Set provider to Claude
      process.env.AI_PROVIDER = 'claude';
      
      const result = await externalServices.predictRisk({
        context: 'Risk assessment data',
        timeframe: 'next_quarter'
      });
      
      expect(result).toBeDefined();
      expect(result.riskLevel).toMatch(/^(low|medium|high)$/);
    } else {
      console.log('Skipping Claude integration test - no API key');
    }
  });
});
```

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:cov

# Run provider-specific tests
npm test -- --testNamePattern="OpenAI"
npm test -- --testNamePattern="Claude"

# Run integration tests (requires API keys)
npm test -- --testNamePattern="Integration"

# Run tests in watch mode
npm run test:watch
```

## Production Deployment

### Docker Configuration

```dockerfile
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

FROM node:18-alpine AS runtime

RUN addgroup -g 1001 -S nodejs
RUN adduser -S nestjs -u 1001

WORKDIR /app
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --chown=nestjs:nodejs package.json ./

USER nestjs

EXPOSE 3011

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3011/health || exit 1

CMD ["node", "dist/main"]
```

### Production Checklist

#### Security
- [ ] AI API keys securely stored in secrets management
- [ ] Request sanitization for AI prompts
- [ ] Rate limiting configured
- [ ] Input validation on all endpoints
- [ ] JWT authentication configured
- [ ] TLS/SSL certificates installed

#### Performance
- [ ] Redis caching configured and optimized
- [ ] Token usage monitoring and alerting
- [ ] Provider response time monitoring
- [ ] Intelligent model selection implemented
- [ ] Cost optimization strategies enabled

#### Reliability
- [ ] Provider fallback mechanisms tested
- [ ] Health checks configured for all providers
- [ ] Error handling and retry logic
- [ ] Graceful degradation to mock responses
- [ ] Monitoring and alerting configured

#### Cost Management
- [ ] Token usage tracking and budgets
- [ ] Provider cost optimization
- [ ] Model selection strategies
- [ ] Caching for repeated queries
- [ ] Rate limiting to prevent overuse

## Contributing

### Development Guidelines

1. **Provider Agnostic**: Ensure features work across all supported providers
2. **Testing**: Maintain comprehensive test coverage including mock scenarios
3. **Documentation**: Update API documentation for new AI capabilities
4. **Type Safety**: Zero tolerance for `any` types in production code
5. **Cost Awareness**: Consider token usage and API costs in implementations
6. **Security**: Sanitize all inputs sent to AI providers

### Adding New AI Capabilities

1. **Implement Provider-Agnostic Interface**
   ```typescript
   interface AICapability {
     analyze(data: AnalysisData): Promise<AnalysisResult>;
     getSupportedProviders(): string[];
     getTokenEstimate(data: AnalysisData): number;
   }
   ```

2. **Add Provider-Specific Implementations**
3. **Create Comprehensive Tests**
4. **Update Documentation**
5. **Add Mock Responses**
6. **Consider Cost Implications**

### Pull Request Process

1. Create feature branch from `main`
2. Implement changes with comprehensive tests
3. Test with multiple providers (if available)
4. Update documentation
5. Ensure all tests pass: `npm test`
6. Run linting: `npm run lint:fix`
7. Submit pull request with detailed description

## License

This project is proprietary software. All rights reserved.

---

For additional support or questions, contact the SOC Compliance Platform team.