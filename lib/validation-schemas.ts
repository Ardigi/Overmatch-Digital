import { z } from 'zod';

// Security-focused string validators
const noSQLInjection = z
  .string()
  .refine(
    (val) =>
      !/(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|OR\s+\d+\s*=\s*\d+|AND\s+\d+\s*=\s*\d+|WHERE|FROM|--|\/\*|\*\/|xp_|sp_)/i.test(
        val
      ),
    { message: 'Invalid characters detected' }
  );

const noScriptTags = z
  .string()
  .refine(
    (val) =>
      !/<script|<\/script|javascript:|on\w+\s*=|<iframe|<object|<embed|<link|<meta|<style|alert\s*\(|confirm\s*\(|prompt\s*\(/i.test(
        val
      ),
    { message: 'Invalid content detected' }
  );

const noPathTraversal = z
  .string()
  .refine((val) => !/(\.\.\/|\.\.\\|%2e%2e%2f|%2e%2e\/|\.\.%2f|%2e%2e%5c)/i.test(val), {
    message: 'Invalid path characters',
  });

// Email validation with additional security checks
const secureEmail = z
  .string()
  .email()
  .max(255)
  .transform((v) => v.toLowerCase().trim())
  .refine((val) => !/(\.\.|--|\/\/|\\\\)/i.test(val), { message: 'Invalid email format' });

// Password validation
export const passwordSchema = z
  .string()
  .min(12, 'Password must be at least 12 characters')
  .max(128, 'Password must be less than 128 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character')
  .refine(
    (val) => {
      // Check against common passwords
      const commonPasswords = ['password123', 'admin123', 'letmein123', 'welcome123'];
      return !commonPasswords.some((common) => val.toLowerCase().includes(common));
    },
    { message: 'Password is too common' }
  );

// User schemas
export const userRegistrationSchema = z.object({
  email: secureEmail,
  password: passwordSchema,
  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name must be less than 100 characters')
    .regex(/^[a-zA-Z\s\-']+$/, 'Name contains invalid characters')
    .pipe(noScriptTags),
  organizationName: z
    .string()
    .min(1, 'Organization name is required')
    .max(255, 'Organization name must be less than 255 characters')
    .pipe(noScriptTags)
    .pipe(noSQLInjection),
});

export const userLoginSchema = z.object({
  email: secureEmail,
  password: z.string().min(1).max(128),
  mfaToken: z
    .string()
    .regex(/^\d{6}$/)
    .optional(),
});

// API request schemas
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().max(10000).default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z
    .string()
    .regex(/^[a-zA-Z_]+$/)
    .max(50)
    .optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const searchSchema = z.object({
  query: z
    .string()
    .max(200)
    .transform((v) => v.trim())
    .pipe(noSQLInjection)
    .pipe(noScriptTags),
  filters: z
    .record(z.string().max(50), z.union([z.string().max(100), z.number(), z.boolean()]))
    .optional(),
});

// File upload validation
export const fileUploadSchema = z.object({
  filename: z
    .string()
    .max(255)
    .regex(/^[a-zA-Z0-9._\-\s]+$/, 'Invalid filename')
    .pipe(noPathTraversal)
    .refine(
      (name) => {
        const ext = name.split('.').pop()?.toLowerCase();
        const allowedExtensions = [
          'pdf',
          'doc',
          'docx',
          'xls',
          'xlsx',
          'csv',
          'txt',
          'png',
          'jpg',
          'jpeg',
        ];
        return ext && allowedExtensions.includes(ext);
      },
      { message: 'File type not allowed' }
    ),
  size: z
    .number()
    .positive()
    .max(10 * 1024 * 1024, 'File size must be less than 10MB'),
  mimeType: z.enum([
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
    'text/plain',
    'image/png',
    'image/jpeg',
  ]),
});

// Client management schemas
export const clientSchema = z.object({
  name: z
    .string()
    .min(1, 'Client name is required')
    .max(255)
    .pipe(noScriptTags)
    .pipe(noSQLInjection),
  contactEmail: secureEmail,
  contactPhone: z
    .string()
    .regex(/^[\d\s\-+()]+$/, 'Invalid phone number')
    .max(20)
    .optional(),
  address: z.string().max(500).pipe(noScriptTags).optional(),
  status: z.enum(['active', 'inactive', 'pending']).default('active'),
});

// Policy schemas
export const policySchema = z.object({
  title: z.string().min(1, 'Policy title is required').max(255).pipe(noScriptTags),
  content: z.string().min(1, 'Policy content is required').max(50000).pipe(noScriptTags),
  category: z
    .string()
    .max(100)
    .regex(/^[a-zA-Z\s-]+$/, 'Invalid category'),
  version: z.string().regex(/^\d+\.\d+(\.\d+)?$/, 'Invalid version format'),
});

// Risk assessment schemas
export const riskSchema = z.object({
  title: z.string().min(1, 'Risk title is required').max(255).pipe(noScriptTags),
  description: z.string().max(5000).pipe(noScriptTags),
  likelihood: z.enum(['rare', 'unlikely', 'possible', 'likely', 'certain']),
  impact: z.enum(['negligible', 'minor', 'moderate', 'major', 'catastrophic']),
  treatmentPlan: z.string().max(5000).pipe(noScriptTags).optional(),
});

// Export request schema
export const exportRequestSchema = z.object({
  format: z.enum(['csv', 'xlsx', 'pdf', 'json']),
  type: z.enum(['clients', 'policies', 'risks', 'audit-logs', 'reports']),
  dateRange: z
    .object({
      start: z.string().datetime().optional(),
      end: z.string().datetime().optional(),
    })
    .optional(),
  filters: z.record(z.string(), z.any()).optional(),
});

// ID validation for params
export const idParamSchema = z.object({
  id: z
    .string()
    .regex(/^[a-zA-Z0-9\-_]+$/, 'Invalid ID format')
    .max(50),
});

// Date range validation
export const dateRangeSchema = z
  .object({
    startDate: z.string().datetime(),
    endDate: z.string().datetime(),
  })
  .refine((data) => new Date(data.startDate) <= new Date(data.endDate), {
    message: 'Start date must be before end date',
  });

// Settings update schema
export const settingsUpdateSchema = z.object({
  companyName: z.string().max(255).pipe(noScriptTags).optional(),
  timezone: z
    .string()
    .regex(/^[A-Za-z_/]+$/)
    .optional(),
  dateFormat: z.enum(['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD']).optional(),
  twoFactorRequired: z.boolean().optional(),
  sessionTimeout: z.number().min(5).max(480).optional(), // minutes
  passwordPolicy: z
    .object({
      minLength: z.number().min(8).max(32),
      requireUppercase: z.boolean(),
      requireLowercase: z.boolean(),
      requireNumbers: z.boolean(),
      requireSpecialChars: z.boolean(),
      expiryDays: z.number().min(0).max(365).optional(),
    })
    .optional(),
});
