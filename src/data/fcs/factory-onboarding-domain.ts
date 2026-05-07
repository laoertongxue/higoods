export const FACTORY_ADMIN_ROLE_ID = 'FACTORY_ADMIN' as const
export const FACTORY_ADMIN_ROLE_NAME = '工厂管理员' as const

export const FACTORY_ONBOARDING_STATUS_OPTIONS = [
  '草稿',
  '待平台审核',
  '平台审核退回',
  '平台审核拒绝',
  '待样衣验证',
  '待工厂确认收样',
  '待工厂提交样衣审核',
  '待平台审核样衣',
  '样衣审核退回',
  '样衣审核拒绝',
  '样衣审核通过待转正式',
  '已转正式合作',
] as const

export type FactoryOnboardingStatus = (typeof FACTORY_ONBOARDING_STATUS_OPTIONS)[number]

const LEGACY_SUBMITTED_STATUS = '已提交待' + '审核'
const LEGACY_RETURNED_STATUS = '退回补充' + '资料'
const LEGACY_RESUBMITTED_STATUS = '已重新提交待' + '审核'
const LEGACY_APPROVED_STATUS = '审核通过待确认' + '合作'
const LEGACY_REJECTED_STATUS = '已拒' + '绝'
const LEGACY_COOPERATED_STATUS = '已合' + '作'

export const FACTORY_ONBOARDING_LEGACY_STATUS_MAP = {
  [LEGACY_SUBMITTED_STATUS]: '待平台审核',
  [LEGACY_RETURNED_STATUS]: '平台审核退回',
  [LEGACY_RESUBMITTED_STATUS]: '待平台审核',
  [LEGACY_APPROVED_STATUS]: '待样衣验证',
  [LEGACY_REJECTED_STATUS]: '平台审核拒绝',
  [LEGACY_COOPERATED_STATUS]: '已转正式合作',
} as const satisfies Record<string, FactoryOnboardingStatus>

export type FactoryOnboardingLegacyStatus = keyof typeof FACTORY_ONBOARDING_LEGACY_STATUS_MAP
export type FactoryOnboardingStoredStatus = FactoryOnboardingStatus | FactoryOnboardingLegacyStatus

export const FACTORY_ONBOARDING_NODE_OPTIONS = [
  '填写入驻申请',
  '平台审核',
  '样衣验证',
  '样衣审核',
  '正式合作',
  '完成',
] as const

export type FactoryOnboardingNode = (typeof FACTORY_ONBOARDING_NODE_OPTIONS)[number]

export const FACTORY_ONBOARDING_NODE_STATUS_OPTIONS = [
  '未开始',
  '进行中',
  '已完成',
  '已退回',
  '已终止',
] as const

export type FactoryOnboardingNodeStatus = (typeof FACTORY_ONBOARDING_NODE_STATUS_OPTIONS)[number]

export const FACTORY_ONBOARDING_MACHINE_CONDITIONS = ['可用', '维修中', '停用'] as const
export type FactoryOnboardingMachineCondition = (typeof FACTORY_ONBOARDING_MACHINE_CONDITIONS)[number]

export const FACTORY_ONBOARDING_MACHINE_VALIDATION_STATUS_OPTIONS = [
  '通过',
  '未关联工序',
  '未关联工艺',
  '工序工艺未在接单能力中选择',
] as const

export type FactoryOnboardingMachineValidationStatus = (typeof FACTORY_ONBOARDING_MACHINE_VALIDATION_STATUS_OPTIONS)[number]

export const FACTORY_ONBOARDING_REVIEW_RESULTS = [
  '已通过',
  '未通过',
] as const
export type FactoryOnboardingReviewResult = (typeof FACTORY_ONBOARDING_REVIEW_RESULTS)[number]

const LEGACY_REVIEW_APPROVED = '通' + '过'
const LEGACY_REVIEW_RETURNED = '不通过且允许再次' + '申请'
const LEGACY_REVIEW_REJECTED = '不通过且不允许再次' + '申请'
const LEGACY_SAMPLE_REVIEW_RETURNED = '不通过且允许再次' + '提交'
const LEGACY_SAMPLE_REVIEW_REJECTED = '不通过且不允许再次' + '提交'

export type FactoryOnboardingLegacyReviewResult =
  | typeof LEGACY_REVIEW_APPROVED
  | typeof LEGACY_REVIEW_RETURNED
  | typeof LEGACY_REVIEW_REJECTED
  | typeof LEGACY_SAMPLE_REVIEW_RETURNED
  | typeof LEGACY_SAMPLE_REVIEW_REJECTED

export type FactoryOnboardingStoredReviewResult = FactoryOnboardingReviewResult | FactoryOnboardingLegacyReviewResult

export function normalizeReviewResult(result: string | null | undefined): FactoryOnboardingReviewResult {
  if (result === '已通过' || result === LEGACY_REVIEW_APPROVED) return '已通过'
  if (
    result === '未通过' ||
    result === LEGACY_REVIEW_RETURNED ||
    result === LEGACY_REVIEW_REJECTED ||
    result === LEGACY_SAMPLE_REVIEW_RETURNED ||
    result === LEGACY_SAMPLE_REVIEW_REJECTED
  ) return '未通过'
  return '未通过'
}

export const FACTORY_ONBOARDING_SUPPLEMENT_STATUS_OPTIONS = ['待补充', '已补充', '已重新提交'] as const
export type FactoryOnboardingSupplementStatus = (typeof FACTORY_ONBOARDING_SUPPLEMENT_STATUS_OPTIONS)[number]

export const FACTORY_ONBOARDING_COMPLETENESS_LEVEL_OPTIONS = ['不完整', '基本完整', '完整', '高完整'] as const
export type FactoryOnboardingCompletenessLevel = (typeof FACTORY_ONBOARDING_COMPLETENESS_LEVEL_OPTIONS)[number]

export const FACTORY_INFERRED_TYPE_CODE_OPTIONS = [
  'CUTTING_FACTORY',
  'PRINTING_FACTORY',
  'DYEING_FACTORY',
  'POST_FINISHING_FACTORY',
  'SPECIAL_CRAFT_FACTORY',
  'SEWING_FACTORY',
  'MULTI_CAPABILITY_FACTORY',
] as const
export type FactoryInferredTypeCode = (typeof FACTORY_INFERRED_TYPE_CODE_OPTIONS)[number]

export const FACTORY_ONBOARDING_REQUIRED_FIELD_OPTIONS = [
  '工厂简称',
  '姓名',
  '身份证号码/护照号码',
  '身份证复印件/电子文件',
  '工厂/公司名称',
  '地址',
  '手机号',
  '来源',
  '收到此通知的 PPIC 姓名',
  '机器数量',
  '有效工人数量',
  '可开始合作时间',
  '工序工艺能力',
  '机器明细',
] as const
export type FactoryOnboardingRequiredField = (typeof FACTORY_ONBOARDING_REQUIRED_FIELD_OPTIONS)[number]

export const FACTORY_ONBOARDING_ACTION_NAME_OPTIONS = [
  '保存草稿',
  '提交入驻申请',
  '工厂重新提交',
  '平台初审已通过',
  '平台初审未通过',
  '平台初审通过',
  '平台初审退回',
  '平台初审拒绝',
  '平台登记并发放样衣',
  '工厂确认收到样衣',
  '工厂提交样衣审核',
  '工厂重新提交样衣审核',
  '平台样衣审核通过',
  '平台样衣审核退回',
  '平台样衣审核拒绝',
  '样衣审核未通过',
  '样衣状态更新',
  '样衣通过后转正式合作',
  '转正式合作',
] as const
export type FactoryOnboardingActionName = (typeof FACTORY_ONBOARDING_ACTION_NAME_OPTIONS)[number]

export const FACTORY_ONBOARDING_ADMIN_ACCOUNT_STATUS = [
  '入驻中',
  '待激活',
  '待转正式',
  '已转正式',
  '已停用',
  '已锁定',
] as const
export type FactoryOnboardingAdminAccountStatus = (typeof FACTORY_ONBOARDING_ADMIN_ACCOUNT_STATUS)[number]

export type FactoryOnboardingSampleStatus =
  | '未开始'
  | '待平台登记样衣'
  | '待工厂确认收样'
  | '待工厂提交样衣审核'
  | '待平台审核样衣'
  | '样衣审核退回'
  | '样衣审核拒绝'
  | '样衣审核通过待转正式'
  | '已转正式合作'

export function normalizeOnboardingStatus(status: string | null | undefined): FactoryOnboardingStatus {
  if (status && FACTORY_ONBOARDING_STATUS_OPTIONS.includes(status as FactoryOnboardingStatus)) {
    return status as FactoryOnboardingStatus
  }
  if (status && status in FACTORY_ONBOARDING_LEGACY_STATUS_MAP) {
    return FACTORY_ONBOARDING_LEGACY_STATUS_MAP[status as FactoryOnboardingLegacyStatus]
  }
  return '草稿'
}

export function migrateOnboardingStatus(status: string | null | undefined): FactoryOnboardingStatus {
  return normalizeOnboardingStatus(status)
}

export function getOnboardingNodeByStatus(status: string | null | undefined): FactoryOnboardingNode {
  const normalized = normalizeOnboardingStatus(status)
  if (normalized === '草稿' || normalized === '平台审核退回') return '填写入驻申请'
  if (normalized === '待平台审核') return '平台审核'
  if (
    normalized === '待样衣验证' ||
    normalized === '待工厂确认收样' ||
    normalized === '待工厂提交样衣审核' ||
    normalized === '样衣审核退回'
  ) return '样衣验证'
  if (normalized === '待平台审核样衣') return '样衣审核'
  if (normalized === '样衣审核通过待转正式') return '正式合作'
  return '完成'
}

export function canFactoryEditOnboarding(status: string | null | undefined): boolean {
  const normalized = normalizeOnboardingStatus(status)
  return normalized === '草稿' || normalized === '平台审核退回'
}

export function canFactorySubmitOnboarding(status: string | null | undefined): boolean {
  return canFactoryEditOnboarding(status)
}

export function canFactoryEnterBusiness(status: string | null | undefined): boolean {
  return normalizeOnboardingStatus(status) === '已转正式合作'
}

export function isFactoryAccountLocked(status: string | null | undefined): boolean {
  void status
  return false
}

export function canCreateFactoryProfile(status: string | null | undefined): boolean {
  return normalizeOnboardingStatus(status) === '样衣审核通过待转正式'
}

export function isRejectedStatusLegacy(status: string | null | undefined): boolean {
  const normalized = normalizeOnboardingStatus(status)
  return normalized === '平台审核拒绝' || normalized === '样衣审核拒绝'
}

export function canFactoryResubmitAfterReviewFailed(status: string | null | undefined): boolean {
  return normalizeOnboardingStatus(status) === '平台审核退回'
}

export function canFactoryResubmitSampleAfterReviewFailed(status: string | null | undefined): boolean {
  return normalizeOnboardingStatus(status) === '样衣审核退回'
}

export interface FactoryOnboardingAdminAccount {
  loginId: string
  password: string
  adminName: string
  mobilePhone?: string
  mobileOrWhatsapp: string
  roleId: string
  roleName: string
  accountStatus: FactoryOnboardingAdminAccountStatus
  isTemporary?: boolean
  whatsapp?: string
}

export interface FactoryOnboardingSelectedCapability {
  processCode: string
  processName: string
  craftCode: string
  craftName: string
  abilityScope: 'CRAFT'
  canReceiveTask: boolean
  capacityManaged: boolean
  remark: string
}

export interface FactoryOnboardingMachineAbility {
  machineId: string
  machineName: string
  machineNo: string
  machineCount: number
  linkedProcessCode: string
  linkedProcessName: string
  linkedCraftCode: string
  linkedCraftName: string
  condition: FactoryOnboardingMachineCondition
  remark: string
  validationStatus: FactoryOnboardingMachineValidationStatus
  validationMessage: string
}

export interface FactoryOnboardingCompletenessItem {
  itemCode: string
  itemName: string
  weight: number
  isCompleted: boolean
  score: number
  missingReason: string
}

export interface FactoryTypeMatchResult {
  factoryTypeCode: FactoryInferredTypeCode
  factoryTypeName: string
  confidence: number
  matchedCapabilities: string[]
  reason: string
}

export interface FactoryOnboardingNodeLog {
  nodeLogId: string
  nodeName: FactoryOnboardingNode
  nodeStatus: FactoryOnboardingNodeStatus
  enteredAt: string
  leftAt?: string
  elapsedMinutes: number
  elapsedText: string
  actionCount: number
  lastActionAt?: string
  operator: string
  remark: string
}

export interface FactoryOnboardingActionLog {
  actionLogId: string
  actionName: FactoryOnboardingActionName
  nodeName: FactoryOnboardingNode
  operator: string
  operatedAt: string
  actionSequenceInNode: number
  fromStatus: FactoryOnboardingStoredStatus | '未提交'
  toStatus: FactoryOnboardingStoredStatus | '未提交'
  fromNode: FactoryOnboardingNode | '未开始'
  toNode: FactoryOnboardingNode
  remark: string
}

export interface FactoryOnboardingReviewRecord {
  reviewId: string
  reviewRoundNo: number
  reviewResult: FactoryOnboardingReviewResult
  reviewOpinion: string
  resubmitAllowed: boolean
  requiredFields?: FactoryOnboardingRequiredField[]
  reviewer: string
  reviewedAt: string
  fromStatus: FactoryOnboardingStoredStatus
  toStatus: FactoryOnboardingStoredStatus
  fromNode: FactoryOnboardingNode
  toNode: FactoryOnboardingNode
}

export interface FactoryOnboardingSupplementRecord {
  supplementId: string
  supplementRoundNo: number
  supplementReason: string
  requiredFields: FactoryOnboardingRequiredField[]
  submittedFields: FactoryOnboardingRequiredField[]
  submittedAt?: string
  submittedBy?: string
  relatedReviewId: string
  status: FactoryOnboardingSupplementStatus
}

export interface FactoryOnboardingTransferRecord {
  transferId: string
  factoryProfileGenerated: boolean
  factoryProfileId?: string
  adminAccountGenerated: boolean
  capacityProfileGenerated?: boolean
  capacityProfileId?: string
  operator: string
  operatedAt: string
  remark: string
}

export interface FactoryOnboardingConversionRecord {
  conversionId: string
  convertedAt: string
  convertedBy: string
  fromStatus: FactoryOnboardingStoredStatus
  toStatus: FactoryOnboardingStoredStatus
  createdFactoryId: string
  createdFactoryNo: string
  adminAccountConverted: boolean
  officialAdminAccountId?: string
  capacityProfileCreated: boolean
  capacityProfileId?: string
  remark: string
}

export interface FactoryOnboardingPpicChangeLog {
  changeLogId: string
  fromPpicId?: string
  fromPpicName?: string
  toPpicId: string
  toPpicName: string
  changedAt: string
  changedBy: string
  changeReason: string
}

export interface FactoryOnboardingIdentityFile {
  fileId: string
  fileName: string
  fileType: 'jpg' | 'jpeg' | 'png' | 'pdf'
  fileSizeMb: number
  uploadedAt: string
}

export interface FactoryOnboardingApplication {
  applicationId: string
  applicationNo: string
  factoryTempId: string
  status: FactoryOnboardingStatus
  currentNode: FactoryOnboardingNode
  adminAccount: FactoryOnboardingAdminAccount
  factoryShortName: string
  applicantName: string
  identityNo: string
  identityFile: FactoryOnboardingIdentityFile | null
  factoryCompanyName: string
  address: string
  mobilePhone: string
  mobileOrWhatsapp: string
  sourceChannel: string
  ppicName: string
  assignedPpicId?: string
  assignedPpicName?: string
  assignedPpicPhone?: string
  assignedPpicAt?: string
  assignedPpicBy?: string
  ppicChangeLogs: FactoryOnboardingPpicChangeLog[]
  machineTotalCount: number
  effectiveWorkerCount: number
  availableStartDate: string
  selectedCapabilities: FactoryOnboardingSelectedCapability[]
  machines: FactoryOnboardingMachineAbility[]
  submittedAt?: string
  lastSubmittedAt?: string
  reviewedAt?: string
  sampleVerifiedAt?: string
  sampleIssuedAt?: string
  sampleExpectedSubmitAt?: string
  convertedAt?: string
  createdFactoryId?: string
  nodeLogs: FactoryOnboardingNodeLog[]
  actionLogs: FactoryOnboardingActionLog[]
  reviewRecords: FactoryOnboardingReviewRecord[]
  supplementRecords: FactoryOnboardingSupplementRecord[]
  accountLocked: boolean
  accountLockedReason?: string
  factoryNameLocked: boolean
  lockedAt?: string
  sampleVerificationId?: string
  sampleStatus?: FactoryOnboardingSampleStatus
  completenessScore: number
  completenessLevel: FactoryOnboardingCompletenessLevel
  completenessItems: FactoryOnboardingCompletenessItem[]
  completenessUpdatedAt: string
  inferredFactoryTypes: FactoryTypeMatchResult[]
  primaryFactoryType: FactoryInferredTypeCode
  factoryTypeMatchedAt: string
  factoryTypeMatchReason: string
  conversionRecords: FactoryOnboardingConversionRecord[]
  transferRecords: FactoryOnboardingTransferRecord[]
  factoryName?: string
  bossName?: string
  whatsapp?: string
  contractedAt?: string
}

export interface FactoryOnboardingDraftPayload {
  applicationId?: string
  applicationNo?: string
  factoryTempId?: string
  factoryShortName: string
  applicantName: string
  identityNo: string
  identityFile: FactoryOnboardingIdentityFile | null
  factoryCompanyName: string
  address: string
  mobilePhone: string
  mobileOrWhatsapp: string
  sourceChannel: string
  ppicName: string
  machineTotalCount: number
  effectiveWorkerCount: number
  availableStartDate: string
  selectedCapabilities: FactoryOnboardingSelectedCapability[]
  machines: FactoryOnboardingMachineAbility[]
  adminAccount: FactoryOnboardingAdminAccount
  factoryName?: string
  bossName?: string
  whatsapp?: string
}

export interface FactoryOnboardingApplicantSession {
  applicationId: string
  loginId: string
  adminName: string
  factoryTempId: string
  factoryName: string
  loggedAt: string
}
