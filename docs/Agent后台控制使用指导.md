# Agent 后台控制使用指导

本文面向“外部 Agent / 自动化 Runner / 无头浏览器控制器”的使用者，目标是说明如何在不依赖 sidepanel DOM、不手写旧消息协议、不反复拼临时探针脚本的前提下，稳定控制当前项目执行自动流程。

如果你的目标是：

- 让 Agent 在后台驱动浏览器跑完整注册或 Plus 流程
- 让 Runner 只读取结构化状态，而不是抓 UI 文本
- 降低 `check-* / click-*` 一类脚本带来的噪音
- 在失败时拿到统一的诊断数据

那么请优先使用本文描述的控制链路，而不是继续直接操作 `sidepanel/sidepanel.html` 或旧的 `START_AUTO_RUN` 消息。

## 1. 推荐控制链路

当前推荐链路如下：

1. 外部进程启动 Chrome，并加载扩展。
2. 外部进程打开 `chrome-extension://<extension-id>/agent-control.html`。
3. `agent-control.js` 在页面上下文暴露 `window.GuJumpgateAgentControl.*`。
4. 外部进程只调用统一方法，例如：
   - `applyProfile(...)`
   - `getWorkflowNodes()`
   - `getFlowPresets()`
   - `executeNode(...)`
   - `executeNodeSequence(...)`
   - `runFlowPreset(...)`
   - `startRun(...)`
   - `stopRun()`
   - `getSnapshot(...)`
   - `captureDiagnostics(...)`
5. `agent-control.js` 再向后台发送已有 runtime message，例如：
   - `SAVE_SETTING`
   - `AUTO_RUN`
   - `STOP_FLOW`
   - `GET_STATE`
6. 后台继续复用现有步骤引擎、自动运行控制器、内容脚本、邮件 provider、支付页逻辑。

这条链路的核心思想是：

- 浏览器控制和业务流程解耦
- Runner 只做“开浏览器、调 API、读快照”
- 业务流程仍然由扩展后台和内容脚本负责

## 2. 关键入口

### 2.1 控制页

- `agent-control.html`
- `agent-control.js`

职责：

- 提供机器使用的稳定控制面
- 不承载人工配置 UI
- 不要求 Runner 理解 sidepanel 的按钮、输入框、弹窗
- 缓存近期结构化事件，便于外部控制器快速取状态

### 2.2 CDP 控制器

- `cdp-controller.js`

适用场景：

- 已经有一个带 `9222` 调试端口的 Chrome
- 需要从外部脚本快速注入 profile、启动流程、抓诊断
- 不想自己处理 CDP target 查找和控制页初始化

### 2.3 无头运行器

- `run-headless.js`

适用场景：

- 需要从零启动无头 Chrome
- 需要一次性完成“启动浏览器 + 加载扩展 + 注入 profile + 启动自动运行 + 轮询结果”
- 需要失败时自动落地诊断 JSON 和截图

## 3. 前置条件

在开始之前，请确认：

1. Chrome 能以远程调试模式运行，端口为 `9222`。
2. 扩展目录就是当前仓库根目录。
3. 如果使用 Hotmail 本地 helper，helper 服务已经启动。
4. 如果使用本地 JSON 导出模式，目标输出目录可写。
5. 需要的账号池、支付账号、接码配置已准备好。

常见相关路径：

- 扩展根目录：当前仓库根目录
- Agent 控制页：`chrome-extension://<extension-id>/agent-control.html`
- 默认无头认证输出目录：`/root/GuJumpgate/data/auth-output`

## 4. 推荐使用方式

### 4.1 方式 A：使用 `cdp-controller.js`

适合已有 Chrome 会话的场景。

如果当前执行任务的 Agent 明确 **不能使用无头浏览器**，请固定使用这一条链路，不要改走 `run-headless.js`。

推荐方式：

1. 先手动或外部工具启动一个带扩展的 Chrome，并开放 `9222` 调试端口。
2. 再用 `cdp-controller.js` 打开 `agent-control.html`、注入 profile、启动流程。

手机号注册参考 sample：

```powershell
node cdp-controller.js config .\docs\agent-phone-register.sample.json
node cdp-controller.js start
```

这份 sample 的目标是：

- 强制走 `signupMethod=phone`
- 开启接码能力
- 关闭 `plusModeEnabled`
- 关闭“绑定邮箱后重登”补链
- 让 Agent 只走“普通手机号注册链”

查看当前结构化状态：

```powershell
node cdp-controller.js status
```

注入 profile：

```powershell
node cdp-controller.js config profile.json
```

启动自动流程：

```powershell
node cdp-controller.js start
```

查看近期事件：

```powershell
node cdp-controller.js events 20
```

抓完整诊断：

```powershell
node cdp-controller.js diag
```

停止流程：

```powershell
node cdp-controller.js stop
```

接管自动流程，切回手动：

```powershell
node cdp-controller.js takeover
```

抓控制页截图：

```powershell
node cdp-controller.js screenshot .\\agent-control.png
```

查看当前模式下的可用节点：

```powershell
node cdp-controller.js workflow
```

只执行单个节点：

```powershell
node cdp-controller.js node plus-checkout-create
```

按自定义顺序执行节点序列：

```powershell
node cdp-controller.js sequence "[\"open-chatgpt\",\"submit-signup-email\",\"fill-password\"]"
```

执行内置流程预设：

```powershell
node cdp-controller.js preset register_only
node cdp-controller.js preset paypal_only
node cdp-controller.js preset register_plus_paypal
```

### 4.2 方式 B：使用 `run-headless.js`

适合需要直接由 Runner 启动无头浏览器的场景。

示例：

```powershell
node run-headless.js --config=headless-profile.json
```

或者直接用命令行参数：

```powershell
node run-headless.js ^
  --panelMode=local-cpa-json-no-rt ^
  --mailProvider=hotmail ^
  --signupMethod=email ^
  --plusModeEnabled=true ^
  --plusPaymentMethod=paypal ^
  --hotmailEmail=example@outlook.com ^
  --hotmailPassword=example-password ^
  --hotmailClientId=example-client-id ^
  --hotmailRefreshToken=example-refresh-token ^
  --paypalEmail=paypal@example.com ^
  --paypalPassword=paypal-password ^
  --fiveSimApiKey=example-5sim-key ^
  --phoneSmsProvider=5sim ^
  --pluginDir=/root/GuJumpgate/data/auth-output
```

`run-headless.js` 当前行为：

1. 启动 Chrome
2. 加载扩展
3. 打开 `agent-control.html`
4. 调用 `applyProfile(...)`
5. 调用 `startRun(...)`
6. 按固定间隔轮询 `getSnapshot(...)`
7. 成功时优先判断是否产生新认证文件
8. 失败时自动输出诊断 JSON 和截图

### 4.3 方式 C：只跑指定流程 / 自定义流程

如果你不想直接启动整条自动链，而是希望 Agent 只执行：

- 注册流程
- PayPal 流程
- 你自己定义的节点序列

那么应优先使用：

- `getWorkflowNodes()`
- `executeNode(...)`
- `executeNodeSequence(...)`
- `runFlowPreset(...)`

而不是直接调用 `startRun(...)`。

#### 4.3.1 先查看当前可用节点

无论你想只跑注册、只跑 PayPal，还是拼自定义链，第一步都建议先看：

```powershell
node cdp-controller.js workflow
```

它会返回当前状态下可执行的节点列表，例如：

- `open-chatgpt`
- `submit-signup-email`
- `fill-password`
- `fetch-signup-code`
- `fill-profile`
- `wait-registration-success`
- `plus-checkout-create`
- `plus-checkout-billing`
- `paypal-approve`
- `plus-checkout-return`
- `oauth-login`
- `fetch-login-code`
- `confirm-oauth`
- `platform-verify`

注意：

- 节点列表是**当前模式下**的结果。
- 如果你切了 `panelMode / plusModeEnabled / plusPaymentMethod / signupMethod`，这里的节点会跟着变。

#### 4.3.2 只执行注册流程

适用目标：

- 只想跑注册，不进入 Plus / PayPal。

推荐前置设置：

- `plusModeEnabled=false`
- `signupMethod=email` 或 `signupMethod=phone`
- 接码、邮箱 provider 等配置已准备好

内置预设：

```powershell
node cdp-controller.js preset register_only
```

等价节点序列：

```json
[
  "open-chatgpt",
  "submit-signup-email",
  "fill-password",
  "fetch-signup-code",
  "fill-profile",
  "wait-registration-success"
]
```

如果你的 Agent 已能直接调用扩展页方法，也可以这样：

```js
await window.GuJumpgateAgentControl.executeNodeSequence([
  'open-chatgpt',
  'submit-signup-email',
  'fill-password',
  'fetch-signup-code',
  'fill-profile',
  'wait-registration-success'
]);
```

#### 4.3.3 只执行 PayPal 流程

适用目标：

- 注册已经完成
- 当前账号已经登录到 ChatGPT
- 只想执行 Plus / PayPal 支付链

推荐前置设置：

- `plusModeEnabled=true`
- `plusPaymentMethod=paypal`
- 当前浏览器会话中应已满足支付链的前置状态
- 如果你想要完整 PayPal 长链，应确保不是 hosted checkout 短链场景

内置预设：

```powershell
node cdp-controller.js preset paypal_only
```

等价节点序列：

```json
[
  "plus-checkout-create",
  "plus-checkout-billing",
  "paypal-approve",
  "plus-checkout-return"
]
```

如果你想单步调试，也可以逐个执行：

```powershell
node cdp-controller.js node plus-checkout-create
node cdp-controller.js node plus-checkout-billing
node cdp-controller.js node paypal-approve
node cdp-controller.js node plus-checkout-return
```

#### 4.3.4 注册 + PayPal 一起执行，但不跑后续 OAuth / 平台接入

适用目标：

- 只想打通注册 + 支付，不继续跑 `oauth-login / confirm-oauth / platform-verify`

内置预设：

```powershell
node cdp-controller.js preset register_plus_paypal
```

等价节点序列：

```json
[
  "open-chatgpt",
  "submit-signup-email",
  "fill-password",
  "fetch-signup-code",
  "fill-profile",
  "plus-checkout-create",
  "plus-checkout-billing",
  "paypal-approve",
  "plus-checkout-return"
]
```

#### 4.3.5 完全自定义流程

如果你希望 Agent 自己组合流程，可以直接传一个节点数组。

示例：

```powershell
node cdp-controller.js sequence "{\"nodeIds\":[\"open-chatgpt\",\"submit-signup-email\",\"fill-password\"],\"options\":{\"interNodeDelayMs\":1200}}"
```

如果直接调用扩展页 API：

```js
await window.GuJumpgateAgentControl.executeNodeSequence(
  ['open-chatgpt', 'submit-signup-email', 'fill-password'],
  {
    interNodeDelayMs: 1200,
    stopOnError: true
  }
);
```

#### 4.3.6 为什么推荐 `executeNodeSequence(...)` 而不是手工拼旧消息

因为它有几个好处：

- 统一走 `agent-control` 协议层
- 每执行一个节点后都能回读结构化 `snapshot`
- 默认关闭 `plus-checkout-create` 的自动续跑，避免“只想测单节点，却意外继续跑到下游”
- 比直接拼 `chrome.runtime.sendMessage(...)` 更稳定，也更便于后续扩展

## 5. Profile 格式

推荐使用一个显式 profile JSON，而不是继续依赖大量零散 CLI 参数。

最小示例：

```json
{
  "settings": {
    "panelMode": "local-cpa-json-no-rt",
    "mailProvider": "hotmail",
    "signupMethod": "email",
    "plusModeEnabled": true,
    "plusPaymentMethod": "paypal",
    "phoneVerificationEnabled": true,
    "phoneSmsProvider": "5sim",
    "fiveSimApiKey": "your-5sim-api-key",
    "fiveSimCountryId": "argentina",
    "fiveSimCountryLabel": "Argentina",
    "hotmailServiceMode": "local",
    "hotmailLocalBaseUrl": "http://127.0.0.1:17373",
    "accountRunHistoryHelperBaseUrl": "http://127.0.0.1:17373",
    "accountRunHistoryTextEnabled": true,
    "localCpaJsonPluginDir": "/root/GuJumpgate/data/auth-output"
  },
  "hotmailAccounts": [
    {
      "email": "example@outlook.com",
      "password": "hotmail-password",
      "clientId": "hotmail-client-id",
      "refreshToken": "hotmail-refresh-token",
      "status": "authorized",
      "enabled": true,
      "used": false
    }
  ],
  "selectHotmailEmail": "example@outlook.com",
  "paypalAccounts": [
    {
      "email": "paypal@example.com",
      "password": "paypal-password",
      "enabled": true
    }
  ],
  "selectPayPalEmail": "paypal@example.com"
}
```

### 5.1 `settings` 常用字段

- `panelMode`
  - 常见值：`local-cpa-json-no-rt`、`cpa`、`sub2api`、`codex2api`
- `mailProvider`
  - 常见值：`hotmail`、`mail2925`、`gmail`、`custom`
- `signupMethod`
  - `email` 或 `phone`
- `plusModeEnabled`
  - 是否启用 Plus 模式
- `plusPaymentMethod`
  - 常见值：`paypal`、`gopay`、`gpc-helper`
- `phoneVerificationEnabled`
  - 是否启用接码能力
- `phoneSmsProvider`
  - 常见值：`hero-sms`、`5sim`、`nexsms`
- `localCpaJsonPluginDir`
  - 本地 JSON 导出目录

### 5.2 账号池字段

- `hotmailAccounts`
  - Hotmail / Outlook 账号池
- `selectHotmailEmail`
  - 本次默认选中的 Hotmail 账号
- `paypalAccounts`
  - PayPal 账号池
- `selectPayPalEmail`
  - 本次默认选中的 PayPal 账号
- `mail2925Accounts`
  - 2925 账号池
- `selectMail2925Email`
  - 本次默认选中的 2925 账号

### 5.3 运行态字段

通常只有在你明确要覆盖运行时身份时才传：

- `email`
  - 当前注册邮箱
- `signupPhoneNumber`
  - 当前注册手机号

如果没有这类需求，建议不要传空字符串去覆盖运行态。

## 6. `getSnapshot()` 的作用

`getSnapshot()` 是 Agent 推荐的主状态接口。

它返回的是低噪音结构化摘要，而不是完整 `chrome.storage`。

重点字段包括：

- `controller`
  - 控制页版本、生成时间
- `flow`
  - 当前 flow、panel mode、注册方式、Plus 模式
- `run`
  - `autoRunning`
  - `phase`
  - `currentRun`
  - `totalRuns`
  - `attemptRun`
  - `currentNodeId`
  - `nodeSummary`
- `identity`
  - 当前邮箱、手机号、账号身份
- `oauth`
  - `oauthUrl`
  - `localhostUrl`
  - `deadlineAt`
- `checkout`
  - `plusCheckoutUrl`
  - `plusReturnUrl`
- `browser`
  - `automationWindowId`
  - `sourceLastUrls`
- `history`
  - 近期账号运行历史摘要
- `recentLogs`
  - 最近若干条结构化日志
- `recentEvents`
  - 最近若干条控制页缓存事件

推荐策略：

- 日常轮询只看 `getSnapshot()`
- 只有在失败或卡住时，再补 `captureDiagnostics()`

## 7. `captureDiagnostics()` 的作用

`captureDiagnostics()` 适合以下场景：

- 自动流程停了，但原因不明确
- 状态看起来成功，实际没有产出认证文件
- 需要把诊断结果落地成 JSON 供人工复盘

它会返回：

- `snapshot`
  - 当前结构化摘要
- `settingsBundle`
  - 当前导出配置
- `fullState`
  - 可选的完整后台状态

建议：

- 线上常规巡检只用 `snapshot`
- 只有异常时才打开 `includeFullState`

## 8. 常见使用建议

### 8.1 优先用统一入口

推荐优先级：

1. `run-headless.js`
2. `cdp-controller.js`
3. 直接调用 `window.GuJumpgateAgentControl.*`

不推荐继续依赖：

- 直接注入 sidepanel DOM
- 直接发送旧的 `START_AUTO_RUN`
- 到处拼 `check-* / click-*` 脚本组合状态

### 8.2 尽量只让 Runner 处理浏览器生命周期

Runner 建议只做这些事：

- 启动浏览器
- 打开控制页
- 注入 profile
- 启动自动运行
- 轮询快照
- 落地诊断

不要让 Runner 重新实现：

- PayPal 选择逻辑
- Checkout 页面交互
- OAuth 登录流程
- 邮箱验证码流程
- 内容脚本 READY / COMPLETE / ERROR 协议

### 8.3 失败时不要第一时间全量扫页面

更建议的排障顺序：

1. `getSnapshot()`
2. `captureDiagnostics()`
3. 必要时截图
4. 最后才去看页面 DOM 或临时探针脚本

这样噪音最小，也更容易稳定复现。

## 9. 常见故障判断

### 9.1 Runner 显示成功，但没有新认证文件

如果当前模式是本地 JSON 导出，而流程看起来成功但没有新文件，这通常不应该被算作真正成功。

当前 `run-headless.js` 已经把这种情况视为失败，并返回：

- `history_success_but_no_auth_file`

建议排查：

- `panelMode` 是否正确
- `localCpaJsonPluginDir` 是否正确
- 目录是否可写
- 是否把输出落到了旧目录

### 9.2 快照显示 `autoRunning=false`，但没有成功记录

优先看：

- `snapshot.history.recentRuns`
- `snapshot.run.currentNodeId`
- `snapshot.lastLogEntry`
- `diagnostics.fullState.logs`

通常能快速判断是：

- 被用户停止
- 节点失败
- OAuth 后链超时
- 页面卡在某个 provider

### 9.3 账号池注入了，但流程没选中你想要的账号

优先检查：

- `selectHotmailEmail`
- `selectPayPalEmail`
- `selectMail2925Email`

如果只注入账号数组、不提供显式默认选择，控制页会按你传入的规则选中已有匹配账号；不匹配时可能保持当前已有选择。

## 10. 推荐实践

### 10.1 先固定 profile，再跑流程

建议把 profile 文件单独保存，而不是每次用一长串命令行参数手敲。

如果你的链路需要按国家切换浏览器指纹，可直接参考 [fingerprintProfile标准配置模板](./fingerprintProfile标准配置模板.md)。

优点：

- 易复用
- 易回放
- 易对比
- 易做失败归档

### 10.2 成功和失败都保留最小证据

建议至少保留：

- 启动时使用的 profile
- 最后一份 `snapshot`
- 失败时的 diagnostics JSON
- 控制页截图

### 10.3 新接入 Runner 时先做小流量烟测

建议先跑：

- `totalRuns = 1`
- 已知可用的 Hotmail 账号
- 已知可用的 PayPal 账号
- 明确可写的本地输出目录

先把链路打通，再扩大轮次。

## 11. 不建议继续做的事情

以下方式目前不推荐再作为主入口：

- 通过 sidepanel 页面直接写 `chrome.storage.local`
- 外部脚本继续发送 `START_AUTO_RUN`
- 用多个 `check-* / click-*` 脚本拼运行状态
- 让 Agent 直接理解 Stripe/PayPal DOM 后自行做业务判断

这些方式不是完全不能用，而是已经不适合作为主控制面。

## 12. 一句话总结

当前项目的 Agent 控制最佳实践是：

**让 Runner 负责浏览器，让 `agent-control` 负责协议，让扩展后台负责业务。**
