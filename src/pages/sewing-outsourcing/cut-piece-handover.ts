// @page-pattern: detail

import {
  createSewingCutPiecePartExclusion,
  ensureSewingCutPieceResponsibilityOverviewDemos,
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
  | { kind: 'EXCLUSION'; assignmentId: string; requirementLineId: string; error: string }
  | { kind: 'IMAGE'; imageUrl: string; label: string }
  | null

const state = {
  situation: 'UNHANDED' as HandoverSituation,
  assignmentId: '',
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

function visibleTasks(tasks: SewingCutPieceResponsibilityProjection[]): SewingCutPieceResponsibilityProjection[] {
  return tasks.filter((item) => classifyHandoverSituation(item) === state.situation)
}

function activeProjection(tasks: SewingCutPieceResponsibilityProjection[]): SewingCutPieceResponsibilityProjection | null {
  const visible = visibleTasks(tasks)
  return visible.find((item) => item.context.assignmentId === state.assignmentId) || visible[0] || null
}

function nextCommandId(): string {
  state.commandSequence += 1
  return `CMD-PPIC-EXCLUSION-${Date.now()}-${state.commandSequence}`
}

function shortageLabel(shape: string): { text: string; tone: string } {
  if (shape === 'ENTIRE_PART_MISSING') return { text: '整个部位未交', tone: 'bg-red-50 text-red-700' }
  if (shape === 'AT_LEAST_HALF_MISSING') return { text: '缺口达到一半', tone: 'bg-amber-50 text-amber-800' }
  if (shape === 'PARTIAL_SHORTAGE') return { text: '部分欠片', tone: 'bg-slate-100 text-slate-700' }
  return { text: '数量已齐', tone: 'bg-emerald-50 text-emerald-700' }
}

function renderImageButton(imageUrl: string, label: string, classes = 'h-16 w-14'): string {
  return `<button type="button" class="relative ${classes} shrink-0 overflow-hidden rounded border bg-slate-50" data-sewing-cut-piece-action="preview-image" data-image-url="${escapeHtml(imageUrl)}" data-image-label="${escapeHtml(label)}" aria-label="查看${escapeHtml(label)}高清图"><img class="h-full w-full object-cover" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(label)}实拍图" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span hidden class="absolute inset-0 flex items-center justify-center bg-red-50 px-1 text-center text-[10px] text-red-700">图片加载失败</span></button>`
}

function renderTabs(tasks: SewingCutPieceResponsibilityProjection[]): string {
  return `<nav class="flex flex-wrap gap-2 rounded-xl border bg-white p-2" aria-label="交出与欠片状态">${(Object.keys(situationLabels) as HandoverSituation[]).map((situation) => {
    const count = tasks.filter((item) => classifyHandoverSituation(item) === situation).length
    const selected = situation === state.situation
    return `<button type="button" class="rounded-lg px-4 py-2 text-sm font-semibold ${selected ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}" data-sewing-cut-piece-action="switch-tab" data-situation="${situation}">${situationLabels[situation]} <span class="ml-1 rounded-full ${selected ? 'bg-white/20' : 'bg-slate-200'} px-2 py-0.5 text-xs">${count}</span></button>`
  }).join('')}</nav>`
}

function renderTaskChooser(tasks: SewingCutPieceResponsibilityProjection[], active: SewingCutPieceResponsibilityProjection | null): string {
  if (!tasks.length) return '<section class="rounded-xl border border-dashed bg-white p-8 text-center text-sm text-slate-500">当前状态下没有车缝任务。</section>'
  return `<section class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">${tasks.map((projection) => {
    const context = projection.context
    const selected = active?.context.assignmentId === context.assignmentId
    const situation = classifyHandoverSituation(projection)
    const quantity = situation === 'UNHANDED'
      ? `待交${projection.totalRequiredPieceQty.toLocaleString()}片`
      : situation === 'HANDED_WITH_DEBT'
        ? `仍欠${projection.totalDebtPieceQty.toLocaleString()}片`
        : `已交${projection.totalHandedOverPieceQty.toLocaleString()}片`
    return `<button type="button" class="rounded-xl border p-4 text-left ${selected ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-300' : 'bg-white hover:border-blue-300'}" data-sewing-cut-piece-action="select-task" data-assignment-id="${escapeHtml(context.assignmentId)}"><div class="flex gap-3">${renderImageButton('/shirt-sample.jpg', `${context.taskNo || context.runtimeTaskId}款式`)}<div class="min-w-0"><b class="block truncate">${escapeHtml(context.taskNo || context.runtimeTaskId)}</b><p class="mt-1 truncate text-xs text-slate-500">${escapeHtml(context.productionOrderNo || context.productionOrderId)}</p><p class="mt-2 text-sm font-semibold ${situation === 'HANDED_WITH_DEBT' ? 'text-red-700' : situation === 'UNHANDED' ? 'text-amber-800' : 'text-emerald-700'}">${escapeHtml(quantity)}</p><p class="mt-1 text-xs text-blue-700">PPIC：${escapeHtml(context.ppicName)}</p></div></div></button>`
  }).join('')}</section>`
}

function renderDetail(projection: SewingCutPieceResponsibilityProjection): string {
  const context = projection.context
  const situation = classifyHandoverSituation(projection)
  const handovers = listSewingCutPieceHandoverEvents(context.assignmentId)
  const exclusions = listSewingCutPiecePartExclusionVersions(context.assignmentId)
  const responsibility = listSewingReturnResponsibilityVersions(context.assignmentId)
  const rowHtml = projection.lines.map((line) => {
    const shortage = shortageLabel(line.shortageShape)
    const status = situation === 'UNHANDED'
      ? '<span class="rounded bg-amber-50 px-2 py-1 text-xs text-amber-800">等待裁床交出</span>'
      : `<span class="rounded px-2 py-1 text-xs ${shortage.tone}">${shortage.text}</span>${line.excludedFromEffectiveKit ? '<p class="mt-2 text-xs font-semibold text-blue-700">已排除有效齐套计算；欠片仍保留</p>' : ''}`
    const debt = situation === 'UNHANDED' ? '—' : `${line.debtPieceQty.toLocaleString()}片`
    return `<tr class="border-t align-top"><td class="p-3"><b>${escapeHtml(line.skuCode)}</b><p class="mt-1 text-xs text-slate-500">${escapeHtml(line.color)} / ${escapeHtml(line.size)}</p></td><td class="p-3"><b>${escapeHtml(line.partName)}</b><p class="mt-1 text-xs text-slate-500">每件${line.piecesPerGarment}片</p></td><td class="p-3 text-right">${line.requiredPieceQty.toLocaleString()}片</td><td class="p-3 text-right font-semibold">${line.handedOverPieceQty.toLocaleString()}片</td><td class="p-3 text-right ${situation !== 'UNHANDED' && line.debtPieceQty ? 'font-bold text-red-700' : ''}">${debt}</td><td class="p-3">${status}</td><td class="p-3 text-right">${situation === 'HANDED_WITH_DEBT' && line.debtPieceQty > 0 && !line.excludedFromEffectiveKit ? `<button class="text-blue-700" data-sewing-cut-piece-action="open-exclusion" data-assignment-id="${escapeHtml(context.assignmentId)}" data-requirement-line-id="${escapeHtml(line.requirementLineId)}">排除部位</button>` : '<span class="text-xs text-slate-400">—</span>'}</td></tr>`
  }).join('')
  const handoverHistory = handovers.length
    ? handovers.map((event) => `<tr class="border-t"><td class="p-3"><b>${escapeHtml(event.handoverRecordNo)}</b><p class="text-xs text-slate-500">${escapeHtml(event.dispatchBatchId)}</p></td><td class="p-3">${event.lines.length}个部位</td><td class="p-3 text-right">${event.lines.reduce((sum, line) => sum + line.pieceQty, 0).toLocaleString()}片</td><td class="p-3">${escapeHtml(event.handedOverAt)}</td><td class="p-3">${escapeHtml(event.handedOverBy)}</td></tr>`).join('')
    : '<tr><td class="p-6 text-center text-sm text-slate-500" colspan="5">裁床尚未形成确认交出记录。</td></tr>'
  const exclusionHistory = exclusions.length
    ? exclusions.slice().reverse().map((item) => `<article class="rounded border p-3 text-sm"><div class="flex justify-between gap-2"><b>${escapeHtml(item.partName)} · ${escapeHtml(item.color)} / ${escapeHtml(item.size)}</b><span class="rounded bg-blue-50 px-2 py-1 text-xs text-blue-700">${item.status === 'EFFECTIVE' ? '当前有效' : '历史版本'}</span></div><p class="mt-2">${escapeHtml(item.reason)}</p><p class="mt-2 text-xs text-slate-500">${escapeHtml(item.createdByPpicName)} · ${escapeHtml(item.createdAt)}</p></article>`).join('')
    : '<p class="rounded border border-dashed p-4 text-sm text-slate-500">当前没有人为排除部位。</p>'
  return `<section class="space-y-4 rounded-xl border bg-white p-5" data-active-handover-assignment="${escapeHtml(context.assignmentId)}"><header class="flex flex-wrap justify-between gap-3"><div><h2 class="font-semibold">${escapeHtml(context.taskNo || context.runtimeTaskId)} · ${situationLabels[situation]}</h2><p class="mt-1 text-sm text-slate-500">${escapeHtml(context.factoryName)} · PPIC ${escapeHtml(context.ppicName)}</p></div><span class="rounded bg-slate-100 px-3 py-2 text-xs">分配${projection.skuSummaries.reduce((sum, item) => sum + item.allocatedGarmentQty, 0).toLocaleString()}件</span></header>
    <div class="grid gap-3 md:grid-cols-4"><article class="rounded-lg border p-3"><p class="text-xs text-slate-500">累计确认交出</p><b class="mt-2 block text-xl">${projection.totalHandedOverPieceQty.toLocaleString()}片</b></article><article class="rounded-lg border p-3"><p class="text-xs text-slate-500">严格齐套</p><b class="mt-2 block text-xl">${projection.strictCompleteKitQty.toLocaleString()}件</b></article><article class="rounded-lg border p-3"><p class="text-xs text-slate-500">有效齐套／回货责任</p><b class="mt-2 block text-xl text-blue-700">${projection.effectiveCompleteKitQty.toLocaleString()}件 / ${projection.returnResponsibilityQty.toLocaleString()}件</b></article><article class="rounded-lg border p-3"><p class="text-xs text-slate-500">${situation === 'UNHANDED' ? '交出前不判欠片' : '裁床仍欠工厂'}</p><b class="mt-2 block text-xl ${situation === 'HANDED_WITH_DEBT' ? 'text-red-700' : ''}">${situation === 'UNHANDED' ? '—' : `${projection.totalDebtPieceQty.toLocaleString()}片`}</b></article></div>
    <div class="overflow-auto rounded-lg border"><table class="w-full min-w-[900px] text-left text-sm"><thead class="bg-slate-50"><tr><th class="p-3">SKU</th><th class="p-3">部位／用量</th><th class="p-3 text-right">应交</th><th class="p-3 text-right">累计实交</th><th class="p-3 text-right">欠片</th><th class="p-3">当前情况</th><th class="p-3 text-right">操作</th></tr></thead><tbody>${rowHtml}</tbody></table></div>
    <div class="grid gap-4 lg:grid-cols-2"><div class="rounded-lg border p-4"><h3 class="font-semibold">部位排除版本</h3><p class="mt-1 text-xs text-slate-500">只调整有效齐套，不清除欠片。</p><div class="mt-3 space-y-2">${exclusionHistory}</div></div><div class="rounded-lg border p-4"><h3 class="font-semibold">回货责任版本</h3><p class="mt-1 text-xs text-slate-500">当前${responsibility.length}个版本，补交不会重复增加责任。</p><div class="mt-3 space-y-2">${responsibility.length ? responsibility.slice().reverse().map((item) => `<article class="rounded bg-slate-50 p-3 text-sm"><b>${item.totalResponsibilityQty.toLocaleString()}件</b><p class="mt-1 text-xs text-slate-500">${escapeHtml(item.createdAt)} · ${escapeHtml(item.createdBy)}</p></article>`).join('') : '<p class="rounded border border-dashed p-4 text-sm text-slate-500">尚未形成回货责任。</p>'}</div></div></div>
    <div class="overflow-auto rounded-lg border"><table class="w-full min-w-[720px] text-left text-sm"><thead class="bg-slate-50"><tr><th class="p-3">裁床交出记录</th><th class="p-3">部位数</th><th class="p-3 text-right">交出片数</th><th class="p-3">时间</th><th class="p-3">操作人</th></tr></thead><tbody>${handoverHistory}</tbody></table></div>
  </section>`
}

function renderDialog(): string {
  if (!state.dialog) return ''
  if (state.dialog.kind === 'IMAGE') return `<div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4" role="dialog" aria-modal="true" aria-label="${escapeHtml(state.dialog.label)}高清大图"><button class="absolute inset-0" data-sewing-cut-piece-action="close-dialog" aria-label="关闭大图"></button><section class="relative z-10 max-h-[92vh] max-w-5xl overflow-auto rounded-lg bg-white p-3"><header class="mb-3 flex justify-between gap-3"><b>${escapeHtml(state.dialog.label)}</b><button class="rounded border px-3 py-1 text-sm" data-sewing-cut-piece-action="close-dialog">关闭</button></header><img class="max-h-[78vh] max-w-full object-contain" src="${escapeHtml(state.dialog.imageUrl)}" alt="${escapeHtml(state.dialog.label)}高清图"></section></div>`
  const projection = getSewingCutPieceResponsibilityProjection(state.dialog.assignmentId)
  const line = projection.lines.find((item) => item.requirementLineId === state.dialog?.requirementLineId)
  if (!line) return ''
  return `<div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4" role="dialog" aria-modal="true" aria-label="人为排除裁片部位"><button class="absolute inset-0" data-sewing-cut-piece-action="close-dialog" aria-label="关闭"></button><section class="relative z-10 w-full max-w-xl rounded-lg bg-white shadow-xl"><header class="border-b p-5"><h2 class="text-lg font-semibold">人为排除部位</h2><p class="mt-1 text-xs text-slate-500">${escapeHtml(line.color)} / ${escapeHtml(line.size)} · ${escapeHtml(line.partName)}</p></header><div class="space-y-4 p-5">${state.dialog.error ? `<div class="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">${escapeHtml(state.dialog.error)}</div>` : ''}<p class="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">裁床尚未及时裁出该部位时，PPIC可排除其有效齐套计算；应交部位和欠片${line.debtPieceQty.toLocaleString()}片仍保留。</p><label class="block text-sm">排除原因<textarea class="mt-1 min-h-24 w-full rounded border p-3" data-sewing-cut-piece-field="reason">裁床尚未完成${escapeHtml(line.partName)}裁片，为避免主体裁片等待，暂时排除该部位计算有效齐套。</textarea></label><label class="block text-sm">生产影响<textarea class="mt-1 min-h-20 w-full rounded border p-3" data-sewing-cut-piece-field="productionImpact">主体裁片可以先投入车缝，${escapeHtml(line.partName)}后续由裁床补交。</textarea></label><label class="block text-sm">核对证据<input class="mt-1 h-10 w-full rounded border px-3" data-sewing-cut-piece-field="evidenceUrl" value="/shirt-sample.jpg"></label></div><footer class="flex justify-end gap-2 border-t p-4"><button class="rounded border px-4 py-2 text-sm" data-sewing-cut-piece-action="close-dialog">取消</button><button class="rounded bg-blue-600 px-4 py-2 text-sm text-white" data-sewing-cut-piece-action="submit-exclusion">确认排除</button></footer></section></div>`
}

export function renderSewingCutPieceHandoverPage(): string {
  syncSituationFromUrl()
  const tasks = allTasks()
  const visible = visibleTasks(tasks)
  const active = activeProjection(tasks)
  if (active) state.assignmentId = active.context.assignmentId
  return `<div class="space-y-5" data-sewing-cut-piece-page data-skip-page-rerender="true"><header class="flex flex-wrap items-start justify-between gap-4"><div><p class="text-xs text-slate-500">车缝外发协同 / 交出与欠片</p><h1 class="mt-1 text-2xl font-semibold">交出与欠片</h1><p class="mt-2 text-sm text-slate-500">先按是否交出、交出后是否欠片分组，再进入任务核对部位数量和人为排除。</p></div><a class="rounded border px-4 py-2 text-sm" href="/fcs/dispatch/workbench?type=SEWING">返回任务分配</a></header>${state.feedback ? `<div class="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">${escapeHtml(state.feedback)}</div>` : ''}${renderTabs(tasks)}${renderTaskChooser(visible, active)}${active ? renderDetail(active) : ''}${renderDialog()}</div>`
}

function refreshPage(): void {
  const root = document.querySelector<HTMLElement>('[data-sewing-cut-piece-page]')
  if (root) root.outerHTML = renderSewingCutPieceHandoverPage()
}

export function isSewingCutPieceHandoverDialogOpen(): boolean { return state.dialog !== null }
export function closeSewingCutPieceHandoverDialog(): boolean { if (!state.dialog) return false; state.dialog = null; refreshPage(); return true }

export async function handleSewingCutPieceHandoverEvent(target: HTMLElement, event?: Event): Promise<boolean> {
  const node = target.closest<HTMLElement>('[data-sewing-cut-piece-action]')
  const action = node?.dataset.sewingCutPieceAction
  if (!node || !action) return false
  if (action === 'switch-tab') {
    const situation = node.dataset.situation as HandoverSituation
    if (!(situation in situationLabels)) return false
    state.situation = situation
    state.assignmentId = ''
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      url.searchParams.set('tab', situation)
      window.history.replaceState({}, '', `${url.pathname}${url.search}`)
      state.syncedUrl = `${url.pathname}${url.search}`
    }
  } else if (action === 'select-task') {
    state.assignmentId = node.dataset.assignmentId || ''
  } else if (action === 'preview-image') {
    state.dialog = { kind: 'IMAGE', imageUrl: node.dataset.imageUrl || '', label: node.dataset.imageLabel || '图片' }
  } else if (action === 'close-dialog') {
    state.dialog = null
  } else if (action === 'open-exclusion') {
    state.dialog = { kind: 'EXCLUSION', assignmentId: node.dataset.assignmentId || '', requirementLineId: node.dataset.requirementLineId || '', error: '' }
  } else if (action === 'submit-exclusion' && state.dialog?.kind === 'EXCLUSION') {
    event?.preventDefault()
    try {
      const projection = getSewingCutPieceResponsibilityProjection(state.dialog.assignmentId)
      const line = projection.lines.find((item) => item.requirementLineId === state.dialog?.requirementLineId)
      if (!line) throw new Error('未找到待排除部位')
      const value = (name: string) => document.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[data-sewing-cut-piece-field="${name}"]`)?.value.trim() || ''
      createSewingCutPiecePartExclusion({
        commandId: nextCommandId(),
        assignmentId: state.dialog.assignmentId,
        skuCode: line.skuCode,
        color: line.color,
        size: line.size,
        partCode: line.partCode,
        reason: value('reason'),
        evidenceUrls: [value('evidenceUrl')].filter(Boolean),
        productionImpact: value('productionImpact'),
        createdAt: formatOperationLocalWallClock(),
        createdByPpicId: projection.context.ppicId,
      })
      state.feedback = `已排除${line.partName}的有效齐套计算；欠片仍保留。`
      state.dialog = null
    } catch (error) {
      state.dialog = { ...state.dialog, error: error instanceof Error ? error.message : '排除失败' }
    }
  } else {
    return false
  }
  refreshPage()
  return true
}
