// @page-pattern: detail

import { escapeHtml } from '../../../utils'
import { hydrateIcons } from '../../../components/shell.ts'
import { renderTablePagination } from '../../../components/ui/pagination.ts'
import { paginateStandardListRows } from '../../../components/ui/list-table-model.ts'
import { renderTable } from '../../../components/ui/table.ts'
import { buildDyeWorkOrderCombinedDyeingView } from '../../../data/fcs/dye-work-order-combined-dyeing-view.ts'
import type { CombinedDyeingSatisfaction, CombinedDyeingTask } from '../../../data/fcs/combined-dyeing-domain.ts'
import {
  buildDyeingWorkOrderDetailLink,
  buildHandoverDifferenceRequestPrintLink,
  buildHandoverOrderLink,
  buildTaskDetailLink,
} from '../../../data/fcs/fcs-route-links.ts'
import {
  buildMobileExecutionListLocatePathForTask,
  getMobileExecutionTaskById,
} from '../../../data/fcs/mobile-execution-task-index.ts'
import { validateDyeWorkOrderMobileTaskBinding } from '../../../data/fcs/process-mobile-task-binding.ts'
import {
  executeProcessWebAction,
  getAvailableDyeWebActions,
  getUnifiedOperationRecordsForProcessWorkOrder,
  type ProcessWebAction,
  type ProcessWebOperationRecord,
} from '../../../data/fcs/process-web-status-actions.ts'
import { getPlatformStatusForProcessWorkOrder } from '../../../data/fcs/process-platform-status-adapter.ts'
import { getStartPrerequisiteByTaskId } from '../../../data/fcs/pda-start-link.ts'
import { getPdaSession } from '../../../data/fcs/store-domain-pda.ts'
import { validateWaterSolublePdaActor, type WaterSolublePdaRoleAction } from '../../../data/fcs/water-soluble-pda-actor.ts'
import {
  getProcessWorkOrderById,
  getProcessWorkOrderByNo,
  type ProcessWorkOrder,
} from '../../../data/fcs/process-work-order-domain.ts'
import {
  getDifferenceRecordsByWorkOrderId,
  getHandoverRecordsByWorkOrderId,
  getReviewRecordsByWorkOrderId,
  handleProcessHandoverDifference,
  type ProcessHandoverDifferenceRecord,
} from '../../../data/fcs/process-warehouse-domain.ts'
import { getDyeingExecutionStatistics } from '../../../data/fcs/process-statistics-domain.ts'
import { formatFactoryDisplayName } from '../../../data/fcs/factory-mock-data.ts'
import { appStore } from '../../../state/store.ts'
import { formatDyeQty, formatDyeTime, renderBadge, renderPageHeader, renderSection } from './shared'
import {
  getDyeWorkOrderById,
  getDyeCurrentStepLabel,
  listDyeExecutionNodeRecords,
  type DyeWorkOrder,
} from '../../../data/fcs/dyeing-task-domain.ts'
import { getProcessWorkOrderSourceDetailRows } from '../../process-work-orders/process-work-order-source-view.ts'

function renderSourceFields(order: ProcessWorkOrder): string {
  return getProcessWorkOrderSourceDetailRows(order).map((row) => renderField(row.label, row.value)).join('')
}

type DyeDetailTab =
  | 'base'
  | 'sample'
  | 'execution'
  | 'formula'
  | 'handover'
  | 'review'
  | 'statistics'
  | 'exception'

const dyeDetailTabs: Array<{ key: DyeDetailTab; label: string }> = [
  { key: 'base', label: '基本信息' },
  { key: 'sample', label: '打样备料' },
  { key: 'execution', label: '染缸执行' },
  { key: 'formula', label: '染色配方' },
  { key: 'handover', label: '交出记录' },
  { key: 'review', label: '收货确认' },
  { key: 'statistics', label: '染色统计' },
  { key: 'exception', label: '异常与结算' },
]

const consumedWebActionKeys = new Set<string>()
const COMBINED_PAGE_SIZE = 10
type CombinedHistoryScope = 'tasks' | 'versions' | 'impacts' | 'syncs'
const combinedHistoryPages: Record<CombinedHistoryScope, number> = { tasks: 1, versions: 1, impacts: 1, syncs: 1 }
let combinedHistoryOwnerId = ''

export function resolveDyeWorkOrderCombinedHistoryPagination(
  currentOwnerId: string,
  nextOwnerId: string,
  pages: Readonly<Record<CombinedHistoryScope, number>>,
): { ownerId: string; pages: Record<CombinedHistoryScope, number> } {
  return {
    ownerId: nextOwnerId,
    pages: currentOwnerId === nextOwnerId
      ? { ...pages }
      : { tasks: 1, versions: 1, impacts: 1, syncs: 1 },
  }
}

function combinedSatisfactionLabel(value: CombinedDyeingSatisfaction): string {
  if (value === 'FULL') return '已满足'
  if (value === 'PARTIAL') return '部分满足'
  return '未满足'
}

function combinedTaskStatusLabel(task: CombinedDyeingTask): string {
  if (task.status === 'WAIT_DYEING') return '待染色'
  if (task.status === 'COMPLETED') return '已完成'
  return '已删除'
}

function combinedPagination(scope: CombinedHistoryScope, total: number, page: number) {
  const paging = paginateStandardListRows(Array.from({ length: total }, (_, index) => index), page, COMBINED_PAGE_SIZE)
  combinedHistoryPages[scope] = paging.currentPage
  return renderTablePagination({
    total: paging.total,
    from: paging.from,
    to: paging.to,
    currentPage: paging.currentPage,
    totalPages: paging.totalPages,
    pageSize: COMBINED_PAGE_SIZE,
    actionPrefix: 'dye-work-order-combined',
    fieldPrefix: 'dye-work-order-combined',
    pageSizeOptions: [COMBINED_PAGE_SIZE],
  }).replace('<footer ', `<footer data-combined-history-scope="${scope}" `)
}

export function renderDyeWorkOrderCombinedDyeingSection(order: DyeWorkOrder): string {
  const pagination = resolveDyeWorkOrderCombinedHistoryPagination(combinedHistoryOwnerId, order.dyeOrderId, combinedHistoryPages)
  combinedHistoryOwnerId = pagination.ownerId
  Object.assign(combinedHistoryPages, pagination.pages)
  const view = buildDyeWorkOrderCombinedDyeingView(order)
  if (!view) {
    if (order.sourceType !== 'PRODUCTION_ORDER') return ''
    return `<div data-dye-work-order-combined-region data-dye-order-id="${escapeHtml(order.dyeOrderId)}">${renderSection('合并染色', '<div class="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-muted-foreground">尚未加入合并染色</div>')}</div>`
  }
  const activeVersion = view.activeTask?.allocationVersions.find((version) => version.current)
  const activeAllocation = activeVersion?.allocations.find((allocation) => allocation.dyeWorkOrderId === order.dyeOrderId)
  const taskPage = paginateStandardListRows(view.history, combinedHistoryPages.tasks, COMBINED_PAGE_SIZE)
  const versionRows = view.history.flatMap((task) => task.allocationVersions.map((version) => ({ task, version, allocation: version.allocations.find((item) => item.dyeWorkOrderId === order.dyeOrderId) })))
  const versionPage = paginateStandardListRows(versionRows, combinedHistoryPages.versions, COMBINED_PAGE_SIZE)
  const impactPage = paginateStandardListRows(view.changeImpacts, combinedHistoryPages.impacts, COMBINED_PAGE_SIZE)
  const syncPage = paginateStandardListRows(view.autoSyncHistory, combinedHistoryPages.syncs, COMBINED_PAGE_SIZE)
  combinedHistoryPages.tasks = taskPage.currentPage
  combinedHistoryPages.versions = versionPage.currentPage
  combinedHistoryPages.impacts = impactPage.currentPage
  combinedHistoryPages.syncs = syncPage.currentPage
  const currentTask = view.activeTask
    ? `<div class="grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-4">
        <div><span class="text-muted-foreground">当前任务号：</span><button type="button" class="font-mono font-medium text-blue-600 hover:underline" data-dyeing-action="navigate" data-href="/fcs/craft/dyeing/combined-dyeing?taskId=${encodeURIComponent(view.activeTask.taskId)}">${escapeHtml(view.activeTask.taskNo)}</button></div>
        ${renderField('成员状态', '成员已锁定')}
        ${renderField('任务状态', combinedTaskStatusLabel(view.activeTask))}
        ${renderField('需求量', formatDyeQty(view.requiredQty, order.qtyUnit))}
        ${renderField('当前有效分配', formatDyeQty(view.currentEffectiveAllocationQty, order.qtyUnit))}
        ${renderField('满足状态', combinedSatisfactionLabel(view.satisfaction))}
        ${renderField('未满足量', formatDyeQty(view.unmetQty, order.qtyUnit))}
        ${renderField('超出量', formatDyeQty(activeVersion?.excessQty ?? 0, order.qtyUnit))}
      </div>`
    : `<div class="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-muted-foreground">当前没有活动合并染色任务；历史任务、有效分配与删除记录继续保留。</div>`

  const taskTable = renderTable([
    { key: 'taskNo', title: '历史任务', minWidth: '150px', render: (task: CombinedDyeingTask) => `<button type="button" class="font-mono text-blue-600 hover:underline" data-dyeing-action="navigate" data-href="/fcs/craft/dyeing/combined-dyeing?taskId=${encodeURIComponent(task.taskId)}">${escapeHtml(task.taskNo)}</button>` },
    { key: 'status', title: '任务状态', width: '100px', render: (task: CombinedDyeingTask) => escapeHtml(combinedTaskStatusLabel(task)) },
    { key: 'locked', title: '成员', width: '100px', render: () => '成员已锁定' },
    { key: 'deletedAt', title: '删除时间', minWidth: '150px', render: (task: CombinedDyeingTask) => escapeHtml(task.deletedAt || '—') },
    { key: 'deletedBy', title: '删除人', width: '110px', render: (task: CombinedDyeingTask) => escapeHtml(task.deletedBy || '—') },
    { key: 'deleteReason', title: '删除原因', minWidth: '180px', render: (task: CombinedDyeingTask) => escapeHtml(task.deleteReason || '—') },
  ], taskPage.rows, { compact: true, emptyText: '暂无历史任务' })
  const versionTable = renderTable([
    { key: 'task', title: '任务号', minWidth: '140px', render: (row: typeof versionRows[number]) => escapeHtml(row.task.taskNo) },
    { key: 'version', title: '分配版本', width: '100px', render: (row: typeof versionRows[number]) => `第 ${row.version.versionNo} 版${row.version.current ? '（当前）' : ''}` },
    { key: 'input', title: '实际投入', width: '110px', align: 'right' as const, render: (row: typeof versionRows[number]) => formatDyeQty(row.version.actualInputQty, order.qtyUnit) },
    { key: 'output', title: '实际产出', width: '110px', align: 'right' as const, render: (row: typeof versionRows[number]) => formatDyeQty(row.version.actualOutputQty, order.qtyUnit) },
    { key: 'allocated', title: '本单分配', width: '110px', align: 'right' as const, render: (row: typeof versionRows[number]) => formatDyeQty(row.allocation?.allocatedQty ?? 0, order.qtyUnit) },
    { key: 'excess', title: '超出数量', width: '110px', align: 'right' as const, render: (row: typeof versionRows[number]) => formatDyeQty(row.version.excessQty, order.qtyUnit) },
    { key: 'satisfaction', title: '满足状态', width: '100px', render: (row: typeof versionRows[number]) => escapeHtml(combinedSatisfactionLabel(row.allocation?.satisfaction ?? 'UNMET')) },
    { key: 'reason', title: '更正说明', minWidth: '180px', render: (row: typeof versionRows[number]) => escapeHtml(row.version.reason || '—') },
    { key: 'operator', title: '操作人 / 时间', minWidth: '170px', render: (row: typeof versionRows[number]) => `<div>${escapeHtml(row.version.operator)}</div><div class="text-xs text-muted-foreground">${escapeHtml(row.version.operatedAt)}</div>` },
  ], versionPage.rows, { compact: true, emptyText: '尚未登记分配版本' })
  const impactTable = renderTable([
    { key: 'reason', title: '原因', width: '120px', render: (impact: typeof view.changeImpacts[number]) => escapeHtml(impact.reason) },
    { key: 'qty', title: '数量（变更前 → 变更后）', minWidth: '190px', render: (impact: typeof view.changeImpacts[number]) => `${formatDyeQty(impact.before.plannedQty, impact.before.qtyUnit)} → ${formatDyeQty(impact.after.plannedQty, impact.after.qtyUnit)}` },
    { key: 'material', title: '物料（变更前 → 变更后）', minWidth: '240px', render: (impact: typeof view.changeImpacts[number]) => `${escapeHtml(impact.before.materialName)} → ${escapeHtml(impact.after.materialName)}` },
    { key: 'version', title: '技术包版本（变更前 → 变更后）', minWidth: '220px', render: (impact: typeof view.changeImpacts[number]) => `${escapeHtml(impact.before.techPackVersionLabel)} → ${escapeHtml(impact.after.techPackVersionLabel)}` },
    { key: 'action', title: '建议动作', minWidth: '260px', render: (impact: typeof view.changeImpacts[number]) => escapeHtml(impact.suggestedAction) },
    { key: 'recordedAt', title: '记录时间', minWidth: '150px', render: (impact: typeof view.changeImpacts[number]) => escapeHtml(impact.recordedAt) },
  ], impactPage.rows, { compact: true, emptyText: '暂无受保护的生产单变更影响' })
  const syncTable = renderTable([
    { key: 'record', title: '变更记录', minWidth: '160px', render: (record: typeof view.autoSyncHistory[number]) => escapeHtml(record.changeRecordId) },
    { key: 'qty', title: '数量（同步前 → 同步后）', minWidth: '190px', render: (record: typeof view.autoSyncHistory[number]) => `${formatDyeQty(record.before.plannedQty, record.before.qtyUnit)} → ${formatDyeQty(record.after.plannedQty, record.after.qtyUnit)}` },
    { key: 'material', title: '物料（同步前 → 同步后）', minWidth: '240px', render: (record: typeof view.autoSyncHistory[number]) => `${escapeHtml(record.before.materialName)} → ${escapeHtml(record.after.materialName)}` },
    { key: 'version', title: '技术包版本（同步前 → 同步后）', minWidth: '220px', render: (record: typeof view.autoSyncHistory[number]) => `${escapeHtml(record.before.techPackVersionLabel)} → ${escapeHtml(record.after.techPackVersionLabel)}` },
    { key: 'syncedAt', title: '同步时间', minWidth: '150px', render: (record: typeof view.autoSyncHistory[number]) => escapeHtml(record.syncedAt) },
  ], syncPage.rows, { compact: true, emptyText: '暂无自动同步历史' })

  const combinedHistoryContent = view.hasCombinedDyeingHistory
    ? `${currentTask}<section><h3 class="mb-2 font-medium">分配版本 / 更正历史</h3><div class="overflow-x-auto rounded-md border">${versionTable}${combinedPagination('versions', versionRows.length, versionPage.currentPage)}</div></section><section><h3 class="mb-2 font-medium">历史任务与删除历史</h3><div class="overflow-x-auto rounded-md border">${taskTable}${combinedPagination('tasks', view.history.length, taskPage.currentPage)}</div></section>`
    : '<div class="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-muted-foreground">尚未加入合并染色</div>'
  return `<div data-dye-work-order-combined-region data-dye-order-id="${escapeHtml(order.dyeOrderId)}">${renderSection('合并染色', `<div class="space-y-4">${combinedHistoryContent}<section><h3 class="mb-2 font-medium">生产单变更影响</h3><div class="overflow-x-auto rounded-md border">${impactTable}${combinedPagination('impacts', view.changeImpacts.length, impactPage.currentPage)}</div></section><section><h3 class="mb-2 font-medium">未执行自动同步历史</h3><div class="overflow-x-auto rounded-md border">${syncTable}${combinedPagination('syncs', view.autoSyncHistory.length, syncPage.currentPage)}</div></section></div>`)}</div>`
}

export function handleDyeWorkOrderCombinedDetailEvent(target: HTMLElement): boolean {
  const region = target.closest<HTMLElement>('[data-dye-work-order-combined-region]')
  if (!region) return false
  const actionNode = target.closest<HTMLElement>('[data-dye-work-order-combined-action]')
  if (!actionNode) return false
  const scopeValue = actionNode.closest<HTMLElement>('[data-combined-history-scope]')?.dataset.combinedHistoryScope
  const scope = scopeValue === 'tasks' || scopeValue === 'versions' || scopeValue === 'impacts' || scopeValue === 'syncs' ? scopeValue : null
  const action = actionNode.dataset.dyeWorkOrderCombinedAction || ''
  if (!scope || (action !== 'prev-page' && action !== 'next-page')) return false
  combinedHistoryPages[scope] = Math.max(1, combinedHistoryPages[scope] + (action === 'next-page' ? 1 : -1))
  const order = getDyeWorkOrderById(region.dataset.dyeOrderId || '')
  if (!order) return true
  region.outerHTML = renderDyeWorkOrderCombinedDyeingSection(order)
  const nextRegion = document.querySelector<HTMLElement>(`[data-dye-work-order-combined-region][data-dye-order-id="${order.dyeOrderId}"]`)
  if (nextRegion) hydrateIcons(nextRegion)
  return true
}

function renderContinuousWaterSolubleActions(order: DyeWorkOrder): string {
  const role: WaterSolublePdaRoleAction | null = order.status === 'PRODUCTION_PAUSED'
    ? 'SUPERVISE'
    : order.status === 'WAIT_WATER_SOLUBLE' || order.status === 'WATER_SOLUBLE_IN_PROGRESS'
      ? 'OPERATE'
      : null
  const session = getPdaSession()
  if (!role) return ''
  if (!session || validateWaterSolublePdaActor(session, order.dyeFactoryId, role)) {
    return '<p class="mt-3 text-sm text-muted-foreground">当前账号不能执行此动作，请切换对应岗位账号。</p>'
  }
  const attrs = `data-dye-order-id="${escapeHtml(order.dyeOrderId)}" data-task-id="${escapeHtml(order.taskId)}" data-expected-status="${escapeHtml(order.status)}" data-expected-node="WATER_SOLUBLE"`
  if (order.status === 'WAIT_WATER_SOLUBLE') {
    return `<button class="mt-3 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700" data-dyeing-action="start-water-soluble" ${attrs}>开始水溶</button>`
  }
  if (order.status === 'WATER_SOLUBLE_IN_PROGRESS') {
    return `<button class="mt-3 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700" data-dyeing-action="complete-water-soluble" ${attrs}>完成水溶</button>`
  }
  const decisions: Array<[string, string]> = [['CONTINUE_PROCESSING', '继续补做'], ['CONTINUE_WITH_ACTUAL_QTY', '按实际数量继续'], ['RETURN_FOR_REWORK', '退回返工']]
  return `<div class="mt-3 flex flex-wrap gap-2">${decisions.map(([decision, label]) => `<button class="rounded-md border px-3 py-2 text-sm" data-dyeing-action="resolve-water-soluble-pause" data-decision="${decision}" ${attrs}>${label}</button>`).join('')}</div>`
}

function getCurrentDyeDetailTab(): DyeDetailTab {
  const [, queryString = ''] = (appStore.getState().pathname || '').split('?')
  const tab = new URLSearchParams(queryString).get('tab')
  return dyeDetailTabs.some((item) => item.key === tab) ? (tab as DyeDetailTab) : 'base'
}

function renderDetailTabs(orderId: string, activeTab: DyeDetailTab): string {
  const baseHref = buildDyeingWorkOrderDetailLink(orderId)
  return `
    <nav class="inline-flex flex-wrap gap-1 rounded-md bg-muted p-1">
      ${dyeDetailTabs
        .map((item) => {
          const active = item.key === activeTab
          return `
            <button
              type="button"
              class="rounded px-3 py-1.5 text-sm ${active ? 'bg-background font-medium text-foreground shadow-sm' : 'text-muted-foreground hover:bg-background/60 hover:text-foreground'}"
              data-nav="${escapeHtml(`${baseHref}?tab=${item.key}`)}"
            >
              ${escapeHtml(item.label)}
            </button>
          `
        })
        .join('')}
    </nav>
  `
}

function renderField(label: string, value: string): string {
  return `<div><span class="text-muted-foreground">${escapeHtml(label)}：</span><span class="font-medium">${escapeHtml(value || '—')}</span></div>`
}

function renderWebActionPanel(orderId: string, currentStatus: string, actions: ProcessWebAction[], platformStatus: string): string {
  const actionable = actions.filter((action) => !action.disabledReason)
  const disabledReason = actions.find((action) => action.disabledReason)?.disabledReason
  const order = getProcessWorkOrderById(orderId)
  return renderSection(
    '可执行动作',
    `
      <div class="space-y-3">
        <div class="grid gap-3 text-sm md:grid-cols-3">
          ${renderField('当前状态', currentStatus)}
          ${renderField('平台聚合状态', platformStatus)}
          ${renderField('操作方式', '仅展示当前状态允许的下一步动作')}
        </div>
        ${
          actionable.length
            ? `<div class="flex flex-wrap gap-2">
                ${actionable
                  .map(
                    (action) => `
                      <button
                        type="button"
                        class="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100"
                        data-dyeing-action="open-web-status-action-dialog"
                        data-source-id="${escapeHtml(orderId)}"
                        data-action-code="${escapeHtml(action.actionCode)}"
                        data-action-label="${escapeHtml(action.actionLabel)}"
                        data-from-status="${escapeHtml(action.fromStatus)}"
                        data-to-status="${escapeHtml(action.toStatus)}"
                        data-required-fields="${escapeHtml(action.requiredFields.join('|'))}"
                        data-optional-fields="${escapeHtml(action.optionalFields.join('|'))}"
                        data-confirm-text="${escapeHtml(action.confirmText)}"
                        data-object-type="${escapeHtml(order?.objectType || '面料')}"
                        data-object-qty="${escapeHtml(String(order?.plannedQty ?? ''))}"
                        data-qty-unit="${escapeHtml(order?.plannedUnit || '米')}"
                      >
                        ${escapeHtml(action.actionLabel)}
                      </button>
                    `,
                  )
                  .join('')}
              </div>
              <div class="rounded-md border border-dashed bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                操作弹窗字段：${escapeHtml(actionable[0].requiredFields.join('、'))}；确认后写回统一事实源并生成操作记录。
              </div>`
            : `<div class="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">${escapeHtml(disabledReason || '当前状态暂无可执行动作')}</div>`
        }
      </div>
    `,
  )
}

function renderWebOperationRecords(records: ProcessWebOperationRecord[]): string {
  return renderSection(
    '操作记录',
    `
      <div class="overflow-x-auto">
        <table class="min-w-full text-left text-sm">
          <thead class="bg-slate-50 text-xs text-muted-foreground">
            <tr>
              <th class="px-3 py-2 font-medium">操作动作</th>
              <th class="px-3 py-2 font-medium">前状态</th>
              <th class="px-3 py-2 font-medium">后状态</th>
              <th class="px-3 py-2 font-medium">操作人</th>
              <th class="px-3 py-2 font-medium">操作时间</th>
              <th class="px-3 py-2 font-medium">操作对象数量和单位</th>
              <th class="px-3 py-2 font-medium">来源</th>
              <th class="px-3 py-2 font-medium">备注</th>
            </tr>
          </thead>
          <tbody>
            ${
              records.length
                ? records
                    .map(
                      (record) => `
                        <tr class="border-b last:border-b-0">
                          <td class="px-3 py-3 text-sm">${escapeHtml(record.actionLabel)}</td>
                          <td class="px-3 py-3 text-sm">${escapeHtml(record.previousStatus)}</td>
                          <td class="px-3 py-3 text-sm">${escapeHtml(record.nextStatus)}</td>
                          <td class="px-3 py-3 text-sm">${escapeHtml(record.operatorName)}</td>
                          <td class="px-3 py-3 text-sm">${escapeHtml(record.operatedAt)}</td>
                          <td class="px-3 py-3 text-sm">
                            <div class="text-xs text-muted-foreground">${escapeHtml(record.qtyLabel)}</div>
                            <div>${formatDyeQty(record.objectQty, record.qtyUnit)}</div>
                          </td>
                          <td class="px-3 py-3 text-sm">${escapeHtml(record.sourceChannel)}</td>
                          <td class="px-3 py-3 text-sm">${escapeHtml(record.remark || '—')}</td>
                        </tr>
                      `,
                    )
                    .join('')
                : '<tr><td class="px-3 py-8 text-center text-sm text-muted-foreground" colspan="8">暂无操作记录</td></tr>'
            }
          </tbody>
        </table>
      </div>
    `,
  )
}

function renderNodeTable(orderId: string): string {
  const order = getProcessWorkOrderById(orderId)
  if (!order) return ''
  const rows = order.executionNodes
    .map((node) => `
      <tr class="border-b last:border-b-0">
        <td class="px-3 py-3 text-sm">${escapeHtml(node.nodeName)}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(formatDyeTime(node.startedAt))}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(formatDyeTime(node.finishedAt))}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(node.operatorName || '—')}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml('dyeVatNo' in node ? node.dyeVatNo || '—' : '—')}</td>
        <td class="px-3 py-3 text-sm">${formatDyeQty('outputQty' in node ? node.outputQty : undefined, order.plannedUnit)}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(node.remark || '—')}</td>
      </tr>
    `)
    .join('')

  return `
    <div class="overflow-x-auto">
      <table class="min-w-full text-left text-sm">
        <thead class="bg-slate-50 text-xs text-muted-foreground">
          <tr>
            <th class="px-3 py-2 font-medium">节点</th>
            <th class="px-3 py-2 font-medium">开始时间</th>
            <th class="px-3 py-2 font-medium">结束时间</th>
            <th class="px-3 py-2 font-medium">操作人</th>
            <th class="px-3 py-2 font-medium">染缸</th>
            <th class="px-3 py-2 font-medium">完成面料米数</th>
            <th class="px-3 py-2 font-medium">备注</th>
          </tr>
        </thead>
        <tbody>${rows || '<tr><td class="px-3 py-8 text-center text-sm text-muted-foreground" colspan="7">暂无执行记录</td></tr>'}</tbody>
      </table>
    </div>
  `
}

function renderReviewStatusLabel(status: unknown): string {
  if (status === 'FULL_HANDOVER') return '全部交出'
  if (status === 'PARTIAL_HANDOVER') return '部分交出'
  if (status === 'HANDOVER_DIFFERENCE') return '收货差异'
  if (status === 'WAIT_RECEIVE' || status === 'HANDOVER_WAIT_RECEIVE') return '交出待收货'
  return '—'
}

function resolveDifferenceAction(): { differenceId: string; action: string } | undefined {
  const [, queryString = ''] = (appStore.getState().pathname || '').split('?')
  const params = new URLSearchParams(queryString)
  const differenceId = params.get('differenceId') || ''
  const action = params.get('differenceAction') || ''
  return differenceId && action ? { differenceId, action } : undefined
}

function applyDifferenceActionFromUrl(): void {
  const input = resolveDifferenceAction()
  if (!input) return
  const actionMap: Record<string, Parameters<typeof handleProcessHandoverDifference>[1]['nextAction']> = {
    confirm: '确认差异继续流转',
    rework: '要求重新交出',
    close: '关闭记录',
    processing: '平台处理',
  }
  const nextAction = actionMap[input.action]
  if (!nextAction) return
  handleProcessHandoverDifference(input.differenceId, {
    handlingResult: nextAction,
    responsibilitySide: nextAction === '确认差异继续流转' ? '非工厂责任' : '待判定',
    nextAction,
    handledBy: '平台处理员',
    remark: '染色交出差异处理',
  })
}

function applyWebActionFromUrl(orderId: string): void {
  const [, queryString = ''] = (appStore.getState().pathname || '').split('?')
  const params = new URLSearchParams(queryString)
  const actionCode = params.get('webAction') || ''
  if (!actionCode) return
  const actionKey = `${orderId}:${actionCode}`
  if (consumedWebActionKeys.has(actionKey)) return
  consumedWebActionKeys.add(actionKey)
  try {
    executeProcessWebAction({
      sourceType: 'DYE_WORK_ORDER',
      sourceId: orderId,
      actionCode,
      operatorName: 'Web 端操作员',
      operatedAt: '2026-04-28 10:00',
      remark: '工艺工厂 Web 端状态操作',
    })
  } catch {
    // 页面仍展示当前可操作原因；失败不写入事实源。
  }
}

function renderDifferenceRows(records: ProcessHandoverDifferenceRecord[], orderId: string): string {
  const baseHref = `${buildDyeingWorkOrderDetailLink(orderId)}?tab=exception`
  return records
    .map((record) => `
      <tr class="border-b last:border-b-0">
        <td class="px-3 py-3 font-mono text-xs">${escapeHtml(record.differenceRecordNo)}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(record.differenceType)}</td>
        <td class="px-3 py-3 text-sm">${formatDyeQty(record.expectedObjectQty, record.qtyUnit)}</td>
        <td class="px-3 py-3 text-sm">${formatDyeQty(record.actualObjectQty, record.qtyUnit)}</td>
        <td class="px-3 py-3 text-sm">${formatDyeQty(record.diffObjectQty, record.qtyUnit)}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(record.status)}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(record.handlingResult || record.nextAction || '待平台处理')}</td>
        <td class="px-3 py-3">
          <div class="flex flex-wrap gap-2">
            <button class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-nav="${escapeHtml(`${baseHref}&differenceId=${record.differenceRecordId}&differenceAction=confirm`)}">确认差异继续流转</button>
            <button class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-nav="${escapeHtml(`${baseHref}&differenceId=${record.differenceRecordId}&differenceAction=rework`)}">要求重新交出</button>
            <button class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-nav="${escapeHtml(`${baseHref}&differenceId=${record.differenceRecordId}&differenceAction=processing`)}">标记平台处理中</button>
            <button class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-nav="${escapeHtml(`${baseHref}&differenceId=${record.differenceRecordId}&differenceAction=close`)}">关闭记录</button>
            <button class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-nav="${escapeHtml(buildHandoverDifferenceRequestPrintLink(record.differenceRecordId))}">打印差异处理申请单</button>
          </div>
        </td>
      </tr>
    `)
    .join('')
}

export function renderCraftDyeingWorkOrderDetailPage(dyeOrderId: string): string {
  applyDifferenceActionFromUrl()
  applyWebActionFromUrl(dyeOrderId)
  const order = getProcessWorkOrderById(dyeOrderId) || getProcessWorkOrderByNo(dyeOrderId)
  if (!order || order.processType !== 'DYE' || !order.dyePayload) {
    const domainOrder = getDyeWorkOrderById(dyeOrderId)
    if (domainOrder) {
      const waterNode = listDyeExecutionNodeRecords(domainOrder.dyeOrderId).find((node) => node.nodeCode === 'WATER_SOLUBLE')
      const planned = domainOrder.waterSolublePlannedQty ?? domainOrder.plannedQty
      const completed = domainOrder.waterSolubleCompletedQty ?? Number(waterNode?.outputQty || 0)
      const unit = domainOrder.waterSolubleQtyUnit || domainOrder.qtyUnit
      const diff = completed - planned
      return `
        <div class="space-y-4 p-4">
          ${renderPageHeader('染色加工单详情', domainOrder.requiresWaterSoluble ? '同一染厂连续完成水溶与染色' : '普通染色加工单')}
          ${renderSection('基本信息', `<div class="grid gap-3 text-sm md:grid-cols-2">
            ${renderField('加工单号', domainOrder.dyeOrderNo)}
            ${renderField('工厂', formatFactoryDisplayName(domainOrder.dyeFactoryName, domainOrder.dyeFactoryId))}
            ${renderField('当前步骤', getDyeCurrentStepLabel(domainOrder))}
            ${renderField('工艺路线', domainOrder.requiresWaterSoluble ? '水溶 → 染色 → 既有后处理' : '染色 → 既有后处理')}
            ${renderField('计划染色数量', `${domainOrder.plannedQty} ${domainOrder.qtyUnit}`)}
            ${renderField('交接口径', domainOrder.requiresWaterSoluble ? '水溶完成后不交出，染色及后处理完成后统一交出' : '后处理完成后统一交出')}
          </div>`)}
          ${domainOrder.requiresWaterSoluble ? renderSection('水溶前置', `<div class="grid gap-3 text-sm md:grid-cols-2">
            ${renderField('水溶计划数量', `${planned} ${unit}`)}
            ${renderField('水溶完成数量', `${completed} ${unit}`)}
            ${renderField('水溶差异', `${diff > 0 ? '多' : diff < 0 ? '少' : '一致'}${diff === 0 ? '' : ` ${Math.abs(diff)} ${unit}`}`)}
            ${renderField('连续加工', '同一家染厂完成，水溶完成数量为染色投入上限')}
          </div>${renderContinuousWaterSolubleActions(domainOrder)}`) : ''}
          ${renderDyeWorkOrderCombinedDyeingSection(domainOrder)}
          <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-nav="/fcs/craft/dyeing/work-orders">返回染色加工单</button>
        </div>
      `
    }
    return `
      <div class="space-y-4 p-4">
        ${renderPageHeader('染色加工单详情', '未找到对应的染色加工单')}
        <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-nav="/fcs/craft/dyeing/work-orders">返回染色加工单</button>
      </div>
    `
  }

  const dye = order.dyePayload
  const domainOrder = getDyeWorkOrderById(dye.dyeOrderId)
  const sampleNode = order.executionNodes.find((node) => node.nodeName === '打样')
  const materialNode = order.executionNodes.find((node) => node.nodeName === '备料')
  const vatNode = order.executionNodes.find((node) => node.nodeName.includes('排'))
  const dyeNode = order.executionNodes.find((node) => node.nodeName === '染色')
  const waterNode = order.executionNodes.find((node) => node.nodeName === '水溶')
  const afterNodes = order.executionNodes.filter((node) => ['脱水', '烘干', '定型', '打卷', '包装'].includes(node.nodeName))
  const processHandoverRecords = getHandoverRecordsByWorkOrderId(order.workOrderId)
  const processReviewRecords = getReviewRecordsByWorkOrderId(order.workOrderId)
  const processDifferenceRecords = getDifferenceRecordsByWorkOrderId(order.workOrderId)
  const dyeStatistics = getDyeingExecutionStatistics({ workOrderId: order.workOrderId })
  const formulaRows = dye.formulaRecords
    .flatMap((formula) =>
      formula.lines.map((line) => `
        <tr class="border-b last:border-b-0">
          <td class="px-3 py-3 text-sm">${escapeHtml(formula.formulaNo)}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(formula.formulaName)}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(line.materialName)}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(line.materialCode)}</td>
          <td class="px-3 py-3 text-sm">${line.feedQty} ${escapeHtml(line.feedUnit)}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(line.note || formula.remark || '—')}</td>
        </tr>
      `),
    )
    .join('')
  const handoverRows = processHandoverRecords
    .map((record) => `
      <tr class="border-b last:border-b-0">
        <td class="px-3 py-3 font-mono text-xs">${escapeHtml(record.handoverRecordNo || record.handoverRecordId)}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(record.handoverAt)}</td>
        <td class="px-3 py-3 text-sm">${formatDyeQty(record.handoverObjectQty, record.qtyUnit)}</td>
        <td class="px-3 py-3 text-sm">${formatDyeQty(record.receiveObjectQty, record.qtyUnit)}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(record.receiveAt || '—')}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(record.remark || record.status || '—')}</td>
      </tr>
    `)
    .join('')
  const reviewRows = processReviewRecords
    .map((review) => `
      <tr class="border-b last:border-b-0">
        <td class="px-3 py-3 text-sm">${escapeHtml(renderReviewStatusLabel(review.reviewStatus))}</td>
        <td class="px-3 py-3 text-sm">${formatDyeQty(review.expectedObjectQty, review.qtyUnit)}</td>
        <td class="px-3 py-3 text-sm">${formatDyeQty(review.actualObjectQty, review.qtyUnit)}</td>
        <td class="px-3 py-3 text-sm">${formatDyeQty(review.diffObjectQty, review.qtyUnit)}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(review.reviewerName || '待收货确认')}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(review.reviewedAt || '—')}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(review.reason || review.nextAction || '—')}</td>
      </tr>
    `)
    .join('')

  const activeTab = getCurrentDyeDetailTab()
  const afterNodeText = afterNodes
    .map((node) => `${node.nodeName}：${formatDyeTime(node.startedAt)} 至 ${formatDyeTime(node.finishedAt)}，${node.operatorName || '—'}，${formatDyeQty('outputQty' in node ? node.outputQty : undefined, order.plannedUnit)}`)
    .join('；') || '—'
  const mobileBinding = validateDyeWorkOrderMobileTaskBinding(order.dyeOrderId || order.workOrderId)
  const mobileBindingTaskNo = mobileBinding.actualTaskNo || mobileBinding.expectedTaskNo || '未绑定'
  const mobileBindingStatus = mobileBinding.canOpenMobileExecution ? '有效' : '不可执行'
  const mobileBindingReasonLabel =
    mobileBinding.reasonCode === 'TASK_NOT_VISIBLE_IN_MOBILE_LIST'
      ? '移动端执行列表不可见，请检查工厂或任务状态'
      : mobileBinding.reasonLabel
  const mobileExecutionTask = mobileBinding.actualTaskId ? getMobileExecutionTaskById(mobileBinding.actualTaskId) : null
  const mobileExecutionLink =
    mobileBinding.canOpenMobileExecution && mobileExecutionTask
      ? buildTaskDetailLink(mobileBinding.actualTaskId || order.taskId, {
          returnTo: buildMobileExecutionListLocatePathForTask(mobileExecutionTask, {
            currentFactoryId: order.factoryId || 'F090',
            keyword: order.workOrderNo || order.dyeOrderNo,
          }),
          sourceType: 'DYE_WORK_ORDER',
          sourceId: order.dyeOrderId || order.workOrderId,
          currentFactoryId: order.factoryId || 'F090',
          keyword: order.workOrderNo || order.dyeOrderNo,
        })
      : ''
  const webActions = getAvailableDyeWebActions(order.workOrderId)
  const webOperationRecords = getUnifiedOperationRecordsForProcessWorkOrder('DYE_WORK_ORDER', order.workOrderId, order.taskId)
  const platformStatus = getPlatformStatusForProcessWorkOrder(order)
  const startPrerequisite = getStartPrerequisiteByTaskId(order.taskId)
  const sections: Record<DyeDetailTab, string> = {
    base: renderSection(
      '基本信息',
      `
        <div class="grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-3">
          ${renderField('加工单号', order.workOrderNo)}
          ${renderSourceFields(order)}
          ${renderField('工厂', formatFactoryDisplayName(order.factoryName, order.factoryId))}
          ${renderField('分配方式', order.assignmentMode || '派单')}
          ${renderField('派单价格', order.dispatchPriceDisplay || '1500 IDR/Yard')}
          ${renderField('原料面料 SKU', dye.rawMaterialSku)}
          ${renderField('成分', dye.composition || '—')}
          ${renderField('幅宽', dye.width || '—')}
          ${renderField('克重', dye.weightGsm ? `${dye.weightGsm} 克/平方米` : '—')}
          ${renderField('目标颜色', dye.targetColor)}
          ${renderField('计划染色面料米数', `${order.plannedQty} ${order.plannedUnit}`)}
          <div><span class="text-muted-foreground">当前状态：</span>${renderBadge(order.statusLabel, 'info')}</div>
          ${renderField('首单/翻单', dye.isFirstOrder ? '首单' : '翻单')}
          ${renderField('移动端执行任务引用', `${order.taskNo} / ${order.taskId}`)}
          ${renderField('移动端执行任务号', mobileBindingTaskNo)}
          ${renderField('绑定状态', mobileBindingStatus)}
          ${renderField('校验结果', mobileBinding.canOpenMobileExecution ? '允许打开移动端执行页' : '当前不可执行')}
          ${renderField('不可执行原因', mobileBindingReasonLabel)}
          ${renderField('开工准备状态', startPrerequisite?.statusLabel || '按加工单状态判断')}
          ${renderField('开工前置口径', startPrerequisite?.conditionLabel || '染色加工单已接单')}
          ${renderField('实际染色前要求', '必须确认坯布和染化料到位')}
          ${domainOrder?.requiresWaterSoluble ? renderField('工艺路线', '水溶 → 染色 → 既有后处理（同厂连续加工）') : ''}
          ${domainOrder?.requiresWaterSoluble ? renderField('中间交出', '无；完成染色及后处理后统一交出') : ''}
          ${renderField('移动端交出记录引用', order.handoverOrderNo || order.handoverOrderId || '未生成')}
        </div>
      `,
    ),
    sample: renderSection(
      '打样备料',
      `
        <div class="grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-4">
          ${renderField('是否等待样衣', dye.sampleWaitType === 'NONE' ? '否' : '是')}
          ${renderField('是否等待原料', order.status === 'WAIT_MATERIAL' ? '是' : '否')}
          ${renderField('打样开始时间', formatDyeTime(sampleNode?.startedAt))}
          ${renderField('打样完成时间', formatDyeTime(sampleNode?.finishedAt))}
          ${renderField('色号', dye.colorNo || '待确认')}
          ${renderField('备料完成时间', formatDyeTime(materialNode?.finishedAt))}
          ${renderField('备料备注', materialNode?.remark || '—')}
        </div>
      `,
    ),
    execution: renderSection(
      '染缸执行',
      `
        <div class="grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-4">
          ${renderField('染缸号', 'dyeVatNo' in (vatNode || {}) ? String(vatNode?.dyeVatNo || '—') : '—')}
          ${renderField('排缸时间', formatDyeTime(vatNode?.finishedAt))}
          ${renderField('染色开始时间', formatDyeTime(dyeNode?.startedAt))}
          ${renderField('染色完成时间', formatDyeTime(dyeNode?.finishedAt))}
          ${renderField('脱水/烘干/定型/打卷/包装', afterNodeText)}
          ${renderField('染色完成面料米数', formatDyeQty('outputQty' in (dyeNode || {}) ? dyeNode?.outputQty : undefined, order.plannedUnit))}
          ${domainOrder?.requiresWaterSoluble ? renderField('水溶计划数量', formatDyeQty(domainOrder.waterSolublePlannedQty, domainOrder.waterSolubleQtyUnit || order.plannedUnit)) : ''}
          ${domainOrder?.requiresWaterSoluble ? renderField('水溶完成数量', formatDyeQty(domainOrder.waterSolubleCompletedQty, domainOrder.waterSolubleQtyUnit || order.plannedUnit)) : ''}
          ${domainOrder?.requiresWaterSoluble ? renderField('水溶差异', `${(domainOrder.waterSolubleCompletedQty || 0) - (domainOrder.waterSolublePlannedQty || domainOrder.plannedQty)} ${domainOrder.waterSolubleQtyUnit || order.plannedUnit}`) : ''}
          ${domainOrder?.requiresWaterSoluble ? renderField('水溶执行记录', waterNode ? `${formatDyeTime(waterNode.startedAt)} 至 ${formatDyeTime(waterNode.finishedAt)}` : '待执行') : ''}
        </div>
      `,
    ),
    formula: renderSection(
      '染色配方',
      `
        <p class="mb-3 text-sm text-muted-foreground">染色配方是染色加工单下的子信息，不是独立主单。</p>
        <div class="overflow-x-auto">
          <table class="min-w-full text-left text-sm">
            <thead class="bg-slate-50 text-xs text-muted-foreground">
              <tr>
                <th class="px-3 py-2 font-medium">配方号</th>
                <th class="px-3 py-2 font-medium">配方名称</th>
                <th class="px-3 py-2 font-medium">染料/助剂</th>
                <th class="px-3 py-2 font-medium">编码</th>
                <th class="px-3 py-2 font-medium">投料</th>
                <th class="px-3 py-2 font-medium">备注</th>
              </tr>
            </thead>
            <tbody>${formulaRows || '<tr><td class="px-3 py-8 text-center text-sm text-muted-foreground" colspan="6">暂无染色配方</td></tr>'}</tbody>
          </table>
        </div>
      `,
    ),
    handover: renderSection(
      '交出记录',
      `
        <div class="mb-3 grid gap-3 text-sm md:grid-cols-3">
          ${renderField('接收方', dye.targetTransferWarehouseName)}
          ${renderField('交出单', order.handoverOrderNo || order.handoverOrderId || '未生成')}
          ${renderField('交出记录数', `${processHandoverRecords.length} 条`)}
        </div>
        <div class="overflow-x-auto">
          <table class="min-w-full text-left text-sm">
            <thead class="bg-slate-50 text-xs text-muted-foreground">
              <tr>
                <th class="px-3 py-2 font-medium">交出记录</th>
                <th class="px-3 py-2 font-medium">提交时间</th>
                <th class="px-3 py-2 font-medium">交出面料米数</th>
                <th class="px-3 py-2 font-medium">实收面料米数</th>
                <th class="px-3 py-2 font-medium">收货时间</th>
                <th class="px-3 py-2 font-medium">备注</th>
              </tr>
            </thead>
            <tbody>${handoverRows || '<tr><td class="px-3 py-8 text-center text-sm text-muted-foreground" colspan="6">暂无交出记录</td></tr>'}</tbody>
          </table>
        </div>
      `,
    ),
    review: renderSection(
      '收货确认',
      `
        <div class="overflow-x-auto">
          <table class="min-w-full text-left text-sm">
            <thead class="bg-slate-50 text-xs text-muted-foreground">
              <tr>
                <th class="px-3 py-2 font-medium">收货状态</th>
                <th class="px-3 py-2 font-medium">交出面料米数</th>
                <th class="px-3 py-2 font-medium">实收面料米数</th>
                <th class="px-3 py-2 font-medium">差异面料米数</th>
                <th class="px-3 py-2 font-medium">收货确认人</th>
                <th class="px-3 py-2 font-medium">收货确认时间</th>
                <th class="px-3 py-2 font-medium">备注</th>
              </tr>
            </thead>
            <tbody>${reviewRows || '<tr><td class="px-3 py-8 text-center text-sm text-muted-foreground" colspan="7">暂无收货确认记录</td></tr>'}</tbody>
          </table>
        </div>
      `,
    ),
    statistics: renderSection(
      '染色统计',
      `
        <div class="mb-4 grid gap-3 md:grid-cols-3">
          <div class="rounded-xl border bg-slate-50/60 p-3">
            <div class="text-xs text-muted-foreground">有差异交出记录数</div>
            <div class="mt-1 text-lg font-semibold">${dyeStatistics.differenceHandoverCount}</div>
          </div>
          <div class="rounded-xl border bg-slate-50/60 p-3">
            <div class="text-xs text-muted-foreground">交出面料米数</div>
            <div class="mt-1 text-lg font-semibold">${formatDyeQty(dyeStatistics.handedOverFabricMeters, order.plannedUnit)}</div>
          </div>
          <div class="rounded-xl border bg-slate-50/60 p-3">
            <div class="text-xs text-muted-foreground">实收面料米数</div>
            <div class="mt-1 text-lg font-semibold">${formatDyeQty(dyeStatistics.receivedFabricMeters, order.plannedUnit)}</div>
          </div>
          <div class="rounded-xl border bg-slate-50/60 p-3">
            <div class="text-xs text-muted-foreground">染色完成面料米数</div>
            <div class="mt-1 text-lg font-semibold">${formatDyeQty(dyeStatistics.dyeCompletedFabricMeters, order.plannedUnit)}</div>
          </div>
          <div class="rounded-xl border bg-slate-50/60 p-3">
            <div class="text-xs text-muted-foreground">包装完成面料米数</div>
            <div class="mt-1 text-lg font-semibold">${formatDyeQty(dyeStatistics.finalPackedFabricMeters, order.plannedUnit)}</div>
          </div>
          <div class="rounded-xl border bg-slate-50/60 p-3">
            <div class="text-xs text-muted-foreground">差异面料米数</div>
            <div class="mt-1 text-lg font-semibold">${formatDyeQty(dyeStatistics.diffFabricMeters, order.plannedUnit)}</div>
          </div>
        </div>
        ${renderNodeTable(order.workOrderId)}
      `,
    ),
    exception: renderSection(
      '染色交出差异处理',
      `
        <p class="mb-3 text-sm text-muted-foreground">染色交出差异只写入统一差异记录；本次不直接生成返工扣款流水、对账流水或结算流水。</p>
        <div class="overflow-x-auto">
          <table class="min-w-full text-left text-sm">
            <thead class="bg-slate-50 text-xs text-muted-foreground">
              <tr>
                <th class="px-3 py-2 font-medium">差异记录</th>
                <th class="px-3 py-2 font-medium">差异类型</th>
                <th class="px-3 py-2 font-medium">交出面料米数</th>
                <th class="px-3 py-2 font-medium">实收面料米数</th>
                <th class="px-3 py-2 font-medium">差异面料米数</th>
                <th class="px-3 py-2 font-medium">差异状态</th>
                <th class="px-3 py-2 font-medium">处理结果</th>
                <th class="px-3 py-2 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>${renderDifferenceRows(processDifferenceRecords, order.workOrderId) || '<tr><td class="px-3 py-8 text-center text-sm text-muted-foreground" colspan="8">暂无数量差异记录</td></tr>'}</tbody>
          </table>
        </div>
      `,
    ),
  }

  return `
    <div class="space-y-4 p-4">
      ${renderPageHeader(
        '染色加工单详情',
        'Web 端查看加工单主详情；染色配方和染色统计都是加工单下的信息视图。',
        `
          <div class="flex flex-wrap gap-2">
            <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-nav="/fcs/craft/dyeing/work-orders">返回染色加工单</button>
            ${
              mobileBinding.canOpenMobileExecution
                ? `<button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-nav="${escapeHtml(mobileExecutionLink)}">打开移动端执行页</button>`
                : '<button class="rounded-md border px-3 py-2 text-sm opacity-50" disabled>打开移动端执行页</button>'
            }
            ${
              order.handoverOrderId
                ? `<button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-nav="${escapeHtml(buildHandoverOrderLink(order.handoverOrderId))}">打开移动端交出页</button>`
                : '<button class="rounded-md border px-3 py-2 text-sm opacity-50" disabled>打开移动端交出页</button>'
            }
            ${
              mobileBinding.canOpenMobileExecution
                ? `<span class="inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">绑定状态：${escapeHtml(mobileBindingStatus)}</span>`
                : `<span class="inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">不可执行：${escapeHtml(mobileBindingReasonLabel)}</span>`
            }
          </div>
        `,
      )}

      ${renderDetailTabs(order.workOrderId, activeTab)}
      ${renderWebActionPanel(order.workOrderId, order.statusLabel, webActions, platformStatus.platformStatusLabel)}
      ${sections[activeTab]}
      ${domainOrder ? renderDyeWorkOrderCombinedDyeingSection(domainOrder) : ''}
      ${renderWebOperationRecords(webOperationRecords)}
    </div>
  `
}
