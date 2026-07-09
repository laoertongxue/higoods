# 裁片配料与领料退回可视化联动实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 让裁片配料和裁前准备 - 领料管理基于同一套配料、领料、退回 mock 数据展示，并让退回事实在列表、详情、筛选和跳转中可见。

**架构：** 只扩展现有 `src/data/fcs/cutting/production-material-prep.ts` 投影，不新增数据源。裁片配料页和领料管理页都读取 `MaterialPrepOrderProjection`，页面只做展示、筛选和导航。退回仍是领料后的物料行事实，不新增配料主状态。

**技术栈：** Vite、TypeScript、Vanilla TypeScript 字符串模板、现有本地 mock/localStorage、Playwright 检查脚本。

---

## 文件结构

- 修改：`src/data/fcs/cutting/production-material-prep.ts`
  - 增加 seed 退回记录。
  - 给物料行和订单投影补 `returnedQty`、`returnedLineCount`、最近退回操作。
  - 保证 12 条 mock 场景能从同一套投影读出。
- 修改：`src/pages/fcs/material-prep/cutting.ts`
  - 列表增加 `只看有退回` 筛选。
  - 列表展示 `已退回` 物料行数和已退数量。
  - 详情移除 Tab 外摘要，把 Tab 改成 `领料 / 退回记录` 并展示退回明细。
- 修改：`src/pages/process-factory/cutting/pickup-management.ts`
  - 退回处理记录补配料单、配料记录、领料记录。
  - 增加跳转到裁片配料同一配料单的入口。
- 创建：`scripts/check-cutting-prep-pickup-return-linkage.ts`
  - 检查同一套数据、12 条 mock 场景、退回筛选、跨页可见。
- 修改：`package.json`
  - 增加 `check:cutting-prep-pickup-return-linkage`。
- 创建：`docs/prototype-review-records/2026-07-09-cutting-prep-pickup-return-linkage.md`
  - 记录本次配料/领料可视化联动的原型审查。

## 任务 1：补齐同源 mock 和退回投影

**文件：**
- 修改：`src/data/fcs/cutting/production-material-prep.ts`
- 创建：`scripts/check-cutting-prep-pickup-return-linkage.ts`
- 修改：`package.json`

- [ ] **步骤 1：创建失败检查脚本**

创建 `scripts/check-cutting-prep-pickup-return-linkage.ts`：

```ts
#!/usr/bin/env node

import {
  createProductionMaterialPrepSeedStore,
  getMaterialPrepOrderProjection,
  listMaterialPrepOrderProjections,
  PRODUCTION_MATERIAL_PREP_STORAGE_KEY,
} from '../src/data/fcs/cutting/production-material-prep.ts'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

class MemoryStorage {
  private readonly values = new Map<string, string>()
  getItem(key: string): string | null { return this.values.get(key) ?? null }
  setItem(key: string, value: string): void { this.values.set(key, value) }
  removeItem(key: string): void { this.values.delete(key) }
}

const storage = new MemoryStorage()
storage.setItem(PRODUCTION_MATERIAL_PREP_STORAGE_KEY, JSON.stringify(createProductionMaterialPrepSeedStore()))

const rows = listMaterialPrepOrderProjections(storage)
assert(rows.length >= 12, `mock 配料单至少 12 条，当前 ${rows.length} 条`)

const returnedRows = rows.filter((row) => row.returnedLineCount > 0)
assert(returnedRows.length >= 3, '至少需要 3 条有退回事实的 mock 配料单')

const partialReturn = rows.find((row) => row.pickupRecords.some((record) => record.returnStatus === '部分退回'))
assert(partialReturn, '必须覆盖部分退回场景')

const fullReturn = rows.find((row) => row.pickupRecords.some((record) => record.returnStatus === '全部退回'))
assert(fullReturn, '必须覆盖全部退回场景')

const multiReturn = rows.find((row) => row.pickupReturnRecords.filter((record) => record.pickupRecordId === row.pickupReturnRecords[0]?.pickupRecordId).length >= 2)
assert(multiReturn, '必须覆盖同一领料记录多次部分退回场景')

for (const row of returnedRows) {
  const projection = getMaterialPrepOrderProjection(row.order.prepOrderId, storage)
  assert(projection, `配料单投影必须可按 ID 读取：${row.order.prepOrderId}`)
  assert(projection.returnedLineCount > 0, `配料单必须统计已退回物料行：${row.order.prepOrderNo}`)
  assert(projection.totalReturnedQty > 0, `配料单必须统计已退数量：${row.order.prepOrderNo}`)
  assert(projection.latestOperatedAt === projection.pickupReturnRecords[0].returnedAt || projection.pickupReturnRecords.some((record) => record.returnedAt === projection.latestOperatedAt), `最近操作必须能取到退回时间：${row.order.prepOrderNo}`)
}

console.log('裁片配料与领料退回联动数据检查通过')
```

- [ ] **步骤 2：增加 npm 脚本并运行，确认失败**

修改 `package.json` 的 `scripts`：

```json
"check:cutting-prep-pickup-return-linkage": "node --experimental-strip-types --experimental-specifier-resolution=node scripts/check-cutting-prep-pickup-return-linkage.ts"
```

运行：

```bash
npm run check:cutting-prep-pickup-return-linkage
```

预期：FAIL，报错包含 `returnedLineCount` 或退回 mock 不足。

- [ ] **步骤 3：补最小投影字段**

在 `MaterialPrepLine` 接口增加：

```ts
returnedQty: number
waitProcessAvailableQty: number
```

在 `MaterialPrepOrderProjection` 接口增加：

```ts
returnedLineCount: number
```

在 `buildLine(...)` 中从已应用退回投影的 `pickupRecords` 计算：

```ts
const returnedQty = roundQty(
  pickupRecords
    .filter((record) => record.prepLineId === seedLine.prepLineId)
    .reduce((sum, record) => sum + Number(record.returnQty || 0), 0),
)
const waitProcessAvailableQty = roundQty(
  pickupRecords
    .filter((record) => record.prepLineId === seedLine.prepLineId)
    .reduce((sum, record) => sum + Number(record.waitProcessAvailableQty ?? record.pickedQty ?? 0), 0),
)
```

返回 line 时包含：

```ts
returnedQty,
waitProcessAvailableQty,
```

在 `buildOrderProjection(...)` 返回对象中加入：

```ts
returnedLineCount: lines.filter((line) => line.returnedQty > 0).length,
```

- [ ] **步骤 4：补 seed 退回记录**

在 `seedPickupRecords` 下方新增 `seedPickupReturnRecords: MaterialPickupReturnRecord[]`，引用现有真实领料记录 ID。至少包含：

```ts
{
  returnRecordId: 'pickup-return-seed-mix-black-001',
  pickupRecordId: 'pickup:prep-rec-po-0101-mixed-002:prep-line-po-0101-black:seed',
  prepRecordId: 'prep-rec-po-0101-mixed-002',
  prepOrderId: 'prep-order-po-202603-0101',
  prepLineId: 'prep-line-po-0101-black',
  productionOrderId: 'po-202603-0101',
  returnQty: 40,
  rollCount: 1,
  unit: 'yard',
  reason: '布面瑕疵',
  remark: '开工前验布发现破洞，先退回中转仓。',
  imageNames: [],
  returnedBy: '裁床 李明',
  returnedAt: '2026-03-16 14:20',
  returnStatus: '已退回待中转仓处理',
}
```

如果真实 `seedPickupRecords` 中没有上面的 `pickupRecordId`，先使用文件里已有的 `pickupRecordId`，并保持 `prepRecordId/prepLineId/prepOrderId` 完全一致。

让 seed store 使用：

```ts
pickupReturnRecords: cloneRecord(seedPickupReturnRecords),
```

让反序列化合并 seed：

```ts
pickupReturnRecords: Array.isArray(parsed.pickupReturnRecords)
  ? mergeMissingSeedRecords(parsed.pickupReturnRecords, seedPickupReturnRecords, (record) => record.returnRecordId)
  : cloneRecord(seedPickupReturnRecords),
```

- [ ] **步骤 5：让最近操作纳入退回**

在 `buildOrderProjection(...)` 中把 `latestOperatedAt` 改为包含退回时间：

```ts
const latestOperatedAt = latestText([
  ...prepRecords.map((record) => record.rejectedAt || record.confirmedAt || record.preparedAt),
  ...pickupRecords.map((record) => record.pickedAt),
  ...pickupReturnRecords.map((record) => record.returnedAt),
  closed?.closedAt || '',
])
```

并让 `latestOperatorName` 优先匹配退回人：

```ts
const latestOperatorName =
  pickupReturnRecords.find((record) => record.returnedAt === latestOperatedAt)?.returnedBy ||
  pickupRecords.find((record) => record.pickedAt === latestOperatedAt)?.receiverName ||
  prepRecords.find((record) => [record.rejectedAt, record.confirmedAt, record.preparedAt].includes(latestOperatedAt))?.operatorName ||
  closed?.closedBy ||
  seedOrder.creatorName
```

- [ ] **步骤 6：运行数据检查通过**

运行：

```bash
npm run check:cutting-prep-pickup-return-linkage
```

预期：PASS，输出：

```text
裁片配料与领料退回联动数据检查通过
```

- [ ] **步骤 7：Commit**

```bash
git add src/data/fcs/cutting/production-material-prep.ts scripts/check-cutting-prep-pickup-return-linkage.ts package.json
git commit -m "feat: link cutting prep pickup return data"
```

## 任务 2：裁片配料列表和详情展示退回事实

**文件：**
- 修改：`src/pages/fcs/material-prep/cutting.ts`
- 修改：`scripts/check-cutting-prep-pickup-return-linkage.ts`

- [ ] **步骤 1：扩展检查脚本覆盖页面渲染文本**

在 `scripts/check-cutting-prep-pickup-return-linkage.ts` 增加导入：

```ts
import { renderFcsCuttingPrepPage } from '../src/pages/fcs/material-prep/cutting.ts'
```

在数据检查后追加：

```ts
const originalWindow = globalThis.window
;(globalThis as typeof globalThis & { window: unknown }).window = {
  location: { pathname: '/fcs/material-prep/cutting', search: '' },
  history: { pushState() {} },
  addEventListener() {},
  removeEventListener() {},
}

const listHtml = renderFcsCuttingPrepPage()
assert(listHtml.includes('已退回'), '裁片配料列表必须展示已退回物料行统计')
assert(listHtml.includes('只看有退回'), '裁片配料筛选区必须展示只看有退回')

const returnedOrder = returnedRows[0]
;(globalThis as typeof globalThis & { window: unknown }).window = {
  location: { pathname: '/fcs/material-prep/cutting', search: `?prepOrderId=${returnedOrder.order.prepOrderId}&detailTab=pickup` },
  history: { pushState() {} },
  addEventListener() {},
  removeEventListener() {},
}
const detailHtml = renderFcsCuttingPrepPage()
assert(detailHtml.includes('领料 / 退回记录'), '裁片配料详情 Tab 必须改为领料 / 退回记录')
assert(detailHtml.includes('已退'), '裁片配料详情必须展示已退数量')
assert(detailHtml.includes('已退回待中转仓处理'), '裁片配料详情必须展示退回状态')

;(globalThis as typeof globalThis & { window: unknown }).window = originalWindow
```

- [ ] **步骤 2：运行检查确认失败**

运行：

```bash
npm run check:cutting-prep-pickup-return-linkage
```

预期：FAIL，报错 `只看有退回` 或 `领料 / 退回记录`。

- [ ] **步骤 3：增加列表筛选**

在 `getFilters()` 或等价筛选读取函数中读取：

```ts
const hasReturn = params.get('hasReturn') === '1'
```

在筛选表单增加复选入口：

```html
<label class="inline-flex h-10 items-center gap-2 rounded-md border px-3 text-sm">
  <input type="checkbox" name="hasReturn" value="1" ${filters.hasReturn ? 'checked' : ''} />
  只看有退回
</label>
```

在 `filterOrders()` 中叠加：

```ts
if (filters.hasReturn && row.returnedLineCount <= 0) return false
```

- [ ] **步骤 4：列表行展示退回统计**

在物料行统计区域增加：

```html
<div class="${row.returnedLineCount > 0 ? 'font-medium text-amber-700' : 'text-muted-foreground'}">已退回：${row.returnedLineCount}</div>
```

在领料状态区域增加：

```html
${row.totalReturnedQty > 0 ? `<div class="mt-1 text-xs text-amber-700">已退：${formatQty(row.totalReturnedQty)}</div>` : ''}
${row.totalReturnedQty > 0 ? `<div class="mt-1 text-xs text-amber-700">含退回待中转仓处理</div>` : ''}
```

- [ ] **步骤 5：详情 Tab 改名并展示退回数量**

把 `renderDetailTabs(...)` 中 pickup 标签改为：

```ts
{ key: 'pickup', label: '领料 / 退回记录', count: `${projection.pickupRecords.filter((record) => lineIds.has(record.prepLineId)).length + projection.pickupReturnRecords.filter((record) => lineIds.has(record.prepLineId)).length} 条` },
```

在 `renderPickupRecords(...)` 中每条领料记录展示：

```html
<div class="mt-1 text-xs text-muted-foreground">已退：${formatQty(returnedQty)} / 待加工仓剩余：${formatQty(remainingQty)}</div>
```

退回明细块展示：

```html
${relatedReturns.length ? `
  <div class="mt-2 space-y-1 rounded-md border border-amber-100 bg-amber-50 px-2 py-2 text-xs text-amber-800">
    ${relatedReturns.map((item) => `
      <div>退回：${formatQty(item.returnQty, item.unit)} / ${escapeHtml(item.reason)} / ${escapeHtml(item.returnStatus)} / ${escapeHtml(item.returnedBy)} / ${escapeHtml(item.returnedAt)}</div>
      ${item.imageNames.length ? `<div>凭证：${item.imageNames.map(escapeHtml).join('、')}</div>` : ''}
    `).join('')}
  </div>
` : ''}
```

- [ ] **步骤 6：去掉详情 Tab 外摘要区**

在 `renderFcsCuttingPrepPage()` 详情分支中删除 Tab 外 `renderImplementationStatus(...)` 和独立 KPI 摘要调用，只保留：

```ts
${renderDetail(projection, activeDetailTab)}
```

如生产需求或库存 Tab 缺少摘要字段，把字段补进对应 Tab，不在 Tab 外再铺一层。

- [ ] **步骤 7：运行检查和构建**

运行：

```bash
npm run check:cutting-prep-pickup-return-linkage
npm run build
```

预期：两个命令都 PASS。

- [ ] **步骤 8：Commit**

```bash
git add src/pages/fcs/material-prep/cutting.ts scripts/check-cutting-prep-pickup-return-linkage.ts
git commit -m "feat: show returns in cutting prep"
```

## 任务 3：领料管理增加反向定位

**文件：**
- 修改：`src/pages/process-factory/cutting/pickup-management.ts`
- 修改：`scripts/check-cutting-prep-pickup-return-linkage.ts`

- [ ] **步骤 1：扩展检查脚本覆盖领料详情**

在检查脚本增加导入：

```ts
import { renderCraftCuttingPickupManagementDetailPage } from '../src/pages/process-factory/cutting/pickup-management.ts'
```

追加检查：

```ts
;(globalThis as typeof globalThis & { window: unknown }).window = {
  location: { pathname: '/fcs/craft/cutting/pickup-management-detail', search: `?prepOrderId=${returnedOrder.order.prepOrderId}&detailTab=returns` },
  history: { pushState() {} },
  addEventListener() {},
  removeEventListener() {},
}
const pickupDetailHtml = renderCraftCuttingPickupManagementDetailPage()
assert(pickupDetailHtml.includes('查看裁片配料'), '领料退回处理必须提供查看裁片配料入口')
assert(pickupDetailHtml.includes(returnedOrder.order.prepOrderNo), '领料退回处理必须展示配料单')
assert(pickupDetailHtml.includes(returnedOrder.pickupReturnRecords[0].prepRecordId), '领料退回处理必须展示配料记录')
assert(pickupDetailHtml.includes(returnedOrder.pickupReturnRecords[0].pickupRecordId), '领料退回处理必须展示领料记录')
```

- [ ] **步骤 2：运行检查确认失败**

运行：

```bash
npm run check:cutting-prep-pickup-return-linkage
```

预期：FAIL，报错 `查看裁片配料`。

- [ ] **步骤 3：补裁片配料跳转函数**

在 `pickup-management.ts` 增加：

```ts
function buildCuttingPrepPickupHref(prepOrderId: string): string {
  const params = new URLSearchParams()
  params.set('prepOrderId', prepOrderId)
  params.set('detailTab', 'pickup')
  return `/fcs/material-prep/cutting?${params.toString()}`
}
```

- [ ] **步骤 4：退回处理展示定位信息和跳转**

在 `renderPickupReturns(...)` 每条退回记录中补：

```html
<div class="mt-1 text-xs text-muted-foreground">配料单：${renderPrepOrderCode(projection.order.prepOrderNo, projection.order.productionOrderNo)}</div>
<div class="mt-1 text-xs text-muted-foreground">配料记录：${renderPrepRecordCode(record.prepRecordId, projection.order.productionOrderNo)}</div>
<div class="mt-1 text-xs text-muted-foreground">领料记录：${renderPickupRecordCode(record.pickupRecordId, projection.order.productionOrderNo)}</div>
<button type="button" data-nav="${escapeHtml(buildCuttingPrepPickupHref(record.prepOrderId))}" class="mt-2 rounded-md border border-blue-200 px-3 py-1.5 text-xs text-blue-700 hover:bg-blue-50">查看裁片配料</button>
```

- [ ] **步骤 5：运行检查通过**

运行：

```bash
npm run check:cutting-prep-pickup-return-linkage
```

预期：PASS。

- [ ] **步骤 6：Commit**

```bash
git add src/pages/process-factory/cutting/pickup-management.ts scripts/check-cutting-prep-pickup-return-linkage.ts
git commit -m "feat: link pickup returns to cutting prep"
```

## 任务 4：浏览器性能和治理验证

**文件：**
- 修改：`scripts/check-material-prep-performance.ts`
- 创建：`docs/prototype-review-records/2026-07-09-cutting-prep-pickup-return-linkage.md`

- [ ] **步骤 1：扩展浏览器性能脚本**

在 `scripts/check-material-prep-performance.ts` 的裁片配料检查后增加：

```ts
const returnFilterDuration = await measure('裁片配料只看有退回', async () => {
  await page.goto(`${baseUrl}/fcs/material-prep/cutting`, { waitUntil: 'domcontentloaded' })
  await waitForMaterialPrepPage(page, '/fcs/material-prep/cutting', '裁片配料')
  await page.getByLabel('只看有退回').check()
  await page.getByRole('button', { name: '查询' }).first().click()
  await waitForMaterialPrepPage(page, '/fcs/material-prep/cutting', '裁片配料')
  await page.waitForFunction(() => document.body.innerText.includes('已退回'))
})
results.push(['裁片配料只看有退回', returnFilterDuration, actionThresholdMs])
assert(returnFilterDuration <= actionThresholdMs, `裁片配料只看有退回耗时 ${returnFilterDuration.toFixed(1)}ms，超过 ${actionThresholdMs}ms`)
```

- [ ] **步骤 2：新增原型审查记录**

创建 `docs/prototype-review-records/2026-07-09-cutting-prep-pickup-return-linkage.md`：

```md
# 裁片配料与领料退回可视化联动原型审查记录

## 审查对象

- `/fcs/material-prep/cutting`
- `/fcs/craft/cutting/pickup-management`
- `/fcs/craft/cutting/pickup-management-detail`

## 范围

本次只处理配料和领料模块。中转仓收回确认、待质检判定、换料重配、无法补料后续不在范围内。

## 自查结论

- 角色匹配：通过。
- 信息层级：通过，裁片配料详情不再把摘要放在 Tab 外。
- 数据联动：通过，裁片配料和领料管理读取同一套配料、领料、退回投影。
- 退回可见性：通过，列表、详情、筛选、领料反向跳转均能定位退回事实。
- 文案中文化：通过。
- 性能要求：通过专项脚本验证。
```

- [ ] **步骤 3：运行完整验证**

运行：

```bash
npm run check:cutting-prep-pickup-return-linkage
npm run check:material-prep-performance -- http://127.0.0.1:5174
npm run check:prototype-design-governance
npm run build
codegraph sync
codegraph status
```

预期：

- 数据检查 PASS。
- 性能脚本 PASS，新增筛选动作不超过 250ms。
- 治理检查 PASS。
- 构建 PASS。
- CodeGraph 状态 up to date。

- [ ] **步骤 4：Commit**

```bash
git add scripts/check-material-prep-performance.ts docs/prototype-review-records/2026-07-09-cutting-prep-pickup-return-linkage.md
git commit -m "test: verify cutting prep return linkage"
```

## 自检

- 规格覆盖：列表、详情、筛选、反向跳转、同源 mock、12 条场景、最近操作、治理验证均有任务覆盖。
- 占位符扫描：无 `TODO`、`待定`、`后续实现`。
- 类型一致性：计划只复用现有 `MaterialPrepOrderProjection`、`MaterialPrepLine`、`PickupRecord`、`MaterialPickupReturnRecord`，新增字段集中在投影层。
- 范围控制：不实现中转仓收回确认、待质检判定、换料重配、无法补料后续。
