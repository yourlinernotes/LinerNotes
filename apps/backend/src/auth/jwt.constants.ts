/**
 * Centralised JWT configuration. The signing secret MUST be provided via the
 * environment; there is deliberately no insecure fallback. If it is missing the
 * application fails fast at boot rather than silently accepting a well-known key.
 */
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set');
  }
  return secret;
}

// Token binding claims. Overridable via env, with stable defaults so existing
// tokens issued by this app remain valid across restarts.
export const JWT_ISSUER = process.env.JWT_ISSUER || 'linernotes-api';
export const JWT_AUDIENCE = process.env.JWT_AUDIENCE || 'linernotes-clients';
