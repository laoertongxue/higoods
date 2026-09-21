import { getTmfPurchaseState, getTmfProcessingInputBalance, getTmfDemandVersionChange, type TmfPurchaseState } from '../pms/tmf-material-purchases.ts'

/** 加工单由已采用的需求快照组合；稳定身份不随排序、收发进度改变。 */
export function projectTmfWorkOrders(data: TmfPurchaseState) {
  const keys = [...new Set(data.demands.map(d => JSON.stringify([d.productionOrderId,d.techPackSnapshotId,d.routeEntryId])))]
  return keys.map(id => {
    const demands = data.demands.filter(d => JSON.stringify([d.productionOrderId,d.techPackSnapshotId,d.routeEntryId])===id)
    const source = demands[0]
    const ids = new Set(demands.map(d=>d.id))
    const inputs = data.processingIssues.filter(i=>ids.has(i.demandId)&&!i.upstream)
    const outputs = data.cutOutputs.filter(o=>ids.has(o.demandId))
    const packages = data.packages.filter(p=>ids.has(p.demandId)&&!p.splitAt)
    const handovers = data.outputHandovers.filter(h=>data.packages.some(p=>p.id===h.packageId&&ids.has(p.demandId)))
    const mainControl = data.productionControls.find(c=>c.productionOrderId===source.productionOrderId)
    const control = mainControl && mainControl.status !== 'ACTIVE' ? mainControl : getTmfDemandVersionChange(source) ?? mainControl
    const execution = data.workExecutions.find(w=>w.workOrderId===id)
    const matched = demands.every(d=>outputs.filter(o=>o.demandId===d.id).reduce((sum,o)=>sum+o.goodPieces,0)>=d.requiredPieces)
    return { id, productionOrderNo:source.productionOrderNo, productionOrderId:source.productionOrderId,
      snapshotId:source.techPackSnapshotId, versionId:source.techPackVersionId, routeEntryId:source.routeEntryId,
      demands, inputs, outputs, packages, handovers, control,
      requiredPieces:demands.reduce((sum,d)=>sum+d.requiredPieces,0),
      receiptStatus:!inputs.length?'待来源交出':inputs.every(i=>i.receivedMeters===i.dispatchedMeters)?'已接收':inputs.some(i=>i.receivedMeters>0)?'部分接收':'待接收',
      processingStatus:execution?.finishedAt?'加工完成':!outputs.length?(execution?.startedAt?'加工中':execution?.acceptedAt?'已接单待开工':'未开始'):matched?'合格产出达量':'加工中',
      handoverStatus:!handovers.length?'未交出':matched&&handovers.reduce((sum,h)=>sum+h.dispatchedPieces,0)>=outputs.reduce((sum,o)=>sum+o.goodPieces,0)?'合格产出已交出':'部分交出',
      material: data.orders.find(p=>p.materialSkuId===source.materialSkuId),
    }
  })
}
export function listTmfWorkOrders() { return projectTmfWorkOrders(getTmfPurchaseState()) }
export function getTmfWorkOrder(id:string) { return listTmfWorkOrders().find(o=>o.id===id) }
export { getTmfProcessingInputBalance }
