import {
  assertPatternTaskMemberInTeam,
  getPatternTaskMember,
  getPatternTaskTeamName,
} from './pcs-pattern-task-team-config.ts'
import {
  getPatternTaskById,
  updatePatternTask,
} from './pcs-pattern-task-repository.ts'
import { nowTaskText } from './pcs-task-source-normalizer.ts'
import type {
  PatternTaskBuyerReviewStatus,
  PatternTaskRecord,
  PatternTaskTeamCode,
} from './pcs-pattern-task-types.ts'

export function reviewPatternTaskByBuyer(
  patternTaskId: string,
  reviewStatus: PatternTaskBuyerReviewStatus,
  reviewerName = '文锋',
  reviewNote = '',
): PatternTaskRecord {
  const task = getPatternTaskById(patternTaskId)
  if (!task) throw new Error('未找到花型任务。')
  if (reviewStatus === '买手已驳回' && !reviewNote.trim()) {
    throw new Error('买手驳回必须填写说明。')
  }
  const now = nowTaskText()
  const nextStatus = reviewStatus === '买手已通过' ? '已确认' : '进行中'
  const updated = updatePatternTask(patternTaskId, {
    buyerReviewStatus: reviewStatus,
    buyerReviewAt: now,
    buyerReviewerName: reviewerName,
    buyerReviewNote: reviewNote,
    status: nextStatus,
    updatedAt: now,
    updatedBy: reviewerName,
  })
  if (!updated) throw new Error('买手确认更新失败。')
  return updated
}

export function transferPatternTaskToChinaTeam(
  patternTaskId: string,
  reason: string,
  memberId = 'cn_bing_bing',
  operatorName = '当前用户',
): PatternTaskRecord {
  const task = getPatternTaskById(patternTaskId)
  if (!task) throw new Error('未找到花型任务。')
  if (!reason.trim()) throw new Error('转派中国团队必须填写原因。')
  const targetTeamCode: PatternTaskTeamCode = 'CN_TEAM'
  assertPatternTaskMemberInTeam(targetTeamCode, memberId)
  const member = getPatternTaskMember(targetTeamCode, memberId)
  const now = nowTaskText()
  const updated = updatePatternTask(patternTaskId, {
    transferFromTeamCode: task.assignedTeamCode,
    transferFromTeamName: task.assignedTeamName,
    transferToTeamCode: targetTeamCode,
    transferToTeamName: getPatternTaskTeamName(targetTeamCode),
    transferReason: reason.trim(),
    transferredAt: now,
    transferOperatorName: operatorName,
    assignedTeamCode: targetTeamCode,
    assignedTeamName: getPatternTaskTeamName(targetTeamCode),
    assignedMemberId: member?.memberId || '',
    assignedMemberName: member?.memberName || '',
    assignedAt: now,
    updatedAt: now,
    updatedBy: operatorName,
  })
  if (!updated) throw new Error('花型任务转派失败。')
  return updated
}

export function assertPatternTaskAssignmentValid(task: PatternTaskRecord): void {
  assertPatternTaskMemberInTeam(task.assignedTeamCode, task.assignedMemberId)
}
