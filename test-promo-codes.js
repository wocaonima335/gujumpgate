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
  
  const tab = targets.find(t => t.type === 'page' && !t.url.includes('sidepanel') && !t.url.includes('background') && !t.url.includes('chrome-extension'));
  if (!tab) { console.log('No usable tab'); return; }
  
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
  
  // Try different promo codes
  const promoCodes = [
    null,  // no promo
    'plus-1-month-free',
    'chatgpt-plus-free-trial',
    'free-trial',
    'plus-free-month',
  ];
  
  for (const promoId of promoCodes) {
    const payload = {
      entry_point: 'all_plans_pricing_modal',
      plan_name: 'chatgptplusplan',
      checkout_ui_mode: 'hosted',
      billing_details: {
        name: 'John Doe', email: '', phone: '1234567890', currency: 'USD',
        address: { line1: '5715 Saint Matthew Dr', city: 'Newark', state: 'California', postal_code: '94560', country: 'US' },
      },
    };
    if (promoId) {
      payload.promo_campaign = { promo_campaign_id: promoId, is_coupon_from_query_param: false };
    }
    
    const bodyStr = JSON.stringify(payload).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');
    const label = promoId || 'NO_PROMO';
    
    const r2 = await client.Runtime.evaluate({
      expression: `fetch('https://chatgpt.com/backend-api/payments/checkout', {
        method: 'POST', credentials: 'include',
        headers: { Authorization: 'Bearer ${accessToken}', 'Content-Type': 'application/json' },
        body: '${bodyStr}',
      }).then(r => r.text())`,
      awaitPromise: true,
      returnByValue: true,
    });
    
    try {
      const d = JSON.parse(r2.result.value);
      console.log(`${label}: session=${d.checkout_session_id?.substring(0,20) || 'FAIL'}, url=${d.url?.substring(0,60) || 'N/A'}, error=${d.detail || 'none'}`);
    } catch(e) {
      console.log(`${label}: parse error: ${r2.result.value.substring(0, 100)}`);
    }
  }
  
  await client.close();
}

main().catch(e => console.error(e.message));