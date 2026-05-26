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

  // 先停止当前流程
  const r0 = await client.Runtime.evaluate({
    expression: `new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'STOP_FLOW', source: 'sidepanel', payload: {} }, (response) => {
        resolve(response || 'sent');
      });
    })`,
    awaitPromise: true,
    returnByValue: true,
  });
  console.log('Stop flow:', JSON.stringify(r0.result.value));

  await new Promise(r => setTimeout(r, 3000));

  // 通过扩展的PATCH_HOTMAIL_ACCOUNT消息标记已用
  const r1 = await client.Runtime.evaluate({
    expression: `new Promise((resolve) => {
      chrome.runtime.sendMessage({
        type: 'PATCH_HOTMAIL_ACCOUNT',
        source: 'sidepanel',
        payload: { accountId: 'hotmail-0', updates: { used: true } }
      }, (response) => {
        resolve(response);
      });
    })`,
    awaitPromise: true,
    returnByValue: true,
  });
  console.log('Patch hotmail-0:', JSON.stringify(r1.result.value));

  const r2 = await client.Runtime.evaluate({
    expression: `new Promise((resolve) => {
      chrome.runtime.sendMessage({
        type: 'PATCH_HOTMAIL_ACCOUNT',
        source: 'sidepanel',
        payload: { accountId: 'hotmail-4', updates: { used: true } }
      }, (response) => {
        resolve(response);
      });
    })`,
    awaitPromise: true,
    returnByValue: true,
  });
  console.log('Patch hotmail-4:', JSON.stringify(r2.result.value));

  // 验证
  const r3 = await client.Runtime.evaluate({
    expression: `new Promise((resolve) => {
      chrome.storage.local.get(['hotmailAccounts'], (result) => {
        const accounts = result.hotmailAccounts || [];
        const summary = accounts.map(a => a.email + ': used=' + a.used);
        resolve(summary.join('\\n'));
      });
    })`,
    awaitPromise: true,
    returnByValue: true,
  });
  console.log('After patch:');
  console.log(r3.result.value);

  await client.close();
}

main().catch(e => console.error(e.message));