export type TechPackChangeModule =
  | 'BOM'
  | 'PATTERN'
  | 'PROCESS'
  | 'SIZE'
  | 'COLOR_MATERIAL_MAPPING'
  | 'COST'
  | 'DESIGN'

export type TechPackRelationStatus =
  | 'CURRENT'
  | 'NEW_VERSION_UNEVALUATED'
  | 'CHANGE_IN_REVIEW'
  | 'CHANGED'
  | 'CHANGE_REJECTED'
  | 'PATCHED'
  | 'LOCKED'

export type TechPackChangeRequestStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'EFFECTIVE'
  | 'CANCELLED'

export type ProductionPatchStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'EFFECTIVE'
  | 'REJECTED'
  | 'EXPIRED'
  | 'CANCELLED'

export type ProductionPatchType =
  | 'MATERIAL_REPLACEMENT'
  | 'MATERIAL_USAGE_ADJUSTMENT'
  | 'PATTERN_OVERRIDE'
  | 'PROCESS_OVERRIDE'
  | 'SIZE_RULE_OVERRIDE'
  | 'COLOR_MATERIAL_MAPPING_OVERRIDE'
  | 'COSTING_OVERRIDE'
  | 'ARTWORK_OVERRIDE'
  | 'OTHER_PRODUCTION_OVERRIDE'

export type ChangeEffectiveMode =
  | 'IMMEDIATE_AFTER_APPROVAL'
  | 'FROM_NEXT_PREP'
  | 'FROM_NEXT_PICKUP'
  | 'FROM_NEXT_MARKER'
  | 'FROM_NEXT_PROCESS_ORDER'
  | 'FROM_SPECIFIED_DATE'

export type PatchEffectivePoint =
  | 'FROM_NOW'
  | 'FROM_NEXT_MATERIAL_PREP'
  | 'FROM_NEXT_PICKUP'
  | 'FROM_NEXT_PRINTING'
  | 'FROM_NEXT_DYEING'
  | 'FROM_NEXT_CUTTING'
  | 'FROM_NEXT_MARKER_PLAN'
  | 'FROM_NEXT_SPREADING'
  | 'FROM_NEXT_SEWING'
  | 'FROM_NEXT_AUX_PROCESS'
  | 'FROM_NEXT_SPECIAL_PROCESS'
  | 'SETTLEMENT_ONLY'

export type ProductionOrderChangeSource =
  | 'TECH_PACK_NEW_VERSION'
  | 'MATERIAL_SHORTAGE'
  | 'FACTORY_PROCESS_EXCEPTION'
  | 'PATTERN_SIZE_PRINT_CHANGE'
  | 'COST_EXCEPTION'
  | 'DELIVERY_REQUIREMENT_CHANGE'
  | 'QUALITY_REWORK'

export type ProductionOrderChangeResult =
  | 'VERSION_RELATION'
  | 'PRODUCTION_PATCH'
  | 'VERSION_AND_PATCH'
  | 'RECORD_ONLY'
  | 'COST_ONLY'

export type ProductionOrderChangeExecutionStrategy =
  | 'IMMEDIATE_STOP_LOSS'
  | 'IMMEDIATE_EXECUTION'
  | 'AFTER_APPROVAL'

export type ProductionOrderChangeLockStatus =
  | 'NONE'
  | 'IMPACT_SCOPE_LOCKED'
  | 'WHOLE_ORDER_PAUSED'
  | 'RELEASED'

export type ProductionOrderChangeOrderStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'EXECUTING'
  | 'DONE'
  | 'REJECTED'
  | 'RETURNED'

export type ProductionOrderChangeDocumentType =
  | 'MATERIAL_PREPARATION'
  | 'PICKING'
  | 'CUTTING'
  | 'PRINTING'
  | 'DYEING'
  | 'BUNDLE_TICKET'
  | 'SEWING'
  | 'SETTLEMENT'

export type ProductionOrderChangeDocumentActionStatus =
  | 'NOT_REQUIRED'
  | 'PENDING_CONFIRM'
  | 'PENDING_EXECUTION'
  | 'EXECUTING'
  | 'DONE'
  | 'BLOCKED'

export type ProductionOrderChangeCostType = 'MATERIAL' | 'LABOR' | 'FEE'

export type ProductionOrderChangeTimingNode =
  | 'MATERIAL_PREPARATION'
  | 'PICKING'
  | 'CUTTING'
  | 'PRINTING'
  | 'DYEING'
  | 'SEWING'
  | 'POST_FINISHING'
  | 'SHIPPING'

export interface TechPackVersionOption {
  versionId: string
  versionNo: string
  publishedAt: string
  publishedBy: string
  archived?: boolean
}

export interface ProductionOrderTechPackRelation {
  relationId: string
  productionOrderId: string
  productionOrderNo: string
  spuId: string
  spuCode: string
  styleName: string
  colorCount: number
  sizeCount: number
  deliveryDate: string
  buyerName: string
  merchandiserName: string
  currentTechPackVersionId: string
  currentTechPackVersionNo: string
  frozenSnapshotId: string
  frozenAt: string
  frozenBy: string
  relationStatus: TechPackRelationStatus
  latestPublishedTechPackVersionId: string
  latestPublishedTechPackVersionNo: string
  latestPublishedAt: string
  publishedVersionCount: number
  hasNewerPublishedVersion: boolean
  activePatchCount: number
  pendingPatchCount: number
  historyPatchCount: number
  latestChangeRecordId: string
  updatedAt: string
  diffSummary: Array<{ module: TechPackChangeModule; count: number }>
  progressSummary: string[]
  restrictionSummary: string[]
}

export interface TechPackVersionDiffItem {
  diffItemId: string
  module: TechPackChangeModule
  changeType: '新增' | '删除' | '修改'
  objectName: string
  currentValue: string
  targetValue: string
  impactScope: string
  involvedOccurredBusiness: '是' | '否'
  relatedObjects: string[]
}

export interface TechPackVersionDiffSnapshot {
  diffSnapshotId: string
  productionOrderId: string
  fromTechPackVersionNo: string
  toTechPackVersionNo: string
  items: TechPackVersionDiffItem[]
}

export interface ProductionProgressSection {
  sectionId: string
  sectionName: string
  statusText: string
  rows: Array<{ label: string; value: string; highlight?: boolean }>
}

export interface ProductionProgressSnapshot {
  progressSnapshotId: string
  productionOrderId: string
  updatedAt: string
  sections: ProductionProgressSection[]
}

export interface ChangeRestrictionItem {
  restrictionId: string
  restrictionType: string
  affectedModule: TechPackChangeModule
  affectedObject: string
  reason: string
  blockVersionChange: boolean
  allowPatch: boolean
  relatedDocs: string[]
}

export interface ChangeRestrictionSnapshot {
  restrictionSnapshotId: string
  productionOrderId: string
  judgementText: string
  items: ChangeRestrictionItem[]
}

export interface ProductionOrderTechPackChangeRequest {
  changeRequestId: string
  changeRequestNo: string
  productionOrderId: string
  productionOrderNo: string
  spuId: string
  fromTechPackVersionId: string
  fromTechPackVersionNo: string
  toTechPackVersionId: string
  toTechPackVersionNo: string
  diffSnapshotId: string
  progressSnapshotId: string
  restrictionSnapshotId: string
  changeScope: string
  effectiveMode: ChangeEffectiveMode
  status: TechPackChangeRequestStatus
  submitReason: string
  submittedBy: string
  submittedAt: string
  approvedBy: string
  approvedAt: string
  rejectedReason: string
  effectiveAt: string
  notifyBatchId: string
  createdAt: string
}

export interface ProductionOrderPatch {
  patchId: string
  patchNo: string
  productionOrderId: string
  productionOrderNo: string
  baseTechPackVersionId: string
  baseTechPackVersionNo: string
  patchType: ProductionPatchType
  affectedModule: TechPackChangeModule
  patchScope: string
  effectivePoint: PatchEffectivePoint
  patchContent: string
  reason: string
  status: ProductionPatchStatus
  submittedBy: string
  submittedAt: string
  approvedBy: string
  approvedAt: string
  effectiveAt: string
  expiredAt: string
  linkedObjects: string[]
  notifyBatchId: string
  createdAt: string
}

export interface ProductionChangeFeishuNotice {
  noticeId: string
  notifyBatchId: string
  productionOrderId: string
  triggerEvent: string
  receiverName: string
  receiverRole: string
  module: TechPackChangeModule | 'COMMON'
  sendStatus: '未发送' | '已发送' | '发送失败'
  sentAt: string
  messageId: string
}

export interface ProductionChangeOperationLog {
  logId: string
  productionOrderId: string
  operatedAt: string
  operatorName: string
  operationType: string
  operationObject: string
  beforeText: string
  afterText: string
  remark: string
}

export interface ProductionChangeModuleLanding {
  landingId: string
  productionOrderId: string
  module: TechPackChangeModule
  relationMarker: string
  patchMarkers: string[]
  currentRule: string
  landingObject: string
  ownerRole: string
  ownerName: string
  viewUrl: string
  lastLog: string
}

export type ProductionTechPackPublishEvaluationStatus =
  | '待评估'
  | '已生成待办'
  | '已记录不处理'
  | '已进入生产单变更'

export interface ProductionTechPackPublishEvaluationAffectedOrder {
  productionOrderId: string
  productionOrderNo: string
  currentTechPackVersionId: string
  currentTechPackVersionNo: string
  latestPublishedTechPackVersionId: string
  latestPublishedTechPackVersionNo: string
  progressSummary: string[]
  patchSummary: string
  evaluationStatus: string
}

export interface ProductionTechPackPublishEvaluationBatch {
  batchId: string
  technicalVersionId: string
  technicalVersionCode: string
  versionLabel: string
  styleId: string
  spuCode: string
  styleName: string
  publishedAt: string
  publishedBy: string
  diffModules: TechPackChangeModule[]
  affectedOrders: ProductionTechPackPublishEvaluationAffectedOrder[]
  status: ProductionTechPackPublishEvaluationStatus
  ignoreReason: string
  createdAt: string
  updatedAt: string
}

export interface ProductionOrderChangeScenario {
  id: string
  source: ProductionOrderChangeSource
  title: string
  expectedResult: ProductionOrderChangeResult
  mainAffectedDocuments: ProductionOrderChangeDocumentType[]
  costImpact: ProductionOrderChangeCostType[]
  timingNodes: ProductionOrderChangeTimingNode[]
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH'
}

export interface ProductionOrderChangeOrder {
  id: string
  scenarioId: string
  productionOrderId: string
  demandOrderId: string
  spuCode: string
  styleName: string
  buyerName: string
  merchandiserName: string
  source: ProductionOrderChangeSource
  changeModules: TechPackChangeModule[]
  reason: string
  expectedEffectiveMode: ChangeEffectiveMode
  effectiveDescription: string
  changeResult: ProductionOrderChangeResult
  executionStrategy: ProductionOrderChangeExecutionStrategy
  lockStatus: ProductionOrderChangeLockStatus
  status: ProductionOrderChangeOrderStatus
  hasVersionRelationChange: boolean
  hasProductionPatch: boolean
  affectedDocumentCount: number
  costDeltaAmount: number
  delayDays: number
  createdBy: string
  createdAt: string
  reviewer: string
  latestLog: string
}

export interface ProductionOrderChangeOrderSubmitInput {
  productionOrderId: string
  source: ProductionOrderChangeSource
  changeModules: TechPackChangeModule[]
  reason: string
  expectedEffectiveMode: ChangeEffectiveMode
  effectiveDescription: string
  changeResult: ProductionOrderChangeResult
  executionStrategy: ProductionOrderChangeExecutionStrategy
  operatorName: string
  linkedVersionChangeRequestId?: string
  linkedPatchId?: string
  status?: 'DRAFT'
}

export interface ProductionOrderChangeOrderUpdateInput extends Omit<ProductionOrderChangeOrderSubmitInput, 'status'> {
  status: 'DRAFT' | 'SUBMITTED'
}

export interface ProductionOrderChangePreviewInput {
  productionOrderId: string
  source: ProductionOrderChangeSource
  changeModules: TechPackChangeModule[]
  reason: string
  changeContent: string
  expectedEffectiveMode: ChangeEffectiveMode
  executionMode: ProductionOrderChangeExecutionStrategy
  operatorName: string
}

export interface ProductionOrderChangePreview {
  order: ProductionOrderChangeOrder
  impactRows: ProductionOrderChangeImpactRow[]
  documentActions: ProductionOrderChangeDocumentAction[]
  costImpacts: ProductionOrderChangeCostImpact[]
  timingImpacts: ProductionOrderChangeTimingImpact[]
}

export interface ProductionOrderChangeImpactRow {
  id: string
  changeOrderId: string
  affectedColor: string
  affectedSize: string
  affectedBatch: string
  affectedProcess: string
  affectedQuantity: number
  doneQuantity: number
  changeableQuantity: number
  irreversibleQuantity: number
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH'
  impactSummary: string
}

export interface ProductionOrderChangeDocumentAction {
  id: string
  changeOrderId: string
  documentType: ProductionOrderChangeDocumentType
  documentNo: string
  currentStatus: string
  beforeBusinessContent: string
  afterBusinessContent: string
  systemSuggestion: string
  finalAction: string
  quantityDelta: number
  amountDelta: number
  actionStatus: ProductionOrderChangeDocumentActionStatus
  owner: string
  reasonWhenChanged: string
}

export interface ProductionOrderChangeCostImpact {
  id: string
  changeOrderId: string
  costType: ProductionOrderChangeCostType
  itemName: string
  estimatedAmount: number
  actualAmount: number
  responsibleParty: string
  settlementHandling: string
}

export interface ProductionOrderChangeTimingImpact {
  id: string
  changeOrderId: string
  timingNode: ProductionOrderChangeTimingNode
  originalTime: string
  newEstimatedTime: string
  delayDays: number
  affectsProductionDelivery: boolean
  affectsFulfillmentDelivery: boolean
  responsibleParty: string
  recoveryAction: string
}

export const techPackChangeModuleLabels: Record<TechPackChangeModule, string> = {
  BOM: '物料清单',
  PATTERN: '纸样管理',
  PROCESS: '工序工艺',
  SIZE: '放码规则',
  COLOR_MATERIAL_MAPPING: '款色用料对应',
  COST: '核价',
  DESIGN: '花型设计',
}

export const techPackRelationStatusLabels: Record<TechPackRelationStatus, string> = {
  CURRENT: '当前一致',
  NEW_VERSION_UNEVALUATED: '有新版本未评估',
  CHANGE_IN_REVIEW: '版本变更审核中',
  CHANGED: '已切换',
  CHANGE_REJECTED: '已拒绝切换',
  PATCHED: '有生产补丁',
  LOCKED: '当前进度不可切换',
}

export const techPackRelationStatusClasses: Record<TechPackRelationStatus, string> = {
  CURRENT: 'bg-emerald-100 text-emerald-700',
  NEW_VERSION_UNEVALUATED: 'bg-amber-100 text-amber-700',
  CHANGE_IN_REVIEW: 'bg-blue-100 text-blue-700',
  CHANGED: 'bg-indigo-100 text-indigo-700',
  CHANGE_REJECTED: 'bg-red-100 text-red-700',
  PATCHED: 'bg-cyan-100 text-cyan-700',
  LOCKED: 'bg-slate-200 text-slate-700',
}

export const techPackChangeRequestStatusLabels: Record<TechPackChangeRequestStatus, string> = {
  DRAFT: '草稿',
  SUBMITTED: '已提交',
  UNDER_REVIEW: '审核中',
  APPROVED: '已通过',
  REJECTED: '已拒绝',
  EFFECTIVE: '已生效',
  CANCELLED: '已取消',
}

export const productionPatchStatusLabels: Record<ProductionPatchStatus, string> = {
  DRAFT: '草稿',
  SUBMITTED: '已提交',
  UNDER_REVIEW: '审核中',
  APPROVED: '已通过',
  EFFECTIVE: '已生效',
  REJECTED: '已拒绝',
  EXPIRED: '已失效',
  CANCELLED: '已取消',
}

export const productionPatchTypeLabels: Record<ProductionPatchType, string> = {
  MATERIAL_REPLACEMENT: '物料替代',
  MATERIAL_USAGE_ADJUSTMENT: '用量调整',
  PATTERN_OVERRIDE: '纸样覆盖',
  PROCESS_OVERRIDE: '工序工艺调整',
  SIZE_RULE_OVERRIDE: '放码规则调整',
  COLOR_MATERIAL_MAPPING_OVERRIDE: '款色用料对应调整',
  COSTING_OVERRIDE: '核价调整',
  ARTWORK_OVERRIDE: '花型设计调整',
  OTHER_PRODUCTION_OVERRIDE: '其他生产补丁',
}

export const effectiveModeLabels: Record<ChangeEffectiveMode, string> = {
  IMMEDIATE_AFTER_APPROVAL: '审核通过后立即生效',
  FROM_NEXT_PREP: '从下一次配料开始',
  FROM_NEXT_PICKUP: '从下一次领料开始',
  FROM_NEXT_MARKER: '从下一次唛架开始',
  FROM_NEXT_PROCESS_ORDER: '从下一张工艺单开始',
  FROM_SPECIFIED_DATE: '从指定时间开始',
}

export const productionOrderChangeSourceLabels: Record<ProductionOrderChangeSource, string> = {
  TECH_PACK_NEW_VERSION: '技术包发布新正式版',
  MATERIAL_SHORTAGE: '物料短缺 / 替代料',
  FACTORY_PROCESS_EXCEPTION: '工艺现场异常',
  PATTERN_SIZE_PRINT_CHANGE: '纸样 / 尺码 / 花型调整',
  COST_EXCEPTION: '核价 / 成本异常',
  DELIVERY_REQUIREMENT_CHANGE: '交期 / 发货要求变化',
  QUALITY_REWORK: '质量问题 / 返工要求',
}

export const productionOrderChangeResultLabels: Record<ProductionOrderChangeResult, string> = {
  VERSION_RELATION: '版本关系变更',
  PRODUCTION_PATCH: '生产单层补丁',
  VERSION_AND_PATCH: '版本关系变更 + 生产单层补丁',
  RECORD_ONLY: '仅记录影响',
  COST_ONLY: '仅成本结算差异',
}

export const productionOrderChangeExecutionStrategyLabels: Record<ProductionOrderChangeExecutionStrategy, string> = {
  IMMEDIATE_STOP_LOSS: '立即止损',
  IMMEDIATE_EXECUTION: '立即执行',
  AFTER_APPROVAL: '审核通过后执行',
}

export const productionOrderChangeLockStatusLabels: Record<ProductionOrderChangeLockStatus, string> = {
  NONE: '无锁定',
  IMPACT_SCOPE_LOCKED: '影响范围锁定',
  WHOLE_ORDER_PAUSED: '整单暂停',
  RELEASED: '已释放',
}

export const productionOrderChangeOrderStatusLabels: Record<ProductionOrderChangeOrderStatus, string> = {
  DRAFT: '草稿',
  SUBMITTED: '已提交',
  UNDER_REVIEW: '审核中',
  APPROVED: '已通过',
  EXECUTING: '执行中',
  DONE: '已完成',
  REJECTED: '已驳回',
  RETURNED: '退回修改',
}

export const productionOrderChangeDocumentTypeLabels: Record<ProductionOrderChangeDocumentType, string> = {
  MATERIAL_PREPARATION: '配料单',
  PICKING: '领料单',
  CUTTING: '裁剪单',
  PRINTING: '印花单',
  DYEING: '染色单',
  BUNDLE_TICKET: '菲票',
  SEWING: '车缝单',
  SETTLEMENT: '结算单',
}

export const productionOrderChangeDocumentActionStatusLabels: Record<
  ProductionOrderChangeDocumentActionStatus,
  string
> = {
  NOT_REQUIRED: '无需处理',
  PENDING_CONFIRM: '待确认',
  PENDING_EXECUTION: '待执行',
  EXECUTING: '执行中',
  DONE: '已完成',
  BLOCKED: '已阻塞',
}

export const productionOrderChangeCostTypeLabels: Record<ProductionOrderChangeCostType, string> = {
  MATERIAL: '料差',
  LABOR: '工差',
  FEE: '费用差',
}

export const productionOrderChangeTimingNodeLabels: Record<ProductionOrderChangeTimingNode, string> = {
  MATERIAL_PREPARATION: '配料',
  PICKING: '领料',
  CUTTING: '裁剪',
  PRINTING: '印花',
  DYEING: '染色',
  SEWING: '车缝',
  POST_FINISHING: '后道',
  SHIPPING: '发货',
}

export const patchEffectivePointLabels: Record<PatchEffectivePoint, string> = {
  FROM_NOW: '从现在开始',
  FROM_NEXT_MATERIAL_PREP: '从下一次配料开始',
  FROM_NEXT_PICKUP: '从下一次领料开始',
  FROM_NEXT_PRINTING: '从下一次印花开始',
  FROM_NEXT_DYEING: '从下一次染色开始',
  FROM_NEXT_CUTTING: '从下一次裁片开始',
  FROM_NEXT_MARKER_PLAN: '从下一次唛架方案开始',
  FROM_NEXT_SPREADING: '从下一次铺布开始',
  FROM_NEXT_SEWING: '从下一次车缝交出开始',
  FROM_NEXT_AUX_PROCESS: '从下一次辅助工艺开始',
  FROM_NEXT_SPECIAL_PROCESS: '从下一次特种工艺开始',
  SETTLEMENT_ONLY: '仅影响核价 / 结算',
}

export const productionPatchTypeModuleMap: Record<ProductionPatchType, TechPackChangeModule> = {
  MATERIAL_REPLACEMENT: 'BOM',
  MATERIAL_USAGE_ADJUSTMENT: 'BOM',
  PATTERN_OVERRIDE: 'PATTERN',
  PROCESS_OVERRIDE: 'PROCESS',
  SIZE_RULE_OVERRIDE: 'SIZE',
  COLOR_MATERIAL_MAPPING_OVERRIDE: 'COLOR_MATERIAL_MAPPING',
  COSTING_OVERRIDE: 'COST',
  ARTWORK_OVERRIDE: 'DESIGN',
  OTHER_PRODUCTION_OVERRIDE: 'PROCESS',
}

const moduleLandingOwners: Record<TechPackChangeModule, { role: string; name: string }> = {
  BOM: { role: '物料计划 / 中转仓', name: '中转仓主管' },
  PATTERN: { role: '版师 / 裁床负责人', name: '版师组长' },
  PROCESS: { role: '工序负责人', name: '生产工艺主管' },
  SIZE: { role: '版师 / 菲票打印负责人', name: '裁床主管' },
  COLOR_MATERIAL_MAPPING: { role: '物料计划 / 工厂仓管', name: '物料计划主管' },
  COST: { role: '财务 / 结算', name: '财务结算主管' },
  DESIGN: { role: '花型设计 / 印染负责人', name: '花型设计主管' },
}

const moduleLandingObjects: Record<TechPackChangeModule, string> = {
  BOM: '配料任务、领料单、裁片单物料读取',
  PATTERN: '唛架方案、铺布单、菲票打印',
  PROCESS: '印花 / 染色 / 辅助工艺 / 特种工艺任务',
  SIZE: '尺码放码、裁片编号、菲票数量',
  COLOR_MATERIAL_MAPPING: '款色用料对应、颜色维度领料',
  COST: '核价明细、结算口径、工厂对账',
  DESIGN: '花型版本、印花工单、染色要求',
}

const productionOrderChangeDocumentTypeNames: Record<ProductionOrderChangeDocumentType, string> = {
  MATERIAL_PREPARATION: '配料单',
  PICKING: '领料单',
  CUTTING: '裁剪单',
  PRINTING: '印花单',
  DYEING: '染色单',
  BUNDLE_TICKET: '菲票',
  SEWING: '车缝交出单',
  SETTLEMENT: '结算单',
}

const productionOrderChangeDocumentOwners: Record<ProductionOrderChangeDocumentType, string> = {
  MATERIAL_PREPARATION: '物料计划主管',
  PICKING: '中转仓主管',
  CUTTING: '裁床主管',
  PRINTING: '印花跟单',
  DYEING: '染厂跟单',
  BUNDLE_TICKET: '裁床打印员',
  SEWING: '车缝组长',
  SETTLEMENT: '财务结算主管',
}

const productionOrderChangeScenarioTitles = [
  '技术包发布新正式版，生产单未开始，整单切换新版本。',
  '技术包发布新正式版，已生成配料单，未领料，配料单改配后切换。',
  '技术包发布新正式版，已部分领料，未裁剪，未领部分切换，已领部分按旧或退料。',
  '技术包发布新正式版，已铺布未裁剪，裁剪单需暂停确认。',
  '技术包发布新正式版，已裁剪未印花，未加工工序切换，已裁部分保留。',
  '技术包发布新正式版，印花工单已生成未开工，印花单取消重开。',
  '技术包发布新正式版，印花加工中，当前印花单不改，下批生效。',
  '技术包发布新正式版，染色工单已生成未开工，染色单取消重开。',
  '技术包发布新正式版，染色加工中，追回未染批次，已染批次保留。',
  '技术包发布新正式版，菲票已打印未交出，作废重打菲票。',
  '技术包发布新正式版，车缝已交出部分，只记录影响并通知后道。',
  '技术包发布新正式版，已产生结算草稿，审核通过后追加结算差异。',
  '主面料短缺，未领料范围替代料，生产单层补丁。',
  '主面料短缺，已领旧料未裁，退旧领新，生产单层补丁。',
  '主面料短缺，已裁旧料，剩余色码替代料，生产单层补丁。',
  '里布短缺，指定尺码替代料，生产单层补丁。',
  '辅料短缺，纽扣替代，未车缝范围生效。',
  '辅料短缺，拉链替代，已车缝部分不追回。',
  '面料色差，指定缸号停用，未裁批次改领新缸号。',
  '面料缩水异常，纸样不改，用料单增加损耗补丁。',
  '供应商临时调价，只影响成本核算，不改生产。',
  '面料克重不符，买手确认接受，记录影响并保留原单据。',
  '面料克重不符，买手不接受，未加工批次换料。',
  '面料门幅变化，排版耗用变化，配料单补料。',
  '工艺路线新增洗水，未进入后道范围追加工序。',
  '工艺路线取消压烫，未压烫范围取消工序并扣减工费。',
  '工艺参数改线迹密度，车缝未开工范围按新工艺。',
  '工艺参数改针距，已车缝部分不返工，未车缝部分改做。',
  '工艺现场发现缝份不足，指定尺码返工。',
  '工艺现场发现辅料位置错误，未车缝范围改工艺。',
  '印花颜色调整，印花未开工，印花单改做。',
  '印花颜色调整，印花已开工，当前单保留，下批改做。',
  '印花位置调整，已制版未印，重开印花版费。',
  '印花花型文件替换，印花需求单和加工单同步更新。',
  '染色配方调整，染色未开工，染色单改做。',
  '染色配方调整，部分已染，未染批次改做。',
  '染色返修要求，已染批次追加返修费用。',
  '洗水方式变更，后道未开始范围追加工序。',
  '纸样调整，生产单未裁剪，裁剪单重算。',
  '纸样调整，已裁部分保留，未裁部分重排版。',
  '放码规则调整，指定尺码改纸样。',
  '尺码表调整，只影响未裁尺码。',
  '尺码唛信息错误，菲票和尺码唛补打。',
  '颜色名称修正，只影响单据展示，不影响生产。',
  '款色用料对应错误，指定颜色换用料。',
  '款色用料对应新增颜色，新增配料和领料单。',
  '花型确认晚于生产准备节点，印花未开工补丁生效。',
  '花型确认后买手改图，印花单取消重开。',
  '花型版权问题，指定颜色停止加工。',
  '花型文件清晰度不足，暂缓印花并锁定影响范围。',
  '核价漏计辅料，追加材料成本。',
  '核价漏计印花费，追加加工成本。',
  '核价漏计染色费，追加加工成本。',
  '核价错误导致工价偏低，结算单补差。',
  '核价错误导致工价偏高，结算单扣减。',
  '版费归属变化，费用差异改责任归因。',
  '加急空运要求，追加物流费用。',
  '客户取消加急，取消加急费并调整交期。',
  '交期提前，未开工工序加急并计算费用。',
  '交期延后，生产不改，仅调整时效风险。',
  '发货仓变化，交付仓配置和物流费用变化。',
  '分批发货，指定批次优先生产。',
  '部分取消订单，剩余数量继续生产。',
  '补单追加数量，追加配料、裁剪和工序单据。',
  '质量抽检发现面料瑕疵，未裁范围换料。',
  '质量抽检发现印花偏位，已印批次返工。',
  '质量抽检发现染色色差，染色返修。',
  '质量抽检发现车缝错误，指定扎号返工。',
  '质检扣款确认，只影响结算，不改生产。',
  '工厂报废裁片，补裁并追加材料损耗。',
  '仓库发错料，退错料并重新领料。',
  '仓库少发料，补发并记录时效影响。',
  '工厂误用旧工艺，追回未完成范围并记录责任。',
  '工厂已按旧版本完成，买手接受，仅记录影响。',
  '工厂已按旧版本完成，买手不接受，返工并重新核算。',
  '平台录入错误，纠正单据展示并保留审计记录。',
  '技术包版本发布错误，撤销版本关系变更申请。',
  '补丁审核驳回，释放锁定并按原方案继续。',
  '变更审核退回修改，业务改选单据处理方式。',
  '变更执行完成后发现遗漏单据，追加处理记录和成本差异。',
] as const

function uniqueList<T>(items: T[]): T[] {
  return items.filter((item, index) => items.indexOf(item) === index)
}

function getScenarioSource(index: number, title: string): ProductionOrderChangeSource {
  const sequence = index + 1
  if (sequence <= 12 || sequence === 77) return 'TECH_PACK_NEW_VERSION'
  if (sequence >= 51 && sequence <= 58) return title.includes('交期') || title.includes('空运') ? 'DELIVERY_REQUIREMENT_CHANGE' : 'COST_EXCEPTION'
  if (sequence >= 59 && sequence <= 64) return 'DELIVERY_REQUIREMENT_CHANGE'
  if (sequence >= 65) return 'QUALITY_REWORK'
  if (sequence >= 39 && sequence <= 50) return 'PATTERN_SIZE_PRINT_CHANGE'
  if (sequence >= 25 && sequence <= 38) return 'FACTORY_PROCESS_EXCEPTION'
  return title.includes('调价') || title.includes('成本') ? 'COST_EXCEPTION' : 'MATERIAL_SHORTAGE'
}

function getScenarioExpectedResult(index: number, title: string): ProductionOrderChangeResult {
  if (
    title.includes('只影响成本') ||
    title.includes('只影响结算') ||
    title.includes('核价') ||
    title.includes('工价') ||
    title.includes('扣款') ||
    title.includes('费用差异改责任')
  ) {
    return 'COST_ONLY'
  }
  if (
    title.includes('只记录') ||
    title.includes('记录影响') ||
    title.includes('保留原单据') ||
    title.includes('颜色名称修正') ||
    title.includes('买手接受') ||
    title.includes('不改生产')
  ) {
    return 'RECORD_ONLY'
  }
  if (index < 12) {
    return title.includes('补丁') ||
      title.includes('部分') ||
      title.includes('暂停') ||
      title.includes('追回') ||
      title.includes('作废') ||
      title.includes('追加')
      ? 'VERSION_AND_PATCH'
      : 'VERSION_RELATION'
  }
  return title.includes('技术包版本发布错误') ? 'VERSION_RELATION' : 'PRODUCTION_PATCH'
}

function getScenarioDocuments(title: string, result: ProductionOrderChangeResult): ProductionOrderChangeDocumentType[] {
  const documents: ProductionOrderChangeDocumentType[] = []
  if (/配料|用料|物料|面料|里布|辅料|纽扣|拉链|仓库|领料|补料/.test(title)) {
    documents.push('MATERIAL_PREPARATION', 'PICKING')
  }
  if (/裁|铺布|纸样|排版|唛架|尺码|菲票|扎号/.test(title)) documents.push('CUTTING', 'BUNDLE_TICKET')
  if (/印花|花型|制版|图/.test(title)) documents.push('PRINTING')
  if (/染色|缸号|色差/.test(title)) documents.push('DYEING')
  if (/车缝|针距|线迹|返工|后道|压烫|洗水/.test(title)) documents.push('SEWING')
  if (/核价|成本|费用|结算|扣款|工价|版费/.test(title)) documents.push('SETTLEMENT')
  if (result === 'VERSION_RELATION' || result === 'VERSION_AND_PATCH') documents.push('MATERIAL_PREPARATION', 'CUTTING')
  if (result === 'COST_ONLY') documents.push('SETTLEMENT')
  return uniqueList(documents.length > 0 ? documents : ['MATERIAL_PREPARATION'])
}

function getScenarioCostImpact(title: string, source: ProductionOrderChangeSource): ProductionOrderChangeCostType[] {
  const impacts: ProductionOrderChangeCostType[] = []
  if (/面料|物料|里布|辅料|纽扣|拉链|用料|补料|裁片/.test(title)) impacts.push('MATERIAL')
  if (/工艺|车缝|印花|染色|洗水|返工|压烫|针距|线迹/.test(title)) impacts.push('LABOR')
  if (/费用|成本|核价|结算|扣款|工价|版费|空运|物流|调价/.test(title)) impacts.push('FEE')
  if (impacts.length > 0) return uniqueList(impacts)
  if (source === 'MATERIAL_SHORTAGE') return ['MATERIAL']
  if (source === 'COST_EXCEPTION' || source === 'DELIVERY_REQUIREMENT_CHANGE') return ['FEE']
  return ['LABOR']
}

function getScenarioTimingNodes(title: string): ProductionOrderChangeTimingNode[] {
  const nodes: ProductionOrderChangeTimingNode[] = []
  if (/配料|用料|物料|面料|辅料|补料/.test(title)) nodes.push('MATERIAL_PREPARATION')
  if (/领料|仓库|退料|补发/.test(title)) nodes.push('PICKING')
  if (/裁|铺布|纸样|排版|裁片/.test(title)) nodes.push('CUTTING')
  if (/印花|花型|制版/.test(title)) nodes.push('PRINTING')
  if (/染色|缸号|色差/.test(title)) nodes.push('DYEING')
  if (/车缝|针距|线迹/.test(title)) nodes.push('SEWING')
  if (/洗水|后道|压烫|返工|质检/.test(title)) nodes.push('POST_FINISHING')
  if (/交期|发货|空运|物流|订单|补单/.test(title)) nodes.push('SHIPPING')
  return uniqueList(nodes.length > 0 ? nodes : ['MATERIAL_PREPARATION'])
}

function getScenarioRiskLevel(title: string): 'LOW' | 'MEDIUM' | 'HIGH' {
  if (/暂停|锁定|返工|不接受|停止|报废|加工中|版权|遗漏|追回|已交出|旧版本完成/.test(title)) return 'HIGH'
  if (/未开始|只影响|不改生产|仅记录|保留原单据/.test(title)) return 'LOW'
  return 'MEDIUM'
}

function getScenarioModules(title: string): TechPackChangeModule[] {
  const modules: TechPackChangeModule[] = []
  if (/配料|领料|物料|面料|里布|辅料|纽扣|拉链|用料|门幅|克重|仓库|补料/.test(title)) modules.push('BOM')
  if (/纸样|裁|铺布|排版|补裁/.test(title)) modules.push('PATTERN')
  if (/尺码|放码|尺码唛|菲票|扎号/.test(title)) modules.push('SIZE')
  if (/颜色|款色|缸号/.test(title)) modules.push('COLOR_MATERIAL_MAPPING')
  if (/工艺|车缝|印花|染色|洗水|压烫|针距|线迹|后道|返工/.test(title)) modules.push('PROCESS')
  if (/花型|图|版权|清晰度/.test(title)) modules.push('DESIGN')
  if (/核价|成本|费用|结算|扣款|工价|版费|调价|物流/.test(title)) modules.push('COST')
  return uniqueList(modules.length > 0 ? modules : ['PROCESS'])
}

type ProductionOrderChangeScenarioOverride = Pick<
  ProductionOrderChangeScenario,
  'expectedResult' | 'mainAffectedDocuments' | 'costImpact' | 'timingNodes' | 'riskLevel'
>

const productionOrderChangeScenarioOverrides: Partial<Record<string, ProductionOrderChangeScenarioOverride>> = {
  'SCN-001': {
    expectedResult: 'VERSION_RELATION',
    mainAffectedDocuments: ['MATERIAL_PREPARATION', 'PICKING', 'CUTTING'],
    costImpact: [],
    timingNodes: ['MATERIAL_PREPARATION', 'PICKING', 'CUTTING'],
    riskLevel: 'LOW',
  },
  'SCN-002': {
    expectedResult: 'VERSION_RELATION',
    mainAffectedDocuments: ['MATERIAL_PREPARATION', 'PICKING'],
    costImpact: [],
    timingNodes: ['MATERIAL_PREPARATION', 'PICKING'],
    riskLevel: 'MEDIUM',
  },
  'SCN-005': {
    expectedResult: 'VERSION_AND_PATCH',
    mainAffectedDocuments: ['CUTTING', 'PRINTING', 'BUNDLE_TICKET'],
    costImpact: [],
    timingNodes: ['CUTTING', 'PRINTING'],
    riskLevel: 'MEDIUM',
  },
  'SCN-008': {
    expectedResult: 'VERSION_AND_PATCH',
    mainAffectedDocuments: ['DYEING'],
    costImpact: ['LABOR'],
    timingNodes: ['DYEING'],
    riskLevel: 'MEDIUM',
  },
  'SCN-025': {
    expectedResult: 'PRODUCTION_PATCH',
    mainAffectedDocuments: ['SEWING', 'SETTLEMENT'],
    costImpact: ['LABOR'],
    timingNodes: ['SEWING', 'POST_FINISHING'],
    riskLevel: 'MEDIUM',
  },
  'SCN-034': {
    expectedResult: 'PRODUCTION_PATCH',
    mainAffectedDocuments: ['PRINTING'],
    costImpact: ['FEE'],
    timingNodes: ['PRINTING'],
    riskLevel: 'MEDIUM',
  },
  'SCN-051': {
    expectedResult: 'COST_ONLY',
    mainAffectedDocuments: ['SETTLEMENT'],
    costImpact: ['MATERIAL'],
    timingNodes: ['MATERIAL_PREPARATION'],
    riskLevel: 'LOW',
  },
  'SCN-059': {
    expectedResult: 'PRODUCTION_PATCH',
    mainAffectedDocuments: ['SEWING', 'SETTLEMENT'],
    costImpact: ['LABOR', 'FEE'],
    timingNodes: ['SEWING', 'SHIPPING'],
    riskLevel: 'HIGH',
  },
  'SCN-060': {
    expectedResult: 'RECORD_ONLY',
    mainAffectedDocuments: ['SETTLEMENT'],
    costImpact: [],
    timingNodes: ['SHIPPING'],
    riskLevel: 'LOW',
  },
}

const productionOrderChangeScenarioCatalog: ProductionOrderChangeScenario[] = productionOrderChangeScenarioTitles.map(
  (title, index) => {
    const id = `SCN-${String(index + 1).padStart(3, '0')}`
    const source = getScenarioSource(index, title)
    const expectedResult = getScenarioExpectedResult(index, title)
    const scenario: ProductionOrderChangeScenario = {
      id,
      source,
      title,
      expectedResult,
      mainAffectedDocuments: getScenarioDocuments(title, expectedResult),
      costImpact: getScenarioCostImpact(title, source),
      timingNodes: getScenarioTimingNodes(title),
      riskLevel: getScenarioRiskLevel(title),
    }
    const override = productionOrderChangeScenarioOverrides[id]
    return override ? { ...scenario, ...override } : scenario
  },
)

function requireProductionOrderChangeScenario(scenarioId: string): ProductionOrderChangeScenario {
  const scenario = productionOrderChangeScenarioCatalog.find((item) => item.id === scenarioId)
  if (!scenario) throw new Error(`未找到生产单变更场景：${scenarioId}`)
  return scenario
}

const productionOrderChangeOrderPlans: Array<{
  scenarioId: string
  changeResult: ProductionOrderChangeResult
  productionOrderId?: string
  id?: string
}> = [
  { scenarioId: 'SCN-001', changeResult: 'VERSION_RELATION', productionOrderId: 'PO-202603-0006' },
  { scenarioId: 'SCN-002', changeResult: 'VERSION_RELATION', productionOrderId: 'PO-202604-0018' },
  { scenarioId: 'SCN-077', changeResult: 'VERSION_RELATION', productionOrderId: 'PO-202603-0011' },
  { scenarioId: 'SCN-006', changeResult: 'VERSION_RELATION', productionOrderId: 'PO-202603-0012' },
  { scenarioId: 'SCN-007', changeResult: 'VERSION_RELATION', productionOrderId: 'PO-202603-0013' },
  { scenarioId: 'SCN-039', changeResult: 'PRODUCTION_PATCH', productionOrderId: 'PO-202603-0014' },
  {
    scenarioId: 'SCN-013',
    changeResult: 'PRODUCTION_PATCH',
    productionOrderId: 'PO-202603-0004',
    id: 'CHANGE-PO-202603-0004-001',
  },
  {
    scenarioId: 'SCN-003',
    changeResult: 'VERSION_AND_PATCH',
    productionOrderId: 'PO-202603-0004',
    id: 'CHANGE-PO-202603-0004-002',
  },
  {
    scenarioId: 'SCN-021',
    changeResult: 'COST_ONLY',
    productionOrderId: 'PO-202603-0004',
    id: 'CHANGE-PO-202603-0004-003',
  },
  {
    scenarioId: 'SCN-017',
    changeResult: 'PRODUCTION_PATCH',
    productionOrderId: 'PO-202603-0013',
    id: 'CHANGE-PO-202603-0013-002',
  },
  {
    scenarioId: 'SCN-025',
    changeResult: 'PRODUCTION_PATCH',
    productionOrderId: 'PO-202603-0013',
    id: 'CHANGE-PO-202603-0013-003',
  },
  {
    scenarioId: 'SCN-080',
    changeResult: 'RECORD_ONLY',
    productionOrderId: 'PO-202603-0013',
    id: 'CHANGE-PO-202603-0013-004',
  },
  { scenarioId: 'SCN-017', changeResult: 'PRODUCTION_PATCH', productionOrderId: 'PO-202603-0015' },
  { scenarioId: 'SCN-019', changeResult: 'PRODUCTION_PATCH', productionOrderId: 'PO-202603-0016' },
  { scenarioId: 'SCN-025', changeResult: 'PRODUCTION_PATCH', productionOrderId: 'PO-202603-0017' },
  { scenarioId: 'SCN-026', changeResult: 'PRODUCTION_PATCH', productionOrderId: 'PO-202603-0018' },
  { scenarioId: 'SCN-042', changeResult: 'PRODUCTION_PATCH', productionOrderId: 'PO-202603-0019' },
  { scenarioId: 'SCN-066', changeResult: 'PRODUCTION_PATCH', productionOrderId: 'PO-202603-0026' },
  { scenarioId: 'SCN-003', changeResult: 'VERSION_AND_PATCH', productionOrderId: 'PO-202603-0020' },
  { scenarioId: 'SCN-004', changeResult: 'VERSION_AND_PATCH', productionOrderId: 'PO-202603-0021' },
  { scenarioId: 'SCN-009', changeResult: 'VERSION_AND_PATCH', productionOrderId: 'PO-202603-0022' },
  { scenarioId: 'SCN-010', changeResult: 'VERSION_AND_PATCH', productionOrderId: 'PO-202603-0023' },
  { scenarioId: 'SCN-005', changeResult: 'VERSION_AND_PATCH', productionOrderId: 'PO-202603-0024' },
  { scenarioId: 'SCN-008', changeResult: 'VERSION_AND_PATCH', productionOrderId: 'PO-202603-0025' },
  { scenarioId: 'SCN-022', changeResult: 'RECORD_ONLY', productionOrderId: 'PO-202603-0027' },
  { scenarioId: 'SCN-011', changeResult: 'RECORD_ONLY', productionOrderId: 'PO-202603-0028' },
  { scenarioId: 'SCN-044', changeResult: 'RECORD_ONLY', productionOrderId: 'PO-202603-0032' },
  { scenarioId: 'SCN-021', changeResult: 'COST_ONLY', productionOrderId: 'PO-202603-0029' },
  { scenarioId: 'SCN-054', changeResult: 'COST_ONLY', productionOrderId: 'PO-202603-0030' },
  { scenarioId: 'SCN-051', changeResult: 'COST_ONLY', productionOrderId: 'PO-202603-0031' },
]

const productionOrderChangeStyleSeeds = [
  { spuCode: 'SPU-2024-010', styleName: '弹力斜纹束脚裤', buyerName: '廖敏', merchandiserName: '陈静' },
  { spuCode: 'SPU-2024-011', styleName: '亚麻宽松衬衫', buyerName: '何佳', merchandiserName: '林晓' },
  { spuCode: 'SPU-2024-012', styleName: '压褶中长连衣裙', buyerName: '许晴', merchandiserName: '周敏' },
  { spuCode: 'SPU-2024-013', styleName: '连帽卫衣外套', buyerName: '宋雨', merchandiserName: '陈静' },
  { spuCode: 'SPU-2024-014', styleName: '牛仔 A 字半裙', buyerName: '廖敏', merchandiserName: '林晓' },
  { spuCode: 'SPU-2026-018', styleName: '印花阔腿连体裤', buyerName: '李娜', merchandiserName: '陈静' },
]

const productionOrderChangeStatuses: ProductionOrderChangeOrderStatus[] = [
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'APPROVED',
  'EXECUTING',
  'DONE',
  'REJECTED',
  'RETURNED',
]

const productionOrderChangeOrderSemanticOverrides: Partial<
  Record<string, { changeModules?: TechPackChangeModule[]; costDeltaAmount?: number }>
> = {
  'SCN-001': {
    changeModules: ['BOM', 'PATTERN', 'PROCESS', 'SIZE', 'COLOR_MATERIAL_MAPPING', 'DESIGN'],
    costDeltaAmount: 0,
  },
  'SCN-002': {
    changeModules: ['BOM'],
    costDeltaAmount: 0,
  },
  'SCN-005': {
    changeModules: ['PATTERN', 'PROCESS', 'DESIGN'],
    costDeltaAmount: 0,
  },
  'SCN-008': {
    changeModules: ['PROCESS'],
    costDeltaAmount: 1200,
  },
  'SCN-025': {
    changeModules: ['PROCESS', 'COST'],
    costDeltaAmount: 2400,
  },
  'SCN-034': {
    changeModules: ['DESIGN', 'PROCESS'],
    costDeltaAmount: 1800,
  },
  'SCN-051': {
    changeModules: ['BOM', 'COST'],
    costDeltaAmount: 1600,
  },
  'SCN-059': {
    changeModules: ['PROCESS', 'COST'],
    costDeltaAmount: 3600,
  },
  'SCN-060': {
    changeModules: ['PROCESS'],
    costDeltaAmount: 0,
  },
}

function getProductionOrderChangeOrderModules(scenario: ProductionOrderChangeScenario): TechPackChangeModule[] {
  return [...(productionOrderChangeOrderSemanticOverrides[scenario.id]?.changeModules ?? getScenarioModules(scenario.title))]
}

function getProductionOrderChangeOrderCostDeltaAmount(
  plan: { changeResult: ProductionOrderChangeResult },
  scenario: ProductionOrderChangeScenario,
  index: number,
): number {
  const overrideAmount = productionOrderChangeOrderSemanticOverrides[scenario.id]?.costDeltaAmount
  if (overrideAmount !== undefined) return overrideAmount
  if (plan.changeResult === 'RECORD_ONLY' || scenario.costImpact.length === 0) return 0
  return (
    (scenario.costImpact.includes('FEE') ? 2800 : 1600) *
    (scenario.riskLevel === 'HIGH' ? 3 : index % 2 === 0 ? 1 : -1)
  )
}

let productionOrderChangeOrders: ProductionOrderChangeOrder[] = productionOrderChangeOrderPlans.map((plan, index) => {
  const scenario = requireProductionOrderChangeScenario(plan.scenarioId)
  const style = productionOrderChangeStyleSeeds[index % productionOrderChangeStyleSeeds.length]
  const hasVersionRelationChange =
    plan.changeResult === 'VERSION_RELATION' || plan.changeResult === 'VERSION_AND_PATCH'
  const hasProductionPatch = plan.changeResult === 'PRODUCTION_PATCH' || plan.changeResult === 'VERSION_AND_PATCH'
  const executionStrategy: ProductionOrderChangeExecutionStrategy =
    scenario.riskLevel === 'HIGH'
      ? 'IMMEDIATE_STOP_LOSS'
      : index % 3 === 0
        ? 'IMMEDIATE_EXECUTION'
        : 'AFTER_APPROVAL'
  const status = productionOrderChangeStatuses[index % productionOrderChangeStatuses.length]
  const lockStatus: ProductionOrderChangeLockStatus =
    status === 'DONE'
      ? 'RELEASED'
      : executionStrategy === 'IMMEDIATE_STOP_LOSS'
        ? 'WHOLE_ORDER_PAUSED'
        : scenario.riskLevel === 'MEDIUM'
          ? 'IMPACT_SCOPE_LOCKED'
          : 'NONE'
  const effectiveMode: ChangeEffectiveMode =
    plan.changeResult === 'COST_ONLY'
      ? 'FROM_SPECIFIED_DATE'
      : plan.changeResult === 'VERSION_RELATION'
        ? 'IMMEDIATE_AFTER_APPROVAL'
        : scenario.mainAffectedDocuments.includes('PICKING')
          ? 'FROM_NEXT_PICKUP'
          : scenario.mainAffectedDocuments.includes('PRINTING') || scenario.mainAffectedDocuments.includes('DYEING')
            ? 'FROM_NEXT_PROCESS_ORDER'
            : 'FROM_NEXT_PREP'

  return {
    id: plan.id ?? `CHANGE-${plan.productionOrderId}-${String(index + 1).padStart(3, '0')}`,
    scenarioId: scenario.id,
    productionOrderId: plan.productionOrderId ?? `PO-202603-${String(index + 10).padStart(4, '0')}`,
    demandOrderId: `DO-202603-${String(index + 4).padStart(4, '0')}`,
    spuCode: style.spuCode,
    styleName: style.styleName,
    buyerName: style.buyerName,
    merchandiserName: style.merchandiserName,
    source: scenario.source,
    changeModules: getProductionOrderChangeOrderModules(scenario),
    reason: scenario.title,
    expectedEffectiveMode: effectiveMode,
    effectiveDescription: effectiveModeLabels[effectiveMode],
    changeResult: plan.changeResult,
    executionStrategy,
    lockStatus,
    status,
    hasVersionRelationChange,
    hasProductionPatch,
    affectedDocumentCount: getScenarioDocuments(scenario.title, plan.changeResult).length + (scenario.riskLevel === 'HIGH' ? 2 : 1),
    costDeltaAmount: getProductionOrderChangeOrderCostDeltaAmount(plan, scenario, index),
    delayDays: scenario.timingNodes.includes('SHIPPING') ? 3 + (index % 3) : scenario.riskLevel === 'HIGH' ? 2 : index % 2,
    createdBy: index % 2 === 0 ? style.merchandiserName : '生产计划专员',
    createdAt: `2026-03-${String(4 + index).padStart(2, '0')} ${index % 2 === 0 ? '09:20' : '14:10'}`,
    reviewer: plan.changeResult === 'COST_ONLY' ? '财务主管' : '生产主管',
    latestLog: `${productionOrderChangeResultLabels[plan.changeResult]}已生成处理清单，${productionOrderChangeExecutionStrategyLabels[executionStrategy]}。`,
  }
})

function buildProductionOrderChangeImpactRow(
  order: ProductionOrderChangeOrder,
  rowIndex: number,
  variant: number,
): ProductionOrderChangeImpactRow {
  if (order.id === 'CHANGE-PO-202603-0004-001' && variant === 0) {
    return {
      id: `IMPACT-${String(rowIndex + 1).padStart(3, '0')}`,
      changeOrderId: order.id,
      affectedColor: '黑色',
      affectedSize: 'M',
      affectedBatch: '第 2 批',
      affectedProcess: '裁剪前未领料范围',
      affectedQuantity: 180,
      doneQuantity: 0,
      changeableQuantity: 180,
      irreversibleQuantity: 0,
      riskLevel: 'MEDIUM',
      impactSummary: '黑色 M 码第 2 批尚未领料，可直接改用替代主面料。',
    }
  }

  const colors = ['黑色', '藏青色', '米白色', '军绿色', '浅蓝色']
  const sizes = ['S', 'M', 'L', 'XL', '均码']
  const batches = ['第 1 批', '第 2 批', '第 3 批', '补单批次']
  const processes = ['配料待确认范围', '已领未裁范围', '印花未开工范围', '染色待追回批次', '车缝未交出范围']
  const affectedQuantity = 96 + ((rowIndex + variant) % 6) * 24
  const irreversibleQuantity = order.executionStrategy === 'IMMEDIATE_STOP_LOSS' && variant > 0 ? 24 : 0

  return {
    id: `IMPACT-${String(rowIndex + 1).padStart(3, '0')}`,
    changeOrderId: order.id,
    affectedColor: colors[(rowIndex + variant) % colors.length],
    affectedSize: sizes[(rowIndex + order.id.length + variant) % sizes.length],
    affectedBatch: batches[(rowIndex + variant) % batches.length],
    affectedProcess: processes[(rowIndex + variant) % processes.length],
    affectedQuantity,
    doneQuantity: variant === 0 ? 0 : Math.round(affectedQuantity * 0.35),
    changeableQuantity: affectedQuantity - irreversibleQuantity,
    irreversibleQuantity,
    riskLevel: order.executionStrategy === 'IMMEDIATE_STOP_LOSS' ? 'HIGH' : rowIndex % 2 === 0 ? 'MEDIUM' : 'LOW',
    impactSummary: `${order.styleName}${processes[(rowIndex + variant) % processes.length]}需要按${productionOrderChangeResultLabels[order.changeResult]}处理。`,
  }
}

const productionOrderChangeImpactSeedRows = productionOrderChangeOrders
  .filter((order) => order.changeResult !== 'COST_ONLY')
  .flatMap((order, index) => [
    buildProductionOrderChangeImpactRow(order, index * 2, 0),
    ...(order.executionStrategy === 'IMMEDIATE_STOP_LOSS'
      ? [buildProductionOrderChangeImpactRow(order, index * 2 + 1, 1)]
      : []),
  ])

let productionOrderChangeImpactRows: ProductionOrderChangeImpactRow[] = [
  ...productionOrderChangeImpactSeedRows,
  ...productionOrderChangeOrders
    .filter((order) => order.changeResult !== 'COST_ONLY')
    .slice(0, Math.max(0, 36 - productionOrderChangeImpactSeedRows.length))
    .map((order, index) => buildProductionOrderChangeImpactRow(order, productionOrderChangeImpactSeedRows.length + index, 2)),
].slice(0, 36).map((row, index) => ({
  ...row,
  id: `IMPACT-${String(index + 1).padStart(3, '0')}`,
}))

const productionOrderChangeRequiredDocumentPlans: Array<{
  changeResult: ProductionOrderChangeResult
  documentType: ProductionOrderChangeDocumentType
}> = [
  ...(['MATERIAL_PREPARATION', 'PICKING', 'CUTTING', 'PRINTING', 'DYEING', 'BUNDLE_TICKET', 'SETTLEMENT'] as ProductionOrderChangeDocumentType[])
    .flatMap((documentType) => [0, 1].map(() => ({ changeResult: 'VERSION_RELATION' as const, documentType }))),
  ...(['MATERIAL_PREPARATION', 'PICKING', 'CUTTING', 'PRINTING', 'DYEING', 'BUNDLE_TICKET', 'SEWING', 'SETTLEMENT'] as ProductionOrderChangeDocumentType[])
    .flatMap((documentType) => [0, 1].map(() => ({ changeResult: 'PRODUCTION_PATCH' as const, documentType }))),
  ...(['MATERIAL_PREPARATION', 'PICKING', 'CUTTING', 'PRINTING', 'DYEING', 'BUNDLE_TICKET', 'SEWING', 'SETTLEMENT'] as ProductionOrderChangeDocumentType[])
    .flatMap((documentType) => [0, 1].map(() => ({ changeResult: 'VERSION_AND_PATCH' as const, documentType }))),
  ...(['BUNDLE_TICKET', 'SEWING', 'SETTLEMENT'] as ProductionOrderChangeDocumentType[]).map((documentType) => ({
    changeResult: 'RECORD_ONLY' as const,
    documentType,
  })),
  ...[0, 1, 2].map(() => ({ changeResult: 'COST_ONLY' as const, documentType: 'SETTLEMENT' as const })),
]

function pickProductionOrderChangeOrder(
  changeResult: ProductionOrderChangeResult,
  index: number,
): ProductionOrderChangeOrder {
  const orders = productionOrderChangeOrders.filter((order) => order.changeResult === changeResult)
  return orders[index % orders.length]
}

function buildProductionOrderChangeDocumentAction(
  order: ProductionOrderChangeOrder,
  documentType: ProductionOrderChangeDocumentType,
  index: number,
): ProductionOrderChangeDocumentAction {
  const documentName = productionOrderChangeDocumentTypeNames[documentType]
  const status: ProductionOrderChangeDocumentActionStatus =
    order.lockStatus === 'WHOLE_ORDER_PAUSED'
      ? 'BLOCKED'
      : order.status === 'DONE'
        ? 'DONE'
        : index % 3 === 0
          ? 'PENDING_CONFIRM'
          : index % 3 === 1
            ? 'PENDING_EXECUTION'
            : 'EXECUTING'
  const quantityDelta = documentType === 'SETTLEMENT' ? 0 : ((index % 5) - 2) * 12
  const amountDelta = documentType === 'SETTLEMENT' ? order.costDeltaAmount : Math.round(order.costDeltaAmount / Math.max(order.affectedDocumentCount, 1))

  return {
    id: `DOC-ACT-${String(index + 1).padStart(3, '0')}`,
    changeOrderId: order.id,
    documentType,
    documentNo: `${documentName}-${order.productionOrderId.replace('PO-', '')}-${String(index + 1).padStart(3, '0')}`,
    currentStatus: status === 'BLOCKED' ? '已锁定待主管确认' : status === 'DONE' ? '已处理' : '待处理',
    beforeBusinessContent: `${documentName}原按${order.styleName}冻结技术包和旧处理口径执行。`,
    afterBusinessContent: `${documentName}调整为${productionOrderChangeResultLabels[order.changeResult]}后的处理口径。`,
    systemSuggestion: `${documentName}建议由${productionOrderChangeDocumentOwners[documentType]}确认${order.effectiveDescription}。`,
    finalAction: status === 'BLOCKED' ? '暂停当前单据并等待主管放行' : `按${productionOrderChangeResultLabels[order.changeResult]}处理${documentName}`,
    quantityDelta,
    amountDelta,
    actionStatus: status,
    owner: productionOrderChangeDocumentOwners[documentType],
    reasonWhenChanged: order.reason,
  }
}

const productionOrderChangeDocumentActionPlans = [
  ...productionOrderChangeRequiredDocumentPlans.map((plan, index) => ({
    order: pickProductionOrderChangeOrder(plan.changeResult, index),
    documentType: plan.documentType,
  })),
  ...productionOrderChangeOrders.slice(0, 20).map((order) => ({
    order,
    documentType: requireProductionOrderChangeScenario(order.scenarioId).mainAffectedDocuments[0],
  })),
]

let productionOrderChangeDocumentActions: ProductionOrderChangeDocumentAction[] =
  productionOrderChangeDocumentActionPlans.map((plan, index) =>
    buildProductionOrderChangeDocumentAction(plan.order, plan.documentType, index),
  )

const productionOrderChangeCostItemNames: Record<ProductionOrderChangeCostType, string[]> = {
  MATERIAL: ['主面料替代差价', '辅料补领成本', '补裁材料损耗'],
  LABOR: ['印花返修工费', '车缝返工工费', '染色追加加工费'],
  FEE: ['版费归属差异', '加急物流费', '结算补差费用'],
}

const productionOrderChangeCostImpactOrders = [
  ...productionOrderChangeOrders.filter((order) => order.changeResult === 'COST_ONLY'),
  ...productionOrderChangeOrders.filter((order) => order.changeResult !== 'COST_ONLY' && order.costDeltaAmount !== 0),
]

let productionOrderChangeCostImpacts: ProductionOrderChangeCostImpact[] = productionOrderChangeCostImpactOrders.map(
  (order, index) => {
    const costType: ProductionOrderChangeCostType = (['MATERIAL', 'LABOR', 'FEE'] as ProductionOrderChangeCostType[])[index % 3]
    const estimatedAmount = Math.abs(order.costDeltaAmount) + 600 + index * 80
    const actualAmount = estimatedAmount + (index % 2 === 0 ? 120 : -90)
    return {
      id: `COST-IMPACT-${String(index + 1).padStart(3, '0')}`,
      changeOrderId: order.id,
      costType,
      itemName: productionOrderChangeCostItemNames[costType][index % productionOrderChangeCostItemNames[costType].length],
      estimatedAmount,
      actualAmount,
      responsibleParty:
        costType === 'MATERIAL'
          ? '物料计划 / 供应商'
          : costType === 'LABOR'
            ? '工厂工艺负责人'
            : '财务结算 / 买手',
      settlementHandling:
        actualAmount >= estimatedAmount
          ? '进入本次结算补差，需保留变更单和主管确认记录。'
          : '进入本次结算扣减，需同步工厂对账说明。',
    }
  },
)

const productionOrderChangeTimingImpactOrders = [
  ...productionOrderChangeOrders.filter((order) => order.source === 'DELIVERY_REQUIREMENT_CHANGE'),
  ...productionOrderChangeOrders.filter((order) => (
    order.source !== 'DELIVERY_REQUIREMENT_CHANGE' &&
    order.changeResult !== 'COST_ONLY' &&
    order.changeResult !== 'RECORD_ONLY'
  )),
]

let productionOrderChangeTimingImpacts: ProductionOrderChangeTimingImpact[] = productionOrderChangeTimingImpactOrders.map(
  (order, index) => {
    const scenario = requireProductionOrderChangeScenario(order.scenarioId)
    const timingNode = scenario.timingNodes[index % scenario.timingNodes.length]
    const delayDays = Math.max(order.delayDays, index % 4)
    return {
      id: `TIME-IMPACT-${String(index + 1).padStart(3, '0')}`,
      changeOrderId: order.id,
      timingNode,
      originalTime: `2026-03-${String(10 + index).padStart(2, '0')} 10:00`,
      newEstimatedTime: `2026-03-${String(10 + index + delayDays).padStart(2, '0')} 18:00`,
      delayDays,
      affectsProductionDelivery: timingNode !== 'SHIPPING' && delayDays > 0,
      affectsFulfillmentDelivery: timingNode === 'SHIPPING' || delayDays >= 3,
      responsibleParty: timingNode === 'SHIPPING' ? '履约计划' : timingNode === 'PICKING' ? '中转仓主管' : '生产计划',
      recoveryAction:
        order.executionStrategy === 'IMMEDIATE_STOP_LOSS'
          ? '先锁定影响范围，追回未完成批次，主管确认后释放。'
          : timingNode === 'SHIPPING'
            ? '调整发货批次并同步买手交期风险。'
            : '优先处理未开工范围，已完成部分保留追溯记录。',
    }
  },
)

const publishedTechPackVersionOptionsBySpu: Record<string, TechPackVersionOption[]> = {
  'SPU-2024-010': [
    { versionId: 'TDV-SPU-2024-010-v1-0', versionNo: '正式版 v1.0', publishedAt: '2026-03-01 09:00', publishedBy: '陈静' },
    { versionId: 'TDV-SPU-2024-010-v1-1', versionNo: '正式版 v1.1', publishedAt: '2026-03-10 11:20', publishedBy: '陈静' },
    { versionId: 'TDV-SPU-2024-010-v1-2', versionNo: '正式版 v1.2', publishedAt: '2026-03-18 14:30', publishedBy: '陈静' },
  ],
  'SPU-2024-011': [
    { versionId: 'TDV-SPU-2024-011-v1-1', versionNo: '正式版 v1.1', publishedAt: '2026-03-03 09:20', publishedBy: '林晓' },
    { versionId: 'TDV-SPU-2024-011-v1-2', versionNo: '正式版 v1.2', publishedAt: '2026-03-20 16:00', publishedBy: '林晓' },
  ],
  'SPU-2024-012': [
    { versionId: 'TDV-SPU-2024-012-v1-0', versionNo: '正式版 v1.0', publishedAt: '2026-02-26 15:30', publishedBy: '周敏' },
    { versionId: 'TDV-SPU-2024-012-v2-0', versionNo: '正式版 v2.0', publishedAt: '2026-03-04 09:30', publishedBy: '周敏' },
  ],
  'SPU-2024-013': [
    { versionId: 'TDV-SPU-2024-013-v1-0', versionNo: '正式版 v1.0', publishedAt: '2026-03-06 09:00', publishedBy: '陈静' },
    { versionId: 'TDV-SPU-2024-013-v1-1', versionNo: '正式版 v1.1', publishedAt: '2026-03-21 10:10', publishedBy: '陈静' },
  ],
  'SPU-2024-014': [
    { versionId: 'TDV-SPU-2024-014-v1-0', versionNo: '正式版 v1.0', publishedAt: '2026-03-07 10:30', publishedBy: '林晓' },
    { versionId: 'TDV-SPU-2024-014-v1-1', versionNo: '正式版 v1.1', publishedAt: '2026-03-12 11:20', publishedBy: '林晓' },
    { versionId: 'TDV-SPU-2024-014-v1-2', versionNo: '正式版 v1.2', publishedAt: '2026-03-18 16:40', publishedBy: '林晓' },
    { versionId: 'TDV-SPU-2024-014-v1-3', versionNo: '正式版 v1.3', publishedAt: '2026-03-22 18:00', publishedBy: '林晓' },
  ],
}

let relations: ProductionOrderTechPackRelation[] = [
  {
    relationId: 'TPR-PO-202603-0004',
    productionOrderId: 'PO-202603-0004',
    productionOrderNo: 'PO-202603-0004',
    spuId: 'STYLE-SPU-2024-010',
    spuCode: 'SPU-2024-010',
    styleName: 'Celana Jogger Pria',
    colorCount: 3,
    sizeCount: 5,
    deliveryDate: '2026-04-20',
    buyerName: '廖敏',
    merchandiserName: '陈静',
    currentTechPackVersionId: 'TDV-SPU-2024-010-v1-0',
    currentTechPackVersionNo: '正式版 v1.0',
    frozenSnapshotId: 'TPS-20260301-0004',
    frozenAt: '2026-03-01 10:20',
    frozenBy: '系统生成',
    relationStatus: 'NEW_VERSION_UNEVALUATED',
    latestPublishedTechPackVersionId: 'TDV-SPU-2024-010-v1-2',
    latestPublishedTechPackVersionNo: '正式版 v1.2',
    latestPublishedAt: '2026-03-18 14:30',
    publishedVersionCount: 3,
    hasNewerPublishedVersion: true,
    activePatchCount: 1,
    pendingPatchCount: 2,
    historyPatchCount: 3,
    latestChangeRecordId: 'TCR-202603-0004-001',
    updatedAt: '2026-05-29 09:20',
    diffSummary: [
      { module: 'BOM', count: 2 },
      { module: 'PATTERN', count: 1 },
      { module: 'PROCESS', count: 0 },
      { module: 'DESIGN', count: 1 },
    ],
    progressSummary: ['配料：已配 60%', '领料：已领 40%', '裁片：已开工 / 已铺布 2 张', '车缝：未交出'],
    restrictionSummary: ['已生成菲票', '已交出部分裁片'],
  },
  {
    relationId: 'TPR-PO-202603-0005',
    productionOrderId: 'PO-202603-0005',
    productionOrderNo: 'PO-202603-0005',
    spuId: 'STYLE-SPU-2024-011',
    spuCode: 'SPU-2024-011',
    styleName: 'Kemeja Linen Relaxed',
    colorCount: 2,
    sizeCount: 4,
    deliveryDate: '2026-04-28',
    buyerName: '何佳',
    merchandiserName: '林晓',
    currentTechPackVersionId: 'TDV-SPU-2024-011-v1-1',
    currentTechPackVersionNo: '正式版 v1.1',
    frozenSnapshotId: 'TPS-20260303-0005',
    frozenAt: '2026-03-03 09:40',
    frozenBy: '系统生成',
    relationStatus: 'CHANGE_IN_REVIEW',
    latestPublishedTechPackVersionId: 'TDV-SPU-2024-011-v1-2',
    latestPublishedTechPackVersionNo: '正式版 v1.2',
    latestPublishedAt: '2026-03-20 16:00',
    publishedVersionCount: 2,
    hasNewerPublishedVersion: true,
    activePatchCount: 0,
    pendingPatchCount: 1,
    historyPatchCount: 1,
    latestChangeRecordId: 'TCR-202603-0005-001',
    updatedAt: '2026-05-29 10:05',
    diffSummary: [
      { module: 'PROCESS', count: 2 },
      { module: 'COLOR_MATERIAL_MAPPING', count: 1 },
      { module: 'COST', count: 1 },
    ],
    progressSummary: ['配料：已配 20%', '印花：加工中', '染色：未开始', '车缝：未交出'],
    restrictionSummary: ['印花工单已生成'],
  },
  {
    relationId: 'TPR-PO-202603-0006',
    productionOrderId: 'PO-202603-0006',
    productionOrderNo: 'PO-202603-0006',
    spuId: 'STYLE-SPU-2024-012',
    spuCode: 'SPU-2024-012',
    styleName: 'Dress Midi Pleated',
    colorCount: 4,
    sizeCount: 5,
    deliveryDate: '2026-05-05',
    buyerName: '许晴',
    merchandiserName: '周敏',
    currentTechPackVersionId: 'TDV-SPU-2024-012-v2-0',
    currentTechPackVersionNo: '正式版 v2.0',
    frozenSnapshotId: 'TPS-20260304-0006',
    frozenAt: '2026-03-04 11:15',
    frozenBy: '系统生成',
    relationStatus: 'CURRENT',
    latestPublishedTechPackVersionId: 'TDV-SPU-2024-012-v2-0',
    latestPublishedTechPackVersionNo: '正式版 v2.0',
    latestPublishedAt: '2026-03-04 09:30',
    publishedVersionCount: 2,
    hasNewerPublishedVersion: false,
    activePatchCount: 0,
    pendingPatchCount: 0,
    historyPatchCount: 0,
    latestChangeRecordId: '',
    updatedAt: '2026-05-29 08:40',
    diffSummary: [
      { module: 'BOM', count: 0 },
      { module: 'PATTERN', count: 0 },
      { module: 'DESIGN', count: 0 },
    ],
    progressSummary: ['配料：未开始', '领料：未开始', '裁片：未开始', '车缝：未交出'],
    restrictionSummary: ['无限制项'],
  },
  {
    relationId: 'TPR-PO-202603-0007',
    productionOrderId: 'PO-202603-0007',
    productionOrderNo: 'PO-202603-0007',
    spuId: 'STYLE-SPU-2024-013',
    spuCode: 'SPU-2024-013',
    styleName: 'Jaket Hoodie Unisex',
    colorCount: 3,
    sizeCount: 4,
    deliveryDate: '2026-05-12',
    buyerName: '宋雨',
    merchandiserName: '陈静',
    currentTechPackVersionId: 'TDV-SPU-2024-013-v1-0',
    currentTechPackVersionNo: '正式版 v1.0',
    frozenSnapshotId: 'TPS-20260306-0007',
    frozenAt: '2026-03-06 13:10',
    frozenBy: '系统生成',
    relationStatus: 'PATCHED',
    latestPublishedTechPackVersionId: 'TDV-SPU-2024-013-v1-1',
    latestPublishedTechPackVersionNo: '正式版 v1.1',
    latestPublishedAt: '2026-03-21 10:10',
    publishedVersionCount: 2,
    hasNewerPublishedVersion: true,
    activePatchCount: 2,
    pendingPatchCount: 0,
    historyPatchCount: 2,
    latestChangeRecordId: 'TCR-202603-0007-001',
    updatedAt: '2026-05-29 11:20',
    diffSummary: [
      { module: 'BOM', count: 1 },
      { module: 'SIZE', count: 1 },
      { module: 'COST', count: 1 },
    ],
    progressSummary: ['配料：已完成', '领料：已完成', '裁片：已裁剪', '辅助工艺：1 项待回仓'],
    restrictionSummary: ['旧物料已消耗', '已完成部分结算'],
  },
  {
    relationId: 'TPR-PO-202603-0008',
    productionOrderId: 'PO-202603-0008',
    productionOrderNo: 'PO-202603-0008',
    spuId: 'STYLE-SPU-2024-014',
    spuCode: 'SPU-2024-014',
    styleName: 'Rok Denim A-Line',
    colorCount: 2,
    sizeCount: 5,
    deliveryDate: '2026-05-18',
    buyerName: '廖敏',
    merchandiserName: '林晓',
    currentTechPackVersionId: 'TDV-SPU-2024-014-v1-0',
    currentTechPackVersionNo: '正式版 v1.0',
    frozenSnapshotId: 'TPS-20260307-0008',
    frozenAt: '2026-03-07 15:00',
    frozenBy: '系统生成',
    relationStatus: 'LOCKED',
    latestPublishedTechPackVersionId: 'TDV-SPU-2024-014-v1-3',
    latestPublishedTechPackVersionNo: '正式版 v1.3',
    latestPublishedAt: '2026-03-22 18:00',
    publishedVersionCount: 4,
    hasNewerPublishedVersion: true,
    activePatchCount: 0,
    pendingPatchCount: 0,
    historyPatchCount: 1,
    latestChangeRecordId: 'TCR-202603-0008-001',
    updatedAt: '2026-05-29 11:40',
    diffSummary: [
      { module: 'PATTERN', count: 2 },
      { module: 'SIZE', count: 1 },
      { module: 'DESIGN', count: 1 },
    ],
    progressSummary: ['配料：已完成', '领料：已完成', '菲票：已打印 24 张', '车缝：已交出 35%'],
    restrictionSummary: ['已打印菲票', '已交出车缝厂'],
  },
  {
    relationId: 'TPR-PO-202604-0018',
    productionOrderId: 'PO-202604-0018',
    productionOrderNo: 'PO-202604-0018',
    spuId: 'style_seed_project_018',
    spuCode: 'SPU-2026-018',
    styleName: '设计款印花阔腿连体裤',
    colorCount: 1,
    sizeCount: 3,
    deliveryDate: '2026-06-18',
    buyerName: '李娜',
    merchandiserName: '陈静',
    currentTechPackVersionId: 'tdv_seed_project_018_base',
    currentTechPackVersionNo: '正式版 V1.0',
    frozenSnapshotId: 'TPS-20260407-0018',
    frozenAt: '2026-04-08 09:30',
    frozenBy: '生产单创建冻结',
    relationStatus: 'CURRENT',
    latestPublishedTechPackVersionId: 'tdv_seed_project_018_base',
    latestPublishedTechPackVersionNo: '正式版 V1.0',
    latestPublishedAt: '2026-04-07 17:20',
    publishedVersionCount: 1,
    hasNewerPublishedVersion: false,
    activePatchCount: 0,
    pendingPatchCount: 0,
    historyPatchCount: 0,
    latestChangeRecordId: '',
    updatedAt: '2026-05-29 12:20',
    diffSummary: [
      { module: 'BOM', count: 0 },
      { module: 'PATTERN', count: 0 },
      { module: 'DESIGN', count: 0 },
    ],
    progressSummary: ['配料：已配 35%', '领料：已领 20%', '印花：未开始', '裁片：未开始'],
    restrictionSummary: ['已生成配料任务但未领料完成'],
  },
]

function buildTechPackDiffItemsForRelation(relation: ProductionOrderTechPackRelation): TechPackVersionDiffItem[] {
  return [
    {
      diffItemId: `DIFF-${relation.productionOrderId}-BOM-1`,
      module: 'BOM',
      changeType: '修改',
      objectName: '主面料弹力斜纹布',
      currentValue: '黑色 / 克重 280g / 用量 1.15m',
      targetValue: '炭灰色 / 克重 300g / 用量 1.18m',
      impactScope: 'Black 色 / 主面料 / 后续裁片单',
      involvedOccurredBusiness: relation.productionOrderId === 'PO-202603-0006' ? '否' : '是',
      relatedObjects: ['配料单 MR-202603-010', '领料单 MI-202603-006'],
    },
    {
      diffItemId: `DIFF-${relation.productionOrderId}-BOM-2`,
      module: 'BOM',
      changeType: '修改',
      objectName: '腰头松紧带',
      currentValue: '黑色 / 4.0cm / 用量 0.82m',
      targetValue: '黑色 / 4.5cm / 用量 0.86m',
      impactScope: 'Black 色 / 腰头部位 / 后续领料',
      involvedOccurredBusiness: relation.productionOrderId === 'PO-202603-0006' ? '否' : '是',
      relatedObjects: ['配料单 MR-202603-010', '裁片单 CUT-202603-004'],
    },
    {
      diffItemId: `DIFF-${relation.productionOrderId}-PATTERN-1`,
      module: 'PATTERN',
      changeType: '修改',
      objectName: '前片纸样文件',
      currentValue: 'front-panel-v1.dxf',
      targetValue: 'front-panel-v2.dxf',
      impactScope: 'M/L/XL 尺码前片',
      involvedOccurredBusiness: relation.relationStatus === 'LOCKED' ? '是' : '否',
      relatedObjects: ['唛架方案 MK-202603-002', '铺布单 SP-202603-003'],
    },
    {
      diffItemId: `DIFF-${relation.productionOrderId}-DESIGN-1`,
      module: 'DESIGN',
      changeType: '新增',
      objectName: '左腿小标花型',
      currentValue: '无',
      targetValue: 'artwork-left-leg-v3.png',
      impactScope: 'Navy / Black 两色印花工单',
      involvedOccurredBusiness: '否',
      relatedObjects: ['印花工单 PR-202603-004'],
    },
  ].filter((item) =>
    relation.diffSummary.some(
      (summary) =>
        summary.module === item.module &&
        summary.count > 0 &&
        (!item.diffItemId.endsWith('-BOM-2') || summary.count > 1),
    ),
  )
}

let diffSnapshots: TechPackVersionDiffSnapshot[] = relations.map((relation) => ({
  diffSnapshotId: `DIFF-${relation.productionOrderId}`,
  productionOrderId: relation.productionOrderId,
  fromTechPackVersionNo: relation.currentTechPackVersionNo,
  toTechPackVersionNo: relation.latestPublishedTechPackVersionNo,
  items: buildTechPackDiffItemsForRelation(relation),
}))

let progressSnapshots: ProductionProgressSnapshot[] = relations.map((relation) => ({
  progressSnapshotId: `PROG-${relation.productionOrderId}`,
  productionOrderId: relation.productionOrderId,
  updatedAt: relation.updatedAt,
  sections: [
    {
      sectionId: 'material',
      sectionName: '配料 / 领料',
      statusText: relation.progressSummary[0] ?? '未开始',
      rows: [
        { label: '配料任务数', value: relation.productionOrderId === 'PO-202603-0006' ? '0 个' : '4 个' },
        { label: '已配数量', value: relation.productionOrderId === 'PO-202603-0006' ? '0 米' : '2,460 米', highlight: relation.hasNewerPublishedVersion },
        { label: '已领数量', value: relation.progressSummary.find((item) => item.includes('领料'))?.replace('领料：', '') ?? '未开始' },
        { label: '相关仓库', value: '面料仓 / 辅料仓 / 中转仓' },
      ],
    },
    {
      sectionId: 'printing',
      sectionName: '印花',
      statusText: relation.progressSummary.find((item) => item.includes('印花')) ?? '未开始',
      rows: [
        { label: '印花需求', value: relation.diffSummary.some((item) => item.module === 'DESIGN') ? '由技术包花型生成' : '无' },
        { label: '印花工单数', value: relation.productionOrderId === 'PO-202603-0005' ? '2 张' : '1 张' },
        { label: '花型版本', value: 'artwork-v1 / 后续可覆盖为 artwork-v3' },
        { label: '是否已使用旧版本花型', value: relation.productionOrderId === 'PO-202603-0004' ? '是' : '否' },
      ],
    },
    {
      sectionId: 'dyeing',
      sectionName: '染色',
      statusText: relation.progressSummary.find((item) => item.includes('染色')) ?? '未开始',
      rows: [
        { label: '染色需求', value: relation.productionOrderId === 'PO-202603-0005' ? '面料改色' : '无' },
        { label: '染色工单数', value: relation.productionOrderId === 'PO-202603-0005' ? '1 张' : '0 张' },
        { label: '染色交出状态', value: relation.productionOrderId === 'PO-202603-0005' ? '加工中' : '未交出' },
        { label: '下游对象', value: relation.productionOrderId === 'PO-202603-0005' ? '中转仓 / 裁床' : '无' },
      ],
    },
    {
      sectionId: 'cutting',
      sectionName: '裁片 / 唛架 / 铺布 / 菲票',
      statusText: relation.progressSummary.find((item) => item.includes('裁片')) ?? '未开始',
      rows: [
        { label: '裁片单数', value: relation.relationStatus === 'CURRENT' ? '0 张' : '3 张' },
        { label: '唛架方案数', value: relation.relationStatus === 'CURRENT' ? '0 张' : '草稿 1 / 已确认 1' },
        { label: '铺布单数', value: relation.restrictionSummary.some((item) => item.includes('菲票')) ? '已铺布 3 张' : '已铺布 1 张' },
        { label: '菲票数', value: relation.restrictionSummary.some((item) => item.includes('菲票')) ? '已打印 24 张' : '待首打' },
      ],
    },
    {
      sectionId: 'sewing',
      sectionName: '车缝',
      statusText: relation.progressSummary.find((item) => item.includes('车缝')) ?? '未交出',
      rows: [
        { label: '车缝任务数', value: '2 个' },
        { label: '已交出数量', value: relation.relationStatus === 'LOCKED' ? '35%' : '0%' },
        { label: '接收回写', value: relation.relationStatus === 'LOCKED' ? '部分回写' : '待回写' },
        { label: '交出后缺口', value: relation.relationStatus === 'LOCKED' ? 'M/L 尺码仍缺 120 件' : '无' },
      ],
    },
    {
      sectionId: 'aux-process',
      sectionName: '辅助工艺',
      statusText: relation.progressSummary.find((item) => item.includes('辅助工艺')) ?? '无',
      rows: [
        { label: '工艺类型', value: '压褶 / 模板工序' },
        { label: '承接工厂', value: '越华后整厂' },
        { label: '交出状态', value: relation.productionOrderId === 'PO-202603-0007' ? '已交出' : '未交出' },
        { label: '是否影响车缝', value: '仅影响对应部位' },
      ],
    },
    {
      sectionId: 'special-process',
      sectionName: '特种工艺',
      statusText: relation.productionOrderId === 'PO-202603-0007' ? '绣花待回仓' : '无',
      rows: [
        { label: '工艺类型', value: relation.productionOrderId === 'PO-202603-0007' ? '绣花' : '无' },
        { label: '承接工厂', value: relation.productionOrderId === 'PO-202603-0007' ? '盛达绣花厂' : '无' },
        { label: '回仓状态', value: relation.productionOrderId === 'PO-202603-0007' ? '部分回仓' : '无' },
        { label: '影响范围', value: relation.productionOrderId === 'PO-202603-0007' ? '左腿小标部位' : '无' },
      ],
    },
    {
      sectionId: 'settlement',
      sectionName: '库存 / 交出 / 结算',
      statusText: relation.restrictionSummary.some((item) => item.includes('结算')) ? '部分进入结算' : '未结算',
      rows: [
        { label: '待交出仓库存', value: relation.relationStatus === 'LOCKED' ? '780 件' : '0 件' },
        { label: '接收回写', value: relation.relationStatus === 'LOCKED' ? '部分回写' : '待回写' },
        { label: '结算状态', value: relation.restrictionSummary.some((item) => item.includes('结算')) ? '部分结算' : '未结算' },
      ],
    },
  ],
}))

let restrictionSnapshots: ChangeRestrictionSnapshot[] = relations.map((relation) => ({
  restrictionSnapshotId: `REST-${relation.productionOrderId}`,
  productionOrderId: relation.productionOrderId,
  judgementText: relation.relationStatus === 'LOCKED' ? '不可提交版本关系变更' : relation.relationStatus === 'CURRENT' ? '可以提交' : '仅影响未开始对象',
  items: relation.restrictionSummary.includes('无限制项')
    ? []
    : relation.restrictionSummary.map((summary, index) => ({
        restrictionId: `REST-${relation.productionOrderId}-${index + 1}`,
        restrictionType: summary,
        affectedModule: summary.includes('菲票') || summary.includes('裁片') ? 'PATTERN' : summary.includes('结算') ? 'COST' : 'BOM',
        affectedObject: summary.includes('菲票') ? '菲票打印记录' : summary.includes('结算') ? '结算明细' : '生产执行对象',
        reason: '已经发生的业务事实不能被新技术包版本覆盖。',
        blockVersionChange: relation.relationStatus === 'LOCKED' || summary.includes('菲票') || summary.includes('结算'),
        allowPatch: !summary.includes('菲票') || relation.relationStatus !== 'LOCKED',
        relatedDocs: [`DOC-${relation.productionOrderId}-${String(index + 1).padStart(2, '0')}`],
      })),
}))

let changeRequests: ProductionOrderTechPackChangeRequest[] = [
  {
    changeRequestId: 'TCR-202603-0005-001',
    changeRequestNo: 'TCR-202603-0005-001',
    productionOrderId: 'PO-202603-0005',
    productionOrderNo: 'PO-202603-0005',
    spuId: 'STYLE-SPU-2024-011',
    fromTechPackVersionId: 'TDV-SPU-2024-011-v1-1',
    fromTechPackVersionNo: '正式版 v1.1',
    toTechPackVersionId: 'TDV-SPU-2024-011-v1-2',
    toTechPackVersionNo: '正式版 v1.2',
    diffSnapshotId: 'DIFF-PO-202603-0005',
    progressSnapshotId: 'PROG-PO-202603-0005',
    restrictionSnapshotId: 'REST-PO-202603-0005',
    changeScope: '仅未开始对象',
    effectiveMode: 'FROM_NEXT_PROCESS_ORDER',
    status: 'UNDER_REVIEW',
    submitReason: '后续印花工单需要改用新花型参数。',
    submittedBy: '林晓',
    submittedAt: '2026-05-29 10:05',
    approvedBy: '',
    approvedAt: '',
    rejectedReason: '',
    effectiveAt: '',
    notifyBatchId: 'NTB-202603-0005-001',
    createdAt: '2026-05-29 10:05',
  },
  {
    changeRequestId: 'TCR-202603-0008-001',
    changeRequestNo: 'TCR-202603-0008-001',
    productionOrderId: 'PO-202603-0008',
    productionOrderNo: 'PO-202603-0008',
    spuId: 'STYLE-SPU-2024-014',
    fromTechPackVersionId: 'TDV-SPU-2024-014-v1-0',
    fromTechPackVersionNo: '正式版 v1.0',
    toTechPackVersionId: 'TDV-SPU-2024-014-v1-3',
    toTechPackVersionNo: '正式版 v1.3',
    diffSnapshotId: 'DIFF-PO-202603-0008',
    progressSnapshotId: 'PROG-PO-202603-0008',
    restrictionSnapshotId: 'REST-PO-202603-0008',
    changeScope: '生产单后续全部环节',
    effectiveMode: 'IMMEDIATE_AFTER_APPROVAL',
    status: 'REJECTED',
    submitReason: '纸样和花型整体更新。',
    submittedBy: '林晓',
    submittedAt: '2026-05-27 09:30',
    approvedBy: '',
    approvedAt: '',
    rejectedReason: '已打印菲票并交出车缝厂，不能全量切换。',
    effectiveAt: '',
    notifyBatchId: 'NTB-202603-0008-001',
    createdAt: '2026-05-27 09:30',
  },
]

let patches: ProductionOrderPatch[] = [
  {
    patchId: 'PATCH-PO-202603-0004-001',
    patchNo: 'PATCH-PO-202603-0004-001',
    productionOrderId: 'PO-202603-0004',
    productionOrderNo: 'PO-202603-0004',
    baseTechPackVersionId: 'TDV-SPU-2024-010-v1-0',
    baseTechPackVersionNo: '正式版 v1.0',
    patchType: 'MATERIAL_REPLACEMENT',
    affectedModule: 'BOM',
    patchScope: 'Black 色 / 主面料 / 后续裁片单',
    effectivePoint: 'FROM_NEXT_PICKUP',
    patchContent: '原黑色弹力斜纹布替换为炭灰色弹力斜纹布。',
    reason: '原面料不再到货，业务确认使用替代面料完成后续生产。',
    status: 'EFFECTIVE',
    submittedBy: '陈静',
    submittedAt: '2026-05-29 09:10',
    approvedBy: '生产主管',
    approvedAt: '2026-05-29 09:40',
    effectiveAt: '2026-05-29 10:00',
    expiredAt: '',
    linkedObjects: ['领料单 MI-202603-006', '裁片单 CUT-202603-004'],
    notifyBatchId: 'NTB-PATCH-0004-001',
    createdAt: '2026-05-29 09:10',
  },
  {
    patchId: 'PATCH-PO-202603-0004-002',
    patchNo: 'PATCH-PO-202603-0004-002',
    productionOrderId: 'PO-202603-0004',
    productionOrderNo: 'PO-202603-0004',
    baseTechPackVersionId: 'TDV-SPU-2024-010-v1-0',
    baseTechPackVersionNo: '正式版 v1.0',
    patchType: 'PATTERN_OVERRIDE',
    affectedModule: 'PATTERN',
    patchScope: 'M / L 尺码前片',
    effectivePoint: 'FROM_NEXT_MARKER_PLAN',
    patchContent: '后续唛架方案使用 front-panel-v2.dxf。',
    reason: '版师确认前片纸样需要修正后再排唛架。',
    status: 'UNDER_REVIEW',
    submittedBy: '陈静',
    submittedAt: '2026-05-29 09:50',
    approvedBy: '',
    approvedAt: '',
    effectiveAt: '',
    expiredAt: '',
    linkedObjects: ['唛架方案 MK-202603-004'],
    notifyBatchId: 'NTB-PATCH-0004-002',
    createdAt: '2026-05-29 09:50',
  },
  {
    patchId: 'PATCH-PO-202603-0007-001',
    patchNo: 'PATCH-PO-202603-0007-001',
    productionOrderId: 'PO-202603-0007',
    productionOrderNo: 'PO-202603-0007',
    baseTechPackVersionId: 'TDV-SPU-2024-013-v1-0',
    baseTechPackVersionNo: '正式版 v1.0',
    patchType: 'COSTING_OVERRIDE',
    affectedModule: 'COST',
    patchScope: '后续辅助工艺结算',
    effectivePoint: 'SETTLEMENT_ONLY',
    patchContent: '绣花加工费从 0.18 元 / 件调整为 0.22 元 / 件。',
    reason: '后续绣花参数增加，外协工厂重新报价。',
    status: 'EFFECTIVE',
    submittedBy: '周敏',
    submittedAt: '2026-05-28 16:00',
    approvedBy: '财务主管',
    approvedAt: '2026-05-28 17:10',
    effectiveAt: '2026-05-28 17:30',
    expiredAt: '',
    linkedObjects: ['结算口径 SET-202603-007'],
    notifyBatchId: 'NTB-PATCH-0007-001',
    createdAt: '2026-05-28 16:00',
  },
  {
    patchId: 'PATCH-PO-202603-0007-002',
    patchNo: 'PATCH-PO-202603-0007-002',
    productionOrderId: 'PO-202603-0007',
    productionOrderNo: 'PO-202603-0007',
    baseTechPackVersionId: 'TDV-SPU-2024-013-v1-0',
    baseTechPackVersionNo: '正式版 v1.0',
    patchType: 'PROCESS_OVERRIDE',
    affectedModule: 'PROCESS',
    patchScope: '后续辅助工艺 / 绣花节点',
    effectivePoint: 'FROM_NEXT_AUX_PROCESS',
    patchContent: '绣花承接工厂由 A 厂调整为 B 厂。',
    reason: 'A 厂排期满，后续批次改由 B 厂承接。',
    status: 'EFFECTIVE',
    submittedBy: '周敏',
    submittedAt: '2026-05-28 15:20',
    approvedBy: '生产主管',
    approvedAt: '2026-05-28 15:50',
    effectiveAt: '2026-05-28 16:10',
    expiredAt: '',
    linkedObjects: ['辅助工艺单 AUX-202603-007'],
    notifyBatchId: 'NTB-PATCH-0007-002',
    createdAt: '2026-05-28 15:20',
  },
]

let notices: ProductionChangeFeishuNotice[] = [
  {
    noticeId: 'NT-TP-0004-001',
    notifyBatchId: 'NTB-PATCH-0004-001',
    productionOrderId: 'PO-202603-0004',
    triggerEvent: '生产单补丁已生效',
    receiverName: '陈静',
    receiverRole: '跟单负责人',
    module: 'COMMON',
    sendStatus: '已发送',
    sentAt: '2026-05-29 10:01',
    messageId: 'om_patch_0004_001',
  },
  {
    noticeId: 'NT-TP-0004-002',
    notifyBatchId: 'NTB-PATCH-0004-001',
    productionOrderId: 'PO-202603-0004',
    triggerEvent: '生产单补丁已生效',
    receiverName: '中转仓主管',
    receiverRole: '仓库责任人',
    module: 'BOM',
    sendStatus: '已发送',
    sentAt: '2026-05-29 10:01',
    messageId: 'om_patch_0004_002',
  },
  {
    noticeId: 'NT-TP-0005-001',
    notifyBatchId: 'NTB-202603-0005-001',
    productionOrderId: 'PO-202603-0005',
    triggerEvent: '版本关系变更申请已提交',
    receiverName: '生产主管',
    receiverRole: '审核人',
    module: 'PROCESS',
    sendStatus: '已发送',
    sentAt: '2026-05-29 10:06',
    messageId: 'om_change_0005_001',
  },
]

let operationLogs: ProductionChangeOperationLog[] = [
  {
    logId: 'LOG-TP-0004-001',
    productionOrderId: 'PO-202603-0004',
    operatedAt: '2026-05-29 09:10',
    operatorName: '陈静',
    operationType: '提交生产单补丁',
    operationObject: 'PATCH-PO-202603-0004-001',
    beforeText: '无生产单级覆盖',
    afterText: '新增物料替代补丁',
    remark: '面料短缺，后续领料改用替代物料。',
  },
  {
    logId: 'LOG-TP-0005-001',
    productionOrderId: 'PO-202603-0005',
    operatedAt: '2026-05-29 10:05',
    operatorName: '林晓',
    operationType: '提交版本关系变更',
    operationObject: 'TCR-202603-0005-001',
    beforeText: '正式版 v1.1',
    afterText: '正式版 v1.2',
    remark: '从下一张工艺单开始使用新版本。',
  },
  {
    logId: 'LOG-TP-0008-001',
    productionOrderId: 'PO-202603-0008',
    operatedAt: '2026-05-27 10:20',
    operatorName: '生产主管',
    operationType: '拒绝版本关系变更',
    operationObject: 'TCR-202603-0008-001',
    beforeText: '审核中',
    afterText: '已拒绝',
    remark: '已打印菲票并交出车缝厂。',
  },
]

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function nowText(): string {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`
}

const PUBLISH_EVALUATION_STORAGE_KEY = 'higood-fcs-production-tech-pack-publish-evaluations-v1'

let publishEvaluationMemory: ProductionTechPackPublishEvaluationBatch[] | null = null

function canUseStorage(): boolean {
  return (
    typeof localStorage !== 'undefined' &&
    typeof localStorage.getItem === 'function' &&
    typeof localStorage.setItem === 'function'
  )
}

function normalizeDiffModules(modules: TechPackChangeModule[] | undefined): TechPackChangeModule[] {
  const fallback: TechPackChangeModule[] = ['BOM', 'PATTERN', 'DESIGN']
  const source = Array.isArray(modules) && modules.length > 0 ? modules : fallback
  return source.filter((module, index, items) => items.indexOf(module) === index)
}

function normalizePublishEvaluationBatch(
  batch: Partial<ProductionTechPackPublishEvaluationBatch>,
): ProductionTechPackPublishEvaluationBatch {
  const createdAt = batch.createdAt || batch.publishedAt || nowText()
  const status: ProductionTechPackPublishEvaluationStatus =
    batch.status === '已生成待办' ||
    batch.status === '已记录不处理' ||
    batch.status === '已进入生产单变更'
      ? batch.status
      : '待评估'
  return {
    batchId: batch.batchId || `PEB-${String(batch.technicalVersionId || createdAt).replace(/[^a-zA-Z0-9_-]/g, '-')}`,
    technicalVersionId: batch.technicalVersionId || '',
    technicalVersionCode: batch.technicalVersionCode || '',
    versionLabel: batch.versionLabel || '',
    styleId: batch.styleId || '',
    spuCode: batch.spuCode || '',
    styleName: batch.styleName || '',
    publishedAt: batch.publishedAt || createdAt,
    publishedBy: batch.publishedBy || '当前用户',
    diffModules: normalizeDiffModules(batch.diffModules),
    affectedOrders: Array.isArray(batch.affectedOrders)
      ? batch.affectedOrders.map((item) => ({
          productionOrderId: item.productionOrderId || '',
          productionOrderNo: item.productionOrderNo || '',
          currentTechPackVersionId: item.currentTechPackVersionId || '',
          currentTechPackVersionNo: item.currentTechPackVersionNo || '',
          latestPublishedTechPackVersionId: item.latestPublishedTechPackVersionId || batch.technicalVersionId || '',
          latestPublishedTechPackVersionNo:
            item.latestPublishedTechPackVersionNo || `正式版 ${batch.versionLabel || ''}`.trim(),
          progressSummary: Array.isArray(item.progressSummary) ? [...item.progressSummary] : [],
          patchSummary: item.patchSummary || '生效中 0 / 待审核 0',
          evaluationStatus: item.evaluationStatus || status,
        }))
      : [],
    status,
    ignoreReason: batch.ignoreReason || '',
    createdAt,
    updatedAt: batch.updatedAt || createdAt,
  }
}

function loadPublishEvaluationBatches(): ProductionTechPackPublishEvaluationBatch[] {
  if (publishEvaluationMemory) return clone(publishEvaluationMemory)
  if (!canUseStorage()) {
    publishEvaluationMemory = []
    return []
  }

  try {
    const raw = localStorage.getItem(PUBLISH_EVALUATION_STORAGE_KEY)
    if (!raw) {
      publishEvaluationMemory = []
      return []
    }
    const parsed = JSON.parse(raw) as unknown
    publishEvaluationMemory = Array.isArray(parsed)
      ? parsed.map((item) => normalizePublishEvaluationBatch(item as Partial<ProductionTechPackPublishEvaluationBatch>))
      : []
    localStorage.setItem(PUBLISH_EVALUATION_STORAGE_KEY, JSON.stringify(publishEvaluationMemory))
    return clone(publishEvaluationMemory)
  } catch {
    publishEvaluationMemory = []
    return []
  }
}

function persistPublishEvaluationBatches(batches: ProductionTechPackPublishEvaluationBatch[]): void {
  publishEvaluationMemory = batches.map(normalizePublishEvaluationBatch)
  if (canUseStorage()) {
    localStorage.setItem(PUBLISH_EVALUATION_STORAGE_KEY, JSON.stringify(publishEvaluationMemory))
  }
}

function nextSequence(prefix: string, items: Array<{ [key: string]: string }>, idKey: string): string {
  const max = items.reduce((value, item) => {
    const id = item[idKey] || ''
    if (!id.startsWith(prefix)) return value
    const tail = Number(id.slice(prefix.length).replace(/[^0-9]/g, ''))
    return Number.isFinite(tail) ? Math.max(value, tail) : value
  }, 0)
  return `${prefix}${String(max + 1).padStart(3, '0')}`
}

function getVersionOptionsForRelation(relation: ProductionOrderTechPackRelation): TechPackVersionOption[] {
  const configured = publishedTechPackVersionOptionsBySpu[relation.spuCode] ?? []
  const runtimeOptions: TechPackVersionOption[] = [
    {
      versionId: relation.currentTechPackVersionId,
      versionNo: relation.currentTechPackVersionNo,
      publishedAt: relation.frozenAt,
      publishedBy: relation.frozenBy,
    },
    {
      versionId: relation.latestPublishedTechPackVersionId,
      versionNo: relation.latestPublishedTechPackVersionNo,
      publishedAt: relation.latestPublishedAt,
      publishedBy: relation.merchandiserName,
    },
  ]
  return [...configured, ...runtimeOptions].filter(
    (item, index, options) => options.findIndex((option) => option.versionId === item.versionId) === index,
  )
}

function resolveTargetVersion(
  relation: ProductionOrderTechPackRelation,
  targetVersionId: string,
): TechPackVersionOption | null {
  const options = getVersionOptionsForRelation(relation)
  if (targetVersionId === 'LATEST') {
    return options.find((item) => item.versionId === relation.latestPublishedTechPackVersionId) ?? null
  }
  return options.find((item) => item.versionId === targetVersionId) ?? null
}

function formatPublishedVersionNo(versionLabel: string, technicalVersionCode: string): string {
  const label = versionLabel.trim()
  if (label) return `正式版 ${label}`
  return technicalVersionCode || '正式版'
}

function getEvaluationDiffSummary(modules: TechPackChangeModule[]): Array<{ module: TechPackChangeModule; count: number }> {
  return normalizeDiffModules(modules).map((module) => ({
    module,
    count: module === 'BOM' ? 2 : 1,
  }))
}

function getEvaluationBatchesByOrder(productionOrderId: string): ProductionTechPackPublishEvaluationBatch[] {
  return loadPublishEvaluationBatches().filter((batch) =>
    batch.affectedOrders.some((item) => item.productionOrderId === productionOrderId),
  )
}

function buildRelationFromEvaluation(
  batch: ProductionTechPackPublishEvaluationBatch,
  affectedOrder: ProductionTechPackPublishEvaluationAffectedOrder,
): ProductionOrderTechPackRelation | null {
  const base = relations.find((item) => item.productionOrderId === affectedOrder.productionOrderId)
  if (!base) return null

  const ignored = batch.status === '已记录不处理'
  return {
    ...base,
    relationStatus: ignored ? 'CURRENT' : 'NEW_VERSION_UNEVALUATED',
    latestPublishedTechPackVersionId: batch.technicalVersionId,
    latestPublishedTechPackVersionNo: affectedOrder.latestPublishedTechPackVersionNo,
    latestPublishedAt: batch.publishedAt,
    publishedVersionCount: Math.max(base.publishedVersionCount + 1, 2),
    hasNewerPublishedVersion: !ignored,
    activePatchCount: base.activePatchCount,
    pendingPatchCount: base.pendingPatchCount,
    historyPatchCount: base.historyPatchCount,
    updatedAt: batch.updatedAt,
    diffSummary: ignored ? base.diffSummary.map((item) => ({ ...item, count: 0 })) : getEvaluationDiffSummary(batch.diffModules),
    progressSummary: affectedOrder.progressSummary.length > 0 ? affectedOrder.progressSummary : base.progressSummary,
  }
}

function getEvaluationRelations(): ProductionOrderTechPackRelation[] {
  return loadPublishEvaluationBatches()
    .flatMap((batch) =>
      batch.affectedOrders
        .map((affectedOrder) => buildRelationFromEvaluation(batch, affectedOrder))
        .filter((item): item is ProductionOrderTechPackRelation => Boolean(item)),
    )
}

function getRelationsWithEvaluations(): ProductionOrderTechPackRelation[] {
  const byOrder = new Map<string, ProductionOrderTechPackRelation>()
  relations.forEach((relation) => byOrder.set(relation.productionOrderId, relation))
  getEvaluationRelations().forEach((relation) => byOrder.set(relation.productionOrderId, relation))
  return [...byOrder.values()]
}

function getRelationWithEvaluation(productionOrderId: string): ProductionOrderTechPackRelation | null {
  return getRelationsWithEvaluations().find((item) => item.productionOrderId === productionOrderId) ?? null
}

function ensureMutableRelationWithEvaluation(productionOrderId: string): ProductionOrderTechPackRelation | null {
  const base = relations.find((item) => item.productionOrderId === productionOrderId)
  const evaluated = getRelationWithEvaluation(productionOrderId)
  if (!base || !evaluated) return base ?? null
  Object.assign(base, evaluated)
  return base
}

function buildPublishEvaluationNoticeRows(productionOrderId: string): ProductionChangeFeishuNotice[] {
  return getEvaluationBatchesByOrder(productionOrderId).flatMap((batch) =>
    batch.status === '已记录不处理'
      ? []
      : [
          {
            noticeId: `NT-${batch.batchId}-${productionOrderId}-ASSESS`,
            notifyBatchId: `NTB-${batch.batchId}`,
            productionOrderId,
            triggerEvent: '新正式技术包发布需评估',
            receiverName: '跟单负责人 / 模块责任人',
            receiverRole: '生产单变更评估',
            module: 'COMMON',
            sendStatus: '已发送',
            sentAt: batch.createdAt,
            messageId: `om_${batch.batchId.toLowerCase()}_${productionOrderId.toLowerCase()}`,
          },
        ],
  )
}

function buildPublishEvaluationLogRows(productionOrderId: string): ProductionChangeOperationLog[] {
  return getEvaluationBatchesByOrder(productionOrderId).flatMap((batch) => {
    const affectedOrder = batch.affectedOrders.find((item) => item.productionOrderId === productionOrderId)
    const rows: ProductionChangeOperationLog[] = [
      {
        logId: `LOG-${batch.batchId}-${productionOrderId}-CREATED`,
        productionOrderId,
        operatedAt: batch.createdAt,
        operatorName: batch.publishedBy,
        operationType: '技术包发布生成评估批次',
        operationObject: batch.batchId,
        beforeText: affectedOrder?.currentTechPackVersionNo || '-',
        afterText: affectedOrder?.latestPublishedTechPackVersionNo || batch.versionLabel,
        remark: `新正式技术包 ${batch.technicalVersionCode} 发布，生产单需要评估版本关系或生产补丁。`,
      },
    ]
    if (batch.status === '已生成待办') {
      rows.push({
        logId: `LOG-${batch.batchId}-${productionOrderId}-TODO`,
        productionOrderId,
        operatedAt: batch.updatedAt,
        operatorName: batch.publishedBy,
        operationType: '生成生产单评估待办',
        operationObject: batch.batchId,
        beforeText: '待评估',
        afterText: '已生成待办',
        remark: '已为该生产单生成版本关系评估待办。',
      })
    }
    if (batch.status === '已记录不处理') {
      rows.push({
        logId: `LOG-${batch.batchId}-${productionOrderId}-IGNORE`,
        productionOrderId,
        operatedAt: batch.updatedAt,
        operatorName: batch.publishedBy,
        operationType: '记录发布评估不处理',
        operationObject: batch.batchId,
        beforeText: '待评估',
        afterText: '已记录不处理',
        remark: batch.ignoreReason || '未填写原因',
      })
    }
    if (batch.status === '已进入生产单变更') {
      rows.push({
        logId: `LOG-${batch.batchId}-${productionOrderId}-ENTERED`,
        productionOrderId,
        operatedAt: batch.updatedAt,
        operatorName: batch.publishedBy,
        operationType: '进入生产单变更',
        operationObject: batch.batchId,
        beforeText: '待评估',
        afterText: '已进入生产单变更',
        remark: '已从发布引导进入生产单变更工作台继续判断。',
      })
    }
    return rows
  })
}

export function listProductionOrderChangeScenarioCatalog(): ProductionOrderChangeScenario[] {
  return clone(productionOrderChangeScenarioCatalog)
}

export function listProductionOrderChangeOrders(): ProductionOrderChangeOrder[] {
  return clone(productionOrderChangeOrders)
}

export function getProductionOrderChangeOrder(changeOrderId: string): ProductionOrderChangeOrder | null {
  const order = productionOrderChangeOrders.find((item) => item.id === changeOrderId)
  return order ? clone(order) : null
}

export function listProductionOrderChangeOrdersByProductionOrder(
  productionOrderId: string,
): ProductionOrderChangeOrder[] {
  return clone(productionOrderChangeOrders.filter((item) => item.productionOrderId === productionOrderId))
}

export function listProductionOrderChangeImpactRows(changeOrderId?: string): ProductionOrderChangeImpactRow[] {
  const rows = changeOrderId
    ? productionOrderChangeImpactRows.filter((row) => row.changeOrderId === changeOrderId)
    : productionOrderChangeImpactRows
  return clone(rows)
}

export function listProductionOrderChangeDocumentActions(
  changeOrderId?: string,
): ProductionOrderChangeDocumentAction[] {
  const rows = changeOrderId
    ? productionOrderChangeDocumentActions.filter((row) => row.changeOrderId === changeOrderId)
    : productionOrderChangeDocumentActions
  return clone(rows)
}

export function listProductionOrderChangeCostImpacts(changeOrderId?: string): ProductionOrderChangeCostImpact[] {
  const rows = changeOrderId
    ? productionOrderChangeCostImpacts.filter((row) => row.changeOrderId === changeOrderId)
    : productionOrderChangeCostImpacts
  return clone(rows)
}

export function listProductionOrderChangeTimingImpacts(changeOrderId?: string): ProductionOrderChangeTimingImpact[] {
  const rows = changeOrderId
    ? productionOrderChangeTimingImpacts.filter((row) => row.changeOrderId === changeOrderId)
    : productionOrderChangeTimingImpacts
  return clone(rows)
}

function buildSubmittedChangeOrderDocumentActions(
  order: ProductionOrderChangeOrder,
): ProductionOrderChangeDocumentAction[] {
  const scenario = productionOrderChangeScenarioCatalog.find((item) => item.id === order.scenarioId)
  const documents = scenario?.mainAffectedDocuments.length
    ? scenario.mainAffectedDocuments
    : getScenarioDocuments(order.reason, order.changeResult)

  return documents.map((documentType, index) =>
    buildProductionOrderChangeDocumentAction(
      order,
      documentType,
      productionOrderChangeDocumentActions.length + index,
    ),
  )
}

function appendSubmittedChangeOrderChildren(order: ProductionOrderChangeOrder): void {
  if (order.changeResult !== 'COST_ONLY' && order.changeResult !== 'RECORD_ONLY') {
    productionOrderChangeImpactRows = [
      ...productionOrderChangeImpactRows,
      buildProductionOrderChangeImpactRow(order, productionOrderChangeImpactRows.length, 0),
    ]
  }

  productionOrderChangeDocumentActions = [
    ...productionOrderChangeDocumentActions,
    ...buildSubmittedChangeOrderDocumentActions(order),
  ]

  if (order.changeResult === 'COST_ONLY' || order.costDeltaAmount !== 0) {
    const index = productionOrderChangeCostImpacts.length
    const costType: ProductionOrderChangeCostType = order.changeModules.includes('COST') ? 'FEE' : 'MATERIAL'
    const estimatedAmount = Math.abs(order.costDeltaAmount) + 600
    productionOrderChangeCostImpacts = [
      ...productionOrderChangeCostImpacts,
      {
        id: `COST-IMPACT-${String(index + 1).padStart(3, '0')}`,
        changeOrderId: order.id,
        costType,
        itemName: productionOrderChangeCostItemNames[costType][index % productionOrderChangeCostItemNames[costType].length],
        estimatedAmount,
        actualAmount: estimatedAmount,
        responsibleParty: costType === 'MATERIAL' ? '物料计划 / 供应商' : '财务结算 / 买手',
        settlementHandling: '进入本次结算补差，需保留变更单和主管确认记录。',
      },
    ]
  }

  if (order.changeResult !== 'COST_ONLY' && order.changeResult !== 'RECORD_ONLY') {
    const scenario = requireProductionOrderChangeScenario(order.scenarioId)
    const timingNode = scenario.timingNodes[0] ?? 'MATERIAL_PREPARATION'
    productionOrderChangeTimingImpacts = [
      ...productionOrderChangeTimingImpacts,
      {
        id: `TIME-IMPACT-${String(productionOrderChangeTimingImpacts.length + 1).padStart(3, '0')}`,
        changeOrderId: order.id,
        timingNode,
        originalTime: order.createdAt,
        newEstimatedTime: order.createdAt,
        delayDays: order.delayDays,
        affectsProductionDelivery: order.delayDays > 0,
        affectsFulfillmentDelivery: timingNode === 'SHIPPING' || order.delayDays >= 2,
        responsibleParty: timingNode === 'SHIPPING' ? '履约计划' : '生产计划',
        recoveryAction:
          order.executionStrategy === 'IMMEDIATE_STOP_LOSS'
            ? '先锁定影响范围，追回未完成批次，主管确认后释放。'
            : '优先处理未开工范围，已完成部分保留追溯记录。',
      },
    ]
  }
}

function removeChangeOrderChildren(changeOrderId: string): void {
  productionOrderChangeImpactRows = productionOrderChangeImpactRows.filter((row) => row.changeOrderId !== changeOrderId)
  productionOrderChangeDocumentActions = productionOrderChangeDocumentActions.filter((row) => row.changeOrderId !== changeOrderId)
  productionOrderChangeCostImpacts = productionOrderChangeCostImpacts.filter((row) => row.changeOrderId !== changeOrderId)
  productionOrderChangeTimingImpacts = productionOrderChangeTimingImpacts.filter((row) => row.changeOrderId !== changeOrderId)
}

function replaceSubmittedChangeOrderChildren(order: ProductionOrderChangeOrder): void {
  removeChangeOrderChildren(order.id)
  appendSubmittedChangeOrderChildren(order)
}

function nextProductionOrderChangeOrderId(productionOrderId: string): string {
  const prefix = `CHANGE-${productionOrderId}-`
  const maxSequence = productionOrderChangeOrders
    .filter((order) => order.productionOrderId === productionOrderId && order.id.startsWith(prefix))
    .reduce((max, order) => {
      const suffix = order.id.slice(prefix.length)
      return /^\d{3}$/.test(suffix) ? Math.max(max, Number(suffix)) : max
    }, 0)
  return `${prefix}${String(maxSequence + 1).padStart(3, '0')}`
}

export function inferProductionOrderChangeResult(input: {
  source: ProductionOrderChangeSource
  changeModules: TechPackChangeModule[]
  expectedEffectiveMode: ChangeEffectiveMode
}): ProductionOrderChangeResult {
  if (
    input.source === 'COST_EXCEPTION' ||
    (input.changeModules.length > 0 && input.changeModules.every((module) => module === 'COST'))
  ) {
    return 'COST_ONLY'
  }
  if (input.expectedEffectiveMode === 'FROM_NEXT_PROCESS_ORDER') return 'RECORD_ONLY'
  if (input.source === 'TECH_PACK_NEW_VERSION' && input.expectedEffectiveMode === 'IMMEDIATE_AFTER_APPROVAL') {
    return 'VERSION_RELATION'
  }
  if (input.source === 'TECH_PACK_NEW_VERSION') return 'VERSION_AND_PATCH'
  return 'PRODUCTION_PATCH'
}

export function previewProductionOrderChangeOrder(
  input: ProductionOrderChangePreviewInput,
): ProductionOrderChangePreview {
  const relation = getRelationWithEvaluation(input.productionOrderId)
  if (!relation) throw new Error('未找到生产单技术包版本关系。')

  const changeResult = inferProductionOrderChangeResult(input)
  const scenario =
    productionOrderChangeScenarioCatalog.find(
      (item) => item.source === input.source && item.expectedResult === changeResult,
    ) ??
    productionOrderChangeScenarioCatalog.find((item) => item.expectedResult === changeResult) ??
    productionOrderChangeScenarioCatalog[0]
  const changeText = [input.reason, input.changeContent].map((item) => item.trim()).filter(Boolean).join('；')
  const reason = input.reason.trim() || input.changeContent.trim()
  const documents = scenario.mainAffectedDocuments.length
    ? scenario.mainAffectedDocuments
    : getScenarioDocuments(changeText || reason, changeResult)
  const hasVersionRelationChange = changeResult === 'VERSION_RELATION' || changeResult === 'VERSION_AND_PATCH'
  const hasProductionPatch = changeResult === 'PRODUCTION_PATCH' || changeResult === 'VERSION_AND_PATCH'
  const costDeltaAmount = changeResult === 'COST_ONLY' ? 1200 : input.changeModules.includes('COST') ? 800 : 0
  const delayDays =
    input.executionMode === 'IMMEDIATE_STOP_LOSS' ? 2 : input.executionMode === 'AFTER_APPROVAL' ? 1 : 0
  const createdAt = nowText()
  const order: ProductionOrderChangeOrder = {
    id: `PREVIEW-${relation.productionOrderId}`,
    scenarioId: scenario.id,
    productionOrderId: relation.productionOrderId,
    demandOrderId: relation.productionOrderNo.replace('PO-', 'DO-'),
    spuCode: relation.spuCode,
    styleName: relation.styleName,
    buyerName: relation.buyerName,
    merchandiserName: relation.merchandiserName,
    source: input.source,
    changeModules: [...input.changeModules],
    reason,
    expectedEffectiveMode: input.expectedEffectiveMode,
    effectiveDescription: effectiveModeLabels[input.expectedEffectiveMode],
    changeResult,
    executionStrategy: input.executionMode,
    lockStatus: input.executionMode === 'IMMEDIATE_STOP_LOSS' ? 'WHOLE_ORDER_PAUSED' : 'IMPACT_SCOPE_LOCKED',
    status: 'DRAFT',
    hasVersionRelationChange,
    hasProductionPatch,
    affectedDocumentCount: documents.length,
    costDeltaAmount,
    delayDays,
    createdBy: input.operatorName,
    createdAt,
    reviewer: changeResult === 'COST_ONLY' ? '财务主管' : '生产主管',
    latestLog: `${productionOrderChangeResultLabels[changeResult]}为只读预览，系统已按变更来源和生效口径反推影响。`,
  }
  const impactRows =
    changeResult === 'COST_ONLY' || changeResult === 'RECORD_ONLY'
      ? []
      : [buildProductionOrderChangeImpactRow(order, productionOrderChangeImpactRows.length, 0)]
  const documentActions = documents.map((documentType, index) =>
    buildProductionOrderChangeDocumentAction(
      order,
      documentType,
      productionOrderChangeDocumentActions.length + index,
    ),
  )
  const costImpactIndex = productionOrderChangeCostImpacts.length
  const costType: ProductionOrderChangeCostType = order.changeModules.includes('COST') ? 'FEE' : 'MATERIAL'
  const estimatedAmount = Math.abs(order.costDeltaAmount) + 600
  const costImpacts =
    changeResult === 'COST_ONLY' || order.costDeltaAmount !== 0
      ? [
          {
            id: `COST-IMPACT-${String(costImpactIndex + 1).padStart(3, '0')}`,
            changeOrderId: order.id,
            costType,
            itemName: productionOrderChangeCostItemNames[costType][costImpactIndex % productionOrderChangeCostItemNames[costType].length],
            estimatedAmount,
            actualAmount: estimatedAmount,
            responsibleParty: costType === 'MATERIAL' ? '物料计划 / 供应商' : '财务结算 / 买手',
            settlementHandling: '进入本次结算补差，需保留变更单和主管确认记录。',
          },
        ]
      : []
  const timingNode = scenario.timingNodes[0] ?? 'MATERIAL_PREPARATION'
  const timingImpacts =
    changeResult === 'COST_ONLY' || changeResult === 'RECORD_ONLY'
      ? []
      : [
          {
            id: `TIME-IMPACT-${String(productionOrderChangeTimingImpacts.length + 1).padStart(3, '0')}`,
            changeOrderId: order.id,
            timingNode,
            originalTime: order.createdAt,
            newEstimatedTime: order.createdAt,
            delayDays: order.delayDays,
            affectsProductionDelivery: order.delayDays > 0,
            affectsFulfillmentDelivery: timingNode === 'SHIPPING' || order.delayDays >= 2,
            responsibleParty: timingNode === 'SHIPPING' ? '履约计划' : '生产计划',
            recoveryAction:
              order.executionStrategy === 'IMMEDIATE_STOP_LOSS'
                ? '先锁定影响范围，追回未完成批次，主管确认后释放。'
                : '优先处理未开工范围，已完成部分保留追溯记录。',
          },
        ]

  return clone({ order, impactRows, documentActions, costImpacts, timingImpacts })
}

export function submitProductionOrderChangeOrder(
  input: ProductionOrderChangeOrderSubmitInput,
): ProductionOrderChangeOrder {
  const relation = ensureMutableRelationWithEvaluation(input.productionOrderId)
  if (!relation) throw new Error('未找到生产单技术包版本关系。')
  if (!input.reason.trim()) throw new Error('变更原因不能为空。')
  if (input.changeModules.length === 0) throw new Error('至少需要一个变更模块。')
  const requestedStatus = input.status as ProductionOrderChangeOrderStatus | undefined
  if (requestedStatus && requestedStatus !== 'DRAFT') {
    throw new Error('新建变更单只允许保存为草稿状态。')
  }

  const hasVersionRelationChange =
    input.changeResult === 'VERSION_RELATION' || input.changeResult === 'VERSION_AND_PATCH'
  if (hasVersionRelationChange && !input.linkedVersionChangeRequestId) {
    const hasRunningVersionChange = productionOrderChangeOrders.some(
      (order) =>
        order.productionOrderId === input.productionOrderId &&
        (order.changeResult === 'VERSION_RELATION' || order.changeResult === 'VERSION_AND_PATCH') &&
        order.status !== 'DONE' &&
        order.status !== 'REJECTED' &&
        order.status !== 'RETURNED',
    )
    if (hasRunningVersionChange) throw new Error('同一生产单已有进行中的版本关系变更。')
  }

  const scenario =
    productionOrderChangeScenarioCatalog.find(
      (item) => item.source === input.source && item.expectedResult === input.changeResult,
    ) ??
    productionOrderChangeScenarioCatalog.find((item) => item.expectedResult === input.changeResult) ??
    productionOrderChangeScenarioCatalog[0]
  const documents = scenario.mainAffectedDocuments.length
    ? scenario.mainAffectedDocuments
    : getScenarioDocuments(input.reason, input.changeResult)
  const hasProductionPatch =
    input.changeResult === 'PRODUCTION_PATCH' || input.changeResult === 'VERSION_AND_PATCH'
  const createdAt = nowText()
  const status = requestedStatus ?? (input.executionStrategy === 'IMMEDIATE_EXECUTION' ? 'EXECUTING' : 'SUBMITTED')
  const order: ProductionOrderChangeOrder = {
    id: nextProductionOrderChangeOrderId(input.productionOrderId),
    scenarioId: scenario.id,
    productionOrderId: relation.productionOrderId,
    demandOrderId: relation.productionOrderNo.replace('PO-', 'DO-'),
    spuCode: relation.spuCode,
    styleName: relation.styleName,
    buyerName: relation.buyerName,
    merchandiserName: relation.merchandiserName,
    source: input.source,
    changeModules: [...input.changeModules],
    reason: input.reason.trim(),
    expectedEffectiveMode: input.expectedEffectiveMode,
    effectiveDescription: input.effectiveDescription,
    changeResult: input.changeResult,
    executionStrategy: input.executionStrategy,
    lockStatus: input.executionStrategy === 'IMMEDIATE_STOP_LOSS' ? 'WHOLE_ORDER_PAUSED' : 'IMPACT_SCOPE_LOCKED',
    status,
    hasVersionRelationChange,
    hasProductionPatch,
    affectedDocumentCount: documents.length,
    costDeltaAmount: input.changeResult === 'COST_ONLY' ? 1200 : input.changeModules.includes('COST') ? 800 : 0,
    delayDays: input.executionStrategy === 'IMMEDIATE_STOP_LOSS' ? 2 : input.executionStrategy === 'AFTER_APPROVAL' ? 1 : 0,
    createdBy: input.operatorName,
    createdAt,
    reviewer: input.changeResult === 'COST_ONLY' ? '财务主管' : '生产主管',
    latestLog: status === 'DRAFT'
      ? `${productionOrderChangeResultLabels[input.changeResult]}已保存草稿，待补充后提交审核。`
      : `${productionOrderChangeResultLabels[input.changeResult]}已提交，${productionOrderChangeExecutionStrategyLabels[input.executionStrategy]}。`,
  }

  productionOrderChangeOrders = [order, ...productionOrderChangeOrders]
  appendSubmittedChangeOrderChildren(order)
  return clone(order)
}

export function updateProductionOrderChangeOrder(
  changeOrderId: string,
  input: ProductionOrderChangeOrderUpdateInput,
): ProductionOrderChangeOrder {
  const order = productionOrderChangeOrders.find((item) => item.id === changeOrderId)
  if (!order) throw new Error('未找到生产单变更单。')
  if (order.status !== 'DRAFT' && order.status !== 'RETURNED') {
    throw new Error('当前变更单状态不允许编辑。')
  }
  if (input.productionOrderId !== order.productionOrderId) {
    throw new Error('编辑变更单不支持切换生产单。')
  }
  if (!input.reason.trim()) throw new Error('变更原因不能为空。')
  if (input.changeModules.length === 0) throw new Error('至少需要一个变更模块。')

  const scenario =
    productionOrderChangeScenarioCatalog.find(
      (item) => item.source === input.source && item.expectedResult === input.changeResult,
    ) ??
    productionOrderChangeScenarioCatalog.find((item) => item.expectedResult === input.changeResult) ??
    productionOrderChangeScenarioCatalog[0]
  const documents = scenario.mainAffectedDocuments.length
    ? scenario.mainAffectedDocuments
    : getScenarioDocuments(input.reason, input.changeResult)
  const hasVersionRelationChange =
    input.changeResult === 'VERSION_RELATION' || input.changeResult === 'VERSION_AND_PATCH'
  const hasProductionPatch =
    input.changeResult === 'PRODUCTION_PATCH' || input.changeResult === 'VERSION_AND_PATCH'

  order.scenarioId = scenario.id
  order.source = input.source
  order.changeModules = [...input.changeModules]
  order.reason = input.reason.trim()
  order.expectedEffectiveMode = input.expectedEffectiveMode
  order.effectiveDescription = input.effectiveDescription
  order.changeResult = input.changeResult
  order.executionStrategy = input.executionStrategy
  order.lockStatus = input.executionStrategy === 'IMMEDIATE_STOP_LOSS' ? 'WHOLE_ORDER_PAUSED' : 'IMPACT_SCOPE_LOCKED'
  order.status = input.status
  order.hasVersionRelationChange = hasVersionRelationChange
  order.hasProductionPatch = hasProductionPatch
  order.affectedDocumentCount = documents.length
  order.costDeltaAmount = input.changeResult === 'COST_ONLY' ? 1200 : input.changeModules.includes('COST') ? 800 : 0
  order.delayDays =
    input.executionStrategy === 'IMMEDIATE_STOP_LOSS' ? 2 : input.executionStrategy === 'AFTER_APPROVAL' ? 1 : 0
  order.reviewer = input.changeResult === 'COST_ONLY' ? '财务主管' : '生产主管'
  order.latestLog =
    input.status === 'DRAFT'
      ? `${productionOrderChangeResultLabels[input.changeResult]}已保存草稿，待补充后提交审核。`
      : `${productionOrderChangeResultLabels[input.changeResult]}已提交审核，等待主管确认。`

  replaceSubmittedChangeOrderChildren(order)
  return clone(order)
}

export function listProductionTechPackPublishEvaluationBatches(): ProductionTechPackPublishEvaluationBatch[] {
  return loadPublishEvaluationBatches()
}

export function getProductionTechPackPublishEvaluationBatch(
  batchId: string,
): ProductionTechPackPublishEvaluationBatch | null {
  return loadPublishEvaluationBatches().find((item) => item.batchId === batchId) ?? null
}

export function getLatestPendingProductionTechPackPublishEvaluationBatch():
  | ProductionTechPackPublishEvaluationBatch
  | null {
  return (
    loadPublishEvaluationBatches()
      .filter((item) => item.affectedOrders.length > 0 && item.status !== '已记录不处理')
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null
  )
}

export function createProductionTechPackPublishEvaluationBatch(input: {
  technicalVersionId: string
  technicalVersionCode: string
  versionLabel: string
  styleId: string
  styleCode: string
  styleName: string
  publishedAt: string
  publishedBy: string
  changeSummary?: string
}): ProductionTechPackPublishEvaluationBatch {
  const batches = loadPublishEvaluationBatches()
  const existing = batches.find((item) => item.technicalVersionId === input.technicalVersionId)
  if (existing) return clone(existing)

  const latestPublishedTechPackVersionNo = formatPublishedVersionNo(input.versionLabel, input.technicalVersionCode)
  const affectedOrders = relations
    .filter((relation) => relation.spuCode === input.styleCode || relation.spuId === input.styleId)
    .filter((relation) => relation.currentTechPackVersionId !== input.technicalVersionId)
    .map<ProductionTechPackPublishEvaluationAffectedOrder>((relation) => ({
      productionOrderId: relation.productionOrderId,
      productionOrderNo: relation.productionOrderNo,
      currentTechPackVersionId: relation.currentTechPackVersionId,
      currentTechPackVersionNo: relation.currentTechPackVersionNo,
      latestPublishedTechPackVersionId: input.technicalVersionId,
      latestPublishedTechPackVersionNo,
      progressSummary: relation.progressSummary,
      patchSummary: `生效中 ${relation.activePatchCount} / 待审核 ${relation.pendingPatchCount}`,
      evaluationStatus: '待评估',
    }))
  const batch = normalizePublishEvaluationBatch({
    batchId: `PEB-${input.technicalVersionId.replace(/[^a-zA-Z0-9_-]/g, '-')}`,
    technicalVersionId: input.technicalVersionId,
    technicalVersionCode: input.technicalVersionCode,
    versionLabel: input.versionLabel,
    styleId: input.styleId,
    spuCode: input.styleCode,
    styleName: input.styleName,
    publishedAt: input.publishedAt,
    publishedBy: input.publishedBy,
    diffModules: input.changeSummary?.includes('核价') ? ['BOM', 'COST'] : ['BOM', 'PATTERN', 'DESIGN'],
    affectedOrders,
    status: '待评估',
    createdAt: input.publishedAt,
    updatedAt: input.publishedAt,
  })
  persistPublishEvaluationBatches([batch, ...batches])
  return clone(batch)
}

export function markProductionTechPackPublishEvaluationTodo(batchId: string, operatorName: string): ProductionTechPackPublishEvaluationBatch | null {
  const batches = loadPublishEvaluationBatches()
  const index = batches.findIndex((item) => item.batchId === batchId)
  if (index < 0) return null
  const updatedAt = nowText()
  batches[index] = normalizePublishEvaluationBatch({
    ...batches[index],
    status: '已生成待办',
    affectedOrders: batches[index].affectedOrders.map((item) => ({ ...item, evaluationStatus: '已生成待办' })),
    publishedBy: operatorName || batches[index].publishedBy,
    updatedAt,
  })
  persistPublishEvaluationBatches(batches)
  return clone(batches[index])
}

export function markProductionTechPackPublishEvaluationEntered(batchId: string, operatorName: string): ProductionTechPackPublishEvaluationBatch | null {
  const batches = loadPublishEvaluationBatches()
  const index = batches.findIndex((item) => item.batchId === batchId)
  if (index < 0) return null
  const current = batches[index]
  if (current.status === '已记录不处理' || current.status === '已生成待办') return clone(current)
  const updatedAt = nowText()
  batches[index] = normalizePublishEvaluationBatch({
    ...current,
    status: '已进入生产单变更',
    affectedOrders: current.affectedOrders.map((item) => ({ ...item, evaluationStatus: '已进入生产单变更' })),
    publishedBy: operatorName || current.publishedBy,
    updatedAt,
  })
  persistPublishEvaluationBatches(batches)
  return clone(batches[index])
}

export function ignoreProductionTechPackPublishEvaluationBatch(
  batchId: string,
  reason: string,
  operatorName: string,
): ProductionTechPackPublishEvaluationBatch | null {
  const batches = loadPublishEvaluationBatches()
  const index = batches.findIndex((item) => item.batchId === batchId)
  if (index < 0) return null
  const updatedAt = nowText()
  batches[index] = normalizePublishEvaluationBatch({
    ...batches[index],
    status: '已记录不处理',
    ignoreReason: reason,
    affectedOrders: batches[index].affectedOrders.map((item) => ({ ...item, evaluationStatus: '已记录不处理' })),
    publishedBy: operatorName || batches[index].publishedBy,
    updatedAt,
  })
  persistPublishEvaluationBatches(batches)
  return clone(batches[index])
}

export function listProductionOrderTechPackRelations(): ProductionOrderTechPackRelation[] {
  return clone(getRelationsWithEvaluations())
}

export function getProductionOrderTechPackRelation(productionOrderId: string): ProductionOrderTechPackRelation | null {
  const relation = getRelationWithEvaluation(productionOrderId)
  return relation ? clone(relation) : null
}

export function listPublishedTechPackVersionsByOrder(productionOrderId: string): TechPackVersionOption[] {
  const relation = getRelationWithEvaluation(productionOrderId)
  return relation ? clone(getVersionOptionsForRelation(relation)) : []
}

export function listSelectableTechPackVersionsByOrder(productionOrderId: string): TechPackVersionOption[] {
  const relation = getRelationWithEvaluation(productionOrderId)
  if (!relation) return []
  return clone(
    getVersionOptionsForRelation(relation).filter(
      (item) => item.versionId !== relation.currentTechPackVersionId && !item.archived,
    ),
  )
}

export function getTechPackVersionDiffSnapshot(
  productionOrderId: string,
  targetVersionId?: string,
): TechPackVersionDiffSnapshot | null {
  const snapshot = diffSnapshots.find((item) => item.productionOrderId === productionOrderId)
  if (!snapshot) return null
  const copied = clone(snapshot)
  const relation = getRelationWithEvaluation(productionOrderId)
  if (relation) {
    copied.items = buildTechPackDiffItemsForRelation(relation)
  }
  if (targetVersionId) {
    const targetVersion = relation ? resolveTargetVersion(relation, targetVersionId) : null
    if (targetVersion) {
      copied.toTechPackVersionNo = targetVersion.versionNo
    }
  }
  return copied
}

export function getProductionProgressSnapshot(productionOrderId: string): ProductionProgressSnapshot | null {
  const snapshot = progressSnapshots.find((item) => item.productionOrderId === productionOrderId)
  return snapshot ? clone(snapshot) : null
}

export function getChangeRestrictionSnapshot(productionOrderId: string): ChangeRestrictionSnapshot | null {
  const snapshot = restrictionSnapshots.find((item) => item.productionOrderId === productionOrderId)
  return snapshot ? clone(snapshot) : null
}

export function listTechPackChangeRequestsByOrder(productionOrderId: string): ProductionOrderTechPackChangeRequest[] {
  return clone(changeRequests.filter((item) => item.productionOrderId === productionOrderId))
}

export function listProductionPatchesByOrder(productionOrderId: string): ProductionOrderPatch[] {
  return clone(patches.filter((item) => item.productionOrderId === productionOrderId))
}

export function listProductionChangeNoticesByOrder(productionOrderId: string): ProductionChangeFeishuNotice[] {
  return clone([
    ...buildPublishEvaluationNoticeRows(productionOrderId),
    ...notices.filter((item) => item.productionOrderId === productionOrderId),
  ])
}

export function listProductionChangeOperationLogsByOrder(productionOrderId: string): ProductionChangeOperationLog[] {
  return clone([
    ...buildPublishEvaluationLogRows(productionOrderId),
    ...operationLogs.filter((item) => item.productionOrderId === productionOrderId),
  ])
}

function getModuleLandingLogText(
  relation: ProductionOrderTechPackRelation,
  module: TechPackChangeModule,
  modulePatches: ProductionOrderPatch[],
): string {
  const modulePatchNos = new Set(modulePatches.map((patch) => patch.patchNo))
  const matchedLog = operationLogs.find(
    (log) =>
      log.productionOrderId === relation.productionOrderId &&
      (modulePatchNos.has(log.operationObject) ||
        log.operationObject === relation.latestChangeRecordId ||
        log.remark.includes(techPackChangeModuleLabels[module])),
  )
  if (matchedLog) {
    return `${matchedLog.operatedAt} ${matchedLog.operatorName}：${matchedLog.operationType}，${matchedLog.remark}`
  }
  return `${relation.updatedAt} 系统：已生成${techPackChangeModuleLabels[module]}落地标识`
}

export function listProductionChangeModuleLandingsByOrder(productionOrderId: string): ProductionChangeModuleLanding[] {
  const relation = getRelationWithEvaluation(productionOrderId)
  if (!relation) return []

  const modules = new Set<TechPackChangeModule>()
  relation.diffSummary.forEach((summary) => {
    if (summary.count > 0) modules.add(summary.module)
  })
  patches
    .filter((patch) => patch.productionOrderId === productionOrderId)
    .forEach((patch) => modules.add(patch.affectedModule))

  const landings = [...modules].map<ProductionChangeModuleLanding>((module) => {
    const modulePatches = patches.filter(
      (patch) => patch.productionOrderId === productionOrderId && patch.affectedModule === module,
    )
    const owner = moduleLandingOwners[module]
    const diffCount = relation.diffSummary.find((summary) => summary.module === module)?.count ?? 0
    const activePatchCount = modulePatches.filter((patch) => patch.status === 'EFFECTIVE').length
    const pendingPatchCount = modulePatches.filter((patch) =>
      patch.status === 'SUBMITTED' || patch.status === 'UNDER_REVIEW' || patch.status === 'APPROVED',
    ).length

    const relationMarker =
      diffCount > 0
        ? `版本关系标识：${relation.currentTechPackVersionNo} → ${relation.latestPublishedTechPackVersionNo}`
        : `版本关系标识：保持 ${relation.currentTechPackVersionNo}`
    const patchMarkers = modulePatches.map(
      (patch) => `补丁标识：${patch.patchNo} / ${productionPatchStatusLabels[patch.status]} / ${patchEffectivePointLabels[patch.effectivePoint]}`,
    )
    const currentRule =
      activePatchCount > 0
        ? '后续新建对象优先读取生产单补丁覆盖规则'
        : pendingPatchCount > 0
          ? '补丁审核通过后写入后续对象读取口径'
          : diffCount > 0
            ? '后续未开始对象按目标正式版本评估读取'
            : '保持生产单冻结快照'

    return {
      landingId: `LAND-${productionOrderId}-${module}`,
      productionOrderId,
      module,
      relationMarker,
      patchMarkers,
      currentRule,
      landingObject: moduleLandingObjects[module],
      ownerRole: owner.role,
      ownerName: owner.name,
      viewUrl: `/fcs/production/changes/${productionOrderId}?module=${module}`,
      lastLog: getModuleLandingLogText(relation, module, modulePatches),
    }
  })

  return clone(landings)
}

export function getProductionOrderTechPackChangeDetail(productionOrderId: string) {
  return {
    relation: getProductionOrderTechPackRelation(productionOrderId),
    diffSnapshot: getTechPackVersionDiffSnapshot(productionOrderId),
    progressSnapshot: getProductionProgressSnapshot(productionOrderId),
    restrictionSnapshot: getChangeRestrictionSnapshot(productionOrderId),
    requests: listTechPackChangeRequestsByOrder(productionOrderId),
    patches: listProductionPatchesByOrder(productionOrderId),
    moduleLandings: listProductionChangeModuleLandingsByOrder(productionOrderId),
    notices: listProductionChangeNoticesByOrder(productionOrderId),
    logs: listProductionChangeOperationLogsByOrder(productionOrderId),
  }
}

export function submitProductionOrderTechPackChange(input: {
  productionOrderId: string
  targetVersionId: string
  reason: string
  effectiveMode: ChangeEffectiveMode
  note?: string
  operatorName: string
}): ProductionOrderTechPackChangeRequest {
  const relation = ensureMutableRelationWithEvaluation(input.productionOrderId)
  if (!relation) throw new Error('未找到生产单技术包版本关系。')
  if (!input.targetVersionId) throw new Error('请选择目标正式技术包版本。')
  if (!input.reason.trim()) throw new Error('申请原因不能为空。')
  const targetVersion = resolveTargetVersion(relation, input.targetVersionId)
  if (!targetVersion || targetVersion.archived) throw new Error('只能选择同 SPU 下已发布正式版本。')
  if (targetVersion.versionId === relation.currentTechPackVersionId) throw new Error('不能选择当前已冻结版本。')
  const restriction = restrictionSnapshots.find((item) => item.productionOrderId === input.productionOrderId)
  if (restriction?.items.some((item) => item.blockVersionChange)) throw new Error('当前存在硬限制，不能提交版本关系变更。')

  const createdAt = nowText()
  const id = nextSequence('TCR-202605-', changeRequests as unknown as Array<{ [key: string]: string }>, 'changeRequestId')
  const request: ProductionOrderTechPackChangeRequest = {
    changeRequestId: id,
    changeRequestNo: id,
    productionOrderId: relation.productionOrderId,
    productionOrderNo: relation.productionOrderNo,
    spuId: relation.spuId,
    fromTechPackVersionId: relation.currentTechPackVersionId,
    fromTechPackVersionNo: relation.currentTechPackVersionNo,
    toTechPackVersionId: targetVersion.versionId,
    toTechPackVersionNo: targetVersion.versionNo,
    diffSnapshotId: `DIFF-${relation.productionOrderId}`,
    progressSnapshotId: `PROG-${relation.productionOrderId}`,
    restrictionSnapshotId: `REST-${relation.productionOrderId}`,
    changeScope: '仅未开始对象',
    effectiveMode: input.effectiveMode,
    status: 'SUBMITTED',
    submitReason: input.reason,
    submittedBy: input.operatorName,
    submittedAt: createdAt,
    approvedBy: '',
    approvedAt: '',
    rejectedReason: '',
    effectiveAt: '',
    notifyBatchId: `NTB-${id}`,
    createdAt,
  }

  changeRequests = [request, ...changeRequests]
  relation.relationStatus = 'CHANGE_IN_REVIEW'
  relation.latestChangeRecordId = id
  relation.updatedAt = createdAt
  notices = [
    {
      noticeId: `NT-${id}-001`,
      notifyBatchId: request.notifyBatchId,
      productionOrderId: relation.productionOrderId,
      triggerEvent: '版本关系变更申请已提交',
      receiverName: '生产主管',
      receiverRole: '审核人',
      module: 'COMMON',
      sendStatus: '已发送',
      sentAt: createdAt,
      messageId: `om_${id.toLowerCase()}_001`,
    },
    ...notices,
  ]
  operationLogs = [
    {
      logId: `LOG-${id}`,
      productionOrderId: relation.productionOrderId,
      operatedAt: createdAt,
      operatorName: input.operatorName,
      operationType: '提交版本关系变更',
      operationObject: id,
      beforeText: relation.currentTechPackVersionNo,
      afterText: targetVersion.versionNo,
      remark: input.note || input.reason,
    },
    ...operationLogs,
  ]
  const modules = uniqueList(buildTechPackDiffItemsForRelation(relation).map((item) => item.module))
  submitProductionOrderChangeOrder({
    productionOrderId: relation.productionOrderId,
    source: 'TECH_PACK_NEW_VERSION',
    changeModules: modules.length > 0 ? modules : ['BOM'],
    reason: input.reason,
    expectedEffectiveMode: input.effectiveMode,
    effectiveDescription: effectiveModeLabels[input.effectiveMode],
    changeResult: 'VERSION_RELATION',
    executionStrategy: 'AFTER_APPROVAL',
    operatorName: input.operatorName,
    linkedVersionChangeRequestId: request.changeRequestId,
  })
  return clone(request)
}

export function submitProductionOrderPatch(input: {
  productionOrderId: string
  patchType: ProductionPatchType
  effectivePoint: PatchEffectivePoint
  scopeText: string
  contentText: string
  reason: string
  operatorName: string
}): ProductionOrderPatch {
  const relation = ensureMutableRelationWithEvaluation(input.productionOrderId)
  if (!relation) throw new Error('未找到生产单技术包版本关系。')
  if (!input.reason.trim()) throw new Error('补丁原因不能为空。')
  if (!input.scopeText.trim()) throw new Error('请至少明确一个补丁影响范围。')
  if (!input.contentText.trim()) throw new Error('补丁内容不能为空。')

  const createdAt = nowText()
  const sequence = patches.filter((item) => item.productionOrderId === relation.productionOrderId).length + 1
  const patchNo = `PATCH-${relation.productionOrderId}-${String(sequence).padStart(3, '0')}`
  const patch: ProductionOrderPatch = {
    patchId: patchNo,
    patchNo,
    productionOrderId: relation.productionOrderId,
    productionOrderNo: relation.productionOrderNo,
    baseTechPackVersionId: relation.currentTechPackVersionId,
    baseTechPackVersionNo: relation.currentTechPackVersionNo,
    patchType: input.patchType,
    affectedModule: productionPatchTypeModuleMap[input.patchType],
    patchScope: input.scopeText,
    effectivePoint: input.effectivePoint,
    patchContent: input.contentText,
    reason: input.reason,
    status: 'SUBMITTED',
    submittedBy: input.operatorName,
    submittedAt: createdAt,
    approvedBy: '',
    approvedAt: '',
    effectiveAt: '',
    expiredAt: '',
    linkedObjects: [input.scopeText],
    notifyBatchId: `NTB-${patchNo}`,
    createdAt,
  }

  patches = [patch, ...patches]
  relation.relationStatus = 'PATCHED'
  relation.pendingPatchCount += 1
  relation.historyPatchCount += 1
  relation.updatedAt = createdAt
  notices = [
    {
      noticeId: `NT-${patchNo}-001`,
      notifyBatchId: patch.notifyBatchId,
      productionOrderId: relation.productionOrderId,
      triggerEvent: '生产单补丁已提交',
      receiverName: relation.merchandiserName,
      receiverRole: '跟单负责人',
      module: 'COMMON',
      sendStatus: '已发送',
      sentAt: createdAt,
      messageId: `om_${patchNo.toLowerCase()}_001`,
    },
    {
      noticeId: `NT-${patchNo}-002`,
      notifyBatchId: patch.notifyBatchId,
      productionOrderId: relation.productionOrderId,
      triggerEvent: '生产单补丁已提交',
      receiverName: `${techPackChangeModuleLabels[patch.affectedModule]}责任人`,
      receiverRole: '模块责任人',
      module: patch.affectedModule,
      sendStatus: '已发送',
      sentAt: createdAt,
      messageId: `om_${patchNo.toLowerCase()}_002`,
    },
    ...notices,
  ]
  operationLogs = [
    {
      logId: `LOG-${patchNo}`,
      productionOrderId: relation.productionOrderId,
      operatedAt: createdAt,
      operatorName: input.operatorName,
      operationType: '提交生产单补丁',
      operationObject: patchNo,
      beforeText: relation.currentTechPackVersionNo,
      afterText: productionPatchTypeLabels[input.patchType],
      remark: input.reason,
    },
    ...operationLogs,
  ]
  submitProductionOrderChangeOrder({
    productionOrderId: relation.productionOrderId,
    source: 'MATERIAL_SHORTAGE',
    changeModules: [patch.affectedModule],
    reason: input.reason,
    expectedEffectiveMode:
      patch.effectivePoint === 'FROM_NEXT_PICKUP'
        ? 'FROM_NEXT_PICKUP'
        : patch.effectivePoint === 'SETTLEMENT_ONLY'
          ? 'FROM_SPECIFIED_DATE'
          : 'FROM_NEXT_PREP',
    effectiveDescription: patchEffectivePointLabels[patch.effectivePoint],
    changeResult: 'PRODUCTION_PATCH',
    executionStrategy: 'AFTER_APPROVAL',
    operatorName: input.operatorName,
    linkedPatchId: patch.patchId,
  })
  return clone(patch)
}

export function voidProductionOrderPatch(patchId: string, operatorName: string): ProductionOrderPatch {
  const patch = patches.find((item) => item.patchId === patchId)
  if (!patch) throw new Error('未找到生产单补丁。')
  if (patch.status === 'CANCELLED' || patch.status === 'EXPIRED') throw new Error('该补丁已经失效，不能重复作废。')

  const relation = relations.find((item) => item.productionOrderId === patch.productionOrderId)
  const operatedAt = nowText()
  const originalStatus = patch.status
  patch.status = originalStatus === 'EFFECTIVE' ? 'EXPIRED' : 'CANCELLED'
  patch.expiredAt = operatedAt

  if (relation) {
    if (originalStatus === 'EFFECTIVE') {
      relation.activePatchCount = Math.max(0, relation.activePatchCount - 1)
    }
    if (originalStatus === 'SUBMITTED' || originalStatus === 'UNDER_REVIEW' || originalStatus === 'APPROVED') {
      relation.pendingPatchCount = Math.max(0, relation.pendingPatchCount - 1)
    }
    relation.updatedAt = operatedAt
    if (relation.activePatchCount === 0 && relation.pendingPatchCount === 0 && relation.relationStatus === 'PATCHED') {
      relation.relationStatus = relation.hasNewerPublishedVersion ? 'NEW_VERSION_UNEVALUATED' : 'CURRENT'
    }
  }

  notices = [
    {
      noticeId: `NT-${patch.patchNo}-VOID`,
      notifyBatchId: patch.notifyBatchId,
      productionOrderId: patch.productionOrderId,
      triggerEvent: '生产单补丁作废',
      receiverName: `${techPackChangeModuleLabels[patch.affectedModule]}责任人`,
      receiverRole: '模块责任人',
      module: patch.affectedModule,
      sendStatus: '已发送',
      sentAt: operatedAt,
      messageId: `om_${patch.patchNo.toLowerCase()}_void`,
    },
    ...notices,
  ]
  operationLogs = [
    {
      logId: `LOG-${patch.patchNo}-VOID`,
      productionOrderId: patch.productionOrderId,
      operatedAt,
      operatorName,
      operationType: '作废生产单补丁',
      operationObject: patch.patchNo,
      beforeText: productionPatchStatusLabels[originalStatus],
      afterText: productionPatchStatusLabels[patch.status],
      remark: '补丁作废后不再影响后续新建业务对象。',
    },
    ...operationLogs,
  ]

  return clone(patch)
}
