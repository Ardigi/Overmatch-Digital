/**
 * Service Discovery Configuration
 * Maps service names to their API endpoints
 */

export interface ServiceEndpoint {
  name: string;
  baseUrl: string;
  port: number;
}

export const SERVICE_ENDPOINTS: Record<string, ServiceEndpoint> = {
  AUTH: {
    name: 'auth-service',
    baseUrl: process.env.AUTH_SERVICE_URL || 'http://localhost:3001',
    port: 3001,
  },
  CLIENT: {
    name: 'client-service',
    baseUrl: process.env.CLIENT_SERVICE_URL || 'http://localhost:3002',
    port: 3002,
  },
  POLICY: {
    name: 'policy-service',
    baseUrl: process.env.POLICY_SERVICE_URL || 'http://localhost:3003',
    port: 3003,
  },
  CONTROL: {
    name: 'control-service',
    baseUrl: process.env.CONTROL_SERVICE_URL || 'http://localhost:3004',
    port: 3004,
  },
  EVIDENCE: {
    name: 'evidence-service',
    baseUrl: process.env.EVIDENCE_SERVICE_URL || 'http://localhost:3005',
    port: 3005,
  },
  WORKFLOW: {
    name: 'workflow-service',
    baseUrl: process.env.WORKFLOW_SERVICE_URL || 'http://localhost:3006',
    port: 3006,
  },
  REPORTING: {
    name: 'reporting-service',
    baseUrl: process.env.REPORTING_SERVICE_URL || 'http://localhost:3007',
    port: 3007,
  },
  AUDIT: {
    name: 'audit-service',
    baseUrl: process.env.AUDIT_SERVICE_URL || 'http://localhost:3008',
    port: 3008,
  },
  INTEGRATION: {
    name: 'integration-service',
    baseUrl: process.env.INTEGRATION_SERVICE_URL || 'http://localhost:3009',
    port: 3009,
  },
  NOTIFICATION: {
    name: 'notification-service',
    baseUrl: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3010',
    port: 3010,
  },
  AI: {
    name: 'ai-service',
    baseUrl: process.env.AI_SERVICE_URL || 'http://localhost:3011',
    port: 3011,
  },
};

/**
 * Kong API Gateway configuration
 * When USE_KONG=true, all services are accessed through the gateway
 */
export const KONG_GATEWAY = {
  baseUrl: process.env.KONG_GATEWAY_URL || 'http://localhost:8000',
  useGateway: process.env.USE_KONG === 'true',
};

/**
 * Get service endpoint URL
 * Returns Kong gateway URL if enabled, otherwise direct service URL
 */
export function getServiceUrl(service: keyof typeof SERVICE_ENDPOINTS): string {
  if (KONG_GATEWAY.useGateway) {
    return `${KONG_GATEWAY.baseUrl}/api`;
  }
  return SERVICE_ENDPOINTS[service].baseUrl;
}
