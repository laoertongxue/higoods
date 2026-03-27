import { getFactoryByCode, type IndonesiaFactory } from './indonesia-factories.ts'
import {
  listFormalQualityDeductionLedgers,
  traceQualityDeductionLedgerSource,
} from './quality-deduction-repository.ts'
import type { ProcessTask } from './process-tasks.ts'
import type {
  AuditLog,
  AssignmentProgress,
  AssignmentSummary,
  BiddingSummary,
  DemandSnapshot,
  DirectDispatchSummary,
  FactorySnapshot,
  ProductionOrder,
  TaskBreakdownSummary,
  TechPackSnapshot,
} from './production-orders.ts'
import {
  getSettlementEffectiveInfoByFactory,
  getSettlementEffectiveInfoByFactoryAt,
  getSettlementVersionHistory,
  type SettlementConfigSnapshot,
  type SettlementDefaultDeductionRuleSnapshot,
  type SettlementEffectiveInfo,
  type SettlementEffectiveInfoSnapshot,
  type SettlementVersionRecord,
} from './settlement-change-requests.ts'
import { deriveSettlementCycleFields } from './store-domain-statement-grain.ts'
import type {
  DeductionBasisSourceType,
  DeductionBasisStatus,
  DeductionDecision,
  LiabilityStatus,
  QcDisposition,
  QcStatus,
  ReturnInboundBatch,
  ReturnInboundProcessType,
  ReturnInboundQcPolicy,
  ReturnInboundSourceBusinessType,
  RootCauseType,
  SettlementPartyType,
  SewPostProcessMode,
} from './store-domain-quality-types.ts'
import type {
  AdjustmentStatus,
  AdjustmentType,
  FactoryFeedbackStatus,
  FeishuPaymentApproval,
  FeishuPaymentApprovalStatus,
  PayableAdjustment,
  PaymentWriteback,
  PreSettlementLedger,
  PrepaymentBatchStatus,
  SettlementBatch,
  SettlementBatchItem,
  SettlementProfileSnapshot,
  StatementDraft,
  StatementDraftItem,
  StatementFactoryAppealRecord,
  StatementStatus,
} from './store-domain-settlement-types.ts'

interface LinkedReturnInboundQcScenario {
  qcId: string
  batchId: string
  productionOrderId: string
  taskId: string
  processType: ReturnInboundProcessType
  returnedQty: number
  returnFactoryId: string
  returnFactoryName: string
  warehouseId: string
  warehouseName: string
  inboundAt: string
  inboundBy: string
  qcPolicy: ReturnInboundQcPolicy
  inspector: string
  inspectedAt: string
  result: 'PASS' | 'FAIL'
  inspectedQty?: number
  qualifiedQty?: number
  unqualifiedQty?: number
  status: QcStatus
  remark: string
  rootCauseType: RootCauseType
  liabilityStatus: LiabilityStatus
  sourceBusinessType: ReturnInboundSourceBusinessType
  sourceBusinessId: string
  sourceOrderId?: string
  disposition?: QcDisposition
  affectedQty?: number
  defectItems?: Array<{
    defectCode: string
    defectName: string
    qty: number
  }>
  responsiblePartyType?: SettlementPartyType
  responsiblePartyId?: string
  responsiblePartyName?: string
  deductionDecision?: DeductionDecision
  deductionAmount?: number
  deductionDecisionRemark?: string
  liabilityDecidedAt?: string
  liabilityDecidedBy?: string
  dispositionRemark?: string
  settlementFreezeReason?: string
  sewPostProcessMode?: SewPostProcessMode
  writeback?: {
    availableQty?: number
    acceptedAsDefectQty?: number
    scrapQty?: number
    completedAt?: string
    completedBy?: string
    downstreamUnblocked?: boolean
  }
  basis?: {
    basisId: string
    sourceType: DeductionBasisSourceType
    status: DeductionBasisStatus
    deductionQty?: number
    deductionAmount?: number
    settlementReady?: boolean
    settlementFreezeReason?: string
    deductionAmountEditable?: boolean
    summary: string
    evidenceRefs: Array<{ name: string; type?: string; url?: string }>
    arbitrationResult?: 'UPHOLD' | 'REASSIGN' | 'VOID_DEDUCTION'
    arbitrationRemark?: string
    createdAt: string
    updatedAt?: string
  }
  dispute?: {
    disputeId: string
    qcId: string
    basisId: string
    factoryId: string
    status: 'OPEN' | 'REJECTED' | 'ADJUSTED' | 'ARCHIVED'
    summary: string
    submittedAt: string
    submittedBy: string
    resolvedAt?: string
    resolvedBy?: string
    requestedAmount?: number
    finalAmount?: number
  }
  settlementImpact: {
    qcId: string
    basisId?: string
    factoryId: string
    batchId: string
    status: 'NO_IMPACT' | 'FROZEN' | 'READY' | 'SETTLED' | 'PENDING_ARBITRATION'
    summary: string
    settlementBatchId?: string
    settledAt?: string
  }
}

function buildDeductionEntryHrefByBasisId(basisId: string): string {
  return `/fcs/quality/deduction-analysis?basisId=${encodeURIComponent(basisId)}`
}

interface LinkedTaskContext {
  factory: IndonesiaFactory
  productionOrder: ProductionOrder
  task: ProcessTask
  taskIndex: number
  unitPrice: number
  pricingSourceType: 'DISPATCH' | 'BIDDING'
}

interface LinkedReturnBatchContext {
  batch: ReturnInboundBatch
  taskContext: LinkedTaskContext
  batchIndex: number
  cycleId: string
  cycleLabel: string
  cycleStartAt: string
  cycleEndAt: string
}

interface LinkedStatementLineBuild {
  item: StatementDraftItem
  sourceIds: string[]
  basisIds: string[]
}

export interface LinkedStatementSourceRow {
  sourceItemId: string
  sourceType: 'TASK_EARNING' | 'QUALITY_DEDUCTION'
  settlementPartyId: string
  settlementCycleId: string
  settlementCycleLabel: string
  productionOrderId?: string
  taskId?: string
  returnInboundBatchId?: string
  qty: number
  amount: number
  currency: string
  sourceStatus: string
  canEnterStatement: boolean
  sourceReason?: string
  remark?: string
}

export interface SettlementLinkedMockFactoryOutput {
  factories: IndonesiaFactory[]
  productionOrders: ProductionOrder[]
  processTasks: ProcessTask[]
  returnInboundBatches: ReturnInboundBatch[]
  qcScenarios: LinkedReturnInboundQcScenario[]
  payableAdjustments: PayableAdjustment[]
  taskEarningLedgers: PreSettlementLedger[]
  statementSourceRows: LinkedStatementSourceRow[]
  statementDraftLines: StatementDraftItem[]
  statementDrafts: StatementDraft[]
  settlementBatches: SettlementBatch[]
  feishuPaymentApprovals: FeishuPaymentApproval[]
  paymentWritebacks: PaymentWriteback[]
}

const LINKED_FACTORY_CODES = [
  'ID-FAC-0001',
  'ID-FAC-0002',
  'ID-FAC-0003',
  'ID-FAC-0004',
  'ID-FAC-0005',
] as const

const CYCLE_REFERENCE_DATES = [
  '2026-01-06 10:00:00',
  '2026-01-20 10:00:00',
  '2026-02-06 10:00:00',
  '2026-02-20 10:00:00',
  '2026-03-06 10:00:00',
  '2026-03-20 10:00:00',
] as const

function parseDateTime(dateText: string): Date {
  return new Date(dateText.replace(' ', 'T'))
}

function addDays(dateText: string, days: number, hour = 10): string {
  const date = parseDateTime(dateText)
  date.setDate(date.getDate() + days)
  date.setHours(hour, 0, 0, 0)
  return formatDateTime(date)
}

function formatDateTime(date: Date): string {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  const hours = `${date.getHours()}`.padStart(2, '0')
  const minutes = `${date.getMinutes()}`.padStart(2, '0')
  const seconds = `${date.getSeconds()}`.padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

function formatDateOnly(dateText: string): string {
  return dateText.slice(0, 10)
}

function roundAmount(value: number): number {
  return Number(value.toFixed(2))
}

function lastFour(value: string): string {
  return value.slice(-4)
}

function createFactorySnapshot(factory: IndonesiaFactory): FactorySnapshot {
  return {
    id: factory.id,
    code: factory.code,
    name: factory.name,
    tier: factory.tier,
    type: factory.type,
    status: factory.status,
    province: factory.province,
    city: factory.city,
    tags: [...factory.tags],
  }
}

function createAuditLog(id: string, action: string, detail: string, at: string, by: string): AuditLog {
  return { id, action, detail, at, by }
}

function buildDemandSnapshot(factoryIndex: number, orderIndex: number, totalQty: number, requiredDeliveryDate: string): DemandSnapshot {
  return {
    demandId: `DEM-LINK-2026-${String(factoryIndex * 10 + orderIndex + 1).padStart(4, '0')}`,
    spuCode: `SPU-LINK-${String(factoryIndex + 1).padStart(2, '0')}${String(orderIndex + 1).padStart(2, '0')}`,
    spuName: `联动对账款式-${factoryIndex + 1}-${orderIndex + 1}`,
    priority: orderIndex % 2 === 0 ? 'HIGH' : 'NORMAL',
    requiredDeliveryDate,
    constraintsNote: '用于对账与结算链路串联演示',
    skuLines: [
      {
        skuCode: `SKU-LINK-${String(factoryIndex + 1).padStart(2, '0')}${String(orderIndex + 1).padStart(2, '0')}-M`,
        size: 'M',
        color: factoryIndex % 2 === 0 ? '藏青' : '黑色',
        qty: Math.round(totalQty * 0.55),
      },
      {
        skuCode: `SKU-LINK-${String(factoryIndex + 1).padStart(2, '0')}${String(orderIndex + 1).padStart(2, '0')}-L`,
        size: 'L',
        color: factoryIndex % 2 === 0 ? '藏青' : '黑色',
        qty: totalQty - Math.round(totalQty * 0.55),
      },
    ],
  }
}

function buildTechPackSnapshot(createdAt: string): TechPackSnapshot {
  return {
    status: 'RELEASED',
    versionLabel: 'v2026.03',
    snapshotAt: createdAt,
  }
}

function buildAssignmentSummary(): AssignmentSummary {
  return {
    directCount: 3,
    biddingCount: 2,
    totalTasks: 5,
    unassignedCount: 0,
  }
}

function buildAssignmentProgress(): AssignmentProgress {
  return {
    status: 'DONE',
    directAssignedCount: 3,
    biddingLaunchedCount: 2,
    biddingAwardedCount: 2,
  }
}

function buildBiddingSummary(): BiddingSummary {
  return {
    activeTenderCount: 0,
    overdueTenderCount: 0,
  }
}

function buildDispatchSummary(): DirectDispatchSummary {
  return {
    assignedFactoryCount: 1,
    rejectedCount: 0,
    overdueAckCount: 0,
  }
}

function buildTaskBreakdownSummary(createdAt: string): TaskBreakdownSummary {
  return {
    isBrokenDown: true,
    taskTypesTop3: ['车缝', '整烫', '包装'],
    lastBreakdownAt: createdAt,
    lastBreakdownBy: '系统',
  }
}

function chooseStatementStatus(cycleIndex: number): StatementStatus {
  if (cycleIndex <= 2) return 'READY_FOR_PREPAYMENT'
  if (cycleIndex === 3) return 'PENDING_FACTORY_CONFIRM'
  return 'DRAFT'
}

function chooseBatchStatus(factoryIndex: number): PrepaymentBatchStatus {
  const statusOrder: PrepaymentBatchStatus[] = [
    'PREPAID',
    'FEISHU_PAID_PENDING_WRITEBACK',
    'FEISHU_APPROVAL_CREATED',
    'READY_TO_APPLY_PAYMENT',
    'FEISHU_APPROVAL_REJECTED',
  ]
  return statusOrder[factoryIndex % statusOrder.length] ?? 'READY_TO_APPLY_PAYMENT'
}

function chooseFactoryFeedbackStatus(
  statementStatus: StatementStatus,
  factoryIndex: number,
  cycleIndex: number,
): FactoryFeedbackStatus {
  if (statementStatus === 'DRAFT') return 'NOT_SENT'
  const mod = (factoryIndex + cycleIndex) % 4
  if (statementStatus === 'PENDING_FACTORY_CONFIRM') {
    if (mod === 0) return 'FACTORY_APPEALED'
    if (mod === 1) return 'PLATFORM_HANDLING'
    return 'PENDING_FACTORY_CONFIRM'
  }
  if (mod === 0) return 'RESOLVED'
  return 'FACTORY_CONFIRMED'
}

function mapFactoryByCode(code: string): IndonesiaFactory {
  const factory = getFactoryByCode(code)
  if (!factory) {
    throw new Error(`未找到工厂 ${code}`)
  }
  return factory
}

function getFactoryEffectiveInfo(factory: IndonesiaFactory): SettlementEffectiveInfo {
  const info = getSettlementEffectiveInfoByFactory(factory.code)
  if (!info) {
    throw new Error(`未找到工厂 ${factory.code} 的结算主数据`)
  }
  return info
}

function chooseSettlementVersionRecord(factory: IndonesiaFactory, referenceAt: string): SettlementVersionRecord | SettlementEffectiveInfo {
  const referenceMs = parseDateTime(referenceAt).getTime()
  const history = getSettlementVersionHistory(factory.code)
    .slice()
    .sort((left, right) => left.effectiveAt.localeCompare(right.effectiveAt))
  const matched = history.filter((item) => parseDateTime(item.effectiveAt).getTime() <= referenceMs).at(-1)
  return matched ?? getFactoryEffectiveInfo(factory)
}

function cloneConfigSnapshot(snapshot: SettlementConfigSnapshot): SettlementConfigSnapshot {
  return { ...snapshot }
}

function cloneAccountSnapshot(snapshot: SettlementEffectiveInfoSnapshot): SettlementEffectiveInfoSnapshot {
  return { ...snapshot }
}

function cloneDeductionRuleSnapshots(
  snapshots: SettlementDefaultDeductionRuleSnapshot[],
): SettlementDefaultDeductionRuleSnapshot[] {
  return snapshots.map((item) => ({ ...item }))
}

function buildSettlementSnapshotForFactoryAt(factory: IndonesiaFactory, referenceAt: string): SettlementProfileSnapshot {
  const version = chooseSettlementVersionRecord(factory, referenceAt)
  return {
    versionNo: version.versionNo,
    effectiveAt: version.effectiveAt,
    sourceFactoryId: factory.id,
    sourceFactoryName: factory.name,
    settlementConfigSnapshot: cloneConfigSnapshot(version.settlementConfigSnapshot),
    receivingAccountSnapshot: cloneAccountSnapshot(version.receivingAccountSnapshot),
    defaultDeductionRulesSnapshot: cloneDeductionRuleSnapshots(version.defaultDeductionRulesSnapshot),
  }
}

function createProductionOrders(factories: IndonesiaFactory[]): ProductionOrder[] {
  const orders: ProductionOrder[] = []
  for (const [factoryIndex, factory] of factories.entries()) {
    for (let orderSeq = 0; orderSeq < 2; orderSeq += 1) {
      const orderIndex = factoryIndex * 2 + orderSeq
      const createdAt = addDays('2026-01-02 09:00:00', orderIndex * 4 + factoryIndex, 9)
      const requiredDeliveryDate = formatDateOnly(addDays(createdAt, 40 + orderSeq * 5))
      const totalQty = 5400 + factoryIndex * 350 + orderSeq * 280
      orders.push({
        productionOrderId: `PO-LINK-2026-${String(orderIndex + 1).padStart(4, '0')}`,
        demandId: `DEM-LINK-2026-${String(orderIndex + 1).padStart(4, '0')}`,
        legacyOrderNo: `26${String(7000 + orderIndex + 1)}`,
        status: 'EXECUTING',
        lockedLegacy: true,
        mainFactoryId: factory.id,
        mainFactorySnapshot: createFactorySnapshot(factory),
        ownerPartyType: 'LEGAL_ENTITY',
        ownerPartyId: 'LE-001',
        techPackSnapshot: buildTechPackSnapshot(createdAt),
        demandSnapshot: buildDemandSnapshot(factoryIndex, orderSeq, totalQty, requiredDeliveryDate),
        assignmentSummary: buildAssignmentSummary(),
        assignmentProgress: buildAssignmentProgress(),
        biddingSummary: buildBiddingSummary(),
        directDispatchSummary: buildDispatchSummary(),
        taskBreakdownSummary: buildTaskBreakdownSummary(createdAt),
        riskFlags: [],
        auditLogs: [
          createAuditLog(`AL-PO-LINK-${orderIndex + 1}-01`, 'CREATED', '联动结算 mock 生产单已创建', createdAt, '系统'),
          createAuditLog(`AL-PO-LINK-${orderIndex + 1}-02`, 'EXECUTING', '进入执行中状态', addDays(createdAt, 1, 10), '系统'),
        ],
        createdAt,
        updatedAt: addDays(createdAt, 6, 16),
      })
    }
  }
  return orders
}

function createProcessTasks(orders: ProductionOrder[]): LinkedTaskContext[] {
  const taskContexts: LinkedTaskContext[] = []
  let taskSeq = 1

  for (const [orderIndex, order] of orders.entries()) {
    const factory = mapFactoryByCode(order.mainFactorySnapshot.code)
    for (let localSeq = 0; localSeq < 5; localSeq += 1) {
      const taskId = `TASK-LINK-2026-${String(taskSeq).padStart(4, '0')}`
      const createdAt = addDays(order.createdAt, localSeq, 10)
      const assignmentMode = localSeq % 2 === 0 ? 'DIRECT' : 'BIDDING'
      const qty = 720 + (orderIndex % 4) * 180 + localSeq * 120 + (taskSeq % 3) * 60
      const dispatchPrice = assignmentMode === 'DIRECT' ? 2100 + (taskSeq % 5) * 110 : undefined
      const standardPrice = assignmentMode === 'BIDDING' ? 2280 + (taskSeq % 4) * 130 : 1980 + (taskSeq % 3) * 80
      const unitPrice = dispatchPrice ?? standardPrice

      const task: ProcessTask = {
        taskId,
        taskNo: `TK-LINK-${String(taskSeq).padStart(4, '0')}`,
        productionOrderId: order.productionOrderId,
        seq: localSeq + 1,
        processCode: 'PROC_SEW',
        processNameZh: '车缝',
        stage: 'SEWING',
        qty,
        qtyUnit: 'PIECE',
        assignmentMode,
        assignmentStatus: assignmentMode === 'DIRECT' ? 'ASSIGNED' : 'AWARDED',
        ownerSuggestion: { kind: 'MAIN_FACTORY' },
        assignedFactoryId: factory.id,
        assignedFactoryName: factory.name,
        qcPoints: [],
        attachments: [],
        status: 'DONE',
        standardPrice,
        standardPriceCurrency: 'IDR',
        standardPriceUnit: '件',
        dispatchPrice,
        dispatchPriceCurrency: dispatchPrice ? 'IDR' : undefined,
        dispatchPriceUnit: dispatchPrice ? '件' : undefined,
        priceDiffReason: assignmentMode === 'BIDDING' ? '竞价中标价' : '派单价',
        acceptanceStatus: 'ACCEPTED',
        acceptedAt: addDays(createdAt, 1, 11),
        acceptedBy: factory.name,
        awardedAt: assignmentMode === 'BIDDING' ? addDays(createdAt, 1, 11) : undefined,
        createdAt,
        updatedAt: addDays(createdAt, 12, 18),
        auditLogs: [
          {
            id: `AL-${taskId}-01`,
            action: 'CREATED',
            detail: '联动结算 mock 任务已创建',
            at: createdAt,
            by: '系统',
          },
          {
            id: `AL-${taskId}-02`,
            action: assignmentMode === 'BIDDING' ? 'AWARDED' : 'DISPATCHED',
            detail: assignmentMode === 'BIDDING' ? '竞价中标并开始执行' : '直接派单并开始执行',
            at: addDays(createdAt, 1, 11),
            by: '平台运营',
          },
        ],
      }

      taskContexts.push({
        factory,
        productionOrder: order,
        task,
        taskIndex: taskSeq - 1,
        unitPrice,
        pricingSourceType: assignmentMode === 'BIDDING' ? 'BIDDING' : 'DISPATCH',
      })
      taskSeq += 1
    }
  }

  return taskContexts
}

function buildBatchQtyPlan(totalQty: number, batchCount: number): number[] {
  const ratios = batchCount === 4 ? [0.28, 0.24, 0.22, 0.26] : [0.42, 0.33, 0.25]
  let remaining = totalQty
  return ratios.map((ratio, index) => {
    if (index === ratios.length - 1) return remaining
    const qty = Math.max(80, Math.round(totalQty * ratio))
    remaining -= qty
    return qty
  })
}

function createReturnInboundBatches(taskContexts: LinkedTaskContext[]): LinkedReturnBatchContext[] {
  const batches: LinkedReturnBatchContext[] = []
  let batchSeq = 1

  for (const taskContext of taskContexts) {
    const batchCount = taskContext.taskIndex % 2 === 0 ? 3 : 4
    const qtyPlan = buildBatchQtyPlan(taskContext.task.qty, batchCount)
    const startCycleIndex = (taskContext.taskIndex + taskContext.factory.id.charCodeAt(taskContext.factory.id.length - 1)) % 4
    const cycleOffsets = batchCount === 4 ? [0, 0, 1, 2] : [0, 0, 1]

    for (let batchIndex = 0; batchIndex < batchCount; batchIndex += 1) {
      const cycleIndex = Math.min(CYCLE_REFERENCE_DATES.length - 1, startCycleIndex + cycleOffsets[batchIndex])
      const inboundAt = addDays(CYCLE_REFERENCE_DATES[cycleIndex], (taskContext.taskIndex + batchIndex) % 5, 15)
      const cycleFields = deriveSettlementCycleFields(taskContext.factory.id, inboundAt)
      const batchId = `RIB-LINK-2026-${String(batchSeq).padStart(5, '0')}`

      batches.push({
        batch: {
          batchId,
          productionOrderId: taskContext.productionOrder.productionOrderId,
          sourceTaskId: taskContext.task.taskId,
          processType: 'SEW',
          processLabel: '车缝',
          returnedQty: qtyPlan[batchIndex],
          returnFactoryId: taskContext.factory.id,
          returnFactoryName: taskContext.factory.name,
          warehouseId: `WH-LINK-${String((taskContext.taskIndex % 3) + 1).padStart(2, '0')}`,
          warehouseName: ['雅加达中心仓', '万隆成衣仓', '泗水成衣仓'][taskContext.taskIndex % 3],
          inboundAt,
          inboundBy: `仓管员-${(taskContext.taskIndex % 5) + 1}`,
          qcPolicy: 'REQUIRED',
          qcStatus: 'PASS_CLOSED',
          sourceType: 'TASK',
          sourceId: taskContext.task.taskId,
          sewPostProcessMode:
            batchIndex % 2 === 0 ? 'SEW_WITH_POST' : 'SEW_WITHOUT_POST_WAREHOUSE_INTEGRATED',
          createdAt: inboundAt,
          createdBy: `仓管员-${(taskContext.taskIndex % 5) + 1}`,
          updatedAt: inboundAt,
          updatedBy: '系统',
        },
        taskContext,
        batchIndex,
        cycleId: cycleFields.settlementCycleId,
        cycleLabel: cycleFields.settlementCycleLabel,
        cycleStartAt: cycleFields.settlementCycleStartAt,
        cycleEndAt: cycleFields.settlementCycleEndAt,
      })
      batchSeq += 1
    }
  }

  return batches
}

function buildEvidenceRefs(batchId: string, count: number): Array<{ name: string; type?: string; url?: string }> {
  return Array.from({ length: count }).map((_, index) => ({
    name: `${batchId} 仓库证据-${index + 1}`,
    type: index === count - 1 ? '文档' : '图片',
  }))
}

function createQcScenarios(batchContexts: LinkedReturnBatchContext[]): LinkedReturnInboundQcScenario[] {
  const scenarios: LinkedReturnInboundQcScenario[] = []
  let qcSeq = 1
  let basisSeq = 1
  let disputeSeq = 1

  for (const batchContext of batchContexts) {
    const selector = batchContext.batchIndex === 0 ? batchContext.taskContext.taskIndex % 6 : (batchContext.taskContext.taskIndex + batchContext.batchIndex) % 6
    if (selector === 0) continue

    const qcId = `QC-LINK-2026-${String(qcSeq).padStart(5, '0')}`
    const inspectedAt = addDays(batchContext.batch.inboundAt, 0, 16)
    const baseScenario: LinkedReturnInboundQcScenario = {
      qcId,
      batchId: batchContext.batch.batchId,
      productionOrderId: batchContext.batch.productionOrderId,
      taskId: batchContext.taskContext.task.taskId,
      processType: batchContext.batch.processType,
      returnedQty: batchContext.batch.returnedQty,
      returnFactoryId: batchContext.taskContext.factory.id,
      returnFactoryName: batchContext.taskContext.factory.name,
      warehouseId: batchContext.batch.warehouseId ?? 'WH-LINK-01',
      warehouseName: batchContext.batch.warehouseName ?? '雅加达中心仓',
      inboundAt: batchContext.batch.inboundAt,
      inboundBy: batchContext.batch.inboundBy,
      qcPolicy: batchContext.batch.qcPolicy,
      inspector: `质检员-${(qcSeq % 6) + 1}`,
      inspectedAt,
      result: 'PASS',
      inspectedQty: batchContext.batch.returnedQty,
      qualifiedQty: batchContext.batch.returnedQty,
      unqualifiedQty: 0,
      status: 'SUBMITTED',
      remark: '回货质检通过，可继续进入结算',
      rootCauseType: 'UNKNOWN',
      liabilityStatus: 'DRAFT',
      sourceBusinessType: 'TASK',
      sourceBusinessId: batchContext.taskContext.task.taskId,
      disposition: undefined,
      affectedQty: undefined,
      responsiblePartyType: 'FACTORY',
      responsiblePartyId: batchContext.taskContext.factory.id,
      responsiblePartyName: batchContext.taskContext.factory.name,
      deductionDecision: 'NO_DEDUCT',
      deductionAmount: 0,
      deductionDecisionRemark: '无扣款',
      sewPostProcessMode: batchContext.batch.sewPostProcessMode,
      settlementImpact: {
        qcId,
        factoryId: batchContext.taskContext.factory.id,
        batchId: batchContext.batch.batchId,
        status: 'NO_IMPACT',
        summary: '合格入仓，不影响结算',
      },
      writeback: {
        availableQty: batchContext.batch.returnedQty,
        completedAt: addDays(batchContext.batch.inboundAt, 1, 9),
        completedBy: '系统',
        downstreamUnblocked: true,
      },
    }

    if (selector === 1) {
      scenarios.push(baseScenario)
      qcSeq += 1
      continue
    }

    const affectedQty = Math.max(12, Math.round(batchContext.batch.returnedQty * (selector === 4 ? 0.08 : 0.05)))
    const unitPenalty = 140 + ((batchContext.taskContext.taskIndex + batchContext.batchIndex) % 4) * 22
    const deductionAmount = affectedQty * unitPenalty
    const basisId = `DBI-LINK-2026-${String(basisSeq).padStart(5, '0')}`
    const failBase: LinkedReturnInboundQcScenario = {
      ...baseScenario,
      result: 'FAIL',
      remark: selector === 5 ? '存在轻微缺陷，但判定为非工厂责任' : '回货抽检发现缺陷，需进入责任判定',
      qualifiedQty: batchContext.batch.returnedQty - affectedQty,
      unqualifiedQty: affectedQty,
      rootCauseType: selector === 5 ? 'MATERIAL' : 'PROCESS',
      liabilityStatus: selector === 3 ? 'DISPUTED' : selector === 5 ? 'VOID' : 'CONFIRMED',
      disposition: 'ACCEPT_AS_DEFECT',
      affectedQty,
      defectItems: [
        {
          defectCode: selector === 5 ? 'MAT-001' : 'SEW-001',
          defectName: selector === 5 ? '面料缩率异常' : '车缝跳针',
          qty: affectedQty,
        },
      ],
      deductionDecision: selector === 5 ? 'NO_DEDUCT' : 'DEDUCT',
      deductionAmount: selector === 5 ? 0 : deductionAmount,
      deductionDecisionRemark:
        selector === 3
          ? '争议处理中，暂不计入本周期'
          : selector === 5
            ? '非工厂责任，不进入扣款'
            : '按工厂责任进入结算',
      liabilityDecidedAt: addDays(batchContext.batch.inboundAt, 1, 11),
      liabilityDecidedBy: '质检主管',
      dispositionRemark: selector === 5 ? '责任转供应商，不影响工厂结算' : '暂收次品，进入结算扣款口径',
    }

    if (selector === 5) {
      scenarios.push({
        ...failBase,
        basis: undefined,
        dispute: undefined,
        settlementImpact: {
          qcId,
          factoryId: batchContext.taskContext.factory.id,
          batchId: batchContext.batch.batchId,
          status: 'NO_IMPACT',
          summary: '非工厂责任，不影响结算',
        },
      })
      qcSeq += 1
      continue
    }

    const isHistoricalSettled = selector === 4 || parseDateTime(batchContext.cycleEndAt).getTime() < parseDateTime('2026-02-15 00:00:00').getTime()
    const basisStatus: DeductionBasisStatus = selector === 3 ? 'DISPUTED' : 'CONFIRMED'
    const basisSummary =
      selector === 3
        ? '工厂已发起异议，当前先冻结结算'
        : isHistoricalSettled
          ? '历史周期已确认并进入结算'
          : '当前周期已确认，可纳入结算'

    scenarios.push({
      ...failBase,
      status: selector === 3 ? 'SUBMITTED' : 'CLOSED',
      basis: {
        basisId,
        sourceType: 'QC_DEFECT_ACCEPT',
        status: basisStatus,
        deductionQty: affectedQty,
        deductionAmount,
        settlementReady: selector !== 3,
        settlementFreezeReason: selector === 3 ? '争议处理中，冻结结算' : '',
        deductionAmountEditable: selector !== 3,
        summary: basisSummary,
        evidenceRefs: buildEvidenceRefs(batchContext.batch.batchId, 3),
        createdAt: addDays(batchContext.batch.inboundAt, 1, 11),
        updatedAt: addDays(batchContext.batch.inboundAt, selector === 3 ? 2 : 3, 14),
      },
      dispute:
        selector === 3
          ? {
              disputeId: `QCD-LINK-2026-${String(disputeSeq).padStart(5, '0')}`,
              qcId,
              basisId,
              factoryId: batchContext.taskContext.factory.id,
              status: 'OPEN',
              summary: '工厂认为此批缺陷来自上游面料弹性差异，已发起争议',
              submittedAt: addDays(batchContext.batch.inboundAt, 2, 9),
              submittedBy: `工厂财务-${batchContext.taskContext.factory.name.slice(0, 2)}`,
              requestedAmount: deductionAmount,
            }
          : undefined,
      settlementImpact: {
        qcId,
        basisId,
        factoryId: batchContext.taskContext.factory.id,
        batchId: batchContext.batch.batchId,
        status: selector === 3 ? 'PENDING_ARBITRATION' : isHistoricalSettled ? 'SETTLED' : 'READY',
        summary:
          selector === 3
            ? '争议处理中，当前冻结结算'
            : isHistoricalSettled
              ? '已进入历史预付款批次'
              : `待纳入 ${batchContext.cycleId} 预付款链`,
        settlementBatchId: isHistoricalSettled ? `STL-LINK-BATCH-${batchContext.cycleId}` : undefined,
        settledAt: isHistoricalSettled ? addDays(batchContext.cycleEndAt, 2, 15) : undefined,
      },
      writeback:
        selector === 3
          ? undefined
          : {
              availableQty: batchContext.batch.returnedQty - affectedQty,
              acceptedAsDefectQty: affectedQty,
              completedAt: addDays(batchContext.cycleEndAt, 1, 10),
              completedBy: '系统',
              downstreamUnblocked: true,
            },
    })

    basisSeq += 1
    if (selector === 3) disputeSeq += 1
    qcSeq += 1
  }

  return scenarios
}

function buildCarryOverAdjustments(
  qcScenarios: LinkedReturnInboundQcScenario[],
  cycleOrder: string[],
): PayableAdjustment[] {
  const adjustments: PayableAdjustment[] = []
  let adjustmentSeq = 1

  for (const [index, scenario] of qcScenarios.entries()) {
    if (!scenario.basis || !scenario.dispute) continue
    const currentCycle = deriveSettlementCycleFields(scenario.returnFactoryId, scenario.inboundAt).settlementCycleId
    const cycleIndex = cycleOrder.indexOf(currentCycle)
    if (cycleIndex < 0 || cycleIndex >= cycleOrder.length - 1) continue

    const nextCycleReference = cycleOrder[cycleIndex + 1]
    const nextCycleStartAt = nextCycleReference.split('|')[1]
    const amount = roundAmount((scenario.basis.deductionAmount ?? 0) * 0.45)
    adjustments.push({
      adjustmentId: `PAD-LINK-2026-${String(adjustmentSeq).padStart(5, '0')}`,
      adjustmentType: index % 2 === 0 ? 'REVERSAL' : 'COMPENSATION',
      settlementPartyType: 'FACTORY',
      settlementPartyId: scenario.returnFactoryId,
      productionOrderId: scenario.productionOrderId,
      taskId: scenario.taskId,
      amount,
      currency: 'IDR',
      remark: `上周期质量争议在本周期计入：${scenario.basis.basisId}`,
      relatedBasisId: scenario.basis.basisId,
      status: 'DRAFT',
      createdAt: addDays(`${nextCycleStartAt} 09:00:00`, 1, 10),
      createdBy: '平台运营',
      updatedAt: addDays(`${nextCycleStartAt} 09:00:00`, 1, 10),
      updatedBy: '平台运营',
    })
    adjustmentSeq += 1
  }

  return adjustments
}

function buildOtherAdjustments(factories: IndonesiaFactory[], cycleOrder: string[]): PayableAdjustment[] {
  const adjustments: PayableAdjustment[] = []
  let adjustmentSeq = 2001

  for (const [factoryIndex, factory] of factories.entries()) {
    for (let cycleIndex = 0; cycleIndex < cycleOrder.length; cycleIndex += 2) {
      const [, cycleStartAt] = cycleOrder[cycleIndex].split('|')
      adjustments.push({
        adjustmentId: `PAD-LINK-2026-${String(adjustmentSeq).padStart(5, '0')}`,
        adjustmentType: cycleIndex % 4 === 0 ? 'DEDUCTION_SUPPLEMENT' : 'COMPENSATION',
        settlementPartyType: 'FACTORY',
        settlementPartyId: factory.id,
        productionOrderId: `PO-LINK-2026-${String(factoryIndex * 2 + 1).padStart(4, '0')}`,
        taskId: `TASK-LINK-2026-${String(factoryIndex * 10 + cycleIndex + 1).padStart(4, '0')}`,
        amount: 320 + factoryIndex * 55 + cycleIndex * 28,
        currency: 'IDR',
        remark: cycleIndex % 4 === 0 ? '兼容补差样例：交期差额' : '兼容补差样例：返利差额',
        status: cycleIndex < 2 ? 'EFFECTIVE' : cycleIndex === cycleOrder.length - 1 ? 'VOID' : 'DRAFT',
        createdAt: addDays(`${cycleStartAt} 09:00:00`, 3, 11),
        createdBy: '平台运营',
        updatedAt: addDays(`${cycleStartAt} 09:00:00`, 4, 16),
        updatedBy: '平台运营',
      })
      adjustmentSeq += 1
    }
  }

  return adjustments
}

function buildStatementLineFromBatch(
  batchContext: LinkedReturnBatchContext,
  lineIndex: number,
): LinkedStatementLineBuild {
  const earningAmount = roundAmount(batchContext.taskContext.unitPrice * batchContext.batch.returnedQty)
  const sourceItemId = `PSL-TASK-${String(lineIndex + 1).padStart(5, '0')}`

  return {
    item: {
      sourceItemId,
      sourceItemType: 'TASK_EARNING',
      sourceLabelZh: '任务收入流水',
      sourceRefLabel: batchContext.batch.batchId,
      routeToSource: `/fcs/pda/task-receive/${batchContext.taskContext.task.taskId}`,
      settlementPartyType: 'FACTORY',
      settlementPartyId: batchContext.taskContext.factory.id,
      basisId: batchContext.batch.batchId,
      deductionQty: batchContext.batch.returnedQty,
      deductionAmount: earningAmount,
      currency: 'IDR',
      remark: `回货批次 ${batchContext.batch.batchId} 形成任务收入流水`,
      sourceProcessType: batchContext.batch.processType,
      sourceType: 'TASK_EARNING',
      productionOrderId: batchContext.batch.productionOrderId,
      productionOrderNo: batchContext.taskContext.productionOrder.legacyOrderNo,
      taskId: batchContext.taskContext.task.taskId,
      taskNo: batchContext.taskContext.task.taskNo,
      settlementCycleId: batchContext.cycleId,
      settlementCycleLabel: batchContext.cycleLabel,
      settlementCycleStartAt: batchContext.cycleStartAt,
      settlementCycleEndAt: batchContext.cycleEndAt,
      statementLineGrainType: 'RETURN_INBOUND_BATCH',
      returnInboundBatchId: batchContext.batch.batchId,
      returnInboundBatchNo: batchContext.batch.batchId,
      returnInboundQty: batchContext.batch.returnedQty,
      qcRecordId: undefined,
      pendingDeductionRecordId: undefined,
      disputeId: undefined,
      processLabel: batchContext.batch.processLabel,
      pricingSourceType: batchContext.taskContext.pricingSourceType,
      pricingSourceRefId: batchContext.taskContext.task.taskId,
      settlementUnitPrice: batchContext.taskContext.unitPrice,
      earningAmount,
      qualityDeductionAmount: 0,
      carryOverAdjustmentAmount: 0,
      otherAdjustmentAmount: 0,
      netAmount: earningAmount,
    },
    sourceIds: [sourceItemId],
    basisIds: [],
  }
}

function buildStatementLineFromQualityLedger(
  ledger: ReturnType<typeof listFormalQualityDeductionLedgers>[number],
): LinkedStatementLineBuild {
  const trace = traceQualityDeductionLedgerSource(ledger.ledgerId)
  const settlementPartyId = ledger.settlementPartyId ?? ledger.factoryId
  const cycleFields = deriveSettlementCycleFields(
    settlementPartyId,
    trace?.caseFact.qcRecord.inboundAt ?? ledger.generatedAt,
  )
  const qty = trace?.caseFact.deductionBasis?.deductionQty ?? trace?.caseFact.qcRecord.factoryLiabilityQty ?? 1
  const deductionAmount = roundAmount(ledger.settlementAmount ?? ledger.originalAmount)
  const basisId = trace?.pendingRecord?.basisId ?? ledger.basisId ?? ledger.ledgerId
  const routeToSource = basisId
    ? buildDeductionEntryHrefByBasisId(basisId)
    : `/fcs/quality/qc-records/${ledger.qcId}`

  return {
    item: {
      sourceItemId: ledger.ledgerId,
      sourceItemType: 'QUALITY_DEDUCTION',
      sourceLabelZh: '质量扣款流水',
      sourceRefLabel: ledger.ledgerId,
      routeToSource,
      settlementPartyType: ledger.settlementPartyType ?? 'FACTORY',
      settlementPartyId,
      basisId,
      deductionQty: qty,
      deductionAmount: -deductionAmount,
      currency: ledger.settlementCurrency,
      remark:
        trace?.disputeCase?.adjudicationResult
          ? `裁决结果：${trace.disputeCase.adjudicationResult}`
          : ledger.comment ?? ledger.ledgerNo,
      productionOrderId: trace?.caseFact.qcRecord.productionOrderNo,
      productionOrderNo: trace?.caseFact.qcRecord.productionOrderNo,
      taskId: ledger.taskId,
      taskNo: ledger.taskId,
      settlementCycleId: cycleFields.settlementCycleId,
      settlementCycleLabel: cycleFields.settlementCycleLabel,
      settlementCycleStartAt: cycleFields.settlementCycleStartAt,
      settlementCycleEndAt: cycleFields.settlementCycleEndAt,
      statementLineGrainType: trace?.caseFact.qcRecord.returnInboundBatchNo ? 'RETURN_INBOUND_BATCH' : 'NON_BATCH_QUALITY',
      returnInboundBatchId: trace?.caseFact.qcRecord.returnInboundBatchNo,
      returnInboundBatchNo: trace?.caseFact.qcRecord.returnInboundBatchNo,
      returnInboundQty: qty,
      qcRecordId: ledger.qcId,
      pendingDeductionRecordId: ledger.pendingRecordId,
      disputeId: ledger.disputeId,
      processLabel: trace?.caseFact.qcRecord.processLabel,
      pricingSourceType: 'NONE',
      earningAmount: 0,
      qualityDeductionAmount: deductionAmount,
      carryOverAdjustmentAmount: 0,
      otherAdjustmentAmount: 0,
      netAmount: -deductionAmount,
    },
    sourceIds: [ledger.ledgerId],
    basisIds: basisId ? [basisId] : [],
  }
}

function buildStatementAppeal(
  statementId: string,
  cycleIndex: number,
  factoryIndex: number,
): StatementFactoryAppealRecord {
  const cycleRef = CYCLE_REFERENCE_DATES[Math.min(cycleIndex + 1, CYCLE_REFERENCE_DATES.length - 1)]
  const handled = cycleIndex <= 1
  return {
    appealId: `STA-LINK-${statementId}`,
    statementId,
    factoryId: `ID-F00${Math.min(factoryIndex + 1, 9)}`,
    status: handled ? 'RESOLVED' : 'SUBMITTED',
    reasonCode: cycleIndex % 2 === 0 ? 'QUALITY_AMOUNT_DIFF' : 'LEDGER_SCOPE_DIFF',
    reasonName: cycleIndex % 2 === 0 ? '质量扣款口径异议' : '正式流水计入口径异议',
    description: '工厂认为部分正式流水的计入口径存在差异，请平台复核。',
    attachments: [],
    evidenceSummary: '回货记录对照表、流水口径说明截图',
    submittedAt: addDays(cycleRef, 1, 13),
    submittedBy: `工厂财务-${factoryIndex + 1}`,
    platformHandledAt: handled ? addDays(cycleRef, 3, 15) : undefined,
    platformHandledBy: handled ? '平台运营' : undefined,
    resolutionAt: handled ? addDays(cycleRef, 3, 15) : undefined,
    resolutionResult: handled ? 'UPHELD' : undefined,
    resolutionComment: handled ? '平台已核对正式流水来源并维持原口径' : undefined,
  }
}

function createStatementSourceRows(
  taskEarningLedgers: PreSettlementLedger[],
  qualityLedgers: ReturnType<typeof listFormalQualityDeductionLedgers>,
): LinkedStatementSourceRow[] {
  const taskRows: LinkedStatementSourceRow[] = taskEarningLedgers.map((ledger) => ({
    sourceItemId: ledger.ledgerId,
    sourceType: 'TASK_EARNING',
    settlementPartyId: ledger.factoryId,
    settlementCycleId: ledger.settlementCycleId,
    settlementCycleLabel: ledger.settlementCycleLabel,
    productionOrderId: ledger.productionOrderId,
    taskId: ledger.taskId,
    returnInboundBatchId: ledger.returnInboundBatchId,
    qty: ledger.qty,
    amount: ledger.settlementAmount,
    currency: ledger.settlementCurrency,
    sourceStatus: ledger.status,
    canEnterStatement: ledger.status === 'OPEN',
    sourceReason: ledger.sourceReason,
    remark: ledger.remark,
  }))

  const qualityRows: LinkedStatementSourceRow[] = qualityLedgers.map((ledger) => {
    const trace = traceQualityDeductionLedgerSource(ledger.ledgerId)
    const settlementPartyId = ledger.settlementPartyId ?? ledger.factoryId
    const cycle = deriveSettlementCycleFields(
      settlementPartyId,
      trace?.caseFact.qcRecord.inboundAt ?? ledger.generatedAt,
    )
    return {
      sourceItemId: ledger.ledgerId,
      sourceType: 'QUALITY_DEDUCTION',
      settlementPartyId,
      settlementCycleId: cycle.settlementCycleId,
      settlementCycleLabel: cycle.settlementCycleLabel,
      productionOrderId: trace?.caseFact.qcRecord.productionOrderNo,
      taskId: ledger.taskId,
      returnInboundBatchId: trace?.caseFact.qcRecord.returnInboundBatchNo,
      qty: trace?.caseFact.deductionBasis?.deductionQty ?? trace?.caseFact.qcRecord.factoryLiabilityQty ?? 1,
      amount: roundAmount(ledger.settlementAmount ?? ledger.originalAmount),
      currency: ledger.settlementCurrency,
      sourceStatus: ledger.status,
      canEnterStatement: ledger.status === 'GENERATED_PENDING_STATEMENT',
      sourceReason: ledger.triggerSource,
      remark: ledger.comment,
    }
  })

  return [...taskRows, ...qualityRows].sort((left, right) => {
    if (left.settlementCycleId !== right.settlementCycleId) {
      return left.settlementCycleId.localeCompare(right.settlementCycleId, 'zh-CN')
    }
    if (left.settlementPartyId !== right.settlementPartyId) {
      return left.settlementPartyId.localeCompare(right.settlementPartyId, 'zh-CN')
    }
    return left.sourceItemId.localeCompare(right.sourceItemId, 'zh-CN')
  })
}

function createStatementDrafts(
  factories: IndonesiaFactory[],
  batchContexts: LinkedReturnBatchContext[],
  qualityLedgers: ReturnType<typeof listFormalQualityDeductionLedgers>,
): StatementDraft[] {
  const linesByFactoryCycle = new Map<string, LinkedStatementLineBuild[]>()

  for (const [batchIndex, batchContext] of batchContexts.entries()) {
    const build = buildStatementLineFromBatch(batchContext, batchIndex)
    const key = `${batchContext.taskContext.factory.id}__${batchContext.cycleId}`
    const existed = linesByFactoryCycle.get(key) ?? []
    existed.push(build)
    linesByFactoryCycle.set(key, existed)
  }

  for (const ledger of qualityLedgers) {
    const settlementPartyId = ledger.settlementPartyId ?? ledger.factoryId
    const line = buildStatementLineFromQualityLedger(ledger)
    const cycleKey = `${settlementPartyId}__${line.item.settlementCycleId}`
    const existed = linesByFactoryCycle.get(cycleKey) ?? []
    existed.push(line)
    linesByFactoryCycle.set(cycleKey, existed)
  }

  const statements: StatementDraft[] = []
  const keys = Array.from(linesByFactoryCycle.keys()).sort((left, right) => left.localeCompare(right))

  for (const [statementSeq, key] of keys.entries()) {
    const [factoryId, settlementCycleId] = key.split('__')
    const factory = factories.find((item) => item.id === factoryId)
    if (!factory) continue
    const lines = linesByFactoryCycle.get(key) ?? []
    if (!lines.length) continue

    const cycleLabel = lines[0].item.settlementCycleLabel ?? settlementCycleId
    const cycleStartAt = lines[0].item.settlementCycleStartAt ?? ''
    const cycleEndAt = lines[0].item.settlementCycleEndAt ?? ''
    const cycleIndex = CYCLE_REFERENCE_DATES.findIndex((dateText) => {
      const fields = deriveSettlementCycleFields(factory.id, dateText)
      return fields.settlementCycleId === settlementCycleId
    })
    const statementId = `ST-LINK-2026-${String(statementSeq + 1).padStart(4, '0')}`
    const status = chooseStatementStatus(cycleIndex === -1 ? 0 : cycleIndex)
    const snapshot = buildSettlementSnapshotForFactoryAt(factory, `${cycleEndAt} 23:59:59`)
    const factoryIndex = factories.findIndex((item) => item.id === factory.id)
    const factoryFeedbackStatus = chooseFactoryFeedbackStatus(status, factoryIndex, cycleIndex === -1 ? 0 : cycleIndex)
    const createdAt = `${cycleEndAt} 18:00:00`
    const appealRecord =
      factoryFeedbackStatus === 'FACTORY_APPEALED' || factoryFeedbackStatus === 'PLATFORM_HANDLING' || factoryFeedbackStatus === 'RESOLVED'
        ? {
            ...buildStatementAppeal(statementId, cycleIndex === -1 ? 0 : cycleIndex, factoryIndex),
            factoryId: factory.id,
            settlementCycleId,
            status:
              factoryFeedbackStatus === 'PLATFORM_HANDLING'
                ? 'PLATFORM_HANDLING'
                : factoryFeedbackStatus === 'RESOLVED'
                  ? 'RESOLVED'
                  : 'SUBMITTED',
          }
        : undefined
    const lineItems = lines
      .filter((line) => {
        if (line.item.sourceItemType !== 'QUALITY_DEDUCTION') return true
        const sourceLedger = qualityLedgers.find((item) => item.ledgerId === line.item.sourceItemId)
        return !sourceLedger || sourceLedger.generatedAt <= createdAt
      })
      .map((line) => line.item)
      .sort((left, right) => {
        const leftIsBatch = left.statementLineGrainType === 'RETURN_INBOUND_BATCH' ? 0 : 1
        const rightIsBatch = right.statementLineGrainType === 'RETURN_INBOUND_BATCH' ? 0 : 1
        if (leftIsBatch !== rightIsBatch) return leftIsBatch - rightIsBatch
        return (left.returnInboundBatchNo ?? left.sourceRefLabel ?? '').localeCompare(
          right.returnInboundBatchNo ?? right.sourceRefLabel ?? '',
        )
      })
    const keptLines = lines.filter((line) =>
      lineItems.some((item) => item.sourceItemId === line.item.sourceItemId),
    )
    const sourceIds = Array.from(new Set(keptLines.flatMap((item) => item.sourceIds)))
    const basisIds = Array.from(new Set(keptLines.flatMap((item) => item.basisIds)))
    const earningLedgerIds = Array.from(
      new Set(lineItems.filter((item) => item.sourceItemType === 'TASK_EARNING').map((item) => item.sourceItemId)),
    )
    const deductionLedgerIds = Array.from(
      new Set(lineItems.filter((item) => item.sourceItemType === 'QUALITY_DEDUCTION').map((item) => item.sourceItemId)),
    )
    const totalEarningAmount = roundAmount(lineItems.reduce((sum, item) => sum + (item.earningAmount ?? 0), 0))
    const totalDeductionAmount = roundAmount(lineItems.reduce((sum, item) => sum + (item.qualityDeductionAmount ?? 0), 0))
    const netPayableAmount = roundAmount(lineItems.reduce((sum, item) => sum + (item.netAmount ?? item.deductionAmount), 0))

    statements.push({
      statementId,
      statementNo: statementId,
      factoryId: factory.id,
      factoryName: factory.name,
      settlementPartyType: 'FACTORY',
      settlementPartyId: factory.id,
      itemCount: lineItems.length,
      totalQty: lineItems.reduce((sum, line) => sum + (line.returnInboundQty ?? line.deductionQty ?? 0), 0),
      totalAmount: netPayableAmount,
      settlementCurrency: snapshot.settlementConfigSnapshot.currency,
      ledgerIds: Array.from(new Set(lineItems.map((item) => item.sourceItemId))),
      earningLedgerIds,
      deductionLedgerIds,
      totalEarningAmount,
      totalDeductionAmount,
      netPayableAmount,
      status,
      itemBasisIds: basisIds,
      itemSourceIds: sourceIds,
      items: lineItems,
      remark: '由任务收入流水与质量扣款流水自动汇总生成',
      settlementProfileSnapshot: snapshot,
      settlementProfileVersionNo: snapshot.versionNo,
      statementPartyView: `${factory.name}（${factory.id}）`,
      settlementCycleId,
      settlementCycleLabel: cycleLabel,
      settlementCycleStartAt: cycleStartAt,
      settlementCycleEndAt: cycleEndAt,
      factoryFeedbackStatus,
      factoryFeedbackAt:
        factoryFeedbackStatus === 'NOT_SENT'
          ? undefined
          : addDays(createdAt, 1, 11),
      factoryFeedbackBy:
        factoryFeedbackStatus === 'FACTORY_CONFIRMED' || factoryFeedbackStatus === 'FACTORY_APPEALED'
          ? `工厂财务-${factoryIndex + 1}`
          : factoryFeedbackStatus === 'RESOLVED'
            ? '平台运营'
            : '平台运营',
      factoryFeedbackRemark:
        factoryFeedbackStatus === 'FACTORY_CONFIRMED'
          ? '工厂已确认本期正式流水口径'
          : factoryFeedbackStatus === 'FACTORY_APPEALED'
            ? '工厂已提交正式流水口径申诉，等待平台处理'
            : factoryFeedbackStatus === 'PLATFORM_HANDLING'
              ? '平台正在处理工厂关于正式流水口径的申诉'
            : factoryFeedbackStatus === 'RESOLVED'
              ? '工厂申诉已处理完成'
              : status === 'PENDING_FACTORY_CONFIRM'
                ? '平台已确认对账单，待工厂反馈'
                : undefined,
      appealSubmittedAt: appealRecord?.submittedAt,
      appealSubmittedBy: appealRecord?.submittedBy,
      platformHandledAt: appealRecord?.platformHandledAt,
      platformHandledBy: appealRecord?.platformHandledBy,
      resolutionAt: appealRecord?.resolutionAt,
      resolutionResult: appealRecord?.resolutionResult,
      resolutionComment: appealRecord?.resolutionComment,
      readyForPrepaymentAt:
        status === 'READY_FOR_PREPAYMENT' && factoryFeedbackStatus !== 'FACTORY_APPEALED' && factoryFeedbackStatus !== 'PLATFORM_HANDLING'
          ? addDays(createdAt, 2, 10)
          : undefined,
      factoryAppealRecord: appealRecord,
      appealRecords: appealRecord ? [appealRecord] : [],
      createdAt,
      createdBy: '平台运营',
      updatedAt: status !== 'DRAFT' ? addDays(createdAt, 2, 16) : undefined,
      updatedBy: status !== 'DRAFT' ? '平台运营' : undefined,
    })
  }

  return statements
}

function buildPayeeAccountSnapshotId(statement: StatementDraft): string {
  return `${statement.settlementProfileVersionNo}:${statement.settlementProfileSnapshot.receivingAccountSnapshot.bankAccountNo}`
}

function mapBatchToApprovalStatus(status: PrepaymentBatchStatus): FeishuPaymentApprovalStatus | null {
  if (status === 'FEISHU_APPROVAL_CREATED') return 'APPROVING'
  if (status === 'FEISHU_PAID_PENDING_WRITEBACK' || status === 'PREPAID' || status === 'CLOSED') return 'PAID'
  if (status === 'FEISHU_APPROVAL_REJECTED') return 'REJECTED'
  if (status === 'FEISHU_APPROVAL_CANCELED') return 'CANCELED'
  return null
}

function createPrepaymentChain(statements: StatementDraft[]): {
  batches: SettlementBatch[]
  approvals: FeishuPaymentApproval[]
  writebacks: PaymentWriteback[]
} {
  const readyByFactory = new Map<string, StatementDraft[]>()
  for (const statement of statements) {
    if (statement.status !== 'READY_FOR_PREPAYMENT') continue
    const existed = readyByFactory.get(statement.settlementPartyId) ?? []
    existed.push(statement)
    readyByFactory.set(statement.settlementPartyId, existed)
  }

  const factoryIds = Array.from(readyByFactory.keys()).sort((left, right) => left.localeCompare(right))
  const statusPlans: Array<{ factoryId: string; status: PrepaymentBatchStatus; statementCount: number }> = []
  if (factoryIds[0]) {
    statusPlans.push({ factoryId: factoryIds[0], status: 'PREPAID', statementCount: 2 })
    statusPlans.push({ factoryId: factoryIds[0], status: 'CLOSED', statementCount: 1 })
  }
  if (factoryIds[1]) statusPlans.push({ factoryId: factoryIds[1], status: 'FEISHU_PAID_PENDING_WRITEBACK', statementCount: 2 })
  if (factoryIds[2]) statusPlans.push({ factoryId: factoryIds[2], status: 'FEISHU_APPROVAL_CREATED', statementCount: 2 })
  if (factoryIds[3]) statusPlans.push({ factoryId: factoryIds[3], status: 'READY_TO_APPLY_PAYMENT', statementCount: 2 })
  if (factoryIds[4]) statusPlans.push({ factoryId: factoryIds[4], status: 'FEISHU_APPROVAL_REJECTED', statementCount: 1 })

  const consumed = new Set<string>()
  const batches: SettlementBatch[] = []
  const approvals: FeishuPaymentApproval[] = []
  const writebacks: PaymentWriteback[] = []

  for (const [index, plan] of statusPlans.entries()) {
    const pool = (readyByFactory.get(plan.factoryId) ?? [])
      .filter((statement) => !consumed.has(statement.statementId))
      .sort((left, right) => left.settlementCycleEndAt!.localeCompare(right.settlementCycleEndAt!))
      .slice(0, plan.statementCount)
    if (pool.length === 0) continue
    pool.forEach((statement) => consumed.add(statement.statementId))

    const first = pool[0]
    const items: SettlementBatchItem[] = pool.map((statement) => ({
      statementId: statement.statementId,
      statementNo: statement.statementNo,
      factoryId: statement.factoryId,
      factoryName: statement.factoryName,
      settlementPartyType: statement.settlementPartyType,
      settlementPartyId: statement.settlementPartyId,
      settlementCycleId: statement.settlementCycleId,
      settlementCycleLabel: statement.settlementCycleLabel,
      totalAmount: statement.totalAmount,
      totalEarningAmount: statement.totalEarningAmount,
      totalDeductionAmount: statement.totalDeductionAmount,
      statementStatus: statement.status,
      settlementProfileVersionNo: statement.settlementProfileVersionNo,
      settlementProfileSnapshot: statement.settlementProfileSnapshot,
      factoryFeedbackStatus: statement.factoryFeedbackStatus,
      resolutionResult: statement.resolutionResult,
    }))
    const snapshotRefs = Array.from(
      new Map(
        items
          .filter((item) => item.settlementProfileSnapshot)
          .map((item) => [item.settlementProfileSnapshot!.versionNo, item.settlementProfileSnapshot!]),
      ).values(),
    )
    const totalEarningAmount = roundAmount(pool.reduce((sum, statement) => sum + (statement.totalEarningAmount ?? 0), 0))
    const totalDeductionAmount = roundAmount(pool.reduce((sum, statement) => sum + (statement.totalDeductionAmount ?? 0), 0))
    const totalPayableAmount = roundAmount(pool.reduce((sum, statement) => sum + statement.totalAmount, 0))
    const createdAt = `${first.settlementCycleEndAt ?? '2026-03-01'} 18:30:00`
    const batchId = `PPB-LINK-${String(index + 1).padStart(4, '0')}`
    const batchNo = `PPB-202603-${String(index + 1).padStart(4, '0')}`
    const payeeAccountSnapshotId = buildPayeeAccountSnapshotId(first)
    const approvalStatus = mapBatchToApprovalStatus(plan.status)
    const appliedForPaymentAt =
      plan.status === 'READY_TO_APPLY_PAYMENT' || plan.status === 'DRAFT'
        ? undefined
        : addDays(createdAt, 1, 10)

    let approvalId: string | undefined
    let approvalNo: string | undefined
    let paymentWritebackId: string | undefined
    let prepaidAt: string | undefined
    let closedAt: string | undefined
    let paymentAmount: number | undefined
    let paymentAt: string | undefined
    let paymentReferenceNo: string | undefined
    let paymentRemark: string | undefined
    let paymentUpdatedAt: string | undefined
    let paymentUpdatedBy: string | undefined
    let paymentSyncStatus: SettlementBatch['paymentSyncStatus']

    if (approvalStatus) {
      approvalId = `FPA-LINK-${String(index + 1).padStart(4, '0')}`
      approvalNo = `FPA-202603-${String(8800 + index).padStart(6, '0')}`
      const paidAt = approvalStatus === 'PAID' ? addDays(createdAt, 3, 15) : undefined
      const approval: FeishuPaymentApproval = {
        approvalId,
        approvalNo,
        batchId,
        factoryId: first.settlementPartyId,
        factoryName: first.factoryName ?? first.settlementPartyId,
        amount: totalPayableAmount,
        currency: first.settlementCurrency ?? first.settlementProfileSnapshot.settlementConfigSnapshot.currency,
        payeeAccountSnapshotId,
        payeeAccountSnapshotVersion: first.settlementProfileVersionNo,
        title: `${first.factoryName ?? first.settlementPartyId}预付款申请`,
        displayTitle: `${first.factoryName ?? first.settlementPartyId} · ${pool.length} 张对账单预付款`,
        status: approvalStatus,
        createdAt: appliedForPaymentAt ?? createdAt,
        createdBy: '财务共享',
        latestSyncedAt:
          plan.status === 'FEISHU_APPROVAL_CREATED'
            ? addDays(createdAt, 2, 11)
            : approvalStatus === 'PAID'
              ? addDays(createdAt, 3, 16)
              : addDays(createdAt, 2, 14),
        approvedAt:
          approvalStatus === 'PAID' || approvalStatus === 'APPROVED_PENDING_PAYMENT'
            ? addDays(createdAt, 2, 18)
            : undefined,
        paidAt,
        rejectedAt: approvalStatus === 'REJECTED' ? addDays(createdAt, 2, 17) : undefined,
        canceledAt: approvalStatus === 'CANCELED' ? addDays(createdAt, 2, 17) : undefined,
        feishuRawStatus: approvalStatus,
        externalStatus: approvalStatus,
        bankReceiptRef: paidAt ? `receipt://feishu/${batchNo}.png` : undefined,
        bankReceiptName: paidAt ? `${batchNo}-bank-receipt.png` : undefined,
        bankSerialNo: paidAt ? `BSN-${String(930000 + index).padStart(8, '0')}` : undefined,
        payerBankAccountName: paidAt ? 'HiGood 运营付款户' : undefined,
        payerBankAccountNoMasked: paidAt ? '6222 **** **** 7812' : undefined,
      }
      approvals.push(approval)

      if (plan.status === 'PREPAID' || plan.status === 'CLOSED') {
        paymentWritebackId = `PWB-LINK-${String(index + 1).padStart(4, '0')}`
        prepaidAt = addDays(paidAt ?? addDays(createdAt, 3, 15), 0, 18)
        closedAt = plan.status === 'CLOSED' ? addDays(prepaidAt, 1, 10) : undefined
        const writeback: PaymentWriteback = {
          writebackId: paymentWritebackId,
          batchId,
          approvalId,
          approvalNo,
          factoryId: first.settlementPartyId,
          factoryName: first.factoryName ?? first.settlementPartyId,
          amount: totalPayableAmount,
          currency: first.settlementCurrency ?? first.settlementProfileSnapshot.settlementConfigSnapshot.currency,
          paidAt: paidAt ?? addDays(createdAt, 3, 15),
          bankReceiptRef: approval.bankReceiptRef ?? `receipt://feishu/${batchNo}.png`,
          bankReceiptName: approval.bankReceiptName ?? `${batchNo}-bank-receipt.png`,
          bankSerialNo: approval.bankSerialNo ?? `BSN-${String(930000 + index).padStart(8, '0')}`,
          payerBankAccountName: approval.payerBankAccountName,
          payerBankAccountNoMasked: approval.payerBankAccountNoMasked,
          payeeAccountSnapshotId,
          payeeAccountSnapshotVersion: first.settlementProfileVersionNo,
          writtenBackAt: prepaidAt,
          writtenBackBy: '财务共享',
          notes: '已根据飞书付款审批结果登记银行回执与流水号',
        }
        writebacks.push(writeback)
        paymentAmount = writeback.amount
        paymentAt = writeback.paidAt
        paymentReferenceNo = writeback.bankSerialNo
        paymentRemark = '已完成打款回写'
        paymentUpdatedAt = writeback.writtenBackAt
        paymentUpdatedBy = writeback.writtenBackBy
        paymentSyncStatus = 'SUCCESS'
      } else if (plan.status === 'FEISHU_PAID_PENDING_WRITEBACK') {
        paymentAmount = approval.amount
        paymentAt = approval.paidAt
        paymentReferenceNo = approval.bankSerialNo
        paymentRemark = '飞书付款审批已显示已付款，待录入正式打款回写'
        paymentUpdatedAt = approval.latestSyncedAt
        paymentUpdatedBy = '财务共享'
        paymentSyncStatus = 'UNSYNCED'
      } else if (plan.status === 'FEISHU_APPROVAL_REJECTED' || plan.status === 'FEISHU_APPROVAL_CANCELED') {
        paymentRemark = plan.status === 'FEISHU_APPROVAL_REJECTED' ? '飞书审批已驳回，待重新申请' : '飞书审批已取消'
        paymentSyncStatus = 'FAILED'
      } else {
        paymentRemark = '已创建飞书付款审批，等待审批通过并付款'
        paymentUpdatedAt = approval.latestSyncedAt
        paymentUpdatedBy = '财务共享'
        paymentSyncStatus = 'UNSYNCED'
      }
    } else {
      paymentRemark = '待申请付款'
      paymentSyncStatus = 'UNSYNCED'
    }

    batches.push({
      batchId,
      batchNo,
      batchName: `预付款批次 ${batchNo}`,
      factoryId: first.settlementPartyId,
      factoryName: first.factoryName ?? first.settlementPartyId,
      settlementCurrency: first.settlementCurrency ?? first.settlementProfileSnapshot.settlementConfigSnapshot.currency,
      payeeAccountSnapshotId,
      payeeAccountSnapshotVersion: first.settlementProfileVersionNo,
      itemCount: items.length,
      totalStatementCount: pool.length,
      totalAmount: totalPayableAmount,
      totalPayableAmount,
      totalEarningAmount,
      totalDeductionAmount,
      status: plan.status,
      statementIds: pool.map((statement) => statement.statementId),
      items,
      remark: '由同一工厂已确认对账单自动组批',
      notes: plan.status === 'READY_TO_APPLY_PAYMENT' ? '待发起飞书付款审批' : undefined,
      createdAt,
      createdBy: '平台财务',
      appliedForPaymentAt,
      feishuApprovalId: approvalId,
      feishuApprovalNo: approvalNo,
      paymentWritebackId,
      prepaidAt,
      closedAt,
      completedAt: prepaidAt,
      archivedAt: closedAt,
      updatedAt: paymentUpdatedAt ?? appliedForPaymentAt ?? createdAt,
      updatedBy: paymentUpdatedBy ?? (appliedForPaymentAt ? '财务共享' : '平台财务'),
      paymentSyncStatus,
      paymentAmount,
      paymentAt,
      paymentReferenceNo,
      paymentRemark,
      paymentUpdatedAt,
      paymentUpdatedBy,
      settlementProfileVersionSummary: Array.from(new Set(items.map((item) => item.settlementProfileVersionNo).filter(Boolean))).join(' / '),
      settlementProfileSnapshotRefs: snapshotRefs,
    })
  }

  return { batches, approvals, writebacks }
}

function getMockFxRate(originalCurrency: string, settlementCurrency: string): number {
  if (originalCurrency === settlementCurrency) return 1
  if (originalCurrency === 'IDR' && settlementCurrency === 'CNY') return 0.00046
  if (originalCurrency === 'CNY' && settlementCurrency === 'IDR') return 2175
  return 1
}

function createTaskEarningLedgers(
  batchContexts: LinkedReturnBatchContext[],
): PreSettlementLedger[] {
  return batchContexts.map((batchContext, index) => {
    const settlementInfo = getSettlementEffectiveInfoByFactoryAt(
      batchContext.taskContext.factory.code,
      batchContext.batch.inboundAt,
    ) ?? getSettlementEffectiveInfoByFactory(batchContext.taskContext.factory.code)
    const originalCurrency =
      batchContext.taskContext.task.dispatchPriceCurrency ??
      batchContext.taskContext.task.standardPriceCurrency ??
      batchContext.taskContext.factory.currency
    const settlementCurrency = settlementInfo?.settlementConfigSnapshot.currency ?? originalCurrency
    const originalAmount = roundAmount(batchContext.taskContext.unitPrice * batchContext.batch.returnedQty)
    const fxRate = getMockFxRate(originalCurrency, settlementCurrency)
    const settlementAmount = roundAmount(originalAmount * fxRate)
    return {
      ledgerId: `PSL-TASK-${String(index + 1).padStart(5, '0')}`,
      ledgerNo: `PSL-TASK-${String(index + 1).padStart(5, '0')}`,
      ledgerType: 'TASK_EARNING',
      direction: 'INCOME',
      sourceType: 'RETURN_INBOUND_BATCH',
      sourceRefId: batchContext.batch.batchId,
      factoryId: batchContext.taskContext.factory.id,
      factoryName: batchContext.taskContext.factory.name,
      taskId: batchContext.taskContext.task.taskId,
      taskNo: batchContext.taskContext.task.taskNo ?? batchContext.taskContext.task.taskId,
      productionOrderId: batchContext.taskContext.productionOrder.productionOrderId,
      productionOrderNo: batchContext.taskContext.productionOrder.legacyOrderNo,
      returnInboundBatchId: batchContext.batch.batchId,
      returnInboundBatchNo: batchContext.batch.batchId,
      priceSourceType: batchContext.taskContext.pricingSourceType === 'BIDDING' ? 'BID' : 'DISPATCH',
      unitPrice: batchContext.taskContext.unitPrice,
      qty: batchContext.batch.returnedQty,
      originalCurrency,
      originalAmount,
      settlementCurrency,
      settlementAmount,
      fxRate,
      fxAppliedAt: batchContext.batch.inboundAt,
      occurredAt: batchContext.batch.inboundAt,
      settlementCycleId: batchContext.cycleId,
      settlementCycleLabel: batchContext.cycleLabel,
      settlementCycleStartAt: batchContext.cycleStartAt,
      settlementCycleEndAt: batchContext.cycleEndAt,
      settlementProfileVersionNo: settlementInfo?.versionNo,
      status: 'OPEN',
      sourceReason:
        batchContext.taskContext.pricingSourceType === 'BIDDING'
          ? '竞价中标价 × 回货数量'
          : '派单价 × 回货数量',
      remark: `回货批次 ${batchContext.batch.batchId} 形成任务收入流水`,
    }
  })
}

function syncStatementsWithPrepaymentBatches(
  statements: StatementDraft[],
  batches: SettlementBatch[],
  approvals: FeishuPaymentApproval[],
  writebacks: PaymentWriteback[],
): StatementDraft[] {
  return statements.map((statement) => {
    const relatedBatch = batches.find((batch) => batch.statementIds.includes(statement.statementId)) ?? null
    if (!relatedBatch) return statement
    const approval = relatedBatch.feishuApprovalId
      ? approvals.find((item) => item.approvalId === relatedBatch.feishuApprovalId) ?? null
      : null
    const writeback = relatedBatch.paymentWritebackId
      ? writebacks.find((item) => item.writebackId === relatedBatch.paymentWritebackId) ?? null
      : null

    return {
      ...statement,
      status: relatedBatch.paymentWritebackId ? 'PREPAID' : 'IN_PREPAYMENT_BATCH',
      prepaymentBatchId: relatedBatch.batchId,
      prepaymentBatchNo: relatedBatch.batchNo,
      prepaymentBatchStatus: relatedBatch.status,
      feishuApprovalId: relatedBatch.feishuApprovalId,
      feishuApprovalNo: relatedBatch.feishuApprovalNo,
      paymentWritebackId: relatedBatch.paymentWritebackId,
      prepaidAt: writeback?.paidAt ?? relatedBatch.prepaidAt,
      closedAt: relatedBatch.closedAt,
      platformHandledAt: statement.platformHandledAt,
      platformHandledBy: statement.platformHandledBy,
      readyForPrepaymentAt: statement.readyForPrepaymentAt ?? statement.updatedAt ?? statement.createdAt,
      updatedAt: writeback?.writtenBackAt ?? approval?.latestSyncedAt ?? relatedBatch.updatedAt ?? statement.updatedAt,
      updatedBy: writeback?.writtenBackBy ?? relatedBatch.updatedBy ?? statement.updatedBy,
    }
  })
}

function reserveStatementBuildScope(statements: StatementDraft[]): StatementDraft[] {
  const reserved = [...statements]
    .filter((statement) => (statement.earningLedgerIds?.length ?? 0) > 0 && (statement.deductionLedgerIds?.length ?? 0) > 0)
    .sort((left, right) => {
      const leftCycle = left.settlementCycleEndAt ?? ''
      const rightCycle = right.settlementCycleEndAt ?? ''
      if (leftCycle !== rightCycle) return leftCycle < rightCycle ? 1 : -1
      return left.createdAt < right.createdAt ? 1 : left.createdAt > right.createdAt ? -1 : 0
    })
    .find((statement) => statement.status === 'DRAFT' || statement.status === 'PENDING_FACTORY_CONFIRM')

  if (!reserved) return statements
  return statements.filter((statement) => statement.statementId !== reserved.statementId)
}

function buildCycleOrder(factories: IndonesiaFactory[]): string[] {
  const keys = new Set<string>()
  for (const factory of factories) {
    for (const dateText of CYCLE_REFERENCE_DATES) {
      const cycle = deriveSettlementCycleFields(factory.id, dateText)
      keys.add(`${cycle.settlementCycleId}|${cycle.settlementCycleStartAt}`)
    }
  }
  return Array.from(keys).sort((left, right) => left.localeCompare(right))
}

function buildSettlementLinkedMockFactory(): SettlementLinkedMockFactoryOutput {
  const factories = LINKED_FACTORY_CODES.map(mapFactoryByCode)
  const productionOrders = createProductionOrders(factories)
  const taskContexts = createProcessTasks(productionOrders)
  const processTasks = taskContexts.map((item) => item.task)
  const returnInboundBatchContexts = createReturnInboundBatches(taskContexts)
  const returnInboundBatches = returnInboundBatchContexts.map((item) => item.batch)
  const qcScenarios = createQcScenarios(returnInboundBatchContexts)
  const cycleOrder = buildCycleOrder(factories)
  const carryOverAdjustments = buildCarryOverAdjustments(qcScenarios, cycleOrder)
  const otherAdjustments = buildOtherAdjustments(factories, cycleOrder)
  const payableAdjustments = [...carryOverAdjustments, ...otherAdjustments]
  const qualityLedgers = listFormalQualityDeductionLedgers({ includeLegacy: false })
  const taskEarningLedgers = createTaskEarningLedgers(returnInboundBatchContexts)
  const statementSourceRows = createStatementSourceRows(taskEarningLedgers, qualityLedgers)
  const statementDrafts = reserveStatementBuildScope(
    createStatementDrafts(factories, returnInboundBatchContexts, qualityLedgers),
  )
  const { batches: settlementBatches, approvals: feishuPaymentApprovals, writebacks: paymentWritebacks } =
    createPrepaymentChain(statementDrafts)
  const syncedStatementDrafts = syncStatementsWithPrepaymentBatches(
    statementDrafts,
    settlementBatches,
    feishuPaymentApprovals,
    paymentWritebacks,
  )
  const statementDraftLines = syncedStatementDrafts.flatMap((item) => item.items)

  return {
    factories,
    productionOrders,
    processTasks,
    returnInboundBatches,
    qcScenarios,
    payableAdjustments,
    taskEarningLedgers,
    statementSourceRows,
    statementDraftLines,
    statementDrafts: syncedStatementDrafts,
    settlementBatches,
    feishuPaymentApprovals,
    paymentWritebacks,
  }
}

export const settlementLinkedMockFactoryOutput = buildSettlementLinkedMockFactory()
