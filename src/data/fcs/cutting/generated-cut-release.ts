import type { BuildReleaseMatrixInput, CutPieceFact, CutPieceRequirement } from '../cut-piece-release-domain.ts'
import type { GeneratedCutOrderSourceRecord } from './generated-cut-orders.ts'
import type { SpreadingPieceOutputLine } from './generated-fei-tickets.ts'

// 冻结裁片来源提供单耗和计划；只有原实际裁剪产出提供实绩。
export function buildGeneratedCutReleaseInputs(sources: GeneratedCutOrderSourceRecord[], outputs: SpreadingPieceOutputLine[]): Array<{
  input: BuildReleaseMatrixInput
  sources: GeneratedCutOrderSourceRecord[]
  latestAt: string
  operator: string
}> {
  const groups = new Map<string, GeneratedCutOrderSourceRecord[]>()
  for (const source of sources) groups.set(source.productionOrderId, [...(groups.get(source.productionOrderId) || []), source])
  return [...groups].flatMap(([productionOrderId, records]) => {
    const byId = new Map(records.map(record => [record.cutOrderId, record]))
    const lines = outputs.filter(line => line.productionOrderId === productionOrderId && byId.has(line.cutOrderId)
      && line.sourceBasisType === 'ACTUAL_CUTTING_OUTPUT')
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
          materialId, materialName: record.materialName, partId: part.partCode, partName: part.partName,
          piecesPerGarment: part.pieceCountPerUnit, garmentColor: sku.color, size: sku.size,
        })
      }
    }
    const facts = new Map<string, CutPieceFact>()
    for (const line of lines) {
      if (!Number.isFinite(line.actualCutPieceQty) || line.actualCutPieceQty < 0) continue
      const record = byId.get(line.cutOrderId)!
      facts.set(line.outputLineId, {
        factId: `actual-cut:${line.outputLineId}`, sourceEventId: line.outputLineId, productionOrderId,
        cutOrderId: record.cutOrderId, cutOrderNo: record.cutOrderNo, spreadingOrderNo: line.sourceSpreadingSessionNo,
        garmentColor: line.garmentColor, size: line.sizeCode, materialId: materialKey(record), partId: line.partCode,
        actualPieceQty: line.actualCutPieceQty, direction: '正向', sourceStatus: '持续更新', occurredAt: line.createdAt,
      })
    }
    const latest = [...lines].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).at(-1)
    return [{ input: { productionOrderId, productionOrderNo: records[0].productionOrderNo, spuCode: records[0].spuCode,
      planQtyByColorSize, requirements: [...requirements.values()], facts: [...facts.values()] },
    sources: records, latestAt: latest?.createdAt || '', operator: latest?.createdBy || '' }]
  })
}
