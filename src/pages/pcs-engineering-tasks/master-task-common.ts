// 工程专业任务公共读取、办理入口与渲染。
// 数据源为工程主单任务记录；公共区只负责开始任务，专业成果仍由各专业页面维护。

import type {
  EngineeringMasterOrderRecord,
  EngineeringTaskRecord,
  EngineeringTaskType,
} from '../../data/pcs-engineering-master-types.ts'
import {
  getEngineeringMasterOrderById,
  listEngineeringMasterOrders,
  startEngineeringTask,
} from '../../data/pcs-engineering-master-repository.ts'
import { getStyleArchiveById } from '../../data/pcs-style-archive-repository.ts'
import { getMaterialArchiveById, getMaterialSkuRecordById } from '../../data/pcs-material-archive-repository.ts'
import { getEngineeringTaskDefinition } from '../../data/pcs-engineering-dependency-policy.ts'
import { getEngineeringTeamCurrentOperator } from '../../data/pcs-engineering-team-directory.ts'
import { listEngineeringIndependentSamplingRecords } from '../../data/pcs-engineering-master-sampling.ts'
import { listEngineeringChangeProfessionalTaskProjections } from '../../data/pcs-engineering-change-workspace.ts'
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

const INDEPENDENT_TASK_TYPE_MAP = {
  BASE_PATTERN: 'BASE_PATTERN_WOVEN',
  PATTERN_ARTWORK: 'PATTERN_ARTWORK',
  COLOR_YARN: 'COLOR_YARN',
  COLOR_FABRIC: 'COLOR_FABRIC',
} as const

const INDEPENDENT_TASK_STATUS_MAP = {
  WAIT_DEPENDENCY: '待前置',
  WAIT_START: '待开始',
  IN_PROGRESS: '进行中',
  WAIT_REVIEW: '待审核',
  REWORK: '返工中',
  COMPLETED: '已完成',
} as const

function independentProfessionalTaskDetailPath(task: { taskId: string; taskType: keyof typeof INDEPENDENT_TASK_TYPE_MAP }): string {
  if (task.taskType === 'BASE_PATTERN') return `/pcs/patterns/plate-making/${encodeURIComponent(task.taskId)}`
  if (task.taskType === 'PATTERN_ARTWORK') return `/pcs/patterns/artwork/${encodeURIComponent(task.taskId)}`
  return `/pcs/engineering/color/${encodeURIComponent(task.taskId)}`
}

function listIndependentProfessionalTaskProjections(): EngineeringTaskRecord[] {
  return listEngineeringIndependentSamplingRecords().flatMap((record) => record.professionalTasks.flatMap((task) => {
    if (task.taskType === 'DISPLAY_SAMPLE') return []
    const taskType = INDEPENDENT_TASK_TYPE_MAP[task.taskType]
    const firstFile = task.results.flatMap((result) => result.files)[0]
    const sourceLabel = record.samplingType === 'REVISION' ? '改款打样' : '设计打样'
    const currentTeamName = task.status === 'COMPLETED'
      ? ''
      : task.status === 'WAIT_REVIEW'
      ? '买手'
      : (task.taskType === 'COLOR_YARN' || task.taskType === 'COLOR_FABRIC') && !task.colorRequirementConfirmedAt
      ? '跟单'
      : task.ownerTeamName
    return [{
      taskId: task.taskId,
      masterOrderId: '',
      taskType,
      taskName: task.taskName,
      sourceType: record.samplingType === 'REVISION' ? 'INDEPENDENT_REVISION_SAMPLING' : 'INDEPENDENT_DESIGN_SAMPLING',
      sourceId: record.samplingTaskId,
      targetStyleId: record.targetStyleId,
      targetStyleCode: record.targetStyleCode,
      targetStyleName: record.targetStyleName,
      status: INDEPENDENT_TASK_STATUS_MAP[task.status],
      dependsOnTaskIds: [...task.dependsOnTaskIds],
      dependencySatisfaction: [],
      ownerTeamName: currentTeamName,
      assigneeId: '',
      assigneeName: '',
      assignedById: '',
      assignedByName: '',
      assignedAt: '',
      currentRoundNo: Math.max(1, task.results.length),
      plannedStartAt: '',
      plannedCompleteAt: task.plannedCompleteAt,
      resultSummary: task.results.map((result) => result.title).join('、'),
      submittedById: firstFile?.uploadedById || '',
      submittedByName: firstFile?.uploadedByName || '',
      reviewedById: '',
      reviewedByName: '',
      events: {
        generatedAt: record.taskPlanConfirmedAt || record.createdAt,
        unlockedAt: '',
        startedAt: task.startedAt,
        submittedAt: task.submittedAt,
        reviewedAt: task.completedAt,
        firstCompletedAt: task.completedAt,
        effectiveCompletedAt: task.completedAt,
      },
      operationLogs: [],
      materialLines: [],
      reworkRounds: [],
      startedAt: task.startedAt,
      submittedAt: task.submittedAt,
      firstCompletedAt: task.completedAt,
      effectiveCompletedAt: task.completedAt,
      resultImageIds: task.results.map((result) => result.imageUrl).filter(Boolean),
      resultQuantity: task.results.reduce((sum, result) => sum + Math.max(0, Number(result.sampleQuantity || 0)), 0),
      resultSubmittedBy: firstFile?.uploadedByName || '',
      materialReviewRounds: [],
      colorRequirementConfirmedBy: task.colorRequirementConfirmedBy,
      colorRequirementConfirmedAt: task.colorRequirementConfirmedAt,
      colorResultCompletedAt: task.completedAt,
      detailPath: independentProfessionalTaskDetailPath(task),
      sourceBusinessCode: record.samplingTaskCode,
      sourceBusinessName: sourceLabel,
    } satisfies EngineeringTaskRecord]
  }))
}

// 按任务类型读取统一专业任务列表：主单任务与独立打样任务共享一个列表，来源详情仍各自回到原业务单。
export function listEngineeringTasksByType(taskTypes: readonly EngineeringTaskType[]): EngineeringTaskRecord[] {
  return [
    ...listEngineeringMasterOrders().flatMap((master) => master.tasks),
    ...listIndependentProfessionalTaskProjections(),
    ...listEngineeringChangeProfessionalTaskProjections(),
  ].filter((task) => taskTypes.includes(task.taskType))
}

export function getEngineeringTaskListDetailPath(task: EngineeringTaskRecord, defaultPath: string): string {
  return task.detailPath || `${defaultPath}/${task.taskId}`
}

export function getEngineeringTaskSourceSummary(task: EngineeringTaskRecord): { code: string; label: string } {
  if (task.sourceBusinessCode) return { code: task.sourceBusinessCode, label: task.sourceBusinessName || taskSourceLabel(task) }
  const master = task.masterOrderId ? getEngineeringMasterOrderById(task.masterOrderId) : null
  return { code: master?.masterOrderCode || task.sourceId || '-', label: taskSourceLabel(task) }
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

function taskSourceLabel(task: EngineeringTaskRecord): string {
  if (task.sourceType === 'ENGINEERING_CHANGE') return '工程变更'
  if (task.sourceType === 'INDEPENDENT_REVISION_SAMPLING') return '改款打样'
  if (task.sourceType === 'INDEPENDENT_DESIGN_SAMPLING') return '设计打样'
  return '工程主单'
}

function taskNextAction(task: EngineeringTaskRecord): string {
  if (task.status === '未启用') return '等待跟单确认并启用任务'
  if (task.status === '待前置') return '等待前置任务完成，完成后系统自动解锁'
  if (task.status === '待开始' && task.taskType === 'ACCESSORY_PURCHASE') return '在采购系统下单后直接绑定采购单号，绑定后系统自动开始任务'
  if (task.status === '待开始' && task.taskType === 'TECH_PACK_CONFIRMATION') return '生成技术包草稿，系统自动开始任务'
  if (task.status === '待开始') return `前置条件已满足，由${task.ownerTeamName}开始执行`
  if (task.status === '待审核') return '等待买手审核；未通过项将进入返工'
  if (task.status === '返工中') return '仅修改未通过项并重新提交'
  if (task.status === '已完成') return '成果已完成，并作为后续任务或技术包的输入'
  if (task.status === '因需求变更结束') return '该任务已因工程变更结束'
  if (task.taskType === 'ACCESSORY_PURCHASE') return '在采购系统下单后，绑定采购单号'
  if (task.taskType === 'TECH_PACK_CONFIRMATION') return '汇总已完成成果，生成并提交技术包审核'
  if (task.taskType === 'PATTERN_ARTWORK') return '逐项维护花型成果，整单提交买手审核'
  if (task.taskType === 'COLOR_YARN' || task.taskType === 'COLOR_FABRIC') {
    return task.colorRequirementConfirmedAt ? '由染厂提交调色成果，再由买手整单审核' : '先由跟单确认潘通色号、颜色名称和染色色号'
  }
  return '提交完整成果后，任务直接完成'
}

function renderStyleIdentity(master: EngineeringMasterOrderRecord): string {
  const style = getStyleArchiveById(master.styleId)
  const imageUrl = style?.mainImageUrl || style?.galleryImageUrls?.[0] || ''
  const image = imageUrl
    ? `<button type="button" class="h-16 w-12 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-slate-50" data-engineering-task-action="preview-image" data-image-url="${escapeHtml(imageUrl)}" data-image-title="${escapeHtml(master.styleName)}" aria-label="查看${escapeHtml(master.styleName)}大图"><img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(master.styleName)}" class="h-full w-full object-cover" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span hidden class="px-1 text-[10px] text-rose-600">图片失败</span></button>`
    : '<span class="flex h-16 w-12 shrink-0 items-center justify-center rounded-md border border-amber-200 bg-amber-50 px-1 text-center text-[10px] text-amber-700">缺少款式图</span>'
  return `<div class="flex min-w-0 items-center gap-3">${image}<div class="min-w-0"><p class="truncate font-medium text-slate-900">${escapeHtml(master.styleName)}</p><p class="mt-1 text-xs text-slate-500">${escapeHtml(master.styleCode)}</p></div></div>`
}

export function renderTaskWorkbenchHeader(
  task: EngineeringTaskRecord,
  master: EngineeringMasterOrderRecord,
  module: ModuleKey,
  listPath: string,
): string {
  const pendingDependencies = task.dependsOnTaskIds
    .map((dependencyId) => master.tasks.find((item) => item.taskId === dependencyId))
    .filter((dependency): dependency is EngineeringTaskRecord => Boolean(dependency && dependency.status !== '已完成'))
  return `<section class="overflow-hidden rounded-lg border border-slate-200 bg-white" data-engineering-task-workbench="${escapeHtml(`${module}:${task.taskId}`)}">
    <div class="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
      <div><div class="flex flex-wrap items-center gap-2"><h1 class="text-lg font-semibold text-slate-900">${escapeHtml(task.taskName)}</h1>${renderStatusBadge(task.status)}</div><p class="mt-1 text-xs text-slate-500">${escapeHtml(task.taskId)} · ${escapeHtml(master.masterOrderCode)}</p></div>
      <button type="button" class="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700" data-nav="${escapeHtml(listPath)}">返回列表</button>
    </div>
    <div class="grid gap-4 p-5 lg:grid-cols-[minmax(240px,1.4fr)_repeat(4,minmax(120px,1fr))]">
      ${renderStyleIdentity(master)}
      <div><p class="text-xs text-slate-500">当前需处理的团队</p><p class="mt-1 text-sm font-medium text-slate-900">${escapeHtml(task.ownerTeamName || '-')}</p>${task.assigneeName ? `<p class="text-xs text-slate-400">实际操作：${escapeHtml(task.assigneeName)}</p>` : '<p class="text-xs text-slate-400">开始处理后记录实际操作人</p>'}</div>
      <div><p class="text-xs text-slate-500">任务来源</p><p class="mt-1 text-sm font-medium text-slate-900">${escapeHtml(taskSourceLabel(task))}</p><p class="text-xs text-slate-400">${escapeHtml(task.sourceId || master.masterOrderCode)}</p></div>
      <div><p class="text-xs text-slate-500">计划完成</p><p class="mt-1 text-sm font-medium text-slate-900">${escapeHtml(task.plannedCompleteAt || '-')}</p><p class="text-xs text-slate-400">第 ${task.currentRoundNo || 1} 轮</p></div>
      <div><p class="text-xs text-slate-500">所属主单</p><a class="mt-1 block text-sm font-medium text-blue-700 hover:underline" href="/pcs/engineering/masters/${escapeHtml(master.masterOrderId)}">${escapeHtml(master.masterOrderCode)}</a><p class="text-xs text-slate-400">跟单：${escapeHtml(master.merchandiserName || '-')}</p></div>
    </div>
    <div class="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50 px-5 py-4">
      <div><p class="text-xs font-medium text-slate-500">当前动作</p><p class="mt-1 text-sm text-slate-800">${escapeHtml(taskNextAction(task))}</p>${pendingDependencies.length ? `<p class="mt-1 text-xs text-amber-700">等待：${escapeHtml(pendingDependencies.map((item) => item.taskName).join('、'))}</p>` : ''}</div>
      ${task.status === '待开始' && !['ACCESSORY_PURCHASE', 'TECH_PACK_CONFIRMATION'].includes(task.taskType) ? `<button type="button" class="h-10 rounded-md bg-blue-600 px-5 text-sm font-medium text-white hover:bg-blue-700" data-engineering-task-action="start" data-skip-page-rerender="true" data-module="${escapeHtml(module)}" data-task-id="${escapeHtml(task.taskId)}">开始任务</button>` : ''}
    </div>
    <div data-engineering-task-feedback class="mx-5 mb-4 hidden rounded-md px-3 py-2 text-sm" role="alert"></div>
  </section>`
}

export function startEngineeringTaskFromDetail(taskId: string): void {
  const detail = getEngineeringTaskDetail(taskId)
  if (!detail) throw new Error('未找到工程任务。')
  const { task, master } = detail
  const operator = getEngineeringTeamCurrentOperator(task.ownerTeamName)
  startEngineeringTask({
    masterOrderId: master.masterOrderId,
    taskId,
    operatorId: operator.operatorId,
    operatorName: operator.operatorName,
  })
}

// 当前需处理团队下拉选项（按当前数据去重）。
export function getEngineeringTaskTeamOptions(items: EngineeringTaskRecord[]): string[] {
  return [...new Set(items.filter((item) => item.status !== '已完成').map((item) => item.ownerTeamName).filter(Boolean))].sort()
}

// 来源下拉选项：工程主单、改款打样、设计打样或工程变更。
export function getEngineeringTaskSourceOptions(items: EngineeringTaskRecord[]): string[] {
  return [...new Set(items.map((item) => getEngineeringTaskSourceSummary(item).label))].sort()
}

// 任务时间线日志：没有实际动作时不虚构个人，动作发生后读取真实操作记录。
export function buildEngineeringTaskLogs(task: EngineeringTaskRecord, master: EngineeringMasterOrderRecord): EngineeringLog[] {
  const definition = getEngineeringTaskDefinition(task.taskType)
  const logs: EngineeringLog[] = [
    { time: master.publishedAt, action: '任务生成', user: master.createdBy, detail: `工程主单 ${master.masterOrderCode} 发布时生成任务：${task.taskName}。` },
  ]
  if (task.startedAt) logs.push({ time: task.startedAt, action: '开始执行', user: task.assigneeName || '未记录实际操作人', detail: `${task.taskName} 开始执行。` })
  if (task.submittedAt) logs.push({ time: task.submittedAt, action: definition.reviewRequired ? '提交审核' : '提交成果', user: task.submittedByName || task.resultSubmittedBy || task.assigneeName || '未记录实际操作人', detail: `${task.taskName}${definition.reviewRequired ? '已提交审核' : '已提交成果'}。` })
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
      { label: '当前需处理的团队', value: escapeHtml(task.ownerTeamName || '-') },
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
          ${lines.map((line) => {
            return `
            <tr>
              <td class="px-4 py-2 text-slate-900">${renderTaskMaterialIdentity(line)}</td>
              <td class="px-4 py-2 text-slate-600">${escapeHtml(line.materialType || '-')}</td>
              <td class="px-4 py-2 text-slate-600">${escapeHtml(line.requirementType)}</td>
              <td class="px-4 py-2"><span class="rounded-full px-2.5 py-1 text-xs font-medium ${line.status === '正常' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}">${escapeHtml(line.status)}</span></td>
            </tr>`
          }).join('')}
        </tbody>
      </table>
    </div>
  `
  return renderSectionCard('物料需求', body)
}

export function renderTaskMaterialIdentity(
  line: Pick<EngineeringTaskRecord['materialLines'][number], 'materialSkuId' | 'materialName'>,
  secondaryText = line.materialSkuId || '-',
): string {
  const sku = getMaterialSkuRecordById(line.materialSkuId)
  const material = sku ? getMaterialArchiveById(sku.materialId) : null
  const imageUrl = sku?.skuImageUrl || material?.mainImageUrl || ''
  const image = imageUrl
    ? `<button type="button" class="h-12 w-12 shrink-0 overflow-hidden rounded border border-slate-200" data-engineering-task-action="preview-image" data-image-url="${escapeHtml(imageUrl)}" data-image-title="${escapeHtml(line.materialName)}" aria-label="查看${escapeHtml(line.materialName)}大图"><img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(line.materialName)}" class="h-full w-full object-cover" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span hidden class="px-1 text-[10px] text-rose-600">图片失败</span></button>`
    : '<span class="flex h-12 w-12 shrink-0 items-center justify-center rounded border border-amber-200 bg-amber-50 px-1 text-center text-[10px] text-amber-700">缺少物料图</span>'
  return `<div class="flex items-center gap-3">${image}<div><p class="font-medium text-slate-800">${escapeHtml(line.materialName)}</p><p class="text-xs text-slate-500">${escapeHtml(secondaryText)}</p></div></div>`
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
    return renderSectionCard('需要先完成', '<p class="text-sm text-slate-500">无需先完成其他任务。</p>')
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
  return renderSectionCard('需要先完成', body)
}

export function renderTaskLogsCard(task: EngineeringTaskRecord, master: EngineeringMasterOrderRecord, module: ModuleKey): string {
  return renderSectionCard('操作记录', renderLogs(mergeLogs(module, task.taskId, buildEngineeringTaskLogs(task, master))))
}
