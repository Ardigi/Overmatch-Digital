const puppeteer = require('puppeteer');

async function testFrontendAuth() {
  console.log('🔐 Testing Frontend Authentication with Corrected Config');
  console.log('=====================================================\n');

  let browser;
  let page;

  try {
    browser = await puppeteer.launch({
      headless: false, // Show browser
      slowMo: 100,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    // Enable console logging
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('Browser Error:', msg.text());
      }
    });

    // 1. First create a test user directly via API
    console.log('1️⃣ Creating test user via API...');
    const timestamp = Date.now();
    const testEmail = `test${timestamp}@example.com`;
    const testPassword = 'SuperSecure123!@#$';
    
    const regResponse = await page.evaluate(async (email, password) => {
      const res = await fetch('http://127.0.0.1:3001/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          firstName: 'Test',
          lastName: 'User',
          organizationId: '9c1878f8-c570-40e9-81c3-64732e942f65'
        })
      });
      return {
        status: res.status,
        data: await res.json()
      };
    }, testEmail, testPassword);
    
    if (regResponse.data.success) {
      console.log(`   ✅ User created: ${testEmail}`);
    } else {
      console.log('   ❌ Registration failed:', regResponse.data);
      return;
    }

    // 2. Mark email as verified (for testing)
    console.log('2️⃣ Marking email as verified...');
    const { exec } = require('child_process');
    const util = require('util');
    const execPromise = util.promisify(exec);
    
    await execPromise(`docker exec overmatch-digital-postgres-1 psql -U soc_user -d soc_auth -c "UPDATE users SET \\"emailVerified\\" = true, \\"emailVerifiedAt\\" = NOW() WHERE email = '${testEmail}';"`);
    console.log('   ✅ Email verified');

    // 3. Navigate to sign-in page
    console.log('\n3️⃣ Testing Frontend Login...');
    await page.goto('http://127.0.0.1:3000/auth/signin', {
      waitUntil: 'networkidle2',
    });
    console.log('   ✅ Sign-in page loaded');

    // 4. Fill in credentials
    await page.type('input[name="email"]', testEmail);
    await page.type('input[type="password"]', testPassword);
    console.log(`   ✅ Filled credentials: ${testEmail}`);

    // Take screenshot before submit
    await page.screenshot({ 
      path: 'before-submit.png',
      fullPage: true 
    });

    // 5. Monitor network requests
    const authRequests = [];
    page.on('request', request => {
      if (request.url().includes('/api/auth/') || request.url().includes(':3001')) {
        authRequests.push({
          url: request.url(),
          method: request.method(),
          headers: request.headers()
        });
      }
    });

    page.on('response', response => {
      if (response.url().includes('/api/auth/') || response.url().includes(':3001')) {
        console.log(`   📡 Response: ${response.url()} - Status: ${response.status()}`);
      }
    });

    // 6. Submit form
    console.log('\n4️⃣ Submitting login form...');
    await page.click('button[type="submit"]');
    
    // Wait for navigation or error
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 7. Check current state
    const currentUrl = page.url();
    console.log(`   Current URL: ${currentUrl}`);

    // Check for cookies/session
    const cookies = await page.cookies();
    const sessionCookie = cookies.find(c => c.name.includes('session') || c.name.includes('auth'));
    if (sessionCookie) {
      console.log('   ✅ Session cookie found:', sessionCookie.name);
    } else {
      console.log('   ⚠️  No session cookie found');
    }

    // Check localStorage
    const localStorage = await page.evaluate(() => {
      return {
        token: window.localStorage.getItem('token'),
        user: window.localStorage.getItem('user'),
        keys: Object.keys(window.localStorage)
      };
    });
    
    if (localStorage.token) {
      console.log('   ✅ Token in localStorage');
    } else {
      console.log('   ⚠️  No token in localStorage');
      console.log('   localStorage keys:', localStorage.keys);
    }

    // Check for error messages
    const errorText = await page.evaluate(() => {
      const errors = document.querySelectorAll('.error-message, .text-red-500, .alert');
      return Array.from(errors).map(e => e.textContent).join(' | ');
    });
    
    if (errorText) {
      console.log('   ⚠️  Error displayed:', errorText);
    }

    // Take screenshot after submit
    await page.screenshot({ 
      path: 'after-submit.png',
      fullPage: true 
    });

    // 8. Check auth requests made
    console.log('\n5️⃣ Auth Requests Made:');
    authRequests.forEach(req => {
      console.log(`   ${req.method} ${req.url}`);
    });

    // 9. Test direct NextAuth signin
    console.log('\n6️⃣ Testing NextAuth signIn directly...');
    const signInResult = await page.evaluate(async (email, password) => {
      // Check if NextAuth is available
      if (typeof window !== 'undefined' && window.next && window.next.auth) {
        try {
          const { signIn } = await import('next-auth/react');
          const result = await signIn('credentials', {
            email,
            password,
            redirect: false
          });
          return { success: true, result };
        } catch (error) {
          return { success: false, error: error.message };
        }
      }
      return { success: false, error: 'NextAuth not available' };
    }, testEmail, testPassword);

    console.log('   NextAuth signIn result:', signInResult);

    // 10. Check if we're logged in
    const isLoggedIn = currentUrl.includes('dashboard') || 
                       sessionCookie !== undefined ||
                       localStorage.token !== null;
    
    console.log('\n=====================================================');
    console.log('📊 Test Results:');
    console.log(`   User Created: ✅ ${testEmail}`);
    console.log(`   Page Loaded: ✅`);
    console.log(`   Form Submitted: ✅`);
    console.log(`   Logged In: ${isLoggedIn ? '✅' : '❌'}`);
    console.log(`   Current URL: ${currentUrl}`);
    console.log('=====================================================\n');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    if (browser) {
      console.log('Press Enter to close browser...');
      await new Promise(resolve => process.stdin.once('data', resolve));
      await browser.close();
    }
  }
}

testFrontendAuth().catch(console.error);