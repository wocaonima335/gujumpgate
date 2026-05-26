const CDP = require('chrome-remote-interface');

(async () => {
  try {
    const client = await CDP({port: 9222});
    const {Runtime, Page} = client;

    // 导航到chrome://extensions
    await Page.navigate({url: 'chrome://extensions/'});
    await new Promise(r => setTimeout(r, 3000));

    // 启用开发者模式
    console.log('[1] 启用开发者模式...');
    const r1 = await Runtime.evaluate({
      expression: `
        (async () => {
          await new Promise(r => setTimeout(r, 2000));
          const manager = document.querySelector('extensions-manager');
          if (!manager) return 'NO_MANAGER';
          const toolbar = manager.shadowRoot.querySelector('extensions-toolbar');
          if (!toolbar) return 'NO_TOOLBAR: ' + manager.shadowRoot.innerHTML.substring(0, 200);
          const devMode = toolbar.shadowRoot.querySelector('#devMode');
          if (!devMode) return 'NO_DEV_TOGGLE: ' + toolbar.shadowRoot.innerHTML.substring(0, 200);
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

    await new Promise(r => setTimeout(r, 2000));

    // 点击加载已解压的扩展程序
    console.log('[2] 点击加载已解压的扩展程序...');
    const r2 = await Runtime.evaluate({
      expression: `
        (async () => {
          const manager = document.querySelector('extensions-manager');
          if (!manager) return 'NO_MANAGER';
          const toolbar = manager.shadowRoot.querySelector('extensions-toolbar');
          if (!toolbar) return 'NO_TOOLBAR';
          const loadBtn = toolbar.shadowRoot.querySelector('#loadUnpacked');
          if (!loadBtn) return 'NO_LOAD_BTN';
          loadBtn.click();
          return 'LOAD_CLICKED';
        })()
      `,
      awaitPromise: true,
      returnByValue: true
    });
    console.log('  结果:', r2.result.value);

    // 文件选择器已打开，但无法通过CDP操作
    // 尝试使用chrome.fileSystemPrivate API来选择目录
    console.log('\n[3] 尝试通过CDP选择目录...');
    
    // 方法：直接调用chrome.extensions.getExtensionInfo
    const r3 = await Runtime.evaluate({
      expression: `
        (async () => {
          // 检查是否有文件选择对话框
          const dialogs = document.querySelectorAll('cr-dialog, .file-dialog');
          return 'DIALOGS_FOUND: ' + dialogs.length;
        })()
      `,
      returnByValue: true
    });
    console.log('  结果:', r3.result.value);

    await client.close();
    console.log('\n[!] 需要在noVNC中手动选择目录: /root/GuJumpgate');
  } catch(e) {
    console.error('ERR:', e.message);
  }
})();
