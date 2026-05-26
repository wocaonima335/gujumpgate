const CDP = require('chrome-remote-interface');
(async()=>{
  try {
    const targets = await new Promise((res,rej)=>{
      const http = require('http');
      http.get('http://127.0.0.1:9222/json', r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res(JSON.parse(d)))}).on('error',rej);
    });
    const ppPages = targets.filter(t=>t.type==='page' && t.url?.includes('paypal.com'));
    for(const p of ppPages) {
      const c = await CDP({target:p.webSocketDebuggerUrl,host:'127.0.0.1',port:9222});
      const {Runtime} = c;
      const r = await Runtime.evaluate({
        expression: 'document.body?.innerText?.substring(0,800) || "empty"',
        returnByValue: true
      });
      console.log('---', p.url?.substring(0,80), '---');
      console.log(r.result.value);
      const r2 = await Runtime.evaluate({
        expression: '[...document.querySelectorAll("input")].filter(i=>i.offsetParent!==null).map(i=>i.type+":"+i.name+":"+i.value?.substring(0,25)).join(" | ")',
        returnByValue: true
      });
      console.log('Inputs:', r2.result.value);
      await c.close();
    }
  } catch(e) { console.error('ERR:', e.message); }
})();
