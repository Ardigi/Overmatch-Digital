'use client';

import { Dialog, Transition } from '@headlessui/react';
import { ArrowRightIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { Fragment, useState } from 'react';

interface SetupStep {
  id: number;
  title: string;
  description: string;
  completed: boolean;
}

interface Integration {
  id: string;
  name: string;
  description: string;
  category: string;
  logo: string;
  status: 'connected' | 'not_connected' | 'coming_soon';
  features: string[];
  requiredScopes?: string[];
  documentationUrl: string;
  setupTime: string;
}

interface IntegrationSetupModalProps {
  integration: Integration;
  isOpen: boolean;
  onClose: () => void;
}

export default function IntegrationSetupModal({
  integration,
  isOpen,
  onClose,
}: IntegrationSetupModalProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [setupSteps, setSetupSteps] = useState<SetupStep[]>([
    {
      id: 1,
      title: 'Authorize Access',
      description: 'Grant Overmatch Digital permission to access your AWS account',
      completed: false,
    },
    {
      id: 2,
      title: 'Select Resources',
      description: 'Choose which AWS services and regions to monitor',
      completed: false,
    },
    {
      id: 3,
      title: 'Configure Policies',
      description: 'Set up compliance policies and monitoring rules',
      completed: false,
    },
    {
      id: 4,
      title: 'Test Connection',
      description: 'Verify the integration is working correctly',
      completed: false,
    },
  ]);

  const handleNext = () => {
    setSetupSteps((prev) =>
      prev.map((step) => (step.id === currentStep ? { ...step, completed: true } : step))
    );
    if (currentStep < setupSteps.length) {
      setCurrentStep(currentStep + 1);
    } else {
      // Complete setup
      onClose();
    }
  };

  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
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
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-2xl">
                <div className="bg-white px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <Dialog.Title
                        as="h3"
                        className="text-lg font-semibold leading-6 text-gray-900"
                      >
                        Connect {integration.name}
                      </Dialog.Title>
                      <p className="mt-1 text-sm text-gray-500">{integration.description}</p>
                    </div>
                    <button
                      type="button"
                      className="rounded-md bg-white text-gray-400 hover:text-gray-500"
                      onClick={onClose}
                    >
                      <XMarkIcon className="h-6 w-6" />
                    </button>
                  </div>

                  {/* Progress Steps */}
                  <nav aria-label="Progress">
                    <ol className="space-y-4 md:flex md:space-x-8 md:space-y-0 mb-8">
                      {setupSteps.map((step) => (
                        <li key={step.id} className="md:flex-1">
                          <div
                            className={`group flex flex-col border-l-4 py-2 pl-4 md:border-l-0 md:border-t-4 md:pb-0 md:pl-0 md:pt-4 ${
                              step.completed
                                ? 'border-primary-600'
                                : step.id === currentStep
                                  ? 'border-primary-600'
                                  : 'border-gray-200'
                            }`}
                          >
                            <span className="text-sm font-medium">Step {step.id}</span>
                            <span className="text-sm font-medium">{step.title}</span>
                          </div>
                        </li>
                      ))}
                    </ol>
                  </nav>

                  {/* Step Content */}
                  <div className="mb-6">
                    {currentStep === 1 && (
                      <div className="space-y-4">
                        <div className="bg-blue-50 p-4 rounded-lg">
                          <h4 className="text-sm font-medium text-blue-900">
                            Required AWS Permissions
                          </h4>
                          <ul className="mt-2 space-y-1 text-sm text-blue-800">
                            <li>• CloudTrail: Read access to audit logs</li>
                            <li>• IAM: List policies and roles</li>
                            <li>• S3: Read bucket policies and encryption</li>
                            <li>• EC2: Describe instances and security groups</li>
                          </ul>
                        </div>

                        <div className="border border-gray-200 rounded-lg p-4">
                          <label className="block text-sm font-medium text-gray-700">
                            AWS Account ID
                          </label>
                          <input
                            type="text"
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                            placeholder="123456789012"
                          />
                        </div>

                        <div className="border border-gray-200 rounded-lg p-4">
                          <label className="block text-sm font-medium text-gray-700">
                            External ID
                          </label>
                          <input
                            type="text"
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                            value="overmatch-a7b9c2d4"
                            readOnly
                          />
                          <p className="mt-1 text-xs text-gray-500">
                            Use this External ID when creating the IAM role
                          </p>
                        </div>

                        <button className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700">
                          Authorize with AWS
                          <ArrowRightIcon className="ml-2 h-4 w-4" />
                        </button>
                      </div>
                    )}

                    {currentStep === 2 && (
                      <div className="space-y-4">
                        <h4 className="text-sm font-medium text-gray-900">
                          Select AWS Services to Monitor
                        </h4>
                        <div className="space-y-2">
                          {[
                            'CloudTrail - Audit logs',
                            'IAM - Identity and access',
                            'S3 - Storage security',
                            'EC2 - Compute instances',
                            'RDS - Database security',
                            'VPC - Network configuration',
                          ].map((service) => (
                            <label key={service} className="flex items-center">
                              <input
                                type="checkbox"
                                defaultChecked
                                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                              />
                              <span className="ml-2 text-sm text-gray-700">{service}</span>
                            </label>
                          ))}
                        </div>

                        <div className="mt-4">
                          <label className="block text-sm font-medium text-gray-700">
                            AWS Regions
                          </label>
                          <select className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm">
                            <option>All Regions</option>
                            <option>US East (N. Virginia)</option>
                            <option>US West (Oregon)</option>
                            <option>EU (Ireland)</option>
                          </select>
                        </div>
                      </div>
                    )}

                    {currentStep === 3 && (
                      <div className="space-y-4">
                        <h4 className="text-sm font-medium text-gray-900">
                          Configure Compliance Policies
                        </h4>
                        <div className="space-y-3">
                          {[
                            {
                              name: 'MFA Enforcement',
                              description: 'Require MFA for all IAM users',
                              enabled: true,
                            },
                            {
                              name: 'Encryption at Rest',
                              description: 'Ensure all S3 buckets and RDS instances are encrypted',
                              enabled: true,
                            },
                            {
                              name: 'Public Access Prevention',
                              description: 'Alert on publicly accessible resources',
                              enabled: true,
                            },
                            {
                              name: 'Unused Resources',
                              description: 'Identify idle EC2 instances and unattached volumes',
                              enabled: false,
                            },
                          ].map((policy) => (
                            <div
                              key={policy.name}
                              className="flex items-center justify-between p-3 border border-gray-200 rounded-lg"
                            >
                              <div>
                                <p className="text-sm font-medium text-gray-900">{policy.name}</p>
                                <p className="text-xs text-gray-500">{policy.description}</p>
                              </div>
                              <button
                                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                                  policy.enabled ? 'bg-primary-600' : 'bg-gray-200'
                                }`}
                              >
                                <span
                                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                    policy.enabled ? 'translate-x-5' : 'translate-x-0'
                                  }`}
                                />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {currentStep === 4 && (
                      <div className="space-y-4">
                        <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
                          <CheckIcon className="mx-auto h-12 w-12 text-green-600" />
                          <h4 className="mt-2 text-lg font-medium text-green-900">
                            Connection Successful!
                          </h4>
                          <p className="mt-1 text-sm text-green-800">
                            Your AWS account has been connected successfully.
                          </p>
                        </div>

                        <div className="bg-gray-50 rounded-lg p-4">
                          <h5 className="text-sm font-medium text-gray-900 mb-2">
                            Initial Sync Status
                          </h5>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-600">CloudTrail Events</span>
                              <span className="text-sm font-medium text-gray-900">
                                12,543 collected
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-600">IAM Users</span>
                              <span className="text-sm font-medium text-gray-900">
                                47 discovered
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-600">S3 Buckets</span>
                              <span className="text-sm font-medium text-gray-900">
                                23 monitored
                              </span>
                            </div>
                          </div>
                        </div>

                        <p className="text-sm text-gray-600">
                          Overmatch Digital will now continuously monitor your AWS environment for
                          compliance issues. You can view the collected data in the Evidence and
                          Monitoring sections.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
                  <button
                    type="button"
                    onClick={handleNext}
                    className="inline-flex w-full justify-center rounded-md bg-primary-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-500 sm:ml-3 sm:w-auto"
                  >
                    {currentStep === setupSteps.length ? 'Complete Setup' : 'Next Step'}
                  </button>
                  <button
                    type="button"
                    className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto"
                    onClick={onClose}
                  >
                    Cancel
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
}
