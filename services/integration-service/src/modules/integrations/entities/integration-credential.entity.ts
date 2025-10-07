import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Integration } from './integration.entity';

export enum CredentialType {
  API_KEY = 'API_KEY',
  TOKEN = 'TOKEN',
  OAUTH2_TOKEN = 'OAUTH2_TOKEN',
  USERNAME_PASSWORD = 'USERNAME_PASSWORD',
  CERTIFICATE = 'CERTIFICATE',
  CUSTOM = 'CUSTOM',
}

export interface OAuth2TokenData {
  accessToken: string;
  refreshToken?: string;
  tokenType: string;
  expiresIn?: number;
  scope?: string[];
}

@Entity('integration_credentials')
@Index(['integrationId', 'name'], { unique: true })
@Index(['integrationId', 'credentialType'])
@Index(['environment'])
@Index(['expiresAt'])
export class IntegrationCredential {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  integrationId: string;

  @ManyToOne(() => Integration, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'integrationId' })
  integration: Integration;

  @Column()
  name: string;

  @Column({ nullable: true })
  description?: string;

  @Column({
    type: 'enum',
    enum: CredentialType,
  })
  credentialType: CredentialType;

  @Column({ type: 'text' })
  value: string; // Encrypted value

  @Column({ type: 'jsonb', nullable: true })
  oauth2Config?: {
    clientId: string;
    clientSecret: string;
    authorizationUrl?: string;
    tokenUrl?: string;
    scope?: string[];
  };

  @Column({ nullable: true })
  expiresAt?: Date;

  @Column({ default: 'production' })
  environment: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ nullable: true })
  lastUsedAt?: Date;

  @Column({ nullable: true })
  lastRotatedAt?: Date;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
