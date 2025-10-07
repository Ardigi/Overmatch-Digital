/**
 * Enterprise Secrets Management Interface
 *
 * Provides unified interface for accessing secrets across different providers:
 * - AWS Secrets Manager (production)
 * - HashiCorp Vault (enterprise)
 * - Local file-based storage (development)
 */

export interface SecretValue {
  value: string;
  version?: string;
  lastRotated?: Date;
  expiresAt?: Date;
  metadata?: Record<string, any>;
}

export interface SecretRotationConfig {
  enabled: boolean;
  intervalDays: number;
  beforeExpiryDays?: number;
  rotationFunction?: string;
}

export interface SecretMetadata {
  name: string;
  description?: string;
  tags?: Record<string, string>;
  rotation?: SecretRotationConfig;
  createdAt: Date;
  updatedAt: Date;
  version: string;
}

export interface SecretListItem {
  name: string;
  version: string;
  lastModified: Date;
  tags?: Record<string, string>;
}

export interface SecretCreateOptions {
  description?: string;
  tags?: Record<string, string>;
  rotation?: SecretRotationConfig;
  replicas?: string[]; // For multi-region replication
}

export interface SecretUpdateOptions {
  description?: string;
  tags?: Record<string, string>;
  rotation?: SecretRotationConfig;
}

export interface SecretsManagerInterface {
  /**
   * Retrieve a secret value by name
   */
  getSecret(secretName: string, version?: string): Promise<SecretValue>;

  /**
   * Store or update a secret
   */
  putSecret(
    secretName: string,
    secretValue: string,
    options?: SecretCreateOptions
  ): Promise<SecretMetadata>;

  /**
   * Update secret metadata without changing the value
   */
  updateSecretMetadata(secretName: string, options: SecretUpdateOptions): Promise<SecretMetadata>;

  /**
   * Delete a secret (soft delete, maintains version history)
   */
  deleteSecret(secretName: string, forceDelete?: boolean): Promise<void>;

  /**
   * List all secrets (names only for security)
   */
  listSecrets(prefix?: string, tags?: Record<string, string>): Promise<SecretListItem[]>;

  /**
   * Get secret metadata without the actual value
   */
  getSecretMetadata(secretName: string): Promise<SecretMetadata>;

  /**
   * Rotate a secret (generate new value)
   */
  rotateSecret(secretName: string, rotationFunction?: string): Promise<SecretValue>;

  /**
   * Generate a new random secret value
   */
  generateSecret(length?: number, includeSymbols?: boolean): Promise<string>;

  /**
   * Health check for the secrets provider
   */
  healthCheck(): Promise<boolean>;

  /**
   * Get provider-specific information
   */
  getProvider(): string;
}
