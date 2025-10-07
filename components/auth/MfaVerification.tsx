'use client';

import { ExclamationCircleIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { LoadingButton } from '@/components/ui/LoadingSpinner';
import { useToast } from '@/contexts/ToastContext';

const mfaSchema = z.object({
  token: z
    .string()
    .length(6, 'Code must be 6 digits')
    .regex(/^\d+$/, 'Code must contain only numbers'),
});

type MfaFormData = z.infer<typeof mfaSchema>;

interface MfaVerificationProps {
  userId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function MfaVerification({ userId, onSuccess, onCancel }: MfaVerificationProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [useBackupCode, setUseBackupCode] = useState(false);
  const { showError, showSuccess } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
  } = useForm<MfaFormData>({
    resolver: zodResolver(mfaSchema),
  });

  const onSubmit = async (data: MfaFormData) => {
    try {
      setIsLoading(true);

      // This will use the auth API to verify MFA
      const response = await fetch('/api/auth/mfa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          token: data.token,
          isBackupCode: useBackupCode,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Invalid code');
      }

      showSuccess('Verification successful', 'You have been authenticated');
      onSuccess();
    } catch (error) {
      showError(
        'Verification Failed',
        error instanceof Error
          ? error.message
          : 'The code you entered is invalid. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleCodeInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
    setValue('token', value);
  };

  return (
    <div className="max-w-md w-full space-y-8">
      <div>
        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-primary-100">
          <ShieldCheckIcon className="h-6 w-6 text-primary-600" />
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Two-Factor Authentication
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          {useBackupCode
            ? 'Enter one of your backup codes'
            : 'Enter the 6-digit code from your authenticator app'}
        </p>
      </div>

      <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
        <div>
          <label htmlFor="token" className="block text-sm font-medium text-gray-700">
            {useBackupCode ? 'Backup Code' : 'Verification Code'}
          </label>
          <div className="mt-1 relative">
            <input
              {...register('token')}
              id="token"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="one-time-code"
              required
              onChange={handleCodeInput}
              className={`appearance-none relative block w-full px-3 py-4 text-center text-2xl tracking-widest border ${
                errors.token ? 'border-red-300' : 'border-gray-300'
              } placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-2 ${
                errors.token
                  ? 'focus:ring-red-500 focus:border-red-500'
                  : 'focus:ring-primary-500 focus:border-primary-500'
              } sm:text-xl transition-colors`}
              placeholder="000000"
              maxLength={6}
              aria-invalid={errors.token ? 'true' : 'false'}
              aria-describedby={errors.token ? 'token-error' : undefined}
            />
            {errors.token && (
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <ExclamationCircleIcon className="h-5 w-5 text-red-500" aria-hidden="true" />
              </div>
            )}
          </div>
          {errors.token && (
            <p className="mt-1 text-sm text-red-600" id="token-error" role="alert">
              <span className="font-medium">Error:</span> {errors.token.message}
            </p>
          )}
        </div>

        <div className="space-y-4">
          <LoadingButton
            type="submit"
            loading={isLoading}
            className="w-full btn-primary text-center"
          >
            Verify
          </LoadingButton>

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setUseBackupCode(!useBackupCode)}
              className="text-sm text-primary-600 hover:text-primary-500"
            >
              {useBackupCode ? 'Use authenticator app' : 'Use backup code'}
            </button>

            <button
              type="button"
              onClick={onCancel}
              className="text-sm text-gray-600 hover:text-gray-500"
            >
              Cancel
            </button>
          </div>
        </div>
      </form>

      <div className="mt-4 text-center">
        <p className="text-xs text-gray-500">
          Having trouble?{' '}
          <a href="/contact" className="text-primary-600 hover:text-primary-500">
            Contact support
          </a>
        </p>
      </div>
    </div>
  );
}
