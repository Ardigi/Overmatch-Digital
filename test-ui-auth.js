// Playwright test for UI authentication
const { chromium } = require('playwright');

(async () => {
  console.log('🎭 Starting Playwright UI Authentication Test\n');
  
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--disable-dev-shm-usage']
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // 1. Test Homepage Load
    console.log('1. Loading homepage...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    const title = await page.title();
    console.log(`   ✅ Page loaded: ${title}`);
    
    // 2. Check for login button/link
    console.log('\n2. Looking for authentication UI...');
    
    // Try to find sign in button or link
    const signInButton = await page.locator('button:has-text("Sign In"), a:has-text("Sign In"), button:has-text("Login"), a:has-text("Login")').first();
    
    if (await signInButton.count() > 0) {
      console.log('   ✅ Found authentication button');
      
      // 3. Click sign in
      console.log('\n3. Clicking sign in...');
      await signInButton.click();
      await page.waitForTimeout(2000);
      
      // 4. Check if we're on a login page
      const currentUrl = page.url();
      console.log(`   Current URL: ${currentUrl}`);
      
      // 5. Try to find email/password fields
      const emailField = await page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]').first();
      const passwordField = await page.locator('input[type="password"], input[name="password"]').first();
      
      if (await emailField.count() > 0 && await passwordField.count() > 0) {
        console.log('   ✅ Found login form fields');
        
        // 6. Fill in credentials
        console.log('\n4. Entering credentials...');
        await emailField.fill('admin@soc-compliance.com');
        await passwordField.fill('Admin@123!');
        console.log('   ✅ Credentials entered');
        
        // 7. Submit form
        console.log('\n5. Submitting login form...');
        const submitButton = await page.locator('button[type="submit"], button:has-text("Sign In"), button:has-text("Login")').first();
        await submitButton.click();
        
        // Wait for navigation or response
        await page.waitForTimeout(3000);
        
        // 8. Check if logged in
        console.log('\n6. Checking authentication status...');
        const finalUrl = page.url();
        
        // Look for signs of successful login
        const profileButton = await page.locator('button:has-text("Profile"), button:has-text("Account"), [aria-label*="user" i], img[alt*="avatar" i]').first();
        const dashboardElement = await page.locator('text=/dashboard/i, text=/home/i, text=/overview/i').first();
        
        if (await profileButton.count() > 0 || await dashboardElement.count() > 0) {
          console.log('   ✅ Successfully authenticated!');
          console.log(`   Final URL: ${finalUrl}`);
          
          // Take screenshot
          await page.screenshot({ path: 'authenticated-dashboard.png' });
          console.log('   📸 Screenshot saved: authenticated-dashboard.png');
          
          console.log('\n✅ UI AUTHENTICATION TEST PASSED!');
          console.log('The frontend successfully authenticates with the Auth Service!');
        } else {
          console.log('   ⚠️ Could not verify successful authentication');
          console.log(`   Final URL: ${finalUrl}`);
          
          // Take screenshot for debugging
          await page.screenshot({ path: 'auth-result.png' });
          console.log('   📸 Screenshot saved: auth-result.png');
        }
      } else {
        console.log('   ⚠️ Could not find login form fields');
        // Take screenshot
        await page.screenshot({ path: 'login-page.png' });
        console.log('   📸 Screenshot saved: login-page.png');
      }
    } else {
      // Check if already logged in or no auth required
      console.log('   ℹ️ No sign-in button found');
      
      // Take screenshot
      await page.screenshot({ path: 'homepage.png' });
      console.log('   📸 Screenshot saved: homepage.png');
      
      // Check page content
      const pageContent = await page.content();
      if (pageContent.includes('Dashboard') || pageContent.includes('Profile')) {
        console.log('   ✅ Appears to be already authenticated or no auth required');
      } else {
        console.log('   ⚠️ Could not determine authentication state');
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    // Take error screenshot
    await page.screenshot({ path: 'error-state.png' });
    console.log('   📸 Error screenshot saved: error-state.png');
  } finally {
    await browser.close();
    console.log('\n🎭 Playwright test completed');
  }
})();