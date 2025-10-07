'use client';

import {
  ArrowDownTrayIcon,
  CheckCircleIcon,
  ClockIcon,
  CloudArrowUpIcon,
  DocumentTextIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  TrashIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useToast } from '@/contexts/ToastContext';
import { formatDate, formatDateTime } from '@/lib/utils';

interface Evidence {
  id: string;
  fileName: string;
  fileSize: number;
  uploadedAt: string;
  uploadedBy: string;
  status: 'pending' | 'approved' | 'rejected';
  control: string;
  description?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  comments?: string;
}

// Mock data
const mockEvidence: Evidence[] = [
  {
    id: '1',
    fileName: 'Access_Control_Policy_2024.pdf',
    fileSize: 2457600,
    uploadedAt: '2024-02-20T10:30:00Z',
    uploadedBy: 'John Smith',
    status: 'approved',
    control: 'CC6.1',
    description: 'Updated access control policy with 2024 revisions',
    reviewedBy: 'Sarah Auditor',
    reviewedAt: '2024-02-21T14:15:00Z',
  },
  {
    id: '2',
    fileName: 'Security_Training_Records_Q1.xlsx',
    fileSize: 1048576,
    uploadedAt: '2024-02-19T09:15:00Z',
    uploadedBy: 'John Smith',
    status: 'pending',
    control: 'CC1.4',
    description: 'Q1 2024 security awareness training completion records',
  },
  {
    id: '3',
    fileName: 'Incident_Response_Test.docx',
    fileSize: 524288,
    uploadedAt: '2024-02-18T16:45:00Z',
    uploadedBy: 'Jane Doe',
    status: 'rejected',
    control: 'CC7.3',
    description: 'Annual incident response plan test results',
    reviewedBy: 'Mike Auditor',
    reviewedAt: '2024-02-19T11:00:00Z',
    comments: 'Missing executive sign-off and test completion date',
  },
];

export default function ClientEvidenceView() {
  const { showSuccess, showError } = useToast();
  const [evidence, setEvidence] = useState<Evidence[]>(mockEvidence);
  const [selectedControl, setSelectedControl] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      for (const file of acceptedFiles) {
        const tempId = `temp-${Date.now()}-${Math.random()}`;

        // Start upload progress
        setUploadProgress((prev) => ({ ...prev, [tempId]: 0 }));

        // Simulate upload progress
        const progressInterval = setInterval(() => {
          setUploadProgress((prev) => {
            const current = prev[tempId] || 0;
            if (current >= 100) {
              clearInterval(progressInterval);
              return prev;
            }
            return { ...prev, [tempId]: current + 10 };
          });
        }, 200);

        // Simulate upload completion
        setTimeout(() => {
          const newEvidence: Evidence = {
            id: tempId,
            fileName: file.name,
            fileSize: file.size,
            uploadedAt: new Date().toISOString(),
            uploadedBy: 'John Smith',
            status: 'pending',
            control: 'Unassigned',
            description: '',
          };

          setEvidence((prev) => [newEvidence, ...prev]);
          setUploadProgress((prev) => {
            const { [tempId]: _, ...rest } = prev;
            return rest;
          });

          showSuccess('Upload Complete', `${file.name} has been uploaded successfully.`);
        }, 2000);
      }
    },
    [showSuccess]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.ms-excel': ['.xls', '.xlsx'],
      'application/msword': ['.doc', '.docx'],
      'image/*': ['.png', '.jpg', '.jpeg', '.gif'],
      'text/csv': ['.csv'],
    },
    maxSize: 10485760, // 10MB
  });

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  };

  const getStatusBadge = (status: Evidence['status']) => {
    switch (status) {
      case 'approved':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircleIcon className="w-3 h-3 mr-1" />
            Approved
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <ClockIcon className="w-3 h-3 mr-1" />
            Pending Review
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <XCircleIcon className="w-3 h-3 mr-1" />
            Rejected
          </span>
        );
    }
  };

  const filteredEvidence = evidence.filter((item) => {
    const matchesSearch =
      item.fileName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesControl = selectedControl === 'all' || item.control === selectedControl;
    return matchesSearch && matchesControl;
  });

  const controls = ['all', ...new Set(evidence.map((e) => e.control))];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Evidence Management</h1>
        <p className="mt-1 text-sm text-gray-600">
          Upload and manage evidence documents for your SOC compliance audit
        </p>
      </div>

      {/* Upload Area */}
      <div className="mb-8">
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            isDragActive
              ? 'border-primary-500 bg-primary-50'
              : 'border-gray-300 hover:border-gray-400'
          }`}
        >
          <input {...getInputProps()} />
          <CloudArrowUpIcon className="mx-auto h-12 w-12 text-gray-400" />
          <p className="mt-2 text-sm text-gray-600">
            {isDragActive ? 'Drop files here...' : 'Drag and drop files here, or click to select'}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Supported formats: PDF, Excel, Word, Images, CSV (Max 10MB)
          </p>
        </div>

        {/* Upload Progress */}
        {Object.entries(uploadProgress).map(([id, progress]) => (
          <div key={id} className="mt-4 bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Uploading...</span>
              <span className="text-sm text-gray-500">{progress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Filters and Search */}
      <div className="bg-white shadow rounded-lg mb-6">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search evidence..."
                className="pl-10 pr-3 py-2 w-full border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <FunnelIcon className="h-5 w-5 text-gray-400" />
              <select
                value={selectedControl}
                onChange={(e) => setSelectedControl(e.target.value)}
                className="pl-3 pr-10 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
              >
                {controls.map((control) => (
                  <option key={control} value={control}>
                    {control === 'all' ? 'All Controls' : `Control ${control}`}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Evidence List */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Document
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Control
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Uploaded
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredEvidence.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-start">
                      <DocumentTextIcon className="h-5 w-5 text-gray-400 mt-0.5" />
                      <div className="ml-3">
                        <p className="text-sm font-medium text-gray-900">{item.fileName}</p>
                        <p className="text-sm text-gray-500">{formatFileSize(item.fileSize)}</p>
                        {item.description && (
                          <p className="text-xs text-gray-600 mt-1">{item.description}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-900">{item.control}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <p className="text-sm text-gray-900">{formatDate(item.uploadedAt)}</p>
                      <p className="text-xs text-gray-500">by {item.uploadedBy}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(item.status)}
                    {item.status === 'rejected' && item.comments && (
                      <p className="text-xs text-red-600 mt-1 max-w-xs">{item.comments}</p>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center gap-2">
                      <button className="text-primary-600 hover:text-primary-900" title="Download">
                        <ArrowDownTrayIcon className="h-5 w-5" />
                      </button>
                      {item.status === 'pending' && (
                        <button
                          className="text-red-600 hover:text-red-900"
                          title="Delete"
                          onClick={() => {
                            setEvidence((prev) => prev.filter((e) => e.id !== item.id));
                            showSuccess('Evidence Deleted', 'The evidence has been removed.');
                          }}
                        >
                          <TrashIcon className="h-5 w-5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredEvidence.length === 0 && (
          <div className="text-center py-12">
            <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-2 text-sm text-gray-600">No evidence found</p>
          </div>
        )}
      </div>

      {/* Help Section */}
      <div className="bg-blue-50 rounded-lg p-6">
        <h3 className="text-sm font-medium text-blue-900 mb-2">Evidence Upload Guidelines</h3>
        <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
          <li>Ensure documents are clearly labeled and relate to specific controls</li>
          <li>Upload the most recent versions of policies and procedures</li>
          <li>Include evidence of implementation (screenshots, logs, reports)</li>
          <li>Maximum file size is 10MB per document</li>
          <li>Contact your auditor if you're unsure about required evidence</li>
        </ul>
      </div>
    </div>
  );
}
