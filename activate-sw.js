const CDP = require('chrome-remote-interface');

async function main() {
  const client = await CDP({ host: '127.0.0.1', port: 9222 });
  const { Runtime, Target } = client;

  // 先导航到扩展页面激活service worker
  const extId = 'jbfdbapohpgallheekahoigcghkpkiin';
  
  // 方法1: 通过Target.createTarget打开扩展页面
  try {
    const r = await Target.createTarget({
      url: `chrome-extension://${extId}/sidepanel/sidepanel.html`,
    });
    console.log('Opened extension page, targetId:', r.targetId);
  } catch(e) {
    console.log('Target.createTarget failed:', e.message);
  }

  // 等一下让service worker激活
  await new Promise(r => setTimeout(r, 3000));

  // 列出所有targets
  const targets = await Target.getTargets();
  const extTargets = targets.targetInfos.filter(t => 
    t.url.includes(extId) || t.type === 'service_worker'
  );
  console.log('Extension targets:', JSON.stringify(extTargets.map(t => ({
    type: t.type, url: t.url, targetId: t.targetId
  }))));

  await client.close();
}

main().catch(e => console.error(e.message));
