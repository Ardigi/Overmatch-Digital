import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as crypto from 'crypto';
import * as saml2 from 'saml2-js';
import { Repository } from 'typeorm';
import { EventsService } from '../events/events.service';
import { UserStatus } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import type { CreateSsoProviderDto } from './dto/create-sso-provider.dto';
import type { UpdateSsoProviderDto } from './dto/update-sso-provider.dto';
import { SsoProvider, SsoProviderStatus, SsoProviderType } from './entities/sso-provider.entity';
import { SsoSession } from './entities/sso-session.entity';

@Injectable()
export class SsoService {
  private samlProviders: Map<string, any> = new Map();

  constructor(
    @InjectRepository(SsoProvider)
    private ssoProviderRepository: Repository<SsoProvider>,
    @InjectRepository(SsoSession)
    private ssoSessionRepository: Repository<SsoSession>,
    private usersService: UsersService,
    private jwtService: JwtService,
    private eventsService: EventsService,
  ) {}

  // Provider Management
  async createProvider(createSsoProviderDto: CreateSsoProviderDto, organizationId: string): Promise<SsoProvider> {
    const provider = this.ssoProviderRepository.create({
      ...createSsoProviderDto,
      organizationId,
    });

    await this.ssoProviderRepository.save(provider);

    // Initialize SAML provider if type is SAML
    if (provider.type === SsoProviderType.SAML) {
      await this.initializeSamlProvider(provider);
    }

    await this.eventsService.publishEvent('sso-provider.created', {
      providerId: provider.id,
      organizationId,
      type: provider.type,
    });

    return provider;
  }

  async findAllProviders(organizationId?: string): Promise<SsoProvider[]> {
    const query = this.ssoProviderRepository.createQueryBuilder('provider');
    
    if (organizationId) {
      query.where('provider.organizationId = :organizationId', { organizationId });
    }

    return query.getMany();
  }

  async findProviderById(id: string): Promise<SsoProvider> {
    const provider = await this.ssoProviderRepository.findOne({
      where: { id },
      relations: ['organization'],
    });

    if (!provider) {
      throw new NotFoundException('SSO provider not found');
    }

    return provider;
  }

  async updateProvider(id: string, updateSsoProviderDto: UpdateSsoProviderDto): Promise<SsoProvider> {
    const provider = await this.findProviderById(id);
    Object.assign(provider, updateSsoProviderDto);
    
    await this.ssoProviderRepository.save(provider);

    // Reinitialize SAML provider if configuration changed
    if (provider.type === SsoProviderType.SAML && updateSsoProviderDto.configuration) {
      await this.initializeSamlProvider(provider);
    }

    await this.eventsService.publishEvent('sso-provider.updated', {
      providerId: provider.id,
      changes: updateSsoProviderDto,
    });

    return provider;
  }

  async deleteProvider(id: string): Promise<void> {
    const provider = await this.findProviderById(id);
    provider.deletedAt = new Date();
    await this.ssoProviderRepository.save(provider);

    // Clean up SAML provider
    if (provider.type === SsoProviderType.SAML) {
      this.samlProviders.delete(provider.id);
    }

    await this.eventsService.publishEvent('sso-provider.deleted', {
      providerId: provider.id,
    });
  }

  // SAML Authentication
  async initializeSamlProvider(provider: SsoProvider): Promise<void> {
    if (provider.type !== SsoProviderType.SAML) {
      return;
    }

    const config = provider.configuration;
    const serviceProvider = new saml2.ServiceProvider({
      entity_id: config.issuer || `${process.env.APP_URL}/auth/saml/${provider.id}`,
      private_key: config.privateCert,
      certificate: config.cert,
      assert_endpoint: config.callbackURL || `${process.env.APP_URL}/auth/saml/${provider.id}/callback`,
      allow_unencrypted_assertion: !provider.enforceEncryption,
    });

    const identityProvider = new saml2.IdentityProvider({
      sso_login_url: config.entryPoint,
      sso_logout_url: config.logoutURL,
      certificates: [config.cert],
      force_authn: config.forceAuthn || false,
      sign_get_request: config.signAuthnRequests || false,
      allow_unencrypted_assertion: !provider.enforceEncryption,
    });

    this.samlProviders.set(provider.id, {
      serviceProvider,
      identityProvider,
    });
  }

  async generateSamlAuthUrl(providerId: string): Promise<string> {
    const provider = await this.findProviderById(providerId);
    
    if (provider.status !== SsoProviderStatus.ACTIVE) {
      throw new BadRequestException('SSO provider is not active');
    }

    if (provider.type !== SsoProviderType.SAML) {
      throw new BadRequestException('Provider is not a SAML provider');
    }

    const samlProvider = this.samlProviders.get(providerId);
    if (!samlProvider) {
      await this.initializeSamlProvider(provider);
    }

    const { serviceProvider, identityProvider } = this.samlProviders.get(providerId);

    return new Promise((resolve, reject) => {
      serviceProvider.create_login_request_url(identityProvider, {}, (err: any, login_url: string) => {
        if (err) {
          reject(new BadRequestException('Failed to generate SAML auth URL'));
        } else {
          resolve(login_url);
        }
      });
    });
  }

  async handleSamlCallback(providerId: string, samlResponse: string, relay_state?: string): Promise<any> {
    const provider = await this.findProviderById(providerId);
    
    if (provider.type !== SsoProviderType.SAML) {
      throw new BadRequestException('Provider is not a SAML provider');
    }

    const samlProvider = this.samlProviders.get(providerId);
    if (!samlProvider) {
      await this.initializeSamlProvider(provider);
    }

    const { serviceProvider, identityProvider } = this.samlProviders.get(providerId);

    return new Promise((resolve, reject) => {
      const options = { request_body: { SAMLResponse: samlResponse } };
      
      serviceProvider.post_assert(identityProvider, options, async (err: any, saml_response: any) => {
        if (err) {
          await this.logSsoError(provider, err.message);
          reject(new UnauthorizedException('SAML authentication failed'));
          return;
        }

        try {
          const user = await this.processAuthResponse(provider, saml_response);
          const session = await this.createSsoSession(user, provider, saml_response);
          
          // Generate tokens directly here to avoid circular dependency
          const accessToken = this.jwtService.sign(
            { 
              sub: user.id, 
              email: user.email,
              organizationId: user.organizationId,
              type: 'access'
            },
            { expiresIn: '1h' }
          );
          
          const refreshToken = this.jwtService.sign(
            { 
              sub: user.id,
              type: 'refresh'
            },
            { expiresIn: '7d' }
          );

          resolve({
            user,
            tokens: {
              accessToken,
              refreshToken,
            },
            session,
            relay_state,
          });
        } catch (error) {
          await this.logSsoError(provider, error.message);
          reject(error);
        }
      });
    });
  }

  async generateSamlMetadata(providerId: string): Promise<string> {
    const provider = await this.findProviderById(providerId);
    
    if (provider.type !== SsoProviderType.SAML) {
      throw new BadRequestException('Provider is not a SAML provider');
    }

    const samlProvider = this.samlProviders.get(providerId);
    if (!samlProvider) {
      await this.initializeSamlProvider(provider);
    }

    const { serviceProvider } = this.samlProviders.get(providerId);
    return serviceProvider.create_metadata();
  }

  async handleSamlLogout(providerId: string, nameId: string, sessionIndex: string): Promise<string> {
    const session = await this.ssoSessionRepository.findOne({
      where: { sessionIndex, ssoProviderId: providerId },
    });

    if (!session) {
      throw new NotFoundException('SSO session not found');
    }

    // Invalidate session
    await this.ssoSessionRepository.remove(session);

    const provider = await this.findProviderById(providerId);
    const { serviceProvider, identityProvider } = this.samlProviders.get(providerId);

    return new Promise((resolve, reject) => {
      const options = {
        name_id: nameId,
        session_index: sessionIndex,
      };

      serviceProvider.create_logout_request_url(identityProvider, options, (err: any, logout_url: string) => {
        if (err) {
          reject(new BadRequestException('Failed to generate SAML logout URL'));
        } else {
          resolve(logout_url);
        }
      });
    });
  }

  // User Processing
  private async processAuthResponse(provider: SsoProvider, authResponse: any): Promise<any> {
    const attributes = authResponse.user || {};
    const mapping = provider.attributeMapping || {};

    // Extract user data based on attribute mapping
    const email = attributes[mapping.email || 'email'] || attributes.email;
    const firstName = attributes[mapping.firstName || 'firstName'] || attributes.given_name || '';
    const lastName = attributes[mapping.lastName || 'lastName'] || attributes.family_name || '';
    const displayName = attributes[mapping.displayName || 'displayName'] || attributes.name || `${firstName} ${lastName}`;

    if (!email) {
      throw new BadRequestException('Email not found in SAML response');
    }

    // Check if email domain is allowed
    if (provider.configuration.allowedDomains?.length > 0) {
      const domain = email.split('@')[1];
      if (!provider.configuration.allowedDomains.includes(domain)) {
        throw new UnauthorizedException('Email domain not allowed');
      }
    }

    // Find or create user
    let user = await this.usersService.findByEmail(email);

    if (!user) {
      if (!provider.allowJitProvisioning) {
        throw new UnauthorizedException('User not found and JIT provisioning is disabled');
      }

      // Create new user via JIT provisioning
      user = await this.usersService.create({
        email,
        firstName,
        lastName,
        password: crypto.randomBytes(32).toString('hex'), // Random password
        organizationId: provider.organizationId,
      }, null); // System-created user via SSO

      // Mark email as verified and activate user for SSO users
      await this.usersService['userRepository'].update(user.id, { 
        emailVerified: true,
        status: UserStatus.ACTIVE 
      });

      // Assign default role if configured
      if (provider.configuration.defaultRole) {
        await this.usersService.assignRole(user.id, provider.configuration.defaultRole, null); // System-assigned role
      }

      await this.eventsService.publishEvent('sso.user-provisioned', {
        userId: user.id,
        providerId: provider.id,
        email,
      });
    } else if (provider.configuration.syncUserAttributes) {
      // Update user attributes
      await this.usersService.update(user.id, {
        firstName: firstName || user.firstName,
        lastName: lastName || user.lastName,
      }, null); // System-updated via SSO sync
    }

    return user;
  }

  async createSsoSession(
    user: any,
    provider: SsoProvider,
    authResponse: any,
  ): Promise<SsoSession> {
    const sessionIndex = authResponse.response_header?.in_response_to || crypto.randomBytes(16).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 8); // 8 hour session

    const session = this.ssoSessionRepository.create({
      userId: user.id,
      ssoProviderId: provider.id,
      sessionIndex,
      nameId: authResponse.user?.name_id,
      nameIdFormat: authResponse.user?.name_id_format,
      attributes: authResponse.user,
      samlResponse: JSON.stringify(authResponse),
      expiresAt,
      lastActivityAt: new Date(),
    });

    await this.ssoSessionRepository.save(session);

    await this.eventsService.publishEvent('sso.session-created', {
      sessionId: session.id,
      userId: user.id,
      providerId: provider.id,
    });

    return session;
  }

  async findActiveSession(userId: string, providerId: string): Promise<SsoSession | null> {
    const session = await this.ssoSessionRepository.findOne({
      where: {
        userId,
        ssoProviderId: providerId,
        expiresAt: new Date(),
      },
      order: {
        createdAt: 'DESC',
      },
    });

    return session && !session.isExpired() ? session : null;
  }

  async invalidateSession(sessionId: string): Promise<void> {
    const session = await this.ssoSessionRepository.findOne({ where: { id: sessionId } });
    if (session) {
      await this.ssoSessionRepository.remove(session);
      
      await this.eventsService.publishEvent('sso.session-invalidated', {
        sessionId: session.id,
        userId: session.userId,
      });
    }
  }

  async invalidateAllUserSessions(userId: string): Promise<void> {
    const sessions = await this.ssoSessionRepository.find({ where: { userId } });
    await this.ssoSessionRepository.remove(sessions);

    await this.eventsService.publishEvent('sso.all-sessions-invalidated', {
      userId,
      count: sessions.length,
    });
  }

  private async logSsoError(provider: SsoProvider, errorMessage: string): Promise<void> {
    provider.lastErrorAt = new Date();
    provider.lastErrorMessage = errorMessage;
    await this.ssoProviderRepository.save(provider);
  }
}