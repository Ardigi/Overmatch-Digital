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
import { Organization } from '../../users/entities/organization.entity';

export enum SsoProviderType {
  SAML = 'saml',
  OIDC = 'oidc',
  OAUTH2 = 'oauth2',
}

export enum SsoProviderStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  PENDING = 'pending',
}

@Entity('sso_providers')
@Index(['organizationId'])
@Index(['type', 'organizationId'])
@Index(['status'])
export class SsoProvider {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({
    type: 'enum',
    enum: SsoProviderType,
  })
  type: SsoProviderType;

  @Column({
    type: 'enum',
    enum: SsoProviderStatus,
    default: SsoProviderStatus.PENDING,
  })
  status: SsoProviderStatus;

  @Column({ nullable: true })
  description: string;

  @Column({ type: 'simple-json' })
  configuration: {
    // SAML Configuration
    entryPoint?: string;
    issuer?: string;
    cert?: string;
    privateCert?: string;
    decryptionPvk?: string;
    signatureAlgorithm?: string;
    signAuthnRequests?: boolean;
    wantAssertionsSigned?: boolean;
    wantAuthnResponseSigned?: boolean;
    identifierFormat?: string;
    acceptedClockSkewMs?: number;
    attributeConsumingServiceIndex?: string;
    disableRequestedAuthnContext?: boolean;
    authnContext?: string[];
    forceAuthn?: boolean;
    skipRequestCompression?: boolean;
    authnRequestBinding?: string;

    // OIDC/OAuth2 Configuration
    clientId?: string;
    clientSecret?: string;
    authorizationURL?: string;
    tokenURL?: string;
    userInfoURL?: string;
    scope?: string[];
    responseType?: string;
    grantType?: string;

    // Common Configuration
    callbackURL?: string;
    logoutURL?: string;
    allowedDomains?: string[];
    autoProvisionUsers?: boolean;
    defaultRole?: string;
    syncUserAttributes?: boolean;
  };

  @Column({ type: 'simple-json', nullable: true })
  attributeMapping: {
    email?: string;
    firstName?: string;
    lastName?: string;
    displayName?: string;
    phone?: string;
    department?: string;
    title?: string;
    groups?: string;
    customAttributes?: Record<string, string>;
  };

  @Column({ type: 'simple-json', nullable: true })
  metadata: {
    entityId?: string;
    metadataUrl?: string;
    x509cert?: string;
    publicKey?: string;
    endpoints?: {
      singleSignOnService?: string;
      singleLogoutService?: string;
      artifactResolutionService?: string;
    };
  };

  @Column({ nullable: true })
  organizationId: string;

  @ManyToOne(() => Organization)
  @JoinColumn({ name: 'organizationId' })
  organization: Organization;

  @Column({ default: true })
  allowJitProvisioning: boolean;

  @Column({ default: false })
  enforceEncryption: boolean;

  @Column({ nullable: true })
  lastSyncAt: Date;

  @Column({ nullable: true })
  lastErrorAt: Date;

  @Column({ nullable: true })
  lastErrorMessage: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  deletedAt: Date;
}
