const CDP = require('chrome-remote-interface');
const fs = require('fs');

const HOTMAIL_FILE = '/root/UDZCMI08BODATGWE_20260520_095939.txt';
const PAYPAL_PHONE_FILE = '/root/payalphone';
const CONFIG_SERVER = '/root/gpt-register/config.server.json';

async function main() {
  // 读取配置
  const hotmailLines = fs.readFileSync(HOTMAIL_FILE, 'utf8').trim().split('\n');
  const paypalLines = fs.readFileSync(PAYPAL_PHONE_FILE, 'utf8').trim().split('\n');
  const configServer = JSON.parse(fs.readFileSync(CONFIG_SERVER, 'utf8'));
  
  const fiveSimKey = configServer.fiveSimApiKey || '';
  const heroSmsKey = configServer.heroSmsApiKey || '';

  // 构建hotmail账号列表
  const hotmailAccounts = hotmailLines.map((line, i) => {
    const parts = line.trim().split('----');
    if (parts.length < 4) return null;
    return {
      id: `hotmail-${i}`,
      email: parts[0],
      password: parts[1],
      clientId: parts[2],
      refreshToken: parts[3],
      status: 'authorized',
      lastAuthAt: new Date().toISOString(),
      used: false,
    };
  }).filter(Boolean);

  // 构建hostedSmsPool
  const hostedSmsPool = paypalLines.map((line, i) => {
    const parts = line.trim().split('----');
    if (parts.length < 2) return null;
    return { phone: parts[0], verificationUrl: parts[1] };
  }).filter(Boolean);

  // 构建完整配置
  const config = {
    panelMode: 'local-cpa-json-no-rt',
    plusModeEnabled: true,
    plusPaymentMethod: 'paypal',
    plusCheckoutCloudConversionEnabled: true,  // v0.1.3新增
    hotmailAccounts,
    hostedSmsPool,
    hostedSmsPoolCount: hostedSmsPool.length,
    hostedCheckoutPhone: hostedSmsPool[0]?.phone || '16562710160',
    smsPool: {
      fiveSimApiKey: fiveSimKey,
      heroSmsApiKey: heroSmsKey,
      heroSmsCountry: '39',
    },
    preferEmailOtp: false,
    exportTarget: 'cpa-json-no-rt',
  };

  console.log(`Hotmail accounts: ${hotmailAccounts.length}`);
  console.log(`Hosted SMS pool: ${hostedSmsPool.length}`);
  console.log(`Cloud conversion: enabled`);

  // 连接CDP
  const client = await CDP({ host: '127.0.0.1', port: 9222 });
  const { Runtime } = client;

  // 注入到chrome.storage.local
  const injectCode = `
    (async () => {
      const data = ${JSON.stringify(config)};
      return new Promise((resolve) => {
        chrome.storage.local.set(data, () => {
          chrome.storage.local.get(null, (result) => {
            resolve({
              keys: Object.keys(result).length,
              hasHotmail: result.hotmailAccounts?.length || 0,
              hasSmsPool: result.hostedSmsPool?.length || 0,
              cloudConversion: result.plusCheckoutCloudConversionEnabled,
            });
          });
        });
      });
    })()
  `;

  const r = await Runtime.evaluate({
    expression: injectCode,
    awaitPromise: true,
    returnByValue: true,
  });
  console.log('Config injected:', JSON.stringify(r.result.value));

  // 发送AUTO_RUN
  const autoRunCode = `
    (async () => {
      return new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'AUTO_RUN' }, (response) => {
          resolve(response);
        });
      });
    })()
  `;

  const r2 = await Runtime.evaluate({
    expression: autoRunCode,
    awaitPromise: true,
    returnByValue: true,
  });
  console.log('AUTO_RUN response:', JSON.stringify(r2.result.value));

  await client.close();
}

main().catch(e => console.error(e.message));
