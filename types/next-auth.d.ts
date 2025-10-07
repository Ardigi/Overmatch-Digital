import NextAuth, { DefaultSession } from 'next-auth';
import { JWT } from 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      roles?: Array<{
        id: string;
        name: string;
      }>;
      permissions?: string[];
      organization?: {
        id: string;
        name: string;
        type: string;
      };
    } & DefaultSession['user'];
    accessToken?: string;
    refreshToken?: string;
  }

  interface User {
    id: string;
    email: string;
    name: string;
    accessToken?: string;
    refreshToken?: string;
    roles?: Array<{
      id: string;
      name: string;
    }>;
    permissions?: string[];
    organization?: {
      id: string;
      name: string;
      type: string;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    email?: string;
    name?: string;
    accessToken?: string;
    refreshToken?: string;
    provider?: string;
    roles?: Array<{
      id: string;
      name: string;
    }>;
    permissions?: string[];
    organization?: {
      id: string;
      name: string;
      type: string;
    };
  }
}
