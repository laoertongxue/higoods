// @page-pattern: list
import { renderStandardListPage, renderStandardListFilters, renderStandardListStats } from '../../../components/ui/list-page.ts'
import { renderStandardListTable, type StandardListColumn } from '../../../components/ui/list-table.ts'
import { paginateStandardListRows } from '../../../components/ui/list-table-model.ts'
import { renderTablePagination } from '../../../components/ui/pagination.ts'
import { getAccessoryWarehouse, listAccessoryWarehouses, listEnabledAccessoryWarehouseLocations, listAccessoryWarehouseLocations, type AccessoryWarehouseKey } from '../../../data/wls/accessory-warehouse-master.ts'
import { listAccessoryRecords, saveAccessoryWarehouseAction } from '../../../data/wls/accessory-warehouse-records.ts'
import { buildAccessoryDispatchChange, buildAccessoryReceiveChange, type AccessoryReceipt, type AccessoryWarehouseActor } from '../../../data/wls/accessory-warehouse-commands.ts'
import { listAccessoryStockSources, getAccessoryStockMaterialMetadata } from '../../../data/wls/accessory-warehouse-stock-sources.ts'
import { getAccessoryStockAvailable, type AccessoryStock } from '../../../data/wls/accessory-warehouse-stock.ts'
import type { AccessoryPreparation, AccessoryTransfer, AccessoryTransferLine, AccessoryReassignment } from '../../../data/wls/accessory-warehouse-flow.ts'
import { accessoryButtonClass, accessoryImage, accessoryOverlay, focusAccessoryOverlay, restoreAccessoryFocus, trapAccessoryOverlayFocus } from './shared.ts'
import { escapeHtml } from '../../../utils.ts'

type View = 'transfers' | 'receipts' | 'stock'
type Modal = { type: 'dispatch' | 'receive' | 'detail'; transferId: string; receiptId?: string }
interface TransferRow { id: string; transfer: AccessoryTransfer; receipt?: AccessoryReceipt; preparation?: AccessoryPreparation }
interface StockRow { id: string; stock?: AccessoryStock; transfer?: AccessoryTransfer; line?: AccessoryTransferLine; preparation?: AccessoryPreparation }
const prefix = 'accessory-transfer'
let key: AccessoryWarehouseKey = 'gtp', view: View = 'transfers', mountedPath = ''
let keyword = '', status = '', stockMode = 'warehouse', page = 1, pageSize = 10
let queryDraft = '', statusDraft = '', role: AccessoryWarehouseActor['role'] = '仓管'
let modal: Modal | null = null, dirty = false, busy = false, error = '', feedback = ''
let drafts = new Map<string, string>()
let pending: Parameters<typeof saveAccessoryWarehouseAction<AccessoryTransfer>>[0] | null = null
const qty = (value: number, unit: string) => `${Number(value).toLocaleString('zh-CN', { maximumFractionDigits: 6 })} ${escapeHtml(unit)}`
const button = (label: string, action: string, id = '', primary = false, disabled = false) => `<button type="button" class="${accessoryButtonClass} ${primary ? 'bg-blue-600 text-white hover:bg-blue-700' : ''}" data-${prefix}-action="${escapeHtml(action)}" data-id="${escapeHtml(id)}" ${disabled ? 'disabled' : ''}>${escapeHtml(label)}</button>`
const root = () => document.querySelector<HTMLElement>('[data-accessory-transfer-root]')
const warehouse = () => getAccessoryWarehouse(key)
const transfers = () => listAccessoryRecords<AccessoryTransfer>('transfer')
const receipts = () => listAccessoryRecords<AccessoryReceipt>('receipt')
const preparations = () => listAccessoryRecords<AccessoryPreparation>('preparation')
const stocks = () => listAccessoryStockSources(listAccessoryRecords<AccessoryStock>('stock'))
const preparationFor = (transfer: AccessoryTransfer) => preparations().find(item => item.id === transfer.preparationId)
function warehouseName(code: string | null): string { return code === 'DLN' ? 'DLN 后道工厂' : listAccessoryWarehouses().find(item => item.code === code)?.name || (code ? '仓库待核对' : '待定调入方') }
function locationName(id: string): string { return listAccessoryWarehouseLocations().find(item => item.id === id)?.locationCode || '库位待核对' }
function transferName(transfer: AccessoryTransfer): string {
  const ordered = transfers().sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
  return `辅料调拨单 ${String(ordered.findIndex(item => item.id === transfer.id) + 1).padStart(3, '0')}`
}
function route(transfer: AccessoryTransfer): string { return `${warehouseName(transfer.fromWarehouse)} → ${warehouseName(transfer.toWarehouse)}` }
function quantities(transfer: AccessoryTransfer): string {
  return [...new Set(transfer.lines.map(line => line.unit))].map(unit => qty(transfer.lines.filter(line => line.unit === unit).reduce((sum, line) => sum + line.qty, 0), unit)).join('<br>')
}
function canDispatch(transfer: AccessoryTransfer): boolean { return role === '仓管' && transfer.fromWarehouse === warehouse().code && transfer.status === '待出库' && Boolean(transfer.toWarehouse) }
function canReceive(row: TransferRow): boolean { return role === '仓管' && row.receipt?.warehouseCode === warehouse().code && row.receipt.status === '待收货' && row.transfer.toWarehouse === warehouse().code && row.transfer.status === '已出库待收货' }
function filteredTransfers(): TransferRow[] {
  const all = transfers(), prepared = preparations()
  const rows: TransferRow[] = view === 'receipts'
    ? receipts().filter(item => item.warehouseCode === warehouse().code).flatMap(receipt => {
      const transfer = all.find(item => item.id === receipt.transferId)
      return transfer ? [{ id: receipt.id, receipt, transfer, preparation: prepared.find(item => item.id === transfer.preparationId) }] : []
    })
    : all.filter(item => item.fromWarehouse === warehouse().code).map(transfer => ({ id: transfer.id, transfer, preparation: prepared.find(item => item.id === transfer.preparationId) }))
  return rows.filter(row => (!status || (view === 'receipts' ? row.receipt?.status : row.transfer.status) === status)
    && (!keyword || [row.preparation?.productionOrderNo, row.preparation?.styleName, route(row.transfer), ...row.transfer.lines.map(line => line.materialName)].join(' ').toLowerCase().includes(keyword.toLowerCase())))
    .sort((a, b) => b.transfer.createdAt.localeCompare(a.transfer.createdAt) || a.id.localeCompare(b.id))
}
function materialInfo(row: StockRow): { name: string; image: string; color: string; spec: string } {
  const line = row.line || transfers().flatMap(item => item.lines).find(item => item.materialSku === row.stock?.materialSku && item.unit === row.stock?.unit) || preparations().flatMap(item => item.lines).find(item => item.materialSku === row.stock?.materialSku && item.unit === row.stock?.unit)
  const metadata = line || (row.stock ? getAccessoryStockMaterialMetadata(row.stock.materialSku) : null)
  return metadata ? { name: metadata.materialName, image: metadata.imageUrl, color: metadata.color, spec: metadata.spec } : { name: '物料资料待核对', image: '', color: '', spec: '' }
}
function filteredStocks(): StockRow[] {
  const rows: StockRow[] = stockMode === 'transit'
    ? transfers().filter(item => item.status === '已出库待收货' && (item.fromWarehouse === warehouse().code || item.toWarehouse === warehouse().code)).flatMap(transfer => transfer.lines.map(line => ({ id: `${transfer.id}:${line.id}`, transfer, line, preparation: preparationFor(transfer) })))
    : stocks().filter(item => item.warehouseCode === warehouse().code).map(stock => ({ id: stock.id, stock }))
  return rows.filter(row => !keyword || [materialInfo(row).name, materialInfo(row).color, materialInfo(row).spec, row.preparation?.productionOrderNo, row.stock?.materialSku, row.transfer && route(row.transfer), row.stock && locationName(row.stock.locationId)].join(' ').toLowerCase().includes(keyword.toLowerCase()))
}
const transferColumns: StandardListColumn<TransferRow>[] = [
  { key: 'order', title: '生产单 / 款式', width: 270, required: true, render: row => row.preparation ? `<div class="flex items-center gap-3">${accessoryImage(row.preparation.styleImageUrl, row.preparation.styleName)}<div><strong>${escapeHtml(row.preparation.productionOrderNo)}</strong><p>${escapeHtml(row.preparation.styleName)}</p><p class="text-xs text-muted-foreground">${escapeHtml(transferName(row.transfer))}</p></div></div>` : '<span class="text-amber-700">生产单资料待核对</span>' },
  { key: 'route', title: '来源 → 去向', width: 250, render: row => escapeHtml(route(row.transfer)) },
  { key: 'status', title: '当前状态', width: 150, render: row => `<strong>${escapeHtml(view === 'receipts' ? row.receipt?.status || '待核对' : row.transfer.status)}</strong>${view === 'receipts' ? `<p class="text-xs text-muted-foreground">调拨：${escapeHtml(row.transfer.status)}</p>` : ''}` },
  { key: 'quantity', title: '整单数量', width: 140, render: row => quantities(row.transfer) },
  { key: 'time', title: '创建时间', width: 180, render: row => escapeHtml(row.transfer.createdAt) },
  { key: 'actions', title: '操作', width: 240, required: true, actionColumn: true, render: row => `<div class="flex flex-wrap gap-2">${button('查看明细和记录', 'detail', row.transfer.id)}${view === 'transfers' ? button('整单确认出库', 'dispatch', row.transfer.id, true, !canDispatch(row.transfer)) : button('确认收货并上架', 'receive', row.receipt?.id || '', true, !canReceive(row))}</div>` },
]
const stockColumns: StandardListColumn<StockRow>[] = [
  { key: 'material', title: '辅料', width: 270, required: true, render: row => { const item = materialInfo(row); return `<div class="flex items-center gap-3">${accessoryImage(item.image, item.name)}<div><strong>${escapeHtml(item.name)}</strong><p class="text-xs text-muted-foreground">${escapeHtml([item.color, item.spec].filter(Boolean).join(' · '))}</p></div></div>` } },
  { key: 'place', title: '库位 / 在途去向', width: 240, render: row => row.stock ? escapeHtml(locationName(row.stock.locationId)) : escapeHtml(route(row.transfer!)) },
  { key: 'onhand', title: '仓内实物', width: 130, render: row => row.stock ? qty(row.stock.onHandQty, row.stock.unit) : '—' },
  { key: 'reserved', title: '已预留', width: 130, render: row => row.stock ? qty(row.stock.reservedQty, row.stock.unit) : '—' },
  { key: 'available', title: '当前可用', width: 130, render: row => row.stock ? qty(getAccessoryStockAvailable(row.stock), row.stock.unit) : '—' },
  { key: 'transit', title: '在途数量', width: 130, render: row => row.line ? qty(row.line.qty, row.line.unit) : '—' },
  { key: 'source', title: '来源', width: 190, render: row => row.preparation ? escapeHtml(row.preparation.productionOrderNo) : row.stock?.sourceRefs?.some(ref => ref.kind === 'TRANSFER_IN') ? '调拨收货' : listAccessoryRecords<AccessoryStock>('stock').some(stock => stock.id === row.stock?.id) ? '已保存库存记录' : '本地演示盘点底稿' },
]
function renderWorkspace(): string {
  const current = warehouse(), title = view === 'stock' ? '辅料库存' : view === 'receipts' ? '调拨收货' : '辅料调拨'
  const rows = view === 'stock' ? filteredStocks() : filteredTransfers()
  const paged = paginateStandardListRows<TransferRow | StockRow>(rows, page, pageSize)
  page = paged.currentPage
  const columns = (view === 'stock' ? stockColumns : transferColumns) as StandardListColumn<TransferRow | StockRow>[]
  const tableHtml = renderStandardListTable({ columns, rows: paged.rows, preferences: { order: columns.map(item => item.key), visibleKeys: columns.map(item => item.key), frozenKeys: [], pageSize }, sort: null, eventPrefix: prefix })
  const options = view === 'transfers' ? ['待定调入方', '待出库', '已出库待收货', '已收货', '已作废'] : ['待收货', '已收货', '已取消']
  return renderStandardListPage({
    title: `${current.name} · ${title}`,
    primaryActionsHtml: `<label class="flex items-center gap-2 text-sm">演示角色<select class="h-9 rounded border px-2" data-${prefix}-field="role"><option ${role === '仓管' ? 'selected' : ''}>仓管</option><option ${role === 'PPIC' ? 'selected' : ''}>PPIC</option></select></label>`,
    feedbackHtml: `${feedback ? `<p role="status" class="rounded border border-green-200 bg-green-50 p-3 text-sm">${escapeHtml(feedback)}</p>` : ''}${role === 'PPIC' ? '<p class="text-sm text-muted-foreground">PPIC 可查看，本仓仓管确认实物交接。</p>' : ''}`,
    filtersHtml: renderStandardListFilters({ actionPrefix: prefix, fieldsHtml: `<label class="grid gap-1 text-sm">${view === 'stock' ? '物料 / 库位 / 生产单' : '生产单 / 款式 / 物料'}<input class="h-9 rounded border px-3" data-${prefix}-field="keyword" value="${escapeHtml(queryDraft)}"></label>${view === 'stock' ? `<label class="grid gap-1 text-sm">库存范围<select class="h-9 rounded border px-3" data-${prefix}-field="stockMode"><option value="warehouse" ${stockMode === 'warehouse' ? 'selected' : ''}>在仓库存</option><option value="transit" ${stockMode === 'transit' ? 'selected' : ''}>在途辅料</option></select></label>` : `<label class="grid gap-1 text-sm">状态<select class="h-9 rounded border px-3" data-${prefix}-field="status"><option value="">全部</option>${options.map(value => `<option ${statusDraft === value ? 'selected' : ''}>${escapeHtml(value)}</option>`).join('')}</select></label>`}` }),
    statsHtml: renderStandardListStats(view === 'stock' ? [{ label: stockMode === 'transit' ? '筛选在途明细' : '筛选库存明细', value: rows.length }, { label: '数量单位', value: new Set((rows as StockRow[]).map(row => row.stock?.unit || row.line?.unit)).size }] : [{ label: '筛选调拨单', value: rows.length }, { label: '待办理', value: (rows as TransferRow[]).filter(row => view === 'receipts' ? row.receipt?.status === '待收货' && row.transfer.status === '已出库待收货' : row.transfer.status === '待出库').length }, { label: '在途', value: (rows as TransferRow[]).filter(row => row.transfer.status === '已出库待收货').length }]),
    listTitle: view === 'stock' ? (stockMode === 'transit' ? '已出库待收货的辅料' : '仓内实物与预留') : title,
    tableHtml, paginationHtml: renderTablePagination({ ...paged, actionPrefix: prefix, pageSizeOptions: [10, 20, 50], skipPageRerender: true }),
  })
}
function lineTable(transfer: AccessoryTransfer, receiving: boolean): string {
  const locations = listEnabledAccessoryWarehouseLocations(warehouse().code)
  const receipt = modal?.receiptId ? receipts().find(item => item.id === modal?.receiptId) : receipts().find(item => item.transferId === transfer.id && item.status === '已收货')
  const columns: StandardListColumn<AccessoryTransferLine>[] = [
    { key: 'material', title: '辅料', width: 260, required: true, render: line => `<div class="flex items-center gap-3">${accessoryImage(line.imageUrl, line.materialName)}<div><strong>${escapeHtml(line.materialName)}</strong>${line.materialSku && !/-bom-|prep-line-|::/.test(line.materialSku) ? `<p class="text-xs text-muted-foreground">${escapeHtml(line.materialSku)}</p>` : ''}<p class="text-xs text-muted-foreground">${escapeHtml([line.color, line.spec].filter(Boolean).join(' · '))}</p></div></div>` },
    { key: 'expected', title: '应交 / 应收', width: 130, render: line => qty(line.qty, line.unit) },
    { key: 'from', title: '发出库位', width: 150, render: line => escapeHtml(locationName(line.fromLocationId)) },
    { key: 'received', title: receiving ? '实收数量' : '实收 / 上架库位', width: 180, render: line => receiving ? `<label class="flex items-center gap-2"><input class="h-10 w-28 rounded border px-2" aria-label="${escapeHtml(line.materialName)}实收数量" inputmode="decimal" data-aw-transfer-qty="${escapeHtml(line.id)}" value="${escapeHtml(drafts.get(`qty:${line.id}`) || '')}"><span>${escapeHtml(line.unit)}</span></label>` : receipt?.lines.find(item => item.lineId === line.id) ? `${qty(receipt.lines.find(item => item.lineId === line.id)!.qty, line.unit)} / ${escapeHtml(locationName(receipt.lines.find(item => item.lineId === line.id)!.locationId))}` : '尚未收货' },
  ]
  if (receiving) columns.push({ key: 'location', title: '本仓上架库位', width: 190, render: line => `<select class="h-10 max-w-full rounded border px-2" aria-label="${escapeHtml(line.materialName)}上架库位" data-aw-transfer-location="${escapeHtml(line.id)}"><option value="">选择上架库位</option>${locations.map(item => `<option value="${escapeHtml(item.id)}" ${drafts.get(`location:${line.id}`) === item.id ? 'selected' : ''}>${escapeHtml(item.locationCode)}</option>`).join('')}</select>` })
  return renderStandardListTable({ columns, rows: transfer.lines, preferences: { order: columns.map(item => item.key), visibleKeys: columns.map(item => item.key), frozenKeys: [], pageSize: transfer.lines.length }, sort: null, eventPrefix: prefix })
}
function renderModal(): string {
  if (!modal) return ''
  const transfer = transfers().find(item => item.id === modal?.transferId)
  if (!transfer) return accessoryOverlay('调拨资料无法核对', '<p role="alert">该调拨资料已变化，请关闭并重新读取。</p>', '', 'transfer-close')
  const preparation = preparationFor(transfer), receiving = modal.type === 'receive', dispatching = modal.type === 'dispatch'
  const title = receiving ? '确认收货并上架' : dispatching ? '整单确认出库' : '调拨明细和记录'
  return accessoryOverlay(title, `<div class="space-y-4"><div class="flex items-center gap-3">${preparation ? accessoryImage(preparation.styleImageUrl, preparation.styleName) : ''}<div><strong>${escapeHtml(preparation?.productionOrderNo || '生产单资料待核对')}</strong><p>${escapeHtml(preparation?.styleName || '')}</p><p class="mt-1 text-sm">${escapeHtml(route(transfer))}</p></div></div><p class="text-sm">当前状态：${escapeHtml(transfer.status)}</p>${dispatching ? '<p class="rounded bg-amber-50 p-3 text-sm">确认后整单扣减发出仓实物及对应预留，辅料进入在途。目的仓须另行确认收货并上架。</p>' : receiving ? '<p class="rounded bg-blue-50 p-3 text-sm">逐行登记本次实收数量和本仓上架库位。实收须与整单应收一致，不能分批收货。</p>' : ''}<div class="overflow-x-auto">${lineTable(transfer, receiving)}</div>${modal.type !== 'detail' ? `<label class="grid max-w-sm gap-1 text-sm">确认仓管<input class="h-10 rounded border px-3" data-aw-transfer-actor value="${escapeHtml(drafts.get('actor') || '')}"></label>` : ''}<p role="alert" data-aw-transfer-error class="whitespace-pre-wrap text-sm text-red-600">${escapeHtml(error)}</p>${transfer.history.length ? `<section><h3 class="font-semibold">操作记录</h3><ol class="mt-2 space-y-2">${transfer.history.map(item => `<li class="rounded border p-3 text-sm"><strong>${escapeHtml(item.action)}</strong><p class="mt-1">${escapeHtml(item.detail)}</p><p class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.by)} · ${escapeHtml(item.at)}</p></li>`).join('')}</ol></section>` : ''}</div>`, modal.type === 'detail' ? '' : button(busy ? '正在保存…' : title, 'save', '', true, busy), 'transfer-close')
}
function refreshWorkspace(): void { const host = root()?.querySelector<HTMLElement>('[data-aw-transfer-workspace]'); if (host) host.innerHTML = renderWorkspace() }
function refreshModal(): void { const host = root()?.querySelector<HTMLElement>('[data-aw-transfer-modal]'); if (host) host.innerHTML = renderModal() }
function clearModal(): void { modal = null; drafts.clear(); dirty = false; error = ''; pending = null; root()?.querySelector('[data-aw-transfer-modal]')?.replaceChildren(); restoreAccessoryFocus() }
function closeModal(): void { if (busy || (dirty && !window.confirm('收发货输入尚未保存。关闭将丢弃这些输入，是否关闭？'))) return; clearModal() }
function openModal(value: Modal): void {
  if (busy) return
  modal = value; drafts = new Map([['actor', `${warehouse().name}仓管（演示）`]]); dirty = false; pending = null; error = ''; refreshModal(); focusAccessoryOverlay()
}
function showError(value: unknown): void { error = value instanceof Error ? value.message : String(value); const node = root()?.querySelector('[data-aw-transfer-error]'); if (node) node.textContent = error }
async function save(): Promise<void> {
  if (busy || !modal || modal.type === 'detail') return
  try {
    if (!pending) {
      const transfer = transfers().find(item => item.id === modal?.transferId)
      if (!transfer) throw new Error('调拨单已变化，请重新读取。')
      const actor: AccessoryWarehouseActor = { role, warehouseCode: warehouse().code, name: drafts.get('actor')?.trim() || '' }
      const commandId = crypto.randomUUID(), at = new Date().toISOString()
      if (modal.type === 'dispatch') {
        if (!canDispatch(transfer)) throw new Error('当前角色、发出仓或调拨状态不允许确认出库。')
        const result = buildAccessoryDispatchChange({ transfer, stocks: stocks(), actor, commandId, at })
        pending = { commandId, intent: `dispatch:${transfer.id}`, result: result.transfer, change: result.change }
      } else {
        const receipt = receipts().find(item => item.id === modal?.receiptId)
        if (!receipt || !canReceive({ id: receipt.id, receipt, transfer })) throw new Error('当前接收事项已失效、已取消或不属于本仓。')
        const lines = transfer.lines.map(line => ({ lineId: line.id, qty: Number(drafts.get(`qty:${line.id}`) || ''), locationId: drafts.get(`location:${line.id}`) || '' }))
        const result = buildAccessoryReceiveChange({ transfer, receipt, stocks: stocks(), lines, locations: listEnabledAccessoryWarehouseLocations(warehouse().code), actor, commandId, at, reassignments: listAccessoryRecords<AccessoryReassignment>('change') })
        pending = { commandId, intent: `receive:${transfer.id}:${receipt.id}`, result: result.transfer, change: result.change }
      }
    }
    busy = true
    const controls = [...root()!.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLButtonElement>('[data-aw-transfer-modal] input,[data-aw-transfer-modal] select,[data-aw-transfer-modal] button')].map(node => ({ node, disabled: node.disabled }))
    controls.forEach(({ node }) => { node.disabled = true })
    try {
      const completed = await saveAccessoryWarehouseAction(pending)
      const onwardCreated = pending.change.puts.some(row => row.collection === 'accessory-warehouse:transfer' && (row.value as AccessoryTransfer).kind === 'SITE_REASSIGN' && (row.value as AccessoryTransfer).id !== completed.id)
      busy = false; feedback = completed.status === '已收货' ? (onwardCreated ? '整单收货入库并上架已保存，已建立转往新仓的调拨单。' : '整单收货入库并上架已保存。') : '整单出库已保存，等待目的仓收货。'; clearModal(); refreshWorkspace()
    } finally { busy = false; controls.forEach(({ node, disabled }) => { node.disabled = disabled }) }
  } catch (value) { busy = false; showError(value) }
}

export function renderAccessoryTransfersPage(warehouseKey: AccessoryWarehouseKey, requestedView: View): string {
  const path = typeof window === 'undefined' ? '' : window.location.pathname + window.location.search
  if (key !== warehouseKey || view !== requestedView || mountedPath !== path) { key = warehouseKey; view = requestedView; page = 1; pageSize = 10; keyword = ''; queryDraft = ''; status = ''; statusDraft = ''; stockMode = 'warehouse'; role = '仓管'; modal = null; drafts.clear(); pending = null; dirty = false; feedback = '' }
  mountedPath = path
  return `<div data-accessory-transfer-root="${warehouseKey}" data-accessory-transfer-view="${requestedView}" data-skip-page-rerender="true"><div data-aw-transfer-workspace>${renderWorkspace()}</div><div data-aw-transfer-modal>${renderModal()}</div><div data-aw-transfer-image></div></div>`
}
export function handleAccessoryTransferEvent(target: HTMLElement, event?: Event): boolean {
  if (!root()) return false
  const input = target.closest<HTMLInputElement | HTMLSelectElement>('[data-aw-transfer-qty],[data-aw-transfer-location],[data-aw-transfer-actor]')
  if (input && (event?.type === 'input' || event?.type === 'change')) {
    if (busy) return true
    const id = input.dataset.awTransferQty ? `qty:${input.dataset.awTransferQty}` : input.dataset.awTransferLocation ? `location:${input.dataset.awTransferLocation}` : 'actor'
    drafts.set(id, input.value); dirty = true; pending = null; return true
  }
  const field = target.closest<HTMLInputElement | HTMLSelectElement>(`[data-${prefix}-field]`)
  if (field && (event?.type === 'input' || event?.type === 'change')) {
    const name = field.dataset.accessoryTransferField
    if (name === 'keyword') queryDraft = field.value
    if (name === 'status') statusDraft = field.value
    if (name === 'role' && event?.type === 'change') { role = field.value === 'PPIC' ? 'PPIC' : '仓管'; refreshWorkspace() }
    if (name === 'stockMode' && event?.type === 'change') { stockMode = field.value === 'transit' ? 'transit' : 'warehouse'; page = 1; refreshWorkspace() }
    if (name === 'pageSize' && event?.type === 'change') { pageSize = [10, 20, 50].includes(Number(field.value)) ? Number(field.value) : 10; page = 1; refreshWorkspace() }
    return true
  }
  const image = target.closest<HTMLElement>('[data-accessory-action]')
  if (image && (!event || event.type === 'click')) {
    if (image.dataset.accessoryAction === 'transfer-close') { closeModal(); return true }
    if (image.dataset.accessoryAction === 'transfer-close-image') { root()?.querySelector('[data-aw-transfer-image]')?.replaceChildren(); restoreAccessoryFocus(); return true }
    if (image.dataset.accessoryAction === 'image') {
      const host = root()?.querySelector('[data-aw-transfer-image]')
      if (host) { host.innerHTML = accessoryOverlay(image.dataset.label || '图片', `<img class="mx-auto max-h-[70vh] max-w-full object-contain" src="${escapeHtml(image.dataset.image || '')}" alt="${escapeHtml(image.dataset.label || '')}" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><p hidden class="p-3 text-sm text-red-600">图片加载失败，关闭后点击缩略图重试。</p>`, '', 'transfer-close-image'); focusAccessoryOverlay() }
      return true
    }
  }
  const node = target.closest<HTMLElement>(`[data-${prefix}-action]`), action = node?.dataset.accessoryTransferAction
  if (!node || !action || (event && event.type !== 'click')) return false
  if (busy) return true
  if (action === 'query' || action === 'reset') { if (action === 'reset') { queryDraft = ''; statusDraft = '' }; keyword = queryDraft.trim(); status = statusDraft; page = 1; refreshWorkspace(); return true }
  if (action === 'prev-page' || action === 'next-page') { page += action === 'next-page' ? 1 : -1; refreshWorkspace(); return true }
  if (action === 'save') { void save(); return true }
  const transfer = transfers().find(item => item.id === node.dataset.id)
  if (action === 'detail' && transfer) { openModal({ type: 'detail', transferId: transfer.id }); return true }
  if (action === 'dispatch') { if (!transfer || !canDispatch(transfer)) { feedback = '当前角色、发出仓或调拨状态不允许确认出库。'; refreshWorkspace(); return true }; openModal({ type: 'dispatch', transferId: transfer.id }); return true }
  if (action === 'receive') {
    const receipt = receipts().find(item => item.id === node.dataset.id), receiving = transfers().find(item => item.id === receipt?.transferId)
    if (!receipt || !receiving || !canReceive({ id: receipt.id, receipt, transfer: receiving })) { feedback = '当前接收事项已失效、已取消或不属于本仓。'; refreshWorkspace(); return true }
    openModal({ type: 'receive', transferId: receiving.id, receiptId: receipt.id }); return true
  }
  return false
}
if (typeof document !== 'undefined') {
  document.addEventListener('keydown', event => {
    if (!root()) return
    trapAccessoryOverlayFocus(event)
    if (event.key === 'Escape') { if (root()?.querySelector('[data-aw-transfer-image]')?.childElementCount) { root()?.querySelector('[data-aw-transfer-image]')?.replaceChildren(); restoreAccessoryFocus() } else closeModal() }
  })
  window.addEventListener('beforeunload', event => { if (root() && (dirty || busy)) { event.preventDefault(); event.returnValue = '' } })
  window.addEventListener('higood:before-history-navigation', event => {
    if (!root() || (!dirty && !busy)) return
    if (busy || !window.confirm('收发货输入尚未保存。离开将丢弃这些输入，是否离开？')) { event.preventDefault(); window.history.pushState(null, '', mountedPath) }
    else clearModal()
  })
  document.addEventListener('click', event => {
    if (!root() || (!dirty && !busy)) return
    const target = event.target instanceof Element ? event.target.closest('[data-nav],[data-system],[data-system-id],[data-system-switch],a[href]') : null
    if (target && (busy || !window.confirm('收发货输入尚未保存。离开将丢弃这些输入，是否离开？'))) { event.preventDefault(); event.stopImmediatePropagation() }
    else if (target) clearModal()
  }, true)
}
