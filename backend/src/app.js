import crypto from 'node:crypto';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { Prisma } from '@prisma/client';
import { prisma } from './lib/prisma.js';
import { loadUser } from './middleware/auth.js';
import authRouter from './routes/auth.js';
import productsRouter from './routes/products.js';
import ordersRouter from './routes/orders.js';
import assistantRouter from './routes/assistant.js';

function isDatabaseUnavailable(error) {
  return error instanceof Prisma.PrismaClientInitializationError
    || (error instanceof Prisma.PrismaClientKnownRequestError && ['P1001', 'P1002', 'P1008', 'P1017', 'P2024'].includes(error.code));
}

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  // Behind Nginx on EC2: trust one proxy hop so rate limiting and logs see the real client IP.
  if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);
  app.use(helmet());
  const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173').split(',').map((origin) => origin.trim());
  app.use(cors({ origin: allowedOrigins, credentials: true }));
  app.use(express.json({ limit: '100kb' }));
  app.use((request, response, next) => { request.id = crypto.randomUUID(); response.setHeader('X-Request-ID', request.id); next(); });
  // Logs method, path, status and timing only: no bodies, cookies or headers (no secrets in logs).
  morgan.token('id', (request) => request.id);
  app.use(morgan(':date[iso] :id :method :url :status :response-time ms'));

  // Health checks the database too, so a green health result means the API can read PostgreSQL.
  app.get('/api/health', async (_request, response) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      response.json({ status: 'ok', database: 'ok', version: process.env.APP_VERSION || 'dev' });
    } catch {
      response.status(503).json({ status: 'degraded', database: 'unavailable', version: process.env.APP_VERSION || 'dev' });
    }
  });
  app.use('/api', loadUser);
  app.use('/api/auth', authRouter);
  app.use('/api/products', productsRouter);
  app.use('/api/orders', ordersRouter);
  app.use('/api/assistant', assistantRouter);
  app.use((_request, response) => response.status(404).json({ error: { code: 'ROUTE_NOT_FOUND', message: 'API route could not be found.' } }));
  app.use((error, request, response, _next) => {
    if (isDatabaseUnavailable(error)) {
      console.error(`[${request.id}] database unavailable: ${error.code || error.name}`);
      return response.status(503).json({ error: { code: 'DATABASE_UNAVAILABLE', message: 'The store database is temporarily unavailable. Please try again shortly.', traceId: request.id } });
    }
    console.error(`[${request.id}]`, error);
    response.status(error.status || 500).json({ error: { code: error.code || 'INTERNAL_ERROR', message: error.status ? error.message : 'The server could not complete the request.', traceId: request.id } });
  });
  return app;
}
