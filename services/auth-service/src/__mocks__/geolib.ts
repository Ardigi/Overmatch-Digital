// Mock for geolib library
export const getDistance = jest.fn((from: any, to: any) => {
  // Return a mock distance in meters
  return 1000;
});

export const getPreciseDistance = jest.fn((from: any, to: any) => {
  // Return a mock precise distance in meters
  return 1000;
});

export const isPointWithinRadius = jest.fn((point: any, center: any, radius: number) => {
  // Mock implementation - always return true for tests
  return true;
});

export const getCenter = jest.fn((points: any[]) => {
  // Return a mock center point
  return { latitude: 37.7749, longitude: -122.4194 };
});

export const getBounds = jest.fn((points: any[]) => {
  // Return mock bounds
  return {
    minLat: 37.7749,
    maxLat: 37.7749,
    minLng: -122.4194,
    maxLng: -122.4194,
  };
});

export const getSpeed = jest.fn((distance: number, time: number) => {
  // Return mock speed in m/s
  return distance / time;
});

export const convertDistance = jest.fn((distance: number, unit: string) => {
  // Simple conversion mock
  if (unit === 'km') return distance / 1000;
  if (unit === 'mi') return distance / 1609.34;
  return distance;
});

export const convertSpeed = jest.fn((speed: number, unit: string) => {
  // Simple speed conversion mock
  if (unit === 'kmh') return speed * 3.6;
  if (unit === 'mph') return speed * 2.237;
  return speed;
});

// Default export
export default {
  getDistance,
  getPreciseDistance,
  isPointWithinRadius,
  getCenter,
  getBounds,
  getSpeed,
  convertDistance,
  convertSpeed,
};
