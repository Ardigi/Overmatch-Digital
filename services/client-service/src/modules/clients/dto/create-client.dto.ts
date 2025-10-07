import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Sanitize, Trim } from '../../../shared/decorators/sanitize.decorator';
import {
  ClientStatus,
  ClientType,
  CompanySize,
  ComplianceFramework,
  Industry,
  RiskLevel,
} from '../entities/client.entity';

class ContactDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Sanitize()
  name?: string;

  @IsOptional()
  @IsString()
  @Sanitize()
  title?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(7, { message: 'Phone number is too short' })
  @MaxLength(25, { message: 'Phone number is too long' })
  @Matches(/^\+?[1-9][0-9\s]{6,23}$/, {
    message: 'Phone number must be a valid international format',
  })
  phone?: string;
}

class AddressDto {
  @IsOptional()
  @IsString()
  @MaxLength(255, { message: 'Street address is too long' })
  @Sanitize()
  street1?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Sanitize()
  street2?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'City cannot be empty' })
  @MaxLength(100)
  @Sanitize()
  city?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{2}$/, { message: 'State must be a 2-letter code' })
  state?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Z0-9\s-]{3,10}$/, { message: 'Invalid postal code format' })
  postalCode?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{2}$/, { message: 'Country must be a 2-letter ISO code' })
  country?: string;
}

class LocationDto {
  @IsOptional()
  @IsString()
  @Sanitize()
  name?: string;

  @IsOptional()
  @IsString()
  @Sanitize()
  type?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  address?: AddressDto;
}

class ContactInfoDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => ContactDto)
  primaryContact?: ContactDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ContactDto)
  secondaryContact?: ContactDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ContactDto)
  technicalContact?: ContactDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ContactDto)
  billingContact?: ContactDto;
}

class AddressesDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  headquarters?: AddressDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  billing?: AddressDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LocationDto)
  @ArrayMaxSize(50)
  locations?: LocationDto[];
}

class BillingInfoDto {
  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  paymentTerms?: string;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  taxId?: string;

  @IsOptional()
  @IsBoolean()
  purchaseOrderRequired?: boolean;

  @IsOptional()
  @IsString()
  invoicePrefix?: string;

  @IsOptional()
  @IsNumber()
  creditLimit?: number;
}

class SecuritySettingsDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  ipWhitelist?: string[];

  @IsOptional()
  @IsBoolean()
  mfaRequired?: boolean;

  @IsOptional()
  @IsNumber()
  sessionTimeout?: number;

  @IsOptional()
  @IsObject()
  passwordPolicy?: {
    minLength?: number;
    requireUppercase?: boolean;
    requireLowercase?: boolean;
    requireNumbers?: boolean;
    requireSpecialChars?: boolean;
    expirationDays?: number;
  };
}

export class CreateClientDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(255)
  @Trim()
  @Sanitize()
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Sanitize()
  legalName?: string;

  @IsOptional()
  @IsString()
  @Sanitize()
  slug?: string;

  @IsOptional()
  @IsEnum(ClientType)
  clientType?: ClientType;

  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @IsOptional()
  @IsUUID()
  parentClientId?: string;

  @IsOptional()
  @IsUrl(
    { protocols: ['http', 'https'], require_protocol: true },
    { message: 'Logo must be a valid HTTP/HTTPS URL' }
  )
  logo?: string;

  @IsOptional()
  @IsUrl(
    { protocols: ['http', 'https'], require_protocol: true },
    { message: 'Website must be a valid HTTP/HTTPS URL' }
  )
  website?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  @Sanitize()
  description?: string;

  @IsOptional()
  @IsEnum(Industry)
  industry?: Industry;

  @IsOptional()
  @IsEnum(CompanySize)
  size?: CompanySize;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10000000)
  employeeCount?: number;

  @IsOptional()
  @IsString()
  annualRevenue?: string;

  @IsOptional()
  @IsEnum(ClientStatus)
  status?: ClientStatus;

  @IsOptional()
  @IsArray()
  @IsEnum(ComplianceFramework, { each: true })
  targetFrameworks?: ComplianceFramework[];

  @IsOptional()
  @IsEnum(RiskLevel)
  riskLevel?: RiskLevel;

  @IsOptional()
  @ValidateNested({ each: false })
  @Type(() => ContactInfoDto)
  contactInfo?: ContactInfoDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => AddressesDto)
  address?: AddressesDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => BillingInfoDto)
  billingInfo?: BillingInfoDto;

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
  @IsUUID()
  technicalLeadId?: string;

  @IsOptional()
  @IsObject()
  settings?: {
    timezone?: string;
    dateFormat?: string;
    currency?: string;
    language?: string;
    notifications?: {
      email?: boolean;
      sms?: boolean;
      slack?: boolean;
    };
    security?: SecuritySettingsDto;
    features?: {
      apiAccess?: boolean;
      customBranding?: boolean;
      advancedReporting?: boolean;
      automatedEvidence?: boolean;
      continuousMonitoring?: boolean;
    };
  };

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true, message: 'Tags cannot contain empty strings' })
  @ArrayMaxSize(100)
  tags?: string[];
}
