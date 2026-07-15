# 商品选品测款项目核心重构实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 删除商品项目工作项和模板体系，把商品项目改造成直接关联商品档案、测款事实、复判和退货案件的扁平业务单。

**架构：** 保留 `/pcs/projects` 外部路由和项目主键，替换内部阶段、节点和模板模型。领域层只计算项目状态和结束条件；仓储层在创建项目时同步创建“商品测款”档案；页面按真实业务事实分区展示。

**技术栈：** TypeScript、Vanilla TypeScript 字符串模板、localStorage Mock、Node/tsx 检查脚本。

---

## 文件职责

- 创建 `src/data/pcs-product-selection-project-domain.ts`：纯状态规则。
- 创建 `src/data/pcs-product-selection-project-fixtures.ts`：扁平 Mock。
- 修改 `src/data/pcs-project-types.ts`：仅保留项目、判断和业务关联类型。
- 重写 `src/data/pcs-project-repository.ts`：扁平仓储和原子创建。
- 修改 `src/data/pcs-channel-product-project-repository.ts`：测款判断直接更新项目和档案。
- 重写 `src/pages/pcs-projects.ts`：列表、创建、详情和判断交互。
- 修改 `src/router/routes-pcs.ts`、`src/router/route-renderers.ts`、`src/main-handlers/pcs-handlers.ts`、`src/data/app-shell-config.ts`：删除模板和工作项入口。
- 创建 `scripts/check-pcs-product-selection-project.ts` 和治理记录。

### 任务 1：建立扁平项目领域规则

**文件：**
- 创建：`src/data/pcs-product-selection-project-domain.ts`
- 创建：`tests/pcs-product-selection-project-domain.spec.ts`

- [ ] **步骤 1：编写失败测试**

```typescript
import assert from 'node:assert/strict'
import { deriveProductSelectionProjectStatus, canCloseProductSelectionProject } from '../src/data/pcs-product-selection-project-domain.ts'

assert.equal(deriveProductSelectionProjectStatus({ decision: '暂保留', returnClosed: false }), '暂保留')
assert.equal(deriveProductSelectionProjectStatus({ decision: '不通过', returnClosed: false }), '不通过待退货')
assert.equal(deriveProductSelectionProjectStatus({ decision: '不通过', returnClosed: true }), '已结束')
assert.equal(canCloseProductSelectionProject({ decision: '通过', returnClosed: false }), true)
assert.equal(canCloseProductSelectionProject({ decision: '暂保留', returnClosed: false }), false)
```

- [ ] **步骤 2：运行并确认失败**

```bash
npm test -- tests/pcs-product-selection-project-domain.spec.ts
```

预期：FAIL，模块尚不存在。

- [ ] **步骤 3：实现最小领域模型**

```typescript
export type ProductSelectionDecision = '' | '通过' | '不通过' | '暂保留'
export type ProductSelectionProjectStatus = '测款准备中' | '测款中' | '暂保留' | '不通过待退货' | '已结束'

export interface ProductSelectionClosureFacts {
  decision: ProductSelectionDecision
  returnClosed: boolean
}

export function canCloseProductSelectionProject(facts: ProductSelectionClosureFacts): boolean {
  return facts.decision === '通过' || (facts.decision === '不通过' && facts.returnClosed)
}

export function deriveProductSelectionProjectStatus(facts: ProductSelectionClosureFacts): ProductSelectionProjectStatus {
  if (canCloseProductSelectionProject(facts)) return '已结束'
  if (facts.decision === '不通过') return '不通过待退货'
  if (facts.decision === '暂保留') return '暂保留'
  return '测款中'
}
```

- [ ] **步骤 4：运行测试并提交**

```bash
npm test -- tests/pcs-product-selection-project-domain.spec.ts
git add src/data/pcs-product-selection-project-domain.ts tests/pcs-product-selection-project-domain.spec.ts
git commit -m "feat: define product selection project states"
```

### 任务 2：扁平化项目类型和仓储

**文件：**
- 修改：`src/data/pcs-project-types.ts`
- 修改：`src/data/pcs-project-repository.ts`
- 创建：`src/data/pcs-product-selection-project-fixtures.ts`
- 创建：`tests/pcs-product-selection-project-repository.spec.ts`

- [ ] **步骤 1：编写失败的原子创建测试**

```typescript
resetProjectRepository()
const draft = createEmptyProjectDraft()
Object.assign(draft, {
  projectName: '夏季碎花连衣裙测款', projectSourceType: '企划提案',
  categoryId: 'dress', categoryName: '连衣裙', ownerId: 'buyer-1', ownerName: '买手甲',
  targetChannelCodes: ['TIKTOK_ID'], projectAlbumUrls: ['/dress.jpg'],
})
const result = createProject(draft, '买手甲')
assert.equal(result.project.projectStatus, '测款准备中')
assert.ok(result.project.productArchiveId)
assert.equal(result.productArchive.archiveIdentity, '商品测款')
assert.equal('phases' in result, false)
assert.equal('nodes' in result, false)
```

- [ ] **步骤 2：运行并确认旧模型失败**

```bash
npm test -- tests/pcs-product-selection-project-repository.spec.ts
```

预期：FAIL，旧返回值仍含阶段和节点，并要求模板。

- [ ] **步骤 3：替换项目核心类型**

```typescript
export type ProductArchiveIdentity = '商品测款' | '正式商品' | '测款淘汰'

export interface PcsProjectRecord {
  projectId: string
  projectCode: string
  projectName: string
  productArchiveId: string
  productArchiveCode: string
  projectStatus: ProductSelectionProjectStatus
  latestDecision: ProductSelectionDecision
  reconsiderAt: string
  returnCaseIds: string[]
  categoryId: string
  categoryName: string
  targetChannelCodes: string[]
  ownerId: string
  ownerName: string
  createdAt: string
  createdBy: string
  updatedAt: string
  updatedBy: string
  remark: string
}

export interface ProjectCreateResult {
  project: PcsProjectRecord
  productArchive: { archiveId: string; archiveCode: string; archiveIdentity: ProductArchiveIdentity }
}
```

删除阶段、节点、运行时进度、模板和工作项相关类型及草稿字段。

- [ ] **步骤 4：重写创建事务**

```typescript
const archive = createTestingProductArchiveShell({ projectId, projectCode, draft: input, operatorName })
const project = buildProductSelectionProject({ projectId, projectCode, productArchive: archive, draft: input, operatorName })
persistProductArchive(archive)
persistSnapshot({ version: PROJECT_STORE_VERSION, projects: [project, ...snapshot.projects] })
return { project, productArchive: archive }
```

所有校验必须在持久化之前完成，不得先写项目再补档案。

- [ ] **步骤 5：运行测试和提交**

```bash
npm test -- tests/pcs-product-selection-project-repository.spec.ts
git add src/data/pcs-project-types.ts src/data/pcs-project-repository.ts src/data/pcs-product-selection-project-fixtures.ts tests/pcs-product-selection-project-repository.spec.ts
git commit -m "refactor: flatten product selection project repository"
```

### 任务 3：重写测款判断和复判

**文件：**
- 修改：`src/data/pcs-channel-product-project-repository.ts`
- 创建：`tests/pcs-product-selection-decision.spec.ts`

- [ ] **步骤 1：编写三分支失败测试**

测试通过更新原档案并结束；暂保留保存复判日期且不新增测款；不通过进入待退货但不结束。

```typescript
const before = listTestingRecords(projectId).length
const result = submitProductSelectionDecision(projectId, {
  decision: '暂保留', reason: '等待过些天复判', reconsiderAt: '2026-07-20', operatorName: '买手甲',
})
assert.equal(result.projectStatus, '暂保留')
assert.equal(listTestingRecords(projectId).length, before)
```

- [ ] **步骤 2：运行并确认失败**

```bash
npm test -- tests/pcs-product-selection-decision.spec.ts
```

- [ ] **步骤 3：实现判断记录并删除节点写回**

```typescript
export interface ProductSelectionDecisionRecord {
  decisionId: string
  projectId: string
  decision: '通过' | '不通过' | '暂保留'
  reason: string
  reconsiderAt: string
  decidedAt: string
  decidedBy: string
}
```

删除 `TEST_CONCLUSION` 节点、阶段推进、`STYLE_ARCHIVE_CREATE` 解锁和 `completeDecisionNodeWithResult()`。通过时更新既有档案；不通过时返回待处理样衣集合；暂保留只保存判断记录。

- [ ] **步骤 4：运行测试并提交**

```bash
npm test -- tests/pcs-product-selection-decision.spec.ts
git add src/data/pcs-channel-product-project-repository.ts tests/pcs-product-selection-decision.spec.ts
git commit -m "refactor: replace project node decisions with business decisions"
```

### 任务 4：重写商品项目页面

**文件：**
- 重写：`src/pages/pcs-projects.ts`
- 创建：`scripts/check-pcs-product-selection-project.ts`
- 修改：`package.json`

- [ ] **步骤 1：写失败的页面结构检查**

检查页面包含“商品资料完整度、样衣采购及一物一码、测款记录、判断历史、退货或处置”，且不存在“工作项、项目阶段、项目模板、节点完成比例”。

- [ ] **步骤 2：运行并确认失败**

```bash
npm run check:pcs-product-selection-project
```

- [ ] **步骤 3：按职责拆分渲染函数**

```typescript
function renderProjectOverview(project: PcsProjectRecord): string
function renderProductArchiveCompleteness(project: PcsProjectRecord): string
function renderProjectSamples(project: PcsProjectRecord): string
function renderProjectChannelProducts(project: PcsProjectRecord): string
function renderProjectTestingFacts(project: PcsProjectRecord): string
function renderProjectDecisionHistory(project: PcsProjectRecord): string
function renderProjectReturnClosure(project: PcsProjectRecord): string
```

创建页保留完整商品表单但只校验创建必填字段。输入使用 `data-skip-page-rerender="true"`；弹窗只做局部更新。

- [ ] **步骤 4：运行检查、构建并提交**

```bash
npm run check:pcs-product-selection-project
npm run build
git add src/pages/pcs-projects.ts scripts/check-pcs-product-selection-project.ts package.json
git commit -m "feat: rebuild product selection project pages"
```

### 任务 5：删除工作项和模板模块

**文件：**
- 修改：`src/router/routes-pcs.ts`
- 修改：`src/router/route-renderers.ts`
- 修改：`src/main-handlers/pcs-handlers.ts`
- 修改：`src/data/app-shell-config.ts`
- 删除：总计划列出的工作项、模板、阶段、节点和 inline record 文件。
- 创建：`docs/prototype-review-records/2026-07-13-product-selection-project-core.md`

- [ ] **步骤 1：增加无残留断言**

在专项脚本中断言菜单、路由、处理器和渲染器不包含 `/pcs/work-items`、`/pcs/templates`。

- [ ] **步骤 2：删除入口和实现**

使用 `apply_patch` 删除文件和引用，不添加重定向、空导出或兼容层。同步删除 `package.json` 中只验证旧体系的脚本。

- [ ] **步骤 3：检查残留**

```bash
rg -n "pcs/work-items|pcs/templates|工作项库|项目模板阶段|ProjectNode|ProjectPhase|InlineNode" src tests scripts package.json
```

预期：源代码、测试和脚本无匹配。

- [ ] **步骤 4：运行验证并提交**

```bash
npm run check:pcs-product-selection-project
npm run check:menu-routes
npm run check:prototype-design-governance -- --all
npm run build
git add src tests scripts package.json docs/prototype-review-records/2026-07-13-product-selection-project-core.md
git commit -m "refactor: remove project work item and template modules"
```

