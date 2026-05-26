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
  const { Input, DOM } = client;
  
  // Use CDP Input.dispatchKeyEvent to type character by character
  // First find the email input box coordinates
  const r1 = await client.Runtime.evaluate({
    expression: `(() => {
      const input = document.getElementById('email') || document.querySelector('input[type="email"], input[name="login_email"]');
      if (!input) return JSON.stringify({ error: 'no input' });
      const rect = input.getBoundingClientRect();
      return JSON.stringify({
        x: rect.x + rect.width / 2,
        y: rect.y + rect.height / 2,
        width: rect.width,
        height: rect.height,
        id: input.id,
        name: input.name,
      });
    })()`,
    returnByValue: true,
  });
  console.log('Input position:', r1.result.value);
  
  const pos = JSON.parse(r1.result.value);
  if (pos.error) { console.log('No input found'); await client.close(); return; }
  
  // Click on the input to focus it
  await Input.dispatchMouseEvent({ type: 'mousePressed', x: pos.x, y: pos.y, button: 'left', clickCount: 1 });
  await Input.dispatchMouseEvent({ type: 'mouseReleased', x: pos.x, y: pos.y, button: 'left', clickCount: 1 });
  await new Promise(r => setTimeout(r, 500));
  
  // Type email character by character
  const email = 'testcheckout' + Math.random().toString(36).substring(2, 8) + '@gmail.com';
  for (const char of email) {
    await Input.dispatchKeyEvent({ type: 'keyDown', text: char });
    await Input.dispatchKeyEvent({ type: 'keyUp', text: char });
    await new Promise(r => setTimeout(r, 50));
  }
  console.log('Typed email:', email);
  
  await new Promise(r => setTimeout(r, 1000));
  
  // Find and click the Next button
  const r2 = await client.Runtime.evaluate({
    expression: `(() => {
      const buttons = [...document.querySelectorAll('button')];
      const nextBtn = buttons.find(b => {
        const text = b.textContent?.trim()?.toLowerCase() || '';
        return text === 'next' || text === '继续';
      });
      if (nextBtn) {
        const rect = nextBtn.getBoundingClientRect();
        return JSON.stringify({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, text: nextBtn.textContent?.trim() });
      }
      // Try submit button
      const submitBtn = buttons.find(b => b.type === 'submit');
      if (submitBtn) {
        const rect = submitBtn.getBoundingClientRect();
        return JSON.stringify({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, text: submitBtn.textContent?.trim() || '(submit)' });
      }
      return JSON.stringify({ error: 'no next button', buttons: buttons.map(b => b.textContent?.trim()?.substring(0, 30)) });
    })()`,
    returnByValue: true,
  });
  console.log('Next button:', r2.result.value);
  
  const btnPos = JSON.parse(r2.result.value);
  if (!btnPos.error) {
    await Input.dispatchMouseEvent({ type: 'mousePressed', x: btnPos.x, y: btnPos.y, button: 'left', clickCount: 1 });
    await Input.dispatchMouseEvent({ type: 'mouseReleased', x: btnPos.x, y: btnPos.y, button: 'left', clickCount: 1 });
    console.log('Clicked Next button');
  }
  
  // Wait for page change
  await new Promise(r => setTimeout(r, 8000));
  
  const r3 = await client.Runtime.evaluate({
    expression: `JSON.stringify({
      url: location.href.substring(0, 100),
      title: document.title,
      bodyPreview: document.body.innerText.substring(0, 400),
    })`,
    returnByValue: true,
  });
  console.log('After Next:', r3.result.value);
  
  await client.close();
}

main().catch(e => console.error(e.message));