import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    // Manual instantiation to avoid TypeORM/Jest issues
    controller = new HealthController();
  });

  describe('check', () => {
    it('should return health status', () => {
      const result = controller.check();

      expect(result).toHaveProperty('status', 'ok');
      expect(result).toHaveProperty('service', 'audit-service');
      expect(result).toHaveProperty('version', '1.0.0');
      expect(result).toHaveProperty('timestamp');
      expect(new Date(result.timestamp)).toBeInstanceOf(Date);
    });

    it('should return valid ISO timestamp', () => {
      const before = new Date();
      const result = controller.check();
      const after = new Date();

      const timestamp = new Date(result.timestamp);
      expect(timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });
});
