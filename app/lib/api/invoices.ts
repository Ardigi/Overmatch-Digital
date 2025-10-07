import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

export interface Invoice {
  id: string;
  invoiceNumber: string;
  clientId: string;
  date: string;
  dueDate: string;
  amount: number;
  currency: string;
  status: 'draft' | 'sent' | 'paid' | 'pending' | 'overdue' | 'cancelled';
  description: string;
  lineItems: LineItem[];
  paymentTerms: string;
  notes?: string;
  pdfUrl?: string;
  paymentDate?: string;
  paymentMethod?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  taxRate?: number;
  taxAmount?: number;
}

export interface CreateInvoiceDto {
  clientId: string;
  date: string;
  dueDate: string;
  amount: number;
  currency: string;
  description: string;
  lineItems: Omit<LineItem, 'id'>[];
  paymentTerms: string;
  notes?: string;
}

export interface UpdateInvoiceDto extends Partial<CreateInvoiceDto> {
  status?: Invoice['status'];
  paymentDate?: string;
  paymentMethod?: string;
}

export interface PaymentInfo {
  invoiceId: string;
  paymentDate: string;
  paymentMethod: string;
  transactionId?: string;
  notes?: string;
}

// API client functions
const invoicesApi = {
  getAll: async (clientId?: string): Promise<Invoice[]> => {
    const { data } = await axios.get(`${API_BASE_URL}/invoices`, {
      params: clientId ? { clientId } : undefined,
    });
    return data;
  },

  getById: async (id: string): Promise<Invoice> => {
    const { data } = await axios.get(`${API_BASE_URL}/invoices/${id}`);
    return data;
  },

  create: async (invoiceData: CreateInvoiceDto): Promise<Invoice> => {
    const { data } = await axios.post(`${API_BASE_URL}/invoices`, invoiceData);
    return data;
  },

  update: async (id: string, invoiceData: UpdateInvoiceDto): Promise<Invoice> => {
    const { data } = await axios.patch(`${API_BASE_URL}/invoices/${id}`, invoiceData);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await axios.delete(`${API_BASE_URL}/invoices/${id}`);
  },

  markAsSent: async (id: string): Promise<Invoice> => {
    const { data } = await axios.post(`${API_BASE_URL}/invoices/${id}/send`);
    return data;
  },

  recordPayment: async (paymentInfo: PaymentInfo): Promise<Invoice> => {
    const { data } = await axios.post(
      `${API_BASE_URL}/invoices/${paymentInfo.invoiceId}/payment`,
      paymentInfo
    );
    return data;
  },

  cancelInvoice: async (id: string, reason: string): Promise<Invoice> => {
    const { data } = await axios.post(`${API_BASE_URL}/invoices/${id}/cancel`, { reason });
    return data;
  },

  generatePdf: async (id: string): Promise<{ url: string }> => {
    const { data } = await axios.post(`${API_BASE_URL}/invoices/${id}/generate-pdf`);
    return data;
  },

  downloadPdf: async (id: string): Promise<Blob> => {
    const { data } = await axios.get(`${API_BASE_URL}/invoices/${id}/download`, {
      responseType: 'blob',
    });
    return data;
  },
};

// React Query hooks
export const useInvoices = (clientId?: string) => {
  return useQuery({
    queryKey: ['invoices', clientId],
    queryFn: () => invoicesApi.getAll(clientId),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useInvoice = (id: string) => {
  return useQuery({
    queryKey: ['invoices', id],
    queryFn: () => invoicesApi.getById(id),
    enabled: !!id,
  });
};

export const useCreateInvoice = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: invoicesApi.create,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoices', data.clientId] });
    },
  });
};

export const useUpdateInvoice = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateInvoiceDto }) =>
      invoicesApi.update(id, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoices', data.id] });
      queryClient.invalidateQueries({ queryKey: ['invoices', data.clientId] });
    },
  });
};

export const useMarkInvoiceAsSent = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: invoicesApi.markAsSent,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoices', data.id] });
    },
  });
};

export const useRecordPayment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: invoicesApi.recordPayment,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoices', data.id] });
      queryClient.invalidateQueries({ queryKey: ['invoices', data.clientId] });
    },
  });
};

export const useCancelInvoice = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      invoicesApi.cancelInvoice(id, reason),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoices', data.id] });
    },
  });
};

export const useGenerateInvoicePdf = () => {
  return useMutation({
    mutationFn: invoicesApi.generatePdf,
  });
};

export const useDownloadInvoicePdf = () => {
  return useMutation({
    mutationFn: async (id: string) => {
      const blob = await invoicesApi.downloadPdf(id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${id}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    },
  });
};
