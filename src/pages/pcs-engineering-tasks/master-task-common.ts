// 工程专业任务公共读取与渲染：color / purchase / techPack 三个模块共用。
// 数据源为工程主单任务记录（pcs-engineering-master-repository），页面只读展示，不提供写入入口。

import type {
  EngineeringMasterOrderRecord,
  EngineeringTaskRecord,
  EngineeringTaskType,
} from '../../data/pcs-engineering-master-types.ts'
import {
  listEngineeringMasterOrders,
} from '../../data/pcs-engineering-master-repository.ts'
import { getEngineeringTaskDefinition } from '../../data/pcs-engineering-dependency-policy.ts'
import { escapeHtml, formatDateTime } from '../../utils.ts'
import type { EngineeringLog, ModuleKey } from './shared.ts'
import {
  mergeLogs,
  renderKeyValueGrid,
  renderLogs,
  renderSectionCard,
  renderStatusBadge,
  styleArchiveLink,
} from './shared.ts'

// 工程任务统一状态筛选口径（与工程任务记录 8 档状态一致）
export const ENGINEERING_TASK_FILTER_STATUS_OPTIONS = [
  '未启用',
  '待前置',
  '待开始',
  '进行中',
  '待审核',
  '返工中',
  '已完成',
  '因需求变更结束',
] as const

// 按任务类型读取工程任务：从所有工程主单的任务记录中展开。
export function listEngineeringTasksByType(taskTypes: readonly EngineeringTaskType[]): EngineeringTaskRecord[] {
  return listEngineeringMasterOrders()
    .flatMap((master) => master.tasks)
    .filter((task) => taskTypes.includes(task.taskType))
}

export function getEngineeringTaskDetail(
  taskId: string,
): { task: EngineeringTaskRecord; master: EngineeringMasterOrderRecord } | null {
  for (const master of listEngineeringMasterOrders()) {
    const task = master.tasks.find((item) => item.taskId === taskId)
    if (task) return { task, master }
  }
  return null
}

// 负责团队下拉选项（按当前数据去重）。
export function getEngineeringTaskTeamOptions(items: EngineeringTaskRecord[]): string[] {
  return [...new Set(items.map((item) => item.ownerTeamName).filter(Boolean))].sort()
}

// 来源下拉选项：任务类型中文名（如 调色任务（纱线））。
export function getEngineeringTaskSourceOptions(items: EngineeringTaskRecord[]): string[] {
  return [...new Set(items.map((item) => getEngineeringTaskDefinition(item.taskType).taskName))].sort()
}

// 任务时间线日志：工程任务记录不维护人工操作字段，按固定时间线构造。
export function buildEngineeringTaskLogs(task: EngineeringTaskRecord, master: EngineeringMasterOrderRecord): EngineeringLog[] {
  const logs: EngineeringLog[] = [
    { time: master.publishedAt, action: '任务生成', user: master.createdBy, detail: `工程主单 ${master.masterOrderCode} 发布时生成任务：${task.taskName}。` },
  ]
  if (task.startedAt) logs.push({ time: task.startedAt, action: '开始执行', user: master.merchandiserName, detail: `${task.taskName} 开始执行。` })
  if (task.submittedAt) logs.push({ time: task.submittedAt, action: '提交审核', user: master.merchandiserName, detail: `${task.taskName} 已提交审核。` })
  if (task.firstCompletedAt) logs.push({ time: task.firstCompletedAt, action: '首次完成', user: master.merchandiserName, detail: `${task.taskName} 首次完成。` })
  if (task.effectiveCompletedAt) logs.push({ time: task.effectiveCompletedAt, action: '完成确认', user: master.merchandiserName, detail: `${task.taskName} 已生效完成（含返工轮次）。` })
  return logs.sort((left, right) => right.time.localeCompare(left.time))
}

export function renderTaskSummaryCard(task: EngineeringTaskRecord, master: EngineeringMasterOrderRecord): string {
  const definition = getEngineeringTaskDefinition(task.taskType)
  return renderSectionCard(
    '任务概要',
    renderKeyValueGrid([
      { label: '任务类型', value: escapeHtml(definition.taskName) },
      { label: '任务编号', value: escapeHtml(task.taskId) },
      { label: '负责团队', value: escapeHtml(task.ownerTeamName || '-') },
      { label: '当前状态', value: renderStatusBadge(task.status) },
      { label: '开始时间', value: escapeHtml(task.startedAt ? formatDateTime(task.startedAt) : '-') },
      { label: '提交时间', value: escapeHtml(task.submittedAt ? formatDateTime(task.submittedAt) : '-') },
      { label: '首次完成', value: escapeHtml(task.firstCompletedAt ? formatDateTime(task.firstCompletedAt) : '-') },
      { label: '生效完成', value: escapeHtml(task.effectiveCompletedAt ? formatDateTime(task.effectiveCompletedAt) : '-') },
    ], 4),
  )
}

export function renderTaskMasterCard(master: EngineeringMasterOrderRecord): string {
  return renderSectionCard(
    '所属工程主单',
    renderKeyValueGrid([
      { label: '主单编号', value: `<a class="font-medium text-blue-700 hover:underline" href="/pcs/engineering/masters/${escapeHtml(master.masterOrderId)}" target="_blank" rel="noreferrer">${escapeHtml(master.masterOrderCode)}</a>` },
      { label: '款式档案', value: styleArchiveLink(master.styleId, master.styleCode, master.styleName) },
      { label: '主单状态', value: renderStatusBadge(master.status) },
      { label: '跟单', value: escapeHtml(master.merchandiserName || '-') },
    ], 4),
  )
}

export function renderTaskMaterialLinesCard(task: EngineeringTaskRecord): string {
  const lines = task.materialLines
  if (lines.length === 0) {
    return renderSectionCard('物料需求', '<p class="text-sm text-slate-500">暂无物料需求行。</p>')
  }
  const body = `
    <div class="overflow-hidden rounded-lg border border-slate-200">
      <table class="min-w-full divide-y divide-slate-200 text-sm">
        <thead class="bg-slate-50">
          <tr>
            <th class="px-4 py-2 text-left text-xs font-medium text-slate-500">物料名称</th>
            <th class="px-4 py-2 text-left text-xs font-medium text-slate-500">物料类型</th>
            <th class="px-4 py-2 text-left text-xs font-medium text-slate-500">需求类型</th>
            <th class="px-4 py-2 text-left text-xs font-medium text-slate-500">状态</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          ${lines.map((line) => `
            <tr>
              <td class="px-4 py-2 text-slate-900">${escapeHtml(line.materialName)}</td>
              <td class="px-4 py-2 text-slate-600">${escapeHtml(line.materialType || '-')}</td>
              <td class="px-4 py-2 text-slate-600">${escapeHtml(line.requirementType)}</td>
              <td class="px-4 py-2">${renderStatusBadge(line.status)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `
  return renderSectionCard('物料需求', body)
}

export function renderTaskReworkRoundsCard(task: EngineeringTaskRecord): string {
  const rounds = task.reworkRounds
  if (rounds.length === 0) {
    return renderSectionCard('返工记录', '<p class="text-sm text-slate-500">暂无返工轮次。</p>')
  }
  const body = `
    <div class="space-y-3">
      ${rounds.map((round) => `
        <div class="rounded-lg border border-slate-200 px-4 py-3">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <span class="rounded-full bg-orange-100 px-2.5 py-1 text-xs font-medium text-orange-700">第 ${round.roundNo} 轮返工</span>
            <span class="text-xs text-slate-400">开始 ${escapeHtml(formatDateTime(round.startedAt))}</span>
          </div>
          <p class="mt-2 text-sm text-slate-700">${escapeHtml(round.reason || '未填写返工原因')}</p>
          <p class="mt-1 text-xs text-slate-400">提交 ${escapeHtml(formatDateTime(round.submittedAt))} · 通过 ${escapeHtml(formatDateTime(round.passedAt))}</p>
        </div>
      `).join('')}
    </div>
  `
  return renderSectionCard('返工记录', body)
}

export function renderTaskDependencyCard(task: EngineeringTaskRecord): string {
  if (task.dependsOnTaskIds.length === 0) {
    return renderSectionCard('前置依赖', '<p class="text-sm text-slate-500">无前置任务。</p>')
  }
  const body = `
    <div class="space-y-2">
      ${task.dependsOnTaskIds.map((dependencyId) => {
        const dependency = getEngineeringTaskDetail(dependencyId)
        if (!dependency) return `<div class="rounded-lg border border-slate-200 px-4 py-3 text-sm text-slate-500">前置任务（${escapeHtml(dependencyId)}）不存在</div>`
        return `
          <div class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 px-4 py-3">
            <div>
              <p class="text-sm font-medium text-slate-900">${escapeHtml(dependency.task.taskName)}</p>
              <p class="text-xs text-slate-400">${escapeHtml(dependency.task.taskId)}</p>
            </div>
            ${renderStatusBadge(dependency.task.status)}
          </div>
        `
      }).join('')}
    </div>
  `
  return renderSectionCard('前置依赖', body)
}

export function renderTaskLogsCard(task: EngineeringTaskRecord, master: EngineeringMasterOrderRecord, module: ModuleKey): string {
  return renderSectionCard('操作记录', renderLogs(mergeLogs(module, task.taskId, buildEngineeringTaskLogs(task, master))))
}
