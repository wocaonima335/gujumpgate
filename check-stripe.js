const CDP = require('chrome-remote-interface');
const http = require('http');

function getList() {
  return new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:9222/json/list', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

(async () => {
  try {
    const list = await getList();
    
    // 检查Stripe支付页面
    const payTarget = list.find(t => t.url.includes('pay.openai.com'));
    if (payTarget) {
      const payClient = await CDP({port: 9222, target: payTarget});
      const {Runtime} = payClient;
      
      const r = await Runtime.evaluate({
        expression: `
          (async () => {
            const body = document.body?.innerText?.substring(0, 800) || 'empty';
            const buttons = document.querySelectorAll('button, a');
            const btnInfo = Array.from(buttons).filter(b => b.offsetParent !== null).map(b => ({
              text: b.textContent?.trim()?.substring(0, 50),
              href: b.href || '',
              class: b.className?.substring(0, 30)
            }));
            return JSON.stringify({bodyText: body, buttons: btnInfo.slice(0, 10)}, null, 2);
          })()
        `,
        returnByValue: true
      });
      console.log('=== Stripe支付页面 ===');
      console.log(r.result.value);
      await payClient.close();
    }

    // 检查sidepanel日志
    const spTarget = list.find(t => t.url.includes('sidepanel/sidepanel.html'));
    if (spTarget) {
      const spClient = await CDP({port: 9222, target: spTarget});
      const {Runtime} = spClient;
      
      const r2 = await Runtime.evaluate({
        expression: `
          (async () => {
            const d = await chrome.storage.local.get(['accountRunHistory']);
            const h = d.accountRunHistory || [];
            if (!h.length) return 'NO_HISTORY';
            const last = h[0];
            return JSON.stringify(last, null, 2);
          })()
        `,
        awaitPromise: true,
        returnByValue: true
      });
      console.log('\n=== 最后一条运行记录 ===');
      console.log(r2.result.value);
      
      await spClient.close();
    }
  } catch(e) {
    console.error('ERR:', e.message);
  }
})();