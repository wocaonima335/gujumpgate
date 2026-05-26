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
  
  // Step 1: Click "Sign Up" button to create a new PayPal account
  const r1 = await client.Runtime.evaluate({
    expression: `(() => {
      const links = [...document.querySelectorAll('a, button')];
      const signUp = links.find(b => {
        const t = b.textContent?.trim()?.toLowerCase() || '';
        return t.includes('sign up') || t.includes('create') || t.includes('注册');
      });
      if (!signUp) return JSON.stringify({error:'no signup', links: links.filter(l=>l.offsetParent!==null).map(l=>l.textContent?.trim()?.substring(0,40)).slice(0,15)});
      const rect = signUp.getBoundingClientRect();
      return JSON.stringify({x: rect.x + rect.width/2, y: rect.y + rect.height/2, text: signUp.textContent?.trim()});
    })()`,
    returnByValue: true,
  });
  const signUpPos = JSON.parse(r1.result.value);
  console.log('Sign Up button:', JSON.stringify(signUpPos));
  
  if (signUpPos.error) {
    console.log('No Sign Up button found');
    await client.close();
    return;
  }
  
  await Input.dispatchMouseEvent({ type: 'mousePressed', x: signUpPos.x, y: signUpPos.y, button: 'left', clickCount: 1 });
  await Input.dispatchMouseEvent({ type: 'mouseReleased', x: signUpPos.x, y: signUpPos.y, button: 'left', clickCount: 1 });
  console.log('Clicked Sign Up');
  
  // Wait for page to load
  await new Promise(r => setTimeout(r, 10000));
  
  // Check what page we're on now
  const r2 = await client.Runtime.evaluate({
    expression: `JSON.stringify({
      url: location.href.substring(0, 120),
      title: document.title,
      bodyPreview: document.body.innerText.substring(0, 600),
    })`,
    returnByValue: true,
  });
  console.log('After Sign Up:', r2.result.value.substring(0, 500));
  
  await client.close();
}

main().catch(e => console.error(e.message));