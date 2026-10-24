import type { FeedbackPhase2Collections, FeedbackPhase2Payload } from './phase2-types.ts'
import type { FeedbackPhase3Collections, FeedbackPhase3Payload } from './phase3-types.ts'
import type { ChannelCode } from '../pcs-channel-catalog-types.ts'

export const FEEDBACK_OWNER = '小羊.高阳.kiko'
export const FEEDBACK_RULE_VERSION = 'V1.3'
export const FEEDBACK_TIME_ZONE = 'Asia/Jakarta'
export const FEEDBACK_THEMES = ['面料与穿着', '做工与质量', '尺码与版型', '颜色与外观', '展示与预期', '发货与物流', '使用与价值', '原因不明'] as const
export const FEEDBACK_VALUES = ['具体反馈', '一般反馈', '仅评分', '无关内容', '待判断', '信息不足（已复核）'] as const
export type FeedbackTheme = typeof FEEDBACK_THEMES[number]
export type FeedbackValue = typeof FEEDBACK_VALUES[number]
export type FeedbackDisposition = 'N' | 'M' | 'D' | 'X' | 'F' | 'P'
export type FeedbackTaskStatus = '未开始' | '进行中' | '部分完成' | '已完成' | '失败'
export interface FeedbackRange { start: string; end: string }
export interface FeedbackSchedule {
  id: string; storeId: string; owner: string; effectiveDate: string; status: '草稿' | '已启用'; version: number
  reason: string; createdAt: string; updatedAt: string; actor: string; previousId?: string
}
export interface FeedbackTask {
  id: string; storeId: string; owner: string; type: '日常采集' | '历史补采'; businessDate: string
  target: FeedbackRange; core: FeedbackRange; deadline: string; scheduleId: string; scheduleVersion: number
  scope: '全店评价入口' | '指定链接'; listingIds: string[]; createdAt: string; reason: string; version: number
  historyBaselineDate?: string; stockCheck?: string; inaccessibleRanges?: Array<FeedbackRange & { reason: string }>
}
export interface FeedbackHistoryDraft {
  id: string; storeId: string; owner: string; startDate: string; endDate: string; deadline: string; reason: string
  stockCheck: string; scope: '全店评价入口' | '指定链接'; listingIds: string[]; version: number; updatedAt: string; actor: string
  values?: Record<string, string>; resolved?: boolean; generatedTaskIds?: string[]
}
export interface FeedbackReviewDraft { id: string; kind: 'coverage' | 'rejudge'; objectId: string; values: Record<string, string>; version: number; actor: string; updatedAt: string; resolved?: boolean }
export interface FeedbackCoverage {
  range: FeedbackRange; allRatings: boolean; includesRatingOnly: boolean; includesWithoutImages: boolean
  scope: '全店评价入口' | '指定链接'; listingIds: string[]; endReason: string; evidence: string
  verified: boolean; persistedAt: string; verifiedAt?: string; verifiedBy?: string
  missingRanges: Array<FeedbackRange & { reason: string }>; missingListingIds: string[]
}
export interface FeedbackExecution {
  id: string; storeId: string; taskId: string; collector: string; startedAt: string; endedAt: string | null
  toolVersion: string; coverage: FeedbackCoverage; status: '进行中' | '结束' | '失败'; failure: string; version: number
  terminalReceipt: FeedbackExecutionTerminal | null
}
/** Issued once by the collection source after it has finalized the original upload set. */
export interface FeedbackExecutionTerminal {
  id: string; batches: Array<{ batchId: string; rowIds: string[] }>; rawCount: number
  endedAt: string; persistedAt: string; evidence: string
}
export interface FeedbackRawReview {
  storeId: string; channel: ChannelCode; market: string; listingId: string; platformProductId: string
  nativeReviewId: string | null; author: string; platformUserId: string | null; content: string; rating: number | null
  commentAt: string | null; timeQuality: '可信' | '未知' | '待核实'; timePrecision: '秒' | '日' | '未知'
  platformModifiedAt: string | null; sourceVersion: number | null; orderNo: string; orderLineId: string
  platformVariantId: string; sellerSku: string; color: string; size: string; language: string
  images: string[]; reply: string; replyAt: string | null; legacyFingerprint?: string
}
export interface FeedbackSourceRow {
  id: string; raw: FeedbackRawReview | null; rawNote: string; outcome: FeedbackDisposition; commentId: string | null
  reason: string; processedAt: string | null; repairedBy?: { batchId: string; rowId: string; at: string; actor: string; evidence: string }
}
export interface FeedbackCounts { U: number; N: number; M: number; D: number; X: number; F: number; P: number }
export interface FeedbackReceipt { version: number; at: string; counts: FeedbackCounts; rows: FeedbackSourceRow[] }
export interface FeedbackBatch {
  id: string; executionId: string; taskId: string; storeId: string; collector: string; submitter: string
  payloadDigest: string; receivedAt: string; durable: boolean; processingStartedAt: string | null; processingEndedAt: string | null
  cleaningVersion: string; rows: FeedbackSourceRow[]; receipts: FeedbackReceipt[]; version: number
  attempts: Array<{ at: string; result: string }>; originBatchId?: string
  repairReferences?: Array<{ originalBatchId: string; originalRowId: string; repairedRowId: string; evidence: string; actor: string }>
}
export interface FeedbackAssociation {
  listingId: string; styleId: string; skuId: string | null; mappingVersion: number | null; evidence: string
  sourceEventAt: string | null; status: '已确认' | 'SKU 未确定'; version: number; actor: string; at: string
}
export interface FeedbackTag { theme: FeedbackTheme; sentiment: '正向' | '问题' | '中性'; evidence: string }
export interface FeedbackClassification {
  id: string; contentVersion: number; value: FeedbackValue; tags: FeedbackTag[]; note: string
  state: '草稿' | '待复核' | '已确认' | '已撤回'; actor: string; at: string; reviewer: string; reviewedAt: string | null
  ruleVersion: string; version: number; bulk: boolean
}
export interface FeedbackComment {
  id: string; identityKey: string; identityMethod: '平台原生 ID' | '组合指纹'; fingerprintVersion: string
  raw: FeedbackRawReview; contentVersion: number; version: number; firstBatchId: string; firstExecutionId: string
  firstTaskId: string; firstCollector: string; collectedAt: string; firstStoredAt: string; lastObservedAt: string; updatedAt: string
  association: FeedbackAssociation; associationHistory: FeedbackAssociation[]; classifications: FeedbackClassification[]
  history: Array<{ version: number; raw: FeedbackRawReview; batchId: string; observedAt: string; reason: string }>
  observations: Array<{ batchId: string; rowId: string; at: string; result: string }>
}
export interface FeedbackMetric {
  id: string; listingId: string; name: '销量' | '平台累计评论数' | '平台评分'; value: number | null; unit: string
  basis: '累计' | '区间'; range: FeedbackRange | null; asOf: string; source: string
}
export interface FeedbackLog { order?: number; id: string; objectId: string; action: string; detail: string; actor: string; at: string; before?: string; after?: string; payloadDigest?: string }
export interface FeedbackSnapshot extends FeedbackPhase2Collections, FeedbackPhase3Collections {
  version: number; seedVersion: string; asOf: string; schedules: FeedbackSchedule[]; tasks: FeedbackTask[]
  executions: FeedbackExecution[]; batches: FeedbackBatch[]; comments: FeedbackComment[]; metrics: FeedbackMetric[]
  logs: FeedbackLog[]; notes: Array<{ order?: number; id: string; scope: string; commentIds: string[]; content: string; actor: string; at: string }>
  historyDrafts: FeedbackHistoryDraft[]
  reviewDrafts: FeedbackReviewDraft[]
}
export interface FeedbackTaskAssessment {
  status: FeedbackTaskStatus; executionStatus: '未开始' | '进行中' | '范围完成' | '部分完成' | '失败' | '覆盖待核验'
  processingStatus: '未接收' | '已接收待处理' | '处理中' | '处理完成' | '存在失败异常'
  coverageComplete: boolean; deliveredAt: string | null; completedAt: string | null; due: boolean; overdue: boolean
  onTimeDelivery: boolean; onTimeCompletion: boolean; gaps: string[]; counts: FeedbackCounts; unresolved: number
  repaired: number; batchIds: string[]; executionIds: string[]; lastActivityAt: string
}
export interface FeedbackCommentFilter {
  storeId?: string; channel?: string; styleId?: string; skuId?: string; listingId?: string; platformProductId?: string
  search?: string; rating?: string; theme?: string; classification?: string; value?: string; association?: string
  dateType?: 'comment' | 'stored' | 'collected'; start?: string; end?: string; unknownTimeOnly?: boolean
  hasImages?: boolean; batchId?: string; taskId?: string; sentiment?: string
}
export interface FeedbackSummary {
  total: number; rated: number; average: number | null; negative: number; neutral: number; positive: number; negativeRate: number | null
  ratingOnly: number; withContent: number; withImages: number; unclassified: number; classified: number; unknownSku: number
  unknownTime: number; smallSample: boolean; problemComments: number; positiveFeedback: number; stars: number[]
  themes: Array<{ theme: FeedbackTheme; total: number; problem: number; positive: number; rate: number | null; commentIds: string[] }>
}
export interface FeedbackPersonnel {
  owner: string; due: number; onTimeDelivery: number; completed: number; onTimeCompletion: number; lateCompletion: number
  incomplete: number; upcoming: number; deliveryRate: number | null; completionRate: number | null
  executions: number; newComments: number; updated: number; duplicates: number; excluded: number; unresolved: number; collaboration: number
}
export interface FeedbackCommandBase { operationId: string; actor: string; at?: string; draftId?: string }
export type FeedbackCommand = FeedbackCommandBase & (
  | FeedbackPhase3Payload
  | FeedbackPhase2Payload
  | { type: 'save-schedule'; schedule: Omit<FeedbackSchedule, 'version' | 'createdAt' | 'updatedAt' | 'actor'>; expectedVersion: number }
  | { type: 'create-history'; task: Omit<FeedbackTask, 'version' | 'createdAt' | 'scheduleVersion'>; allowOverlap: boolean }
  | { type: 'create-history-plan'; tasks: Array<Omit<FeedbackTask, 'version' | 'createdAt' | 'scheduleVersion'>>; allowOverlap: boolean; draftId?: string }
  | { type: 'save-history-draft'; draft: Omit<FeedbackHistoryDraft, 'version' | 'updatedAt' | 'actor'>; expectedVersion: number }
  | { type: 'save-review-draft'; draft: Omit<FeedbackReviewDraft, 'version' | 'updatedAt' | 'actor'>; expectedVersion: number }
  | { type: 'save-classification'; commentId: string; expectedVersion: number; expectedContentVersion: number; value: FeedbackValue; tags: FeedbackTag[]; note: string; state: '草稿' | '待复核' | '已确认' }
  | { type: 'withdraw-classification'; commentId: string; classificationId: string; expectedVersion: number; reason: string }
  | { type: 'bulk-classification'; commentIds: string[]; expectedVersions: Record<string, number>; tags: FeedbackTag[]; note: string }
  | { type: 'bulk-submit-review'; commentIds: string[]; expectedVersions: Record<string, number>; expectedContentVersions: Record<string, number> }
  | { type: 'correct-association'; commentId: string; expectedVersion: number; association: FeedbackAssociation; reason: string }
  | { type: 'review-coverage'; executionId: string; expectedVersion: number; conclusion: '通过' | '退回补证' | '证据不足'; evidence: string; reason: string; supplemental?: FeedbackCoverage }
  | { type: 'rejudge-task'; taskId: string; expectedVersion: number; executionId: string; reason: string }
  | { type: 'save-note'; scope: string; commentIds: string[]; content: string }
  | { type: 'ingest-batch'; batch: FeedbackBatch; execution: FeedbackExecution }
  | { type: 'process-batch'; batchId: string; expectedVersion: number; cleaningVersion: string; results: Array<{ rowId: string; outcome: '处理' | 'X' | 'F'; reason: string }> }
  | { type: 'finish-execution'; executionId: string; expectedVersion: number; endedAt: string; status: '结束' | '失败'; terminalReceipt: FeedbackExecutionTerminal }
)
