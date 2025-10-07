import { ImplementationStatus } from '../../modules/implementation/entities/control-implementation.entity';

/**
 * Gap remediation structure with type safety
 */
export interface GapRemediation {
  description: string;
  impact: 'HIGH' | 'MEDIUM' | 'LOW';
  remediationPlan: string;
  targetDate: Date;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';
}

/**
 * Implementation update data structure
 */
export interface ImplementationUpdateData {
  status: ImplementationStatus;
  notes?: string;
  effectiveness?: 'EFFECTIVE' | 'PARTIALLY_EFFECTIVE' | 'INEFFECTIVE';
  gaps?: GapRemediation[];
  lastTestedDate?: Date;
  nextTestingDate?: Date;
  evidence?: string[];
}

/**
 * Transformed implementation update for service layer
 */
export interface ServiceImplementationUpdate {
  status: ImplementationStatus;
  notes?: string;
  effectiveness?: 'EFFECTIVE' | 'PARTIALLY_EFFECTIVE' | 'INEFFECTIVE';
  gaps?: ServiceGapData[];
  lastTestedDate?: Date;
  nextTestingDate?: Date;
  evidence?: string[];
}

/**
 * Service-level gap data structure
 */
export interface ServiceGapData {
  description: string;
  severity: 'high' | 'medium' | 'low';
  remediationPlan: string;
  targetDate: Date;
  status: 'open' | 'in_progress' | 'resolved';
}

/**
 * Evidence data for validation
 */
export interface EvidenceValidationRequest {
  evidenceId: string;
  controlId: string;
  organizationId: string;
  validationType?: 'automated' | 'manual';
}

/**
 * DTO with evidence extension
 */
export interface UpdateDtoWithEvidence {
  status?: ImplementationStatus;
  notes?: string;
  effectiveness?: 'EFFECTIVE' | 'PARTIALLY_EFFECTIVE' | 'INEFFECTIVE';
  gaps?: GapRemediation[];
  evidence?: string[];
  lastTestedDate?: Date;
  nextTestingDate?: Date;
}

/**
 * Service discovery response for evidence validation
 */
export interface EvidenceServiceResponse {
  data?: {
    id?: string;
    isValid?: boolean;
    validatedAt?: Date;
  };
  success?: boolean;
  error?: string;
}