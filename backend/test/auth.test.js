import test from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword } from '../src/lib/passwords.js';
import { createSessionToken, hashSessionToken, readCookie, sessionCookieOptions } from '../src/lib/sessions.js';
import { orderAccess } from '../src/lib/authorization.js';
import { loginSchema, registerSchema } from '../src/validators/schemas.js';

test('password hash never contains the plain password and verifies correctly', async () => {
  const stored = await hashPassword('fictional-pass-123');
  assert.ok(!stored.includes('fictional-pass-123'));
  assert.equal(await verifyPassword('fictional-pass-123', stored), true);
  assert.equal(await verifyPassword('wrong-password', stored), false);
  assert.equal(await verifyPassword('anything', 'not-a-hash'), false);
});

test('session tokens are random and stored only as a hash', () => {
  const a = createSessionToken();
  const b = createSessionToken();
  assert.notEqual(a, b);
  assert.equal(hashSessionToken(a).length, 64);
  assert.notEqual(hashSessionToken(a), a);
});

test('readCookie finds the session cookie among others', () => {
  const request = { headers: { cookie: 'theme=dark; shopsmart_session=abc%2D123; other=1' } };
  assert.equal(readCookie(request, 'shopsmart_session'), 'abc-123');
  assert.equal(readCookie({ headers: {} }, 'shopsmart_session'), null);
});

test('session cookie is HttpOnly and Secure in production', () => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  const options = sessionCookieOptions();
  process.env.NODE_ENV = previous;
  assert.equal(options.httpOnly, true);
  assert.equal(options.secure, true);
  assert.equal(options.sameSite, 'lax');
});

test('order access: guest 401, other customer 403, owner 200, missing 404', () => {
  const order = { id: 7, userId: 1 };
  assert.equal(orderAccess(null, order), 401);
  assert.equal(orderAccess({ id: 2 }, order), 403);
  assert.equal(orderAccess({ id: 1 }, order), 200);
  assert.equal(orderAccess({ id: 1 }, null), 404);
  assert.equal(orderAccess({ id: 1 }, { id: 8, userId: null }), 403);
});

test('registration requires a valid email and an 8+ character password', () => {
  assert.equal(registerSchema.safeParse({ name: 'Test Customer', email: 'test@example.com', password: 'longenough' }).success, true);
  assert.equal(registerSchema.safeParse({ name: 'Test Customer', email: 'test@example.com', password: 'short' }).success, false);
  assert.equal(loginSchema.safeParse({ email: 'nope', password: 'x' }).success, false);
});
