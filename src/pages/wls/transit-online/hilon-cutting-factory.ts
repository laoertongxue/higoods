// @page-pattern: list
import { escapeHtml } from '../../../utils.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../../components/ui/button.ts'
import { renderFormDialog } from '../../../components/ui/dialog.ts'
import { showListFeedback } from '../../../components/ui/list-feedback.ts'
import { createStandardListPage, type TransitOnlineListDefinition, type TransitOnlineListContext } from './list-factory.ts'
import {
  hilonCuttingFactorySeed,
  cuttingAssignmentStatusOptions,
  cuttingAssignmentModeOptions,
  cuttingProcessStationOptions,
  cuttingProcessOptions,
  hilonCuttingFactoryOptions,
  type TransitOnlineCuttingFactoryRow,
} from './seed.ts'
import type { StandardListColumn } from '../../../components/ui/list-table.ts'

const statusClass: Record<string, string> = {
  待分配: 'bg-orange-50 text-orange-700',
  竞价中: 'bg-blue-50 text-blue-700',
  已定标: 'bg-violet-50 text-violet-700',
  已直接派单: 'bg-emerald-50 text-emerald-700',
}

export interface CuttingFactoryOptions {
  eventPrefix: string
  preferenceKey: string
  title: string
  listTitle: string
  rows: TransitOnlineCuttingFactoryRow[]
  factoryOptions: string[]
  description?: string
}

// 勾选列选中行（group8 行84）。
const selectedRows = new Set<number>()

function buildColumns(options: CuttingFactoryOptions): StandardListColumn<TransitOnlineCuttingFactoryRow>[] {
  const event = options.eventPrefix
  return [
    {
      key: 'selection',
      title: '勾选',
      width: 56,
      required: true,
      freezeable: true,
      render: (r) => `<input type="checkbox" class="h-4 w-4 rounded border-slate-300" ${selectedRows.has(options.rows.indexOf(r)) ? 'checked' : ''} data-${event}-action="toggle-select" data-${event}-idx="${options.rows.indexOf(r)}">`,
    },
    {
      key: 'taskObject',
      title: '任务对象',
      width: 220,
      required: true,
      freezeable: true,
      sortable: true,
      sortValue: (r) => r.productionNo,
      render: (r) => `<div class="min-w-0"><div class="text-xs text-slate-700">${escapeHtml(r.taskObject)}</div><div class="truncate font-mono text-xs text-slate-400">${escapeHtml(r.productionNo)}</div></div>`,
    },
    { key: 'taskContent', title: '任务内容', width: 140, sortable: true, sortValue: (r) => r.taskContent, render: (r) => `<span class="text-xs text-slate-600">${escapeHtml(r.taskContent)}</span>` },
    { key: 'qty', title: '数量', width: 90, align: 'right', sortable: true, sortValue: (r) => r.qty, render: (r) => `<span class="font-medium text-slate-700">${r.qty} 件</span>` },
    { key: 'followUp', title: '跟单责任', width: 110, sortable: true, sortValue: (r) => r.followUp, render: (r) => `<span class="text-xs text-slate-500">${escapeHtml(r.followUp)}</span>` },
    {
      key: 'assignmentInfo',
      title: '分配信息',
      width: 200,
      sortable: true,
      sortValue: (r) => r.assignmentStatus,
      render: (r) => `<div class="min-w-0"><span class="rounded-full px-2 py-0.5 text-xs ${statusClass[r.assignmentStatus] ?? ''}">${escapeHtml(r.assignmentStatus)}</span><div class="mt-1 truncate text-xs text-slate-500">${escapeHtml(r.assignmentInfo)}</div></div>`,
    },
    { key: 'dispatchTime', title: '派单时间', width: 150, sortable: true, sortValue: (r) => r.dispatchTime, render: (r) => `<span class="text-xs text-slate-400">${escapeHtml(r.dispatchTime)}</span>` },
    { key: 'acceptDeadline', title: '接单截止时间', width: 150, sortable: true, sortValue: (r) => r.acceptDeadline, render: (r) => `<span class="text-xs text-slate-400">${escapeHtml(r.acceptDeadline)}</span>` },
    { key: 'taskDeadline', title: '任务截止时间', width: 150, sortable: true, sortValue: (r) => r.taskDeadline, render: (r) => `<span class="text-xs text-slate-400">${escapeHtml(r.taskDeadline)}</span>` },
    { key: 'price', title: '价格', width: 90, align: 'right', sortable: true, sortValue: (r) => r.price, render: (r) => `<span class="text-slate-700">${escapeHtml(r.price)}</span>` },
    {
      key: 'actions',
      title: '操作',
      width: 100,
      required: true,
      actionColumn: true,
      render: (r) => `<button class="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50" data-${event}-action="assign-row" data-${event}-idx="${options.rows.indexOf(r)}">${r.assignmentStatus === '待分配' ? '分配' : '重新分配'}</button>`,
    },
  ]
}

/** 裁片任务分配构建器：老中转仓与新中转仓同构。 */
export function createCuttingFactoryPage(options: CuttingFactoryOptions) {
  const event = options.eventPrefix
  const dataPrefix = event.replace(/-([a-z0-9])/g, (_, char: string) => char.toUpperCase())
  let assignTarget: number | 'batch' | null = null
  let assignFromSelection = false
  let assignFactory = options.factoryOptions[1] ?? options.factoryOptions[0] ?? ''
  let assignMode = '人工直接派单'

  const renderAssignDialog = (ctx: TransitOnlineListContext<TransitOnlineCuttingFactoryRow>): string => {
    const isBatch = assignTarget === 'batch'
    const row = typeof assignTarget === 'number' ? ctx.rows[assignTarget] : null
    const content = `<div class="grid grid-cols-2 gap-x-6 gap-y-3">
      <p class="col-span-2 text-xs text-muted-foreground">${isBatch ? (assignFromSelection ? `将对已勾选的 ${selectedRows.size} 条任务执行分配` : `将对当前筛选结果中 ${ctx.filtered().filter((r) => r.assignmentStatus === '待分配').length} 条待分配任务执行分配`) : `任务对象：${escapeHtml(row?.taskObject ?? '')}`}</p>
      <label class="flex min-w-0 flex-col gap-1"><span class="text-xs text-muted-foreground">承接工厂</span><select class="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" data-${event}-field="assign:factory">${options.factoryOptions
        .filter((option) => option !== '全部' && option !== '选择承接工厂')
        .map((option) => `<option value="${escapeHtml(option)}" ${assignFactory === option ? 'selected' : ''}>${escapeHtml(option)}</option>`)
        .join('')}</select></label>
      <label class="flex min-w-0 flex-col gap-1"><span class="text-xs text-muted-foreground">分配方式</span><select class="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" data-${event}-field="assign:mode">${['人工直接派单', '竞价'].map((option) => `<option value="${option}" ${assignMode === option ? 'selected' : ''}>${option}</option>`).join('')}</select></label>
    </div>`.replace(/<(input|select)\b/g, '<$1 data-skip-page-rerender="true"')
    return renderFormDialog(
      {
        title: isBatch ? '批量分配' : '任务分配',
        closeAction: { prefix: event, action: 'close-assign' },
        submitAction: { prefix: event, action: 'submit-assign', label: '确认分配' },
        width: 'lg',
      },
      content,
    )
  }

  const applyAssignment = (row: TransitOnlineCuttingFactoryRow): void => {
    row.assignmentStatus = assignMode === '竞价' ? '竞价中' : '已直接派单'
    row.assignmentMode = assignMode === '竞价' ? '竞价' : '人工直接派单'
    row.factory = assignFactory
    row.assignmentInfo = `${assignMode} · ${assignFactory}`
    row.dispatchTime = '2026-10-14 16:30'
    row.acceptDeadline = '2026-10-15 12:00'
    row.taskDeadline = '2026-10-17 18:00'
    row.price = row.price === '—' ? '¥9' : row.price
  }

  const definition: TransitOnlineListDefinition<TransitOnlineCuttingFactoryRow> = {
    eventPrefix: event,
    preferenceKey: options.preferenceKey,
    title: options.title,
    listTitle: options.listTitle,
    columns: buildColumns(options),
    rows: options.rows,
    emptyText: '暂无待分配任务',
    defaultFrozenKeys: ['selection', 'taskObject'],
    exportFileName: options.listTitle,
    description: options.description,
    primaryActionsHtml: () =>
      `<div class="flex flex-wrap items-center gap-2">${renderPrimaryButton('选择承接工厂', { prefix: event, action: 'choose-factory' }, 'factory')}${renderSecondaryButton('批量分配', { prefix: event, action: 'assign-batch' }, 'users')}</div>`,
    searches: [
      { name: 'keyword', label: '综合查询', placeholder: '生产单号 / 出库单号 / 配料单号', wide: true },
      { name: 'startDate', label: '派单开始时间', placeholder: '开始时间', type: 'date' },
      { name: 'endDate', label: '派单截止时间', placeholder: '截止时间', type: 'date' },
    ],
    selects: [
      { name: 'batchFactoryId', label: '承接工厂', options: options.factoryOptions },
      { name: 'assignmentStatus', label: '分配进度', options: cuttingAssignmentStatusOptions },
      { name: 'assignmentMode', label: '分配方式', options: cuttingAssignmentModeOptions },
      { name: 'processStationId', label: '工序', options: cuttingProcessStationOptions },
      { name: 'processId', label: '工艺', options: cuttingProcessOptions },
      { name: 'assignmentFactoryId', label: '已分配工厂', options: ['全部', ...options.factoryOptions.slice(1)] },
    ],
    stats: (rows) => [
      { label: '全部可执行任务', value: `${rows.length} 条` },
      { label: '待分配/竞价中', value: `${rows.filter((r) => r.assignmentStatus === '待分配' || r.assignmentStatus === '竞价中').length} 条` },
      { label: '已确认工厂', value: `${rows.filter((r) => r.assignmentStatus === '已直接派单' || r.assignmentStatus === '已定标').length} 条` },
    ],
    matches: (row, query) => {
      const keyword = (query.searches.keyword ?? '').trim().toLowerCase()
      if (keyword) {
        const haystack = `${row.productionNo} ${row.outboundNo} ${row.allocationNo}`.toLowerCase()
        if (!haystack.includes(keyword)) return false
      }
      if (query.selects.assignmentStatus && query.selects.assignmentStatus !== row.assignmentStatus) return false
      if (query.selects.assignmentMode && query.selects.assignmentMode !== row.assignmentMode) return false
      if (query.selects.processStationId && query.selects.processStationId !== row.processStation) return false
      if (query.selects.processId && query.selects.processId !== row.process) return false
      if (query.selects.assignmentFactoryId && query.selects.assignmentFactoryId !== row.factory) return false
      if (query.selects.batchFactoryId && query.selects.batchFactoryId !== row.factory) return false
      const dispatchDate = row.dispatchTime === '—' ? '' : row.dispatchTime.slice(0, 10)
      const startDate = query.searches.startDate ?? ''
      const endDate = query.searches.endDate ?? ''
      if (startDate && dispatchDate && dispatchDate < startDate) return false
      if (endDate && dispatchDate && dispatchDate > endDate) return false
      if (startDate && !dispatchDate && row.assignmentStatus === '待分配') return false
      return true
    },
    overlaysHtml: (ctx) => (assignTarget !== null ? renderAssignDialog(ctx) : ''),
    onField: (name, element) => {
      if (name === 'assign:factory') {
        assignFactory = element.value
        return true
      }
      if (name === 'assign:mode') {
        assignMode = element.value
        return true
      }
      return false
    },
    onAction: (action, node, ctx) => {
      if (action === 'toggle-select') {
        const idx = Number(node.dataset[`${dataPrefix}Idx`])
        if (selectedRows.has(idx)) selectedRows.delete(idx)
        else selectedRows.add(idx)
        return true
      }
      if (action === 'choose-factory') {
        if (selectedRows.size === 0) {
          showListFeedback('请先勾选要分配的任务再选择承接工厂', 'warning')
          return true
        }
        assignFromSelection = true
        assignTarget = 'batch'
        return true
      }
      if (action === 'assign-batch') {
        assignFromSelection = false
        assignTarget = 'batch'
        return true
      }
      if (action === 'assign-row') {
        assignTarget = Number(node.dataset[`${dataPrefix}Idx`])
        return true
      }
      if (action === 'close-assign') {
        assignTarget = null
        assignFromSelection = false
        return true
      }
      if (action === 'submit-assign') {
        if (assignTarget === 'batch') {
          const targets = assignFromSelection
            ? [...selectedRows].map((idx) => ctx.rows[idx]).filter((row): row is TransitOnlineCuttingFactoryRow => Boolean(row))
            : ctx.filtered().filter((r) => r.assignmentStatus === '待分配')
          targets.forEach(applyAssignment)
          selectedRows.clear()
          showListFeedback(`已批量分配 ${targets.length} 条任务给 ${assignFactory}`)
        } else if (typeof assignTarget === 'number') {
          const row = ctx.rows[assignTarget]
          if (row) {
            applyAssignment(row)
            showListFeedback(`任务 ${row.productionNo} 已分配给 ${assignFactory}`)
          }
        }
        assignTarget = null
        assignFromSelection = false
        return true
      }
      return false
    },
  }
  return createStandardListPage(definition)
}

const page = createCuttingFactoryPage({
  eventPrefix: 'wls-online-hilon-cutting-factory',
  preferenceKey: '/wls/online/hilon-cutting-factory:list-columns',
  title: '裁片任务分配（老中转仓）',
  listTitle: '裁片任务分配',
  rows: hilonCuttingFactorySeed,
  factoryOptions: hilonCuttingFactoryOptions,
  description: '仅展示裁片任务尚未分配、且已配料未领料的生产单。承接工厂仅限 sea cutting 与 sea-PPIC。',
})

export function renderTransitOnlineHilonCuttingFactoryPage(): string {
  return page.render()
}

export function handleTransitOnlineHilonCuttingFactoryEvent(target: HTMLElement, event?: Event): boolean {
  return page.handle(target, event)
}
