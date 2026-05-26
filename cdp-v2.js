#!/usr/bin/env node
/**
 * GuJumpgate CDP 控制器 v2
 * 使用 chrome-remote-interface 库
 */
const CDP = require('chrome-remote-interface');
const fs = require('fs');

const PORT = 9222;
const EXT_ID = 'fignfifoniblkonapihmkfakmlgkbkcf'; // 从 /json/list 获取

async function main() {
  const cmd = process.argv[2] || 'status';
  console.log(`[CDP] 命令: ${cmd}`);
  
  const client = await CDP({ port: PORT });
  const { Target, Runtime, Page } = client;
  
  if (cmd === 'screenshot') {
    const { data } = await Page.captureScreenshot({ format: 'png' });
    fs.writeFileSync('/root/GuJumpgate/screenshot.png', Buffer.from(data, 'base64'));
    console.log('[CDP] 截图已保存: /root/GuJumpgate/screenshot.png');
  }
  
  if (cmd === 'status') {
    const { result } = await Runtime.evaluate({ expression: 'document.title + " | " + location.href' });
    console.log('[CDP] 当前页面:', result.value);
    
    // 检查扩展是否注入了内容脚本
    const { result: r2 } = await Runtime.evaluate({ 
      expression: 'document.querySelectorAll("script[src*=chrome-extension]").length' 
    });
    console.log('[CDP] 扩展脚本标签数:', r2.value);
  }
  
  if (cmd === 'config') {
    const configStr = process.argv[3] || '{}';
    let config;
    try {
      config = fs.existsSync(configStr) ? JSON.parse(fs.readFileSync(configStr, 'utf8')) : JSON.parse(configStr);
    } catch(e) { config = {}; }
    
    console.log('[CDP] 注入配置:', JSON.stringify(config));
    
    // 通过页面注入配置到扩展（需要扩展有content script监听）
    const { result } = await Runtime.evaluate({
      expression: `
        (async () => {
          // 尝试通过chrome.runtime.sendMessage发送配置
          if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
            return new Promise(resolve => {
              chrome.runtime.sendMessage('${EXT_ID}', {type: 'SET_CONFIG', config: ${JSON.stringify(config)}}, resp => {
                resolve(JSON.stringify(resp || {sent: true}));
              });
            });
          }
          return JSON.stringify({error: 'chrome.runtime not available from page context'});
        })()
      `,
      awaitPromise: true,
      returnByValue: true
    });
    console.log('[CDP] 结果:', result.value);
  }
  
  if (cmd === 'start') {
    // 通过页面发送START消息
    const { result } = await Runtime.evaluate({
      expression: `
        (async () => {
          if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
            return new Promise(resolve => {
              chrome.runtime.sendMessage('${EXT_ID}', {type: 'AUTO_RUN', source: 'sidepanel', payload: { totalRuns: 1, autoRunSkipFailures: true, mode: 'restart' }}, resp => {
                resolve(JSON.stringify(resp || {sent: true}));
              });
            });
          }
          return JSON.stringify({error: 'chrome.runtime not available'});
        })()
      `,
      awaitPromise: true,
      returnByValue: true
    });
    console.log('[CDP] 启动结果:', result.value);
  }
  
  await client.close();
  console.log('[CDP] 完成');
}

main().catch(e => {
  console.error('[CDP] 错误:', e.message);
  process.exit(1);
});
