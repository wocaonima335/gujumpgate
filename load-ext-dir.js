const CDP = require('chrome-remote-interface');

(async () => {
  try {
    const client = await CDP({port: 9222});
    const {Runtime, Page} = client;

    await Page.navigate({url: 'chrome://extensions/'});
    await new Promise(r => setTimeout(r, 3000));

    // 尝试loadDirectory
    console.log('[1] 尝试chrome.developerPrivate.loadDirectory...');
    const r1 = await Runtime.evaluate({
      expression: `
        (async () => {
          try {
            const result = await new Promise((resolve, reject) => {
              chrome.developerPrivate.loadDirectory(
                '/root/GuJumpgate',
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

    // 如果loadDirectory失败，尝试choosePath
    console.log('\n[2] 尝试chrome.developerPrivate.choosePath...');
    const r2 = await Runtime.evaluate({
      expression: `
        (async () => {
          try {
            const result = await new Promise((resolve, reject) => {
              chrome.developerPrivate.choosePath(
                {type: 'LOAD_FROM_DIRECTORY'},
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
    console.log('  结果:', r2.result.value);

    await client.close();
  } catch(e) {
    console.error('ERR:', e.message);
  }
})();