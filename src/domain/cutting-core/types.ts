export interface ProductionOrderRef {
  productionOrderId: string
  productionOrderNo: string
}

export interface OriginalCutOrderRef {
  originalCutOrderId: string
  originalCutOrderNo: string
  productionOrderId: string
  productionOrderNo: string
  materialSku: string
  activeMergeBatchId: string
  activeMergeBatchNo: string
  mergeBatchIds: string[]
  mergeBatchNos: string[]
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
  executionOrderId: string
  executionOrderNo: string
  legacyCutPieceOrderNo: string
  productionOrderId: string
  productionOrderNo: string
  originalCutOrderId: string
  originalCutOrderNo: string
  mergeBatchId: string
  mergeBatchNo: string
}

export interface CuttingCoreRegistry {
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
