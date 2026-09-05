// @page-pattern: list

import { renderStandardListFilters, renderStandardListPage } from '../../components/ui/list-page.ts'
import { renderStandardListTable, type StandardListColumn } from '../../components/ui/list-table.ts'
import type { StandardListColumnPreferences } from '../../components/ui/list-table-model.ts'
import { renderTablePagination } from '../../components/ui/pagination.ts'
import { renderTabs as renderUiTabs } from '../../components/ui/tabs.ts'
import {
  listCutPieceReturnInitiationCandidates,
  type CutPieceReturnInitiationCandidate,
} from '../../data/fcs/cutting/cut-piece-return-domain.ts'
import { getFactoryActivePpicSnapshot } from '../../data/fcs/factory-master-store.ts'
import { formatOperationLocalWallClock } from '../../data/fcs/sewing-delivery-sla.ts'
import {
  SEWING_CUT_PIECE_RETURN_REASON_POLICIES,
  createSewingCutPieceReturnRequestByPpic,
  ensureSewingCutPieceReturnPageDemo,
  getSewingCutPieceReturnRequest,
  listSewingCutPieceReturnRequests,
  reconfirmSewingCutPieceReturnByPpic,
  type SewingCutPieceReturnReasonCode,
  type SewingCutPieceReturnRequest,
} from '../../data/fcs/sewing-cut-piece-return-workflow.ts'
import { escapeHtml } from '../../utils.ts'

type ReturnTab = 'WAITING_WAREHOUSE' | 'WAREHOUSE_EXCEPTION' | 'WAREHOUSED'
type DialogState =
  | { kind: 'CREATE'; candidateId: string; reasonCode: SewingCutPieceReturnReasonCode; error: string }
  | { kind: 'DETAIL' | 'RECONFIRM'; requestId: string; error: string }
  | { kind: 'IMAGE'; imageUrl: string; label: string }
  | null

const state = {
  keyword: '',
  draftKeyword: '',
  tab: 'WAITING_WAREHOUSE' as ReturnTab,
  page: 1,
  pageSize: 20,
  feedback: '',
  dialog: null as DialogState,
  commandSequence: 0,
}

const tabLabels: Record<ReturnTab, string> = {
  WAITING_WAREHOUSE: '待仓库接收',
  WAREHOUSE_EXCEPTION: '接收异常',
  WAREHOUSED: '已入仓',
}

function allRows(): SewingCutPieceReturnRequest[] {
  ensureSewingCutPieceReturnPageDemo()
  return listSewingCutPieceReturnRequests()
}

function matchesTab(row: SewingCutPieceReturnRequest, tab: ReturnTab): boolean {
  if (tab === 'WAITING_WAREHOUSE') return row.status === 'APPROVED_WAITING_WAREHOUSE'
  return row.status === tab
}

function rows(): SewingCutPieceReturnRequest[] {
  const keyword = state.keyword.trim().toLowerCase()
  return allRows()
    .filter((item) => matchesTab(item, state.tab))
    .filter((item) => !keyword || [item.requestNo, item.productionOrderNo, item.sewingTaskNo, item.factoryName, item.ppicName, item.spuCode, item.returnReasonLabel, item.returnReasonDetail, item.responsibilityDecisionReference]
      .some((value) => value.toLowerCase().includes(keyword)))
}

function imageButton(row: SewingCutPieceReturnRequest): string {
  return `<button type="button" class="relative h-16 w-14 shrink-0 overflow-hidden rounded border bg-slate-50" data-ppic-return-action="preview-image" data-image-url="${escapeHtml(row.styleImageUrl)}" data-image-label="${escapeHtml(`${row.spuCode} ${row.styleName}`)}" aria-label="查看${escapeHtml(row.spuCode)}款式高清图"><img class="h-full w-full object-cover" src="${escapeHtml(row.styleImageUrl)}" alt="${escapeHtml(row.styleImageAlt)}" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span hidden class="absolute inset-0 flex items-center justify-center bg-red-50 px-1 text-[10px] text-red-700">图片加载失败</span></button>`
}

function statusText(row: SewingCutPieceReturnRequest): string {
  if (row.status === 'WAREHOUSED') return '仓库已接收入仓'
  if (row.status === 'WAREHOUSE_EXCEPTION') return '仓库接收异常，待PPIC处理'
  return 'PPIC已建单，待仓库接收'
}

function statusTone(status: SewingCutPieceReturnRequest['status']): string {
  if (status === 'WAREHOUSED') return 'text-emerald-700'
  if (status === 'WAREHOUSE_EXCEPTION') return 'text-red-700'
  return 'text-blue-700'
}

const columns: StandardListColumn<SewingCutPieceReturnRequest>[] = [
  { key: 'request', title: '退仓申请／款式', width: 270, required: true, render: (row) => `<div class="flex gap-3">${imageButton(row)}<div><b>${escapeHtml(row.requestNo)}</b><p class="text-xs text-slate-500">${escapeHtml(row.spuCode)} · ${escapeHtml(row.styleName)}</p><p class="mt-1 text-xs">${escapeHtml(row.garmentColor)} / ${escapeHtml(row.size)}</p></div></div>` },
  { key: 'task', title: '生产单／车缝任务', width: 230, required: true, render: (row) => `<b>${escapeHtml(row.productionOrderNo)}</b><p class="mt-1 text-xs text-slate-500">${escapeHtml(row.sewingTaskNo)}</p><p class="text-xs text-slate-500">来源交出：${escapeHtml(row.sourceHandoverOrderNo)}</p>` },
  { key: 'factory', title: '工厂／PPIC', width: 210, required: true, render: (row) => `<b>${escapeHtml(row.factoryName)}</b><p class="mt-1 text-xs font-semibold text-blue-700">PPIC：${escapeHtml(row.ppicName)}</p>` },
  { key: 'reason', title: '退仓原因', width: 230, required: true, render: (row) => `<b>${escapeHtml(row.returnReasonLabel)}</b><p class="mt-1 line-clamp-2 text-xs text-slate-500">${escapeHtml(row.returnReasonDetail)}</p>${row.responsibilityDecisionReference ? `<p class="mt-1 text-xs text-blue-700">依据：${escapeHtml(row.responsibilityDecisionReference)}</p>` : ''}` },
  { key: 'created', title: '实物退仓', width: 170, required: true, render: (row) => `<b>${row.returnedGarmentQty}件（折算）</b><p class="mt-1 text-xs text-slate-500">${row.partCounts.reduce((sum, item) => sum + item.pieceQty, 0)}片 · ${row.partCounts.filter((item) => item.pieceQty > 0).length}个部位</p><p class="mt-1 text-xs text-slate-500">${escapeHtml(row.createdBy)} · ${escapeHtml(row.createdAt)}</p>` },
  { key: 'responsibility', title: '工厂回货责任', width: 210, required: true, render: (row) => row.responsibilityAdjustmentQty > 0 ? `<b>${row.expectedReturnQtyBefore}件 → ${row.expectedReturnQtyAfter}件</b><p class="mt-1 text-xs ${row.status === 'WAREHOUSED' ? 'text-emerald-700' : 'text-amber-700'}">减少${row.responsibilityAdjustmentQty}件 · ${row.status === 'WAREHOUSED' ? '已随入仓生效' : '待仓库入仓后生效'}</p>` : `<b>${row.expectedReturnQtyBefore}件（不变）</b><p class="mt-1 text-xs text-slate-500">该原因不调整回货责任</p>` },
  { key: 'status', title: '当前节点', width: 210, required: true, render: (row) => `<b class="${statusTone(row.status)}">${escapeHtml(statusText(row))}</b>${row.warehouseExceptionNote ? `<p class="mt-1 text-xs text-red-600">${escapeHtml(row.warehouseExceptionNote)}</p>` : ''}` },
  { key: 'actions', title: '操作', width: 180, required: true, actionColumn: true, render: (row) => `<div class="flex flex-wrap justify-end gap-3"><button class="text-blue-700" data-ppic-return-action="detail" data-request-id="${escapeHtml(row.requestId)}">详情</button>${row.status === 'WAREHOUSE_EXCEPTION' ? `<button class="font-semibold text-blue-700" data-ppic-return-action="reconfirm" data-request-id="${escapeHtml(row.requestId)}">处理并重提</button>` : ''}</div>` },
]

const preferences: StandardListColumnPreferences = {
  order: columns.filter((column) => !column.actionColumn).map((column) => column.key),
  visibleKeys: columns.map((column) => column.key),
  frozenKeys: ['request'],
  pageSize: 20,
}

function availableReturnCandidates(): CutPieceReturnInitiationCandidate[] {
  const activeScopes = new Set(listSewingCutPieceReturnRequests()
    .filter((request) => request.status !== 'WAREHOUSED')
    .map((request) => request.responsibilityScopeKey))
  return listCutPieceReturnInitiationCandidates()
    .filter((candidate) => candidate.eligible && !activeScopes.has(candidate.responsibilityScopeKey))
}

function renderCreateDialog(): string {
  if (state.dialog?.kind !== 'CREATE') return ''
  const dialog = state.dialog
  const candidates = availableReturnCandidates()
  const candidate = candidates.find((item) => item.candidateId === dialog.candidateId) || candidates[0]
  const policy = SEWING_CUT_PIECE_RETURN_REASON_POLICIES[dialog.reasonCode]
  const options = candidates.map((item) => `<option value="${escapeHtml(item.candidateId)}"${candidate?.candidateId === item.candidateId ? ' selected' : ''}>${escapeHtml(item.productionOrderNo)} · ${escapeHtml(item.sewingTaskId)} · ${escapeHtml(item.sourceFactoryName)}</option>`).join('')
  const reasonOptions = (Object.keys(SEWING_CUT_PIECE_RETURN_REASON_POLICIES) as SewingCutPieceReturnReasonCode[])
    .map((code) => `<option value="${code}"${code === dialog.reasonCode ? ' selected' : ''}>${escapeHtml(SEWING_CUT_PIECE_RETURN_REASON_POLICIES[code].label)}</option>`)
    .join('')
  const body = candidate
    ? `<label class="block text-sm">退仓来源任务<select class="mt-1 h-10 w-full rounded border px-3" data-ppic-return-create-field="candidateId">${options}</select></label><section class="grid gap-3 rounded border p-3 text-sm md:grid-cols-3"><div><span class="text-slate-500">申请工厂</span><b class="mt-1 block">${escapeHtml(candidate.sourceFactoryName)}</b></div><div><span class="text-slate-500">来源交出</span><b class="mt-1 block">${escapeHtml(candidate.sourceHandoverOrderNo)}</b></div><div><span class="text-slate-500">当前工厂应回</span><b class="mt-1 block">${candidate.currentExpectedReturnQty}件</b></div></section><label class="block text-sm">退仓原因<select class="mt-1 h-10 w-full rounded border px-3" data-ppic-return-create-field="reasonCode">${reasonOptions}</select></label><p class="rounded border p-3 text-sm ${policy.responsibilityImpact === 'NO_CHANGE' ? 'border-slate-200 bg-slate-50 text-slate-700' : 'border-amber-200 bg-amber-50 text-amber-900'}"><b>对回货责任的影响：</b>${escapeHtml(policy.responsibilityExplanation)}</p><label class="block text-sm">具体退仓原因<textarea class="mt-1 min-h-20 w-full rounded border p-3" data-ppic-return-create-field="returnReasonDetail" placeholder="说明哪些部位为什么要退、是否已经投入生产"></textarea></label><section class="grid gap-3 md:grid-cols-2"><label class="block text-sm">实物退仓折算件数（件）<input type="number" min="1" value="1" class="mt-1 h-10 w-full rounded border px-3" data-ppic-return-create-field="garmentQty"></label><label class="block text-sm">回货责任调整数量（件）<input type="number" min="${policy.responsibilityImpact === 'NO_CHANGE' ? 0 : 1}" max="${candidate.currentExpectedReturnQty}" value="${policy.responsibilityImpact === 'NO_CHANGE' ? 0 : 1}" class="mt-1 h-10 w-full rounded border px-3 disabled:bg-slate-100" data-ppic-return-create-field="responsibilityAdjustmentQty"${policy.responsibilityImpact === 'NO_CHANGE' ? ' disabled' : ''}></label></section>${policy.requiresDecisionReference ? `<label class="block text-sm">正式调整依据号<input class="mt-1 h-10 w-full rounded border px-3" data-ppic-return-create-field="responsibilityDecisionReference" placeholder="任务调整单／取消单／转派记录编号"></label>` : ''}<div class="overflow-auto rounded border"><table class="w-full min-w-[640px] text-sm"><thead class="bg-slate-50"><tr><th class="p-2 text-left">来源裁片单／部位</th><th class="p-2 text-right">当前可退</th><th class="p-2 text-right">PPIC核对退仓</th></tr></thead><tbody>${candidate.parts.map((part) => `<tr class="border-t" data-ppic-return-create-part-row><td class="p-2"><b>${escapeHtml(part.partName)}</b><p class="text-xs text-slate-500">${escapeHtml(part.sourceCutOrderNo)}</p><input type="hidden" data-ppic-return-create-part-code value="${escapeHtml(part.partCode)}"><input type="hidden" data-ppic-return-create-cut-order-id value="${escapeHtml(part.sourceCutOrderId)}"></td><td class="p-2 text-right">${part.currentReturnablePieceQty}片</td><td class="p-2 text-right"><input type="number" min="0" max="${part.currentReturnablePieceQty}" value="${Math.min(part.piecesPerGarment, part.currentReturnablePieceQty)}" class="h-9 w-28 rounded border px-3 text-right" data-ppic-return-create-part-qty aria-label="${escapeHtml(part.partName)}退仓数量"></td></tr>`).join('')}</tbody></table></div><label class="block text-sm">线下申请接收说明<textarea class="mt-1 min-h-20 w-full rounded border p-3" data-ppic-return-create-field="offlineRequestNote">PPIC已线下收到${escapeHtml(candidate.sourceFactoryName)}退仓申请，并核对了实物部位和数量。</textarea></label>`
    : '<div class="rounded border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">当前没有可新增的裁片退仓来源。没有正式裁片交出责任的任务不能创建退仓申请。</div>'
  return `<div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4" role="dialog" aria-modal="true" aria-label="新增裁片退仓申请"><button class="absolute inset-0" data-ppic-return-action="close-dialog" aria-label="关闭"></button><section class="relative z-10 max-h-[92vh] w-full max-w-4xl overflow-auto rounded-lg bg-white shadow-xl"><header class="flex justify-between border-b p-5"><div><h2 class="text-lg font-semibold">新增裁片退仓申请</h2><p class="mt-1 text-xs text-slate-500">操作角色：任务PPIC</p></div><button class="rounded border px-3 py-1 text-sm" data-ppic-return-action="close-dialog">关闭</button></header><div class="space-y-4 p-5">${dialog.error ? `<div class="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">${escapeHtml(dialog.error)}</div>` : ''}${body}</div><footer class="flex justify-end gap-2 border-t p-4"><button class="rounded border px-4 py-2 text-sm" data-ppic-return-action="close-dialog">取消</button><button class="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-300" data-ppic-return-action="submit-create"${candidate ? '' : ' disabled'}>创建并提交仓库接收</button></footer></section></div>`
}

function renderDialog(): string {
  if (!state.dialog) return ''
  if (state.dialog.kind === 'IMAGE') return `<div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4" role="dialog" aria-modal="true" aria-label="${escapeHtml(state.dialog.label)}高清大图"><button class="absolute inset-0" data-ppic-return-action="close-dialog" aria-label="关闭大图"></button><section class="relative z-10 max-h-[92vh] max-w-5xl overflow-auto rounded-lg bg-white p-3"><header class="mb-3 flex justify-between gap-3"><b>${escapeHtml(state.dialog.label)}</b><button class="rounded border px-3 py-1 text-sm" data-ppic-return-action="close-dialog">关闭</button></header><img class="max-h-[78vh] max-w-full object-contain" src="${escapeHtml(state.dialog.imageUrl)}" alt="${escapeHtml(state.dialog.label)}高清图"></section></div>`
  if (state.dialog.kind === 'CREATE') return renderCreateDialog()
  const row = getSewingCutPieceReturnRequest(state.dialog.requestId)
  if (!row) return ''
  const shell = (title: string, body: string, footer = '') => `<div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}"><button class="absolute inset-0" data-ppic-return-action="close-dialog" aria-label="关闭"></button><section class="relative z-10 max-h-[92vh] w-full max-w-4xl overflow-auto rounded-lg bg-white shadow-xl"><header class="flex justify-between border-b p-5"><div><h2 class="text-lg font-semibold">${escapeHtml(title)}</h2><p class="mt-1 text-xs text-slate-500">${escapeHtml(row.requestNo)} · ${escapeHtml(row.sewingTaskNo)}</p></div><button class="rounded border px-3 py-1 text-sm" data-ppic-return-action="close-dialog">关闭</button></header>${body}${footer ? `<footer class="flex justify-end gap-2 border-t p-4">${footer}</footer>` : ''}</section></div>`
  if (state.dialog.kind === 'RECONFIRM') return shell('处理仓库接收异常', `<div class="space-y-4 p-5">${state.dialog.error ? `<div class="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">${escapeHtml(state.dialog.error)}</div>` : ''}<p class="rounded bg-amber-50 p-3 text-sm text-amber-900">${escapeHtml(row.warehouseExceptionNote)}</p><label class="block text-sm">处理结果<textarea class="mt-1 min-h-24 w-full rounded border p-3" data-ppic-return-field="reconfirmNote" placeholder="例如：包装已更换，原部位和数量继续有效"></textarea></label></div>`, '<button class="rounded border px-4 py-2 text-sm" data-ppic-return-action="close-dialog">取消</button><button class="rounded bg-blue-600 px-4 py-2 text-sm text-white" data-ppic-return-action="submit-reconfirm">重新提交仓库接收</button>')
  return shell('裁片退仓详情', `<div class="space-y-4 p-5"><section class="grid gap-3 md:grid-cols-3"><article class="rounded border p-3 text-sm"><span class="text-slate-500">申请工厂</span><b class="mt-1 block">${escapeHtml(row.factoryName)}</b></article><article class="rounded border p-3 text-sm"><span class="text-slate-500">建单PPIC</span><b class="mt-1 block text-blue-700">${escapeHtml(row.createdBy)}</b></article><article class="rounded border p-3 text-sm"><span class="text-slate-500">当前节点</span><b class="mt-1 block ${statusTone(row.status)}">${escapeHtml(statusText(row))}</b></article></section><section class="rounded border p-4 text-sm"><h3 class="font-semibold">为什么退、是否影响工厂应回</h3><dl class="mt-3 grid gap-3 md:grid-cols-2"><div><dt class="text-slate-500">退仓原因</dt><dd class="font-semibold">${escapeHtml(row.returnReasonLabel)}</dd></div><div><dt class="text-slate-500">实物退仓</dt><dd class="font-semibold">${row.returnedGarmentQty}件（折算）／${row.partCounts.reduce((sum, item) => sum + item.pieceQty, 0)}片</dd></div><div class="md:col-span-2"><dt class="text-slate-500">具体说明</dt><dd>${escapeHtml(row.returnReasonDetail)}</dd></div><div><dt class="text-slate-500">正式调整依据</dt><dd>${escapeHtml(row.responsibilityDecisionReference || '不适用')}</dd></div><div><dt class="text-slate-500">工厂应回责任</dt><dd class="font-semibold">${row.responsibilityAdjustmentQty > 0 ? `${row.expectedReturnQtyBefore}件 → ${row.expectedReturnQtyAfter}件（减少${row.responsibilityAdjustmentQty}件）` : `${row.expectedReturnQtyBefore}件（不变）`}</dd></div></dl><p class="mt-3 rounded p-3 ${row.responsibilityAdjustmentQty > 0 ? 'bg-amber-50 text-amber-900' : 'bg-slate-50 text-slate-700'}">${escapeHtml(SEWING_CUT_PIECE_RETURN_REASON_POLICIES[row.returnReasonCode].responsibilityExplanation)}</p></section><p class="rounded bg-slate-50 p-3 text-sm"><b>线下申请接收说明：</b>${escapeHtml(row.offlineRequestNote)}</p><div class="overflow-auto rounded border"><table class="w-full min-w-[650px] text-sm"><thead class="bg-slate-50"><tr><th class="p-2 text-left">来源裁片单／部位</th><th class="p-2 text-right">PPIC核对数量</th><th class="p-2 text-left">识别依据</th></tr></thead><tbody>${row.partCounts.map((item) => `<tr class="border-t"><td class="p-2"><b>${escapeHtml(item.partName)}</b><p class="text-xs text-slate-500">${escapeHtml(item.sourceCutOrderNo)}</p></td><td class="p-2 text-right">${item.pieceQty}片</td><td class="p-2 text-xs">${item.identificationMode === 'SCAN_OLD_TICKET' ? `旧菲票 ${escapeHtml(item.scannedTicketNo)}` : 'PPIC人工核对部位'}</td></tr>`).join('')}</tbody></table></div><section class="rounded border p-4"><h3 class="font-semibold">处理时间线</h3><div class="mt-3 space-y-2">${row.events.map((event) => `<article class="rounded bg-slate-50 p-3 text-sm"><b>${escapeHtml(event.occurredAt)} · ${escapeHtml(event.actorName)}</b><p class="mt-1">${escapeHtml(event.note)}</p></article>`).join('')}</div></section></div>`)
}

export function renderSewingOutsourcingCutPieceReturnsPage(): string {
  const completeRows = allRows()
  const filtered = rows()
  const totalPages = Math.max(1, Math.ceil(filtered.length / state.pageSize))
  state.page = Math.min(Math.max(1, state.page), totalPages)
  const start = (state.page - 1) * state.pageSize
  const pageRows = filtered.slice(start, start + state.pageSize)
  return `<div data-ppic-return-page data-skip-page-rerender="true">${renderStandardListPage({
    title: '裁片退仓',
    feedbackHtml: state.feedback ? `<div class="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">${escapeHtml(state.feedback)}</div>` : '',
    statusTabsHtml: renderUiTabs({
      tabs: (Object.keys(tabLabels) as ReturnTab[]).map((tab) => ({ key: tab, label: tabLabels[tab], count: completeRows.filter((row) => matchesTab(row, tab)).length })),
      activeKey: state.tab,
      variant: 'pills',
      prefix: 'ppic-return',
      action: 'switch-tab',
      fullWidth: true,
    }),
    filtersHtml: renderStandardListFilters({
      actionPrefix: 'ppic-return',
      fieldsHtml: `<input class="h-9 min-w-80 rounded border px-3 text-sm" placeholder="申请单 / 生产单 / 车缝任务 / 工厂 / 退仓原因" value="${escapeHtml(state.draftKeyword)}" data-ppic-return-filter="keyword">`,
    }),
    listTitle: `${tabLabels[state.tab]}的裁片退仓申请`,
    listActionsHtml: '<button class="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white" data-ppic-return-action="create">新增退仓申请</button>',
    tableHtml: renderStandardListTable({ columns, rows: pageRows, preferences: { ...preferences, pageSize: state.pageSize }, sort: null, eventPrefix: 'ppic-return', emptyText: `暂无${tabLabels[state.tab]}的裁片退仓申请` }),
    paginationHtml: renderTablePagination({ total: filtered.length, from: filtered.length ? start + 1 : 0, to: Math.min(start + state.pageSize, filtered.length), currentPage: state.page, totalPages, pageSize: state.pageSize, actionPrefix: 'ppic-return', fieldPrefix: 'ppic-return', pageSizeOptions: [20, 50] }),
    overlaysHtml: renderDialog(),
  })}</div>`
}

function refresh(): void {
  const root = document.querySelector<HTMLElement>('[data-ppic-return-page]')
  if (root) root.outerHTML = renderSewingOutsourcingCutPieceReturnsPage()
}

export function isSewingOutsourcingCutPieceReturnDialogOpen(): boolean { return state.dialog !== null }
export function closeSewingOutsourcingCutPieceReturnDialog(): boolean { if (!state.dialog) return false; state.dialog = null; refresh(); return true }

export function handleSewingOutsourcingCutPieceReturnsEvent(target: HTMLElement): boolean {
  const createField = target.closest<HTMLSelectElement>('[data-ppic-return-create-field="candidateId"]')
  if (createField && state.dialog?.kind === 'CREATE') {
    state.dialog = { ...state.dialog, candidateId: createField.value, error: '' }
    refresh()
    return true
  }
  const reasonField = target.closest<HTMLSelectElement>('[data-ppic-return-create-field="reasonCode"]')
  if (reasonField && state.dialog?.kind === 'CREATE') {
    state.dialog = { ...state.dialog, reasonCode: reasonField.value as SewingCutPieceReturnReasonCode, error: '' }
    refresh()
    return true
  }
  const filter = target.closest<HTMLInputElement | HTMLSelectElement>('[data-ppic-return-filter]')
  if (filter) {
    if (filter.dataset.ppicReturnFilter === 'keyword') state.draftKeyword = filter.value
    if (filter.dataset.ppicReturnFilter === 'pageSize') {
      state.pageSize = Number(filter.value) || 20
      state.page = 1
      refresh()
    }
    return true
  }
  const node = target.closest<HTMLElement>('[data-ppic-return-action]')
  const action = node?.dataset.ppicReturnAction
  if (!node || !action) return false
  if (action === 'close-dialog') return closeSewingOutsourcingCutPieceReturnDialog()
  if (action.startsWith('switch-tab:')) {
    state.tab = action.slice('switch-tab:'.length) as ReturnTab
    state.page = 1
  } else if (action === 'query') {
    state.keyword = state.draftKeyword
    state.page = 1
  } else if (action === 'reset') {
    state.keyword = ''
    state.draftKeyword = ''
    state.page = 1
  } else if (action === 'create') {
    state.dialog = { kind: 'CREATE', candidateId: availableReturnCandidates()[0]?.candidateId || '', reasonCode: 'EXCESS_OR_WRONG_PIECES', error: '' }
  } else if (action === 'preview-image') {
    state.dialog = { kind: 'IMAGE', imageUrl: node.dataset.imageUrl || '', label: node.dataset.imageLabel || '款式' }
  } else if (action === 'detail') {
    state.dialog = { kind: 'DETAIL', requestId: node.dataset.requestId || '', error: '' }
  } else if (action === 'reconfirm') {
    state.dialog = { kind: 'RECONFIRM', requestId: node.dataset.requestId || '', error: '' }
  } else if (action === 'submit-create' && state.dialog?.kind === 'CREATE') {
    const dialog = state.dialog
    const candidate = availableReturnCandidates().find((item) => item.candidateId === dialog.candidateId)
    const garmentQty = Number(document.querySelector<HTMLInputElement>('[data-ppic-return-create-field="garmentQty"]')?.value || 0)
    const returnReasonDetail = document.querySelector<HTMLTextAreaElement>('[data-ppic-return-create-field="returnReasonDetail"]')?.value.trim() || ''
    const responsibilityAdjustmentQty = Number(document.querySelector<HTMLInputElement>('[data-ppic-return-create-field="responsibilityAdjustmentQty"]')?.value || 0)
    const responsibilityDecisionReference = document.querySelector<HTMLInputElement>('[data-ppic-return-create-field="responsibilityDecisionReference"]')?.value.trim() || ''
    const offlineRequestNote = document.querySelector<HTMLTextAreaElement>('[data-ppic-return-create-field="offlineRequestNote"]')?.value.trim() || ''
    const partCounts = [...document.querySelectorAll<HTMLElement>('[data-ppic-return-create-part-row]')].map((row) => ({
      partCode: row.querySelector<HTMLInputElement>('[data-ppic-return-create-part-code]')?.value || '',
      sourceCutOrderId: row.querySelector<HTMLInputElement>('[data-ppic-return-create-cut-order-id]')?.value || '',
      pieceQty: Number(row.querySelector<HTMLInputElement>('[data-ppic-return-create-part-qty]')?.value || 0),
      identificationMode: 'MANUAL_PART_SELECTION' as const,
      physicalTicketStatus: 'MISSING' as const,
    }))
    try {
      if (!candidate) throw new Error('请选择可以创建退仓申请的车缝任务。')
      const ppic = getFactoryActivePpicSnapshot(candidate.sourceFactoryId)
      if (!ppic) throw new Error('该工厂缺少有效PPIC。')
      state.commandSequence += 1
      const created = createSewingCutPieceReturnRequestByPpic({
        commandId: `CMD-PPIC-CUT-RETURN-CREATE-${Date.now()}-${state.commandSequence}`,
        candidateId: candidate.candidateId,
        returnedGarmentQty: garmentQty,
        returnReasonCode: dialog.reasonCode,
        returnReasonDetail,
        responsibilityAdjustmentQty,
        responsibilityDecisionReference,
        partCounts,
        offlineRequestNote,
        actor: { actorId: ppic.ppicId, actorName: ppic.ppicName, role: 'PPIC' },
        createdAt: formatOperationLocalWallClock(),
      })
      state.feedback = `${created.requestNo}已由PPIC创建并提交待交出仓接收。`
      state.tab = 'WAITING_WAREHOUSE'
      state.dialog = null
    } catch (error) {
      state.dialog = { ...dialog, error: error instanceof Error ? error.message : '退仓申请创建失败' }
    }
  } else if (action === 'submit-reconfirm' && state.dialog?.kind === 'RECONFIRM') {
    const dialog = state.dialog
    const request = getSewingCutPieceReturnRequest(dialog.requestId)
    const note = document.querySelector<HTMLTextAreaElement>('[data-ppic-return-field="reconfirmNote"]')?.value.trim() || ''
    try {
      state.commandSequence += 1
      reconfirmSewingCutPieceReturnByPpic({
        commandId: `CMD-PPIC-CUT-RETURN-RECONFIRM-${Date.now()}-${state.commandSequence}`,
        requestId: dialog.requestId,
        note,
        actor: { actorId: request?.ppicId || '', actorName: request?.ppicName || '', role: 'PPIC' },
        reconfirmedAt: formatOperationLocalWallClock(),
      })
      state.feedback = '异常已处理，原PPIC建单部位和数量已重新提交仓库接收。'
      state.tab = 'WAITING_WAREHOUSE'
      state.dialog = null
    } catch (error) {
      state.dialog = { ...dialog, error: error instanceof Error ? error.message : '重新提交失败' }
    }
  } else if (action === 'prev-page') {
    state.page = Math.max(1, state.page - 1)
  } else if (action === 'next-page') {
    state.page += 1
  } else {
    return false
  }
  refresh()
  return true
}
