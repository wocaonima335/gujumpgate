const CDP = require('chrome-remote-interface');

(async () => {
  try {
    const client = await CDP({port: 9222});
    const {Runtime, Page} = client;

    // 测试GuJumpgate扩展页面（用新ID）
    console.log('[1] 测试新扩展ID lpfhnmnicllglhgjilbkffeaegiemggj...');
    await Page.navigate({url: 'chrome-extension://lpfhnmnicllglhgjilbkffeaegiemggj/sidepanel/sidepanel.html'});
    await new Promise(r => setTimeout(r, 3000));
    
    const r1 = await Runtime.evaluate({
      expression: `document.title + ' | ' + location.href`,
      returnByValue: true
    });
    console.log('  结果:', r1.result.value);

    // 测试旧扩展ID
    console.log('\n[2] 测试旧扩展ID fignfifoniblkonapihmkfakmlgkbkcf...');
    await Page.navigate({url: 'chrome-extension://fignfifoniblkonapihmkfakmlgkbkcf/sidepanel/sidepanel.html'});
    await new Promise(r => setTimeout(r, 3000));
    
    const r2 = await Runtime.evaluate({
      expression: `document.title + ' | ' + location.href`,
      returnByValue: true
    });
    console.log('  结果:', r2.result.value);

    // 检查chrome://extensions页面
    console.log('\n[3] 检查chrome://extensions...');
    await Page.navigate({url: 'chrome://extensions/'});
    await new Promise(r => setTimeout(r, 3000));
    
    const r3 = await Runtime.evaluate({
      expression: `document.querySelectorAll('extensions-manager').length > 0 ? 'EXTENSIONS_PAGE_LOADED' : 'NO_MANAGER'`,
      returnByValue: true
    });
    console.log('  结果:', r3.result.value);

    await client.close();
  } catch(e) {
    console.error('ERR:', e.message);
  }
})();
