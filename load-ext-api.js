const CDP = require('chrome-remote-interface');

(async () => {
  try {
    const client = await CDP({port: 9222});
    const {Runtime, Page} = client;

    // 方法1: 使用chrome.developerPrivate.loadUnpacked来加载扩展
    // 这个API可以在不打开文件选择器的情况下加载扩展
    console.log('[1] 尝试通过chrome.developerPrivate.loadUnpacked加载扩展...');
    
    // 先导航到chrome://extensions
    await Page.navigate({url: 'chrome://extensions/'});
    await new Promise(r => setTimeout(r, 3000));

    // 启用开发者模式
    const r0 = await Runtime.evaluate({
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
    console.log('  开发者模式:', r0.result.value);
    await new Promise(r => setTimeout(r, 1000));

    // 方法2: 使用chrome.developerPrivate API
    // 这个API在chrome://extensions页面中可用
    const r1 = await Runtime.evaluate({
      expression: `
        (async () => {
          // 尝试使用chrome.developerPrivate.loadUnpacked
          if (typeof chrome !== 'undefined' && chrome.developerPrivate) {
            return 'developerPrivate_AVAILABLE';
          }
          return 'developerPrivate_NOT_AVAILABLE';
        })()
      `,
      awaitPromise: true,
      returnByValue: true
    });
    console.log('  developerPrivate:', r1.result.value);

    // 方法3: 直接使用extensions私有API
    const r2 = await Runtime.evaluate({
      expression: `
        (async () => {
          // 在extensions页面的context中，可以使用私有API
          const manager = document.querySelector('extensions-manager');
          if (!manager) return 'NO_MANAGER';
          
          // 获取toolbar的私有API
          const toolbar = manager.shadowRoot.querySelector('extensions-toolbar');
          if (!toolbar) return 'NO_TOOLBAR';
          
          // 检查toolbar的方法
          const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(toolbar)).filter(m => m.includes('load') || m.includes('unpack'));
          return 'TOOLBAR_METHODS: ' + JSON.stringify(methods);
        })()
      `,
      awaitPromise: true,
      returnByValue: true
    });
    console.log('  toolbar方法:', r2.result.value);

    // 方法4: 使用browserProxy来加载扩展
    const r3 = await Runtime.evaluate({
      expression: `
        (async () => {
          const manager = document.querySelector('extensions-manager');
          const toolbar = manager.shadowRoot.querySelector('extensions-toolbar');
          
          // 检查toolbar的$对象（Polymer元素引用）
          const keys = Object.keys(toolbar.$ || {});
          return 'TOOLBAR_$_KEYS: ' + JSON.stringify(keys);
        })()
      `,
      awaitPromise: true,
      returnByValue: true
    });
    console.log('  toolbar $ keys:', r3.result.value);

    await client.close();
  } catch(e) {
    console.error('ERR:', e.message);
  }
})();
