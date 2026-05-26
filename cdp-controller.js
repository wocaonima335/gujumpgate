#!/usr/bin/env node
/**
 * GuJumpgate Agent 控制器
 * 通过 CDP 连接到已运行的 Chrome，并调用 agent-control.html 暴露的统一控制 API。
 *
 * 用法：
 *   node cdp-controller.js status
 *   node cdp-controller.js config <json-file-or-json-string>
 *   node cdp-controller.js start [json-file-or-json-string]
 *   node cdp-controller.js stop
 *   node cdp-controller.js reset
 *   node cdp-controller.js resume <json-file-or-json-string>
 *   node cdp-controller.js takeover
 *   node cdp-controller.js diag [json-file-or-json-string]
 *   node cdp-controller.js events [count]
 *   node cdp-controller.js workflow
 *   node cdp-controller.js node <node-id-or-json-string>
 *   node cdp-controller.js sequence <json-array-or-json-object>
 *   node cdp-controller.js preset <preset-name-or-json>
 *   node cdp-controller.js screenshot [output-path]
 */

const CDP = require('chrome-remote-interface');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { applyFingerprintToDebugPort } = require('./proxy-fingerprint.js');
const { pickProxyRegionFromState } = require('./shared/fingerprint-profile.js');

const DEBUG_PORT = 9222;
const DEFAULT_EXTENSION_ID = process.env.GUJUMPGATE_EXTENSION_ID || 'jbfdbapohpgallheekahoigcghkpkiin';
const AGENT_CONTROL_PAGE = 'agent-control.html';
const DEFAULT_SCREENSHOT_PATH = path.resolve(__dirname, 'screenshot.png');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readJsonInput(rawValue, fallback = {}) {
  if (!rawValue) {
    return fallback;
  }
  const candidatePath = path.resolve(rawValue);
  if (fs.existsSync(candidatePath)) {
    return JSON.parse(fs.readFileSync(candidatePath, 'utf8'));
  }
  return JSON.parse(rawValue);
}

function readJsonInputOrRawString(rawValue, fallback = '') {
  if (!rawValue) {
    return fallback;
  }
  try {
    return readJsonInput(rawValue, fallback);
  } catch {
    return String(rawValue || '');
  }
}

function printJson(value) {
  console.log(JSON.stringify(value, null, 2));
}

function extractFingerprintProfileFromProfile(profile = {}) {
  if (profile && typeof profile === 'object' && !Array.isArray(profile)) {
    if (profile.fingerprintProfile !== undefined) {
      return profile.fingerprintProfile;
    }
    if (profile.settings && typeof profile.settings === 'object' && !Array.isArray(profile.settings)) {
      return profile.settings.fingerprintProfile ?? null;
    }
  }
  return null;
}

async function fetchJson(endpoint) {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${DEBUG_PORT}${endpoint}`, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', reject);
  });
}

async function getTargetList() {
  return fetchJson('/json/list');
}

async function getBrowserVersion() {
  return fetchJson('/json/version');
}

function extractExtensionIdFromUrl(url = '') {
  const match = String(url || '').match(/^chrome-extension:\/\/([^/]+)\//i);
  return match ? match[1] : '';
}

async function resolveExtensionId(preferredId = '') {
  if (preferredId) {
    return preferredId;
  }

  const list = await getTargetList().catch(() => []);
  for (const target of Array.isArray(list) ? list : []) {
    const extensionId = extractExtensionIdFromUrl(target?.url || '');
    if (extensionId) {
      return extensionId;
    }
  }

  return DEFAULT_EXTENSION_ID;
}

function findAgentControlTarget(targets, extensionId) {
  const expectedPrefix = `chrome-extension://${extensionId}/${AGENT_CONTROL_PAGE}`;
  return (Array.isArray(targets) ? targets : []).find((target) => {
    return String(target?.url || '').startsWith(expectedPrefix);
  }) || null;
}

async function createAgentControlTarget(extensionId) {
  const browserClient = await CDP({ port: DEBUG_PORT });
  try {
    await browserClient.Target.createTarget({
      url: `chrome-extension://${extensionId}/${AGENT_CONTROL_PAGE}`,
    });
  } finally {
    await browserClient.close().catch(() => {});
  }
}

async function ensureAgentControlTarget(extensionId) {
  const maxAttempts = 20;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const targets = await getTargetList();
    const existing = findAgentControlTarget(targets, extensionId);
    if (existing) {
      return existing;
    }

    if (attempt === 1) {
      await createAgentControlTarget(extensionId);
    }
    await sleep(500);
  }

  throw new Error(`未找到 agent 控制页：chrome-extension://${extensionId}/${AGENT_CONTROL_PAGE}`);
}

async function connectAgentControl(extensionId) {
  const target = await ensureAgentControlTarget(extensionId);
  const client = await CDP({ port: DEBUG_PORT, target });
  return {
    client,
    target,
  };
}

async function evaluateOnAgentControl(client, expression) {
  const result = await client.Runtime.evaluate({
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result?.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || 'agent control evaluate failed');
  }
  return result?.result?.value;
}

async function callAgentMethod(methodName, args = [], options = {}) {
  const extensionId = await resolveExtensionId(options.extensionId);
  const { client, target } = await connectAgentControl(extensionId);
  try {
    const serializedArgs = JSON.stringify(Array.isArray(args) ? args : []);
    const expression = `
      (async () => {
        const api = window.GuJumpgateAgentControl;
        if (!api || typeof api[${JSON.stringify(methodName)}] !== 'function') {
          throw new Error('agent-control 页面尚未准备好：' + ${JSON.stringify(methodName)});
        }
        return await api[${JSON.stringify(methodName)}](...${serializedArgs});
      })()
    `;
    const value = await evaluateOnAgentControl(client, expression);
    return {
      extensionId,
      targetUrl: target?.url || '',
      value,
    };
  } finally {
    await client.close().catch(() => {});
  }
}

async function captureAgentControlScreenshot(outputPath, options = {}) {
  const extensionId = await resolveExtensionId(options.extensionId);
  const { client } = await connectAgentControl(extensionId);
  try {
    await client.Page.enable();
    const result = await client.Page.captureScreenshot({ format: 'png' });
    const finalPath = path.resolve(outputPath || DEFAULT_SCREENSHOT_PATH);
    fs.writeFileSync(finalPath, Buffer.from(result.data, 'base64'));
    return {
      extensionId,
      outputPath: finalPath,
    };
  } finally {
    await client.close().catch(() => {});
  }
}

async function main() {
  const command = process.argv[2] || 'status';
  const rawInput = process.argv[3] || '';

  console.log(`[AgentCDP] 命令: ${command}`);

  const versionInfo = await getBrowserVersion();
  console.log(`[AgentCDP] 浏览器: ${versionInfo.Browser || 'unknown'}`);

  switch (command) {
    case 'status': {
      const result = await callAgentMethod('getSnapshot');
      printJson(result.value);
      return;
    }

    case 'workflow': {
      const result = await callAgentMethod('getWorkflowNodes');
      printJson(result.value);
      return;
    }

    case 'config': {
      if (!rawInput) {
        throw new Error('用法: node cdp-controller.js config <json-file-or-json-string>');
      }
      const profile = readJsonInput(rawInput);
      const result = await callAgentMethod('applyProfile', [profile]);
      const fingerprintProfile = extractFingerprintProfileFromProfile(profile);
      if (fingerprintProfile) {
        const runtime = await applyFingerprintToDebugPort({
          port: DEBUG_PORT,
          profile: fingerprintProfile,
          proxyRegion: pickProxyRegionFromState(profile?.settings || {}) || String(profile?.proxyRegion || '').trim(),
          state: profile?.settings || {},
          logger: console,
        });
        result.value.fingerprintRuntime = runtime.report;
        await callAgentMethod('reportFingerprintRuntime', [runtime.report]).catch(() => {});
      }
      printJson(result.value);
      return;
    }

    case 'start': {
      const options = readJsonInput(rawInput, {});
      const result = await callAgentMethod('startRun', [options]);
      printJson(result.value);
      return;
    }

    case 'node': {
      if (!rawInput) {
        throw new Error('鐢ㄦ硶: node cdp-controller.js node <node-id-or-json-string>');
      }
      const parsed = readJsonInputOrRawString(rawInput, '');
      const payload = parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed
        : { nodeId: String(parsed || '').trim() };
      const nodeId = String(payload.nodeId || '').trim();
      if (!nodeId) {
        throw new Error('node 命令缺少 nodeId。');
      }
      const result = await callAgentMethod('executeNode', [nodeId, payload]);
      printJson(result.value);
      return;
    }

    case 'sequence': {
      if (!rawInput) {
        throw new Error('鐢ㄦ硶: node cdp-controller.js sequence <json-array-or-json-object>');
      }
      const parsed = readJsonInput(rawInput, []);
      if (Array.isArray(parsed)) {
        const result = await callAgentMethod('executeNodeSequence', [parsed, {}]);
        printJson(result.value);
        return;
      }
      const nodeIds = Array.isArray(parsed?.nodeIds) ? parsed.nodeIds : [];
      const options = parsed?.options && typeof parsed.options === 'object' && !Array.isArray(parsed.options)
        ? parsed.options
        : {};
      const result = await callAgentMethod('executeNodeSequence', [nodeIds, options]);
      printJson(result.value);
      return;
    }

    case 'preset': {
      if (!rawInput) {
        throw new Error('鐢ㄦ硶: node cdp-controller.js preset <preset-name-or-json>');
      }
      const parsed = readJsonInputOrRawString(rawInput, '');
      const payload = parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed
        : { presetId: String(parsed || '').trim() };
      const presetId = String(payload.presetId || '').trim();
      if (!presetId) {
        throw new Error('preset 命令缺少 presetId。');
      }
      const options = payload.options && typeof payload.options === 'object' && !Array.isArray(payload.options)
        ? payload.options
        : {};
      const result = await callAgentMethod('runFlowPreset', [presetId, options]);
      printJson(result.value);
      return;
    }

    case 'stop': {
      const result = await callAgentMethod('stopRun');
      printJson(result.value);
      return;
    }

    case 'reset': {
      const result = await callAgentMethod('resetState');
      printJson(result.value);
      return;
    }

    case 'resume': {
      const options = readJsonInput(rawInput, {});
      const result = await callAgentMethod('resumeRun', [options]);
      printJson(result.value);
      return;
    }

    case 'takeover': {
      const result = await callAgentMethod('takeOverRun');
      printJson(result.value);
      return;
    }

    case 'diag': {
      const options = readJsonInput(rawInput, {});
      const result = await callAgentMethod('captureDiagnostics', [options]);
      printJson(result.value);
      return;
    }

    case 'events': {
      const count = Math.max(1, Math.floor(Number(rawInput) || 20));
      const result = await callAgentMethod('getRecentEvents', [count]);
      printJson(result.value);
      return;
    }

    case 'screenshot': {
      const result = await captureAgentControlScreenshot(rawInput || DEFAULT_SCREENSHOT_PATH);
      printJson(result);
      return;
    }

    default:
      throw new Error(`未知命令: ${command}`);
    }
}

main().catch((error) => {
  console.error('[AgentCDP] 错误:', error?.message || String(error || 'unknown error'));
  process.exit(1);
});
