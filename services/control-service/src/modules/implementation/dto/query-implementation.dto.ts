import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsUUID, IsEnum, IsString } from 'class-validator';
import { ImplementationStatus } from '../entities/control-implementation.entity';

export class QueryImplementationDto {
  @ApiProperty({ description: 'Organization ID', required: true })
  @IsUUID()
  organizationId: string;

  @ApiProperty({ enum: ImplementationStatus, description: 'Implementation status', required: false })
  @IsEnum(ImplementationStatus)
  @IsOptional()
  status?: ImplementationStatus;

  @ApiProperty({ description: 'Maturity level', required: false })
  @IsString()
  @IsOptional()
  maturityLevel?: string;

  @ApiProperty({ description: 'Control ID', required: false })
  @IsUUID()
  @IsOptional()
  controlId?: string;

  @ApiProperty({ description: 'Framework', required: false })
  @IsString()
  @IsOptional()
  framework?: string;

  @ApiProperty({ description: 'Search term', required: false })
  @IsString()
  @IsOptional()
  search?: string;
}