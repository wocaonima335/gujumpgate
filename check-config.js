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
  const r = await client.Runtime.evaluate({
    expression: `new Promise((resolve) => {
      chrome.storage.local.get(['plusCheckoutCloudConversionEnabled', 'panelMode', 'plusPaymentMethod', 'plusModeEnabled', 'hotmailAccounts', 'hostedSmsPool'], (result) => {
        resolve(JSON.stringify({
          cloudConversion: result.plusCheckoutCloudConversionEnabled,
          panelMode: result.panelMode,
          paymentMethod: result.plusPaymentMethod,
          plusModeEnabled: result.plusModeEnabled,
          hotmailCount: result.hotmailAccounts?.length || 0,
          smsPoolCount: result.hostedSmsPool?.length || 0,
        }));
      });
    })`,
    awaitPromise: true,
    returnByValue: true,
  });
  console.log('Current config:', r.result.value);
  await client.close();
}

main().catch(e => console.error(e.message));