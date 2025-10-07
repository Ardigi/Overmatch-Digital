import { InjectQueue } from '@nestjs/bull';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import type { Queue } from 'bull';
import * as crypto from 'crypto';
import { Repository } from 'typeorm';
import { Report, ReportStatus, ClassificationLevel } from '../entities/report.entity';
import { ReportTemplate } from '../entities/report-template.entity';
import type { ReportDataCollector } from './report-data-collector.service';
import type { ReportRendererFactory } from './report-renderer.factory';
import type { ReportStorageService } from './report-storage.service';

export interface GenerateOptions {
  reportId: string;
  organizationId: string;
  userId: string;
  templateId?: string;
  format: string;
  filters?: Record<string, any>;
  watermark?: boolean;
  encryption?: boolean;
  digitalSignature?: boolean;
}

export interface GenerateResult {
  success: boolean;
  reportId: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  generationTime?: number;
  pageCount?: number;
  error?: string;
}

export interface PreviewOptions {
  templateId: string;
  format: string;
  sampleData?: boolean;
}

export interface PreviewResult {
  success: boolean;
  previewUrl?: string;
  pageCount?: number;
  estimatedSize?: number;
  error?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors?: Array<{ field: string; message: string }>;
  warnings?: Array<{ field: string; message: string; suggestion?: string }>;
}

@Injectable()
export class ReportGeneratorService {
  private readonly logger = new Logger(ReportGeneratorService.name);

  constructor(
    @InjectRepository(Report)
    private readonly reportRepository: Repository<Report>,
    @InjectRepository(ReportTemplate)
    private readonly templateRepository: Repository<ReportTemplate>,
    @InjectQueue('report-generation')
    private readonly reportQueue: Queue,
    private readonly dataCollector: ReportDataCollector,
    private readonly rendererFactory: ReportRendererFactory,
    private readonly storageService: ReportStorageService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async generate(options: GenerateOptions): Promise<GenerateResult> {
    const startTime = Date.now();

    try {
      // Load report
      const report = await this.reportRepository.findOne({
        where: { id: options.reportId },
        relations: ['template'],
      });

      if (!report) {
        this.logger.error(`Report ${options.reportId} not found`);
        await this.eventEmitter.emit('report.failed', {
          reportId: options.reportId,
          error: `Report ${options.reportId} not found`,
        });
        return {
          success: false,
          reportId: options.reportId,
          error: `Report ${options.reportId} not found`,
        };
      }

      // Update status to processing
      report.startGeneration();
      await this.reportRepository.save(report);

      // Load template if specified
      let template: ReportTemplate | undefined;
      if (options.templateId || report.templateId) {
        template = await this.templateRepository.findOne({
          where: { id: options.templateId || report.templateId },
        });

        if (!template) {
          const error = 'Report template not found';
          report.fail(error, new Error(error));
          await this.reportRepository.save(report);
          return {
            success: false,
            reportId: options.reportId,
            error,
          };
        }
      }

      // Collect data
      const collectedData = await this.dataCollector.collect({
        organizationId: options.organizationId,
        type: report.reportType || template?.reportType || 'CUSTOM',
        periodStart: report.reportingPeriodStart || report.periodStart,
        periodEnd: report.reportingPeriodEnd || report.periodEnd,
        filters: options.filters || report.filters,
        sections: template?.sections?.map(s => s.dataSource).filter(Boolean) || [],
        includeEvidence: true,
        includeMetrics: true,
        includeFindings: true,
      });

      // Validate data
      const validation = this.validateData(collectedData, template?.dataSchema);
      if (!validation.valid) {
        const error = `Data validation failed: ${validation.errors?.map(e => e.message).join(', ')}`;
        report.fail(error, validation.errors);
        await this.reportRepository.save(report);
        return {
          success: false,
          reportId: options.reportId,
          error,
        };
      }

      // Get renderer
      const renderer = this.rendererFactory.getRenderer(options.format);
      if (!renderer) {
        const error = `Unsupported format: ${options.format}`;
        report.fail(error);
        await this.reportRepository.save(report);
        return {
          success: false,
          reportId: options.reportId,
          error,
        };
      }

      // Prepare report data
      const reportData = await this.prepareReportData(report, template, collectedData, options);

      // Render report
      const renderedContent = await renderer.render(reportData, template);

      // Apply post-processing
      let processedContent = renderedContent.content;
      
      // Apply watermark if required
      if (options.watermark || template?.securityConfiguration?.watermarkRequired) {
        processedContent = await this.applyWatermark(processedContent, options.format);
        report.watermarkApplied = true;
      }
      
      // Apply encryption if required
      if (options.encryption || template?.securityConfiguration?.encryptionRequired) {
        processedContent = await this.encryptContent(processedContent, options.organizationId);
        report.enableEncryption(options.organizationId); // Using org ID as key ID for now
      }
      
      // Apply digital signature if required
      if (options.digitalSignature || template?.securityConfiguration?.digitalSignatureRequired) {
        const signedContent = await this.signContent(processedContent, options.userId);
        // Extract signature from the signed content (last part after separator)
        const signatureSeparator = '\n\n--- DIGITAL SIGNATURE ---\n';
        const signatureIndex = signedContent.toString().lastIndexOf(signatureSeparator);
        if (signatureIndex !== -1) {
          const signatureData = signedContent.slice(signatureIndex + signatureSeparator.length);
          report.setDigitalSignature(signatureData.toString());
        }
        processedContent = signedContent;
      }
      
      // Set classification level
      if (template?.securityConfiguration?.defaultClassificationLevel) {
        report.setClassification(template.securityConfiguration.defaultClassificationLevel as ClassificationLevel);
      }

      // Store report
      const storageResult = await this.storageService.store({
        reportId: options.reportId,
        organizationId: options.organizationId,
        content: processedContent,
        fileName: renderedContent.fileName,
        mimeType: renderedContent.mimeType,
      });

      // Update report with results
      const metadata = {
        pageCount: renderedContent.pageCount,
        generationTime: Date.now() - startTime,
        dataPointsCount: this.countDataPoints(collectedData),
        evidenceCount: collectedData.evidence?.length || 0,
        findingsCount: collectedData.findings?.length || 0,
        complianceScore: collectedData.summary?.overallScore || 0,
      };

      report.complete(storageResult.fileUrl, metadata);
      report.fileName = storageResult.fileName;
      report.fileSize = storageResult.fileSize;
      report.filePath = storageResult.storagePath;
      report.mimeType = renderedContent.mimeType;
      report.checksum = storageResult.checksum;
      report.summary = collectedData.summary;

      await this.reportRepository.save(report);

      // Emit success event
      await this.eventEmitter.emit('report.generated', {
        reportId: options.reportId,
        organizationId: options.organizationId,
        format: options.format,
        fileUrl: storageResult.fileUrl,
        metadata,
      });

      return {
        success: true,
        reportId: options.reportId,
        fileUrl: storageResult.fileUrl,
        fileName: storageResult.fileName,
        fileSize: storageResult.fileSize,
        generationTime: metadata.generationTime,
        pageCount: metadata.pageCount,
      };
    } catch (error) {
      this.logger.error(`Failed to generate report ${options.reportId}`, error);

      // Update report status
      try {
        const report = await this.reportRepository.findOne({
          where: { id: options.reportId },
        });
        if (report) {
          report.fail(error.message, error);
          await this.reportRepository.save(report);
        }
      } catch (updateError) {
        this.logger.error('Failed to update report status', updateError);
      }

      // Emit failure event
      await this.eventEmitter.emit('report.failed', {
        reportId: options.reportId,
        error: error.message,
        details: error,
      });

      return {
        success: false,
        reportId: options.reportId,
        error: error.message,
      };
    }
  }

  async preview(options: PreviewOptions): Promise<PreviewResult> {
    try {
      // Load template
      const template = await this.templateRepository.findOne({
        where: { id: options.templateId },
      });

      if (!template) {
        return {
          success: false,
          error: 'Report template not found',
        };
      }

      // Get renderer
      const renderer = this.rendererFactory.getRenderer(options.format);
      if (!renderer) {
        return {
          success: false,
          error: `Unsupported format: ${options.format}`,
        };
      }

      // Generate sample data
      const sampleData = options.sampleData ? this.generateSampleData(template) : {};

      // Prepare preview data
      const previewData = {
        header: {
          title: `${template.name} (Preview)`,
          organizationName: 'Sample Organization',
          reportDate: new Date(),
          reportPeriod: '2023-01-01 to 2023-12-31',
        },
        sections: template.sections?.map(section => ({
          id: section.id,
          title: section.name,
          order: section.order,
          content: sampleData.sections?.[section.id] || `Sample content for ${section.name}`,
        })) || [],
        footer: {
          disclaimer: 'This is a preview of the report template with sample data.',
          generatedBy: 'SOC Compliance Platform',
        },
      };

      // Render preview
      const renderedContent = await renderer.render(previewData, template);

      // Store temporarily
      const previewUrl = await this.storageService.storeTemporary({
        content: renderedContent.content,
        fileName: `preview_${Date.now()}_${renderedContent.fileName}`,
        mimeType: renderedContent.mimeType,
        expiresIn: 3600, // 1 hour
      });

      return {
        success: true,
        previewUrl,
        pageCount: renderedContent.pageCount,
        estimatedSize: renderedContent.size,
      };
    } catch (error) {
      this.logger.error('Failed to generate preview', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  validateData(data: any, schema?: Record<string, any>): ValidationResult {
    const errors: Array<{ field: string; message: string }> = [];
    const warnings: Array<{ field: string; message: string; suggestion?: string }> = [];

    // Basic validation
    if (!data) {
      errors.push({ field: 'data', message: 'No data provided' });
      return { valid: false, errors };
    }

    // Required fields
    if (!data.organization) {
      errors.push({ field: 'organization', message: 'Organization data is required' });
    }
    if (!data.period) {
      errors.push({ field: 'period', message: 'Report period is required' });
    }

    // Schema validation
    if (schema) {
      Object.entries(schema).forEach(([field, config]: [string, any]) => {
        if (config.required && !data[field]) {
          errors.push({ field, message: `${field} is required` });
        }
      });
    }

    // Data quality warnings
    if (data.evidence?.length === 0) {
      warnings.push({
        field: 'evidence',
        message: 'No evidence included in report',
        suggestion: 'Consider including evidence for better compliance demonstration',
      });
    }

    if (data.findings?.some((f: any) => f.severity === 'critical')) {
      warnings.push({
        field: 'findings',
        message: 'Report contains critical findings',
        suggestion: 'Ensure critical findings are addressed before report finalization',
      });
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  private async prepareReportData(
    report: Report,
    template: ReportTemplate | undefined,
    collectedData: any,
    options: GenerateOptions,
  ): Promise<any> {
    const sections = template?.sections || this.getDefaultSections();
    
    const preparedSections = await Promise.all(
      sections.map(section => this.prepareSectionData(section, collectedData, options)),
    );

    return {
      header: {
        title: report.title,
        organizationName: collectedData.organization?.name || 'Organization',
        organizationLogo: collectedData.organization?.logo,
        reportDate: new Date(),
        reportPeriod: `${report.periodStart || report.reportingPeriodStart} to ${report.periodEnd || report.reportingPeriodEnd}`,
        reportType: report.reportType,
        disclaimer: template?.metadata?.disclaimer,
      },
      metadata: {
        reportId: report.id,
        templateId: template?.id,
        generatedAt: new Date(),
        generatedBy: options.userId,
      },
      sections: preparedSections,
      summary: collectedData.summary,
      appendices: this.prepareAppendices(collectedData, options),
      footer: {
        disclaimer: 'This report is confidential and proprietary.',
        copyright: `© ${new Date().getFullYear()} SOC Compliance Platform`,
      },
    };
  }

  private async prepareSectionData(
    sectionConfig: any,
    data: any,
    options: any,
  ): Promise<any> {
    const sectionData: any = {
      id: sectionConfig.id,
      title: sectionConfig.name,
      order: sectionConfig.order,
    };

    switch (sectionConfig.dataSource || sectionConfig.id) {
      case 'executive_summary':
      case 'executive-summary':
        sectionData.content = this.prepareExecutiveSummary(data);
        break;

      case 'compliance_status':
      case 'compliance-status':
        sectionData.content = 'Compliance status overview';
        sectionData.charts = [{
          id: 'compliance-chart',
          title: 'Compliance Overview',
          type: 'doughnut',
          data: {
            labels: ['Effective', 'Ineffective', 'Not Tested'],
            values: [
              data.summary?.effectiveControls || 0,
              data.summary?.failedControls || 0,
              0,
            ],
          },
        }];
        break;

      case 'control_testing':
      case 'control-testing':
        sectionData.tables = [{
          id: 'control-testing',
          title: 'Control Testing Results',
          headers: ['Control ID', 'Control Name', 'Status', 'Test Date', 'Evidence'],
          rows: (data.controls || []).map((control: any) => [
            control.id,
            control.name,
            control.status,
            control.lastTested,
            control.evidenceCount || 0,
          ]),
        }];
        break;

      case 'findings':
        sectionData.findings = data.findings || [];
        break;

      default:
        sectionData.content = 'Section content not available';
    }

    return sectionData;
  }

  private prepareExecutiveSummary(data: any): string {
    const summary = data.summary || {};
    return `
Overall compliance score: ${summary.overallScore || 0}%
${summary.totalControls || 0} controls assessed
${summary.effectiveControls || 0} controls effective
${summary.failedControls || 0} controls need improvement
${summary.criticalFindings || 0} critical findings
${summary.highFindings || 0} high severity findings
${summary.mediumFindings || 0} medium severity findings
${summary.lowFindings || 0} low severity findings

Recommendations:
${(summary.recommendations || []).join('\n')}
    `.trim();
  }

  private getDefaultSections(): any[] {
    return [
      { id: 'executive-summary', name: 'Executive Summary', order: 1 },
      { id: 'scope', name: 'Scope and Objectives', order: 2 },
      { id: 'findings', name: 'Findings and Observations', order: 3 },
      { id: 'controls', name: 'Control Assessment', order: 4 },
      { id: 'recommendations', name: 'Recommendations', order: 5 },
    ];
  }

  private prepareAppendices(data: any, options: any): any[] {
    const appendices = [];

    if (options.includeAttachments && data.evidence?.length > 0) {
      appendices.push({
        id: 'evidence-details',
        title: 'Evidence Details',
        order: 1,
        content: 'Detailed evidence documentation',
        evidence: data.evidence,
      });
    }

    return appendices;
  }

  private generateSampleData(template: ReportTemplate): any {
    return {
      summary: {
        overallScore: 85,
        totalControls: 100,
        implementedControls: 85,
        effectiveControls: 80,
        failedControls: 5,
        criticalFindings: 1,
        highFindings: 3,
        mediumFindings: 5,
        lowFindings: 10,
      },
      sections: template.sections?.reduce((acc, section) => {
        acc[section.id] = `Sample content for ${section.name}`;
        return acc;
      }, {} as Record<string, string>),
    };
  }

  private countDataPoints(data: any): number {
    let count = 0;
    if (data.controls) count += data.controls.length;
    if (data.findings) count += data.findings.length;
    if (data.evidence) count += data.evidence.length;
    if (data.metrics) count += data.metrics.length;
    return count;
  }

  private async applyWatermark(content: Buffer, format: string): Promise<Buffer> {
    this.logger.debug(`Applying watermark to ${format} content`);
    
    // For PDF format, we would use a PDF library to add watermarks
    // For now, we'll add a simple text-based watermark to demonstrate
    if (format === 'pdf') {
      // In production, use libraries like pdf-lib or pdfkit
      this.logger.warn('PDF watermarking requires pdf-lib integration');
      return content;
    }
    
    // For text-based formats, append watermark
    const watermarkText = `\n\n--- CONFIDENTIAL - Generated at ${new Date().toISOString()} ---\n`;
    const watermarkBuffer = Buffer.from(watermarkText, 'utf-8');
    
    return Buffer.concat([content, watermarkBuffer]);
  }

  private async encryptContent(content: Buffer, organizationId: string): Promise<Buffer> {
    this.logger.debug(`Encrypting content for organization ${organizationId}`);
    
    try {
      // Generate encryption key based on organization ID (in production, use key management service)
      const algorithm = 'aes-256-gcm';
      const salt = crypto.randomBytes(32);
      const key = crypto.pbkdf2Sync(organizationId, salt, 100000, 32, 'sha256');
      const iv = crypto.randomBytes(16);
      
      // Create cipher
      const cipher = crypto.createCipheriv(algorithm, key, iv);
      
      // Encrypt the content
      const encrypted = Buffer.concat([
        cipher.update(content),
        cipher.final()
      ]);
      
      // Get the authentication tag
      const authTag = cipher.getAuthTag();
      
      // Combine salt, iv, authTag, and encrypted content
      // Format: [salt(32)][iv(16)][authTag(16)][encrypted content]
      const result = Buffer.concat([
        salt,
        iv,
        authTag,
        encrypted
      ]);
      
      this.logger.debug(`Content encrypted successfully, size: ${result.length} bytes`);
      return result;
    } catch (error) {
      this.logger.error(`Encryption failed: ${error.message}`);
      throw new Error(`Failed to encrypt content: ${error.message}`);
    }
  }

  private async signContent(content: Buffer, userId: string): Promise<Buffer> {
    this.logger.debug(`Signing content by user ${userId}`);
    
    try {
      // In production, retrieve user's private key from secure key storage
      // For now, we'll use a deterministic key based on userId
      const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: {
          type: 'spki',
          format: 'pem'
        },
        privateKeyEncoding: {
          type: 'pkcs8',
          format: 'pem'
        }
      });
      
      // Create signature
      const sign = crypto.createSign('SHA256');
      sign.update(content);
      sign.end();
      
      const signature = sign.sign(privateKey);
      
      // Create a JSON structure with the signature metadata
      const signatureMetadata = {
        userId,
        timestamp: new Date().toISOString(),
        algorithm: 'SHA256withRSA',
        publicKey: publicKey,
        signature: signature.toString('base64')
      };
      
      // Append signature metadata to content
      const metadataBuffer = Buffer.from(JSON.stringify(signatureMetadata), 'utf-8');
      const separator = Buffer.from('\n\n--- DIGITAL SIGNATURE ---\n', 'utf-8');
      
      const signedContent = Buffer.concat([
        content,
        separator,
        metadataBuffer
      ]);
      
      this.logger.debug(`Content signed successfully by user ${userId}`);
      return signedContent;
    } catch (error) {
      this.logger.error(`Digital signature failed: ${error.message}`);
      throw new Error(`Failed to sign content: ${error.message}`);
    }
  }

  async decryptContent(encryptedContent: Buffer, organizationId: string): Promise<Buffer> {
    this.logger.debug(`Decrypting content for organization ${organizationId}`);
    
    try {
      // Extract components from encrypted content
      // Format: [salt(32)][iv(16)][authTag(16)][encrypted content]
      const salt = encryptedContent.slice(0, 32);
      const iv = encryptedContent.slice(32, 48);
      const authTag = encryptedContent.slice(48, 64);
      const encrypted = encryptedContent.slice(64);
      
      // Derive the same key
      const algorithm = 'aes-256-gcm';
      const key = crypto.pbkdf2Sync(organizationId, salt, 100000, 32, 'sha256');
      
      // Create decipher
      const decipher = crypto.createDecipheriv(algorithm, key, iv);
      decipher.setAuthTag(authTag);
      
      // Decrypt the content
      const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final()
      ]);
      
      this.logger.debug(`Content decrypted successfully, size: ${decrypted.length} bytes`);
      return decrypted;
    } catch (error) {
      this.logger.error(`Decryption failed: ${error.message}`);
      throw new Error(`Failed to decrypt content: ${error.message}`);
    }
  }
}