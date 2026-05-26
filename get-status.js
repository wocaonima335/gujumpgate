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
  // 获取运行状态
  const r = await client.Runtime.evaluate({
    expression: `(() => {
      // 查找所有包含"停止"或"stopped"或"error"的元素
      const all = document.body.innerText;
      // 找到日志部分
      const idx = all.lastIndexOf('日志');
      if (idx < 0) return 'no log section';
      const logSection = all.substring(idx, idx + 2000);
      return logSection;
    })()`,
    returnByValue: true,
  });
  console.log('=== LOG SECTION ===');
  console.log(r.result.value);

  // 也获取步骤状态
  const r2 = await client.Runtime.evaluate({
    expression: `(() => {
      const all = document.body.innerText;
      const idx = all.lastIndexOf('节点 plus-checkout-create');
      if (idx < 0) return 'no checkout status';
      return all.substring(idx - 100, idx + 300);
    })()`,
    returnByValue: true,
  });
  console.log('=== CHECKOUT STATUS ===');
  console.log(r2.result.value);

  await client.close();
}

main().catch(e => console.error(e.message));