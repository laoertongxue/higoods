// @page-pattern: list
import { cuttingRecordUuid } from '../../../data/fcs/cutting/cutting-record-identity.ts'
import { escapeHtml as e } from '../../../utils.ts'
import { renderStandardListPage, renderStandardListStats } from '../../../components/ui/list-page.ts'
import { renderStandardListTable, renderStandardListColumnSettings, type StandardListColumn } from '../../../components/ui/list-table.ts'
import { normalizeListColumnPreferences, paginateStandardListRows, sortStandardListRows, type StandardListColumnPreferences, type StandardListSortState } from '../../../components/ui/list-table-model.ts'
import { renderTablePagination } from '../../../components/ui/pagination.ts'
import { listReplacementFabricOrderRows, type ReplacementFabricOrderRow } from '../../../data/fcs/cutting/replacement-fabric-source.ts'
import { loadReplacementFabricState, addReplacementFabricTickets } from '../../../data/fcs/cutting/replacement-fabric-repository.ts'
import type { ReplacementFabricMaterial, ReplacementFabricState, ReplacementFabricTicket } from '../../../data/fcs/cutting/replacement-fabric-fei-tickets.ts'
import { loadReplacementFabricDataInformation, renderReplacementFabricDataTools, handleReplacementFabricDataTools, isReplacementFabricDataToolBusy } from './replacement-fabric-data-tools.ts'

export const REPLACEMENT_FABRIC_ROUTE = '/fcs/craft/cutting/replacement-fabric-fei-tickets'
const preferenceKey = `${REPLACEMENT_FABRIC_ROUTE}:columns`
const pageSizes = [10, 20, 50]
let rows: ReplacementFabricOrderRow[] = []
let records: ReplacementFabricState = { tickets: [], prints: [], receipts: [] }
let filter = { order: '', material: '', status: '' }
let history = false; let historyQuery = ''; let historyPage = 1
let page = 1; let ticketPage = 1; let sort: StandardListSortState | null = null
let preferences: StandardListColumnPreferences | null = null
let orderMode: 'print' | 'detail' = 'print'
let activeOrder = ''; let settings = false; let feedback = ''; let error = false; let busy = false
let dataTools = false
let enlargedTicketId = ''
let labelTemplate: typeof import('../../print/templates/replacement-fabric-label-template.ts') | null = null
let hydrateTicketQr: typeof import('../../../components/real-qr.ts').hydrateRealQRCodes | null = null
const selected = new Set<string>()
const button = (label: string, action: string, extra = '') => `<button type="button" class="rounded border bg-white px-3 py-2 text-sm text-blue-700 disabled:opacity-50" data-hpb-action="${action}" ${extra}>${label}</button>`
const pendingAdds = new Map<string, ReturnType<typeof command>>()
const command = () => ({ id: cuttingRecordUuid(), at: new Date().toISOString(), operator: '裁床打票员' })
export function renderReplacementFabricMaterial(material: ReplacementFabricMaterial): string {
  return `<div class="flex min-w-0 items-center gap-2 py-1"><div class="relative h-12 w-12 shrink-0 overflow-hidden rounded border">${material.imageUrl
    ? `<button type="button" class="h-full w-full" data-pda-image-preview-url="${e(material.imageUrl)}" data-pda-image-preview-title="${e(material.name + ' · ' + material.color)}"><img class="h-full w-full object-cover" src="${e(material.imageUrl)}" alt="${e(material.name + ' ' + material.color)}" onload="this.parentElement.nextElementSibling.hidden=true" onerror="this.hidden=true;this.parentElement.nextElementSibling.textContent='图片失败';this.parentElement.nextElementSibling.hidden=false"></button><span class="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/80 text-[10px]">加载中</span>`
    : '<span class="text-xs text-red-700">缺少素材</span>'}</div><div class="min-w-0 break-words text-sm"><strong>${e(material.name)}</strong><div class="text-xs text-slate-500">${e(material.code)} · ${e(material.color)}</div></div></div>`
}
function ticketsFor(row: ReplacementFabricOrderRow): ReplacementFabricTicket[] {
  return records.tickets.filter(ticket => ticket.productionOrderId === row.order.productionOrderId && !ticket.invalidatedAt
    && row.scopes.some(scope => scope.assignmentKey === ticket.assignmentKey && scope.factoryId === ticket.cuttingFactoryId && scope.materials.some(material => material.key === ticket.material.key)))
    .sort((left, right) => left.material.code.localeCompare(right.material.code) || left.material.color.localeCompare(right.material.color) || left.sequence - right.sequence)
}
function printed(id: string) { return records.prints.filter(record => record.ticketId === id) }
function status(row: ReplacementFabricOrderRow): string {
  if (row.issues.length) return '资料待核对'
  if (!row.materials.length) return '无需换片布'
  const tickets = ticketsFor(row); const count = tickets.filter(ticket => printed(ticket.id).length).length
  if (!count) return '待打印'
  return count === tickets.length ? '全部已打印' : '部分已打印'
}
const columns: StandardListColumn<ReplacementFabricOrderRow>[] = [
  { key: 'order', title: '来源生产单', width: 205, required: true, freezeable: true, sortable: true, render: row => `<strong>${e(row.order.productionOrderNo)}</strong><p class="text-xs text-slate-500">${e(row.scopes.map(scope => scope.factoryId).filter((id, i, all) => all.indexOf(id) === i).join('、'))}</p>`, sortValue: row => row.order.productionOrderNo },
  { key: 'materials', title: '面料（不含朴）', width: 330, required: true, freezeable: true, render: row => row.materials.map(renderReplacementFabricMaterial).join('') || e(row.issues.length ? '资料待核对' : '无需换片布') },
  { key: 'length', title: '每张长度', width: 110, render: () => '<strong>5 Yard</strong><p class="text-xs text-slate-500">固定长度</p>' },
  { key: 'count', title: '菲票 / 已打印', width: 130, sortable: true, render: row => `${ticketsFor(row).length} 张 / ${ticketsFor(row).filter(ticket => printed(ticket.id).length).length} 张`, sortValue: row => ticketsFor(row).length },
  { key: 'status', title: '打印状态', width: 140, sortable: true, render: row => `<span class="rounded bg-slate-100 px-2 py-1 text-xs">${status(row)}</span>${row.issues.length ? `<p class="mt-1 text-xs text-red-700">${e(row.issues.join('；'))}</p>` : ''}`, sortValue: status },
  { key: 'actions', title: '操作', width: 180, actionColumn: true, render: row => `<div class="flex items-center gap-2 whitespace-nowrap">${button('打印', 'print', `data-order-id="${e(row.order.productionOrderId)}"`)}${button('详情', 'detail', `data-order-id="${e(row.order.productionOrderId)}"`)}</div>` },
]
function defaults() { return { order: columns.map(column => column.key), visibleKeys: columns.map(column => column.key), frozenKeys: ['order'], pageSize: 10 } }
function prefs(): StandardListColumnPreferences {
  if (!preferences) { let raw = null; try { raw = JSON.parse(localStorage.getItem(preferenceKey) || 'null') } catch {}
    preferences = normalizeListColumnPreferences(columns, raw || defaults(), pageSizes) }
  return preferences
}
function matched() {
  return rows.filter(row => row.order.productionOrderNo.toLowerCase().includes(filter.order.toLowerCase())
    && (!filter.material || row.materials.some(material => `${material.name} ${material.code}`.toLowerCase().includes(filter.material.toLowerCase())))
    && (!filter.status || status(row) === filter.status))
}
function renderHistory(): string {
  const current = new Set(rows.flatMap(ticketsFor).map(ticket => ticket.id))
  const tickets = records.tickets.filter(ticket => (!current.has(ticket.id) || records.receipts.some(receipt => receipt.ticket.id === ticket.id))
    && `${ticket.ticketNo} ${ticket.material.name} ${ticket.material.code}`.toLowerCase().includes(historyQuery.toLowerCase()))
  const slice = paginateStandardListRows(tickets, historyPage, 10)
  return `<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3" data-hpb-backdrop><section role="dialog" aria-modal="true" aria-label="历史换片布票" class="flex max-h-[92vh] w-full max-w-4xl flex-col rounded-lg bg-white"><header class="flex items-center justify-between border-b p-4"><h2 class="font-semibold">历史换片布票</h2>${button('关闭', 'close')}</header><div class="space-y-3 overflow-auto p-4"><div class="flex gap-2"><input class="min-w-0 flex-1 rounded border p-2" data-hpb-history-query value="${e(historyQuery)}" placeholder="生产单、票号或面料" />${button('查询历史', 'history-query')}</div>${slice.rows.map(ticket => {
    const receipt = records.receipts.find(receipt => receipt.ticket.id === ticket.id)
    return `<article class="space-y-2 rounded border p-3">${renderReplacementFabricMaterial(ticket.material)}<p class="break-all font-semibold">${e(ticket.ticketNo)}</p><p>${e(ticket.productionOrderNo)} · 第 ${ticket.sequence} 张 · 5 Yard</p><p class="text-sm">${receipt ? `已交出 · 任务 ${e(receipt.taskId)} · 接收工厂 ${e(receipt.receiverFactoryId)} · ${e(receipt.confirmedAt)}` : '原裁床分配或面料范围已变更，旧票不可继续流转'}</p>${receipt ? button('补打原票', 'history-print', `data-ticket-id="${e(ticket.id)}"`) : '<span class="text-sm text-amber-800">失效票不允许打印、装袋或交出</span>'}</article>`
  }).join('') || '<p class="py-5 text-center text-slate-500">没有匹配的历史票</p>'}<div class="flex items-center gap-3">${button('上一页', 'history-prev', slice.currentPage === 1 ? 'disabled' : '')}<span>${slice.currentPage} / ${slice.totalPages} · 共 ${tickets.length} 张</span>${button('下一页', 'history-next', slice.currentPage === slice.totalPages ? 'disabled' : '')}</div></div></section></div>`
}
function renderOrderDetail(row: ReplacementFabricOrderRow): string {
  const currentIds = new Set(ticketsFor(row).map(ticket => ticket.id))
  const tickets = records.tickets.filter(ticket => ticket.productionOrderId === row.order.productionOrderId)
    .sort((a, b) => a.material.code.localeCompare(b.material.code) || a.sequence - b.sequence)
  const slice = paginateStandardListRows(tickets, ticketPage, 10)
  const printedCount = tickets.filter(ticket => printed(ticket.id).length).length
  const handedCount = tickets.filter(ticket => records.receipts.some(receipt => receipt.ticket.id === ticket.id)).length
  return `${labelTemplate?.replacementFabricPrintStyles() || ''}<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3" data-hpb-backdrop>
    <section role="dialog" aria-modal="true" aria-label="换片布菲票详情" class="flex max-h-[92vh] w-full max-w-5xl flex-col rounded-lg bg-white shadow-xl">
      <header class="flex items-center justify-between gap-3 border-b p-4"><div><h2 class="font-semibold">${e(row.order.productionOrderNo)} · 换片布菲票详情</h2><p class="mt-1 text-xs text-slate-500">预览实际菲票票面，并查看打印、交出记录；预览不会标记已打印。</p></div>${button('关闭', 'close')}</header>
      <div class="space-y-3 overflow-y-auto p-4">
        ${renderStandardListStats([{ label: '全部菲票', value: `${tickets.length} 张` }, { label: '已打印', value: `${printedCount} 张` }, { label: '已交出', value: `${handedCount} 张` }])}
        ${slice.rows.map(ticket => {
          const prints = [...printed(ticket.id)].sort((a, b) => a.printedAt.localeCompare(b.printedAt))
          const receipts = records.receipts.filter(receipt => receipt.ticket.id === ticket.id)
          const scopeLabel = currentIds.has(ticket.id) ? '当前票' : receipts.length ? '历史已交出票' : '已失效'
          return `<article class="space-y-3 rounded-lg border p-3" data-hpb-detail-ticket="${e(ticket.id)}">
            <div class="flex flex-wrap items-start justify-between gap-2"><div class="min-w-0"><strong class="break-all">${e(ticket.ticketNo)}</strong><p class="mt-1 text-xs text-slate-500">第 ${ticket.sequence} 张 · 5 Yard · 裁床工厂 ${e(ticket.cuttingFactoryId)}</p></div><span class="rounded bg-slate-100 px-2 py-1 text-xs">${scopeLabel}</span></div>
            ${scopeLabel === '已失效' ? `<p class="text-sm text-amber-800">${e(ticket.invalidReason || '裁床分配或面料范围已变更')}，不可继续打印、装袋或交出。</p>` : ''}
            <div class="grid items-start gap-4 lg:grid-cols-2">
              <section class="min-w-0 rounded bg-slate-100 p-3"><div class="flex items-center justify-between gap-2"><h3 class="text-sm font-semibold">菲票预览 · 100 × 100 mm</h3>${button('放大预览', 'preview-ticket', `data-ticket-id="${e(ticket.id)}"`)}</div><div class="overflow-x-auto" data-hpb-ticket-preview>${labelTemplate?.renderReplacementFabricLabel(ticket) || ''}</div>${scopeLabel === '已失效' ? '<p class="text-center text-sm text-amber-800">失效票 · 仅供查看，不可继续流转</p>' : ''}</section>
              <div class="min-w-0 space-y-3">
              <section class="min-w-0 rounded bg-slate-50 p-3"><h3 class="text-sm font-semibold">打印情况 · ${prints.length ? `已打印 ${prints.length} 次` : '待打印'}</h3>
                ${prints.length ? `<ol class="mt-2 space-y-2 text-sm">${prints.map(print => `<li class="break-words"><span>${print.kind === 'FIRST_PRINT' ? '首次打印' : '补打'}</span> · ${e(print.printedBy)}<time class="block text-xs text-slate-500">${e(print.printedAt)}</time></li>`).join('')}</ol>` : '<p class="mt-2 text-sm text-slate-500">暂无打印记录</p>'}
              </section>
              <section class="min-w-0 rounded bg-slate-50 p-3"><h3 class="text-sm font-semibold">交出情况 · ${receipts.length ? '已交出' : '未交出'}</h3>
                ${receipts.length ? receipts.map(receipt => `<dl class="mt-2 space-y-1 break-all text-sm"><div><dt class="inline text-slate-500">车缝任务：</dt><dd class="inline">${e(receipt.taskId)}</dd></div><div><dt class="inline text-slate-500">接收工厂：</dt><dd class="inline">${e(receipt.receiverFactoryId)}</dd></div><div><dt class="inline text-slate-500">交出时间：</dt><dd class="inline">${e(receipt.confirmedAt)}</dd></div><div><dt class="inline text-slate-500">确认人：</dt><dd class="inline">${e(receipt.confirmedBy)}</dd></div><div><dt class="inline text-slate-500">交出记录：</dt><dd class="inline">${e(receipt.handoverRecordId)}</dd></div>${receipt.bagUseId ? `<div><dt class="inline text-slate-500">中转袋使用记录：</dt><dd class="inline">${e(receipt.bagUseId)}</dd></div>` : ''}</dl>`).join('') : '<p class="mt-2 text-sm text-slate-500">暂无交出记录</p>'}
              </section>
              </div>
            </div>
          </article>`
        }).join('') || '<p class="py-5 text-center text-slate-500">尚未生成菲票，请先核对裁床分配。</p>'}
        <div class="flex items-center gap-3">${button('上一页', 'ticket-prev', slice.currentPage === 1 ? 'disabled' : '')}<span>${slice.currentPage} / ${slice.totalPages} · 共 ${tickets.length} 张</span>${button('下一页', 'ticket-next', slice.currentPage === slice.totalPages ? 'disabled' : '')}</div>
      </div>
    </section>
  </div><div data-hpb-enlarged-host></div>`
}
function closeTicketPreview(): void {
  enlargedTicketId = ''
  document.querySelector('[data-hpb-enlarged-host]')?.replaceChildren()
}
function renderOverlay(): string {
  if (history) return renderHistory()
  if (dataTools) return renderReplacementFabricDataTools()
  if (settings) return renderStandardListColumnSettings({ title: '换片布列表列设置', columns, preferences: prefs(), eventPrefix: 'hpb', maxFrozenWidth: 600, skipPageRerender: true })
  const row = rows.find(item => item.order.productionOrderId === activeOrder)
  if (!row) return ''
  if (orderMode === 'detail') return renderOrderDetail(row)
  const tickets = ticketsFor(row); const slice = paginateStandardListRows(tickets, ticketPage, 10)
  return `<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3" data-hpb-backdrop><section role="dialog" aria-modal="true" aria-label="打印换片布菲票" class="flex max-h-[92vh] w-full max-w-5xl flex-col rounded-lg bg-white shadow-xl"><header class="flex items-center justify-between border-b p-4"><div><h2 class="font-semibold">${e(row.order.productionOrderNo)} · 打印换片布菲票</h2><p class="text-xs text-slate-500">每张固定 5 Yard；新增独立票会增加备布份数，补打沿用原票。</p></div>${button('关闭', 'close')}</header><div class="space-y-3 overflow-y-auto p-4">${row.issues.map(issue => `<p class="text-red-700">${e(issue)}</p>`).join('')}<div class="grid gap-2 md:grid-cols-2">${row.materials.map(material => `<div class="flex flex-wrap items-center justify-between rounded border p-2">${renderReplacementFabricMaterial(material)}${button('新增独立票', 'add', `data-material-key="${e(material.key)}" ${row.issues.length ? 'disabled' : ''}`)}</div>`).join('')}</div><div class="flex flex-wrap gap-2">${button(`整单打印（${tickets.length} 张）`, 'print-all', tickets.length ? '' : 'disabled')}${button(`打印选中（${selected.size} 张）`, 'print-selected', selected.size ? '' : 'disabled')}${button('全选本单', 'select-all')}${button('清空选择', 'clear-selection')}</div><div class="space-y-2">${slice.rows.map(ticket => `<label class="flex items-start gap-3 rounded border p-3"><input type="checkbox" data-hpb-ticket="${e(ticket.id)}" class="mt-1" ${selected.has(ticket.id) ? 'checked' : ''}><span class="min-w-0 flex-1"><strong class="break-all">${e(ticket.ticketNo)}</strong><span class="block">${renderReplacementFabricMaterial(ticket.material)}</span><span class="block">第 ${ticket.sequence} 张 · 5 Yard</span><span class="block text-xs text-slate-500">${printed(ticket.id).length ? `已打印 ${printed(ticket.id).length} 次 · 最近 ${e(printed(ticket.id).at(-1)!.printedAt)}` : '待打印'} · ${records.receipts.some(receipt => receipt.ticket.id === ticket.id) ? '已交出（可补打）' : '未交出'}</span></span></label>`).join('') || '<p class="py-5 text-center text-slate-500">尚未生成菲票，请先核对裁床分配。</p>'}</div><div class="flex items-center gap-3">${button('上一页', 'ticket-prev', slice.currentPage === 1 ? 'disabled' : '')}<span>${slice.currentPage} / ${slice.totalPages} · 共 ${tickets.length} 张</span>${button('下一页', 'ticket-next', slice.currentPage === slice.totalPages ? 'disabled' : '')}</div><p class="text-sm ${error ? 'text-red-700' : 'text-blue-700'}" role="status">${e(feedback)}</p></div></section></div>`
}
function renderContents(): string {
  const filtered = sortStandardListRows(matched(), sort, (row, key) => columns.find(column => column.key === key)?.sortValue?.(row))
  const slice = paginateStandardListRows(filtered, page, prefs().pageSize); page = slice.currentPage
  const totalTickets = filtered.flatMap(ticketsFor)
  return renderStandardListPage({ title: '换片布菲票打印',
    primaryActionsHtml: `<div class="ml-auto flex flex-wrap items-center justify-end gap-2" data-hpb-toolbar>${button('刷新分配与打印状态', 'reload')}${button('历史票查询', 'history')}${button('本机数据', 'data-tools')}</div>`,
    feedbackHtml: feedback && !activeOrder ? `<p role="status" class="rounded p-2 text-sm ${error ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'}">${e(feedback)}</p>` : '',
    filtersHtml: `<div class="space-y-3 rounded-lg border bg-white p-3"><div class="grid gap-3 sm:grid-cols-3">${[['order', '来源生产单号', filter.order], ['material', '面料编码 / 名称', filter.material]].map(([field, label, value]) => `<label class="text-sm">${label}<input class="mt-1 h-9 w-full rounded border px-2" data-hpb-filter="${field}" value="${e(value)}" placeholder="请输入${label}"></label>`).join('')}<label class="text-sm">打印状态<select class="mt-1 h-9 w-full rounded border px-2" data-hpb-filter="status"><option value="">全部</option>${['待打印', '部分已打印', '全部已打印', '无需换片布', '资料待核对'].map(value => `<option ${value === filter.status ? 'selected' : ''}>${value}</option>`).join('')}</select></label></div><div class="flex gap-2" data-standard-list-query>${button('查询', 'query')}${button('重置', 'reset')}${button('导出', 'export')}</div></div>`,
    statsHtml: renderStandardListStats([{ label: '生产单', value: filtered.length }, { label: '当前菲票', value: `${totalTickets.length} 张` }, { label: '待打印', value: `${totalTickets.filter(ticket => !printed(ticket.id).length).length} 张` }, { label: '换片布总长', value: `${totalTickets.length * 5} Yard` }]),
    listTitle: `换片布打印对象 · ${filtered.length} 条`, listActionsHtml: button('列设置', 'column-settings'),
    tableHtml: renderStandardListTable({ columns, rows: slice.rows, preferences: prefs(), sort, eventPrefix: 'hpb', emptyText: '当前没有分配到本裁床的生产单', skipPageRerender: true }),
    paginationHtml: renderTablePagination({ ...slice, actionPrefix: 'hpb', skipPageRerender: true }), overlaysHtml: `<div data-hpb-overlay>${renderOverlay()}</div>`,
  })
}
function refresh(overlayOnly = false) {
  const host = document.querySelector<HTMLElement>('[data-hpb-page]'); if (!host) return
  if (overlayOnly) { const overlay = host.querySelector('[data-hpb-overlay]'); if (overlay) { overlay.innerHTML = renderOverlay(); hydrateTicketQr?.(overlay) }; return }
  host.innerHTML = renderContents(); hydrateTicketQr?.(host)
}
export function closeReplacementFabricOverlay(): boolean {
  if (!document.querySelector('[data-hpb-page]') || (!activeOrder && !settings && !dataTools && !history)) return false
  if (busy || isReplacementFabricDataToolBusy()) return true
  if (enlargedTicketId) { closeTicketPreview(); return true }
  const changedColumns = settings
  activeOrder = ''; settings = false; dataTools = false; history = false; refresh(!changedColumns); return true
}
async function reload() { rows = listReplacementFabricOrderRows(); records = await loadReplacementFabricState() }
function savePrefs() { try { localStorage.setItem(preferenceKey, JSON.stringify(prefs())) } catch {} }
export async function renderReplacementFabricFeiTicketsPage(): Promise<string> {
  page = 1; sort = null; activeOrder = ''; settings = false; dataTools = false; history = false; feedback = ''; selected.clear()
  try { await reload(); error = false } catch (cause) { error = true; feedback = cause instanceof Error ? cause.message : String(cause) }
  return `<div data-hpb-page>${renderContents()}</div>`
}
export async function handleReplacementFabricEvent(target: HTMLElement, event: Event): Promise<boolean> {
  if (!target.closest('[data-hpb-page]')) return false
  if (await handleReplacementFabricDataTools(target, event)) return true
  if (event.type === 'drop') {
    const source = (event as Event & { higoodStandardListColumnKey?: string }).higoodStandardListColumnKey
    const destination = target.closest<HTMLElement>('[data-standard-list-column-drag]')?.dataset.dragSource
    if (source && destination && source !== destination) {
      const order = prefs().order.filter(key => key !== source)
      order.splice(order.indexOf(destination), 0, source); prefs().order = order; savePrefs(); refresh()
    }
    return true
  }
  if (target.matches('[data-hpb-backdrop]') && event.type === 'click') { closeReplacementFabricOverlay(); return true }
  const checkbox = target.closest<HTMLInputElement>('[data-hpb-ticket]')
  if (checkbox) { if (event.type === 'change') { checkbox.checked ? selected.add(checkbox.dataset.hpbTicket!) : selected.delete(checkbox.dataset.hpbTicket!); refresh(true) }; return true }
  const field = target.closest<HTMLSelectElement>('[data-hpb-field]')
  if (field?.dataset.hpbField === 'pageSize') { if (event.type === 'change') { prefs().pageSize = Number(field.value); page = 1; savePrefs(); refresh() }; return true }
  const actionNode = target.closest<HTMLElement>('[data-hpb-action]')
  if (!actionNode || event.type !== 'click') return false
  event.preventDefault(); if (busy || isReplacementFabricDataToolBusy()) return true
  const action = actionNode.dataset.hpbAction; feedback = ''; error = false
  try {
    if (action === 'preview-ticket') {
      const ticket = records.tickets.find(item => item.id === actionNode.dataset.ticketId && item.productionOrderId === activeOrder)
      const host = document.querySelector<HTMLElement>('[data-hpb-enlarged-host]')
      if (!ticket || !host || !labelTemplate) return true
      enlargedTicketId = ticket.id
      host.innerHTML = `<div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-3" data-hpb-action="close-ticket-preview"><section role="dialog" aria-modal="true" aria-label="菲票放大预览" class="flex max-h-[94vh] max-w-full flex-col rounded-lg bg-white shadow-xl" data-hpb-preview-panel><header class="flex items-center justify-between gap-3 border-b p-3"><div><h2 class="font-semibold">菲票放大预览</h2><p class="text-xs text-slate-500">仅查看，不会记录打印或交出</p></div>${button('关闭预览', 'close-ticket-preview')}</header><div class="overflow-auto p-4"><div style="zoom:1.25">${labelTemplate.renderReplacementFabricLabel(ticket)}</div></div></section></div>`
      hydrateTicketQr?.(host); return true
    }
    if (action === 'close-ticket-preview') {
      if (!target.closest('[data-hpb-preview-panel]') || target.closest('button[data-hpb-action="close-ticket-preview"]')) closeTicketPreview()
      return true
    }
    if (action === 'detail' || action === 'print') {
      if (action === 'detail' && !labelTemplate) {
        const [template, qr] = await Promise.all([import('../../print/templates/replacement-fabric-label-template.ts'), import('../../../components/real-qr.ts')])
        labelTemplate = template; hydrateTicketQr = qr.hydrateRealQRCodes
      }
      enlargedTicketId = ''; await reload(); activeOrder = actionNode.dataset.orderId || ''; orderMode = action; selected.clear(); ticketPage = 1 }
    else if (action === 'close') { activeOrder = ''; dataTools = false; history = false }
    else if (action === 'history') { await reload(); history = true; historyPage = 1 }
    else if (action === 'history-query') { historyQuery = document.querySelector<HTMLInputElement>('[data-hpb-history-query]')?.value.trim() || ''; historyPage = 1 }
    else if (action === 'history-prev') historyPage--
    else if (action === 'history-next') historyPage++
    else if (action === 'history-print') {
      const id = actionNode.dataset.ticketId || ''
      if (!records.receipts.some(receipt => receipt.ticket.id === id)) throw new Error('仅已交出的历史原票可以补打。')
      window.open(`/fcs/print/preview?documentType=REPLACEMENT_FABRIC_LABEL&ticketIds=${encodeURIComponent(JSON.stringify([id]))}`, '_blank', 'noopener')
    }
    else if (action === 'data-tools') { await loadReplacementFabricDataInformation(); dataTools = true }
    else if (action === 'column-settings') settings = true
    else if (action === 'close-column-settings') settings = false
    else if (action === 'restore-column-settings') { preferences = defaults(); savePrefs() }
    else if (action === 'toggle-column-visibility' || action === 'toggle-column-freeze') {
      const key = actionNode.dataset.hpbColumnKey || ''; const column = columns.find(item => item.key === key)
      const attribute = action === 'toggle-column-visibility' ? 'visibleKeys' : 'frozenKeys'
      if (column && !(attribute === 'visibleKeys' && (column.required || column.actionColumn))) {
        const values = prefs()[attribute]; prefs()[attribute] = values.includes(key) ? values.filter(value => value !== key) : [...values, key]; savePrefs()
      }
    } else if (action === 'query') {
      for (const field of Object.keys(filter) as Array<keyof typeof filter>) filter[field] = document.querySelector<HTMLInputElement>(`[data-hpb-filter="${field}"]`)?.value.trim() || ''
      page = 1
    } else if (action === 'reset') { filter = { order: '', material: '', status: '' }; page = 1 }
    else if (action === 'prev-page') page--
    else if (action === 'next-page') page++
    else if (action === 'sort-column') { const key = actionNode.dataset.columnKey || ''; sort = sort?.key === key && sort.direction === 'desc' ? null : { key, direction: sort?.key === key && sort.direction === 'asc' ? 'desc' : 'asc' }; page = 1 }
    else if (action === 'ticket-prev') ticketPage--
    else if (action === 'ticket-next') ticketPage++
    else if (action === 'clear-selection') selected.clear()
    else if (action === 'select-all') { const row = rows.find(row => row.order.productionOrderId === activeOrder); if (row) ticketsFor(row).forEach(ticket => selected.add(ticket.id)) }
    else if (action === 'reload') {
      busy = true; await reload(); feedback = '已读取当前分配与打印状态。'
    } else if (action === 'add') {
      const row = listReplacementFabricOrderRows().find(row => row.order.productionOrderId === activeOrder)
      const candidates = row?.scopes.filter(scope => scope.materials.some(material => material.key === actionNode.dataset.materialKey)) || []
      if (candidates.length !== 1) throw new Error('该面料裁床责任不唯一，请计划人员核对后再新增。')
      const key = JSON.stringify([candidates[0].assignmentKey, actionNode.dataset.materialKey])
      const attempt = pendingAdds.get(key) || command(); pendingAdds.set(key, attempt)
      busy = true; await addReplacementFabricTickets(candidates[0], actionNode.dataset.materialKey!, 1, attempt); pendingAdds.delete(key); await reload(); feedback = '已新增 1 张独立票，长度 5 Yard，等待打印。'
    } else if (action === 'print-all' || action === 'print-selected') {
      const row = rows.find(row => row.order.productionOrderId === activeOrder)
      const ids = (row ? ticketsFor(row) : []).filter(ticket => action === 'print-all' || selected.has(ticket.id)).map(ticket => ticket.id)
      if (!ids.length) throw new Error('请先选择需要打印的票。')
      window.open(`/fcs/print/preview?documentType=REPLACEMENT_FABRIC_LABEL&ticketIds=${encodeURIComponent(JSON.stringify(ids))}`, '_blank', 'noopener')
    } else if (action === 'export') {
      const data = matched(); if (!data.length) throw new Error('当前查询无可导出数据。')
      const csv = [['生产单', '面料', '每张长度', '菲票张数', '已打印张数', '打印状态'], ...data.map(row => [row.order.productionOrderNo, row.materials.map(material => `${material.code} ${material.name} ${material.color}`).join('\n'), '5 Yard', String(ticketsFor(row).length), String(ticketsFor(row).filter(ticket => printed(ticket.id).length).length), status(row)])].map(line => line.map(value => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\r\n')
      const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })); const link = document.createElement('a'); link.href = url; link.download = '换片布菲票.csv'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
    }
  } catch (cause) { feedback = cause instanceof Error ? cause.message : String(cause); error = true }
  finally { busy = false }
  refresh(['history', 'history-query', 'history-prev', 'history-next', 'history-print', 'detail', 'print', 'close', 'data-tools', 'ticket-prev', 'ticket-next', 'clear-selection', 'select-all', 'column-settings'].includes(action || ''))
  return true
}
