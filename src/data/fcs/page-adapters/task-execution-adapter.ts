import { processTasks, type ProcessTask } from '../process-tasks'

export interface ExecutionTaskFact extends ProcessTask {
  displayStageName: string
  displayProcessName: string
  displayTaskType: string
  displayGranularity: string
}

const STAGE_LABEL_BY_CODE: Record<string, string> = {
  PREP: '准备阶段',
  PROD: '生产阶段',
  POST: '后道阶段',
}

const STAGE_LABEL_BY_LEGACY_STAGE: Record<string, string> = {
  CUTTING: '裁片阶段',
  SEWING: '生产阶段',
  POST: '后道阶段',
  SPECIAL: '特殊工艺阶段',
}

const GRANULARITY_LABEL: Record<'ORDER' | 'COLOR' | 'SKU', string> = {
  ORDER: '按生产单',
  COLOR: '按颜色',
  SKU: '按SKU',
}

function resolveProcessName(task: ProcessTask): string {
  return task.processBusinessName || task.processNameZh || task.processCode
}

function resolveTaskTypeName(task: ProcessTask): string {
  if (task.taskCategoryZh) return task.taskCategoryZh
  if (task.isSpecialCraft) return task.craftName || resolveProcessName(task)
  return resolveProcessName(task)
}

export function getTaskStageDisplayName(task: ProcessTask): string {
  if (task.stageName) return task.stageName
  if (task.stageCode && STAGE_LABEL_BY_CODE[task.stageCode]) return STAGE_LABEL_BY_CODE[task.stageCode]
  return STAGE_LABEL_BY_LEGACY_STAGE[task.stage] || task.stage
}

export function getTaskProcessDisplayName(task: ProcessTask): string {
  return task.isSpecialCraft ? resolveTaskTypeName(task) : resolveProcessName(task)
}

export function getTaskTypeDisplayName(task: ProcessTask): string {
  return resolveTaskTypeName(task)
}

export function getTaskGranularityDisplayName(task: ProcessTask): string {
  const granularity = task.assignmentGranularity
  if (granularity && GRANULARITY_LABEL[granularity]) return GRANULARITY_LABEL[granularity]
  return '-'
}

export function listExecutionTaskFacts(): ProcessTask[] {
  return processTasks
    .filter((task) => task.defaultDocType !== 'DEMAND')
    .sort((a, b) => {
      if (a.productionOrderId !== b.productionOrderId) {
        return a.productionOrderId.localeCompare(b.productionOrderId)
      }
      return a.seq - b.seq
    })
}

export function getExecutionTaskFactById(taskId: string): ProcessTask | null {
  return listExecutionTaskFacts().find((task) => task.taskId === taskId) ?? null
}

export function toExecutionTaskFact(task: ProcessTask): ExecutionTaskFact {
  return {
    ...task,
    displayStageName: getTaskStageDisplayName(task),
    displayProcessName: getTaskProcessDisplayName(task),
    displayTaskType: getTaskTypeDisplayName(task),
    displayGranularity: getTaskGranularityDisplayName(task),
  }
}
