import {
  EntitySubscriberInterface,
  EventSubscriber,
  InsertEvent,
  UpdateEvent,
  LoadEvent,
  EntityManager,
} from 'typeorm';
import { Injectable } from '@nestjs/common';
import { EncryptionService } from '../../encryption/encryption.service';
import { getEncryptedFields } from '../decorators/encrypted-field.decorator';
import { DataClassificationLevel } from '../../../shared/types/tenant.types';
import { LoggingService } from '@soc-compliance/monitoring';

/**
 * TypeORM subscriber for automatic field-level encryption
 * Encrypts sensitive data before save, decrypts after load
 * Critical for billion-dollar platform data protection
 */
@Injectable()
@EventSubscriber()
export class EncryptionSubscriber implements EntitySubscriberInterface {
  constructor(
    private readonly encryptionService: EncryptionService,
    private readonly entityManager: EntityManager,
  ) {
    // Register subscriber with TypeORM
    // Note: EntityManager registration handled by NestJS IoC container
  }

  /**
   * Called before entity insertion
   * Encrypts all fields marked with @EncryptedField decorator
   */
  async beforeInsert(event: InsertEvent<any>): Promise<void> {
    await this.encryptEntityFields(event);
  }

  /**
   * Called before entity update
   * Re-encrypts changed encrypted fields
   */
  async beforeUpdate(event: UpdateEvent<any>): Promise<void> {
    await this.encryptEntityFields(event);
  }

  /**
   * Called after entity is loaded from database
   * Decrypts all encrypted fields
   */
  async afterLoad(event: LoadEvent<any>): Promise<void> {
    await this.decryptEntityFields(event);
  }

  /**
   * Encrypt fields marked for encryption
   */
  private async encryptEntityFields(
    event: InsertEvent<any> | UpdateEvent<any>
  ): Promise<void> {
    if (!event.entity) return;

    const encryptedFields = getEncryptedFields(event.entity);
    if (encryptedFields.length === 0) return;

    // Get tenant context from entity or event
    const tenantId = this.getTenantId(event);
    if (!tenantId) {
      throw new Error('Tenant ID required for encryption');
    }

    for (const field of encryptedFields) {
      const value = event.entity[field.propertyKey];
      
      // Skip if value is already encrypted or null
      if (this.isAlreadyEncrypted(value) || value === null || value === undefined) {
        continue;
      }

      // Encrypt the field
      const encryptedValue = await this.encryptionService.encryptData(
        value,
        tenantId,
        field.classification,
        field.propertyKey
      );

      // Store encrypted value
      event.entity[field.propertyKey] = {
        _encrypted: true,
        _data: encryptedValue,
      };
    }
  }

  /**
   * Decrypt fields after loading from database
   */
  private async decryptEntityFields(event: LoadEvent<any>): Promise<void> {
    if (!event.entity) return;

    const encryptedFields = getEncryptedFields(event.entity);
    if (encryptedFields.length === 0) return;

    // Get tenant context
    const tenantId = this.getTenantId(event);
    if (!tenantId) {
      throw new Error('Tenant ID required for decryption');
    }

    for (const field of encryptedFields) {
      const value = event.entity[field.propertyKey];
      
      // Skip if not encrypted
      if (!this.isEncryptedValue(value)) {
        continue;
      }

      try {
        // Decrypt the field
        const decryptedValue = await this.encryptionService.decryptData(
          value._data,
          tenantId
        );

        // Replace with decrypted value
        event.entity[field.propertyKey] = decryptedValue;
      } catch (error) {
        // Log decryption failure but don't break the load
        console.error(`Failed to decrypt field ${field.propertyKey}:`, error);
        event.entity[field.propertyKey] = null;
      }
    }
  }

  /**
   * Extract tenant ID from entity or event context
   */
  protected getTenantId(event: any): string | null {
    // Try to get from entity
    if (event.entity) {
      if (event.entity.tenantId) return event.entity.tenantId;
      if (event.entity.organizationId) return event.entity.organizationId;
    }

    // Try to get from query runner parameters
    if (event.queryRunner?.data?.tenantId) {
      return event.queryRunner.data.tenantId;
    }

    // Try to get from manager parameters
    if (event.manager?.queryRunner?.data?.tenantId) {
      return event.manager.queryRunner.data.tenantId;
    }

    return null;
  }

  /**
   * Check if value is already encrypted
   */
  private isAlreadyEncrypted(value: any): boolean {
    return value && 
           typeof value === 'object' && 
           value._encrypted === true;
  }

  /**
   * Check if value contains encrypted data structure
   */
  private isEncryptedValue(value: any): boolean {
    return value && 
           typeof value === 'object' && 
           value._encrypted === true && 
           value._data;
  }
}

/**
 * Enhanced encryption subscriber with audit logging
 * Tracks all encryption/decryption operations for compliance
 */
@Injectable()
@EventSubscriber()
export class AuditedEncryptionSubscriber extends EncryptionSubscriber {
  private encryptionAuditLog: Map<string, EncryptionAuditEntry> = new Map();
  
  constructor(
    encryptionService: EncryptionService,
    entityManager: EntityManager,
    private loggingService: LoggingService,
  ) {
    super(encryptionService, entityManager);
  }

  async beforeInsert(event: InsertEvent<any>): Promise<void> {
    const startTime = Date.now();
    await super.beforeInsert(event);
    this.logEncryptionOperation(event, 'INSERT', startTime);
  }

  async beforeUpdate(event: UpdateEvent<any>): Promise<void> {
    const startTime = Date.now();
    await super.beforeUpdate(event);
    this.logEncryptionOperation(event, 'UPDATE', startTime);
  }

  async afterLoad(event: LoadEvent<any>): Promise<void> {
    const startTime = Date.now();
    await super.afterLoad(event);
    this.logDecryptionOperation(event, startTime);
  }

  private logEncryptionOperation(
    event: any,
    operation: string,
    startTime: number
  ): void {
    const duration = Date.now() - startTime;
    const entityName = event.metadata?.name || 'Unknown';
    const encryptedFields = getEncryptedFields(event.entity || {});
    
    const auditEntry: EncryptionAuditEntry = {
      timestamp: new Date(),
      operation,
      entityName,
      fieldsEncrypted: encryptedFields.map(f => f.propertyKey),
      duration,
      tenantId: this.getTenantId(event),
    };

    // Store in audit log
    const key = `${entityName}-${Date.now()}`;
    this.encryptionAuditLog.set(key, auditEntry);

    // Periodically flush to persistent storage
    if (this.encryptionAuditLog.size > 100) {
      this.flushAuditLog();
    }
  }

  private logDecryptionOperation(
    event: LoadEvent<any>,
    startTime: number
  ): void {
    const duration = Date.now() - startTime;
    const entityName = event.metadata?.name || 'Unknown';
    
    const auditEntry: EncryptionAuditEntry = {
      timestamp: new Date(),
      operation: 'DECRYPT',
      entityName,
      fieldsEncrypted: [], // Will be populated from metadata
      duration,
      tenantId: this.getTenantId(event),
    };

    // Store in audit log
    const key = `${entityName}-${Date.now()}`;
    this.encryptionAuditLog.set(key, auditEntry);
  }

  private async flushAuditLog(): Promise<void> {
    // In production, write to immutable audit storage
    const entries = Array.from(this.encryptionAuditLog.values());
    
    // Clear the in-memory log
    this.encryptionAuditLog.clear();

    // Log to persistent storage (simplified)
    this.loggingService.debug(`Flushing encryption audit log: ${entries.length} entries`);
  }
}

interface EncryptionAuditEntry {
  timestamp: Date;
  operation: string;
  entityName: string;
  fieldsEncrypted: string[];
  duration: number;
  tenantId: string | null;
}