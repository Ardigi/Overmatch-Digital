import { SetMetadata } from '@nestjs/common';
import {
  API_KEY_RATE_LIMIT_KEY,
  type ApiKeyRateLimitOptions,
} from '../guards/api-key-rate-limit.guard';

export const ApiKeyRateLimit = (options: ApiKeyRateLimitOptions) =>
  SetMetadata(API_KEY_RATE_LIMIT_KEY, options);
