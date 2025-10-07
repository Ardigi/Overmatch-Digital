import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsObject, IsOptional, IsUUID } from 'class-validator';

export class ValidateCompletionDto {
  @ApiProperty({ description: 'Remediation ID to validate' })
  @IsUUID()
  remediationId: string;

  @ApiPropertyOptional({ description: 'Evidence IDs supporting completion' })
  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  evidenceIds?: string[];

  @ApiPropertyOptional({ description: 'Testing results' })
  @IsObject()
  @IsOptional()
  testingResults?: {
    functionalTesting?: string;
    securityTesting?: string;
    performanceTesting?: string;
    userAcceptanceTesting?: string;
  };

  @ApiPropertyOptional({ description: 'Completion notes' })
  @IsOptional()
  completionNotes?: string;

  @ApiPropertyOptional({ description: 'Validation checklist items' })
  @IsObject()
  @IsOptional()
  validationChecklist?: Record<string, boolean>;
}
