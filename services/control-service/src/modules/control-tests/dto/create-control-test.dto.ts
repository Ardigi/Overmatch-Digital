import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { TestMethod } from '../entities/control-test.entity';

export class CreateControlTestDto {
  @ApiProperty({ description: 'Control ID' })
  @IsUUID()
  controlId: string;

  @ApiProperty({ description: 'Organization ID' })
  @IsUUID()
  organizationId: string;

  @ApiProperty({ description: 'Audit ID', required: false })
  @IsUUID()
  @IsOptional()
  auditId?: string;

  @ApiProperty({ enum: TestMethod, description: 'Test method' })
  @IsEnum(TestMethod)
  method: TestMethod;

  @ApiProperty({ description: 'Scheduled test date' })
  @IsDate()
  @Type(() => Date)
  scheduledDate: Date;

  @ApiProperty({ description: 'Sample configuration', required: false })
  @IsOptional()
  sample?: {
    populationSize: number;
    sampleSize: number;
    selectionMethod: string;
    selectedItems: any[];
  };
}
