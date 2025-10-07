// Service-specific API client instances
// These clients automatically use the correct URLs based on environment

import { ApiClient } from './api-client';
import { apiConfig } from './config';
import type { ServiceEndpoints } from './config';

// Create service-specific clients for local development
// In local dev, each client connects directly to its service
// In production/Kong mode, all clients use the Kong gateway

// Use lazy initialization to avoid circular dependency issues
let _authClient: ApiClient | undefined;
let _clientServiceClient: ApiClient | undefined;
let _policyClient: ApiClient | undefined;
let _controlClient: ApiClient | undefined;
let _evidenceClient: ApiClient | undefined;
let _workflowClient: ApiClient | undefined;
let _reportingClient: ApiClient | undefined;
let _auditClient: ApiClient | undefined;
let _integrationClient: ApiClient | undefined;
let _notificationClient: ApiClient | undefined;
let _aiClient: ApiClient | undefined;

// Helper function to create client lazily
function createClient(service: keyof ServiceEndpoints): ApiClient {
  return new ApiClient({
    service: service,
    baseURL: apiConfig.useKong ? apiConfig.baseURL : undefined,
  });
}

// Export getters for lazy initialization
export function getAuthClient(): ApiClient {
  if (!_authClient) {
    _authClient = createClient('auth');
  }
  return _authClient;
}

export function getClientServiceClient(): ApiClient {
  if (!_clientServiceClient) {
    _clientServiceClient = createClient('client');
  }
  return _clientServiceClient;
}

export function getPolicyClient(): ApiClient {
  if (!_policyClient) {
    _policyClient = createClient('policy');
  }
  return _policyClient;
}

export function getControlClient(): ApiClient {
  if (!_controlClient) {
    _controlClient = createClient('control');
  }
  return _controlClient;
}

export function getEvidenceClient(): ApiClient {
  if (!_evidenceClient) {
    _evidenceClient = createClient('evidence');
  }
  return _evidenceClient;
}

export function getWorkflowClient(): ApiClient {
  if (!_workflowClient) {
    _workflowClient = createClient('workflow');
  }
  return _workflowClient;
}

export function getReportingClient(): ApiClient {
  if (!_reportingClient) {
    _reportingClient = createClient('reporting');
  }
  return _reportingClient;
}

export function getAuditClient(): ApiClient {
  if (!_auditClient) {
    _auditClient = createClient('audit');
  }
  return _auditClient;
}

export function getIntegrationClient(): ApiClient {
  if (!_integrationClient) {
    _integrationClient = createClient('integration');
  }
  return _integrationClient;
}

export function getNotificationClient(): ApiClient {
  if (!_notificationClient) {
    _notificationClient = createClient('notification');
  }
  return _notificationClient;
}

export function getAiClient(): ApiClient {
  if (!_aiClient) {
    _aiClient = createClient('ai');
  }
  return _aiClient;
}

// Export as named exports for backward compatibility
export const authClient = getAuthClient();
export const clientServiceClient = getClientServiceClient();
export const policyClient = getPolicyClient();
export const controlClient = getControlClient();
export const evidenceClient = getEvidenceClient();
export const workflowClient = getWorkflowClient();
export const reportingClient = getReportingClient();
export const auditClient = getAuditClient();
export const integrationClient = getIntegrationClient();
export const notificationClient = getNotificationClient();
export const aiClient = getAiClient();