// @page-pattern: list
import { listPrintingFactoryOptions } from '../../../data/fcs/printing-factories.ts'
import { renderPrintingBusinessImage } from './work-orders.ts'
import { printingMaterialCode } from './relations.ts'
import {
  createPrintingDispatch, confirmPrintingDispatch, voidPrintingDispatch,
  scanPrintingDispatchRoll, removePrintingDispatchRoll, receivePrintingHandover,
  listPrintingDispatchDocuments, listPrintingWorkOrders, isPrintablePrintingRoll, getPrintingWorkOrderById,
  type PrintingDispatchDocument, type PrintingRollBarcode, type PrintingWorkOrderBusinessRecord,
} from '../../../data/fcs/printing-task-domain.ts'
import { findPdaHandoverRecord } from '../../../data/fcs/pda-handover-events.ts'
import { renderStandardListPage, renderStandardListStats } from '../../../components/ui/list-page.ts'
import { type StandardListColumn } from '../../../components/ui/list-table.ts'
import { createProcessOrderListController, type ProcessOrderListControllerState } from '../../../components/ui/process-order-list-controller.ts'
import { renderSecondaryButton } from '../../../components/ui/button.ts'
import { hydrateIcons } from '../../../components/shell.ts'
import { appStore } from '../../../state/store.ts'
import { escapeHtml as e } from '../../../utils.ts'
import { openPrintingDialog, renderPrintingDialog } from './dialogs.ts'

type Mode = 'pending' | 'documents'
type Order = PrintingWorkOrderBusinessRecord
type DispatchLine = { order: Order; roll: PrintingRollBarcode }
export type PrintingPendingDispatchRow = { order: Order; rolls: PrintingRollBarcode[]; reservedQty: number; documentIds: string[]; availableQty: number; reason: string; docStatus: string }
type ListState = ProcessOrderListControllerState & { keyword: string; factory: string; receiver: string; person: string; status: string; creatable: string; preparation: string }
const paths = { pending: '/fcs/craft/printing/pending-handover', documents: '/fcs/craft/printing/handover-documents' }
const prefixes = { pending: 'printing-pending-handover', documents: 'printing-handover-documents' }
const makeState = (): ListState => ({ currentPage: 1, sort: null, preferences: { order: [], visibleKeys: [], frozenKeys: ['order'], pageSize: 10 }, preferencesLoaded: false, showColumnSettings: false, keyword: '', factory: '', receiver: '', person: '', status: '', creatable: '', preparation: '' })
const states = { pending: makeState(), documents: makeState() }
const selected = new Set<string>()
const rollPages = new Map<string, number>()
let mode: Mode = 'pending'
let activeId = ''
let detailPage = 1
let feedback = ''
let preview: { groups: PrintingDispatchGroup[]; mergeId?: string } | null = null
let eventsInstalled = false
const quantity = (value: number) => value.toLocaleString('zh-CN', { maximumFractionDigits: 2 })
const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100
const keyOf = (orderId: string, rollId: string) => `${orderId}|${rollId}`
const button = (label: string, action: string, id = '', disabled = false) => `<button type="button" class="min-h-8 rounded-md border px-2.5 py-1.5 text-xs hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45" data-printing-dispatch="${action}" data-id="${e(id)}" data-skip-page-rerender="true" ${disabled ? 'disabled' : ''}>${e(label)}</button>`
const badge = (text: string, ready = false) => `<span class="inline-flex rounded-full px-2 py-0.5 text-xs ${ready ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}">${e(text)}</span>`
const targetKey = (order: Order) => JSON.stringify([order.receivingTargetId, order.receivingTargetWarehouseName])
const unitText = (items: Array<{ qty: number; unit: string }>) => {
  const units = new Map<string, number>()
  items.forEach(({ qty, unit }) => units.set(unit, round((units.get(unit) || 0) + qty)))
  return [...units].map(([unit, qty]) => `${quantity(qty)} ${unit}`).join(' / ') || '0'
}

export function getPrintingDispatchLines(doc: PrintingDispatchDocument): DispatchLine[] {
  const seen = new Set<string>()
  return doc.lines.flatMap(line => {
    const order = getPrintingWorkOrderById(line.workOrderId)
    if (!order) return []
    return line.barcodeIds.flatMap(id => {
      // Completed and void documents retain their own physical roll snapshot.
      const current = order.barcodes.find(roll => roll.id === id)
      const saved = line.rolls?.find(roll => roll.id === id)
      const roll = doc.status === '草稿' ? current || saved : saved || current
      const key = keyOf(line.workOrderId, id)
      if (!roll || seen.has(key)) return []
      seen.add(key)
      return [{ order, roll: { ...roll, handoverRecordId: roll.handoverRecordId || current?.handoverRecordId } }]
    })
  })
}

function allDocuments(): PrintingDispatchDocument[] {
  const documents = listPrintingDispatchDocuments()
  const represented = new Set(documents.filter(doc => doc.status !== '已作废').flatMap(doc => doc.lines.flatMap(line => line.barcodeIds.map(id => keyOf(line.workOrderId, id)))))
  const historical = new Map<string, PrintingDispatchDocument>()
  listPrintingWorkOrders().forEach(order => {
    order.barcodes.filter(roll => roll.handoverRecordId && !represented.has(keyOf(order.workOrderId, roll.id))).forEach(roll => {
      const id = order.handover.handoverNo || `历史-${roll.handoverRecordId}`
      const doc = historical.get(id) || { id, status: '已交出' as const, createdAt: '', createdBy: '历史记录', handedOverAt: order.handover.handedOverAt, handedOverBy: '历史记录', lines: [] }
      let line = doc.lines.find(item => item.workOrderId === order.workOrderId)
      if (!line) { line = { workOrderId: order.workOrderId, barcodeIds: [], rolls: [] }; doc.lines.push(line) }
      line.barcodeIds.push(roll.id); line.rolls!.push(roll)
      historical.set(id, doc)
    })
  })
  return [...documents, ...historical.values()]
}

export function printingDispatchProgress(doc: PrintingDispatchDocument): string {
  if (doc.status !== '草稿') return doc.status === '已交出' ? '已实际交出' : '已作废'
  const keys = new Set(doc.lines.flatMap(line => line.barcodeIds.map(id => keyOf(line.workOrderId, id))))
  const scans = new Set((doc.scans || []).map(scan => keyOf(scan.workOrderId, scan.barcodeId)).filter(key => keys.has(key)))
  if (keys.size > 0 && scans.size === keys.size && doc.scanCompletedAt) return '工厂扫齐待交接'
  return scans.size ? '扫卷中' : '已建单待扫卷'
}

export function getPrintingPendingDispatchRows(): PrintingPendingDispatchRow[] {
  const docs = allDocuments().filter(doc => doc.status !== '已作废')
  return listPrintingWorkOrders().filter(order => order.output.completedQty > 0 || order.barcodes.length > 0).map(order => {
    const related = docs.filter(doc => doc.lines.some(line => line.workOrderId === order.workOrderId))
    const reserved = new Set(related.filter(doc => doc.status === '草稿').flatMap(doc => doc.lines.filter(line => line.workOrderId === order.workOrderId).flatMap(line => line.barcodeIds)))
    const rolls = order.barcodes.filter(roll => !roll.handoverRecordId && roll.status !== '已交出' && roll.status !== '已入库' && !reserved.has(roll.id))
    const reservedQty = round(order.barcodes.filter(roll => reserved.has(roll.id)).reduce((sum, roll) => sum + roll.lengthY, 0))
    const availableQty = round(Math.max(order.output.completedQty - order.handover.handedOverQty - reservedQty, 0))
    const validRolls = rolls.filter(roll => isPrintablePrintingRoll(order, roll))
    const reason = order.processingStatus === 'CANCELLED' || order.manuallyCompletedAt ? '加工单已结束' : order.output.completedQty <= 0 ? '尚未形成合格产出，可先维护卷码' : !order.printFactoryId ? '请先确定加工厂' : !order.receivingTargetId || !order.receivingTargetName || !order.receivingTargetWarehouseName ? '请先补齐下游组织与目标仓库' : availableQty <= 0 ? reservedQty > 0 ? '在厂产出已占用，请查看已有草稿' : '产出已实际交出' : !validRolls.length ? '请维护实际卷码及数量' : ''
    const docStatus = order.handover.handedOverQty >= order.output.completedQty && order.output.completedQty > 0 ? '已全部交出' : related.length ? availableQty > 0 ? '部分已建单' : '可用产出已建单' : '未建单'
    return { order, rolls, reservedQty, documentIds: related.map(doc => doc.id), availableQty, reason, docStatus }
  })
}

export interface PrintingDispatchGroup { key: string; factory: string; receiver: string; warehouse: string; unit: string; lines: Array<{ workOrderId: string; barcodeIds: string[] }>; rollCount: number; qty: number }
export function groupPrintingDispatchSelection(values: Iterable<string>): PrintingDispatchGroup[] {
  const rows = getPrintingPendingDispatchRows()
  const groups = new Map<string, PrintingDispatchGroup>()
  for (const value of new Set(values)) {
    const [orderId, rollId] = value.split('|')
    const row = rows.find(item => item.order.workOrderId === orderId)
    const roll = row?.rolls.find(item => item.id === rollId)
    if (!row || !roll || row.reason || !isPrintablePrintingRoll(row.order, roll)) throw new Error('所选产出已变化或不可建单，请重新选择')
    const order = row.order
    const key = JSON.stringify([order.printFactoryId, order.receivingTargetId, order.receivingTargetName, order.receivingTargetWarehouseName, order.output.qtyUnit])
    const group = groups.get(key) || { key, factory: order.printFactoryName, receiver: order.receivingTargetName, warehouse: order.receivingTargetWarehouseName, unit: order.output.qtyUnit, lines: [], rollCount: 0, qty: 0 }
    let line = group.lines.find(item => item.workOrderId === orderId)
    if (!line) { line = { workOrderId: orderId, barcodeIds: [] }; group.lines.push(line) }
    line.barcodeIds.push(rollId); group.rollCount += 1; group.qty = round(group.qty + roll.lengthY)
    groups.set(key, group)
  }
  if (!groups.size) throw new Error('请先勾选本次要交出的具体卷码')
  return [...groups.values()]
}

function matches(order: Order, state: ListState): boolean {
  const text = [order.printOrderNo, order.taskNo, order.product.spu, order.product.productName, ...Object.values(order.demandSource), order.output.sku, order.output.materialName].join(' ').toLowerCase()
  return (!state.factory || order.printFactoryId === state.factory) && (!state.receiver || targetKey(order) === state.receiver) && (!state.person || order.handover.receivedBy === state.person) && (!state.keyword || text.includes(state.keyword.toLowerCase()))
}
function filteredPendingRows() {
  const state = states.pending
  return getPrintingPendingDispatchRows().filter(row => matches(row.order, state) && (state.status ? row.docStatus === state.status : row.docStatus !== '已全部交出') && (!state.creatable || (state.creatable === '可创建' ? !row.reason : !!row.reason)) && (!state.preparation || (state.preparation === '待维护' ? row.rolls.some(roll => !isPrintablePrintingRoll(row.order, roll)) || !row.rolls.length : state.preparation === '已打印' ? row.rolls.some(roll => roll.status === '已打印') : row.rolls.some(roll => isPrintablePrintingRoll(row.order, roll)))))
}
function filteredDocuments() {
  const state = states.documents
  return allDocuments().filter(doc => (!state.status || printingDispatchProgress(doc) === state.status) && (!doc.lines.length ? !state.factory && !state.receiver && !state.person && (!state.keyword || doc.id.toLowerCase().includes(state.keyword.toLowerCase())) : doc.lines.some(line => {
    const order = getPrintingWorkOrderById(line.workOrderId)
    return !!order && matches(order, { ...state, keyword: doc.id.toLowerCase().includes(state.keyword.toLowerCase()) ? '' : state.keyword })
  })))
}
function orderBlock(order: Order): string {
  const source = order.demandSource
  const product = source.type === 'STOCK' ? `<div class="flex items-center gap-2">${renderPrintingBusinessImage(order.output, 'h-10 w-10')}<div><p>${e(order.output.materialName)}</p><p class="text-slate-500">备货物料</p></div></div>` : `<div class="flex items-center gap-2">${renderPrintingBusinessImage(order.product, 'h-10 w-10')}<div><p>${e(order.product.productName)}</p><p class="text-slate-500">${e(order.product.spu)}</p></div></div>`
  return `<div class="space-y-2 text-xs"><p class="text-slate-500">${e(order.printFactoryName)}</p><a class="font-semibold text-blue-700" data-nav="/fcs/craft/printing/work-orders/${e(order.workOrderId)}" href="/fcs/craft/printing/work-orders/${e(order.workOrderId)}">${e(order.printOrderNo)}</a><p>任务单：${e(order.taskNo)}</p><div class="rounded bg-blue-50 px-2 py-1 text-blue-800">需求来源：${e(source.sourceLabel || source.sourceNo)}<br>${e(source.demandNo || source.stockPlanNo || source.supplementOrderNo || source.sourceNo)}</div>${source.productionOrderNo || source.originalProductionOrderNo ? `<p>生产单：${e(source.productionOrderNo || source.originalProductionOrderNo || '')}</p>` : ''}<div class="border-t pt-2">${product}</div></div>`
}
function outputBlock(order: Order): string {
  return `<div class="flex gap-2 text-xs">${renderPrintingBusinessImage(order.output, 'h-10 w-10')}<div class="min-w-0 space-y-1"><p class="font-medium">${e(order.output.materialName)}</p><p class="break-all text-slate-500">${e(printingMaterialCode(order.output.sku, true))}</p><p>${e(order.output.objectType)} · ${e(order.output.qtyUnit)}</p><p>花型：${e(order.requirement.frontPattern.patternNo || '待补齐')}</p></div></div>`
}
function targetBlock(order: Order): string {
  return `<div class="space-y-1 text-xs"><p class="font-medium">${e(order.receivingTargetName || '接收组织待确定')}</p><p class="break-all text-slate-500">${e(order.receivingTargetId || '组织编号待补齐')}</p><p>目标仓库：${e(order.receivingTargetWarehouseName || '待确定')}</p><p>接收人：${e(order.handover.receivedBy || '待确定')}</p></div>`
}
function rollChoice(row: PrintingPendingDispatchRow): string {
  const totalPages = Math.max(1, Math.ceil(row.rolls.length / 15))
  const currentPage = Math.min(rollPages.get(row.order.workOrderId) || 1, totalPages)
  const rolls = row.rolls.slice((currentPage - 1) * 15, currentPage * 15)
  return `<div class="space-y-1 text-xs">${row.reason ? `<p class="text-amber-800">${e(row.reason)}</p>` : badge('资料齐备，可选择建单', true)}<div class="max-h-36 space-y-1 overflow-y-auto" aria-label="${e(row.order.printOrderNo)} 产出卷选择">${rolls.map(roll => {
    const key = keyOf(row.order.workOrderId, roll.id)
    const disabled = !!row.reason || !isPrintablePrintingRoll(row.order, roll)
    return `<label class="flex items-start gap-1.5 rounded py-1 hover:bg-slate-50"><input class="mt-0.5" type="checkbox" data-dispatch-roll value="${e(key)}" aria-label="选择卷 ${e(roll.barcode)}" ${selected.has(key) ? 'checked' : ''} ${disabled ? 'disabled' : ''}><span>${e(roll.rollNo)} · ${quantity(roll.lengthY)} ${e(row.order.output.qtyUnit)}<span class="block break-all text-slate-500">${e(roll.barcode)} · ${e(roll.status)}</span></span></label>`
  }).join('') || '<p class="text-slate-500">尚无未占用的卷码</p>'}</div>${totalPages > 1 ? `<div class="flex items-center gap-1 border-t pt-1">${button('上批', 'roll-prev', row.order.workOrderId, currentPage <= 1)}<span>${currentPage}/${totalPages} · 每批15卷</span>${button('下批', 'roll-next', row.order.workOrderId, currentPage >= totalPages)}</div>` : ''}</div>`
}
const pendingColumns: StandardListColumn<PrintingPendingDispatchRow>[] = [
  { key: 'order', title: '加工单／需求／商品', width: 230, required: true, freezeable: true, sortable: true, sortValue: row => row.order.printOrderNo, render: row => orderBlock(row.order) },
  { key: 'output', title: '产出物料', width: 230, required: true, freezeable: true, sortable: true, sortValue: row => row.order.output.sku, render: row => outputBlock(row.order) },
  { key: 'target', title: '下游', width: 200, required: true, freezeable: true, sortable: true, sortValue: row => row.order.receivingTargetName, render: row => targetBlock(row.order) },
  { key: 'quantity', title: '数量', width: 190, freezeable: true, sortable: true, sortValue: row => row.availableQty, render: row => `<div class="space-y-1 text-xs tabular-nums"><p>实际使用：${quantity(row.order.actualInput.usedQty)} ${e(row.order.plannedInput.qtyUnit)}</p><p>合格完成：${quantity(row.order.output.completedQty)} ${e(row.order.output.qtyUnit)}</p><div class="border-t pt-1"><p>在厂产出：${quantity(Math.max(row.order.output.completedQty - row.order.handover.handedOverQty, 0))} ${e(row.order.output.qtyUnit)}</p><p>草稿占用：${quantity(row.reservedQty)} ${e(row.order.output.qtyUnit)}</p><p class="font-medium text-blue-700">未占用产出：${quantity(row.availableQty)} ${e(row.order.output.qtyUnit)}</p><p>未占用卷码：${row.rolls.length} 卷</p></div></div>` },
  { key: 'status', title: '生产与建单状态', width: 150, freezeable: true, sortable: true, sortValue: row => row.docStatus, render: row => `<div class="space-y-2 text-xs">${badge(row.order.processingStatus === 'PROCESS_COMPLETED' ? '全部加工完成' : row.order.output.completedQty > 0 ? '已完成部分批次' : '尚未形成产出')}<div>${badge(row.docStatus, row.docStatus === '已全部交出')}</div>${row.documentIds.map(id => `<div>${button(id, 'detail', id)}</div>`).join('')}</div>` },
  { key: 'rolls', title: '卷码准备／选择', width: 245, required: true, render: rollChoice },
  { key: 'actions', title: '操作', width: 128, required: true, actionColumn: true, render: row => `<div class="grid gap-1">${button('维护／打印条码', 'barcodes', row.order.workOrderId)}${button('选择可建单卷', 'select-order', row.order.workOrderId, !!row.reason)}${button('查看交出记录', 'order-documents', row.order.workOrderId, !row.documentIds.length)}</div>` },
]

export function getPrintingDispatchReceiptSummary(doc: PrintingDispatchDocument) {
  const lines = getPrintingDispatchLines(doc)
  const recordIds = [...new Set(lines.map(({ roll }) => roll.handoverRecordId).filter((id): id is string => !!id))]
  const records = recordIds.map(id => findPdaHandoverRecord(id)).filter(record => !!record && record.handoverRecordStatus !== 'VOIDED')
  const received = records.map(record => ({ qty: record!.receiverWrittenQty ?? record!.warehouseWrittenQty ?? 0, unit: record!.qtyUnit || '' }))
  const pending = records.map(record => ({ qty: record!.factoryDiffDecision === 'ACCEPT_DIFF' || record!.objectionStatus === 'RESOLVED' ? 0 : Math.max((record!.submittedQty ?? record!.plannedQty ?? 0) - (record!.receiverWrittenQty ?? record!.warehouseWrittenQty ?? 0), 0), unit: record!.qtyUnit || '' }))
  const lastReceivedAt = records.map(record => record!.receiverWrittenAt || record!.warehouseWrittenAt || '').filter(Boolean).sort().at(-1) || ''
  return { records, received, pending, lastReceivedAt, unknown: doc.status === '已交出' && (!records.length || records.length !== recordIds.length) }
}
function totals(doc: PrintingDispatchDocument): string {
  const lines = getPrintingDispatchLines(doc)
  return `${lines.length} 卷 · ${e(unitText(lines.map(({ order, roll }) => ({ qty: roll.lengthY, unit: order.output.qtyUnit }))))} · ${new Set(lines.map(({ roll }) => roll.sku)).size} 个 SKU · ${new Set(lines.map(({ order }) => order.workOrderId)).size} 张加工单`
}
const documentColumns: StandardListColumn<PrintingDispatchDocument>[] = [
  { key: 'order', title: '交出单编号', width: 215, required: true, freezeable: true, sortable: true, sortValue: doc => doc.id, render: doc => `<div class="space-y-2 text-xs"><button type="button" class="font-semibold text-blue-700" data-printing-dispatch="detail" data-id="${e(doc.id)}">${e(doc.id)}</button><p>创建人：${e(doc.createdBy)}</p><p>创建时间：${e(doc.createdAt || '历史时间未记录')}</p></div>` },
  { key: 'related', title: '加工单／接收方', width: 245, required: true, freezeable: true, sortable: true, sortValue: doc => getPrintingDispatchLines(doc)[0]?.order.printOrderNo || '', render: doc => {
    const orders = doc.lines.map(line => getPrintingWorkOrderById(line.workOrderId)).filter((order): order is Order => !!order)
    return `<div class="space-y-2 text-xs"><p>${e(orders[0]?.printFactoryName || '历史加工厂未补齐')}</p>${orders.slice(0, 3).map(order => `<p><a data-nav="/fcs/craft/printing/work-orders/${e(order.workOrderId)}" href="/fcs/craft/printing/work-orders/${e(order.workOrderId)}" class="text-blue-700">${e(order.printOrderNo)}</a><span class="block text-slate-500">${e(order.taskNo)}</span></p>`).join('')}${orders.length > 3 ? `<p>共 ${orders.length} 张加工单，详情查看全部</p>` : ''}<div class="border-t pt-2">${orders[0] ? targetBlock(orders[0]) : '历史去向未补齐'}</div></div>`
  } },
  { key: 'quantity', title: '卷数／数量／SKU', width: 210, freezeable: true, sortable: true, sortValue: doc => getPrintingDispatchLines(doc).length, render: doc => `<p class="text-xs leading-6">${totals(doc)}</p>` },
  { key: 'scan', title: '扫卷与交出', width: 190, required: true, freezeable: true, sortable: true, sortValue: printingDispatchProgress, render: doc => `<div class="space-y-2 text-xs">${badge(printingDispatchProgress(doc), doc.status === '已交出')}<p>工厂已核对：${(doc.scans || []).length} / ${getPrintingDispatchLines(doc).length} 卷</p><p>扫齐时间：${e(doc.scanCompletedAt || '尚未扫齐')}</p><div class="border-t pt-2"><p>实际交出：${e(doc.handedOverAt || '尚未交出')}</p><p>交出人：${e(doc.handedOverBy || '尚未交出')}</p></div></div>` },
  { key: 'receipt', title: '下游实收', width: 200, freezeable: true, render: doc => {
    if (doc.status !== '已交出') return '<p class="text-xs text-slate-500">尚未实际交出</p>'
    const summary = getPrintingDispatchReceiptSummary(doc)
    return `<div class="space-y-1 text-xs"><p>实收：${summary.unknown ? '历史关联待补齐' : e(unitText(summary.received))}</p><p>待接收：${summary.unknown ? '待核对' : e(unitText(summary.pending))}</p><p>最近实收：${e(summary.lastReceivedAt || '尚未接收')}</p></div>`
  } },
  { key: 'actions', title: '操作', width: 120, required: true, actionColumn: true, render: doc => `<div class="grid gap-1">${button('详情', 'detail', doc.id)}${button('打印预览', 'print', doc.id)}</div>` },
]
function controller<Row>(next: Mode, columns: StandardListColumn<Row>[], getRows: () => Row[]) {
  return createProcessOrderListController({ state: states[next], columns, preferenceKey: `${paths[next]}:v1`, eventPrefix: prefixes[next], rootSelector: `[data-printing-dispatch-root="${next}"]`, tableSurfaceSelector: '[data-dispatch-table]', paginationSurfaceSelector: '[data-dispatch-pagination]', overlaysSurfaceSelector: '[data-dispatch-columns]', defaultFrozenKeys: ['order'], pageSizeOptions: [10, 20, 50], columnSettingsTitle: `${next === 'pending' ? '待交出列表' : '交出单据'}列设置`, emptyText: next === 'pending' ? '暂无符合条件的产出记录' : '暂无符合条件的交出单据', locallyManagedEvents: true, getRows })
}
const controllers = { pending: controller('pending', pendingColumns, filteredPendingRows), documents: controller('documents', documentColumns, filteredDocuments) }
function factoryTabs() {
  const options = listPrintingFactoryOptions(listPrintingWorkOrders()).map(factory => [factory.id, factory.name])
  const counts = new Map<string, number>()
  if (mode === 'pending') getPrintingPendingDispatchRows().forEach(row => counts.set(row.order.printFactoryId, (counts.get(row.order.printFactoryId) || 0) + 1))
  else allDocuments().forEach(doc => { const factory = getPrintingDispatchLines(doc)[0]?.order.printFactoryId || ''; counts.set(factory, (counts.get(factory) || 0) + 1) })
  return `<div role="tablist" aria-label="加工厂切换" class="flex flex-wrap gap-1 border-b">${[['', '全部加工厂'], ...options].map(([id, name]) => `<button type="button" role="tab" aria-selected="${states[mode].factory === id}" data-printing-dispatch="factory" data-id="${e(id)}" class="min-h-10 rounded-t border px-4 py-2 text-sm ${states[mode].factory === id ? 'border-b-white border-t-2 border-t-blue-600 bg-white font-semibold text-blue-700' : 'bg-slate-50 text-slate-600'}">${e(name || '待分配')} ${id ? counts.get(id) || 0 : [...counts.values()].reduce((sum, count) => sum + count, 0)}</button>`).join('')}</div>`
}
function filters() {
  const state = states[mode]
  const orders = listPrintingWorkOrders()
  const targets = new Map(orders.map(order => [targetKey(order), `${order.receivingTargetName || '待确定'} · ${order.receivingTargetId || '编号待补齐'} · ${order.receivingTargetWarehouseName || '仓库待确定'}`]))
  const select = (name: keyof ListState, label: string, options: Array<[string, string]>) => `<label class="min-w-[135px] flex-1 text-xs text-slate-500">${e(label)}<select class="mt-1 block h-9 w-full rounded-md border bg-white px-2 text-sm text-slate-900" data-dispatch-filter="${name}"><option value="">${name === 'status' && mode === 'pending' ? '待处理' : '全部'}</option>${options.map(([value, text]) => `<option value="${e(value)}" ${state[name] === value ? 'selected' : ''}>${e(text)}</option>`).join('')}</select></label>`
  const choices = (items: string[]): Array<[string, string]> => items.map(item => [item, item])
  return `<div class="space-y-3 rounded-lg border bg-white p-3"><div class="flex flex-wrap items-end gap-3"><label class="min-w-[240px] flex-[2] text-xs text-slate-500">关键词<input class="mt-1 h-9 w-full rounded-md border px-3 text-sm text-slate-900" data-dispatch-filter="keyword" placeholder="交出单／加工单／任务／需求／生产单／SKU" value="${e(state.keyword)}"></label>${select('receiver', '下游组织／目标仓库', [...targets])}${select('person', '接收人', choices([...new Set(orders.map(order => order.handover.receivedBy || '').filter(Boolean))]))}${select('status', '单据状态', choices(mode === 'pending' ? ['未建单', '部分已建单', '可用产出已建单', '已全部交出'] : ['已建单待扫卷', '扫卷中', '工厂扫齐待交接', '已实际交出', '已作废']))}${mode === 'pending' ? select('creatable', '是否可创建', choices(['可创建', '暂不可创建'])) + select('preparation', '卷码准备', choices(['待维护', '资料齐备', '已打印'])) : ''}</div><div class="flex gap-2">${button('查询', 'search')}${button('重置', 'reset')}</div></div>`
}
function selectionActions() {
  return `<div class="flex flex-wrap items-center gap-2" data-dispatch-selection-actions>${button('全选本页可建单卷', 'select-page')}${button('清空', 'clear')}<span class="text-xs" data-dispatch-selected>已选 ${selected.size} 卷</span>${button('批量生成交出单', 'create')}${button('合入已有草稿', 'merge')}</div>`
}
function renderWorkspace() {
  const count = mode === 'pending' ? filteredPendingRows().length : filteredDocuments().length
  const view = controllers[mode].getView()
  return renderStandardListPage({ title: mode === 'pending' ? '印花待交出列表' : '印花交出单据', primaryActionsHtml: button(mode === 'pending' ? '交出单据' : '待交出列表', mode === 'pending' ? 'documents' : 'pending'), statusTabsHtml: factoryTabs(), filtersHtml: filters(), feedbackHtml: `<div data-dispatch-feedback role="status" class="text-sm text-blue-700">${e(feedback)}</div>`, statsHtml: renderStandardListStats(mode === 'pending' ? [{ label: '加工单数', value: count }, { label: '可创建加工单', value: filteredPendingRows().filter(row => !row.reason).length }, { label: '可建单数量', value: unitText(filteredPendingRows().filter(row=>!row.reason).map(row => ({ qty: row.rolls.filter(roll=>isPrintablePrintingRoll(row.order,roll)).reduce((sum,roll)=>sum+roll.lengthY,0), unit: row.order.output.qtyUnit }))) }] : [{ label: '交出单数', value: count }, { label: '待实际交出', value: filteredDocuments().filter(doc => doc.status === '草稿').length }, { label: '已实际交出', value: filteredDocuments().filter(doc => doc.status === '已交出').length }], { compact: true }), listTitle: `共 ${count} 条`, listActionsHtml: `<div class="flex flex-wrap items-center gap-2">${mode === 'pending' ? selectionActions() : ''}${renderSecondaryButton('列设置', { prefix: prefixes[mode], action: 'open-column-settings', skipPageRerender: true }, 'settings-2')}</div>`, tableHtml: `<div data-dispatch-table>${view.tableHtml}</div>`, paginationHtml: `<div data-dispatch-pagination>${view.paginationHtml}</div>`, overlaysHtml: `<div data-dispatch-columns>${controllers[mode].renderColumnSettings()}</div>` })
}

function documentHeader(doc: PrintingDispatchDocument) {
  const lines = getPrintingDispatchLines(doc)
  const order = lines[0]?.order
  const receipt = getPrintingDispatchReceiptSummary(doc)
  return `<div class="space-y-3"><div class="flex flex-wrap items-center gap-3"><h2 class="text-lg font-semibold">印花交出单 ${e(doc.id)}</h2>${badge(printingDispatchProgress(doc), doc.status === '已交出')}</div><p class="text-sm">${totals(doc)}</p><div class="grid gap-3 rounded-lg border bg-slate-50 p-3 text-xs sm:grid-cols-2"><div><p>交出工厂：${e(order?.printFactoryName || '历史资料待补齐')}</p><p>接收组织：${e(order?.receivingTargetName || '历史资料待补齐')}（${e(order?.receivingTargetId || '编号待补齐')}）</p><p>目标仓库：${e(order?.receivingTargetWarehouseName || '待补齐')}</p></div><div><p>创建：${e(doc.createdBy)} · ${e(doc.createdAt || '历史时间未记录')}</p><p>扫齐：${e(doc.scanCompletedAt || '尚未扫齐')}</p><p>实际交出：${e(doc.handedOverBy || '尚未交出')} · ${e(doc.handedOverAt || '尚未交出')}</p><p>下游最近实收：${e(receipt.lastReceivedAt || '尚未接收')}</p></div></div></div>`
}
function detail(doc: PrintingDispatchDocument): string {
  const lines = getPrintingDispatchLines(doc)
  const pageCount = Math.max(1, Math.ceil(lines.length / 15))
  detailPage = Math.min(Math.max(1, detailPage), pageCount)
  const rows = lines.slice((detailPage - 1) * 15, detailPage * 15)
  const receipt = getPrintingDispatchReceiptSummary(doc)
  const logs = [...new Map(lines.flatMap(({ order }) => order.operationLogs.filter(log => [doc.id, ...receipt.records.map(record => record?.handoverRecordId || record?.recordId || '').filter(Boolean)].some(id => log.remark.includes(id)))).map(log => [log.logId, log])).values()].sort((a, b) => b.operatedAt.localeCompare(a.operatedAt))
  return `<div class="space-y-4">${documentHeader(doc)}${doc.status === '草稿' ? `<div class="rounded-lg border border-blue-200 bg-blue-50 p-3"><p class="mb-2 text-sm font-medium">工厂扫码核对 · 已扫 ${(doc.scans || []).length} / ${lines.length} 卷</p><p class="mb-3 text-xs text-slate-600">核对产出卷码后登记实际交接。扫齐仅表示核对完成，物料仍在本厂。</p><div class="flex flex-wrap items-end gap-2"><label class="text-xs">核对／交出人<input class="mt-1 block h-9 rounded border bg-white px-2" data-dispatch-operator value="印花交出员"></label><label class="min-w-[200px] flex-1 text-xs">扫码或输入本单卷码<input class="mt-1 block h-9 w-full rounded border bg-white px-3" data-dispatch-scan placeholder="扫描后按回车" autocomplete="off"></label>${button('核对卷码', 'scan', doc.id)}${button('确认实际交出', 'confirm', doc.id, printingDispatchProgress(doc) !== '工厂扫齐待交接')}</div></div>` : `<p class="rounded bg-slate-50 p-3 text-sm">${doc.status === '已交出' ? '本单已实际交出，交出数量与卷明细只读。下游实收由接收方登记。' : '本单已作废，保留原明细用于追溯。'}</p>`}<div class="overflow-x-auto rounded border"><table class="w-full min-w-[1050px] text-left text-xs"><thead class="bg-slate-50"><tr>${['加工单／需求／商品', '产出物料', '卷号／条码', '数量', '重量（kg）', '扫卷记录', '操作'].map(label => `<th class="p-3">${label}</th>`).join('')}</tr></thead><tbody>${rows.map(({ order, roll }) => {
    const scan = (doc.scans || []).find(scan => scan.workOrderId === order.workOrderId && scan.barcodeId === roll.id)
    return `<tr class="border-t align-top"><td class="w-64 p-3">${orderBlock(order)}</td><td class="w-56 p-3">${outputBlock(order)}</td><td class="p-3"><p>${e(roll.rollNo)}</p><p class="break-all">${e(roll.barcode)}</p><p class="text-slate-500">${e(roll.warehouseName || '库位未记录')}</p></td><td class="p-3">${quantity(roll.lengthY)} ${e(order.output.qtyUnit)}</td><td class="p-3">${Number.isFinite(roll.weightKg) ? roll.weightKg.toFixed(3) : '未记录'} ${roll.weightSource==='ACTUAL'?'实称':'理论'}</td><td class="p-3">${scan ? `${e(scan.scannedBy)}<br>${e(scan.scannedAt)}` : doc.status === '草稿' ? '待核对' : '未记录'}</td><td class="p-3">${doc.status === '草稿' ? button('移除此卷', 'remove-roll', keyOf(order.workOrderId, roll.id)) : '只读'}</td></tr>`
  }).join('') || '<tr><td colspan="7" class="p-4">本单无当前卷明细</td></tr>'}</tbody></table></div><div class="flex items-center justify-between text-sm"><span>共 ${lines.length} 卷 · 每页 15 卷 · 第 ${detailPage}/${pageCount} 页</span><div class="flex gap-2">${button('上一页', 'detail-prev', '', detailPage <= 1)}${button('下一页', 'detail-next', '', detailPage >= pageCount)}</div></div><section class="space-y-2 border-t pt-3"><h3 class="font-semibold">下游实收记录</h3>${doc.status !== '已交出' ? '<p class="text-sm text-slate-500">尚未实际交出，不生成下游实收。</p>' : receipt.unknown ? '<p class="text-sm text-amber-800">历史实收关联尚未补齐，不能用整张加工单累计实收代替本单实收。</p>' : `<p class="text-sm">本单实收 ${e(unitText(receipt.received))} · 待接收 ${e(unitText(receipt.pending))}</p><div class="max-h-48 overflow-auto">${receipt.records.map(record => `<div class="border-t py-2 text-xs"><p>${e(record!.handoverRecordNo || record!.recordId)} · ${e(record!.receiverWrittenBy || '接收人尚未登记')}</p><p>应收 ${quantity(record!.submittedQty ?? record!.plannedQty ?? 0)} ${e(record!.qtyUnit || '')} · 实收 ${quantity(record!.receiverWrittenQty ?? record!.warehouseWrittenQty ?? 0)} ${e(record!.qtyUnit || '')} · 差异 ${record!.receiverWrittenAt || record!.warehouseWrittenAt ? `${(record!.receiverWrittenQty ?? record!.warehouseWrittenQty ?? 0) < (record!.submittedQty ?? record!.plannedQty ?? 0) ? '少' : (record!.receiverWrittenQty ?? record!.warehouseWrittenQty ?? 0) > (record!.submittedQty ?? record!.plannedQty ?? 0) ? '多' : '一致 '}${quantity(Math.abs((record!.receiverWrittenQty ?? record!.warehouseWrittenQty ?? 0) - (record!.submittedQty ?? record!.plannedQty ?? 0)))} ${e(record!.qtyUnit || '')}` : '尚未核对'}</p><p>${e(record!.receiverWrittenAt || record!.warehouseWrittenAt || '尚未接收')}</p>${record!.diffReason || record!.receiverRemark ? `<p>说明：${e(record!.diffReason || record!.receiverRemark || '')}</p>` : ''}<details class="mt-2 rounded border p-2" data-downstream-receipt="${e(record!.handoverRecordId||record!.recordId)}"><summary class="cursor-pointer text-blue-700">下游接收人登记实收</summary><p class="my-2">由接收方核对本次交出记录；填写该记录累计实收，本厂库存不再扣减。</p><div class="flex flex-wrap gap-2"><label>累计实收（${e(record!.qtyUnit||'')}）<input aria-label="下游累计实收" type="number" min="0" step="0.001" class="block h-9 w-32 rounded border px-2" data-downstream-qty></label><label>接收人<input aria-label="下游接收人" class="block h-9 rounded border px-2" data-downstream-person value="${e(record!.receiverWrittenBy||'')}"></label><label>差异／补收说明<input aria-label="下游差异说明" class="block h-9 rounded border px-2" data-downstream-reason></label>${button('保存本记录实收','receive-record',record!.handoverRecordId||record!.recordId)}</div></details></div>`).join('')}</div>`}</section><details class="border-t pt-3"><summary class="cursor-pointer text-sm font-semibold">操作记录（${logs.length}）</summary><div class="max-h-56 space-y-2 overflow-auto pt-2">${logs.map(log => `<p class="text-xs">${e(log.operatedAt)} · ${e(log.operatorName)} · ${e(log.action)}<br>${e(log.remark)}</p>`).join('') || '<p class="text-xs text-slate-500">历史日志未记录</p>'}</div></details><div class="flex flex-wrap justify-end gap-2 border-t pt-3">${button('打印预览', 'print', doc.id)}${doc.status === '草稿' ? button('作废整张交出单', 'void', doc.id) : ''}${button('关闭详情', 'back')}</div></div>`
}
function overlayShell(title: string, content: string, action: string): string {
  return `<div class="fixed inset-0 z-[112] flex items-center justify-center p-3" role="dialog" aria-modal="true" aria-label="${e(title)}" data-dispatch-overlay><button type="button" class="absolute inset-0 bg-slate-950/50" aria-label="关闭${e(title)}" data-printing-dispatch="${action}"></button><section class="relative flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl bg-white shadow-xl"><header class="flex items-center justify-between border-b px-4 py-3"><h2 class="font-semibold">${e(title)}</h2>${button('关闭', action)}</header><div data-dispatch-overlay-feedback role="alert" class="px-4 pt-2 text-sm text-red-700"></div><div class="overflow-auto p-4">${content}</div></section></div>`
}
function renderPreview(): string {
  if (!preview) return ''
  const first = preview.groups[0]
  const eligible = preview.groups.length === 1 ? listPrintingDispatchDocuments().filter(doc => doc.status === '草稿' && getPrintingDispatchLines(doc).some(({ order }) => JSON.stringify([order.printFactoryId, order.receivingTargetId, order.receivingTargetName, order.receivingTargetWarehouseName, order.output.qtyUnit]) === first.key)) : []
  return overlayShell(preview.mergeId !== undefined ? '合入草稿预览' : '批量建单预览', `<div class="space-y-3"><p class="text-sm">按加工厂、下游组织、目标仓库和单位分为 ${preview.groups.length} 组。每组生成一张草稿，仅占用所选产出。</p>${preview.groups.map((group, index) => `<section class="rounded-lg border p-3 text-sm"><h3 class="font-semibold">第 ${index + 1} 组 · ${e(group.factory)} → ${e(group.receiver)}</h3><p class="mt-1">目标仓库：${e(group.warehouse)}</p><p>${group.lines.length} 张加工单 · ${group.rollCount} 卷 · ${quantity(group.qty)} ${e(group.unit)}</p><p class="mt-2 text-xs text-slate-600">${group.lines.map(line => e(getPrintingWorkOrderById(line.workOrderId)?.printOrderNo || line.workOrderId)).join('、')}</p></section>`).join('')}${preview.mergeId !== undefined ? `<label class="block text-sm">选择同去向的已有草稿<select aria-label="合入已有草稿" class="mt-1 h-9 w-full rounded border px-2" data-dispatch-merge><option value="">请选择</option>${eligible.map(doc => `<option value="${e(doc.id)}">${e(doc.id)} · ${getPrintingDispatchLines(doc).length} 卷 · ${e(printingDispatchProgress(doc))}</option>`).join('')}</select></label>${eligible.length ? '<p class="text-xs text-amber-800">新增卷需要重新核对；原卷有效扫码记录保留。</p>' : '<p class="text-sm text-amber-800">没有范围一致的可编辑草稿，请新建交出单。</p>'}` : ''}<label class="block text-sm">建单人<input class="mt-1 h-9 w-full rounded border px-2" data-dispatch-creator value="印花交出员"></label><div class="flex justify-end gap-2">${button('返回选择', 'cancel-preview')}${button(preview.mergeId !== undefined ? '确认合入草稿' : `确认生成 ${preview.groups.length} 张草稿`, 'commit-preview', '', preview.mergeId !== undefined && !eligible.length)}</div></div>`, 'cancel-preview')
}
function refreshOverlay() {
  const root = document.querySelector('[data-printing-dispatch-root]')
  const surface = root?.querySelector<HTMLElement>('[data-dispatch-overlay-surface]')
  if (!surface) return
  if (preview) surface.innerHTML = renderPreview()
  else { const doc = activeId ? allDocuments().find(item => item.id === activeId) : undefined; surface.innerHTML = doc ? overlayShell('印花交出单详情', detail(doc), 'back') : '' }
  hydrateIcons(surface)
}
function refresh() {
  const root = document.querySelector('[data-printing-dispatch-root]')
  const workspace = root?.querySelector<HTMLElement>('[data-printing-dispatch-workspace]')
  if (!workspace) return
  const scroll = workspace.querySelector<HTMLElement>('[data-standard-list-scroll]')?.scrollLeft || 0
  workspace.innerHTML = renderWorkspace()
  const next = workspace.querySelector<HTMLElement>('[data-standard-list-scroll]')
  if (next) next.scrollLeft = scroll
  hydrateIcons(workspace)
  refreshOverlay()
}
export function refreshPrintingDispatchPage(): void { if (typeof document !== 'undefined') refresh() }
function installEvents() {
  if (eventsInstalled || typeof document === 'undefined') return
  eventsInstalled = true
  document.addEventListener('keydown', event => {
    if (!(event.target instanceof HTMLElement) || !document.querySelector('[data-printing-dispatch-root]')) return
    if (event.key === 'Enter' && event.target.matches('[data-dispatch-scan]')) { event.preventDefault(); const scan = document.querySelector<HTMLElement>('[data-printing-dispatch="scan"]'); if (scan) handlePrintingDispatchEvent(scan) }
    if (event.key === 'Escape' && !document.querySelector('[data-printing-image-preview], [data-printing-dialog-panel]')) {
      event.stopPropagation()
      const print = document.querySelector('[data-dispatch-print-preview]')
      if (print) { print.remove(); return }
      preview = null; activeId = ''; refreshOverlay()
    }
  }, true)
}
function renderPage(next: Mode): string {
  mode = next
  const rootExists = typeof document !== 'undefined' && !!document.querySelector(`[data-printing-dispatch-root="${next}"]`)
  if (!rootExists) { rollPages.clear(); states[next].currentPage = 1; states[next].sort = null; states[next].showColumnSettings = false; selected.clear(); preview = null; activeId = ''; feedback = '' }
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search)
    if (params.has('workOrderId')) {
      const order = getPrintingWorkOrderById(params.get('workOrderId') || '')
      if (order) { states[next].keyword = order.printOrderNo; states[next].factory = ''; states[next].receiver = ''; states[next].person = ''; states[next].status = '' }
    }
    if (params.has('documentId')) activeId = params.get('documentId') || ''
  }
  controllers[next].installColumnDragEvents(); installEvents()
  const doc = activeId ? allDocuments().find(item => item.id === activeId) : undefined
  return `<div data-printing-dispatch-root="${next}" data-skip-page-rerender="true"><div data-printing-dispatch-workspace>${renderWorkspace()}</div><div data-dispatch-overlay-surface>${doc ? overlayShell('印花交出单详情', detail(doc), 'back') : ''}</div><div data-printing-dialog-surface>${renderPrintingDialog()}</div></div>`
}
export function renderPrintingPendingHandoverPage(): string { return renderPage('pending') }
export function renderPrintingHandoverDocumentsPage(): string { return renderPage('documents') }
export function openPrintingDispatch(next: Mode): void { appStore.navigate(paths[next]) }

export function renderPrintingDispatchPrintDocument(doc: PrintingDispatchDocument): string {
  const lines = getPrintingDispatchLines(doc)
  const image = (identity: { imageUrl: string; imageAlt: string }) => identity.imageUrl ? `<img src="${e(identity.imageUrl)}" alt="${e(identity.imageAlt)}">` : '<span class="missing">缺少对应图片</span>'
  const header = getPrintingDispatchLines(doc)[0]?.order
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>印花交出单 ${e(doc.id)}</title><style>@page{size:A4 landscape;margin:12mm}*{box-sizing:border-box}body{font:11px/1.5 sans-serif;color:#172033;margin:0}h1{font-size:20px;margin:0 0 8px}.meta{display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-bottom:12px}table{border-collapse:collapse;width:100%;table-layout:fixed}th,td{border:1px solid #aab1bb;padding:6px;text-align:left;vertical-align:top;overflow-wrap:anywhere}thead{display:table-header-group}tr{break-inside:avoid}img{width:38px;height:38px;object-fit:contain;float:left;margin-right:5px}.muted{color:#657082}.missing{color:#9a3412}.source{color:#174c9a}.signatures{margin-top:18px;break-inside:avoid}.notice{margin:10px 0;color:#92400e}</style></head><body><h1>印花交出单 ${e(doc.id)}</h1><div class="meta"><div>加工厂：${e(header?.printFactoryName || '历史资料待补齐')}</div><div>接收组织：${e(header?.receivingTargetName || '待补齐')}（${e(header?.receivingTargetId || '编号待补齐')}）</div><div>目标仓库：${e(header?.receivingTargetWarehouseName || '待补齐')}</div><div>接收人：${e(header?.handover.receivedBy || '待确定')}</div><div>创建：${e(doc.createdBy)} · ${e(doc.createdAt || '历史时间未记录')}</div><div>扫齐时间：${e(doc.scanCompletedAt || '尚未扫齐')}</div><div>状态：${e(printingDispatchProgress(doc))}</div><div>实际交出：${e(doc.handedOverBy || '尚未交出')} · ${e(doc.handedOverAt || '尚未交出')}</div></div><p>${totals(doc)} · 打印版本：${e(doc.id)} / ${e(doc.handedOverAt || doc.createdAt || '历史记录')} / ${lines.length} 卷</p>${doc.status !== '已交出' ? `<p class="notice">${doc.status === '已作废' ? '已作废，仅供追溯。' : '本单尚未实际交出，仅供备货与核对。'}</p>` : ''}<table><thead><tr><th style="width:25%">加工单／需求／商品</th><th style="width:25%">产出物料</th><th style="width:22%">卷号／条码</th><th style="width:14%">实际数量</th><th style="width:14%">重量（kg）</th></tr></thead><tbody>${lines.map(({ order, roll }) => `<tr><td><strong>${e(order.printOrderNo)}</strong><br>${e(order.taskNo)}<p class="source">需求来源：${e(order.demandSource.sourceLabel || order.demandSource.sourceNo)}<br>${e(order.demandSource.demandNo || order.demandSource.stockPlanNo || order.demandSource.sourceNo)}</p>${order.demandSource.productionOrderNo ? `<p>生产单：${e(order.demandSource.productionOrderNo)}</p>` : ''}${order.demandSource.type === 'STOCK' ? '备货物料' : `${image(order.product)}${e(order.product.productName)}<br>${e(order.product.spu)}`}</td><td>${image(order.output)}${e(order.output.materialName)}<br>${e(printingMaterialCode(roll.sku, true))}<p class="muted">${e(order.output.objectType)} · 花型 ${e(order.requirement.frontPattern.patternNo || '未记录')}</p></td><td>${e(roll.rollNo)}<br>${e(roll.barcode)}<p class="muted">${e(roll.warehouseName || '库位未记录')}</p></td><td>${quantity(roll.lengthY)} ${e(order.output.qtyUnit)}</td><td>${Number.isFinite(roll.weightKg) ? roll.weightKg.toFixed(3) : '未记录'} ${roll.weightSource==='ACTUAL'?'实称':'理论'}</td></tr>`).join('')}</tbody></table><p class="signatures">交出人签字：________________　接收人签字：________________　实物交接日期：________________</p></body></html>`
}
function printDoc(doc: PrintingDispatchDocument): void {
  document.querySelector('[data-dispatch-print-preview]')?.remove()
  const root = document.createElement('div')
  root.dataset.dispatchPrintPreview = 'true'
  root.className = 'fixed inset-0 z-[130] flex flex-col bg-slate-100 p-3'
  root.innerHTML = `<header class="mb-2 flex flex-wrap items-center justify-between gap-2"><h2 class="font-semibold">印花交出单打印预览 · A4 横向</h2><div class="flex gap-2">${button('打印', 'print-frame', doc.id)}${button('关闭预览', 'close-print')}</div></header><p class="mb-2 text-sm text-blue-700" data-dispatch-print-status role="status">正在准备图片与打印预览…</p><iframe title="印花交出单 A4 打印预览" class="min-h-0 w-full flex-1 rounded border bg-white" data-dispatch-print-frame></iframe>`
  const frame = root.querySelector<HTMLIFrameElement>('iframe')!
  frame.srcdoc = renderPrintingDispatchPrintDocument(doc)
  frame.onload = () => {
    const images = [...(frame.contentDocument?.images || [])]
    let timeout: ReturnType<typeof setTimeout> | undefined
    const loaded = Promise.all(images.map(image => image.complete ? Promise.resolve() : new Promise<void>(resolve => { image.onload = () => resolve(); image.onerror = () => resolve() })))
    const overdue = new Promise<void>(resolve => { timeout = setTimeout(resolve, 12000) })
    Promise.race([loaded, overdue]).then(() => {
      if (timeout) clearTimeout(timeout)
      const failed = images.filter(image => !image.naturalWidth)
      const missing = getPrintingDispatchLines(doc).filter(({ order }) => !order.output.imageUrl || (order.demandSource.type !== 'STOCK' && !order.product.imageUrl)).length
      const status = root.querySelector('[data-dispatch-print-status]')
      if (status) status.textContent = failed.length || missing ? `${failed.length + missing} 处图片缺失或加载失败，请检查素材后重新打开预览。` : '预览已就绪，请核对本单明细与分页。'
      failed.forEach(image => { const text = frame.contentDocument!.createElement('span'); text.textContent = `${image.alt}：图片加载失败`; text.className = 'missing'; image.replaceWith(text) })
      root.dataset.printReady = failed.length || missing ? 'false' : 'true'
    })
  }
  document.querySelector('[data-printing-dispatch-root]')?.appendChild(root)
}

function showError(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error)
  const node = document.querySelector('[data-dispatch-overlay-feedback]') || document.querySelector('[data-dispatch-feedback]')
  if (node) { node.textContent = message; node.classList.add('text-red-700') }
}
function showSelectionCount(): void {
  const node = document.querySelector('[data-dispatch-selected]')
  if (node) node.textContent = `已选 ${selected.size} 卷`
}
function handleListControls(target: HTMLElement): boolean {
  const prefix = prefixes[mode]
  const actionNode = target.closest<HTMLElement>(`[data-${prefix}-action]`)
  const field = target.closest<HTMLInputElement | HTMLSelectElement>(`[data-${prefix}-field]`)
  const ctrl = controllers[mode]
  if (field?.getAttribute(`data-${prefix}-field`) === 'pageSize') { ctrl.setPageSize(Number(field.value)); ctrl.refresh(); return true }
  if (!actionNode) return !!field
  const action = actionNode.getAttribute(`data-${prefix}-action`)
  if (action === 'prev-page' || action === 'next-page') { ctrl.stepPage(action === 'next-page' ? 1 : -1); ctrl.refresh(); return true }
  if (action === 'sort-column') { ctrl.cycleSort(actionNode.dataset.columnKey || ''); ctrl.refresh(); return true }
  if (action === 'open-column-settings' || action === 'close-column-settings') { states[mode].showColumnSettings = action === 'open-column-settings'; ctrl.refresh({ table: false, pagination: false, overlays: true }); return true }
  if (action === 'toggle-column-visibility' || action === 'toggle-column-freeze') {
    const key = actionNode.getAttribute(`data-${prefix}-column-key`) || actionNode.closest(`[data-${prefix}-column-key]`)?.getAttribute(`data-${prefix}-column-key`) || ''
    ctrl.updateColumnPreference(action, key, target instanceof HTMLInputElement ? target.checked : undefined); ctrl.refresh({ overlays: true }); return true
  }
  if (action === 'restore-column-settings') { ctrl.restorePreferences(); ctrl.refresh({ overlays: true }); return true }
  return false
}
export function handlePrintingDispatchEvent(target: HTMLElement): boolean {
  if (!target.closest('[data-printing-dispatch-root]')) return false
  if (target.matches('[data-dispatch-roll]')) {
    const input = target as HTMLInputElement
    if (!input.disabled) input.checked ? selected.add(input.value) : selected.delete(input.value)
    showSelectionCount(); return true
  }
  if (target.matches('[data-dispatch-filter], [data-dispatch-merge], [data-dispatch-scan], [data-dispatch-operator], [data-dispatch-creator]')) return true
  if (handleListControls(target)) return true
  const node = target.closest<HTMLElement>('[data-printing-dispatch]')
  if (!node) return false
  const action = node.dataset.printingDispatch, id = node.dataset.id || ''
  try {
    if (action === 'pending' || action === 'documents') { openPrintingDispatch(action); return true }
    if (action === 'close-print') { document.querySelector('[data-dispatch-print-preview]')?.remove(); return true }
    if (action === 'print-frame') {
      const root = document.querySelector<HTMLElement>('[data-dispatch-print-preview]')
      const status = root?.querySelector('[data-dispatch-print-status]')
      if (root?.dataset.printReady !== 'true') { if (status) status.textContent = '图片尚未全部就绪，请等待加载完成；加载失败时请检查素材后重新打开。'; return true }
      root.querySelector<HTMLIFrameElement>('[data-dispatch-print-frame]')?.contentWindow?.print(); return true
    }
    if (action === 'print') { const doc = allDocuments().find(item => item.id === id); if (!doc) throw new Error('未找到交出单'); printDoc(doc); return true }
    if (action === 'factory') { states[mode].factory = id; states[mode].currentPage = 1; selected.clear() }
    else if (action === 'search') {
      const state = states[mode]
      const value = (name: string) => (document.querySelector(`[data-dispatch-filter="${name}"]`) as HTMLInputElement)?.value?.trim() || ''
      state.keyword = value('keyword'); state.receiver = value('receiver'); state.person = value('person'); state.status = value('status'); state.creatable = value('creatable'); state.preparation = value('preparation'); state.currentPage = 1; selected.clear()
    } else if (action === 'reset') {
      const state = states[mode]
      state.keyword = ''; state.receiver = ''; state.person = ''; state.status = ''; state.creatable = ''; state.preparation = ''; state.currentPage = 1; selected.clear()
    } else if (action === 'clear') { selected.clear(); document.querySelectorAll<HTMLInputElement>('[data-dispatch-roll]').forEach(input => { input.checked = false }); showSelectionCount(); return true }
    else if (action === 'select-page') { document.querySelectorAll<HTMLInputElement>('[data-dispatch-roll]:not(:disabled)').forEach(input => { selected.add(input.value); input.checked = true }); showSelectionCount(); return true }
    else if (action === 'roll-prev' || action === 'roll-next') {
      rollPages.set(id, Math.max(1, (rollPages.get(id) || 1) + (action === 'roll-next' ? 1 : -1)))
      controllers[mode].refresh(); return true
    } else if (action === 'select-order') {
      const row = getPrintingPendingDispatchRows().find(item => item.order.workOrderId === id)
      if (!row || row.reason) throw new Error(row?.reason || '未找到加工单')
      row.rolls.filter(roll => isPrintablePrintingRoll(row.order, roll)).forEach(roll => selected.add(keyOf(id, roll.id)))
    } else if (action === 'barcodes') { openPrintingDialog({ type: 'barcodes', workOrderId: id }); return true }
    else if (action === 'order-documents') { appStore.navigate(`${paths.documents}?workOrderId=${encodeURIComponent(id)}`); return true }
    else if (action === 'create' || action === 'merge') {
      const groups = groupPrintingDispatchSelection(selected)
      if (action === 'merge' && groups.length !== 1) throw new Error('合入草稿一次只能选择同工厂、同接收组织、同目标仓库、同单位的产出')
      preview = { groups, mergeId: action === 'merge' ? '' : undefined }; refreshOverlay(); return true
    } else if (action === 'cancel-preview') { preview = null; refreshOverlay(); return true }
    else if (action === 'commit-preview') {
      if (!preview) throw new Error('请先预览本次建单范围')
      const groups = groupPrintingDispatchSelection(selected)
      const operator = (document.querySelector('[data-dispatch-creator]') as HTMLInputElement)?.value.trim() || ''
      if (!operator) throw new Error('请填写建单人')
      const mergeId = preview.mergeId !== undefined ? (document.querySelector('[data-dispatch-merge]') as HTMLSelectElement)?.value : undefined
      if (preview.mergeId !== undefined && !mergeId) throw new Error('请选择范围一致的可编辑草稿')
      const created: string[] = []
      try {
        for (const group of groups) {
          created.push(createPrintingDispatch(group.lines, operator, mergeId))
          group.lines.forEach(line => line.barcodeIds.forEach(rollId => selected.delete(keyOf(line.workOrderId, rollId))))
        }
      } catch (error) {
        preview = null; feedback = created.length ? `已生成 ${created.join('、')}；其余分组未生成，请核对后重试。` : ''
        refresh(); throw error
      }
      preview = null; activeId = created[0] || ''; detailPage = 1; feedback = `${mergeId ? '已合入草稿' : '已生成交出草稿'}：${created.join('、')}。实物尚未交出。`
    } else if (action === 'detail') { if (!allDocuments().some(doc => doc.id === id)) throw new Error('未找到交出单'); activeId = id; detailPage = 1; preview = null; refreshOverlay(); return true }
    else if (action === 'back') { activeId = ''; preview = null; refreshOverlay(); return true }
    else if (action === 'detail-prev' || action === 'detail-next') { detailPage += action === 'detail-next' ? 1 : -1; refreshOverlay(); return true }
    else if (action === 'scan') {
      const input = document.querySelector<HTMLInputElement>('[data-dispatch-scan]')
      const operator = document.querySelector<HTMLInputElement>('[data-dispatch-operator]')?.value.trim() || ''
      if (!input?.value.trim()) throw new Error('请扫描或输入本单卷码')
      scanPrintingDispatchRoll(id, input.value.trim(), operator)
      refreshOverlay()
      const nextOperator = document.querySelector<HTMLInputElement>('[data-dispatch-operator]'); if (nextOperator) nextOperator.value = operator
      document.querySelector<HTMLInputElement>('[data-dispatch-scan]')?.focus()
      const notice = document.querySelector('[data-dispatch-overlay-feedback]'); if (notice) { notice.classList.remove('text-red-700'); notice.classList.add('text-emerald-700'); notice.textContent = '卷码已核对，尚未实际交出。' }
      controllers[mode].refresh(); return true
    } else if (action === 'confirm') {
      const doc = allDocuments().find(item => item.id === id)
      const operator = document.querySelector<HTMLInputElement>('[data-dispatch-operator]')?.value.trim() || ''
      if (!doc || printingDispatchProgress(doc) !== '工厂扫齐待交接') throw new Error('请先完成本单全部卷码核对')
      if (!operator) throw new Error('请填写实际交出人')
      if (!window.confirm(`确认 ${doc.id} 的 ${getPrintingDispatchLines(doc).length} 卷已实际交给 ${getPrintingDispatchLines(doc)[0]?.order.receivingTargetName || '接收方'}？确认后本厂扣减本次产出，下游等待实收。`)) return true
      confirmPrintingDispatch(id, operator); feedback = '实际交出已记录，等待下游接收。'
    } else if(action==='receive-record'){
      const doc=allDocuments().find(item=>item.id===activeId)
      const record=doc&&getPrintingDispatchReceiptSummary(doc).records.find(r=>(r!.handoverRecordId||r!.recordId)===id)
      const order=doc&&getPrintingDispatchLines(doc).find(l=>l.roll.handoverRecordId===id)?.order
      const form=node.closest<HTMLElement>('[data-downstream-receipt]')
      const value=(key:string)=>form?.querySelector<HTMLInputElement>(`[data-downstream-${key}]`)?.value.trim()||''
      if(!record||!order||!value('qty')||!value('person'))throw new Error('请填写明确实收数量与接收人，未收到填 0；空白不能保存。')
      if(!window.confirm(`接收人 ${value('person')} 确认本记录累计实收 ${value('qty')} ${record.qtyUnit}？此动作只记录下游实收。`))return true
      receivePrintingHandover(order.workOrderId,{handoverRecordId:id,receivedQty:Number(value('qty')),receiverName:value('person'),differenceReason:value('reason')})
      feedback='下游实收已保存，本厂交出数量保持不变。'
    } else if (action === 'remove-roll') {
      const [orderId, rollId] = id.split('|')
      const doc = allDocuments().find(item => item.id === activeId)
      const line = doc ? getPrintingDispatchLines(doc).find(item => item.order.workOrderId === orderId && item.roll.id === rollId) : undefined
      if (!doc || doc.status !== '草稿' || !line) throw new Error('仅未实际交出的草稿可以移除卷明细')
      const operator = document.querySelector<HTMLInputElement>('[data-dispatch-operator]')?.value.trim() || ''
      if (!operator) throw new Error('请填写操作人')
      if (!window.confirm(`从 ${doc.id} 移除 ${line.roll.barcode}（${quantity(line.roll.lengthY)} ${line.order.output.qtyUnit}）并释放占用？其余卷明细需重新核对；旧核对记录保留。`)) return true
      removePrintingDispatchRoll(doc.id, orderId, rollId, operator); feedback = '卷明细已移除并释放占用，请核对当前单据。'
    } else if (action === 'void') {
      const doc = allDocuments().find(item => item.id === id)
      const operator = document.querySelector<HTMLInputElement>('[data-dispatch-operator]')?.value.trim() || ''
      if (!doc || doc.status !== '草稿') throw new Error('只能作废尚未实际交出的草稿')
      if (!operator) throw new Error('请填写操作人')
      if (!window.confirm(`作废 ${id} 并释放 ${getPrintingDispatchLines(doc).length} 卷产出占用？保留原单据与操作记录，实物库存不变。`)) return true
      voidPrintingDispatch(id, operator); feedback = '交出草稿已作废，产出占用已释放。'
    } else return false
    refresh()
  } catch (error) { showError(error) }
  return true
}
