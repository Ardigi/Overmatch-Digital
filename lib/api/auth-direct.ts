// Direct auth API implementation without complex client initialization
// This bypasses the service-clients abstraction to fix the authentication issue

export interface LoginCredentials {
  email: string;
  password: string;
  deviceFingerprint?: string;
  mfaToken?: string;
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName?: string;
  roles: string[];
  permissions?: string[];
  organizationId?: string;
  organization?: any;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: User;
  requiresMfa?: boolean;
  mfaSessionToken?: string;
}

export const authApiDirect = {
  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    const response = await fetch('http://localhost:3001/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });

    if (!response.ok) {
      throw new Error(`Login failed: ${response.status}`);
    }

    const data = await response.json();
    
    // Handle ServiceResponse wrapper format
    if (data.success && data.data) {
      return {
        access_token: data.data.accessToken,
        refresh_token: data.data.refreshToken,
        token_type: data.data.tokenType || 'Bearer',
        expires_in: data.data.expiresIn || 1800,
        user: data.data.user,
        requiresMfa: data.data.requiresMfa,
        mfaSessionToken: data.data.mfaSessionToken,
      };
    }
    
    throw new Error('Invalid response format');
  },

  async refreshToken(refreshToken: string): Promise<any> {
    const response = await fetch('http://localhost:3001/api/v1/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.success && data.data) {
      return {
        access_token: data.data.accessToken,
        refresh_token: data.data.refreshToken,
        token_type: data.data.tokenType || 'Bearer',
        expires_in: data.data.expiresIn || 1800,
      };
    }
    
    throw new Error('Invalid refresh response format');
  }
};