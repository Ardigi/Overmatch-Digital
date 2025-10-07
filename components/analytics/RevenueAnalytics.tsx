'use client';

import {
  ArrowDownIcon,
  ArrowUpIcon,
  CalendarIcon,
  ChartBarIcon,
  CurrencyDollarIcon,
  DocumentTextIcon,
  TrendingUpIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import React from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export default function RevenueAnalytics() {
  // Revenue by service type
  const revenueByService = [
    { service: 'SOC 2 Type II', revenue: 1850000, clients: 45, avgDeal: 41111 },
    { service: 'SOC 2 Type I', revenue: 580000, clients: 20, avgDeal: 29000 },
    { service: 'SOC 1', revenue: 420000, clients: 15, avgDeal: 28000 },
    { service: 'Readiness Assessment', revenue: 240000, clients: 12, avgDeal: 20000 },
    { service: 'Consulting', revenue: 110000, clients: 8, avgDeal: 13750 },
  ];

  // Monthly recurring revenue
  const mrrTrend = [
    { month: 'Jan', mrr: 280000, growth: 5 },
    { month: 'Feb', mrr: 295000, growth: 5.4 },
    { month: 'Mar', mrr: 312000, growth: 5.8 },
    { month: 'Apr', mrr: 335000, growth: 7.4 },
    { month: 'May', mrr: 358000, growth: 6.9 },
    { month: 'Jun', mrr: 378000, growth: 5.6 },
    { month: 'Jul', mrr: 405000, growth: 7.1 },
  ];

  // Revenue by partner
  const partnerRevenue = [
    { name: 'Direct Sales', value: 1280000, percentage: 40 },
    { name: 'White-Label Partners', value: 960000, percentage: 30 },
    { name: 'Joint Ventures', value: 640000, percentage: 20 },
    { name: 'Referral Partners', value: 320000, percentage: 10 },
  ];

  // Customer lifetime value by segment
  const clvBySegment = [
    { segment: 'Enterprise', clv: 185000, customers: 15 },
    { segment: 'Mid-Market', clv: 125000, customers: 35 },
    { segment: 'SMB', clv: 65000, customers: 41 },
  ];

  // Revenue forecast
  const forecast = [
    { month: 'Aug', projected: 680000, optimistic: 720000, conservative: 640000 },
    { month: 'Sep', projected: 720000, optimistic: 770000, conservative: 670000 },
    { month: 'Oct', projected: 760000, optimistic: 820000, conservative: 700000 },
    { month: 'Nov', projected: 800000, optimistic: 870000, conservative: 730000 },
    { month: 'Dec', projected: 850000, optimistic: 930000, conservative: 770000 },
  ];

  const paymentMetrics = {
    avgCollectionDays: 28,
    overdueAmount: 105000,
    collectionRate: 96.5,
    avgInvoiceSize: 42500,
  };

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'];

  return (
    <div className="space-y-6">
      {/* Revenue KPIs */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <CurrencyDollarIcon className="h-8 w-8 text-green-600" />
            <div className="flex items-center gap-1 text-sm text-green-600">
              <ArrowUpIcon className="h-4 w-4" />
              <span>24%</span>
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">$3.2M</p>
          <p className="text-sm text-gray-600">Total Revenue YTD</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <ChartBarIcon className="h-8 w-8 text-blue-600" />
            <div className="flex items-center gap-1 text-sm text-green-600">
              <ArrowUpIcon className="h-4 w-4" />
              <span>7.1%</span>
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">$405K</p>
          <p className="text-sm text-gray-600">Monthly Recurring</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <UserGroupIcon className="h-8 w-8 text-purple-600" />
            <div className="flex items-center gap-1 text-sm text-green-600">
              <ArrowUpIcon className="h-4 w-4" />
              <span>15%</span>
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">$125K</p>
          <p className="text-sm text-gray-600">Avg Customer LTV</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <DocumentTextIcon className="h-8 w-8 text-yellow-600" />
            <div className="flex items-center gap-1 text-sm text-green-600">
              <ArrowUpIcon className="h-4 w-4" />
              <span>8%</span>
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">$42.5K</p>
          <p className="text-sm text-gray-600">Avg Deal Size</p>
        </div>
      </div>

      {/* Revenue by Service and MRR Trend */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue by Service</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={revenueByService}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="service" angle={-45} textAnchor="end" height={80} />
              <YAxis tickFormatter={(value) => `$${value / 1000}k`} />
              <Tooltip formatter={(value) => `$${Number(value).toLocaleString()}`} />
              <Bar dataKey="revenue" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-600">Top Service:</p>
              <p className="font-semibold">SOC 2 Type II (58%)</p>
            </div>
            <div>
              <p className="text-gray-600">Growth Area:</p>
              <p className="font-semibold">Readiness (+45% QoQ)</p>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">MRR Growth Trend</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={mrrTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis yAxisId="left" tickFormatter={(value) => `$${value / 1000}k`} />
              <YAxis yAxisId="right" orientation="right" tickFormatter={(value) => `${value}%`} />
              <Tooltip />
              <Legend />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="mrr"
                stroke="#3b82f6"
                strokeWidth={3}
                name="MRR"
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="growth"
                stroke="#10b981"
                strokeWidth={2}
                name="Growth %"
              />
            </LineChart>
          </ResponsiveContainer>
          <div className="mt-4 p-3 bg-green-50 rounded-lg">
            <p className="text-sm text-green-800">
              <span className="font-semibold">MRR Growth:</span> 44.6% YTD • On track for $500K by
              Q4
            </p>
          </div>
        </div>
      </div>

      {/* Partner Revenue and CLV */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue by Channel</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={partnerRevenue}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(entry) => `${entry.percentage}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {partnerRevenue.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => `$${Number(value).toLocaleString()}`} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Customer Lifetime Value</h3>
          <div className="space-y-4">
            {clvBySegment.map((segment) => (
              <div
                key={segment.segment}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
              >
                <div>
                  <p className="font-medium text-gray-900">{segment.segment}</p>
                  <p className="text-sm text-gray-600">{segment.customers} customers</p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-gray-900">
                    ${(segment.clv / 1000).toFixed(0)}K
                  </p>
                  <p className="text-sm text-gray-600">avg CLV</p>
                </div>
              </div>
            ))}
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                <span className="font-semibold">Insight:</span> Enterprise segment shows 48% higher
                CLV with 95% retention
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Revenue Forecast */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Revenue Forecast (Next 5 Months)
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={forecast}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis tickFormatter={(value) => `$${value / 1000}k`} />
            <Tooltip formatter={(value) => `$${Number(value).toLocaleString()}`} />
            <Legend />
            <Area
              type="monotone"
              dataKey="conservative"
              stackId="1"
              stroke="#f59e0b"
              fill="#fef3c7"
              name="Conservative"
            />
            <Area
              type="monotone"
              dataKey="projected"
              stackId="2"
              stroke="#3b82f6"
              fill="#dbeafe"
              name="Projected"
            />
            <Area
              type="monotone"
              dataKey="optimistic"
              stackId="3"
              stroke="#10b981"
              fill="#d1fae5"
              name="Optimistic"
            />
          </AreaChart>
        </ResponsiveContainer>
        <div className="mt-4 grid grid-cols-3 gap-4 text-center">
          <div className="p-3 bg-yellow-50 rounded-lg">
            <p className="text-sm text-gray-600">Conservative</p>
            <p className="font-semibold text-yellow-900">$3.5M</p>
          </div>
          <div className="p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-gray-600">Projected</p>
            <p className="font-semibold text-blue-900">$3.8M</p>
          </div>
          <div className="p-3 bg-green-50 rounded-lg">
            <p className="text-sm text-gray-600">Optimistic</p>
            <p className="font-semibold text-green-900">$4.1M</p>
          </div>
        </div>
      </div>

      {/* Payment Metrics */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
          <CalendarIcon className="h-8 w-8 text-gray-400 mx-auto mb-2" />
          <p className="text-2xl font-bold text-gray-900">{paymentMetrics.avgCollectionDays}</p>
          <p className="text-sm text-gray-600">Avg Collection Days</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
          <CurrencyDollarIcon className="h-8 w-8 text-yellow-600 mx-auto mb-2" />
          <p className="text-2xl font-bold text-gray-900">
            ${(paymentMetrics.overdueAmount / 1000).toFixed(0)}K
          </p>
          <p className="text-sm text-gray-600">Overdue Amount</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
          <ChartBarIcon className="h-8 w-8 text-green-600 mx-auto mb-2" />
          <p className="text-2xl font-bold text-gray-900">{paymentMetrics.collectionRate}%</p>
          <p className="text-sm text-gray-600">Collection Rate</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
          <DocumentTextIcon className="h-8 w-8 text-blue-600 mx-auto mb-2" />
          <p className="text-2xl font-bold text-gray-900">
            ${(paymentMetrics.avgInvoiceSize / 1000).toFixed(1)}K
          </p>
          <p className="text-sm text-gray-600">Avg Invoice Size</p>
        </div>
      </div>
    </div>
  );
}
