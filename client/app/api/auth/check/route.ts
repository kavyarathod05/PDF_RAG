import { verifyToken } from '@clerk/clerk-sdk-node';
import { NextResponse, NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Extract the session token from cookies (Clerk typically stores it as `__session`)
    const sessionToken = request.cookies.get('__session')?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized: No session token found' }, { status: 401 });
    }

    // Verify the session token using Clerk's Node SDK
    const session = await verifyToken(sessionToken, {
        secretKey: process.env.CLERK_SECRET_KEY,
        issuer: null
    });

    // If verification succeeds, the session object will contain the userId
    const userId = session.sub; // `sub` is the user ID in Clerk's JWT

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized: Invalid session' }, { status: 401 });
    }

    return NextResponse.json({ userId });
  } catch (error) {
    console.error('Session verification error:', error);
    return NextResponse.json({ error: 'Unauthorized: Session verification failed' }, { status: 401 });
  }
}