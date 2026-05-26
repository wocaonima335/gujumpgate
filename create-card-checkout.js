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
  
  // Find the ChatGPT tab (logged in)
  const chatgptTab = targets.find(t => t.url.includes('chatgpt.com') && !t.url.includes('sidepanel') && !t.url.includes('background'));
  if (!chatgptTab) { console.log('No chatgpt tab'); return; }
  
  const client = await CDP({ target: chatgptTab.webSocketDebuggerUrl });
  
  // Get accessToken
  const r1 = await client.Runtime.evaluate({
    expression: `fetch('/api/auth/session', {credentials:'include'}).then(r=>r.text())`,
    awaitPromise: true,
    returnByValue: true,
  });
  let accessToken = '';
  try { accessToken = JSON.parse(r1.result.value)?.accessToken || ''; } catch(e) {}
  if (!accessToken) { console.log('No accessToken'); await client.close(); return; }
  console.log('Got accessToken');
  
  // Create a NEW checkout session (card mode, not PayPal hosted)
  const payload = {
    entry_point: 'all_plans_pricing_modal',
    plan_name: 'chatgptplusplan',
    promo_campaign: { promo_campaign_id: 'plus-1-month-free', is_coupon_from_query_param: false },
    checkout_ui_mode: 'custom',  // custom = card, hosted = PayPal
    billing_details: {
      name: 'James Smith',
      email: '',
      phone: '16562710160',
      currency: 'USD',
      address: { line1: '520 Lunetta Street', city: 'Fort Worth', state: 'Texas', postal_code: '76104', country: 'US' },
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
  
  const d = JSON.parse(r2.result.value);
  console.log('Checkout session:', d.checkout_session_id?.substring(0, 30));
  console.log('Checkout URL:', d.url?.substring(0, 80));
  console.log('checkout_ui_mode:', d.checkout_ui_mode);
  
  if (d.url) {
    // Navigate to the checkout page
    await client.Page.enable();
    await client.Page.navigate({ url: d.url });
    await client.Page.loadEventFired();
    await new Promise(r => setTimeout(r, 10000));
    
    // Check the page
    const r3 = await client.Runtime.evaluate({
      expression: `JSON.stringify({
        url: location.href.substring(0, 100),
        title: document.title,
        bodyPreview: document.body.innerText.substring(0, 500),
        hasCardInput: !!document.querySelector('input[name="cardNumber"], input[name="number"], #cardNumber'),
        hasPayPal: document.body.innerText.toLowerCase().includes('paypal'),
      })`,
      returnByValue: true,
    });
    console.log('Card checkout page:', r3.result.value);
  }
  
  await client.close();
}

main().catch(e => console.error(e.message));