'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useComplianceMetrics } from '@/hooks/api/useDashboard';

export default function ComplianceStatusChart() {
  const { data: metrics, loading } = useComplianceMetrics();

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <LoadingSpinner />
      </div>
    );
  }

  // Transform API data into chart format
  const controlsData =
    metrics?.map((m) => ({
      category: m.frameworkName,
      implemented: m.implementedControls,
      partial: m.inProgressControls,
      notImplemented: m.notStartedControls,
    })) || [];

  // Calculate overall status
  const totalImplemented = metrics?.reduce((sum, m) => sum + m.implementedControls, 0) || 0;
  const totalPartial = metrics?.reduce((sum, m) => sum + m.inProgressControls, 0) || 0;
  const totalNotImplemented = metrics?.reduce((sum, m) => sum + m.notStartedControls, 0) || 0;

  const overallStatus = [
    { name: 'Implemented', value: totalImplemented, color: '#10b981' },
    { name: 'In Progress', value: totalPartial, color: '#f59e0b' },
    { name: 'Not Started', value: totalNotImplemented, color: '#ef4444' },
  ];
  return (
    <div className="space-y-6">
      {/* Overall Status Pie Chart */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">Overall Control Status</h3>
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={overallStatus}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
              {overallStatus.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Controls by Category Bar Chart */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">
          Controls by Trust Service Criteria
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={controlsData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="category" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="implemented" stackId="a" fill="#10b981" name="Implemented" />
            <Bar dataKey="partial" stackId="a" fill="#f59e0b" name="In Progress" />
            <Bar dataKey="notImplemented" stackId="a" fill="#ef4444" name="Not Started" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
