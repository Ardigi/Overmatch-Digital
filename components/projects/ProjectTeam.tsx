'use client';

import { EnvelopeIcon, PhoneIcon } from '@heroicons/react/24/outline';
import { UserCircleIcon } from '@heroicons/react/24/solid';

interface TeamMember {
  id: string;
  name: string;
  role: string;
  email: string;
  phone?: string;
  image?: string;
  type: 'internal' | 'cpa';
}

const teamMembers: TeamMember[] = [
  {
    id: '1',
    name: 'Sarah Chen',
    role: 'Lead Auditor',
    email: 'sarah.chen@overmatch.com',
    phone: '(555) 123-4567',
    type: 'internal',
  },
  {
    id: '2',
    name: 'Michael Johnson',
    role: 'Security Specialist',
    email: 'michael.j@overmatch.com',
    phone: '(555) 123-4568',
    type: 'internal',
  },
  {
    id: '3',
    name: 'Emily Rodriguez',
    role: 'Compliance Analyst',
    email: 'emily.r@overmatch.com',
    type: 'internal',
  },
  {
    id: '4',
    name: 'David Kim',
    role: 'CPA Partner',
    email: 'dkim@kimcpa.com',
    phone: '(555) 987-6543',
    type: 'cpa',
  },
  {
    id: '5',
    name: 'Lisa Thompson',
    role: 'CPA Senior Associate',
    email: 'lthompson@kimcpa.com',
    type: 'cpa',
  },
];

interface ProjectTeamProps {
  projectId: string;
}

export default function ProjectTeam({ projectId }: ProjectTeamProps) {
  const internalTeam = teamMembers.filter((m) => m.type === 'internal');
  const cpaTeam = teamMembers.filter((m) => m.type === 'cpa');

  return (
    <div className="space-y-6">
      {/* Internal Team */}
      <div>
        <h4 className="text-sm font-medium text-gray-900 mb-3">Overmatch Digital Team</h4>
        <ul className="space-y-3">
          {internalTeam.map((member) => (
            <li key={member.id} className="flex items-start">
              <div className="flex-shrink-0">
                {member.image ? (
                  <img className="h-10 w-10 rounded-full" src={member.image} alt="" />
                ) : (
                  <UserCircleIcon className="h-10 w-10 text-gray-400" />
                )}
              </div>
              <div className="ml-3 flex-1">
                <p className="text-sm font-medium text-gray-900">{member.name}</p>
                <p className="text-xs text-gray-500">{member.role}</p>
                <div className="mt-1 flex items-center space-x-3 text-xs">
                  <a href={`mailto:${member.email}`} className="text-gray-500 hover:text-gray-700">
                    <EnvelopeIcon className="h-3 w-3 inline mr-1" />
                    {member.email}
                  </a>
                  {member.phone && (
                    <a href={`tel:${member.phone}`} className="text-gray-500 hover:text-gray-700">
                      <PhoneIcon className="h-3 w-3 inline mr-1" />
                      {member.phone}
                    </a>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* CPA Team */}
      <div>
        <h4 className="text-sm font-medium text-gray-900 mb-3">CPA Partner Team</h4>
        <ul className="space-y-3">
          {cpaTeam.map((member) => (
            <li key={member.id} className="flex items-start">
              <div className="flex-shrink-0">
                {member.image ? (
                  <img className="h-10 w-10 rounded-full" src={member.image} alt="" />
                ) : (
                  <UserCircleIcon className="h-10 w-10 text-gray-400" />
                )}
              </div>
              <div className="ml-3 flex-1">
                <p className="text-sm font-medium text-gray-900">{member.name}</p>
                <p className="text-xs text-gray-500">{member.role}</p>
                <div className="mt-1 flex items-center space-x-3 text-xs">
                  <a href={`mailto:${member.email}`} className="text-gray-500 hover:text-gray-700">
                    <EnvelopeIcon className="h-3 w-3 inline mr-1" />
                    {member.email}
                  </a>
                  {member.phone && (
                    <a href={`tel:${member.phone}`} className="text-gray-500 hover:text-gray-700">
                      <PhoneIcon className="h-3 w-3 inline mr-1" />
                      {member.phone}
                    </a>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Add Team Member */}
      <div className="pt-4 border-t border-gray-200">
        <button className="text-sm text-primary-600 hover:text-primary-500">
          + Add team member
        </button>
      </div>
    </div>
  );
}
