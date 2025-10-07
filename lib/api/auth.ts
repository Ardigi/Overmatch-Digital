import { API_PREFIXES, apiConfig } from './config';
import { authClient } from './service-clients';

export interface LoginCredentials {
  email: string;
  password: string;
  deviceFingerprint?: string;
  mfaToken?: string;
}

export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  organizationName?: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  organization?: {
    id: string;
    name: string;
    type: string;
  };
  roles: Array<{
    id: string;
    name: string;
  }>;
  permissions: string[];
  preferences?: any;
  mfaEnabled: boolean;
}

export interface LoginResponse extends AuthTokens {
  user: User;
  requiresMfa?: boolean;
  mfaSessionToken?: string;
}

export interface MfaEnableResponse {
  secret: string;
  qrCode: string;
  backupCodes: string[];
}

export const authApi = {
  // Authentication
  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    const endpoint = apiConfig.useKong ? '/login' : '/login';
    const response = await authClient.post<any>(endpoint, credentials, {
      skipAuth: true,
    });
    
    // Map backend response format to frontend expected format
    // Backend returns: { accessToken, refreshToken, user, ... }
    // Frontend expects: { access_token, refresh_token, user, ... }
    const data = response.data;
    
    return {
      access_token: data.accessToken,
      refresh_token: data.refreshToken,
      token_type: data.tokenType || 'Bearer',
      expires_in: data.expiresIn || 1800,
      user: data.user,
      requiresMfa: data.requiresMfa,
      mfaSessionToken: data.mfaSessionToken,
    };
  },

  async register(data: RegisterData): Promise<{ user: User }> {
    const endpoint = apiConfig.useKong ? '/register' : '/register';
    const response = await authClient.post<{ user: User }>(endpoint, data, { skipAuth: true });
    return response.data;
  },

  async logout(): Promise<void> {
    const endpoint = apiConfig.useKong ? '/logout' : '/logout';
    await authClient.post(endpoint);
  },

  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    const endpoint = apiConfig.useKong ? '/refresh' : '/refresh';
    const response = await authClient.post<any>(
      endpoint,
      { refresh_token: refreshToken },
      { skipAuth: true }
    );
    
    // Map backend response format to frontend expected format
    const data = response.data;
    
    return {
      access_token: data.accessToken,
      refresh_token: data.refreshToken,
      token_type: data.tokenType || 'Bearer',
      expires_in: data.expiresIn || 1800,
    };
  },

  // User Profile
  async getProfile(): Promise<User> {
    const endpoint = apiConfig.useKong ? '/api/auth/auth/profile' : '/auth/profile';
    const response = await authClient.get<User>(endpoint);
    return response.data;
  },

  async updateProfile(data: Partial<User>): Promise<User> {
    const endpoint = apiConfig.useKong ? '/api/auth/auth/profile' : '/auth/profile';
    const response = await authClient.patch<User>(endpoint, data);
    return response.data;
  },

  // Password Management
  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    const endpoint = apiConfig.useKong ? '/api/auth/auth/change-password' : '/auth/change-password';
    await authClient.post(endpoint, { currentPassword, newPassword });
  },

  async forgotPassword(email: string): Promise<void> {
    const endpoint = apiConfig.useKong ? '/api/auth/auth/forgot-password' : '/auth/forgot-password';
    await authClient.post(endpoint, { email }, { skipAuth: true });
  },

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const endpoint = apiConfig.useKong ? '/api/auth/auth/reset-password' : '/auth/reset-password';
    await authClient.post(endpoint, { token, newPassword }, { skipAuth: true });
  },

  // Email Verification
  async verifyEmail(token: string): Promise<void> {
    const endpoint = apiConfig.useKong ? '/api/auth/auth/verify-email' : '/auth/verify-email';
    await authClient.post(endpoint, { token }, { skipAuth: true });
  },

  async resendVerification(): Promise<void> {
    const endpoint = apiConfig.useKong
      ? '/api/auth/auth/resend-verification'
      : '/auth/resend-verification';
    await authClient.post(endpoint);
  },

  // MFA
  async enableMfa(): Promise<MfaEnableResponse> {
    const endpoint = apiConfig.useKong ? `${API_PREFIXES.AUTH}/mfa/enable` : '/mfa/enable';
    const response = await authClient.post<MfaEnableResponse>(endpoint);
    return response.data;
  },

  async confirmMfa(token: string): Promise<{ backupCodes: string[] }> {
    const endpoint = apiConfig.useKong ? `${API_PREFIXES.AUTH}/mfa/confirm` : '/mfa/confirm';
    const response = await authClient.post<{ backupCodes: string[] }>(endpoint, { token });
    return response.data;
  },

  async disableMfa(token: string): Promise<void> {
    const endpoint = apiConfig.useKong ? `${API_PREFIXES.AUTH}/mfa/disable` : '/mfa/disable';
    await authClient.post(endpoint, { token });
  },

  async verifyMfa(userId: string, token: string): Promise<void> {
    const endpoint = apiConfig.useKong ? `${API_PREFIXES.AUTH}/mfa/verify` : '/mfa/verify';
    await authClient.post(endpoint, { userId, token });
  },

  async regenerateBackupCodes(token: string): Promise<{ backupCodes: string[] }> {
    const endpoint = apiConfig.useKong
      ? `${API_PREFIXES.AUTH}/mfa/backup-codes/regenerate`
      : '/mfa/backup-codes/regenerate';
    const response = await authClient.post<{ backupCodes: string[] }>(endpoint, { token });
    return response.data;
  },

  // Sessions Management
  async getSessions(): Promise<any[]> {
    const endpoint = apiConfig.useKong ? `${API_PREFIXES.AUTH}/sessions` : '/sessions';
    const response = await authClient.get<any[]>(endpoint);
    return response.data;
  },

  async revokeSession(sessionId: string): Promise<void> {
    const endpoint = apiConfig.useKong
      ? `${API_PREFIXES.AUTH}/sessions/${sessionId}/revoke`
      : `/sessions/${sessionId}/revoke`;
    await authClient.post(endpoint);
  },

  async revokeAllSessions(): Promise<void> {
    const endpoint = apiConfig.useKong
      ? `${API_PREFIXES.AUTH}/sessions/revoke-all`
      : '/sessions/revoke-all';
    await authClient.post(endpoint);
  },

  // API Keys
  async getApiKeys(): Promise<any[]> {
    const endpoint = apiConfig.useKong ? `${API_PREFIXES.AUTH}/api-keys` : '/api-keys';
    const response = await authClient.get<any[]>(endpoint);
    return response.data;
  },

  async createApiKey(data: {
    name: string;
    description?: string;
    scopes?: string[];
    expiresIn?: number;
  }): Promise<{ apiKey: any; plainKey: string }> {
    const endpoint = apiConfig.useKong ? `${API_PREFIXES.AUTH}/api-keys` : '/api-keys';
    const response = await authClient.post<{ apiKey: any; plainKey: string }>(endpoint, data);
    return response.data;
  },

  async revokeApiKey(keyId: string, reason?: string): Promise<void> {
    const endpoint = apiConfig.useKong
      ? `${API_PREFIXES.AUTH}/api-keys/${keyId}`
      : `/api-keys/${keyId}`;
    await authClient.delete(endpoint, { headers: { 'Content-Type': 'application/json' } });
  },

  // Device Trust
  async trustDevice(deviceFingerprint: string): Promise<void> {
    const endpoint = apiConfig.useKong
      ? `${API_PREFIXES.AUTH}/security/trust-device`
      : '/security/trust-device';
    await authClient.post(endpoint, { deviceFingerprint });
  },

  async getDevices(): Promise<any[]> {
    const endpoint = apiConfig.useKong
      ? `${API_PREFIXES.AUTH}/sessions/devices`
      : '/sessions/devices';
    const response = await authClient.get<any[]>(endpoint);
    return response.data;
  },

  async removeDevice(fingerprint: string): Promise<void> {
    const endpoint = apiConfig.useKong
      ? `${API_PREFIXES.AUTH}/sessions/devices/${fingerprint}`
      : `/sessions/devices/${fingerprint}`;
    await authClient.delete(endpoint);
  },

  // SSO Providers
  async getSsoProviders(): Promise<any[]> {
    const endpoint = apiConfig.useKong ? `${API_PREFIXES.AUTH}/sso/providers` : '/sso/providers';
    const response = await authClient.get<any[]>(endpoint);
    return response.data;
  },

  async initiateSso(providerId: string): Promise<{ authUrl: string }> {
    const endpoint = apiConfig.useKong
      ? `${API_PREFIXES.AUTH}/sso/saml/${providerId}`
      : `/sso/saml/${providerId}`;
    const response = await authClient.get<{ authUrl: string }>(endpoint);
    return response.data;
  },
};
