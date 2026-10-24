import type { FeedbackRange, FeedbackTag, FeedbackTheme, FeedbackValue } from './types.ts'
export interface FeedbackTranslation {
  order?: number
  id: string; commentId: string; contentVersion: number; text: string; source: string; language: string
  checked: boolean; actor: string; at: string; reason: string; revision: number
}
export interface FeedbackSuggestion {
  order?: number
  id: string; commentId: string; contentVersion: number; translationId: string; value: FeedbackValue; tags: FeedbackTag[]
  state: '待核对' | '已选入草稿' | '已忽略'; actor: string; at: string
}
export interface FeedbackIssueScope { styleId: string; mode: 'SPU固定范围' | '指定SKU'; skuIds: string[]; storeIds: string[]; listingIds: string[]; includeUnknown: boolean }
export interface FeedbackIssueEvidence {
  commentId: string; reason: string; stamp: string; raw: string; rating: number | null; association: string; classification: string
  translationId: string; actor: string; at: string; released: boolean
  history: Array<{ stamp: string; raw: string; reason: string; at: string; actor: string; translationId?: string; association?: string; classification?: string; rating?: number|null }>
}
export type FeedbackIssueStatus = '草稿' | '待处理' | '处理中' | '待复盘' | '已关闭' | '已作废'
export interface FeedbackIssue {
  id: string; number: string; title: string; description: string; definition: string; theme: FeedbackTheme; scope: FeedbackIssueScope
  discovery: { start: string; end: string }; owner: string; priority: '普通' | '优先' | '紧急'; targetDate: string
  status: FeedbackIssueStatus; round: number; version: number; definitionVersion: number; evidence: FeedbackIssueEvidence[]
  createdAt: string; updatedAt: string; actor: string; closedAt: string; closeReason: string; cancelledDraft?: boolean; relatedIssueId: string
}
export const FEEDBACK_ACTION_TYPES = ['商品核查', '规格/版型调整', '图片/描述调整', '包装/发货核查', '其他'] as const
export interface FeedbackIssueAction {
  id: string; issueId: string; round: number; version: number; type: typeof FEEDBACK_ACTION_TYPES[number]; content: string; owner: string
  dueDate: string; status: '未开始' | '进行中' | '已完成' | '已取消'; startedAt: string; completedAt: string; result: string
  effect: '无需观察' | '已生效' | '生效时间未确认' | ''; effectiveAt: string; effectEvidence: string; progress: string[]; attachmentIds: string[]
}
export interface FeedbackIssuePlan {
  order?: number
  id: string; issueId: string; round: number; version: number; kind: '反馈变化' | '核查结论'; actionIds: string[]; anchorActionId: string
  days: number; lag: number; before: FeedbackRange; after: FeedbackRange; scope: FeedbackIssueScope; definition: string; dueDate: string
  state: '草稿' | '待观察' | '已记录' | '已替换' | '已取消'; publishedAt?: string; reason: string; target: string; basis: string; at: string
}
export interface FeedbackIssueJudgment {
  order?: number
  id: string; issueId: string; round: number; planId: string; commentId: string; stamp: string; definition: string
  result: 'Y' | 'N' | 'U'; basis: '原文' | '图片' | '中文译文'; translationId: string; classificationId: string; evidence: string; actor: string; at: string
}
export interface FeedbackReviewPeriod {
  total: number; rated: number; negative: number; average: number | null; problem: number; classified: number
  Y: number; N: number; U: number; R: number; commentIds: string[]; coverage: string[]
  composition: Record<string, number>
}
export interface FeedbackIssueReview {
  order?: number
  id: string; issueId: string; round: number; planId: string; kind: FeedbackIssuePlan['kind']; at: string; actor: string
  plan: FeedbackIssuePlan; before: FeedbackReviewPeriod | null; after: FeedbackReviewPeriod | null
  samples: Array<{ id: string; raw: string; rating: number | null; commentAt: string | null; association: string; classification: string; judgment: string; translation: string }>
  basis: string; previewToken: string; observation: string; factors: string; conclusion: '基础范围一致' | '存在影响因素' | '数据条件不足' | '核查结论'
  decision: '继续观察' | '调整措施' | '结束本次跟进'; endingReason: string; nextStep: string; nextDueDate: string; targetDate: string; draft: boolean; supersedes: string
}
export interface FeedbackActionAttachment { id: string; name: string; size: number; type: string; actionId: string; at: string }
export interface FeedbackPhase2Collections {
  translations?: FeedbackTranslation[]; suggestions?: FeedbackSuggestion[]; issues?: FeedbackIssue[]; issueActions?: FeedbackIssueAction[]
  issuePlans?: FeedbackIssuePlan[]; issueJudgments?: FeedbackIssueJudgment[]; issueReviews?: FeedbackIssueReview[]; actionAttachments?: FeedbackActionAttachment[]
}
export type FeedbackPhase2Payload =
  | { type: 'p2-translation'; commentId: string; expectedVersion: number; text: string; source: string; reason: string; checked: boolean }
  | { type: 'p2-suggest'; commentIds: string[]; expectedVersions: Record<string, number>; translationIds?: Record<string, string> }
  | { type: 'p2-suggestion-use'; suggestionIds: string[]; expectedVersions: Record<string, number>; ignore: boolean; selectedTags?: Record<string, number[]> }
  | { type: 'p2-save-issue'; issue: FeedbackIssue; expectedVersion: number; draft: boolean; reason: string; distinction: string; expectedCommentStamps?: Record<string, string> }
  | { type: 'p2-issue-state'; issueId: string; expectedVersion: number; action: '开始处理' | '进入复盘' | '继续处理' | '关闭' | '重开' | '作废' | '取消草稿'; reason: string; targetDate?: string; owner?: string; goal?: string }
  | { type: 'p2-evidence'; issueId: string; expectedVersion: number; commentIds: string[]; action: '添加' | '仍支持' | '解除'; reason: string; translationId?: string; translationIds?: Record<string,string>; expectedCommentStamps?: Record<string,string> }
  | { type: 'p2-action'; issueId: string; expectedVersion: number; action: FeedbackIssueAction; intent: '保存' | '开始' | '进展' | '完成' | '取消' | '恢复' | '修正'; reason: string; targetDate: string; attachments?: FeedbackActionAttachment[] }
  | { type: 'p2-plan'; issueId: string; expectedVersion: number; plan: FeedbackIssuePlan; draft: boolean; reason: string }
  | { type: 'p2-judge'; issueId: string; expectedVersion: number; planId: string; commentId: string; expectedStamp: string; result: 'Y' | 'N' | 'U'; basis: FeedbackIssueJudgment['basis']; translationId: string; classificationId: string; evidence: string }
  | { type: 'p2-review'; issueId: string; expectedVersion: number; planId: string; previewToken: string; draft: boolean; observation: string; factors: string; decision: FeedbackIssueReview['decision']; endingReason: string; nextStep: string; nextDueDate: string; targetDate: string; supersedes: string }
