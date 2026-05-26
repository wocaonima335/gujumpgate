const CDP = require('chrome-remote-interface');
const http = require('http');
const fs = require('fs');

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

    // 检查运行历史
    const r1 = await Runtime.evaluate({
      expression: `
        (async () => {
          const data = await chrome.storage.local.get(['accountRunHistory', 'hotmailAccounts']);
          const history = data.accountRunHistory || [];
          const accounts = data.hotmailAccounts || [];
          const used = accounts.filter(a => a.used);
          return JSON.stringify({
            runHistory: history.map(h => ({
              email: h.email || h.accountIdentifier,
              status: h.finalStatus,
              failedNode: h.failedNodeId,
              failureDetail: h.failureDetail ? h.failureDetail.substring(0, 200) : null,
              finishedAt: h.finishedAt
            })),
            usedAccounts: used.map(a => a.email),
            totalAccounts: accounts.length
          }, null, 2);
        })()
      `,
      awaitPromise: true,
      returnByValue: true
    });
    console.log('=== 运行历史 ===');
    console.log(r1.result.value);

    // 检查当前页面
    console.log('\n=== 当前标签页 ===');
    list.filter(t => t.type === 'page').forEach(t => {
      console.log(`  ${t.title} -> ${t.url.substring(0, 100)}`);
    });

    // 检查auth-output
    const dir = '/root/GuJumpgate/data/auth-output';
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir);
      console.log('\n=== auth-output ===');
      console.log(files.length > 0 ? files.join('\n') : '空');
    }

    await spClient.close();
  } catch(e) {
    console.error('ERR:', e.message);
  }
})();