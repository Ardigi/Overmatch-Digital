import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

export interface Client {
  id: string;
  name: string;
  code: string;
  industry: string;
  description?: string;
  website?: string;
  primaryContactName: string;
  primaryContactEmail: string;
  primaryContactPhone: string;
  status: 'active' | 'inactive' | 'onboarding' | 'offboarding';
  complianceStatus: 'compliant' | 'non_compliant' | 'pending' | 'at_risk';
  complianceFrameworks: string[];
  contractStartDate: string;
  contractEndDate: string;
  organizationId: string;
  billingInfo?: {
    billingAddress: string;
    billingContact: string;
    billingEmail: string;
    paymentTerms: string;
    currency: string;
  };
  metadata?: any;
  createdAt: string;
  updatedAt: string;
}

export interface CreateClientDto {
  name: string;
  code: string;
  industry: string;
  description?: string;
  website?: string;
  primaryContactName: string;
  primaryContactEmail: string;
  primaryContactPhone: string;
  complianceFrameworks: string[];
  contractStartDate: string;
  contractEndDate: string;
  organizationId: string;
  billingInfo?: {
    billingAddress: string;
    billingContact: string;
    billingEmail: string;
    paymentTerms: string;
    currency: string;
  };
}

export interface UpdateClientDto extends Partial<CreateClientDto> {
  status?: 'active' | 'inactive' | 'onboarding' | 'offboarding';
  complianceStatus?: 'compliant' | 'non_compliant' | 'pending' | 'at_risk';
}

export interface ClientAudit {
  id: string;
  clientId: string;
  auditType: 'SOC1' | 'SOC2' | 'ISO27001' | 'HIPAA' | 'PCI_DSS' | 'GDPR' | 'CUSTOM';
  auditPeriodStart: string;
  auditPeriodEnd: string;
  status: 'planned' | 'in_progress' | 'review' | 'completed' | 'cancelled';
  leadAuditor: string;
  auditTeam: string[];
  scope: string[];
  result?: 'passed' | 'passed_with_exceptions' | 'failed';
  reportUrl?: string;
  createdAt: string;
  updatedAt: string;
}

// API client functions
const clientsApi = {
  getAll: async (organizationId: string): Promise<Client[]> => {
    const { data } = await axios.get(`${API_BASE_URL}/clients`, {
      params: { organizationId },
    });
    return data;
  },

  getById: async (id: string): Promise<Client> => {
    const { data } = await axios.get(`${API_BASE_URL}/clients/${id}`);
    return data;
  },

  create: async (clientData: CreateClientDto): Promise<Client> => {
    const { data } = await axios.post(`${API_BASE_URL}/clients`, clientData);
    return data;
  },

  update: async (id: string, clientData: UpdateClientDto): Promise<Client> => {
    const { data } = await axios.patch(`${API_BASE_URL}/clients/${id}`, clientData);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await axios.delete(`${API_BASE_URL}/clients/${id}`);
  },

  getAudits: async (clientId: string): Promise<ClientAudit[]> => {
    const { data } = await axios.get(`${API_BASE_URL}/clients/${clientId}/audits`);
    return data;
  },

  startOnboarding: async (clientId: string): Promise<Client> => {
    const { data } = await axios.post(`${API_BASE_URL}/clients/${clientId}/onboarding/start`);
    return data;
  },

  completeOnboarding: async (clientId: string, data: any): Promise<Client> => {
    const { data: result } = await axios.post(
      `${API_BASE_URL}/clients/${clientId}/onboarding/complete`,
      data
    );
    return result;
  },
};

// React Query hooks
export const useClients = (organizationId: string) => {
  return useQuery({
    queryKey: ['clients', organizationId],
    queryFn: () => clientsApi.getAll(organizationId),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useClient = (id: string) => {
  return useQuery({
    queryKey: ['clients', id],
    queryFn: () => clientsApi.getById(id),
    enabled: !!id,
  });
};

export const useCreateClient = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: clientsApi.create,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['clients', data.organizationId] });
    },
  });
};

export const useUpdateClient = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateClientDto }) =>
      clientsApi.update(id, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['clients', data.organizationId] });
      queryClient.invalidateQueries({ queryKey: ['clients', data.id] });
    },
  });
};

export const useDeleteClient = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: clientsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
  });
};

export const useClientAudits = (clientId: string) => {
  return useQuery({
    queryKey: ['clients', clientId, 'audits'],
    queryFn: () => clientsApi.getAudits(clientId),
    enabled: !!clientId,
  });
};

export const useStartOnboarding = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: clientsApi.startOnboarding,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['clients', data.id] });
    },
  });
};

export const useCompleteOnboarding = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ clientId, data }: { clientId: string; data: any }) =>
      clientsApi.completeOnboarding(clientId, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['clients', data.id] });
    },
  });
};
