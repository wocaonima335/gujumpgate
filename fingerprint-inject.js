// fingerprint-inject.js — Inject browser fingerprint matching IP geolocation
// Called via CDP after Chromium starts, before navigating to chatgpt.com

const CDP = require('chrome-remote-interface');
const http = require('http');

// IP geolocation info (from ipinfo.io for the proxy exit IP)
const GEO = {
  // Current exit IP: 47.178.17.207 (Frontier Communications, Rancho Cucamonga, CA, US)
  locale: 'en-US',
  language: 'en-US,en',
  timezone: 'America/Los_Angeles',
  latitude: 34.1064,
  longitude: -117.5931,
  country: 'US',
  region: 'CA',
  city: 'Rancho Cucamonga',
};

async function main() {
  const targets = await new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:9222/json', res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d)));
    }).on('error', reject);
  });

  const tab = targets.find(t => t.type === 'page' && t.url === 'about:blank');
  if (!tab) { console.log('No about:blank tab'); return; }

  const client = await CDP({ target: tab.webSocketDebuggerUrl });
  const { Emulation, Network, Page } = client;

  // 1. Set locale/timezone via Emulation
  await Emulation.setTimezoneOverride({ timezoneId: GEO.timezone });
  console.log(`[FP] Timezone set to: ${GEO.timezone}`);

  await Emulation.setLocaleOverride({ locale: GEO.locale });
  console.log(`[FP] Locale set to: ${GEO.locale}`);

  // 2. Set geolocation
  await Emulation.setGeolocationOverride({
    latitude: GEO.latitude,
    longitude: GEO.longitude,
    accuracy: 100,
  });
  console.log(`[FP] Geolocation set to: ${GEO.latitude}, ${GEO.longitude} (${GEO.city})`);

  // 3. Set user agent (keep Chrome version, just ensure consistent)
  // Already set by Chrome, no need to override

  // 4. Override navigator.language via CDP
  await Network.setExtraHTTPHeaders({ headers: { 'Accept-Language': GEO.language } });
  console.log(`[FP] Accept-Language header set to: ${GEO.language}`);

  // 5. Inject JavaScript to override navigator properties
  await Page.enable();
  await Page.addScriptToEvaluateOnNewDocument({
    source: `
      // Override navigator.language
      Object.defineProperty(navigator, 'language', { get: () => '${GEO.locale}' });
      Object.defineProperty(navigator, 'languages', { get: () => ['${GEO.locale}', 'en'] });
      
      // Override Intl.DateTimeFormat to use our timezone
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
      
      // Override Date.prototype.getTimezoneOffset
      const targetOffset = new Date().getTimezoneOffset(); // This will be correct since we set Emulation timezone
      
      // Override navigator.platform to match US
      // Linux x86_64 is fine, no need to change
      
      // Override navigator.geolocation if accessed
      const origGetCurrentPosition = navigator.geolocation?.getCurrentPosition;
      if (origGetCurrentPosition) {
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
      
      console.log('[FP] Fingerprint injected: locale=${GEO.locale}, timezone=${GEO.timezone}, geo=${GEO.city}');
    `,
  });
  console.log('[FP] JS fingerprint override injected on new document');

  // 6. Navigate to chatgpt.com
  await Page.navigate({ url: 'https://chatgpt.com' });
  await Page.loadEventFired();
  console.log('[FP] Navigated to chatgpt.com');

  // 7. Verify fingerprint
  await new Promise(r => setTimeout(r, 3000));
  const verify = await client.Runtime.evaluate({
    expression: `JSON.stringify({
      language: navigator.language,
      languages: navigator.languages,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      timezoneOffset: new Date().getTimezoneOffset(),
      platform: navigator.platform,
    })`,
    returnByValue: true,
  });
  console.log('[FP] Verification:', verify.result.value);

  await client.close();
}

main().catch(e => console.error('[FP] Error:', e.message));