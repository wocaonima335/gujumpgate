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
  // 获取日志区域的内容
  const r = await client.Runtime.evaluate({
    expression: `(() => {
      // 查找日志区域
      const logArea = document.querySelector('[class*=log], [class*=Log], [id*=log], [id*=Log], pre, .console-output, .log-list, .log-container');
      if (logArea) return logArea.innerText.substring(0, 3000);
      // 尝试获取所有文本
      const allText = document.body.innerText;
      const logStart = allText.indexOf('10:1');
      if (logStart >= 0) return allText.substring(logStart, logStart + 3000);
      return 'no log found';
    })()`,
    returnByValue: true,
  });
  console.log(r.result.value);
  await client.close();
}

main().catch(e => console.error(e.message));
