const CDP = require('chrome-remote-interface');
const fs = require('fs');

(async () => {
  try {
    // 获取sidepanel页面
    const http = require('http');
    const list = await new Promise((resolve, reject) => {
      http.get('http://127.0.0.1:9222/json/list', (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(JSON.parse(data)));
      }).on('error', reject);
    });

    const spTarget = list.find(t => t.url.includes('sidepanel/sidepanel.html'));
    if (!spTarget) {
      console.log('ERROR: sidepanel页面未找到');
      process.exit(1);
    }

    const extId = spTarget.url.match(/chrome-extension:\/\/([^/]+)/)?.[1];
    console.log('扩展ID:', extId);

    // 连接到sidepanel
    const spClient = await CDP({port: 9222, target: spTarget});
    const {Runtime} = spClient;

    // 检查当前sidepanel状态
    console.log('\n[1] 检查sidepanel状态...');
    const r0 = await Runtime.evaluate({
      expression: `
        (async () => {
          const state = await chrome.storage.local.get([
            'mailProvider', 'fiveSimApiKey', 'hotmailAccounts',
            'plusModeEnabled', 'phoneVerificationEnabled',
            'currentStep', 'autoRunning'
          ]);
          return JSON.stringify({
            mailProvider: state.mailProvider,
            hasFiveSimKey: !!state.fiveSimApiKey,
            hotmailCount: state.hotmailAccounts?.length || 0,
            plusMode: state.plusModeEnabled,
            phoneVerify: state.phoneVerificationEnabled,
            currentStep: state.currentStep || 'idle',
            autoRunning: state.autoRunning || false
          });
        })()
      `,
      awaitPromise: true,
      returnByValue: true
    });
    console.log('  状态:', r0.result.value);

    // 发送AUTO_RUN消息给background
    console.log('\n[2] 发送AUTO_RUN消息...');
    
    // 方法：通过sidepanel页面的chrome.runtime.sendMessage
    const r1 = await Runtime.evaluate({
      expression: `
        (async () => {
          try {
            const response = await chrome.runtime.sendMessage({
              type: 'AUTO_RUN',
              source: 'sidepanel',
              payload: { totalRuns: 1, autoRunSkipFailures: true, mode: 'restart' }
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

    // 等几秒后检查状态
    console.log('\n[3] 等待5秒后检查状态...');
    await new Promise(r => setTimeout(r, 5000));
    
    const r2 = await Runtime.evaluate({
      expression: `
        (async () => {
          const state = await chrome.storage.local.get([
            'currentStep', 'autoRunning', 'currentEmail',
            'logMessages'
          ]);
          return JSON.stringify({
            currentStep: state.currentStep || 'idle',
            autoRunning: state.autoRunning || false,
            currentEmail: state.currentEmail || 'none'
          });
        })()
      `,
      awaitPromise: true,
      returnByValue: true
    });
    console.log('  状态:', r2.result.value);

    // 检查log区域
    console.log('\n[4] 检查日志...');
    const r3 = await Runtime.evaluate({
      expression: `
        (async () => {
          const logArea = document.getElementById('log-area');
          if (!logArea) return 'NO_LOG_AREA';
          const text = logArea.innerText || logArea.textContent || '';
          return text.substring(0, 500);
        })()
      `,
      awaitPromise: true,
      returnByValue: true
    });
    console.log('  日志:', r3.result.value);

    await spClient.close();
    console.log('\n[*] 完成');
  } catch(e) {
    console.error('ERR:', e.message);
  }
})();
