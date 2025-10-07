/**
 * Email Service Configuration
 * Development: MailDev for local testing
 * Production: SendGrid API integration
 */

export interface EmailConfig {
  provider: 'maildev' | 'sendgrid' | 'smtp';
  from: {
    email: string;
    name: string;
  };

  // SMTP Configuration (MailDev)
  smtp?: {
    host: string;
    port: number;
    secure: boolean;
    auth?: {
      user: string;
      pass: string;
    };
  };

  // SendGrid Configuration
  sendgrid?: {
    apiKey: string;
    templateIds?: {
      welcome: string;
      passwordReset: string;
      emailVerification: string;
      mfaSetup: string;
      auditCompleted: string;
      controlTestReminder: string;
      evidenceRequested: string;
    };
    webhookSecret?: string;
  };

  // Retry configuration
  retry: {
    attempts: number;
    backoff: {
      type: 'exponential' | 'fixed';
      delay: number;
    };
  };

  // Rate limiting
  rateLimit?: {
    perSecond: number;
    perMinute: number;
    perHour: number;
  };
}

export const emailConfig = (): EmailConfig => {
  const isDevelopment = process.env.NODE_ENV === 'development';

  if (isDevelopment) {
    return {
      provider: 'maildev',
      from: {
        email: process.env.EMAIL_FROM || 'noreply@soc-compliance.local',
        name: process.env.EMAIL_FROM_NAME || 'SOC Compliance Platform (Dev)',
      },
      smtp: {
        host: process.env.SMTP_HOST || 'localhost',
        port: parseInt(process.env.SMTP_PORT || '1025', 10),
        secure: false,
      },
      retry: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      },
    };
  }

  // Production configuration
  return {
    provider: 'sendgrid',
    from: {
      email: process.env.EMAIL_FROM || 'noreply@soc-compliance.com',
      name: process.env.EMAIL_FROM_NAME || 'SOC Compliance Platform',
    },
    sendgrid: {
      apiKey: process.env.SENDGRID_API_KEY || '',
      templateIds: {
        welcome: process.env.SENDGRID_TEMPLATE_WELCOME || '',
        passwordReset: process.env.SENDGRID_TEMPLATE_PASSWORD_RESET || '',
        emailVerification: process.env.SENDGRID_TEMPLATE_EMAIL_VERIFICATION || '',
        mfaSetup: process.env.SENDGRID_TEMPLATE_MFA_SETUP || '',
        auditCompleted: process.env.SENDGRID_TEMPLATE_AUDIT_COMPLETED || '',
        controlTestReminder: process.env.SENDGRID_TEMPLATE_CONTROL_REMINDER || '',
        evidenceRequested: process.env.SENDGRID_TEMPLATE_EVIDENCE_REQUEST || '',
      },
      webhookSecret: process.env.SENDGRID_WEBHOOK_SECRET,
    },
    retry: {
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    },
    rateLimit: {
      perSecond: 10,
      perMinute: 300,
      perHour: 5000,
    },
  };
};

export default emailConfig;
