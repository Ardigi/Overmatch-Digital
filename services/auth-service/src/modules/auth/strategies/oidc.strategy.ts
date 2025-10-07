import { Inject, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { type Client, Issuer, Strategy, type TokenSet, type UserinfoResponse } from 'openid-client';
import type { SsoProvider } from '../../sso/entities/sso-provider.entity';
import type { SsoService } from '../../sso/sso.service';
import { UserStatus } from '../../users/entities/user.entity';
import { UsersService } from '../../users/users.service';

@Injectable()
export class OidcStrategy extends PassportStrategy(Strategy, 'oidc') {
  constructor(
    @Inject('OIDC_CLIENT') private client: Client,
    @Inject('SSO_PROVIDER') private provider: SsoProvider,
    private usersService: UsersService,
    private ssoService: SsoService,
  ) {
    super({
      client,
      params: {
        scope: provider.configuration.scope?.join(' ') || 'openid email profile',
      },
      passReqToCallback: true,
    });
  }

  async validate(
    req: any,
    tokenSet: TokenSet,
    userinfo: UserinfoResponse,
    done: (err: any, user?: any) => void,
  ): Promise<any> {
    try {
      const email = userinfo.email || userinfo.preferred_username;
      if (!email) {
        return done(new Error('Email not found in OIDC response'), null);
      }

      // Check if email domain is allowed
      if (this.provider.configuration.allowedDomains?.length > 0) {
        const domain = email.split('@')[1];
        if (!this.provider.configuration.allowedDomains.includes(domain)) {
          return done(new Error('Email domain not allowed'), null);
        }
      }

      // Find or create user
      let user = await this.usersService.findByEmail(email);

      if (!user) {
        if (!this.provider.allowJitProvisioning) {
          return done(new Error('User not found and JIT provisioning is disabled'), null);
        }

        // Create new user via JIT provisioning
        user = await this.usersService.create({
          email,
          firstName: userinfo.given_name || userinfo.name?.split(' ')[0] || '',
          lastName: userinfo.family_name || userinfo.name?.split(' ').slice(1).join(' ') || '',
          password: Math.random().toString(36).slice(-8), // Random password
          profilePicture: userinfo.picture,
          status: UserStatus.ACTIVE,
          emailVerified: true,
          organizationId: this.provider.organizationId,
        }, null); // System-created user

        // Assign default role if configured
        if (this.provider.configuration.defaultRole) {
          await this.usersService.assignRole(user.id, this.provider.configuration.defaultRole, null); // System-assigned role
        }
      } else if (this.provider.configuration.syncUserAttributes) {
        // Update user attributes
        await this.usersService.update(user.id, {
          firstName: userinfo.given_name || user.firstName,
          lastName: userinfo.family_name || user.lastName,
          profilePicture: userinfo.picture || user.profilePicture,
        }, null); // System update
      }

      // Store OIDC tokens and info
      const sessionData = {
        tokenSet,
        userinfo,
        providerId: this.provider.id,
      };

      return done(null, { ...user, oidc: sessionData });
    } catch (error) {
      return done(error, null);
    }
  }
}

// Factory to create OIDC strategies dynamically
export async function createOidcStrategy(provider: SsoProvider): Promise<OidcStrategy> {
  const issuer = await Issuer.discover(provider.configuration.authorizationURL);
  
  const client = new issuer.Client({
    client_id: provider.configuration.clientId,
    client_secret: provider.configuration.clientSecret,
    redirect_uris: [provider.configuration.callbackURL],
    response_types: provider.configuration.responseType?.split(' ') || ['code'],
  });

  return new OidcStrategy(client, provider, null, null);
}