const CDP = require('chrome-remote-interface');

(async () => {
  try {
    const client = await CDP({port: 9222});
    const {Runtime, Page} = client;

    // 测试sidepanel页面
    console.log('[1] 测试sidepanel页面...');
    await Page.navigate({url: 'chrome-extension://fignfifoniblkonapihmkfakmlgkbkcf/sidepanel/sidepanel.html'});
    await new Promise(r => setTimeout(r, 3000));

    const r1 = await Runtime.evaluate({
      expression: `JSON.stringify({title: document.title, url: location.href, bodyLen: document.body.innerText.length, first200: document.body.innerText.substring(0, 200)})`,
      returnByValue: true
    });
    const info = JSON.parse(r1.result.value);
    console.log('  标题:', info.title);
    console.log('  URL:', info.url);
    console.log('  内容长度:', info.bodyLen);
    console.log('  前200字:', info.first200);

    if (info.bodyLen > 0 && !info.first200.includes("couldn't be accessed")) {
      console.log('\n  ✓ 扩展sidepanel页面正常加载！');
    } else {
      console.log('\n  ✗ 扩展页面加载失败');
    }

    await client.close();
  } catch(e) {
    console.error('ERR:', e.message);
  }
})();
