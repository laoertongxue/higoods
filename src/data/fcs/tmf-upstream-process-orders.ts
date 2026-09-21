import type { TmfProductionDemand } from './webbing-production-demands.ts'
import type { DyeWorkOrder } from './dyeing-task-domain.ts'
import type { PrintWorkOrder } from './printing-task-domain.ts'
import { resolveProcessRouteLaneOrder } from '../tech-pack-process-route.ts'

/** 只读取既有印染加工单，不建立第二份印染数量账。 */
export function projectTmfUpstreamProcessOrders(demands: TmfProductionDemand[], dyeOrders: DyeWorkOrder[], printOrders: PrintWorkOrder[]) {
  const first = demands[0]
  if (!first) return []
  if (demands.some(d => d.productionOrderId !== first.productionOrderId || d.techPackSnapshotId !== first.techPackSnapshotId || d.routeEntryId !== first.routeEntryId)) throw new Error('请按同一生产单、采用快照及截断节点核对印染来源。')
  const ordered = resolveProcessRouteLaneOrder(first.routeSnapshot)
  if (!ordered.ordered) throw new Error('工艺前后关系不完整，请先核对技术包路线。')
  return ordered.entries.filter(entry => entry.processCode === 'DYE' || entry.processCode === 'PRINT').map(entry => {
    const candidates = (entry.processCode === 'DYE' ? dyeOrders : printOrders).filter(order => {
      const source = order.sourceSnapshot
      return source?.sourceType === 'PRODUCTION_ORDER' && source.productionOrderId === first.productionOrderId
        && source.processEntryId === entry.id
        && demands.every(d => [source.bomItemId, ...(source.bomItemIds ?? [])].includes(d.bomItemId))
    })
    const rows = candidates.map(order => {
      const dye = 'dyeOrderId' in order
      const snapshot = order.formalProductionOrderSnapshot
      const source = order.sourceSnapshot!
      const inputId = snapshot?.inputMaterialSkuId
      const outputId = snapshot?.outputMaterialSkuId
      const inputCode = dye ? order.rawMaterialSku : order.materialSku
      const outputCode = dye ? order.outputMaterial?.sku : order.outputMaterialSku
      const problems: string[] = []
      if (source.techPackVersionId !== first.techPackVersionId || (snapshot && snapshot.techPackVersionId !== first.techPackVersionId)) problems.push('技术包版本不符')
      if (inputId ? inputId !== entry.inputMaterialSkuId : inputCode !== (entry.inputMaterialSkuCode || entry.inputMaterialSkuId)) problems.push('投入SKU不符')
      if (outputId ? outputId !== entry.outputMaterialSkuId : outputCode !== (entry.outputMaterialSkuCode || entry.outputMaterialSkuId)) problems.push('产出SKU不符')
      if (!['米', 'm'].includes(order.qtyUnit)) problems.push('计量单位不符，不能直接按米接续')
      if (order.sourceSnapshot?.cancelledAt || order.status === 'CANCELLED') problems.push('加工单已取消')
      if (order.changeImpact?.length) problems.push('存在变更影响，需先核对处置')
      const id = dye ? order.dyeOrderId : order.printOrderId
      const factoryId = dye ? order.dyeFactoryId : order.printFactoryId
      if (!factoryId) problems.push('尚未分配加工厂')
      return { id, no: dye ? order.dyeOrderNo : order.printOrderNo, factoryId,
        downstreamFactoryName: dye ? order.downstreamPartner?.name : order.productionTmfContinuation?.factoryName,
        downstreamEntryId: dye ? undefined : order.productionTmfContinuation?.cutEntryId,
        factoryName: dye ? order.dyeFactoryName : order.printFactoryName,
        plannedQty: order.plannedQty, unit: order.qtyUnit, status: order.status, inputCode, outputCode: outputCode ?? '', problems,
        route: `/fcs/craft/${dye ? 'dyeing' : 'printing'}/work-orders/${encodeURIComponent(id)}` }
    })
    return { entryId: entry.id, processName: entry.processName, inputSku: entry.inputMaterialSkuCode || entry.inputMaterialSkuId || '',
      outputSku: entry.outputMaterialSkuCode || entry.outputMaterialSkuId || '', rows,
      state: !rows.length ? '缺少对应加工单' : rows.length > 1 ? '多个来源待核对' : rows[0].problems.length ? '来源不匹配' : '已关联来源',
      matchedOrderId: rows.length === 1 && !rows[0].problems.length ? rows[0].id : undefined }
  })
}

export async function readTmfUpstreamProcessOrders(demands: TmfProductionDemand[]) {
  if (!demands.some(d => d.routeSnapshot.some(e => e.processCode === 'DYE' || e.processCode === 'PRINT'))) return []
  const [dye, print] = await Promise.all([import('./dyeing-task-domain.ts'), import('./printing-task-domain.ts')])
  return projectTmfUpstreamProcessOrders(demands, dye.listDyeWorkOrders(), print.listPrintWorkOrders())
}
