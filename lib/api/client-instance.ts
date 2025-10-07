// Separate file for ApiClient instance to avoid temporal dead zone
// This breaks the circular dependency between class definition and instance creation

import { ApiClient, type ApiResponse } from './api-client';

// Create singleton instance with lazy initialization
let _apiClient: ApiClient | undefined;

function getApiClient(): ApiClient {
  if (!_apiClient) {
    _apiClient = new ApiClient();
  }
  return _apiClient;
}

// Export getter for instance
export { getApiClient as apiClient };

// Re-export convenient methods - use regular functions to avoid temporal dead zone
// STRICT TYPING: No 'any' types allowed in production code
export const api = {
  get<T>(...args: Parameters<ApiClient['get']>): Promise<ApiResponse<T>> {
    return getApiClient().get<T>(...args);
  },
  post<T>(...args: Parameters<ApiClient['post']>): Promise<ApiResponse<T>> {
    return getApiClient().post<T>(...args);
  },
  put<T>(...args: Parameters<ApiClient['put']>): Promise<ApiResponse<T>> {
    return getApiClient().put<T>(...args);
  },
  patch<T>(...args: Parameters<ApiClient['patch']>): Promise<ApiResponse<T>> {
    return getApiClient().patch<T>(...args);
  },
  delete<T>(...args: Parameters<ApiClient['delete']>): Promise<ApiResponse<T>> {
    return getApiClient().delete<T>(...args);
  },
  upload<T>(...args: Parameters<ApiClient['upload']>): Promise<ApiResponse<T>> {
    return getApiClient().upload<T>(...args);
  },
};