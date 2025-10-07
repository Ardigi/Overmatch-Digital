import { cookies } from 'next/headers';
import { auth } from '@/lib/auth';
import ClientBillingView from './client-view';
import TeamBillingPage from './team-view';

export default async function BillingPageWrapper() {
  // Check for dev session first
  if (process.env.NODE_ENV === 'development') {
    const cookieStore = await cookies();
    const devSessionCookie = cookieStore.get('dev-session');

    if (devSessionCookie) {
      try {
        const devSession = JSON.parse(devSessionCookie.value);
        if (devSession.user?.role === 'client') {
          return <ClientBillingView />;
        }
      } catch (error) {
        console.error('Dev session parse error:', error);
      }
    }
  }

  // Regular auth flow
  const session = await auth();

  // Show client view for client role
  if (session?.user?.role === 'client') {
    return <ClientBillingView />;
  }

  // Show full billing management for team members
  return <TeamBillingPage />;
}
