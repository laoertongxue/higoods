import type { FeedbackCommentFilter, FeedbackTag, FeedbackValue, FeedbackTheme } from './types.ts'
import type { FeedbackIssue, FeedbackIssueScope } from './phase2-types.ts'

export interface FeedbackDetailRule { id: string; theme: FeedbackTheme; label: string; sentiment: FeedbackTag['sentiment']; definition: string; exclude: string; example: string }
export interface FeedbackDetailItem { ruleId: string; evidence: string; basis: '原文' | '图片' | '中文译文'; translationId: string; note: string }
export type FeedbackDetailResult = '明确表现' | '未见明确表现' | '信息不足'
export interface FeedbackDetailAnnotation {
  id: string; commentId: string; stamp: string; contentVersion: number; classificationId: string; ruleVersion: string
  result: FeedbackDetailResult | ''; items: FeedbackDetailItem[]; note: string; state: '草稿' | '待复核' | '已确认' | '已撤回'
  revision: number; order: number; actor: string; at: string; reason: string
}
export interface FeedbackQualityReview { id: string; commentId: string; reason: string; stamp: string; result: '核对后保留' | '仍信息不足' | '已修订'; note: string; actor: string; at: string; order: number }
export type FeedbackQueuePurpose = '分类' | '补细分' | '回查'
export interface FeedbackQueueItem { commentId: string; stamp: string; outcome: '未处理' | '已完成' | '草稿' | '跳过'; reason: string; accepted: boolean }
export interface FeedbackProcessingQueue { id: string; title: string; purpose: FeedbackQueuePurpose; query: FeedbackCommentFilter; items: FeedbackQueueItem[]; currentIndex: number; status: '处理中' | '已结束'; version: number; actor: string; at: string; updatedAt: string }
export interface FeedbackTopicTuple { key: string; styleId: string; skuId: string | null; storeId: string; listingId: string; mappingStamp: string }
export interface FeedbackTopicEvidence { commentId: string; stamp: string; detailId: string; definitionVersion: number; reason: string; released: boolean }
export interface FeedbackTopicIssueLink { issueId: string; tupleKeys: string[]; commentId: string; stamp: string; issueBasis: string; tupleStamp?: string; definitionVersion: number; reason: string; released: boolean }
export interface FeedbackTopicMember { styleId: string; scope: FeedbackIssueScope; tuples: FeedbackTopicTuple[]; evidence: FeedbackTopicEvidence[]; links: FeedbackTopicIssueLink[] }
export interface FeedbackCommonTopic {
  id: string; number: string; title: string; ruleId: string; definition: string; definitionVersion: number; owner: string; dueDate: string
  discovery: FeedbackCommentFilter; members: FeedbackTopicMember[]; status: '草稿' | '跟进中' | '已归档' | '已作废'; round: number; version: number
  archiveSnapshot?: string
  createdAt: string; updatedAt: string; archiveKind: '各款均已结束' | '不再继续协调' | ''; summary: string; arrangements: Record<string, string>
  history: Array<{ at: string; actor: string; action: string; reason: string; snapshot: string }>
}
export interface FeedbackExperienceSource { issueId: string; reviewId: string; stamp: string; snapshot: string; outcome: string }
export interface FeedbackExperience {
  id: string; number: string; title: string; kind: '措施参考' | '风险提醒' | '核查记录'; ruleId: string; description: string; measures: string; conditions: string; limitations: string
  sources: FeedbackExperienceSource[]; state: '草稿' | '已启用' | '已停用'; revision: number; version: number; actor: string; at: string; reason: string; cancelled: boolean
  draft?: Omit<FeedbackExperience, 'draft'>
  history: Array<{ at: string; snapshot: string; reason: string }>
}
export interface FeedbackExperienceUsage { id: string; experienceId: string; revision: number; targetType: '问题' | '行动草稿' | '商品对比'; targetId: string; reason: string; actor: string; at: string; order: number }
export interface FeedbackComparisonMetric { styleId: string; scope: FeedbackIssueScope; commentIds: string[]; total: number; rated: number; negative: number; ratingSum: number; classified: number; detailed: number; unknownTime: number; unknownSku: number; coverage: string[]; details: Array<{ ruleId: string; count: number; commentIds: string[] }>; positive: string[]; problem: string[]; composition: Record<string, number> }
export interface FeedbackProductComparison {
  id: string; title: string; styleIds: string[]; query: FeedbackCommentFilter; scopes: FeedbackIssueScope[]; notes: string; limitations: string; experienceIds: string[]
  experienceSnapshots?: Array<{ id:string; revision:number; snapshot:string }>
  state: '草稿' | '已保存'; revision: number; version: number; actor: string; at: string; token: string; metrics: FeedbackComparisonMetric[]; samples: string; cancelled: boolean
  draft?: Omit<FeedbackProductComparison, 'draft'>
  history: Array<{ at: string; snapshot: string }>
}
export interface FeedbackPhase3Collections { detailAnnotations?: FeedbackDetailAnnotation[]; processingQueues?: FeedbackProcessingQueue[]; qualityReviews?: FeedbackQualityReview[]; commonTopics?: FeedbackCommonTopic[]; experiences?: FeedbackExperience[]; experienceUsages?: FeedbackExperienceUsage[]; comparisons?: FeedbackProductComparison[] }
export type FeedbackPhase3Payload =
  | { type: 'p3-base'; commentId: string; expectedVersion: number; expectedStamp: string; value: FeedbackValue; tags: FeedbackTag[]; note: string; state: '草稿'|'已确认'; queueId?: string; queueVersion?: number; advance?: boolean }
  | { type: 'p3-detail'; commentId: string; expectedDetailRevision: number; expectedVersion: number; expectedStamp: string; result: FeedbackDetailResult | ''; items: FeedbackDetailItem[]; note: string; state: FeedbackDetailAnnotation['state']; reason: string; base?: { value: FeedbackValue; tags: FeedbackTag[]; note: string }; queueId?: string; queueVersion?: number; advance?: boolean }
  | { type: 'p3-bulk-details'; commentIds: string[]; expectedRevisions: Record<string,number>; stamps: Record<string, string>; items: Record<string, FeedbackDetailItem[]>; result: FeedbackDetailResult | ''; note: string; replaceDrafts: boolean }
  | { type: 'p3-queue-create'; queue: FeedbackProcessingQueue }
  | { type: 'p3-queue'; queueId: string; expectedVersion: number; intent: '定位' | '跳过' | '采用当前结果' | '结束' | '继续' | '更新队列'; index?: number; reason: string; commentIds?: string[] }
  | { type: 'p3-quality'; commentId: string; expectedStamp: string; reason: string; result: FeedbackQualityReview['result']; note: string; queueId?: string; queueVersion?: number; advance?: boolean }
  | { type: 'p3-topic-save'; topic: FeedbackCommonTopic; expectedVersion: number; draft: boolean; reason: string; expectedStamps: Record<string, string> }
  | { type: 'p3-topic-link'; topicId: string; expectedVersion: number; styleId: string; link: FeedbackTopicIssueLink; release: boolean; issue?: FeedbackIssue; expectedIssueVersion?: number; expectedCommentStamps?: Record<string, string> }
  | { type: 'p3-topic-evidence'; topicId: string; expectedVersion: number; styleId: string; commentIds: string[]; expectedStamps: Record<string, string>; reason: string; release: boolean }
  | { type: 'p3-topic-state'; topicId: string; expectedVersion: number; intent: '归档' | '作废' | '重开' | '取消草稿'; reason: string; archiveKind?: FeedbackCommonTopic['archiveKind']; arrangements?: Record<string, string>; owner?: string; dueDate?: string }
  | { type: 'p3-experience'; experience: FeedbackExperience; expectedVersion: number; intent: '草稿' | '启用' | '停用' | '取消草稿'; reason: string; sourceStamps: Record<string, string> }
  | { type: 'p3-use-experience'; experienceId: string; expectedVersion: number; sourceStamp: string; targetType: FeedbackExperienceUsage['targetType']; targetId: string; reason: string; copyAction: boolean }
  | { type: 'p3-comparison'; comparison: FeedbackProductComparison; expectedVersion: number; draft: boolean; expectedToken: string; experienceStamps?: Record<string,string>; cancel?: boolean }
