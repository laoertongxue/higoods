import { escapeHtml } from '../../utils.ts'
import { renderStandardListColumnSettings, renderStandardListTable, type StandardListColumn } from '../../components/ui/list-table.ts'
import { loadListColumnPreferences, normalizeListColumnPreferences, paginateStandardListRows, saveListColumnPreferences, sortStandardListRows, type StandardListColumnPreferences, type StandardListSortState } from '../../components/ui/list-table-model.ts'
import { renderTablePagination } from '../../components/ui/pagination.ts'
import { getChannelStore, listChannelStores } from '../../data/pcs-channel-store-repository.ts'
import type { FeedbackCounts, FeedbackExecution, FeedbackSnapshot } from '../../data/product-feedback/types.ts'
import { bindFeedbackScrollMemory } from './insights-shared.ts'
export { renderFeedbackFilters } from './insights-shared.ts'

export const h = escapeHtml
export function restoreOperationsScroll(prefix: string): void { requestAnimationFrame(() => bindFeedbackScrollMemory(prefix)) }
export const buttonClass = 'inline-flex min-h-9 items-center justify-center rounded-md border bg-background px-3 text-sm font-medium hover:bg-muted disabled:opacity-50'
export const time = (value: string | null | undefined) => value ? new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(new Date(value)) : '未取得'
export const day = (value: string) => time(value).slice(0, 10)
export const offsetDay = (value: string, offset: number) => new Date(Date.parse(`${value}T00:00:00Z`) + offset * 86400000).toISOString().slice(0, 10)
export const storeName = (id: string) => getChannelStore(id)?.storeName || id
export const storeCode = (id: string) => getChannelStore(id)?.externalStoreId || '未取得'
export const stores = (snapshot: FeedbackSnapshot) => [...new Set(snapshot.schedules.map(row => row.storeId))].map(id => ({ value: id, label: storeName(id) }))
export const availableStores = () => listChannelStores().filter(row => row.channelCode === 'tiktok' && row.marketCode === 'ID').map(row => ({ value: row.id, label: `${row.storeName} · ${row.externalStoreId}` }))
export const pct = (value: number | null) => value === null ? '不适用' : `${(value * 100).toFixed(1)}%`
export const button = (prefix: string, action: string, label: string, extra = '', primary = false) => `<button type="button" class="${primary ? buttonClass.replace('bg-background ', '').replace('hover:bg-muted ', '') + ' border-blue-600 bg-blue-600 text-white hover:bg-blue-700' : buttonClass}" data-${prefix}-action="${action}" data-skip-page-rerender="true" ${extra}>${h(label)}</button>`
export const link = (url: string, label: string) => `<a class="inline-flex min-h-8 items-center text-blue-600 hover:underline" href="${h(url)}" data-nav>${h(label)}</a>`
export const badge = (label: string) => `<span class="inline-flex rounded border px-2 py-0.5 text-xs ${/失败|逾期|异常/.test(label) ? 'border-red-200 bg-red-50 text-red-700' : /已完成|处理完成|范围完成|已启用|按时/.test(label) ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}">${h(label)}</span>`
export const field = (prefix: string, key: string, label: string, value: string, type = 'text', form = false) => `<label class="block min-w-0 text-xs text-muted-foreground">${h(label)}<input aria-label="${h(label)}" class="mt-1 block h-9 w-full rounded-md border bg-background px-2 text-sm text-foreground" type="${type}" value="${h(value)}" data-${prefix}-${form ? 'form' : 'field'}="${key}" data-skip-page-rerender="true"></label>`
export const select = (prefix: string, key: string, label: string, value: string, options: Array<{ value: string; label: string } | string>, form = false, all = true) => `<label class="block min-w-0 text-xs text-muted-foreground">${h(label)}<select aria-label="${h(label)}" class="mt-1 block h-9 w-full rounded-md border bg-background px-2 text-sm text-foreground" data-${prefix}-${form ? 'form' : 'field'}="${key}" data-skip-page-rerender="true">${all ? '<option value="">全部</option>' : ''}${options.map(option => { const o = typeof option === 'string' ? { value: option, label: option } : option; return `<option value="${h(o.value)}"${value === o.value ? ' selected' : ''}>${h(o.label)}</option>` }).join('')}</select></label>`
export const textarea = (prefix: string, key: string, label: string, value: string) => `<label class="block text-xs text-muted-foreground">${h(label)}<textarea aria-label="${h(label)}" class="mt-1 min-h-24 w-full rounded-md border bg-background p-2 text-sm text-foreground" data-${prefix}-form="${key}" data-skip-page-rerender="true">${h(value)}</textarea></label>`
export const detail = (pairs: Array<[string, unknown]>) => `<dl class="grid grid-cols-1 gap-3 rounded-lg border p-4 sm:grid-cols-2">${pairs.map(([label, value]) => `<div class="min-w-0"><dt class="text-xs text-muted-foreground">${h(label)}</dt><dd class="mt-1 break-words text-sm">${h(String(value ?? '未取得'))}</dd></div>`).join('')}</dl>`
export function renderExecutionDelivery(execution: FeedbackExecution, snapshot: FeedbackSnapshot): string {
  const terminal = execution.terminalReceipt
  if (!terminal) return errorBox('尚未收到完整上传清单')
  const missing = terminal.batches.filter(item => { const batch = snapshot.batches.find(row => row.id === item.batchId && row.executionId === execution.id); return !batch?.durable || item.rowIds.length !== batch.rows.length || item.rowIds.some(id => !batch.rows.some(row => row.id === id)) })
  return `<section class="space-y-2 rounded border p-3"><h4 class="font-semibold">上传清单</h4>${detail([['声明批次 / 原始记录', `${terminal.batches.length} 批 / ${terminal.rawCount} 条`], ['终结时间', time(terminal.endedAt)], ['清单接收时间', time(terminal.persistedAt)], ['终结依据', terminal.evidence], ['交付缺口', missing.length ? `尚未齐备 ${missing.length} 批` : '清单内批次与原始记录已齐备']])}<div class="space-y-1 break-all text-xs">${terminal.batches.map(item => `<p>${h(item.batchId)} · ${item.rowIds.length} 条原始记录${missing.some(row => row.batchId === item.batchId) ? ' · 尚未齐备' : ' · 已接收'}</p>`).join('')}</div></section>`
}
export const note = (text: string) => `<p class="text-sm text-muted-foreground">${h(text)}</p>`
export const errorBox = (text: string) => text ? `<p role="alert" class="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">${h(text)}</p>` : ''
export const countRows = (rows: Array<{ outcome: string }>): FeedbackCounts => { const result: FeedbackCounts = { U: rows.length, N: 0, M: 0, D: 0, X: 0, F: 0, P: 0 }; rows.forEach(row => { if (row.outcome in result && row.outcome !== 'U') result[row.outcome as Exclude<keyof FeedbackCounts, 'U'>]++ }); return result }
export const countsText = (counts: FeedbackCounts) => `上报 ${counts.U} · 新增 ${counts.N} · 更新 ${counts.M} · 重复 ${counts.D} · 排除 ${counts.X} · 失败 ${counts.F} · 待处理 ${counts.P}`
export const countsCard = (counts: FeedbackCounts) => `<div class="grid grid-cols-4 gap-2">${Object.entries(counts).map(([key, value]) => `<div class="rounded border p-2 text-center text-xs"><span>${({ U: '上报', N: '新增', M: '更新', D: '重复', X: '排除', F: '失败', P: '待处理' } as Record<string, string>)[key]}</span><strong class="mt-1 block text-lg">${value}</strong></div>`).join('')}</div>`
export function exportCsv(name: string, rows: unknown[][]): void {
  const csv = rows.map(row => row.map(value => { const str = String(value ?? ''); return `"${(/^[=+@\-\t\r]/.test(str) ? "'" + str : str).replaceAll('"', '""')}"` }).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })), a = document.createElement('a')
  a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export interface ListState { page: number; sort: StandardListSortState | null; preferences: StandardListColumnPreferences | null }
export const listState = (): ListState => ({ page: 1, sort: null, preferences: null })
const preferenceStorage = { getItem(key: string): string | null { try { return window.localStorage.getItem(key) } catch { return null } }, setItem(key: string, value: string): void { try { window.localStorage.setItem(key, value) } catch { /* 有界列偏好失败不影响业务事实。 */ } }, removeItem(key: string): void { try { window.localStorage.removeItem(key) } catch { /* 仍使用当前会话的默认偏好。 */ } } }
export function preferences<T>(state: ListState, prefix: string, columns: StandardListColumn<T>[]): StandardListColumnPreferences {
  const defaults = { order: columns.map(c => c.key), visibleKeys: columns.filter(c => !c.key.startsWith('extra-')).map(c => c.key), frozenKeys: columns.filter(c => c.freezeable).slice(0, 2).map(c => c.key), pageSize: 20 }
  if (!state.preferences) state.preferences = loadListColumnPreferences(preferenceStorage, `higood-${prefix}-columns-v1`, columns, defaults, [10, 20])
  return state.preferences
}
function prepareOperationsList<T>(state: ListState, preferencePrefix: string, columns: StandardListColumn<T>[], rows: T[]) {
  const prefs = preferences(state, preferencePrefix, columns), sorted = sortStandardListRows(rows, state.sort, (row, key) => columns.find(c => c.key === key)?.sortValue?.(row)), page = paginateStandardListRows(sorted, state.page, prefs.pageSize)
  state.page = page.currentPage
  return { prefs, page }
}
export function renderOperationsTable<T>(state: ListState, preferencePrefix: string, columns: StandardListColumn<T>[], rows: T[], eventPrefix = preferencePrefix): string {
  const { prefs, page } = prepareOperationsList(state, preferencePrefix, columns, rows)
  return renderStandardListTable({ columns, rows: page.rows, preferences: prefs, sort: state.sort, eventPrefix, skipPageRerender: true, emptyText: '当前条件下没有结果，可调整条件或重置。' })
}
export function renderOperationsPagination<T>(state: ListState, preferencePrefix: string, columns: StandardListColumn<T>[], rows: T[], eventPrefix = preferencePrefix): string {
  const { page } = prepareOperationsList(state, preferencePrefix, columns, rows)
  return renderTablePagination({ ...page, actionPrefix: eventPrefix, pageSizeOptions: [10, 20], skipPageRerender: true })
}
export function columnDialog<T>(state: ListState, prefix: string, columns: StandardListColumn<T>[]): string {
  const prefs = preferences(state, prefix, columns)
  const order = prefs.order.filter(key => columns.some(c => c.key === key && !c.actionColumn))
  const moves = `<div class="border-t p-3 text-xs"><p class="mb-2">列顺序：可拖动，或使用以下上下移动按钮。</p>${order.map((key, index) => `<div class="flex items-center justify-between gap-2 py-1"><span>${h(columns.find(c => c.key === key)?.title || key)}</span><span>${button(prefix, 'move-column-up', '上移', `data-column-key="${h(key)}" ${index === 0 ? 'disabled' : ''}`)} ${button(prefix, 'move-column-down', '下移', `data-column-key="${h(key)}" ${index === order.length - 1 ? 'disabled' : ''}`)}</span></div>`).join('')}</div>`
  return renderStandardListColumnSettings({ title: '列设置', columns, preferences: prefs, eventPrefix: prefix, maxFrozenWidth: 460, skipPageRerender: true }).replace('<div class="fixed inset-0 z-50">', '<div class="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="列设置" tabindex="-1">').replace('<div class="p-6">', `<div class="p-6">${moves}`)
}
export function listAction<T>(node: HTMLElement, action: string, state: ListState, prefix: string, columns: StandardListColumn<T>[]): boolean {
  const prefs = preferences(state, prefix, columns), persist = () => { state.preferences = normalizeListColumnPreferences(columns, prefs, [10, 20]); saveListColumnPreferences(preferenceStorage, `higood-${prefix}-columns-v1`, state.preferences) }
  if (action === 'sort-column') { const key = node.dataset.columnKey || ''; state.sort = state.sort?.key !== key ? { key, direction: 'asc' } : state.sort.direction === 'asc' ? { key, direction: 'desc' } : null; state.page = 1; return true }
  if (action === 'prev-page' || action === 'next-page') { state.page = Math.max(1, state.page + (action === 'next-page' ? 1 : -1)); return true }
  if (action === 'restore-column-settings') { state.preferences = null; preferenceStorage.removeItem(`higood-${prefix}-columns-v1`); state.sort = null; return true }
  const key = node.getAttribute(`data-${prefix}-column-key`) || node.dataset.columnKey || '', col = columns.find(c => c.key === key)
  if (!col) return false
  if (action === 'toggle-column-visibility' && !col.required && !col.actionColumn) prefs.visibleKeys = (node as HTMLInputElement).checked ? [...new Set([...prefs.visibleKeys, key])] : prefs.visibleKeys.filter(k => k !== key)
  else if (action === 'toggle-column-freeze' && col.freezeable) prefs.frozenKeys = (node as HTMLInputElement).checked ? [...new Set([...prefs.frozenKeys, key])] : prefs.frozenKeys.filter(k => k !== key)
  else if (action === 'move-column-up' || action === 'move-column-down') { const at = prefs.order.indexOf(key), next = at + (action === 'move-column-up' ? -1 : 1); if (next >= 0 && next < prefs.order.length && !columns.find(c => c.key === prefs.order[next])?.actionColumn) [prefs.order[at], prefs.order[next]] = [prefs.order[next]!, prefs.order[at]!] }
  else if (action === 'reorder-column') { const target = node.dataset.dropTarget || ''; if (!columns.some(c => c.key === target && !c.actionColumn) || col.actionColumn) return false; const order = prefs.order.filter(value => value !== key), index = order.indexOf(target); if (index < 0) return false; order.splice(index, 0, key); prefs.order = order }
  else return false
  persist(); return true
}
export function pageSize<T>(state: ListState, prefix: string, columns: StandardListColumn<T>[], value: string): void { const prefs = preferences(state, prefix, columns); prefs.pageSize = [10, 20].includes(Number(value)) ? Number(value) : 20; state.page = 1; saveListColumnPreferences(preferenceStorage, `higood-${prefix}-columns-v1`, prefs) }
export function drawer(prefix: string, title: string, content: string, footer = ''): string { return `<div class="fixed inset-0 z-50 flex justify-end bg-slate-950/35"><button class="absolute inset-0" aria-label="关闭详情" data-${prefix}-action="close-dialog" data-skip-page-rerender="true"></button><section role="dialog" aria-modal="true" aria-label="${h(title)}" tabindex="-1" class="relative flex h-full w-full max-w-[840px] flex-col bg-background shadow-xl"><header class="flex shrink-0 items-center justify-between gap-3 border-b p-4"><h2 class="text-lg font-semibold">${h(title)}</h2>${button(prefix, 'close-dialog', '关闭')}</header><div class="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">${content}</div>${footer ? `<footer class="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t bg-background p-4">${footer}</footer>` : ''}</section></div>` }
const focusReturn = new Map<string, HTMLElement | null>()
export function replaceOverlay(prefix: string, html: string, busy = false): void {
  const el = document.querySelector<HTMLElement>(`[data-${prefix}-overlay]`); if (!el) return
  const wasOpen = Boolean(el.querySelector('[role="dialog"]')); if (html && !wasOpen) focusReturn.set(prefix, document.activeElement instanceof HTMLElement ? document.activeElement : null)
  el.innerHTML = html
  if (busy) el.querySelectorAll<HTMLInputElement>('input,select,textarea,button').forEach(field => { field.disabled = true })
  if (html) el.querySelector<HTMLElement>('[role="dialog"]')?.focus({ preventScroll: true })
  else {
    const original = focusReturn.get(prefix), action = original?.getAttribute(`data-${prefix}-action`), id = original?.dataset.id
    const equivalent = original?.isConnected ? original : [...document.querySelectorAll<HTMLElement>(`[data-${prefix}-action]`)].find(node => node.getAttribute(`data-${prefix}-action`) === action && node.dataset.id === id)
    equivalent?.focus({ preventScroll: true }); focusReturn.delete(prefix)
  }
}
export function setQueryObject(key: string, value: string | null): void { const url = new URL(window.location.href); if (value) url.searchParams.set(key, value); else url.searchParams.delete(key); window.history.replaceState(window.history.state, '', url) }
export function installColumnDrag(prefix: string, action: (node: HTMLElement) => Promise<boolean>): void {
  let source = ''
  document.addEventListener('dragstart', event => { const node = event.target instanceof Element ? event.target.closest<HTMLElement>(`[data-${prefix}-page] [data-standard-list-column-drag]`) : null; if (!node) return; source = node.dataset.dragSource || ''; event.dataTransfer?.setData('text/plain', source); event.stopPropagation() }, true)
  document.addEventListener('dragover', event => { if (event.target instanceof Element && event.target.closest(`[data-${prefix}-page] [data-drop-target]`)) { event.preventDefault(); event.stopPropagation() } }, true)
  document.addEventListener('drop', event => { const target = event.target instanceof Element ? event.target.closest<HTMLElement>(`[data-${prefix}-page] [data-drop-target]`) : null; if (!target || !source) return; event.preventDefault(); event.stopPropagation(); const node = document.createElement('button'); node.setAttribute(`data-${prefix}-action`, 'reorder-column'); node.dataset.columnKey = source; node.dataset.dropTarget = target.dataset.dropTarget || ''; source = ''; void action(node) }, true)
}
export function installKeyboard(prefix: string, query: () => void, close: () => void, dirty?: () => boolean, leave?: () => boolean): void {
  // Escape 由 PCS 统一关闭入口处理，避免未保存确认弹出两次。
  void close
  document.addEventListener('keydown', event => { const root = document.querySelector(`[data-${prefix}-page]`); if (!root) return; const target = event.target instanceof Element ? event.target : null; if (event.key === 'Enter' && target?.matches(`[data-${prefix}-field]`)) { event.preventDefault(); query() } if (event.key === 'Tab') { const dialog = document.querySelector<HTMLElement>(`[data-${prefix}-overlay] [role="dialog"]`); if (!dialog) return; const items = [...dialog.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled)')]; if (!items.length) return; const first = items[0]!, last = items[items.length - 1]!; if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) { event.preventDefault(); last.focus() } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() } } })
  if (dirty) { window.addEventListener('beforeunload', event => { if (document.querySelector(`[data-${prefix}-page]`) && dirty()) { event.preventDefault(); event.returnValue = '' } }); document.addEventListener('click', event => { const target = event.target instanceof Element ? event.target : null; if (document.querySelector(`[data-${prefix}-page]`) && dirty() && target?.closest('a[href],a[data-nav],[data-action="open-tab"],[data-action="activate-tab"],[data-action="close-tab"],[data-action="close-all-tabs"],[data-action="switch-system"]') && !(leave ? leave() : window.confirm('尚有未保存的输入，确定放弃并离开？'))) { event.preventDefault(); event.stopImmediatePropagation() } }, true) }
}
