const CDP = require('chrome-remote-interface');

async function main() {
  const client = await CDP({ port: 9222 });
  const { Network, Page } = client;
  await Network.enable();
  
  // Get cookies for chatgpt.com
  const { cookies } = await Network.getCookies({ urls: ['https://chatgpt.com', 'https://auth.openai.com'] });
  
  const important = cookies.filter(c => 
    c.name.includes('session') || c.name.includes('token') || 
    c.name.includes('auth') || c.name.includes('next') ||
    c.name.includes('oai')
  );
  
  console.log('Important cookies:');
  important.forEach(c => {
    console.log(`  ${c.name} = ${c.value.substring(0, 40)}... (domain: ${c.domain})`);
  });
  
  console.log(`\nTotal cookies: ${cookies.length}, Important: ${important.length}`);
  await client.close();
}

main().catch(e => console.error(e.message));