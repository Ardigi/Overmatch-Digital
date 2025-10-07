import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsString, IsUUID } from 'class-validator';
import { ControlStatus, ControlCategory, ControlType } from '../entities/control.entity';

export class QueryControlsDto {
  @ApiProperty({ description: 'Control status filter', enum: ControlStatus, required: false })
  @IsEnum(ControlStatus)
  @IsOptional()
  status?: ControlStatus;

  @ApiProperty({ description: 'Control type filter', enum: ControlType, required: false })
  @IsEnum(ControlType)
  @IsOptional()
  type?: ControlType;

  @ApiProperty({ description: 'Control category filter', enum: ControlCategory, required: false })
  @IsEnum(ControlCategory)
  @IsOptional()
  category?: ControlCategory;

  @ApiProperty({ description: 'Framework filter (e.g., SOC2, ISO27001)', required: false })
  @IsString()
  @IsOptional()
  framework?: string;

  @ApiProperty({ description: 'Owner ID filter', required: false })
  @IsUUID()
  @IsOptional()
  ownerId?: string;

  @ApiProperty({ description: 'Search term for control name or description', required: false })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiProperty({ description: 'Page number for pagination', required: false })
  @IsOptional()
  page?: number;

  @ApiProperty({ description: 'Items per page', required: false })
  @IsOptional()
  limit?: number;

  @ApiProperty({ description: 'Sort field', required: false })
  @IsString()
  @IsOptional()
  sortBy?: string;

  @ApiProperty({ description: 'Sort order', enum: ['asc', 'desc'], required: false })
  @IsEnum(['asc', 'desc'])
  @IsOptional()
  sortOrder?: 'asc' | 'desc';
}
