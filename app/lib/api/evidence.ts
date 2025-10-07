import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

export interface Evidence {
  id: string;
  title: string;
  description: string;
  type: 'document' | 'screenshot' | 'log' | 'report' | 'configuration' | 'other';
  source: 'manual' | 'automated' | 'integrated';
  status: 'draft' | 'collected' | 'pending_review' | 'approved' | 'rejected' | 'expired';
  controlIds: string[];
  collectionDate: string;
  expiryDate?: string;
  collectedBy: string;
  reviewedBy?: string;
  reviewDate?: string;
  reviewNotes?: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  metadata?: any;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface EvidenceRequest {
  id: string;
  controlId: string;
  title: string;
  description: string;
  requestedBy: string;
  assignedTo: string;
  dueDate: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'in_progress' | 'completed' | 'overdue' | 'cancelled';
  instructions?: string;
  templateId?: string;
  evidenceId?: string;
  completedDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEvidenceDto {
  title: string;
  description: string;
  type: Evidence['type'];
  source: Evidence['source'];
  controlIds: string[];
  collectionDate: string;
  expiryDate?: string;
  collectedBy: string;
  tags?: string[];
  metadata?: any;
}

export interface UpdateEvidenceDto extends Partial<CreateEvidenceDto> {
  status?: Evidence['status'];
  reviewedBy?: string;
  reviewDate?: string;
  reviewNotes?: string;
}

export interface CreateEvidenceRequestDto {
  controlId: string;
  title: string;
  description: string;
  requestedBy: string;
  assignedTo: string;
  dueDate: string;
  priority: EvidenceRequest['priority'];
  instructions?: string;
  templateId?: string;
}

// API client functions
const evidenceApi = {
  getAll: async (filters?: any): Promise<Evidence[]> => {
    const { data } = await axios.get(`${API_BASE_URL}/evidence`, { params: filters });
    return data;
  },

  getById: async (id: string): Promise<Evidence> => {
    const { data } = await axios.get(`${API_BASE_URL}/evidence/${id}`);
    return data;
  },

  getByControl: async (controlId: string): Promise<Evidence[]> => {
    const { data } = await axios.get(`${API_BASE_URL}/evidence/control/${controlId}`);
    return data;
  },

  create: async (evidenceData: CreateEvidenceDto): Promise<Evidence> => {
    const { data } = await axios.post(`${API_BASE_URL}/evidence`, evidenceData);
    return data;
  },

  update: async (id: string, evidenceData: UpdateEvidenceDto): Promise<Evidence> => {
    const { data } = await axios.patch(`${API_BASE_URL}/evidence/${id}`, evidenceData);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await axios.delete(`${API_BASE_URL}/evidence/${id}`);
  },

  uploadFile: async (id: string, file: File): Promise<Evidence> => {
    const formData = new FormData();
    formData.append('file', file);

    const { data } = await axios.post(`${API_BASE_URL}/evidence/${id}/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return data;
  },

  approve: async (id: string, notes?: string): Promise<Evidence> => {
    const { data } = await axios.post(`${API_BASE_URL}/evidence/${id}/approve`, { notes });
    return data;
  },

  reject: async (id: string, notes: string): Promise<Evidence> => {
    const { data } = await axios.post(`${API_BASE_URL}/evidence/${id}/reject`, { notes });
    return data;
  },

  // Evidence Requests
  getAllRequests: async (filters?: any): Promise<EvidenceRequest[]> => {
    const { data } = await axios.get(`${API_BASE_URL}/evidence/requests`, { params: filters });
    return data;
  },

  createRequest: async (requestData: CreateEvidenceRequestDto): Promise<EvidenceRequest> => {
    const { data } = await axios.post(`${API_BASE_URL}/evidence/requests`, requestData);
    return data;
  },

  updateRequest: async (id: string, data: Partial<EvidenceRequest>): Promise<EvidenceRequest> => {
    const { data: result } = await axios.patch(`${API_BASE_URL}/evidence/requests/${id}`, data);
    return result;
  },

  completeRequest: async (id: string, evidenceId: string): Promise<EvidenceRequest> => {
    const { data } = await axios.post(`${API_BASE_URL}/evidence/requests/${id}/complete`, {
      evidenceId,
    });
    return data;
  },
};

// React Query hooks
export const useEvidence = (filters?: any) => {
  return useQuery({
    queryKey: ['evidence', filters],
    queryFn: () => evidenceApi.getAll(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useEvidenceById = (id: string) => {
  return useQuery({
    queryKey: ['evidence', id],
    queryFn: () => evidenceApi.getById(id),
    enabled: !!id,
  });
};

export const useEvidenceByControl = (controlId: string) => {
  return useQuery({
    queryKey: ['evidence', 'control', controlId],
    queryFn: () => evidenceApi.getByControl(controlId),
    enabled: !!controlId,
  });
};

export const useCreateEvidence = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: evidenceApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evidence'] });
    },
  });
};

export const useUpdateEvidence = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateEvidenceDto }) =>
      evidenceApi.update(id, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['evidence'] });
      queryClient.invalidateQueries({ queryKey: ['evidence', data.id] });
      data.controlIds.forEach((controlId) => {
        queryClient.invalidateQueries({ queryKey: ['evidence', 'control', controlId] });
      });
    },
  });
};

export const useUploadEvidenceFile = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => evidenceApi.uploadFile(id, file),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['evidence', data.id] });
    },
  });
};

export const useApproveEvidence = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) => evidenceApi.approve(id, notes),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['evidence'] });
      queryClient.invalidateQueries({ queryKey: ['evidence', data.id] });
    },
  });
};

export const useRejectEvidence = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes: string }) => evidenceApi.reject(id, notes),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['evidence'] });
      queryClient.invalidateQueries({ queryKey: ['evidence', data.id] });
    },
  });
};

// Evidence Request hooks
export const useEvidenceRequests = (filters?: any) => {
  return useQuery({
    queryKey: ['evidence-requests', filters],
    queryFn: () => evidenceApi.getAllRequests(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useCreateEvidenceRequest = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: evidenceApi.createRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evidence-requests'] });
    },
  });
};

export const useCompleteEvidenceRequest = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, evidenceId }: { id: string; evidenceId: string }) =>
      evidenceApi.completeRequest(id, evidenceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evidence-requests'] });
      queryClient.invalidateQueries({ queryKey: ['evidence'] });
    },
  });
};
