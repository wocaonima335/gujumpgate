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
  
  const paypalTab = targets.find(t => t.url.includes('paypal.com') && t.type === 'page');
  if (!paypalTab) { console.log('No PayPal tab'); return; }
  
  const client = await CDP({ target: paypalTab.webSocketDebuggerUrl });
  const r = await client.Runtime.evaluate({
    expression: `JSON.stringify({
      url: location.href.substring(0, 150),
      title: document.title,
      bodyPreview: document.body.innerText.substring(0, 800),
    })`,
    returnByValue: true,
  });
  console.log(r.result.value);
  await client.close();
}

main().catch(e => console.error(e.message));