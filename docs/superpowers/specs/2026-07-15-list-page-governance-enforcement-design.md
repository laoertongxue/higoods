# 标准列表页治理硬门禁设计

## 1. 背景与目标

`AGENTS.md` 能告诉 Agent 如何实现列表页，但它本身不是合并门禁。当前仓库的构建命令只执行 Vite 构建，缺少对“新增或调整列表页是否遵循补料管理模板”的自动阻断。

本设计为标准列表页增加分层保障：

1. Agent 规范继续作为实现时的第一约束。
2. 本地构建自动执行列表页治理检查。
3. GitHub Actions 在 PR 和 `main` push 上执行同一套检查。
4. GitHub 分支保护将 `list-page-governance` 设置为 Required Check，禁止绕过 PR 直接合并。

## 2. 页面识别与历史基线

新增 `scripts/standard-list-page-baseline.json`，记录当前尚未迁移的历史列表候选页面及其 SHA-256。

治理检查扫描 `src/pages/**/*.ts`：

- 通过 `<table`、列表渲染、分页渲染、标准列表标记等稳定信号识别列表候选。
- 新建或调整的列表候选页必须声明 `// @page-pattern: list`。
- 标准列表页必须使用 `renderStandardListPage`、公共表格、公共分页和列配置能力。
- 未迁移但没有发生变化的历史候选页，只有在当前文件哈希与基线一致时暂时放行。
- 新增候选页没有基线且未使用标准模板时失败。
- 历史候选页发生任何修改后哈希失效，必须迁移到标准模板；迁移完成后删除基线项。

CI 以 PR base SHA 对比基线文件：

- 禁止新增基线项。
- 禁止修改现有基线哈希。
- 允许删除已迁移页面的基线项。
- 首次引入基线文件时允许一次性建立基线；基线合并后按上述规则锁定。

## 3. 统一本地命令

新增 `npm run check:list-page-governance`，依次执行：

1. 页面基线与列表模板静态检查。
2. `npm run check:standard-list-page-template`。
3. `npm run check:prototype-design-governance -- --all`。

`package.json` 增加 `prebuild`：执行 `npm run check:list-page-governance`。因此本地 `npm run build` 在治理不通过时不能生成构建产物。

## 4. GitHub Actions 门禁

新增 `.github/workflows/list-page-governance.yml`：

- 触发：Pull Request，以及 push 到 `main`。
- 环境：固定 Node 版本，执行 `npm ci`，安装 Playwright Chromium。
- 执行：`npm run check:list-page-governance`、补料管理模板 E2E、`npm run build`。
- 工作流 job 名称固定为 `list-page-governance`。
- PR 检查使用 base SHA 校验基线不可绕过。

仓库管理员需要在 GitHub 分支保护规则中将 `list-page-governance` 设置为 Required Status Check，并禁止直接 push `main`。Workflow 文件本身不能替代 GitHub 侧的分支保护配置。

## 5. 强制检查项

每个新增或调整的列表页必须满足：

- 声明 `// @page-pattern: list`。
- 使用 `renderStandardListPage`。
- 使用公共表格、公共分页和列配置能力。
- 支持分页、列显隐、列顺序、冻结和数据排序。
- 操作列固定右侧。
- 满足 1366×768 标准和 1280×720 最低可用分辨率，页面主体不横向溢出。
- 不出现无业务逻辑的说明性文案。
- 存在对应 prototype review record。

补料管理模板继续运行真实 Chromium 验收，覆盖摘要、排序图标、冻结列、操作列、分页、局部刷新、性能和控制台错误。

## 6. 例外规则

- 未修改的历史非标准列表页可以按基线暂时放行。
- 任何业务例外必须在对应审查记录中写明理由、影响范围和替代防错措施。
- 例外不能用于新增列表页。
- 不允许通过修改基线哈希永久绕过治理；CI 会拒绝基线新增和哈希修改。

## 7. 非目标

- 本设计不立即迁移所有历史列表页。
- 不改变补料业务字段、分页口径或页面业务逻辑。
- 不引入后端权限系统或新的状态管理框架。
- 不把 Agent 规范误认为可以替代 CI 和 GitHub 分支保护。
