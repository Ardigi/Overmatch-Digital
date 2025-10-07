import { DataClassificationLevel } from '../../../shared/types/tenant.types';

/**
 * Decorator to mark fields for automatic encryption
 * Used with TypeORM entities for field-level encryption
 */
export function EncryptedField(
  classification: DataClassificationLevel = DataClassificationLevel.CONFIDENTIAL
) {
  return function (target: any, propertyKey: string) {
    // Store metadata about encrypted fields
    const encryptedFields = Reflect.getMetadata('encrypted_fields', target) || [];
    encryptedFields.push({
      propertyKey,
      classification,
    });
    Reflect.defineMetadata('encrypted_fields', encryptedFields, target);
  };
}

/**
 * Get all encrypted fields for an entity
 */
export function getEncryptedFields(target: any): Array<{
  propertyKey: string;
  classification: DataClassificationLevel;
}> {
  return Reflect.getMetadata('encrypted_fields', target) || [];
}