/**
 * DEV-ONLY route: issues a signed NextAuth JWT session cookie for the Copilot
 * admin account when presented with the correct key header.
 *
 * This file is ONLY active in development. Any request received outside
 * development
 * returns 404, and the route is never bundled into the production build because
 * of the early `NODE_ENV` guard.
 */
import { NextRequest, NextResponse } from 'next/server';
import { encode } from 'next-auth/jwt';

const COPILOT_DEV_KEY = 'copilot-dev-admin-2026';
const COOKIE_NAME = 'next-auth.session-token';

export async function GET(request: NextRequest) {
  // Hard environment guard — this endpoint must only be reachable in development.
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  }

  const key = request.headers.get('x-copilot-dev-key');
  if (key !== COPILOT_DEV_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'NEXTAUTH_SECRET not configured' }, { status: 500 });
  }

  const now = Math.floor(Date.now() / 1000);

  // Build a JWT payload that matches what NextAuth's jwt() callback produces.
  // The `salt` must equal the cookie name (NextAuth v5 derives the encryption
  // key from HKDF(secret, salt)).
  const sessionToken = await encode({
    token: {
      sub: 'dev-copilot-admin',
      id: 'dev-copilot-admin',
      name: 'Copilot Admin',
      email: 'copilot@dev.local',
      picture: null,
      role: 'ADMIN',
      iat: now,
      exp: now + 86_400, // 24 h
      jti: 'copilot-dev-jti',
    },
    secret,
    salt: COOKIE_NAME,
  });

  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, sessionToken, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: false, // HTTP in dev
    maxAge: 86_400,
  });
  return response;
}
