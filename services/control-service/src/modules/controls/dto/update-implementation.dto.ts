import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { ImplementationStatus } from '../../implementation/entities/control-implementation.entity';

export class UpdateImplementationDto {
  @ApiProperty({
    enum: ImplementationStatus,
    description: 'Implementation status',
  })
  @IsEnum(ImplementationStatus)
  @IsNotEmpty()
  status: ImplementationStatus;

  @ApiProperty({
    description: 'Implementation description',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Effectiveness metrics',
    required: false,
  })
  @IsObject()
  @IsOptional()
  effectiveness?: {
    score: number;
    assessmentMethod: string;
    strengths: string[];
    weaknesses: string[];
    improvements: string[];
  };

  @ApiProperty({
    description: 'Implementation gaps',
    required: false,
  })
  @IsArray()
  @IsOptional()
  gaps?: Array<{
    description: string;
    impact: 'HIGH' | 'MEDIUM' | 'LOW';
    remediationPlan: string;
    targetDate: Date;
    status: 'OPEN' | 'IN_PROGRESS' | 'CLOSED';
    assignedTo: string;
  }>;

  @ApiProperty({
    description: 'Responsible party for implementation',
    required: false,
  })
  @IsUUID()
  @IsOptional()
  responsibleParty?: string;
}

export class BulkUpdateImplementationDto {
  @ApiProperty({ description: 'Control ID' })
  @IsUUID()
  @IsNotEmpty()
  controlId: string;

  @ApiProperty({
    enum: ImplementationStatus,
    description: 'Implementation status',
  })
  @IsEnum(ImplementationStatus)
  @IsNotEmpty()
  status: ImplementationStatus;

  @ApiProperty({
    description: 'Implementation description',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;
}

export class BulkUpdateImplementationsDto {
  @ApiProperty({
    type: [BulkUpdateImplementationDto],
    description: 'Array of implementation updates',
  })
  @IsArray()
  updates: BulkUpdateImplementationDto[];
}
