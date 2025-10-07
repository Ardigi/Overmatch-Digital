'use client';

import {
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  CheckCircleIcon,
  ClockIcon,
  DocumentIcon,
  FolderIcon,
  LockClosedIcon,
  ShareIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import { useState } from 'react';

interface SharedFile {
  id: string;
  name: string;
  type: 'document' | 'spreadsheet' | 'pdf' | 'folder' | 'image';
  size: string;
  uploadedBy: string;
  uploadedAt: string;
  lastModified: string;
  sharedWith: string[];
  status: 'pending_review' | 'approved' | 'rejected' | 'archived';
  isEncrypted: boolean;
  version: number;
  relatedControl?: string;
  description?: string;
}

const files: SharedFile[] = [
  {
    id: '1',
    name: 'SOC2_Security_Policies_2024.pdf',
    type: 'pdf',
    size: '2.4 MB',
    uploadedBy: 'Emily Rodriguez',
    uploadedAt: '2024-01-15',
    lastModified: '2 days ago',
    sharedWith: ['Sarah Johnson', 'Michael Chen'],
    status: 'approved',
    isEncrypted: true,
    version: 3,
    relatedControl: 'CC2.1',
    description: 'Updated security policies including incident response procedures',
  },
  {
    id: '2',
    name: 'Q4_Access_Control_Matrix.xlsx',
    type: 'spreadsheet',
    size: '856 KB',
    uploadedBy: 'David Kim',
    uploadedAt: '2024-01-14',
    lastModified: '5 hours ago',
    sharedWith: ['Sarah Johnson'],
    status: 'pending_review',
    isEncrypted: true,
    version: 2,
    relatedControl: 'CC6.1',
    description: 'Quarterly access control review with privilege analysis',
  },
  {
    id: '3',
    name: 'Network_Diagrams',
    type: 'folder',
    size: '12 items',
    uploadedBy: 'David Kim',
    uploadedAt: '2024-01-10',
    lastModified: '1 week ago',
    sharedWith: ['Michael Chen'],
    status: 'approved',
    isEncrypted: true,
    version: 1,
    relatedControl: 'CC6.6',
  },
  {
    id: '4',
    name: 'Pentest_Report_Jan2024.pdf',
    type: 'pdf',
    size: '5.1 MB',
    uploadedBy: 'External Vendor',
    uploadedAt: '2024-01-12',
    lastModified: '3 days ago',
    sharedWith: ['Sarah Johnson', 'Emily Rodriguez', 'David Kim'],
    status: 'pending_review',
    isEncrypted: true,
    version: 1,
    relatedControl: 'CC4.1',
    description: 'Annual penetration testing results with remediation recommendations',
  },
  {
    id: '5',
    name: 'Employee_Training_Records.xlsx',
    type: 'spreadsheet',
    size: '1.2 MB',
    uploadedBy: 'HR Department',
    uploadedAt: '2024-01-08',
    lastModified: '1 week ago',
    sharedWith: ['Michael Chen'],
    status: 'rejected',
    isEncrypted: true,
    version: 1,
    relatedControl: 'CC1.4',
    description: 'Missing completion dates for several employees',
  },
];

const fileTypeIcons = {
  document: DocumentIcon,
  spreadsheet: DocumentIcon,
  pdf: DocumentIcon,
  folder: FolderIcon,
  image: DocumentIcon,
};

const statusConfig = {
  pending_review: { color: 'bg-yellow-100 text-yellow-800', text: 'Pending Review' },
  approved: { color: 'bg-green-100 text-green-800', text: 'Approved' },
  rejected: { color: 'bg-red-100 text-red-800', text: 'Rejected' },
  archived: { color: 'bg-gray-100 text-gray-800', text: 'Archived' },
};

export default function SharedFiles() {
  const [selectedFile, setSelectedFile] = useState<SharedFile | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');

  const handleUpload = () => {
    // Handle file upload
  };

  const handleDownload = (file: SharedFile) => {
    // Handle file download
  };

  const handleShare = (file: SharedFile) => {
    // Handle file sharing
  };

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-medium text-gray-900">Secure File Exchange</h2>
            <p className="mt-1 text-sm text-gray-500">
              End-to-end encrypted file sharing for audit documentation
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleUpload}
              className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
            >
              <ArrowUpTrayIcon className="h-4 w-4 mr-1.5" />
              Upload Files
            </button>
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* File List */}
        <div className="space-y-3">
          {files.map((file) => {
            const Icon = fileTypeIcons[file.type];
            const status = statusConfig[file.status];

            return (
              <div
                key={file.id}
                className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    <div className="p-2 bg-gray-100 rounded-lg">
                      <Icon className="h-6 w-6 text-gray-600" />
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center">
                        <h3 className="text-sm font-medium text-gray-900">{file.name}</h3>
                        {file.isEncrypted && (
                          <LockClosedIcon className="h-4 w-4 ml-2 text-gray-400" />
                        )}
                        <span className="ml-2 text-xs text-gray-500">v{file.version}</span>
                      </div>

                      {file.description && (
                        <p className="mt-1 text-sm text-gray-600">{file.description}</p>
                      )}

                      <div className="mt-2 flex items-center space-x-4 text-xs text-gray-500">
                        <span>{file.size}</span>
                        <span>•</span>
                        <span>Uploaded by {file.uploadedBy}</span>
                        <span>•</span>
                        <span>{file.lastModified}</span>
                        {file.relatedControl && (
                          <>
                            <span>•</span>
                            <span>Control: {file.relatedControl}</span>
                          </>
                        )}
                      </div>

                      <div className="mt-2 flex items-center space-x-2">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${status.color}`}
                        >
                          {status.text}
                        </span>
                        <span className="text-xs text-gray-500">
                          Shared with {file.sharedWith.length}{' '}
                          {file.sharedWith.length === 1 ? 'person' : 'people'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleDownload(file)}
                      className="p-1 text-gray-400 hover:text-gray-600"
                      title="Download"
                    >
                      <ArrowDownTrayIcon className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => handleShare(file)}
                      className="p-1 text-gray-400 hover:text-gray-600"
                      title="Share"
                    >
                      <ShareIcon className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                {/* File Actions */}
                {file.status === 'pending_review' && (
                  <div className="mt-3 pt-3 border-t border-gray-200 flex items-center justify-between">
                    <span className="text-xs text-gray-500">Awaiting review from audit team</span>
                    <div className="flex space-x-2">
                      <button className="inline-flex items-center px-2.5 py-1 border border-green-300 text-xs font-medium rounded text-green-700 bg-white hover:bg-green-50">
                        <CheckCircleIcon className="h-3.5 w-3.5 mr-1" />
                        Approve
                      </button>
                      <button className="inline-flex items-center px-2.5 py-1 border border-red-300 text-xs font-medium rounded text-red-700 bg-white hover:bg-red-50">
                        <XCircleIcon className="h-3.5 w-3.5 mr-1" />
                        Reject
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Storage Info */}
        <div className="mt-6 bg-gray-50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Secure Storage Usage</span>
            <span className="text-sm text-gray-500">2.3 GB / 10 GB</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className="bg-primary-600 h-2 rounded-full" style={{ width: '23%' }}></div>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            All files are encrypted at rest using AES-256 encryption
          </p>
        </div>
      </div>
    </div>
  );
}
