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
  
  // Check email input and fill it
  const r = await client.Runtime.evaluate({
    expression: `(() => {
      const emailInput = document.getElementById('email') || document.querySelector('input[type="email"], input[name="login_email"], input[autocomplete="email"]');
      if (!emailInput) {
        const inputs = [...document.querySelectorAll('input')].map(i => ({
          id: i.id, name: i.name, type: i.type, placeholder: i.placeholder, visible: i.offsetParent !== null
        }));
        return JSON.stringify({ error: 'No email input', inputs });
      }
      
      // Fill email with a random gmail address
      const email = 'testcheckout' + Math.random().toString(36).substring(2, 10) + '@gmail.com';
      emailInput.value = '';
      emailInput.focus();
      emailInput.value = email;
      emailInput.dispatchEvent(new Event('input', { bubbles: true }));
      emailInput.dispatchEvent(new Event('change', { bubbles: true }));
      
      // Find and click Next button
      const buttons = [...document.querySelectorAll('button, [type="submit"]')];
      const nextBtn = buttons.find(b => {
        const text = b.textContent?.trim()?.toLowerCase() || '';
        return text.includes('next') || text.includes('继续') || b.type === 'submit';
      });
      
      if (nextBtn) {
        nextBtn.click();
        return JSON.stringify({ filled: email, clicked: nextBtn.textContent?.trim()?.substring(0, 30) });
      }
      
      return JSON.stringify({ filled: email, noNextButton: true, buttons: buttons.map(b => b.textContent?.trim()?.substring(0, 30)) });
    })()`,
    returnByValue: true,
  });
  console.log('Fill result:', r.result.value);
  
  // Wait for page to change
  await new Promise(r => setTimeout(r, 8000));
  
  const r2 = await client.Runtime.evaluate({
    expression: `JSON.stringify({
      url: location.href.substring(0, 100),
      title: document.title,
      bodyPreview: document.body.innerText.substring(0, 400),
    })`,
    returnByValue: true,
  });
  console.log('After fill+click:', r2.result.value);
  
  await client.close();
}

main().catch(e => console.error(e.message));