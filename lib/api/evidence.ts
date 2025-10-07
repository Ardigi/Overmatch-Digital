import { api } from './client-instance';

export interface Evidence {
  id: string;
  name: string;
  description?: string;
  type: 'document' | 'screenshot' | 'log' | 'report' | 'configuration' | 'other';
  category: 'policy' | 'control' | 'audit' | 'assessment' | 'general';
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  fileUrl?: string;
  fileSize?: number;
  mimeType?: string;
  collectionDate: string;
  expirationDate?: string;
  collector?: {
    id: string;
    name: string;
    email: string;
  };
  approver?: {
    id: string;
    name: string;
    email: string;
  };
  relatedControls?: string[];
  relatedPolicies?: string[];
  relatedProjects?: string[];
  metadata?: Record<string, any>;
  tags?: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EvidenceRequest {
  id: string;
  title: string;
  description: string;
  requestor: {
    id: string;
    name: string;
    email: string;
  };
  assignee?: {
    id: string;
    name: string;
    email: string;
  };
  dueDate: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'in_progress' | 'completed' | 'overdue';
  category: Evidence['category'];
  controlIds?: string[];
  projectId?: string;
  specifications?: string;
  attachments?: Array<{
    id: string;
    name: string;
    url: string;
  }>;
  completedEvidence?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface EvidenceTemplate {
  id: string;
  name: string;
  description: string;
  type: Evidence['type'];
  category: Evidence['category'];
  requiredFields: Array<{
    name: string;
    type: 'text' | 'number' | 'date' | 'boolean' | 'select';
    required: boolean;
    options?: string[];
  }>;
  sampleContent?: string;
  instructions?: string;
}

export interface CreateEvidenceData {
  name: string;
  description?: string;
  type: Evidence['type'];
  category: Evidence['category'];
  collectionDate: string;
  expirationDate?: string;
  collectorId?: string;
  relatedControls?: string[];
  relatedPolicies?: string[];
  relatedProjects?: string[];
  metadata?: Record<string, any>;
  tags?: string[];
  notes?: string;
}

export interface UpdateEvidenceData extends Partial<CreateEvidenceData> {
  status?: Evidence['status'];
  approverId?: string;
}

export interface EvidenceFilters {
  search?: string;
  type?: Evidence['type'];
  category?: Evidence['category'];
  status?: Evidence['status'];
  collectorId?: string;
  approverId?: string;
  relatedControlId?: string;
  relatedPolicyId?: string;
  relatedProjectId?: string;
  tags?: string[];
  collectionDateFrom?: string;
  collectionDateTo?: string;
  expiringWithinDays?: number;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export const evidenceApi = {
  // Evidence
  async getEvidence(filters?: EvidenceFilters) {
    const response = await api.get<{ data: Evidence[]; total: number }>('/evidence', {
      params: filters,
    });
    return response.data;
  },

  async getEvidenceById(id: string) {
    const response = await api.get<Evidence>(`/evidence/${id}`);
    return response.data;
  },

  async createEvidence(data: CreateEvidenceData) {
    const response = await api.post<Evidence>('/evidence', data);
    return response.data;
  },

  async updateEvidence(id: string, data: UpdateEvidenceData) {
    const response = await api.patch<Evidence>(`/evidence/${id}`, data);
    return response.data;
  },

  async deleteEvidence(id: string) {
    await api.delete(`/evidence/${id}`);
  },

  async uploadEvidence(
    file: File,
    metadata: CreateEvidenceData,
    onProgress?: (progress: number) => void
  ) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('metadata', JSON.stringify(metadata));

    const response = await api.upload<Evidence>('/evidence/upload', formData, {
      onProgress,
    });
    return response.data;
  },

  async approveEvidence(id: string, notes?: string) {
    const response = await api.post<Evidence>(`/evidence/${id}/approve`, { notes });
    return response.data;
  },

  async rejectEvidence(id: string, reason: string) {
    const response = await api.post<Evidence>(`/evidence/${id}/reject`, { reason });
    return response.data;
  },

  // Evidence Requests
  async getEvidenceRequests(filters?: {
    status?: EvidenceRequest['status'];
    assigneeId?: string;
    requestorId?: string;
    projectId?: string;
    priority?: EvidenceRequest['priority'];
    overdue?: boolean;
  }) {
    const response = await api.get<EvidenceRequest[]>('/evidence/requests', { params: filters });
    return response.data;
  },

  async getEvidenceRequest(id: string) {
    const response = await api.get<EvidenceRequest>(`/evidence/requests/${id}`);
    return response.data;
  },

  async createEvidenceRequest(
    data: Omit<EvidenceRequest, 'id' | 'status' | 'createdAt' | 'updatedAt'>
  ) {
    const response = await api.post<EvidenceRequest>('/evidence/requests', data);
    return response.data;
  },

  async updateEvidenceRequest(id: string, data: Partial<EvidenceRequest>) {
    const response = await api.patch<EvidenceRequest>(`/evidence/requests/${id}`, data);
    return response.data;
  },

  async assignEvidenceRequest(id: string, assigneeId: string) {
    const response = await api.post<EvidenceRequest>(`/evidence/requests/${id}/assign`, {
      assigneeId,
    });
    return response.data;
  },

  async completeEvidenceRequest(id: string, evidenceIds: string[]) {
    const response = await api.post<EvidenceRequest>(`/evidence/requests/${id}/complete`, {
      evidenceIds,
    });
    return response.data;
  },

  // Templates
  async getEvidenceTemplates(category?: Evidence['category']) {
    const response = await api.get<EvidenceTemplate[]>('/evidence/templates', {
      params: { category },
    });
    return response.data;
  },

  async getEvidenceTemplate(id: string) {
    const response = await api.get<EvidenceTemplate>(`/evidence/templates/${id}`);
    return response.data;
  },

  // Bulk operations
  async bulkUploadEvidence(files: File[], defaultMetadata: Partial<CreateEvidenceData>) {
    const formData = new FormData();
    files.forEach((file, index) => {
      formData.append(`files[${index}]`, file);
    });
    formData.append('defaultMetadata', JSON.stringify(defaultMetadata));

    const response = await api.upload<{ uploaded: number; failed: number; errors: any[] }>(
      '/evidence/bulk-upload',
      formData
    );
    return response.data;
  },

  async bulkUpdateEvidence(ids: string[], data: UpdateEvidenceData) {
    const response = await api.patch<{ updated: number }>('/evidence/bulk', { ids, data });
    return response.data;
  },

  async bulkDeleteEvidence(ids: string[]) {
    const response = await api.post<{ deleted: number }>('/evidence/bulk/delete', { ids });
    return response.data;
  },

  // Export
  async exportEvidence(format: 'zip' | 'csv', filters?: EvidenceFilters) {
    const response = await api.get('/evidence/export', {
      params: { format, ...filters },
      headers: { Accept: 'application/octet-stream' },
    });
    return response.data;
  },

  // Analytics
  async getEvidenceStats() {
    const response = await api.get('/evidence/stats');
    return response.data;
  },

  async getEvidenceCoverage(type: 'control' | 'policy' | 'project') {
    const response = await api.get('/evidence/coverage', {
      params: { type },
    });
    return response.data;
  },

  async getExpiringEvidence(days: number = 30) {
    const response = await api.get<Evidence[]>('/evidence/expiring', {
      params: { days },
    });
    return response.data;
  },
};
