const CDP = require('chrome-remote-interface');
const http = require('http');
const fs = require('fs');

async function main() {
  const hotmailLines = fs.readFileSync('/root/UDZCMI08BODATGWE_20260520_095939.txt', 'utf8').trim().split('\n');
  const paypalLines = fs.readFileSync('/root/payalphone', 'utf8').trim().split('\n');
  const configServer = JSON.parse(fs.readFileSync('/root/gpt-register/config.server.json', 'utf8'));

  const hotmailAccounts = hotmailLines.map((line, i) => {
    const p = line.trim().split('----');
    return p.length >= 4 ? {
      id: `hotmail-${i}`, email: p[0], password: p[1],
      clientId: p[2], refreshToken: p[3],
      status: 'authorized', lastAuthAt: new Date().toISOString(), used: false,
    } : null;
  }).filter(Boolean);

  const hostedSmsPool = paypalLines.map(line => {
    const p = line.trim().split('----');
    return p.length >= 2 ? { phone: p[0], verificationUrl: p[1] } : null;
  }).filter(Boolean);

  const config = {
    panelMode: 'local-cpa-json-no-rt',
    plusModeEnabled: true,
    plusPaymentMethod: 'paypal',
    plusCheckoutCloudConversionEnabled: true,
    hotmailAccounts,
    hostedSmsPool,
    hostedCheckoutPhone: hostedSmsPool[0]?.phone || '16562710160',
    preferEmailOtp: false,
    exportTarget: 'cpa-json-no-rt',
    fiveSimApiKey: configServer.fiveSimApiKey || '',
    heroSmsApiKey: configServer.heroSmsApiKey || '',
    heroSmsCountry: '39',
  };

  const configJson = JSON.stringify(config);

  // Step 1: 激活扩展的sidepanel
  console.log('Step 1: Activating sidepanel...');
  const mainClient = await CDP({ host: '127.0.0.1', port: 9222 });
  const { Target } = mainClient;
  const extId = 'jbfdbapohpgallheekahoigcghkpkiin';
  
  try {
    const r = await Target.createTarget({
      url: `chrome-extension://${extId}/sidepanel/sidepanel.html`,
    });
    console.log('Sidepanel opened, targetId:', r.targetId);
  } catch(e) {
    console.log('Target.createTarget error:', e.message);
  }
  await mainClient.close();

  // 等待sidepanel加载
  await new Promise(r => setTimeout(r, 3000));

  // Step 2: 获取sidepanel的wsUrl
  const targets = await new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:9222/json', res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d)));
    }).on('error', reject);
  });

  const sidepanel = targets.find(t => t.title && t.title.includes('GuJumpgate'));
  if (!sidepanel) { console.error('Sidepanel not found!'); return; }
  console.log('Found sidepanel:', sidepanel.title);

  // Step 3: 注入配置
  const client = await CDP({ target: sidepanel.webSocketDebuggerUrl });
  const { Runtime } = client;

  console.log('Step 2: Injecting config...');
  const r1 = await Runtime.evaluate({
    expression: `
      new Promise((resolve) => {
        const config = ${configJson};
        chrome.storage.local.set(config, () => {
          if (chrome.runtime.lastError) {
            resolve({error: chrome.runtime.lastError.message});
            return;
          }
          chrome.storage.local.get(['hotmailAccounts', 'hostedSmsPool', 'plusCheckoutCloudConversionEnabled', 'panelMode'], (result) => {
            resolve({
              ok: true,
              panelMode: result.panelMode,
              hotmailCount: result.hotmailAccounts?.length || 0,
              smsPoolCount: result.hostedSmsPool?.length || 0,
              cloudConversion: result.plusCheckoutCloudConversionEnabled,
            });
          });
        });
      })
    `,
    awaitPromise: true,
    returnByValue: true,
  });
  console.log('Config result:', JSON.stringify(r1.result.value));

  // 等一下让配置生效
  await new Promise(r => setTimeout(r, 2000));

  // Step 4: 发送AUTO_RUN
  console.log('Step 3: Sending AUTO_RUN...');
  const r2 = await Runtime.evaluate({
    expression: `
      new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'AUTO_RUN' }, (response) => {
          if (chrome.runtime.lastError) {
            resolve({error: chrome.runtime.lastError.message});
            return;
          }
          resolve(response);
        });
      })
    `,
    awaitPromise: true,
    returnByValue: true,
  });
  console.log('AUTO_RUN result:', JSON.stringify(r2.result.value));

  await client.close();
}

main().catch(e => console.error(e.message));