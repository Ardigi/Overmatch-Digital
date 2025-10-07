import { z } from 'zod';

export interface ControlTestingFormProps {
  controlId: string;
  controlName?: string;
  onSuccess?: (testId: string) => void;
  onCancel?: () => void;
  initialData?: Partial<ControlTestFormData>;
  mode?: 'create' | 'edit';
}

export interface ControlTestFormData {
  // Step 1: Test Metadata
  testerId: string;
  testDate: string;
  testType: 'MANUAL' | 'AUTOMATED' | 'WALKTHROUGH' | 'INQUIRY' | 'OBSERVATION';
  methodology: 'INQUIRY' | 'OBSERVATION' | 'INSPECTION' | 'REPERFORMANCE';
  scope?: string;
  sampleSize?: number;
  population?: number;
  samplingMethod?: 'RANDOM' | 'JUDGMENTAL' | 'SYSTEMATIC' | 'STATISTICAL';
  
  // Step 2: Test Procedures
  procedures: TestProcedure[];
  procedureNotes?: string;
  
  // Step 3: Evidence Collection
  evidence: {
    files: File[];
    descriptions: string[];
    types: string[];
  };
  evidenceNotes?: string;
  
  // Step 4: Findings & Assessment
  result: 'PASS' | 'FAIL' | 'PARTIAL';
  findings: string;
  exceptions?: string;
  recommendations?: string;
  riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  remediationRequired?: boolean;
  remediationPlan?: string;
  remediationDeadline?: string;
  
  // Step 5: Sign-off
  reviewerId?: string;
  reviewerComments?: string;
  signOffDate?: string;
  digitalSignature: string;
  confirmAccuracy: boolean;
}

export interface TestProcedure {
  id: string;
  title: string;
  description: string;
  required: boolean;
  completed: boolean;
  result?: 'PASS' | 'FAIL' | 'N/A';
  notes?: string;
  evidence?: string[];
}

// Zod validation schemas for each step
export const testMetadataSchema = z.object({
  testerId: z.string().min(1, 'Tester is required'),
  testDate: z.string().min(1, 'Test date is required'),
  testType: z.enum(['MANUAL', 'AUTOMATED', 'WALKTHROUGH', 'INQUIRY', 'OBSERVATION']),
  methodology: z.enum(['INQUIRY', 'OBSERVATION', 'INSPECTION', 'REPERFORMANCE']),
  scope: z.string().optional(),
  sampleSize: z.number().min(0).optional(),
  population: z.number().min(0).optional(),
  samplingMethod: z.enum(['RANDOM', 'JUDGMENTAL', 'SYSTEMATIC', 'STATISTICAL']).optional(),
});

export const testProceduresSchema = z.object({
  procedures: z.array(z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    required: z.boolean(),
    completed: z.boolean(),
    result: z.enum(['PASS', 'FAIL', 'N/A']).optional(),
    notes: z.string().optional(),
    evidence: z.array(z.string()).optional(),
  })).refine(
    (procedures) => procedures.filter(p => p.required).every(p => p.completed),
    'All required procedures must be completed'
  ),
  procedureNotes: z.string().optional(),
});

export const evidenceCollectionSchema = z.object({
  evidence: z.object({
    files: z.array(z.any()).optional(),
    descriptions: z.array(z.string()).optional(),
    types: z.array(z.string()).optional(),
  }),
  evidenceNotes: z.string().optional(),
});

export const findingsAssessmentSchema = z.object({
  result: z.enum(['PASS', 'FAIL', 'PARTIAL']),
  findings: z.string().min(1, 'Findings are required'),
  exceptions: z.string().optional(),
  recommendations: z.string().optional(),
  riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  remediationRequired: z.boolean().optional(),
  remediationPlan: z.string().optional(),
  remediationDeadline: z.string().optional(),
}).refine(
  (data) => {
    if (data.result === 'FAIL' && !data.remediationPlan) {
      return false;
    }
    return true;
  },
  {
    message: 'Remediation plan is required for failed tests',
    path: ['remediationPlan'],
  }
);

export const signOffSchema = z.object({
  reviewerId: z.string().optional(),
  reviewerComments: z.string().optional(),
  signOffDate: z.string().optional(),
  digitalSignature: z.string().min(1, 'Digital signature is required'),
  confirmAccuracy: z.literal(true, {
    errorMap: () => ({ message: 'You must confirm the accuracy of the test results' }),
  }),
});

// Combined schema for full form validation
export const controlTestFormSchema = z.object({
  ...testMetadataSchema.shape,
  ...testProceduresSchema.shape,
  ...evidenceCollectionSchema.shape,
  ...findingsAssessmentSchema.shape,
  ...signOffSchema.shape,
});

// Wizard context types
export interface TestingWizardContextType {
  currentStep: number;
  totalSteps: number;
  formData: Partial<ControlTestFormData>;
  isValid: boolean;
  canProceed: boolean;
  
  // Navigation
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (step: number) => void;
  
  // Data management
  updateFormData: (stepData: Partial<ControlTestFormData>) => void;
  validateCurrentStep: () => boolean;
  getStepErrors: () => z.ZodError | null;
  
  // Auto-save
  isDirty: boolean;
  lastSaved?: Date;
  autoSave: () => Promise<void>;
  saveDraft: () => Promise<void>;
  
  // Submission
  isSubmitting: boolean;
  submitForm: () => Promise<void>;
}

export interface StepIndicatorProps {
  currentStep: number;
  totalSteps: number;
  steps: Array<{
    title: string;
    description?: string;
    icon?: React.ComponentType<{ className?: string }>;
  }>;
  onStepClick?: (step: number) => void;
}

export interface TestingFormStepProps {
  onNext?: () => void;
  onPrev?: () => void;
  isFirstStep?: boolean;
  isLastStep?: boolean;
}