# 生产准备时效证据一致性实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 修正 `生产准备时效` 中“准备项显示已完成但没有上传信息”的业务错误，并补齐跟单确认类型、准备项独立操作、产出分行、分页、真实图片和 mock 数据一致性。

**架构：** 保持现有 Vite + Vanilla TypeScript 字符串模板，不接真实后端。用现有 `production-preparation-timing.ts` 数据、`production-preparation-timing-runtime.ts` 浏览器运行态和页面渲染函数完成原型闭环；所有完成状态由上传证据驱动。

**技术栈：** Vite、TypeScript、Tailwind CSS、Vanilla TypeScript、`localStorage`、`FileReader`、`tsx` 自检脚本、CodeGraph。

---

## 文件结构

- 修改：`/Users/laoer/Documents/higoods/src/data/fcs/production-preparation-timing.ts`
  - 增加 8 类产出对象类型。
  - 增加商品类型到准备项模板的最小映射。
  - 修正 mock 数据：真实图片、未确认记录无进度无产出、已完成项必须有上传记录。

- 修改：`/Users/laoer/Documents/higoods/src/data/fcs/production-preparation-timing-runtime.ts`
  - 跟单确认运行态保存 `confirmedProductPrepType`、`selectedItemTypes`。
  - 运行态合并时不再强制 `必做` 项永远选中，辅料下单允许取消。
  - 工作项完成必须基于真实上传记录。

- 修改：`/Users/laoer/Documents/higoods/src/pages/production/preparation-timing.ts`
  - 准备台账分页。
  - 商品类型列合并为“跟单确认”。
  - 操作列按每个准备项输出独立文字按钮。
  - 产出列更名为“产出”，按 8 类对象逐行展示单号或版本号和时间。
  - 准备项明细卡片禁止出现“已完成 + 暂无上传记录”。
  - 确认工作项弹窗改成“确认商品类型 + 确认准备项”同一弹窗。

- 修改：`/Users/laoer/Documents/higoods/scripts/check-production-preparation-timing.ts`
  - 增加证据一致性、分页、图片、操作入口、产出对象、确认弹窗口径检查。

---

## 任务 1：先写失败检查，锁住业务口径

**文件：**
- 修改：`/Users/laoer/Documents/higoods/scripts/check-production-preparation-timing.ts`

- [ ] **步骤 1：在 import 后增加证据检查 helper**

把下面代码放在动态 import `productionPreparationRecords` 后、页面渲染检查前：

```ts
type EvidenceItem = {
  itemType: string
  status: string
  selectedByMerchandiser?: boolean
  actualFinishAt?: string
  uploads?: Array<{ fileName?: string; uploadedAt?: string; uploadedBy?: string; fileDataUrl?: string }>
}

function selectedEvidenceItems(record: { items: EvidenceItem[] }): EvidenceItem[] {
  return record.items.filter((item) => item.selectedByMerchandiser !== false && item.status !== '无需')
}

function hasUploadEvidence(item: EvidenceItem): boolean {
  return Boolean(
    item.actualFinishAt &&
      item.uploads?.some((upload) => upload.fileName && upload.uploadedAt && upload.uploadedBy),
  )
}
```

- [ ] **步骤 2：增加“已完成必须有上传证据”的失败断言**

继续加入：

```ts
for (const record of productionPreparationRecords as Array<{ recordNo: string; items: EvidenceItem[] }>) {
  for (const item of selectedEvidenceItems(record)) {
    if (item.status === '已完成') {
      assert.ok(
        hasUploadEvidence(item),
        `${record.recordNo} ${item.itemType} 已完成时必须有上传记录、上传人、上传时间和实际完成时间`,
      )
    }
  }
}
```

这条断言必须让当前截图里的问题直接失败：`已完成` 卡片不能再展示 `暂无上传记录`。

- [ ] **步骤 3：增加真实商品图片断言**

继续加入：

```ts
for (const record of productionPreparationRecords as Array<{ recordNo: string; imageUrl?: string }>) {
  assert.ok(record.imageUrl, `${record.recordNo} 必须有商品图片`)
  assert.ok(
    existsSync(`public${record.imageUrl}`),
    `${record.recordNo} 商品图片必须指向 public 下真实存在的图片：${record.imageUrl}`,
  )
}
```

- [ ] **步骤 4：增加未确认记录的状态断言**

加入：

```ts
for (const record of productionPreparationRecords as Array<{
  recordNo: string
  workItemsConfirmedBy?: string
  workItemsConfirmedAt?: string
  productionDemandNo?: string
  productionOrderNo?: string
  outputReady?: boolean
  outputs?: unknown[]
  items: EvidenceItem[]
}>) {
  const confirmed = Boolean(record.workItemsConfirmedBy && record.workItemsConfirmedAt)
  if (!confirmed) {
    assert.equal(selectedEvidenceItems(record).filter((item) => item.status === '已完成').length, 0, `${record.recordNo} 未确认准备项前不得有已完成项`)
    assert.equal(record.productionDemandNo || '', '', `${record.recordNo} 未确认准备项前不得有生产需求单`)
    assert.equal(record.productionOrderNo || '', '', `${record.recordNo} 未确认准备项前不得有生产单`)
    assert.equal(record.outputReady, false, `${record.recordNo} 未确认准备项前不得显示正式产出已生成`)
    assert.equal(record.outputs?.length ?? 0, 0, `${record.recordNo} 未确认准备项前不得有产出对象`)
  }
}
```

- [ ] **步骤 5：增加产出对象断言**

不要把业务展示结果绑定到 `src/data/fcs/production-preparation-timing.ts` 源码字面量位置。产出对象覆盖应通过页面渲染结果和 `productionPreparationRecords[].outputs` 结构检查。

加入：

```ts
const expectedOutputTypes = [
  '正式版本技术包',
  '生产需求单',
  '生产单',
  '印花需求单',
  '印花加工单',
  '染色需求单',
  '染色加工单',
  '辅料采购单',
] as const

const generatedOutputTypes = new Set(
  (productionPreparationRecords as Array<{ outputs?: Array<{ outputType?: string; outputStatus?: string }> }>)
    .flatMap((record) => record.outputs ?? [])
    .filter((output) => output.outputStatus === '已生成')
    .map((output) => output.outputType)
    .filter(Boolean),
)

if (generatedOutputTypes.size > 0) {
  for (const outputType of expectedOutputTypes) {
    assert.ok(generatedOutputTypes.has(outputType), `已生成产出对象缺少「${outputType}」`)
  }
}
```

- [ ] **步骤 6：增加页面 HTML 断言**

在 `adjustedLedgerHtml` 相关检查后加入：

```ts
for (const text of ['产出', '正式版本技术包', '生产需求单', '印花需求单', '染色需求单', '辅料采购单'] as const) {
  assertHtmlIncludes(adjustedLedgerHtml, text, `准备台账必须展示「${text}」`)
}

for (const forbidden of ['产出状态', '操作当前卡点', '准备项确认：'] as const) {
  assert.ok(!adjustedLedgerHtml.includes(forbidden), `准备台账不应显示「${forbidden}」`)
}

const completedWithoutUploadPattern = /已完成[\s\S]{0,800}暂无上传记录/
assert.ok(
  !completedWithoutUploadPattern.test(readyOutputHtml),
  '详情里不得出现已完成准备项却显示暂无上传记录',
)
```

- [ ] **步骤 7：运行检查验证失败**

运行：

```bash
npm run check:production-preparation-timing
```

预期：FAIL，报错指向已完成项缺少上传记录、产出对象类型不足、列表仍有旧文案。

- [ ] **步骤 8：Commit**

```bash
git add scripts/check-production-preparation-timing.ts
git commit -m "test: lock production preparation evidence rules"
```

---

## 任务 2：修正数据模型、mock 数据和运行态合并

**文件：**
- 修改：`/Users/laoer/Documents/higoods/src/data/fcs/production-preparation-timing.ts`
- 修改：`/Users/laoer/Documents/higoods/src/data/fcs/production-preparation-timing-runtime.ts`

- [ ] **步骤 1：把产出类型改成 8 类**

在 `production-preparation-timing.ts` 中替换 `PreparationOutputType`：

```ts
export type PreparationOutputType =
  | '正式版本技术包'
  | '生产需求单'
  | '生产单'
  | '印花需求单'
  | '印花加工单'
  | '染色需求单'
  | '染色加工单'
  | '辅料采购单'
```

- [ ] **步骤 2：在 seed 类型里加入 mock 上传字段**

在 `PreparationItemSeed` 的 `Partial<Pick<...>>` 中加入：

```ts
      | 'uploads'
      | 'downloads'
```

然后在 `createItems()` 内生成历史上传记录：

```ts
function createMockUpload(
  recordId: string,
  itemId: string,
  itemType: PreparationItemType,
  actualFinishAt: string,
  ownerName: string,
  evidenceSummary: string,
): PreparationUploadRecord {
  const suffix = itemId.split('-').slice(-2).join('-')
  return {
    uploadId: `${itemId}-upload-01`,
    recordId,
    itemId,
    itemType,
    fileName: `${itemType}-${suffix}.jpg`,
    fileType: 'image/jpeg',
    fileSize: 186 * 1024,
    fileDataUrl: '',
    uploadedBy: ownerName || '系统导入',
    uploadedAt: actualFinishAt,
    note: evidenceSummary || `${itemType}历史上传记录`,
  }
}
```

- [ ] **步骤 3：让 `createItems()` 给已完成项补可见上传记录**

把 `createItems()` 改成先生成 `itemId`，再决定 `uploads`：

```ts
function createItems(recordId: string, productionOrderNo: string, seeds: PreparationItemSeed[]): ProductionPreparationItem[] {
  return seeds.map((seed, index) => {
    const itemId = `${recordId}-item-${String(index + 1).padStart(2, '0')}`
    const uploads = seed.uploads ?? (
      seed.status === '已完成' && seed.actualFinishAt
        ? [createMockUpload(recordId, itemId, seed.itemType, seed.actualFinishAt, seed.ownerName, seed.evidenceSummary ?? '')]
        : []
    )

    return {
      itemId,
      recordId,
      sourceObjectType: productionOrderNo ? '生产单' : '',
      sourceObjectNo: productionOrderNo,
      sourceHref: productionOrderNo ? orderHref(productionOrderNo) : '',
      evidenceType: uploads.length ? '上传记录' : '系统记录',
      evidenceSummary: '',
      overdueHours: 0,
      remark: '',
      uploads,
      downloads: seed.downloads ?? [],
      ...seed,
      uploads,
      downloads: seed.downloads ?? [],
    }
  })
}
```

- [ ] **步骤 4：修正未确认 mock 记录**

把 `PREP-202603-001` 调整成真实“刚进入列表，待跟单确认”的记录：

```ts
productionDemandNo: '',
productionOrderNo: '',
techPackVersionLabel: '',
techPackPublishedAt: '',
status: '未开始',
currentBlockerText: '待跟单确认商品类型和准备项',
outputReady: false,
outputPublishedAt: '',
items: [
  req('梭织基码纸样', '待开始', '版师团队', '待分配', '2026-03-01T12:00:00', '2026-03-03T12:00:00', '', '梭织主线', [], '梭织基码', { evidenceSummary: '系统推导默认准备项，待跟单确认' }),
  req('版衣制作', '待开始', '车板团队', '待接单', '2026-03-03T12:00:00', '2026-03-04T12:00:00', '', '梭织主线', ['prep-202603-001-item-01'], '版衣', { evidenceSummary: '系统推导默认准备项，待跟单确认' }),
  req('梭织齐码纸样', '待开始', '版师团队', '待分配', '2026-03-04T12:00:00', '2026-03-06T12:00:00', '', '梭织主线', ['prep-202603-001-item-02'], '梭织齐码', { evidenceSummary: '系统推导默认准备项，待跟单确认' }),
  req('辅料下单', '待开始', '采购团队', '待接单', '2026-03-01T12:00:00', '2026-03-03T12:00:00', '', '辅料并行', [], '主辅料', { evidenceSummary: '默认勾选但允许跟单取消' }),
  opt('数码印/DTF/DTG花型', false, '待判断', '花型团队', '待确认', '', '', '', '花型并行', '花型', { evidenceSummary: '跟单确认时可选择' }),
  opt('染色调色（面料）', false, '待判断', '染色团队', '待确认', '', '', '', '染色并行', '面料染色', { evidenceSummary: '跟单确认时可选择' }),
],
```

- [ ] **步骤 5：把商品图片改成现有真实图片**

把 `/mock/products/...` 替换为当前 `public/` 下已存在的图片：

```ts
const productImagePool = [
  '/dress-sample-1.jpg',
  '/shirt-sample.jpg',
  '/tshirt-sample.jpg',
  '/cardigan-sample.jpg',
  '/jacket-sample.jpg',
  '/pants-sample.jpg',
  '/denim-shorts-sample.jpg',
  '/lace-dress-sample.jpg',
]
```

逐条记录使用这些路径，保证 `existsSync('public' + imageUrl)` 为真。

- [ ] **步骤 6：修改 `outputsFor()` 生成 8 类对象**

替换 `outputsFor()` 中的输出构造：

```ts
const outputs: ProductionPreparationOutput[] = ready
  ? [
      { outputType: '正式版本技术包', outputNo: `TP-${orderNo}`, outputHref: `/fcs/production/orders/${encodeURIComponent(orderNo)}/tech-pack`, outputStatus: status, outputGeneratedAt: generatedAt },
      { outputType: '生产需求单', outputNo: `PD-${recordNo.slice(-6)}`, outputHref: '/fcs/production/demands', outputStatus: status, outputGeneratedAt: generatedAt },
      { outputType: '生产单', outputNo: orderNo, outputHref: orderHref(orderNo), outputStatus: status, outputGeneratedAt: generatedAt },
    ]
  : []

if (ready && selectedItems.some((item) => item.itemType === '数码印/DTF/DTG花型')) {
  outputs.push(
    { outputType: '印花需求单', outputNo: `PRD-${recordNo.slice(-6)}`, outputHref: '/fcs/craft/printing/demands', outputStatus: status, outputGeneratedAt: generatedAt },
    { outputType: '印花加工单', outputNo: `PRO-${recordNo.slice(-6)}`, outputHref: '/fcs/craft/printing/orders', outputStatus: status, outputGeneratedAt: generatedAt },
  )
}
if (ready && selectedItems.some((item) => item.itemType === '染色调色（纱线）' || item.itemType === '染色调色（面料）')) {
  outputs.push(
    { outputType: '染色需求单', outputNo: `DYD-${recordNo.slice(-6)}`, outputHref: '/fcs/craft/dyeing/demands', outputStatus: status, outputGeneratedAt: generatedAt },
    { outputType: '染色加工单', outputNo: `DYO-${recordNo.slice(-6)}`, outputHref: '/fcs/craft/dyeing/orders', outputStatus: status, outputGeneratedAt: generatedAt },
  )
}
if (ready && selectedItems.some((item) => item.itemType === '辅料下单')) {
  outputs.push({ outputType: '辅料采购单', outputNo: `AP-${recordNo.slice(-6)}`, outputHref: '/fcs/purchase/accessory-orders', outputStatus: status, outputGeneratedAt: generatedAt })
}
```

- [ ] **步骤 7：修正运行态确认字段**

在 `production-preparation-timing-runtime.ts` 中扩展 `PreparationRuntimeState.confirmedRecords`：

```ts
confirmedRecords: Record<string, {
  confirmedBy: string
  confirmedAt: string
  confirmedProductPrepType: ProductPrepType
  selectedItemTypes: PreparationItemType[]
  overrideReason: string
}>
```

同步更新 import：

```ts
  ProductPrepType,
```

- [ ] **步骤 8：运行检查观察剩余页面失败**

运行：

```bash
npm run check:production-preparation-timing
```

预期：数据和运行态断言通过，页面仍可能失败在旧列名或按钮文案，这是任务 3 的输入。

- [ ] **步骤 9：Commit**

```bash
git add src/data/fcs/production-preparation-timing.ts src/data/fcs/production-preparation-timing-runtime.ts scripts/check-production-preparation-timing.ts
git commit -m "fix: align preparation mock data with evidence rules"
```

---

## 任务 3：修正准备台账、确认弹窗、操作按钮和产出列

**文件：**
- 修改：`/Users/laoer/Documents/higoods/src/pages/production/preparation-timing.ts`

- [ ] **步骤 1：增加证据判断 helper**

放在 `hasConfirmedWorkItems()` 后面：

```ts
function hasCompletionEvidence(item: ProductionPreparationItem): boolean {
  return Boolean(
    item.status === '已完成' &&
      item.actualFinishAt &&
      (item.uploads ?? []).some((upload) => upload.fileName && upload.uploadedAt && upload.uploadedBy),
  )
}
```

- [ ] **步骤 2：让进度和产出就绪使用证据判断**

替换 `completionProgress()` 和 `isPreparationOutputReady()`：

```ts
function completionProgress(record: ProductionPreparationRecord): { completed: number; total: number; rate: number } {
  if (!hasConfirmedWorkItems(record)) return { completed: 0, total: 0, rate: 0 }
  const items = requiredItems(record)
  const completed = items.filter(hasCompletionEvidence).length
  const rate = items.length ? Math.round((completed / items.length) * 100) : 0
  return { completed, total: items.length, rate }
}

function isPreparationOutputReady(record: ProductionPreparationRecord): boolean {
  if (!hasConfirmedWorkItems(record)) return false
  const items = requiredItems(record)
  return items.length > 0 && items.every(hasCompletionEvidence)
}
```

- [ ] **步骤 3：准备台账分页**

在 `renderLedgerTable()` 前增加：

```ts
const LEDGER_PAGE_SIZE = 5

function getLedgerPage(params: URLSearchParams): number {
  const page = Number(params.get('page') ?? '1')
  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1
}

function paginateLedgerRecords(records: ProductionPreparationRecord[], params: URLSearchParams): {
  pageRecords: ProductionPreparationRecord[]
  currentPage: number
  pageCount: number
} {
  const pageCount = Math.max(1, Math.ceil(records.length / LEDGER_PAGE_SIZE))
  const currentPage = Math.min(getLedgerPage(params), pageCount)
  const start = (currentPage - 1) * LEDGER_PAGE_SIZE
  return {
    pageRecords: records.slice(start, start + LEDGER_PAGE_SIZE),
    currentPage,
    pageCount,
  }
}
```

在 `renderLedgerTable()` 中使用：

```ts
const { pageRecords, currentPage, pageCount } = paginateLedgerRecords(records, params)
```

表格 `tbody` 改为 `pageRecords.map(...)`，并在表格后加分页：

```ts
<div class="flex items-center justify-between border-t px-5 py-3 text-sm">
  <span class="text-muted-foreground">共 ${records.length} 条，第 ${currentPage}/${pageCount} 页</span>
  <div class="flex gap-2">
    ${currentPage > 1 ? `<button type="button" class="rounded-md border px-3 py-1.5" data-nav="${escapeHtml(buildLedgerActionHref(params, month, { page: currentPage - 1 }))}">上一页</button>` : ''}
    ${currentPage < pageCount ? `<button type="button" class="rounded-md border px-3 py-1.5" data-nav="${escapeHtml(buildLedgerActionHref(params, month, { page: currentPage + 1 }))}">下一页</button>` : ''}
  </div>
</div>
```

- [ ] **步骤 4：合并商品类型列里的确认信息**

把商品类型单元格中的三行文案替换为：

```ts
<div class="mt-1 text-xs text-muted-foreground">跟单确认：${confirmed ? escapeHtml(record.confirmedProductPrepType) : '待跟单确认'}</div>
${record.prepTypeSource === '人工修正' ? `<div class="mt-1 text-xs text-amber-700">人工修正：${escapeHtml(record.prepTypeOverrideReason)}</div>` : ''}
```

页面上不再出现 `准备项确认：`。

- [ ] **步骤 5：操作列输出每个准备项的独立按钮**

增加按钮文案函数：

```ts
function itemActionLabel(item: ProductionPreparationItem): string {
  const labels: Record<PreparationItemType, string> = {
    '梭织基码纸样': '上传梭织基码纸样',
    '毛织基码纸样': '上传毛织基码纸样',
    '版衣制作': '上传版衣照片',
    '梭织齐码纸样': '上传梭织齐码纸样',
    '毛织齐码纸样': '上传毛织齐码纸样',
    '数码印/DTF/DTG花型': '上传花型文件',
    '染色调色（纱线）': '上传纱线调色结果',
    '染色调色（面料）': '上传面料调色结果',
    '辅料下单': '登记辅料下单',
  }
  return labels[item.itemType]
}
```

在操作列删除 `操作当前卡点`，改为：

```ts
${confirmed
  ? requiredItems(record).map((item) => {
      const href = buildLedgerActionHref(params, month, { recordId: record.recordId, itemId: item.itemId, action: 'operate-item' })
      return `<button type="button" class="text-sm text-blue-600 hover:underline" data-nav="${escapeHtml(href)}">${escapeHtml(itemActionLabel(item))}</button>`
    }).join('')
  : '<span class="text-xs text-muted-foreground">待跟单确认后开放操作</span>'}
${record.productionOrderNo ? `<button type="button" class="text-sm text-blue-600 hover:underline" data-nav="/fcs/production/orders?keyword=${escapeHtml(encodeURIComponent(record.productionOrderNo))}">查看生产单</button>` : ''}
```

- [ ] **步骤 6：把产出列改成逐行对象**

表头把 `产出状态` 改为 `产出`。新增列表渲染函数：

```ts
function renderLedgerOutputs(record: ProductionPreparationRecord): string {
  if (!hasConfirmedWorkItems(record)) return '<span class="text-xs text-muted-foreground">待跟单确认后生成</span>'
  if (!record.outputs.length) return '<span class="text-xs text-muted-foreground">暂无产出</span>'
  return `
    <div class="min-w-[220px] space-y-1 text-xs">
      ${record.outputs.map((output) => `
        <div>
          <span class="font-medium">${escapeHtml(output.outputType)}：</span>
          <span>${escapeHtml(output.outputNo)}</span>
          <span class="text-muted-foreground">${escapeHtml(output.outputGeneratedAt ? formatDateTime(output.outputGeneratedAt) : '-')}</span>
        </div>
      `).join('')}
    </div>
  `
}
```

列表行产出单元格调用：

```ts
<td class="px-4 py-4">${renderLedgerOutputs(record)}</td>
```

- [ ] **步骤 7：卡片已完成但无上传时显示异常，不显示已完成**

在 `renderItemCard()` 里把状态 badge 改为：

```ts
${renderBadge(item.status === '已完成' && !hasCompletionEvidence(item) ? '缺上传记录' : item.status, item.status === '已完成' && !hasCompletionEvidence(item) ? 'red' : statusTone(item.status))}
```

在上传历史空状态中区分：

```ts
const emptyUploadText = item.status === '已完成' ? '缺少上传记录，不能视为完成' : '暂无上传记录'
```

- [ ] **步骤 8：确认工作项弹窗合并商品类型和准备项确认**

在 `renderConfirmItemsDialog()` 表单中，先渲染商品类型 radio：

```ts
<div class="rounded-lg border p-3">
  <div class="mb-2 text-sm font-medium">1. 确认商品类型</div>
  ${(['非烫画&非毛织（纯梭织）', '烫画&直喷', '毛织', '毛织&梭织'] as ProductPrepType[]).map((type) => `
    <label class="mr-4 inline-flex items-center gap-1 text-sm">
      <input type="radio" name="confirmedProductPrepType" value="${escapeHtml(type)}" ${type === record.confirmedProductPrepType ? 'checked' : ''} />
      <span>${escapeHtml(type)}</span>
    </label>
  `).join('')}
</div>
```

准备项区标题改为：

```ts
<div class="mb-2 text-sm font-medium">2. 确认准备项</div>
```

把当前 `disabled` 的必做项取消禁用，只保留默认勾选；辅料下单可取消：

```ts
<input type="checkbox" name="itemId" value="${escapeHtml(item.itemId)}" ${item.requiredKind === '必做' || item.selectedByMerchandiser ? 'checked' : ''} />
```

这一版先把同窗确认和辅料可取消落地；类型切换后只显示并提交对应类型准备项，在任务 4 用模板和事件委托收口。

- [ ] **步骤 9：让所有操作弹窗都要求上传文件**

把 `renderOperateItemDialog()` 里的文件 input 改为：

```ts
<input type="file" name="files" class="mt-1 w-full rounded-md border px-3 py-2" multiple required />
```

辅料下单仍保留 `orderedAt`，但没有凭证文件时不能提交完成。

- [ ] **步骤 10：运行检查验证通过**

运行：

```bash
npm run check:production-preparation-timing
```

预期：PASS。

- [ ] **步骤 11：Commit**

```bash
git add src/pages/production/preparation-timing.ts scripts/check-production-preparation-timing.ts
git commit -m "fix: render preparation ledger from upload evidence"
```

---

## 任务 4：提交处理、类型模板、弹窗切换和完整验证

**文件：**
- 修改：`/Users/laoer/Documents/higoods/src/data/fcs/production-preparation-timing.ts`
- 修改：`/Users/laoer/Documents/higoods/src/data/fcs/production-preparation-timing-runtime.ts`
- 修改：`/Users/laoer/Documents/higoods/src/pages/production/preparation-timing.ts`

- [ ] **步骤 1：增加商品类型准备项模板**

在 `production-preparation-timing.ts` 增加：

```ts
export const preparationTypeDefaultItems: Record<ProductPrepType, Array<{
  itemType: PreparationItemType
  defaultSelected: boolean
  canUnselect: boolean
}>> = {
  '非烫画&非毛织（纯梭织）': [
    { itemType: '梭织基码纸样', defaultSelected: true, canUnselect: false },
    { itemType: '版衣制作', defaultSelected: true, canUnselect: false },
    { itemType: '梭织齐码纸样', defaultSelected: true, canUnselect: false },
    { itemType: '辅料下单', defaultSelected: true, canUnselect: true },
    { itemType: '数码印/DTF/DTG花型', defaultSelected: false, canUnselect: true },
    { itemType: '染色调色（面料）', defaultSelected: false, canUnselect: true },
  ],
  '烫画&直喷': [
    { itemType: '数码印/DTF/DTG花型', defaultSelected: true, canUnselect: false },
  ],
  '毛织': [
    { itemType: '毛织基码纸样', defaultSelected: true, canUnselect: false },
    { itemType: '版衣制作', defaultSelected: true, canUnselect: false },
    { itemType: '毛织齐码纸样', defaultSelected: true, canUnselect: false },
    { itemType: '辅料下单', defaultSelected: true, canUnselect: true },
    { itemType: '染色调色（面料）', defaultSelected: false, canUnselect: true },
  ],
  '毛织&梭织': [
    { itemType: '毛织基码纸样', defaultSelected: true, canUnselect: false },
    { itemType: '梭织基码纸样', defaultSelected: true, canUnselect: false },
    { itemType: '版衣制作', defaultSelected: true, canUnselect: false },
    { itemType: '毛织齐码纸样', defaultSelected: true, canUnselect: false },
    { itemType: '梭织齐码纸样', defaultSelected: true, canUnselect: false },
    { itemType: '辅料下单', defaultSelected: true, canUnselect: true },
    { itemType: '数码印/DTF/DTG花型', defaultSelected: false, canUnselect: true },
    { itemType: '染色调色（纱线）', defaultSelected: false, canUnselect: true },
    { itemType: '染色调色（面料）', defaultSelected: false, canUnselect: true },
  ],
}
```

- [ ] **步骤 2：提交确认时保存类型和准备项类型**

在 `handleProductionPreparationTimingSubmit()` 的确认分支中替换保存结构：

```ts
const confirmedProductPrepType = String(formData.get('confirmedProductPrepType') ?? '').trim() as ProductPrepType
const selectedItemTypes = formData.getAll('itemType').map((itemType) => String(itemType).trim()).filter(Boolean) as PreparationItemType[]
const overrideReason = String(formData.get('overrideReason') ?? '').trim()
```

保存：

```ts
[recordId]: {
  confirmedBy: '当前跟单',
  confirmedAt: currentIsoMinute(),
  confirmedProductPrepType,
  selectedItemTypes,
  overrideReason,
},
```

- [ ] **步骤 3：确认弹窗按商品类型模板渲染准备项**

在 `preparation-timing.ts` import 中加入：

```ts
  preparationTypeDefaultItems,
```

在页面文件中增加类型 key：

```ts
const PRODUCT_PREP_TYPE_KEYS: Array<{ key: string; type: ProductPrepType }> = [
  { key: 'woven', type: '非烫画&非毛织（纯梭织）' },
  { key: 'print', type: '烫画&直喷' },
  { key: 'knit', type: '毛织' },
  { key: 'mixed', type: '毛织&梭织' },
]
```

确认弹窗里用模板渲染每种类型自己的准备项块：

```ts
${PRODUCT_PREP_TYPE_KEYS.map(({ key, type }) => `
  <label class="mr-4 inline-flex items-center gap-1 text-sm">
    <input type="radio" name="confirmedProductPrepType" value="${escapeHtml(type)}" data-prep-type-radio="${escapeHtml(key)}" ${type === record.confirmedProductPrepType ? 'checked' : ''} />
    <span>${escapeHtml(type)}</span>
  </label>
`).join('')}

${PRODUCT_PREP_TYPE_KEYS.map(({ key, type }) => {
  const visible = type === record.confirmedProductPrepType
  const currentItemTypes = new Set(requiredItems(record).map((item) => item.itemType))
  return `
    <div data-prep-type-block="${escapeHtml(key)}" class="${visible ? '' : 'hidden'}">
      ${preparationTypeDefaultItems[type].map((template) => `
        <label class="flex items-start gap-2 rounded-lg border p-3 text-sm">
          <input type="checkbox" name="itemType" value="${escapeHtml(template.itemType)}" ${template.defaultSelected || currentItemTypes.has(template.itemType) ? 'checked' : ''} ${visible ? '' : 'disabled'} />
          <span>
            <span class="font-medium">${escapeHtml(template.itemType)}</span>
            <span class="mt-1 block text-xs text-muted-foreground">${template.canUnselect ? '可取消/可选择' : '默认准备项'}</span>
          </span>
        </label>
      `).join('')}
    </div>
  `
}).join('')}
```

- [ ] **步骤 4：用事件委托切换确认弹窗准备项块**

在 `handleProductionPreparationTimingEvent()` 里先处理类型 radio：

```ts
const typeRadio = target.closest<HTMLInputElement>('[data-prep-type-radio]')
if (typeRadio) {
  const form = typeRadio.closest<HTMLFormElement>('[data-prep-confirm-items-form]')
  if (!form) return true
  const activeKey = typeRadio.dataset.prepTypeRadio
  form.querySelectorAll<HTMLElement>('[data-prep-type-block]').forEach((block) => {
    const active = block.dataset.prepTypeBlock === activeKey
    block.classList.toggle('hidden', !active)
    block.querySelectorAll<HTMLInputElement>('input[name="itemType"]').forEach((input) => {
      input.disabled = !active
    })
  })
  return true
}
```

主入口已经会把 `change` 事件分发到 `handleProductionEvent()`，这里不用新增全局 listener。

- [ ] **步骤 5：确认弹窗 checkbox 使用 itemType**

把确认弹窗中的 checkbox name 从 `itemId` 改成 `itemType`：

```ts
<input type="checkbox" name="itemType" value="${escapeHtml(item.itemType)}" ${item.requiredKind === '必做' || item.selectedByMerchandiser ? 'checked' : ''} />
```

这让运行态确认不依赖不同类型模板下的临时 itemId。

- [ ] **步骤 6：运行态合并按 itemType 判断选中**

在 `mergePreparationRuntimeItem()` 中替换选中逻辑：

```ts
const selectedItemTypes = confirmation?.selectedItemTypes
const selectionOverridden = Array.isArray(selectedItemTypes)
const selectedByMerchandiser = selectionOverridden
  ? selectedItemTypes.includes(item.itemType)
  : item.selectedByMerchandiser
```

删除 `item.requiredKind === '必做' ||`，保证辅料下单能取消。

- [ ] **步骤 7：辅料下单提交必须有真实文件记录**

在 `handleProductionPreparationTimingSubmit()` 的操作分支中替换无文件处理：

```ts
if (!files.length) return true
```

构建上传记录后，如果是辅料下单且有下单时间，把上传时间改成下单时间：

```ts
const normalizedUploadRecords = item.itemType === '辅料下单' && orderedAt
  ? uploadRecords.map((upload) => ({
      ...upload,
      uploadedAt: orderedAt,
      note: [note, `下单时间：${orderedAt}`].filter(Boolean).join('；'),
    }))
  : uploadRecords

appendPreparationUploads(normalizedUploadRecords)
```

删除当前 `orderedAtRecord` 的零字节伪上传。

- [ ] **步骤 8：补检查脚本覆盖类型模板和辅料取消**

在 `scripts/check-production-preparation-timing.ts` 增加：

```ts
assertIncludes(
  'src/data/fcs/production-preparation-timing.ts',
  'preparationTypeDefaultItems',
  '必须有商品类型到准备项模板映射',
)
assert.ok(
  !source('src/data/fcs/production-preparation-timing-runtime.ts').includes("item.requiredKind === '必做' ||"),
  '运行态确认不得强制必做项永远选中，辅料下单必须允许取消',
)
assert.ok(
  !source('src/pages/production/preparation-timing.ts').includes("fileName: '辅料下单时间'"),
  '辅料下单不得用零字节伪上传代替真实上传凭证',
)
```

- [ ] **步骤 9：运行全部验证**

运行：

```bash
npm run check:production-preparation-timing
npm run check:menu-routes
npm run build
```

预期：

```text
production preparation timing checks passed
```

`check:menu-routes` 通过，`npm run build` 通过。

- [ ] **步骤 10：CodeGraph 同步**

运行：

```bash
codegraph sync && codegraph status
```

预期：`✓ Index is up to date`。

- [ ] **步骤 11：Commit**

```bash
git add src/data/fcs/production-preparation-timing.ts src/data/fcs/production-preparation-timing-runtime.ts src/pages/production/preparation-timing.ts scripts/check-production-preparation-timing.ts
git commit -m "fix: require upload evidence for preparation completion"
```

---

## 自检结论

- 规格覆盖：覆盖了“已完成必须有上传信息”、基码纸样下载记录、跟单确认商品类型与准备项、辅料下单可取消、分页、真实图片、操作列独立按钮、产出分行展示。
- 范围控制：不接后端、不引入新框架、不重构路由，只改生产准备时效页面、数据、运行态和检查脚本。
- 关键验收：任何已选择准备项只有在存在上传记录、上传人、上传时间和实际完成时间时，才能参与进度、产出、统计和 `已完成` 展示。
