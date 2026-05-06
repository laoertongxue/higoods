export const FACTORY_ADMIN_ROLE_ID = 'FACTORY_ADMIN' as const
export const FACTORY_ADMIN_ROLE_NAME = '工厂管理员' as const

export const FACTORY_ONBOARDING_STATUS_OPTIONS = [
  '草稿',
  '已提交待审核',
  '退回补充资料',
  '已重新提交待审核',
  '审核通过待确认合作',
  '已拒绝',
  '已合作',
] as const

export type FactoryOnboardingStatus = (typeof FACTORY_ONBOARDING_STATUS_OPTIONS)[number]

export const FACTORY_ONBOARDING_NODE_OPTIONS = [
  '填写入驻信息',
  '提交平台审核',
  '平台审核',
  '补充资料',
  '确认合作',
  '生成工厂档案',
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
  '通过',
  '不通过且允许再次提交',
  '不通过且不允许再次提交',
] as const
export type FactoryOnboardingReviewResult = (typeof FACTORY_ONBOARDING_REVIEW_RESULTS)[number]

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
  '工厂名称',
  '老板名字',
  'WhatsApp',
  '地址',
  '有效工人数量',
  '机器总数',
  '机器明细',
  '工序工艺能力',
  '可开始合作时间',
  '管理员账号',
] as const
export type FactoryOnboardingRequiredField = (typeof FACTORY_ONBOARDING_REQUIRED_FIELD_OPTIONS)[number]

export const FACTORY_ONBOARDING_ACTION_NAME_OPTIONS = [
  '保存草稿',
  '提交入驻申请',
  '平台审核通过',
  '平台退回补充资料',
  '平台拒绝入驻',
  '工厂重新提交',
  '平台确认合作',
  '生成工厂档案',
  '管理员账号转正',
] as const
export type FactoryOnboardingActionName = (typeof FACTORY_ONBOARDING_ACTION_NAME_OPTIONS)[number]

export const FACTORY_ONBOARDING_ADMIN_ACCOUNT_STATUS = [
  '待激活',
  '待转正式',
  '已转正式',
  '已停用',
] as const
export type FactoryOnboardingAdminAccountStatus = (typeof FACTORY_ONBOARDING_ADMIN_ACCOUNT_STATUS)[number]

export interface FactoryOnboardingAdminAccount {
  loginId: string
  password: string
  adminName: string
  whatsapp: string
  roleId: string
  roleName: string
  accountStatus: FactoryOnboardingAdminAccountStatus
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
  fromStatus: FactoryOnboardingStatus | '未提交'
  toStatus: FactoryOnboardingStatus | '未提交'
  fromNode: FactoryOnboardingNode | '未开始'
  toNode: FactoryOnboardingNode
  remark: string
}

export interface FactoryOnboardingReviewRecord {
  reviewId: string
  reviewRoundNo: number
  reviewResult: FactoryOnboardingReviewResult
  reviewOpinion: string
  allowResubmit: boolean
  reviewer: string
  reviewedAt: string
  fromStatus: FactoryOnboardingStatus
  toStatus: FactoryOnboardingStatus
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

export interface FactoryOnboardingApplication {
  applicationId: string
  applicationNo: string
  factoryTempId: string
  factoryName: string
  bossName: string
  whatsapp: string
  address: string
  machineTotalCount: number
  effectiveWorkerCount: number
  availableStartDate: string
  selectedCapabilities: FactoryOnboardingSelectedCapability[]
  machines: FactoryOnboardingMachineAbility[]
  adminAccount: FactoryOnboardingAdminAccount
  status: FactoryOnboardingStatus
  currentNode: FactoryOnboardingNode
  submittedAt?: string
  reviewedAt?: string
  contractedAt?: string
  createdFactoryId?: string
  completenessScore: number
  completenessLevel: FactoryOnboardingCompletenessLevel
  completenessItems: FactoryOnboardingCompletenessItem[]
  completenessUpdatedAt: string
  inferredFactoryTypes: FactoryTypeMatchResult[]
  primaryFactoryType: FactoryInferredTypeCode
  factoryTypeMatchedAt: string
  factoryTypeMatchReason: string
  nodeLogs: FactoryOnboardingNodeLog[]
  actionLogs: FactoryOnboardingActionLog[]
  reviewRecords: FactoryOnboardingReviewRecord[]
  supplementRecords: FactoryOnboardingSupplementRecord[]
  transferRecords: FactoryOnboardingTransferRecord[]
}

export interface FactoryOnboardingDraftPayload {
  applicationId?: string
  applicationNo?: string
  factoryTempId?: string
  factoryName: string
  bossName: string
  whatsapp: string
  address: string
  machineTotalCount: number
  effectiveWorkerCount: number
  availableStartDate: string
  selectedCapabilities: FactoryOnboardingSelectedCapability[]
  machines: FactoryOnboardingMachineAbility[]
  adminAccount: FactoryOnboardingAdminAccount
}

export interface FactoryOnboardingApplicantSession {
  applicationId: string
  loginId: string
  adminName: string
  factoryTempId: string
  factoryName: string
  loggedAt: string
}
