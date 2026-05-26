const CDP = require('chrome-remote-interface');
const http = require('http');

async function main() {
  const targets = await new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:9222/json', res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d)));
    }).on('error', reject);
  });
  
  // Find any tab we can use
  const tab = targets.find(t => t.type === 'page' && !t.url.includes('sidepanel') && !t.url.includes('background') && !t.url.includes('chrome-extension'));
  if (!tab) { console.log('No usable tab'); return; }
  
  const client = await CDP({ target: tab.webSocketDebuggerUrl });
  await client.Page.enable();
  
  // Navigate to chatgpt.com first
  await client.Page.navigate({ url: 'https://chatgpt.com' });
  await client.Page.loadEventFired();
  await new Promise(r => setTimeout(r, 5000));
  
  // Get accessToken
  const r1 = await client.Runtime.evaluate({
    expression: `fetch('/api/auth/session', {credentials:'include'}).then(r=>r.text())`,
    awaitPromise: true,
    returnByValue: true,
  });
  let accessToken = '';
  try { accessToken = JSON.parse(r1.result.value)?.accessToken || ''; } catch(e) {}
  if (!accessToken) { 
    console.log('No accessToken. Need to login first.');
    // Check if we're logged in
    const r1b = await client.Runtime.evaluate({
      expression: `document.body.innerText.substring(0, 200)`,
      returnByValue: true,
    });
    console.log('Page content:', r1b.result.value);
    await client.close();
    return;
  }
  console.log('Got accessToken');
  
  // Create checkout with promo
  const payload = {
    entry_point: 'all_plans_pricing_modal',
    plan_name: 'chatgptplusplan',
    promo_campaign: { promo_campaign_id: 'plus-1-month-free', is_coupon_from_query_param: false },
    checkout_ui_mode: 'hosted',
    billing_details: {
      name: 'John Doe', email: '', phone: '1234567890', currency: 'USD',
      address: { line1: '5715 Saint Matthew Dr', city: 'Newark', state: 'California', postal_code: '94560', country: 'US' },
    },
  };
  const bodyStr = JSON.stringify(payload).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');
  
  const r2 = await client.Runtime.evaluate({
    expression: `fetch('https://chatgpt.com/backend-api/payments/checkout', {
      method: 'POST', credentials: 'include',
      headers: { Authorization: 'Bearer ${accessToken}', 'Content-Type': 'application/json' },
      body: '${bodyStr}',
    }).then(r => r.text())`,
    awaitPromise: true,
    returnByValue: true,
  });
  
  const checkoutData = JSON.parse(r2.result.value);
  const checkoutUrl = checkoutData.url;
  console.log('Checkout URL:', checkoutUrl ? checkoutUrl.substring(0, 80) : 'N/A');
  
  if (!checkoutUrl) {
    console.log('No checkout URL. Response:', r2.result.value.substring(0, 300));
    await client.close();
    return;
  }
  
  // Navigate to checkout page
  await client.Page.navigate({ url: checkoutUrl });
  await client.Page.loadEventFired();
  await new Promise(r => setTimeout(r, 12000));
  
  // Check the amount
  const r3 = await client.Runtime.evaluate({
    expression: `(() => {
      const text = document.body.innerText;
      const amountMatch = text.match(/\\$[\\d,.]+/g);
      const freeMatch = text.match(/free|trial|\\$0|0\\.00/gi);
      return JSON.stringify({
        amounts: amountMatch,
        freeTexts: freeMatch,
        bodyPreview: text.substring(0, 600),
      });
    })()`,
    returnByValue: true,
  });
  console.log('\nStripe page analysis:', r3.result.value);
  
  await client.close();
}

main().catch(e => console.error(e.message));