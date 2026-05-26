const CDP = require('chrome-remote-interface');

(async () => {
  try {
    const client = await CDP({port: 9222});
    const {Runtime, Page} = client;

    // 确保在chrome://extensions页面
    await Page.navigate({url: 'chrome://extensions/'});
    await new Promise(r => setTimeout(r, 3000));

    // 启用开发者模式 - 通过点击toggle
    console.log('[1] 尝试启用开发者模式...');
    const r1 = await Runtime.evaluate({
      expression: `
        (async () => {
          // 等待页面加载
          await new Promise(r => setTimeout(r, 2000));
          
          // 找到开发者模式toggle
          const toggles = document.querySelectorAll('extensions-manager');
          if (toggles.length === 0) return 'NO_MANAGER';
          
          const manager = toggles[0];
          const toolbar = manager.shadowRoot.querySelector('extensions-toolbar');
          if (!toolbar) return 'NO_TOOLBAR';
          
          const devModeToggle = toolbar.shadowRoot.querySelector('#devMode');
          if (!devModeToggle) return 'NO_DEV_TOGGLE';
          
          // 检查是否已启用
          const isChecked = devModeToggle.checked;
          if (!isChecked) {
            devModeToggle.click();
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

    // 点击"加载已解压的扩展程序"按钮
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

    // 点击加载按钮后会弹出文件选择器
    // 在Linux无头环境下无法通过DOM操作文件选择器
    // 需要用chrome.debugger API或其他方式
    console.log('\n[!] 文件选择器无法通过CDP自动操作');
    console.log('[!] 请在noVNC中手动操作：');
    console.log('    1. 打开 http://107.148.185.3:6080/vnc.html');
    console.log('    2. 在chrome://extensions页面点击"加载已解压的扩展程序"');
    console.log('    3. 选择路径: /root/GuJumpgate');

    await client.close();
  } catch(e) {
    console.error('ERR:', e.message);
  }
})();