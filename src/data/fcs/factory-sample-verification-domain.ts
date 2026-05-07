import type {
  FactoryOnboardingActionLog,
  FactoryOnboardingNodeStatus,
  FactoryOnboardingStatus,
} from './factory-onboarding-domain.ts'

export const FACTORY_SAMPLE_VERIFICATION_STATUS_OPTIONS = [
  '待工厂确认收样',
  '待工厂提交样衣审核',
  '待平台审核样衣',
  '样衣审核退回',
  '样衣审核拒绝',
  '样衣审核通过',
] as const

export type FactorySampleVerificationStatus = (typeof FACTORY_SAMPLE_VERIFICATION_STATUS_OPTIONS)[number]

export const FACTORY_SAMPLE_VERIFICATION_NODE_OPTIONS = [
  '平台发放样衣',
  '工厂确认收样',
  '工厂提交样衣审核',
  '平台审核样衣',
  '样衣验证完成',
] as const

export type FactorySampleVerificationNode = (typeof FACTORY_SAMPLE_VERIFICATION_NODE_OPTIONS)[number]

export const FACTORY_SAMPLE_ISSUE_METHOD_OPTIONS = [
  '现场发放',
  '快递发放',
  '业务带样',
  '其他',
] as const

export type FactorySampleIssueMethod = (typeof FACTORY_SAMPLE_ISSUE_METHOD_OPTIONS)[number]

export const FACTORY_SAMPLE_VERIFICATION_PURPOSE_OPTIONS = [
  '检验车缝能力',
  '检验后道能力',
  '检验裁床能力',
  '检验印花能力',
  '检验染色能力',
  '检验特殊工艺能力',
  '检验质量稳定性',
  '检验交期配合度',
] as const

export type FactorySampleVerificationPurpose = (typeof FACTORY_SAMPLE_VERIFICATION_PURPOSE_OPTIONS)[number]

export const FACTORY_SAMPLE_REVIEW_RESULT_OPTIONS = [
  '已通过',
  '未通过',
] as const

export type FactorySampleReviewResult = (typeof FACTORY_SAMPLE_REVIEW_RESULT_OPTIONS)[number]

const LEGACY_SAMPLE_REVIEW_APPROVED = '通' + '过'
const LEGACY_SAMPLE_REVIEW_RETURNED = '不通过且允许再次' + '提交'
const LEGACY_SAMPLE_REVIEW_REJECTED = '不通过且不允许再次' + '提交'
const LEGACY_PLATFORM_REVIEW_RETURNED = '不通过且允许再次' + '申请'
const LEGACY_PLATFORM_REVIEW_REJECTED = '不通过且不允许再次' + '申请'

export type FactorySampleLegacyReviewResult =
  | typeof LEGACY_SAMPLE_REVIEW_APPROVED
  | typeof LEGACY_SAMPLE_REVIEW_RETURNED
  | typeof LEGACY_SAMPLE_REVIEW_REJECTED
  | typeof LEGACY_PLATFORM_REVIEW_RETURNED
  | typeof LEGACY_PLATFORM_REVIEW_REJECTED

export type FactorySampleStoredReviewResult = FactorySampleReviewResult | FactorySampleLegacyReviewResult

export function normalizeSampleReviewResult(result: string | null | undefined): FactorySampleReviewResult {
  if (result === '已通过' || result === LEGACY_SAMPLE_REVIEW_APPROVED) return '已通过'
  if (
    result === '未通过' ||
    result === LEGACY_SAMPLE_REVIEW_RETURNED ||
    result === LEGACY_SAMPLE_REVIEW_REJECTED ||
    result === LEGACY_PLATFORM_REVIEW_RETURNED ||
    result === LEGACY_PLATFORM_REVIEW_REJECTED
  ) return '未通过'
  return '未通过'
}

export const FACTORY_SAMPLE_REVIEW_REQUIRED_ITEM_OPTIONS = [
  '样衣照片',
  '样衣视频',
  '工厂照片',
  '工厂视频',
  '工艺说明',
  '问题说明',
  '补充文件',
  '其他',
] as const

export type FactorySampleReviewRequiredItem = (typeof FACTORY_SAMPLE_REVIEW_REQUIRED_ITEM_OPTIONS)[number]

export const FACTORY_SAMPLE_QUALITY_CONCLUSION_OPTIONS = [
  '达标',
  '基本达标',
  '不达标',
] as const

export type FactorySampleQualityConclusion = (typeof FACTORY_SAMPLE_QUALITY_CONCLUSION_OPTIONS)[number]

export const FACTORY_SAMPLE_CAPACITY_CONCLUSION_OPTIONS = [
  '具备合作能力',
  '需补充验证',
  '不具备合作能力',
] as const

export type FactorySampleCapacityConclusion = (typeof FACTORY_SAMPLE_CAPACITY_CONCLUSION_OPTIONS)[number]

export const FACTORY_BOSS_IDENTITY_SOURCE_OPTIONS = [
  '工厂提交',
  '平台补录',
  '工厂提交和平台补录',
] as const

export type FactoryBossIdentitySource = (typeof FACTORY_BOSS_IDENTITY_SOURCE_OPTIONS)[number]

export type FactorySampleReferenceFileType = 'jpg' | 'jpeg' | 'png' | 'webp' | 'pdf' | 'mp4' | 'mov'

export interface FactorySampleReferenceFile {
  fileId: string
  fileName: string
  fileType: FactorySampleReferenceFileType
  fileSizeMb: number
  fileUrl?: string
  uploadedAt: string
}

export interface FactorySampleVerificationNodeLog {
  nodeLogId: string
  nodeName: FactorySampleVerificationNode
  nodeStatus: FactoryOnboardingNodeStatus
  enteredAt: string
  leftAt?: string
  operator: string
  remark: string
}

export interface FactorySampleVerificationActionLog {
  actionLogId: string
  actionName: '平台登记并发放样衣' | '工厂确认收到样衣' | '工厂提交样衣审核' | '工厂重新提交样衣审核' | '平台样衣审核通过' | '平台样衣审核退回' | '平台样衣审核拒绝' | '样衣审核未通过' | '样衣状态更新'
  nodeName: FactorySampleVerificationNode
  operator: string
  operatedAt: string
  fromStatus?: FactorySampleVerificationStatus
  toStatus: FactorySampleVerificationStatus
  fromNode?: FactorySampleVerificationNode
  toNode: FactorySampleVerificationNode
  remark: string
}

export interface FactorySampleReviewRecord {
  sampleReviewId: string
  sampleReviewRoundNo: number
  sampleReviewResult: FactorySampleReviewResult
  sampleReviewOpinion: string
  resubmitAllowed: boolean
  requiredResubmitItems: FactorySampleReviewRequiredItem[]
  reviewer: string
  reviewedAt: string
  fromStatus: FactorySampleVerificationStatus
  toStatus: FactorySampleVerificationStatus
  fromNode: FactorySampleVerificationNode
  toNode: FactorySampleVerificationNode
  relatedSubmissionRoundNo: number
  sampleQualityConclusion?: FactorySampleQualityConclusion
  capacityConclusion?: FactorySampleCapacityConclusion
  bossIdentityNoAtReview?: string
  bossIdentityFilesAtReview: FactorySampleReferenceFile[]
  bossIdentitySourceAtReview?: FactoryBossIdentitySource
  bossIdentityCompletedByReviewer?: string
  remark?: string
}

export interface FactorySampleIssuePayload {
  sampleBatchNo: string
  styleNo: string
  sampleName: string
  sampleDescription: string
  verificationPurpose: FactorySampleVerificationPurpose[]
  sampleQuantity: number
  issueMethod: FactorySampleIssueMethod | ''
  courierCompany?: string
  trackingNo?: string
  issuedAt: string
  issuedBy: string
  expectedReceiveAt?: string
  expectedSubmitAt: string
  platformReferenceFiles: FactorySampleReferenceFile[]
  platformReferencePhotos: FactorySampleReferenceFile[]
  platformReferenceVideos: FactorySampleReferenceFile[]
}

export interface FactorySampleReceivePayload {
  factoryReceivedAt: string
  factoryReceivedBy: string
  factoryReceiveRemark?: string
}

export interface FactorySampleSubmissionPayload {
  factorySamplePhotos: FactorySampleReferenceFile[]
  factorySampleVideos: FactorySampleReferenceFile[]
  factoryCraftDescription: string
  factoryProblemDescription?: string
  factorySubmitRemark?: string
  factorySubmissionFiles: FactorySampleReferenceFile[]
  factorySitePhotos: FactorySampleReferenceFile[]
  factorySiteVideos: FactorySampleReferenceFile[]
  bossIdentityNo?: string
  bossIdentityFiles: FactorySampleReferenceFile[]
}

export interface FactorySampleReviewPayload {
  sampleReviewResult: FactorySampleReviewResult | ''
  sampleReviewOpinion: string
  resubmitAllowed: boolean
  requiredResubmitItems: FactorySampleReviewRequiredItem[]
  sampleQualityConclusion?: FactorySampleQualityConclusion | ''
  capacityConclusion?: FactorySampleCapacityConclusion | ''
  bossIdentityNo?: string
  bossIdentityFiles: FactorySampleReferenceFile[]
  remark?: string
}

export interface FactorySampleVerification {
  verificationId: string
  verificationNo: string
  applicationId: string
  applicationNo: string
  factoryTempId: string
  factoryCompanyName: string
  applicantName: string
  mobileOrWhatsapp: string
  sampleBatchNo: string
  styleNo: string
  sampleName: string
  sampleDescription: string
  verificationPurpose: FactorySampleVerificationPurpose[]
  sampleQuantity: number
  issueMethod: FactorySampleIssueMethod
  courierCompany?: string
  trackingNo?: string
  issuedAt: string
  issuedBy: string
  expectedReceiveAt?: string
  expectedSubmitAt: string
  platformReferenceFiles: FactorySampleReferenceFile[]
  platformReferencePhotos: FactorySampleReferenceFile[]
  platformReferenceVideos: FactorySampleReferenceFile[]
  status: FactorySampleVerificationStatus
  currentNode: FactorySampleVerificationNode
  factoryReceivedAt?: string
  factoryReceivedBy?: string
  factoryReceiveRemark?: string
  receiveActionCount: number
  factorySubmittedAt?: string
  factorySubmittedBy?: string
  factorySamplePhotos: FactorySampleReferenceFile[]
  factorySampleVideos: FactorySampleReferenceFile[]
  factoryCraftDescription?: string
  factoryProblemDescription?: string
  factorySubmitRemark?: string
  factorySubmissionRoundNo: number
  factorySubmissionFiles: FactorySampleReferenceFile[]
  factorySitePhotos: FactorySampleReferenceFile[]
  factorySiteVideos: FactorySampleReferenceFile[]
  bossIdentityNo?: string
  bossIdentityFiles: FactorySampleReferenceFile[]
  bossIdentitySource?: FactoryBossIdentitySource
  bossIdentityCompletedAt?: string
  bossIdentityCompletedBy?: string
  submissionActionCount: number
  platformSampleReviewedAt?: string
  sampleReviewRecords: FactorySampleReviewRecord[]
  nodeLogs: FactorySampleVerificationNodeLog[]
  actionLogs: FactorySampleVerificationActionLog[]
  createdAt: string
  updatedAt: string
}

export interface FactorySampleIssueResult {
  applicationStatus: FactoryOnboardingStatus
  applicationActionLog: FactoryOnboardingActionLog
  sampleVerification: FactorySampleVerification
}
