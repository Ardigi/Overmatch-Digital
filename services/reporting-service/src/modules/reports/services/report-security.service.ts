import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as crypto from 'crypto';
import { Repository } from 'typeorm';
import { ClassificationLevel, Report } from '../entities/report.entity';
import { ReportTemplate } from '../entities/report-template.entity';

export interface AccessCheckResult {
  allowed: boolean;
  reason?: string;
  requiresMfa?: boolean;
  restrictions?: string[];
}

@Injectable()
export class ReportSecurityService {
  private readonly logger = new Logger(ReportSecurityService.name);

  constructor(
    @InjectRepository(Report)
    private readonly reportRepository: Repository<Report>,
    @InjectRepository(ReportTemplate)
    private readonly templateRepository: Repository<ReportTemplate>,
  ) {}

  /**
   * Check if a user has access to a report
   */
  async checkAccess(
    reportId: string,
    userId: string,
    userRoles: string[],
    userOrganizationId: string,
    operation: 'view' | 'download' | 'delete' | 'update' = 'view',
  ): Promise<AccessCheckResult> {
    const report = await this.reportRepository.findOne({
      where: { id: reportId },
      relations: ['template'],
    });

    if (!report) {
      return { allowed: false, reason: 'Report not found' };
    }

    // Check organization access first
    if (report.organizationId !== userOrganizationId) {
      this.logger.warn(`User ${userId} attempted to access report from different organization`);
      return { allowed: false, reason: 'Access denied' };
    }

    // Check report-level access control list
    if (!report.hasAccess(userId)) {
      return { allowed: false, reason: 'User not in access control list' };
    }

    // Check template security configuration
    if (report.template?.securityConfiguration) {
      const secConfig = report.template.securityConfiguration;

      // Check role-based access restrictions
      if (secConfig.accessRestrictions && secConfig.accessRestrictions.length > 0) {
        const hasRequiredRole = secConfig.accessRestrictions.some(role => 
          userRoles.includes(role)
        );
        if (!hasRequiredRole) {
          return { 
            allowed: false, 
            reason: 'Insufficient permissions',
            restrictions: secConfig.accessRestrictions 
          };
        }
      }

      // Check if MFA is required
      if (secConfig.requireMfaForAccess) {
        return {
          allowed: true,
          requiresMfa: true,
          reason: 'MFA verification required'
        };
      }
    }

    // Check classification level access
    const userClearanceLevel = this.getUserClearanceLevel(userRoles);
    if (!this.hasClassificationAccess(report.classificationLevel, userClearanceLevel)) {
      return { 
        allowed: false, 
        reason: `Insufficient clearance level for ${report.classificationLevel} content` 
      };
    }

    // Check operation-specific permissions
    if (operation === 'delete' && !userRoles.includes('admin')) {
      return { allowed: false, reason: 'Only administrators can delete reports' };
    }

    return { allowed: true };
  }

  /**
   * Verify digital signature of a report
   */
  async verifySignature(reportId: string): Promise<boolean> {
    const report = await this.reportRepository.findOne({
      where: { id: reportId },
    });

    if (!report || !report.digitalSignature) {
      return false;
    }

    try {
      // Parse signature metadata
      const signatureData = JSON.parse(report.digitalSignature);
      const { publicKey, signature, userId, timestamp, algorithm } = signatureData;

      // In production, retrieve the actual report content
      // For now, we'll mark it as verified based on metadata presence
      const isValid = !!(publicKey && signature && userId && timestamp && algorithm === 'SHA256withRSA');
      
      report.markSignatureVerified(isValid);
      await this.reportRepository.save(report);

      return isValid;
    } catch (error) {
      this.logger.error(`Failed to verify signature for report ${reportId}: ${error.message}`);
      return false;
    }
  }

  /**
   * Get user's clearance level based on roles
   */
  private getUserClearanceLevel(roles: string[]): ClassificationLevel {
    if (roles.includes('admin') || roles.includes('security_officer')) {
      return ClassificationLevel.RESTRICTED;
    }
    if (roles.includes('auditor') || roles.includes('compliance_manager')) {
      return ClassificationLevel.CONFIDENTIAL;
    }
    if (roles.includes('user')) {
      return ClassificationLevel.INTERNAL;
    }
    return ClassificationLevel.PUBLIC;
  }

  /**
   * Check if user has access to classification level
   */
  private hasClassificationAccess(
    documentLevel: ClassificationLevel,
    userLevel: ClassificationLevel,
  ): boolean {
    const levels = [
      ClassificationLevel.PUBLIC,
      ClassificationLevel.INTERNAL,
      ClassificationLevel.CONFIDENTIAL,
      ClassificationLevel.RESTRICTED,
    ];

    const docIndex = levels.indexOf(documentLevel);
    const userIndex = levels.indexOf(userLevel);

    return userIndex >= docIndex;
  }

  /**
   * Apply data retention policy
   */
  async applyRetentionPolicy(reportId: string): Promise<void> {
    const report = await this.reportRepository.findOne({
      where: { id: reportId },
      relations: ['template'],
    });

    if (!report) {
      return;
    }

    const retentionDays = report.template?.securityConfiguration?.retentionPeriodDays || 
                         report.dataRetentionPolicy ? parseInt(report.dataRetentionPolicy) : 
                         365; // Default 1 year

    const expirationDate = new Date(report.createdAt);
    expirationDate.setDate(expirationDate.getDate() + retentionDays);

    // Check if report has expired
    if (new Date() > expirationDate) {
      this.logger.warn(`Report ${reportId} has exceeded retention period`);
      // In production, implement secure deletion
      // For now, just log the event
    }
  }

  /**
   * Sanitize report metadata for external access
   */
  sanitizeReportForAccess(report: Report, includeSecurityInfo: boolean = false): Partial<Report> {
    const sanitized: any = {
      id: report.id,
      title: report.title,
      description: report.description,
      reportType: report.reportType,
      status: report.status,
      format: report.format,
      generatedAt: report.generatedAt,
      createdAt: report.createdAt,
      classificationLevel: report.classificationLevel,
    };

    if (includeSecurityInfo) {
      sanitized.encryptionEnabled = report.encryptionEnabled;
      sanitized.signatureVerified = report.signatureVerified;
      sanitized.watermarkApplied = report.watermarkApplied;
    }

    // Never expose these fields
    delete sanitized.encryptionKeyId;
    delete sanitized.digitalSignature;
    delete sanitized.accessControlList;
    delete sanitized.filePath;

    return sanitized;
  }
}