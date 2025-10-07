import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { Repository } from 'typeorm';
import { EventsService } from '../events/events.service';
import type { CreateApiKeyDto } from './dto/create-api-key.dto';
import type { UpdateApiKeyDto } from './dto/update-api-key.dto';
import { ApiKey, ApiKeyScope, ApiKeyStatus } from './entities/api-key.entity';
import { ApiKeyUsage } from './entities/api-key-usage.entity';

@Injectable()
export class ApiKeysService {
  constructor(
    @InjectRepository(ApiKey)
    private apiKeyRepository: Repository<ApiKey>,
    @InjectRepository(ApiKeyUsage)
    private apiKeyUsageRepository: Repository<ApiKeyUsage>,
    private eventsService: EventsService,
  ) {}

  async create(createApiKeyDto: CreateApiKeyDto, userId: string, organizationId?: string): Promise<{ apiKey: ApiKey; plainKey: string }> {
    // Generate secure API key
    const plainKey = this.generateApiKey();
    const keyHash = await bcrypt.hash(plainKey, 10);
    
    // Create masked key for storage (show only first 8 and last 4 characters)
    const maskedKey = this.maskApiKey(plainKey);

    // Set expiration if provided
    let expiresAt: Date | null = null;
    if (createApiKeyDto.expiresIn) {
      expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + createApiKeyDto.expiresIn);
    }

    // Create API key entity
    const apiKey = this.apiKeyRepository.create({
      ...createApiKeyDto,
      key: maskedKey,
      keyHash,
      userId,
      organizationId,
      expiresAt,
      scopes: createApiKeyDto.scopes || [ApiKeyScope.READ],
      ipWhitelist: createApiKeyDto.ipWhitelist || [],
      permissions: createApiKeyDto.permissions || {},
      metadata: createApiKeyDto.metadata || {},
    });

    await this.apiKeyRepository.save(apiKey);

    // Emit event
    await this.eventsService.publishEvent('api-key.created', {
      apiKeyId: apiKey.id,
      userId,
      organizationId,
      name: apiKey.name,
      scopes: apiKey.scopes,
      expiresAt: apiKey.expiresAt,
    });

    return { apiKey, plainKey };
  }

  async findAll(userId?: string, organizationId?: string): Promise<ApiKey[]> {
    const query = this.apiKeyRepository.createQueryBuilder('apiKey')
      .leftJoinAndSelect('apiKey.user', 'user')
      .leftJoinAndSelect('apiKey.organization', 'organization');

    if (userId) {
      query.andWhere('apiKey.userId = :userId', { userId });
    }

    if (organizationId) {
      query.andWhere('apiKey.organizationId = :organizationId', { organizationId });
    }

    return query.getMany();
  }

  async findOne(id: string): Promise<ApiKey> {
    const apiKey = await this.apiKeyRepository.findOne({
      where: { id },
      relations: ['user', 'organization'],
    });

    if (!apiKey) {
      throw new NotFoundException('API key not found');
    }

    return apiKey;
  }

  async findByKey(plainKey: string): Promise<ApiKey | null> {
    // Extract the unmasked part to search
    const maskedKey = this.maskApiKey(plainKey);
    
    // Find all keys with matching masked pattern
    const candidates = await this.apiKeyRepository.find({
      where: { key: maskedKey },
      select: ['id', 'keyHash', 'status', 'expiresAt', 'ipWhitelist', 'scopes', 'permissions', 'userId', 'organizationId', 'rateLimit', 'rateLimitWindow'],
    });

    // Verify against hash
    for (const candidate of candidates) {
      const isValid = await bcrypt.compare(plainKey, candidate.keyHash);
      if (isValid) {
        return candidate;
      }
    }

    return null;
  }

  async validateApiKey(plainKey: string, ip?: string): Promise<ApiKey> {
    const apiKey = await this.findByKey(plainKey);

    if (!apiKey) {
      throw new UnauthorizedException('Invalid API key');
    }

    if (!apiKey.isValid()) {
      throw new UnauthorizedException('API key is not active or has expired');
    }

    if (ip && !apiKey.isIpAllowed(ip)) {
      throw new UnauthorizedException('IP address not allowed');
    }

    // Update last used
    await this.updateLastUsed(apiKey.id, ip);

    return apiKey;
  }

  async update(id: string, updateApiKeyDto: UpdateApiKeyDto, userId: string): Promise<ApiKey> {
    const apiKey = await this.findOne(id);

    // Check ownership
    if (apiKey.userId !== userId) {
      throw new UnauthorizedException('You do not have permission to update this API key');
    }

    // Update fields
    Object.assign(apiKey, updateApiKeyDto);

    await this.apiKeyRepository.save(apiKey);

    // Emit event
    await this.eventsService.publishEvent('api-key.updated', {
      apiKeyId: apiKey.id,
      userId,
      changes: updateApiKeyDto,
    });

    return apiKey;
  }

  async revoke(id: string, userId: string, reason?: string): Promise<ApiKey> {
    const apiKey = await this.findOne(id);

    // Check ownership
    if (apiKey.userId !== userId) {
      throw new UnauthorizedException('You do not have permission to revoke this API key');
    }

    apiKey.status = ApiKeyStatus.REVOKED;
    apiKey.revokedAt = new Date();
    apiKey.revokedBy = userId;
    apiKey.revokedReason = reason;

    await this.apiKeyRepository.save(apiKey);

    // Emit event
    await this.eventsService.publishEvent('api-key.revoked', {
      apiKeyId: apiKey.id,
      userId,
      reason,
    });

    return apiKey;
  }

  async rotate(id: string, userId: string): Promise<{ apiKey: ApiKey; plainKey: string }> {
    const oldApiKey = await this.findOne(id);

    // Check ownership
    if (oldApiKey.userId !== userId) {
      throw new UnauthorizedException('You do not have permission to rotate this API key');
    }

    // Revoke old key
    await this.revoke(id, userId, 'Rotated');

    // Create new key with same settings
    const newApiKey = await this.create({
      name: `${oldApiKey.name} (Rotated)`,
      description: oldApiKey.description,
      scopes: oldApiKey.scopes,
      permissions: oldApiKey.permissions,
      ipWhitelist: oldApiKey.ipWhitelist,
      metadata: { ...oldApiKey.metadata, rotatedFrom: oldApiKey.id },
      rateLimit: oldApiKey.rateLimit,
      rateLimitWindow: oldApiKey.rateLimitWindow,
    }, userId, oldApiKey.organizationId);

    // Emit event
    await this.eventsService.publishEvent('api-key.rotated', {
      oldApiKeyId: oldApiKey.id,
      newApiKeyId: newApiKey.apiKey.id,
      userId,
    });

    return newApiKey;
  }

  async trackUsage(apiKeyId: string, usage: Partial<ApiKeyUsage>): Promise<void> {
    const apiKeyUsage = this.apiKeyUsageRepository.create({
      apiKeyId,
      ...usage,
    });

    await this.apiKeyUsageRepository.save(apiKeyUsage);

    // Update usage count
    await this.apiKeyRepository.increment({ id: apiKeyId }, 'usageCount', 1);
  }

  async getUsageStats(apiKeyId: string, startDate?: Date, endDate?: Date): Promise<any> {
    const query = this.apiKeyUsageRepository.createQueryBuilder('usage')
      .where('usage.apiKeyId = :apiKeyId', { apiKeyId });

    if (startDate) {
      query.andWhere('usage.createdAt >= :startDate', { startDate });
    }

    if (endDate) {
      query.andWhere('usage.createdAt <= :endDate', { endDate });
    }

    const usage = await query.getMany();

    // Calculate statistics
    const stats = {
      totalRequests: usage.length,
      successfulRequests: usage.filter(u => u.statusCode >= 200 && u.statusCode < 300).length,
      failedRequests: usage.filter(u => u.statusCode >= 400).length,
      averageResponseTime: usage.reduce((sum, u) => sum + Number(u.responseTime), 0) / usage.length || 0,
      totalDataTransferred: usage.reduce((sum, u) => sum + (Number(u.responseSize) || 0), 0),
      endpointUsage: this.groupBy(usage, 'endpoint'),
      statusCodeDistribution: this.groupBy(usage, 'statusCode'),
      hourlyDistribution: this.getHourlyDistribution(usage),
    };

    return stats;
  }

  private generateApiKey(): string {
    // Generate a secure random API key
    // Format: om_[env]_[random]
    const env = process.env.NODE_ENV === 'production' ? 'live' : 'test';
    const randomBytes = crypto.randomBytes(32).toString('base64url');
    return `om_${env}_${randomBytes}`;
  }

  private maskApiKey(key: string): string {
    // Show first 8 and last 4 characters
    if (key.length <= 12) {
      return key;
    }
    const first = key.substring(0, 8);
    const last = key.substring(key.length - 4);
    const masked = '*'.repeat(key.length - 12);
    return `${first}${masked}${last}`;
  }

  private async updateLastUsed(apiKeyId: string, ip?: string): Promise<void> {
    await this.apiKeyRepository.update(apiKeyId, {
      lastUsedAt: new Date(),
      lastUsedIp: ip,
    });
  }

  private groupBy(array: any[], key: string): Record<string, number> {
    return array.reduce((result, item) => {
      const group = item[key];
      result[group] = (result[group] || 0) + 1;
      return result;
    }, {});
  }

  private getHourlyDistribution(usage: ApiKeyUsage[]): Record<number, number> {
    const distribution: Record<number, number> = {};
    for (let i = 0; i < 24; i++) {
      distribution[i] = 0;
    }

    usage.forEach(u => {
      const hour = new Date(u.createdAt).getHours();
      distribution[hour]++;
    });

    return distribution;
  }

  async checkRateLimit(apiKeyId: string): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
    const apiKey = await this.apiKeyRepository.findOne({ where: { id: apiKeyId } });
    
    if (!apiKey.rateLimit || !apiKey.rateLimitWindow) {
      return { allowed: true, remaining: -1, resetAt: new Date() };
    }

    const windowStart = new Date();
    windowStart.setSeconds(windowStart.getSeconds() - apiKey.rateLimitWindow);

    const usageCount = await this.apiKeyUsageRepository.count({
      where: {
        apiKeyId,
        createdAt: windowStart,
      },
    });

    const allowed = usageCount < apiKey.rateLimit;
    const remaining = Math.max(0, apiKey.rateLimit - usageCount);
    const resetAt = new Date();
    resetAt.setSeconds(resetAt.getSeconds() + apiKey.rateLimitWindow);

    return { allowed, remaining, resetAt };
  }
}