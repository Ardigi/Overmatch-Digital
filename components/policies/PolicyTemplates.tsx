'use client';

import {
  ArrowDownTrayIcon,
  DocumentDuplicateIcon,
  DocumentPlusIcon,
  EyeIcon,
  LockClosedIcon,
  ServerIcon,
  ShieldCheckIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import { useState } from 'react';

interface Template {
  id: string;
  name: string;
  category: string;
  description: string;
  framework: string[];
  downloads: number;
  lastUpdated: string;
  preview: string;
}

export default function PolicyTemplates() {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showPreview, setShowPreview] = useState<string | null>(null);

  // SOC 2 policy templates based on Trust Services Criteria
  const templates: Template[] = [
    {
      id: '1',
      name: 'Information Security Policy Template',
      category: 'Security',
      description:
        'Comprehensive template covering all aspects of information security for SOC 2 compliance',
      framework: ['SOC 2', 'ISO 27001'],
      downloads: 245,
      lastUpdated: '2024-07-01',
      preview: 'Establishes framework for protecting information assets...',
    },
    {
      id: '2',
      name: 'Access Control Policy Template',
      category: 'Security',
      description: 'Template for managing user access, authentication, and authorization',
      framework: ['SOC 2', 'SOC 1'],
      downloads: 189,
      lastUpdated: '2024-06-15',
      preview: 'Defines requirements for granting and revoking access...',
    },
    {
      id: '3',
      name: 'Incident Response Plan Template',
      category: 'Security',
      description: 'Step-by-step incident response procedures and escalation matrix',
      framework: ['SOC 2'],
      downloads: 167,
      lastUpdated: '2024-07-10',
      preview: 'Procedures for detecting and responding to security incidents...',
    },
    {
      id: '4',
      name: 'Data Classification Policy Template',
      category: 'Privacy',
      description: 'Framework for classifying and handling sensitive data',
      framework: ['SOC 2', 'GDPR'],
      downloads: 134,
      lastUpdated: '2024-06-20',
      preview: 'Establishes data classification levels and handling requirements...',
    },
    {
      id: '5',
      name: 'Business Continuity Plan Template',
      category: 'Availability',
      description: 'Template for ensuring service availability during disruptions',
      framework: ['SOC 2'],
      downloads: 112,
      lastUpdated: '2024-07-05',
      preview: 'Ensures critical business functions continue during disasters...',
    },
    {
      id: '6',
      name: 'Change Management Policy Template',
      category: 'Operations',
      description: 'Controls for managing changes to production systems',
      framework: ['SOC 2', 'SOC 1'],
      downloads: 156,
      lastUpdated: '2024-06-25',
      preview: 'Procedures for planning, testing, and implementing changes...',
    },
    {
      id: '7',
      name: 'Vendor Management Policy Template',
      category: 'Security',
      description: 'Framework for assessing and monitoring third-party risks',
      framework: ['SOC 2'],
      downloads: 143,
      lastUpdated: '2024-07-08',
      preview: 'Requirements for vendor selection and ongoing monitoring...',
    },
    {
      id: '8',
      name: 'Data Retention Policy Template',
      category: 'Privacy',
      description: 'Guidelines for data retention periods and secure disposal',
      framework: ['SOC 2', 'GDPR'],
      downloads: 98,
      lastUpdated: '2024-06-30',
      preview: 'Defines retention periods for different data types...',
    },
    {
      id: '9',
      name: 'Penetration Testing Policy Template',
      category: 'Security',
      description: 'Requirements for regular security testing and vulnerability assessments',
      framework: ['SOC 2'],
      downloads: 87,
      lastUpdated: '2024-07-12',
      preview: 'Establishes frequency and scope of security testing...',
    },
    {
      id: '10',
      name: 'System Monitoring Policy Template',
      category: 'Operations',
      description: 'Continuous monitoring requirements for security and performance',
      framework: ['SOC 2'],
      downloads: 123,
      lastUpdated: '2024-07-03',
      preview: 'Defines monitoring requirements and alert thresholds...',
    },
  ];

  const categories = ['All', 'Security', 'Privacy', 'Operations', 'Availability'];

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Security':
        return ShieldCheckIcon;
      case 'Privacy':
        return LockClosedIcon;
      case 'Operations':
        return ServerIcon;
      case 'Availability':
        return UserGroupIcon;
      default:
        return DocumentDuplicateIcon;
    }
  };

  const filteredTemplates = templates.filter(
    (template) => selectedCategory === 'all' || template.category === selectedCategory
  );

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <DocumentDuplicateIcon className="h-5 w-5 text-blue-600 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-semibold mb-1">SOC 2 Policy Templates</p>
            <p>
              Pre-built templates aligned with Trust Services Criteria. Customize these templates to
              match your organization's specific requirements.
            </p>
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => setSelectedCategory(category.toLowerCase())}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedCategory === category.toLowerCase()
                ? 'bg-primary-100 text-primary-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4">
        {filteredTemplates.map((template) => {
          const Icon = getCategoryIcon(template.category);
          return (
            <div key={template.id} className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-start gap-4">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <Icon className="h-6 w-6 text-gray-600" />
                </div>
                <div className="flex-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-medium text-gray-900">{template.name}</h3>
                      <p className="text-sm text-gray-600 mt-1">{template.description}</p>
                      <div className="flex items-center gap-4 mt-2">
                        <div className="flex items-center gap-2">
                          {template.framework.map((fw) => (
                            <span
                              key={fw}
                              className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded"
                            >
                              {fw}
                            </span>
                          ))}
                        </div>
                        <span className="text-xs text-gray-500">
                          {template.downloads} downloads
                        </span>
                        <span className="text-xs text-gray-500">
                          Updated {new Date(template.lastUpdated).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowPreview(template.id)}
                        className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        <EyeIcon className="h-5 w-5" />
                      </button>
                      <button className="p-2 text-gray-400 hover:text-primary-600 transition-colors">
                        <ArrowDownTrayIcon className="h-5 w-5" />
                      </button>
                      <button className="btn-primary flex items-center gap-2">
                        <DocumentPlusIcon className="h-4 w-4" />
                        Use Template
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <h4 className="font-semibold text-green-900 mb-2">Need Custom Templates?</h4>
        <p className="text-sm text-green-800 mb-3">
          Our team can create custom policy templates tailored to your industry and specific
          compliance requirements.
        </p>
        <button className="btn-secondary">Request Custom Template</button>
      </div>
    </div>
  );
}
