import { Type } from 'class-transformer';
import { IsArray, IsNumber, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';

export class PolicySectionDto {
  @IsString()
  title: string;

  @IsString()
  content: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PolicySubsectionDto)
  subsections?: PolicySubsectionDto[];
}

export class PolicySubsectionDto {
  @IsString()
  title: string;

  @IsString()
  content: string;
}

export class PolicyProcedureStepDto {
  @IsNumber()
  order: number;

  @IsString()
  description: string;

  @IsOptional()
  @IsString()
  responsible?: string;
}

export class PolicyProcedureDto {
  @IsString()
  name: string;

  @IsString()
  description: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PolicyProcedureStepDto)
  steps: PolicyProcedureStepDto[];
}

export class PolicyReferenceDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  url?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  type: 'internal' | 'external' | 'regulation' | 'standard';
}

export class PolicyResponsibilityDto {
  @IsString()
  role: string;

  @IsArray()
  @IsString({ each: true })
  responsibilities: string[];
}

export class PolicyContentDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PolicySectionDto)
  sections: PolicySectionDto[];

  @IsOptional()
  @IsString()
  executiveSummary?: string;

  @IsOptional()
  @IsObject()
  definitions?: Record<string, string>;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PolicyResponsibilityDto)
  responsibilities?: PolicyResponsibilityDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PolicyProcedureDto)
  procedures?: PolicyProcedureDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PolicyReferenceDto)
  references?: PolicyReferenceDto[];
}
