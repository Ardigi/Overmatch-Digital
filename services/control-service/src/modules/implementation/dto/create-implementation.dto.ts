import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsObject, IsOptional, IsUUID } from 'class-validator';
import { ImplementationMaturity } from '../entities/control-implementation.entity';

export class CreateImplementationDto {
  @ApiProperty({ description: 'Control ID' })
  @IsUUID()
  controlId: string;

  @ApiProperty({ description: 'Organization ID' })
  @IsUUID()
  organizationId: string;

  @ApiProperty({ description: 'Implementation description' })
  @IsNotEmpty()
  implementationDescription: string;

  @ApiProperty({ enum: ImplementationMaturity, description: 'Maturity level', required: false })
  @IsEnum(ImplementationMaturity)
  @IsOptional()
  maturityLevel?: ImplementationMaturity;

  @ApiProperty({ description: 'Implementation configuration' })
  @IsObject()
  configuration: {
    systems: string[];
    processes: string[];
    technologies: string[];
    responsibleParties: Array<{
      userId: string;
      role: string;
      responsibilities: string[];
    }>;
  };

  @ApiProperty({ description: 'Implementation documentation', required: false })
  @IsOptional()
  documentation?: Array<{
    type: string;
    name: string;
    url: string;
    version: string;
  }>;

  @ApiProperty({ description: 'Implemented by user ID' })
  @IsUUID()
  implementedBy: string;

  @ApiProperty({ description: 'Cost benefit analysis', required: false })
  @IsOptional()
  @IsObject()
  costBenefit?: {
    implementationCost: number;
    annualOperatingCost: number;
    riskReduction: number;
    roi: number;
    paybackPeriod: number;
  };
}
