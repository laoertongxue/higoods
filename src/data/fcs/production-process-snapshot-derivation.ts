import {
  deriveFormalProductionOrderMaterialFields,
} from './formal-production-order-material-items.ts'
import type { FormalProductionOrderProcessSnapshot } from './process-work-order-domain.ts'
import type { ProductionOrder } from './production-orders.ts'
import { getProductionOrderChangeCurrentFacts } from './production-tech-pack-change-domain.ts'

function roundPlannedQty(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000
}

/**
 * 从正式生产单的已发布技术包快照派生印花/染色加工单快照。
 *
 * 路线和用量来自冻结快照；已执行的物料替换来自当前执行事实，不改写冻结资料。
 */
export function deriveFormalProductionOrderProcessSnapshots(
  order: ProductionOrder,
): FormalProductionOrderProcessSnapshot[] {
  const techPackSnapshot = order.techPackSnapshot
  if (!techPackSnapshot) return []
  if (!techPackSnapshot.sourceTechPackVersionId.trim() || !techPackSnapshot.sourceTechPackVersionLabel.trim()) {
    throw new Error('正式生产单必须携带已发布技术包版本快照')
  }

  const productionQty = order.demandSnapshot.skuLines.reduce((sum, line) => sum + line.qty, 0)
  if (!Number.isFinite(productionQty) || productionQty <= 0) {
    throw new Error('正式生产单加工数量和单位必须有效')
  }

  const entries = techPackSnapshot.processEntries.filter((entry) =>
    entry.processCode === 'DYE' || entry.processCode === 'PRINT'
  )
  const materialFacts = getProductionOrderChangeCurrentFacts(order.productionOrderId)?.materialFacts ?? []

  return entries.flatMap((entry) => {
    const processCode = entry.processCode as 'DYE' | 'PRINT'
    const processLabel = processCode === 'DYE' ? '染色' : '印花'
    const linkedBomItemIds = [...new Set(entry.linkedBomItemIds ?? [])]
    if (linkedBomItemIds.length === 0) {
      throw new Error(`生产单 ${order.productionOrderNo} 的${processLabel}工艺节点 ${entry.id} 未绑定 BOM 物料`)
    }

    return linkedBomItemIds.map((bomItemId) => {
      const bomItem = techPackSnapshot.bomItems.find((item) => item.id === bomItemId)
      if (!bomItem) throw new Error(`生产单 ${order.productionOrderNo} 的${processLabel}工艺绑定了不存在的 BOM：${bomItemId}`)
      if (bomItem.type === '成衣') {
        throw new Error(`生产单 ${order.productionOrderNo} 的${processLabel}工艺不能绑定成衣 BOM：${bomItemId}`)
      }
      const replacement = materialFacts.find((fact) =>
        fact.sourceBomItemId === bomItem.id
        && fact.sourceTechPackVersionId === techPackSnapshot.sourceTechPackVersionId
        && fact.executionMaterialReplacement?.changeRecordId
      )?.executionMaterialReplacement
      const materialCode = replacement?.materialCode || bomItem.materialCode?.trim()
      if (!materialCode) {
        throw new Error(`生产单 ${order.productionOrderNo} 的${processLabel}工艺 BOM ${bomItem.id} 缺少稳定物料编码，无法生成加工单`)
      }
      const qtyUnit = bomItem.unit?.trim()
      if (!qtyUnit) {
        throw new Error(`生产单 ${order.productionOrderNo} 的${processLabel}工艺 BOM ${bomItem.id} 缺少数量单位`)
      }
      const applicableSkuCodes = new Set(bomItem.applicableSkuCodes ?? [])
      const applicableQty = order.demandSnapshot.skuLines.reduce((sum, line) =>
        applicableSkuCodes.size === 0 || applicableSkuCodes.has(line.skuCode) ? sum + line.qty : sum
      , 0)
      if (!Number.isFinite(bomItem.lossRate) || bomItem.lossRate < 0 || bomItem.lossRate >= 1) throw new Error(`BOM ${bomItem.id} 损耗率必须为0到1之间的小数`)
      const plannedQty = roundPlannedQty(
        applicableQty * bomItem.unitConsumption * (1 + bomItem.lossRate),
      )
      if (!Number.isFinite(plannedQty) || plannedQty <= 0) {
        throw new Error(`生产单 ${order.productionOrderNo} 的${processLabel}工艺 BOM ${bomItem.id} 加工数量必须大于 0`)
      }
      const materialItems = [{
        sourceBomItemId: bomItem.id,
        materialId: materialCode,
        materialName: replacement?.materialName || `${bomItem.name}${bomItem.spec ? ` / ${bomItem.spec}` : ''}`,
        materialType: bomItem.type,
      }]
      const materialFields = deriveFormalProductionOrderMaterialFields(materialItems)
      const processName = entry.processName || processLabel

      return {
        productionOrderId: order.productionOrderId,
        productionOrderNo: order.productionOrderNo,
        orderedAt: order.createdAt,
        techPackVersionId: techPackSnapshot.sourceTechPackVersionId,
        techPackVersionLabel: techPackSnapshot.sourceTechPackVersionLabel || techPackSnapshot.versionLabel,
        processEntryId: entry.id,
        routeObjectKey: entry.routeObjectKey || `BOM:${bomItem.id}`,
        materialId: materialFields.materialId,
        materialName: materialFields.materialName,
        materialItems,
        targetColor: bomItem.colorLabel || order.demandSnapshot.skuLines[0]?.color || '按技术包配色',
        plannedQty,
        qtyUnit,
        processCodes: [processCode],
        dyeProcessName: processCode === 'DYE' ? processName : undefined,
        printProcessName: processCode === 'PRINT' ? processName : undefined,
        requiresWaterSoluble: processCode === 'DYE' && bomItem.waterSolubleRequirement === '是',
        spuCode: order.demandSnapshot.spuCode,
        spuName: order.demandSnapshot.spuName,
        requiredDeliveryDate: order.demandSnapshot.requiredDeliveryDate || '',
      } satisfies FormalProductionOrderProcessSnapshot
    })
  })
}


/** Recover definition identity only; execution/receipt quantities remain in their original ledgers. */
export function getRestoredFormalProcessDefinitions(order: ProductionOrder, processCode: 'PRINT' | 'DYE') {
  const definitions = order.processWorkOrderDefinitions?.filter(item => item.processCode === processCode) ?? []
  if (!definitions.length) return []
  const snapshots = deriveFormalProductionOrderProcessSnapshots(order)
  return definitions.flatMap(definition => {
    const source = definition.sourceSnapshot
    if (!source || !definition.workOrderId?.trim() || !definition.workOrderNo?.trim()) return []
    if (source.sourceType !== 'PRODUCTION_ORDER' || source.productionOrderId !== order.productionOrderId
      || source.techPackVersionId !== order.techPackSnapshot?.sourceTechPackVersionId) return []
    const bomIds = [...new Set(source.bomItemIds || (source.bomItemId ? [source.bomItemId] : []))].sort()
    const candidates = snapshots.filter(snapshot => snapshot.processCodes.includes(processCode)
      && snapshot.techPackVersionId === source.techPackVersionId
      && (snapshot.processEntryId || '') === (source.processEntryId || '')
      && (snapshot.routeObjectKey || '') === (source.routeObjectKey || '')
      && JSON.stringify([...new Set((snapshot.materialItems || []).map(item => item.sourceBomItemId))].sort()) === JSON.stringify(bomIds))
    if (candidates.length !== 1) return []
    const snapshot = candidates[0]
    return [{ ...snapshot, workOrderId: definition.workOrderId, workOrderNo: definition.workOrderNo,
      sourceKey: definition.sourceKey, sourceSnapshot: structuredClone(source),
      processName: processCode === 'PRINT' ? snapshot.printProcessName || '印花' : snapshot.dyeProcessName || '染色' }]
  })
}
