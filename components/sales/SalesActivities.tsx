'use client';

import {
  CalendarIcon,
  CheckCircleIcon,
  ClockIcon,
  CurrencyDollarIcon,
  DocumentTextIcon,
  EnvelopeIcon,
  PhoneIcon,
  PlusIcon,
  UserGroupIcon,
  VideoCameraIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import { useState } from 'react';

interface Activity {
  id: string;
  type: 'call' | 'email' | 'meeting' | 'proposal' | 'task';
  title: string;
  description: string;
  contact: string;
  company: string;
  date: string;
  duration?: number;
  outcome?: 'completed' | 'no_show' | 'rescheduled' | 'pending';
  nextSteps?: string;
  associatedDeal?: string;
  dealValue?: number;
}

export default function SalesActivities() {
  const [filterType, setFilterType] = useState('all');
  const [timeRange, setTimeRange] = useState('week');

  // Mock data based on documentation's sales process
  const activities: Activity[] = [
    {
      id: '1',
      type: 'call',
      title: 'Discovery Call',
      description: 'Initial discovery call to understand SOC 2 requirements',
      contact: 'Sarah Mitchell',
      company: 'GlobalTech Industries',
      date: '2024-07-18T10:00:00',
      duration: 45,
      outcome: 'completed',
      nextSteps: 'Send SOC 2 readiness assessment proposal',
      associatedDeal: 'GlobalTech SOC 2',
      dealValue: 150000,
    },
    {
      id: '2',
      type: 'email',
      title: 'Follow-up: Pricing Information',
      description: 'Sent detailed pricing breakdown for SOC 2 Type II audit',
      contact: 'David Chen',
      company: 'FinanceFlow Systems',
      date: '2024-07-18T14:30:00',
      outcome: 'completed',
      associatedDeal: 'FinanceFlow SOC 1+2',
      dealValue: 180000,
    },
    {
      id: '3',
      type: 'meeting',
      title: 'Technical Requirements Review',
      description: 'Deep dive into systems architecture and Trust Services Criteria',
      contact: 'Michael Torres',
      company: 'SecureCloud Corp',
      date: '2024-07-19T13:00:00',
      duration: 90,
      outcome: 'pending',
      associatedDeal: 'SecureCloud SOC 2',
      dealValue: 135000,
    },
    {
      id: '4',
      type: 'proposal',
      title: 'SOC 2 Type II Proposal',
      description: 'Comprehensive proposal including readiness assessment and Type II audit',
      contact: 'Thomas Brown',
      company: 'Enterprise Solutions Ltd',
      date: '2024-07-17T16:00:00',
      outcome: 'completed',
      nextSteps: 'Schedule proposal presentation for next week',
      associatedDeal: 'Enterprise SOC 2+PT',
      dealValue: 185000,
    },
    {
      id: '5',
      type: 'task',
      title: 'Prepare ROI Analysis',
      description: 'Create customized ROI calculation for Healthcare vertical',
      contact: 'Dr. Robert Chen',
      company: 'HealthData Systems',
      date: '2024-07-19T09:00:00',
      outcome: 'pending',
      associatedDeal: 'HealthData SOC 2+HIPAA',
      dealValue: 150000,
    },
    {
      id: '6',
      type: 'meeting',
      title: 'Stakeholder Presentation',
      description: 'Present SOC 2 compliance roadmap to executive team',
      contact: 'Lisa Wang',
      company: 'DataVault Inc',
      date: '2024-07-20T15:00:00',
      duration: 60,
      outcome: 'pending',
      associatedDeal: 'DataVault Readiness',
      dealValue: 95000,
    },
    {
      id: '7',
      type: 'call',
      title: 'Objection Handling Call',
      description: 'Address concerns about implementation timeline and costs',
      contact: 'Rachel Green',
      company: 'InnovateTech',
      date: '2024-07-17T11:00:00',
      duration: 30,
      outcome: 'completed',
      nextSteps: 'Send case studies and reference contacts',
      associatedDeal: 'InnovateTech SOC 2',
      dealValue: 125000,
    },
    {
      id: '8',
      type: 'email',
      title: 'Contract Review',
      description: 'Sent revised contract with updated terms',
      contact: 'Patricia Martinez',
      company: 'FinServ Global',
      date: '2024-07-17T09:30:00',
      outcome: 'completed',
      associatedDeal: 'FinServ SOC 1+2',
      dealValue: 165000,
    },
  ];

  const getActivityIcon = (type: Activity['type']) => {
    switch (type) {
      case 'call':
        return PhoneIcon;
      case 'email':
        return EnvelopeIcon;
      case 'meeting':
        return VideoCameraIcon;
      case 'proposal':
        return DocumentTextIcon;
      case 'task':
        return CheckCircleIcon;
    }
  };

  const getActivityColor = (type: Activity['type']) => {
    switch (type) {
      case 'call':
        return 'bg-blue-100 text-blue-600';
      case 'email':
        return 'bg-green-100 text-green-600';
      case 'meeting':
        return 'bg-purple-100 text-purple-600';
      case 'proposal':
        return 'bg-yellow-100 text-yellow-600';
      case 'task':
        return 'bg-gray-100 text-gray-600';
    }
  };

  const getOutcomeIcon = (outcome?: Activity['outcome']) => {
    switch (outcome) {
      case 'completed':
        return <CheckCircleIcon className="h-4 w-4 text-green-600" />;
      case 'no_show':
        return <XCircleIcon className="h-4 w-4 text-red-600" />;
      case 'rescheduled':
        return <ClockIcon className="h-4 w-4 text-yellow-600" />;
      case 'pending':
        return <ClockIcon className="h-4 w-4 text-gray-400" />;
      default:
        return null;
    }
  };

  const filteredActivities = activities.filter((activity) => {
    if (filterType === 'all') return true;
    return activity.type === filterType;
  });

  const upcomingActivities = filteredActivities
    .filter((a) => new Date(a.date) > new Date())
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const pastActivities = filteredActivities
    .filter((a) => new Date(a.date) <= new Date())
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const stats = {
    callsCompleted: activities.filter((a) => a.type === 'call' && a.outcome === 'completed').length,
    meetingsScheduled: activities.filter((a) => a.type === 'meeting' && a.outcome === 'pending')
      .length,
    proposalsSent: activities.filter((a) => a.type === 'proposal').length,
    totalDealValue: activities.reduce((sum, a) => sum + (a.dealValue || 0), 0),
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <PhoneIcon className="h-8 w-8 text-blue-600" />
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.callsCompleted}</p>
              <p className="text-sm text-gray-600">Calls Completed</p>
            </div>
          </div>
        </div>
        <div className="bg-purple-50 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <VideoCameraIcon className="h-8 w-8 text-purple-600" />
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.meetingsScheduled}</p>
              <p className="text-sm text-gray-600">Meetings Scheduled</p>
            </div>
          </div>
        </div>
        <div className="bg-yellow-50 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <DocumentTextIcon className="h-8 w-8 text-yellow-600" />
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.proposalsSent}</p>
              <p className="text-sm text-gray-600">Proposals Sent</p>
            </div>
          </div>
        </div>
        <div className="bg-green-50 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <CurrencyDollarIcon className="h-8 w-8 text-green-600" />
            <div>
              <p className="text-2xl font-bold text-gray-900">
                ${(stats.totalDealValue / 1000).toFixed(0)}k
              </p>
              <p className="text-sm text-gray-600">Deal Value</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="all">All Activities</option>
            <option value="call">Calls</option>
            <option value="email">Emails</option>
            <option value="meeting">Meetings</option>
            <option value="proposal">Proposals</option>
            <option value="task">Tasks</option>
          </select>

          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="all">All Time</option>
          </select>
        </div>

        <button className="btn-primary flex items-center gap-2">
          <PlusIcon className="h-5 w-5" />
          Log Activity
        </button>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Upcoming Activities ({upcomingActivities.length})
          </h3>
          <div className="space-y-3">
            {upcomingActivities.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No upcoming activities</p>
            ) : (
              upcomingActivities.map((activity) => {
                const Icon = getActivityIcon(activity.type);
                return (
                  <div key={activity.id} className="bg-white border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${getActivityColor(activity.type)}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-medium text-gray-900">{activity.title}</h4>
                            <p className="text-sm text-gray-600 mt-1">{activity.description}</p>
                            <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                              <div className="flex items-center gap-1">
                                <UserGroupIcon className="h-4 w-4" />
                                {activity.contact} • {activity.company}
                              </div>
                              <div className="flex items-center gap-1">
                                <CalendarIcon className="h-4 w-4" />
                                {format(new Date(activity.date), 'MMM d, h:mm a')}
                              </div>
                            </div>
                            {activity.associatedDeal && (
                              <div className="mt-2 text-sm">
                                <span className="text-gray-600">Deal: </span>
                                <span className="font-medium text-gray-900">
                                  {activity.associatedDeal} • $
                                  {(activity.dealValue! / 1000).toFixed(0)}k
                                </span>
                              </div>
                            )}
                          </div>
                          {getOutcomeIcon(activity.outcome)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Recent Activities ({pastActivities.length})
          </h3>
          <div className="space-y-3">
            {pastActivities.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No recent activities</p>
            ) : (
              pastActivities.slice(0, 5).map((activity) => {
                const Icon = getActivityIcon(activity.type);
                return (
                  <div
                    key={activity.id}
                    className="bg-gray-50 border border-gray-200 rounded-lg p-4"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${getActivityColor(activity.type)}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-medium text-gray-900">{activity.title}</h4>
                            <p className="text-sm text-gray-600 mt-1">{activity.description}</p>
                            <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                              <div className="flex items-center gap-1">
                                <UserGroupIcon className="h-4 w-4" />
                                {activity.contact} • {activity.company}
                              </div>
                              <div className="flex items-center gap-1">
                                <CalendarIcon className="h-4 w-4" />
                                {format(new Date(activity.date), 'MMM d, h:mm a')}
                              </div>
                              {activity.duration && <span>{activity.duration} min</span>}
                            </div>
                            {activity.nextSteps && (
                              <div className="mt-2 p-2 bg-blue-50 rounded text-sm">
                                <span className="font-medium text-blue-900">Next Steps: </span>
                                <span className="text-blue-700">{activity.nextSteps}</span>
                              </div>
                            )}
                          </div>
                          {getOutcomeIcon(activity.outcome)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
