// Policy Service Entities - Centralized exports for clean imports

// API Key entities
export { ApiKey } from '../modules/api-keys/entities/api-key.entity';
// Audit entities
export { AuditLog } from '../modules/audit/entities/audit-log.entity';
// Compliance mapping entities
export {
  ComplianceMapping,
  MappingStatus,
} from '../modules/compliance/entities/compliance-mapping.entity';
// Control entities
export {
  Control as ComplianceControl,
  ControlCategory,
  ControlPriority,
  EvidenceStatus,
  ImplementationStatus,
} from '../modules/compliance/entities/control.entity';
// Framework entities
export {
  ComplianceFramework,
  FrameworkStatus as ComplianceFrameworkStatus,
  FrameworkType as ComplianceFrameworkType,
} from '../modules/compliance/entities/framework.entity';
export { Control as LegacyControl } from '../modules/controls/entities/control.entity';
export {
  Framework,
  FrameworkStatus,
  FrameworkType,
} from '../modules/frameworks/entities/framework.entity';
// Policy entities
export {
  Policy,
  PolicyPriority,
  PolicyScope,
  PolicyStatus,
  PolicyType,
  WorkflowState,
} from '../modules/policies/entities/policy.entity';
// Risk entities
export { Risk } from '../modules/risks/entities/risk.entity';

import { ApiKey } from '../modules/api-keys/entities/api-key.entity';
import { AuditLog } from '../modules/audit/entities/audit-log.entity';
import { ComplianceMapping } from '../modules/compliance/entities/compliance-mapping.entity';
import { Control as ComplianceControlClass } from '../modules/compliance/entities/control.entity';
import { ComplianceFramework } from '../modules/compliance/entities/framework.entity';
import { Control as LegacyControlClass } from '../modules/controls/entities/control.entity';
import { Framework } from '../modules/frameworks/entities/framework.entity';
// Import all entities for array definitions
import { Policy } from '../modules/policies/entities/policy.entity';
import { Risk } from '../modules/risks/entities/risk.entity';

// Type definitions for common use cases
export type PolicyEntity = Policy;
export type ControlEntity = ComplianceControlClass;
export type FrameworkEntity = ComplianceFramework | Framework;
export type RiskEntity = Risk;
export type AuditLogEntity = AuditLog;
export type ApiKeyEntity = ApiKey;

// Entity arrays for TypeORM configuration
export const ALL_ENTITIES = [
  Policy,
  ComplianceControlClass,
  LegacyControlClass,
  ComplianceFramework,
  Framework,
  ComplianceMapping,
  Risk,
  AuditLog,
  ApiKey,
];

export const COMPLIANCE_ENTITIES = [ComplianceControlClass, ComplianceFramework, ComplianceMapping];

export const POLICY_ENTITIES = [Policy];

export const FRAMEWORK_ENTITIES = [ComplianceFramework, Framework];
