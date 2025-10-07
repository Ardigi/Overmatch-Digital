interface RateLimiterOptions {
  windowMs: number;
  max: number;
  keyGenerator?: (req: any) => string;
}

interface RequestRecord {
  timestamps: number[];
  lastReset: number;
}

export class RateLimiter {
  private cache: Map<string, RequestRecord>;
  private windowMs: number;
  private max: number;
  private keyGenerator: (req: any) => string;
  private cleanupInterval: NodeJS.Timeout;

  constructor(options: RateLimiterOptions) {
    this.windowMs = options.windowMs;
    this.max = options.max;
    this.keyGenerator = options.keyGenerator || ((req) => req.ip || 'unknown');
    this.cache = new Map();

    // Cleanup old entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  async check(key: string): Promise<boolean> {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    // Get or create request record
    let record = this.cache.get(key);

    if (!record || record.lastReset < windowStart) {
      record = {
        timestamps: [],
        lastReset: now,
      };
    }

    // Filter out old timestamps
    record.timestamps = record.timestamps.filter((timestamp) => timestamp > windowStart);

    // Check if limit exceeded
    if (record.timestamps.length >= this.max) {
      return true; // Rate limited
    }

    // Add current request
    record.timestamps.push(now);
    this.cache.set(key, record);

    return false; // Not rate limited
  }

  private cleanup() {
    const now = Date.now();
    const cutoff = now - this.windowMs;

    for (const [key, record] of this.cache.entries()) {
      if (record.lastReset < cutoff && record.timestamps.length === 0) {
        this.cache.delete(key);
      }
    }
  }

  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.cache.clear();
  }
}

// Endpoint-specific rate limiters
export const rateLimiters = {
  auth: new RateLimiter({ windowMs: 15 * 60 * 1000, max: 5 }),
  api: new RateLimiter({ windowMs: 1 * 60 * 1000, max: 100 }),
  export: new RateLimiter({ windowMs: 60 * 60 * 1000, max: 10 }),
};
