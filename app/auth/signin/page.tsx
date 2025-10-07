'use client';

import {
  BuildingOfficeIcon,
  ExclamationCircleIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import MfaVerification from '@/components/auth/MfaVerification';
import { LoadingButton } from '@/components/ui/LoadingSpinner';
import { useToast } from '@/contexts/ToastContext';

const signInSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type SignInFormData = z.infer<typeof signInSchema>;

export default function SignInPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';
  const [isLoading, setIsLoading] = useState(false);
  const [userType, setUserType] = useState<'client' | 'team'>('client');
  const [showMfa, setShowMfa] = useState(false);
  const [mfaUserId, setMfaUserId] = useState<string>('');
  const { showError, showSuccess } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors, touchedFields, isSubmitting, isValid },
  } = useForm<SignInFormData>({
    resolver: zodResolver(signInSchema),
    mode: 'onBlur', // Validate on blur for better UX
    reValidateMode: 'onChange', // Re-validate on change after error
  });

  // Debug form state only when there are changes
  // (Moved inside onSubmit to avoid infinite render loop)

  const onSubmit = async (data: SignInFormData) => {
    console.log('=== Form onSubmit called ===');
    console.log('Form data:', { email: data.email, passwordLength: data.password?.length });
    console.log('Form state at submission:', { 
      errors: Object.keys(errors).length, 
      isSubmitting, 
      isValid,
      touchedFields: Object.keys(touchedFields)
    });
    
    try {
      setIsLoading(true);

      // Use NextAuth for authentication - single flow, SOC compliant
      const authResult = await signIn('credentials', {
        email: data.email,
        password: data.password,
        redirect: false,
      });

      if (authResult?.error) {
        // Handle specific error cases
        if (authResult.error === 'CredentialsSignin') {
          showError(
            'Invalid Credentials',
            'The email or password you entered is incorrect. Please check your credentials and try again.'
          );
        } else {
          throw new Error(authResult.error);
        }
      } else if (authResult?.ok) {
        showSuccess('Welcome back!', 'You have successfully signed in.');
        router.push(callbackUrl);
      }
    } catch (error: any) {
      console.error('=== Sign in error ===');
      console.error('Error details:', {
        message: error?.message,
        status: error?.status,
        code: error?.code,
        stack: error?.stack
      });

      // Handle specific error cases
      if (error.status === 401) {
        showError(
          'Invalid Credentials',
          'The email or password you entered is incorrect. Please check your credentials and try again.'
        );
      } else if (error.status === 429) {
        showError(
          'Too Many Attempts',
          'You have made too many login attempts. Please try again later.'
        );
      } else if (error.status === 403) {
        showError(
          'Account Locked',
          'Your account has been locked for security reasons. Please contact support.'
        );
      } else {
        showError(
          'Connection Problem',
          'Unable to sign in at this time. Please check your internet connection and try again.'
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleMfaSuccess = async () => {
    // After MFA verification, complete the sign-in process
    setShowMfa(false);
    showSuccess('Authentication complete', 'Redirecting to your dashboard...');
    router.push(callbackUrl);
  };

  const handleMfaCancel = () => {
    setShowMfa(false);
    setMfaUserId('');
  };

  const handleOAuthSignIn = (provider: string) => {
    setIsLoading(true);
    signIn(provider, { callbackUrl });
  };

  // Show MFA verification if needed
  if (showMfa) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-primary-50 via-white to-white py-12 px-4 sm:px-6 lg:px-8">
        <MfaVerification
          userId={mfaUserId}
          onSuccess={handleMfaSuccess}
          onCancel={handleMfaCancel}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-primary-50 via-white to-white py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <Link href="/" className="flex justify-center mb-6">
            <span className="text-3xl font-bold text-primary-700">Overmatch Digital</span>
          </Link>
          <h2 className="text-center text-2xl font-bold text-gray-900">Welcome back</h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Sign in to access your compliance portal
          </p>
        </div>

        {/* User Type Selector */}
        <div className="flex rounded-lg shadow-sm">
          <button
            type="button"
            onClick={() => setUserType('client')}
            className={`flex-1 py-3 px-4 inline-flex items-center justify-center gap-2 rounded-l-lg border text-sm font-medium transition-colors ${
              userType === 'client'
                ? 'bg-primary-600 text-white border-primary-600'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            <BuildingOfficeIcon className="h-5 w-5" />
            Client Portal
          </button>
          <button
            type="button"
            onClick={() => setUserType('team')}
            className={`flex-1 py-3 px-4 inline-flex items-center justify-center gap-2 rounded-r-lg border text-sm font-medium transition-colors ${
              userType === 'team'
                ? 'bg-primary-600 text-white border-primary-600'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            <UserGroupIcon className="h-5 w-5" />
            Team Login
          </button>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            {userType === 'client'
              ? 'Access your audit progress, documents, and compliance reports'
              : 'Internal team members: Access client management and audit tools'}
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email address
              </label>
              <div className="mt-1 relative">
                <input
                  {...register('email')}
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  className={`appearance-none relative block w-full px-3 py-2 border ${
                    errors.email ? 'border-red-300' : 'border-gray-300'
                  } placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-2 ${
                    errors.email
                      ? 'focus:ring-red-500 focus:border-red-500'
                      : 'focus:ring-primary-500 focus:border-primary-500'
                  } sm:text-sm transition-colors`}
                  placeholder="you@company.com"
                  aria-invalid={errors.email ? 'true' : 'false'}
                  aria-describedby={errors.email ? 'email-error' : undefined}
                />
                {errors.email && (
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <ExclamationCircleIcon className="h-5 w-5 text-red-500" aria-hidden="true" />
                  </div>
                )}
              </div>
              {errors.email && (
                <p className="mt-1 text-sm text-red-600" id="email-error" role="alert">
                  <span className="font-medium">Error:</span> {errors.email.message}
                </p>
              )}
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <div className="mt-1 relative">
                <input
                  {...register('password')}
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className={`appearance-none relative block w-full px-3 py-2 border ${
                    errors.password ? 'border-red-300' : 'border-gray-300'
                  } placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-2 ${
                    errors.password
                      ? 'focus:ring-red-500 focus:border-red-500'
                      : 'focus:ring-primary-500 focus:border-primary-500'
                  } sm:text-sm transition-colors`}
                  placeholder="••••••••"
                  aria-invalid={errors.password ? 'true' : 'false'}
                  aria-describedby={errors.password ? 'password-error' : undefined}
                />
                {errors.password && (
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <ExclamationCircleIcon className="h-5 w-5 text-red-500" aria-hidden="true" />
                  </div>
                )}
              </div>
              {errors.password && (
                <p className="mt-1 text-sm text-red-600" id="password-error" role="alert">
                  <span className="font-medium">Error:</span> {errors.password.message}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <input
                id="remember-me"
                name="remember-me"
                type="checkbox"
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
              <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900">
                Remember me
              </label>
            </div>

            <div className="text-sm">
              <Link
                href="/auth/forgot-password"
                className="font-medium text-primary-600 hover:text-primary-500"
              >
                Forgot your password?
              </Link>
            </div>
          </div>

          <div>
            <LoadingButton
              type="submit"
              loading={isLoading}
              className="w-full btn-primary text-center"
            >
              Sign in to {userType === 'client' ? 'Client Portal' : 'Team Dashboard'}
            </LoadingButton>
          </div>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-gray-50 text-gray-500">Or continue with</span>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleOAuthSignIn('google')}
                disabled={isLoading}
                className="w-full inline-flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                <span className="ml-2">Google</span>
              </button>

              <button
                type="button"
                onClick={() => handleOAuthSignIn('azure-ad')}
                disabled={isLoading}
                className="w-full inline-flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-5 h-5" viewBox="0 0 23 23">
                  <path fill="#f3f3f3" d="M0 0h23v23H0z" />
                  <path fill="#f35325" d="M1 1h10v10H1z" />
                  <path fill="#81bc06" d="M12 1h10v10H12z" />
                  <path fill="#05a6f0" d="M1 12h10v10H1z" />
                  <path fill="#ffba08" d="M12 12h10v10H12z" />
                </svg>
                <span className="ml-2">Microsoft</span>
              </button>
            </div>
          </div>
        </form>

        <div className="text-center text-sm">
          <span className="text-gray-600">
            {userType === 'client' ? "Don't have an account? " : 'Need client access? '}
          </span>
          <Link href="/contact" className="font-medium text-primary-600 hover:text-primary-500">
            {userType === 'client' ? 'Contact us for access' : 'Request client portal access'}
          </Link>
        </div>
      </div>
    </div>
  );
}
