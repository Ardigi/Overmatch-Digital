/**
 * Global Integration Test Teardown
 *
 * Runs once after all integration tests complete.
 * Cleans up any global resources.
 */

export default async () => {
  console.log('🧹 Starting Auth Service Integration Test Global Teardown...');

  // Add any global cleanup here if needed
  // For now, individual tests handle their own cleanup

  console.log('✨ Auth Service Integration Test Global Teardown Complete');
};
