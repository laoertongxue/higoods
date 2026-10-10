// @page-pattern: list

import { renderStandardListFilters, renderStandardListPage } from '../../components/ui/list-page.ts'
import { renderStandardListTable, type StandardListColumn } from '../../components/ui/list-table.ts'
import type { StandardListColumnPreferences } from '../../components/ui/list-table-model.ts'
import { renderTablePagination } from '../../components/ui/pagination.ts'
import { renderTabs as renderUiTabs } from '../../components/ui/tabs.ts'
import { SEWING_OUTSOURCING_DEMO_CURRENT_PPIC } from '../../data/fcs/factory-onboarding-ppic.ts'
import { buildUnifiedPrintPreviewLink } from '../../data/fcs/print-service.ts'
import { buildDispatchTaskSheetData, ensureDispatchTaskSheetAssignments } from '../../data/fcs/dispatch-task-sheet.ts'
import { formatOperationLocalWallClock } from '../../data/fcs/sewing-delivery-sla.ts'
import {
  getCurrentSewingPickupSlip,
  getSewingPickupAvailability,
  issueSewingPickupSlip,
  type SewingPickupObjectKind,
} from '../../data/fcs/sewing-pickup-slips.ts'
import {
  getSewingOutsourcingWorkbenchRow,
  listSewingOutsourcingWorkbenchRows,
  SEWING_OUTSOURCING_HEALTH_LABEL,
  SEWING_OUTSOURCING_NEXT_PARTY_LABEL,
  type SewingOutsourcingWorkbenchTaskRow,
} from '../../data/fcs/sewing-outsourcing-workbench.ts'
import { escapeHtml } from '../../utils.ts'
import { appStore } from '../../state/store.ts'
import { getEffectiveTaskAssignment } from '../../data/fcs/effective-task-assignments.ts'
import { getCutPieceDispatchReadinessForTask, getCutPieceReleaseSummaryForProductionOrder, getCutPieceReleaseMatrix, withCutPieceReleaseReadSnapshot } from '../../data/fcs/cut-piece-release.ts'
import { getMaterialPrepDispatchReadinessForTask } from '../../data/fcs/cutting/production-material-prep.ts'

type DialogState =
  | { kind: 'DETAIL'; rowId: string }
  | { kind: 'IMAGE'; imageUrl: string; label: string }
  | null

const state = {
  keyword: '',
  draftKeyword: '',
  taskKind: 'ALL',
  page: 1,
  pageSize: 20,
  dialog: null as DialogState,
  feedback: '',
}

type TaskKindTab = 'ALL' | 'INDEPENDENT_SEWING' | 'SEWING_IRON_PACK' | 'CUTTING_SEWING_IRON_PACK'

const taskKindLabels: Record<TaskKindTab, string> = {
  ALL: '全部任务',
  INDEPENDENT_SEWING: '独立车缝',
  SEWING_IRON_PACK: '车缝+烫包',
  CUTTING_SEWING_IRON_PACK: '裁剪+车缝+烫包',
}
let renderTaskRows: SewingOutsourcingWorkbenchTaskRow[] | null = null

function baseRows(): SewingOutsourcingWorkbenchTaskRow[] {
  if (renderTaskRows) return renderTaskRows
  const result = listSewingOutsourcingWorkbenchRows({
    viewerPpicId: SEWING_OUTSOURCING_DEMO_CURRENT_PPIC.ppicId,
    leaderView: false,
  })
  if (renderPreparationSources) renderTaskRows = result
  return result
}

function rows(): SewingOutsourcingWorkbenchTaskRow[] {
  const keyword = state.keyword.trim().toLowerCase()
  return baseRows()
    .filter((row) => state.taskKind === 'ALL' || row.taskKind === state.taskKind)
    .filter((row) => !keyword || [
      row.productionOrderNo,
      row.taskNo,
      row.runtimeTaskId,
      row.assignmentId,
      row.factoryName,
      row.ppicName,
      row.styleCode,
    ].some((value) => value.toLowerCase().includes(keyword)))
}

function imageButton(row: SewingOutsourcingWorkbenchTaskRow): string {
  const label = `${row.styleCode} ${row.styleName}`
  return `<button type="button" class="relative h-16 w-14 shrink-0 overflow-hidden rounded border bg-slate-50" data-pda-image-preview-url="${escapeHtml(row.styleImageUrl)}" data-pda-image-preview-title="${escapeHtml(label)}" aria-label="查看${escapeHtml(row.styleCode)}款式高清图"><img class="h-full w-full object-cover" src="${escapeHtml(row.styleImageUrl)}" alt="${escapeHtml(row.styleImageAlt)}" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span hidden class="absolute inset-0 flex items-center justify-center bg-red-50 px-1 text-center text-[10px] text-red-700">图片加载失败，点击重试</span></button>`
}

function pickupAction(row: SewingOutsourcingWorkbenchTaskRow, kind: SewingPickupObjectKind, label: string): string {
  const availability = getSewingPickupAvailability(row.assignmentId, kind)
  if (!availability.available) {
    return `<span class="text-xs text-slate-400" title="${escapeHtml(availability.reason)}">${escapeHtml(label)}（${escapeHtml(availability.reason)}）</span>`
  }
  const current = getCurrentSewingPickupSlip(row.assignmentId, kind)
  return `<button class="text-xs font-semibold text-blue-700 hover:underline" data-ppic-task-action="print-pickup" data-row-id="${escapeHtml(row.rowId)}" data-pickup-kind="${kind}">${current ? '补打' : '打印'}${escapeHtml(label)}</button>`
}

function pickupActions(row: SewingOutsourcingWorkbenchTaskRow): string {
  if (row.taskKind === 'CUTTING_SEWING_IRON_PACK') {
    return pickupAction(row, 'FABRIC_ACCESSORY', '面辅料领料单')
  }
  return [
    `<button type="button" class="text-xs font-semibold text-blue-700 hover:underline" data-ppic-task-action="print-task-sheet" data-row-id="${escapeHtml(row.rowId)}">打印任务单</button>`,
    pickupAction(row, 'ACCESSORY', '辅料领料单'),
  ].join('')
}

let renderPreparationSources: {
  summaries: Map<string, ReturnType<typeof getCutPieceReleaseSummaryForProductionOrder>>
  matrices: Map<string, ReturnType<typeof getCutPieceReleaseMatrix>>
} | null = null

function readPreparationSummary(productionOrderId: string) {
  if (!renderPreparationSources) return getCutPieceReleaseSummaryForProductionOrder(productionOrderId)
  if (!renderPreparationSources.summaries.has(productionOrderId)) renderPreparationSources.summaries.set(productionOrderId, getCutPieceReleaseSummaryForProductionOrder(productionOrderId))
  return renderPreparationSources.summaries.get(productionOrderId) || null
}

function readPreparationMatrix(productionOrderId: string) {
  if (!renderPreparationSources) return getCutPieceReleaseMatrix(productionOrderId)
  if (!renderPreparationSources.matrices.has(productionOrderId)) renderPreparationSources.matrices.set(productionOrderId, getCutPieceReleaseMatrix(productionOrderId))
  return renderPreparationSources.matrices.get(productionOrderId) || null
}

export function getPpicPreparationFollowUp(row: Pick<SewingOutsourcingWorkbenchTaskRow, 'assignmentId' | 'taskKind' | 'productionOrderId' | 'productionOrderNo' | 'runtimeTaskId' | 'taskNo'>) {
  const assignment = getEffectiveTaskAssignment(row.assignmentId)
  const appliesToCutPieces = row.taskKind !== 'CUTTING_SEWING_IRON_PACK'
  const release = appliesToCutPieces && assignment ? getCutPieceDispatchReadinessForTask({
    productionOrderId: row.productionOrderId, productionOrderNo: row.productionOrderNo,
    skuLines: assignment.skuLines,
  }) : null
  const releaseSummary = appliesToCutPieces ? readPreparationSummary(row.productionOrderId) : null
  const material = getMaterialPrepDispatchReadinessForTask({
    taskId: row.runtimeTaskId || row.assignmentId, taskNo: row.taskNo, productionOrderId: row.productionOrderId,
    processCode: 'SEW', processBusinessCode: 'SEW', processNameZh: '车缝',
  })
  let craftRequiredPieceQty = 0
  let finalReturnedPieceQty = 0
  let pendingFinalReturnPieceQty = 0
  let craftDifferencePieceQty = 0
  let awaitingReturnPieceQty = 0
  let unknownCraftCount = 0
  let craftDataIncomplete = false
  if (appliesToCutPieces && assignment) {
    const matrix = readPreparationMatrix(row.productionOrderId)
    const unknownTickets = new Set<string>()
    craftDataIncomplete = !matrix
    for (const group of matrix?.colorGroups || []) {
      for (const materialRow of group.materialRows) {
        for (const cell of materialRow.cells) {
          if (!assignment.skuLines.some((line) => line.color === group.garmentColor && line.size === cell.size)) continue
          craftRequiredPieceQty += cell.specialCraftRequiredPieceQty
          finalReturnedPieceQty += cell.specialCraftCompletedPieceQty
          pendingFinalReturnPieceQty += cell.specialCraftPendingPieceQty
          awaitingReturnPieceQty += cell.specialCraftAwaitingReturnPieceQty
          craftDifferencePieceQty += cell.specialCraftDifferencePieceQty
          if (cell.availableGarmentQty == null) craftDataIncomplete = true
          for (const part of cell.partCalculations) {
            for (const ticket of part.ticketDetails) {
              if (!ticket.craftRequirementKnown) unknownTickets.add(ticket.ticketId)
            }
          }
        }
      }
    }
    unknownCraftCount = unknownTickets.size
  }
  return { release, releaseSummary, material, craftRequiredPieceQty, finalReturnedPieceQty, pendingFinalReturnPieceQty, awaitingReturnPieceQty, craftDifferencePieceQty, unknownCraftCount, craftDataIncomplete }
}

function renderPreparationFollowUp(row: SewingOutsourcingWorkbenchTaskRow, detailed = false): string {
  const facts = getPpicPreparationFollowUp(row)
  const riskUnknown = Boolean(facts.release && (!facts.release.hasRecord || facts.release.lines.some((line) => line.riskReleaseQty == null)))
  const risk = facts.release?.lines.reduce((sum, line) => sum + (line.riskReleaseQty || 0), 0) || 0
  const number = (qty: number | null) => qty == null ? '待核对' : `${qty.toLocaleString()} 件`
  const materialText = facts.material.lines.length
    ? facts.material.lines.filter((line) => !line.ready).map((line) => `${line.materialName}待配 ${line.remainingPrepQty.toLocaleString()} ${line.unit}`).join('；') || '辅料已配齐'
    : '辅料资料待核对'
  const summary = `<p class="text-xs ${risk > 0 || riskUnknown ? 'font-semibold text-amber-800' : 'text-slate-600'}">${facts.release?.hasRecord ? `放行 V${facts.releaseSummary?.latestReleaseVersion ?? '待核对'} · 本任务当前风险 ${riskUnknown ? '待核对' : `${risk.toLocaleString()} 件`}` : row.taskKind === 'CUTTING_SEWING_IRON_PACK' ? '承接厂自裁，沿用面辅料交接' : '放行资料待核对，原分配保留'}</p>${facts.craftDataIncomplete ? '<p class="mt-1 text-xs text-violet-700">裁片资料待核对，工艺数量待确认</p>' : ''}${facts.craftRequiredPieceQty ? `<p class="mt-1 text-xs text-amber-800">需工艺 ${facts.craftRequiredPieceQty.toLocaleString()} 片 · 最终回仓 ${facts.craftDataIncomplete ? '待核对' : `${facts.finalReturnedPieceQty.toLocaleString()} 片`} · 待最终回仓 ${facts.craftDataIncomplete ? '待核对' : `${facts.pendingFinalReturnPieceQty.toLocaleString()} 片`}${facts.awaitingReturnPieceQty ? `（其中加工完成待回仓 ${facts.awaitingReturnPieceQty.toLocaleString()} 片）` : ''}${facts.craftDifferencePieceQty ? ` · 回仓差异 ${facts.craftDifferencePieceQty.toLocaleString()} 片` : ''}</p>` : ''}${facts.unknownCraftCount ? `<p class="mt-1 text-xs text-violet-700">${facts.unknownCraftCount} 张票工艺要求待核对</p>` : ''}<p class="mt-1 text-xs text-amber-800">${escapeHtml(materialText)}</p>`
  if (!detailed) return `<div class="space-y-1" data-ppic-preparation-follow-up>${summary}</div>`
  const cutRows = facts.release?.lines.map((line) => `<tr class="border-t"><td class="p-2">${escapeHtml(line.color)} / ${escapeHtml(line.size)}</td><td class="p-2 text-right">${number(line.completeKitQty)}</td><td class="p-2 text-right">${number(line.releaseConfirmQty)}</td><td class="p-2 text-right">${number(line.allocatedQty)}</td><td class="p-2 text-right">${number(line.availableQty)}</td><td class="p-2 text-right">${number(line.riskReleaseQty)}</td></tr>`).join('') || ''
  const materialRows = facts.material.lines.map((line) => `<tr class="border-t"><td class="p-2">${escapeHtml(line.materialName)}${line.materialSku && !/^tdv_/i.test(line.materialSku) ? `<p class="text-xs text-slate-500">${escapeHtml(line.materialSku)}</p>` : ''}</td><td class="p-2 text-right">${line.requiredQty.toLocaleString()} ${escapeHtml(line.unit)}</td><td class="p-2 text-right">${line.confirmedPrepQty.toLocaleString()} ${escapeHtml(line.unit)}</td><td class="p-2 text-right">${line.remainingPrepQty.toLocaleString()} ${escapeHtml(line.unit)}</td></tr>`).join('')
  return `<section class="rounded border border-amber-200 bg-amber-50/30 p-4" data-ppic-preparation-follow-up><h3 class="font-semibold">裁片与辅料跟进</h3><div class="mt-3">${summary}</div>${facts.releaseSummary?.riskReason ? `<p class="mt-2 text-xs">放行时风险原因：${escapeHtml(facts.releaseSummary.riskReason)}</p>` : ''}${cutRows ? `<div class="mt-3 overflow-auto"><table class="w-full min-w-[680px] text-left text-xs"><thead class="bg-white"><tr><th class="p-2">成衣颜色 / 尺码</th><th class="p-2 text-right">当前齐套</th><th class="p-2 text-right">有效放行</th><th class="p-2 text-right">生产单已分配</th><th class="p-2 text-right">可新增分配</th><th class="p-2 text-right">当前风险</th></tr></thead><tbody>${cutRows}</tbody></table></div><a class="mt-2 inline-flex text-xs font-semibold text-blue-700" data-nav="/fcs/craft/cutting/cut-piece-release?productionOrderId=${encodeURIComponent(row.productionOrderId)}&amp;productionOrderNo=${encodeURIComponent(row.productionOrderNo)}">查看裁片与工艺详情</a>` : ''}<div class="mt-3 overflow-auto"><table class="w-full min-w-[580px] text-left text-xs"><thead class="bg-white"><tr><th class="p-2">辅料</th><th class="p-2 text-right">需求</th><th class="p-2 text-right">已配</th><th class="p-2 text-right">待配</th></tr></thead><tbody>${materialRows || '<tr><td class="p-3 text-slate-500" colspan="4">暂无辅料配料明细，请核对。</td></tr>'}</tbody></table></div></section>`
}

const columns: StandardListColumn<SewingOutsourcingWorkbenchTaskRow>[] = [
  { key: 'identity', title: '款式／生产单／执行任务', width: 330, required: true, freezeable: true, render: (row) => `<div class="flex gap-3">${imageButton(row)}<div><b>${escapeHtml(row.styleCode)}</b><p class="text-xs text-slate-500">${escapeHtml(row.styleName)}</p><p class="mt-1 text-xs">${escapeHtml(row.productionOrderNo)} · ${escapeHtml(row.taskNo)}</p></div></div>` },
  { key: 'assignment', title: '有效分配／工厂', width: 250, required: true, render: (row) => `<b>${escapeHtml(row.factoryName)}</b><p class="mt-1 text-xs font-semibold text-blue-700">任务PPIC：${escapeHtml(row.ppicName)}</p>` },
  { key: 'kind', title: '任务类型', width: 160, required: true, render: (row) => `<b>${escapeHtml(row.taskKindLabel)}</b>` },
  { key: 'health', title: '健康度／下一责任方', width: 230, required: true, render: (row) => `<b class="${row.health === 'ABNORMAL' ? 'text-red-700' : row.health === 'DATA_INCOMPLETE' ? 'text-violet-700' : row.health === 'ATTENTION' ? 'text-amber-800' : 'text-emerald-700'}">${escapeHtml(SEWING_OUTSOURCING_HEALTH_LABEL[row.health])}</b><p class="mt-1 text-xs">下一责任方：${escapeHtml(SEWING_OUTSOURCING_NEXT_PARTY_LABEL[row.nextResponsibleParty])}</p><p class="mt-1 text-xs text-slate-500">${escapeHtml(row.nextAction)}</p>` },
  { key: 'quantity', title: '任务数量', width: 240, render: (row) => row.quantitySummaries.map((value) => `<p class="text-xs">${escapeHtml(value)}</p>`).join('') || '<span class="text-xs text-slate-500">暂无可用数量</span>' },
  { key: 'preparation', title: '裁片／辅料跟进', width: 320, render: (row) => renderPreparationFollowUp(row) },
  { key: 'actions', title: '操作', width: 390, required: true, actionColumn: true, render: (row) => `<div class="flex flex-wrap justify-end gap-x-3 gap-y-2">${pickupActions(row)}${row.sourceLinks.map((source) => `<a class="text-xs font-semibold text-blue-700 hover:underline" data-nav="${escapeHtml(source.href)}">${escapeHtml(source.label)}</a>`).join('') || '<span class="text-xs text-violet-700">待完成历史关联</span>'}<button class="text-xs font-semibold text-blue-700" data-ppic-task-action="detail" data-row-id="${escapeHtml(row.rowId)}">全链详情</button></div>` },
]

const preferences: StandardListColumnPreferences = {
  order: columns.filter((column) => !column.actionColumn).map((column) => column.key),
  visibleKeys: columns.map((column) => column.key),
  frozenKeys: ['identity'],
  pageSize: 20,
}

function renderDialog(): string {
  if (!state.dialog) return ''
  if (state.dialog.kind === 'IMAGE') return `<div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4" role="dialog" aria-modal="true" aria-label="${escapeHtml(state.dialog.label)}高清大图"><button class="absolute inset-0" data-ppic-task-action="close-dialog" aria-label="关闭大图"></button><section class="relative z-10 max-h-[92vh] max-w-5xl overflow-auto rounded-lg bg-white p-3"><header class="mb-3 flex justify-between gap-3"><b>${escapeHtml(state.dialog.label)}</b><button class="rounded border px-3 py-1 text-sm" data-ppic-task-action="close-dialog">关闭</button></header><img class="max-h-[78vh] max-w-full object-contain" src="${escapeHtml(state.dialog.imageUrl)}" alt="${escapeHtml(state.dialog.label)}高清图"></section></div>`
  const row = getSewingOutsourcingWorkbenchRow(state.dialog.rowId, {
    viewerPpicId: SEWING_OUTSOURCING_DEMO_CURRENT_PPIC.ppicId,
    leaderView: false,
  })
  if (!row) return ''
  return `<div class="fixed inset-0 z-50 overflow-auto bg-slate-950/60 p-4" role="dialog" aria-modal="true" aria-label="车缝任务全链详情"><button class="fixed inset-0" data-ppic-task-action="close-dialog" aria-label="关闭"></button><section class="relative z-10 mx-auto my-4 w-full max-w-5xl rounded-lg bg-white shadow-xl"><header class="flex items-start justify-between border-b p-5"><div><h2 class="text-lg font-semibold">${escapeHtml(row.taskNo)} · 车缝任务全链详情</h2><p class="mt-1 text-xs text-slate-500">${escapeHtml(row.productionOrderNo)} · ${escapeHtml(row.factoryName)} · ${escapeHtml(row.ppicName)}</p></div><button class="rounded border px-3 py-1 text-sm" data-ppic-task-action="close-dialog">关闭</button></header><div class="space-y-4 p-5"><section class="grid gap-3 md:grid-cols-4"><div class="rounded border p-3"><p class="text-xs text-slate-500">任务类型</p><b>${escapeHtml(row.taskKindLabel)}</b></div><div class="rounded border p-3"><p class="text-xs text-slate-500">健康度</p><b>${escapeHtml(SEWING_OUTSOURCING_HEALTH_LABEL[row.health])}</b></div><div class="rounded border p-3"><p class="text-xs text-slate-500">下一责任方</p><b>${escapeHtml(SEWING_OUTSOURCING_NEXT_PARTY_LABEL[row.nextResponsibleParty])}</b></div><div class="rounded border p-3"><p class="text-xs text-slate-500">期限</p><b>${escapeHtml(row.dueAt)}</b></div></section><section class="rounded border p-4"><h3 class="font-semibold">当前动作</h3><p class="mt-2">${escapeHtml(row.nextAction)}</p><p class="mt-1 text-sm text-slate-500">${escapeHtml(row.impactSummary)}</p></section>${renderPreparationFollowUp(row, true)}<section class="rounded border p-4"><h3 class="font-semibold">业务时间线</h3><ol class="mt-3 space-y-3">${row.timeline.map((item) => `<li class="border-l-2 border-slate-200 pl-4"><b>${escapeHtml(item.title)}</b><span class="ml-2 rounded bg-slate-100 px-2 py-0.5 text-[11px]">${escapeHtml(item.source)}</span><p class="mt-1 text-xs text-slate-500">${escapeHtml(item.occurredAt)}</p><p class="mt-1 text-sm">${escapeHtml(item.detail)}</p></li>`).join('')}</ol></section></div></section></div>`
}

function renderSewingOutsourcingTasksContent(): string {
  ensureDispatchTaskSheetAssignments()
  const completeRows = baseRows()
  const allRows = rows()
  const totalPages = Math.max(1, Math.ceil(allRows.length / state.pageSize))
  state.page = Math.min(Math.max(1, state.page), totalPages)
  const start = (state.page - 1) * state.pageSize
  const pageRows = allRows.slice(start, start + state.pageSize)
  return `<div data-ppic-task-page data-skip-page-rerender="true">${renderStandardListPage({
    title: '车缝任务',
    statusTabsHtml: renderUiTabs({
      tabs: (Object.keys(taskKindLabels) as TaskKindTab[]).map((taskKind) => ({
        key: taskKind,
        label: taskKindLabels[taskKind],
        count: taskKind === 'ALL' ? completeRows.length : completeRows.filter((row) => row.taskKind === taskKind).length,
      })),
      activeKey: state.taskKind,
      variant: 'pills',
      prefix: 'ppic-task',
      action: 'switch-tab',
      fullWidth: true,
    }),
    filtersHtml: renderStandardListFilters({
      actionPrefix: 'ppic-task',
      fieldsHtml: `<input class="h-9 min-w-80 rounded border px-3 text-sm" placeholder="生产单 / 执行任务 / 分配 / 工厂" value="${escapeHtml(state.draftKeyword)}" data-ppic-task-field="keyword"><span class="rounded bg-blue-50 px-3 py-2 text-xs text-blue-800">当前登录：${escapeHtml(SEWING_OUTSOURCING_DEMO_CURRENT_PPIC.ppicName)}</span>`,
    }),
    listTitle: '车缝外发执行任务主清单',
    tableHtml: `${state.feedback ? `<div class="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">${escapeHtml(state.feedback)}</div>` : ''}${renderStandardListTable({ columns, rows: pageRows, preferences: { ...preferences, pageSize: state.pageSize }, sort: null, eventPrefix: 'ppic-task', emptyText: '暂无符合条件的车缝执行任务' })}`,
    paginationHtml: renderTablePagination({ total: allRows.length, from: allRows.length ? start + 1 : 0, to: Math.min(start + state.pageSize, allRows.length), currentPage: state.page, totalPages, pageSize: state.pageSize, actionPrefix: 'ppic-task', fieldPrefix: 'ppic-task', pageSizeOptions: [20, 50] }),
    overlaysHtml: renderDialog(),
  })}</div>`
}

export function renderSewingOutsourcingTasksPage(): string {
  renderPreparationSources = { summaries: new Map(), matrices: new Map() }
  renderTaskRows = null
  try { return withCutPieceReleaseReadSnapshot(renderSewingOutsourcingTasksContent) }
  finally { renderPreparationSources = null; renderTaskRows = null }
}

function refresh(): void {
  const root = document.querySelector<HTMLElement>('[data-ppic-task-page]')
  if (root) root.outerHTML = renderSewingOutsourcingTasksPage()
}

export function isSewingOutsourcingTasksDialogOpen(): boolean { return state.dialog !== null }

export function closeSewingOutsourcingTasksDialog(): boolean {
  if (!state.dialog) return false
  state.dialog = null
  refresh()
  return true
}

export function handleSewingOutsourcingTasksEvent(target: HTMLElement): boolean {
  const field = target.closest<HTMLInputElement | HTMLSelectElement>('[data-ppic-task-field]')
  if (field && !state.dialog) {
    const name = field.dataset.ppicTaskField
    if (name === 'keyword') state.draftKeyword = field.value
    else if (name === 'pageSize') {
      state.pageSize = Number(field.value) || 20
      state.page = 1
      refresh()
    }
    else return false
    return true
  }
  const node = target.closest<HTMLElement>('[data-ppic-task-action]')
  const action = node?.dataset.ppicTaskAction
  if (!node || !action) return false
  if (action === 'close-dialog') return closeSewingOutsourcingTasksDialog()
  state.feedback = ''
  if (action.startsWith('switch-tab:')) {
    state.taskKind = action.slice('switch-tab:'.length) as TaskKindTab
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
  else if (action === 'print-task-sheet') {
    const row = getSewingOutsourcingWorkbenchRow(node.dataset.rowId || '', {
      viewerPpicId: SEWING_OUTSOURCING_DEMO_CURRENT_PPIC.ppicId,
      leaderView: false,
    })
    if (!row) return false
    try {
      buildDispatchTaskSheetData(row.assignmentId)
      appStore.navigate(buildUnifiedPrintPreviewLink({ documentType: 'DISPATCH_TASK_SHEET', sourceType: 'EFFECTIVE_TASK_ASSIGNMENT', sourceId: row.assignmentId }))
      return true
    } catch (error) { state.feedback = error instanceof Error ? error.message : '任务单读取失败，请重试。' }
  }
  else if (action === 'print-pickup') {
    const row = getSewingOutsourcingWorkbenchRow(node.dataset.rowId || '', {
      viewerPpicId: SEWING_OUTSOURCING_DEMO_CURRENT_PPIC.ppicId,
      leaderView: false,
    })
    const objectKind = node.dataset.pickupKind as SewingPickupObjectKind
    if (!row || !['ACCESSORY', 'FABRIC_ACCESSORY'].includes(objectKind)) return false
    try {
      const version = issueSewingPickupSlip({
        assignmentId: row.assignmentId,
        objectKind,
        printedAt: formatOperationLocalWallClock(),
        printedByPpicId: SEWING_OUTSOURCING_DEMO_CURRENT_PPIC.ppicId,
        printedByPpicName: SEWING_OUTSOURCING_DEMO_CURRENT_PPIC.ppicName,
      })
      appStore.navigate(buildUnifiedPrintPreviewLink({
        documentType: 'PICKUP_SLIP',
        sourceType: 'PICKUP_SLIP_RECORD',
        sourceId: version.versionId,
      }))
      return true
    } catch (error) {
      state.feedback = error instanceof Error ? error.message : String(error)
    }
  }
  else if (action === 'preview-image') state.dialog = { kind: 'IMAGE', imageUrl: node.dataset.imageUrl || '', label: node.dataset.imageLabel || '款式' }
  else if (action === 'detail') state.dialog = { kind: 'DETAIL', rowId: node.dataset.rowId || '' }
  else if (action === 'prev-page') state.page = Math.max(1, state.page - 1)
  else if (action === 'next-page') state.page += 1
  else return false
  refresh()
  return true
}
