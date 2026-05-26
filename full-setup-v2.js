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

  // Step 1: 激活sidepanel
  console.log('Step 1: Activating sidepanel...');
  const mainClient = await CDP({ host: '127.0.0.1', port: 9222 });
  const { Target } = mainClient;
  const extId = 'jbfdbapohpgallheekahoigcghkpkiin';
  try {
    await Target.createTarget({ url: `chrome-extension://${extId}/sidepanel/sidepanel.html` });
  } catch(e) { console.log('Target.createTarget error:', e.message); }
  await mainClient.close();
  await new Promise(r => setTimeout(r, 3000));

  // Step 2: 连接sidepanel
  const targets = await new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:9222/json', res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d)));
    }).on('error', reject);
  });
  const sidepanel = targets.find(t => t.title && t.title.includes('GuJumpgate'));
  if (!sidepanel) { console.error('Sidepanel not found!'); return; }

  const client = await CDP({ target: sidepanel.webSocketDebuggerUrl });
  const { Runtime } = client;

  // Step 3: 注入配置
  console.log('Step 2: Injecting config...');
  const r1 = await Runtime.evaluate({
    expression: `new Promise((resolve) => {
      const config = ${configJson};
      chrome.storage.local.set(config, () => {
        chrome.storage.local.get(['hotmailAccounts', 'hostedSmsPool', 'plusCheckoutCloudConversionEnabled', 'panelMode'], (result) => {
          resolve({ ok: true, panelMode: result.panelMode, hotmailCount: result.hotmailAccounts?.length || 0, cloudConversion: result.plusCheckoutCloudConversionEnabled });
        });
      });
    })`,
    awaitPromise: true, returnByValue: true,
  });
  console.log('Config result:', JSON.stringify(r1.result.value));

  // Step 4: 标记已用账号（通过PATCH消息，不会被覆盖）
  console.log('Step 3: Marking used accounts...');
  for (const id of ['hotmail-0', 'hotmail-4']) {
    const r = await Runtime.evaluate({
      expression: `new Promise((resolve) => {
        chrome.runtime.sendMessage({
          type: 'PATCH_HOTMAIL_ACCOUNT', source: 'sidepanel',
          payload: { accountId: '${id}', updates: { used: true } }
        }, (response) => { resolve(response?.ok); });
      })`,
      awaitPromise: true, returnByValue: true,
    });
    console.log(`  Patch ${id}: ${r.result.value}`);
  }

  // Step 5: 验证
  const r3 = await Runtime.evaluate({
    expression: `new Promise((resolve) => {
      chrome.storage.local.get(['hotmailAccounts'], (result) => {
        const accounts = result.hotmailAccounts || [];
        const next = accounts.filter(a => !a.used && a.status === 'authorized');
        resolve({ usedCount: accounts.filter(a=>a.used).length, nextAccount: next[0]?.email || 'none' });
      });
    })`,
    awaitPromise: true, returnByValue: true,
  });
  console.log('After patch:', JSON.stringify(r3.result.value));

  // Step 6: 发送AUTO_RUN
  await new Promise(r => setTimeout(r, 2000));
  console.log('Step 4: Sending AUTO_RUN...');
  const r2 = await Runtime.evaluate({
    expression: `new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'AUTO_RUN' }, (response) => {
        resolve(response);
      });
    })`,
    awaitPromise: true, returnByValue: true,
  });
  console.log('AUTO_RUN result:', JSON.stringify(r2.result.value));

  await client.close();
}

main().catch(e => console.error(e.message));