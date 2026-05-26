const CDP = require('chrome-remote-interface');
(async()=>{
  try {
    const c = await CDP({target:'7F80E7A0',host:'127.0.0.1',port:9222});
    const {Runtime} = c;
    const r = await Runtime.evaluate({
      expression: `
        const inputs = [...document.querySelectorAll('input')].filter(i=>i.offsetParent!==null);
        const data = inputs.map(i=>({
          type:i.type, name:i.name, id:i.id, 
          value:i.value?.substring(0,30), 
          placeholder:i.placeholder?.substring(0,30),
          visible:i.offsetParent!==null
        }));
        JSON.stringify(data);
      `,
      returnByValue: true
    });
    console.log('Input values:', r.result.value);
    
    // Also check for any error messages
    const r2 = await Runtime.evaluate({
      expression: `
        const errors = [...document.querySelectorAll('[class*="error"], [class*="Error"], [role="alert"], .fieldError, .errorMessage')].map(e=>e.innerText?.substring(0,100)).filter(Boolean);
        JSON.stringify(errors);
      `,
      returnByValue: true
    });
    console.log('Errors:', r2.result.value);
    
    await c.close();
  } catch(e) { console.error('ERR:', e.message); }
})();
