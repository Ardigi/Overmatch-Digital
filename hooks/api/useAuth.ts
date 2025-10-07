import { useRouter } from 'next/navigation';
import { signIn, signOut, useSession } from 'next-auth/react';
import { useCallback } from 'react';
import { authApi, type LoginCredentials, type RegisterData, type User } from '@/lib/api/auth';
import { authApiDirect } from '@/lib/api/auth-direct';
import { useApi, useMutation } from '../useApi';

// Login mutation
export function useLogin(options?: any) {
  const router = useRouter();

  return useMutation(
    async (credentials: LoginCredentials) => {
      const response = await authApiDirect.login(credentials);

      // Handle MFA requirement
      if (response.requiresMfa) {
        // Store session token for MFA flow
        sessionStorage.setItem('mfa_session', response.mfaSessionToken || '');
        return response;
      }

      // Sign in with NextAuth
      await signIn('credentials', {
        redirect: false,
        accessToken: response.access_token,
        refreshToken: response.refresh_token,
        user: JSON.stringify(response.user),
      });

      return response;
    },
    {
      onSuccess: (data) => {
        if (!data.requiresMfa) {
          router.push('/dashboard');
        }
        options?.onSuccess?.(data);
      },
      ...options,
    }
  );
}

// Register mutation
export function useRegister(options?: any) {
  const router = useRouter();

  return useMutation((data: RegisterData) => authApi.register(data), {
    onSuccess: () => {
      router.push('/auth/verify-email');
      options?.onSuccess?.();
    },
    ...options,
  });
}

// Logout mutation
export function useLogout(options?: any) {
  const router = useRouter();

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
      await signOut({ redirect: false });
      router.push('/auth/signin');
      options?.onSuccess?.();
    } catch (error) {
      console.error('Logout error:', error);
      options?.onError?.(error);
    }
  }, [router, options]);

  return { logout };
}

// Get current user profile
export function useProfile(options?: any) {
  const { data: session } = useSession();

  return useApi(() => authApi.getProfile(), [session], {
    immediate: !!session,
    ...options,
  });
}

// Update profile mutation
export function useUpdateProfile(options?: any) {
  return useMutation((data: Partial<User>) => authApi.updateProfile(data), options);
}

// Change password mutation
export function useChangePassword(options?: any) {
  return useMutation(
    ({ currentPassword, newPassword }: { currentPassword: string; newPassword: string }) =>
      authApi.changePassword(currentPassword, newPassword),
    options
  );
}

// Forgot password mutation
export function useForgotPassword(options?: any) {
  return useMutation((email: string) => authApi.forgotPassword(email), options);
}

// Reset password mutation
export function useResetPassword(options?: any) {
  const router = useRouter();

  return useMutation(
    ({ token, newPassword }: { token: string; newPassword: string }) =>
      authApi.resetPassword(token, newPassword),
    {
      onSuccess: () => {
        router.push('/auth/signin?reset=success');
        options?.onSuccess?.();
      },
      ...options,
    }
  );
}

// Email verification
export function useVerifyEmail(options?: any) {
  return useMutation((token: string) => authApi.verifyEmail(token), options);
}

export function useResendVerification(options?: any) {
  return useMutation(() => authApi.resendVerification(), options);
}

// MFA hooks
export function useEnableMfa(options?: any) {
  return useMutation(() => authApi.enableMfa(), options);
}

export function useConfirmMfa(options?: any) {
  return useMutation((token: string) => authApi.confirmMfa(token), options);
}

export function useDisableMfa(options?: any) {
  return useMutation((token: string) => authApi.disableMfa(token), options);
}

export function useVerifyMfa(options?: any) {
  const router = useRouter();

  return useMutation(
    ({ userId, token }: { userId: string; token: string }) => authApi.verifyMfa(userId, token),
    {
      onSuccess: async () => {
        // Get stored session token
        const mfaSession = sessionStorage.getItem('mfa_session');
        if (mfaSession) {
          // Complete login flow
          sessionStorage.removeItem('mfa_session');
          router.push('/dashboard');
        }
        options?.onSuccess?.();
      },
      ...options,
    }
  );
}

// Sessions management
export function useSessions(options?: any) {
  return useApi(() => authApi.getSessions(), [], { immediate: true, ...options });
}

export function useRevokeSession(options?: any) {
  return useMutation((sessionId: string) => authApi.revokeSession(sessionId), options);
}

export function useRevokeAllSessions(options?: any) {
  return useMutation(() => authApi.revokeAllSessions(), options);
}

// API Keys management
export function useApiKeys(options?: any) {
  return useApi(() => authApi.getApiKeys(), [], { immediate: true, ...options });
}

export function useCreateApiKey(options?: any) {
  return useMutation(
    (data: Parameters<typeof authApi.createApiKey>[0]) => authApi.createApiKey(data),
    options
  );
}

export function useRevokeApiKey(options?: any) {
  return useMutation(
    ({ keyId, reason }: { keyId: string; reason?: string }) => authApi.revokeApiKey(keyId, reason),
    options
  );
}

// Device management
export function useTrustDevice(options?: any) {
  return useMutation(
    (deviceFingerprint: string) => authApi.trustDevice(deviceFingerprint),
    options
  );
}

export function useDevices(options?: any) {
  return useApi(() => authApi.getDevices(), [], { immediate: true, ...options });
}

export function useRemoveDevice(options?: any) {
  return useMutation((fingerprint: string) => authApi.removeDevice(fingerprint), options);
}

// SSO
export function useSsoProviders(options?: any) {
  return useApi(() => authApi.getSsoProviders(), [], { immediate: true, ...options });
}

export function useInitiateSso() {
  const initiateSso = useCallback(async (providerId: string) => {
    try {
      const { authUrl } = await authApi.initiateSso(providerId);
      window.location.href = authUrl;
    } catch (error) {
      console.error('SSO initiation failed:', error);
      throw error;
    }
  }, []);

  return { initiateSso };
}
