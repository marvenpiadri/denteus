import { betterAuth } from 'better-auth';
import { pool } from '../db/pool.js';

const configuredBaseUrl = process.env['BETTER_AUTH_URL'];
const secret = process.env['BETTER_AUTH_SECRET'];
const configuredOrigins = process.env['CLIENT_ORIGINS'];
if (!configuredOrigins && process.env['NODE_ENV'] === 'production') {
  throw new Error('CLIENT_ORIGINS must be configured in production.');
}
const trustedOrigins = (configuredOrigins ?? 'http://localhost:3000')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

if (process.env['NODE_ENV'] === 'production') {
  if (trustedOrigins.length === 0) {
    throw new Error('At least one CLIENT_ORIGINS HTTPS origin must be configured in production.');
  }
  let baseUrl: URL;
  try {
    baseUrl = new URL(configuredBaseUrl ?? '');
  } catch {
    throw new Error('BETTER_AUTH_URL must be a valid HTTPS URL in production.');
  }
  if (baseUrl.protocol !== 'https:' || baseUrl.username || baseUrl.password || baseUrl.pathname !== '/' || baseUrl.search || baseUrl.hash || baseUrl.origin !== configuredBaseUrl) {
    throw new Error('BETTER_AUTH_URL must be a canonical HTTPS origin without credentials, a path, query, or fragment in production.');
  }
  for (const origin of trustedOrigins) {
    let parsed: URL;
    try {
      parsed = new URL(origin);
    } catch {
      throw new Error('Every CLIENT_ORIGINS entry must be a valid HTTPS origin in production.');
    }
    if (parsed.protocol !== 'https:' || parsed.origin !== origin || parsed.pathname !== '/' || parsed.search || parsed.hash || parsed.username || parsed.password) {
      throw new Error('Every CLIENT_ORIGINS entry must be a canonical HTTPS origin without a path or credentials in production.');
    }
  }
}

if (!configuredBaseUrl) {
  throw new Error('BETTER_AUTH_URL must be configured explicitly.');
}
if (!secret || secret.length < 32) {
  throw new Error('BETTER_AUTH_SECRET must be configured with at least 32 characters.');
}

export const auth = betterAuth({
  appName: 'Dentaleus',
  baseURL: configuredBaseUrl,
  secret,
  database: pool,
  trustedOrigins,
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 12,
    maxPasswordLength: 128,
    revokeSessionsOnPasswordReset: true,
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 100,
    customRules: {
      '/sign-in/email': { window: 60, max: 5 },
      '/sign-up/email': { window: 3_600, max: 5 },
      '/request-password-reset': { window: 3_600, max: 5 },
    },
  },
  advanced: {
    useSecureCookies: process.env['NODE_ENV'] === 'production',
  },
  user: {
    modelName: 'app_users',
    fields: {
      emailVerified: 'email_verified',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  },
  session: {
    modelName: 'auth_sessions',
    fields: {
      userId: 'user_id',
      expiresAt: 'expires_at',
      ipAddress: 'ip_address',
      userAgent: 'user_agent',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  },
  account: {
    modelName: 'auth_accounts',
    fields: {
      accountId: 'account_id',
      providerId: 'provider_id',
      userId: 'user_id',
      accessToken: 'access_token',
      refreshToken: 'refresh_token',
      idToken: 'id_token',
      accessTokenExpiresAt: 'access_token_expires_at',
      refreshTokenExpiresAt: 'refresh_token_expires_at',
      password: 'password_hash',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  },
  verification: {
    modelName: 'auth_verifications',
    fields: {
      expiresAt: 'expires_at',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  },
});
