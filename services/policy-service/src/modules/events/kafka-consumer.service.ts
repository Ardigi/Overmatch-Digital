import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { type Consumer, type EachMessagePayload, Kafka } from 'kafkajs';
import { Repository } from 'typeorm';
import { SanitizationUtil } from '../../shared/utils/sanitization.util';
import { Control, ImplementationStatus } from '../compliance/entities/control.entity';
import { ComplianceFramework } from '../compliance/entities/framework.entity';
import { Policy } from '../policies/entities/policy.entity';
import { Risk, RiskCategory, RiskLevel, RiskStatus } from '../risks/entities/risk.entity';

interface ComplianceEvent {
  type: string;
  timestamp: Date;
  userId?: string;
  organizationId?: string;
  entityId?: string;
  entityType?: string;
  metadata?: any;
}

@Injectable()
export class KafkaConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaConsumerService.name);
  private kafka: Kafka;
  private consumer: Consumer;

  constructor(
    private configService: ConfigService,
    @InjectRepository(Policy)
    private policyRepository: Repository<Policy>,
    @InjectRepository(Control)
    private controlRepository: Repository<Control>,
    @InjectRepository(Risk)
    private riskRepository: Repository<Risk>,
    @InjectRepository(ComplianceFramework)
    private frameworkRepository: Repository<ComplianceFramework>,
  ) {
    this.kafka = new Kafka({
      clientId: 'policy-service',
      brokers: this.configService.get<string[]>('policyService.kafka.brokers') || ['127.0.0.1:9092'],
    });
    
    this.consumer = this.kafka.consumer({ groupId: 'policy-service-group' });
  }

  async onModuleInit() {
    try {
      await this.consumer.connect();
      await this.consumer.subscribe({ 
        topics: ['compliance-events', 'control-events', 'risk-events'], 
        fromBeginning: false 
      });
      
      await this.consumer.run({
        eachMessage: async ({ topic, partition, message }: EachMessagePayload) => {
          await this.handleMessage(topic, message);
        },
      });
      
      this.logger.log('Kafka consumer connected and listening');
    } catch (error) {
      this.logger.error(`Failed to connect Kafka consumer: ${error.message}`);
    }
  }

  async onModuleDestroy() {
    await this.consumer.disconnect();
  }

  private async handleMessage(topic: string, message: any) {
    try {
      const rawEvent = JSON.parse(message.value.toString());
      
      // Sanitize the event data
      const event: ComplianceEvent = this.sanitizeEvent(rawEvent);
      
      this.logger.log(`Received event: ${event.type} from topic: ${topic}`);
      
      switch (event.type) {
        case 'compliance.control.implemented':
          await this.handleControlImplemented(event);
          break;
        case 'compliance.control.failed':
          await this.handleControlFailed(event);
          break;
        case 'compliance.control.tested':
          await this.handleControlTested(event);
          break;
        case 'compliance.evidence.collected':
          await this.handleEvidenceCollected(event);
          break;
        case 'compliance.risk.identified':
          await this.handleRiskIdentified(event);
          break;
        case 'compliance.policy.updated':
          await this.handlePolicyUpdated(event);
          break;
        default:
          this.logger.warn(`Unhandled event type: ${event.type}`);
      }
    } catch (error) {
      this.logger.error(`Error processing message: ${error.message}`);
    }
  }

  protected async handleControlImplemented(event: ComplianceEvent) {
    this.logger.log(`Processing control implemented: ${event.metadata?.controlId}`);
    
    if (event.metadata?.controlId) {
      try {
        const control = await this.controlRepository.findOne({
          where: { id: event.metadata.controlId },
        });
        
        if (control) {
          // Update control status and implementation date
          control.implementationStatus = ImplementationStatus.IMPLEMENTED;
          control.implementationDate = new Date();
          
          // Add to change history
          if (!control.changeHistory) {
            control.changeHistory = [];
          }
          control.changeHistory.push({
            version: control.version + 1,
            changedBy: event.userId || 'system',
            changedAt: new Date(),
            changes: { 
              summary: 'Control implemented',
              details: { 
                implementationStatus: ImplementationStatus.IMPLEMENTED,
                reason: 'Control implemented via event'
              },
              fields: ['implementationStatus']
            },
          });
          control.version += 1;
          
          await this.controlRepository.save(control);
          this.logger.log(`Updated control ${control.id} with implementation data`);
        }
      } catch (error) {
        this.logger.error(`Error updating control: ${error.message}`);
      }
    }
  }

  protected async handleControlFailed(event: ComplianceEvent) {
    this.logger.log(`Processing control failure: ${event.metadata?.controlId}`);
    
    // Create or update risk based on control failure
    if (event.metadata?.controlId && event.metadata?.reason) {
      try {
        const control = await this.controlRepository.findOne({
          where: { id: event.metadata.controlId },
        });
        
        if (control) {
          // Check if a risk already exists for this control failure
          const existingRisk = await this.riskRepository.findOne({
            where: {
              organizationId: event.organizationId,
              riskId: `RISK-CTRL-${control.id}`,
            },
          });
          
          if (!existingRisk) {
            // Create new risk
            const risk = this.riskRepository.create({
              title: `Control Failure: ${control.title}`,
              riskId: `RISK-CTRL-${control.id}-${Date.now()}`,
              description: `Control ${control.title} failed: ${event.metadata.reason}`,
              category: RiskCategory.COMPLIANCE,
              status: RiskStatus.IDENTIFIED,
              organizationId: event.organizationId || control.organizationId,
              ownerId: control.ownerId,
              ownerName: control.ownerName,
              ownerEmail: control.ownerEmail,
              assessment: {
                inherentRisk: {
                  likelihood: 3,
                  impact: 3,
                  score: 9,
                  level: RiskLevel.MEDIUM,
                },
                assessmentDate: new Date(),
                assessedBy: 'system',
              },
              details: {
                source: `control-failure-${control.id}`,
                trigger: event.metadata.reason,
                relatedRisks: [control.id],
              },
              createdBy: event.userId || 'system',
              updatedBy: event.userId || 'system',
            });
            
            await this.riskRepository.save(risk);
            this.logger.log(`Created risk for control failure: ${risk.riskId}`);
            
            // Update control status
            control.implementationStatus = ImplementationStatus.NOT_STARTED;
            await this.controlRepository.save(control);
          }
        }
      } catch (error) {
        this.logger.error(`Error creating risk from control failure: ${error.message}`);
      }
    }
  }

  protected async handleControlTested(event: ComplianceEvent) {
    this.logger.log(`Processing control test: ${event.metadata?.controlId}`);
    
    if (event.metadata?.controlId && event.metadata?.testResult) {
      try {
        const control = await this.controlRepository.findOne({
          where: { id: event.metadata.controlId },
        });
        
        if (control) {
          // Update control test results
          control.addTestResult({
            date: new Date(),
            tester: event.userId || 'system',
            passed: event.metadata.testResult === 'pass',
            score: event.metadata.testResult === 'pass' ? 100 : event.metadata.testResult === 'partial' ? 60 : 0,
            findings: event.metadata.findings,
          });
          
          // Update effectiveness based on test results
          if (event.metadata.testResult === 'pass') {
            control.updateEffectiveness(90, []);
            control.implementationStatus = ImplementationStatus.IMPLEMENTED;
          } else if (event.metadata.testResult === 'partial') {
            control.updateEffectiveness(60, event.metadata.findings);
            control.implementationStatus = ImplementationStatus.PARTIAL;
          } else {
            control.updateEffectiveness(20, event.metadata.findings);
            control.implementationStatus = ImplementationStatus.NOT_STARTED;
          }
          
          await this.controlRepository.save(control);
        }
      } catch (error) {
        this.logger.error(`Error updating control test data: ${error.message}`);
      }
    }
  }

  protected async handleEvidenceCollected(event: ComplianceEvent) {
    this.logger.log(`Processing evidence collected: ${event.metadata?.evidenceId}`);
    
    // Update related controls with evidence collection data
    if (event.metadata?.controlIds && Array.isArray(event.metadata.controlIds)) {
      try {
        for (const controlId of event.metadata.controlIds) {
          const control = await this.controlRepository.findOne({
            where: { id: controlId },
          });
          
          if (control) {
            // Add evidence ID to control
            if (!control.evidenceIds) {
              control.evidenceIds = [];
            }
            control.evidenceIds.push(event.metadata.evidenceId);
            
            // Update change history
            if (!control.changeHistory) {
              control.changeHistory = [];
            }
            control.changeHistory.push({
              version: control.version + 1,
              changedBy: event.userId || 'system',
              changedAt: new Date(),
              changes: { 
                summary: 'Evidence collected',
                details: { 
                  evidenceAdded: event.metadata.evidenceId,
                  reason: 'Evidence collected'
                },
                fields: ['evidenceIds']
              },
            });
            control.version += 1;
            
            await this.controlRepository.save(control);
          }
        }
      } catch (error) {
        this.logger.error(`Error updating controls with evidence data: ${error.message}`);
      }
    }
  }

  protected async handleRiskIdentified(event: ComplianceEvent) {
    this.logger.log(`Processing risk identified: ${event.metadata?.riskId}`);
    
    // Update related controls when a risk is identified
    if (event.metadata?.controlIds && Array.isArray(event.metadata.controlIds)) {
      try {
        for (const controlId of event.metadata.controlIds) {
          const control = await this.controlRepository.findOne({
            where: { id: controlId },
          });
          
          if (control) {
            // Update risk assessment
            if (!control.riskAssessment) {
              control.riskAssessment = {
                inherentRisk: {
                  likelihood: 3,
                  impact: 3,
                  score: 9,
                  level: 'medium',
                },
                residualRisk: {
                  likelihood: 2,
                  impact: 3,
                  score: 6,
                  level: 'medium',
                },
              };
            }
            
            if (!control.riskAssessment.risksAddressed) {
              control.riskAssessment.risksAddressed = [];
            }
            control.riskAssessment.risksAddressed.push(event.metadata.riskId);
            
            await this.controlRepository.save(control);
          }
        }
      } catch (error) {
        this.logger.error(`Error updating controls with risk data: ${error.message}`);
      }
    }
  }

  protected async handlePolicyUpdated(event: ComplianceEvent) {
    this.logger.log(`Processing policy update: ${event.metadata?.policyId}`);
    
    // Create risk if policy update might affect compliance
    if (event.metadata?.policyId && event.metadata?.changeType === 'major') {
      try {
        const policy = await this.policyRepository.findOne({
          where: { id: event.metadata.policyId },
        });
        
        if (policy) {
          const risk = this.riskRepository.create({
            title: `Policy Change Risk: ${policy.title}`,
            riskId: `RISK-POL-${policy.id}-${Date.now()}`,
            description: `Major change to policy ${policy.title} may affect compliance controls`,
            category: RiskCategory.COMPLIANCE,
            status: RiskStatus.IDENTIFIED,
            organizationId: event.organizationId || policy.organizationId,
            ownerId: policy.ownerId,
            ownerName: policy.ownerName,
            assessment: {
              inherentRisk: {
                likelihood: 2,
                impact: 3,
                score: 6,
                level: RiskLevel.MEDIUM,
              },
              assessmentDate: new Date(),
              assessedBy: 'system',
            },
            details: {
              source: `policy-change-${policy.id}`,
              trigger: 'Major policy update',
            },
            createdBy: event.userId || 'system',
            updatedBy: event.userId || 'system',
          });
          
          await this.riskRepository.save(risk);
          this.logger.log(`Created risk for policy change: ${risk.riskId}`);
        }
      } catch (error) {
        this.logger.error(`Error creating risk from policy update: ${error.message}`);
      }
    }
  }
  
  private sanitizeEvent(event: any): ComplianceEvent {
    const sanitized: ComplianceEvent = {
      type: SanitizationUtil.sanitizeText(event.type),
      timestamp: new Date(event.timestamp),
      userId: event.userId ? SanitizationUtil.sanitizeText(event.userId) : undefined,
      organizationId: event.organizationId ? SanitizationUtil.sanitizeText(event.organizationId) : undefined,
      entityId: event.entityId ? SanitizationUtil.sanitizeText(event.entityId) : undefined,
      entityType: event.entityType ? SanitizationUtil.sanitizeText(event.entityType) : undefined,
      metadata: event.metadata ? this.sanitizeMetadata(event.metadata) : undefined,
    };
    
    return sanitized;
  }
  
  private sanitizeMetadata(metadata: any): any {
    const sanitized: any = {};
    
    for (const [key, value] of Object.entries(metadata)) {
      const sanitizedKey = SanitizationUtil.sanitizeText(key);
      
      if (typeof value === 'string') {
        // Special handling for specific fields
        if (key === 'reason' || key === 'description' || key === 'comment') {
          sanitized[sanitizedKey] = SanitizationUtil.sanitizeHtml(value, true);
        } else {
          sanitized[sanitizedKey] = SanitizationUtil.sanitizeText(value);
        }
      } else if (Array.isArray(value)) {
        sanitized[sanitizedKey] = value.map(item => 
          typeof item === 'string' ? SanitizationUtil.sanitizeText(item) : item
        );
      } else if (value && typeof value === 'object') {
        sanitized[sanitizedKey] = this.sanitizeMetadata(value);
      } else {
        sanitized[sanitizedKey] = value;
      }
    }
    
    return sanitized;
  }
}