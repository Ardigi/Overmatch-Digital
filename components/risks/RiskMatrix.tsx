'use client';

import {
  ArrowTrendingDownIcon,
  ArrowTrendingUpIcon,
  ExclamationTriangleIcon,
  FunnelIcon,
} from '@heroicons/react/24/outline';
import React, { useState } from 'react';

interface Risk {
  id: string;
  title: string;
  category: string;
  likelihood: 1 | 2 | 3 | 4 | 5;
  impact: 1 | 2 | 3 | 4 | 5;
  score: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  owner: string;
}

export default function RiskMatrix() {
  const [filterCategory, setFilterCategory] = useState('all');
  const [selectedCell, setSelectedCell] = useState<{ likelihood: number; impact: number } | null>(
    null
  );

  // Mock risk data
  const risks: Risk[] = [
    {
      id: '1',
      title: 'Data Breach - Customer PII',
      category: 'Security',
      likelihood: 2,
      impact: 5,
      score: 10,
      trend: 'decreasing',
      owner: 'Sarah Chen',
    },
    {
      id: '2',
      title: 'Service Availability Disruption',
      category: 'Availability',
      likelihood: 3,
      impact: 4,
      score: 12,
      trend: 'stable',
      owner: 'Michael Torres',
    },
    {
      id: '3',
      title: 'Non-compliance with SOC 2',
      category: 'Compliance',
      likelihood: 2,
      impact: 4,
      score: 8,
      trend: 'decreasing',
      owner: 'Lisa Martinez',
    },
    {
      id: '4',
      title: 'Insider Threat',
      category: 'Security',
      likelihood: 2,
      impact: 3,
      score: 6,
      trend: 'stable',
      owner: 'David Park',
    },
    {
      id: '5',
      title: 'Third-party Vendor Failure',
      category: 'Operations',
      likelihood: 3,
      impact: 3,
      score: 9,
      trend: 'increasing',
      owner: 'James Thompson',
    },
    {
      id: '6',
      title: 'Ransomware Attack',
      category: 'Security',
      likelihood: 2,
      impact: 5,
      score: 10,
      trend: 'increasing',
      owner: 'Alex Johnson',
    },
    {
      id: '7',
      title: 'Key Personnel Loss',
      category: 'Operations',
      likelihood: 3,
      impact: 2,
      score: 6,
      trend: 'stable',
      owner: 'Maria Garcia',
    },
    {
      id: '8',
      title: 'Financial Reporting Errors',
      category: 'Financial',
      likelihood: 1,
      impact: 4,
      score: 4,
      trend: 'decreasing',
      owner: 'Robert Anderson',
    },
    {
      id: '9',
      title: 'Physical Security Breach',
      category: 'Security',
      likelihood: 1,
      impact: 3,
      score: 3,
      trend: 'stable',
      owner: 'Thomas Brown',
    },
    {
      id: '10',
      title: 'DDoS Attack',
      category: 'Availability',
      likelihood: 4,
      impact: 3,
      score: 12,
      trend: 'increasing',
      owner: 'Rachel Green',
    },
  ];

  const categories = ['All', 'Security', 'Compliance', 'Operations', 'Availability', 'Financial'];
  const likelihoodLabels = ['Rare', 'Unlikely', 'Possible', 'Likely', 'Almost Certain'];
  const impactLabels = ['Negligible', 'Minor', 'Moderate', 'Major', 'Severe'];

  const getRiskColor = (score: number) => {
    if (score >= 15) return 'bg-red-500';
    if (score >= 10) return 'bg-orange-500';
    if (score >= 5) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getRiskLevel = (score: number) => {
    if (score >= 15) return 'Critical';
    if (score >= 10) return 'High';
    if (score >= 5) return 'Medium';
    return 'Low';
  };

  const getCellColor = (likelihood: number, impact: number) => {
    const score = likelihood * impact;
    if (score >= 15) return 'bg-red-100 hover:bg-red-200';
    if (score >= 10) return 'bg-orange-100 hover:bg-orange-200';
    if (score >= 5) return 'bg-yellow-100 hover:bg-yellow-200';
    return 'bg-green-100 hover:bg-green-200';
  };

  const getRisksInCell = (likelihood: number, impact: number) => {
    return risks.filter(
      (risk) =>
        risk.likelihood === likelihood &&
        risk.impact === impact &&
        (filterCategory === 'all' || risk.category === filterCategory)
    );
  };

  const filteredRisks = risks.filter(
    (risk) => filterCategory === 'all' || risk.category === filterCategory
  );

  const stats = {
    critical: filteredRisks.filter((r) => r.score >= 15).length,
    high: filteredRisks.filter((r) => r.score >= 10 && r.score < 15).length,
    medium: filteredRisks.filter((r) => r.score >= 5 && r.score < 10).length,
    low: filteredRisks.filter((r) => r.score < 5).length,
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-red-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.critical}</p>
              <p className="text-sm text-gray-600">Critical Risks</p>
            </div>
            <div className="h-8 w-8 bg-red-500 rounded"></div>
          </div>
        </div>
        <div className="bg-orange-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.high}</p>
              <p className="text-sm text-gray-600">High Risks</p>
            </div>
            <div className="h-8 w-8 bg-orange-500 rounded"></div>
          </div>
        </div>
        <div className="bg-yellow-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.medium}</p>
              <p className="text-sm text-gray-600">Medium Risks</p>
            </div>
            <div className="h-8 w-8 bg-yellow-500 rounded"></div>
          </div>
        </div>
        <div className="bg-green-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.low}</p>
              <p className="text-sm text-gray-600">Low Risks</p>
            </div>
            <div className="h-8 w-8 bg-green-500 rounded"></div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <FunnelIcon className="h-5 w-5 text-gray-400" />
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            {categories.map((cat) => (
              <option key={cat} value={cat.toLowerCase()}>
                {cat}
              </option>
            ))}
          </select>
        </div>
        <div className="text-sm text-gray-600">{filteredRisks.length} risks identified</div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Risk Heat Map</h3>

        <div className="flex">
          <div className="flex flex-col justify-end pr-2">
            <div
              className="text-xs font-medium text-gray-600 mb-2 -rotate-90 origin-bottom"
              style={{ width: '20px' }}
            >
              Likelihood
            </div>
          </div>

          <div className="flex-1">
            <div className="grid grid-cols-5 gap-1">
              {[5, 4, 3, 2, 1].map((likelihood) => (
                <React.Fragment key={likelihood}>
                  {[1, 2, 3, 4, 5].map((impact) => {
                    const risksInCell = getRisksInCell(likelihood, impact);
                    const isSelected =
                      selectedCell?.likelihood === likelihood && selectedCell?.impact === impact;

                    return (
                      <div
                        key={`${likelihood}-${impact}`}
                        onClick={() => setSelectedCell({ likelihood, impact })}
                        className={`
                          relative h-20 rounded cursor-pointer transition-all
                          ${getCellColor(likelihood, impact)}
                          ${isSelected ? 'ring-2 ring-primary-500' : ''}
                        `}
                      >
                        {risksInCell.length > 0 && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="text-center">
                              <div className="text-2xl font-bold text-gray-700">
                                {risksInCell.length}
                              </div>
                              <div className="text-xs text-gray-600">risks</div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>

            <div className="flex justify-between mt-2 px-1">
              {impactLabels.map((label, index) => (
                <div
                  key={label}
                  className="text-xs text-gray-600 text-center"
                  style={{ width: '20%' }}
                >
                  {label}
                </div>
              ))}
            </div>
            <div className="text-xs font-medium text-gray-600 text-center mt-2">Impact</div>
          </div>

          <div className="flex flex-col justify-between ml-2">
            {[5, 4, 3, 2, 1].map((likelihood, index) => (
              <div key={likelihood} className="text-xs text-gray-600 h-20 flex items-center">
                {likelihoodLabels[5 - likelihood]}
              </div>
            ))}
          </div>
        </div>
      </div>

      {selectedCell && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h4 className="font-semibold text-gray-900 mb-3">
            Risks: {likelihoodLabels[selectedCell.likelihood - 1]} Likelihood ×{' '}
            {impactLabels[selectedCell.impact - 1]} Impact
          </h4>
          <div className="space-y-2">
            {getRisksInCell(selectedCell.likelihood, selectedCell.impact).map((risk) => (
              <div
                key={risk.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className={`h-3 w-3 rounded-full ${getRiskColor(risk.score)}`}></div>
                  <div>
                    <p className="font-medium text-gray-900">{risk.title}</p>
                    <p className="text-sm text-gray-600">
                      {risk.category} • Owner: {risk.owner}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {risk.trend === 'increasing' && (
                    <ArrowTrendingUpIcon className="h-4 w-4 text-red-600" />
                  )}
                  {risk.trend === 'decreasing' && (
                    <ArrowTrendingDownIcon className="h-4 w-4 text-green-600" />
                  )}
                  <span className="text-sm font-medium text-gray-700">Score: {risk.score}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
