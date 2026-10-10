import type { BuildReleaseMatrixInput, CutPieceFact, CutPieceRequirement, ReleaseTicketDetail } from '../cut-piece-release-domain.ts'
import type { GeneratedCutOrderSourceRecord } from './generated-cut-orders.ts'
import type { SpreadingPieceOutputLine, GeneratedFeiTicketSourceRecord } from './generated-fei-tickets.ts'
import {listReleaseSourceTickets,listCutPieceReleaseTicketDetails,buildTicketReleaseFacts} from './cut-piece-release-facts.ts'

// 正式裁片来源提供单耗和计划；有效已装袋菲票与最终逐票实收提供数量。
export function buildGeneratedCutReleaseInputs(sources: GeneratedCutOrderSourceRecord[], _outputs: SpreadingPieceOutputLine[], provided?: {tickets: GeneratedFeiTicketSourceRecord[]; details: ReleaseTicketDetail[]; factsComplete?: boolean}, scope?: {initialOrderIds: ReadonlySet<string>; currentOrderIds?: ReadonlySet<string>}): Array<{
  input: BuildReleaseMatrixInput
  sources: GeneratedCutOrderSourceRecord[]
  latestAt: string
  operator: string
}> {
  if(!sources.length)return []
  const sourceById = new Map(sources.map(source => [source.cutOrderId, source]))
  const allTickets = provided?.tickets || listReleaseSourceTickets()
  const currentOrderIds = new Set(scope?.currentOrderIds || [])
  for (const ticket of allTickets) {
    const source = sourceById.get(ticket.cutOrderId)
    if (source?.productionOrderId === ticket.productionOrderId && (ticket.sourceBasisType === 'MANUAL_MARKER_PLAN' || ticket.printStatus === 'PRINTED')) currentOrderIds.add(source.productionOrderId)
  }
  const currentSources = scope ? sources.filter(source => !scope.initialOrderIds.has(source.productionOrderId) || currentOrderIds.has(source.productionOrderId)) : sources
  if (!currentSources.length) return []
  const normalizeInstance=(value:string)=>({L:'1',LEFT:'1','左':'1',R:'2',RIGHT:'2','右':'2'}[value.trim().toUpperCase()] || value.trim())
  const sourceIds=new Set(currentSources.map(source=>source.cutOrderId))
  const tickets = allTickets.filter(ticket=>sourceIds.has(ticket.cutOrderId))
  const details = provided?.details || listCutPieceReleaseTicketDetails(new Set(tickets.map(ticket=>ticket.feiTicketId)))
  const groups = new Map<string, GeneratedCutOrderSourceRecord[]>()
  for (const source of currentSources) groups.set(source.productionOrderId, [...(groups.get(source.productionOrderId) || []), source])
  return [...groups].flatMap(([productionOrderId, records]) => {
    const byId = new Map(records.map(record => [record.cutOrderId, record]))

    const planQtyByColorSize: Record<string, Record<string, number>> = {}
    const requirements = new Map<string, CutPieceRequirement>()
    // 同物料不同 BOM 分支不可相互补足；不同纸样部位保留原部位标识。
    const materialKey = (record: GeneratedCutOrderSourceRecord) => [record.materialSku, ...(record.sourceBomItemIds || []).slice().sort()].join('::')
    for (const record of records) for (const sku of record.skuScopeLines) {
      const colors = planQtyByColorSize[sku.color] ||= {}
      colors[sku.size] = Math.max(colors[sku.size] || 0, sku.plannedQty)
      const parts = record.pieceRows.filter(part => !part.applicableSkuCodes.length || part.applicableSkuCodes.includes(sku.skuCode))
      // 缺少正式单耗时保留不可计算行，不把缺资料当作没有该物料需求。
      for (const part of parts.length ? parts : [{ partCode: `missing:${record.cutOrderId}`, partName: '待补部位单耗', pieceCountPerUnit: undefined }]) {
        const materialId = materialKey(record)
        requirements.set([materialId, part.partCode, sku.color, sku.size].join('\0'), {
          materialId, materialName: record.materialName, materialImageUrl: record.materialImageUrl, partId: part.partCode, partName: part.partName,
          piecesPerGarment: part.pieceCountPerUnit, garmentColor: sku.color, size: sku.size,
        })
      }
    }
    const facts = (buildTicketReleaseFacts(tickets.filter(ticket=>ticket.productionOrderId===productionOrderId && byId.has(ticket.cutOrderId)), details,
      new Map(records.map(record=>[record.cutOrderId,materialKey(record)])))).filter(fact=>fact.productionOrderId===productionOrderId)
    // 有明确实例标签的左右/重复部位分别满足；缺另一实例不能由双倍同侧抵消。
    for (const requirement of [...requirements.values()]) {
      const partTickets=tickets.filter(ticket=>ticket.productionOrderId===productionOrderId && ticket.partCode===requirement.partId && ticket.garmentColor===requirement.garmentColor && ticket.skuSize===requirement.size && byId.has(ticket.cutOrderId) && materialKey(byId.get(ticket.cutOrderId)!)===requirement.materialId)
      if((requirement.piecesPerGarment || 0)>1 && partTickets.some(ticket=>ticket.partInstanceNo)) {
        requirements.delete([requirement.materialId,requirement.partId,requirement.garmentColor,requirement.size].join('\0'))
        for(let index=1;index<=requirement.piecesPerGarment!;index++) {
          const partId=`${requirement.partId}::instance:${index}`
          requirements.set([requirement.materialId,partId,requirement.garmentColor,requirement.size].join('\0'),{...requirement,partId,partName:`${requirement.partName}（实例 ${index}）`,piecesPerGarment:1})
        }
        for(const fact of facts.filter(fact=>fact.materialId===requirement.materialId && fact.partId===requirement.partId && fact.garmentColor===requirement.garmentColor && fact.size===requirement.size)) {
          const ticket=partTickets.find(ticket=>ticket.feiTicketId===fact.sourceEventId)
          if(ticket?.partInstanceNo) {fact.partId=`${fact.partId}::instance:${normalizeInstance(ticket.partInstanceNo)}`;if(fact.ticketDetail) fact.ticketDetail.partId=fact.partId}
        }
      }
    }
    const latest=[...facts].sort((a,b)=>a.occurredAt.localeCompare(b.occurredAt)).at(-1)
    return [{ input: { productionOrderId, productionOrderNo: records[0].productionOrderNo, spuCode: records[0].spuCode,
      planQtyByColorSize, requirements: [...requirements.values()], facts, factsComplete: provided?.factsComplete !== false },
    sources: records, latestAt: latest?.occurredAt || '', operator: '裁床仓库事实' }]
  })
}
