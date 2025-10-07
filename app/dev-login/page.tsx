'use client';

import { BuildingOfficeIcon, ShieldCheckIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { LoadingButton } from '@/components/ui/LoadingSpinner';
import { useToast } from '@/contexts/ToastContext';

export default function DevLoginPage() {
  const router = useRouter();
  const { showSuccess, showError } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  // Note: This check happens at build time, not runtime
  // The page will be available in dev builds

  const handleDevLogin = async (userType: 'client' | 'team') => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/dev-bypass', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userType }),
      });

      const data = await response.json();

      if (response.ok) {
        showSuccess('Dev Login Successful', `Logged in as ${userType} user`);
        // Force a hard navigation to ensure session is picked up
        window.location.href = '/dashboard';
      } else {
        showError('Login Failed', data.error || 'Could not complete dev login');
      }
    } catch (error) {
      showError('Error', 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-primary-50 via-white to-white">
      <div className="max-w-md w-full space-y-8 p-8">
        <div className="text-center">
          <ShieldCheckIcon className="mx-auto h-12 w-12 text-primary-600" />
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">Development Login</h2>
          <p className="mt-2 text-sm text-gray-600">Quick access for testing and development</p>
          <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              ⚠️ This page is only available in development mode
            </p>
          </div>
        </div>

        <div className="mt-8 space-y-4">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <BuildingOfficeIcon className="h-8 w-8 text-primary-600 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Client Portal</h3>
            <p className="text-sm text-gray-600 mb-4">
              Access the client portal with a demo client account
            </p>
            <LoadingButton
              onClick={() => handleDevLogin('client')}
              loading={isLoading}
              className="w-full btn-primary"
            >
              Login as Client
            </LoadingButton>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <UserGroupIcon className="h-8 w-8 text-primary-600 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Team Dashboard</h3>
            <p className="text-sm text-gray-600 mb-4">
              Access the internal team dashboard with admin privileges
            </p>
            <LoadingButton
              onClick={() => handleDevLogin('team')}
              loading={isLoading}
              className="w-full btn-primary"
            >
              Login as Team Member
            </LoadingButton>
          </div>
        </div>

        <div className="mt-6 text-center">
          <a href="/auth/signin" className="text-sm text-primary-600 hover:text-primary-500">
            Go to regular login →
          </a>
        </div>
      </div>
    </div>
  );
}
