'use client';

import {
  ArrowDownTrayIcon,
  CheckCircleIcon,
  ClockIcon,
  DocumentTextIcon,
  MagnifyingGlassIcon,
  PaperAirplaneIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import { useState } from 'react';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useDownloadInvoice, useInvoices } from '@/hooks/api/useBilling';
import type { Invoice } from '@/lib/api/billing';

export default function InvoicesList() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Fetch invoices from API
  const {
    data: invoiceData,
    loading,
    execute: refreshInvoices,
  } = useInvoices({
    status: filterStatus === 'all' ? undefined : filterStatus,
    page: currentPage,
    pageSize: 10,
  });

  const downloadInvoice = useDownloadInvoice();

  const invoices = invoiceData?.data || [];

  const getStatusIcon = (status: Invoice['status']) => {
    switch (status) {
      case 'paid':
        return <CheckCircleIcon className="h-5 w-5 text-green-600" />;
      case 'pending':
        return <ClockIcon className="h-5 w-5 text-yellow-600" />;
      case 'overdue':
        return <XCircleIcon className="h-5 w-5 text-red-600" />;
      case 'draft':
        return <DocumentTextIcon className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusColor = (status: Invoice['status']) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'overdue':
        return 'bg-red-100 text-red-800';
      case 'draft':
        return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredInvoices = invoices.filter((invoice) => {
    const matchesSearch = searchTerm
      ? invoice.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase())
      : true;

    return matchesSearch;
  });

  const totalAmount = filteredInvoices.reduce((sum, inv) => sum + inv.total, 0);
  const paidAmount = filteredInvoices
    .filter((inv) => inv.status === 'paid')
    .reduce((sum, inv) => sum + inv.total, 0);
  const pendingAmount = filteredInvoices
    .filter((inv) => inv.status === 'pending' || inv.status === 'overdue')
    .reduce((sum, inv) => sum + inv.total, 0);

  const handleDownload = async (invoiceId: string) => {
    try {
      await downloadInvoice.mutate(invoiceId);
    } catch (error) {
      console.error('Failed to download invoice:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search invoices..."
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
            <option value="all">All Invoices</option>
            <option value="paid">Paid</option>
            <option value="pending">Pending</option>
            <option value="overdue">Overdue</option>
            <option value="draft">Draft</option>
          </select>

          <button className="btn-primary">Create Invoice</button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-600">Total</p>
          <p className="text-2xl font-bold text-gray-900">${totalAmount.toLocaleString()}</p>
        </div>
        <div className="bg-green-50 rounded-lg p-4">
          <p className="text-sm text-green-600">Paid</p>
          <p className="text-2xl font-bold text-green-900">${paidAmount.toLocaleString()}</p>
        </div>
        <div className="bg-yellow-50 rounded-lg p-4">
          <p className="text-sm text-yellow-600">Outstanding</p>
          <p className="text-2xl font-bold text-yellow-900">${pendingAmount.toLocaleString()}</p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner />
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Invoice
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Description
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Due Date
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredInvoices.map((invoice) => (
                <tr key={invoice.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{invoice.invoiceNumber}</p>
                      <p className="text-sm text-gray-500">
                        {format(new Date(invoice.createdAt), 'MMM d, yyyy')}
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm text-gray-900 truncate max-w-xs">
                      {invoice.items?.[0]?.description || 'Invoice'}
                    </p>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <p className="text-sm font-semibold text-gray-900">
                      ${invoice.total.toLocaleString()}
                    </p>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(invoice.status)}
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(invoice.status)}`}
                      >
                        {invoice.status}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <p className="text-sm text-gray-900">
                      {format(new Date(invoice.dueDate), 'MMM d, yyyy')}
                    </p>
                    {invoice.status === 'overdue' && (
                      <p className="text-xs text-red-600">
                        {Math.floor(
                          (new Date().getTime() - new Date(invoice.dueDate).getTime()) /
                            (1000 * 60 * 60 * 24)
                        )}{' '}
                        days overdue
                      </p>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setSelectedInvoice(invoice)}
                        className="text-primary-600 hover:text-primary-700"
                        title="View"
                      >
                        <DocumentTextIcon className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => handleDownload(invoice.id)}
                        className="text-gray-600 hover:text-gray-700"
                        title="Download"
                        disabled={downloadInvoice.loading}
                      >
                        <ArrowDownTrayIcon className="h-5 w-5" />
                      </button>
                      {invoice.status === 'draft' && (
                        <button className="text-blue-600 hover:text-blue-700" title="Send">
                          <PaperAirplaneIcon className="h-5 w-5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {invoiceData && invoiceData.total > 10 && (
        <div className="flex items-center justify-between px-4 py-3 bg-white border border-gray-200 rounded-lg">
          <div className="flex-1 flex justify-between sm:hidden">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="btn-secondary"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={currentPage * 10 >= invoiceData.total}
              className="btn-secondary"
            >
              Next
            </button>
          </div>
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                Showing <span className="font-medium">{(currentPage - 1) * 10 + 1}</span> to{' '}
                <span className="font-medium">{Math.min(currentPage * 10, invoiceData.total)}</span>{' '}
                of <span className="font-medium">{invoiceData.total}</span> results
              </p>
            </div>
            <div>
              <nav
                className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px"
                aria-label="Pagination"
              >
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={currentPage * 10 >= invoiceData.total}
                  className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                >
                  Next
                </button>
              </nav>
            </div>
          </div>
        </div>
      )}

      {selectedInvoice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h3 className="text-xl font-bold text-gray-900">{selectedInvoice.invoiceNumber}</h3>
                <div className="flex items-center gap-2 mt-1">
                  {getStatusIcon(selectedInvoice.status)}
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(selectedInvoice.status)}`}
                  >
                    {selectedInvoice.status}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedInvoice(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircleIcon className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Issue Date</p>
                  <p className="font-medium">
                    {format(new Date(selectedInvoice.createdAt), 'MMMM d, yyyy')}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Due Date</p>
                  <p className="font-medium">
                    {format(new Date(selectedInvoice.dueDate), 'MMMM d, yyyy')}
                  </p>
                </div>
                {selectedInvoice.paidAt && (
                  <div>
                    <p className="text-gray-600">Paid Date</p>
                    <p className="font-medium">
                      {format(new Date(selectedInvoice.paidAt), 'MMMM d, yyyy')}
                    </p>
                  </div>
                )}
              </div>

              <div className="border-t border-b py-4">
                <table className="w-full">
                  <thead>
                    <tr className="text-sm text-gray-600">
                      <th className="text-left pb-2">Description</th>
                      <th className="text-right pb-2">Qty</th>
                      <th className="text-right pb-2">Rate</th>
                      <th className="text-right pb-2">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedInvoice.items.map((item) => (
                      <tr key={item.id} className="text-sm">
                        <td className="py-2">{item.description}</td>
                        <td className="text-right py-2">{item.quantity}</td>
                        <td className="text-right py-2">${item.unitPrice.toLocaleString()}</td>
                        <td className="text-right py-2 font-medium">
                          ${item.amount.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="text-sm">
                      <td colSpan={3} className="text-right pt-2">
                        Subtotal:
                      </td>
                      <td className="text-right pt-2">
                        ${selectedInvoice.subtotal.toLocaleString()}
                      </td>
                    </tr>
                    {selectedInvoice.tax > 0 && (
                      <tr className="text-sm">
                        <td colSpan={3} className="text-right pt-1">
                          Tax:
                        </td>
                        <td className="text-right pt-1">${selectedInvoice.tax.toLocaleString()}</td>
                      </tr>
                    )}
                    <tr className="text-lg font-bold">
                      <td colSpan={3} className="text-right pt-2">
                        Total:
                      </td>
                      <td className="text-right pt-2">${selectedInvoice.total.toLocaleString()}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => handleDownload(selectedInvoice.id)}
                  className="btn-secondary"
                  disabled={downloadInvoice.loading}
                >
                  Download PDF
                </button>
                {selectedInvoice.status === 'draft' && (
                  <button className="btn-primary">Send Invoice</button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
