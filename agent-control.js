(function initAgentControlPage() {
  const AGENT_SOURCE = 'agent-control';
  const CONTROLLER_VERSION = '0.1.0';
  const MAX_EVENT_ENTRIES = 200;
  const DEFAULT_LOG_LIMIT = 20;
  const DEFAULT_EVENT_LIMIT = 20;
  const REFRESH_INTERVAL_MS = 3000;

  const state = {
    readyAt: Date.now(),
    lastSnapshotAt: 0,
    lastSnapshot: null,
    events: [],
  };

  const readyBadge = document.getElementById('agent-ready-badge');
  const statusOutput = document.getElementById('agent-status-output');

  function toPlainObject(value) {
    if (value === undefined) {
      return null;
    }
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (error) {
      return {
        serializeError: error?.message || String(error || 'unknown serialize error'),
      };
    }
  }

  function normalizeEmailKey(value = '') {
    return String(value || '').trim().toLowerCase();
  }

  function appendEvent(type, payload = {}) {
    state.events.push({
      type: String(type || 'unknown'),
      at: Date.now(),
      payload: toPlainObject(payload),
    });
    if (state.events.length > MAX_EVENT_ENTRIES) {
      state.events.splice(0, state.events.length - MAX_EVENT_ENTRIES);
    }
  }

  function summarizeNodeStatuses(nodeStatuses = {}) {
    const entries = Object.entries(nodeStatuses || {});
    const summary = {
      total: entries.length,
      pending: 0,
      running: 0,
      completed: 0,
      failed: 0,
      stopped: 0,
      other: 0,
      runningNodes: [],
      failedNodes: [],
    };

    for (const [nodeId, rawStatus] of entries) {
      const status = String(rawStatus || 'pending').trim().toLowerCase();
      switch (status) {
        case 'pending':
          summary.pending += 1;
          break;
        case 'running':
          summary.running += 1;
          summary.runningNodes.push(nodeId);
          break;
        case 'completed':
        case 'manual_completed':
        case 'skipped':
          summary.completed += 1;
          break;
        case 'failed':
          summary.failed += 1;
          summary.failedNodes.push({ nodeId, status });
          break;
        case 'stopped':
          summary.stopped += 1;
          summary.failedNodes.push({ nodeId, status });
          break;
        default:
          summary.other += 1;
          break;
      }
    }

    return summary;
  }

  async function sendRuntimeMessage(type, payload = {}) {
    const response = await chrome.runtime.sendMessage({
      type,
      source: AGENT_SOURCE,
      payload: payload && typeof payload === 'object' ? payload : {},
    });
    if (response?.error) {
      throw new Error(response.error);
    }
    return response;
  }

  async function getFullState() {
    return chrome.runtime.sendMessage({
      type: 'GET_STATE',
      source: AGENT_SOURCE,
    });
  }

  async function applyAccounts(accounts, options = {}) {
    const {
      upsertType = '',
      selectType = '',
      selectEmail = '',
      selectId = '',
    } = options;

    const normalizedAccounts = Array.isArray(accounts) ? accounts : [];
    const result = {
      accounts: [],
      selectedAccount: null,
    };

    const idsByEmail = new Map();
    for (const account of normalizedAccounts) {
      const response = await sendRuntimeMessage(upsertType, account || {});
      const savedAccount = response?.account || null;
      if (savedAccount) {
        result.accounts.push(savedAccount);
        const emailKey = normalizeEmailKey(savedAccount.email);
        if (emailKey) {
          idsByEmail.set(emailKey, savedAccount.id);
        }
      }
    }

    const preferredId = String(selectId || '').trim();
    const preferredEmailId = idsByEmail.get(normalizeEmailKey(selectEmail));
    const resolvedAccountId = preferredId || preferredEmailId || '';
    if (resolvedAccountId && selectType) {
      const response = await sendRuntimeMessage(selectType, { accountId: resolvedAccountId });
      result.selectedAccount = response?.account || null;
    }

    return result;
  }

  async function applyProfile(profile = {}) {
    const normalizedProfile = profile && typeof profile === 'object' ? profile : {};
    const result = {
      appliedAt: Date.now(),
      settings: null,
      hotmail: null,
      paypal: null,
      mail2925: null,
      currentEmail: null,
      signupPhoneNumber: null,
    };

    const settings = normalizedProfile.settings && typeof normalizedProfile.settings === 'object'
      ? normalizedProfile.settings
      : {};
    if (Object.keys(settings).length) {
      result.settings = await sendRuntimeMessage('SAVE_SETTING', settings);
    }

    if (Array.isArray(normalizedProfile.hotmailAccounts) && normalizedProfile.hotmailAccounts.length) {
      result.hotmail = await applyAccounts(normalizedProfile.hotmailAccounts, {
        upsertType: 'UPSERT_HOTMAIL_ACCOUNT',
        selectType: 'SELECT_HOTMAIL_ACCOUNT',
        selectEmail: normalizedProfile.selectHotmailEmail,
        selectId: normalizedProfile.selectHotmailAccountId,
      });
    }

    if (Array.isArray(normalizedProfile.paypalAccounts) && normalizedProfile.paypalAccounts.length) {
      result.paypal = await applyAccounts(normalizedProfile.paypalAccounts, {
        upsertType: 'UPSERT_PAYPAL_ACCOUNT',
        selectType: 'SELECT_PAYPAL_ACCOUNT',
        selectEmail: normalizedProfile.selectPayPalEmail,
        selectId: normalizedProfile.selectPayPalAccountId,
      });
    }

    if (Array.isArray(normalizedProfile.mail2925Accounts) && normalizedProfile.mail2925Accounts.length) {
      result.mail2925 = await applyAccounts(normalizedProfile.mail2925Accounts, {
        upsertType: 'UPSERT_MAIL2925_ACCOUNT',
        selectType: 'SELECT_MAIL2925_ACCOUNT',
        selectEmail: normalizedProfile.selectMail2925Email,
        selectId: normalizedProfile.selectMail2925AccountId,
      });
    }

    if (Object.prototype.hasOwnProperty.call(normalizedProfile, 'email')) {
      result.currentEmail = await sendRuntimeMessage('SAVE_EMAIL', {
        email: normalizedProfile.email,
      });
    }

    if (Object.prototype.hasOwnProperty.call(normalizedProfile, 'signupPhoneNumber')) {
      result.signupPhoneNumber = await sendRuntimeMessage('SAVE_SIGNUP_PHONE', {
        phoneNumber: normalizedProfile.signupPhoneNumber,
      });
    }

    appendEvent('APPLY_PROFILE', {
      appliedSettingsKeys: Object.keys(settings),
      hotmailCount: result.hotmail?.accounts?.length || 0,
      paypalCount: result.paypal?.accounts?.length || 0,
      mail2925Count: result.mail2925?.accounts?.length || 0,
      hasCurrentEmail: Boolean(result.currentEmail?.email),
      hasSignupPhoneNumber: Boolean(result.signupPhoneNumber?.phoneNumber),
    });

    return {
      ok: true,
      result,
      snapshot: await getSnapshot(),
    };
  }

  async function startRun(options = {}) {
    const totalRuns = Math.max(1, Math.floor(Number(options.totalRuns) || 1));
    const autoRunSkipFailures = options.autoRunSkipFailures !== undefined
      ? Boolean(options.autoRunSkipFailures)
      : true;
    const delayMinutes = Number(options.delayMinutes) > 0 ? Number(options.delayMinutes) : 0;
    const type = delayMinutes > 0 ? 'SCHEDULE_AUTO_RUN' : 'AUTO_RUN';
    const response = await sendRuntimeMessage(type, {
      totalRuns,
      delayMinutes,
      autoRunSkipFailures,
      contributionMode: Boolean(options.contributionMode),
      contributionNickname: options.contributionNickname || '',
      contributionQq: options.contributionQq || '',
      mode: options.mode === 'continue' ? 'continue' : 'restart',
    });

    appendEvent('START_RUN', {
      totalRuns,
      delayMinutes,
      autoRunSkipFailures,
      mode: options.mode === 'continue' ? 'continue' : 'restart',
    });

    return {
      ok: true,
      response,
      snapshot: await getSnapshot(),
    };
  }

  async function stopRun() {
    const response = await sendRuntimeMessage('STOP_FLOW', {});
    appendEvent('STOP_RUN', { ok: true });
    return {
      ok: true,
      response,
      snapshot: await getSnapshot(),
    };
  }

  async function resetState() {
    const response = await sendRuntimeMessage('RESET', {});
    appendEvent('RESET', { ok: true });
    return {
      ok: true,
      response,
      snapshot: await getSnapshot(),
    };
  }

  async function resumeRun(options = {}) {
    const response = await sendRuntimeMessage('RESUME_AUTO_RUN', {
      email: options.email || '',
    });
    appendEvent('RESUME_RUN', {
      hasEmail: Boolean(options.email),
    });
    return {
      ok: true,
      response,
      snapshot: await getSnapshot(),
    };
  }

  async function takeOverRun() {
    const response = await sendRuntimeMessage('TAKEOVER_AUTO_RUN', {});
    appendEvent('TAKEOVER_RUN', { ok: true });
    return {
      ok: true,
      response,
      snapshot: await getSnapshot(),
    };
  }

  async function exportSettings() {
    const response = await sendRuntimeMessage('EXPORT_SETTINGS', {});
    appendEvent('EXPORT_SETTINGS', {
      ok: true,
      hasFileContent: Boolean(response?.fileContent),
    });
    return response;
  }

  async function getSnapshot(options = {}) {
    const rawState = options.state && typeof options.state === 'object'
      ? options.state
      : await getFullState();
    const logLimit = Math.max(1, Math.floor(Number(options.logLimit) || DEFAULT_LOG_LIMIT));
    const eventLimit = Math.max(1, Math.floor(Number(options.eventLimit) || DEFAULT_EVENT_LIMIT));
    const logs = Array.isArray(rawState?.logs) ? rawState.logs : [];
    const logEntries = logs
      .slice(-logLimit)
      .map((entry) => ({
        timestamp: Number(entry?.timestamp) || 0,
        level: String(entry?.level || 'info'),
        step: Number.isFinite(Number(entry?.step)) ? Number(entry.step) : null,
        stepKey: String(entry?.stepKey || ''),
        nodeId: String(entry?.nodeId || ''),
        message: String(entry?.message || ''),
      }));
    const accountRunHistory = Array.isArray(rawState?.accountRunHistory) ? rawState.accountRunHistory : [];
    const accountRunHistoryTail = accountRunHistory.slice(-5).map((entry) => ({
      email: String(entry?.email || entry?.accountIdentifier || ''),
      accountIdentifierType: String(entry?.accountIdentifierType || ''),
      finalStatus: String(entry?.finalStatus || ''),
      failedNodeId: String(entry?.failedNodeId || ''),
      failureDetail: String(entry?.failureDetail || ''),
      finishedAt: Number(entry?.finishedAt || 0) || null,
    }));
    const nodeSummary = summarizeNodeStatuses(rawState?.nodeStatuses || {});

    const snapshot = {
      controller: {
        source: AGENT_SOURCE,
        version: CONTROLLER_VERSION,
        readyAt: state.readyAt,
        generatedAt: Date.now(),
      },
      flow: {
        activeFlowId: String(rawState?.activeFlowId || ''),
        panelMode: String(rawState?.panelMode || ''),
        plusModeEnabled: Boolean(rawState?.plusModeEnabled),
        plusPaymentMethod: String(rawState?.plusPaymentMethod || ''),
        signupMethod: String(rawState?.signupMethod || ''),
        resolvedSignupMethod: String(rawState?.resolvedSignupMethod || ''),
        mailProvider: String(rawState?.mailProvider || ''),
      },
      run: {
        autoRunning: Boolean(rawState?.autoRunning),
        phase: String(rawState?.autoRunPhase || 'idle'),
        currentRun: Number(rawState?.autoRunCurrentRun || 0),
        totalRuns: Number(rawState?.autoRunTotalRuns || 0),
        attemptRun: Number(rawState?.autoRunAttemptRun || 0),
        sessionId: Number(rawState?.autoRunSessionId || 0),
        currentNodeId: String(rawState?.currentNodeId || ''),
        nodeSummary,
      },
      identity: {
        email: rawState?.email || '',
        phoneNumber: rawState?.phoneNumber || '',
        signupPhoneNumber: rawState?.signupPhoneNumber || '',
        accountIdentifierType: String(rawState?.accountIdentifierType || ''),
        accountIdentifier: String(rawState?.accountIdentifier || ''),
        currentHotmailAccountId: rawState?.currentHotmailAccountId || '',
        currentPayPalAccountId: rawState?.currentPayPalAccountId || '',
        currentMail2925AccountId: rawState?.currentMail2925AccountId || '',
      },
      oauth: {
        oauthUrl: rawState?.oauthUrl || '',
        localhostUrl: rawState?.localhostUrl || '',
        deadlineAt: Number(rawState?.oauthFlowDeadlineAt || 0) || null,
      },
      checkout: {
        plusCheckoutUrl: rawState?.plusCheckoutUrl || '',
        plusReturnUrl: rawState?.plusReturnUrl || '',
        hostedCheckoutCurrentSmsEntry: toPlainObject(rawState?.hostedCheckoutCurrentSmsEntry || null),
      },
      browser: {
        automationWindowId: Number.isFinite(Number(rawState?.automationWindowId))
          ? Number(rawState.automationWindowId)
          : null,
        sourceLastUrls: toPlainObject(rawState?.sourceLastUrls || {}),
      },
      history: {
        total: accountRunHistory.length,
        recentRuns: accountRunHistoryTail,
      },
      lastLogEntry: logEntries.length ? logEntries[logEntries.length - 1] : null,
      recentLogs: logEntries,
      recentEvents: state.events
        .slice(-eventLimit)
        .map((entry) => ({
          type: entry.type,
          at: entry.at,
          payload: entry.payload,
        })),
    };

    state.lastSnapshot = snapshot;
    state.lastSnapshotAt = snapshot.controller.generatedAt;
    return snapshot;
  }

  async function captureDiagnostics(options = {}) {
    const fullState = await getFullState();
    const settingsBundle = options.includeSettings === false
      ? null
      : await exportSettings().catch((error) => ({
          error: error?.message || String(error || '导出配置失败'),
        }));

    return {
      snapshot: await getSnapshot({
        state: fullState,
        logLimit: options.logLimit,
        eventLimit: options.eventLimit,
      }),
      settingsBundle,
      fullState: options.includeFullState ? toPlainObject(fullState) : null,
    };
  }

  async function getRecentEvents(limit = DEFAULT_EVENT_LIMIT) {
    const maxItems = Math.max(1, Math.floor(Number(limit) || DEFAULT_EVENT_LIMIT));
    return state.events.slice(-maxItems).map((entry) => ({
      type: entry.type,
      at: entry.at,
      payload: entry.payload,
    }));
  }

  async function renderSnapshot() {
    try {
      const snapshot = await getSnapshot();
      readyBadge.textContent = snapshot.run.autoRunning
        ? `运行中 · ${snapshot.run.phase || 'unknown'}`
        : '就绪';
      statusOutput.textContent = JSON.stringify(snapshot, null, 2);
    } catch (error) {
      readyBadge.textContent = '状态读取失败';
      statusOutput.textContent = JSON.stringify({
        controller: {
          source: AGENT_SOURCE,
          version: CONTROLLER_VERSION,
        },
        error: error?.message || String(error || 'unknown error'),
        recentEvents: state.events.slice(-DEFAULT_EVENT_LIMIT),
      }, null, 2);
    }
  }

  chrome.runtime.onMessage.addListener((message) => {
    switch (message?.type) {
      case 'LOG_ENTRY':
      case 'NODE_STATUS_CHANGED':
      case 'AUTO_RUN_STATUS':
      case 'DATA_UPDATED':
      case 'SECURITY_BLOCKED_ALERT':
        appendEvent(message.type, message.payload || {});
        break;
      default:
        break;
    }
    return false;
  });

  window.GuJumpgateAgentControl = {
    applyProfile,
    captureDiagnostics,
    exportSettings,
    getFullState,
    getRecentEvents,
    getSnapshot,
    resetState,
    resumeRun,
    startRun,
    stopRun,
    takeOverRun,
  };

  appendEvent('READY', {
    source: AGENT_SOURCE,
    version: CONTROLLER_VERSION,
  });
  renderSnapshot();
  setInterval(() => {
    renderSnapshot().catch(() => {});
  }, REFRESH_INTERVAL_MS);
})();
