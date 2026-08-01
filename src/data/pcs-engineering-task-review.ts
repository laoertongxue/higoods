// 工程专业任务逐项审核：只读写工程主单任务及其物料行，不维护第二套专业任务事实。

import {
  getEngineeringMasterOrderById,
  updateEngineeringTaskRecord,
} from './pcs-engineering-master-repository.ts'
import type {
  EngineeringTaskMaterialLine,
  EngineeringTaskRecord,
  EngineeringTaskType,
} from './pcs-engineering-master-types.ts'

const REVIEWABLE_TASK_TYPES: EngineeringTaskType[] = [
  'PATTERN_ARTWORK',
  'COLOR_YARN',
  'COLOR_FABRIC',
]

function nowText(): string {
  return new Date().toLocaleString('zh-CN', { hour12: false })
}

function getReviewableTask(masterOrderId: string, taskId: string): EngineeringTaskRecord {
  const master = getEngineeringMasterOrderById(masterOrderId)
  if (!master) throw new Error(`工程主单不存在：${masterOrderId}`)
  const task = master.tasks.find((item) => item.taskId === taskId)
  if (!task) throw new Error(`工程任务不存在：${taskId}`)
  if (!REVIEWABLE_TASK_TYPES.includes(task.taskType)) {
    throw new Error('仅花型与调色任务支持逐项审核。')
  }
  return task
}

function assertUniqueLineIds(lines: Array<{ materialLineId: string }>, actionLabel: string): void {
  const seen = new Set<string>()
  for (const line of lines) {
    if (seen.has(line.materialLineId)) {
      throw new Error(`重复${actionLabel}物料行：${line.materialLineId}`)
    }
    seen.add(line.materialLineId)
  }
}

function assertExactLineSet(
  expectedLines: EngineeringTaskMaterialLine[],
  actualLines: Array<{ materialLineId: string }>,
  actionLabel: string,
): void {
  const actualIds = new Set(actualLines.map((line) => line.materialLineId))
  const missingIds = expectedLines
    .map((line) => line.materialLineId)
    .filter((materialLineId) => !actualIds.has(materialLineId))
  if (missingIds.length > 0) {
    throw new Error(`${actionLabel}不得遗漏当前物料行：${missingIds.join('、')}`)
  }
}

export interface SubmitEngineeringMaterialResultLine {
  materialLineId: string
  resultFileIds: string[]
  effectImageIds: string[]
}

export interface SubmitEngineeringMaterialResultsInput {
  masterOrderId: string
  taskId: string
  submittedBy: string
  results: SubmitEngineeringMaterialResultLine[]
}

export function submitEngineeringMaterialResults(input: SubmitEngineeringMaterialResultsInput): EngineeringTaskRecord {
  const task = getReviewableTask(input.masterOrderId, input.taskId)
  const submittedBy = input.submittedBy.trim()
  if (!submittedBy) throw new Error('请填写成果提交人。')
  if (task.status !== '返工中' && task.status !== '进行中' && task.status !== '待开始') {
    throw new Error('当前任务状态不能提交逐项成果。')
  }

  assertUniqueLineIds(input.results, '提交')
  const activeLines = task.materialLines.filter((line) => line.status === '正常')
  for (const result of input.results) {
    const line = activeLines.find((item) => item.materialLineId === result.materialLineId)
    if (!line) throw new Error(`成果提交包含非当前有效物料行：${result.materialLineId}`)
    if (line.reviewStatus === '通过') throw new Error(`物料行 ${result.materialLineId} 已通过并锁定，不能修改。`)
    if (task.status === '返工中' && line.reviewStatus !== '未通过') {
      throw new Error(`物料行 ${result.materialLineId} 不是本轮返工行。`)
    }
    const hasResult = [...result.resultFileIds, ...result.effectImageIds].some((item) => item.trim())
    if (!hasResult) throw new Error(`物料行 ${result.materialLineId} 缺少成果文件或效果图。`)
  }
  const expectedLines = task.status === '返工中'
    ? activeLines.filter((line) => line.reviewStatus === '未通过')
    : activeLines.filter((line) => line.reviewStatus !== '通过')
  assertExactLineSet(expectedLines, input.results, '整单成果提交')

  const submittedAt = nowText()
  return updateEngineeringTaskRecord(input.masterOrderId, input.taskId, (storedTask) => {
    for (const result of input.results) {
      const line = storedTask.materialLines.find((item) => item.materialLineId === result.materialLineId)!
      line.resultFileIds = result.resultFileIds.map((item) => item.trim()).filter(Boolean)
      line.effectImageIds = result.effectImageIds.map((item) => item.trim()).filter(Boolean)
      line.resultSubmittedBy = submittedBy
      line.resultSubmittedAt = submittedAt
      line.reviewStatus = '待审核'
      line.reviewReason = ''
      line.reviewedBy = ''
      line.reviewedAt = ''
    }
    storedTask.status = '待审核'
    if (!storedTask.startedAt) storedTask.startedAt = submittedAt
    storedTask.submittedAt = submittedAt
    const activeReworkRound = storedTask.reworkRounds.at(-1)
    if (activeReworkRound && !activeReworkRound.passedAt) activeReworkRound.submittedAt = submittedAt
  }).task
}

export type MaterialReviewDecision = '通过' | '未通过'

export interface ReviewEngineeringMaterialDecisionInput {
  materialLineId: string
  decision: MaterialReviewDecision
  reason: string
}

export interface ReviewEngineeringMaterialResultsInput {
  masterOrderId: string
  taskId: string
  reviewerName: string
  decisions: ReviewEngineeringMaterialDecisionInput[]
}

export interface ReviewEngineeringMaterialResultsResult {
  taskStatus: EngineeringTaskRecord['status']
  lockedPassedLineIds: string[]
  reworkLineIds: string[]
  reviewRoundNo: number
  firstCompletedAt: string
  effectiveCompletedAt: string
}

export function reviewEngineeringMaterialResults(
  input: ReviewEngineeringMaterialResultsInput,
): ReviewEngineeringMaterialResultsResult {
  const task = getReviewableTask(input.masterOrderId, input.taskId)
  const reviewerName = input.reviewerName.trim()
  if (!reviewerName) throw new Error('请填写审核人。')
  if (task.status !== '待审核') throw new Error('当前任务不在待审核状态。')

  assertUniqueLineIds(input.decisions, '审核')
  const activeLines = task.materialLines.filter((line) => line.status === '正常')
  const pendingLines = activeLines.filter((line) => line.reviewStatus === '待审核')
  if (pendingLines.length === 0) throw new Error('当前任务没有待审核物料行。')

  for (const decision of input.decisions) {
    const line = activeLines.find((item) => item.materialLineId === decision.materialLineId)
    if (!line) throw new Error(`审核包含非当前有效物料行：${decision.materialLineId}`)
    if (line.reviewStatus !== '待审核') {
      throw new Error(`审核包含非本轮待审核物料行：${decision.materialLineId}`)
    }
    if (decision.decision !== '通过' && decision.decision !== '未通过') {
      throw new Error(`物料行 ${decision.materialLineId} 的审核结论无效。`)
    }
    if (decision.decision === '未通过' && !decision.reason.trim()) {
      throw new Error(`物料行 ${decision.materialLineId} 必须填写未通过原因。`)
    }
  }
  assertExactLineSet(pendingLines, input.decisions, '整单审核')

  const reviewedAt = nowText()
  const decisionMap = new Map(input.decisions.map((decision) => [decision.materialLineId, decision]))
  const hasRejectedLine = input.decisions.some((decision) => decision.decision === '未通过')
  const updated = updateEngineeringTaskRecord(input.masterOrderId, input.taskId, (storedTask) => {
    for (const line of storedTask.materialLines.filter((item) => item.status === '正常' && item.reviewStatus === '待审核')) {
      const decision = decisionMap.get(line.materialLineId)!
      line.reviewStatus = decision.decision
      line.reviewReason = decision.reason.trim()
      line.reviewedBy = reviewerName
      line.reviewedAt = reviewedAt
    }

    const roundNo = storedTask.materialReviewRounds.length + 1
    storedTask.materialReviewRounds.push({
      roundNo,
      submittedAt: storedTask.submittedAt,
      submittedBy: pendingLines[0]?.resultSubmittedBy || '',
      reviewedAt,
      reviewedBy: reviewerName,
      decisions: input.decisions.map((decision) => ({
        materialLineId: decision.materialLineId,
        decision: decision.decision,
        reason: decision.reason.trim(),
        reviewedBy: reviewerName,
        reviewedAt,
      })),
    })

    if (hasRejectedLine) {
      const rejected = input.decisions.filter((decision) => decision.decision === '未通过')
      storedTask.status = '返工中'
      storedTask.effectiveCompletedAt = ''
      storedTask.reworkRounds.push({
        roundNo: storedTask.reworkRounds.length + 1,
        reason: rejected.map((decision) => `${decision.materialLineId}：${decision.reason.trim()}`).join('；'),
        startedAt: reviewedAt,
        submittedAt: '',
        passedAt: '',
      })
      return
    }

    const allEffectiveLinesPassed = storedTask.materialLines
      .filter((line) => line.status === '正常')
      .every((line) => line.reviewStatus === '通过')
    if (!allEffectiveLinesPassed) throw new Error('仍有有效物料行未通过，不能完成任务。')
    storedTask.status = '已完成'
    if (!storedTask.firstCompletedAt) storedTask.firstCompletedAt = reviewedAt
    storedTask.effectiveCompletedAt = reviewedAt
    const activeReworkRound = storedTask.reworkRounds.at(-1)
    if (activeReworkRound && !activeReworkRound.passedAt) activeReworkRound.passedAt = reviewedAt
  }).task

  return {
    taskStatus: updated.status,
    lockedPassedLineIds: updated.materialLines
      .filter((line) => line.status === '正常' && line.reviewStatus === '通过')
      .map((line) => line.materialLineId),
    reworkLineIds: updated.materialLines
      .filter((line) => line.status === '正常' && line.reviewStatus === '未通过')
      .map((line) => line.materialLineId),
    reviewRoundNo: updated.materialReviewRounds.length,
    firstCompletedAt: updated.firstCompletedAt,
    effectiveCompletedAt: updated.effectiveCompletedAt,
  }
}
