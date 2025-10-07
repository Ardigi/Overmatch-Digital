'use client';

import { Fragment, useState } from 'react';
import { Dialog, Transition, Combobox } from '@headlessui/react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { XMarkIcon, CheckIcon, ChevronUpDownIcon } from '@heroicons/react/24/outline';
import { useCreateControl } from '@/hooks/api/useControls';
import toast from 'react-hot-toast';

// Validation schema
const createControlSchema = z.object({
  code: z.string().min(1, 'Control code is required').max(20, 'Code must be less than 20 characters'),
  name: z.string().min(1, 'Control name is required').max(200, 'Name must be less than 200 characters'),
  description: z.string().min(1, 'Description is required'),
  category: z.enum(['ACCESS_CONTROL', 'CHANGE_MANAGEMENT', 'DATA_PROTECTION', 'INCIDENT_RESPONSE', 'RISK_ASSESSMENT', 'SYSTEM_OPERATIONS', 'VENDOR_MANAGEMENT']),
  type: z.enum(['PREVENTIVE', 'DETECTIVE', 'CORRECTIVE']),
  frequency: z.enum(['CONTINUOUS', 'DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUALLY', 'AS_NEEDED']),
  frameworks: z.array(z.string()).min(1, 'At least one framework is required'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  ownerId: z.string().optional(),
  notes: z.string().optional(),
});

type CreateControlFormData = z.infer<typeof createControlSchema>;

const FRAMEWORKS = [
  { id: 'SOC2_SECURITY', name: 'SOC 2 - Security' },
  { id: 'SOC2_AVAILABILITY', name: 'SOC 2 - Availability' },
  { id: 'SOC2_CONFIDENTIALITY', name: 'SOC 2 - Confidentiality' },
  { id: 'SOC2_PROCESSING_INTEGRITY', name: 'SOC 2 - Processing Integrity' },
  { id: 'SOC2_PRIVACY', name: 'SOC 2 - Privacy' },
  { id: 'ISO27001', name: 'ISO 27001' },
  { id: 'NIST', name: 'NIST Cybersecurity Framework' },
  { id: 'HIPAA', name: 'HIPAA' },
  { id: 'PCI_DSS', name: 'PCI DSS' },
  { id: 'GDPR', name: 'GDPR' },
];

const CATEGORIES = [
  { value: 'ACCESS_CONTROL', label: 'Access Control' },
  { value: 'CHANGE_MANAGEMENT', label: 'Change Management' },
  { value: 'DATA_PROTECTION', label: 'Data Protection' },
  { value: 'INCIDENT_RESPONSE', label: 'Incident Response' },
  { value: 'RISK_ASSESSMENT', label: 'Risk Assessment' },
  { value: 'SYSTEM_OPERATIONS', label: 'System Operations' },
  { value: 'VENDOR_MANAGEMENT', label: 'Vendor Management' },
];

const CONTROL_TYPES = [
  { value: 'PREVENTIVE', label: 'Preventive', description: 'Prevents incidents from occurring' },
  { value: 'DETECTIVE', label: 'Detective', description: 'Detects when incidents occur' },
  { value: 'CORRECTIVE', label: 'Corrective', description: 'Corrects issues after detection' },
];

const FREQUENCIES = [
  { value: 'CONTINUOUS', label: 'Continuous' },
  { value: 'DAILY', label: 'Daily' },
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'QUARTERLY', label: 'Quarterly' },
  { value: 'ANNUALLY', label: 'Annually' },
  { value: 'AS_NEEDED', label: 'As Needed' },
];

interface CreateControlModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function CreateControlModal({ isOpen, onClose, onSuccess }: CreateControlModalProps) {
  const [selectedFrameworks, setSelectedFrameworks] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  
  const { mutate: createControl, loading } = useCreateControl({
    onSuccess: () => {
      toast.success('Control created successfully');
      onSuccess?.();
      onClose();
      reset();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create control');
    },
  });

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateControlFormData>({
    resolver: zodResolver(createControlSchema),
    defaultValues: {
      frameworks: [],
      priority: 'MEDIUM',
    },
  });

  const category = watch('category');

  // Auto-generate control code based on category
  const generateControlCode = (category: string) => {
    const prefix = category.substring(0, 2).toUpperCase();
    const timestamp = Date.now().toString().slice(-4);
    return `${prefix}-${timestamp}`;
  };

  const onSubmit = (data: CreateControlFormData) => {
    // Transform frameworks array to match backend format
    const transformedData = {
      ...data,
      framework: data.frameworks[0], // Primary framework
      frameworks: data.frameworks.map(f => ({ name: f })),
    };
    
    createControl(transformedData as any);
  };

  const filteredFrameworks = query === ''
    ? FRAMEWORKS
    : FRAMEWORKS.filter((framework) =>
        framework.name.toLowerCase().includes(query.toLowerCase())
      );

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
                <form onSubmit={handleSubmit(onSubmit)}>
                  <div className="bg-white px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
                    <div className="sm:flex sm:items-start">
                      <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left w-full">
                        <Dialog.Title as="h3" className="text-lg font-semibold leading-6 text-gray-900">
                          Create New Control
                        </Dialog.Title>
                        
                        <div className="mt-6 space-y-4">
                          {/* Control Code and Category */}
                          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div>
                              <label htmlFor="code" className="block text-sm font-medium text-gray-700">
                                Control Code
                              </label>
                              <div className="mt-1 flex rounded-md shadow-sm">
                                <input
                                  type="text"
                                  {...register('code')}
                                  className="flex-1 block w-full rounded-md border-gray-300 focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                                  placeholder="e.g., AC-001"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (category) {
                                      setValue('code', generateControlCode(category));
                                    }
                                  }}
                                  className="ml-2 inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                                >
                                  Generate
                                </button>
                              </div>
                              {errors.code && (
                                <p className="mt-1 text-sm text-red-600">{errors.code.message}</p>
                              )}
                            </div>

                            <div>
                              <label htmlFor="category" className="block text-sm font-medium text-gray-700">
                                Category
                              </label>
                              <select
                                {...register('category')}
                                className="mt-1 block w-full rounded-md border-gray-300 focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                              >
                                <option value="">Select a category</option>
                                {CATEGORIES.map((cat) => (
                                  <option key={cat.value} value={cat.value}>
                                    {cat.label}
                                  </option>
                                ))}
                              </select>
                              {errors.category && (
                                <p className="mt-1 text-sm text-red-600">{errors.category.message}</p>
                              )}
                            </div>
                          </div>

                          {/* Control Name */}
                          <div>
                            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                              Control Name
                            </label>
                            <input
                              type="text"
                              {...register('name')}
                              className="mt-1 block w-full rounded-md border-gray-300 focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                              placeholder="e.g., User Access Management"
                            />
                            {errors.name && (
                              <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
                            )}
                          </div>

                          {/* Description */}
                          <div>
                            <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                              Description
                            </label>
                            <textarea
                              {...register('description')}
                              rows={3}
                              className="mt-1 block w-full rounded-md border-gray-300 focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                              placeholder="Describe the control's purpose and implementation requirements"
                            />
                            {errors.description && (
                              <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
                            )}
                          </div>

                          {/* Type and Frequency */}
                          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div>
                              <label htmlFor="type" className="block text-sm font-medium text-gray-700">
                                Control Type
                              </label>
                              <select
                                {...register('type')}
                                className="mt-1 block w-full rounded-md border-gray-300 focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                              >
                                <option value="">Select type</option>
                                {CONTROL_TYPES.map((type) => (
                                  <option key={type.value} value={type.value} title={type.description}>
                                    {type.label}
                                  </option>
                                ))}
                              </select>
                              {errors.type && (
                                <p className="mt-1 text-sm text-red-600">{errors.type.message}</p>
                              )}
                            </div>

                            <div>
                              <label htmlFor="frequency" className="block text-sm font-medium text-gray-700">
                                Testing Frequency
                              </label>
                              <select
                                {...register('frequency')}
                                className="mt-1 block w-full rounded-md border-gray-300 focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                              >
                                <option value="">Select frequency</option>
                                {FREQUENCIES.map((freq) => (
                                  <option key={freq.value} value={freq.value}>
                                    {freq.label}
                                  </option>
                                ))}
                              </select>
                              {errors.frequency && (
                                <p className="mt-1 text-sm text-red-600">{errors.frequency.message}</p>
                              )}
                            </div>
                          </div>

                          {/* Frameworks Multi-Select */}
                          <div>
                            <Controller
                              control={control}
                              name="frameworks"
                              render={({ field }) => (
                                <Combobox
                                  value={field.value}
                                  onChange={(value) => field.onChange(value)}
                                  multiple
                                >
                                  <Combobox.Label className="block text-sm font-medium text-gray-700">
                                    Applicable Frameworks
                                  </Combobox.Label>
                                  <div className="relative mt-1">
                                    <div className="relative w-full cursor-default overflow-hidden rounded-md border border-gray-300 bg-white text-left shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 sm:text-sm">
                                      <Combobox.Input
                                        className="w-full border-none py-2 pl-3 pr-10 text-sm leading-5 text-gray-900 focus:ring-0"
                                        onChange={(event) => setQuery(event.target.value)}
                                        placeholder="Select frameworks..."
                                      />
                                      <Combobox.Button className="absolute inset-y-0 right-0 flex items-center pr-2">
                                        <ChevronUpDownIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
                                      </Combobox.Button>
                                    </div>
                                    <Transition
                                      as={Fragment}
                                      leave="transition ease-in duration-100"
                                      leaveFrom="opacity-100"
                                      leaveTo="opacity-0"
                                      afterLeave={() => setQuery('')}
                                    >
                                      <Combobox.Options className="absolute mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm z-10">
                                        {filteredFrameworks.length === 0 && query !== '' ? (
                                          <div className="relative cursor-default select-none py-2 px-4 text-gray-700">
                                            Nothing found.
                                          </div>
                                        ) : (
                                          filteredFrameworks.map((framework) => (
                                            <Combobox.Option
                                              key={framework.id}
                                              className={({ active }) =>
                                                `relative cursor-default select-none py-2 pl-10 pr-4 ${
                                                  active ? 'bg-primary-600 text-white' : 'text-gray-900'
                                                }`
                                              }
                                              value={framework.id}
                                            >
                                              {({ selected, active }) => (
                                                <>
                                                  <span className={`block truncate ${selected ? 'font-medium' : 'font-normal'}`}>
                                                    {framework.name}
                                                  </span>
                                                  {selected ? (
                                                    <span
                                                      className={`absolute inset-y-0 left-0 flex items-center pl-3 ${
                                                        active ? 'text-white' : 'text-primary-600'
                                                      }`}
                                                    >
                                                      <CheckIcon className="h-5 w-5" aria-hidden="true" />
                                                    </span>
                                                  ) : null}
                                                </>
                                              )}
                                            </Combobox.Option>
                                          ))
                                        )}
                                      </Combobox.Options>
                                    </Transition>
                                  </div>
                                  {field.value && field.value.length > 0 && (
                                    <div className="mt-2 flex flex-wrap gap-2">
                                      {field.value.map((frameworkId) => {
                                        const framework = FRAMEWORKS.find(f => f.id === frameworkId);
                                        return framework ? (
                                          <span
                                            key={frameworkId}
                                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800"
                                          >
                                            {framework.name}
                                            <button
                                              type="button"
                                              onClick={() => {
                                                field.onChange(field.value.filter(f => f !== frameworkId));
                                              }}
                                              className="ml-1 inline-flex items-center justify-center text-primary-400 hover:text-primary-600"
                                            >
                                              <XMarkIcon className="h-3 w-3" />
                                            </button>
                                          </span>
                                        ) : null;
                                      })}
                                    </div>
                                  )}
                                </Combobox>
                              )}
                            />
                            {errors.frameworks && (
                              <p className="mt-1 text-sm text-red-600">{errors.frameworks.message}</p>
                            )}
                          </div>

                          {/* Priority and Notes */}
                          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div>
                              <label htmlFor="priority" className="block text-sm font-medium text-gray-700">
                                Priority
                              </label>
                              <select
                                {...register('priority')}
                                className="mt-1 block w-full rounded-md border-gray-300 focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                              >
                                <option value="LOW">Low</option>
                                <option value="MEDIUM">Medium</option>
                                <option value="HIGH">High</option>
                                <option value="CRITICAL">Critical</option>
                              </select>
                            </div>

                            <div>
                              <label htmlFor="ownerId" className="block text-sm font-medium text-gray-700">
                                Owner ID (Optional)
                              </label>
                              <input
                                type="text"
                                {...register('ownerId')}
                                className="mt-1 block w-full rounded-md border-gray-300 focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                                placeholder="User ID of control owner"
                              />
                            </div>
                          </div>

                          {/* Notes */}
                          <div>
                            <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
                              Additional Notes (Optional)
                            </label>
                            <textarea
                              {...register('notes')}
                              rows={2}
                              className="mt-1 block w-full rounded-md border-gray-300 focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                              placeholder="Any additional implementation notes or requirements"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
                    <button
                      type="submit"
                      disabled={loading}
                      className="inline-flex w-full justify-center rounded-md bg-primary-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-500 disabled:opacity-50 disabled:cursor-not-allowed sm:ml-3 sm:w-auto"
                    >
                      {loading ? 'Creating...' : 'Create Control'}
                    </button>
                    <button
                      type="button"
                      onClick={onClose}
                      disabled={loading}
                      className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed sm:mt-0 sm:w-auto"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
}