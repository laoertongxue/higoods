// @page-pattern: list

import { renderStandardListFilters, renderStandardListPage } from '../../components/ui/list-page.ts'
import { renderStandardListTable, type StandardListColumn } from '../../components/ui/list-table.ts'
import type { StandardListColumnPreferences } from '../../components/ui/list-table-model.ts'
import { renderTablePagination } from '../../components/ui/pagination.ts'
import { renderTabs as renderUiTabs } from '../../components/ui/tabs.ts'
import { PPIC_TEAM_LEADER_LINGYUN } from '../../data/fcs/factory-onboarding-ppic.ts'
import {
  getSewingOutsourcingWorkbenchRow,
  listSewingOutsourcingWorkbenchPpicOptions,
  listSewingOutsourcingWorkbenchRows,
  SEWING_OUTSOURCING_HEALTH_LABEL,
  SEWING_OUTSOURCING_NEXT_PARTY_LABEL,
  type SewingOutsourcingWorkbenchTaskRow,
} from '../../data/fcs/sewing-outsourcing-workbench.ts'
import { escapeHtml } from '../../utils.ts'

type DialogState =
  | { kind: 'DETAIL'; rowId: string }
  | { kind: 'IMAGE'; imageUrl: string; label: string }
  | null

const state = {
  keyword: '',
  draftKeyword: '',
  ppicId: '',
  draftPpicId: '',
  taskKind: 'ALL',
  page: 1,
  pageSize: 20,
  dialog: null as DialogState,
}

type TaskKindTab = 'ALL' | 'INDEPENDENT_SEWING' | 'SEWING_IRON_PACK' | 'CUTTING_SEWING_IRON_PACK'

const taskKindLabels: Record<TaskKindTab, string> = {
  ALL: '全部任务',
  INDEPENDENT_SEWING: '独立车缝',
  SEWING_IRON_PACK: '车缝+烫包',
  CUTTING_SEWING_IRON_PACK: '裁剪+车缝+烫包',
}

function baseRows(): SewingOutsourcingWorkbenchTaskRow[] {
  return listSewingOutsourcingWorkbenchRows({
    viewerPpicId: PPIC_TEAM_LEADER_LINGYUN.ppicId,
    leaderView: true,
    selectedPpicId: state.ppicId,
  })
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
  return `<button type="button" class="relative h-16 w-14 shrink-0 overflow-hidden rounded border bg-slate-50" data-ppic-task-action="preview-image" data-image-url="${escapeHtml(row.styleImageUrl)}" data-image-label="${escapeHtml(label)}" aria-label="查看${escapeHtml(row.styleCode)}款式高清图"><img class="h-full w-full object-cover" src="${escapeHtml(row.styleImageUrl)}" alt="${escapeHtml(row.styleImageAlt)}" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span hidden class="absolute inset-0 flex items-center justify-center bg-red-50 px-1 text-center text-[10px] text-red-700">图片加载失败</span></button>`
}

const columns: StandardListColumn<SewingOutsourcingWorkbenchTaskRow>[] = [
  { key: 'identity', title: '款式／生产单／执行任务', width: 330, required: true, freezeable: true, render: (row) => `<div class="flex gap-3">${imageButton(row)}<div><b>${escapeHtml(row.styleCode)}</b><p class="text-xs text-slate-500">${escapeHtml(row.styleName)}</p><p class="mt-1 text-xs">${escapeHtml(row.productionOrderNo)} · ${escapeHtml(row.taskNo)}</p><p class="font-mono text-[11px] text-slate-500">${escapeHtml(row.runtimeTaskId || '历史任务待绑定')}</p></div></div>` },
  { key: 'assignment', title: '有效分配／工厂', width: 250, required: true, render: (row) => `<b>${escapeHtml(row.factoryName)}</b><p class="mt-1 font-mono text-[11px] text-slate-500">${escapeHtml(row.assignmentId || '缺少有效分配关联')}</p><p class="mt-1 text-xs font-semibold text-blue-700">任务PPIC：${escapeHtml(row.ppicName)}</p>` },
  { key: 'kind', title: '任务类型', width: 160, required: true, render: (row) => `<b>${escapeHtml(row.taskKindLabel)}</b><p class="mt-1 text-xs text-slate-500">一厂一执行任务</p>` },
  { key: 'health', title: '健康度／下一责任方', width: 230, required: true, render: (row) => `<b class="${row.health === 'ABNORMAL' ? 'text-red-700' : row.health === 'DATA_INCOMPLETE' ? 'text-violet-700' : row.health === 'ATTENTION' ? 'text-amber-800' : 'text-emerald-700'}">${escapeHtml(SEWING_OUTSOURCING_HEALTH_LABEL[row.health])}</b><p class="mt-1 text-xs">下一责任方：${escapeHtml(SEWING_OUTSOURCING_NEXT_PARTY_LABEL[row.nextResponsibleParty])}</p><p class="mt-1 text-xs text-slate-500">${escapeHtml(row.nextAction)}</p>` },
  { key: 'quantity', title: '任务数量事实', width: 240, render: (row) => row.quantitySummaries.map((value) => `<p class="text-xs">${escapeHtml(value)}</p>`).join('') || '<span class="text-xs text-slate-500">暂无可用数量</span>' },
  { key: 'actions', title: '操作', width: 320, required: true, actionColumn: true, render: (row) => `<div class="flex flex-wrap justify-end gap-x-3 gap-y-2">${row.sourceLinks.map((source) => `<a class="text-xs font-semibold text-blue-700 hover:underline" data-nav="${escapeHtml(source.href)}">${escapeHtml(source.label)}</a>`).join('') || '<span class="text-xs text-violet-700">待完成历史关联</span>'}<button class="text-xs font-semibold text-blue-700" data-ppic-task-action="detail" data-row-id="${escapeHtml(row.rowId)}">全链详情</button></div>` },
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
    viewerPpicId: PPIC_TEAM_LEADER_LINGYUN.ppicId,
    leaderView: true,
  })
  if (!row) return ''
  return `<div class="fixed inset-0 z-50 overflow-auto bg-slate-950/60 p-4" role="dialog" aria-modal="true" aria-label="车缝任务全链详情"><button class="fixed inset-0" data-ppic-task-action="close-dialog" aria-label="关闭"></button><section class="relative z-10 mx-auto my-4 w-full max-w-5xl rounded-lg bg-white shadow-xl"><header class="flex items-start justify-between border-b p-5"><div><h2 class="text-lg font-semibold">${escapeHtml(row.taskNo)} · 车缝任务全链详情</h2><p class="mt-1 text-xs text-slate-500">${escapeHtml(row.productionOrderNo)} · ${escapeHtml(row.factoryName)} · ${escapeHtml(row.ppicName)}</p></div><button class="rounded border px-3 py-1 text-sm" data-ppic-task-action="close-dialog">关闭</button></header><div class="space-y-4 p-5"><section class="grid gap-3 md:grid-cols-4"><div class="rounded border p-3"><p class="text-xs text-slate-500">任务类型</p><b>${escapeHtml(row.taskKindLabel)}</b></div><div class="rounded border p-3"><p class="text-xs text-slate-500">健康度</p><b>${escapeHtml(SEWING_OUTSOURCING_HEALTH_LABEL[row.health])}</b></div><div class="rounded border p-3"><p class="text-xs text-slate-500">下一责任方</p><b>${escapeHtml(SEWING_OUTSOURCING_NEXT_PARTY_LABEL[row.nextResponsibleParty])}</b></div><div class="rounded border p-3"><p class="text-xs text-slate-500">期限</p><b>${escapeHtml(row.dueAt)}</b></div></section><section class="rounded border p-4"><h3 class="font-semibold">当前动作</h3><p class="mt-2">${escapeHtml(row.nextAction)}</p><p class="mt-1 text-sm text-slate-500">${escapeHtml(row.impactSummary)}</p></section><section class="rounded border p-4"><h3 class="font-semibold">业务时间线</h3><ol class="mt-3 space-y-3">${row.timeline.map((item) => `<li class="border-l-2 border-slate-200 pl-4"><b>${escapeHtml(item.title)}</b><span class="ml-2 rounded bg-slate-100 px-2 py-0.5 text-[11px]">${escapeHtml(item.source)}</span><p class="mt-1 text-xs text-slate-500">${escapeHtml(item.occurredAt)}</p><p class="mt-1 text-sm">${escapeHtml(item.detail)}</p></li>`).join('')}</ol></section></div></section></div>`
}

export function renderSewingOutsourcingTasksPage(): string {
  const completeRows = baseRows()
  const allRows = rows()
  const totalPages = Math.max(1, Math.ceil(allRows.length / state.pageSize))
  state.page = Math.min(Math.max(1, state.page), totalPages)
  const start = (state.page - 1) * state.pageSize
  const pageRows = allRows.slice(start, start + state.pageSize)
  const ppicOptions = listSewingOutsourcingWorkbenchPpicOptions()
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
      fieldsHtml: `<input class="h-9 min-w-80 rounded border px-3 text-sm" placeholder="生产单 / 执行任务 / 分配 / 工厂" value="${escapeHtml(state.draftKeyword)}" data-ppic-task-field="keyword"><select class="h-9 rounded border px-3 text-sm" data-ppic-task-field="ppicId"><option value="">全部PPIC</option>${ppicOptions.map((option) => `<option value="${escapeHtml(option.ppicId)}"${state.draftPpicId === option.ppicId ? ' selected' : ''}>${escapeHtml(option.ppicName)}（${option.taskCount}）</option>`).join('')}</select>`,
    }),
    listTitle: '车缝外发执行任务主清单',
    listActionsHtml: '<a class="text-xs font-semibold text-blue-700" data-nav="/fcs/sewing-outsourcing/migration-audit">历史迁移审计</a>',
    tableHtml: renderStandardListTable({ columns, rows: pageRows, preferences: { ...preferences, pageSize: state.pageSize }, sort: null, eventPrefix: 'ppic-task', emptyText: '暂无符合条件的车缝执行任务' }),
    paginationHtml: renderTablePagination({ total: allRows.length, from: allRows.length ? start + 1 : 0, to: Math.min(start + state.pageSize, allRows.length), currentPage: state.page, totalPages, pageSize: state.pageSize, actionPrefix: 'ppic-task', fieldPrefix: 'ppic-task', pageSizeOptions: [20, 50] }),
    overlaysHtml: renderDialog(),
  })}</div>`
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
    else if (name === 'ppicId') state.draftPpicId = field.value
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
  if (action.startsWith('switch-tab:')) {
    state.taskKind = action.slice('switch-tab:'.length) as TaskKindTab
    state.page = 1
  }
  else if (action === 'query') {
    state.keyword = state.draftKeyword
    state.ppicId = state.draftPpicId
    state.page = 1
  }
  else if (action === 'reset') {
    state.keyword = ''
    state.draftKeyword = ''
    state.ppicId = ''
    state.draftPpicId = ''
    state.page = 1
  }
  else if (action === 'preview-image') state.dialog = { kind: 'IMAGE', imageUrl: node.dataset.imageUrl || '', label: node.dataset.imageLabel || '款式' }
  else if (action === 'detail') state.dialog = { kind: 'DETAIL', rowId: node.dataset.rowId || '' }
  else if (action === 'prev-page') state.page = Math.max(1, state.page - 1)
  else if (action === 'next-page') state.page += 1
  else return false
  refresh()
  return true
}
