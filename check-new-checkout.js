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
  const chatgpt = targets.find(t => t.url && t.url.includes('chatgpt.com'));
  if (!chatgpt) { console.log('No ChatGPT page'); return; }
  const client = await CDP({ target: chatgpt.webSocketDebuggerUrl });
  
  // 导航到新的checkout URL
  const checkoutUrl = 'https://pay.openai.com/c/pay/cs_live_a1muzDsbCuWGO6xmXKprKIpnyvOIxhnvongxmpNaHa36JUU1GL8WpM0hMD';
  await client.Page.navigate({ url: checkoutUrl });
  await new Promise(r => setTimeout(r, 8000));
  
  // 读取页面内容
  const r = await client.Runtime.evaluate({
    expression: `JSON.stringify({
      title: document.title,
      bodySnippet: document.body?.innerText?.substring(0, 500) || '',
      hasPayPal: /paypal/i.test(document.body?.innerText || ''),
      totalDue: (document.body?.innerText?.match(/total\\s*due\\s*today[^$]*\\$([\\d.]+)/i) || [])[1] || 'not found',
    })`,
    returnByValue: true,
  });
  console.log('New checkout page:', r.result.value);

  await client.close();
}

main().catch(e => console.error(e.message));