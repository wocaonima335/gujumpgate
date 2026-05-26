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
    const spTarget = list.find(t => t.url.includes('sidepanel/sidepanel.html'));
    const spClient = await CDP({port: 9222, target: spTarget});
    const {Runtime} = spClient;

    // 检查accountRunHistory
    const r1 = await Runtime.evaluate({
      expression: `
        (async () => {
          const data = await chrome.storage.local.get(['accountRunHistory']);
          const history = data.accountRunHistory || [];
          return JSON.stringify(history.map(h => ({
            email: h.email || h.accountEmail || 'unknown',
            status: h.status || h.outcome || 'unknown',
            step: h.step || h.lastStep || 'unknown',
            error: h.error ? h.error.substring(0, 100) : null,
            time: h.timestamp || h.startTime || 'unknown'
          })), null, 2);
        })()
      `,
      awaitPromise: true,
      returnByValue: true
    });
    console.log('运行历史:');
    console.log(r1.result.value);

    // 检查auth-output目录
    const fs = require('fs');
    const dir = '/root/GuJumpgate/data/auth-output';
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir);
      console.log('\nauth-output目录文件:', files.length > 0 ? files.join(', ') : '空');
    }

    // 检查ChatGPT页面
    const chatgptTarget = list.find(t => t.url.includes('chatgpt.com') || t.url.includes('auth.openai.com') || t.url.includes('auth0.openai.com'));
    if (chatgptTarget) {
      console.log('\n当前页面:', chatgptTarget.title);
      console.log('URL:', chatgptTarget.url.substring(0, 100));
    } else {
      console.log('\n没有找到ChatGPT相关页面');
    }

    // 检查所有标签页
    console.log('\n所有标签页:');
    list.filter(t => t.type === 'page').forEach(t => {
      console.log(`  ${t.title} -> ${t.url.substring(0, 80)}`);
    });

    await spClient.close();
  } catch(e) {
    console.error('ERR:', e.message);
  }
})();