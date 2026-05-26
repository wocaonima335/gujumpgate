const CDP = require('chrome-remote-interface');

async function main() {
  const client = await CDP({ host: '127.0.0.1', port: 9222 });
  const { Runtime } = client;

  // 检查chrome对象
  const r = await Runtime.evaluate({
    expression: `JSON.stringify({
      hasChrome: typeof chrome !== 'undefined',
      hasStorage: typeof chrome?.storage !== 'undefined',
      hasRuntime: typeof chrome?.runtime !== 'undefined',
      hasSendMessage: typeof chrome?.runtime?.sendMessage === 'function',
      location: location.href,
    })`,
    returnByValue: true,
  });
  console.log('Environment:', r.result.value);

  await client.close();
}

main().catch(e => console.error(e.message));
