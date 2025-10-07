import { useCallback } from 'react';
import {
  type ControlFilters,
  type ControlTest,
  type CreateControlData,
  controlsApi,
  type UpdateControlData,
} from '@/lib/api/controls';
import { useApi, useMutation, usePaginatedApi } from '../useApi';

// Fetch controls with pagination
export function useControls(filters?: ControlFilters, options?: any) {
  return usePaginatedApi((params) => controlsApi.getControls(params), filters, options);
}

// Fetch single control
export function useControl(id: string, options?: any) {
  return useApi(() => controlsApi.getControl(id), [id], { immediate: !!id, ...options });
}

// Create control mutation
export function useCreateControl(options?: any) {
  return useMutation((data: CreateControlData) => controlsApi.createControl(data), options);
}

// Update control mutation
export function useUpdateControl(options?: any) {
  return useMutation(
    ({ id, data }: { id: string; data: UpdateControlData }) => controlsApi.updateControl(id, data),
    options
  );
}

// Delete control mutation
export function useDeleteControl(options?: any) {
  return useMutation((id: string) => controlsApi.deleteControl(id), options);
}

// Control tests
export function useControlTests(controlId: string, options?: any) {
  return useApi(() => controlsApi.getControlTests(controlId), [controlId], {
    immediate: !!controlId,
    ...options,
  });
}

export function useCreateControlTest(options?: any) {
  return useMutation(
    ({
      controlId,
      data,
    }: {
      controlId: string;
      data: Omit<ControlTest, 'id' | 'controlId' | 'status'>;
    }) => controlsApi.createControlTest(controlId, data),
    options
  );
}

export function useUpdateControlTest(options?: any) {
  return useMutation(
    ({
      controlId,
      testId,
      data,
    }: {
      controlId: string;
      testId: string;
      data: Partial<ControlTest>;
    }) => controlsApi.updateControlTest(controlId, testId, data),
    options
  );
}

export function useCompleteControlTest(options?: any) {
  return useMutation(
    ({
      controlId,
      testId,
      result,
      findings,
    }: {
      controlId: string;
      testId: string;
      result: ControlTest['result'];
      findings?: string;
    }) => controlsApi.completeControlTest(controlId, testId, result, findings),
    options
  );
}

// Control gaps
export function useControlGaps(controlId?: string, options?: any) {
  return useApi(() => controlsApi.getControlGaps(controlId), [controlId], {
    immediate: true,
    ...options,
  });
}

export function useCreateControlGap(options?: any) {
  return useMutation(
    (data: Parameters<typeof controlsApi.createControlGap>[0]) =>
      controlsApi.createControlGap(data),
    options
  );
}

export function useUpdateControlGap(options?: any) {
  return useMutation(
    ({
      gapId,
      data,
    }: {
      gapId: string;
      data: Parameters<typeof controlsApi.updateControlGap>[1];
    }) => controlsApi.updateControlGap(gapId, data),
    options
  );
}

export function useCloseControlGap(options?: any) {
  return useMutation(
    ({ gapId, notes }: { gapId: string; notes?: string }) =>
      controlsApi.closeControlGap(gapId, notes),
    options
  );
}

// Evidence
export function useUploadControlEvidence(options?: any) {
  return useMutation(
    ({
      controlId,
      file,
      metadata,
    }: {
      controlId: string;
      file: File;
      metadata?: { type: string; description: string };
    }) => controlsApi.uploadEvidence(controlId, file, metadata),
    options
  );
}

export function useDeleteControlEvidence(options?: any) {
  return useMutation(
    ({ controlId, evidenceId }: { controlId: string; evidenceId: string }) =>
      controlsApi.deleteEvidence(controlId, evidenceId),
    options
  );
}

// Control matrix
export function useControlMatrix(framework?: any, options?: any) {
  return useApi(() => controlsApi.getControlMatrix(framework), [framework], {
    immediate: true,
    ...options,
  });
}

export function useImportControlMatrix(options?: any) {
  return useMutation(
    ({ framework, file }: { framework: any; file: File }) =>
      controlsApi.importControlMatrix(framework, file),
    options
  );
}

// Bulk operations
export function useBulkUpdateControls(options?: any) {
  return useMutation(
    ({ ids, data }: { ids: string[]; data: UpdateControlData }) =>
      controlsApi.bulkUpdateControls(ids, data),
    options
  );
}

export function useBulkTestControls(options?: any) {
  return useMutation(
    ({ ids, testData }: { ids: string[]; testData: Partial<ControlTest> }) =>
      controlsApi.bulkTestControls(ids, testData),
    options
  );
}

export function useBulkImportControls(options?: any) {
  return useMutation(
    (formData: FormData) => controlsApi.bulkImportControls(formData),
    options
  );
}

// Reports
export function useControlsReport(filters?: ControlFilters, options?: any) {
  return useApi(() => controlsApi.getControlsReport(filters), [filters], {
    immediate: true,
    ...options,
  });
}

export function useExportControlsReport() {
  const exportReport = useCallback(
    async (format: 'pdf' | 'xlsx' | 'csv', filters?: ControlFilters) => {
      try {
        const blob = await controlsApi.exportControlsReport(format, filters);
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `controls-report.${format}`;
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

  return { exportReport };
}

// Analytics
export function useControlStats(options?: any) {
  return useApi(() => controlsApi.getControlStats(), [], { immediate: true, ...options });
}

export function useTestingCalendar(year: number, month: number, options?: any) {
  return useApi(() => controlsApi.getTestingCalendar(year, month), [year, month], {
    immediate: true,
    ...options,
  });
}
