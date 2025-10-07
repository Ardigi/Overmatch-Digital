import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class AssignControlsDto {
  @ApiProperty({ description: 'Organization ID to assign controls to' })
  @IsUUID()
  @IsNotEmpty()
  organizationId: string;

  @ApiProperty({ description: 'Array of control IDs to assign' })
  @IsArray()
  @IsUUID('4', { each: true })
  controlIds: string[];
}

export class AssignFrameworkDto {
  @ApiProperty({ description: 'Organization ID to assign framework to' })
  @IsUUID()
  @IsNotEmpty()
  organizationId: string;

  @ApiProperty({ description: 'Framework name (e.g., SOC2, ISO27001, HIPAA)' })
  @IsString()
  @IsNotEmpty()
  framework: string;

  @ApiProperty({
    description: 'Skip controls that are already implemented',
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  skipImplemented?: boolean;

  @ApiProperty({
    description: 'Only assign required controls',
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  onlyRequired?: boolean;
}
