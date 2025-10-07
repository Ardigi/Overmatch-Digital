'use client';

import { useState, useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  ChartData,
  ChartOptions,
} from 'chart.js';
import { Line, Bar, Doughnut, Radar } from 'react-chartjs-2';
import {
  ChartBarIcon,
  ChartPieIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  CalendarIcon,
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import { format, subMonths, startOfMonth } from 'date-fns';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

interface EffectivenessData {
  month: string;
  effective: number;
  partiallyEffective: number;
  ineffective: number;
  notTested: number;
  total: number;
  passRate: number;
}

interface CategoryEffectiveness {
  category: string;
  effective: number;
  partiallyEffective: number;
  ineffective: number;
  notTested: number;
}

interface ControlEffectivenessChartProps {
  frameworkId?: string;
  categoryId?: string;
  timeRange?: number; // months
  onDataPointClick?: (data: any) => void;
}

// Generate mock historical data
const generateMockData = (months: number = 12): EffectivenessData[] => {
  const data: EffectivenessData[] = [];
  const now = new Date();
  
  for (let i = months - 1; i >= 0; i--) {
    const month = startOfMonth(subMonths(now, i));
    const total = 100 + Math.floor(Math.random() * 50);
    const effective = 40 + Math.floor(Math.random() * 30);
    const partiallyEffective = 20 + Math.floor(Math.random() * 20);
    const ineffective = 5 + Math.floor(Math.random() * 10);
    const notTested = total - effective - partiallyEffective - ineffective;
    
    data.push({
      month: format(month, 'MMM yyyy'),
      effective,
      partiallyEffective,
      ineffective,
      notTested,
      total,
      passRate: Math.round((effective / total) * 100),
    });
  }
  
  return data;
};

// Generate mock category data
const generateCategoryData = (): CategoryEffectiveness[] => {
  const categories = [
    'Access Control',
    'Data Protection',
    'Network Security',
    'Physical Security',
    'Incident Response',
    'Business Continuity',
    'Vendor Management',
    'Change Management',
  ];
  
  return categories.map(category => ({
    category,
    effective: 20 + Math.floor(Math.random() * 40),
    partiallyEffective: 10 + Math.floor(Math.random() * 20),
    ineffective: 5 + Math.floor(Math.random() * 10),
    notTested: 5 + Math.floor(Math.random() * 15),
  }));
};

export default function ControlEffectivenessChart({
  frameworkId,
  categoryId,
  timeRange = 12,
  onDataPointClick,
}: ControlEffectivenessChartProps) {
  const [chartType, setChartType] = useState<'line' | 'bar' | 'doughnut' | 'radar'>('line');
  const [selectedMetric, setSelectedMetric] = useState<'all' | 'effective' | 'ineffective'>('all');
  
  const historicalData = useMemo(() => generateMockData(timeRange), [timeRange]);
  const categoryData = useMemo(() => generateCategoryData(), []);
  
  // Calculate current metrics
  const currentMetrics = useMemo(() => {
    const latest = historicalData[historicalData.length - 1];
    const previous = historicalData[historicalData.length - 2];
    
    return {
      effective: latest.effective,
      partiallyEffective: latest.partiallyEffective,
      ineffective: latest.ineffective,
      notTested: latest.notTested,
      total: latest.total,
      passRate: latest.passRate,
      trend: latest.passRate - (previous?.passRate || 0),
    };
  }, [historicalData]);
  
  // Prepare chart data based on type
  const getChartData = (): ChartData<any> => {
    switch (chartType) {
      case 'line':
        return {
          labels: historicalData.map(d => d.month),
          datasets: selectedMetric === 'all' ? [
            {
              label: 'Effective',
              data: historicalData.map(d => d.effective),
              borderColor: 'rgb(34, 197, 94)',
              backgroundColor: 'rgba(34, 197, 94, 0.1)',
              tension: 0.4,
            },
            {
              label: 'Partially Effective',
              data: historicalData.map(d => d.partiallyEffective),
              borderColor: 'rgb(250, 204, 21)',
              backgroundColor: 'rgba(250, 204, 21, 0.1)',
              tension: 0.4,
            },
            {
              label: 'Ineffective',
              data: historicalData.map(d => d.ineffective),
              borderColor: 'rgb(239, 68, 68)',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              tension: 0.4,
            },
            {
              label: 'Not Tested',
              data: historicalData.map(d => d.notTested),
              borderColor: 'rgb(156, 163, 175)',
              backgroundColor: 'rgba(156, 163, 175, 0.1)',
              tension: 0.4,
            },
          ] : selectedMetric === 'effective' ? [
            {
              label: 'Pass Rate %',
              data: historicalData.map(d => d.passRate),
              borderColor: 'rgb(34, 197, 94)',
              backgroundColor: 'rgba(34, 197, 94, 0.1)',
              tension: 0.4,
            },
          ] : [
            {
              label: 'Failure Rate %',
              data: historicalData.map(d => Math.round((d.ineffective / d.total) * 100)),
              borderColor: 'rgb(239, 68, 68)',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              tension: 0.4,
            },
          ],
        };
        
      case 'bar':
        return {
          labels: categoryData.map(d => d.category),
          datasets: [
            {
              label: 'Effective',
              data: categoryData.map(d => d.effective),
              backgroundColor: 'rgba(34, 197, 94, 0.8)',
            },
            {
              label: 'Partially Effective',
              data: categoryData.map(d => d.partiallyEffective),
              backgroundColor: 'rgba(250, 204, 21, 0.8)',
            },
            {
              label: 'Ineffective',
              data: categoryData.map(d => d.ineffective),
              backgroundColor: 'rgba(239, 68, 68, 0.8)',
            },
            {
              label: 'Not Tested',
              data: categoryData.map(d => d.notTested),
              backgroundColor: 'rgba(156, 163, 175, 0.8)',
            },
          ],
        };
        
      case 'doughnut':
        return {
          labels: ['Effective', 'Partially Effective', 'Ineffective', 'Not Tested'],
          datasets: [{
            data: [
              currentMetrics.effective,
              currentMetrics.partiallyEffective,
              currentMetrics.ineffective,
              currentMetrics.notTested,
            ],
            backgroundColor: [
              'rgba(34, 197, 94, 0.8)',
              'rgba(250, 204, 21, 0.8)',
              'rgba(239, 68, 68, 0.8)',
              'rgba(156, 163, 175, 0.8)',
            ],
            borderWidth: 2,
            borderColor: '#fff',
          }],
        };
        
      case 'radar':
        const radarCategories = categoryData.slice(0, 6);
        return {
          labels: radarCategories.map(d => d.category),
          datasets: [{
            label: 'Effectiveness Score',
            data: radarCategories.map(d => {
              const total = d.effective + d.partiallyEffective + d.ineffective + d.notTested;
              return Math.round((d.effective / total) * 100);
            }),
            backgroundColor: 'rgba(99, 102, 241, 0.2)',
            borderColor: 'rgb(99, 102, 241)',
            pointBackgroundColor: 'rgb(99, 102, 241)',
            pointBorderColor: '#fff',
            pointHoverBackgroundColor: '#fff',
            pointHoverBorderColor: 'rgb(99, 102, 241)',
          }],
        };
        
      default:
        return { labels: [], datasets: [] };
    }
  };
  
  const chartOptions: ChartOptions<any> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const label = context.dataset.label || '';
            const value = context.parsed.y || context.parsed || 0;
            return chartType === 'radar' || selectedMetric !== 'all' 
              ? `${label}: ${value}%`
              : `${label}: ${value} controls`;
          },
        },
      },
    },
    scales: chartType === 'line' || chartType === 'bar' ? {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value) => {
            return selectedMetric !== 'all' ? `${value}%` : value;
          },
        },
      },
    } : undefined,
    onClick: (event, elements) => {
      if (elements.length > 0 && onDataPointClick) {
        const element = elements[0];
        const datasetIndex = element.datasetIndex;
        const index = element.index;
        const dataset = getChartData().datasets[datasetIndex];
        const label = getChartData().labels?.[index];
        
        onDataPointClick({
          dataset: dataset.label,
          label,
          value: dataset.data[index],
        });
      }
    },
  };
  
  const renderChart = () => {
    const data = getChartData();
    
    switch (chartType) {
      case 'line':
        return <Line data={data} options={chartOptions} height={300} />;
      case 'bar':
        return <Bar data={data} options={chartOptions} height={300} />;
      case 'doughnut':
        return <Doughnut data={data} options={chartOptions} height={300} />;
      case 'radar':
        return <Radar data={data} options={chartOptions} height={300} />;
      default:
        return null;
    }
  };
  
  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Control Effectiveness Analysis</h2>
            <p className="mt-1 text-sm text-gray-500">
              Track control effectiveness trends and performance metrics
            </p>
          </div>
          
          {/* Chart Type Selector */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setChartType('line')}
              className={`p-2 rounded-lg transition-colors ${
                chartType === 'line'
                  ? 'bg-primary-100 text-primary-600'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
              title="Line Chart"
            >
              <ArrowTrendingUpIcon className="h-5 w-5" />
            </button>
            <button
              onClick={() => setChartType('bar')}
              className={`p-2 rounded-lg transition-colors ${
                chartType === 'bar'
                  ? 'bg-primary-100 text-primary-600'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
              title="Bar Chart"
            >
              <ChartBarIcon className="h-5 w-5" />
            </button>
            <button
              onClick={() => setChartType('doughnut')}
              className={`p-2 rounded-lg transition-colors ${
                chartType === 'doughnut'
                  ? 'bg-primary-100 text-primary-600'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
              title="Doughnut Chart"
            >
              <ChartPieIcon className="h-5 w-5" />
            </button>
            <button
              onClick={() => setChartType('radar')}
              className={`p-2 rounded-lg transition-colors ${
                chartType === 'radar'
                  ? 'bg-primary-100 text-primary-600'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
              title="Radar Chart"
            >
              <ShieldCheckIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
        
        {/* Key Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="bg-green-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600">Effective</p>
                <p className="mt-1 text-2xl font-semibold text-green-900">
                  {currentMetrics.effective}
                </p>
              </div>
              <CheckCircleIcon className="h-8 w-8 text-green-400" />
            </div>
            <p className="mt-2 text-xs text-green-600">
              {currentMetrics.passRate}% pass rate
            </p>
          </div>
          
          <div className="bg-yellow-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-yellow-600">Partial</p>
                <p className="mt-1 text-2xl font-semibold text-yellow-900">
                  {currentMetrics.partiallyEffective}
                </p>
              </div>
              <ExclamationTriangleIcon className="h-8 w-8 text-yellow-400" />
            </div>
            <p className="mt-2 text-xs text-yellow-600">
              Needs improvement
            </p>
          </div>
          
          <div className="bg-red-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-red-600">Ineffective</p>
                <p className="mt-1 text-2xl font-semibold text-red-900">
                  {currentMetrics.ineffective}
                </p>
              </div>
              <XCircleIcon className="h-8 w-8 text-red-400" />
            </div>
            <p className="mt-2 text-xs text-red-600">
              Requires action
            </p>
          </div>
          
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Not Tested</p>
                <p className="mt-1 text-2xl font-semibold text-gray-900">
                  {currentMetrics.notTested}
                </p>
              </div>
              <CalendarIcon className="h-8 w-8 text-gray-400" />
            </div>
            <p className="mt-2 text-xs text-gray-600">
              Pending assessment
            </p>
          </div>
        </div>
        
        {/* Trend Indicator */}
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center">
            {currentMetrics.trend > 0 ? (
              <ArrowTrendingUpIcon className="h-5 w-5 text-green-600 mr-2" />
            ) : (
              <ArrowTrendingDownIcon className="h-5 w-5 text-red-600 mr-2" />
            )}
            <span className="text-sm font-medium text-gray-900">
              Overall Trend
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <span className={`text-sm font-semibold ${
              currentMetrics.trend > 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {currentMetrics.trend > 0 ? '+' : ''}{currentMetrics.trend}%
            </span>
            <span className="text-sm text-gray-500">vs last month</span>
          </div>
        </div>
      </div>
      
      {/* Chart Container */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        {chartType === 'line' && (
          <div className="mb-4 flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-700">Show:</span>
            <button
              onClick={() => setSelectedMetric('all')}
              className={`px-3 py-1 text-sm rounded-md ${
                selectedMetric === 'all'
                  ? 'bg-primary-100 text-primary-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              All Metrics
            </button>
            <button
              onClick={() => setSelectedMetric('effective')}
              className={`px-3 py-1 text-sm rounded-md ${
                selectedMetric === 'effective'
                  ? 'bg-primary-100 text-primary-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Pass Rate
            </button>
            <button
              onClick={() => setSelectedMetric('ineffective')}
              className={`px-3 py-1 text-sm rounded-md ${
                selectedMetric === 'ineffective'
                  ? 'bg-primary-100 text-primary-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Failure Rate
            </button>
          </div>
        )}
        
        <div className="h-80">
          {renderChart()}
        </div>
        
        {/* Chart Description */}
        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-600">
            {chartType === 'line' && 'Historical trend showing control effectiveness over time.'}
            {chartType === 'bar' && 'Effectiveness distribution across control categories.'}
            {chartType === 'doughnut' && 'Current distribution of control effectiveness status.'}
            {chartType === 'radar' && 'Effectiveness scores across key control categories.'}
            {' Click on data points for more details.'}
          </p>
        </div>
      </div>
    </div>
  );
}