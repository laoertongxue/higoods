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
} from './production-orders.ts'
import {
  getProductionOrderTechPackSnapshot,
} from './production-order-tech-pack-runtime.ts'
import {
  listRuntimeExecutionTasks,
} from './runtime-process-tasks.ts'
import { buildTaskQrValue } from './task-qr.ts'

export type KnittingWorkOrderKind = 'WHOLE_GARMENT' | 'PART_PANEL'

export type KnittingWorkOrderStatus =
  | 'WAIT_YARN_RECEIVE'
  | 'YARN_RECEIVED_WITH_DIFF'
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
  | 'RECEIVER_WRITTEN_BACK'
  | 'WAIT_REVIEW'
  | 'COMPLETED'

export type KnittingNodeStatus = '未开始' | '进行中' | '已完成' | '已跳过'

export type KnittingMachineScheduleStatus = '计划中' | '进行中' | '已完成' | '空闲' | '延迟预警'

export interface KnittingYarnReceipt {
  yarnSku: string
  yarnName: string
  colorName: string
  plannedWeightKg: number
  receivedWeightKg: number
  differenceWeightKg: number
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
  riskText: string
  remark: string
}

export interface KnittingWorkOrder {
  knittingOrderId: string
  knittingOrderNo: string
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
  taskNo: string
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
  waitYarnReceiveCount: number
  yarnDifferenceCount: number
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

export const KNITTING_KIND_LABEL: Record<KnittingWorkOrderKind, string> = {
  WHOLE_GARMENT: '整件针织',
  PART_PANEL: '部位针织',
}

export const KNITTING_STATUS_LABEL: Record<KnittingWorkOrderStatus, string> = {
  WAIT_YARN_RECEIVE: '待接纱',
  YARN_RECEIVED_WITH_DIFF: '接纱有差异',
  MACHINE_SCHEDULED: '已排横机',
  FLAT_KNITTING: '横机中',
  WAIT_LINKING: '待缝盘',
  LINKING: '缝盘中',
  WAIT_IRONING: '待熨烫',
  IRONING: '熨烫中',
  WAIT_PACKING: '待包装',
  PACKING: '包装中',
  WAIT_FEI_TICKET: '待打印菲票',
  FEI_TICKET_PRINTED: '菲票已打印',
  WAIT_HANDOVER: '待交出',
  HANDOVER_SUBMITTED: '待回写',
  RECEIVER_WRITTEN_BACK: '待审核',
  WAIT_REVIEW: '待审核',
  COMPLETED: '已完成',
}

function isGeneratedKnittingTask(task: ProcessTask): boolean {
  return task.processBusinessCode === 'KNITTING'
    || task.processCode === 'PROC_KNIT'
    || task.processCode === 'KNITTING'
    || task.craftName === '整件针织'
    || task.craftName === '部位针织'
}

function listGeneratedKnittingTasks(): ProcessTask[] {
  return listRuntimeExecutionTasks()
    .filter((task) => task.defaultDocType !== 'DEMAND')
    .filter(isGeneratedKnittingTask)
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
  if (kind === 'PART_PANEL') return roundQty(plannedQty * 0.72)
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
  const receivedWeightKg = roundQty(task.yarnReceivedWeightKg ?? plannedWeightKg)
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
        machineNos: ['H-021', 'H-022', 'H-023', 'H-024'],
        startedAt: task.startedAt,
        finishedAt: flatStatus === '已完成' ? task.finishedAt || '2026-05-10 16:30' : undefined,
        remark: '部位针织完成后打印菲票，交裁床待交出仓。',
      },
    ]
  }

  return [
    {
      nodeName: '横机成片',
      status: '已完成',
      plannedQty,
      completedQty: Math.min(plannedQty, Math.max(completedQty, Math.round(plannedQty * 0.5))),
      unit: '件',
      operatorName: '针织车间',
      machineNos: ['H-001', 'H-002', 'H-003', 'H-004'],
      startedAt: task.startedAt,
      finishedAt: '2026-05-09 18:30',
      remark: '首批横机节点已上报。',
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
  if (task.status === 'NOT_STARTED') return 'WAIT_YARN_RECEIVE'
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
  const partPanels = kind === 'PART_PANEL'
    ? buildGeneratedPartPanels(task, task.status === 'DONE' ? 1 : 0.72)
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
    yarnReceipt,
    nodes: buildGeneratedKnittingNodes(task, kind, plannedQty, completedQty, needsPackaging),
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

function buildGeneratedKnittingMachineSchedules(): KnittingMachineSchedule[] {
  const orders = buildGeneratedKnittingWorkOrders()
  const schedules = orders.map((order, index): KnittingMachineSchedule => {
    const machineStart = index * 4 + 1
    const machineNos = Array.from({ length: Math.min(order.plannedMachineCount, order.kind === 'PART_PANEL' ? 4 : 6) }, (_, offset) => `H-${String(machineStart + offset).padStart(3, '0')}`)
    return {
      scheduleId: `KMS-GEN-${String(index + 1).padStart(3, '0')}`,
      machineGroupName: order.kind === 'PART_PANEL' ? '部位针织组' : '整件针织组',
      machineNos,
      knittingOrderId: order.knittingOrderId,
      plannedStartAt: order.scheduledStartAt,
      plannedEndAt: order.scheduledEndAt,
      actualStartAt: order.nodes.find((node) => node.startedAt)?.startedAt,
      operatorName: order.kind === 'PART_PANEL' ? '部位针织车间' : '整件针织车间',
      status: order.status === 'COMPLETED' ? '已完成' : order.status === 'WAIT_YARN_RECEIVE' ? '计划中' : '进行中',
      riskText: order.yarnReceipt.differenceWeightKg !== 0 ? '收纱数量存在差异' : '按计划执行',
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
      riskText: '可插急单 300 件/片以内',
      remark: '预留给翻单、补片或异常返修任务。',
    },
  ]
}

export function listKnittingWorkOrders(): KnittingWorkOrder[] {
  return buildGeneratedKnittingWorkOrders()
}

export function listKnittingMachineSchedules(): KnittingMachineSchedule[] {
  return buildGeneratedKnittingMachineSchedules()
}

export function getKnittingWorkOrderById(knittingOrderId: string): KnittingWorkOrder | undefined {
  return listKnittingWorkOrders().find((order) => order.knittingOrderId === knittingOrderId)
}

export function getKnittingWorkOrderByTaskId(taskId: string): KnittingWorkOrder | undefined {
  return listKnittingWorkOrders().find((order) => order.taskNo === taskId || order.knittingOrderId === taskId)
}

function getKnittingTaskStatus(order: KnittingWorkOrder): TaskStatus {
  if (order.status === 'WAIT_YARN_RECEIVE' || order.status === 'YARN_RECEIVED_WITH_DIFF' || order.status === 'MACHINE_SCHEDULED') return 'NOT_STARTED'
  if (order.status === 'WAIT_HANDOVER' || order.status === 'HANDOVER_SUBMITTED' || order.status === 'RECEIVER_WRITTEN_BACK' || order.status === 'WAIT_REVIEW' || order.status === 'COMPLETED') return 'DONE'
  return 'IN_PROGRESS'
}

function getKnittingTaskAcceptedAt(order: KnittingWorkOrder): string | undefined {
  if (order.status === 'WAIT_YARN_RECEIVE') return undefined
  return order.yarnReceipt.receivedAt && order.yarnReceipt.receivedAt !== '待确认'
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
  if (order.status === 'WAIT_HANDOVER' || order.status === 'HANDOVER_SUBMITTED' || order.status === 'RECEIVER_WRITTEN_BACK' || order.status === 'WAIT_REVIEW' || order.status === 'COMPLETED') return true
  if (order.kind === 'WHOLE_GARMENT') {
    return order.nodes.some((node) => node.nodeName === '横机成片' && node.status === '已完成')
  }
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
    acceptanceStatus: order.status === 'WAIT_YARN_RECEIVE' ? 'PENDING' : 'ACCEPTED',
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
      stageName: '收纱',
      processBusinessCode: 'KNITTING',
      processBusinessName: '针织',
      taskTypeCode: order.kind,
      taskTypeLabel: KNITTING_KIND_LABEL[order.kind],
      assignmentGranularityLabel: order.kind === 'PART_PANEL' ? '部位/尺码' : '整件',
    }
  })

  const handoutHeads = listKnittingWorkOrders()
    .filter((order) => order.status === 'WAIT_HANDOVER' || order.status === 'HANDOVER_SUBMITTED' || order.status === 'RECEIVER_WRITTEN_BACK' || order.status === 'WAIT_REVIEW' || order.status === 'COMPLETED')
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
      materialSpec: `${order.yarnReceipt.colorName} / 称重收纱`,
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
    delayedScheduleCount: schedules.filter((schedule) => schedule.status === '延迟预警').length,
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
    waitYarnReceiveCount: orders.filter((order) => order.status === 'WAIT_YARN_RECEIVE').length,
    yarnDifferenceCount: orders.filter((order) => order.yarnReceipt.differenceWeightKg !== 0).length,
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
