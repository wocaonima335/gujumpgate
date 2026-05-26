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
  const { Input } = client;
  
  // Step 1: Find email input and click to focus
  const r1 = await client.Runtime.evaluate({
    expression: `(() => {
      const input = document.getElementById('email');
      if (!input) return JSON.stringify({error:'no input'});
      const rect = input.getBoundingClientRect();
      input.focus();
      return JSON.stringify({x: rect.x + rect.width/2, y: rect.y + rect.height/2});
    })()`,
    returnByValue: true,
  });
  const pos = JSON.parse(r1.result.value);
  if (pos.error) { console.log('No email input'); await client.close(); return; }
  
  // Click to focus
  await Input.dispatchMouseEvent({ type: 'mousePressed', x: pos.x, y: pos.y, button: 'left', clickCount: 1 });
  await Input.dispatchMouseEvent({ type: 'mouseReleased', x: pos.x, y: pos.y, button: 'left', clickCount: 1 });
  await new Promise(r => setTimeout(r, 300));
  
  // Step 2: Type email using CDP Input events
  const email = 'jamesmith' + Math.floor(Math.random()*90000+10000) + '@gmail.com';
  for (const ch of email) {
    await Input.dispatchKeyEvent({ type: 'char', text: ch });
    await new Promise(r => setTimeout(r, 30));
  }
  console.log('Typed email:', email);
  
  await new Promise(r => setTimeout(r, 500));
  
  // Step 3: Find and click Next button
  const r2 = await client.Runtime.evaluate({
    expression: `(() => {
      // Find the visible Next/submit button
      const btns = [...document.querySelectorAll('button')].filter(b => b.offsetParent !== null);
      const nextBtn = btns.find(b => {
        const t = b.textContent?.trim()?.toLowerCase() || '';
        return t === 'next' || t === '次へ' || b.type === 'submit';
      });
      if (!nextBtn) return JSON.stringify({error:'no next', btns: btns.map(b=>b.textContent?.trim()?.substring(0,30))});
      const rect = nextBtn.getBoundingClientRect();
      return JSON.stringify({x: rect.x + rect.width/2, y: rect.y + rect.height/2, text: nextBtn.textContent?.trim()});
    })()`,
    returnByValue: true,
  });
  const btnPos = JSON.parse(r2.result.value);
  console.log('Next button:', JSON.stringify(btnPos));
  
  if (!btnPos.error) {
    await Input.dispatchMouseEvent({ type: 'mousePressed', x: btnPos.x, y: btnPos.y, button: 'left', clickCount: 1 });
    await Input.dispatchMouseEvent({ type: 'mouseReleased', x: btnPos.x, y: btnPos.y, button: 'left', clickCount: 1 });
    console.log('Clicked Next');
  }
  
  // Step 4: Wait and check result
  await new Promise(r => setTimeout(r, 10000));
  
  const r3 = await client.Runtime.evaluate({
    expression: `JSON.stringify({
      url: location.href.substring(0, 120),
      title: document.title,
      bodyPreview: document.body.innerText.substring(0, 600),
    })`,
    returnByValue: true,
  });
  console.log('After Next:', r3.result.value.substring(0, 500));
  
  await client.close();
}

main().catch(e => console.error(e.message));