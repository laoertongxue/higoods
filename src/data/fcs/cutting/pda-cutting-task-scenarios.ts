import { getFactoryMasterRecordById } from '../factory-master-store.ts'
import { TEST_FACTORY_ID, TEST_FACTORY_NAME } from '../factory-mock-data.ts'
import type { AcceptanceStatus, BlockReason, TaskStatus } from '../process-tasks.ts'
import type {
  PdaMobileAwardedTenderNoticeMock,
  PdaMobileBiddingTenderMock,
  PdaMobileQuotedTenderMock,
} from '../pda-mobile-mock.ts'
import {
  getGeneratedCutOrderSourceRecordById,
  listGeneratedCutOrderSourceRecords,
  type GeneratedCutOrderSourceRecord,
} from './generated-cut-orders.ts'
import {
  PDA_CUTTING_TASK_MOCK_MATRIX,
  type PdaCuttingExecutionBindingState,
  type PdaCuttingSpreadingPresetMatrixItem,
  type PdaCuttingTaskMockMatrixItem,
  type PdaCuttingTaskOrigin,
} from './pda-cutting-mock-matrix.ts'
import type { PdaCuttingExecutionSourceRecord, PdaCuttingReportMode, PdaCuttingTaskSourceRecord } from './pda-cutting-task-source.ts'

export interface PdaCuttingResolvedExecutionScenario extends PdaCuttingExecutionSourceRecord {
  taskId: string
  taskNo: string
  bindingState: PdaCuttingExecutionBindingState
  cuttingReportMode: PdaCuttingReportMode
  cutOrderRecord: GeneratedCutOrderSourceRecord | null
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
  cuttingReportMode: PdaCuttingReportMode
  executions: PdaCuttingResolvedExecutionScenario[]
}

const cutOrderByNo = new Map(
  listGeneratedCutOrderSourceRecords().map((record) => [record.cutOrderNo, record] as const),
)
const missingCutOrderWarnings = new Set<string>()

function getFactoryName(factoryId: string): string {
  if (factoryId === TEST_FACTORY_ID || factoryId === 'ID-F090') return TEST_FACTORY_NAME
  return getFactoryMasterRecordById(factoryId)?.name ?? factoryId
}

function resolveBoundExecution(matrix: PdaCuttingTaskMockMatrixItem, execution: PdaCuttingTaskMockMatrixItem['executions'][number]): PdaCuttingResolvedExecutionScenario {
  const cutOrderNo = execution.cutOrderNo?.trim() || ''
  const cutOrderRecord = cutOrderByNo.get(cutOrderNo)

  if (!cutOrderRecord) {
    const warningKey = `${matrix.taskId}::${execution.executionOrderNo}::${cutOrderNo}`
    if (!missingCutOrderWarnings.has(warningKey)) {
      missingCutOrderWarnings.add(warningKey)
      console.warn(`裁片 PDA mock 矩阵已自动降级为未绑定执行单：${matrix.taskId} / ${execution.executionOrderNo} / ${cutOrderNo}`)
    }
    return resolveUnboundExecution(matrix, {
      ...execution,
      bindingState: 'UNBOUND',
    })
  }

  return {
    taskId: matrix.taskId,
    taskNo: matrix.taskNo,
    executionOrderId: execution.executionOrderId,
    executionOrderNo: execution.executionOrderNo,
    executionObjectType: execution.executionObjectType || 'SPREADING_ORDER',
    productionOrderId: execution.productionOrderNo || cutOrderRecord.productionOrderId,
    productionOrderNo: execution.productionOrderNo || cutOrderRecord.productionOrderNo,
    cutOrderId: cutOrderRecord.cutOrderId,
    cutOrderNo: cutOrderRecord.cutOrderNo,
    markerPlanId: execution.markerPlanId || cutOrderRecord.markerPlanId || '',
    markerPlanNo: execution.markerPlanNo || cutOrderRecord.markerPlanNo || '',
    materialSku: execution.materialSku || cutOrderRecord.materialSku,
    materialAlias: cutOrderRecord.materialAlias || '',
    materialImageUrl: cutOrderRecord.materialImageUrl || '',
    bindingState: execution.bindingState || 'BOUND',
    cuttingReportMode: 'INDEPENDENT_CUTTING_EXECUTION',
    cutOrderRecord,
    spreadingPreset: execution.spreadingPreset || null,
  }
}

function resolveUnboundExecution(matrix: PdaCuttingTaskMockMatrixItem, execution: PdaCuttingTaskMockMatrixItem['executions'][number]): PdaCuttingResolvedExecutionScenario {
  return {
    taskId: matrix.taskId,
    taskNo: matrix.taskNo,
    executionOrderId: execution.executionOrderId,
    executionOrderNo: execution.executionOrderNo,
    executionObjectType: execution.executionObjectType || 'SPREADING_ORDER',
    productionOrderId: execution.productionOrderNo || '',
    productionOrderNo: execution.productionOrderNo || '',
    cutOrderId: '',
    cutOrderNo: execution.cutOrderNo?.trim() || '',
    markerPlanId: execution.markerPlanId || '',
    markerPlanNo: execution.markerPlanNo || '',
    materialSku: execution.materialSku || '',
    materialAlias: '',
    materialImageUrl: '',
    bindingState: execution.bindingState || 'UNBOUND',
    cuttingReportMode: 'INDEPENDENT_CUTTING_EXECUTION',
    cutOrderRecord: null,
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
    cuttingReportMode: 'INDEPENDENT_CUTTING_EXECUTION',
    executions,
  }
}

function buildContinuousCuttingCompletionScenarios(): PdaCuttingResolvedTaskScenario[] {
  return listGeneratedCutOrderSourceRecords()
    .filter((record) =>
      record.cutOrderSourceType === 'CONTINUOUS_WITH_CUTTING_TASK'
      && record.cutReturnMode === 'THIRD_PARTY_REPORT_ONLY',
    )
    .map((record) => {
      const executionOrderNo = `REPORT-${record.cutOrderNo}`
      return {
        taskId: record.cuttingTaskId,
        taskNo: record.cuttingTaskNo,
        origin: 'DIRECT',
        acceptanceStatus: 'ACCEPTED',
        taskStatus: 'IN_PROGRESS',
        assignedFactoryId: record.cuttingTaskAssigneeFactoryId || TEST_FACTORY_ID,
        assignedFactoryName: getFactoryName(record.cuttingTaskAssigneeFactoryId || TEST_FACTORY_ID),
        qty: record.requiredQty,
        qtyUnit: '件',
        standardPrice: 0,
        currency: 'CNY',
        unit: '件',
        acceptDeadline: '2026-03-18 09:00:00',
        taskDeadline: '2026-03-20 18:00:00',
        taskSummaryNote: '含裁片连续工序任务，只在 PDA 上报裁片完成数量。',
        acceptedAt: '2026-03-18 08:30:00',
        acceptedBy: '连续任务负责人',
        startedAt: '2026-03-18 09:00:00',
        dispatchedAt: '2026-03-18 08:00:00',
        dispatchedBy: '连续任务调度',
        productionOrderId: record.productionOrderId,
        productionOrderNo: record.productionOrderNo,
        bindingState: 'BOUND',
        cuttingReportMode: 'CONTINUOUS_TASK_CUTTING_COMPLETION',
        executions: [{
          taskId: record.cuttingTaskId,
          taskNo: record.cuttingTaskNo,
          executionOrderId: executionOrderNo,
          executionOrderNo,
          executionObjectType: 'SPREADING_ORDER',
          productionOrderId: record.productionOrderId,
          productionOrderNo: record.productionOrderNo,
          cutOrderId: record.cutOrderId,
          cutOrderNo: record.cutOrderNo,
          markerPlanId: record.markerPlanId || '',
          markerPlanNo: record.markerPlanNo || '',
          materialSku: record.materialSku,
          materialAlias: record.materialAlias || '',
          materialImageUrl: record.materialImageUrl || '',
          bindingState: 'BOUND',
          cuttingReportMode: 'CONTINUOUS_TASK_CUTTING_COMPLETION',
          cutOrderRecord: record,
          spreadingPreset: null,
        }],
      }
    })
}

const resolvedTaskScenarios = [
  ...PDA_CUTTING_TASK_MOCK_MATRIX.map((item) => resolveTaskScenario(item)),
  ...buildContinuousCuttingCompletionScenarios(),
]

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
      executionObjectType: execution.executionObjectType,
      productionOrderId: execution.productionOrderId,
      productionOrderNo: execution.productionOrderNo,
      cutOrderId: execution.cutOrderId,
      cutOrderNo: execution.cutOrderNo,
      markerPlanId: execution.markerPlanId,
      markerPlanNo: execution.markerPlanNo,
      materialSku: execution.materialSku,
      materialAlias: execution.materialAlias || '',
      materialImageUrl: execution.materialImageUrl || '',
      bindingState: execution.bindingState,
      cuttingReportMode: execution.cuttingReportMode,
    })),
  )
}

export function listPdaCuttingTaskSourceRecordsFromScenarios(): PdaCuttingTaskSourceRecord[] {
  return resolvedTaskScenarios.map((scenario) => ({
    taskId: scenario.taskId,
    taskNo: scenario.taskNo,
    productionOrderId: scenario.productionOrderId,
    productionOrderNo: scenario.productionOrderNo,
    cutOrderIds: Array.from(new Set(scenario.executions.map((execution) => execution.cutOrderId).filter(Boolean))),
    cutOrderNos: Array.from(new Set(scenario.executions.map((execution) => execution.cutOrderNo).filter(Boolean))),
    executionOrderIds: scenario.executions.map((execution) => execution.executionOrderId),
    executionOrderNos: scenario.executions.map((execution) => execution.executionOrderNo),
    bindingState: scenario.bindingState,
    cuttingReportMode: scenario.cuttingReportMode,
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
