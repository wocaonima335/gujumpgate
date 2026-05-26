const CDP = require('chrome-remote-interface');

(async () => {
  try {
    const client = await CDP({port: 9222});
    const {Runtime, Page} = client;

    await Page.navigate({url: 'chrome://extensions/'});
    await new Promise(r => setTimeout(r, 3000));

    // 尝试choosePath - 用正确的枚举值
    console.log('[1] 尝试choosePath...');
    const r1 = await Runtime.evaluate({
      expression: `
        (async () => {
          try {
            const result = await new Promise((resolve, reject) => {
              chrome.developerPrivate.choosePath(
                'FOLDER',
                'LOAD',
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

    // 尝试installDroppedFile
    console.log('\n[2] 尝试installDroppedFile...');
    const r2 = await Runtime.evaluate({
      expression: `
        (async () => {
          try {
            // 检查installDroppedFile的签名
            return 'installDroppedFile type: ' + typeof chrome.developerPrivate.installDroppedFile;
          } catch(e) {
            return 'ERROR: ' + e.message;
          }
        })()
      `,
      awaitPromise: true,
      returnByValue: true
    });
    console.log('  结果:', r2.result.value);

    // 尝试使用extensionsPrivate API
    console.log('\n[3] 检查其他私有API...');
    const r3 = await Runtime.evaluate({
      expression: `
        (async () => {
          const apis = [];
          for (const name of Object.keys(chrome)) {
            if (name.includes('extension') || name.includes('Extension')) {
              apis.push(name);
            }
          }
          return JSON.stringify(apis);
        })()
      `,
      awaitPromise: true,
      returnByValue: true
    });
    console.log('  扩展相关API:', r3.result.value);

    // 最终方案：使用fileManagerPrivate来选择目录
    console.log('\n[4] 尝试fileManagerPrivate...');
    const r4 = await Runtime.evaluate({
      expression: `
        (async () => {
          if (chrome.fileManagerPrivate) {
            return 'fileManagerPrivate_AVAILABLE: ' + JSON.stringify(Object.keys(chrome.fileManagerPrivate).filter(k => typeof chrome.fileManagerPrivate[k] === 'function'));
          }
          return 'fileManagerPrivate_NOT_AVAILABLE';
        })()
      `,
      awaitPromise: true,
      returnByValue: true
    });
    console.log('  结果:', r4.result.value);

    await client.close();
  } catch(e) {
    console.error('ERR:', e.message);
  }
})();