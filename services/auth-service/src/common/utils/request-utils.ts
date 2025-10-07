import { Request } from 'express';

/**
 * Extract the real client IP address from the request
 * Handles various proxy headers and fallbacks
 */
export function getClientIp(req: Request): string {
  // Check for proxy headers first (common in production with load balancers)
  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor) {
    // x-forwarded-for can contain multiple IPs, take the first one
    const ips = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
    return ips.split(',')[0].trim();
  }

  // Check for other common proxy headers
  const realIp = req.headers['x-real-ip'];
  if (realIp) {
    return Array.isArray(realIp) ? realIp[0] : realIp;
  }

  // Check for Cloudflare header
  const cfConnectingIp = req.headers['cf-connecting-ip'];
  if (cfConnectingIp) {
    return Array.isArray(cfConnectingIp) ? cfConnectingIp[0] : cfConnectingIp;
  }

  // Fall back to req.ip (Express's IP detection)
  // In development, this might be ::1 (IPv6 localhost) or 127.0.0.1
  return req.ip || req.socket?.remoteAddress || '0.0.0.0';
}

/**
 * Get the user agent from the request
 */
export function getUserAgent(req: Request): string {
  const userAgent = req.headers['user-agent'];
  if (userAgent) {
    return Array.isArray(userAgent) ? userAgent[0] : userAgent;
  }
  return 'Unknown';
}

/**
 * Extract request metadata for audit logging
 */
export interface RequestMetadata {
  ipAddress: string;
  userAgent: string;
  requestId?: string;
}

export function getRequestMetadata(req: Request): RequestMetadata {
  return {
    ipAddress: getClientIp(req),
    userAgent: getUserAgent(req),
    requestId: (req.headers['x-request-id'] as string) || undefined,
  };
}