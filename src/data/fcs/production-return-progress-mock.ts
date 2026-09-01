import {
  createProductionReturnRuleSnapshot,
  generateAndSaveProductionReturnReminders,
  listProductionReturnRuleSnapshots,
  recordProductionReturnReceipt,
} from './production-return-fulfillment.ts'
import type { TaskFulfillmentPolicy } from './task-fulfillment-policy.ts'

export const PRODUCTION_RETURN_PROGRESS_DEMO_TODAY = '2026-08-11'

const SEWING_POLICY: TaskFulfillmentPolicy = {
  taskTypeLabel: '独立车缝任务',
  normalizedProcessCodes: ['SEWING'],
  isIndependentTask: true,
  mergedTaskType: null,
  involvesSewingOutsourcing: true,
  startsWithSewing: true,
  assignmentGranularity: 'SKU',
  fulfillmentRuleCode: 'SEWING_ONLY',
  milestones: [
    { ratio: 0.3, naturalDay: 4 },
    { ratio: 0.7, naturalDay: 8 },
    { ratio: 1, naturalDay: 9 },
  ],
  contractEligibilityCode: 'INDEPENDENT_SEWING',
  contractRequired: true,
  requiresSewingReadinessContext: true,
}

function seedAssignment(input: {
  assignmentId: string
  taskId: string
  productionOrderId: string
  factoryId: string
  factoryName: string
  qty: number
  assignedAt: string
}): void {
  if (listProductionReturnRuleSnapshots({ assignmentId: input.assignmentId }).length) return
  createProductionReturnRuleSnapshot({
    assignmentId: input.assignmentId,
    runtimeTaskId: input.taskId,
    productionOrderId: input.productionOrderId,
    factoryId: input.factoryId,
    factoryName: input.factoryName,
    assignedQty: input.qty,
    businessAssignedAt: input.assignedAt,
    policy: SEWING_POLICY,
  })
}

export function ensureProductionReturnProgressMockFacts(): void {
  seedAssignment({ assignmentId: 'ASG-PROGRESS-16234-A', taskId: 'TASK-PROGRESS-16234-A', productionOrderId: 'PO16234', factoryId: 'ID-F003', factoryName: '万隆车缝厂', qty: 480, assignedAt: '2026-08-03 10:00:00' })
  seedAssignment({ assignmentId: 'ASG-PROGRESS-16234-B', taskId: 'TASK-PROGRESS-16234-B', productionOrderId: 'PO16234', factoryId: 'ID-F011', factoryName: '棉兰卫星车缝厂', qty: 320, assignedAt: '2026-08-04 10:00:00' })
  seedAssignment({ assignmentId: 'ASG-PROGRESS-16233-A', taskId: 'TASK-PROGRESS-16233-A', productionOrderId: 'PO16233', factoryId: 'ID-F012', factoryName: '玛琅精工车缝厂', qty: 1000, assignedAt: '2026-08-10 10:00:00' })
  seedAssignment({ assignmentId: 'ASG-PROGRESS-16232-A', taskId: 'TASK-PROGRESS-16232-A', productionOrderId: 'PO16232', factoryId: 'ID-F003', factoryName: '万隆车缝厂', qty: 309, assignedAt: '2026-08-01 10:00:00' })

  recordProductionReturnReceipt({ receiptId: 'RET-PROGRESS-16234-A-1', assignmentId: 'ASG-PROGRESS-16234-A', factoryId: 'ID-F003', confirmedQty: 150, confirmedDate: '2026-08-05', confirmed: true })
  recordProductionReturnReceipt({ receiptId: 'RET-PROGRESS-16234-B-1', assignmentId: 'ASG-PROGRESS-16234-B', factoryId: 'ID-F011', confirmedQty: 100, confirmedDate: '2026-08-07', confirmed: true })
  recordProductionReturnReceipt({ receiptId: 'RET-PROGRESS-16232-A-1', assignmentId: 'ASG-PROGRESS-16232-A', factoryId: 'ID-F003', confirmedQty: 309, confirmedDate: '2026-08-03', confirmed: true })

  const snapshots = listProductionReturnRuleSnapshots({ activeOnly: true })
    .filter((item) => ['PO16234', 'PO16233', 'PO16232'].includes(item.productionOrderId))
  ;['2026-08-09', '2026-08-10', PRODUCTION_RETURN_PROGRESS_DEMO_TODAY].forEach((today) => {
    generateAndSaveProductionReturnReminders({ snapshots, today })
  })
}
