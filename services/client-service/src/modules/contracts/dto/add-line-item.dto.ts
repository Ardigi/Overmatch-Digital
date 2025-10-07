import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { LineItemBillingCycle, LineItemType } from '../entities/contract-line-item.entity';

export class AddLineItemDto {
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

  @IsOptional()
  @IsNumber()
  @Min(0)
  sortOrder?: number;
}
