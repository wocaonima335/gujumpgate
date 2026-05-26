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
  const chatgpt = targets.find(t => t.url && t.url.includes('chatgpt.com'));
  if (!chatgpt) { console.log('No ChatGPT page'); return; }
  const client = await CDP({ target: chatgpt.webSocketDebuggerUrl });
  
  // 获取accessToken
  const r = await client.Runtime.evaluate({
    expression: `fetch('/api/auth/session',{credentials:'include'}).then(r=>r.json())`,
    awaitPromise: true,
    returnByValue: true,
  });
  const token = r.result.value?.accessToken;
  if (!token) { console.log('No token'); await client.close(); return; }
  console.log('Got token, length:', token.length);

  // 创建checkout session查看是否有免费试用
  const r2 = await client.Runtime.evaluate({
    expression: `fetch('https://chatgpt.com/backend-api/payments/checkout', {
      method: 'POST',
      credentials: 'include',
      headers: {
        Authorization: 'Bearer ${token}',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        entry_point: 'all_plans_pricing_modal',
        plan_name: 'chatgptplusplan',
        promo_campaign: { promo_campaign_id: 'plus-1-month-free', is_coupon_from_query_param: false },
        checkout_ui_mode: 'hosted',
        billing_details: { country: 'US', currency: 'USD' },
      }),
    }).then(r => r.json())`,
    awaitPromise: true,
    returnByValue: true,
  });
  console.log('Checkout response:', JSON.stringify(r2.result.value, null, 2).substring(0, 1000));

  await client.close();
}

main().catch(e => console.error(e.message));