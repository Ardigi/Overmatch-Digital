import { useState, useCallback, useMemo, useEffect } from 'react';
import { 
  useControl, 
  useControlTests, 
  useControlGaps,
  useUploadControlEvidence,
  useDeleteControlEvidence,
} from '@/hooks/api/useControls';
import toast from 'react-hot-toast';
import type { 
  ControlMetadata, 
  TestingHistoryRow, 
  ControlStatistics, 
  ControlGap 
} from '@/types/control-detail.types';

export function useControlDetail(controlId: string) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'overview' | 'testing' | 'evidence' | 'gaps'>('overview');

  // API queries with real-time updates
  const { 
    data: control, 
    loading: controlLoading, 
    error: controlError,
    execute: refetchControl 
  } = useControl(controlId, {
    immediate: true,
  });

  const { 
    data: tests, 
    loading: testsLoading,
    error: testsError,
    execute: refetchTests 
  } = useControlTests(controlId, {
    immediate: true,
  });

  const { 
    data: gaps, 
    loading: gapsLoading,
    error: gapsError,
    execute: refetchGaps 
  } = useControlGaps(controlId, {
    immediate: true,
  });

  const { mutate: uploadEvidence, loading: uploadingEvidence } = useUploadControlEvidence({
    onSuccess: () => {
      refetchControl();
      toast.success('Evidence uploaded successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to upload evidence');
    }
  });

  const { mutate: deleteEvidence, loading: deletingEvidence } = useDeleteControlEvidence({
    onSuccess: () => {
      refetchControl();
      toast.success('Evidence deleted successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete evidence');
    }
  });

  // Refresh all data
  const refreshAll = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        refetchControl(),
        refetchTests(),
        refetchGaps()
      ]);
      toast.success('Data refreshed');
    } catch (error) {
      toast.error('Failed to refresh data');
    } finally {
      setIsRefreshing(false);
    }
  }, [refetchControl, refetchTests, refetchGaps]);

  // Auto-refresh every 30 seconds when tab is visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && selectedTab === 'overview') {
        refreshAll();
      }
    };

    const interval = setInterval(() => {
      if (!document.hidden) {
        refreshAll();
      }
    }, 30000);

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [refreshAll, selectedTab]);

  // Transform control data to match our interface
  const transformedControl: ControlMetadata | null = useMemo(() => {
    if (!control) return null;

    return {
      id: control.id,
      code: control.code,
      name: control.name,
      description: control.description,
      category: control.category,
      framework: control.framework,
      type: control.type,
      frequency: control.frequency,
      status: control.status,
      effectiveness: control.effectiveness,
      priority: control.priority,
      owner: control.owner,
      implementationDate: control.implementationDate,
      testing: {
        lastTested: control.testing?.lastTested,
        nextTestDate: control.testing?.nextTestDate,
        testResult: control.testing?.testResult,
        testCoverage: control.testing?.testCoverage,
      },
      evidence: control.evidence,
      gaps: control.gaps,
      metadata: control.metadata,
      relatedControls: control.relatedControls,
      relatedPolicies: control.relatedPolicies,
      relatedRisks: control.relatedRisks,
      tags: control.tags,
      notes: control.notes,
      automationLevel: control.automationLevel,
      createdAt: control.createdAt,
      updatedAt: control.updatedAt,
    };
  }, [control]);

  // Transform test data
  const transformedTests: TestingHistoryRow[] = useMemo(() => {
    if (!tests || !Array.isArray(tests)) return [];

    return tests.map((test: any) => ({
      id: test.id,
      testDate: test.testDate,
      tester: test.tester || { id: test.testerId, name: 'Unknown' },
      result: test.result,
      methodology: test.methodology,
      findings: test.findings,
      recommendations: test.recommendations,
      evidenceCount: test.evidenceCount || 0,
      status: test.status,
      reviewer: test.reviewer,
      reviewDate: test.reviewDate,
      nextTestDate: test.nextTestDate,
    }));
  }, [tests]);

  // Transform gaps data
  const transformedGaps: ControlGap[] = useMemo(() => {
    if (!gaps || !Array.isArray(gaps)) return [];

    return gaps.map((gap: any) => ({
      id: gap.id,
      controlId: gap.controlId,
      description: gap.description,
      severity: gap.severity,
      status: gap.status,
      identifiedDate: gap.identifiedDate,
      identifiedBy: gap.identifiedBy,
      targetResolutionDate: gap.targetResolutionDate,
      actualResolutionDate: gap.actualResolutionDate,
      remediation: gap.remediation,
      riskImpact: gap.riskImpact,
      businessJustification: gap.businessJustification,
      compensatingControls: gap.compensatingControls,
      notes: gap.notes,
    }));
  }, [gaps]);

  // Computed statistics for performance
  const statistics: ControlStatistics | null = useMemo(() => {
    if (!transformedTests || transformedTests.length === 0) return null;
    
    const totalTests = transformedTests.length;
    const passedTests = transformedTests.filter(t => t.result === 'PASS').length;
    const failedTests = transformedTests.filter(t => t.result === 'FAIL').length;
    const partialTests = transformedTests.filter(t => t.result === 'PARTIAL').length;
    
    return {
      totalTests,
      passedTests,
      failedTests,
      partialTests,
      passRate: totalTests > 0 ? (passedTests / totalTests) * 100 : 0,
      lastTestDate: transformedTests[0]?.testDate || null,
      nextTestDate: transformedControl?.testing?.nextTestDate || null,
    };
  }, [transformedControl, transformedTests]);

  // Handle evidence upload
  const handleEvidenceUpload = useCallback(async (file: File, metadata?: { type: string; description: string }) => {
    await uploadEvidence({
      controlId,
      file,
      metadata
    });
  }, [controlId, uploadEvidence]);

  // Handle evidence deletion
  const handleEvidenceDelete = useCallback(async (evidenceId: string) => {
    await deleteEvidence({
      controlId,
      evidenceId
    });
  }, [controlId, deleteEvidence]);

  return {
    // Data
    control: transformedControl,
    tests: transformedTests,
    gaps: transformedGaps,
    statistics,
    
    // Loading states
    loading: controlLoading || testsLoading || gapsLoading,
    isRefreshing,
    uploadingEvidence,
    deletingEvidence,
    
    // Errors
    error: controlError || testsError || gapsError,
    
    // Tab management
    selectedTab,
    setSelectedTab,
    
    // Actions
    refreshAll,
    uploadEvidence: handleEvidenceUpload,
    deleteEvidence: handleEvidenceDelete,
  };
}