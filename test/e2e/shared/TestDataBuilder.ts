import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

export class TestDataBuilder {
  // Auth test data
  async createAuthenticatedUser(overrides?: Partial<any>) {
    const user = TestDataBuilder.createTestUser(overrides);
    const token = jwt.sign(
      { sub: user.id, email: user.email },
      process.env.JWT_SECRET || 'test-jwt-secret',
      { expiresIn: '1h' }
    );

    return {
      user,
      token,
      userId: user.id,
      organizationId: user.organizationId || 'test-org-123',
    };
  }

  // User test data
  static createTestUser(overrides?: Partial<any>) {
    return {
      id: uuidv4(),
      email: `test-${Date.now()}@example.com`,
      password: 'TestPassword123!@#',
      firstName: 'Test',
      lastName: 'User',
      organizationId: 'test-org-123',
      isEmailVerified: true,
      mfaEnabled: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  static async createHashedPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }

  // Organization test data
  static createTestOrganization(overrides?: Partial<any>) {
    return {
      id: uuidv4(),
      name: `Test Organization ${Date.now()}`,
      domain: `test-${Date.now()}.com`,
      industry: 'Technology',
      size: 'medium',
      tier: 'premium',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  // Client test data
  static createTestClient(organizationId: string, overrides?: Partial<any>) {
    return {
      id: uuidv4(),
      organizationId,
      name: `Test Client ${Date.now()}`,
      type: 'enterprise',
      status: 'active',
      primaryContactName: 'John Doe',
      primaryContactEmail: `contact-${Date.now()}@example.com`,
      primaryContactPhone: '+1234567890',
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  // Framework test data
  static createTestFramework(overrides?: Partial<any>) {
    return {
      id: uuidv4(),
      name: 'SOC 2 Type II',
      version: '2017',
      description: 'Service Organization Control 2 Type II',
      isActive: true,
      metadata: {
        source: 'AICPA',
        categories: [
          'Security',
          'Availability',
          'Processing Integrity',
          'Confidentiality',
          'Privacy',
        ],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  // Policy test data
  static createTestPolicy(frameworkId: string, organizationId: string, overrides?: Partial<any>) {
    return {
      id: uuidv4(),
      frameworkId,
      organizationId,
      name: `Test Policy ${Date.now()}`,
      description: 'Test policy description',
      category: 'Security',
      status: 'active',
      content: {
        version: '1.0',
        sections: [
          {
            title: 'Purpose',
            content: 'This policy establishes requirements for testing.',
          },
        ],
      },
      metadata: {},
      effectiveDate: new Date(),
      reviewDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  // Control test data
  static createTestControl(frameworkId: string, categoryId: string, overrides?: Partial<any>) {
    const code = `TC-${Date.now()}`;
    return {
      id: uuidv4(),
      categoryId,
      frameworkId,
      code,
      name: `Test Control ${code}`,
      description: 'Test control description',
      type: 'preventive',
      frequency: 'quarterly',
      evidenceRequirements: ['Test evidence', 'Approval documentation'],
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  // Control category test data
  static createTestControlCategory(frameworkId: string, overrides?: Partial<any>) {
    return {
      id: uuidv4(),
      name: `Test Category ${Date.now()}`,
      description: 'Test category description',
      frameworkId,
      parentId: null,
      order: 1,
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  // Evidence test data
  static createTestEvidence(controlId: string, uploadedBy: string, overrides?: Partial<any>) {
    return {
      id: uuidv4(),
      controlId,
      type: 'document',
      name: `Test Evidence ${Date.now()}.pdf`,
      description: 'Test evidence description',
      fileUrl: `https://test-bucket.s3.amazonaws.com/evidence/${uuidv4()}.pdf`,
      fileSize: 1024 * 1024, // 1MB
      mimeType: 'application/pdf',
      uploadedBy,
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  // Workflow test data
  static createTestWorkflow(organizationId: string, overrides?: Partial<any>) {
    return {
      id: uuidv4(),
      name: `Test Workflow ${Date.now()}`,
      description: 'Test workflow description',
      type: 'evidence_collection',
      organizationId,
      isActive: true,
      steps: [
        {
          name: 'Upload Evidence',
          type: 'manual',
          description: 'Upload required evidence',
          config: {},
          sequence: 1,
          isRequired: true,
        },
        {
          name: 'Review Evidence',
          type: 'approval',
          description: 'Review uploaded evidence',
          config: { approvers: ['manager'] },
          sequence: 2,
          isRequired: true,
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  static createTestWorkflowInstance(workflowId: string, overrides?: Partial<any>) {
    return {
      id: uuidv4(),
      workflowId,
      status: 'pending',
      context: {
        initiatedBy: 'test-user',
        clientId: 'test-client-123',
      },
      priority: 'medium',
      startedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  // Notification test data
  static createTestNotificationTemplate(overrides?: Partial<any>) {
    return {
      id: `template-${Date.now()}`,
      name: `Test Template ${Date.now()}`,
      type: 'email',
      subject: 'Test Subject: {{variable}}',
      body: 'Test body with {{variable}}',
      variables: ['variable'],
      category: 'test',
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  static createTestNotification(userId: string, overrides?: Partial<any>) {
    return {
      id: uuidv4(),
      userId,
      templateId: 'welcome-email',
      channel: 'email',
      status: 'queued',
      data: {
        userName: 'Test User',
      },
      priority: 'medium',
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  static createTestUserPreferences(userId: string, overrides?: Partial<any>) {
    return {
      userId,
      email: `user-${userId}@example.com`,
      channels: {
        email: true,
        inApp: true,
        sms: false,
        push: false,
      },
      preferences: {
        controlAssigned: { email: true, inApp: true },
        evidenceDue: { email: true, inApp: true },
        reportGenerated: { email: false, inApp: true },
      },
      quietHours: {
        enabled: false,
        start: '22:00',
        end: '08:00',
        timezone: 'America/New_York',
      },
      ...overrides,
    };
  }

  // Reporting test data
  static createTestReportTemplate(overrides?: Partial<any>) {
    return {
      id: uuidv4(),
      name: `Test Report Template ${Date.now()}`,
      description: 'Test report template',
      type: 'compliance_summary',
      format: 'pdf',
      sections: [
        {
          name: 'Executive Summary',
          type: 'summary',
          required: true,
          template: 'Summary of {{organizationName}} compliance',
        },
        {
          name: 'Controls',
          type: 'controls',
          required: true,
          filters: { status: 'active' },
        },
      ],
      variables: ['organizationName', 'reportPeriod'],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  static createTestReport(templateId: string, organizationId: string, overrides?: Partial<any>) {
    return {
      id: uuidv4(),
      templateId,
      organizationId,
      name: `Test Report ${Date.now()}`,
      type: 'compliance_summary',
      status: 'draft',
      format: 'pdf',
      parameters: {
        organizationId,
        reportPeriod: {
          start: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
          end: new Date().toISOString(),
        },
      },
      createdBy: 'test-user-123',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  static createTestReportSchedule(templateId: string, overrides?: Partial<any>) {
    return {
      id: uuidv4(),
      templateId,
      name: `Test Schedule ${Date.now()}`,
      cronExpression: '0 0 * * 1', // Every Monday
      recipients: ['test@example.com'],
      isActive: true,
      parameters: {
        reportPeriod: 'last_week',
      },
      nextRun: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  // Audit test data
  static createTestAudit(organizationId: string, overrides?: Partial<any>) {
    const now = new Date();
    return {
      id: uuidv4(),
      organizationId,
      name: `Test Audit ${Date.now()}`,
      type: 'soc2_type2',
      scope: 'Full scope audit',
      status: 'planning',
      startDate: now.toISOString(),
      endDate: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      leadAuditor: 'auditor-123',
      team: ['auditor-456', 'auditor-789'],
      objectives: ['Verify control effectiveness', 'Test security controls'],
      createdAt: now,
      updatedAt: now,
      ...overrides,
    };
  }

  static createTestAuditFinding(auditId: string, overrides?: Partial<any>) {
    return {
      id: uuidv4(),
      auditId,
      title: `Test Finding ${Date.now()}`,
      description: 'Test finding description',
      severity: 'medium',
      status: 'open',
      controlId: 'control-123',
      category: 'access_control',
      impact: 'Potential security risk',
      recommendation: 'Implement additional controls',
      evidence: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  static createTestAuditEvidence(auditId: string, findingId: string, overrides?: Partial<any>) {
    return {
      id: uuidv4(),
      auditId,
      findingId,
      type: 'screenshot',
      description: 'Test evidence',
      filePath: '/evidence/test.png',
      collectedBy: 'auditor-123',
      collectedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  // Integration test data
  static createTestIntegrationProvider(overrides?: Partial<any>) {
    return {
      id: uuidv4(),
      name: `Test Provider ${Date.now()}`,
      type: 'issue_tracking',
      description: 'Test integration provider',
      configSchema: {
        type: 'object',
        properties: {
          url: { type: 'string' },
          apiKey: { type: 'string' },
        },
        required: ['url', 'apiKey'],
      },
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  static createTestIntegration(
    providerId: string,
    organizationId: string,
    overrides?: Partial<any>
  ) {
    return {
      id: uuidv4(),
      providerId,
      organizationId,
      name: `Test Integration ${Date.now()}`,
      status: 'inactive',
      config: {
        url: 'https://test.example.com',
        apiKey: 'test-api-key',
      },
      enabledEvents: ['issue.created', 'issue.updated'],
      lastSync: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  static createTestWebhook(integrationId: string, overrides?: Partial<any>) {
    return {
      id: uuidv4(),
      integrationId,
      eventType: 'control.updated',
      url: 'https://api.example.com/webhook',
      secret: `webhook-secret-${Date.now()}`,
      isActive: true,
      headers: {},
      retryPolicy: {
        maxAttempts: 3,
        backoffMultiplier: 2,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  static createTestSyncJob(integrationId: string, overrides?: Partial<any>) {
    return {
      id: uuidv4(),
      integrationId,
      type: 'full',
      status: 'queued',
      startedAt: null,
      completedAt: null,
      recordsSynced: 0,
      errors: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  // AI test data
  static createTestAIModel(overrides?: Partial<any>) {
    return {
      id: uuidv4(),
      name: `Test Model ${Date.now()}`,
      type: 'risk_assessment',
      version: '1.0.0',
      status: 'active',
      accuracy: 0.85,
      config: {
        threshold: 0.7,
        features: ['control_count', 'evidence_age'],
      },
      performanceMetrics: {
        avgExecutionTime: 1200,
        totalPredictions: 1000,
        lastUpdated: new Date(),
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  static createTestAIAnalysis(modelId: string, overrides?: Partial<any>) {
    return {
      id: uuidv4(),
      modelId,
      type: 'risk_assessment',
      status: 'processing',
      input: {
        organizationId: 'test-org-123',
        controlIds: ['control-1', 'control-2'],
      },
      output: null,
      executionTime: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  static createTestAIInsight(organizationId: string, overrides?: Partial<any>) {
    return {
      id: uuidv4(),
      organizationId,
      type: 'risk',
      severity: 'high',
      description: 'High risk detected in access control',
      recommendations: ['Review access permissions', 'Implement MFA for all users'],
      confidence: 0.92,
      relatedControls: ['control-123', 'control-456'],
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  // API Key test data
  static createTestApiKey(userId: string, overrides?: Partial<any>) {
    return {
      id: uuidv4(),
      userId,
      name: `Test API Key ${Date.now()}`,
      key: `test_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      lastUsedAt: null,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  // Helper method to create a complete test scenario
  static async createCompleteTestScenario() {
    const organization = TestDataBuilder.createTestOrganization();
    const user = TestDataBuilder.createTestUser({ organizationId: organization.id });
    const hashedPassword = await TestDataBuilder.createHashedPassword(user.password);
    const framework = TestDataBuilder.createTestFramework();
    const category = TestDataBuilder.createTestControlCategory(framework.id);
    const control = TestDataBuilder.createTestControl(framework.id, category.id);
    const client = TestDataBuilder.createTestClient(organization.id);
    const policy = TestDataBuilder.createTestPolicy(framework.id, organization.id);

    // Service-specific test data
    const workflow = TestDataBuilder.createTestWorkflow(organization.id);
    const notificationTemplate = TestDataBuilder.createTestNotificationTemplate();
    const reportTemplate = TestDataBuilder.createTestReportTemplate();
    const audit = TestDataBuilder.createTestAudit(organization.id);
    const integrationProvider = TestDataBuilder.createTestIntegrationProvider();
    const integration = TestDataBuilder.createTestIntegration(
      integrationProvider.id,
      organization.id
    );
    const aiModel = TestDataBuilder.createTestAIModel();
    const apiKey = TestDataBuilder.createTestApiKey(user.id);

    return {
      organization,
      user: { ...user, password: hashedPassword },
      framework,
      category,
      control,
      client,
      policy,
      workflow,
      notificationTemplate,
      reportTemplate,
      audit,
      integrationProvider,
      integration,
      aiModel,
      apiKey,
      rawPassword: 'TestPassword123!@#',
    };
  }
}
