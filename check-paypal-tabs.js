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
  
  // Check the newer PayPal tab (the one we clicked Create Account on)
  const paypalTabs = targets.filter(t => t.url.includes('paypal.com') && t.type === 'page');
  for (const tab of paypalTabs) {
    const client = await CDP({ target: tab.webSocketDebuggerUrl });
    const r = await client.Runtime.evaluate({
      expression: `JSON.stringify({
        url: location.href.substring(0, 120),
        title: document.title,
        bodyPreview: document.body.innerText.substring(0, 500),
      })`,
      returnByValue: true,
    });
    console.log('Tab:', r.result.value.substring(0, 400));
    console.log('---');
    await client.close();
  }
}

main().catch(e => console.error(e.message));