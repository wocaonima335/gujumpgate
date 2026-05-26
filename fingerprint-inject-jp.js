// fingerprint-inject-jp.js — Inject browser fingerprint matching JP IP geolocation
// IP: 106.161.71.221, KDDI, Tokyo, JP, timezone: Asia/Tokyo

const CDP = require('chrome-remote-interface');
const http = require('http');

const GEO = {
  locale: 'ja-JP',
  language: 'ja-JP,ja,en-US,en',
  timezone: 'Asia/Tokyo',
  latitude: 35.6895,
  longitude: 139.6917,
  country: 'JP',
  region: 'Tokyo',
  city: 'Tokyo',
};

async function main() {
  const targets = await new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:9222/json', res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d)));
    }).on('error', reject);
  });

  const tab = targets.find(t => t.type === 'page' && !t.url.includes('sidepanel') && !t.url.includes('background') && !t.url.includes('chrome-extension'));
  if (!tab) { console.log('No usable tab'); return; }

  const client = await CDP({ target: tab.webSocketDebuggerUrl });
  const { Emulation, Network, Page } = client;

  // 1. Set timezone
  await Emulation.setTimezoneOverride({ timezoneId: GEO.timezone });
  console.log(`[FP] Timezone: ${GEO.timezone}`);

  // 2. Set locale
  await Emulation.setLocaleOverride({ locale: GEO.locale });
  console.log(`[FP] Locale: ${GEO.locale}`);

  // 3. Set geolocation
  await Emulation.setGeolocationOverride({
    latitude: GEO.latitude,
    longitude: GEO.longitude,
    accuracy: 100,
  });
  console.log(`[FP] Geolocation: ${GEO.latitude}, ${GEO.longitude} (${GEO.city})`);

  // 4. Set Accept-Language header
  await Network.enable();
  await Network.setExtraHTTPHeaders({ headers: { 'Accept-Language': GEO.language } });
  console.log(`[FP] Accept-Language: ${GEO.language}`);

  // 5. Inject JS overrides for all new documents
  await Page.enable();
  await Page.addScriptToEvaluateOnNewDocument({
    source: `
      // Override navigator.language
      Object.defineProperty(navigator, 'language', { get: () => '${GEO.locale}' });
      Object.defineProperty(navigator, 'languages', { get: () => ['${GEO.locale}', 'ja', 'en-US', 'en'] });
      
      // Override Intl.DateTimeFormat timezone
      const origDateTimeFormat = Intl.DateTimeFormat;
      Intl.DateTimeFormat = function(...args) {
        if (args.length === 0 || !args[0]) args[0] = '${GEO.locale}';
        if (args.length < 2 || !args[1] || !args[1].timeZone) {
          args[1] = args[1] || {};
          args[1].timeZone = '${GEO.timezone}';
        }
        return new origDateTimeFormat(...args);
      };
      Intl.DateTimeFormat.prototype = origDateTimeFormat.prototype;
      Intl.DateTimeFormat.supportedLocalesOf = origDateTimeFormat.supportedLocalesOf;
      
      // Override navigator.geolocation
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition = function(success, error, options) {
          success({
            coords: {
              latitude: ${GEO.latitude},
              longitude: ${GEO.longitude},
              accuracy: 100,
              altitude: null,
              altitudeAccuracy: null,
              heading: null,
              speed: null,
            },
            timestamp: Date.now(),
          });
        };
      }
      
      console.log('[FP] Injected: locale=${GEO.locale}, tz=${GEO.timezone}, geo=${GEO.city}');
    `,
  });
  console.log('[FP] JS overrides injected');

  // 6. Navigate to chatgpt.com
  await Page.navigate({ url: 'https://chatgpt.com' });
  await Page.loadEventFired();
  console.log('[FP] Navigated to chatgpt.com');

  // 7. Verify
  await new Promise(r => setTimeout(r, 3000));
  const verify = await client.Runtime.evaluate({
    expression: `JSON.stringify({
      language: navigator.language,
      languages: navigator.languages,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      timezoneOffset: new Date().getTimezoneOffset(),
      platform: navigator.platform,
      userAgent: navigator.userAgent.substring(0, 80),
    })`,
    returnByValue: true,
  });
  console.log('[FP] Verify:', verify.result.value);

  await client.close();
}

main().catch(e => console.error('[FP] Error:', e.message));