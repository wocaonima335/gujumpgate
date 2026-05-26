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
    // 找到现有页面或创建新标签
    const target = list.find(t => t.type === 'page') || list[0];
    
    const client = await CDP({port: 9222, target});
    const {Runtime, Page} = client;

    // 导航到chrome://extensions
    console.log('[1] 导航到chrome://extensions...');
    await Page.navigate({url: 'chrome://extensions'});
    await new Promise(r => setTimeout(r, 3000));

    // 开启开发者模式
    console.log('[2] 开启开发者模式...');
    const r1 = await Runtime.evaluate({
      expression: `
        (async () => {
          // 等待extensions-manager元素加载
          await new Promise(r => setTimeout(r, 2000));
          
          const manager = document.querySelector('extensions-manager');
          if (!manager) return 'NO_MANAGER';
          
          // 开启开发者模式
          const toolbar = manager.shadowRoot.querySelector('#devMode');
          if (toolbar) {
            if (!toolbar.checked) toolbar.click();
            return 'DEV_MODE_ENABLED';
          }
          return 'NO_DEV_MODE_TOGGLE';
        })()
      `,
      awaitPromise: true,
      returnByValue: true
    });
    console.log('  结果:', r1.result.value);

    // 点击"加载已解压的扩展程序"
    console.log('[3] 点击加载已解压的扩展程序...');
    const r2 = await Runtime.evaluate({
      expression: `
        (async () => {
          const manager = document.querySelector('extensions-manager');
          if (!manager) return 'NO_MANAGER';
          
          const toolbar = manager.shadowRoot.querySelector('extensions-toolbar');
          if (!toolbar) return 'NO_TOOLBAR';
          
          const loadButton = toolbar.shadowRoot.querySelector('#loadUnpacked');
          if (!loadButton) return 'NO_LOAD_BUTTON';
          
          loadButton.click();
          return 'LOAD_BUTTON_CLICKED';
        })()
      `,
      awaitPromise: true,
      returnByValue: true
    });
    console.log('  结果:', r2.result.value);

    await client.close();
    console.log('\n注意：文件选择器已弹出，需要通过noVNC手动选择 /tmp/gujumpgate-ext 目录');
  } catch(e) {
    console.error('ERR:', e.message);
  }
})();