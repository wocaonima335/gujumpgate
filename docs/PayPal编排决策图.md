# PayPal 编排决策图

本文只聚焦 `plusPaymentMethod=paypal` 这条分支，说明当前项目里：

1. 什么时候会进入 PayPal 编排。
2. PayPal 编排内部有哪些子分支。
3. 每条子分支的节点顺序是什么。
4. hosted checkout 短链和标准长链在执行层是如何落地的。

## 1. 一句话结论

当前 `plusPaymentMethod=paypal` 并不只对应一条流程，而是至少有下面几类：

- `local-cpa-json-no-rt` 专用导出链
- `hosted checkout` 短链
- 标准 PayPal 长链
- `sub2api session import` 尾链
- `cpa session import` 尾链
- 手机号注册链
- 手机号绑定邮箱后重登链

其中最关键的一点是：

**只要 `plusHostedCheckoutIsFinalStep !== false`，默认优先走 hosted checkout 短链。**

## 2. 决策树

```text
plusModeEnabled = true
  -> plusPaymentMethod = paypal
     -> panelMode = local-cpa-json-no-rt
        -> local-cpa-json-no-rt PayPal 专用链
     -> 否则
        -> plusHostedCheckoutIsFinalStep !== false
           -> hosted checkout 短链
        -> plusHostedCheckoutIsFinalStep === false
           -> 标准 PayPal 长链

上述每条链再继续按：
  -> signupMethod = email / phone
  -> plusAccountAccessStrategy = oauth / sub2api_codex_session / cpa_codex_session
  -> phoneSignupReloginAfterBindEmailEnabled = true / false
继续分叉
```

## 3. 第 1 层：PayPal 分支总入口

PayPal 编排的主选择入口在：

- `data/step-definitions.js`
  - `getOpenAiModeStepDefinitions(options)`

它的前置条件是：

- `plusModeEnabled = true`
- `plusPaymentMethod = paypal`

如果 `plusPaymentMethod` 不是 `paypal`，就会转去 `gopay` 或 `gpc-helper` 分支，不再走这里。

## 4. 第 2 层：先看 panelMode

### 4.1 `panelMode = local-cpa-json-no-rt`

这是 PayPal 分支里最优先被拦截的一条特殊链。

节点顺序：

1. `open-chatgpt`
2. `submit-signup-email`
3. `fill-password`
4. `fetch-signup-code`
5. `fill-profile`
6. `plus-checkout-create`
7. `oauth-login`
8. `confirm-oauth`
9. `local-cpa-json-export`

这条链的特点：

- 不走标准 PayPal 长链
- 不出现 `plus-checkout-billing`
- 不出现 `paypal-approve`
- 不出现 `plus-checkout-return`
- 也不走完整 OAuth 尾链

本质上它是：

**用 PayPal hosted checkout 完成支付后，快速进入本地 JSON 导出链。**

## 5. 第 3 层：hosted checkout 短链 vs 标准长链

### 5.1 hosted checkout 短链的判断条件

判断函数：

- `shouldTreatHostedCheckoutAsFinalStep(options)`

条件：

- 必须是 `plusModeEnabled = true`
- 必须是 `plusPaymentMethod = paypal`
- 只要 `plusHostedCheckoutIsFinalStep !== false` 就成立

也就是说：

**默认就是 hosted checkout 短链。**

### 5.2 hosted checkout 短链的邮箱版

这是最常见的 PayPal 编排。

节点顺序：

1. `open-chatgpt`
2. `submit-signup-email`
3. `fill-password`
4. `fetch-signup-code`
5. `fill-profile`
6. `plus-checkout-create`
7. `oauth-login`
8. `fetch-login-code`
9. `confirm-oauth`
10. `platform-verify`

特点：

- `plus-checkout-create` 是最后一个“支付相关主节点”
- 之后直接进入账号接入尾链
- 不再显式出现：
  - `plus-checkout-billing`
  - `paypal-approve`
  - `plus-checkout-return`

### 5.3 hosted checkout 短链为什么能省掉 3 个节点

因为支付相关动作被折叠进了：

- `background/steps/create-plus-checkout.js`
  - hosted checkout 自动化
  - 切到 PayPal
  - 地址填写
  - 验证码弹窗处理
  - 成功页等待
  - 回到 ChatGPT 支付成功页

也就是说：

```text
标准长链里：
  plus-checkout-create
  -> plus-checkout-billing
  -> paypal-approve
  -> plus-checkout-return

hosted 短链里：
  plus-checkout-create
  -> （内部完成 hosted checkout 支付链）
  -> 直接进入 OAuth / session import 尾链
```

### 5.4 标准 PayPal 长链

只有当：

- `plusHostedCheckoutIsFinalStep === false`

才会走标准长链。

邮箱 + OAuth 版节点顺序：

1. `open-chatgpt`
2. `submit-signup-email`
3. `fill-password`
4. `fetch-signup-code`
5. `fill-profile`
6. `plus-checkout-create`
7. `plus-checkout-billing`
8. `paypal-approve`
9. `plus-checkout-return`
10. `oauth-login`
11. `fetch-login-code`
12. `post-login-phone-verification`
13. `confirm-oauth`
14. `platform-verify`

这条链才是“传统意义上你能看到完整 Checkout -> PayPal -> Return” 的那条 PayPal 编排。

## 6. 第 4 层：尾链怎么分

PayPal 前缀之后，尾链继续按 `plusAccountAccessStrategy` 分流。

### 6.1 `plusAccountAccessStrategy = oauth`

这是默认尾链。

#### 邮箱注册

hosted 短链：

1. `plus-checkout-create`
2. `oauth-login`
3. `fetch-login-code`
4. `confirm-oauth`
5. `platform-verify`

标准长链：

1. `plus-checkout-create`
2. `plus-checkout-billing`
3. `paypal-approve`
4. `plus-checkout-return`
5. `oauth-login`
6. `fetch-login-code`
7. `post-login-phone-verification`
8. `confirm-oauth`
9. `platform-verify`

### 6.2 `plusAccountAccessStrategy = sub2api_codex_session`

这时不走 OAuth 确认尾链，而是直接接：

- `sub2api-session-import`

#### hosted 短链

1. `open-chatgpt`
2. `submit-signup-email`
3. `fill-password`
4. `fetch-signup-code`
5. `fill-profile`
6. `plus-checkout-create`
7. `sub2api-session-import`

#### 标准长链

1. `open-chatgpt`
2. `submit-signup-email`
3. `fill-password`
4. `fetch-signup-code`
5. `fill-profile`
6. `plus-checkout-create`
7. `plus-checkout-billing`
8. `paypal-approve`
9. `plus-checkout-return`
10. `sub2api-session-import`

### 6.3 `plusAccountAccessStrategy = cpa_codex_session`

这时尾部改成：

- `cpa-session-import`

#### hosted 短链

1. `open-chatgpt`
2. `submit-signup-email`
3. `fill-password`
4. `fetch-signup-code`
5. `fill-profile`
6. `plus-checkout-create`
7. `cpa-session-import`

#### 标准长链

1. `open-chatgpt`
2. `submit-signup-email`
3. `fill-password`
4. `fetch-signup-code`
5. `fill-profile`
6. `plus-checkout-create`
7. `plus-checkout-billing`
8. `paypal-approve`
9. `plus-checkout-return`
10. `cpa-session-import`

## 7. 第 5 层：手机号注册怎么变

如果：

- `signupMethod = phone`

PayPal 分支还会继续分成两条：

- 普通手机号尾链
- 绑定邮箱后重登尾链

### 7.1 手机号普通尾链

#### hosted 短链

1. `open-chatgpt`
2. `submit-signup-email`
3. `fill-password`
4. `fetch-signup-code`
5. `fill-profile`
6. `plus-checkout-create`
7. `oauth-login`
8. `fetch-login-code`
9. `bind-email`
10. `fetch-bind-email-code`
11. `confirm-oauth`
12. `platform-verify`

#### 标准长链

1. `open-chatgpt`
2. `submit-signup-email`
3. `fill-password`
4. `fetch-signup-code`
5. `fill-profile`
6. `plus-checkout-create`
7. `plus-checkout-billing`
8. `paypal-approve`
9. `plus-checkout-return`
10. `oauth-login`
11. `fetch-login-code`
12. `bind-email`
13. `fetch-bind-email-code`
14. `confirm-oauth`
15. `platform-verify`

### 7.2 手机号绑定邮箱后重登尾链

如果：

- `phoneSignupReloginAfterBindEmailEnabled = true`

则尾链会拉长。

#### hosted 短链

1. `open-chatgpt`
2. `submit-signup-email`
3. `fill-password`
4. `fetch-signup-code`
5. `fill-profile`
6. `plus-checkout-create`
7. `oauth-login`
8. `fetch-login-code`
9. `bind-email`
10. `fetch-bind-email-code`
11. `relogin-bound-email`
12. `fetch-bound-email-login-code`
13. `confirm-oauth`
14. `platform-verify`

#### 标准长链

1. `open-chatgpt`
2. `submit-signup-email`
3. `fill-password`
4. `fetch-signup-code`
5. `fill-profile`
6. `plus-checkout-create`
7. `plus-checkout-billing`
8. `paypal-approve`
9. `plus-checkout-return`
10. `oauth-login`
11. `fetch-login-code`
12. `bind-email`
13. `fetch-bind-email-code`
14. `relogin-bound-email`
15. `fetch-bound-email-login-code`
16. `post-bound-email-phone-verification`
17. `confirm-oauth`
18. `platform-verify`

## 8. 执行器映射

### 8.1 支付相关节点

当真正进入标准 PayPal 长链时，关键节点映射如下：

- `plus-checkout-create`
  - `create-plus-checkout.js`
- `plus-checkout-billing`
  - `fill-plus-checkout.js`
- `paypal-approve`
  - `paypal-approve.js`
- `plus-checkout-return`
  - `plus-return-confirm.js`

### 8.2 一个容易忽略的点

`paypal-approve` 这个节点名是通用名，但执行时会再按 `plusPaymentMethod` 分派：

- `plusPaymentMethod = gopay`
  - 实际走 GoPay approve 执行器
- `plusPaymentMethod = paypal`
  - 才走 `paypal-approve.js`

所以在本文讨论的前提下：

**只有 `plusPaymentMethod=paypal` 时，`paypal-approve` 才真的是 PayPal 节点。**

## 9. hosted 短链在执行层的真实落地方式

这里有一个很重要、也很容易误会的实现细节：

- 步骤定义层里，确实存在 hosted checkout 的“短 workflow”
- 但执行器 registry 层并没有单独做一套 `hosted PayPal registry`

当前执行层仍然主要复用：

- `plusPayPalStepRegistry`
- `plusPayPalPhoneStepRegistry`
- `plusPayPalSub2ApiSessionStepRegistry`
- `plusPayPalCpaSessionStepRegistry`

之所以还能正常跑，是因为：

1. hosted 短链使用的节点集合，本质上是标准长链的子集
2. 真正被“省掉”的节点是：
   - `plus-checkout-billing`
   - `paypal-approve`
   - `plus-checkout-return`
3. 自动运行的 workflow 图本身已经不再把这三个节点串进来
4. 同时在执行层，对 `plus-checkout-create` 又有 hosted 特判

这个特判体现在：

- `isHostedCheckoutUploadCompletionNode(nodeId, state)`

它会把：

- `plus-checkout-create`

视为 hosted 支付链的完成信号节点，并给予更长的等待窗口。

所以 hosted 短链不是通过“新建一套新的支付节点执行器”实现的，而是通过：

- 更短的 workflow 图
- `plus-checkout-create` 节点内部自动化
- completion signal 特判

共同实现的。

## 10. 最常见实际情况

如果你当前只是普通设置：

- `plusModeEnabled = true`
- `plusPaymentMethod = paypal`

并且没有显式关闭：

- `plusHostedCheckoutIsFinalStep`

那么当前实际更大概率走的是：

### 默认 hosted checkout 邮箱短链

1. `open-chatgpt`
2. `submit-signup-email`
3. `fill-password`
4. `fetch-signup-code`
5. `fill-profile`
6. `plus-checkout-create`
7. `oauth-login`
8. `fetch-login-code`
9. `confirm-oauth`
10. `platform-verify`

而不是标准长链。

## 11. 最终总结

如果只记住一件事，记住这句：

**`plusPaymentMethod=paypal` 默认不是“显式 PayPal 授权页长链”，而是“hosted checkout 完成支付后再接账号接入尾链”的短链。**

只有在明确把：

- `plusHostedCheckoutIsFinalStep = false`

时，才会切回：

- `plus-checkout-billing`
- `paypal-approve`
- `plus-checkout-return`

这条标准 PayPal 长链。
