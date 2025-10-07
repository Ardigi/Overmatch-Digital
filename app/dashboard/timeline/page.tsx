'use client';

import {
  AdjustmentsHorizontalIcon,
  CalendarIcon,
  ChartBarIcon,
  CheckCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  FlagIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import { useState } from 'react';
import { formatDate } from '@/lib/utils';

interface Project {
  id: string;
  client: string;
  auditType: 'SOC1' | 'SOC2_Type1' | 'SOC2_Type2';
  startDate: string;
  endDate: string;
  status: 'planning' | 'fieldwork' | 'review' | 'reporting' | 'completed';
  progress: number;
  lead: string;
  team: string[];
  milestones: Milestone[];
}

interface Milestone {
  id: string;
  name: string;
  date: string;
  status: 'pending' | 'in_progress' | 'completed' | 'delayed';
  dependencies?: string[];
}

const mockProjects: Project[] = [
  {
    id: '1',
    client: 'Acme Corporation',
    auditType: 'SOC2_Type2',
    startDate: '2024-01-15',
    endDate: '2024-06-30',
    status: 'fieldwork',
    progress: 45,
    lead: 'Sarah Johnson',
    team: ['Mike Chen', 'Emily Brown'],
    milestones: [
      { id: 'm1', name: 'Planning Complete', date: '2024-02-01', status: 'completed' },
      { id: 'm2', name: 'Control Testing', date: '2024-03-15', status: 'in_progress' },
      { id: 'm3', name: 'Draft Report', date: '2024-05-01', status: 'pending' },
      { id: 'm4', name: 'Final Report', date: '2024-06-30', status: 'pending' },
    ],
  },
  {
    id: '2',
    client: 'TechCorp Solutions',
    auditType: 'SOC2_Type1',
    startDate: '2024-02-01',
    endDate: '2024-04-30',
    status: 'review',
    progress: 75,
    lead: 'Mike Chen',
    team: ['John Doe', 'Jane Smith'],
    milestones: [
      { id: 'm5', name: 'Planning Complete', date: '2024-02-15', status: 'completed' },
      { id: 'm6', name: 'Walkthrough', date: '2024-03-01', status: 'completed' },
      { id: 'm7', name: 'Testing Complete', date: '2024-03-20', status: 'completed' },
      { id: 'm8', name: 'Report Delivery', date: '2024-04-30', status: 'in_progress' },
    ],
  },
  {
    id: '3',
    client: 'Financial Services Inc',
    auditType: 'SOC1',
    startDate: '2024-03-01',
    endDate: '2024-05-31',
    status: 'planning',
    progress: 15,
    lead: 'Emily Brown',
    team: ['Sarah Johnson'],
    milestones: [
      { id: 'm9', name: 'Kickoff Meeting', date: '2024-03-01', status: 'completed' },
      { id: 'm10', name: 'Risk Assessment', date: '2024-03-15', status: 'in_progress' },
      { id: 'm11', name: 'Control Matrix', date: '2024-03-30', status: 'pending' },
      { id: 'm12', name: 'Testing Phase', date: '2024-04-15', status: 'pending' },
    ],
  },
];

export default function TimelinePage() {
  const [projects] = useState<Project[]>(mockProjects);
  const [viewMode, setViewMode] = useState<'timeline' | 'calendar' | 'list'>('timeline');
  const [selectedMonth, setSelectedMonth] = useState(new Date());

  const getStatusColor = (status: Project['status']) => {
    const colors = {
      planning: 'bg-blue-500',
      fieldwork: 'bg-yellow-500',
      review: 'bg-purple-500',
      reporting: 'bg-orange-500',
      completed: 'bg-green-500',
    };
    return colors[status];
  };

  const getMilestoneIcon = (status: Milestone['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircleIcon className="h-5 w-5 text-green-600" />;
      case 'in_progress':
        return <ClockIcon className="h-5 w-5 text-yellow-600" />;
      case 'delayed':
        return <ExclamationTriangleIcon className="h-5 w-5 text-red-600" />;
      default:
        return <div className="h-5 w-5 rounded-full border-2 border-gray-300" />;
    }
  };

  const getMonthDays = () => {
    const year = selectedMonth.getFullYear();
    const month = selectedMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days = [];

    for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
      days.push(new Date(d));
    }

    return days;
  };

  const navigateMonth = (direction: number) => {
    setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + direction));
  };

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Project Timeline</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage audit projects and track milestones across all clients
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('timeline')}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                viewMode === 'timeline' ? 'bg-white text-gray-900 shadow' : 'text-gray-600'
              }`}
            >
              Timeline
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                viewMode === 'calendar' ? 'bg-white text-gray-900 shadow' : 'text-gray-600'
              }`}
            >
              Calendar
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                viewMode === 'list' ? 'bg-white text-gray-900 shadow' : 'text-gray-600'
              }`}
            >
              List
            </button>
          </div>
          <button className="btn-primary flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            New Project
          </button>
        </div>
      </div>

      {/* View Mode Content */}
      {viewMode === 'timeline' && (
        <div className="bg-white shadow rounded-lg p-6">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-lg font-medium text-gray-900">Active Projects Timeline</h2>
            <div className="flex items-center gap-4 text-sm">
              <span className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                Planning
              </span>
              <span className="flex items-center gap-2">
                <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                Fieldwork
              </span>
              <span className="flex items-center gap-2">
                <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                Review
              </span>
              <span className="flex items-center gap-2">
                <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                Reporting
              </span>
              <span className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                Completed
              </span>
            </div>
          </div>

          <div className="space-y-6">
            {projects.map((project) => (
              <div key={project.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">{project.client}</h3>
                    <p className="text-sm text-gray-500">
                      {project.auditType.replace('_', ' ')} • Lead: {project.lead}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">
                      {project.progress}% Complete
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatDate(project.startDate)} - {formatDate(project.endDate)}
                    </p>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="relative mb-4">
                  <div className="h-8 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${getStatusColor(project.status)} transition-all duration-500`}
                      style={{ width: `${project.progress}%` }}
                    />
                  </div>

                  {/* Milestones */}
                  <div className="absolute inset-0 flex items-center justify-between px-2">
                    {project.milestones.map((milestone, index) => (
                      <div
                        key={milestone.id}
                        className="relative group"
                        style={{ left: `${(index / (project.milestones.length - 1)) * 90}%` }}
                      >
                        <div className="flex items-center justify-center">
                          {getMilestoneIcon(milestone.status)}
                        </div>
                        <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs rounded px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                          {milestone.name}
                          <br />
                          {formatDate(milestone.date)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Team Members */}
                <div className="flex items-center justify-between">
                  <div className="flex -space-x-2">
                    {project.team.map((member, index) => (
                      <div
                        key={index}
                        className="w-8 h-8 rounded-full bg-gray-300 border-2 border-white flex items-center justify-center text-xs font-medium"
                        title={member}
                      >
                        {member
                          .split(' ')
                          .map((n) => n[0])
                          .join('')}
                      </div>
                    ))}
                  </div>
                  <button className="text-primary-600 hover:text-primary-700 text-sm font-medium">
                    View Details
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {viewMode === 'calendar' && (
        <div className="bg-white shadow rounded-lg p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-medium text-gray-900">
              {selectedMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigateMonth(-1)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <ChevronLeftIcon className="h-5 w-5" />
              </button>
              <button
                onClick={() => setSelectedMonth(new Date())}
                className="px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Today
              </button>
              <button onClick={() => navigateMonth(1)} className="p-2 hover:bg-gray-100 rounded-lg">
                <ChevronRightIcon className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-px bg-gray-200">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div
                key={day}
                className="bg-gray-50 p-2 text-center text-sm font-medium text-gray-700"
              >
                {day}
              </div>
            ))}
            {getMonthDays().map((day, index) => (
              <div key={index} className="bg-white p-2 min-h-[100px] border border-gray-200">
                <p className="text-sm font-medium text-gray-900">{day.getDate()}</p>
                {/* Add milestone indicators here */}
              </div>
            ))}
          </div>
        </div>
      )}

      {viewMode === 'list' && (
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">All Projects</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Client
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Audit Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Timeline
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Progress
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Team
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {projects.map((project) => (
                  <tr key={project.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <p className="text-sm font-medium text-gray-900">{project.client}</p>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-900">
                        {project.auditType.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <p className="text-sm text-gray-900">
                        {formatDate(project.startDate)} - {formatDate(project.endDate)}
                      </p>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-medium rounded-full text-white ${getStatusColor(project.status)}`}
                      >
                        {project.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-24 bg-gray-200 rounded-full h-2 mr-2">
                          <div
                            className={`h-2 rounded-full ${getStatusColor(project.status)}`}
                            style={{ width: `${project.progress}%` }}
                          />
                        </div>
                        <span className="text-sm text-gray-900">{project.progress}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <UserGroupIcon className="h-5 w-5 text-gray-400 mr-2" />
                        <span className="text-sm text-gray-900">{project.team.length + 1}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Resource Allocation */}
      <div className="mt-8 grid grid-cols-2 gap-6">
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Team Utilization</h3>
          <div className="space-y-3">
            {['Sarah Johnson', 'Mike Chen', 'Emily Brown', 'John Doe'].map((member) => (
              <div key={member}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-700">{member}</span>
                  <span className="text-gray-500">85%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-primary-600 h-2 rounded-full" style={{ width: '85%' }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Upcoming Deadlines</h3>
          <div className="space-y-3">
            {projects
              .flatMap((p) =>
                p.milestones
                  .filter((m) => m.status === 'pending' || m.status === 'in_progress')
                  .map((m) => ({ ...m, client: p.client }))
              )
              .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
              .slice(0, 5)
              .map((milestone, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FlagIcon className="h-4 w-4 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{milestone.name}</p>
                      <p className="text-xs text-gray-500">{milestone.client}</p>
                    </div>
                  </div>
                  <span className="text-sm text-gray-500">{formatDate(milestone.date)}</span>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
