'use client';

import {
  CheckBadgeIcon,
  EnvelopeIcon,
  PhoneIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline';
import { useState } from 'react';

interface TeamMember {
  id: string;
  name: string;
  role: string;
  email: string;
  phone: string;
  status: 'online' | 'offline' | 'busy';
  lastActive: string;
  permissions: string[];
  organization: string;
  avatar?: string;
}

const teamMembers: TeamMember[] = [
  {
    id: '1',
    name: 'Sarah Johnson',
    role: 'Lead CPA',
    email: 'sarah.johnson@cpa-firm.com',
    phone: '+1 (555) 123-4567',
    status: 'online',
    lastActive: 'Active now',
    permissions: ['view_all', 'edit_reports', 'sign_attestations'],
    organization: 'Johnson & Associates CPA',
  },
  {
    id: '2',
    name: 'Michael Chen',
    role: 'Senior Auditor',
    email: 'michael.chen@cpa-firm.com',
    phone: '+1 (555) 234-5678',
    status: 'busy',
    lastActive: '2 hours ago',
    permissions: ['view_all', 'edit_workpapers', 'review_evidence'],
    organization: 'Johnson & Associates CPA',
  },
  {
    id: '3',
    name: 'Emily Rodriguez',
    role: 'Compliance Specialist',
    email: 'emily.rodriguez@company.com',
    phone: '+1 (555) 345-6789',
    status: 'online',
    lastActive: 'Active now',
    permissions: ['view_all', 'upload_evidence', 'manage_controls'],
    organization: 'Your Organization',
  },
  {
    id: '4',
    name: 'David Kim',
    role: 'IT Manager',
    email: 'david.kim@company.com',
    phone: '+1 (555) 456-7890',
    status: 'offline',
    lastActive: 'Yesterday at 5:30 PM',
    permissions: ['view_technical', 'manage_integrations', 'export_logs'],
    organization: 'Your Organization',
  },
];

const statusColors = {
  online: 'bg-green-400',
  offline: 'bg-gray-400',
  busy: 'bg-yellow-400',
};

export default function TeamOverview() {
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-medium text-gray-900">Audit Team Members</h2>
        <p className="mt-1 text-sm text-gray-500">
          Collaborate with your CPA firm and internal team members
        </p>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {teamMembers.map((member) => (
            <div
              key={member.id}
              className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => setSelectedMember(member)}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center">
                  <div className="relative">
                    <UserCircleIcon className="h-12 w-12 text-gray-400" />
                    <div
                      className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white ${
                        statusColors[member.status]
                      }`}
                    />
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-gray-900">{member.name}</h3>
                    <p className="text-sm text-gray-500">{member.role}</p>
                    <p className="text-xs text-gray-400">{member.organization}</p>
                  </div>
                </div>
                {member.organization.includes('CPA') && (
                  <CheckBadgeIcon className="h-5 w-5 text-blue-500" title="Verified CPA" />
                )}
              </div>

              <div className="mt-3 flex items-center text-xs text-gray-500">
                <span className="flex items-center">
                  <div className={`h-2 w-2 rounded-full mr-1 ${statusColors[member.status]}`} />
                  {member.lastActive}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap gap-1">
                {member.permissions.slice(0, 2).map((permission) => (
                  <span
                    key={permission}
                    className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700"
                  >
                    {permission.replace(/_/g, ' ')}
                  </span>
                ))}
                {member.permissions.length > 2 && (
                  <span className="text-xs text-gray-500">
                    +{member.permissions.length - 2} more
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="mt-6 flex items-center justify-between">
          <div className="flex space-x-2">
            <button className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
              <EnvelopeIcon className="h-3.5 w-3.5 mr-1" />
              Message All
            </button>
            <button className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
              <PhoneIcon className="h-3.5 w-3.5 mr-1" />
              Schedule Call
            </button>
          </div>
          <button className="text-sm text-primary-600 hover:text-primary-500">Manage Team</button>
        </div>
      </div>
    </div>
  );
}
