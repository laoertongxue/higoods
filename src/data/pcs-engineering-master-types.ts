// 工程主单领域类型：主单、专业任务、任务物料行、返工轮次与前期成果复用。
// 工程主单是 PCS 生产工程管理的唯一任务编排事实源。


export type EngineeringMasterStatus =
  | '草稿'
  | '已发布'
  | '进行中'
  | '技术包审核中'
  | '待关闭'
  | '已关闭'
  | '已终止'

export type EngineeringPreparationType =
  | 'PURE_WOVEN'
  | 'HEAT_TRANSFER_DIRECT_PRINT'
  | 'KNIT'
  | 'KNIT_WOVEN'

export type EngineeringMasterCreationMode = 'MANUAL' | 'SYSTEM'

export type EngineeringTaskSourceType =
  | 'INDEPENDENT_REVISION_SAMPLING'
  | 'INDEPENDENT_DESIGN_SAMPLING'
  | 'ENGINEERING_MASTER'
  | 'ENGINEERING_CHANGE'

export interface EngineeringFirstProductionQualificationFact {
  styleCode: string
  formalSaleStatus: 'NO_FORMAL_SALE' | 'HAS_FORMAL_SALE' | 'UNAVAILABLE' | 'CONFLICT'
  formalProductionStatus: 'NO_FORMAL_PRODUCTION' | 'HAS_FORMAL_PRODUCTION' | 'UNAVAILABLE' | 'CONFLICT'
  formalSaleSource: string
  formalProductionSource: string
  checkedAt: string
}

export interface EngineeringBulkProductionQualification {
  basisType: 'TEST_APPROVED' | 'REVISION_READY' | 'DESIGN_READY' | 'OTHER_CONFIRMED'
  triggerBusinessObjectType: string
  triggerBusinessObjectId: string
  thresholdQuantity: number | null
  reachedQuantity: number | null
  reachedAt: string
  reason: string
  uniqueTriggerKey: string
}

export interface EngineeringTaskEventTimes {
  generatedAt: string
  unlockedAt: string
  startedAt: string
  submittedAt: string
  reviewedAt: string
  firstCompletedAt: string
  effectiveCompletedAt: string
}

export interface EngineeringTaskOperationLog {
  operationType: string
  operatorId: string
  operatorName: string
  operatedAt: string
  note: string
  roundNo: number
}

export type EngineeringTaskType =
  | 'BASE_PATTERN_WOVEN'
  | 'BASE_PATTERN_KNIT'
  | 'PRE_PRODUCTION_SAMPLE'
  | 'SIZE_PATTERN_WOVEN'
  | 'SIZE_PATTERN_KNIT'
  | 'PATTERN_ARTWORK'
  | 'COLOR_YARN'
  | 'COLOR_FABRIC'
  | 'ACCESSORY_PURCHASE'
  | 'TECH_PACK_CONFIRMATION'

// 专业任务统一状态：不设置人工暂停、人工取消和异常状态。
export type EngineeringTaskStatus =
  | '未启用'
  | '待前置'
  | '待开始'
  | '进行中'
  | '待审核'
  | '返工中'
  | '已完成'
  | '因需求变更结束'

export const ENGINEERING_TASK_STATUSES: EngineeringTaskStatus[] = [
  '未启用',
  '待前置',
  '待开始',
  '进行中',
  '待审核',
  '返工中',
  '已完成',
  '因需求变更结束',
]

export type EngineeringTaskMaterialRequirementType = '印花' | '染色' | '辅料'

export type EngineeringMaterialReviewStatus = '待提交' | '待审核' | '通过' | '未通过'

export interface EngineeringTaskMaterialReviewDecision {
  materialLineId: string
  decision: '通过' | '未通过'
  reason: string
  reviewedBy: string
  reviewedAt: string
}

export interface EngineeringTaskMaterialReviewRound {
  roundNo: number
  submittedAt: string
  submittedBy: string
  reviewedAt: string
  reviewedBy: string
  decisions: EngineeringTaskMaterialReviewDecision[]
}

export interface EngineeringTaskMaterialLine {
  materialLineId: string
  bomItemId?: string
  materialSkuId: string
  materialName: string
  materialType: string
  requirementType: EngineeringTaskMaterialRequirementType
  productColor?: string
  printProcess?: string
  pantoneColorCode?: string
  colorName?: string
  dyeColorCode?: string
  dyeFactoryName?: string
  status: '正常' | '因需求变更结束'
  resultFileIds: string[]
  effectImageIds: string[]
  resultSubmittedBy: string
  resultSubmittedAt: string
  reviewStatus: EngineeringMaterialReviewStatus
  reviewReason: string
  reviewedBy: string
  reviewedAt: string
}

export interface EngineeringTaskReworkRound {
  roundNo: number
  reason: string
  startedAt: string
  submittedAt: string
  passedAt: string
}

export interface EngineeringTaskRecord {
  taskId: string
  masterOrderId: string
  taskType: EngineeringTaskType
  taskName: string
  sourceType: EngineeringTaskSourceType
  sourceId: string
  targetStyleId: string
  targetStyleCode: string
  targetStyleName: string
  status: EngineeringTaskStatus
  dependsOnTaskIds: string[]
  dependencySatisfaction: Array<{
    dependencyTaskType: EngineeringTaskType
    satisfactionType: 'TASK_COMPLETED' | 'PRIOR_RESULT_REUSED'
    sourceId: string
  }>
  ownerTeamName: string
  assigneeId: string
  assigneeName: string
  assignedById: string
  assignedByName: string
  assignedAt: string
  currentRoundNo: number
  plannedStartAt: string
  plannedCompleteAt: string
  resultSummary: string
  submittedById: string
  submittedByName: string
  reviewedById: string
  reviewedByName: string
  events: EngineeringTaskEventTimes
  operationLogs: EngineeringTaskOperationLog[]
  materialLines: EngineeringTaskMaterialLine[]
  reworkRounds: EngineeringTaskReworkRound[]
  startedAt: string
  submittedAt: string
  firstCompletedAt: string
  effectiveCompletedAt: string
  // 辅料下单任务以已绑定采购单中的最晚实际下单时间完成；保留显式字段供时效投影读取。
  completedAt?: string
  boundPurchaseOrderNos?: string[]
  resultImageIds: string[]
  resultQuantity: number
  resultSubmittedBy: string
  materialReviewRounds: EngineeringTaskMaterialReviewRound[]
  colorRequirementConfirmedBy: string
  colorRequirementConfirmedAt: string
  colorResultCompletedAt: string
}

export interface EngineeringPriorResultReuseLine {
  resultType: string
  resultLabel: string
  decision: '复用' | '重新执行' | '不采用'
  sourceSamplingTaskId?: string
  sourceSamplingTaskCode?: string
  sourceTaskId: string
  sourceTaskLabel: string
  sourceResultVersion: string
  sourceBomDraftVersionId?: string
  confirmedById?: string
  confirmedBy: string
  confirmedAt: string
}

export interface EngineeringMasterOrderRecord {
  masterOrderId: string
  masterOrderCode: string
  styleId: string
  styleCode: string
  styleName: string
  status: EngineeringMasterStatus
  preparationType: EngineeringPreparationType | ''
  creationMode: EngineeringMasterCreationMode
  creationReason: string
  qualificationFact: EngineeringFirstProductionQualificationFact
  bulkProductionQualification: EngineeringBulkProductionQualification
  merchandiserName: string
  merchandiserId: string
  bomVersionIds: string[]
  tasks: EngineeringTaskRecord[]
  priorResultReuseLines: EngineeringPriorResultReuseLine[]
  taskPlanConfirmedAt?: string
  taskPlanConfirmedBy?: string
  confirmedTaskTypes?: EngineeringTaskType[]
  createdAt: string
  createdBy: string
  createdById: string
  qualificationReachedAt: string
  publishedAt: string
  publishedBy: string
  closedAt: string
  closedBy: string
  terminatedAt: string
  terminateReason: string
}

export type EngineeringChangeTaskStatus = '进行中' | '已完成'

export interface EngineeringChangeTaskRecord {
  engineeringChangeTaskId: string
  engineeringChangeTaskCode: string
  title: string
  sourceMasterOrderId: string
  sourceMasterOrderCode: string
  styleId: string
  styleCode: string
  styleName: string
  status: EngineeringChangeTaskStatus
  createdAt: string
  createdBy: string
  completedAt: string
}

export interface EngineeringMasterOrderSnapshot {
  version: number
  records: EngineeringMasterOrderRecord[]
  changeTasks?: EngineeringChangeTaskRecord[]
}

export type EngineeringIndependentSamplingType = 'REVISION' | 'DESIGN'
export type EngineeringIndependentSamplingStatus = 'DRAFT' | 'IN_PROGRESS' | 'WAIT_CONFIRMATION' | 'COMPLETED'
export type EngineeringIndependentProfessionalTaskType = 'BASE_PATTERN' | 'DISPLAY_SAMPLE' | 'PATTERN_ARTWORK' | 'COLOR_YARN' | 'COLOR_FABRIC'
export type EngineeringIndependentProfessionalTaskStatus = 'WAIT_DEPENDENCY' | 'WAIT_START' | 'IN_PROGRESS' | 'WAIT_REVIEW' | 'REWORK' | 'COMPLETED'

export interface EngineeringIndependentProfessionalResult {
  resultId: string
  title: string
  imageUrl: string
  status: 'WAIT_REVIEW' | 'APPROVED' | 'REJECTED'
  rejectReason: string
}

export interface EngineeringIndependentProfessionalTask {
  taskId: string
  taskType: EngineeringIndependentProfessionalTaskType
  taskName: string
  ownerTeamName: string
  status: EngineeringIndependentProfessionalTaskStatus
  dependsOnTaskIds: string[]
  plannedCompleteAt: string
  startedAt: string
  submittedAt: string
  completedAt: string
  pantoneColorCode: string
  colorName: string
  dyeColorCode: string
  colorRequirementConfirmedBy: string
  colorRequirementConfirmedAt: string
  results: EngineeringIndependentProfessionalResult[]
}

export interface EngineeringIndependentSamplingLog {
  logId: string
  action: string
  operatorId: string
  operatorName: string
  occurredAt: string
  detail: string
}

export interface EngineeringIndependentSamplingRecord {
  samplingTaskId: string
  samplingTaskCode: string
  samplingType: EngineeringIndependentSamplingType
  sourceStyleId: string
  sourceStyleCode: string
  targetStyleId: string
  targetStyleCode: string
  targetStyleName: string
  status: EngineeringIndependentSamplingStatus
  merchandiserId: string
  merchandiserName: string
  relatedProfessionalTaskIds: string[]
  professionalTasks: EngineeringIndependentProfessionalTask[]
  bomDraftVersionId: string
  bomVersionIds: string[]
  resultVersion: string
  resultSummary: string
  confirmedBy: string
  confirmedAt: string
  selectedTaskTypes: EngineeringIndependentProfessionalTaskType[]
  sourceResultVersionId: string
  reuseDecision: 'PENDING' | 'REUSE' | 'REDO' | 'IGNORE'
  operationLogs: EngineeringIndependentSamplingLog[]
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface EngineeringIndependentReusableProfessionalResult {
  samplingTaskId: string
  samplingTaskCode: string
  samplingType: EngineeringIndependentSamplingType
  targetStyleId: string
  targetStyleCode: string
  professionalTaskId: string
  professionalTaskType: EngineeringIndependentProfessionalTaskType
  professionalTaskName: string
  resultVersion: string
  resultSummary: string
  bomDraftVersionId: string
  confirmedBy: string
  confirmedAt: string
  completedAt: string
  resultImageUrls: string[]
}
