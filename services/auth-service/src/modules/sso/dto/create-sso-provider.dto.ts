import {
  IsBoolean,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { SsoProviderStatus, SsoProviderType } from '../entities/sso-provider.entity';

export class CreateSsoProviderDto {
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  name: string;

  @IsEnum(SsoProviderType)
  type: SsoProviderType;

  @IsEnum(SsoProviderStatus)
  @IsOptional()
  status?: SsoProviderStatus;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @IsObject()
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

  @IsObject()
  @IsOptional()
  attributeMapping?: {
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

  @IsObject()
  @IsOptional()
  metadata?: {
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

  @IsBoolean()
  @IsOptional()
  allowJitProvisioning?: boolean;

  @IsBoolean()
  @IsOptional()
  enforceEncryption?: boolean;
}
