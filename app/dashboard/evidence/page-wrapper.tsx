import { cookies } from 'next/headers';
import { auth } from '@/lib/auth';
import ClientEvidenceView from './client-view';
import TeamEvidencePage from './team-view';

export default async function EvidencePageWrapper() {
  // Check for dev session first
  if (process.env.NODE_ENV === 'development') {
    const cookieStore = await cookies();
    const devSessionCookie = cookieStore.get('dev-session');

    if (devSessionCookie) {
      try {
        const devSession = JSON.parse(devSessionCookie.value);
        // For evidence, we want clients to have the upload interface
        if (devSession.user?.role === 'client') {
          return <ClientEvidenceView />;
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
    return <ClientEvidenceView />;
  }

  // Show team view with approval capabilities for team members
  return <TeamEvidencePage />;
}
