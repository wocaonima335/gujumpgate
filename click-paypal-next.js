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
  
  // Find and click the Next/Submit button on PayPal login page
  const r = await client.Runtime.evaluate({
    expression: `(() => {
      // Find all buttons
      const buttons = [...document.querySelectorAll('button, [type="submit"], [role="button"]')];
      const nextBtn = buttons.find(b => {
        const text = b.textContent?.trim()?.toLowerCase() || '';
        return text.includes('next') || text.includes('继续') || text.includes('log in') || text.includes('登录') || b.type === 'submit';
      });
      
      if (nextBtn) {
        nextBtn.click();
        return 'Clicked: ' + nextBtn.textContent?.trim()?.substring(0, 30);
      }
      
      // Try clicking the form submit
      const form = document.querySelector('form');
      if (form) {
        form.submit();
        return 'Submitted form';
      }
      
      // List all visible buttons for debugging
      const visibleButtons = buttons.filter(b => b.offsetParent !== null).map(b => ({
        text: b.textContent?.trim()?.substring(0, 40),
        type: b.type || b.tagName,
        id: b.id,
      }));
      return JSON.stringify({ error: 'No next button found', buttons: visibleButtons });
    })()`,
    returnByValue: true,
  });
  console.log('Result:', r.result.value);
  
  // Wait and check page state
  await new Promise(r => setTimeout(r, 5000));
  const r2 = await client.Runtime.evaluate({
    expression: `JSON.stringify({
      url: location.href.substring(0, 100),
      title: document.title,
      bodyPreview: document.body.innerText.substring(0, 300),
    })`,
    returnByValue: true,
  });
  console.log('After click:', r2.result.value);
  
  await client.close();
}

main().catch(e => console.error(e.message));