const CDP = require('chrome-remote-interface');

(async () => {
  try {
    const client = await CDP({port: 9222});
    const {Runtime, Page} = client;

    // 1. 导航到扩展的sidepanel页面
    console.log('[1] 测试扩展sidepanel页面...');
    await Page.navigate({url: 'chrome-extension://fignfifoniblkonapihmkfakmlgkbkcf/sidepanel/sidepanel.html'});
    await new Promise(r => setTimeout(r, 3000));

    const r1 = await Runtime.evaluate({
      expression: `document.title + ' | ' + document.body.innerText.substring(0, 500)`,
      returnByValue: true
    });
    console.log('  标题+内容:', r1.result.value);

    // 2. 检查service worker状态
    console.log('\n[2] 检查Service Worker...');
    const tabs = await new Promise((resolve) => {
      const http = require('http');
      http.get('http://127.0.0.1:9222/json/list', (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(JSON.parse(data)));
      });
    });

    const sw = tabs.find(t => t.url && t.url.includes('fignfifoniblkonapihmkfakmlgkbkcf'));
    if (sw) {
      console.log('  Service Worker URL:', sw.url);
      console.log('  Service Worker 类型:', sw.type);
      console.log('  ✓ 扩展Service Worker正在运行');
    } else {
      console.log('  ✗ 未找到扩展Service Worker');
    }

    // 3. 导航到chatgpt.com测试
    console.log('\n[3] 导航到chatgpt.com...');
    await Page.navigate({url: 'https://chatgpt.com'});
    await new Promise(r => setTimeout(r, 5000));

    const r3 = await Runtime.evaluate({
      expression: `document.title`,
      returnByValue: true
    });
    console.log('  页面标题:', r3.result.value);

    await client.close();
    console.log('\n[*] 扩展验证完成');
  } catch(e) {
    console.error('ERR:', e.message);
  }
})();
