# 生产准备与工程开发打样串联实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 让生产准备时效的工程类准备项创建或关联正式工程任务，并以工程任务状态和产出作为唯一完成依据。

**架构：** 新增小型映射适配器，把生产准备项映射到改版、制版、花型、首版样衣和首单样衣任务。生产准备记录保存正式任务引用和只读快照，不再为工程类准备项维护独立上传结果；非工程类准备项保持现有专业边界。

**技术栈：** TypeScript、FCS/PCS 本地 Mock 仓储、Vanilla TypeScript、Node/tsx 检查脚本。

---

## 文件职责

- 创建 `src/data/fcs/production-preparation-engineering-linkage.ts`：映射、状态投影和替换规则。
- 修改 `src/data/fcs/production-preparation-timing.ts`：增加正式任务引用。
- 修改 `src/data/fcs/production-preparation-timing-runtime.ts`：工程类状态从任务读取。
- 修改 `src/data/pcs-task-project-relation-writeback.ts` 及工程任务创建文件：来源改为商品档案或生产准备记录。
- 修改 `src/pages/production/preparation-timing.ts`：创建、关联和查看任务入口。
- 修改 `src/pages/pcs-engineering-tasks.ts`：展示来源生产准备记录并移除节点写回。
- 创建 `scripts/check-production-preparation-engineering-linkage.ts` 和治理记录。

### 任务 1：定义准备项与工程任务映射

**文件：**
- 创建：`src/data/fcs/production-preparation-engineering-linkage.ts`
- 创建：`tests/production-preparation-engineering-linkage.spec.ts`

- [ ] **步骤 1：编写失败映射测试**

```typescript
assert.equal(resolveEngineeringTaskType('梭织基码纸样'), '制版任务')
assert.equal(resolveEngineeringTaskType('版衣制作'), '首版样衣任务')
assert.equal(resolveEngineeringTaskType('数码印/DTF/DTG花型'), '花型任务')
assert.equal(resolveEngineeringTaskType('确认染色要求（面料）'), null)
```

- [ ] **步骤 2：运行并确认失败**

```bash
npm test -- tests/production-preparation-engineering-linkage.spec.ts
```

- [ ] **步骤 3：实现显式映射**

```typescript
export type PreparationEngineeringTaskType =
  | '改版任务'
  | '制版任务'
  | '花型任务'
  | '首版样衣任务'
  | '首单样衣任务'

const TASK_TYPE_BY_ITEM: Partial<Record<PreparationItemType, PreparationEngineeringTaskType>> = {
  梭织基码纸样: '制版任务',
  毛织基码纸样: '制版任务',
  版衣制作: '首版样衣任务',
  梭织齐码纸样: '制版任务',
  毛织齐码纸样: '制版任务',
  '数码印/DTF/DTG花型': '花型任务',
}
```

首单样衣不是现有准备项时不伪造映射；只有后续明确增加“首单确认”准备项时才扩展枚举。

- [ ] **步骤 4：运行测试并提交**

```bash
npm test -- tests/production-preparation-engineering-linkage.spec.ts
git add src/data/fcs/production-preparation-engineering-linkage.ts tests/production-preparation-engineering-linkage.spec.ts
git commit -m "feat: map preparation items to engineering tasks"
```

### 任务 2：用正式工程任务投影准备状态

**文件：**
- 修改：`src/data/fcs/production-preparation-timing.ts`
- 修改：`src/data/fcs/production-preparation-timing-runtime.ts`
- 修改：`tests/production-preparation-engineering-linkage.spec.ts`

- [ ] **步骤 1：增加失败测试**

测试正式任务“已完成”时准备项完成；任务“需改版/已取消”时准备项不完成并显示异常；旧任务产出失效且替代任务进行中时只认当前任务。

- [ ] **步骤 2：增加明确引用结构**

```typescript
export interface PreparationBusinessObjectLink {
  linkId: string
  objectType: '改版任务' | '制版任务' | '花型任务' | '首版样衣任务' | '首单样衣任务'
  objectId: string
  objectCode: string
  href: string
  active: boolean
  linkedAt: string
  linkedBy: string
}
```

`ProductionPreparationItem` 增加 `businessObjectLinks`；工程类准备项不再以 `uploads` 判断完成。

- [ ] **步骤 3：实现状态投影**

```typescript
export function projectEngineeringTaskToPreparationItem(
  item: ProductionPreparationItem,
  task: EngineeringTaskSnapshot,
): ProductionPreparationItem
```

映射负责人、状态、实际完成时间、产出摘要和异常。任务取消、需改版或产出失效不得映射为“已完成”。

- [ ] **步骤 4：运行测试并提交**

```bash
npm test -- tests/production-preparation-engineering-linkage.spec.ts
git add src/data/fcs/production-preparation-timing.ts src/data/fcs/production-preparation-timing-runtime.ts tests/production-preparation-engineering-linkage.spec.ts
git commit -m "refactor: project engineering facts into preparation timing"
```

### 任务 3：切断工程任务的项目节点依赖

**文件：**
- 修改：`src/data/pcs-task-project-relation-writeback.ts`
- 修改：`src/data/pcs-first-sample-project-writeback.ts`
- 修改：`src/data/pcs-first-order-sample-project-writeback.ts`
- 修改：仍要求 `projectNodeId/workItemTypeCode` 的工程任务类型和创建函数。
- 创建：`tests/pcs-engineering-business-source.spec.ts`

- [ ] **步骤 1：编写来源测试**

```typescript
const task = createPlateTask({
  productArchiveId: 'archive-1',
  sourceType: '生产准备记录',
  sourceObjectId: 'prep-1',
  sourceObjectCode: 'ZB-202607-001',
  ownerName: '版师甲',
})
assert.equal(task.productArchiveId, 'archive-1')
assert.equal('projectNodeId' in task, false)
```

- [ ] **步骤 2：运行并确认失败**

```bash
npm test -- tests/pcs-engineering-business-source.spec.ts
```

- [ ] **步骤 3：统一专业任务来源**

```typescript
export interface EngineeringTaskBusinessSource {
  productArchiveId: string
  sourceType: '生产准备记录' | '商品开发' | '人工创建' | '既有任务返工'
  sourceObjectId: string
  sourceObjectCode: string
}
```

删除“项目模板阶段”和商品项目节点来源；首版、首单、制版、花型及改版任务通过正式任务 ID 或商品档案串联。

- [ ] **步骤 4：运行工程检查**

```bash
npm run check:pcs-pattern-task-refactor
npm run check:pcs-plate-making-refactor
npm run check:pcs-revision-task-refactor
npm run check:pcs-sample-chain-refactor
npm run build
```

旧检查若只断言节点写回，必须删除或改写为业务来源断言，不能保留旧字段。

- [ ] **步骤 5：提交**

```bash
git add src/data tests scripts package.json
git commit -m "refactor: link engineering tasks to business sources"
```

### 任务 4：增加跨模块操作入口和验证

**文件：**
- 修改：`src/pages/production/preparation-timing.ts`
- 修改：`src/pages/pcs-engineering-tasks.ts`
- 创建：`scripts/check-production-preparation-engineering-linkage.ts`
- 修改：`package.json`
- 创建：`docs/prototype-review-records/2026-07-13-production-preparation-engineering-linkage.md`

- [ ] **步骤 1：编写失败检查**

断言生产准备工程项显示“创建工程任务、关联已有任务、查看工程任务”，且没有独立上传工程结果按钮；工程任务页面显示来源生产准备记录和返回入口。

- [ ] **步骤 2：实现局部交互**

创建或关联任务后只更新当前准备项 DOM；打开弹窗、Dropdown 和详情不触发整页重绘；图标只 hydrate 新插入区域。

- [ ] **步骤 3：运行专项验证**

```bash
npm run check:production-preparation-engineering-linkage
npm run check:production-preparation-timing
npm run check:prototype-design-governance -- --all
npm run build
```

- [ ] **步骤 4：浏览器验证**

在 `/fcs/production/preparation-timing` 创建制版任务后，确认 `/pcs/patterns` 能找到同一任务；完成任务后返回页面显示完成；任务取消或需改版时准备项显示异常。

- [ ] **步骤 5：提交**

```bash
git add src/pages src/data scripts package.json docs/prototype-review-records/2026-07-13-production-preparation-engineering-linkage.md
git commit -m "feat: connect preparation timing with engineering tasks"
```

