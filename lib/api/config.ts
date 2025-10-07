// API Configuration for different environments
// Supports both Kong Gateway and direct service access

export interface ServiceEndpoints {
  auth: string;
  client: string;
  policy: string;
  control: string;
  evidence: string;
  workflow: string;
  reporting: string;
  audit: string;
  integration: string;
  notification: string;
  ai: string;
}

export interface ApiConfig {
  useKong: boolean;
  baseURL: string;
  services: ServiceEndpoints;
}

// Kong Konnect is ALWAYS required for production
// Direct service access is ONLY for emergency debugging
const isLocalDev =
  process.env.NODE_ENV === 'development' && 
  process.env.NEXT_PUBLIC_USE_KONG === 'false' && // Must explicitly disable Kong
  process.env.NEXT_PUBLIC_EMERGENCY_DEBUG === 'true'; // Must explicitly enable debug mode

// Kong Konnect configuration (REQUIRED for production)
// LOCAL KONG NOT SUPPORTED - Must use Kong Konnect cloud gateway
const kongConfig: ApiConfig = {
  useKong: true,
  baseURL: process.env.NEXT_PUBLIC_KONNECT_GATEWAY_URL || 
          process.env.NEXT_PUBLIC_API_GATEWAY_URL || 
          'https://gateway.soc-platform.com', // Kong Konnect endpoint
  services: {
    auth: '/api/v1/auth',
    client: '/api/v1/clients',
    policy: '/api/v1/policies',
    control: '/api/v1/controls',
    evidence: '/api/v1/evidence',
    workflow: '/api/v1/workflows',
    reporting: '/api/v1/reports',
    audit: '/api/v1/audits',
    integration: '/api/v1/integrations',
    notification: '/api/v1/notifications',
    ai: '/api/v1/ai',
  },
};

// Direct service configuration (DEPRECATED - Use Kong Konnect instead)
// This is only for emergency debugging and should NOT be used in production
const directConfig: ApiConfig = {
  useKong: false,
  baseURL: '', // Not used in direct mode
  services: {
    auth: process.env.NEXT_PUBLIC_AUTH_SERVICE_URL || 'http://auth-service:3001/api/v1/auth',
    client: process.env.NEXT_PUBLIC_CLIENT_SERVICE_URL || 'http://client-service:3002/api/v1/clients',
    policy: process.env.NEXT_PUBLIC_POLICY_SERVICE_URL || 'http://policy-service:3003/api/v1/policies',
    control: process.env.NEXT_PUBLIC_CONTROL_SERVICE_URL || 'http://control-service:3004/api/v1/controls',
    evidence: process.env.NEXT_PUBLIC_EVIDENCE_SERVICE_URL || 'http://evidence-service:3005/api/v1/evidence',
    workflow: process.env.NEXT_PUBLIC_WORKFLOW_SERVICE_URL || 'http://workflow-service:3006/api/v1/workflows',
    reporting: process.env.NEXT_PUBLIC_REPORTING_SERVICE_URL || 'http://reporting-service:3007/api/v1/reports',
    audit: process.env.NEXT_PUBLIC_AUDIT_SERVICE_URL || 'http://audit-service:3008/api/v1/audits',
    integration: process.env.NEXT_PUBLIC_INTEGRATION_SERVICE_URL || 'http://integration-service:3009/api/v1/integrations',
    notification: process.env.NEXT_PUBLIC_NOTIFICATION_SERVICE_URL || 'http://notification-service:3010/api/v1/notifications',
    ai: process.env.NEXT_PUBLIC_AI_SERVICE_URL || 'http://ai-service:3011/api/v1/ai',
  },
};

// Export the appropriate configuration
export const apiConfig: ApiConfig = isLocalDev ? directConfig : kongConfig;

// Helper function to get service URL
export function getServiceUrl(service: keyof ServiceEndpoints): string {
  if (apiConfig.useKong) {
    return `${apiConfig.baseURL}${apiConfig.services[service]}`;
  }
  return apiConfig.services[service];
}

// Helper function to build endpoint URL
export function buildEndpointUrl(service: keyof ServiceEndpoints, endpoint: string): string {
  const serviceUrl = getServiceUrl(service);
  // Ensure endpoint starts with /
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${serviceUrl}${cleanEndpoint}`;
}

// Service-specific API prefixes (MUST use /api/v1 for Kong Konnect)
export const API_PREFIXES = {
  AUTH: apiConfig.useKong ? '/api/v1/auth' : '',
  CLIENT: apiConfig.useKong ? '/api/v1/clients' : '',
  POLICY: apiConfig.useKong ? '/api/v1/policies' : '',
  CONTROL: apiConfig.useKong ? '/api/v1/controls' : '',
  EVIDENCE: apiConfig.useKong ? '/api/v1/evidence' : '',
  WORKFLOW: apiConfig.useKong ? '/api/v1/workflows' : '',
  REPORTING: apiConfig.useKong ? '/api/v1/reports' : '',
  AUDIT: apiConfig.useKong ? '/api/v1/audits' : '',
  INTEGRATION: apiConfig.useKong ? '/api/v1/integrations' : '',
  NOTIFICATION: apiConfig.useKong ? '/api/v1/notifications' : '',
  AI: apiConfig.useKong ? '/api/v1/ai' : '',
};
