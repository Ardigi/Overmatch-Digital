'use client';

import { Suspense, useState } from 'react';
import EvidenceFilters from '@/components/evidence/EvidenceFilters';
import EvidenceGrid from '@/components/evidence/EvidenceGrid';
import EvidenceHeader from '@/components/evidence/EvidenceHeader';
import EvidenceUploadModal from '@/components/evidence/EvidenceUploadModal';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

export default function TeamEvidencePage() {
  const [filters, setFilters] = useState({});
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleFiltersChange = (newFilters: any) => {
    setFilters(newFilters);
  };

  const handleUploadSuccess = () => {
    // Refresh the evidence grid after successful upload
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <div>
      <EvidenceHeader onUploadClick={() => setIsUploadModalOpen(true)} />

      {/* Filters and Search */}
      <div className="mt-6">
        <EvidenceFilters filters={filters} onFiltersChange={handleFiltersChange} />
      </div>

      {/* Evidence Grid */}
      <div className="mt-8">
        <Suspense
          fallback={
            <div className="flex justify-center items-center h-64">
              <LoadingSpinner size="lg" />
            </div>
          }
        >
          <EvidenceGrid key={refreshKey} filters={filters} />
        </Suspense>
      </div>

      {/* Upload Modal */}
      <EvidenceUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onSuccess={handleUploadSuccess}
      />
    </div>
  );
}
