'use client';

import {
  ArrowPathIcon,
  ChatBubbleLeftRightIcon,
  CheckCircleIcon,
  ClockIcon,
  DocumentDuplicateIcon,
  DocumentTextIcon,
  ExclamationCircleIcon,
  EyeIcon,
  FolderOpenIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  PlusIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import { useState } from 'react';
import { formatDate, formatDateTime } from '@/lib/utils';

interface Workpaper {
  id: string;
  title: string;
  client: string;
  control: string;
  type: 'narrative' | 'walkthrough' | 'test_of_design' | 'test_of_effectiveness';
  status: 'draft' | 'in_review' | 'approved' | 'needs_revision';
  assignedTo: string;
  reviewer?: string;
  createdAt: string;
  updatedAt: string;
  version: number;
  findings: number;
  comments: number;
  testingPeriod?: string;
}

const mockWorkpapers: Workpaper[] = [
  {
    id: '1',
    title: 'Access Control Review - Q1 2024',
    client: 'Acme Corporation',
    control: 'CC6.1',
    type: 'test_of_effectiveness',
    status: 'in_review',
    assignedTo: 'Sarah Johnson',
    reviewer: 'Mike Chen',
    createdAt: '2024-02-15T10:00:00Z',
    updatedAt: '2024-02-20T14:30:00Z',
    version: 3,
    findings: 2,
    comments: 5,
    testingPeriod: 'Q1 2024',
  },
  {
    id: '2',
    title: 'Change Management Process Walkthrough',
    client: 'TechCorp Solutions',
    control: 'CC8.1',
    type: 'walkthrough',
    status: 'approved',
    assignedTo: 'John Doe',
    reviewer: 'Sarah Johnson',
    createdAt: '2024-02-10T09:00:00Z',
    updatedAt: '2024-02-18T16:00:00Z',
    version: 2,
    findings: 0,
    comments: 3,
  },
  {
    id: '3',
    title: 'Security Training Program Design',
    client: 'Financial Services Inc',
    control: 'CC1.4',
    type: 'test_of_design',
    status: 'needs_revision',
    assignedTo: 'Emily Brown',
    reviewer: 'Mike Chen',
    createdAt: '2024-02-18T11:00:00Z',
    updatedAt: '2024-02-19T15:45:00Z',
    version: 2,
    findings: 1,
    comments: 8,
  },
];

export default function WorkpapersPage() {
  const [workpapers] = useState<Workpaper[]>(mockWorkpapers);
  const [selectedClient, setSelectedClient] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');

  const getStatusBadge = (status: Workpaper['status']) => {
    const badges = {
      draft: 'bg-gray-100 text-gray-800',
      in_review: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      needs_revision: 'bg-red-100 text-red-800',
    };

    const icons = {
      draft: <PencilSquareIcon className="w-3 h-3" />,
      in_review: <ClockIcon className="w-3 h-3" />,
      approved: <CheckCircleIcon className="w-3 h-3" />,
      needs_revision: <ExclamationCircleIcon className="w-3 h-3" />,
    };

    return (
      <span
        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${badges[status]}`}
      >
        {icons[status]}
        {status.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
      </span>
    );
  };

  const getTypeBadge = (type: Workpaper['type']) => {
    const typeLabels = {
      narrative: 'Narrative',
      walkthrough: 'Walkthrough',
      test_of_design: 'Test of Design',
      test_of_effectiveness: 'Test of Effectiveness',
    };

    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-700 text-xs font-medium">
        {typeLabels[type]}
      </span>
    );
  };

  const filteredWorkpapers = workpapers.filter((wp) => {
    const matchesSearch =
      wp.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      wp.control.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesClient = selectedClient === 'all' || wp.client === selectedClient;
    const matchesStatus = selectedStatus === 'all' || wp.status === selectedStatus;
    const matchesType = selectedType === 'all' || wp.type === selectedType;

    return matchesSearch && matchesClient && matchesStatus && matchesType;
  });

  const clients = ['all', ...new Set(workpapers.map((wp) => wp.client))];

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audit Workpapers</h1>
          <p className="mt-1 text-sm text-gray-600">
            Create, review, and manage audit documentation
          </p>
        </div>
        <button className="btn-primary flex items-center gap-2">
          <PlusIcon className="h-5 w-5" />
          New Workpaper
        </button>
      </div>

      {/* Filters and Search */}
      <div className="bg-white shadow rounded-lg mb-6">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search workpapers..."
                  className="pl-10 pr-3 py-2 w-full border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-2">
              <select
                value={selectedClient}
                onChange={(e) => setSelectedClient(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
              >
                {clients.map((client) => (
                  <option key={client} value={client}>
                    {client === 'all' ? 'All Clients' : client}
                  </option>
                ))}
              </select>

              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="all">All Status</option>
                <option value="draft">Draft</option>
                <option value="in_review">In Review</option>
                <option value="approved">Approved</option>
                <option value="needs_revision">Needs Revision</option>
              </select>

              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="all">All Types</option>
                <option value="narrative">Narrative</option>
                <option value="walkthrough">Walkthrough</option>
                <option value="test_of_design">Test of Design</option>
                <option value="test_of_effectiveness">Test of Effectiveness</option>
              </select>

              {/* View Mode Toggle */}
              <div className="flex border border-gray-300 rounded-md">
                <button
                  onClick={() => setViewMode('list')}
                  className={`px-3 py-2 ${viewMode === 'list' ? 'bg-gray-100' : ''}`}
                >
                  <FunnelIcon className="h-5 w-5" />
                </button>
                <button
                  onClick={() => setViewMode('grid')}
                  className={`px-3 py-2 ${viewMode === 'grid' ? 'bg-gray-100' : ''}`}
                >
                  <FolderOpenIcon className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Workpapers List/Grid */}
        {viewMode === 'list' ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Workpaper
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Client / Control
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Assigned / Reviewer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Activity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredWorkpapers.map((wp) => (
                  <tr key={wp.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{wp.title}</p>
                        <p className="text-xs text-gray-500">Version {wp.version}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-sm text-gray-900">{wp.client}</p>
                        <p className="text-xs text-gray-500">Control {wp.control}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">{getTypeBadge(wp.type)}</td>
                    <td className="px-6 py-4">{getStatusBadge(wp.status)}</td>
                    <td className="px-6 py-4">
                      <div className="text-sm">
                        <p className="text-gray-900">{wp.assignedTo}</p>
                        {wp.reviewer && (
                          <p className="text-xs text-gray-500">Review: {wp.reviewer}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4 text-sm">
                        {wp.findings > 0 && (
                          <span className="flex items-center gap-1 text-red-600">
                            <ExclamationCircleIcon className="h-4 w-4" />
                            {wp.findings}
                          </span>
                        )}
                        <span className="flex items-center gap-1 text-gray-500">
                          <ChatBubbleLeftRightIcon className="h-4 w-4" />
                          {wp.comments}
                        </span>
                        <span className="text-xs text-gray-500">{formatDate(wp.updatedAt)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button className="text-primary-600 hover:text-primary-900" title="View">
                          <EyeIcon className="h-5 w-5" />
                        </button>
                        <button className="text-gray-600 hover:text-gray-900" title="Edit">
                          <PencilSquareIcon className="h-5 w-5" />
                        </button>
                        <button
                          className="text-gray-600 hover:text-gray-900"
                          title="Version History"
                        >
                          <ArrowPathIcon className="h-5 w-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredWorkpapers.map((wp) => (
              <div
                key={wp.id}
                className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <DocumentTextIcon className="h-5 w-5 text-gray-400" />
                    <h3 className="text-sm font-medium text-gray-900 line-clamp-1">{wp.title}</h3>
                  </div>
                  {getStatusBadge(wp.status)}
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Client:</span>
                    <span className="text-gray-900">{wp.client}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Control:</span>
                    <span className="text-gray-900">{wp.control}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Type:</span>
                    {getTypeBadge(wp.type)}
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-between">
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    {wp.findings > 0 && (
                      <span className="flex items-center gap-1 text-red-600">
                        <ExclamationCircleIcon className="h-3 w-3" />
                        {wp.findings}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <ChatBubbleLeftRightIcon className="h-3 w-3" />
                      {wp.comments}
                    </span>
                  </div>
                  <button className="text-primary-600 hover:text-primary-700 text-sm font-medium">
                    Open
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Workpapers</p>
              <p className="text-2xl font-bold text-gray-900">{workpapers.length}</p>
            </div>
            <DocumentTextIcon className="h-8 w-8 text-gray-400" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">In Review</p>
              <p className="text-2xl font-bold text-yellow-600">
                {workpapers.filter((wp) => wp.status === 'in_review').length}
              </p>
            </div>
            <ClockIcon className="h-8 w-8 text-yellow-400" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Needs Revision</p>
              <p className="text-2xl font-bold text-red-600">
                {workpapers.filter((wp) => wp.status === 'needs_revision').length}
              </p>
            </div>
            <ExclamationCircleIcon className="h-8 w-8 text-red-400" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Approved</p>
              <p className="text-2xl font-bold text-green-600">
                {workpapers.filter((wp) => wp.status === 'approved').length}
              </p>
            </div>
            <CheckCircleIcon className="h-8 w-8 text-green-400" />
          </div>
        </div>
      </div>
    </div>
  );
}
