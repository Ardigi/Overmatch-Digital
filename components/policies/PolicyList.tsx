'use client';

import {
  CheckCircleIcon,
  ClockIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  LockClosedIcon,
  MagnifyingGlassIcon,
  PencilIcon,
  ServerIcon,
  ShieldCheckIcon,
  TrashIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import { useState } from 'react';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { usePolicies } from '@/hooks/api/usePolicies';

interface Policy {
  id: string;
  title: string;
  category: string;
  description: string;
  version: string;
  status: 'active' | 'draft' | 'review' | 'archived';
  effectiveDate: string;
  lastReviewDate: string;
  nextReviewDate: string;
  owner: string;
  approver: string;
  tags: string[];
  complianceFrameworks: string[];
}

interface PolicyListProps {
  onSelectPolicy: (policyId: string) => void;
  selectedPolicy: string | null;
}

export default function PolicyList({ onSelectPolicy, selectedPolicy }: PolicyListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  // Use the API hook to fetch policies
  const { data: policiesData, loading, error } = usePolicies();
  const policies = policiesData?.data || [];

  // Mock data for development if no policies from API
  const mockPolicies: Policy[] = [
    {
      id: '1',
      title: 'Information Security Policy',
      category: 'Security',
      description: 'Establishes the framework for protecting company and client information assets',
      version: '2.3',
      status: 'active',
      effectiveDate: '2024-01-15',
      lastReviewDate: '2024-07-15',
      nextReviewDate: '2025-01-15',
      owner: 'Sarah Chen',
      approver: 'Michael Torres',
      tags: ['mandatory', 'high-priority'],
      complianceFrameworks: ['SOC 2', 'ISO 27001'],
    },
    {
      id: '2',
      title: 'Access Control Policy',
      category: 'Security',
      description: 'Defines requirements for granting, reviewing, and revoking access to systems',
      version: '1.8',
      status: 'active',
      effectiveDate: '2024-02-01',
      lastReviewDate: '2024-07-01',
      nextReviewDate: '2025-02-01',
      owner: 'David Park',
      approver: 'Sarah Chen',
      tags: ['critical', 'TSC-CC6.1'],
      complianceFrameworks: ['SOC 2', 'SOC 1'],
    },
    {
      id: '3',
      title: 'Incident Response Policy',
      category: 'Operations',
      description:
        'Procedures for detecting, responding to, and recovering from security incidents',
      version: '3.1',
      status: 'review',
      effectiveDate: '2023-11-01',
      lastReviewDate: '2024-05-01',
      nextReviewDate: '2024-11-01',
      owner: 'Alex Johnson',
      approver: 'Lisa Martinez',
      tags: ['urgent-review', 'TSC-CC7.3'],
      complianceFrameworks: ['SOC 2'],
    },
    {
      id: '4',
      title: 'Data Classification Policy',
      category: 'Privacy',
      description: 'Framework for classifying and handling data based on sensitivity',
      version: '2.0',
      status: 'active',
      effectiveDate: '2024-03-01',
      lastReviewDate: '2024-06-15',
      nextReviewDate: '2025-03-01',
      owner: 'Maria Garcia',
      approver: 'Robert Anderson',
      tags: ['privacy', 'TSC-P1.1'],
      complianceFrameworks: ['SOC 2', 'GDPR'],
    },
    {
      id: '5',
      title: 'Business Continuity Policy',
      category: 'Availability',
      description: 'Ensures critical business functions can continue during and after a disaster',
      version: '1.5',
      status: 'draft',
      effectiveDate: '2024-04-01',
      lastReviewDate: '2024-04-01',
      nextReviewDate: '2025-04-01',
      owner: 'Thomas Brown',
      approver: 'Sarah Chen',
      tags: ['draft', 'TSC-A1.2'],
      complianceFrameworks: ['SOC 2'],
    },
    {
      id: '6',
      title: 'Change Management Policy',
      category: 'Operations',
      description: 'Controls for managing changes to production systems and infrastructure',
      version: '2.2',
      status: 'active',
      effectiveDate: '2024-01-01',
      lastReviewDate: '2024-07-01',
      nextReviewDate: '2025-01-01',
      owner: 'Rachel Green',
      approver: 'David Park',
      tags: ['change-control', 'TSC-CC8.1'],
      complianceFrameworks: ['SOC 2', 'SOC 1'],
    },
    {
      id: '7',
      title: 'Vendor Management Policy',
      category: 'Security',
      description: 'Requirements for assessing and monitoring third-party service providers',
      version: '1.9',
      status: 'active',
      effectiveDate: '2024-02-15',
      lastReviewDate: '2024-06-15',
      nextReviewDate: '2025-02-15',
      owner: 'James Thompson',
      approver: 'Maria Garcia',
      tags: ['vendor-risk', 'TSC-CC9.2'],
      complianceFrameworks: ['SOC 2'],
    },
    {
      id: '8',
      title: 'Employee Security Awareness Training Policy',
      category: 'Security',
      description: 'Mandatory security training requirements for all employees',
      version: '1.3',
      status: 'active',
      effectiveDate: '2024-01-01',
      lastReviewDate: '2024-07-01',
      nextReviewDate: '2025-01-01',
      owner: 'Linda Martinez',
      approver: 'Alex Johnson',
      tags: ['training', 'TSC-CC1.4'],
      complianceFrameworks: ['SOC 2', 'ISO 27001'],
    },
  ];

  // Use API data if available, otherwise use mock data
  const displayPolicies = policies.length > 0 ? policies : mockPolicies;

  const categories = ['All', 'Security', 'Operations', 'Privacy', 'Availability'];

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Security':
        return ShieldCheckIcon;
      case 'Operations':
        return ServerIcon;
      case 'Privacy':
        return LockClosedIcon;
      case 'Availability':
        return UserGroupIcon;
      default:
        return DocumentTextIcon;
    }
  };

  const getStatusColor = (status: Policy['status']) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'draft':
        return 'bg-gray-100 text-gray-800';
      case 'review':
        return 'bg-yellow-100 text-yellow-800';
      case 'archived':
        return 'bg-red-100 text-red-800';
    }
  };

  const getStatusIcon = (status: Policy['status']) => {
    switch (status) {
      case 'active':
        return <CheckCircleIcon className="h-4 w-4" />;
      case 'draft':
        return <PencilIcon className="h-4 w-4" />;
      case 'review':
        return <ClockIcon className="h-4 w-4" />;
      case 'archived':
        return <TrashIcon className="h-4 w-4" />;
    }
  };

  const filteredPolicies = displayPolicies.filter((policy) => {
    const matchesSearch =
      policy.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      policy.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === 'all' || policy.category === filterCategory;
    const matchesStatus = filterStatus === 'all' || policy.status === filterStatus;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const needsReview = displayPolicies.filter((p) => {
    const nextReview = new Date(p.nextReviewDate);
    const today = new Date();
    const daysUntilReview = Math.ceil(
      (nextReview.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysUntilReview <= 30;
  }).length;

  if (loading && displayPolicies.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-yellow-900">Policy Review Required</p>
            <p className="text-yellow-800">{needsReview} policies need review within 30 days</p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search policies..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>

        <div className="flex gap-2">
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            {categories.map((cat) => (
              <option key={cat} value={cat.toLowerCase()}>
                {cat}
              </option>
            ))}
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="draft">Draft</option>
            <option value="review">Under Review</option>
            <option value="archived">Archived</option>
          </select>
        </div>
      </div>

      <div className="space-y-2">
        {filteredPolicies.map((policy) => {
          const Icon = getCategoryIcon(policy.category);
          const isSelected = selectedPolicy === policy.id;
          const nextReview = new Date(policy.nextReviewDate);
          const today = new Date();
          const daysUntilReview = Math.ceil(
            (nextReview.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
          );
          const needsReviewSoon = daysUntilReview <= 30;

          return (
            <div
              key={policy.id}
              onClick={() => onSelectPolicy(policy.id)}
              className={`
                bg-white border rounded-lg p-4 cursor-pointer transition-all
                ${
                  isSelected
                    ? 'border-primary-500 ring-2 ring-primary-200'
                    : 'border-gray-200 hover:border-gray-300'
                }
              `}
            >
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${isSelected ? 'bg-primary-100' : 'bg-gray-100'}`}>
                  <Icon
                    className={`h-5 w-5 ${isSelected ? 'text-primary-600' : 'text-gray-600'}`}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between mb-1">
                    <h3 className="font-medium text-gray-900">{policy.title}</h3>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(policy.status)}`}
                    >
                      {getStatusIcon(policy.status)}
                      {policy.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{policy.description}</p>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span>v{policy.version}</span>
                    <span>Owner: {policy.owner}</span>
                    {needsReviewSoon && (
                      <span className="text-yellow-600 font-medium">
                        Review in {daysUntilReview} days
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    {policy.complianceFrameworks.map((framework) => (
                      <span
                        key={framework}
                        className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded"
                      >
                        {framework}
                      </span>
                    ))}
                    {policy.tags.slice(0, 2).map((tag) => (
                      <span
                        key={tag}
                        className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredPolicies.length === 0 && (
        <div className="text-center py-8">
          <DocumentTextIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No policies found matching your filters</p>
        </div>
      )}
    </div>
  );
}
