// @page-pattern: list
import { escapeHtml as e } from '../../../utils.ts'
import { renderStandardListPage, renderStandardListStats } from '../../../components/ui/list-page.ts'
import { renderStandardListTable, type StandardListColumn } from '../../../components/ui/list-table.ts'
import { renderTablePagination } from '../../../components/ui/pagination.ts'
import { renderDrawer } from '../../../components/ui/drawer.ts'
import { loadListColumnPreferences, saveListColumnPreferences, normalizeListColumnPreferences, sortStandardListRows, type StandardListColumnPreferences, type StandardListSortState } from '../../../components/ui/list-table-model.ts'
import { HAND_FEELS, HAND_FEEL_ENGLISH, factoryQcRequirementText, qcProgress, ensureFactoryQcRecords, listFactoryQcOrders, getFactoryQcOrder, factoryQcPhotoUrl, saveFactoryQcRoll, decideFactoryQcHandfeel, type FactoryQcKind, type FactoryQcOrder, type FactoryQcRoll, type FactoryQcPhoto, type HandFeel, type QcResults } from '../../../data/fcs/factory-qc.ts'

const PAGE_SIZES = [10, 20, 50]
const RESULTS = ['符合要求', '有差异', '待确认']
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_PHOTO_BYTES = 10 * 1024 * 1024
const SOURCE_NAMES = { PRINTING: '印花', DYEING: '染色', WATER_SOLUBLE: '独立水溶', STENTER_HAND_FEEL: '定型机手感' }
const resultNames: Record<keyof QcResults, string> = { color: '色差', handfeel: '实际手感', material: '面料种类' }
interface ListState { query: string; factory: string; status: string; page: number; preferences?: StandardListColumnPreferences; sort: StandardListSortState | null; columnsOpen: boolean }
interface RollDraft { qcId: string; rollId: string; expectedVersion: number; photos: FactoryQcPhoto[]; files: Map<string, File>; urls: Map<string, string>; results: QcResults; notes: string; dirty: boolean; busy: boolean; error: string; intent?: string; operationId?: string }
interface DetailState { selectedRoll: string; rollPage: number; rollQuery: string; rollStatus: string; needs: string; target: string; decisionDirty: boolean; busy: boolean; error: string; notice: string; decisionOperation?: string; decisionIntent?: string }
const lists = new Map<FactoryQcKind, ListState>()
const details = new Map<string, DetailState>()
const drafts = new Map<string, RollDraft>()
let listenersInstalled = false
let imageFocus: HTMLElement | null = null
const route = (kind: FactoryQcKind) => `/fcs/craft/${kind === 'PRINTING' ? 'printing' : 'dyeing'}/qc-orders`
const name = (kind: FactoryQcKind) => kind === 'PRINTING' ? '印花 QC 单' : '染厂 QC 单'
const detailRoute = (order: FactoryQcOrder) => `${route(order.kind)}/${encodeURIComponent(order.id)}`
const draftKey = (qcId: string, rollId: string) => `${qcId}\u0000${rollId}`
const date = (value?: string) => value ? (Number.isNaN(Date.parse(value)) ? value : new Date(value).toLocaleString('zh-CN', { hour12: false })) : '—'
const link = (label: string, url: string, attrs = '') => `<a class="text-blue-700 underline-offset-2 hover:underline" href="${e(url)}" data-nav="${e(url)}" ${attrs}>${e(label)}</a>`
const button = (label: string, action: string, attrs = '', primary = false) => `<button type="button" class="min-h-10 rounded-md border px-3 py-2 text-sm ${primary ? 'border-blue-600 bg-blue-600 text-white hover:bg-blue-700' : 'bg-white text-slate-800 hover:bg-slate-50'} disabled:cursor-not-allowed disabled:opacity-50" data-factory-qc-action="${action}" data-skip-page-rerender="true" ${attrs}>${e(label)}</button>`
const inputClass = 'mt-1 block min-h-10 w-full rounded-md border bg-white px-3 py-2 text-sm disabled:bg-slate-100'
// Only bounded presentation preferences (<4 KiB per route), never QC records or attachments.
const preferencesStorage = {
  getItem: (key: string) => { try { const value = localStorage.getItem(key); return value && value.length <= 4096 ? value : null } catch { return null } },
  setItem: (key: string, value: string) => { try { if (value.length <= 4096) localStorage.setItem(key, value) } catch { /* Default presentation remains usable. */ } },
  removeItem: (key: string) => { try { localStorage.removeItem(key) } catch { /* Optional preference. */ } },
}
function listState(kind: FactoryQcKind): ListState {
  let state = lists.get(kind)
  if (!state) { state = { query: '', factory: '', status: '', page: 1, sort: null, columnsOpen: false }; lists.set(kind, state) }
  return state
}
function detailState(order: FactoryQcOrder): DetailState {
  let state = details.get(order.id)
  if (!state) { state = { selectedRoll: '', rollPage: 1, rollQuery: '', rollStatus: '', needs: order.decision ? (order.decision.needs ? 'yes' : 'no') : '', target: order.decision?.target || '', decisionDirty: false, busy: false, error: '', notice: '' }; details.set(order.id, state) }
  return state
}
function rollDraft(order: FactoryQcOrder, roll: FactoryQcRoll): RollDraft {
  const key = draftKey(order.id, roll.id)
  let draft = drafts.get(key)
  if (!draft) { draft = { qcId: order.id, rollId: roll.id, expectedVersion: roll.version, photos: structuredClone(roll.photos), results: { ...roll.results }, notes: roll.notes, files: new Map(), urls: new Map(), dirty: false, busy: false, error: '' }; drafts.set(key, draft) }
  return draft
}
function releaseDraft(key: string) { const draft = drafts.get(key); draft?.urls.forEach(url => URL.revokeObjectURL(url)); drafts.delete(key) }
export function factoryQcHasUnsavedChanges(): boolean {
  return [...drafts.values()].some(draft => draft.dirty || draft.busy) || [...details.values()].some(state => state.decisionDirty || state.busy)
}
export function confirmFactoryQcLeave(): boolean {
  if (!factoryQcHasUnsavedChanges()) return true
  if ([...drafts.values()].some(draft => draft.busy) || [...details.values()].some(state => state.busy)) return false
  if (!window.confirm('当前质检记录尚未保存。离开并放弃未保存内容？')) return false
  discardAllDrafts()
  return true
}
function installLifecycle() {
  if (typeof document === 'undefined') return
  if (!listenersInstalled) {
    listenersInstalled = true
    window.addEventListener('beforeunload', event => { if (factoryQcHasUnsavedChanges()) { event.preventDefault(); event.returnValue = '' } })
    document.addEventListener('click', event => {
      const anchor = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-nav]')
      if (!anchor || !document.querySelector('[data-factory-qc-root]') || !factoryQcHasUnsavedChanges()) return
      if (anchor.dataset.nav === window.location.pathname + window.location.search) return
      if (!confirmFactoryQcLeave()) { event.preventDefault(); event.stopImmediatePropagation() }
    }, true)
  }
  setTimeout(installImages, 0)
}
function discardAllDrafts() {
  for (const key of drafts.keys()) releaseDraft(key)
  // Leaving after a failed reread must still be possible. Discard only memory;
  // the next entry reconstructs display state from its own successful read.
  details.clear()
}
function image(url: string, title: string, size = 'h-20 w-20'): string {
  if (!url) return `<span class="block text-sm text-amber-800">缺少${e(title)}，待补充对应图片</span>`
  return `<button type="button" class="relative ${size} shrink-0 overflow-hidden rounded-md border bg-white" data-factory-qc-action="image" data-image-url="${e(url)}" data-image-title="${e(title)}" data-skip-page-rerender="true" aria-label="查看${e(title)}大图"><img class="h-full w-full object-contain" src="${e(url)}" alt="${e(title)}" data-factory-qc-image><span class="absolute inset-x-0 bottom-0 bg-white/95 text-xs" data-factory-qc-image-status>图片加载中</span></button>`
}
function installImages() {
  document.querySelectorAll<HTMLImageElement>('[data-factory-qc-image]').forEach(img => {
    const update = () => { const status = img.parentElement?.querySelector('[data-factory-qc-image-status]'); if (status) status.textContent = img.naturalWidth ? '' : '图片加载失败，点击后重试' }
    img.onload = update; img.onerror = update
    if (img.complete) update()
  })
}
function sourceRoute(order: FactoryQcOrder): string {
  const root = order.source.kind === 'PRINTING' ? '/fcs/craft/printing/work-orders' : order.source.kind === 'DYEING' ? '/fcs/craft/dyeing/work-orders' : order.source.kind === 'WATER_SOLUBLE' ? '/fcs/craft/dyeing/water-soluble-orders' : '/fcs/craft/dyeing/stenter-handfeel/work-orders'
  // Independent water-soluble currently exposes its existing list, not a detail route.
  if (order.source.kind === 'WATER_SOLUBLE') return root
  return root + '/' + encodeURIComponent(order.source.id)
}
function rollRegistrationText(order: FactoryQcOrder): string {
  const registered = order.rolls.length, reported = order.source.reportedRollCount
  const hasReported = reported !== undefined && Number.isSafeInteger(reported) && reported >= 0
  const missing = Math.max(0, qcProgress(order).total - registered)
  return `${hasReported ? `来源实报 ${reported} 卷，` : ''}已登记 ${registered} 卷${missing > 0 ? `，待补 ${missing} 卷明细` : registered === 0 ? '，待补卷明细' : ''}`
}
function columns(): StandardListColumn<FactoryQcOrder>[] {
  return [
    { key: 'no', title: 'QC 单号 / 来源', width: 190, required: true, freezeable: true, sortable: true, sortValue: order => order.no, render: order => `${link(order.no, detailRoute(order))}<p class="mt-1 text-xs text-slate-600">${e(SOURCE_NAMES[order.source.kind])} · ${e(order.source.no)}</p>` },
    { key: 'material', title: '面料', width: 260, required: true, freezeable: true, render: order => `<div class="flex items-center gap-2">${image(order.source.imageUrl, order.source.materialName, 'h-14 w-14')}<div class="min-w-0 break-words"><strong>${e(order.source.materialName)}</strong><p class="text-xs text-slate-600">${e(order.source.materialSku)}</p></div></div>` },
    { key: 'factory', title: '现场工厂', width: 120, sortable: true, sortValue: order => order.source.factoryName, render: order => e(order.source.factoryName) },
    { key: 'target', title: '实际下游', width: 150, render: order => `${e(order.source.target.name || '去向待明确')}${order.source.target.kind === 'UNKNOWN' ? '<p class="text-xs text-amber-800">接收方身份待明确</p>' : ''}` },
    { key: 'progress', title: '质检进度', width: 160, required: true, sortable: true, sortValue: order => qcProgress(order).checked, render: order => { const progress = qcProgress(order); return `${link(`已检 ${progress.checked} / 应检 ${progress.total} 卷`, detailRoute(order), 'aria-label="查看全部卷的质检详情"')}<p class="mt-1 text-xs text-slate-600">${e(progress.status)}</p>${progress.total > order.rolls.length ? `<p class="mt-1 text-xs text-amber-800">待补 ${progress.total - order.rolls.length} 卷明细</p>` : ''}` } },
    { key: 'decision', title: '整单手感处理', width: 170, render: order => order.decision ? `${order.decision.needs ? '需要做手感' : '不需要做手感'}<p class="mt-1 text-xs text-slate-600">${e(order.decision.target || (order.decision.needs ? '目标待补充' : '—'))}</p>` : ['PRINTING', 'DYEING'].includes(order.source.kind) ? '尚未判断' : '本来源不再次发起' },
    { key: 'created', title: '创建时间', width: 170, sortable: true, sortValue: order => order.createdAt, render: order => e(date(order.createdAt)) },
    { key: 'action', title: '操作', width: 100, actionColumn: true, render: order => link('查看质检', detailRoute(order)) },
  ]
}
function listRows(kind: FactoryQcKind) {
  const state = listState(kind), all = listFactoryQcOrders(kind)
  return all.filter(order => (!state.query || [order.no, order.source.no, order.source.materialName, order.source.materialSku].join(' ').toLowerCase().includes(state.query.toLowerCase())) && (!state.factory || order.source.factoryId === state.factory) && (!state.status || qcProgress(order).status === state.status))
}
function columnSettings(kind: FactoryQcKind): string {
  const state = listState(kind), fields = columns(), prefs = state.preferences!
  if (!state.columnsOpen) return ''
  const regular = prefs.order.filter(key => !fields.find(column => column.key === key)?.actionColumn)
  return renderDrawer({ title: `${name(kind)}列设置`, width: 'sm', closeAction: { prefix: 'factory-qc', action: 'close-columns', skipPageRerender: true } }, `<div class="space-y-2">${regular.map((key, index) => {
    const column = fields.find(item => item.key === key)!
    return `<div class="space-y-2 rounded border p-3"><strong class="text-sm">${e(column.title)}</strong><div class="flex flex-wrap items-center gap-3 text-sm"><label class="flex items-center gap-1"><input type="checkbox" data-factory-qc-action="column-visible" data-column-key="${e(key)}" data-preserve-native-click="true" ${prefs.visibleKeys.includes(key) ? 'checked' : ''} ${column.required ? 'disabled' : ''}>显示</label>${column.freezeable ? `<label class="flex items-center gap-1"><input type="checkbox" data-factory-qc-action="column-freeze" data-column-key="${e(key)}" data-preserve-native-click="true" ${prefs.frozenKeys.includes(key) ? 'checked' : ''}>冻结在左</label>` : ''}${button('上移', 'column-up', `data-column-key="${e(key)}" ${index === 0 ? 'disabled' : ''}`)}${button('下移', 'column-down', `data-column-key="${e(key)}" ${index === regular.length - 1 ? 'disabled' : ''}`)}</div></div>`
  }).join('')}</div>`, { extra: button('恢复默认', 'reset-columns'), cancel: { prefix: 'factory-qc', action: 'close-columns', label: '关闭', skipPageRerender: true } })
}
function listContent(kind: FactoryQcKind): string {
  const state = listState(kind), fields = columns(), all = listFactoryQcOrders(kind)
  state.preferences ??= loadListColumnPreferences(preferencesStorage, route(kind) + ':columns', fields, { order: fields.map(column => column.key), visibleKeys: fields.map(column => column.key), frozenKeys: [], pageSize: 10 }, PAGE_SIZES)
  const rows = sortStandardListRows(listRows(kind), state.sort, (order, key) => fields.find(column => column.key === key)?.sortValue?.(order))
  const pageSize = state.preferences.pageSize, totalPages = Math.max(1, Math.ceil(rows.length / pageSize))
  state.page = Math.max(1, Math.min(state.page, totalPages))
  const shown = rows.slice((state.page - 1) * pageSize, state.page * pageSize)
  const factories = [...new Map(all.map(order => [order.source.factoryId, order.source.factoryName])).entries()]
  const filtersHtml = `<div class="flex flex-wrap items-end gap-3 rounded-lg border bg-white p-3"><label class="text-sm">单号 / 来源 / 面料<input class="${inputClass}" data-factory-qc-filter="query" value="${e(state.query)}" placeholder="输入单号或面料"></label><label class="text-sm">现场工厂<select class="${inputClass}" data-factory-qc-filter="factory"><option value="">全部工厂</option>${factories.map(([id, label]) => `<option value="${e(id)}" ${state.factory === id ? 'selected' : ''}>${e(label)}</option>`).join('')}</select></label><label class="text-sm">质检状态<select class="${inputClass}" data-factory-qc-filter="status"><option value="">全部状态</option>${['待补卷', '待质检', '质检中', '已完成质检'].map(value => `<option ${state.status === value ? 'selected' : ''}>${value}</option>`).join('')}</select></label><div class="ml-auto flex gap-2">${button('查询', 'query', '', true)}${button('重置', 'reset')}</div></div>`
  return renderStandardListPage({ title: name(kind), filtersHtml, primaryActionsHtml: button('重新读取', 'refresh'), feedbackHtml: '<p class="empty:hidden text-sm text-red-700" role="alert" data-factory-qc-error></p>', statsHtml: `<div data-factory-qc-stats>${renderStandardListStats([{ label: '筛选结果', value: rows.length }, { label: '应检卷数', value: rows.reduce((sum, order) => sum + qcProgress(order).total, 0) }, { label: '已检卷数', value: rows.reduce((sum, order) => sum + qcProgress(order).checked, 0) }])}</div>`, listTitle: `${name(kind)} · ${rows.length} 张`, listActionsHtml: button('列设置', 'columns'), tableHtml: renderStandardListTable({ columns: fields, rows: shown, preferences: state.preferences, sort: state.sort, eventPrefix: 'factory-qc', skipPageRerender: true, emptyText: '暂无符合条件的 QC 单；最终实物批次完成后按来源条件自动创建。' }), paginationHtml: renderTablePagination({ currentPage: state.page, totalPages, pageSize, total: rows.length, from: rows.length ? (state.page - 1) * pageSize + 1 : 0, to: Math.min(state.page * pageSize, rows.length), actionPrefix: 'factory-qc', skipPageRerender: true }), overlaysHtml: `<div data-factory-qc-columns>${columnSettings(kind)}</div>` })
}
export async function renderFactoryQcListPage(kind: FactoryQcKind): Promise<string> {
  await ensureFactoryQcRecords()
  installLifecycle()
  return `<div class="min-w-0" data-factory-qc-root="list" data-factory-qc-kind="${kind}">${listContent(kind)}</div>`
}
function summary(order: FactoryQcOrder): string {
  const progress = qcProgress(order)
  const results = (Object.keys(resultNames) as Array<keyof QcResults>).map(key => {
    const grouped = new Map<string, number>()
    order.rolls.forEach(roll => { if (roll.results[key]) grouped.set(roll.results[key], (grouped.get(roll.results[key]) || 0) + 1) })
    return `<div class="border-t py-3 first:border-t-0 sm:border-l sm:border-t-0 sm:px-4 sm:first:border-l-0 sm:first:pl-0 sm:last:pr-0"><dt class="text-xs text-slate-500">${resultNames[key]}记录</dt><dd class="mt-1 text-sm">${[...grouped].map(([value, count]) => `${e(value)} ${count} 卷`).join('；') || '尚未记录'}</dd></div>`
  }).join('')
  return `<div class="p-4"><div class="flex flex-wrap items-start justify-between gap-4"><div class="flex min-w-0 gap-3">${image(order.source.imageUrl, order.source.materialName)}<div class="min-w-0 break-words"><h2 class="text-base font-semibold">${e(order.source.materialName)}</h2><p class="mt-0.5 break-all text-sm text-slate-500">${e(order.source.materialSku)}</p><dl class="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2"><div class="min-w-0"><dt class="inline text-slate-500">${e(SOURCE_NAMES[order.source.kind])}来源 </dt><dd class="inline">${link(order.source.no, sourceRoute(order))} · ${e(order.source.factoryName)}</dd></div><div class="min-w-0"><dt class="inline text-slate-500">下游 </dt><dd class="inline">${e(order.source.target.name || '去向待明确')}</dd></div><div class="min-w-0"><dt class="inline text-slate-500">创建 </dt><dd class="inline">${e(date(order.createdAt))}</dd></div></dl></div></div><div class="ml-auto min-w-0 shrink-0 text-right"><div class="flex flex-wrap items-center justify-end gap-2"><strong class="text-xl tabular-nums">已检 ${progress.checked} / 应检 ${progress.total} 卷</strong><span class="inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${progress.status === '已完成质检' ? 'border-green-200 bg-green-50 text-green-700' : progress.status === '质检中' ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-amber-200 bg-amber-50 text-amber-700'}">${e(progress.status)}</span></div><p class="mt-1 text-sm text-slate-700">${e(rollRegistrationText(order))}</p></div></div><dl class="mt-4 grid border-t sm:grid-cols-3">${results}</dl><p class="mt-3 border-t pt-2 text-xs text-slate-500">逐卷记录检查事实，整单汇总检查完成情况。质检和手感判断均不限制合法交出。</p></div>`
}
function decisionPanel(order: FactoryQcOrder): string {
  const title = '<h2 class="font-semibold">整单手感处理</h2>'
  if (!['PRINTING', 'DYEING'].includes(order.source.kind)) return `<div class="p-4">${title}<p class="mt-2 text-sm">${e(SOURCE_NAMES[order.source.kind])}来源不再次发起手感加工。</p></div>`
  const state = detailState(order), decision = order.decision
  if (decision) return `<div class="p-4">${title}<dl class="mt-3 grid gap-3 text-sm sm:grid-cols-3"><div><dt class="text-slate-500">处理决定</dt><dd class="mt-1 font-medium">${decision.needs ? '需要做手感' : '不需要做手感'}</dd></div><div><dt class="text-slate-500">目标要求</dt><dd class="mt-1">${e(decision.target || (decision.needs ? '待补充' : '—'))}</dd></div><div><dt class="text-slate-500">记录人 / 时间</dt><dd class="mt-1">${e(decision.by)} · ${e(date(decision.at))}</dd></div></dl>${decision.orderId ? `<p class="mt-3">承接厂 GTG · ${link('查看定型机手感单', '/fcs/craft/dyeing/stenter-handfeel/work-orders/' + encodeURIComponent(decision.orderId))}</p>` : ''}${decision.reason ? `<p class="mt-3 text-sm text-amber-800">${e(decision.reason)}</p>` : ''}<p class="mt-2 text-xs text-slate-500">已记录整单决定，后续补卷沿用同一决定。</p></div>`
  const handedOut = order.source.handedOutRollIds.length > 0 || order.source.rolls.some(roll => roll.handedOut)
  return `<div class="grid gap-4 p-4 lg:grid-cols-[200px_minmax(0,1fr)] lg:items-start"><div>${title}</div><div>${handedOut ? '<p class="mb-3 text-sm text-amber-800">来源已有部分或全部实际交出，仅保存整单判断，不创建定型机手感单。</p>' : ''}<div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] xl:items-end"><label class="text-sm">整单处理决定<select class="${inputClass}" data-factory-qc-field="needs" ${state.busy ? 'disabled' : ''}><option value="">尚未判断</option><option value="yes" ${state.needs === 'yes' ? 'selected' : ''}>需要做手感</option><option value="no" ${state.needs === 'no' ? 'selected' : ''}>不需要做手感</option></select></label><label class="text-sm">目标要求<select class="${inputClass}" data-factory-qc-field="target" ${state.busy || state.needs !== 'yes' ? 'disabled' : ''}><option value="">目标待补充</option>${HAND_FEELS.map(feel => `<option value="${e(feel)}" ${state.target === feel ? 'selected' : ''}>${e(feel)} · ${e(HAND_FEEL_ENGLISH[feel])}</option>`).join('')}</select></label><div class="flex sm:col-span-2 xl:col-span-1">${button(state.needs === 'yes' && !handedOut ? '记录并创建手感单' : '记录整单判断', 'decide', state.busy ? 'disabled' : '', true)}</div></div><p class="mt-2 min-h-5 text-sm text-red-700" role="alert" data-factory-qc-decision-error>${e(state.error)}</p></div></div>`
}
function rollRows(order: FactoryQcOrder): string {
  const state = detailState(order)
  const rows = order.rolls.filter(roll => (!state.rollQuery || [roll.barcode, roll.batchId].join(' ').toLowerCase().includes(state.rollQuery.toLowerCase())) && (!state.rollStatus || (state.rollStatus === 'done' ? !!roll.completedAt : !roll.completedAt)))
  state.rollPage = Math.max(1, Math.min(state.rollPage, Math.max(1, Math.ceil(rows.length / 10))))
  return `<div class="p-4"><div class="flex flex-wrap items-start justify-between gap-3"><div class="min-w-0"><h2 class="font-semibold">卷质检详情 · 筛选结果 ${rows.length} 卷</h2><p class="mt-1 text-sm text-slate-600">${e(rollRegistrationText(order))}</p><p class="mt-1 text-xs text-slate-500">选择一卷，查看或填写质检记录。</p></div><div class="flex flex-wrap items-center gap-2"><input class="min-h-10 rounded border px-3 text-sm" placeholder="查找卷码或批次" aria-label="查找卷码或批次" data-factory-qc-field="rollQuery" value="${e(state.rollQuery)}"><select class="min-h-10 rounded border px-2 text-sm" aria-label="卷质检状态" data-factory-qc-field="rollStatus"><option value="">全部卷</option><option value="pending" ${state.rollStatus === 'pending' ? 'selected' : ''}>未完成</option><option value="done" ${state.rollStatus === 'done' ? 'selected' : ''}>已完成</option></select>${button('查询卷', 'query-rolls')}</div></div><div class="mt-3 overflow-x-auto"><table class="w-full min-w-[860px] text-left text-sm"><thead class="bg-slate-50 text-xs text-slate-500"><tr><th class="whitespace-nowrap p-3">卷码 / 批次</th><th class="whitespace-nowrap p-3 text-right">数量</th><th class="whitespace-nowrap p-3">照片</th><th class="whitespace-nowrap p-3">色差</th><th class="whitespace-nowrap p-3">实际手感</th><th class="whitespace-nowrap p-3">面料种类</th><th class="whitespace-nowrap p-3">完成情况</th><th class="sticky right-0 z-10 whitespace-nowrap bg-slate-50 p-3 text-right shadow-[-4px_0_4px_-4px_rgba(15,23,42,0.18)]">操作</th></tr></thead><tbody>${rows.slice((state.rollPage - 1) * 10, state.rollPage * 10).map(roll => `<tr class="border-t ${state.selectedRoll === roll.id ? 'bg-blue-50' : ''}"><td class="max-w-56 break-all p-3"><strong>${e(roll.barcode || '卷码待补')}</strong><p class="text-xs text-slate-500">${e(roll.batchId)}</p></td><td class="whitespace-nowrap p-3 text-right tabular-nums">${roll.qty} ${e(roll.unit)}</td><td class="whitespace-nowrap p-3">${roll.photos.length} 张</td>${(['color', 'handfeel', 'material'] as const).map(key => `<td class="whitespace-nowrap p-3">${e(roll.results[key] || '未记录')}</td>`).join('')}<td class="whitespace-nowrap p-3"><span class="${roll.completedAt ? 'text-green-700' : 'text-amber-700'}">${roll.completedAt ? '已完成质检' : '未完成'}</span></td><td class="sticky right-0 z-10 whitespace-nowrap ${state.selectedRoll === roll.id ? 'bg-blue-50' : 'bg-white'} p-3 text-right shadow-[-4px_0_4px_-4px_rgba(15,23,42,0.18)]">${button(roll.completedAt ? '查看记录' : '检查本卷', 'select-roll', `data-roll-id="${e(roll.id)}"`)}</td></tr>`).join('') || '<tr><td colspan="8" class="p-8 text-center text-slate-600">暂无符合条件的实际卷</td></tr>'}</tbody></table></div><p class="mt-2 text-xs text-slate-500 xl:hidden">表格可横向滚动查看全部检查结果。</p><div class="mt-3 flex items-center justify-between border-t pt-3 text-sm"><span>共 ${rows.length} 卷 · 第 ${state.rollPage} / ${Math.max(1, Math.ceil(rows.length / 10))} 页</span><div class="flex gap-2">${button('上一页', 'roll-prev', state.rollPage === 1 ? 'disabled' : '')}${button('下一页', 'roll-next', state.rollPage * 10 >= rows.length ? 'disabled' : '')}</div></div></div>`
}
function rollEditor(order: FactoryQcOrder): string {
  const roll = order.rolls.find(item => item.id === detailState(order).selectedRoll)
  if (!roll) return ''
  const completed = !!roll.completedAt, draft = completed ? undefined : rollDraft(order, roll)
  const photos = draft?.photos || roll.photos, results = draft?.results || roll.results, busy = !!draft?.busy
  const reference = `<div><h3 class="mb-2 text-sm font-semibold">色差对比参考图</h3>${image(roll.referenceImageUrl, '本卷面料参考图', 'h-40 w-40')}<p class="mt-2 text-xs text-slate-600">要求物料：${e(roll.requiredMaterialSku || '待补充')} · ${e(factoryQcRequirementText(roll.requirementVersion))}</p></div>`
  const actualPhotos = `<div class="min-w-0 flex-1"><h3 class="mb-2 text-sm font-semibold">本卷现场照片 · ${photos.length} 张</h3><div class="flex flex-wrap gap-3">${photos.map(photo => `<figure class="max-w-36">${image(draft?.urls.get(photo.id) || factoryQcPhotoUrl(photo.id), `${roll.barcode} · ${photo.name}`, 'h-28 w-28')}<figcaption class="mt-1 break-all text-xs text-slate-600">${e(photo.name)}</figcaption>${!completed ? button('移除', 'remove-photo', `data-photo-id="${e(photo.id)}" ${busy ? 'disabled' : ''}`) : ''}</figure>`).join('') || '<p class="text-sm text-slate-600">尚未上传本卷现场照片</p>'}</div>${!completed ? `<label class="mt-3 inline-flex min-h-10 cursor-pointer items-center rounded border px-3 py-2 text-sm">添加本卷照片<input class="ml-2 max-w-56 text-xs" type="file" accept="image/jpeg,image/png,image/webp" multiple data-factory-qc-field="photos" ${busy ? 'disabled' : ''}></label><p class="mt-1 text-xs text-slate-600">JPEG、PNG、WebP，每张不超过 10 MB。选好后需保存。</p>` : ''}</div>`
  return `<div data-factory-qc-roll-editor="${e(roll.id)}"><header class="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3"><h2 class="font-semibold">${completed ? '本卷质检记录' : '填写本卷质检'} · ${e(roll.barcode || '卷码待补')}</h2><span data-factory-qc-unsaved-state class="text-sm ${completed ? 'text-green-800' : 'text-amber-800'}">${completed ? '已完成质检 · 记录只读' : draft?.dirty ? '有未保存内容' : '未完成质检'}</span></header><div class="p-4"><div class="flex flex-wrap gap-6">${reference}${actualPhotos}</div><div class="mt-4 grid gap-4 md:grid-cols-3">${(['color', 'handfeel', 'material'] as const).map(key => completed ? `<div><h3 class="text-sm text-slate-600">${resultNames[key]}检查结果</h3><p class="mt-2 font-medium">${e(results[key])}</p></div>` : `<label class="text-sm">${resultNames[key]}检查结果<select class="${inputClass}" data-factory-qc-field="${key}" ${busy ? 'disabled' : ''}><option value="">尚未记录</option>${[...new Set([...RESULTS, results[key]].filter(Boolean))].map(value => `<option value="${e(value)}" ${results[key] === value ? 'selected' : ''}>${e(value)}</option>`).join('')}</select><span class="mt-1 block text-xs text-slate-600">${key === 'color' ? '对照本卷参考图记录' : key === 'handfeel' ? '按现场实际触摸记录' : '核对来源单要求的投入物料'}</span></label>`).join('')}</div><div class="mt-4">${completed ? `<h3 class="text-sm text-slate-600">现场说明</h3><p class="mt-2 whitespace-pre-wrap text-sm">${e(roll.notes || '无补充说明')}</p><p class="mt-3 text-sm">完成人 ${e(roll.completedBy || '')} · ${e(date(roll.completedAt))}</p>` : `<label class="text-sm">现场说明<textarea class="${inputClass}" rows="3" data-factory-qc-field="notes" placeholder="填写实际触摸感受、色差或用料情况" ${busy ? 'disabled' : ''}>${e(draft!.notes)}</textarea></label><div class="mt-3 flex flex-wrap gap-2">${button('保存未完成', 'save-roll', busy ? 'disabled' : '')}${button('完成本卷质检', 'complete-roll', busy ? 'disabled' : '', true)}${button('放弃未保存内容并重读', 'discard-roll', busy ? 'disabled' : '')}</div><p class="mt-2 text-sm text-slate-600">照片与三项结果齐全后可完成；有差异也可以完成检查。完成后照片、结果和说明不可修改。</p><p class="mt-2 min-h-5 text-sm text-red-700" role="alert" data-factory-qc-roll-error>${e(draft!.error)}</p>`}</div></div></div>`
}
function detailContent(order: FactoryQcOrder): string {
  const state = detailState(order)
  return `<header class="flex flex-wrap items-center justify-between gap-3"><div><h1 class="text-xl font-semibold">${name(order.kind)} · ${e(order.no)}</h1><p class="mt-1 text-sm">${link('返回' + name(order.kind) + '列表', route(order.kind))}</p></div>${button('重新读取', 'refresh')}</header><p class="empty:hidden text-sm text-red-700" role="alert" data-factory-qc-error></p><p class="empty:hidden text-sm text-green-800" role="status" tabindex="-1" data-factory-qc-notice>${e(state.notice)}</p><section class="overflow-hidden rounded-lg border bg-white" data-factory-qc-summary>${summary(order)}</section><section class="overflow-hidden rounded-lg border bg-white" data-factory-qc-handfeel>${decisionPanel(order)}</section><section class="overflow-hidden rounded-lg border bg-white" data-factory-qc-rolls>${rollRows(order)}</section><section class="overflow-hidden rounded-lg border bg-white empty:hidden" data-factory-qc-editor>${rollEditor(order)}</section>`
}
export async function renderFactoryQcDetailPage(id: string): Promise<string> {
  await ensureFactoryQcRecords()
  const order = getFactoryQcOrder(id)
  installLifecycle()
  if (!order) return `<section class="p-4"><h1 class="text-xl font-semibold">QC 单不存在</h1><p class="mt-3">请核对单号，或返回列表重新读取。</p></section>`
  return `<div class="min-w-0 space-y-3 p-4" data-factory-qc-root="detail" data-factory-qc-id="${e(id)}">${detailContent(order)}</div>`
}
function refreshList(root: HTMLElement) {
  const kind = root.dataset.factoryQcKind as FactoryQcKind
  const template = document.createElement('template'); template.innerHTML = listContent(kind)
  for (const selector of ['[data-standard-list-table-section]', '[data-factory-qc-stats]', '[data-factory-qc-columns]']) {
    const current = root.querySelector<HTMLElement>(selector), next = template.content.querySelector(selector)
    if (current && next) { const scroll = current.querySelector<HTMLElement>('.overflow-x-auto')?.scrollLeft || 0; current.replaceChildren(...next.childNodes); const scroller = current.querySelector<HTMLElement>('.overflow-x-auto'); if (scroller) scroller.scrollLeft = scroll }
  }
  installImages()
}
function refreshDetail(root: HTMLElement, sections = ['summary', 'handfeel', 'rolls', 'editor'], failureSnapshot?: FactoryQcOrder) {
  let order: FactoryQcOrder | undefined
  try { order = getFactoryQcOrder(root.dataset.factoryQcId || '') } catch (error) {
    // A failed reread must not hide the original save outcome or discard the
    // editable draft. This snapshot only restores the failed action's editor;
    // it is never published as a successful or freshly read business record.
    if (!failureSnapshot) throw error
    order = failureSnapshot
  }
  if (!order) return
  const renderers: Record<string, () => string> = { summary: () => summary(order), handfeel: () => decisionPanel(order), rolls: () => rollRows(order), editor: () => rollEditor(order) }
  for (const section of sections) { const element = root.querySelector<HTMLElement>(`[data-factory-qc-${section}]`); if (element) element.innerHTML = renderers[section]() }
  const notice = root.querySelector<HTMLElement>('[data-factory-qc-notice]'); if (notice) notice.textContent = detailState(order).notice
  installImages()
}
function showError(root: HTMLElement, message: string) { const notice = root.querySelector<HTMLElement>('[data-factory-qc-notice]'); if (notice) notice.textContent = ''; const slot = root.querySelector<HTMLElement>('[data-factory-qc-error]'); if (slot) { slot.textContent = message; slot.setAttribute('tabindex', '-1'); slot.focus() } }
function markRollDirty(root: HTMLElement, draft: RollDraft) {
  draft.dirty = true; draft.error = ''
  const editor = root.querySelector('[data-factory-qc-roll-editor]')
  const marker = editor?.querySelector<HTMLElement>('[data-factory-qc-unsaved-state]')
  if (marker) marker.textContent = '有未保存内容'
  const error = editor?.querySelector('[data-factory-qc-roll-error]')
  if (error) error.textContent = ''
}
function focusAction(root: HTMLElement, action: string) { root.querySelector<HTMLElement>(`[data-factory-qc-action="${action}"]`)?.focus() }
function openImage(url: string, title: string) {
  closeImage(); imageFocus = document.activeElement as HTMLElement
  const overlay = document.createElement('div'); overlay.dataset.factoryQcImageOverlay = 'true'; overlay.className = 'fixed inset-0 z-[100] flex items-center justify-center p-3'
  overlay.innerHTML = `<button type="button" class="absolute inset-0 bg-black/75" data-factory-qc-action="close-image" aria-label="关闭图片遮罩"></button><section class="relative flex max-h-[95vh] max-w-[95vw] flex-col rounded-lg bg-white p-3" role="dialog" aria-modal="true" aria-labelledby="factory-qc-image-title"><header class="mb-2 flex items-start justify-between gap-3"><h2 id="factory-qc-image-title" class="min-w-0 break-all font-semibold">${e(title)}</h2>${button('关闭', 'close-image')}</header><div class="min-h-0 overflow-auto"><img src="${e(url)}" alt="${e(title)}" class="max-h-[80vh] max-w-full object-contain" data-factory-qc-image><p class="text-sm" data-factory-qc-image-status>图片加载中</p></div></section>`
  document.body.append(overlay); overlay.querySelector<HTMLElement>('section button')?.focus(); installImages()
}
function closeImage() { const overlay = document.querySelector('[data-factory-qc-image-overlay]'); if (overlay) { overlay.remove(); imageFocus?.focus(); imageFocus = null } }
function trapImageFocus(event: KeyboardEvent): boolean {
  const overlay = document.querySelector('[data-factory-qc-image-overlay]')
  if (!overlay) return false
  if (event.key === 'Escape') { event.preventDefault(); closeImage(); return true }
  if (event.key !== 'Tab') return false
  const buttons = [...overlay.querySelectorAll<HTMLElement>('button')]
  const first = buttons[0], last = buttons[buttons.length - 1]
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
  return true
}
function operation(draft: RollDraft, complete: boolean): string {
  const intent = JSON.stringify([draft.photos, draft.results, draft.notes, complete])
  if (intent !== draft.intent) { draft.intent = intent; draft.operationId = crypto.randomUUID() }
  return draft.operationId!
}
async function saveRoll(root: HTMLElement, order: FactoryQcOrder, complete: boolean) {
  const state = detailState(order), roll = order.rolls.find(item => item.id === state.selectedRoll)
  if (!roll) throw new Error('先选择实际卷。')
  if (roll.completedAt) throw new Error('本卷已完成质检，记录只读。')
  const draft = rollDraft(order, roll)
  if (draft.busy) return
  if (complete && (!draft.photos.length || !Object.values(draft.results).every(value => value.trim()))) { draft.error = '先记录本卷照片和色差、实际手感、面料种类三个结果。'; refreshDetail(root, ['editor']); root.querySelector<HTMLElement>('[data-factory-qc-roll-error]')?.focus(); return }
  draft.busy = true; draft.error = ''; state.notice = ''; refreshDetail(root, ['editor'])
  try {
    await saveFactoryQcRoll({ qcId: order.id, rollId: roll.id, expectedVersion: draft.expectedVersion, photos: draft.photos, results: draft.results, notes: draft.notes, complete, newFiles: draft.photos.flatMap(photo => draft.files.has(photo.id) ? [draft.files.get(photo.id)!] : []) }, operation(draft, complete))
    releaseDraft(draftKey(order.id, roll.id)); state.notice = complete ? '本卷已完成质检，记录已锁定。' : '本卷已保存，仍为未完成质检。'
    refreshDetail(root, state.decisionDirty ? ['summary', 'rolls', 'editor'] : undefined)
    root.querySelector<HTMLElement>('[data-factory-qc-notice]')?.focus()
  } catch (error) { draft.error = error instanceof Error ? error.message : '本次未保存，请保留输入后重试。'; draft.busy = false; refreshDetail(root, ['editor'], order); const slot = root.querySelector<HTMLElement>('[data-factory-qc-roll-error]'); if (slot) { slot.setAttribute('tabindex', '-1'); slot.focus() } else showError(root, draft.error) }
}
async function decide(root: HTMLElement, order: FactoryQcOrder) {
  const state = detailState(order)
  if (state.busy || order.decision) return
  if (!['yes', 'no'].includes(state.needs)) { state.error = '选择整单是否做手感后再记录。'; refreshDetail(root, ['handfeel']); return }
  const intent = JSON.stringify([state.needs, state.target, order.version])
  if (state.decisionIntent !== intent) { state.decisionIntent = intent; state.decisionOperation = crypto.randomUUID() }
  state.busy = true; state.error = ''; state.notice = ''; refreshDetail(root, ['handfeel'])
  try {
    await decideFactoryQcHandfeel({ qcId: order.id, expectedVersion: order.version, needs: state.needs === 'yes', ...(state.needs === 'yes' && state.target ? { target: state.target as HandFeel } : {}) }, state.decisionOperation!)
    state.decisionDirty = false; state.busy = false; state.notice = '整单手感判断已保存。'; refreshDetail(root, ['handfeel', 'summary']); root.querySelector<HTMLElement>('[data-factory-qc-notice]')?.focus()
  } catch (error) { state.busy = false; state.error = error instanceof Error ? error.message : '本次未保存，请保留输入后重试。'; refreshDetail(root, ['handfeel'], order); root.querySelector<HTMLElement>('[data-factory-qc-field="needs"]')?.focus() }
}
function readFilters(root: HTMLElement, state: ListState) { root.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-factory-qc-filter]').forEach(field => { const key = field.dataset.factoryQcFilter as 'query' | 'factory' | 'status'; state[key] = field.value.trim() }) }
function savePreferences(kind: FactoryQcKind) { const state = listState(kind); state.preferences = normalizeListColumnPreferences(columns(), state.preferences, PAGE_SIZES); saveListColumnPreferences(preferencesStorage, route(kind) + ':columns', state.preferences) }
async function handleList(root: HTMLElement, target: HTMLElement, action: string, event?: Event) {
  const kind = root.dataset.factoryQcKind as FactoryQcKind, state = listState(kind)
  const pageField = target.closest<HTMLSelectElement>('[data-factory-qc-field="pageSize"]')
  if (pageField && event?.type === 'change') { state.preferences!.pageSize = Number(pageField.value); state.page = 1; savePreferences(kind); refreshList(root); return }
  if (event?.type === 'keydown') { if ((event as KeyboardEvent).key !== 'Enter' || !target.closest('[data-factory-qc-filter]')) return; event.preventDefault(); action = 'query' }
  if (!action) return
  if (['column-visible', 'column-freeze'].includes(action) && event?.type !== 'change') return
  if (!['column-visible', 'column-freeze'].includes(action) && event && !['click', 'keydown'].includes(event.type)) return
  if (action === 'query') { readFilters(root, state); state.page = 1 }
  else if (action === 'reset') { state.query = ''; state.factory = ''; state.status = ''; state.page = 1; root.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-factory-qc-filter]').forEach(field => { field.value = '' }) }
  else if (action === 'prev-page') state.page--
  else if (action === 'next-page') state.page++
  else if (action === 'refresh') await ensureFactoryQcRecords(true)
  else if (action === 'columns') state.columnsOpen = true
  else if (action === 'close-columns') state.columnsOpen = false
  else if (action === 'reset-columns') { state.preferences = normalizeListColumnPreferences(columns(), { order: columns().map(column => column.key), visibleKeys: columns().map(column => column.key), frozenKeys: [], pageSize: 10 }, PAGE_SIZES); savePreferences(kind) }
  else if (action === 'sort-column') { const key = target.closest<HTMLElement>('[data-column-key]')?.dataset.columnKey!; state.sort = state.sort?.key !== key ? { key, direction: 'asc' } : state.sort.direction === 'asc' ? { key, direction: 'desc' } : null; state.page = 1 }
  else if (action.startsWith('column-')) {
    const key = target.closest<HTMLElement>('[data-column-key]')?.dataset.columnKey!, prefs = state.preferences!
    if (action === 'column-visible') prefs.visibleKeys = (target as HTMLInputElement).checked ? [...prefs.visibleKeys, key] : prefs.visibleKeys.filter(item => item !== key)
    else if (action === 'column-freeze') prefs.frozenKeys = (target as HTMLInputElement).checked ? [...prefs.frozenKeys, key] : prefs.frozenKeys.filter(item => item !== key)
    else { const index = prefs.order.indexOf(key), next = index + (action === 'column-up' ? -1 : 1); if (next >= 0 && next < prefs.order.length && prefs.order[next] !== 'action') [prefs.order[index], prefs.order[next]] = [prefs.order[next], prefs.order[index]] }
    savePreferences(kind)
  }
  refreshList(root)
  if (action === 'columns') root.querySelector<HTMLElement>('[data-factory-qc-columns] button')?.focus()
  else if (action === 'close-columns') focusAction(root, 'columns')
}
async function handleDetail(root: HTMLElement, target: HTMLElement, action: string, event?: Event) {
  if (action === 'refresh' && (!event || event.type === 'click')) {
    await ensureFactoryQcRecords(true)
    const restored = getFactoryQcOrder(root.dataset.factoryQcId || '')
    if (!restored) throw new Error('QC 单无法读取，请返回列表。')
    const state = detailState(restored)
    state.notice = factoryQcHasUnsavedChanges() ? '已重新读取，当前未保存内容仍保留；若版本变化，保存时会提示重新核对。' : '已重新读取。'
    const error = root.querySelector<HTMLElement>('[data-factory-qc-error]'); if (error) error.textContent = ''
    refreshDetail(root, state.decisionDirty ? ['summary', 'rolls', 'editor'] : undefined)
    return
  }
  const order = getFactoryQcOrder(root.dataset.factoryQcId || '')
  if (!order) throw new Error('QC 单无法读取，请返回列表。')
  const state = detailState(order), field = target.closest<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('[data-factory-qc-field]')
  if (field && event && ['input', 'change'].includes(event.type)) {
    const key = field.dataset.factoryQcField!
    if (['rollQuery', 'rollStatus'].includes(key)) { state[key as 'rollQuery' | 'rollStatus'] = field.value; if (key === 'rollStatus' && event.type === 'change') { state.rollPage = 1; refreshDetail(root, ['rolls']) }; return }
    if (['needs', 'target'].includes(key)) { state[key as 'needs' | 'target'] = field.value; state.decisionDirty = true; state.error = ''; if (key === 'needs' && event.type === 'change') { refreshDetail(root, ['handfeel']); root.querySelector<HTMLElement>('[data-factory-qc-field="needs"]')?.focus() }; return }
    const roll = order.rolls.find(item => item.id === state.selectedRoll)
    if (!roll || roll.completedAt) return
    const draft = rollDraft(order, roll)
    if (draft.busy) return
    if (key === 'photos') {
      if (event.type !== 'change') return
      const files = [...((field as HTMLInputElement).files || [])]
      const invalid = files.find(file => !PHOTO_TYPES.includes(file.type) || file.size <= 0 || file.size > MAX_PHOTO_BYTES)
      if (invalid) { draft.error = `“${invalid.name}”无法添加：使用非空 JPEG、PNG、WebP 图片，单张不超过 10 MB。`; (field as HTMLInputElement).value = ''; refreshDetail(root, ['editor']); return }
      for (const file of files) { const id = 'FQC-PHOTO-' + crypto.randomUUID(); draft.photos.push({ id, name: file.name, type: file.type, size: file.size }); draft.files.set(id, file); draft.urls.set(id, URL.createObjectURL(file)) }
      draft.dirty ||= files.length > 0; draft.error = ''; refreshDetail(root, ['editor']); root.querySelector<HTMLElement>('[data-factory-qc-field="photos"]')?.focus(); return
    }
    if (key === 'notes') draft.notes = field.value
    else if (['color', 'handfeel', 'material'].includes(key)) draft.results[key as keyof QcResults] = field.value
    else return
    markRollDirty(root, draft); return
  }
  if (event?.type === 'keydown') { if ((event as KeyboardEvent).key === 'Enter' && field?.dataset.factoryQcField === 'rollQuery') { event.preventDefault(); action = 'query-rolls' } else return }
  if (event && !['click', 'keydown'].includes(event.type)) return
  if (action === 'select-roll') { state.selectedRoll = target.closest<HTMLElement>('[data-roll-id]')?.dataset.rollId || ''; refreshDetail(root, ['rolls', 'editor']); const editor = root.querySelector<HTMLElement>('[data-factory-qc-editor]'); editor?.setAttribute('tabindex', '-1'); editor?.focus() }
  else if (action === 'query-rolls') { state.rollPage = 1; refreshDetail(root, ['rolls']) }
  else if (action === 'roll-prev' || action === 'roll-next') { state.rollPage += action === 'roll-prev' ? -1 : 1; refreshDetail(root, ['rolls']) }
  else if (action === 'save-roll' || action === 'complete-roll') await saveRoll(root, order, action === 'complete-roll')
  else if (action === 'remove-photo') { const roll = order.rolls.find(item => item.id === state.selectedRoll); if (!roll || roll.completedAt) throw new Error('已完成质检的照片不可修改。'); const draft = rollDraft(order, roll); if (draft.busy) return; const id = target.closest<HTMLElement>('[data-photo-id]')?.dataset.photoId!; const url = draft.urls.get(id); if (url) URL.revokeObjectURL(url); draft.urls.delete(id); draft.files.delete(id); draft.photos = draft.photos.filter(photo => photo.id !== id); draft.dirty = true; refreshDetail(root, ['editor']) }
  else if (action === 'discard-roll') { const key = draftKey(order.id, state.selectedRoll), draft = drafts.get(key); if (draft?.busy) return; if (draft?.dirty && !window.confirm('放弃本卷尚未保存的照片和检查内容，并重新读取？')) return; await ensureFactoryQcRecords(true); releaseDraft(key); refreshDetail(root, ['summary', 'rolls', 'editor']) }
  else if (action === 'decide') await decide(root, order)
}
export async function handleFactoryQcEvent(target: HTMLElement, event?: Event): Promise<boolean> {
  if (event?.type === 'keydown' && trapImageFocus(event as KeyboardEvent)) return true
  const trigger = target.closest<HTMLElement>('[data-factory-qc-action]'), action = trigger?.dataset.factoryQcAction || ''
  if (action === 'image' && (!event || event.type === 'click')) { openImage(trigger!.dataset.imageUrl || '', trigger!.dataset.imageTitle || '现场照片'); return true }
  if (action === 'close-image' && (!event || event.type === 'click')) { closeImage(); return true }
  const root = target.closest<HTMLElement>('[data-factory-qc-root]')
  if (!root) return false
  try {
    if (root.dataset.factoryQcRoot === 'list') await handleList(root, trigger || target, action, event)
    else await handleDetail(root, trigger || target, action, event)
  } catch (error) { showError(root, error instanceof Error ? error.message : '本次操作未完成，请保留输入后重试。') }
  return true
}
