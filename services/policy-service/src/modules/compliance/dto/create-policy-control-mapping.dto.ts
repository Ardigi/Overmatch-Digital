import { IsArray, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePolicyControlMappingDto {
  @ApiProperty({ description: 'Policy ID to map' })
  @IsUUID()
  policyId: string;

  @ApiProperty({ 
    description: 'Control IDs to map to the policy',
    type: [String]
  })
  @IsArray()
  @IsUUID('4', { each: true })
  controlIds: string[];

  @ApiPropertyOptional({ description: 'Optional notes about the mapping' })
  @IsString()
  @IsOptional()
  notes?: string;
}