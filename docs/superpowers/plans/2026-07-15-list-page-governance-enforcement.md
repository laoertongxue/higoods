# 标准列表页治理硬门禁实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 让新增或调整的列表页无法绕过补料管理标准模板：本地构建自动检查，PR 通过 GitHub Required Check 后才能合并。

**架构：** 使用一个纯 Node/TypeScript 治理检查器扫描 `src/pages/**/*.ts`，结合 `@page-pattern: list` 标记、标准模板调用契约和历史非标准页面 SHA-256 基线判断是否阻断。统一治理命令接入 `prebuild`；GitHub Actions 使用 PR base SHA 校验基线不可被新增或改写，并运行标准模板 Chromium E2E。GitHub 分支保护设置记录写入项目文档，作为仓库管理员的最后配置步骤。

**技术栈：** Node.js、TypeScript strip-types、Node `crypto`/`child_process`、Vite、Playwright、GitHub Actions

---

## 文件结构

- 创建：`scripts/check-list-page-governance.ts` —— 页面识别、模板契约、哈希基线和 base SHA 校验。
- 创建：`scripts/standard-list-page-baseline.json` —— 未迁移历史列表页的受控哈希基线。
- 创建：`docs/standard-list-page-governance-setup.md` —— GitHub Required Check 和分支保护配置步骤。
- 创建：`.github/workflows/list-page-governance.yml` —— PR/main 的自动治理门禁。
- 修改：`package.json` —— 统一治理命令和 `prebuild`。
- 修改：`AGENTS.md` —— 加入检查命令、基线不可修改和 CI 必过规则。
- 修改：`src/pages/process-factory/cutting/supplement-management.ts` —— 增加 `// @page-pattern: list` 标记。
- 修改：`scripts/check-standard-list-page-template.ts` —— 检查列表页标记和统一治理入口契约。
- 修改：`docs/prototype-review-records/2026-07-15-supplement-management-list-template.md` —— 记录治理门禁范围。

### 任务 1：实现页面识别、标准契约与基线校验器

**文件：**
- 创建：`scripts/check-list-page-governance.ts`
- 创建：`scripts/standard-list-page-baseline.json`
- 测试：`scripts/check-list-page-governance.ts --self-test`

- [ ] **步骤 1：先写纯函数失败自测**

在脚本中先定义并在 `--self-test` 调用以下函数：

```ts
type PagePattern = 'list' | 'detail' | 'form' | 'dashboard' | 'pda'

function parsePagePattern(source: string): PagePattern | null
function isListCandidate(source: string): boolean
function hasStandardListContract(source: string): boolean
function sha256(source: string): string
function validateBaselineIntegrity(
  current: Record<string, string>,
  base: Record<string, string> | null,
): void
```

必须覆盖这些失败案例：

```ts
assert.equal(parsePagePattern('// @page-pattern: list'), 'list')
assert.equal(parsePagePattern('// @page-pattern: detail'), 'detail')
assert.equal(parsePagePattern('// @page-pattern: unknown'), null)
assert.equal(isListCandidate('<table><tbody></tbody></table>'), true)
assert.equal(hasStandardListContract('renderStandardListPage renderStandardListTable renderTablePagination'), true)
assert.equal(hasStandardListContract('renderTable(<tbody>)'), false)
assert.throws(() => validateBaselineIntegrity({ 'src/pages/old.ts': 'new' }, { 'src/pages/old.ts': 'old' }))
assert.throws(() => validateBaselineIntegrity({ 'src/pages/new.ts': 'hash' }, {}))
```

- [ ] **步骤 2：运行自测确认红灯**

运行：

```bash
node --experimental-strip-types scripts/check-list-page-governance.ts --self-test
```

预期：FAIL，提示治理检查器模块或函数尚未实现。

- [ ] **步骤 3：实现最小检查器**

实现规则：

```ts
const STANDARD_LIST_CONTRACT = [
  'renderStandardListPage',
  'renderStandardListTable',
  'renderTablePagination',
]
const PAGE_PATTERN = /@page-pattern:\s*(list|detail|form|dashboard|pda)\b/
const LIST_SIGNALS = [/<table\b/, /render(?:Standard)?List/i, /renderTablePagination/i, /data-[\w-]*(?:list|table)/i]
```

扫描逻辑：

1. 使用 `rg --files src/pages -g '*.ts'` 获取页面文件。
2. 新增页面必须有合法 `@page-pattern`；`list` 必须通过标准契约，其他类型不进入列表契约检查。
3. 修改的旧页面若命中至少两个列表信号，必须声明 `@page-pattern: list` 并通过标准契约；否则报错。
4. 未修改、未声明且命中列表信号的旧页面只有在当前哈希等于基线时放行。
5. 标准页面不写入基线；迁移完成后从基线删除。
6. `--base <sha>` 时读取 `git show <sha>:scripts/standard-list-page-baseline.json`，拒绝基线新增和已有哈希修改，只允许删除迁移项；base 中没有该文件时允许一次性初始化。
7. `--self-test` 不读取工作区基线，只测试纯函数和临时字符串。

错误信息必须包含页面路径、失败规则和修复动作，例如：`src/pages/x.ts 是新增列表页，请添加 @page-pattern: list 并使用 renderStandardListPage/renderStandardListTable/renderTablePagination`。

- [ ] **步骤 4：生成初始历史基线**

运行：

```bash
node --experimental-strip-types scripts/check-list-page-governance.ts --write-baseline
```

预期：只写入当前未迁移且未修改的历史列表候选页；当前补料管理页因使用标准组件并声明 list 标记，不进入基线。

- [ ] **步骤 5：运行自测和工作区检查确认绿灯**

运行：

```bash
node --experimental-strip-types scripts/check-list-page-governance.ts --self-test
node --experimental-strip-types scripts/check-list-page-governance.ts
git diff --check
```

预期：自测和当前基线扫描均通过；基线 JSON 为合法 JSON 且键按路径排序。

- [ ] **步骤 6：提交任务 1**

```bash
git add scripts/check-list-page-governance.ts scripts/standard-list-page-baseline.json
git commit -m "feat: add list page governance baseline checker"
```

### 任务 2：接入 Agent、统一命令与 prebuild

**文件：**
- 修改：`package.json`
- 修改：`AGENTS.md`
- 修改：`src/pages/process-factory/cutting/supplement-management.ts`
- 修改：`scripts/check-standard-list-page-template.ts`
- 修改：`docs/prototype-review-records/2026-07-15-supplement-management-list-template.md`

- [ ] **步骤 1：先写统一命令失败检查**

在 `scripts/check-standard-list-page-template.ts` 增加源代码契约：

```ts
assert.match(agentsSource, /npm run check:list-page-governance/)
assert.match(agentsSource, /基线.*哈希.*不得.*修改/)
assert.match(mainSource, /@page-pattern: list/)
```

暂时只增加断言，不改 Agent 或 package，运行专项检查确认红灯。

- [ ] **步骤 2：更新 Agent 和补料页面标记**

在 `AGENTS.md` 标准列表治理章节加入：

```md
- 新增或调整的列表页必须声明 `// @page-pattern: list`，并通过 `npm run check:list-page-governance`；历史基线只允许未修改旧页面临时放行。
- 不得新增或修改 `scripts/standard-list-page-baseline.json` 中的历史哈希；页面迁移到标准模板后才允许删除对应基线项。
- `npm run build` 已通过 `prebuild` 自动执行治理检查；PR 合并必须通过 GitHub Required Check `list-page-governance`。
```

在 `supplement-management.ts` 文件顶部加入 `// @page-pattern: list`。

- [ ] **步骤 3：接入 package scripts**

在 `package.json` 增加：

```json
"check:list-page-governance:static": "node --experimental-strip-types --experimental-specifier-resolution=node scripts/check-list-page-governance.ts",
"check:list-page-governance": "npm run check:list-page-governance:static && npm run check:standard-list-page-template && npm run check:prototype-design-governance -- --all",
"prebuild": "npm run check:list-page-governance"
```

静态脚本从 `GOVERNANCE_BASE_SHA` 环境变量读取可选 base SHA；本地构建不依赖 GitHub 环境变量，PR Workflow 显式传入 base SHA。Workflow 的静态校验使用 `npm run check:list-page-governance:static`，避免在统一门禁中重复启动浏览器；构建阶段仍会通过 `prebuild` 完整复核。

- [ ] **步骤 4：运行红绿验证**

运行：

```bash
npm run check:standard-list-page-template
npm run check:list-page-governance
npm run build
```

预期：统一命令、专项检查和构建均 PASS；构建日志先出现治理检查通过，再出现 Vite 构建输出。

- [ ] **步骤 5：更新审查记录并提交任务 2**

审查记录新增：治理门禁覆盖范围、初始历史基线只读规则、补料管理已声明标准列表标记。

```bash
git add package.json AGENTS.md src/pages/process-factory/cutting/supplement-management.ts scripts/check-standard-list-page-template.ts docs/prototype-review-records/2026-07-15-supplement-management-list-template.md
git commit -m "chore: enforce list governance in local builds"
```

### 任务 3：GitHub Actions PR 门禁

**文件：**
- 创建：`.github/workflows/list-page-governance.yml`
- 创建：`docs/standard-list-page-governance-setup.md`

- [ ] **步骤 1：先写 workflow 结构检查**

新增 `scripts/check-list-page-governance.ts --self-test` 断言 workflow 内容需要包含：

```ts
assert.match(workflowSource, /pull_request/)
assert.match(workflowSource, /push:[\s\S]*branches:[\s\S]*main/)
assert.match(workflowSource, /npm ci/)
assert.match(workflowSource, /playwright install --with-deps chromium/)
assert.match(workflowSource, /npm run check:list-page-governance/)
assert.match(workflowSource, /npm run test:supplement-management-list-template:e2e/)
assert.match(workflowSource, /npm run build/)
assert.match(workflowSource, /list-page-governance/)
```

运行自测确认红灯。

- [ ] **步骤 2：实现 workflow**

使用固定 Node 22：

```yaml
name: list-page-governance
on:
  pull_request:
  push:
    branches: [main]
jobs:
  list-page-governance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npm run check:list-page-governance
        env:
          GOVERNANCE_BASE_SHA: ${{ github.event.pull_request.base.sha }}
      - run: npm run test:supplement-management-list-template:e2e
      - run: npm run build
```

Workflow job id 和显示名都固定为 `list-page-governance`；`prebuild` 会再次检查，防止单独跳过治理命令。

- [ ] **步骤 3：记录 GitHub 分支保护配置**

在 setup 文档写明：仓库 Settings → Branches/Rulesets → `main`：启用 Require a pull request、Require status checks、选择 `list-page-governance`、禁止 force push 和 direct push。明确 workflow 文件不能自动创建 GitHub Required Check，管理员必须手动保存规则。

- [ ] **步骤 4：运行静态和本地验证**

运行：

```bash
node --experimental-strip-types scripts/check-list-page-governance.ts --self-test
npm run check:list-page-governance
npm run build
```

预期：workflow 结构自测、治理扫描和构建全部 PASS。

- [ ] **步骤 5：提交任务 3**

```bash
git add .github/workflows/list-page-governance.yml docs/standard-list-page-governance-setup.md scripts/check-list-page-governance.ts
git commit -m "ci: require list page governance on pull requests"
```

### 任务 4：基线变更回归和完整门禁验证

**文件：**
- 修改：`scripts/check-list-page-governance.ts`
- 修改：`scripts/check-standard-list-page-template.ts`
- 创建：`scripts/fixtures/list-page-governance/` 下最小测试夹具（若纯函数自测无法覆盖）

- [ ] **步骤 1：增加基线攻击回归**

自测必须验证：

```ts
assert.throws(() => validateBaselineIntegrity(
  { 'src/pages/legacy.ts': 'changed' },
  { 'src/pages/legacy.ts': 'original' },
))
assert.throws(() => validateBaselineIntegrity(
  { 'src/pages/new-legacy.ts': 'hash' },
  {},
))
assert.doesNotThrow(() => validateBaselineIntegrity(
  {},
  { 'src/pages/migrated.ts': 'original' },
))
```

同时测试新增 list 页面缺 marker、list 页面缺标准组件、detail 页面不被误判为 list、修改基线文件会失败。

- [ ] **步骤 2：运行完整治理矩阵**

运行：

```bash
node --experimental-strip-types scripts/check-list-page-governance.ts --self-test
npm run check:list-page-governance
npm run check:standard-list-page-template
npm run check:prototype-design-governance -- --all
npm run test:supplement-management-list-template:e2e
npm run build
git diff --check
```

预期：全部退出码为 0；E2E 在两个低分辨率视口通过，控制台无错误，构建先完成治理再完成 Vite 构建。

- [ ] **步骤 3：同步 CodeGraph 并提交**

```bash
codegraph sync
codegraph status
git add scripts/check-list-page-governance.ts scripts/check-standard-list-page-template.ts
git commit -m "test: harden list governance baseline protections"
```

预期：CodeGraph 显示 `Index is up to date`，工作树干净。

### 任务 5：最终审查与交付说明

**文件：**
- 只读审查：`a449ff59..HEAD`

- [ ] **步骤 1：逐项审查治理设计**

核对设计规格每个章节都有实现：页面识别、基线、统一命令、prebuild、workflow、Required Check 文档、强制检查项和例外规则。

- [ ] **步骤 2：确认当前补料页仍通过真实页面验收**

访问：

```text
http://localhost:5180/fcs/craft/cutting/supplement-management
```

检查摘要单行、排序图标、冻结左侧固定和操作列右侧固定。

- [ ] **步骤 3：提交前检查状态**

运行：

```bash
git status --short --branch
git log --oneline -8
```

预期：治理相关提交已存在，工作树无未提交文件。
