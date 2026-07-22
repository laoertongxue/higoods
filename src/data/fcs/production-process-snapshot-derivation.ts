import {
  deriveFormalProductionOrderMaterialFields,
} from './formal-production-order-material-items.ts'
import type { FormalProductionOrderProcessSnapshot } from './process-work-order-domain.ts'
import type { ProductionOrder } from './production-orders.ts'

function roundPlannedQty(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000
}

/**
 * 从正式生产单的已发布技术包快照派生印花/染色加工单快照。
 *
 * 此函数不读写任何领域状态，供正式加工单生成和固定联合水溶染色 seed 共用。
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

  const processCodes = (['DYE', 'PRINT'] as const)
    .filter((processCode) => techPackSnapshot.processEntries.some((entry) => entry.processCode === processCode))

  return processCodes.map((processCode) => {
    const entries = techPackSnapshot.processEntries.filter((entry) => entry.processCode === processCode)
    const linkedBomItemIds = [...new Set(entries.flatMap((entry) => entry.linkedBomItemIds || []))]
    const processLabel = processCode === 'DYE' ? '染色' : '印花'
    if (linkedBomItemIds.length === 0) {
      throw new Error(`生产单 ${order.productionOrderNo} 的${processLabel}工艺未绑定 BOM 物料`)
    }

    const bomItems = linkedBomItemIds.map((bomItemId) => {
      const bomItem = techPackSnapshot.bomItems.find((item) => item.id === bomItemId)
      if (!bomItem) throw new Error(`生产单 ${order.productionOrderNo} 的${processLabel}工艺绑定了不存在的 BOM：${bomItemId}`)
      return bomItem
    })
    const missingMaterialCodeItem = bomItems.find((item) => !item.materialCode?.trim())
    if (missingMaterialCodeItem) {
      throw new Error(`生产单 ${order.productionOrderNo} 的${processLabel}工艺 BOM ${missingMaterialCodeItem.id} 缺少稳定物料编码，无法生成加工单`)
    }
    if (
      processCode === 'DYE'
      && bomItems.some((item) => item.waterSolubleRequirement === '是')
      && bomItems.some((item) => item.waterSolubleRequirement !== '是')
    ) {
      throw new Error(`生产单 ${order.productionOrderNo} 的染色工艺绑定的 BOM 水溶属性不一致，请先统一并修正正式 BOM 工艺属性`)
    }

    const units = [...new Set(bomItems.map((item) => item.unit?.trim()).filter((unit): unit is string => Boolean(unit)))]
    if (units.length !== 1 || bomItems.some((item) => !item.unit?.trim())) {
      throw new Error(`生产单 ${order.productionOrderNo} 的${processLabel}工艺绑定多种或缺失数量单位，无法合并为一张加工单`)
    }

    const plannedQty = roundPlannedQty(bomItems.reduce(
      (sum, item) => sum + productionQty * item.unitConsumption * (1 + item.lossRate),
      0,
    ))
    if (!Number.isFinite(plannedQty) || plannedQty <= 0) {
      throw new Error('正式生产单加工数量和单位必须有效')
    }
    const materialItems = bomItems.map((item) => ({
      sourceBomItemId: item.id,
      materialId: item.materialCode!.trim(),
      materialName: `${item.name}${item.spec ? ` / ${item.spec}` : ''}`,
    }))
    const materialFields = deriveFormalProductionOrderMaterialFields(materialItems)
    const targetColors = [...new Set(bomItems.map((item) => item.colorLabel).filter((color): color is string => Boolean(color)))]
    const processName = [...new Set(entries.map((entry) => entry.processName).filter(Boolean))].join('、') || processLabel

    return {
      productionOrderId: order.productionOrderId,
      productionOrderNo: order.productionOrderNo,
      orderedAt: order.createdAt,
      techPackVersionId: techPackSnapshot.sourceTechPackVersionId,
      techPackVersionLabel: techPackSnapshot.sourceTechPackVersionLabel || techPackSnapshot.versionLabel,
      materialId: materialFields.materialId,
      materialName: materialFields.materialName,
      materialItems,
      targetColor: targetColors.join('、') || order.demandSnapshot.skuLines[0]?.color || '按技术包配色',
      plannedQty,
      qtyUnit: units[0],
      processCodes: [processCode],
      dyeProcessName: processCode === 'DYE' ? processName : undefined,
      printProcessName: processCode === 'PRINT' ? processName : undefined,
      requiresWaterSoluble: processCode === 'DYE'
        && bomItems.some((item) => item.waterSolubleRequirement === '是'),
      spuCode: order.demandSnapshot.spuCode,
      spuName: order.demandSnapshot.spuName,
      requiredDeliveryDate: order.demandSnapshot.requiredDeliveryDate || '',
    } satisfies FormalProductionOrderProcessSnapshot
  })
}
