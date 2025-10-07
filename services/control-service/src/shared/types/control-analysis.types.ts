/**
 * Control overlap matrix structure
 */
export interface ControlOverlapMatrix {
  [frameworkId: string]: {
    [otherFrameworkId: string]: {
      overlapCount: number;
      overlappingControls: string[];
      overlapPercentage: number;
      riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
      percentage?: number; // For compatibility with recommendations method
      commonControls?: number; // For method compatibility
      controls?: string[]; // For method compatibility
    };
  };
}

/**
 * Comprehensive report data structure
 */
export interface ComprehensiveReportData {
  controls: ControlAnalysisData[];
  summary: ReportSummary;
  metrics: ReportMetrics;
  recommendations: string[];
  trends: TrendAnalysis[];
  framework?: string;
  criticalGaps?: number;
  generatedAt?: Date;
  organizationId?: string;
  controlDetails?: any[]; // For framework report generation
  complianceScore?: {
    score: number;
    [key: string]: any;
  };
  coverage?: {
    percentage: number;
    details: any;
    overall?: number;
    [key: string]: any;
  };
  risks?: {
    highRisk?: number;
    [key: string]: any;
  };
  testingCompliance?: any;
  utilization?: any;
}

/**
 * Control analysis data for reports
 */
export interface ControlAnalysisData {
  id: string;
  code: string;
  name: string;
  category: string;
  framework: string;
  status: string;
  score: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  implementationEffort: 'LOW' | 'MEDIUM' | 'HIGH';
  priority: number;
  lastAssessed?: Date;
  effectiveness?: number;
  gapCount?: number;
  criticality?: 'HIGH' | 'MEDIUM' | 'LOW' | 'CRITICAL';
}

/**
 * Report summary information
 */
export interface ReportSummary {
  totalControls: number;
  implementedControls: number;
  criticalGaps: number;
  overallRating: string;
  compliancePercentage: number;
  coveragePercentage?: number;
}

/**
 * Report metrics structure
 */
export interface ReportMetrics {
  averageScore: number;
  controlsByStatus: Record<string, number>;
  controlsByFramework: Record<string, number>;
  riskDistribution: Record<string, number>;
  trendDirection: 'IMPROVING' | 'DECLINING' | 'STABLE';
}

/**
 * Trend analysis data
 */
export interface TrendAnalysis {
  metric: string;
  currentValue: number;
  previousValue: number;
  changePercentage: number;
  trend: 'UP' | 'DOWN' | 'STABLE';
  significance: 'HIGH' | 'MEDIUM' | 'LOW';
}

/**
 * Control performance data
 */
export interface ControlPerformanceData {
  controlId: string;
  efficiency: number;
  effectiveness: number;
  cost: number;
  riskReduction: number;
  complianceScore: number;
  maturityLevel: number;
  lastUpdated: Date;
}

/**
 * Benchmark performance structure
 */
export interface BenchmarkPerformance {
  organizationId: string;
  industry: string;
  companySize: 'SMALL' | 'MEDIUM' | 'LARGE' | 'ENTERPRISE';
  overallScore: number;
  frameworkScores: Record<string, number>;
  categoryScores: Record<string, number>;
  ranking: {
    industry: number;
    size: number;
    overall: number;
  };
  improvementAreas: string[];
  strengths: string[];
  
  // Control service specific benchmark performance patterns
  successRate?: {
    value: number;
    benchmark: number;
    difference: string;
    rating: string;
  };
  duration?: {
    value: number;
    benchmark: number;
    difference: string;
    rating: string;
  };
}

/**
 * CSV metrics data structure
 */
export interface CSVMetricsData {
  headers: string[];
  rows: Array<Record<string, string | number>>;
  metadata: {
    generatedAt: Date;
    recordCount: number;
    filters?: Record<string, unknown>;
  };
  complianceMetrics?: any;
  coverageAnalysis?: any;
  controlMetrics?: any;
  performanceMetrics?: any;
}

/**
 * Predictive analytics interfaces
 */
export interface ImplementationSuccessPrediction {
  controlId: string;
  successProbability: number; // 0-1
  riskFactors: {
    complexity: 'LOW' | 'MEDIUM' | 'HIGH';
    resourceAvailability: 'LOW' | 'MEDIUM' | 'HIGH';
    teamExperience: 'LOW' | 'MEDIUM' | 'HIGH';
    technicalDebt: 'LOW' | 'MEDIUM' | 'HIGH';
  };
  predictedTimeframe: {
    optimistic: number; // days
    realistic: number;
    pessimistic: number;
  };
  recommendations: string[];
  confidence: number; // 0-1
}

export interface TestOutcomePrediction {
  controlId: string;
  predictedResult: 'PASS' | 'FAIL' | 'CONDITIONAL';
  confidenceScore: number; // 0-1
  riskIndicators: {
    historicalFailureRate: number;
    complexityScore: number;
    changeFrequency: number;
    dependencyRisk: number;
  };
  suggestedActions: string[];
  estimatedTestEffort: number; // hours
}

/**
 * Framework certification interfaces
 */
export interface FrameworkCertificationStatus {
  framework: string;
  organizationId: string;
  overallReadiness: number; // 0-100
  status: 'NOT_READY' | 'PREPARING' | 'READY' | 'CERTIFIED' | 'EXPIRED';
  requirements: {
    controlId: string;
    requirement: string;
    status: 'MET' | 'PARTIAL' | 'NOT_MET';
    evidence: string[];
    gaps: string[];
  }[];
  estimatedCertificationDate: Date;
  nextReviewDate: Date;
  certificationCost: number;
  recommendations: string[];
}

export interface CertificationPackage {
  framework: string;
  organizationId: string;
  packageId: string;
  generatedAt: Date;
  controls?: any[]; // Added for compatibility with audit package generation
  evidence?: any[]; // Added for audit package evidence
  testResults?: any[]; // Added for audit package test results
  documents: {
    type: 'EVIDENCE' | 'REPORT' | 'ATTESTATION' | 'REMEDIATION_PLAN';
    name: string;
    path: string;
    size: number;
    checksum: string;
  }[];
  controlMappings: {
    controlId: string;
    requirement: string;
    evidence: string[];
    testResults: string[];
  }[];
  executiveSummary: {
    readinessScore: number;
    criticalGaps: number;
    recommendedActions: string[];
    timeline: string;
  };
}

/**
 * External system integration interfaces
 */
export interface ExternalSystemConfig {
  systemType: 'GRC' | 'ITSM' | 'RISK_MANAGEMENT' | 'AUDIT' | 'CUSTOM';
  endpoint: string;
  authentication: {
    type: 'API_KEY' | 'OAUTH' | 'BASIC' | 'CERTIFICATE';
    credentials: Record<string, string>;
  };
  mappings: {
    localField: string;
    externalField: string;
    transformation?: string;
  }[];
  syncFrequency: 'REAL_TIME' | 'HOURLY' | 'DAILY' | 'WEEKLY' | 'MANUAL';
}

export interface ExternalSystemExportResult {
  systemType: string;
  exportId: string;
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
  exportedControls: number;
  failedControls: number;
  errors: string[];
  exportedAt: Date;
  externalReference?: string;
}

export interface ExternalSystemImportResult {
  systemType: string;
  importId: string;
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
  importedControls: number;
  skippedControls: number;
  errors: string[];
  importedAt: Date;
  conflicts: {
    controlId: string;
    field: string;
    localValue: any;
    externalValue: any;
    resolution: 'KEEP_LOCAL' | 'USE_EXTERNAL' | 'MERGE';
  }[];
}

/**
 * Interface for external control data during import operations
 * Ensures type safety for external system integrations
 */
export interface ExternalControlData {
  code: string;
  name: string;
  description: string;
  objective?: string;
  category: string;
  type?: string;
  status?: string;
  frequency?: string;
  requirements?: string;
  implementationGuidance?: string;
  frameworks?: Array<{
    name: string;
    section?: string;
    reference?: string;
    requirements?: string;
  }>;
  testProcedures?: string[];
  evidenceRequirements?: string[];
  riskRating?: string;
  priority?: string;
  tags?: string[];
}

/**
 * Type for conflict detection between local and external controls
 */
export interface ControlFieldConflict {
  field: string;
  localValue: unknown;
  externalValue: unknown;
}

/**
 * Control coverage analysis interfaces
 */
export interface ControlCoverageOverall {
  totalControls: number;
  implementedControls: number;
  fullyImplemented: number;
  averageSuccessRate?: number;
  avgTestDuration?: number;
  riskScore?: number;
  coveragePercentage: number;
}

export interface ControlCoverageByCategory {
  category: string;
  total: number;
  implemented: number;
  averageSuccessRate?: number;
  fullyImplemented?: number;
  coveragePercentage?: number;
}

export interface ControlCoverageResult {
  overall: ControlCoverageOverall;
  byCategory: ControlCoverageByCategory[];
  byFramework?: Array<{
    framework: string;
    total: number;
    implemented: number;
    fullyImplemented?: number;
    coveragePercentage: number;
  }>;
}

