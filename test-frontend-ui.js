const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  
  // Enable console logging
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  
  await page.goto('http://localhost:3000/auth/signin');
  await page.waitForSelector('#email');
  
  // Fill in the form
  await page.type('#email', 'admin@soc-compliance.com');
  await page.type('#password', 'Admin@123!');
  
  // Take a screenshot before submitting
  await page.screenshot({ path: 'before-submit.png' });
  
  // Click the submit button
  const submitButton = await page.$('button[type="submit"]');
  if (submitButton) {
    console.log('Found submit button, clicking...');
    await submitButton.click();
  } else {
    // Try to find by text content
    const buttons = await page.$$('button');
    for (const button of buttons) {
      const text = await page.evaluate(el => el.textContent, button);
      if (text.includes('Sign in')) {
        console.log('Found sign in button by text, clicking...');
        await button.click();
        break;
      }
    }
  }
  
  // Wait for navigation or error
  await page.waitForTimeout(2000);
  
  // Take a screenshot after submitting
  await page.screenshot({ path: 'after-submit.png' });
  
  // Get the current URL
  const url = page.url();
  console.log('Current URL:', url);
  
  // Check for any error messages
  const errorMessages = await page.$$eval('[role="alert"]', elements => 
    elements.map(el => el.textContent)
  );
  
  if (errorMessages.length > 0) {
    console.log('Error messages:', errorMessages);
  }
  
  // Don't close the browser so we can inspect
  console.log('Browser will remain open for inspection...');
})();