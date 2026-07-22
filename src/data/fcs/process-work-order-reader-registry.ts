import type { ProcessWorkOrder } from './process-work-order-domain.ts'

type ProcessWorkOrderReader = () => ProcessWorkOrder[]

let reader: ProcessWorkOrderReader = () => []

export function registerProcessWorkOrderReader(nextReader: ProcessWorkOrderReader): void {
  reader = nextReader
}

export function listRegisteredProcessWorkOrders(): ProcessWorkOrder[] {
  return reader().map((workOrder) => ({
    ...workOrder,
    productionOrderIds: [...workOrder.productionOrderIds],
    sourceArtifactIds: workOrder.sourceArtifactIds ? [...workOrder.sourceArtifactIds] : undefined,
  }))
}
