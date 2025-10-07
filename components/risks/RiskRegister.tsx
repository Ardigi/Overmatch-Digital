'use client';

import {
  ArrowTrendingDownIcon,
  ArrowTrendingUpIcon,
  CalendarIcon,
  ExclamationTriangleIcon,
  MinusIcon,
  PencilIcon,
  PlusIcon,
  ShieldCheckIcon,
  TagIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import { useState } from 'react';

interface RegisteredRisk {
  id: string;
  title: string;
  description: string;
  category: string;
  status: 'open' | 'mitigating' | 'monitoring' | 'closed';
  inherentLikelihood: number;
  inherentImpact: number;
  residualLikelihood: number;
  residualImpact: number;
  owner: string;
  dateIdentified: string;
  lastReviewed: string;
  reviewFrequency: 'monthly' | 'quarterly' | 'semi-annual' | 'annual';
  controls: string[];
  treatmentPlan?: string;
  tags: string[];
}

export default function RiskRegister() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [showNewRisk, setShowNewRisk] = useState(false);

  // Mock risk register data
  const risks: RegisteredRisk[] = [
    {
      id: '1',
      title: 'Data Breach - Customer PII',
      description:
        'Risk of unauthorized access to customer personally identifiable information stored in databases',
      category: 'Security',
      status: 'mitigating',
      inherentLikelihood: 4,
      inherentImpact: 5,
      residualLikelihood: 2,
      residualImpact: 5,
      owner: 'Sarah Chen',
      dateIdentified: '2024-01-15',
      lastReviewed: '2024-07-15',
      reviewFrequency: 'monthly',
      controls: ['Encryption at Rest', 'Access Controls', 'DLP Solution', 'Security Monitoring'],
      treatmentPlan:
        'Implement additional database activity monitoring and enhanced access reviews',
      tags: ['GDPR', 'SOC2-Security', 'High-Priority'],
    },
    {
      id: '2',
      title: 'Service Availability Disruption',
      description: 'Risk of service outages impacting customer access to platform',
      category: 'Availability',
      status: 'monitoring',
      inherentLikelihood: 3,
      inherentImpact: 4,
      residualLikelihood: 2,
      residualImpact: 3,
      owner: 'Michael Torres',
      dateIdentified: '2024-02-01',
      lastReviewed: '2024-07-01',
      reviewFrequency: 'quarterly',
      controls: [
        'Redundant Infrastructure',
        'Load Balancing',
        'Disaster Recovery Plan',
        'SLA Monitoring',
      ],
      tags: ['SOC2-Availability', 'Business-Critical'],
    },
    {
      id: '3',
      title: 'Non-compliance with SOC 2 Requirements',
      description: 'Risk of failing to meet SOC 2 Trust Services Criteria requirements',
      category: 'Compliance',
      status: 'mitigating',
      inherentLikelihood: 3,
      inherentImpact: 4,
      residualLikelihood: 1,
      residualImpact: 4,
      owner: 'Lisa Martinez',
      dateIdentified: '2024-01-01',
      lastReviewed: '2024-07-10',
      reviewFrequency: 'monthly',
      controls: [
        'Continuous Monitoring',
        'Regular Audits',
        'Policy Management',
        'Training Program',
      ],
      treatmentPlan: 'Enhance continuous compliance monitoring and automated control testing',
      tags: ['SOC2', 'Regulatory', 'Audit'],
    },
    {
      id: '4',
      title: 'Insider Threat',
      description: 'Risk of malicious or negligent actions by employees or contractors',
      category: 'Security',
      status: 'monitoring',
      inherentLikelihood: 2,
      inherentImpact: 4,
      residualLikelihood: 1,
      residualImpact: 3,
      owner: 'David Park',
      dateIdentified: '2024-03-15',
      lastReviewed: '2024-06-15',
      reviewFrequency: 'quarterly',
      controls: ['Background Checks', 'Access Reviews', 'Activity Monitoring', 'Security Training'],
      tags: ['SOC2-Security', 'Personnel'],
    },
    {
      id: '5',
      title: 'Third-party Vendor Failure',
      description: 'Risk of critical vendor service disruption or security breach',
      category: 'Operations',
      status: 'open',
      inherentLikelihood: 3,
      inherentImpact: 3,
      residualLikelihood: 3,
      residualImpact: 3,
      owner: 'James Thompson',
      dateIdentified: '2024-04-01',
      lastReviewed: '2024-07-01',
      reviewFrequency: 'quarterly',
      controls: ['Vendor Assessments', 'Contract Reviews', 'Alternative Suppliers'],
      treatmentPlan: 'Develop comprehensive vendor risk management program',
      tags: ['SOC2-CC9.2', 'Supply-Chain'],
    },
  ];

  const getStatusColor = (status: RegisteredRisk['status']) => {
    switch (status) {
      case 'open':
        return 'bg-red-100 text-red-800';
      case 'mitigating':
        return 'bg-yellow-100 text-yellow-800';
      case 'monitoring':
        return 'bg-blue-100 text-blue-800';
      case 'closed':
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: RegisteredRisk['status']) => {
    switch (status) {
      case 'open':
        return <ExclamationTriangleIcon className="h-4 w-4" />;
      case 'mitigating':
      case 'monitoring':
        return <ShieldCheckIcon className="h-4 w-4" />;
      case 'closed':
        return <MinusIcon className="h-4 w-4" />;
    }
  };

  const getRiskScoreColor = (score: number) => {
    if (score >= 15) return 'text-red-600';
    if (score >= 10) return 'text-orange-600';
    if (score >= 5) return 'text-yellow-600';
    return 'text-green-600';
  };

  const calculateRiskReduction = (inherent: number, residual: number) => {
    const reduction = ((inherent - residual) / inherent) * 100;
    return Math.round(reduction);
  };

  const categories = ['All', 'Security', 'Compliance', 'Operations', 'Availability', 'Financial'];

  const filteredRisks = risks.filter((risk) => {
    const matchesSearch =
      risk.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      risk.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || risk.status === filterStatus;
    const matchesCategory = filterCategory === 'all' || risk.category === filterCategory;
    return matchesSearch && matchesStatus && matchesCategory;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 flex-1">
          <input
            type="text"
            placeholder="Search risks..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="all">All Status</option>
            <option value="open">Open</option>
            <option value="mitigating">Mitigating</option>
            <option value="monitoring">Monitoring</option>
            <option value="closed">Closed</option>
          </select>

          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            {categories.map((cat) => (
              <option key={cat} value={cat.toLowerCase()}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={() => setShowNewRisk(true)}
          className="btn-primary flex items-center gap-2"
        >
          <PlusIcon className="h-5 w-5" />
          Add Risk
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Risk
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Category
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Risk Scores
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Controls
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Review
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredRisks.map((risk) => {
              const inherentScore = risk.inherentLikelihood * risk.inherentImpact;
              const residualScore = risk.residualLikelihood * risk.residualImpact;
              const reduction = calculateRiskReduction(inherentScore, residualScore);

              return (
                <tr key={risk.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{risk.title}</p>
                      <p className="text-sm text-gray-600 mt-1">{risk.description}</p>
                      <div className="flex items-center gap-2 mt-2">
                        {risk.tags.slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm text-gray-900">{risk.category}</p>
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-2">
                      <div>
                        <p className="text-xs text-gray-500">Inherent</p>
                        <p className={`text-lg font-semibold ${getRiskScoreColor(inherentScore)}`}>
                          {inherentScore}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Residual</p>
                        <p className={`text-lg font-semibold ${getRiskScoreColor(residualScore)}`}>
                          {residualScore}
                        </p>
                      </div>
                      {reduction > 0 && (
                        <div className="flex items-center gap-1">
                          <ArrowTrendingDownIcon className="h-4 w-4 text-green-600" />
                          <span className="text-xs text-green-600">{reduction}% reduction</span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm text-gray-900">{risk.controls.length} controls</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {risk.controls.slice(0, 2).join(', ')}
                      {risk.controls.length > 2 && '...'}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(risk.status)}`}
                    >
                      {getStatusIcon(risk.status)}
                      {risk.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm">
                      <p className="text-gray-900">{risk.reviewFrequency}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        Last: {format(new Date(risk.lastReviewed), 'MMM d')}
                      </p>
                      <div className="flex items-center gap-1 mt-1">
                        <UserCircleIcon className="h-3 w-3 text-gray-400" />
                        <span className="text-xs text-gray-500">{risk.owner}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <button className="text-primary-600 hover:text-primary-700 text-sm font-medium">
                      View Details
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 mb-2">Risk Scoring Methodology</h4>
        <div className="text-sm text-blue-800 space-y-1">
          <p>• Risk Score = Likelihood × Impact (1-25 scale)</p>
          <p>• Inherent Risk: Risk level before controls</p>
          <p>• Residual Risk: Risk level after controls</p>
          <p>• Review frequency based on risk score and criticality</p>
        </div>
      </div>
    </div>
  );
}
