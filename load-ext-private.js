const CDP = require('chrome-remote-interface');

(async () => {
  try {
    const client = await CDP({port: 9222});
    const {Runtime, Page} = client;

    // 导航到chrome://extensions
    await Page.navigate({url: 'chrome://extensions/'});
    await new Promise(r => setTimeout(r, 3000));

    // 使用chrome.developerPrivate.loadUnpacked加载扩展
    console.log('[1] 使用chrome.developerPrivate.loadUnpacked...');
    const r1 = await Runtime.evaluate({
      expression: `
        (async () => {
          try {
            // developerPrivate.loadUnpacked需要path参数
            const result = await new Promise((resolve, reject) => {
              chrome.developerPrivate.loadUnpacked(
                {path: '/root/GuJumpgate'},
                (result) => {
                  if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError.message);
                  } else {
                    resolve(result);
                  }
                }
              );
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
    console.log('  结果:', r1.result.value);

    await new Promise(r => setTimeout(r, 3000));

    // 检查扩展是否加载
    console.log('\n[2] 检查扩展列表...');
    const r2 = await Runtime.evaluate({
      expression: `
        (async () => {
          const manager = document.querySelector('extensions-manager');
          if (!manager) return 'NO_MANAGER';
          const items = manager.shadowRoot.querySelectorAll('extensions-item');
          const extList = [];
          for (const item of items) {
            extList.push({
              id: item.id,
              name: item.shadowRoot.querySelector('#name')?.textContent
            });
          }
          return JSON.stringify(extList);
        })()
      `,
      awaitPromise: true,
      returnByValue: true
    });
    console.log('  已安装扩展:', r2.result.value);

    await client.close();
  } catch(e) {
    console.error('ERR:', e.message);
  }
})();
