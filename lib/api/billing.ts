import { api } from './client-instance';

export interface Subscription {
  id: string;
  organizationId: string;
  planId: string;
  planName: string;
  status: 'active' | 'canceled' | 'past_due' | 'trial';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  trialEnd?: string;
  cancelAt?: string;
  canceledAt?: string;
  seats: number;
  pricePerSeat: number;
  totalAmount: number;
  billingInterval: 'monthly' | 'annual';
  features: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Invoice {
  id: string;
  organizationId: string;
  subscriptionId?: string;
  invoiceNumber: string;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'canceled';
  dueDate: string;
  paidAt?: string;
  subtotal: number;
  tax: number;
  total: number;
  currency: string;
  items: InvoiceItem[];
  paymentMethod?: PaymentMethod;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  type: 'subscription' | 'service' | 'addon';
}

export interface PaymentMethod {
  id: string;
  type: 'card' | 'ach' | 'wire';
  last4: string;
  brand?: string;
  expiryMonth?: number;
  expiryYear?: number;
  isDefault: boolean;
}

export interface BillingMetrics {
  mrr: number; // Monthly Recurring Revenue
  arr: number; // Annual Recurring Revenue
  totalRevenue: number;
  activeSubscriptions: number;
  churnRate: number;
  averageRevenuePerAccount: number;
  revenueGrowth: number;
  projectedAnnualRevenue: number;
}

export interface PricingCalculation {
  basePrice: number;
  complexityMultiplier: number;
  volumeDiscount: number;
  addOns: Array<{
    name: string;
    price: number;
  }>;
  subtotal: number;
  tax: number;
  total: number;
  savings?: number;
}

export const billingApi = {
  // Subscription management
  async getSubscription(): Promise<Subscription> {
    const response = await api.get<Subscription>('/billing/subscription');
    return response.data;
  },

  async updateSubscription(data: Partial<Subscription>): Promise<Subscription> {
    const response = await api.patch<Subscription>('/billing/subscription', data);
    return response.data;
  },

  async cancelSubscription(reason?: string): Promise<void> {
    await api.post('/billing/subscription/cancel', { reason });
  },

  async reactivateSubscription(): Promise<Subscription> {
    const response = await api.post<Subscription>('/billing/subscription/reactivate');
    return response.data;
  },

  // Invoices
  async getInvoices(params?: {
    status?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{ data: Invoice[]; total: number }> {
    const response = await api.get<{ data: Invoice[]; total: number }>('/billing/invoices', {
      params,
    });
    return response.data;
  },

  async getInvoice(id: string): Promise<Invoice> {
    const response = await api.get<Invoice>(`/billing/invoices/${id}`);
    return response.data;
  },

  async downloadInvoice(id: string): Promise<Blob> {
    const response = await api.get(`/billing/invoices/${id}/download`, {
      responseType: 'blob',
    });
    return response.data;
  },

  async payInvoice(id: string, paymentMethodId: string): Promise<Invoice> {
    const response = await api.post<Invoice>(`/billing/invoices/${id}/pay`, {
      paymentMethodId,
    });
    return response.data;
  },

  // Payment methods
  async getPaymentMethods(): Promise<PaymentMethod[]> {
    const response = await api.get<PaymentMethod[]>('/billing/payment-methods');
    return response.data;
  },

  async addPaymentMethod(data: any): Promise<PaymentMethod> {
    const response = await api.post<PaymentMethod>('/billing/payment-methods', data);
    return response.data;
  },

  async deletePaymentMethod(id: string): Promise<void> {
    await api.delete(`/billing/payment-methods/${id}`);
  },

  async setDefaultPaymentMethod(id: string): Promise<void> {
    await api.post(`/billing/payment-methods/${id}/set-default`);
  },

  // Billing metrics
  async getMetrics(): Promise<BillingMetrics> {
    const response = await api.get<BillingMetrics>('/billing/metrics');
    return response.data;
  },

  // Pricing calculator
  async calculatePricing(params: {
    auditType: 'soc1-type1' | 'soc1-type2' | 'soc2-type1' | 'soc2-type2';
    entityCount: number;
    locationCount: number;
    controlCount: number;
    complexity: 'low' | 'medium' | 'high';
    addOns: string[];
  }): Promise<PricingCalculation> {
    const response = await api.post<PricingCalculation>('/billing/calculate-pricing', params);
    return response.data;
  },

  // Usage tracking
  async getUsage(period?: { start: string; end: string }): Promise<any> {
    const response = await api.get('/billing/usage', { params: period });
    return response.data;
  },
};
