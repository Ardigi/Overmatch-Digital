import { OmitType, PartialType } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { MappingStatus } from '../entities/framework-mapping.entity';
import { CreateMappingDto } from './create-mapping.dto';

export class UpdateMappingDto extends PartialType(
  OmitType(CreateMappingDto, [
    'organizationId',
    'sourceFramework',
    'targetFramework',
    'createdBy',
  ] as const)
) {
  @IsEnum(MappingStatus)
  @IsOptional()
  status?: MappingStatus;

  @IsUUID()
  @IsOptional()
  approvedBy?: string;

  @IsString()
  @IsOptional()
  approvalNotes?: string;
}
