import { api } from '@/lib/api/api-client';
import { useApi, useMutation, usePaginatedApi } from '../useApi';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  status: 'active' | 'inactive' | 'invited' | 'suspended';
  emailVerified: boolean;
  mfaEnabled: boolean;
  lastLoginAt?: string;
  organization?: {
    id: string;
    name: string;
    type: string;
  };
  roles: Array<{
    id: string;
    name: string;
  }>;
  permissions: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: Array<{
    id: string;
    resource: string;
    action: string;
    description: string;
  }>;
  isSystem: boolean;
  userCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserData {
  email: string;
  firstName: string;
  lastName: string;
  password?: string;
  roleIds: string[];
  sendInvite?: boolean;
}

export interface UpdateUserData {
  firstName?: string;
  lastName?: string;
  status?: User['status'];
  roleIds?: string[];
}

// Fetch users with pagination
export function useUsers(filters?: any, options?: any) {
  return usePaginatedApi(
    async (params) => {
      const response = await api.get('/users', { params });
      return response.data;
    },
    filters,
    options
  );
}

// Fetch single user
export function useUser(id: string, options?: any) {
  return useApi(
    async () => {
      const response = await api.get(`/users/${id}`);
      return response.data;
    },
    [id],
    { immediate: !!id, ...options }
  );
}

// Create user mutation
export function useCreateUser(options?: any) {
  return useMutation(async (data: CreateUserData) => {
    const response = await api.post('/users', data);
    return response.data;
  }, options);
}

// Update user mutation
export function useUpdateUser(options?: any) {
  return useMutation(async ({ id, data }: { id: string; data: UpdateUserData }) => {
    const response = await api.patch(`/users/${id}`, data);
    return response.data;
  }, options);
}

// Delete user mutation
export function useDeleteUser(options?: any) {
  return useMutation(async (id: string) => {
    await api.delete(`/users/${id}`);
  }, options);
}

// Suspend user mutation
export function useSuspendUser(options?: any) {
  return useMutation(async ({ id, reason }: { id: string; reason: string }) => {
    const response = await api.post(`/users/${id}/suspend`, { reason });
    return response.data;
  }, options);
}

// Reactivate user mutation
export function useReactivateUser(options?: any) {
  return useMutation(async (id: string) => {
    const response = await api.post(`/users/${id}/reactivate`);
    return response.data;
  }, options);
}

// Resend invite mutation
export function useResendInvite(options?: any) {
  return useMutation(async (id: string) => {
    const response = await api.post(`/users/${id}/resend-invite`);
    return response.data;
  }, options);
}

// Reset user password mutation
export function useResetUserPassword(options?: any) {
  return useMutation(async (id: string) => {
    const response = await api.post(`/users/${id}/reset-password`);
    return response.data;
  }, options);
}

// Disable user MFA mutation
export function useDisableUserMfa(options?: any) {
  return useMutation(async (id: string) => {
    const response = await api.post(`/users/${id}/disable-mfa`);
    return response.data;
  }, options);
}

// Fetch roles
export function useRoles(options?: any) {
  return useApi(
    async () => {
      const response = await api.get('/roles');
      return response.data;
    },
    [],
    { immediate: true, ...options }
  );
}

// Create role mutation
export function useCreateRole(options?: any) {
  return useMutation(async (data: { name: string; description: string; permissions: string[] }) => {
    const response = await api.post('/roles', data);
    return response.data;
  }, options);
}

// Update role mutation
export function useUpdateRole(options?: any) {
  return useMutation(
    async ({
      id,
      data,
    }: {
      id: string;
      data: { name?: string; description?: string; permissions?: string[] };
    }) => {
      const response = await api.patch(`/roles/${id}`, data);
      return response.data;
    },
    options
  );
}

// Delete role mutation
export function useDeleteRole(options?: any) {
  return useMutation(async (id: string) => {
    await api.delete(`/roles/${id}`);
  }, options);
}

// Fetch permissions
export function usePermissions(options?: any) {
  return useApi(
    async () => {
      const response = await api.get('/permissions');
      return response.data;
    },
    [],
    { immediate: true, ...options }
  );
}
