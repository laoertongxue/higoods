import type { EngineeringTaskRecord } from './pcs-engineering-master-types.ts'

// 只读进度：准备项和内部明细分开计数；不根据展示结果改写业务状态。
export function summarizeEngineeringTaskItems(task: Pick<EngineeringTaskRecord, 'taskType' | 'materialLines'>, coveredSkuIds: readonly string[] = []) {
  const requirement = task.taskType === 'PATTERN_ARTWORK' ? '印花'
    : task.taskType === 'COLOR_FABRIC' || task.taskType === 'COLOR_YARN' ? '染色'
    : task.taskType === 'ACCESSORY_PURCHASE' ? '辅料' : null
  const lines = requirement ? (task.materialLines || []).filter(line => line.status === '正常' && line.requirementType === requirement) : []
  const isDone = (line: typeof lines[number]) => requirement === '辅料' ? coveredSkuIds.includes(line.materialSkuId) : line.reviewStatus === '通过'
  const completed = lines.filter(isDone).length
  return {
    applicable: Boolean(requirement), lines, total: lines.length, completed,
    remaining: lines.filter(line => !isDone(line)),
    allCompleted: lines.length > 0 && completed === lines.length,
    pendingReview: requirement === '辅料' ? 0 : lines.filter(line => line.reviewStatus === '待审核').length,
    rework: requirement === '辅料' ? 0 : lines.filter(line => line.reviewStatus === '未通过').length,
  }
}
