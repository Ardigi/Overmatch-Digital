'use client';

import {
  CheckCircleIcon,
  ClockIcon,
  EllipsisVerticalIcon,
  KeyIcon,
  PencilIcon,
  ShieldCheckIcon,
  TrashIcon,
  UserPlusIcon,
  UsersIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import { useSession } from 'next-auth/react';
import { useState } from 'react';
import {
  type User,
  useDeleteUser,
  useDisableMfa,
  useEnableMfa,
  useResetPassword,
  useUpdateUser,
  useUsers,
} from '@/lib/api/users';

const getRoleBadgeColor = (role: string) => {
  switch (role.toLowerCase()) {
    case 'admin':
    case 'administrator':
      return 'bg-purple-100 text-purple-800';
    case 'auditor':
      return 'bg-blue-100 text-blue-800';
    case 'user':
      return 'bg-green-100 text-green-800';
    case 'viewer':
    case 'readonly':
      return 'bg-gray-100 text-gray-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'active':
      return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
    case 'inactive':
      return <XCircleIcon className="h-5 w-5 text-red-500" />;
    case 'pending':
      return <ClockIcon className="h-5 w-5 text-yellow-500" />;
    default:
      return null;
  }
};

export default function UsersPage() {
  const { data: session } = useSession();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showDropdown, setShowDropdown] = useState<string | null>(null);

  // Get organizationId from session
  const organizationId = session?.user?.organizationId || '';

  // Fetch users data
  const { data: users = [], isLoading, error } = useUsers(organizationId);
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();
  const enableMfa = useEnableMfa();
  const disableMfa = useDisableMfa();
  const resetPassword = useResetPassword();

  const handleStatusToggle = async (user: User) => {
    const newStatus = user.status === 'active' ? 'inactive' : 'active';
    await updateUser.mutateAsync({
      id: user.id,
      data: { status: newStatus },
    });
  };

  const handleMfaToggle = async (user: User) => {
    if (user.mfaEnabled) {
      await disableMfa.mutateAsync(user.id);
    } else {
      const result = await enableMfa.mutateAsync(user.id);
      // Handle QR code display for user to scan
      console.log('MFA QR Code:', result.qrCode);
    }
  };

  const handleResetPassword = async (userId: string) => {
    await resetPassword.mutateAsync(userId);
    // Show success message
  };

  const handleDeleteUser = async (userId: string) => {
    if (confirm('Are you sure you want to delete this user?')) {
      await deleteUser.mutateAsync(userId);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">Failed to load users. Please try again.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="mt-1 text-sm text-gray-600">Manage users, roles, and permissions</p>
        </div>
        <button className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700">
          <UserPlusIcon className="h-5 w-5 mr-2" />
          Add User
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-blue-100 rounded-md p-3">
              <UsersIcon className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-5">
              <p className="text-sm font-medium text-gray-500">Total Users</p>
              <p className="text-2xl font-semibold text-gray-900">{users.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-green-100 rounded-md p-3">
              <CheckCircleIcon className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-5">
              <p className="text-sm font-medium text-gray-500">Active Users</p>
              <p className="text-2xl font-semibold text-gray-900">
                {users.filter((u) => u.status === 'active').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-purple-100 rounded-md p-3">
              <ShieldCheckIcon className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-5">
              <p className="text-sm font-medium text-gray-500">MFA Enabled</p>
              <p className="text-2xl font-semibold text-gray-900">
                {users.filter((u) => u.mfaEnabled).length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-yellow-100 rounded-md p-3">
              <ClockIcon className="h-6 w-6 text-yellow-600" />
            </div>
            <div className="ml-5">
              <p className="text-sm font-medium text-gray-500">Pending</p>
              <p className="text-2xl font-semibold text-gray-900">
                {users.filter((u) => u.status === 'pending').length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white shadow rounded-lg">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Department
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Login
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  MFA
                </th>
                <th className="relative px-6 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {user.firstName} {user.lastName}
                      </div>
                      <div className="text-sm text-gray-500">{user.email}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRoleBadgeColor(user.role)}`}
                    >
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {user.department || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {getStatusIcon(user.status)}
                      <span className="ml-2 text-sm text-gray-900 capitalize">{user.status}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {user.lastLogin
                      ? format(new Date(user.lastLogin), 'MMM d, yyyy HH:mm')
                      : 'Never'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {user.mfaEnabled ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Enabled
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        Disabled
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="relative">
                      <button
                        onClick={() => setShowDropdown(showDropdown === user.id ? null : user.id)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <EllipsisVerticalIcon className="h-5 w-5" />
                      </button>

                      {showDropdown === user.id && (
                        <div className="absolute right-0 z-10 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5">
                          <div className="py-1">
                            <button
                              onClick={() => {
                                setSelectedUser(user);
                                setShowDropdown(null);
                              }}
                              className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
                            >
                              <PencilIcon className="h-4 w-4 mr-2" />
                              Edit User
                            </button>

                            <button
                              onClick={() => {
                                handleStatusToggle(user);
                                setShowDropdown(null);
                              }}
                              className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
                            >
                              {user.status === 'active' ? (
                                <>
                                  <XCircleIcon className="h-4 w-4 mr-2" />
                                  Deactivate
                                </>
                              ) : (
                                <>
                                  <CheckCircleIcon className="h-4 w-4 mr-2" />
                                  Activate
                                </>
                              )}
                            </button>

                            <button
                              onClick={() => {
                                handleMfaToggle(user);
                                setShowDropdown(null);
                              }}
                              className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
                            >
                              <ShieldCheckIcon className="h-4 w-4 mr-2" />
                              {user.mfaEnabled ? 'Disable MFA' : 'Enable MFA'}
                            </button>

                            <button
                              onClick={() => {
                                handleResetPassword(user.id);
                                setShowDropdown(null);
                              }}
                              className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
                            >
                              <KeyIcon className="h-4 w-4 mr-2" />
                              Reset Password
                            </button>

                            <hr className="my-1" />

                            <button
                              onClick={() => {
                                handleDeleteUser(user.id);
                                setShowDropdown(null);
                              }}
                              className="flex items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50 w-full text-left"
                            >
                              <TrashIcon className="h-4 w-4 mr-2" />
                              Delete User
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
