import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Validate,
  ValidateNested,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
} from 'class-validator';
import { Sanitize } from '../../../shared/decorators/sanitize.decorator';

// Custom validator for future dates
@ValidatorConstraint({ name: 'minDate', async: false })
export class IsFutureDateConstraint implements ValidatorConstraintInterface {
  validate(date: any) {
    if (!date) return true; // Optional field
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) return false; // Invalid date
    return dateObj > new Date();
  }

  defaultMessage() {
    return 'Date must be in the future';
  }
}

class FinalChecklistDto {
  @IsOptional()
  @IsBoolean()
  contractsSigned?: boolean;

  @IsOptional()
  @IsBoolean()
  systemAccessGranted?: boolean;

  @IsOptional()
  @IsBoolean()
  trainingCompleted?: boolean;

  @IsOptional()
  @IsBoolean()
  contractSigned?: boolean;

  @IsOptional()
  @IsBoolean()
  paymentMethodSetup?: boolean;

  @IsOptional()
  @IsBoolean()
  usersProvisioned?: boolean;

  @IsOptional()
  @IsBoolean()
  integrationsConfigured?: boolean;

  @IsOptional()
  @IsBoolean()
  initialAssessmentComplete?: boolean;

  @IsOptional()
  @IsBoolean()
  trainingComplete?: boolean;
}

class OnboardingTaskDto {
  @IsString()
  @Sanitize()
  name: string;

  @IsOptional()
  @IsString()
  @Sanitize()
  description?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  @Sanitize()
  assignedTo?: string;

  @IsOptional()
  @IsString()
  status?: string;
}

export class StartOnboardingDto {
  @IsUUID()
  @IsNotEmpty()
  clientId: string;

  @IsOptional()
  @IsUUID()
  projectManagerId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true, message: 'Custom tasks cannot be empty' })
  customTasks?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  @Sanitize()
  notes?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class UpdateOnboardingStatusDto {
  @IsString()
  @Sanitize()
  status: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  @Sanitize()
  notes?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  completedTasks?: string[];

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class CompleteOnboardingDto {
  @IsString()
  @IsNotEmpty()
  @Sanitize()
  summary: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => FinalChecklistDto)
  finalChecklist?: FinalChecklistDto;

  @IsOptional()
  @IsDateString()
  @Validate(IsFutureDateConstraint)
  firstAuditScheduled?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(1000, { each: true })
  @ArrayMaxSize(10)
  recommendations?: string[];

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
