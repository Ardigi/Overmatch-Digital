import { useCallback } from 'react';
import {
  Client,
  type ClientFilters,
  type CreateClientData,
  clientsApi,
  type UpdateClientData,
} from '@/lib/api/clients';
import { useApi, useMutation, usePaginatedApi } from '../useApi';

// Fetch all clients with pagination
export function useClients(filters?: ClientFilters, options?: any) {
  return usePaginatedApi((params) => clientsApi.getClients(params), filters, options);
}

// Fetch single client
export function useClient(id: string, options?: any) {
  return useApi(() => clientsApi.getClient(id), [id], { immediate: !!id, ...options });
}

// Create client mutation
export function useCreateClient(options?: any) {
  return useMutation((data: CreateClientData) => clientsApi.createClient(data), options);
}

// Update client mutation
export function useUpdateClient(options?: any) {
  return useMutation(
    ({ id, data }: { id: string; data: UpdateClientData }) => clientsApi.updateClient(id, data),
    options
  );
}

// Delete client mutation
export function useDeleteClient(options?: any) {
  return useMutation((id: string) => clientsApi.deleteClient(id), options);
}

// Bulk operations
export function useBulkUpdateClients(options?: any) {
  return useMutation(
    ({ ids, data }: { ids: string[]; data: UpdateClientData }) =>
      clientsApi.bulkUpdateClients(ids, data),
    options
  );
}

export function useBulkDeleteClients(options?: any) {
  return useMutation((ids: string[]) => clientsApi.bulkDeleteClients(ids), options);
}

// Client stats
export function useClientStats(options?: any) {
  return useApi(() => clientsApi.getClientStats(), [], { immediate: true, ...options });
}

// Export clients
export function useExportClients() {
  const exportClients = useCallback(async (format: 'csv' | 'xlsx', filters?: ClientFilters) => {
    try {
      const blob = await clientsApi.exportClients(format, filters);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `clients.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Export failed:', error);
      throw error;
    }
  }, []);

  return { exportClients };
}

// Import clients
export function useImportClients(options?: any) {
  return useMutation((file: File) => clientsApi.importClients(file), options);
}

// Client contacts
export function useClientContacts(clientId: string, options?: any) {
  return useApi(() => clientsApi.getContacts(clientId), [clientId], {
    immediate: !!clientId,
    ...options,
  });
}

export function useCreateContact(options?: any) {
  return useMutation(
    ({ clientId, data }: { clientId: string; data: any }) =>
      clientsApi.createContact(clientId, data),
    options
  );
}

export function useUpdateContact(options?: any) {
  return useMutation(
    ({ clientId, contactId, data }: { clientId: string; contactId: string; data: any }) =>
      clientsApi.updateContact(clientId, contactId, data),
    options
  );
}

export function useDeleteContact(options?: any) {
  return useMutation(
    ({ clientId, contactId }: { clientId: string; contactId: string }) =>
      clientsApi.deleteContact(clientId, contactId),
    options
  );
}

// Client projects
export function useClientProjects(clientId: string, options?: any) {
  return useApi(() => clientsApi.getProjects(clientId), [clientId], {
    immediate: !!clientId,
    ...options,
  });
}

// Client documents
export function useClientDocuments(clientId: string, options?: any) {
  return useApi(() => clientsApi.getDocuments(clientId), [clientId], {
    immediate: !!clientId,
    ...options,
  });
}

export function useUploadClientDocument(options?: any) {
  return useMutation(
    ({ clientId, file, metadata }: { clientId: string; file: File; metadata?: any }) =>
      clientsApi.uploadDocument(clientId, file, metadata),
    options
  );
}

export function useDeleteClientDocument(options?: any) {
  return useMutation(
    ({ clientId, documentId }: { clientId: string; documentId: string }) =>
      clientsApi.deleteDocument(clientId, documentId),
    options
  );
}
