'use client';

import { useState, useEffect } from 'react';
import { useTestingWizard } from '@/hooks/useTestingWizard';
import {
  CheckCircleIcon,
  XCircleIcon,
  DocumentTextIcon,
  ClipboardDocumentCheckIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import type { TestProcedure } from '@/types/control-testing.types';

// Mock procedures - in real app, these would come from the control definition
const mockProcedures: TestProcedure[] = [
  {
    id: '1',
    title: 'Verify Access Control Configuration',
    description: 'Review system access control settings and ensure they align with documented policies',
    required: true,
    completed: false,
  },
  {
    id: '2',
    title: 'Test User Authentication',
    description: 'Attempt login with valid and invalid credentials to verify authentication controls',
    required: true,
    completed: false,
  },
  {
    id: '3',
    title: 'Review Audit Logs',
    description: 'Examine audit logs for the testing period to verify logging is functioning',
    required: true,
    completed: false,
  },
  {
    id: '4',
    title: 'Validate Authorization Matrix',
    description: 'Verify that user permissions match the approved authorization matrix',
    required: false,
    completed: false,
  },
  {
    id: '5',
    title: 'Test Session Timeout',
    description: 'Verify that inactive sessions timeout according to policy',
    required: false,
    completed: false,
  },
];

export default function TestProceduresStep() {
  const { formData, updateFormData, nextStep, validateCurrentStep } = useTestingWizard();
  const [procedures, setProcedures] = useState<TestProcedure[]>(
    formData.procedures || mockProcedures
  );
  const [procedureNotes, setProcedureNotes] = useState(formData.procedureNotes || '');
  const [expandedProcedure, setExpandedProcedure] = useState<string | null>(null);

  const requiredProcedures = procedures.filter(p => p.required);
  const completedRequired = requiredProcedures.filter(p => p.completed).length;
  const totalRequired = requiredProcedures.length;
  const progressPercentage = totalRequired > 0 ? (completedRequired / totalRequired) * 100 : 0;

  const handleProcedureToggle = (procedureId: string) => {
    setProcedures(prev => prev.map(p => 
      p.id === procedureId 
        ? { ...p, completed: !p.completed, result: !p.completed ? 'PASS' : undefined }
        : p
    ));
  };

  const handleProcedureResult = (procedureId: string, result: 'PASS' | 'FAIL' | 'N/A') => {
    setProcedures(prev => prev.map(p => 
      p.id === procedureId ? { ...p, result } : p
    ));
  };

  const handleProcedureNotes = (procedureId: string, notes: string) => {
    setProcedures(prev => prev.map(p => 
      p.id === procedureId ? { ...p, notes } : p
    ));
  };

  const handleNext = () => {
    updateFormData({ 
      procedures,
      procedureNotes 
    });
    
    if (completedRequired === totalRequired) {
      nextStep();
    }
  };

  useEffect(() => {
    // Auto-save procedures
    const timer = setTimeout(() => {
      updateFormData({ procedures, procedureNotes });
    }, 1000);
    return () => clearTimeout(timer);
  }, [procedures, procedureNotes]);

  return (
    <div className="space-y-6">
      {/* Progress Overview */}
      <div className="bg-white shadow-sm rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-gray-900 flex items-center">
              <ClipboardDocumentCheckIcon className="h-5 w-5 mr-2 text-gray-400" />
              Test Procedures Checklist
            </h3>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-500">
                {completedRequired} of {totalRequired} required completed
              </span>
              <div className="w-32 bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
            </div>
          </div>
        </div>
        
        <div className="px-6 py-4">
          <div className="space-y-3">
            {procedures.map((procedure) => (
              <div
                key={procedure.id}
                className={`border rounded-lg ${
                  procedure.completed ? 'border-green-200 bg-green-50' : 'border-gray-200'
                }`}
              >
                <div className="p-4">
                  <div className="flex items-start">
                    <div className="flex items-center h-5">
                      <input
                        type="checkbox"
                        checked={procedure.completed}
                        onChange={() => handleProcedureToggle(procedure.id)}
                        className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                      />
                    </div>
                    <div className="ml-3 flex-1">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <label className="text-sm font-medium text-gray-900">
                            {procedure.title}
                            {procedure.required && (
                              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                                Required
                              </span>
                            )}
                          </label>
                          <p className="text-sm text-gray-500 mt-1">
                            {procedure.description}
                          </p>
                        </div>
                        
                        {procedure.completed && (
                          <div className="ml-4 flex items-center space-x-2">
                            <button
                              onClick={() => handleProcedureResult(procedure.id, 'PASS')}
                              className={`p-1 rounded ${
                                procedure.result === 'PASS' 
                                  ? 'bg-green-100 text-green-600' 
                                  : 'text-gray-400 hover:bg-gray-100'
                              }`}
                              title="Pass"
                            >
                              <CheckCircleIcon className="h-5 w-5" />
                            </button>
                            <button
                              onClick={() => handleProcedureResult(procedure.id, 'FAIL')}
                              className={`p-1 rounded ${
                                procedure.result === 'FAIL' 
                                  ? 'bg-red-100 text-red-600' 
                                  : 'text-gray-400 hover:bg-gray-100'
                              }`}
                              title="Fail"
                            >
                              <XCircleIcon className="h-5 w-5" />
                            </button>
                            <button
                              onClick={() => setExpandedProcedure(
                                expandedProcedure === procedure.id ? null : procedure.id
                              )}
                              className="p-1 text-gray-400 hover:bg-gray-100 rounded"
                              title="Add notes"
                            >
                              <DocumentTextIcon className="h-5 w-5" />
                            </button>
                          </div>
                        )}
                      </div>
                      
                      {/* Expanded Notes Section */}
                      {expandedProcedure === procedure.id && (
                        <div className="mt-3">
                          <textarea
                            value={procedure.notes || ''}
                            onChange={(e) => handleProcedureNotes(procedure.id, e.target.value)}
                            placeholder="Add notes about this procedure..."
                            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                            rows={3}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Overall Procedure Notes */}
      <div className="bg-white shadow-sm rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-base font-semibold text-gray-900">Additional Notes</h3>
        </div>
        <div className="px-6 py-4">
          <textarea
            value={procedureNotes}
            onChange={(e) => setProcedureNotes(e.target.value)}
            placeholder="Add any additional observations or notes about the test procedures..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
            rows={4}
          />
        </div>
      </div>

      {/* Warning if not all required procedures are complete */}
      {completedRequired < totalRequired && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex">
            <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400 mt-0.5" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">Incomplete Required Procedures</h3>
              <p className="mt-1 text-sm text-yellow-700">
                You must complete all required procedures before proceeding to the next step.
                {totalRequired - completedRequired} required procedure(s) remaining.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}