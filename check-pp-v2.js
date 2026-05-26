const CDP = require('chrome-remote-interface');
(async()=>{
  try {
    const targets = await new Promise((res,rej)=>{
      const http = require('http');
      http.get('http://127.0.0.1:9222/json', r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res(JSON.parse(d)))}).on('error',rej);
    });
    const ppPages = targets.filter(t=>t.type==='page' && t.url?.includes('paypal.com'));
    for(const p of ppPages) {
      console.log('Target:', p.id.substring(0,8), p.url?.substring(0,100));
      const c = await CDP({target:p.webSocketDebuggerUrl,host:'127.0.0.1',port:9222});
      const {Runtime} = c;
      const r = await Runtime.evaluate({
        expression: 'JSON.stringify({body:document.body?.innerText?.substring(0,300),inputs:[...document.querySelectorAll("input")].filter(i=>i.offsetParent!==null).map(i=>i.type+":"+i.name+":"+i.value?.substring(0,20)).join(" | ")})',
        returnByValue: true
      });
      console.log('State:', r.result.value.substring(0,500));
      await c.close();
    }
  } catch(e) { console.error('ERR:', e.message); }
})();
