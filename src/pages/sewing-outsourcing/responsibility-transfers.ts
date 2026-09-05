// @page-pattern: list

import { renderStandardListFilters, renderStandardListPage } from '../../components/ui/list-page.ts'
import { renderStandardListTable, type StandardListColumn } from '../../components/ui/list-table.ts'
import type { StandardListColumnPreferences } from '../../components/ui/list-table-model.ts'
import { renderTablePagination } from '../../components/ui/pagination.ts'
import { renderTabs as renderUiTabs } from '../../components/ui/tabs.ts'
import {
  getAvailableOnboardingPpicOptions,
  PPIC_TEAM_LEADER_JIEGE,
  PPIC_TEAM_LEADER_LINGYUN,
} from '../../data/fcs/factory-onboarding-ppic.ts'
import { getRuntimeTaskById } from '../../data/fcs/runtime-process-tasks.ts'
import { formatOperationLocalWallClock } from '../../data/fcs/sewing-delivery-sla.ts'
import {
  getCurrentSewingTaskResponsibility,
  listSewingTaskResponsibilityVersions,
  transferSewingTaskResponsibility,
  type SewingTaskResponsibilityVersion,
} from '../../data/fcs/sewing-outsourcing-responsibility.ts'
import {
  getSewingOutsourcingWorkbenchRow,
  listSewingOutsourcingWorkbenchRows,
  type SewingOutsourcingWorkbenchTaskRow,
} from '../../data/fcs/sewing-outsourcing-workbench.ts'
import { escapeHtml } from '../../utils.ts'

type DialogState =
  | { kind: 'TRANSFER'; rowId: string; error: string }
  | { kind: 'HISTORY'; rowId: string }
  | { kind: 'IMAGE'; imageUrl: string; label: string }
  | null

const state = {
  managerPpicId: PPIC_TEAM_LEADER_LINGYUN.ppicId,
  keyword: '',
  draftKeyword: '',
  historyTab: 'ALL' as TransferHistoryTab,
  page: 1,
  pageSize: 20,
  feedback: '',
  commandSequence: 0,
  dialog: null as DialogState,
}

type TransferHistoryTab = 'ALL' | 'HAS_HISTORY' | 'NO_HISTORY'

const transferHistoryTabLabels: Record<TransferHistoryTab, string> = {
  ALL: '全部未完任务',
  HAS_HISTORY: '已有移交历史',
  NO_HISTORY: '尚无移交历史',
}

const managers = [PPIC_TEAM_LEADER_LINGYUN, PPIC_TEAM_LEADER_JIEGE]

function currentManager() {
  return managers.find((item) => item.ppicId === state.managerPpicId) || PPIC_TEAM_LEADER_LINGYUN
}

function baseRows(): SewingOutsourcingWorkbenchTaskRow[] {
  return listSewingOutsourcingWorkbenchRows({
    viewerPpicId: currentManager().ppicId,
    leaderView: true,
  })
    .filter((row) => {
      if (!row.runtimeTaskId || !row.assignmentId) return false
      const task = getRuntimeTaskById(row.runtimeTaskId)
      return Boolean(task && task.executionEnabled !== false && task.status !== 'DONE' && task.status !== 'CANCELLED')
    })
}

function hasTransferHistory(row: SewingOutsourcingWorkbenchTaskRow): boolean {
  return listSewingTaskResponsibilityVersions(row.runtimeTaskId).length > 1
}

function rows(): SewingOutsourcingWorkbenchTaskRow[] {
  const keyword = state.keyword.trim().toLowerCase()
  return baseRows()
    .filter((row) => state.historyTab === 'ALL' || (state.historyTab === 'HAS_HISTORY' ? hasTransferHistory(row) : !hasTransferHistory(row)))
    .filter((row) => !keyword || [row.taskNo, row.productionOrderNo, row.factoryName, row.ppicName]
      .some((value) => value.toLowerCase().includes(keyword)))
}

function currentResponsibility(row: SewingOutsourcingWorkbenchTaskRow): SewingTaskResponsibilityVersion | null {
  return getCurrentSewingTaskResponsibility(row.runtimeTaskId)
}

function imageButton(row: SewingOutsourcingWorkbenchTaskRow): string {
  const label = `${row.styleCode} ${row.styleName}`
  return `<button type="button" class="relative h-16 w-14 shrink-0 overflow-hidden rounded border bg-slate-50" data-ppic-transfer-action="preview-image" data-image-url="${escapeHtml(row.styleImageUrl)}" data-image-label="${escapeHtml(label)}" aria-label="查看${escapeHtml(row.styleCode)}款式高清图"><img class="h-full w-full object-cover" src="${escapeHtml(row.styleImageUrl)}" alt="${escapeHtml(row.styleImageAlt)}" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span hidden class="absolute inset-0 flex items-center justify-center bg-red-50 px-1 text-center text-[10px] text-red-700">图片加载失败</span></button>`
}

const columns: StandardListColumn<SewingOutsourcingWorkbenchTaskRow>[] = [
  { key: 'task', title: '未完执行任务', width: 320, required: true, freezeable: true, render: (row) => `<div class="flex gap-3">${imageButton(row)}<div><b>${escapeHtml(row.taskNo)}</b><p class="text-xs text-slate-500">${escapeHtml(row.productionOrderNo)} · ${escapeHtml(row.styleCode)}</p><p class="mt-1 text-xs">${escapeHtml(row.taskKindLabel)}</p><p class="font-mono text-[11px] text-slate-500">${escapeHtml(row.runtimeTaskId)}</p></div></div>` },
  { key: 'factory', title: '承接工厂', width: 210, required: true, render: (row) => `<b>${escapeHtml(row.factoryName)}</b><p class="mt-1 font-mono text-[11px] text-slate-500">${escapeHtml(row.assignmentId)}</p>` },
  { key: 'current', title: '当前任务PPIC', width: 200, required: true, render: (row) => { const current = currentResponsibility(row); return current ? `<b>${escapeHtml(current.ppicName)}</b><p class="mt-1 text-xs text-slate-500">${current.source === 'LEADER_TRANSFER' ? '负责人显式移交' : '分配时工厂归属快照'}</p><p class="mt-1 text-xs text-slate-500">生效：${escapeHtml(current.effectiveAt)}</p>` : '<b class="text-red-700">责任数据不完整</b>' } },
  { key: 'remaining', title: '当前剩余事项', width: 300, render: (row) => { const current = currentResponsibility(row); return current?.remainingItems.length ? `<ul class="list-disc pl-4 text-xs">${current.remainingItems.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : `<p class="text-xs text-slate-600">${escapeHtml(row.nextAction)}</p>` } },
  { key: 'history', title: '责任版本', width: 130, render: (row) => `<b>${listSewingTaskResponsibilityVersions(row.runtimeTaskId).length}版</b><p class="mt-1 text-xs text-slate-500">原PPIC不删除</p>` },
  { key: 'actions', title: '操作', width: 180, required: true, actionColumn: true, render: (row) => `<div class="flex justify-end gap-3"><button class="text-blue-700" data-ppic-transfer-action="history" data-row-id="${escapeHtml(row.rowId)}">历史</button><button class="font-semibold text-blue-700" data-ppic-transfer-action="transfer" data-row-id="${escapeHtml(row.rowId)}">明确移交</button></div>` },
]

const preferences: StandardListColumnPreferences = {
  order: columns.filter((column) => !column.actionColumn).map((column) => column.key),
  visibleKeys: columns.map((column) => column.key),
  frozenKeys: ['task'],
  pageSize: 20,
}

function activeRow(): SewingOutsourcingWorkbenchTaskRow | null {
  if (!state.dialog || state.dialog.kind === 'IMAGE') return null
  return getSewingOutsourcingWorkbenchRow(state.dialog.rowId, {
    viewerPpicId: currentManager().ppicId,
    leaderView: true,
  })
}

function renderDialog(): string {
  if (!state.dialog) return ''
  if (state.dialog.kind === 'IMAGE') return `<div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4" role="dialog" aria-modal="true" aria-label="${escapeHtml(state.dialog.label)}高清大图"><button class="absolute inset-0" data-ppic-transfer-action="close-dialog" aria-label="关闭大图"></button><section class="relative z-10 max-h-[92vh] max-w-5xl overflow-auto rounded-lg bg-white p-3"><header class="mb-3 flex justify-between gap-3"><b>${escapeHtml(state.dialog.label)}</b><button class="rounded border px-3 py-1 text-sm" data-ppic-transfer-action="close-dialog">关闭</button></header><img class="max-h-[78vh] max-w-full object-contain" src="${escapeHtml(state.dialog.imageUrl)}" alt="${escapeHtml(state.dialog.label)}高清图"></section></div>`
  const row = activeRow()
  if (!row) return ''
  const current = currentResponsibility(row)
  if (state.dialog.kind === 'HISTORY') {
    const versions = listSewingTaskResponsibilityVersions(row.runtimeTaskId).slice().reverse()
    return `<div class="fixed inset-0 z-50 overflow-auto bg-slate-950/60 p-4" role="dialog" aria-modal="true" aria-label="任务PPIC责任历史"><button class="fixed inset-0" data-ppic-transfer-action="close-dialog" aria-label="关闭"></button><section class="relative z-10 mx-auto my-8 w-full max-w-3xl rounded-lg bg-white shadow-xl"><header class="flex justify-between border-b p-5"><div><h2 class="text-lg font-semibold">${escapeHtml(row.taskNo)} · 责任历史</h2><p class="mt-1 text-xs text-slate-500">工厂档案后续换PPIC不会自动改写这里。</p></div><button class="rounded border px-3 py-1 text-sm" data-ppic-transfer-action="close-dialog">关闭</button></header><div class="space-y-3 p-5">${versions.map((version) => `<article class="rounded border p-4 ${version.status === 'CURRENT' ? 'border-blue-300 bg-blue-50' : 'bg-slate-50'}"><div class="flex justify-between gap-3"><b>${escapeHtml(version.ppicName)} · ${version.status === 'CURRENT' ? '当前责任' : '历史责任'}</b><span class="text-xs text-slate-500">${escapeHtml(version.effectiveAt)}</span></div><p class="mt-2 text-xs text-slate-600">${version.source === 'FACTORY_ASSIGNMENT' ? '分配时冻结工厂PPIC' : `PPIC管理人员明确移交；原PPIC ${escapeHtml(version.previousPpicName || '')}`}</p>${version.reason ? `<p class="mt-2 text-sm">原因：${escapeHtml(version.reason)}</p>` : ''}${version.remainingItems.length ? `<ul class="mt-2 list-disc pl-5 text-sm">${version.remainingItems.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : ''}</article>`).join('')}</div></section></div>`
  }
  const targets = getAvailableOnboardingPpicOptions().filter((option) => option.role === 'MEMBER' && option.ppicId !== current?.ppicId)
  return `<div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4" role="dialog" aria-modal="true" aria-label="明确移交任务PPIC责任"><button class="absolute inset-0" data-ppic-transfer-action="close-dialog" aria-label="关闭"></button><section class="relative z-10 w-full max-w-2xl rounded-lg bg-white shadow-xl"><header class="border-b p-5"><h2 class="text-lg font-semibold">明确移交任务责任</h2><p class="mt-1 text-xs text-slate-500">${escapeHtml(row.taskNo)} · 当前${escapeHtml(current?.ppicName || row.ppicName)} · 操作负责人${escapeHtml(currentManager().ppicName)}</p></header><div class="space-y-4 p-5">${state.dialog.error ? `<div class="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">${escapeHtml(state.dialog.error)}</div>` : ''}<div class="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">尚未完成的任务不能随工厂档案PPIC变更自动转人；本动作建立新责任版本，保留原PPIC、移交时间和剩余事项。</div><label class="block text-sm">新PPIC<select class="mt-1 h-10 w-full rounded border px-3" data-ppic-transfer-field="targetPpicId"><option value="">请选择启用中的PPIC</option>${targets.map((option) => `<option value="${escapeHtml(option.ppicId)}">${escapeHtml(option.ppicName)}</option>`).join('')}</select></label><label class="block text-sm">移交原因<textarea class="mt-1 min-h-20 w-full rounded border p-3" data-ppic-transfer-field="reason" placeholder="说明为什么需要移交"></textarea></label><label class="block text-sm">剩余事项（每行一项）<textarea class="mt-1 min-h-28 w-full rounded border p-3" data-ppic-transfer-field="remainingItems" placeholder="例如：\n跟进批版建议反馈\n跟进70%回货节点\n核对裁片退仓结果"></textarea></label></div><footer class="flex justify-end gap-2 border-t p-4"><button class="rounded border px-4 py-2 text-sm" data-ppic-transfer-action="close-dialog">取消</button><button class="rounded bg-blue-600 px-4 py-2 text-sm text-white" data-ppic-transfer-action="submit-transfer" data-row-id="${escapeHtml(row.rowId)}">确认移交</button></footer></section></div>`
}

export function renderSewingOutsourcingResponsibilityTransfersPage(): string {
  const completeRows = baseRows()
  const allRows = rows()
  const totalPages = Math.max(1, Math.ceil(allRows.length / state.pageSize))
  state.page = Math.min(Math.max(1, state.page), totalPages)
  const start = (state.page - 1) * state.pageSize
  const pageRows = allRows.slice(start, start + state.pageSize)
  return `<div data-ppic-transfer-page data-skip-page-rerender="true">${renderStandardListPage({
    title: '责任移交',
    primaryActionsHtml: `<div class="flex flex-wrap items-center gap-2"><label class="text-sm">管理人员<select class="ml-2 h-9 rounded border bg-white px-3" data-ppic-transfer-field="managerPpicId">${managers.map((manager) => `<option value="${escapeHtml(manager.ppicId)}"${manager.ppicId === state.managerPpicId ? ' selected' : ''}>${escapeHtml(manager.ppicName)}</option>`).join('')}</select></label><span class="rounded bg-purple-50 px-3 py-2 text-xs font-semibold text-purple-800">当前操作身份：${escapeHtml(currentManager().ppicName)}（团队负责人）</span></div>`,
    feedbackHtml: state.feedback ? `<div class="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">${escapeHtml(state.feedback)}</div>` : '',
    statusTabsHtml: renderUiTabs({
      tabs: (Object.keys(transferHistoryTabLabels) as TransferHistoryTab[]).map((tab) => ({ key: tab, label: transferHistoryTabLabels[tab], count: tab === 'ALL' ? completeRows.length : completeRows.filter((row) => tab === 'HAS_HISTORY' ? hasTransferHistory(row) : !hasTransferHistory(row)).length })),
      activeKey: state.historyTab,
      variant: 'pills',
      prefix: 'ppic-transfer',
      action: 'switch-tab',
      fullWidth: true,
    }),
    filtersHtml: renderStandardListFilters({
      actionPrefix: 'ppic-transfer',
      fieldsHtml: `<input class="h-9 min-w-80 rounded border px-3 text-sm" placeholder="生产单 / 执行任务 / 工厂 / 当前PPIC" value="${escapeHtml(state.draftKeyword)}" data-ppic-transfer-field="keyword">`,
    }),
    listTitle: '未完成车缝外发执行任务',
    tableHtml: renderStandardListTable({ columns, rows: pageRows, preferences: { ...preferences, pageSize: state.pageSize }, sort: null, eventPrefix: 'ppic-transfer', emptyText: '当前没有可移交的未完执行任务' }),
    paginationHtml: renderTablePagination({ total: allRows.length, from: allRows.length ? start + 1 : 0, to: Math.min(start + state.pageSize, allRows.length), currentPage: state.page, totalPages, pageSize: state.pageSize, actionPrefix: 'ppic-transfer', fieldPrefix: 'ppic-transfer', pageSizeOptions: [20, 50] }),
    overlaysHtml: renderDialog(),
  })}</div>`
}

function refresh(): void {
  const root = document.querySelector<HTMLElement>('[data-ppic-transfer-page]')
  if (root) root.outerHTML = renderSewingOutsourcingResponsibilityTransfersPage()
}

export function isSewingOutsourcingResponsibilityTransferDialogOpen(): boolean { return state.dialog !== null }

export function closeSewingOutsourcingResponsibilityTransferDialog(): boolean {
  if (!state.dialog) return false
  state.dialog = null
  refresh()
  return true
}

export function handleSewingOutsourcingResponsibilityTransfersEvent(target: HTMLElement): boolean {
  const field = target.closest<HTMLInputElement | HTMLSelectElement>('[data-ppic-transfer-field]')
  if (field && !state.dialog) {
    if (field.dataset.ppicTransferField === 'keyword') state.draftKeyword = field.value
    else if (field.dataset.ppicTransferField === 'managerPpicId') {
      state.managerPpicId = field.value
      state.page = 1
      refresh()
    }
    else if (field.dataset.ppicTransferField === 'pageSize') {
      state.pageSize = Number(field.value) || 20
      state.page = 1
      refresh()
    }
    else return false
    return true
  }
  const node = target.closest<HTMLElement>('[data-ppic-transfer-action]')
  const action = node?.dataset.ppicTransferAction
  if (!node || !action) return false
  if (action === 'close-dialog') return closeSewingOutsourcingResponsibilityTransferDialog()
  if (action.startsWith('switch-tab:')) {
    state.historyTab = action.slice('switch-tab:'.length) as TransferHistoryTab
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
  else if (action === 'history') state.dialog = { kind: 'HISTORY', rowId: node.dataset.rowId || '' }
  else if (action === 'transfer') state.dialog = { kind: 'TRANSFER', rowId: node.dataset.rowId || '', error: '' }
  else if (action === 'submit-transfer' && state.dialog?.kind === 'TRANSFER') {
    const rowId = state.dialog.rowId
    const row = getSewingOutsourcingWorkbenchRow(rowId, {
      viewerPpicId: currentManager().ppicId,
      leaderView: true,
    })
    const value = (name: string) => document.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(`[data-ppic-transfer-field="${name}"]`)?.value.trim() || ''
    try {
      if (!row) throw new Error('未找到待移交任务。')
      state.commandSequence += 1
      const version = transferSewingTaskResponsibility({
        commandId: `CMD-PPIC-LEADER-TRANSFER-${Date.now()}-${state.commandSequence}`,
        runtimeTaskId: row.runtimeTaskId,
        targetPpicId: value('targetPpicId'),
        reason: value('reason'),
        remainingItems: value('remainingItems').split(/\n|；|;/).map((item) => item.trim()).filter(Boolean),
        operatedAt: formatOperationLocalWallClock(),
        operatedByPpicId: currentManager().ppicId,
      })
      state.feedback = `${row.taskNo}已由${currentManager().ppicName}明确移交给${version.ppicName}；原责任版本已保留。`
      state.dialog = null
    } catch (error) {
      state.dialog = { kind: 'TRANSFER', rowId, error: error instanceof Error ? error.message : '移交失败' }
    }
  } else if (action === 'prev-page') state.page = Math.max(1, state.page - 1)
  else if (action === 'next-page') state.page += 1
  else return false
  refresh()
  return true
}
