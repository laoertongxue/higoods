# 车缝派单自定义分配时间与时效预览实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 让独立车缝和车缝到后道任务在直接派单、改派时统一支持自定义业务分配时间，并实时展示交付完成及 30%/70%/100% 回货截止时间。

**架构：** 保留现有时效分类、快照和派单事务作为唯一规则来源，新增一个无状态的业务预览组件，统一生成预览模型和 HTML。车缝工作台与连续工序页只维护各自的工厂、SKU、主工厂和改派状态，并通过局部 DOM 更新刷新共享时效区域。

**技术栈：** Vite、TypeScript、Vanilla TypeScript 字符串模板、Node `assert` 检查脚本、Playwright、Tailwind CSS。

---

## 文件结构

- 创建 `src/components/sewing-delivery-sla-preview.ts`：构建两类任务的统一时效预览模型，并渲染四行时效区域。
- 创建 `scripts/check-sewing-dispatch-time-preview.ts`：验证两类规则、跨日期边界、错误状态、统一文案及页面接入标记。
- 修改 `src/pages/sewing-dispatch-workbench.ts`：直接派单改用共享组件，改派增加预览和局部刷新。
- 修改 `src/pages/continuous-dispatch.ts`：直接派单和改派改用共享组件，去除实际操作时间和重复数量卡片，改为局部刷新。
- 修改 `scripts/check-sewing-dispatch-performance.ts`：增加业务分配时间变化和连续工序派单弹窗的响应时间门禁。
- 修改 `package.json`：注册新的时效预览检查命令。
- 创建 `docs/prototype-review-records/2026-07-17-sewing-dispatch-time-preview.md`：记录规范依据、页面自查、性能及例外。

## 任务 1：共享时效预览组件

**文件：**

- 创建：`src/components/sewing-delivery-sla-preview.ts`
- 创建：`scripts/check-sewing-dispatch-time-preview.ts`
- 修改：`package.json`
- 参考：`src/data/fcs/sewing-delivery-sla.ts`

- [ ] **步骤 1：注册检查脚本并编写失败的组件测试**

在 `package.json` 的检查脚本区域增加：

```json
"check:sewing-dispatch-time-preview": "node --experimental-strip-types --experimental-specifier-resolution=node scripts/check-sewing-dispatch-time-preview.ts"
```

创建 `scripts/check-sewing-dispatch-time-preview.ts`，先定义组件需要满足的公开契约：

```ts
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  buildSewingDeliverySlaPreviewModel,
  renderSewingDeliverySlaPreview,
} from '../src/components/sewing-delivery-sla-preview.ts'
import type { SewingDeliverySlaTaskLike } from '../src/data/fcs/sewing-delivery-sla.ts'

const independent: SewingDeliverySlaTaskLike = {
  taskUnitType: 'PROCESS_TASK',
  processCode: 'SEW',
  processBusinessCode: 'SEW',
  processNameZh: '车缝',
}
const sewingToPost: SewingDeliverySlaTaskLike = {
  taskUnitType: 'COMBINED_PROCESS_TASK',
  processCode: 'SEW',
  processNameZh: '车缝+后道',
  coveredProcesses: [
    { processCode: 'SEW', processName: '车缝', sourceArtifactIds: [] },
    { processCode: 'POST', processName: '后道', sourceArtifactIds: [] },
  ],
}

const sewingModel = buildSewingDeliverySlaPreviewModel({
  task: independent,
  businessAssignedAt: '2026-07-17T10:00',
  assignedQty: 400,
  currentOperationAt: '2026-07-17 10:00:00',
})
assert.equal(sewingModel.valid, true)
assert.equal(sewingModel.kindLabel, '车缝')
assert.deepEqual(sewingModel.rows.map((row) => row.deadlineAt), [
  '2026-07-26 10:00:00',
  '2026-07-21 10:00:00',
  '2026-07-25 10:00:00',
  '2026-07-26 10:00:00',
])

const continuousModel = buildSewingDeliverySlaPreviewModel({
  task: sewingToPost,
  businessAssignedAt: '2026-12-28T09:30',
  assignedQty: 1_000,
  currentOperationAt: '2026-12-28 09:30:00',
})
assert.equal(continuousModel.kindLabel, '车缝到后道')
assert.deepEqual(continuousModel.rows.map((row) => row.deadlineAt), [
  '2027-01-07 09:30:00',
  '2027-01-02 09:30:00',
  '2027-01-06 09:30:00',
  '2027-01-07 09:30:00',
])

const futureModel = buildSewingDeliverySlaPreviewModel({
  task: independent,
  businessAssignedAt: '2026-07-17T10:01',
  assignedQty: 400,
  currentOperationAt: '2026-07-17 10:00:00',
})
assert.equal(futureModel.valid, false)
assert.match(futureModel.error, /不能晚于当前时间/)
assert.equal(futureModel.rows.length, 0)

const html = renderSewingDeliverySlaPreview({
  task: independent,
  businessAssignedAt: '2026-07-17T10:00',
  assignedQty: 400,
  currentOperationAt: '2026-07-17 10:00:00',
})
for (const text of ['交付完成', '30% 回货', '70% 回货', '100% 回货', '按满 24 小时滚动', '仅接收方确认实收']) {
  assert.match(html, new RegExp(text))
}
assert.doesNotMatch(html, /实际操作时间/)

const sewingPageSource = readFileSync(new URL('../src/pages/sewing-dispatch-workbench.ts', import.meta.url), 'utf8')
const continuousPageSource = readFileSync(new URL('../src/pages/continuous-dispatch.ts', import.meta.url), 'utf8')
assert.match(sewingPageSource, /renderSewingDeliverySlaPreview/)
assert.match(continuousPageSource, /renderSewingDeliverySlaPreview/)
assert.doesNotMatch(continuousPageSource, /不能晚于实际操作时间/)

console.log('车缝派单统一时效预览检查通过')
```

- [ ] **步骤 2：运行测试并确认因组件不存在而失败**

运行：

```bash
npm run check:sewing-dispatch-time-preview
```

预期：FAIL，提示无法找到 `src/components/sewing-delivery-sla-preview.ts` 或导出函数不存在。

- [ ] **步骤 3：实现最小共享预览模型和渲染组件**

创建 `src/components/sewing-delivery-sla-preview.ts`：

```ts
import { escapeHtml } from '../utils.ts'
import {
  classifySewingDeliverySla,
  compareSewingDeliveryDateTimes,
  createSewingDeliverySlaSnapshot,
  dateTimeLocalToOperationWallClock,
  formatOperationLocalWallClock,
  type SewingDeliverySlaTaskLike,
} from '../data/fcs/sewing-delivery-sla.ts'

export interface SewingDeliverySlaPreviewInput {
  task: SewingDeliverySlaTaskLike
  businessAssignedAt: string
  assignedQty: number
  currentOperationAt?: string
}

export interface SewingDeliverySlaPreviewRow {
  label: '交付完成' | '30% 回货' | '70% 回货' | '100% 回货'
  deadlineAt: string
  requirement: string
}

export interface SewingDeliverySlaPreviewModel {
  supported: boolean
  valid: boolean
  kindLabel: '' | '车缝' | '车缝到后道'
  error: string
  rows: SewingDeliverySlaPreviewRow[]
}

export function buildSewingDeliverySlaPreviewModel(
  input: SewingDeliverySlaPreviewInput,
): SewingDeliverySlaPreviewModel {
  const slaKind = classifySewingDeliverySla(input.task)
  if (slaKind !== 'INDEPENDENT_SEWING' && slaKind !== 'SEWING_TO_PACKAGING') {
    return { supported: false, valid: false, kindLabel: '', error: '', rows: [] }
  }
  try {
    if (!input.businessAssignedAt.trim()) throw new Error('请选择业务分配时间')
    const acceptedAt = dateTimeLocalToOperationWallClock(input.businessAssignedAt)
    const currentOperationAt = input.currentOperationAt ?? formatOperationLocalWallClock()
    if (compareSewingDeliveryDateTimes(acceptedAt, currentOperationAt) > 0) {
      throw new Error('业务分配时间不能晚于当前时间')
    }
    const snapshot = createSewingDeliverySlaSnapshot({
      assignmentId: 'SEWING-DISPATCH-PREVIEW',
      runtimeTaskId: 'SEWING-DISPATCH-PREVIEW',
      productionOrderId: 'PREVIEW',
      factoryId: 'PREVIEW',
      factoryName: '预览',
      assignedQty: input.assignedQty,
      acceptedAt,
      slaKind,
    })
    const [thirty, seventy, hundred] = snapshot.milestones
    return {
      supported: true,
      valid: true,
      kindLabel: slaKind === 'INDEPENDENT_SEWING' ? '车缝' : '车缝到后道',
      error: '',
      rows: [
        { label: '交付完成', deadlineAt: hundred.deadlineAt, requirement: '前完成 100%' },
        { label: '30% 回货', deadlineAt: thirty.deadlineAt, requirement: '前确认实收达到 30%' },
        { label: '70% 回货', deadlineAt: seventy.deadlineAt, requirement: '前确认实收达到 70%' },
        { label: '100% 回货', deadlineAt: hundred.deadlineAt, requirement: '前确认实收达到 100%' },
      ],
    }
  } catch (error) {
    return {
      supported: true,
      valid: false,
      kindLabel: slaKind === 'INDEPENDENT_SEWING' ? '车缝' : '车缝到后道',
      error: error instanceof Error ? error.message : '业务分配时间格式不正确',
      rows: [],
    }
  }
}

export function renderSewingDeliverySlaPreview(input: SewingDeliverySlaPreviewInput): string {
  const model = buildSewingDeliverySlaPreviewModel(input)
  if (!model.supported) return ''
  if (!model.valid) {
    return `<section data-sewing-delivery-sla-preview data-preview-valid="false" class="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">${escapeHtml(model.error)}</section>`
  }
  return `<section data-sewing-delivery-sla-preview data-preview-valid="true" class="space-y-2 rounded-md border p-3">
    <div class="flex items-center justify-between gap-3 text-sm font-medium"><span>交付时效与按比例回货要求</span><span>${escapeHtml(model.kindLabel)}</span></div>
    ${model.rows.map((row) => `<div class="grid gap-1 text-sm sm:grid-cols-[110px_1fr]"><span class="text-muted-foreground">${row.label}</span><span class="font-medium">${escapeHtml(row.deadlineAt.slice(0, 16))} ${row.requirement}</span></div>`).join('')}
    <div class="text-xs text-muted-foreground">按满 24 小时滚动；仅接收方确认实收计入回货比例。</div>
  </section>`
}
```

- [ ] **步骤 4：运行组件测试，确认页面接入断言仍失败**

运行：

```bash
npm run check:sewing-dispatch-time-preview
```

预期：组件日期、错误和文案断言通过；页面尚未接入共享组件的断言失败。

- [ ] **步骤 5：提交共享组件和失败的页面接入测试**

```bash
git add package.json scripts/check-sewing-dispatch-time-preview.ts src/components/sewing-delivery-sla-preview.ts
git commit -m "feat: 增加车缝派单统一时效预览"
```

## 任务 2：接入独立车缝直接派单和改派

**文件：**

- 修改：`src/pages/sewing-dispatch-workbench.ts`
- 测试：`scripts/check-sewing-dispatch-time-preview.ts`

- [ ] **步骤 1：补充独立车缝页面结构断言**

在 `scripts/check-sewing-dispatch-time-preview.ts` 中增加：

```ts
assert.match(sewingPageSource, /data-sewing-direct-sla-preview-slot/)
assert.match(sewingPageSource, /data-sewing-reassign-sla-preview-slot/)
assert.match(sewingPageSource, /refreshSewingReassignmentSlaPreview/)
assert.doesNotMatch(sewingPageSource, /function renderDirectDispatchDeadlines/)
```

- [ ] **步骤 2：运行测试并确认车缝页面尚未接入而失败**

运行：

```bash
npm run check:sewing-dispatch-time-preview
```

预期：FAIL，提示缺少直接派单或改派预览插槽。

- [ ] **步骤 3：直接派单改用共享组件**

在 `src/pages/sewing-dispatch-workbench.ts`：

1. 导入 `buildSewingDeliverySlaPreviewModel` 和 `renderSewingDeliverySlaPreview`。
2. 删除页面内 `renderDirectDispatchDeadlines()`。
3. 根据候选行首个任务和全部候选行数量构造预览输入。
4. 将时效区域包在 `data-sewing-direct-sla-preview-slot` 中。
5. 确认按钮的禁用条件增加“预览时间无效”。

直接派单插槽使用：

```ts
const previewTask = getRuntimeTaskById(rows[0]?.taskId ?? '')
const previewInput = previewTask
  ? {
      task: previewTask,
      businessAssignedAt: state.dispatchBusinessAssignedAt,
      assignedQty: rows.reduce((sum, row) => sum + row.remainingQty, 0),
    }
  : null
const previewModel = previewInput ? buildSewingDeliverySlaPreviewModel(previewInput) : null
```

```html
<div data-sewing-direct-sla-preview-slot>
  ${previewInput ? renderSewingDeliverySlaPreview(previewInput) : ''}
</div>
```

- [ ] **步骤 4：改派增加共享预览和局部刷新**

在改派弹窗中使用：

```ts
const remainingQty = Math.max(task.scopeQty - confirmed, 0)
const reassignPreviewInput = {
  task,
  businessAssignedAt: state.reassignBusinessAssignedAt,
  assignedQty: remainingQty,
}
const reassignPreview = buildSewingDeliverySlaPreviewModel(reassignPreviewInput)
```

增加插槽和确认按钮标记：

```html
<div data-sewing-reassign-sla-preview-slot>
  ${renderSewingDeliverySlaPreview(reassignPreviewInput)}
</div>
<button data-sewing-reassign-confirm ...>确认改派</button>
```

增加 `refreshSewingReassignmentSlaPreview()`，只更新：

- `data-sewing-reassign-sla-preview-slot` 的内容。
- `data-sewing-reassign-confirm` 的 `disabled`、`opacity-50` 和 `cursor-not-allowed`。

业务分配时间字段发生 `change` 时调用该函数，不重绘页面或整个弹窗。

- [ ] **步骤 5：直接派单时间变化时同步更新确认按钮**

扩展现有局部刷新函数，让 `dispatchBusinessAssignedAt` 变化后同时更新：

- `data-sewing-direct-sla-preview-slot`。
- 直接派单确认按钮的可用状态。
- 时间错误提示。

提交端继续调用既有 `createSewingDispatchWorkbenchDraft()` 和 `reassignRuntimeSewingTask()`，保留二次时间校验。

- [ ] **步骤 6：运行独立车缝相关检查**

```bash
npm run check:sewing-dispatch-time-preview
npm run check:sewing-dispatch-workbench
npm run check:sewing-delivery-sla-final-fixes
```

预期：全部 PASS，且输出不包含页面接入失败。

- [ ] **步骤 7：提交独立车缝页面接入**

```bash
git add src/pages/sewing-dispatch-workbench.ts scripts/check-sewing-dispatch-time-preview.ts
git commit -m "feat: 统一独立车缝派单时效预览"
```

## 任务 3：接入车缝到后道直接派单和改派

**文件：**

- 修改：`src/pages/continuous-dispatch.ts`
- 测试：`scripts/check-sewing-dispatch-time-preview.ts`

- [ ] **步骤 1：补充连续工序页面结构断言**

在检查脚本中增加：

```ts
assert.match(continuousPageSource, /data-continuous-sla-preview-slot/)
assert.match(continuousPageSource, /refreshContinuousDispatchSlaPreview/)
assert.doesNotMatch(continuousPageSource, /function renderMilestonePreview/)
assert.doesNotMatch(continuousPageSource, /实际操作时间/)
assert.doesNotMatch(continuousPageSource, /<div class="text-muted-foreground">分配数量<\/div>/)
```

- [ ] **步骤 2：运行测试并确认连续工序页面尚未完成而失败**

```bash
npm run check:sewing-dispatch-time-preview
```

预期：FAIL，提示旧预览函数、实际操作时间或重复数量卡片仍存在。

- [ ] **步骤 3：替换连续工序时效区域**

在 `src/pages/continuous-dispatch.ts`：

1. 导入共享预览模型和渲染组件。
2. 删除 `renderMilestonePreview()`。
3. 直接派单使用任务完整数量。
4. 改派使用 `任务数量 - 已确认实收数量`。
5. 将共享组件放入 `data-continuous-sla-preview-slot`。
6. 删除“实际操作时间”文案和分配数量卡片。
7. 竞价弹窗不渲染共享时效组件。

预览输入：

```ts
const previewQty = reassign
  ? Math.max(task.scopeQty - confirmedQty, 0)
  : task.scopeQty
const previewInput = {
  task,
  businessAssignedAt: dialog.businessAssignedAt,
  assignedQty: previewQty,
}
const previewModel = buildSewingDeliverySlaPreviewModel(previewInput)
```

- [ ] **步骤 4：实现连续工序时间局部刷新**

增加 `refreshContinuousDispatchSlaPreview()`，只更新：

- `data-continuous-sla-preview-slot`。
- `data-continuous-dispatch-confirm` 的可用状态。
- 时间错误提示。

在字段事件处理中对 `businessAssignedAt` 单独分支：更新状态后调用局部刷新并立即返回；工厂、主工厂等其他字段继续沿用现有刷新行为。

- [ ] **步骤 5：保留提交端二次校验和快照逻辑**

确认直接派单继续向 `applyRuntimeDirectDispatchMeta()` 传入：

```ts
businessAssignedAt,
operatedAt,
autoAccept: true,
```

确认改派继续向 `reassignRuntimeSewingTask()` 传入同一业务分配时间，并由领域事务在提交时重新计算剩余数量。

- [ ] **步骤 6：运行连续工序和时效回归检查**

```bash
npm run check:sewing-dispatch-time-preview
npm run check:sewing-delivery-sla
npm run check:sewing-delivery-sla-adversarial-ui
npm run check:fcs-task-generation-rules
```

预期：全部 PASS；竞价发起仍不生成时效快照。

- [ ] **步骤 7：提交连续工序页面接入**

```bash
git add src/pages/continuous-dispatch.ts scripts/check-sewing-dispatch-time-preview.ts
git commit -m "feat: 统一连续车缝派单时效预览"
```

## 任务 4：性能、浏览器验收和治理收口

**文件：**

- 修改：`scripts/check-sewing-dispatch-performance.ts`
- 创建：`docs/prototype-review-records/2026-07-17-sewing-dispatch-time-preview.md`
- 可能修改：`scripts/check-sewing-dispatch-time-preview.ts`（仅补充验收中发现的回归断言）

- [ ] **步骤 1：先扩展性能检查并确认缺少局部刷新标记时失败**

在 `scripts/check-sewing-dispatch-performance.ts` 增加两项计时：

1. 独立车缝直接派单弹窗修改业务分配时间，到 `data-sewing-direct-sla-preview-slot` 被替换完成。
2. 连续工序直接派单弹窗修改业务分配时间，到 `data-continuous-sla-preview-slot` 被替换完成。

两项都必须断言：

```ts
assert(duration <= budgetMs, `业务分配时间刷新 ${duration.toFixed(2)}ms，超过 ${budgetMs}ms`)
assert.equal(await rootHandle.evaluate((node) => node.isConnected), true)
```

- [ ] **步骤 2：运行性能检查**

先启动本地服务：

```bash
npm run dev -- --host 0.0.0.0 --port 5188
```

另一个终端运行：

```bash
HIGOOD_BASE_URL=http://127.0.0.1:5188 npm run check:sewing-dispatch-performance
```

预期：现有三项和新增两项交互均不超过 200ms。

- [ ] **步骤 3：浏览器验收四个入口**

在 1366×768 和 1280×720 下分别检查：

- 车缝直接派单。
- 车缝改派。
- 车缝到后道直接派单。
- 车缝到后道改派。

验收内容：四行具体时间、修改时间实时刷新、无实际操作时间、底部按钮可达、其他字段不丢失。

- [ ] **步骤 4：编写原型审查记录**

创建 `docs/prototype-review-records/2026-07-17-sewing-dispatch-time-preview.md`，明确记录：

- 参考了角色、管理端页面模式、短文案、防错、局部刷新和 200ms 性能规范。
- 四个入口的业务对象和动作。
- 1366×768、1280×720 验收结论。
- 竞价、裁片到包装和非车缝任务不在本次范围。
- 无产品设计例外；如列表治理存在既有豁免，只记录事实，不修改基线绕过检查。

- [ ] **步骤 5：运行完整门禁**

```bash
npm run check:sewing-dispatch-time-preview
npm run check:sewing-dispatch-workbench
npm run check:sewing-delivery-sla
npm run check:sewing-delivery-sla-final-fixes
npm run check:sewing-delivery-sla-adversarial-ui
npm run check:sewing-dispatch-performance
npm run check:prototype-design-governance
npm run check:list-page-governance
npm run build
```

预期：全部 PASS。如果列表治理失败于本次未修改的其他页面，保留完整失败证据，不修改基线文件，并单独报告既有阻塞。

- [ ] **步骤 6：同步 CodeGraph 并确认索引健康**

```bash
codegraph sync
codegraph status
```

预期：索引同步完成，无本次文件处于 pending 状态。

- [ ] **步骤 7：提交性能和审查记录**

```bash
git add scripts/check-sewing-dispatch-performance.ts scripts/check-sewing-dispatch-time-preview.ts docs/prototype-review-records/2026-07-17-sewing-dispatch-time-preview.md
git commit -m "test: 收口车缝派单时效预览验收"
```

## 计划自检结果

- 规格覆盖：四个入口、两类任务、直接派单与改派、时间校验、局部刷新、正式快照、回归范围、性能和浏览器验收均有对应任务。
- 范围控制：竞价、裁片到包装、非车缝任务、配料、工厂能力和主工厂规则没有进入实现任务。
- 类型一致性：共享组件统一使用 `SewingDeliverySlaPreviewInput`、`SewingDeliverySlaPreviewModel` 和 `SewingDeliverySlaPreviewRow`；四个入口复用相同模型。
- 无占位步骤：每个代码任务均给出具体文件、函数契约、命令和预期结果。
