# 配料详情摘要区清理实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 删除各分类配料详情页 Tab 上方的大块摘要区，并把有用信息迁移到对应 Tab 内。

**架构：** 不做大模板重构。裁片配料保持当前形态；染色、印花、车缝、其他四个高度相似页面按同一规则做本地最小改动。新增一个检查脚本直接渲染详情页 HTML，防止摘要区回归。

**技术栈：** Vite、TypeScript、Vanilla TypeScript 字符串模板、现有本地 mock 数据、Node 检查脚本。

---

## 文件结构

- 创建：`scripts/check-material-prep-detail-summary-cleanup.ts`
  - 渲染五个配料详情页，检查 Tab 上方没有摘要区。
  - 检查迁移后的关键信息在对应 Tab 中可见。
- 修改：`package.json`
  - 增加 `check:material-prep-detail-summary-cleanup`。
- 修改：`src/pages/fcs/material-prep/dyeing.ts`
  - 删除详情页 Tab 上方摘要区。
  - 把摘要信息迁移到现有 Tab。
- 修改：`src/pages/fcs/material-prep/printing.ts`
  - 同染色配料。
- 修改：`src/pages/fcs/material-prep/sewing.ts`
  - 同染色配料。
- 修改：`src/pages/fcs/material-prep/other.ts`
  - 同染色配料。
- 修改：`src/pages/fcs/material-prep/cutting.ts`
  - 只做回归检查需要的小补齐；不恢复摘要区。
- 修改：`docs/prototype-review-records/2026-07-09-material-prep-detail-summary-cleanup.md`
  - 新增本次原型审查记录。

## 任务 1：新增失败检查

**文件：**
- 创建：`scripts/check-material-prep-detail-summary-cleanup.ts`
- 修改：`package.json`

- [ ] **步骤 1：创建检查脚本**

创建 `scripts/check-material-prep-detail-summary-cleanup.ts`：

```ts
#!/usr/bin/env node

import { listMaterialPrepOrderProjections } from '../src/data/fcs/cutting/production-material-prep.ts'
import { renderFcsCuttingPrepPage } from '../src/pages/fcs/material-prep/cutting.ts'
import { renderFcsDyeingPrepPage } from '../src/pages/fcs/material-prep/dyeing.ts'
import { renderFcsOtherPrepPage } from '../src/pages/fcs/material-prep/other.ts'
import { renderFcsPrintingPrepPage } from '../src/pages/fcs/material-prep/printing.ts'
import { renderFcsSewingPrepPage } from '../src/pages/fcs/material-prep/sewing.ts'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

type PageCase = {
  label: string
  pathname: string
  render: () => string
}

const pageCases: PageCase[] = [
  { label: '染色配料', pathname: '/fcs/material-prep/dyeing', render: renderFcsDyeingPrepPage },
  { label: '印花配料', pathname: '/fcs/material-prep/printing', render: renderFcsPrintingPrepPage },
  { label: '裁片配料', pathname: '/fcs/material-prep/cutting', render: renderFcsCuttingPrepPage },
  { label: '车缝配料', pathname: '/fcs/material-prep/sewing', render: renderFcsSewingPrepPage },
  { label: '其他配料', pathname: '/fcs/material-prep/other', render: renderFcsOtherPrepPage },
]

const originalWindow = (globalThis as typeof globalThis & { window?: unknown }).window

function withWindow(pathname: string, search: string, render: () => string): string {
  ;(globalThis as typeof globalThis & { window: unknown }).window = {
    location: { pathname, search },
    history: { pushState() {}, replaceState() {} },
    addEventListener() {},
    removeEventListener() {},
  }
  return render()
}

function beforeTabs(html: string): string {
  const firstTabIndex = html.indexOf('data-nav="')
  return firstTabIndex >= 0 ? html.slice(0, firstTabIndex) : html
}

try {
  const firstOrder = listMaterialPrepOrderProjections()[0]
  assert(firstOrder, '检查脚本需要至少一条配料单 mock 数据')

  for (const item of pageCases) {
    const baseSearch = `?prepOrderId=${encodeURIComponent(firstOrder.order.prepOrderId)}`
    const html = withWindow(item.pathname, baseSearch, item.render)
    assert(html.includes('生产需求信息'), `${item.label} 详情必须保留 Tab`)
    const summaryBeforeTabs = beforeTabs(html)
    ;['配料状态', '领料状态', '物料行', '缺料缺口', 'BOM 来源', '暂存区台账', '仓库拣货进度', '完成通知', '分配回写'].forEach((text) => {
      assert(!summaryBeforeTabs.includes(text), `${item.label} Tab 上方不能再展示摘要字段：${text}`)
    })

    const demandHtml = withWindow(item.pathname, `${baseSearch}&detailTab=demand`, item.render)
    assert(demandHtml.includes('BOM 来源'), `${item.label} 生产需求信息 Tab 必须展示 BOM 来源`)

    const inventoryHtml = withWindow(item.pathname, `${baseSearch}&detailTab=inventory`, item.render)
    assert(inventoryHtml.includes('缺料缺口'), `${item.label} 库存与上游 Tab 必须展示缺料缺口`)

    const recordsHtml = withWindow(item.pathname, `${baseSearch}&detailTab=records`, item.render)
    assert(recordsHtml.includes('暂存区台账'), `${item.label} 配料记录 Tab 必须展示暂存区台账`)
    assert(recordsHtml.includes('完成通知'), `${item.label} 配料记录 Tab 必须展示完成通知`)

    const tasksHtml = withWindow(item.pathname, `${baseSearch}&detailTab=tasks`, item.render)
    assert(tasksHtml.includes('分配回写'), `${item.label} 按任务查看 Tab 必须展示分配回写`)

    const pickupHtml = withWindow(item.pathname, `${baseSearch}&detailTab=pickup`, item.render)
    assert(pickupHtml.includes('领料状态'), `${item.label} 领料记录 Tab 必须展示领料状态`)
    assert(pickupHtml.includes('仓库拣货进度'), `${item.label} 领料记录 Tab 必须展示仓库拣货进度`)
  }
} finally {
  if (originalWindow === undefined) {
    delete (globalThis as typeof globalThis & { window?: unknown }).window
  } else {
    ;(globalThis as typeof globalThis & { window: unknown }).window = originalWindow
  }
}

console.log('配料详情摘要区清理检查通过')
```

- [ ] **步骤 2：增加 npm 脚本**

在 `package.json` 的 `scripts` 中增加：

```json
"check:material-prep-detail-summary-cleanup": "node --experimental-strip-types --experimental-specifier-resolution=node scripts/check-material-prep-detail-summary-cleanup.ts"
```

- [ ] **步骤 3：运行检查确认失败**

运行：

```bash
npm run check:material-prep-detail-summary-cleanup
```

预期：FAIL，至少在染色、印花、车缝或其他配料详情页报 `Tab 上方不能再展示摘要字段`。

- [ ] **步骤 4：Commit**

```bash
git add scripts/check-material-prep-detail-summary-cleanup.ts package.json
git commit -m "test: cover material prep detail summary cleanup"
```

## 任务 2：处理四个相似分类配料详情页

**文件：**
- 修改：`src/pages/fcs/material-prep/dyeing.ts`
- 修改：`src/pages/fcs/material-prep/printing.ts`
- 修改：`src/pages/fcs/material-prep/sewing.ts`
- 修改：`src/pages/fcs/material-prep/other.ts`

- [ ] **步骤 1：删除详情页 Tab 上方摘要区**

在四个文件的详情页渲染函数中删除这两段调用：

```ts
<section class="grid gap-3 md:grid-cols-4">
  ${renderKpi('配料状态', ...)}
  ${renderKpi('领料状态', ...)}
  ${renderKpi('物料行', ...)}
  ${renderKpi('缺料缺口', ...)}
</section>

${renderImplementationStatus(projection)}
```

处理后详情页结构必须变为：

```ts
${renderDetail(projection, activeDetailTab)}
${showPrepModal ? renderAddPrepRecordModal(projection, activeDetailTab) : ''}
${showCloseModal && !projection.order.isClosed ? renderClosePrepOrderModal(projection, activeDetailTab) : ''}
```

如果文件里 `renderKpi` 和 `renderImplementationStatus` 不再被使用，删除这两个函数。

- [ ] **步骤 2：迁移基础状态到生产需求信息 Tab**

在四个文件的 `renderProductionDemand(projection)` 中，在生产需求基础字段下补一块小型信息区：

```ts
<div class="mt-3 grid gap-3 text-sm lg:grid-cols-4">
  <div><div class="text-xs text-muted-foreground">配料状态</div><div class="font-medium">${escapeHtml(materialPrepStatusLabelMap[projection.order.overallPrepStatus])}</div></div>
  <div><div class="text-xs text-muted-foreground">领料状态</div><div class="font-medium">${escapeHtml(pickupStatusLabelMap[projection.order.pickupStatus])}</div></div>
  <div><div class="text-xs text-muted-foreground">BOM 来源</div><div class="font-medium">${escapeHtml(projection.order.bomSourceLabel)}</div></div>
  <div><div class="text-xs text-muted-foreground">BOM 展开时间</div><div class="font-medium">${escapeHtml(projection.order.bomExpandedAt || '暂无')}</div></div>
</div>
```

- [ ] **步骤 3：迁移物料行和缺料缺口到库存与上游 Tab**

在四个文件的 `renderInventoryProgress(...)` 顶部补一块摘要：

```ts
<div class="mb-3 grid gap-3 text-sm lg:grid-cols-3">
  <div class="rounded-md border bg-muted/20 px-3 py-2">
    <div class="text-xs text-muted-foreground">物料行</div>
    <div class="mt-1 font-medium">${projection.readyLineCount}/${projection.lineCount}</div>
    <div class="mt-1 text-xs text-muted-foreground">未配齐 ${projection.shortageLineCount} 行，库存充足 ${projection.stockSufficientLineCount} 行，库存不足 ${projection.stockInsufficientLineCount} 行，无库存 ${projection.noStockLineCount} 行</div>
  </div>
  <div class="rounded-md border bg-muted/20 px-3 py-2">
    <div class="text-xs text-muted-foreground">缺料缺口</div>
    <div class="mt-1 font-medium">${formatQty(projection.totalShortageQty)}</div>
    <div class="mt-1 text-xs text-muted-foreground">最早可配 ${escapeHtml(projection.earliestExpectedAvailableAt || '暂无')}</div>
  </div>
</div>
```

如果当前 `renderInventoryProgress` 只接收 `lines`，把签名改为接收 `projection: MaterialPrepOrderProjection`，在内部使用 `projection.lines`。同步修改 `renderDetail(...)` 调用。

- [ ] **步骤 4：迁移暂存区台账和完成通知到配料记录 Tab**

在四个文件的 `renderPrepRecords(...)` 顶部补一块摘要：

```ts
const stagingText = projection.order.stagingLedgerCreated ? '已有暂存台账' : '暂无暂存台账'

<div class="mb-3 grid gap-3 text-sm lg:grid-cols-2">
  <div class="rounded-md border bg-muted/20 px-3 py-2">
    <div class="text-xs text-muted-foreground">暂存区台账</div>
    <div class="mt-1 font-medium">${escapeHtml(stagingText)}</div>
    <div class="mt-1 text-xs text-muted-foreground">入暂存区时生成，确认或打回时同步状态</div>
  </div>
  <div class="rounded-md border bg-muted/20 px-3 py-2">
    <div class="text-xs text-muted-foreground">完成通知</div>
    <div class="mt-1 font-medium">${projection.order.prepCompletionEventCount} 条</div>
    <div class="mt-1 text-xs text-muted-foreground">确认后生成配料完成通知事件</div>
  </div>
</div>
```

如果当前 `renderPrepRecords` 只接收局部 records，增加 `projection` 参数或从调用处传入需要的字段。保持改动局部，不抽大组件。

- [ ] **步骤 5：迁移分配回写到按任务查看 Tab**

在四个文件的 `renderTaskPrepOverview(projection)` 顶部补：

```ts
const pendingTaskCount = Math.max(projection.order.assignedTaskCount - projection.order.assignmentWrittenBackCount, 0)
```

并渲染：

```ts
<div class="mb-3 rounded-md border bg-muted/20 px-3 py-2 text-sm">
  <div class="text-xs text-muted-foreground">分配回写</div>
  <div class="mt-1 font-medium">${pendingTaskCount} 个任务待分配后回写工厂</div>
  <div class="mt-1 text-xs text-muted-foreground">已回写 ${projection.order.assignmentWrittenBackCount} 个任务</div>
</div>
```

- [ ] **步骤 6：迁移领料状态和仓库拣货进度到领料记录 Tab**

在四个文件的 `renderPickupRecords(...)` 顶部补：

```ts
const pickText = projection.order.pickupStatus === 'PICKUP_DONE'
  ? '已领料完结'
  : projection.pickupRecords.length
    ? `已有领料记录 ${projection.pickupRecords.length} 条`
    : '暂无领料记录'
```

并渲染：

```ts
<div class="mb-3 grid gap-3 text-sm lg:grid-cols-2">
  <div class="rounded-md border bg-muted/20 px-3 py-2">
    <div class="text-xs text-muted-foreground">领料状态</div>
    <div class="mt-1 font-medium">${escapeHtml(pickupStatusLabelMap[projection.order.pickupStatus])}</div>
    <div class="mt-1 text-xs text-muted-foreground">已领 ${formatQty(projection.totalPickedQty)} / 可领 ${formatQty(projection.totalAvailableToPickupQty)}</div>
  </div>
  <div class="rounded-md border bg-muted/20 px-3 py-2">
    <div class="text-xs text-muted-foreground">仓库拣货进度</div>
    <div class="mt-1 font-medium">${escapeHtml(pickText)}</div>
    <div class="mt-1 text-xs text-muted-foreground">已确认 ${projection.prepRecords.filter((record) => record.recordStatus === 'CONFIRMED').length} 条</div>
  </div>
</div>
```

如果当前 `renderPickupRecords` 只接收 `records` 和 `rejectRecords`，把签名改为 `renderPickupRecords(projection: MaterialPrepOrderProjection)`，在内部取 `projection.pickupRecords` / `projection.rejectRecords` / `projection.order.productionOrderNo`。

- [ ] **步骤 7：运行检查通过**

运行：

```bash
npm run check:material-prep-detail-summary-cleanup
npm run build
```

预期：两个命令都 PASS。

- [ ] **步骤 8：Commit**

```bash
git add src/pages/fcs/material-prep/dyeing.ts src/pages/fcs/material-prep/printing.ts src/pages/fcs/material-prep/sewing.ts src/pages/fcs/material-prep/other.ts
git commit -m "fix: move material prep detail summary into tabs"
```

## 任务 3：裁片回归、治理记录和最终验证

**文件：**
- 修改：`src/pages/fcs/material-prep/cutting.ts`
- 创建：`docs/prototype-review-records/2026-07-09-material-prep-detail-summary-cleanup.md`
- 修改：`scripts/check-material-prep-performance.ts`（仅当现有性能脚本无法覆盖详情切换时）

- [ ] **步骤 1：确认裁片配料不回退**

运行：

```bash
npm run check:material-prep-detail-summary-cleanup
```

如果裁片配料缺少迁移后的某个 Tab 信息，只补对应 Tab 内小块信息，不恢复 Tab 上方摘要区。

- [ ] **步骤 2：新增原型审查记录**

创建 `docs/prototype-review-records/2026-07-09-material-prep-detail-summary-cleanup.md`：

```md
# 配料详情摘要区清理原型审查记录

## 审查对象

- `/fcs/material-prep/dyeing`
- `/fcs/material-prep/printing`
- `/fcs/material-prep/cutting`
- `/fcs/material-prep/sewing`
- `/fcs/material-prep/other`

## 范围

本次只处理配料详情页 Tab 上方摘要区。列表页统计区、配料状态模型、领料状态模型、仓储后续流程不在范围内。

## 自查结论

- 角色匹配：通过。
- 信息架构：通过，详情页首屏从“摘要卡片 + Tab”调整为“标题 + Tab + 当前内容”。
- 信息迁移：通过，配料状态、领料状态、物料行、缺料缺口、BOM 来源、暂存台账、拣货进度、完成通知、分配回写已迁入对应 Tab。
- 文案中文化：通过。
- 数量与状态：通过，未新增英文状态码。
- 性能：通过构建和专项脚本验证。
```

- [ ] **步骤 3：完整验证**

运行：

```bash
npm run check:material-prep-detail-summary-cleanup
npm run check:cutting-prep-pickup-return-linkage
npm run check:material-prep-performance -- http://127.0.0.1:5174
npm run check:prototype-design-governance -- --all
npm run build
codegraph sync
codegraph status
```

预期：

- 所有检查 PASS。
- CodeGraph 显示索引 up to date。

- [ ] **步骤 4：Commit**

```bash
git add src/pages/fcs/material-prep/cutting.ts docs/prototype-review-records/2026-07-09-material-prep-detail-summary-cleanup.md scripts/check-material-prep-performance.ts
git commit -m "test: verify material prep detail summary cleanup"
```

## 自检

- 规格覆盖：删除 Tab 上方摘要区、信息迁移、五个分类配料详情、治理记录、验证脚本均有任务覆盖。
- 范围控制：不改列表页统计区，不改状态模型，不改仓储后续功能。
- YAGNI：不做大模板重构；四个相似文件做机械同步，裁片只做回归补齐。
- 风险：四个分类页面重复度高，执行时应优先用同一补丁模式，避免一个页面漏改。
