const CDP = require('chrome-remote-interface');
(async()=>{
  try {
    const targets = await new Promise((res,rej)=>{
      const http = require('http');
      http.get('http://127.0.0.1:9222/json', r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res(JSON.parse(d)))}).on('error',rej);
    });
    const pp = targets.find(t=>t.type==='page' && t.url?.includes('paypal.com/signup'));
    if(!pp) { console.log('No signup page found'); return; }
    const c = await CDP({target:pp.webSocketDebuggerUrl,host:'127.0.0.1',port:9222});
    const {Runtime} = c;
    
    // Get body text more thoroughly
    const r = await Runtime.evaluate({
      expression: 'document.body?.innerText?.substring(0,1500) || "empty"',
      returnByValue: true
    });
    console.log('Body text:', r.result.value);
    
    // Get error elements specifically
    const r2 = await Runtime.evaluate({
      expression: `
        const errs = [...document.querySelectorAll('[class*="error"],[class*="Error"],[role="alert"],.fieldError,.errorMessage,.validationMessage')].map(e=>({
          text:e.innerText?.substring(0,100),
          class:e.className?.substring(0,50)
        })).filter(e=>e.text);
        JSON.stringify(errs);
      `,
      returnByValue: true
    });
    console.log('Error elements:', r2.result.value);
    
    // Check if there's a submit/pay button
    const r3 = await Runtime.evaluate({
      expression: `
        const btns = [...document.querySelectorAll('button')].filter(b=>b.offsetParent!==null).map(b=>({
          text:b.innerText?.trim().substring(0,50),
          type:b.type,
          disabled:b.disabled
        }));
        JSON.stringify(btns);
      `,
      returnByValue: true
    });
    console.log('Buttons:', r3.result.value);
    
    await c.close();
  } catch(e) { console.error('ERR:', e.message); }
})();
