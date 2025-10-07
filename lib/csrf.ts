import crypto from 'crypto';

// SECURITY: CSRF_SECRET must be set via environment variable or secrets manager in production
const CSRF_SECRET = (() => {
  const secret = process.env.CSRF_SECRET;
  if (!secret && process.env.NODE_ENV === 'production') {
    throw new Error('CSRF_SECRET environment variable is required in production');
  }
  if (!secret) {
    console.warn('WARNING: Using default CSRF secret for development only. Set CSRF_SECRET environment variable for production.');
  }
  return secret || 'development-only-csrf-secret-not-for-production';
})();
const TOKEN_LENGTH = 32;

export function generateCSRFToken(sessionId: string): string {
  const timestamp = Date.now();
  const data = `${sessionId}:${timestamp}`;
  const hmac = crypto.createHmac('sha256', CSRF_SECRET);
  hmac.update(data);
  const signature = hmac.digest('hex');

  return Buffer.from(`${data}:${signature}`).toString('base64');
}

export function validateCSRFToken(token: string | null): boolean {
  if (!token) return false;

  try {
    const decoded = Buffer.from(token, 'base64').toString();
    const parts = decoded.split(':');

    if (parts.length !== 3) return false;

    const [sessionId, timestamp, signature] = parts;

    // Check token age (max 1 hour)
    const tokenAge = Date.now() - parseInt(timestamp);
    if (tokenAge > 60 * 60 * 1000) return false;

    // Verify signature
    const data = `${sessionId}:${timestamp}`;
    const hmac = crypto.createHmac('sha256', CSRF_SECRET);
    hmac.update(data);
    const expectedSignature = hmac.digest('hex');

    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
  } catch {
    return false;
  }
}
