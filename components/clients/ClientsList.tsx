'use client';

import {
  BuildingOfficeIcon,
  ChevronRightIcon,
  EnvelopeIcon,
  PhoneIcon,
  TagIcon,
} from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import { useMemo } from 'react';
import { useClients } from '@/hooks/api/useClients';
import type { ClientFilters } from '@/lib/api/clients';

interface ClientsListProps {
  searchTerm: string;
  filterStatus: string;
  onSelectClient: (clientId: string) => void;
}

export default function ClientsList({
  searchTerm,
  filterStatus,
  onSelectClient,
}: ClientsListProps) {
  // Build filters based on search and status
  const filters = useMemo<ClientFilters>(() => {
    const f: ClientFilters = {
      page: 1,
      pageSize: 20,
    };

    if (searchTerm) {
      f.search = searchTerm;
    }

    if (filterStatus && filterStatus !== 'all') {
      f.status = filterStatus as ClientFilters['status'];
    }

    return f;
  }, [searchTerm, filterStatus]);

  // Fetch clients using the API hook
  const { data, loading, error } = useClients(filters);

  const clients = data?.data || [];

  const getStatusColor = (status: 'active' | 'inactive' | 'pending') => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'inactive':
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getProjectTypeLabel = (type: string) => {
    switch (type) {
      case 'soc1':
        return 'SOC 1';
      case 'soc2':
        return 'SOC 2';
      case 'soc2_plus':
        return 'SOC 2+';
      default:
        return type.toUpperCase();
    }
  };

  const getProjectTypeColor = (type: string) => {
    switch (type) {
      case 'soc1':
        return 'bg-blue-100 text-blue-800';
      case 'soc2':
        return 'bg-purple-100 text-purple-800';
      case 'soc2_plus':
        return 'bg-indigo-100 text-indigo-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="px-6 py-12 text-center">
        <div className="animate-spin h-8 w-8 border-2 border-primary-600 border-t-transparent rounded-full mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading clients...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-6 py-12 text-center">
        <p className="text-red-600">Error loading clients: {error.message}</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-200">
      {clients.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <BuildingOfficeIcon className="h-12 w-12 text-gray-400 mx-auto" />
          <p className="mt-4 text-gray-600">No clients found</p>
        </div>
      ) : (
        clients.map((client) => {
          // Get the primary project type from the client's projects
          const primaryProjectType = client.projects?.[0]?.type || 'soc2';

          return (
            <div
              key={client.id}
              onClick={() => onSelectClient(client.id)}
              className="px-6 py-4 hover:bg-gray-50 cursor-pointer transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{client.name}</h3>
                      <p className="text-sm text-gray-600">{client.industry}</p>
                    </div>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(client.status)}`}
                    >
                      {client.status}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${getProjectTypeColor(primaryProjectType)}`}
                    >
                      {getProjectTypeLabel(primaryProjectType)}
                    </span>
                  </div>

                  <div className="mt-2 flex items-center gap-6 text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                      <EnvelopeIcon className="h-4 w-4" />
                      {client.contactEmail}
                    </div>
                    {client.contactPhone && (
                      <div className="flex items-center gap-1">
                        <PhoneIcon className="h-4 w-4" />
                        {client.contactPhone}
                      </div>
                    )}
                  </div>

                  <div className="mt-2 flex items-center gap-4 text-sm">
                    {client.contacts && client.contacts.length > 0 && (
                      <span className="text-gray-600">
                        Primary Contact:{' '}
                        <span className="font-medium text-gray-900">
                          {client.contacts.find((c) => c.isPrimary)?.firstName}{' '}
                          {client.contacts.find((c) => c.isPrimary)?.lastName}
                        </span>
                      </span>
                    )}
                    <span className="text-gray-600">
                      Created:{' '}
                      <span className="font-medium text-gray-900">
                        {format(new Date(client.createdAt), 'MMM d, yyyy')}
                      </span>
                    </span>
                  </div>
                </div>

                <ChevronRightIcon className="h-5 w-5 text-gray-400 flex-shrink-0" />
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
