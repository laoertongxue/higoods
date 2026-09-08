// @page-pattern: list
// WH-001–006：原交出单中转区域实收；原型身份选择，不代替生产鉴权。
import { renderStandardListPage, renderStandardListStats } from '../components/ui/list-page.ts'
import { renderDialog } from '../components/ui/dialog.ts'
import { createProcessOrderListController, type ProcessOrderListControllerState } from '../components/ui/process-order-list-controller.ts'
import type { StandardListColumn } from '../components/ui/list-table.ts'
import { resetStandardListEntryTransientStateOnRouteEntry } from '../components/ui/list-table-model.ts'
import { listPdaHandoverHeads, getPdaHandoverRecordsByHead, findPdaHandoverRecord, findPdaHandoverHead, writeBackHandoverRecord, type PdaHandoverHead, type PdaHandoverRecord } from '../data/fcs/pda-handover-events.ts'
import { escapeHtml } from '../utils.ts'

interface ReceiptRow { head: PdaHandoverHead; record: PdaHandoverRecord }
interface InboundState extends ProcessOrderListControllerState {
  keyword: string; actorRole: string; actorName: string; rows: ReceiptRow[]
  selected: ReceiptRow | null; qty: string; reason: string; feedback: string; busy: boolean
}
const PREFIX = 'wls-inbound'
const ROOT = '[data-wls-inbound-root]'
const state: InboundState = {
  currentPage: 1, sort: null, preferences: { order: [], visibleKeys: [], frozenKeys: [], pageSize: 10 },
  preferencesLoaded: false, showColumnSettings: false, keyword: '', actorRole: 'READONLY', actorName: '',
  rows: [], selected: null, qty: '', reason: '', feedback: '', busy: false,
}
function inScope(head: PdaHandoverHead): boolean {
  return head.headType === 'HANDOUT' && head.receiverKind === 'WAREHOUSE' && head.receiverId === 'WH-TRANSFER'
}
function unit(row: ReceiptRow): string { return row.record.qtyUnit || row.head.qtyUnit || '' }
function quantity(value: number | undefined, row: ReceiptRow): string {
  return typeof value === 'number' && Number.isFinite(value) ? `${value} ${escapeHtml(unit(row))}` : '数量未记录'
}
function receiptBlock(row: ReceiptRow | undefined): string {
  if (!row || !inScope(row.head) || row.record.handoverId !== row.head.handoverId) return '该记录不属于中转区域收货，请重新查询。'
  const record = row.record
  if (record.taskReceipts?.length) return '该批已按目标加工单分次接收，请到原加工单继续，不能整批重复收货。'
  if (record.handoverRecordStatus === 'VOIDED') return '该交出记录已作废。'
  if (record.status !== 'PENDING_WRITEBACK' || record.receiverWrittenQty !== undefined || record.warehouseWrittenQty !== undefined) return '该批已确认收货，不能重复提交。'
  if (!Number.isFinite(record.submittedQty) || (record.submittedQty ?? 0) <= 0 || !unit(row)) return '交出数量或单位未记录，请交出方核对。'
  if (record.recordLines?.some(line => line.qtyUnit !== unit(row))) return '该批明细单位不一致，请交出方核对后再收货。'
  return ''
}
function validateReceipt(row: ReceiptRow | undefined, role: string, name: string, rawQty: string, reason: string): number {
  if (role !== 'TRANSFER_CLERK') throw new Error('只读身份不能确认收货，请选择中转区域收货员。')
  if (!name.trim()) throw new Error('请填写实际收货员姓名。')
  const blocked = receiptBlock(row)
  if (blocked) throw new Error(blocked)
  const qty = Number(rawQty)
  if (!rawQty.trim() || !Number.isFinite(qty) || qty < 0) throw new Error('请填写非负的实际清点数量。')
  if (qty > row!.record.submittedQty!) throw new Error('实收数量不能超过该批交出数量，请重新清点。')
  if (qty !== row!.record.submittedQty && !reason.trim()) throw new Error('数量有差异，请填写少收原因。')
  return qty
}
function loadRows(): void {
  state.rows = listPdaHandoverHeads().filter(inScope).flatMap(head =>
    getPdaHandoverRecordsByHead(head.handoverId).map(record => ({ head, record })))
}
function filteredRows(): ReceiptRow[] {
  const key = state.keyword.trim().toLowerCase()
  return state.rows.filter(({ head, record }) => !key || [head.handoverOrderNo, head.handoverId, head.productionOrderNo, head.taskNo, record.recordId, record.materialName, record.materialCode, record.skuCode].some(value => value?.toLowerCase().includes(key)))
}
const action = (name: string) => `data-wls-inbound-action="${name}" data-skip-page-rerender="true"`
function material(row: ReceiptRow): string {
  const record = row.record
  // 原 HO 没有与加工产物绑定的图片字段；不借用原料、纸样或交接凭证冒充产物实拍。
  return `<div class="font-medium">${escapeHtml(record.materialName || row.head.materialName || '交出物料')}</div><div class="text-xs text-slate-500">${escapeHtml(record.skuCode || record.materialCode || row.head.materialCode || '原单未记录物料编码')}</div><div class="mt-1 text-xs text-amber-800" data-wls-inbound-missing-image>该交出物料的准确图片待补充</div>${(record.recordLines || []).map(line => `<div class="mt-1 text-xs">${escapeHtml(line.materialSku || line.garmentSkuCode || line.partName || line.lineId)} · ${escapeHtml(line.fabricRollNo || '')} · ${line.submittedQty} ${escapeHtml(line.qtyUnit)}</div>`).join('')}`
}
const columns: StandardListColumn<ReceiptRow>[] = [
  { key: 'source', title: '原交出单／批次', width: 260, required: true, freezeable: true, sortable: true, sortValue: row => row.record.factorySubmittedAt,
    render: ({ head, record }) => `<div class="font-medium">${escapeHtml(head.handoverOrderNo || head.handoverId)}</div><div class="text-xs">${escapeHtml(record.handoverRecordNo || record.recordId)}</div><div class="text-xs text-slate-500">${escapeHtml(head.productionOrderNo || head.stockMaterialId || '来源单号未记录')} · ${escapeHtml(head.processName)}</div>` },
  { key: 'material', title: '交出物料', width: 260, required: true, render: material },
  { key: 'parties', title: '交出方／接收方', width: 190, render: ({ head, record }) => `${escapeHtml(head.sourceFactoryName)}<div class="text-xs">${escapeHtml(record.factorySubmittedBy || '交出人未记录')} → 中转区域</div><div class="text-xs text-slate-500">${escapeHtml(record.factorySubmittedAt)}</div>` },
  { key: 'qty', title: '该批交出／实收', width: 190, sortable: true, sortValue: row => row.record.submittedQty,
    render: row => `${quantity(row.record.submittedQty, row)}<div class="text-xs">${row.record.taskReceipts?.length ? '已按加工单分次接收' : row.record.receiverWrittenQty !== undefined ? `实收 ${quantity(row.record.receiverWrittenQty, row)}` : '待实际清点'}</div>${row.record.diffReason ? `<div class="text-xs text-amber-800">${escapeHtml(row.record.diffReason)}</div>` : ''}` },
  { key: 'receipt', title: '收货人／时间', width: 180, render: ({ record }) => `<div>${escapeHtml(record.receiverWrittenBy || '待收货')}</div><div class="text-xs">${escapeHtml(record.receiverWrittenAt || '')}</div>` },
  { key: 'actions', title: '操作', width: 230, required: true, actionColumn: true, render: row => {
    const blocked = receiptBlock(row)
    return `${blocked ? `<span class="text-xs text-slate-500">${escapeHtml(blocked)}</span>` : `<button class="rounded border px-3 py-2 disabled:opacity-40" ${action('open')} data-record-id="${escapeHtml(row.record.recordId)}" ${state.actorRole !== 'TRANSFER_CLERK' ? 'disabled' : ''}>确认实际收货</button>`}<button class="mt-1 block text-xs text-blue-700" data-nav="/fcs/pda/handover/${encodeURIComponent(row.head.handoverId)}">查看原交出单</button>`
  } },
]
const controller = createProcessOrderListController({ state, columns, preferenceKey: 'higood:list:/wls/inbound', pageSizeOptions: [10, 20, 50], eventPrefix: PREFIX, rootSelector: ROOT, tableSurfaceSelector: '[data-wls-inbound-table]', paginationSurfaceSelector: '[data-wls-inbound-pagination]', overlaysSurfaceSelector: '[data-wls-inbound-columns]', defaultFrozenKeys: ['source'], columnSettingsTitle: '中转区域收货列设置', emptyText: '暂无发往中转区域的交出记录', getRows: filteredRows, locallyManagedEvents: true })
function root(): HTMLElement | null { return typeof document === 'undefined' ? null : document.querySelector(ROOT) }
function refreshFeedback(): void { const el = root()?.querySelector('[data-wls-inbound-feedback]'); if (el) el.textContent = state.feedback }
function stats(): string {
  return renderStandardListStats([{ label: '交出批次', value: state.rows.length }, { label: '待清点批次', value: state.rows.filter(row => !receiptBlock(row)).length }, { label: '已确认批次', value: state.rows.filter(row => row.record.receiverWrittenQty !== undefined && !row.record.taskReceipts?.length).length }])
}
function overlays(): string {
  const row = state.selected
  const dialog = row ? renderDialog({ title: '确认实际收货', description: '清点实物后确认；差异会保留在原交出单。', width: 'md', closeAction: { prefix: PREFIX, action: 'close', skipPageRerender: true } },
    `<div class="max-h-[55vh] overflow-y-auto space-y-3"><p>${escapeHtml(row.head.handoverOrderNo || row.head.handoverId)}</p>${material(row)}<p>该批交出：${quantity(row.record.submittedQty, row)}</p><p>接收方：中转区域 · ${escapeHtml(state.actorName || '请先填写收货员姓名')}</p><label class="block">实际清点数量（${escapeHtml(unit(row))}）<input class="mt-1 w-full rounded border p-2" type="number" min="0" step="any" data-wls-inbound-field="qty" value="${escapeHtml(state.qty)}"></label><label class="block">少收原因（有差异必填）<textarea class="mt-1 w-full rounded border p-2" data-wls-inbound-field="reason">${escapeHtml(state.reason)}</textarea></label><p role="status" data-wls-inbound-dialog-feedback>${escapeHtml(state.feedback)}</p></div>`,
    `<button class="rounded border px-3 py-2" ${action('close')}>取消</button><button class="rounded bg-blue-600 px-3 py-2 text-white" ${action('save')} ${state.busy ? 'disabled' : ''}>${state.busy ? '正在确认…' : '确认并保存实收'}</button>`) : ''
  return `<div data-wls-inbound-columns>${controller.renderColumnSettings()}</div>${dialog}`
}
function refreshOverlays(): void {
  const el = root()?.querySelector<HTMLElement>('[data-wls-inbound-overlays]')
  if (el) el.innerHTML = overlays()
}
export function renderWlsInboundPage(): string {
  resetStandardListEntryTransientStateOnRouteEntry(state, Boolean(root()))
  state.selected = null; state.busy = false
  controller.installColumnDragEvents(); loadRows()
  const view = controller.getView()
  return `<div data-wls-inbound-root data-skip-page-rerender="true">${renderStandardListPage({
    title: '中转区域收货',
    primaryActionsHtml: `<div class="flex flex-wrap items-center gap-2 text-sm"><span>原型操作身份</span><select class="rounded border p-2" data-wls-inbound-field="actorRole"><option value="READONLY" ${state.actorRole === 'READONLY' ? 'selected' : ''}>只读查看</option><option value="TRANSFER_CLERK" ${state.actorRole === 'TRANSFER_CLERK' ? 'selected' : ''}>中转区域收货员</option></select><label>收货员姓名 <input class="rounded border p-2" data-wls-inbound-field="actorName" value="${escapeHtml(state.actorName)}" placeholder="填写实际操作人姓名"></label></div>`,
    feedbackHtml: `<p role="status" data-wls-inbound-feedback>${escapeHtml(state.feedback)}</p>`,
    filtersHtml: `<div class="flex flex-wrap gap-2"><input class="min-w-0 flex-1 rounded border p-2" aria-label="交出单、生产单或物料" data-wls-inbound-field="keyword" value="${escapeHtml(state.keyword)}" placeholder="交出单、生产单或物料"><button class="rounded border px-3" ${action('query')}>查询</button><button class="rounded border px-3" ${action('reload')}>刷新记录</button></div>`,
    statsHtml: `<div data-wls-inbound-stats>${stats()}</div>`, listTitle: '原交出批次', listActionsHtml: `<button ${action('open-column-settings')}>列设置</button>`,
    tableHtml: `<div data-wls-inbound-table>${view.tableHtml}</div>`, paginationHtml: `<div data-wls-inbound-pagination>${view.paginationHtml}</div>`, overlaysHtml: `<div data-wls-inbound-overlays>${overlays()}</div>`,
  })}</div>`
}
function localTime(): string {
  const date = new Date(), pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}
function saveReceipt(): void {
  if (state.busy || !state.selected) return
  const selected = state.selected, role = state.actorRole, name = state.actorName, qtyText = state.qty, reason = state.reason
  try { validateReceipt(selected, role, name, qtyText, reason) } catch (error) { state.feedback = (error as Error).message; refreshOverlays(); return }
  state.busy = true; state.feedback = '正在确认实际收货…'; refreshOverlays(); refreshFeedback()
  // 先显示反馈，确认时重读原单，禁止用打开弹窗时的旧余额写入。
  requestAnimationFrame(() => setTimeout(() => {
    let submitted = false, saved = false
    try {
      const record = findPdaHandoverRecord(selected.record.recordId)
      const head = record ? findPdaHandoverHead(record.handoverId) : undefined
      const current = record && head ? { record, head } : undefined
      const qty = validateReceipt(current, state.actorRole, state.actorName, qtyText, reason)
      if (role !== state.actorRole || name !== state.actorName || record!.submittedQty !== selected.record.submittedQty || unit(current!) !== unit(selected) || head!.handoverId !== selected.head.handoverId) throw new Error('交出记录或收货身份已变化，请重新打开确认。')
      const writtenAt = localTime(), writtenBy = `中转区域收货员 · ${name.trim()}`
      writeBackHandoverRecord({ handoverRecordId: record!.recordId, receiverWrittenQty: qty, receiverWrittenAt: writtenAt, receiverWrittenBy: writtenBy, diffReason: reason.trim(), receiverRemark: '中转区域实际清点收货' })
      submitted = true
      state.selected = null
      const persisted = findPdaHandoverRecord(record!.recordId)
      if (!persisted || persisted.receiverWrittenQty !== qty || persisted.receiverWrittenBy !== writtenBy || persisted.receiverWrittenAt !== writtenAt) throw new Error('原交出记录的实收数量、收货人或时间未核对一致，请先查看原交出单，不要重复提交。')
      saved = true
      state.selected = null; state.feedback = '该批实际收货已保存到原交出单。'
      loadRows(); controller.refresh()
      const el = root()?.querySelector('[data-wls-inbound-stats]'); if (el) el.innerHTML = stats()
    } catch (error) { state.feedback = saved ? `实收已保存，列表刷新失败，请点击刷新记录：${(error as Error).message}` : submitted ? `收货已提交，但保存结果未核实：${(error as Error).message}` : `未保存：${(error as Error).message}` }
    finally { state.busy = false; refreshOverlays(); refreshFeedback() }
  }, 0))
}
export function closeWlsInboundOverlays(): boolean {
  if (!root() || (!state.selected && !state.showColumnSettings)) return false
  if (!state.busy) { state.selected = null; state.showColumnSettings = false; refreshOverlays() }
  return true
}
export function handleWlsInboundEvent(target: HTMLElement, event?: Event): boolean {
  if (!root()) return false
  if (event?.type === 'keydown' && (event as KeyboardEvent).key === 'Escape') {
    if (!state.busy) { state.selected = null; state.showColumnSettings = false; refreshOverlays() }
    return true
  }
  const field = target.closest<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('[data-wls-inbound-field]')
  if (field) {
    const key = field.dataset.wlsInboundField
    if (state.busy) return true
    if (key === 'keyword') state.keyword = field.value
    if (key === 'actorName') state.actorName = field.value
    if (key === 'qty') state.qty = field.value
    if (key === 'reason') state.reason = field.value
    if (key === 'actorRole' && event?.type === 'change') { state.actorRole = field.value; state.selected = null; controller.refresh(); refreshOverlays() }
    if (key === 'pageSize' && event?.type === 'change') { controller.setPageSize(Number(field.value)); controller.refresh() }
    return true
  }
  const node = target.closest<HTMLElement>('[data-wls-inbound-action]')
  const name = node?.dataset.wlsInboundAction
  if (!node || !name) return false
  if (state.busy) return true
  if (name === 'save') { saveReceipt(); return true }
  if (name === 'open') {
    state.selected = state.rows.find(row => row.record.recordId === node.dataset.recordId) || null
    state.qty = ''; state.reason = ''; state.feedback = ''; refreshOverlays(); refreshFeedback(); return true
  }
  if (name === 'close') { state.selected = null; refreshOverlays(); return true }
  if (name === 'query' || name === 'reload') {
    if (name === 'reload') { loadRows(); const el = root()?.querySelector('[data-wls-inbound-stats]'); if (el) el.innerHTML = stats() }
    state.currentPage = 1; controller.refresh(); return true
  }
  if (name === 'prev-page' || name === 'next-page') controller.stepPage(name === 'prev-page' ? -1 : 1)
  if (name === 'sort-column') controller.cycleSort(node.dataset.columnKey || '')
  if (name === 'open-column-settings') state.showColumnSettings = true
  if (name === 'close-column-settings') state.showColumnSettings = false
  if (name === 'restore-column-settings') controller.restorePreferences()
  if (name === 'toggle-column-visibility' || name === 'toggle-column-freeze') controller.updateColumnPreference(name, node.dataset.wlsInboundColumnKey || '', (node as HTMLInputElement).checked)
  controller.refresh(); refreshOverlays(); return true
}
