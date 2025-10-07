import { OmitType, PartialType } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PredictionStatus } from '../entities/prediction.entity';
import { CreatePredictionDto } from './create-prediction.dto';

export class UpdatePredictionDto extends PartialType(
  OmitType(CreatePredictionDto, ['clientId', 'organizationId', 'type', 'createdBy'] as const)
) {
  @IsEnum(PredictionStatus)
  @IsOptional()
  status?: PredictionStatus;

  @IsString()
  @IsOptional()
  notes?: string;
}
