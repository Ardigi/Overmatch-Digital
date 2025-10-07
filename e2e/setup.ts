import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Increase test timeout for E2E tests
jest.setTimeout(60000);

// Global setup before all tests
beforeAll(async () => {
  console.log('🚀 Starting E2E Test Setup...');
  
  // Check if Docker is running
  try {
    await execAsync('docker ps');
    console.log('✅ Docker is running');
  } catch (error) {
    throw new Error('Docker is not running. Please start Docker Desktop.');
  }

  // Check if required services are running
  const requiredContainers = [
    'overmatch-digital-postgres-1',
    'overmatch-digital-redis-1',
    'overmatch-digital-kafka-1',
    'overmatch-digital-mongodb-1'
  ];

  for (const container of requiredContainers) {
    try {
      const { stdout } = await execAsync(`docker ps --filter "name=${container}" --format "{{.Status}}"`);
      if (!stdout.includes('Up')) {
        throw new Error(`Container ${container} is not running`);
      }
      console.log(`✅ ${container} is running`);
    } catch (error) {
      throw new Error(`Container ${container} is not running. Run: docker-compose up -d`);
    }
  }

  // Wait for services to be healthy
  console.log('⏳ Waiting for services to be healthy...');
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  console.log('✅ E2E Test Setup Complete');
});

// Global cleanup after all tests
afterAll(async () => {
  console.log('🧹 Cleaning up E2E tests...');
  // Add any cleanup logic here
});

// Utility to wait for condition
export async function waitFor(
  condition: () => Promise<boolean>,
  timeout = 30000,
  interval = 1000
): Promise<void> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  
  throw new Error('Timeout waiting for condition');
}

// Utility to check service health
export async function checkServiceHealth(serviceUrl: string): Promise<boolean> {
  try {
    const response = await fetch(`${serviceUrl}/health`);
    return response.ok;
  } catch {
    return false;
  }
}