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
    const spTarget = list.find(t => t.url.includes('sidepanel/sidepanel.html'));
    if (!spTarget) { console.log('ERROR: sidepanel未找到'); process.exit(1); }

    const extId = spTarget.url.match(/chrome-extension:\/\/([^/]+)/)?.[1];
    console.log('扩展ID:', extId);

    const spClient = await CDP({port: 9222, target: spTarget});
    const {Runtime} = spClient;

    // 先保存设置（模拟点击保存按钮）
    console.log('\n[1] 保存当前设置...');
    const r0 = await Runtime.evaluate({
      expression: `
        (async () => {
          // 确保关键设置都在
          const current = await chrome.storage.local.get([
            'panelMode', 'mailProvider', 'fiveSimApiKey', 'fiveSimProduct',
            'plusModeEnabled', 'phoneVerificationEnabled', 'hotmailAccounts',
            'localCpaJsonPluginDir', 'accountAccessStrategy'
          ]);
          
          // 补充缺失的设置
          const patches = {};
          if (!current.panelMode) patches.panelMode = 'local-cpa-json-no-rt';
          if (!current.accountAccessStrategy) patches.accountAccessStrategy = 'local-cpa-json-no-rt';
          if (!current.fiveSimProduct) patches.fiveSimProduct = 'openai';
          
          if (Object.keys(patches).length > 0) {
            await chrome.storage.local.set(patches);
            return 'PATCHED: ' + JSON.stringify(Object.keys(patches));
          }
          return 'NO_PATCH_NEEDED';
        })()
      `,
      awaitPromise: true,
      returnByValue: true
    });
    console.log('  结果:', r0.result.value);

    // 发送AUTO_RUN消息
    console.log('\n[2] 发送AUTO_RUN消息...');
    const r1 = await Runtime.evaluate({
      expression: `
        (async () => {
          try {
            const response = await chrome.runtime.sendMessage({
              type: 'AUTO_RUN',
              source: 'sidepanel',
              payload: {
                totalRuns: 1,
                autoRunSkipFailures: true,
                mode: 'restart'
              }
            });
            return 'RESPONSE: ' + JSON.stringify(response);
          } catch(e) {
            return 'ERROR: ' + e.message;
          }
        })()
      `,
      awaitPromise: true,
      returnByValue: true
    });
    console.log('  结果:', r1.result.value);

    // 等待10秒后检查状态
    console.log('\n[3] 等待10秒后检查状态...');
    await new Promise(r => setTimeout(r, 10000));

    const r2 = await Runtime.evaluate({
      expression: `
        (async () => {
          const state = await chrome.storage.local.get([
            'autoRunning', 'autoRunPhase', 'currentStep', 'currentEmail',
            'signupPhoneNumber', 'signupStep'
          ]);
          return JSON.stringify(state);
        })()
      `,
      awaitPromise: true,
      returnByValue: true
    });
    console.log('  状态:', r2.result.value);

    // 检查日志
    const r3 = await Runtime.evaluate({
      expression: `
        (async () => {
          const logArea = document.getElementById('log-area');
          if (!logArea) return 'NO_LOG_AREA';
          const text = logArea.innerText || '';
          return text.substring(0, 800);
        })()
      `,
      returnByValue: true
    });
    console.log('\n[4] 日志内容:');
    console.log(r3.result.value);

    await spClient.close();
  } catch(e) {
    console.error('ERR:', e.message);
  }
})();