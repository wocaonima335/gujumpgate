const CDP = require('chrome-remote-interface');
const fs = require('fs');

(async () => {
  try {
    // 连接到sidepanel页面
    const client = await CDP({port: 9222});
    const {Runtime, Page} = client;

    // 获取sidepanel页面
    const list = await new Promise((resolve, reject) => {
      const http = require('http');
      http.get('http://127.0.0.1:9222/json/list', (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(JSON.parse(data)));
      }).on('error', reject);
    });

    const spTarget = list.find(t => t.url.includes('sidepanel/sidepanel.html'));
    if (!spTarget) {
      console.log('ERROR: sidepanel页面未找到');
      console.log('可用页面:', list.map(t => t.title).join(', '));
      process.exit(1);
    }

    console.log('sidepanel页面:', spTarget.title);
    console.log('扩展ID:', spTarget.url.match(/chrome-extension:\/\/([^/]+)/)?.[1]);

    // 连接到sidepanel页面
    const spClient = await CDP({
      port: 9222,
      target: spTarget
    });
    const {Runtime: spRuntime} = spClient;

    // 读取配置注入脚本
    const configScript = fs.readFileSync('/root/GuJumpgate/inject-config.js', 'utf8');

    console.log('\n[1] 注入配置到chrome.storage.local...');
    const r1 = await spRuntime.evaluate({
      expression: configScript,
      awaitPromise: true,
      returnByValue: true
    });

    if (r1.exceptionDetails) {
      console.log('ERROR:', JSON.stringify(r1.exceptionDetails));
    } else {
      console.log('配置结果:', r1.result.value);
    }

    // 验证配置
    console.log('\n[2] 验证配置...');
    const r2 = await spRuntime.evaluate({
      expression: `
        (async () => {
          const keys = [
            'fiveSimApiKey', 'heroSmsApiKey', 'mailProvider', 
            'plusModeEnabled', 'phoneVerificationEnabled',
            'hotmailAccounts', 'hostedSmsPool',
            'localCpaJsonPluginDir', 'panelMode'
          ];
          const data = await chrome.storage.local.get(keys);
          return JSON.stringify({
            fiveSimApiKey: data.fiveSimApiKey ? 'SET(' + data.fiveSimApiKey.length + 'chars)' : 'MISSING',
            heroSmsApiKey: data.heroSmsApiKey ? 'SET' : 'MISSING',
            mailProvider: data.mailProvider || 'MISSING',
            plusModeEnabled: data.plusModeEnabled,
            phoneVerificationEnabled: data.phoneVerificationEnabled,
            hotmailAccounts: data.hotmailAccounts ? data.hotmailAccounts.length + '个' : 'MISSING',
            hostedSmsPool: data.hostedSmsPool ? 'SET(' + data.hostedSmsPool.length + 'chars)' : 'MISSING',
            localCpaJsonPluginDir: data.localCpaJsonPluginDir || 'MISSING',
            panelMode: data.panelMode || 'MISSING'
          }, null, 2);
        })()
      `,
      awaitPromise: true,
      returnByValue: true
    });
    console.log(r2.result.value);

    await spClient.close();
    await client.close();
    console.log('\n[*] 配置注入完成！');
  } catch(e) {
    console.error('ERR:', e.message);
    console.error(e.stack);
  }
})();
