# fingerprintProfile 标准配置模板

本文面向通过 `agent-control` 链路控制项目的调用方，目标是给出一份可直接复用的 `fingerprintProfile` 标准模板，并按以下三个典型场景给出配置示例：

- `US 注册`
- `JP 长链`
- `US 付款`

适用入口：

- `node run-headless.js --config=...`
- `node cdp-controller.js config ...`
- `window.GuJumpgateAgentControl.applyProfile(profile)`

## 1. 放置位置

`fingerprintProfile` 应放在 profile 的 `settings` 下：

```jsonc
{
  "settings": {
    "panelMode": "local-cpa-json-no-rt",
    "mailProvider": "hotmail",
    "signupMethod": "email",
    "plusModeEnabled": true,
    "plusPaymentMethod": "paypal",
    "fingerprintProfile": {
      "enabled": true,
      "mode": "proxy_region",
      "countryCode": "US"
    }
  }
}
```

也兼容直接放在 profile 根上：

```jsonc
{
  "fingerprintProfile": {
    "enabled": true,
    "mode": "proxy_region",
    "countryCode": "US"
  },
  "settings": {
    "panelMode": "local-cpa-json-no-rt"
  }
}
```

但推荐优先使用 `settings.fingerprintProfile`，这样更符合当前 profile 的组织方式。

## 2. 字段说明

常用字段如下：

- `enabled`
  - 是否启用指纹一致性注入。
- `mode`
  - `proxy_region`：优先跟随当前代理出口地区。
  - `preset`：直接按 `countryCode` 走国家预设。
  - `custom`：完全使用显式传入的语言、时区、定位、屏幕等字段。
- `countryCode`
  - 两位国家代码，例如 `US`、`JP`、`DE`。
  - 在 `proxy_region` 模式下，它是“出口地区缺失时的回退值”。
- `locale`
  - 例如 `en-US`、`ja-JP`。
- `languages`
  - 例如 `["en-US", "en"]`。
- `acceptLanguage`
  - 例如 `en-US,en;q=0.9`。
- `timezone`
  - 例如 `America/New_York`、`Asia/Tokyo`。
- `latitude` / `longitude` / `accuracy`
  - 页面 `geolocation` 与定位权限相关的返回值。
- `platform`
  - 当前建议固定用 `Win32`，与常规 Chrome 桌面环境更一致。
- `hardwareConcurrency`
  - 例如 `8`。
- `deviceMemory`
  - 例如 `8`。
- `maxTouchPoints`
  - 桌面环境一般为 `0`。
- `screen`
  - 屏幕尺寸与像素比。
- `webglVendor` / `webglRenderer`
  - WebGL 伪装信息。
- `canvasNoise`
  - Canvas 轻量稳定噪声幅度。
- `audioNoise`
  - Audio 轻量稳定噪声幅度。
- `seed`
  - 稳定噪声种子。相同种子会得到相同噪声形态。
- `grantGeolocation`
  - 是否把地理位置权限模拟为允许。
- `reportToAgentControl`
  - 是否将运行态上报到 `agent-control` 快照。

## 3. 标准最小模板

这是当前最推荐的“最小可用模板”。它的核心思想是：

- 浏览器语言和地理参数跟随代理出口地区。
- 如果出口地区当前还没探测出来，则回退到 `countryCode`。
- 只覆盖真正需要稳定的关键字段，不把模板写得过度臃肿。

```jsonc
{
  "settings": {
    "fingerprintProfile": {
      "enabled": true,
      "mode": "proxy_region",
      "countryCode": "US",
      "platform": "Win32",
      "hardwareConcurrency": 8,
      "deviceMemory": 8,
      "maxTouchPoints": 0,
      "screen": {
        "width": 1920,
        "height": 1080,
        "availWidth": 1920,
        "availHeight": 1040,
        "colorDepth": 24,
        "pixelDepth": 24,
        "devicePixelRatio": 1
      },
      "canvasNoise": 0.12,
      "audioNoise": 0.00002,
      "seed": "gujumpgate-default-us",
      "grantGeolocation": true,
      "reportToAgentControl": true
    }
  }
}
```

适用场景：

- 你已经启用了项目内 IP 代理模块。
- 你希望语言、时区、定位尽量跟当前代理出口国家一致。
- 你不想为每个国家都手写一套完整 `custom` 配置。

## 4. 场景示例

### 4.1 US 注册

推荐思路：

- 如果注册阶段本身就走 US 出口，优先用 `proxy_region`。
- 这样当后台代理出口探测稳定返回 `US` 时，语言、时区和地理位置会自动落到美国预设。
- 如果暂时还没有出口探测结果，也会回退到 `countryCode=US`。

```jsonc
{
  "settings": {
    "panelMode": "local-cpa-json-no-rt",
    "mailProvider": "hotmail",
    "signupMethod": "email",
    "plusModeEnabled": true,
    "plusPaymentMethod": "paypal",
    "fingerprintProfile": {
      "enabled": true,
      "mode": "proxy_region",
      "countryCode": "US",
      "platform": "Win32",
      "hardwareConcurrency": 8,
      "deviceMemory": 8,
      "maxTouchPoints": 0,
      "screen": {
        "width": 1920,
        "height": 1080,
        "availWidth": 1920,
        "availHeight": 1040,
        "colorDepth": 24,
        "pixelDepth": 24,
        "devicePixelRatio": 1
      },
      "webglVendor": "Google Inc. (Intel)",
      "webglRenderer": "ANGLE (Intel, Intel(R) UHD Graphics Direct3D11 vs_5_0 ps_5_0)",
      "canvasNoise": 0.12,
      "audioNoise": 0.00002,
      "seed": "us-register-v1",
      "grantGeolocation": true,
      "reportToAgentControl": true
    }
  }
}
```

建议：

- 如果你的注册出口经常在美国不同州切换，这个模板足够。
- 如果你明确知道代理出口更偏西海岸，可以在付款阶段切到后面的 `US 付款` 自定义模板。

### 4.2 JP 长链

这个场景更适合用 `preset` 或 `proxy_region + JP 回退`。如果你“拿长链”这一步明确是 JP 出口，且想让语言、时区、定位更强地对齐日本，推荐直接用 `preset`。

```jsonc
{
  "settings": {
    "fingerprintProfile": {
      "enabled": true,
      "mode": "preset",
      "countryCode": "JP",
      "platform": "Win32",
      "hardwareConcurrency": 8,
      "deviceMemory": 8,
      "maxTouchPoints": 0,
      "screen": {
        "width": 1920,
        "height": 1080,
        "availWidth": 1920,
        "availHeight": 1040,
        "colorDepth": 24,
        "pixelDepth": 24,
        "devicePixelRatio": 1
      },
      "webglVendor": "Google Inc. (Intel)",
      "webglRenderer": "ANGLE (Intel, Intel(R) UHD Graphics Direct3D11 vs_5_0 ps_5_0)",
      "canvasNoise": 0.12,
      "audioNoise": 0.00002,
      "seed": "jp-checkout-link-v1",
      "grantGeolocation": true,
      "reportToAgentControl": true
    }
  }
}
```

这个模板会自动落到日本预设：

- `locale: ja-JP`
- `languages: ["ja-JP", "ja", "en-US", "en"]`
- `Accept-Language: ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7`
- `timezone: Asia/Tokyo`
- `geolocation: Tokyo`

适用场景：

- 你需要把“长链转换 / checkout 准备阶段”明确做成日区特征。
- 你不希望它继续沿用前一个 US 阶段的语言和时区。

### 4.3 US 付款

付款阶段通常比注册阶段更敏感，建议用 `custom`，把语言、时区、定位、平台和屏幕参数固定得更明确。这样做的原因是：

- 你可以把时区精确落到当前付款出口更接近的地区。
- 你可以避免美国预设一律走 `America/New_York` 带来的偏差。

下面给的是一个“美国西海岸付款”的示例：

```jsonc
{
  "settings": {
    "fingerprintProfile": {
      "enabled": true,
      "mode": "custom",
      "countryCode": "US",
      "locale": "en-US",
      "languages": ["en-US", "en"],
      "acceptLanguage": "en-US,en;q=0.9",
      "timezone": "America/Los_Angeles",
      "latitude": 34.0522,
      "longitude": -118.2437,
      "accuracy": 100,
      "platform": "Win32",
      "vendor": "Google Inc.",
      "hardwareConcurrency": 8,
      "deviceMemory": 8,
      "maxTouchPoints": 0,
      "screen": {
        "width": 1920,
        "height": 1080,
        "availWidth": 1920,
        "availHeight": 1040,
        "colorDepth": 24,
        "pixelDepth": 24,
        "devicePixelRatio": 1
      },
      "webglVendor": "Google Inc. (Intel)",
      "webglRenderer": "ANGLE (Intel, Intel(R) UHD Graphics Direct3D11 vs_5_0 ps_5_0)",
      "canvasNoise": 0.08,
      "audioNoise": 0.00001,
      "seed": "us-payment-la-v1",
      "grantGeolocation": true,
      "reportToAgentControl": true
    }
  }
}
```

如果你的付款代理更偏纽约、芝加哥、达拉斯等区域，只需要改这几个字段：

- `timezone`
- `latitude`
- `longitude`
- `seed`

## 5. 混合链路推荐用法

如果你的真实链路是：

- `US 注册`
- `JP 拿长链`
- `US 付款`

推荐按阶段切换 profile，而不是试图让一个浏览器会话同时承载三种国家特征。

推荐顺序：

1. 注册前先注入 `US 注册` 模板。
2. 在“准备打开 JP 长链目标页之前”切换到 `JP 长链` 模板。
3. 在“准备进入 US 付款目标页之前”切回 `US 付款` 模板。

原因：

- 当前这套指纹模块本质上是“浏览器级 / 目标页级”统一注入。
- 它不是“同一时刻每个标签页都用不同国家配置”的多租户隔离器。
- 所以跨国家场景应在阶段边界显式切换。

## 6. 推荐切换时机

推荐切换时机：

- 在新阶段即将打开新页面前切换。
- 切换后再创建新的 checkout / PayPal / auth 页面。
- 对于 `run-headless.js`，它会继续接管后续新开的标签页。
- 对于 `cdp-controller.js config`，它会立即应用到当前可见目标页，并把新配置持久化到扩展状态里。

不推荐的时机：

- 已经打开付款页、已经进入风控页后再临时切换国家模板。
- 在一个需要稳定连续交互的页面中途频繁切换 `seed`。

## 7. 当前模块已经覆盖的环境面

当前模块会统一处理这些浏览器环境面：

- `timezone`
- `locale`
- `geolocation`
- `Accept-Language`
- `navigator.language`
- `navigator.languages`
- `navigator.userAgent`
- `navigator.userAgentData`
- `navigator.platform`
- `navigator.vendor`
- `navigator.hardwareConcurrency`
- `navigator.deviceMemory`
- `navigator.maxTouchPoints`
- `navigator.webdriver`
- `screen.*`
- `devicePixelRatio`
- `permissions.query(geolocation)`
- `WebGL vendor / renderer`
- 轻量 `canvas / audio` 稳定噪声

## 8. 运行态怎么看

应用 profile 后，可通过 `agent-control` 快照查看：

- `fingerprint.profile`
  - 当前已持久化的 profile 配置。
- `fingerprint.runtime.status`
  - 当前注入器状态。
- `fingerprint.runtime.appliedTargetCount`
  - 已成功应用的目标页数量。
- `fingerprint.runtime.lastTargetUrl`
  - 最近一次成功应用的目标页 URL。
- `fingerprint.runtime.lastError`
  - 最近一次注入失败信息。
- `fingerprint.runtime.resolvedProfile`
  - 最终解析后的完整配置，便于确认国家预设、语言、时区是否正确展开。

## 9. 一个最实用的落地建议

如果你只是想先稳定跑通，不要一上来就把三套模板都写成重度 `custom`。

建议优先级：

1. `US 注册` 用 `proxy_region`
2. `JP 长链` 用 `preset`
3. `US 付款` 再用 `custom`

这样做的好处是：

- 注册阶段保留一定的出口自适应能力。
- JP 长链阶段快速获得稳定的日本语言和时区。
- 付款阶段再针对最敏感页面做更精细的美国本地化。
