import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET() {
  const cookieStore = await cookies();
  const devSession = cookieStore.get('dev-session');

  if (devSession) {
    try {
      const session = JSON.parse(devSession.value);
      return NextResponse.json({
        hasDevSession: true,
        user: session.user,
        expires: session.expires,
      });
    } catch (error) {
      return NextResponse.json({
        hasDevSession: true,
        error: 'Failed to parse session',
        value: devSession.value,
      });
    }
  }

  return NextResponse.json({
    hasDevSession: false,
    cookies: cookieStore.getAll().map((c) => c.name),
  });
}
