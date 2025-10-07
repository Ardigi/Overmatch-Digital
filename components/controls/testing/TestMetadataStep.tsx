'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTestingWizard } from '@/hooks/useTestingWizard';
import { testMetadataSchema } from '@/types/control-testing.types';
import {
  CalendarIcon,
  UserIcon,
  ClipboardDocumentCheckIcon,
  BeakerIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';

const testTypes = [
  { value: 'MANUAL', label: 'Manual Testing', description: 'Manual execution and verification' },
  { value: 'AUTOMATED', label: 'Automated Testing', description: 'Script-based automated testing' },
  { value: 'WALKTHROUGH', label: 'Control Walkthrough', description: 'Process review and walkthrough' },
  { value: 'INQUIRY', label: 'Management Inquiry', description: 'Interview and inquiry process' },
  { value: 'OBSERVATION', label: 'Direct Observation', description: 'Direct observation of control' },
];

const methodologies = [
  { value: 'INQUIRY', label: 'Inquiry', description: 'Interview personnel and review documentation' },
  { value: 'OBSERVATION', label: 'Observation', description: 'Observe control execution' },
  { value: 'INSPECTION', label: 'Inspection', description: 'Inspect evidence and documentation' },
  { value: 'REPERFORMANCE', label: 'Reperformance', description: 'Re-execute the control independently' },
];

const samplingMethods = [
  { value: 'RANDOM', label: 'Random Sampling' },
  { value: 'JUDGMENTAL', label: 'Judgmental Sampling' },
  { value: 'SYSTEMATIC', label: 'Systematic Sampling' },
  { value: 'STATISTICAL', label: 'Statistical Sampling' },
];

export default function TestMetadataStep() {
  const { formData, updateFormData, nextStep, validateCurrentStep } = useTestingWizard();
  
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors }
  } = useForm({
    resolver: zodResolver(testMetadataSchema),
    defaultValues: formData,
  });

  const showSampling = watch('methodology') === 'INSPECTION' || watch('methodology') === 'REPERFORMANCE';

  const onSubmit = (data: any) => {
    updateFormData(data);
    if (validateCurrentStep()) {
      nextStep();
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Test Information Card */}
      <div className="bg-white shadow-sm rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-base font-semibold text-gray-900 flex items-center">
            <ClipboardDocumentCheckIcon className="h-5 w-5 mr-2 text-gray-400" />
            Test Information
          </h3>
        </div>
        <div className="px-6 py-4 space-y-6">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {/* Tester Selection */}
            <div>
              <label htmlFor="testerId" className="block text-sm font-medium text-gray-700">
                Tester <span className="text-red-500">*</span>
              </label>
              <div className="mt-1 relative">
                <select
                  {...register('testerId')}
                  className="block w-full pl-10 pr-3 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
                >
                  <option value="">Select tester</option>
                  <option value="user1">John Doe</option>
                  <option value="user2">Jane Smith</option>
                  <option value="user3">Bob Johnson</option>
                </select>
                <UserIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
              </div>
              {errors.testerId && (
                <p className="mt-1 text-sm text-red-600">{errors.testerId.message}</p>
              )}
            </div>

            {/* Test Date */}
            <div>
              <label htmlFor="testDate" className="block text-sm font-medium text-gray-700">
                Test Date <span className="text-red-500">*</span>
              </label>
              <div className="mt-1 relative">
                <input
                  type="date"
                  {...register('testDate')}
                  className="block w-full pl-10 pr-3 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
                />
                <CalendarIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
              </div>
              {errors.testDate && (
                <p className="mt-1 text-sm text-red-600">{errors.testDate.message}</p>
              )}
            </div>
          </div>

          {/* Test Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Test Type <span className="text-red-500">*</span>
            </label>
            <div className="space-y-2">
              {testTypes.map((type) => (
                <label
                  key={type.value}
                  className="relative flex items-start p-3 border rounded-lg cursor-pointer hover:bg-gray-50 focus-within:ring-2 focus-within:ring-primary-500"
                >
                  <input
                    type="radio"
                    {...register('testType')}
                    value={type.value}
                    className="h-4 w-4 text-primary-600 border-gray-300 focus:ring-primary-500"
                  />
                  <div className="ml-3">
                    <span className="block text-sm font-medium text-gray-900">
                      {type.label}
                    </span>
                    <span className="block text-sm text-gray-500">
                      {type.description}
                    </span>
                  </div>
                </label>
              ))}
            </div>
            {errors.testType && (
              <p className="mt-1 text-sm text-red-600">{errors.testType.message}</p>
            )}
          </div>

          {/* Methodology */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Testing Methodology <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {methodologies.map((method) => (
                <label
                  key={method.value}
                  className="relative flex items-start p-3 border rounded-lg cursor-pointer hover:bg-gray-50 focus-within:ring-2 focus-within:ring-primary-500"
                >
                  <input
                    type="radio"
                    {...register('methodology')}
                    value={method.value}
                    className="h-4 w-4 text-primary-600 border-gray-300 focus:ring-primary-500"
                  />
                  <div className="ml-3">
                    <span className="block text-sm font-medium text-gray-900">
                      {method.label}
                    </span>
                    <span className="block text-xs text-gray-500">
                      {method.description}
                    </span>
                  </div>
                </label>
              ))}
            </div>
            {errors.methodology && (
              <p className="mt-1 text-sm text-red-600">{errors.methodology.message}</p>
            )}
          </div>

          {/* Test Scope */}
          <div>
            <label htmlFor="scope" className="block text-sm font-medium text-gray-700">
              Test Scope (Optional)
            </label>
            <textarea
              {...register('scope')}
              rows={3}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
              placeholder="Describe the scope and objectives of this test..."
            />
          </div>
        </div>
      </div>

      {/* Sampling Information (Conditional) */}
      {showSampling && (
        <div className="bg-white shadow-sm rounded-lg border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-base font-semibold text-gray-900 flex items-center">
              <ChartBarIcon className="h-5 w-5 mr-2 text-gray-400" />
              Sampling Information
            </h3>
          </div>
          <div className="px-6 py-4 space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor="population" className="block text-sm font-medium text-gray-700">
                  Population Size
                </label>
                <input
                  type="number"
                  {...register('population', { valueAsNumber: true })}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  placeholder="Total items"
                />
              </div>
              <div>
                <label htmlFor="sampleSize" className="block text-sm font-medium text-gray-700">
                  Sample Size
                </label>
                <input
                  type="number"
                  {...register('sampleSize', { valueAsNumber: true })}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  placeholder="Items to test"
                />
              </div>
              <div>
                <label htmlFor="samplingMethod" className="block text-sm font-medium text-gray-700">
                  Sampling Method
                </label>
                <select
                  {...register('samplingMethod')}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                >
                  <option value="">Select method</option>
                  {samplingMethods.map((method) => (
                    <option key={method.value} value={method.value}>
                      {method.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Information Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex">
          <BeakerIcon className="h-5 w-5 text-blue-400 mt-0.5" />
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">Testing Guidelines</h3>
            <p className="mt-1 text-sm text-blue-700">
              Ensure all test parameters are accurately configured. The methodology selected will determine
              the required evidence and procedures in the next steps.
            </p>
          </div>
        </div>
      </div>
    </form>
  );
}