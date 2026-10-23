// @page-pattern: list
import { escapeHtml as e } from '../../../../utils.ts'
import { renderStandardListPage, renderStandardListFilters, renderStandardListStats } from '../../../../components/ui/list-page.ts'
import { renderStandardListTable, renderStandardListColumnSettings, type StandardListColumn } from '../../../../components/ui/list-table.ts'
import { renderTablePagination } from '../../../../components/ui/pagination.ts'
import { loadListColumnPreferences, normalizeListColumnPreferences, saveListColumnPreferences, sortStandardListRows, type StandardListColumnPreferences, type StandardListSortState } from '../../../../components/ui/list-table-model.ts'
import { getPdaSession } from '../../../../data/fcs/store-domain-pda.ts'
import { HAND_FEELS, handfeelStatus, ensureFactoryQcRecords, getStenterHandfeelOrder, listStenterHandfeelOrders, listFactoryQcActions, submitStenterHandfeelCommand, type StenterHandfeelOrder } from '../../../../data/fcs/stenter-handfeel.ts'
import { isStenterExecutionAction, openStenterExecutionDialog, stenterExecutionLabels, stenterExecutionRolls } from './execution-dialog.ts'
import { STENTER_ROUTE, STENTER_PDA_ROUTE, stenterLink, stenterButton, stenterImage, stenterQuantity, stenterTime, stenterSourceLabel, stenterSourceLink, renderStenterSummary, renderStenterBase, renderStenterRolls, renderStenterRollCards, renderStenterLogs, renderStenterPrint, stenterActionName, installStenterImages } from './presentation.ts'

const ui = { page: 1, pageSize: 10, query: '', handFeel: '', status: '', columnsOpen: false }
let preferences: StandardListColumnPreferences | undefined
let sort: StandardListSortState | null = null
let activeColumns: StandardListColumn<StenterHandfeelOrder>[] = []
const printOperations = new Map<string, string>()
// Only bounded column/page-size preferences live here; business records use the facade.
const preferenceKey = STENTER_ROUTE + ':columns'
const preferenceStorage = { getItem: (key: string) => { try { const value = localStorage.getItem(key); return value && value.length <= 8192 ? value : null } catch { return null } }, setItem: (key: string, value: string) => { try { if (value.length <= 8192) localStorage.setItem(key, value) } catch { /* Preference failure uses defaults. */ } } }
const actionAttrs = (id: string) => `data-stenter-order-id="${e(id)}"`
function errorHtml(): string { return '<p class="empty:hidden text-sm text-red-700" role="alert" data-stenter-error></p><p class="empty:hidden text-sm text-green-800" role="status" tabindex="-1" data-stenter-result></p>' }
function pdaCanAct(order: StenterHandfeelOrder, action: string): boolean {
  const session = getPdaSession(); if (!session) return false
  const factoryId = action === 'send' ? order.source.factoryId : action === 'downstream-receive' ? order.source.target.factoryId : order.factoryId
  return !!factoryId && session.factoryId === factoryId
}
function eligibleActions(order: StenterHandfeelOrder, pda = false) {
  return (Object.keys(stenterExecutionLabels) as Array<keyof typeof stenterExecutionLabels>).filter(action => (!pda || pdaCanAct(order, action)) && stenterExecutionRolls(order, action).length > 0)
}
function actionLabel(order: StenterHandfeelOrder, action: keyof typeof stenterExecutionLabels): string {
  return action === 'send' && order.source.factoryId === order.factoryId ? 'GTG内部转入' : stenterExecutionLabels[action]
}
function executionActions(order: StenterHandfeelOrder, pda: boolean): string {
  if (order.completedAt) {
    const newRolls = order.rolls.filter(roll => !roll.sentAt)
    return `<div class="space-y-3"><p class="rounded border border-green-200 bg-green-50 p-3 text-sm">已于 ${e(stenterTime(order.completedAt))} 人工完单。</p>${newRolls.length ? `<p class="text-sm">来源后补 ${newRolls.length} 卷，确认后沿用本单及原整单手感决定继续处理。</p>${!pda || pdaCanAct(order, 'continue') ? stenterButton('继续处理新增卷', 'continue', actionAttrs(order.id), true) : '<p class="text-sm text-slate-600">由 GTG 确认继续处理新增卷。</p>'}` : ''}</div>`
  }
  const actions = eligibleActions(order, pda)
  const buttons = actions.map((action, index) => stenterButton(actionLabel(order, action), action, actionAttrs(order.id), index === 0))
  const complete = (!pda || pdaCanAct(order, 'complete')) && order.rolls.length > 0 && order.rolls.every(roll => !!roll.downstreamReceivedAt) ? stenterButton('人工完单', 'complete', actionAttrs(order.id), true) : ''
  return `<div class="space-y-3"><div class="flex flex-wrap gap-2">${pda ? (buttons[0] || '') : buttons.join('')}${complete}</div>${pda && buttons.length > 1 ? `<details><summary class="min-h-11 cursor-pointer py-2 text-sm text-blue-700">其他可用操作</summary><div class="flex flex-wrap gap-2">${buttons.slice(1).join('')}</div></details>` : ''}${!buttons.length && !complete ? '<p class="text-sm text-slate-500">当前没有可执行的实物操作，请核对卷明细。</p>' : ''}${order.source.target.kind === 'UNKNOWN' ? '<p class="text-sm text-amber-800">下游接收方待核对，已完成的卷先保留实物记录。</p>' : ''}</div>`
}
function sourceOrders(pda: boolean): StenterHandfeelOrder[] {
  const orders = listStenterHandfeelOrders(), session = pda ? getPdaSession() : null
  return session ? orders.filter(order => [order.factoryId, order.source.factoryId, order.source.target.factoryId].includes(session.factoryId)) : orders
}
function listColumns(pda: boolean): StandardListColumn<StenterHandfeelOrder>[] {
  const route = pda ? STENTER_PDA_ROUTE : STENTER_ROUTE
  return [
    { key: 'order', title: '加工单 / 来源', width: 220, required: true, freezeable: true, sortable: true, sortValue: order => order.no, render: order => `<div class="space-y-2">${stenterLink(order.no, route + '/' + encodeURIComponent(order.id))}<p class="text-xs text-slate-500">${e(stenterSourceLabel(order))}</p>${stenterSourceLink(order)}</div>` },
    { key: 'material', title: '面料', width: 260, required: true, freezeable: true, render: order => `<div class="flex items-start gap-3">${stenterImage(order.source.imageUrl, order.source.materialName, 'h-12 w-12')}<div class="min-w-0 break-words"><strong class="text-sm">${e(order.source.materialName)}</strong><p class="break-all text-xs text-slate-500">${e(order.source.materialSku)}</p></div></div>` },
    { key: 'requirement', title: '目标要求 / 承接厂', width: 175, sortable: true, sortValue: order => order.handFeel || '', render: order => `<p>${e(order.handFeel || '目标手感待补充')}</p><p class="mt-1 text-xs text-slate-500">GTG</p>` },
    { key: 'route', title: '上游 / 下游', width: 200, render: order => `<p>${e(order.source.factoryName)} → GTG</p><p class="mt-1 text-sm text-slate-500">下游 ${e(order.source.target.kind === 'UNKNOWN' ? '待核对' : order.source.target.name)}</p>` },
    { key: 'progress', title: '加工状态 / 卷数', width: 180, sortable: true, sortValue: handfeelStatus, render: order => `<p class="text-blue-800">${e(handfeelStatus(order))}</p><p class="mt-1 text-sm">${order.rolls.length} 卷 · 已产出 ${order.rolls.filter(roll => !!roll.completedAt).length} 卷</p><p class="mt-1 text-xs text-slate-500">下游实收 ${order.rolls.filter(roll => !!roll.downstreamReceivedAt).length} 卷</p>` },
    { key: 'quantity', title: '来源数量 / 创建时间', width: 190, sortable: true, sortValue: order => order.createdAt, render: order => `<p>${[...new Set(order.rolls.map(roll => roll.unit))].map(unit => e(stenterQuantity(order.rolls.filter(roll => roll.unit === unit).reduce((sum, roll) => sum + roll.inputQty, 0), unit))).join('<br>') || '待补卷'}</p><p class="mt-1 text-xs text-slate-500">${e(stenterTime(order.createdAt))}</p>` },
    { key: 'actions', title: '操作', width: 165, actionColumn: true, render: order => `<div class="flex flex-col items-start gap-1">${stenterLink('查看', route + '/' + encodeURIComponent(order.id))}${eligibleActions(order, pda).slice(0, 2).map(action => `<button type="button" class="min-h-10 text-left text-sm text-blue-700 hover:underline" data-stenter-handfeel-action="${action}" data-skip-page-rerender="true" ${actionAttrs(order.id)}>${e(actionLabel(order, action))}</button>`).join('')}</div>` },
  ]
}
function listContent(pda: boolean): string {
  const all = sourceOrders(pda)
  let rows = all.filter(order => (!ui.query || [order.no, order.source.no, order.source.sourceNo, order.source.materialName, order.source.materialSku].filter(Boolean).join(' ').toLowerCase().includes(ui.query.toLowerCase())) && (!ui.handFeel || order.handFeel === ui.handFeel) && (!ui.status || handfeelStatus(order) === ui.status))
  activeColumns = listColumns(pda)
  preferences ??= loadListColumnPreferences(preferenceStorage, preferenceKey, activeColumns, { order: activeColumns.map(column => column.key), visibleKeys: activeColumns.map(column => column.key), frozenKeys: [], pageSize: ui.pageSize }, [10, 20, 50])
  ui.pageSize = preferences.pageSize
  rows = sortStandardListRows(rows, sort, (order, key) => activeColumns.find(column => column.key === key)?.sortValue?.(order))
  const totalPages = Math.max(1, Math.ceil(rows.length / ui.pageSize)); ui.page = Math.max(1, Math.min(ui.page, totalPages))
  const shown = rows.slice((ui.page - 1) * ui.pageSize, ui.page * ui.pageSize)
  const filters = renderStandardListFilters({ actionPrefix: 'stenter-handfeel', fieldsHtml: `<label class="text-sm">单号 / 来源 / 面料<input class="mt-1 block min-h-10 rounded border px-3" data-stenter-filter="query" value="${e(ui.query)}"></label><label class="text-sm">目标手感<select class="mt-1 block min-h-10 rounded border px-3" data-stenter-filter="handFeel"><option value="">全部</option>${HAND_FEELS.map(feel => `<option ${ui.handFeel === feel ? 'selected' : ''}>${e(feel)}</option>`).join('')}</select></label><label class="text-sm">状态<select class="mt-1 block min-h-10 rounded border px-3" data-stenter-filter="status"><option value="">全部</option>${[...new Set(all.map(handfeelStatus))].map(status => `<option ${ui.status === status ? 'selected' : ''}>${e(status)}</option>`).join('')}</select></label>` })
  const pagination = renderTablePagination({ total: rows.length, from: rows.length ? (ui.page - 1) * ui.pageSize + 1 : 0, to: Math.min(ui.page * ui.pageSize, rows.length), currentPage: ui.page, totalPages, pageSize: ui.pageSize, actionPrefix: 'stenter-handfeel', skipPageRerender: true })
  const cards = `<div class="space-y-3" data-stenter-pda-cards>${shown.map(order => `<article class="space-y-3 rounded-lg border bg-white p-3"><div class="flex items-start gap-3">${stenterImage(order.source.imageUrl, order.source.materialName)}<div class="min-w-0 break-words">${stenterLink(order.no, STENTER_PDA_ROUTE + '/' + encodeURIComponent(order.id))}<p class="mt-1 font-medium">${e(order.source.materialName)}</p><p class="mt-1 text-sm">${e(handfeelStatus(order))} · ${order.rolls.length} 卷</p><p class="mt-1 text-sm">${e(order.handFeel || '目标手感待补充')}</p></div></div>${executionActions(order, true)}</article>`).join('') || '<p class="rounded border bg-white p-4 text-sm text-slate-500">暂无定型机手感单。印花或染色来源QC记录整单处理决定后自动创建。</p>'}</div>`
  if (pda) return `<div class="space-y-3 p-3"><h1 class="text-xl font-semibold">定型机手感单</h1>${errorHtml()}<div data-stenter-list-filters>${filters}</div>${cards}<div data-stenter-list-pagination>${pagination}</div><div data-stenter-operation-slot></div></div>`
  return renderStandardListPage({ title: '定型机手感单', filtersHtml: filters, feedbackHtml: errorHtml(), statsHtml: `<div data-stenter-list-stats>${renderStandardListStats([{ label: '筛选结果', value: rows.length }, { label: '加工中', value: rows.filter(order => order.rolls.some(roll => roll.startedAt && !roll.completedAt)).length }, { label: '待下游实收', value: rows.filter(order => order.rolls.some(roll => roll.handedOutAt && !roll.downstreamReceivedAt)).length }, { label: '已完单', value: rows.filter(order => !!order.completedAt).length }])}</div>`, listTitle: `定型机手感单 · ${rows.length} 条`, listActionsHtml: stenterButton('列设置', 'columns'), tableHtml: renderStandardListTable({ columns: activeColumns, rows: shown, preferences, sort, eventPrefix: 'stenter-handfeel', skipPageRerender: true, emptyText: '暂无定型机手感单。由印花或染色来源QC的整单决定自动创建。' }), paginationHtml: `<div data-stenter-list-pagination>${pagination}</div>`, overlaysHtml: '<div data-stenter-settings-slot>' + (ui.columnsOpen ? renderStandardListColumnSettings({ title: '定型机手感单列设置', columns: activeColumns, preferences, eventPrefix: 'stenter-handfeel', maxFrozenWidth: 650, skipPageRerender: true }) : '') + '</div><div data-stenter-operation-slot></div>' })
}
function refreshList(root: HTMLElement, resetFilters = false): void {
  const pda = root.dataset.stenterPda === 'true', template = document.createElement('template'); template.innerHTML = listContent(pda)
  const selectors = pda ? ['[data-stenter-pda-cards]', '[data-stenter-list-pagination]'] : ['[data-standard-list-table-section] .overflow-x-auto', '[data-stenter-list-stats]', '[data-stenter-list-pagination]', '[data-stenter-settings-slot]']
  for (const selector of selectors) { const current = root.querySelector<HTMLElement>(selector), next = template.content.querySelector<HTMLElement>(selector); if (current && next) { const scroll = current.scrollLeft; current.replaceChildren(...next.childNodes); current.scrollLeft = scroll } }
  const title = root.querySelector('[data-standard-list-table-section] > header h2'), nextTitle = template.content.querySelector('[data-standard-list-table-section] > header h2'); if (title && nextTitle) title.textContent = nextTitle.textContent
  const status = root.querySelector<HTMLSelectElement>('[data-stenter-filter="status"]'), nextStatus = template.content.querySelector<HTMLSelectElement>('[data-stenter-filter="status"]')
  if (status && nextStatus) { const value = status.value; status.replaceChildren(...nextStatus.childNodes); if (value && ![...status.options].some(option => option.value === value)) status.add(new Option(value, value)); status.value = value }
  if (resetFilters) { for (const key of ['query', 'handFeel', 'status'] as const) { const input = root.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-stenter-filter="${key}"]`); if (input) input.value = ui[key] } }
  installStenterImages()
}
function detailParts(order: StenterHandfeelOrder, pda: boolean): string {
  return `<div data-stenter-detail-part="summary">${renderStenterSummary(order)}</div><section class="space-y-3 rounded-lg border bg-white p-4" data-stenter-detail-part="execution"><h2 class="font-semibold">加工执行</h2>${executionActions(order, pda)}</section><div data-stenter-detail-part="rolls">${renderStenterRolls(order)}</div><details ${pda ? '' : 'open'} class="rounded-lg border bg-white"><summary class="cursor-pointer px-4 py-3 font-semibold">基本信息与要求</summary><div data-stenter-detail-part="base">${renderStenterBase(order, pda, !pda || pdaCanAct(order, 'target'))}</div></details><details class="rounded-lg border bg-white"><summary class="cursor-pointer px-4 py-3 font-semibold">操作日志</summary><div data-stenter-detail-part="logs">${renderStenterLogs(listFactoryQcActions(order.id))}</div></details><section class="space-y-3 rounded-lg border bg-white p-4"><h2 class="font-semibold">打印</h2><div class="flex flex-wrap gap-2">${stenterButton('预览加工单', 'print-order', actionAttrs(order.id))}${stenterButton('预览产出卷标', 'print-labels', actionAttrs(order.id))}</div><div data-stenter-print-slot></div></section>`
}
function refreshDetail(root: HTMLElement, order: StenterHandfeelOrder): void {
  const template = document.createElement('template'); template.innerHTML = detailParts(order, root.dataset.stenterPda === 'true')
  root.querySelectorAll<HTMLElement>('[data-stenter-detail-part]').forEach(current => { const next = template.content.querySelector<HTMLElement>(`[data-stenter-detail-part="${current.dataset.stenterDetailPart}"]`); if (next) current.replaceChildren(...next.childNodes) })
  const preview = root.querySelector('[data-stenter-print-slot]'); if (preview) preview.replaceChildren()
  installStenterImages()
}
export async function renderStenterHandfeelListPage(pda = false): Promise<string> {
  try {
    await ensureFactoryQcRecords()
    if (typeof document === 'undefined' || !document.querySelector('[data-stenter-list-root]')) { ui.page = 1; sort = null }
    const html = `<section class="min-w-0" data-stenter-list-root data-stenter-pda="${pda}">${listContent(pda)}</section>`
    installStenterImages()
    if (pda) return (await import('../../../pda-shell.ts')).renderPdaFrame(html, 'exec', { headerTitle: '定型机手感单' })
    return html
  } catch (failure) { return `<div class="p-4 text-red-700" role="alert">定型机手感单未读取：${e(failure instanceof Error ? failure.message : String(failure))}。恢复存储访问后重新打开。</div>` }
}
export async function renderStenterHandfeelDetailPage(id: string, pda = false): Promise<string> {
  try {
    await ensureFactoryQcRecords(); const order = getStenterHandfeelOrder(id)
    if (!order) return '<p class="p-4 text-amber-800" role="alert">定型机手感单不存在，请核对单号。</p>'
    const html = `<section class="min-w-0 space-y-3 p-3 sm:p-4" data-stenter-detail-root="${e(order.id)}" data-stenter-pda="${pda}"><header class="flex flex-wrap items-center justify-between gap-3"><h1 class="text-xl font-semibold">定型机手感单 · ${e(order.no)}</h1>${stenterLink('返回列表', pda ? STENTER_PDA_ROUTE : STENTER_ROUTE)}</header>${errorHtml()}${detailParts(order, pda)}<div data-stenter-operation-slot></div></section>`
    installStenterImages()
    if (pda) return (await import('../../../pda-shell.ts')).renderPdaFrame(html, 'exec', { headerTitle: '定型机手感单' })
    return html
  } catch (failure) { return `<p class="p-4 text-red-700" role="alert">定型机手感单未读取：${e(failure instanceof Error ? failure.message : String(failure))}。</p>` }
}
function openImage(trigger: HTMLElement): void {
  const dialog = document.createElement('dialog'); dialog.className = 'm-auto max-h-[95dvh] w-[95vw] max-w-5xl rounded-lg border p-3 backdrop:bg-black/50'; dialog.setAttribute('aria-label', trigger.dataset.imageTitle || '面料大图')
  dialog.innerHTML = `<div class="flex justify-end">${stenterButton('关闭大图', 'close-image')}</div><p class="text-sm" data-stenter-image-message>图片加载中</p><img class="mx-auto max-h-[80dvh] max-w-full object-contain" alt="${e(trigger.dataset.imageTitle || '面料图片')}">`
  const image = dialog.querySelector('img')!, message = dialog.querySelector('[data-stenter-image-message]')!
  image.onload = () => { message.textContent = '' }; image.onerror = () => { message.textContent = '图片加载失败，请关闭后重试。' }; image.src = trigger.dataset.imageUrl || ''
  const close = () => { dialog.close(); dialog.remove(); if (trigger.isConnected) trigger.focus() }
  dialog.addEventListener('cancel', event => { event.preventDefault(); close() }); dialog.addEventListener('click', event => { if (event.target === dialog || (event.target as HTMLElement).closest('[data-stenter-handfeel-action="close-image"]')) { event.stopPropagation(); close() } })
  document.body.append(dialog); dialog.showModal(); dialog.querySelector('button')!.focus()
}
async function printPreview(root: HTMLElement): Promise<void> {
  const preview = root.querySelector<HTMLElement>('[data-stenter-print-document]')
  if (!preview) throw new Error('先打开加工单或产出卷标预览。')
  if (!preview.querySelector('img')) throw new Error('尚无实际产出卷标，不能打印。')
  const clone = preview.cloneNode(true) as HTMLElement
  clone.querySelectorAll<HTMLImageElement>('img').forEach(img => { if (!img.getAttribute('src')) throw new Error('缺少对应面料图片，补充后打印。'); img.src = new URL(img.getAttribute('src')!, location.href).href })
  const frame = document.createElement('iframe'); frame.title = '定型机手感单打印 / PDF'; frame.style.cssText = 'position:fixed;left:-10000px;width:794px;height:1123px;border:0'; frame.dataset.stenterPrintFrame = 'true'
  document.body.append(frame)
  try {
    const loaded = new Promise<void>((resolve, reject) => { const timeout = setTimeout(() => reject(new Error('打印预览加载超时，请重试。')), 10000); frame.onload = () => { clearTimeout(timeout); resolve() } })
    frame.srcdoc = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>定型机手感单 ${e(root.dataset.stenterDetailRoot || '')}</title><style>@page{size:A4;margin:12mm}body{font:13px Arial,"PingFang SC",sans-serif;color:#000;margin:0}h2{font-size:20px}table{width:100%;border-collapse:collapse}td,th{padding:7px;border:1px solid #aaa;vertical-align:top;overflow-wrap:anywhere}img{width:100px;height:100px;object-fit:contain}svg{display:block;width:230px;height:48px}p{margin:7px 0}tr,.stenter-label{break-inside:avoid}.stenter-label{border:1px solid #aaa;margin:10px 0;padding:12px}.stenter-print-summary{display:flex;align-items:flex-start;gap:14px;margin-bottom:16px}thead{display:table-header-group}</style></head><body>${clone.outerHTML}</body></html>`
    await loaded
    await Promise.race([Promise.all([...frame.contentDocument!.images].map(img => img.decode().then(() => { if (!img.naturalWidth) throw new Error('面料图片未加载。') }))), new Promise<never>((_, reject) => setTimeout(() => reject(new Error('面料图片未加载完成，未打开打印。')), 10000))])
    frame.contentWindow!.addEventListener('afterprint', () => frame.remove(), { once: true }); frame.contentWindow!.focus(); frame.contentWindow!.print()
  } catch (failure) { frame.remove(); throw failure }
}
export async function handleStenterHandfeelEvent(target: HTMLElement, event?: Event): Promise<boolean> {
  const trigger = target.closest<HTMLElement>('[data-stenter-handfeel-action],[data-stenter-handfeel-field]')
  if (!trigger) return !!target.closest('[data-stenter-list-root],[data-stenter-detail-root]')
  if (trigger.dataset.stenterHandfeelAction === 'image') { if (!event || event.type === 'click') openImage(trigger); return true }
  const root = trigger.closest<HTMLElement>('[data-stenter-list-root],[data-stenter-detail-root]')
  if (!root) return false
  if (event && !['click', 'change'].includes(event.type)) return true
  if (event?.type === 'click' && trigger.matches('select,input[type="checkbox"]')) return true
  const action = trigger.dataset.stenterHandfeelAction || '', error = root.querySelector<HTMLElement>('[data-stenter-error]')
  if (error) error.textContent = ''
  try {
    if (action === 'query') { ui.query = root.querySelector<HTMLInputElement>('[data-stenter-filter="query"]')!.value.trim(); ui.handFeel = root.querySelector<HTMLSelectElement>('[data-stenter-filter="handFeel"]')!.value; ui.status = root.querySelector<HTMLSelectElement>('[data-stenter-filter="status"]')!.value; ui.page = 1; refreshList(root); return true }
    if (action === 'reset') { ui.query = ''; ui.handFeel = ''; ui.status = ''; ui.page = 1; refreshList(root, true); return true }
    if (action === 'prev-page' || action === 'next-page') { ui.page += action === 'next-page' ? 1 : -1; refreshList(root); return true }
    if (trigger.dataset.stenterHandfeelField === 'pageSize') { const value = Number((trigger as HTMLSelectElement).value); if (![10, 20, 50].includes(value)) return true; ui.pageSize = value; ui.page = 1; if (preferences) { preferences.pageSize = value; saveListColumnPreferences(preferenceStorage, preferenceKey, preferences) }; refreshList(root); return true }
    if (action === 'columns' || action === 'close-column-settings') { ui.columnsOpen = action === 'columns'; refreshList(root); if (!ui.columnsOpen) root.querySelector<HTMLElement>('[data-stenter-handfeel-action="columns"]')?.focus(); return true }
    if (action === 'restore-column-settings') { preferences = undefined; preferenceStorage.setItem(preferenceKey, 'null'); refreshList(root); return true }
    if (action === 'sort-column') { const key = trigger.dataset.columnKey!; sort = sort?.key !== key ? { key, direction: 'asc' } : sort.direction === 'asc' ? { key, direction: 'desc' } : null; refreshList(root); root.querySelector<HTMLElement>(`[data-stenter-handfeel-action="sort-column"][data-column-key="${CSS.escape(key)}"]`)?.focus(); return true }
    if ((action === 'toggle-column-visibility' || action === 'toggle-column-freeze') && preferences) { const key = trigger.dataset.stenterHandfeelColumnKey!, field = action === 'toggle-column-visibility' ? 'visibleKeys' : 'frozenKeys'; preferences[field] = preferences[field].includes(key) ? preferences[field].filter(value => value !== key) : [...preferences[field], key]; preferences = normalizeListColumnPreferences(activeColumns, preferences, [10, 20, 50]); saveListColumnPreferences(preferenceStorage, preferenceKey, preferences); refreshList(root); root.querySelector<HTMLElement>(`[data-stenter-handfeel-action="${action}"][data-stenter-handfeel-column-key="${CSS.escape(key)}"]`)?.focus(); return true }
    const id = trigger.dataset.stenterOrderId || root.dataset.stenterDetailRoot
    if (!id) return true
    const order = getStenterHandfeelOrder(id); if (!order) throw new Error('加工单不存在，请重新读取。')
    if (action === 'more-rolls') { const offset = Number(trigger.dataset.stenterRollOffset || 20), next = Math.min(order.rolls.length, offset + 20); root.querySelector('[data-stenter-roll-cards]')!.insertAdjacentHTML('beforeend', renderStenterRollCards(order, offset)); trigger.dataset.stenterRollOffset = String(next); root.querySelector('[data-stenter-roll-count]')!.textContent = `已显示 ${next} / ${order.rolls.length} 卷`; if (next >= order.rolls.length) { trigger.remove(); root.querySelector<HTMLElement>('[data-stenter-roll-count]')!.setAttribute('tabindex', '-1'); root.querySelector<HTMLElement>('[data-stenter-roll-count]')!.focus({ preventScroll: true }) }; return true }
    if (isStenterExecutionAction(action) || action === 'target' || action === 'complete' || action === 'continue') {
      if (root.dataset.stenterPda === 'true' && !pdaCanAct(order, action)) throw new Error('当前工厂不能代其他工厂登记本项实物操作。')
      openStenterExecutionDialog(root, order, action, { trigger, submit: submitStenterHandfeelCommand, saved: command => { if (root.dataset.stenterDetailRoot) refreshDetail(root, getStenterHandfeelOrder(id)!); else refreshList(root); const result = root.querySelector<HTMLElement>('[data-stenter-result]'); if (result) { result.textContent = order.no + ' · 已保存：' + stenterActionName(command.type); result.focus({ preventScroll: true }) } } }); installStenterImages(); return true
    }
    if (action === 'print-order' || action === 'print-labels') {
      if (action === 'print-labels' && !order.rolls.some(roll => roll.outputBarcode)) throw new Error('尚无实际产出卷码，无法生成产出卷标。')
      const documentKind = action === 'print-labels' ? 'TRANSFER' : 'ORDER', key = order.id + ':' + order.version + ':' + documentKind
      let operationId = printOperations.get(key); if (!operationId) { operationId = crypto.randomUUID(); printOperations.set(key, operationId) }
      while (printOperations.size > 100) printOperations.delete(printOperations.keys().next().value!)
      ;(trigger as HTMLButtonElement).disabled = true
      try { await submitStenterHandfeelCommand({ type: 'PRINT', orderId: order.id, expectedVersion: order.version, document: documentKind }, operationId) } finally { (trigger as HTMLButtonElement).disabled = false }
      const current = getStenterHandfeelOrder(order.id)!, slot = root.querySelector<HTMLElement>('[data-stenter-print-slot]')!
      slot.innerHTML = `<div class="space-y-3 overflow-x-auto rounded border p-3"><p class="text-sm text-slate-500">已记录预览生成；实际打印或保存PDF由浏览器操作完成。</p>${stenterButton('打印 / 保存PDF', 'print-browser', actionAttrs(order.id), true)}${renderStenterPrint(current, action === 'print-labels')}</div>`
      const logs = root.querySelector<HTMLElement>('[data-stenter-detail-part="logs"]'); if (logs) logs.innerHTML = renderStenterLogs(listFactoryQcActions(order.id))
      return true
    }
    if (action === 'print-browser') { await printPreview(root); return true }
    return true
  } catch (failure) { if (error) { error.textContent = failure instanceof Error ? failure.message : String(failure); error.scrollIntoView({ block: 'nearest' }) }; return true }
}
if (typeof document !== 'undefined') {
  let dragging = ''
  document.addEventListener('dragstart', event => { dragging = (event.target as HTMLElement).closest<HTMLElement>('[data-stenter-handfeel-column-key][draggable="true"]')?.dataset.stenterHandfeelColumnKey || '' })
  document.addEventListener('dragover', event => { if (dragging && (event.target as HTMLElement).closest('[data-stenter-handfeel-column-key]')) event.preventDefault() })
  document.addEventListener('drop', event => { const node = (event.target as HTMLElement).closest<HTMLElement>('[data-stenter-handfeel-column-key]'), root = node?.closest<HTMLElement>('[data-stenter-list-root]'); if (!dragging || !node || !root || !preferences) return; event.preventDefault(); const next = preferences.order.filter(key => key !== dragging), index = next.indexOf(node.dataset.stenterHandfeelColumnKey!); if (index >= 0) { next.splice(index, 0, dragging); preferences.order = next; saveListColumnPreferences(preferenceStorage, preferenceKey, preferences); refreshList(root) }; dragging = '' })
}
