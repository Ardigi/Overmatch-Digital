import { api } from './client-instance';

export interface DashboardStats {
  activeProjects: number;
  pendingEvidence: number;
  openFindings: number;
  upcomingDeadlines: number;
}

export interface ComplianceMetrics {
  frameworkId: string;
  frameworkName: string;
  totalControls: number;
  implementedControls: number;
  inProgressControls: number;
  notStartedControls: number;
  compliancePercentage: number;
}

export interface Activity {
  id: string;
  type:
    | 'project_created'
    | 'evidence_submitted'
    | 'control_updated'
    | 'finding_created'
    | 'report_generated';
  title: string;
  description: string;
  userId: string;
  userName: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface UpcomingTask {
  id: string;
  title: string;
  type: 'evidence_collection' | 'control_review' | 'report_submission' | 'audit_meeting';
  dueDate: string;
  priority: 'high' | 'medium' | 'low';
  assigneeId?: string;
  assigneeName?: string;
  projectId?: string;
  projectName?: string;
  status: 'pending' | 'in_progress' | 'overdue';
}

export const dashboardApi = {
  // Get dashboard statistics
  async getStats(): Promise<DashboardStats> {
    const response = await api.get<DashboardStats>('/dashboard/stats');
    return response.data;
  },

  // Get compliance metrics by framework
  async getComplianceMetrics(): Promise<ComplianceMetrics[]> {
    const response = await api.get<ComplianceMetrics[]>('/dashboard/compliance-metrics');
    return response.data;
  },

  // Get recent activity
  async getRecentActivity(limit: number = 10): Promise<Activity[]> {
    const response = await api.get<Activity[]>('/dashboard/activity', {
      params: { limit },
    });
    return response.data;
  },

  // Get upcoming tasks
  async getUpcomingTasks(limit: number = 10): Promise<UpcomingTask[]> {
    const response = await api.get<UpcomingTask[]>('/dashboard/tasks', {
      params: { limit },
    });
    return response.data;
  },

  // Get project timeline data
  async getProjectTimeline(projectId: string): Promise<any> {
    const response = await api.get(`/dashboard/projects/${projectId}/timeline`);
    return response.data;
  },

  // Get risk heatmap data
  async getRiskHeatmap(): Promise<any> {
    const response = await api.get('/dashboard/risk-heatmap');
    return response.data;
  },
};
