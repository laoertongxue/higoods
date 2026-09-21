import { getTmfPurchaseState, type TmfPurchaseState } from '../pms/tmf-material-purchases.ts'
import type { FactoryReceivingSource } from './factory-receiving-types.ts'
import { getFactoryReceivingSource, registerFactoryReceivingSource, getSourceActualReceipts } from './factory-receiving.ts'

export const tmfUpstreamReceivingId = (issueId: string) => `TMF-ISSUE:${issueId}`

/** 发料是唯一来源；不从计划量生成来货，不把实收复制到TMF数量账。 */
export function projectTmfUpstreamReceivingSources(data: TmfPurchaseState): FactoryReceivingSource[] {
  return data.processingIssues.filter(i => i.upstream).map(issue => {
    const binding = issue.upstream!
    const lot = data.lots.find(l => l.id === issue.lotId)!
    const purchase = data.orders.find(p => p.purchaseOrderNo === lot.sourcePurchaseOrderNo)!
    const demand = data.demands.find(d => d.id === issue.demandId)!
    const operation = data.operations.find(o => o.action === '生产加工发料' && o.objectId === issue.reservationId && JSON.parse(o.payloadSignature)[4]?.issueId === issue.id)!
    if (!purchase || !demand || !operation) throw new Error('印染发料的采购、生产需求或实际交出记录不完整。')
    const id = tmfUpstreamReceivingId(issue.id)
    return { id, documentNo: issue.id, type: 'ISSUE',
      origin: { kind: 'WAREHOUSE', id: lot.warehouseId, name: purchase.warehouse, warehouseAttribute: '辅料仓' },
      targetFactoryId: issue.targetFactoryId, targetFactoryName: binding.factoryName,
      createdAt: issue.dispatchedAt, createdBy: operation.actor.name,
      approvedAt: issue.dispatchedAt, approvedBy: operation.actor.name,
      ...(binding.processCode === 'PRINT' ? { processCode: 'PRINT' as const } : {}),
      lines: [{ id: `${id}:L1`, measurementBasis: 'CONTINUOUS_LENGTH',
        material: { sku: binding.inputCode, name: purchase.materialName, kind: 'ACCESSORY', imageUrl: purchase.materialImageUrl,
          color: '以采购物料及确认样为准', composition: '采购来源未单列成分', specification: purchase.productionStandard, batchNo: lot.id },
        plannedQty: issue.dispatchedMeters, sentQty: issue.dispatchedMeters, unit: '米', rolls: [], label: lot.id,
        productionOrderNo: demand.productionOrderNo,
        ...(binding.processCode === 'DYE' ? { dyeOrderId: binding.orderId } : { printingOrderId: binding.orderId }) }],
    }
  })
}

export function syncTmfUpstreamReceivingSources(): void {
  for (const source of projectTmfUpstreamReceivingSources(getTmfPurchaseState())) {
    const previous = getFactoryReceivingSource(source.id)
    if (previous && JSON.stringify(previous) !== JSON.stringify(source)) throw new Error('已交出的印染来源发生差异，请核对原发料记录。')
    if (!previous) registerFactoryReceivingSource(source)
  }
}

export function getTmfUpstreamReceivedMeters(issueId: string): number {
  return Math.round(getSourceActualReceipts(tmfUpstreamReceivingId(issueId)).filter(r => r.unit === '米').reduce((n, r) => n + r.qty, 0) * 1000) / 1000
}
