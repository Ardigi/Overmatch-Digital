import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ClientKafka } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';

// Client Event Types
export enum ClientEventType {
  CLIENT_CREATED = 'client.client.created',
  CLIENT_UPDATED = 'client.client.updated',
  CLIENT_DELETED = 'client.client.deleted',
  CLIENT_ONBOARDED = 'client.client.onboarded',
  CLIENT_STATUS_CHANGED = 'client.client.status_changed',
  CONTRACT_CREATED = 'client.contract.created',
  CONTRACT_SIGNED = 'client.contract.signed',
  CONTRACT_EXPIRED = 'client.contract.expired',
  AUDIT_SCHEDULED = 'client.audit.scheduled',
  AUDIT_STARTED = 'client.audit.started',
  AUDIT_COMPLETED = 'client.audit.completed',
}

export interface ClientEvent {
  eventType: ClientEventType;
  clientId?: string;
  organizationId?: string;
  userId?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

@Injectable()
export class KafkaProducerService {
  private readonly logger = new Logger(KafkaProducerService.name);

  constructor(
    @Inject('KAFKA_SERVICE') private readonly kafkaClient: ClientKafka,
  ) {}

  async onModuleInit() {
    // Connect to Kafka
    await this.kafkaClient.connect();
    this.logger.log('Kafka Producer Service connected');
  }

  async publishClientEvent(event: ClientEvent): Promise<void> {
    try {
      const result = await lastValueFrom(
        this.kafkaClient.emit('client.events', {
          key: event.clientId || event.organizationId || 'system',
          value: event,
          headers: {
            eventType: event.eventType,
            timestamp: event.timestamp.toISOString(),
          },
        }),
      );
      
      this.logger.debug(`Published client event: ${event.eventType}`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to publish client event: ${error.message}`, error.stack);
      throw error;
    }
  }

  async publishBatch(events: ClientEvent[]): Promise<void> {
    try {
      const messages = events.map(event => ({
        key: event.clientId || event.organizationId || 'system',
        value: event,
        headers: {
          eventType: event.eventType,
          timestamp: event.timestamp.toISOString(),
        },
      }));

      await lastValueFrom(
        this.kafkaClient.emit('client.events.batch', messages),
      );
      
      this.logger.debug(`Published batch of ${events.length} client events`);
    } catch (error) {
      this.logger.error(`Failed to publish batch events: ${error.message}`, error.stack);
      throw error;
    }
  }

  // Convenience methods for common events
  async publishClientCreated(clientId: string, clientData: any, userId: string): Promise<void> {
    return this.publishClientEvent({
      eventType: ClientEventType.CLIENT_CREATED,
      clientId,
      organizationId: clientData.organizationId,
      userId,
      timestamp: new Date(),
      metadata: {
        name: clientData.name,
        industry: clientData.industry,
        size: clientData.size,
        clientType: clientData.clientType,
      },
    });
  }

  async publishClientUpdated(clientId: string, changes: any, userId: string): Promise<void> {
    return this.publishClientEvent({
      eventType: ClientEventType.CLIENT_UPDATED,
      clientId,
      userId,
      timestamp: new Date(),
      metadata: {
        changes,
      },
    });
  }

  async publishClientStatusChanged(
    clientId: string, 
    oldStatus: string, 
    newStatus: string, 
    userId: string
  ): Promise<void> {
    return this.publishClientEvent({
      eventType: ClientEventType.CLIENT_STATUS_CHANGED,
      clientId,
      userId,
      timestamp: new Date(),
      metadata: {
        oldStatus,
        newStatus,
      },
    });
  }

  async publishContractCreated(
    contractId: string,
    clientId: string,
    contractData: any,
    userId: string
  ): Promise<void> {
    return this.publishClientEvent({
      eventType: ClientEventType.CONTRACT_CREATED,
      clientId,
      userId,
      timestamp: new Date(),
      metadata: {
        contractId,
        contractNumber: contractData.contractNumber,
        type: contractData.type,
        value: contractData.totalValue,
        startDate: contractData.startDate,
        endDate: contractData.endDate,
      },
    });
  }

  async publishAuditScheduled(
    auditId: string,
    clientId: string,
    auditData: any,
    userId: string
  ): Promise<void> {
    return this.publishClientEvent({
      eventType: ClientEventType.AUDIT_SCHEDULED,
      clientId,
      userId,
      timestamp: new Date(),
      metadata: {
        auditId,
        auditType: auditData.type,
        framework: auditData.framework,
        scheduledStartDate: auditData.scheduledStartDate,
        scheduledEndDate: auditData.scheduledEndDate,
      },
    });
  }
}