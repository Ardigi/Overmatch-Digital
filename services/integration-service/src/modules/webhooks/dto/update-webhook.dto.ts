import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateWebhookDto } from './create-webhook.dto';

export class UpdateWebhookDto extends PartialType(
  OmitType(CreateWebhookDto, ['organizationId'] as const)
) {}
