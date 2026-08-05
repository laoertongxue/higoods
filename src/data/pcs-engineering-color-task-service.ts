// 调色任务三阶段服务：仅通过工程主单任务及物料行读写，不建立第二套调色任务事实。

import { listPreparationProjectionItems } from './pcs-engineering-dependency-policy.ts'
import {
  getEngineeringMasterOrderById,
  updateEngineeringTaskRecord,
} from './pcs-engineering-master-repository.ts'
import { submitEngineeringMaterialResults } from './pcs-engineering-task-review.ts'
import type {
  EngineeringTaskMaterialLine,
  EngineeringTaskRecord,
} from './pcs-engineering-master-types.ts'

function nowText(): string {
  return new Date().toLocaleString('zh-CN', { hour12: false })
}

function getColorTask(masterOrderId: string, taskId: string): {
  merchandiserName: string
  task: EngineeringTaskRecord
} {
  const master = getEngineeringMasterOrderById(masterOrderId)
  if (!master) throw new Error(`工程主单不存在：${masterOrderId}`)
  const task = master.tasks.find((item) => item.taskId === taskId)
  if (!task) throw new Error(`工程任务不存在：${taskId}`)
  if (task.taskType !== 'COLOR_YARN' && task.taskType !== 'COLOR_FABRIC') {
    throw new Error('仅调色任务支持调色三阶段操作。')
  }
  return { merchandiserName: master.merchandiserName, task }
}

function listApplicableLines(task: EngineeringTaskRecord): EngineeringTaskMaterialLine[] {
  return task.materialLines.filter((line) => line.requirementType === '染色' && line.status === '正常')
}

function assertUniqueLineIds(lines: Array<{ materialLineId: string }>): void {
  const seen = new Set<string>()
  for (const line of lines) {
    if (seen.has(line.materialLineId)) throw new Error(`重复维护物料行：${line.materialLineId}`)
    seen.add(line.materialLineId)
  }
}

function assertExactLineSet(
  expectedLines: EngineeringTaskMaterialLine[],
  actualLines: Array<{ materialLineId: string }>,
): void {
  const actualIds = new Set(actualLines.map((line) => line.materialLineId))
  const missing = expectedLines.filter((line) => !actualIds.has(line.materialLineId))
  if (missing.length > 0) throw new Error(`整批确认不得遗漏当前染色物料行：${missing.map((line) => line.materialLineId).join('、')}`)
}

export function listEngineeringColorBomLines(masterOrderId: string, taskId: string): EngineeringTaskMaterialLine[] {
  return listApplicableLines(getColorTask(masterOrderId, taskId).task).map((line) => ({
    ...line,
    resultFileIds: [...line.resultFileIds],
    effectImageIds: [...line.effectImageIds],
  }))
}

export interface ConfirmEngineeringColorRequirementLine {
  materialLineId: string
  pantoneColorCode: string
  colorName: string
  dyeColorCode: string
}

export interface ConfirmEngineeringColorRequirementsInput {
  masterOrderId: string
  taskId: string
  confirmedBy: string
  requirements: ConfirmEngineeringColorRequirementLine[]
}

export function confirmEngineeringColorRequirements(
  input: ConfirmEngineeringColorRequirementsInput,
): EngineeringTaskRecord {
  const { merchandiserName, task } = getColorTask(input.masterOrderId, input.taskId)
  const confirmedBy = input.confirmedBy.trim()
  if (!confirmedBy || confirmedBy !== merchandiserName) throw new Error('仅主单跟单可以确认染色要求。')
  if (task.status === '未启用') throw new Error('调色任务未启用，不能确认染色要求。')
  if (task.status !== '进行中') {
    throw new Error(task.status === '待开始' ? '请先点击“开始任务”，再确认染色要求。' : `调色任务处于${task.status}，不能确认染色要求。`)
  }
  if (task.colorRequirementConfirmedAt) throw new Error('当前染色要求已经整批确认。')

  assertUniqueLineIds(input.requirements)
  const applicableLines = listApplicableLines(task)
  if (applicableLines.length === 0) throw new Error('暂无有效染色物料，不能确认染色要求。')
  for (const requirement of input.requirements) {
    if (!applicableLines.some((line) => line.materialLineId === requirement.materialLineId)) {
      throw new Error(`包含非当前有效染色物料行：${requirement.materialLineId}`)
    }
    if (!requirement.pantoneColorCode.trim()) throw new Error(`物料行 ${requirement.materialLineId} 缺少潘通色卡色号。`)
    if (!requirement.colorName.trim()) throw new Error(`物料行 ${requirement.materialLineId} 缺少颜色名称。`)
    if (!requirement.dyeColorCode.trim()) throw new Error(`物料行 ${requirement.materialLineId} 缺少染色色号。`)
  }
  assertExactLineSet(applicableLines, input.requirements)

  const confirmedAt = nowText()
  return updateEngineeringTaskRecord(input.masterOrderId, input.taskId, (storedTask) => {
    for (const requirement of input.requirements) {
      const line = storedTask.materialLines.find((item) => item.materialLineId === requirement.materialLineId)!
      line.pantoneColorCode = requirement.pantoneColorCode.trim()
      line.colorName = requirement.colorName.trim()
      line.dyeColorCode = requirement.dyeColorCode.trim()
    }
    storedTask.colorRequirementConfirmedBy = confirmedBy
    storedTask.colorRequirementConfirmedAt = confirmedAt
  }).task
}

export interface SubmitEngineeringColorResultLine {
  materialLineId: string
  resultFileIds: string[]
  effectImageIds: string[]
  dyeFactoryName: string
}

export interface SubmitEngineeringColorResultsInput {
  masterOrderId: string
  taskId: string
  submittedBy: string
  results: SubmitEngineeringColorResultLine[]
}

export function submitEngineeringColorResults(input: SubmitEngineeringColorResultsInput): EngineeringTaskRecord {
  const { task } = getColorTask(input.masterOrderId, input.taskId)
  if (!task.colorRequirementConfirmedAt) throw new Error('请先由跟单确认染色要求。')
  for (const result of input.results) {
    if (!result.dyeFactoryName.trim()) throw new Error(`物料行 ${result.materialLineId} 缺少染厂。`)
  }
  return submitEngineeringMaterialResults(input)
}

export interface EngineeringColorPreparationProjectionTime {
  itemType: string
  stageType: 'COLOR_REQUIREMENT_CONFIRMATION' | 'BUYER_REVIEW'
  completedAt: string
}

export function listEngineeringColorPreparationProjectionTimes(
  masterOrderId: string,
  taskId: string,
): EngineeringColorPreparationProjectionTime[] {
  const { task } = getColorTask(masterOrderId, taskId)
  return listPreparationProjectionItems()
    .filter((item) => item.taskType === task.taskType && (
      item.stageType === 'COLOR_REQUIREMENT_CONFIRMATION' || item.stageType === 'BUYER_REVIEW'
    ))
    .map((item) => ({
      itemType: item.itemType,
      stageType: item.stageType as EngineeringColorPreparationProjectionTime['stageType'],
      completedAt: item.stageType === 'COLOR_REQUIREMENT_CONFIRMATION'
        ? task.colorRequirementConfirmedAt
        : task.colorResultCompletedAt,
    }))
}
