const CDP = require('chrome-remote-interface');
const http = require('http');
const {
  normalizeFingerprintProfile,
  pickProxyRegionFromState,
  resolveFingerprintProfile,
} = require('./shared/fingerprint-profile.js');

const DEFAULT_DEBUG_PORT = 9222;
const DEFAULT_FALLBACK_CHROME_VERSION = '136.0.7103.93';
const EXTENSION_URL_PREFIX = 'chrome-extension://';

function buildLogger(logger = console) {
  return {
    debug(message, payload) {
      if (typeof logger?.debug === 'function') {
        logger.debug(message, payload || '');
      }
    },
    info(message, payload) {
      if (typeof logger?.info === 'function') {
        logger.info(message, payload || '');
        return;
      }
      if (typeof logger?.log === 'function') {
        logger.log(message, payload || '');
      }
    },
    warn(message, payload) {
      if (typeof logger?.warn === 'function') {
        logger.warn(message, payload || '');
        return;
      }
      if (typeof logger?.log === 'function') {
        logger.log(message, payload || '');
      }
    },
    error(message, payload) {
      if (typeof logger?.error === 'function') {
        logger.error(message, payload || '');
        return;
      }
      if (typeof logger?.log === 'function') {
        logger.log(message, payload || '');
      }
    },
  };
}

function createStatusReportSkeleton(profile = null) {
  return {
    enabled: Boolean(profile),
    status: profile ? 'initializing' : 'disabled',
    mode: profile?.mode || '',
    startedAt: Date.now(),
    lastAppliedAt: 0,
    appliedTargetCount: 0,
    skippedTargetCount: 0,
    errorCount: 0,
    lastTargetUrl: '',
    lastError: '',
    resolvedProfile: profile ? summarizeResolvedProfile(profile) : null,
  };
}

function summarizeResolvedProfile(profile = null) {
  if (!profile || typeof profile !== 'object') {
    return null;
  }
  return {
    mode: String(profile.mode || ''),
    countryCode: String(profile.countryCode || ''),
    locale: String(profile.locale || ''),
    languages: Array.isArray(profile.languages) ? [...profile.languages] : [],
    acceptLanguage: String(profile.acceptLanguage || ''),
    timezone: String(profile.timezone || ''),
    latitude: Number.isFinite(Number(profile.latitude)) ? Number(profile.latitude) : null,
    longitude: Number.isFinite(Number(profile.longitude)) ? Number(profile.longitude) : null,
    accuracy: Number.isFinite(Number(profile.accuracy)) ? Number(profile.accuracy) : null,
    platform: String(profile.platform || ''),
    vendor: String(profile.vendor || ''),
    hardwareConcurrency: Number(profile.hardwareConcurrency) || 0,
    deviceMemory: Number(profile.deviceMemory) || 0,
    maxTouchPoints: Number(profile.maxTouchPoints) || 0,
    screen: profile.screen && typeof profile.screen === 'object'
      ? { ...profile.screen }
      : null,
    webglVendor: String(profile.webglVendor || ''),
    webglRenderer: String(profile.webglRenderer || ''),
    canvasNoise: Number(profile.canvasNoise) || 0,
    audioNoise: Number(profile.audioNoise) || 0,
    seed: String(profile.seed || ''),
    resolutionSource: String(profile.resolutionSource || ''),
    proxyRegion: String(profile.proxyRegion || ''),
  };
}

function extractChromeVersion(browserVersion = '') {
  const text = String(browserVersion || '').trim();
  const match = text.match(/(?:Chrome|Chromium|HeadlessChrome)\/(\d+(?:\.\d+){1,3})/i);
  if (match?.[1]) {
    return match[1];
  }
  return DEFAULT_FALLBACK_CHROME_VERSION;
}

function extractChromeMajorVersion(browserVersion = '') {
  return String(extractChromeVersion(browserVersion).split('.')[0] || '136');
}

function resolvePlatformMeta(platform = 'Win32') {
  const normalized = String(platform || '').trim() || 'Win32';
  const lowered = normalized.toLowerCase();
  if (lowered.includes('mac')) {
    return {
      navigatorPlatform: normalized,
      userAgentPlatform: 'Macintosh; Intel Mac OS X 10_15_7',
      metadataPlatform: 'macOS',
      metadataPlatformVersion: '10.15.7',
      architecture: 'x86',
      bitness: '64',
      wow64: false,
    };
  }
  if (lowered.includes('linux')) {
    return {
      navigatorPlatform: normalized,
      userAgentPlatform: 'X11; Linux x86_64',
      metadataPlatform: 'Linux',
      metadataPlatformVersion: '6.1.0',
      architecture: 'x86',
      bitness: '64',
      wow64: false,
    };
  }
  return {
    navigatorPlatform: normalized || 'Win32',
    userAgentPlatform: 'Windows NT 10.0; Win64; x64',
    metadataPlatform: 'Windows',
    metadataPlatformVersion: '10.0.0',
    architecture: 'x86',
    bitness: '64',
    wow64: false,
  };
}

function buildDefaultUserAgent(profile = {}, browserVersion = '') {
  const platformMeta = resolvePlatformMeta(profile.platform);
  const chromeVersion = extractChromeVersion(browserVersion);
  return `Mozilla/5.0 (${platformMeta.userAgentPlatform}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`;
}

function buildDefaultUserAgentMetadata(profile = {}, browserVersion = '') {
  const majorVersion = extractChromeMajorVersion(browserVersion);
  const chromeVersion = extractChromeVersion(browserVersion);
  const platformMeta = resolvePlatformMeta(profile.platform);
  return {
    brands: [
      { brand: 'Chromium', version: majorVersion },
      { brand: 'Google Chrome', version: majorVersion },
      { brand: 'Not=A?Brand', version: '24' },
    ],
    fullVersionList: [
      { brand: 'Chromium', version: chromeVersion },
      { brand: 'Google Chrome', version: chromeVersion },
      { brand: 'Not=A?Brand', version: '24.0.0.0' },
    ],
    platform: platformMeta.metadataPlatform,
    platformVersion: platformMeta.metadataPlatformVersion,
    architecture: platformMeta.architecture,
    model: '',
    mobile: false,
    bitness: platformMeta.bitness,
    wow64: platformMeta.wow64,
    fullVersion: chromeVersion,
  };
}

function mergeUserAgentMetadata(base = {}, override = null) {
  if (!override || typeof override !== 'object' || Array.isArray(override)) {
    return base;
  }
  return {
    ...base,
    ...override,
    brands: Array.isArray(override.brands) && override.brands.length
      ? override.brands
      : base.brands,
    fullVersionList: Array.isArray(override.fullVersionList) && override.fullVersionList.length
      ? override.fullVersionList
      : base.fullVersionList,
  };
}

function buildRuntimePayload(profile = {}, options = {}) {
  const browserVersion = String(options.browserVersion || '').trim();
  const platformMeta = resolvePlatformMeta(profile.platform);
  const userAgent = String(profile.userAgent || '').trim()
    || buildDefaultUserAgent(profile, browserVersion);
  const userAgentMetadata = mergeUserAgentMetadata(
    buildDefaultUserAgentMetadata(profile, browserVersion),
    profile.userAgentMetadata
  );
  return {
    countryCode: String(profile.countryCode || '').trim(),
    locale: String(profile.locale || '').trim(),
    languages: Array.isArray(profile.languages) ? [...profile.languages] : [],
    acceptLanguage: String(profile.acceptLanguage || '').trim(),
    timezone: String(profile.timezone || '').trim(),
    geolocation: Number.isFinite(Number(profile.latitude)) && Number.isFinite(Number(profile.longitude))
      ? {
          latitude: Number(profile.latitude),
          longitude: Number(profile.longitude),
          accuracy: Math.max(1, Number(profile.accuracy) || 100),
        }
      : null,
    platform: platformMeta.navigatorPlatform,
    vendor: String(profile.vendor || '').trim() || 'Google Inc.',
    userAgent,
    userAgentMetadata,
    hardwareConcurrency: Math.max(1, Number(profile.hardwareConcurrency) || 8),
    deviceMemory: Math.max(1, Number(profile.deviceMemory) || 8),
    maxTouchPoints: Math.max(0, Math.floor(Number(profile.maxTouchPoints) || 0)),
    screen: profile.screen && typeof profile.screen === 'object'
      ? {
          width: Math.max(320, Math.floor(Number(profile.screen.width) || 1920)),
          height: Math.max(240, Math.floor(Number(profile.screen.height) || 1080)),
          availWidth: Math.max(320, Math.floor(Number(profile.screen.availWidth) || Number(profile.screen.width) || 1920)),
          availHeight: Math.max(200, Math.floor(Number(profile.screen.availHeight) || Number(profile.screen.height) - 40 || 1040)),
          colorDepth: Math.max(8, Math.floor(Number(profile.screen.colorDepth) || 24)),
          pixelDepth: Math.max(8, Math.floor(Number(profile.screen.pixelDepth) || 24)),
          devicePixelRatio: Math.min(4, Math.max(1, Number(profile.screen.devicePixelRatio) || 1)),
        }
      : {
          width: 1920,
          height: 1080,
          availWidth: 1920,
          availHeight: 1040,
          colorDepth: 24,
          pixelDepth: 24,
          devicePixelRatio: 1,
        },
    webglVendor: String(profile.webglVendor || '').trim() || 'Google Inc. (Intel)',
    webglRenderer: String(profile.webglRenderer || '').trim()
      || 'ANGLE (Intel, Intel(R) UHD Graphics Direct3D11 vs_5_0 ps_5_0)',
    canvasNoise: Math.max(0, Number(profile.canvasNoise) || 0),
    audioNoise: Math.max(0, Number(profile.audioNoise) || 0),
    seed: String(profile.seed || '').trim() || 'gujumpgate-fingerprint',
    permissions: {
      geolocation: profile.grantGeolocation === false ? 'prompt' : 'granted',
      notifications: 'default',
    },
  };
}

function buildInjectedFingerprintSource(payload = {}) {
  return `
(() => {
  const cfg = ${JSON.stringify(payload)};
  const globalKey = '__GUJUMPGATE_PROXY_FINGERPRINT__';
  const existing = globalThis[globalKey];
  if (existing && existing.seed === cfg.seed && existing.userAgent === cfg.userAgent) {
    return;
  }
  globalThis[globalKey] = {
    seed: cfg.seed,
    userAgent: cfg.userAgent,
    countryCode: cfg.countryCode,
    appliedAt: Date.now(),
  };

  const defineGetter = (target, key, getter) => {
    if (!target) {
      return;
    }
    try {
      Object.defineProperty(target, key, {
        get: getter,
        configurable: true,
      });
    } catch (_) {}
  };

  const defineValue = (target, key, value) => {
    defineGetter(target, key, () => value);
  };

  const seedHash = (value) => {
    const text = String(value || '');
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    return Math.abs(hash >>> 0);
  };

  const makeNoise = (salt, magnitude) => {
    if (!magnitude) {
      return 0;
    }
    const hash = seedHash(\`\${cfg.seed}:\${salt}\`);
    const normalized = (hash % 1000) / 1000;
    return (normalized - 0.5) * magnitude;
  };

  const navigatorProto = Object.getPrototypeOf(navigator);
  const screenProto = globalThis.screen ? Object.getPrototypeOf(globalThis.screen) || globalThis.screen : null;

  defineValue(navigatorProto, 'webdriver', undefined);
  defineValue(navigatorProto, 'language', cfg.locale);
  defineValue(navigatorProto, 'languages', [...cfg.languages]);
  defineValue(navigatorProto, 'platform', cfg.platform);
  defineValue(navigatorProto, 'vendor', cfg.vendor);
  defineValue(navigatorProto, 'hardwareConcurrency', cfg.hardwareConcurrency);
  defineValue(navigatorProto, 'deviceMemory', cfg.deviceMemory);
  defineValue(navigatorProto, 'maxTouchPoints', cfg.maxTouchPoints);
  defineValue(navigatorProto, 'userAgent', cfg.userAgent);
  defineValue(navigatorProto, 'appVersion', cfg.userAgent.replace(/^Mozilla\\//, ''));
  defineValue(navigatorProto, 'pdfViewerEnabled', true);

  const uaData = {
    brands: Array.isArray(cfg.userAgentMetadata?.brands) ? [...cfg.userAgentMetadata.brands] : [],
    mobile: Boolean(cfg.userAgentMetadata?.mobile),
    platform: String(cfg.userAgentMetadata?.platform || ''),
    getHighEntropyValues: async (hints = []) => {
      const response = {};
      const mapping = {
        architecture: cfg.userAgentMetadata?.architecture || '',
        bitness: cfg.userAgentMetadata?.bitness || '',
        formFactor: 'Desktop',
        fullVersionList: Array.isArray(cfg.userAgentMetadata?.fullVersionList) ? [...cfg.userAgentMetadata.fullVersionList] : [],
        mobile: Boolean(cfg.userAgentMetadata?.mobile),
        model: cfg.userAgentMetadata?.model || '',
        platform: cfg.userAgentMetadata?.platform || '',
        platformVersion: cfg.userAgentMetadata?.platformVersion || '',
        uaFullVersion: cfg.userAgentMetadata?.fullVersion || '',
        wow64: Boolean(cfg.userAgentMetadata?.wow64),
      };
      for (const hint of hints) {
        if (Object.prototype.hasOwnProperty.call(mapping, hint)) {
          response[hint] = mapping[hint];
        }
      }
      return response;
    },
    toJSON() {
      return {
        brands: this.brands,
        mobile: this.mobile,
        platform: this.platform,
      };
    },
  };
  defineValue(navigatorProto, 'userAgentData', uaData);

  const pluginEntries = [
    {
      name: 'Chrome PDF Viewer',
      filename: 'internal-pdf-viewer',
      description: 'Portable Document Format',
    },
  ];
  const mimeTypeEntries = [
    {
      type: 'application/pdf',
      suffixes: 'pdf',
      description: 'Portable Document Format',
    },
  ];
  const buildReadonlyArray = (entries, nameKey) => {
    const items = entries.map((entry) => Object.freeze({ ...entry }));
    items.item = (index) => items[index] || null;
    items.namedItem = (name) => items.find((entry) => String(entry[nameKey] || '') === String(name || '')) || null;
    return Object.freeze(items);
  };
  defineValue(navigatorProto, 'plugins', buildReadonlyArray(pluginEntries, 'name'));
  defineValue(navigatorProto, 'mimeTypes', buildReadonlyArray(mimeTypeEntries, 'type'));

  if (screenProto) {
    defineValue(screenProto, 'width', cfg.screen.width);
    defineValue(screenProto, 'height', cfg.screen.height);
    defineValue(screenProto, 'availWidth', cfg.screen.availWidth);
    defineValue(screenProto, 'availHeight', cfg.screen.availHeight);
    defineValue(screenProto, 'colorDepth', cfg.screen.colorDepth);
    defineValue(screenProto, 'pixelDepth', cfg.screen.pixelDepth);
  }
  defineValue(globalThis, 'devicePixelRatio', cfg.screen.devicePixelRatio);
  defineValue(globalThis, 'outerWidth', cfg.screen.width);
  defineValue(globalThis, 'outerHeight', cfg.screen.height);

  const originalDateTimeFormat = Intl.DateTimeFormat;
  Intl.DateTimeFormat = function DateTimeFormatProxy(...args) {
    const finalArgs = [...args];
    if (!finalArgs[0]) {
      finalArgs[0] = cfg.locale;
    }
    if (!finalArgs[1] || typeof finalArgs[1] !== 'object') {
      finalArgs[1] = {};
    }
    if (!finalArgs[1].timeZone && cfg.timezone) {
      finalArgs[1].timeZone = cfg.timezone;
    }
    return new originalDateTimeFormat(...finalArgs);
  };
  Intl.DateTimeFormat.prototype = originalDateTimeFormat.prototype;
  Intl.DateTimeFormat.supportedLocalesOf = originalDateTimeFormat.supportedLocalesOf.bind(originalDateTimeFormat);

  const originalResolvedOptions = originalDateTimeFormat.prototype.resolvedOptions;
  if (typeof originalResolvedOptions === 'function') {
    originalDateTimeFormat.prototype.resolvedOptions = function resolvedOptionsProxy(...args) {
      const result = originalResolvedOptions.apply(this, args);
      if (cfg.timezone) {
        result.timeZone = cfg.timezone;
      }
      if (cfg.locale && !result.locale) {
        result.locale = cfg.locale;
      }
      return result;
    };
  }

  if (navigator.permissions && typeof navigator.permissions.query === 'function') {
    const originalPermissionsQuery = navigator.permissions.query.bind(navigator.permissions);
    navigator.permissions.query = async (parameters = {}) => {
      const permissionName = String(parameters?.name || '');
      if (permissionName === 'geolocation') {
        return {
          name: permissionName,
          state: cfg.permissions.geolocation,
          onchange: null,
        };
      }
      return originalPermissionsQuery(parameters);
    };
  }

  if (navigator.geolocation) {
    const positionPayload = () => ({
      coords: {
        latitude: Number(cfg.geolocation?.latitude || 0),
        longitude: Number(cfg.geolocation?.longitude || 0),
        accuracy: Math.max(1, Number(cfg.geolocation?.accuracy || 100)),
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
      },
      timestamp: Date.now(),
    });
    navigator.geolocation.getCurrentPosition = function getCurrentPosition(success, error) {
      if (typeof success === 'function' && cfg.geolocation) {
        success(positionPayload());
        return;
      }
      if (typeof error === 'function') {
        error(new Error('geolocation_unavailable'));
      }
    };
    navigator.geolocation.watchPosition = function watchPosition(success) {
      if (typeof success === 'function' && cfg.geolocation) {
        success(positionPayload());
      }
      return 1;
    };
    navigator.geolocation.clearWatch = function clearWatch() {};
  }

  const patchWebGlPrototype = (prototype) => {
    if (!prototype || typeof prototype.getParameter !== 'function') {
      return;
    }
    const originalGetParameter = prototype.getParameter;
    const originalGetExtension = typeof prototype.getExtension === 'function'
      ? prototype.getExtension
      : null;
    prototype.getParameter = function getParameterProxy(parameter) {
      if (parameter === 37445) {
        return cfg.webglVendor;
      }
      if (parameter === 37446) {
        return cfg.webglRenderer;
      }
      return originalGetParameter.apply(this, arguments);
    };
    if (originalGetExtension) {
      prototype.getExtension = function getExtensionProxy(name) {
        if (String(name || '') === 'WEBGL_debug_renderer_info') {
          return {
            UNMASKED_VENDOR_WEBGL: 37445,
            UNMASKED_RENDERER_WEBGL: 37446,
          };
        }
        return originalGetExtension.apply(this, arguments);
      };
    }
  };

  patchWebGlPrototype(globalThis.WebGLRenderingContext?.prototype);
  patchWebGlPrototype(globalThis.WebGL2RenderingContext?.prototype);

  const mutateImageData = (imageData, salt) => {
    if (!imageData || !imageData.data || !cfg.canvasNoise) {
      return imageData;
    }
    const delta = Math.max(1, Math.round(cfg.canvasNoise * 10));
    const step = Math.max(4, Math.floor(imageData.data.length / 48));
    const start = seedHash(\`canvas:\${salt}\`) % step;
    for (let index = start; index < imageData.data.length; index += step) {
      imageData.data[index] = (imageData.data[index] + delta) % 255;
    }
    return imageData;
  };

  if (globalThis.CanvasRenderingContext2D?.prototype?.getImageData) {
    const originalGetImageData = CanvasRenderingContext2D.prototype.getImageData;
    CanvasRenderingContext2D.prototype.getImageData = function getImageDataProxy(...args) {
      const imageData = originalGetImageData.apply(this, args);
      try {
        const cloned = new ImageData(new Uint8ClampedArray(imageData.data), imageData.width, imageData.height);
        return mutateImageData(cloned, \`\${imageData.width}x\${imageData.height}\`);
      } catch (_) {
        return imageData;
      }
    };
  }

  if (globalThis.HTMLCanvasElement?.prototype?.toDataURL) {
    const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function toDataURLProxy(...args) {
      if (!cfg.canvasNoise || !this.width || !this.height) {
        return originalToDataURL.apply(this, args);
      }
      try {
        const clonedCanvas = document.createElement('canvas');
        clonedCanvas.width = this.width;
        clonedCanvas.height = this.height;
        const context = clonedCanvas.getContext('2d');
        context.drawImage(this, 0, 0);
        const clonedContext = clonedCanvas.getContext('2d');
        const imageData = clonedContext.getImageData(0, 0, clonedCanvas.width, clonedCanvas.height);
        clonedContext.putImageData(
          mutateImageData(imageData, \`\${clonedCanvas.width}x\${clonedCanvas.height}:url\`),
          0,
          0
        );
        return originalToDataURL.apply(clonedCanvas, args);
      } catch (_) {
        return originalToDataURL.apply(this, args);
      }
    };
  }

  if (globalThis.AudioBuffer?.prototype?.getChannelData) {
    const originalGetChannelData = AudioBuffer.prototype.getChannelData;
    AudioBuffer.prototype.getChannelData = function getChannelDataProxy(...args) {
      const channelData = originalGetChannelData.apply(this, args);
      if (!channelData || !cfg.audioNoise || this.__gujumpgateAudioFingerprintPatched) {
        return channelData;
      }
      this.__gujumpgateAudioFingerprintPatched = true;
      const step = Math.max(1, Math.floor(channelData.length / 32));
      const delta = makeNoise('audio-buffer', cfg.audioNoise * 2);
      const start = seedHash('audio-buffer') % step;
      for (let index = start; index < channelData.length; index += step) {
        channelData[index] += delta;
      }
      return channelData;
    };
  }

  if (globalThis.AnalyserNode?.prototype?.getFloatFrequencyData) {
    const originalGetFloatFrequencyData = AnalyserNode.prototype.getFloatFrequencyData;
    AnalyserNode.prototype.getFloatFrequencyData = function getFloatFrequencyDataProxy(array) {
      originalGetFloatFrequencyData.apply(this, arguments);
      if (!array || !cfg.audioNoise) {
        return;
      }
      const delta = makeNoise('analyser', cfg.audioNoise * 10);
      const step = Math.max(1, Math.floor(array.length / 24));
      const start = seedHash('analyser') % step;
      for (let index = start; index < array.length; index += step) {
        array[index] += delta;
      }
    };
  }
})();
  `.trim();
}

async function safeSendCommand(client, method, params = {}) {
  try {
    return await client.send(method, params);
  } catch (error) {
    return {
      __gujumpgateCommandError: error?.message || String(error || method),
    };
  }
}

async function applyFingerprintToSession(client, resolvedProfile, options = {}) {
  const payload = buildRuntimePayload(resolvedProfile, options);
  const source = buildInjectedFingerprintSource(payload);

  await safeSendCommand(client, 'Network.enable');
  await safeSendCommand(client, 'Page.enable');

  if (payload.timezone) {
    await safeSendCommand(client, 'Emulation.setTimezoneOverride', {
      timezoneId: payload.timezone,
    });
  }

  if (payload.locale) {
    await safeSendCommand(client, 'Emulation.setLocaleOverride', {
      locale: payload.locale,
    });
  }

  if (payload.geolocation) {
    await safeSendCommand(client, 'Emulation.setGeolocationOverride', {
      latitude: payload.geolocation.latitude,
      longitude: payload.geolocation.longitude,
      accuracy: payload.geolocation.accuracy,
    });
  }

  await safeSendCommand(client, 'Emulation.setUserAgentOverride', {
    userAgent: payload.userAgent,
    acceptLanguage: payload.acceptLanguage,
    platform: payload.platform,
    userAgentMetadata: payload.userAgentMetadata,
  });

  await safeSendCommand(client, 'Emulation.setDeviceMetricsOverride', {
    width: payload.screen.width,
    height: payload.screen.height,
    deviceScaleFactor: payload.screen.devicePixelRatio,
    mobile: false,
    screenWidth: payload.screen.width,
    screenHeight: payload.screen.height,
    positionX: 0,
    positionY: 0,
    scale: 1,
  });

  await safeSendCommand(client, 'Network.setExtraHTTPHeaders', {
    headers: {
      'Accept-Language': payload.acceptLanguage,
    },
  });

  await safeSendCommand(client, 'Page.addScriptToEvaluateOnNewDocument', {
    source,
  });

  await safeSendCommand(client, 'Runtime.evaluate', {
    expression: source,
    awaitPromise: false,
    returnByValue: true,
  });

  return payload;
}

function isInjectableUrl(url = '') {
  const text = String(url || '').trim();
  if (!text) {
    return true;
  }
  if (text.startsWith(EXTENSION_URL_PREFIX)) {
    return false;
  }
  return !/^(?:chrome|devtools|edge|view-source):/i.test(text);
}

function isInjectablePuppeteerTarget(target) {
  if (!target || typeof target.type !== 'function') {
    return false;
  }
  if (target.type() !== 'page') {
    return false;
  }
  return isInjectableUrl(typeof target.url === 'function' ? target.url() : '');
}

async function createPuppeteerFingerprintSupervisor(options = {}) {
  const browser = options.browser;
  if (!browser) {
    throw new Error('createPuppeteerFingerprintSupervisor requires browser.');
  }

  const normalizedProfile = normalizeFingerprintProfile(options.profile);
  const resolvedProfile = resolveFingerprintProfile(normalizedProfile, {
    proxyRegion: options.proxyRegion || pickProxyRegionFromState(options.state || {}),
    state: options.state || {},
  });
  const logger = buildLogger(options.logger);
  const report = createStatusReportSkeleton(resolvedProfile);
  const statusCallback = typeof options.onStatus === 'function' ? options.onStatus : null;
  const browserVersion = typeof browser.version === 'function'
    ? await browser.version().catch(() => '')
    : '';
  const targetSessions = new Set();
  const appliedTargets = new Set();

  const emitStatus = () => {
    if (statusCallback) {
      statusCallback({ ...report, resolvedProfile: summarizeResolvedProfile(resolvedProfile) });
    }
  };

  if (!resolvedProfile) {
    emitStatus();
    return {
      report,
      resolvedProfile: null,
      async stop() {},
    };
  }

  report.status = 'running';
  emitStatus();

  async function applyToTarget(target) {
    if (!isInjectablePuppeteerTarget(target)) {
      report.skippedTargetCount += 1;
      emitStatus();
      return;
    }

    const targetId = typeof target._targetId === 'string'
      ? target._targetId
      : String(target.url() || '');
    if (appliedTargets.has(targetId)) {
      return;
    }

    let session = null;
    try {
      session = await target.createCDPSession();
      targetSessions.add(session);
      await applyFingerprintToSession(session, resolvedProfile, {
        browserVersion,
      });
      appliedTargets.add(targetId);
      report.appliedTargetCount += 1;
      report.lastAppliedAt = Date.now();
      report.lastTargetUrl = String(target.url() || '');
      report.lastError = '';
      emitStatus();
    } catch (error) {
      report.errorCount += 1;
      report.lastError = error?.message || String(error || 'fingerprint_apply_failed');
      emitStatus();
      logger.warn('[Fingerprint] Failed to apply profile to Puppeteer target', {
        url: String(target?.url?.() || ''),
        error: report.lastError,
      });
    } finally {
      if (session) {
        targetSessions.delete(session);
        await session.detach().catch(() => {});
      }
    }
  }

  const onTargetCreated = (target) => {
    applyToTarget(target).catch((error) => {
      report.errorCount += 1;
      report.lastError = error?.message || String(error || 'fingerprint_target_created_failed');
      emitStatus();
    });
  };

  browser.on('targetcreated', onTargetCreated);
  await Promise.all(browser.targets().map((target) => applyToTarget(target)));

  return {
    report,
    resolvedProfile,
    async stop() {
      if (typeof browser.off === 'function') {
        browser.off('targetcreated', onTargetCreated);
      } else if (typeof browser.removeListener === 'function') {
        browser.removeListener('targetcreated', onTargetCreated);
      }
      for (const session of Array.from(targetSessions)) {
        await session.detach().catch(() => {});
      }
      report.status = 'stopped';
      emitStatus();
    },
  };
}

function fetchJson(port, endpoint) {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${port}${endpoint}`, (response) => {
      let data = '';
      response.on('data', (chunk) => {
        data += chunk;
      });
      response.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', reject);
  });
}

async function applyFingerprintToDebugPort(options = {}) {
  const port = Math.max(1, Number(options.port) || DEFAULT_DEBUG_PORT);
  const normalizedProfile = normalizeFingerprintProfile(options.profile);
  const resolvedProfile = resolveFingerprintProfile(normalizedProfile, {
    proxyRegion: options.proxyRegion || pickProxyRegionFromState(options.state || {}),
    state: options.state || {},
  });
  const logger = buildLogger(options.logger);
  const report = createStatusReportSkeleton(resolvedProfile);

  if (!resolvedProfile) {
    return {
      report,
      resolvedProfile: null,
    };
  }

  const versionInfo = await fetchJson(port, '/json/version').catch(() => ({}));
  const targets = await fetchJson(port, '/json/list').catch(() => []);
  report.status = 'running';

  for (const target of Array.isArray(targets) ? targets : []) {
    if (String(target?.type || '').trim().toLowerCase() !== 'page') {
      continue;
    }
    if (!isInjectableUrl(target?.url || '')) {
      report.skippedTargetCount += 1;
      continue;
    }
    if (!target?.webSocketDebuggerUrl) {
      report.skippedTargetCount += 1;
      continue;
    }

    let client = null;
    try {
      client = await CDP({ target: target.webSocketDebuggerUrl });
      await applyFingerprintToSession(client, resolvedProfile, {
        browserVersion: versionInfo?.Browser || '',
      });
      report.appliedTargetCount += 1;
      report.lastAppliedAt = Date.now();
      report.lastTargetUrl = String(target.url || '');
      report.lastError = '';
    } catch (error) {
      report.errorCount += 1;
      report.lastError = error?.message || String(error || 'fingerprint_debug_port_failed');
      logger.warn('[Fingerprint] Failed to apply profile to debug target', {
        url: String(target?.url || ''),
        error: report.lastError,
      });
    } finally {
      if (client) {
        await client.close().catch(() => {});
      }
    }
  }

  report.status = report.errorCount > 0 && report.appliedTargetCount === 0
    ? 'error'
    : 'running';

  return {
    report,
    resolvedProfile,
  };
}

module.exports = {
  applyFingerprintToDebugPort,
  buildInjectedFingerprintSource,
  createPuppeteerFingerprintSupervisor,
  resolveFingerprintProfile,
};
