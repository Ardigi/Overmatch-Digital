'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTestingWizard } from '@/hooks/useTestingWizard';
import { findingsAssessmentSchema } from '@/types/control-testing.types';
import {
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  DocumentTextIcon,
  ShieldExclamationIcon,
  ClipboardDocumentListIcon,
  CalendarIcon,
} from '@heroicons/react/24/outline';

const testResults = [
  {
    value: 'PASS',
    label: 'Pass',
    description: 'Control is operating effectively as designed',
    icon: CheckCircleIcon,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
  },
  {
    value: 'FAIL',
    label: 'Fail',
    description: 'Control deficiency or failure identified',
    icon: XCircleIcon,
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
  },
  {
    value: 'PARTIAL',
    label: 'Partial',
    description: 'Control is partially effective with some gaps',
    icon: ExclamationTriangleIcon,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
  },
];

const riskLevels = [
  { value: 'LOW', label: 'Low Risk', color: 'bg-green-100 text-green-800' },
  { value: 'MEDIUM', label: 'Medium Risk', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'HIGH', label: 'High Risk', color: 'bg-orange-100 text-orange-800' },
  { value: 'CRITICAL', label: 'Critical Risk', color: 'bg-red-100 text-red-800' },
];

export default function FindingsAssessmentStep() {
  const { formData, updateFormData, nextStep } = useTestingWizard();
  const [showRemediationFields, setShowRemediationFields] = useState(
    formData.result === 'FAIL' || formData.remediationRequired
  );

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors }
  } = useForm({
    resolver: zodResolver(findingsAssessmentSchema),
    defaultValues: formData,
  });

  const selectedResult = watch('result');
  const remediationRequired = watch('remediationRequired');

  // Show remediation fields for failures
  if (selectedResult === 'FAIL' && !showRemediationFields) {
    setShowRemediationFields(true);
  }

  const onSubmit = (data: any) => {
    updateFormData(data);
    nextStep();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Test Result Selection */}
      <div className="bg-white shadow-sm rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-base font-semibold text-gray-900 flex items-center">
            <ClipboardDocumentListIcon className="h-5 w-5 mr-2 text-gray-400" />
            Test Result <span className="text-red-500 ml-1">*</span>
          </h3>
        </div>
        <div className="px-6 py-4">
          <div className="space-y-3">
            {testResults.map((result) => {
              const Icon = result.icon;
              return (
                <label
                  key={result.value}
                  className={`relative flex items-start p-4 rounded-lg cursor-pointer transition-colors ${
                    selectedResult === result.value 
                      ? `${result.bgColor} ${result.borderColor} border-2` 
                      : 'border border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    {...register('result')}
                    value={result.value}
                    className="h-4 w-4 text-primary-600 border-gray-300 focus:ring-primary-500"
                  />
                  <div className="ml-3 flex-1">
                    <div className="flex items-center">
                      <Icon className={`h-5 w-5 mr-2 ${result.color}`} />
                      <span className="text-sm font-medium text-gray-900">
                        {result.label}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      {result.description}
                    </p>
                  </div>
                </label>
              );
            })}
          </div>
          {errors.result && (
            <p className="mt-2 text-sm text-red-600">{errors.result.message}</p>
          )}
        </div>
      </div>

      {/* Detailed Findings */}
      <div className="bg-white shadow-sm rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-base font-semibold text-gray-900 flex items-center">
            <DocumentTextIcon className="h-5 w-5 mr-2 text-gray-400" />
            Detailed Findings <span className="text-red-500 ml-1">*</span>
          </h3>
        </div>
        <div className="px-6 py-4 space-y-4">
          <div>
            <label htmlFor="findings" className="block text-sm font-medium text-gray-700 mb-1">
              Testing Observations and Analysis
            </label>
            <textarea
              {...register('findings')}
              rows={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
              placeholder="Document your detailed testing observations, any issues found, root cause analysis, and impact assessment..."
            />
            {errors.findings && (
              <p className="mt-1 text-sm text-red-600">{errors.findings.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="exceptions" className="block text-sm font-medium text-gray-700 mb-1">
              Exceptions Noted (Optional)
            </label>
            <textarea
              {...register('exceptions')}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
              placeholder="Document any exceptions or deviations from expected behavior..."
            />
          </div>

          <div>
            <label htmlFor="recommendations" className="block text-sm font-medium text-gray-700 mb-1">
              Recommendations (Optional)
            </label>
            <textarea
              {...register('recommendations')}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
              placeholder="Provide recommendations for improvement or corrective actions..."
            />
          </div>
        </div>
      </div>

      {/* Risk Assessment */}
      <div className="bg-white shadow-sm rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-base font-semibold text-gray-900 flex items-center">
            <ShieldExclamationIcon className="h-5 w-5 mr-2 text-gray-400" />
            Risk Assessment
          </h3>
        </div>
        <div className="px-6 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Risk Level
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {riskLevels.map((level) => (
                <label
                  key={level.value}
                  className="relative flex items-center justify-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50 focus-within:ring-2 focus-within:ring-primary-500"
                >
                  <input
                    type="radio"
                    {...register('riskLevel')}
                    value={level.value}
                    className="sr-only"
                  />
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${level.color}`}>
                    {level.label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              {...register('remediationRequired')}
              className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
            />
            <label htmlFor="remediationRequired" className="ml-2 text-sm text-gray-700">
              Remediation required for identified issues
            </label>
          </div>
        </div>
      </div>

      {/* Remediation Plan (Conditional) */}
      {(selectedResult === 'FAIL' || remediationRequired) && (
        <div className="bg-red-50 border border-red-200 rounded-lg">
          <div className="px-6 py-4 border-b border-red-200">
            <h3 className="text-base font-semibold text-red-900 flex items-center">
              <ExclamationTriangleIcon className="h-5 w-5 mr-2 text-red-600" />
              Remediation Plan Required
            </h3>
          </div>
          <div className="px-6 py-4 space-y-4">
            <div>
              <label htmlFor="remediationPlan" className="block text-sm font-medium text-gray-700 mb-1">
                Remediation Actions <span className="text-red-500">*</span>
              </label>
              <textarea
                {...register('remediationPlan')}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                placeholder="Describe the specific actions required to remediate the control deficiency..."
              />
              {errors.remediationPlan && (
                <p className="mt-1 text-sm text-red-600">{errors.remediationPlan.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="remediationDeadline" className="block text-sm font-medium text-gray-700 mb-1">
                Target Remediation Date
              </label>
              <div className="relative">
                <input
                  type="date"
                  {...register('remediationDeadline')}
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                />
                <CalendarIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Summary Message */}
      <div className={`border rounded-lg p-4 ${
        selectedResult === 'PASS' 
          ? 'bg-green-50 border-green-200' 
          : selectedResult === 'FAIL'
          ? 'bg-red-50 border-red-200'
          : selectedResult === 'PARTIAL'
          ? 'bg-yellow-50 border-yellow-200'
          : 'bg-gray-50 border-gray-200'
      }`}>
        <div className="flex">
          {selectedResult === 'PASS' && <CheckCircleIcon className="h-5 w-5 text-green-400 mt-0.5" />}
          {selectedResult === 'FAIL' && <XCircleIcon className="h-5 w-5 text-red-400 mt-0.5" />}
          {selectedResult === 'PARTIAL' && <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400 mt-0.5" />}
          {!selectedResult && <DocumentTextIcon className="h-5 w-5 text-gray-400 mt-0.5" />}
          <div className="ml-3">
            <h3 className={`text-sm font-medium ${
              selectedResult === 'PASS' ? 'text-green-800' :
              selectedResult === 'FAIL' ? 'text-red-800' :
              selectedResult === 'PARTIAL' ? 'text-yellow-800' :
              'text-gray-800'
            }`}>
              {selectedResult === 'PASS' && 'Control Test Passed'}
              {selectedResult === 'FAIL' && 'Control Test Failed - Remediation Required'}
              {selectedResult === 'PARTIAL' && 'Control Partially Effective'}
              {!selectedResult && 'Select Test Result'}
            </h3>
            <p className={`mt-1 text-sm ${
              selectedResult === 'PASS' ? 'text-green-700' :
              selectedResult === 'FAIL' ? 'text-red-700' :
              selectedResult === 'PARTIAL' ? 'text-yellow-700' :
              'text-gray-600'
            }`}>
              {selectedResult === 'PASS' && 'The control is operating effectively. Document your findings and proceed to sign-off.'}
              {selectedResult === 'FAIL' && 'Document the control deficiency and provide a remediation plan with timeline.'}
              {selectedResult === 'PARTIAL' && 'The control has some effectiveness but gaps exist. Document findings and recommendations.'}
              {!selectedResult && 'Complete your assessment and document all findings before proceeding.'}
            </p>
          </div>
        </div>
      </div>
    </form>
  );
}