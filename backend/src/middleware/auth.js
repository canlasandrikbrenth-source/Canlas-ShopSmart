import { prisma } from '../lib/prisma.js';
import { SESSION_COOKIE, hashSessionToken, readCookie } from '../lib/sessions.js';

// Loads the signed-in ShopSmart customer (if any) onto request.user.
export async function loadUser(request, _response, next) {
  try {
    const token = readCookie(request, SESSION_COOKIE);
    if (!token) return next();
    const session = await prisma.session.findUnique({
      where: { id: hashSessionToken(token) },
      include: { user: { select: { id: true, email: true, name: true } } }
    });
    if (session && session.expiresAt > new Date()) {
      request.user = session.user;
      request.sessionId = session.id;
    }
    next();
  } catch (error) { next(error); }
}

export function requireUser(request, response, next) {
  if (!request.user) {
    return response.status(401).json({ error: { code: 'AUTH_REQUIRED', message: 'Sign in to continue.' } });
  }
  next();
}
