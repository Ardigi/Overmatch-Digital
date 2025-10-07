// Mock for ioredis

export default class Redis {
  private connected = true;
  private data = new Map<string, any>();

  constructor(options?: any) {
    // Mock constructor
  }

  async ping(): Promise<string> {
    return this.connected ? 'PONG' : '';
  }

  async get(key: string): Promise<string | null> {
    return this.data.get(key) || null;
  }

  async set(key: string, value: string, ...args: any[]): Promise<string> {
    this.data.set(key, value);
    return 'OK';
  }

  async setex(key: string, seconds: number, value: string): Promise<string> {
    this.data.set(key, value);
    return 'OK';
  }

  async del(...keys: string[]): Promise<number> {
    let deleted = 0;
    for (const key of keys) {
      if (this.data.delete(key)) {
        deleted++;
      }
    }
    return deleted;
  }

  async exists(...keys: string[]): Promise<number> {
    let count = 0;
    for (const key of keys) {
      if (this.data.has(key)) {
        count++;
      }
    }
    return count;
  }

  async expire(key: string, seconds: number): Promise<number> {
    return this.data.has(key) ? 1 : 0;
  }

  async ttl(key: string): Promise<number> {
    return this.data.has(key) ? 60 : -2;
  }

  async keys(pattern: string): Promise<string[]> {
    const keys: string[] = [];
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    for (const key of this.data.keys()) {
      if (regex.test(key)) {
        keys.push(key);
      }
    }
    return keys;
  }

  async flushdb(): Promise<string> {
    this.data.clear();
    return 'OK';
  }

  async flushall(): Promise<string> {
    this.data.clear();
    return 'OK';
  }

  async quit(): Promise<string> {
    this.connected = false;
    return 'OK';
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  on(event: string, callback: Function): this {
    // Mock event listener
    if (event === 'connect') {
      setTimeout(() => callback(), 0);
    }
    return this;
  }

  once(event: string, callback: Function): this {
    // Mock event listener
    if (event === 'connect') {
      setTimeout(() => callback(), 0);
    }
    return this;
  }
}

export { Redis };