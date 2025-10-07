'use client';

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { useCreateControlTest } from '@/hooks/api/useControls';
import type { 
  ControlTestFormData, 
  TestingWizardContextType 
} from '@/types/control-testing.types';
import {
  testMetadataSchema,
  testProceduresSchema,
  evidenceCollectionSchema,
  findingsAssessmentSchema,
  signOffSchema,
} from '@/types/control-testing.types';

const TestingWizardContext = createContext<TestingWizardContextType | null>(null);

export function useTestingWizard() {
  const context = useContext(TestingWizardContext);
  if (!context) {
    throw new Error('useTestingWizard must be used within TestingWizardProvider');
  }
  return context;
}

interface TestingWizardProviderProps {
  children: ReactNode;
  controlId: string;
  onSuccess?: (testId: string) => void;
  initialData?: Partial<ControlTestFormData>;
}

export function TestingWizardProvider({ 
  children, 
  controlId, 
  onSuccess,
  initialData = {} 
}: TestingWizardProviderProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<Partial<ControlTestFormData>>(initialData);
  const [isDirty, setIsDirty] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stepErrors, setStepErrors] = useState<z.ZodError | null>(null);
  
  const totalSteps = 5;

  // API mutation for saving draft
  const { mutate: createTest } = useCreateControlTest({
    onSuccess: (result: any) => {
      setLastSaved(new Date());
      setIsDirty(false);
      if (result.status === 'COMPLETED') {
        toast.success('Test completed successfully');
        onSuccess?.(result.id);
      } else {
        toast.success('Draft saved');
      }
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to save test');
    }
  });

  // Update form data
  const updateFormData = useCallback((stepData: Partial<ControlTestFormData>) => {
    setFormData(prev => ({ ...prev, ...stepData }));
    setIsDirty(true);
    setStepErrors(null);
  }, []);

  // Get validation schema for current step
  const getCurrentStepSchema = useCallback(() => {
    switch (currentStep) {
      case 1:
        return testMetadataSchema;
      case 2:
        return testProceduresSchema;
      case 3:
        return evidenceCollectionSchema;
      case 4:
        return findingsAssessmentSchema;
      case 5:
        return signOffSchema;
      default:
        return z.object({});
    }
  }, [currentStep]);

  // Validate current step
  const validateCurrentStep = useCallback(() => {
    const schema = getCurrentStepSchema();
    try {
      // Extract only the fields relevant to current step
      const stepFields = Object.keys(schema.shape);
      const stepData = stepFields.reduce((acc, field) => {
        if (formData[field as keyof ControlTestFormData] !== undefined) {
          acc[field] = formData[field as keyof ControlTestFormData];
        }
        return acc;
      }, {} as any);

      schema.parse(stepData);
      setStepErrors(null);
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        setStepErrors(error);
      }
      return false;
    }
  }, [currentStep, formData, getCurrentStepSchema]);

  // Check if can proceed to next step
  const canProceed = useCallback(() => {
    // For now, allow proceeding without full validation except for final step
    if (currentStep === 5) {
      return validateCurrentStep();
    }
    return true;
  }, [currentStep, validateCurrentStep]);

  // Navigation functions
  const nextStep = useCallback(() => {
    if (validateCurrentStep() && currentStep < totalSteps) {
      setCurrentStep(prev => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [currentStep, totalSteps, validateCurrentStep]);

  const prevStep = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [currentStep]);

  const goToStep = useCallback((step: number) => {
    if (step >= 1 && step <= totalSteps) {
      // Allow going back without validation
      if (step < currentStep) {
        setCurrentStep(step);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else if (step > currentStep && canProceed()) {
        setCurrentStep(step);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  }, [currentStep, totalSteps, canProceed]);

  // Save draft
  const saveDraft = useCallback(async () => {
    try {
      await createTest({
        controlId,
        data: {
          ...formData,
          status: 'DRAFT',
        } as any
      });
    } catch (error) {
      console.error('Failed to save draft:', error);
    }
  }, [controlId, formData, createTest]);

  // Auto-save functionality
  const autoSave = useCallback(async () => {
    if (isDirty && !isSubmitting) {
      await saveDraft();
    }
  }, [isDirty, isSubmitting, saveDraft]);

  // Auto-save every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (isDirty && !isSubmitting) {
        autoSave();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [isDirty, isSubmitting, autoSave]);

  // Submit form
  const submitForm = useCallback(async () => {
    setIsSubmitting(true);
    try {
      // Validate all steps
      const allSchemas = [
        testMetadataSchema,
        testProceduresSchema,
        evidenceCollectionSchema,
        findingsAssessmentSchema,
        signOffSchema,
      ];

      // Validate each schema
      for (const schema of allSchemas) {
        try {
          const stepFields = Object.keys(schema.shape);
          const stepData = stepFields.reduce((acc, field) => {
            if (formData[field as keyof ControlTestFormData] !== undefined) {
              acc[field] = formData[field as keyof ControlTestFormData];
            }
            return acc;
          }, {} as any);
          schema.parse(stepData);
        } catch (error) {
          if (error instanceof z.ZodError) {
            toast.error('Please complete all required fields');
            setIsSubmitting(false);
            return;
          }
        }
      }

      // Submit test
      await createTest({
        controlId,
        data: {
          ...formData,
          status: 'COMPLETED',
        } as any
      });

      setIsSubmitting(false);
    } catch (error) {
      console.error('Failed to submit test:', error);
      toast.error('Failed to submit test');
      setIsSubmitting(false);
    }
  }, [controlId, formData, createTest]);

  // Get errors for current step
  const getStepErrors = useCallback(() => {
    return stepErrors;
  }, [stepErrors]);

  const value: TestingWizardContextType = {
    currentStep,
    totalSteps,
    formData,
    isValid: validateCurrentStep(),
    canProceed: canProceed(),
    nextStep,
    prevStep,
    goToStep,
    updateFormData,
    validateCurrentStep,
    getStepErrors,
    isDirty,
    lastSaved,
    autoSave,
    saveDraft,
    isSubmitting,
    submitForm,
  };

  return (
    <TestingWizardContext.Provider value={value}>
      {children}
    </TestingWizardContext.Provider>
  );
}