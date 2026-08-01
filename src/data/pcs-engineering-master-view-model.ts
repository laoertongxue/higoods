// 工程主单视图模型：为列表页与泳道工作台派生只读展示数据。
// 演示种子只在本模块内部维护，页面渲染前调用 ensureEngineeringMasterDemoData()。

import {
  getEngineeringTaskDefinition,
  listEngineeringTaskDefinitions,
  type EngineeringTaskDefinition,
} from './pcs-engineering-dependency-policy.ts'
import { hasFormalProductionFact } from './pcs-engineering-first-production-policy.ts'
import {
  createEngineeringMasterOrder,
  listEngineeringMasterOrders,
  publishEngineeringMasterOrder,
} from './pcs-engineering-master-repository.ts'
import type {
  EngineeringMasterOrderRecord,
  EngineeringMasterStatus,
  EngineeringPriorResultReuseLine,
  EngineeringTaskRecord,
  EngineeringTaskStatus,
  EngineeringTaskType,
} from './pcs-engineering-master-types.ts'
import { listStyleArchives } from './pcs-style-archive-repository.ts'

// ============ 泳道与逻辑阶段（固定结构，只读） ============

export interface EngineeringLaneDefinition {
  laneKey: string
  laneName: string
  taskTypes: EngineeringTaskType[]
}

export interface EngineeringPhaseDefinition {
  phaseKey: string
  phaseName: string
  taskTypes: EngineeringTaskType[]
}

export const ENGINEERING_LANES: readonly EngineeringLaneDefinition[] = [
  { laneKey: 'pattern', laneName: '制版', taskTypes: ['BASE_PATTERN_WOVEN', 'BASE_PATTERN_KNIT', 'SIZE_PATTERN_WOVEN', 'SIZE_PATTERN_KNIT'] },
  { laneKey: 'sample', laneName: '产前版样衣', taskTypes: ['PRE_PRODUCTION_SAMPLE'] },
  { laneKey: 'artwork', laneName: '花型', taskTypes: ['PATTERN_ARTWORK'] },
  { laneKey: 'color', laneName: '调色', taskTypes: ['COLOR_YARN', 'COLOR_FABRIC'] },
  { laneKey: 'purchase', laneName: '辅料下单', taskTypes: ['ACCESSORY_PURCHASE'] },
  { laneKey: 'tech-pack', laneName: '技术包确认', taskTypes: ['TECH_PACK_CONFIRMATION'] },
]

export const ENGINEERING_PHASES: readonly EngineeringPhaseDefinition[] = [
  { phaseKey: 'base-pattern', phaseName: '基码纸样', taskTypes: ['BASE_PATTERN_WOVEN', 'BASE_PATTERN_KNIT'] },
  { phaseKey: 'sample-size', phaseName: '版衣与齐码', taskTypes: ['PRE_PRODUCTION_SAMPLE', 'SIZE_PATTERN_WOVEN', 'SIZE_PATTERN_KNIT'] },
  { phaseKey: 'artwork-color', phaseName: '花型与调色', taskTypes: ['PATTERN_ARTWORK', 'COLOR_YARN', 'COLOR_FABRIC'] },
  { phaseKey: 'purchase', phaseName: '辅料采购', taskTypes: ['ACCESSORY_PURCHASE'] },
  { phaseKey: 'tech-pack', phaseName: '技术包确认', taskTypes: ['TECH_PACK_CONFIRMATION'] },
]

// 演示计划时间按任务类型相对发布时间的固定偏移（天）。
const PLAN_OFFSET_DAYS: Record<EngineeringTaskType, number> = {
  BASE_PATTERN_WOVEN: 5,
  BASE_PATTERN_KNIT: 5,
  PRE_PRODUCTION_SAMPLE: 10,
  SIZE_PATTERN_WOVEN: 15,
  SIZE_PATTERN_KNIT: 15,
  PATTERN_ARTWORK: 12,
  COLOR_YARN: 18,
  COLOR_FABRIC: 18,
  ACCESSORY_PURCHASE: 8,
  TECH_PACK_CONFIRMATION: 22,
}

// ============ 演示种子 ============

// 仓库为空时创建演示主单：首张发布为 EM-001，第二张保持草稿，用于展示不同状态。
export function ensureEngineeringMasterDemoData(): void {
  const records = listEngineeringMasterOrders()
  if (records.length > 0) return
  const styles = listStyleArchives()
  const candidates = styles.filter((style) => !hasFormalProductionFact(style.styleCode)).slice(0, 2)
  if (candidates.length === 0) return
  for (const [index, style] of candidates.entries()) {
    const record = createEngineeringMasterOrder({
      styleId: style.styleId,
      styleCode: style.styleCode,
      merchandiserName: '跟单-林晓',
      createdBy: '跟单-林晓',
    })
    if (index === 0) {
      publishEngineeringMasterOrder(record.masterOrderId)
    }
  }
}

// ============ 列表视图模型 ============

export interface EngineeringMasterListRow {
  masterOrderId: string
  masterOrderCode: string
  styleCode: string
  styleName: string
  merchandiserName: string
  status: EngineeringMasterStatus
  currentStage: string
  progressText: string
  updatedAt: string
}

function deriveCurrentStage(record: EngineeringMasterOrderRecord): string {
  const active = record.tasks.find(
    (task) =>
      task.status !== '未启用' &&
      task.status !== '已完成' &&
      task.status !== '因需求变更结束',
  )
  if (active) return active.taskName
  if (record.status === '草稿') return '待发布'
  if (record.status === '已关闭') return '已关闭'
  if (record.status === '已终止') return '已终止'
  return '全部就绪'
}

function deriveProgressText(record: EngineeringMasterOrderRecord): string {
  if (record.status === '草稿') return '未发布'
  const applicable = record.tasks.filter((task) => task.status !== '未启用')
  const done = record.tasks.filter(
    (task) => task.status === '已完成' || task.status === '因需求变更结束',
  ).length
  return `${done}/${applicable.length}`
}

export function buildEngineeringMasterListRows(): EngineeringMasterListRow[] {
  return listEngineeringMasterOrders().map((record) => ({
    masterOrderId: record.masterOrderId,
    masterOrderCode: record.masterOrderCode,
    styleCode: record.styleCode,
    styleName: record.styleName,
    merchandiserName: record.merchandiserName,
    status: record.status,
    currentStage: deriveCurrentStage(record),
    progressText: deriveProgressText(record),
    updatedAt: record.publishedAt || record.createdAt,
  }))
}

// ============ 详情视图模型（泳道工作台） ============

export interface EngineeringTaskCardModel {
  taskId: string
  taskType: EngineeringTaskType
  taskName: string
  ownerTeamName: string
  status: EngineeringTaskStatus
  currentNodeName: string
  plannedTimeText: string
  actualTimeText: string
  riskText: string
  dependsOnLabels: string[]
  dependsOnTaskIds: string[]
  requiredByLabels: string[]
  requiredByTaskIds: string[]
  reviewRequired: boolean
}

export interface EngineeringLaneModel {
  laneKey: string
  laneName: string
  tasks: EngineeringTaskCardModel[]
}

export interface EngineeringMasterDetailModel {
  masterOrderId: string
  masterOrderCode: string
  styleCode: string
  styleName: string
  status: EngineeringMasterStatus
  merchandiserName: string
  createdBy: string
  createdAt: string
  publishedAt: string
  lanes: EngineeringLaneModel[]
  priorResultReuseLines: EngineeringPriorResultReuseLine[]
}

function parseDateText(text: string): Date | null {
  if (!text) return null
  const date = new Date(text)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatPlanDate(baseText: string, offsetDays: number): string {
  const base = parseDateText(baseText)
  if (!base) return '—'
  const target = new Date(base.getTime() + offsetDays * 24 * 60 * 60 * 1000)
  const month = String(target.getMonth() + 1).padStart(2, '0')
  const day = String(target.getDate()).padStart(2, '0')
  return `${month}-${day}`
}

function deriveCurrentNodeName(task: EngineeringTaskRecord, definition: EngineeringTaskDefinition): string {
  if (definition.stages.length === 0) return task.status
  if (task.status === '待审核') {
    const reviewStage = definition.stages.find((stage) => stage.stageType === 'BUYER_REVIEW')
    return reviewStage?.stageName ?? task.status
  }
  if (task.status === '进行中') {
    const coloringStage = definition.stages.find((stage) => stage.stageType === 'FACTORY_COLORING')
    return coloringStage?.stageName ?? task.status
  }
  return task.status
}

function deriveRiskText(
  task: EngineeringTaskRecord,
  dependsOnLabels: string[],
  definition: EngineeringTaskDefinition,
): string {
  if (task.status === '待前置') {
    return dependsOnLabels.length > 0 ? `等待：${dependsOnLabels.join('、')}` : '等待前置完成'
  }
  if (task.status === '待审核') return '等待审核'
  if (task.status === '返工中') return `返工中：第 ${task.reworkRounds.length + 1} 轮`
  if (task.status === '进行中' && definition.stages.length > 0) {
    const coloringStage = definition.stages.find((stage) => stage.stageType === 'FACTORY_COLORING')
    return coloringStage ? '染厂执行中' : ''
  }
  return ''
}

export function buildEngineeringMasterDetailModel(key: string): EngineeringMasterDetailModel | null {
  ensureEngineeringMasterDemoData()
  const records = listEngineeringMasterOrders()
  const record =
    records.find((item) => item.masterOrderId === key || item.masterOrderCode === key) ?? null
  if (!record) return null

  const definitions = new Map(
    listEngineeringTaskDefinitions().map((definition) => [definition.taskType, definition]),
  )
  const taskById = new Map(record.tasks.map((task) => [task.taskId, task]))

  const lanes: EngineeringLaneModel[] = ENGINEERING_LANES.map((lane) => {
    const tasks = lane.taskTypes
      .map((taskType) => {
        const task = record.tasks.find((item) => item.taskType === taskType)
        if (!task) return null
        const definition = definitions.get(taskType)
        if (!definition) return null
        const dependsOnLabels = task.dependsOnTaskIds
          .map((dependencyId) => taskById.get(dependencyId)?.taskName ?? '')
          .filter(Boolean)
        const requiredByLabels = record.tasks
          .filter((item) => item.dependsOnTaskIds.includes(task.taskId))
          .map((item) => item.taskName)
        const requiredByTaskIds = record.tasks
          .filter((item) => item.dependsOnTaskIds.includes(task.taskId))
          .map((item) => item.taskId)
        return {
          taskId: task.taskId,
          taskType: task.taskType,
          taskName: task.taskName,
          ownerTeamName: task.ownerTeamName,
          status: task.status,
          currentNodeName: deriveCurrentNodeName(task, definition),
          plannedTimeText: record.publishedAt
            ? `计划 ${formatPlanDate(record.publishedAt, PLAN_OFFSET_DAYS[taskType])}`
            : '—',
          actualTimeText: task.effectiveCompletedAt
            ? `实际完成 ${task.effectiveCompletedAt}`
            : task.startedAt
              ? `开始 ${task.startedAt}`
              : '未开始',
          riskText: deriveRiskText(task, dependsOnLabels, definition),
          dependsOnLabels,
          dependsOnTaskIds: [...task.dependsOnTaskIds],
          requiredByLabels,
          requiredByTaskIds,
          reviewRequired: definition.reviewRequired,
        } satisfies EngineeringTaskCardModel
      })
      .filter((task): task is EngineeringTaskCardModel => task !== null)
    return { laneKey: lane.laneKey, laneName: lane.laneName, tasks }
  })

  return {
    masterOrderId: record.masterOrderId,
    masterOrderCode: record.masterOrderCode,
    styleCode: record.styleCode,
    styleName: record.styleName,
    status: record.status,
    merchandiserName: record.merchandiserName,
    createdBy: record.createdBy,
    createdAt: record.createdAt,
    publishedAt: record.publishedAt,
    lanes,
    priorResultReuseLines: record.priorResultReuseLines.map((line) => ({ ...line })),
  }
}
