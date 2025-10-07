import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Client, ClientStatus } from '../clients/entities/client.entity';
import { RedisService } from '../redis/redis.service';

/**
 * ClientCoreService provides essential client operations without circular dependencies.
 * This service contains only the methods needed by other services like ContractsService.
 * 
 * Methods included:
 * - findOne: Get client by ID with caching
 * - exists: Check if client exists
 * - Basic validation methods
 * 
 * Methods NOT included:
 * - create, update, delete (these remain in ClientsService)
 * - Complex business logic that depends on other services
 */
@Injectable()
export class ClientCoreService {
  constructor(
    @InjectRepository(Client)
    private readonly clientRepository: Repository<Client>,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Find a client by ID with caching support
   * This is the core method needed by ContractsService
   */
  async findOne(id: string): Promise<Client> {
    // Try to get from cache first
    const cachedClient = await this.redisService.getCachedClient(id);
    if (cachedClient) {
      return cachedClient;
    }

    const client = await this.clientRepository.findOne({
      where: { id, isDeleted: false },
      relations: ['subsidiaries'],
    });

    if (!client) {
      throw new NotFoundException(`Client with ID ${id} not found`);
    }

    // Cache the client data
    await this.redisService.cacheClient(id, client);

    return client;
  }

  /**
   * Check if a client exists by ID
   */
  async exists(id: string): Promise<boolean> {
    const count = await this.clientRepository.count({
      where: { id, isDeleted: false },
    });
    return count > 0;
  }

  /**
   * Find client by slug
   */
  async findBySlug(slug: string): Promise<Client | null> {
    return this.clientRepository.findOne({
      where: { slug, isDeleted: false },
    });
  }

  /**
   * Get basic client info for contract generation
   */
  async getClientInfo(id: string): Promise<{ id: string; name: string; slug: string }> {
    const client = await this.clientRepository.findOne({
      where: { id, isDeleted: false },
      select: ['id', 'name', 'slug'],
    });

    if (!client) {
      throw new NotFoundException(`Client with ID ${id} not found`);
    }

    return client;
  }

  /**
   * Find clients by organization ID (for multi-tenant scenarios)
   */
  async findByOrganizationId(organizationId: string): Promise<Client[]> {
    return this.clientRepository.find({
      where: {
        organizationId,
        isDeleted: false,
      },
      select: ['id', 'name', 'slug', 'status'],
      order: {
        createdAt: 'DESC',
      },
    });
  }

  /**
   * Get active clients count for metrics
   */
  async getActiveClientsCount(): Promise<number> {
    return this.clientRepository.count({
      where: {
        isDeleted: false,
        status: ClientStatus.ACTIVE,
      },
    });
  }

  /**
   * Invalidate client cache when updated
   */
  async invalidateCache(id: string): Promise<void> {
    await this.redisService.invalidateClient(id);
  }
}
