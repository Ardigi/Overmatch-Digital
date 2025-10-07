import { api } from './client-instance';

export interface Control {
  id: string;
  code: string; // Backend uses 'code' instead of 'controlId'
  name: string; // Backend uses 'name' instead of 'title'
  description?: string;
  category: string;
  framework: string; // Backend returns uppercase strings like 'SOC2_SECURITY'
  type: 'PREVENTIVE' | 'DETECTIVE' | 'CORRECTIVE';
  frequency: 'CONTINUOUS' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY' | 'AS_NEEDED';
  status: 'NOT_IMPLEMENTED' | 'PARTIALLY_IMPLEMENTED' | 'IMPLEMENTED' | 'NOT_APPLICABLE';
  effectiveness?: 'NOT_TESTED' | 'INEFFECTIVE' | 'PARTIALLY_EFFECTIVE' | 'EFFECTIVE';
  ownerId?: string;
  owner?: {
    id: string;
    name: string;
    email: string;
  };
  implementationDate?: string;
  testing?: {
    lastTested?: string;
    nextTestDate?: string;
    testResult?: string;
  };
  evidence?: Array<{
    id: string;
    type: string;
    description: string;
    url?: string;
  }>;
  metadata?: {
    evidenceCount?: number;
    testCount?: number;
    gapCount?: number;
    [key: string]: any;
  };
  relatedPolicies?: string[];
  relatedRisks?: string[];
  tags?: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
  // Frontend compatibility fields (will be mapped from backend)
  controlId?: string; // Maps from 'code'
  title?: string; // Maps from 'name'
  lastTestDate?: string; // Maps from 'testing.lastTested'
  nextTestDate?: string; // Maps from 'testing.nextTestDate'
}

export interface ControlTest {
  id: string;
  controlId: string;
  testerId: string;
  testDate: string;
  sampleSize?: number;
  population?: number;
  methodology: 'inquiry' | 'observation' | 'inspection' | 'reperformance';
  result: 'pass' | 'fail' | 'partial';
  findings?: string;
  evidence?: Array<{
    id: string;
    name: string;
    url: string;
  }>;
  recommendations?: string;
  remediationPlan?: string;
  remediationDueDate?: string;
  status: 'planned' | 'in_progress' | 'completed' | 'reviewed';
}

export interface ControlGap {
  id: string;
  controlId: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  identifiedDate: string;
  dueDate?: string;
  status: 'open' | 'in_progress' | 'closed' | 'accepted';
  remediationPlan?: string;
  assignee?: {
    id: string;
    name: string;
    email: string;
  };
  notes?: string;
}

export interface CreateControlData {
  controlId: string;
  title: string;
  description: string;
  category: string;
  framework: Control['framework'];
  type: Control['type'];
  frequency: Control['frequency'];
  ownerId?: string;
  relatedPolicies?: string[];
  relatedRisks?: string[];
  tags?: string[];
  notes?: string;
}

export interface UpdateControlData extends Partial<CreateControlData> {
  status?: Control['status'];
  effectiveness?: Control['effectiveness'];
  implementationDate?: string;
  lastTestDate?: string;
  nextTestDate?: string;
}

export interface ControlFilters {
  search?: string;
  framework?: Control['framework'];
  category?: string;
  type?: Control['type'];
  status?: Control['status'];
  effectiveness?: Control['effectiveness'];
  ownerId?: string;
  tags?: string[];
  testDueWithinDays?: number;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// Helper function to map backend control to frontend format
const mapControlFromBackend = (control: any): Control => {
  return {
    ...control,
    // Add frontend compatibility fields
    controlId: control.code,
    title: control.name,
    lastTestDate: control.testing?.lastTested,
    nextTestDate: control.testing?.nextTestDate,
  };
};

export const controlsApi = {
  // Controls
  async getControls(filters?: ControlFilters) {
    const response = await api.get<{ data: any[]; total: number }>('/api/v1/controls', {
      params: filters,
    });
    
    // Map backend data to frontend format
    const mappedData = response.data.data?.map(mapControlFromBackend) || [];
    
    return {
      data: mappedData,
      total: response.data.total,
    };
  },

  async getControl(id: string) {
    const response = await api.get<any>(`/api/v1/controls/${id}`);
    return mapControlFromBackend(response.data);
  },

  async createControl(data: CreateControlData) {
    const response = await api.post<Control>('/api/v1/controls', data);
    return response.data;
  },

  async updateControl(id: string, data: UpdateControlData) {
    const response = await api.patch<Control>(`/api/v1/controls/${id}`, data);
    return response.data;
  },

  async deleteControl(id: string) {
    await api.delete(`/api/v1/controls/${id}`);
  },

  // Control Tests
  async getControlTests(controlId: string) {
    const response = await api.get<ControlTest[]>(`/api/v1/controls/${controlId}/tests`);
    return response.data;
  },

  async createControlTest(
    controlId: string,
    data: Omit<ControlTest, 'id' | 'controlId' | 'status'>
  ) {
    const response = await api.post<ControlTest>(`/api/v1/controls/${controlId}/tests`, data);
    return response.data;
  },

  async updateControlTest(controlId: string, testId: string, data: Partial<ControlTest>) {
    const response = await api.patch<ControlTest>(`/api/v1/controls/${controlId}/tests/${testId}`, data);
    return response.data;
  },

  async completeControlTest(
    controlId: string,
    testId: string,
    result: ControlTest['result'],
    findings?: string
  ) {
    const response = await api.post<ControlTest>(
      `/api/v1/controls/${controlId}/tests/${testId}/complete`,
      {
        result,
        findings,
      }
    );
    return response.data;
  },

  // Control Gaps
  async getControlGaps(controlId?: string) {
    const response = await api.get<ControlGap[]>('/api/v1/controls/gaps', {
      params: { controlId },
    });
    return response.data;
  },

  async createControlGap(data: Omit<ControlGap, 'id' | 'status'>) {
    const response = await api.post<ControlGap>('/api/v1/controls/gaps', data);
    return response.data;
  },

  async updateControlGap(gapId: string, data: Partial<ControlGap>) {
    const response = await api.patch<ControlGap>(`/api/v1/controls/gaps/${gapId}`, data);
    return response.data;
  },

  async closeControlGap(gapId: string, notes?: string) {
    const response = await api.post<ControlGap>(`/api/v1/controls/gaps/${gapId}/close`, { notes });
    return response.data;
  },

  // Evidence
  async uploadEvidence(
    controlId: string,
    file: File,
    metadata?: { type: string; description: string }
  ) {
    const formData = new FormData();
    formData.append('file', file);
    if (metadata) {
      formData.append('metadata', JSON.stringify(metadata));
    }
    const response = await api.upload(`/api/v1/controls/${controlId}/evidence`, formData);
    return response.data;
  },

  async deleteEvidence(controlId: string, evidenceId: string) {
    await api.delete(`/api/v1/controls/${controlId}/evidence/${evidenceId}`);
  },

  // Control Matrix
  async getControlMatrix(framework?: Control['framework']) {
    const response = await api.get('/api/v1/controls/matrix', {
      params: { framework },
    });
    return response.data;
  },

  async importControlMatrix(framework: Control['framework'], file: File) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('framework', framework);
    const response = await api.upload('/api/v1/controls/matrix/import', formData);
    return response.data;
  },

  // Bulk operations
  async bulkUpdateControls(ids: string[], data: UpdateControlData) {
    const response = await api.patch<{ updated: number }>('/api/v1/controls/bulk', { ids, data });
    return response.data;
  },

  async bulkTestControls(ids: string[], testData: Partial<ControlTest>) {
    const response = await api.post<{ created: number }>('/api/v1/controls/bulk/test', { ids, testData });
    return response.data;
  },

  async bulkImportControls(formData: FormData) {
    const response = await api.post<{ imported: number; errors?: any[] }>('/api/v1/controls/bulk/import', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // Reports
  async getControlsReport(filters?: ControlFilters) {
    const response = await api.get('/api/v1/controls/report', { params: filters });
    return response.data;
  },

  async exportControlsReport(format: 'pdf' | 'xlsx' | 'csv', filters?: ControlFilters) {
    const response = await api.get('/api/v1/controls/export', {
      params: { format, ...filters },
      headers: { Accept: 'application/octet-stream' },
    });
    return response.data;
  },

  // Analytics
  async getControlStats() {
    const response = await api.get('/api/v1/controls/stats');
    return response.data;
  },

  async getTestingCalendar(year: number, month: number) {
    const response = await api.get('/api/v1/controls/testing-calendar', {
      params: { year, month },
    });
    return response.data;
  },
};
