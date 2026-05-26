const CDP = require('chrome-remote-interface');
(async()=>{
  try {
    const targets = await new Promise((res,rej)=>{
      const http = require('http');
      http.get('http://127.0.0.1:9222/json', r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res(JSON.parse(d)))}).on('error',rej);
    });
    const pp = targets.find(t=>t.type==='page' && t.url?.includes('paypal.com/signup'));
    if(!pp) { console.log('No PayPal signup page'); return; }
    const c = await CDP({target:pp.webSocketDebuggerUrl,host:'127.0.0.1',port:9222});
    const {Runtime} = c;
    
    // Clear the phone field and fill with the second number
    const r = await Runtime.evaluate({
      expression: `
        const telInput = document.querySelector('input[type="tel"]');
        if (telInput) {
          // Clear existing value
          telInput.focus();
          telInput.value = '';
          telInput.dispatchEvent(new Event('input', {bubbles:true}));
          telInput.dispatchEvent(new Event('change', {bubbles:true}));
          
          // Wait a bit then fill new number
          setTimeout(() => {
            telInput.focus();
            telInput.value = '(656) 268-9508';
            telInput.dispatchEvent(new Event('input', {bubbles:true}));
            telInput.dispatchEvent(new Event('change', {bubbles:true}));
            telInput.dispatchEvent(new KeyboardEvent('keyup', {bubbles:true}));
            console.log('Phone changed to:', telInput.value);
          }, 500);
          
          'clearing and refilling phone';
        } else { 'no tel input'; }
      `,
      returnByValue: true
    });
    console.log('Result:', r.result.value);
    
    await new Promise(r => setTimeout(r, 3000));
    
    // Check updated value
    const r2 = await Runtime.evaluate({
      expression: 'document.querySelector("input[type=tel]")?.value || "no tel input"',
      returnByValue: true
    });
    console.log('Phone value now:', r2.result.value);
    
    await c.close();
  } catch(e) { console.error('ERR:', e.message); }
})();
