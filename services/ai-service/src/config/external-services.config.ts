import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

export interface AIServiceConfig {
  provider: 'openai' | 'claude' | 'mock' | 'azure-openai';
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
  };
  claude?: {
    apiKey: string;
    models: {
      chat: string;
      vision: string;
    };
    temperature: number;
    maxTokens: number;
  };
  mock?: {
    delay: number;
    errorRate: number;
  };
  features: {
    complianceAnalysis: boolean;
    riskPrediction: boolean;
    controlMapping: boolean;
    documentSummarization: boolean;
    anomalyDetection: boolean;
    naturalLanguageQueries: boolean;
  };
  rateLimit: {
    requestsPerMinute: number;
    tokensPerMinute: number;
    concurrentRequests: number;
  };
}

interface MockResponse {
  complianceAnalysis?: any;
  riskPrediction?: any;
  controlMapping?: any;
  documentSummary?: any;
  anomalyDetection?: any;
}

@Injectable()
export class ExternalServicesConfig {
  private readonly logger = new Logger(ExternalServicesConfig.name);
  private openaiClient: OpenAI | null = null;
  private claudeClient: Anthropic | null = null;

  constructor(private configService: ConfigService) {
    this.initializeAIClient();
  }

  get ai(): AIServiceConfig {
    const provider = this.configService.get('AI_PROVIDER') || 'mock';
    const isDevelopment = this.configService.get('NODE_ENV') !== 'production';

    return {
      provider: provider as 'openai' | 'claude' | 'mock',
      openai:
        provider === 'openai'
          ? {
              apiKey: this.configService.get('OPENAI_API_KEY'),
              organization: this.configService.get('OPENAI_ORGANIZATION'),
              models: {
                chat: this.configService.get('OPENAI_MODEL_CHAT') || 'gpt-4-turbo-preview',
                embedding:
                  this.configService.get('OPENAI_MODEL_EMBEDDING') || 'text-embedding-3-small',
                completion:
                  this.configService.get('OPENAI_MODEL_COMPLETION') || 'gpt-3.5-turbo-instruct',
              },
              temperature: parseFloat(this.configService.get('OPENAI_TEMPERATURE') || '0.7'),
              maxTokens: parseInt(this.configService.get('OPENAI_MAX_TOKENS') || '2000', 10),
            }
          : undefined,
      claude:
        provider === 'claude'
          ? {
              apiKey: this.configService.get('ANTHROPIC_API_KEY'),
              models: {
                chat: this.configService.get('CLAUDE_MODEL_CHAT') || 'claude-3-sonnet-20240229',
                vision: this.configService.get('CLAUDE_MODEL_VISION') || 'claude-3-opus-20240229',
              },
              temperature: parseFloat(this.configService.get('CLAUDE_TEMPERATURE') || '0.7'),
              maxTokens: parseInt(this.configService.get('CLAUDE_MAX_TOKENS') || '4096', 10),
            }
          : undefined,
      mock:
        provider === 'mock'
          ? {
              delay: parseInt(this.configService.get('AI_MOCK_DELAY') || '500', 10),
              errorRate: parseFloat(this.configService.get('AI_MOCK_ERROR_RATE') || '0.05'),
            }
          : undefined,
      features: {
        complianceAnalysis: this.configService.get('AI_FEATURE_COMPLIANCE') !== 'false',
        riskPrediction: this.configService.get('AI_FEATURE_RISK') !== 'false',
        controlMapping: this.configService.get('AI_FEATURE_CONTROL') !== 'false',
        documentSummarization: this.configService.get('AI_FEATURE_SUMMARY') !== 'false',
        anomalyDetection: this.configService.get('AI_FEATURE_ANOMALY') !== 'false',
        naturalLanguageQueries: this.configService.get('AI_FEATURE_NLQ') !== 'false',
      },
      rateLimit: {
        requestsPerMinute: parseInt(this.configService.get('AI_RATE_LIMIT_RPM') || '60', 10),
        tokensPerMinute: parseInt(this.configService.get('AI_RATE_LIMIT_TPM') || '90000', 10),
        concurrentRequests: parseInt(this.configService.get('AI_CONCURRENT_REQUESTS') || '10', 10),
      },
    };
  }

  private initializeAIClient() {
    const aiConfig = this.ai;

    if (aiConfig.provider === 'openai' && aiConfig.openai?.apiKey) {
      this.openaiClient = new OpenAI({
        apiKey: aiConfig.openai.apiKey,
        organization: aiConfig.openai.organization,
      });
      this.logger.log('OpenAI client initialized');
    } else if (aiConfig.provider === 'claude' && aiConfig.claude?.apiKey) {
      this.claudeClient = new Anthropic({
        apiKey: aiConfig.claude.apiKey,
      });
      this.logger.log('Claude client initialized');
    } else {
      this.logger.log('Using mock AI provider');
    }
  }

  getOpenAIClient(): OpenAI | null {
    return this.openaiClient;
  }

  getClaudeClient(): Anthropic | null {
    return this.claudeClient;
  }

  getAIClient(): OpenAI | Anthropic | null {
    if (this.ai.provider === 'openai') {
      return this.openaiClient;
    } else if (this.ai.provider === 'claude') {
      return this.claudeClient;
    }
    return null;
  }

  async generateMockResponse(type: keyof MockResponse): Promise<any> {
    const config = this.ai;

    // Simulate delay
    if (config.mock) {
      await new Promise((resolve) => setTimeout(resolve, config.mock.delay));

      // Simulate errors
      if (Math.random() < config.mock.errorRate) {
        throw new Error('Mock AI service error');
      }
    }

    const mockResponses: MockResponse = {
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
        confidence: 0.92,
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
        trend: 'increasing',
      },
      controlMapping: {
        suggestedControls: [
          {
            id: 'CC6.1',
            relevance: 0.95,
            reason: 'Directly addresses logical access requirements',
            framework: 'SOC2',
          },
          {
            id: 'CC6.2',
            relevance: 0.88,
            reason: 'Covers access provisioning process',
            framework: 'SOC2',
          },
          {
            id: 'CC6.3',
            relevance: 0.82,
            reason: 'Related to access removal procedures',
            framework: 'SOC2',
          },
        ],
        coverage: 0.91,
        gaps: ['Privileged access monitoring', 'Service account management'],
      },
      documentSummary: {
        summary:
          'This document describes the access control procedures for the production environment, including user provisioning, periodic reviews, and deprovisioning processes.',
        keyPoints: [
          'Access requests require manager approval',
          'Quarterly access reviews are mandatory',
          'Automated deprovisioning for terminated employees',
          'Privileged access requires additional approval',
        ],
        complianceRelevance: 'High - directly supports CC6.1, CC6.2, and CC6.3 controls',
        extractedMetadata: {
          documentType: 'Policy',
          effectiveDate: '2024-01-01',
          reviewDate: '2024-12-31',
          owner: 'IT Security Team',
        },
      },
      anomalyDetection: {
        anomalies: [
          {
            type: 'access_pattern',
            severity: 'medium',
            description: 'Unusual access pattern detected for user account',
            timestamp: new Date().toISOString(),
            recommendations: ['Review access logs', 'Verify with user'],
          },
        ],
        normalBehaviorScore: 0.78,
        deviationScore: 0.22,
      },
    };

    return mockResponses[type] || { error: 'Unknown response type' };
  }

  async performComplianceAnalysis(data: any): Promise<any> {
    if (this.ai.provider === 'mock') {
      return this.generateMockResponse('complianceAnalysis');
    }

    if (this.ai.provider === 'openai') {
      if (!this.openaiClient) {
        throw new Error('OpenAI client not initialized');
      }

      const response = await this.openaiClient.chat.completions.create({
        model: this.ai.openai.models.chat,
        messages: [
          {
            role: 'system',
            content:
              'You are a SOC 2 compliance expert. Analyze the provided data and return a compliance assessment.',
          },
          {
            role: 'user',
            content: JSON.stringify(data),
          },
        ],
        temperature: this.ai.openai.temperature,
        max_tokens: this.ai.openai.maxTokens,
        response_format: { type: 'json_object' },
      });

      return JSON.parse(response.choices[0].message.content);
    } else if (this.ai.provider === 'claude') {
      if (!this.claudeClient) {
        throw new Error('Claude client not initialized');
      }

      const response = await this.claudeClient.messages.create({
        model: this.ai.claude.models.chat,
        messages: [
          {
            role: 'user',
            content: `You are a SOC 2 compliance expert. Analyze the following data and return a JSON compliance assessment:
            
${JSON.stringify(data)}

Please respond with a JSON object containing:
- score: compliance score between 0 and 1
- findings: array of key findings
- recommendations: array of recommendations
- confidence: confidence level between 0 and 1`,
          },
        ],
        temperature: this.ai.claude.temperature,
        max_tokens: this.ai.claude.maxTokens,
      });

      // Extract JSON from Claude's response
      const content = response.content[0].type === 'text' ? response.content[0].text : '';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      throw new Error('Failed to parse Claude response as JSON');
    }

    throw new Error(`Unsupported AI provider: ${this.ai.provider}`);
  }

  async predictRisk(data: any): Promise<any> {
    if (this.ai.provider === 'mock') {
      return this.generateMockResponse('riskPrediction');
    }

    if (this.ai.provider === 'openai') {
      if (!this.openaiClient) {
        throw new Error('OpenAI client not initialized');
      }

      const response = await this.openaiClient.chat.completions.create({
        model: this.ai.openai.models.chat,
        messages: [
          {
            role: 'system',
            content:
              'You are a risk assessment expert. Analyze the provided data and predict compliance risks.',
          },
          {
            role: 'user',
            content: JSON.stringify(data),
          },
        ],
        temperature: this.ai.openai.temperature,
        max_tokens: this.ai.openai.maxTokens,
        response_format: { type: 'json_object' },
      });

      return JSON.parse(response.choices[0].message.content);
    } else if (this.ai.provider === 'claude') {
      if (!this.claudeClient) {
        throw new Error('Claude client not initialized');
      }

      const response = await this.claudeClient.messages.create({
        model: this.ai.claude.models.chat,
        messages: [
          {
            role: 'user',
            content: `You are a risk assessment expert. Analyze the following data and predict compliance risks:
            
${JSON.stringify(data)}

Please respond with a JSON object containing:
- riskLevel: 'low', 'medium', or 'high'
- probability: risk probability between 0 and 1
- factors: array of risk factors
- mitigations: array of suggested mitigations
- trend: 'increasing', 'stable', or 'decreasing'`,
          },
        ],
        temperature: this.ai.claude.temperature,
        max_tokens: this.ai.claude.maxTokens,
      });

      // Extract JSON from Claude's response
      const content = response.content[0].type === 'text' ? response.content[0].text : '';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      throw new Error('Failed to parse Claude response as JSON');
    }

    throw new Error(`Unsupported AI provider: ${this.ai.provider}`);
  }

  async generateEmbedding(text: string): Promise<number[]> {
    if (this.ai.provider === 'mock') {
      // Return mock embedding vector
      return Array(1536)
        .fill(0)
        .map(() => Math.random());
    }

    if (this.ai.provider === 'openai') {
      if (!this.openaiClient) {
        throw new Error('OpenAI client not initialized');
      }

      const response = await this.openaiClient.embeddings.create({
        model: this.ai.openai.models.embedding,
        input: text,
      });

      return response.data[0].embedding;
    } else if (this.ai.provider === 'claude') {
      // Claude doesn't provide embeddings API directly
      // You would need to use a separate embedding service or fallback to OpenAI
      this.logger.warn('Claude does not support embeddings. Using mock embeddings.');
      return Array(1536)
        .fill(0)
        .map(() => Math.random());
    }

    throw new Error(`Embedding generation not supported for provider: ${this.ai.provider}`);
  }
}
