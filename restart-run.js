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
  
  // 先停止当前运行
  console.log('Stopping current run...');
  const r1 = await client.Runtime.evaluate({
    expression: `new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'STOP_AUTO_RUN' }, (response) => {
        resolve(response || 'no response');
      });
    })`,
    awaitPromise: true,
    returnByValue: true,
  });
  console.log('Stop result:', JSON.stringify(r1.result.value));

  await new Promise(r => setTimeout(r, 3000));

  // 重新发送AUTO_RUN
  console.log('Sending AUTO_RUN...');
  const r2 = await client.Runtime.evaluate({
    expression: `new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'AUTO_RUN' }, (response) => {
        resolve(response);
      });
    })`,
    awaitPromise: true,
    returnByValue: true,
  });
  console.log('AUTO_RUN result:', JSON.stringify(r2.result.value));

  await client.close();
}

main().catch(e => console.error(e.message));