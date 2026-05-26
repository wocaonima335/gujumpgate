const CDP = require('chrome-remote-interface');
(async () => {
  const client = await CDP({port: 9222});
  const {Runtime} = client;
  const {result} = await Runtime.evaluate({expression: 'document.body.innerText.substring(0, 500)'});
  console.log(result.value);
  await client.close();
})();