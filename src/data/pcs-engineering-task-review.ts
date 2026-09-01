// 工程专业任务逐项审核：只读写工程主单任务及其物料行，不维护第二套专业任务事实。

import {
  getEngineeringMasterOrderById,
  updateEngineeringTaskRecord,
} from './pcs-engineering-master-repository.ts'
import {
  assertPatternAssetCanBeGeneratedForEngineeringMaterialLine,
  ensurePatternAssetForEngineeringMaterialLine,
} from './pcs-pattern-library-archive-linkage.ts'
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

function listApplicableMaterialLines(task: EngineeringTaskRecord): EngineeringTaskMaterialLine[] {
  const activeLines = task.materialLines.filter((line) => line.status === '正常')
  if (task.taskType === 'COLOR_YARN' || task.taskType === 'COLOR_FABRIC') {
    return activeLines.filter((line) => line.requirementType === '染色')
  }
  return activeLines
}

export interface SubmitEngineeringMaterialResultLine {
  materialLineId: string
  resultFileIds: string[]
  effectImageIds: string[]
  dyeFactoryName?: string
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
  if (task.status !== '返工中' && task.status !== '进行中') {
    throw new Error(task.status === '待开始' ? '请先点击“开始任务”，再提交成果。' : '当前任务状态不能提交逐项成果。')
  }

  assertUniqueLineIds(input.results, '提交')
  const activeLines = listApplicableMaterialLines(task)
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
      if (typeof result.dyeFactoryName === 'string') line.dyeFactoryName = result.dyeFactoryName.trim()
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
  reviewerRole?: string
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

export function reopenEngineeringMaterialTaskForTechPackReview(input: {
  masterOrderId: string
  taskId: string
  reason: string
  materialLineIds?: string[]
}): EngineeringTaskRecord {
  const task = getReviewableTask(input.masterOrderId, input.taskId)
  const reason = input.reason.trim()
  if (!reason) throw new Error('请填写技术包退回原因。')
  if (task.status !== '已完成') {
    throw new Error(`原工程任务当前不是已完成状态，无法发起返工：${input.taskId}`)
  }

  const requestedIds = new Set((input.materialLineIds ?? []).map((item) => item.trim()).filter(Boolean))
  const activeLines = listApplicableMaterialLines(task)
    .filter((line) => requestedIds.size === 0 || requestedIds.has(line.materialLineId))
  if (activeLines.length === 0) {
    throw new Error(`原工程任务没有可返工的有效物料行：${input.taskId}`)
  }
  if (requestedIds.size > 0 && activeLines.length !== requestedIds.size) {
    throw new Error(`退回内容包含不属于当前任务的成果项：${[...requestedIds].filter((id) => !activeLines.some((line) => line.materialLineId === id)).join('、')}`)
  }

  const startedAt = nowText()
  return updateEngineeringTaskRecord(input.masterOrderId, input.taskId, (storedTask) => {
    for (const line of listApplicableMaterialLines(storedTask).filter((item) => requestedIds.size === 0 || requestedIds.has(item.materialLineId))) {
      line.reviewStatus = '未通过'
      line.reviewReason = reason
      line.reviewedBy = ''
      line.reviewedAt = ''
    }
    storedTask.status = '返工中'
    storedTask.effectiveCompletedAt = ''
    if (storedTask.taskType === 'COLOR_YARN' || storedTask.taskType === 'COLOR_FABRIC') {
      storedTask.colorResultCompletedAt = ''
    }
    storedTask.reworkRounds.push({
      roundNo: storedTask.reworkRounds.length + 1,
      reason,
      startedAt,
      submittedAt: '',
      passedAt: '',
    })
  }).task
}

const DIRECT_RESULT_TASK_TYPES: EngineeringTaskType[] = [
  'BASE_PATTERN_WOVEN',
  'BASE_PATTERN_KNIT',
  'PRE_PRODUCTION_SAMPLE',
  'SIZE_PATTERN_WOVEN',
  'SIZE_PATTERN_KNIT',
]

export function reopenEngineeringDirectResultTaskForTechPackReview(input: {
  masterOrderId: string
  taskId: string
  reason: string
}): EngineeringTaskRecord {
  const master = getEngineeringMasterOrderById(input.masterOrderId)
  if (!master) throw new Error(`工程主单不存在：${input.masterOrderId}`)
  const task = master.tasks.find((item) => item.taskId === input.taskId)
  if (!task) throw new Error(`工程任务不存在：${input.taskId}`)
  if (!DIRECT_RESULT_TASK_TYPES.includes(task.taskType)) throw new Error('当前任务不是可由技术包退回的纸样或首单样衣任务。')
  if (task.status !== '已完成') throw new Error(`原工程任务当前不是已完成状态，无法发起返工：${input.taskId}`)
  const reason = input.reason.trim()
  if (!reason) throw new Error('请填写技术包退回原因。')
  const startedAt = nowText()
  return updateEngineeringTaskRecord(input.masterOrderId, input.taskId, (storedTask) => {
    const roundNo = Math.max(storedTask.currentRoundNo, ...storedTask.reworkRounds.map((round) => round.roundNo), 0) + 1
    storedTask.currentRoundNo = roundNo
    storedTask.status = '返工中'
    storedTask.submittedAt = ''
    storedTask.effectiveCompletedAt = ''
    storedTask.events.submittedAt = ''
    storedTask.events.effectiveCompletedAt = ''
    storedTask.reworkRounds.push({ roundNo, reason, startedAt, submittedAt: '', passedAt: '' })
    storedTask.operationLogs.push({
      operationType: '技术包退回返工',
      operatorId: '',
      operatorName: '',
      operatedAt: startedAt,
      note: reason,
      roundNo,
    })
  }).task
}

export function reviewEngineeringMaterialResults(
  input: ReviewEngineeringMaterialResultsInput,
): ReviewEngineeringMaterialResultsResult {
  const task = getReviewableTask(input.masterOrderId, input.taskId)
  const reviewerName = input.reviewerName.trim()
  if (!reviewerName) throw new Error('请填写审核人。')
  if (input.reviewerRole !== '买手') {
    throw new Error('花型与调色成果只能由买手审核。')
  }
  if (task.status !== '待审核') throw new Error('当前任务不在待审核状态。')

  assertUniqueLineIds(input.decisions, '审核')
  const activeLines = listApplicableMaterialLines(task)
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
  const projectedPassedLineIds = new Set([
    ...activeLines.filter((line) => line.reviewStatus === '通过').map((line) => line.materialLineId),
    ...input.decisions.filter((decision) => decision.decision === '通过').map((decision) => decision.materialLineId),
  ])
  if (!hasRejectedLine && activeLines.some((line) => !projectedPassedLineIds.has(line.materialLineId))) {
    throw new Error('仍有有效物料行未通过，不能完成任务。')
  }

  if (task.taskType === 'PATTERN_ARTWORK') {
    const masterOrder = getEngineeringMasterOrderById(input.masterOrderId)!
    const passedDecisions = input.decisions.filter((item) => item.decision === '通过')
    for (const decision of passedDecisions) {
      const line = activeLines.find((item) => item.materialLineId === decision.materialLineId)!
      assertPatternAssetCanBeGeneratedForEngineeringMaterialLine({
        masterOrder,
        task,
        line,
        reviewerName,
        reviewedAt,
        decision: '通过',
      })
    }
    for (const decision of passedDecisions) {
      const line = activeLines.find((item) => item.materialLineId === decision.materialLineId)!
      ensurePatternAssetForEngineeringMaterialLine({
        masterOrder,
        task,
        line,
        reviewerName,
        reviewedAt,
        decision: '通过',
      })
    }
  }

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
      if (storedTask.taskType === 'COLOR_YARN' || storedTask.taskType === 'COLOR_FABRIC') {
        storedTask.colorResultCompletedAt = ''
      }
      storedTask.reworkRounds.push({
        roundNo: storedTask.reworkRounds.length + 1,
        reason: rejected.map((decision) => `${decision.materialLineId}：${decision.reason.trim()}`).join('；'),
        startedAt: reviewedAt,
        submittedAt: '',
        passedAt: '',
      })
      return
    }

    const allEffectiveLinesPassed = listApplicableMaterialLines(storedTask)
      .every((line) => line.reviewStatus === '通过')
    if (!allEffectiveLinesPassed) throw new Error('仍有有效物料行未通过，不能完成任务。')
    storedTask.status = '已完成'
    if (!storedTask.firstCompletedAt) storedTask.firstCompletedAt = reviewedAt
    storedTask.effectiveCompletedAt = reviewedAt
    if (storedTask.taskType === 'COLOR_YARN' || storedTask.taskType === 'COLOR_FABRIC') {
      storedTask.colorResultCompletedAt = reviewedAt
    }
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
