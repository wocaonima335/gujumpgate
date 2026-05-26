const http = require('http');
const WebSocket = require('ws');

function get(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(JSON.parse(d)));
    }).on('error', reject);
  });
}

async function main() {
  // 获取browser ws url
  const ver = await get('http://127.0.0.1:9222/json/version');
  console.log('Browser WS:', ver.webSocketDebuggerUrl.substring(0, 60));
  
  const ws = new WebSocket(ver.webSocketDebuggerUrl);
  await new Promise(r => ws.once('open', r));
  
  // 获取targets
  ws.send(JSON.stringify({id: 1, method: 'Target.getTargets'}));
  
  const targets = await new Promise(resolve => {
    ws.on('message', raw => {
      const msg = JSON.parse(raw);
      if (msg.id === 1) resolve(msg.result.targetInfos);
    });
  });
  
  console.log('\nAll targets:');
  for (const t of targets) {
    console.log(`  ${t.type}: ${t.url.substring(0, 80)}`);
  }
  
  // 查找扩展service worker
  const sw = targets.find(t => t.type === 'service_worker' && t.url.includes('chrome-extension'));
  if (sw) {
    console.log('\nFound SW:', sw.url);
    
    // Attach
    ws.send(JSON.stringify({id: 2, method: 'Target.attachToTarget', params: {targetId: sw.targetId}}));
    const attachResult = await new Promise(resolve => {
      ws.on('message', raw => {
        const msg = JSON.parse(raw);
        if (msg.id === 2) resolve(msg.result);
      });
    });
    const sid = attachResult.sessionId;
    console.log('Session:', sid.substring(0, 20));
    
    // 在SW中注入配置
    const config = {
      exportTarget: 'local-cpa-json-no-rt',
      phoneSmsProvider: '5sim',
      fiveSimApiKey: '',
      fiveSimCountry: 'argentina',
      mailProvider: 'hotmail',
      signupMethod: 'email',
      helperHost: '127.0.0.1',
      helperPort: 17373,
      pluginDir: '/root/GuJumpgate/data/auth-output',
    };
    
    const expr = `(async () => { 
      const c = ${JSON.stringify(config)}; 
      await chrome.storage.local.set(c); 
      const all = await chrome.storage.local.get(null);
      return JSON.stringify({ok: true, stored: Object.keys(all)});
    })()`;
    
    ws.send(JSON.stringify({id: 3, method: 'Runtime.evaluate', params: {expression: expr, awaitPromise: true, returnByValue: true}, sessionId: sid}));
    
    const evalResult = await new Promise(resolve => {
      const handler = raw => {
        const msg = JSON.parse(raw);
        if (msg.id === 3) {
          ws.removeListener('message', handler);
          resolve(msg);
        }
      };
      ws.on('message', handler);
    });
    console.log('\nConfig result:', evalResult.result?.result?.value || JSON.stringify(evalResult.result));
    
    // 发送START消息
    ws.send(JSON.stringify({id: 4, method: 'Runtime.evaluate', params: {expression: `(async () => { chrome.runtime.sendMessage({type:'AUTO_RUN',source:'sidepanel',payload:{totalRuns:1,autoRunSkipFailures:true,mode:'restart'}}); return 'SENT'; })()`, awaitPromise: true, returnByValue: true}, sessionId: sid}));
    
    const startResult = await new Promise(resolve => {
      const handler = raw => {
        const msg = JSON.parse(raw);
        if (msg.id === 4) {
          ws.removeListener('message', handler);
          resolve(msg);
        }
      };
      ws.on('message', handler);
    });
    console.log('Start result:', startResult.result?.result?.value || JSON.stringify(startResult.result));
    
  } else {
    console.log('\nNo extension service worker found!');
    console.log('扩展未加载，可能需要通过chrome://extensions页面手动启用开发者模式并加载');
  }
  
  ws.close();
}

main().catch(e => console.error('ERR:', e.message));
