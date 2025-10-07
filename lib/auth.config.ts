import type { NextAuthConfig } from 'next-auth';
import AzureAD from 'next-auth/providers/azure-ad';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import { z } from 'zod';
import { authApiDirect } from './api/auth-direct';

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

// SECURITY: Validate auth secret configuration
const getAuthSecret = () => {
  const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
  if (!secret && process.env.NODE_ENV === 'production') {
    throw new Error('NEXTAUTH_SECRET or AUTH_SECRET environment variable is required in production');
  }
  if (!secret) {
    console.warn('WARNING: Using default auth secret for development only. Set NEXTAUTH_SECRET or AUTH_SECRET for production.');
  }
  return secret || 'development-only-auth-secret-not-for-production';
};

export default {
  secret: getAuthSecret(),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    AzureAD({
      clientId: process.env.AZURE_AD_CLIENT_ID!,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
      tenantId: process.env.AZURE_AD_TENANT_ID!,
    }),
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const validatedFields = credentialsSchema.safeParse(credentials);

        if (!validatedFields.success) {
          return null;
        }

        const { email, password } = validatedFields.data;

        // Single authentication flow - SOC compliant
        try {
          const response = await authApiDirect.login({ email, password });

          if (!response || !response.user) {
            return null;
          }

          if (response.requiresMfa) {
            // MFA is required, return null and handle in the client
            return null;
          }

          const userObj = {
            id: response.user.id,
            email: response.user.email,
            name: response.user.fullName || `${response.user.firstName} ${response.user.lastName}`,
            accessToken: response.access_token,
            refreshToken: response.refresh_token,
            roles: response.user.roles || [],
            permissions: response.user.permissions || [],
            organization: response.user.organization || null,
            firstName: response.user.firstName,
            lastName: response.user.lastName,
          };
          return userObj;
        } catch (error) {
          // Log minimal error info without complex objects
          if (error instanceof Error) {
            console.error('[NextAuth] Auth error:', error.message);
          }
          return null;
        }
      },
    }),
  ],
  pages: {
    signIn: '/auth/signin',
    signOut: '/auth/signout',
    error: '/auth/error',
    verifyRequest: '/auth/verify-request',
    newUser: '/dashboard',
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnDashboard = nextUrl.pathname.startsWith('/dashboard');
      const isOnAuth = nextUrl.pathname.startsWith('/auth');
      const isOnAPI = nextUrl.pathname.startsWith('/api');

      if (isOnDashboard || isOnAPI) {
        if (isLoggedIn) return true;
        return false;
      } else if (isLoggedIn && isOnAuth) {
        return Response.redirect(new URL('/dashboard', nextUrl));
      }

      return true;
    },
    async jwt({ token, user, account, trigger }) {
      // Initial sign in
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        token.accessToken = user.accessToken;
        token.refreshToken = user.refreshToken;
        token.roles = user.roles;
        token.permissions = user.permissions;
        token.organization = user.organization;
      }

      // OAuth sign in
      if (account && account.provider !== 'credentials') {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.provider = account.provider;
      }

      // Token refresh
      if (trigger === 'update' && token.refreshToken) {
        try {
          const refreshed = await authApiDirect.refreshToken(token.refreshToken as string);
          token.accessToken = refreshed.access_token;
          token.refreshToken = refreshed.refresh_token;
        } catch (error) {
          console.error('Token refresh failed:', error);
          // Return null to sign out the user
          return null;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user && token) {
        // Safely assign user ID with proper validation
        if (token.id && typeof token.id === 'string') {
          session.user.id = token.id;
        }

        // Safely assign email with validation
        if (token.email && typeof token.email === 'string') {
          session.user.email = token.email;
        }

        // Safely assign name with validation
        if (token.name && typeof token.name === 'string') {
          session.user.name = token.name;
        }

        // Safely assign tokens with validation
        if (token.accessToken && typeof token.accessToken === 'string') {
          session.accessToken = token.accessToken;
        }

        if (token.refreshToken && typeof token.refreshToken === 'string') {
          session.refreshToken = token.refreshToken;
        }

        // Properly validate and assign roles array with full type safety
        if (token.roles && Array.isArray(token.roles)) {
          session.user.roles = token.roles.filter(
            (role): role is { id: string; name: string } =>
              role !== null &&
              typeof role === 'object' &&
              'id' in role &&
              'name' in role &&
              typeof role.id === 'string' &&
              typeof role.name === 'string'
          );
        }

        // Safely assign permissions with validation
        if (token.permissions && Array.isArray(token.permissions)) {
          session.user.permissions = token.permissions.filter(
            (permission): permission is string => typeof permission === 'string'
          );
        }

        // Properly validate and assign organization with full type safety
        if (
          token.organization &&
          typeof token.organization === 'object' &&
          token.organization !== null &&
          'id' in token.organization &&
          'name' in token.organization &&
          'type' in token.organization &&
          typeof token.organization.id === 'string' &&
          typeof token.organization.name === 'string' &&
          typeof token.organization.type === 'string'
        ) {
          session.user.organization = {
            id: token.organization.id,
            name: token.organization.name,
            type: token.organization.type,
          };
        }
      }

      return session;
    },
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  debug: process.env.NODE_ENV === 'development',
  jwt: {
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
} satisfies NextAuthConfig;
