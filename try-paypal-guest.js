const CDP = require('chrome-remote-interface');
(async()=>{
  try {
    const c = await CDP({target:'A0C77BD8543E514A7AB0DD523242BBE4',host:'127.0.0.1',port:9222});
    const {Runtime, Page} = c;
    
    // Fill email with a random address
    const email = 'james.smith.' + Math.floor(Math.random()*9000+1000) + '@gmail.com';
    console.log('Using email:', email);
    
    const r1 = await Runtime.evaluate({
      expression: `
        const emailInput = document.querySelector('input[name="login_email"]');
        if (emailInput) {
          emailInput.focus();
          emailInput.value = '${email}';
          emailInput.dispatchEvent(new Event('input', {bubbles:true}));
          emailInput.dispatchEvent(new Event('change', {bubbles:true}));
          emailInput.dispatchEvent(new KeyboardEvent('keydown', {bubbles:true}));
          emailInput.dispatchEvent(new KeyboardEvent('keyup', {bubbles:true}));
          'filled: ' + emailInput.value;
        } else { 'no email input found'; }
      `,
      returnByValue: true
    });
    console.log('Fill result:', r1.result.value);
    
    await new Promise(r => setTimeout(r, 2000));
    
    // Click Next button
    const r2 = await Runtime.evaluate({
      expression: `
        const btn = document.querySelector('#btnNext') || 
                    document.querySelector('button[type="submit"]') ||
                    [...document.querySelectorAll('button')].find(b => b.textContent?.includes('Next') || b.textContent?.includes('下一步'));
        if (btn) { btn.click(); 'clicked: ' + btn.textContent?.trim(); }
        else { 'no next button found, buttons: ' + [...document.querySelectorAll('button')].map(b=>b.textContent?.trim()).join(','); }
      `,
      returnByValue: true
    });
    console.log('Click result:', r2.result.value);
    
    // Wait for page change
    await new Promise(r => setTimeout(r, 8000));
    
    // Check current state
    const r3 = await Runtime.evaluate({
      expression: 'JSON.stringify({url:location.href, title:document.title, body:document.body?.innerText?.substring(0,500)})',
      returnByValue: true
    });
    console.log('After click:', r3.result.value);
    
    await c.close();
  } catch(e) { console.error('ERR:', e.message); }
})();
