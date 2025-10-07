'use client';

import {
  ArrowPathIcon,
  CalendarIcon,
  ChartBarIcon,
  CheckCircleIcon,
  ClockIcon,
  DocumentTextIcon,
  ShieldCheckIcon,
  UserCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import { useState } from 'react';

interface TreatmentPlan {
  id: string;
  riskId: string;
  riskTitle: string;
  strategy: 'accept' | 'mitigate' | 'transfer' | 'avoid';
  description: string;
  controls: Control[];
  status: 'draft' | 'approved' | 'in-progress' | 'completed';
  owner: string;
  budget: number;
  startDate: string;
  targetDate: string;
  actualCost?: number;
  completionDate?: string;
  effectiveness?: number;
}

interface Control {
  id: string;
  name: string;
  type: 'preventive' | 'detective' | 'corrective';
  implementation: 'manual' | 'automated' | 'hybrid';
  status: 'planned' | 'implementing' | 'operational';
  effectiveness: number;
}

export default function RiskTreatment() {
  const [filterStrategy, setFilterStrategy] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  // Mock treatment plans
  const treatmentPlans: TreatmentPlan[] = [
    {
      id: '1',
      riskId: '1',
      riskTitle: 'Data Breach - Customer PII',
      strategy: 'mitigate',
      description:
        'Implement comprehensive data protection controls to reduce likelihood and impact of data breaches',
      controls: [
        {
          id: 'c1',
          name: 'Database Activity Monitoring',
          type: 'detective',
          implementation: 'automated',
          status: 'implementing',
          effectiveness: 85,
        },
        {
          id: 'c2',
          name: 'Enhanced Access Reviews',
          type: 'preventive',
          implementation: 'hybrid',
          status: 'operational',
          effectiveness: 75,
        },
        {
          id: 'c3',
          name: 'Data Loss Prevention (DLP)',
          type: 'preventive',
          implementation: 'automated',
          status: 'operational',
          effectiveness: 90,
        },
      ],
      status: 'in-progress',
      owner: 'Sarah Chen',
      budget: 150000,
      startDate: '2024-06-01',
      targetDate: '2024-09-30',
      actualCost: 85000,
    },
    {
      id: '2',
      riskId: '5',
      riskTitle: 'Third-party Vendor Failure',
      strategy: 'transfer',
      description:
        'Transfer risk through insurance and contractual agreements while implementing vendor management controls',
      controls: [
        {
          id: 'c4',
          name: 'Cyber Insurance Policy',
          type: 'corrective',
          implementation: 'manual',
          status: 'operational',
          effectiveness: 70,
        },
        {
          id: 'c5',
          name: 'Vendor Risk Assessments',
          type: 'preventive',
          implementation: 'hybrid',
          status: 'implementing',
          effectiveness: 80,
        },
      ],
      status: 'approved',
      owner: 'James Thompson',
      budget: 75000,
      startDate: '2024-08-01',
      targetDate: '2024-12-31',
    },
    {
      id: '3',
      riskId: '2',
      riskTitle: 'Service Availability Disruption',
      strategy: 'mitigate',
      description: 'Enhance infrastructure resilience and disaster recovery capabilities',
      controls: [
        {
          id: 'c6',
          name: 'Multi-region Failover',
          type: 'corrective',
          implementation: 'automated',
          status: 'operational',
          effectiveness: 95,
        },
        {
          id: 'c7',
          name: 'Real-time Replication',
          type: 'preventive',
          implementation: 'automated',
          status: 'operational',
          effectiveness: 90,
        },
        {
          id: 'c8',
          name: 'Chaos Engineering',
          type: 'detective',
          implementation: 'hybrid',
          status: 'planned',
          effectiveness: 85,
        },
      ],
      status: 'completed',
      owner: 'Michael Torres',
      budget: 200000,
      startDate: '2024-03-01',
      targetDate: '2024-06-30',
      actualCost: 185000,
      completionDate: '2024-06-28',
      effectiveness: 88,
    },
    {
      id: '4',
      riskId: '9',
      riskTitle: 'Physical Security Breach',
      strategy: 'accept',
      description: 'Accept residual risk after implementing basic physical security controls',
      controls: [
        {
          id: 'c9',
          name: 'Badge Access System',
          type: 'preventive',
          implementation: 'automated',
          status: 'operational',
          effectiveness: 80,
        },
      ],
      status: 'completed',
      owner: 'Thomas Brown',
      budget: 25000,
      startDate: '2024-01-15',
      targetDate: '2024-03-31',
      actualCost: 22000,
      completionDate: '2024-03-15',
      effectiveness: 82,
    },
  ];

  const getStrategyColor = (strategy: TreatmentPlan['strategy']) => {
    switch (strategy) {
      case 'accept':
        return 'bg-blue-100 text-blue-800';
      case 'mitigate':
        return 'bg-green-100 text-green-800';
      case 'transfer':
        return 'bg-yellow-100 text-yellow-800';
      case 'avoid':
        return 'bg-red-100 text-red-800';
    }
  };

  const getStrategyIcon = (strategy: TreatmentPlan['strategy']) => {
    switch (strategy) {
      case 'accept':
        return <CheckCircleIcon className="h-4 w-4" />;
      case 'mitigate':
        return <ShieldCheckIcon className="h-4 w-4" />;
      case 'transfer':
        return <ArrowPathIcon className="h-4 w-4" />;
      case 'avoid':
        return <XCircleIcon className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: TreatmentPlan['status']) => {
    switch (status) {
      case 'draft':
        return 'bg-gray-100 text-gray-800';
      case 'approved':
        return 'bg-blue-100 text-blue-800';
      case 'in-progress':
        return 'bg-yellow-100 text-yellow-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
    }
  };

  const getControlTypeColor = (type: Control['type']) => {
    switch (type) {
      case 'preventive':
        return 'text-blue-600';
      case 'detective':
        return 'text-yellow-600';
      case 'corrective':
        return 'text-green-600';
    }
  };

  const filteredPlans = treatmentPlans.filter((plan) => {
    const matchesStrategy = filterStrategy === 'all' || plan.strategy === filterStrategy;
    const matchesStatus = filterStatus === 'all' || plan.status === filterStatus;
    return matchesStrategy && matchesStatus;
  });

  const stats = {
    totalBudget: treatmentPlans.reduce((sum, p) => sum + p.budget, 0),
    totalSpent: treatmentPlans.reduce((sum, p) => sum + (p.actualCost || 0), 0),
    inProgress: treatmentPlans.filter((p) => p.status === 'in-progress').length,
    completed: treatmentPlans.filter((p) => p.status === 'completed').length,
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-gray-900">
                ${(stats.totalBudget / 1000).toFixed(0)}k
              </p>
              <p className="text-sm text-gray-600">Total Budget</p>
            </div>
            <ChartBarIcon className="h-8 w-8 text-blue-600" />
          </div>
        </div>
        <div className="bg-green-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-gray-900">
                ${(stats.totalSpent / 1000).toFixed(0)}k
              </p>
              <p className="text-sm text-gray-600">Spent to Date</p>
            </div>
            <CheckCircleIcon className="h-8 w-8 text-green-600" />
          </div>
        </div>
        <div className="bg-yellow-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.inProgress}</p>
              <p className="text-sm text-gray-600">In Progress</p>
            </div>
            <ClockIcon className="h-8 w-8 text-yellow-600" />
          </div>
        </div>
        <div className="bg-green-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.completed}</p>
              <p className="text-sm text-gray-600">Completed</p>
            </div>
            <CheckCircleIcon className="h-8 w-8 text-green-600" />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <select
          value={filterStrategy}
          onChange={(e) => setFilterStrategy(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        >
          <option value="all">All Strategies</option>
          <option value="accept">Accept</option>
          <option value="mitigate">Mitigate</option>
          <option value="transfer">Transfer</option>
          <option value="avoid">Avoid</option>
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        >
          <option value="all">All Status</option>
          <option value="draft">Draft</option>
          <option value="approved">Approved</option>
          <option value="in-progress">In Progress</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      <div className="space-y-4">
        {filteredPlans.map((plan) => (
          <div key={plan.id} className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{plan.riskTitle}</h3>
                <p className="text-sm text-gray-600 mt-1">{plan.description}</p>
                <div className="flex items-center gap-4 mt-2">
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${getStrategyColor(plan.strategy)}`}
                  >
                    {getStrategyIcon(plan.strategy)}
                    {plan.strategy}
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(plan.status)}`}
                  >
                    {plan.status}
                  </span>
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <UserCircleIcon className="h-4 w-4" />
                    {plan.owner}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-semibold text-gray-900">
                  ${plan.budget.toLocaleString()}
                </p>
                {plan.actualCost && (
                  <p className="text-sm text-gray-600">
                    Spent: ${plan.actualCost.toLocaleString()}
                  </p>
                )}
              </div>
            </div>

            <div className="mb-4">
              <h4 className="text-sm font-medium text-gray-900 mb-2">Controls</h4>
              <div className="grid grid-cols-3 gap-3">
                {plan.controls.map((control) => (
                  <div key={control.id} className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium text-gray-900">{control.name}</p>
                      <span className={`text-xs font-medium ${getControlTypeColor(control.type)}`}>
                        {control.type}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-600">
                      <span>{control.implementation}</span>
                      <span>{control.effectiveness}% effective</span>
                    </div>
                    <div className="mt-2">
                      <div className="w-full bg-gray-200 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full ${
                            control.status === 'operational'
                              ? 'bg-green-600'
                              : control.status === 'implementing'
                                ? 'bg-yellow-600'
                                : 'bg-gray-400'
                          }`}
                          style={{
                            width:
                              control.status === 'operational'
                                ? '100%'
                                : control.status === 'implementing'
                                  ? '50%'
                                  : '0%',
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-gray-200">
              <div className="flex items-center gap-6 text-sm">
                <div>
                  <span className="text-gray-600">Start:</span>
                  <span className="font-medium text-gray-900 ml-1">
                    {format(new Date(plan.startDate), 'MMM d, yyyy')}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Target:</span>
                  <span className="font-medium text-gray-900 ml-1">
                    {format(new Date(plan.targetDate), 'MMM d, yyyy')}
                  </span>
                </div>
                {plan.completionDate && (
                  <div>
                    <span className="text-gray-600">Completed:</span>
                    <span className="font-medium text-gray-900 ml-1">
                      {format(new Date(plan.completionDate), 'MMM d, yyyy')}
                    </span>
                  </div>
                )}
                {plan.effectiveness && (
                  <div>
                    <span className="text-gray-600">Effectiveness:</span>
                    <span className="font-medium text-green-600 ml-1">{plan.effectiveness}%</span>
                  </div>
                )}
              </div>
              <button className="text-primary-600 hover:text-primary-700 text-sm font-medium">
                View Details
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 mb-2">Risk Treatment Strategies</h4>
        <div className="grid grid-cols-2 gap-4 text-sm text-blue-800">
          <div>
            <p className="font-medium mb-1">Accept:</p>
            <p>Acknowledge the risk and accept potential consequences</p>
          </div>
          <div>
            <p className="font-medium mb-1">Mitigate:</p>
            <p>Implement controls to reduce likelihood or impact</p>
          </div>
          <div>
            <p className="font-medium mb-1">Transfer:</p>
            <p>Shift risk to third parties through insurance or contracts</p>
          </div>
          <div>
            <p className="font-medium mb-1">Avoid:</p>
            <p>Eliminate the risk by changing processes or scope</p>
          </div>
        </div>
      </div>
    </div>
  );
}
