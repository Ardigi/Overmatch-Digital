'use client';

import { Fragment, useState, useCallback } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { useDropzone } from 'react-dropzone';
import {
  XMarkIcon,
  ArrowUpTrayIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowDownTrayIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { useBulkImportControls } from '@/hooks/api/useControls';

interface BulkImportControlsProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface ImportPreview {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  errors: Array<{
    row: number;
    field: string;
    message: string;
  }>;
  preview: Array<{
    code: string;
    name: string;
    description: string;
    category: string;
    type: string;
    framework: string;
  }>;
}

export default function BulkImportControls({ isOpen, onClose, onSuccess }: BulkImportControlsProps) {
  const [file, setFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [currentStep, setCurrentStep] = useState<'upload' | 'preview' | 'importing'>('upload');

  const { mutate: bulkImport, loading: importing } = useBulkImportControls({
    onSuccess: (result) => {
      toast.success(`Successfully imported ${result.imported} controls`);
      onSuccess?.();
      handleClose();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to import controls');
      setCurrentStep('preview');
    },
  });

  const handleClose = () => {
    setFile(null);
    setImportPreview(null);
    setCurrentStep('upload');
    onClose();
  };

  const validateFile = async (file: File) => {
    setIsValidating(true);
    
    try {
      // In a real implementation, this would send the file to the backend for validation
      // For now, we'll simulate the validation process
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock validation result
      const mockPreview: ImportPreview = {
        totalRows: 10,
        validRows: 8,
        invalidRows: 2,
        errors: [
          { row: 3, field: 'code', message: 'Control code already exists' },
          { row: 7, field: 'framework', message: 'Invalid framework specified' },
        ],
        preview: [
          {
            code: 'AC-001',
            name: 'User Access Management',
            description: 'Controls for managing user access',
            category: 'ACCESS_CONTROL',
            type: 'PREVENTIVE',
            framework: 'SOC2_SECURITY',
          },
          {
            code: 'AC-002',
            name: 'Privileged Access Management',
            description: 'Controls for managing privileged access',
            category: 'ACCESS_CONTROL',
            type: 'PREVENTIVE',
            framework: 'SOC2_SECURITY',
          },
        ],
      };
      
      setImportPreview(mockPreview);
      setCurrentStep('preview');
    } catch (error) {
      toast.error('Failed to validate file');
    } finally {
      setIsValidating(false);
    }
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      setFile(file);
      validateFile(file);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    },
    maxFiles: 1,
    disabled: isValidating || importing,
  });

  const handleImport = () => {
    if (!file || !importPreview) return;
    
    setCurrentStep('importing');
    
    // Create FormData for file upload
    const formData = new FormData();
    formData.append('file', file);
    
    bulkImport(formData as any);
  };

  const downloadTemplate = () => {
    // Create CSV template
    const headers = ['code', 'name', 'description', 'category', 'type', 'frequency', 'framework', 'priority', 'notes'];
    const exampleRow = [
      'AC-001',
      'User Access Management',
      'Controls for managing user access to systems',
      'ACCESS_CONTROL',
      'PREVENTIVE',
      'MONTHLY',
      'SOC2_SECURITY',
      'HIGH',
      'Implement role-based access control'
    ];
    
    const csvContent = [
      headers.join(','),
      exampleRow.join(','),
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'controls_import_template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast.success('Template downloaded');
  };

  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={handleClose}>
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
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-3xl">
                <div className="bg-white px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
                  <div className="sm:flex sm:items-start">
                    <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left w-full">
                      <Dialog.Title as="h3" className="text-lg font-semibold leading-6 text-gray-900">
                        Bulk Import Controls
                      </Dialog.Title>
                      
                      {/* Progress Steps */}
                      <div className="mt-6">
                        <nav aria-label="Progress">
                          <ol className="flex items-center">
                            <li className={`relative ${currentStep === 'upload' ? 'text-primary-600' : 'text-gray-600'}`}>
                              <div className="flex items-center">
                                <span className={`h-8 w-8 rounded-full flex items-center justify-center ${
                                  currentStep === 'upload' ? 'bg-primary-600 text-white' : 'bg-gray-300 text-white'
                                }`}>
                                  1
                                </span>
                                <span className="ml-2 text-sm font-medium">Upload File</span>
                              </div>
                            </li>
                            <li className={`relative ml-8 ${currentStep === 'preview' ? 'text-primary-600' : 'text-gray-600'}`}>
                              <div className="flex items-center">
                                <span className={`h-8 w-8 rounded-full flex items-center justify-center ${
                                  currentStep === 'preview' ? 'bg-primary-600 text-white' : 
                                  currentStep === 'importing' ? 'bg-green-600 text-white' : 'bg-gray-300 text-white'
                                }`}>
                                  {currentStep === 'importing' ? <CheckCircleIcon className="h-5 w-5" /> : '2'}
                                </span>
                                <span className="ml-2 text-sm font-medium">Review & Validate</span>
                              </div>
                            </li>
                            <li className={`relative ml-8 ${currentStep === 'importing' ? 'text-primary-600' : 'text-gray-600'}`}>
                              <div className="flex items-center">
                                <span className={`h-8 w-8 rounded-full flex items-center justify-center ${
                                  currentStep === 'importing' ? 'bg-primary-600 text-white' : 'bg-gray-300 text-white'
                                }`}>
                                  3
                                </span>
                                <span className="ml-2 text-sm font-medium">Import</span>
                              </div>
                            </li>
                          </ol>
                        </nav>
                      </div>

                      {/* Content based on current step */}
                      <div className="mt-6">
                        {currentStep === 'upload' && (
                          <div>
                            {/* Download Template */}
                            <div className="mb-4 p-4 bg-blue-50 rounded-lg">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-sm font-medium text-blue-900">Need a template?</p>
                                  <p className="text-sm text-blue-700">Download our CSV template with all required fields</p>
                                </div>
                                <button
                                  onClick={downloadTemplate}
                                  className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                >
                                  <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
                                  Download Template
                                </button>
                              </div>
                            </div>

                            {/* File Upload */}
                            <div
                              {...getRootProps()}
                              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                                isDragActive ? 'border-primary-500 bg-primary-50' : 'border-gray-300 hover:border-gray-400'
                              } ${isValidating ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                              <input {...getInputProps()} />
                              <ArrowUpTrayIcon className="mx-auto h-12 w-12 text-gray-400" />
                              <p className="mt-2 text-sm text-gray-900">
                                {isDragActive ? 'Drop the file here' : 'Drag and drop your file here, or click to browse'}
                              </p>
                              <p className="mt-1 text-xs text-gray-500">
                                Supports CSV, XLS, and XLSX files
                              </p>
                              {file && (
                                <div className="mt-4 inline-flex items-center px-3 py-2 border border-gray-300 rounded-md bg-white">
                                  <DocumentTextIcon className="h-5 w-5 text-gray-400 mr-2" />
                                  <span className="text-sm text-gray-900">{file.name}</span>
                                  {isValidating && (
                                    <div className="ml-2">
                                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* File Format Instructions */}
                            <div className="mt-4 text-sm text-gray-600">
                              <p className="font-medium mb-2">Required columns:</p>
                              <ul className="list-disc list-inside space-y-1">
                                <li><code className="bg-gray-100 px-1">code</code> - Unique control identifier</li>
                                <li><code className="bg-gray-100 px-1">name</code> - Control name</li>
                                <li><code className="bg-gray-100 px-1">description</code> - Control description</li>
                                <li><code className="bg-gray-100 px-1">category</code> - Category (e.g., ACCESS_CONTROL)</li>
                                <li><code className="bg-gray-100 px-1">type</code> - Type (PREVENTIVE, DETECTIVE, CORRECTIVE)</li>
                                <li><code className="bg-gray-100 px-1">framework</code> - Framework (e.g., SOC2_SECURITY)</li>
                              </ul>
                            </div>
                          </div>
                        )}

                        {currentStep === 'preview' && importPreview && (
                          <div>
                            {/* Validation Summary */}
                            <div className="mb-4">
                              <div className="grid grid-cols-3 gap-4">
                                <div className="bg-gray-50 p-4 rounded-lg">
                                  <p className="text-sm text-gray-500">Total Rows</p>
                                  <p className="text-2xl font-semibold text-gray-900">{importPreview.totalRows}</p>
                                </div>
                                <div className="bg-green-50 p-4 rounded-lg">
                                  <p className="text-sm text-green-600">Valid Rows</p>
                                  <p className="text-2xl font-semibold text-green-900">{importPreview.validRows}</p>
                                </div>
                                <div className="bg-red-50 p-4 rounded-lg">
                                  <p className="text-sm text-red-600">Invalid Rows</p>
                                  <p className="text-2xl font-semibold text-red-900">{importPreview.invalidRows}</p>
                                </div>
                              </div>
                            </div>

                            {/* Validation Errors */}
                            {importPreview.errors.length > 0 && (
                              <div className="mb-4 p-4 bg-red-50 rounded-lg">
                                <div className="flex items-center mb-2">
                                  <ExclamationTriangleIcon className="h-5 w-5 text-red-600 mr-2" />
                                  <p className="text-sm font-medium text-red-900">Validation Errors</p>
                                </div>
                                <ul className="space-y-1">
                                  {importPreview.errors.map((error, index) => (
                                    <li key={index} className="text-sm text-red-700">
                                      Row {error.row}: {error.field} - {error.message}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Preview Table */}
                            <div className="border border-gray-200 rounded-lg overflow-hidden">
                              <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                  <tr>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Framework</th>
                                  </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                  {importPreview.preview.slice(0, 5).map((row, index) => (
                                    <tr key={index}>
                                      <td className="px-4 py-2 text-sm text-gray-900">{row.code}</td>
                                      <td className="px-4 py-2 text-sm text-gray-900">{row.name}</td>
                                      <td className="px-4 py-2 text-sm text-gray-500">{row.category}</td>
                                      <td className="px-4 py-2 text-sm text-gray-500">{row.type}</td>
                                      <td className="px-4 py-2 text-sm text-gray-500">{row.framework}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                              {importPreview.preview.length > 5 && (
                                <div className="bg-gray-50 px-4 py-2 text-sm text-gray-500 text-center">
                                  ... and {importPreview.preview.length - 5} more rows
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {currentStep === 'importing' && (
                          <div className="text-center py-8">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
                            <p className="mt-4 text-sm text-gray-600">Importing controls...</p>
                            <p className="text-xs text-gray-500">This may take a few moments</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
                  {currentStep === 'preview' && importPreview && (
                    <>
                      <button
                        type="button"
                        onClick={handleImport}
                        disabled={importPreview.validRows === 0}
                        className="inline-flex w-full justify-center rounded-md bg-primary-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-500 disabled:opacity-50 disabled:cursor-not-allowed sm:ml-3 sm:w-auto"
                      >
                        Import {importPreview.validRows} Valid Controls
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCurrentStep('upload');
                          setImportPreview(null);
                        }}
                        className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto"
                      >
                        Back
                      </button>
                    </>
                  )}
                  {currentStep === 'upload' && (
                    <button
                      type="button"
                      onClick={handleClose}
                      className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
}