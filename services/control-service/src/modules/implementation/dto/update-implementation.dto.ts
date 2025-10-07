import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsArray, IsUUID } from 'class-validator';
import { ImplementationStatus } from '../entities/control-implementation.entity';
import { CreateImplementationDto } from './create-implementation.dto';

export class UpdateImplementationDto extends PartialType(CreateImplementationDto) {
  @ApiProperty({
    enum: ImplementationStatus,
    description: 'Implementation status',
    required: false,
  })
  @IsEnum(ImplementationStatus)
  @IsOptional()
  status?: ImplementationStatus;

  @ApiProperty({
    type: [String],
    description: 'Evidence IDs to validate',
    required: false,
  })
  @IsArray()
  @IsUUID(4, { each: true })
  @IsOptional()
  evidence?: string[];
}
