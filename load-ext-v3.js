const CDP = require('chrome-remote-interface');

(async () => {
  try {
    const client = await CDP({port: 9222});
    const {Runtime, Page} = client;

    // 导航回chrome://extensions
    console.log('[1] 导航到chrome://extensions...');
    await Page.navigate({url: 'chrome://extensions/'});
    await new Promise(r => setTimeout(r, 3000));

    // 检查当前页面状态 - 是否已有GuJumpgate扩展
    const r0 = await Runtime.evaluate({
      expression: `
        (async () => {
          const manager = document.querySelector('extensions-manager');
          if (!manager) return 'NO_MANAGER';
          const items = manager.shadowRoot.querySelectorAll('extensions-item');
          const extList = [];
          for (const item of items) {
            extList.push({
              id: item.id,
              name: item.shadowRoot.querySelector('#name')?.textContent,
              enabled: item.shadowRoot.querySelector('#enabled')?.checked
            });
          }
          return JSON.stringify(extList);
        })()
      `,
      awaitPromise: true,
      returnByValue: true
    });
    console.log('  已安装扩展:', r0.result.value);

    // 确保开发者模式开启
    const r1 = await Runtime.evaluate({
      expression: `
        (async () => {
          const manager = document.querySelector('extensions-manager');
          const toolbar = manager.shadowRoot.querySelector('extensions-toolbar');
          const devMode = toolbar.shadowRoot.querySelector('#devMode');
          if (!devMode.checked) {
            devMode.click();
            return 'DEV_MODE_ENABLED';
          }
          return 'DEV_MODE_ALREADY_ON';
        })()
      `,
      awaitPromise: true,
      returnByValue: true
    });
    console.log('  开发者模式:', r1.result.value);

    await new Promise(r => setTimeout(r, 1000));

    // 点击加载已解压的扩展程序
    const r2 = await Runtime.evaluate({
      expression: `
        (async () => {
          const manager = document.querySelector('extensions-manager');
          const toolbar = manager.shadowRoot.querySelector('extensions-toolbar');
          const loadBtn = toolbar.shadowRoot.querySelector('#loadUnpacked');
          loadBtn.click();
          return 'LOAD_CLICKED';
        })()
      `,
      awaitPromise: true,
      returnByValue: true
    });
    console.log('  加载按钮:', r2.result.value);

    await client.close();
    console.log('\n[!] 文件选择器已弹出，需要手动操作');
  } catch(e) {
    console.error('ERR:', e.message);
  }
})();