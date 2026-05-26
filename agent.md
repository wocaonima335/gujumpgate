# agent.md

本文件面向“执行任务的大模型 / 外部 Agent / 自动化 Runner”。

目标只有一个：

**通过 `agent-control` 这条机器控制链路执行项目任务，不要再直接依赖 sidepanel DOM、旧消息协议或零散探针脚本。**

说明：

- 如果你所在的平台只会自动发现 `AGENTS.md`，可以把本文件复制或重命名为 `AGENTS.md` 再使用。
- 如果平台允许显式传入自定义指令文件，优先直接加载本文件。

## 1. 你的角色

你不是在“人工点页面”，而是在“驱动一套已有执行内核”。

这个仓库已经有完整的执行内核：

- 后台入口：`background.js`
- 消息路由：`background/message-router.js`
- 自动运行控制器：`background/auto-run-controller.js`
- 工作流引擎：`background/workflow-engine.js`
- 标签页与内容脚本运行时：`background/tab-runtime.js`
- 步骤执行器：`background/steps/*.js`
- 内容脚本驱动层：`content/*.js`

你的正确工作方式是：

1. 连接浏览器
2. 打开 `agent-control.html`
3. 调用 `window.GuJumpgateAgentControl.*`
4. 读取结构化快照
5. 只在需要时抓诊断

而不是：

- 自己重新实现 PayPal / Checkout / OAuth DOM 自动化
- 直接操作 sidepanel 上的按钮和输入框
- 继续发送旧的 `START_AUTO_RUN`
- 用多个 `check-* / click-*` 脚本拼装状态

## 2. 首选控制链路

优先级固定如下：

1. `run-headless.js`
2. `cdp-controller.js`
3. 直接调用 `window.GuJumpgateAgentControl.*`

首选控制面：

- `agent-control.html`
- `agent-control.js`

它负责暴露稳定的机器 API，不承载人工配置 UI。

## 3. 允许调用的方法

优先使用以下方法：

- `applyProfile(profile)`
- `startRun(options)`
- `stopRun()`
- `resumeRun(options)`
- `takeOverRun()`
- `getSnapshot(options)`
- `captureDiagnostics(options)`
- `getRecentEvents(limit)`
- `exportSettings()`

如果你走外部控制器，则优先用：

```powershell
node cdp-controller.js status
node cdp-controller.js config profile.json
node cdp-controller.js start
node cdp-controller.js stop
node cdp-controller.js diag
node cdp-controller.js events 20
```

如果当前 Agent 明确不能使用无头浏览器：

- 不要走 `run-headless.js`
- 固定使用“已打开 Chrome + `cdp-controller.js` + `agent-control.html`”这条链
- 手机号注册可直接参考：
  - `docs/agent-phone-register.sample.json`

如果你需要从零启动无头 Chrome，则优先用：

```powershell
node run-headless.js --config=headless-profile.json
```

## 4. 标准执行顺序

执行任务时，按下面顺序：

1. 先确认浏览器与扩展可用。
2. 打开 `chrome-extension://<extension-id>/agent-control.html`。
3. 调用 `applyProfile(...)` 注入配置。
4. 调用 `getSnapshot()` 确认当前状态与配置已经生效。
5. 调用 `startRun(...)` 启动流程。
6. 轮询 `getSnapshot()`，不要优先扫页面 DOM。
7. 出现异常时，调用 `captureDiagnostics(...)`。
8. 只有在明确需要人工接管时，才调用 `takeOverRun()` 或 `stopRun()`。

## 5. 状态读取规则

日常只读结构化状态，不直接猜页面状态。

优先看：

- `snapshot.run.phase`
- `snapshot.run.currentNodeId`
- `snapshot.run.nodeSummary`
- `snapshot.lastLogEntry`
- `snapshot.history.recentRuns`
- `snapshot.browser.sourceLastUrls`

不要优先做的事：

- 先打开 sidepanel 读文本
- 先去 Stripe / PayPal 页面抓 DOM
- 先扫描 `check-*` 输出

正确排障顺序：

1. `getSnapshot()`
2. `captureDiagnostics()`
3. 截图
4. 最后才看页面 DOM

## 6. 成功判定

不同模式的成功判定不同，但有一条总原则：

**不要因为页面看起来成功，就立即判定任务成功。**

特别是本地 JSON 导出模式：

- 如果流程显示成功，但没有生成新的认证文件，不应算真正成功。
- 当前 `run-headless.js` 已把这类情况视为失败，并标记为 `history_success_but_no_auth_file`。

## 7. 停止与中断语义

你必须区分下面三种情况：

1. `用户停止`
2. `内部恢复中断`
3. `Service Worker 会话失活`

解释：

- `用户停止`：通常来自人工或显式的 `stopRun() / STOP_FLOW`
- `内部恢复中断`：后台为了自动重试、自动恢复、watchdog 重开而主动中断当前页面动作
- `Service Worker 会话失活`：SW 被回收后，旧执行会话失效，再由恢复逻辑接管

要求：

- 不要把内部恢复中断误报成“用户停止”
- 不要把 SW 会话失活误报成“用户主动停止”
- 如果日志或快照显示是内部恢复中断，优先等待自动恢复逻辑接管，不要立刻人工接管

## 8. 禁止事项

除非任务明确要求，否则禁止：

- 直接操作 `sidepanel/sidepanel.html` 的 DOM
- 直接写 `chrome.storage.local` 绕过 `agent-control`
- 自己复刻 PayPal / Checkout / OAuth 页面逻辑
- 继续使用旧的 `START_AUTO_RUN`
- 用 `check-* / click-*` 作为主控制入口
- 看到流程停下就立刻判定为“用户停止”

## 9. 推荐输入

推荐让调用方始终给你一份显式 profile：

- `settings`
- `hotmailAccounts`
- `selectHotmailEmail`
- `paypalAccounts`
- `selectPayPalEmail`
- 可选的 `mail2925Accounts`
- 必要时的 `email / signupPhoneNumber`

不要默认用一大串零散命令行参数推断业务意图，除非外部 runner 只提供这种方式。

## 10. 必读文档

开始执行前，至少参考这些文件：

- `docs/Agent后台控制使用指导.md`
- `项目完整链路说明.md`
- `项目文件结构说明.md`
- `项目开发规范（AI协作）.md`

如果任务涉及架构边界，再补读：

- `docs/多注册流程架构边界.md`
- `docs/多注册流程来源与驱动注册设计.md`
- `docs/多注册流程状态迁移设计.md`

## 11. 一句话原则

**让 Runner 负责浏览器，让 `agent-control` 负责协议，让扩展后台负责业务。**
