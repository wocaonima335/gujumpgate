const CDP = require('chrome-remote-interface');
const http = require('http');
const fs = require('fs');

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
    const spTarget = list.find(t => t.url.includes('sidepanel/sidepanel.html'));
    if (!spTarget) { console.log('ERROR: sidepanel未找到'); process.exit(1); }

    const spClient = await CDP({port: 9222, target: spTarget});
    const {Runtime} = spClient;

    // 读取inject-config.js中的配置（它是在扩展上下文执行的）
    // 我们需要将其转换为CDP可执行的evaluate表达式
    const injectCode = fs.readFileSync('/root/GuJumpgate/inject-config.js', 'utf8');
    
    // 提取settings对象和hotmailAccounts
    // 直接在sidepanel上下文执行inject-config.js的核心逻辑
    const result = await Runtime.evaluate({
      expression: injectCode,
      awaitPromise: true,
      returnByValue: true
    });
    console.log('inject-config.js结果:', result.result.value);

    // 验证关键配置
    const rv = await Runtime.evaluate({
      expression: `
        (async () => {
          const d = await chrome.storage.local.get([
            'hotmailAccounts','mailProvider','plusModeEnabled','plusPaymentMethod',
            'hostedCheckoutPhone','hostedSmsPoolEntries','phoneVerificationEnabled',
            'fiveSimApiKey','panelMode'
          ]);
          const accounts = d.hotmailAccounts || [];
          const authorized = accounts.filter(a => a.status === 'authorized' && !a.used && a.refreshToken);
          return JSON.stringify({
            panelMode: d.panelMode,
            mailProvider: d.mailProvider,
            plusModeEnabled: d.plusModeEnabled,
            plusPaymentMethod: d.plusPaymentMethod,
            phoneVerificationEnabled: d.phoneVerificationEnabled,
            total: accounts.length,
            authorized: authorized.length,
            firstAuth: authorized[0] ? authorized[0].email : null,
            hostedPhone: d.hostedCheckoutPhone,
            smsPoolCount: d.hostedSmsPoolEntries?.length || 0,
            fiveSimKey: d.fiveSimApiKey ? 'OK' : 'MISSING'
          });
        })()
      `,
      awaitPromise: true,
      returnByValue: true
    });
    console.log('\n验证:', rv.result.value);

    // 启动AUTO_RUN
    console.log('\n启动AUTO_RUN...');
    const r2 = await Runtime.evaluate({
      expression: `
        (async () => {
          try {
            const response = await chrome.runtime.sendMessage({
              type: 'AUTO_RUN',
              source: 'sidepanel',
              payload: { totalRuns: 1, autoRunSkipFailures: true, mode: 'restart' }
            });
            return JSON.stringify(response);
          } catch(e) { return 'ERROR: ' + e.message; }
        })()
      `,
      awaitPromise: true,
      returnByValue: true
    });
    console.log('AUTO_RUN响应:', r2.result.value);

    await spClient.close();
    console.log('\n完成！');
  } catch(e) {
    console.error('ERR:', e.message);
  }
})();