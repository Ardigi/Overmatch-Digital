import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import DashboardWrapper from '@/components/dashboard/DashboardWrapper';

// Dev-only layout wrapper
export default async function DashboardLayoutDev({ children }: { children: React.ReactNode }) {
  // Check for dev session first
  if (process.env.NODE_ENV === 'development') {
    const devSessionCookie = cookies().get('dev-session');

    if (devSessionCookie) {
      try {
        const devSession = JSON.parse(devSessionCookie.value);
        if (devSession.user) {
          return (
            <div className="min-h-screen bg-gray-50">
              <DashboardWrapper user={devSession.user}>{children}</DashboardWrapper>
            </div>
          );
        }
      } catch (error) {
        console.error('Dev session parse error:', error);
      }
    }
  }

  // Fall back to regular auth
  redirect('/auth/signin');
}
