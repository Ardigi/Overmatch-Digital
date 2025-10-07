import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { IntegrationStatus } from '../entities/integration.entity';
import { CreateIntegrationDto } from './create-integration.dto';

export class UpdateIntegrationDto extends PartialType(
  OmitType(CreateIntegrationDto, ['organizationId', 'integrationType', 'authType'] as const)
) {
  @ApiPropertyOptional({ enum: IntegrationStatus })
  @IsEnum(IntegrationStatus)
  @IsOptional()
  status?: IntegrationStatus;
}
