import 'dotenv/config';
import Fastify from 'fastify';
import { checkDatabaseConnection, pool } from './db/pool.js';

const app = Fastify({
  logger: {
    level: process.env['LOG_LEVEL'] ?? 'info',
    redact: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.headers["set-cookie"]',
      'req.body.password',
      'req.body.token',
    ],
  },
  bodyLimit: 1_048_576,
  trustProxy: process.env['TRUST_PROXY'] === 'true',
});

app.get('/health', async () => ({
  status: 'ok',
  service: 'Dentaleus API',
  version: '0.1.0',
  timestamp: new Date().toISOString(),
}));

app.get('/health/ready', async (_request, reply) => {
  try {
    await checkDatabaseConnection();
    return { status: 'ok', database: 'connected' };
  } catch {
    return reply.code(503).send({
      status: 'unavailable',
      database: 'disconnected',
      error: {
        code: 'DATABASE_UNAVAILABLE',
        message: 'The database is not available.',
      },
    });
  }
});

app.setNotFoundHandler(async (_request, reply) => {
  return reply.code(404).send({
    error: { code: 'NOT_FOUND', message: 'Route not found.' },
  });
});

app.setErrorHandler((error, request, reply) => {
  request.log.error({ err: error }, 'Unhandled API error');
  return reply.code(error.statusCode && error.statusCode < 500 ? error.statusCode : 500)
    .send({
      error: {
        code: error.statusCode && error.statusCode < 500 ? 'REQUEST_ERROR' : 'INTERNAL_ERROR',
        message: error.statusCode && error.statusCode < 500
          ? error.message
          : 'An unexpected server error occurred.',
      },
    });
});

const port = Number(process.env['API_PORT'] ?? 4100);
const host = process.env['API_HOST'] ?? '0.0.0.0';

async function shutdown(signal: string): Promise<void> {
  app.log.info({ signal }, 'Shutting down Dentaleus API');
  try {
    await app.close();
    await pool.end();
    process.exit(0);
  } catch (error) {
    app.log.error({ err: error }, 'Graceful shutdown failed');
    process.exit(1);
  }
}

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));

try {
  await app.listen({ port, host });
} catch (error) {
  app.log.error({ err: error }, 'Unable to start Dentaleus API');
  await pool.end();
  process.exit(1);
}
