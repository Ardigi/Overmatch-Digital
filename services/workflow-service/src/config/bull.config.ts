import type { BullModuleOptions } from '@nestjs/bull';
import { ConfigService } from '@nestjs/config';

export const bullConfig = (configService: ConfigService): BullModuleOptions => ({
  redis: {
    host: configService.get<string>('redis.host'),
    port: configService.get<number>('redis.port'),
    password: configService.get<string>('redis.password'),
  },
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: false,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  },
});
