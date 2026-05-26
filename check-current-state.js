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
  
  // Find chatgpt tabs
  const chatgptTabs = targets.filter(t => t.url.includes('chatgpt.com') && !t.url.includes('sidepanel') && !t.url.includes('background'));
  console.log(`ChatGPT tabs: ${chatgptTabs.length}`);
  for (const t of chatgptTabs) {
    console.log(`  ${t.url.substring(0, 80)}`);
  }
  
  // Get the first chatgpt tab
  const tab = chatgptTabs[0];
  if (!tab) { console.log('No chatgpt tab'); return; }
  
  const client = await CDP({ target: tab.webSocketDebuggerUrl });
  const r = await client.Runtime.evaluate({
    expression: `(() => {
      return JSON.stringify({
        url: location.href,
        title: document.title,
        bodyText: document.body?.innerText?.substring(0, 300) || '',
      });
    })()`,
    returnByValue: true,
  });
  console.log('\nFirst tab state:', r.result.value);
  await client.close();
}

main().catch(e => console.error(e.message));