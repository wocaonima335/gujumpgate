const CDP = require('chrome-remote-interface');
(async()=>{
  try {
    const c = await CDP({target:'A0C77BD8543E514A7AB0DD523242BBE4',host:'127.0.0.1',port:9222});
    const {Runtime, Network, Log} = c;
    
    // Enable console and network
    await Runtime.enable();
    await Log.enable();
    await Network.enable();
    
    // Check for any error messages in the page
    const r = await Runtime.evaluate({
      expression: `
        const errors = [];
        // Check for visible error messages
        const errorEls = document.querySelectorAll('[class*="error"], [class*="alert"], [role="alert"], .notification');
        errorEls.forEach(el => { if(el.innerText) errors.push(el.innerText.substring(0,200)); });
        
        // Check for iframes
        const iframes = [...document.querySelectorAll('iframe')].map(f=>f.src?.substring(0,100));
        
        JSON.stringify({errors, iframes, url:location.href, readyState:document.readyState});
      `,
      returnByValue: true
    });
    console.log('Page state:', r.result.value);
    
    // Also check the other PayPal page (BEF6BA8C24B3B4F88808A082EB1E0E55) which has ctxId param
    const c2 = await CDP({target:'BEF6BA8C24B3B4F88808A082EB1E0E55',host:'127.0.0.1',port:9222});
    const {Runtime:R2} = c2;
    const r2 = await R2.evaluate({
      expression: 'JSON.stringify({url:location.href, title:document.title, body:document.body?.innerText?.substring(0,500)})',
      returnByValue: true
    });
    console.log('Other PayPal page:', r2.result.value);
    await c2.close();
    
    await c.close();
  } catch(e) { console.error('ERR:', e.message); }
})();
