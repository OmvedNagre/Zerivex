import { z } from 'zod';

/**
 * Zerivex Environment Configuration Schema
 * Fails closed if security-critical variables are missing or insecure.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.string().regex(/^\d+$/).transform(Number).default('3000'),
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),

  // Canonical Database URL (PostgreSQL)
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required for PostgreSQL persistence'),
  DATABASE_DIRECT_URL: z.string().optional(),

  // Security & Session Secret (Must be high-entropy, min 32 chars)
  SESSION_SECRET: z
    .string()
    .min(32, 'SESSION_SECRET must be at least 32 characters (generate with `openssl rand -base64 32`)'),
  CSRF_SECRET: z.string().min(16).optional(),

  // One-time owner bootstrap email
  INITIAL_OWNER_EMAIL: z.string().email('INITIAL_OWNER_EMAIL must be a valid email address'),

  // OAuth Credentials (Required for live auth in Phase 2)
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),

  // Scanner Configuration & Bounds
  SCANNER_MAX_CONCURRENT_JOBS: z.string().transform(Number).default('5'),
  SCANNER_REQUEST_TIMEOUT_MS: z.string().transform(Number).default('15000'),
  SCANNER_MAX_RESPONSE_BYTES: z.string().transform(Number).default('10485760'), // 10MB
});

export type EnvConfig = z.infer<typeof envSchema>;

let validatedEnv: EnvConfig | null = null;

/**
 * Reset cached config for hermetic test execution.
 */
export function _resetConfigForTesting(): void {
  validatedEnv = null;
}

/**
 * Validate environment configuration.
 * Fails closed and throws a descriptive error if variables fail validation.
 * Never logs raw secret values.
 */
export function getEnvConfig(): EnvConfig {
  if (validatedEnv) {
    return validatedEnv;
  }

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const errorDetails = result.error.issues.map((issue) => ` - ${issue.path.join('.')}: ${issue.message}`).join('\n');
    const failureMessage = `[ZERIVEX FATAL] Security environment validation failed:\n${errorDetails}\nCheck .env.local and ensure required security keys are set.`;
    throw new Error(failureMessage);
  }

  validatedEnv = result.data;
  return validatedEnv;
}

/**
 * Helper to check if production prerequisites are met.
 */
export function validateProductionReadiness(): void {
  const env = getEnvConfig();
  if (env.NODE_ENV === 'production') {
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
      throw new Error('[ZERIVEX FATAL] Production deployment requires GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET');
    }
    if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
      throw new Error('[ZERIVEX FATAL] Production deployment requires GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET');
    }
    if (env.NEXT_PUBLIC_APP_URL.startsWith('http://')) {
      throw new Error('[ZERIVEX FATAL] Production NEXT_PUBLIC_APP_URL must use HTTPS');
    }
  }
}
