import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, type VerifyCallback } from 'passport-google-oauth20';
import { SsoService } from '../../sso/sso.service';
import { UserStatus } from '../../users/entities/user.entity';
import { UsersService } from '../../users/users.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  private readonly logger = new Logger(GoogleStrategy.name);
  private isConfigured = false;

  constructor(
    private configService: ConfigService,
    private usersService: UsersService,
    private ssoService: SsoService
  ) {
    const clientId = configService.get('GOOGLE_CLIENT_ID');
    const clientSecret = configService.get('GOOGLE_CLIENT_SECRET');

    super({
      clientID: clientId || 'dummy',
      clientSecret: clientSecret || 'dummy',
      callbackURL: configService.get('GOOGLE_CALLBACK_URL', '/auth/google/callback'),
      scope: ['email', 'profile'],
      passReqToCallback: false,
    });

    if (!clientId || !clientSecret) {
      this.logger.warn(
        'Google OAuth not configured: GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET missing'
      );
      this.isConfigured = false;
    } else {
      this.isConfigured = true;
      this.logger.log('Google OAuth strategy initialized');
    }
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback
  ): Promise<any> {
    if (!this.isConfigured) {
      return done(new Error('Google OAuth is not configured'), null);
    }

    try {
      const { emails, name, photos, id: googleId } = profile;
      const email = emails[0].value;

      // Find or create user
      let user = await this.usersService.findByEmail(email);

      if (!user) {
        // Check if JIT provisioning is allowed
        const providers = await this.ssoService.findAllProviders();
        const googleProvider = providers.find(
          (p) => p.type === 'oauth2' && p.name.toLowerCase().includes('google')
        );

        if (!googleProvider?.allowJitProvisioning) {
          return done(new Error('User not found and JIT provisioning is disabled'), null);
        }

        // Create new user
        user = await this.usersService.create(
          {
            email,
            firstName: name.givenName,
            lastName: name.familyName,
            password: Math.random().toString(36).slice(-8), // Random password
            profilePicture: photos[0]?.value,
            status: UserStatus.ACTIVE,
            emailVerified: true,
            organizationId: googleProvider.organizationId,
          },
          null
        ); // System-created user

        // Assign default role if configured
        if (googleProvider.configuration.defaultRole) {
          await this.usersService.assignRole(
            user.id,
            googleProvider.configuration.defaultRole,
            null
          ); // System-assigned role
        }
      }

      // Store OAuth tokens in session
      const sessionData = {
        googleId,
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
