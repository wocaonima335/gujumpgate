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

  const sidepanel = targets.find(t => t.title && t.title.includes('GuJumpgate'));
  if (!sidepanel) { console.log('No sidepanel found'); return; }

  const client = await CDP({ target: sidepanel.webSocketDebuggerUrl });
  
  // 读取hotmail账号使用状态
  const r = await client.Runtime.evaluate({
    expression: `new Promise((resolve) => {
      chrome.storage.local.get(['hotmailAccounts'], (result) => {
        const accounts = result.hotmailAccounts || [];
        const summary = accounts.map(a => ({
          email: a.email,
          used: a.used,
          status: a.status,
        }));
        resolve(JSON.stringify(summary));
      });
    })`,
    awaitPromise: true,
    returnByValue: true,
  });
  console.log('Hotmail accounts status:');
  console.log(r.result.value);

  await client.close();
}

main().catch(e => console.error(e.message));