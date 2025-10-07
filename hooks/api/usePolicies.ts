import { useCallback } from 'react';
import {
  type CreatePolicyData,
  type PolicyFilters,
  policiesApi,
  type UpdatePolicyData,
} from '@/lib/api/policies';
import { useApi, useMutation, usePaginatedApi } from '../useApi';

// Fetch policies with pagination
export function usePolicies(filters?: PolicyFilters, options?: any) {
  return usePaginatedApi((params) => policiesApi.getPolicies(params), filters, options);
}

// Fetch single policy
export function usePolicy(id: string, options?: any) {
  return useApi(() => policiesApi.getPolicy(id), [id], { immediate: !!id, ...options });
}

// Create policy mutation
export function useCreatePolicy(options?: any) {
  return useMutation((data: CreatePolicyData) => policiesApi.createPolicy(data), options);
}

// Update policy mutation
export function useUpdatePolicy(options?: any) {
  return useMutation(
    ({ id, data }: { id: string; data: UpdatePolicyData }) => policiesApi.updatePolicy(id, data),
    options
  );
}

// Delete policy mutation
export function useDeletePolicy(options?: any) {
  return useMutation((id: string) => policiesApi.deletePolicy(id), options);
}

// Archive policy mutation
export function useArchivePolicy(options?: any) {
  return useMutation((id: string) => policiesApi.archivePolicy(id), options);
}

// Publish policy mutation
export function usePublishPolicy(options?: any) {
  return useMutation((id: string) => policiesApi.publishPolicy(id), options);
}

// Policy templates
export function usePolicyTemplates(framework?: string, options?: any) {
  return useApi(() => policiesApi.getTemplates(framework), [framework], {
    immediate: true,
    ...options,
  });
}

export function usePolicyTemplate(id: string, options?: any) {
  return useApi(() => policiesApi.getTemplate(id), [id], { immediate: !!id, ...options });
}

export function usePreviewTemplate(options?: any) {
  return useMutation(
    ({ id, variables }: { id: string; variables: Record<string, any> }) =>
      policiesApi.previewTemplate(id, variables),
    options
  );
}

// Policy reviews
export function useStartPolicyReview(options?: any) {
  return useMutation(
    ({ policyId, reviewerId }: { policyId: string; reviewerId: string }) =>
      policiesApi.startReview(policyId, reviewerId),
    options
  );
}

export function useUpdatePolicyReview(options?: any) {
  return useMutation(
    ({ policyId, reviewId, data }: { policyId: string; reviewId: string; data: any }) =>
      policiesApi.updateReview(policyId, reviewId, data),
    options
  );
}

export function useCompletePolicyReview(options?: any) {
  return useMutation(
    ({ policyId, reviewId, findings }: { policyId: string; reviewId: string; findings: any[] }) =>
      policiesApi.completeReview(policyId, reviewId, findings),
    options
  );
}

// Policy approvals
export function useApprovals(filters?: any, options?: any) {
  return useApi(() => policiesApi.getApprovals(filters), [filters], {
    immediate: true,
    ...options,
  });
}

export function useRequestPolicyApproval(options?: any) {
  return useMutation(
    ({ policyId, approverIds }: { policyId: string; approverIds: string[] }) =>
      policiesApi.requestApproval(policyId, approverIds),
    options
  );
}

export function useApprovePolicy(options?: any) {
  return useMutation(
    ({
      policyId,
      approvalId,
      comments,
    }: {
      policyId: string;
      approvalId: string;
      comments?: string;
    }) => policiesApi.approvePolicy(policyId, approvalId, comments),
    options
  );
}

export function useRejectPolicy(options?: any) {
  return useMutation(
    ({
      policyId,
      approvalId,
      comments,
    }: {
      policyId: string;
      approvalId: string;
      comments: string;
    }) => policiesApi.rejectPolicy(policyId, approvalId, comments),
    options
  );
}

// Bulk operations
export function useBulkUpdatePolicies(options?: any) {
  return useMutation(
    ({ ids, data }: { ids: string[]; data: UpdatePolicyData }) =>
      policiesApi.bulkUpdatePolicies(ids, data),
    options
  );
}

export function useBulkArchivePolicies(options?: any) {
  return useMutation((ids: string[]) => policiesApi.bulkArchivePolicies(ids), options);
}

// Export policies
export function useExportPolicies() {
  const exportPolicies = useCallback(
    async (format: 'pdf' | 'docx' | 'csv', filters?: PolicyFilters) => {
      try {
        const blob = await policiesApi.exportPolicies(format, filters);
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `policies.${format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } catch (error) {
        console.error('Export failed:', error);
        throw error;
      }
    },
    []
  );

  return { exportPolicies };
}

// Policy attachments
export function useUploadPolicyAttachment(options?: any) {
  return useMutation(
    ({ policyId, file }: { policyId: string; file: File }) =>
      policiesApi.uploadAttachment(policyId, file),
    options
  );
}

export function useDeletePolicyAttachment(options?: any) {
  return useMutation(
    ({ policyId, attachmentId }: { policyId: string; attachmentId: string }) =>
      policiesApi.deleteAttachment(policyId, attachmentId),
    options
  );
}

// Policy revisions
export function usePolicyRevisions(policyId: string, options?: any) {
  return useApi(() => policiesApi.getPolicyRevisions(policyId), [policyId], {
    immediate: !!policyId,
    ...options,
  });
}

// Policy controls
export function usePolicyControls(policyId: string, options?: any) {
  return useApi(() => policiesApi.getPolicyControls(policyId), [policyId], {
    immediate: !!policyId,
    ...options,
  });
}

export function useLinkPolicyControls(options?: any) {
  return useMutation(
    ({ policyId, controlIds }: { policyId: string; controlIds: string[] }) =>
      policiesApi.linkControls(policyId, controlIds),
    options
  );
}

export function useUnlinkPolicyControl(options?: any) {
  return useMutation(
    ({ policyId, controlId }: { policyId: string; controlId: string }) =>
      policiesApi.unlinkControl(policyId, controlId),
    options
  );
}

// Policy analytics
export function usePolicyStats(options?: any) {
  return useApi(() => policiesApi.getPolicyStats(), [], { immediate: true, ...options });
}

export function useComplianceMatrix(options?: any) {
  return useApi(() => policiesApi.getComplianceMatrix(), [], { immediate: true, ...options });
}
