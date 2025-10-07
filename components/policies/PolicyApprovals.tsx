'use client';

import {
  CalendarIcon,
  ChatBubbleLeftRightIcon,
  CheckBadgeIcon,
  CheckIcon,
  ClockIcon,
  DocumentTextIcon,
  UserCircleIcon,
  XCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import { useState } from 'react';

interface ApprovalRequest {
  id: string;
  policyTitle: string;
  policyId: string;
  version: string;
  requestedBy: string;
  requestDate: string;
  approver: string;
  status: 'pending' | 'approved' | 'rejected' | 'revision';
  priority: 'high' | 'medium' | 'low';
  dueDate: string;
  changes: string;
  comments?: string;
}

export default function PolicyApprovals() {
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedRequest, setSelectedRequest] = useState<string | null>(null);

  // Mock approval requests
  const approvalRequests: ApprovalRequest[] = [
    {
      id: '1',
      policyTitle: 'Incident Response Policy',
      policyId: '3',
      version: '3.2',
      requestedBy: 'Alex Johnson',
      requestDate: '2024-07-18',
      approver: 'Lisa Martinez',
      status: 'pending',
      priority: 'high',
      dueDate: '2024-07-25',
      changes: 'Updated incident escalation procedures and added cloud-specific incident types',
    },
    {
      id: '2',
      policyTitle: 'Data Retention Policy',
      policyId: '8',
      version: '1.4',
      requestedBy: 'Maria Garcia',
      requestDate: '2024-07-17',
      approver: 'Robert Anderson',
      status: 'pending',
      priority: 'medium',
      dueDate: '2024-07-31',
      changes: 'Added GDPR-specific retention requirements for EU customer data',
    },
    {
      id: '3',
      policyTitle: 'Access Control Policy',
      policyId: '2',
      version: '1.9',
      requestedBy: 'David Park',
      requestDate: '2024-07-15',
      approver: 'Sarah Chen',
      status: 'approved',
      priority: 'high',
      dueDate: '2024-07-20',
      changes: 'Implemented zero-trust security model requirements',
      comments: 'Excellent updates. Approved for immediate implementation.',
    },
    {
      id: '4',
      policyTitle: 'Vendor Management Policy',
      policyId: '7',
      version: '2.0',
      requestedBy: 'James Thompson',
      requestDate: '2024-07-14',
      approver: 'Maria Garcia',
      status: 'revision',
      priority: 'medium',
      dueDate: '2024-07-28',
      changes: 'Enhanced third-party risk assessment criteria',
      comments: 'Please add specific requirements for cloud service providers.',
    },
    {
      id: '5',
      policyTitle: 'Business Continuity Policy',
      policyId: '5',
      version: '1.6',
      requestedBy: 'Thomas Brown',
      requestDate: '2024-07-10',
      approver: 'Sarah Chen',
      status: 'rejected',
      priority: 'low',
      dueDate: '2024-07-24',
      changes: 'Minor formatting updates',
      comments: 'Changes too minor to warrant a new version. Include in next scheduled review.',
    },
  ];

  const getStatusColor = (status: ApprovalRequest['status']) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      case 'revision':
        return 'bg-blue-100 text-blue-800';
    }
  };

  const getStatusIcon = (status: ApprovalRequest['status']) => {
    switch (status) {
      case 'pending':
        return <ClockIcon className="h-4 w-4" />;
      case 'approved':
        return <CheckBadgeIcon className="h-4 w-4" />;
      case 'rejected':
        return <XCircleIcon className="h-4 w-4" />;
      case 'revision':
        return <ChatBubbleLeftRightIcon className="h-4 w-4" />;
    }
  };

  const getPriorityColor = (priority: ApprovalRequest['priority']) => {
    switch (priority) {
      case 'high':
        return 'text-red-600';
      case 'medium':
        return 'text-yellow-600';
      case 'low':
        return 'text-green-600';
    }
  };

  const filteredRequests = approvalRequests.filter(
    (request) => filterStatus === 'all' || request.status === filterStatus
  );

  const stats = {
    pending: approvalRequests.filter((r) => r.status === 'pending').length,
    approved: approvalRequests.filter((r) => r.status === 'approved').length,
    revision: approvalRequests.filter((r) => r.status === 'revision').length,
    rejected: approvalRequests.filter((r) => r.status === 'rejected').length,
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-yellow-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.pending}</p>
              <p className="text-sm text-gray-600">Pending Review</p>
            </div>
            <ClockIcon className="h-8 w-8 text-yellow-600" />
          </div>
        </div>
        <div className="bg-green-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.approved}</p>
              <p className="text-sm text-gray-600">Approved</p>
            </div>
            <CheckBadgeIcon className="h-8 w-8 text-green-600" />
          </div>
        </div>
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.revision}</p>
              <p className="text-sm text-gray-600">Need Revision</p>
            </div>
            <ChatBubbleLeftRightIcon className="h-8 w-8 text-blue-600" />
          </div>
        </div>
        <div className="bg-red-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.rejected}</p>
              <p className="text-sm text-gray-600">Rejected</p>
            </div>
            <XCircleIcon className="h-8 w-8 text-red-600" />
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setFilterStatus('all')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            filterStatus === 'all'
              ? 'bg-primary-100 text-primary-700'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          All Requests
        </button>
        <button
          onClick={() => setFilterStatus('pending')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            filterStatus === 'pending'
              ? 'bg-primary-100 text-primary-700'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Pending
        </button>
        <button
          onClick={() => setFilterStatus('approved')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            filterStatus === 'approved'
              ? 'bg-primary-100 text-primary-700'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Approved
        </button>
        <button
          onClick={() => setFilterStatus('revision')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            filterStatus === 'revision'
              ? 'bg-primary-100 text-primary-700'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Needs Revision
        </button>
      </div>

      <div className="space-y-3">
        {filteredRequests.map((request) => {
          const isSelected = selectedRequest === request.id;
          const daysUntilDue = Math.ceil(
            (new Date(request.dueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
          );

          return (
            <div
              key={request.id}
              onClick={() => setSelectedRequest(request.id)}
              className={`
                bg-white border rounded-lg p-4 cursor-pointer transition-all
                ${
                  isSelected
                    ? 'border-primary-500 ring-2 ring-primary-200'
                    : 'border-gray-200 hover:border-gray-300'
                }
              `}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <DocumentTextIcon className="h-5 w-5 text-gray-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-medium text-gray-900">{request.policyTitle}</h3>
                      <span className="text-sm text-gray-500">v{request.version}</span>
                      <span className={`text-sm font-medium ${getPriorityColor(request.priority)}`}>
                        {request.priority} priority
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{request.changes}</p>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <UserCircleIcon className="h-4 w-4" />
                        Requested by {request.requestedBy}
                      </span>
                      <span className="flex items-center gap-1">
                        <CalendarIcon className="h-4 w-4" />
                        {format(new Date(request.requestDate), 'MMM d')}
                      </span>
                      <span>Approver: {request.approver}</span>
                      {request.status === 'pending' && daysUntilDue <= 7 && (
                        <span className="text-yellow-600 font-medium">
                          Due in {daysUntilDue} days
                        </span>
                      )}
                    </div>
                    {request.comments && (
                      <div className="mt-2 p-2 bg-gray-50 rounded text-sm text-gray-700">
                        <span className="font-medium">Comments:</span> {request.comments}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(request.status)}`}
                  >
                    {getStatusIcon(request.status)}
                    {request.status}
                  </span>
                  {request.status === 'pending' && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          // Handle approve
                        }}
                        className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors"
                      >
                        <CheckIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          // Handle reject
                        }}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                      >
                        <XMarkIcon className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredRequests.length === 0 && (
        <div className="text-center py-8">
          <CheckBadgeIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No approval requests found</p>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 mb-2">Approval Workflow</h4>
        <div className="text-sm text-blue-800 space-y-1">
          <p>1. Policy owner submits changes for review</p>
          <p>2. Designated approver receives notification</p>
          <p>3. Approver reviews changes and provides feedback</p>
          <p>4. Policy is approved, sent for revision, or rejected</p>
          <p>5. Approved policies are automatically published</p>
        </div>
      </div>
    </div>
  );
}
