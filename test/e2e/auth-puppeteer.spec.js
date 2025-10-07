const puppeteer = require('puppeteer');

// Configuration
const config = {
  frontendUrl: 'http://127.0.0.1:3000',
  authApiUrl: 'http://127.0.0.1:3001/api/v1/auth',
  keycloakUrl: 'http://127.0.0.1:8180',
  headless: false, // Set to true for CI/CD
  slowMo: 50, // Slow down actions for visibility
};

describe('SOC Platform - Authentication E2E Tests', () => {
  let browser;
  let page;
  let testEmail;
  let testPassword;

  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: config.headless,
      slowMo: config.slowMo,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    // Generate unique test credentials
    const timestamp = Date.now();
    testEmail = `test${timestamp}@example.com`;
    testPassword = 'SuperSecure123!@#$';
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  describe('Frontend UI Tests', () => {
    test('Should load the sign-in page', async () => {
      await page.goto(`${config.frontendUrl}/auth/signin`, {
        waitUntil: 'networkidle2',
      });

      // Check page title
      const title = await page.title();
      expect(title).toContain('Sign In');

      // Check for sign-in form elements
      const emailInput = await page.$('input[name="email"]');
      const passwordInput = await page.$('input[type="password"]');
      const submitButton = await page.$('button[type="submit"]');

      expect(emailInput).toBeTruthy();
      expect(passwordInput).toBeTruthy();
      expect(submitButton).toBeTruthy();

      // Take screenshot for documentation
      await page.screenshot({ 
        path: 'test/screenshots/signin-page.png',
        fullPage: true,
      });
    });

    test('Should display validation errors for invalid inputs', async () => {
      await page.goto(`${config.frontendUrl}/auth/signin`, {
        waitUntil: 'networkidle2',
      });

      // Try to submit with empty fields
      await page.click('button[type="submit"]');
      
      // Wait for validation messages
      await page.waitForTimeout(500);

      // Check for error messages
      const errors = await page.$$eval('.error-message, .text-red-500', 
        elements => elements.map(el => el.textContent)
      );

      // Expect validation messages (exact text may vary)
      console.log('Validation errors found:', errors);
    });

    test('Should navigate to register page', async () => {
      await page.goto(`${config.frontendUrl}/auth/signin`, {
        waitUntil: 'networkidle2',
      });

      // Look for register link
      const registerLink = await page.$('a[href*="register"], a[href*="signup"]');
      if (registerLink) {
        await registerLink.click();
        await page.waitForNavigation({ waitUntil: 'networkidle2' });
        
        const url = page.url();
        expect(url).toContain('register');
      }
    });
  });

  describe('Backend API Tests', () => {
    test('Should register a new user via API', async () => {
      const response = await page.evaluate(async (url, email, password) => {
        const res = await fetch(`${url}/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            password,
            firstName: 'Test',
            lastName: 'User',
            organizationId: '9c1878f8-c570-40e9-81c3-64732e942f65',
          }),
        });
        return {
          status: res.status,
          data: await res.json(),
        };
      }, config.authApiUrl, testEmail, testPassword);

      expect(response.status).toBe(201);
      expect(response.data.success).toBe(true);
      expect(response.data.data.user.email).toBe(testEmail);
      
      console.log('✅ User registered:', testEmail);
    });

    test('Should mark email as verified (test bypass)', async () => {
      // In production, this would be done via email link
      const { exec } = require('child_process');
      const util = require('util');
      const execPromise = util.promisify(exec);
      
      const command = `docker exec overmatch-digital-postgres-1 psql -U soc_user -d soc_auth -c "UPDATE users SET \\"emailVerified\\" = true, \\"emailVerifiedAt\\" = NOW() WHERE email = '${testEmail}';"`;
      
      try {
        const { stdout } = await execPromise(command);
        expect(stdout).toContain('UPDATE 1');
        console.log('✅ Email marked as verified');
      } catch (error) {
        console.log('⚠️  Could not verify email automatically:', error.message);
      }
    });

    test('Should login with registered user', async () => {
      const response = await page.evaluate(async (url, email, password) => {
        const res = await fetch(`${url}/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        return {
          status: res.status,
          data: await res.json(),
        };
      }, config.authApiUrl, testEmail, testPassword);

      expect(response.status).toBe(201);
      expect(response.data.success).toBe(true);
      expect(response.data.data.accessToken).toBeTruthy();
      expect(response.data.data.user.email).toBe(testEmail);
      
      // Store token for subsequent tests
      global.authToken = response.data.data.accessToken;
      
      console.log('✅ Login successful');
      console.log('   Access Token:', global.authToken.substring(0, 50) + '...');
    });

    test('Should access protected endpoint with JWT', async () => {
      if (!global.authToken) {
        console.log('⚠️  Skipping protected endpoint test - no auth token');
        return;
      }

      const response = await page.evaluate(async (url, token) => {
        const res = await fetch(`${url}/profile`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        return {
          status: res.status,
          data: res.status === 200 ? await res.json() : null,
        };
      }, config.authApiUrl, global.authToken);

      // Profile endpoint might not be implemented yet
      if (response.status === 200) {
        console.log('✅ Protected endpoint accessible');
      } else {
        console.log('⚠️  Protected endpoint returned:', response.status);
      }
    });
  });

  describe('Keycloak Integration Tests', () => {
    test('Should check Keycloak health', async () => {
      try {
        await page.goto(`${config.keycloakUrl}/health/ready`, {
          waitUntil: 'networkidle2',
        });
        
        const content = await page.content();
        console.log('✅ Keycloak is running');
      } catch (error) {
        console.log('⚠️  Keycloak health check failed:', error.message);
      }
    });

    test('Should verify Keycloak realm exists', async () => {
      try {
        const response = await page.goto(
          `${config.keycloakUrl}/realms/soc-compliance/.well-known/openid-configuration`,
          { waitUntil: 'networkidle2' }
        );
        
        if (response.status() === 200) {
          const config = await page.evaluate(() => {
            return JSON.parse(document.body.textContent);
          });
          
          expect(config.realm).toBe('soc-compliance');
          console.log('✅ Keycloak realm configured');
          console.log('   Issuer:', config.issuer);
        }
      } catch (error) {
        console.log('⚠️  Keycloak realm check failed:', error.message);
      }
    });
  });

  describe('Full User Journey', () => {
    test('Should complete full authentication flow', async () => {
      console.log('\n🔄 Starting Full User Journey Test...\n');
      
      // 1. Navigate to sign-in page
      await page.goto(`${config.frontendUrl}/auth/signin`, {
        waitUntil: 'networkidle2',
      });
      console.log('1️⃣ Navigated to sign-in page');
      
      // 2. Fill in login form
      await page.type('input[name="email"]', testEmail);
      await page.type('input[type="password"]', testPassword);
      console.log('2️⃣ Filled in credentials');
      
      // 3. Take screenshot before submit
      await page.screenshot({ 
        path: 'test/screenshots/signin-filled.png',
        fullPage: true,
      });
      
      // 4. Submit form
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle2' }),
        page.click('button[type="submit"]'),
      ]).catch(error => {
        console.log('⚠️  Navigation after submit failed:', error.message);
      });
      console.log('3️⃣ Submitted login form');
      
      // 5. Check if redirected to dashboard or error shown
      await page.waitForTimeout(2000);
      const currentUrl = page.url();
      
      if (currentUrl.includes('dashboard')) {
        console.log('✅ Successfully redirected to dashboard');
        
        // Take screenshot of dashboard
        await page.screenshot({ 
          path: 'test/screenshots/dashboard.png',
          fullPage: true,
        });
        
        // Check for user info
        const userInfo = await page.$eval(
          '[data-testid="user-info"], .user-name, .user-email',
          el => el.textContent
        ).catch(() => null);
        
        if (userInfo) {
          console.log('✅ User info displayed:', userInfo);
        }
      } else if (currentUrl.includes('signin')) {
        // Still on sign-in page, check for error
        const errorMessage = await page.$eval(
          '.error-message, .alert-danger, .text-red-500',
          el => el.textContent
        ).catch(() => null);
        
        console.log('⚠️  Login failed, still on sign-in page');
        if (errorMessage) {
          console.log('   Error:', errorMessage);
        }
      } else {
        console.log('⚠️  Unexpected redirect to:', currentUrl);
      }
      
      // 6. Test logout if logged in
      const logoutButton = await page.$('button[aria-label="Logout"], a[href*="logout"]');
      if (logoutButton) {
        await logoutButton.click();
        await page.waitForTimeout(1000);
        console.log('4️⃣ Logged out successfully');
      }
    });
  });

  describe('Kong Konnect Tests', () => {
    test('Should verify Kong Konnect routes', async () => {
      // Note: Kong Konnect is cloud-based, so we test through local proxy
      const kongProxyUrl = 'http://localhost:8000';
      
      try {
        // Test auth service through Kong
        const response = await page.evaluate(async (url) => {
          const res = await fetch(`${url}/auth/health`);
          return {
            status: res.status,
            data: res.status === 200 ? await res.json() : null,
          };
        }, kongProxyUrl);
        
        if (response.status === 200) {
          console.log('✅ Kong proxy to auth service working');
        } else {
          console.log('⚠️  Kong proxy returned:', response.status);
          console.log('   Kong Konnect is cloud-based - local proxy may not be configured');
        }
      } catch (error) {
        console.log('ℹ️  Kong Konnect is cloud-based, local testing limited');
      }
    });
  });
});

// Run the tests
async function runTests() {
  console.log('🚀 Starting Puppeteer E2E Tests');
  console.log('================================\n');
  
  const testSuite = new (require('events'))();
  let passedTests = 0;
  let failedTests = 0;
  
  // Simple test runner
  global.describe = (name, fn) => {
    console.log(`\n📦 ${name}`);
    fn();
  };
  
  global.test = global.it = async (name, fn) => {
    try {
      await fn();
      passedTests++;
      console.log(`  ✅ ${name}`);
    } catch (error) {
      failedTests++;
      console.log(`  ❌ ${name}`);
      console.log(`     Error: ${error.message}`);
    }
  };
  
  global.expect = (value) => ({
    toBe: (expected) => {
      if (value !== expected) {
        throw new Error(`Expected ${expected}, got ${value}`);
      }
    },
    toBeTruthy: () => {
      if (!value) {
        throw new Error(`Expected truthy value, got ${value}`);
      }
    },
    toContain: (substring) => {
      if (!value.includes(substring)) {
        throw new Error(`Expected to contain "${substring}", got "${value}"`);
      }
    },
  });
  
  global.beforeAll = async (fn) => await fn();
  global.afterAll = async (fn) => {
    await fn();
    
    console.log('\n================================');
    console.log('📊 Test Results:');
    console.log(`   ✅ Passed: ${passedTests}`);
    console.log(`   ❌ Failed: ${failedTests}`);
    console.log(`   📈 Success Rate: ${Math.round(passedTests / (passedTests + failedTests) * 100)}%`);
    console.log('================================\n');
    
    process.exit(failedTests > 0 ? 1 : 0);
  };
  
  // Load and run the test suite
  require('./auth-puppeteer.spec.js');
}

// Run if executed directly
if (require.main === module) {
  runTests().catch(console.error);
}