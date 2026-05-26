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
  
  const paypalTab = targets.find(t => t.url.includes('paypal.com'));
  if (!paypalTab) { console.log('No PayPal tab'); return; }
  
  const client = await CDP({ target: paypalTab.webSocketDebuggerUrl });
  const r = await client.Runtime.evaluate({
    expression: `(() => {
      const text = document.body.innerText;
      const buttons = [...document.querySelectorAll('button, a, [role="button"]')].map(el => ({
        text: el.textContent?.trim()?.substring(0, 60),
        type: el.tagName,
        visible: el.offsetParent !== null,
      })).filter(b => b.visible && b.text);
      return JSON.stringify({
        url: location.href.substring(0, 100),
        title: document.title,
        bodyPreview: text.substring(0, 500),
        buttons: buttons.slice(0, 15),
      });
    })()`,
    returnByValue: true,
  });
  console.log(r.result.value);
  await client.close();
}

main().catch(e => console.error(e.message));