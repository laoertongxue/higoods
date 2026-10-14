import { formatSewingBusinessWallClock } from '../../data/fcs/sewing-return-calendar.ts'
import { ppicInstant } from '../../data/fcs/ppic-daily-return.ts'
import { getCurrentPpicDailyActor, getPpicTaskPromiseHistory, PPIC_DAILY_DEMO_MEMBERS } from '../../data/fcs/ppic-daily-return-records.ts'
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
  if (!focus) return situation === 'DUE_FOLLOW_UP' || (situation === 'POST_FINISHING_PENDING' && row.pendingPostFinishingQty > 0)
  if (situation === 'DUE_FOLLOW_UP') return focus.status === 'UPCOMING' || focus.status === 'DUE_TODAY'
  if (situation === 'OVERDUE') return row.returnProjection.highestRiskStatus === 'OVERDUE'
  if (situation === 'CUTTING_SHORTFALL') return row.returnProjection.milestones.some((node) => node.cuttingShortfallQty > 0)
  if (situation === 'POST_FINISHING_PENDING') return row.pendingPostFinishingQty > 0
  return !row.returnProjection.quantityBasisPending && row.quantityBasis.status === 'READY' && row.returnProjection.milestones.length === 2 && row.returnProjection.milestones.every((node) => node.status === 'REACHED')
}

function rows(): SewingOutsourcingReturnTrackingRow[] {
  const keyword = state.keyword.trim().toLowerCase()
  const actor = getCurrentPpicDailyActor()
  return listSewingOutsourcingReturnTrackingRows()
    .filter(row => actor.leader || row.ppicId === actor.id)
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
  { key: 'milestone', title: '当前责任节点', width: 270, required: true, render: (row) => { const node = focusMilestone(row); if (row.returnProjection.quantityBasisPending) return '<span class="text-amber-800">节点历史应回依据待核对</span>'; if (!node) return `<span class="text-amber-800">${escapeHtml(row.quantityBasis.status !== 'READY' ? row.quantityBasis.message : row.timingMessage)}</span>`; return `<b class="${statusTone(node.status)}">${Math.round(node.ratio * 100)}% · ${escapeHtml(statusLabels[node.status])}</b><p class="mt-1 text-xs">计划${node.targetQty}件 · 工厂承担${node.attributableTargetQty}件</p><p class="mt-1 text-xs text-slate-600">后道按期确认${node.confirmedQtyByDeadline}件 · 工厂待回${node.factoryPendingQty}件 · 裁床待补${node.cuttingShortfallQty}件</p><p class="mt-1 text-[11px] text-slate-500">截止 ${escapeHtml(node.deadlineAt)}</p>` } },
  { key: 'nodes', title: '35%／100%', width: 250, render: (row) => `<div class="space-y-1">${row.returnProjection.missingMilestones.map(node => `<p class="text-xs text-amber-800">${Math.round(node.ratio * 100)}% · 截止 ${escapeHtml(node.deadlineAt)} · 应回依据待核对</p>`).join('')}${row.returnProjection.milestones.map((node) => `<p class="text-xs"><b class="${statusTone(node.status)}">${Math.round(node.ratio * 100)}% ${escapeHtml(statusLabels[node.status])}</b><span class="ml-2 text-slate-500">${node.confirmedQtyByDeadline}/${node.targetQty}件</span></p>`).join('')}</div>` },
  { key: 'actions', title: '操作', width: 170, required: true, actionColumn: true, render: (row) => `<div class="flex flex-wrap justify-end gap-3"><button class="text-blue-700" data-ppic-return-track-action="detail" data-assignment-id="${escapeHtml(row.assignment.assignmentId)}">查看归责</button>${row.deliveries[0] ? `<a class="font-semibold text-blue-700" data-nav="/fcs/craft/post-finishing/wait-process-warehouse?deliveryId=${encodeURIComponent(row.deliveries[0].deliveryId)}">后道回货源</a>` : ''}</div>` },
]

const preferences: StandardListColumnPreferences = {
  order: columns.filter((column) => !column.actionColumn).map((column) => column.key),
  visibleKeys: columns.map((column) => column.key),
  frozenKeys: ['task'],
  pageSize: 20,
}

function displayTime(value: string): string { return value ? formatSewingBusinessWallClock(new Date(ppicInstant(value))) : '—' }

function renderPpicReturnHistory(row: SewingOutsourcingReturnTrackingRow): string {
  const basis = row.quantityBasis
  const history = getPpicTaskPromiseHistory(row.assignment.assignmentId)
  const actorName = (id: string) => PPIC_DAILY_DEMO_MEMBERS.find(p => p.id === id)?.name || '历史操作人'
  const promiseNo = (id: string) => history.promises.find(p => p.promiseId === id)?.promiseNo || '历史承诺'
  const sourceNames = { ASSIGNMENT: '任务分配', REQUIREMENTS: '裁片部位依据', SIMPLE_HANDOVER: '简易裁片交出', TRANSFER_BAG_HANDOVER: '中转袋交出', LEGACY_HANDOVER: '历史裁片交出', CUT_PIECE_RELEASE: '裁片放行' }
  const sources = basis.sourceRefs.map((ref, i) => {
    const href = ref.kind === 'CUT_PIECE_RELEASE' ? '/fcs/craft/cutting/cut-piece-release?productionOrderId=' + encodeURIComponent(basis.productionOrderId)
      : ref.kind === 'ASSIGNMENT' ? '/fcs/dispatch/workbench'
      : ref.kind === 'REQUIREMENTS' ? '/fcs/production-orders/' + encodeURIComponent(basis.productionOrderId)
      : '/fcs/craft/cutting/warehouse-management/wait-handover'
    return `<p class="mt-1 text-xs"><a class="text-blue-700" data-nav="${escapeHtml(href)}">${sourceNames[ref.kind]} ${i + 1}</a> · ${escapeHtml(displayTime(ref.occurredAt))}${ref.kind === 'CUT_PIECE_RELEASE' ? ' · 版本 ' + escapeHtml(ref.version) : ''}</p>`
  }).join('')
  const allocations = history.allocations.map(a => {
    const receipt = row.confirmationVersions.find(v => v.confirmationVersionId === a.receiptId)
    const makeup = history.promises.flatMap(p => p.result.makeups).find(m => m.makeupId === a.makeupId)
    return `<article class="rounded border p-2 text-xs ${a.active ? '' : 'text-slate-500'}"><b>${escapeHtml(promiseNo(a.promiseId))} · ${a.quantity} 件</b> · ${makeup ? '第 ' + makeup.round + ' 轮补回' : '原承诺实收'} · ${a.active ? '当前分摊' : '历史分摊'}<p class="mt-1">${receipt ? `<a class="text-blue-700" data-nav="/fcs/craft/post-finishing/wait-process-warehouse?deliveryId=${encodeURIComponent(receipt.deliveryId)}">${escapeHtml(receipt.deliveryOrderNo)}</a>` : '历史确认来源待核对'} · 实际确认 ${escapeHtml(displayTime(a.confirmedAt))}${receipt ? ' · 录入 ' + escapeHtml(displayTime(receipt.versionCreatedAt)) : ''}</p></article>`
  }).join('')
  return `<section class="rounded border p-3"><h3 class="font-semibold">应回依据与每日承诺</h3><p class="mt-2 text-sm">应回 ${basis.expectedQty === null ? '待核对' : basis.expectedQty + ' 件'} · ${escapeHtml(basis.message)} · 已确认 ${row.confirmedQty} 件</p>${sources}${basis.missingParts.filter(p => p.missingPieceQty > 0).map(p => `<p class="text-xs text-amber-800">${escapeHtml(p.color)} ${escapeHtml(p.size)} ${escapeHtml(p.partName)} 缺${p.missingPieceQty}片</p>`).join('')}<div class="mt-3 space-y-2">${history.promises.map(p => `<article class="rounded bg-slate-50 p-3 text-sm"><b>${escapeHtml(p.promiseNo)}</b> · ${p.quantity} 件 · ${escapeHtml(p.result.status)}<p class="text-xs">原截止 ${escapeHtml(displayTime(p.originalDeadlineAt))} · ${p.result.due ? '原到期欠回 ' + p.result.originalGap + ' 件 · 当前欠回' : '未到期 · 待回'} ${p.result.currentGap} 件</p>${p.result.makeups.map(m => `<p class="text-xs">第${m.round}轮补回 ${m.quantity}件 · ${escapeHtml(displayTime(m.deadlineAt))} · ${escapeHtml(m.reason)} · ${m.active ? m.currentGap ? '当前安排' : m.releasedQty ? '原欠回已解除' : '已补齐' : '历史安排'}</p>`).join('')}</article>`).join('') || '<p class="text-sm text-slate-500">尚无每日承诺</p>'}</div><details class="mt-3 rounded border p-3"><summary class="cursor-pointer text-sm font-semibold">实收分摊与变更追溯</summary><h4 class="mt-3 text-sm font-semibold">正式实收分摊</h4><div class="mt-2 space-y-2">${allocations || '<p class="text-xs">尚未形成实收分摊</p>'}</div><h4 class="mt-3 text-sm font-semibold">原承诺评估历史</h4>${history.evaluations.map(e => `<p class="mt-1 text-xs">${escapeHtml(promiseNo(e.promiseId))} · ${escapeHtml(displayTime(e.recordedAt))} · 实收 ${e.receivedQty} 件 · 准时 ${e.timelyQty} 件</p>`).join('') || '<p class="mt-1 text-xs">尚无评估记录</p>'}<h4 class="mt-3 text-sm font-semibold">操作记录</h4>${history.actions.map(a => `<p class="mt-1 text-xs">${escapeHtml(displayTime(a.at))} · ${escapeHtml(actorName(a.actorId))} · ${escapeHtml(a.action)}${a.promiseId ? ' · ' + escapeHtml(promiseNo(a.promiseId)) : ''}${a.reason ? ' · ' + escapeHtml(a.reason) : ''}</p>`).join('') || '<p class="mt-1 text-xs">尚无操作记录</p>'}<h4 class="mt-3 text-sm font-semibold">承诺采用的应回依据</h4>${history.bases.map((b, i) => `<p class="mt-1 text-xs">依据 ${i + 1} · 应回 ${b.expectedQty} 件 · 采用时间 ${escapeHtml(displayTime(b.effectiveAt))} · ${history.promises.filter(p => p.basisVersion === b.version).map(p => escapeHtml(p.promiseNo)).join('、')}</p>`).join('') || '<p class="mt-1 text-xs">尚无承诺依据快照</p>'}</details><a class="mt-3 inline-block text-blue-700" data-nav="/fcs/sewing-outsourcing/daily-return-report">填写每日回货</a></section>`
}

function renderDialog(): string {
  if (!state.dialog) return ''
  if (state.dialog.kind === 'IMAGE') {
    return `<div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4" role="dialog" aria-modal="true" aria-label="${escapeHtml(state.dialog.label)}高清大图"><button class="absolute inset-0" data-ppic-return-track-action="close-dialog" aria-label="关闭大图"></button><section class="relative z-10 max-h-[92vh] max-w-5xl overflow-auto rounded-lg bg-white p-3"><header class="mb-3 flex justify-between gap-3"><b>${escapeHtml(state.dialog.label)}</b><button class="rounded border px-3 py-1 text-sm" data-ppic-return-track-action="close-dialog">关闭</button></header><img class="max-h-[78vh] max-w-full object-contain" src="${escapeHtml(state.dialog.imageUrl)}" alt="${escapeHtml(state.dialog.label)}高清图"></section></div>`
  }
  const row = getSewingOutsourcingReturnTrackingRow(state.dialog.assignmentId)
  if (!row) return ''
  const actor = getCurrentPpicDailyActor()
  if (!actor.leader && row.ppicId !== actor.id) return ''
  return `<div class="fixed inset-0 z-50 overflow-auto bg-slate-950/60 p-4" role="dialog" aria-modal="true" aria-label="回货履约归责详情"><button class="fixed inset-0" data-ppic-return-track-action="close-dialog" aria-label="关闭"></button><section class="relative z-10 mx-auto my-4 w-full max-w-6xl rounded-lg bg-white shadow-xl"><header class="flex items-start justify-between border-b p-5"><div><h2 class="text-lg font-semibold">${escapeHtml(row.productionOrder.sewingTaskNo)} · 回货履约归责</h2><p class="mt-1 text-xs text-slate-500">${escapeHtml(row.productionOrder.productionOrderNo)} · ${escapeHtml(row.assignment.factoryName)} · PPIC ${escapeHtml(row.ppicName)}</p></div><button class="rounded border px-3 py-1 text-sm" data-ppic-return-track-action="close-dialog">关闭</button></header><div class="space-y-4 p-5">${renderPpicReturnHistory(row)}${row.returnProjection.missingMilestones.map(node => `<p class="rounded bg-amber-50 p-3 text-sm text-amber-800">${Math.round(node.ratio * 100)}% 节点（${escapeHtml(node.deadlineAt)}）历史应回依据待核对，不能判定达标。</p>`).join('')}<p class="rounded bg-slate-50 p-3 text-sm ${row.timingStatus === 'CONFIRMED' ? 'text-slate-700' : 'text-amber-800'}">${escapeHtml(row.timingMessage)}${row.timingStatus === 'CONFIRMED' ? ` · 分配 ${escapeHtml(row.businessAssignedAt)}` : ''} · 接单 ${escapeHtml(row.acceptedAt || '待核实')}</p><section class="overflow-auto rounded border"><table class="w-full min-w-[980px] text-left text-sm"><thead class="bg-slate-50"><tr><th class="p-3">节点</th><th class="p-3">截止时间</th><th class="p-3 text-right">计划应回</th><th class="p-3 text-right">工厂承担</th><th class="p-3 text-right">后道按期确认</th><th class="p-3 text-right">工厂待回</th><th class="p-3 text-right">裁床待补</th><th class="p-3">结果</th></tr></thead><tbody>${row.returnProjection.milestones.map((node) => `<tr class="border-t"><td class="p-3 font-semibold">${Math.round(node.ratio * 100)}%</td><td class="p-3">${escapeHtml(node.deadlineAt)}</td><td class="p-3 text-right">${node.targetQty}件</td><td class="p-3 text-right">${node.attributableTargetQty}件</td><td class="p-3 text-right">${node.confirmedQtyByDeadline}件</td><td class="p-3 text-right ${node.factoryPendingQty ? 'font-semibold text-red-700' : ''}">${node.factoryPendingQty}件</td><td class="p-3 text-right ${node.cuttingShortfallQty ? 'font-semibold text-amber-800' : ''}">${node.cuttingShortfallQty}件</td><td class="p-3 font-semibold ${statusTone(node.status)}">${escapeHtml(statusLabels[node.status])}</td></tr>`).join('')}</tbody></table></section><div class="grid gap-4 lg:grid-cols-2"><section class="rounded border p-4"><h3 class="font-semibold">裁片回货责任版本</h3><p class="mt-1 text-xs text-slate-500">节点截止后新增的裁片责任不倒改该节点的历史归责。</p><div class="mt-3 space-y-2">${row.responsibilityVersions.map((version) => `<article class="rounded bg-slate-50 p-3 text-xs"><b>${version.totalResponsibilityQty}件</b> · ${escapeHtml(version.createdAt)}<p class="mt-1 text-slate-500">${escapeHtml(version.responsibilityVersionId)} · ${version.sourceKind === 'HANDOVER_CONFIRMED' ? '裁片交出确认' : '历史参考标记（不计归责）'}</p></article>`).join('') || `<p class="rounded bg-slate-50 p-3 text-sm">${row.taskType === 'CUTTING_TO_IRON_PACK' ? '本任务只交出面料、辅料，不计算裁片欠片。' : '尚未形成裁片回货责任。'}</p>`}</div></section><section class="rounded border p-4"><h3 class="font-semibold">后道最终确认版本</h3><div class="mt-3 space-y-2">${row.confirmationVersions.slice().reverse().map((version) => `<article class="rounded p-3 text-xs ${version.status === 'ACTIVE' ? 'bg-emerald-50' : 'bg-slate-50 text-slate-500'}"><b>${version.confirmedQty}件 · ${version.status === 'ACTIVE' ? '当前生效' : '已被订正'}</b><p class="mt-1">${escapeHtml(version.deliveryOrderNo)} · ${escapeHtml(displayTime(version.confirmedAt))} · 录入 ${escapeHtml(displayTime(version.versionCreatedAt))} · ${escapeHtml(version.confirmedBy.actorName)}</p>${version.correctionReason ? `<p class="mt-1">订正原因：${escapeHtml(version.correctionReason)}</p>` : ''}</article>`).join('') || '<p class="rounded bg-amber-50 p-3 text-sm text-amber-800">工厂已申报，但后道尚未最终确认，因此正式回货为 0。</p>'}</div></section></div></div></section></div>`
}

export function renderSewingOutsourcingReturnsPage(): string {
  const filteredRows = rows()
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / state.pageSize))
  state.page = Math.min(Math.max(1, state.page), totalPages)
  const start = (state.page - 1) * state.pageSize
  const pageRows = filteredRows.slice(start, start + state.pageSize)
  const actor = getCurrentPpicDailyActor()
  const allUnfiltered = listSewingOutsourcingReturnTrackingRows().filter(row => actor.leader || row.ppicId === actor.id)
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
