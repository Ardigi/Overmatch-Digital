import { SetMetadata } from '@nestjs/common';
import { RATE_LIMIT_KEY, type RateLimitOptions } from '../guards/rate-limit.guard';

export const RateLimit = (options: RateLimitOptions) => SetMetadata(RATE_LIMIT_KEY, options);
