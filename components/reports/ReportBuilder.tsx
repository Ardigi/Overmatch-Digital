'use client';

import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CalendarIcon,
  ChartBarIcon,
  CheckIcon,
  DocumentIcon,
  EyeIcon,
  PhotoIcon,
  PlusIcon,
  TableCellsIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface ReportSection {
  id: string;
  type: 'text' | 'chart' | 'table' | 'image' | 'metric';
  title: string;
  content?: any;
}

interface ReportConfig {
  title: string;
  type: string;
  period: {
    start: string;
    end: string;
  };
  sections: ReportSection[];
  format: 'pdf' | 'excel' | 'word';
  recipients: string[];
}

const sectionTypes = [
  { id: 'text', name: 'Text Section', icon: DocumentIcon },
  { id: 'chart', name: 'Chart', icon: ChartBarIcon },
  { id: 'table', name: 'Table', icon: TableCellsIcon },
  { id: 'metric', name: 'Metrics', icon: ChartBarIcon },
  { id: 'image', name: 'Image', icon: PhotoIcon },
];

export default function ReportBuilder() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [reportConfig, setReportConfig] = useState<ReportConfig>({
    title: '',
    type: 'soc2',
    period: {
      start: '2024-01-01',
      end: '2024-03-31',
    },
    sections: [],
    format: 'pdf',
    recipients: [],
  });

  const steps = [
    { id: 1, name: 'Basic Info' },
    { id: 2, name: 'Content' },
    { id: 3, name: 'Review' },
    { id: 4, name: 'Generate' },
  ];

  const addSection = (type: string) => {
    const newSection: ReportSection = {
      id: Date.now().toString(),
      type: type as ReportSection['type'],
      title: `New ${type} section`,
    };
    setReportConfig({
      ...reportConfig,
      sections: [...reportConfig.sections, newSection],
    });
  };

  const removeSection = (id: string) => {
    setReportConfig({
      ...reportConfig,
      sections: reportConfig.sections.filter((s) => s.id !== id),
    });
  };

  const updateSection = (id: string, updates: Partial<ReportSection>) => {
    setReportConfig({
      ...reportConfig,
      sections: reportConfig.sections.map((s) => (s.id === id ? { ...s, ...updates } : s)),
    });
  };

  const handleNext = () => {
    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleGenerate = () => {
    console.log('Generating report:', reportConfig);
    // In a real app, this would trigger report generation
    router.push('/dashboard/reports');
  };

  return (
    <div className="bg-white rounded-lg shadow-lg">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <button
              onClick={() => router.push('/dashboard/reports')}
              className="mr-4 p-2 rounded-lg hover:bg-gray-100"
            >
              <ArrowLeftIcon className="h-5 w-5 text-gray-600" />
            </button>
            <h1 className="text-xl font-semibold text-gray-900">Report Builder</h1>
          </div>
          <button className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
            <EyeIcon className="h-4 w-4 mr-1.5" />
            Preview
          </button>
        </div>

        {/* Progress Steps */}
        <div className="mt-6">
          <nav aria-label="Progress">
            <ol className="flex items-center">
              {steps.map((step, stepIdx) => (
                <li key={step.id} className={stepIdx !== steps.length - 1 ? 'flex-1' : ''}>
                  <div
                    className={`flex items-center ${
                      step.id < currentStep
                        ? 'text-primary-600'
                        : step.id === currentStep
                          ? 'text-primary-600'
                          : 'text-gray-500'
                    }`}
                  >
                    <span
                      className={`flex h-10 w-10 items-center justify-center rounded-full border-2 ${
                        step.id < currentStep
                          ? 'border-primary-600 bg-primary-600'
                          : step.id === currentStep
                            ? 'border-primary-600'
                            : 'border-gray-300'
                      }`}
                    >
                      {step.id < currentStep ? (
                        <CheckIcon className="h-6 w-6 text-white" />
                      ) : (
                        <span className={step.id === currentStep ? 'text-primary-600' : ''}>
                          {step.id}
                        </span>
                      )}
                    </span>
                    <span className="ml-2 text-sm font-medium">{step.name}</span>
                  </div>
                  {stepIdx !== steps.length - 1 && (
                    <div
                      className={`ml-5 mt-2 h-0.5 flex-1 ${
                        step.id < currentStep ? 'bg-primary-600' : 'bg-gray-200'
                      }`}
                    />
                  )}
                </li>
              ))}
            </ol>
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-6">
        {/* Step 1: Basic Info */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">Report Title</label>
              <input
                type="text"
                value={reportConfig.title}
                onChange={(e) => setReportConfig({ ...reportConfig, title: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                placeholder="e.g., Q1 2024 SOC 2 Type II Report"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Report Type</label>
              <select
                value={reportConfig.type}
                onChange={(e) => setReportConfig({ ...reportConfig, type: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
              >
                <option value="soc1">SOC 1</option>
                <option value="soc2">SOC 2 Type II</option>
                <option value="compliance">Compliance Summary</option>
                <option value="security">Security Assessment</option>
                <option value="custom">Custom Report</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Start Date</label>
                <input
                  type="date"
                  value={reportConfig.period.start}
                  onChange={(e) =>
                    setReportConfig({
                      ...reportConfig,
                      period: { ...reportConfig.period, start: e.target.value },
                    })
                  }
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">End Date</label>
                <input
                  type="date"
                  value={reportConfig.period.end}
                  onChange={(e) =>
                    setReportConfig({
                      ...reportConfig,
                      period: { ...reportConfig.period, end: e.target.value },
                    })
                  }
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Output Format</label>
              <div className="mt-2 space-x-4">
                {['pdf', 'excel', 'word'].map((format) => (
                  <label key={format} className="inline-flex items-center">
                    <input
                      type="radio"
                      value={format}
                      checked={reportConfig.format === format}
                      onChange={(e) =>
                        setReportConfig({
                          ...reportConfig,
                          format: e.target.value as ReportConfig['format'],
                        })
                      }
                      className="text-primary-600 focus:ring-primary-500"
                    />
                    <span className="ml-2 text-sm text-gray-700 capitalize">{format}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Content */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900">Report Sections</h3>
              <p className="mt-1 text-sm text-gray-500">
                Add and organize sections to build your report
              </p>
            </div>

            {/* Section List */}
            <div className="space-y-3">
              {reportConfig.sections.map((section, index) => (
                <div
                  key={section.id}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg"
                >
                  <div className="flex items-center">
                    <span className="text-sm text-gray-500 mr-3">#{index + 1}</span>
                    <input
                      type="text"
                      value={section.title}
                      onChange={(e) => updateSection(section.id, { title: e.target.value })}
                      className="text-sm font-medium text-gray-900 border-0 focus:ring-0 p-0"
                    />
                    <span className="ml-3 text-sm text-gray-500 capitalize">({section.type})</span>
                  </div>
                  <button
                    onClick={() => removeSection(section.id)}
                    className="text-red-600 hover:text-red-500"
                  >
                    <TrashIcon className="h-5 w-5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Add Section Buttons */}
            <div className="border-t border-gray-200 pt-6">
              <h4 className="text-sm font-medium text-gray-900 mb-3">Add Section</h4>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {sectionTypes.map((type) => {
                  const Icon = type.icon;
                  return (
                    <button
                      key={type.id}
                      onClick={() => addSection(type.id)}
                      className="flex flex-col items-center p-3 border border-gray-300 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors"
                    >
                      <Icon className="h-6 w-6 text-gray-600 mb-1" />
                      <span className="text-xs text-gray-700">{type.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Review */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900">Review Report Configuration</h3>
              <p className="mt-1 text-sm text-gray-500">
                Review your report settings before generating
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-6 space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-700">Title</p>
                <p className="mt-1 text-sm text-gray-900">
                  {reportConfig.title || 'Untitled Report'}
                </p>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-700">Type</p>
                <p className="mt-1 text-sm text-gray-900 capitalize">{reportConfig.type}</p>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-700">Period</p>
                <p className="mt-1 text-sm text-gray-900">
                  {reportConfig.period.start} to {reportConfig.period.end}
                </p>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-700">Sections</p>
                <ul className="mt-1 space-y-1">
                  {reportConfig.sections.map((section, index) => (
                    <li key={section.id} className="text-sm text-gray-900">
                      {index + 1}. {section.title}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-700">Format</p>
                <p className="mt-1 text-sm text-gray-900 uppercase">{reportConfig.format}</p>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Generate */}
        {currentStep === 4 && (
          <div className="text-center py-12">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
              <CheckIcon className="h-8 w-8 text-green-600" />
            </div>
            <h3 className="text-lg font-medium text-gray-900">Ready to Generate</h3>
            <p className="mt-2 text-sm text-gray-500">
              Your report is configured and ready to be generated
            </p>
            <button
              onClick={handleGenerate}
              className="mt-6 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
            >
              Generate Report
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
        <button
          onClick={handleBack}
          disabled={currentStep === 1}
          className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ArrowLeftIcon className="h-4 w-4 mr-1.5" />
          Back
        </button>

        {currentStep < steps.length ? (
          <button
            onClick={handleNext}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
          >
            Next
            <ArrowRightIcon className="h-4 w-4 ml-1.5" />
          </button>
        ) : (
          <button
            onClick={handleGenerate}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
          >
            Generate Report
          </button>
        )}
      </div>
    </div>
  );
}
