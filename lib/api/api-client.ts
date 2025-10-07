import { getSession } from 'next-auth/react';
import { apiConfig, getServiceUrl, type ServiceEndpoints } from './config';
import { tokenManager } from './token-manager';

export interface ApiClientConfig {
  baseURL?: string;
  service?: keyof ServiceEndpoints;
  headers?: Record<string, string>;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

export interface ApiResponse<T = any> {
  data: T;
  status: number;
  headers: Headers;
}

export interface ApiError {
  message: string;
  status?: number;
  code?: string;
  details?: any;
}

export class ApiClientError extends Error {
  status?: number;
  code?: string;
  details?: any;

  constructor(message: string, status?: number, code?: string, details?: any) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export class ApiClient {
  private baseURL: string;
  private service?: keyof ServiceEndpoints;
  private defaultHeaders: Record<string, string>;
  private timeout: number;
  private retries: number;
  private retryDelay: number;
  private csrfToken: string | null = null;

  constructor(config: ApiClientConfig = {}) {
    // If a service is specified, use direct service URL
    if (config.service && !apiConfig.useKong) {
      this.baseURL = getServiceUrl(config.service);
      this.service = config.service;
    } else {
      // Otherwise use the provided baseURL or default Kong gateway
      this.baseURL =
        config.baseURL || process.env.NEXT_PUBLIC_API_GATEWAY_URL || 'http://localhost:8000';
    }

    this.defaultHeaders = {
      'Content-Type': 'application/json',
      ...config.headers,
    };
    this.timeout = config.timeout || 30000; // 30 seconds
    this.retries = config.retries || 3;
    this.retryDelay = config.retryDelay || 1000; // 1 second
  }

  private async getAuthHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {};

    // Get access token (handles refresh automatically)
    if (typeof window !== 'undefined') {
      const accessToken = await tokenManager.getAccessToken();
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
      }
    } else {
      // Server-side - get token from session
      const session = await getSession();
      if (session?.accessToken) {
        headers['Authorization'] = `Bearer ${session.accessToken}`;
      }
    }

    // Add CSRF token if available
    if (this.csrfToken) {
      headers['X-CSRF-Token'] = this.csrfToken;
    }

    return headers;
  }

  private async fetchWithRetry(
    url: string,
    options: RequestInit,
    retriesLeft: number = this.retries
  ): Promise<Response> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Handle rate limiting
      if (response.status === 429 && retriesLeft > 0) {
        const retryAfter = response.headers.get('Retry-After');
        const delay = retryAfter ? parseInt(retryAfter) * 1000 : this.retryDelay;
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.fetchWithRetry(url, options, retriesLeft - 1);
      }

      // Handle server errors with retry
      if (response.status >= 500 && retriesLeft > 0) {
        await new Promise((resolve) => setTimeout(resolve, this.retryDelay));
        return this.fetchWithRetry(url, options, retriesLeft - 1);
      }

      return response;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new ApiClientError('Request timeout', 408);
      }

      if (retriesLeft > 0) {
        await new Promise((resolve) => setTimeout(resolve, this.retryDelay));
        return this.fetchWithRetry(url, options, retriesLeft - 1);
      }

      throw error;
    }
  }

  private async handleResponse<T>(response: Response): Promise<ApiResponse<T>> {
    let rawData: unknown;

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      rawData = await response.json();
    } else {
      rawData = await response.text();
    }

    // Store correlation ID for audit trails (SOC compliance)
    const correlationId = response.headers.get('x-correlation-id');
    if (correlationId && typeof window !== 'undefined') {
      sessionStorage.setItem('last-correlation-id', correlationId);
    }

    if (!response.ok) {
      // Handle wrapped error responses from ServiceResponse format
      let error: string;
      let code: string | undefined;
      let details: any;

      if (rawData && typeof rawData === 'object' && rawData.success === false) {
        // ServiceResponse error format
        error = rawData.error || rawData.message || 'Request failed';
        code = rawData.code;
        details = rawData.details || rawData.data;
        
        // Log for audit trail
        console.error('[API Client] ServiceResponse error:', {
          correlationId: rawData.metadata?.correlationId,
          requestId: rawData.metadata?.requestId,
          error,
          code,
          status: response.status
        });
      } else {
        // Legacy error format
        error = rawData?.error || rawData?.message || 'Request failed';
        code = rawData?.code;
        details = rawData?.details;
      }

      // Handle 401 Unauthorized - token might be expired
      if (response.status === 401 && typeof window !== 'undefined') {
        // Clear the refresh promise to force a new refresh attempt
        tokenManager.clearTokens();

        // Redirect to login if we're in a browser
        const { signOut } = await import('next-auth/react');
        await signOut({ redirect: true, callbackUrl: '/auth/signin' });
      }

      throw new ApiClientError(error, response.status, code, details);
    }

    // Handle ServiceResponse wrapper format (enterprise pattern)
    let data: T;
    if (rawData && typeof rawData === 'object' && 'success' in rawData && 'data' in rawData) {
      // This is a wrapped ServiceResponse
      if (rawData.success === true) {
        data = rawData.data;
        
        // Log metadata for audit trail (SOC compliance)
        if (rawData.metadata) {
          console.debug('[API Client] Request completed:', {
            correlationId: rawData.metadata.correlationId,
            requestId: rawData.metadata.requestId,
            duration: rawData.metadata.duration,
            service: rawData.metadata.service
          });
        }
      } else {
        // This shouldn't happen if response.ok is true, but handle it
        throw new ApiClientError(
          rawData.error || 'Request failed',
          response.status,
          rawData.code,
          rawData.details
        );
      }
    } else {
      // Not wrapped, use raw data
      data = rawData;
    }

    return {
      data,
      status: response.status,
      headers: response.headers,
    };
  }

  async request<T = any>(
    method: string,
    endpoint: string,
    options: {
      body?: any;
      headers?: Record<string, string>;
      params?: Record<string, any>;
      skipAuth?: boolean;
    } = {}
  ): Promise<ApiResponse<T>> {
    const { body, headers = {}, params, skipAuth = false } = options;

    // Build URL with query parameters
    const url = new URL(`${this.baseURL}${endpoint}`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      });
    }

    // Get auth headers
    const authHeaders = skipAuth ? {} : await this.getAuthHeaders();

    // Build request options
    const requestOptions: RequestInit = {
      method,
      headers: {
        ...this.defaultHeaders,
        ...authHeaders,
        ...headers,
      },
      credentials: 'include', // Include cookies for CSRF
    };

    if (body && method !== 'GET' && method !== 'HEAD') {
      requestOptions.body = JSON.stringify(body);
    }

    // Make request
    const response = await this.fetchWithRetry(url.toString(), requestOptions);

    // Update CSRF token if provided
    const newCsrfToken = response.headers.get('X-CSRF-Token');
    if (newCsrfToken) {
      this.csrfToken = newCsrfToken;
    }

    return this.handleResponse<T>(response);
  }

  // Convenience methods
  async get<T>(
    endpoint: string,
    options?: { params?: Record<string, unknown>; headers?: Record<string, string>; skipAuth?: boolean }
  ): Promise<ApiResponse<T>> {
    return this.request<T>('GET', endpoint, options);
  }

  async post<T>(
    endpoint: string,
    body?: unknown,
    options?: { headers?: Record<string, string>; skipAuth?: boolean }
  ) {
    return this.request<T>('POST', endpoint, { body, ...options });
  }

  async put<T>(
    endpoint: string,
    body?: unknown,
    options?: { headers?: Record<string, string>; skipAuth?: boolean }
  ) {
    return this.request<T>('PUT', endpoint, { body, ...options });
  }

  async patch<T>(
    endpoint: string,
    body?: unknown,
    options?: { headers?: Record<string, string>; skipAuth?: boolean }
  ) {
    return this.request<T>('PATCH', endpoint, { body, ...options });
  }

  async delete<T>(
    endpoint: string,
    options?: { headers?: Record<string, string>; skipAuth?: boolean }
  ) {
    return this.request<T>('DELETE', endpoint, options);
  }

  // File upload method
  async upload<T = any>(
    endpoint: string,
    formData: FormData,
    options?: {
      headers?: Record<string, string>;
      onProgress?: (progress: number) => void;
    }
  ): Promise<ApiResponse<T>> {
    const authHeaders = await this.getAuthHeaders();

    // Remove Content-Type to let browser set it with boundary for multipart
    const { 'Content-Type': _, ...headersWithoutContentType } = this.defaultHeaders;

    const xhr = new XMLHttpRequest();

    return new Promise((resolve, reject) => {
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && options?.onProgress) {
          const progress = (e.loaded / e.total) * 100;
          options.onProgress(progress);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            resolve({
              data,
              status: xhr.status,
              headers: new Headers(),
            });
          } catch (error) {
            reject(new ApiClientError('Invalid response format', xhr.status));
          }
        } else {
          try {
            const error = JSON.parse(xhr.responseText);
            reject(
              new ApiClientError(
                error.message || 'Upload failed',
                xhr.status,
                error.code,
                error.details
              )
            );
          } catch {
            reject(new ApiClientError('Upload failed', xhr.status));
          }
        }
      });

      xhr.addEventListener('error', () => {
        reject(new ApiClientError('Network error', 0));
      });

      xhr.addEventListener('timeout', () => {
        reject(new ApiClientError('Request timeout', 408));
      });

      xhr.open('POST', `${this.baseURL}${endpoint}`);
      xhr.timeout = this.timeout;

      // Set headers
      Object.entries({
        ...headersWithoutContentType,
        ...authHeaders,
        ...options?.headers,
      }).forEach(([key, value]) => {
        xhr.setRequestHeader(key, value);
      });

      xhr.send(formData);
    });
  }
}
