# 裁床物料退回中转仓实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 仅在配料和领料两个模块内，支持裁床已领入待加工仓的物料按物料行部分退回中转仓，并保留原配料记录 `已确认` 的历史事实。

**架构：** 在 `production-material-prep.ts` 增加“领料后退回”事实和待加工仓剩余数量派生，不把退回复用为配料阶段打回。领料管理页面负责发起退回和展示退回追溯；仓储收回、待质检判定、换料重配、无法补料等仓储/质检处理不在本次范围。

**技术栈：** Vite、TypeScript、Vanilla TypeScript 字符串模板、本地 Mock 数据、Playwright 检查脚本。

---

## 文件结构

- 修改：`src/data/fcs/cutting/production-material-prep.ts`
  - 增加退回原因、退回状态、退回记录类型。
  - 在 workflow store 中持久化 `pickupReturnRecords`。
  - 增加退回新增、退回数量汇总、领料记录派生状态。
- 修改：`src/pages/process-factory/cutting/pickup-management.ts`
  - 在领料详情 `待加工仓入库记录` 中展示退回入口。
  - 增加退回弹窗、原因必填校验、图片凭证选填。
  - 增加 `退回处理` 明细页签，只展示配料/领料侧退回事实，不提供仓储处理按钮。
- 修改：`src/pages/fcs/material-prep/cutting.ts`
  - 在配料详情的领料记录区域展示已退数量、待加工仓剩余数量和退回状态。
- 创建：`scripts/check-cutting-material-return.ts`
  - 自检配料记录不回退、退回数量扣减待加工仓、领料记录派生 `部分退回` / `全部退回`。
- 修改：`package.json`
  - 增加 `check:cutting-material-return`。
- 创建：`docs/prototype-review-records/2026-07-09-cutting-material-return.md`
  - 按印尼工厂现场协同规范记录页面/交互自查。

## 前置命令

- [ ] **步骤 1：确认 CodeGraph 和工作区状态**

运行：

```bash
codegraph sync && codegraph status
git status --short
```

预期：

- CodeGraph 显示 `Index is up to date`。
- 工作区可能已有配料性能优化相关未提交改动；不要回退用户或其他任务的改动。

## 任务 1：数据模型和自检脚本

**文件：**
- 修改：`src/data/fcs/cutting/production-material-prep.ts`
- 创建：`scripts/check-cutting-material-return.ts`
- 修改：`package.json`

- [ ] **步骤 1：先写失败检查脚本**

创建 `scripts/check-cutting-material-return.ts`：

```typescript
#!/usr/bin/env node

import {
  appendPickupRecordFromPrepRecord,
  appendPickupReturnRecord,
  createProductionMaterialPrepSeedStore,
  getMaterialPrepRecordContext,
  listPickupCandidates,
  listPickupReturnRecords,
  PRODUCTION_MATERIAL_PREP_STORAGE_KEY,
} from '../src/data/fcs/cutting/production-material-prep.ts'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

class MemoryStorage {
  private readonly values = new Map<string, string>()

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }

  removeItem(key: string): void {
    this.values.delete(key)
  }
}

const storage = new MemoryStorage()
storage.setItem(PRODUCTION_MATERIAL_PREP_STORAGE_KEY, JSON.stringify(createProductionMaterialPrepSeedStore()))

const candidate = listPickupCandidates(storage).find((item) => item.prepRecordId === 'prep-rec-po-0007-main-001')
assert(candidate, '必须存在可领料配料记录')
const line = candidate.items[0]
assert(line, '必须存在可退回物料行')

appendPickupRecordFromPrepRecord({
  prepRecordId: candidate.prepRecordId,
  prepLineId: line.prepLineId,
  pickedQty: line.availableToPickupQty,
  rollCount: line.rollCount,
  receiverName: '裁床 李明',
  warehouseArea: '裁床待加工仓 A 区',
  locationCode: 'CUT-A-001',
  waitProcessLedgerEventId: 'wait-process:test:return',
}, storage)

const pickedContext = getMaterialPrepRecordContext(candidate.prepRecordId, line.prepLineId, storage)
assert(pickedContext?.record.recordStatus === 'CONFIRMED', '领料后配料记录仍必须保持已确认')
assert(pickedContext.availableToPickupQty === 0, '已全部领料后不可重复领')

const pickupRecord = pickedContext.projection.pickupRecords.find((record) => record.prepLineId === line.prepLineId)
assert(pickupRecord, '必须生成领料记录')

const returnRecord = appendPickupReturnRecord({
  pickupRecordId: pickupRecord.pickupRecordId,
  prepRecordId: candidate.prepRecordId,
  prepLineId: line.prepLineId,
  returnQty: 10,
  rollCount: 1,
  reason: '布面瑕疵',
  remark: '开工前验布发现破洞',
  imageNames: [],
  returnedBy: '裁床 李明',
}, storage)

assert(returnRecord.returnStatus === '已退回待中转仓处理', '退回后只进入待中转仓处理状态')
assert(listPickupReturnRecords(storage).length === 1, '必须保存退回记录')

const returnedContext = getMaterialPrepRecordContext(candidate.prepRecordId, line.prepLineId, storage)
assert(returnedContext?.record.recordStatus === 'CONFIRMED', '退回不能改写配料记录状态')
const returnedPickup = returnedContext.projection.pickupRecords.find((record) => record.pickupRecordId === pickupRecord.pickupRecordId)
assert(returnedPickup?.returnStatus === '部分退回', '部分退回后领料记录必须派生为部分退回')
assert(returnedPickup.returnQty === 10, '已退数量必须等于退回数量')
assert(returnedPickup.waitProcessAvailableQty === Number(returnedPickup.pickedQty || 0) - 10, '待加工仓剩余数量必须扣减退回数量')
assert(!listPickupCandidates(storage).some((item) => item.prepRecordId === candidate.prepRecordId), '配料/领料模块内不自动生成仓储处理后的补领候选')

appendPickupReturnRecord({
  pickupRecordId: pickupRecord.pickupRecordId,
  prepRecordId: candidate.prepRecordId,
  prepLineId: line.prepLineId,
  returnQty: returnedPickup.waitProcessAvailableQty,
  rollCount: 1,
  reason: '数量不符',
  remark: '',
  imageNames: [],
  returnedBy: '裁床 李明',
}, storage)

const fullyReturnedContext = getMaterialPrepRecordContext(candidate.prepRecordId, line.prepLineId, storage)
const fullyReturnedPickup = fullyReturnedContext?.projection.pickupRecords.find((record) => record.pickupRecordId === pickupRecord.pickupRecordId)
assert(fullyReturnedPickup?.returnStatus === '全部退回', '全部退完后领料记录必须派生为全部退回')
assert(fullyReturnedPickup.waitProcessAvailableQty === 0, '全部退回后待加工仓剩余数量必须为 0')

console.log('裁床物料退回中转仓检查通过')
```

- [ ] **步骤 2：在 `package.json` 增加脚本**

在 `scripts` 中加入：

```json
"check:cutting-material-return": "node --experimental-strip-types --experimental-specifier-resolution=node scripts/check-cutting-material-return.ts"
```

- [ ] **步骤 3：运行检查确认失败**

运行：

```bash
npm run check:cutting-material-return
```

预期：FAIL，报错包含 `appendPickupReturnRecord` 未导出。

- [ ] **步骤 4：增加退回类型、领料派生字段和 store 字段**

在 `src/data/fcs/cutting/production-material-prep.ts` 的 `PickupRecord` 附近增加：

```typescript
export type MaterialPickupReturnReason =
  | '色差 / 缸差'
  | '布面瑕疵'
  | '规格 / 克重不符'
  | '卷号 / 批次不符'
  | '数量不符'
  | '辅料型号不符'
  | '其他'

export type MaterialPickupReturnStatus = '已退回待中转仓处理'
export type MaterialPickupDerivedReturnStatus = '未退回' | '部分退回' | '全部退回'

export interface MaterialPickupReturnRecord {
  returnRecordId: string
  pickupRecordId: string
  prepRecordId: string
  prepOrderId: string
  prepLineId: string
  productionOrderId: string
  returnQty: number
  rollCount: number
  unit: string
  reason: MaterialPickupReturnReason
  remark: string
  imageNames: string[]
  returnedBy: string
  returnedAt: string
  returnStatus: MaterialPickupReturnStatus
}
```

扩展 `PickupRecord`：

```typescript
  returnQty?: number
  waitProcessAvailableQty?: number
  returnStatus?: MaterialPickupDerivedReturnStatus
```

扩展 `ProductionMaterialPrepWorkflowStore`：

```typescript
pickupReturnRecords: MaterialPickupReturnRecord[]
```

在 `createProductionMaterialPrepSeedStore()` 返回值和 hydrate 兼容逻辑里补 `pickupReturnRecords: []`。

- [ ] **步骤 5：实现退回 helper 和派生逻辑**

新增 helper：

```typescript
export function getPickupReturnQty(returnRecords: MaterialPickupReturnRecord[], pickupRecordId: string): number {
  return roundQty(
    returnRecords
      .filter((record) => record.pickupRecordId === pickupRecordId)
      .reduce((sum, record) => sum + Number(record.returnQty || 0), 0),
  )
}

function applyPickupReturnProjection(
  pickupRecords: PickupRecord[],
  returnRecords: MaterialPickupReturnRecord[],
): PickupRecord[] {
  return pickupRecords.map((record) => {
    const returnQty = getPickupReturnQty(returnRecords, record.pickupRecordId)
    const waitProcessAvailableQty = roundQty(Math.max(Number(record.pickedQty || 0) - returnQty, 0))
    return {
      ...record,
      returnQty,
      waitProcessAvailableQty,
      returnStatus: returnQty <= 0 ? '未退回' : waitProcessAvailableQty > 0 ? '部分退回' : '全部退回',
    }
  })
}

export function listPickupReturnRecords(
  storage: BrowserStorageLike | null = getBrowserLocalStorage(),
): MaterialPickupReturnRecord[] {
  return cloneRecord(hydrateProductionMaterialPrepStore(storage).pickupReturnRecords || [])
}
```

实现新增退回：

```typescript
export function appendPickupReturnRecord(
  input: {
    pickupRecordId: string
    prepRecordId: string
    prepLineId: string
    returnQty: number
    rollCount: number
    reason: MaterialPickupReturnReason
    remark?: string
    imageNames?: string[]
    returnedBy: string
  },
  storage: BrowserStorageLike | null = getBrowserLocalStorage(),
): MaterialPickupReturnRecord {
  if (!input.reason) throw new Error('退回原因必填')
  if (input.returnQty <= 0) throw new Error('退回数量必须大于 0')
  const store = hydrateProductionMaterialPrepStore(storage)
  const pickup = store.pickupRecords.find((record) => record.pickupRecordId === input.pickupRecordId)
  if (!pickup) throw new Error(`领料记录不存在：${input.pickupRecordId}`)
  const returnedQty = getPickupReturnQty(store.pickupReturnRecords || [], pickup.pickupRecordId)
  if (roundQty(returnedQty + input.returnQty) > pickup.pickedQty) throw new Error('退回数量不能超过待加工仓可用数量')
  const occurredAt = nowText()
  const line = materialPrepSeedOrders.flatMap((order) => order.lines).find((item) => item.prepLineId === input.prepLineId)
  const returnRecord: MaterialPickupReturnRecord = {
    returnRecordId: `return:${input.pickupRecordId}:${occurredAt.replace(/[^0-9]/g, '')}`,
    pickupRecordId: input.pickupRecordId,
    prepRecordId: input.prepRecordId,
    prepOrderId: pickup.prepOrderId,
    prepLineId: input.prepLineId,
    productionOrderId: pickup.productionOrderId,
    returnQty: roundQty(input.returnQty),
    rollCount: Math.max(Math.round(input.rollCount || 1), 1),
    unit: line?.unit || 'yard',
    reason: input.reason,
    remark: input.remark?.trim() || '',
    imageNames: [...(input.imageNames || [])],
    returnedBy: input.returnedBy,
    returnedAt: occurredAt,
    returnStatus: '已退回待中转仓处理',
  }
  store.pickupReturnRecords = [returnRecord, ...(store.pickupReturnRecords || [])]
  persistProductionMaterialPrepStore(store, storage)
  return cloneRecord(returnRecord)
}
```

在构建 `MaterialPrepOrderProjection` 的位置：

- 按 `prepOrderId` 过滤 `pickupReturnRecords`。
- 用 `applyPickupReturnProjection()` 包装该配料单的 `pickupRecords`。
- `totalPickedQty` 保持已领总量，不因退回改写历史。
- 新增 `totalReturnedQty` 汇总已退量。

- [ ] **步骤 6：运行检查确认通过**

运行：

```bash
npm run check:cutting-material-return
```

预期：

```text
裁床物料退回中转仓检查通过
```

- [ ] **步骤 7：Commit**

```bash
git add src/data/fcs/cutting/production-material-prep.ts scripts/check-cutting-material-return.ts package.json
git commit -m "feat: add cutting material return facts"
```

## 任务 2：领料管理页面展示和退回操作

**文件：**
- 修改：`src/pages/process-factory/cutting/pickup-management.ts`

- [ ] **步骤 1：扩展导入和页签类型**

在导入中增加：

```typescript
  appendPickupReturnRecord,
  type MaterialPickupReturnReason,
```

把 `PickupDetailTab` 改为：

```typescript
type PickupDetailTab = 'demand' | 'records' | 'materials' | 'warehouse' | 'returns' | 'reject'
```

把 `getActiveDetailTab()` 改为：

```typescript
function getActiveDetailTab(params: URLSearchParams): PickupDetailTab {
  const value = params.get('detailTab')
  if (value === 'records' || value === 'materials' || value === 'warehouse' || value === 'returns' || value === 'reject') return value
  return 'demand'
}
```

- [ ] **步骤 2：增加 `退回处理` 页签**

在 `renderDetailTabs()` 的 tabs 中加入：

```typescript
{ key: 'returns', label: '退回处理', count: `${projection.pickupReturnRecords.length} 条` },
```

在 `renderPickupDetail()` 中加入：

```typescript
: activeTab === 'returns'
  ? renderPickupReturns(projection)
```

- [ ] **步骤 3：在待加工仓入库记录增加退回入口**

在 `renderWarehousePickupRecords()` 中按派生字段展示：

```typescript
const returnedQty = Number(record.returnQty || 0)
const remainingQty = Number(record.waitProcessAvailableQty ?? record.pickedQty ?? 0)
```

状态列加入：

```typescript
<div class="mt-1 text-xs text-muted-foreground">已退：${formatQty(returnedQty, line?.unit || 'yard')}</div>
<div class="mt-1 text-xs text-muted-foreground">待加工仓剩余：${formatQty(remainingQty, line?.unit || 'yard')}</div>
```

操作列加入：

```typescript
${remainingQty > 0 ? `
  <button type="button" data-nav="${escapeHtml(buildDetailStateHref(projection, {
    detailTab: 'warehouse',
    prepRecordId: record.prepRecordId,
    prepLineId: record.prepLineId,
  }) + `&returnPickupRecordId=${encodeURIComponent(record.pickupRecordId)}`)}" class="rounded-md border border-amber-200 px-3 py-1.5 text-xs text-amber-700 hover:bg-amber-50">退回物料</button>
` : '<span class="text-xs text-muted-foreground">已全部退回</span>'}
```

- [ ] **步骤 4：新增退回弹窗**

新增原因枚举和弹窗函数。退回原因必填，图片凭证只用文本模拟选填：

```typescript
const returnReasons: MaterialPickupReturnReason[] = [
  '色差 / 缸差',
  '布面瑕疵',
  '规格 / 克重不符',
  '卷号 / 批次不符',
  '数量不符',
  '辅料型号不符',
  '其他',
]
```

弹窗提交按钮必须带：

```html
data-pickup-action="submit-material-return"
data-pickup-record-id="..."
data-prep-record-id="..."
data-prep-line-id="..."
```

数量输入字段使用：

```html
data-pickup-return-field="returnQty"
```

原因、备注、图片字段分别使用：

```html
data-pickup-return-field="reason"
data-pickup-return-field="remark"
data-pickup-return-field="imageNames"
```

在详情页渲染底部追加：

```typescript
${renderPickupReturnModal(activeProjection)}
```

- [ ] **步骤 5：新增退回列表**

新增 `renderPickupReturns(projection)`，只展示配料/领料侧事实：

```typescript
function renderPickupReturns(projection: MaterialPrepOrderProjection): string {
  return `
    <section class="rounded-lg border bg-card p-4">
      <h3 class="text-base font-semibold">退回处理</h3>
      <p class="mt-1 text-sm text-muted-foreground">这里仅展示裁床退回到中转仓的配料/领料侧记录；中转仓收回、质检判定和后续处理不在本次范围。</p>
      <div class="mt-3 space-y-3">
        ${projection.pickupReturnRecords.length ? projection.pickupReturnRecords.map((record) => {
          const line = projection.lines.find((item) => item.prepLineId === record.prepLineId)
          return `
            <article class="rounded-md border p-3 text-sm">
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div class="font-medium">${line ? renderMaterialSkuCode(line.materialSku, projection.order.productionOrderNo) : escapeHtml(record.prepLineId)}</div>
                  <div class="mt-1 text-xs text-muted-foreground">退回：${formatQty(record.returnQty, record.unit)} / ${record.rollCount} 卷 / 原因：${escapeHtml(record.reason)}</div>
                  <div class="mt-1 text-xs text-muted-foreground">发起：${escapeHtml(record.returnedBy)} / ${escapeHtml(record.returnedAt)}</div>
                  ${record.remark ? `<div class="mt-1 text-xs text-muted-foreground">${escapeHtml(record.remark)}</div>` : ''}
                </div>
                <div>${renderBadge(record.returnStatus, 'warning')}</div>
              </div>
            </article>
          `
        }).join('') : '<div class="rounded-md border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">暂无退回记录。</div>'}
      </div>
    </section>
  `
}
```

- [ ] **步骤 6：实现提交事件**

在 `handleCraftCuttingPickupManagementEvent()` 中增加：

```typescript
  if (action === 'submit-material-return') {
    const returnQty = Number(document.querySelector<HTMLInputElement>('[data-pickup-return-field="returnQty"]')?.value || 0)
    const reason = document.querySelector<HTMLSelectElement>('[data-pickup-return-field="reason"]')?.value as MaterialPickupReturnReason
    const remark = document.querySelector<HTMLTextAreaElement>('[data-pickup-return-field="remark"]')?.value || ''
    const imageNames = (document.querySelector<HTMLInputElement>('[data-pickup-return-field="imageNames"]')?.value || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
    appendPickupReturnRecord({
      pickupRecordId: actionNode.dataset.pickupRecordId || '',
      prepRecordId: actionNode.dataset.prepRecordId || '',
      prepLineId: actionNode.dataset.prepLineId || '',
      returnQty,
      rollCount: 1,
      reason,
      remark,
      imageNames,
      returnedBy: '裁床 李明',
    })
    const params = getSearchParams()
    params.delete('returnPickupRecordId')
    params.set('detailTab', 'returns')
    window.history.pushState({}, '', `${window.location.pathname}?${params.toString()}`)
    window.dispatchEvent(new PopStateEvent('popstate'))
    return true
  }
```

- [ ] **步骤 7：运行检查**

运行：

```bash
npm run check:cutting-material-return
npm run build
```

预期：两者 PASS。

- [ ] **步骤 8：Commit**

```bash
git add src/pages/process-factory/cutting/pickup-management.ts
git commit -m "feat: show cutting material returns"
```

## 任务 3：配料详情补充退回追溯

**文件：**
- 修改：`src/pages/fcs/material-prep/cutting.ts`

- [ ] **步骤 1：调整领料记录渲染函数签名**

把 `renderPickupRecords()` 改为接收退回记录：

```typescript
function renderPickupRecords(
  records: PickupRecord[],
  rejectRecords: PrepRejectRecord[],
  returnRecords: MaterialPickupReturnRecord[],
  relatedProductionOrderNo: string,
): string
```

调用处改为：

```typescript
? renderPickupRecords(projection.pickupRecords, projection.rejectRecords, projection.pickupReturnRecords, projection.order.productionOrderNo)
```

- [ ] **步骤 2：展示已退和待加工仓剩余**

在每条领料记录 map 内加入：

```typescript
const relatedReturns = returnRecords.filter((item) => item.pickupRecordId === record.pickupRecordId)
const returnedQty = Number(record.returnQty || relatedReturns.reduce((sum, item) => sum + Number(item.returnQty || 0), 0))
const remainingQty = Number(record.waitProcessAvailableQty ?? Math.max(Number(record.pickedQty || 0) - returnedQty, 0))
```

HTML 中加入：

```typescript
<div class="mt-1 text-xs text-muted-foreground">已退：${formatQty(returnedQty)} / 待加工仓剩余：${formatQty(remainingQty)}</div>
${relatedReturns.length ? `
  <div class="mt-2 rounded-md border border-amber-100 bg-amber-50 px-2 py-1 text-xs text-amber-800">
    ${relatedReturns.map((item) => `${escapeHtml(item.reason)} / ${formatQty(item.returnQty, item.unit)} / ${escapeHtml(item.returnStatus)}`).join('；')}
  </div>
` : ''}
```

- [ ] **步骤 3：运行检查**

运行：

```bash
npm run check:cutting-material-return
npm run build
```

预期：两者 PASS。

- [ ] **步骤 4：Commit**

```bash
git add src/pages/fcs/material-prep/cutting.ts
git commit -m "feat: trace material returns in prep detail"
```

## 任务 4：浏览器性能与原型治理验证

**文件：**
- 创建：`docs/prototype-review-records/2026-07-09-cutting-material-return.md`
- 修改：`scripts/check-material-prep-performance.ts`

- [ ] **步骤 1：扩展 Playwright 性能检查**

在 `scripts/check-material-prep-performance.ts` 增加领料退回入口检查，目标只是打开退回弹窗，不测试仓储处理：

```typescript
await page.goto(`${baseUrl}/fcs/craft/cutting/pickup-management?tab=PICKUP_DONE`, { waitUntil: 'domcontentloaded' })
await page.waitForFunction(() => document.body.innerText.includes('领料管理'), undefined, { timeout: 10_000 })

const openReturnDuration = await measure('领料详情打开退回入口', async () => {
  await page.locator('[data-nav*="pickup-management-detail"]').first().click()
  await page.waitForFunction(() => location.pathname.includes('pickup-management-detail'), undefined, { timeout: 10_000 })
  await page.getByRole('button', { name: /待加工仓入库记录/ }).first().click()
  await page.getByRole('button', { name: '退回物料' }).first().click()
  await page.waitForFunction(() => document.body.innerText.includes('退回物料到中转仓'), undefined, { timeout: 10_000 })
})
results.push(['领料详情打开退回入口', openReturnDuration, routeThresholdMs])
assert(openReturnDuration <= routeThresholdMs, `领料详情打开退回入口耗时 ${openReturnDuration.toFixed(1)}ms，超过 ${routeThresholdMs}ms`)
```

- [ ] **步骤 2：新增原型审查记录**

创建 `docs/prototype-review-records/2026-07-09-cutting-material-return.md`：

```markdown
# 裁床物料退回中转仓原型审查记录

## 审查对象

- `/fcs/craft/cutting/pickup-management`
- `/fcs/craft/cutting/pickup-management-detail`
- `/fcs/material-prep/cutting`

## 范围

本次只关心配料和领料两个模块。中转仓收回、待质检判定、换料重配、无法补料等仓储/质检处理不在本次范围。

## 角色

- 裁床操作员 / 裁床仓管：按物料行发起退回。
- 中转仓人员：在仓储模块处理退回物料，本次页面不实现处理动作。

## 自查结论

- 角色匹配：通过。
- 任务清晰度：通过，退回入口挂在已入待加工仓的领料记录上。
- 信息负载：通过，只要求退回数量、原因和选填凭证。
- 异常追溯：通过，保留配料记录已确认事实，新增领料后退回事实。
- 文案中文化：通过。
- 性能要求：通过 `check:material-prep-performance` 验证。

## 例外

- 图片凭证按业务确认设为选填。
- 不做中转仓确认、待质检判定、换料重配、无法补料处理。
- 不做真实后端和真实库存数据库联动。
```

- [ ] **步骤 3：运行治理和性能检查**

启动本地服务：

```bash
npm run dev -- --host 127.0.0.1 --port 5174
```

另一个终端运行：

```bash
npm run check:material-prep-performance -- http://127.0.0.1:5174
npm run check:prototype-design-governance
npm run build
codegraph sync && codegraph status
```

预期：

- 性能检查 PASS，退回入口打开耗时低于 800ms。
- 原型治理检查 PASS。
- build PASS。
- CodeGraph 最新。

- [ ] **步骤 4：Commit**

```bash
git add scripts/check-material-prep-performance.ts docs/prototype-review-records/2026-07-09-cutting-material-return.md
git commit -m "test: cover cutting material return prototype"
```

## 收尾检查

- [ ] **步骤 1：完整验证命令**

运行：

```bash
npm run check:cutting-material-return
npm run check:material-prep-performance -- http://127.0.0.1:5174
npm run check:prototype-design-governance
npm run build
codegraph sync && codegraph status
git status --short
```

预期：

- 所有检查 PASS。
- CodeGraph 最新。
- `git status --short` 只剩用户明确允许保留的无关改动。

## 计划自检

- 规格覆盖度：覆盖本次范围内的配料记录不回退、按物料行部分退回、原因必填图片选填、无需主管审批、退回待中转仓处理和页面影响；仓储质检处理明确不在本次范围。
- 占位符扫描：未发现未完成标记。
- 类型一致性：退回状态统一使用 `MaterialPickupReturnStatus`，退回记录统一使用 `MaterialPickupReturnRecord`，页面事件统一使用 `data-pickup-action`。
