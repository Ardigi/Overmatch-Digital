import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { userType } = await request.json();

    // Create mock user based on type
    const mockUser =
      userType === 'client'
        ? {
            id: 'dev-client-123',
            email: 'john.smith@acmecorp.com',
            name: 'John Smith',
            role: 'client',
            clientId: 'client-456',
            companyName: 'Acme Corporation',
          }
        : {
            id: 'dev-team-123',
            email: 'sarah.johnson@overmatchdigital.com',
            name: 'Sarah Johnson',
            role: 'team',
            permissions: ['all'],
          };

    // Create a simple dev session cookie
    const devSession = {
      user: mockUser,
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
    };

    // Set the dev session cookie
    const cookieStore = await cookies();
    cookieStore.set({
      name: 'dev-session',
      value: JSON.stringify(devSession),
      httpOnly: true,
      sameSite: 'lax',
      secure: false, // Allow in dev
      path: '/',
      maxAge: 24 * 60 * 60, // 24 hours
    });

    return NextResponse.json({
      success: true,
      user: mockUser,
      message: 'Dev login successful',
    });
  } catch (error) {
    console.error('Dev bypass error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
