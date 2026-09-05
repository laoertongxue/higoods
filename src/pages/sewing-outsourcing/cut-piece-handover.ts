// @page-pattern: list

import { renderStandardListFilters, renderStandardListPage } from '../../components/ui/list-page.ts'
import { renderStandardListTable, type StandardListColumn } from '../../components/ui/list-table.ts'
import type { StandardListColumnPreferences } from '../../components/ui/list-table-model.ts'
import { renderTablePagination } from '../../components/ui/pagination.ts'
import { renderTabs as renderUiTabs } from '../../components/ui/tabs.ts'
import {
  cancelSewingCutPiecePartExclusion,
  createSewingCutPiecePartExclusion,
  ensureSewingCutPieceResponsibilityOverviewDemos,
  getSewingCutPiecePartExclusionEligibility,
  getSewingCutPieceResponsibilityProjection,
  listSewingCutPieceHandoverEvents,
  listSewingCutPiecePartExclusionVersions,
  listSewingReturnResponsibilityVersions,
  type SewingCutPieceResponsibilityProjection,
} from '../../data/fcs/sewing-cut-piece-responsibility.ts'
import { formatOperationLocalWallClock } from '../../data/fcs/sewing-delivery-sla.ts'
import { escapeHtml } from '../../utils.ts'

export type HandoverSituation = 'UNHANDED' | 'HANDED_NO_DEBT' | 'HANDED_WITH_DEBT'

type DialogState =
  | { kind: 'DETAIL'; assignmentId: string }
  | { kind: 'EXCLUSION'; assignmentId: string; requirementLineId: string; error: string }
  | { kind: 'CANCEL_EXCLUSION'; assignmentId: string; exclusionVersionId: string; error: string }
  | { kind: 'IMAGE'; imageUrl: string; label: string }
  | null

const state = {
  situation: 'UNHANDED' as HandoverSituation,
  keyword: '',
  draftKeyword: '',
  page: 1,
  pageSize: 20,
  syncedUrl: '',
  dialog: null as DialogState,
  feedback: '',
  commandSequence: 0,
}

const situationLabels: Record<HandoverSituation, string> = {
  UNHANDED: '未交出',
  HANDED_NO_DEBT: '已交出不欠片',
  HANDED_WITH_DEBT: '已交出且欠片',
}

export function classifyHandoverSituation(projection: SewingCutPieceResponsibilityProjection): HandoverSituation {
  if (projection.totalHandedOverPieceQty === 0) return 'UNHANDED'
  return projection.totalDebtPieceQty > 0 ? 'HANDED_WITH_DEBT' : 'HANDED_NO_DEBT'
}

function syncSituationFromUrl(): void {
  if (typeof window === 'undefined') return
  const marker = `${window.location.pathname}${window.location.search}`
  if (marker === state.syncedUrl) return
  state.syncedUrl = marker
  const value = new URLSearchParams(window.location.search).get('tab') as HandoverSituation | null
  if (value && value in situationLabels) state.situation = value
}

function allTasks(): SewingCutPieceResponsibilityProjection[] {
  return ensureSewingCutPieceResponsibilityOverviewDemos()
}

function filteredTasks(tasks: SewingCutPieceResponsibilityProjection[]): SewingCutPieceResponsibilityProjection[] {
  const keyword = state.keyword.trim().toLowerCase()
  return tasks
    .filter((item) => classifyHandoverSituation(item) === state.situation)
    .filter((item) => !keyword || [
      item.context.taskNo || item.context.runtimeTaskId,
      item.context.productionOrderNo || item.context.productionOrderId,
      item.context.factoryName,
      item.context.ppicName,
      ...item.lines.flatMap((line) => [line.skuCode, line.partName]),
    ].some((value) => value.toLowerCase().includes(keyword)))
}

function nextCommandId(action: string): string {
  state.commandSequence += 1
  return `CMD-PPIC-${action}-${Date.now()}-${state.commandSequence}`
}

function shortageLabel(shape: string): { text: string; tone: string } {
  if (shape === 'ENTIRE_PART_MISSING') return { text: '整个部位未交', tone: 'bg-red-50 text-red-700' }
  if (shape === 'AT_LEAST_HALF_MISSING') return { text: '缺口达到一半', tone: 'bg-amber-50 text-amber-800' }
  if (shape === 'PARTIAL_SHORTAGE') return { text: '局部欠片未达一半', tone: 'bg-slate-100 text-slate-700' }
  return { text: '数量已齐', tone: 'bg-emerald-50 text-emerald-700' }
}

function renderImageButton(projection: SewingCutPieceResponsibilityProjection, classes = 'h-16 w-14'): string {
  const label = `${projection.context.taskNo || projection.context.runtimeTaskId}款式`
  const imageUrl = '/shirt-sample.jpg'
  return `<button type="button" class="relative ${classes} shrink-0 overflow-hidden rounded border bg-slate-50" data-sewing-cut-piece-action="preview-image" data-image-url="${imageUrl}" data-image-label="${escapeHtml(label)}" aria-label="查看${escapeHtml(label)}高清图"><img class="h-full w-full object-cover" src="${imageUrl}" alt="${escapeHtml(label)}实拍图" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span hidden class="absolute inset-0 flex items-center justify-center bg-red-50 px-1 text-center text-[10px] text-red-700">图片加载失败</span></button>`
}

function taskNextAction(projection: SewingCutPieceResponsibilityProjection): string {
  const situation = classifyHandoverSituation(projection)
  if (situation === 'UNHANDED') return '<b class="text-amber-800">跟进裁床实际交出</b><p class="mt-1 text-xs text-slate-500">交出前不判定欠片</p>'
  if (situation === 'HANDED_NO_DEBT') return '<b class="text-emerald-700">当前无需欠片跟进</b><p class="mt-1 text-xs text-slate-500">继续跟进批版与回货</p>'
  if (projection.structuralMissingLineCount > 0) return `<b class="text-red-700">核对结构性缺片</b><p class="mt-1 text-xs text-slate-500">${projection.structuralMissingLineCount}个部位缺一半及以上，达到排除核对阈值</p>`
  return '<b class="text-amber-800">跟进裁床补齐欠片</b><p class="mt-1 text-xs text-slate-500">缺口未达一半，不允许人为排除</p>'
}

const columns: StandardListColumn<SewingCutPieceResponsibilityProjection>[] = [
  { key: 'task', title: '车缝任务／款式', width: 300, required: true, render: (row) => `<div class="flex gap-3">${renderImageButton(row)}<div class="min-w-0"><b class="block truncate">${escapeHtml(row.context.taskNo || row.context.runtimeTaskId)}</b><p class="mt-1 truncate text-xs text-slate-500">${escapeHtml(row.context.productionOrderNo || row.context.productionOrderId)}</p><p class="mt-2 text-xs text-slate-500">${escapeHtml(row.lines[0]?.skuCode || '—')}</p></div></div>` },
  { key: 'factory', title: '工厂／PPIC', width: 220, required: true, render: (row) => `<b>${escapeHtml(row.context.factoryName)}</b><p class="mt-1 text-xs font-semibold text-blue-700">PPIC：${escapeHtml(row.context.ppicName)}</p>` },
  { key: 'handover', title: '交出进度', width: 190, required: true, render: (row) => `<b>${row.totalHandedOverPieceQty.toLocaleString()} / ${row.totalRequiredPieceQty.toLocaleString()}片</b><p class="mt-1 text-xs text-slate-500">分配${row.skuSummaries.reduce((sum, item) => sum + item.allocatedGarmentQty, 0).toLocaleString()}件</p>` },
  { key: 'kit', title: '齐套／回货责任', width: 220, required: true, render: (row) => `<b>严格${row.strictCompleteKitQty.toLocaleString()}件</b><p class="mt-1 text-xs text-blue-700">有效${row.effectiveCompleteKitQty.toLocaleString()}件／责任${row.returnResponsibilityQty.toLocaleString()}件</p>` },
  {
    key: 'debt', title: '欠片情况', width: 210, required: true,
    render: (row) => classifyHandoverSituation(row) === 'UNHANDED'
      ? '<b class="text-slate-500">交出前不判欠片</b>'
      : row.totalDebtPieceQty > 0
        ? `<b class="text-red-700">仍欠${row.totalDebtPieceQty.toLocaleString()}片</b><p class="mt-1 text-xs text-slate-500">结构性缺片${row.structuralMissingLineCount}个部位 · 已排除${row.activeExclusionCount}个</p>${row.totalOverPieceQty ? `<p class="mt-1 text-xs text-amber-700">另有多交${row.totalOverPieceQty.toLocaleString()}片</p>` : ''}`
        : `<b class="text-emerald-700">不欠片</b>${row.totalOverPieceQty ? `<p class="mt-1 text-xs text-amber-700">多交${row.totalOverPieceQty.toLocaleString()}片</p>` : ''}`,
  },
  { key: 'next', title: '下一步跟进', width: 210, required: true, render: taskNextAction },
  { key: 'actions', title: '操作', width: 110, required: true, actionColumn: true, render: (row) => `<button class="font-semibold text-blue-700" data-sewing-cut-piece-action="open-detail" data-assignment-id="${escapeHtml(row.context.assignmentId)}">查看详情</button>` },
]

const preferences: StandardListColumnPreferences = {
  order: columns.filter((column) => !column.actionColumn).map((column) => column.key),
  visibleKeys: columns.map((column) => column.key),
  frozenKeys: ['task'],
  pageSize: 20,
}

function renderDetailContent(projection: SewingCutPieceResponsibilityProjection): string {
  const context = projection.context
  const situation = classifyHandoverSituation(projection)
  const handovers = listSewingCutPieceHandoverEvents(context.assignmentId)
  const exclusions = listSewingCutPiecePartExclusionVersions(context.assignmentId)
  const responsibility = listSewingReturnResponsibilityVersions(context.assignmentId)
  const rowHtml = projection.lines.map((line) => {
    const shortage = shortageLabel(line.shortageShape)
    const eligibility = getSewingCutPiecePartExclusionEligibility(line)
    const status = situation === 'UNHANDED'
      ? '<span class="rounded bg-amber-50 px-2 py-1 text-xs text-amber-800">等待裁床交出</span>'
      : `<span class="rounded px-2 py-1 text-xs ${shortage.tone}">${shortage.text}</span>${line.excludedFromEffectiveKit ? '<p class="mt-2 text-xs font-semibold text-blue-700">已排除有效齐套；欠片仍保留</p>' : ''}`
    let action = '<span class="text-xs text-slate-400">—</span>'
    if (situation === 'HANDED_WITH_DEBT' && line.excludedFromEffectiveKit && line.exclusionVersionId) {
      action = `<button class="font-semibold text-blue-700" data-sewing-cut-piece-action="open-cancel-exclusion" data-assignment-id="${escapeHtml(context.assignmentId)}" data-exclusion-version-id="${escapeHtml(line.exclusionVersionId)}">取消排除</button>`
    } else if (situation === 'HANDED_WITH_DEBT' && eligibility.eligible) {
      action = `<button class="font-semibold text-blue-700" data-sewing-cut-piece-action="open-exclusion" data-assignment-id="${escapeHtml(context.assignmentId)}" data-requirement-line-id="${escapeHtml(line.requirementLineId)}">排除部位</button>`
    } else if (situation === 'HANDED_WITH_DEBT' && line.debtPieceQty > 0) {
      action = `<span class="text-xs text-slate-500">${escapeHtml(eligibility.reason)}</span>`
    }
    return `<tr class="border-t align-top"><td class="p-3"><b>${escapeHtml(line.skuCode)}</b><p class="mt-1 text-xs text-slate-500">${escapeHtml(line.color)} / ${escapeHtml(line.size)}</p></td><td class="p-3"><b>${escapeHtml(line.partName)}</b><p class="mt-1 text-xs text-slate-500">每件${line.piecesPerGarment}片</p></td><td class="p-3 text-right">${line.requiredPieceQty.toLocaleString()}片</td><td class="p-3 text-right font-semibold">${line.handedOverPieceQty.toLocaleString()}片</td><td class="p-3 text-right ${situation !== 'UNHANDED' && line.debtPieceQty ? 'font-bold text-red-700' : ''}">${situation === 'UNHANDED' ? '—' : `${line.debtPieceQty.toLocaleString()}片`}</td><td class="p-3 text-right ${line.overPieceQty ? 'font-semibold text-amber-700' : ''}">${line.overPieceQty.toLocaleString()}片</td><td class="p-3">${status}</td><td class="max-w-52 p-3 text-right">${action}</td></tr>`
  }).join('')
  const exclusionHistory = exclusions.length
    ? exclusions.slice().reverse().map((item) => `<article class="rounded border p-3 text-sm"><div class="flex flex-wrap justify-between gap-2"><b>${escapeHtml(item.partName)} · ${escapeHtml(item.color)} / ${escapeHtml(item.size)}</b><span class="rounded px-2 py-1 text-xs ${item.status === 'EFFECTIVE' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'}">${item.status === 'EFFECTIVE' ? '当前有效' : item.status === 'CANCELLED' ? '已取消' : '历史版本'}</span></div><p class="mt-2">${escapeHtml(item.reason)}</p><p class="mt-1 text-xs text-slate-500">生产影响：${escapeHtml(item.productionImpact || '未填写')}</p><p class="mt-2 text-xs text-slate-500">${escapeHtml(item.createdByPpicName)} · ${escapeHtml(item.createdAt)} · 证据${item.evidenceUrls.length}张</p>${item.cancelReason ? `<p class="mt-2 text-xs text-slate-500">取消原因：${escapeHtml(item.cancelReason)}</p>` : ''}</article>`).join('')
    : '<p class="rounded border border-dashed p-4 text-sm text-slate-500">当前没有人为排除部位。</p>'
  const handoverHistory = handovers.length
    ? handovers.map((item) => `<tr class="border-t"><td class="p-3"><b>${escapeHtml(item.handoverRecordNo)}</b><p class="text-xs text-slate-500">${escapeHtml(item.dispatchBatchId)}</p></td><td class="p-3">${item.lines.length}个部位</td><td class="p-3 text-right">${item.lines.reduce((sum, line) => sum + line.pieceQty, 0).toLocaleString()}片</td><td class="p-3">${escapeHtml(item.handedOverAt)}</td><td class="p-3">${escapeHtml(item.handedOverBy)}</td></tr>`).join('')
    : '<tr><td class="p-6 text-center text-sm text-slate-500" colspan="5">裁床尚未形成确认交出记录。</td></tr>'
  const debtSummary = situation === 'UNHANDED'
    ? `<article class="rounded border p-3"><p class="text-xs text-slate-500">待裁床交出</p><b class="mt-2 block text-lg text-amber-700">${projection.totalRequiredPieceQty.toLocaleString()}片</b></article>`
    : `<article class="rounded border p-3"><p class="text-xs text-slate-500">欠片／多交</p><b class="mt-2 block text-lg ${projection.totalDebtPieceQty ? 'text-red-700' : ''}">${projection.totalDebtPieceQty.toLocaleString()}／${projection.totalOverPieceQty.toLocaleString()}片</b></article>`
  return `<div class="space-y-4 p-5"><div class="grid gap-3 md:grid-cols-5"><article class="rounded border p-3"><p class="text-xs text-slate-500">分配数量</p><b class="mt-2 block text-lg">${projection.skuSummaries.reduce((sum, item) => sum + item.allocatedGarmentQty, 0).toLocaleString()}件</b></article><article class="rounded border p-3"><p class="text-xs text-slate-500">累计确认交出</p><b class="mt-2 block text-lg">${projection.totalHandedOverPieceQty.toLocaleString()}片</b></article><article class="rounded border p-3"><p class="text-xs text-slate-500">严格齐套</p><b class="mt-2 block text-lg">${projection.strictCompleteKitQty.toLocaleString()}件</b></article><article class="rounded border p-3"><p class="text-xs text-slate-500">有效齐套／责任</p><b class="mt-2 block text-lg text-blue-700">${projection.effectiveCompleteKitQty.toLocaleString()}／${projection.returnResponsibilityQty.toLocaleString()}件</b></article>${debtSummary}</div><div class="overflow-auto rounded border"><table class="w-full min-w-[1050px] text-left text-sm"><thead class="bg-slate-50"><tr><th class="p-3">SKU</th><th class="p-3">部位／用量</th><th class="p-3 text-right">应交</th><th class="p-3 text-right">累计实交</th><th class="p-3 text-right">欠片</th><th class="p-3 text-right">多交</th><th class="p-3">当前情况</th><th class="p-3 text-right">操作</th></tr></thead><tbody>${rowHtml}</tbody></table></div><div class="grid gap-4 lg:grid-cols-2"><section class="rounded border p-4"><h3 class="font-semibold">部位排除版本</h3><p class="mt-1 text-xs text-slate-500">只调整有效齐套，不清除欠片；取消后恢复部位计算，已冻结回货责任不回退。</p><div class="mt-3 space-y-2">${exclusionHistory}</div></section><section class="rounded border p-4"><h3 class="font-semibold">回货责任版本</h3><p class="mt-1 text-xs text-slate-500">正式交出或排除只在责任增加时冻结新版本；补交和取消排除不重复增加、也不回退历史责任。</p><div class="mt-3 space-y-2">${responsibility.length ? responsibility.slice().reverse().map((item) => `<article class="rounded bg-slate-50 p-3 text-sm"><b>${item.totalResponsibilityQty.toLocaleString()}件</b><p class="mt-1 text-xs text-slate-500">${escapeHtml(item.createdAt)} · ${escapeHtml(item.createdBy)}</p></article>`).join('') : '<p class="rounded border border-dashed p-4 text-sm text-slate-500">尚未形成回货责任。</p>'}</div></section></div><div class="overflow-auto rounded border"><table class="w-full min-w-[720px] text-left text-sm"><thead class="bg-slate-50"><tr><th class="p-3">裁床交出记录</th><th class="p-3">部位数</th><th class="p-3 text-right">交出片数</th><th class="p-3">时间</th><th class="p-3">操作人</th></tr></thead><tbody>${handoverHistory}</tbody></table></div></div>`
}

function dialogShell(title: string, subtitle: string, body: string, footer = '', width = 'max-w-6xl'): string {
  return `<div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}"><button class="absolute inset-0" data-sewing-cut-piece-action="close-dialog" aria-label="关闭"></button><section class="relative z-10 max-h-[92vh] w-full ${width} overflow-auto rounded-lg bg-white shadow-xl"><header class="flex justify-between gap-3 border-b p-5"><div><h2 class="text-lg font-semibold">${escapeHtml(title)}</h2><p class="mt-1 text-xs text-slate-500">${escapeHtml(subtitle)}</p></div><button class="rounded border px-3 py-1 text-sm" data-sewing-cut-piece-action="close-dialog">关闭</button></header>${body}${footer ? `<footer class="flex justify-end gap-2 border-t p-4">${footer}</footer>` : ''}</section></div>`
}

function renderDialog(): string {
  if (!state.dialog) return ''
  if (state.dialog.kind === 'IMAGE') return `<div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4" role="dialog" aria-modal="true" aria-label="${escapeHtml(state.dialog.label)}高清大图"><button class="absolute inset-0" data-sewing-cut-piece-action="close-dialog" aria-label="关闭大图"></button><section class="relative z-10 max-h-[92vh] max-w-5xl overflow-auto rounded-lg bg-white p-3"><header class="mb-3 flex justify-between gap-3"><b>${escapeHtml(state.dialog.label)}</b><button class="rounded border px-3 py-1 text-sm" data-sewing-cut-piece-action="close-dialog">关闭</button></header><img class="max-h-[78vh] max-w-full object-contain" src="${escapeHtml(state.dialog.imageUrl)}" alt="${escapeHtml(state.dialog.label)}高清图"></section></div>`
  if (state.dialog.kind === 'DETAIL') {
    const projection = getSewingCutPieceResponsibilityProjection(state.dialog.assignmentId)
    return dialogShell('交出与欠片详情', `${projection.context.taskNo || projection.context.runtimeTaskId} · ${projection.context.factoryName} · PPIC ${projection.context.ppicName}`, renderDetailContent(projection))
  }
  if (state.dialog.kind === 'CANCEL_EXCLUSION') {
    const dialog = state.dialog
    const projection = getSewingCutPieceResponsibilityProjection(dialog.assignmentId)
    const exclusion = listSewingCutPiecePartExclusionVersions(dialog.assignmentId).find((item) => item.exclusionVersionId === dialog.exclusionVersionId)
    if (!exclusion) return ''
    const body = `<div class="space-y-4 p-5">${state.dialog.error ? `<div class="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">${escapeHtml(state.dialog.error)}</div>` : ''}<p class="rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">取消${escapeHtml(exclusion.partName)}的排除后，该部位重新参与有效齐套计算；历史排除记录不会删除，已经冻结的工厂回货责任也不会回退。</p><label class="block text-sm">取消原因<textarea class="mt-1 min-h-24 w-full rounded border p-3" data-sewing-cut-piece-field="cancelReason" placeholder="例如：裁床已完成该部位补交，需要恢复严格齐套口径"></textarea></label></div>`
    return dialogShell('取消部位排除', `${projection.context.taskNo || projection.context.runtimeTaskId} · ${exclusion.partName}`, body, '<button class="rounded border px-4 py-2 text-sm" data-sewing-cut-piece-action="close-dialog">取消</button><button class="rounded bg-blue-600 px-4 py-2 text-sm text-white" data-sewing-cut-piece-action="submit-cancel-exclusion">确认取消排除</button>', 'max-w-xl')
  }
  const dialog = state.dialog
  const projection = getSewingCutPieceResponsibilityProjection(dialog.assignmentId)
  const line = projection.lines.find((item) => item.requirementLineId === dialog.requirementLineId)
  if (!line) return ''
  const eligibility = getSewingCutPiecePartExclusionEligibility(line)
  const body = `<div class="space-y-4 p-5">${state.dialog.error ? `<div class="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">${escapeHtml(state.dialog.error)}</div>` : ''}<p class="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><b>${escapeHtml(eligibility.reason)}。</b>排除只调整有效齐套；应交部位和欠片${line.debtPieceQty.toLocaleString()}片继续保留并进入补料跟进。</p><label class="block text-sm">排除原因<textarea class="mt-1 min-h-24 w-full rounded border p-3" data-sewing-cut-piece-field="reason">裁床尚未完成${escapeHtml(line.partName)}裁片，为避免主体裁片等待，暂时排除该部位计算有效齐套。</textarea></label><label class="block text-sm">生产影响<textarea class="mt-1 min-h-20 w-full rounded border p-3" data-sewing-cut-piece-field="productionImpact">主体裁片可以先投入车缝，${escapeHtml(line.partName)}后续仍由裁床补交。</textarea></label><label class="block text-sm">核对证据图片地址<input class="mt-1 h-10 w-full rounded border px-3" data-sewing-cut-piece-field="evidenceUrl" value="/shirt-sample.jpg"></label></div>`
  return dialogShell('人为排除部位', `${line.color} / ${line.size} · ${line.partName}`, body, '<button class="rounded border px-4 py-2 text-sm" data-sewing-cut-piece-action="close-dialog">取消</button><button class="rounded bg-blue-600 px-4 py-2 text-sm text-white" data-sewing-cut-piece-action="submit-exclusion">确认排除</button>', 'max-w-xl')
}

export function renderSewingCutPieceHandoverPage(): string {
  syncSituationFromUrl()
  const completeRows = allTasks()
  const filtered = filteredTasks(completeRows)
  const totalPages = Math.max(1, Math.ceil(filtered.length / state.pageSize))
  state.page = Math.min(Math.max(1, state.page), totalPages)
  const start = (state.page - 1) * state.pageSize
  const pageRows = filtered.slice(start, start + state.pageSize)
  return `<div data-sewing-cut-piece-page data-skip-page-rerender="true">${renderStandardListPage({
    title: '交出与欠片',
    primaryActionsHtml: '<a class="flex h-9 items-center rounded-md border bg-background px-4 text-sm font-semibold text-foreground hover:bg-muted" href="/fcs/dispatch/workbench?type=SEWING">返回任务分配</a>',
    feedbackHtml: state.feedback ? `<div class="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">${escapeHtml(state.feedback)}</div>` : '',
    statusTabsHtml: renderUiTabs({
      tabs: (Object.keys(situationLabels) as HandoverSituation[]).map((situation) => ({ key: situation, label: situationLabels[situation], count: completeRows.filter((item) => classifyHandoverSituation(item) === situation).length })),
      activeKey: state.situation,
      variant: 'pills',
      prefix: 'sewing-cut-piece',
      action: 'switch-tab',
      fullWidth: true,
    }),
    filtersHtml: renderStandardListFilters({
      actionPrefix: 'sewing-cut-piece',
      fieldsHtml: `<input class="h-9 min-w-80 rounded border px-3 text-sm" placeholder="车缝任务 / 生产单 / 工厂 / PPIC / 部位" value="${escapeHtml(state.draftKeyword)}" data-sewing-cut-piece-filter="keyword">`,
    }),
    listTitle: `${situationLabels[state.situation]}的车缝任务`,
    tableHtml: renderStandardListTable({ columns, rows: pageRows, preferences: { ...preferences, pageSize: state.pageSize }, sort: null, eventPrefix: 'sewing-cut-piece', emptyText: `暂无${situationLabels[state.situation]}的车缝任务` }),
    paginationHtml: renderTablePagination({ total: filtered.length, from: filtered.length ? start + 1 : 0, to: Math.min(start + state.pageSize, filtered.length), currentPage: state.page, totalPages, pageSize: state.pageSize, actionPrefix: 'sewing-cut-piece', fieldPrefix: 'sewing-cut-piece', pageSizeOptions: [20, 50] }),
    overlaysHtml: renderDialog(),
  })}</div>`
}

function refreshPage(): void {
  const root = document.querySelector<HTMLElement>('[data-sewing-cut-piece-page]')
  if (root) root.outerHTML = renderSewingCutPieceHandoverPage()
}

export function isSewingCutPieceHandoverDialogOpen(): boolean { return state.dialog !== null }
export function closeSewingCutPieceHandoverDialog(): boolean { if (!state.dialog) return false; state.dialog = null; refreshPage(); return true }

export async function handleSewingCutPieceHandoverEvent(target: HTMLElement, event?: Event): Promise<boolean> {
  const filter = target.closest<HTMLInputElement | HTMLSelectElement>('[data-sewing-cut-piece-filter]')
  if (filter) {
    if (filter.dataset.sewingCutPieceFilter === 'keyword') state.draftKeyword = filter.value
    if (filter.dataset.sewingCutPieceFilter === 'pageSize') {
      state.pageSize = Number(filter.value) || 20
      state.page = 1
      refreshPage()
    }
    return true
  }
  const node = target.closest<HTMLElement>('[data-sewing-cut-piece-action]')
  const action = node?.dataset.sewingCutPieceAction
  if (!node || !action) return false
  if (action.startsWith('switch-tab:')) {
    const situation = action.slice('switch-tab:'.length) as HandoverSituation
    if (!(situation in situationLabels)) return false
    state.situation = situation
    state.page = 1
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      url.searchParams.set('tab', situation)
      window.history.replaceState({}, '', `${url.pathname}${url.search}`)
      state.syncedUrl = `${url.pathname}${url.search}`
    }
  } else if (action === 'query') {
    state.keyword = state.draftKeyword
    state.page = 1
  } else if (action === 'reset') {
    state.keyword = ''
    state.draftKeyword = ''
    state.page = 1
  } else if (action === 'open-detail') {
    state.dialog = { kind: 'DETAIL', assignmentId: node.dataset.assignmentId || '' }
  } else if (action === 'preview-image') {
    state.dialog = { kind: 'IMAGE', imageUrl: node.dataset.imageUrl || '', label: node.dataset.imageLabel || '图片' }
  } else if (action === 'close-dialog') {
    state.dialog = null
  } else if (action === 'open-exclusion') {
    state.dialog = { kind: 'EXCLUSION', assignmentId: node.dataset.assignmentId || '', requirementLineId: node.dataset.requirementLineId || '', error: '' }
  } else if (action === 'open-cancel-exclusion') {
    state.dialog = { kind: 'CANCEL_EXCLUSION', assignmentId: node.dataset.assignmentId || '', exclusionVersionId: node.dataset.exclusionVersionId || '', error: '' }
  } else if (action === 'submit-exclusion' && state.dialog?.kind === 'EXCLUSION') {
    event?.preventDefault()
    const dialog = state.dialog
    try {
      const projection = getSewingCutPieceResponsibilityProjection(dialog.assignmentId)
      const line = projection.lines.find((item) => item.requirementLineId === dialog.requirementLineId)
      if (!line) throw new Error('未找到待排除部位')
      const value = (name: string) => document.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[data-sewing-cut-piece-field="${name}"]`)?.value.trim() || ''
      createSewingCutPiecePartExclusion({
        commandId: nextCommandId('EXCLUSION'), assignmentId: dialog.assignmentId,
        skuCode: line.skuCode, color: line.color, size: line.size, partCode: line.partCode,
        reason: value('reason'), evidenceUrls: [value('evidenceUrl')].filter(Boolean), productionImpact: value('productionImpact'),
        createdAt: formatOperationLocalWallClock(), createdByPpicId: projection.context.ppicId,
      })
      state.feedback = `已排除${line.partName}的有效齐套计算；欠片和补料跟进仍保留。`
      state.dialog = { kind: 'DETAIL', assignmentId: projection.context.assignmentId }
    } catch (error) {
      state.dialog = { ...dialog, error: error instanceof Error ? error.message : '排除失败' }
    }
  } else if (action === 'submit-cancel-exclusion' && state.dialog?.kind === 'CANCEL_EXCLUSION') {
    event?.preventDefault()
    const dialog = state.dialog
    try {
      const projection = getSewingCutPieceResponsibilityProjection(dialog.assignmentId)
      const reason = document.querySelector<HTMLTextAreaElement>('[data-sewing-cut-piece-field="cancelReason"]')?.value.trim() || ''
      const cancelled = cancelSewingCutPiecePartExclusion({
        commandId: nextCommandId('CANCEL-EXCLUSION'), exclusionVersionId: dialog.exclusionVersionId,
        reason, cancelledAt: formatOperationLocalWallClock(), cancelledByPpicId: projection.context.ppicId,
      })
      state.feedback = `已取消${cancelled.partName}排除；有效齐套已恢复计算，历史回货责任保持不变。`
      state.dialog = { kind: 'DETAIL', assignmentId: projection.context.assignmentId }
    } catch (error) {
      state.dialog = { ...dialog, error: error instanceof Error ? error.message : '取消排除失败' }
    }
  } else if (action === 'prev-page') {
    state.page = Math.max(1, state.page - 1)
  } else if (action === 'next-page') {
    state.page += 1
  } else {
    return false
  }
  refreshPage()
  return true
}
