import { 
  BadRequestException, 
  Injectable, 
  Logger, 
  NotFoundException
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import * as crypto from 'crypto';
import { Repository } from 'typeorm';
import { type CreateCredentialDto, RotateCredentialDto } from '../dto/create-credential.dto';
import { CredentialType, IntegrationCredential, type OAuth2TokenData } from '../entities/integration-credential.entity';

@Injectable()
export class CredentialService {
  private readonly logger = new Logger(CredentialService.name);
  private readonly encryptionKey = process.env.CREDENTIAL_ENCRYPTION_KEY || 'default-key-change-in-production';

  constructor(
    @InjectRepository(IntegrationCredential)
    private readonly credentialRepository: Repository<IntegrationCredential>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async findAll(integrationId: string): Promise<IntegrationCredential[]> {
    return this.credentialRepository.find({
      where: { integrationId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<IntegrationCredential> {
    const credential = await this.credentialRepository.findOne({
      where: { id },
    });

    if (!credential) {
      throw new NotFoundException('Credential not found');
    }

    return credential;
  }

  async create(dto: CreateCredentialDto & { integrationId: string }): Promise<IntegrationCredential> {
    // Check for duplicate name
    const existing = await this.credentialRepository.findOne({
      where: {
        integrationId: dto.integrationId,
        name: dto.name,
      },
    });

    if (existing) {
      throw new BadRequestException(`Credential with name "${dto.name}" already exists`);
    }

    // Encrypt the value
    const encryptedValue = this.encrypt(dto.value);

    const credential = this.credentialRepository.create({
      ...dto,
      value: encryptedValue,
      isActive: dto.isActive ?? true,
      environment: dto.environment || 'production',
    });

    const saved = await this.credentialRepository.save(credential);

    await this.eventEmitter.emit('credential.created', {
      credentialId: saved.id,
      integrationId: dto.integrationId,
    });

    return saved;
  }

  async update(id: string, updates: Partial<IntegrationCredential>): Promise<IntegrationCredential> {
    const credential = await this.findOne(id);

    // If updating value, encrypt it
    if (updates.value) {
      updates.value = this.encrypt(updates.value);
    }

    Object.assign(credential, updates);
    return this.credentialRepository.save(credential);
  }

  async delete(id: string): Promise<void> {
    const credential = await this.findOne(id);
    await this.credentialRepository.remove(credential);

    await this.eventEmitter.emit('credential.deleted', {
      credentialId: id,
      integrationId: credential.integrationId,
    });
  }

  async rotateCredential(id: string, newValue: string, newSecret?: string): Promise<IntegrationCredential> {
    const credential = await this.findOne(id);

    credential.value = this.encrypt(newValue);
    
    if (newSecret && credential.oauth2Config) {
      credential.oauth2Config.clientSecret = this.encrypt(newSecret);
    }

    credential.lastRotatedAt = new Date();

    const rotated = await this.credentialRepository.save(credential);

    await this.eventEmitter.emit('credential.rotated', {
      credentialId: id,
      integrationId: credential.integrationId,
    });

    return rotated;
  }

  async refreshOAuth2Token(id: string): Promise<IntegrationCredential> {
    const credential = await this.findOne(id);

    if (credential.credentialType !== CredentialType.OAUTH2_TOKEN) {
      throw new BadRequestException('Credential is not an OAuth2 token');
    }

    // In a real implementation, this would use the refresh token
    // to get a new access token from the OAuth2 provider
    
    // Simulate token refresh
    const newAccessToken = `refreshed-token-${Date.now()}`;
    const newExpiresAt = new Date(Date.now() + 3600000); // 1 hour from now

    credential.value = this.encrypt(newAccessToken);
    credential.expiresAt = newExpiresAt;
    credential.lastUsedAt = new Date();

    return this.credentialRepository.save(credential);
  }

  async getActiveCredential(
    integrationId: string, 
    environment?: string
  ): Promise<IntegrationCredential | null> {
    const credential = await this.credentialRepository.findOne({
      where: {
        integrationId,
        isActive: true,
        environment: environment || 'production',
      },
      order: { createdAt: 'DESC' },
    });

    return credential || null;
  }

  async markAsUsed(id: string): Promise<void> {
    await this.credentialRepository.update(id, {
      lastUsedAt: new Date(),
    });
  }

  async checkExpiration(id: string): Promise<boolean> {
    const credential = await this.findOne(id);

    if (!credential.expiresAt) {
      return false; // No expiration
    }

    return credential.expiresAt.getTime() < Date.now();
  }

  async getDecryptedValue(id: string): Promise<string> {
    const credential = await this.findOne(id);
    return this.decrypt(credential.value);
  }

  updateTokens(credential: IntegrationCredential, accessToken: string, refreshToken?: string, expiresIn?: number): void {
    // For OAuth2 tokens, store both access and refresh tokens in metadata
    if (credential.credentialType === CredentialType.OAUTH2_TOKEN) {
      const tokenData: OAuth2TokenData = {
        accessToken: this.encrypt(accessToken),
        refreshToken: refreshToken ? this.encrypt(refreshToken) : undefined,
        tokenType: 'Bearer',
        expiresIn,
      };
      credential.value = JSON.stringify(tokenData);
    } else {
      credential.value = this.encrypt(accessToken);
    }

    if (expiresIn) {
      credential.expiresAt = new Date(Date.now() + expiresIn * 1000);
    }

    credential.lastUsedAt = new Date();
  }

  private encrypt(text: string): string {
    // Simple encryption - in production, use proper encryption
    const cipher = crypto.createCipher('aes-256-cbc', this.encryptionKey);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  }

  private decrypt(text: string): string {
    // Simple decryption - in production, use proper decryption
    const decipher = crypto.createDecipher('aes-256-cbc', this.encryptionKey);
    let decrypted = decipher.update(text, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
}