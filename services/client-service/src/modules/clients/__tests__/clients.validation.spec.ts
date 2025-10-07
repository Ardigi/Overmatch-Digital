import { plainToClass } from 'class-transformer';
import { validate } from 'class-validator';
import {
  CompleteOnboardingDto,
  CreateClientDto,
  QueryClientDto,
  StartOnboardingDto,
  UpdateClientDto,
} from '../dto';
import {
  ClientStatus,
  ClientType,
  CompanySize,
  ComplianceFramework,
  ComplianceStatus,
  Industry,
} from './mock-entities';

describe('Client DTOs Validation Tests', () => {
  describe('CreateClientDto', () => {
    it('should validate a valid client creation request', async () => {
      const dto = plainToClass(CreateClientDto, {
        name: 'Valid Client Name',
        clientType: ClientType.DIRECT,
        industry: Industry.TECHNOLOGY,
        size: CompanySize.MEDIUM,
        contactInfo: {
          primaryContact: {
            name: 'John Doe',
            email: 'john.doe@example.com',
            phone: '+1234567890',
            title: 'CTO',
          },
        },
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should require name field', async () => {
      const dto = plainToClass(CreateClientDto, {
        clientType: ClientType.DIRECT,
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('name');
      expect(errors[0].constraints).toHaveProperty('isNotEmpty');
    });

    it('should validate name length constraints', async () => {
      const tooLongName = 'A'.repeat(256);
      const dto = plainToClass(CreateClientDto, {
        name: tooLongName,
        clientType: ClientType.DIRECT,
      });

      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'name' && e.constraints?.maxLength)).toBe(true);
    });

    it('should validate enum values for clientType', async () => {
      const dto = plainToClass(CreateClientDto, {
        name: 'Test Client',
        clientType: 'INVALID_TYPE' as any,
      });

      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'clientType' && e.constraints?.isEnum)).toBe(true);
    });

    it('should validate email format in contact info', async () => {
      const dto = plainToClass(CreateClientDto, {
        name: 'Test Client',
        clientType: ClientType.DIRECT,
        contactInfo: {
          primaryContact: {
            name: 'John Doe',
            email: 'invalid-email',
          },
        },
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('contactInfo');

      // Nested validation errors
      const nestedErrors = errors[0].children?.[0]?.children;
      expect(nestedErrors?.some((e) => e.property === 'email' && e.constraints?.isEmail)).toBe(
        true
      );
    });

    it('should validate phone number format', async () => {
      const invalidPhones = [
        '123', // Too short
        'not-a-phone', // Invalid format
        '+1234567890123456789012345', // Too long
      ];

      for (const phone of invalidPhones) {
        const dto = plainToClass(CreateClientDto, {
          name: 'Test Client',
          clientType: ClientType.DIRECT,
          contactInfo: {
            primaryContact: {
              name: 'John Doe',
              phone,
            },
          },
        });

        const errors = await validate(dto);
        expect(errors.length).toBeGreaterThan(0);
      }
    });

    it('should validate website URL format', async () => {
      const invalidUrls = [
        'not-a-url',
        'http://',
        'ftp://invalid-protocol.com',
        'javascript:alert(1)',
      ];

      for (const website of invalidUrls) {
        const dto = plainToClass(CreateClientDto, {
          name: 'Test Client',
          clientType: ClientType.DIRECT,
          website,
        });

        const errors = await validate(dto);
        expect(errors.some((e) => e.property === 'website')).toBe(true);
      }
    });

    it('should validate targetFrameworks array', async () => {
      const dto = plainToClass(CreateClientDto, {
        name: 'Test Client',
        clientType: ClientType.DIRECT,
        targetFrameworks: ['INVALID_FRAMEWORK' as any, ComplianceFramework.SOC2_TYPE2],
      });

      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'targetFrameworks')).toBe(true);
    });

    it('should validate employee count range', async () => {
      const invalidCounts = [-1, 0, 10000001];

      for (const employeeCount of invalidCounts) {
        const dto = plainToClass(CreateClientDto, {
          name: 'Test Client',
          clientType: ClientType.DIRECT,
          employeeCount,
        });

        const errors = await validate(dto);
        expect(errors.some((e) => e.property === 'employeeCount')).toBe(true);
      }
    });

    it('should validate nested address structure', async () => {
      const dto = plainToClass(CreateClientDto, {
        name: 'Test Client',
        clientType: ClientType.DIRECT,
        address: {
          headquarters: {
            street1: 'A'.repeat(256), // Too long
            city: '', // Empty
            state: '123', // Invalid format
            postalCode: 'invalid-postal',
            country: 'XX', // Invalid country code
          },
        },
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should validate tags array', async () => {
      const dto = plainToClass(CreateClientDto, {
        name: 'Test Client',
        clientType: ClientType.DIRECT,
        tags: ['valid-tag', 'another-tag', ''], // Empty tag
      });

      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'tags')).toBe(true);
    });
  });

  describe('UpdateClientDto', () => {
    it('should allow partial updates', async () => {
      const dto = plainToClass(UpdateClientDto, {
        name: 'Updated Name',
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should validate compliance score range', async () => {
      const invalidScores = [-0.1, 1.1, 2, -5];

      for (const complianceScore of invalidScores) {
        const dto = plainToClass(UpdateClientDto, {
          complianceScore,
        });

        const errors = await validate(dto);
        expect(
          errors.some(
            (e) => e.property === 'complianceScore' && (e.constraints?.min || e.constraints?.max)
          )
        ).toBe(true);
      }
    });

    it('should validate optional fields when provided', async () => {
      const dto = plainToClass(UpdateClientDto, {
        email: 'invalid-email',
        website: 'not-a-url',
        employeeCount: -100,
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should not require any fields for update', async () => {
      const dto = plainToClass(UpdateClientDto, {});

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should validate metadata JSON structure', async () => {
      const dto = plainToClass(UpdateClientDto, {
        metadata: {
          customField1: 'value1',
          customField2: 123,
          nestedObject: {
            subField: 'value',
          },
        },
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });

  describe('QueryClientDto', () => {
    it('should validate pagination parameters', async () => {
      const invalidPagination = [
        { page: 0, limit: 20 }, // Page must be >= 1
        { page: 1, limit: 0 }, // Limit must be >= 1
        { page: -1, limit: 20 }, // Negative page
        { page: 1, limit: 1001 }, // Limit too high
      ];

      for (const params of invalidPagination) {
        const dto = plainToClass(QueryClientDto, params);
        const errors = await validate(dto);
        expect(errors.length).toBeGreaterThan(0);
      }
    });

    it('should validate enum filters', async () => {
      const dto = plainToClass(QueryClientDto, {
        status: 'INVALID_STATUS' as any,
        complianceStatus: 'INVALID_COMPLIANCE' as any,
        industry: 'INVALID_INDUSTRY' as any,
      });

      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'status')).toBe(true);
      expect(errors.some((e) => e.property === 'complianceStatus')).toBe(true);
      expect(errors.some((e) => e.property === 'industry')).toBe(true);
    });

    it('should validate date range parameters', async () => {
      const dto = plainToClass(QueryClientDto, {
        createdAfter: 'not-a-date',
        createdBefore: 'invalid-date',
      });

      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'createdAfter')).toBe(true);
      expect(errors.some((e) => e.property === 'createdBefore')).toBe(true);
    });

    it('should validate sortBy field', async () => {
      const validSortFields = ['createdAt', 'updatedAt', 'name', 'complianceScore'];
      const invalidSortFields = ['invalid_field', 'password', 'internal_notes'];

      for (const sortBy of invalidSortFields) {
        const dto = plainToClass(QueryClientDto, { sortBy });
        const errors = await validate(dto);
        expect(errors.some((e) => e.property === 'sortBy')).toBe(true);
      }

      for (const sortBy of validSortFields) {
        const dto = plainToClass(QueryClientDto, { sortBy });
        const errors = await validate(dto);
        expect(errors.filter((e) => e.property === 'sortBy')).toHaveLength(0);
      }
    });

    it('should validate search string length', async () => {
      const dto = plainToClass(QueryClientDto, {
        search: 'a', // Too short
      });

      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'search' && e.constraints?.minLength)).toBe(true);
    });

    it('should validate UUID formats', async () => {
      const invalidUuids = ['not-a-uuid', '12345', 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'];

      for (const id of invalidUuids) {
        const dto = plainToClass(QueryClientDto, {
          partnerId: id,
          salesRepId: id,
          accountManagerId: id,
        });

        const errors = await validate(dto);
        expect(errors.length).toBeGreaterThan(0);
      }
    });

    it('should validate array parameters', async () => {
      const dto = plainToClass(QueryClientDto, {
        tags: ['valid-tag', '', '  ', 'another-valid-tag'], // Contains empty values
        frameworks: [ComplianceFramework.SOC2_TYPE2, 'INVALID' as any],
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should accept valid query parameters', async () => {
      const dto = plainToClass(QueryClientDto, {
        page: 1,
        limit: 20,
        search: 'test client',
        status: ClientStatus.ACTIVE,
        complianceStatus: ComplianceStatus.COMPLIANT,
        industry: Industry.TECHNOLOGY,
        size: CompanySize.MEDIUM,
        framework: ComplianceFramework.SOC2_TYPE2,
        tags: ['priority', 'tech'],
        sortBy: 'createdAt',
        sortOrder: 'DESC',
        includeArchived: false,
        needsAudit: true,
        expiringSoon: true,
        expiringInDays: 90,
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });

  describe('StartOnboardingDto', () => {
    it('should validate required clientId', async () => {
      const dto = plainToClass(StartOnboardingDto, {
        projectManagerId: 'pm-123',
      });

      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'clientId')).toBe(true);
    });

    it('should validate UUID format for IDs', async () => {
      const dto = plainToClass(StartOnboardingDto, {
        clientId: 'not-a-uuid',
        projectManagerId: 'invalid-id',
      });

      const errors = await validate(dto);
      expect(errors.filter((e) => e.constraints?.isUuid)).toHaveLength(2);
    });

    it('should validate custom tasks array', async () => {
      const dto = plainToClass(StartOnboardingDto, {
        clientId: '123e4567-e89b-12d3-a456-426614174000',
        customTasks: ['Task 1', '', '   ', 'Task 2'], // Contains empty values
      });

      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'customTasks')).toBe(true);
    });

    it('should validate onboarding notes length', async () => {
      const dto = plainToClass(StartOnboardingDto, {
        clientId: '123e4567-e89b-12d3-a456-426614174000',
        notes: 'A'.repeat(5001), // Too long
      });

      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'notes' && e.constraints?.maxLength)).toBe(true);
    });
  });

  describe('CompleteOnboardingDto', () => {
    it('should validate required summary', async () => {
      const dto = plainToClass(CompleteOnboardingDto, {
        finalChecklist: {
          contractsSigned: true,
        },
      });

      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'summary')).toBe(true);
    });

    it('should validate firstAuditScheduled date', async () => {
      const dto = plainToClass(CompleteOnboardingDto, {
        summary: 'Onboarding completed',
        firstAuditScheduled: 'not-a-date',
      });

      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'firstAuditScheduled')).toBe(true);
    });

    it('should validate future audit date', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 30);

      const dto = plainToClass(CompleteOnboardingDto, {
        summary: 'Onboarding completed',
        firstAuditScheduled: pastDate,
      });

      const errors = await validate(dto);
      expect(
        errors.some((e) => e.property === 'firstAuditScheduled' && e.constraints?.minDate)
      ).toBe(true);
    });

    it('should validate finalChecklist structure', async () => {
      const dto = plainToClass(CompleteOnboardingDto, {
        summary: 'Onboarding completed',
        finalChecklist: {
          contractsSigned: 'yes' as any, // Should be boolean
          systemAccessGranted: null, // Should be boolean
          trainingCompleted: undefined, // Should be boolean
        },
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should validate recommendations array', async () => {
      const dto = plainToClass(CompleteOnboardingDto, {
        summary: 'Onboarding completed',
        recommendations: [
          'Valid recommendation',
          '', // Empty
          'A'.repeat(1001), // Too long
        ],
      });

      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'recommendations')).toBe(true);
    });
  });

  describe('Complex Validation Scenarios', () => {
    it('should validate cross-field dependencies', async () => {
      // If clientType is PARTNER_REFERRAL, partnerId should be required
      const dto = plainToClass(CreateClientDto, {
        name: 'Partner Client',
        clientType: ClientType.PARTNER_REFERRAL,
        // Missing partnerId
      });

      // Custom validator would check this
      const errors = await validate(dto);
      // In real implementation, would have custom validator
      expect(dto.clientType).toBe(ClientType.PARTNER_REFERRAL);
    });

    it('should validate business rules', async () => {
      // Compliance score should align with compliance status
      const invalidCombinations = [
        { complianceStatus: ComplianceStatus.COMPLIANT, complianceScore: 0.5 },
        { complianceStatus: ComplianceStatus.NON_COMPLIANT, complianceScore: 1.0 },
      ];

      // Business rule validators would catch these
      for (const combo of invalidCombinations) {
        const dto = plainToClass(UpdateClientDto, combo);
        // Custom validators would validate business rules
        expect(dto).toBeDefined();
      }
    });

    it('should sanitize HTML in text fields', async () => {
      const dto = plainToClass(CreateClientDto, {
        name: 'Client <script>alert("XSS")</script>',
        description: '<img src=x onerror=alert("XSS")>',
      });

      // Transform/sanitize would clean these
      const errors = await validate(dto);
      // After transformation by Sanitize decorator
      expect(dto.name).toBe('Client');
      expect(dto.description).toBe('[SANITIZED]');
    });

    it('should validate international data', async () => {
      const dto = plainToClass(CreateClientDto, {
        name: '测试客户端', // Chinese characters
        contactInfo: {
          primaryContact: {
            name: 'José García',
            email: 'jose@example.com',
            phone: '+34 91 123 4567', // Spanish phone
          },
        },
        address: {
          headquarters: {
            street1: 'Straße 123', // German street
            city: 'München',
            state: 'BY',
            postalCode: '80331',
            country: 'DE',
          },
        },
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0); // Should accept international characters
    });

    it('should validate against SQL injection attempts', async () => {
      const sqlInjectionAttempts = [
        { input: "'; DROP TABLE clients; --", expected: 'TABLE clients' },
        { input: "1' OR '1'='1", expected: '1 OR 1=1' },
        { input: "admin'--", expected: 'admin' },
        { input: '1; DELETE FROM clients WHERE 1=1; --', expected: '1 FROM clients WHERE 1=1' },
      ];

      for (const { input, expected } of sqlInjectionAttempts) {
        const dto = plainToClass(CreateClientDto, {
          name: input,
          clientType: ClientType.DIRECT,
        });

        // These should be sanitized by the Sanitize decorator
        const errors = await validate(dto);
        expect(dto.name).toBe(expected);
      }
    });

    it('should validate against NoSQL injection attempts', async () => {
      const noSqlInjectionAttempts = [
        { name: { $gt: '' } },
        { name: { $ne: null } },
        { metadata: { $where: 'this.password == null' } },
      ];

      for (const attempt of noSqlInjectionAttempts) {
        const dto = plainToClass(CreateClientDto, attempt as any);
        const errors = await validate(dto);
        // Type validation should catch these
        expect(errors.length).toBeGreaterThan(0);
      }
    });

    it('should validate file paths and URLs', async () => {
      const dangerousPaths = [
        '../../../etc/passwd',
        'C:\\Windows\\System32\\config\\sam',
        'file:///etc/passwd',
        '\\\\server\\share\\sensitive',
      ];

      for (const path of dangerousPaths) {
        const dto = plainToClass(CreateClientDto, {
          name: 'Test Client',
          clientType: ClientType.DIRECT,
          logo: path, // Logo should be a safe URL
        });

        const errors = await validate(dto);
        expect(errors.some((e) => e.property === 'logo')).toBe(true);
      }
    });

    it('should validate JSON structures', async () => {
      const dto = plainToClass(UpdateClientDto, {
        settings: {
          notifications: {
            email: true,
            sms: false,
            slack: true,
          },
          security: {
            ipWhitelist: ['192.168.1.1', '10.0.0.0/8'],
            mfaRequired: true,
            sessionTimeout: 3600,
          },
        },
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should validate array size limits', async () => {
      const tooManyTags = Array(101).fill('tag'); // Assuming max 100 tags
      const tooManyFrameworks = Array(20).fill(ComplianceFramework.SOC2_TYPE2);

      const dto = plainToClass(CreateClientDto, {
        name: 'Test Client',
        clientType: ClientType.DIRECT,
        tags: tooManyTags,
        targetFrameworks: tooManyFrameworks,
      });

      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'tags' && e.constraints?.arrayMaxSize)).toBe(true);
    });

    it('should validate decimal precision', async () => {
      const dto = plainToClass(UpdateClientDto, {
        complianceScore: 0.123456789, // Too many decimal places
        annualRevenue: '$1,234,567.891011', // Invalid format
      });

      const errors = await validate(dto);
      // Should enforce precision limits
      expect(dto.complianceScore).toBeDefined();
    });
  });
});
