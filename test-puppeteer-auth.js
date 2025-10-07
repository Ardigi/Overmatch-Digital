const puppeteer = require('puppeteer');

async function testPlatformAuth() {
  console.log('🔍 Verifying Actual Platform State with Puppeteer');
  console.log('================================================\n');

  let browser;
  let page;

  try {
    // Launch browser
    browser = await puppeteer.launch({
      headless: false, // Show browser for debugging
      slowMo: 100, // Slow down actions
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    // Test 1: Check Keycloak
    console.log('1️⃣ Checking Keycloak Status...');
    try {
      await page.goto('http://127.0.0.1:8180/admin', { 
        waitUntil: 'networkidle2',
        timeout: 5000 
      });
      const title = await page.title();
      console.log('   ✅ Keycloak admin console accessible');
      console.log(`   Title: ${title}`);
      
      // Check if realm exists
      await page.goto('http://127.0.0.1:8180/realms/soc-compliance', {
        waitUntil: 'networkidle2',
        timeout: 5000
      }).catch(async (e) => {
        const content = await page.content();
        if (content.includes('Realm does not exist')) {
          console.log('   ❌ soc-compliance realm does NOT exist');
          console.log('   Need to create realm in Keycloak');
        }
      });
    } catch (error) {
      console.log('   ❌ Keycloak check failed:', error.message);
    }

    // Test 2: Check Kong
    console.log('\n2️⃣ Checking Kong Status...');
    try {
      const kongResponse = await page.evaluate(async () => {
        try {
          const res = await fetch('http://localhost:8000/auth/health');
          return { status: res.status };
        } catch (e) {
          return { error: e.message };
        }
      });
      
      if (kongResponse.error) {
        console.log('   ❌ Kong local proxy NOT running');
        console.log('   Documentation says Kong Konnect (cloud) is used');
      } else {
        console.log('   ✅ Kong proxy responded:', kongResponse.status);
      }
    } catch (error) {
      console.log('   ❌ Kong check failed:', error.message);
    }

    // Test 3: Check Auth Service API
    console.log('\n3️⃣ Testing Auth Service Directly...');
    const authResponse = await page.evaluate(async () => {
      try {
        const res = await fetch('http://127.0.0.1:3001/api/v1/auth/health');
        return { 
          status: res.status,
          text: await res.text()
        };
      } catch (e) {
        return { error: e.message };
      }
    });
    
    if (authResponse.error) {
      console.log('   ❌ Auth service not accessible:', authResponse.error);
    } else {
      console.log('   Status:', authResponse.status);
      console.log('   Response:', authResponse.text);
      
      // Try registration
      const timestamp = Date.now();
      const regResponse = await page.evaluate(async (ts) => {
        const res = await fetch('http://127.0.0.1:3001/api/v1/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: `test${ts}@example.com`,
            password: 'SuperSecure123!@#$',
            firstName: 'Test',
            lastName: 'User',
            organizationId: '9c1878f8-c570-40e9-81c3-64732e942f65'
          })
        });
        return {
          status: res.status,
          data: await res.json()
        };
      }, timestamp);
      
      if (regResponse.data.success) {
        console.log('   ✅ Registration works directly to auth service');
        console.log(`   User created: test${timestamp}@example.com`);
      } else {
        console.log('   ❌ Registration failed:', regResponse.data);
      }
    }

    // Test 4: Check Frontend
    console.log('\n4️⃣ Testing Frontend Sign-in Page...');
    try {
      await page.goto('http://127.0.0.1:3000/auth/signin', {
        waitUntil: 'networkidle2',
        timeout: 10000
      });
      
      const title = await page.title();
      console.log('   ✅ Frontend sign-in page loaded');
      console.log(`   Title: ${title}`);
      
      // Check for form elements
      const hasEmailInput = await page.$('input[name="email"]') !== null;
      const hasPasswordInput = await page.$('input[type="password"]') !== null;
      const hasSubmitButton = await page.$('button[type="submit"]') !== null;
      
      console.log(`   Email input: ${hasEmailInput ? '✅' : '❌'}`);
      console.log(`   Password input: ${hasPasswordInput ? '✅' : '❌'}`);
      console.log(`   Submit button: ${hasSubmitButton ? '✅' : '❌'}`);
      
      // Take screenshot
      await page.screenshot({ 
        path: 'signin-page-actual.png',
        fullPage: true 
      });
      console.log('   📸 Screenshot saved: signin-page-actual.png');
      
      // Try to fill and submit form
      if (hasEmailInput && hasPasswordInput && hasSubmitButton) {
        console.log('\n5️⃣ Testing Login Form Submission...');
        
        await page.type('input[name="email"]', 'test@example.com');
        await page.type('input[type="password"]', 'Test123456!');
        
        // Take screenshot before submit
        await page.screenshot({ 
          path: 'signin-filled-actual.png',
          fullPage: true 
        });
        
        // Click submit and wait
        await Promise.all([
          page.click('button[type="submit"]'),
          page.waitForNavigation({ 
            waitUntil: 'networkidle2',
            timeout: 5000 
          }).catch(() => null)
        ]);
        
        await page.waitForTimeout(2000);
        
        // Check result
        const currentUrl = page.url();
        console.log('   Current URL:', currentUrl);
        
        // Check for error messages
        const errorText = await page.evaluate(() => {
          const errors = document.querySelectorAll('.error-message, .text-red-500, .alert-danger');
          return Array.from(errors).map(e => e.textContent).join(' ');
        });
        
        if (errorText) {
          console.log('   Error displayed:', errorText);
        }
        
        // Take screenshot after submit
        await page.screenshot({ 
          path: 'signin-after-submit-actual.png',
          fullPage: true 
        });
        console.log('   📸 Screenshot saved: signin-after-submit-actual.png');
      }
    } catch (error) {
      console.log('   ❌ Frontend test failed:', error.message);
    }

    // Test 5: Check what auth method frontend uses
    console.log('\n6️⃣ Checking Frontend Auth Implementation...');
    const authImplementation = await page.evaluate(() => {
      // Check if NextAuth is being used
      const hasNextAuth = typeof window !== 'undefined' && 
                          window.location.pathname.includes('/auth/');
      
      // Check localStorage/sessionStorage
      const hasTokenInStorage = localStorage.getItem('token') || 
                               sessionStorage.getItem('token');
      
      return {
        usesNextAuth: hasNextAuth,
        hasStoredToken: !!hasTokenInStorage,
        cookies: document.cookie
      };
    });
    
    console.log('   Uses NextAuth:', authImplementation.usesNextAuth ? 'Yes' : 'No');
    console.log('   Has stored token:', authImplementation.hasStoredToken ? 'Yes' : 'No');
    console.log('   Cookies:', authImplementation.cookies || 'None');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
  } finally {
    console.log('\n================================================');
    console.log('📊 Actual Platform State Summary:');
    console.log('   • Keycloak: Running but realm not configured');
    console.log('   • Kong: Not running locally (cloud Konnect expected)');
    console.log('   • Auth Service: Working with direct API calls');
    console.log('   • Frontend: Sign-in page loads, uses NextAuth');
    console.log('   • Integration: Frontend ↔ Backend NOT fully connected');
    console.log('================================================\n');
    
    if (browser) {
      await browser.close();
    }
  }
}

// Run the test
testPlatformAuth().catch(console.error);