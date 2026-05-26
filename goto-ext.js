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
    const target = list.find(t => t.type === 'page');
    const client = await CDP({port: 9222, target});
    const {Page} = client;
    
    await Page.navigate({url: 'chrome://extensions'});
    await new Promise(r => setTimeout(r, 2000));
    console.log('已导航到chrome://extensions');
    
    await client.close();
  } catch(e) {
    console.error('ERR:', e.message);
  }
})();