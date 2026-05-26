const CDP = require('chrome-remote-interface');
(async () => {
  try {
    const client = await CDP({port: 9222});
    const {Runtime, Page} = client;
    
    // 测试sidepanel
    await Page.navigate({url: 'chrome-extension://fignfifoniblkonapihmkfakmlgkbkcf/sidepanel/sidepanel.html'});
    await new Promise(r => setTimeout(r, 3000));
    
    const r = await Runtime.evaluate({
      expression: 'JSON.stringify({title: document.title, url: location.href, bodyLen: document.body.innerText.length, first300: document.body.innerText.substring(0, 300)})',
      returnByValue: true
    });
    const info = JSON.parse(r.result.value);
    console.log('标题:', info.title);
    console.log('URL:', info.url);
    console.log('内容长度:', info.bodyLen);
    console.log('前300字:', info.first300);
    
    await client.close();
  } catch(e) {
    console.error('ERR:', e.message);
  }
})();
