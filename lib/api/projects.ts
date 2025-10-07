import { api } from './client-instance';

export interface Project {
  id: string;
  name: string;
  type: 'soc1' | 'soc2' | 'soc2_plus' | 'readiness' | 'risk_assessment' | 'iso27001' | 'custom';
  status: 'planning' | 'in_progress' | 'review' | 'completed' | 'on_hold' | 'cancelled';
  clientId: string;
  client?: {
    id: string;
    name: string;
    contactEmail: string;
  };
  description?: string;
  scope?: string;
  objectives?: string[];
  deliverables?: string[];
  startDate: string;
  endDate: string;
  actualEndDate?: string;
  budget?: number;
  actualCost?: number;
  progress: number; // 0-100
  manager?: {
    id: string;
    name: string;
    email: string;
  };
  team?: Array<{
    id: string;
    name: string;
    email: string;
    role: string;
  }>;
  milestones?: Array<{
    id: string;
    name: string;
    description?: string;
    dueDate: string;
    completedDate?: string;
    status: 'pending' | 'in_progress' | 'completed' | 'delayed';
  }>;
  risks?: Array<{
    id: string;
    description: string;
    impact: 'low' | 'medium' | 'high' | 'critical';
    likelihood: 'low' | 'medium' | 'high';
    mitigation?: string;
    status: 'identified' | 'mitigated' | 'accepted' | 'closed';
  }>;
  documents?: Array<{
    id: string;
    name: string;
    type: string;
    url: string;
    uploadedAt: string;
  }>;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ProjectTask {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  assignee?: {
    id: string;
    name: string;
    email: string;
  };
  dueDate?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'todo' | 'in_progress' | 'review' | 'completed' | 'blocked';
  category: 'planning' | 'documentation' | 'testing' | 'review' | 'remediation' | 'other';
  estimatedHours?: number;
  actualHours?: number;
  dependencies?: string[];
  attachments?: Array<{
    id: string;
    name: string;
    url: string;
  }>;
  comments?: Array<{
    id: string;
    userId: string;
    userName: string;
    text: string;
    createdAt: string;
  }>;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectTemplate {
  id: string;
  name: string;
  type: Project['type'];
  description: string;
  defaultDurationDays: number;
  milestones: Array<{
    name: string;
    description?: string;
    offsetDays: number;
  }>;
  tasks: Array<{
    title: string;
    description?: string;
    category: ProjectTask['category'];
    offsetDays: number;
    estimatedHours: number;
  }>;
  documents: Array<{
    name: string;
    type: string;
    template?: string;
  }>;
}

export interface CreateProjectData {
  name: string;
  type: Project['type'];
  clientId: string;
  description?: string;
  scope?: string;
  objectives?: string[];
  deliverables?: string[];
  startDate: string;
  endDate: string;
  budget?: number;
  managerId?: string;
  teamMemberIds?: string[];
  templateId?: string;
  tags?: string[];
}

export interface UpdateProjectData extends Partial<CreateProjectData> {
  status?: Project['status'];
  actualEndDate?: string;
  actualCost?: number;
  progress?: number;
}

export interface ProjectFilters {
  search?: string;
  type?: Project['type'];
  status?: Project['status'];
  clientId?: string;
  managerId?: string;
  teamMemberId?: string;
  startDateFrom?: string;
  startDateTo?: string;
  endDateFrom?: string;
  endDateTo?: string;
  tags?: string[];
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export const projectsApi = {
  // Projects
  async getProjects(filters?: ProjectFilters) {
    const response = await api.get<{ data: Project[]; total: number }>('/projects', {
      params: filters,
    });
    return response.data;
  },

  async getProject(id: string) {
    const response = await api.get<Project>(`/projects/${id}`);
    return response.data;
  },

  async createProject(data: CreateProjectData) {
    const response = await api.post<Project>('/projects', data);
    return response.data;
  },

  async updateProject(id: string, data: UpdateProjectData) {
    const response = await api.patch<Project>(`/projects/${id}`, data);
    return response.data;
  },

  async deleteProject(id: string) {
    await api.delete(`/projects/${id}`);
  },

  async completeProject(id: string, summary?: string) {
    const response = await api.post<Project>(`/projects/${id}/complete`, { summary });
    return response.data;
  },

  async archiveProject(id: string) {
    const response = await api.post<Project>(`/projects/${id}/archive`);
    return response.data;
  },

  // Project Tasks
  async getProjectTasks(
    projectId: string,
    filters?: {
      status?: ProjectTask['status'];
      assigneeId?: string;
      category?: ProjectTask['category'];
      priority?: ProjectTask['priority'];
    }
  ) {
    const response = await api.get<ProjectTask[]>(`/projects/${projectId}/tasks`, {
      params: filters,
    });
    return response.data;
  },

  async createProjectTask(
    projectId: string,
    data: Omit<ProjectTask, 'id' | 'projectId' | 'createdAt' | 'updatedAt'>
  ) {
    const response = await api.post<ProjectTask>(`/projects/${projectId}/tasks`, data);
    return response.data;
  },

  async updateProjectTask(projectId: string, taskId: string, data: Partial<ProjectTask>) {
    const response = await api.patch<ProjectTask>(`/projects/${projectId}/tasks/${taskId}`, data);
    return response.data;
  },

  async deleteProjectTask(projectId: string, taskId: string) {
    await api.delete(`/projects/${projectId}/tasks/${taskId}`);
  },

  async completeProjectTask(projectId: string, taskId: string, actualHours?: number) {
    const response = await api.post<ProjectTask>(
      `/projects/${projectId}/tasks/${taskId}/complete`,
      { actualHours }
    );
    return response.data;
  },

  async addTaskComment(projectId: string, taskId: string, text: string) {
    const response = await api.post<ProjectTask>(
      `/projects/${projectId}/tasks/${taskId}/comments`,
      { text }
    );
    return response.data;
  },

  // Milestones
  async updateMilestone(
    projectId: string,
    milestoneId: string,
    data: Partial<Project['milestones'][0]>
  ) {
    const response = await api.patch<Project>(
      `/projects/${projectId}/milestones/${milestoneId}`,
      data
    );
    return response.data;
  },

  async completeMilestone(projectId: string, milestoneId: string) {
    const response = await api.post<Project>(
      `/projects/${projectId}/milestones/${milestoneId}/complete`
    );
    return response.data;
  },

  // Team Management
  async addTeamMember(projectId: string, userId: string, role: string) {
    const response = await api.post<Project>(`/projects/${projectId}/team`, { userId, role });
    return response.data;
  },

  async removeTeamMember(projectId: string, userId: string) {
    const response = await api.delete<Project>(`/projects/${projectId}/team/${userId}`);
    return response.data;
  },

  async updateTeamMemberRole(projectId: string, userId: string, role: string) {
    const response = await api.patch<Project>(`/projects/${projectId}/team/${userId}`, { role });
    return response.data;
  },

  // Documents
  async uploadDocument(
    projectId: string,
    file: File,
    metadata?: { type: string; description?: string }
  ) {
    const formData = new FormData();
    formData.append('file', file);
    if (metadata) {
      formData.append('metadata', JSON.stringify(metadata));
    }
    const response = await api.upload(`/projects/${projectId}/documents`, formData);
    return response.data;
  },

  async deleteDocument(projectId: string, documentId: string) {
    await api.delete(`/projects/${projectId}/documents/${documentId}`);
  },

  // Templates
  async getProjectTemplates(type?: Project['type']) {
    const response = await api.get<ProjectTemplate[]>('/projects/templates', {
      params: { type },
    });
    return response.data;
  },

  async getProjectTemplate(id: string) {
    const response = await api.get<ProjectTemplate>(`/projects/templates/${id}`);
    return response.data;
  },

  async createFromTemplate(templateId: string, data: CreateProjectData) {
    const response = await api.post<Project>('/projects/from-template', {
      templateId,
      ...data,
    });
    return response.data;
  },

  // Reports
  async getProjectReport(id: string) {
    const response = await api.get(`/projects/${id}/report`);
    return response.data;
  },

  async exportProjectReport(id: string, format: 'pdf' | 'docx') {
    const response = await api.get(`/projects/${id}/export`, {
      params: { format },
      headers: { Accept: 'application/octet-stream' },
    });
    return response.data;
  },

  // Analytics
  async getProjectStats() {
    const response = await api.get('/projects/stats');
    return response.data;
  },

  async getProjectTimeline(id: string) {
    const response = await api.get(`/projects/${id}/timeline`);
    return response.data;
  },

  async getResourceAllocation(startDate: string, endDate: string) {
    const response = await api.get('/projects/resource-allocation', {
      params: { startDate, endDate },
    });
    return response.data;
  },

  // Bulk operations
  async bulkUpdateProjects(ids: string[], data: UpdateProjectData) {
    const response = await api.patch<{ updated: number }>('/projects/bulk', { ids, data });
    return response.data;
  },

  async bulkAssignManager(ids: string[], managerId: string) {
    const response = await api.post<{ updated: number }>('/projects/bulk/assign-manager', {
      ids,
      managerId,
    });
    return response.data;
  },
};
