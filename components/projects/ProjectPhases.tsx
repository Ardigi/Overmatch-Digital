'use client';

import {
  ClipboardDocumentCheckIcon,
  DocumentMagnifyingGlassIcon,
  WrenchScrewdriverIcon,
} from '@heroicons/react/24/outline';
import { CheckIcon } from '@heroicons/react/24/solid';

interface Phase {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  tasks: {
    name: string;
    completed: boolean;
  }[];
}

const phases: Phase[] = [
  {
    id: 'ASSESSMENT',
    name: 'Pre-Engagement Assessment',
    description: 'Scoping, planning, and readiness assessment',
    icon: ClipboardDocumentCheckIcon,
    tasks: [
      { name: 'Define audit scope and criteria', completed: true },
      { name: 'Conduct readiness assessment', completed: true },
      { name: 'Identify gaps and remediation needs', completed: true },
      { name: 'Establish project timeline', completed: true },
    ],
  },
  {
    id: 'IMPLEMENTATION',
    name: 'Control Implementation & Testing',
    description: 'Gap remediation, evidence collection, and control testing',
    icon: WrenchScrewdriverIcon,
    tasks: [
      { name: 'Implement missing controls', completed: true },
      { name: 'Document policies and procedures', completed: true },
      { name: 'Collect control evidence', completed: false },
      { name: 'Perform control testing', completed: false },
    ],
  },
  {
    id: 'AUDIT',
    name: 'Formal Audit Execution',
    description: 'CPA-led examination and report generation',
    icon: DocumentMagnifyingGlassIcon,
    tasks: [
      { name: 'Management representation letter', completed: false },
      { name: 'Control design evaluation', completed: false },
      { name: 'Operating effectiveness testing', completed: false },
      { name: 'Final report preparation', completed: false },
    ],
  },
];

interface ProjectPhasesProps {
  currentPhase: string;
  projectId: string;
}

export default function ProjectPhases({ currentPhase, projectId }: ProjectPhasesProps) {
  const currentPhaseIndex = phases.findIndex((p) => p.id === currentPhase);

  return (
    <div>
      {/* Phase Timeline */}
      <nav aria-label="Progress">
        <ol className="flex items-center">
          {phases.map((phase, phaseIdx) => {
            const isCompleted = phaseIdx < currentPhaseIndex;
            const isCurrent = phase.id === currentPhase;

            return (
              <li key={phase.id} className={phaseIdx !== phases.length - 1 ? 'flex-1' : ''}>
                <div className="group">
                  <div className="flex items-center">
                    <span
                      className={`flex items-center justify-center w-10 h-10 rounded-full ${
                        isCompleted
                          ? 'bg-primary-600'
                          : isCurrent
                            ? 'bg-primary-600'
                            : 'bg-gray-300'
                      }`}
                    >
                      {isCompleted ? (
                        <CheckIcon className="w-6 h-6 text-white" />
                      ) : (
                        <phase.icon
                          className={`w-6 h-6 ${isCurrent ? 'text-white' : 'text-gray-500'}`}
                        />
                      )}
                    </span>
                    {phaseIdx !== phases.length - 1 && (
                      <div className="hidden sm:block flex-1 ml-4">
                        <div
                          className={`h-0.5 ${isCompleted ? 'bg-primary-600' : 'bg-gray-300'}`}
                        />
                      </div>
                    )}
                  </div>
                  <div className="mt-3">
                    <p
                      className={`text-sm font-medium ${isCurrent ? 'text-primary-600' : 'text-gray-900'}`}
                    >
                      Phase {phaseIdx + 1}: {phase.name}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">{phase.description}</p>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Current Phase Details */}
      <div className="mt-8 bg-gray-50 rounded-lg p-6">
        <h3 className="text-sm font-medium text-gray-900 mb-4">
          Current Phase: {phases[currentPhaseIndex]?.name}
        </h3>
        <div className="space-y-3">
          {phases[currentPhaseIndex]?.tasks.map((task, idx) => (
            <div key={idx} className="flex items-start">
              <div className="flex items-center h-5">
                <input
                  type="checkbox"
                  checked={task.completed}
                  readOnly
                  className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                />
              </div>
              <div className="ml-3">
                <label
                  className={`text-sm ${task.completed ? 'text-gray-500 line-through' : 'text-gray-900'}`}
                >
                  {task.name}
                </label>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex justify-between items-center">
          <div className="text-sm text-gray-500">
            Phase Progress:{' '}
            {phases[currentPhaseIndex]?.tasks.filter((t) => t.completed).length || 0} of{' '}
            {phases[currentPhaseIndex]?.tasks.length || 0} tasks completed
          </div>
          {currentPhaseIndex < phases.length - 1 && (
            <button className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700">
              Move to Next Phase
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
