import { indonesiaFactories } from '../indonesia-factories.ts'
import type { AcceptanceStatus, BlockReason, TaskStatus } from '../process-tasks.ts'
import type {
  PdaMobileAwardedTenderNoticeMock,
  PdaMobileBiddingTenderMock,
  PdaMobileQuotedTenderMock,
} from '../pda-mobile-mock.ts'
import {
  getGeneratedOriginalCutOrderSourceRecordById,
  listGeneratedOriginalCutOrderSourceRecords,
  type GeneratedOriginalCutOrderSourceRecord,
} from './generated-original-cut-orders.ts'
import {
  PDA_CUTTING_TASK_MOCK_MATRIX,
  type PdaCuttingExecutionBindingState,
  type PdaCuttingSpreadingPresetMatrixItem,
  type PdaCuttingTaskMockMatrixItem,
  type PdaCuttingTaskOrigin,
} from './pda-cutting-mock-matrix.ts'
import type { PdaCuttingExecutionSourceRecord, PdaCuttingTaskSourceRecord } from './pda-cutting-task-source.ts'

export interface PdaCuttingResolvedExecutionScenario extends PdaCuttingExecutionSourceRecord {
  taskId: string
  taskNo: string
  bindingState: PdaCuttingExecutionBindingState
  originalCutOrderRecord: GeneratedOriginalCutOrderSourceRecord | null
  spreadingPreset: PdaCuttingSpreadingPresetMatrixItem | null
}

export interface PdaCuttingResolvedTaskScenario {
  taskId: string
  taskNo: string
  origin: PdaCuttingTaskOrigin
  acceptanceStatus?: AcceptanceStatus
  taskStatus: TaskStatus
  assignedFactoryId: string
  assignedFactoryName: string
  qty: number
  qtyUnit: string
  standardPrice: number
  currency: string
  unit: string
  acceptDeadline: string
  taskDeadline: string
  taskSummaryNote: string
  blockReason?: BlockReason
  blockRemark?: string
  acceptedAt?: string
  acceptedBy?: string
  startedAt?: string
  finishedAt?: string
  blockedAt?: string
  dispatchRemark?: string
  dispatchedAt: string
  dispatchedBy: string
  priceDiffReason?: string
  dispatchPrice?: number
  tenderId?: string
  factoryPoolCount?: number
  biddingDeadline?: string
  quotedPrice?: number
  quotedAt?: string
  deliveryDays?: number
  tenderStatusLabel?: string
  tenderRemark?: string
  notifiedAt?: string
  awardNote?: string
  productionOrderId: string
  productionOrderNo: string
  bindingState: PdaCuttingExecutionBindingState
  executions: PdaCuttingResolvedExecutionScenario[]
}

const originalCutOrderByNo = new Map(
  listGeneratedOriginalCutOrderSourceRecords().map((record) => [record.originalCutOrderNo, record] as const),
)

function getFactoryName(factoryId: string): string {
  return indonesiaFactories.find((item) => item.id === factoryId)?.name ?? factoryId
}

function resolveBoundExecution(matrix: PdaCuttingTaskMockMatrixItem, execution: PdaCuttingTaskMockMatrixItem['executions'][number]): PdaCuttingResolvedExecutionScenario {
  const originalCutOrderNo = execution.originalCutOrderNo?.trim() || ''
  const originalCutOrderRecord = originalCutOrderByNo.get(originalCutOrderNo)

  if (!originalCutOrderRecord) {
    throw new Error(`裁片 PDA mock 矩阵存在未找到的原始裁片单：${matrix.taskId} / ${execution.executionOrderNo} / ${originalCutOrderNo}`)
  }

  return {
    taskId: matrix.taskId,
    taskNo: matrix.taskNo,
    executionOrderId: execution.executionOrderId,
    executionOrderNo: execution.executionOrderNo,
    legacyCutPieceOrderNo: execution.executionOrderNo,
    productionOrderId: execution.productionOrderNo || originalCutOrderRecord.productionOrderId,
    productionOrderNo: execution.productionOrderNo || originalCutOrderRecord.productionOrderNo,
    originalCutOrderId: originalCutOrderRecord.originalCutOrderId,
    originalCutOrderNo: originalCutOrderRecord.originalCutOrderNo,
    mergeBatchId: execution.mergeBatchId || originalCutOrderRecord.mergeBatchId || '',
    mergeBatchNo: execution.mergeBatchNo || originalCutOrderRecord.mergeBatchNo || '',
    materialSku: execution.materialSku || originalCutOrderRecord.materialSku,
    bindingState: execution.bindingState || 'BOUND',
    originalCutOrderRecord,
    spreadingPreset: execution.spreadingPreset || null,
  }
}

function resolveUnboundExecution(matrix: PdaCuttingTaskMockMatrixItem, execution: PdaCuttingTaskMockMatrixItem['executions'][number]): PdaCuttingResolvedExecutionScenario {
  return {
    taskId: matrix.taskId,
    taskNo: matrix.taskNo,
    executionOrderId: execution.executionOrderId,
    executionOrderNo: execution.executionOrderNo,
    legacyCutPieceOrderNo: execution.executionOrderNo,
    productionOrderId: execution.productionOrderNo || '',
    productionOrderNo: execution.productionOrderNo || '',
    originalCutOrderId: '',
    originalCutOrderNo: '',
    mergeBatchId: execution.mergeBatchId || '',
    mergeBatchNo: execution.mergeBatchNo || '',
    materialSku: execution.materialSku || '',
    bindingState: execution.bindingState || 'UNBOUND',
    originalCutOrderRecord: null,
    spreadingPreset: execution.spreadingPreset || null,
  }
}

function resolveExecutionScenario(matrix: PdaCuttingTaskMockMatrixItem, execution: PdaCuttingTaskMockMatrixItem['executions'][number]): PdaCuttingResolvedExecutionScenario {
  if ((execution.bindingState || 'BOUND') === 'UNBOUND') {
    return resolveUnboundExecution(matrix, execution)
  }
  return resolveBoundExecution(matrix, execution)
}

function resolveTaskScenario(matrix: PdaCuttingTaskMockMatrixItem): PdaCuttingResolvedTaskScenario {
  const executions = matrix.executions.map((execution) => resolveExecutionScenario(matrix, execution))
  const firstExecution = executions[0]
  if (!firstExecution) {
    throw new Error(`裁片 PDA mock 矩阵缺少 execution：${matrix.taskId}`)
  }

  return {
    ...matrix,
    assignedFactoryName: getFactoryName(matrix.assignedFactoryId),
    productionOrderId: firstExecution.productionOrderId,
    productionOrderNo: firstExecution.productionOrderNo,
    bindingState: executions.some((execution) => execution.bindingState === 'UNBOUND') ? 'UNBOUND' : 'BOUND',
    executions,
  }
}

const resolvedTaskScenarios = PDA_CUTTING_TASK_MOCK_MATRIX.map((item) => resolveTaskScenario(item))

export function listPdaCuttingTaskScenarios(): PdaCuttingResolvedTaskScenario[] {
  return resolvedTaskScenarios.map((scenario) => ({
    ...scenario,
    executions: scenario.executions.map((execution) => ({ ...execution })),
  }))
}

export function getPdaCuttingTaskScenarioByTaskId(taskId: string): PdaCuttingResolvedTaskScenario | null {
  const scenario = resolvedTaskScenarios.find((item) => item.taskId === taskId)
  return scenario
    ? {
        ...scenario,
        executions: scenario.executions.map((execution) => ({ ...execution })),
      }
    : null
}

export function listPdaCuttingExecutionSourceRecordsFromScenarios(): PdaCuttingExecutionSourceRecord[] {
  return resolvedTaskScenarios.flatMap((scenario) =>
    scenario.executions.map((execution) => ({
      taskId: scenario.taskId,
      taskNo: scenario.taskNo,
      executionOrderId: execution.executionOrderId,
      executionOrderNo: execution.executionOrderNo,
      legacyCutPieceOrderNo: execution.legacyCutPieceOrderNo,
      productionOrderId: execution.productionOrderId,
      productionOrderNo: execution.productionOrderNo,
      originalCutOrderId: execution.originalCutOrderId,
      originalCutOrderNo: execution.originalCutOrderNo,
      mergeBatchId: execution.mergeBatchId,
      mergeBatchNo: execution.mergeBatchNo,
      materialSku: execution.materialSku,
      bindingState: execution.bindingState,
    })),
  )
}

export function listPdaCuttingTaskSourceRecordsFromScenarios(): PdaCuttingTaskSourceRecord[] {
  return resolvedTaskScenarios.map((scenario) => ({
    taskId: scenario.taskId,
    taskNo: scenario.taskNo,
    productionOrderId: scenario.productionOrderId,
    productionOrderNo: scenario.productionOrderNo,
    executionOrderIds: scenario.executions.map((execution) => execution.executionOrderId),
    executionOrderNos: scenario.executions.map((execution) => execution.executionOrderNo),
    bindingState: scenario.bindingState,
  }))
}

export function listPdaCuttingBiddingTenderMocks(): PdaMobileBiddingTenderMock[] {
  return resolvedTaskScenarios
    .filter((scenario) => scenario.origin === 'BIDDING_PENDING')
    .map((scenario) => ({
      tenderId: scenario.tenderId || `TENDER-${scenario.taskId}`,
      taskId: scenario.taskId,
      productionOrderId: scenario.productionOrderId,
      processName: '裁片',
      qty: scenario.qty,
      qtyUnit: scenario.qtyUnit,
      factoryPoolCount: scenario.factoryPoolCount || 1,
      biddingDeadline: scenario.biddingDeadline || scenario.acceptDeadline,
      taskDeadline: scenario.taskDeadline,
      standardPrice: scenario.standardPrice,
      currency: scenario.currency,
      factoryId: scenario.assignedFactoryId,
    }))
    .sort((left, right) => left.biddingDeadline.localeCompare(right.biddingDeadline, 'zh-CN'))
}

export function listPdaCuttingQuotedTenderMocks(): PdaMobileQuotedTenderMock[] {
  return resolvedTaskScenarios
    .filter((scenario) => scenario.origin === 'BIDDING_QUOTED')
    .map((scenario) => ({
      tenderId: scenario.tenderId || `TENDER-${scenario.taskId}`,
      taskId: scenario.taskId,
      productionOrderId: scenario.productionOrderId,
      processName: '裁片',
      qty: scenario.qty,
      qtyUnit: scenario.qtyUnit,
      quotedPrice: scenario.quotedPrice || scenario.standardPrice,
      quotedAt: scenario.quotedAt || scenario.dispatchedAt,
      deliveryDays: scenario.deliveryDays || 3,
      currency: scenario.currency,
      unit: scenario.unit,
      biddingDeadline: scenario.biddingDeadline || scenario.acceptDeadline,
      taskDeadline: scenario.taskDeadline,
      tenderStatusLabel: scenario.tenderStatusLabel || '招标中',
      remark: scenario.tenderRemark || scenario.taskSummaryNote,
      factoryId: scenario.assignedFactoryId,
    }))
    .sort((left, right) => right.quotedAt.localeCompare(left.quotedAt, 'zh-CN'))
}

export function listPdaCuttingAwardedTenderNoticeMocks(): PdaMobileAwardedTenderNoticeMock[] {
  return resolvedTaskScenarios
    .filter((scenario) => scenario.origin === 'BIDDING_AWARDED')
    .map((scenario) => ({
      tenderId: scenario.tenderId || `TENDER-${scenario.taskId}`,
      taskId: scenario.taskId,
      processName: '裁片',
      qty: scenario.qty,
      notifiedAt: scenario.notifiedAt || scenario.dispatchedAt,
      productionOrderId: scenario.productionOrderId,
      factoryId: scenario.assignedFactoryId,
    }))
    .sort((left, right) => right.notifiedAt.localeCompare(left.notifiedAt, 'zh-CN'))
}

export function listPdaCuttingSpreadingPresetExecutions(): Array<{
  taskId: string
  executionOrderId: string
  executionOrderNo: string
  preset: PdaCuttingSpreadingPresetMatrixItem
}> {
  return resolvedTaskScenarios.flatMap((scenario) =>
    scenario.executions
      .filter((execution) => Boolean(execution.spreadingPreset))
      .map((execution) => ({
        taskId: scenario.taskId,
        executionOrderId: execution.executionOrderId,
        executionOrderNo: execution.executionOrderNo,
        preset: execution.spreadingPreset as PdaCuttingSpreadingPresetMatrixItem,
      })),
  )
}
