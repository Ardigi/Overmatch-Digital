import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { ControlStatus } from '../entities/control.entity';
import { CreateControlDto } from './create-control.dto';

export class UpdateControlDto extends PartialType(CreateControlDto) {
  @ApiProperty({ enum: ControlStatus, description: 'Control status', required: false })
  @IsEnum(ControlStatus)
  @IsOptional()
  status?: ControlStatus;
}
