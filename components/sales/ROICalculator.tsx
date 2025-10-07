'use client';

import {
  ArrowTrendingUpIcon,
  CalculatorIcon,
  ChartBarIcon,
  CheckCircleIcon,
  ClockIcon,
  CurrencyDollarIcon,
  ExclamationTriangleIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import { useState } from 'react';

interface ROIInputs {
  companyName: string;
  annualRevenue: number;
  averageDealSize: number;
  numberOfEmployees: number;
  currentComplianceCost: number;
  timeToComplianceMonths: number;
  lostDealsPerYear: number;
  securityIncidentCost: number;
  auditPreparationHours: number;
  hourlyRate: number;
}

export default function ROICalculator() {
  const [inputs, setInputs] = useState<ROIInputs>({
    companyName: '',
    annualRevenue: 10000000,
    averageDealSize: 250000,
    numberOfEmployees: 100,
    currentComplianceCost: 50000,
    timeToComplianceMonths: 12,
    lostDealsPerYear: 4,
    securityIncidentCost: 150000,
    auditPreparationHours: 500,
    hourlyRate: 150,
  });

  const calculateROI = () => {
    // Based on documentation's value proposition
    const socImplementationCost = 125000; // Average project cost
    const ongoingAnnualCost = 35000; // Continuous monitoring

    // Benefits calculation
    const acceleratedRevenue =
      ((inputs.timeToComplianceMonths - 3) / 12) * inputs.lostDealsPerYear * inputs.averageDealSize;
    const preventedLostDeals = inputs.lostDealsPerYear * inputs.averageDealSize * 0.75; // 75% reduction
    const securityRiskReduction = inputs.securityIncidentCost * 0.6; // 60% risk reduction
    const efficiencyGains = inputs.auditPreparationHours * inputs.hourlyRate * 0.5; // 50% time savings
    const competitiveAdvantage = inputs.annualRevenue * 0.02; // 2% revenue boost

    const totalFirstYearBenefits =
      acceleratedRevenue +
      preventedLostDeals +
      securityRiskReduction +
      efficiencyGains +
      competitiveAdvantage;
    const totalFirstYearCosts = socImplementationCost + ongoingAnnualCost;
    const firstYearROI =
      ((totalFirstYearBenefits - totalFirstYearCosts) / totalFirstYearCosts) * 100;
    const paybackMonths = totalFirstYearCosts / (totalFirstYearBenefits / 12);

    const threeYearBenefits =
      totalFirstYearBenefits +
      (preventedLostDeals + securityRiskReduction + efficiencyGains + competitiveAdvantage) * 2;
    const threeYearCosts = socImplementationCost + ongoingAnnualCost * 3;
    const threeYearROI = ((threeYearBenefits - threeYearCosts) / threeYearCosts) * 100;

    return {
      acceleratedRevenue,
      preventedLostDeals,
      securityRiskReduction,
      efficiencyGains,
      competitiveAdvantage,
      totalFirstYearBenefits,
      totalFirstYearCosts,
      firstYearROI,
      paybackMonths,
      threeYearBenefits,
      threeYearCosts,
      threeYearROI,
    };
  };

  const roi = calculateROI();

  const benefits = [
    {
      icon: ArrowTrendingUpIcon,
      label: 'Accelerated Sales Cycles',
      description: 'Close enterprise deals 3-9 months faster',
      value: roi.acceleratedRevenue,
      color: 'text-green-600',
    },
    {
      icon: ShieldCheckIcon,
      label: 'Prevented Lost Deals',
      description: 'Win deals that require SOC 2 compliance',
      value: roi.preventedLostDeals,
      color: 'text-blue-600',
    },
    {
      icon: ExclamationTriangleIcon,
      label: 'Reduced Security Risk',
      description: '60% reduction in incident probability',
      value: roi.securityRiskReduction,
      color: 'text-red-600',
    },
    {
      icon: ClockIcon,
      label: 'Operational Efficiency',
      description: '50% reduction in audit preparation time',
      value: roi.efficiencyGains,
      color: 'text-purple-600',
    },
    {
      icon: ChartBarIcon,
      label: 'Competitive Advantage',
      description: 'Market differentiation and trust',
      value: roi.competitiveAdvantage,
      color: 'text-indigo-600',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <CalculatorIcon className="h-5 w-5 text-blue-600 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-semibold mb-1">ROI Justification Tool</p>
            <p>
              Calculate the financial impact of SOC 2 compliance for your prospects. Based on
              industry averages and our client success metrics.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Company Information</h3>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
            <input
              type="text"
              value={inputs.companyName}
              onChange={(e) => setInputs({ ...inputs, companyName: e.target.value })}
              placeholder="Prospect Company Name"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Annual Revenue</label>
              <input
                type="number"
                value={inputs.annualRevenue}
                onChange={(e) =>
                  setInputs({ ...inputs, annualRevenue: parseInt(e.target.value) || 0 })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Employees</label>
              <input
                type="number"
                value={inputs.numberOfEmployees}
                onChange={(e) =>
                  setInputs({ ...inputs, numberOfEmployees: parseInt(e.target.value) || 0 })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>

          <h3 className="text-lg font-semibold text-gray-900 mt-6">Current State</h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Average Deal Size
              </label>
              <input
                type="number"
                value={inputs.averageDealSize}
                onChange={(e) =>
                  setInputs({ ...inputs, averageDealSize: parseInt(e.target.value) || 0 })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Lost Deals/Year (No SOC 2)
              </label>
              <input
                type="number"
                value={inputs.lostDealsPerYear}
                onChange={(e) =>
                  setInputs({ ...inputs, lostDealsPerYear: parseInt(e.target.value) || 0 })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Estimated Security Incident Cost
            </label>
            <input
              type="number"
              value={inputs.securityIncidentCost}
              onChange={(e) =>
                setInputs({ ...inputs, securityIncidentCost: parseInt(e.target.value) || 0 })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Audit Prep Hours/Year
              </label>
              <input
                type="number"
                value={inputs.auditPreparationHours}
                onChange={(e) =>
                  setInputs({ ...inputs, auditPreparationHours: parseInt(e.target.value) || 0 })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hourly Rate</label>
              <input
                type="number"
                value={inputs.hourlyRate}
                onChange={(e) =>
                  setInputs({ ...inputs, hourlyRate: parseInt(e.target.value) || 0 })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Time to Compliance Without Help (Months)
            </label>
            <input
              type="number"
              value={inputs.timeToComplianceMonths}
              onChange={(e) =>
                setInputs({ ...inputs, timeToComplianceMonths: parseInt(e.target.value) || 0 })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">ROI Analysis</h3>

          <div className="bg-gray-50 rounded-lg p-6 space-y-4">
            <div>
              <h4 className="font-semibold text-gray-900 mb-3">First Year Benefits</h4>
              {benefits.map((benefit) => {
                const Icon = benefit.icon;
                return (
                  <div key={benefit.label} className="flex items-start gap-3 mb-3">
                    <Icon className={`h-5 w-5 ${benefit.color} mt-0.5`} />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-gray-900">{benefit.label}</p>
                        <span className="font-semibold">${benefit.value.toLocaleString()}</span>
                      </div>
                      <p className="text-xs text-gray-600">{benefit.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="border-t pt-4">
              <div className="flex justify-between items-center mb-2">
                <span className="font-medium">Total Benefits (Year 1)</span>
                <span className="text-lg font-bold text-green-600">
                  ${roi.totalFirstYearBenefits.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-medium">Investment Required</span>
                <span className="text-lg font-semibold text-red-600">
                  ${roi.totalFirstYearCosts.toLocaleString()}
                </span>
              </div>
            </div>

            <div className="border-t pt-4 space-y-3">
              <div className="bg-green-100 rounded-lg p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-green-900">First Year ROI</span>
                  <span className="text-2xl font-bold text-green-900">
                    {roi.firstYearROI.toFixed(0)}%
                  </span>
                </div>
                <p className="text-xs text-green-700">
                  Payback Period: {roi.paybackMonths.toFixed(1)} months
                </p>
              </div>

              <div className="bg-blue-100 rounded-lg p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-blue-900">3-Year ROI</span>
                  <span className="text-2xl font-bold text-blue-900">
                    {roi.threeYearROI.toFixed(0)}%
                  </span>
                </div>
                <p className="text-xs text-blue-700">
                  Total Value: ${roi.threeYearBenefits.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <button className="btn-primary w-full">Generate ROI Report</button>
            <button className="btn-secondary w-full">Create Proposal with ROI</button>
            <button className="w-full px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
              Save Calculation
            </button>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h4 className="font-semibold text-yellow-900 mb-2 flex items-center gap-2">
              <CheckCircleIcon className="h-5 w-5" />
              Key Selling Points
            </h4>
            <ul className="text-sm text-yellow-800 space-y-1">
              <li>• Faster time to compliance (3 months vs 12+)</li>
              <li>• Automation reduces ongoing costs by 80%</li>
              <li>• Expert guidance ensures first-time success</li>
              <li>• Continuous monitoring prevents gaps</li>
              <li>• CPA partnership for seamless audits</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
