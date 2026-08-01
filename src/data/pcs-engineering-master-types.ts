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
  status: EngineeringTaskStatus
  dependsOnTaskIds: string[]
  ownerTeamName: string
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
  sourceTaskId: string
  sourceTaskLabel: string
}

export interface EngineeringMasterOrderRecord {
  masterOrderId: string
  masterOrderCode: string
  styleId: string
  styleCode: string
  styleName: string
  status: EngineeringMasterStatus
  merchandiserName: string
  tasks: EngineeringTaskRecord[]
  priorResultReuseLines: EngineeringPriorResultReuseLine[]
  createdAt: string
  createdBy: string
  publishedAt: string
  closedAt: string
  terminatedAt: string
  terminateReason: string
}

export interface EngineeringMasterOrderSnapshot {
  version: number
  records: EngineeringMasterOrderRecord[]
}
