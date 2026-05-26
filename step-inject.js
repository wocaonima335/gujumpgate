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
    console.log('sidepanel:', spTarget ? spTarget.url.substring(0, 60) : 'NOT_FOUND');

    const spClient = await CDP({port: 9222, target: spTarget});
    const {Runtime} = spClient;
    console.log('CDP连接成功');

    // Step 1: 读取邮箱文件并构建账号
    const emailData = fs.readFileSync('/root/UDZCMI08BODATGWE_20260520_095939.txt', 'utf8').trim();
    const emailLines = emailData.split('\n');
    const accounts = emailLines.map(line => {
      const parts = line.trim().split('----');
      return {
        email: parts[0],
        password: parts[1],
        clientId: parts[2],
        refreshToken: parts[3],
        status: 'authorized',
        lastAuthAt: 1747850000000,
        enabled: true,
        used: false,
      };
    });
    console.log('账号数:', accounts.length);

    // Step 2: 读取API Keys
    const configData = JSON.parse(fs.readFileSync('/root/gpt-register/config.server.json', 'utf8'));
    const fiveSimKey = configData.fiveSimApiKey;
    const heroSmsKey = configData.heroSmsApiKey;
    console.log('5SIM key len:', fiveSimKey.length);
    console.log('HeroSMS key len:', heroSmsKey.length);

    // Step 3: 注入配置
    const accountsJson = JSON.stringify(accounts);
    const injectExpr = `
      (async () => {
        const accounts = JSON.parse('${accountsJson.replace(/'/g, "\\'")}');
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
          fiveSimApiKey: '${fiveSimKey}',
          fiveSimCountryId: 'argentina',
          fiveSimCountryLabel: 'Argentina',
          fiveSimProduct: 'openai',
          fiveSimOperator: 'any',
          fiveSimCountryOrder: ['argentina'],
          heroSmsApiKey: '${heroSmsKey}',
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
    `;

    console.log('注入配置...');
    const r1 = await Runtime.evaluate({
      expression: injectExpr,
      awaitPromise: true,
      returnByValue: true
    });
    console.log('  结果:', r1.result.value);

    // Step 4: 验证
    const rv = await Runtime.evaluate({
      expression: `
        (async () => {
          const d = await chrome.storage.local.get(['hotmailAccounts', 'mailProvider', 'plusModeEnabled']);
          const accounts = d.hotmailAccounts || [];
          const authorized = accounts.filter(a => a.status === 'authorized' && !a.used && a.refreshToken);
          return JSON.stringify({
            mailProvider: d.mailProvider,
            plusModeEnabled: d.plusModeEnabled,
            total: accounts.length,
            authorized: authorized.length,
            firstAuth: authorized[0] ? authorized[0].email : null
          });
        })()
      `,
      awaitPromise: true,
      returnByValue: true
    });
    console.log('验证:', rv.result.value);

    // Step 5: 启动AUTO_RUN
    console.log('\n启动AUTO_RUN...');
    const r2 = await Runtime.evaluate({
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
            return JSON.stringify(response);
          } catch(e) {
            return 'ERROR: ' + e.message;
          }
        })()
      `,
      awaitPromise: true,
      returnByValue: true
    });
    console.log('AUTO_RUN响应:', r2.result.value);

    await spClient.close();
    console.log('\n完成！等待流程运行...');
  } catch(e) {
    console.error('ERR:', e.message);
  }
})();