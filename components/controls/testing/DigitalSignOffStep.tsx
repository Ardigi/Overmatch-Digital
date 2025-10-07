'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTestingWizard } from '@/hooks/useTestingWizard';
import { signOffSchema } from '@/types/control-testing.types';
import {
  CheckCircleIcon,
  DocumentCheckIcon,
  PencilSquareIcon,
  UserIcon,
  CalendarIcon,
  ExclamationTriangleIcon,
  DocumentTextIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

export default function DigitalSignOffStep() {
  const { formData, updateFormData, submitForm, isSubmitting } = useTestingWizard();
  const [isReviewing, setIsReviewing] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors }
  } = useForm({
    resolver: zodResolver(signOffSchema),
    defaultValues: formData,
  });

  const confirmAccuracy = watch('confirmAccuracy');

  const onSubmit = async (data: any) => {
    updateFormData(data);
    setIsReviewing(true);
    
    // Simulate final review process
    setTimeout(async () => {
      await submitForm();
      setIsReviewing(false);
    }, 1000);
  };

  // Format test summary
  const getTestSummary = () => {
    const summary = {
      testDate: formData.testDate ? new Date(formData.testDate).toLocaleDateString() : 'Not specified',
      tester: formData.testerId || 'Not specified',
      methodology: formData.methodology || 'Not specified',
      result: formData.result || 'Not specified',
      riskLevel: formData.riskLevel || 'Not assessed',
      proceduresCompleted: formData.procedures?.filter((p: any) => p.completed).length || 0,
      totalProcedures: formData.procedures?.length || 0,
      evidenceCount: formData.evidence?.files?.length || 0,
    };
    return summary;
  };

  const summary = getTestSummary();
  const resultColor = 
    formData.result === 'PASS' ? 'text-green-600' :
    formData.result === 'FAIL' ? 'text-red-600' :
    formData.result === 'PARTIAL' ? 'text-yellow-600' :
    'text-gray-600';

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Test Summary Review */}
      <div className="bg-white shadow-sm rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-base font-semibold text-gray-900 flex items-center">
            <DocumentCheckIcon className="h-5 w-5 mr-2 text-gray-400" />
            Test Summary Review
          </h3>
        </div>
        <div className="px-6 py-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <dl className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-gray-500">Test Date</dt>
                <dd className="mt-1 text-sm text-gray-900">{summary.testDate}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Tester</dt>
                <dd className="mt-1 text-sm text-gray-900">{summary.tester}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Methodology</dt>
                <dd className="mt-1 text-sm text-gray-900">{summary.methodology}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Test Result</dt>
                <dd className={`mt-1 text-sm font-semibold ${resultColor}`}>
                  {summary.result}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Risk Level</dt>
                <dd className="mt-1 text-sm text-gray-900">{summary.riskLevel}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Procedures Completed</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {summary.proceduresCompleted} of {summary.totalProcedures}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Evidence Collected</dt>
                <dd className="mt-1 text-sm text-gray-900">{summary.evidenceCount} files</dd>
              </div>
            </dl>

            {/* Key Findings Summary */}
            {formData.findings && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <dt className="text-sm font-medium text-gray-500 mb-2">Key Findings</dt>
                <dd className="text-sm text-gray-700 line-clamp-3">
                  {formData.findings}
                </dd>
              </div>
            )}

            {/* Remediation Required */}
            {formData.remediationRequired && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded">
                <div className="flex">
                  <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-red-800">Remediation Required</p>
                    <p className="text-sm text-red-700 mt-1">
                      {formData.remediationPlan || 'Remediation plan to be developed'}
                    </p>
                    {formData.remediationDeadline && (
                      <p className="text-xs text-red-600 mt-1">
                        Target Date: {new Date(formData.remediationDeadline).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Reviewer Section */}
      <div className="bg-white shadow-sm rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-base font-semibold text-gray-900 flex items-center">
            <UserIcon className="h-5 w-5 mr-2 text-gray-400" />
            Reviewer Information (Optional)
          </h3>
        </div>
        <div className="px-6 py-4 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="reviewerId" className="block text-sm font-medium text-gray-700">
                Reviewer
              </label>
              <select
                {...register('reviewerId')}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
              >
                <option value="">Select reviewer (optional)</option>
                <option value="manager1">Sarah Johnson - Compliance Manager</option>
                <option value="manager2">Michael Chen - Audit Director</option>
                <option value="manager3">Emily Davis - Risk Manager</option>
              </select>
            </div>
            <div>
              <label htmlFor="signOffDate" className="block text-sm font-medium text-gray-700">
                Sign-off Date
              </label>
              <div className="mt-1 relative">
                <input
                  type="date"
                  {...register('signOffDate')}
                  defaultValue={new Date().toISOString().split('T')[0]}
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                />
                <CalendarIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="reviewerComments" className="block text-sm font-medium text-gray-700">
              Reviewer Comments
            </label>
            <textarea
              {...register('reviewerComments')}
              rows={3}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
              placeholder="Additional comments or observations from the reviewer..."
            />
          </div>
        </div>
      </div>

      {/* Digital Signature */}
      <div className="bg-white shadow-sm rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-base font-semibold text-gray-900 flex items-center">
            <PencilSquareIcon className="h-5 w-5 mr-2 text-gray-400" />
            Digital Signature <span className="text-red-500 ml-1">*</span>
          </h3>
        </div>
        <div className="px-6 py-4 space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex">
              <ShieldCheckIcon className="h-5 w-5 text-blue-400 mt-0.5" />
              <div className="ml-3">
                <h4 className="text-sm font-medium text-blue-800">Attestation Statement</h4>
                <p className="mt-1 text-sm text-blue-700">
                  By providing your digital signature below, you attest that:
                </p>
                <ul className="mt-2 text-sm text-blue-600 list-disc list-inside space-y-1">
                  <li>All test procedures were performed as documented</li>
                  <li>Evidence collected accurately represents the testing performed</li>
                  <li>Findings and conclusions are based on objective test results</li>
                  <li>Any exceptions or limitations have been properly disclosed</li>
                </ul>
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="digitalSignature" className="block text-sm font-medium text-gray-700">
              Your Full Name (Digital Signature) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              {...register('digitalSignature')}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
              placeholder="Type your full legal name to sign"
            />
            {errors.digitalSignature && (
              <p className="mt-1 text-sm text-red-600">{errors.digitalSignature.message}</p>
            )}
          </div>

          <div className="flex items-start">
            <input
              type="checkbox"
              {...register('confirmAccuracy')}
              className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
            />
            <label htmlFor="confirmAccuracy" className="ml-2 text-sm text-gray-700">
              I confirm that the test results and findings documented in this report are accurate, 
              complete, and represent a true and fair assessment of the control's effectiveness.
              <span className="text-red-500 ml-1">*</span>
            </label>
          </div>
          {errors.confirmAccuracy && (
            <p className="mt-1 text-sm text-red-600 ml-6">{errors.confirmAccuracy.message}</p>
          )}
        </div>
      </div>

      {/* Final Actions */}
      <div className="bg-gray-50 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-medium text-gray-900">Ready to Submit?</h4>
            <p className="text-sm text-gray-500 mt-1">
              Review all information carefully. This test will be marked as complete upon submission.
            </p>
          </div>
          <button
            type="submit"
            disabled={!confirmAccuracy || isSubmitting || isReviewing}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting || isReviewing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Submitting...
              </>
            ) : (
              <>
                <CheckCircleIcon className="h-5 w-5 mr-2" />
                Complete Test
              </>
            )}
          </button>
        </div>
      </div>

      {/* Warning Message */}
      {!confirmAccuracy && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex">
            <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400 mt-0.5" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">Action Required</h3>
              <p className="mt-1 text-sm text-yellow-700">
                Please provide your digital signature and confirm the accuracy of the test results before submitting.
              </p>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}