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
  
  const basePayload = {
    entry_point: 'all_plans_pricing_modal',
    plan_name: 'chatgptplusplan',
    checkout_ui_mode: 'hosted',
    billing_details: {
      name: 'John Doe',
      email: '',
      phone: '1234567890',
      currency: 'USD',
      address: { line1: '5715 Saint Matthew Dr', city: 'Newark', state: 'California', postal_code: '94560', country: 'US' },
    },
  };
  
  const payloadWithPromo = {
    ...basePayload,
    promo_campaign: { promo_campaign_id: 'plus-1-month-free', is_coupon_from_query_param: false },
  };
  
  for (const [label, payload] of [['WITH promo plus-1-month-free', payloadWithPromo], ['WITHOUT promo', basePayload]]) {
    const bodyStr = JSON.stringify(payload).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');
    const r2 = await client.Runtime.evaluate({
      expression: `fetch('https://chatgpt.com/backend-api/payments/checkout', {
        method: 'POST',
        credentials: 'include',
        headers: {
          Authorization: 'Bearer ${accessToken}',
          'Content-Type': 'application/json',
        },
        body: '${bodyStr}',
      }).then(r => r.text())`,
      awaitPromise: true,
      returnByValue: true,
    });
    console.log(`\n=== ${label} ===`);
    try {
      const d = JSON.parse(r2.result.value);
      console.log('checkout_session_id:', d.checkout_session_id || 'N/A');
      console.log('checkout_url:', d.checkout_url || 'N/A');
      console.log('amount:', d.amount || d.total || 'N/A');
      console.log('Full keys:', Object.keys(d).join(', '));
      // Print first 600 chars
      console.log('Full:', JSON.stringify(d).substring(0, 600));
    } catch(e) {
      console.log('Raw:', r2.result.value.substring(0, 600));
    }
  }
  
  await client.close();
}

main().catch(e => console.error(e.message));