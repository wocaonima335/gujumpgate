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

  const stripe = targets.find(t => t.url && t.url.includes('pay.openai.com'));
  if (!stripe) { console.log('No Stripe page'); return; }

  const client = await CDP({ target: stripe.webSocketDebuggerUrl });
  
  // 找到PayPal按钮并点击
  const r = await client.Runtime.evaluate({
    expression: `(() => {
      // 查找所有包含PayPal文本的元素
      const all = document.querySelectorAll('*');
      const paypalEls = [];
      for (const el of all) {
        if (el.textContent.trim() === 'PayPal' && el.children.length === 0) {
          paypalEls.push({
            tag: el.tagName,
            text: el.textContent.trim(),
            class: el.className,
            id: el.id,
            rect: el.getBoundingClientRect(),
            role: el.getAttribute('role'),
            ariaSelected: el.getAttribute('aria-selected'),
          });
        }
      }
      return JSON.stringify(paypalEls);
    })()`,
    returnByValue: true,
  });
  console.log('PayPal elements:', r.result.value);

  // 点击PayPal选项
  const r2 = await client.Runtime.evaluate({
    expression: `(() => {
      const all = document.querySelectorAll('*');
      for (const el of all) {
        if (el.textContent.trim() === 'PayPal' && el.children.length === 0) {
          el.click();
          return 'clicked PayPal: ' + el.tagName + '.' + el.className;
        }
      }
      return 'PayPal not found';
    })()`,
    returnByValue: true,
  });
  console.log('Click result:', r2.result.value);

  await client.close();
}

main().catch(e => console.error(e.message));