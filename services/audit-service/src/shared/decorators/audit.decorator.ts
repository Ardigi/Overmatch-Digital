import { SetMetadata } from '@nestjs/common';
import {
  AuditAction,
  AuditResource,
  AuditSeverity,
} from '../../modules/audit-trail/entities/audit-entry.entity';
import { AUDIT_METADATA_KEY, type AuditMetadata } from '../interceptors/audit-logging.interceptor';

export const Audit = (metadata: AuditMetadata) => SetMetadata(AUDIT_METADATA_KEY, metadata);

// Convenience decorators for common audit scenarios
export const AuditCreate = (resource: AuditResource, description?: string) =>
  Audit({
    action: AuditAction.CREATE,
    resource,
    severity: AuditSeverity.INFO,
    description,
  });

export const AuditRead = (resource: AuditResource, description?: string) =>
  Audit({
    action: AuditAction.READ,
    resource,
    severity: AuditSeverity.INFO,
    description,
  });

export const AuditUpdate = (resource: AuditResource, description?: string) =>
  Audit({
    action: AuditAction.UPDATE,
    resource,
    severity: AuditSeverity.MEDIUM,
    description,
  });

export const AuditDelete = (resource: AuditResource, description?: string) =>
  Audit({
    action: AuditAction.DELETE,
    resource,
    severity: AuditSeverity.HIGH,
    description,
  });

export const AuditApprove = (resource: AuditResource, description?: string) =>
  Audit({
    action: AuditAction.APPROVE,
    resource,
    severity: AuditSeverity.MEDIUM,
    description,
  });

export const AuditReject = (resource: AuditResource, description?: string) =>
  Audit({
    action: AuditAction.REJECT,
    resource,
    severity: AuditSeverity.MEDIUM,
    description,
  });

export const AuditExport = (resource: AuditResource, description?: string) =>
  Audit({
    action: AuditAction.EXPORT,
    resource,
    severity: AuditSeverity.MEDIUM,
    description,
  });

export const AuditImport = (resource: AuditResource, description?: string) =>
  Audit({
    action: AuditAction.IMPORT,
    resource,
    severity: AuditSeverity.MEDIUM,
    description,
  });

export const AuditLogin = () =>
  Audit({
    action: AuditAction.LOGIN,
    resource: AuditResource.USER,
    severity: AuditSeverity.INFO,
    description: 'User login',
  });

export const AuditLogout = () =>
  Audit({
    action: AuditAction.LOGOUT,
    resource: AuditResource.USER,
    severity: AuditSeverity.INFO,
    description: 'User logout',
  });

export const SkipAudit = () =>
  Audit({
    skipAudit: true,
  });
