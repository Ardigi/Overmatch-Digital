const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ 
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  
  // Enable console logging
  page.on('console', msg => {
    const text = msg.text();
    if (!text.includes('Download the React DevTools')) {
      console.log('PAGE LOG:', text);
    }
  });
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  page.on('response', response => {
    if (response.url().includes('/auth/login')) {
      console.log('Auth Response:', response.status(), response.statusText());
    }
  });
  
  console.log('Navigating to signin page...');
  await page.goto('http://localhost:3000/auth/signin', { waitUntil: 'networkidle0' });
  
  console.log('Waiting for form elements...');
  await page.waitForSelector('#email', { timeout: 5000 });
  
  console.log('Filling in the form...');
  await page.type('#email', 'admin@soc-compliance.com');
  await page.type('#password', 'Admin@123!');
  
  console.log('Clicking submit button...');
  // Find and click the submit button
  const submitButton = await page.$('button[type="submit"]');
  if (submitButton) {
    await submitButton.click();
  } else {
    // Try to find by text content
    await page.evaluate(() => {
      const buttons = document.querySelectorAll('button');
      for (const button of buttons) {
        if (button.textContent.includes('Sign in')) {
          button.click();
          break;
        }
      }
    });
  }
  
  // Wait for navigation or error
  console.log('Waiting for response...');
  await page.waitForTimeout(3000);
  
  // Check current URL
  const url = page.url();
  console.log('Current URL:', url);
  
  // Check for success (redirected to dashboard)
  if (url.includes('/dashboard')) {
    console.log('✅ SUCCESS: Login successful, redirected to dashboard');
  } else if (url.includes('/auth/signin')) {
    // Check for error messages
    const errorMessages = await page.$$eval('[role="alert"]', elements => 
      elements.map(el => el.textContent)
    );
    
    if (errorMessages.length > 0) {
      console.log('❌ ERROR: Login failed with errors:', errorMessages);
    } else {
      console.log('⚠️  WARNING: Still on signin page, checking for other issues...');
      
      // Check for any visible error text
      const pageText = await page.evaluate(() => document.body.innerText);
      if (pageText.includes('error') || pageText.includes('failed')) {
        console.log('Found error text on page');
      }
    }
  }
  
  await browser.close();
  console.log('Test complete');
})().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});