const CDP = require('chrome-remote-interface');

async function main() {
  // 先在page中注入配置（通过content script桥接）
  const client = await CDP({ host: '127.0.0.1', port: 9222 });
  const { Runtime, Page } = client;

  // 1. 先检查扩展是否可用
  const checkExt = await Runtime.evaluate({
    expression: `typeof chrome?.runtime?.sendMessage === 'function'`,
    returnByValue: true,
  });
  console.log('chrome.runtime.sendMessage available:', checkExt.result.value);

  // 2. 尝试通过content script注入配置
  const injectResult = await Runtime.evaluate({
    expression: `
      (async () => {
        // 检查扩展ID
        const extId = 'jbfdbapohpgallheekahoigcghkpkiin';
        try {
          // 通过chrome.runtime.sendMessage发送配置
          const config = {
            type: 'INJECT_CONFIG',
            payload: {
              panelMode: 'local-cpa-json-no-rt',
              plusModeEnabled: true,
              plusPaymentMethod: 'paypal',
              plusCheckoutCloudConversionEnabled: true,
              hotmailAccounts: ${JSON.stringify(require('fs').readFileSync('/root/UDZCMI08BODATGWE_20260520_095939.txt','utf8').trim().split('\\n').map((l,i)=>{const p=l.trim().split('----');return p.length>=4?{id:`hotmail-${i}`,email:p[0],password:p[1],clientId:p[2],refreshToken:p[3],status:'authorized',lastAuthAt:new Date().toISOString(),used:false}:null}).filter(Boolean))},
              hostedSmsPool: ${JSON.stringify(require('fs').readFileSync('/root/payalphone','utf8').trim().split('\\n').map(l=>{const p=l.trim().split('----');return p.length>=2?{phone:p[0],verificationUrl:p[1]}:null}).filter(Boolean))},
              hostedCheckoutPhone: '16562710160',
              smsPool: {
                fiveSimApiKey: '${JSON.parse(require('fs').readFileSync('/root/gpt-register/config.server.json','utf8')).fiveSimApiKey || ''}',
                heroSmsApiKey: '${JSON.parse(require('fs').readFileSync('/root/gpt-register/config.server.json','utf8')).heroSmsApiKey || ''}',
                heroSmsCountry: '39',
              },
              preferEmailOtp: false,
              exportTarget: 'cpa-json-no-rt',
            }
          };
          return new Promise((resolve) => {
            chrome.runtime.sendMessage(extId, config, (response) => {
              resolve(response || 'no response');
            });
          });
        } catch(e) {
          return 'error: ' + e.message;
        }
      })()
    `,
    awaitPromise: true,
    returnByValue: true,
  });
  console.log('Inject result:', JSON.stringify(injectResult.result.value));

  await client.close();
}

main().catch(e => console.error(e));
