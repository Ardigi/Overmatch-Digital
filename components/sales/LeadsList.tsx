'use client';

import {
  BuildingOfficeIcon,
  CalendarIcon,
  EnvelopeIcon,
  MagnifyingGlassIcon,
  PhoneIcon,
  PlusIcon,
  StarIcon,
  TagIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarSolidIcon } from '@heroicons/react/24/solid';
import { format } from 'date-fns';
import { useState } from 'react';

interface Lead {
  id: string;
  company: string;
  contact: string;
  title: string;
  email: string;
  phone: string;
  source: string;
  status: 'new' | 'contacted' | 'qualified' | 'unqualified';
  score: number;
  industry: string;
  estimatedValue: number;
  lastContact?: string;
  nextFollowUp?: string;
  notes: string;
  createdAt: string;
}

export default function LeadsList() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterSource, setFilterSource] = useState('all');
  const [showNewLead, setShowNewLead] = useState(false);

  // Mock data based on documentation's lead generation methods
  const leads: Lead[] = [
    {
      id: '1',
      company: 'TechStartup Inc',
      contact: 'Alex Johnson',
      title: 'Chief Technology Officer',
      email: 'alex.johnson@techstartup.com',
      phone: '(555) 123-4567',
      source: 'Conference',
      status: 'new',
      score: 85,
      industry: 'Software',
      estimatedValue: 120000,
      nextFollowUp: '2024-07-20',
      notes: 'Met at Cloud Security Summit. Very interested in SOC 2 for enterprise deals.',
      createdAt: '2024-07-15',
    },
    {
      id: '2',
      company: 'FinanceFlow Corp',
      contact: 'Maria Garcia',
      title: 'VP of Compliance',
      email: 'mgarcia@financeflow.com',
      phone: '(555) 234-5678',
      source: 'Referral',
      status: 'qualified',
      score: 92,
      industry: 'Financial Services',
      estimatedValue: 180000,
      lastContact: '2024-07-14',
      nextFollowUp: '2024-07-21',
      notes: 'Referred by existing client. Needs both SOC 1 and SOC 2.',
      createdAt: '2024-07-10',
    },
    {
      id: '3',
      company: 'HealthData Systems',
      contact: 'Dr. Robert Chen',
      title: 'Chief Information Security Officer',
      email: 'rchen@healthdata.com',
      phone: '(555) 345-6789',
      source: 'Content Marketing',
      status: 'contacted',
      score: 78,
      industry: 'Healthcare',
      estimatedValue: 150000,
      lastContact: '2024-07-13',
      nextFollowUp: '2024-07-18',
      notes: 'Downloaded SOC 2 guide. Interested in SOC 2 + HIPAA compliance.',
      createdAt: '2024-07-08',
    },
    {
      id: '4',
      company: 'E-Commerce Plus',
      contact: 'Sarah Williams',
      title: 'Director of Security',
      email: 'swilliams@ecomplus.com',
      phone: '(555) 456-7890',
      source: 'Digital Marketing',
      status: 'qualified',
      score: 88,
      industry: 'E-commerce',
      estimatedValue: 135000,
      lastContact: '2024-07-12',
      nextFollowUp: '2024-07-19',
      notes: 'Needs SOC 2 for payment processor requirements. Decision in Q3.',
      createdAt: '2024-07-05',
    },
    {
      id: '5',
      company: 'CloudServe Technologies',
      contact: 'James Thompson',
      title: 'CEO',
      email: 'jthompson@cloudserve.com',
      phone: '(555) 567-8901',
      source: 'Professional Network',
      status: 'new',
      score: 70,
      industry: 'Cloud Services',
      estimatedValue: 95000,
      nextFollowUp: '2024-07-17',
      notes: 'LinkedIn connection. Small but growing SaaS company.',
      createdAt: '2024-07-14',
    },
    {
      id: '6',
      company: 'DataSecure Inc',
      contact: 'Linda Martinez',
      title: 'Compliance Manager',
      email: 'lmartinez@datasecure.com',
      phone: '(555) 678-9012',
      source: 'SEO',
      status: 'unqualified',
      score: 45,
      industry: 'Technology',
      estimatedValue: 50000,
      lastContact: '2024-07-11',
      notes: 'Budget constraints. Revisit in 6 months.',
      createdAt: '2024-07-01',
    },
  ];

  const getStatusColor = (status: Lead['status']) => {
    switch (status) {
      case 'new':
        return 'bg-blue-100 text-blue-800';
      case 'contacted':
        return 'bg-yellow-100 text-yellow-800';
      case 'qualified':
        return 'bg-green-100 text-green-800';
      case 'unqualified':
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getScoreStars = (score: number) => {
    const stars = Math.round(score / 20);
    return Array.from({ length: 5 }, (_, i) => i < stars);
  };

  const filteredLeads = leads.filter((lead) => {
    const matchesSearch =
      lead.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.contact.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.email.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = filterStatus === 'all' || lead.status === filterStatus;
    const matchesSource = filterSource === 'all' || lead.source === filterSource;

    return matchesSearch && matchesStatus && matchesSource;
  });

  const sources = [
    'Conference',
    'Referral',
    'Content Marketing',
    'Digital Marketing',
    'Professional Network',
    'SEO',
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search leads..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>

        <div className="flex items-center gap-4">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="all">All Status</option>
            <option value="new">New</option>
            <option value="contacted">Contacted</option>
            <option value="qualified">Qualified</option>
            <option value="unqualified">Unqualified</option>
          </select>

          <select
            value={filterSource}
            onChange={(e) => setFilterSource(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="all">All Sources</option>
            {sources.map((source) => (
              <option key={source} value={source}>
                {source}
              </option>
            ))}
          </select>

          <button
            onClick={() => setShowNewLead(true)}
            className="btn-primary flex items-center gap-2"
          >
            <PlusIcon className="h-5 w-5" />
            Add Lead
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Lead
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Contact Info
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Source
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Score
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Next Action
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Value
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredLeads.map((lead) => (
              <tr key={lead.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{lead.company}</p>
                    <p className="text-sm text-gray-600">
                      {lead.contact} • {lead.title}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">{lead.industry}</p>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1 text-sm text-gray-600">
                      <EnvelopeIcon className="h-4 w-4" />
                      {lead.email}
                    </div>
                    <div className="flex items-center gap-1 text-sm text-gray-600">
                      <PhoneIcon className="h-4 w-4" />
                      {lead.phone}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-1">
                    <TagIcon className="h-4 w-4 text-gray-400" />
                    <span className="text-sm text-gray-900">{lead.source}</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div>
                    <div className="flex items-center gap-0.5">
                      {getScoreStars(lead.score).map((filled, i) =>
                        filled ? (
                          <StarSolidIcon key={i} className="h-4 w-4 text-yellow-400" />
                        ) : (
                          <StarIcon key={i} className="h-4 w-4 text-gray-300" />
                        )
                      )}
                    </div>
                    <p className="text-xs text-gray-600 mt-1">{lead.score}/100</p>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(lead.status)}`}
                  >
                    {lead.status}
                  </span>
                </td>
                <td className="px-6 py-4">
                  {lead.nextFollowUp && (
                    <div className="flex items-center gap-1 text-sm">
                      <CalendarIcon className="h-4 w-4 text-gray-400" />
                      <span className="text-gray-900">
                        {format(new Date(lead.nextFollowUp), 'MMM d')}
                      </span>
                    </div>
                  )}
                  {lead.lastContact && (
                    <p className="text-xs text-gray-500 mt-1">
                      Last: {format(new Date(lead.lastContact), 'MMM d')}
                    </p>
                  )}
                </td>
                <td className="px-6 py-4">
                  <p className="text-sm font-semibold text-gray-900">
                    ${lead.estimatedValue.toLocaleString()}
                  </p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-semibold text-blue-900 mb-2">Lead Sources</h4>
          <p className="text-sm text-blue-800 mb-3">Top performing: Referrals (32% conversion)</p>
          <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
            View Source Analytics →
          </button>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h4 className="font-semibold text-green-900 mb-2">Qualified Leads</h4>
          <p className="text-sm text-green-800 mb-3">
            {leads.filter((l) => l.status === 'qualified').length} ready for proposals
          </p>
          <button className="text-sm text-green-600 hover:text-green-700 font-medium">
            Convert to Opportunities →
          </button>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h4 className="font-semibold text-yellow-900 mb-2">Follow-ups Due</h4>
          <p className="text-sm text-yellow-800 mb-3">
            {leads.filter((l) => l.nextFollowUp).length} leads need attention
          </p>
          <button className="text-sm text-yellow-600 hover:text-yellow-700 font-medium">
            View Follow-up Queue →
          </button>
        </div>
      </div>
    </div>
  );
}
