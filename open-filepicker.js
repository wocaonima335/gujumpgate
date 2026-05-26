const CDP = require('chrome-remote-interface');

(async () => {
  try {
    const client = await CDP({port: 9222});
    const {Runtime, Page} = client;

    await Page.enable();
    
    // 导航到chrome://extensions
    await Page.navigate({url: 'chrome://extensions/'});
    await new Promise(r => setTimeout(r, 3000));

    // 启用开发者模式
    console.log('[1] 启用开发者模式...');
    const r1 = await Runtime.evaluate({
      expression: `
        (async () => {
          const manager = document.querySelector('extensions-manager');
          if (!manager) return 'NO_MANAGER';
          const toolbar = manager.shadowRoot.querySelector('extensions-toolbar');
          if (!toolbar) return 'NO_TOOLBAR';
          const devMode = toolbar.shadowRoot.querySelector('#devMode');
          if (!devMode) return 'NO_DEV_TOGGLE';
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
    console.log('  结果:', r1.result.value);

    await new Promise(r => setTimeout(r, 1000));

    // 点击加载已解压的扩展程序
    console.log('[2] 点击加载已解压的扩展程序...');
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
    console.log('  结果:', r2.result.value);

    await client.close();
    console.log('\n[*] 文件选择器应该已弹出');
  } catch(e) {
    console.error('ERR:', e.message);
  }
})();