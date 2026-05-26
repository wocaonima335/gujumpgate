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
  
  // Find the OAuth error tab
  const errorTab = targets.find(t => t.url.includes('auth/error'));
  if (!errorTab) { console.log('No OAuth error tab found'); return; }
  
  console.log('OAuth Error Tab URL:', errorTab.url);
  console.log('OAuth Error Tab Title:', errorTab.title);
  
  const client = await CDP({ target: errorTab.webSocketDebuggerUrl });
  const r = await client.Runtime.evaluate({
    expression: `document.body.innerText`,
    returnByValue: true,
  });
  console.log('Page content:', r.result.value);
  await client.close();
}

main().catch(e => console.error(e.message));