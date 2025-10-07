// Mock for geoip-lite library
export const lookup = jest.fn((ip: string) => {
  // Return a mock location for any IP address
  return {
    range: [3221225472, 3221225727],
    country: 'US',
    region: 'CA',
    eu: '0',
    timezone: 'America/Los_Angeles',
    city: 'San Francisco',
    ll: [37.7749, -122.4194],
    metro: 807,
    area: 1000,
  };
});

export const pretty = jest.fn((ip: number) => {
  // Convert IP number to string format
  const octet1 = (ip >>> 24) & 255;
  const octet2 = (ip >>> 16) & 255;
  const octet3 = (ip >>> 8) & 255;
  const octet4 = ip & 255;
  return `${octet1}.${octet2}.${octet3}.${octet4}`;
});

export const startWatchingDataUpdate = jest.fn(() => {
  // Mock function - no-op for tests
});

export const stopWatchingDataUpdate = jest.fn(() => {
  // Mock function - no-op for tests
});

// Default export
export default {
  lookup,
  pretty,
  startWatchingDataUpdate,
  stopWatchingDataUpdate,
};
