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
  
  const tab = targets.find(t => t.type === 'page' && !t.url.includes('sidepanel') && !t.url.includes('background') && !t.url.includes('chrome-extension'));
  if (!tab) { console.log('No usable tab'); return; }
  
  const client = await CDP({ target: tab.webSocketDebuggerUrl });
  
  // Use chatgpt.com endpoint to check IP (it goes through JP proxy)
  const r = await client.Runtime.evaluate({
    expression: `fetch('https://chatgpt.com/cdn-cgi/trace').then(r=>r.text())`,
    awaitPromise: true,
    returnByValue: true,
  });
  console.log('ChatGPT trace (via JP proxy):');
  console.log(r.result.value);
  
  await client.close();
}

main().catch(e => console.error(e.message));