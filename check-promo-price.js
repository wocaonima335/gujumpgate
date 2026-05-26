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
  
  // Navigate to the promo checkout URL
  const promoUrl = 'https://pay.openai.com/c/pay/cs_live_a13HTSE4hu5ec7zzJyaUefaE1Jxp7cyrEGTgucf60u3y4DR4C7dsEJXIAY';
  
  await client.Page.enable();
  await client.Page.navigate({ url: promoUrl });
  await client.Page.loadEventFired();
  
  // Wait for page to fully load
  await new Promise(r => setTimeout(r, 8000));
  
  const r = await client.Runtime.evaluate({
    expression: `document.body.innerText.substring(0, 1000)`,
    returnByValue: true,
  });
  console.log('Stripe page content:', r.result.value);
  
  await client.close();
}

main().catch(e => console.error(e.message));