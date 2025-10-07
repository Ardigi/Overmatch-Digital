// Central export for all API modules
export * from './api-client';
// Re-export convenience API methods and instance from separate file to avoid TDZ
export { api, apiClient } from './client-instance';
export * from './auth';
export { authApi } from './auth';
export * from './clients';
export { clientsApi } from './clients';
export * from './controls';
export { controlsApi } from './controls';
export * from './evidence';
export { evidenceApi } from './evidence';
export * from './policies';
export { policiesApi } from './policies';
export * from './projects';
export { projectsApi } from './projects';
