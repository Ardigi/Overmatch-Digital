'use client';

import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { zodResolver } from '@hookform/resolvers/zod';
import { Fragment, useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { z } from 'zod';

const clientSchema = z.object({
  name: z.string().min(2, 'Company name is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(10, 'Valid phone number is required'),
  website: z.string().url('Invalid website URL').optional().or(z.literal('')),
  industry: z.string().min(1, 'Industry is required'),
  auditType: z.enum(['SOC1', 'SOC2', 'Both']),
  contractValue: z.number().min(0, 'Contract value must be positive'),
  contractStartDate: z.string().min(1, 'Start date is required'),
  contractEndDate: z.string().min(1, 'End date is required'),
  primaryContactName: z.string().min(2, 'Contact name is required'),
  primaryContactEmail: z.string().email('Invalid contact email'),
  primaryContactPhone: z.string().min(10, 'Valid contact phone is required'),
  primaryContactTitle: z.string().min(2, 'Contact title is required'),
  trustServicesCriteria: z.array(z.string()).min(1, 'Select at least one criteria'),
  notes: z.string().optional(),
});

type ClientFormData = z.infer<typeof clientSchema>;

interface NewClientModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export default function NewClientModal({ onClose, onSuccess }: NewClientModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = useForm<ClientFormData>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      trustServicesCriteria: [],
    },
  });

  const trustServicesCriteria = watch('trustServicesCriteria') || [];

  const toggleCriteria = (criteria: string) => {
    const current = trustServicesCriteria || [];
    if (current.includes(criteria)) {
      setValue(
        'trustServicesCriteria',
        current.filter((c) => c !== criteria)
      );
    } else {
      setValue('trustServicesCriteria', [...current, criteria]);
    }
  };

  const onSubmit = async (data: ClientFormData) => {
    setIsSubmitting(true);
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      toast.success('Client created successfully');
      onSuccess();
    } catch (error) {
      toast.error('Failed to create client');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Transition appear show as={Fragment}>
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
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                <div className="flex items-center justify-between mb-6">
                  <Dialog.Title as="h3" className="text-xl font-bold text-gray-900">
                    Add New Client
                  </Dialog.Title>
                  <button
                    onClick={onClose}
                    className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Company Name *
                      </label>
                      <input
                        type="text"
                        {...register('name')}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      />
                      {errors.name && (
                        <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Industry *
                      </label>
                      <select
                        {...register('industry')}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      >
                        <option value="">Select an industry</option>
                        <option value="Software">Software</option>
                        <option value="Financial Services">Financial Services</option>
                        <option value="Healthcare">Healthcare</option>
                        <option value="Cloud Services">Cloud Services</option>
                        <option value="Payment Processing">Payment Processing</option>
                        <option value="E-commerce">E-commerce</option>
                        <option value="Manufacturing">Manufacturing</option>
                        <option value="Other">Other</option>
                      </select>
                      {errors.industry && (
                        <p className="mt-1 text-sm text-red-600">{errors.industry.message}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Email *
                      </label>
                      <input
                        type="email"
                        {...register('email')}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      />
                      {errors.email && (
                        <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Phone *
                      </label>
                      <input
                        type="tel"
                        {...register('phone')}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      />
                      {errors.phone && (
                        <p className="mt-1 text-sm text-red-600">{errors.phone.message}</p>
                      )}
                    </div>

                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Website
                      </label>
                      <input
                        type="url"
                        {...register('website')}
                        placeholder="https://example.com"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      />
                      {errors.website && (
                        <p className="mt-1 text-sm text-red-600">{errors.website.message}</p>
                      )}
                    </div>
                  </div>

                  <div className="border-t pt-6">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4">Contract Details</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Audit Type *
                        </label>
                        <select
                          {...register('auditType')}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        >
                          <option value="">Select audit type</option>
                          <option value="SOC1">SOC 1</option>
                          <option value="SOC2">SOC 2</option>
                          <option value="Both">Both</option>
                        </select>
                        {errors.auditType && (
                          <p className="mt-1 text-sm text-red-600">{errors.auditType.message}</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Annual Contract Value *
                        </label>
                        <input
                          type="number"
                          {...register('contractValue', { valueAsNumber: true })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        />
                        {errors.contractValue && (
                          <p className="mt-1 text-sm text-red-600">
                            {errors.contractValue.message}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Contract Start Date *
                        </label>
                        <input
                          type="date"
                          {...register('contractStartDate')}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        />
                        {errors.contractStartDate && (
                          <p className="mt-1 text-sm text-red-600">
                            {errors.contractStartDate.message}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Contract End Date *
                        </label>
                        <input
                          type="date"
                          {...register('contractEndDate')}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        />
                        {errors.contractEndDate && (
                          <p className="mt-1 text-sm text-red-600">
                            {errors.contractEndDate.message}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Trust Services Criteria *
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {[
                          'Security',
                          'Availability',
                          'Processing Integrity',
                          'Confidentiality',
                          'Privacy',
                        ].map((criteria) => (
                          <button
                            key={criteria}
                            type="button"
                            onClick={() => toggleCriteria(criteria)}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                              trustServicesCriteria.includes(criteria)
                                ? 'bg-primary-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            {criteria}
                          </button>
                        ))}
                      </div>
                      {errors.trustServicesCriteria && (
                        <p className="mt-1 text-sm text-red-600">
                          {errors.trustServicesCriteria.message}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="border-t pt-6">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4">Primary Contact</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Name *
                        </label>
                        <input
                          type="text"
                          {...register('primaryContactName')}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        />
                        {errors.primaryContactName && (
                          <p className="mt-1 text-sm text-red-600">
                            {errors.primaryContactName.message}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Title *
                        </label>
                        <input
                          type="text"
                          {...register('primaryContactTitle')}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        />
                        {errors.primaryContactTitle && (
                          <p className="mt-1 text-sm text-red-600">
                            {errors.primaryContactTitle.message}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Email *
                        </label>
                        <input
                          type="email"
                          {...register('primaryContactEmail')}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        />
                        {errors.primaryContactEmail && (
                          <p className="mt-1 text-sm text-red-600">
                            {errors.primaryContactEmail.message}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Phone *
                        </label>
                        <input
                          type="tel"
                          {...register('primaryContactPhone')}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        />
                        {errors.primaryContactPhone && (
                          <p className="mt-1 text-sm text-red-600">
                            {errors.primaryContactPhone.message}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                    <textarea
                      {...register('notes')}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="Any additional notes about this client..."
                    />
                  </div>

                  <div className="flex justify-end gap-3 pt-6 border-t">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? (
                        <>
                          <span className="inline-block animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></span>
                          Creating...
                        </>
                      ) : (
                        'Create Client'
                      )}
                    </button>
                  </div>
                </form>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
