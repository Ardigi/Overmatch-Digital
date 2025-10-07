'use client';

import {
  ArrowRightIcon,
  CalculatorIcon,
  ChartBarIcon,
  CheckCircleIcon,
  ClipboardDocumentCheckIcon,
  ClockIcon,
  DocumentTextIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import React, { useState } from 'react';

interface AssessmentQuestion {
  id: string;
  category: string;
  question: string;
  weight: number;
  type: 'boolean' | 'scale' | 'multiple';
  options?: string[];
}

interface AssessmentCategory {
  name: string;
  description: string;
  icon: any;
  questions: AssessmentQuestion[];
}

export default function RiskAssessment() {
  const [activeCategory, setActiveCategory] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [showResults, setShowResults] = useState(false);

  // SOC 2 aligned risk assessment categories
  const categories: AssessmentCategory[] = [
    {
      name: 'Security',
      description: 'Assess security controls and vulnerabilities',
      icon: ClipboardDocumentCheckIcon,
      questions: [
        {
          id: 'sec-1',
          category: 'Security',
          question: 'Do you have a formal information security policy?',
          weight: 3,
          type: 'boolean',
        },
        {
          id: 'sec-2',
          category: 'Security',
          question: 'How often are security assessments performed?',
          weight: 2,
          type: 'multiple',
          options: ['Never', 'Annually', 'Semi-annually', 'Quarterly', 'Monthly'],
        },
        {
          id: 'sec-3',
          category: 'Security',
          question: 'Rate your access control maturity',
          weight: 3,
          type: 'scale',
        },
        {
          id: 'sec-4',
          category: 'Security',
          question: 'Is multi-factor authentication enforced?',
          weight: 3,
          type: 'boolean',
        },
        {
          id: 'sec-5',
          category: 'Security',
          question: 'Do you have an incident response plan?',
          weight: 3,
          type: 'boolean',
        },
      ],
    },
    {
      name: 'Availability',
      description: 'Evaluate system availability and resilience',
      icon: ChartBarIcon,
      questions: [
        {
          id: 'avail-1',
          category: 'Availability',
          question: 'What is your target uptime SLA?',
          weight: 2,
          type: 'multiple',
          options: ['< 99%', '99% - 99.5%', '99.5% - 99.9%', '99.9% - 99.99%', '> 99.99%'],
        },
        {
          id: 'avail-2',
          category: 'Availability',
          question: 'Do you have disaster recovery procedures?',
          weight: 3,
          type: 'boolean',
        },
        {
          id: 'avail-3',
          category: 'Availability',
          question: 'How often are backups tested?',
          weight: 2,
          type: 'multiple',
          options: ['Never', 'Annually', 'Quarterly', 'Monthly', 'Weekly'],
        },
        {
          id: 'avail-4',
          category: 'Availability',
          question: 'Rate your redundancy implementation',
          weight: 2,
          type: 'scale',
        },
      ],
    },
    {
      name: 'Processing Integrity',
      description: 'Assess data processing accuracy and completeness',
      icon: CalculatorIcon,
      questions: [
        {
          id: 'proc-1',
          category: 'Processing Integrity',
          question: 'Are automated data validation controls in place?',
          weight: 3,
          type: 'boolean',
        },
        {
          id: 'proc-2',
          category: 'Processing Integrity',
          question: 'How often are processing controls reviewed?',
          weight: 2,
          type: 'multiple',
          options: ['Never', 'Annually', 'Semi-annually', 'Quarterly', 'Monthly'],
        },
        {
          id: 'proc-3',
          category: 'Processing Integrity',
          question: 'Rate your change management process maturity',
          weight: 3,
          type: 'scale',
        },
      ],
    },
    {
      name: 'Confidentiality',
      description: 'Evaluate data confidentiality controls',
      icon: DocumentTextIcon,
      questions: [
        {
          id: 'conf-1',
          category: 'Confidentiality',
          question: 'Is data encrypted at rest and in transit?',
          weight: 3,
          type: 'boolean',
        },
        {
          id: 'conf-2',
          category: 'Confidentiality',
          question: 'Do you have data classification policies?',
          weight: 2,
          type: 'boolean',
        },
        {
          id: 'conf-3',
          category: 'Confidentiality',
          question: 'Rate your data loss prevention controls',
          weight: 2,
          type: 'scale',
        },
      ],
    },
  ];

  const handleAnswer = (questionId: string, value: any) => {
    setAnswers({ ...answers, [questionId]: value });
  };

  const calculateCategoryScore = (category: AssessmentCategory) => {
    let totalWeight = 0;
    let score = 0;

    category.questions.forEach((question) => {
      const answer = answers[question.id];
      if (answer !== undefined) {
        totalWeight += question.weight;

        if (question.type === 'boolean') {
          score += answer ? question.weight : 0;
        } else if (question.type === 'scale') {
          score += (answer / 5) * question.weight;
        } else if (question.type === 'multiple') {
          const optionIndex = question.options?.indexOf(answer) || 0;
          score += (optionIndex / ((question.options?.length || 1) - 1)) * question.weight;
        }
      }
    });

    return totalWeight > 0 ? (score / totalWeight) * 100 : 0;
  };

  const calculateOverallScore = () => {
    const scores = categories.map((cat) => calculateCategoryScore(cat));
    return scores.reduce((acc, score) => acc + score, 0) / categories.length;
  };

  const getRiskLevel = (score: number) => {
    if (score >= 80) return { level: 'Low', color: 'text-green-600' };
    if (score >= 60) return { level: 'Medium', color: 'text-yellow-600' };
    if (score >= 40) return { level: 'High', color: 'text-orange-600' };
    return { level: 'Critical', color: 'text-red-600' };
  };

  const currentCategory = categories[activeCategory];
  const isLastCategory = activeCategory === categories.length - 1;
  const canProceed = currentCategory.questions.every((q) => answers[q.id] !== undefined);

  return (
    <div className="space-y-6">
      {!showResults ? (
        <>
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">SOC 2 Risk Assessment Tool</h3>
              <div className="text-sm text-gray-600">
                Category {activeCategory + 1} of {categories.length}
              </div>
            </div>

            <div className="flex items-center gap-2 mb-6">
              {categories.map((cat, index) => (
                <React.Fragment key={index}>
                  <div
                    className={`flex items-center justify-center w-8 h-8 rounded-full ${
                      index < activeCategory
                        ? 'bg-green-100 text-green-600'
                        : index === activeCategory
                          ? 'bg-primary-100 text-primary-600'
                          : 'bg-gray-100 text-gray-400'
                    }`}
                  >
                    {index < activeCategory ? (
                      <CheckCircleIcon className="h-5 w-5" />
                    ) : (
                      <span className="text-sm font-medium">{index + 1}</span>
                    )}
                  </div>
                  {index < categories.length - 1 && (
                    <div
                      className={`flex-1 h-0.5 ${
                        index < activeCategory ? 'bg-green-600' : 'bg-gray-300'
                      }`}
                    />
                  )}
                </React.Fragment>
              ))}
            </div>

            <div className="mb-6">
              <div className="flex items-center gap-3 mb-2">
                <currentCategory.icon className="h-6 w-6 text-primary-600" />
                <h4 className="text-xl font-semibold text-gray-900">{currentCategory.name}</h4>
              </div>
              <p className="text-gray-600">{currentCategory.description}</p>
            </div>

            <div className="space-y-6">
              {currentCategory.questions.map((question) => (
                <div key={question.id} className="border-b border-gray-200 pb-6 last:border-0">
                  <label className="block text-sm font-medium text-gray-900 mb-3">
                    {question.question}
                  </label>

                  {question.type === 'boolean' && (
                    <div className="flex gap-4">
                      <button
                        onClick={() => handleAnswer(question.id, true)}
                        className={`px-4 py-2 rounded-lg border ${
                          answers[question.id] === true
                            ? 'bg-green-100 border-green-300 text-green-700'
                            : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        Yes
                      </button>
                      <button
                        onClick={() => handleAnswer(question.id, false)}
                        className={`px-4 py-2 rounded-lg border ${
                          answers[question.id] === false
                            ? 'bg-red-100 border-red-300 text-red-700'
                            : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        No
                      </button>
                    </div>
                  )}

                  {question.type === 'scale' && (
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map((value) => (
                        <button
                          key={value}
                          onClick={() => handleAnswer(question.id, value)}
                          className={`flex-1 py-2 rounded-lg border ${
                            answers[question.id] === value
                              ? 'bg-primary-100 border-primary-300 text-primary-700'
                              : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          {value}
                        </button>
                      ))}
                    </div>
                  )}

                  {question.type === 'multiple' && (
                    <select
                      value={answers[question.id] || ''}
                      onChange={(e) => handleAnswer(question.id, e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    >
                      <option value="">Select an option</option>
                      {question.options?.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-between mt-6">
              <button
                onClick={() => setActiveCategory(activeCategory - 1)}
                disabled={activeCategory === 0}
                className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>

              {isLastCategory ? (
                <button
                  onClick={() => setShowResults(true)}
                  disabled={!canProceed}
                  className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  View Results
                </button>
              ) : (
                <button
                  onClick={() => setActiveCategory(activeCategory + 1)}
                  disabled={!canProceed}
                  className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                  <ArrowRightIcon className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-6">Risk Assessment Results</h3>

            <div className="text-center mb-8">
              <div className="text-5xl font-bold mb-2">{calculateOverallScore().toFixed(0)}%</div>
              <div
                className={`text-2xl font-semibold ${getRiskLevel(calculateOverallScore()).color}`}
              >
                {getRiskLevel(calculateOverallScore()).level} Risk
              </div>
            </div>

            <div className="space-y-4">
              {categories.map((category) => {
                const score = calculateCategoryScore(category);
                const Icon = category.icon;

                return (
                  <div key={category.name} className="flex items-center gap-4">
                    <Icon className="h-5 w-5 text-gray-400" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-900">{category.name}</span>
                        <span className={`text-sm font-semibold ${getRiskLevel(score).color}`}>
                          {score.toFixed(0)}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            score >= 80
                              ? 'bg-green-600'
                              : score >= 60
                                ? 'bg-yellow-600'
                                : score >= 40
                                  ? 'bg-orange-600'
                                  : 'bg-red-600'
                          }`}
                          style={{ width: `${score}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <button
              onClick={() => {
                setShowResults(false);
                setActiveCategory(0);
              }}
              className="btn-secondary"
            >
              Review Answers
            </button>
            <button className="btn-primary">Generate Risk Report</button>
          </div>
        </div>
      )}
    </div>
  );
}
