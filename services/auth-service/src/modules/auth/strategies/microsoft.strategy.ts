import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, type VerifyCallback } from 'passport-microsoft';
import { SsoService } from '../../sso/sso.service';
import { UserStatus } from '../../users/entities/user.entity';
import { UsersService } from '../../users/users.service';

@Injectable()
export class MicrosoftStrategy extends PassportStrategy(Strategy, 'microsoft') {
  private readonly logger = new Logger(MicrosoftStrategy.name);
  private isConfigured = false;

  constructor(
    private configService: ConfigService,
    private usersService: UsersService,
    private ssoService: SsoService
  ) {
    const clientId = configService.get('MICROSOFT_CLIENT_ID');
    const clientSecret = configService.get('MICROSOFT_CLIENT_SECRET');
    const tenant = configService.get('MICROSOFT_TENANT', 'common');

    super({
      clientID: clientId || 'dummy',
      clientSecret: clientSecret || 'dummy',
      callbackURL: configService.get('MICROSOFT_CALLBACK_URL', '/auth/microsoft/callback'),
      scope: ['user.read', 'openid', 'profile', 'email'],
      tenant: tenant,
      authorizationURL: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`,
      tokenURL: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
      passReqToCallback: false,
    });

    if (!clientId || !clientSecret) {
      this.logger.warn(
        'Microsoft OAuth not configured: MICROSOFT_CLIENT_ID or MICROSOFT_CLIENT_SECRET missing'
      );
      this.isConfigured = false;
    } else {
      this.isConfigured = true;
      this.logger.log('Microsoft OAuth strategy initialized');
    }
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback
  ): Promise<any> {
    if (!this.isConfigured) {
      return done(new Error('Microsoft OAuth is not configured'), null);
    }

    try {
      const { emails, displayName, name, photos, id: microsoftId } = profile;
      const email = emails[0].value;

      // Find or create user
      let user = await this.usersService.findByEmail(email);

      if (!user) {
        // Check if JIT provisioning is allowed
        const providers = await this.ssoService.findAllProviders();
        const microsoftProvider = providers.find(
          (p) => p.type === 'oauth2' && p.name.toLowerCase().includes('microsoft')
        );

        if (!microsoftProvider?.allowJitProvisioning) {
          return done(new Error('User not found and JIT provisioning is disabled'), null);
        }

        // Create new user
        user = await this.usersService.create(
          {
            email,
            firstName: name?.givenName || displayName.split(' ')[0],
            lastName: name?.familyName || displayName.split(' ').slice(1).join(' '),
            password: Math.random().toString(36).slice(-8), // Random password
            profilePicture: photos[0]?.value,
            status: UserStatus.ACTIVE,
            emailVerified: true,
            organizationId: microsoftProvider.organizationId,
          },
          null
        ); // System-created user

        // Assign default role if configured
        if (microsoftProvider.configuration.defaultRole) {
          await this.usersService.assignRole(
            user.id,
            microsoftProvider.configuration.defaultRole,
            null
          ); // System-assigned role
        }
      }

      // Store OAuth tokens in session
      const sessionData = {
        microsoftId,
        accessToken,
        refreshToken,
        profile,
      };

      return done(null, { ...user, oauth: sessionData });
    } catch (error) {
      return done(error, null);
    }
  }
}
