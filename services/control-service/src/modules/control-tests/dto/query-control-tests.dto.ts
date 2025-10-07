import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsUUID, IsEnum, IsString } from 'class-validator';
import { TestStatus } from '../entities/control-test.entity';

export class QueryControlTestsDto {
  @ApiProperty({ description: 'Organization ID' })
  @IsUUID()
  organizationId: string;

  @ApiProperty({ description: 'Control ID', required: false })
  @IsUUID()
  @IsOptional()
  controlId?: string;

  @ApiProperty({ description: 'Audit ID', required: false })
  @IsUUID()
  @IsOptional()
  auditId?: string;

  @ApiProperty({ enum: TestStatus, description: 'Test status', required: false })
  @IsEnum(TestStatus)
  @IsOptional()
  status?: TestStatus;

  @ApiProperty({ description: 'Search term', required: false })
  @IsString()
  @IsOptional()
  search?: string;
}