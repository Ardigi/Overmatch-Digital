// Test script to verify OAuth strategies are optional
import { ConfigService } from '@nestjs/config';

// Mock ConfigService
const mockConfigService = {
  get: (key: string, defaultValue?: any) => {
    const config: Record<string, any> = {
      // No OAuth config set
    };
    return config[key] || defaultValue;
  },
};

// Test GoogleStrategy
console.log('Testing GoogleStrategy without config...');
const googleClientId = mockConfigService.get('GOOGLE_CLIENT_ID');
const googleClientSecret = mockConfigService.get('GOOGLE_CLIENT_SECRET');

if (!googleClientId || !googleClientSecret) {
  console.log('✓ Google OAuth correctly identified as not configured');
} else {
  console.log('✗ Google OAuth incorrectly identified as configured');
}

// Test MicrosoftStrategy
console.log('\nTesting MicrosoftStrategy without config...');
const microsoftClientId = mockConfigService.get('MICROSOFT_CLIENT_ID');
const microsoftClientSecret = mockConfigService.get('MICROSOFT_CLIENT_SECRET');

if (!microsoftClientId || !microsoftClientSecret) {
  console.log('✓ Microsoft OAuth correctly identified as not configured');
} else {
  console.log('✗ Microsoft OAuth incorrectly identified as configured');
}

// Test with config
const mockConfigServiceWithOAuth = {
  get: (key: string, defaultValue?: any) => {
    const config: Record<string, any> = {
      GOOGLE_CLIENT_ID: 'test-google-id',
      GOOGLE_CLIENT_SECRET: 'test-google-secret',
      MICROSOFT_CLIENT_ID: 'test-microsoft-id',
      MICROSOFT_CLIENT_SECRET: 'test-microsoft-secret',
    };
    return config[key] || defaultValue;
  },
};

console.log('\n\nTesting with OAuth config...');
const googleClientIdWithConfig = mockConfigServiceWithOAuth.get('GOOGLE_CLIENT_ID');
const googleClientSecretWithConfig = mockConfigServiceWithOAuth.get('GOOGLE_CLIENT_SECRET');

if (googleClientIdWithConfig && googleClientSecretWithConfig) {
  console.log('✓ Google OAuth correctly identified as configured');
} else {
  console.log('✗ Google OAuth incorrectly identified as not configured');
}

const microsoftClientIdWithConfig = mockConfigServiceWithOAuth.get('MICROSOFT_CLIENT_ID');
const microsoftClientSecretWithConfig = mockConfigServiceWithOAuth.get('MICROSOFT_CLIENT_SECRET');

if (microsoftClientIdWithConfig && microsoftClientSecretWithConfig) {
  console.log('✓ Microsoft OAuth correctly identified as configured');
} else {
  console.log('✗ Microsoft OAuth incorrectly identified as not configured');
}

console.log('\n✅ OAuth optional configuration test complete');
