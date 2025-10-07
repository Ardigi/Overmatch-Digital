'use client';

import { MagnifyingGlassIcon, PlusIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';
import ClientDetailsModal from '@/components/clients/ClientDetailsModal';
import ClientsHeader from '@/components/clients/ClientsHeader';
import ClientsList from '@/components/clients/ClientsList';
import NewClientModal from '@/components/clients/NewClientModal';

export default function ClientsPage() {
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [showNewClient, setShowNewClient] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  return (
    <div className="space-y-6">
      <ClientsHeader />

      <div className="bg-white shadow-sm rounded-lg">
        <div className="p-6 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search clients..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            <div className="flex items-center gap-4">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="all">All Clients</option>
                <option value="active">Active</option>
                <option value="pending">Pending</option>
                <option value="inactive">Inactive</option>
              </select>

              <button
                onClick={() => setShowNewClient(true)}
                className="btn-primary flex items-center gap-2"
              >
                <PlusIcon className="h-5 w-5" />
                Add Client
              </button>
            </div>
          </div>
        </div>

        <ClientsList
          searchTerm={searchTerm}
          filterStatus={filterStatus}
          onSelectClient={setSelectedClient}
        />
      </div>

      {selectedClient && (
        <ClientDetailsModal clientId={selectedClient} onClose={() => setSelectedClient(null)} />
      )}

      {showNewClient && (
        <NewClientModal
          onClose={() => setShowNewClient(false)}
          onSuccess={() => {
            setShowNewClient(false);
            // Refresh clients list
          }}
        />
      )}
    </div>
  );
}
