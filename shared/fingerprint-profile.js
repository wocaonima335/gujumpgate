(function attachFingerprintProfileModule(root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
    return;
  }
  root.MultiPageFingerprintProfile = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createFingerprintProfileModule() {
  const DEFAULT_SCREEN = Object.freeze({
    width: 1920,
    height: 1080,
    availWidth: 1920,
    availHeight: 1040,
    colorDepth: 24,
    pixelDepth: 24,
    devicePixelRatio: 1,
  });

  const DEFAULT_GEO_ACCURACY = 100;
  const DEFAULT_CANVAS_NOISE = 0.12;
  const DEFAULT_AUDIO_NOISE = 0.00002;

  const COUNTRY_PRESETS = Object.freeze({
    AU: Object.freeze({
      countryCode: 'AU',
      locale: 'en-AU',
      languages: ['en-AU', 'en'],
      acceptLanguage: 'en-AU,en;q=0.9',
      timezone: 'Australia/Sydney',
      latitude: -33.8688,
      longitude: 151.2093,
      accuracy: DEFAULT_GEO_ACCURACY,
      platform: 'Win32',
      vendor: 'Google Inc.',
      hardwareConcurrency: 8,
      deviceMemory: 8,
      maxTouchPoints: 0,
      screen: DEFAULT_SCREEN,
      webglVendor: 'Google Inc. (Intel)',
      webglRenderer: 'ANGLE (Intel, Intel(R) UHD Graphics Direct3D11 vs_5_0 ps_5_0)',
      canvasNoise: DEFAULT_CANVAS_NOISE,
      audioNoise: DEFAULT_AUDIO_NOISE,
    }),
    CA: Object.freeze({
      countryCode: 'CA',
      locale: 'en-CA',
      languages: ['en-CA', 'en', 'fr-CA'],
      acceptLanguage: 'en-CA,en;q=0.9,fr-CA;q=0.8',
      timezone: 'America/Toronto',
      latitude: 43.6532,
      longitude: -79.3832,
      accuracy: DEFAULT_GEO_ACCURACY,
      platform: 'Win32',
      vendor: 'Google Inc.',
      hardwareConcurrency: 8,
      deviceMemory: 8,
      maxTouchPoints: 0,
      screen: DEFAULT_SCREEN,
      webglVendor: 'Google Inc. (Intel)',
      webglRenderer: 'ANGLE (Intel, Intel(R) UHD Graphics Direct3D11 vs_5_0 ps_5_0)',
      canvasNoise: DEFAULT_CANVAS_NOISE,
      audioNoise: DEFAULT_AUDIO_NOISE,
    }),
    DE: Object.freeze({
      countryCode: 'DE',
      locale: 'de-DE',
      languages: ['de-DE', 'de', 'en-US', 'en'],
      acceptLanguage: 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
      timezone: 'Europe/Berlin',
      latitude: 52.52,
      longitude: 13.405,
      accuracy: DEFAULT_GEO_ACCURACY,
      platform: 'Win32',
      vendor: 'Google Inc.',
      hardwareConcurrency: 8,
      deviceMemory: 8,
      maxTouchPoints: 0,
      screen: DEFAULT_SCREEN,
      webglVendor: 'Google Inc. (Intel)',
      webglRenderer: 'ANGLE (Intel, Intel(R) UHD Graphics Direct3D11 vs_5_0 ps_5_0)',
      canvasNoise: DEFAULT_CANVAS_NOISE,
      audioNoise: DEFAULT_AUDIO_NOISE,
    }),
    FR: Object.freeze({
      countryCode: 'FR',
      locale: 'fr-FR',
      languages: ['fr-FR', 'fr', 'en-US', 'en'],
      acceptLanguage: 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
      timezone: 'Europe/Paris',
      latitude: 48.8566,
      longitude: 2.3522,
      accuracy: DEFAULT_GEO_ACCURACY,
      platform: 'Win32',
      vendor: 'Google Inc.',
      hardwareConcurrency: 8,
      deviceMemory: 8,
      maxTouchPoints: 0,
      screen: DEFAULT_SCREEN,
      webglVendor: 'Google Inc. (Intel)',
      webglRenderer: 'ANGLE (Intel, Intel(R) UHD Graphics Direct3D11 vs_5_0 ps_5_0)',
      canvasNoise: DEFAULT_CANVAS_NOISE,
      audioNoise: DEFAULT_AUDIO_NOISE,
    }),
    GB: Object.freeze({
      countryCode: 'GB',
      locale: 'en-GB',
      languages: ['en-GB', 'en'],
      acceptLanguage: 'en-GB,en;q=0.9',
      timezone: 'Europe/London',
      latitude: 51.5072,
      longitude: -0.1276,
      accuracy: DEFAULT_GEO_ACCURACY,
      platform: 'Win32',
      vendor: 'Google Inc.',
      hardwareConcurrency: 8,
      deviceMemory: 8,
      maxTouchPoints: 0,
      screen: DEFAULT_SCREEN,
      webglVendor: 'Google Inc. (Intel)',
      webglRenderer: 'ANGLE (Intel, Intel(R) UHD Graphics Direct3D11 vs_5_0 ps_5_0)',
      canvasNoise: DEFAULT_CANVAS_NOISE,
      audioNoise: DEFAULT_AUDIO_NOISE,
    }),
    ID: Object.freeze({
      countryCode: 'ID',
      locale: 'id-ID',
      languages: ['id-ID', 'id', 'en-US', 'en'],
      acceptLanguage: 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
      timezone: 'Asia/Jakarta',
      latitude: -6.2088,
      longitude: 106.8456,
      accuracy: DEFAULT_GEO_ACCURACY,
      platform: 'Win32',
      vendor: 'Google Inc.',
      hardwareConcurrency: 8,
      deviceMemory: 8,
      maxTouchPoints: 0,
      screen: DEFAULT_SCREEN,
      webglVendor: 'Google Inc. (Intel)',
      webglRenderer: 'ANGLE (Intel, Intel(R) UHD Graphics Direct3D11 vs_5_0 ps_5_0)',
      canvasNoise: DEFAULT_CANVAS_NOISE,
      audioNoise: DEFAULT_AUDIO_NOISE,
    }),
    JP: Object.freeze({
      countryCode: 'JP',
      locale: 'ja-JP',
      languages: ['ja-JP', 'ja', 'en-US', 'en'],
      acceptLanguage: 'ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7',
      timezone: 'Asia/Tokyo',
      latitude: 35.6895,
      longitude: 139.6917,
      accuracy: DEFAULT_GEO_ACCURACY,
      platform: 'Win32',
      vendor: 'Google Inc.',
      hardwareConcurrency: 8,
      deviceMemory: 8,
      maxTouchPoints: 0,
      screen: DEFAULT_SCREEN,
      webglVendor: 'Google Inc. (Intel)',
      webglRenderer: 'ANGLE (Intel, Intel(R) UHD Graphics Direct3D11 vs_5_0 ps_5_0)',
      canvasNoise: DEFAULT_CANVAS_NOISE,
      audioNoise: DEFAULT_AUDIO_NOISE,
    }),
    NL: Object.freeze({
      countryCode: 'NL',
      locale: 'nl-NL',
      languages: ['nl-NL', 'nl', 'en-US', 'en'],
      acceptLanguage: 'nl-NL,nl;q=0.9,en-US;q=0.8,en;q=0.7',
      timezone: 'Europe/Amsterdam',
      latitude: 52.3676,
      longitude: 4.9041,
      accuracy: DEFAULT_GEO_ACCURACY,
      platform: 'Win32',
      vendor: 'Google Inc.',
      hardwareConcurrency: 8,
      deviceMemory: 8,
      maxTouchPoints: 0,
      screen: DEFAULT_SCREEN,
      webglVendor: 'Google Inc. (Intel)',
      webglRenderer: 'ANGLE (Intel, Intel(R) UHD Graphics Direct3D11 vs_5_0 ps_5_0)',
      canvasNoise: DEFAULT_CANVAS_NOISE,
      audioNoise: DEFAULT_AUDIO_NOISE,
    }),
    SG: Object.freeze({
      countryCode: 'SG',
      locale: 'en-SG',
      languages: ['en-SG', 'en', 'zh-SG'],
      acceptLanguage: 'en-SG,en;q=0.9,zh-SG;q=0.8',
      timezone: 'Asia/Singapore',
      latitude: 1.3521,
      longitude: 103.8198,
      accuracy: DEFAULT_GEO_ACCURACY,
      platform: 'Win32',
      vendor: 'Google Inc.',
      hardwareConcurrency: 8,
      deviceMemory: 8,
      maxTouchPoints: 0,
      screen: DEFAULT_SCREEN,
      webglVendor: 'Google Inc. (Intel)',
      webglRenderer: 'ANGLE (Intel, Intel(R) UHD Graphics Direct3D11 vs_5_0 ps_5_0)',
      canvasNoise: DEFAULT_CANVAS_NOISE,
      audioNoise: DEFAULT_AUDIO_NOISE,
    }),
    US: Object.freeze({
      countryCode: 'US',
      locale: 'en-US',
      languages: ['en-US', 'en'],
      acceptLanguage: 'en-US,en;q=0.9',
      timezone: 'America/New_York',
      latitude: 40.7128,
      longitude: -74.006,
      accuracy: DEFAULT_GEO_ACCURACY,
      platform: 'Win32',
      vendor: 'Google Inc.',
      hardwareConcurrency: 8,
      deviceMemory: 8,
      maxTouchPoints: 0,
      screen: DEFAULT_SCREEN,
      webglVendor: 'Google Inc. (Intel)',
      webglRenderer: 'ANGLE (Intel, Intel(R) UHD Graphics Direct3D11 vs_5_0 ps_5_0)',
      canvasNoise: DEFAULT_CANVAS_NOISE,
      audioNoise: DEFAULT_AUDIO_NOISE,
    }),
  });

  function cloneValue(value) {
    if (!value || typeof value !== 'object') {
      return value;
    }
    return JSON.parse(JSON.stringify(value));
  }

  function normalizeCountryCode(value = '') {
    const normalized = String(value || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z]/g, '');
    return normalized.length === 2 ? normalized : '';
  }

  function pickProxyRegionFromState(state = {}) {
    return normalizeCountryCode(
      state?.ipProxyAppliedExitRegion
      || state?.ipProxyExitRegion
      || state?.ipProxyAppliedRegion
      || state?.ipProxyRegion
      || state?.proxyRegion
      || state?.exitRegion
      || ''
    );
  }

  function normalizeMode(value = '') {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'preset') {
      return 'preset';
    }
    if (normalized === 'proxy_region' || normalized === 'proxy-region' || normalized === 'proxy') {
      return 'proxy_region';
    }
    if (normalized === 'custom') {
      return 'custom';
    }
    if (normalized === 'off' || normalized === 'disabled' || normalized === 'disable') {
      return 'off';
    }
    return '';
  }

  function normalizeFiniteNumber(value, fallback = null) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
  }

  function normalizeClampedNumber(value, fallback, min, max) {
    const numeric = normalizeFiniteNumber(value, fallback);
    if (!Number.isFinite(numeric)) {
      return fallback;
    }
    return Math.min(max, Math.max(min, numeric));
  }

  function normalizePositiveInteger(value, fallback = 0) {
    const numeric = Math.floor(Number(value) || 0);
    if (numeric > 0) {
      return numeric;
    }
    return fallback;
  }

  function normalizeStringArray(value) {
    const source = Array.isArray(value)
      ? value
      : String(value || '')
        .split(/[\r\n,;|]+/);
    const seen = new Set();
    const normalized = [];
    for (const item of source) {
      const text = String(item || '').trim();
      if (!text) {
        continue;
      }
      const key = text.toLowerCase();
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      normalized.push(text);
    }
    return normalized;
  }

  function buildAcceptLanguage(languages = [], explicitValue = '') {
    const explicit = String(explicitValue || '').trim();
    if (explicit) {
      return explicit;
    }
    const normalized = normalizeStringArray(languages);
    if (!normalized.length) {
      return '';
    }
    return normalized.map((language, index) => {
      if (index === 0) {
        return language;
      }
      const quality = Math.max(0.1, 0.9 - ((index - 1) * 0.1));
      return `${language};q=${quality.toFixed(1)}`;
    }).join(',');
  }

  function normalizeScreen(value, fallback = DEFAULT_SCREEN) {
    const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const base = fallback && typeof fallback === 'object' ? fallback : DEFAULT_SCREEN;
    const width = normalizePositiveInteger(source.width, base.width);
    const height = normalizePositiveInteger(source.height, base.height);
    const availWidth = normalizePositiveInteger(source.availWidth, width);
    const availHeight = normalizePositiveInteger(source.availHeight, Math.max(0, height - 40));
    return {
      width,
      height,
      availWidth,
      availHeight,
      colorDepth: normalizePositiveInteger(source.colorDepth, base.colorDepth),
      pixelDepth: normalizePositiveInteger(source.pixelDepth, base.pixelDepth),
      devicePixelRatio: normalizeClampedNumber(source.devicePixelRatio, base.devicePixelRatio, 1, 4),
    };
  }

  function normalizeUserAgentMetadata(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }
    const brands = Array.isArray(value.brands)
      ? value.brands
        .map((entry) => {
          if (!entry || typeof entry !== 'object') {
            return null;
          }
          const brand = String(entry.brand || '').trim();
          const version = String(entry.version || '').trim();
          if (!brand || !version) {
            return null;
          }
          return { brand, version };
        })
        .filter(Boolean)
      : [];
    const fullVersionList = Array.isArray(value.fullVersionList)
      ? value.fullVersionList
        .map((entry) => {
          if (!entry || typeof entry !== 'object') {
            return null;
          }
          const brand = String(entry.brand || '').trim();
          const version = String(entry.version || '').trim();
          if (!brand || !version) {
            return null;
          }
          return { brand, version };
        })
        .filter(Boolean)
      : [];
    return {
      brands,
      fullVersionList,
      platform: String(value.platform || '').trim(),
      platformVersion: String(value.platformVersion || '').trim(),
      architecture: String(value.architecture || '').trim(),
      model: String(value.model || '').trim(),
      mobile: Boolean(value.mobile),
      bitness: String(value.bitness || '').trim(),
      wow64: Boolean(value.wow64),
      fullVersion: String(value.fullVersion || '').trim(),
    };
  }

  function normalizeFingerprintProfile(input = null) {
    if (input === null || input === undefined || input === false) {
      return null;
    }

    if (input === true) {
      input = {
        enabled: true,
        mode: 'proxy_region',
      };
    }

    const source = typeof input === 'string'
      ? { enabled: true, mode: 'preset', countryCode: input }
      : (input && typeof input === 'object' && !Array.isArray(input) ? input : null);
    if (!source) {
      return null;
    }

    const enabled = source.enabled !== undefined ? Boolean(source.enabled) : true;
    const mode = normalizeMode(
      source.mode
      || (source.proxyRegion || source.ipProxyRegion || source.exitRegion ? 'proxy_region' : '')
      || (source.countryCode || source.country ? 'preset' : 'custom')
    );

    if (!enabled || mode === 'off') {
      return null;
    }

    const normalized = {
      enabled: true,
      mode: mode || 'custom',
      countryCode: normalizeCountryCode(
        source.countryCode
        || source.country
        || source.region
        || source.proxyRegion
        || source.ipProxyRegion
        || source.exitRegion
      ),
      locale: String(source.locale || '').trim(),
      languages: normalizeStringArray(source.languages || source.languageList || []),
      acceptLanguage: String(source.acceptLanguage || '').trim(),
      timezone: String(source.timezone || '').trim(),
      latitude: normalizeFiniteNumber(source.latitude, null),
      longitude: normalizeFiniteNumber(source.longitude, null),
      accuracy: normalizeClampedNumber(source.accuracy, DEFAULT_GEO_ACCURACY, 1, 5000),
      platform: String(source.platform || '').trim(),
      vendor: String(source.vendor || '').trim(),
      userAgent: String(source.userAgent || '').trim(),
      userAgentMetadata: normalizeUserAgentMetadata(source.userAgentMetadata),
      hardwareConcurrency: normalizePositiveInteger(source.hardwareConcurrency, 0),
      deviceMemory: normalizePositiveInteger(source.deviceMemory, 0),
      maxTouchPoints: Math.max(0, Math.floor(Number(source.maxTouchPoints) || 0)),
      screen: normalizeScreen(
        source.screen || {
          width: source.width,
          height: source.height,
          availWidth: source.availWidth,
          availHeight: source.availHeight,
          colorDepth: source.colorDepth,
          pixelDepth: source.pixelDepth,
          devicePixelRatio: source.devicePixelRatio,
        },
        DEFAULT_SCREEN
      ),
      webglVendor: String(source.webglVendor || '').trim(),
      webglRenderer: String(source.webglRenderer || '').trim(),
      canvasNoise: normalizeClampedNumber(source.canvasNoise, DEFAULT_CANVAS_NOISE, 0, 5),
      audioNoise: normalizeClampedNumber(source.audioNoise, DEFAULT_AUDIO_NOISE, 0, 1),
      seed: String(source.seed || '').trim(),
      applyToExistingPages: source.applyToExistingPages !== false,
      grantGeolocation: source.grantGeolocation !== false,
      reportToAgentControl: source.reportToAgentControl !== false,
    };

    if (
      !normalized.countryCode
      && normalized.mode === 'preset'
      && !normalized.locale
      && !normalized.timezone
      && !Number.isFinite(normalized.latitude)
      && !Number.isFinite(normalized.longitude)
    ) {
      return null;
    }

    return normalized;
  }

  function resolveFingerprintProfile(input = null, options = {}) {
    const normalized = normalizeFingerprintProfile(input);
    if (!normalized) {
      return null;
    }

    const proxyRegion = pickProxyRegionFromState({
      ...options,
      ...(options?.state && typeof options.state === 'object' ? options.state : {}),
    });
    const resolvedCountryCode = normalized.mode === 'proxy_region'
      ? (proxyRegion || normalized.countryCode)
      : normalized.countryCode;
    const preset = resolvedCountryCode ? cloneValue(COUNTRY_PRESETS[resolvedCountryCode] || null) : null;
    const languages = normalized.languages.length
      ? normalized.languages
      : normalizeStringArray(preset?.languages || []);
    const locale = String(normalized.locale || preset?.locale || '').trim()
      || (languages[0] || '');

    const resolved = {
      enabled: true,
      mode: normalized.mode,
      countryCode: resolvedCountryCode || '',
      locale,
      languages,
      acceptLanguage: buildAcceptLanguage(languages, normalized.acceptLanguage || preset?.acceptLanguage || ''),
      timezone: String(normalized.timezone || preset?.timezone || '').trim(),
      latitude: Number.isFinite(normalized.latitude) ? normalized.latitude : normalizeFiniteNumber(preset?.latitude, null),
      longitude: Number.isFinite(normalized.longitude) ? normalized.longitude : normalizeFiniteNumber(preset?.longitude, null),
      accuracy: normalizeClampedNumber(
        normalized.accuracy,
        normalizeFiniteNumber(preset?.accuracy, DEFAULT_GEO_ACCURACY),
        1,
        5000
      ),
      platform: String(normalized.platform || preset?.platform || '').trim() || 'Win32',
      vendor: String(normalized.vendor || preset?.vendor || '').trim() || 'Google Inc.',
      userAgent: String(normalized.userAgent || '').trim(),
      userAgentMetadata: normalized.userAgentMetadata || normalizeUserAgentMetadata(preset?.userAgentMetadata),
      hardwareConcurrency: normalizePositiveInteger(
        normalized.hardwareConcurrency,
        normalizePositiveInteger(preset?.hardwareConcurrency, 8)
      ),
      deviceMemory: normalizePositiveInteger(
        normalized.deviceMemory,
        normalizePositiveInteger(preset?.deviceMemory, 8)
      ),
      maxTouchPoints: Math.max(
        0,
        normalized.maxTouchPoints || Math.floor(Number(preset?.maxTouchPoints) || 0)
      ),
      screen: normalizeScreen(normalized.screen, preset?.screen || DEFAULT_SCREEN),
      webglVendor: String(normalized.webglVendor || preset?.webglVendor || '').trim(),
      webglRenderer: String(normalized.webglRenderer || preset?.webglRenderer || '').trim(),
      canvasNoise: normalizeClampedNumber(
        normalized.canvasNoise,
        normalizeFiniteNumber(preset?.canvasNoise, DEFAULT_CANVAS_NOISE),
        0,
        5
      ),
      audioNoise: normalizeClampedNumber(
        normalized.audioNoise,
        normalizeFiniteNumber(preset?.audioNoise, DEFAULT_AUDIO_NOISE),
        0,
        1
      ),
      seed: String(normalized.seed || '').trim()
        || [resolvedCountryCode || 'xx', locale || 'default', normalized.mode].filter(Boolean).join(':'),
      applyToExistingPages: normalized.applyToExistingPages !== false,
      grantGeolocation: normalized.grantGeolocation !== false,
      reportToAgentControl: normalized.reportToAgentControl !== false,
      proxyRegion,
      resolutionSource: normalized.mode === 'proxy_region'
        ? (proxyRegion ? 'proxy_region' : (resolvedCountryCode ? 'fallback_country' : 'unresolved_proxy_region'))
        : (resolvedCountryCode ? 'country_preset' : 'custom'),
    };

    if (!resolved.acceptLanguage) {
      resolved.acceptLanguage = buildAcceptLanguage(resolved.languages, resolved.locale);
    }

    return resolved;
  }

  return {
    COUNTRY_PRESETS,
    DEFAULT_SCREEN,
    buildAcceptLanguage,
    normalizeCountryCode,
    normalizeFingerprintProfile,
    normalizeScreen,
    normalizeUserAgentMetadata,
    pickProxyRegionFromState,
    resolveFingerprintProfile,
  };
});
