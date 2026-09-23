import { getTmfPurchaseState, getTmfProcessingInputBalance, getTmfDemandVersionChange, type TmfPurchaseState } from '../pms/tmf-material-purchases.ts'
import type { TmfProductionDemand } from './webbing-production-demands.ts'

function compactIdentity(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
}

/** 人可读的稳定加工单号；与生产单、技术包快照和工艺节点一一对应。 */
export function getTmfWorkOrderNo(demand: Pick<TmfProductionDemand, 'productionOrderNo' | 'techPackSnapshotId' | 'routeEntryId'>): string {
  const production = compactIdentity(demand.productionOrderNo).replace(/^TMF-WO-/, '')
  const route = compactIdentity(demand.routeEntryId).replace(new RegExp(`^(?:TMF-WO-)?${production}-`), '')
  const snapshot = compactIdentity(demand.techPackSnapshotId).replace(new RegExp(`^(?:TMF-WO-)?${production}-`), '')
  return `TMF-WO-${production}-${route}-${snapshot}`
}

const earliest = (values: string[]) => values.filter(Boolean).sort()[0]
const latest = (values: string[]) => values.filter(Boolean).sort().at(-1)

/** 加工单由已采用的需求快照组合；稳定身份不随排序、收发进度改变。 */
export function projectTmfWorkOrders(data: TmfPurchaseState) {
  const keys = [...new Set(data.demands.map(getTmfWorkOrderNo))]
  return keys.map(workOrderNo => {
    const demands = data.demands.filter(d => getTmfWorkOrderNo(d) === workOrderNo)
    const source = demands[0]
    const ids = new Set(demands.map(d=>d.id))
    const inputs = data.processingIssues.filter(i=>ids.has(i.demandId)&&!i.upstream)
    const outputs = data.cutOutputs.filter(o=>ids.has(o.demandId))
    const packages = data.packages.filter(p=>ids.has(p.demandId)&&!p.splitAt)
    const handovers = data.outputHandovers.filter(h=>data.packages.some(p=>p.id===h.packageId&&ids.has(p.demandId)))
    const sourcePurchaseNos = [...new Set(inputs.map(input => data.lots.find(lot => lot.id === input.lotId)?.sourcePurchaseOrderNo).filter((value): value is string => Boolean(value)))]
    const sourcePurchases = sourcePurchaseNos.map(no => data.orders.find(order => order.purchaseOrderNo === no)).filter((order): order is NonNullable<typeof order> => Boolean(order))
    const mainControl = data.productionControls.find(c=>c.productionOrderId===source.productionOrderId)
    const control = mainControl && mainControl.status !== 'ACTIVE' ? mainControl : getTmfDemandVersionChange(source) ?? mainControl
    const matched = demands.every(d=>outputs.filter(o=>o.demandId===d.id).reduce((sum,o)=>sum+o.goodPieces,0)>=d.requiredPieces)
    const packageIds = new Set(packages.map(pkg => pkg.id))
    const receiptOperations = data.operations.filter(operation => inputs.some(input => input.id === operation.objectId) && /实收/.test(operation.action))
    const downstreamReceiptOperations = data.operations.filter(operation => packageIds.has(operation.objectId) && /回仓实收|生产领料方确认实收/.test(operation.action))
    return { id: workOrderNo, workOrderNo, productionOrderNo:source.productionOrderNo, productionOrderId:source.productionOrderId,
      snapshotId:source.techPackSnapshotId, versionId:source.techPackVersionId, routeEntryId:source.routeEntryId,
      demands, inputs, outputs, packages, handovers, sourcePurchases, control,
      requiredPieces:demands.reduce((sum,d)=>sum+d.requiredPieces,0),
      receiptStatus:!inputs.length?'待来源交出':inputs.every(i=>i.receivedMeters===i.dispatchedMeters)?'已接收':inputs.some(i=>i.receivedMeters>0)?'部分接收':'待接收',
      processingStatus:!outputs.length?'待加工填报':matched?'合格产出达量':'加工中',
      handoverStatus:!handovers.length?'未交出':matched&&handovers.reduce((sum,h)=>sum+h.dispatchedPieces,0)>=outputs.reduce((sum,o)=>sum+o.goodPieces,0)?'合格产出已交出':'部分交出',
      material: sourcePurchases[0] ?? data.orders.find(p=>p.materialSkuId===source.materialSkuId),
      firstReceivedAt: earliest(receiptOperations.map(operation => operation.occurredAt)),
      firstReportedAt: earliest(outputs.map(output => output.reportedAt)),
      lastReportedAt: latest(outputs.map(output => output.reportedAt)),
      lastHandoverAt: latest(handovers.map(handover => handover.dispatchedAt)),
      downstreamReceivedAt: latest(downstreamReceiptOperations.map(operation => operation.occurredAt)),
    }
  })
}
export function listTmfWorkOrders() { return projectTmfWorkOrders(getTmfPurchaseState()) }
export function getTmfWorkOrder(id:string) { return listTmfWorkOrders().find(o=>o.id===id) }
export { getTmfProcessingInputBalance }
