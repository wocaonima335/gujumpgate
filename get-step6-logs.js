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
  
  // 获取完整日志
  const r = await client.Runtime.evaluate({
    expression: `(() => {
      const all = document.body.innerText;
      // 找到"步骤 6"相关的所有日志
      const lines = all.split('\\n');
      const step6Lines = lines.filter(l => l.includes('步骤 6') || l.includes('step 6') || l.includes('hosted') || l.includes('checkout') || l.includes('PayPal') || l.includes('paypal') || l.includes('停止') || l.includes('失败') || l.includes('错误'));
      return step6Lines.join('\\n');
    })()`,
    returnByValue: true,
  });
  console.log('=== Step 6 related logs ===');
  console.log(r.result.value);

  await client.close();
}

main().catch(e => console.error(e.message));