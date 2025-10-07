export interface ServiceConfig {
  name: string;
  url: string;
  timeout?: number;
  retries?: number;
  circuitBreaker?: CircuitBreakerConfig;
}

export interface CircuitBreakerConfig {
  threshold: number;
  timeout: number;
  resetTimeout: number;
}

export interface ServiceDiscoveryConfig {
  services: {
    [key: string]: ServiceConfig;
  };
  defaults?: {
    timeout?: number;
    retries?: number;
    circuitBreaker?: CircuitBreakerConfig;
  };
}

export interface HttpRequestConfig {
  headers?: Record<string, string>;
  timeout?: number;
  retries?: number;
  params?: Record<string, any>;
  auth?: {
    type: 'internal' | 'jwt' | 'api-key' | 'service';
    token?: string;
  };
}

export interface HttpClientOptions {
  baseURL?: string;
  timeout?: number;
  headers?: Record<string, string>;
  retries?: number;
  retryDelay?: number;
  circuitBreaker?: CircuitBreakerConfig;
}
