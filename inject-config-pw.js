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
    
    // 找到扩展的sidepanel页面或service worker
    const swTarget = list.find(t => t.url.includes('chrome-extension://') && t.url.includes('background.js'));
    const extId = swTarget?.url.match(/chrome-extension:\/\/([^/]+)/)?.[1];
    console.log('扩展ID:', extId);
    
    if (!extId) { console.log('ERROR: 扩展未找到'); process.exit(1); }

    // 使用任意页面来注入配置（通过chrome.storage API需要扩展上下文）
    // 但CDP连接到普通页面无法访问chrome.storage
    // 需要连接到service worker
    const swClient = await CDP({port: 9222, target: swTarget});
    const {Runtime} = swClient;

    // 解析邮箱文件
    const emailData = fs.readFileSync('/root/UDZCMI08BODATGWE_20260520_095939.txt', 'utf8').trim();
    const emailLines = emailData.split('\n');
    const hotmailAccounts = emailLines.map(line => {
      const parts = line.trim().split('----');
      return {
        email: parts[0],
        password: parts[1],
        clientId: parts[2],
        refreshToken: parts[3]
      };
    });
    console.log('邮箱账号数:', hotmailAccounts.length);

    // 读取API Keys
    const configData = JSON.parse(fs.readFileSync('/root/GuJumpgate/config.server.json', 'utf8'));
    const fiveSimKey = configData.fiveSimApiKey;
    const heroSmsKey = configData.heroSmsApiKey;
    console.log('5SIM Key:', fiveSimKey?.substring(0, 20) + '...');
    console.log('HeroSMS Key:', heroSmsKey?.substring(0, 20) + '...');

    // 注入所有配置
    console.log('\n注入配置...');
    const r = await Runtime.evaluate({
      expression: `
        (async () => {
          const accounts = ${JSON.stringify(hotmailAccounts)};
          
          await chrome.storage.local.set({
            // 面板模式
            panelMode: 'local-cpa-json-no-rt',
            accountAccessStrategy: 'local-cpa-json-no-rt',
            
            // 邮箱配置
            mailProvider: 'hotmail',
            hotmailAccounts: accounts,
            hotmailServiceMode: 'local',
            hotmailLocalBaseUrl: 'http://127.0.0.1:17373',
            accountRunHistoryHelperBaseUrl: 'http://127.0.0.1:17373',
            accountRunHistoryTextEnabled: true,
            
            // SMS接码配置
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
            
            // 注册方式
            signupMethod: 'email',
            phoneVerificationEnabled: false,
            
            // Plus模式（先关闭，跑免费注册）
            plusModeEnabled: false,
            
            // 输出目录
            localCpaJsonPluginDir: '/root/GuJumpgate/data/auth-output',
            localCpaJsonRelativeAuthDir: '.cli-proxy-api',
            
            // 自动运行设置
            autoRunSkipFailures: true,
            autoSkipFailures: true,
            
            // 其他
            freePhoneReuseEnabled: true,
            phoneSmsReuseEnabled: true,
            heroSmsReuseEnabled: true,
            
            // 清除运行历史
            accountRunHistory: []
          });
          
          return 'CONFIG_INJECTED';
        })()
      `,
      awaitPromise: true,
      returnByValue: true
    });
    console.log('  结果:', r.result.value);

    // 验证配置
    const rv = await Runtime.evaluate({
      expression: `
        (async () => {
          const data = await chrome.storage.local.get([
            'panelMode', 'mailProvider', 'hotmailAccounts', 'fiveSimApiKey',
            'phoneSmsProvider', 'plusModeEnabled', 'signupMethod'
          ]);
          return JSON.stringify({
            panelMode: data.panelMode,
            mailProvider: data.mailProvider,
            accountsCount: data.hotmailAccounts?.length,
            fiveSimKey: data.fiveSimApiKey?.substring(0, 20) + '...',
            phoneSmsProvider: data.phoneSmsProvider,
            plusModeEnabled: data.plusModeEnabled,
            signupMethod: data.signupMethod
          });
        })()
      `,
      awaitPromise: true,
      returnByValue: true
    });
    console.log('\n配置验证:', rv.result.value);

    // 打开sidePanel
    console.log('\n打开sidePanel...');
    // 需要打开扩展的sidepanel页面
    // 在Chromium中可以通过URL直接打开
    const rs = await Runtime.evaluate({
      expression: `
        (async () => {
          // 尝试通过chrome.sidePanel API打开
          try {
            await chrome.sidePanel.setOptions({
              path: 'sidepanel/sidepanel.html',
              enabled: true
            });
            return 'SIDE_PANEL_SET';
          } catch(e) {
            return 'ERROR: ' + e.message;
          }
        })()
      `,
      awaitPromise: true,
      returnByValue: true
    });
    console.log('  结果:', rs.result.value);

    await swClient.close();
    console.log('\n配置注入完成！');
  } catch(e) {
    console.error('ERR:', e.message);
    console.error(e.stack);
  }
})();