# 裁片域检查与 E2E 运行

## 1. 安装依赖

```bash
npm install
```

## 2. 安装 Playwright 浏览器

```bash
npm run test:cutting:install-browsers
```

## 3. 准备裁片域 E2E 环境

```bash
npm run test:cutting:bootstrap
```

这一步会：
- 准备 `test-results/` 与 `playwright-report/`
- 写入默认 `PLAYWRIGHT_BASE_URL`
- 校准本地运行端口和 webServer 命令

## 4. 运行最终 release 检查

```bash
npm run check:cutting:release
```

如果只想先跑代码级检查，不跑交付层门禁，可以先执行：

```bash
npm run check:cutting:all
```

## 5. 运行裁片域全链 E2E

```bash
npm run test:cutting:all:e2e
```

常用调试命令：

```bash
npm run test:cutting:e2e:headed
npm run test:cutting:e2e:debug
```

## 6. 本地服务说明

Playwright 配置已经内置 `webServer`，默认会自动启动：

```bash
npm run dev -- --host 127.0.0.1 --port 4173 --strictPort
```

通常不需要手工先起服务。若本地已经有同端口服务在跑，Playwright 会优先复用。

## 7. 常见失败与排查

### 浏览器未安装

表现：
- `browserType.launch` 失败
- 提示缺少 Chromium

处理：

```bash
npm run test:cutting:install-browsers
```

### 本地服务未拉起

表现：
- `baseURL` 访问失败
- `webServer` 超时

处理：

```bash
npm run test:cutting:bootstrap
npm run test:cutting:all:e2e
```

### 旧脚本 / 旧入口残留

表现：
- `check:cutting:release` 失败
- provenance / writeback / delivery 脚本报错

处理：
- 先看失败脚本名称
- 优先修复正式链路引用关系，再重新执行：

```bash
npm run check:cutting:release
```

### E2E 页面能打开但断言失败

处理：

```bash
npm run test:cutting:e2e:headed
```

或：

```bash
npm run test:cutting:e2e:debug
```
