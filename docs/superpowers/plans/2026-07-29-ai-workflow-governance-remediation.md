# AI 编码工作流治理整改实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法跟踪进度。

**目标：** 依次关闭冻结审计中的原型记录绑定、检查路由、完成收据、Superpowers 轨迹和经验候选采集缺口。

**架构：** 项目侧使用 `scripts/workflow-governance/` 纯函数内核，由现有治理命令和新增薄 CLI 复用；Better Harness 侧只调整 Codex 候选选择。所有行为以 Node 内置测试和现有项目命令验证。

**技术栈：** TypeScript、Node.js 内置测试、现有 npm scripts、Git、CodeGraph CLI。

---

### 任务 1：原型审查记录绑定

**文件：**

- 创建：`scripts/workflow-governance/prototype-review.ts`
- 创建：`tests/workflow-governance/prototype-review.test.ts`
- 修改：`scripts/check-prototype-design-governance.ts`
- 修改：`docs/prototype-review-record-template.md`
- 修改：`package.json`

- [x] 编写失败测试：覆盖受管页面无记录、只有无关记录、缺验证字段和完整关联记录。
- [x] 运行 `node --experimental-strip-types --test tests/workflow-governance/prototype-review.test.ts`，确认因缺少解析和校验函数失败。
- [x] 实现 Markdown 字段解析、文件覆盖匹配和必填项校验。
- [x] 将现有治理脚本切换到共享校验器，并保留原命令入口。
- [x] 运行专项测试及 `npm run check:prototype-design-governance -- --all`，确认通过。

### 任务 2：受影响检查路由

**文件：**

- 创建：`scripts/workflow-governance/affected-checks.ts`
- 创建：`scripts/route-affected-checks.ts`
- 创建：`tests/workflow-governance/affected-checks.test.ts`
- 修改：`package.json`

- [x] 编写失败测试：输入补料页面、裁片数据、主处理器、列表组件和未知路径。
- [x] 运行 `node --experimental-strip-types --test tests/workflow-governance/affected-checks.test.ts`，确认因路由器不存在失败。
- [x] 实现路径规则、检查去重、治理检查和未知路径升级。
- [x] 增加 `check:affected` 命令，支持 Git 工作区路径和显式 `--paths`，默认输出 JSON。
- [x] 运行专项测试，并逐个验证 5 组输入的输出。

### 任务 3：统一任务完成与交付收据

**文件：**

- 创建：`scripts/workflow-governance/task-receipt.ts`
- 创建：`scripts/task-completion-receipt.ts`
- 创建：`tests/workflow-governance/task-receipt.test.ts`
- 修改：`package.json`
- 修改：`AGENTS.md`

- [x] 编写失败测试：覆盖指纹变化、失败检查、CodeGraph 待同步、缺 provider 回执和版本不一致。
- [x] 运行 `node --experimental-strip-types --test tests/workflow-governance/task-receipt.test.ts`，确认因收据状态机不存在失败。
- [x] 实现收据数据结构、版本指纹和四级状态机。
- [x] 实现 `verify`：按检查路由执行命令，采集 CodeGraph JSON 状态，在前后指纹一致时写入 `verified`。
- [x] 实现 `deliver` 与 `accept`：要求验证版本、provider 回执和明确接受引用。
- [x] 更新 `AGENTS.md`，要求完成声明使用收据，不改变现有原型边界。
- [x] 运行专项测试，并用临时输出文件完成一次真实 `verify`。

### 任务 4：Superpowers 最小阶段轨迹

**文件：**

- 创建：`scripts/workflow-governance/stage-trace.ts`
- 创建：`scripts/record-workflow-stage.ts`
- 创建：`tests/workflow-governance/stage-trace.test.ts`
- 修改：`scripts/workflow-governance/task-receipt.ts`
- 修改：`AGENTS.md`
- 修改：`package.json`

- [x] 编写失败测试：完整子代理实现与两阶段审查轨迹通过，只有技能名称的轨迹失败。
- [x] 运行 `node --experimental-strip-types --test tests/workflow-governance/stage-trace.test.ts`，确认正确失败。
- [x] 实现追加式阶段记录和适用阶段校验。
- [x] 让任务收据引用轨迹摘要，不复制原始对话。
- [x] 运行专项测试，确认请求文本不能冒充技能调用。

### 任务 5：Better Harness 经验候选采集

**文件：**

- 修改：`/Users/laoer/.codex/plugins/cache/better-harness/better-harness/0.3.0/scripts/session-analysis/episode-facts.mjs`
- 修改：`/Users/laoer/.codex/plugins/cache/better-harness/better-harness/0.3.0/test/session-analysis-core-facts.test.mjs`
- 创建：`/Users/laoer/.codex/plugins/cache/better-harness/better-harness/0.3.0/docs/specs/2026-07-29-independent-repeat-context-portfolio.md`

- [x] 编写失败测试：两个独立任务上下文形成可比较候选，同一上下文的重复摘要只计 occurrences。
- [x] 使用受支持 Node 运行目标测试，确认因候选组合缺少上下文边界失败。
- [x] 最小修改共享 Episode Facts 候选选择，保留独立上下文和有序工作轨迹，并为一组可比较候选预留 2 个有界槽位。
- [x] 运行 Session Analysis 与 Evidence Bundle 相关测试。

### 任务 6：收口验证与后修复审计

**文件：**

- 修改：本计划中的复选框状态。
- 生成：项目外临时验证收据。
- 生成：`.codex/better-harness/runs/2026-07-29-higoods-ai-workflow-post-fix/` 报告产物。

- [ ] 运行所有新增 Node 测试。
- [ ] 运行 `npm run check:prototype-design-governance -- --all`。
- [ ] 运行 `npm run build`。
- [ ] 运行 `codegraph sync` 与 `codegraph status --json`，确认无待同步文件。
- [ ] 运行 Better Harness 相关测试。
- [ ] 请求独立代码审查，修复 Critical 和 Important 问题。
- [ ] 重新采集同一冻结窗口并生成后修复审计，保留未能由当前窗口证明关闭的 Finding。
