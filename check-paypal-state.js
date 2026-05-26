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
  
  const r = await client.Runtime.evaluate({
    expression: `(() => {
      const radio = document.getElementById('payment-method-accordion-item-title-paypal');
      const paypalSection = document.querySelector('.paypal-accordion-item');
      const cardRadio = document.getElementById('payment-method-accordion-item-title-card');
      return JSON.stringify({
        paypalRadioChecked: radio?.checked,
        paypalRadioAriaChecked: radio?.getAttribute('aria-checked'),
        cardRadioChecked: cardRadio?.checked,
        paypalSectionDisplay: paypalSection ? getComputedStyle(paypalSection).display : 'N/A',
        paypalSectionExpanded: paypalSection?.getAttribute('aria-expanded'),
        // 查找PayPal面板内容
        paypalBody: paypalSection?.querySelector('.AccordionItemBody, [class*=Body]')?.innerText?.substring(0, 200) || 'no body',
        // 查看整个页面中是否有PayPal相关的新内容
        bodyLower: document.body.innerText.substring(0, 2000),
      });
    })()`,
    returnByValue: true,
  });
  console.log(r.result.value);
  await client.close();
}

main().catch(e => console.error(e.message));