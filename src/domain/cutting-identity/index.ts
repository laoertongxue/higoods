import { cuttingOrderProgressRecords } from '../../data/fcs/cutting/order-progress'
import { buildCuttablePoolViewModel } from '../../pages/process-factory/cutting/cuttable-pool-model'
import { buildSystemSeedMergeBatches } from '../../pages/process-factory/cutting/merge-batches-model'
import { buildOriginalCutOrderViewModel } from '../../pages/process-factory/cutting/original-orders-model'

export interface ProductionOrderRef {
  productionOrderId: string
  productionOrderNo: string
}

export interface OriginalCutOrderRef extends ProductionOrderRef {
  originalCutOrderId: string
  originalCutOrderNo: string
  mergeBatchIds: string[]
  mergeBatchNos: string[]
  activeMergeBatchId: string
  activeMergeBatchNo: string
}

export interface MergeBatchRef {
  mergeBatchId: string
  mergeBatchNo: string
  sourceOriginalCutOrderIds: string[]
  sourceOriginalCutOrderNos: string[]
  sourceProductionOrderIds: string[]
  sourceProductionOrderNos: string[]
}

export interface CuttingTaskRef {
  taskId: string
  taskNo: string
  productionOrderId: string
  productionOrderNo: string
  originalCutOrderIds: string[]
  originalCutOrderNos: string[]
  mergeBatchIds: string[]
  mergeBatchNos: string[]
}

export interface PdaCutPieceExecutionRef {
  taskId: string
  taskNo: string
  cutPieceOrderNo: string
  productionOrderId: string
  productionOrderNo: string
  originalCutOrderId: string
  originalCutOrderNo: string
  mergeBatchId: string
  mergeBatchNo: string
}

export interface CuttingIdentityRegistry {
  productionOrdersById: Record<string, ProductionOrderRef>
  productionOrdersByNo: Record<string, ProductionOrderRef>
  originalCutOrdersById: Record<string, OriginalCutOrderRef>
  originalCutOrdersByNo: Record<string, OriginalCutOrderRef>
  mergeBatchesById: Record<string, MergeBatchRef>
  mergeBatchesByNo: Record<string, MergeBatchRef>
  cuttingTasksById: Record<string, CuttingTaskRef>
  cuttingTasksByNo: Record<string, CuttingTaskRef>
  pdaExecutionsByTaskAndOrder: Record<string, PdaCutPieceExecutionRef>
  pdaExecutionsByOriginalCutOrderId: Record<string, PdaCutPieceExecutionRef[]>
}

interface PdaTaskIdentitySeed {
  taskId: string
  taskNo: string
  platformTaskNos?: string[]
  executionLinks: Array<{
    cutPieceOrderNo: string
    originalCutOrderNo: string
  }>
}

const PRODUCTION_ORDER_NO_ALIASES: Record<string, string> = {
  'PO-202603-018': 'PO-202603-081',
  'PO-202603-024': 'PO-202603-082',
  'PO-202603-031': 'PO-202603-083',
  'PO-202603-027': 'PO-202603-084',
  'PO-20260319-011': 'PO-202603-081',
  'PO-20260319-012': 'PO-202603-082',
  'PO-20260319-013': 'PO-202603-083',
  'PO-20260319-014': 'PO-202603-083',
  'PO-20260319-015': 'PO-202603-084',
  'PO-20260319-016': 'PO-202603-085',
  'PO-20260319-017': 'PO-202603-084',
  'PO-20260319-018': 'PO-202603-086',
  'PO-20260319-019': 'PO-202603-086',
  'PO-20260319-020': 'PO-202603-087',
  'PO-20260319-021': 'PO-202603-087',
  'PO-20260319-022': 'PO-202603-088',
}

function uniqueStrings(values: Array<string | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))))
}

function buildExecutionKey(taskId: string, cutPieceOrderNo: string): string {
  return `${taskId}::${cutPieceOrderNo}`
}

const PDA_CUTTING_TASK_IDENTITY_SEEDS: PdaTaskIdentitySeed[] = [
  {
    taskId: 'TASK-CUT-000087',
    taskNo: 'TASK-CUT-000087',
    platformTaskNos: ['CP-TASK-202603-018'],
    executionLinks: [
      { cutPieceOrderNo: 'CPO-20260319-A', originalCutOrderNo: 'CUT-260308-081-01' },
      { cutPieceOrderNo: 'CPO-20260319-A-02', originalCutOrderNo: 'CUT-260308-081-02' },
      { cutPieceOrderNo: 'CPO-20260319-A-03', originalCutOrderNo: 'CUT-260308-081-03' },
    ],
  },
  {
    taskId: 'TASK-CUT-000088',
    taskNo: 'TASK-CUT-000088',
    platformTaskNos: ['CP-TASK-202603-024'],
    executionLinks: [
      { cutPieceOrderNo: 'CPO-20260319-B', originalCutOrderNo: 'CUT-260309-082-01' },
      { cutPieceOrderNo: 'CPO-20260319-B-02', originalCutOrderNo: 'CUT-260309-082-02' },
    ],
  },
  {
    taskId: 'TASK-CUT-000089',
    taskNo: 'TASK-CUT-000089',
    platformTaskNos: ['CP-TASK-202603-031'],
    executionLinks: [{ cutPieceOrderNo: 'CPO-20260319-C', originalCutOrderNo: 'CUT-260310-083-01' }],
  },
  {
    taskId: 'TASK-CUT-000090',
    taskNo: 'TASK-CUT-000090',
    executionLinks: [{ cutPieceOrderNo: 'CPO-20260319-D', originalCutOrderNo: 'CUT-260310-083-02' }],
  },
  {
    taskId: 'TASK-CUT-000091',
    taskNo: 'TASK-CUT-000091',
    platformTaskNos: ['CP-TASK-202603-027'],
    executionLinks: [{ cutPieceOrderNo: 'CPO-20260319-E', originalCutOrderNo: 'CUT-260311-084-01' }],
  },
  {
    taskId: 'TASK-CUT-000092',
    taskNo: 'TASK-CUT-000092',
    executionLinks: [
      { cutPieceOrderNo: 'CPO-20260319-F', originalCutOrderNo: 'CUT-260312-085-01' },
      { cutPieceOrderNo: 'CPO-20260319-F-02', originalCutOrderNo: 'CUT-260312-085-02' },
    ],
  },
  {
    taskId: 'TASK-CUT-000093',
    taskNo: 'TASK-CUT-000093',
    executionLinks: [{ cutPieceOrderNo: 'CPO-20260319-G', originalCutOrderNo: 'CUT-260311-084-02' }],
  },
  {
    taskId: 'TASK-CUT-000094',
    taskNo: 'TASK-CUT-000094',
    executionLinks: [{ cutPieceOrderNo: 'CPO-20260319-H', originalCutOrderNo: 'CUT-260313-086-01' }],
  },
  {
    taskId: 'TASK-CUT-000095',
    taskNo: 'TASK-CUT-000095',
    executionLinks: [{ cutPieceOrderNo: 'CPO-20260319-I', originalCutOrderNo: 'CUT-260313-086-02' }],
  },
  {
    taskId: 'TASK-CUT-000096',
    taskNo: 'TASK-CUT-000096',
    executionLinks: [{ cutPieceOrderNo: 'CPO-20260319-J', originalCutOrderNo: 'CUT-260314-087-01' }],
  },
  {
    taskId: 'TASK-CUT-000097',
    taskNo: 'TASK-CUT-000097',
    executionLinks: [{ cutPieceOrderNo: 'CPO-20260319-K', originalCutOrderNo: 'CUT-260314-087-02' }],
  },
  {
    taskId: 'TASK-CUT-000098',
    taskNo: 'TASK-CUT-000098',
    executionLinks: [{ cutPieceOrderNo: 'CPO-20260319-L', originalCutOrderNo: 'CUT-260315-088-01' }],
  },
]

function buildRegistry(): CuttingIdentityRegistry {
  const cuttablePool = buildCuttablePoolViewModel(cuttingOrderProgressRecords)
  const mergeBatches = buildSystemSeedMergeBatches(cuttablePool.orders.flatMap((order) => order.items))
  const originalRows = buildOriginalCutOrderViewModel(cuttingOrderProgressRecords, mergeBatches).rows

  const productionOrdersById = Object.fromEntries(
    cuttingOrderProgressRecords.map((record) => [
      record.productionOrderId,
      {
        productionOrderId: record.productionOrderId,
        productionOrderNo: record.productionOrderNo,
      } satisfies ProductionOrderRef,
    ]),
  )
  const productionOrdersByNo = Object.fromEntries(
    Object.values(productionOrdersById).map((ref) => [ref.productionOrderNo, ref]),
  )
  Object.entries(PRODUCTION_ORDER_NO_ALIASES).forEach(([legacyProductionOrderNo, canonicalProductionOrderNo]) => {
    const ref = productionOrdersByNo[canonicalProductionOrderNo]
    if (ref) {
      productionOrdersByNo[legacyProductionOrderNo] = ref
    }
  })

  const originalCutOrdersById = Object.fromEntries(
    originalRows.map((row) => [
      row.originalCutOrderId,
      {
        originalCutOrderId: row.originalCutOrderId,
        originalCutOrderNo: row.originalCutOrderNo,
        productionOrderId: row.productionOrderId,
        productionOrderNo: row.productionOrderNo,
        mergeBatchIds: [...row.mergeBatchIds],
        mergeBatchNos: [...row.mergeBatchNos],
        activeMergeBatchId: row.activeBatchId,
        activeMergeBatchNo: row.activeBatchNo,
      } satisfies OriginalCutOrderRef,
    ]),
  )
  const originalCutOrdersByNo = Object.fromEntries(
    Object.values(originalCutOrdersById).map((ref) => [ref.originalCutOrderNo, ref]),
  )

  const mergeBatchesById = Object.fromEntries(
    mergeBatches.map((batch) => [
      batch.mergeBatchId,
      {
        mergeBatchId: batch.mergeBatchId,
        mergeBatchNo: batch.mergeBatchNo,
        sourceOriginalCutOrderIds: uniqueStrings(batch.items.map((item) => item.originalCutOrderId)),
        sourceOriginalCutOrderNos: uniqueStrings(batch.items.map((item) => item.originalCutOrderNo)),
        sourceProductionOrderIds: uniqueStrings(batch.items.map((item) => item.productionOrderId)),
        sourceProductionOrderNos: uniqueStrings(batch.items.map((item) => item.productionOrderNo)),
      } satisfies MergeBatchRef,
    ]),
  )
  const mergeBatchesByNo = Object.fromEntries(
    Object.values(mergeBatchesById).map((ref) => [ref.mergeBatchNo, ref]),
  )

  const cuttingTasksById: Record<string, CuttingTaskRef> = {}
  const cuttingTasksByNo: Record<string, CuttingTaskRef> = {}
  const pdaExecutionsByTaskAndOrder: Record<string, PdaCutPieceExecutionRef> = {}
  const pdaExecutionsByOriginalCutOrderId: Record<string, PdaCutPieceExecutionRef[]> = {}

  PDA_CUTTING_TASK_IDENTITY_SEEDS.forEach((seed) => {
    const originalRefs = seed.executionLinks
      .map((link) => originalCutOrdersByNo[link.originalCutOrderNo])
      .filter((ref): ref is OriginalCutOrderRef => Boolean(ref))

    if (!originalRefs.length) return

    const productionRef = originalRefs[0]
    const mergeBatchIds = uniqueStrings(originalRefs.flatMap((ref) => [ref.activeMergeBatchId, ...ref.mergeBatchIds]))
    const mergeBatchNos = uniqueStrings(
      mergeBatchIds.map((mergeBatchId) => mergeBatchesById[mergeBatchId]?.mergeBatchNo).filter(Boolean),
    )

    const taskRef: CuttingTaskRef = {
      taskId: seed.taskId,
      taskNo: seed.taskNo,
      productionOrderId: productionRef.productionOrderId,
      productionOrderNo: productionRef.productionOrderNo,
      originalCutOrderIds: originalRefs.map((ref) => ref.originalCutOrderId),
      originalCutOrderNos: originalRefs.map((ref) => ref.originalCutOrderNo),
      mergeBatchIds,
      mergeBatchNos,
    }

    cuttingTasksById[taskRef.taskId] = taskRef
    cuttingTasksByNo[taskRef.taskNo] = taskRef
    seed.platformTaskNos?.forEach((platformTaskNo) => {
      if (platformTaskNo) {
        cuttingTasksByNo[platformTaskNo] = taskRef
      }
    })

    seed.executionLinks.forEach((link) => {
      const originalRef = originalCutOrdersByNo[link.originalCutOrderNo]
      if (!originalRef) return
      const mergeBatchId = originalRef.activeMergeBatchId || originalRef.mergeBatchIds[0] || ''
      const mergeBatchNo =
        (mergeBatchId && mergeBatchesById[mergeBatchId]?.mergeBatchNo) ||
        originalRef.activeMergeBatchNo ||
        originalRef.mergeBatchNos[0] ||
        ''

      const executionRef: PdaCutPieceExecutionRef = {
        taskId: seed.taskId,
        taskNo: seed.taskNo,
        cutPieceOrderNo: link.cutPieceOrderNo,
        productionOrderId: originalRef.productionOrderId,
        productionOrderNo: originalRef.productionOrderNo,
        originalCutOrderId: originalRef.originalCutOrderId,
        originalCutOrderNo: originalRef.originalCutOrderNo,
        mergeBatchId,
        mergeBatchNo,
      }

      pdaExecutionsByTaskAndOrder[buildExecutionKey(seed.taskId, link.cutPieceOrderNo)] = executionRef
      const bucket = pdaExecutionsByOriginalCutOrderId[originalRef.originalCutOrderId] ?? []
      bucket.push(executionRef)
      pdaExecutionsByOriginalCutOrderId[originalRef.originalCutOrderId] = bucket
    })
  })

  return {
    productionOrdersById,
    productionOrdersByNo,
    originalCutOrdersById,
    originalCutOrdersByNo,
    mergeBatchesById,
    mergeBatchesByNo,
    cuttingTasksById,
    cuttingTasksByNo,
    pdaExecutionsByTaskAndOrder,
    pdaExecutionsByOriginalCutOrderId,
  }
}

let cachedRegistry: CuttingIdentityRegistry | null = null

export function buildCuttingIdentityRegistry(): CuttingIdentityRegistry {
  if (!cachedRegistry) {
    cachedRegistry = buildRegistry()
  }
  return cachedRegistry
}

export function resolveProductionOrderRef(input: {
  productionOrderId?: string
  productionOrderNo?: string
}): ProductionOrderRef | null {
  const registry = buildCuttingIdentityRegistry()
  if (input.productionOrderId && registry.productionOrdersById[input.productionOrderId]) {
    return registry.productionOrdersById[input.productionOrderId]
  }
  if (input.productionOrderNo && registry.productionOrdersByNo[input.productionOrderNo]) {
    return registry.productionOrdersByNo[input.productionOrderNo]
  }
  return null
}

export function resolveOriginalCutOrderRef(input: {
  originalCutOrderId?: string
  originalCutOrderNo?: string
}): OriginalCutOrderRef | null {
  const registry = buildCuttingIdentityRegistry()
  if (input.originalCutOrderId && registry.originalCutOrdersById[input.originalCutOrderId]) {
    return registry.originalCutOrdersById[input.originalCutOrderId]
  }
  if (input.originalCutOrderNo && registry.originalCutOrdersByNo[input.originalCutOrderNo]) {
    return registry.originalCutOrdersByNo[input.originalCutOrderNo]
  }
  return null
}

export function resolveMergeBatchRef(input: {
  mergeBatchId?: string
  mergeBatchNo?: string
}): MergeBatchRef | null {
  const registry = buildCuttingIdentityRegistry()
  if (input.mergeBatchId && registry.mergeBatchesById[input.mergeBatchId]) {
    return registry.mergeBatchesById[input.mergeBatchId]
  }
  if (input.mergeBatchNo && registry.mergeBatchesByNo[input.mergeBatchNo]) {
    return registry.mergeBatchesByNo[input.mergeBatchNo]
  }
  return null
}

export function resolveCuttingTaskRef(input: {
  taskId?: string
  taskNo?: string
}): CuttingTaskRef | null {
  const registry = buildCuttingIdentityRegistry()
  if (input.taskId && registry.cuttingTasksById[input.taskId]) {
    return registry.cuttingTasksById[input.taskId]
  }
  if (input.taskNo && registry.cuttingTasksByNo[input.taskNo]) {
    return registry.cuttingTasksByNo[input.taskNo]
  }
  return null
}

export function resolvePdaExecutionRef(input: {
  taskId: string
  cutPieceOrderNo: string
}): PdaCutPieceExecutionRef | null {
  const registry = buildCuttingIdentityRegistry()
  return registry.pdaExecutionsByTaskAndOrder[buildExecutionKey(input.taskId, input.cutPieceOrderNo)] || null
}
