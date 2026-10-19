// @page-pattern: list
import { renderStandardListPage, renderStandardListFilters, renderStandardListStats } from '../../../components/ui/list-page.ts'
import { renderStandardListTable, type StandardListColumn } from '../../../components/ui/list-table.ts'
import { paginateStandardListRows } from '../../../components/ui/list-table-model.ts'
import { renderTablePagination } from '../../../components/ui/pagination.ts'
import { getAccessoryWarehouse, listAccessoryWarehouseLocations, type AccessoryWarehouseKey } from '../../../data/wls/accessory-warehouse-master.ts'
import { listAccessoryPreparations } from '../../../data/wls/accessory-warehouse-sources.ts'
import { listAccessoryRecords } from '../../../data/wls/accessory-warehouse-records.ts'
import { getCurrentSewingPickupSlip, getSewingPickupSlipVersion } from '../../../data/fcs/sewing-pickup-slips.ts'
import { getEffectiveTaskAssignment } from '../../../data/fcs/effective-task-assignments.ts'
import { listAccessorySewingPickups, getAccessorySewingPickup, createAccessorySewingPickups, confirmAccessorySewingPickup, inspectLegacySewingPickupMigration, migrateLegacySewingPickupSlips } from '../../../data/wls/accessory-warehouse-sewing.ts'
import type { AccessoryPickup, AccessoryPreparation, AccessoryTransfer, AccessoryPickupLine } from '../../../data/wls/accessory-warehouse-flow.ts'
import { accessoryButtonClass, accessoryImage, accessoryOverlay, focusAccessoryOverlay, restoreAccessoryFocus, trapAccessoryOverlayFocus } from './shared.ts'
import { escapeHtml } from '../../../utils.ts'

type Row = { id: string; preparation: AccessoryPreparation; pickup?: AccessoryPickup }
const prefix = 'accessory-pickup'
let key: AccessoryWarehouseKey = 'hilon', mountedPath = '', keyword = '', queryDraft = '', status = '', statusDraft = '', page = 1, pageSize = 10
let role = '仓管', modal: { id: string; mode: 'handover' | 'detail' } | null = null, dirty = false, busy = false, error = '', feedback = ''
let drafts = new Map<string, string>(), commandId = '', actionAt = ''
const warehouse = () => getAccessoryWarehouse(key)
const root = () => document.querySelector<HTMLElement>('[data-accessory-pickup-root]')
const button = (label: string, action: string, id = '', primary = false, disabled = false) => `<button type="button" class="${accessoryButtonClass} ${primary ? 'bg-blue-600 text-white hover:bg-blue-700' : ''}" data-${prefix}-action="${action}" data-id="${escapeHtml(id)}" ${disabled ? 'disabled' : ''}>${escapeHtml(label)}</button>`
const qty = (value: number, unit: string) => `${value.toLocaleString('zh-CN', { maximumFractionDigits: 6 })} ${escapeHtml(unit)}`
function rows(): Row[] {
  const preparations = listAccessoryPreparations(), pickups = listAccessorySewingPickups(warehouse().code), transfers = listAccessoryRecords<AccessoryTransfer>('transfer')
  const active = pickups.filter(row => row.status !== '已失效')
  const result: Row[] = pickups.flatMap(pickup => { const preparation = preparations.find(row => row.id === pickup.preparationId); return preparation ? [{ id: pickup.id, preparation, pickup }] : [] })
  for (const preparation of preparations) if (!active.some(row => row.preparationId === preparation.id) && transfers.some(row => row.preparationId === preparation.id && row.toWarehouse === warehouse().code && row.status === '已收货' && row.kind !== 'SITE_TO_POST' && !transfers.some(next => next.sourceTransferId === row.id))) result.push({ id: preparation.id, preparation })
  return result.filter(row => (!status || (row.pickup?.status || '待建立清单') === status) && (!keyword || [row.preparation.productionOrderNo, row.preparation.styleName, row.pickup?.factoryName, row.pickup && getEffectiveTaskAssignment(row.pickup.assignmentId)?.taskNo].join(' ').toLowerCase().includes(keyword.toLowerCase())))
}
function currentVersion(pickup: AccessoryPickup) {
  const assignment = getEffectiveTaskAssignment(pickup.assignmentId)
  return getCurrentSewingPickupSlip(pickup.assignmentId, assignment?.processCodes.some(code => ['CUT', 'CUTTING', 'CUT_PANEL'].includes(code)) ? 'FABRIC_ACCESSORY' : 'ACCESSORY')
}
function workspace(): string {
  const result = rows(), paged = paginateStandardListRows(result, page, pageSize); page = paged.currentPage
  const columns: StandardListColumn<Row>[] = [
    { key: 'order', title: '生产单 / 款式', width: 260, required: true, render: row => `<div class="flex items-center gap-3">${accessoryImage(row.preparation.styleImageUrl, row.preparation.styleName)}<div><strong>${escapeHtml(row.preparation.productionOrderNo)}</strong><p class="text-xs text-muted-foreground">${escapeHtml(row.preparation.styleName)}</p></div></div>` },
    { key: 'task', title: '车缝任务 / 领料工厂', width: 220, render: row => row.pickup ? `${escapeHtml(getEffectiveTaskAssignment(row.pickup.assignmentId)?.taskNo || '任务待核对')}<p class="text-xs text-muted-foreground">${escapeHtml(row.pickup.factoryName)}</p>` : '按当前有效分配建立' },
    { key: 'status', title: '状态', width: 120, render: row => escapeHtml(row.pickup?.status || '待建立清单') },
    { key: 'material', title: '辅料明细', width: 160, render: row => row.pickup ? `${row.pickup.lines.length} 项<p class="text-xs text-muted-foreground">${row.pickup.lines.filter(line => line.handedQty < line.requiredQty).length} 项待领</p>` : '按 SKU 和冻结 BOM 计算' },
    { key: 'actions', title: '操作', width: 230, required: true, actionColumn: true, render: row => !row.pickup ? button('建立任务领料清单', 'create', row.preparation.id, true, role !== '仓管') : `<div class="flex flex-wrap gap-2">${button('查看', 'detail', row.pickup.id)}${!['已领料', '已失效'].includes(row.pickup.status) ? button('登记车缝领料', 'handover', row.pickup.id, true, role !== '仓管') : ''}</div>` },
  ]
  const migration = inspectLegacySewingPickupMigration()
  return renderStandardListPage({ title: `${warehouse().name} · 车缝领料`, primaryActionsHtml: `<label class="flex items-center gap-2 text-sm">演示角色<select class="h-9 rounded border px-2" data-${prefix}-field="role"><option ${role === '仓管' ? 'selected' : ''}>仓管</option><option ${role === 'PPIC' ? 'selected' : ''}>PPIC</option></select></label>`, feedbackHtml: `${feedback ? `<p role="status" class="rounded border bg-blue-50 p-3 text-sm">${escapeHtml(feedback)}</p>` : ''}${['待迁移', '待清理', '已阻塞'].includes(migration.state) ? `<div class="rounded border border-amber-300 bg-amber-50 p-3 text-sm"><b>原车缝领料资料：${migration.state}</b><p class="mt-1">${escapeHtml(migration.message)}</p>${migration.state !== '已阻塞' ? `<div class="mt-2">${button('迁移原领料凭证和实交历史', 'migrate', '', true, role !== '仓管')}</div>` : ''}</div>` : ''}`, filtersHtml: renderStandardListFilters({ actionPrefix: prefix, fieldsHtml: `<label class="grid gap-1 text-sm">生产单 / 款式 / 工厂<input class="h-9 rounded border px-3" value="${escapeHtml(queryDraft)}" data-${prefix}-field="keyword"></label><label class="grid gap-1 text-sm">状态<select class="h-9 rounded border px-3" data-${prefix}-field="status"><option value="">全部</option>${['待建立清单', '待领料', '领料中', '已领料', '已失效'].map(value => `<option ${statusDraft === value ? 'selected' : ''}>${value}</option>`).join('')}</select></label>` }), statsHtml: renderStandardListStats([{ label: '筛选清单', value: result.length }, { label: '尚未领齐', value: result.filter(row => row.pickup?.status !== '已领料').length }]), listTitle: '本仓车缝领料清单', tableHtml: renderStandardListTable({ columns, rows: paged.rows, preferences: { order: columns.map(row => row.key), visibleKeys: columns.map(row => row.key), frozenKeys: [], pageSize }, sort: null, eventPrefix: prefix, emptyText: '本仓暂无已收货的辅料或任务领料清单' }), paginationHtml: renderTablePagination({ ...paged, actionPrefix: prefix, pageSizeOptions: [10, 20, 50], skipPageRerender: true }) })
}
function renderModal(): string {
  if (!modal) return ''
  const pickup = getAccessorySewingPickup(modal.id)
  if (!pickup) return accessoryOverlay('领料资料无法读取', '<p role="alert">清单已变化，请关闭后重新读取。</p>', '', 'pickup-close')
  const preparation = listAccessoryPreparations().find(row => row.id === pickup.preparationId), version = currentVersion(pickup), selectedVersion = drafts.get('versionId') || ''
  const locationName = (id: string) => listAccessoryWarehouseLocations().find(row => row.id === id)?.locationCode || '库位待核对'
  const columns: StandardListColumn<AccessoryPickupLine>[] = [
    { key: 'material', title: '辅料', width: 260, required: true, render: line => `<div class="flex items-center gap-3">${accessoryImage(line.imageUrl, line.materialName)}<div><b>${escapeHtml(line.materialName)}</b><p class="text-xs text-muted-foreground">${escapeHtml([line.color, line.spec].filter(Boolean).join(' · '))}</p></div></div>` },
    { key: 'location', title: '领料库位', width: 160, render: line => escapeHtml(locationName(line.fromLocationId)) },
    { key: 'quantity', title: '应领 / 已领', width: 160, render: line => `${qty(line.requiredQty, line.unit)}<br>${qty(line.handedQty, line.unit)}` },
    { key: 'actual', title: modal.mode === 'handover' ? '本次实交' : '剩余应领', width: 170, render: line => modal?.mode === 'handover' ? `<label class="flex items-center gap-2"><input aria-label="${escapeHtml(line.materialName)}本次实交" class="h-10 w-24 rounded border px-2" inputmode="decimal" data-aw-pickup-qty="${escapeHtml(line.id)}" value="${escapeHtml(drafts.get(line.id) || '')}" ${line.handedQty >= line.requiredQty ? 'disabled' : ''}><span>${escapeHtml(line.unit)}</span></label>` : qty(Math.max(0, line.requiredQty - line.handedQty), line.unit) },
  ]
  return accessoryOverlay(modal.mode === 'handover' ? '登记车缝领料实交' : '车缝领料清单和历史', `<div class="space-y-4"><div class="flex items-center gap-3">${preparation ? accessoryImage(preparation.styleImageUrl, preparation.styleName) : ''}<div><strong>${escapeHtml(preparation?.productionOrderNo || '生产单待核对')}</strong><p>${escapeHtml(preparation?.styleName || '')}</p><p class="text-sm">${escapeHtml(warehouse().name)} → ${escapeHtml(pickup.factoryName)}</p></div></div>${modal.mode === 'handover' ? `<p class="text-sm">按实际交给三方车缝工厂的数量登记，可分次领取。确认后扣减本仓实物并形成同一任务的实交记录。</p><div class="rounded border bg-muted/30 p-3 text-sm"><b>领料凭证</b><p class="mt-1">${selectedVersion ? escapeHtml(getSewingPickupSlipVersion(selectedVersion)?.slipNo || '凭证待核对') + ' · ' + escapeHtml(getSewingPickupSlipVersion(selectedVersion)?.versionLabel || '版本待核对') : 'PPIC 尚未打印领料凭证，请先打印。'}</p>${selectedVersion && selectedVersion !== version?.versionId ? '<p class="mt-1 text-red-600">当前扫码版本已失效，请使用 PPIC 最新凭证。</p>' : ''}</div>` : ''}<div class="overflow-x-auto">${renderStandardListTable({ columns, rows: pickup.lines, preferences: { order: columns.map(row => row.key), visibleKeys: columns.map(row => row.key), frozenKeys: [], pageSize: pickup.lines.length }, sort: null, eventPrefix: prefix })}</div>${modal.mode === 'handover' ? `<label class="grid max-w-sm gap-1 text-sm">确认仓管<input class="h-10 rounded border px-3" data-aw-pickup-actor value="${escapeHtml(drafts.get('actor') || '')}"></label>` : ''}<p role="alert" class="whitespace-pre-wrap text-sm text-red-600" data-aw-pickup-error>${escapeHtml(error)}</p><section><h3 class="font-semibold">领料记录</h3>${pickup.history.length ? `<ol class="mt-2 space-y-2">${pickup.history.map(item => `<li class="rounded border p-3 text-sm"><b>${escapeHtml(item.action)}</b><p>${escapeHtml(item.detail)}</p><p class="text-xs text-muted-foreground">${escapeHtml(item.by)} · ${escapeHtml(item.at)}</p></li>`).join('')}</ol>` : '<p class="mt-2 text-sm text-muted-foreground">尚未交出辅料。</p>'}</section></div>`, modal.mode === 'handover' ? button(busy ? '正在保存…' : '确认本次实交', 'save', '', true, busy || role !== '仓管') : '', 'pickup-close')
}
function refresh(): void { const host = root()?.querySelector('[data-aw-pickup-workspace]'); if (host) host.innerHTML = workspace() }
function refreshModal(): void { const host = root()?.querySelector('[data-aw-pickup-modal]'); if (host) host.innerHTML = renderModal() }
function clear(): void { actionAt = ''; modal = null; drafts.clear(); dirty = false; error = ''; commandId = ''; root()?.querySelector('[data-aw-pickup-modal]')?.replaceChildren(); restoreAccessoryFocus() }
function close(): void { if (busy || dirty && !window.confirm('本次领料输入尚未保存。关闭将丢弃这些输入，是否关闭？')) return; clear() }
function open(id: string, mode: 'detail' | 'handover', versionId?: string): void { const pickup = getAccessorySewingPickup(id); if (!pickup) return; modal = { id, mode }; actionAt = ''; dirty = false; error = ''; commandId = ''; drafts = new Map([['actor', `${warehouse().name}仓管（演示）`], ['versionId', versionId || currentVersion(pickup)?.versionId || '']]); refreshModal(); focusAccessoryOverlay() }
function showError(value: unknown): void { error = value instanceof Error ? value.message : String(value); const node = root()?.querySelector('[data-aw-pickup-error]'); if (node) node.textContent = error; else { feedback = error; refresh() } }
async function save(): Promise<void> {
  if (busy || !modal || modal.mode !== 'handover') return
  const pickup = getAccessorySewingPickup(modal.id); if (!pickup) return
  try {
    commandId ||= crypto.randomUUID(); actionAt ||= new Date().toISOString()
    const entries = pickup.lines.filter(line => (drafts.get(line.id) || '').trim()).map(line => ({ lineId: line.id, qty: Number(drafts.get(line.id)) }))
    busy = true
    const controls = [...root()!.querySelectorAll<HTMLInputElement | HTMLButtonElement>('[data-aw-pickup-modal] input,[data-aw-pickup-modal] button')].map(node => ({ node, disabled: node.disabled })); controls.forEach(({ node }) => { node.disabled = true })
    try { await confirmAccessorySewingPickup({ pickupId: pickup.id, versionId: drafts.get('versionId') || '', entries, actor: { role: role === '仓管' ? '仓管' : 'PPIC', warehouseCode: warehouse().code, name: drafts.get('actor') || '' }, commandId, at: actionAt }); busy = false; feedback = '本次车缝领料已保存，任务实交和仓内库存已更新。'; clear(); refresh() }
    finally { controls.forEach(({ node, disabled }) => { node.disabled = disabled }) }
  } catch (value) { busy = false; showError(value) }
}
export function renderAccessorySewingPickupPage(warehouseKey: AccessoryWarehouseKey): string {
  if (mountedPath !== `${location.pathname}${location.search}`) { key = warehouseKey; mountedPath = `${location.pathname}${location.search}`; keyword = ''; queryDraft = ''; status = ''; statusDraft = ''; page = 1; modal = null; drafts.clear(); dirty = false; busy = false; feedback = ''; error = ''; actionAt = ''; commandId = '' }
  const params = new URLSearchParams(location.search), id = params.get('pickupId'), pickup = id ? getAccessorySewingPickup(id) : undefined
  if (pickup && pickup.warehouseCode === warehouse().code && !modal) { modal = { id: pickup.id, mode: 'handover' }; drafts = new Map([['actor', `${warehouse().name}仓管（演示）`], ['versionId', params.get('versionId') || currentVersion(pickup)?.versionId || '']]) }
  return `<div data-accessory-pickup-root data-skip-page-rerender="true"><div data-aw-pickup-workspace>${workspace()}</div><div data-aw-pickup-modal>${renderModal()}</div><div data-aw-pickup-image></div></div>`
}
export function handleAccessorySewingPickupEvent(target: HTMLElement, event?: Event): boolean {
  if (!root()) return false
  const input = target.closest<HTMLInputElement>('[data-aw-pickup-qty],[data-aw-pickup-version],[data-aw-pickup-actor]')
  if (input && ['input', 'change'].includes(event?.type || '')) { if (busy) return true; drafts.set(input.dataset.awPickupQty || (input.hasAttribute('data-aw-pickup-version') ? 'versionId' : 'actor'), input.value); dirty = true; commandId = ''; actionAt = ''; return true }
  const field = target.closest<HTMLInputElement | HTMLSelectElement>(`[data-${prefix}-field]`)
  if (field && ['input', 'change'].includes(event?.type || '')) { const name = field.dataset.accessoryPickupField; if (name === 'keyword') queryDraft = field.value; if (name === 'status') statusDraft = field.value; if (name === 'role') { role = field.value === 'PPIC' ? 'PPIC' : '仓管'; refresh() }; if (name === 'pageSize') { pageSize = Number(field.value) || 10; page = 1; refresh() }; return true }
  const image = target.closest<HTMLElement>('[data-accessory-action]')
  if (image && (!event || event.type === 'click')) { if (image.dataset.accessoryAction === 'pickup-close') { close(); return true }; if (image.dataset.accessoryAction === 'pickup-image-close') { root()?.querySelector('[data-aw-pickup-image]')?.replaceChildren(); restoreAccessoryFocus(); return true }; if (image.dataset.accessoryAction === 'image') { const host = root()?.querySelector('[data-aw-pickup-image]'); if (host) { host.innerHTML = accessoryOverlay(image.dataset.label || '图片', `<img class="mx-auto max-h-[70vh] max-w-full object-contain" src="${escapeHtml(image.dataset.image || '')}" alt="${escapeHtml(image.dataset.label || '')}" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><p hidden role="alert" class="p-3 text-sm text-red-600">图片加载失败，关闭后点击缩略图重试。</p>`, '', 'pickup-image-close'); focusAccessoryOverlay() }; return true } }
  const node = target.closest<HTMLElement>(`[data-${prefix}-action]`), action = node?.dataset.accessoryPickupAction
  if (!node || !action || event && event.type !== 'click') return false
  if (busy) return true
  if (action === 'query' || action === 'reset') { if (action === 'reset') { queryDraft = ''; statusDraft = '' }; keyword = queryDraft.trim(); status = statusDraft; page = 1; refresh(); return true }
  if (action === 'prev-page' || action === 'next-page') { page += action === 'next-page' ? 1 : -1; refresh(); return true }
  if (action === 'detail' || action === 'handover') { if (action === 'handover' && role !== '仓管') { feedback = 'PPIC 只能查看，须由本仓仓管确认实交。'; refresh() } else open(node.dataset.id || '', action); return true }
  if (action === 'save') { void save(); return true }
  if (action === 'create' || action === 'migrate') {
    if (role !== '仓管') return true
    busy = true; const id = crypto.randomUUID(), at = new Date().toISOString()
    const operation = action === 'create' ? createAccessorySewingPickups({ preparationId: node.dataset.id || '', commandId: id, at, actor: { role: '仓管', warehouseCode: warehouse().code, name: `${warehouse().name}仓管（演示）` } }) : migrateLegacySewingPickupSlips({ commandId: id, at, by: `${warehouse().name}仓管（演示）` })
    void operation.then(() => { busy = false; feedback = action === 'create' ? '已按有效车缝任务建立领料及后道清单。' : '原领料凭证和实交历史迁移完成。'; refresh() }).catch(value => { busy = false; showError(value) }); return true
  }
  return false
}
if (typeof document !== 'undefined') {
  document.addEventListener('keydown', event => { if (!root()) return; trapAccessoryOverlayFocus(event); if (event.key === 'Escape') { if (root()?.querySelector('[data-aw-pickup-image]')?.childElementCount) { root()?.querySelector('[data-aw-pickup-image]')?.replaceChildren(); restoreAccessoryFocus() } else close() } })
  window.addEventListener('beforeunload', event => { if (root() && (dirty || busy)) { event.preventDefault(); event.returnValue = '' } })
  document.addEventListener('click', event => { if (!root() || !dirty && !busy) return; const nav = event.target instanceof Element ? event.target.closest('[data-nav],[data-system],[data-system-id],[data-system-switch],a[href]') : null; if (nav && (busy || !window.confirm('本次领料输入尚未保存。离开将丢弃这些输入，是否离开？'))) { event.preventDefault(); event.stopImmediatePropagation() } else if (nav) clear() }, true)
  window.addEventListener('higood:before-history-navigation', event => { if (!root() || !dirty && !busy) return; if (busy || !window.confirm('本次领料输入尚未保存。离开将丢弃这些输入，是否离开？')) { event.preventDefault(); history.pushState(null, '', mountedPath) } else clear() })
}
