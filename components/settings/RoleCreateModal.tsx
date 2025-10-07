'use client';

import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { zodResolver } from '@hookform/resolvers/zod';
import { Fragment, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { LoadingButton } from '@/components/ui/LoadingSpinner';
import { useCreateRole, usePermissions } from '@/hooks/api/useUsers';

interface RoleCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const roleSchema = z.object({
  name: z.string().min(1, 'Role name is required'),
  description: z.string().min(1, 'Description is required'),
  permissions: z.array(z.string()).min(1, 'At least one permission is required'),
});

type RoleFormData = z.infer<typeof roleSchema>;

export default function RoleCreateModal({ isOpen, onClose, onSuccess }: RoleCreateModalProps) {
  const { data: permissions = [] } = usePermissions();
  const createRole = useCreateRole();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<RoleFormData>({
    resolver: zodResolver(roleSchema),
    defaultValues: {
      permissions: [],
    },
  });

  const selectedPermissions = watch('permissions');

  const onSubmit = async (data: RoleFormData) => {
    try {
      setError(null);
      await createRole.mutate(data);
      reset();
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create role');
    }
  };

  const togglePermission = (permissionId: string) => {
    const current = selectedPermissions || [];
    if (current.includes(permissionId)) {
      setValue(
        'permissions',
        current.filter((id) => id !== permissionId)
      );
    } else {
      setValue('permissions', [...current, permissionId]);
    }
  };

  // Group permissions by resource
  const permissionsByResource = permissions.reduce(
    (acc, permission) => {
      const resource = permission.resource;
      if (!acc[resource]) {
        acc[resource] = [];
      }
      acc[resource].push(permission);
      return acc;
    },
    {} as Record<string, typeof permissions>
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
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
                <div className="absolute right-0 top-0 pr-4 pt-4">
                  <button
                    type="button"
                    className="rounded-md bg-white text-gray-400 hover:text-gray-500"
                    onClick={onClose}
                  >
                    <span className="sr-only">Close</span>
                    <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                  </button>
                </div>
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                    <Dialog.Title as="h3" className="text-lg font-semibold leading-6 text-gray-900">
                      Create New Role
                    </Dialog.Title>
                    <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-4">
                      {error && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                          {error}
                        </div>
                      )}

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Role Name
                        </label>
                        <input
                          {...register('name')}
                          type="text"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                          placeholder="e.g., Project Manager"
                        />
                        {errors.name && (
                          <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Description
                        </label>
                        <textarea
                          {...register('description')}
                          rows={2}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                          placeholder="Brief description of this role's responsibilities"
                        />
                        {errors.description && (
                          <p className="mt-1 text-xs text-red-600">{errors.description.message}</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Permissions
                        </label>
                        <div className="space-y-3 max-h-60 overflow-y-auto border border-gray-200 rounded-lg p-3">
                          {Object.entries(permissionsByResource).map(([resource, perms]) => (
                            <div key={resource}>
                              <h4 className="text-sm font-medium text-gray-900 mb-2 capitalize">
                                {resource.replace('_', ' ')}
                              </h4>
                              <div className="space-y-1 pl-4">
                                {perms.map((permission) => (
                                  <label
                                    key={permission.id}
                                    className="flex items-start gap-3 p-1 hover:bg-gray-50 rounded cursor-pointer"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={
                                        selectedPermissions?.includes(permission.id) || false
                                      }
                                      onChange={() => togglePermission(permission.id)}
                                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded mt-0.5"
                                    />
                                    <div className="flex-1">
                                      <p className="text-sm text-gray-900">
                                        {permission.description ||
                                          `${permission.action} ${permission.resource}`}
                                      </p>
                                    </div>
                                  </label>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                        {errors.permissions && (
                          <p className="mt-1 text-xs text-red-600">{errors.permissions.message}</p>
                        )}
                      </div>
                    </form>
                  </div>
                </div>
                <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                  <LoadingButton
                    type="button"
                    onClick={handleSubmit(onSubmit)}
                    loading={createRole.loading}
                    className="inline-flex w-full justify-center rounded-md bg-primary-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-500 sm:ml-3 sm:w-auto"
                  >
                    Create Role
                  </LoadingButton>
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
