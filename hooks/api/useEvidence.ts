import {
  type CreateEvidenceData,
  type Evidence,
  type EvidenceFilters,
  type EvidenceRequest,
  type EvidenceTemplate,
  evidenceApi,
  type UpdateEvidenceData,
} from '@/lib/api/evidence';
import { useApi, useMutation, usePaginatedApi } from '../useApi';

// Evidence hooks
export function useEvidence(filters?: EvidenceFilters, options?: any) {
  return usePaginatedApi(
    (params) => evidenceApi.getEvidence({ ...filters, ...params }),
    filters,
    options
  );
}

export function useEvidenceById(id: string, options?: any) {
  return useApi<Evidence>(() => evidenceApi.getEvidenceById(id), [id], {
    immediate: !!id,
    ...options,
  });
}

export function useCreateEvidence(options?: any) {
  return useMutation((data: CreateEvidenceData) => evidenceApi.createEvidence(data), options);
}

export function useUpdateEvidence(options?: any) {
  return useMutation(
    ({ id, data }: { id: string; data: UpdateEvidenceData }) =>
      evidenceApi.updateEvidence(id, data),
    options
  );
}

export function useDeleteEvidence(options?: any) {
  return useMutation((id: string) => evidenceApi.deleteEvidence(id), options);
}

export function useUploadEvidence(options?: any) {
  return useMutation(
    ({
      file,
      metadata,
      onProgress,
    }: {
      file: File;
      metadata: CreateEvidenceData;
      onProgress?: (progress: number) => void;
    }) => evidenceApi.uploadEvidence(file, metadata, onProgress),
    options
  );
}

export function useApproveEvidence(options?: any) {
  return useMutation(
    ({ id, notes }: { id: string; notes?: string }) => evidenceApi.approveEvidence(id, notes),
    options
  );
}

export function useRejectEvidence(options?: any) {
  return useMutation(
    ({ id, reason }: { id: string; reason: string }) => evidenceApi.rejectEvidence(id, reason),
    options
  );
}

// Evidence Request hooks
export function useEvidenceRequests(filters?: any, options?: any) {
  return useApi<EvidenceRequest[]>(() => evidenceApi.getEvidenceRequests(filters), [filters], {
    immediate: true,
    ...options,
  });
}

export function useEvidenceRequest(id: string, options?: any) {
  return useApi<EvidenceRequest>(() => evidenceApi.getEvidenceRequest(id), [id], {
    immediate: !!id,
    ...options,
  });
}

export function useCreateEvidenceRequest(options?: any) {
  return useMutation(
    (data: Omit<EvidenceRequest, 'id' | 'status' | 'createdAt' | 'updatedAt'>) =>
      evidenceApi.createEvidenceRequest(data),
    options
  );
}

export function useUpdateEvidenceRequest(options?: any) {
  return useMutation(
    ({ id, data }: { id: string; data: Partial<EvidenceRequest> }) =>
      evidenceApi.updateEvidenceRequest(id, data),
    options
  );
}

export function useAssignEvidenceRequest(options?: any) {
  return useMutation(
    ({ id, assigneeId }: { id: string; assigneeId: string }) =>
      evidenceApi.assignEvidenceRequest(id, assigneeId),
    options
  );
}

export function useCompleteEvidenceRequest(options?: any) {
  return useMutation(
    ({ id, evidenceIds }: { id: string; evidenceIds: string[] }) =>
      evidenceApi.completeEvidenceRequest(id, evidenceIds),
    options
  );
}

// Template hooks
export function useEvidenceTemplates(category?: Evidence['category'], options?: any) {
  return useApi<EvidenceTemplate[]>(() => evidenceApi.getEvidenceTemplates(category), [category], {
    immediate: true,
    ...options,
  });
}

export function useEvidenceTemplate(id: string, options?: any) {
  return useApi<EvidenceTemplate>(() => evidenceApi.getEvidenceTemplate(id), [id], {
    immediate: !!id,
    ...options,
  });
}

// Bulk operation hooks
export function useBulkUploadEvidence(options?: any) {
  return useMutation(
    ({ files, defaultMetadata }: { files: File[]; defaultMetadata: Partial<CreateEvidenceData> }) =>
      evidenceApi.bulkUploadEvidence(files, defaultMetadata),
    options
  );
}

export function useBulkUpdateEvidence(options?: any) {
  return useMutation(
    ({ ids, data }: { ids: string[]; data: UpdateEvidenceData }) =>
      evidenceApi.bulkUpdateEvidence(ids, data),
    options
  );
}

export function useBulkDeleteEvidence(options?: any) {
  return useMutation((ids: string[]) => evidenceApi.bulkDeleteEvidence(ids), options);
}

// Analytics hooks
export function useEvidenceStats(options?: any) {
  return useApi(() => evidenceApi.getEvidenceStats(), [], { immediate: true, ...options });
}

export function useEvidenceCoverage(type: 'control' | 'policy' | 'project', options?: any) {
  return useApi(() => evidenceApi.getEvidenceCoverage(type), [type], {
    immediate: true,
    ...options,
  });
}

export function useExpiringEvidence(days: number = 30, options?: any) {
  return useApi<Evidence[]>(() => evidenceApi.getExpiringEvidence(days), [days], {
    immediate: true,
    ...options,
  });
}
