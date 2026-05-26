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
  
  const tab = targets.find(t => t.url.includes('pay.openai.com'));
  if (!tab) { console.log('No pay.openai.com tab'); return; }
  
  const client = await CDP({ target: tab.webSocketDebuggerUrl });
  await client.Page.enable();
  
  // Navigate to chatgpt.com
  await client.Page.navigate({ url: 'https://chatgpt.com' });
  await client.Page.loadEventFired();
  await new Promise(r => setTimeout(r, 5000));
  
  // Check if logged in
  const r1 = await client.Runtime.evaluate({
    expression: `fetch('/api/auth/session', {credentials:'include'}).then(r=>r.text())`,
    awaitPromise: true,
    returnByValue: true,
  });
  let accessToken = '';
  try { accessToken = JSON.parse(r1.result.value)?.accessToken || ''; } catch(e) {}
  
  if (accessToken) {
    console.log('Logged in! Token:', accessToken.substring(0, 30) + '...');
    
    // Now try checkout WITHOUT promo to see if there's a free trial by default
    const payload = {
      entry_point: 'all_plans_pricing_modal',
      plan_name: 'chatgptplusplan',
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
    
    const d = JSON.parse(r2.result.value);
    const checkoutUrl = d.url;
    console.log('Checkout URL:', checkoutUrl?.substring(0, 80));
    
    if (checkoutUrl) {
      // Navigate and check amount
      await client.Page.navigate({ url: checkoutUrl });
      await client.Page.loadEventFired();
      await new Promise(r => setTimeout(r, 12000));
      
      const r3 = await client.Runtime.evaluate({
        expression: `(() => {
          const text = document.body.innerText;
          const amounts = text.match(/\\$[\\d,.]+/g);
          const dueMatch = text.match(/due[\\s\\S]{0,50}/gi);
          const totalMatch = text.match(/total[\\s\\S]{0,50}/gi);
          return JSON.stringify({ amounts, dueTexts: dueMatch?.slice(0,3), totalTexts: totalMatch?.slice(0,3) });
        })()`,
        returnByValue: true,
      });
      console.log('NO PROMO checkout amounts:', r3.result.value);
    }
  } else {
    const r1b = await client.Runtime.evaluate({
      expression: `document.body.innerText.substring(0, 200)`,
      returnByValue: true,
    });
    console.log('Not logged in. Page:', r1b.result.value);
  }
  
  await client.close();
}

main().catch(e => console.error(e.message));