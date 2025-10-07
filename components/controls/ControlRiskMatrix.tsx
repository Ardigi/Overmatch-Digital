'use client';

import { useState, useMemo } from 'react';
import {
  ExclamationTriangleIcon,
  ShieldExclamationIcon,
  CheckCircleIcon,
  XCircleIcon,
  InformationCircleIcon,
  ChartBarIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
} from '@heroicons/react/24/outline';

interface RiskControl {
  id: string;
  controlId: string;
  name: string;
  category: string;
  likelihood: 1 | 2 | 3 | 4 | 5;
  impact: 1 | 2 | 3 | 4 | 5;
  inherentRisk: number;
  residualRisk: number;
  effectiveness: 'EFFECTIVE' | 'PARTIALLY_EFFECTIVE' | 'INEFFECTIVE' | 'NOT_TESTED';
  mitigationStatus: 'MITIGATED' | 'PARTIAL' | 'OPEN' | 'ACCEPTED';
  lastAssessment: Date;
  owner: string;
}

interface ControlRiskMatrixProps {
  controls?: RiskControl[];
  onControlClick?: (control: RiskControl) => void;
  showHeatmap?: boolean;
  showTrends?: boolean;
}

// Mock data generator
const generateMockControls = (): RiskControl[] => {
  const categories = ['Access Control', 'Data Protection', 'Network Security', 'Physical Security', 'Incident Response'];
  const owners = ['John Doe', 'Jane Smith', 'Bob Johnson', 'Alice Brown', 'Charlie Wilson'];
  const controls: RiskControl[] = [];
  
  for (let i = 0; i < 25; i++) {
    const likelihood = Math.ceil(Math.random() * 5) as 1 | 2 | 3 | 4 | 5;
    const impact = Math.ceil(Math.random() * 5) as 1 | 2 | 3 | 4 | 5;
    const inherentRisk = likelihood * impact;
    const effectiveness = ['EFFECTIVE', 'PARTIALLY_EFFECTIVE', 'INEFFECTIVE', 'NOT_TESTED'][Math.floor(Math.random() * 4)] as any;
    const reduction = effectiveness === 'EFFECTIVE' ? 0.7 : effectiveness === 'PARTIALLY_EFFECTIVE' ? 0.4 : 0.1;
    const residualRisk = Math.max(1, Math.round(inherentRisk * (1 - reduction)));
    
    controls.push({
      id: `risk-${i}`,
      controlId: `CTRL-${100 + i}`,
      name: `Control ${100 + i}`,
      category: categories[Math.floor(Math.random() * categories.length)],
      likelihood,
      impact,
      inherentRisk,
      residualRisk,
      effectiveness,
      mitigationStatus: ['MITIGATED', 'PARTIAL', 'OPEN', 'ACCEPTED'][Math.floor(Math.random() * 4)] as any,
      lastAssessment: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000),
      owner: owners[Math.floor(Math.random() * owners.length)],
    });
  }
  
  return controls;
};

const riskLevels = {
  low: { min: 1, max: 5, color: 'bg-green-500', label: 'Low', textColor: 'text-green-700' },
  medium: { min: 6, max: 12, color: 'bg-yellow-500', label: 'Medium', textColor: 'text-yellow-700' },
  high: { min: 13, max: 19, color: 'bg-orange-500', label: 'High', textColor: 'text-orange-700' },
  critical: { min: 20, max: 25, color: 'bg-red-500', label: 'Critical', textColor: 'text-red-700' },
};

const getRiskLevel = (score: number) => {
  if (score <= 5) return riskLevels.low;
  if (score <= 12) return riskLevels.medium;
  if (score <= 19) return riskLevels.high;
  return riskLevels.critical;
};

const likelihoodLabels = ['Rare', 'Unlikely', 'Possible', 'Likely', 'Almost Certain'];
const impactLabels = ['Negligible', 'Minor', 'Moderate', 'Major', 'Severe'];

export default function ControlRiskMatrix({
  controls = generateMockControls(),
  onControlClick,
  showHeatmap = true,
  showTrends = true,
}: ControlRiskMatrixProps) {
  const [viewMode, setViewMode] = useState<'matrix' | 'list' | 'comparison'>('matrix');
  const [selectedRiskLevel, setSelectedRiskLevel] = useState<string | null>(null);
  const [selectedCell, setSelectedCell] = useState<{ likelihood: number; impact: number } | null>(null);
  
  // Calculate risk distribution
  const riskDistribution = useMemo(() => {
    const distribution = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    };
    
    controls.forEach(control => {
      const level = getRiskLevel(control.inherentRisk);
      if (level === riskLevels.low) distribution.low++;
      else if (level === riskLevels.medium) distribution.medium++;
      else if (level === riskLevels.high) distribution.high++;
      else distribution.critical++;
    });
    
    return distribution;
  }, [controls]);
  
  // Group controls by matrix position
  const matrixData = useMemo(() => {
    const matrix: { [key: string]: RiskControl[] } = {};
    
    controls.forEach(control => {
      const key = `${control.likelihood}-${control.impact}`;
      if (!matrix[key]) matrix[key] = [];
      matrix[key].push(control);
    });
    
    return matrix;
  }, [controls]);
  
  // Calculate risk trends
  const riskTrends = useMemo(() => {
    const improved = controls.filter(c => c.residualRisk < c.inherentRisk * 0.5).length;
    const worsened = controls.filter(c => c.residualRisk > c.inherentRisk * 0.8).length;
    const stable = controls.length - improved - worsened;
    
    return { improved, worsened, stable };
  }, [controls]);
  
  // Filter controls based on selected cell or risk level
  const filteredControls = useMemo(() => {
    if (selectedCell) {
      const key = `${selectedCell.likelihood}-${selectedCell.impact}`;
      return matrixData[key] || [];
    }
    
    if (selectedRiskLevel) {
      const level = riskLevels[selectedRiskLevel as keyof typeof riskLevels];
      return controls.filter(c => {
        const riskLevel = getRiskLevel(c.inherentRisk);
        return riskLevel === level;
      });
    }
    
    return controls;
  }, [controls, selectedCell, selectedRiskLevel, matrixData]);
  
  const renderMatrix = () => (
    <div className="overflow-x-auto">
      <table className="min-w-full">
        <thead>
          <tr>
            <th className="px-2 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
              Likelihood →<br />Impact ↓
            </th>
            {likelihoodLabels.map((label, i) => (
              <th key={i} className="px-2 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider text-center">
                {label}<br />({i + 1})
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {impactLabels.map((impactLabel, impactIndex) => (
            <tr key={impactIndex}>
              <td className="px-2 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
                {impactLabel} ({5 - impactIndex})
              </td>
              {[1, 2, 3, 4, 5].map(likelihood => {
                const impact = 5 - impactIndex;
                const riskScore = likelihood * impact;
                const riskLevel = getRiskLevel(riskScore);
                const key = `${likelihood}-${impact}`;
                const cellControls = matrixData[key] || [];
                const isSelected = selectedCell?.likelihood === likelihood && selectedCell?.impact === impact;
                
                return (
                  <td
                    key={likelihood}
                    className={`relative px-2 py-2 text-center cursor-pointer border-2 transition-all ${
                      isSelected 
                        ? 'border-primary-600 ring-2 ring-primary-400' 
                        : 'border-gray-200 hover:border-gray-400'
                    }`}
                    style={{
                      backgroundColor: showHeatmap 
                        ? `rgba(${
                            riskLevel === riskLevels.low ? '34, 197, 94' :
                            riskLevel === riskLevels.medium ? '250, 204, 21' :
                            riskLevel === riskLevels.high ? '251, 146, 60' :
                            '239, 68, 68'
                          }, ${0.2 + (riskScore / 25) * 0.5})`
                        : undefined,
                    }}
                    onClick={() => setSelectedCell({ likelihood, impact })}
                  >
                    <div className="text-lg font-bold text-gray-900">{riskScore}</div>
                    <div className="text-xs text-gray-600">{riskLevel.label}</div>
                    {cellControls.length > 0 && (
                      <div className="mt-1">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-800 text-white">
                          {cellControls.length} {cellControls.length === 1 ? 'control' : 'controls'}
                        </span>
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
  
  const renderControlsList = () => (
    <div className="space-y-2">
      {filteredControls.map(control => {
        const inherentLevel = getRiskLevel(control.inherentRisk);
        const residualLevel = getRiskLevel(control.residualRisk);
        const riskReduction = Math.round(((control.inherentRisk - control.residualRisk) / control.inherentRisk) * 100);
        
        return (
          <div
            key={control.id}
            className="bg-white p-4 rounded-lg border border-gray-200 hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => onControlClick?.(control)}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium text-gray-900">{control.name}</span>
                  <span className="text-sm text-gray-500">•</span>
                  <span className="text-sm text-gray-500">{control.controlId}</span>
                </div>
                <p className="mt-1 text-sm text-gray-600">{control.category}</p>
                
                <div className="mt-2 flex items-center space-x-4">
                  <div className="flex items-center space-x-1">
                    <span className="text-xs text-gray-500">Likelihood:</span>
                    <span className="text-xs font-medium">{control.likelihood}/5</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <span className="text-xs text-gray-500">Impact:</span>
                    <span className="text-xs font-medium">{control.impact}/5</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <span className="text-xs text-gray-500">Owner:</span>
                    <span className="text-xs font-medium">{control.owner}</span>
                  </div>
                </div>
              </div>
              
              <div className="ml-4 text-right">
                <div className="flex flex-col space-y-2">
                  <div>
                    <p className="text-xs text-gray-500">Inherent Risk</p>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${inherentLevel.color} text-white`}>
                      {control.inherentRisk} - {inherentLevel.label}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Residual Risk</p>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${residualLevel.color} text-white`}>
                      {control.residualRisk} - {residualLevel.label}
                    </span>
                  </div>
                  {riskReduction > 0 && (
                    <div className="flex items-center justify-end text-green-600">
                      <ArrowTrendingDownIcon className="h-4 w-4 mr-1" />
                      <span className="text-xs font-medium">{riskReduction}%</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
  
  const renderComparison = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Inherent Risk Matrix */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Inherent Risk (Before Controls)</h3>
        <div className="bg-gray-50 p-4 rounded-lg">
          {renderMatrix()}
        </div>
      </div>
      
      {/* Residual Risk Chart */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Residual Risk (After Controls)</h3>
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="space-y-4">
            {Object.entries(riskLevels).map(([key, level]) => {
              const count = controls.filter(c => {
                const rLevel = getRiskLevel(c.residualRisk);
                return rLevel === level;
              }).length;
              const percentage = (count / controls.length) * 100;
              
              return (
                <div key={key}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-sm font-medium ${level.textColor}`}>
                      {level.label} Risk
                    </span>
                    <span className="text-sm text-gray-600">
                      {count} controls ({percentage.toFixed(0)}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-6">
                    <div
                      className={`${level.color} h-6 rounded-full flex items-center justify-center text-xs font-medium text-white transition-all`}
                      style={{ width: `${percentage}%` }}
                    >
                      {percentage > 10 && `${percentage.toFixed(0)}%`}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
  
  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Risk Assessment Matrix</h2>
            <p className="mt-1 text-sm text-gray-500">
              Visualize control risks by likelihood and impact
            </p>
          </div>
          
          {/* View Mode Selector */}
          <div className="flex items-center space-x-2 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('matrix')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                viewMode === 'matrix'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Matrix
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                viewMode === 'list'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              List
            </button>
            <button
              onClick={() => setViewMode('comparison')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                viewMode === 'comparison'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Comparison
            </button>
          </div>
        </div>
        
        {/* Risk Statistics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Object.entries(riskLevels).map(([key, level]) => (
            <button
              key={key}
              onClick={() => setSelectedRiskLevel(selectedRiskLevel === key ? null : key)}
              className={`p-3 rounded-lg border-2 transition-all ${
                selectedRiskLevel === key
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-sm font-medium ${level.textColor}`}>
                  {level.label}
                </span>
                <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full ${level.color} text-white text-sm font-bold`}>
                  {riskDistribution[key as keyof typeof riskDistribution]}
                </span>
              </div>
            </button>
          ))}
        </div>
        
        {/* Risk Trends */}
        {showTrends && (
          <div className="mt-4 grid grid-cols-3 gap-4">
            <div className="bg-green-50 rounded-lg p-3">
              <div className="flex items-center">
                <ArrowTrendingDownIcon className="h-5 w-5 text-green-600" />
                <span className="ml-2 text-sm font-medium text-green-900">
                  Risk Reduced
                </span>
              </div>
              <p className="mt-1 text-2xl font-semibold text-green-900">
                {riskTrends.improved}
              </p>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center">
                <ShieldExclamationIcon className="h-5 w-5 text-gray-600" />
                <span className="ml-2 text-sm font-medium text-gray-900">
                  Risk Stable
                </span>
              </div>
              <p className="mt-1 text-2xl font-semibold text-gray-900">
                {riskTrends.stable}
              </p>
            </div>
            
            <div className="bg-red-50 rounded-lg p-3">
              <div className="flex items-center">
                <ArrowTrendingUpIcon className="h-5 w-5 text-red-600" />
                <span className="ml-2 text-sm font-medium text-red-900">
                  Risk Increased
                </span>
              </div>
              <p className="mt-1 text-2xl font-semibold text-red-900">
                {riskTrends.worsened}
              </p>
            </div>
          </div>
        )}
      </div>
      
      {/* Main Content */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        {selectedCell && (
          <div className="mb-4 p-3 bg-blue-50 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <InformationCircleIcon className="h-5 w-5 text-blue-600 mr-2" />
                <span className="text-sm text-blue-900">
                  Showing controls with Likelihood: {selectedCell.likelihood}, Impact: {selectedCell.impact}
                </span>
              </div>
              <button
                onClick={() => setSelectedCell(null)}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                Clear filter
              </button>
            </div>
          </div>
        )}
        
        {viewMode === 'matrix' && renderMatrix()}
        {viewMode === 'list' && renderControlsList()}
        {viewMode === 'comparison' && renderComparison()}
      </div>
    </div>
  );
}