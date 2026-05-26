const CDP = require('chrome-remote-interface');
(async()=>{
  try {
    const c = await CDP({target:'A0C77BD8543E514A7AB0DD523242BBE4',host:'127.0.0.1',port:9222});
    const {Runtime} = c;
    
    // Wait 15 seconds more
    await new Promise(r => setTimeout(r, 15000));
    
    const r = await Runtime.evaluate({
      expression: 'JSON.stringify({url:location.href, title:document.title, body:document.body?.innerText?.substring(0,800), inputs:[...document.querySelectorAll("input")].map(i=>i.type+":"+i.name+":"+(i.offsetParent!==null)).join(" | ")})',
      returnByValue: true
    });
    console.log('State after 15s:', r.result.value);
    
    await c.close();
  } catch(e) { console.error('ERR:', e.message); }
})();
