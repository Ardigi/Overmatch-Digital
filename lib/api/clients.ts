import { api } from './client-instance';

export interface Client {
  id: string;
  name: string;
  type: 'enterprise' | 'small_business' | 'startup';
  industry: string;
  status: 'active' | 'inactive' | 'pending';
  contactEmail: string;
  contactPhone?: string;
  address?: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  website?: string;
  taxId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  title?: string;
  isPrimary: boolean;
  clientId: string;
}

export interface Project {
  id: string;
  name: string;
  type: 'soc1' | 'soc2' | 'soc2_plus' | 'readiness' | 'risk_assessment';
  status: 'planning' | 'in_progress' | 'review' | 'completed' | 'on_hold';
  startDate: string;
  endDate?: string;
  clientId: string;
  description?: string;
  budget?: number;
  actualCost?: number;
}

export interface CreateClientData {
  name: string;
  type: Client['type'];
  industry: string;
  contactEmail: string;
  contactPhone?: string;
  address?: Client['address'];
  website?: string;
  taxId?: string;
}

export interface UpdateClientData extends Partial<CreateClientData> {
  status?: Client['status'];
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ClientFilters {
  search?: string;
  type?: Client['type'];
  industry?: string;
  status?: Client['status'];
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export const clientsApi = {
  // Clients
  async getClients(filters?: ClientFilters): Promise<PaginatedResponse<Client>> {
    const response = await api.get<PaginatedResponse<Client>>('/api/clients', { params: filters });
    return response.data;
  },

  async getClient(id: string): Promise<Client> {
    const response = await api.get<Client>(`/api/clients/${id}`);
    return response.data;
  },

  async createClient(data: CreateClientData): Promise<Client> {
    const response = await api.post<Client>('/api/clients', data);
    return response.data;
  },

  async updateClient(id: string, data: UpdateClientData): Promise<Client> {
    const response = await api.patch<Client>(`/api/clients/${id}`, data);
    return response.data;
  },

  async deleteClient(id: string): Promise<void> {
    await api.delete(`/api/clients/${id}`);
  },

  // Contacts
  async getContacts(clientId: string): Promise<Contact[]> {
    const response = await api.get<Contact[]>(`/api/clients/${clientId}/contacts`);
    return response.data;
  },

  async createContact(clientId: string, data: Omit<Contact, 'id' | 'clientId'>): Promise<Contact> {
    const response = await api.post<Contact>(`/api/clients/${clientId}/contacts`, data);
    return response.data;
  },

  async updateContact(
    clientId: string,
    contactId: string,
    data: Partial<Omit<Contact, 'id' | 'clientId'>>
  ): Promise<Contact> {
    const response = await api.patch<Contact>(
      `/api/clients/${clientId}/contacts/${contactId}`,
      data
    );
    return response.data;
  },

  async deleteContact(clientId: string, contactId: string): Promise<void> {
    await api.delete(`/api/clients/${clientId}/contacts/${contactId}`);
  },

  // Projects
  async getProjects(clientId: string): Promise<Project[]> {
    const response = await api.get<Project[]>(`/api/clients/${clientId}/projects`);
    return response.data;
  },

  async createProject(clientId: string, data: Omit<Project, 'id' | 'clientId'>): Promise<Project> {
    const response = await api.post<Project>(`/api/clients/${clientId}/projects`, data);
    return response.data;
  },

  async updateProject(
    clientId: string,
    projectId: string,
    data: Partial<Omit<Project, 'id' | 'clientId'>>
  ): Promise<Project> {
    const response = await api.patch<Project>(
      `/api/clients/${clientId}/projects/${projectId}`,
      data
    );
    return response.data;
  },

  async deleteProject(clientId: string, projectId: string): Promise<void> {
    await api.delete(`/api/clients/${clientId}/projects/${projectId}`);
  },

  // Bulk operations
  async bulkUpdateClients(ids: string[], data: UpdateClientData): Promise<{ updated: number }> {
    const response = await api.patch<{ updated: number }>('/clients/bulk', { ids, data });
    return response.data;
  },

  async bulkDeleteClients(ids: string[]): Promise<{ deleted: number }> {
    const response = await api.post<{ deleted: number }>('/clients/bulk/delete', { ids });
    return response.data;
  },

  // Import/Export
  async exportClients(format: 'csv' | 'xlsx', filters?: ClientFilters): Promise<Blob> {
    const response = await api.get('/clients/export', {
      params: { format, ...filters },
      headers: { Accept: 'application/octet-stream' },
    });
    return response.data;
  },

  async importClients(file: File): Promise<{ imported: number; errors: any[] }> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.upload<{ imported: number; errors: any[] }>(
      '/clients/import',
      formData
    );
    return response.data;
  },

  // Analytics
  async getClientStats(): Promise<{
    total: number;
    byType: Record<string, number>;
    byStatus: Record<string, number>;
    byIndustry: Record<string, number>;
    recentActivity: any[];
  }> {
    const response = await api.get('/clients/stats');
    return response.data;
  },

  // Documents
  async getDocuments(clientId: string): Promise<any[]> {
    const response = await api.get<any[]>(`/api/clients/${clientId}/documents`);
    return response.data;
  },

  async uploadDocument(clientId: string, file: File, metadata?: any): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    if (metadata) {
      formData.append('metadata', JSON.stringify(metadata));
    }
    const response = await api.upload(`/api/clients/${clientId}/documents`, formData);
    return response.data;
  },

  async deleteDocument(clientId: string, documentId: string): Promise<void> {
    await api.delete(`/api/clients/${clientId}/documents/${documentId}`);
  },
};
