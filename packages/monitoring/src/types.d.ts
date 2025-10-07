// Global type definitions for monitoring package

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      SERVICE_VERSION?: string;
      NODE_ENV?: string;
    }
  }
}

export {};
