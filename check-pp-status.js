const CDP = require('chrome-remote-interface');
(async()=>{
  try {
    const c = await CDP({target:'A0C77BD8543E514A7AB0DD523242BBE4',host:'127.0.0.1',port:9222});
    const {Runtime} = c;
    const r = await Runtime.evaluate({expression:'document.body?.innerText?.substring(0,600)||"empty"',returnByValue:true});
    console.log('TEXT:', r.result.value);
    const r2 = await Runtime.evaluate({expression:'[...document.querySelectorAll("input")].map(i=>i.type+":"+i.name+":"+(i.offsetParent!==null)).join(" | ")',returnByValue:true});
    console.log('INPUTS:', r2.result.value);
    await c.close();
  } catch(e) { console.error('ERR:', e.message); }
})();
