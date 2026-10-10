# 裁片域检查与 E2E 手册

本手册说明裁片专项测试的运行方式，不为全项目增加必跑流程。验证范围和完成标准见 [AGENTS.md](../AGENTS.md)，首次安装及普通开发启动见 [README.md](../README.md)。命令定义以 [package.json](../package.json) 和 [Playwright 配置](../playwright.config.ts) 为准。

## 1. 选择本次需要的检查

| 场景 | 入口 | 能证明什么 |
| --- | --- | --- |
| 单一公式、规则或 Bug 修复 | 对应 `check:cutting-*` 或具体测试文件 | 该专项断言及直接回归结果 |
| 裁片跨环节代码回归 | `npm run check:cutting:all` | 当前聚合脚本包含的裁片契约；不等于浏览器全链验收 |
| 裁片交付准备检查 | `npm run check:cutting:release` | 实际路由集成、裁片聚合及交付入口检查；不含全部页面、性能或部署核验 |
| 需要覆盖整个裁片 spec 集合 | `npm run test:cutting:all:e2e` | 生产构建检查，以及当前 `tests/cutting-*.spec.ts` 集合在开发服务上的断言 |
| 正式发布 | 按 `AGENTS.md` 的 RELEASE 规则 | 目标分支、GitHub 与对应 SHA 的 Production 等发布证据 |

“全链”聚合仍受所选测试文件和断言范围限制；不自动包含文件名前缀为 `pda-` 等其他相关测试。根据实际改动补上直接相邻路径，不能用一个聚合命令名称代替全部需求验收。

## 2. 环境准备

在目标工作树根目录运行，依赖按 README 安装。浏览器缺失时执行一次：

```bash
npm run test:cutting:install-browsers
```

Playwright 自动调用 [tests/bootstrap/cutting-bootstrap.ts](../tests/bootstrap/cutting-bootstrap.ts) 的 `globalSetup`，创建报告目录并在测试进程设置基础 URL。无需单独运行该模块；它不修改 `playwright.config.ts`，也不会替父 shell 设置环境变量或解决端口冲突。

## 3. 单项与相关回归

以下示例针对裁片转袋确认后的局部刷新；处理其他问题时替换为本次实际关联的脚本或 spec：

```bash
npm run check:cutting-wait-handover-transfer-bag-flow
PLAYWRIGHT_REUSE_EXISTING_SERVER=false CUTTING_E2E_PORT=43178 npm exec -- playwright test tests/cutting-transfer-bag-confirm-local-refresh.spec.ts --workers=1
```

调试同一个 spec：

```bash
PLAYWRIGHT_REUSE_EXISTING_SERVER=false CUTTING_E2E_PORT=43178 npm exec -- playwright test tests/cutting-transfer-bag-confirm-local-refresh.spec.ts --debug
```

`--debug` 由 Playwright 提供；它会打开 Inspector 并使用单 worker 等调试设置。调试运行不能代替约定条件下的性能测量。只需可见浏览器时把 `--debug` 换成 `--headed`；运行前用 `npm exec -- playwright test --help` 查看本地版本支持的参数。

## 4. 跨环节与完整回归

需要裁片代码聚合时：

```bash
npm run check:cutting:all
```

需要包含路由集成和交付入口核对时：

```bash
npm run check:cutting:release
```

当前 `release` 已调用 `check:cutting:all`；选择前者后，不为同一代码版本无目的重复后者。

需要完整裁片 spec 集合时：

```bash
npm run test:cutting:all:e2e
```

该命令先运行 `build`，随后显式启动开发服务测试，而不是使用刚生成的 `dist`。若本次验收要求生产构建预览，改用下一节的预览入口并选择所需 spec。

## 5. 服务、工作树与构建产物

| 入口 | 默认服务 | 端口 | 复用行为 |
| --- | --- | --- | --- |
| 直接执行 `playwright test` | Vite dev | 4173 | 非 CI 且未设置 `PLAYWRIGHT_REUSE_EXISTING_SERVER=false` 时允许复用 |
| `test:cutting:all:e2e` | 先 build，再 Vite dev | 43177 | 命令显式关闭复用；单 worker |
| 设置 `CUTTING_E2E_USE_PREVIEW=true` | Vite preview | 默认 4173，可覆盖 | 仍由复用环境变量控制；需先生成目标版本的产物 |

`CUTTING_E2E_HOST`、`CUTTING_E2E_PORT` 控制启动地址；`PLAYWRIGHT_BASE_URL` 可覆盖测试访问 URL。后者必须与计划启动或复用的服务一致。聚合命令固定了表中的端口、服务模式及复用值，继承的其他环境变量仍可能改变测试条件。

生产构建预览示例：

```bash
npm run build
CUTTING_E2E_USE_PREVIEW=true PLAYWRIGHT_REUSE_EXISTING_SERVER=false CUTTING_E2E_PORT=43179 npm exec -- playwright test tests/cutting-transfer-bag-confirm-local-refresh.spec.ts --workers=1
```

默认预览读取 `dist`；若设置 `CUTTING_E2E_PREVIEW_OUT_DIR`，记录该目录及其实际构建来源。验收前核对：

1. 运行命令的工作树、分支、HEAD 和未提交差异与目标代码一致。
2. 服务进程的工作目录及 URL 与该工作树一致。仅端口能响应，不足以证明服务属于当前版本；不明确时使用空闲端口并禁用复用。
3. 预览使用最后一次相关代码修改后生成的资产，并在证据中记录构建来源或资产摘要；dev 运行不能证明 `dist` 的表现。
4. 测试只在 Playwright 隔离 context / 专用测试 profile 中写入夹具和清理存储，不连接用户日常浏览器资料。具体 spec 如有持久 profile 或外部状态操作，先核查其范围。

## 6. 失败定位与证据

| 表现 | 定位和处理 |
| --- | --- |
| Chromium 可执行文件缺失 | 运行 `test:cutting:install-browsers` 后重试受影响 spec |
| 端口被占用 | 确认占用进程和所属工作树；选择空闲端口，不自动结束不明进程或复用另一工作树 |
| 服务超时／URL 访问失败 | 对照 webServer 输出检查启动错误、host / port / baseURL；预览另查构建产物，不重复无效 bootstrap |
| 页面可开但断言失败 | 保留失败 trace、截图和原始日志，使用同一 spec 的 `--debug` 定位状态、数据与版本；不能只放宽断言或更新快照来消除失败 |
| 专项规则检查失败 | 查看实际失败脚本及断言，核对有效业务需求和当前事实源，修复后重放失败及直接相邻回归 |

默认产物位于 `test-results/playwright/` 和 `playwright-report/`，失败时保留 trace、截图和视频（以配置为准）。交付使用的证据按 `AGENTS.md` 的 EVIDENCE 规则保存并关联版本；重复执行可能覆盖默认目录，不把新一轮成功输出当作旧失败从未发生。

本手册的命令说明与静态入口核对不等于已经运行过业务测试。单项或聚合测试通过后，仍按本次需求补齐未覆盖的命名页面、PDA、打印、持久回读及性能证据；发布另核对同 SHA 的远端与 Production 状态。
