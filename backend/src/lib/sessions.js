import crypto from 'node:crypto';

export const SESSION_COOKIE = 'shopsmart_session';
export const SESSION_TTL_MS = 1000 * 60 * 60 * 8; // 8 hours

// The browser keeps a random token; the database keeps only its SHA-256 hash,
// so a leaked Session table cannot be replayed as cookies.
export function createSessionToken() {
  return crypto.randomBytes(32).toString('base64url');
}

export function hashSessionToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function readCookie(request, name) {
  const header = request.headers.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    if (part.slice(0, index).trim() === name) {
      try { return decodeURIComponent(part.slice(index + 1).trim()); } catch { return null; }
    }
  }
  return null;
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    // COOKIE_SECURE=true on the HTTPS deployment; false only for local http://localhost development.
    secure: process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_MS
  };
}
