export interface ProductionOrderRef {
  productionOrderId: string
  productionOrderNo: string
}

export interface CutOrderRef {
  cutOrderId: string
  cutOrderNo: string
  productionOrderId: string
  productionOrderNo: string
  materialSku: string
  activeMarkerPlanRefId: string
  activeMarkerPlanRefNo: string
  markerPlanIds: string[]
  markerPlanNos: string[]
}

export interface MarkerPlanRefRef {
  markerPlanId: string
  markerPlanNo: string
  sourceCutOrderIds: string[]
  sourceCutOrderNos: string[]
  sourceProductionOrderIds: string[]
  sourceProductionOrderNos: string[]
}

export interface CuttingTaskRef {
  taskId: string
  taskNo: string
  productionOrderId: string
  productionOrderNo: string
  cutOrderIds: string[]
  cutOrderNos: string[]
  markerPlanIds: string[]
  markerPlanNos: string[]
}

export interface PdaCutPieceExecutionRef {
  taskId: string
  taskNo: string
  executionOrderId: string
  executionOrderNo: string
  legacyCutPieceOrderNo: string
  productionOrderId: string
  productionOrderNo: string
  cutOrderId: string
  cutOrderNo: string
  markerPlanId: string
  markerPlanNo: string
}

export interface CuttingCoreRegistry {
  productionOrdersById: Record<string, ProductionOrderRef>
  productionOrdersByNo: Record<string, ProductionOrderRef>
  cutOrdersById: Record<string, CutOrderRef>
  cutOrdersByNo: Record<string, CutOrderRef>
  markerPlanRefsById: Record<string, MarkerPlanRefRef>
  markerPlanRefsByNo: Record<string, MarkerPlanRefRef>
  cuttingTasksById: Record<string, CuttingTaskRef>
  cuttingTasksByNo: Record<string, CuttingTaskRef>
  pdaExecutionsByTaskAndOrder: Record<string, PdaCutPieceExecutionRef>
  pdaExecutionsByCutOrderId: Record<string, PdaCutPieceExecutionRef[]>
}
