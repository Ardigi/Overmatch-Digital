import { useEffect, useState } from 'react';
import {
  type Activity,
  type ComplianceMetrics,
  type DashboardStats,
  dashboardApi,
  type UpcomingTask,
} from '@/lib/api/dashboard';
import { useApi } from '../useApi';

// Dashboard stats hook - Only run on client side
export function useDashboardStats(options?: any) {
  const [isClient, setIsClient] = useState(false);
  
  useEffect(() => {
    setIsClient(true);
  }, []);
  
  return useApi<DashboardStats>(() => dashboardApi.getStats(), [], { 
    immediate: isClient, 
    ...options 
  });
}

// Compliance metrics hook
export function useComplianceMetrics(options?: any) {
  return useApi<ComplianceMetrics[]>(() => dashboardApi.getComplianceMetrics(), [], {
    immediate: true,
    ...options,
  });
}

// Recent activity hook
export function useRecentActivity(limit: number = 10, options?: any) {
  return useApi<Activity[]>(() => dashboardApi.getRecentActivity(limit), [limit], {
    immediate: true,
    ...options,
  });
}

// Upcoming tasks hook
export function useUpcomingTasks(limit: number = 10, options?: any) {
  return useApi<UpcomingTask[]>(() => dashboardApi.getUpcomingTasks(limit), [limit], {
    immediate: true,
    ...options,
  });
}

// Project timeline hook
export function useProjectTimeline(projectId: string, options?: any) {
  return useApi(() => dashboardApi.getProjectTimeline(projectId), [projectId], {
    immediate: !!projectId,
    ...options,
  });
}

// Risk heatmap hook
export function useRiskHeatmap(options?: any) {
  return useApi(() => dashboardApi.getRiskHeatmap(), [], { immediate: true, ...options });
}
