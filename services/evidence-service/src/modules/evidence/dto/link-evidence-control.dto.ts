import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsEnum, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';

export class LinkEvidenceToControlDto {
  @ApiProperty({ description: 'Control ID to link evidence to' })
  @IsUUID()
  controlId: string;

  @ApiProperty({ description: 'Organization ID' })
  @IsUUID()
  organizationId: string;

  @ApiProperty({
    description: 'Framework this control belongs to',
    example: 'SOC2',
  })
  @IsString()
  @IsOptional()
  framework?: string;

  @ApiProperty({
    description: 'Control code',
    example: 'CC1.1',
  })
  @IsString()
  @IsOptional()
  controlCode?: string;

  @ApiProperty({
    description: 'Test ID if linking to a specific test',
    required: false,
  })
  @IsUUID()
  @IsOptional()
  testId?: string;

  @ApiProperty({
    description: 'Additional metadata for the link',
    required: false,
  })
  @IsObject()
  @IsOptional()
  metadata?: {
    mappingType?: 'primary' | 'supporting' | 'compensating';
    relevanceScore?: number;
    notes?: string;
  };
}

export class BulkLinkEvidenceDto {
  @ApiProperty({
    description: 'Array of evidence IDs to link',
    type: [String],
  })
  @IsArray()
  @IsUUID('4', { each: true })
  evidenceIds: string[];

  @ApiProperty({ description: 'Control ID to link evidence to' })
  @IsUUID()
  controlId: string;

  @ApiProperty({ description: 'Organization ID' })
  @IsUUID()
  organizationId: string;

  @ApiProperty({
    description: 'Framework this control belongs to',
    example: 'SOC2',
    required: false,
  })
  @IsString()
  @IsOptional()
  framework?: string;
}

export class UnlinkEvidenceFromControlDto {
  @ApiProperty({ description: 'Control ID to unlink from' })
  @IsUUID()
  controlId: string;

  @ApiProperty({
    description: 'Remove all framework mappings for this control',
    default: false,
  })
  @IsOptional()
  removeFromFramework?: boolean;
}

export class GetEvidenceByControlDto {
  @ApiProperty({ description: 'Control ID' })
  @IsUUID()
  controlId: string;

  @ApiProperty({ description: 'Organization ID' })
  @IsUUID()
  organizationId: string;

  @ApiProperty({
    description: 'Include archived evidence',
    default: false,
    required: false,
  })
  @IsOptional()
  includeArchived?: boolean;

  @ApiProperty({
    description: 'Include expired evidence',
    default: false,
    required: false,
  })
  @IsOptional()
  includeExpired?: boolean;

  @ApiProperty({
    description: 'Evidence status filter',
    enum: ['approved', 'pending_review', 'draft'],
    required: false,
  })
  @IsOptional()
  status?: string;
}
