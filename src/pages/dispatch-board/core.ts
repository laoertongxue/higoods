import {
  state,
  getVisibleRows,
  getExceptionTaskIds,
  deriveKanbanCol,
  isAffectedByTaskSet,
  getDispatchDialogTasks,
  getCreateTenderTask,
  getViewTenderTask,
  getPriceSnapshotTask,
  getFactoryOptions,
  isRuntimeSewingTask,
  createDefaultAutoDispatchConfig,
  getAutoDispatchConfigKeyFromTask,
  escapeHtml,
  type DispatchTask,
} from './context.ts'
import { renderDirectDispatchDialog } from './dispatch-domain.ts'
import {
  renderCreateTenderSheet,
  renderViewTenderSheet,
  renderPriceSnapshotSheet,
} from './tender-domain.ts'
import { renderListView } from './board-domain.ts'
import { listProcessCraftDictRows, type ProcessCraftDictRow } from '../../data/fcs/process-craft-dict.ts'

interface AutoDispatchConfigRow {
  configKey: string
  processCode: string
  processNameZh: string
  craftCode: string
  craftName: string
  label: string
  unassignedCount: number
}

const dispatchListTabs: Array<{ key: typeof state.listTab; label: string; tone: string }> = [
  { key: 'UNASSIGNED', label: '待分配', tone: 'text-gray-700' },
  { key: 'AWAIT_AWARD', label: '待定标', tone: 'text-purple-700' },
  { key: 'BIDDING', label: '竞价中', tone: 'text-orange-700' },
  { key: 'DIRECT_ASSIGNED', label: '已直接派单', tone: 'text-blue-700' },
  { key: 'AWARDED', label: '已定标', tone: 'text-green-700' },
  { key: 'HOLD', label: '暂不分配', tone: 'text-slate-700' },
  { key: 'EXCEPTION', label: '分配异常', tone: 'text-red-700' },
  { key: 'ALL', label: '全部', tone: 'text-foreground' },
]

function getDispatchListTabKey(task: DispatchTask, exceptionTaskIds: Set<string>): typeof state.listTab {
  return deriveKanbanCol(task, isAffectedByTaskSet(task, exceptionTaskIds)) as typeof state.listTab
}

function getDispatchListTabCounts(
  rows: DispatchTask[],
  exceptionTaskIds: Set<string>,
): Record<typeof state.listTab, number> {
  const counts = dispatchListTabs.reduce(
    (result, tab) => {
      result[tab.key] = 0
      return result
    },
    {} as Record<typeof state.listTab, number>,
  )

  for (const task of rows) {
    counts[getDispatchListTabKey(task, exceptionTaskIds)] += 1
  }
  counts.ALL = rows.length
  return counts
}

function renderDispatchListTabs(counts: Record<typeof state.listTab, number>): string {
  return `
    <section class="flex gap-2 overflow-x-auto rounded-lg border bg-card p-2" data-dispatch-list-tabs="true">
      ${dispatchListTabs
        .map((tab) => {
          const active = state.listTab === tab.key
          const exceptionTone = tab.key === 'EXCEPTION'
          return `
            <button
              class="inline-flex shrink-0 items-center gap-2 rounded-md border px-3 py-2 text-sm transition ${
                active ? 'border-blue-200 bg-blue-50 text-blue-700 shadow-sm' : 'border-transparent hover:bg-muted'
              }"
              data-dispatch-action="switch-list-tab"
              data-tab="${tab.key}"
            >
              <span class="font-medium">${escapeHtml(tab.label)}</span>
              <span class="rounded-full px-2 py-0.5 text-xs font-semibold ${
                exceptionTone
                  ? 'bg-red-100 text-red-700'
                  : active
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-muted text-muted-foreground'
              }">${counts[tab.key]}</span>
            </button>
          `
        })
        .join('')}
    </section>
  `
}

function getAutoDispatchConfigRows(rows: DispatchTask[]): AutoDispatchConfigRow[] {
  const unassignedCountByKey = rows
    .filter((task) => !isRuntimeSewingTask(task) && task.assignmentStatus === 'UNASSIGNED')
    .reduce((result, task) => {
      const configKey = getAutoDispatchConfigKeyFromTask(task)
      result.set(configKey, (result.get(configKey) ?? 0) + 1)
      return result
    }, new Map<string, number>())

  const dictionaryRows = listProcessCraftDictRows()
    .filter((row) => row.generatesExternalTask && row.processCode !== 'SEW' && row.processName !== '车缝')
    .sort(sortAutoDispatchDictionaryRows)

  const configRows = dictionaryRows.map((row) => {
    const configKey = `${row.processCode}::${row.craftCode}`
    return {
      configKey,
      processCode: row.processCode,
      processNameZh: row.processName,
      craftCode: row.craftCode,
      craftName: row.craftName,
      label: `${row.processName} / ${row.craftName}`,
      unassignedCount: unassignedCountByKey.get(configKey) ?? 0,
    }
  })

  for (const item of configRows) {
    state.autoDispatchConfigs[item.configKey] ??= createDefaultAutoDispatchConfig()
  }

  return configRows
}

function sortAutoDispatchDictionaryRows(left: ProcessCraftDictRow, right: ProcessCraftDictRow): number {
  const processCompare = left.processName.localeCompare(right.processName, 'zh-CN')
  if (processCompare !== 0) return processCompare
  return left.craftName.localeCompare(right.craftName, 'zh-CN')
}

function renderAutoDispatchToolbar(): string {
  return `
    <div class="flex flex-wrap items-center justify-end gap-2">
      ${
        state.autoAssignDone
          ? '<span class="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-xs text-green-700"><i data-lucide="check-circle-2" class="h-3.5 w-3.5"></i>已执行</span>'
          : ''
      }
      <button class="h-9 rounded-md border px-3 text-sm hover:bg-muted" data-dispatch-action="open-auto-config">自动分配配置</button>
      <button class="h-9 rounded-md bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700" data-dispatch-action="run-auto-assign">执行自动分配</button>
    </div>
  `
}

function renderAutoAssignMessage(): string {
  if (!state.autoAssignMessage) return ''
  const feedback = state.autoAssignFeedback
  if (!feedback) {
    return `
      <section class="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
        ${escapeHtml(state.autoAssignMessage)}
      </section>
    `
  }

  const skippedBadges = [
    feedback.skippedSewingCount > 0 ? `车缝任务跳过 ${feedback.skippedSewingCount} 条` : '',
    feedback.skippedMissingConfigCount > 0 ? `未启用或未配置工厂跳过 ${feedback.skippedMissingConfigCount} 条` : '',
    feedback.skippedFailedCount > 0 ? `分配失败 ${feedback.skippedFailedCount} 条` : '',
  ].filter(Boolean)

  return `
    <section class="space-y-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
      <div class="flex flex-wrap items-center gap-2">
        <span class="font-medium">${escapeHtml(state.autoAssignMessage)}</span>
        <span class="rounded-full bg-white px-2 py-0.5 text-xs text-blue-700">执行时间：${escapeHtml(feedback.executedAt)}</span>
      </div>
      <div class="flex flex-wrap gap-2">
        <span class="rounded-full bg-white px-2 py-0.5 text-xs text-green-700">已分配 ${feedback.assignedCount} 条</span>
        <span class="rounded-full bg-white px-2 py-0.5 text-xs text-amber-700">跳过 ${feedback.skippedCount} 条</span>
        ${skippedBadges.map((badge) => `<span class="rounded-full bg-white px-2 py-0.5 text-xs text-slate-700">${escapeHtml(badge)}</span>`).join('')}
      </div>
      <div class="space-y-1">
        <div class="text-xs font-medium text-blue-900">工序工艺分布</div>
        ${
          feedback.processSummaries.length > 0
            ? `<div class="flex flex-wrap gap-2">
                ${feedback.processSummaries
                  .map(
                    (item) =>
                      `<span class="rounded-full border border-blue-200 bg-white px-2 py-0.5 text-xs">${escapeHtml(item.label)}：${item.count} 条</span>`,
                  )
                  .join('')}
              </div>`
            : '<div class="text-xs text-blue-700">本次没有命中可自动分配的未分配任务。</div>'
        }
      </div>
    </section>
  `
}

function renderAutoDispatchConfigDialog(rows: DispatchTask[]): string {
  if (!state.autoDispatchConfigOpen) return ''
  const factoryOptions = getFactoryOptions()
  const configRows = getAutoDispatchConfigRows(rows)

  return `
    <div class="fixed inset-0 z-50" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-dispatch-action="close-auto-config" aria-label="关闭"></button>
      <section class="absolute left-1/2 top-1/2 max-h-[88vh] w-[min(1280px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border bg-background shadow-2xl" data-dialog-panel="true">
        <div class="flex items-start justify-between gap-3 border-b px-5 py-4">
          <div>
            <div class="flex flex-wrap items-center gap-2">
              <h3 class="text-lg font-semibold">自动分配配置</h3>
              <span class="rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs text-amber-700">车缝任务不参与自动分配</span>
            </div>
            <p class="mt-1 text-sm text-muted-foreground">非车缝任务命中配置后，按整任务、技术包核价的工序工艺价、直接派单自动分配；分配时间即工厂接单确认时间。</p>
          </div>
          <button class="rounded-md p-1 text-muted-foreground hover:bg-muted" data-dispatch-action="close-auto-config" aria-label="关闭">
            <i data-lucide="x" class="h-4 w-4"></i>
          </button>
        </div>

        <div class="max-h-[calc(88vh-140px)] overflow-auto p-5">
          <div class="overflow-x-auto rounded-lg border">
            <table class="w-full min-w-[1500px] text-sm">
              <thead>
                <tr class="border-b bg-muted/40 text-xs text-muted-foreground">
                  <th class="px-3 py-2 text-left font-medium">是否启用</th>
                  <th class="px-3 py-2 text-left font-medium">工序工艺</th>
                  <th class="px-3 py-2 text-left font-medium">分配方式</th>
                  <th class="px-3 py-2 text-left font-medium">分配粒度</th>
                  <th class="px-3 py-2 text-left font-medium">价格来源</th>
                  <th class="px-3 py-2 text-left font-medium">默认承接工厂</th>
                  <th class="px-3 py-2 text-left font-medium">任务截止天数</th>
                  <th class="px-3 py-2 text-left font-medium">更新人</th>
                  <th class="px-3 py-2 text-left font-medium">更新时间</th>
                  <th class="px-3 py-2 text-left font-medium">命中未分配</th>
                </tr>
              </thead>
              <tbody>
                ${
                  configRows.length === 0
                    ? '<tr><td colspan="10" class="px-3 py-8 text-center text-sm text-muted-foreground">当前没有可配置的非车缝工序工艺。</td></tr>'
                    : configRows
                        .map((item) => {
                          const config = state.autoDispatchConfigs[item.configKey]
                          return `
                            <tr class="border-b last:border-b-0" data-auto-dispatch-config-row="${escapeHtml(item.configKey)}">
                              <td class="px-3 py-3">
                                <input type="checkbox" data-dispatch-field="auto.enabled" data-process-code="${escapeHtml(item.configKey)}" ${config.enabled ? 'checked' : ''} />
                              </td>
                              <td class="px-3 py-3">
                                <div class="font-medium">${escapeHtml(item.label)}</div>
                                <div class="font-mono text-xs text-muted-foreground">${escapeHtml(item.processCode)} / ${escapeHtml(item.craftCode)}</div>
                              </td>
                              <td class="px-3 py-3">
                                <select class="h-8 w-full rounded-md border bg-muted px-2 text-xs text-muted-foreground" disabled><option>直接派单</option></select>
                              </td>
                              <td class="px-3 py-3">
                                <select class="h-8 w-full rounded-md border bg-muted px-2 text-xs text-muted-foreground" disabled><option>整任务</option></select>
                              </td>
                              <td class="px-3 py-3">
                                <select class="h-8 w-full rounded-md border bg-muted px-2 text-xs text-muted-foreground" disabled><option>技术包核价的工序工艺价</option></select>
                              </td>
                              <td class="px-3 py-3">
                                <select class="h-8 w-full rounded-md border bg-background px-2 text-xs" data-dispatch-field="auto.factoryId" data-process-code="${escapeHtml(item.configKey)}">
                                  <option value="">请选择工厂</option>
                                  ${factoryOptions
                                    .map(
                                      (factory) =>
                                        `<option value="${escapeHtml(factory.id)}" ${config.factoryId === factory.id ? 'selected' : ''}>${escapeHtml(factory.name)}</option>`,
                                    )
                                    .join('')}
                                </select>
                              </td>
                              <td class="px-3 py-3">
                                <input class="h-8 w-24 rounded-md border bg-background px-2 text-xs" type="number" min="1" data-dispatch-field="auto.taskDeadlineDays" data-process-code="${escapeHtml(item.configKey)}" value="${escapeHtml(config.taskDeadlineDays)}" />
                                <span class="ml-1 text-xs text-muted-foreground">天</span>
                              </td>
                              <td class="px-3 py-3 text-xs">${escapeHtml(config.updatedBy || '系统预置')}</td>
                              <td class="px-3 py-3 font-mono text-xs text-muted-foreground">${escapeHtml(config.updatedAt || '—')}</td>
                              <td class="px-3 py-3 text-xs"><span class="font-medium text-blue-700">${item.unassignedCount}</span> 条</td>
                            </tr>
                          `
                        })
                        .join('')
                }
              </tbody>
            </table>
          </div>
        </div>

        <div class="flex justify-end gap-2 border-t px-5 py-4">
          <button class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-dispatch-action="close-auto-config">关闭</button>
          <button class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700" data-dispatch-action="save-auto-config">保存自动分配配置</button>
        </div>
      </section>
    </div>
  `
}

function renderDispatchBoardInner(): string {
  const allRows = getVisibleRows()
  const exceptionTaskIds = getExceptionTaskIds()
  const tabCounts = getDispatchListTabCounts(allRows, exceptionTaskIds)
  const listRows =
    state.listTab === 'ALL'
      ? allRows
      : allRows.filter((task) => getDispatchListTabKey(task, exceptionTaskIds) === state.listTab)

  const createTenderTask = getCreateTenderTask()
  const viewTenderTask = getViewTenderTask()
  const priceSnapshotTask = getPriceSnapshotTask()
  const dispatchDialogTasks = getDispatchDialogTasks()
  const factoryOptions = getFactoryOptions()

  return `
    <div class="space-y-4">
      <header class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 class="text-2xl font-bold">任务分配</h1>
          <p class="mt-0.5 text-sm text-muted-foreground">对任务进行直接派单、竞价或暂不分配处理；车缝任务分配时确认生产单主工厂，非车缝任务可按配置自动直接派单。</p>
        </div>
        ${renderAutoDispatchToolbar()}
      </header>

      ${renderDispatchListTabs(tabCounts)}

      <section class="flex items-center gap-3">
        <div class="relative w-full max-w-xs">
          <i data-lucide="search" class="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"></i>
          <input class="h-9 w-full rounded-md border bg-background pl-8 pr-3 text-sm" data-dispatch-field="filter.keyword" placeholder="关键词（任务ID / 执行范围 / 生产单号）" value="${escapeHtml(state.keyword)}" />
        </div>
        <button class="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-muted" data-dispatch-action="clear-keyword"><i data-lucide="refresh-cw" class="h-4 w-4"></i></button>
        <p class="ml-auto text-sm text-muted-foreground">当前 ${listRows.length} 条 / 共 ${allRows.length} 条任务</p>
      </section>

      ${renderAutoAssignMessage()}

      <section class="space-y-2">
        ${renderListView(listRows, exceptionTaskIds)}
      </section>

      ${renderAutoDispatchConfigDialog(allRows)}
      ${renderDirectDispatchDialog(dispatchDialogTasks, factoryOptions)}
      ${renderCreateTenderSheet(createTenderTask)}
      ${renderViewTenderSheet(viewTenderTask)}
      ${renderPriceSnapshotSheet(priceSnapshotTask)}
    </div>
  `
}

export function renderDispatchBoardPage(): string {
  return renderDispatchBoardInner()
}
