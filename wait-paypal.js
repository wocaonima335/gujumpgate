const CDP = require('chrome-remote-interface');
(async()=>{
  try {
    const c = await CDP({target:'BEF6BA8C24B3B4F88808A082EB1E0E55',host:'127.0.0.1',port:9222});
    const {Runtime} = c;
    
    // Wait 30 seconds
    await new Promise(r => setTimeout(r, 30000));
    
    const r = await Runtime.evaluate({
      expression: 'JSON.stringify({url:location.href, title:document.title, body:document.body?.innerText?.substring(0,1000), inputs:[...document.querySelectorAll("input")].filter(i=>i.offsetParent!==null).map(i=>i.type+":"+i.name+":"+i.placeholder).join(" | ")})',
      returnByValue: true
    });
    console.log('After 30s:', r.result.value);
    
    await c.close();
  } catch(e) { console.error('ERR:', e.message); }
})();
