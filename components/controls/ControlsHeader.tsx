'use client';

import { useState } from 'react';
import { PlusIcon, ArrowUpTrayIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import CreateControlModal from './CreateControlModal';
import BulkImportControls from './BulkImportControls';
import ExportControls from './ExportControls';

export default function ControlsHeader() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);

  return (
    <>
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Controls Management</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage and track implementation status of compliance controls
          </p>
        </div>

        <div className="mt-4 sm:mt-0 flex space-x-3">
          <button 
            onClick={() => setShowImportModal(true)}
            className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            <ArrowUpTrayIcon className="h-4 w-4 mr-2" />
            Import Controls
          </button>
          <button 
            onClick={() => setShowExportModal(true)}
            className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
            Export Matrix
          </button>
          <button 
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            <PlusIcon className="h-4 w-4 mr-2" />
            Add Control
          </button>
        </div>
      </div>

      {/* Modals */}
      <CreateControlModal 
        isOpen={showCreateModal} 
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {
          // Optionally refresh controls list
          window.location.reload();
        }}
      />
      
      {showImportModal && (
        <BulkImportControls 
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
          onSuccess={() => {
            // Optionally refresh controls list
            window.location.reload();
          }}
        />
      )}

      {showExportModal && (
        <ExportControls
          isOpen={showExportModal}
          onClose={() => setShowExportModal(false)}
        />
      )}
    </>
  );
}
