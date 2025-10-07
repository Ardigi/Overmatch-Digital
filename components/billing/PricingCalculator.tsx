'use client';

import { InformationCircleIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';
import { LoadingButton } from '@/components/ui/LoadingSpinner';
import { usePricingCalculator } from '@/hooks/api/useBilling';

interface CalculatorInputs {
  auditType: 'SOC1' | 'SOC2' | 'Both';
  reportType: 'Type I' | 'Type II';
  organizationSize: 'small' | 'medium' | 'large' | 'enterprise';
  numberOfSystems: number;
  numberOfLocations: number;
  trustServicesCriteria: string[];
  includeReadiness: boolean;
  includePenTest: boolean;
  includeRiskAssessment: boolean;
  contractLength: 1 | 2 | 3;
}

export default function PricingCalculator() {
  const [inputs, setInputs] = useState<CalculatorInputs>({
    auditType: 'SOC2',
    reportType: 'Type II',
    organizationSize: 'medium',
    numberOfSystems: 5,
    numberOfLocations: 1,
    trustServicesCriteria: ['Security'],
    includeReadiness: true,
    includePenTest: false,
    includeRiskAssessment: false,
    contractLength: 1,
  });

  const pricingCalculator = usePricingCalculator();

  const handleCalculate = async () => {
    // Map inputs to API format
    const apiInputs = {
      auditType: (inputs.auditType.toLowerCase() +
        '-' +
        inputs.reportType.toLowerCase().replace(' ', '')) as any,
      entityCount: 1, // Default to 1 entity
      locationCount: inputs.numberOfLocations,
      controlCount: inputs.numberOfSystems * 10, // Estimate controls based on systems
      complexity:
        inputs.organizationSize === 'enterprise'
          ? ('high' as const)
          : inputs.organizationSize === 'large'
            ? ('medium' as const)
            : ('low' as const),
      addOns: [
        ...(inputs.includeReadiness ? ['readiness-assessment'] : []),
        ...(inputs.includePenTest ? ['penetration-testing'] : []),
        ...(inputs.includeRiskAssessment ? ['risk-assessment'] : []),
        ...inputs.trustServicesCriteria
          .filter((c) => c !== 'Security')
          .map((c) => `tsc-${c.toLowerCase()}`),
      ],
    };

    await pricingCalculator.mutate(apiInputs);
  };

  // Use local calculation for immediate feedback, API result for final price
  const localPricing = {
    basePrice: 30000,
    addOns: 0,
    discount: 0,
    total: 30000,
    annual: 30000,
  };

  const pricing = pricingCalculator.data || localPricing;

  const toggleCriteria = (criteria: string) => {
    setInputs((prev) => ({
      ...prev,
      trustServicesCriteria: prev.trustServicesCriteria.includes(criteria)
        ? prev.trustServicesCriteria.filter((c) => c !== criteria)
        : [...prev.trustServicesCriteria, criteria],
    }));
  };

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <InformationCircleIcon className="h-5 w-5 text-blue-600 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-semibold mb-1">SOC Audit Pricing Ranges (Industry Standards)</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Type I Reports: $5,000 - $20,000</li>
              <li>Type II Reports: $7,000 - $150,000</li>
              <li>Readiness Assessments: $10,000 - $17,000</li>
              <li>Total SOC 2 Project: $80,000 - $350,000</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Audit Configuration</h3>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Audit Type</label>
            <select
              value={inputs.auditType}
              onChange={(e) =>
                setInputs({ ...inputs, auditType: e.target.value as CalculatorInputs['auditType'] })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="SOC1">SOC 1</option>
              <option value="SOC2">SOC 2</option>
              <option value="Both">Both SOC 1 & SOC 2</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Report Type</label>
            <div className="flex gap-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="Type I"
                  checked={inputs.reportType === 'Type I'}
                  onChange={(e) =>
                    setInputs({
                      ...inputs,
                      reportType: e.target.value as CalculatorInputs['reportType'],
                    })
                  }
                  className="mr-2"
                />
                Type I (Point in Time)
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="Type II"
                  checked={inputs.reportType === 'Type II'}
                  onChange={(e) =>
                    setInputs({
                      ...inputs,
                      reportType: e.target.value as CalculatorInputs['reportType'],
                    })
                  }
                  className="mr-2"
                />
                Type II (3-12 Months)
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Organization Size
            </label>
            <select
              value={inputs.organizationSize}
              onChange={(e) =>
                setInputs({
                  ...inputs,
                  organizationSize: e.target.value as CalculatorInputs['organizationSize'],
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="small">Small (1-50 employees)</option>
              <option value="medium">Medium (51-250 employees)</option>
              <option value="large">Large (251-1000 employees)</option>
              <option value="enterprise">Enterprise (1000+ employees)</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Number of Systems
              </label>
              <input
                type="number"
                min="1"
                value={inputs.numberOfSystems}
                onChange={(e) =>
                  setInputs({ ...inputs, numberOfSystems: parseInt(e.target.value) || 1 })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Number of Locations
              </label>
              <input
                type="number"
                min="1"
                value={inputs.numberOfLocations}
                onChange={(e) =>
                  setInputs({ ...inputs, numberOfLocations: parseInt(e.target.value) || 1 })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>

          {inputs.auditType !== 'SOC1' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Trust Services Criteria
              </label>
              <div className="space-y-2">
                {[
                  'Security',
                  'Availability',
                  'Processing Integrity',
                  'Confidentiality',
                  'Privacy',
                ].map((criteria) => (
                  <label key={criteria} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={inputs.trustServicesCriteria.includes(criteria)}
                      onChange={() => toggleCriteria(criteria)}
                      disabled={criteria === 'Security'}
                      className="mr-2"
                    />
                    {criteria} {criteria === 'Security' && '(Required)'}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Additional Services
            </label>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={inputs.includeReadiness}
                  onChange={(e) => setInputs({ ...inputs, includeReadiness: e.target.checked })}
                  className="mr-2"
                />
                Readiness Assessment
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={inputs.includePenTest}
                  onChange={(e) => setInputs({ ...inputs, includePenTest: e.target.checked })}
                  className="mr-2"
                />
                Penetration Testing
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={inputs.includeRiskAssessment}
                  onChange={(e) =>
                    setInputs({ ...inputs, includeRiskAssessment: e.target.checked })
                  }
                  className="mr-2"
                />
                Risk Assessment
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Contract Length</label>
            <select
              value={inputs.contractLength}
              onChange={(e) =>
                setInputs({
                  ...inputs,
                  contractLength: parseInt(e.target.value) as CalculatorInputs['contractLength'],
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value={1}>1 Year</option>
              <option value={2}>2 Years (5% discount)</option>
              <option value={3}>3 Years (10% discount)</option>
            </select>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Pricing Estimate</h3>

          <LoadingButton
            onClick={handleCalculate}
            loading={pricingCalculator.loading}
            className="btn-primary w-full mb-4"
          >
            Calculate Price
          </LoadingButton>

          <div className="bg-gray-50 rounded-lg p-6 space-y-4">
            {pricingCalculator.data ? (
              <>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Base Price</span>
                  <span className="font-semibold">
                    ${pricingCalculator.data.basePrice.toLocaleString()}
                  </span>
                </div>

                {pricingCalculator.data.addOns.length > 0 && (
                  <>
                    <div className="border-t pt-4 space-y-2">
                      {pricingCalculator.data.addOns.map((addon, idx) => (
                        <div key={idx} className="flex justify-between items-center text-sm">
                          <span className="text-gray-600">{addon.name}</span>
                          <span>${addon.price.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Subtotal</span>
                      <span className="font-semibold">
                        ${pricingCalculator.data.subtotal.toLocaleString()}
                      </span>
                    </div>
                  </>
                )}

                {pricingCalculator.data.volumeDiscount > 0 && (
                  <div className="flex justify-between items-center text-green-600">
                    <span>Volume Discount</span>
                    <span>-${pricingCalculator.data.volumeDiscount.toLocaleString()}</span>
                  </div>
                )}

                {pricingCalculator.data.tax > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Tax</span>
                    <span>${pricingCalculator.data.tax.toLocaleString()}</span>
                  </div>
                )}

                <div className="border-t pt-4">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-semibold">Total Cost</span>
                    <span className="text-2xl font-bold text-primary-600">
                      ${pricingCalculator.data.total.toLocaleString()}
                    </span>
                  </div>
                  {pricingCalculator.data.savings && pricingCalculator.data.savings > 0 && (
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-sm text-green-600">Total Savings</span>
                      <span className="text-lg font-semibold text-green-600">
                        ${pricingCalculator.data.savings.toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p>Configure your requirements and click "Calculate Price" to see pricing</p>
              </div>
            )}
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-blue-900 mb-2">Pricing Factors</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Organization size and complexity</li>
              <li>• Number of systems and locations</li>
              <li>• Trust Services Criteria in scope</li>
              <li>• Type of audit (I vs II)</li>
              <li>• Client readiness and maturity</li>
              <li>• Geographic location</li>
            </ul>
          </div>

          <div className="flex gap-3">
            <button className="btn-primary flex-1">Generate Proposal</button>
            <button className="btn-secondary flex-1">Save Estimate</button>
          </div>
        </div>
      </div>
    </div>
  );
}
