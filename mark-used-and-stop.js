const CDP = require('chrome-remote-interface');
const http = require('http');
const fs = require('fs');

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

  // 1. 标记第一个账号为已使用
  const r1 = await client.Runtime.evaluate({
    expression: `new Promise((resolve) => {
      chrome.storage.local.get(['hotmailAccounts'], (result) => {
        const accounts = result.hotmailAccounts || [];
        // 标记前2个为已用（kitsonhumphrey已注册，letitia也被尝试过）
        accounts[0].used = true;
        accounts[4].used = true; // LetitiaIngrid8871
        chrome.storage.local.set({ hotmailAccounts: accounts }, () => {
          const remaining = accounts.filter(a => !a.used);
          resolve({
            markedUsed: [accounts[0].email, accounts[4].email],
            remainingCount: remaining.length,
            nextAccount: remaining[0]?.email || 'none',
          });
        });
      });
    })`,
    awaitPromise: true,
    returnByValue: true,
  });
  console.log('Marked used:', JSON.stringify(r1.result.value));

  // 2. 停止当前流程
  const r2 = await client.Runtime.evaluate({
    expression: `new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'STOP_FLOW', source: 'sidepanel', payload: {} }, (response) => {
        resolve(response || 'sent');
      });
    })`,
    awaitPromise: true,
    returnByValue: true,
  });
  console.log('Stop flow:', JSON.stringify(r2.result.value));

  await client.close();
}

main().catch(e => console.error(e.message));