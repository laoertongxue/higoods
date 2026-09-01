// @page-pattern: list

import { renderStandardListFilters, renderStandardListPage } from '../../components/ui/list-page.ts'
import { renderStandardListTable, type StandardListColumn } from '../../components/ui/list-table.ts'
import type { StandardListColumnPreferences } from '../../components/ui/list-table-model.ts'
import { renderTablePagination } from '../../components/ui/pagination.ts'
import { renderTabs as renderUiTabs } from '../../components/ui/tabs.ts'
import { POST_FINISHING_SEWING_TASK_TYPE_LABEL } from '../../data/fcs/post-finishing-full-flow.ts'
import {
  SEWING_RETURN_TRACKING_DEMO_NOW,
  getSewingOutsourcingReturnTrackingRow,
  listSewingOutsourcingReturnTrackingRows,
  type SewingOutsourcingReturnTrackingRow,
} from '../../data/fcs/sewing-outsourcing-return-tracking.ts'
import type { ReturnMilestoneStatus } from '../../data/fcs/production-return-fulfillment.ts'
import { escapeHtml } from '../../utils.ts'

type DialogState =
  | { kind: 'DETAIL'; assignmentId: string }
  | { kind: 'IMAGE'; imageUrl: string; label: string }
  | null

type ReturnSituation = 'DUE_FOLLOW_UP' | 'OVERDUE' | 'CUTTING_SHORTFALL' | 'POST_FINISHING_PENDING' | 'REACHED'

const state = {
  keyword: '',
  draftKeyword: '',
  situation: 'DUE_FOLLOW_UP' as ReturnSituation,
  page: 1,
  pageSize: 20,
  dialog: null as DialogState,
}

const situationLabels: Record<ReturnSituation, string> = {
  DUE_FOLLOW_UP: '临期待跟进',
  OVERDUE: '已逾期',
  CUTTING_SHORTFALL: '需跟进裁床',
  POST_FINISHING_PENDING: '待后道确认',
  REACHED: '节点已达成',
}

const statusLabels: Record<ReturnMilestoneStatus, string> = {
  UPCOMING: '未到节点',
  DUE_TODAY: '今日到期',
  REACHED: '已达成',
  CUTTING_SHORTFALL: '裁床待补裁片',
  OVERDUE: '工厂逾期',
}

function statusTone(status: ReturnMilestoneStatus): string {
  if (status === 'REACHED') return 'text-emerald-700'
  if (status === 'OVERDUE') return 'text-red-700'
  if (status === 'CUTTING_SHORTFALL' || status === 'DUE_TODAY') return 'text-amber-800'
  return 'text-blue-700'
}

function sourceImage(row: SewingOutsourcingReturnTrackingRow): string {
  return row.productionOrder.skus[0]?.imageUrl || ''
}

function imageButton(row: SewingOutsourcingReturnTrackingRow): string {
  const imageUrl = sourceImage(row)
  const label = `${row.productionOrder.styleNo} ${row.productionOrder.styleName}`
  return `<button type="button" class="relative h-16 w-14 shrink-0 overflow-hidden rounded border bg-slate-50" data-ppic-return-track-action="preview-image" data-image-url="${escapeHtml(imageUrl)}" data-image-label="${escapeHtml(label)}" aria-label="查看${escapeHtml(row.productionOrder.styleNo)}款式高清图"><img class="h-full w-full object-cover" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(label)}款式实拍图" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span hidden class="absolute inset-0 flex items-center justify-center bg-red-50 px-1 text-center text-[10px] text-red-700">图片加载失败</span></button>`
}

function focusMilestone(row: SewingOutsourcingReturnTrackingRow) {
  return row.returnProjection.milestones.find((milestone) => milestone.status !== 'REACHED')
    || row.returnProjection.milestones.at(-1)!
}

function matchesSituation(row: SewingOutsourcingReturnTrackingRow, situation: ReturnSituation): boolean {
  const focus = focusMilestone(row)
  if (situation === 'DUE_FOLLOW_UP') return focus.status === 'UPCOMING' || focus.status === 'DUE_TODAY'
  if (situation === 'OVERDUE') return row.returnProjection.highestRiskStatus === 'OVERDUE'
  if (situation === 'CUTTING_SHORTFALL') return row.returnProjection.milestones.some((node) => node.cuttingShortfallQty > 0)
  if (situation === 'POST_FINISHING_PENDING') return row.pendingPostFinishingQty > 0
  return row.returnProjection.milestones.every((node) => node.status === 'REACHED')
}

function rows(): SewingOutsourcingReturnTrackingRow[] {
  const keyword = state.keyword.trim().toLowerCase()
  return listSewingOutsourcingReturnTrackingRows()
    .filter((row) => matchesSituation(row, state.situation))
    .filter((row) => !keyword || [
      row.productionOrder.productionOrderNo,
      row.productionOrder.sewingTaskNo,
      row.assignment.runtimeTaskId,
      row.assignment.assignmentId,
      row.assignment.factoryName,
      row.ppicName,
      row.productionOrder.styleNo,
    ].some((value) => value.toLowerCase().includes(keyword)))
}

const columns: StandardListColumn<SewingOutsourcingReturnTrackingRow>[] = [
  { key: 'task', title: '款式／执行任务', width: 290, required: true, freezeable: true, render: (row) => `<div class="flex gap-3">${imageButton(row)}<div><b>${escapeHtml(row.productionOrder.styleNo)}</b><p class="text-xs text-slate-500">${escapeHtml(row.productionOrder.styleName)}</p><p class="mt-1 text-xs">${escapeHtml(row.productionOrder.productionOrderNo)} · ${escapeHtml(row.productionOrder.sewingTaskNo)}</p><p class="font-mono text-[11px] text-slate-500">${escapeHtml(row.assignment.runtimeTaskId)}</p></div></div>` },
  { key: 'factory', title: '工厂／PPIC', width: 210, required: true, render: (row) => `<b>${escapeHtml(row.assignment.factoryName)}</b><p class="mt-1 text-xs font-semibold text-blue-700">PPIC：${escapeHtml(row.ppicName)}</p><p class="mt-1 font-mono text-[11px] text-slate-500">${escapeHtml(row.assignment.assignmentId)}</p>` },
  { key: 'taskType', title: '任务类型／时效', width: 170, render: (row) => `<b>${escapeHtml(POST_FINISHING_SEWING_TASK_TYPE_LABEL[row.taskType])}</b><p class="mt-1 text-xs text-slate-500">${row.returnProjection.snapshot.milestones.map((node) => `${Math.round(node.ratio * 100)}%-第${node.naturalDay}日`).join(' · ')}</p>` },
  { key: 'source', title: '工厂申报／后道确认', width: 200, required: true, render: (row) => `<b>${row.declaredQty} 件 / ${row.confirmedQty} 件</b><p class="mt-1 text-xs ${row.pendingPostFinishingQty ? 'text-amber-800' : 'text-emerald-700'}">${row.pendingPostFinishingQty ? `已申报但后道尚未确认 ${row.pendingPostFinishingQty} 件` : '已申报数均有后道最终确认'}</p><p class="mt-1 text-[11px] text-slate-500">正式数据源：后道最终确认</p>` },
  { key: 'milestone', title: '当前责任节点', width: 270, required: true, render: (row) => { const node = focusMilestone(row); return `<b class="${statusTone(node.status)}">${Math.round(node.ratio * 100)}% · ${escapeHtml(statusLabels[node.status])}</b><p class="mt-1 text-xs">计划${node.targetQty}件 · 工厂承担${node.attributableTargetQty}件</p><p class="mt-1 text-xs text-slate-600">后道按期确认${node.confirmedQtyByDeadline}件 · 工厂待回${node.factoryPendingQty}件 · 裁床待补${node.cuttingShortfallQty}件</p><p class="mt-1 text-[11px] text-slate-500">截止 ${escapeHtml(node.deadlineAt)}</p>` } },
  { key: 'nodes', title: '30%／70%／100%', width: 250, render: (row) => `<div class="space-y-1">${row.returnProjection.milestones.map((node) => `<p class="text-xs"><b class="${statusTone(node.status)}">${Math.round(node.ratio * 100)}% ${escapeHtml(statusLabels[node.status])}</b><span class="ml-2 text-slate-500">${node.confirmedQtyByDeadline}/${node.targetQty}件</span></p>`).join('')}</div>` },
  { key: 'actions', title: '操作', width: 170, required: true, actionColumn: true, render: (row) => `<div class="flex flex-wrap justify-end gap-3"><button class="text-blue-700" data-ppic-return-track-action="detail" data-assignment-id="${escapeHtml(row.assignment.assignmentId)}">查看归责</button>${row.deliveries[0] ? `<a class="font-semibold text-blue-700" data-nav="/fcs/craft/post-finishing/wait-process-warehouse?deliveryId=${encodeURIComponent(row.deliveries[0].deliveryId)}">后道回货源</a>` : ''}</div>` },
]

const preferences: StandardListColumnPreferences = {
  order: columns.filter((column) => !column.actionColumn).map((column) => column.key),
  visibleKeys: columns.map((column) => column.key),
  frozenKeys: ['task'],
  pageSize: 20,
}

function renderDialog(): string {
  if (!state.dialog) return ''
  if (state.dialog.kind === 'IMAGE') {
    return `<div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4" role="dialog" aria-modal="true" aria-label="${escapeHtml(state.dialog.label)}高清大图"><button class="absolute inset-0" data-ppic-return-track-action="close-dialog" aria-label="关闭大图"></button><section class="relative z-10 max-h-[92vh] max-w-5xl overflow-auto rounded-lg bg-white p-3"><header class="mb-3 flex justify-between gap-3"><b>${escapeHtml(state.dialog.label)}</b><button class="rounded border px-3 py-1 text-sm" data-ppic-return-track-action="close-dialog">关闭</button></header><img class="max-h-[78vh] max-w-full object-contain" src="${escapeHtml(state.dialog.imageUrl)}" alt="${escapeHtml(state.dialog.label)}高清图"></section></div>`
  }
  const row = getSewingOutsourcingReturnTrackingRow(state.dialog.assignmentId)
  if (!row) return ''
  return `<div class="fixed inset-0 z-50 overflow-auto bg-slate-950/60 p-4" role="dialog" aria-modal="true" aria-label="回货履约归责详情"><button class="fixed inset-0" data-ppic-return-track-action="close-dialog" aria-label="关闭"></button><section class="relative z-10 mx-auto my-4 w-full max-w-6xl rounded-lg bg-white shadow-xl"><header class="flex items-start justify-between border-b p-5"><div><h2 class="text-lg font-semibold">${escapeHtml(row.productionOrder.sewingTaskNo)} · 回货履约归责</h2><p class="mt-1 text-xs text-slate-500">${escapeHtml(row.productionOrder.productionOrderNo)} · ${escapeHtml(row.assignment.factoryName)} · PPIC ${escapeHtml(row.ppicName)}</p></div><button class="rounded border px-3 py-1 text-sm" data-ppic-return-track-action="close-dialog">关闭</button></header><div class="space-y-4 p-5"><section class="overflow-auto rounded border"><table class="w-full min-w-[980px] text-left text-sm"><thead class="bg-slate-50"><tr><th class="p-3">节点</th><th class="p-3">截止时间</th><th class="p-3 text-right">计划应回</th><th class="p-3 text-right">工厂承担</th><th class="p-3 text-right">后道按期确认</th><th class="p-3 text-right">工厂待回</th><th class="p-3 text-right">裁床待补</th><th class="p-3">结果</th></tr></thead><tbody>${row.returnProjection.milestones.map((node) => `<tr class="border-t"><td class="p-3 font-semibold">${Math.round(node.ratio * 100)}%</td><td class="p-3">${escapeHtml(node.deadlineAt)}</td><td class="p-3 text-right">${node.targetQty}件</td><td class="p-3 text-right">${node.attributableTargetQty}件</td><td class="p-3 text-right">${node.confirmedQtyByDeadline}件</td><td class="p-3 text-right ${node.factoryPendingQty ? 'font-semibold text-red-700' : ''}">${node.factoryPendingQty}件</td><td class="p-3 text-right ${node.cuttingShortfallQty ? 'font-semibold text-amber-800' : ''}">${node.cuttingShortfallQty}件</td><td class="p-3 font-semibold ${statusTone(node.status)}">${escapeHtml(statusLabels[node.status])}</td></tr>`).join('')}</tbody></table></section><div class="grid gap-4 lg:grid-cols-2"><section class="rounded border p-4"><h3 class="font-semibold">裁片回货责任版本</h3><p class="mt-1 text-xs text-slate-500">节点截止后新增的裁片责任不倒改该节点的历史归责。</p><div class="mt-3 space-y-2">${row.responsibilityVersions.map((version) => `<article class="rounded bg-slate-50 p-3 text-xs"><b>${version.totalResponsibilityQty}件</b> · ${escapeHtml(version.createdAt)}<p class="mt-1 text-slate-500">${escapeHtml(version.responsibilityVersionId)} · ${version.sourceKind === 'HANDOVER_CONFIRMED' ? '裁片交出确认' : '人工排除部位'}</p></article>`).join('') || `<p class="rounded bg-slate-50 p-3 text-sm">${row.taskType === 'CUTTING_TO_IRON_PACK' ? '本任务只交出面料、辅料，不计算裁片欠片。' : '尚未形成裁片回货责任。'}</p>`}</div></section><section class="rounded border p-4"><h3 class="font-semibold">后道最终确认版本</h3><div class="mt-3 space-y-2">${row.confirmationVersions.slice().reverse().map((version) => `<article class="rounded p-3 text-xs ${version.status === 'ACTIVE' ? 'bg-emerald-50' : 'bg-slate-50 text-slate-500'}"><b>${version.confirmedQty}件 · ${version.status === 'ACTIVE' ? '当前生效' : '已被订正'}</b><p class="mt-1">${escapeHtml(version.deliveryOrderNo)} · ${escapeHtml(version.confirmedAt)} · ${escapeHtml(version.confirmedBy.actorName)}</p>${version.correctionReason ? `<p class="mt-1">订正原因：${escapeHtml(version.correctionReason)}</p>` : ''}</article>`).join('') || '<p class="rounded bg-amber-50 p-3 text-sm text-amber-800">工厂已申报，但后道尚未最终确认，因此正式回货为 0。</p>'}</div></section></div></div></section></div>`
}

export function renderSewingOutsourcingReturnsPage(): string {
  const filteredRows = rows()
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / state.pageSize))
  state.page = Math.min(Math.max(1, state.page), totalPages)
  const start = (state.page - 1) * state.pageSize
  const pageRows = filteredRows.slice(start, start + state.pageSize)
  const allUnfiltered = listSewingOutsourcingReturnTrackingRows()
  return `<div data-ppic-return-track-page data-skip-page-rerender="true">${renderStandardListPage({
    title: '回货跟进',
    statusTabsHtml: renderUiTabs({
      tabs: (Object.keys(situationLabels) as ReturnSituation[]).map((situation) => ({ key: situation, label: situationLabels[situation], count: allUnfiltered.filter((row) => matchesSituation(row, situation)).length })),
      activeKey: state.situation,
      variant: 'pills',
      prefix: 'ppic-return-track',
      action: 'switch-tab',
      fullWidth: true,
    }),
    filtersHtml: renderStandardListFilters({
      actionPrefix: 'ppic-return-track',
      fieldsHtml: `<input class="h-9 min-w-80 rounded border px-3 text-sm" placeholder="生产单 / 车缝任务 / 工厂 / PPIC" value="${escapeHtml(state.draftKeyword)}" data-ppic-return-track-filter="keyword">`,
    }),
    listTitle: `${situationLabels[state.situation]}的车缝外发任务`,
    listActionsHtml: `<span class="text-xs text-slate-500">原型核查时点：${escapeHtml(SEWING_RETURN_TRACKING_DEMO_NOW)}</span>`,
    tableHtml: renderStandardListTable({ columns, rows: pageRows, preferences: { ...preferences, pageSize: state.pageSize }, sort: null, eventPrefix: 'ppic-return-track', emptyText: '暂无符合条件的回货任务' }),
    paginationHtml: renderTablePagination({ total: filteredRows.length, from: filteredRows.length ? start + 1 : 0, to: Math.min(start + state.pageSize, filteredRows.length), currentPage: state.page, totalPages, pageSize: state.pageSize, actionPrefix: 'ppic-return-track', fieldPrefix: 'ppic-return-track', pageSizeOptions: [20, 50] }),
    overlaysHtml: renderDialog(),
  })}</div>`
}

function refresh(): void {
  const root = document.querySelector<HTMLElement>('[data-ppic-return-track-page]')
  if (root) root.outerHTML = renderSewingOutsourcingReturnsPage()
}

export function isSewingOutsourcingReturnsDialogOpen(): boolean { return state.dialog !== null }

export function closeSewingOutsourcingReturnsDialog(): boolean {
  if (!state.dialog) return false
  state.dialog = null
  refresh()
  return true
}

export function handleSewingOutsourcingReturnsEvent(target: HTMLElement): boolean {
  const filter = target.closest<HTMLInputElement | HTMLSelectElement>('[data-ppic-return-track-filter]')
  if (filter && !state.dialog) {
    if (filter.dataset.ppicReturnTrackFilter === 'keyword') state.draftKeyword = filter.value
    if (filter.dataset.ppicReturnTrackFilter === 'pageSize') {
      state.pageSize = Number(filter.value) || 20
      state.page = 1
      refresh()
    }
    return true
  }
  const node = target.closest<HTMLElement>('[data-ppic-return-track-action]')
  const action = node?.dataset.ppicReturnTrackAction
  if (!node || !action) return false
  if (action === 'close-dialog') return closeSewingOutsourcingReturnsDialog()
  if (action.startsWith('switch-tab:')) {
    state.situation = action.slice('switch-tab:'.length) as ReturnSituation
    state.page = 1
  }
  else if (action === 'query') {
    state.keyword = state.draftKeyword
    state.page = 1
  }
  else if (action === 'reset') {
    state.keyword = ''
    state.draftKeyword = ''
    state.page = 1
  }
  else if (action === 'preview-image') state.dialog = { kind: 'IMAGE', imageUrl: node.dataset.imageUrl || '', label: node.dataset.imageLabel || '款式' }
  else if (action === 'detail') state.dialog = { kind: 'DETAIL', assignmentId: node.dataset.assignmentId || '' }
  else if (action === 'prev-page') state.page = Math.max(1, state.page - 1)
  else if (action === 'next-page') state.page += 1
  else return false
  refresh()
  return true
}
