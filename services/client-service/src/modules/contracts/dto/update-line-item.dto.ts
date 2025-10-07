import { PartialType } from '@nestjs/mapped-types';
import { AddLineItemDto } from './add-line-item.dto';

export class UpdateLineItemDto extends PartialType(AddLineItemDto) {}
