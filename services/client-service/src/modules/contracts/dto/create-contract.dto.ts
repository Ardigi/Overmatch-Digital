import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { BillingFrequency, ContractType, PaymentTerms } from '../entities/contract.entity';
import { LineItemBillingCycle, LineItemType } from '../entities/contract-line-item.entity';

class CreateLineItemDto {
  @IsString()
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsEnum(LineItemType)
  type?: LineItemType;

  @IsOptional()
  @IsString()
  sku?: string;

  @IsNumber()
  @Min(0)
  quantity: number;

  @IsOptional()
  @IsString()
  unitOfMeasure?: string;

  @IsNumber()
  @Min(0)
  unitPrice: number;

  @IsOptional()
  @IsEnum(LineItemBillingCycle)
  billingCycle?: LineItemBillingCycle;

  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;

  @IsOptional()
  @IsBoolean()
  isTaxable?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  taxRate?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discountPercentage?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discountAmount?: number;
}

export class CreateContractDto {
  @IsUUID()
  clientId: string;

  @IsOptional()
  @IsUUID()
  parentContractId?: string;

  @IsString()
  @MaxLength(255)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsEnum(ContractType)
  type: ContractType;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsNumber()
  @Min(0)
  totalValue: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsEnum(BillingFrequency)
  billingFrequency?: BillingFrequency;

  @IsOptional()
  @IsEnum(PaymentTerms)
  paymentTerms?: PaymentTerms;

  @IsOptional()
  @IsString()
  customPaymentTerms?: string;

  @IsOptional()
  @IsBoolean()
  autoRenew?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  renewalNoticePeriod?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  terminationNoticePeriod?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateLineItemDto)
  lineItems?: CreateLineItemDto[];

  @IsOptional()
  services?: {
    soc1?: boolean;
    soc2?: boolean;
    iso27001?: boolean;
    hipaa?: boolean;
    penetrationTesting?: boolean;
    vulnerabilityScanning?: boolean;
    continuousMonitoring?: boolean;
    incidentResponse?: boolean;
    consulting?: boolean;
    training?: boolean;
    other?: string[];
  };

  @IsOptional()
  @IsArray()
  deliverables?: Array<{
    name?: string;
    description?: string;
    dueDate?: Date;
  }>;

  @IsOptional()
  pricing?: {
    basePrice?: number;
    setupFee?: number;
    discount?: {
      type?: 'percentage' | 'fixed';
      value?: number;
      reason?: string;
    };
  };

  @IsOptional()
  sla?: {
    responseTime?: string;
    resolutionTime?: string;
    uptime?: number;
    supportHours?: string;
    escalationProcess?: string;
  };

  @IsOptional()
  terms?: {
    confidentiality?: boolean;
    liability?: string;
    indemnification?: string;
    governingLaw?: string;
    disputeResolution?: string;
    customTerms?: string[];
  };

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachmentUrls?: string[];

  @IsOptional()
  @IsString()
  documentUrl?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
