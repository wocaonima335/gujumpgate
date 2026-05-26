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

  const stripe = targets.find(t => t.url && t.url.includes('pay.openai.com'));
  if (!stripe) { console.log('No Stripe page found'); return; }

  const client = await CDP({ target: stripe.webSocketDebuggerUrl });
  const r = await client.Runtime.evaluate({
    expression: `JSON.stringify({
      title: document.title,
      bodyText: document.body?.innerText?.substring(0, 1500) || 'no body',
      hasPayPal: /paypal/i.test(document.body?.innerText || ''),
      hasCard: /card|credit/i.test(document.body?.innerText || ''),
      buttons: [...document.querySelectorAll('button, [role=button]')].map(e => e.textContent.trim()).filter(Boolean).slice(0, 15),
      links: [...document.querySelectorAll('a')].map(e => e.textContent.trim()).filter(Boolean).slice(0, 10),
    })`,
    returnByValue: true,
  });
  console.log(r.result.value);
  await client.close();
}

main().catch(e => console.error(e.message));
