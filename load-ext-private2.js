const CDP = require('chrome-remote-interface');

(async () => {
  try {
    const client = await CDP({port: 9222});
    const {Runtime, Page} = client;

    await Page.navigate({url: 'chrome://extensions/'});
    await new Promise(r => setTimeout(r, 3000));

    // 查看developerPrivate API的方法签名
    console.log('[1] 检查developerPrivate API...');
    const r1 = await Runtime.evaluate({
      expression: `
        (async () => {
          const api = chrome.developerPrivate;
          const methods = Object.keys(api).filter(k => typeof api[k] === 'function');
          return JSON.stringify(methods);
        })()
      `,
      awaitPromise: true,
      returnByValue: true
    });
    console.log('  方法列表:', r1.result.value);

    // 尝试loadUnpacked不带参数
    console.log('\n[2] 尝试loadUnpacked不带参数...');
    const r2 = await Runtime.evaluate({
      expression: `
        (async () => {
          try {
            const result = await new Promise((resolve, reject) => {
              chrome.developerPrivate.loadUnpacked((result) => {
                if (chrome.runtime.lastError) {
                  reject(chrome.runtime.lastError.message);
                } else {
                  resolve(result);
                }
              });
            });
            return 'SUCCESS: ' + JSON.stringify(result);
          } catch(e) {
            return 'ERROR: ' + e.message;
          }
        })()
      `,
      awaitPromise: true,
      returnByValue: true
    });
    console.log('  结果:', r2.result.value);

    await client.close();
  } catch(e) {
    console.error('ERR:', e.message);
  }
})();