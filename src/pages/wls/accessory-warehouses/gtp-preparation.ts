// @page-pattern: list
import { renderStandardListPage, renderStandardListFilters, renderStandardListStats } from '../../../components/ui/list-page.ts'
import { renderStandardListTable, renderStandardListColumnSettings, type StandardListColumn } from '../../../components/ui/list-table.ts'
import { renderTablePagination } from '../../../components/ui/pagination.ts'
import { loadListColumnPreferences, saveListColumnPreferences, normalizeListColumnPreferences, paginateStandardListRows, sortStandardListRows, type StandardListColumnPreferences, type StandardListSortState } from '../../../components/ui/list-table-model.ts'
import { exportStandardListRows } from '../../../components/ui/list-export.ts'
import { showListFeedback } from '../../../components/ui/list-feedback.ts'
import { escapeHtml } from '../../../utils.ts'
import { listAccessoryPreparations, getAccessoryPreparation, prepareAccessoryWarehouseSources, listAccessoryWarehouseSourceIssues } from '../../../data/wls/accessory-warehouse-sources.ts'
import { registerAccessoryPreparation, completeAccessoryPreparation, getAccessoryLineAllocations, type AccessoryPreparation, type AccessoryTransfer } from '../../../data/wls/accessory-warehouse-flow.ts'
import { hydrateIcons } from '../../../components/shell.ts'
import { accessoryReceiptForTransfer } from '../../../data/wls/accessory-warehouse-commands.ts'
import { accessoryRecord, listAccessoryRecords, saveAccessoryWarehouseAction } from '../../../data/wls/accessory-warehouse-records.ts'
import { listAccessoryWarehouseLocations } from '../../../data/wls/accessory-warehouse-master.ts'
import { cuttingRecordUuid } from '../../../data/fcs/cutting/cutting-record-identity.ts'
import { reserveAccessoryPreparationStock, type AccessoryStock } from '../../../data/wls/accessory-warehouse-stock.ts'
import { listAccessoryStockSources, projectAccessoryPreparationAvailability } from '../../../data/wls/accessory-warehouse-stock-sources.ts'
import { accessoryButton as button, accessoryImage, accessoryOverlay, focusAccessoryOverlay, restoreAccessoryFocus, trapAccessoryOverlayFocus } from './shared.ts'

const PREFIX = 'accessory'
const PREFERENCE_KEY = '/wls/accessory-warehouses/gtp/preparation:list-columns'
const sizes = [10, 20, 50]
const state = { keyword: '', status: '', currentPage: 1, sort: null as StandardListSortState | null, preferences: null as StandardListColumnPreferences | null }
let modal: { type: 'prepare' | 'remark' | 'history' | 'complete' | 'print' | 'data'; id: string; version: number } | null = null
let dirty = false, busy = false, modalError = '', columnSettings = false
let mountedPath = '/wls/accessory-warehouses/gtp/preparation'
const drafts = new Map<string, string>()
let pending: Parameters<typeof saveAccessoryWarehouseAction>[0] | null = null
let backupFile: File | null = null
let maintenanceCommand: { commandId: string; operator: string; at: string } | null = null
let printingSource: HTMLElement | null = null
const qty = (value: number, unit: string) => `${Number(value).toLocaleString('zh-CN', { maximumFractionDigits: 6 })} ${escapeHtml(unit)}`
const visibleMaterialCode = (sku: string) => sku.includes('-bom-') || sku.startsWith('prep-line-') || sku.includes('::') ? '' : sku
const ownerRoot = () => document.querySelector('[data-accessory-preparation-root],[data-accessory-read-error]')

const columns: StandardListColumn<AccessoryPreparation>[] = [
  { key: 'order', title: '生产单 / 款式', width: 300, required: true, freezeable: true, sortable: true, sortValue: row => row.productionOrderNo, render: row => `<div class="flex items-center gap-3">${accessoryImage(row.styleImageUrl, row.styleName)}<div><strong>${escapeHtml(row.productionOrderNo)}</strong><p class="text-sm">${escapeHtml(row.styleName)}</p></div></div>` },
  { key: 'factory', title: '裁剪工厂', width: 160, sortable: true, sortValue: row => row.cuttingFactoryName || '', render: row => escapeHtml(row.cuttingFactoryName || '待分配') },
  { key: 'status', title: '配料状态', width: 100, sortable: true, sortValue: row => row.status, render: row => `<span class="rounded px-2 py-1 text-xs ${row.status === '已配齐' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-800'}">${row.status}</span>` },
  { key: 'quantity', title: '辅料进度', width: 220, render: row => [...new Set(row.lines.map(line => line.unit))].map(unit => { const lines = row.lines.filter(line => line.unit === unit); return `已配 ${qty(lines.reduce((sum, line) => sum + line.preparedQty, 0), unit)} / 应配 ${qty(lines.reduce((sum, line) => sum + line.requiredQty, 0), unit)}` }).join('<br>') },
  { key: 'remark', title: '备注', width: 180, render: row => escapeHtml(row.remark || '—') },
  { key: 'actions', title: '操作', width: 290, required: true, actionColumn: true, render: row => `<div class="flex flex-wrap gap-1">${button(row.status === '已配齐' ? '查看配料' : '登记配料', 'prepare', row.id)}${button('记录', 'history', row.id)}${button('备注', 'remark', row.id)}${button('配料凭证', 'print', row.id)}${row.status !== '已配齐' ? button('完成配齐', 'complete', row.id, true) : ''}</div>` },
]
const rules = columns.map(column => ({ key: column.key, required: column.required, freezeable: column.freezeable, actionColumn: column.actionColumn }))
function preferences(): StandardListColumnPreferences {
  if (state.preferences) return state.preferences
  const defaults = normalizeListColumnPreferences(rules, { order: columns.map(column => column.key), visibleKeys: columns.map(column => column.key), frozenKeys: [], pageSize: 10 }, sizes)
  try { state.preferences = loadListColumnPreferences(window.localStorage, PREFERENCE_KEY, rules, defaults, sizes) } catch { state.preferences = defaults }
  return state.preferences
}
function persistPreferences(): void { try { saveListColumnPreferences(window.localStorage, PREFERENCE_KEY, preferences()) } catch { /* 偏好失败不影响业务保存。 */ } }
function filteredRows(): AccessoryPreparation[] {
  const keyword = state.keyword.toLowerCase().trim()
  return listAccessoryPreparations().filter(row => (!state.status || row.status === state.status) && (!keyword || [row.productionOrderNo, row.styleName, row.cuttingFactoryName, ...row.lines.map(line => line.materialName)].join(' ').toLowerCase().includes(keyword)))
}
function workspace(): string {
  const rows = sortStandardListRows(filteredRows(), state.sort, (row, key) => columns.find(column => column.key === key)?.sortValue?.(row))
  const pref = preferences(), page = paginateStandardListRows(rows, state.currentPage, pref.pageSize)
  state.currentPage = page.currentPage
  const rowIds = new Set(rows.map(row => row.id))
  const issues = listAccessoryWarehouseSourceIssues().filter(issue => rowIds.has(issue.preparationId))
  return renderStandardListPage({
    title: '辅料中央仓（GTP） · 车缝配料',
    primaryActionsHtml: button('本机资料', 'data'),
    filtersHtml: renderStandardListFilters({ actionPrefix: PREFIX, fieldsHtml: `<label class="grid gap-1 text-sm">生产单 / 款式 / 物料<input class="h-9 rounded border px-3" data-accessory-field="keyword" value="${escapeHtml(state.keyword)}"></label><label class="grid gap-1 text-sm">配料状态<select class="h-9 rounded border px-3" data-accessory-field="status"><option value="">全部</option>${['待配料', '配料中', '已配齐'].map(value => `<option ${state.status === value ? 'selected' : ''}>${value}</option>`).join('')}</select></label>` }),
    feedbackHtml: issues.length ? `<div class="rounded border border-amber-200 bg-amber-50 p-3 text-sm" role="status">查询范围内有 ${new Set(issues.map(issue => issue.preparationId)).size} 张生产单的来源需核对，打开配料明细可查看原因。</div>` : '',
    statsHtml: renderStandardListStats([{ label: '生产单', value: rows.length }, { label: '待配齐', value: rows.filter(row => row.status !== '已配齐').length }, { label: '已配齐', value: rows.filter(row => row.status === '已配齐').length }]),
    listTitle: '生产单辅料', listActionsHtml: button('导出查询结果', 'export') + button('列设置', 'open-column-settings'),
    tableHtml: renderStandardListTable({ columns, rows: page.rows, preferences: pref, sort: state.sort, eventPrefix: PREFIX, skipPageRerender: true }),
    paginationHtml: renderTablePagination({ ...page, actionPrefix: PREFIX, pageSizeOptions: sizes, skipPageRerender: true }),
  })
}
export function renderGtpPreparationPage(): string {
  state.currentPage = 1; state.sort = null
  if (typeof window !== 'undefined') mountedPath = window.location.pathname + window.location.search
  return `<div data-accessory-preparation-root data-skip-page-rerender="true"><div data-aw-workspace>${workspace()}</div><div data-aw-overlay-host></div></div>`
}
function refreshWorkspace(): void { const node = document.querySelector('[data-aw-workspace]'); if (node) node.innerHTML = workspace() }
function refreshColumnSettings(): void {
  const host = document.querySelector<HTMLElement>('[data-aw-overlay-host]')
  if (!host) return
  host.innerHTML = columnSettings ? renderStandardListColumnSettings({ title: '配料列表列设置', columns, preferences: preferences(), eventPrefix: PREFIX, maxFrozenWidth: 400 }) : ''
  hydrateIcons(host)
}
function errorHtml(): string { return `<p class="mb-3 text-sm text-red-600" role="alert" data-aw-modal-error>${escapeHtml(modalError)}</p>` }
function lineTable(preparation: AccessoryPreparation, editable: boolean): string {
  const locations = listAccessoryWarehouseLocations('WH-FITTING-001').filter(location => location.enabled)
  return `<div class="overflow-x-auto"><table class="w-full text-left text-sm"><thead><tr class="border-b"><th class="p-2">物料</th><th class="p-2">应配 / 已配 / 待配</th><th class="p-2">可用</th><th class="p-2">本次配料</th><th class="p-2">来源库位</th></tr></thead><tbody>${preparation.lines.map(line => `<tr class="border-b"><td class="p-2"><div class="flex items-center gap-2">${accessoryImage(line.imageUrl, line.materialName)}<div>${escapeHtml(line.materialName)}<p class="text-xs text-muted-foreground">${visibleMaterialCode(line.materialSku) ? escapeHtml(visibleMaterialCode(line.materialSku)) + " · " : ""}${escapeHtml(line.color)} ${escapeHtml(line.spec)}</p></div></div></td><td class="p-2">${qty(line.requiredQty, line.unit)}<br>${qty(line.preparedQty, line.unit)}<br>${qty(Math.max(0, line.requiredQty - line.preparedQty), line.unit)}</td><td class="p-2" data-aw-available="${escapeHtml(line.id)}">${qty(line.availableQty, line.unit)}</td><td class="p-2">${editable ? `<input class="h-9 w-24 rounded border px-2" type="number" min="0" step="any" aria-label="${escapeHtml(line.materialName)}本次配料" data-aw-qty="${escapeHtml(line.id)}" value="${escapeHtml(drafts.get(line.id) || '')}">` : '—'}</td><td class="p-2">${editable ? `<select class="h-9 max-w-40 rounded border px-2" aria-label="${escapeHtml(line.materialName)}来源库位" data-aw-location="${escapeHtml(line.id)}"><option value="">选择库位</option>${locations.map(location => `<option value="${escapeHtml(location.id)}" ${(drafts.get(`location:${line.id}`) || line.locationId) === location.id ? 'selected' : ''}>${escapeHtml(location.locationCode)}</option>`).join('')}</select>` : getAccessoryLineAllocations(line).map(allocation => `${escapeHtml(locations.find(location => location.id === allocation.locationId)?.locationCode || allocation.locationId)}：${qty(allocation.qty, line.unit)}`).join('<br>') || '未登记'}</td></tr>`).join('')}</tbody></table></div>`
}
function renderModal(): void {
  const host = document.querySelector('[data-aw-overlay-host]'); if (!host) return
  if (!modal) { host.innerHTML = ''; return }
  if (modal.type === 'data') { void renderDataModal().catch(showError); return }
  const row = getAccessoryPreparation(modal.id)
  if (!row) { modalError = '配料来源已变化，请重新读取。'; host.innerHTML = accessoryOverlay('配料来源变化', errorHtml()); return }
  const identification = `<p class="mb-4 font-medium">${escapeHtml(row.productionOrderNo)} · ${escapeHtml(row.styleName)}</p>`
  const issues = listAccessoryWarehouseSourceIssues(row.id)
  const sourceWarning = issues.length ? `<div class="mb-3 rounded border border-amber-200 bg-amber-50 p-3 text-sm">${issues.map(issue => `<p>${escapeHtml(issue.message)}</p>`).join('')}</div>` : ''
  let content = '', footer = ''
  if (modal.type === 'prepare') { content = lineTable(row, row.status !== '已配齐'); if (row.status !== '已配齐') footer = button('保存本次配料', 'save-preparation', row.id, true) }
  if (modal.type === 'remark') { content = `<label class="grid gap-2">配料备注<textarea class="min-h-28 w-full rounded border p-3" data-aw-remark>${escapeHtml(drafts.get('remark') ?? row.remark)}</textarea></label>`; footer = button('保存备注', 'save-remark', row.id, true) }
  if (modal.type === 'history') content = row.history.length ? `<ol class="space-y-3">${row.history.map(item => `<li class="rounded border p-3"><strong>${escapeHtml(item.action)}</strong><p>${escapeHtml(item.detail)}</p><p class="text-xs text-muted-foreground">${escapeHtml(item.by)} · ${escapeHtml(item.at)}</p></li>`).join('')}</ol>` : '<p>尚无本轮操作记录。</p>'
  if (modal.type === 'complete') { content = `<p class="mb-3">逐行确认已配齐后，将为本生产单建立整单调拨。裁剪工厂待定时，调入方保持待定。</p>${lineTable(row, false)}`; footer = button('确认配齐并建立调拨', 'save-complete', row.id, true) }
  if (modal.type === 'print') { content = `<div data-aw-print>${identification}${lineTable(row, false)}<p class="mt-3 text-xs">配料版本 ${row.version} · ${escapeHtml(row.techPackVersion)}</p></div>`; footer = button('打印配料凭证', 'print-now') }
  const actor = ['prepare', 'remark', 'complete'].includes(modal.type) ? `<label class="mt-4 grid gap-1 text-sm">操作人<input class="h-9 rounded border px-3" data-aw-actor value="${escapeHtml(drafts.get('actor') || 'GTP仓管（演示）')}"></label>` : ''
  host.innerHTML = accessoryOverlay({ prepare: '登记配料', remark: '配料备注', history: '配料记录', complete: '完成配齐', print: '配料凭证' }[modal.type], errorHtml() + identification + sourceWarning + content + actor, footer)
  focusAccessoryOverlay()
}
function closeModal(): void {
  if (busy) return
  if (dirty && !window.confirm('本次配料输入尚未保存。关闭窗口将丢弃这些输入，是否关闭？')) return
  modal = null; dirty = false; modalError = ''; pending = null; drafts.clear(); backupFile = null; maintenanceCommand = null
  const host = document.querySelector('[data-aw-overlay-host]'); if (host) host.innerHTML = ''
  restoreAccessoryFocus()
}
function showError(error: unknown): void {
  modalError = error instanceof Error ? error.message : String(error)
  const target = document.querySelector('[data-aw-modal-error]'); if (target) target.textContent = modalError
  else showListFeedback(modalError, 'danger')
}
function clearPrintDocument(): void { document.querySelector('[data-aw-print-document]')?.remove() }
function buildPrintDocument(): void {
  clearPrintDocument()
  const source = document.querySelector<HTMLElement>('[data-aw-print]')
  if (!source) return
  // 独立打印节点脱离弹窗的固定高度和滚动裁切；不改变准备单或登记状态。
  const print = document.createElement('section')
  print.dataset.awPrintDocument = 'true'
  print.innerHTML = `<style>[data-aw-print-document]{display:none}@media print{
    body>*:not([data-aw-print-document]){display:none!important}
    body>[data-aw-print-document]{display:block!important;position:static!important;width:100%;height:auto;overflow:visible;color:#111;background:white}
    [data-aw-print-document] *{visibility:visible!important;max-height:none!important;overflow:visible!important}
    [data-aw-print-document] table{width:100%;table-layout:fixed;border-collapse:collapse}
    [data-aw-print-document] th,[data-aw-print-document] td{padding:6px;font-size:10px;overflow-wrap:anywhere;vertical-align:top}
    [data-aw-print-document] tr{break-inside:avoid}[data-aw-print-document] thead{display:table-header-group}
    [data-aw-print-document] img{width:40px;height:40px;object-fit:contain}
  }</style>${source.innerHTML}`
  print.querySelectorAll('img').forEach(image => { image.loading = 'eager' })
  document.body.appendChild(print)
}
async function printPreparation(): Promise<void> {
  const source = document.querySelector<HTMLElement>('[data-aw-print]'), currentModal = modal
  if (!source || printingSource === source) return
  printingSource = source
  const pathname = window.location.pathname + window.location.search
  const current = () => source.isConnected && document.querySelector('[data-aw-print]') === source
    && modal === currentModal && modal?.type === 'print' && window.location.pathname + window.location.search === pathname
  try {
    await Promise.all(Array.from(source.querySelectorAll('img')).map(image => image.decode()))
    await document.fonts.ready
    if (!current()) return
    window.print()
  } catch { if (current()) showError(new Error('配料凭证图片未能加载，关闭后重新打开凭证再打印。')) }
  finally { if (printingSource === source) printingSource = null }
}
async function renderDataModal(): Promise<void> {
  const host = document.querySelector('[data-aw-overlay-host]'); if (!host || modal?.type !== 'data') return
  const hadDialog = Boolean(host.querySelector('[role="dialog"]'))
  const module = await import('../../../data/wls/accessory-warehouse-migration.ts')
  const status = await module.inspectLegacyAccessoryMigration()
  let pendingTransferCount = 0
  try {
    const transfers = listAccessoryRecords<AccessoryTransfer>('transfer')
    pendingTransferCount = listAccessoryRecords<AccessoryPreparation>('preparation').filter(row => row.status === '已配齐' && !transfers.some(transfer => transfer.kind === 'GTP_TO_SITE' && transfer.preparationId === row.id)).length
  } catch { /* 读取失败时保留原资料备份入口，不把未知记录当作已切换。 */ }
  if (modal?.type !== 'data') return
  host.innerHTML = accessoryOverlay('辅料仓本机资料', `${errorHtml()}<div class="space-y-5"><section class="rounded border p-3"><h3 class="font-semibold">原配料资料：${escapeHtml(status.state)}</h3><p class="mt-2 text-sm">涉及 ${status.affectedPreparationIds.length} 张生产单、${status.affectedEntryCount} 条原记录；已复制 ${status.copiedCount} 条。</p>${status.issues.map(issue => `<p class="mt-2 text-sm text-red-600">${escapeHtml(issue)}</p>`).join('')}<p class="mt-2 text-sm">迁移会保留原配料数量与历史，核对新资料后再移出对应旧明细，其他工艺及共用资料保留。</p><label class="mt-3 grid gap-1 text-sm">操作人<input class="h-9 rounded border px-3" data-aw-actor value="${escapeHtml(drafts.get('actor') || 'GTP仓管（演示）')}"></label><div class="mt-3">${['待迁移', '待清理'].includes(status.state) ? button('迁移并切换原配料资料', 'migrate-data', '', true) : ''}</div></section><section class="rounded border p-3">${pendingTransferCount ? `<div class="mb-4 rounded border p-3"><h3 class="font-semibold">历史已配齐调拨切换</h3><p class="my-2 text-sm">${pendingTransferCount} 张已保存配齐记录尚无首次调拨，补建保留原配齐时间、数量及来源库位。</p>${button('核对并补建已配齐调拨', 'transfer-cutover', '', true)}</div>` : ''}<h3 class="font-semibold">备份与恢复</h3><p class="mt-2 text-sm">备份包含本范围记录、必要附件与原资料引用。恢复仅用于空白本机演示环境；已有资料时整批拒绝，不覆盖现有资料。</p><div class="mt-3 flex flex-wrap gap-2">${button('导出辅料仓备份', 'export-backup')}<label class="rounded border px-3 py-2 text-sm">选择备份<input class="ml-2 max-w-full" type="file" accept="application/json,.json" data-aw-backup></label></div>${backupFile ? `<p class="mt-2 break-all text-sm">已选择：${escapeHtml(backupFile.name)}</p><div class="mt-3">${button('恢复本范围资料', 'restore-backup', '', true)}</div>` : ''}</section></div>`)
  if (!hadDialog) focusAccessoryOverlay()
  else host.querySelector<HTMLElement>('[role="dialog"]')?.focus()
}
async function runMaintenance(action: string): Promise<void> {
  if (busy || modal?.type !== 'data') return
  busy = true
  const controls = [...document.querySelectorAll<HTMLButtonElement | HTMLInputElement>('[data-aw-overlay] button,[data-aw-overlay] input')].map(node => ({ node, disabled: node.disabled }))
  controls.forEach(({ node }) => { node.disabled = true })
  try {
    const module = await import('../../../data/wls/accessory-warehouse-migration.ts')
    if (action === 'transfer-cutover') {
      const status = await module.inspectLegacyAccessoryMigration()
      if (['待迁移', '待清理', '已阻塞'].includes(status.state)) throw new Error('先完成原配料资料迁移及冲突核对，再补建已配齐调拨。')
      maintenanceCommand ||= { commandId: `ACCESSORY-CUTOVER:${cuttingRecordUuid()}`, operator: drafts.get('actor') || 'GTP仓管（演示）', at: new Date().toISOString() }
      const cutover = await import('../../../data/wls/accessory-warehouse-transfer-cutover.ts')
      const created = await cutover.migrateCompletedAccessoryPreparationTransfers(maintenanceCommand)
      await prepareAccessoryWarehouseSources(); refreshWorkspace(); maintenanceCommand = null
      showListFeedback(`已核对历史配齐记录，补建 ${created.length} 张调拨；原配齐时间和数量保留。`)
    } else if (action === 'migrate-data') {
      maintenanceCommand ||= { commandId: `ACCESSORY-MIGRATE:${cuttingRecordUuid()}`, operator: drafts.get('actor') || 'GTP仓管（演示）', at: new Date().toISOString() }
      const result = await module.migrateLegacyAccessoryPreparation(maintenanceCommand)
      if (result.state !== '已完成' && result.state !== '无需迁移') throw new Error(`原资料${result.state}，请保留资料并继续核对。`)
      await prepareAccessoryWarehouseSources(); refreshWorkspace(); dirty = false; maintenanceCommand = null
      showListFeedback('原配料资料已迁移并核对。')
    } else if (action === 'export-backup') {
      const backup = await module.exportAccessoryWarehouseBackup(), blob = await module.encodeAccessoryWarehouseBackup(backup)
      const url = URL.createObjectURL(blob), link = document.createElement('a')
      link.href = url; link.download = `辅料仓备份-${new Date().toISOString().slice(0, 10)}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 0)
      showListFeedback('辅料仓备份已导出。')
    } else {
      if (!backupFile) throw new Error('先选择需要恢复的备份文件。')
      const backup = await module.parseAccessoryWarehouseBackup(backupFile)
      await module.restoreAccessoryWarehouseBackup(backup)
      await prepareAccessoryWarehouseSources(); refreshWorkspace(); backupFile = null; dirty = false
      showListFeedback('辅料仓资料已恢复并重新读取。')
    }
    modalError = ''
  } catch (error) { showError(error) }
  finally { busy = false; controls.forEach(({ node, disabled }) => { node.disabled = disabled }); if (modal?.type === 'data') await renderDataModal().catch(showError) }
}
function actionInput(row: AccessoryPreparation, action: string): Parameters<typeof saveAccessoryWarehouseAction>[0] {
  const issues = listAccessoryWarehouseSourceIssues(row.id).filter(issue => issue.blocking)
  if (issues.length) throw new Error(issues.map(issue => issue.message).join('；'))
  if (row.version !== modal?.version) throw new Error('配料记录已变化，请关闭并重新读取。')
  const at = new Date().toISOString(), by = (drafts.get('actor') || 'GTP仓管（演示）').trim()
  if (!by) throw new Error('填写实际操作人。')
  const commandId = `ACCESSORY-UI:${cuttingRecordUuid()}`
  const stocks = listAccessoryStockSources(listAccessoryRecords<AccessoryStock>('stock'))
  let stockChanges: AccessoryStock[] = []
  let next = row, transfer: AccessoryTransfer | undefined
  if (action === 'save-preparation') {
    const entries = row.lines.filter(line => Number(drafts.get(line.id) || 0) !== 0).map(line => ({ lineId: line.id, qty: Number(drafts.get(line.id)), locationId: drafts.get(`location:${line.id}`) || line.locationId }))
    const locations = new Set(listAccessoryWarehouseLocations('WH-FITTING-001').filter(location => location.enabled).map(location => location.id))
    if (entries.some(entry => !locations.has(entry.locationId))) throw new Error('选择辅料中央仓启用的来源库位。')
    const scoped = projectAccessoryPreparationAvailability(row, stocks, { locationByLine: Object.fromEntries(entries.map(entry => [entry.lineId, entry.locationId])) })
    next = registerAccessoryPreparation(scoped, entries, { at, by })
    stockChanges = reserveAccessoryPreparationStock(stocks, row, entries, { operationId: commandId, expectedVersions: Object.fromEntries(stocks.map(stock => [stock.id, stock.version])) }).changed
    if (next.lines.every(line => Math.abs(line.requiredQty - line.preparedQty) <= 0.000001)) {
      const completed = completeAccessoryPreparation(next, { transferId: `GTP-${row.productionOrderNo}-${next.version}`, at, by })
      next = completed.preparation; transfer = completed.transfer
    }
  } else if (action === 'save-remark') {
    next = { ...row, remark: drafts.get('remark') ?? row.remark, version: row.version + 1, history: [...row.history, { at, by, action: '修改备注', detail: drafts.get('remark') ?? row.remark }] }
  } else {
    const existing = listAccessoryRecords<AccessoryTransfer>('transfer').find(item => item.kind === 'GTP_TO_SITE' && item.preparationId === row.id)
    const completed = completeAccessoryPreparation(row, { transferId: `GTP-${row.productionOrderNo}-${row.version}`, at, by }, existing)
    next = completed.preparation; transfer = completed.transfer
  }
  const receipt = transfer ? accessoryReceiptForTransfer(transfer) : undefined
  return {
    commandId, intent: `${action}:${row.id}:${row.version}`, result: next,
    change: { puts: [accessoryRecord('preparation', next.id, next), ...stockChanges.map(stock => accessoryRecord('stock', stock.id, stock)), ...(transfer ? [accessoryRecord('transfer', transfer.id, transfer)] : []), ...(receipt ? [accessoryRecord('receipt', receipt.id, receipt)] : [])] },
    assertSourcesCurrent: () => {
      const current = getAccessoryPreparation(row.id)
      if (!current || current.version !== row.version || listAccessoryWarehouseSourceIssues(row.id).some(issue => issue.blocking)) throw new Error('配料来源或记录版本已变化，请重新核对。本次输入尚未保存。')
    },
  }
}
async function save(action: string): Promise<void> {
  if (busy || !modal) return
  const controls: Array<{ node: HTMLButtonElement | HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement; disabled: boolean }> = []
  try {
    busy = true
    document.querySelectorAll<HTMLButtonElement | HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('[data-aw-overlay] button,[data-aw-overlay] input,[data-aw-overlay] textarea,[data-aw-overlay] select').forEach(node => { controls.push({ node, disabled: node.disabled }); node.disabled = true })
    const legacy = await (await import('../../../data/wls/accessory-warehouse-migration.ts')).inspectLegacyAccessoryMigration()
    if (['待迁移', '待清理', '已阻塞'].includes(legacy.state) && legacy.affectedPreparationIds.includes(modal.id)) throw new Error(legacy.state === '已阻塞'
      ? '这张生产单存在原资料冲突。停止旧页面写入，并在“本机资料”导出冲突备份后核对；原资料和本次输入均已保留。'
      : '这张生产单有待迁移的原配料资料，请先完成旧资料迁移，再办理新配料。原资料和本次输入均已保留。')
    const row = getAccessoryPreparation(modal.id); if (!row) throw new Error('配料来源已不存在。')
    pending ||= actionInput(row, action)
    await saveAccessoryWarehouseAction(pending)
    dirty = false; busy = false; closeModal(); refreshWorkspace(); showListFeedback(action === 'save-complete' ? '已配齐，整单调拨已建立。' : '已保存。')
  } catch (error) { busy = false; showError(error) }
  finally { controls.forEach(({ node, disabled }) => { node.disabled = disabled }) }
}
export function handleGtpPreparationEvent(target: HTMLElement, event?: Event): boolean {
  const root = ownerRoot()
  if (!root && !target.closest('[data-accessory-action="reload"]')) return false
  const backupInput = target.closest<HTMLInputElement>('[data-aw-backup]')
  if (backupInput && event?.type === 'change') { backupFile = backupInput.files?.[0] || null; dirty = Boolean(backupFile); void renderDataModal().catch(showError); return true }
  const drag = event as (DragEvent & { higoodStandardListColumnDrag?: boolean; higoodStandardListColumnKey?: string }) | undefined
  if (drag?.higoodStandardListColumnDrag && columnSettings) {
    if (drag.type === 'drop') {
      const from = drag.higoodStandardListColumnKey || '', to = target.closest<HTMLElement>('[data-standard-list-column-drag]')?.dataset.dropTarget || ''
      const pref = preferences(), movable = columns.filter(column => !column.actionColumn).map(column => column.key)
      if (from !== to && movable.includes(from) && movable.includes(to)) {
        const order = pref.order.filter(key => key !== from)
        order.splice(order.indexOf(to), 0, from)
        state.preferences = normalizeListColumnPreferences(rules, { ...pref, order }, sizes)
        persistPreferences(); refreshWorkspace(); refreshColumnSettings()
      }
    }
    return true
  }
  const input = target.closest<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('[data-aw-qty],[data-aw-location],[data-aw-remark],[data-aw-actor]')
  if (input && (event?.type === 'input' || event?.type === 'change')) {
    const key = input.dataset.awQty || (input.dataset.awLocation ? `location:${input.dataset.awLocation}` : input.hasAttribute('data-aw-remark') ? 'remark' : 'actor')
    drafts.set(key, input.value); dirty = true; pending = null
    if (input.dataset.awLocation && modal) {
      const preparation = getAccessoryPreparation(modal.id), lineId = input.dataset.awLocation
      if (preparation) {
        const projected = projectAccessoryPreparationAvailability(preparation, listAccessoryStockSources(listAccessoryRecords<AccessoryStock>('stock')), { locationByLine: { [lineId]: input.value } })
        const line = projected.lines.find(line => line.id === lineId), cell = document.querySelector(`[data-aw-available="${CSS.escape(lineId)}"]`)
        if (line && cell) cell.innerHTML = qty(line.availableQty, line.unit)
      }
    }
    return true
  }
  const field = target.closest<HTMLInputElement | HTMLSelectElement>('[data-accessory-field]')
  if (field) {
    if (field.dataset.accessoryField === 'keyword') state.keyword = field.value
    if (field.dataset.accessoryField === 'status') state.status = field.value
    if (field.dataset.accessoryField === 'pageSize' && event?.type === 'change') { preferences().pageSize = sizes.includes(Number(field.value)) ? Number(field.value) : 10; state.currentPage = 1; persistPreferences(); refreshWorkspace() }
    return true
  }
  const node = target.closest<HTMLElement>('[data-accessory-action]'), action = node?.dataset.accessoryAction
  if (!node || !action || event?.type === 'input') return false
  if (event?.type === 'change' && !['toggle-column-visibility', 'toggle-column-freeze'].includes(action)) return true
  if (action === 'reload') { void prepareAccessoryWarehouseSources().then(() => window.dispatchEvent(new PopStateEvent('popstate'))).catch(showError); return true }
  if (action === 'query' || action === 'reset') { if (action === 'reset') { state.keyword = ''; state.status = '' }; state.currentPage = 1; refreshWorkspace(); return true }
  if (action === 'prev-page' || action === 'next-page') { state.currentPage += action === 'next-page' ? 1 : -1; refreshWorkspace(); return true }
  if (action === 'export') { exportStandardListRows({ fileName: 'GTP车缝配料', columns, rows: filteredRows() }); return true }
  if (action === 'sort-column') { const key = node.dataset.columnKey || ''; state.sort = state.sort?.key !== key ? { key, direction: 'asc' } : state.sort.direction === 'asc' ? { key, direction: 'desc' } : null; refreshWorkspace(); return true }
  if (action === 'open-column-settings' || action === 'close-column-settings') {
    columnSettings = action === 'open-column-settings'; refreshColumnSettings(); return true
  }
  if (action === 'restore-column-settings') { state.preferences = normalizeListColumnPreferences(rules, { order: columns.map(column => column.key), visibleKeys: columns.map(column => column.key), frozenKeys: [], pageSize: 10 }, sizes); persistPreferences(); refreshWorkspace(); refreshColumnSettings(); return true }
  if (action === 'toggle-column-visibility' || action === 'toggle-column-freeze') {
    // checkbox 一次物理操作会产生 click/input/change；仅以 change 后的选中值保存。
    if (event?.type !== 'change' || !(node instanceof HTMLInputElement)) return true
    const key = node.dataset.accessoryColumnKey || node.closest<HTMLElement>('[data-accessory-column-key]')?.dataset.accessoryColumnKey || '', pref = preferences(), column = columns.find(item => item.key === key)
    if (column && !column.actionColumn) { const list = action === 'toggle-column-visibility' ? pref.visibleKeys : pref.frozenKeys; if ((action === 'toggle-column-visibility' && !column.required) || (action === 'toggle-column-freeze' && column.freezeable)) { const index = list.indexOf(key); if (!node.checked && index >= 0) list.splice(index, 1); else if (node.checked && index < 0) list.push(key) }; state.preferences = normalizeListColumnPreferences(rules, pref, sizes); persistPreferences(); refreshWorkspace(); refreshColumnSettings(); document.querySelector<HTMLElement>(`[data-aw-overlay-host] [data-accessory-column-key="${CSS.escape(key)}"] [data-accessory-action="${action}"]`)?.focus() }; return true
  }
  if (action === 'close') { closeModal(); return true }
  if (action === 'close-image') { document.querySelector('[data-aw-image]')?.remove(); restoreAccessoryFocus(); return true }
  if (action === 'image') { const host = document.querySelector('[data-aw-overlay-host]'); if (host) { const imageHost = document.createElement('div'); imageHost.dataset.awImage = 'true'; imageHost.innerHTML = accessoryOverlay(node.dataset.label || '图片', `<img class="mx-auto max-h-[70vh] max-w-full object-contain" src="${escapeHtml(node.dataset.image || '')}" alt="${escapeHtml(node.dataset.label || '')}" onerror="this.nextElementSibling.hidden=false"><p hidden class="mt-2 text-sm text-red-600">图片加载失败，关闭后点击缩略图重试。</p>`, '', 'close-image'); host.appendChild(imageHost); focusAccessoryOverlay() }; return true }
  if (action === 'print-now') { void printPreparation(); return true }
  if (['migrate-data', 'transfer-cutover', 'export-backup', 'restore-backup'].includes(action)) { void runMaintenance(action); return true }
  if (action === 'data') { modal = { type: 'data', id: '', version: 0 }; dirty = false; modalError = ''; drafts.clear(); void renderDataModal().catch(showError); return true }
  if (action.startsWith('save-')) { void save(action); return true }
  if (['prepare', 'remark', 'history', 'complete', 'print'].includes(action)) {
    const row = getAccessoryPreparation(node.dataset.id || ''); if (!row) return true
    modal = { type: action as NonNullable<typeof modal>['type'], id: row.id, version: row.version }; dirty = false; drafts.clear(); pending = null; modalError = ''; renderModal(); return true
  }
  return false
}
if (typeof document !== 'undefined') {
  window.addEventListener('beforeprint', buildPrintDocument)
  window.addEventListener('afterprint', clearPrintDocument)
  document.addEventListener('keydown', event => { if (!ownerRoot()) return; trapAccessoryOverlayFocus(event); if (event.key === 'Escape') { if (document.querySelector('[data-aw-image]')) { document.querySelector('[data-aw-image]')?.remove(); restoreAccessoryFocus() } else closeModal() } })
  window.addEventListener('beforeunload', event => { if (dirty || busy) { event.preventDefault(); event.returnValue = '' } })
  window.addEventListener('higood:before-history-navigation', event => {
    if (!ownerRoot() || (!dirty && !busy)) return
    if (busy || !window.confirm('本次配料输入尚未保存。离开页面将丢弃这些输入，是否离开？')) {
      event.preventDefault(); window.history.pushState(null, '', mountedPath)
    } else { modal = null; dirty = false; drafts.clear(); pending = null }
  })
  document.addEventListener('click', event => {
    if ((!dirty && !busy) || !ownerRoot()) return
    const target = event.target instanceof Element ? event.target.closest('[data-nav],[data-system],[data-system-id],[data-system-switch],a[href]') : null
    if (target && (busy || !window.confirm('本次配料输入尚未保存。离开页面将丢弃这些输入，是否离开？'))) { event.preventDefault(); event.stopImmediatePropagation() }
    else if (target) { modal = null; dirty = false; drafts.clear(); pending = null }
  }, true)
}
