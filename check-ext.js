const CDP = require('chrome-remote-interface');
(async () => {
  try {
    const client = await CDP({port: 9222});
    const {Runtime, Page} = client;
    
    // Navigate to extensions page
    await Page.navigate({url: 'chrome://extensions/'});
    await new Promise(r => setTimeout(r, 5000));
    
    const {result} = await Runtime.evaluate({expression: 'document.body.innerText.substring(0, 800)'});
    console.log('PAGE:', result.value);
    
    // Also check URL
    const {result: urlResult} = await Runtime.evaluate({expression: 'window.location.href'});
    console.log('URL:', urlResult.value);
    
    await client.close();
  } catch(e) {
    console.error('ERR:', e.message);
  }
})();