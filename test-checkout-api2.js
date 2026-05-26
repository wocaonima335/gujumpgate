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
  
  const tab = targets.find(t => t.url.includes('chatgpt.com') && !t.url.includes('sidepanel') && !t.url.includes('background'));
  if (!tab) { console.log('No chatgpt tab'); return; }
  
  const client = await CDP({ target: tab.webSocketDebuggerUrl });
  
  // Get accessToken first
  const r1 = await client.Runtime.evaluate({
    expression: `fetch('/api/auth/session', {credentials:'include'}).then(r=>r.text())`,
    awaitPromise: true,
    returnByValue: true,
  });
  
  let accessToken = '';
  try {
    const session = JSON.parse(r1.result.value);
    accessToken = session?.accessToken || '';
  } catch(e) {}
  
  if (!accessToken) {
    console.log('No accessToken. Response:', r1.result.value.substring(0, 300));
    await client.close();
    return;
  }
  console.log('Got accessToken:', accessToken.substring(0, 30) + '...');
  
  // Create checkout
  const payload = JSON.stringify({
    entry_point: 'all_plans_pricing_modal',
    plan_name: 'chatgptplusplan',
    promo_campaign: { promo_campaign_id: 'plus-1-month-free', is_coupon_from_query_param: false },
    checkout_ui_mode: 'hosted',
    billing_details: { name: 'John Doe', email: '', phone: '1234567890', address: { line1: '5715 Saint Matthew Dr', city: 'Newark', state: 'California', postal_code: '94560', country: 'US' } },
  });
  
  const r2 = await client.Runtime.evaluate({
    expression: `fetch('https://chatgpt.com/backend-api/payments/checkout', {
      method: 'POST',
      credentials: 'include',
      headers: {
        Authorization: 'Bearer ${accessToken}',
        'Content-Type': 'application/json',
      },
      body: '${payload.replace(/'/g, "\\'")}',
    }).then(r => r.text())`,
    awaitPromise: true,
    returnByValue: true,
  });
  
  console.log('Checkout response:', r2.result.value.substring(0, 500));
  await client.close();
}

main().catch(e => console.error(e.message));