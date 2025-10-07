'use client';

import {
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  CalendarIcon,
  ChatBubbleLeftRightIcon,
  CheckCircleIcon,
  ClockIcon,
  DocumentTextIcon,
  PencilSquareIcon,
  TagIcon,
  UserCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import { useState } from 'react';

interface PolicyEditorProps {
  policyId: string;
  onClose: () => void;
}

export default function PolicyEditor({ policyId, onClose }: PolicyEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState('content');

  // Mock policy data
  const policy = {
    id: policyId,
    title: 'Information Security Policy',
    category: 'Security',
    version: '2.3',
    status: 'active',
    effectiveDate: '2024-01-15',
    lastReviewDate: '2024-07-15',
    nextReviewDate: '2025-01-15',
    owner: 'Sarah Chen',
    approver: 'Michael Torres',
    content: `
# Information Security Policy

## 1. Purpose
This policy establishes the framework for protecting Overmatch Digital's information assets and those of our clients. It ensures the confidentiality, integrity, and availability of information in accordance with SOC 2 Type II requirements.

## 2. Scope
This policy applies to all employees, contractors, consultants, temporary workers, and other personnel who have access to Overmatch Digital's information systems and data.

## 3. Policy Statement
Overmatch Digital is committed to protecting its information assets from unauthorized access, disclosure, modification, or destruction. All personnel must comply with this policy and related security procedures.

## 4. Responsibilities

### 4.1 Chief Information Security Officer (CISO)
- Develop and maintain the information security program
- Conduct regular risk assessments
- Report security metrics to executive management

### 4.2 Department Heads
- Ensure compliance within their departments
- Identify and report security risks
- Support security training initiatives

### 4.3 All Personnel
- Protect confidential information
- Report security incidents immediately
- Complete required security training

## 5. Key Security Controls

### 5.1 Access Control
- Principle of least privilege
- Regular access reviews (quarterly)
- Multi-factor authentication for critical systems

### 5.2 Data Protection
- Encryption at rest and in transit
- Data classification and handling procedures
- Secure disposal of sensitive information

### 5.3 Incident Response
- 24/7 incident response team
- Defined escalation procedures
- Post-incident reviews and lessons learned

## 6. Compliance
Violations of this policy may result in disciplinary action, up to and including termination. Legal action may be pursued for serious breaches.

## 7. Review and Updates
This policy will be reviewed annually and updated as needed to address emerging threats and regulatory changes.
    `,
    relatedControls: [
      { id: 'CC6.1', name: 'Logical and Physical Access Controls', framework: 'TSC' },
      { id: 'CC6.2', name: 'Prior to Issuing System Credentials', framework: 'TSC' },
      { id: 'CC6.3', name: 'Role-Based Access Control', framework: 'TSC' },
      { id: 'CC7.2', name: 'Security Incident Response', framework: 'TSC' },
    ],
    revisionHistory: [
      {
        version: '2.3',
        date: '2024-07-15',
        author: 'Sarah Chen',
        changes: 'Added cloud security requirements',
      },
      {
        version: '2.2',
        date: '2024-04-01',
        author: 'David Park',
        changes: 'Updated incident response procedures',
      },
      {
        version: '2.1',
        date: '2024-01-15',
        author: 'Sarah Chen',
        changes: 'Annual review - minor updates',
      },
      {
        version: '2.0',
        date: '2023-07-15',
        author: 'Michael Torres',
        changes: 'Major revision for SOC 2 compliance',
      },
    ],
    comments: [
      {
        id: '1',
        author: 'Alex Johnson',
        date: '2024-07-10',
        text: 'Should we add specific requirements for API security?',
      },
      {
        id: '2',
        author: 'Sarah Chen',
        date: '2024-07-11',
        text: "Good suggestion. I'll include that in the next revision.",
      },
    ],
  };

  const tabs = [
    { id: 'content', label: 'Policy Content' },
    { id: 'controls', label: 'Related Controls' },
    { id: 'history', label: 'Revision History' },
    { id: 'comments', label: 'Comments' },
  ];

  return (
    <div className="bg-white border border-gray-200 rounded-lg h-full flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <DocumentTextIcon className="h-6 w-6 text-gray-400" />
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{policy.title}</h2>
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <span>Version {policy.version}</span>
              <span className="flex items-center gap-1">
                <UserCircleIcon className="h-4 w-4" />
                {policy.owner}
              </span>
              <span className="flex items-center gap-1">
                <CalendarIcon className="h-4 w-4" />
                Effective: {format(new Date(policy.effectiveDate), 'MMM d, yyyy')}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isEditing ? (
            <>
              <button
                onClick={() => setIsEditing(true)}
                className="btn-secondary flex items-center gap-2"
              >
                <PencilSquareIcon className="h-5 w-5" />
                Edit
              </button>
              <button className="p-2 text-gray-400 hover:text-gray-600">
                <ArrowDownTrayIcon className="h-5 w-5" />
              </button>
              <button className="p-2 text-gray-400 hover:text-gray-600">
                <ArrowUpTrayIcon className="h-5 w-5" />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  setEditedContent(displayPolicy.content);
                  setIsEditing(false);
                }}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={updatePolicy.loading}
                className="btn-primary flex items-center gap-2"
              >
                {updatePolicy.loading && <LoadingSpinner size="sm" />}
                Save Changes
              </button>
            </>
          )}
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="border-b border-gray-200">
        <nav className="flex space-x-8 px-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                py-3 px-1 border-b-2 font-medium text-sm
                ${
                  activeTab === tab.id
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'content' && (
          <div className="prose max-w-none">
            {isEditing ? (
              <textarea
                className="w-full h-full p-4 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                defaultValue={policy.content}
                placeholder="Enter policy content in Markdown format..."
              />
            ) : (
              <div className="whitespace-pre-wrap font-sans">{policy.content}</div>
            )}
          </div>
        )}

        {activeTab === 'controls' && (
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Related SOC 2 Controls</h3>
            {policy.relatedControls.map((control) => (
              <div key={control.id} className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-gray-900">
                      {control.id} - {control.name}
                    </h4>
                    <p className="text-sm text-gray-600 mt-1">Framework: {control.framework}</p>
                  </div>
                  <CheckCircleIcon className="h-5 w-5 text-green-600" />
                </div>
              </div>
            ))}
            <button className="btn-secondary w-full mt-4">Link Additional Controls</button>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Revision History</h3>
            {policy.revisionHistory.map((revision, index) => (
              <div key={index} className="flex items-start gap-3">
                <div className="mt-0.5">
                  <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center">
                    <ClockIcon className="h-4 w-4 text-gray-600" />
                  </div>
                </div>
                <div className="flex-1">
                  <div className="bg-white border border-gray-200 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-medium text-gray-900">Version {revision.version}</h4>
                      <span className="text-sm text-gray-500">
                        {format(new Date(revision.date), 'MMM d, yyyy')}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">{revision.changes}</p>
                    <p className="text-xs text-gray-500 mt-1">by {revision.author}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'comments' && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Comments & Discussion</h3>
            {policy.comments.map((comment) => (
              <div key={comment.id} className="flex items-start gap-3">
                <UserCircleIcon className="h-8 w-8 text-gray-400" />
                <div className="flex-1">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-medium text-gray-900">{comment.author}</h4>
                      <span className="text-xs text-gray-500">
                        {format(new Date(comment.date), 'MMM d, yyyy')}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700">{comment.text}</p>
                  </div>
                </div>
              </div>
            ))}
            <div className="mt-4">
              <textarea
                placeholder="Add a comment..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                rows={3}
              />
              <button className="btn-primary mt-2">Post Comment</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
