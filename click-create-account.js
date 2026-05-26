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
  const { Input } = client;
  
  // Find and click "Create an Account" button
  const r1 = await client.Runtime.evaluate({
    expression: `(() => {
      const buttons = [...document.querySelectorAll('button, a')];
      const createBtn = buttons.find(b => {
        const text = b.textContent?.trim()?.toLowerCase() || '';
        return text.includes('create') && text.includes('account');
      });
      if (createBtn) {
        const rect = createBtn.getBoundingClientRect();
        return JSON.stringify({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, text: createBtn.textContent?.trim() });
      }
      return JSON.stringify({ error: 'no create account button' });
    })()`,
    returnByValue: true,
  });
  console.log('Create Account button:', r1.result.value);
  
  const btnPos = JSON.parse(r1.result.value);
  if (!btnPos.error) {
    await Input.dispatchMouseEvent({ type: 'mousePressed', x: btnPos.x, y: btnPos.y, button: 'left', clickCount: 1 });
    await Input.dispatchMouseEvent({ type: 'mouseReleased', x: btnPos.x, y: btnPos.y, button: 'left', clickCount: 1 });
    console.log('Clicked Create Account');
  }
  
  // Wait for page change
  await new Promise(r => setTimeout(r, 8000));
  
  const r2 = await client.Runtime.evaluate({
    expression: `JSON.stringify({
      url: location.href.substring(0, 100),
      title: document.title,
      bodyPreview: document.body.innerText.substring(0, 500),
    })`,
    returnByValue: true,
  });
  console.log('After Create Account:', r2.result.value);
  
  await client.close();
}

main().catch(e => console.error(e.message));