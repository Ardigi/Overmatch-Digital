'use client';

import { CalendarIcon, CheckIcon, FlagIcon } from '@heroicons/react/24/outline';
import { addDays, differenceInDays, format } from 'date-fns';

interface Milestone {
  id: string;
  name: string;
  date: Date;
  type: 'completed' | 'upcoming' | 'overdue';
  description?: string;
}

interface ProjectTimelineProps {
  project: {
    startDate: Date;
    targetEndDate: Date;
    auditPeriodEnd?: Date;
  };
}

export default function ProjectTimeline({ project }: ProjectTimelineProps) {
  const today = new Date();
  const totalDays = differenceInDays(project.targetEndDate, project.startDate);
  const daysElapsed = differenceInDays(today, project.startDate);
  const daysRemaining = differenceInDays(project.targetEndDate, today);
  const progressPercentage = Math.min(100, Math.max(0, (daysElapsed / totalDays) * 100));

  // Generate milestones based on project
  const milestones: Milestone[] = [
    {
      id: '1',
      name: 'Project Kickoff',
      date: project.startDate,
      type: 'completed',
      description: 'Initial planning and scoping',
    },
    {
      id: '2',
      name: 'Readiness Assessment Complete',
      date: addDays(project.startDate, 30),
      type: 'completed',
      description: 'Gap analysis and remediation plan',
    },
    {
      id: '3',
      name: 'Control Implementation',
      date: addDays(project.startDate, 90),
      type: daysElapsed > 90 ? 'completed' : 'upcoming',
      description: 'All controls implemented and documented',
    },
    {
      id: '4',
      name: 'Evidence Collection Complete',
      date: addDays(project.startDate, 120),
      type: daysElapsed > 120 ? 'completed' : daysElapsed > 110 ? 'upcoming' : 'upcoming',
      description: 'All required evidence collected',
    },
    {
      id: '5',
      name: 'Audit Fieldwork',
      date: addDays(project.startDate, 150),
      type: 'upcoming',
      description: 'CPA examination begins',
    },
    {
      id: '6',
      name: 'Final Report Delivery',
      date: project.targetEndDate,
      type: 'upcoming',
      description: 'SOC report issued',
    },
  ];

  return (
    <div>
      {/* Progress Overview */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Timeline Progress</span>
          <span className="text-sm text-gray-500">{Math.round(progressPercentage)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-primary-600 h-2 rounded-full transition-all duration-500"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
        <div className="mt-2 flex justify-between text-xs text-gray-500">
          <span>{format(project.startDate, 'MMM d, yyyy')}</span>
          <span className="font-medium text-gray-900">
            {daysRemaining > 0 ? `${daysRemaining} days remaining` : 'Overdue'}
          </span>
          <span>{format(project.targetEndDate, 'MMM d, yyyy')}</span>
        </div>
      </div>

      {/* Milestones */}
      <div className="flow-root">
        <ul className="-mb-8">
          {milestones.map((milestone, milestoneIdx) => (
            <li key={milestone.id}>
              <div className="relative pb-8">
                {milestoneIdx !== milestones.length - 1 ? (
                  <span
                    className="absolute left-4 top-4 -ml-px h-full w-0.5 bg-gray-200"
                    aria-hidden="true"
                  />
                ) : null}
                <div className="relative flex space-x-3">
                  <div>
                    <span
                      className={`h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white ${
                        milestone.type === 'completed'
                          ? 'bg-green-500'
                          : milestone.type === 'overdue'
                            ? 'bg-red-500'
                            : 'bg-gray-400'
                      }`}
                    >
                      {milestone.type === 'completed' ? (
                        <CheckIcon className="h-5 w-5 text-white" />
                      ) : milestone.id === '6' ? (
                        <FlagIcon className="h-5 w-5 text-white" />
                      ) : (
                        <CalendarIcon className="h-5 w-5 text-white" />
                      )}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm">
                      <span className="font-medium text-gray-900">{milestone.name}</span>
                      {milestone.type === 'overdue' && (
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                          Overdue
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">
                      {format(milestone.date, 'MMM d, yyyy')}
                      {milestone.description && ` • ${milestone.description}`}
                    </p>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
