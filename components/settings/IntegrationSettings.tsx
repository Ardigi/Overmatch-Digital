'use client';

import {
  ArrowPathIcon,
  CheckCircleIcon,
  KeyIcon,
  LinkIcon,
  PlusIcon,
  PuzzlePieceIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import { useState } from 'react';

interface Integration {
  id: string;
  name: string;
  description: string;
  category: string;
  status: 'connected' | 'disconnected' | 'error';
  logo: string;
  lastSync?: string;
  config?: any;
}

export default function IntegrationSettings() {
  const [activeCategory, setActiveCategory] = useState('all');

  const integrations: Integration[] = [
    {
      id: '1',
      name: 'Microsoft 365',
      description: 'Sync users, collect evidence from SharePoint and OneDrive',
      category: 'productivity',
      status: 'connected',
      logo: '📊',
      lastSync: '2024-07-19T14:00:00',
      config: { tenant: 'overmatch.onmicrosoft.com' },
    },
    {
      id: '2',
      name: 'Google Workspace',
      description: 'Import users and collect evidence from Google Drive',
      category: 'productivity',
      status: 'disconnected',
      logo: '📧',
    },
    {
      id: '3',
      name: 'Slack',
      description: 'Send notifications and alerts to Slack channels',
      category: 'communication',
      status: 'connected',
      logo: '💬',
      lastSync: '2024-07-19T13:45:00',
      config: { workspace: 'overmatch' },
    },
    {
      id: '4',
      name: 'AWS',
      description: 'Monitor AWS infrastructure and collect compliance evidence',
      category: 'cloud',
      status: 'connected',
      logo: '☁️',
      lastSync: '2024-07-19T14:30:00',
      config: { accountId: '123456789012' },
    },
    {
      id: '5',
      name: 'Azure',
      description: 'Monitor Azure resources and collect security logs',
      category: 'cloud',
      status: 'error',
      logo: '☁️',
      lastSync: '2024-07-18T10:00:00',
    },
    {
      id: '6',
      name: 'GitHub',
      description: 'Track code changes and security scanning results',
      category: 'development',
      status: 'connected',
      logo: '🐙',
      lastSync: '2024-07-19T14:15:00',
      config: { organization: 'overmatch-digital' },
    },
    {
      id: '7',
      name: 'Jira',
      description: 'Sync audit findings and track remediation tasks',
      category: 'project',
      status: 'disconnected',
      logo: '📋',
    },
    {
      id: '8',
      name: 'QuickBooks',
      description: 'Import financial data for SOC 1 audits',
      category: 'finance',
      status: 'connected',
      logo: '💰',
      lastSync: '2024-07-19T08:00:00',
    },
  ];

  const categories = [
    { id: 'all', name: 'All Integrations' },
    { id: 'productivity', name: 'Productivity' },
    { id: 'communication', name: 'Communication' },
    { id: 'cloud', name: 'Cloud Infrastructure' },
    { id: 'development', name: 'Development' },
    { id: 'project', name: 'Project Management' },
    { id: 'finance', name: 'Finance' },
  ];

  const getStatusIcon = (status: Integration['status']) => {
    switch (status) {
      case 'connected':
        return <CheckCircleIcon className="h-5 w-5 text-green-600" />;
      case 'disconnected':
        return <XCircleIcon className="h-5 w-5 text-gray-400" />;
      case 'error':
        return <XCircleIcon className="h-5 w-5 text-red-600" />;
    }
  };

  const getStatusText = (status: Integration['status']) => {
    switch (status) {
      case 'connected':
        return 'Connected';
      case 'disconnected':
        return 'Not Connected';
      case 'error':
        return 'Error';
    }
  };

  const filteredIntegrations = integrations.filter(
    (integration) => activeCategory === 'all' || integration.category === activeCategory
  );

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Integrations</h3>
            <button className="btn-primary flex items-center gap-2">
              <PlusIcon className="h-5 w-5" />
              Add Integration
            </button>
          </div>
        </div>

        <div className="p-6">
          <div className="flex items-center gap-2 mb-6 overflow-x-auto">
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setActiveCategory(category.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  activeCategory === category.id
                    ? 'bg-primary-100 text-primary-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {category.name}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4">
            {filteredIntegrations.map((integration) => (
              <div key={integration.id} className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="text-3xl">{integration.logo}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h4 className="font-medium text-gray-900">{integration.name}</h4>
                        <div className="flex items-center gap-1">
                          {getStatusIcon(integration.status)}
                          <span
                            className={`text-sm ${
                              integration.status === 'connected'
                                ? 'text-green-600'
                                : integration.status === 'error'
                                  ? 'text-red-600'
                                  : 'text-gray-500'
                            }`}
                          >
                            {getStatusText(integration.status)}
                          </span>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{integration.description}</p>
                      {integration.status === 'connected' && integration.lastSync && (
                        <p className="text-xs text-gray-500">
                          Last synced: {new Date(integration.lastSync).toLocaleString()}
                        </p>
                      )}
                      {integration.status === 'error' && (
                        <p className="text-xs text-red-600 mt-1">
                          Authentication failed. Please reconnect.
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {integration.status === 'connected' && (
                      <>
                        <button className="p-2 text-gray-400 hover:text-gray-600">
                          <ArrowPathIcon className="h-5 w-5" />
                        </button>
                        <button className="btn-secondary">Configure</button>
                        <button className="text-red-600 hover:text-red-700 text-sm font-medium">
                          Disconnect
                        </button>
                      </>
                    )}
                    {integration.status === 'disconnected' && (
                      <button className="btn-primary">Connect</button>
                    )}
                    {integration.status === 'error' && (
                      <button className="btn-primary">Reconnect</button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">API Access</h3>
        </div>
        <div className="p-6">
          <p className="text-sm text-gray-600 mb-4">
            Use API keys to integrate Overmatch with your custom applications and automation tools.
          </p>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <KeyIcon className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Production API Key</p>
                  <p className="text-xs text-gray-500">Created on Jan 15, 2024</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <code className="text-xs bg-gray-200 px-2 py-1 rounded">sk_live_...7d9f</code>
                <button className="text-sm text-gray-600 hover:text-gray-700">Regenerate</button>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <KeyIcon className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Test API Key</p>
                  <p className="text-xs text-gray-500">Created on Mar 10, 2024</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <code className="text-xs bg-gray-200 px-2 py-1 rounded">sk_test_...4a2c</code>
                <button className="text-sm text-gray-600 hover:text-gray-700">Regenerate</button>
              </div>
            </div>
          </div>

          <button className="btn-secondary mt-4">Create New API Key</button>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 mb-2">Webhook Endpoints</h4>
        <p className="text-sm text-blue-800 mb-3">
          Configure webhooks to receive real-time notifications about audit events, findings, and
          compliance status changes.
        </p>
        <button className="btn-secondary flex items-center gap-2">
          <LinkIcon className="h-4 w-4" />
          Configure Webhooks
        </button>
      </div>
    </div>
  );
}
