import { OmitType, PartialType } from '@nestjs/mapped-types';
import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { BillingFrequency, ContractStatus } from '../entities/contract.entity';
import { CreateContractDto } from './create-contract.dto';

export class UpdateContractDto extends PartialType(
  OmitType(CreateContractDto, ['clientId', 'type'] as const)
) {
  @IsOptional()
  @IsEnum(ContractStatus)
  status?: ContractStatus;

  @IsOptional()
  @IsDateString()
  signedDate?: string;

  @IsOptional()
  @IsString()
  signedBy?: string;

  @IsOptional()
  @IsString()
  clientSignatory?: string;

  @IsOptional()
  @IsString()
  clientSignatoryTitle?: string;

  @IsOptional()
  @IsString()
  clientSignatoryEmail?: string;

  @IsOptional()
  @IsString()
  mspSignatory?: string;

  @IsOptional()
  @IsString()
  mspSignatoryTitle?: string;

  @IsOptional()
  @IsString()
  signedDocumentUrl?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  totalValue?: number;

  @IsOptional()
  @IsEnum(BillingFrequency)
  billingFrequency?: BillingFrequency;
}
