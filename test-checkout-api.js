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
  
  // Find a chatgpt tab
  const tab = targets.find(t => t.url.includes('chatgpt.com') && !t.url.includes('sidepanel') && !t.url.includes('background'));
  if (!tab) { console.log('No chatgpt tab'); return; }
  
  const client = await CDP({ target: tab.webSocketDebuggerUrl });
  
  // First get accessToken
  const sessionR = await client.Runtime.evaluate({
    expression: `fetch('/api/auth/session', {credentials:'include'}).then(r=>r.json())`,
    awaitPromise: true,
    returnByValue: true,
  });
  
  const session = JSON.parse(sessionR.result.value);
  const accessToken = session?.accessToken;
  if (!accessToken) {
    console.log('No accessToken. Session:', JSON.stringify(session).substring(0, 200));
    await client.close();
    return;
  }
  console.log('Got accessToken:', accessToken.substring(0, 30) + '...');
  
  // Try checkout with promo
  const checkoutR = await client.Runtime.evaluate({
    expression: `fetch('https://chatgpt.com/backend-api/payments/checkout', {
      method: 'POST',
      credentials: 'include',
      headers: {
        Authorization: 'Bearer ${accessToken}',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        entry_point: 'all_plans_pricing_modal',
        plan_name: 'chatgptplusplan',
        promo_campaign: { promo_campaign_id: 'plus-1-month-free', is_coupon_from_query_param: false },
        checkout_ui_mode: 'hosted',
        billing_details: { name: 'John Doe', email: '', phone: '1234567890', address: { line1: '5715 Saint Matthew Dr', city: 'Newark', state: 'California', postal_code: '94560', country: 'US' } },
      }),
    }).then(r => r.json().then(d => JSON.stringify({status: r.status, data: d})))`,
    awaitPromise: true,
    returnByValue: true,
  });
  
  console.log('Checkout response:', checkoutR.result.value);
  await client.close();
}

main().catch(e => console.error(e.message));