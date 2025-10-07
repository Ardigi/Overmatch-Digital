'use client';

import {
  AcademicCapIcon,
  ArrowDownTrayIcon,
  BookOpenIcon,
  ChevronRightIcon,
  ClipboardDocumentCheckIcon,
  ClockIcon,
  DocumentDuplicateIcon,
  DocumentTextIcon,
  PlayIcon,
  PresentationChartLineIcon,
  UserGroupIcon,
  VideoCameraIcon,
} from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import { useState } from 'react';

interface Resource {
  id: string;
  title: string;
  description: string;
  type: 'document' | 'video' | 'template' | 'training' | 'tool';
  category: string;
  fileSize?: string;
  duration?: string;
  lastUpdated: string;
  downloads: number;
  restricted?: boolean;
  partnerTypes: string[];
}

interface TrainingModule {
  id: string;
  title: string;
  description: string;
  duration: string;
  modules: number;
  completedBy: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  certification?: boolean;
}

export default function PartnerResources() {
  const [activeTab, setActiveTab] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Mock data based on documentation's partner enablement needs
  const resources: Resource[] = [
    {
      id: '1',
      title: 'SOC 2 Partner Playbook',
      description: 'Comprehensive guide for delivering SOC 2 services to clients',
      type: 'document',
      category: 'Sales & Marketing',
      fileSize: '4.2 MB',
      lastUpdated: '2024-07-10',
      downloads: 156,
      partnerTypes: ['white-label', 'joint-venture'],
    },
    {
      id: '2',
      title: 'Client Onboarding Templates',
      description: 'Ready-to-use templates for efficient client onboarding',
      type: 'template',
      category: 'Operations',
      fileSize: '2.8 MB',
      lastUpdated: '2024-07-15',
      downloads: 89,
      partnerTypes: ['all'],
    },
    {
      id: '3',
      title: 'SOC 2 Sales Presentation',
      description: 'Customizable pitch deck for SOC 2 compliance services',
      type: 'document',
      category: 'Sales & Marketing',
      fileSize: '8.5 MB',
      lastUpdated: '2024-07-08',
      downloads: 134,
      partnerTypes: ['all'],
    },
    {
      id: '4',
      title: 'Trust Services Criteria Deep Dive',
      description: 'Technical training on TSC implementation and assessment',
      type: 'video',
      category: 'Technical Training',
      duration: '2h 15m',
      lastUpdated: '2024-06-28',
      downloads: 67,
      partnerTypes: ['white-label', 'joint-venture', 'subcontractor'],
    },
    {
      id: '5',
      title: 'ROI Calculator Tool',
      description: 'Excel-based tool for calculating client ROI from SOC 2',
      type: 'tool',
      category: 'Sales & Marketing',
      fileSize: '1.2 MB',
      lastUpdated: '2024-07-12',
      downloads: 178,
      partnerTypes: ['all'],
    },
    {
      id: '6',
      title: 'Evidence Collection Automation Scripts',
      description: 'Python scripts for automated evidence gathering',
      type: 'tool',
      category: 'Technical Training',
      fileSize: '856 KB',
      lastUpdated: '2024-07-05',
      downloads: 45,
      restricted: true,
      partnerTypes: ['white-label', 'joint-venture'],
    },
    {
      id: '7',
      title: 'Partner Co-Marketing Kit',
      description: 'Logos, messaging, and brand guidelines for partners',
      type: 'document',
      category: 'Sales & Marketing',
      fileSize: '15.3 MB',
      lastUpdated: '2024-07-01',
      downloads: 92,
      partnerTypes: ['white-label', 'joint-venture'],
    },
    {
      id: '8',
      title: 'Compliance Readiness Checklist',
      description: 'Interactive checklist for assessing client readiness',
      type: 'template',
      category: 'Operations',
      fileSize: '428 KB',
      lastUpdated: '2024-07-18',
      downloads: 201,
      partnerTypes: ['all'],
    },
  ];

  const trainingModules: TrainingModule[] = [
    {
      id: '1',
      title: 'SOC 2 Fundamentals',
      description: 'Introduction to SOC 2 compliance and Trust Services Criteria',
      duration: '4 hours',
      modules: 8,
      completedBy: 45,
      difficulty: 'beginner',
      certification: true,
    },
    {
      id: '2',
      title: 'Advanced SOC 2 Implementation',
      description: 'Deep dive into control implementation and testing',
      duration: '8 hours',
      modules: 12,
      completedBy: 23,
      difficulty: 'advanced',
      certification: true,
    },
    {
      id: '3',
      title: 'Sales Mastery for SOC Services',
      description: 'Effective selling techniques for compliance services',
      duration: '3 hours',
      modules: 6,
      completedBy: 67,
      difficulty: 'intermediate',
    },
    {
      id: '4',
      title: 'Platform Training & Certification',
      description: 'Complete training on using the Overmatch platform',
      duration: '2 hours',
      modules: 4,
      completedBy: 89,
      difficulty: 'beginner',
      certification: true,
    },
  ];

  const getResourceIcon = (type: Resource['type']) => {
    switch (type) {
      case 'document':
        return DocumentTextIcon;
      case 'video':
        return VideoCameraIcon;
      case 'template':
        return DocumentDuplicateIcon;
      case 'training':
        return AcademicCapIcon;
      case 'tool':
        return PresentationChartLineIcon;
    }
  };

  const getDifficultyColor = (difficulty: TrainingModule['difficulty']) => {
    switch (difficulty) {
      case 'beginner':
        return 'bg-green-100 text-green-800';
      case 'intermediate':
        return 'bg-yellow-100 text-yellow-800';
      case 'advanced':
        return 'bg-red-100 text-red-800';
    }
  };

  const categories = ['All', 'Sales & Marketing', 'Technical Training', 'Operations'];

  const filteredResources = resources.filter((resource) => {
    const matchesSearch =
      resource.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      resource.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = activeTab === 'all' || resource.category === activeTab;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <BookOpenIcon className="h-5 w-5 text-blue-600 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-semibold mb-1">Partner Resource Center</p>
            <p>
              Access training materials, templates, tools, and co-marketing resources to help you
              succeed with SOC compliance services.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Resources & Tools</h3>

          <div className="mb-4">
            <input
              type="text"
              placeholder="Search resources..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          <div className="flex gap-2 mb-4">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setActiveTab(category.toLowerCase().replace(' & ', '-'))}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                  activeTab === category.toLowerCase().replace(' & ', '-') ||
                  (activeTab === 'all' && category === 'All')
                    ? 'bg-primary-100 text-primary-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {category}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {filteredResources.map((resource) => {
              const Icon = getResourceIcon(resource.type);
              return (
                <div
                  key={resource.id}
                  className="bg-white border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-gray-100 rounded-lg">
                      <Icon className="h-5 w-5 text-gray-600" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-medium text-gray-900">{resource.title}</h4>
                          <p className="text-sm text-gray-600 mt-1">{resource.description}</p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                            <span>{resource.category}</span>
                            {resource.fileSize && <span>{resource.fileSize}</span>}
                            {resource.duration && <span>{resource.duration}</span>}
                            <span>Updated {format(new Date(resource.lastUpdated), 'MMM d')}</span>
                          </div>
                          {resource.restricted && (
                            <span className="inline-flex items-center gap-1 mt-2 text-xs text-orange-600">
                              <ClipboardDocumentCheckIcon className="h-3 w-3" />
                              Restricted to {resource.partnerTypes.join(', ')} partners
                            </span>
                          )}
                        </div>
                        <button className="p-2 text-gray-400 hover:text-primary-600 transition-colors">
                          <ArrowDownTrayIcon className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Training & Certification</h3>

          <div className="space-y-3">
            {trainingModules.map((module) => (
              <div key={module.id} className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-gray-900">{module.title}</h4>
                      {module.certification && (
                        <span className="px-2 py-0.5 bg-purple-100 text-purple-800 text-xs rounded-full">
                          Certification
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{module.description}</p>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${getDifficultyColor(module.difficulty)}`}
                  >
                    {module.difficulty}
                  </span>
                </div>

                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <div className="flex items-center gap-1">
                    <AcademicCapIcon className="h-4 w-4" />
                    {module.modules} modules
                  </div>
                  <div className="flex items-center gap-1">
                    <ClockIcon className="h-4 w-4" />
                    {module.duration}
                  </div>
                  <div className="flex items-center gap-1">
                    <UserGroupIcon className="h-4 w-4" />
                    {module.completedBy} completed
                  </div>
                </div>

                <button className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary-50 text-primary-600 rounded-lg hover:bg-primary-100 transition-colors">
                  <PlayIcon className="h-4 w-4" />
                  Start Training
                </button>
              </div>
            ))}
          </div>

          <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-4">
            <h4 className="font-semibold text-green-900 mb-2">Quick Links</h4>
            <div className="space-y-2">
              <a
                href="#"
                className="flex items-center justify-between text-sm text-green-700 hover:text-green-800"
              >
                <span>Partner Portal Documentation</span>
                <ChevronRightIcon className="h-4 w-4" />
              </a>
              <a
                href="#"
                className="flex items-center justify-between text-sm text-green-700 hover:text-green-800"
              >
                <span>API Integration Guide</span>
                <ChevronRightIcon className="h-4 w-4" />
              </a>
              <a
                href="#"
                className="flex items-center justify-between text-sm text-green-700 hover:text-green-800"
              >
                <span>Support & FAQ</span>
                <ChevronRightIcon className="h-4 w-4" />
              </a>
              <a
                href="#"
                className="flex items-center justify-between text-sm text-green-700 hover:text-green-800"
              >
                <span>Partner Community Forum</span>
                <ChevronRightIcon className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
