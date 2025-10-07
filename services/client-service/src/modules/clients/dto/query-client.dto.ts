import { Transform } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { Sanitize } from '../../../shared/decorators/sanitize.decorator';
import {
  ClientStatus,
  ClientType,
  CompanySize,
  ComplianceFramework,
  ComplianceStatus,
  Industry,
  RiskLevel,
} from '../entities/client.entity';

export class QueryClientDto {
  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @IsOptional()
  @IsDateString()
  createdAfter?: string;

  @IsOptional()
  @IsDateString()
  createdBefore?: string;

  @IsOptional()
  @IsArray()
  @IsEnum(ComplianceFramework, { each: true })
  frameworks?: ComplianceFramework[];
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  @Min(1)
  @Max(1000)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Search query must be at least 2 characters' })
  @Sanitize()
  search?: string;

  @IsOptional()
  @IsEnum(ClientStatus)
  status?: ClientStatus;

  @IsOptional()
  @IsEnum(ClientType)
  clientType?: ClientType;

  @IsOptional()
  @IsEnum(CompanySize)
  size?: CompanySize;

  @IsOptional()
  @IsEnum(Industry)
  industry?: Industry;

  @IsOptional()
  @IsEnum(ComplianceStatus)
  complianceStatus?: ComplianceStatus;

  @IsOptional()
  @IsEnum(ComplianceFramework)
  framework?: ComplianceFramework;

  @IsOptional()
  @IsEnum(RiskLevel)
  riskLevel?: RiskLevel;

  @IsOptional()
  @IsUUID()
  partnerId?: string;

  @IsOptional()
  @IsUUID()
  salesRepId?: string;

  @IsOptional()
  @IsUUID()
  accountManagerId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true, message: 'Tags cannot contain empty strings' })
  tags?: string[];

  @IsOptional()
  @IsString()
  @IsIn(['createdAt', 'updatedAt', 'name', 'complianceScore'], { message: 'Invalid sort field' })
  sortBy?: string = 'createdAt';

  @IsOptional()
  @IsEnum(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC' = 'DESC';

  @IsOptional()
  @Transform(({ value }) => value === 'true')
  includeArchived?: boolean = false;

  @IsOptional()
  @Transform(({ value }) => value === 'true')
  needsAudit?: boolean;

  @IsOptional()
  @Transform(({ value }) => value === 'true')
  expiringSoon?: boolean;

  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  expiringInDays?: number = 90;
}
