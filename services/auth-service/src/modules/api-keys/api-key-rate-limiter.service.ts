import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { ApiKeyUsage } from './entities/api-key-usage.entity';

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: Date;
  retryAfter?: number;
}

@Injectable()
export class ApiKeyRateLimiterService {
  private rateLimitCache: Map<string, { count: number; resetAt: Date }> = new Map();

  constructor(
    @InjectRepository(ApiKeyUsage)
    private apiKeyUsageRepository: Repository<ApiKeyUsage>,
  ) {
    // Clean up cache every minute
    setInterval(() => this.cleanupCache(), 60000);
  }

  async checkRateLimit(
    apiKeyId: string,
    limit: number,
    windowSeconds: number,
  ): Promise<RateLimitResult> {
    const now = new Date();
    const windowStart = new Date(now.getTime() - windowSeconds * 1000);
    const resetAt = new Date(now.getTime() + windowSeconds * 1000);

    // Check memory cache first for performance
    const cacheKey = `${apiKeyId}:${windowSeconds}`;
    const cached = this.rateLimitCache.get(cacheKey);

    if (cached && cached.resetAt > now) {
      const remaining = Math.max(0, limit - cached.count);
      const allowed = remaining > 0;

      if (!allowed) {
        const retryAfter = Math.ceil((cached.resetAt.getTime() - now.getTime()) / 1000);
        return { allowed, limit, remaining, resetAt: cached.resetAt, retryAfter };
      }

      // Increment count
      cached.count++;
      return { allowed, limit, remaining: remaining - 1, resetAt: cached.resetAt };
    }

    // Query database for accurate count
    const count = await this.apiKeyUsageRepository.count({
      where: {
        apiKeyId,
        createdAt: MoreThan(windowStart),
      },
    });

    // Update cache
    this.rateLimitCache.set(cacheKey, {
      count: count + 1,
      resetAt,
    });

    const remaining = Math.max(0, limit - count);
    const allowed = remaining > 0;

    if (!allowed) {
      const retryAfter = windowSeconds;
      return { allowed, limit, remaining, resetAt, retryAfter };
    }

    return { allowed, limit, remaining: remaining - 1, resetAt };
  }

  async checkEndpointRateLimit(
    apiKeyId: string,
    endpoint: string,
    method: string,
    limit: number,
    windowSeconds: number,
  ): Promise<RateLimitResult> {
    const now = new Date();
    const windowStart = new Date(now.getTime() - windowSeconds * 1000);
    const resetAt = new Date(now.getTime() + windowSeconds * 1000);

    // Query database for endpoint-specific count
    const count = await this.apiKeyUsageRepository.count({
      where: {
        apiKeyId,
        endpoint,
        method,
        createdAt: MoreThan(windowStart),
      },
    });

    const remaining = Math.max(0, limit - count);
    const allowed = remaining > 0;

    if (!allowed) {
      const retryAfter = windowSeconds;
      return { allowed, limit, remaining, resetAt, retryAfter };
    }

    return { allowed, limit, remaining: remaining - 1, resetAt };
  }

  async getUsageMetrics(apiKeyId: string, windowSeconds: number): Promise<{
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageResponseTime: number;
    endpoints: { endpoint: string; count: number }[];
  }> {
    const windowStart = new Date(Date.now() - windowSeconds * 1000);

    const usage = await this.apiKeyUsageRepository.find({
      where: {
        apiKeyId,
        createdAt: MoreThan(windowStart),
      },
    });

    const totalRequests = usage.length;
    const successfulRequests = usage.filter(u => u.statusCode >= 200 && u.statusCode < 300).length;
    const failedRequests = usage.filter(u => u.statusCode >= 400).length;
    const averageResponseTime = usage.reduce((sum, u) => sum + Number(u.responseTime), 0) / totalRequests || 0;

    // Group by endpoint
    const endpointMap = new Map<string, number>();
    usage.forEach(u => {
      const count = endpointMap.get(u.endpoint) || 0;
      endpointMap.set(u.endpoint, count + 1);
    });

    const endpoints = Array.from(endpointMap.entries())
      .map(([endpoint, count]) => ({ endpoint, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10 endpoints

    return {
      totalRequests,
      successfulRequests,
      failedRequests,
      averageResponseTime,
      endpoints,
    };
  }

  private cleanupCache(): void {
    const now = new Date();
    for (const [key, value] of this.rateLimitCache.entries()) {
      if (value.resetAt < now) {
        this.rateLimitCache.delete(key);
      }
    }
  }
}