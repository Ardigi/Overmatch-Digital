import { Type } from 'class-transformer';
import { IsBoolean, IsNumber, IsOptional, IsString, IsUUID, Min, Max } from 'class-validator';

export class QueryMappingDto {
  @IsOptional()
  @IsUUID()
  sourceFrameworkId?: string;

  @IsOptional()
  @IsUUID()
  targetFrameworkId?: string;

  @IsOptional()
  @IsUUID()
  policyId?: string;

  @IsOptional()
  @IsUUID()
  controlId?: string;

  @IsOptional()
  @IsUUID()
  frameworkId?: string;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isApproved?: boolean;

  @IsOptional()
  @IsString()
  mappingType?: 'equivalent' | 'partial' | 'related';

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  @Type(() => Number)
  minConfidence?: number;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  includeStats?: boolean;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  limit?: number;

  @IsOptional()
  @IsString()
  search?: string;
}
