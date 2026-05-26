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
    console.log('当前页面数:', list.filter(t => t.type === 'page').length);

    // 找到ChatGPT页面
    const chatgptTarget = list.find(t => t.type === 'page');
    if (!chatgptTarget) { console.log('ERROR: 无页面'); process.exit(1); }

    const client = await CDP({port: 9222, target: chatgptTarget});
    const {Target} = client;

    // 创建sidepanel标签页
    const extId = 'jbfdbapohpgallheekahoigcghkpkiin';
    const sidepanelUrl = `chrome-extension://${extId}/sidepanel/sidepanel.html`;
    
    console.log('创建sidepanel标签...');
    const newTarget = await Target.createTarget({url: sidepanelUrl});
    console.log('新标签ID:', newTarget.targetId);

    await new Promise(r => setTimeout(r, 5000));

    // 重新获取列表
    const newList = await getList();
    const spTarget = newList.find(t => t.url.includes('sidepanel/sidepanel.html'));
    if (!spTarget) { console.log('ERROR: sidepanel未找到'); process.exit(1); }

    console.log('sidepanel:', spTarget.url.substring(0, 60));

    // 连接到sidepanel
    const spClient = await CDP({port: 9222, target: spTarget});
    const {Runtime} = spClient;

    // 解析邮箱文件
    const emailData = fs.readFileSync('/root/UDZCMI08BODATGWE_20260520_095939.txt', 'utf8').trim();
    const emailLines = emailData.split('\n');
    const accounts = emailLines.map(line => {
      const parts = line.trim().split('----');
      return {
        email: parts[0],
        password: parts[1],
        clientId: parts[2],
        refreshToken: parts[3],
        status: 'authorized',  // 关键修复！
        lastAuthAt: 1747850000000,
        enabled: true,
        used: false,
      };
    });
    console.log('账号数:', accounts.length);

    // API Keys
    const configData = JSON.parse(fs.readFileSync('/root/gpt-register/config.server.json', 'utf8'));
    const fiveSimKey = configData.fiveSimApiKey;
    const heroSmsKey = configData.heroSmsApiKey;

    // 注入配置（用JSON.parse避免字符串转义问题）
    const configObj = {
      panelMode: 'local-cpa-json-no-rt',
      accountAccessStrategy: 'local-cpa-json-no-rt',
      mailProvider: 'hotmail',
      hotmailAccounts: accounts,
      hotmailServiceMode: 'local',
      hotmailLocalBaseUrl: 'http://127.0.0.1:17373',
      accountRunHistoryHelperBaseUrl: 'http://127.0.0.1:17373',
      accountRunHistoryTextEnabled: true,
      phoneSmsProvider: '5sim',
      fiveSimApiKey: fiveSimKey,
      fiveSimCountryId: 'argentina',
      fiveSimCountryLabel: 'Argentina',
      fiveSimProduct: 'openai',
      fiveSimOperator: 'any',
      fiveSimCountryOrder: ['argentina'],
      heroSmsApiKey: heroSmsKey,
      heroSmsCountryId: 39,
      heroSmsCountryLabel: 'Argentina',
      signupMethod: 'email',
      phoneVerificationEnabled: false,
      plusModeEnabled: false,  // 关键：关闭Plus模式
      localCpaJsonPluginDir: '/root/GuJumpgate/data/auth-output',
      localCpaJsonRelativeAuthDir: '.cli-proxy-api',
      autoRunSkipFailures: true,
      autoSkipFailures: true,
      freePhoneReuseEnabled: true,
      phoneSmsReuseEnabled: true,
      heroSmsReuseEnabled: true,
      accountRunHistory: []
    };

    // 将config转为JSON字符串，在evaluate中用JSON.parse还原
    const configJsonStr = JSON.stringify(configObj);

    console.log('注入配置...');
    const r1 = await Runtime.evaluate({
      expression: `(async () => { await chrome.storage.local.set(JSON.parse('${configJsonStr.replace(/'/g, "\\'")}')); return 'OK'; })()`,
      awaitPromise: true,
      returnByValue: true
    });
    console.log('  结果:', r1.result.value);

    // 验证
    const rv = await Runtime.evaluate({
      expression: `(async () => {
        const d = await chrome.storage.local.get(['hotmailAccounts','mailProvider','plusModeEnabled']);
        const accounts = d.hotmailAccounts || [];
        const authorized = accounts.filter(a => a.status === 'authorized' && !a.used && a.refreshToken);
        return JSON.stringify({
          mailProvider: d.mailProvider,
          plusModeEnabled: d.plusModeEnabled,
          total: accounts.length,
          authorized: authorized.length,
          firstAuth: authorized[0] ? authorized[0].email : null
        });
      })()`,
      awaitPromise: true,
      returnByValue: true
    });
    console.log('验证:', rv.result.value);

    // 启动AUTO_RUN
    console.log('\n启动AUTO_RUN...');
    const r2 = await Runtime.evaluate({
      expression: `(async () => {
        try {
          const response = await chrome.runtime.sendMessage({
            type: 'AUTO_RUN',
            source: 'sidepanel',
            payload: { totalRuns: 1, autoRunSkipFailures: true, mode: 'restart' }
          });
          return JSON.stringify(response);
        } catch(e) { return 'ERROR: ' + e.message; }
      })()`,
      awaitPromise: true,
      returnByValue: true
    });
    console.log('AUTO_RUN响应:', r2.result.value);

    await spClient.close();
    await client.close();
    console.log('\n配置注入+启动完成！');

    // 等待2分钟后检查结果
    console.log('等待120秒...');
    await new Promise(r => setTimeout(r, 120000));

    // 检查结果
    const finalList = await getList();
    const finalSp = finalList.find(t => t.url.includes('sidepanel/sidepanel.html'));
    if (finalSp) {
      const finalClient = await CDP({port: 9222, target: finalSp});
      const {Runtime: FR} = finalClient;

      const r3 = await FR.evaluate({
        expression: `(async () => {
          const data = await chrome.storage.local.get(['accountRunHistory', 'hotmailAccounts']);
          const history = data.accountRunHistory || [];
          const accounts = data.hotmailAccounts || [];
          const used = accounts.filter(a => a.used);
          return JSON.stringify({
            runHistory: history.map(h => ({
              email: h.email || h.accountIdentifier,
              status: h.finalStatus,
              failedNode: h.failedNodeId,
              failureDetail: h.failureDetail ? h.failureDetail.substring(0, 150) : null,
              finishedAt: h.finishedAt
            })),
            usedAccounts: used.length,
            totalAccounts: accounts.length
          }, null, 2);
        })()`,
        awaitPromise: true,
        returnByValue: true
      });
      console.log('\n运行结果:');
      console.log(r3.result.value);

      // 检查auth-output
      const dir = '/root/GuJumpgate/data/auth-output';
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir);
        console.log('\nauth-output:', files.length > 0 ? files.join(', ') : '空');
      }

      // 检查页面
      console.log('\n当前标签页:');
      finalList.filter(t => t.type === 'page').forEach(t => {
        console.log('  ' + t.title + ' -> ' + t.url.substring(0, 100));
      });

      await finalClient.close();
    }
  } catch(e) {
    console.error('ERR:', e.message);
  }
})();