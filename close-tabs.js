const CDP = require('chrome-remote-interface');
const http = require('http');

async function main() {
  const targets = await new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:9222/json', res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d)));
    }).on('error', reject);
  });
  
  // Close all chatgpt.com tabs except the first one and sidepanel
  const chatgptTabs = targets.filter(t => 
    t.url.includes('chatgpt.com') && 
    !t.url.includes('sidepanel') && 
    !t.url.includes('background')
  );
  
  console.log(`Found ${chatgptTabs.length} ChatGPT tabs`);
  
  // Keep only the first one
  for (let i = 1; i < chatgptTabs.length; i++) {
    try {
      const client = await CDP({ target: chatgptTabs[i].webSocketDebuggerUrl });
      await client.Page.close();
      await client.close();
      console.log(`Closed tab ${i}: ${chatgptTabs[i].url.substring(0, 60)}`);
    } catch(e) {
      console.log(`Failed to close tab ${i}: ${e.message}`);
    }
  }
  
  console.log('Done');
}

main().catch(e => console.error(e.message));