'use client';

import {
  ArrowRightIcon,
  ChartBarIcon,
  CogIcon,
  DocumentDuplicateIcon,
  ExclamationTriangleIcon,
  LockClosedIcon,
  ShieldCheckIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { useState } from 'react';

interface Template {
  id: string;
  name: string;
  description: string;
  category: 'compliance' | 'security' | 'audit' | 'custom';
  icon: React.ComponentType<{ className?: string }>;
  fields: string[];
  popularity: number;
  lastUsed?: string;
  isNew?: boolean;
}

const templates: Template[] = [
  {
    id: '1',
    name: 'SOC 2 Type II Full Report',
    description: 'Complete SOC 2 Type II report template with all Trust Services Criteria sections',
    category: 'compliance',
    icon: ShieldCheckIcon,
    fields: ['Period', 'Controls', 'Testing Results', 'Management Assertion'],
    popularity: 95,
    lastUsed: '2 days ago',
  },
  {
    id: '2',
    name: 'Executive Summary Dashboard',
    description: 'High-level compliance status with visual metrics and KPIs',
    category: 'audit',
    icon: ChartBarIcon,
    fields: ['Metrics', 'Trends', 'Risk Summary', 'Recommendations'],
    popularity: 88,
    lastUsed: '1 week ago',
  },
  {
    id: '3',
    name: 'Security Incident Analysis',
    description: 'Detailed security incident report with root cause analysis and remediation',
    category: 'security',
    icon: ExclamationTriangleIcon,
    fields: ['Incident Details', 'Impact Analysis', 'Timeline', 'Remediation Steps'],
    popularity: 76,
    lastUsed: '3 weeks ago',
  },
  {
    id: '4',
    name: 'Control Effectiveness Report',
    description: 'Analyze control performance and identify areas for improvement',
    category: 'compliance',
    icon: CogIcon,
    fields: ['Control List', 'Test Results', 'Effectiveness Score', 'Gaps'],
    popularity: 82,
    isNew: true,
  },
  {
    id: '5',
    name: 'Vendor Risk Assessment',
    description: 'Comprehensive third-party vendor security and compliance evaluation',
    category: 'security',
    icon: DocumentDuplicateIcon,
    fields: ['Vendor Profile', 'Risk Scores', 'Compliance Status', 'Recommendations'],
    popularity: 71,
  },
  {
    id: '6',
    name: 'Custom Analytics Report',
    description: 'Build your own report with custom metrics and visualizations',
    category: 'custom',
    icon: SparklesIcon,
    fields: ['Custom Fields', 'Data Sources', 'Visualizations', 'Filters'],
    popularity: 64,
    isNew: true,
  },
];

const categoryColors = {
  compliance: 'bg-blue-100 text-blue-700',
  security: 'bg-red-100 text-red-700',
  audit: 'bg-purple-100 text-purple-700',
  custom: 'bg-gray-100 text-gray-700',
};

export default function ReportTemplates() {
  const [selectedCategory, setSelectedCategory] = useState<
    'all' | 'compliance' | 'security' | 'audit' | 'custom'
  >('all');

  const filteredTemplates =
    selectedCategory === 'all'
      ? templates
      : templates.filter((t) => t.category === selectedCategory);

  const handleUseTemplate = (template: Template) => {
    console.log('Using template:', template.name);
    // In a real app, this would navigate to the report builder with the template
  };

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-medium text-gray-900">Report Templates</h2>
        <p className="mt-1 text-sm text-gray-500">
          Start with a pre-built template to quickly generate professional reports
        </p>

        {/* Category Filter */}
        <div className="mt-4 flex space-x-2">
          {['all', 'compliance', 'security', 'audit', 'custom'].map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category as typeof selectedCategory)}
              className={`px-3 py-1 rounded-md text-sm font-medium capitalize ${
                selectedCategory === category
                  ? 'bg-primary-100 text-primary-700'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredTemplates.map((template) => {
            const Icon = template.icon;

            return (
              <div
                key={template.id}
                className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => handleUseTemplate(template)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center">
                    <div className={`p-2 rounded-lg ${categoryColors[template.category]}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-gray-900 flex items-center">
                        {template.name}
                        {template.isNew && (
                          <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                            New
                          </span>
                        )}
                      </h3>
                      <p className="text-xs text-gray-500 capitalize">{template.category}</p>
                    </div>
                  </div>
                </div>

                <p className="text-sm text-gray-600 mb-3">{template.description}</p>

                <div className="mb-3">
                  <p className="text-xs font-medium text-gray-700 mb-1">Includes:</p>
                  <div className="flex flex-wrap gap-1">
                    {template.fields.map((field) => (
                      <span
                        key={field}
                        className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700"
                      >
                        {field}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-gray-500">
                  <div className="flex items-center space-x-3">
                    <span className="flex items-center">
                      <div className="w-16 bg-gray-200 rounded-full h-1.5">
                        <div
                          className="bg-primary-600 h-1.5 rounded-full"
                          style={{ width: `${template.popularity}%` }}
                        ></div>
                      </div>
                      <span className="ml-2">{template.popularity}% popular</span>
                    </span>
                  </div>
                  {template.lastUsed && <span>Used {template.lastUsed}</span>}
                </div>

                <div className="mt-3 flex items-center justify-end text-primary-600 hover:text-primary-500">
                  <span className="text-sm font-medium">Use Template</span>
                  <ArrowRightIcon className="ml-1 h-4 w-4" />
                </div>
              </div>
            );
          })}
        </div>

        {/* Template Builder CTA */}
        <div className="mt-6 bg-gray-50 rounded-lg p-6 text-center">
          <SparklesIcon className="mx-auto h-8 w-8 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">Need a custom template?</h3>
          <p className="mt-1 text-sm text-gray-500">
            Create your own template with our report builder
          </p>
          <button className="mt-3 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700">
            Create Custom Template
          </button>
        </div>
      </div>
    </div>
  );
}
