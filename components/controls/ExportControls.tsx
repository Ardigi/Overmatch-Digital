'use client';

import { Fragment, useState } from 'react';
import { Dialog, Transition, RadioGroup } from '@headlessui/react';
import { 
  XMarkIcon, 
  ArrowDownTrayIcon,
  DocumentTextIcon,
  TableCellsIcon,
  ChartBarIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { useExportControlsReport } from '@/hooks/api/useControls';

interface ExportControlsProps {
  isOpen: boolean;
  onClose: () => void;
}

type ExportFormat = 'pdf' | 'xlsx' | 'csv';

interface ExportOption {
  id: ExportFormat;
  name: string;
  description: string;
  icon: any;
  recommended?: boolean;
}

const exportOptions: ExportOption[] = [
  {
    id: 'pdf',
    name: 'PDF Report',
    description: 'Professional formatted report with charts and graphs',
    icon: DocumentTextIcon,
    recommended: true,
  },
  {
    id: 'xlsx',
    name: 'Excel Workbook',
    description: 'Multi-sheet workbook with detailed data and pivot tables',
    icon: TableCellsIcon,
  },
  {
    id: 'csv',
    name: 'CSV File',
    description: 'Simple comma-separated values for data analysis',
    icon: ChartBarIcon,
  },
];

const FRAMEWORKS = [
  { id: 'ALL', name: 'All Frameworks' },
  { id: 'SOC2_SECURITY', name: 'SOC 2 - Security' },
  { id: 'SOC2_AVAILABILITY', name: 'SOC 2 - Availability' },
  { id: 'SOC2_CONFIDENTIALITY', name: 'SOC 2 - Confidentiality' },
  { id: 'SOC2_PROCESSING_INTEGRITY', name: 'SOC 2 - Processing Integrity' },
  { id: 'SOC2_PRIVACY', name: 'SOC 2 - Privacy' },
  { id: 'ISO27001', name: 'ISO 27001' },
  { id: 'NIST', name: 'NIST Cybersecurity Framework' },
  { id: 'HIPAA', name: 'HIPAA' },
  { id: 'PCI_DSS', name: 'PCI DSS' },
  { id: 'GDPR', name: 'GDPR' },
];

const STATUSES = [
  { id: 'ALL', name: 'All Statuses' },
  { id: 'IMPLEMENTED', name: 'Implemented' },
  { id: 'PARTIALLY_IMPLEMENTED', name: 'Partially Implemented' },
  { id: 'NOT_IMPLEMENTED', name: 'Not Implemented' },
  { id: 'NOT_APPLICABLE', name: 'Not Applicable' },
];

export default function ExportControls({ isOpen, onClose }: ExportControlsProps) {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('pdf');
  const [selectedFramework, setSelectedFramework] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [includeEvidence, setIncludeEvidence] = useState(true);
  const [includeTestResults, setIncludeTestResults] = useState(true);
  const [includeGaps, setIncludeGaps] = useState(true);
  const [includeMetrics, setIncludeMetrics] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  const { exportReport } = useExportControlsReport();

  const handleExport = async () => {
    setIsExporting(true);
    
    try {
      const filters = {
        framework: selectedFramework !== 'ALL' ? selectedFramework : undefined,
        status: selectedStatus !== 'ALL' ? selectedStatus : undefined,
        includeEvidence,
        includeTestResults,
        includeGaps,
        includeMetrics,
      };

      await exportReport(selectedFormat, filters);
      
      toast.success(`Export completed successfully`);
      onClose();
    } catch (error) {
      toast.error('Failed to export controls');
      console.error('Export error:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const selectedOption = exportOptions.find(opt => opt.id === selectedFormat)!;

  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-2xl">
                <div className="bg-white px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
                  <div className="sm:flex sm:items-start">
                    <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left w-full">
                      <Dialog.Title as="h3" className="text-lg font-semibold leading-6 text-gray-900">
                        Export Controls Matrix
                      </Dialog.Title>
                      
                      <div className="mt-6 space-y-6">
                        {/* Export Format Selection */}
                        <div>
                          <label className="text-sm font-medium text-gray-700">Export Format</label>
                          <RadioGroup value={selectedFormat} onChange={setSelectedFormat} className="mt-2">
                            <div className="space-y-2">
                              {exportOptions.map((option) => (
                                <RadioGroup.Option
                                  key={option.id}
                                  value={option.id}
                                  className={({ active, checked }) =>
                                    `${active ? 'ring-2 ring-primary-500' : ''}
                                    ${checked ? 'bg-primary-50 border-primary-200' : 'bg-white'}
                                    relative flex cursor-pointer rounded-lg px-5 py-4 border focus:outline-none`
                                  }
                                >
                                  {({ checked }) => (
                                    <div className="flex w-full items-center justify-between">
                                      <div className="flex items-center">
                                        <div className="flex items-center">
                                          <option.icon className="h-6 w-6 text-gray-400 mr-3" />
                                          <div className="text-sm">
                                            <RadioGroup.Label
                                              as="p"
                                              className={`font-medium ${
                                                checked ? 'text-primary-900' : 'text-gray-900'
                                              }`}
                                            >
                                              {option.name}
                                              {option.recommended && (
                                                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                                  Recommended
                                                </span>
                                              )}
                                            </RadioGroup.Label>
                                            <RadioGroup.Description
                                              as="span"
                                              className={`inline ${
                                                checked ? 'text-primary-600' : 'text-gray-500'
                                              }`}
                                            >
                                              {option.description}
                                            </RadioGroup.Description>
                                          </div>
                                        </div>
                                      </div>
                                      {checked && (
                                        <div className="shrink-0 text-primary-600">
                                          <CheckIcon className="h-6 w-6" />
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </RadioGroup.Option>
                              ))}
                            </div>
                          </RadioGroup>
                        </div>

                        {/* Filters */}
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <div>
                            <label htmlFor="framework" className="block text-sm font-medium text-gray-700">
                              Framework
                            </label>
                            <select
                              id="framework"
                              value={selectedFramework}
                              onChange={(e) => setSelectedFramework(e.target.value)}
                              className="mt-1 block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-primary-500 focus:outline-none focus:ring-primary-500 sm:text-sm"
                            >
                              {FRAMEWORKS.map((framework) => (
                                <option key={framework.id} value={framework.id}>
                                  {framework.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label htmlFor="status" className="block text-sm font-medium text-gray-700">
                              Implementation Status
                            </label>
                            <select
                              id="status"
                              value={selectedStatus}
                              onChange={(e) => setSelectedStatus(e.target.value)}
                              className="mt-1 block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-primary-500 focus:outline-none focus:ring-primary-500 sm:text-sm"
                            >
                              {STATUSES.map((status) => (
                                <option key={status.id} value={status.id}>
                                  {status.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Include Options */}
                        <div>
                          <label className="text-sm font-medium text-gray-700">Include in Export</label>
                          <div className="mt-2 space-y-2">
                            <label className="flex items-center">
                              <input
                                type="checkbox"
                                checked={includeEvidence}
                                onChange={(e) => setIncludeEvidence(e.target.checked)}
                                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                              />
                              <span className="ml-2 text-sm text-gray-700">Evidence Documentation</span>
                            </label>
                            <label className="flex items-center">
                              <input
                                type="checkbox"
                                checked={includeTestResults}
                                onChange={(e) => setIncludeTestResults(e.target.checked)}
                                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                              />
                              <span className="ml-2 text-sm text-gray-700">Test Results & History</span>
                            </label>
                            <label className="flex items-center">
                              <input
                                type="checkbox"
                                checked={includeGaps}
                                onChange={(e) => setIncludeGaps(e.target.checked)}
                                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                              />
                              <span className="ml-2 text-sm text-gray-700">Gap Analysis & Remediation Plans</span>
                            </label>
                            <label className="flex items-center">
                              <input
                                type="checkbox"
                                checked={includeMetrics}
                                onChange={(e) => setIncludeMetrics(e.target.checked)}
                                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                              />
                              <span className="ml-2 text-sm text-gray-700">Performance Metrics & KPIs</span>
                            </label>
                          </div>
                        </div>

                        {/* Export Preview */}
                        <div className="bg-gray-50 rounded-lg p-4">
                          <h4 className="text-sm font-medium text-gray-900 mb-2">Export Preview</h4>
                          <div className="text-sm text-gray-600 space-y-1">
                            <p>Format: <span className="font-medium">{selectedOption.name}</span></p>
                            <p>Framework: <span className="font-medium">{FRAMEWORKS.find(f => f.id === selectedFramework)?.name}</span></p>
                            <p>Status Filter: <span className="font-medium">{STATUSES.find(s => s.id === selectedStatus)?.name}</span></p>
                            <p>Sections: <span className="font-medium">
                              {[
                                includeEvidence && 'Evidence',
                                includeTestResults && 'Test Results',
                                includeGaps && 'Gap Analysis',
                                includeMetrics && 'Metrics',
                              ].filter(Boolean).join(', ') || 'Basic controls only'}
                            </span></p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
                  <button
                    type="button"
                    onClick={handleExport}
                    disabled={isExporting}
                    className="inline-flex w-full justify-center items-center rounded-md bg-primary-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-500 disabled:opacity-50 disabled:cursor-not-allowed sm:ml-3 sm:w-auto"
                  >
                    {isExporting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Exporting...
                      </>
                    ) : (
                      <>
                        <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
                        Export {selectedOption.name}
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={isExporting}
                    className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed sm:mt-0 sm:w-auto"
                  >
                    Cancel
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
}