// Client Service - Main Entity Index
// Export all entities for TypeORM configuration (following Auth Service pattern)

// Audit-related entities
export { AuditTrail } from '../modules/audits/entities/audit-trail.entity';
// Client-related entities
export { Client } from '../modules/clients/entities/client.entity';
export { ClientAudit } from '../modules/clients/entities/client-audit.entity';
export { ClientDocument } from '../modules/clients/entities/client-document.entity';
export { ClientUser } from '../modules/clients/entities/client-user.entity';
// Contract-related entities
export { Contract } from '../modules/contracts/entities/contract.entity';
export { ContractLineItem } from '../modules/contracts/entities/contract-line-item.entity';
