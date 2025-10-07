/**
 * AI Service Configuration
 * Development: Mock responses or reduced models
 * Production: OpenAI API integration
 */

export interface AIConfig {
  provider: 'openai' | 'mock' | 'azure-openai';

  // OpenAI Configuration
  openai?: {
    apiKey: string;
    organization?: string;
    models: {
      chat: string;
      embedding: string;
      completion: string;
    };
    temperature: number;
    maxTokens: number;
    topP: number;
    frequencyPenalty: number;
    presencePenalty: number;
  };

  // Azure OpenAI Configuration
  azureOpenai?: {
    apiKey: string;
    endpoint: string;
    deploymentNames: {
      chat: string;
      embedding: string;
      completion: string;
    };
  };

  // Mock Configuration
  mock?: {
    delay: number; // milliseconds
    errorRate: number; // 0-1
  };

  // Feature flags
  features: {
    complianceAnalysis: boolean;
    riskPrediction: boolean;
    controlMapping: boolean;
    documentSummarization: boolean;
    anomalyDetection: boolean;
    naturalLanguageQueries: boolean;
  };

  // Rate limiting
  rateLimit: {
    requestsPerMinute: number;
    tokensPerMinute: number;
    concurrentRequests: number;
  };

  // Caching
  cache: {
    enabled: boolean;
    ttl: number; // seconds
    maxSize: number; // MB
  };

  // Safety and compliance
  safety: {
    contentFiltering: boolean;
    piiDetection: boolean;
    auditLogging: boolean;
  };
}

export const aiConfig = (): AIConfig => {
  const isDevelopment = process.env.NODE_ENV === 'development';

  if (isDevelopment && !process.env.OPENAI_API_KEY) {
    return {
      provider: 'mock',
      mock: {
        delay: 500,
        errorRate: 0.05,
      },
      features: {
        complianceAnalysis: true,
        riskPrediction: true,
        controlMapping: true,
        documentSummarization: true,
        anomalyDetection: true,
        naturalLanguageQueries: true,
      },
      rateLimit: {
        requestsPerMinute: 60,
        tokensPerMinute: 40000,
        concurrentRequests: 5,
      },
      cache: {
        enabled: true,
        ttl: 3600,
        maxSize: 100,
      },
      safety: {
        contentFiltering: true,
        piiDetection: true,
        auditLogging: true,
      },
    };
  }

  // Production or development with API key
  return {
    provider: (process.env.AI_PROVIDER as 'openai' | 'azure-openai') || 'openai',
    openai: {
      apiKey: process.env.OPENAI_API_KEY || '',
      organization: process.env.OPENAI_ORGANIZATION,
      models: {
        chat: process.env.OPENAI_MODEL_CHAT || 'gpt-4-turbo-preview',
        embedding: process.env.OPENAI_MODEL_EMBEDDING || 'text-embedding-3-small',
        completion: process.env.OPENAI_MODEL_COMPLETION || 'gpt-3.5-turbo-instruct',
      },
      temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.7'),
      maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '2000', 10),
      topP: parseFloat(process.env.OPENAI_TOP_P || '1'),
      frequencyPenalty: parseFloat(process.env.OPENAI_FREQUENCY_PENALTY || '0'),
      presencePenalty: parseFloat(process.env.OPENAI_PRESENCE_PENALTY || '0'),
    },
    azureOpenai:
      process.env.AI_PROVIDER === 'azure-openai'
        ? {
            apiKey: process.env.AZURE_OPENAI_API_KEY || '',
            endpoint: process.env.AZURE_OPENAI_ENDPOINT || '',
            deploymentNames: {
              chat: process.env.AZURE_OPENAI_CHAT_DEPLOYMENT || '',
              embedding: process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT || '',
              completion: process.env.AZURE_OPENAI_COMPLETION_DEPLOYMENT || '',
            },
          }
        : undefined,
    features: {
      complianceAnalysis: process.env.AI_FEATURE_COMPLIANCE !== 'false',
      riskPrediction: process.env.AI_FEATURE_RISK !== 'false',
      controlMapping: process.env.AI_FEATURE_CONTROL !== 'false',
      documentSummarization: process.env.AI_FEATURE_SUMMARY !== 'false',
      anomalyDetection: process.env.AI_FEATURE_ANOMALY !== 'false',
      naturalLanguageQueries: process.env.AI_FEATURE_NLQ !== 'false',
    },
    rateLimit: {
      requestsPerMinute: parseInt(process.env.AI_RATE_LIMIT_RPM || '60', 10),
      tokensPerMinute: parseInt(process.env.AI_RATE_LIMIT_TPM || '90000', 10),
      concurrentRequests: parseInt(process.env.AI_CONCURRENT_REQUESTS || '10', 10),
    },
    cache: {
      enabled: process.env.AI_CACHE_ENABLED !== 'false',
      ttl: parseInt(process.env.AI_CACHE_TTL || '3600', 10),
      maxSize: parseInt(process.env.AI_CACHE_MAX_SIZE || '500', 10),
    },
    safety: {
      contentFiltering: process.env.AI_CONTENT_FILTERING !== 'false',
      piiDetection: process.env.AI_PII_DETECTION !== 'false',
      auditLogging: process.env.AI_AUDIT_LOGGING !== 'false',
    },
  };
};

// Mock responses for development
export const mockAIResponses = {
  complianceAnalysis: {
    score: 0.85,
    findings: [
      'Control implementation meets SOC 2 requirements',
      'Evidence documentation is comprehensive',
      'Minor improvement needed in access review frequency',
    ],
    recommendations: [
      'Increase access review frequency to monthly',
      'Add automated monitoring for configuration changes',
    ],
  },

  riskPrediction: {
    riskLevel: 'medium',
    probability: 0.35,
    factors: [
      'Recent personnel changes in IT department',
      'Upcoming system migration',
      'Historical control test failures',
    ],
    mitigations: [
      'Implement additional training for new personnel',
      'Create detailed migration checklist',
      'Increase control testing frequency',
    ],
  },

  controlMapping: {
    suggestedControls: [
      { id: 'CC6.1', relevance: 0.95, reason: 'Directly addresses logical access requirements' },
      { id: 'CC6.2', relevance: 0.88, reason: 'Covers access provisioning process' },
      { id: 'CC6.3', relevance: 0.82, reason: 'Related to access removal procedures' },
    ],
  },

  documentSummary: {
    summary:
      'This document describes the access control procedures for the production environment, including user provisioning, periodic reviews, and deprovisioning processes.',
    keyPoints: [
      'Access requests require manager approval',
      'Quarterly access reviews are mandatory',
      'Automated deprovisioning for terminated employees',
    ],
    complianceRelevance: 'High - directly supports CC6.1, CC6.2, and CC6.3 controls',
  },
};

export default aiConfig;
