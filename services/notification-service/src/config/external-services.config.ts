import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as SendGrid from '@sendgrid/mail';
import * as nodemailer from 'nodemailer';

export interface EmailServiceConfig {
  provider: 'smtp' | 'sendgrid';
  from: {
    email: string;
    name: string;
  };
  smtp?: {
    host: string;
    port: number;
    secure: boolean;
    auth?: {
      user: string;
      pass: string;
    };
  };
  sendgrid?: {
    apiKey: string;
    templateIds: Record<string, string>;
  };
  retry: {
    attempts: number;
    backoff: {
      type: 'exponential' | 'fixed';
      delay: number;
    };
  };
}

@Injectable()
export class ExternalServicesConfig {
  constructor(private configService: ConfigService) {}

  get email(): EmailServiceConfig {
    const provider = this.configService.get('NODE_ENV') === 'production' ? 'sendgrid' : 'smtp';

    return {
      provider,
      from: {
        email: this.configService.get('smtp.from') || 'noreply@soc-compliance.com',
        name: this.configService.get('smtp.fromName') || 'SOC Compliance Platform',
      },
      smtp:
        provider === 'smtp'
          ? {
              host: this.configService.get('smtp.host'),
              port: this.configService.get('smtp.port'),
              secure: this.configService.get('smtp.secure'),
              auth: this.configService.get('smtp.auth.user')
                ? {
                    user: this.configService.get('smtp.auth.user'),
                    pass: this.configService.get('smtp.auth.pass'),
                  }
                : undefined,
            }
          : undefined,
      sendgrid:
        provider === 'sendgrid'
          ? {
              apiKey: this.configService.get('SENDGRID_API_KEY'),
              templateIds: {
                welcome: this.configService.get('SENDGRID_TEMPLATE_WELCOME'),
                passwordReset: this.configService.get('SENDGRID_TEMPLATE_PASSWORD_RESET'),
                emailVerification: this.configService.get('SENDGRID_TEMPLATE_EMAIL_VERIFICATION'),
                mfaSetup: this.configService.get('SENDGRID_TEMPLATE_MFA_SETUP'),
                auditCompleted: this.configService.get('SENDGRID_TEMPLATE_AUDIT_COMPLETED'),
                controlTestReminder: this.configService.get('SENDGRID_TEMPLATE_CONTROL_REMINDER'),
                evidenceRequested: this.configService.get('SENDGRID_TEMPLATE_EVIDENCE_REQUEST'),
              },
            }
          : undefined,
      retry: {
        attempts: provider === 'sendgrid' ? 5 : 3,
        backoff: {
          type: 'exponential',
          delay: provider === 'sendgrid' ? 2000 : 1000,
        },
      },
    };
  }

  createEmailTransporter() {
    const emailConfig = this.email;

    if (emailConfig.provider === 'smtp') {
      return nodemailer.createTransport({
        host: emailConfig.smtp.host,
        port: emailConfig.smtp.port,
        secure: emailConfig.smtp.secure,
        auth: emailConfig.smtp.auth,
        tls: {
          rejectUnauthorized: false, // For development with MailDev
        },
      });
    }

    // SendGrid
    SendGrid.setApiKey(emailConfig.sendgrid.apiKey);
    return SendGrid;
  }
}
