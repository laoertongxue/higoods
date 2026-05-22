import type { AcceptanceStatus, BlockReason, TaskStatus } from '../process-tasks.ts'
import { TEST_FACTORY_ID } from '../factory-mock-data.ts'

export type PdaCuttingTaskOrigin =
  | 'DIRECT'
  | 'BIDDING_PENDING'
  | 'BIDDING_QUOTED'
  | 'BIDDING_AWARDED'

export type PdaCuttingExecutionBindingState = 'BOUND' | 'UNBOUND'
export type PdaCuttingSpreadingPresetStatus = 'STARTED' | 'DONE' | 'BLOCKED'

export interface PdaCuttingSpreadingPresetMatrixItem {
  status: PdaCuttingSpreadingPresetStatus
  recordId: string
  fabricRollNo: string
  layerCount: number
  actualLength: number
  headLength: number
  tailLength: number
  enteredBy: string
  enteredAt: string
  note: string
}

export interface PdaCuttingExecutionMatrixItem {
  executionOrderId: string
  executionOrderNo: string
  cutOrderNo?: string
  productionOrderNo?: string
  materialSku?: string
  markerPlanId?: string
  markerPlanNo?: string
  bindingState?: PdaCuttingExecutionBindingState
  spreadingPreset?: PdaCuttingSpreadingPresetMatrixItem | null
}

export interface PdaCuttingTaskMockMatrixItem {
  taskId: string
  taskNo: string
  origin: PdaCuttingTaskOrigin
  acceptanceStatus?: AcceptanceStatus
  taskStatus: TaskStatus
  assignedFactoryId: string
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
  executions: PdaCuttingExecutionMatrixItem[]
}

function execution(
  executionOrderNo: string,
  cutOrderNo: string,
  overrides: Partial<PdaCuttingExecutionMatrixItem> = {},
): PdaCuttingExecutionMatrixItem {
  return {
    executionOrderId: executionOrderNo,
    executionOrderNo,
    cutOrderNo,
    bindingState: 'BOUND',
    spreadingPreset: null,
    ...overrides,
  }
}

export const PDA_CUTTING_TASK_MOCK_MATRIX: PdaCuttingTaskMockMatrixItem[] = [
  {
    taskId: 'TASK-CUT-MARKER-READY-0101',
    taskNo: 'TASK-CUT-MARKER-READY-0101',
    origin: 'DIRECT',
    acceptanceStatus: 'ACCEPTED',
    taskStatus: 'IN_PROGRESS',
    assignedFactoryId: TEST_FACTORY_ID,
    qty: 9200,
    qtyUnit: '件',
    standardPrice: 6,
    currency: 'CNY',
    unit: '件',
    acceptDeadline: '2026-03-18 09:30:00',
    taskDeadline: '2026-03-20 18:00:00',
    taskSummaryNote: '裁床已领料入待加工仓，裁床任务已开工，等待创建唛架方案。',
    acceptedAt: '2026-03-18 08:35:00',
    acceptedBy: '裁床组长',
    startedAt: '2026-03-18 09:05:00',
    dispatchedAt: '2026-03-18 08:10:00',
    dispatchedBy: '裁床计划员',
    executions: [
      execution('CPO-20260318-MR1', 'CUT-260306-101-01'),
      execution('CPO-20260318-MR2', 'CUT-260306-101-02'),
    ],
  },
  {
    taskId: 'TASK-CUT-000201',
    taskNo: 'TASK-CUT-000201',
    origin: 'DIRECT',
    acceptanceStatus: 'ACCEPTED',
    taskStatus: 'NOT_STARTED',
    assignedFactoryId: TEST_FACTORY_ID,
    qty: 10500,
    qtyUnit: '件',
    standardPrice: 6,
    currency: 'CNY',
    unit: '件',
    acceptDeadline: '2026-03-18 09:00:00',
    taskDeadline: '2026-03-19 18:00:00',
    taskSummaryNote: '裁床已领料入待加工仓，等待按排唛架方案铺布。',
    acceptedAt: '2026-03-18 08:20:00',
    acceptedBy: '裁床组长',
    dispatchedAt: '2026-03-18 08:00:00',
    dispatchedBy: '裁床计划员',
    executions: [execution('CPO-20260318-A1', 'CUT-260301-003-01')],
  },
  {
    taskId: 'TASK-CUT-000202',
    taskNo: 'TASK-CUT-000202',
    origin: 'DIRECT',
    acceptanceStatus: 'ACCEPTED',
    taskStatus: 'IN_PROGRESS',
    assignedFactoryId: TEST_FACTORY_ID,
    qty: 6800,
    qtyUnit: '件',
    standardPrice: 6.1,
    currency: 'CNY',
    unit: '件',
    acceptDeadline: '2026-03-18 10:00:00',
    taskDeadline: '2026-03-19 20:00:00',
    taskSummaryNote: '已选择唛架编号并开始铺布。',
    acceptedAt: '2026-03-18 09:10:00',
    acceptedBy: '裁床组长',
    startedAt: '2026-03-18 11:05:00',
    dispatchedAt: '2026-03-18 08:40:00',
    dispatchedBy: '裁床计划员',
    executions: [
      execution('CPO-20260318-B1', 'CUT-260302-004-01', {
        spreadingPreset: {
          status: 'STARTED',
          recordId: 'SPREAD-PDA-20260318-B1',
          fabricRollNo: 'ROLL-B1',
          layerCount: 12,
          actualLength: 36,
          headLength: 0.4,
          tailLength: 0.3,
          enteredBy: 'Sari Wulandari',
          enteredAt: '2026-03-18 11:20:00',
          note: '按唛架编号开始铺布。',
        },
      }),
    ],
  },
  {
    taskId: 'TASK-CUT-000203',
    taskNo: 'TASK-CUT-000203',
    origin: 'DIRECT',
    acceptanceStatus: 'ACCEPTED',
    taskStatus: 'DONE',
    assignedFactoryId: TEST_FACTORY_ID,
    qty: 7300,
    qtyUnit: '件',
    standardPrice: 6.2,
    currency: 'CNY',
    unit: '件',
    acceptDeadline: '2026-03-18 11:00:00',
    taskDeadline: '2026-03-20 18:00:00',
    taskSummaryNote: '铺布裁剪完成，菲票已生成，等待交出。',
    acceptedAt: '2026-03-18 09:30:00',
    acceptedBy: '裁床组长',
    startedAt: '2026-03-18 13:00:00',
    finishedAt: '2026-03-18 15:30:00',
    dispatchedAt: '2026-03-18 09:00:00',
    dispatchedBy: '裁床计划员',
    executions: [
      execution('CPO-20260318-C1', 'CUT-260301-005-01', {
        spreadingPreset: {
          status: 'DONE',
          recordId: 'SPREAD-PDA-20260318-C1',
          fabricRollNo: 'ROLL-C1',
          layerCount: 16,
          actualLength: 42,
          headLength: 0.4,
          tailLength: 0.4,
          enteredBy: 'Dewi Lestari',
          enteredAt: '2026-03-18 15:30:00',
          note: '铺布裁剪完成。',
        },
      }),
    ],
  },
  {
    taskId: 'TASK-CUT-000204',
    taskNo: 'TASK-CUT-000204',
    origin: 'DIRECT',
    acceptanceStatus: 'ACCEPTED',
    taskStatus: 'BLOCKED',
    assignedFactoryId: TEST_FACTORY_ID,
    qty: 5600,
    qtyUnit: '件',
    standardPrice: 6.1,
    currency: 'CNY',
    unit: '件',
    acceptDeadline: '2026-03-18 12:00:00',
    taskDeadline: '2026-03-20 20:00:00',
    taskSummaryNote: '铺布前发现布卷长度差异，等待异常处理。',
    acceptedAt: '2026-03-18 10:20:00',
    acceptedBy: '裁床组长',
    blockedAt: '2026-03-18 14:00:00',
    blockReason: 'MATERIAL',
    blockRemark: '裁床领料长度与布卷标签不一致。',
    dispatchedAt: '2026-03-18 09:40:00',
    dispatchedBy: '裁床计划员',
    executions: [execution('CPO-20260318-D1', 'CUT-260303-007-01')],
  },
  {
    taskId: 'TASK-CUT-000205',
    taskNo: 'TASK-CUT-000205',
    origin: 'BIDDING_PENDING',
    acceptanceStatus: 'PENDING',
    taskStatus: 'NOT_STARTED',
    assignedFactoryId: TEST_FACTORY_ID,
    qty: 6200,
    qtyUnit: '件',
    standardPrice: 6,
    currency: 'CNY',
    unit: '件',
    acceptDeadline: '2026-03-19 10:00:00',
    taskDeadline: '2026-03-21 18:00:00',
    taskSummaryNote: '报价/接单流程中的裁片任务，不进入执行列表。',
    dispatchedAt: '2026-03-18 10:00:00',
    dispatchedBy: '裁片平台调度',
    tenderId: 'TENDER-PDA-CUT-205',
    factoryPoolCount: 3,
    biddingDeadline: '2026-03-19 10:00:00',
    tenderStatusLabel: '待报价',
    tenderRemark: '报价任务仅用于接单流程。',
    executions: [execution('CPO-20260318-E1', 'CUT-260304-008-01')],
  },
]
