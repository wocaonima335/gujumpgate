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
  
  // 查找PayPal相关的所有可交互元素
  const r = await client.Runtime.evaluate({
    expression: `(() => {
      const results = [];
      // 查找radio, tab, button等
      const selectors = [
        '[id*=paypal]', '[class*=paypal]', '[name*=paypal]',
        '[id*=PayPal]', '[class*=PayPal]',
        '[role=tab]', '[role=radio]', '[role=option]',
        'input[type=radio]', 'button',
      ];
      for (const sel of selectors) {
        try {
          const els = document.querySelectorAll(sel);
          for (const el of els) {
            const text = el.textContent.trim().substring(0, 50);
            if (/paypal/i.test(text) || /paypal/i.test(el.id) || /paypal/i.test(el.className)) {
              results.push({
                selector: sel,
                tag: el.tagName,
                id: el.id,
                class: el.className?.substring?.(0, 80),
                text: text.substring(0, 30),
                type: el.type,
                role: el.getAttribute('role'),
                checked: el.checked,
                ariaChecked: el.getAttribute('aria-checked'),
                ariaSelected: el.getAttribute('aria-selected'),
              });
            }
          }
        } catch(e) {}
      }
      return JSON.stringify(results);
    })()`,
    returnByValue: true,
  });
  console.log('PayPal interactive elements:', r.result.value);

  // 尝试点击payment-method-label-paypal的父元素
  const r2 = await client.Runtime.evaluate({
    expression: `(() => {
      const label = document.getElementById('payment-method-label-paypal');
      if (!label) return 'label not found';
      // 点击父元素
      const parent = label.closest('[role=tab], [role=radio], button, [class*=method], [class*=option]');
      if (parent) {
        parent.click();
        return 'clicked parent: ' + parent.tagName + '.' + (parent.className||'').substring(0,50);
      }
      // 点击label本身
      label.click();
      // 也尝试找到radio input
      const radio = document.querySelector('input[type=radio][id*=paypal], input[name*=paypal]');
      if (radio) {
        radio.click();
        return 'clicked radio: ' + radio.id;
      }
      return 'clicked label only';
    })()`,
    returnByValue: true,
  });
  console.log('Click result:', r2.result.value);

  await client.close();
}

main().catch(e => console.error(e.message));