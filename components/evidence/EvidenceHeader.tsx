'use client';

import { CloudArrowUpIcon, LinkIcon } from '@heroicons/react/24/outline';

interface EvidenceHeaderProps {
  onUploadClick?: () => void;
}

export default function EvidenceHeader({ onUploadClick }: EvidenceHeaderProps) {
  return (
    <div className="sm:flex sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Evidence Management</h1>
        <p className="mt-1 text-sm text-gray-600">
          Collect, manage, and track evidence for your compliance audits
        </p>
      </div>

      <div className="mt-4 sm:mt-0 flex space-x-3">
        {/* Integration Status */}
        <div className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="h-2 w-2 bg-green-400 rounded-full animate-pulse"></div>
            </div>
            <span className="ml-2 text-sm text-gray-600">3 integrations active</span>
          </div>
        </div>

        {/* Connect Integration */}
        <button className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500">
          <LinkIcon className="-ml-1 mr-2 h-5 w-5" />
          Connect Integration
        </button>

        {/* Upload Evidence */}
        <button
          onClick={onUploadClick}
          className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
        >
          <CloudArrowUpIcon className="-ml-1 mr-2 h-5 w-5" />
          Upload Evidence
        </button>
      </div>
    </div>
  );
}
