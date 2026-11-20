import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { hashPassword, verifyPassword } from '../lib/passwords.js';
import { SESSION_COOKIE, SESSION_TTL_MS, createSessionToken, hashSessionToken, sessionCookieOptions } from '../lib/sessions.js';
import { loginSchema, registerSchema } from '../validators/schemas.js';
import { requireUser } from '../middleware/auth.js';

const router = Router();
const authLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false });

async function startSession(response, userId) {
  const token = createSessionToken();
  await prisma.session.create({ data: { id: hashSessionToken(token), userId, expiresAt: new Date(Date.now() + SESSION_TTL_MS) } });
  response.cookie(SESSION_COOKIE, token, sessionCookieOptions());
}

router.post('/register', authLimiter, async (request, response, next) => {
  try {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) return response.status(422).json({ error: { code: 'INVALID_REGISTRATION', message: 'Enter a name, a valid email and a password of 8 to 72 characters.', details: parsed.error.flatten() } });
    const { name, email, password } = parsed.data;
    try {
      const user = await prisma.user.create({ data: { name, email: email.toLowerCase(), passwordHash: await hashPassword(password) }, select: { id: true, email: true, name: true } });
      await startSession(response, user.id);
      return response.status(201).json({ user });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return response.status(409).json({ error: { code: 'EMAIL_IN_USE', message: 'An account with that email already exists.' } });
      }
      throw error;
    }
  } catch (error) { next(error); }
});

router.post('/login', authLimiter, async (request, response, next) => {
  try {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) return response.status(422).json({ error: { code: 'INVALID_LOGIN', message: 'Enter your email and password.' } });
    const user = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
    const valid = user ? await verifyPassword(parsed.data.password, user.passwordHash) : false;
    if (!valid) return response.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Email or password is incorrect.' } });
    await startSession(response, user.id);
    return response.json({ user: { id: user.id, email: user.email, name: user.name } });
  } catch (error) { next(error); }
});

router.post('/logout', async (request, response, next) => {
  try {
    if (request.sessionId) await prisma.session.deleteMany({ where: { id: request.sessionId } });
    const options = sessionCookieOptions();
    delete options.maxAge;
    response.clearCookie(SESSION_COOKIE, options);
    return response.status(204).end();
  } catch (error) { next(error); }
});

router.get('/me', requireUser, (request, response) => response.json({ user: request.user }));

export default router;
