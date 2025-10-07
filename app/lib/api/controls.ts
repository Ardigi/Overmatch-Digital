import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

export interface Control {
  id: string;
  code: string;
  name: string;
  description: string;
  type: 'preventive' | 'detective' | 'corrective' | 'compensating';
  category:
    | 'access_control'
    | 'change_management'
    | 'data_protection'
    | 'incident_response'
    | 'business_continuity'
    | 'vendor_management'
    | 'hr_security'
    | 'physical_security'
    | 'network_security'
    | 'other';
  frequency: 'continuous' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual' | 'as_needed';
  status: 'active' | 'inactive' | 'retired';
  frameworks: Framework[];
  ownerId: string;
  implementationDetails?: string;
  testingProcedures?: string;
  evidence?: string[];
  automationImplemented: boolean;
  automationDetails?: string;
  lastTestDate?: string;
  nextTestDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Framework {
  name: string;
  section: string;
  requirement?: string;
}

export interface ControlTest {
  id: string;
  controlId: string;
  testDate: string;
  testerName: string;
  testType: 'design' | 'operating';
  sampleSize?: number;
  sampleMethod?: string;
  testProcedures: string;
  testResults: string;
  status: 'passed' | 'failed' | 'passed_with_exceptions';
  exceptions?: string[];
  remediationRequired: boolean;
  remediationDetails?: string;
  evidenceCollected: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateControlDto {
  code: string;
  name: string;
  description: string;
  type: Control['type'];
  category: Control['category'];
  frequency: Control['frequency'];
  frameworks: Framework[];
  ownerId: string;
  implementationDetails?: string;
  testingProcedures?: string;
  automationImplemented?: boolean;
  automationDetails?: string;
}

export interface UpdateControlDto extends Partial<CreateControlDto> {
  status?: Control['status'];
}

// API client functions
const controlsApi = {
  getAll: async (filters?: any): Promise<Control[]> => {
    const { data } = await axios.get(`${API_BASE_URL}/controls`, { params: filters });
    return data;
  },

  getById: async (id: string): Promise<Control> => {
    const { data } = await axios.get(`${API_BASE_URL}/controls/${id}`);
    return data;
  },

  getByCode: async (code: string): Promise<Control> => {
    const { data } = await axios.get(`${API_BASE_URL}/controls/code/${code}`);
    return data;
  },

  create: async (controlData: CreateControlDto): Promise<Control> => {
    const { data } = await axios.post(`${API_BASE_URL}/controls`, controlData);
    return data;
  },

  update: async (id: string, controlData: UpdateControlDto): Promise<Control> => {
    const { data } = await axios.patch(`${API_BASE_URL}/controls/${id}`, controlData);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await axios.delete(`${API_BASE_URL}/controls/${id}`);
  },

  getTests: async (controlId: string): Promise<ControlTest[]> => {
    const { data } = await axios.get(`${API_BASE_URL}/controls/${controlId}/tests`);
    return data;
  },

  createTest: async (controlId: string, testData: Partial<ControlTest>): Promise<ControlTest> => {
    const { data } = await axios.post(`${API_BASE_URL}/controls/${controlId}/tests`, testData);
    return data;
  },

  getByFramework: async (framework: string): Promise<Control[]> => {
    const { data } = await axios.get(`${API_BASE_URL}/controls/framework/${framework}`);
    return data;
  },
};

// React Query hooks
export const useControls = (filters?: any) => {
  return useQuery({
    queryKey: ['controls', filters],
    queryFn: () => controlsApi.getAll(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useControl = (id: string) => {
  return useQuery({
    queryKey: ['controls', id],
    queryFn: () => controlsApi.getById(id),
    enabled: !!id,
  });
};

export const useControlByCode = (code: string) => {
  return useQuery({
    queryKey: ['controls', 'code', code],
    queryFn: () => controlsApi.getByCode(code),
    enabled: !!code,
  });
};

export const useCreateControl = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: controlsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['controls'] });
    },
  });
};

export const useUpdateControl = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateControlDto }) =>
      controlsApi.update(id, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['controls'] });
      queryClient.invalidateQueries({ queryKey: ['controls', data.id] });
    },
  });
};

export const useDeleteControl = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: controlsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['controls'] });
    },
  });
};

export const useControlTests = (controlId: string) => {
  return useQuery({
    queryKey: ['controls', controlId, 'tests'],
    queryFn: () => controlsApi.getTests(controlId),
    enabled: !!controlId,
  });
};

export const useCreateControlTest = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ controlId, data }: { controlId: string; data: Partial<ControlTest> }) =>
      controlsApi.createTest(controlId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['controls', variables.controlId, 'tests'] });
    },
  });
};

export const useControlsByFramework = (framework: string) => {
  return useQuery({
    queryKey: ['controls', 'framework', framework],
    queryFn: () => controlsApi.getByFramework(framework),
    enabled: !!framework,
  });
};
