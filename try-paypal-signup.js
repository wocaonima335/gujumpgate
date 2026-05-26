const CDP = require('chrome-remote-interface');
(async()=>{
  try {
    const c = await CDP({target:'BEF6BA8C24B3B4F88808A082EB1E0E55',host:'127.0.0.1',port:9222});
    const {Runtime} = c;
    
    // Check inputs and buttons
    const r0 = await Runtime.evaluate({
      expression: 'JSON.stringify({inputs:[...document.querySelectorAll("input")].map(i=>({type:i.type,name:i.name,id:i.id,placeholder:i.placeholder,visible:i.offsetParent!==null})),buttons:[...document.querySelectorAll("button")].map(b=>({text:b.innerText?.trim().substring(0,50),type:b.type,visible:b.offsetParent!==null}))})',
      returnByValue: true
    });
    console.log('Page elements:', r0.result.value);
    
    // Fill email
    const email = 'james.smith.' + Math.floor(Math.random()*9000+1000) + '@gmail.com';
    const r1 = await Runtime.evaluate({
      expression: `
        const emailInput = document.querySelector('input[name="email"]') || document.querySelector('input[type="email"]');
        if (emailInput) {
          emailInput.focus();
          emailInput.value = '${email}';
          emailInput.dispatchEvent(new Event('input', {bubbles:true}));
          emailInput.dispatchEvent(new Event('change', {bubbles:true}));
          'filled: ' + emailInput.value;
        } else { 'no email input'; }
      `,
      returnByValue: true
    });
    console.log('Fill result:', r1.result.value);
    
    await new Promise(r => setTimeout(r, 2000));
    
    // Click "Continue to Payment"
    const r2 = await Runtime.evaluate({
      expression: `
        const btn = [...document.querySelectorAll('button')].find(b => 
          b.textContent?.includes('Continue') || b.textContent?.includes('Payment') || b.type === 'submit'
        );
        if (btn) { btn.click(); 'clicked: ' + btn.textContent?.trim(); }
        else { 'no button found'; }
      `,
      returnByValue: true
    });
    console.log('Click result:', r2.result.value);
    
    // Wait for page change
    await new Promise(r => setTimeout(r, 10000));
    
    const r3 = await Runtime.evaluate({
      expression: 'JSON.stringify({url:location.href, title:document.title, body:document.body?.innerText?.substring(0,800)})',
      returnByValue: true
    });
    console.log('After 10s:', r3.result.value);
    
    await c.close();
  } catch(e) { console.error('ERR:', e.message); }
})();
