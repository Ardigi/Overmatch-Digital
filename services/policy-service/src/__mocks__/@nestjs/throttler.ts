export const ThrottlerGuard = jest.fn().mockImplementation(() => ({
  canActivate: jest.fn().mockReturnValue(true),
}));

export const Throttle = jest.fn();
export const SkipThrottle = jest.fn();

export const ThrottlerModule = {
  forRoot: jest.fn().mockReturnValue({
    module: 'ThrottlerModule',
    providers: [],
    exports: [],
  }),
  forRootAsync: jest.fn().mockReturnValue({
    module: 'ThrottlerModule',
    providers: [],
    exports: [],
  }),
};
