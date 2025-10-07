'use client';

import { useState, useMemo } from 'react';
import { format, subMonths, addMonths, startOfMonth, endOfMonth, eachMonthOfInterval } from 'date-fns';
import {
  CalendarIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  DocumentCheckIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';

interface TimelineEvent {
  id: string;
  date: Date;
  type: 'TEST_PASS' | 'TEST_FAIL' | 'TEST_PARTIAL' | 'REVIEW' | 'UPDATE' | 'CREATED';
  controlId: string;
  controlName: string;
  description: string;
  effectiveness?: 'EFFECTIVE' | 'PARTIALLY_EFFECTIVE' | 'INEFFECTIVE';
  tester?: string;
  findings?: string;
}

interface ControlComplianceTimelineProps {
  controlId?: string;
  frameworkId?: string;
  events?: TimelineEvent[];
  onEventClick?: (event: TimelineEvent) => void;
}

const eventTypeConfig = {
  TEST_PASS: {
    icon: CheckCircleIcon,
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    label: 'Test Passed',
  },
  TEST_FAIL: {
    icon: XCircleIcon,
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    label: 'Test Failed',
  },
  TEST_PARTIAL: {
    icon: ExclamationTriangleIcon,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-100',
    label: 'Partial Pass',
  },
  REVIEW: {
    icon: DocumentCheckIcon,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    label: 'Review',
  },
  UPDATE: {
    icon: ClockIcon,
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
    label: 'Updated',
  },
  CREATED: {
    icon: CalendarIcon,
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
    label: 'Created',
  },
};

// Mock data generator
const generateMockEvents = (months: number = 12): TimelineEvent[] => {
  const events: TimelineEvent[] = [];
  const now = new Date();
  
  for (let i = 0; i < months; i++) {
    const month = subMonths(now, i);
    const eventsInMonth = Math.floor(Math.random() * 5) + 1;
    
    for (let j = 0; j < eventsInMonth; j++) {
      const day = Math.floor(Math.random() * 28) + 1;
      const types: TimelineEvent['type'][] = ['TEST_PASS', 'TEST_FAIL', 'TEST_PARTIAL', 'REVIEW', 'UPDATE'];
      const type = types[Math.floor(Math.random() * types.length)];
      
      events.push({
        id: `event-${i}-${j}`,
        date: new Date(month.getFullYear(), month.getMonth(), day),
        type,
        controlId: `CTRL-${Math.floor(Math.random() * 100) + 1}`,
        controlName: `Control ${Math.floor(Math.random() * 100) + 1}`,
        description: `${eventTypeConfig[type].label} for compliance verification`,
        effectiveness: type.startsWith('TEST') 
          ? ['EFFECTIVE', 'PARTIALLY_EFFECTIVE', 'INEFFECTIVE'][Math.floor(Math.random() * 3)] as any
          : undefined,
        tester: type.startsWith('TEST') ? ['John Doe', 'Jane Smith', 'Bob Johnson'][Math.floor(Math.random() * 3)] : undefined,
      });
    }
  }
  
  return events.sort((a, b) => b.date.getTime() - a.date.getTime());
};

export default function ControlComplianceTimeline({
  controlId,
  frameworkId,
  events = generateMockEvents(),
  onEventClick,
}: ControlComplianceTimelineProps) {
  const [viewMode, setViewMode] = useState<'timeline' | 'calendar' | 'list'>('timeline');
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);
  
  // Group events by month for timeline view
  const eventsByMonth = useMemo(() => {
    const grouped = new Map<string, TimelineEvent[]>();
    
    events.forEach(event => {
      const monthKey = format(event.date, 'yyyy-MM');
      if (!grouped.has(monthKey)) {
        grouped.set(monthKey, []);
      }
      grouped.get(monthKey)!.push(event);
    });
    
    return Array.from(grouped.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([month, events]) => ({
        month,
        date: new Date(month + '-01'),
        events: events.sort((a, b) => b.date.getTime() - a.date.getTime()),
      }));
  }, [events]);
  
  // Get events for selected month (calendar view)
  const eventsInSelectedMonth = useMemo(() => {
    const start = startOfMonth(selectedMonth);
    const end = endOfMonth(selectedMonth);
    
    return events.filter(event => 
      event.date >= start && event.date <= end
    );
  }, [events, selectedMonth]);
  
  // Calculate compliance metrics
  const complianceMetrics = useMemo(() => {
    const testEvents = events.filter(e => e.type.startsWith('TEST'));
    const passedTests = testEvents.filter(e => e.type === 'TEST_PASS');
    const failedTests = testEvents.filter(e => e.type === 'TEST_FAIL');
    const partialTests = testEvents.filter(e => e.type === 'TEST_PARTIAL');
    
    return {
      totalTests: testEvents.length,
      passed: passedTests.length,
      failed: failedTests.length,
      partial: partialTests.length,
      passRate: testEvents.length > 0 
        ? Math.round((passedTests.length / testEvents.length) * 100)
        : 0,
    };
  }, [events]);
  
  const renderTimelineView = () => (
    <div className="space-y-8">
      {eventsByMonth.map(({ month, date, events: monthEvents }) => (
        <div key={month}>
          <div className="sticky top-0 z-10 bg-white pb-2">
            <h3 className="text-sm font-semibold text-gray-900">
              {format(date, 'MMMM yyyy')}
            </h3>
            <div className="mt-1 border-b border-gray-200"></div>
          </div>
          
          <div className="mt-4 space-y-4">
            {monthEvents.map((event) => {
              const config = eventTypeConfig[event.type];
              const Icon = config.icon;
              const isExpanded = expandedEvent === event.id;
              
              return (
                <div
                  key={event.id}
                  className="relative flex items-start"
                >
                  <div className="flex items-center h-full">
                    <div className={`flex items-center justify-center w-10 h-10 rounded-full ${config.bgColor}`}>
                      <Icon className={`w-5 h-5 ${config.color}`} />
                    </div>
                  </div>
                  
                  <div className="ml-4 flex-1">
                    <div 
                      className="bg-white p-4 rounded-lg border border-gray-200 hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => {
                        setExpandedEvent(isExpanded ? null : event.id);
                        onEventClick?.(event);
                      }}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${config.bgColor} ${config.color}`}>
                              {config.label}
                            </span>
                            <span className="text-sm text-gray-500">
                              {format(event.date, 'MMM d, yyyy')}
                            </span>
                          </div>
                          <p className="mt-1 text-sm font-medium text-gray-900">
                            {event.controlName}
                          </p>
                          <p className="mt-1 text-sm text-gray-600">
                            {event.description}
                          </p>
                          
                          {isExpanded && (
                            <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                              {event.tester && (
                                <p className="text-sm text-gray-600">
                                  <span className="font-medium">Tester:</span> {event.tester}
                                </p>
                              )}
                              {event.effectiveness && (
                                <p className="text-sm text-gray-600">
                                  <span className="font-medium">Effectiveness:</span>{' '}
                                  <span className={
                                    event.effectiveness === 'EFFECTIVE' ? 'text-green-600' :
                                    event.effectiveness === 'PARTIALLY_EFFECTIVE' ? 'text-yellow-600' :
                                    'text-red-600'
                                  }>
                                    {event.effectiveness.replace('_', ' ').toLowerCase()}
                                  </span>
                                </p>
                              )}
                              {event.findings && (
                                <p className="text-sm text-gray-600">
                                  <span className="font-medium">Findings:</span> {event.findings}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="ml-4 flex-shrink-0">
                          <span className="text-xs text-gray-500">
                            {event.controlId}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
  
  const renderCalendarView = () => {
    const daysInMonth = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0).getDate();
    const firstDayOfMonth = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1).getDay();
    
    return (
      <div>
        {/* Calendar Navigation */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setSelectedMonth(subMonths(selectedMonth, 1))}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeftIcon className="h-5 w-5 text-gray-600" />
          </button>
          <h3 className="text-lg font-semibold text-gray-900">
            {format(selectedMonth, 'MMMM yyyy')}
          </h3>
          <button
            onClick={() => setSelectedMonth(addMonths(selectedMonth, 1))}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowRightIcon className="h-5 w-5 text-gray-600" />
          </button>
        </div>
        
        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-px bg-gray-200">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="bg-gray-50 p-2 text-center text-xs font-medium text-gray-700">
              {day}
            </div>
          ))}
          
          {/* Empty cells for days before month starts */}
          {[...Array(firstDayOfMonth)].map((_, i) => (
            <div key={`empty-${i}`} className="bg-white p-2 h-24"></div>
          ))}
          
          {/* Days of the month */}
          {[...Array(daysInMonth)].map((_, i) => {
            const day = i + 1;
            const date = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), day);
            const dayEvents = eventsInSelectedMonth.filter(e => 
              e.date.getDate() === day
            );
            
            return (
              <div key={day} className="bg-white p-2 h-24 overflow-hidden">
                <div className="text-sm text-gray-900 font-medium mb-1">{day}</div>
                <div className="space-y-1">
                  {dayEvents.slice(0, 3).map(event => {
                    const config = eventTypeConfig[event.type];
                    const Icon = config.icon;
                    
                    return (
                      <div
                        key={event.id}
                        className={`flex items-center p-1 rounded text-xs cursor-pointer hover:opacity-80 ${config.bgColor}`}
                        onClick={() => onEventClick?.(event)}
                        title={event.description}
                      >
                        <Icon className={`h-3 w-3 mr-1 ${config.color}`} />
                        <span className={`truncate ${config.color}`}>
                          {event.controlId}
                        </span>
                      </div>
                    );
                  })}
                  {dayEvents.length > 3 && (
                    <div className="text-xs text-gray-500 pl-1">
                      +{dayEvents.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };
  
  const renderListView = () => (
    <div className="space-y-2">
      {events.map(event => {
        const config = eventTypeConfig[event.type];
        const Icon = config.icon;
        
        return (
          <div
            key={event.id}
            className="flex items-center p-4 bg-white rounded-lg border border-gray-200 hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => onEventClick?.(event)}
          >
            <div className={`flex items-center justify-center w-10 h-10 rounded-full ${config.bgColor} flex-shrink-0`}>
              <Icon className={`w-5 h-5 ${config.color}`} />
            </div>
            <div className="ml-4 flex-1">
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium text-gray-900">{event.controlName}</span>
                <span className="text-sm text-gray-500">•</span>
                <span className="text-sm text-gray-500">{event.controlId}</span>
              </div>
              <p className="text-sm text-gray-600">{event.description}</p>
            </div>
            <div className="ml-4 text-right">
              <p className="text-sm text-gray-900">{format(event.date, 'MMM d')}</p>
              <p className="text-xs text-gray-500">{format(event.date, 'yyyy')}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
  
  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Compliance Timeline</h2>
            <p className="mt-1 text-sm text-gray-500">
              Track control testing and compliance events over time
            </p>
          </div>
          
          {/* View Mode Selector */}
          <div className="flex items-center space-x-2 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('timeline')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                viewMode === 'timeline'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Timeline
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                viewMode === 'calendar'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Calendar
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                viewMode === 'list'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              List
            </button>
          </div>
        </div>
        
        {/* Compliance Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex items-center">
              <ChartBarIcon className="h-5 w-5 text-gray-400" />
              <span className="ml-2 text-xs font-medium text-gray-500">Total Tests</span>
            </div>
            <p className="mt-1 text-2xl font-semibold text-gray-900">{complianceMetrics.totalTests}</p>
          </div>
          
          <div className="bg-green-50 rounded-lg p-3">
            <div className="flex items-center">
              <CheckCircleIcon className="h-5 w-5 text-green-400" />
              <span className="ml-2 text-xs font-medium text-green-600">Passed</span>
            </div>
            <p className="mt-1 text-2xl font-semibold text-green-900">{complianceMetrics.passed}</p>
          </div>
          
          <div className="bg-red-50 rounded-lg p-3">
            <div className="flex items-center">
              <XCircleIcon className="h-5 w-5 text-red-400" />
              <span className="ml-2 text-xs font-medium text-red-600">Failed</span>
            </div>
            <p className="mt-1 text-2xl font-semibold text-red-900">{complianceMetrics.failed}</p>
          </div>
          
          <div className="bg-yellow-50 rounded-lg p-3">
            <div className="flex items-center">
              <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400" />
              <span className="ml-2 text-xs font-medium text-yellow-600">Partial</span>
            </div>
            <p className="mt-1 text-2xl font-semibold text-yellow-900">{complianceMetrics.partial}</p>
          </div>
          
          <div className="bg-blue-50 rounded-lg p-3">
            <div className="flex items-center">
              <ChartBarIcon className="h-5 w-5 text-blue-400" />
              <span className="ml-2 text-xs font-medium text-blue-600">Pass Rate</span>
            </div>
            <p className="mt-1 text-2xl font-semibold text-blue-900">{complianceMetrics.passRate}%</p>
          </div>
        </div>
      </div>
      
      {/* Timeline/Calendar/List View */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        {viewMode === 'timeline' && renderTimelineView()}
        {viewMode === 'calendar' && renderCalendarView()}
        {viewMode === 'list' && renderListView()}
      </div>
    </div>
  );
}