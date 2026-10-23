import type { PickupNodeProjection, PickupCuttingSource } from './pickup-node-domain.ts'
import type { MaterialPrepOrderProjection } from './production-material-prep.ts'
import type { GeneratedCutOrderSourceRecord } from './generated-cut-orders.ts'
import type { RuntimeProcessTask } from '../runtime-process-tasks.ts'

export function resolveCentralCuttingPickupSources(
  node: PickupNodeProjection,
  projection: MaterialPrepOrderProjection | undefined,
  sources: GeneratedCutOrderSourceRecord[],
  factory: { id: string; factoryTier?: string; status: string } | undefined,
  tasks: RuntimeProcessTask[],
): PickupCuttingSource[] | undefined {
  if (!factory || factory.factoryTier !== 'CENTRAL' || factory.status !== 'active' || !projection || projection.order.isClosed
    || projection.order.prepOrderId !== node.prepOrderId || projection.order.productionOrderId !== node.productionOrderId
    || node.status !== 'OPEN' || !node.items.length || node.items.length !== node.itemCount) return undefined
  const result: PickupCuttingSource[] = []
  for (const item of node.items) {
    const lines = projection.lines.filter(line => line.prepLineId === item.prepLineId)
    if (item.materialType !== '面料' || lines.length !== 1 || !Number.isFinite(item.currentAvailableQty) || item.currentAvailableQty <= 0) return undefined
    const line = lines[0]
    if (line.sourceDataIssue || line.materialSku !== item.materialSku || line.unit !== item.unit || !item.unit) return undefined
    const byId = sources.filter(source => source.cutOrderId === line.cutOrderId)
    const candidates = byId.length ? byId : sources.filter(source => source.cutOrderNo === line.cutOrderNo)
    // A short number is only an alias after production and material identity both match.
    const matches = candidates.filter(source => source.productionOrderId === node.productionOrderId && source.materialSku === item.materialSku)
    if (matches.length !== 1) return undefined
    const source = matches[0]
    if (!source.cuttingTaskId || !source.techPackVersionId || !source.materialUnit || source.cuttingTaskAssigneeFactoryId !== factory.id
      || !['ASSIGNED', 'AWARDED'].includes(source.cuttingTaskAssignmentStatus) || source.executionRoute === 'CONFLICT') return undefined
    const executions = tasks.filter(task => task.productionOrderId === source.productionOrderId && task.executionEnabled !== false && !task.isSplitSource
      && (task.taskId === source.cuttingTaskId || task.rootTaskNo === source.cuttingTaskNo))
    if (!executions.length || executions.some(task => task.status === 'CANCELLED' || task.assignedFactoryId !== factory.id
      || !['ASSIGNED', 'AWARDED'].includes(task.assignmentStatus))) return undefined
    result.push({ prepLineId: item.prepLineId, productionOrderId: node.productionOrderId, cutOrderId: source.cutOrderId, cutOrderNo: source.cutOrderNo,
      cuttingTaskId: source.cuttingTaskId, cuttingTaskNo: source.cuttingTaskNo, executionTaskIds: executions.map(task => task.taskId), factoryId: factory.id,
      techPackVersionId: source.techPackVersionId, materialSku: item.materialSku, materialName: source.materialName,
      materialImageUrl: source.materialImageUrl, sourceUnit: item.unit, taskUnit: source.materialUnit })
  }
  return result
}

/** Accept the existing Web cutting labels without turning a production number into a foreign-source match. */
export function centralCuttingSourceMatchesScan(
  source: Pick<PickupCuttingSource, 'cutOrderId' | 'cutOrderNo' | 'productionOrderId' | 'materialSku'>,
  value: string,
  oldCutIds: string[] = [],
): boolean {
  const code = value.trim()
  if (code === source.cutOrderNo || [source.cutOrderId, source.cutOrderNo, ...oldCutIds].some(id => code === buildCutOrderQrValue(id))) return true
  try {
    const payload = parseCuttingTraceQr(code)
    return payload?.codeType === 'CUT_ORDER' && payload.cutOrderId === source.cutOrderId && payload.cutOrderNo === source.cutOrderNo
      && payload.productionOrderId === source.productionOrderId && payload.materialSku === source.materialSku
  } catch { return false }
}
import { buildCutOrderQrValue, parseCuttingTraceQr } from './qr-codes.ts'
