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
  
  // Find the first chatgpt.com tab (not auth/error)
  const chatgptTab = targets.find(t => t.url === 'https://chatgpt.com/' && !t.url.includes('auth'));
  if (!chatgptTab) { console.log('No chatgpt tab found'); return; }
  
  const client = await CDP({ target: chatgptTab.webSocketDebuggerUrl });
  const r = await client.Runtime.evaluate({
    expression: `(() => {
      const url = location.href;
      const body = document.body.innerText.substring(0, 500);
      const cookies = document.cookie;
      return JSON.stringify({url, body: body.substring(0, 300), hasCookie: cookies.length > 0, cookieKeys: cookies.split(';').map(c => c.trim().split('=')[0]).filter(Boolean)});
    })()`,
    returnByValue: true,
  });
  console.log(r.result.value);
  await client.close();
}

main().catch(e => console.error(e.message));