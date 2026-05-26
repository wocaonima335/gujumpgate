const CDP = require('chrome-remote-interface');
(async()=>{
  try {
    const c = await CDP({target:'7F80E7A08FA5BBDE48383DFBF5FE82FC',host:'127.0.0.1',port:9222});
    const {Runtime} = c;
    
    // First clear the phone error by changing the phone number
    // Use the second number: 16562689508
    const r = await Runtime.evaluate({
      expression: `
        const telInput = document.querySelector('input[type="tel"]');
        if (telInput) {
          // Focus and clear
          telInput.focus();
          telInput.dispatchEvent(new Event('focus', {bubbles:true}));
          
          // Select all and delete
          document.execCommand('selectAll');
          document.execCommand('delete');
          
          // Type new number character by character
          const newPhone = '6562689508';
          for (let ch of newPhone) {
            telInput.dispatchEvent(new KeyboardEvent('keydown', {key:ch,bubbles:true}));
            telInput.value += ch;
            telInput.dispatchEvent(new InputEvent('input', {data:ch,bubbles:true}));
            telInput.dispatchEvent(new KeyboardEvent('keyup', {key:ch,bubbles:true}));
          }
          telInput.dispatchEvent(new Event('change', {bubbles:true}));
          telInput.dispatchEvent(new Event('blur', {bubbles:true}));
          'Phone changed to: ' + telInput.value;
        } else { 'no tel input'; }
      `,
      returnByValue: true
    });
    console.log('Change result:', r.result.value);
    
    await new Promise(r => setTimeout(r, 3000));
    
    // Check state
    const r2 = await Runtime.evaluate({
      expression: 'JSON.stringify({phone:document.querySelector("input[type=tel]")?.value, errors:[...document.querySelectorAll("[class*=error],[role=alert]")].map(e=>e.innerText?.substring(0,100)).filter(Boolean)})',
      returnByValue: true
    });
    console.log('Current state:', r2.result.value);
    
    await c.close();
  } catch(e) { console.error('ERR:', e.message); }
})();
