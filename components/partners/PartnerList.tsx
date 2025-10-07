'use client';

import {
  BuildingOfficeIcon,
  CalendarIcon,
  ChartBarIcon,
  CheckCircleIcon,
  ClockIcon,
  CurrencyDollarIcon,
  DocumentTextIcon,
  PlusIcon,
  TagIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import { useState } from 'react';

interface Partner {
  id: string;
  firmName: string;
  contactName: string;
  email: string;
  phone: string;
  partnershipType: 'white-label' | 'joint-venture' | 'subcontractor' | 'referral';
  status: 'active' | 'pending' | 'inactive';
  clientsReferred: number;
  activeProjects: number;
  revenue: number;
  commissionRate: number;
  joinedDate: string;
  lastActivity: string;
  certifications: string[];
  specializations: string[];
}

export default function PartnerList() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [showNewPartner, setShowNewPartner] = useState(false);

  // Mock data based on documentation's partnership models
  const partners: Partner[] = [
    {
      id: '1',
      firmName: 'Anderson & Associates CPA',
      contactName: 'Robert Anderson',
      email: 'randerson@andersoncpa.com',
      phone: '(555) 100-2000',
      partnershipType: 'white-label',
      status: 'active',
      clientsReferred: 12,
      activeProjects: 3,
      revenue: 450000,
      commissionRate: 30,
      joinedDate: '2024-01-15',
      lastActivity: '2024-07-18',
      certifications: ['CPA', 'CISA', 'ISO 27001 LA'],
      specializations: ['Financial Services', 'Healthcare'],
    },
    {
      id: '2',
      firmName: 'TechAudit Partners',
      contactName: 'Sarah Chen',
      email: 'schen@techaudit.com',
      phone: '(555) 200-3000',
      partnershipType: 'joint-venture',
      status: 'active',
      clientsReferred: 8,
      activeProjects: 2,
      revenue: 320000,
      commissionRate: 40,
      joinedDate: '2024-02-20',
      lastActivity: '2024-07-17',
      certifications: ['CPA', 'CISSP'],
      specializations: ['Technology', 'SaaS'],
    },
    {
      id: '3',
      firmName: 'Compliance First LLC',
      contactName: 'Michael Torres',
      email: 'mtorres@compliancefirst.com',
      phone: '(555) 300-4000',
      partnershipType: 'subcontractor',
      status: 'active',
      clientsReferred: 5,
      activeProjects: 1,
      revenue: 175000,
      commissionRate: 25,
      joinedDate: '2024-03-10',
      lastActivity: '2024-07-15',
      certifications: ['CPA', 'SOC Specialist'],
      specializations: ['E-commerce', 'Retail'],
    },
    {
      id: '4',
      firmName: 'Regional Business Advisors',
      contactName: 'Lisa Martinez',
      email: 'lmartinez@rba.com',
      phone: '(555) 400-5000',
      partnershipType: 'referral',
      status: 'active',
      clientsReferred: 15,
      activeProjects: 0,
      revenue: 225000,
      commissionRate: 15,
      joinedDate: '2024-01-05',
      lastActivity: '2024-07-19',
      certifications: ['CPA'],
      specializations: ['Manufacturing', 'Distribution'],
    },
    {
      id: '5',
      firmName: 'SecureAudit Group',
      contactName: 'David Park',
      email: 'dpark@secureaudit.com',
      phone: '(555) 500-6000',
      partnershipType: 'white-label',
      status: 'pending',
      clientsReferred: 0,
      activeProjects: 0,
      revenue: 0,
      commissionRate: 30,
      joinedDate: '2024-07-10',
      lastActivity: '2024-07-10',
      certifications: ['CPA', 'CISA', 'CRISC'],
      specializations: ['Financial Services', 'Insurance'],
    },
  ];

  const getPartnershipTypeColor = (type: Partner['partnershipType']) => {
    switch (type) {
      case 'white-label':
        return 'bg-purple-100 text-purple-800';
      case 'joint-venture':
        return 'bg-blue-100 text-blue-800';
      case 'subcontractor':
        return 'bg-green-100 text-green-800';
      case 'referral':
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  const getPartnershipTypeLabel = (type: Partner['partnershipType']) => {
    switch (type) {
      case 'white-label':
        return 'White-Label';
      case 'joint-venture':
        return 'Joint Venture';
      case 'subcontractor':
        return 'Subcontractor';
      case 'referral':
        return 'Referral';
    }
  };

  const getStatusIcon = (status: Partner['status']) => {
    switch (status) {
      case 'active':
        return <CheckCircleIcon className="h-5 w-5 text-green-600" />;
      case 'pending':
        return <ClockIcon className="h-5 w-5 text-yellow-600" />;
      case 'inactive':
        return <ClockIcon className="h-5 w-5 text-gray-400" />;
    }
  };

  const filteredPartners = partners.filter((partner) => {
    const matchesSearch =
      partner.firmName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      partner.contactName.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesType = filterType === 'all' || partner.partnershipType === filterType;

    return matchesSearch && matchesType;
  });

  const stats = {
    totalPartners: partners.filter((p) => p.status === 'active').length,
    totalRevenue: partners.reduce((sum, p) => sum + p.revenue, 0),
    activeProjects: partners.reduce((sum, p) => sum + p.activeProjects, 0),
    totalReferrals: partners.reduce((sum, p) => sum + p.clientsReferred, 0),
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <UserGroupIcon className="h-8 w-8 text-blue-600" />
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.totalPartners}</p>
              <p className="text-sm text-gray-600">Active Partners</p>
            </div>
          </div>
        </div>
        <div className="bg-green-50 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <CurrencyDollarIcon className="h-8 w-8 text-green-600" />
            <div>
              <p className="text-2xl font-bold text-gray-900">
                ${(stats.totalRevenue / 1000).toFixed(0)}k
              </p>
              <p className="text-sm text-gray-600">Partner Revenue</p>
            </div>
          </div>
        </div>
        <div className="bg-purple-50 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <DocumentTextIcon className="h-8 w-8 text-purple-600" />
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.activeProjects}</p>
              <p className="text-sm text-gray-600">Active Projects</p>
            </div>
          </div>
        </div>
        <div className="bg-yellow-50 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <ChartBarIcon className="h-8 w-8 text-yellow-600" />
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.totalReferrals}</p>
              <p className="text-sm text-gray-600">Client Referrals</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <input
            type="text"
            placeholder="Search partners..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="all">All Types</option>
            <option value="white-label">White-Label</option>
            <option value="joint-venture">Joint Venture</option>
            <option value="subcontractor">Subcontractor</option>
            <option value="referral">Referral</option>
          </select>
        </div>

        <button
          onClick={() => setShowNewPartner(true)}
          className="btn-primary flex items-center gap-2"
        >
          <PlusIcon className="h-5 w-5" />
          Add Partner
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Partner
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Performance
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Revenue
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredPartners.map((partner) => (
              <tr key={partner.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{partner.firmName}</p>
                    <p className="text-sm text-gray-600">{partner.contactName}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {partner.certifications.map((cert) => (
                        <span
                          key={cert}
                          className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded"
                        >
                          {cert}
                        </span>
                      ))}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${getPartnershipTypeColor(partner.partnershipType)}`}
                  >
                    {getPartnershipTypeLabel(partner.partnershipType)}
                  </span>
                  <p className="text-xs text-gray-500 mt-1">{partner.commissionRate}% commission</p>
                </td>
                <td className="px-6 py-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1">
                        <UserGroupIcon className="h-4 w-4 text-gray-400" />
                        <span>{partner.clientsReferred} referrals</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <DocumentTextIcon className="h-4 w-4 text-gray-400" />
                        <span>{partner.activeProjects} active</span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500">
                      Joined {format(new Date(partner.joinedDate), 'MMM d, yyyy')}
                    </p>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <p className="text-sm font-semibold text-gray-900">
                    ${partner.revenue.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500">lifetime value</p>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(partner.status)}
                    <span className="text-sm text-gray-900 capitalize">{partner.status}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Last active: {format(new Date(partner.lastActivity), 'MMM d')}
                  </p>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <button className="text-primary-600 hover:text-primary-700 text-sm font-medium">
                      View Details
                    </button>
                    <span className="text-gray-300">|</span>
                    <button className="text-gray-600 hover:text-gray-700 text-sm font-medium">
                      Message
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 mb-2">Partnership Program Benefits</h4>
        <div className="grid grid-cols-2 gap-4 text-sm text-blue-800">
          <div>
            <p className="font-medium mb-1">For White-Label Partners:</p>
            <ul className="space-y-1 ml-4">
              <li>• Full branding customization</li>
              <li>• Technical support and training</li>
              <li>• 30% commission on all projects</li>
            </ul>
          </div>
          <div>
            <p className="font-medium mb-1">For Joint Venture Partners:</p>
            <ul className="space-y-1 ml-4">
              <li>• Shared project ownership</li>
              <li>• Co-marketing opportunities</li>
              <li>• Up to 40% revenue share</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
