import { buildTechPackReviewDiffSnapshot } from './pcs-tech-pack-review-diff.ts'
import { sendTechPackReviewFeishuNotification } from './pcs-tech-pack-review-feishu.ts'
import { appendTechPackVersionLog } from './pcs-tech-pack-version-log-repository.ts'
import type {
  TechnicalDataVersionRecord,
  TechnicalReviewDiffSnapshot,
  TechnicalReviewNode,
  TechnicalReviewNodeKey,
} from './pcs-technical-data-version-types.ts'
import type { TechPackVersionLogType } from './pcs-tech-pack-version-log-types.ts'

let reviewLogSequence = 0

export function withReviewDiffSnapshot(
  record: TechnicalDataVersionRecord,
  node: TechnicalReviewNode,
  override?: Pick<TechnicalReviewDiffSnapshot, 'diffStatus' | 'summaryText'>,
): TechnicalReviewNode {
  const diff = buildTechPackReviewDiffSnapshot(record, node.nodeKey)
  return {
    ...node,
    diffSnapshotId: diff.snapshotId,
    diffStatus: override?.diffStatus ?? diff.diffStatus,
    diffSummaryText: override?.summaryText ?? diff.summaryText,
  }
}

export function appendReviewLog(input: {
  record: TechnicalDataVersionRecord
  logType: TechPackVersionLogType
  changeText: string
  operatorName: string
  createdAt: string
  logKey?: string
}): void {
  appendTechPackVersionLog({
    logId: `tech_pack_review_${input.record.technicalVersionId}_${input.createdAt.replace(/[^0-9]/g, '')}_${Date.now()}_${++reviewLogSequence}_${input.logType}${input.logKey ? `_${input.logKey}` : ''}`,
    technicalVersionId: input.record.technicalVersionId,
    technicalVersionCode: input.record.technicalVersionCode,
    versionLabel: input.record.versionLabel,
    styleId: input.record.styleId,
    styleCode: input.record.styleCode,
    logType: input.logType,
    sourceTaskType: '',
    sourceTaskId: '',
    sourceTaskCode: '',
    sourceTaskName: '',
    changeScope: '',
    changeText: input.changeText,
    beforeVersionId: input.record.baseTechnicalVersionId || '',
    beforeVersionCode: input.record.baseTechnicalVersionCode || '',
    afterVersionId: input.record.technicalVersionId,
    afterVersionCode: input.record.technicalVersionCode,
    createdAt: input.createdAt,
    createdBy: input.operatorName,
  })
}

export function sendReviewNotificationSafely(input: {
  technicalVersionId: string
  nodeKey: TechnicalReviewNodeKey
  notificationType: '提交审核' | '进入跟单复核' | '打回复审'
  createdBy: string
  diffSnapshot?: Pick<TechnicalReviewDiffSnapshot, 'snapshotId' | 'diffStatus' | 'summaryText'>
}): void {
  try {
    sendTechPackReviewFeishuNotification(input)
  } catch {
    // 原型环境下飞书提醒失败不阻断审核主流程，失败本身由通知账记录。
  }
}
