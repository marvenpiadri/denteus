import 'dotenv/config';
import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import { fromNodeHeaders } from 'better-auth/node';
import { auth } from './auth/auth.js';
import { checkDatabaseConnection, pool } from './db/pool.js';
import { safeErrorLogFields } from './security/safe-error-log.js';
import { publicApiError } from './security/public-api-error.js';
import { isTrustedMutationOrigin } from './security/trusted-origin-policy.js';
import { organizationRoutes } from './routes/organizations.js';
import { patientRoutes } from './routes/patients.js';
import { odontogramRoutes } from './routes/odontograms.js';
import { onboardingRoutes } from './routes/onboarding.js';
import { appointmentRoutes } from './routes/appointments.js';
import { recallRoutes } from './routes/recalls.js';
import { schedulingResourceRoutes } from './routes/scheduling-resources.js';
import { clinicalEncounterRoutes } from './routes/clinical-encounters.js';
import { clinicalMediaRoutes } from './routes/clinical-media.js';
import { patientHistoryRoutes } from './routes/patient-history.js';
import { clinicSettingsRoutes } from './routes/clinic-settings.js';
import { reportRoutes } from './routes/reports.js';
import { teamRoutes } from './routes/team.js';
import { organizationTeamRoutes } from './routes/organization-team.js';
import { organizationInvitationRoutes } from './routes/organization-invitations.js';

const clientOrigins = (process.env['CLIENT_ORIGINS'] ?? 'http://localhost:3000')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const authBaseUrl = process.env['BETTER_AUTH_URL'];
if (!authBaseUrl) {
  throw new Error('BETTER_AUTH_URL must be configured explicitly.');
}

const app = Fastify({
  logger: {
    level: process.env['LOG_LEVEL'] ?? 'info',
    redact: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.headers["set-cookie"]',
      'req.body',
      'req.body.password',
      'req.body.token',
    ],
  },
  bodyLimit: 1_048_576,
  trustProxy: process.env['TRUST_PROXY'] === 'true',
});

await app.register(fastifyCors, {
  origin: clientOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  maxAge: 86_400,
});

// CORS controls which browser code may read a response; it does not stop a
// cross-site form from submitting a cookie-authenticated state change. Protect
// the application's mutation API with an exact Origin allowlist as well.
app.addHook('onRequest', async (request, reply) => {
  if (!request.url.startsWith('/api/v1/')) return;
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) return;
  if (!isTrustedMutationOrigin(request.headers.origin, clientOrigins)) {
    return reply.code(403).send({
      error: { code: 'UNTRUSTED_ORIGIN', message: 'This request origin is not allowed.' },
    });
  }
});

app.addHook('onSend', async (request, reply, payload) => {
  if (request.url.startsWith('/api/')) {
    reply.header('Cache-Control', 'private, no-store, max-age=0');
  }
  reply.header('X-Content-Type-Options', 'nosniff');
  reply.header('X-Frame-Options', 'DENY');
  reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  reply.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (process.env['NODE_ENV'] === 'production') {
    reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  return payload;
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

app.route({
  method: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  // Match auth endpoints without a named-wildcard parser pattern.
  url: /^\/api\/auth\/.*$/,
  async handler(request, reply) {
    try {
      const url = new URL(request.url, authBaseUrl);
      const headers = fromNodeHeaders(request.headers);
      headers.delete('content-length');
      headers.delete('transfer-encoding');
      const method = request.method.toUpperCase();
      const hasBody = !['GET', 'HEAD'].includes(method) && request.body !== undefined;
      const authRequest = new Request(url.toString(), {
        method,
        headers,
        ...(hasBody ? { body: JSON.stringify(request.body) } : {}),
      });
      const response = await auth.handler(authRequest);
      reply.status(response.status);
      const forwardedHeaders = ['content-type', 'cache-control', 'location', 'retry-after', 'www-authenticate', 'pragma', 'expires'];
      for (const name of forwardedHeaders) {
        const value = response.headers.get(name);
        if (value !== null) reply.header(name, value);
      }
      const authHeaders = response.headers as Headers & { getSetCookie?: () => string[] };
      const setCookies = authHeaders.getSetCookie?.() ?? [];
      if (setCookies.length) reply.header('set-cookie', setCookies);
      else {
        const setCookie = response.headers.get('set-cookie');
        if (setCookie) reply.header('set-cookie', setCookie);
      }
      return reply.send(response.body ? await response.text() : null);
    } catch (error) {
      request.log.error(safeErrorLogFields(error), 'Authentication handler failed');
      return reply.code(500).send({
        error: { code: 'AUTH_FAILURE', message: 'The authentication request could not be completed.' },
      });
    }
  },
});

app.get('/api/v1/session', async (request, reply) => {
  const result = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
  if (!result) return reply.code(401).send({ error: { code: 'UNAUTHENTICATED', message: 'Authentication is required.' } });
  return {
    user: { id: result.user.id, name: result.user.name, email: result.user.email, emailVerified: result.user.emailVerified, image: result.user.image },
    session: { expiresAt: result.session.expiresAt },
  };
});

await app.register(organizationRoutes, { prefix: '/api/v1' });
await app.register(onboardingRoutes, { prefix: '/api/v1' });
await app.register(patientRoutes, { prefix: '/api/v1' });
await app.register(odontogramRoutes, { prefix: '/api/v1' });
await app.register(appointmentRoutes, { prefix: '/api/v1' });
await app.register(recallRoutes, { prefix: '/api/v1' });
await app.register(schedulingResourceRoutes, { prefix: '/api/v1' });
await app.register(clinicalEncounterRoutes, { prefix: '/api/v1' });
await app.register(clinicalMediaRoutes, { prefix: '/api/v1' });
await app.register(patientHistoryRoutes, { prefix: '/api/v1' });
await app.register(clinicSettingsRoutes, { prefix: '/api/v1' });
await app.register(reportRoutes, { prefix: '/api/v1' });
await app.register(teamRoutes, { prefix: '/api/v1' });
await app.register(organizationTeamRoutes, { prefix: '/api/v1' });
await app.register(organizationInvitationRoutes, { prefix: '/api/v1' });

app.setNotFoundHandler(async (_request, reply) => reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Route not found.' } }));
app.setErrorHandler((error, request, reply) => {
  request.log.error(safeErrorLogFields(error), 'Unhandled API error');
  const response = publicApiError(error);
  return reply.code(response.statusCode).send(response.body);
});

const port = Number(process.env['API_PORT'] ?? 4100);
const host = process.env['API_HOST'] ?? '0.0.0.0';
if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error('API_PORT must be an integer between 1 and 65535.');
}

async function shutdown(signal: string): Promise<void> {
  app.log.info({ signal }, 'Shutting down Dentaleus API');
  try { await app.close(); await pool.end(); process.exit(0); }
  catch (error) { app.log.error(safeErrorLogFields(error), 'Graceful shutdown failed'); process.exit(1); }
}
process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));

try { await app.listen({ port, host }); }
catch (error) { app.log.error(safeErrorLogFields(error), 'Unable to start Dentaleus API'); await pool.end(); process.exit(1); }
