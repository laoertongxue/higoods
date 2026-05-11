import {
  OWN_KNITTING_FACTORY_ID,
  OWN_KNITTING_FACTORY_NAME,
} from './factory-mock-data.ts'
import type {
  PdaTaskMockHandoverHeadSeed,
  PdaTaskMockHandoutRecordSeed,
  PdaTaskMockPickupRecordSeed,
} from './pda-task-mock-factory.ts'
import type { ProcessTask, StartProofFile, TaskStatus } from './process-tasks.ts'
import {
  productionOrders,
  type ProductionOrder,
} from './production-orders.ts'
import {
  getProductionOrderTechPackSnapshot,
} from './production-order-tech-pack-runtime.ts'
import type {
  TechPackPatternFileSnapshot,
} from './production-tech-pack-snapshot-types.ts'
import {
  listRuntimeExecutionTasks,
} from './runtime-process-tasks.ts'
import type { TaskDetailRow } from './task-detail-rows.ts'
import { buildTaskQrValue } from './task-qr.ts'

export type KnittingWorkOrderKind = 'WHOLE_GARMENT' | 'PART_PANEL'

export type KnittingWorkOrderStatus =
  | 'WAIT_ACCEPT'
  | 'WAIT_PICKUP'
  | 'PICKUP_IN_PROGRESS'
  | 'WAIT_MACHINE_SCHEDULE'
  | 'MACHINE_SCHEDULED'
  | 'FLAT_KNITTING'
  | 'WAIT_LINKING'
  | 'LINKING'
  | 'WAIT_IRONING'
  | 'IRONING'
  | 'WAIT_PACKING'
  | 'PACKING'
  | 'WAIT_FEI_TICKET'
  | 'FEI_TICKET_PRINTED'
  | 'WAIT_HANDOVER'
  | 'HANDOVER_SUBMITTED'
  | 'COMPLETED'

export type KnittingNodeStatus = '未开始' | '进行中' | '已完成' | '已跳过'

export type KnittingMachineScheduleStatus = '待开工' | '生产中' | '已完成' | '空闲' | '已取消' | '延误'

export type KnittingMachineStatus = '空闲' | '已排产' | '生产中' | '维修' | '停用'

export interface KnittingMachineScheduleInput {
  machineNos?: string[]
  scheduledStartAt?: string
  scheduledEndAt?: string
  remark?: string
}

export interface KnittingMachine {
  machineId: string
  machineNo: string
  machineName: string
  factoryId: 'OWN_KNITTING_FACTORY'
  factoryName: '周哥针织厂'
  machineGroupId: string
  machineGroupName: string
  needleType: string
  supportedKinds: KnittingWorkOrderKind[]
  status: KnittingMachineStatus
  currentTaskNo?: string
  dailyCapacityText: string
  locationText: string
  ownerName: string
  remark: string
}

export interface KnittingYarnReceipt {
  yarnSku: string
  yarnName: string
  colorName: string
  plannedWeightKg: number
  receivedWeightKg: number
  differenceWeightKg: number
  processingUsageWeightKg?: number
  recoveredWeightKg?: number
  receiverName: string
  receivedAt: string
  evidenceText?: string
}

export interface KnittingExecutionNode {
  nodeName: string
  status: KnittingNodeStatus
  plannedQty: number
  completedQty: number
  unit: string
  operatorName?: string
  machineNos?: string[]
  startedAt?: string
  finishedAt?: string
  yarnLossWeightKg?: number
  remark?: string
}

export interface KnittingPartPanel {
  partName: string
  colorName: string
  sizeCode: string
  plannedPieces: number
  completedPieces: number
  feiTicketNo?: string
  feiTicketStatus: '待打印' | '已打印' | '无需打印'
}

export interface KnittingFeiTicketPrintRecord {
  ticketSourceType: 'KNITTING_PART_PANEL'
  ticketRecordId: string
  ticketNo: string
  feiTicketId: string
  feiTicketNo: string
  originalCutOrderId: string
  originalCutOrderNo: string
  sourceCutOrderNo: string
  productionOrderNo: string
  sourceProductionOrderNo: string
  styleCode: string
  spuCode: string
  materialSku: string
  partName: string
  pieceGroup: string
  pieceDisplayName: string
  color: string
  fabricColor: string
  garmentColor: string
  size: string
  skuSize: string
  quantity: number
  actualCutPieceQty: number
  qty: number
  processTags: string[]
  specialCraftSummary: string
  currentCraftStage: string
  status: 'WAITING_PRINT' | 'PRINTED'
  printStatusLabel: string
  flowStatusLabel: string
  boundPocketNo: string
  sourcePieceInstanceId: string
  sequenceNo: string
  version: string
  reprintCount: number
}

export interface KnittingPriceInfo {
  flatKnittingMinutes: number
  linkingMinutes?: number
  ironingIncluded: boolean
  packagingIncluded: boolean
  formulaStatus: '待公式' | '已估算'
  estimatedDispatchPrice: number
  currency: 'IDR'
  remark: string
}

export interface KnittingMachineSchedule {
  scheduleId: string
  machineGroupName: string
  machineNos: string[]
  knittingOrderId?: string
  plannedStartAt: string
  plannedEndAt: string
  actualStartAt?: string
  actualEndAt?: string
  operatorName?: string
  status: KnittingMachineScheduleStatus
  scheduleSource: '正式排产' | '临时排产' | '空闲预留'
  riskText: string
  remark: string
}

export interface KnittingWorkOrder {
  knittingOrderId: string
  knittingOrderNo: string
  taskNo: string
  kind: KnittingWorkOrderKind
  productionOrderNo: string
  styleNo: string
  styleName: string
  colorName: string
  sizeRange: string
  factoryId: 'OWN_KNITTING_FACTORY'
  factoryName: '周哥针织厂'
  plannedQty: number
  completedQty: number
  qtyUnit: '件' | '片'
  needsPackaging: boolean
  status: KnittingWorkOrderStatus
  downstreamTarget: '后道工厂' | '裁床待交出仓'
  plannedMachineCount: number
  scheduledStartAt: string
  scheduledEndAt: string
  acceptedAt?: string
  acceptedBy?: string
  pickupStartedAt?: string
  pickupCompletedAt?: string
  machineScheduleId?: string
  yarnReceipt: KnittingYarnReceipt
  nodes: KnittingExecutionNode[]
  partPanels: KnittingPartPanel[]
  priceInfo: KnittingPriceInfo
  handoverOrderNo?: string
  handoverQty?: number
  receiverWrittenQty?: number
  handoverDifferenceQty?: number
  evidenceItems: Array<{
    title: string
    description: string
    createdAt: string
    ownerName: string
  }>
  remark?: string
}

export interface KnittingWorkOrderSummary {
  total: number
  wholeGarmentCount: number
  partPanelCount: number
  waitAcceptCount: number
  waitPickupCount: number
  pickupInProgressCount: number
  waitMachineScheduleCount: number
  flatKnittingCount: number
  waitFeiTicketCount: number
  waitHandoverCount: number
  completedCount: number
  plannedQty: number
  completedQty: number
}

export interface KnittingMachineScheduleSummary {
  scheduleCount: number
  scheduledWorkOrderCount: number
  totalMachineCount: number
  inUseMachineCount: number
  idleMachineCount: number
  partPanelScheduleCount: number
  delayedScheduleCount: number
}

export type KnittingWarehouseMode = 'wait-process' | 'wait-handover'

export interface KnittingWarehouseFlowRecord {
  flowId: string
  flowType: '领料入仓' | '加工用料' | '回收入仓' | '加工入仓' | '交出出仓'
  sourceNo: string
  qty: number
  unit: string
  operatedAt: string
  operatorName: string
  remark: string
}

export interface KnittingWarehouseInventoryItem {
  inventoryId: string
  warehouseMode: KnittingWarehouseMode
  knittingOrderId: string
  knittingOrderNo: string
  taskNo: string
  kind: KnittingWorkOrderKind
  productionOrderNo: string
  styleName: string
  yarnSku?: string
  relatedOrderNos?: string[]
  relatedProductionOrderNos?: string[]
  itemName: string
  itemSpec: string
  currentQty: number
  unit: string
  locationText: string
  statusText: string
  flowRecords: KnittingWarehouseFlowRecord[]
}

export interface KnittingYarnRecoveryAssociation {
  knittingOrderId: string
  knittingOrderNo: string
  productionOrderNo: string
  lossWeightKg: number
}

export interface KnittingYarnRecoveryRecord {
  recoveryId: string
  recoveryNo: string
  yarnSku: string
  yarnName: string
  colorName: string
  recoveredWeightKg: number
  operatedAt: string
  operatorName: string
  associations: KnittingYarnRecoveryAssociation[]
  remark: string
}

export interface KnittingWarehouseLocation {
  locationId: string
  warehouseMode: KnittingWarehouseMode
  areaName: string
  locationCode: string
  capacityText: string
  managerName: string
  status: '启用' | '停用'
  remark: string
  updatedAt: string
}

export interface KnittingWaitProcessReceiptRecord {
  recordId: string
  receiptNo: string
  knittingOrderId: string
  knittingOrderNo: string
  productionOrderNo: string
  sourceName: string
  yarnSku: string
  yarnName: string
  plannedWeightKg: number
  receivedWeightKg: number
  differenceWeightKg: number
  evidenceText: string
  receivedAt: string
  statusText: string
}

export interface KnittingWaitProcessUsageRecord {
  recordId: string
  usageNo: string
  recordType: '开工领用' | '缝盘损耗'
  knittingOrderId: string
  knittingOrderNo: string
  taskNo?: string
  productionOrderNo: string
  yarnSku: string
  usedWeightKg: number
  usedAt: string
  nodeName: string
  operatorName: string
  statusText: string
}

export interface KnittingWaitHandoverInboundRecord {
  recordId: string
  inboundNo: string
  knittingOrderId: string
  knittingOrderNo: string
  productionOrderNo: string
  kind: KnittingWorkOrderKind
  itemName: string
  inboundQty: number
  unit: string
  inboundAt: string
  operatorName: string
  statusText: string
}

export interface KnittingWaitHandoverHandoutRecord {
  recordId: string
  handoutNo: string
  knittingOrderId: string
  knittingOrderNo: string
  productionOrderNo: string
  downstreamTarget: KnittingWorkOrder['downstreamTarget']
  handoutQty: number
  receiverWrittenQty?: number
  unit: string
  handoutAt: string
  statusText: string
}

export const KNITTING_KIND_LABEL: Record<KnittingWorkOrderKind, string> = {
  WHOLE_GARMENT: '整件针织',
  PART_PANEL: '部位针织',
}

export const KNITTING_STATUS_LABEL: Record<KnittingWorkOrderStatus, string> = {
  WAIT_ACCEPT: '未接单',
  WAIT_PICKUP: '待领料',
  PICKUP_IN_PROGRESS: '领料中',
  WAIT_MACHINE_SCHEDULE: '待排机',
  MACHINE_SCHEDULED: '待开工',
  FLAT_KNITTING: '横机成片中',
  WAIT_LINKING: '待缝盘',
  LINKING: '缝盘中',
  WAIT_IRONING: '待熨烫',
  IRONING: '熨烫中',
  WAIT_PACKING: '待包装',
  PACKING: '包装中',
  WAIT_FEI_TICKET: '待打印菲票',
  FEI_TICKET_PRINTED: '菲票已打印',
  WAIT_HANDOVER: '待交出',
  HANDOVER_SUBMITTED: '交出已发起',
  COMPLETED: '已完成',
}

export type KnittingWorkOrderActionCode =
  | 'ACCEPT'
  | 'CONFIRM_PICKUP'
  | 'COMPLETE_PICKUP'
  | 'SCHEDULE_MACHINE'
  | 'START_FLAT'
  | 'REPORT_FLAT_MILESTONE'
  | 'COMPLETE_FLAT'
  | 'START_LINKING'
  | 'COMPLETE_LINKING'
  | 'START_IRONING'
  | 'COMPLETE_IRONING'
  | 'START_PACKING'
  | 'COMPLETE_PACKING'
  | 'SKIP_PACKING'
  | 'PRINT_FEI_TICKET'
  | 'SUBMIT_HANDOVER'
  | 'CONFIRM_HANDOVER_RECEIPT'

export interface KnittingAllowedAction {
  code: KnittingWorkOrderActionCode
  label: string
  tone: 'primary' | 'normal' | 'success' | 'warning'
  nodeName?: string
}

interface KnittingDomainStore {
  workOrders: Record<string, KnittingWorkOrder>
  locations: KnittingWarehouseLocation[]
  yarnRecoveryRecords?: KnittingYarnRecoveryRecord[]
}

const KNITTING_DOMAIN_STORE_KEY = 'higood-fcs-knitting-domain-store-v1'

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function nowTimestamp(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function isBusinessTimestamp(value: string | undefined): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(value))
}

function readKnittingStore(): KnittingDomainStore {
  if (typeof window === 'undefined') return { workOrders: {}, locations: [], yarnRecoveryRecords: [] }
  try {
    const raw = window.localStorage.getItem(KNITTING_DOMAIN_STORE_KEY)
    if (!raw) return { workOrders: {}, locations: [], yarnRecoveryRecords: [] }
    const parsed = JSON.parse(raw) as Partial<KnittingDomainStore>
    return {
      workOrders: parsed.workOrders && typeof parsed.workOrders === 'object' ? parsed.workOrders : {},
      locations: Array.isArray(parsed.locations) ? parsed.locations : [],
      yarnRecoveryRecords: Array.isArray(parsed.yarnRecoveryRecords) ? parsed.yarnRecoveryRecords : [],
    }
  } catch {
    return { workOrders: {}, locations: [], yarnRecoveryRecords: [] }
  }
}

function writeKnittingStore(store: KnittingDomainStore): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(KNITTING_DOMAIN_STORE_KEY, JSON.stringify(store))
}

function saveKnittingWorkOrder(order: KnittingWorkOrder): KnittingWorkOrder {
  const store = readKnittingStore()
  store.workOrders[order.knittingOrderId] = cloneValue(order)
  writeKnittingStore(store)
  return cloneValue(order)
}

function isGeneratedKnittingTask(task: ProcessTask): boolean {
  return task.processBusinessCode === 'KNITTING'
    || task.processCode === 'PROC_KNIT'
    || task.processCode === 'KNITTING'
    || task.craftName === '整件针织'
    || task.craftName === '部位针织'
}

function normalizeTaskToken(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'NA'
}

function resolveProductionOrderQty(order: ProductionOrder): number {
  const skuQty = order.demandSnapshot.skuLines.reduce((sum, line) => sum + Math.max(Number(line.qty) || 0, 0), 0)
  return roundQty(skuQty || order.planQty || 0)
}

function getPatternPackageRows(patternFiles: TechPackPatternFileSnapshot[]): TechPackPatternFileSnapshot[] {
  const explicitPackages = patternFiles.filter((item) => item.recordKind === 'PACKAGE')
  return explicitPackages.length > 0 ? explicitPackages : patternFiles
}

function getMixedPatternPartKnittingSources(patternFiles: TechPackPatternFileSnapshot[]): TechPackPatternFileSnapshot[] {
  const materialAssociations = patternFiles.filter((item) => item.recordKind !== 'PACKAGE')
  return materialAssociations.filter((item) => item.patternMaterialType === 'KNIT')
}

function resolvePatternLinkedMaterial(pattern: TechPackPatternFileSnapshot, order: ProductionOrder) {
  return order.techPackSnapshot?.bomItems.find((item) => item.id === pattern.linkedBomItemId)
    ?? order.techPackSnapshot?.bomItems.find((item) => item.id === pattern.linkedMaterialId)
    ?? order.techPackSnapshot?.bomItems.find((item) => item.materialCode === pattern.linkedMaterialSku)
    ?? null
}

function buildPartKnittingDetailRows(input: {
  order: ProductionOrder
  pattern: TechPackPatternFileSnapshot
  taskId: string
}): TaskDetailRow[] {
  const { order, pattern, taskId } = input
  const linkedMaterial = resolvePatternLinkedMaterial(pattern, order)
  const skuLines = order.demandSnapshot.skuLines
  const pieceRows = pattern.pieceRows ?? []
  const rows: TaskDetailRow[] = []

  pieceRows.forEach((piece, pieceIndex) => {
    const enabledQuantities = (piece.colorPieceQuantities ?? []).filter((item) => item.enabled && Number(item.pieceQty) > 0)
    const quantities = enabledQuantities.length > 0
      ? enabledQuantities
      : [{ colorName: '通用', pieceQty: Number(piece.totalPieceQty || piece.count || 1), enabled: true }]

    quantities.forEach((quantity, quantityIndex) => {
      const matchedSkuLines = skuLines.filter((line) => {
        const colorName = String(quantity.colorName || '').trim()
        return !colorName || colorName === '通用' || line.color.trim().toLowerCase() === colorName.toLowerCase()
      })
      const scopedSkuLines = matchedSkuLines.length > 0 ? matchedSkuLines : skuLines
      scopedSkuLines.forEach((skuLine, skuIndex) => {
        const qty = roundQty(Math.max(Number(skuLine.qty) || 0, 0) * Math.max(Number(quantity.pieceQty) || 0, 0))
        if (qty <= 0) return
        const rowKey = `${taskId}-ROW-${pieceIndex + 1}-${quantityIndex + 1}-${skuIndex + 1}`
        rows.push({
          rowKey,
          taskId,
          rowType: 'COMPOSITE',
          rowLabel: `${piece.name || '针织部位'} / ${skuLine.color} / ${skuLine.size}`,
          qty,
          uom: '片',
          dimensions: {
            PATTERN: piece.name || '针织部位',
            GARMENT_COLOR: skuLine.color,
            GARMENT_SKU: skuLine.skuCode,
            MATERIAL_SKU: linkedMaterial?.materialCode || pattern.linkedMaterialSku || pattern.linkedBomItemId || '',
          },
          sourceRefs: {
            orderId: order.productionOrderId,
            spuCode: order.demandSnapshot.spuCode,
            processCode: 'KNITTING',
            sourceEntryId: pattern.id,
            craftCode: 'PART_PANEL_KNIT',
            bomItemId: pattern.linkedBomItemId || pattern.linkedMaterialId || linkedMaterial?.id,
            patternId: pattern.id,
            pieceIds: [piece.id],
            garmentSku: skuLine.skuCode,
            garmentColor: skuLine.color,
          },
          sortKey: [pieceIndex, quantityIndex, skuIndex].map((item) => String(item).padStart(3, '0')).join('-'),
        })
      })
    })
  })

  if (rows.length > 0) return rows
  const fallbackQty = roundQty(resolveProductionOrderQty(order) * Math.max(Number(pattern.patternTotalPieceQty || pattern.totalPieceCount || 1), 1))
  return [{
    rowKey: `${taskId}-ROW-001`,
    taskId,
    rowType: 'COMPOSITE',
    rowLabel: `${pattern.patternName || pattern.patternFileName || '针织部位'} / 按生产单`,
    qty: fallbackQty,
    uom: '片',
    dimensions: {
      PATTERN: pattern.patternName || pattern.patternFileName || '针织部位',
      GARMENT_COLOR: '按生产单',
      MATERIAL_SKU: linkedMaterial?.materialCode || pattern.linkedMaterialSku || pattern.linkedBomItemId || '',
    },
    sourceRefs: {
      orderId: order.productionOrderId,
      spuCode: order.demandSnapshot.spuCode,
      processCode: 'KNITTING',
      sourceEntryId: pattern.id,
      craftCode: 'PART_PANEL_KNIT',
      bomItemId: pattern.linkedBomItemId || pattern.linkedMaterialId || linkedMaterial?.id,
      patternId: pattern.id,
      pieceIds: pieceRows.map((piece) => piece.id),
    },
    sortKey: '999',
  }]
}

function buildSnapshotKnittingTask(input: {
  order: ProductionOrder
  kind: KnittingWorkOrderKind
  index: number
  pattern?: TechPackPatternFileSnapshot
}): ProcessTask {
  const { order, kind, index, pattern } = input
  const suffix = kind === 'WHOLE_GARMENT' ? 'WHOLE' : `PART-${normalizeTaskToken(pattern?.id || String(index + 1))}`
  const taskId = `TASK-KNIT-${normalizeTaskToken(order.productionOrderId)}-${suffix}`
  const detailRows = kind === 'PART_PANEL' && pattern
    ? buildPartKnittingDetailRows({ order, pattern, taskId })
    : []
  const qty = kind === 'PART_PANEL'
    ? roundQty(detailRows.reduce((sum, row) => sum + row.qty, 0))
    : resolveProductionOrderQty(order)
  const isStarted = index % 2 === 0
  const craftName = kind === 'PART_PANEL' ? '部位针织' : '整件针织'

  return {
    taskId,
    taskNo: taskId,
    productionOrderId: order.productionOrderId,
    seq: 350 + index,
    processCode: 'PROC_KNIT',
    processNameZh: '针织',
    stage: 'SPECIAL',
    qty,
    qtyUnit: 'PIECE',
    assignmentMode: 'DIRECT',
    assignmentStatus: 'ASSIGNED',
    ownerSuggestion: {
      kind: 'RECOMMENDED_FACTORY_POOL',
      recommendedTier: 'CENTRAL',
      recommendedTypes: ['OWN_KNITTING_FACTORY'],
      requiredTags: ['针织'],
    },
    assignedFactoryId: OWN_KNITTING_FACTORY_ID,
    assignedFactoryName: OWN_KNITTING_FACTORY_NAME,
    qcPoints: [],
    stdTimeMinutes: kind === 'PART_PANEL' ? 2.5 : 18,
    difficulty: 'MEDIUM',
    publishedSamPerUnit: kind === 'PART_PANEL' ? 2.5 : 18,
    publishedSamUnit: '分钟/件',
    publishedSamDifficulty: 'MEDIUM',
    attachments: [],
    status: isStarted ? 'IN_PROGRESS' : 'NOT_STARTED',
    acceptanceStatus: isStarted ? 'ACCEPTED' : 'PENDING',
    acceptedAt: isStarted ? '2026-05-09 08:20' : undefined,
    acceptedBy: isStarted ? OWN_KNITTING_FACTORY_NAME : undefined,
    acceptDeadline: '2026-05-11 18:00',
    taskDeadline: '2026-05-14 20:00',
    dispatchRemark: kind === 'PART_PANEL'
      ? '生产单生成时按物料&针织纸样关联自动生成部位针织加工单。'
      : '生产单生成时判定全部纸样包为针织类型，自动生成整件针织加工单。',
    dispatchedAt: order.createdAt,
    dispatchedBy: '系统',
    startedAt: isStarted ? '2026-05-09 09:15' : undefined,
    processBusinessCode: 'KNITTING',
    processBusinessName: '针织',
    craftCode: kind === 'PART_PANEL' ? 'PART_PANEL_KNIT' : 'WHOLE_GARMENT_KNIT',
    craftName,
    taskCategoryZh: craftName,
    sourceEntryId: pattern?.id || order.techPackSnapshot?.snapshotId || order.productionOrderId,
    sourceEntryType: 'CRAFT',
    stageCode: 'PROD',
    stageName: '生产阶段',
    taskScope: 'EXTERNAL_TASK',
    assignmentGranularity: kind === 'PART_PANEL' ? 'DETAIL' : 'SKU',
    ruleSource: 'OVERRIDE_CRAFT',
    detailSplitMode: 'COMPOSITE',
    detailSplitDimensions: kind === 'PART_PANEL' ? ['PATTERN', 'GARMENT_SKU'] : ['GARMENT_SKU'],
    detailRows,
    detailRowKeys: detailRows.map((row) => row.rowKey),
    executionEnabled: true,
    defaultDocType: 'TASK',
    taskTypeMode: 'CRAFT',
    isSpecialCraft: false,
    knittingTaskType: kind,
    knittingKind: kind,
    knittingKindLabel: craftName,
    knittingOrderId: `KNIT-${normalizeTaskToken(order.productionOrderId)}-${suffix}`,
    knittingOrderNo: `针织单-${order.productionOrderNo.replace(/^PO-?/, '')}-${String(index + 1).padStart(2, '0')}`,
    knittingDownstreamTarget: kind === 'PART_PANEL' ? '裁床待交出仓' : '后道工厂',
    requiresFeiTicket: kind === 'PART_PANEL',
    packagingRequired: false,
    materialIssueMode: 'WAREHOUSE_DELIVERY',
    mockReceiveSummary: '染厂/面料仓送料到针织厂，针织厂称重确认并上传照片视频。',
    mockExecutionSummary: kind === 'PART_PANEL' ? '横机成片完成后进入菲票打印。' : '整件针织完成后交后道工厂。',
    mockHandoverSummary: kind === 'PART_PANEL' ? '完成后交裁床待交出仓。' : '完成后交后道工厂。',
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    auditLogs: [
      {
        id: `AL-${taskId}-CREATE`,
        action: 'CREATED',
        detail: kind === 'PART_PANEL'
          ? '由生产单技术包物料&针织纸样关联生成部位针织加工单'
          : '由生产单技术包全针织纸样包判断生成整件针织加工单',
        at: order.createdAt,
        by: '系统',
      },
    ],
  }
}

function buildSnapshotDrivenKnittingTasks(): ProcessTask[] {
  const tasks: ProcessTask[] = []
  productionOrders.forEach((order) => {
    const snapshot = getProductionOrderTechPackSnapshot(order.productionOrderId)
    if (!snapshot) return
    const patternPackages = getPatternPackageRows(snapshot.patternFiles)
    if (patternPackages.length === 0) return

    const allPatternPackagesAreKnit = patternPackages.every((item) => item.patternMaterialType === 'KNIT')
    if (allPatternPackagesAreKnit) {
      tasks.push(buildSnapshotKnittingTask({
        order,
        kind: 'WHOLE_GARMENT',
        index: tasks.length,
      }))
      return
    }

    getMixedPatternPartKnittingSources(snapshot.patternFiles).forEach((pattern) => {
      tasks.push(buildSnapshotKnittingTask({
        order,
        kind: 'PART_PANEL',
        index: tasks.length,
        pattern,
      }))
    })
  })
  return tasks
}

function listGeneratedKnittingTasks(): ProcessTask[] {
  const snapshotDrivenTasks = buildSnapshotDrivenKnittingTasks()
  const snapshotOrderIds = new Set(snapshotDrivenTasks.map((task) => task.productionOrderId))
  const runtimeTasks = listRuntimeExecutionTasks()
    .filter((task) => task.defaultDocType !== 'DEMAND')
    .filter(isGeneratedKnittingTask)
    .filter((task) => !snapshotOrderIds.has(task.productionOrderId))

  return [...snapshotDrivenTasks, ...runtimeTasks]
    .sort((left, right) => {
      if (left.productionOrderId !== right.productionOrderId) return left.productionOrderId.localeCompare(right.productionOrderId)
      if (left.seq !== right.seq) return left.seq - right.seq
      return left.taskId.localeCompare(right.taskId)
    })
}

function roundQty(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0
  return Math.round(value * 100) / 100
}

function resolveKnittingKind(task: ProcessTask): KnittingWorkOrderKind {
  if (task.knittingTaskType === 'PART_PANEL' || task.knittingKind === 'PART_PANEL') return 'PART_PANEL'
  if (task.craftName === '部位针织' || task.taskCategoryZh === '部位针织') return 'PART_PANEL'
  return 'WHOLE_GARMENT'
}

function resolveOrderSkuSizeRange(task: ProcessTask): string {
  const order = productionOrders.find((item) => item.productionOrderId === task.productionOrderId)
  const sizes = Array.from(new Set(order?.demandSnapshot.skuLines.map((line) => line.size).filter(Boolean) ?? []))
  return sizes.length ? sizes.join('-') : '整单'
}

function resolveOrderColorName(task: ProcessTask): string {
  const order = productionOrders.find((item) => item.productionOrderId === task.productionOrderId)
  const colors = Array.from(new Set(order?.demandSnapshot.skuLines.map((line) => line.color).filter(Boolean) ?? []))
  return colors.length ? colors.join(' / ') : '按生产单'
}

function resolvePlannedQty(task: ProcessTask, kind: KnittingWorkOrderKind): number {
  if (kind === 'PART_PANEL') {
    const detailQty = task.detailRows?.reduce((sum, row) => sum + row.qty, 0) ?? 0
    return roundQty(detailQty || task.qty)
  }
  return roundQty(task.qty)
}

function resolveCompletedQty(task: ProcessTask, plannedQty: number, kind: KnittingWorkOrderKind): number {
  if (task.status === 'DONE') return plannedQty
  if (task.status === 'NOT_STARTED') return 0
  if (kind === 'PART_PANEL') return plannedQty
  return roundQty(plannedQty * 0.58)
}

function resolveYarnReceipt(task: ProcessTask, kind: KnittingWorkOrderKind, plannedQty: number): KnittingYarnReceipt {
  const snapshot = getProductionOrderTechPackSnapshot(task.productionOrderId)
  const yarnBom = snapshot?.bomItems.find((item) => {
    const usage = item.usageProcessCodes ?? []
    return usage.includes('KNITTING') || /纱|线|yarn/i.test(`${item.id} ${item.name}`)
  })
  const plannedWeightKg = roundQty(task.yarnPlannedWeightKg ?? (
    yarnBom ? plannedQty * Math.max(yarnBom.unitConsumption || 0, kind === 'PART_PANEL' ? 0.08 : 0.48) * (1 + Math.max(yarnBom.lossRate || 0, 0)) : plannedQty * (kind === 'PART_PANEL' ? 0.08 : 0.48)
  ))
  const hasAccepted = task.acceptanceStatus === 'ACCEPTED' || Boolean(task.acceptedAt) || task.status === 'IN_PROGRESS' || task.status === 'DONE'
  const receivedWeightKg = roundQty(task.yarnReceivedWeightKg ?? (hasAccepted ? plannedWeightKg : 0))
  return {
    yarnSku: task.yarnSku || yarnBom?.id || (kind === 'PART_PANEL' ? 'YARN-RIB-PART' : 'YARN-WHOLE-GARMENT'),
    yarnName: yarnBom?.name || (kind === 'PART_PANEL' ? '针织部位纱线' : '整件针织纱线'),
    colorName: resolveOrderColorName(task),
    plannedWeightKg,
    receivedWeightKg,
    differenceWeightKg: roundQty(receivedWeightKg - plannedWeightKg),
    receiverName: '周哥',
    receivedAt: task.acceptedAt || '2026-05-09 08:20',
    evidenceText: '称重照片 1 张，到货视频 1 段',
  }
}

function makeNodeStatus(task: ProcessTask, completedQty: number, plannedQty: number): KnittingNodeStatus {
  if (task.status === 'NOT_STARTED') return '未开始'
  if (completedQty >= plannedQty && plannedQty > 0) return '已完成'
  return '进行中'
}

function buildGeneratedKnittingNodes(
  task: ProcessTask,
  kind: KnittingWorkOrderKind,
  plannedQty: number,
  completedQty: number,
  needsPackaging: boolean,
  machineNos: string[],
): KnittingExecutionNode[] {
  const flatStatus = makeNodeStatus(task, completedQty, plannedQty)
  if (kind === 'PART_PANEL') {
    return [
      {
        nodeName: '横机成片',
        status: flatStatus,
        plannedQty,
        completedQty,
        unit: '片',
        operatorName: '针织车间',
        machineNos,
        startedAt: task.startedAt,
        finishedAt: flatStatus === '已完成' ? task.finishedAt || '2026-05-10 16:30' : undefined,
        remark: '部位针织完成后打印菲票，交裁床待交出仓。',
      },
    ]
  }

  return [
    {
      nodeName: '横机成片',
      status: flatStatus,
      plannedQty,
      completedQty: flatStatus === '未开始' ? 0 : Math.min(plannedQty, Math.max(completedQty, Math.round(plannedQty * 0.5))),
      unit: '件',
      operatorName: '针织车间',
      machineNos,
      startedAt: task.startedAt,
      finishedAt: flatStatus === '已完成' ? task.finishedAt || '2026-05-09 18:30' : undefined,
      remark: flatStatus === '未开始' ? '待开工后上报首批横机节点。' : '首批横机节点已上报。',
    },
    {
      nodeName: '缝盘',
      status: completedQty > plannedQty * 0.35 ? '进行中' : '未开始',
      plannedQty,
      completedQty: roundQty(Math.min(plannedQty, completedQty * 0.72)),
      unit: '件',
      operatorName: '缝盘组',
      startedAt: completedQty > plannedQty * 0.35 ? '2026-05-10 08:30' : undefined,
    },
    {
      nodeName: '熨烫',
      status: completedQty > plannedQty * 0.5 ? '进行中' : '未开始',
      plannedQty,
      completedQty: roundQty(Math.min(plannedQty, completedQty * 0.42)),
      unit: '件',
      operatorName: '熨烫组',
      startedAt: completedQty > plannedQty * 0.5 ? '2026-05-10 13:20' : undefined,
      remark: '整件针织必经熨烫。',
    },
    {
      nodeName: '包装',
      status: needsPackaging ? '未开始' : '已跳过',
      plannedQty,
      completedQty: 0,
      unit: '件',
      remark: needsPackaging ? '按任务配置待包装。' : '当前任务未要求针织厂包装。',
    },
  ]
}

function resolveGeneratedStatus(task: ProcessTask, kind: KnittingWorkOrderKind): KnittingWorkOrderStatus {
  if (task.status === 'DONE') return 'COMPLETED'
  if (task.acceptanceStatus !== 'ACCEPTED' && !task.acceptedAt && task.status === 'NOT_STARTED') return 'WAIT_ACCEPT'
  if (task.status === 'NOT_STARTED') return 'WAIT_PICKUP'
  if (kind === 'PART_PANEL') return 'WAIT_FEI_TICKET'
  if (task.packagingRequired) return 'IRONING'
  return 'WAIT_HANDOVER'
}

function parseSizeFromSku(skuCode: string): string {
  const segments = skuCode.split('-').filter(Boolean)
  return segments[segments.length - 1] || '-'
}

function buildGeneratedPartPanels(task: ProcessTask, completedRatio: number): KnittingPartPanel[] {
  const rows = task.detailRows ?? []
  return rows.map((row, index) => {
    const partName = row.dimensions.PATTERN || row.rowLabel || '针织部位'
    const colorName = row.sourceRefs.garmentColor || row.dimensions.GARMENT_COLOR || resolveOrderColorName(task)
    const skuCode = row.sourceRefs.garmentSku || row.dimensions.GARMENT_SKU || ''
    const plannedPieces = roundQty(row.qty)
    const completedPieces = roundQty(plannedPieces * completedRatio)
    return {
      partName,
      colorName,
      sizeCode: parseSizeFromSku(skuCode),
      plannedPieces,
      completedPieces,
      feiTicketNo: `KFEI-${task.taskId.replace(/[^A-Z0-9]+/gi, '-')}-${String(index + 1).padStart(2, '0')}`,
      feiTicketStatus: '待打印',
    }
  })
}

function buildGeneratedKnittingWorkOrder(task: ProcessTask, index: number): KnittingWorkOrder {
  const kind = resolveKnittingKind(task)
  const order = productionOrders.find((item) => item.productionOrderId === task.productionOrderId)
  const plannedQty = resolvePlannedQty(task, kind)
  const completedQty = resolveCompletedQty(task, plannedQty, kind)
  const needsPackaging = kind === 'WHOLE_GARMENT' && Boolean(task.packagingRequired)
  const downstreamTarget = kind === 'PART_PANEL' ? '裁床待交出仓' : '后道工厂'
  const yarnReceipt = resolveYarnReceipt(task, kind, plannedQty)
  const status = resolveGeneratedStatus(task, kind)
  const orderNo = task.knittingOrderNo || `针织单-${task.productionOrderId.replace('PO-', '')}-${String(index + 1).padStart(2, '0')}`
  const isScheduled = task.status === 'IN_PROGRESS' || task.status === 'DONE' || Boolean(task.startedAt)
  const machineScheduleId = isScheduled ? `KMS-${task.taskId}` : undefined
  const machineStart = index * 4 + 1
  const machineNos = isScheduled
    ? Array.from({ length: Math.min(kind === 'PART_PANEL' ? 4 : 6, kind === 'PART_PANEL' ? 4 : 6) }, (_, offset) => `H-${String(machineStart + offset).padStart(3, '0')}`)
    : []
  const partPanels = kind === 'PART_PANEL'
    ? buildGeneratedPartPanels(task, task.status === 'NOT_STARTED' ? 0 : 1)
    : []

  return {
    knittingOrderId: task.knittingOrderId || task.taskId,
    knittingOrderNo: orderNo,
    kind,
    productionOrderNo: order?.productionOrderNo || task.productionOrderId,
    styleNo: order?.demandSnapshot.spuCode || task.productionOrderId,
    styleName: order?.demandSnapshot.spuName || task.processNameZh,
    colorName: resolveOrderColorName(task),
    sizeRange: resolveOrderSkuSizeRange(task),
    factoryId: 'OWN_KNITTING_FACTORY',
    factoryName: '周哥针织厂',
    plannedQty,
    completedQty,
    qtyUnit: kind === 'PART_PANEL' ? '片' : '件',
    needsPackaging,
    status,
    downstreamTarget,
    plannedMachineCount: kind === 'PART_PANEL' ? 8 : 24,
    scheduledStartAt: task.startedAt || task.acceptedAt || '2026-05-09 09:00',
    scheduledEndAt: task.taskDeadline || '2026-05-12 20:00',
    taskNo: task.taskId,
    acceptedAt: task.acceptedAt,
    acceptedBy: task.acceptedBy,
    pickupStartedAt: yarnReceipt.receivedWeightKg > 0 ? yarnReceipt.receivedAt : undefined,
    pickupCompletedAt: yarnReceipt.receivedWeightKg > 0 ? yarnReceipt.receivedAt : undefined,
    machineScheduleId,
    yarnReceipt,
    nodes: buildGeneratedKnittingNodes(task, kind, plannedQty, completedQty, needsPackaging, machineNos),
    partPanels,
    priceInfo: {
      flatKnittingMinutes: kind === 'PART_PANEL' ? 0.45 : 3.2,
      linkingMinutes: kind === 'WHOLE_GARMENT' ? 1.1 : undefined,
      ironingIncluded: kind === 'WHOLE_GARMENT',
      packagingIncluded: needsPackaging,
      formulaStatus: '已估算',
      estimatedDispatchPrice: kind === 'PART_PANEL' ? 850 : 8200,
      currency: 'IDR',
      remark: kind === 'PART_PANEL'
        ? '部位针织按片估算，不含缝盘、熨烫、包装。'
        : `整件针织含横机、缝盘、熨烫${needsPackaging ? '、包装' : ''}。`,
    },
    handoverOrderNo: status === 'WAIT_HANDOVER' || status === 'COMPLETED' ? `交出-${orderNo}` : undefined,
    handoverQty: status === 'WAIT_HANDOVER' || status === 'COMPLETED' ? completedQty : undefined,
    receiverWrittenQty: status === 'COMPLETED' ? completedQty : undefined,
    handoverDifferenceQty: 0,
    evidenceItems: [
      {
        title: '纱线收料确认',
        description: yarnReceipt.evidenceText || '已上传称重凭证',
        createdAt: yarnReceipt.receivedAt,
        ownerName: OWN_KNITTING_FACTORY_NAME,
      },
      {
        title: '关键节点上报',
        description: task.milestoneRuleLabel || '首批横机完成后已上报',
        createdAt: task.milestoneReportedAt || task.startedAt || yarnReceipt.receivedAt,
        ownerName: OWN_KNITTING_FACTORY_NAME,
      },
    ],
    remark: task.dispatchRemark,
  }
}

function buildGeneratedKnittingWorkOrders(): KnittingWorkOrder[] {
  return listGeneratedKnittingTasks().map((task, index) => buildGeneratedKnittingWorkOrder(task, index))
}

function buildManualSeedKnittingWorkOrders(): KnittingWorkOrder[] {
  const baseOrders = productionOrders.length ? productionOrders : []
  const wholeProduction = baseOrders[0]
  const partProduction = baseOrders[1] ?? baseOrders[0]
  const wholeStyleNo = wholeProduction?.demandSnapshot.spuCode || 'SPU-KNIT-WHOLE'
  const wholeStyleName = wholeProduction?.demandSnapshot.spuName || '整件针织演示款'
  const partStyleNo = partProduction?.demandSnapshot.spuCode || 'SPU-KNIT-PART'
  const partStyleName = partProduction?.demandSnapshot.spuName || '部位针织演示款'
  const makePrice = (kind: KnittingWorkOrderKind, needsPackaging: boolean): KnittingPriceInfo => ({
    flatKnittingMinutes: kind === 'PART_PANEL' ? 0.45 : 3.2,
    linkingMinutes: kind === 'WHOLE_GARMENT' ? 1.1 : undefined,
    ironingIncluded: kind === 'WHOLE_GARMENT',
    packagingIncluded: needsPackaging,
    formulaStatus: '已估算',
    estimatedDispatchPrice: kind === 'PART_PANEL' ? 850 : 8200,
    currency: 'IDR',
    remark: kind === 'PART_PANEL' ? '部位针织按片估算。' : '整件针织按件估算。',
  })

  const wholePlannedQty = 420
  const partPlannedQty = 1260
  return [
    {
      knittingOrderId: 'KNIT-MOCK-WHOLE-WAIT-ACCEPT',
      knittingOrderNo: '针织单-手动-整件-001',
      kind: 'WHOLE_GARMENT',
      productionOrderNo: wholeProduction?.productionOrderNo || 'PO-KNIT-WHOLE-001',
      styleNo: wholeStyleNo,
      styleName: wholeStyleName,
      colorName: '黑色 / 白色',
      sizeRange: 'S-M-L-XL',
      factoryId: 'OWN_KNITTING_FACTORY',
      factoryName: '周哥针织厂',
      plannedQty: wholePlannedQty,
      completedQty: 0,
      qtyUnit: '件',
      needsPackaging: false,
      status: 'WAIT_ACCEPT',
      downstreamTarget: '后道工厂',
      plannedMachineCount: 18,
      scheduledStartAt: '2026-05-11 09:00',
      scheduledEndAt: '2026-05-14 20:00',
      taskNo: '任务-针织-手动-整件-001',
      yarnReceipt: {
        yarnSku: 'YARN-WHOLE-BLK-WHT',
        yarnName: '整件针织纱线',
        colorName: '黑色 / 白色',
        plannedWeightKg: 201.6,
        receivedWeightKg: 0,
        differenceWeightKg: 0,
        receiverName: '待接单',
        receivedAt: '待接单',
        evidenceText: '接单后由染厂/面料仓送料到厂，针织厂确认本次领料并上传照片视频。',
      },
      nodes: [
        { nodeName: '横机成片', status: '未开始', plannedQty: wholePlannedQty, completedQty: 0, unit: '件', machineNos: [] },
        { nodeName: '缝盘', status: '未开始', plannedQty: wholePlannedQty, completedQty: 0, unit: '件' },
        { nodeName: '熨烫', status: '未开始', plannedQty: wholePlannedQty, completedQty: 0, unit: '件', remark: '整件针织必经熨烫。' },
        { nodeName: '包装', status: '已跳过', plannedQty: wholePlannedQty, completedQty: 0, unit: '件', remark: '当前整件针织单暂不要求针织厂包装。' },
      ],
      partPanels: [],
      priceInfo: makePrice('WHOLE_GARMENT', false),
      evidenceItems: [],
      remark: 'Web 或移动端均可接单后继续操作节点。',
    },
    {
      knittingOrderId: 'KNIT-MOCK-PART-WAIT-ACCEPT',
      knittingOrderNo: '针织单-手动-部位-001',
      kind: 'PART_PANEL',
      productionOrderNo: partProduction?.productionOrderNo || 'PO-KNIT-PART-001',
      styleNo: partStyleNo,
      styleName: partStyleName,
      colorName: '藏青',
      sizeRange: 'S-M-L',
      factoryId: 'OWN_KNITTING_FACTORY',
      factoryName: '周哥针织厂',
      plannedQty: partPlannedQty,
      completedQty: 0,
      qtyUnit: '片',
      needsPackaging: false,
      status: 'WAIT_ACCEPT',
      downstreamTarget: '裁床待交出仓',
      plannedMachineCount: 8,
      scheduledStartAt: '2026-05-11 10:00',
      scheduledEndAt: '2026-05-13 18:00',
      taskNo: '任务-针织-手动-部位-001',
      yarnReceipt: {
        yarnSku: 'YARN-PART-NVY',
        yarnName: '罗纹部位纱线',
        colorName: '藏青',
        plannedWeightKg: 100.8,
        receivedWeightKg: 0,
        differenceWeightKg: 0,
        receiverName: '待接单',
        receivedAt: '待接单',
        evidenceText: '接单后确认本次领料，横机成片完成后打印针织菲票。',
      },
      nodes: [
        { nodeName: '横机成片', status: '未开始', plannedQty: partPlannedQty, completedQty: 0, unit: '片', machineNos: [], remark: '部位针织完成后按部位打印菲票。' },
      ],
      partPanels: ['前片罗纹', '后片罗纹', '袖口罗纹'].map((partName, index) => ({
        partName,
        colorName: '藏青',
        sizeCode: ['S', 'M', 'L'][index] || 'S',
        plannedPieces: 420,
        completedPieces: 0,
        feiTicketNo: `KFEI-MANUAL-PART-001-${String(index + 1).padStart(2, '0')}`,
        feiTicketStatus: '待打印',
      })),
      priceInfo: makePrice('PART_PANEL', false),
      evidenceItems: [],
      remark: '部位针织不进入缝盘、熨烫、包装节点。',
    },
    {
      knittingOrderId: 'KNIT-MOCK-WHOLE-WAIT-MACHINE',
      knittingOrderNo: '针织单-手动-整件-待排机',
      kind: 'WHOLE_GARMENT',
      productionOrderNo: wholeProduction?.productionOrderNo || 'PO-KNIT-WHOLE-002',
      styleNo: wholeStyleNo,
      styleName: wholeStyleName,
      colorName: '黑色 / 白色',
      sizeRange: 'S-M-L-XL',
      factoryId: 'OWN_KNITTING_FACTORY',
      factoryName: '周哥针织厂',
      plannedQty: 520,
      completedQty: 0,
      qtyUnit: '件',
      needsPackaging: false,
      status: 'WAIT_MACHINE_SCHEDULE',
      downstreamTarget: '后道工厂',
      plannedMachineCount: 18,
      scheduledStartAt: '2026-05-12 09:00',
      scheduledEndAt: '2026-05-15 20:00',
      taskNo: '任务-针织-手动-整件-待排机',
      acceptedAt: '2026-05-11 08:20',
      acceptedBy: OWN_KNITTING_FACTORY_NAME,
      pickupStartedAt: '2026-05-11 09:00',
      pickupCompletedAt: '2026-05-11 09:30',
      yarnReceipt: {
        yarnSku: 'YARN-WHOLE-WAIT-MACHINE',
        yarnName: '整件针织纱线',
        colorName: '黑色 / 白色',
        plannedWeightKg: 249.6,
        receivedWeightKg: 249.6,
        differenceWeightKg: 0,
        receiverName: '周哥',
        receivedAt: '2026-05-11 09:00',
        evidenceText: '确认本次领料并完成领料单，待排横机。',
      },
      nodes: [
        { nodeName: '横机成片', status: '未开始', plannedQty: 520, completedQty: 0, unit: '件', machineNos: [] },
        { nodeName: '缝盘', status: '未开始', plannedQty: 520, completedQty: 0, unit: '件' },
        { nodeName: '熨烫', status: '未开始', plannedQty: 520, completedQty: 0, unit: '件', remark: '整件针织必经熨烫。' },
        { nodeName: '包装', status: '已跳过', plannedQty: 520, completedQty: 0, unit: '件', remark: '当前整件针织单暂不要求针织厂包装。' },
      ],
      partPanels: [],
      priceInfo: makePrice('WHOLE_GARMENT', false),
      evidenceItems: [],
      remark: '领料完成但未排机，不允许开工。',
    },
    {
      knittingOrderId: 'KNIT-MOCK-WHOLE-MACHINE-SCHEDULED',
      knittingOrderNo: '针织单-手动-整件-待开工',
      kind: 'WHOLE_GARMENT',
      productionOrderNo: wholeProduction?.productionOrderNo || 'PO-KNIT-WHOLE-003',
      styleNo: wholeStyleNo,
      styleName: wholeStyleName,
      colorName: '米白',
      sizeRange: 'S-M-L-XL',
      factoryId: 'OWN_KNITTING_FACTORY',
      factoryName: '周哥针织厂',
      plannedQty: 680,
      completedQty: 0,
      qtyUnit: '件',
      needsPackaging: false,
      status: 'MACHINE_SCHEDULED',
      downstreamTarget: '后道工厂',
      plannedMachineCount: 24,
      scheduledStartAt: '2026-05-12 10:00',
      scheduledEndAt: '2026-05-15 20:00',
      taskNo: '任务-针织-手动-整件-待开工',
      acceptedAt: '2026-05-11 08:30',
      acceptedBy: OWN_KNITTING_FACTORY_NAME,
      pickupStartedAt: '2026-05-11 09:10',
      pickupCompletedAt: '2026-05-11 09:40',
      machineScheduleId: 'KMS-MOCK-WHOLE-MACHINE-SCHEDULED',
      yarnReceipt: {
        yarnSku: 'YARN-WHOLE-CREAM',
        yarnName: '整件针织纱线',
        colorName: '米白',
        plannedWeightKg: 326.4,
        receivedWeightKg: 326.4,
        differenceWeightKg: 0,
        receiverName: '周哥',
        receivedAt: '2026-05-11 09:10',
        evidenceText: '领料单已完成，横机已排产，待开工。',
      },
      nodes: [
        { nodeName: '横机成片', status: '未开始', plannedQty: 680, completedQty: 0, unit: '件', machineNos: ['H-011', 'H-012', 'H-013', 'H-014', 'H-015', 'H-016'] },
        { nodeName: '缝盘', status: '未开始', plannedQty: 680, completedQty: 0, unit: '件' },
        { nodeName: '熨烫', status: '未开始', plannedQty: 680, completedQty: 0, unit: '件', remark: '整件针织必经熨烫。' },
        { nodeName: '包装', status: '已跳过', plannedQty: 680, completedQty: 0, unit: '件', remark: '当前整件针织单暂不要求针织厂包装。' },
      ],
      partPanels: [],
      priceInfo: makePrice('WHOLE_GARMENT', false),
      evidenceItems: [],
      remark: '已排机，Web/PDA 可开工。',
    },
    {
      knittingOrderId: 'KNIT-MOCK-PART-FLAT',
      knittingOrderNo: '针织单-手动-部位-横机中',
      kind: 'PART_PANEL',
      productionOrderNo: partProduction?.productionOrderNo || 'PO-KNIT-PART-002',
      styleNo: partStyleNo,
      styleName: partStyleName,
      colorName: '藏青',
      sizeRange: 'S-M-L',
      factoryId: 'OWN_KNITTING_FACTORY',
      factoryName: '周哥针织厂',
      plannedQty: 960,
      completedQty: 320,
      qtyUnit: '片',
      needsPackaging: false,
      status: 'FLAT_KNITTING',
      downstreamTarget: '裁床待交出仓',
      plannedMachineCount: 8,
      scheduledStartAt: '2026-05-11 10:00',
      scheduledEndAt: '2026-05-13 18:00',
      taskNo: '任务-针织-手动-部位-横机中',
      acceptedAt: '2026-05-11 08:30',
      acceptedBy: OWN_KNITTING_FACTORY_NAME,
      pickupStartedAt: '2026-05-11 09:00',
      pickupCompletedAt: '2026-05-11 09:20',
      machineScheduleId: 'KMS-MOCK-PART-FLAT',
      yarnReceipt: {
        yarnSku: 'YARN-PART-NVY',
        yarnName: '罗纹部位纱线',
        colorName: '藏青',
        plannedWeightKg: 76.8,
        receivedWeightKg: 76.8,
        differenceWeightKg: 0,
        receiverName: '周哥',
        receivedAt: '2026-05-11 09:00',
        evidenceText: '领料单已完成，当前横机成片中。',
      },
      nodes: [
        { nodeName: '横机成片', status: '进行中', plannedQty: 960, completedQty: 320, unit: '片', machineNos: ['H-031', 'H-032', 'H-033', 'H-034'], startedAt: '2026-05-11 10:10', operatorName: '部位针织车间' },
      ],
      partPanels: ['前片罗纹', '后片罗纹', '袖口罗纹'].map((partName) => ({
        partName,
        colorName: '藏青',
        sizeCode: 'M',
        plannedPieces: 320,
        completedPieces: partName === '前片罗纹' ? 320 : 0,
        feiTicketNo: `KFEI-FLAT-${partName}`,
        feiTicketStatus: '待打印',
      })),
      priceInfo: makePrice('PART_PANEL', false),
      evidenceItems: [],
      remark: '进行中只允许上报或完成横机成片。',
    },
    {
      knittingOrderId: 'KNIT-MOCK-PART-WAIT-FEI',
      knittingOrderNo: '针织单-手动-部位-待菲票',
      kind: 'PART_PANEL',
      productionOrderNo: partProduction?.productionOrderNo || 'PO-KNIT-PART-003',
      styleNo: partStyleNo,
      styleName: partStyleName,
      colorName: '灰色',
      sizeRange: 'S-M-L',
      factoryId: 'OWN_KNITTING_FACTORY',
      factoryName: '周哥针织厂',
      plannedQty: 900,
      completedQty: 900,
      qtyUnit: '片',
      needsPackaging: false,
      status: 'WAIT_FEI_TICKET',
      downstreamTarget: '裁床待交出仓',
      plannedMachineCount: 8,
      scheduledStartAt: '2026-05-10 10:00',
      scheduledEndAt: '2026-05-12 18:00',
      taskNo: '任务-针织-手动-部位-待菲票',
      acceptedAt: '2026-05-10 08:30',
      acceptedBy: OWN_KNITTING_FACTORY_NAME,
      pickupStartedAt: '2026-05-10 09:00',
      pickupCompletedAt: '2026-05-10 09:20',
      machineScheduleId: 'KMS-MOCK-PART-WAIT-FEI',
      yarnReceipt: {
        yarnSku: 'YARN-PART-GRY',
        yarnName: '罗纹部位纱线',
        colorName: '灰色',
        plannedWeightKg: 72,
        receivedWeightKg: 72,
        differenceWeightKg: 0,
        receiverName: '周哥',
        receivedAt: '2026-05-10 09:00',
        evidenceText: '横机成片已完成，待打印菲票。',
      },
      nodes: [
        { nodeName: '横机成片', status: '已完成', plannedQty: 900, completedQty: 900, unit: '片', machineNos: ['H-041', 'H-042', 'H-043', 'H-044'], startedAt: '2026-05-10 10:00', finishedAt: '2026-05-11 16:00', operatorName: '部位针织车间' },
      ],
      partPanels: ['前片罗纹', '后片罗纹', '袖口罗纹'].map((partName) => ({
        partName,
        colorName: '灰色',
        sizeCode: 'M',
        plannedPieces: 300,
        completedPieces: 300,
        feiTicketNo: `KFEI-WAIT-${partName}`,
        feiTicketStatus: '待打印',
      })),
      priceInfo: makePrice('PART_PANEL', false),
      evidenceItems: [],
      remark: '横机完成后才能打印菲票。',
    },
    {
      knittingOrderId: 'KNIT-MOCK-WHOLE-WAIT-IRONING',
      knittingOrderNo: '针织单-手动-整件-待熨烫',
      kind: 'WHOLE_GARMENT',
      productionOrderNo: wholeProduction?.productionOrderNo || 'PO-KNIT-WHOLE-004',
      styleNo: wholeStyleNo,
      styleName: wholeStyleName,
      colorName: '深蓝',
      sizeRange: 'S-M-L-XL',
      factoryId: 'OWN_KNITTING_FACTORY',
      factoryName: '周哥针织厂',
      plannedQty: 360,
      completedQty: 360,
      qtyUnit: '件',
      needsPackaging: false,
      status: 'WAIT_IRONING',
      downstreamTarget: '后道工厂',
      plannedMachineCount: 18,
      scheduledStartAt: '2026-05-09 09:00',
      scheduledEndAt: '2026-05-12 20:00',
      taskNo: '任务-针织-手动-整件-待熨烫',
      acceptedAt: '2026-05-09 08:30',
      acceptedBy: OWN_KNITTING_FACTORY_NAME,
      pickupStartedAt: '2026-05-09 09:00',
      pickupCompletedAt: '2026-05-09 09:30',
      machineScheduleId: 'KMS-MOCK-WHOLE-WAIT-IRONING',
      yarnReceipt: {
        yarnSku: 'YARN-WHOLE-NVY',
        yarnName: '整件针织纱线',
        colorName: '深蓝',
        plannedWeightKg: 172.8,
        receivedWeightKg: 172.8,
        differenceWeightKg: 0,
        receiverName: '周哥',
        receivedAt: '2026-05-09 09:00',
        evidenceText: '横机与缝盘已完成，整件针织待熨烫。',
      },
      nodes: [
        { nodeName: '横机成片', status: '已完成', plannedQty: 360, completedQty: 360, unit: '件', machineNos: ['H-021', 'H-022', 'H-023', 'H-024'], startedAt: '2026-05-09 09:30', finishedAt: '2026-05-10 18:00', operatorName: '整件针织车间' },
        { nodeName: '缝盘', status: '已完成', plannedQty: 360, completedQty: 360, unit: '件', startedAt: '2026-05-11 08:00', finishedAt: '2026-05-11 14:00', operatorName: '缝盘组' },
        { nodeName: '熨烫', status: '未开始', plannedQty: 360, completedQty: 0, unit: '件', remark: '整件针织必经熨烫。' },
        { nodeName: '包装', status: '已跳过', plannedQty: 360, completedQty: 0, unit: '件', remark: '当前整件针织单暂不要求针织厂包装。' },
      ],
      partPanels: [],
      priceInfo: makePrice('WHOLE_GARMENT', false),
      evidenceItems: [],
      remark: '整件针织熨烫是必有节点。',
    },
    {
      knittingOrderId: 'KNIT-MOCK-WHOLE-HANDOVER-SUBMITTED',
      knittingOrderNo: '针织单-手动-整件-已交出',
      kind: 'WHOLE_GARMENT',
      productionOrderNo: wholeProduction?.productionOrderNo || 'PO-KNIT-WHOLE-005',
      styleNo: wholeStyleNo,
      styleName: wholeStyleName,
      colorName: '浅灰',
      sizeRange: 'S-M-L-XL',
      factoryId: 'OWN_KNITTING_FACTORY',
      factoryName: '周哥针织厂',
      plannedQty: 300,
      completedQty: 300,
      qtyUnit: '件',
      needsPackaging: false,
      status: 'HANDOVER_SUBMITTED',
      downstreamTarget: '后道工厂',
      plannedMachineCount: 16,
      scheduledStartAt: '2026-05-08 09:00',
      scheduledEndAt: '2026-05-11 17:30',
      taskNo: '任务-针织-手动-整件-已交出',
      acceptedAt: '2026-05-08 08:30',
      acceptedBy: OWN_KNITTING_FACTORY_NAME,
      pickupStartedAt: '2026-05-08 09:00',
      pickupCompletedAt: '2026-05-08 09:20',
      machineScheduleId: 'KMS-MOCK-WHOLE-HANDOVER-SUBMITTED',
      yarnReceipt: {
        yarnSku: 'YARN-WHOLE-LGY',
        yarnName: '整件针织纱线',
        colorName: '浅灰',
        plannedWeightKg: 144,
        receivedWeightKg: 144,
        differenceWeightKg: 0,
        receiverName: '周哥',
        receivedAt: '2026-05-08 09:00',
        evidenceText: '领料单已完成，节点已完成，工厂已发起交出。',
      },
      nodes: [
        { nodeName: '横机成片', status: '已完成', plannedQty: 300, completedQty: 300, unit: '件', machineNos: ['H-051', 'H-052', 'H-053', 'H-054'], startedAt: '2026-05-08 09:30', finishedAt: '2026-05-09 18:00', operatorName: '整件针织车间' },
        { nodeName: '缝盘', status: '已完成', plannedQty: 300, completedQty: 300, unit: '件', startedAt: '2026-05-10 08:00', finishedAt: '2026-05-10 12:30', operatorName: '缝盘组' },
        { nodeName: '熨烫', status: '已完成', plannedQty: 300, completedQty: 300, unit: '件', startedAt: '2026-05-10 13:30', finishedAt: '2026-05-10 18:00', operatorName: '熨烫组', remark: '整件针织必经熨烫。' },
        { nodeName: '包装', status: '已跳过', plannedQty: 300, completedQty: 0, unit: '件', remark: '当前整件针织单暂不要求针织厂包装。' },
      ],
      partPanels: [],
      priceInfo: makePrice('WHOLE_GARMENT', false),
      handoverOrderNo: '交出-针织单-手动-整件-已交出',
      handoverQty: 300,
      handoverDifferenceQty: 0,
      evidenceItems: [
        {
          title: '发起交出',
          description: '周哥针织厂已发起交出到后道工厂，等待后道仓库确认收货。',
          createdAt: '2026-05-11 17:30',
          ownerName: OWN_KNITTING_FACTORY_NAME,
        },
      ],
      remark: '交出单已由工厂发起，接收仓库待确认回写。',
    },
    {
      knittingOrderId: 'KNIT-MOCK-PART-HANDOVER-COMPLETED',
      knittingOrderNo: '针织单-手动-部位-已回写',
      kind: 'PART_PANEL',
      productionOrderNo: partProduction?.productionOrderNo || 'PO-KNIT-PART-004',
      styleNo: partStyleNo,
      styleName: partStyleName,
      colorName: '藏青',
      sizeRange: 'S-M-L',
      factoryId: 'OWN_KNITTING_FACTORY',
      factoryName: '周哥针织厂',
      plannedQty: 720,
      completedQty: 720,
      qtyUnit: '片',
      needsPackaging: false,
      status: 'COMPLETED',
      downstreamTarget: '裁床待交出仓',
      plannedMachineCount: 8,
      scheduledStartAt: '2026-05-08 10:00',
      scheduledEndAt: '2026-05-11 16:30',
      taskNo: '任务-针织-手动-部位-已回写',
      acceptedAt: '2026-05-08 08:30',
      acceptedBy: OWN_KNITTING_FACTORY_NAME,
      pickupStartedAt: '2026-05-08 09:00',
      pickupCompletedAt: '2026-05-08 09:20',
      machineScheduleId: 'KMS-MOCK-PART-HANDOVER-COMPLETED',
      yarnReceipt: {
        yarnSku: 'YARN-PART-NVY-CLOSED',
        yarnName: '罗纹部位纱线',
        colorName: '藏青',
        plannedWeightKg: 57.6,
        receivedWeightKg: 57.6,
        differenceWeightKg: 0,
        receiverName: '周哥',
        receivedAt: '2026-05-08 09:00',
        evidenceText: '部位针织领料、横机、菲票、交出、仓库回写均已完成。',
      },
      nodes: [
        { nodeName: '横机成片', status: '已完成', plannedQty: 720, completedQty: 720, unit: '片', machineNos: ['H-071', 'H-072', 'H-073', 'H-074'], startedAt: '2026-05-08 10:00', finishedAt: '2026-05-10 16:30', operatorName: '部位针织车间' },
      ],
      partPanels: ['前片罗纹', '后片罗纹', '袖口罗纹'].map((partName) => ({
        partName,
        colorName: '藏青',
        sizeCode: 'M',
        plannedPieces: 240,
        completedPieces: 240,
        feiTicketNo: `KFEI-CLOSED-${partName}`,
        feiTicketStatus: '已打印',
      })),
      priceInfo: makePrice('PART_PANEL', false),
      handoverOrderNo: '交出-针织单-手动-部位-已回写',
      handoverQty: 720,
      receiverWrittenQty: 720,
      handoverDifferenceQty: 0,
      evidenceItems: [
        {
          title: '仓库确认收货',
          description: '裁床待交出仓已确认收货 720 片并回写数量。',
          createdAt: '2026-05-11 16:30',
          ownerName: '裁床待交出仓',
        },
      ],
      remark: '交出单已由工厂发起，仓库已确认收货并回写数量。',
    },
  ]
}

function getFlatKnittingNode(order: KnittingWorkOrder): KnittingExecutionNode | undefined {
  return order.nodes.find((node) => node.nodeName === '横机成片')
}

function hasKnittingMachineSchedule(order: KnittingWorkOrder): boolean {
  return Boolean(order.machineScheduleId) || Boolean(getFlatKnittingNode(order)?.machineNos?.length)
}

function getKnittingMachineScheduleStatus(order: KnittingWorkOrder): KnittingMachineScheduleStatus {
  const flatNode = getFlatKnittingNode(order)
  if (flatNode?.status === '已完成') return '已完成'
  if (flatNode?.status === '进行中' || flatNode?.startedAt) return '生产中'
  return '待开工'
}

function getKnittingMachineRiskText(order: KnittingWorkOrder): string {
  const flatNode = getFlatKnittingNode(order)
  if (order.yarnReceipt.differenceWeightKg !== 0) return '本次领料数量存在差异'
  if (order.status === 'WAIT_ACCEPT') return '待针织厂接单'
  if (order.status === 'WAIT_PICKUP' || order.status === 'PICKUP_IN_PROGRESS') return '待完成领料单'
  if (order.status === 'WAIT_MACHINE_SCHEDULE') return '领料完成后待排机'
  if (!flatNode || flatNode.status === '未开始') return '待开工'
  if (flatNode.status === '已完成') return '横机成片已完成'
  return '按计划执行'
}

function buildGeneratedKnittingMachineSchedules(): KnittingMachineSchedule[] {
  const orders = listKnittingWorkOrders()
  const schedules = orders.filter(hasKnittingMachineSchedule).map((order, index): KnittingMachineSchedule => {
    const machineStart = index * 4 + 1
    const flatNode = getFlatKnittingNode(order)
    const machineNos = flatNode?.machineNos?.length
      ? flatNode.machineNos
      : Array.from({ length: Math.min(order.plannedMachineCount, order.kind === 'PART_PANEL' ? 4 : 6) }, (_, offset) => `H-${String(machineStart + offset).padStart(3, '0')}`)
    return {
      scheduleId: order.machineScheduleId || `KMS-GEN-${String(index + 1).padStart(3, '0')}`,
      machineGroupName: order.kind === 'PART_PANEL' ? '部位针织组' : '整件针织组',
      machineNos,
      knittingOrderId: order.knittingOrderId,
      plannedStartAt: order.scheduledStartAt,
      plannedEndAt: order.scheduledEndAt,
      actualStartAt: flatNode?.startedAt,
      actualEndAt: flatNode?.finishedAt,
      operatorName: order.kind === 'PART_PANEL' ? '部位针织车间' : '整件针织车间',
      status: getKnittingMachineScheduleStatus(order),
      scheduleSource: '正式排产',
      riskText: getKnittingMachineRiskText(order),
      remark: `${KNITTING_KIND_LABEL[order.kind]}，完成后交${order.downstreamTarget}`,
    }
  })

  return [
    ...schedules,
    {
      scheduleId: 'KMS-GEN-IDLE',
      machineGroupName: '横机预留组',
      machineNos: ['H-061', 'H-062', 'H-063', 'H-064'],
      plannedStartAt: '2026-05-10 08:00',
      plannedEndAt: '2026-05-10 20:00',
      status: '空闲',
      scheduleSource: '空闲预留',
      riskText: '可插急单 300 件/片以内',
      remark: '预留给翻单、补片或异常返修任务。',
    },
  ]
}

export function listKnittingWorkOrders(): KnittingWorkOrder[] {
  const ordersById = new Map<string, KnittingWorkOrder>()
  ;[...buildGeneratedKnittingWorkOrders(), ...buildManualSeedKnittingWorkOrders()].forEach((order) => {
    ordersById.set(order.knittingOrderId, normalizeKnittingWorkOrderRuntime(cloneValue(order)))
  })
  Object.values(readKnittingStore().workOrders).forEach((order) => {
    ordersById.set(order.knittingOrderId, normalizeKnittingWorkOrderRuntime(cloneValue(order)))
  })
  return Array.from(ordersById.values()).sort((left, right) => {
    if (left.status === 'WAIT_ACCEPT' && right.status !== 'WAIT_ACCEPT') return -1
    if (right.status === 'WAIT_ACCEPT' && left.status !== 'WAIT_ACCEPT') return 1
    return left.knittingOrderNo.localeCompare(right.knittingOrderNo, 'zh-CN')
  })
}

export function listKnittingMachineSchedules(): KnittingMachineSchedule[] {
  return buildGeneratedKnittingMachineSchedules()
}

function getMachineStatusBySchedule(schedule: KnittingMachineSchedule): KnittingMachineStatus {
  if (schedule.status === '生产中') return '生产中'
  if (schedule.status === '空闲') return '空闲'
  if (schedule.status === '已取消') return '空闲'
  if (schedule.status === '延误') return '已排产'
  return '已排产'
}

export function listKnittingMachines(): KnittingMachine[] {
  const machinesByNo = new Map<string, KnittingMachine>()
  listKnittingMachineSchedules().forEach((schedule) => {
    const order = schedule.knittingOrderId ? getKnittingWorkOrderById(schedule.knittingOrderId) : undefined
    schedule.machineNos.forEach((machineNo, index) => {
      machinesByNo.set(machineNo, {
        machineId: `KM-${machineNo}`,
        machineNo,
        machineName: `${schedule.machineGroupName}-${index + 1}`,
        factoryId: OWN_KNITTING_FACTORY_ID,
        factoryName: OWN_KNITTING_FACTORY_NAME,
        machineGroupId: schedule.machineGroupName === '部位针织组' ? 'KNIT-PART' : schedule.machineGroupName === '整件针织组' ? 'KNIT-WHOLE' : 'KNIT-RESERVE',
        machineGroupName: schedule.machineGroupName,
        needleType: order?.kind === 'PART_PANEL' ? '14G' : '12G',
        supportedKinds: order?.kind ? [order.kind] : ['WHOLE_GARMENT', 'PART_PANEL'],
        status: getMachineStatusBySchedule(schedule),
        currentTaskNo: order?.taskNo,
        dailyCapacityText: order?.kind === 'PART_PANEL' ? '600-900 片/日' : '180-260 件/日',
        locationText: schedule.machineGroupName === '部位针织组' ? '针织车间 B 区' : '针织车间 A 区',
        ownerName: schedule.operatorName || '排产主管',
        remark: schedule.riskText,
      })
    })
  })

  ;[
    {
      machineNo: 'H-091',
      machineGroupName: '维修暂存组',
      status: '维修' as const,
      remark: '针板检修中，暂不参与排产。',
    },
    {
      machineNo: 'H-092',
      machineGroupName: '停用暂存组',
      status: '停用' as const,
      remark: '老旧设备停用，等待资产处理。',
    },
  ].forEach((extra, index) => {
    machinesByNo.set(extra.machineNo, {
      machineId: `KM-${extra.machineNo}`,
      machineNo: extra.machineNo,
      machineName: `${extra.machineGroupName}-${index + 1}`,
      factoryId: OWN_KNITTING_FACTORY_ID,
      factoryName: OWN_KNITTING_FACTORY_NAME,
      machineGroupId: `KNIT-EXTRA-${index + 1}`,
      machineGroupName: extra.machineGroupName,
      needleType: index === 0 ? '12G' : '14G',
      supportedKinds: ['WHOLE_GARMENT', 'PART_PANEL'],
      status: extra.status,
      dailyCapacityText: '暂不计入产能',
      locationText: '设备暂存区',
      ownerName: '设备管理员',
      remark: extra.remark,
    })
  })

  return Array.from(machinesByNo.values()).sort((left, right) => left.machineNo.localeCompare(right.machineNo, 'zh-CN'))
}

export function getKnittingWorkOrderById(knittingOrderId: string): KnittingWorkOrder | undefined {
  return listKnittingWorkOrders().find((order) => order.knittingOrderId === knittingOrderId)
}

export function getKnittingWorkOrderByTaskId(taskId: string): KnittingWorkOrder | undefined {
  return listKnittingWorkOrders().find((order) => order.taskNo === taskId || order.knittingOrderId === taskId)
}

function ensureKnittingPickupReceived(order: KnittingWorkOrder, operatorName: string, operatedAt: string): KnittingYarnReceipt {
  if (order.yarnReceipt.receivedWeightKg > 0) return order.yarnReceipt
  return {
    ...order.yarnReceipt,
    receivedWeightKg: order.yarnReceipt.plannedWeightKg,
    differenceWeightKg: 0,
    receiverName: operatorName,
    receivedAt: operatedAt,
    evidenceText: 'Web/移动端确认本次领料，称重照片 1 张，到货视频 1 段。',
  }
}

function getKnittingNode(order: KnittingWorkOrder, nodeName: string): KnittingExecutionNode | undefined {
  return order.nodes.find((node) => node.nodeName === nodeName)
}

function getKnittingStartUsageDefault(order: KnittingWorkOrder): number {
  return roundQty(order.yarnReceipt.receivedWeightKg || order.yarnReceipt.plannedWeightKg)
}

function getKnittingYarnProcessingUsageWeight(order: KnittingWorkOrder): number {
  if (typeof order.yarnReceipt.processingUsageWeightKg === 'number') {
    return roundQty(order.yarnReceipt.processingUsageWeightKg)
  }
  const flatNode = getKnittingNode(order, '横机成片')
  if (flatNode && (flatNode.status !== '未开始' || flatNode.startedAt)) {
    return getKnittingStartUsageDefault(order)
  }
  return 0
}

function getKnittingLinkingLossWeight(order: KnittingWorkOrder): number {
  const linkingNode = getKnittingNode(order, '缝盘')
  if (!linkingNode) return 0
  if (typeof linkingNode.yarnLossWeightKg === 'number') return roundQty(linkingNode.yarnLossWeightKg)
  if (linkingNode.status === '已完成') return roundQty(getKnittingYarnProcessingUsageWeight(order) * 0.015)
  return 0
}

function getKnittingRecoveredYarnWeight(order: KnittingWorkOrder): number {
  return roundQty(order.yarnReceipt.recoveredWeightKg || 0)
}

export function getKnittingYarnUsageSummary(order: KnittingWorkOrder): {
  processingUsageWeightKg: number
  linkingLossWeightKg: number
  recoveredWeightKg: number
  netUsedWeightKg: number
  waitProcessStockWeightKg: number
} {
  const processingUsageWeightKg = getKnittingYarnProcessingUsageWeight(order)
  const linkingLossWeightKg = getKnittingLinkingLossWeight(order)
  const recoveredWeightKg = getKnittingRecoveredYarnWeight(order)
  const netUsedWeightKg = roundQty(Math.max(processingUsageWeightKg + linkingLossWeightKg - recoveredWeightKg, 0))
  return {
    processingUsageWeightKg,
    linkingLossWeightKg,
    recoveredWeightKg,
    netUsedWeightKg,
    waitProcessStockWeightKg: roundQty(Math.max(order.yarnReceipt.receivedWeightKg - processingUsageWeightKg - linkingLossWeightKg + recoveredWeightKg, 0)),
  }
}

function deriveKnittingOrderStatus(order: KnittingWorkOrder): KnittingWorkOrderStatus {
  const flatNode = order.nodes.find((node) => node.nodeName === '横机成片')
  const hasNodeProgress = order.nodes.some((node) => {
    if (node.status === '已跳过' && node.nodeName === '包装' && !order.needsPackaging) return false
    return node.status !== '未开始' || Boolean(node.startedAt) || node.completedQty > 0
  })
  const hasYarnReceived = order.yarnReceipt.receivedWeightKg > 0
  if (order.status === 'WAIT_ACCEPT' && !hasNodeProgress && !hasYarnReceived) return 'WAIT_ACCEPT'
  if (order.receiverWrittenQty !== undefined && order.receiverWrittenQty >= 0) return 'COMPLETED'
  if (order.status === 'HANDOVER_SUBMITTED') return 'HANDOVER_SUBMITTED'
  if (!flatNode || flatNode.status === '未开始') {
    if (!hasYarnReceived) return 'WAIT_PICKUP'
    if (!order.pickupCompletedAt) return 'PICKUP_IN_PROGRESS'
    if (!hasKnittingMachineSchedule(order)) return 'WAIT_MACHINE_SCHEDULE'
    return 'MACHINE_SCHEDULED'
  }
  if (flatNode.status === '进行中') return 'FLAT_KNITTING'

  if (order.kind === 'PART_PANEL') {
    if (order.partPanels.every((panel) => panel.feiTicketStatus === '已打印')) return 'FEI_TICKET_PRINTED'
    return 'WAIT_FEI_TICKET'
  }

  const linkingNode = order.nodes.find((node) => node.nodeName === '缝盘')
  if (linkingNode && linkingNode.status !== '已完成') {
    return linkingNode.status === '进行中' ? 'LINKING' : 'WAIT_LINKING'
  }

  const ironingNode = order.nodes.find((node) => node.nodeName === '熨烫')
  if (ironingNode && ironingNode.status !== '已完成') {
    return ironingNode.status === '进行中' ? 'IRONING' : 'WAIT_IRONING'
  }

  const packagingNode = order.nodes.find((node) => node.nodeName === '包装')
  if (order.needsPackaging && packagingNode && packagingNode.status !== '已完成') {
    return packagingNode.status === '进行中' ? 'PACKING' : 'WAIT_PACKING'
  }

  return 'WAIT_HANDOVER'
}

function normalizeKnittingWorkOrderRuntime(order: KnittingWorkOrder): KnittingWorkOrder {
  const status = deriveKnittingOrderStatus(order)
  return {
    ...order,
    status,
    handoverOrderNo: status === 'WAIT_HANDOVER' ? order.handoverOrderNo || `交出-${order.knittingOrderNo}` : order.handoverOrderNo,
  }
}

export function getKnittingAllowedActions(order: KnittingWorkOrder): KnittingAllowedAction[] {
  switch (order.status) {
    case 'WAIT_ACCEPT':
      return [{ code: 'ACCEPT', label: '接单', tone: 'primary' }]
    case 'WAIT_PICKUP':
      return [{ code: 'CONFIRM_PICKUP', label: '确认本次领料', tone: 'primary' }]
    case 'PICKUP_IN_PROGRESS':
      return [
        { code: 'CONFIRM_PICKUP', label: '确认本次领料', tone: 'normal' },
        { code: 'COMPLETE_PICKUP', label: '完成领料单', tone: 'primary' },
      ]
    case 'WAIT_MACHINE_SCHEDULE':
      return [{ code: 'SCHEDULE_MACHINE', label: '排机', tone: 'primary' }]
    case 'MACHINE_SCHEDULED':
      return [{ code: 'START_FLAT', label: '开工', tone: 'primary', nodeName: '横机成片' }]
    case 'FLAT_KNITTING':
      return [
        { code: 'REPORT_FLAT_MILESTONE', label: '上报横机节点', tone: 'normal', nodeName: '横机成片' },
        { code: 'COMPLETE_FLAT', label: '完成横机成片', tone: 'primary', nodeName: '横机成片' },
      ]
    case 'WAIT_LINKING':
      return [{ code: 'START_LINKING', label: '开始缝盘', tone: 'primary', nodeName: '缝盘' }]
    case 'LINKING':
      return [{ code: 'COMPLETE_LINKING', label: '完成缝盘', tone: 'primary', nodeName: '缝盘' }]
    case 'WAIT_IRONING':
      return [{ code: 'START_IRONING', label: '开始熨烫', tone: 'primary', nodeName: '熨烫' }]
    case 'IRONING':
      return [{ code: 'COMPLETE_IRONING', label: '完成熨烫', tone: 'primary', nodeName: '熨烫' }]
    case 'WAIT_PACKING':
      return order.needsPackaging
        ? [{ code: 'START_PACKING', label: '开始包装', tone: 'primary', nodeName: '包装' }]
        : [{ code: 'SKIP_PACKING', label: '跳过包装', tone: 'normal', nodeName: '包装' }]
    case 'PACKING':
      return [{ code: 'COMPLETE_PACKING', label: '完成包装', tone: 'primary', nodeName: '包装' }]
    case 'WAIT_FEI_TICKET':
      return [{ code: 'PRINT_FEI_TICKET', label: '打印菲票', tone: 'primary' }]
    case 'FEI_TICKET_PRINTED':
    case 'WAIT_HANDOVER':
      return [{ code: 'SUBMIT_HANDOVER', label: '发起交出', tone: 'primary' }]
    case 'HANDOVER_SUBMITTED':
      return [{ code: 'CONFIRM_HANDOVER_RECEIPT', label: '仓库确认收货', tone: 'primary' }]
    default:
      return []
  }
}

export function acceptKnittingWorkOrder(
  knittingOrderId: string,
  operatorName = OWN_KNITTING_FACTORY_NAME,
  operatedAt = nowTimestamp(),
): KnittingWorkOrder | undefined {
  const order = getKnittingWorkOrderById(knittingOrderId)
  if (!order) return undefined
  const next: KnittingWorkOrder = {
    ...order,
    status: order.status === 'WAIT_ACCEPT' ? 'WAIT_PICKUP' : order.status,
    acceptedAt: order.acceptedAt || operatedAt,
    acceptedBy: order.acceptedBy || operatorName,
    evidenceItems: [
      ...order.evidenceItems,
      {
        title: '接单确认',
        description: `${operatorName} 已确认接收 ${KNITTING_KIND_LABEL[order.kind]}任务`,
        createdAt: operatedAt,
        ownerName: operatorName,
      },
    ],
  }
  return saveKnittingWorkOrder(next)
}

export function confirmKnittingPickupRecord(
  knittingOrderId: string,
  operatorName = OWN_KNITTING_FACTORY_NAME,
  operatedAt = nowTimestamp(),
): KnittingWorkOrder | undefined {
  const order = getKnittingWorkOrderById(knittingOrderId)
  if (!order) return undefined
  const acceptedOrder = order.status === 'WAIT_ACCEPT'
    ? acceptKnittingWorkOrder(knittingOrderId, operatorName, operatedAt) || order
    : order
  const yarnReceipt = ensureKnittingPickupReceived(acceptedOrder, operatorName, operatedAt)
  const nextBase: KnittingWorkOrder = {
    ...acceptedOrder,
    yarnReceipt,
    pickupStartedAt: acceptedOrder.pickupStartedAt || operatedAt,
    status: 'PICKUP_IN_PROGRESS',
    evidenceItems: [
      ...acceptedOrder.evidenceItems,
      {
        title: '确认本次领料',
        description: `${operatorName} 已确认本次领料 ${yarnReceipt.receivedWeightKg} kg`,
        createdAt: operatedAt,
        ownerName: operatorName,
      },
    ],
  }
  return saveKnittingWorkOrder({ ...nextBase, status: deriveKnittingOrderStatus(nextBase) })
}

export function completeKnittingPickupHead(
  knittingOrderId: string,
  operatorName = OWN_KNITTING_FACTORY_NAME,
  operatedAt = nowTimestamp(),
): KnittingWorkOrder | undefined {
  const order = getKnittingWorkOrderById(knittingOrderId)
  if (!order) return undefined
  const acceptedOrder = order.status === 'WAIT_ACCEPT'
    ? acceptKnittingWorkOrder(knittingOrderId, operatorName, operatedAt) || order
    : order
  const yarnReceipt = ensureKnittingPickupReceived(acceptedOrder, operatorName, operatedAt)
  const nextBase: KnittingWorkOrder = {
    ...acceptedOrder,
    yarnReceipt,
    pickupStartedAt: acceptedOrder.pickupStartedAt || operatedAt,
    pickupCompletedAt: acceptedOrder.pickupCompletedAt || operatedAt,
    evidenceItems: [
      ...acceptedOrder.evidenceItems,
      {
        title: '完成领料单',
        description: `${operatorName} 已完成领料单，实收 ${yarnReceipt.receivedWeightKg} kg`,
        createdAt: operatedAt,
        ownerName: operatorName,
      },
    ],
  }
  return saveKnittingWorkOrder({ ...nextBase, status: deriveKnittingOrderStatus(nextBase) })
}

export function scheduleKnittingMachines(
  knittingOrderId: string,
  operatorName = OWN_KNITTING_FACTORY_NAME,
  operatedAt = nowTimestamp(),
  input: KnittingMachineScheduleInput = {},
): KnittingWorkOrder | undefined {
  const order = getKnittingWorkOrderById(knittingOrderId)
  if (!order || !order.pickupCompletedAt) return order
  const prefix = order.kind === 'PART_PANEL' ? 'H-03' : 'H-01'
  const inputMachineNos = (input.machineNos || []).map((machineNo) => machineNo.trim()).filter(Boolean)
  const machineNos = inputMachineNos.length
    ? inputMachineNos
    : Array.from({ length: order.kind === 'PART_PANEL' ? 4 : 6 }, (_, index) => `${prefix}${index + 1}`)
  const nodes = order.nodes.map((node) =>
    node.nodeName === '横机成片'
      ? { ...node, machineNos }
      : node,
  )
  const nextBase: KnittingWorkOrder = {
    ...order,
    nodes,
    plannedMachineCount: machineNos.length,
    scheduledStartAt: input.scheduledStartAt || order.scheduledStartAt,
    scheduledEndAt: input.scheduledEndAt || order.scheduledEndAt,
    machineScheduleId: order.machineScheduleId || `KMS-${order.knittingOrderNo}`,
    evidenceItems: [
      ...order.evidenceItems,
      {
        title: '横机排产',
        description: `${operatorName} 已安排 ${machineNos.join(' / ')}${input.remark ? `；${input.remark}` : ''}`,
        createdAt: operatedAt,
        ownerName: operatorName,
      },
    ],
  }
  return saveKnittingWorkOrder({ ...nextBase, status: deriveKnittingOrderStatus(nextBase) })
}

function getAllowedNodeTransition(order: KnittingWorkOrder, nodeName: string, nodeStatus: KnittingNodeStatus): boolean {
  if (nodeStatus === '未开始') return true
  if (nodeName === '横机成片') {
    if (nodeStatus === '进行中') return order.status === 'MACHINE_SCHEDULED'
    if (nodeStatus === '已完成') return order.status === 'FLAT_KNITTING'
    return false
  }
  if (nodeName === '缝盘') {
    if (order.kind !== 'WHOLE_GARMENT') return false
    if (nodeStatus === '进行中') return order.status === 'WAIT_LINKING'
    if (nodeStatus === '已完成') return order.status === 'LINKING'
    return false
  }
  if (nodeName === '熨烫') {
    if (order.kind !== 'WHOLE_GARMENT') return false
    if (nodeStatus === '进行中') return order.status === 'WAIT_IRONING'
    if (nodeStatus === '已完成') return order.status === 'IRONING'
    return false
  }
  if (nodeName === '包装') {
    if (order.kind !== 'WHOLE_GARMENT' || !order.needsPackaging) return nodeStatus === '已跳过' && order.status === 'WAIT_PACKING'
    if (nodeStatus === '进行中') return order.status === 'WAIT_PACKING'
    if (nodeStatus === '已完成') return order.status === 'PACKING'
    return false
  }
  return false
}

export function updateKnittingWorkOrderNodeStatus(
  knittingOrderId: string,
  nodeName: string,
  nodeStatus: KnittingNodeStatus,
  operatorName = OWN_KNITTING_FACTORY_NAME,
  operatedAt = nowTimestamp(),
  options: { yarnUsageWeightKg?: number; yarnLossWeightKg?: number } = {},
): KnittingWorkOrder | undefined {
  const order = getKnittingWorkOrderById(knittingOrderId)
  if (!order) return undefined
  if (!getAllowedNodeTransition(order, nodeName, nodeStatus)) return order
  const startYarnUsageWeightKg = roundQty(options.yarnUsageWeightKg ?? order.yarnReceipt.processingUsageWeightKg ?? getKnittingStartUsageDefault(order))
  const linkingLossWeightKg = roundQty(options.yarnLossWeightKg ?? getKnittingLinkingLossWeight(order))
  const nodes = order.nodes.map((node) => {
    if (node.nodeName !== nodeName) return node
    if (nodeStatus === '进行中') {
      return {
        ...node,
        status: nodeStatus,
        operatorName,
        startedAt: node.startedAt || operatedAt,
      }
    }
    if (nodeStatus === '已完成') {
      return {
        ...node,
        status: nodeStatus,
        operatorName,
        completedQty: node.plannedQty,
        startedAt: node.startedAt || operatedAt,
        finishedAt: operatedAt,
        ...(nodeName === '缝盘' ? { yarnLossWeightKg: linkingLossWeightKg } : {}),
      }
    }
    if (nodeStatus === '已跳过') {
      return {
        ...node,
        status: nodeStatus,
        operatorName,
        completedQty: 0,
        startedAt: node.startedAt || operatedAt,
        finishedAt: operatedAt,
      }
    }
    return {
      ...node,
      status: nodeStatus,
      completedQty: 0,
      operatorName,
      startedAt: undefined,
      finishedAt: undefined,
    }
  })

  const completedQty = order.kind === 'PART_PANEL'
    ? nodes.find((node) => node.nodeName === '横机成片')?.completedQty || order.completedQty
    : Math.max(...nodes.map((node) => node.status === '已完成' ? node.completedQty : 0), 0)
  const partPanels = order.kind === 'PART_PANEL' && nodeName === '横机成片' && nodeStatus === '已完成'
    ? order.partPanels.map((panel) => ({ ...panel, completedPieces: panel.plannedPieces, feiTicketStatus: panel.feiTicketStatus === '已打印' ? '已打印' : '待打印' as const }))
    : order.partPanels
  const yarnReceipt = nodeName === '横机成片' && nodeStatus === '进行中'
    ? {
        ...order.yarnReceipt,
        processingUsageWeightKg: startYarnUsageWeightKg,
      }
    : order.yarnReceipt
  const yarnEvidenceText = nodeName === '横机成片' && nodeStatus === '进行中'
    ? `；开工领用纱线 ${startYarnUsageWeightKg} kg`
    : nodeName === '缝盘' && nodeStatus === '已完成'
      ? `；缝盘损耗纱线 ${linkingLossWeightKg} kg`
      : ''
  const nextBase: KnittingWorkOrder = {
    ...order,
    yarnReceipt,
    nodes,
    partPanels,
    completedQty: roundQty(Math.min(order.plannedQty, completedQty)),
    evidenceItems: [
      ...order.evidenceItems,
      {
        title: '节点状态更新',
        description: `${nodeName} 已更新为 ${nodeStatus}${yarnEvidenceText}`,
        createdAt: operatedAt,
        ownerName: operatorName,
      },
    ],
  }
  const next: KnittingWorkOrder = {
    ...nextBase,
    status: deriveKnittingOrderStatus(nextBase),
    handoverOrderNo: deriveKnittingOrderStatus(nextBase) === 'WAIT_HANDOVER' ? nextBase.handoverOrderNo || `交出-${nextBase.knittingOrderNo}` : nextBase.handoverOrderNo,
  }
  return saveKnittingWorkOrder(next)
}

export function recoverKnittingYarnToWaitProcessWarehouse(
  knittingOrderId: string,
  recoveredWeightKg: number,
  operatorName = OWN_KNITTING_FACTORY_NAME,
  operatedAt = nowTimestamp(),
): KnittingWorkOrder | undefined {
  const order = getKnittingWorkOrderById(knittingOrderId)
  if (!order) return order
  recordKnittingYarnRecovery({
    yarnSku: order.yarnReceipt.yarnSku,
    recoveredWeightKg,
    operatorName,
    operatedAt,
    associationOrderIds: [knittingOrderId],
  })
  return getKnittingWorkOrderById(knittingOrderId)
}

export function recordKnittingYarnRecovery(input: {
  yarnSku: string
  recoveredWeightKg: number
  operatorName?: string
  operatedAt?: string
  associationOrderIds?: string[]
  remark?: string
}): KnittingYarnRecoveryRecord | undefined {
  const qty = roundQty(input.recoveredWeightKg)
  if (!input.yarnSku.trim() || qty <= 0) return undefined
  const operatedAt = input.operatedAt || nowTimestamp()
  const operatorName = input.operatorName || OWN_KNITTING_FACTORY_NAME
  const allOrders = listKnittingWorkOrders()
  const selectedOrderIds = new Set((input.associationOrderIds || []).filter(Boolean))
  const associatedOrders = allOrders.filter((order) =>
    order.yarnReceipt.yarnSku === input.yarnSku
    && (selectedOrderIds.has(order.knittingOrderId) || selectedOrderIds.has(order.knittingOrderNo)),
  )
  const yarnOrder = associatedOrders.find((order) => order.yarnReceipt.yarnSku === input.yarnSku)
    || allOrders.find((order) => order.yarnReceipt.yarnSku === input.yarnSku)
  if (!yarnOrder) return undefined
  const associations = associatedOrders.map((order) => ({
    knittingOrderId: order.knittingOrderId,
    knittingOrderNo: order.knittingOrderNo,
    productionOrderNo: order.productionOrderNo,
    lossWeightKg: getKnittingYarnUsageSummary(order).linkingLossWeightKg,
  }))
  const recoveryId = `KWP-RECOVER-${Date.now()}`
  const recovery: KnittingYarnRecoveryRecord = {
    recoveryId,
    recoveryNo: `回收入仓-${nowTimestamp().replace(/[-:\s]/g, '').slice(0, 12)}`,
    yarnSku: input.yarnSku,
    yarnName: yarnOrder.yarnReceipt.yarnName,
    colorName: yarnOrder.yarnReceipt.colorName,
    recoveredWeightKg: qty,
    operatedAt,
    operatorName,
    associations,
    remark: input.remark?.trim() || (associations.length ? '关联针织加工单回收损耗纱线' : '未关联针织加工单的纱线回收入仓'),
  }
  const store = readKnittingStore()
  store.yarnRecoveryRecords = [recovery, ...(store.yarnRecoveryRecords || [])]
  const recoveredPerOrder = associations.length ? roundQty(qty / associations.length) : 0
  associatedOrders.forEach((order) => {
    const existing = store.workOrders[order.knittingOrderId] || order
    store.workOrders[order.knittingOrderId] = {
      ...existing,
      yarnReceipt: {
        ...existing.yarnReceipt,
        recoveredWeightKg: roundQty((existing.yarnReceipt.recoveredWeightKg || 0) + recoveredPerOrder),
      },
      evidenceItems: [
        ...(existing.evidenceItems || []),
        {
          title: '损耗纱线回收入仓',
          description: `${operatorName} 手动回收 ${qty} kg 损耗纱线入针织待加工仓；回收入仓单 ${recovery.recoveryNo}`,
          createdAt: operatedAt,
          ownerName: operatorName,
        },
      ],
    }
  })
  writeKnittingStore(store)
  return cloneValue(recovery)
}

export function listKnittingYarnRecoveryRecords(): KnittingYarnRecoveryRecord[] {
  return cloneValue(readKnittingStore().yarnRecoveryRecords || [])
}

function buildKnittingRecoveryRemark(record: KnittingYarnRecoveryRecord): string {
  if (!record.associations.length) return record.remark || '未关联针织加工单'
  const detail = record.associations
    .map((item) => `${item.knittingOrderNo} / ${item.productionOrderNo} / 损耗 ${roundQty(item.lossWeightKg)} kg`)
    .join('；')
  return `${record.remark || '关联针织加工单回收'}：${detail}`
}

function getLegacyRecoveredWeight(order: KnittingWorkOrder, recoveryRecords: KnittingYarnRecoveryRecord[]): number {
  const recorded = recoveryRecords.some((record) =>
    record.associations.some((association) => association.knittingOrderId === order.knittingOrderId),
  )
  return recorded ? 0 : getKnittingRecoveredYarnWeight(order)
}

function addRecoveryFlowsToGroup(
  group: {
    recoveredQty: number
    flowRecords: KnittingWarehouseFlowRecord[]
  },
  yarnSku: string,
  recoveryRecords: KnittingYarnRecoveryRecord[],
): void {
  recoveryRecords
    .filter((record) => record.yarnSku === yarnSku)
    .forEach((record) => {
      group.recoveredQty = roundQty(group.recoveredQty + record.recoveredWeightKg)
      group.flowRecords.push({
        flowId: `KWP-FLOW-${record.recoveryId}`,
        flowType: '回收入仓',
        sourceNo: record.recoveryNo,
        qty: record.recoveredWeightKg,
        unit: 'kg',
        operatedAt: record.operatedAt,
        operatorName: record.operatorName,
        remark: buildKnittingRecoveryRemark(record),
      })
    })
}

function addLegacyRecoveryFlow(
  group: {
    recoveredQty: number
    flowRecords: KnittingWarehouseFlowRecord[]
  },
  order: KnittingWorkOrder,
  recoveryRecords: KnittingYarnRecoveryRecord[],
): void {
  const recoveredWeightKg = getLegacyRecoveredWeight(order, recoveryRecords)
  if (recoveredWeightKg <= 0) return
  group.recoveredQty = roundQty(group.recoveredQty + recoveredWeightKg)
  group.flowRecords.push({
    flowId: `KWP-FLOW-LEGACY-RECOVER-${order.knittingOrderId}`,
    flowType: '回收入仓',
    sourceNo: `回收-${order.knittingOrderNo}`,
    qty: recoveredWeightKg,
    unit: 'kg',
    operatedAt: order.evidenceItems.find((item) => item.title === '损耗纱线回收入仓')?.createdAt || '已回收',
    operatorName: order.evidenceItems.find((item) => item.title === '损耗纱线回收入仓')?.ownerName || OWN_KNITTING_FACTORY_NAME,
    remark: `${order.knittingOrderNo} / ${order.productionOrderNo} / 损耗 ${getKnittingYarnUsageSummary(order).linkingLossWeightKg} kg`,
  })
}

export function markKnittingFeiTicketsPrinted(
  knittingOrderId: string,
  operatorName = OWN_KNITTING_FACTORY_NAME,
  operatedAt = nowTimestamp(),
): KnittingWorkOrder | undefined {
  const order = getKnittingWorkOrderById(knittingOrderId)
  if (!order || order.kind !== 'PART_PANEL') return order
  if (order.status !== 'WAIT_FEI_TICKET') return order
  const nextBase: KnittingWorkOrder = {
    ...order,
    partPanels: order.partPanels.map((panel) => ({ ...panel, feiTicketStatus: '已打印' })),
    evidenceItems: [
      ...order.evidenceItems,
      {
        title: '菲票打印',
        description: '部位针织菲票已打印',
        createdAt: operatedAt,
        ownerName: operatorName,
      },
    ],
  }
  const next: KnittingWorkOrder = { ...nextBase, status: deriveKnittingOrderStatus(nextBase) }
  return saveKnittingWorkOrder(next)
}

export function submitKnittingHandover(
  knittingOrderId: string,
  operatorName = OWN_KNITTING_FACTORY_NAME,
  operatedAt = nowTimestamp(),
): KnittingWorkOrder | undefined {
  const order = getKnittingWorkOrderById(knittingOrderId)
  if (!order || (order.status !== 'WAIT_HANDOVER' && order.status !== 'FEI_TICKET_PRINTED')) return order
  const nextBase: KnittingWorkOrder = {
    ...order,
    status: 'HANDOVER_SUBMITTED',
    handoverOrderNo: order.handoverOrderNo || `交出-${order.knittingOrderNo}`,
    handoverQty: order.completedQty,
    evidenceItems: [
      ...order.evidenceItems,
      {
        title: '发起交出',
        description: `${operatorName} 已发起交出到${order.downstreamTarget}`,
        createdAt: operatedAt,
        ownerName: operatorName,
      },
    ],
  }
  return saveKnittingWorkOrder({ ...nextBase, status: deriveKnittingOrderStatus(nextBase) })
}

export function confirmKnittingHandoverReceipt(
  knittingOrderId: string,
  operatorName = '接收仓库',
  operatedAt = nowTimestamp(),
): KnittingWorkOrder | undefined {
  const order = getKnittingWorkOrderById(knittingOrderId)
  if (!order || order.status !== 'HANDOVER_SUBMITTED') return order
  const qty = order.handoverQty ?? order.completedQty
  const nextBase: KnittingWorkOrder = {
    ...order,
    receiverWrittenQty: qty,
    handoverDifferenceQty: roundQty(qty - (order.handoverQty ?? qty)),
    evidenceItems: [
      ...order.evidenceItems,
      {
        title: '仓库确认收货',
        description: `${operatorName} 已确认收货 ${qty} ${order.qtyUnit}`,
        createdAt: operatedAt,
        ownerName: operatorName,
      },
    ],
  }
  return saveKnittingWorkOrder({ ...nextBase, status: deriveKnittingOrderStatus(nextBase) })
}

function getKnittingTaskStatus(order: KnittingWorkOrder): TaskStatus {
  if (order.status === 'WAIT_ACCEPT' || order.status === 'WAIT_PICKUP' || order.status === 'PICKUP_IN_PROGRESS' || order.status === 'WAIT_MACHINE_SCHEDULE' || order.status === 'MACHINE_SCHEDULED') return 'NOT_STARTED'
  if (order.status === 'WAIT_HANDOVER' || order.status === 'HANDOVER_SUBMITTED' || order.status === 'COMPLETED') return 'DONE'
  return 'IN_PROGRESS'
}

function getKnittingTaskAcceptedAt(order: KnittingWorkOrder): string | undefined {
  if (order.status === 'WAIT_ACCEPT') return undefined
  if (order.acceptedAt) return order.acceptedAt
  return isBusinessTimestamp(order.yarnReceipt.receivedAt)
    ? order.yarnReceipt.receivedAt
    : order.scheduledStartAt
}

function getKnittingTaskStartedAt(order: KnittingWorkOrder): string | undefined {
  return order.nodes.find((node) => node.startedAt)?.startedAt
}

function getKnittingTaskFinishedAt(order: KnittingWorkOrder): string | undefined {
  if (getKnittingTaskStatus(order) !== 'DONE') return undefined
  return [...order.nodes].reverse().find((node) => node.finishedAt)?.finishedAt || order.scheduledEndAt
}

function getKnittingMilestoneProofFiles(order: KnittingWorkOrder): StartProofFile[] {
  const startedAt = getKnittingTaskStartedAt(order)
  if (!startedAt) return []
  return [
    {
      id: `knit-ms-${order.knittingOrderId}-1`,
      type: 'IMAGE',
      name: `${order.kind === 'PART_PANEL' ? '部位针织' : '整件针织'}首批节点照片.jpg`,
      uploadedAt: startedAt,
    },
  ]
}

function isKnittingMilestoneReported(order: KnittingWorkOrder): boolean {
  if (order.status === 'WAIT_HANDOVER' || order.status === 'HANDOVER_SUBMITTED' || order.status === 'COMPLETED') return true
  return order.nodes.some((node) => node.nodeName === '横机成片' && (node.status === '进行中' || node.status === '已完成' || node.completedQty > 0))
}

function buildKnittingMobileTask(order: KnittingWorkOrder): ProcessTask {
  const taskStatus = getKnittingTaskStatus(order)
  const acceptedAt = getKnittingTaskAcceptedAt(order)
  const startedAt = getKnittingTaskStartedAt(order)
  const finishedAt = getKnittingTaskFinishedAt(order)
  const milestoneReported = isKnittingMilestoneReported(order)
  const milestoneTargetQty = order.kind === 'PART_PANEL' ? 80 : 20
  const milestoneUnitLabel = order.kind === 'PART_PANEL' ? '片' : '件'
  const downstreamReceiver =
    order.kind === 'PART_PANEL'
      ? { receiverKind: 'WAREHOUSE' as const, receiverId: 'WH-CUTTING-WAIT-HANDOVER', receiverName: '裁床待交出仓' }
      : { receiverKind: 'MANAGED_POST_FACTORY' as const, receiverId: 'POST-FACTORY-OWN', receiverName: '后道工厂' }

  return {
    taskId: order.taskNo,
    taskNo: order.taskNo,
    rootTaskNo: order.knittingOrderNo,
    productionOrderId: order.productionOrderNo,
    seq: 1,
    processCode: 'PROC_KNIT',
    processNameZh: '针织',
    stage: 'SPECIAL',
    qty: order.plannedQty,
    qtyUnit: order.qtyUnit as never,
    assignmentMode: 'DIRECT',
    assignmentStatus: 'ASSIGNED',
    ownerSuggestion: { kind: 'RECOMMENDED_FACTORY_POOL', recommendedTypes: ['FINISHING'] },
    assignedFactoryId: OWN_KNITTING_FACTORY_ID,
    assignedFactoryName: OWN_KNITTING_FACTORY_NAME,
    qcPoints: [],
    attachments: [],
    status: taskStatus,
    acceptanceStatus: order.status === 'WAIT_ACCEPT' ? 'PENDING' : 'ACCEPTED',
    acceptedAt,
    acceptedBy: acceptedAt ? OWN_KNITTING_FACTORY_NAME : undefined,
    acceptDeadline: order.scheduledStartAt,
    taskDeadline: order.scheduledEndAt,
    dispatchRemark: `${KNITTING_KIND_LABEL[order.kind]}；纱线由染厂/面料仓送料到厂，完成后交${order.downstreamTarget}`,
    dispatchedAt: order.scheduledStartAt,
    dispatchedBy: '针织管理',
    standardPrice: order.priceInfo.estimatedDispatchPrice || undefined,
    standardPriceCurrency: order.priceInfo.currency,
    standardPriceUnit: order.qtyUnit,
    dispatchPrice: order.priceInfo.estimatedDispatchPrice || undefined,
    dispatchPriceCurrency: order.priceInfo.currency,
    dispatchPriceUnit: order.qtyUnit,
    priceDiffReason: order.priceInfo.remark,
    startedAt,
    finishedAt,
    startProofFiles: startedAt
      ? [
          {
            id: `knit-start-${order.knittingOrderId}-1`,
            type: 'IMAGE',
            name: `${order.knittingOrderNo}_开工现场.jpg`,
            uploadedAt: startedAt,
          },
        ]
      : [],
    taskQrValue: buildTaskQrValue(order.taskNo),
    taskQrStatus: 'ACTIVE',
    handoverAutoCreatePolicy: 'CREATE_ON_START',
    handoverStatus: order.handoverOrderNo ? 'OPEN' : 'NOT_CREATED',
    receiverKind: downstreamReceiver.receiverKind,
    receiverId: downstreamReceiver.receiverId,
    receiverName: downstreamReceiver.receiverName,
    milestoneRequired: true,
    milestoneRuleType: 'AFTER_N_PIECES',
    milestoneRuleLabel: `横机完成首批 ${milestoneTargetQty} ${milestoneUnitLabel}后上报`,
    milestoneTargetQty,
    milestoneTargetUnit: 'PIECE',
    milestoneStatus: milestoneReported ? 'REPORTED' : 'PENDING',
    milestoneReportedAt: milestoneReported ? startedAt || acceptedAt || order.scheduledStartAt : null,
    milestoneReportedQty: milestoneReported ? milestoneTargetQty : null,
    milestoneProofFiles: milestoneReported ? getKnittingMilestoneProofFiles(order) : [],
    milestoneProofRequirement: 'IMAGE_OR_VIDEO',
    milestoneOverdueExceptionEnabled: true,
    milestoneOverdueHours: 24,
    milestoneExceptionSeverity: 'S2',
    taskKind: 'NORMAL',
    taskCategoryZh: `${KNITTING_KIND_LABEL[order.kind]}任务`,
    stageCode: 'PROD',
    stageName: '生产加工',
    processBusinessCode: 'KNITTING',
    processBusinessName: '针织',
    taskTypeCode: order.kind,
    taskTypeLabel: KNITTING_KIND_LABEL[order.kind],
    assignmentGranularityLabel: order.kind === 'PART_PANEL' ? '部位/尺码' : '整件',
    knittingOrderId: order.knittingOrderId,
    knittingOrderNo: order.knittingOrderNo,
    knittingKind: order.kind,
    knittingKindLabel: KNITTING_KIND_LABEL[order.kind],
    knittingDownstreamTarget: order.downstreamTarget,
    yarnSku: order.yarnReceipt.yarnSku,
    yarnPlannedWeightKg: order.yarnReceipt.plannedWeightKg,
    yarnReceivedWeightKg: order.yarnReceipt.receivedWeightKg,
    mockReceiveSummary: `纱线 ${order.yarnReceipt.yarnSku}，计划 ${order.yarnReceipt.plannedWeightKg} kg，实收 ${order.yarnReceipt.receivedWeightKg} kg`,
    mockExecutionSummary: order.nodes.map((node) => `${node.nodeName}${node.status}`).join(' / ') || '待横机',
    mockHandoverSummary: `完成后交${order.downstreamTarget}`,
    mockStartPrerequisiteMet: order.yarnReceipt.receivedWeightKg > 0,
    createdAt: order.scheduledStartAt,
    updatedAt: finishedAt || startedAt || acceptedAt || order.scheduledStartAt,
    auditLogs: [
      {
        id: `AL-${order.taskNo}-DISPATCH`,
        action: 'DISPATCH',
        detail: `${KNITTING_KIND_LABEL[order.kind]}任务同步到工厂端移动应用`,
        at: order.scheduledStartAt,
        by: '针织管理',
      },
      ...(acceptedAt
        ? [
            {
              id: `AL-${order.taskNo}-ACCEPT`,
              action: 'ACCEPT',
              detail: '周哥针织厂确认接单',
              at: acceptedAt,
              by: OWN_KNITTING_FACTORY_NAME,
            },
          ]
        : []),
    ],
  } as ProcessTask
}

export function listKnittingMobileProcessTasks(): ProcessTask[] {
  return listKnittingWorkOrders().map(buildKnittingMobileTask)
}

function getKnittingHandoverId(order: KnittingWorkOrder, type: 'PICKUP' | 'HANDOUT'): string {
  return `${type === 'PICKUP' ? 'PKH' : 'HOH'}-${order.taskNo.replace(/^任务-/, '')}`
}

export function listKnittingHandoverHeadSeeds(): PdaTaskMockHandoverHeadSeed[] {
  const pickupHeads = listKnittingWorkOrders().map((order): PdaTaskMockHandoverHeadSeed => {
    const received = Math.max(order.yarnReceipt.receivedWeightKg, 0)
    const handed = order.yarnReceipt.plannedWeightKg
    return {
      handoverId: getKnittingHandoverId(order, 'PICKUP'),
      headType: 'PICKUP',
      taskId: order.taskNo,
      taskNo: order.taskNo,
      productionOrderNo: order.productionOrderNo,
      processKey: 'KNITTING',
      processName: '针织',
      sourceFactoryName: '染厂/面料仓',
      targetName: OWN_KNITTING_FACTORY_NAME,
      targetKind: 'FACTORY',
      qtyUnit: 'kg',
      factoryId: OWN_KNITTING_FACTORY_ID,
      taskStatus: getKnittingTaskStatus(order) === 'DONE' ? 'DONE' : 'IN_PROGRESS',
      summaryStatus: received <= 0 ? 'SUBMITTED' : order.yarnReceipt.differenceWeightKg !== 0 ? 'HAS_OBJECTION' : 'WRITTEN_BACK',
      completionStatus: received > 0 ? 'COMPLETED' : 'OPEN',
      completedByWarehouseAt: received > 0 ? order.yarnReceipt.receivedAt : undefined,
      qtyExpectedTotal: handed,
      qtyActualTotal: received,
      qtyDiffTotal: Number((handed - received).toFixed(2)),
      sourceDocNo: `送料-${order.knittingOrderNo}`,
      scopeLabel: `${KNITTING_KIND_LABEL[order.kind]}纱线送料到厂`,
      stageCode: 'PREP',
      stageName: '领料',
      processBusinessCode: 'KNITTING',
      processBusinessName: '针织',
      taskTypeCode: order.kind,
      taskTypeLabel: KNITTING_KIND_LABEL[order.kind],
      assignmentGranularityLabel: order.kind === 'PART_PANEL' ? '部位/尺码' : '整件',
    }
  })

  const handoutHeads = listKnittingWorkOrders()
    .filter((order) => order.status === 'WAIT_HANDOVER' || order.status === 'FEI_TICKET_PRINTED' || order.status === 'HANDOVER_SUBMITTED' || order.status === 'COMPLETED')
    .map((order): PdaTaskMockHandoverHeadSeed => {
      const targetName = order.kind === 'PART_PANEL' ? '裁床待交出仓' : '后道工厂'
      const targetKind = order.kind === 'PART_PANEL' ? 'WAREHOUSE' : 'FACTORY'
      const receiverKind = order.kind === 'PART_PANEL' ? 'WAREHOUSE' : 'MANAGED_POST_FACTORY'
      const expectedQty = order.handoverQty ?? order.completedQty
      const writtenQty = order.receiverWrittenQty ?? 0
      return {
        handoverId: getKnittingHandoverId(order, 'HANDOUT'),
        headType: 'HANDOUT',
        taskId: order.taskNo,
        taskNo: order.taskNo,
        productionOrderNo: order.productionOrderNo,
        processKey: 'KNITTING',
        processName: '针织',
        sourceFactoryName: OWN_KNITTING_FACTORY_NAME,
        targetName,
        targetKind,
        receiverKind,
        receiverId: order.kind === 'PART_PANEL' ? 'WH-CUTTING-WAIT-HANDOVER' : 'POST-FACTORY-OWN',
        receiverName: targetName,
        qtyUnit: order.qtyUnit,
        factoryId: OWN_KNITTING_FACTORY_ID,
        taskStatus: 'DONE',
        summaryStatus: writtenQty > 0 ? (order.handoverDifferenceQty ? 'HAS_OBJECTION' : 'WRITTEN_BACK') : 'SUBMITTED',
        completionStatus: 'OPEN',
        qtyExpectedTotal: expectedQty,
        qtyActualTotal: writtenQty,
        qtyDiffTotal: Number((expectedQty - writtenQty).toFixed(2)),
        sourceDocNo: order.handoverOrderNo || `交出-${order.knittingOrderNo}`,
        scopeLabel: `${KNITTING_KIND_LABEL[order.kind]}交出`,
        stageCode: 'PROD',
        stageName: '针织交出',
        processBusinessCode: 'KNITTING',
        processBusinessName: '针织',
        taskTypeCode: order.kind,
        taskTypeLabel: KNITTING_KIND_LABEL[order.kind],
        assignmentGranularityLabel: order.kind === 'PART_PANEL' ? '部位/尺码' : '整件',
      }
    })

  return [...pickupHeads, ...handoutHeads]
}

export function getKnittingPickupRecordSeedsByHeadId(handoverId: string): PdaTaskMockPickupRecordSeed[] {
  const order = listKnittingWorkOrders().find((item) => getKnittingHandoverId(item, 'PICKUP') === handoverId)
  if (!order) return []
  const handedQty = order.yarnReceipt.plannedWeightKg
  const receivedQty = order.yarnReceipt.receivedWeightKg
  const hasReceived = receivedQty > 0
  return [
    {
      handoverId,
      recordId: `${handoverId}-YARN-001`,
      taskId: order.taskNo,
      sequenceNo: 1,
      materialCode: order.yarnReceipt.yarnSku,
      materialSummary: `${order.yarnReceipt.yarnName} / ${order.yarnReceipt.colorName}`,
      materialName: order.yarnReceipt.yarnName,
      materialSpec: `${order.yarnReceipt.colorName} / 称重领料`,
      skuCode: order.yarnReceipt.yarnSku,
      skuColor: order.yarnReceipt.colorName,
      skuSize: '纱线',
      pieceName: '针织纱线',
      qtyExpected: handedQty,
      qtyActual: hasReceived ? receivedQty : undefined,
      qtyUnit: 'kg',
      submittedAt: order.scheduledStartAt,
      status: hasReceived ? (order.yarnReceipt.differenceWeightKg !== 0 ? 'OBJECTION_RESOLVED' : 'RECEIVED') : 'PENDING_FACTORY_CONFIRM',
      receivedAt: hasReceived ? order.yarnReceipt.receivedAt : undefined,
      pickupMode: 'WAREHOUSE_DELIVERY',
      qrCodeValue: `KNIT-PICKUP:${order.taskNo}`,
      warehouseHandedQty: handedQty,
      warehouseHandedAt: order.scheduledStartAt,
      warehouseHandedBy: '染厂/面料仓送料员',
      factoryConfirmedQty: hasReceived ? receivedQty : undefined,
      factoryConfirmedAt: hasReceived ? order.yarnReceipt.receivedAt : undefined,
      factoryReportedQty: hasReceived && order.yarnReceipt.differenceWeightKg !== 0 ? receivedQty : undefined,
      finalResolvedQty: hasReceived && order.yarnReceipt.differenceWeightKg !== 0 ? receivedQty : undefined,
      finalResolvedAt: hasReceived && order.yarnReceipt.differenceWeightKg !== 0 ? order.yarnReceipt.receivedAt : undefined,
      exceptionCaseId: hasReceived && order.yarnReceipt.differenceWeightKg !== 0 ? `EX-KNIT-YARN-${order.knittingOrderNo}` : undefined,
      objectionReason: hasReceived && order.yarnReceipt.differenceWeightKg !== 0 ? '针织厂称重实收与送料重量不一致' : undefined,
      objectionRemark: order.yarnReceipt.evidenceText,
      objectionProofFiles: hasReceived && order.yarnReceipt.evidenceText
        ? [
            {
              id: `proof-${order.knittingOrderId}-image`,
              type: 'IMAGE',
              name: '纱线称重照片.jpg',
              uploadedAt: order.yarnReceipt.receivedAt,
            },
            {
              id: `proof-${order.knittingOrderId}-video`,
              type: 'VIDEO',
              name: '纱线到货视频.mp4',
              uploadedAt: order.yarnReceipt.receivedAt,
            },
          ]
        : [],
      objectionStatus: hasReceived && order.yarnReceipt.differenceWeightKg !== 0 ? 'RESOLVED' : undefined,
      resolvedRemark: hasReceived && order.yarnReceipt.differenceWeightKg !== 0 ? '已按针织厂称重实收数量确认' : undefined,
      remark: '染厂/面料仓送料到厂，针织厂按 kg 称重确认。',
    },
  ]
}

export function getKnittingHandoutRecordSeedsByHeadId(handoverId: string): PdaTaskMockHandoutRecordSeed[] {
  const order = listKnittingWorkOrders().find((item) => getKnittingHandoverId(item, 'HANDOUT') === handoverId)
  if (!order) return []
  const plannedQty = order.handoverQty ?? order.completedQty
  const isPartPanel = order.kind === 'PART_PANEL'
  return [
    {
      handoverId,
      recordId: `${handoverId}-001`,
      taskId: order.taskNo,
      materialCode: order.yarnReceipt.yarnSku,
      materialName: isPartPanel ? '针织部位片' : '针织整件',
      materialSpec: `${order.styleName} / ${order.colorName} / ${order.sizeRange}`,
      skuCode: order.styleNo,
      skuColor: order.colorName,
      skuSize: order.sizeRange,
      pieceName: isPartPanel ? '针织部位片' : '针织整件',
      plannedQty,
      qtyUnit: order.qtyUnit,
      handoutObjectType: isPartPanel ? 'CUT_PIECE' : 'GARMENT',
      handoutItemLabel: `${KNITTING_KIND_LABEL[order.kind]} / ${order.colorName} / ${plannedQty}${order.qtyUnit} / 交${order.downstreamTarget}`,
      garmentEquivalentQty: isPartPanel ? Math.round(plannedQty / Math.max(order.partPanels.length || 1, 1)) : plannedQty,
      factorySubmittedBy: OWN_KNITTING_FACTORY_NAME,
      receiverWrittenQty: order.receiverWrittenQty,
      receiverWrittenAt: order.receiverWrittenQty ? order.scheduledEndAt : undefined,
      receiverWrittenBy: order.receiverWrittenQty ? order.downstreamTarget : undefined,
      factorySubmittedAt: order.scheduledEndAt,
      status: order.receiverWrittenQty
        ? order.handoverDifferenceQty
          ? 'OBJECTION_REPORTED'
          : 'WRITTEN_BACK'
        : 'PENDING_WRITEBACK',
      warehouseReturnNo: order.handoverOrderNo,
      warehouseWrittenQty: order.receiverWrittenQty,
      warehouseWrittenAt: order.receiverWrittenQty ? order.scheduledEndAt : undefined,
      factoryRemark: `${KNITTING_KIND_LABEL[order.kind]}完成后交${order.downstreamTarget}`,
      objectionReason: order.handoverDifferenceQty ? `${order.downstreamTarget}回写数量存在差异` : undefined,
      objectionRemark: order.handoverDifferenceQty ? `交出 ${plannedQty}${order.qtyUnit}，回写 ${order.receiverWrittenQty}${order.qtyUnit}` : undefined,
    },
  ]
}

export function buildKnittingPartPanelFeiTicketSourceId(order: KnittingWorkOrder, panel: KnittingPartPanel): string {
  return panel.feiTicketNo || `针织菲票-${order.knittingOrderNo}-${panel.partName}-${panel.colorName}-${panel.sizeCode}`
}

export function listKnittingFeiTicketPrintRecords(): KnittingFeiTicketPrintRecord[] {
  return listKnittingWorkOrders()
    .filter((order) => order.kind === 'PART_PANEL')
    .flatMap((order) =>
      order.partPanels.map((panel) => {
        const ticketNo = buildKnittingPartPanelFeiTicketSourceId(order, panel)
        const quantity = panel.completedPieces || panel.plannedPieces
        return {
          ticketSourceType: 'KNITTING_PART_PANEL',
          ticketRecordId: ticketNo,
          ticketNo,
          feiTicketId: ticketNo,
          feiTicketNo: ticketNo,
          originalCutOrderId: order.knittingOrderId,
          originalCutOrderNo: order.knittingOrderNo,
          sourceCutOrderNo: order.knittingOrderNo,
          productionOrderNo: order.productionOrderNo,
          sourceProductionOrderNo: order.productionOrderNo,
          styleCode: order.styleNo,
          spuCode: order.styleNo,
          materialSku: order.yarnReceipt.yarnSku,
          partName: panel.partName,
          pieceGroup: panel.partName,
          pieceDisplayName: `${panel.partName} / ${panel.colorName} / ${panel.sizeCode}`,
          color: panel.colorName,
          fabricColor: panel.colorName,
          garmentColor: panel.colorName,
          size: panel.sizeCode,
          skuSize: panel.sizeCode,
          quantity,
          actualCutPieceQty: quantity,
          qty: quantity,
          processTags: ['部位针织'],
          specialCraftSummary: '部位针织 · 不进缝盘、熨烫、包装',
          currentCraftStage: '部位针织菲票',
          status: panel.feiTicketStatus === '已打印' ? 'PRINTED' : 'WAITING_PRINT',
          printStatusLabel: panel.feiTicketStatus,
          flowStatusLabel: panel.feiTicketStatus === '已打印' ? '待交裁床待交出仓' : '待打印',
          boundPocketNo: order.downstreamTarget,
          sourcePieceInstanceId: `${order.knittingOrderId}-${panel.partName}-${panel.sizeCode}`,
          sequenceNo: panel.sizeCode,
          version: panel.feiTicketStatus === '已打印' ? 'V1' : '待首次打印',
          reprintCount: 0,
        }
      }),
    )
}

function getDefaultKnittingWarehouseLocations(mode: KnittingWarehouseMode): KnittingWarehouseLocation[] {
  const prefix = mode === 'wait-process' ? 'KWP' : 'KWH'
  const warehouseName = mode === 'wait-process' ? '待加工仓' : '待交出仓'
  return [
    {
      locationId: `${prefix}-LOC-A01`,
      warehouseMode: mode,
      areaName: `${warehouseName} A 区`,
      locationCode: `${prefix}-A-01`,
      capacityText: mode === 'wait-process' ? '纱线 800 kg' : '成品/部位 1200 件/片',
      managerName: '周哥',
      status: '启用',
      remark: '默认库位',
      updatedAt: '2026-05-09 09:00',
    },
    {
      locationId: `${prefix}-LOC-B01`,
      warehouseMode: mode,
      areaName: `${warehouseName} B 区`,
      locationCode: `${prefix}-B-01`,
      capacityText: mode === 'wait-process' ? '纱线 600 kg' : '待交出周转 900 件/片',
      managerName: '针织仓管',
      status: '启用',
      remark: '周转库位',
      updatedAt: '2026-05-09 09:00',
    },
  ]
}

export function listKnittingWarehouseLocations(mode: KnittingWarehouseMode): KnittingWarehouseLocation[] {
  const storeLocations = readKnittingStore().locations.filter((location) => location.warehouseMode === mode)
  const storedIds = new Set(storeLocations.map((location) => location.locationId))
  return cloneValue([
    ...storeLocations,
    ...getDefaultKnittingWarehouseLocations(mode).filter((location) => !storedIds.has(location.locationId)),
  ])
}

export function upsertKnittingWarehouseLocation(input: Partial<KnittingWarehouseLocation> & { warehouseMode: KnittingWarehouseMode }): KnittingWarehouseLocation {
  const store = readKnittingStore()
  const locationId = input.locationId || `KLOC-${input.warehouseMode}-${Date.now()}`
  const existing =
    store.locations.find((location) => location.locationId === locationId)
    || getDefaultKnittingWarehouseLocations(input.warehouseMode).find((location) => location.locationId === locationId)
  const next: KnittingWarehouseLocation = {
    locationId,
    warehouseMode: input.warehouseMode,
    areaName: input.areaName?.trim() || existing?.areaName || (input.warehouseMode === 'wait-process' ? '待加工仓 A 区' : '待交出仓 A 区'),
    locationCode: input.locationCode?.trim() || existing?.locationCode || `KLOC-${String(store.locations.length + 1).padStart(2, '0')}`,
    capacityText: input.capacityText?.trim() || existing?.capacityText || '待维护',
    managerName: input.managerName?.trim() || existing?.managerName || '周哥',
    status: input.status || existing?.status || '启用',
    remark: input.remark?.trim() || existing?.remark || '',
    updatedAt: nowTimestamp(),
  }
  const index = store.locations.findIndex((location) => location.locationId === locationId)
  if (index >= 0) store.locations[index] = next
  else store.locations.unshift(next)
  writeKnittingStore(store)
  return cloneValue(next)
}

export function deleteKnittingWarehouseLocation(locationId: string): void {
  const store = readKnittingStore()
  store.locations = store.locations.filter((location) => location.locationId !== locationId)
  writeKnittingStore(store)
}

export function listKnittingWaitProcessReceiptRecords(): KnittingWaitProcessReceiptRecord[] {
  return listKnittingWorkOrders().map((order) => ({
    recordId: `KWP-RCV-${order.knittingOrderId}`,
    receiptNo: `领料-${order.knittingOrderNo}`,
    knittingOrderId: order.knittingOrderId,
    knittingOrderNo: order.knittingOrderNo,
    productionOrderNo: order.productionOrderNo,
    sourceName: '染厂/印花厂/面辅料仓',
    yarnSku: order.yarnReceipt.yarnSku,
    yarnName: order.yarnReceipt.yarnName,
    plannedWeightKg: order.yarnReceipt.plannedWeightKg,
    receivedWeightKg: order.yarnReceipt.receivedWeightKg,
    differenceWeightKg: order.yarnReceipt.receivedWeightKg > 0 ? order.yarnReceipt.differenceWeightKg : 0,
    evidenceText: order.yarnReceipt.evidenceText || '待上传照片视频',
    receivedAt: order.yarnReceipt.receivedWeightKg > 0 ? order.yarnReceipt.receivedAt : '待确认',
    statusText: order.yarnReceipt.receivedWeightKg > 0 ? (order.yarnReceipt.differenceWeightKg === 0 ? '已确认' : '差异已记录') : '待确认',
  }))
}

export function listKnittingWaitProcessUsageRecords(): KnittingWaitProcessUsageRecord[] {
  return listKnittingWorkOrders()
    .flatMap((order) => {
      const flatNode = getKnittingNode(order, '横机成片')
      const linkingNode = getKnittingNode(order, '缝盘')
      const usageSummary = getKnittingYarnUsageSummary(order)
      const records: KnittingWaitProcessUsageRecord[] = [
        {
          recordId: `KWP-USE-START-${order.knittingOrderId}`,
          usageNo: `开工领用-${order.knittingOrderNo}`,
          recordType: '开工领用',
          knittingOrderId: order.knittingOrderId,
          knittingOrderNo: order.knittingOrderNo,
          taskNo: order.taskNo,
          productionOrderNo: order.productionOrderNo,
          yarnSku: order.yarnReceipt.yarnSku,
          usedWeightKg: usageSummary.processingUsageWeightKg,
          usedAt: flatNode?.startedAt || '待开工',
          nodeName: '横机成片',
          operatorName: flatNode?.operatorName || OWN_KNITTING_FACTORY_NAME,
          statusText: usageSummary.processingUsageWeightKg > 0 ? '已领用' : '待开工领用',
        },
      ]
      if (order.kind === 'WHOLE_GARMENT' && linkingNode) {
        records.push({
          recordId: `KWP-USE-LINKING-${order.knittingOrderId}`,
          usageNo: `缝盘损耗-${order.knittingOrderNo}`,
          recordType: '缝盘损耗',
          knittingOrderId: order.knittingOrderId,
          knittingOrderNo: order.knittingOrderNo,
          taskNo: order.taskNo,
          productionOrderNo: order.productionOrderNo,
          yarnSku: order.yarnReceipt.yarnSku,
          usedWeightKg: usageSummary.linkingLossWeightKg,
          usedAt: linkingNode.finishedAt || '待缝盘完成',
          nodeName: '缝盘',
          operatorName: linkingNode.operatorName || OWN_KNITTING_FACTORY_NAME,
          statusText: usageSummary.linkingLossWeightKg > 0 ? '已记录损耗' : linkingNode.status === '已完成' ? '损耗为 0' : '待记录损耗',
        })
      }
      return records
    })
    .filter((record) => record.usedWeightKg > 0 || record.statusText.startsWith('待') || record.statusText === '损耗为 0')
}

function hasKnittingInboundToHandover(order: KnittingWorkOrder): boolean {
  if (order.kind === 'PART_PANEL') {
    return order.nodes.some((node) => node.nodeName === '横机成片' && node.status === '已完成')
  }
  return ['WAIT_HANDOVER', 'HANDOVER_SUBMITTED', 'COMPLETED'].includes(order.status)
}

export function listKnittingWaitHandoverInboundRecords(): KnittingWaitHandoverInboundRecord[] {
  return listKnittingWorkOrders()
    .filter(hasKnittingInboundToHandover)
    .map((order) => {
      const finishedNode = [...order.nodes].reverse().find((node) => node.finishedAt)
      return {
        recordId: `KWH-IN-${order.knittingOrderId}`,
        inboundNo: `加工入仓-${order.knittingOrderNo}`,
        knittingOrderId: order.knittingOrderId,
        knittingOrderNo: order.knittingOrderNo,
        taskNo: order.taskNo,
        productionOrderNo: order.productionOrderNo,
        kind: order.kind,
        itemName: order.kind === 'PART_PANEL' ? '针织部位片' : '整件针织半成品',
        inboundQty: order.completedQty,
        unit: order.qtyUnit,
        inboundAt: finishedNode?.finishedAt || order.scheduledEndAt,
        operatorName: finishedNode?.operatorName || OWN_KNITTING_FACTORY_NAME,
        statusText: order.status === 'COMPLETED' ? '已完成' : '已入待交出仓',
      }
    })
}

export function listKnittingWaitHandoverHandoutRecords(): KnittingWaitHandoverHandoutRecord[] {
  return listKnittingWorkOrders()
    .filter((order) => ['HANDOVER_SUBMITTED', 'COMPLETED'].includes(order.status))
    .map((order) => ({
      recordId: `KWH-OUT-${order.knittingOrderId}`,
      handoutNo: order.handoverOrderNo || `交出-${order.knittingOrderNo}`,
      knittingOrderId: order.knittingOrderId,
      knittingOrderNo: order.knittingOrderNo,
      productionOrderNo: order.productionOrderNo,
      downstreamTarget: order.downstreamTarget,
      handoutQty: order.handoverQty ?? order.completedQty,
      receiverWrittenQty: order.receiverWrittenQty,
      unit: order.qtyUnit,
      handoutAt: order.scheduledEndAt,
      statusText: order.receiverWrittenQty ? '已回写' : '已交出待回写',
    }))
}

export function listKnittingWarehouseInventory(mode: KnittingWarehouseMode): KnittingWarehouseInventoryItem[] {
  const locations = listKnittingWarehouseLocations(mode)
  if (mode === 'wait-process') {
    const receiptMap = new Map(listKnittingWaitProcessReceiptRecords().map((record) => [record.knittingOrderId, record]))
    const recoveryRecords = listKnittingYarnRecoveryRecords()
    const yarnGroups = new Map<string, {
      orders: KnittingWorkOrder[]
      receivedQty: number
      usedQty: number
      recoveredQty: number
      flowRecords: KnittingWarehouseFlowRecord[]
    }>()
    listKnittingWorkOrders().forEach((order) => {
      const key = `${order.yarnReceipt.yarnSku}__${order.yarnReceipt.colorName}`
      const group = yarnGroups.get(key) || {
        orders: [],
        receivedQty: 0,
        usedQty: 0,
        recoveredQty: 0,
        flowRecords: [],
      }
      const receipt = receiptMap.get(order.knittingOrderId)
      const usageSummary = getKnittingYarnUsageSummary(order)
      const receivedQty = receipt?.receivedWeightKg || 0
      group.orders.push(order)
      group.receivedQty = roundQty(group.receivedQty + receivedQty)
      group.usedQty = roundQty(group.usedQty + usageSummary.processingUsageWeightKg + usageSummary.linkingLossWeightKg)
      if (receivedQty > 0) {
        group.flowRecords.push({
          flowId: `KWP-FLOW-IN-${order.knittingOrderId}`,
          flowType: '领料入仓',
          sourceNo: receipt?.receiptNo || `领料-${order.knittingOrderNo}`,
          qty: receivedQty,
          unit: 'kg',
          operatedAt: receipt?.receivedAt || '待确认',
          operatorName: order.yarnReceipt.receiverName,
          remark: `${order.knittingOrderNo} / ${receipt?.statusText || '已确认'}`,
        })
      }
      if (usageSummary.processingUsageWeightKg > 0) {
        const flatNode = getKnittingNode(order, '横机成片')
        group.flowRecords.push({
          flowId: `KWP-FLOW-START-USE-${order.knittingOrderId}`,
          flowType: '加工用料',
          sourceNo: `开工领用-${order.knittingOrderNo}`,
          qty: -usageSummary.processingUsageWeightKg,
          unit: 'kg',
          operatedAt: flatNode?.startedAt || '已开工',
          operatorName: flatNode?.operatorName || OWN_KNITTING_FACTORY_NAME,
          remark: '横机开工领用',
        })
      }
      if (usageSummary.linkingLossWeightKg > 0) {
        const linkingNode = getKnittingNode(order, '缝盘')
        group.flowRecords.push({
          flowId: `KWP-FLOW-LINKING-LOSS-${order.knittingOrderId}`,
          flowType: '加工用料',
          sourceNo: `缝盘损耗-${order.knittingOrderNo}`,
          qty: -usageSummary.linkingLossWeightKg,
          unit: 'kg',
          operatedAt: linkingNode?.finishedAt || '已缝盘',
          operatorName: linkingNode?.operatorName || OWN_KNITTING_FACTORY_NAME,
          remark: '缝盘损耗',
        })
      }
      addLegacyRecoveryFlow(group, order, recoveryRecords)
      yarnGroups.set(key, group)
    })
    return Array.from(yarnGroups.values()).map((group, index) => {
      const firstOrder = group.orders[0]
      addRecoveryFlowsToGroup(group, firstOrder.yarnReceipt.yarnSku, recoveryRecords)
      const relatedOrderNos = group.orders.map((order) => order.knittingOrderNo)
      const relatedProductionOrderNos = Array.from(new Set(group.orders.map((order) => order.productionOrderNo)))
      const location = locations[index % Math.max(locations.length, 1)]
      const currentQty = roundQty(Math.max(group.receivedQty - group.usedQty + group.recoveredQty, 0))
      const hasPendingReceipt = group.orders.some((order) => order.yarnReceipt.receivedWeightKg <= 0)
      return {
        inventoryId: `KWP-YARN-${firstOrder.yarnReceipt.yarnSku}-${firstOrder.yarnReceipt.colorName}`,
        warehouseMode: mode,
        knittingOrderId: firstOrder.knittingOrderId,
        knittingOrderNo: relatedOrderNos.slice(0, 3).join(' / ') + (relatedOrderNos.length > 3 ? ` 等 ${relatedOrderNos.length} 单` : ''),
        taskNo: firstOrder.taskNo,
        kind: firstOrder.kind,
        productionOrderNo: relatedProductionOrderNos.slice(0, 3).join(' / ') + (relatedProductionOrderNos.length > 3 ? ` 等 ${relatedProductionOrderNos.length} 单` : ''),
        styleName: firstOrder.styleName,
        yarnSku: firstOrder.yarnReceipt.yarnSku,
        relatedOrderNos,
        relatedProductionOrderNos,
        itemName: firstOrder.yarnReceipt.yarnName,
        itemSpec: firstOrder.yarnReceipt.colorName,
        currentQty,
        unit: 'kg',
        locationText: location ? `${location.areaName} / ${location.locationCode}` : '待分配库位',
        statusText: group.receivedQty <= 0 ? '待领料确认' : hasPendingReceipt ? '部分待领料' : group.usedQty > 0 ? '加工用料中' : '已入待加工仓',
        flowRecords: group.flowRecords,
      }
    })
  }

  const inboundMap = new Map(listKnittingWaitHandoverInboundRecords().map((record) => [record.knittingOrderId, record]))
  const handoutMap = new Map(listKnittingWaitHandoverHandoutRecords().map((record) => [record.knittingOrderId, record]))
  return listKnittingWorkOrders()
    .filter((order) => inboundMap.has(order.knittingOrderId))
    .map((order, index) => {
      const inbound = inboundMap.get(order.knittingOrderId)
      const handout = handoutMap.get(order.knittingOrderId)
      const inboundQty = inbound?.inboundQty || 0
      const handoutQty = handout?.handoutQty || 0
      const flowRecords: KnittingWarehouseFlowRecord[] = [
        {
          flowId: `KWH-FLOW-IN-${order.knittingOrderId}`,
          flowType: '加工入仓',
          sourceNo: inbound?.inboundNo || `加工入仓-${order.knittingOrderNo}`,
          qty: inboundQty,
          unit: order.qtyUnit,
          operatedAt: inbound?.inboundAt || order.scheduledEndAt,
          operatorName: inbound?.operatorName || OWN_KNITTING_FACTORY_NAME,
          remark: inbound?.statusText || '已入待交出仓',
        },
        ...(handoutQty > 0
          ? [
              {
                flowId: `KWH-FLOW-OUT-${order.knittingOrderId}`,
                flowType: '交出出仓' as const,
                sourceNo: handout?.handoutNo || `交出-${order.knittingOrderNo}`,
                qty: -handoutQty,
                unit: order.qtyUnit,
                operatedAt: handout?.handoutAt || order.scheduledEndAt,
                operatorName: OWN_KNITTING_FACTORY_NAME,
                remark: `交出给${order.downstreamTarget}`,
              },
            ]
          : []),
      ]
      const location = locations[index % Math.max(locations.length, 1)]
      return {
        inventoryId: `KWH-INV-${order.knittingOrderId}`,
        warehouseMode: mode,
        knittingOrderId: order.knittingOrderId,
        knittingOrderNo: order.knittingOrderNo,
        taskNo: order.taskNo,
        kind: order.kind,
        productionOrderNo: order.productionOrderNo,
        styleName: order.styleName,
        itemName: order.kind === 'PART_PANEL' ? '针织部位片' : '整件针织半成品',
        itemSpec: `${order.styleNo} / ${order.colorName} / ${order.sizeRange}`,
        currentQty: roundQty(Math.max(inboundQty - handoutQty, 0)),
        unit: order.qtyUnit,
        locationText: location ? `${location.areaName} / ${location.locationCode}` : '待分配库位',
        statusText: handoutQty > 0 ? '已交出' : '待交出',
        flowRecords,
      }
    })
}

export function getKnittingMachineScheduleSummary(): KnittingMachineScheduleSummary {
  const schedules = listKnittingMachineSchedules()
  const inUseSchedules = schedules.filter((schedule) => schedule.status !== '空闲')
  return {
    scheduleCount: schedules.length,
    scheduledWorkOrderCount: new Set(inUseSchedules.map((schedule) => schedule.knittingOrderId).filter(Boolean)).size,
    totalMachineCount: schedules.reduce((sum, schedule) => sum + schedule.machineNos.length, 0),
    inUseMachineCount: inUseSchedules.reduce((sum, schedule) => sum + schedule.machineNos.length, 0),
    idleMachineCount: schedules
      .filter((schedule) => schedule.status === '空闲')
      .reduce((sum, schedule) => sum + schedule.machineNos.length, 0),
    partPanelScheduleCount: inUseSchedules.filter((schedule) => {
      const order = schedule.knittingOrderId ? getKnittingWorkOrderById(schedule.knittingOrderId) : undefined
      return order?.kind === 'PART_PANEL'
    }).length,
    delayedScheduleCount: schedules.filter((schedule) => schedule.status === '延误').length,
  }
}

export function getKnittingWorkOrderKindLabel(kind: KnittingWorkOrderKind): string {
  return KNITTING_KIND_LABEL[kind]
}

export function getKnittingWorkOrderStatusLabel(status: KnittingWorkOrderStatus): string {
  return KNITTING_STATUS_LABEL[status]
}

export function getKnittingWorkOrderSummary(): KnittingWorkOrderSummary {
  const orders = listKnittingWorkOrders()
  return {
    total: orders.length,
    wholeGarmentCount: orders.filter((order) => order.kind === 'WHOLE_GARMENT').length,
    partPanelCount: orders.filter((order) => order.kind === 'PART_PANEL').length,
    waitAcceptCount: orders.filter((order) => order.status === 'WAIT_ACCEPT').length,
    waitPickupCount: orders.filter((order) => order.status === 'WAIT_PICKUP').length,
    pickupInProgressCount: orders.filter((order) => order.status === 'PICKUP_IN_PROGRESS').length,
    waitMachineScheduleCount: orders.filter((order) => order.status === 'WAIT_MACHINE_SCHEDULE').length,
    flatKnittingCount: orders.filter((order) =>
      order.status === 'FLAT_KNITTING'
      || order.nodes.some((node) => node.nodeName === '横机成片' && node.status === '进行中'),
    ).length,
    waitFeiTicketCount: orders.filter((order) => order.status === 'WAIT_FEI_TICKET').length,
    waitHandoverCount: orders.filter((order) => order.status === 'WAIT_HANDOVER').length,
    completedCount: orders.filter((order) => order.status === 'COMPLETED').length,
    plannedQty: orders.reduce((sum, order) => sum + order.plannedQty, 0),
    completedQty: orders.reduce((sum, order) => sum + order.completedQty, 0),
  }
}
