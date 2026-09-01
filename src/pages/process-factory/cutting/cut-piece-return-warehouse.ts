// @page-pattern: list

import { renderStandardListPage, renderStandardListStats } from '../../../components/ui/list-page.ts'
import { renderStandardListTable, type StandardListColumn } from '../../../components/ui/list-table.ts'
import type { StandardListColumnPreferences } from '../../../components/ui/list-table-model.ts'
import { renderTablePagination } from '../../../components/ui/pagination.ts'
import { formatOperationLocalWallClock } from '../../../data/fcs/sewing-delivery-sla.ts'
import {
  ensureSewingCutPieceReturnWorkflowDemo,
  getSewingCutPieceReturnRequest,
  listSewingCutPieceReturnRequests,
  receiveApprovedCutPieceReturnByWarehouse,
  type SewingCutPieceReturnRequest,
} from '../../../data/fcs/sewing-cut-piece-return-workflow.ts'
import { escapeHtml } from '../../../utils.ts'

type DialogState =
  | { kind: 'DETAIL' | 'EXCEPTION'; requestId: string; error: string }
  | { kind: 'IMAGE'; imageUrl: string; label: string }
  | null

const state = { keyword: '', status: 'ALL', page: 1, pageSize: 20, feedback: '', dialog: null as DialogState, commandSequence: 0 }

const statusLabels: Record<string, string> = {
  APPROVED_WAITING_WAREHOUSE: '待仓库接收',
  WAREHOUSE_EXCEPTION: '接收异常待PPIC处理',
  WAREHOUSED: '已接收入仓',
}

function rows(): SewingCutPieceReturnRequest[] {
  ensureSewingCutPieceReturnWorkflowDemo()
  const keyword = state.keyword.trim().toLowerCase()
  return listSewingCutPieceReturnRequests()
    .filter((item) => state.status === 'ALL' || item.status === state.status)
    .filter((item) => !keyword || [item.requestNo, item.productionOrderNo, item.sewingTaskNo, item.factoryName, item.spuCode].some((value) => value.toLowerCase().includes(keyword)))
}

function imageButton(row: SewingCutPieceReturnRequest): string {
  return `<button type="button" class="relative h-16 w-14 shrink-0 overflow-hidden rounded border bg-slate-50" data-cut-piece-return-warehouse-action="preview-image" data-image-url="${escapeHtml(row.styleImageUrl)}" data-image-label="${escapeHtml(`${row.spuCode} ${row.styleName}`)}" aria-label="查看${escapeHtml(row.spuCode)}款式高清图"><img class="h-full w-full object-cover" src="${escapeHtml(row.styleImageUrl)}" alt="${escapeHtml(row.styleImageAlt)}" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span hidden class="absolute inset-0 flex items-center justify-center bg-red-50 px-1 text-[10px] text-red-700">图片加载失败</span></button>`
}

const columns: StandardListColumn<SewingCutPieceReturnRequest>[] = [
  { key: 'request', title: '退仓申请／款式', width: 270, required: true, render: (row) => `<div class="flex gap-3">${imageButton(row)}<div><b>${escapeHtml(row.requestNo)}</b><p class="text-xs text-slate-500">${escapeHtml(row.spuCode)} · ${escapeHtml(row.styleName)}</p><p class="mt-1 text-xs">${escapeHtml(row.garmentColor)} / ${escapeHtml(row.size)}</p></div></div>` },
  { key: 'task', title: '生产单／车缝任务', width: 220, required: true, render: (row) => `<b>${escapeHtml(row.productionOrderNo)}</b><p class="mt-1 text-xs text-slate-500">${escapeHtml(row.sewingTaskNo)}</p><p class="text-xs text-slate-500">来源交出：${escapeHtml(row.sourceHandoverOrderNo)}</p>` },
  { key: 'factory', title: '申请工厂', width: 190, render: (row) => `<b>${escapeHtml(row.factoryName)}</b><p class="mt-1 text-xs text-slate-500">PPIC建单${row.returnedGarmentQty}件</p>` },
  { key: 'approval', title: 'PPIC建单数量', width: 220, required: true, render: (row) => `<b>${row.returnedGarmentQty}件 / ${row.partCounts.reduce((sum, item) => sum + item.pieceQty, 0)}片</b><p class="mt-1 text-xs text-slate-500">${escapeHtml(row.createdBy)} · ${escapeHtml(row.createdAt)}</p><p class="text-xs text-slate-500">仓库不可修改</p>` },
  { key: 'status', title: '接收节点', width: 180, required: true, render: (row) => `<b class="${row.status === 'WAREHOUSED' ? 'text-emerald-700' : row.status === 'APPROVED_WAITING_WAREHOUSE' ? 'text-blue-700' : row.status === 'WAREHOUSE_EXCEPTION' ? 'text-red-700' : 'text-slate-500'}">${escapeHtml(statusLabels[row.status])}</b>${row.legacyReturnOrderNo ? `<p class="mt-1 text-xs text-slate-500">入仓单：${escapeHtml(row.legacyReturnOrderNo)}</p>` : ''}` },
  { key: 'actions', title: '操作', width: 220, required: true, actionColumn: true, render: (row) => `<div class="flex flex-wrap justify-end gap-3"><button class="text-blue-700" data-cut-piece-return-warehouse-action="detail" data-request-id="${escapeHtml(row.requestId)}">查看建单明细</button>${row.status === 'APPROVED_WAITING_WAREHOUSE' ? `<button class="font-semibold text-emerald-700" data-cut-piece-return-warehouse-action="receive" data-request-id="${escapeHtml(row.requestId)}">确认接收并入仓</button><button class="text-red-700" data-cut-piece-return-warehouse-action="exception" data-request-id="${escapeHtml(row.requestId)}">记录接收异常</button>` : ''}</div>` },
]

const preferences: StandardListColumnPreferences = { order: columns.filter((column) => !column.actionColumn).map((column) => column.key), visibleKeys: columns.map((column) => column.key), frozenKeys: ['request'], pageSize: 20 }

function activeRequest(): SewingCutPieceReturnRequest | null {
  if (!state.dialog || state.dialog.kind === 'IMAGE') return null
  return getSewingCutPieceReturnRequest(state.dialog.requestId)
}

function renderDialog(): string {
  if (!state.dialog) return ''
  if (state.dialog.kind === 'IMAGE') return `<div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4" role="dialog" aria-modal="true" aria-label="${escapeHtml(state.dialog.label)}高清大图"><button class="absolute inset-0" data-cut-piece-return-warehouse-action="close-dialog" aria-label="关闭大图"></button><section class="relative z-10 max-h-[92vh] max-w-5xl overflow-auto rounded-lg bg-white p-3"><header class="mb-3 flex justify-between gap-3"><b>${escapeHtml(state.dialog.label)}</b><button class="rounded border px-3 py-1 text-sm" data-cut-piece-return-warehouse-action="close-dialog">关闭</button></header><img class="max-h-[78vh] max-w-full object-contain" src="${escapeHtml(state.dialog.imageUrl)}" alt="${escapeHtml(state.dialog.label)}高清图"></section></div>`
  const row = activeRequest()
  if (!row) return ''
  if (state.dialog.kind === 'EXCEPTION') return `<div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4" role="dialog" aria-modal="true" aria-label="记录仓库接收异常"><button class="absolute inset-0" data-cut-piece-return-warehouse-action="close-dialog" aria-label="关闭"></button><section class="relative z-10 w-full max-w-xl rounded-lg bg-white shadow-xl"><header class="border-b p-5"><h2 class="text-lg font-semibold">记录仓库接收异常</h2><p class="mt-1 text-xs text-slate-500">仓库只记录异常，不修改PPIC建单数量，也不重新核对部位。</p></header><div class="space-y-4 p-5">${state.dialog.error ? `<div class="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">${escapeHtml(state.dialog.error)}</div>` : ''}<label class="block text-sm">现场异常说明<textarea class="mt-1 min-h-24 w-full rounded border p-3" data-cut-piece-return-warehouse-field="exceptionNote" placeholder="例如：外包装破损，暂不入仓，退回PPIC协调"></textarea></label></div><footer class="flex justify-end gap-2 border-t p-4"><button class="rounded border px-4 py-2 text-sm" data-cut-piece-return-warehouse-action="close-dialog">取消</button><button class="rounded bg-red-600 px-4 py-2 text-sm text-white" data-cut-piece-return-warehouse-action="submit-exception" data-request-id="${escapeHtml(row.requestId)}">记录异常并退回PPIC</button></footer></section></div>`
  return `<div class="fixed inset-0 z-50 overflow-auto bg-slate-950/60 p-4" role="dialog" aria-modal="true" aria-label="PPIC建单明细"><button class="fixed inset-0" data-cut-piece-return-warehouse-action="close-dialog" aria-label="关闭"></button><section class="relative z-10 mx-auto my-4 w-full max-w-4xl rounded-lg bg-white shadow-xl"><header class="flex justify-between border-b p-5"><div><h2 class="text-lg font-semibold">PPIC建单明细</h2><p class="mt-1 text-xs text-slate-500">${escapeHtml(row.requestNo)} · ${escapeHtml(row.productionOrderNo)} · ${escapeHtml(row.sewingTaskNo)}</p></div><button class="rounded border px-3 py-1 text-sm" data-cut-piece-return-warehouse-action="close-dialog">关闭</button></header><div class="space-y-4 p-5"><p class="rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900"><b>仓库职责：</b>按PPIC建单的${row.returnedGarmentQty}件、${row.partCounts.reduce((sum, item) => sum + item.pieceQty, 0)}片接收和入仓；不复核部位归属，不提供改数输入。</p><div class="overflow-auto rounded border"><table class="w-full min-w-[620px] text-sm"><thead class="bg-slate-50"><tr><th class="p-2 text-left">来源裁片单／部位</th><th class="p-2 text-right">PPIC建单数量</th><th class="p-2 text-left">识别依据</th></tr></thead><tbody>${row.partCounts.map((item) => `<tr class="border-t"><td class="p-2"><b>${escapeHtml(item.partName)}</b><p class="text-xs text-slate-500">${escapeHtml(item.sourceCutOrderNo)}</p></td><td class="p-2 text-right font-semibold">${item.pieceQty}片</td><td class="p-2 text-xs">${item.identificationMode === 'SCAN_OLD_TICKET' ? `旧菲票 ${escapeHtml(item.scannedTicketNo)}` : 'PPIC人工核对部位'}</td></tr>`).join('')}</tbody></table></div><p class="text-sm text-slate-600">建单：${escapeHtml(row.createdBy)} · ${escapeHtml(row.createdAt)} · ${escapeHtml(row.offlineRequestNote)}</p></div></section></div>`
}

export function renderCraftCuttingCutPieceReturnProcessingPage(): string {
  const allRows = rows()
  const totalPages = Math.max(1, Math.ceil(allRows.length / state.pageSize))
  state.page = Math.min(Math.max(1, state.page), totalPages)
  const start = (state.page - 1) * state.pageSize
  const pageRows = allRows.slice(start, start + state.pageSize)
  return `<div data-cut-piece-return-warehouse-page data-skip-page-rerender="true">${renderStandardListPage({
    title: '裁片退仓接收与入仓',
    feedbackHtml: state.feedback ? `<div class="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">${escapeHtml(state.feedback)}</div>` : '',
    filtersHtml: `<div class="flex flex-wrap gap-3 rounded-lg border bg-white p-3"><input class="h-9 min-w-80 rounded border px-3 text-sm" placeholder="申请单 / 生产单 / 车缝任务 / 工厂" value="${escapeHtml(state.keyword)}" data-cut-piece-return-warehouse-filter="keyword"><select class="h-9 rounded border px-3 text-sm" data-cut-piece-return-warehouse-filter="status"><option value="ALL">全部节点</option>${Object.entries(statusLabels).map(([value, label]) => `<option value="${value}"${state.status === value ? ' selected' : ''}>${escapeHtml(label)}</option>`).join('')}</select></div>`,
    statsHtml: renderStandardListStats([
      { label: '待仓库接收', value: allRows.filter((item) => item.status === 'APPROVED_WAITING_WAREHOUSE').length },
      { label: '接收异常', value: allRows.filter((item) => item.status === 'WAREHOUSE_EXCEPTION').length },
      { label: '已接收入仓', value: allRows.filter((item) => item.status === 'WAREHOUSED').length },
    ]),
    listTitle: 'PPIC创建后的裁片退仓接收队列',
    listActionsHtml: '<span class="rounded border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900">待交出仓只做接收和入仓，不审核裁片部位、不核查业务数量、不修改PPIC建单值。</span>',
    tableHtml: renderStandardListTable({ columns, rows: pageRows, preferences: { ...preferences, pageSize: state.pageSize }, sort: null, eventPrefix: 'cut-piece-return-warehouse', emptyText: '暂无裁片退仓申请' }),
    paginationHtml: renderTablePagination({ total: allRows.length, from: allRows.length ? start + 1 : 0, to: Math.min(start + state.pageSize, allRows.length), currentPage: state.page, totalPages, pageSize: state.pageSize, actionPrefix: 'cut-piece-return-warehouse', fieldPrefix: 'cut-piece-return-warehouse', pageSizeOptions: [20, 50] }),
    overlaysHtml: renderDialog(),
  })}</div>`
}

function refresh(): void {
  const root = document.querySelector<HTMLElement>('[data-cut-piece-return-warehouse-page]')
  if (root) root.outerHTML = renderCraftCuttingCutPieceReturnProcessingPage()
}

export function enterCraftCuttingCutPieceReturnProcessingRoute(): void {
  state.page = 1
  state.dialog = null
  state.feedback = ''
}

export function isCutPieceReturnWarehouseDialogOpen(): boolean { return state.dialog !== null }
export function closeCutPieceReturnWarehouseDialog(): boolean { if (!state.dialog) return false; state.dialog = null; refresh(); return true }

export function handleCraftCuttingCutPieceReturnProcessingEvent(eventTarget: EventTarget | null): boolean {
  const target = eventTarget instanceof HTMLElement ? eventTarget : null
  if (!target) return false
  const filter = target.closest<HTMLInputElement | HTMLSelectElement>('[data-cut-piece-return-warehouse-filter]')
  if (filter) {
    if (filter.dataset.cutPieceReturnWarehouseFilter === 'keyword') state.keyword = filter.value
    if (filter.dataset.cutPieceReturnWarehouseFilter === 'status') state.status = filter.value
    if (filter.dataset.cutPieceReturnWarehouseFilter === 'pageSize') state.pageSize = Number(filter.value) || 20
    state.page = 1; refresh(); return true
  }
  const node = target.closest<HTMLElement>('[data-cut-piece-return-warehouse-action]')
  const action = node?.dataset.cutPieceReturnWarehouseAction
  if (!node || !action) return false
  if (action === 'close-dialog') return closeCutPieceReturnWarehouseDialog()
  if (action === 'preview-image') state.dialog = { kind: 'IMAGE', imageUrl: node.dataset.imageUrl || '', label: node.dataset.imageLabel || '款式' }
  else if (action === 'detail') state.dialog = { kind: 'DETAIL', requestId: node.dataset.requestId || '', error: '' }
  else if (action === 'exception') state.dialog = { kind: 'EXCEPTION', requestId: node.dataset.requestId || '', error: '' }
  else if (action === 'receive') {
    try {
      state.commandSequence += 1
      receiveApprovedCutPieceReturnByWarehouse({ commandId: `CMD-CPR-WAREHOUSE-RECEIVE-${Date.now()}-${state.commandSequence}`, requestId: node.dataset.requestId || '', actor: { actorId: 'CUTTING-WAREHOUSE-001', actorName: '裁床待交出仓 王敏', role: 'WAREHOUSE' }, receivedAt: formatOperationLocalWallClock() })
      state.feedback = '已按PPIC建单部位和数量接收并入仓；仓库未修改业务量。'
    } catch (error) { state.feedback = error instanceof Error ? error.message : '接收入仓失败' }
  } else if (action === 'submit-exception' && state.dialog?.kind === 'EXCEPTION') {
    const note = document.querySelector<HTMLTextAreaElement>('[data-cut-piece-return-warehouse-field="exceptionNote"]')?.value.trim() || ''
    try {
      if (!note) throw new Error('请填写现场异常说明。')
      state.commandSequence += 1
      receiveApprovedCutPieceReturnByWarehouse({ commandId: `CMD-CPR-WAREHOUSE-EXCEPTION-${Date.now()}-${state.commandSequence}`, requestId: state.dialog.requestId, actor: { actorId: 'CUTTING-WAREHOUSE-001', actorName: '裁床待交出仓 王敏', role: 'WAREHOUSE' }, receivedAt: formatOperationLocalWallClock(), exceptionNote: note })
      state.feedback = '仓库已记录接收异常并退回PPIC处理；PPIC建单数量未被修改。'
      state.dialog = null
    } catch (error) { state.dialog = { ...state.dialog, error: error instanceof Error ? error.message : '记录失败' } }
  } else if (action === 'prev-page') state.page = Math.max(1, state.page - 1)
  else if (action === 'next-page') state.page += 1
  else return false
  refresh()
  return true
}
