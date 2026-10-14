// @page-pattern: detail
// 单张采购单的条码明细抽屉，无独立管理路由；子列表复用标准表格与分页。
import { renderCode128Barcode } from '../../components/real-barcode.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../components/ui/button.ts'
import { renderStandardListTable, type StandardListColumn } from '../../components/ui/list-table.ts'
import { paginateStandardListRows, type StandardListColumnPreferences } from '../../components/ui/list-table-model.ts'
import { renderTablePagination } from '../../components/ui/pagination.ts'
import { getPmsMaterialPurchaseOrder, getPmsMaterialPurchaseOrderLines, pmsMaterialPurchaseBarcodeLimit, saveMpoDetailBarcodes, type PmsMaterialPurchaseOrder, type PmsMaterialPurchaseOrderLine, type PmsMpoDetailBarcode } from '../../data/pms/material-purchase-orders.ts'
import { PMS_BUYER_ACTOR } from '../../data/pms/runtime.ts'
import { buildPmsHtmlTemplateFile, downloadPmsCsv, downloadPmsFile } from '../../utils/pms-export.ts'
import { parsePmsExcelRows } from '../../utils/pms-excel-import.ts'
import { pmsBusinessNumber } from '../../utils/pms-business-number.ts'
import { escapeHtml } from '../../utils.ts'
import { confirmPmsAction, formatPmsQty, formatPmsTime, handlePmsCommonImageEvent, hydratePmsSurface, nextPmsClientActionId, renderPmsBusinessImage, renderPmsFeedback, renderPmsImagePreview, renderPmsOverlayError, renderPmsStatusBadge } from './shared.ts'

// A child ledger of one purchase order. It stores no separate inventory master and never writes WLS.
const PREFIX = 'pms-mpo-barcode'
const ROOT = '[data-pms-mpo-barcode-root]'
type Barcode = PmsMpoDetailBarcode
type Mode = null | 'create' | 'edit' | 'batch' | 'import' | 'print'
export interface MpoBarcodeCallbacks {
  refresh: () => void
  close: () => void
  feedback: (message: string, ok: boolean) => void
}
interface BarcodeForm {
  purchaseLineId: string
  code: string
  quantity: string
  warehouse: string
  count: string
  originalCode: string
  operationId: string
  createdAt: string
}
interface ImportRow { row: Barcode; error: string }
const state = {
  orderNo: '', purchaseLineId: '', keyword: '', status: '', minQty: '', maxQty: '', createdFrom: '', createdTo: '',
  query: { purchaseLineId: '', keyword: '', status: '', minQty: '', maxQty: '', createdFrom: '', createdTo: '' },
  page: 1, pageSize: 5, selected: new Set<string>(), mode: null as Mode,
  form: null as BarcodeForm | null, importRows: [] as ImportRow[], fileName: '',
  dirty: false, pending: false, filePending: false, error: '', feedback: '', feedbackOk: true,
}
const HEADERS = ['SKU', '条码', '数量', '单位', '仓库']
const LEGACY_HEADERS = ['条码', '数量', '单位', '仓库']
const action = (name: string) => `data-${PREFIX}-action="${name}" data-skip-page-rerender="true"`
const field = (name: string) => `data-${PREFIX}-field="${name}" data-skip-page-rerender="true"`
function currentOrder(): PmsMaterialPurchaseOrder | undefined { return getPmsMaterialPurchaseOrder(state.orderNo) }
function barcodeLine(order: PmsMaterialPurchaseOrder, row: Barcode): PmsMaterialPurchaseOrderLine | undefined {
  const lines = getPmsMaterialPurchaseOrderLines(order)
  if (row.purchaseLineId) return lines.find(line => line.lineId === row.purchaseLineId && (!row.materialCode || line.materialCode === row.materialCode))
  if (row.materialCode) return lines.find(line => line.materialCode === row.materialCode)
  return lines.length === 1 ? lines[0] : undefined
}
function barcodes(): Barcode[] {
  const order = currentOrder()
  if (!order) return []
  return (order.detailBarcodes ?? []).map(row => {
    const line = barcodeLine(order, row)
    return { ...row, ...(line ? { purchaseLineId: line.lineId, materialCode: line.materialCode } : {}) }
  })
}
function quantitySummary(rows: Array<{ quantity: number; unit: string }>): string {
  const totals = new Map<string, number>()
  rows.forEach(row => totals.set(row.unit, (totals.get(row.unit) || 0) + row.quantity))
  return [...totals].map(([unit, quantity]) => formatPmsQty(quantity, unit)).join(' · ') || '0'
}
function renderLineIdentity(line: PmsMaterialPurchaseOrderLine): string {
  const spec = [line.colorName, line.specName].filter(Boolean).join(' · ')
  return `<div class="flex min-w-0 items-center gap-2">${renderPmsBusinessImage(line.imageUrl, line.materialName, 'h-10 w-10')}<div class="min-w-0"><p class="text-sm font-medium">${escapeHtml(line.materialName)}</p><p class="break-all text-xs text-muted-foreground">${escapeHtml(line.materialCode)}</p>${spec ? `<p class="text-xs text-muted-foreground">${escapeHtml(spec)}</p>` : ''}${line.materialSpu ? `<p class="text-xs text-muted-foreground">SPU ${escapeHtml(line.materialSpu)}</p>` : ''}</div></div>`
}
function editable(order: PmsMaterialPurchaseOrder): boolean { return !order.pcsSource && !order.tmfTipSource && order.status !== '已关闭' && !order.purchaseOrderNo.startsWith('TMF-') }
function filteredRows(): Barcode[] {
  const q = state.query
  return barcodes().filter(row => (!q.purchaseLineId || row.purchaseLineId === q.purchaseLineId)
    && (!q.keyword || [row.code, row.materialCode || ''].some(value => value.toLowerCase().includes(q.keyword.toLowerCase())))
    && (!q.status || row.status === q.status)
    && (!q.minQty || row.quantity >= Number(q.minQty)) && (!q.maxQty || row.quantity <= Number(q.maxQty))
    && (!q.createdFrom || Boolean(row.createdAt && row.createdAt.slice(0, 10) >= q.createdFrom))
    && (!q.createdTo || Boolean(row.createdAt && row.createdAt.slice(0, 10) <= q.createdTo)))
}
function resetChild(): void { state.mode = null; state.form = null; state.importRows = []; state.fileName = ''; state.dirty = false; state.error = ''; state.filePending = false }
function initialize(orderNo: string): void {
  if (state.orderNo === orderNo) return
  state.orderNo = orderNo; state.purchaseLineId = ''; state.keyword = ''; state.status = ''; state.minQty = ''; state.maxQty = ''; state.createdFrom = ''; state.createdTo = ''
  state.query = { purchaseLineId: '', keyword: '', status: '', minQty: '', maxQty: '', createdFrom: '', createdTo: '' }
  state.page = 1; state.pageSize = 5; state.selected.clear(); state.feedback = ''; state.pending = false; resetChild()
}
function formField(key: keyof BarcodeForm, label: string, type = 'text', required = true): string {
  const f = state.form!
  return `<label class="block"><span class="mb-1 block text-xs text-muted-foreground">${escapeHtml(label)}${required ? ' *' : ''}</span><input class="h-9 w-full rounded-md border bg-background px-3 text-sm" type="${type}" aria-label="${escapeHtml(label)}" ${field(`form-${key}`)} value="${escapeHtml(f[key])}" ${state.pending ? 'disabled' : ''} ${type === 'number' ? 'min="0" step="any"' : ''}></label>`
}
function renderForm(order: PmsMaterialPurchaseOrder): string {
  if (!state.form) return ''
  if (state.mode === 'import') return renderImport(order)
  const form = state.form, lines = getPmsMaterialPurchaseOrderLines(order)
  const line = lines.find(item => item.lineId === form.purchaseLineId)
  const selected = barcodes().filter(row => state.selected.has(row.code))
  const batchUnits = [...new Set(selected.map(row => row.unit))]
  const title = state.mode === 'create' ? '补充条码' : state.mode === 'batch' ? `批量修改 ${state.selected.size} 个条码` : '修改条码'
  const sku = state.mode === 'batch'
    ? `<p class="mb-3 text-sm">已选 ${selected.length} 个条码 · ${quantitySummary(selected)}</p>`
    : state.mode === 'edit'
      ? line ? renderLineIdentity(line) : '<p class="text-sm text-red-700">条码未关联采购 SKU，不能修改。</p>'
      : `<label class="block"><span class="mb-1 block text-xs text-muted-foreground">采购 SKU *</span><select class="h-9 w-full rounded-md border bg-background px-3 text-sm" aria-label="采购 SKU" ${field('form-purchaseLineId')} ${state.pending ? 'disabled' : ''}><option value="">选择采购 SKU</option>${lines.map(item => `<option value="${escapeHtml(item.lineId)}" ${item.lineId === form.purchaseLineId ? 'selected' : ''}>${escapeHtml(item.materialName)} · ${escapeHtml(item.materialCode)} · ${escapeHtml(item.unit)}</option>`).join('')}</select></label>${line ? `<div class="mt-3">${renderLineIdentity(line)}</div>` : ''}`
  const quantityUnit = state.mode === 'batch' ? batchUnits[0] : line?.unit
  const quantityField = state.mode === 'batch' && batchUnits.length > 1
    ? '<p class="text-sm text-muted-foreground">所选条码单位不同，可批量修改仓库；修改数量时先选择同一单位的条码。</p>'
    : formField('quantity', state.mode === 'batch' ? `每个条码数量（${quantityUnit || '先选择 SKU'}，留空保留）` : `每个条码数量（${quantityUnit || '先选择 SKU'}）`, 'number', state.mode !== 'batch')
  const assigned = line ? quantitySummary(barcodes().filter(row => row.purchaseLineId === line.lineId)) : ''
  const limit = line ? pmsMaterialPurchaseBarcodeLimit(order, line.lineId) : undefined
  const quantityBasis = line ? `<p class="mt-3 text-sm">计划采购 ${formatPmsQty(line.orderedQty, line.unit)} · 已编细码 ${assigned}${limit === undefined ? '' : ` · 可编数量上限 ${formatPmsQty(limit, line.unit)}`}</p>` : ''
  return `<section class="rounded-lg border p-4" aria-label="${title}"><h3 class="mb-3 font-semibold">${title}</h3>${renderPmsOverlayError(state.error)}${sku}<div class="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">${state.mode === 'batch' ? '' : formField('code', '条码', 'text', state.mode === 'edit')}${quantityField}${formField('warehouse', state.mode === 'batch' ? '仓库（留空保留）' : '仓库', 'text', state.mode !== 'batch')}${state.mode === 'create' ? formField('count', '补充条码个数', 'number') : ''}</div>${state.mode === 'create' ? '<p class="mt-2 text-xs text-muted-foreground">条码留空可自动编号；补充多个条码时在编号后加序号。</p>' : ''}${quantityBasis}<footer class="mt-4 flex justify-end gap-2">${renderSecondaryButton('取消填写', { prefix: PREFIX, action: 'cancel-form' })}${renderPrimaryButton(state.pending ? '正在保存…' : '保存条码', { prefix: PREFIX, action: 'save-form' }, 'save')}</footer></section>`
}
function renderImport(_order: PmsMaterialPurchaseOrder): string {
  const rows = state.importRows
  return `<section class="rounded-lg border p-4" aria-label="导入细码"><h3 class="font-semibold">导入细码</h3><p class="my-2 text-xs text-muted-foreground">模板按 SKU 填写数量和单位；每次最多 200 行、文件不超过 2 MB。</p>${renderPmsOverlayError(state.error)}<div class="my-3 flex flex-wrap items-center gap-2">${renderSecondaryButton('下载导入模板', { prefix: PREFIX, action: 'template' }, 'download')}<label class="rounded-md border px-3 py-2 text-sm">选择导入文件<input class="ml-2 max-w-full text-xs" type="file" accept=".xls,.xlsx" aria-label="选择细码文件" ${field('import-file')} ${state.pending || state.filePending ? 'disabled' : ''}></label>${renderSecondaryButton('清除文件', { prefix: PREFIX, action: 'clear-import' })}</div><p class="mb-3 text-sm">${state.filePending ? '正在读取文件…' : state.fileName ? `${escapeHtml(state.fileName)} · ${rows.length} 行` : '尚未选择文件'}</p>${rows.length ? `<div class="max-h-60 overflow-auto rounded-md border"><table class="w-full text-sm"><thead><tr>${[...HEADERS, '检查结果'].map(h => `<th class="p-2 text-left">${h}</th>`).join('')}</tr></thead><tbody>${rows.map(entry => `<tr class="border-t"><td class="p-2">${escapeHtml(entry.row.materialCode || '未匹配 SKU')}</td><td class="p-2">${escapeHtml(entry.row.code)}</td><td>${entry.row.quantity}</td><td>${escapeHtml(entry.row.unit)}</td><td>${escapeHtml(entry.row.warehouse)}</td><td class="${entry.error ? 'text-red-700' : 'text-green-700'}">${escapeHtml(entry.error || '可导入')}</td></tr>`).join('')}</tbody></table></div>` : ''}<footer class="mt-4 flex justify-end gap-2">${renderSecondaryButton('取消导入', { prefix: PREFIX, action: 'cancel-form' })}${renderPrimaryButton(state.pending ? '正在保存…' : `保存导入 ${rows.length} 行`, { prefix: PREFIX, action: 'save-import' }, 'save')}</footer></section>`
}
export function renderMpoBarcodePrintLabel(order: PmsMaterialPurchaseOrder, row: Barcode): string {
  validateCode(row.code)
  const line = barcodeLine(order, row)
  if (!line) throw new Error(`条码 ${row.code} 未关联采购 SKU，不能打印。`)
  if (row.unit !== line.unit) throw new Error(`条码 ${row.code} 的单位与 SKU ${line.materialCode} 不一致，不能打印。`)
  if (!Number.isFinite(row.quantity) || row.quantity <= 0) throw new Error(`条码 ${row.code} 数量无效，不能打印。`)
  const spec = [line.colorName, line.specName].filter(Boolean).join(' · ')
  return `<article class="break-inside-avoid rounded-lg border bg-white p-4 text-black"><div class="mb-3 flex gap-3">${renderPmsBusinessImage(line.imageUrl, line.materialName, 'h-16 w-16')}<div class="min-w-0"><p class="font-semibold">${escapeHtml(line.materialName)}</p><p class="break-all text-xs">${escapeHtml(line.materialCode)}</p>${spec ? `<p class="text-xs">${escapeHtml(spec)}</p>` : ''}${line.materialSpu ? `<p class="text-xs">SPU ${escapeHtml(line.materialSpu)}</p>` : ''}<p class="text-xs">采购单 ${escapeHtml(pmsBusinessNumber(order.purchaseOrderNo))}</p></div></div>${renderCode128Barcode(row.code, `采购条码 ${row.code}`)}<p class="mt-1 break-all text-center font-mono text-sm">${escapeHtml(row.code)}</p><p class="mt-2 text-sm">${formatPmsQty(row.quantity, row.unit)} · ${escapeHtml(row.warehouse)}</p><p class="text-xs">${escapeHtml(row.status)}${row.targetArea ? ` · ${row.targetArea}` : ''}</p></article>`
}
function renderPrint(order: PmsMaterialPurchaseOrder): string {
  const rows = barcodes().filter(row => state.selected.has(row.code))
  return `<section aria-label="采购条码打印预览"><header class="mb-3 flex flex-wrap items-center justify-between gap-2"><h3 class="font-semibold">打印预览 · ${rows.length} 个条码</h3><div class="flex gap-2">${renderSecondaryButton('返回条码列表', { prefix: PREFIX, action: 'cancel-form' })}${renderSecondaryButton('下载打印文件', { prefix: PREFIX, action: 'download-print' }, 'download')}</div></header><p class="mb-3 text-xs text-muted-foreground">预览和下载不登记实际打印时间。</p><div class="grid grid-cols-1 gap-4 sm:grid-cols-2">${rows.map(row => renderMpoBarcodePrintLabel(order, row)).join('')}</div></section>`
}
function renderLedger(order: PmsMaterialPurchaseOrder): string {
  const rows = filteredRows(), paging = paginateStandardListRows(rows, state.page, state.pageSize)
  state.page = paging.currentPage
  const selected = state.selected.size, allowWrite = editable(order)
  const columns: StandardListColumn<Barcode>[] = [
    { key: 'select', title: '', width: 44, required: true, leadingControlColumn: true, renderHeader: pageRows => `<input type="checkbox" aria-label="选择当前页条码" ${field('select-page')} ${pageRows.length && pageRows.every(row => state.selected.has(row.code)) ? 'checked' : ''}>`, render: row => `<input type="checkbox" aria-label="选择条码 ${escapeHtml(row.code)}" ${field('select-row')} data-code="${escapeHtml(row.code)}" ${state.selected.has(row.code) ? 'checked' : ''}>` },
    { key: 'code', title: '条码', width: 180, required: true, render: row => `<span class="break-all font-mono text-xs">${escapeHtml(row.code)}</span>` },
    { key: 'sku', title: '采购 SKU / 物料', width: 260, required: true, render: row => { const line = barcodeLine(order, row); return line ? renderLineIdentity(line) : '<span class="text-red-700">未关联采购 SKU</span>' } },
    { key: 'qty', title: '数量 / 单位', width: 130, align: 'right', render: row => formatPmsQty(row.quantity, row.unit) },
    { key: 'warehouse', title: '仓库 / 区域', width: 150, render: row => `${escapeHtml(row.warehouse)}${row.targetArea ? `<span class="block text-xs text-muted-foreground">${row.targetArea}（本地演示）</span>` : ''}` },
    { key: 'status', title: '条码状态', width: 100, render: row => renderPmsStatusBadge(row.status, row.status === '有效' ? 'green' : 'slate') },
    { key: 'move', title: '下架人 / 时间', width: 145, render: row => row.movedAt ? `${escapeHtml(row.movedBy || '未记录')}<span class="block text-xs">${formatPmsTime(row.movedAt)}</span>` : '未登记下架' },
    { key: 'created', title: '创建时间', width: 145, render: row => formatPmsTime(row.createdAt ?? '') },
    { key: 'print', title: '打印人 / 时间', width: 145, render: row => row.printedAt ? `${escapeHtml(row.printedBy || '未记录')}<span class="block text-xs">${formatPmsTime(row.printedAt)}</span>` : '未登记打印' },
    { key: 'actions', title: '操作', width: 150, actionColumn: true, render: row => `<div class="flex flex-wrap gap-2">${allowWrite ? `<button class="text-xs text-blue-700" ${action('edit')} data-code="${escapeHtml(row.code)}">修改</button><button class="text-xs text-red-700" ${action('delete-one')} data-code="${escapeHtml(row.code)}">删除</button>` : ''}<button class="text-xs text-blue-700" ${action('print-one')} data-code="${escapeHtml(row.code)}">打印预览</button></div>` },
  ]
  const prefs: StandardListColumnPreferences = { order: columns.map(c => c.key), visibleKeys: columns.map(c => c.key), frozenKeys: [], pageSize: state.pageSize }
  return `<section class="rounded-lg border"><header class="pms-compact-toolbar flex flex-wrap items-center justify-between gap-3 border-b p-3"><div><h3 class="font-semibold">条码列表 · 共 ${rows.length} 条</h3><p class="text-xs text-muted-foreground">已选 ${selected} 个 · 数量 ${quantitySummary(rows)}</p></div><div class="flex flex-wrap gap-2">${allowWrite ? renderSecondaryButton('批量修改', { prefix: PREFIX, action: 'batch-edit' }) + renderSecondaryButton('补充条码', { prefix: PREFIX, action: 'create' }, 'plus') + renderSecondaryButton('导入细码', { prefix: PREFIX, action: 'import' }, 'upload') + renderSecondaryButton('批量删除', { prefix: PREFIX, action: 'delete-selected' }, 'trash-2') + renderSecondaryButton('下架到待出库区', { prefix: PREFIX, action: 'offshelf' }) : ''}${renderSecondaryButton('批量打印预览', { prefix: PREFIX, action: 'print-selected' }, 'printer')}</div></header>${renderStandardListTable({ columns, rows: paging.rows, preferences: prefs, sort: null, eventPrefix: PREFIX, skipPageRerender: true, emptyText: '当前条件下暂无条码' })}${renderTablePagination({ total: paging.total, from: paging.from, to: paging.to, currentPage: paging.currentPage, totalPages: paging.totalPages, pageSize: paging.pageSize, actionPrefix: PREFIX, pageSizeOptions: [5, 10, 20, 40], skipPageRerender: true })}</section>`
}
export function renderMpoBarcodeOverlay(orderNo: string, initialMode?: 'import' | 'print'): string {
  const opening = state.orderNo !== orderNo
  initialize(orderNo)
  const order = currentOrder()
  if (!order) return `<div ${ROOT.slice(1, -1)}>${renderPmsOverlayError('采购单未读取，关闭后重新查询。')}${renderSecondaryButton('关闭', { prefix: PREFIX, action: 'close' })}</div>`
  const lines = getPmsMaterialPurchaseOrderLines(order)
  if (opening && initialMode === 'import' && editable(order)) { state.form = newForm(order); state.mode = 'import' }
  if (opening && initialMode === 'print') {
    const rows = barcodes()
    try {
      rows.forEach(row => renderMpoBarcodePrintLabel(order, row))
      if (rows.length) { state.selected = new Set(rows.map(row => row.code)); state.mode = 'print' }
      else feedback('当前采购单没有可打印的条码，先补充或导入细码。', false)
    } catch (reason) { feedback(reason instanceof Error ? reason.message : '条码资料不完整，不能打印。', false) }
  }
  const queryInput = (key: 'keyword' | 'minQty' | 'maxQty' | 'createdFrom' | 'createdTo', label: string, type = 'text') => `<label class="min-w-0"><span class="mb-1 block text-xs text-muted-foreground">${label}</span><input class="h-9 w-full rounded-md border px-3 text-sm" type="${type}" aria-label="${label}" ${field(key)} value="${escapeHtml(state[key])}"></label>`
  const quantityUnit = lines.find(line => line.lineId === state.purchaseLineId)?.unit
  const skuQuery = `<label><span class="mb-1 block text-xs text-muted-foreground">采购 SKU</span><select class="h-9 w-full rounded-md border bg-background px-3 text-sm" aria-label="筛选采购 SKU" ${field('purchaseLineId')}><option value="">全部 SKU</option>${lines.map(line => `<option value="${escapeHtml(line.lineId)}" ${line.lineId === state.purchaseLineId ? 'selected' : ''}>${escapeHtml(line.materialCode)} · ${escapeHtml(line.unit)}</option>`).join('')}</select></label>`
  const allBarcodes = barcodes(), summaryLines = state.query.purchaseLineId ? lines.filter(line => line.lineId === state.query.purchaseLineId) : lines.slice(0, 3)
  const summary = `<section class="rounded-lg border p-3"><div class="grid grid-cols-1 gap-3 sm:grid-cols-2">${summaryLines.map(line => `<div>${renderLineIdentity(line)}<p class="mt-1 text-xs text-muted-foreground">计划采购 ${formatPmsQty(line.orderedQty, line.unit)} · 已编细码 ${quantitySummary(allBarcodes.filter(row => row.purchaseLineId === line.lineId))}</p></div>`).join('')}</div>${summaryLines.length < lines.length ? `<p class="mt-2 text-xs text-muted-foreground">共 ${lines.length} 个 SKU，选择采购 SKU 可查看对应数量。</p>` : ''}</section>`
  const query = `<section class="rounded-lg border p-3"><div class="grid grid-cols-2 gap-3 lg:grid-cols-3">${skuQuery}${queryInput('keyword', '条码 / SKU 关键词')}${queryInput('minQty', quantityUnit ? `最小数量（${quantityUnit}）` : '最小数量', 'number')}${queryInput('maxQty', quantityUnit ? `最大数量（${quantityUnit}）` : '最大数量', 'number')}${queryInput('createdFrom', '创建时间起', 'date')}${queryInput('createdTo', '创建时间止', 'date')}<label><span class="mb-1 block text-xs text-muted-foreground">条码状态</span><select class="h-9 w-full rounded-md border bg-background px-3 text-sm" aria-label="条码状态" ${field('status')}>${['', '有效', '已下架'].map(status => `<option value="${status}" ${state.status === status ? 'selected' : ''}>${status || '全部'}</option>`).join('')}</select></label></div><div class="mt-3 flex gap-2">${renderPrimaryButton('查询', { prefix: PREFIX, action: 'query' }, 'search')}${renderSecondaryButton('重置', { prefix: PREFIX, action: 'reset' }, 'rotate-ccw')}${renderSecondaryButton('导出筛选结果', { prefix: PREFIX, action: 'export' }, 'download')}</div></section>`
  return `<div data-pms-mpo-barcode-root data-skip-page-rerender="true" class="fixed inset-0 z-50"><button class="absolute inset-0 bg-black/45" ${action('close')} aria-label="关闭条码列表"></button><aside class="absolute inset-y-0 right-0 flex w-full max-w-[1120px] flex-col border-l bg-background shadow-2xl" role="dialog" aria-modal="true" aria-label="采购单条码列表"><header class="flex shrink-0 items-center justify-between gap-3 border-b px-5 py-4"><div><h2 class="text-lg font-semibold">采购单条码列表</h2><p class="text-xs text-muted-foreground">${escapeHtml(pmsBusinessNumber(order.purchaseOrderNo))} · ${lines.length} 个 SKU</p></div>${renderSecondaryButton('关闭', { prefix: PREFIX, action: 'close' }, 'x')}</header><div class="space-y-4 overflow-y-auto p-5">${summary}${renderPmsFeedback(state.feedback, state.feedbackOk)}${!editable(order) ? '<p class="rounded-md border bg-amber-50 p-3 text-sm">当前采购单只可查询和预览条码。</p>' : ''}${state.mode === 'print' ? renderPrint(order) : state.mode ? renderForm(order) : query + renderLedger(order)}</div></aside>${renderPmsImagePreview()}</div>`
}
function refreshSurface(): void {
  const node = typeof document === 'undefined' ? null : document.querySelector<HTMLElement>(ROOT)
  if (!node) return
  const scroll = node.querySelector<HTMLElement>('aside > div')?.scrollTop ?? 0
  node.outerHTML = renderMpoBarcodeOverlay(state.orderNo)
  const next = document.querySelector<HTMLElement>(ROOT)
  const content = next?.querySelector<HTMLElement>('aside > div'); if (content) content.scrollTop = scroll
  hydratePmsSurface(next)
  next?.querySelectorAll<HTMLButtonElement>('button').forEach(button => { if (state.pending && !button.closest('[data-pms-common-action]')) button.disabled = true })
}
function feedback(message: string, ok: boolean): void { state.feedback = message; state.feedbackOk = ok }
function newForm(order: PmsMaterialPurchaseOrder): BarcodeForm { const lines = getPmsMaterialPurchaseOrderLines(order); return { purchaseLineId: state.query.purchaseLineId || (lines.length === 1 ? lines[0].lineId : ''), code: '', quantity: '', warehouse: order.warehouse, count: '1', originalCode: '', operationId: nextPmsClientActionId('barcode'), createdAt: new Date().toISOString() } }
function validateCode(code: string): void { if (!code || !/^[\x20-\x7e]{1,80}$/.test(code)) throw new Error('条码须为 1～80 位英文、数字或符号，不能使用中文。') }
export function validateMpoBarcodeRows(rows: Barcode[], order: PmsMaterialPurchaseOrder): void {
  const codes = new Set<string>(), quantities = new Map<string, number>()
  rows.forEach(row => {
    validateCode(row.code)
    if (codes.has(row.code)) throw new Error(`条码 ${row.code} 重复，尚未保存。`)
    codes.add(row.code)
    const line = barcodeLine(order, row)
    if (!line) throw new Error(`条码 ${row.code} 未关联本采购单 SKU，尚未保存。`)
    if (!Number.isFinite(row.quantity) || row.quantity <= 0) throw new Error(`条码 ${row.code} 数量须大于 0。`)
    if (row.unit !== line.unit) throw new Error(`条码 ${row.code} 单位须与 SKU ${line.materialCode} 一致（${line.unit}）。`)
    if (!row.warehouse.trim()) throw new Error(`条码 ${row.code} 缺少仓库。`)
    const old = order.detailBarcodes?.find(item => item.code === row.code)
    if (old && barcodeLine(order, old)?.lineId !== line.lineId) throw new Error(`条码 ${row.code} 已属于其它 SKU，不能改换归属。`)
    const total = (quantities.get(line.lineId) || 0) + row.quantity
    if (!Number.isFinite(total)) throw new Error(`SKU ${line.materialCode} 条码累计数量无效，尚未保存。`)
    quantities.set(line.lineId, total)
  })
  quantities.forEach((total, lineId) => {
    const limit = pmsMaterialPurchaseBarcodeLimit(order, lineId), line = getPmsMaterialPurchaseOrderLines(order).find(item => item.lineId === lineId)!
    if (limit !== undefined && total > limit + 0.000001) throw new Error(`SKU ${line.materialCode} 条码总数量 ${total} ${line.unit} 超过可编数量 ${limit} ${line.unit}，尚未保存。`)
  })
}
async function persist(rows: Barcode[], operationId: string, callbacks: MpoBarcodeCallbacks, success: string): Promise<void> {
  const order = currentOrder(); if (!order) throw new Error('采购单未读取，关闭后重新查询。')
  validateMpoBarcodeRows(rows, order); state.pending = true; refreshSurface()
  try { await saveMpoDetailBarcodes(order.purchaseOrderNo, rows, PMS_BUYER_ACTOR, operationId); resetChild(); state.selected.clear(); feedback(success, true); callbacks.feedback(success, true); callbacks.refresh() }
  finally { state.pending = false; refreshSurface() }
}
export async function closeMpoBarcodeOverlay(callbacks: MpoBarcodeCallbacks): Promise<boolean> {
  if (!state.orderNo) return false
  if (state.pending || state.filePending) { feedback('正在保存或读取文件，完成后再关闭。', false); refreshSurface(); return true }
  if (state.dirty && !(await confirmPmsAction('填写的条码还未保存，关闭后将放弃这些内容。', '放弃填写并关闭', '条码尚未保存'))) return true
  resetChild(); state.orderNo = ''; callbacks.close(); return true
}
export function parseMpoBarcodeImportRows(values: string[][], order: PmsMaterialPurchaseOrder, createdAt: string): ImportRow[] {
  const lines = getPmsMaterialPurchaseOrderLines(order)
  const legacyHeader = LEGACY_HEADERS.every((header, index) => values[0]?.[index]?.trim() === header)
  const currentHeader = HEADERS.every((header, index) => values[0]?.[index]?.trim() === header)
  if (values.length < 2 || (!legacyHeader && !currentHeader)) throw new Error('导入文件表头须依次为：SKU、条码、数量、单位、仓库。请使用导入模板。')
  if (legacyHeader && lines.length !== 1) throw new Error('多 SKU 采购单的导入文件必须填写 SKU，请下载新模板。')
  const data = values.slice(1).filter(row => row.some(value => value.trim()))
  if (!data.length || data.length > 200) throw new Error('每次导入 1～200 行条码。')
  const existing = new Set((order.detailBarcodes || []).map(row => row.code)), seen = new Set<string>()
  const rows: ImportRow[] = data.map(values => {
    const offset = legacyHeader ? 0 : 1, sku = legacyHeader ? lines[0].materialCode : values[0]?.trim() || ''
    const matches = lines.filter(line => line.materialCode === sku), line = matches.length === 1 ? matches[0] : undefined
    const row: Barcode = { purchaseLineId: line?.lineId, materialCode: sku, code: values[offset]?.trim() || '', quantity: Number(values[offset + 1]), unit: values[offset + 2]?.trim() || '', warehouse: values[offset + 3]?.trim() || '', status: '有效', createdAt }
    let error = ''
    try {
      if (!line) throw new Error(sku ? `SKU ${sku} 不属于本采购单或存在重复明细。` : '填写本采购单的 SKU。')
      if (existing.has(row.code) || seen.has(row.code)) throw new Error('条码重复，不能导入。')
      validateMpoBarcodeRows([row], order)
    } catch (reason) { error = reason instanceof Error ? reason.message : '资料不完整。' }
    seen.add(row.code)
    return { row, error }
  })
  for (const line of lines) {
    const limit = pmsMaterialPurchaseBarcodeLimit(order, line.lineId)
    if (limit === undefined) continue
    const existingQty = (order.detailBarcodes || []).filter(row => barcodeLine(order, row)?.lineId === line.lineId).reduce((sum, row) => sum + row.quantity, 0)
    const additions = rows.filter(entry => !entry.error && entry.row.purchaseLineId === line.lineId)
    const total = existingQty + additions.reduce((sum, entry) => sum + entry.row.quantity, 0)
    if (total > limit + 0.000001) additions.forEach(entry => { entry.error = `SKU ${line.materialCode} 导入后 ${total} ${line.unit}，超过可编数量 ${limit} ${line.unit}。` })
  }
  return rows
}
async function readImport(file: File, order: PmsMaterialPurchaseOrder): Promise<void> {
  if (!/\.(xls|xlsx)$/i.test(file.name) || file.size > 2 * 1024 * 1024) throw new Error('选择不超过 2 MB 的模板 .xls 或 .xlsx 文件。')
  state.importRows = parseMpoBarcodeImportRows(await parsePmsExcelRows(file), order, state.form!.createdAt)
  state.fileName = file.name; state.dirty = true
}
export async function handleMpoBarcodeEvent(target: HTMLElement, event: Event | undefined, callbacks: MpoBarcodeCallbacks): Promise<boolean> {
  if (!state.orderNo || typeof document === 'undefined' || !document.querySelector(ROOT)) return false
  if (handlePmsCommonImageEvent(target, event, refreshSurface)) return true
  if (event instanceof KeyboardEvent && event.key === 'Escape') { await closeMpoBarcodeOverlay(callbacks); return true }
  const fieldNode = target.closest<HTMLInputElement | HTMLSelectElement>(`[data-${PREFIX}-field]`)
  if (fieldNode) {
    const key = fieldNode.dataset.pmsMpoBarcodeField!
    if (state.pending || state.filePending) return true
    if (key === 'import-file') {
      const file = (fieldNode as HTMLInputElement).files?.[0], order = currentOrder()
      if (!file || !order) return true
      state.filePending = true; state.error = ''; state.importRows = []; state.fileName = ''; refreshSurface()
      try { await readImport(file, order) } catch (reason) { state.error = reason instanceof Error ? reason.message : '文件未读取，请重新选择。' } finally { state.filePending = false; refreshSurface() }
    } else if (key.startsWith('form-') && state.form) { const name = key.slice(5) as keyof BarcodeForm; state.form[name] = fieldNode.value; state.dirty = true; state.error = ''; if (name === 'purchaseLineId') { state.form.quantity = ''; refreshSurface() } }
    else if (key === 'pageSize') { state.pageSize = Number(fieldNode.value); state.page = 1; refreshSurface() }
    else if (key === 'select-row') { const code = fieldNode.dataset.code!; if ((fieldNode as HTMLInputElement).checked) state.selected.add(code); else state.selected.delete(code); refreshSurface() }
    else if (key === 'select-page') { const rows = paginateStandardListRows(filteredRows(), state.page, state.pageSize).rows; rows.forEach(row => (fieldNode as HTMLInputElement).checked ? state.selected.add(row.code) : state.selected.delete(row.code)); refreshSurface() }
    else if (['purchaseLineId', 'keyword', 'status', 'minQty', 'maxQty', 'createdFrom', 'createdTo'].includes(key)) (state as unknown as Record<string, string>)[key] = fieldNode.value
    return true
  }
  const actionNode = target.closest<HTMLElement>(`[data-${PREFIX}-action]`), name = actionNode?.dataset.pmsMpoBarcodeAction
  if (!name) return false
  event?.preventDefault(); if (state.pending || state.filePending) return true
  const order = currentOrder(); if (!order) { await closeMpoBarcodeOverlay(callbacks); return true }
  try {
    if (name === 'close') return closeMpoBarcodeOverlay(callbacks)
    if (name === 'cancel-form') { if (state.dirty && !(await confirmPmsAction('条码填写还未保存，返回后将放弃这些内容。', '放弃填写并返回', '条码尚未保存'))) return true; resetChild() }
    else if (name === 'query') {
      if ((state.minQty && (!Number.isFinite(Number(state.minQty)) || Number(state.minQty) < 0)) || (state.maxQty && (!Number.isFinite(Number(state.maxQty)) || Number(state.maxQty) < 0)) || (state.minQty && state.maxQty && Number(state.minQty) > Number(state.maxQty))) throw new Error('数量范围须为非负数，最小数量不能大于最大数量。')
      if (state.createdFrom && state.createdTo && state.createdFrom > state.createdTo) throw new Error('创建时间起不能晚于创建时间止。')
      if ((state.minQty || state.maxQty) && !state.purchaseLineId && new Set(getPmsMaterialPurchaseOrderLines(order).map(line => line.unit)).size > 1) throw new Error('采购 SKU 的单位不同，按数量查询时先选择一个 SKU。')
      state.query = { purchaseLineId: state.purchaseLineId, keyword: state.keyword.trim(), status: state.status, minQty: state.minQty, maxQty: state.maxQty, createdFrom: state.createdFrom, createdTo: state.createdTo }; state.page = 1; state.selected.clear(); feedback('', true)
    } else if (name === 'reset') { const no = state.orderNo; state.orderNo = ''; initialize(no) }
    else if (name === 'prev-page') state.page -= 1
    else if (name === 'next-page') state.page += 1
    else if (name === 'export') { const rows = filteredRows(); if (!rows.length) throw new Error('当前条件下没有可导出的条码。'); downloadPmsCsv(`${pmsBusinessNumber(order.purchaseOrderNo)}-条码.csv`, [...HEADERS, '状态', '目标区域', '创建时间', '下架人', '下架时间', '打印人', '打印时间'], rows.map(row => [row.materialCode || '', row.code, row.quantity, row.unit, row.warehouse, row.status, row.targetArea || '', row.createdAt || '', row.movedBy || '', row.movedAt || '', row.printedBy || '', row.printedAt || ''])); feedback(`已生成 ${rows.length} 行条码导出。`, true) }
    else if (name === 'template') downloadPmsFile('采购条码导入模板.xls', buildPmsHtmlTemplateFile('采购条码导入模板', HEADERS, getPmsMaterialPurchaseOrderLines(order).map((line, index) => [line.materialCode, `BC-DEMO-${String(index + 1).padStart(3, '0')}`, 1, line.unit, order.warehouse])), 'application/vnd.ms-excel;charset=utf-8')
    else if (name === 'clear-import') { state.importRows = []; state.fileName = ''; state.error = ''; state.dirty = false }
    else if (name === 'download-print') { const rows = barcodes().filter(row => state.selected.has(row.code)); if (!rows.length) throw new Error('先选择需要打印的条码。'); const html = rows.map(row => renderMpoBarcodePrintLabel(order, row).replaceAll(/<button[^>]*data-pms-common-action="open-image"[^>]*>([\s\S]*?)<\/button>/g, '$1')).join(''); downloadPmsFile(`${pmsBusinessNumber(order.purchaseOrderNo)}-条码打印.html`, `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>${escapeHtml(pmsBusinessNumber(order.purchaseOrderNo))} 条码打印</title><style>body{font:14px sans-serif;margin:12mm;color:#111}main{display:grid;grid-template-columns:1fr 1fr;gap:8mm}article{break-inside:avoid;border:1px solid #ddd;padding:5mm}article img{width:18mm;height:18mm;object-fit:contain}svg{display:block;width:100%;height:15mm}button,span[data-pms-image-loading],span[data-pms-image-error]{display:none}p{margin:3mm 0}article>div{display:flex;gap:4mm}@media print{main{gap:5mm}article{border-color:#999}}</style><main>${html.replaceAll('src="/', `src="${window.location.origin}/`)}</main></html>`, 'text/html;charset=utf-8'); feedback('已生成条码打印文件。打印时间尚未登记。', true) }
    else if (['print-one', 'print-selected'].includes(name)) { if (name === 'print-one') state.selected = new Set([actionNode?.dataset.code || '']); if (!state.selected.size) throw new Error('先选择需要打印的条码。'); barcodes().filter(row => state.selected.has(row.code)).forEach(row => { validateCode(row.code); renderMpoBarcodePrintLabel(order, row) }); state.mode = 'print'; state.error = ''; feedback('', true) }
    else {
      if (!editable(order)) throw new Error('当前来源只可查询和预览采购条码。')
      if (name === 'create' || name === 'import') { resetChild(); feedback('', true); state.form = newForm(order); state.mode = name === 'create' ? 'create' : 'import' }
      else if (name === 'edit') { const row = barcodes().find(row => row.code === actionNode?.dataset.code); if (!row) throw new Error('条码未读取，请重新查询。'); feedback('', true); state.mode = 'edit'; state.form = { ...newForm(order), purchaseLineId: barcodeLine(order, row)?.lineId || '', code: row.code, quantity: String(row.quantity), warehouse: row.warehouse, originalCode: row.code }; state.error = ''; state.dirty = false }
      else if (name === 'batch-edit') { if (!state.selected.size) throw new Error('先选择需要修改的条码。'); feedback('', true); state.mode = 'batch'; state.form = { ...newForm(order), warehouse: '' }; state.error = ''; state.dirty = false }
      else if (name === 'save-form') {
        const f = state.form; if (!f) return true
        let rows = barcodes()
        if (state.mode === 'create') {
          const line = getPmsMaterialPurchaseOrderLines(order).find(item => item.lineId === f.purchaseLineId); if (!line) throw new Error('选择本采购单的 SKU。')
          const count = Number(f.count); if (!Number.isInteger(count) || count < 1 || count > 200) throw new Error('每次补充 1～200 个条码。')
          let hash = 2166136261; for (const c of f.operationId) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619)
          const base = f.code.trim() || `BC-${order.purchaseOrderNo.slice(-4)}-${(hash >>> 0).toString(16).toUpperCase()}`
          rows = [...rows, ...Array.from({ length: count }, (_, index): Barcode => ({ code: count === 1 ? base : `${base}-${String(index + 1).padStart(3, '0')}`, purchaseLineId: line.lineId, materialCode: line.materialCode, quantity: Number(f.quantity), unit: line.unit, warehouse: f.warehouse.trim(), status: '有效', createdAt: f.createdAt }))]
        } else if (state.mode === 'edit') rows = rows.map(row => row.code === f.originalCode ? { ...row, code: f.code.trim(), quantity: Number(f.quantity), warehouse: f.warehouse.trim() } : row)
        else { if (f.quantity && new Set(rows.filter(row => state.selected.has(row.code)).map(row => row.unit)).size > 1) throw new Error('所选条码单位不同，不能批量填写相同数量。'); if (!f.quantity && !f.warehouse.trim()) throw new Error('填写需要修改的数量或仓库。'); rows = rows.map(row => state.selected.has(row.code) ? { ...row, quantity: f.quantity ? Number(f.quantity) : row.quantity, warehouse: f.warehouse.trim() || row.warehouse } : row) }
        await persist(rows, f.operationId, callbacks, '采购条码已保存。')
      } else if (name === 'save-import') { if (!state.importRows.length || !state.form) throw new Error('先选择并检查导入文件。'); if (state.importRows.some(row => row.error)) throw new Error('导入资料有错误，修改文件后重新选择。'); await persist([...barcodes(), ...state.importRows.map(row => row.row)], state.form.operationId, callbacks, `已导入 ${state.importRows.length} 个条码。`) }
      else if (['delete-one', 'delete-selected', 'offshelf'].includes(name)) {
        const codes = name === 'delete-one' ? new Set([actionNode?.dataset.code || '']) : state.selected
        const selected = barcodes().filter(row => codes.has(row.code)); if (!selected.length) throw new Error('先选择需要操作的条码。')
        if (name === 'offshelf' && selected.some(row => row.status !== '有效')) throw new Error('只能下架当前有效的条码；已下架条码不能重复操作。')
        const label = name === 'offshelf' ? '下架到待出库区' : '删除条码', total = quantitySummary(selected)
        const message = name === 'offshelf' ? `${pmsBusinessNumber(order.purchaseOrderNo)} 的 ${selected.length} 个有效条码（${total}）将记录为已下架，目标为待出库区。本地演示不移动实际仓库实物，也不扣减同仓总库存。` : `${pmsBusinessNumber(order.purchaseOrderNo)} 的 ${selected.length} 个条码（${total}）将从采购条码列表删除；不会删除采购单或改变实际仓库库存。`
        if (!(await confirmPmsAction(message, label, label))) return true
        const movedAt = new Date().toISOString(), rows = name === 'offshelf' ? barcodes().map(row => codes.has(row.code) ? { ...row, status: '已下架' as const, targetArea: '待出库区' as const, movedAt, movedBy: PMS_BUYER_ACTOR.name } : row) : barcodes().filter(row => !codes.has(row.code))
        await persist(rows, nextPmsClientActionId(name), callbacks, name === 'offshelf' ? `已记录 ${selected.length} 个条码下架到待出库区（本地演示）。` : `已删除 ${selected.length} 个采购条码。`)
      } else return false
    }
  } catch (reason) { const message = reason instanceof Error ? reason.message : '条码未保存，请重试。'; if (state.mode && state.mode !== 'print') state.error = message; else feedback(message, false) }
  refreshSurface(); return true
}
