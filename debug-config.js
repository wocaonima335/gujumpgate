const CDP = require('chrome-remote-interface');
const http = require('http');

async function main() {
  const targets = await new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:9222/json', res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d)));
    }).on('error', reject);
  });

  const sidepanel = targets.find(t => t.title && t.title.includes('GuJumpgate'));
  if (!sidepanel) { console.log('No sidepanel found'); return; }

  const client = await CDP({ target: sidepanel.webSocketDebuggerUrl });
  
  // 直接读取chrome.storage.local中的plusCheckoutCloudConversionEnabled
  const r = await client.Runtime.evaluate({
    expression: `new Promise((resolve) => {
      chrome.storage.local.get(['plusCheckoutCloudConversionEnabled', 'plusCheckoutCloudConversionApiUrl', 'plusCheckoutCloudConversionApiKey'], (result) => {
        resolve(JSON.stringify(result));
      });
    })`,
    awaitPromise: true,
    returnByValue: true,
  });
  console.log('Storage values:', r.result.value);

  // 也读取chrome.storage.session
  const r2 = await client.Runtime.evaluate({
    expression: `new Promise((resolve) => {
      chrome.storage.session.get(['plusCheckoutCloudConversionEnabled'], (result) => {
        resolve(JSON.stringify(result));
      });
    })`,
    awaitPromise: true,
    returnByValue: true,
  });
  console.log('Session values:', r2.result.value);

  // 模拟getState()的读取逻辑
  const r3 = await client.Runtime.evaluate({
    expression: `new Promise((resolve) => {
      chrome.storage.local.get(['plusCheckoutCloudConversionEnabled', 'plusCheckoutCloudConversionApiUrl', 'plusCheckoutCloudConversionApiKey', 'plusPaymentMethod', 'panelMode'], (stored) => {
        // 模拟buildPersistentSettingsPayload
        const val = stored.plusCheckoutCloudConversionEnabled;
        resolve(JSON.stringify({
          rawValue: val,
          type: typeof val,
          bool: Boolean(val),
          paymentMethod: stored.plusPaymentMethod,
          panelMode: stored.panelMode,
        }));
      });
    })`,
    awaitPromise: true,
    returnByValue: true,
  });
  console.log('Simulated getState:', r3.result.value);

  await client.close();
}

main().catch(e => console.error(e.message));