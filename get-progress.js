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
  const r = await client.Runtime.evaluate({
    expression: `(() => {
      const all = document.body.innerText;
      const lines = all.split('\\n');
      const relevant = lines.filter(l => 
        l.includes('步骤 5') || l.includes('步骤 6') || l.includes('步骤 7') || l.includes('步骤 8') ||
        l.includes('oauth') || l.includes('OAuth') || l.includes('登录') || 
        l.includes('accessToken') || l.includes('Plus Checkout') || l.includes('免费') ||
        l.includes('失败') || l.includes('错误') || l.includes('成功') || l.includes('完成') ||
        l.includes('LillianaAzaria') || l.includes('MelioraCeleste')
      );
      return relevant.slice(-40).join('\\n');
    })()`,
    returnByValue: true,
  });
  console.log(r.result.value);
  await client.close();
}

main().catch(e => console.error(e.message));