import { getSession, signIn } from 'next-auth/react';

interface TokenRefreshResult {
  success: boolean;
  accessToken?: string;
  error?: string;
}

class TokenManager {
  private refreshPromise: Promise<TokenRefreshResult> | null = null;
  private tokenExpiryBuffer = 5 * 60 * 1000; // 5 minutes buffer

  /**
   * Check if token needs refresh
   */
  private needsRefresh(expiresAt?: number): boolean {
    if (!expiresAt) return false;
    const now = Date.now();
    return now >= expiresAt - this.tokenExpiryBuffer;
  }

  /**
   * Parse JWT to get expiry
   */
  private getTokenExpiry(token: string): number | null {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp ? payload.exp * 1000 : null;
    } catch {
      return null;
    }
  }

  /**
   * Get valid access token, refreshing if necessary
   */
  async getAccessToken(): Promise<string | null> {
    const session = await getSession();

    if (!session?.accessToken || !session?.refreshToken) {
      return null;
    }

    const tokenExpiry = this.getTokenExpiry(session.accessToken);

    // If token doesn't need refresh, return it
    if (!tokenExpiry || !this.needsRefresh(tokenExpiry)) {
      return session.accessToken;
    }

    // If already refreshing, wait for that to complete
    if (this.refreshPromise) {
      const result = await this.refreshPromise;
      return result.success ? result.accessToken || null : null;
    }

    // Start refresh process
    this.refreshPromise = this.refreshAccessToken(session.refreshToken);
    const result = await this.refreshPromise;
    this.refreshPromise = null;

    return result.success ? result.accessToken || null : null;
  }

  /**
   * Refresh the access token
   */
  private async refreshAccessToken(refreshToken: string): Promise<TokenRefreshResult> {
    try {
      // Direct fetch to avoid circular dependency
      const response = await fetch('http://localhost:3001/api/v1/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (!response.ok) {
        throw new Error(`Token refresh failed: ${response.status}`);
      }

      const data = await response.json();
      const tokens = data.success && data.data ? {
        access_token: data.data.accessToken,
        refresh_token: data.data.refreshToken,
      } : null;

      if (!tokens) {
        throw new Error('Invalid refresh response format');
      }

      // Update session with new tokens
      await signIn('credentials', {
        redirect: false,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
      });

      return {
        success: true,
        accessToken: tokens.access_token,
      };
    } catch (error) {
      console.error('Token refresh failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Token refresh failed',
      };
    }
  }

  /**
   * Clear stored tokens (for logout)
   */
  clearTokens(): void {
    // NextAuth handles this via signOut
    this.refreshPromise = null;
  }

  /**
   * Set up automatic token refresh
   */
  setupAutoRefresh(): void {
    // Check token every minute
    setInterval(async () => {
      const session = await getSession();
      if (session?.accessToken) {
        const tokenExpiry = this.getTokenExpiry(session.accessToken);
        if (tokenExpiry && this.needsRefresh(tokenExpiry)) {
          await this.getAccessToken();
        }
      }
    }, 60 * 1000); // 1 minute
  }
}

// Export singleton instance
export const tokenManager = new TokenManager();

// Set up auto-refresh when module loads (client-side only)
if (typeof window !== 'undefined') {
  tokenManager.setupAutoRefresh();
}
