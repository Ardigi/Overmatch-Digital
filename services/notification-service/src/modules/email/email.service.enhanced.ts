import { InjectQueue } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as SendGrid from '@sendgrid/mail';
import { MailDataRequired } from '@sendgrid/mail';
import type { Queue } from 'bull';
import type * as nodemailer from 'nodemailer';
import type { ExternalServicesConfig } from '../../config/external-services.config';

interface EmailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  templateId?: string;
  templateData?: Record<string, any>;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
}

interface CircuitBreakerState {
  failures: number;
  lastFailureTime: number;
  state: 'closed' | 'open' | 'half-open';
}

@Injectable()
export class EnhancedEmailService {
  private readonly logger = new Logger(EnhancedEmailService.name);
  private transporter: nodemailer.Transporter | typeof SendGrid;
  private circuitBreaker: CircuitBreakerState = {
    failures: 0,
    lastFailureTime: 0,
    state: 'closed'
  };
  
  private readonly CIRCUIT_BREAKER_THRESHOLD = 5;
  private readonly CIRCUIT_BREAKER_TIMEOUT = 60000; // 1 minute
  private readonly MAX_RETRY_ATTEMPTS = 3;
  private readonly RETRY_DELAY = 1000;

  constructor(
    private configService: ConfigService,
    private externalConfig: ExternalServicesConfig,
    @InjectQueue('email') private emailQueue: Queue
  ) {
    this.initializeTransporter();
  }

  private initializeTransporter() {
    try {
      this.transporter = this.externalConfig.createEmailTransporter();
      this.logger.log(`Email service initialized with provider: ${this.externalConfig.email.provider}`);
    } catch (error) {
      this.logger.error('Failed to initialize email transporter', error);
      throw error;
    }
  }

  async sendEmail(options: EmailOptions): Promise<void> {
    // Check circuit breaker
    if (!this.canSendEmail()) {
      this.logger.warn('Circuit breaker is open, queueing email for later');
      await this.queueEmail(options);
      return;
    }

    try {
      await this.sendWithRetry(options);
      this.onSuccess();
    } catch (error) {
      this.onFailure();
      this.logger.error('Failed to send email after retries', error);
      
      // Queue for later retry
      await this.queueEmail(options);
      throw error;
    }
  }

  private async sendWithRetry(options: EmailOptions, attempt = 1): Promise<void> {
    try {
      if (this.externalConfig.email.provider === 'smtp') {
        await this.sendSmtpEmail(options);
      } else {
        await this.sendSendGridEmail(options);
      }
      
      this.logger.log(`Email sent successfully to ${options.to}`);
    } catch (error) {
      if (attempt < this.MAX_RETRY_ATTEMPTS) {
        const delay = this.RETRY_DELAY * 2 ** (attempt - 1);
        this.logger.warn(`Email send failed, retrying in ${delay}ms (attempt ${attempt}/${this.MAX_RETRY_ATTEMPTS})`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.sendWithRetry(options, attempt + 1);
      }
      
      throw error;
    }
  }

  private async sendSmtpEmail(options: EmailOptions): Promise<void> {
    const mailOptions: nodemailer.SendMailOptions = {
      from: `${this.externalConfig.email.from.name} <${this.externalConfig.email.from.email}>`,
      to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
      attachments: options.attachments?.map(att => ({
        filename: att.filename,
        content: att.content,
        contentType: att.contentType
      }))
    };

    const transporter = this.transporter as nodemailer.Transporter;
    await transporter.sendMail(mailOptions);
  }

  private async sendSendGridEmail(options: EmailOptions): Promise<void> {
    const msg: any = {
      from: {
        email: this.externalConfig.email.from.email,
        name: this.externalConfig.email.from.name
      },
      to: options.to,
      subject: options.subject
    };

    if (options.templateId && this.externalConfig.email.sendgrid?.templateIds) {
      msg.templateId = this.externalConfig.email.sendgrid.templateIds[options.templateId];
      msg.dynamicTemplateData = options.templateData;
    } else {
      // Set content array instead of html/text directly
      msg.content = [];
      if (options.text) {
        msg.content.push({ type: 'text/plain', value: options.text });
      }
      if (options.html) {
        msg.content.push({ type: 'text/html', value: options.html });
      }
    }

    if (options.attachments) {
      msg.attachments = options.attachments.map(att => ({
        filename: att.filename,
        content: att.content.toString('base64'),
        type: att.contentType
      }));
    }

    await SendGrid.send(msg);
  }

  private async queueEmail(options: EmailOptions): Promise<void> {
    await this.emailQueue.add('send-email', options, {
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 5000
      },
      removeOnComplete: true,
      removeOnFail: false
    });
  }

  // Circuit breaker methods
  private canSendEmail(): boolean {
    if (this.circuitBreaker.state === 'closed') {
      return true;
    }

    if (this.circuitBreaker.state === 'open') {
      const timeSinceLastFailure = Date.now() - this.circuitBreaker.lastFailureTime;
      
      if (timeSinceLastFailure > this.CIRCUIT_BREAKER_TIMEOUT) {
        this.circuitBreaker.state = 'half-open';
        this.logger.log('Circuit breaker transitioning to half-open state');
        return true;
      }
      
      return false;
    }

    // Half-open state
    return true;
  }

  private onSuccess(): void {
    if (this.circuitBreaker.state === 'half-open') {
      this.circuitBreaker.state = 'closed';
      this.circuitBreaker.failures = 0;
      this.logger.log('Circuit breaker closed after successful email');
    }
  }

  private onFailure(): void {
    this.circuitBreaker.failures++;
    this.circuitBreaker.lastFailureTime = Date.now();

    if (this.circuitBreaker.failures >= this.CIRCUIT_BREAKER_THRESHOLD) {
      this.circuitBreaker.state = 'open';
      this.logger.error('Circuit breaker opened due to repeated failures');
    }
  }

  // Template methods
  async sendWelcomeEmail(to: string, data: { name: string; verificationUrl: string }): Promise<void> {
    await this.sendEmail({
      to,
      subject: 'Welcome to SOC Compliance Platform',
      templateId: 'welcome',
      templateData: data,
      html: this.externalConfig.email.provider === 'smtp' ? 
        this.getWelcomeEmailHtml(data) : undefined
    });
  }

  async sendPasswordResetEmail(to: string, data: { name: string; resetUrl: string }): Promise<void> {
    await this.sendEmail({
      to,
      subject: 'Password Reset Request',
      templateId: 'passwordReset',
      templateData: data,
      html: this.externalConfig.email.provider === 'smtp' ? 
        this.getPasswordResetEmailHtml(data) : undefined
    });
  }

  async sendAuditCompletedEmail(to: string[], data: { 
    auditName: string; 
    completionDate: string; 
    reportUrl: string 
  }): Promise<void> {
    await this.sendEmail({
      to,
      subject: `Audit Completed: ${data.auditName}`,
      templateId: 'auditCompleted',
      templateData: data,
      html: this.externalConfig.email.provider === 'smtp' ? 
        this.getAuditCompletedEmailHtml(data) : undefined
    });
  }

  // HTML templates for SMTP
  private getWelcomeEmailHtml(data: { name: string; verificationUrl: string }): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #f8f9fa; padding: 20px; text-align: center; }
            .button { display: inline-block; padding: 12px 24px; background-color: #007bff; 
                     color: white; text-decoration: none; border-radius: 4px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to SOC Compliance Platform</h1>
            </div>
            <p>Hi ${data.name},</p>
            <p>Thank you for joining SOC Compliance Platform. We're excited to help you manage your compliance requirements.</p>
            <p>Please verify your email address by clicking the button below:</p>
            <p style="text-align: center;">
              <a href="${data.verificationUrl}" class="button">Verify Email</a>
            </p>
            <p>If you didn't create an account, please ignore this email.</p>
            <p>Best regards,<br>The SOC Compliance Team</p>
          </div>
        </body>
      </html>
    `;
  }

  private getPasswordResetEmailHtml(data: { name: string; resetUrl: string }): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #f8f9fa; padding: 20px; text-align: center; }
            .button { display: inline-block; padding: 12px 24px; background-color: #dc3545; 
                     color: white; text-decoration: none; border-radius: 4px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Password Reset Request</h1>
            </div>
            <p>Hi ${data.name},</p>
            <p>We received a request to reset your password. Click the button below to create a new password:</p>
            <p style="text-align: center;">
              <a href="${data.resetUrl}" class="button">Reset Password</a>
            </p>
            <p>This link will expire in 1 hour for security reasons.</p>
            <p>If you didn't request this, please ignore this email and your password will remain unchanged.</p>
            <p>Best regards,<br>The SOC Compliance Team</p>
          </div>
        </body>
      </html>
    `;
  }

  private getAuditCompletedEmailHtml(data: { 
    auditName: string; 
    completionDate: string; 
    reportUrl: string 
  }): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #28a745; color: white; padding: 20px; text-align: center; }
            .button { display: inline-block; padding: 12px 24px; background-color: #007bff; 
                     color: white; text-decoration: none; border-radius: 4px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Audit Completed Successfully</h1>
            </div>
            <p>The audit "${data.auditName}" has been completed on ${data.completionDate}.</p>
            <p>You can view and download the audit report by clicking the button below:</p>
            <p style="text-align: center;">
              <a href="${data.reportUrl}" class="button">View Report</a>
            </p>
            <p>Thank you for using SOC Compliance Platform.</p>
            <p>Best regards,<br>The SOC Compliance Team</p>
          </div>
        </body>
      </html>
    `;
  }

  // Health check
  async checkHealth(): Promise<{
    status: 'healthy' | 'unhealthy';
    provider: string;
    circuitBreaker: string;
    details?: any;
  }> {
    try {
      // Test connection based on provider
      if (this.externalConfig.email.provider === 'smtp') {
        const transporter = this.transporter as nodemailer.Transporter;
        await transporter.verify();
      }
      
      return {
        status: 'healthy',
        provider: this.externalConfig.email.provider,
        circuitBreaker: this.circuitBreaker.state,
        details: {
          failures: this.circuitBreaker.failures,
          lastFailure: this.circuitBreaker.lastFailureTime 
            ? new Date(this.circuitBreaker.lastFailureTime).toISOString() 
            : null
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        provider: this.externalConfig.email.provider,
        circuitBreaker: this.circuitBreaker.state,
        details: {
          error: error.message
        }
      };
    }
  }
}