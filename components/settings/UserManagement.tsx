'use client';

import {
  CalendarIcon,
  CheckCircleIcon,
  EnvelopeIcon,
  ExclamationTriangleIcon,
  KeyIcon,
  PencilIcon,
  PlusIcon,
  ShieldCheckIcon,
  TrashIcon,
  UserCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import { useMemo, useState } from 'react';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useToast } from '@/contexts/ToastContext';
import {
  Role,
  type User,
  useDeleteUser,
  useDisableUserMfa,
  useReactivateUser,
  useResendInvite,
  useResetUserPassword,
  useRoles,
  useSuspendUser,
  useUsers,
} from '@/hooks/api/useUsers';
import RoleCreateModal from './RoleCreateModal';
import UserCreateModal from './UserCreateModal';

export default function UserManagement() {
  const [activeTab, setActiveTab] = useState('users');
  const [searchTerm, setSearchTerm] = useState('');
  const [showNewUser, setShowNewUser] = useState(false);
  const [showNewRole, setShowNewRole] = useState(false);
  const { showSuccess, showError } = useToast();

  // API hooks
  const {
    data: usersData,
    loading: usersLoading,
    execute: refreshUsers,
  } = useUsers({
    search: searchTerm,
    page: 1,
    pageSize: 50,
  });

  const { data: rolesData, loading: rolesLoading, execute: refreshRoles } = useRoles();
  const deleteUser = useDeleteUser();
  const suspendUser = useSuspendUser();
  const reactivateUser = useReactivateUser();
  const resendInvite = useResendInvite();
  const resetPassword = useResetUserPassword();
  const disableMfa = useDisableUserMfa();

  const users = usersData?.data || [];
  const roles = rolesData || [];

  const permissionLabels: Record<string, string> = {
    'users.manage': 'User Management',
    'projects.manage': 'Project Management',
    'projects.edit': 'Project Editing',
    'projects.view': 'Project Viewing',
    'settings.manage': 'Settings Management',
    'reports.view': 'Report Viewing',
    'billing.manage': 'Billing Management',
    'evidence.manage': 'Evidence Management',
    'controls.edit': 'Control Editing',
    'team.manage': 'Team Management',
    'analytics.view': 'Analytics Viewing',
  };

  const getStatusColor = (status: User['status']) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'inactive':
        return 'bg-gray-100 text-gray-800';
      case 'invited':
        return 'bg-yellow-100 text-yellow-800';
      case 'suspended':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      try {
        await deleteUser.mutate(userId);
        showSuccess('User deleted', 'The user has been successfully deleted.');
        refreshUsers();
      } catch (error) {
        showError('Delete failed', 'Failed to delete the user. Please try again.');
      }
    }
  };

  const handleSuspendUser = async (userId: string) => {
    const reason = prompt('Please provide a reason for suspending this user:');
    if (reason) {
      try {
        await suspendUser.mutate({ id: userId, reason });
        showSuccess('User suspended', 'The user has been suspended.');
        refreshUsers();
      } catch (error) {
        showError('Suspend failed', 'Failed to suspend the user. Please try again.');
      }
    }
  };

  const handleReactivateUser = async (userId: string) => {
    try {
      await reactivateUser.mutate(userId);
      showSuccess('User reactivated', 'The user has been reactivated.');
      refreshUsers();
    } catch (error) {
      showError('Reactivation failed', 'Failed to reactivate the user. Please try again.');
    }
  };

  const handleResetPassword = async (userId: string) => {
    if (confirm('Send a password reset email to this user?')) {
      try {
        await resetPassword.mutate(userId);
        showSuccess('Password reset sent', 'A password reset email has been sent to the user.');
      } catch (error) {
        showError('Reset failed', 'Failed to send password reset. Please try again.');
      }
    }
  };

  const handleDisableMfa = async (userId: string) => {
    if (confirm('Disable MFA for this user? They will need to set it up again.')) {
      try {
        await disableMfa.mutate(userId);
        showSuccess('MFA disabled', 'MFA has been disabled for this user.');
        refreshUsers();
      } catch (error) {
        showError('MFA disable failed', 'Failed to disable MFA. Please try again.');
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h3 className="text-lg font-semibold text-gray-900">User & Role Management</h3>
              <div className="flex rounded-lg shadow-sm">
                <button
                  onClick={() => setActiveTab('users')}
                  className={`px-4 py-2 text-sm font-medium rounded-l-lg ${
                    activeTab === 'users'
                      ? 'bg-primary-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Users
                </button>
                <button
                  onClick={() => setActiveTab('roles')}
                  className={`px-4 py-2 text-sm font-medium rounded-r-lg border-l ${
                    activeTab === 'roles'
                      ? 'bg-primary-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Roles
                </button>
              </div>
            </div>
            <button
              onClick={() => (activeTab === 'users' ? setShowNewUser(true) : setShowNewRole(true))}
              className="btn-primary flex items-center gap-2"
            >
              <PlusIcon className="h-5 w-5" />
              Add {activeTab === 'users' ? 'User' : 'Role'}
            </button>
          </div>
        </div>

        {activeTab === 'users' && (
          <div>
            <div className="px-6 py-4 border-b border-gray-200">
              <input
                type="text"
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            <div className="overflow-x-auto">
              {usersLoading ? (
                <div className="flex justify-center py-8">
                  <LoadingSpinner />
                </div>
              ) : (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        User
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Roles
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Organization
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Security
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Last Login
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {users.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <UserCircleIcon className="h-10 w-10 text-gray-400" />
                            <div className="ml-3">
                              <p className="text-sm font-medium text-gray-900">{user.fullName}</p>
                              <p className="text-sm text-gray-500">{user.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-1">
                            {user.roles.map((role) => (
                              <span
                                key={role.id}
                                className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded"
                              >
                                {role.name}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm text-gray-900">{user.organization?.name || '-'}</p>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(user.status)}`}
                          >
                            {user.status}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {user.mfaEnabled ? (
                              <div className="flex items-center gap-1 text-green-600">
                                <ShieldCheckIcon className="h-4 w-4" />
                                <span className="text-xs">MFA</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 text-gray-400">
                                <XCircleIcon className="h-4 w-4" />
                                <span className="text-xs">No MFA</span>
                              </div>
                            )}
                            {!user.emailVerified && (
                              <div
                                className="flex items-center gap-1 text-yellow-600"
                                title="Email not verified"
                              >
                                <ExclamationTriangleIcon className="h-4 w-4" />
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {user.lastLoginAt ? (
                            <p className="text-sm text-gray-900">
                              {format(new Date(user.lastLoginAt), 'MMM d, h:mm a')}
                            </p>
                          ) : (
                            <p className="text-sm text-gray-500">Never</p>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {user.status === 'invited' && (
                              <button
                                onClick={() => resendInvite.mutate(user.id)}
                                className="text-blue-600 hover:text-blue-800"
                                title="Resend invite"
                              >
                                <EnvelopeIcon className="h-4 w-4" />
                              </button>
                            )}
                            <button
                              onClick={() => handleResetPassword(user.id)}
                              className="text-gray-400 hover:text-gray-600"
                              title="Reset password"
                            >
                              <KeyIcon className="h-4 w-4" />
                            </button>
                            {user.mfaEnabled && (
                              <button
                                onClick={() => handleDisableMfa(user.id)}
                                className="text-gray-400 hover:text-gray-600"
                                title="Disable MFA"
                              >
                                <ShieldCheckIcon className="h-4 w-4" />
                              </button>
                            )}
                            {user.status === 'active' ? (
                              <button
                                onClick={() => handleSuspendUser(user.id)}
                                className="text-yellow-600 hover:text-yellow-800"
                                title="Suspend user"
                              >
                                <XCircleIcon className="h-4 w-4" />
                              </button>
                            ) : (
                              user.status === 'suspended' && (
                                <button
                                  onClick={() => handleReactivateUser(user.id)}
                                  className="text-green-600 hover:text-green-800"
                                  title="Reactivate user"
                                >
                                  <CheckCircleIcon className="h-4 w-4" />
                                </button>
                              )
                            )}
                            <button
                              onClick={() => handleDeleteUser(user.id)}
                              className="text-gray-400 hover:text-red-600"
                              title="Delete user"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {activeTab === 'roles' && (
          <div className="p-6">
            {rolesLoading ? (
              <div className="flex justify-center py-8">
                <LoadingSpinner />
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {roles.map((role) => (
                  <div key={role.id} className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="text-lg font-medium text-gray-900">{role.name}</h4>
                        <p className="text-sm text-gray-600 mt-1">{role.description}</p>
                        <p className="text-sm text-gray-500 mt-1">
                          {role.userCount || 0} users
                          {role.isSystem && (
                            <span className="ml-2 text-xs text-primary-600">(System Role)</span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {!role.isSystem && (
                          <>
                            <button className="text-gray-400 hover:text-gray-600">
                              <PencilIcon className="h-4 w-4" />
                            </button>
                            <button className="text-gray-400 hover:text-red-600">
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {role.permissions.map((permission) => (
                        <span
                          key={permission.id}
                          className="px-2.5 py-0.5 bg-white border border-gray-200 rounded-lg text-xs text-gray-700"
                        >
                          {permission.description || `${permission.resource}.${permission.action}`}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h4 className="font-semibold text-yellow-900 mb-2">Security Best Practices</h4>
        <ul className="text-sm text-yellow-800 space-y-1">
          <li>• Enforce two-factor authentication for all users with admin access</li>
          <li>• Review user permissions quarterly</li>
          <li>• Remove access immediately when employees leave</li>
          <li>• Use role-based access control (RBAC) for least privilege</li>
        </ul>
      </div>

      {/* Modals */}
      {showNewUser && (
        <UserCreateModal
          isOpen={showNewUser}
          onClose={() => setShowNewUser(false)}
          onSuccess={() => {
            refreshUsers();
            showSuccess('User created', 'The new user has been created successfully.');
          }}
        />
      )}

      {showNewRole && (
        <RoleCreateModal
          isOpen={showNewRole}
          onClose={() => setShowNewRole(false)}
          onSuccess={() => {
            refreshRoles();
            showSuccess('Role created', 'The new role has been created successfully.');
          }}
        />
      )}
    </div>
  );
}
