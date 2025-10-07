'use client';

import {
  ArrowRightIcon,
  CheckCircleIcon,
  DocumentTextIcon,
  LockClosedIcon,
  PlusIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import Image from 'next/image';
import { useState } from 'react';
import IntegrationSetupModal from './IntegrationSetupModal';

interface Integration {
  id: string;
  name: string;
  description: string;
  category: string;
  logo: string;
  status: 'connected' | 'not_connected' | 'coming_soon';
  features: string[];
  requiredScopes?: string[];
  documentationUrl: string;
  setupTime: string;
}

const integrations: Integration[] = [
  // Cloud Providers
  {
    id: 'aws',
    name: 'Amazon Web Services',
    description: 'Monitor AWS infrastructure, access logs, and security configurations',
    category: 'Cloud Provider',
    logo: '/integrations/aws.svg',
    status: 'connected',
    features: [
      'CloudTrail audit logs',
      'IAM policy monitoring',
      'S3 bucket permissions',
      'Security Group rules',
      'RDS encryption status',
    ],
    requiredScopes: ['cloudtrail:LookupEvents', 'iam:ListPolicies', 's3:GetBucketPolicy'],
    documentationUrl: 'https://docs.overmatch.com/integrations/aws',
    setupTime: '10 minutes',
  },
  {
    id: 'azure',
    name: 'Microsoft Azure',
    description: 'Integrate with Azure AD and monitor Azure resources',
    category: 'Cloud Provider',
    logo: '/integrations/azure.svg',
    status: 'connected',
    features: [
      'Azure AD user management',
      'Activity logs',
      'Resource compliance',
      'Key Vault monitoring',
      'Network security groups',
    ],
    requiredScopes: ['Directory.Read.All', 'AuditLog.Read.All', 'SecurityEvents.Read.All'],
    documentationUrl: 'https://docs.overmatch.com/integrations/azure',
    setupTime: '15 minutes',
  },
  {
    id: 'gcp',
    name: 'Google Cloud Platform',
    description: 'Monitor GCP resources and access controls',
    category: 'Cloud Provider',
    logo: '/integrations/gcp.svg',
    status: 'not_connected',
    features: [
      'Cloud Audit Logs',
      'IAM policies',
      'Cloud Storage permissions',
      'Compute Engine security',
      'VPC configurations',
    ],
    documentationUrl: 'https://docs.overmatch.com/integrations/gcp',
    setupTime: '10 minutes',
  },

  // Identity Providers
  {
    id: 'okta',
    name: 'Okta',
    description: 'Monitor user authentication, MFA status, and access policies',
    category: 'Identity Provider',
    logo: '/integrations/okta.svg',
    status: 'connected',
    features: [
      'User lifecycle events',
      'MFA enrollment status',
      'Authentication logs',
      'Application assignments',
      'Password policy compliance',
    ],
    requiredScopes: ['okta.users.read', 'okta.logs.read', 'okta.policies.read'],
    documentationUrl: 'https://docs.overmatch.com/integrations/okta',
    setupTime: '5 minutes',
  },
  {
    id: 'auth0',
    name: 'Auth0',
    description: 'Track authentication events and user security settings',
    category: 'Identity Provider',
    logo: '/integrations/auth0.svg',
    status: 'not_connected',
    features: [
      'Login analytics',
      'MFA adoption',
      'Anomaly detection',
      'User profiles',
      'Security events',
    ],
    documentationUrl: 'https://docs.overmatch.com/integrations/auth0',
    setupTime: '10 minutes',
  },

  // Security Tools
  {
    id: 'datadog',
    name: 'Datadog',
    description: 'Infrastructure monitoring and security event detection',
    category: 'Security Tool',
    logo: '/integrations/datadog.svg',
    status: 'connected',
    features: [
      'Security monitoring',
      'Log management',
      'Vulnerability detection',
      'Compliance monitoring',
      'Incident tracking',
    ],
    requiredScopes: ['logs_read', 'monitors_read', 'security_monitoring_rules_read'],
    documentationUrl: 'https://docs.overmatch.com/integrations/datadog',
    setupTime: '5 minutes',
  },
  {
    id: 'crowdstrike',
    name: 'CrowdStrike',
    description: 'Endpoint detection and response integration',
    category: 'Security Tool',
    logo: '/integrations/crowdstrike.svg',
    status: 'not_connected',
    features: [
      'Endpoint protection status',
      'Threat detection',
      'Device compliance',
      'Incident response',
      'Zero Trust assessment',
    ],
    documentationUrl: 'https://docs.overmatch.com/integrations/crowdstrike',
    setupTime: '20 minutes',
  },

  // Development Tools
  {
    id: 'github',
    name: 'GitHub',
    description: 'Monitor code repositories and development practices',
    category: 'Development',
    logo: '/integrations/github.svg',
    status: 'not_connected',
    features: [
      'Repository access logs',
      'Branch protection rules',
      'Code scanning alerts',
      'Dependency vulnerabilities',
      'Deployment history',
    ],
    documentationUrl: 'https://docs.overmatch.com/integrations/github',
    setupTime: '5 minutes',
  },
  {
    id: 'jira',
    name: 'Jira',
    description: 'Track change management and incident response',
    category: 'Development',
    logo: '/integrations/jira.svg',
    status: 'not_connected',
    features: [
      'Change tickets',
      'Incident tracking',
      'Access approvals',
      'Audit trails',
      'SLA compliance',
    ],
    documentationUrl: 'https://docs.overmatch.com/integrations/jira',
    setupTime: '10 minutes',
  },

  // Coming Soon
  {
    id: 'salesforce',
    name: 'Salesforce',
    description: 'Monitor Salesforce security settings and user access',
    category: 'Business Apps',
    logo: '/integrations/salesforce.svg',
    status: 'coming_soon',
    features: [
      'User permissions',
      'Data access logs',
      'Security settings',
      'API usage',
      'Login history',
    ],
    documentationUrl: 'https://docs.overmatch.com/integrations/salesforce',
    setupTime: '15 minutes',
  },
];

const categoryIcons = {
  'Cloud Provider': '☁️',
  'Identity Provider': '🔐',
  'Security Tool': '🛡️',
  Development: '💻',
  'Business Apps': '💼',
};

export default function IntegrationsList() {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);

  const categories = ['all', ...Object.keys(categoryIcons)];
  const filteredIntegrations =
    selectedCategory === 'all'
      ? integrations
      : integrations.filter((i) => i.category === selectedCategory);

  const handleSetup = (integration: Integration) => {
    setSelectedIntegration(integration);
    setShowSetupModal(true);
  };

  return (
    <div>
      {/* Category Filter */}
      <div className="mb-6 flex space-x-2 overflow-x-auto">
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => setSelectedCategory(category)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${
              selectedCategory === category
                ? 'bg-primary-100 text-primary-700'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {category === 'all' ? (
              'All Integrations'
            ) : (
              <>
                <span className="mr-2">
                  {categoryIcons[category as keyof typeof categoryIcons]}
                </span>
                {category}
              </>
            )}
          </button>
        ))}
      </div>

      {/* Integrations Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredIntegrations.map((integration) => (
          <div
            key={integration.id}
            className={`bg-white border rounded-lg p-6 hover:shadow-lg transition-shadow ${
              integration.status === 'coming_soon' ? 'opacity-75' : ''
            }`}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center mr-3">
                  {/* In a real app, you'd use the actual logo */}
                  <span className="text-2xl">
                    {categoryIcons[integration.category as keyof typeof categoryIcons]}
                  </span>
                </div>
                <div>
                  <h3 className="text-lg font-medium text-gray-900">{integration.name}</h3>
                  <p className="text-sm text-gray-500">{integration.category}</p>
                </div>
              </div>
              {integration.status === 'connected' ? (
                <CheckCircleIcon className="h-6 w-6 text-green-500" />
              ) : integration.status === 'coming_soon' ? (
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                  Coming Soon
                </span>
              ) : null}
            </div>

            <p className="text-sm text-gray-600 mb-4">{integration.description}</p>

            {/* Features */}
            <div className="mb-4">
              <h4 className="text-xs font-medium text-gray-700 uppercase tracking-wider mb-2">
                Key Features
              </h4>
              <ul className="space-y-1">
                {integration.features.slice(0, 3).map((feature, idx) => (
                  <li key={idx} className="text-xs text-gray-600 flex items-start">
                    <CheckCircleIcon className="h-3 w-3 text-green-500 mr-1 mt-0.5 flex-shrink-0" />
                    {feature}
                  </li>
                ))}
                {integration.features.length > 3 && (
                  <li className="text-xs text-gray-500">
                    +{integration.features.length - 3} more features
                  </li>
                )}
              </ul>
            </div>

            {/* Setup Info */}
            <div className="flex items-center justify-between text-xs text-gray-500 mb-4">
              <span className="flex items-center">
                <LockClosedIcon className="h-3 w-3 mr-1" />
                Secure OAuth 2.0
              </span>
              <span>Setup: ~{integration.setupTime}</span>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between">
              {integration.status === 'connected' ? (
                <>
                  <button className="text-sm text-primary-600 hover:text-primary-500">
                    Configure
                  </button>
                  <button className="text-sm text-red-600 hover:text-red-500">Disconnect</button>
                </>
              ) : integration.status === 'coming_soon' ? (
                <button
                  disabled
                  className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-400 bg-gray-50 cursor-not-allowed"
                >
                  Coming Soon
                </button>
              ) : (
                <button
                  onClick={() => handleSetup(integration)}
                  className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-primary-600 hover:bg-primary-700"
                >
                  <PlusIcon className="mr-2 h-4 w-4" />
                  Connect
                </button>
              )}
            </div>

            {/* Documentation Link */}
            <div className="mt-4 pt-4 border-t border-gray-100">
              <a
                href={integration.documentationUrl}
                className="text-xs text-gray-500 hover:text-gray-700 flex items-center"
              >
                <DocumentTextIcon className="h-3 w-3 mr-1" />
                View documentation
                <ArrowRightIcon className="h-3 w-3 ml-1" />
              </a>
            </div>
          </div>
        ))}
      </div>

      {/* Stats */}
      <div className="mt-12 bg-gray-50 rounded-lg p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-center">
          <div>
            <p className="text-3xl font-semibold text-gray-900">
              {integrations.filter((i) => i.status === 'connected').length}
            </p>
            <p className="text-sm text-gray-600">Active Integrations</p>
          </div>
          <div>
            <p className="text-3xl font-semibold text-gray-900">156K</p>
            <p className="text-sm text-gray-600">Events Processed Daily</p>
          </div>
          <div>
            <p className="text-3xl font-semibold text-gray-900">99.9%</p>
            <p className="text-sm text-gray-600">API Uptime</p>
          </div>
          <div>
            <p className="text-3xl font-semibold text-gray-900">
              {integrations.filter((i) => i.status === 'not_connected').length}
            </p>
            <p className="text-sm text-gray-600">Available to Connect</p>
          </div>
        </div>
      </div>

      {/* Integration Setup Modal */}
      {showSetupModal && selectedIntegration && (
        <IntegrationSetupModal
          integration={selectedIntegration}
          isOpen={showSetupModal}
          onClose={() => {
            setShowSetupModal(false);
            setSelectedIntegration(null);
          }}
        />
      )}
    </div>
  );
}
