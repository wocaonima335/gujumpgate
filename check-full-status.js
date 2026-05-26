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
    
    // 1. 检查运行历史
    const spTarget = list.find(t => t.url.includes('sidepanel/sidepanel.html'));
    const spClient = await CDP({port: 9222, target: spTarget});
    const {Runtime} = spClient;

    const r1 = await Runtime.evaluate({
      expression: `
        (async () => {
          const data = await chrome.storage.local.get(['accountRunHistory']);
          const history = data.accountRunHistory || [];
          return JSON.stringify(history, null, 2);
        })()
      `,
      awaitPromise: true,
      returnByValue: true
    });
    console.log('=== 运行历史 ===');
    console.log(r1.result.value);

    // 2. 检查ChatGPT页面
    const chatgptTarget = list.find(t => t.title === 'ChatGPT');
    if (chatgptTarget) {
      const chatClient = await CDP({port: 9222, target: chatgptTarget});
      const {Runtime: CR} = chatClient;
      
      const r2 = await CR.evaluate({
        expression: `
          (async () => {
            return JSON.stringify({
              url: location.href,
              title: document.title,
              bodyText: document.body?.innerText?.substring(0, 300) || 'empty'
            });
          })()
        `,
        returnByValue: true
      });
      console.log('\n=== ChatGPT页面 ===');
      console.log(r2.result.value);
      await chatClient.close();
    }

    // 3. 检查Stripe支付页面
    const payTarget = list.find(t => t.url.includes('pay.openai.com'));
    if (payTarget) {
      const payClient = await CDP({port: 9222, target: payTarget});
      const {Runtime: PR} = payClient;
      
      const r3 = await PR.evaluate({
        expression: `
          (async () => {
            const body = document.body?.innerText?.substring(0, 500) || 'empty';
            const inputs = document.querySelectorAll('input');
            const inputInfo = Array.from(inputs).map(el => ({
              type: el.type, name: el.name, id: el.id, 
              placeholder: el.placeholder, visible: el.offsetParent !== null
            }));
            return JSON.stringify({bodyText: body, inputs: inputInfo}, null, 2);
          })()
        `,
        returnByValue: true
      });
      console.log('\n=== Stripe支付页面 ===');
      console.log(r3.result.value);
      await payClient.close();
    }

    // 4. 检查auth-output
    const fs = require('fs');
    const dir = '/root/GuJumpgate/data/auth-output';
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir);
      console.log('\n=== auth-output目录 ===');
      for (const f of files) {
        const stat = fs.statSync(dir + '/' + f);
        console.log(`  ${f} (${stat.size} bytes)`);
      }
      if (files.length === 0) console.log('  (空)');
    }

    await spClient.close();
  } catch(e) {
    console.error('ERR:', e.message);
  }
})();