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
    if (!spTarget) { console.log('ERROR: sidepanel未找到'); process.exit(1); }

    const spClient = await CDP({port: 9222, target: spTarget});
    const {Runtime} = spClient;

    // 检查所有chrome.storage.local的内容
    const r1 = await Runtime.evaluate({
      expression: `
        (async () => {
          const all = await chrome.storage.local.get(null);
          const keys = Object.keys(all).sort();
          const summary = {};
          for (const k of keys) {
            const v = all[k];
            if (typeof v === 'string') summary[k] = v.length > 50 ? v.substring(0,50) + '...' : v;
            else if (Array.isArray(v)) summary[k] = 'Array(' + v.length + ')';
            else if (typeof v === 'object' && v !== null) summary[k] = 'Object(' + Object.keys(v).length + ')';
            else summary[k] = v;
          }
          return JSON.stringify(summary, null, 2);
        })()
      `,
      awaitPromise: true,
      returnByValue: true
    });
    console.log('chrome.storage.local 全部内容:');
    console.log(r1.result.value);

    // 检查日志区域
    const r2 = await Runtime.evaluate({
      expression: `
        (async () => {
          // 尝试多种方式获取日志
          const logArea = document.getElementById('log-area');
          const logContent = logArea?.innerText || logArea?.textContent || '';
          
          // 检查步骤进度
          const stepsProgress = document.getElementById('steps-progress');
          const stepsText = stepsProgress?.innerText || '';
          
          // 检查状态栏
          const statusBar = document.getElementById('status-bar');
          const statusText = statusBar?.innerText || '';
          
          // 检查displayStatus
          const displayStatus = document.getElementById('display-status');
          const displayText = displayStatus?.innerText || '';
          
          return JSON.stringify({
            log: logContent.substring(0, 500) || 'EMPTY',
            steps: stepsText.substring(0, 200) || 'EMPTY',
            status: statusText.substring(0, 200) || 'EMPTY',
            display: displayText.substring(0, 200) || 'EMPTY'
          });
        })()
      `,
      returnByValue: true
    });
    console.log('\nUI状态:');
    console.log(r2.result.value);

    // 检查ChatGPT页面
    const chatgptTarget = list.find(t => t.url.includes('chatgpt.com'));
    if (chatgptTarget) {
      console.log('\nChatGPT页面:', chatgptTarget.title);
      console.log('URL:', chatgptTarget.url.substring(0, 80));
    }

    await spClient.close();
  } catch(e) {
    console.error('ERR:', e.message);
  }
})();