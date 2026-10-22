// @page-pattern: list
import type { AppState } from '../../../state/store.ts'
import { escapeHtml as e } from '../../../utils.ts'
import { hydrateIcons } from '../../../components/shell.ts'
import { renderStandardListPage, renderStandardListStats } from '../../../components/ui/list-page.ts'
import { renderStandardListTable, renderStandardListColumnSettings, type StandardListColumn } from '../../../components/ui/list-table.ts'
import { loadListColumnPreferences, saveListColumnPreferences, normalizeListColumnPreferences, paginateStandardListRows, sortStandardListRows, type StandardListColumnPreferences, type StandardListSortState } from '../../../components/ui/list-table-model.ts'
import { renderTablePagination } from '../../../components/ui/pagination.ts'
import { ensureFinishedInventoryRecords, getFinishedInventoryStorageFailure, isFinishedInventoryReady } from '../../../data/wls/finished-inventory-records.ts'
import { FINISHED_INVENTORY_LOCATIONS } from '../../../data/wls/finished-inventory-quality-seed.ts'
import { listFinishedInventoryApplications, listFinishedInventoryLots, getFinishedInventoryApplication, listFinishedInventoryTransfers, listFinishedInventoryDifferences,
  previewFinishedInventoryQuality, createFinishedInventoryQualityApplication, receiveFinishedInventoryQualityApplication, runFinishedInventoryCommand,
  shipFinishedInventoryTransfer, receiveFinishedInventoryTransfer, putawayFinishedInventoryTransfer, resolveFinishedInventoryDifference,
  finishedInventoryApplicationStatus, finishedInventoryTransferStatus } from '../../../data/wls/finished-inventory-quality.ts'
import type { FinishedInventoryApplication, FinishedInventoryEligibility, FinishedInventoryTransfer } from '../../../data/wls/finished-inventory-quality-types.ts'

const PREFIX = 'fiq', PATH = '/wls/finished/inventory-quality', PREFERENCE_KEY = `${PATH}:columns-v1`
const action = (value: string) => `data-fiq-action="${value}" data-skip-page-rerender="true"`
const url = (id: string) => `${PATH}?id=${encodeURIComponent(id)}`
const control = 'min-h-10 rounded border bg-white px-3 text-sm'
const state = { keyword: '', status: '', page: 1, sort: null as StandardListSortState | null, preferences: null as StandardListColumnPreferences | null,
  columnsOpen: false, busy: false, feedback: '', error: false, preview: undefined as FinishedInventoryEligibility | undefined, previewKey: '', operationId: '', dirty: false, lastLocation: '' }
const formDrafts = new Map<string, Array<{ name: string; sku: string; value: string }>>()
let columnFocusReturn: HTMLElement | null = null
function formKey(form: HTMLElement): string { return `${form.dataset.fiqForm}:${form.dataset.transferId || form.dataset.applicationId || form.dataset.differenceId || state.previewKey}` }
function rememberForm(form: HTMLElement): void { formDrafts.set(formKey(form), [...form.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input[name],select[name]')].map(input => ({ name: input.name, sku: input.dataset.skuId || '', value: input.value }))); state.dirty = true }
function restoreDrafts(): void { for (const form of document.querySelectorAll<HTMLElement>('[data-fiq-form]')) for (const saved of formDrafts.get(formKey(form)) || []) { const input = [...form.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input[name],select[name]')].find(row => row.name === saved.name && (row.dataset.skuId || '') === saved.sku); if (input) input.value = saved.value } }
const total = (values: number[]) => values.reduce((a, b) => a + b, 0)
function image(imageUrl: string, title: string): string {
  if (!imageUrl) return '<span class="text-amber-700">对象图片缺失</span>'
  return `<div class="relative h-14 w-14 shrink-0"><button type="button" class="h-full w-full rounded border" data-pda-image-preview-url="${e(imageUrl)}" data-pda-image-preview-title="${e(title)}" data-skip-page-rerender="true" aria-label="查看${e(title)}大图"><img class="h-full w-full object-contain" src="${e(imageUrl)}" alt="${e(title)}" onload="this.parentElement.nextElementSibling.hidden=true" onerror="this.hidden=true;this.parentElement.nextElementSibling.textContent='图片加载失败';this.parentElement.nextElementSibling.hidden=false"></button><span class="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/90 text-xs">加载中</span></div>`
}
const columns: StandardListColumn<FinishedInventoryApplication>[] = [
  { key: 'number', title: '申请单号', width: 230, required: true, freezeable: true, sortable: true, sortValue: row => row.applicationNo, render: row => `<a class="text-blue-700 underline" data-nav="${url(row.id)}" href="${url(row.id)}">${e(row.applicationNo)}</a>` },
  { key: 'style', title: '款式', width: 260, required: true, freezeable: true, render: row => `<div class="flex items-center gap-2">${image(row.imageUrl, row.styleName)}<span>${e(row.styleName)}<br><span class="text-xs text-slate-500">${e(row.styleNo)}</span></span></div>` },
  { key: 'warehouse', title: '原成衣仓', width: 170, render: row => e(row.warehouseName) },
  { key: 'sent', title: '出库/实收（件）', width: 140, render: row => `${total(row.lines.map(line => line.outboundQty))} / ${row.receivedAt ? total(row.lines.map(line => line.receivedQty || 0)) : '待收'}` },
  { key: 'qc', title: 'QC/申请进度', width: 210, required: true, render: row => `${e(row.qcTaskNo || '待实收生成')}<br><span class="text-sm">${e(finishedInventoryApplicationStatus(row))}</span>` },
  { key: 'time', title: '创建时间/办理人', width: 200, sortable: true, sortValue: row => row.createdAt, render: row => `${e(row.createdAt)}<br>${e(row.createdBy)}` },
  { key: 'actions', title: '操作', width: 100, required: true, actionColumn: true, render: row => `<a class="text-blue-700 underline" data-nav="${url(row.id)}" href="${url(row.id)}">查看流转</a>` },
]
const rules = columns.map(column => ({ key: column.key, required: column.required, freezeable: column.freezeable, actionColumn: column.actionColumn }))
function prefs(): StandardListColumnPreferences {
  if (!state.preferences) {
    const fallback = normalizeListColumnPreferences(rules, { order: columns.map(row => row.key), visibleKeys: columns.map(row => row.key), frozenKeys: ['number'], pageSize: 10 }, [10, 20, 50])
    try { state.preferences = loadListColumnPreferences(window.localStorage, PREFERENCE_KEY, rules, fallback, [10, 20, 50]) } catch { state.preferences = fallback }
  }
  return state.preferences
}
function feedback(): string {
  const message = getFinishedInventoryStorageFailure() || state.feedback
  return `<div data-fiq-feedback role="status" class="${message ? `rounded border p-3 ${state.error || getFinishedInventoryStorageFailure() ? 'border-red-200 bg-red-50 text-red-800' : 'border-blue-200 bg-blue-50 text-blue-800'}` : ''}">${e(message)}</div>`
}
function list(): string {
  const rows = listFinishedInventoryApplications().filter(row => (!state.status || finishedInventoryApplicationStatus(row) === state.status)
    && (!state.keyword.trim() || `${row.applicationNo} ${row.styleNo} ${row.styleName} ${row.warehouseName} ${row.qcTaskNo || ''}`.toLowerCase().includes(state.keyword.trim().toLowerCase())))
  const paging = paginateStandardListRows(sortStandardListRows(rows, state.sort, (row, key) => columns.find(column => column.key === key)?.sortValue?.(row)), state.page, prefs().pageSize)
  state.page = paging.currentPage
  return renderStandardListPage({ title: '成衣库存送检', primaryActionsHtml: `<a class="rounded border px-3 py-2 text-sm text-blue-700" href="/wls/finished/stock/realtime" data-nav="/wls/finished/stock/realtime">从即时库存发起申请</a>`,
    filtersHtml: `<div class="rounded border bg-white p-3"><div class="flex flex-wrap gap-3"><label>仓库、款式或单号<input class="${control} ml-2" data-fiq-field="keyword" value="${e(state.keyword)}" data-skip-page-rerender="true"></label><label>进度<select class="${control} ml-2" data-fiq-field="status" data-skip-page-rerender="true"><option value="">全部</option>${['待后道实收', '待完成QC', '待分类交接及上架', '实收为0待核实差异', '已完成'].map(value => `<option ${state.status === value ? 'selected' : ''}>${value}</option>`).join('')}</select></label></div><div class="mt-3 flex gap-2"><button class="${control} bg-blue-600 text-white" ${action('query')}>查询</button><button class="${control}" ${action('reset')}>重置</button></div></div>`,
    feedbackHtml: feedback(), statsHtml: renderStandardListStats([{ label: '本次查询申请', value: rows.length }, { label: '已完成', value: rows.filter(row => row.completedAt).length }, { label: '已出库', value: `${total(rows.map(row => total(row.lines.map(line => line.outboundQty))))} 件` }]),
    listTitle: `库存送检申请（${rows.length}条）`, listActionsHtml: `<button class="${control}" ${action('columns')}>列设置</button>`,
    tableHtml: renderStandardListTable({ columns, rows: paging.rows, preferences: prefs(), sort: state.sort, eventPrefix: PREFIX, emptyText: '暂无库存送检申请，从即时库存选择仓库及款式发起。' }),
    paginationHtml: renderTablePagination({ ...paging, actionPrefix: PREFIX, fieldPrefix: PREFIX, pageSizeOptions: [10, 20, 50] }),
    overlaysHtml: `<div data-fiq-overlay>${state.columnsOpen ? renderStandardListColumnSettings({ title: '申请列设置', columns, preferences: prefs(), eventPrefix: PREFIX, maxFrozenWidth: 520 }) : ''}</div>` })
}
function preview(): string {
  const row = state.preview!
  return `<section class="space-y-4 p-4"><header class="flex items-center justify-between"><h1 class="text-xl font-semibold">确认整批库存送检</h1><a class="text-blue-700" href="${PATH}" data-nav="${PATH}">申请列表</a></header>${feedback()}<div class="flex gap-3 rounded border bg-white p-4">${image(row.imageUrl, row.styleName)}<div><h2 class="font-semibold">${e(row.styleName)} · ${e(row.styleNo)}</h2><p>${e(row.warehouseName)}</p><p class="mt-2">正常已上架 ${row.totalNormal} 件，订单排除 ${row.excludedQty} 件，本次全部送检 <strong>${row.eligibleQty} 件</strong></p></div></div><div class="overflow-x-auto rounded border bg-white"><table class="w-full text-left text-sm"><thead><tr><th class="p-3">颜色/尺码</th><th>SKU</th><th>实际来源库位</th><th>送检件数</th></tr></thead><tbody>${row.lines.map(line => `<tr class="border-t"><td class="p-3"><div class="flex items-center gap-2">${image(line.imageUrl, `${row.styleName} ${line.colorName} / ${line.sizeName}`)}<span>${e(line.colorName)} / ${e(line.sizeName)}</span></div></td><td>${e(line.skuCode)}</td><td>${line.allocations.map(a => `${e(a.locationCode)} × ${a.quantity}`).join('<br>')}</td><td>${line.outboundQty}</td></tr>`).join('')}</tbody></table></div><form data-fiq-form="apply" class="space-y-3 rounded border bg-white p-4" data-skip-page-rerender="true"><p>确认后本仓本款全部合资格正常品直接下架出库，交后道整批实收。</p><label class="block">实际出库人<input required class="${control} ml-2" name="operator" data-skip-page-rerender="true"></label><button type="button" class="min-h-11 rounded bg-blue-600 px-5 font-semibold text-white" ${action('apply')} ${!row.eligibleQty || state.busy ? 'disabled' : ''}>确认下架出库 ${row.eligibleQty} 件</button></form></section>`
}
function quantities(lines: Array<{ skuId: string; skuCode: string; colorName: string; sizeName: string; quantity: number }>): string {
  return `<div class="space-y-2">${lines.map(line => `<label class="flex flex-wrap items-center gap-2"><span class="min-w-40 flex-1 text-sm">${e(line.colorName)} / ${e(line.sizeName)} · ${e(line.skuCode)}<span class="ml-2 text-slate-500">应交${line.quantity}件</span></span><input type="number" min="0" step="1" required aria-label="${e(line.skuCode)}实际接收件数" class="${control} w-24" name="quantity" data-sku-id="${e(line.skuId)}" data-skip-page-rerender="true"><span>件实收</span></label>`).join('')}</div>`
}
function transferCard(row: FinishedInventoryTransfer): string {
  const status = finishedInventoryTransferStatus(row)
  let form = ''
  if (!row.shippedAt) form = `<form data-fiq-form="ship" data-transfer-id="${e(row.id)}" class="mt-3 space-y-3"><label>实际交出人<input name="operator" required class="${control} ml-2" data-skip-page-rerender="true"></label><button type="button" class="${control} ml-2 bg-blue-600 text-white" ${action('ship')}>确认整批交出 ${total(row.lines.map(line => line.quantity))} 件</button></form>`
  else if (!row.receivedAt) form = `<form data-fiq-form="receive-transfer" data-transfer-id="${e(row.id)}" data-target-id="${e(row.targetId)}" class="mt-3 space-y-3">${quantities(row.lines)}<label>实际接收人<input required name="operator" class="${control} ml-2" data-skip-page-rerender="true"></label><button type="button" class="${control} ml-2 bg-blue-600 text-white" ${action('receive-transfer')}>确认${e(row.targetName)}整批实收</button></form>`
  else if (!row.putawayAt && row.category !== '返工交接' && row.category !== '送后道') form = `<form data-fiq-form="putaway" data-transfer-id="${e(row.id)}" class="mt-3 space-y-3">${row.lines.filter(line => line.receivedQty! > 0).map(line => `<label class="flex flex-wrap items-center gap-2"><span class="min-w-40 flex-1">${e(line.skuCode)} · 实收${line.receivedQty}件</span><select required name="location" class="${control}" data-sku-id="${e(line.skuId)}" data-skip-page-rerender="true"><option value="">选择本仓适用库位</option>${FINISHED_INVENTORY_LOCATIONS.filter(location => location.warehouseId === row.targetId).map(location => `<option value="${e(location.locationCode)}">${e(location.zoneName)} / ${e(location.locationCode)}</option>`).join('')}</select></label>`).join('')}<label>实际上架人<input required name="operator" class="${control} ml-2" data-skip-page-rerender="true"></label><button type="button" class="${control} ml-2 bg-blue-600 text-white" ${action('putaway')}>确认本类实收全部上架</button></form>`
  return `<article class="rounded border bg-white p-4"><div class="flex flex-wrap items-center justify-between gap-2"><h3 class="font-semibold">${e(row.category)} → ${e(row.targetName)}</h3><span class="text-sm text-blue-800">${e(status)}</span></div><p class="mt-1 break-all text-xs text-slate-500">${e(row.applicationNo)} · ${e(row.id)}</p><p class="mt-2 text-sm">应交${total(row.lines.map(line => line.quantity))}件${row.receivedAt ? `，实际接收${total(row.lines.map(line => line.receivedQty || 0))}件` : ''}</p><div class="mt-3 grid gap-3 sm:grid-cols-2">${row.lines.map(line => `<div class="flex items-center gap-2 rounded bg-slate-50 p-2">${image(line.imageUrl, `${line.styleName} ${line.colorName} / ${line.sizeName}`)}<div class="text-sm"><p>${e(line.colorName)} / ${e(line.sizeName)}</p><p class="break-all text-xs text-slate-500">${e(line.skuCode)}</p><p>应交${line.quantity}件${row.receivedAt ? ` · 实收${line.receivedQty || 0}件` : ''}</p></div></div>`).join('')}</div>${row.shippedAt ? `<p class="text-xs text-slate-500">实际交出 ${e(row.shippedBy)} · ${e(row.shippedAt)}</p>` : ''}${row.receivedAt ? `<p class="text-xs text-slate-500">实际接收 ${e(row.receivedBy)} · ${e(row.receivedAt)}</p>` : ''}${form}</article>`
}
function detail(row: FinishedInventoryApplication): string {
  const differences = listFinishedInventoryDifferences(row.id), transfers = listFinishedInventoryTransfers(row.id).filter(transfer => transfer.category !== '送后道')
  return `<section class="space-y-4 p-4"><header class="flex flex-wrap justify-between gap-2"><h1 class="text-xl font-semibold">库存送检流转详情</h1><a class="text-blue-700" href="${PATH}" data-nav="${PATH}">申请列表</a></header>${feedback()}<div class="flex gap-3 rounded border bg-white p-4">${image(row.imageUrl, row.styleName)}<div><h2 class="font-semibold">${e(row.styleName)} · ${e(row.styleNo)}</h2><p class="break-all text-sm">${e(row.applicationNo)} · ${e(row.warehouseName)}</p><p class="mt-2 font-semibold text-blue-800">${e(finishedInventoryApplicationStatus(row))}</p><p class="mt-1 text-sm">原仓实际出库${total(row.lines.map(line => line.outboundQty))}件${row.receivedAt ? `；后道实际接收${total(row.lines.map(line => line.receivedQty || 0))}件` : '；等待后道整批实收'}</p></div></div>
    <section class="rounded border bg-white p-4"><h2 class="font-semibold">本批SKU及原仓实物来源（件）</h2><div class="mt-3 overflow-x-auto"><table class="w-full text-left text-sm"><thead><tr><th class="p-2">颜色尺码 / SKU</th><th class="p-2">原仓实际出库</th><th class="p-2">后道实际接收</th></tr></thead><tbody>${row.lines.map(line => `<tr class="border-t"><td class="p-2"><div class="flex items-center gap-2">${image(line.imageUrl, `${line.styleName} ${line.colorName} / ${line.sizeName}`)}<div>${e(line.colorName)} / ${e(line.sizeName)}<p class="break-all text-xs text-slate-500">${e(line.skuCode)}</p><p class="text-xs text-slate-500">${line.allocations.map(item => `${e(item.locationCode)} × ${item.quantity}`).join('；')}</p></div></div></td><td class="p-2">${line.outboundQty}</td><td class="p-2">${row.receivedAt ? line.receivedQty || 0 : '待实际接收'}</td></tr>`).join('')}</tbody></table></div></section>
    ${!row.receivedAt ? `<form class="space-y-3 rounded border bg-white p-4" data-fiq-form="receive" data-application-id="${e(row.id)}"><h2 class="font-semibold">后道整批实收</h2>${quantities(row.lines.map(line => ({ ...line, quantity: line.outboundQty })))}<label>实际接收人<input name="operator" required class="${control} ml-2" data-skip-page-rerender="true"></label><button type="button" class="${control} ml-2 bg-blue-600 text-white" ${action('receive')}>确认整批实收并形成库存QC</button></form>` : ''}
    ${row.qcTaskId ? `<div class="rounded border bg-white p-4"><h2 class="font-semibold">后道QC · ${e(row.qcTaskNo!)}</h2><p class="my-2 text-sm">按本次实际实收开展检查。正常放行含实检合格及未检放行，分别保留。</p>${row.qcCompletedAt ? `<p>QC已完成 · ${e(row.qcCompletedAt)}</p><p class="text-sm">实检${total(row.qcResults!.map(r => r.inspectedQty))}件；实检合格${total(row.qcResults!.map(r => r.passedQty))}件；未检放行${total(row.qcResults!.map(r => r.uninspectedQty))}件；瑕疵${total(row.qcResults!.map(r => r.defectQty))}件；返工${total(row.qcResults!.map(r => r.reworkQty))}件</p>` : `<a class="text-blue-700 underline" data-nav="/fcs/craft/post-finishing/qc-workbench?taskNo=${e(row.qcTaskNo!)}" href="/fcs/craft/post-finishing/qc-workbench?taskNo=${e(row.qcTaskNo!)}">进入后道原质检工作台</a>`}</div>` : row.receivedAt ? '<p class="rounded border border-amber-200 bg-amber-50 p-4">实收为0，没有可开检实物；先核实差异，不虚构QC完成或自动返库。</p>' : ''}
    ${transfers.map(transferCard).join('')}
    ${differences.length ? `<section class="space-y-3 rounded border bg-white p-4"><h2 class="font-semibold">数量差异</h2>${differences.map(d => `<article class="rounded border p-3"><p>${e(row.lines.find(line => line.skuId === d.skuId)?.skuCode || d.skuId)}：应交${d.expectedQty}、实收${d.actualQty}、差异${d.quantity > 0 ? '+' : ''}${d.quantity}件</p>${d.resolvedAt ? `<p class="text-sm text-slate-600">已确认 ${e(d.reason!)}；实际去向/处理：${e(d.disposition!)} · ${e(d.resolvedBy!)} · ${e(d.resolvedAt)}</p>` : `<form class="mt-2 flex flex-wrap gap-2" data-fiq-form="difference" data-difference-id="${e(d.id)}"><input name="reason" aria-label="差异真实原因" placeholder="真实原因" class="${control}" required data-skip-page-rerender="true"><input name="disposition" aria-label="差异实际去向及处理" placeholder="实际去向及处理" class="${control}" required data-skip-page-rerender="true"><input name="operator" aria-label="差异确认人" placeholder="实际确认人" class="${control}" required data-skip-page-rerender="true"><button type="button" class="${control} bg-blue-600 text-white" ${action('difference')}>确认差异处理</button></form>`}</article>`).join('')}</section>` : ''}</section>`
}
function workspace(): string {
  if (typeof window !== 'undefined') {
    const location = window.location.pathname + window.location.search
    if (state.lastLocation !== location) { state.preview = undefined; state.previewKey = ''; state.lastLocation = location }
  }
  const params = typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search)
  const id = params.get('id') || (typeof window !== 'undefined' ? decodeURIComponent(window.location.pathname.slice(PATH.length + 1)) : '')
  if (id) { const row = getFinishedInventoryApplication(id); return row ? detail(row) : `<section class="p-4">${feedback()}<p>库存申请未找到，请重新读取。</p></section>` }
  const warehouseId = params.get('warehouseId'), styleId = params.get('styleId')
  if (warehouseId && styleId) {
    const key = `${warehouseId}::${styleId}`
    if (state.previewKey !== key || !state.preview) { state.preview = previewFinishedInventoryQuality(warehouseId, styleId); state.previewKey = key; state.operationId = crypto.randomUUID() }
    return preview()
  }
  return list()
}
function refresh(): void {
  const region = document.querySelector<HTMLElement>('[data-fiq-workspace]')
  if (region) { region.innerHTML = workspace(); hydrateIcons(region) }
  for (const panel of document.querySelectorAll<HTMLElement>('[data-fiq-tasks-panel]')) {
    panel.innerHTML = tasksPanelContents(panel.dataset.fiqTasksPanel || 'inbound'); hydrateIcons(panel)
  }
  restoreDrafts()
}
let bound = false
function installGuards(): void {
  if (typeof document !== 'undefined' && !bound) {
    bound = true
    window.addEventListener('beforeunload', event => { if (state.dirty) { event.preventDefault(); event.returnValue = '' } })
    document.addEventListener('click', event => { const link = (event.target as HTMLElement)?.closest('a[data-nav]'); if (state.dirty && link && !confirm('当前填写尚未保存，确认离开？')) { event.preventDefault(); event.stopImmediatePropagation() } else if (link) { state.dirty = false; formDrafts.clear() } }, true)
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && state.columnsOpen) { state.columnsOpen = false; refreshOverlay(); columnFocusReturn?.focus(); event.preventDefault() } })
  }
}
export function renderFinishedInventoryQualityPage(_state?: AppState): string {
  installGuards()
  try { return `<div data-fiq-root data-skip-page-rerender="true"><div data-fiq-workspace>${workspace()}</div></div>` }
  catch (error) { return `<section class="p-4 text-red-800">${e(error instanceof Error ? error.message : String(error))}<button ${action('reload')} class="${control} ml-3">重新读取</button></section>` }
}
export { renderFinishedInventoryQualityPage as renderFinishedInventoryQuality }
function tasksPanelContents(mode: string): string {
  const transfers = listFinishedInventoryTransfers().filter(row => mode === 'putaway' ? row.category !== '送后道' && row.category !== '返工交接' && !!row.receivedAt && !row.putawayAt
    : mode === 'outbound' ? row.category === '送后道' : row.category !== '送后道' && !!row.shippedAt && !row.receivedAt)
  return `<div class="space-y-3"><header class="flex items-center justify-between"><h2 class="font-semibold">库存送检${mode === 'putaway' ? '返仓上架' : mode === 'outbound' ? '实际出库' : '分类接收'}（${transfers.length}条）</h2><a class="text-sm text-blue-700" href="${PATH}" data-nav="${PATH}">全部送检申请</a></header>${feedback()}${transfers.slice(0, 10).map(row => mode === 'outbound' ? `<div class="flex flex-wrap items-center justify-between gap-2 rounded border bg-white p-3"><span>${e(row.applicationNo)} · 原仓${e(row.sourceWarehouseName)}实际出库${total(row.lines.map(line => line.quantity))}件</span><a class="text-blue-700" href="${url(row.applicationId)}" data-nav="${url(row.applicationId)}">查看送后道实收与QC</a></div>` : transferCard(row)).join('') || '<p class="text-sm text-slate-500">暂无本类待办</p>'}${transfers.length > 10 ? `<a href="${PATH}" data-nav="${PATH}" class="text-blue-700">其余${transfers.length - 10}条从申请列表查询</a>` : ''}</div>`
}
export function renderFinishedInventoryTasksPanel(mode: 'inbound' | 'putaway' | 'outbound'): string { installGuards(); return `<section class="m-4 rounded border border-blue-200 bg-blue-50/30 p-4" data-fiq-tasks-panel="${mode}" data-skip-page-rerender="true">${tasksPanelContents(mode)}</section>` }
function refreshOverlay(): void { const overlay = document.querySelector<HTMLElement>('[data-fiq-overlay]'); if (overlay) { overlay.innerHTML = state.columnsOpen ? renderStandardListColumnSettings({ title: '申请列设置', columns, preferences: prefs(), eventPrefix: PREFIX, maxFrozenWidth: 520 }) : ''; hydrateIcons(overlay) } }
function showError(error: unknown): void { state.feedback = error instanceof Error ? error.message : String(error); state.error = true; for (const node of document.querySelectorAll<HTMLElement>('[data-fiq-feedback]')) node.outerHTML = feedback() }
function inputValue(form: HTMLElement, name: string): string { return form.querySelector<HTMLInputElement>(`[name="${name}"]`)?.value.trim() || '' }
function receiptQuantities(form: HTMLElement) { return [...form.querySelectorAll<HTMLInputElement>('[name="quantity"]')].map(input => { if (!input.value.trim()) throw new Error('逐SKU填写实际接收件数，不能用应交数代替实收。'); return { skuId: input.dataset.skuId!, quantity: Number(input.value) } }) }
export function handleFinishedInventoryQualityEvent(target: HTMLElement, event?: Event): boolean {
  const form = target.closest<HTMLElement>('[data-fiq-form]')
  if (form && (event?.type === 'input' || event?.type === 'change')) { rememberForm(form); return true }
  const columnDrag = target.closest<HTMLElement>('[data-fiq-column-key]')
  if (columnDrag && event?.type === 'drop') {
    const source = (event as DragEvent & { higoodStandardListColumnKey?: string }).higoodStandardListColumnKey || '', destination = columnDrag.dataset.fiqColumnKey || ''
    if (source && source !== destination && !columns.find(row => row.key === source)?.actionColumn && !columns.find(row => row.key === destination)?.actionColumn) { const order = prefs().order.filter(key => key !== source), index = order.indexOf(destination); if (index >= 0) { order.splice(index, 0, source); prefs().order = order; try { saveListColumnPreferences(window.localStorage, PREFERENCE_KEY, prefs()) } catch { /* 偏好可丢弃 */ }; refresh() } }
    return true
  }
  const field = target.closest<HTMLInputElement | HTMLSelectElement>('[data-fiq-field]')
  if (field) { if (field.dataset.fiqField === 'keyword') state.keyword = field.value; else if (field.dataset.fiqField === 'status') state.status = field.value; else if (field.dataset.fiqField === 'pageSize') { prefs().pageSize = Number(field.value); try { saveListColumnPreferences(window.localStorage, PREFERENCE_KEY, prefs()) } catch { /* 偏好可丢弃 */ }; state.page = 1; refresh() }; return true }
  const button = target.closest<HTMLElement>('[data-fiq-action]'), name = button?.dataset.fiqAction
  if (!name || !button) return false
  if (event?.type && event.type !== 'click') return true
  event?.preventDefault()
  if (state.busy) return true
  if (name === 'query' || name === 'reset' || name === 'prev-page' || name === 'next-page' || name === 'sort-column') {
    if (name === 'reset') { state.keyword = ''; state.status = '' }; state.page = name === 'next-page' ? state.page + 1 : name === 'prev-page' ? Math.max(1, state.page - 1) : 1
    if (name === 'sort-column') { const key = button.dataset.columnKey || ''; state.sort = state.sort?.key === key ? state.sort.direction === 'asc' ? { key, direction: 'desc' } : null : { key, direction: 'asc' } }
    refresh(); return true
  }
  if (name === 'columns' || name === 'close-column-settings') { state.columnsOpen = name === 'columns'; if (state.columnsOpen) columnFocusReturn = button; refreshOverlay(); if (!state.columnsOpen) columnFocusReturn?.focus(); return true }
  if (name === 'restore-column-settings') { try { window.localStorage.removeItem(PREFERENCE_KEY) } catch { /* 偏好可丢弃 */ }; state.preferences = null; prefs(); refresh(); return true }
  if (name === 'toggle-column-visibility' || name === 'toggle-column-freeze') {
    const key = button.dataset.fiqColumnKey || button.closest<HTMLElement>('[data-fiq-column-key]')?.dataset.fiqColumnKey || '', column = columns.find(row => row.key === key)
    if (column && !column.actionColumn && !(name === 'toggle-column-visibility' && column.required)) { const property = name === 'toggle-column-freeze' ? 'frozenKeys' : 'visibleKeys'; const current = prefs(); current[property] = current[property].includes(key) ? current[property].filter(value => value !== key) : [...current[property], key]; try { saveListColumnPreferences(window.localStorage, PREFERENCE_KEY, current) } catch { /* 偏好可丢弃 */ }; refresh() }; return true
  }
  if (!form && name !== 'reload') return true
  const operator = form ? inputValue(form, 'operator') : ''
  if (form && !form.querySelector<HTMLInputElement>('[name="operator"]')?.checkValidity()) { form.querySelector<HTMLInputElement>('[name="operator"]')?.reportValidity(); return true }
  state.busy = true; button.setAttribute('disabled', '')
  void (async () => {
    try {
      if (name === 'reload') { await ensureFinishedInventoryRecords(); state.preview = undefined }
      else {
        const currentForm = form!, actor = { actorId: `INVENTORY:${operator}`, actorName: operator, roleName: name === 'receive' ? '后道回货确认人员' : '仓库收货人员' }
        const operationId = name === 'apply' ? state.operationId : `${name}-${currentForm.dataset.transferId || currentForm.dataset.applicationId || currentForm.dataset.differenceId}-${crypto.randomUUID()}`
        const result = await runFinishedInventoryCommand(() => {
          if (name === 'apply') return createFinishedInventoryQualityApplication({ preview: state.preview!, operationId, actor })
          if (name === 'receive') return receiveFinishedInventoryQualityApplication({ applicationId: currentForm.dataset.applicationId!, quantities: receiptQuantities(currentForm), actor })
          if (name === 'ship') return shipFinishedInventoryTransfer({ transferId: currentForm.dataset.transferId!, actor })
          if (name === 'receive-transfer') return receiveFinishedInventoryTransfer({ transferId: currentForm.dataset.transferId!, targetId: currentForm.dataset.targetId!, quantities: receiptQuantities(currentForm), actor })
          if (name === 'putaway') return putawayFinishedInventoryTransfer({ transferId: currentForm.dataset.transferId!, actor, locations: [...currentForm.querySelectorAll<HTMLSelectElement>('[name="location"]')].map(input => ({ skuId: input.dataset.skuId!, locationCode: input.value })) })
          if (name === 'difference') return resolveFinishedInventoryDifference({ differenceId: currentForm.dataset.differenceId!, actor, reason: inputValue(currentForm, 'reason'), disposition: inputValue(currentForm, 'disposition') })
          throw new Error('该库存操作不可用。')
        }, operationId, `库存送检 ${name}`)
        formDrafts.delete(formKey(currentForm))
        if (name === 'apply' && result && 'id' in result) { state.dirty = false; window.history.pushState(null, '', url(String(result.id))) }
      }
      state.feedback = '本次实际办理已保存。'; state.error = false; state.dirty = formDrafts.size > 0; refresh()
    } catch (error) { showError(error) }
    finally { state.busy = false; button.removeAttribute('disabled') }
  })()
  return true
}
