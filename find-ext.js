const CDP = require('chrome-remote-interface');
(async () => {
  try {
    // 连接到browser级别
    const browser = await CDP({port: 9222, target: 'browser'});
    const {Target, Runtime} = browser;
    
    // 获取所有targets
    const {targetInfos} = await Target.getTargets();
    console.log('All targets:');
    for (const t of targetInfos) {
      console.log(`  ${t.type}: ${t.url.substring(0, 80)}`);
    }
    
    // 查找扩展service worker
    const sw = targetInfos.find(t => t.type === 'service_worker' && t.url.includes('chrome-extension'));
    if (sw) {
      console.log('\nFound service worker:', sw.url);
      console.log('Target ID:', sw.targetId);
      
      // Attach
      const {sessionId} = await Target.attachToTarget({targetId: sw.targetId});
      console.log('Session ID:', sessionId.substring(0, 20));
      
      // 在service worker中执行代码
      const evalResult = await Runtime.evaluate({
        expression: 'self.registration.scope',
        awaitPromise: false,
        returnByValue: true
      }, sessionId);
      console.log('SW scope:', JSON.stringify(evalResult));
    } else {
      console.log('\nNo extension service worker found');
    }
    
    await browser.close();
  } catch(e) {
    console.error('ERR:', e.message);
  }
})();