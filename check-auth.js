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
    
    // 连接到auth.openai.com页面
    const authTarget = list.find(t => t.url.includes('auth.openai.com'));
    if (!authTarget) { console.log('未找到auth页面'); process.exit(1); }
    
    console.log('当前页面:', authTarget.title);
    console.log('URL:', authTarget.url);
    
    const authClient = await CDP({port: 9222, target: authTarget});
    const {Runtime, Page} = authClient;

    // 获取页面内容
    const r1 = await Runtime.evaluate({
      expression: `
        (async () => {
          const body = document.body.innerText;
          const forms = document.querySelectorAll('form');
          const inputs = document.querySelectorAll('input, select, button');
          const inputInfo = Array.from(inputs).map(el => ({
            tag: el.tagName,
            type: el.type,
            name: el.name,
            id: el.id,
            placeholder: el.placeholder,
            value: el.value,
            text: el.textContent?.substring(0, 50)
          }));
          return JSON.stringify({
            bodyText: body.substring(0, 500),
            formCount: forms.length,
            inputs: inputInfo
          }, null, 2);
        })()
      `,
      awaitPromise: true,
      returnByValue: true
    });
    console.log('\n页面内容:');
    console.log(r1.result.value);

    await authClient.close();
  } catch(e) {
    console.error('ERR:', e.message);
  }
})();