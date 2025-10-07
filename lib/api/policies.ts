import { api } from './client-instance';

export interface Policy {
  id: string;
  name: string;
  description?: string;
  category: string;
  status: 'draft' | 'in_review' | 'approved' | 'published' | 'archived';
  version: string;
  effectiveDate: string;
  nextReviewDate?: string;
  owner?: {
    id: string;
    name: string;
    email: string;
  };
  approvers?: Array<{
    id: string;
    name: string;
    email: string;
    approvedAt?: string;
  }>;
  content?: string;
  attachments?: Array<{
    id: string;
    name: string;
    url: string;
    size: number;
  }>;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PolicyTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  framework: 'soc2' | 'iso27001' | 'nist' | 'custom';
  content: string;
  variables?: Array<{
    key: string;
    label: string;
    type: 'text' | 'select' | 'date';
    options?: string[];
    required: boolean;
  }>;
}

export interface PolicyReview {
  id: string;
  policyId: string;
  reviewerId: string;
  status: 'pending' | 'in_progress' | 'completed';
  comments?: string;
  findings?: Array<{
    type: 'issue' | 'suggestion';
    description: string;
    resolved: boolean;
  }>;
  completedAt?: string;
}

export interface PolicyApproval {
  id: string;
  policyId: string;
  approverId: string;
  status: 'pending' | 'approved' | 'rejected';
  comments?: string;
  approvedAt?: string;
}

export interface CreatePolicyData {
  name: string;
  description?: string;
  category: string;
  content?: string;
  templateId?: string;
  templateVariables?: Record<string, any>;
  effectiveDate: string;
  nextReviewDate?: string;
  ownerId?: string;
  approverIds?: string[];
  tags?: string[];
}

export interface UpdatePolicyData extends Partial<CreatePolicyData> {
  status?: Policy['status'];
  version?: string;
}

export interface PolicyFilters {
  search?: string;
  category?: string;
  status?: Policy['status'];
  ownerId?: string;
  tags?: string[];
  effectiveDateFrom?: string;
  effectiveDateTo?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export const policiesApi = {
  // Policies
  async getPolicies(filters?: PolicyFilters) {
    const response = await api.get<{ data: Policy[]; total: number }>('/policies', {
      params: filters,
    });
    return response.data;
  },

  async getPolicy(id: string) {
    const response = await api.get<Policy>(`/policies/${id}`);
    return response.data;
  },

  async createPolicy(data: CreatePolicyData) {
    const response = await api.post<Policy>('/policies', data);
    return response.data;
  },

  async updatePolicy(id: string, data: UpdatePolicyData) {
    const response = await api.patch<Policy>(`/policies/${id}`, data);
    return response.data;
  },

  async deletePolicy(id: string) {
    await api.delete(`/policies/${id}`);
  },

  async archivePolicy(id: string) {
    const response = await api.post<Policy>(`/policies/${id}/archive`);
    return response.data;
  },

  async publishPolicy(id: string) {
    const response = await api.post<Policy>(`/policies/${id}/publish`);
    return response.data;
  },

  // Templates
  async getTemplates(framework?: string) {
    const response = await api.get<PolicyTemplate[]>('/policies/templates', {
      params: { framework },
    });
    return response.data;
  },

  async getTemplate(id: string) {
    const response = await api.get<PolicyTemplate>(`/policies/templates/${id}`);
    return response.data;
  },

  async previewTemplate(id: string, variables: Record<string, any>) {
    const response = await api.post<{ content: string }>(`/policies/templates/${id}/preview`, {
      variables,
    });
    return response.data;
  },

  // Reviews
  async startReview(policyId: string, reviewerId: string) {
    const response = await api.post<PolicyReview>(`/policies/${policyId}/reviews`, {
      reviewerId,
    });
    return response.data;
  },

  async updateReview(policyId: string, reviewId: string, data: Partial<PolicyReview>) {
    const response = await api.patch<PolicyReview>(
      `/policies/${policyId}/reviews/${reviewId}`,
      data
    );
    return response.data;
  },

  async completeReview(policyId: string, reviewId: string, findings: PolicyReview['findings']) {
    const response = await api.post<PolicyReview>(
      `/policies/${policyId}/reviews/${reviewId}/complete`,
      {
        findings,
      }
    );
    return response.data;
  },

  // Approvals
  async requestApproval(policyId: string, approverIds: string[]) {
    const response = await api.post<PolicyApproval[]>(`/policies/${policyId}/approvals`, {
      approverIds,
    });
    return response.data;
  },

  async approvePolicy(policyId: string, approvalId: string, comments?: string) {
    const response = await api.post<PolicyApproval>(
      `/policies/${policyId}/approvals/${approvalId}/approve`,
      {
        comments,
      }
    );
    return response.data;
  },

  async rejectPolicy(policyId: string, approvalId: string, comments: string) {
    const response = await api.post<PolicyApproval>(
      `/policies/${policyId}/approvals/${approvalId}/reject`,
      {
        comments,
      }
    );
    return response.data;
  },

  // Bulk operations
  async bulkUpdatePolicies(ids: string[], data: UpdatePolicyData) {
    const response = await api.patch<{ updated: number }>('/policies/bulk', { ids, data });
    return response.data;
  },

  async bulkArchivePolicies(ids: string[]) {
    const response = await api.post<{ archived: number }>('/policies/bulk/archive', { ids });
    return response.data;
  },

  // Export
  async exportPolicies(format: 'pdf' | 'docx' | 'csv', filters?: PolicyFilters) {
    const response = await api.get('/policies/export', {
      params: { format, ...filters },
      headers: { Accept: 'application/octet-stream' },
    });
    return response.data;
  },

  // Attachments
  async uploadAttachment(policyId: string, file: File) {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.upload(`/policies/${policyId}/attachments`, formData);
    return response.data;
  },

  async deleteAttachment(policyId: string, attachmentId: string) {
    await api.delete(`/policies/${policyId}/attachments/${attachmentId}`);
  },

  // Analytics
  async getPolicyStats() {
    const response = await api.get('/policies/stats');
    return response.data;
  },

  async getComplianceMatrix() {
    const response = await api.get('/policies/compliance-matrix');
    return response.data;
  },
};
