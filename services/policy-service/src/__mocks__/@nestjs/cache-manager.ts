export const CACHE_MANAGER = 'CACHE_MANAGER';

export class CacheStore {}

export const CacheModule = {
  register: jest.fn().mockReturnValue({
    module: 'CacheModule',
    providers: [],
    exports: [],
  }),
  registerAsync: jest.fn().mockReturnValue({
    module: 'CacheModule',
    providers: [],
    exports: [],
  }),
};

export const CacheInterceptor = jest.fn();
export const CacheKey = jest.fn();
export const CacheTTL = jest.fn();
