import {
  type BillingMetrics,
  billingApi,
  type Invoice,
  type PaymentMethod,
  type PricingCalculation,
  type Subscription,
} from '@/lib/api/billing';
import { useApi, useMutation, usePaginatedApi } from '../useApi';

// Subscription hooks
export function useSubscription(options?: any) {
  return useApi<Subscription>(() => billingApi.getSubscription(), [], {
    immediate: true,
    ...options,
  });
}

export function useUpdateSubscription(options?: any) {
  return useMutation((data: Partial<Subscription>) => billingApi.updateSubscription(data), options);
}

export function useCancelSubscription(options?: any) {
  return useMutation((reason?: string) => billingApi.cancelSubscription(reason), options);
}

export function useReactivateSubscription(options?: any) {
  return useMutation(() => billingApi.reactivateSubscription(), options);
}

// Invoice hooks
export function useInvoices(params?: any, options?: any) {
  return usePaginatedApi(
    (paginationParams) => billingApi.getInvoices({ ...params, ...paginationParams }),
    params,
    options
  );
}

export function useInvoice(id: string, options?: any) {
  return useApi<Invoice>(() => billingApi.getInvoice(id), [id], { immediate: !!id, ...options });
}

export function useDownloadInvoice() {
  return useMutation(async (id: string) => {
    const blob = await billingApi.downloadInvoice(id);
    // Create download link
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `invoice-${id}.pdf`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  });
}

export function usePayInvoice(options?: any) {
  return useMutation(
    ({ id, paymentMethodId }: { id: string; paymentMethodId: string }) =>
      billingApi.payInvoice(id, paymentMethodId),
    options
  );
}

// Payment method hooks
export function usePaymentMethods(options?: any) {
  return useApi<PaymentMethod[]>(() => billingApi.getPaymentMethods(), [], {
    immediate: true,
    ...options,
  });
}

export function useAddPaymentMethod(options?: any) {
  return useMutation((data: any) => billingApi.addPaymentMethod(data), options);
}

export function useDeletePaymentMethod(options?: any) {
  return useMutation((id: string) => billingApi.deletePaymentMethod(id), options);
}

export function useSetDefaultPaymentMethod(options?: any) {
  return useMutation((id: string) => billingApi.setDefaultPaymentMethod(id), options);
}

// Metrics hook
export function useBillingMetrics(options?: any) {
  return useApi<BillingMetrics>(() => billingApi.getMetrics(), [], { immediate: true, ...options });
}

// Pricing calculator hook
export function usePricingCalculator(options?: any) {
  return useMutation<PricingCalculation, any>(
    (params: Parameters<typeof billingApi.calculatePricing>[0]) =>
      billingApi.calculatePricing(params),
    options
  );
}

// Usage tracking hook
export function useBillingUsage(period?: { start: string; end: string }, options?: any) {
  return useApi(() => billingApi.getUsage(period), [period?.start, period?.end], {
    immediate: true,
    ...options,
  });
}
