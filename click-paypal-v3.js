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
  
  // 使用更真实的点击方式
  const r = await client.Runtime.evaluate({
    expression: `(() => {
      const radio = document.getElementById('payment-method-accordion-item-title-paypal');
      if (!radio) return 'radio not found';
      
      // 方法1: 设置checked属性并触发change事件
      radio.checked = true;
      radio.dispatchEvent(new Event('change', { bubbles: true }));
      radio.dispatchEvent(new Event('click', { bubbles: true }));
      radio.dispatchEvent(new Event('input', { bubbles: true }));
      
      // 方法2: 也触发React的合成事件
      // 找到React内部属性
      const reactKey = Object.keys(radio).find(k => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$') || k.startsWith('__reactEvents$'));
      
      // 方法3: 点击paypal accordion item的整个区域
      const accordionItem = document.querySelector('.paypal-accordion-item');
      if (accordionItem) {
        accordionItem.click();
      }
      
      // 方法4: 点击label
      const label = document.querySelector('label[for=payment-method-accordion-item-title-paypal]');
      if (label) {
        label.click();
      }
      
      return JSON.stringify({
        radioChecked: radio.checked,
        radioAriaChecked: radio.getAttribute('aria-checked'),
        reactKey: reactKey || 'none',
      });
    })()`,
    returnByValue: true,
  });
  console.log('After click:', r.result.value);

  // 等几秒后检查
  await new Promise(r => setTimeout(r, 3000));
  
  const r2 = await client.Runtime.evaluate({
    expression: `(() => {
      const radio = document.getElementById('payment-method-accordion-item-title-paypal');
      const paypalBody = document.querySelector('.paypal-accordion-item .AccordionItemBody, .paypal-accordion-item [class*=Body]');
      const subscribeBtn = document.querySelector('button[type=submit], [class*=SubmitButton]');
      return JSON.stringify({
        radioChecked: radio?.checked,
        paypalBodyText: paypalBody?.innerText?.substring(0, 300) || 'no body',
        subscribeBtnText: subscribeBtn?.innerText || 'no btn',
        // 检查是否有PayPal弹窗或iframe
        iframes: [...document.querySelectorAll('iframe')].map(f => f.src?.substring(0, 100) || '').filter(s => /paypal/i.test(s)),
      });
    })()`,
    returnByValue: true,
  });
  console.log('State after:', r2.result.value);

  await client.close();
}

main().catch(e => console.error(e.message));