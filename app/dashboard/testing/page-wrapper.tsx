import { cookies } from 'next/headers';
import { auth } from '@/lib/auth';
import EnhancedTestingPage from './enhanced-page';

export default async function TestingPageWrapper() {
  // Check for dev session first
  if (process.env.NODE_ENV === 'development') {
    const cookieStore = await cookies();
    const devSessionCookie = cookieStore.get('dev-session');

    if (devSessionCookie) {
      try {
        const devSession = JSON.parse(devSessionCookie.value);
        // Team members get the enhanced testing features
        if (devSession.user?.role === 'team') {
          return <EnhancedTestingPage />;
        }
      } catch (error) {
        console.error('Dev session parse error:', error);
      }
    }
  }

  // Regular auth flow
  const session = await auth();

  // Show enhanced testing for team members
  if (session?.user?.role !== 'client') {
    return <EnhancedTestingPage />;
  }

  // Clients shouldn't see testing - redirect or show error
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Access Restricted</h1>
        <p className="mt-1 text-sm text-gray-600">
          This page is only available to audit team members.
        </p>
      </div>
    </div>
  );
}
