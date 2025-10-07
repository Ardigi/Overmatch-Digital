'use client';

import {
  ArrowPathIcon,
  BeakerIcon,
  CalculatorIcon,
  ChartBarIcon,
  CheckCircleIcon,
  ClockIcon,
  Cog6ToothIcon,
  DocumentCheckIcon,
  DocumentTextIcon,
  ExclamationCircleIcon,
  SparklesIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import { useState } from 'react';
import { formatDate } from '@/lib/utils';

interface TestProcedure {
  id: string;
  name: string;
  control: string;
  client: string;
  type: 'manual' | 'automated' | 'hybrid';
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual';
  sampleSize: number;
  populationSize: number;
  samplingMethod: 'statistical' | 'judgmental' | 'random' | 'systematic';
  status: 'not_started' | 'in_progress' | 'completed' | 'failed';
  assignedTo: string;
  dueDate: string;
  completedDate?: string;
  passRate?: number;
  exceptions: number;
}

const mockProcedures: TestProcedure[] = [
  {
    id: '1',
    name: 'User Access Review',
    control: 'CC6.1',
    client: 'Acme Corporation',
    type: 'hybrid',
    frequency: 'quarterly',
    sampleSize: 25,
    populationSize: 450,
    samplingMethod: 'statistical',
    status: 'in_progress',
    assignedTo: 'Sarah Johnson',
    dueDate: '2024-03-15',
    passRate: 92,
    exceptions: 2,
  },
  {
    id: '2',
    name: 'Change Management Testing',
    control: 'CC8.1',
    client: 'TechCorp Solutions',
    type: 'manual',
    frequency: 'monthly',
    sampleSize: 40,
    populationSize: 200,
    samplingMethod: 'random',
    status: 'completed',
    assignedTo: 'Mike Chen',
    dueDate: '2024-02-28',
    completedDate: '2024-02-25',
    passRate: 100,
    exceptions: 0,
  },
  {
    id: '3',
    name: 'Backup Verification',
    control: 'A1.2',
    client: 'Financial Services Inc',
    type: 'automated',
    frequency: 'daily',
    sampleSize: 10,
    populationSize: 30,
    samplingMethod: 'systematic',
    status: 'failed',
    assignedTo: 'John Doe',
    dueDate: '2024-02-20',
    completedDate: '2024-02-20',
    passRate: 60,
    exceptions: 4,
  },
];

export default function EnhancedTestingPage() {
  const [procedures] = useState<TestProcedure[]>(mockProcedures);
  const [selectedClient, setSelectedClient] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [showSamplingModal, setShowSamplingModal] = useState(false);
  const [samplingConfig, setSamplingConfig] = useState({
    populationSize: 1000,
    confidenceLevel: 95,
    expectedErrorRate: 2,
    precision: 5,
  });

  const calculateSampleSize = () => {
    // Simplified sample size calculation for demonstration
    const z = samplingConfig.confidenceLevel === 95 ? 1.96 : 2.58;
    const p = samplingConfig.expectedErrorRate / 100;
    const e = samplingConfig.precision / 100;
    const n = samplingConfig.populationSize;

    const sampleSize = Math.ceil(
      (n * z * z * p * (1 - p)) / ((n - 1) * e * e + z * z * p * (1 - p))
    );

    return Math.min(sampleSize, n);
  };

  const getStatusBadge = (status: TestProcedure['status']) => {
    const badges = {
      not_started: 'bg-gray-100 text-gray-800',
      in_progress: 'bg-yellow-100 text-yellow-800',
      completed: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
    };

    const icons = {
      not_started: <ClockIcon className="w-3 h-3" />,
      in_progress: <ArrowPathIcon className="w-3 h-3 animate-spin" />,
      completed: <CheckCircleIcon className="w-3 h-3" />,
      failed: <XCircleIcon className="w-3 h-3" />,
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

  const getTestTypeBadge = (type: TestProcedure['type']) => {
    const badges = {
      manual: 'bg-blue-50 text-blue-700',
      automated: 'bg-purple-50 text-purple-700',
      hybrid: 'bg-indigo-50 text-indigo-700',
    };

    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium ${badges[type]}`}
      >
        {type.charAt(0).toUpperCase() + type.slice(1)}
      </span>
    );
  };

  const filteredProcedures = procedures.filter((proc) => {
    const matchesClient = selectedClient === 'all' || proc.client === selectedClient;
    const matchesStatus = selectedStatus === 'all' || proc.status === selectedStatus;
    return matchesClient && matchesStatus;
  });

  const clients = ['all', ...new Set(procedures.map((p) => p.client))];

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Testing & Sampling</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage test procedures and automated sampling
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowSamplingModal(true)}
            className="btn-secondary flex items-center gap-2"
          >
            <CalculatorIcon className="h-5 w-5" />
            Sample Calculator
          </button>
          <button className="btn-primary flex items-center gap-2">
            <BeakerIcon className="h-5 w-5" />
            New Test
          </button>
        </div>
      </div>

      {/* Testing Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Tests</p>
              <p className="text-3xl font-bold text-gray-900">{procedures.length}</p>
              <p className="text-xs text-gray-500 mt-1">Across all clients</p>
            </div>
            <BeakerIcon className="h-10 w-10 text-gray-400" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">In Progress</p>
              <p className="text-3xl font-bold text-yellow-600">
                {procedures.filter((p) => p.status === 'in_progress').length}
              </p>
              <p className="text-xs text-gray-500 mt-1">Active testing</p>
            </div>
            <ArrowPathIcon className="h-10 w-10 text-yellow-400" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Pass Rate</p>
              <p className="text-3xl font-bold text-green-600">94%</p>
              <p className="text-xs text-gray-500 mt-1">Average across tests</p>
            </div>
            <ChartBarIcon className="h-10 w-10 text-green-400" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Exceptions</p>
              <p className="text-3xl font-bold text-red-600">6</p>
              <p className="text-xs text-gray-500 mt-1">Total findings</p>
            </div>
            <ExclamationCircleIcon className="h-10 w-10 text-red-400" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white shadow rounded-lg mb-6">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-4">
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
              <option value="not_started">Not Started</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
            </select>

            <button className="ml-auto flex items-center gap-2 text-primary-600 hover:text-primary-700">
              <SparklesIcon className="h-5 w-5" />
              AI-Powered Insights
            </button>
          </div>
        </div>

        {/* Test Procedures List */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Test Procedure
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type / Method
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Sampling
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Results
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredProcedures.map((proc) => (
                <tr key={proc.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{proc.name}</p>
                      <p className="text-xs text-gray-500">
                        {proc.client} • Control {proc.control}
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      {getTestTypeBadge(proc.type)}
                      <p className="text-xs text-gray-500 capitalize">{proc.frequency}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm">
                      <p className="font-medium">
                        {proc.sampleSize} / {proc.populationSize}
                      </p>
                      <p className="text-xs text-gray-500 capitalize">{proc.samplingMethod}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      {getStatusBadge(proc.status)}
                      <p className="text-xs text-gray-500 mt-1">Due: {formatDate(proc.dueDate)}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {proc.passRate !== undefined ? (
                      <div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${
                                proc.passRate >= 95
                                  ? 'bg-green-600'
                                  : proc.passRate >= 80
                                    ? 'bg-yellow-600'
                                    : 'bg-red-600'
                              }`}
                              style={{ width: `${proc.passRate}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium">{proc.passRate}%</span>
                        </div>
                        {proc.exceptions > 0 && (
                          <p className="text-xs text-red-600 mt-1">
                            {proc.exceptions} exceptions found
                          </p>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-gray-500">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        className="text-primary-600 hover:text-primary-900"
                        title="Execute Test"
                      >
                        <BeakerIcon className="h-5 w-5" />
                      </button>
                      <button className="text-gray-600 hover:text-gray-900" title="View Details">
                        <DocumentTextIcon className="h-5 w-5" />
                      </button>
                      <button className="text-gray-600 hover:text-gray-900" title="Configure">
                        <Cog6ToothIcon className="h-5 w-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sample Size Calculator Modal */}
      {showSamplingModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Statistical Sample Size Calculator
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Population Size</label>
                <input
                  type="number"
                  value={samplingConfig.populationSize}
                  onChange={(e) =>
                    setSamplingConfig({
                      ...samplingConfig,
                      populationSize: parseInt(e.target.value),
                    })
                  }
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Confidence Level</label>
                <select
                  value={samplingConfig.confidenceLevel}
                  onChange={(e) =>
                    setSamplingConfig({
                      ...samplingConfig,
                      confidenceLevel: parseInt(e.target.value),
                    })
                  }
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value={95}>95%</option>
                  <option value={99}>99%</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Expected Error Rate (%)
                </label>
                <input
                  type="number"
                  value={samplingConfig.expectedErrorRate}
                  onChange={(e) =>
                    setSamplingConfig({
                      ...samplingConfig,
                      expectedErrorRate: parseInt(e.target.value),
                    })
                  }
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Precision (%)</label>
                <input
                  type="number"
                  value={samplingConfig.precision}
                  onChange={(e) =>
                    setSamplingConfig({
                      ...samplingConfig,
                      precision: parseInt(e.target.value),
                    })
                  }
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>

              <div className="pt-4 border-t">
                <p className="text-sm text-gray-600">Recommended Sample Size:</p>
                <p className="text-3xl font-bold text-primary-600">{calculateSampleSize()}</p>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowSamplingModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
              <button className="flex-1 btn-primary">Apply to Test</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
