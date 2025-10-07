'use client';

import {
  ArrowTrendingDownIcon,
  ArrowTrendingUpIcon,
  CalendarIcon,
  ChartBarIcon,
  CurrencyDollarIcon,
} from '@heroicons/react/24/outline';
import { useState } from 'react';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useBillingMetrics, useSubscription } from '@/hooks/api/useBilling';

export default function RecurringRevenue() {
  const [timeRange, setTimeRange] = useState('month');

  // Fetch billing metrics from API
  const { data: metrics, loading: metricsLoading } = useBillingMetrics();
  const { data: subscription, loading: subscriptionLoading } = useSubscription();

  if (metricsLoading || subscriptionLoading) {
    return (
      <div className="flex justify-center py-8">
        <LoadingSpinner />
      </div>
    );
  }

  const totalMRR = metrics?.mrr || 0;
  const totalARR = metrics?.arr || 0;
  const churnRate = metrics?.churnRate || 0;
  const revenueGrowth = metrics?.revenueGrowth || 0;
  const avgRevenuePerAccount = metrics?.averageRevenuePerAccount || 0;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'trial':
        return 'bg-blue-100 text-blue-800';
      case 'past_due':
        return 'bg-yellow-100 text-yellow-800';
      case 'canceled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const revenueMetrics = [
    {
      label: 'Monthly Recurring Revenue',
      value: `$${totalMRR.toLocaleString()}`,
      change: `${revenueGrowth > 0 ? '+' : ''}${revenueGrowth}%`,
      positive: revenueGrowth > 0,
      icon: CurrencyDollarIcon,
    },
    {
      label: 'Annual Recurring Revenue',
      value: `$${totalARR.toLocaleString()}`,
      change: `${revenueGrowth > 0 ? '+' : ''}${(revenueGrowth * 12).toFixed(1)}%`,
      positive: revenueGrowth > 0,
      icon: ChartBarIcon,
    },
    {
      label: 'Churn Rate',
      value: `${churnRate}%`,
      change: churnRate < 5 ? 'Healthy' : 'At Risk',
      positive: churnRate < 5,
      icon: ArrowTrendingDownIcon,
    },
    {
      label: 'Avg Revenue Per Account',
      value: `$${avgRevenuePerAccount.toLocaleString()}`,
      change: 'Per Year',
      positive: true,
      icon: ArrowTrendingUpIcon,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {revenueMetrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <div key={metric.label} className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <Icon className="h-8 w-8 text-primary-600" />
                <span
                  className={`text-sm font-medium ${
                    metric.positive ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {metric.change}
                </span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900">{metric.value}</h3>
              <p className="text-sm text-gray-600">{metric.label}</p>
            </div>
          );
        })}
      </div>

      {subscription && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Current Subscription</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Plan</p>
              <p className="font-medium text-gray-900">{subscription.planName}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Status</p>
              <span
                className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(subscription.status)}`}
              >
                {subscription.status}
              </span>
            </div>
            <div>
              <p className="text-sm text-gray-600">Seats</p>
              <p className="font-medium text-gray-900">{subscription.seats}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Billing Cycle</p>
              <p className="font-medium text-gray-900 capitalize">{subscription.billingInterval}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Current Period</p>
              <p className="font-medium text-gray-900">
                {new Date(subscription.currentPeriodStart).toLocaleDateString()} -{' '}
                {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Amount</p>
              <p className="font-medium text-gray-900">
                ${subscription.totalAmount.toLocaleString()}/{subscription.billingInterval}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-semibold text-blue-900 mb-2">Revenue Projection</h4>
          <p className="text-sm text-blue-800 mb-3">
            Projected annual revenue: ${metrics?.projectedAnnualRevenue?.toLocaleString() || 'N/A'}
          </p>
          <button className="btn-primary w-full">View Forecast</button>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h4 className="font-semibold text-green-900 mb-2">Active Subscriptions</h4>
          <p className="text-sm text-green-800 mb-3">
            {metrics?.activeSubscriptions || 0} active subscriptions
          </p>
          <button className="btn-primary w-full">Manage Subscriptions</button>
        </div>
      </div>
    </div>
  );
}
