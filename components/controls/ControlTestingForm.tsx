'use client';

import { useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import {
  XMarkIcon,
  CheckIcon,
  ClipboardDocumentListIcon,
  BeakerIcon,
  DocumentArrowUpIcon,
  ExclamationTriangleIcon,
  PencilSquareIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  BookmarkIcon,
} from '@heroicons/react/24/outline';
import { TestingWizardProvider, useTestingWizard } from '@/hooks/useTestingWizard';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import toast from 'react-hot-toast';
import type { ControlTestingFormProps } from '@/types/control-testing.types';

// Import step components
import TestMetadataStep from './testing/TestMetadataStep';
import TestProceduresStep from './testing/TestProceduresStep';
import EvidenceCollectionStep from './testing/EvidenceCollectionStep';
import FindingsAssessmentStep from './testing/FindingsAssessmentStep';
import DigitalSignOffStep from './testing/DigitalSignOffStep';

const steps = [
  { 
    id: 1, 
    name: 'Test Setup', 
    description: 'Configure test parameters',
    icon: ClipboardDocumentListIcon 
  },
  { 
    id: 2, 
    name: 'Execute Tests', 
    description: 'Complete test procedures',
    icon: BeakerIcon 
  },
  { 
    id: 3, 
    name: 'Evidence', 
    description: 'Collect supporting evidence',
    icon: DocumentArrowUpIcon 
  },
  { 
    id: 4, 
    name: 'Findings', 
    description: 'Document results and findings',
    icon: ExclamationTriangleIcon 
  },
  { 
    id: 5, 
    name: 'Sign-off', 
    description: 'Review and approve',
    icon: PencilSquareIcon 
  },
];

function StepIndicator() {
  const { currentStep, totalSteps, goToStep } = useTestingWizard();
  
  return (
    <nav aria-label="Progress" className="px-6 py-4 bg-gray-50 border-b border-gray-200">
      <ol className="flex items-center justify-between">
        {steps.map((step, stepIdx) => {
          const isActive = step.id === currentStep;
          const isCompleted = step.id < currentStep;
          const isClickable = step.id <= currentStep;
          const Icon = step.icon;
          
          return (
            <li key={step.name} className="relative flex-1">
              <button
                onClick={() => isClickable && goToStep(step.id)}
                disabled={!isClickable}
                className={`group flex flex-col items-center ${isClickable ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                aria-current={isActive ? 'step' : undefined}
              >
                <span className="flex items-center justify-center w-10 h-10 rounded-full">
                  {isCompleted ? (
                    <span className="w-10 h-10 bg-primary-600 rounded-full flex items-center justify-center">
                      <CheckIcon className="w-6 h-6 text-white" aria-hidden="true" />
                    </span>
                  ) : isActive ? (
                    <span className="w-10 h-10 bg-primary-600 rounded-full flex items-center justify-center">
                      <Icon className="w-6 h-6 text-white" aria-hidden="true" />
                    </span>
                  ) : (
                    <span className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center">
                      <Icon className="w-6 h-6 text-gray-500" aria-hidden="true" />
                    </span>
                  )}
                </span>
                <span className="mt-2 text-xs text-center">
                  <span className={`block font-medium ${
                    isActive ? 'text-primary-600' : isCompleted ? 'text-gray-900' : 'text-gray-500'
                  }`}>
                    {step.name}
                  </span>
                  <span className={`block text-xs ${
                    isActive ? 'text-primary-500' : 'text-gray-400'
                  }`}>
                    {step.description}
                  </span>
                </span>
              </button>
              
              {/* Connector line */}
              {stepIdx < steps.length - 1 && (
                <div className="absolute top-5 left-[50%] w-full h-0.5">
                  <div className={`h-full ${
                    step.id < currentStep ? 'bg-primary-600' : 'bg-gray-300'
                  }`} />
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function AutoSaveIndicator() {
  const { isDirty, lastSaved, autoSave } = useTestingWizard();
  const [saving, setSaving] = useState(false);

  const handleManualSave = async () => {
    setSaving(true);
    await autoSave();
    setSaving(false);
  };

  if (!isDirty && !lastSaved) return null;

  return (
    <div className="fixed bottom-4 right-4 z-40">
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 px-4 py-2 flex items-center space-x-3">
        {saving ? (
          <>
            <LoadingSpinner size="sm" />
            <span className="text-sm text-gray-600">Saving...</span>
          </>
        ) : isDirty ? (
          <>
            <div className="h-2 w-2 bg-yellow-400 rounded-full animate-pulse" />
            <span className="text-sm text-gray-600">Unsaved changes</span>
            <button
              onClick={handleManualSave}
              className="text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              Save now
            </button>
          </>
        ) : lastSaved ? (
          <>
            <CheckIcon className="h-4 w-4 text-green-500" />
            <span className="text-sm text-gray-600">
              Saved {new Date(lastSaved).toLocaleTimeString()}
            </span>
          </>
        ) : null}
      </div>
    </div>
  );
}

function TestingFormSteps({ onCancel }: { onCancel?: () => void }) {
  const { currentStep, isSubmitting } = useTestingWizard();
  
  const stepComponents: { [key: number]: JSX.Element } = {
    1: <TestMetadataStep />,
    2: <TestProceduresStep />,
    3: <EvidenceCollectionStep />,
    4: <FindingsAssessmentStep />,
    5: <DigitalSignOffStep />,
  };
  
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-6 py-6">
        {stepComponents[currentStep]}
      </div>
    </div>
  );
}

function StepNavigation({ onCancel }: { onCancel?: () => void }) {
  const { 
    currentStep, 
    totalSteps, 
    canProceed, 
    nextStep, 
    prevStep, 
    saveDraft,
    isSubmitting 
  } = useTestingWizard();

  return (
    <div className="bg-gray-50 px-6 py-4 flex justify-between items-center border-t border-gray-200">
      <div className="flex items-center space-x-4">
        <button
          onClick={async () => {
            await saveDraft();
            toast.success('Draft saved');
          }}
          disabled={isSubmitting}
          className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <BookmarkIcon className="h-4 w-4 mr-2" />
          Save Draft
        </button>
        
        {onCancel && (
          <button
            onClick={onCancel}
            disabled={isSubmitting}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Cancel
          </button>
        )}
      </div>
      
      <div className="flex items-center space-x-3">
        {currentStep > 1 && (
          <button
            onClick={prevStep}
            disabled={isSubmitting}
            className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-2" />
            Previous
          </button>
        )}
        
        {currentStep < totalSteps && (
          <button
            onClick={nextStep}
            disabled={!canProceed || isSubmitting}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next Step
            <ArrowRightIcon className="h-4 w-4 ml-2" />
          </button>
        )}
      </div>
    </div>
  );
}

export default function ControlTestingForm({ 
  controlId, 
  controlName,
  onSuccess, 
  onCancel,
  initialData,
  mode = 'create'
}: ControlTestingFormProps) {
  const [isOpen, setIsOpen] = useState(true);

  const handleClose = () => {
    setIsOpen(false);
    onCancel?.();
  };

  const handleSuccess = (testId: string) => {
    setIsOpen(false);
    onSuccess?.(testId);
  };

  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={() => {}}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white shadow-xl transition-all w-full max-w-5xl">
                <TestingWizardProvider 
                  controlId={controlId} 
                  onSuccess={handleSuccess}
                  initialData={initialData}
                >
                  <div className="flex flex-col h-[90vh]">
                    {/* Header */}
                    <div className="bg-white px-6 py-4 border-b border-gray-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <Dialog.Title as="h3" className="text-lg font-semibold leading-6 text-gray-900">
                            {mode === 'edit' ? 'Edit Control Test' : 'New Control Test'}
                          </Dialog.Title>
                          {controlName && (
                            <p className="mt-1 text-sm text-gray-500">
                              Testing: {controlName}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={handleClose}
                          className="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                        >
                          <span className="sr-only">Close</span>
                          <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                        </button>
                      </div>
                    </div>

                    {/* Step Indicator */}
                    <StepIndicator />

                    {/* Form Steps */}
                    <TestingFormSteps onCancel={handleClose} />

                    {/* Navigation */}
                    <StepNavigation onCancel={handleClose} />

                    {/* Auto-save Indicator */}
                    <AutoSaveIndicator />
                  </div>
                </TestingWizardProvider>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
}