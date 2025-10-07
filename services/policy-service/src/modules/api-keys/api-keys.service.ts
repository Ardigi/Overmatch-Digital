import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { AuditAction, AuditResourceType } from '../audit/entities/audit-log.entity';
import { ApiKey, ApiKeyStatus } from './entities/api-key.entity';

export interface CreateApiKeyDto {
  name: string;
  description?: string;
  scopes: string[];
  allowedIps?: string[];
  expiresAt?: Date;
  rateLimit?: number;
  rateLimitWindow?: number;
}

export interface UpdateApiKeyDto {
  name?: string;
  description?: string;
  scopes?: string[];
  allowedIps?: string[];
  rateLimit?: number;
  rateLimitWindow?: number;
}

@Injectable()
export class ApiKeysService {
  constructor(
    @InjectRepository(ApiKey)
    private readonly apiKeyRepository: Repository<ApiKey>,
    private readonly eventEmitter: EventEmitter2,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Create a new API key
   */
  async create(
    createApiKeyDto: CreateApiKeyDto,
    userId: string,
    organizationId: string,
  ): Promise<{ apiKey: ApiKey; plainTextKey: string }> {
    // Generate the key
    const { key, prefix, hash } = ApiKey.generateKey();

    // Create the entity
    const apiKey = this.apiKeyRepository.create({
      ...createApiKeyDto,
      keyPrefix: prefix,
      keyHash: hash,
      organizationId,
      createdBy: userId,
      status: ApiKeyStatus.ACTIVE,
    });

    // Save to database
    const saved = await this.apiKeyRepository.save(apiKey);

    // Emit event
    this.eventEmitter.emit('api-key.created', {
      apiKeyId: saved.id,
      organizationId,
      userId,
    });

    // Log audit
    await this.auditService.create({
      userId,
      organizationId,
      action: AuditAction.API_KEY_CREATED,
      resourceType: AuditResourceType.API_KEY,
      resourceId: saved.id,
      resourceName: saved.name,
      description: `Created API key "${saved.name}"`,
      metadata: {
        scopes: saved.scopes,
        expiresAt: saved.expiresAt,
      },
      success: true,
    });

    // Return the key (only time it's shown in plain text)
    return {
      apiKey: saved,
      plainTextKey: key,
    };
  }

  /**
   * Find all API keys for an organization
   */
  async findAll(
    organizationId: string,
    includeRevoked = false,
  ): Promise<ApiKey[]> {
    const query = this.apiKeyRepository
      .createQueryBuilder('apiKey')
      .where('apiKey.organizationId = :organizationId', { organizationId });

    if (!includeRevoked) {
      query.andWhere('apiKey.status != :status', { status: ApiKeyStatus.REVOKED });
    }

    return query
      .orderBy('apiKey.createdAt', 'DESC')
      .getMany();
  }

  /**
   * Find API key by ID
   */
  async findOne(id: string, organizationId: string): Promise<ApiKey> {
    const apiKey = await this.apiKeyRepository.findOne({
      where: { id, organizationId },
    });

    if (!apiKey) {
      throw new NotFoundException('API key not found');
    }

    return apiKey;
  }

  /**
   * Find API key by key prefix (for display purposes)
   */
  async findByPrefix(prefix: string, organizationId: string): Promise<ApiKey> {
    return this.apiKeyRepository.findOne({
      where: { keyPrefix: prefix, organizationId },
    });
  }

  /**
   * Verify and retrieve API key
   */
  async verifyKey(plainTextKey: string): Promise<ApiKey | null> {
    // Extract prefix from key
    const prefix = plainTextKey.substring(0, 8);

    // Find all keys with this prefix (should be unique, but be safe)
    const candidates = await this.apiKeyRepository.find({
      where: { keyPrefix: prefix },
    });

    // Verify against each candidate
    for (const candidate of candidates) {
      if (ApiKey.verifyKey(plainTextKey, candidate.keyHash)) {
        // Check if key is valid
        if (!candidate.isValid()) {
          return null;
        }

        return candidate;
      }
    }

    return null;
  }

  /**
   * Update API key
   */
  async update(
    id: string,
    updateApiKeyDto: UpdateApiKeyDto,
    userId: string,
    organizationId: string,
  ): Promise<ApiKey> {
    const apiKey = await this.findOne(id, organizationId);

    if (apiKey.status !== ApiKeyStatus.ACTIVE) {
      throw new BadRequestException('Cannot update inactive API key');
    }

    // Update fields
    Object.assign(apiKey, updateApiKeyDto);

    const updated = await this.apiKeyRepository.save(apiKey);

    // Emit event
    this.eventEmitter.emit('api-key.updated', {
      apiKeyId: updated.id,
      organizationId,
      userId,
      changes: updateApiKeyDto,
    });

    return updated;
  }

  /**
   * Rotate API key (creates new key, revokes old one)
   */
  async rotate(
    id: string,
    userId: string,
    organizationId: string,
  ): Promise<{ apiKey: ApiKey; plainTextKey: string }> {
    const oldKey = await this.findOne(id, organizationId);

    if (oldKey.status !== ApiKeyStatus.ACTIVE) {
      throw new BadRequestException('Cannot rotate inactive API key');
    }

    // Create new key with same settings
    const newKeyData = await this.create(
      {
        name: `${oldKey.name} (Rotated)`,
        description: oldKey.description,
        scopes: oldKey.scopes,
        allowedIps: oldKey.allowedIps,
        expiresAt: oldKey.expiresAt,
        rateLimit: oldKey.rateLimit,
        rateLimitWindow: oldKey.rateLimitWindow,
      },
      userId,
      organizationId,
    );

    // Revoke old key
    await this.revoke(id, userId, organizationId, 'Key rotation');

    // Emit event
    this.eventEmitter.emit('api-key.rotated', {
      oldKeyId: id,
      newKeyId: newKeyData.apiKey.id,
      organizationId,
      userId,
    });

    // Log audit
    await this.auditService.create({
      userId,
      organizationId,
      action: AuditAction.API_KEY_ROTATED,
      resourceType: AuditResourceType.API_KEY,
      resourceId: newKeyData.apiKey.id,
      resourceName: newKeyData.apiKey.name,
      description: `Rotated API key "${oldKey.name}"`,
      metadata: {
        oldKeyId: id,
        newKeyId: newKeyData.apiKey.id,
      },
      success: true,
    });

    return newKeyData;
  }

  /**
   * Revoke API key
   */
  async revoke(
    id: string,
    userId: string,
    organizationId: string,
    reason: string,
  ): Promise<ApiKey> {
    const apiKey = await this.findOne(id, organizationId);

    if (apiKey.status === ApiKeyStatus.REVOKED) {
      throw new BadRequestException('API key is already revoked');
    }

    // Revoke the key
    apiKey.revoke(userId, reason);

    const revoked = await this.apiKeyRepository.save(apiKey);

    // Emit event
    this.eventEmitter.emit('api-key.revoked', {
      apiKeyId: revoked.id,
      organizationId,
      userId,
      reason,
    });

    // Log audit
    await this.auditService.create({
      userId,
      organizationId,
      action: AuditAction.API_KEY_REVOKED,
      resourceType: AuditResourceType.API_KEY,
      resourceId: revoked.id,
      resourceName: revoked.name,
      description: `Revoked API key "${revoked.name}"`,
      metadata: {
        reason,
      },
      success: true,
    });

    return revoked;
  }

  /**
   * Record API key usage
   */
  async recordUsage(apiKey: ApiKey, ip: string): Promise<void> {
    apiKey.recordUsage(ip);
    await this.apiKeyRepository.save(apiKey);
  }

  /**
   * Clean up expired keys
   */
  async cleanupExpiredKeys(): Promise<number> {
    const result = await this.apiKeyRepository
      .createQueryBuilder()
      .update(ApiKey)
      .set({ status: ApiKeyStatus.EXPIRED })
      .where('status = :status', { status: ApiKeyStatus.ACTIVE })
      .andWhere('expiresAt < :now', { now: new Date() })
      .execute();

    return result.affected || 0;
  }

  /**
   * Get API key usage statistics
   */
  async getUsageStats(
    id: string,
    organizationId: string,
  ): Promise<{
    totalRequests: number;
    lastUsed: Date | null;
    lastUsedIp: string | null;
    averageRequestsPerDay: number;
  }> {
    const apiKey = await this.findOne(id, organizationId);

    const daysSinceCreation = Math.max(
      1,
      Math.floor((Date.now() - apiKey.createdAt.getTime()) / (1000 * 60 * 60 * 24)),
    );

    return {
      totalRequests: apiKey.usageCount,
      lastUsed: apiKey.lastUsedAt,
      lastUsedIp: apiKey.lastUsedIp,
      averageRequestsPerDay: apiKey.usageCount / daysSinceCreation,
    };
  }
}