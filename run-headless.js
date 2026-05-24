#!/usr/bin/env node
/**
 * GuJumpgate 无头运行器
 * 通过 Puppeteer 启动 Chrome、加载扩展，并调用 agent-control 页面完成配置与自动运行。
 *
 * 使用方式：
 *   node run-headless.js --config=config.json
 *   node run-headless.js --hotmailEmail=xxx@outlook.com --hotmailPassword=xxx --panelMode=local-cpa-json-no-rt
 */

const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
const http = require('http');

const EXTENSION_PATH = path.resolve(__dirname);
const DEFAULT_CHROME_PATH = process.env.GUJUMPGATE_CHROME_PATH || '/opt/google/chrome/chrome';
const DEFAULT_USER_DATA_DIR = process.env.GUJUMPGATE_USER_DATA_DIR || '/tmp/chrome-gujumpgate';
const DEBUG_PORT = 9222;
const HELPER_PORT = 17373;
const AGENT_CONTROL_PAGE = 'agent-control.html';

const DEFAULTS = {
  chromePath: DEFAULT_CHROME_PATH,
  userDataDir: DEFAULT_USER_DATA_DIR,
  helperHost: '127.0.0.1',
  helperPort: HELPER_PORT,
  pluginDir: '/root/GuJumpgate/data/auth-output',
  panelMode: 'local-cpa-json-no-rt',
  signupMethod: 'email',
  mailProvider: 'hotmail',
  plusModeEnabled: false,
  plusPaymentMethod: 'paypal',
  phoneSmsProvider: '5sim',
  smsCountry: 'argentina',
  totalRuns: 1,
  autoRunSkipFailures: true,
  maxWaitSeconds: 300,
  pollIntervalMs: 5000,
  keepBrowserOpen: false,
  keepBrowserOnFailure: false,
  proxyEnabled: true,
  proxyHost: '127.0.0.1',
  proxyPort: 10809,
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) {
    return false;
  }
  return fallback;
}

function parseArgs() {
  const args = {};
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--')) {
      const raw = arg.slice(2);
      const separatorIndex = raw.indexOf('=');
      if (separatorIndex === -1) {
        args[raw] = true;
      } else {
        const key = raw.slice(0, separatorIndex);
        const rawValue = raw.slice(separatorIndex + 1);
        args[key] = rawValue;
      }
    } else if (arg.endsWith('.json') && fs.existsSync(arg)) {
      args.config = arg;
    }
  }

  if (args.config && fs.existsSync(args.config)) {
    Object.assign(args, JSON.parse(fs.readFileSync(args.config, 'utf8')));
  }

  return {
    ...DEFAULTS,
    ...args,
  };
}

function normalizePhoneSmsProvider(value = '') {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) {
    return '';
  }
  if (normalized === '5sim' || normalized === 'five-sim' || normalized === 'five_sim') {
    return '5sim';
  }
  if (normalized === 'hero-sms' || normalized === 'herosms' || normalized === 'hero_sms') {
    return 'hero-sms';
  }
  if (normalized === 'nexsms' || normalized === 'nex-sms' || normalized === 'nex_sms') {
    return 'nexsms';
  }
  return normalized;
}

function resolvePanelMode(config = {}) {
  const explicit = String(config.panelMode || '').trim();
  if (explicit) {
    return explicit;
  }
  const legacyExportTarget = String(config.exportTarget || '').trim().toLowerCase();
  if (!legacyExportTarget) {
    return DEFAULTS.panelMode;
  }
  if (legacyExportTarget === 'local-cpa-json-no-rt' || legacyExportTarget === 'local-cpa-json') {
    return legacyExportTarget;
  }
  if (legacyExportTarget === 'sub2api' || legacyExportTarget === 'codex2api' || legacyExportTarget === 'cpa') {
    return legacyExportTarget;
  }
  return DEFAULTS.panelMode;
}

function shouldExpectLocalAuthFiles(panelMode = '') {
  return /^local-cpa-json/i.test(String(panelMode || '').trim());
}

function buildHelperBaseUrl(config = {}) {
  return `http://${String(config.helperHost || DEFAULTS.helperHost).trim()}:${Math.max(1, Number(config.helperPort) || HELPER_PORT)}`;
}

function deriveHotmailAccounts(config = {}) {
  if (Array.isArray(config.hotmailAccounts) && config.hotmailAccounts.length) {
    return config.hotmailAccounts;
  }
  if (!config.hotmailEmail || !config.hotmailPassword) {
    return [];
  }
  return [{
    email: String(config.hotmailEmail || '').trim(),
    password: String(config.hotmailPassword || ''),
    clientId: String(config.hotmailClientId || ''),
    refreshToken: String(config.hotmailRefreshToken || ''),
    status: String(config.hotmailStatus || 'authorized'),
    enabled: normalizeBoolean(config.hotmailEnabled, true),
    used: normalizeBoolean(config.hotmailUsed, false),
  }];
}

function derivePayPalAccounts(config = {}) {
  if (Array.isArray(config.paypalAccounts) && config.paypalAccounts.length) {
    return config.paypalAccounts;
  }
  if (!config.paypalEmail || !config.paypalPassword) {
    return [];
  }
  return [{
    email: String(config.paypalEmail || '').trim(),
    password: String(config.paypalPassword || ''),
    enabled: normalizeBoolean(config.paypalEnabled, true),
  }];
}

function resolvePhoneVerificationEnabled(config = {}) {
  if (config.phoneVerificationEnabled !== undefined) {
    return normalizeBoolean(config.phoneVerificationEnabled, false);
  }
  return Boolean(
    config.smsApiKey
    || config.fiveSimApiKey
    || config.heroSmsApiKey
    || config.nexSmsApiKey
    || config.signupPhoneNumber
  );
}

function buildSettingsProfile(config = {}) {
  const settings = isPlainObject(config.settings) ? { ...config.settings } : {};
  const panelMode = resolvePanelMode(config);
  const helperBaseUrl = buildHelperBaseUrl(config);
  const phoneSmsProvider = normalizePhoneSmsProvider(config.phoneSmsProvider || config.smsProvider || DEFAULTS.phoneSmsProvider);

  settings.panelMode = panelMode;
  settings.mailProvider = String(config.mailProvider || settings.mailProvider || DEFAULTS.mailProvider).trim() || DEFAULTS.mailProvider;
  settings.signupMethod = String(config.signupMethod || settings.signupMethod || DEFAULTS.signupMethod).trim().toLowerCase() === 'phone'
    ? 'phone'
    : 'email';
  settings.plusModeEnabled = normalizeBoolean(
    config.plusModeEnabled !== undefined ? config.plusModeEnabled : settings.plusModeEnabled,
    DEFAULTS.plusModeEnabled
  );
  settings.plusPaymentMethod = String(config.plusPaymentMethod || settings.plusPaymentMethod || DEFAULTS.plusPaymentMethod).trim() || DEFAULTS.plusPaymentMethod;
  settings.phoneVerificationEnabled = resolvePhoneVerificationEnabled(config);
  settings.phoneSmsProvider = phoneSmsProvider || settings.phoneSmsProvider || DEFAULTS.phoneSmsProvider;

  if (shouldExpectLocalAuthFiles(panelMode)) {
    settings.localCpaJsonPluginDir = String(
      config.localCpaJsonPluginDir || config.pluginDir || settings.localCpaJsonPluginDir || DEFAULTS.pluginDir
    ).trim();
    if (config.localCpaJsonRelativeAuthDir || settings.localCpaJsonRelativeAuthDir) {
      settings.localCpaJsonRelativeAuthDir = String(
        config.localCpaJsonRelativeAuthDir || settings.localCpaJsonRelativeAuthDir || ''
      ).trim();
    }
  }

  if (config.hotmailServiceMode || settings.hotmailServiceMode || settings.mailProvider === 'hotmail') {
    settings.hotmailServiceMode = String(config.hotmailServiceMode || settings.hotmailServiceMode || 'local').trim() || 'local';
    settings.hotmailLocalBaseUrl = String(config.hotmailLocalBaseUrl || settings.hotmailLocalBaseUrl || helperBaseUrl).trim();
    settings.accountRunHistoryHelperBaseUrl = String(
      config.accountRunHistoryHelperBaseUrl || settings.accountRunHistoryHelperBaseUrl || helperBaseUrl
    ).trim();
    settings.accountRunHistoryTextEnabled = normalizeBoolean(
      config.accountRunHistoryTextEnabled !== undefined ? config.accountRunHistoryTextEnabled : settings.accountRunHistoryTextEnabled,
      true
    );
  }

  if (settings.phoneSmsProvider === '5sim') {
    settings.fiveSimApiKey = String(config.fiveSimApiKey || config.smsApiKey || settings.fiveSimApiKey || '').trim();
    if (config.fiveSimCountryId || config.smsCountry || settings.fiveSimCountryId) {
      settings.fiveSimCountryId = String(config.fiveSimCountryId || config.smsCountry || settings.fiveSimCountryId || '').trim();
    }
    if (config.fiveSimCountryLabel || config.smsCountryLabel || settings.fiveSimCountryLabel) {
      settings.fiveSimCountryLabel = String(
        config.fiveSimCountryLabel || config.smsCountryLabel || settings.fiveSimCountryLabel || config.smsCountry || ''
      ).trim();
    }
    if (config.fiveSimProduct || settings.fiveSimProduct) {
      settings.fiveSimProduct = String(config.fiveSimProduct || settings.fiveSimProduct || '').trim();
    }
    if (config.fiveSimOperator || settings.fiveSimOperator) {
      settings.fiveSimOperator = String(config.fiveSimOperator || settings.fiveSimOperator || '').trim();
    }
  } else if (settings.phoneSmsProvider === 'hero-sms') {
    settings.heroSmsApiKey = String(config.heroSmsApiKey || config.smsApiKey || settings.heroSmsApiKey || '').trim();
    if (config.heroSmsCountryId !== undefined || config.smsCountry !== undefined || settings.heroSmsCountryId !== undefined) {
      const rawCountryId = config.heroSmsCountryId ?? config.smsCountry ?? settings.heroSmsCountryId;
      settings.heroSmsCountryId = Number.isFinite(Number(rawCountryId)) ? Number(rawCountryId) : rawCountryId;
    }
    if (config.heroSmsCountryLabel || config.smsCountryLabel || settings.heroSmsCountryLabel) {
      settings.heroSmsCountryLabel = String(
        config.heroSmsCountryLabel || config.smsCountryLabel || settings.heroSmsCountryLabel || ''
      ).trim();
    }
  } else if (settings.phoneSmsProvider === 'nexsms') {
    settings.nexSmsApiKey = String(config.nexSmsApiKey || config.smsApiKey || settings.nexSmsApiKey || '').trim();
  }

  return settings;
}

function buildAgentProfile(config = {}) {
  const baseProfile = isPlainObject(config.agentProfile) ? { ...config.agentProfile } : {};
  const hotmailAccounts = deriveHotmailAccounts(config);
  const paypalAccounts = derivePayPalAccounts(config);

  const profile = {
    ...baseProfile,
    settings: buildSettingsProfile({
      ...config,
      ...(isPlainObject(baseProfile.settings) ? { settings: baseProfile.settings } : {}),
    }),
    hotmailAccounts: Array.isArray(baseProfile.hotmailAccounts) && baseProfile.hotmailAccounts.length
      ? baseProfile.hotmailAccounts
      : hotmailAccounts,
    selectHotmailEmail: baseProfile.selectHotmailEmail
      || config.selectHotmailEmail
      || hotmailAccounts[0]?.email
      || '',
    paypalAccounts: Array.isArray(baseProfile.paypalAccounts) && baseProfile.paypalAccounts.length
      ? baseProfile.paypalAccounts
      : paypalAccounts,
    selectPayPalEmail: baseProfile.selectPayPalEmail
      || config.selectPayPalEmail
      || paypalAccounts[0]?.email
      || '',
  };

  if (baseProfile.email !== undefined) {
    profile.email = baseProfile.email;
  } else if (config.email) {
    profile.email = config.email;
  }

  if (baseProfile.signupPhoneNumber !== undefined) {
    profile.signupPhoneNumber = baseProfile.signupPhoneNumber;
  } else if (config.signupPhoneNumber || config.phoneNumber) {
    profile.signupPhoneNumber = config.signupPhoneNumber || config.phoneNumber;
  }

  return profile;
}

async function ensureHelperRunning(host, port) {
  return new Promise((resolve) => {
    const req = http.request({ hostname: host, port, path: '/', method: 'POST' }, (res) => {
      res.resume();
      resolve(true);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    req.setTimeout(3000);
    req.end();
  });
}

async function startBrowser(config) {
  const browserArgs = [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    `--load-extension=${EXTENSION_PATH}`,
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${String(config.userDataDir || DEFAULT_USER_DATA_DIR).trim() || DEFAULT_USER_DATA_DIR}`,
    `--disable-extensions-except=${EXTENSION_PATH}`,
    '--enable-features=SidePanel',
    '--window-size=1280,800',
  ];

  if (normalizeBoolean(config.proxyEnabled, true) && config.proxyHost && config.proxyPort) {
    browserArgs.push(`--proxy-server=${config.proxyHost}:${config.proxyPort}`);
  }

  console.log('[Runner] 启动 Chrome...');
  const browser = await puppeteer.launch({
    executablePath: String(config.chromePath || DEFAULT_CHROME_PATH).trim() || DEFAULT_CHROME_PATH,
    args: browserArgs,
    headless: 'new',
  });
  console.log('[Runner] Chrome 已启动');
  return browser;
}

async function resolveExtensionId(browser) {
  const maxAttempts = 20;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const targets = browser.targets();
    for (const target of targets) {
      const url = target.url();
      if (url.startsWith('chrome-extension://')) {
        const extensionId = url.split('/')[2];
        if (extensionId) {
          return extensionId;
        }
      }
    }
    await sleep(500);
  }
  throw new Error('扩展加载失败，无法解析扩展 ID。');
}

async function openAgentControlPage(browser, extensionId) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 960 });
  await page.goto(`chrome-extension://${extensionId}/${AGENT_CONTROL_PAGE}`, {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });
  await page.waitForFunction(
    () => Boolean(window.GuJumpgateAgentControl)
      && typeof window.GuJumpgateAgentControl.getSnapshot === 'function',
    { timeout: 30000 }
  );
  return page;
}

async function callAgentControl(page, methodName, ...args) {
  return page.evaluate(async ({ methodName, args }) => {
    const api = window.GuJumpgateAgentControl;
    if (!api || typeof api[methodName] !== 'function') {
      throw new Error(`agent-control 方法不存在：${methodName}`);
    }
    return api[methodName](...args);
  }, { methodName, args });
}

function collectAuthFiles(authDir, baselineFiles = new Set()) {
  if (!authDir || !fs.existsSync(authDir)) {
    return [];
  }
  return fs.readdirSync(authDir)
    .filter((fileName) => fileName.endsWith('.json'))
    .filter((fileName) => !baselineFiles.has(fileName));
}

function getLatestHistoryRecord(snapshot = {}) {
  const recentRuns = Array.isArray(snapshot?.history?.recentRuns) ? snapshot.history.recentRuns : [];
  return recentRuns.length ? recentRuns[recentRuns.length - 1] : null;
}

function buildStartOptions(config = {}) {
  return {
    totalRuns: Math.max(1, Math.floor(Number(config.totalRuns) || DEFAULTS.totalRuns)),
    autoRunSkipFailures: normalizeBoolean(config.autoRunSkipFailures, DEFAULTS.autoRunSkipFailures),
    delayMinutes: Math.max(0, Math.floor(Number(config.delayMinutes) || 0)),
    mode: String(config.runMode || config.mode || 'restart').trim().toLowerCase() === 'continue'
      ? 'continue'
      : 'restart',
  };
}

async function writeDiagnosticsArtifacts(agentPage, config, diagnostics = {}, reason = 'failure') {
  const diagnosticsDir = path.resolve(String(config.diagnosticsDir || config.pluginDir || __dirname));
  fs.mkdirSync(diagnosticsDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const jsonPath = path.join(diagnosticsDir, `headless-diagnostics-${reason}-${stamp}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(diagnostics, null, 2), 'utf8');

  const screenshotPath = path.join(diagnosticsDir, `headless-agent-${reason}-${stamp}.png`);
  await agentPage.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});

  return {
    jsonPath,
    screenshotPath,
  };
}

async function monitorRun(agentPage, config = {}, runtimeContext = {}) {
  const panelMode = resolvePanelMode(config);
  const expectLocalAuthFiles = shouldExpectLocalAuthFiles(panelMode);
  const pollIntervalMs = Math.max(1000, Math.floor(Number(config.pollIntervalMs) || DEFAULTS.pollIntervalMs));
  const maxWaitMs = Math.max(10000, Math.floor(Number(config.maxWaitSeconds) || DEFAULTS.maxWaitSeconds) * 1000);
  const startedAt = Date.now();
  const baselineFiles = new Set(Array.isArray(runtimeContext.baselineFiles) ? runtimeContext.baselineFiles : []);

  let lastPhase = '';
  let lastNodeId = '';
  let stoppedAt = 0;

  while (Date.now() - startedAt < maxWaitMs) {
    const snapshot = await callAgentControl(agentPage, 'getSnapshot', {
      logLimit: 8,
      eventLimit: 8,
    });

    const phase = String(snapshot?.run?.phase || 'idle');
    const currentNodeId = String(snapshot?.run?.currentNodeId || '');
    if (phase !== lastPhase || currentNodeId !== lastNodeId) {
      const latestLogMessage = snapshot?.lastLogEntry?.message || '';
      console.log(`[Runner] 状态: phase=${phase} node=${currentNodeId || '-'} ${latestLogMessage ? `| ${latestLogMessage}` : ''}`);
      lastPhase = phase;
      lastNodeId = currentNodeId;
    }

    const newAuthFiles = collectAuthFiles(runtimeContext.authDir, baselineFiles);
    if (newAuthFiles.length) {
      return {
        ok: true,
        reason: 'auth_files_detected',
        files: newAuthFiles,
        snapshot,
      };
    }

    const latestHistory = getLatestHistoryRecord(snapshot);
    if (latestHistory?.finalStatus === 'success') {
      if (!expectLocalAuthFiles) {
        return {
          ok: true,
          reason: 'history_success',
          files: [],
          snapshot,
        };
      }
      if (!stoppedAt) {
        stoppedAt = Date.now();
      }
      if (Date.now() - stoppedAt >= 10000) {
        return {
          ok: false,
          reason: 'history_success_but_no_auth_file',
          snapshot,
        };
      }
    }

    if (snapshot?.run?.autoRunning) {
      stoppedAt = 0;
    } else {
      if (!stoppedAt) {
        stoppedAt = Date.now();
      }
      const stoppedDuration = Date.now() - stoppedAt;
      if (stoppedDuration >= 10000) {
        const diagnostics = await callAgentControl(agentPage, 'captureDiagnostics', {
          includeFullState: true,
          logLimit: 20,
          eventLimit: 20,
        });
        const latestFailure = getLatestHistoryRecord(diagnostics?.snapshot || snapshot);
        return {
          ok: false,
          reason: latestFailure?.finalStatus || 'stopped_without_success',
          snapshot,
          diagnostics,
        };
      }
    }

    await sleep(pollIntervalMs);
  }

  const timeoutDiagnostics = await callAgentControl(agentPage, 'captureDiagnostics', {
    includeFullState: true,
    logLimit: 20,
    eventLimit: 20,
  });
  return {
    ok: false,
    reason: 'timeout',
    diagnostics: timeoutDiagnostics,
    snapshot: timeoutDiagnostics?.snapshot || null,
  };
}

async function main() {
  const config = parseArgs();
  const profile = buildAgentProfile(config);
  const startOptions = buildStartOptions(config);
  const panelMode = resolvePanelMode(config);
  const authDir = shouldExpectLocalAuthFiles(panelMode)
    ? path.resolve(String(
        profile?.settings?.localCpaJsonPluginDir
        || config.pluginDir
        || DEFAULTS.pluginDir
      ))
    : '';

  console.log('[Runner] 启动配置:');
  console.log(JSON.stringify({
    panelMode,
    signupMethod: profile?.settings?.signupMethod,
    mailProvider: profile?.settings?.mailProvider,
    plusModeEnabled: profile?.settings?.plusModeEnabled,
    plusPaymentMethod: profile?.settings?.plusPaymentMethod,
    phoneSmsProvider: profile?.settings?.phoneSmsProvider,
    totalRuns: startOptions.totalRuns,
    autoRunSkipFailures: startOptions.autoRunSkipFailures,
    authDir: authDir || null,
  }, null, 2));

  if (authDir) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  const helperOk = await ensureHelperRunning(config.helperHost, Number(config.helperPort) || HELPER_PORT);
  console.log(`[Runner] Hotmail Helper (${config.helperHost}:${config.helperPort}): ${helperOk ? '运行中' : '未运行'}`);

  const browser = await startBrowser(config);
  let keepBrowserOpen = normalizeBoolean(config.keepBrowserOpen, false);

  try {
    const extensionId = await resolveExtensionId(browser);
    console.log(`[Runner] 扩展 ID: ${extensionId}`);

    const agentPage = await openAgentControlPage(browser, extensionId);
    console.log('[Runner] agent-control 页面已就绪');

    const baselineFiles = authDir && fs.existsSync(authDir)
      ? fs.readdirSync(authDir).filter((fileName) => fileName.endsWith('.json'))
      : [];
    if (baselineFiles.length) {
      console.log(`[Runner] 检测到既有认证文件 ${baselineFiles.length} 个，后续只统计新生成文件`);
    }

    const applyResult = await callAgentControl(agentPage, 'applyProfile', profile);
    console.log('[Runner] Profile 已注入');
    if (applyResult?.snapshot?.lastLogEntry?.message) {
      console.log(`[Runner] 当前日志: ${applyResult.snapshot.lastLogEntry.message}`);
    }

    const startResult = await callAgentControl(agentPage, 'startRun', startOptions);
    console.log(`[Runner] 自动运行已启动，phase=${startResult?.snapshot?.run?.phase || 'unknown'}`);

    const monitorResult = await monitorRun(agentPage, config, {
      authDir,
      baselineFiles,
    });

    if (!monitorResult.ok) {
      const artifactPaths = await writeDiagnosticsArtifacts(
        agentPage,
        config,
        monitorResult.diagnostics || monitorResult,
        monitorResult.reason || 'failure'
      );
      const latestHistory = getLatestHistoryRecord(monitorResult?.diagnostics?.snapshot || monitorResult?.snapshot || {});
      throw new Error([
        `自动运行失败：${monitorResult.reason || 'unknown'}`,
        latestHistory?.failedNodeId ? `failedNode=${latestHistory.failedNodeId}` : '',
        latestHistory?.failureDetail ? `detail=${latestHistory.failureDetail}` : '',
        `diagnostics=${artifactPaths.jsonPath}`,
        `screenshot=${artifactPaths.screenshotPath}`,
      ].filter(Boolean).join(' | '));
    }

    if (monitorResult.files.length) {
      console.log('[Runner] 运行成功，新增认证文件:');
      monitorResult.files.forEach((fileName) => {
        console.log(`  - ${fileName}`);
      });
    } else {
      console.log(`[Runner] 运行成功，原因: ${monitorResult.reason}`);
    }

    if (keepBrowserOpen) {
      console.log('[Runner] 已按配置保留浏览器，方便继续观察当前状态。');
      await new Promise(() => {});
    }
  } catch (error) {
    const keepOnFailure = normalizeBoolean(config.keepBrowserOnFailure, false);
    keepBrowserOpen = keepBrowserOpen || keepOnFailure;
    console.error(`[Runner] 错误: ${error?.message || String(error || 'unknown error')}`);
    if (!keepBrowserOpen) {
      process.exitCode = 1;
    } else {
      console.error('[Runner] 已按配置保留浏览器，方便继续排障。');
      await new Promise(() => {});
    }
  } finally {
    if (!keepBrowserOpen) {
      await browser.close().catch(() => {});
      console.log('[Runner] Chrome 已关闭');
    }
  }
}

main().catch((error) => {
  console.error('[Runner] 未处理异常:', error?.message || String(error || 'unknown error'));
  process.exit(1);
});
