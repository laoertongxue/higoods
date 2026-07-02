# 生产准备时效真实上传与下载记录实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 把 `生产准备时效` 从 URL 参数模拟上传，调整为浏览器内真实选择文件、保存上传记录、记录基码纸样下载、按工作项弹窗操作、按产出对象展示产出时间。

**架构：** 保持现有 Vite + Vanilla TypeScript 字符串模板。新增一个小型 runtime 文件用 `localStorage` 保存原型运行态；页面负责渲染弹窗和调用 runtime；现有 mock 数据继续作为初始数据源。

**技术栈：** Vite、TypeScript、Tailwind CSS、Vanilla TypeScript、`localStorage`、`FileReader`、`tsx` 自检脚本、CodeGraph。

---

## 文件结构

- 创建：`src/data/fcs/production-preparation-timing-runtime.ts`
  - 保存工作项确认、上传记录、下载记录。
  - 提供读取文件、写入上传、写入下载、合并 runtime 到 mock 记录的函数。

- 修改：`src/data/fcs/production-preparation-timing.ts`
  - 增加上传记录、下载记录、工作项确认字段、产出时间字段。
  - 保持 mock 数据作为初始状态。

- 修改：`src/pages/production/preparation-timing.ts`
  - 去掉 URL 参数上传 mock。
  - 增加确认工作项弹窗。
  - 增加工作项独立操作弹窗。
  - 展示上传记录、基码纸样下载记录、产出对象分行状态。
  - 导出页面事件处理函数。

- 修改：`src/main.ts`
  - 在生产路由事件处理中继续复用 `production/events.ts`，不直接加页面分支。

- 修改：`src/pages/production/events.ts`
  - 将 `/fcs/production/preparation-timing` 的点击和提交事件分发到页面 handler。

- 修改：`scripts/check-production-preparation-timing.ts`
  - 增加无后端可跑的检查：字段、HTML、runtime 纯函数、旧 mock 参数移除。

---

## 任务 1：补类型和失败检查

**文件：**
- 修改：`src/data/fcs/production-preparation-timing.ts`
- 修改：`scripts/check-production-preparation-timing.ts`

- [ ] **步骤 1：给数据类型加字段**

在 `ProductionPreparationItem` 附近增加：

```ts
export interface PreparationUploadRecord {
  uploadId: string
  recordId: string
  itemId: string
  itemType: PreparationItemType
  fileName: string
  fileType: string
  fileSize: number
  fileDataUrl: string
  uploadedBy: string
  uploadedAt: string
  note: string
}

export interface PreparationDownloadRecord {
  downloadId: string
  recordId: string
  itemId: string
  uploadId: string
  fileName: string
  downloadedBy: string
  downloadedAt: string
}
```

在 `ProductionPreparationItem` 内增加：

```ts
  uploads?: PreparationUploadRecord[]
  downloads?: PreparationDownloadRecord[]
```

在 `ProductionPreparationRecord` 内增加：

```ts
  workItemsConfirmedBy: string
  workItemsConfirmedAt: string
```

在 `ProductionPreparationOutput` 内增加：

```ts
  outputGeneratedAt: string
```

- [ ] **步骤 2：补 mock 默认值**

把 `outputsFor()` 签名改为带产出时间：

```ts
function outputsFor(
  recordNo: string,
  orderNo: string,
  ready: boolean,
  outputPublishedAt: string,
  items: PreparationItemSeed[],
): ProductionPreparationOutput[] {
  const generatedAt = ready ? outputPublishedAt : ''
  const status: PreparationOutputStatus = ready ? '已生成' : '预计生成'
  const prefix = ready ? '' : '预计'
  const selectedItems = items.filter((item) => item.selectedByMerchandiser !== false)
  const outputs: ProductionPreparationOutput[] = [
    { outputType: '正式技术包', outputNo: `${prefix}TP-${orderNo}`, outputHref: `/fcs/production/orders/${encodeURIComponent(orderNo)}/tech-pack`, outputStatus: status, outputGeneratedAt: generatedAt },
    { outputType: '生产单', outputNo: orderNo, outputHref: orderHref(orderNo), outputStatus: status, outputGeneratedAt: generatedAt },
  ]

  if (selectedItems.some((item) => item.itemType === '数码印/DTF/DTG花型')) {
    outputs.push({ outputType: '印花单', outputNo: `${prefix}PR-${recordNo.slice(-3)}`, outputHref: '/fcs/craft/printing/orders', outputStatus: status, outputGeneratedAt: generatedAt })
  }
  if (selectedItems.some((item) => item.itemType === '染色调色（纱线）' || item.itemType === '染色调色（面料）')) {
    outputs.push({ outputType: '染色单', outputNo: `${prefix}DY-${recordNo.slice(-3)}`, outputHref: '/fcs/craft/dyeing/orders', outputStatus: status, outputGeneratedAt: generatedAt })
  }
  if (selectedItems.some((item) => item.itemType === '辅料下单')) {
    outputs.push({ outputType: '辅料采购单', outputNo: `${prefix}AP-${recordNo.slice(-3)}`, outputHref: '/fcs/purchase/accessory-orders', outputStatus: status, outputGeneratedAt: generatedAt })
  }

  return outputs
}
```

在 `record(seed)` 返回值里补：

```ts
workItemsConfirmedBy: seed.prepTypeConfirmedBy,
workItemsConfirmedAt: seed.prepTypeConfirmedAt,
outputs: outputsFor(seed.recordNo, seed.productionOrderNo, seed.outputReady, seed.outputPublishedAt, seed.items),
```

在 `createItems()` 的默认对象里补：

```ts
uploads: [],
downloads: [],
```

- [ ] **步骤 3：写失败检查**

在 `scripts/check-production-preparation-timing.ts` 增加断言：

```ts
assert.ok(
  productionPreparationRecords.every((record: {
    workItemsConfirmedBy?: string
    workItemsConfirmedAt?: string
    outputs?: Array<{ outputGeneratedAt?: string; outputStatus?: string }>
  }) =>
    record.workItemsConfirmedBy &&
    record.workItemsConfirmedAt &&
    record.outputs?.every((output) => output.outputStatus === '预计生成' ? output.outputGeneratedAt === '' : Boolean(output.outputGeneratedAt)),
  ),
  '生产准备记录必须有工作项确认信息，已生成产出必须有产出时间',
)

const pageSource = source('src/pages/production/preparation-timing.ts')
assert.ok(!pageSource.includes('mockCompletionUploaded'), '不得继续使用 mockCompletionUploaded 模拟上传')
assert.ok(!pageSource.includes('已模拟提交完成资料'), '不得继续显示模拟上传文案')
```

- [ ] **步骤 4：运行检查验证失败**

运行：

```bash
npm run check:production-preparation-timing
```

预期：FAIL，至少出现新增字段或 `mockCompletionUploaded` 相关失败。

- [ ] **步骤 5：Commit**

```bash
git add src/data/fcs/production-preparation-timing.ts scripts/check-production-preparation-timing.ts
git commit -m "test: cover preparation upload audit fields"
```

---

## 任务 2：新增 runtime 存储和纯函数检查

**文件：**
- 创建：`src/data/fcs/production-preparation-timing-runtime.ts`
- 修改：`scripts/check-production-preparation-timing.ts`

- [ ] **步骤 1：创建 runtime 文件**

创建 `src/data/fcs/production-preparation-timing-runtime.ts`：

```ts
import type {
  PreparationDownloadRecord,
  PreparationItemType,
  PreparationUploadRecord,
  ProductionPreparationItem,
  ProductionPreparationRecord,
} from './production-preparation-timing'

export const PREPARATION_RUNTIME_STORAGE_KEY = 'higood.production-preparation.runtime.v1'

export interface PreparationRuntimeState {
  confirmedRecords: Record<string, { confirmedBy: string; confirmedAt: string; selectedItemIds: string[] }>
  uploads: PreparationUploadRecord[]
  downloads: PreparationDownloadRecord[]
}

export const EMPTY_PREPARATION_RUNTIME_STATE: PreparationRuntimeState = {
  confirmedRecords: {},
  uploads: [],
  downloads: [],
}

export function isBasePatternItem(itemType: PreparationItemType): boolean {
  return itemType === '梭织基码纸样' || itemType === '毛织基码纸样'
}

export function nowIsoMinute(): string {
  return new Date().toISOString().slice(0, 16)
}

export function createLocalId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function loadPreparationRuntimeState(): PreparationRuntimeState {
  try {
    const raw = window.localStorage.getItem(PREPARATION_RUNTIME_STORAGE_KEY)
    if (!raw) return EMPTY_PREPARATION_RUNTIME_STATE
    const parsed = JSON.parse(raw) as Partial<PreparationRuntimeState>
    return {
      confirmedRecords: parsed.confirmedRecords ?? {},
      uploads: Array.isArray(parsed.uploads) ? parsed.uploads : [],
      downloads: Array.isArray(parsed.downloads) ? parsed.downloads : [],
    }
  } catch {
    return EMPTY_PREPARATION_RUNTIME_STATE
  }
}

export function savePreparationRuntimeState(state: PreparationRuntimeState): void {
  window.localStorage.setItem(PREPARATION_RUNTIME_STORAGE_KEY, JSON.stringify(state))
}

export function mergePreparationRuntimeRecords(
  records: ProductionPreparationRecord[],
  runtime: PreparationRuntimeState,
): ProductionPreparationRecord[] {
  return records.map((record) => {
    const confirmation = runtime.confirmedRecords[record.recordId]
    const items = record.items.map((item) => mergePreparationRuntimeItem(item, runtime, confirmation?.selectedItemIds))
    return {
      ...record,
      workItemsConfirmedBy: confirmation?.confirmedBy ?? record.workItemsConfirmedBy,
      workItemsConfirmedAt: confirmation?.confirmedAt ?? record.workItemsConfirmedAt,
      items,
    }
  })
}

function mergePreparationRuntimeItem(
  item: ProductionPreparationItem,
  runtime: PreparationRuntimeState,
  selectedItemIds?: string[],
): ProductionPreparationItem {
  const uploads = runtime.uploads.filter((upload) => upload.itemId === item.itemId)
  const downloads = runtime.downloads.filter((download) => download.itemId === item.itemId)
  const selectionOverridden = Array.isArray(selectedItemIds)
  const selectedByMerchandiser = selectionOverridden
    ? item.requiredKind === '必做' || selectedItemIds.includes(item.itemId)
    : item.selectedByMerchandiser
  if (!uploads.length && !downloads.length && !selectionOverridden) return item
  const lastUpload = uploads.slice().sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))[0]
  return {
    ...item,
    selectedByMerchandiser,
    status: !selectedByMerchandiser ? '无需' : lastUpload ? '已完成' : item.status,
    actualFinishAt: lastUpload?.uploadedAt ?? item.actualFinishAt,
    evidenceSummary: lastUpload ? `最后上传：${lastUpload.fileName}` : item.evidenceSummary,
    uploads: [...(item.uploads ?? []), ...uploads],
    downloads: [...(item.downloads ?? []), ...downloads],
  }
}
```

- [ ] **步骤 2：给 runtime 加文件读取函数**

继续在同一文件追加：

```ts
export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(reader.error ?? new Error('文件读取失败'))
    reader.readAsDataURL(file)
  })
}

export async function buildUploadRecordsFromFiles(input: {
  recordId: string
  itemId: string
  itemType: PreparationItemType
  files: File[]
  uploadedBy: string
  note: string
}): Promise<PreparationUploadRecord[]> {
  const uploadedAt = nowIsoMinute()
  const records: PreparationUploadRecord[] = []
  for (const file of input.files) {
    records.push({
      uploadId: createLocalId('upload'),
      recordId: input.recordId,
      itemId: input.itemId,
      itemType: input.itemType,
      fileName: file.name,
      fileType: file.type || 'application/octet-stream',
      fileSize: file.size,
      fileDataUrl: await readFileAsDataUrl(file),
      uploadedBy: input.uploadedBy,
      uploadedAt,
      note: input.note,
    })
  }
  return records
}
```

- [ ] **步骤 3：给 runtime 加下载记录函数**

继续追加：

```ts
export function appendDownloadRecord(
  runtime: PreparationRuntimeState,
  input: {
    recordId: string
    itemId: string
    uploadId: string
    fileName: string
    downloadedBy: string
  },
): PreparationRuntimeState {
  return {
    ...runtime,
    downloads: [
      ...runtime.downloads,
      {
        downloadId: createLocalId('download'),
        recordId: input.recordId,
        itemId: input.itemId,
        uploadId: input.uploadId,
        fileName: input.fileName,
        downloadedBy: input.downloadedBy,
        downloadedAt: nowIsoMinute(),
      },
    ],
  }
}
```

- [ ] **步骤 4：写 runtime 纯函数检查**

在 `scripts/check-production-preparation-timing.ts` import：

```ts
import {
  EMPTY_PREPARATION_RUNTIME_STATE,
  appendDownloadRecord,
  isBasePatternItem,
  mergePreparationRuntimeRecords,
} from '../src/data/fcs/production-preparation-timing-runtime.ts'
```

增加断言：

```ts
assert.equal(isBasePatternItem('梭织基码纸样'), true, '梭织基码纸样必须记录下载')
assert.equal(isBasePatternItem('毛织基码纸样'), true, '毛织基码纸样必须记录下载')
assert.equal(isBasePatternItem('梭织齐码纸样'), false, '齐码纸样不属于基码下载审计')

const runtimeWithDownload = appendDownloadRecord(EMPTY_PREPARATION_RUNTIME_STATE, {
  recordId: 'record-a',
  itemId: 'item-a',
  uploadId: 'upload-a',
  fileName: 'base.prj',
  downloadedBy: '测试用户',
})
assert.equal(runtimeWithDownload.downloads.length, 1, '下载必须生成一条记录')
assert.equal(runtimeWithDownload.downloads[0].fileName, 'base.prj', '下载记录必须保存文件名')

const mergedRecords = mergePreparationRuntimeRecords(productionPreparationRecords, {
  ...EMPTY_PREPARATION_RUNTIME_STATE,
  uploads: [{
    uploadId: 'upload-test',
    recordId: productionPreparationRecords[0].recordId,
    itemId: productionPreparationRecords[0].items[0].itemId,
    itemType: productionPreparationRecords[0].items[0].itemType,
    fileName: 'base.prj',
    fileType: 'application/octet-stream',
    fileSize: 12,
    fileDataUrl: 'data:application/octet-stream;base64,YQ==',
    uploadedBy: '测试用户',
    uploadedAt: '2026-07-02T10:30',
    note: '测试上传',
  }],
  downloads: [],
})
assert.equal(mergedRecords[0].items[0].actualFinishAt, '2026-07-02T10:30', '上传后工作项完成时间必须取上传时间')
```

- [ ] **步骤 5：运行检查验证通过**

运行：

```bash
npm run check:production-preparation-timing
```

预期：PASS。

- [ ] **步骤 6：Commit**

```bash
git add src/data/fcs/production-preparation-timing-runtime.ts scripts/check-production-preparation-timing.ts
git commit -m "feat: add preparation upload runtime"
```

---

## 任务 3：把页面改成真实工作项弹窗

**文件：**
- 修改：`src/pages/production/preparation-timing.ts`
- 修改：`scripts/check-production-preparation-timing.ts`

- [ ] **步骤 1：引入 runtime 并替换记录来源**

在页面 import 中加入：

```ts
import {
  appendDownloadRecord,
  buildUploadRecordsFromFiles,
  isBasePatternItem,
  loadPreparationRuntimeState,
  mergePreparationRuntimeRecords,
  savePreparationRuntimeState,
  type PreparationRuntimeState,
} from '../../data/fcs/production-preparation-timing-runtime'
```

把 `renderLedgerTab()` 中原来的：

```ts
const mockedRecords = applyPreparationActionMocks(productionPreparationRecords, params)
```

替换为：

```ts
const runtime = loadPreparationRuntimeState()
const records = mergePreparationRuntimeRecords(productionPreparationRecords, runtime)
```

删除 `applyPreparationActionMocks()`。

- [ ] **步骤 2：列表行改成弹窗入口**

在 `renderLedgerRow()` 里改行操作：

```ts
const confirmHref = buildLedgerActionHref(params, month, { recordId: record.recordId, action: 'confirm-items' })
const activeActionHref = firstActionItem
  ? buildLedgerActionHref(params, month, { recordId: record.recordId, itemId: firstActionItem.itemId, action: 'operate-item' })
  : ''
```

行操作输出：

```html
<button type="button" class="text-sm text-blue-600 hover:underline" data-nav="${escapeHtml(detailHref)}">查看详情</button>
<button type="button" class="text-sm text-blue-600 hover:underline" data-nav="${escapeHtml(confirmHref)}">确认工作项</button>
${activeActionHref ? `<button type="button" class="text-sm text-blue-600 hover:underline" data-nav="${escapeHtml(activeActionHref)}">操作当前卡点</button>` : ''}
```

- [ ] **步骤 3：详情抽屉只读**

在 `renderDetailDrawer()` 删除：

```ts
${action === 'assign' && activeItem ? renderAssignPanel(record, activeItem, params, month) : ''}
${action === 'upload' && activeItem ? renderUploadPanel(record, activeItem, params, month) : ''}
```

保留：

```ts
${renderPreparationOutputs(record)}
${renderOperationLogs(record)}
```

- [ ] **步骤 4：新增工作项确认弹窗**

新增函数：

```ts
function renderConfirmItemsDialog(record: ProductionPreparationRecord, params: URLSearchParams, month: string): string {
  if (valueOf(params, 'action') !== 'confirm-items') return ''
  const closeHref = buildLedgerActionHref(params, month, { recordId: record.recordId })
  return `
    <div class="fixed inset-0 z-50">
      <button class="absolute inset-0 bg-black/45" data-nav="${escapeHtml(closeHref)}" aria-label="关闭"></button>
      <section class="absolute left-1/2 top-10 w-[720px] max-w-[calc(100vw-32px)] -translate-x-1/2 rounded-xl bg-background p-5 shadow-2xl">
        <h3 class="text-lg font-semibold">确认生产准备工作项</h3>
        <p class="mt-1 text-sm text-muted-foreground">${escapeHtml(record.spuName)}｜${escapeHtml(record.spuCode)}</p>
        <form class="mt-4 space-y-4" data-prep-confirm-items-form>
          <input type="hidden" name="recordId" value="${escapeHtml(record.recordId)}" />
          <div class="grid gap-3 md:grid-cols-2">
            ${record.items.map((item) => `
              <label class="flex items-start gap-2 rounded-lg border p-3 text-sm">
                ${item.requiredKind === '必做' ? `<input type="hidden" name="itemId" value="${escapeHtml(item.itemId)}" />` : ''}
                <input type="checkbox" name="itemId" value="${escapeHtml(item.itemId)}" ${item.requiredKind === '必做' || item.selectedByMerchandiser ? 'checked' : ''} ${item.requiredKind === '必做' ? 'disabled' : ''} />
                <span>
                  <span class="font-medium">${escapeHtml(item.itemType)}</span>
                  <span class="mt-1 block text-xs text-muted-foreground">${escapeHtml(item.requiredKind)}｜${escapeHtml(item.sequenceGroup)}</span>
                </span>
              </label>
            `).join('')}
          </div>
          <div class="flex justify-end gap-2">
            <button type="button" class="rounded-md border px-4 py-2 text-sm" data-nav="${escapeHtml(closeHref)}">取消</button>
            <button type="submit" class="rounded-md bg-blue-600 px-4 py-2 text-sm text-white">确认工作项</button>
          </div>
        </form>
      </section>
    </div>
  `
}
```

在 `renderLedgerTab()` 的详情区域后追加：

```ts
${detailRecord ? renderConfirmItemsDialog(detailRecord, params, month) : ''}
```

- [ ] **步骤 5：新增工作项操作弹窗**

新增函数：

```ts
function renderOperateItemDialog(record: ProductionPreparationRecord, item: ProductionPreparationItem, params: URLSearchParams, month: string): string {
  if (valueOf(params, 'action') !== 'operate-item') return ''
  const closeHref = buildLedgerActionHref(params, month, { recordId: record.recordId })
  const isAccessory = item.itemType === '辅料下单'
  return `
    <div class="fixed inset-0 z-50">
      <button class="absolute inset-0 bg-black/45" data-nav="${escapeHtml(closeHref)}" aria-label="关闭"></button>
      <section class="absolute left-1/2 top-10 w-[760px] max-w-[calc(100vw-32px)] -translate-x-1/2 rounded-xl bg-background p-5 shadow-2xl">
        <h3 class="text-lg font-semibold">${escapeHtml(item.itemType)}</h3>
        <p class="mt-1 text-sm text-muted-foreground">${escapeHtml(record.recordNo)}｜${escapeHtml(record.spuName)}</p>
        <form class="mt-4 space-y-4" data-prep-operate-item-form>
          <input type="hidden" name="recordId" value="${escapeHtml(record.recordId)}" />
          <input type="hidden" name="itemId" value="${escapeHtml(item.itemId)}" />
          ${isAccessory ? `
            <label class="block text-sm">
              <span class="text-muted-foreground">下单时间</span>
              <input type="datetime-local" name="orderedAt" class="mt-1 w-full rounded-md border px-3 py-2" required />
            </label>
          ` : ''}
          <label class="block text-sm">
            <span class="text-muted-foreground">${isAccessory ? '下单凭证' : '上传文件'}</span>
            <input type="file" name="files" class="mt-1 w-full rounded-md border px-3 py-2" multiple ${isAccessory ? '' : 'required'} />
          </label>
          <label class="block text-sm">
            <span class="text-muted-foreground">说明</span>
            <textarea name="note" class="mt-1 min-h-20 w-full rounded-md border px-3 py-2"></textarea>
          </label>
          ${renderItemUploadHistory(item)}
          <div class="flex justify-end gap-2">
            <button type="button" class="rounded-md border px-4 py-2 text-sm" data-nav="${escapeHtml(closeHref)}">取消</button>
            <button type="submit" class="rounded-md bg-blue-600 px-4 py-2 text-sm text-white">提交</button>
          </div>
        </form>
      </section>
    </div>
  `
}
```

在 `renderLedgerTab()` 追加：

```ts
${detailRecord && activeItem ? renderOperateItemDialog(detailRecord, activeItem, params, month) : ''}
```

- [ ] **步骤 6：显示上传和下载历史**

新增函数：

```ts
function renderItemUploadHistory(item: ProductionPreparationItem): string {
  const uploads = item.uploads ?? []
  const downloads = item.downloads ?? []
  return `
    <div class="rounded-lg border bg-muted/30 p-3">
      <div class="text-sm font-medium">上传记录</div>
      <div class="mt-2 space-y-2">
        ${uploads.length ? uploads.map((upload) => `
          <div class="rounded-md bg-background p-2 text-xs">
            <div class="font-medium">${escapeHtml(upload.fileName)}</div>
            <div class="mt-1 text-muted-foreground">${escapeHtml(upload.uploadedBy)}｜${escapeHtml(formatDateTime(upload.uploadedAt))}｜${Math.ceil(upload.fileSize / 1024)}KB</div>
            <button type="button" class="mt-2 text-blue-600 hover:underline" data-prep-action="download-upload" data-upload-id="${escapeHtml(upload.uploadId)}" data-item-id="${escapeHtml(item.itemId)}">下载</button>
          </div>
        `).join('') : '<div class="text-xs text-muted-foreground">暂无上传记录</div>'}
      </div>
      ${isBasePatternItem(item.itemType) ? `
        <div class="mt-3 text-sm font-medium">下载记录</div>
        <div class="mt-2 space-y-1 text-xs text-muted-foreground">
          ${downloads.length ? downloads.map((download) => `<div>${escapeHtml(download.fileName)}｜${escapeHtml(download.downloadedBy)}｜${escapeHtml(formatDateTime(download.downloadedAt))}</div>`).join('') : '<div>暂无下载记录</div>'}
        </div>
      ` : ''}
    </div>
  `
}
```

- [ ] **步骤 7：运行检查验证失败**

运行：

```bash
npm run check:production-preparation-timing
```

预期：FAIL，提交 handler 尚未接入。

- [ ] **步骤 8：Commit**

```bash
git add src/pages/production/preparation-timing.ts scripts/check-production-preparation-timing.ts
git commit -m "feat: add preparation item operation dialogs"
```

---

## 任务 4：接入提交和下载事件

**文件：**
- 修改：`src/pages/production/preparation-timing.ts`
- 修改：`src/pages/production/events.ts`
- 修改：`scripts/check-production-preparation-timing.ts`

- [ ] **步骤 1：页面导出事件处理**

在 `src/pages/production/preparation-timing.ts` 末尾追加：

```ts
export async function handleProductionPreparationTimingSubmit(form: HTMLFormElement): Promise<boolean> {
  if (form.hasAttribute('data-prep-confirm-items-form')) {
    const data = new FormData(form)
    const recordId = String(data.get('recordId') || '')
    const selectedItemIds = data.getAll('itemId').map(String)
    const runtime = loadPreparationRuntimeState()
    savePreparationRuntimeState({
      ...runtime,
      confirmedRecords: {
        ...runtime.confirmedRecords,
        [recordId]: {
          confirmedBy: '当前跟单',
          confirmedAt: new Date().toISOString().slice(0, 16),
          selectedItemIds,
        },
      },
    })
    return true
  }

  if (form.hasAttribute('data-prep-operate-item-form')) {
    const data = new FormData(form)
    const recordId = String(data.get('recordId') || '')
    const itemId = String(data.get('itemId') || '')
    const record = productionPreparationRecords.find((item) => item.recordId === recordId)
    const item = record?.items.find((entry) => entry.itemId === itemId)
    if (!record || !item) return true
    const input = form.querySelector<HTMLInputElement>('input[type="file"][name="files"]')
    const files = Array.from(input?.files ?? [])
    const uploads = await buildUploadRecordsFromFiles({
      recordId,
      itemId,
      itemType: item.itemType,
      files,
      uploadedBy: '当前用户',
      note: String(data.get('note') || ''),
    })
    const runtime = loadPreparationRuntimeState()
    savePreparationRuntimeState({ ...runtime, uploads: [...runtime.uploads, ...uploads] })
    return true
  }

  return false
}

export function handleProductionPreparationTimingEvent(target: HTMLElement): boolean {
  const actionNode = target.closest<HTMLElement>('[data-prep-action]')
  if (!actionNode) return false
  if (actionNode.dataset.prepAction !== 'download-upload') return false
  const uploadId = actionNode.dataset.uploadId || ''
  const runtime = loadPreparationRuntimeState()
  const upload = runtime.uploads.find((item) => item.uploadId === uploadId)
  if (!upload) return true
  savePreparationRuntimeState(appendDownloadRecord(runtime, {
    recordId: upload.recordId,
    itemId: upload.itemId,
    uploadId: upload.uploadId,
    fileName: upload.fileName,
    downloadedBy: '当前用户',
  }))
  const link = document.createElement('a')
  link.href = upload.fileDataUrl
  link.download = upload.fileName
  link.click()
  return true
}
```

- [ ] **步骤 2：生产事件分发**

在 `src/pages/production/events.ts` import：

```ts
import {
  handleProductionPreparationTimingEvent,
  handleProductionPreparationTimingSubmit,
} from './preparation-timing'
```

在 `handleProductionEvent()` 开头加入：

```ts
if (window.location.pathname.startsWith('/fcs/production/preparation-timing')) {
  if (handleProductionPreparationTimingEvent(target)) return true
}
```

在 `handleProductionSubmit()` 开头加入：

```ts
if (window.location.pathname.startsWith('/fcs/production/preparation-timing')) {
  return handleProductionPreparationTimingSubmit(form)
}
```

- [ ] **步骤 3：补检查**

在检查脚本增加源码断言：

```ts
assertIncludes(
  'src/pages/production/events.ts',
  'handleProductionPreparationTimingSubmit',
  '生产准备时效必须接入真实提交处理',
)
assertIncludes(
  'src/data/fcs/production-preparation-timing-runtime.ts',
  'FileReader',
  '生产准备时效上传必须读取真实文件',
)
assertIncludes(
  'src/pages/production/preparation-timing.ts',
  'data-prep-action="download-upload"',
  '上传文件必须有下载入口',
)
```

- [ ] **步骤 4：运行检查验证通过**

运行：

```bash
npm run check:production-preparation-timing
npm run build
```

预期：两个命令均 PASS。

- [ ] **步骤 5：Commit**

```bash
git add src/pages/production/preparation-timing.ts src/pages/production/events.ts scripts/check-production-preparation-timing.ts
git commit -m "feat: wire preparation upload and download events"
```

---

## 任务 5：产出对象分行展示和验收

**文件：**
- 修改：`src/pages/production/preparation-timing.ts`
- 修改：`scripts/check-production-preparation-timing.ts`

- [ ] **步骤 1：改产出展示**

把 `renderPreparationOutputs()` 的卡片 grid 改为表格：

```ts
function renderPreparationOutputs(record: ProductionPreparationRecord): string {
  const outputReady = isPreparationOutputReady(record)
  const title = outputReady ? '正式产出' : '预计产出'
  const missingItems = requiredItems(record).filter((item) => item.status !== '已完成')
  return `
    <section class="rounded-xl border bg-card p-4">
      <div class="mb-3 flex items-center justify-between">
        <h3 class="font-semibold">${escapeHtml(title)}</h3>
        ${renderBadge(outputReady ? '已生成' : '预计生成', outputReady ? 'green' : 'amber')}
      </div>
      ${!outputReady && missingItems.length ? `<p class="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">仍需完成：${escapeHtml(missingItems.map((item) => item.itemType).join('、'))}</p>` : ''}
      <div class="overflow-hidden rounded-lg border">
        <table class="w-full text-sm">
          <thead class="bg-muted/60 text-xs text-muted-foreground">
            <tr>
              <th class="px-3 py-2 text-left">产出对象名称</th>
              <th class="px-3 py-2 text-left">产出对象编号</th>
              <th class="px-3 py-2 text-left">状态</th>
              <th class="px-3 py-2 text-left">产出时间</th>
            </tr>
          </thead>
          <tbody>
            ${record.outputs.map((output) => `
              <tr class="border-t">
                <td class="px-3 py-2">${escapeHtml(output.outputType)}</td>
                <td class="px-3 py-2"><button type="button" class="text-blue-600 hover:underline" data-nav="${escapeHtml(output.outputHref)}">${escapeHtml(outputReady ? output.outputNo.replace(/^预计/, '') : output.outputNo)}</button></td>
                <td class="px-3 py-2">${renderBadge(outputReady ? '已生成' : output.outputStatus, outputReady ? 'green' : 'amber')}</td>
                <td class="px-3 py-2">${escapeHtml(output.outputGeneratedAt ? formatDateTime(output.outputGeneratedAt) : '-')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </section>
  `
}
```

- [ ] **步骤 2：补产出检查**

在检查脚本增加：

```ts
const outputTableHtml = await renderAt('/fcs/production/preparation-timing?tab=ledger&month=2026-03&recordId=prep-202603-003')
for (const text of ['产出对象名称', '产出对象编号', '产出时间'] as const) {
  assertHtmlIncludes(outputTableHtml, text, `产出表格缺少「${text}」`)
}
```

- [ ] **步骤 3：跑完整验证**

运行：

```bash
npm run check:production-preparation-timing
npm run check:menu-routes
npm run build
codegraph sync && codegraph status
```

预期：全部 PASS，CodeGraph 显示 `Index is up to date`。

- [ ] **步骤 4：Commit**

```bash
git add src/pages/production/preparation-timing.ts scripts/check-production-preparation-timing.ts
git commit -m "feat: show preparation outputs by object"
```

---

## 自检

- 规格中的“跟单确认工作项”由任务 3 的确认弹窗实现。
- 规格中的“真实上传”由任务 2 runtime 和任务 4 submit handler 实现。
- 规格中的“基码下载记录”由任务 2 `appendDownloadRecord()` 和任务 4 下载事件实现。
- 规格中的“每个工作项独立弹窗”由任务 3 `renderOperateItemDialog()` 实现。
- 规格中的“产出对象名称 + 产出时间”由任务 5 表格实现。
- 本计划不引入后端、数据库、权限系统或新依赖。
