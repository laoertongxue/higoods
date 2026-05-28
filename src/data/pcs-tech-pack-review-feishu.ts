import {
  getTechnicalDataVersionById,
  listTechnicalDataVersions,
  updateTechnicalDataVersionRecord,
} from './pcs-technical-data-version-repository.ts'
import {
  appendTechPackReviewNotification,
  listTechPackReviewNotifications,
} from './pcs-tech-pack-review-notification-repository.ts'
import { buildTechPackReviewDiffSnapshot } from './pcs-tech-pack-review-diff.ts'
import type {
  TechnicalDataVersionRecord,
  TechnicalReviewNode,
  TechnicalReviewNodeKey,
  TechnicalReviewNotificationRecord,
  TechnicalReviewNotificationType,
} from './pcs-technical-data-version-types.ts'

function nowText(): string {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`
}

function todayKey(at: string): string {
  return at.slice(0, 10)
}

function randomSuffix(length: number): string {
  return Math.random().toString(36).slice(2, 2 + length).toUpperCase().padEnd(length, '0')
}

function getReviewNode(record: TechnicalDataVersionRecord, nodeKey: TechnicalReviewNodeKey): TechnicalReviewNode {
  if (nodeKey === 'BUYER') return record.buyerReview!
  if (nodeKey === 'PATTERN_MAKER') return record.patternMakerReview!
  return record.merchandiserReview!
}

function patchReviewNode(
  record: TechnicalDataVersionRecord,
  nodeKey: TechnicalReviewNodeKey,
  node: TechnicalReviewNode,
  updatedAt: string,
  updatedBy: string,
): TechnicalDataVersionRecord | null {
  return updateTechnicalDataVersionRecord(record.technicalVersionId, {
    ...(nodeKey === 'BUYER'
      ? { buyerReview: node }
      : nodeKey === 'PATTERN_MAKER'
      ? { patternMakerReview: node }
      : { merchandiserReview: node }),
    updatedAt,
    updatedBy,
  })
}

function buildDeepLink(record: TechnicalDataVersionRecord): string {
  return `/pcs/products/styles/${encodeURIComponent(record.styleId)}/technical-data/${encodeURIComponent(record.technicalVersionId)}`
}

function shouldNotifyNode(record: TechnicalDataVersionRecord, nodeKey: TechnicalReviewNodeKey): boolean {
  const node = getReviewNode(record, nodeKey)
  if (node.status !== '待审核' && node.status !== '审核中') return false
  if (record.reviewStage === '第一阶段并行审核') return nodeKey === 'BUYER' || nodeKey === 'PATTERN_MAKER'
  if (record.reviewStage === '跟单复核') return nodeKey === 'MERCHANDISER'
  return false
}

function hasDailyNotification(input: {
  technicalVersionId: string
  nodeKey: TechnicalReviewNodeKey
  dateKey: string
}): boolean {
  return listTechPackReviewNotifications().some(
    (item) =>
      item.technicalVersionId === input.technicalVersionId &&
      item.nodeKey === input.nodeKey &&
      item.notificationType === '每日提醒' &&
      item.sentAt.startsWith(input.dateKey),
  )
}

export function sendTechPackReviewFeishuNotification(input: {
  technicalVersionId: string
  nodeKey: TechnicalReviewNodeKey
  notificationType: TechnicalReviewNotificationType
  sentAt?: string
  createdBy?: string
}): TechnicalReviewNotificationRecord {
  const sentAt = input.sentAt || nowText()
  const record = getTechnicalDataVersionById(input.technicalVersionId)
  if (!record) throw new Error('未找到技术包版本，不能发送飞书提醒。')
  const node = getReviewNode(record, input.nodeKey)
  const diff = buildTechPackReviewDiffSnapshot(record, input.nodeKey)
  const failedReason = !node.assignedReviewerId
    ? '未指定审核人'
    : !node.assignedReviewerFeishuOpenId
    ? '审核人未绑定飞书账号'
    : ''
  const sendStatus = failedReason ? '发送失败' : '已发送'
  const notification: TechnicalReviewNotificationRecord = appendTechPackReviewNotification({
    notificationId: `TPRN-${record.technicalVersionId}-${input.nodeKey}-${sentAt.replace(/[^0-9]/g, '')}-${randomSuffix(4)}`,
    technicalVersionId: record.technicalVersionId,
    technicalVersionCode: record.technicalVersionCode,
    styleId: record.styleId,
    styleCode: record.styleCode,
    styleName: record.styleName,
    nodeKey: input.nodeKey,
    nodeName: node.nodeName,
    notificationType: input.notificationType,
    reviewerId: node.assignedReviewerId,
    reviewerName: node.assignedReviewerName,
    reviewerRole: node.reviewerRole,
    feishuOpenId: node.assignedReviewerFeishuOpenId,
    reviewStatusSnapshot: node.status,
    diffSummarySnapshot: diff.summaryText,
    sendStatus,
    sentAt,
    failedReason,
    feishuMessageId: sendStatus === '已发送' ? `om_${record.technicalVersionId}_${input.nodeKey}_${randomSuffix(6)}` : '',
    deepLink: buildDeepLink(record),
    createdBy: input.createdBy || '系统',
  })

  patchReviewNode(
    record,
    input.nodeKey,
    {
      ...node,
      diffSnapshotId: diff.snapshotId,
      diffStatus: diff.diffStatus,
      diffSummaryText: diff.summaryText,
      lastFeishuNotifyAt: sentAt,
      lastFeishuNotifyStatus: sendStatus,
      lastFeishuNotifyRecordId: notification.notificationId,
      todayFeishuNotifiedFlag: input.notificationType === '每日提醒' ? sendStatus === '已发送' : node.todayFeishuNotifiedFlag,
      todayFeishuNotifyAt: input.notificationType === '每日提醒' ? sentAt : node.todayFeishuNotifyAt,
      feishuNotifyCount: node.feishuNotifyCount + 1,
    },
    sentAt,
    input.createdBy || '系统',
  )

  return notification
}

export function runDailyTechPackReviewFeishuNotifications(input?: {
  dateKey?: string
  sentAt?: string
  operatorName?: string
}): TechnicalReviewNotificationRecord[] {
  const sentAt = input?.sentAt || nowText()
  const dateKey = input?.dateKey || todayKey(sentAt)
  const records: TechnicalReviewNotificationRecord[] = []
  listTechnicalDataVersions()
    .filter((record) => record.versionStatus === 'DRAFT')
    .forEach((record) => {
      ;(['BUYER', 'PATTERN_MAKER', 'MERCHANDISER'] as TechnicalReviewNodeKey[]).forEach((nodeKey) => {
        const node = getReviewNode(record, nodeKey)
        if (!shouldNotifyNode(record, nodeKey)) return
        if (node.todayFeishuNotifyAt.startsWith(dateKey) || hasDailyNotification({ technicalVersionId: record.technicalVersionId, nodeKey, dateKey })) return
        records.push(
          sendTechPackReviewFeishuNotification({
            technicalVersionId: record.technicalVersionId,
            nodeKey,
            notificationType: '每日提醒',
            sentAt,
            createdBy: input?.operatorName || '系统每日提醒',
          }),
        )
      })
    })
  return records
}
