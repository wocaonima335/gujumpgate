const CDP = require('chrome-remote-interface');
(async()=>{
  try {
    const c = await CDP({target:'BEF6BA8C24B3B4F88808A082EB1E0E55',host:'127.0.0.1',port:9222});
    const {Runtime, Log} = c;
    await Log.enable();
    
    const logs = [];
    Log.entryAdded(e => logs.push(e.entry?.text?.substring(0,200)));
    
    await new Promise(r => setTimeout(r, 30000));
    
    const r = await Runtime.evaluate({
      expression: 'JSON.stringify({url:location.href, body:document.body?.innerText?.substring(0,500)})',
      returnByValue: true
    });
    console.log('After 60s total:', r.result.value);
    if(logs.length) console.log('Console logs:', logs.slice(-5).join('\n'));
    
    await c.close();
  } catch(e) { console.error('ERR:', e.message); }
})();
