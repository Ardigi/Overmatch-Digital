import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { EmailProviderService } from './email/email.provider';
import { InAppProviderService } from './in-app/in-app.provider';
import { PushProviderService } from './push/push.provider';
import { SlackProviderService } from './slack/slack.provider';
import { SmsProviderService } from './sms/sms.provider';
import { TeamsProvider } from './teams/teams.provider';
import { WebhookProvider } from './webhook/webhook.provider';

@Module({
  imports: [ConfigModule, EventEmitterModule, HttpModule],
  providers: [
    EmailProviderService,
    SmsProviderService,
    SlackProviderService,
    InAppProviderService,
    PushProviderService,
    TeamsProvider,
    WebhookProvider,
  ],
  exports: [
    EmailProviderService,
    SmsProviderService,
    SlackProviderService,
    InAppProviderService,
    PushProviderService,
    TeamsProvider,
    WebhookProvider,
  ],
})
export class ProvidersModule {}
