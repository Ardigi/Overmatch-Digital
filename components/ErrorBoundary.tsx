'use client';

import { ArrowPathIcon, ExclamationTriangleIcon, HomeIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
          <div className="max-w-md w-full space-y-8">
            <div className="text-center">
              <ExclamationTriangleIcon className="mx-auto h-16 w-16 text-red-500" />
              <h1 className="mt-6 text-3xl font-bold text-gray-900">Something went wrong</h1>
              <p className="mt-2 text-sm text-gray-600">
                We encountered an unexpected error. Don't worry, your data is safe.
              </p>

              {/* Error details for debugging (only in development) */}
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <div className="mt-4 p-4 bg-red-50 rounded-lg">
                  <p className="text-xs text-red-800 font-mono">{this.state.error.message}</p>
                </div>
              )}

              <div className="mt-8 space-y-4">
                <button
                  onClick={this.handleReset}
                  className="w-full flex items-center justify-center px-4 py-3 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                >
                  <ArrowPathIcon className="w-5 h-5 mr-2" />
                  Try Again
                </button>

                <Link
                  href="/dashboard"
                  className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 rounded-md shadow-sm text-base font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                >
                  <HomeIcon className="w-5 h-5 mr-2" />
                  Go to Dashboard
                </Link>

                <p className="text-sm text-gray-500">
                  If this problem persists, please contact{' '}
                  <a
                    href="mailto:support@overmatch.digital"
                    className="text-primary-600 hover:text-primary-500"
                  >
                    support@overmatch.digital
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Specific error boundary for dashboard sections
export function DashboardErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      fallback={
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-yellow-500 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Unable to load this section</h3>
          <p className="text-sm text-gray-600 mb-4">
            There was a problem loading this part of the dashboard.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            <ArrowPathIcon className="w-4 h-4 mr-2" />
            Refresh
          </button>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
}
