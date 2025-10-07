'use client';

import {
  ArrowDownTrayIcon,
  ChartBarIcon,
  CheckCircleIcon,
  ClockIcon,
  DocumentDuplicateIcon,
  DocumentIcon,
  DocumentTextIcon,
  EyeIcon,
  PhotoIcon,
  ServerIcon,
  Squares2X2Icon,
  TrashIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import { useState } from 'react';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useToast } from '@/contexts/ToastContext';
import { useBulkDeleteEvidence, useDeleteEvidence, useEvidence } from '@/hooks/api/useEvidence';
import type { Evidence } from '@/lib/api/evidence';

interface EvidenceGridProps {
  filters?: any;
}

const typeIcons: Record<Evidence['type'], any> = {
  document: DocumentTextIcon,
  screenshot: PhotoIcon,
  log: DocumentIcon,
  configuration: ServerIcon,
  report: ChartBarIcon,
  other: Squares2X2Icon,
};

const statusConfig = {
  approved: { icon: CheckCircleIcon, color: 'text-green-600 bg-green-100', label: 'Approved' },
  pending: { icon: ClockIcon, color: 'text-yellow-600 bg-yellow-100', label: 'Pending Review' },
  rejected: { icon: XCircleIcon, color: 'text-red-600 bg-red-100', label: 'Rejected' },
  expired: { icon: XCircleIcon, color: 'text-red-600 bg-red-100', label: 'Expired' },
};

export default function EvidenceGrid({ filters }: EvidenceGridProps) {
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const { showSuccess, showError } = useToast();

  // Fetch evidence from API
  const {
    data: evidenceData,
    loading,
    execute: refreshEvidence,
  } = useEvidence({
    ...filters,
    page: currentPage,
    pageSize: 12,
  });

  const deleteEvidence = useDeleteEvidence();
  const bulkDeleteEvidence = useBulkDeleteEvidence();

  const evidenceItems = evidenceData?.data || [];
  const totalItems = evidenceData?.total || 0;
  const hasMore = currentPage * 12 < totalItems;

  const toggleSelection = (id: string) => {
    setSelectedItems((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleDeleteEvidence = async (id: string) => {
    if (confirm('Are you sure you want to delete this evidence?')) {
      try {
        await deleteEvidence.mutate(id);
        showSuccess('Evidence deleted', 'The evidence has been successfully deleted.');
        refreshEvidence();
      } catch (error) {
        showError('Delete failed', 'Failed to delete the evidence. Please try again.');
      }
    }
  };

  const handleBulkDelete = async () => {
    if (confirm(`Are you sure you want to delete ${selectedItems.length} evidence items?`)) {
      try {
        await bulkDeleteEvidence.mutate(selectedItems);
        showSuccess(
          'Evidence deleted',
          `${selectedItems.length} evidence items have been deleted.`
        );
        setSelectedItems([]);
        refreshEvidence();
      } catch (error) {
        showError('Delete failed', 'Failed to delete the evidence items. Please try again.');
      }
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleDownload = async (item: Evidence) => {
    if (!item.fileUrl) return;

    // Open file URL in new tab for download
    window.open(item.fileUrl, '_blank');
  };

  const handleView = (item: Evidence) => {
    // TODO: Implement evidence viewer modal
    console.log('View evidence:', item.id);
  };

  const handleLoadMore = () => {
    setCurrentPage((prev) => prev + 1);
  };

  if (loading && evidenceItems.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div>
      {/* Bulk Actions */}
      {selectedItems.length > 0 && (
        <div className="mb-4 bg-gray-50 p-4 rounded-lg flex items-center justify-between">
          <span className="text-sm text-gray-700">{selectedItems.length} items selected</span>
          <div className="flex space-x-2">
            <button className="text-sm text-gray-700 hover:text-gray-900">Download Selected</button>
            <button onClick={handleBulkDelete} className="text-sm text-red-600 hover:text-red-700">
              Delete Selected
            </button>
          </div>
        </div>
      )}

      {/* Evidence Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {evidenceItems.map((item) => {
          const TypeIcon = typeIcons[item.type];
          const status = statusConfig[item.status];
          const StatusIcon = status.icon;

          return (
            <div
              key={item.id}
              className={`bg-white rounded-lg shadow hover:shadow-md transition-shadow border ${
                selectedItems.includes(item.id) ? 'border-primary-500' : 'border-gray-200'
              }`}
            >
              {/* Card Header */}
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={selectedItems.includes(item.id)}
                      onChange={() => toggleSelection(item.id)}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    />
                    <div className="ml-3 flex-shrink-0">
                      <TypeIcon className="h-8 w-8 text-gray-400" />
                    </div>
                  </div>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${status.color}`}
                  >
                    <StatusIcon className="mr-1 h-3 w-3" />
                    {status.label}
                  </span>
                </div>

                <div className="mt-4">
                  <h3 className="text-sm font-medium text-gray-900 line-clamp-1">{item.name}</h3>
                  {item.description && (
                    <p className="mt-1 text-xs text-gray-500 line-clamp-2">{item.description}</p>
                  )}
                </div>

                {/* Metadata */}
                <div className="mt-4 space-y-2">
                  {item.relatedControls && item.relatedControls.length > 0 && (
                    <div className="flex items-center text-xs text-gray-500">
                      <span className="font-medium">Controls:</span>
                      <span className="ml-1 truncate">{item.relatedControls.join(', ')}</span>
                    </div>
                  )}
                  <div className="flex items-center text-xs text-gray-500">
                    <span className="font-medium">Collected:</span>
                    <span className="ml-1">
                      {format(new Date(item.collectionDate), 'MMM d, yyyy')}
                    </span>
                    {item.metadata?.isAutomated && (
                      <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                        Automated
                      </span>
                    )}
                  </div>
                  {item.expirationDate && (
                    <div className="flex items-center text-xs text-gray-500">
                      <span className="font-medium">Expires:</span>
                      <span className="ml-1">
                        {format(new Date(item.expirationDate), 'MMM d, yyyy')}
                      </span>
                    </div>
                  )}
                </div>

                {/* File Info */}
                <div className="mt-4 flex items-center justify-between text-xs text-gray-500 bg-gray-50 -mx-4 -mb-4 px-4 py-2 rounded-b-lg">
                  <div className="flex items-center">
                    <DocumentIcon className="h-4 w-4 mr-1" />
                    <span className="truncate max-w-[150px]">{item.name}</span>
                    <span className="ml-2">({formatFileSize(item.fileSize)})</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => handleView(item)}
                      className="p-1 hover:bg-gray-200 rounded"
                      title="View Evidence"
                    >
                      <EyeIcon className="h-4 w-4 text-gray-600" />
                    </button>
                    <button
                      onClick={() => handleDownload(item)}
                      className="p-1 hover:bg-gray-200 rounded"
                      title="Download Evidence"
                      disabled={!item.fileUrl}
                    >
                      <ArrowDownTrayIcon className="h-4 w-4 text-gray-600" />
                    </button>
                    <button
                      onClick={() => handleDeleteEvidence(item.id)}
                      className="p-1 hover:bg-gray-200 rounded"
                      title="Delete Evidence"
                    >
                      <TrashIcon className="h-4 w-4 text-gray-600" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Load More */}
      {hasMore && (
        <div className="mt-8 flex justify-center">
          <button
            onClick={handleLoadMore}
            disabled={loading}
            className="px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Loading...' : 'Load More Evidence'}
          </button>
        </div>
      )}

      {!loading && evidenceItems.length === 0 && (
        <div className="text-center py-12">
          <DocumentIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No evidence found</h3>
          <p className="mt-1 text-sm text-gray-500">
            Get started by uploading your first evidence item.
          </p>
        </div>
      )}
    </div>
  );
}
