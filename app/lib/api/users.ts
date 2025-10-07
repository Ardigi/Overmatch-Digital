import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  department?: string;
  status: 'active' | 'inactive' | 'pending';
  lastLogin?: string;
  mfaEnabled: boolean;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserDto {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  role: string;
  department?: string;
  organizationId: string;
}

export interface UpdateUserDto {
  firstName?: string;
  lastName?: string;
  role?: string;
  department?: string;
  status?: 'active' | 'inactive' | 'pending';
}

// API client functions
const usersApi = {
  getAll: async (organizationId: string): Promise<User[]> => {
    const { data } = await axios.get(`${API_BASE_URL}/users`, {
      params: { organizationId },
    });
    return data;
  },

  getById: async (id: string): Promise<User> => {
    const { data } = await axios.get(`${API_BASE_URL}/users/${id}`);
    return data;
  },

  create: async (userData: CreateUserDto): Promise<User> => {
    const { data } = await axios.post(`${API_BASE_URL}/users`, userData);
    return data;
  },

  update: async (id: string, userData: UpdateUserDto): Promise<User> => {
    const { data } = await axios.patch(`${API_BASE_URL}/users/${id}`, userData);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await axios.delete(`${API_BASE_URL}/users/${id}`);
  },

  enableMfa: async (id: string): Promise<{ qrCode: string; secret: string }> => {
    const { data } = await axios.post(`${API_BASE_URL}/users/${id}/mfa/enable`);
    return data;
  },

  disableMfa: async (id: string): Promise<void> => {
    await axios.post(`${API_BASE_URL}/users/${id}/mfa/disable`);
  },

  resetPassword: async (id: string): Promise<void> => {
    await axios.post(`${API_BASE_URL}/users/${id}/reset-password`);
  },
};

// React Query hooks
export const useUsers = (organizationId: string) => {
  return useQuery({
    queryKey: ['users', organizationId],
    queryFn: () => usersApi.getAll(organizationId),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useUser = (id: string) => {
  return useQuery({
    queryKey: ['users', id],
    queryFn: () => usersApi.getById(id),
    enabled: !!id,
  });
};

export const useCreateUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: usersApi.create,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['users', data.organizationId] });
    },
  });
};

export const useUpdateUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateUserDto }) => usersApi.update(id, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['users', data.organizationId] });
      queryClient.invalidateQueries({ queryKey: ['users', data.id] });
    },
  });
};

export const useDeleteUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: usersApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
};

export const useEnableMfa = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: usersApi.enableMfa,
    onSuccess: (_, userId) => {
      queryClient.invalidateQueries({ queryKey: ['users', userId] });
    },
  });
};

export const useDisableMfa = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: usersApi.disableMfa,
    onSuccess: (_, userId) => {
      queryClient.invalidateQueries({ queryKey: ['users', userId] });
    },
  });
};

export const useResetPassword = () => {
  return useMutation({
    mutationFn: usersApi.resetPassword,
  });
};
