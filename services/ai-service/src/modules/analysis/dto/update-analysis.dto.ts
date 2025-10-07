import { OmitType, PartialType } from '@nestjs/swagger';
import { IsArray, IsEnum, IsOptional, IsString } from 'class-validator';
import { AnalysisStatus } from '../entities/compliance-analysis.entity';
import { CreateAnalysisDto } from './create-analysis.dto';

export class UpdateAnalysisDto extends PartialType(
  OmitType(CreateAnalysisDto, ['clientId', 'organizationId', 'type', 'createdBy'] as const)
) {
  @IsEnum(AnalysisStatus)
  @IsOptional()
  status?: AnalysisStatus;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];
}
