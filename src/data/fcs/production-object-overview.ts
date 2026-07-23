import {
  formatProductionOrderMainFactoryName,
  getProductionExecutionSummaryBlocks,
  productionOrderStatusConfig,
  productionOrders,
  type ProductionOrder,
  type ProductionLedgerDetails,
  type ProductionExecutionSummaryBlock,
} from './production-orders.ts'
import {
  demandStatusConfig,
  productionDemands,
  type ProductionDemand,
} from './production-demands.ts'
import {
  getTaskTypeLabel,
  listMaterialRequestsByOrder,
  type MaterialRequestRecord,
} from './material-request-drafts.ts'
import {
  getWarehouseExecutionDocById,
  listWarehouseExecutionDocsByOrder,
  type WarehouseExecutionDoc,
  type WarehouseExecutionStatus,
} from './warehouse-material-execution.ts'
import {
  listProgressFacts,
} from './store-domain-progress.ts'
import {
  classifyPrepLineType,
  listMaterialPrepOrderProjections,
  materialPrepRecordStatusLabelMap,
  materialPrepStatusLabelMap,
} from './cutting/production-material-prep.ts'
import {
  listPrintWorkOrders,
  PRINT_WORK_ORDER_STATUS_LABEL,
} from './printing-task-domain.ts'
import {
  listDyeWorkOrders,
  DYE_WORK_ORDER_STATUS_LABEL,
} from './dyeing-task-domain.ts'
import {
  listPostFinishingQcOrderEntities,
  listPostFinishingRecheckOrderEntities,
  listPostFinishingTasks,
} from './post-finishing-domain.ts'

export type ProductionObjectType =
  | 'PRODUCTION_ORDER'
  | 'DEMAND'
  | 'MATERIAL'
  | 'WAREHOUSE_DOC'
  | 'PROCESS_DOC'
  | 'MATERIAL_PREP_ORDER'
  | 'MATERIAL_PREP_RECORD'
  | 'MATERIAL_PICKUP_RECORD'
  | 'CUT_ORDER'
  | 'FEI_TICKET'
  | 'SPREADING_ORDER'
  | 'PRINT_WORK_ORDER'
  | 'DYE_WORK_ORDER'
  | 'HANDOVER_ORDER'
  | 'QC_MASTER_ORDER'
  | 'QC_ORDER'
  | 'RECHECK_ORDER'
  | 'FINISHED_INBOUND_ORDER'
  | 'PURCHASE_ORDER'

export type ProductionObjectSourceDomain = 'FCS' | 'PFOS' | 'WMS' | 'PMS' | 'PCS' | 'PDA'
export type ProductionObjectRequestStatus = 'READY' | 'UNLINKED' | 'MULTIPLE_MATCHES'
export type ProductionObjectDefaultTab = 'overview' | 'materials' | 'progress' | 'quantity' | 'issues' | 'relationship'
export type ProductionObjectOwnerRole = '采购' | '仓库' | '工厂' | '跟单' | '待确认'
export type ContinueDecisionStatus = 'CAN_CONTINUE' | 'CANNOT_CONTINUE' | 'NEEDS_CONFIRM'
export type MaterialType = 'FABRIC' | 'ACCESSORY' | 'YARN' | 'PACKING' | 'CUT_PART' | 'OTHER'
export type RelatedDocumentGroup = '生产' | '面辅料' | '裁片' | '印花' | '染色' | '仓库'
export type PurchaseArrivalStatus =
  | 'NOT_PURCHASED'
  | 'PURCHASED_NOT_ARRIVED'
  | 'PARTIAL_ARRIVED'
  | 'ARRIVED'
  | 'NOT_REQUIRED'
  | 'UNKNOWN'
export type WarehouseLineExecutionStatus =
  | 'NO_PREP'
  | 'TO_PREPARE'
  | 'PARTIAL_PREPARED'
  | 'READY_TO_ISSUE'
  | 'ISSUED'
  | 'RECEIVED'
  | 'DIFFERENCE'
  | 'CLOSED'

export interface ProductionObjectSearchIndex {
  id: string
  objectType: ProductionObjectType
  primaryNo: string
  secondaryNo?: string
  displayTitle: string
  keywords: string[]
  matchedReason?: string
  relatedProductionOrderNo?: string
  relatedDemandNo?: string
  statusText?: string
  ownerRole?: ProductionObjectOwnerRole
  sourceDomain: ProductionObjectSourceDomain
  docGroup?: RelatedDocumentGroup
  routePath?: string
  quantityText?: string
  updatedAt?: string
  defaultTab?: ProductionObjectDefaultTab
  highlightKey?: string
}

export interface ProductionObjectSummary {
  productionOrderNo: string
  demandNo: string
  legacyOrderNo: string
  spu: string
  skuSummary: string
  productTitle: string
  imageUrl: string
  planQuantity: number
  unit: string
  currentStage: string
  mainFactoryName: string
  merchandiser: string
  plannedDeliveryDate: string
  updatedAt: string
}

export interface ContinueDecision {
  status: ContinueDecisionStatus
  displayText: string
  reasonText: string
  nextActionText: string
  ownerRole: ProductionObjectOwnerRole
  ownerName: string
  sourceObjectNo: string
  updatedAt: string
}

export interface ProductionMaterialLine {
  lineId: string
  materialType: MaterialType
  materialName: string
  materialSku: string
  spec?: string
  requiredQty: number
  unit: string
  purchasedQty?: number
  arrivedWarehouseQty?: number
  preparedQty?: number
  issuedQty?: number
  factoryReceivedQty?: number
  shortageQty: number
  purchaseArrivalStatus: PurchaseArrivalStatus
  warehouseExecutionStatus: WarehouseLineExecutionStatus
  estimatedWarehouseArrivalAt?: string
  sourcePoNo?: string
  sourceInboundNo?: string
  sourceMaterialRequestNo?: string
  sourceIssueDocNo?: string
  ownerRole: ProductionObjectOwnerRole
  nextActionText: string
}

export interface MaterialResourceContext {
  sourceObjectType?: ProductionObjectType
  sourceObjectId?: string
  sourceLabel?: string
}

export interface MaterialSupplyDemandSummary {
  totalRequiredQty: number
  availableQty: number
  lockedQty: number
  inTransitQty: number
  pendingInspectionQty: number
  shortageQty: number
  unit: string
  earliestImpactDate: string
}

export interface MaterialBusinessAllocation {
  allocationId: string
  businessType: string
  businessNo: string
  spu: string
  colorSize: string
  requiredQty: number
  preparedQty: number
  pickedQty: number
  shortageQty: number
  deliveryDate: string
  priority: string
  status: string
  isSourceContext: boolean
}

export interface MaterialInventoryBatch {
  warehouseName: string
  batchNo: string
  totalQty: number
  availableQty: number
  lockedQty: number
  pendingInspectionQty: number
  frozenQty: number
  unit: string
}

export interface MaterialPurchaseTransit {
  purchaseOrderNo: string
  supplierName: string
  purchaseQty: number
  arrivedQty: number
  pendingArrivalQty: number
  estimatedArrivalAt: string
  statusText: string
}

export interface MaterialWarehouseReceipt {
  inboundNo: string
  sourceNo: string
  arrivedQty: number
  warehouseName: string
  arrivedAt: string
  qcStatusText: string
}

export interface MaterialExecutionLine {
  businessNo: string
  processName: string
  factoryName: string
  requiredQty: number
  preparedQty: number
  pendingPrepareQty: number
  pickedQty: number
  pendingPickQty: number
  issuedQty: number
  pendingIssueQty: number
  shortageQty: number
  unit: string
  nextActionText: string
  isSourceContext: boolean
}

export interface MaterialResourceIssue {
  issueType: string
  affectedBusinessNo: string
  affectedQty: number
  unit: string
  ownerRole: ProductionObjectOwnerRole
  occurredAt: string
  requiredDoneAt: string
  statusText: string
  suggestionText: string
}

export interface MaterialMasterData {
  materialSku: string
  materialName: string
  materialType: MaterialType
  spec: string
  color: string
  unit: string
  supplierName: string
  purchaseCycleText: string
  minPurchaseQtyText: string
  lossRateText: string
  substituteText: string
  applicableText: string
  statusText: string
}

export interface MaterialResourceOverview {
  materialSku: string
  materialName: string
  materialType: MaterialType
  spec: string
  color: string
  unit: string
  supplierName: string
  currentJudgement: string
  sourceContext?: MaterialResourceContext
  supplyDemandSummary: MaterialSupplyDemandSummary
  businessAllocations: MaterialBusinessAllocation[]
  inventoryBatches: MaterialInventoryBatch[]
  purchaseInTransit: MaterialPurchaseTransit[]
  warehouseReceipts: MaterialWarehouseReceipt[]
  materialExecutionLines: MaterialExecutionLine[]
  issues: MaterialResourceIssue[]
  masterData: MaterialMasterData
}

export interface ProductionProgressNode {
  nodeId: string
  nodeName: string
  status: string
  ownerRole: ProductionObjectOwnerRole
  plannedAt: string
  actualAt: string
  relatedDocNo: string
  quantityText: string
  description: string
}

export interface RelatedDocument {
  docGroup: RelatedDocumentGroup
  docType: string
  docNo: string
  objectType?: ProductionObjectType
  sourceDomain: ProductionObjectSourceDomain
  statusText: string
  ownerRole: ProductionObjectOwnerRole
  routePath: string
  updatedAt: string
  quantityText: string
}

export interface ProductionObjectIssue {
  issueType: string
  severity: '高' | '中' | '低'
  description: string
  affectedObjectNo: string
  ownerRole: ProductionObjectOwnerRole
  nextActionText: string
  continueText: string
}

export interface SourceSnapshot {
  sourceName: string
  sourceText: string
  updatedAt: string
}

export interface ProductionFactSource {
  sourceDomain: ProductionObjectSourceDomain
  factType: string
  sourceObjectNo: string
  statusText: string
  quantityText: string
  ownerRole: ProductionObjectOwnerRole
  nextActionText: string
  updatedAt: string
}

export interface ProductionDecisionFact {
  sourceObjectNo: string
  quantityText: string
  ownerRole: ProductionObjectOwnerRole
  nextActionText: string
  evidenceText: string
}

export interface ProductionDataConflict {
  conflictType: string
  displayText: string
  sourceObjectNo: string
  ownerRole: ProductionObjectOwnerRole
  nextActionText: string
}

export interface ProductionRelationshipNode {
  nodeType: string
  objectNo: string
  title: string
  statusText: string
  ownerRole: ProductionObjectOwnerRole
  routePath: string
}

export interface ProductionRelationshipGroup {
  groupName: '生产' | '物料' | '采购' | '仓库' | 'PFOS' | '异常'
  nodes: ProductionRelationshipNode[]
}

export interface ProductionRelationshipEdge {
  from: string
  to: string
  relationText: string
}

export interface ProductionTimelineNode {
  nodeName: string
  plannedAt: string
  actualAt: string
  ownerRole: ProductionObjectOwnerRole
  statusText: string
  evidenceObjectNo: string
  isCurrent?: boolean
  isIssue?: boolean
}

export interface MaterialFlowTimelineNode {
  stageName: string
  sourceObjectNo: string
  quantityText: string
  statusText: string
  ownerRole: ProductionObjectOwnerRole
  eventAt: string
}

export interface ResponsibilityAnalysisItem {
  issueType: string
  affectedScopeText: string
  ownerRole: ProductionObjectOwnerRole
  evidenceObjectNo: string
  evidenceText: string
  nextActionText: string
  recoveryText: string
}

export interface ProductionObjectIssueQueryInput {
  materialSku?: string
  factoryName?: string
  issueType?: string
  etaDate?: string
}

export interface ProductionObjectIssueQueryResult {
  productionOrderNo: string
  demandNo: string
  productTitle: string
  impactObjectNo: string
  issueType: string
  reasonText: string
  ownerRole: ProductionObjectOwnerRole
  etaDate: string
  factoryName: string
  riskText: string
}

export interface ProductionObjectOverview {
  objectKey: string
  objectType: ProductionObjectType
  title: string
  summary: ProductionObjectSummary
  executionSummary: ProductionExecutionSummaryBlock[]
  executionOverview: ProductionLedgerDetails
  continueDecision: ContinueDecision
  materials: ProductionMaterialLine[]
  progressNodes: ProductionProgressNode[]
  relatedDocuments: RelatedDocument[]
  issues: ProductionObjectIssue[]
  sourceSnapshots: SourceSnapshot[]
  factSources: ProductionFactSource[]
  decisionFacts: ProductionDecisionFact[]
  dataConflicts: ProductionDataConflict[]
  relationshipGroups: ProductionRelationshipGroup[]
  relationshipEdges: ProductionRelationshipEdge[]
  productionTimeline: ProductionTimelineNode[]
  materialFlowTimeline: MaterialFlowTimelineNode[]
  responsibilityAnalysis: ResponsibilityAnalysisItem[]
}

export interface ProductionObjectClickedRef {
  objectType: ProductionObjectType
  objectId: string
  objectNo: string
  displayTitle: string
  sourceDomain: ProductionObjectSourceDomain
  statusText: string
  routePath?: string
  defaultTab: ProductionObjectDefaultTab
  highlightKey: string
}

export interface ProductionObjectUnlinkedResult {
  status: 'UNLINKED'
  request: Pick<ProductionObjectClickedRef, 'objectType' | 'objectId'>
  displayTitle: string
  sourceDomain: ProductionObjectSourceDomain
  message: string
  routePath?: string
}

export interface ProductionObjectMultipleMatchesResult {
  status: 'MULTIPLE_MATCHES'
  request: Pick<ProductionObjectClickedRef, 'objectType' | 'objectId'>
  candidates: ProductionObjectSearchIndex[]
}

export interface ProductionObjectReadyResult {
  status: 'READY'
  indexItem: ProductionObjectSearchIndex
  clickedRef: ProductionObjectClickedRef
}

export type ProductionObjectRequestResult =
  | ProductionObjectReadyResult
  | ProductionObjectUnlinkedResult
  | ProductionObjectMultipleMatchesResult

interface PurchaseArrivalMock {
  productionOrderNo: string
  materialSku: string
  materialName: string
  materialType: MaterialType
  spec: string
  requiredQty: number
  unit: string
  purchaseNo: string
  purchasedQty: number
  arrivedWarehouseQty: number
  estimatedWarehouseArrivalAt?: string
  manualEtaAt?: string
  logisticsEtaAt?: string
  supplierEtaAt?: string
  shortageReasonCode?: PurchaseArrivalStatus
  shortageReasonText?: string
  nextActionText?: string
  supplierName: string
  sourceText: string
}

type ProgressFact = ReturnType<typeof listProgressFacts>[number]

export const purchaseArrivalMocks: PurchaseArrivalMock[] = [
  {
    productionOrderNo: 'PO-202603-0001',
    materialSku: 'FLSZ260617009',
    materialName: '定制银扣',
    materialType: 'ACCESSORY',
    spec: 'silver',
    requiredQty: 2400,
    unit: 'PCS',
    purchaseNo: 'PO-33133',
    purchasedQty: 2400,
    arrivedWarehouseQty: 0,
    estimatedWarehouseArrivalAt: '2026-07-02',
    manualEtaAt: '2026-07-02',
    logisticsEtaAt: '2026-07-03',
    supplierEtaAt: '2026-07-04',
    shortageReasonCode: 'PURCHASED_NOT_ARRIVED',
    shortageReasonText: '已采购未到仓',
    nextActionText: '采购确认预计到仓时间',
    supplierName: '温州某服装辅料有限公司',
    sourceText: '来自采购/物流预计到仓',
  },
  {
    productionOrderNo: 'PO-202603-0001',
    materialSku: 'FLSZ260617010',
    materialName: '主唛吊牌',
    materialType: 'PACKING',
    spec: '黑底白字',
    requiredQty: 2400,
    unit: 'PCS',
    purchaseNo: 'PO-33134',
    purchasedQty: 2400,
    arrivedWarehouseQty: 900,
    estimatedWarehouseArrivalAt: '2026-07-01',
    logisticsEtaAt: '2026-07-01',
    supplierEtaAt: '2026-07-02',
    shortageReasonCode: 'PARTIAL_ARRIVED',
    shortageReasonText: '部分到仓',
    nextActionText: '等待剩余物料到仓',
    supplierName: '雅加达辅料供应商',
    sourceText: '来自采购/物流预计到仓',
  },
  {
    productionOrderNo: 'PO-202603-0001',
    materialSku: 'FAB-202603-0001',
    materialName: '主身针织面料',
    materialType: 'FABRIC',
    spec: '200g 黑色',
    requiredQty: 8600,
    unit: '米',
    purchaseNo: 'PO-33120',
    purchasedQty: 8600,
    arrivedWarehouseQty: 8600,
    logisticsEtaAt: '2026-06-29',
    supplierEtaAt: '2026-06-30',
    shortageReasonCode: 'ARRIVED',
    shortageReasonText: '已到仓',
    supplierName: '广州面料供应商',
    sourceText: '来自采购入库摘要',
  },
]

const OBJECT_TYPE_LABEL: Record<ProductionObjectType, string> = {
  PRODUCTION_ORDER: '生产单',
  DEMAND: '生产需求',
  MATERIAL: '面辅料',
  WAREHOUSE_DOC: '仓库执行单',
  PROCESS_DOC: '工艺单据',
  MATERIAL_PREP_ORDER: '配料单',
  MATERIAL_PREP_RECORD: '配料记录',
  MATERIAL_PICKUP_RECORD: '发料/领料记录',
  CUT_ORDER: '裁片单',
  FEI_TICKET: '菲票',
  SPREADING_ORDER: '铺布单',
  PRINT_WORK_ORDER: '印花工单',
  DYE_WORK_ORDER: '染色工单',
  HANDOVER_ORDER: '交出单',
  QC_MASTER_ORDER: '质检总单',
  QC_ORDER: '质检单',
  RECHECK_ORDER: '复检单',
  FINISHED_INBOUND_ORDER: '成品入库单',
  PURCHASE_ORDER: '采购单',
}

interface P1DocumentMock {
  objectType: ProductionObjectType
  docGroup: RelatedDocumentGroup
  docType: string
  docNo: string
  secondaryNo?: string
  displayTitle: string
  relatedProductionOrderNo: string
  sourceDomain: ProductionObjectSourceDomain
  statusText: string
  ownerRole: ProductionObjectOwnerRole
  routePath: string
  updatedAt: string
  quantityText: string
  keywords: string[]
  factoryName?: string
  issueType?: string
  estimatedRecoveryAt?: string
}

const p1DocumentMocks: P1DocumentMock[] = [
  {
    objectType: 'PROCESS_DOC',
    docGroup: '生产',
    docType: '技术包版本',
    docNo: 'TDV-DEMAND-SPU_2024_001',
    secondaryNo: 'PO-202603-0001',
    displayTitle: '当前生效技术包 v1.0',
    relatedProductionOrderNo: 'PO-202603-0001',
    sourceDomain: 'PCS',
    statusText: '已发布可选',
    ownerRole: '跟单',
    routePath: '/pcs/tech-pack/versions?versionNo=TDV-DEMAND-SPU_2024_001',
    updatedAt: '2026-03-16 10:05',
    quantityText: 'v1.0',
    keywords: ['TDV-DEMAND-SPU_2024_001', '技术包版本', 'SPU-2024-001'],
  },
  {
    objectType: 'MATERIAL_PREP_ORDER',
    docGroup: '面辅料',
    docType: '配料单',
    docNo: 'MPO-202603-0001',
    secondaryNo: 'PO-202603-0001',
    displayTitle: 'PO-202603-0001 裁片配料',
    relatedProductionOrderNo: 'PO-202603-0001',
    sourceDomain: 'WMS',
    statusText: '部分配料',
    ownerRole: '仓库',
    routePath: '/fcs/material-prep/sewing?prepOrderId=MPO-202603-0001',
    updatedAt: '2026-06-30 18:10',
    quantityText: '3 行物料',
    keywords: ['MPO-202603-0001', '配料单', 'PO-202603-0001'],
  },
  {
    objectType: 'MATERIAL_PREP_RECORD',
    docGroup: '面辅料',
    docType: '配料记录',
    docNo: 'MPR-202603-0001',
    secondaryNo: 'MPO-202603-0001',
    displayTitle: '定制银扣配料记录',
    relatedProductionOrderNo: 'PO-202603-0001',
    sourceDomain: 'WMS',
    statusText: '待拣货',
    ownerRole: '仓库',
    routePath: '/fcs/material-prep/sewing?prepOrderId=MPO-202603-0001&tab=records',
    updatedAt: '2026-06-30 18:12',
    quantityText: '需求 2,400 PCS',
    keywords: ['MPR-202603-0001', 'MPO-202603-0001', 'FLSZ260617009'],
  },
  {
    objectType: 'MATERIAL_PICKUP_RECORD',
    docGroup: '面辅料',
    docType: '发料/领料记录',
    docNo: 'PICK-202603-0001',
    secondaryNo: 'MPR-202603-0001',
    displayTitle: '定制银扣领料记录',
    relatedProductionOrderNo: 'PO-202603-0001',
    sourceDomain: 'WMS',
    statusText: '待确认',
    ownerRole: '仓库',
    routePath: '/fcs/material-prep/sewing?prepOrderId=MPO-202603-0001&tab=pickup',
    updatedAt: '2026-06-30 18:15',
    quantityText: '待发 2,400 PCS',
    keywords: ['PICK-202603-0001', 'MPR-202603-0001', 'FLSZ260617009'],
  },
  {
    objectType: 'WAREHOUSE_DOC',
    docGroup: '仓库',
    docType: '入库单',
    docNo: 'IN-33120',
    secondaryNo: 'PO-202603-0001',
    displayTitle: '主身针织面料入库',
    relatedProductionOrderNo: 'PO-202603-0001',
    sourceDomain: 'WMS',
    statusText: '已上架',
    ownerRole: '仓库',
    routePath: '/fcs/progress/material?docNo=IN-33120',
    updatedAt: '2026-06-29 15:30',
    quantityText: '8,600 米',
    keywords: ['IN-33120', '入库单', 'FAB-202603-0001'],
  },
  {
    objectType: 'WAREHOUSE_DOC',
    docGroup: '仓库',
    docType: '库位记录',
    docNo: 'LOC-33120-A01',
    secondaryNo: 'IN-33120',
    displayTitle: '主身针织面料库位',
    relatedProductionOrderNo: 'PO-202603-0001',
    sourceDomain: 'WMS',
    statusText: '可用库存',
    ownerRole: '仓库',
    routePath: '/fcs/progress/material?location=LOC-33120-A01',
    updatedAt: '2026-06-29 16:00',
    quantityText: 'A01-03-02',
    keywords: ['LOC-33120-A01', '库位记录', 'FAB-202603-0001'],
  },
  {
    objectType: 'CUT_ORDER',
    docGroup: '裁片',
    docType: '裁片单',
    docNo: 'CUT-260306-101-01',
    secondaryNo: 'PO-202603-0001',
    displayTitle: '主身裁片',
    relatedProductionOrderNo: 'PO-202603-0001',
    sourceDomain: 'PFOS',
    statusText: '已排唛架',
    ownerRole: '工厂',
    routePath: '/fcs/craft/cutting/cut-orders?cutOrderNo=CUT-260306-101-01',
    updatedAt: '2026-06-30 16:20',
    quantityText: '1,500 件',
    factoryName: '雅加达裁床厂',
    keywords: ['CUT-260306-101-01', '裁片单', 'PO-202603-0001'],
  },
  {
    objectType: 'FEI_TICKET',
    docGroup: '裁片',
    docType: '菲票',
    docNo: 'FEI-260306-101-01-S-BLK-001',
    secondaryNo: 'CUT-260306-101-01',
    displayTitle: '主身 S Black 菲票',
    relatedProductionOrderNo: 'PO-202603-0001',
    sourceDomain: 'PFOS',
    statusText: '已打印',
    ownerRole: '工厂',
    routePath: '/fcs/craft/cutting/fei-tickets?ticketNo=FEI-260306-101-01-S-BLK-001',
    updatedAt: '2026-06-30 16:25',
    quantityText: '300 件',
    factoryName: '雅加达裁床厂',
    keywords: ['FEI-260306-101-01-S-BLK-001', 'CUT-260306-101-01', '菲票'],
  },
  {
    objectType: 'SPREADING_ORDER',
    docGroup: '裁片',
    docType: '铺布单',
    docNo: 'SPR-260306-101-01',
    secondaryNo: 'CUT-260306-101-01',
    displayTitle: '主身铺布单',
    relatedProductionOrderNo: 'PO-202603-0001',
    sourceDomain: 'PFOS',
    statusText: '已铺布',
    ownerRole: '工厂',
    routePath: '/fcs/craft/cutting/marker-spreading?spreadingOrderNo=SPR-260306-101-01',
    updatedAt: '2026-06-30 16:10',
    quantityText: '6 床',
    factoryName: '雅加达裁床厂',
    keywords: ['SPR-260306-101-01', 'CUT-260306-101-01', '铺布单'],
  },
  {
    objectType: 'PROCESS_DOC',
    docGroup: '裁片',
    docType: '中转袋',
    docNo: 'BAG-202603-0001',
    secondaryNo: 'CUT-260306-101-01',
    displayTitle: '主身裁片中转袋',
    relatedProductionOrderNo: 'PO-202603-0001',
    sourceDomain: 'PFOS',
    statusText: '待交接',
    ownerRole: '工厂',
    routePath: '/fcs/craft/cutting/transfer-bags?transferBagNo=BAG-202603-0001',
    updatedAt: '2026-06-30 16:40',
    quantityText: '1 袋 / 300 件',
    factoryName: '雅加达裁床厂',
    keywords: ['BAG-202603-0001', '中转袋', 'CUT-260306-101-01'],
  },
  {
    objectType: 'PROCESS_DOC',
    docGroup: '印花',
    docType: '印花需求单',
    docNo: 'PRINT-REQ-202603-0001',
    secondaryNo: 'PO-202603-0001',
    displayTitle: '前片印花需求',
    relatedProductionOrderNo: 'PO-202603-0001',
    sourceDomain: 'PFOS',
    statusText: '已生成工单',
    ownerRole: '工厂',
    routePath: '/fcs/craft/printing/work-orders?requirementNo=PRINT-REQ-202603-0001',
    updatedAt: '2026-06-30 16:55',
    quantityText: '1,500 件',
    factoryName: '印花一厂',
    keywords: ['PRINT-REQ-202603-0001', '印花需求单', 'PO-202603-0001'],
  },
  {
    objectType: 'PRINT_WORK_ORDER',
    docGroup: '印花',
    docType: '印花工单',
    docNo: 'PRINT-WO-202603-0001',
    secondaryNo: 'PO-202603-0001',
    displayTitle: '前片印花',
    relatedProductionOrderNo: 'PO-202603-0001',
    sourceDomain: 'PFOS',
    statusText: '加工中',
    ownerRole: '工厂',
    routePath: '/fcs/craft/printing/work-orders?taskNo=PRINT-WO-202603-0001',
    updatedAt: '2026-06-30 17:00',
    quantityText: '1,500 件',
    factoryName: '印花一厂',
    issueType: '印花未回仓',
    estimatedRecoveryAt: '2026-07-03',
    keywords: ['PRINT-WO-202603-0001', 'PRINT-WO-GROUP-202603', '印花工单', 'PO-202603-0001'],
  },
  {
    objectType: 'PRINT_WORK_ORDER',
    docGroup: '印花',
    docType: '印花加工单',
    docNo: 'PRINT-WO-GROUP-202603-B',
    secondaryNo: 'PO-202603-0002',
    displayTitle: '同批次印花加工',
    relatedProductionOrderNo: 'PO-202603-0002',
    sourceDomain: 'PFOS',
    statusText: '待交出',
    ownerRole: '工厂',
    routePath: '/fcs/craft/printing/work-orders?taskNo=PRINT-WO-GROUP-202603-B',
    updatedAt: '2026-06-30 17:10',
    quantityText: '2,000 件',
    factoryName: '印花一厂',
    issueType: '印花未回仓',
    estimatedRecoveryAt: '2026-07-04',
    keywords: ['PRINT-WO-GROUP-202603', 'PRINT-WO-GROUP-202603-B', '印花加工单', 'PO-202603-0002'],
  },
  {
    objectType: 'PROCESS_DOC',
    docGroup: '印花',
    docType: '印花回货批次',
    docNo: 'PRINT-RET-202603-0001',
    secondaryNo: 'PRINT-WO-202603-0001',
    displayTitle: '前片印花回货批次',
    relatedProductionOrderNo: 'PO-202603-0001',
    sourceDomain: 'PFOS',
    statusText: '追溯批次',
    ownerRole: '仓库',
    routePath: '/fcs/craft/printing/warehouse?returnBatchNo=PRINT-RET-202603-0001',
    updatedAt: '2026-06-30 17:20',
    quantityText: '回货 0 / 1,500 件',
    factoryName: '印花一厂',
    keywords: ['PRINT-RET-202603-0001', '印花回货批次', 'PRINT-WO-202603-0001'],
  },
  {
    objectType: 'PROCESS_DOC',
    docGroup: '染色',
    docType: '染色需求单',
    docNo: 'DYE-REQ-202603-0001',
    secondaryNo: 'PO-202603-0001',
    displayTitle: '主面料染色需求',
    relatedProductionOrderNo: 'PO-202603-0001',
    sourceDomain: 'PFOS',
    statusText: '已生成工单',
    ownerRole: '工厂',
    routePath: '/fcs/craft/dyeing/work-orders?requirementNo=DYE-REQ-202603-0001',
    updatedAt: '2026-06-30 17:25',
    quantityText: '8,600 米',
    factoryName: '染色一厂',
    keywords: ['DYE-REQ-202603-0001', '染色需求单', 'PO-202603-0001'],
  },
  {
    objectType: 'DYE_WORK_ORDER',
    docGroup: '染色',
    docType: '染色工单',
    docNo: 'DYE-WO-202603-0001',
    secondaryNo: 'PO-202603-0001',
    displayTitle: '主面料染色',
    relatedProductionOrderNo: 'PO-202603-0001',
    sourceDomain: 'PFOS',
    statusText: '待回仓',
    ownerRole: '工厂',
    routePath: '/fcs/craft/dyeing/work-orders?taskNo=DYE-WO-202603-0001',
    updatedAt: '2026-06-30 17:30',
    quantityText: '8,600 米',
    factoryName: '染色一厂',
    issueType: '染色未回仓',
    estimatedRecoveryAt: '2026-07-03',
    keywords: ['DYE-WO-202603-0001', 'DYE-WO-GROUP-202603', '染色工单', 'PO-202603-0001'],
  },
  {
    objectType: 'DYE_WORK_ORDER',
    docGroup: '染色',
    docType: '染色加工单',
    docNo: 'DYE-WO-GROUP-202603-B',
    secondaryNo: 'PO-202603-0002',
    displayTitle: '同批次染色加工',
    relatedProductionOrderNo: 'PO-202603-0002',
    sourceDomain: 'PFOS',
    statusText: '加工中',
    ownerRole: '工厂',
    routePath: '/fcs/craft/dyeing/work-orders?taskNo=DYE-WO-GROUP-202603-B',
    updatedAt: '2026-06-30 17:35',
    quantityText: '2,400 米',
    factoryName: '染色一厂',
    issueType: '染色未回仓',
    estimatedRecoveryAt: '2026-07-05',
    keywords: ['DYE-WO-GROUP-202603', 'DYE-WO-GROUP-202603-B', '染色加工单', 'PO-202603-0002'],
  },
  {
    objectType: 'PROCESS_DOC',
    docGroup: '染色',
    docType: '染色回货批次',
    docNo: 'DYE-RET-202603-0001',
    secondaryNo: 'DYE-WO-202603-0001',
    displayTitle: '主面料染色回货批次',
    relatedProductionOrderNo: 'PO-202603-0001',
    sourceDomain: 'PFOS',
    statusText: '追溯批次',
    ownerRole: '仓库',
    routePath: '/fcs/craft/dyeing/warehouse?returnBatchNo=DYE-RET-202603-0001',
    updatedAt: '2026-06-30 17:45',
    quantityText: '回货 0 / 8,600 米',
    factoryName: '染色一厂',
    keywords: ['DYE-RET-202603-0001', '染色回货批次', 'DYE-WO-202603-0001'],
  },
  {
    objectType: 'HANDOVER_ORDER',
    docGroup: '裁片',
    docType: '交出单',
    docNo: 'HAND-202603-0001',
    secondaryNo: 'PO-202603-0001',
    displayTitle: '裁片交出单',
    relatedProductionOrderNo: 'PO-202603-0001',
    sourceDomain: 'PFOS',
    statusText: '待入仓',
    ownerRole: '仓库',
    routePath: '/fcs/craft/cutting/handover-orders?handoverOrderNo=HAND-202603-0001',
    updatedAt: '2026-06-30 18:00',
    quantityText: '1,500 件',
    factoryName: '雅加达裁床厂',
    keywords: ['HAND-202603-0001', '交出单', 'PO-202603-0001'],
  },
]

export const materialTypeLabel: Record<MaterialType, string> = {
  FABRIC: '面料',
  ACCESSORY: '辅料',
  YARN: '纱线',
  PACKING: '包材',
  CUT_PART: '裁片',
  OTHER: '其他',
}

export const purchaseArrivalStatusLabel: Record<PurchaseArrivalStatus, string> = {
  NOT_PURCHASED: '未采购',
  PURCHASED_NOT_ARRIVED: '已采购未到仓',
  PARTIAL_ARRIVED: '部分到仓',
  ARRIVED: '已到仓',
  NOT_REQUIRED: '无需采购',
  UNKNOWN: '待确认',
}

export const warehouseExecutionStatusLabel: Record<WarehouseLineExecutionStatus, string> = {
  NO_PREP: '未生成配料',
  TO_PREPARE: '待配料',
  PARTIAL_PREPARED: '部分配料',
  READY_TO_ISSUE: '已配料，待发料',
  ISSUED: '已发料',
  RECEIVED: '工厂已收料',
  DIFFERENCE: '数量有差异',
  CLOSED: '已完成',
}

function unique(values: Array<string | undefined | null>): string[] {
  return Array.from(new Set(values.map((value) => (value ?? '').trim()).filter(Boolean)))
}

function formatQty(value: number | undefined, unit: string): string {
  return `${Number(value || 0).toLocaleString('zh-CN')}${unit}`
}

function normalizeMaterialSku(value: string | undefined | null): string {
  return (value || '').trim().toUpperCase()
}

function getPickedQty(line: ProductionMaterialLine): number {
  return Math.max(Number(line.issuedQty || 0), Number(line.factoryReceivedQty || 0))
}

function sumNumbers(values: number[]): number {
  return values.reduce((sum, value) => sum + Number(value || 0), 0)
}

function formatDateOrDash(value: string | null | undefined): string {
  return value || '-'
}

function extractMaterialColor(spec: string | undefined): string {
  const text = (spec || '').trim().toLowerCase()
  if (!text) return '-'
  const colors: Array<[RegExp, string]> = [
    [/白|white/, '白色'],
    [/黑|black/, '黑色'],
    [/银|silver/, '银色'],
    [/金|gold/, '金色'],
    [/红|red/, '红色'],
    [/蓝|blue/, '蓝色'],
    [/绿|green/, '绿色'],
    [/黄|yellow/, '黄色'],
    [/灰|gray|grey/, '灰色'],
  ]
  return unique(colors.filter(([pattern]) => pattern.test(text)).map(([, color]) => color)).slice(0, 2).join('/') || '-'
}

function findOrderByNo(value: string | undefined | null): ProductionOrder | null {
  if (!value) return null
  return productionOrders.find((order) =>
    order.productionOrderId === value ||
    order.productionOrderNo === value ||
    order.demandId === value ||
    order.sourceDemandIds.includes(value),
  ) ?? null
}

function findOrderByAny(values: Array<string | undefined | null>): ProductionOrder | null {
  for (const value of values) {
    const order = findOrderByNo(value)
    if (order) return order
  }
  return null
}

function matchesProductionOrder(order: ProductionOrder, values: Array<string | undefined | null>): boolean {
  return values.some((value) =>
    value === order.productionOrderId ||
    value === order.productionOrderNo ||
    value === order.demandId ||
    order.sourceDemandIds.includes(value || ''),
  )
}

function findDemandById(value: string | undefined | null): ProductionDemand | null {
  if (!value) return null
  return productionDemands.find((demand) => demand.demandId === value || demand.legacyOrderNo === value) ?? null
}

function findIndexItem(value: string | undefined | null): ProductionObjectSearchIndex | null {
  if (!value) return null
  return productionObjectSearchIndex.find((item) => item.id === value || item.primaryNo === value) ?? null
}

function getDefaultTabForObjectType(objectType: ProductionObjectType): ProductionObjectDefaultTab {
  if ((['MATERIAL', 'MATERIAL_PREP_ORDER', 'MATERIAL_PREP_RECORD', 'MATERIAL_PICKUP_RECORD', 'PURCHASE_ORDER', 'WAREHOUSE_DOC'] as ProductionObjectType[]).includes(objectType)) return 'materials'
  if ((['CUT_ORDER', 'FEI_TICKET', 'SPREADING_ORDER', 'PRINT_WORK_ORDER', 'DYE_WORK_ORDER', 'PROCESS_DOC'] as ProductionObjectType[]).includes(objectType)) return 'progress'
  if ((['HANDOVER_ORDER', 'QC_MASTER_ORDER', 'QC_ORDER', 'RECHECK_ORDER', 'FINISHED_INBOUND_ORDER'] as ProductionObjectType[]).includes(objectType)) return 'quantity'
  return 'overview'
}

function makeHighlightKey(objectType: ProductionObjectType, objectNo: string): string {
  return `${objectType}:${objectNo}`
}

function matchesRequestObject(item: ProductionObjectSearchIndex, objectType: ProductionObjectType, objectId: string): boolean {
  if (item.objectType !== objectType) return false
  if (item.id === objectId || item.primaryNo === objectId) return true
  return item.objectType === 'QC_MASTER_ORDER' && item.secondaryNo === objectId
}

export function resolveProductionObjectRequest({
  objectType,
  objectId,
  relatedProductionOrderNo,
}: {
  objectType: ProductionObjectType
  objectId: string
  relatedProductionOrderNo?: string | null
}): ProductionObjectRequestResult {
  const exactMatches = productionObjectSearchIndex.filter((item) => matchesRequestObject(item, objectType, objectId))
  const contextMatches = relatedProductionOrderNo
    ? exactMatches.filter((item) => item.relatedProductionOrderNo === relatedProductionOrderNo)
    : exactMatches

  if (relatedProductionOrderNo && contextMatches.length === 0) {
    return {
      status: 'UNLINKED',
      request: { objectType, objectId },
      displayTitle: objectId,
      sourceDomain: exactMatches[0]?.sourceDomain || 'FCS',
      message: `未找到关联生产单：${objectId}`,
      routePath: exactMatches[0]?.routePath,
    }
  }

  if (exactMatches.length > 1 && !relatedProductionOrderNo) {
    const productionOrders = Array.from(new Set(exactMatches.map((item) => item.relatedProductionOrderNo).filter(Boolean)))
    if (productionOrders.length > 1) return { status: 'MULTIPLE_MATCHES', request: { objectType, objectId }, candidates: exactMatches }
  }

  const indexItem = contextMatches[0] || exactMatches[0]
  if (!indexItem || !indexItem.relatedProductionOrderNo) {
    return {
      status: 'UNLINKED',
      request: { objectType, objectId },
      displayTitle: objectId,
      sourceDomain: indexItem?.sourceDomain || 'FCS',
      message: `未找到关联生产单：${objectId}`,
      routePath: indexItem?.routePath,
    }
  }

  return {
    status: 'READY',
    indexItem,
    clickedRef: {
      objectType: indexItem.objectType,
      objectId,
      objectNo: indexItem.primaryNo,
      displayTitle: indexItem.displayTitle,
      sourceDomain: indexItem.sourceDomain,
      statusText: indexItem.statusText || '待确认',
      routePath: indexItem.routePath,
      defaultTab: indexItem.defaultTab || getDefaultTabForObjectType(indexItem.objectType),
      highlightKey: indexItem.highlightKey || makeHighlightKey(indexItem.objectType, indexItem.primaryNo),
    },
  }
}

function resolveOrder(objectType: ProductionObjectType, objectId: string): ProductionOrder | null {
  const indexItem = findIndexItem(objectId)
  if (indexItem?.relatedProductionOrderNo) return findOrderByNo(indexItem.relatedProductionOrderNo)

  if (objectType === 'PRODUCTION_ORDER') return findOrderByNo(objectId)

  if (objectType === 'DEMAND') {
    const demand = findDemandById(indexItem?.primaryNo) ?? findDemandById(objectId)
    return findOrderByNo(demand?.productionOrderId) ?? findOrderByNo(demand?.demandId) ?? findOrderByNo(objectId)
  }

  if (objectType === 'WAREHOUSE_DOC') {
    const doc = getWarehouseExecutionDocById(objectId)
    return findOrderByNo(doc?.productionOrderId)
  }

  return findOrderByNo(indexItem?.relatedProductionOrderNo)
}

function resolveDemand(objectId: string): ProductionDemand | null {
  const indexItem = findIndexItem(objectId)
  return findDemandById(indexItem?.primaryNo) ?? findDemandById(objectId)
}

function getOrderQuantity(order: ProductionOrder): number {
  return order.demandSnapshot.skuLines.reduce((sum, line) => sum + line.qty, 0) || 0
}

function getSkuSummary(order: ProductionOrder): string {
  const colors = unique(order.demandSnapshot.skuLines.map((line) => line.color))
  const sizes = unique(order.demandSnapshot.skuLines.map((line) => line.size))
  return `${order.demandSnapshot.skuLines.length} 个 SKU，颜色 ${colors.slice(0, 3).join('、') || '-'}，尺码 ${sizes.slice(0, 4).join('、') || '-'}`
}

function mapDocStatus(status: WarehouseExecutionStatus): WarehouseLineExecutionStatus {
  if (status === 'PLANNED') return 'NO_PREP'
  if (status === 'PREPARING') return 'TO_PREPARE'
  if (status === 'PARTIALLY_PREPARED') return 'PARTIAL_PREPARED'
  if (status === 'READY') return 'READY_TO_ISSUE'
  if (status === 'ISSUED' || status === 'IN_TRANSIT') return 'ISSUED'
  if (status === 'RECEIVED') return 'RECEIVED'
  if (status === 'CLOSED') return 'CLOSED'
  return 'DIFFERENCE'
}

function derivePurchaseStatus(mock: PurchaseArrivalMock): PurchaseArrivalStatus {
  if (mock.purchasedQty <= 0) return 'NOT_PURCHASED'
  if (mock.arrivedWarehouseQty <= 0) return 'PURCHASED_NOT_ARRIVED'
  if (mock.arrivedWarehouseQty < mock.requiredQty) return 'PARTIAL_ARRIVED'
  return 'ARRIVED'
}

function buildMockMaterialLine(mock: PurchaseArrivalMock): ProductionMaterialLine {
  const purchaseArrivalStatus = derivePurchaseStatus(mock)
  const shortageQty = Math.max(0, mock.requiredQty - mock.arrivedWarehouseQty)
  const needsDate = purchaseArrivalStatus === 'PURCHASED_NOT_ARRIVED' || purchaseArrivalStatus === 'PARTIAL_ARRIVED'
  const estimatedWarehouseArrivalAt = mock.manualEtaAt || mock.logisticsEtaAt || mock.supplierEtaAt || mock.estimatedWarehouseArrivalAt

  return {
    lineId: `PURCHASE-${mock.productionOrderNo}-${mock.materialSku}`,
    materialType: mock.materialType,
    materialName: mock.materialName,
    materialSku: mock.materialSku,
    spec: mock.spec,
    requiredQty: mock.requiredQty,
    unit: mock.unit,
    purchasedQty: mock.purchasedQty,
    arrivedWarehouseQty: mock.arrivedWarehouseQty,
    preparedQty: 0,
    issuedQty: 0,
    factoryReceivedQty: 0,
    shortageQty,
    purchaseArrivalStatus,
    warehouseExecutionStatus: shortageQty > 0 ? 'NO_PREP' : 'READY_TO_ISSUE',
    estimatedWarehouseArrivalAt: needsDate ? estimatedWarehouseArrivalAt : undefined,
    sourcePoNo: mock.purchaseNo,
    sourceInboundNo: purchaseArrivalStatus === 'ARRIVED' || purchaseArrivalStatus === 'PARTIAL_ARRIVED'
      ? `IN-${mock.purchaseNo.replace(/^PO-/, '')}`
      : undefined,
    ownerRole: shortageQty > 0 ? '采购' : '仓库',
    nextActionText: mock.nextActionText || (shortageQty > 0 ? '采购确认预计到仓时间' : '仓库安排配料和发料'),
  }
}

function getLineIssuedQty(line: WarehouseExecutionDoc['lines'][number]): number {
  if ('issuedQty' in line) return line.issuedQty
  if ('transferredQty' in line) return line.transferredQty
  return 0
}

function buildWarehouseMaterialLines(order: ProductionOrder): ProductionMaterialLine[] {
  return listWarehouseExecutionDocsByOrder(order.productionOrderNo).flatMap((doc) =>
    doc.lines.map((line) => {
      const issuedQty = getLineIssuedQty(line)
      const warehouseExecutionStatus = mapDocStatus(doc.status)
      const purchaseArrivalStatus: PurchaseArrivalStatus = line.preparedQty >= line.plannedQty ? 'ARRIVED' : 'UNKNOWN'
      const factoryReceivedQty = warehouseExecutionStatus === 'RECEIVED' || warehouseExecutionStatus === 'CLOSED'
        ? Math.max(issuedQty, line.preparedQty)
        : 0
      const shortageQty = Math.max(0, line.plannedQty - line.preparedQty)

      return {
        lineId: line.lineId,
        materialType: line.materialName.includes('裁片') || line.sourceType === 'upstream_output' ? 'CUT_PART' : 'OTHER',
        materialName: line.materialName,
        materialSku: line.materialCode || line.skuCode || line.lineId,
        spec: line.materialSpec,
        requiredQty: line.plannedQty,
        unit: line.unit,
        purchasedQty: undefined,
        arrivedWarehouseQty: line.preparedQty,
        preparedQty: line.preparedQty,
        issuedQty,
        factoryReceivedQty,
        shortageQty,
        purchaseArrivalStatus,
        warehouseExecutionStatus,
        sourceMaterialRequestNo: doc.materialRequestNo,
        sourceIssueDocNo: doc.docNo,
        ownerRole: warehouseExecutionStatus === 'ISSUED' ? '工厂' : '仓库',
        nextActionText: getWarehouseNextAction(warehouseExecutionStatus),
      }
    }),
  )
}

function inferPrepMaterialType(line: ReturnType<typeof listMaterialPrepOrderProjections>[number]['lines'][number]): MaterialType {
  const text = `${line.materialSku} ${line.materialName}`.toLowerCase()
  if (text.includes('yarn') || text.includes('纱线') || text.includes('缝纫线')) return 'YARN'
  if (text.includes('fabric') || text.includes('面料') || text.includes('里布') || text.includes('半成品')) return 'FABRIC'
  if (text.includes('packing') || text.includes('包装')) return 'PACKING'
  if (text.includes('zipper') || text.includes('button') || text.includes('label') || text.includes('拉链') || text.includes('纽扣') || text.includes('唛')) return 'ACCESSORY'
  return 'OTHER'
}

function mapPrepLineStatus(requiredQty: number, preparedQty: number, pickedQty: number): WarehouseLineExecutionStatus {
  if (preparedQty <= 0) return 'TO_PREPARE'
  if (preparedQty < requiredQty) return 'PARTIAL_PREPARED'
  if (pickedQty <= 0) return 'READY_TO_ISSUE'
  return pickedQty >= requiredQty ? 'RECEIVED' : 'ISSUED'
}

function buildMaterialPrepLines(order: ProductionOrder): ProductionMaterialLine[] {
  return listMaterialPrepOrderProjections()
    .filter((projection) => matchesProductionOrder(order, [projection.order.productionOrderNo, projection.order.productionOrderId]))
    .flatMap((projection) => projection.lines.map((line) => {
      const pickedQty = projection.pickupRecords
        .filter((record) => record.prepLineId === line.prepLineId)
        .reduce((sum, record) => sum + record.pickedQty, 0)
      const preparedQty = line.confirmedPrepQty || 0
      const requiredQty = line.requiredQty || 0
      const shortageQty = Math.max(0, requiredQty - Math.max(preparedQty, pickedQty))
      const routePath = `${getProjectionCategoryPath(projection)}?prepOrderId=${encodeURIComponent(projection.order.prepOrderId)}`

      return {
        lineId: line.prepLineId,
        materialType: inferPrepMaterialType(line),
        materialName: line.materialName,
        materialSku: line.materialSku,
        spec: line.materialColor || line.materialSpec || classifyPrepLineType(line),
        requiredQty,
        unit: line.unit,
        purchasedQty: undefined,
        arrivedWarehouseQty: preparedQty,
        preparedQty,
        issuedQty: pickedQty,
        factoryReceivedQty: pickedQty,
        shortageQty,
        purchaseArrivalStatus: 'ARRIVED' as const,
        warehouseExecutionStatus: mapPrepLineStatus(requiredQty, preparedQty, pickedQty),
        sourceMaterialRequestNo: projection.order.prepOrderNo,
        sourceIssueDocNo: projection.pickupRecords.find((record) => record.prepLineId === line.prepLineId)?.pickupRecordId,
        ownerRole: pickedQty >= requiredQty ? '工厂' as const : '仓库' as const,
        nextActionText: pickedQty >= requiredQty ? '工厂按已领物料继续生产' : '仓库确认配料并安排工厂领料',
        routePath,
      }
    }))
}

function getWarehouseNextAction(status: WarehouseLineExecutionStatus): string {
  if (status === 'NO_PREP' || status === 'TO_PREPARE') return '仓库完成配料'
  if (status === 'PARTIAL_PREPARED') return '仓库补齐配料数量'
  if (status === 'READY_TO_ISSUE') return '仓库发料给工厂'
  if (status === 'ISSUED') return '工厂确认收料或反馈差异'
  if (status === 'DIFFERENCE') return '仓库和工厂核对差异'
  return '当前物料准备完成'
}

function getMaterialSearchStatus(line: ProductionMaterialLine): string {
  if (line.purchaseArrivalStatus === 'NOT_PURCHASED' || line.purchaseArrivalStatus === 'PURCHASED_NOT_ARRIVED' || line.purchaseArrivalStatus === 'PARTIAL_ARRIVED') {
    return purchaseArrivalStatusLabel[line.purchaseArrivalStatus]
  }
  if (line.warehouseExecutionStatus === 'NO_PREP' || line.warehouseExecutionStatus === 'TO_PREPARE') return '待配料'
  if (line.warehouseExecutionStatus === 'PARTIAL_PREPARED') return '部分配料'
  if (line.warehouseExecutionStatus === 'READY_TO_ISSUE') return '待领料'
  if (line.warehouseExecutionStatus === 'ISSUED') return '部分领料'
  if (line.warehouseExecutionStatus === 'RECEIVED' || line.warehouseExecutionStatus === 'CLOSED') return '已领齐'
  return warehouseExecutionStatusLabel[line.warehouseExecutionStatus]
}

function buildMaterialLines(order: ProductionOrder): ProductionMaterialLine[] {
  const mockLines = purchaseArrivalMocks
    .filter((mock) => mock.productionOrderNo === order.productionOrderNo)
    .map(buildMockMaterialLine)
  const prepLines = buildMaterialPrepLines(order)

  const seen = new Set(mockLines.map((line) => line.materialSku))
  const uniquePrepLines = prepLines.filter((line) => {
    if (seen.has(line.materialSku)) return false
    seen.add(line.materialSku)
    return true
  })
  const warehouseLines = buildWarehouseMaterialLines(order)
    .filter((line) => {
      if (seen.has(line.materialSku)) return false
      seen.add(line.materialSku)
      return true
    })

  return [...mockLines, ...uniquePrepLines, ...warehouseLines].slice(0, 18)
}

interface MaterialResourceBaseRow {
  order: ProductionOrder
  line: ProductionMaterialLine
}

let materialResourceRowsBySkuCache: Map<string, MaterialResourceBaseRow[]> | null = null

function getMaterialResourceRowsBySku(): Map<string, MaterialResourceBaseRow[]> {
  if (!materialResourceRowsBySkuCache) {
    materialResourceRowsBySkuCache = new Map()
    for (const order of productionOrders) {
      for (const line of buildMaterialLines(order)) {
        const sku = normalizeMaterialSku(line.materialSku)
        if (!sku) continue
        const rows = materialResourceRowsBySkuCache.get(sku) ?? []
        rows.push({ order, line })
        materialResourceRowsBySkuCache.set(sku, rows)
      }
    }
  }
  return materialResourceRowsBySkuCache
}

function listMaterialResourceRows(materialSku: string, context: MaterialResourceContext = {}): Array<MaterialResourceBaseRow & {
  isSourceContext: boolean
}> {
  const targetSku = normalizeMaterialSku(materialSku)
  return (getMaterialResourceRowsBySku().get(targetSku) ?? []).map(({ order, line }) => {
    const isSourceContext = context.sourceObjectId
      ? matchesProductionOrder(order, [context.sourceObjectId])
      : false
    return { order, line, isSourceContext }
  }).sort((a, b) => Number(b.isSourceContext) - Number(a.isSourceContext))
}

function buildMaterialBusinessAllocations(rows: ReturnType<typeof listMaterialResourceRows>): MaterialBusinessAllocation[] {
  return rows.map(({ order, line, isSourceContext }) => ({
    allocationId: `${order.productionOrderNo}-${line.lineId}`,
    businessType: '生产单',
    businessNo: order.productionOrderNo,
    spu: order.demandSnapshot.spuCode,
    colorSize: getSkuSummary(order),
    requiredQty: line.requiredQty,
    preparedQty: Number(line.preparedQty || 0),
    pickedQty: getPickedQty(line),
    shortageQty: line.shortageQty,
    deliveryDate: formatDateOrDash(order.demandSnapshot.requiredDeliveryDate),
    priority: order.demandSnapshot.priority || '普通',
    status: getMaterialSearchStatus(line),
    isSourceContext,
  }))
}

function buildMaterialExecutionLines(rows: ReturnType<typeof listMaterialResourceRows>): MaterialExecutionLine[] {
  return rows.map(({ order, line, isSourceContext }) => {
    const preparedQty = Number(line.preparedQty || 0)
    const pickedQty = getPickedQty(line)
    const issuedQty = Number(line.issuedQty || 0)
    return {
      businessNo: order.productionOrderNo,
      processName: line.materialType === 'FABRIC' ? '裁片' : '生产用料',
      factoryName: order.mainFactorySnapshot.name || '待确认',
      requiredQty: line.requiredQty,
      preparedQty,
      pendingPrepareQty: Math.max(0, line.requiredQty - preparedQty),
      pickedQty,
      pendingPickQty: Math.max(0, line.requiredQty - pickedQty),
      issuedQty,
      pendingIssueQty: Math.max(0, line.requiredQty - issuedQty),
      shortageQty: line.shortageQty,
      unit: line.unit,
      nextActionText: line.nextActionText,
      isSourceContext,
    }
  })
}

function buildMaterialResourceIssues(rows: ReturnType<typeof listMaterialResourceRows>): MaterialResourceIssue[] {
  return rows
    .filter(({ line }) => line.shortageQty > 0 || getMaterialSearchStatus(line).includes('待'))
    .map(({ order, line }) => ({
      issueType: line.shortageQty > 0 ? '缺料' : getMaterialSearchStatus(line),
      affectedBusinessNo: order.productionOrderNo,
      affectedQty: line.shortageQty || Math.max(0, line.requiredQty - getPickedQty(line)),
      unit: line.unit,
      ownerRole: line.ownerRole,
      occurredAt: order.updatedAt,
      requiredDoneAt: formatDateOrDash(order.demandSnapshot.requiredDeliveryDate),
      statusText: getMaterialSearchStatus(line),
      suggestionText: line.nextActionText,
    }))
}

function buildMaterialSupplyDemandSummary(rows: ReturnType<typeof listMaterialResourceRows>): MaterialSupplyDemandSummary {
  const unit = rows[0]?.line.unit || ''
  const totalRequiredQty = sumNumbers(rows.map(({ line }) => line.requiredQty))
  const totalPreparedQty = sumNumbers(rows.map(({ line }) => Number(line.preparedQty || 0)))
  const totalPickedQty = sumNumbers(rows.map(({ line }) => getPickedQty(line)))
  const shortageQty = sumNumbers(rows.map(({ line }) => line.shortageQty))
  const dates = rows
    .map(({ order }) => order.demandSnapshot.requiredDeliveryDate || '')
    .filter(Boolean)
    .sort()
  return {
    totalRequiredQty,
    availableQty: Math.max(0, totalPreparedQty - totalPickedQty),
    lockedQty: totalPreparedQty,
    inTransitQty: Math.max(0, sumNumbers(rows.map(({ line }) => Number(line.purchasedQty || 0))) - sumNumbers(rows.map(({ line }) => Number(line.arrivedWarehouseQty || 0)))),
    pendingInspectionQty: Math.max(0, shortageQty > 0 ? Math.round(shortageQty * 0.5) : 0),
    shortageQty,
    unit,
    earliestImpactDate: dates[0] || '-',
  }
}

function buildMaterialInventoryBatches(summary: MaterialSupplyDemandSummary): MaterialInventoryBatch[] {
  return [
    {
      warehouseName: '原料仓',
      batchNo: 'BATCH-CURRENT',
      totalQty: Math.max(summary.lockedQty, summary.availableQty) + summary.pendingInspectionQty,
      availableQty: summary.availableQty,
      lockedQty: summary.lockedQty,
      pendingInspectionQty: summary.pendingInspectionQty,
      frozenQty: 0,
      unit: summary.unit,
    },
  ]
}

export function getMaterialResourceOverview(
  materialSku: string,
  context: MaterialResourceContext = {},
): MaterialResourceOverview | null {
  const rows = listMaterialResourceRows(materialSku, context)
  if (rows.length === 0) return null
  const firstLine = rows[0].line
  const summary = buildMaterialSupplyDemandSummary(rows)
  const allocations = buildMaterialBusinessAllocations(rows)
  const executionLines = buildMaterialExecutionLines(rows)
  const issues = buildMaterialResourceIssues(rows)
  const supplierName = firstLine.sourcePoNo ? '采购供应商' : '默认供应商'
  return {
    materialSku: firstLine.materialSku,
    materialName: firstLine.materialName,
    materialType: firstLine.materialType,
    spec: firstLine.spec || '-',
    color: extractMaterialColor(firstLine.spec),
    unit: firstLine.unit,
    supplierName,
    currentJudgement: summary.shortageQty > 0
      ? `缺口 ${formatQty(summary.shortageQty, summary.unit)}，影响 ${allocations.length} 张生产单`
      : `可用库存覆盖 ${allocations.length} 张生产单需求`,
    sourceContext: context.sourceObjectId ? context : undefined,
    supplyDemandSummary: summary,
    businessAllocations: allocations,
    inventoryBatches: buildMaterialInventoryBatches(summary),
    purchaseInTransit: rows
      .filter(({ line }) => Number(line.purchasedQty || 0) > Number(line.arrivedWarehouseQty || 0))
      .map(({ line }) => ({
        purchaseOrderNo: line.sourcePoNo || `${line.materialSku}-PUR`,
        supplierName,
        purchaseQty: Number(line.purchasedQty || 0),
        arrivedQty: Number(line.arrivedWarehouseQty || 0),
        pendingArrivalQty: Math.max(0, Number(line.purchasedQty || 0) - Number(line.arrivedWarehouseQty || 0)),
        estimatedArrivalAt: line.estimatedWarehouseArrivalAt || '-',
        statusText: purchaseArrivalStatusLabel[line.purchaseArrivalStatus],
      })),
    warehouseReceipts: rows
      .filter(({ line }) => line.sourceInboundNo)
      .map(({ line }) => ({
        inboundNo: line.sourceInboundNo || '-',
        sourceNo: line.sourcePoNo || line.sourceMaterialRequestNo || '-',
        arrivedQty: Number(line.arrivedWarehouseQty || 0),
        warehouseName: '原料仓',
        arrivedAt: line.estimatedWarehouseArrivalAt || '-',
        qcStatusText: '已释放',
      })),
    materialExecutionLines: executionLines,
    issues,
    masterData: {
      materialSku: firstLine.materialSku,
      materialName: firstLine.materialName,
      materialType: firstLine.materialType,
      spec: firstLine.spec || '-',
      color: extractMaterialColor(firstLine.spec),
      unit: firstLine.unit,
      supplierName,
      purchaseCycleText: '7 天',
      minPurchaseQtyText: `按 ${firstLine.unit} 起订`,
      lossRateText: '按工艺默认损耗',
      substituteText: '暂无替代料',
      applicableText: rows.map(({ order }) => order.demandSnapshot.spuCode).filter(Boolean).slice(0, 3).join('、') || '-',
      statusText: '启用',
    },
  }
}

export function searchMaterialResources(keyword: string): MaterialResourceOverview[] {
  const query = keyword.trim().toUpperCase()
  if (query.length < 2) return []
  const materialSkus = Array.from(new Set(
    productionObjectSearchIndex
      .filter((item) => item.objectType === 'MATERIAL')
      .filter((item) => `${item.primaryNo} ${item.displayTitle} ${item.keywords.join(' ')}`.toUpperCase().includes(query))
      .map((item) => item.primaryNo),
  ))
  return materialSkus
    .map((sku) => getMaterialResourceOverview(sku))
    .filter((item): item is MaterialResourceOverview => Boolean(item))
}

let progressFactsByOrderCache: Map<string, ProgressFact[]> | null = null

function getProgressFactsByOrder(productionOrderNo: string): ProgressFact[] {
  if (!progressFactsByOrderCache) {
    progressFactsByOrderCache = new Map()
    for (const fact of listProgressFacts()) {
      const rows = progressFactsByOrderCache.get(fact.productionOrderId) ?? []
      rows.push(fact)
      progressFactsByOrderCache.set(fact.productionOrderId, rows)
    }
  }
  return progressFactsByOrderCache.get(productionOrderNo) ?? []
}

function buildProgressNodes(order: ProductionOrder, facts: ProgressFact[]): ProductionProgressNode[] {
  if (facts.length === 0) {
    return [
      {
        nodeId: `${order.productionOrderNo}-material`,
        nodeName: '面辅料准备',
        status: '待确认',
        ownerRole: '跟单',
        plannedAt: order.updatedAt || '-',
        actualAt: '-',
        relatedDocNo: '-',
        quantityText: `${getOrderQuantity(order).toLocaleString('zh-CN')} 件`,
        description: '当前生产单暂无工艺任务明细，需跟单确认任务资料。',
      },
    ]
  }

  return facts.slice(0, 8).map((fact) => ({
    nodeId: fact.runtimeTaskId,
    nodeName: fact.processNameZh || fact.taskTypeLabel || '生产节点',
    status: fact.startReadiness.canStart ? '可以处理' : fact.startReadiness.reasonText,
    ownerRole: fact.assignedFactoryName ? '工厂' : '跟单',
    plannedAt: '-',
    actualAt: '-',
    relatedDocNo: fact.taskNo || fact.runtimeTaskId,
    quantityText: `${fact.materialRequests.length} 张领料需求 / ${fact.executionDocs.length} 张执行单`,
    description: fact.assignedFactoryName || fact.scopeLabel || '待确认执行方',
  }))
}

function getMaterialPrepCategoryPath(category: string): string {
  if (category === '染色配料') return '/fcs/material-prep/dyeing'
  if (category === '印花配料') return '/fcs/material-prep/printing'
  if (category === '裁片配料') return '/fcs/material-prep/cutting'
  if (category === '车缝配料') return '/fcs/material-prep/sewing'
  return '/fcs/material-prep/other'
}

function getProjectionCategoryPath(projection: ReturnType<typeof listMaterialPrepOrderProjections>[number]): string {
  const firstLine = projection.lines[0]
  return getMaterialPrepCategoryPath(firstLine ? classifyPrepLineType(firstLine) : '其他配料')
}

function buildRuntimeRelatedDocuments(order: ProductionOrder): RelatedDocument[] {
  const documents: RelatedDocument[] = []

  for (const projection of listMaterialPrepOrderProjections().filter((item) => matchesProductionOrder(order, [item.order.productionOrderNo, item.order.productionOrderId]))) {
    const routePath = `${getProjectionCategoryPath(projection)}?prepOrderId=${encodeURIComponent(projection.order.prepOrderId)}`
    const confirmedPrepText = projection.unitSummaries
      .filter((summary) => summary.confirmedPrepQty > 0)
      .map((summary) => formatQty(summary.confirmedPrepQty, summary.unit))
      .join('；') || '0'
    documents.push({
      docGroup: '面辅料',
      docType: '配料单',
      docNo: projection.order.prepOrderNo,
      objectType: 'MATERIAL_PREP_ORDER',
      sourceDomain: 'WMS',
      statusText: materialPrepStatusLabelMap[projection.order.overallPrepStatus],
      ownerRole: '仓库',
      routePath,
      updatedAt: projection.latestOperatedAt || projection.order.createdAt,
      quantityText: `${projection.lineCount} 行 / 已配 ${confirmedPrepText}`,
    })

    for (const record of projection.prepRecords.slice(0, 4)) {
      const line = projection.lines.find((item) => item.prepLineId === record.prepLineId)
      documents.push({
        docGroup: '面辅料',
        docType: '配料记录',
        docNo: record.prepRecordId,
        objectType: 'MATERIAL_PREP_RECORD',
        sourceDomain: 'WMS',
        statusText: materialPrepRecordStatusLabelMap[record.recordStatus],
        ownerRole: '仓库',
        routePath: `${routePath}&detailTab=records`,
        updatedAt: record.confirmedAt || record.preparedAt,
        quantityText: `${line?.materialName || '物料'} ${formatQty(record.preparedQty, line?.unit || '件')}`,
      })
    }

    for (const record of projection.pickupRecords.slice(0, 4)) {
      const line = projection.lines.find((item) => item.prepLineId === record.prepLineId)
      documents.push({
        docGroup: '面辅料',
        docType: '领料记录',
        docNo: record.pickupRecordId,
        objectType: 'MATERIAL_PICKUP_RECORD',
        sourceDomain: 'WMS',
        statusText: record.pickupStatus,
        ownerRole: '工厂',
        routePath: `${routePath}&detailTab=pickup`,
        updatedAt: record.pickedAt,
        quantityText: `${line?.materialName || '物料'} ${formatQty(record.pickedQty, line?.unit || '件')}`,
      })
    }

    for (const record of projection.rejectRecords.slice(0, 3)) {
      const line = projection.lines.find((item) => item.prepLineId === record.prepLineId)
      documents.push({
        docGroup: '面辅料',
        docType: '配料打回记录',
        docNo: record.rejectId,
        objectType: 'MATERIAL_PICKUP_RECORD',
        sourceDomain: 'WMS',
        statusText: materialPrepRecordStatusLabelMap[record.afterStatus],
        ownerRole: '仓库',
        routePath: `${routePath}&detailTab=pickup`,
        updatedAt: record.rejectedAt,
        quantityText: line?.materialName || record.rejectReason,
      })
    }
  }

  for (const workOrder of listPrintWorkOrders().filter((item) => matchesProductionOrder(order, [item.sourceProductionOrderId]))) {
    documents.push({
      docGroup: '印花',
      docType: '印花工单',
      docNo: workOrder.printOrderNo,
      objectType: 'PRINT_WORK_ORDER',
      sourceDomain: 'PFOS',
      statusText: PRINT_WORK_ORDER_STATUS_LABEL[workOrder.status],
      ownerRole: '工厂',
      routePath: `/fcs/craft/printing/work-orders?printOrderNo=${encodeURIComponent(workOrder.printOrderNo)}`,
      updatedAt: workOrder.updatedAt,
      quantityText: `${workOrder.plannedQty.toLocaleString('zh-CN')} ${workOrder.qtyUnit}`,
    })
  }

  for (const workOrder of listDyeWorkOrders().filter((item) => matchesProductionOrder(order, [item.sourceProductionOrderId]))) {
    documents.push({
      docGroup: '染色',
      docType: '染色工单',
      docNo: workOrder.dyeOrderNo,
      objectType: 'DYE_WORK_ORDER',
      sourceDomain: 'PFOS',
      statusText: DYE_WORK_ORDER_STATUS_LABEL[workOrder.status],
      ownerRole: '工厂',
      routePath: `/fcs/craft/dyeing/work-orders?dyeOrderNo=${encodeURIComponent(workOrder.dyeOrderNo)}`,
      updatedAt: workOrder.updatedAt,
      quantityText: `${workOrder.plannedQty.toLocaleString('zh-CN')} ${workOrder.qtyUnit}`,
    })
  }

  return documents
}

function buildRelatedDocuments(
  order: ProductionOrder,
  materialRequests: MaterialRequestRecord[],
  docs: WarehouseExecutionDoc[],
  progressFacts: ProgressFact[],
): RelatedDocument[] {
  const demand = findDemandById(order.demandId)
  const documents: RelatedDocument[] = [
    {
      docGroup: '生产',
      docType: '生产需求单',
      docNo: order.demandId,
      objectType: 'DEMAND',
      sourceDomain: 'FCS',
      statusText: demand ? demandStatusConfig[demand.demandStatus].label : '待确认',
      ownerRole: '跟单',
      routePath: '/fcs/production/demand-inbox',
      updatedAt: demand?.updatedAt || order.updatedAt,
      quantityText: `${order.demandSnapshot.skuLines.length} 个 SKU`,
    },
    {
      docGroup: '生产',
      docType: '生产单',
      docNo: order.productionOrderNo,
      objectType: 'PRODUCTION_ORDER',
      sourceDomain: 'FCS',
      statusText: productionOrderStatusConfig[order.status].label,
      ownerRole: '跟单',
      routePath: '/fcs/production/orders',
      updatedAt: order.updatedAt,
      quantityText: `${getOrderQuantity(order).toLocaleString('zh-CN')} 件`,
    },
  ]

  for (const request of materialRequests.slice(0, 8)) {
    documents.push({
      docGroup: '面辅料',
      docType: '物料需求',
      docNo: request.materialRequestNo,
      objectType: 'MATERIAL_PREP_ORDER',
      sourceDomain: 'FCS',
      statusText: request.requestStatus,
      ownerRole: '仓库',
      routePath: `/fcs/progress/material?po=${encodeURIComponent(order.productionOrderNo)}`,
      updatedAt: request.updatedAt,
      quantityText: `${request.lineCount} 行`,
    })
  }

  for (const doc of docs.slice(0, 8)) {
    documents.push({
      docGroup: '仓库',
      docType: doc.docType === 'ISSUE' ? '发料单' : doc.docType === 'RETURN' ? '退料单' : '仓内流转单',
      docNo: doc.docNo,
      objectType: 'WAREHOUSE_DOC',
      sourceDomain: 'WMS',
      statusText: getWarehouseNextAction(mapDocStatus(doc.status)),
      ownerRole: doc.status === 'ISSUED' ? '工厂' : '仓库',
      routePath: `/fcs/progress/material?po=${encodeURIComponent(order.productionOrderNo)}&docId=${encodeURIComponent(doc.id)}`,
      updatedAt: doc.updatedAt,
      quantityText: `${doc.lines.length} 行`,
    })
  }

  for (const fact of progressFacts.slice(0, 6)) {
    documents.push({
      docGroup: '生产',
      docType: '工艺任务',
      docNo: fact.taskNo || fact.runtimeTaskId,
      objectType: 'PROCESS_DOC',
      sourceDomain: 'PFOS',
      statusText: fact.startReadiness.canStart ? '可以处理' : fact.startReadiness.reasonText,
      ownerRole: fact.assignedFactoryName ? '工厂' : '跟单',
      routePath: `/fcs/progress/production-orders/detail?po=${encodeURIComponent(order.productionOrderNo)}`,
      updatedAt: order.updatedAt,
      quantityText: fact.scopeLabel,
    })
  }

  documents.push(...buildRuntimeRelatedDocuments(order))

  for (const doc of p1DocumentMocks.filter((item) => item.relatedProductionOrderNo === order.productionOrderNo)) {
    documents.push({
      docGroup: doc.docGroup,
      docType: doc.docType,
      docNo: doc.docNo,
      objectType: doc.objectType,
      sourceDomain: doc.sourceDomain,
      statusText: doc.statusText,
      ownerRole: doc.ownerRole,
      routePath: doc.routePath,
      updatedAt: doc.updatedAt,
      quantityText: doc.quantityText,
    })
  }

  return documents
}

function buildIssues(materials: ProductionMaterialLine[]): ProductionObjectIssue[] {
  const issues: ProductionObjectIssue[] = []
  for (const line of materials) {
    if (line.purchaseArrivalStatus === 'NOT_PURCHASED') {
      issues.push({
        issueType: '面辅料未采购',
        severity: '高',
        description: `${line.materialName} 需求 ${line.requiredQty.toLocaleString('zh-CN')} ${line.unit}，采购数量待确认。`,
        affectedObjectNo: line.materialSku,
        ownerRole: '采购',
        nextActionText: '采购确认采购安排。',
        continueText: '当前暂不能继续',
      })
      continue
    }
    if (line.purchaseArrivalStatus === 'PURCHASED_NOT_ARRIVED' || line.purchaseArrivalStatus === 'PARTIAL_ARRIVED') {
      issues.push({
        issueType: '面辅料未到仓',
        severity: '高',
        description: `已采购 ${Number(line.purchasedQty || 0).toLocaleString('zh-CN')} ${line.unit}，到仓 ${Number(line.arrivedWarehouseQty || 0).toLocaleString('zh-CN')}，预计到仓时间 ${line.estimatedWarehouseArrivalAt || '待确认'}。`,
        affectedObjectNo: line.materialSku,
        ownerRole: '采购',
        nextActionText: '采购确认预计到仓时间；到仓后仓库完成配料。',
        continueText: '当前暂不能继续',
      })
      continue
    }
    if (line.warehouseExecutionStatus === 'TO_PREPARE' || line.warehouseExecutionStatus === 'PARTIAL_PREPARED' || line.warehouseExecutionStatus === 'READY_TO_ISSUE') {
      issues.push({
        issueType: '仓库执行待处理',
        severity: '中',
        description: `${line.materialName} ${warehouseExecutionStatusLabel[line.warehouseExecutionStatus]}。`,
        affectedObjectNo: line.sourceIssueDocNo || line.materialSku,
        ownerRole: '仓库',
        nextActionText: line.nextActionText,
        continueText: '当前暂不能继续',
      })
    }
  }
  return issues
}

function getDateScore(value: string | undefined): number {
  if (!value) return 0
  const time = new Date(`${value}T00:00:00`).getTime()
  return Number.isFinite(time) ? time : 0
}

function buildContinueDecision(order: ProductionOrder, materials: ProductionMaterialLine[], issues: ProductionObjectIssue[]): ContinueDecision {
  const latestPurchaseArrivalLine = materials
    .filter((line) => line.purchaseArrivalStatus === 'PURCHASED_NOT_ARRIVED' || line.purchaseArrivalStatus === 'PARTIAL_ARRIVED')
    .sort((a, b) => getDateScore(b.estimatedWarehouseArrivalAt) - getDateScore(a.estimatedWarehouseArrivalAt))[0]

  if (latestPurchaseArrivalLine) {
    return {
      status: 'CANNOT_CONTINUE',
      displayText: '当前暂不能继续',
      reasonText: `${latestPurchaseArrivalLine.materialName} 已采购但未到仓，预计到仓时间 ${latestPurchaseArrivalLine.estimatedWarehouseArrivalAt || '待确认'}。`,
      nextActionText: '采购确认预计到仓时间；到仓后仓库完成配料。',
      ownerRole: '采购',
      ownerName: '采购',
      sourceObjectNo: latestPurchaseArrivalLine.materialSku,
      updatedAt: order.updatedAt,
    }
  }

  const topIssue = issues[0]
  if (topIssue) {
    const ownerName = topIssue.ownerRole === '采购'
      ? '采购'
      : topIssue.ownerRole === '仓库'
        ? '仓库'
        : topIssue.ownerRole
    return {
      status: topIssue.continueText === '需要确认' ? 'NEEDS_CONFIRM' : 'CANNOT_CONTINUE',
      displayText: topIssue.continueText,
      reasonText: topIssue.description,
      nextActionText: topIssue.nextActionText,
      ownerRole: topIssue.ownerRole,
      ownerName,
      sourceObjectNo: topIssue.affectedObjectNo,
      updatedAt: order.updatedAt,
    }
  }

  const issuedLine = materials.find((line) => line.warehouseExecutionStatus === 'ISSUED')
  if (issuedLine) {
    return {
      status: 'NEEDS_CONFIRM',
      displayText: '需要确认',
      reasonText: `${issuedLine.materialName} 已发料，等待工厂确认收料。`,
      nextActionText: '工厂确认签收或反馈差异。',
      ownerRole: '工厂',
      ownerName: formatProductionOrderMainFactoryName(order),
      sourceObjectNo: issuedLine.sourceIssueDocNo || issuedLine.materialSku,
      updatedAt: order.updatedAt,
    }
  }

  return {
    status: 'CAN_CONTINUE',
    displayText: '可以继续',
    reasonText: '面辅料和当前工序准备信息未发现影响继续的问题。',
    nextActionText: '下一工序按计划处理。',
    ownerRole: '工厂',
    ownerName: formatProductionOrderMainFactoryName(order),
    sourceObjectNo: order.productionOrderNo,
    updatedAt: order.updatedAt,
  }
}

function buildSourceSnapshots(order: ProductionOrder, docs: WarehouseExecutionDoc[]): SourceSnapshot[] {
  const snapshots: SourceSnapshot[] = [
    { sourceName: '生产单', sourceText: '来自 FCS 生产单 Mock 数据', updatedAt: order.updatedAt },
    { sourceName: '生产需求', sourceText: '来自 FCS 生产需求 Mock 数据', updatedAt: order.demandSnapshot.requiredDeliveryDate || order.updatedAt },
  ]
  if (purchaseArrivalMocks.some((mock) => mock.productionOrderNo === order.productionOrderNo)) {
    snapshots.push({ sourceName: '预计到仓时间', sourceText: '来自采购/物流预计到仓', updatedAt: '2026-06-30 18:20' })
  }
  if (docs.length > 0) {
    snapshots.push({ sourceName: '仓库执行', sourceText: '来自 WMS 配料/发料 Mock 数据', updatedAt: docs[0].updatedAt })
  }
  return snapshots
}

function buildFactSources(order: ProductionOrder, materials: ProductionMaterialLine[], docs: WarehouseExecutionDoc[], progressFacts: ProgressFact[]): ProductionFactSource[] {
  const purchaseLine = materials.find((line) => line.sourcePoNo)
  const warehouseLine = materials.find((line) => Number(line.arrivedWarehouseQty || 0) > 0)
  const prepLine = materials.find((line) => line.sourceMaterialRequestNo || line.sourceIssueDocNo)
  const processFact = progressFacts[0]
  const p1ProcessDoc = p1DocumentMocks.find((doc) => doc.relatedProductionOrderNo === order.productionOrderNo && doc.sourceDomain === 'PFOS')

  return [
    {
      sourceDomain: 'PMS',
      factType: '采购事实',
      sourceObjectNo: purchaseLine?.sourcePoNo || '采购单待确认',
      statusText: purchaseLine ? purchaseArrivalStatusLabel[purchaseLine.purchaseArrivalStatus] : '待确认',
      quantityText: purchaseLine ? `已采购 ${formatQty(purchaseLine.purchasedQty, purchaseLine.unit)}` : '采购数量待确认',
      ownerRole: '采购',
      nextActionText: purchaseLine?.nextActionText || '采购确认采购安排',
      updatedAt: '2026-06-30 18:20',
    },
    {
      sourceDomain: 'WMS',
      factType: '入库事实',
      sourceObjectNo: warehouseLine?.sourceInboundNo || warehouseLine?.sourceIssueDocNo || '入库单待确认',
      statusText: warehouseLine ? purchaseArrivalStatusLabel[warehouseLine.purchaseArrivalStatus] : '仓库未确认',
      quantityText: warehouseLine ? `已到仓 ${formatQty(warehouseLine.arrivedWarehouseQty, warehouseLine.unit)}` : '到仓数量待确认',
      ownerRole: '仓库',
      nextActionText: warehouseLine ? '仓库确认可用库存并安排配料' : '仓库确认收货和上架状态',
      updatedAt: docs[0]?.updatedAt || order.updatedAt,
    },
    {
      sourceDomain: 'WMS',
      factType: '配料/发料事实',
      sourceObjectNo: prepLine?.sourceIssueDocNo || prepLine?.sourceMaterialRequestNo || '配料单待确认',
      statusText: prepLine ? warehouseExecutionStatusLabel[prepLine.warehouseExecutionStatus] : '未生成配料',
      quantityText: prepLine ? `已配 ${formatQty(prepLine.preparedQty, prepLine.unit)} / 已发 ${formatQty(prepLine.issuedQty, prepLine.unit)}` : '配料数量待确认',
      ownerRole: '仓库',
      nextActionText: prepLine?.nextActionText || '仓库生成配料单并确认发料',
      updatedAt: docs[0]?.updatedAt || order.updatedAt,
    },
    {
      sourceDomain: 'PFOS',
      factType: '工艺事实',
      sourceObjectNo: processFact?.taskNo || processFact?.runtimeTaskId || p1ProcessDoc?.docNo || '工艺单据待确认',
      statusText: processFact ? (processFact.startReadiness.canStart ? '可以处理' : processFact.startReadiness.reasonText) : (p1ProcessDoc?.statusText || '待确认'),
      quantityText: processFact?.scopeLabel || p1ProcessDoc?.quantityText || `${getOrderQuantity(order).toLocaleString('zh-CN')} 件`,
      ownerRole: processFact?.assignedFactoryName || p1ProcessDoc ? '工厂' : '跟单',
      nextActionText: processFact?.startReadiness.nextAction || '工艺工厂按计划处理并同步完成数量',
      updatedAt: p1ProcessDoc?.updatedAt || order.updatedAt,
    },
  ]
}

function buildDecisionFacts(continueDecision: ContinueDecision, issues: ProductionObjectIssue[]): ProductionDecisionFact[] {
  const facts = issues.length > 0
    ? issues.slice(0, 6).map((issue) => ({
      sourceObjectNo: issue.affectedObjectNo,
      quantityText: issue.description,
      ownerRole: issue.ownerRole,
      nextActionText: issue.nextActionText,
      evidenceText: `${issue.issueType}：${issue.description}`,
    }))
    : []

  facts.unshift({
    sourceObjectNo: continueDecision.sourceObjectNo,
    quantityText: continueDecision.reasonText,
    ownerRole: continueDecision.ownerRole,
    nextActionText: continueDecision.nextActionText,
    evidenceText: continueDecision.reasonText,
  })

  return facts
}

function buildDataConflicts(order: ProductionOrder, materials: ProductionMaterialLine[]): ProductionDataConflict[] {
  const arrivedButNotPrepared = materials.find((line) =>
    line.purchaseArrivalStatus === 'ARRIVED' &&
    Number(line.arrivedWarehouseQty || 0) > 0 &&
    Number(line.preparedQty || 0) === 0,
  )
  const processDoc = p1DocumentMocks.find((doc) =>
    doc.relatedProductionOrderNo === order.productionOrderNo &&
    (doc.objectType === 'PRINT_WORK_ORDER' || doc.objectType === 'DYE_WORK_ORDER') &&
    doc.statusText.includes('回仓'),
  )

  return [
    {
      conflictType: '采购与仓库数量待核对',
      displayText: arrivedButNotPrepared
        ? '需确认：采购显示已到仓，仓库配料数量仍为 0。'
        : '需确认：采购预计到仓与仓库收货状态需要按最新单据核对。',
      sourceObjectNo: arrivedButNotPrepared?.materialSku || order.productionOrderNo,
      ownerRole: '待确认',
      nextActionText: '采购和仓库核对入库、上架、配料数量。',
    },
    {
      conflictType: '工艺回仓与配料口径',
      displayText: '需确认：印花/染色回仓批次只做追溯，是否满足生产仍以仓库配料完成数量为准。',
      sourceObjectNo: processDoc?.docNo || order.productionOrderNo,
      ownerRole: '仓库',
      nextActionText: '仓库按配料单和配料记录确认生产单是否满足。',
    },
  ]
}

function buildRelationshipGroups(
  order: ProductionOrder,
  materials: ProductionMaterialLine[],
  docs: WarehouseExecutionDoc[],
  relatedDocuments: RelatedDocument[],
  issues: ProductionObjectIssue[],
): ProductionRelationshipGroup[] {
  const p1Docs = relatedDocuments.filter((doc) => doc.sourceDomain === 'PFOS' || doc.docGroup === '面辅料')
  return [
    {
      groupName: '生产',
      nodes: [
        {
          nodeType: '生产需求',
          objectNo: order.demandId,
          title: order.demandSnapshot.spuName,
          statusText: '生产需求',
          ownerRole: '跟单',
          routePath: '/fcs/production/demand-inbox',
        },
        {
          nodeType: '生产单',
          objectNo: order.productionOrderNo,
          title: `${getOrderQuantity(order).toLocaleString('zh-CN')} 件`,
          statusText: productionOrderStatusConfig[order.status].label,
          ownerRole: '跟单',
          routePath: '/fcs/production/orders',
        },
        {
          nodeType: '商品',
          objectNo: order.demandSnapshot.spuCode,
          title: order.demandSnapshot.spuName,
          statusText: `${order.demandSnapshot.skuLines.length} 个 SKU`,
          ownerRole: '跟单',
          routePath: `/fcs/production/demand-inbox?keyword=${encodeURIComponent(order.demandSnapshot.spuCode)}`,
        },
      ],
    },
    {
      groupName: '物料',
      nodes: materials.slice(0, 4).map((line) => ({
        nodeType: materialTypeLabel[line.materialType],
        objectNo: line.materialSku,
        title: line.materialName,
        statusText: purchaseArrivalStatusLabel[line.purchaseArrivalStatus],
        ownerRole: line.ownerRole,
        routePath: `/fcs/progress/material?po=${encodeURIComponent(order.productionOrderNo)}`,
      })),
    },
    {
      groupName: '采购',
      nodes: materials.filter((line) => line.sourcePoNo).slice(0, 4).map((line) => ({
        nodeType: '采购单',
        objectNo: line.sourcePoNo || '-',
        title: line.materialName,
        statusText: purchaseArrivalStatusLabel[line.purchaseArrivalStatus],
        ownerRole: '采购',
        routePath: '/pms/purchase-orders',
      })),
    },
    {
      groupName: '仓库',
      nodes: [
        ...docs.slice(0, 3).map((doc) => ({
          nodeType: doc.docType === 'ISSUE' ? '发料单' : '仓库单据',
          objectNo: doc.docNo,
          title: doc.processNameZh,
          statusText: getWarehouseNextAction(mapDocStatus(doc.status)),
          ownerRole: doc.status === 'ISSUED' ? '工厂' as const : '仓库' as const,
          routePath: `/fcs/progress/material?po=${encodeURIComponent(order.productionOrderNo)}&docId=${encodeURIComponent(doc.id)}`,
        })),
        ...p1Docs.filter((doc) => doc.docGroup === '面辅料').slice(0, 3).map((doc) => ({
          nodeType: doc.docType,
          objectNo: doc.docNo,
          title: doc.quantityText,
          statusText: doc.statusText,
          ownerRole: doc.ownerRole,
          routePath: doc.routePath,
        })),
      ],
    },
    {
      groupName: 'PFOS',
      nodes: p1Docs.filter((doc) => doc.sourceDomain === 'PFOS').slice(0, 5).map((doc) => ({
        nodeType: doc.docType,
        objectNo: doc.docNo,
        title: doc.quantityText,
        statusText: doc.statusText,
        ownerRole: doc.ownerRole,
        routePath: doc.routePath,
      })),
    },
    {
      groupName: '异常',
      nodes: issues.slice(0, 4).map((issue) => ({
        nodeType: issue.issueType,
        objectNo: issue.affectedObjectNo,
        title: issue.description,
        statusText: issue.continueText,
        ownerRole: issue.ownerRole,
        routePath: `/fcs/progress/material?po=${encodeURIComponent(order.productionOrderNo)}`,
      })),
    },
  ]
}

function buildRelationshipEdges(order: ProductionOrder, materials: ProductionMaterialLine[], relatedDocuments: RelatedDocument[], issues: ProductionObjectIssue[]): ProductionRelationshipEdge[] {
  const firstMaterial = materials[0]?.materialSku || '物料待确认'
  const firstPurchase = materials.find((line) => line.sourcePoNo)?.sourcePoNo || '采购单待确认'
  const firstPrep = relatedDocuments.find((doc) => doc.docGroup === '面辅料' && doc.docType.includes('配料'))?.docNo || '配料单待确认'
  const firstIssue = relatedDocuments.find((doc) => doc.docType.includes('发料'))?.docNo || '发料单待确认'
  const cutDoc = relatedDocuments.find((doc) => doc.docType === '裁片单')?.docNo || '裁片单待确认'
  const printDoc = relatedDocuments.find((doc) => doc.docType.includes('印花工单'))?.docNo || '印花工单待确认'
  const dyeDoc = relatedDocuments.find((doc) => doc.docType.includes('染色工单'))?.docNo || '染色工单待确认'
  const handoverDoc = relatedDocuments.find((doc) => doc.docType === '交出单')?.docNo || '交出单待确认'
  const issue = issues[0]?.affectedObjectNo || '异常待确认'

  return [
    { from: order.demandId, to: order.productionOrderNo, relationText: '需求生成生产执行对象' },
    { from: order.productionOrderNo, to: order.demandSnapshot.spuCode, relationText: '生产单关联商品' },
    { from: order.productionOrderNo, to: firstMaterial, relationText: 'BOM 需求' },
    { from: firstMaterial, to: firstPurchase, relationText: '物料采购来源' },
    { from: firstMaterial, to: firstPrep, relationText: '仓库配料来源' },
    { from: firstPrep, to: firstIssue, relationText: '配料后发料' },
    { from: order.productionOrderNo, to: cutDoc, relationText: '裁片工艺执行' },
    { from: order.productionOrderNo, to: printDoc, relationText: '印花工艺执行' },
    { from: order.productionOrderNo, to: dyeDoc, relationText: '染色工艺执行' },
    { from: cutDoc, to: handoverDoc, relationText: '裁片完成与交接来源' },
    { from: issue, to: order.productionOrderNo, relationText: '异常影响生产单' },
  ]
}

function buildProductionTimeline(order: ProductionOrder, continueDecision: ContinueDecision, issues: ProductionObjectIssue[]): ProductionTimelineNode[] {
  const hasIssue = issues.length > 0
  return [
    { nodeName: '需求接收', plannedAt: order.createdAt || order.updatedAt, actualAt: order.createdAt || order.updatedAt, ownerRole: '跟单', statusText: '已完成', evidenceObjectNo: order.demandId },
    { nodeName: '生产单生成', plannedAt: order.updatedAt, actualAt: order.createdAt || order.updatedAt, ownerRole: '跟单', statusText: '已完成', evidenceObjectNo: order.productionOrderNo },
    { nodeName: '采购下单', plannedAt: '2026-06-28', actualAt: '2026-06-28', ownerRole: '采购', statusText: '已完成', evidenceObjectNo: 'PO-33133' },
    { nodeName: '预计到仓', plannedAt: '2026-07-02', actualAt: '待确认', ownerRole: '采购', statusText: continueDecision.displayText, evidenceObjectNo: continueDecision.sourceObjectNo, isCurrent: continueDecision.ownerRole === '采购', isIssue: hasIssue },
    { nodeName: '仓库配料', plannedAt: '2026-07-02', actualAt: '待确认', ownerRole: '仓库', statusText: '待处理', evidenceObjectNo: 'MPO-202603-0001', isCurrent: continueDecision.ownerRole === '仓库' },
    { nodeName: '工厂签收', plannedAt: '2026-07-03', actualAt: '待确认', ownerRole: '工厂', statusText: '待处理', evidenceObjectNo: 'PICK-202603-0001' },
    { nodeName: '裁片/印花/染色', plannedAt: order.demandSnapshot.requiredDeliveryDate || '待确认', actualAt: '待确认', ownerRole: '工厂', statusText: '待处理', evidenceObjectNo: 'PRINT-WO-202603-0001' },
  ]
}

function buildMaterialFlowTimeline(order: ProductionOrder, materials: ProductionMaterialLine[]): MaterialFlowTimelineNode[] {
  const line = materials.find((item) => item.shortageQty > 0) || materials[0]
  if (!line) return []
  return [
    { stageName: '需求', sourceObjectNo: order.productionOrderNo, quantityText: `需求 ${formatQty(line.requiredQty, line.unit)}`, statusText: '已生成需求', ownerRole: '跟单', eventAt: order.updatedAt },
    { stageName: '采购', sourceObjectNo: line.sourcePoNo || '采购单待确认', quantityText: `已采购 ${formatQty(line.purchasedQty, line.unit)}`, statusText: purchaseArrivalStatusLabel[line.purchaseArrivalStatus], ownerRole: '采购', eventAt: '2026-06-28' },
    { stageName: '到仓', sourceObjectNo: line.sourceInboundNo || '入库单待确认', quantityText: `已到仓 ${formatQty(line.arrivedWarehouseQty, line.unit)}`, statusText: line.estimatedWarehouseArrivalAt ? `预计到仓时间 ${line.estimatedWarehouseArrivalAt}` : purchaseArrivalStatusLabel[line.purchaseArrivalStatus], ownerRole: '仓库', eventAt: line.estimatedWarehouseArrivalAt || '待确认' },
    { stageName: '配料', sourceObjectNo: line.sourceMaterialRequestNo || 'MPO-202603-0001', quantityText: `已配 ${formatQty(line.preparedQty, line.unit)}`, statusText: warehouseExecutionStatusLabel[line.warehouseExecutionStatus], ownerRole: '仓库', eventAt: '待确认' },
    { stageName: '发料', sourceObjectNo: line.sourceIssueDocNo || 'PICK-202603-0001', quantityText: `已发 ${formatQty(line.issuedQty, line.unit)}`, statusText: line.issuedQty ? '已发料' : '待发料', ownerRole: '仓库', eventAt: '待确认' },
    { stageName: '签收', sourceObjectNo: line.sourceIssueDocNo || 'PICK-202603-0001', quantityText: `工厂已签收 ${formatQty(line.factoryReceivedQty, line.unit)}`, statusText: line.factoryReceivedQty ? '已签收' : '待签收', ownerRole: '工厂', eventAt: '待确认' },
    { stageName: '退补料', sourceObjectNo: '退补料记录待确认', quantityText: '暂无退补料数量', statusText: '无异常记录', ownerRole: '仓库', eventAt: '待确认' },
  ]
}

function buildResponsibilityAnalysis(issues: ProductionObjectIssue[], dataConflicts: ProductionDataConflict[]): ResponsibilityAnalysisItem[] {
  const issueItems = issues.slice(0, 5).map((issue) => ({
    issueType: issue.issueType,
    affectedScopeText: issue.description,
    ownerRole: issue.ownerRole,
    evidenceObjectNo: issue.affectedObjectNo,
    evidenceText: issue.description,
    nextActionText: issue.nextActionText,
    recoveryText: issue.description.includes('预计到仓时间') ? issue.description.split('预计到仓时间 ')[1]?.replace('。', '') || '待确认' : '待确认',
  }))

  const conflictItems = dataConflicts.map((conflict) => ({
    issueType: conflict.conflictType,
    affectedScopeText: conflict.displayText,
    ownerRole: conflict.ownerRole,
    evidenceObjectNo: conflict.sourceObjectNo,
    evidenceText: conflict.displayText,
    nextActionText: conflict.nextActionText,
    recoveryText: '需人工确认',
  }))

  return [...issueItems, ...conflictItems]
}

function buildEmptyOverviewExtensions(continueDecision: ContinueDecision): Pick<
  ProductionObjectOverview,
  'factSources' | 'decisionFacts' | 'dataConflicts' | 'relationshipGroups' | 'relationshipEdges' | 'productionTimeline' | 'materialFlowTimeline' | 'responsibilityAnalysis'
> {
  return {
    factSources: [
      {
        sourceDomain: 'FCS',
        factType: '生产需求事实',
        sourceObjectNo: continueDecision.sourceObjectNo,
        statusText: continueDecision.displayText,
        quantityText: continueDecision.reasonText,
        ownerRole: continueDecision.ownerRole,
        nextActionText: continueDecision.nextActionText,
        updatedAt: continueDecision.updatedAt,
      },
    ],
    decisionFacts: [
      {
        sourceObjectNo: continueDecision.sourceObjectNo,
        quantityText: continueDecision.reasonText,
        ownerRole: continueDecision.ownerRole,
        nextActionText: continueDecision.nextActionText,
        evidenceText: continueDecision.reasonText,
      },
    ],
    dataConflicts: [],
    relationshipGroups: [
      {
        groupName: '生产',
        nodes: [
          {
            nodeType: '生产需求',
            objectNo: continueDecision.sourceObjectNo,
            title: continueDecision.reasonText,
            statusText: continueDecision.displayText,
            ownerRole: continueDecision.ownerRole,
            routePath: '/fcs/production/demand-inbox',
          },
        ],
      },
      { groupName: '物料', nodes: [] },
      { groupName: '采购', nodes: [] },
      { groupName: '仓库', nodes: [] },
      { groupName: 'PFOS', nodes: [] },
      { groupName: '异常', nodes: [] },
    ],
    relationshipEdges: [],
    productionTimeline: [
      {
        nodeName: '需求接收',
        plannedAt: continueDecision.updatedAt,
        actualAt: continueDecision.updatedAt,
        ownerRole: continueDecision.ownerRole,
        statusText: continueDecision.displayText,
        evidenceObjectNo: continueDecision.sourceObjectNo,
        isCurrent: true,
      },
    ],
    materialFlowTimeline: [],
    responsibilityAnalysis: [],
  }
}

function getDemandSkuSummary(demand: ProductionDemand): string {
  const colors = unique(demand.skuLines.map((line) => line.color))
  const sizes = unique(demand.skuLines.map((line) => line.size))
  return `${demand.skuLines.length} 个 SKU，颜色 ${colors.slice(0, 3).join('、') || '-'}，尺码 ${sizes.slice(0, 4).join('、') || '-'}`
}

function buildDemandOnlyOverview(objectId: string): ProductionObjectOverview | null {
  const demand = resolveDemand(objectId)
  if (!demand) return null
  const summary: ProductionObjectSummary = {
    productionOrderNo: '尚未生成',
    demandNo: demand.demandId,
    legacyOrderNo: demand.legacyOrderNo,
    spu: demand.spuCode,
    skuSummary: getDemandSkuSummary(demand),
    productTitle: demand.spuName,
    imageUrl: demand.imageUrl,
    planQuantity: demand.requiredQtyTotal,
    unit: '件',
    currentStage: demandStatusConfig[demand.demandStatus].label,
    mainFactoryName: '待确认',
    merchandiser: demand.merchandiserName,
    plannedDeliveryDate: demand.requiredDeliveryDate || '待确认',
    updatedAt: demand.updatedAt,
  }
  const continueDecision: ContinueDecision = {
    status: 'NEEDS_CONFIRM',
    displayText: '需要确认',
    reasonText: '生产需求尚未生成生产单。',
    nextActionText: '跟单确认技术包后生成生产单。',
    ownerRole: '跟单',
    ownerName: demand.merchandiserName,
    sourceObjectNo: demand.demandId,
    updatedAt: demand.updatedAt,
  }

  return {
    objectKey: objectId,
    objectType: 'DEMAND',
    title: `生产需求｜${demand.demandId}`,
    summary,
    executionSummary: [],
    executionOverview: {
      materialIssues: [],
      taskFactories: [],
      keyTimes: [],
      quantityQuality: [],
    },
    continueDecision,
    materials: [],
    progressNodes: [
      {
        nodeId: `${demand.demandId}-receive`,
        nodeName: '需求接收',
        status: demandStatusConfig[demand.demandStatus].label,
        ownerRole: '跟单',
        plannedAt: demand.requiredDeliveryDate || '待确认',
        actualAt: demand.createdAt,
        relatedDocNo: demand.demandId,
        quantityText: `${demand.requiredQtyTotal.toLocaleString('zh-CN')} 件`,
        description: demand.constraintsNote || '等待生成生产单。',
      },
    ],
    relatedDocuments: [
      {
        docGroup: '生产',
        docType: '生产需求单',
        docNo: demand.demandId,
        objectType: 'DEMAND',
        sourceDomain: 'FCS',
        statusText: demandStatusConfig[demand.demandStatus].label,
        ownerRole: '跟单',
        routePath: '/fcs/production/demand-inbox',
        updatedAt: demand.updatedAt,
        quantityText: `${demand.skuLines.length} 个 SKU`,
      },
    ],
    issues: [
      {
        issueType: '待生成生产单',
        severity: '中',
        description: '该生产需求还没有生成生产单。',
        affectedObjectNo: demand.demandId,
        ownerRole: '跟单',
        nextActionText: '跟单确认技术包后生成生产单。',
        continueText: '需要确认',
      },
    ],
    sourceSnapshots: [
      { sourceName: '生产需求', sourceText: '来自 FCS 生产需求 Mock 数据', updatedAt: demand.updatedAt },
    ],
    ...buildEmptyOverviewExtensions(continueDecision),
  }
}

export function getProductionObjectOverview(objectType: ProductionObjectType, objectId: string): ProductionObjectOverview | null {
  const order = resolveOrder(objectType, objectId)
  if (!order && objectType === 'DEMAND') return buildDemandOnlyOverview(objectId)
  if (!order) return null
  const materialRequests = listMaterialRequestsByOrder(order.productionOrderNo)
  const docs = listWarehouseExecutionDocsByOrder(order.productionOrderNo)
  const materials = buildMaterialLines(order)
  const progressFacts = getProgressFactsByOrder(order.productionOrderNo)
  const issues = buildIssues(materials)
  const continueDecision = buildContinueDecision(order, materials, issues)
  const relatedDocuments = buildRelatedDocuments(order, materialRequests, docs, progressFacts)
  const factSources = buildFactSources(order, materials, docs, progressFacts)
  const decisionFacts = buildDecisionFacts(continueDecision, issues)
  const dataConflicts = buildDataConflicts(order, materials)
  const summary: ProductionObjectSummary = {
    productionOrderNo: order.productionOrderNo,
    demandNo: order.demandId,
    legacyOrderNo: order.legacyOrderNo,
    spu: order.demandSnapshot.spuCode,
    skuSummary: getSkuSummary(order),
    productTitle: order.demandSnapshot.spuName,
    imageUrl: order.techPackSnapshot?.coverImageUrl || '',
    planQuantity: getOrderQuantity(order),
    unit: '件',
    currentStage: productionOrderStatusConfig[order.status].label,
    mainFactoryName: formatProductionOrderMainFactoryName(order),
    merchandiser: order.demandSnapshot.merchandiserName,
    plannedDeliveryDate: order.demandSnapshot.requiredDeliveryDate || '待确认',
    updatedAt: order.updatedAt,
  }

  return {
    objectKey: objectId,
    objectType,
    title: `${OBJECT_TYPE_LABEL[objectType]}｜${order.productionOrderNo}`,
    summary,
    executionSummary: getProductionExecutionSummaryBlocks(order.ledgerDetails),
    executionOverview: order.ledgerDetails,
    continueDecision,
    materials,
    progressNodes: buildProgressNodes(order, progressFacts),
    relatedDocuments,
    issues,
    sourceSnapshots: buildSourceSnapshots(order, docs),
    factSources,
    decisionFacts,
    dataConflicts,
    relationshipGroups: buildRelationshipGroups(order, materials, docs, relatedDocuments, issues),
    relationshipEdges: buildRelationshipEdges(order, materials, relatedDocuments, issues),
    productionTimeline: buildProductionTimeline(order, continueDecision, issues),
    materialFlowTimeline: buildMaterialFlowTimeline(order, materials),
    responsibilityAnalysis: buildResponsibilityAnalysis(issues, dataConflicts),
  }
}

function buildOrderIndex(order: ProductionOrder): ProductionObjectSearchIndex {
  return {
    id: `PRODUCTION_ORDER-${order.productionOrderNo}`,
    objectType: 'PRODUCTION_ORDER',
    primaryNo: order.productionOrderNo,
    secondaryNo: order.demandId,
    displayTitle: order.demandSnapshot.spuName,
    keywords: unique([
      order.productionOrderId,
      order.productionOrderNo,
      order.demandId,
      order.legacyOrderNo,
      order.demandSnapshot.spuCode,
      order.demandSnapshot.spuName,
      order.mainFactorySnapshot.name,
      ...order.demandSnapshot.skuLines.map((line) => line.skuCode),
    ]),
    relatedProductionOrderNo: order.productionOrderNo,
    relatedDemandNo: order.demandId,
    statusText: productionOrderStatusConfig[order.status].label,
    ownerRole: '跟单',
    sourceDomain: 'FCS',
    updatedAt: order.updatedAt,
    defaultTab: getDefaultTabForObjectType('PRODUCTION_ORDER'),
    highlightKey: makeHighlightKey('PRODUCTION_ORDER', order.productionOrderNo),
  }
}

function buildDemandIndex(demand: ProductionDemand): ProductionObjectSearchIndex {
  const order = findOrderByNo(demand.productionOrderId) ?? findOrderByNo(demand.demandId)
  return {
    id: `DEMAND-${demand.demandId}`,
    objectType: 'DEMAND',
    primaryNo: demand.demandId,
    secondaryNo: demand.legacyOrderNo,
    displayTitle: demand.spuName,
    keywords: unique([demand.demandId, demand.legacyOrderNo, demand.spuCode, demand.spuName, ...demand.skuLines.map((line) => line.skuCode)]),
    relatedProductionOrderNo: order?.productionOrderNo,
    relatedDemandNo: demand.demandId,
    statusText: demandStatusConfig[demand.demandStatus].label,
    ownerRole: '跟单',
    sourceDomain: 'FCS',
    updatedAt: demand.updatedAt,
    defaultTab: getDefaultTabForObjectType('DEMAND'),
    highlightKey: makeHighlightKey('DEMAND', demand.demandId),
  }
}

function buildMaterialIndexes(order: ProductionOrder): ProductionObjectSearchIndex[] {
  return buildMaterialLines(order).map((line) => ({
    id: `MATERIAL-${order.productionOrderNo}-${line.materialSku}`,
    objectType: 'MATERIAL',
    primaryNo: line.materialSku,
    secondaryNo: order.productionOrderNo,
    displayTitle: line.materialName,
    keywords: unique([
      line.materialSku,
      line.materialName,
      line.spec,
      materialTypeLabel[line.materialType],
      purchaseArrivalStatusLabel[line.purchaseArrivalStatus],
      warehouseExecutionStatusLabel[line.warehouseExecutionStatus],
      line.nextActionText,
      line.shortageQty > 0 ? '缺料' : undefined,
      line.warehouseExecutionStatus === 'READY_TO_ISSUE' ? '待领料' : undefined,
      line.warehouseExecutionStatus === 'ISSUED' || line.warehouseExecutionStatus === 'RECEIVED' ? '已领料' : undefined,
      order.productionOrderNo,
      order.demandId,
      order.demandSnapshot.spuCode,
    ]),
    relatedProductionOrderNo: order.productionOrderNo,
    relatedDemandNo: order.demandId,
    statusText: getMaterialSearchStatus(line),
    ownerRole: line.ownerRole,
    sourceDomain: line.sourcePoNo ? 'PMS' : 'WMS',
    updatedAt: order.updatedAt,
    defaultTab: getDefaultTabForObjectType('MATERIAL'),
    highlightKey: makeHighlightKey('MATERIAL', line.materialSku),
  }))
}

function buildWarehouseIndexes(order: ProductionOrder): ProductionObjectSearchIndex[] {
  return listWarehouseExecutionDocsByOrder(order.productionOrderNo).map((doc) => ({
    id: `WAREHOUSE_DOC-${doc.id}`,
    objectType: 'WAREHOUSE_DOC',
    primaryNo: doc.docNo,
    secondaryNo: order.productionOrderNo,
    displayTitle: doc.processNameZh,
    keywords: unique([doc.id, doc.docNo, doc.materialRequestNo, order.productionOrderNo, order.demandId, doc.processNameZh, doc.scopeLabel]),
    relatedProductionOrderNo: order.productionOrderNo,
    relatedDemandNo: order.demandId,
    statusText: getWarehouseNextAction(mapDocStatus(doc.status)),
    ownerRole: doc.status === 'ISSUED' ? '工厂' : '仓库',
    sourceDomain: 'WMS',
    updatedAt: doc.updatedAt,
    defaultTab: getDefaultTabForObjectType('WAREHOUSE_DOC'),
    highlightKey: makeHighlightKey('WAREHOUSE_DOC', doc.docNo),
  }))
}

function buildProcessIndexes(order: ProductionOrder): ProductionObjectSearchIndex[] {
  return getProgressFactsByOrder(order.productionOrderNo).slice(0, 12).map((fact) => ({
    id: `PROCESS_DOC-${fact.runtimeTaskId}`,
    objectType: 'PROCESS_DOC',
    primaryNo: fact.taskNo || fact.runtimeTaskId,
    secondaryNo: order.productionOrderNo,
    displayTitle: fact.processNameZh || fact.taskTypeLabel || '工艺任务',
    keywords: unique([fact.runtimeTaskId, fact.taskNo, fact.processNameZh, fact.taskTypeLabel, getTaskTypeLabel(fact.taskTypeCode as never), order.productionOrderNo]),
    relatedProductionOrderNo: order.productionOrderNo,
    relatedDemandNo: order.demandId,
    statusText: fact.startReadiness.canStart ? '可以处理' : fact.startReadiness.reasonText,
    ownerRole: fact.assignedFactoryName ? '工厂' : '跟单',
    sourceDomain: 'PFOS',
    updatedAt: order.updatedAt,
    defaultTab: getDefaultTabForObjectType('PROCESS_DOC'),
    highlightKey: makeHighlightKey('PROCESS_DOC', fact.taskNo || fact.runtimeTaskId),
  }))
}

function buildMaterialPrepIndexes(): ProductionObjectSearchIndex[] {
  const rows: ProductionObjectSearchIndex[] = []
  for (const projection of listMaterialPrepOrderProjections()) {
    const order = findOrderByNo(projection.order.productionOrderNo)
    const relatedProductionOrderNo = order?.productionOrderNo || projection.order.productionOrderNo
    const category = projection.lines[0] ? classifyPrepLineType(projection.lines[0]) : '其他配料'
    const routePath = `${getMaterialPrepCategoryPath(category)}?prepOrderId=${encodeURIComponent(projection.order.prepOrderId)}`

    rows.push({
      id: `MATERIAL_PREP_ORDER-${projection.order.prepOrderNo}`,
      objectType: 'MATERIAL_PREP_ORDER',
      primaryNo: projection.order.prepOrderNo,
      secondaryNo: projection.order.productionOrderNo,
      displayTitle: `${projection.order.styleName}｜${category}`,
      keywords: unique([
        projection.order.prepOrderId,
        projection.order.prepOrderNo,
        projection.order.productionOrderId,
        projection.order.productionOrderNo,
        projection.order.styleNo,
        projection.order.styleName,
        projection.order.spu,
        category,
        ...projection.lines.flatMap((line) => [line.materialSku, line.materialName, line.upstreamDocumentNo]),
      ]),
      relatedProductionOrderNo,
      relatedDemandNo: order?.demandId,
      statusText: materialPrepStatusLabelMap[projection.order.overallPrepStatus],
      ownerRole: '仓库',
      sourceDomain: 'WMS',
      docGroup: '面辅料',
      routePath,
      quantityText: `${projection.lineCount} 行物料`,
      updatedAt: projection.latestOperatedAt || projection.order.createdAt,
      defaultTab: getDefaultTabForObjectType('MATERIAL_PREP_ORDER'),
      highlightKey: makeHighlightKey('MATERIAL_PREP_ORDER', projection.order.prepOrderNo),
    })

    for (const record of projection.prepRecords) {
      const line = projection.lines.find((item) => item.prepLineId === record.prepLineId)
      rows.push({
        id: `MATERIAL_PREP_RECORD-${record.prepRecordId}`,
        objectType: 'MATERIAL_PREP_RECORD',
        primaryNo: record.prepRecordId,
        secondaryNo: projection.order.prepOrderNo,
        displayTitle: `${line?.materialName || '配料记录'}｜${projection.order.styleName}`,
        keywords: unique([
          record.prepRecordId,
          record.batchNo,
          record.prepOrderId,
          projection.order.prepOrderNo,
          projection.order.productionOrderNo,
          line?.materialSku,
          line?.materialName,
        ]),
        relatedProductionOrderNo,
        relatedDemandNo: order?.demandId,
        statusText: materialPrepRecordStatusLabelMap[record.recordStatus],
        ownerRole: '仓库',
        sourceDomain: 'WMS',
        docGroup: '面辅料',
        routePath: `${routePath}&detailTab=records`,
        quantityText: formatQty(record.preparedQty, line?.unit || '件'),
        updatedAt: record.confirmedAt || record.preparedAt,
        defaultTab: getDefaultTabForObjectType('MATERIAL_PREP_RECORD'),
        highlightKey: makeHighlightKey('MATERIAL_PREP_RECORD', record.prepRecordId),
      })
    }

    for (const record of projection.pickupRecords) {
      const line = projection.lines.find((item) => item.prepLineId === record.prepLineId)
      rows.push({
        id: `MATERIAL_PICKUP_RECORD-${record.pickupRecordId}`,
        objectType: 'MATERIAL_PICKUP_RECORD',
        primaryNo: record.pickupRecordId,
        secondaryNo: record.prepRecordId,
        displayTitle: `${line?.materialName || '领料记录'}｜${projection.order.styleName}`,
        keywords: unique([
          record.pickupRecordId,
          record.prepRecordId,
          record.prepOrderId,
          projection.order.prepOrderNo,
          projection.order.productionOrderNo,
          record.waitProcessLedgerEventId,
          line?.materialSku,
          line?.materialName,
        ]),
        relatedProductionOrderNo,
        relatedDemandNo: order?.demandId,
        statusText: record.pickupStatus,
        ownerRole: '工厂',
        sourceDomain: 'WMS',
        docGroup: '面辅料',
        routePath: `${routePath}&detailTab=pickup`,
        quantityText: formatQty(record.pickedQty, line?.unit || '件'),
        updatedAt: record.pickedAt,
        defaultTab: getDefaultTabForObjectType('MATERIAL_PICKUP_RECORD'),
        highlightKey: makeHighlightKey('MATERIAL_PICKUP_RECORD', record.pickupRecordId),
      })
    }

    for (const record of projection.rejectRecords) {
      const line = projection.lines.find((item) => item.prepLineId === record.prepLineId)
      rows.push({
        id: `MATERIAL_PICKUP_RECORD-${record.rejectId}`,
        objectType: 'MATERIAL_PICKUP_RECORD',
        primaryNo: record.rejectId,
        secondaryNo: record.prepRecordId,
        displayTitle: `${line?.materialName || '配料打回记录'}｜${projection.order.styleName}`,
        keywords: unique([
          record.rejectId,
          record.prepRecordId,
          record.prepOrderId,
          projection.order.prepOrderNo,
          projection.order.productionOrderNo,
          record.rejectReason,
          record.rejectDetail,
          line?.materialSku,
          line?.materialName,
        ]),
        relatedProductionOrderNo,
        relatedDemandNo: order?.demandId,
        statusText: materialPrepRecordStatusLabelMap[record.afterStatus],
        ownerRole: '仓库',
        sourceDomain: 'WMS',
        docGroup: '面辅料',
        routePath: `${routePath}&detailTab=pickup`,
        quantityText: line?.materialName || record.rejectReason,
        updatedAt: record.rejectedAt,
        defaultTab: getDefaultTabForObjectType('MATERIAL_PICKUP_RECORD'),
        highlightKey: makeHighlightKey('MATERIAL_PICKUP_RECORD', record.rejectId),
      })
    }
  }
  return rows
}

function buildPrintWorkOrderIndexes(): ProductionObjectSearchIndex[] {
  return listPrintWorkOrders().map((workOrder) => {
    const order = findOrderByAny([workOrder.sourceProductionOrderId, workOrder.sourceProductionOrderNo])
    return {
      id: `PRINT_WORK_ORDER-${workOrder.printOrderNo}`,
      objectType: 'PRINT_WORK_ORDER',
      primaryNo: workOrder.printOrderNo,
      secondaryNo: workOrder.sourceProductionOrderNo || workOrder.sourceProductionOrderId,
      displayTitle: `${workOrder.patternNo}｜${workOrder.printFactoryName}`,
      keywords: unique([
        workOrder.printOrderId,
        workOrder.printOrderNo,
        workOrder.taskId,
        workOrder.taskNo,
        workOrder.patternNo,
        workOrder.materialSku,
        workOrder.materialColor,
        workOrder.handoverOrderNo,
        workOrder.printFactoryName,
        workOrder.sourceProductionOrderId,
        workOrder.sourceProductionOrderNo,
        workOrder.stockMaterialId,
        workOrder.stockMaterialName,
      ]),
      relatedProductionOrderNo: order?.productionOrderNo || workOrder.sourceProductionOrderNo,
      relatedDemandNo: order?.demandId,
      statusText: PRINT_WORK_ORDER_STATUS_LABEL[workOrder.status],
      ownerRole: '工厂',
      sourceDomain: 'PFOS',
      docGroup: '印花',
      routePath: `/fcs/craft/printing/work-orders?printOrderNo=${encodeURIComponent(workOrder.printOrderNo)}`,
      quantityText: `${workOrder.plannedQty.toLocaleString('zh-CN')} ${workOrder.qtyUnit}`,
      updatedAt: workOrder.updatedAt,
      defaultTab: getDefaultTabForObjectType('PRINT_WORK_ORDER'),
      highlightKey: makeHighlightKey('PRINT_WORK_ORDER', workOrder.printOrderNo),
    } satisfies ProductionObjectSearchIndex
  })
}

function buildDyeWorkOrderIndexes(): ProductionObjectSearchIndex[] {
  return listDyeWorkOrders().map((workOrder) => {
    const order = findOrderByAny([workOrder.sourceProductionOrderId, workOrder.sourceProductionOrderNo])
    return {
      id: `DYE_WORK_ORDER-${workOrder.dyeOrderNo}`,
      objectType: 'DYE_WORK_ORDER',
      primaryNo: workOrder.dyeOrderNo,
      secondaryNo: workOrder.sourceProductionOrderNo || workOrder.sourceProductionOrderId,
      displayTitle: `${workOrder.rawMaterialSku}｜${workOrder.dyeFactoryName}`,
      keywords: unique([
        workOrder.dyeOrderId,
        workOrder.dyeOrderNo,
        workOrder.taskId,
        workOrder.taskNo,
        workOrder.rawMaterialSku,
        workOrder.targetColor,
        workOrder.handoverOrderNo,
        workOrder.dyeFactoryName,
        workOrder.sourceProductionOrderId,
        workOrder.sourceProductionOrderNo,
        workOrder.stockMaterialId,
        workOrder.stockMaterialName,
      ]),
      relatedProductionOrderNo: order?.productionOrderNo || workOrder.sourceProductionOrderNo,
      relatedDemandNo: order?.demandId,
      statusText: DYE_WORK_ORDER_STATUS_LABEL[workOrder.status],
      ownerRole: '工厂',
      sourceDomain: 'PFOS',
      docGroup: '染色',
      routePath: `/fcs/craft/dyeing/work-orders?dyeOrderNo=${encodeURIComponent(workOrder.dyeOrderNo)}`,
      quantityText: `${workOrder.plannedQty.toLocaleString('zh-CN')} ${workOrder.qtyUnit}`,
      updatedAt: workOrder.updatedAt,
      defaultTab: getDefaultTabForObjectType('DYE_WORK_ORDER'),
      highlightKey: makeHighlightKey('DYE_WORK_ORDER', workOrder.dyeOrderNo),
    } satisfies ProductionObjectSearchIndex
  })
}

function buildP1DocumentIndexes(): ProductionObjectSearchIndex[] {
  return p1DocumentMocks.map((doc) => {
    const order = findOrderByNo(doc.relatedProductionOrderNo)
    return {
      id: `${doc.objectType}-${doc.docNo}`,
      objectType: doc.objectType,
      primaryNo: doc.docNo,
      secondaryNo: doc.secondaryNo,
      displayTitle: doc.displayTitle,
      keywords: unique([
        doc.docNo,
        doc.secondaryNo,
        doc.relatedProductionOrderNo,
        doc.displayTitle,
        doc.docType,
        doc.factoryName,
        doc.issueType,
        ...doc.keywords,
      ]),
      relatedProductionOrderNo: doc.relatedProductionOrderNo,
      relatedDemandNo: order?.demandId,
      statusText: doc.statusText,
      ownerRole: doc.ownerRole,
      sourceDomain: doc.sourceDomain,
      docGroup: doc.docGroup,
      routePath: doc.routePath,
      quantityText: doc.quantityText,
      updatedAt: doc.updatedAt,
      defaultTab: getDefaultTabForObjectType(doc.objectType),
      highlightKey: makeHighlightKey(doc.objectType, doc.docNo),
    }
  })
}

function buildPostFinishingQcIndexes(): ProductionObjectSearchIndex[] {
  const qcOrders = listPostFinishingQcOrderEntities()
  const recheckOrders = listPostFinishingRecheckOrderEntities()
  const qcOrdersByPostTask = new Map<string, typeof qcOrders>()
  const rows: ProductionObjectSearchIndex[] = []

  for (const qcOrder of qcOrders) {
    const order = findOrderByNo(qcOrder.productionOrderNo)
    for (const key of unique([qcOrder.postTaskId, qcOrder.postTaskNo])) {
      qcOrdersByPostTask.set(key, [...(qcOrdersByPostTask.get(key) || []), qcOrder])
    }
    rows.push({
      id: `QC_ORDER-${qcOrder.qcOrderNo}`,
      objectType: 'QC_ORDER',
      primaryNo: qcOrder.qcOrderNo,
      secondaryNo: qcOrder.productionOrderNo,
      displayTitle: '后道质检单',
      keywords: unique([
        qcOrder.qcOrderId,
        qcOrder.qcOrderNo,
        qcOrder.productionOrderNo,
        qcOrder.postTaskId,
        qcOrder.postTaskNo,
        qcOrder.sourceTaskId,
        qcOrder.sourceTaskNo,
        qcOrder.spuCode,
        qcOrder.spuName,
      ]),
      relatedProductionOrderNo: qcOrder.productionOrderNo,
      relatedDemandNo: order?.demandId,
      statusText: qcOrder.qcStatus,
      ownerRole: '工厂',
      sourceDomain: 'PFOS',
      docGroup: '仓库',
      routePath: `/fcs/craft/post-finishing/qc-orders?qcOrderNo=${encodeURIComponent(qcOrder.qcOrderNo)}`,
      quantityText: `${qcOrder.inspectedGarmentQty.toLocaleString('zh-CN')} 件`,
      defaultTab: getDefaultTabForObjectType('QC_ORDER'),
      highlightKey: makeHighlightKey('QC_ORDER', qcOrder.qcOrderNo),
      updatedAt: qcOrder.updatedAt,
    })
  }

  for (const recheckOrder of recheckOrders) {
    const order = findOrderByNo(recheckOrder.productionOrderNo)
    rows.push({
      id: `RECHECK_ORDER-${recheckOrder.recheckOrderNo}`,
      objectType: 'RECHECK_ORDER',
      primaryNo: recheckOrder.recheckOrderNo,
      secondaryNo: recheckOrder.qcOrderNo,
      displayTitle: '后道复检单',
      keywords: unique([
        recheckOrder.recheckOrderId,
        recheckOrder.recheckOrderNo,
        recheckOrder.qcOrderId,
        recheckOrder.qcOrderNo,
        recheckOrder.productionOrderNo,
        recheckOrder.postTaskId,
        recheckOrder.postTaskNo,
        recheckOrder.sourceTaskNo,
        recheckOrder.spuCode,
        recheckOrder.spuName,
      ]),
      relatedProductionOrderNo: recheckOrder.productionOrderNo,
      relatedDemandNo: order?.demandId,
      statusText: recheckOrder.recheckStatus,
      ownerRole: '工厂',
      sourceDomain: 'PFOS',
      docGroup: '仓库',
      routePath: `/fcs/craft/post-finishing/qc-orders?recheckOrderNo=${encodeURIComponent(recheckOrder.recheckOrderNo)}`,
      quantityText: `${recheckOrder.recheckedGarmentQty.toLocaleString('zh-CN')} 件`,
      defaultTab: getDefaultTabForObjectType('RECHECK_ORDER'),
      highlightKey: makeHighlightKey('RECHECK_ORDER', recheckOrder.recheckOrderNo),
      updatedAt: recheckOrder.updatedAt,
    })
  }

  for (const task of listPostFinishingTasks()) {
    const items = qcOrdersByPostTask.get(task.postTaskId) || qcOrdersByPostTask.get(task.postTaskNo) || []
    if (items.length === 0) continue
    const order = findOrderByNo(task.productionOrderNo)
    const updatedAts = items.map((item) => item.updatedAt).sort()
    rows.push({
      id: `QC_MASTER_ORDER-${task.postTaskId}`,
      objectType: 'QC_MASTER_ORDER',
      primaryNo: task.postTaskNo,
      secondaryNo: task.postTaskId,
      displayTitle: '后道质检总单',
      keywords: unique([
        task.postTaskId,
        task.postTaskNo,
        task.productionOrderNo,
        order?.demandId,
        task.styleNo,
        task.styleName,
        task.spuCode,
        task.spuName,
        ...items.flatMap((item) => [item.qcOrderNo, item.qcOrderId, item.postTaskId, item.postTaskNo]),
      ]),
      relatedProductionOrderNo: task.productionOrderNo,
      relatedDemandNo: order?.demandId,
      statusText: task.currentStatus,
      ownerRole: '工厂',
      sourceDomain: 'PFOS',
      docGroup: '仓库',
      routePath: `/fcs/craft/post-finishing/qc-orders?postTaskId=${encodeURIComponent(task.postTaskId)}`,
      quantityText: `${sumNumbers(items.map((item) => item.inspectedGarmentQty)).toLocaleString('zh-CN')} 件`,
      defaultTab: getDefaultTabForObjectType('QC_MASTER_ORDER'),
      highlightKey: makeHighlightKey('QC_MASTER_ORDER', task.postTaskNo),
      updatedAt: updatedAts[updatedAts.length - 1],
    })
  }

  return rows
}

function buildSearchIndex(): ProductionObjectSearchIndex[] {
  const rows: ProductionObjectSearchIndex[] = []
  for (const order of productionOrders) {
    rows.push(buildOrderIndex(order))
    rows.push(...buildMaterialIndexes(order))
    rows.push(...buildWarehouseIndexes(order))
    rows.push(...buildProcessIndexes(order))
  }
  rows.push(...productionDemands.map(buildDemandIndex))
  rows.push(...buildMaterialPrepIndexes())
  rows.push(...buildPrintWorkOrderIndexes())
  rows.push(...buildDyeWorkOrderIndexes())
  rows.push(...buildPostFinishingQcIndexes())
  rows.push(...buildP1DocumentIndexes())
  return rows
}

export const productionObjectSearchIndex: ProductionObjectSearchIndex[] = buildSearchIndex()

function getSearchTexts(item: ProductionObjectSearchIndex): string[] {
  return unique([
    OBJECT_TYPE_LABEL[item.objectType],
    item.displayTitle,
    item.statusText,
    item.ownerRole,
    item.sourceDomain,
    item.docGroup,
    item.quantityText,
    ...item.keywords,
  ])
}

function getMatchedReason(item: ProductionObjectSearchIndex, keyword: string): { score: number; reason: string } | null {
  const normalized = keyword.trim().toLowerCase()
  if (normalized.length < 2) return null
  if (item.primaryNo.toLowerCase() === normalized) return { score: 0, reason: `命中：${OBJECT_TYPE_LABEL[item.objectType]}编号` }
  if (item.secondaryNo?.toLowerCase() === normalized) return { score: 1, reason: '命中：关联编号' }
  const searchTexts = getSearchTexts(item)
  const exactKeyword = searchTexts.find((value) => value.toLowerCase() === normalized)
  if (exactKeyword) return { score: 2, reason: `命中：${exactKeyword}` }
  const partialKeyword = searchTexts.find((value) => value.toLowerCase().includes(normalized))
  if (partialKeyword) return { score: 3, reason: `命中：${partialKeyword}` }
  return null
}

function getSearchBusinessPriority(item: ProductionObjectSearchIndex): number {
  const text = getSearchTexts(item).join(' ')
  if (['缺料', '未到仓', '待领料', '待确认', '差异', '部分'].some((value) => text.includes(value))) return 0
  if (item.objectType === 'PRODUCTION_ORDER' || item.objectType === 'DEMAND') return 1
  return 2
}

function getUpdatedAtScore(value: string | undefined): number {
  if (!value) return 0
  const time = new Date(value.replace(' ', 'T')).getTime()
  return Number.isFinite(time) ? time : 0
}

export function searchProductionObjects(keyword: string): ProductionObjectSearchIndex[] {
  const matches = productionObjectSearchIndex
    .map((item) => {
      const match = getMatchedReason(item, keyword)
      return match ? { item, match } : null
    })
    .filter((row): row is { item: ProductionObjectSearchIndex; match: { score: number; reason: string } } => Boolean(row))

  return matches
    .sort((a, b) =>
      a.match.score - b.match.score ||
      getSearchBusinessPriority(a.item) - getSearchBusinessPriority(b.item) ||
      getUpdatedAtScore(b.item.updatedAt) - getUpdatedAtScore(a.item.updatedAt) ||
      a.item.objectType.localeCompare(b.item.objectType) ||
      a.item.primaryNo.localeCompare(b.item.primaryNo),
    )
    .slice(0, 24)
    .map(({ item, match }) => ({ ...item, matchedReason: match.reason }))
}

export function queryProductionObjectIssues(input: ProductionObjectIssueQueryInput = {}): ProductionObjectIssueQueryResult[] {
  const rows: ProductionObjectIssueQueryResult[] = []

  for (const order of productionOrders) {
    const materials = buildMaterialLines(order)
    const p1Docs = p1DocumentMocks.filter((doc) => doc.relatedProductionOrderNo === order.productionOrderNo)
    for (const line of materials) {
      if (line.shortageQty <= 0 && !line.estimatedWarehouseArrivalAt) continue
      const issueType = line.purchaseArrivalStatus === 'PURCHASED_NOT_ARRIVED'
        ? '已采购未到仓'
        : line.purchaseArrivalStatus === 'PARTIAL_ARRIVED'
          ? '部分到仓'
          : '仓库执行待处理'
      rows.push({
        productionOrderNo: order.productionOrderNo,
        demandNo: order.demandId,
        productTitle: order.demandSnapshot.spuName,
        impactObjectNo: line.materialSku,
        issueType,
        reasonText: `${line.materialName} ${purchaseArrivalStatusLabel[line.purchaseArrivalStatus]}，缺 ${formatQty(line.shortageQty, line.unit)}。`,
        ownerRole: line.ownerRole,
        etaDate: line.estimatedWarehouseArrivalAt || '待确认',
        factoryName: formatProductionOrderMainFactoryName(order),
        riskText: line.estimatedWarehouseArrivalAt ? `预计恢复 ${line.estimatedWarehouseArrivalAt}` : '恢复时间待确认',
      })
    }

    for (const doc of p1Docs.filter((item) => item.issueType)) {
      rows.push({
        productionOrderNo: order.productionOrderNo,
        demandNo: order.demandId,
        productTitle: order.demandSnapshot.spuName,
        impactObjectNo: doc.docNo,
        issueType: doc.issueType || doc.docType,
        reasonText: `${doc.displayTitle} ${doc.statusText}，${doc.quantityText}。`,
        ownerRole: doc.ownerRole,
        etaDate: doc.estimatedRecoveryAt || '待确认',
        factoryName: doc.factoryName || formatProductionOrderMainFactoryName(order),
        riskText: doc.estimatedRecoveryAt ? `预计恢复 ${doc.estimatedRecoveryAt}` : '恢复时间待确认',
      })
    }
  }

  return rows
    .filter((row) => !input.materialSku || row.impactObjectNo.includes(input.materialSku))
    .filter((row) => !input.factoryName || row.factoryName.includes(input.factoryName))
    .filter((row) => !input.issueType || row.issueType.includes(input.issueType))
    .filter((row) => !input.etaDate || row.etaDate === input.etaDate)
    .slice(0, 24)
}
