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
    const spClient = await CDP({port: 9222, target: spTarget});
    const {Runtime} = spClient;

    // 关闭Plus模式，只跑免费注册
    console.log('[1] 关闭Plus模式...');
    const r1 = await Runtime.evaluate({
      expression: `
        (async () => {
          await chrome.storage.local.set({
            plusModeEnabled: false,
            phoneVerificationEnabled: false
          });
          return 'OK';
        })()
      `,
      awaitPromise: true,
      returnByValue: true
    });
    console.log('  结果:', r1.result.value);

    // 清除运行历史
    console.log('[2] 清除运行历史...');
    const r2 = await Runtime.evaluate({
      expression: `
        (async () => {
          await chrome.storage.local.set({accountRunHistory: []});
          return 'OK';
        })()
      `,
      awaitPromise: true,
      returnByValue: true
    });
    console.log('  结果:', r2.result.value);

    // 重新发送AUTO_RUN
    console.log('[3] 重新启动AUTO_RUN...');
    const r3 = await Runtime.evaluate({
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
    console.log('  结果:', r3.result.value);

    // 等待30秒后检查
    console.log('[4] 等待30秒...');
    await new Promise(r => setTimeout(r, 30000));

    const r4 = await Runtime.evaluate({
      expression: `
        (async () => {
          const data = await chrome.storage.local.get(['accountRunHistory']);
          const history = data.accountRunHistory || [];
          return JSON.stringify(history.map(h => ({
            email: h.email || h.accountIdentifier,
            status: h.finalStatus,
            failedStep: h.failedStep,
            failedNode: h.failedNodeId,
            failureDetail: h.failureDetail ? h.failureDetail.substring(0, 100) : null,
            finishedAt: h.finishedAt
          })), null, 2);
        })()
      `,
      awaitPromise: true,
      returnByValue: true
    });
    console.log('\n运行历史:');
    console.log(r4.result.value);

    // 检查当前页面
    const newList = await getList();
    const pages = newList.filter(t => t.type === 'page');
    console.log('\n当前标签页:');
    pages.forEach(p => console.log(`  ${p.title} -> ${p.url.substring(0, 80)}`));

    await spClient.close();
  } catch(e) {
    console.error('ERR:', e.message);
  }
})();