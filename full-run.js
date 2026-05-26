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
    const target = list.find(t => t.type === 'page');
    const client = await CDP({port: 9222, target});
    const {Runtime} = client;

    // 先检查扩展的content script是否注入了
    const r0 = await Runtime.evaluate({
      expression: `
        (async () => {
          // 检查扩展是否可以通过chrome.runtime.sendMessage通信
          // 普通页面无法访问chrome.runtime.sendMessage（除非是扩展页面）
          // 需要打开扩展的sidepanel页面
          return typeof chrome !== 'undefined' && typeof chrome.runtime !== 'undefined';
        })()
      `,
      returnByValue: true
    });
    console.log('页面有chrome.runtime:', r0.result.value);

    // 直接打开sidepanel页面作为新标签
    const extId = 'jbfdbapohpgallheekahoigcghkpkiin';
    const sidepanelUrl = `chrome-extension://${extId}/sidepanel/sidepanel.html`;
    
    // 通过CDP创建新标签并导航到sidepanel
    const {Target} = client;
    const newTarget = await Target.createTarget({url: sidepanelUrl});
    console.log('新标签ID:', newTarget.targetId);
    
    await new Promise(r => setTimeout(r, 3000));

    // 重新获取列表
    const newList = await getList();
    console.log('\n当前标签页:');
    newList.filter(t => t.type === 'page').forEach(t => {
      console.log(`  ${t.title} -> ${t.url.substring(0, 80)}`);
    });

    // 连接到sidepanel页面
    const spTarget = newList.find(t => t.url.includes('sidepanel/sidepanel.html'));
    if (!spTarget) {
      console.log('ERROR: sidepanel未找到');
      process.exit(1);
    }

    const spClient = await CDP({port: 9222, target: spTarget});
    const {Runtime: SPR} = spClient;

    // 解析邮箱
    const emailData = fs.readFileSync('/root/UDZCMI08BODATGWE_20260520_095939.txt', 'utf8').trim();
    const emailLines = emailData.split('\n');
    const hotmailAccounts = emailLines.map(line => {
      const parts = line.trim().split('----');
      return { email: parts[0], password: parts[1], clientId: parts[2], refreshToken: parts[3] };
    });

    // 读取API Keys
    const configData = JSON.parse(fs.readFileSync('/root/GuJumpgate/config.server.json', 'utf8'));

    // 注入配置
    console.log('\n注入配置...');
    const r1 = await SPR.evaluate({
      expression: `
        (async () => {
          const accounts = ${JSON.stringify(hotmailAccounts)};
          await chrome.storage.local.set({
            panelMode: 'local-cpa-json-no-rt',
            accountAccessStrategy: 'local-cpa-json-no-rt',
            mailProvider: 'hotmail',
            hotmailAccounts: accounts,
            hotmailServiceMode: 'local',
            hotmailLocalBaseUrl: 'http://127.0.0.1:17373',
            accountRunHistoryHelperBaseUrl: 'http://127.0.0.1:17373',
            accountRunHistoryTextEnabled: true,
            phoneSmsProvider: '5sim',
            fiveSimApiKey: '${configData.fiveSimApiKey}',
            fiveSimCountryId: 'argentina',
            fiveSimCountryLabel: 'Argentina',
            fiveSimProduct: 'openai',
            fiveSimOperator: 'any',
            fiveSimCountryOrder: ['argentina'],
            heroSmsApiKey: '${configData.heroSmsApiKey}',
            heroSmsCountryId: 39,
            heroSmsCountryLabel: 'Argentina',
            signupMethod: 'email',
            phoneVerificationEnabled: false,
            plusModeEnabled: false,
            localCpaJsonPluginDir: '/root/GuJumpgate/data/auth-output',
            localCpaJsonRelativeAuthDir: '.cli-proxy-api',
            autoRunSkipFailures: true,
            autoSkipFailures: true,
            freePhoneReuseEnabled: true,
            phoneSmsReuseEnabled: true,
            heroSmsReuseEnabled: true,
            accountRunHistory: []
          });
          return 'OK';
        })()
      `,
      awaitPromise: true,
      returnByValue: true
    });
    console.log('  配置注入:', r1.result.value);

    // 验证
    const rv = await SPR.evaluate({
      expression: `
        (async () => {
          const d = await chrome.storage.local.get([
            'panelMode','mailProvider','hotmailAccounts','fiveSimApiKey',
            'phoneSmsProvider','plusModeEnabled','signupMethod'
          ]);
          return JSON.stringify({
            panelMode: d.panelMode,
            mailProvider: d.mailProvider,
            accountsCount: d.hotmailAccounts?.length,
            fiveSimKey: d.fiveSimApiKey?.substring(0,20)+'...',
            phoneSmsProvider: d.phoneSmsProvider,
            plusModeEnabled: d.plusModeEnabled,
            signupMethod: d.signupMethod
          });
        })()
      `,
      awaitPromise: true,
      returnByValue: true
    });
    console.log('  验证:', rv.result.value);

    // 发送AUTO_RUN消息
    console.log('\n启动AUTO_RUN...');
    const r2 = await SPR.evaluate({
      expression: `
        (async () => {
          try {
            const response = await chrome.runtime.sendMessage({
              type: 'AUTO_RUN',
              source: 'sidepanel',
              payload: {
                totalRuns: 1,
                autoRunSkipFailures: true,
                mode: 'restart'
              }
            });
            return 'RESPONSE: ' + JSON.stringify(response);
          } catch(e) {
            return 'ERROR: ' + e.message;
          }
        })()
      `,
      awaitPromise: true,
      returnByValue: true
    });
    console.log('  结果:', r2.result.value);

    // 等待60秒后检查
    console.log('\n等待60秒...');
    await new Promise(r => setTimeout(r, 60000));

    const r3 = await SPR.evaluate({
      expression: `
        (async () => {
          const data = await chrome.storage.local.get(['accountRunHistory']);
          const history = data.accountRunHistory || [];
          return JSON.stringify(history.map(h => ({
            email: h.email || h.accountIdentifier,
            status: h.finalStatus,
            failedNode: h.failedNodeId,
            failureDetail: h.failureDetail ? h.failureDetail.substring(0, 120) : null,
            finishedAt: h.finishedAt
          })), null, 2);
        })()
      `,
      awaitPromise: true,
      returnByValue: true
    });
    console.log('\n运行历史:');
    console.log(r3.result.value);

    // 检查当前页面
    const finalList = await getList();
    console.log('\n当前标签页:');
    finalList.filter(t => t.type === 'page').forEach(t => {
      console.log(`  ${t.title} -> ${t.url.substring(0, 100)}`);
    });

    // 检查auth-output
    const dir = '/root/GuJumpgate/data/auth-output';
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir);
      console.log('\nauth-output:', files.length > 0 ? files.join(', ') : '空');
    }

    await spClient.close();
    await client.close();
  } catch(e) {
    console.error('ERR:', e.message);
  }
})();