'use client';

import { Dialog, Transition } from '@headlessui/react';
import { PencilIcon, TrashIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import { Fragment, useEffect, useState } from 'react';

interface ClientDetailsModalProps {
  clientId: string;
  onClose: () => void;
}

interface ClientDetails {
  id: string;
  name: string;
  email: string;
  phone: string;
  website: string;
  industry: string;
  status: 'active' | 'pending' | 'inactive';
  contractValue: number;
  contractStartDate: string;
  contractEndDate: string;
  lastAudit: string | null;
  nextAudit: string | null;
  primaryContact: {
    name: string;
    email: string;
    phone: string;
    title: string;
  };
  secondaryContact?: {
    name: string;
    email: string;
    phone: string;
    title: string;
  };
  auditType: 'SOC1' | 'SOC2' | 'Both';
  trustServicesCriteria: string[];
  notes: string;
  documents: Array<{
    id: string;
    name: string;
    type: string;
    uploadedAt: string;
  }>;
  auditHistory: Array<{
    id: string;
    type: string;
    completedDate: string;
    auditor: string;
    result: 'passed' | 'passed_with_exceptions' | 'failed';
  }>;
}

export default function ClientDetailsModal({ clientId, onClose }: ClientDetailsModalProps) {
  const [client, setClient] = useState<ClientDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    // Simulate API call
    setTimeout(() => {
      setClient({
        id: clientId,
        name: 'TechCorp Solutions',
        email: 'contact@techcorp.com',
        phone: '(555) 123-4567',
        website: 'https://techcorp.com',
        industry: 'Software',
        status: 'active',
        contractValue: 125000,
        contractStartDate: '2023-01-15',
        contractEndDate: '2025-01-15',
        lastAudit: '2024-06-15',
        nextAudit: '2025-06-15',
        primaryContact: {
          name: 'John Smith',
          email: 'john.smith@techcorp.com',
          phone: '(555) 123-4567',
          title: 'Chief Information Security Officer',
        },
        secondaryContact: {
          name: 'Jane Doe',
          email: 'jane.doe@techcorp.com',
          phone: '(555) 123-4568',
          title: 'Compliance Manager',
        },
        auditType: 'SOC2',
        trustServicesCriteria: ['Security', 'Availability', 'Confidentiality'],
        notes:
          'Key enterprise client. Requires quarterly check-ins. Very responsive to audit requests.',
        documents: [
          {
            id: '1',
            name: 'Master Service Agreement.pdf',
            type: 'Contract',
            uploadedAt: '2023-01-15',
          },
          {
            id: '2',
            name: 'SOC2 Type II Report 2024.pdf',
            type: 'Audit Report',
            uploadedAt: '2024-06-20',
          },
          {
            id: '3',
            name: 'Security Policies.docx',
            type: 'Policy',
            uploadedAt: '2024-05-01',
          },
        ],
        auditHistory: [
          {
            id: '1',
            type: 'SOC2 Type II',
            completedDate: '2024-06-15',
            auditor: 'Smith & Associates CPAs',
            result: 'passed',
          },
          {
            id: '2',
            type: 'SOC2 Type II',
            completedDate: '2023-06-10',
            auditor: 'Smith & Associates CPAs',
            result: 'passed_with_exceptions',
          },
        ],
      });
      setLoading(false);
    }, 500);
  }, [clientId]);

  const getResultColor = (result: string) => {
    switch (result) {
      case 'passed':
        return 'text-green-600 bg-green-100';
      case 'passed_with_exceptions':
        return 'text-yellow-600 bg-yellow-100';
      case 'failed':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  return (
    <Transition appear show as={Fragment}>
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
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-4xl transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                {loading ? (
                  <div className="py-12 text-center">
                    <div className="animate-spin h-8 w-8 border-2 border-primary-600 border-t-transparent rounded-full mx-auto"></div>
                  </div>
                ) : client ? (
                  <>
                    <div className="flex items-start justify-between mb-6">
                      <div>
                        <Dialog.Title as="h3" className="text-2xl font-bold text-gray-900">
                          {client.name}
                        </Dialog.Title>
                        <p className="mt-1 text-gray-600">{client.industry}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
                          <PencilIcon className="h-5 w-5" />
                        </button>
                        <button className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors">
                          <TrashIcon className="h-5 w-5" />
                        </button>
                        <button
                          onClick={onClose}
                          className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                          <XMarkIcon className="h-5 w-5" />
                        </button>
                      </div>
                    </div>

                    <div className="border-b border-gray-200 mb-6">
                      <nav className="-mb-px flex gap-6">
                        {['overview', 'contracts', 'audit-history', 'documents'].map((tab) => (
                          <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                              activeTab === tab
                                ? 'border-primary-600 text-primary-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                          >
                            {tab.charAt(0).toUpperCase() + tab.slice(1).replace('-', ' ')}
                          </button>
                        ))}
                      </nav>
                    </div>

                    {activeTab === 'overview' && (
                      <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-6">
                          <div>
                            <h4 className="font-semibold text-gray-900 mb-3">
                              Contact Information
                            </h4>
                            <dl className="space-y-2 text-sm">
                              <div>
                                <dt className="text-gray-600">Email</dt>
                                <dd className="text-gray-900">{client.email}</dd>
                              </div>
                              <div>
                                <dt className="text-gray-600">Phone</dt>
                                <dd className="text-gray-900">{client.phone}</dd>
                              </div>
                              <div>
                                <dt className="text-gray-600">Website</dt>
                                <dd>
                                  <a
                                    href={client.website}
                                    className="text-primary-600 hover:text-primary-700"
                                  >
                                    {client.website}
                                  </a>
                                </dd>
                              </div>
                            </dl>
                          </div>

                          <div>
                            <h4 className="font-semibold text-gray-900 mb-3">Audit Details</h4>
                            <dl className="space-y-2 text-sm">
                              <div>
                                <dt className="text-gray-600">Audit Type</dt>
                                <dd className="text-gray-900">{client.auditType}</dd>
                              </div>
                              <div>
                                <dt className="text-gray-600">Trust Services Criteria</dt>
                                <dd className="text-gray-900">
                                  {client.trustServicesCriteria.join(', ')}
                                </dd>
                              </div>
                              <div>
                                <dt className="text-gray-600">Next Audit</dt>
                                <dd className="text-gray-900">
                                  {client.nextAudit
                                    ? format(new Date(client.nextAudit), 'MMMM d, yyyy')
                                    : 'Not scheduled'}
                                </dd>
                              </div>
                            </dl>
                          </div>
                        </div>

                        <div>
                          <h4 className="font-semibold text-gray-900 mb-3">Primary Contact</h4>
                          <div className="bg-gray-50 rounded-lg p-4">
                            <p className="font-medium text-gray-900">
                              {client.primaryContact.name}
                            </p>
                            <p className="text-sm text-gray-600">{client.primaryContact.title}</p>
                            <p className="text-sm text-gray-600 mt-2">
                              {client.primaryContact.email}
                            </p>
                            <p className="text-sm text-gray-600">{client.primaryContact.phone}</p>
                          </div>
                        </div>

                        {client.notes && (
                          <div>
                            <h4 className="font-semibold text-gray-900 mb-3">Notes</h4>
                            <p className="text-gray-600">{client.notes}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {activeTab === 'contracts' && (
                      <div className="space-y-4">
                        <div className="bg-gray-50 rounded-lg p-6">
                          <h4 className="font-semibold text-gray-900 mb-4">Current Contract</h4>
                          <dl className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <dt className="text-gray-600">Contract Value</dt>
                              <dd className="text-gray-900 font-semibold text-lg">
                                ${client.contractValue.toLocaleString()}/year
                              </dd>
                            </div>
                            <div>
                              <dt className="text-gray-600">Status</dt>
                              <dd>
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                  Active
                                </span>
                              </dd>
                            </div>
                            <div>
                              <dt className="text-gray-600">Start Date</dt>
                              <dd className="text-gray-900">
                                {format(new Date(client.contractStartDate), 'MMMM d, yyyy')}
                              </dd>
                            </div>
                            <div>
                              <dt className="text-gray-600">End Date</dt>
                              <dd className="text-gray-900">
                                {format(new Date(client.contractEndDate), 'MMMM d, yyyy')}
                              </dd>
                            </div>
                          </dl>
                        </div>
                      </div>
                    )}

                    {activeTab === 'audit-history' && (
                      <div className="space-y-4">
                        {client.auditHistory.map((audit) => (
                          <div key={audit.id} className="bg-gray-50 rounded-lg p-4">
                            <div className="flex items-start justify-between">
                              <div>
                                <h5 className="font-medium text-gray-900">{audit.type}</h5>
                                <p className="text-sm text-gray-600 mt-1">
                                  Completed on{' '}
                                  {format(new Date(audit.completedDate), 'MMMM d, yyyy')}
                                </p>
                                <p className="text-sm text-gray-600">Auditor: {audit.auditor}</p>
                              </div>
                              <span
                                className={`px-3 py-1 rounded-full text-sm font-medium ${getResultColor(audit.result)}`}
                              >
                                {audit.result.replace('_', ' ')}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {activeTab === 'documents' && (
                      <div className="space-y-4">
                        {client.documents.map((doc) => (
                          <div
                            key={doc.id}
                            className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                          >
                            <div>
                              <p className="font-medium text-gray-900">{doc.name}</p>
                              <p className="text-sm text-gray-600">
                                {doc.type} • Uploaded{' '}
                                {format(new Date(doc.uploadedAt), 'MMM d, yyyy')}
                              </p>
                            </div>
                            <button className="text-primary-600 hover:text-primary-700 text-sm font-medium">
                              Download
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : null}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
