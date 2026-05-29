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
]

let diffSnapshots: TechPackVersionDiffSnapshot[] = relations.map((relation) => ({
  diffSnapshotId: `DIFF-${relation.productionOrderId}`,
  productionOrderId: relation.productionOrderId,
  fromTechPackVersionNo: relation.currentTechPackVersionNo,
  toTechPackVersionNo: relation.latestPublishedTechPackVersionNo,
  items: [
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
  ),
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
  const configured = publishedTechPackVersionOptionsBySpu[relation.spuCode]
  if (configured?.length) return configured

  return [
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
  ].filter((item, index, options) => options.findIndex((option) => option.versionId === item.versionId) === index)
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

export function listProductionOrderTechPackRelations(): ProductionOrderTechPackRelation[] {
  return clone(relations)
}

export function getProductionOrderTechPackRelation(productionOrderId: string): ProductionOrderTechPackRelation | null {
  const relation = relations.find((item) => item.productionOrderId === productionOrderId)
  return relation ? clone(relation) : null
}

export function listPublishedTechPackVersionsByOrder(productionOrderId: string): TechPackVersionOption[] {
  const relation = relations.find((item) => item.productionOrderId === productionOrderId)
  return relation ? clone(getVersionOptionsForRelation(relation)) : []
}

export function listSelectableTechPackVersionsByOrder(productionOrderId: string): TechPackVersionOption[] {
  const relation = relations.find((item) => item.productionOrderId === productionOrderId)
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
  if (targetVersionId) {
    const relation = relations.find((item) => item.productionOrderId === productionOrderId)
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
  return clone(notices.filter((item) => item.productionOrderId === productionOrderId))
}

export function listProductionChangeOperationLogsByOrder(productionOrderId: string): ProductionChangeOperationLog[] {
  return clone(operationLogs.filter((item) => item.productionOrderId === productionOrderId))
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
  const relation = relations.find((item) => item.productionOrderId === productionOrderId)
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
  const relation = relations.find((item) => item.productionOrderId === input.productionOrderId)
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
  const relation = relations.find((item) => item.productionOrderId === input.productionOrderId)
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
