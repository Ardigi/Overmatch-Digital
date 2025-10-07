import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import DashboardWrapper from '@/components/dashboard/DashboardWrapper';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { auth } from '@/lib/auth';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Check for dev session first in development mode
  if (process.env.NODE_ENV === 'development') {
    const cookieStore = await cookies();
    const devSessionCookie = cookieStore.get('dev-session');

    if (devSessionCookie) {
      try {
        const devSession = JSON.parse(devSessionCookie.value);
        if (devSession.user) {
          return (
            <ErrorBoundary>
              <div className="min-h-screen bg-gray-50">
                <DashboardWrapper user={devSession.user}>{children}</DashboardWrapper>
              </div>
            </ErrorBoundary>
          );
        }
      } catch (error) {
        console.error('Dev session parse error:', error);
      }
    }
  }

  // Regular auth flow
  const session = await auth();

  if (!session) {
    redirect('/auth/signin');
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50">
        <DashboardWrapper user={session.user}>{children}</DashboardWrapper>
      </div>
    </ErrorBoundary>
  );
}
