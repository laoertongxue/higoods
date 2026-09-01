// @page-pattern: list

import { renderStandardListPage, renderStandardListStats } from '../../components/ui/list-page.ts'
import { renderStandardListTable, type StandardListColumn } from '../../components/ui/list-table.ts'
import type { StandardListColumnPreferences } from '../../components/ui/list-table-model.ts'
import { renderTablePagination } from '../../components/ui/pagination.ts'
import { formatOperationLocalWallClock } from '../../data/fcs/sewing-delivery-sla.ts'
import {
  ensureSewingOutsourcingSupplementDemo,
  listSewingSupplementTrackingRows,
  recordSewingSupplementFollowUp,
  type SewingSupplementTrackingRow,
} from '../../data/fcs/sewing-outsourcing-supplement-tracking.ts'
import { escapeHtml } from '../../utils.ts'

type DialogState =
  | { kind: 'DETAIL'; assignmentId: string }
  | { kind: 'FOLLOW_UP'; assignmentId: string; error: string }
  | { kind: 'IMAGE'; imageUrl: string; label: string }
  | null

const state = {
  keyword: '',
  availability: 'CUTTING_PROCESSING',
  page: 1,
  pageSize: 20,
  feedback: '',
  dialog: null as DialogState,
  commandSequence: 0,
}

const availabilityLabels: Record<string, string> = {
  NO_SUPPLEMENT_ORDER: '尚无补料单',
  CUTTING_PROCESSING: '裁床补料处理中',
  WAITING_CUTTING_HANDOVER: '补料完成，待裁片交出',
  READY_FOR_FACTORY: '裁片已交齐，可交工厂',
}

const taskKindLabels: Record<string, string> = {
  INDEPENDENT_SEWING: '独立车缝',
  SEWING_IRON_PACK: '车缝+烫包',
  CUTTING_SEWING_IRON_PACK: '裁剪+车缝+烫包',
}

function allRows(): SewingSupplementTrackingRow[] {
  ensureSewingOutsourcingSupplementDemo()
  return listSewingSupplementTrackingRows()
}

function rows(): SewingSupplementTrackingRow[] {
  const keyword = state.keyword.trim().toLowerCase()
  return allRows()
    .filter((item) => item.availability === state.availability)
    .filter((item) => !keyword || [item.productionOrderNo, item.taskNo, item.factoryName, item.ppicName, item.styleCode]
      .some((value) => value.toLowerCase().includes(keyword)))
}

function renderImageButton(row: SewingSupplementTrackingRow): string {
  return `<button type="button" class="relative h-16 w-14 shrink-0 overflow-hidden rounded border bg-slate-50" data-ppic-supplement-action="preview-image" data-image-url="${escapeHtml(row.styleImageUrl)}" data-image-label="${escapeHtml(`${row.styleCode} ${row.styleName}`)}" aria-label="查看${escapeHtml(row.styleCode)}款式高清图"><img class="h-full w-full object-cover" src="${escapeHtml(row.styleImageUrl)}" alt="${escapeHtml(`${row.styleCode} ${row.styleName}`)}款式实拍图" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span hidden class="absolute inset-0 flex items-center justify-center bg-red-50 px-1 text-center text-[10px] text-red-700">图片加载失败</span></button>`
}

const columns: StandardListColumn<SewingSupplementTrackingRow>[] = [
  { key: 'style', title: '款式／任务', width: 260, required: true, render: (row) => `<div class="flex gap-3">${renderImageButton(row)}<div><b>${escapeHtml(row.styleCode)}</b><p class="text-xs text-slate-500">${escapeHtml(row.styleName)}</p><p class="mt-1 text-xs">${escapeHtml(row.productionOrderNo)} · ${escapeHtml(row.taskNo)}</p></div></div>` },
  { key: 'factory', title: '工厂／PPIC', width: 190, required: true, render: (row) => `<b>${escapeHtml(row.factoryName)}</b><p class="mt-1 text-xs font-semibold text-blue-700">PPIC：${escapeHtml(row.ppicName)}</p>` },
  { key: 'taskKind', title: '任务类型', width: 130, render: (row) => escapeHtml(taskKindLabels[row.taskKind] || row.taskKind) },
  { key: 'shortage', title: '当前缺裁片', width: 260, required: true, render: (row) => row.missingLines.length ? `<b class="text-amber-800">欠${row.totalDebtPieceQty.toLocaleString()}片</b><p class="mt-1 text-xs text-slate-600">${escapeHtml(row.missingLines.slice(0, 3).map((line) => `${line.color}/${line.size}/${line.partName} ${line.debtPieceQty}片`).join('；'))}</p>${row.missingLines.length > 3 ? `<p class="text-xs text-slate-500">另${row.missingLines.length - 3}个部位明细</p>` : ''}` : '<b class="text-emerald-700">已无欠片</b>' },
  { key: 'supplement', title: '补料单／状态', width: 220, render: (row) => row.supplementOrders.length ? row.supplementOrders.map((order) => `<p><a class="text-blue-700 hover:underline" data-nav="/fcs/craft/cutting/supplement-management?recordNo=${encodeURIComponent(order.recordNo)}">${escapeHtml(order.recordNo)}</a> · ${escapeHtml(order.status)}</p>`).join('') : '<span class="text-amber-700">尚无补料单</span>' },
  { key: 'availability', title: '是否可交工厂', width: 180, required: true, render: (row) => `<b class="${row.canHandToFactory ? 'text-emerald-700' : 'text-amber-800'}">${escapeHtml(availabilityLabels[row.availability])}</b><p class="mt-1 text-xs text-slate-500">以裁片实际交出责任账为准</p>` },
  { key: 'followUps', title: 'PPIC跟进', width: 150, render: (row) => `<b>${row.followUpLogs.length}次</b><p class="mt-1 text-xs text-slate-500">完整留痕，详情展示最近3次</p>` },
  { key: 'actions', title: '操作', width: 170, required: true, actionColumn: true, render: (row) => `<div class="flex flex-wrap justify-end gap-3"><button class="text-blue-700" data-ppic-supplement-action="detail" data-assignment-id="${escapeHtml(row.assignmentId)}">查看详情</button><button class="font-semibold text-blue-700" data-ppic-supplement-action="follow-up" data-assignment-id="${escapeHtml(row.assignmentId)}">登记跟进</button></div>` },
]

const preferences: StandardListColumnPreferences = {
  order: columns.filter((column) => !column.actionColumn).map((column) => column.key),
  visibleKeys: columns.map((column) => column.key),
  frozenKeys: ['style'],
  pageSize: 20,
}

function activeRow(): SewingSupplementTrackingRow | null {
  if (!state.dialog || state.dialog.kind === 'IMAGE') return null
  return listSewingSupplementTrackingRows().find((item) => item.assignmentId === state.dialog?.assignmentId) || null
}

function renderDialog(): string {
  if (!state.dialog) return ''
  if (state.dialog.kind === 'IMAGE') {
    return `<div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4" role="dialog" aria-modal="true" aria-label="${escapeHtml(state.dialog.label)}高清大图"><button class="absolute inset-0" data-ppic-supplement-action="close-dialog" aria-label="关闭大图"></button><section class="relative z-10 max-h-[92vh] max-w-5xl overflow-auto rounded-lg bg-white p-3"><header class="mb-3 flex justify-between gap-3"><b>${escapeHtml(state.dialog.label)}</b><button class="rounded border px-3 py-1 text-sm" data-ppic-supplement-action="close-dialog">关闭</button></header><img class="max-h-[78vh] max-w-full object-contain" src="${escapeHtml(state.dialog.imageUrl)}" alt="${escapeHtml(state.dialog.label)}高清图"></section></div>`
  }
  const row = activeRow()
  if (!row) return ''
  if (state.dialog.kind === 'FOLLOW_UP') {
    return `<div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-label="登记补料跟进"><button class="absolute inset-0" data-ppic-supplement-action="close-dialog" aria-label="关闭"></button><section class="relative z-10 w-full max-w-xl rounded-lg bg-white shadow-xl"><header class="border-b p-5"><h2 class="text-lg font-semibold">登记补料跟进</h2><p class="mt-1 text-xs text-slate-500">${escapeHtml(row.taskNo)} · PPIC只写协同日志，不修改补料单状态。</p></header><div class="space-y-4 p-5">${state.dialog.error ? `<div class="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">${escapeHtml(state.dialog.error)}</div>` : ''}<label class="block text-sm">本次跟进结果<textarea class="mt-1 min-h-24 w-full rounded border p-3" data-ppic-supplement-field="result" placeholder="例如：裁床已确认补料单当前节点"></textarea></label><label class="block text-sm">下一步动作<textarea class="mt-1 min-h-20 w-full rounded border p-3" data-ppic-supplement-field="nextAction" placeholder="例如：明日上午确认裁片实际交出"></textarea></label><label class="block text-sm">裁床承诺时间（可选）<input type="datetime-local" class="mt-1 h-10 w-full rounded border px-3" data-ppic-supplement-field="promisedAt"></label></div><footer class="flex justify-end gap-2 border-t p-4"><button class="rounded border px-4 py-2 text-sm" data-ppic-supplement-action="close-dialog">取消</button><button class="rounded bg-blue-600 px-4 py-2 text-sm text-white" data-ppic-supplement-action="submit-follow-up" data-assignment-id="${escapeHtml(row.assignmentId)}">保存跟进</button></footer></section></div>`
  }
  const recent = row.followUpLogs.slice(0, 3)
  return `<div class="fixed inset-0 z-50 overflow-auto bg-slate-950/60 p-4" role="dialog" aria-modal="true" aria-label="补料跟进详情"><button class="fixed inset-0" data-ppic-supplement-action="close-dialog" aria-label="关闭"></button><section class="relative z-10 mx-auto my-4 w-full max-w-5xl rounded-lg bg-white shadow-xl"><header class="flex items-start justify-between border-b p-5"><div><h2 class="text-lg font-semibold">${escapeHtml(row.taskNo)} · 补料跟进</h2><p class="mt-1 text-xs text-slate-500">${escapeHtml(row.productionOrderNo)} · ${escapeHtml(row.factoryName)} · PPIC ${escapeHtml(row.ppicName)}</p></div><button class="rounded border px-3 py-1 text-sm" data-ppic-supplement-action="close-dialog">关闭</button></header><div class="grid gap-4 p-5 lg:grid-cols-2"><section class="rounded border p-4"><h3 class="font-semibold">缺裁片部位与数量</h3><div class="mt-3 space-y-2">${row.missingLines.map((line) => `<div class="rounded bg-slate-50 p-3 text-sm"><b>${escapeHtml(`${line.color}/${line.size}/${line.partName}`)}</b><span class="ml-2 text-amber-800">欠${line.debtPieceQty}片</span><p class="mt-1 text-xs text-slate-500">应交${line.requiredPieceQty}片 · 已交${line.handedOverPieceQty}片 · ${line.shortageShape === 'ENTIRE_PART_MISSING' ? '整部位缺失' : '部分缺失'}</p></div>`).join('') || '<p class="text-sm text-emerald-700">当前已无欠片。</p>'}</div></section><section class="rounded border p-4"><h3 class="font-semibold">裁床补料单（只读）</h3><div class="mt-3 space-y-2">${row.supplementOrders.map((order) => `<div class="rounded bg-slate-50 p-3 text-sm"><a class="font-semibold text-blue-700" data-nav="/fcs/craft/cutting/supplement-management?recordNo=${encodeURIComponent(order.recordNo)}">${escapeHtml(order.recordNo)}</a><span class="ml-2">${escapeHtml(order.status)}</span><p class="mt-1 text-xs text-slate-500">${escapeHtml(order.reasonDetail)}</p></div>`).join('') || '<p class="rounded border border-dashed p-4 text-sm text-amber-800">裁床尚未创建补料单；PPIC只能跟进，不能代建。</p>'}<p class="mt-3 rounded bg-blue-50 p-3 text-sm text-blue-800"><b>是否可交工厂：</b>${escapeHtml(availabilityLabels[row.availability])}。补料完成不等于裁片已经交出，必须以裁片实际交出责任账为准。</p></div></section></div><section class="border-t p-5"><div class="flex items-center justify-between"><div><h3 class="font-semibold">PPIC协同日志</h3><p class="mt-1 text-xs text-slate-500">共${row.followUpLogs.length}次，保留全部；当前重点展示最近3次。</p></div><button class="rounded bg-blue-600 px-4 py-2 text-sm text-white" data-ppic-supplement-action="follow-up" data-assignment-id="${escapeHtml(row.assignmentId)}">继续登记</button></div><div class="mt-3 grid gap-3 md:grid-cols-3">${recent.map((log) => `<article class="rounded border p-3 text-sm"><b>${escapeHtml(log.followedAt)}</b><p class="mt-2">${escapeHtml(log.result)}</p><p class="mt-2 text-xs text-slate-500">下一步：${escapeHtml(log.nextAction)}</p><p class="mt-1 text-xs text-slate-500">${escapeHtml(log.followedByPpicName)}${log.promisedAt ? ` · 承诺${escapeHtml(log.promisedAt)}` : ''}</p></article>`).join('')}</div></section></section></div>`
}

export function renderSewingOutsourcingSupplementsPage(): string {
  const completeRows = allRows()
  const filteredRows = rows()
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / state.pageSize))
  state.page = Math.min(Math.max(1, state.page), totalPages)
  const start = (state.page - 1) * state.pageSize
  const pageRows = filteredRows.slice(start, start + state.pageSize)
  return `<div data-ppic-supplement-page data-skip-page-rerender="true">${renderStandardListPage({
    title: '补料跟进',
    feedbackHtml: state.feedback ? `<div class="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">${escapeHtml(state.feedback)}</div>` : '',
    filtersHtml: `<div class="space-y-3 rounded-lg border bg-white p-3"><div class="flex flex-wrap gap-2" role="tablist" aria-label="补料状态">${Object.entries(availabilityLabels).map(([value, label]) => `<button type="button" class="rounded px-4 py-2 text-sm font-semibold ${state.availability === value ? 'bg-blue-600 text-white' : 'border text-slate-600'}" data-ppic-supplement-action="switch-availability" data-availability="${value}">${escapeHtml(label)} <span class="ml-1">${completeRows.filter((item) => item.availability === value).length}</span></button>`).join('')}</div><input class="h-9 min-w-80 rounded border px-3 text-sm" placeholder="生产单 / 车缝任务 / 工厂 / PPIC" value="${escapeHtml(state.keyword)}" data-ppic-supplement-field="keyword"></div>`,
    statsHtml: renderStandardListStats([
      { label: '当前任务', value: completeRows.length },
      { label: '有裁片欠片', value: completeRows.filter((item) => item.totalDebtPieceQty > 0).length },
      { label: '裁床补料处理中', value: completeRows.filter((item) => item.availability === 'CUTTING_PROCESSING').length },
      { label: '可交车缝工厂', value: completeRows.filter((item) => item.canHandToFactory).length },
    ]),
    listTitle: `${availabilityLabels[state.availability]}的车缝任务`,
    tableHtml: renderStandardListTable({ columns, rows: pageRows, preferences: { ...preferences, pageSize: state.pageSize }, sort: null, eventPrefix: 'ppic-supplement', emptyText: '暂无符合条件的补料跟进任务' }),
    paginationHtml: renderTablePagination({ total: filteredRows.length, from: filteredRows.length ? start + 1 : 0, to: Math.min(start + state.pageSize, filteredRows.length), currentPage: state.page, totalPages, pageSize: state.pageSize, actionPrefix: 'ppic-supplement', fieldPrefix: 'ppic-supplement', pageSizeOptions: [20, 50] }),
    overlaysHtml: renderDialog(),
  })}</div>`
}

function refresh(): void {
  const root = document.querySelector<HTMLElement>('[data-ppic-supplement-page]')
  if (root) root.outerHTML = renderSewingOutsourcingSupplementsPage()
}

export function isSewingOutsourcingSupplementsDialogOpen(): boolean {
  return state.dialog !== null
}

export function closeSewingOutsourcingSupplementsDialog(): boolean {
  if (!state.dialog) return false
  state.dialog = null
  refresh()
  return true
}

export function handleSewingOutsourcingSupplementsEvent(target: HTMLElement): boolean {
  const field = target.closest<HTMLInputElement | HTMLSelectElement>('[data-ppic-supplement-field]')
  if (field && !state.dialog) {
    if (field.dataset.ppicSupplementField === 'keyword') state.keyword = field.value
    if (field.dataset.ppicSupplementField === 'availability') state.availability = field.value
    if (field.dataset.ppicSupplementField === 'pageSize') state.pageSize = Number(field.value) || 20
    state.page = 1
    refresh()
    return true
  }
  const actionNode = target.closest<HTMLElement>('[data-ppic-supplement-action]')
  const action = actionNode?.dataset.ppicSupplementAction
  if (!actionNode || !action) return false
  if (action === 'close-dialog') return closeSewingOutsourcingSupplementsDialog()
  if (action === 'switch-availability') {
    state.availability = actionNode.dataset.availability || 'CUTTING_PROCESSING'
    state.page = 1
  } else if (action === 'preview-image') {
    state.dialog = { kind: 'IMAGE', imageUrl: actionNode.dataset.imageUrl || '', label: actionNode.dataset.imageLabel || '款式' }
  } else if (action === 'detail') {
    state.dialog = { kind: 'DETAIL', assignmentId: actionNode.dataset.assignmentId || '' }
  } else if (action === 'follow-up') {
    state.dialog = { kind: 'FOLLOW_UP', assignmentId: actionNode.dataset.assignmentId || '', error: '' }
  } else if (action === 'submit-follow-up' && state.dialog?.kind === 'FOLLOW_UP') {
    const assignmentId = state.dialog.assignmentId
    const row = listSewingSupplementTrackingRows().find((item) => item.assignmentId === assignmentId)
    const value = (name: string) => document.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[data-ppic-supplement-field="${name}"]`)?.value.trim() || ''
    try {
      state.commandSequence += 1
      recordSewingSupplementFollowUp({
        commandId: `CMD-PPIC-SUP-FOLLOW-UI-${Date.now()}-${state.commandSequence}`,
        assignmentId,
        ppicId: row?.ppicId || '',
        result: value('result'),
        nextAction: value('nextAction'),
        promisedAt: value('promisedAt').replace('T', ' '),
        followedAt: formatOperationLocalWallClock(),
      })
      state.feedback = '跟进日志已保存；补料单状态仍由裁床维护。'
      state.dialog = null
    } catch (error) {
      state.dialog = { ...state.dialog, error: error instanceof Error ? error.message : '保存失败' }
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
