import { listSkuArchives } from '../pcs-sku-archive-repository.ts'
import { loadSnapshot, persistSnapshot, nowText, normalize, sumLine, autoShipmentBarcode, getOrder, appendGarmentSpuReplacementToSnapshot } from './garment-spu-replacement-records.ts'
import type { GarmentReplacementStatus, GarmentWarehouseRelabelStatus, GarmentReplacementIdentityStage, GarmentReplacementIdentity, GarmentReplacementQuantitySplit, GarmentSpuReplacementLine, GarmentReplacementEvidence, GarmentIdentityMigrationAudit, GarmentSpuReplacementRecord, GarmentWarehouseInventoryBatch, GarmentWarehouseMovement, GarmentWarehouseRelabelTaskLine, GarmentWarehouseRelabelTask, GarmentReplacementStoreSnapshot, GarmentReplacementPreview, GarmentPrintRow, GarmentSalesOutboundGuard, GarmentSpuReplacementCreateInput } from './garment-spu-replacement-records.ts'
export type { GarmentReplacementStatus, GarmentWarehouseRelabelStatus, GarmentReplacementIdentityStage, GarmentReplacementIdentity, GarmentReplacementQuantitySplit, GarmentSpuReplacementLine, GarmentReplacementEvidence, GarmentIdentityMigrationAudit, GarmentSpuReplacementRecord, GarmentWarehouseInventoryBatch, GarmentWarehouseMovement, GarmentWarehouseRelabelTaskLine, GarmentWarehouseRelabelTask, GarmentReplacementStoreSnapshot, GarmentReplacementPreview, GarmentPrintRow, GarmentSalesOutboundGuard, GarmentSpuReplacementCreateInput } from './garment-spu-replacement-records.ts'
export { listGarmentSpuReplacements, listGarmentSpuReplacementsByProductionOrder, getGarmentSpuReplacement, getActiveGarmentReplacement, resolveEffectiveGarmentIdentity, resolveOriginalSkuForReturnedSku, completePostFactoryRelabel, isPostFactoryRelabelPending, appendGarmentIdentityMigrationAudits, listGarmentWarehouseRelabelTasks, getGarmentSalesOutboundGuard, assertGarmentSalesOutboundAllowed, getGarmentWarehouseRelabelTask, startGarmentWarehouseRelabelTask, completeGarmentWarehouseRelabelTask, listGarmentWarehouseInventoryBatches, listGarmentWarehouseMovements, getProductionOrderGarmentComposition, resetGarmentSpuReplacementStore } from './garment-spu-replacement-records.ts'

const QUANTITY_SPLITS_BY_SCOPE: Record<string, Record<string, GarmentReplacementQuantitySplit>> = {
  'PO-202603-0001::white': {
    S: { soldHistoryQty: 300, finishedWarehouseQty: 300, postFactoryQty: 0, remainingReturnQty: 400 },
    M: { soldHistoryQty: 400, finishedWarehouseQty: 350, postFactoryQty: 300, remainingReturnQty: 450 },
    L: { soldHistoryQty: 350, finishedWarehouseQty: 300, postFactoryQty: 250, remainingReturnQty: 600 },
    XL: { soldHistoryQty: 200, finishedWarehouseQty: 200, postFactoryQty: 150, remainingReturnQty: 450 },
  },
  'PO-202603-0002::grey': {
    S: { soldHistoryQty: 120, finishedWarehouseQty: 140, postFactoryQty: 90, remainingReturnQty: 150 },
    M: { soldHistoryQty: 180, finishedWarehouseQty: 200, postFactoryQty: 120, remainingReturnQty: 200 },
    L: { soldHistoryQty: 240, finishedWarehouseQty: 210, postFactoryQty: 150, remainingReturnQty: 200 },
    XL: { soldHistoryQty: 150, finishedWarehouseQty: 120, postFactoryQty: 80, remainingReturnQty: 150 },
  },
  'PO-202603-0003::white': {
    S: { soldHistoryQty: 300, finishedWarehouseQty: 280, postFactoryQty: 220, remainingReturnQty: 400 },
    M: { soldHistoryQty: 500, finishedWarehouseQty: 400, postFactoryQty: 300, remainingReturnQty: 600 },
    L: { soldHistoryQty: 550, finishedWarehouseQty: 350, postFactoryQty: 300, remainingReturnQty: 600 },
    XL: { soldHistoryQty: 350, finishedWarehouseQty: 250, postFactoryQty: 200, remainingReturnQty: 400 },
  },
  'PO-202603-0004::black': {
    S: { soldHistoryQty: 150, finishedWarehouseQty: 180, postFactoryQty: 120, remainingReturnQty: 250 },
    M: { soldHistoryQty: 250, finishedWarehouseQty: 260, postFactoryQty: 190, remainingReturnQty: 300 },
    L: { soldHistoryQty: 300, finishedWarehouseQty: 280, postFactoryQty: 220, remainingReturnQty: 300 },
    XL: { soldHistoryQty: 180, finishedWarehouseQty: 170, postFactoryQty: 100, remainingReturnQty: 250 },
  },
}

function identityFromSku(sku: ReturnType<typeof listSkuArchives>[number]): GarmentReplacementIdentity {
  return {
    spuCode: sku.styleCode,
    spuName: sku.styleName,
    skuCode: sku.skuCode,
    color: sku.colorName,
    size: sku.sizeName,
    imageUrl: sku.skuImageUrl,
    shipmentBarcode: autoShipmentBarcode(sku.barcode, sku.skuCode),
    retailBarcode: sku.barcode,
    suggestedRetailPrice: sku.suggestedRetailPrice,
    currency: sku.currency,
  }
}

function resolveTargetSku(input: { targetSpuCode: string; targetColor: string; size: string }) {
  const matches = listSkuArchives().filter((sku) =>
    sku.archiveStatus === 'ACTIVE'
    && sku.styleCode === input.targetSpuCode
    && normalize(sku.colorName) === normalize(input.targetColor)
    && normalize(sku.sizeName) === normalize(input.size),
  )
  if (matches.length !== 1) {
    throw new Error(`目标商品中心中 ${input.targetColor}/${input.size} 必须且只能找到一个有效 SKU，当前找到 ${matches.length} 个。`)
  }
  return matches[0]
}

function buildSplit(productionOrderId: string, color: string, size: string, originalDemandQty: number): GarmentReplacementQuantitySplit {
  const preset = QUANTITY_SPLITS_BY_SCOPE[`${productionOrderId}::${normalize(color)}`]?.[size]
  if (!preset) return { soldHistoryQty: 0, finishedWarehouseQty: 0, postFactoryQty: 0, remainingReturnQty: originalDemandQty }
  if (sumLine(preset) !== originalDemandQty) throw new Error(`${size} 码的已销售、成衣仓、后道工厂和剩余待回货数量与生产需求数量不守恒。`)
  return { ...preset }
}

export function buildGarmentReplacementPreview(input: {
  productionOrderId: string
  sourceColor: string
  targetSpuCode: string
  targetColor: string
}): GarmentReplacementPreview {
  const order = getOrder(input.productionOrderId)
  const sourceLines = order.demandSnapshot.skuLines.filter((line) => normalize(line.color) === normalize(input.sourceColor))
  if (!sourceLines.length) throw new Error('生产单中没有所选源颜色。')
  const lines = sourceLines.map((sourceLine, index): GarmentSpuReplacementLine => {
    const split = buildSplit(order.productionOrderId, input.sourceColor, sourceLine.size, sourceLine.qty)
    const replacementQty = split.finishedWarehouseQty + split.postFactoryQty + split.remainingReturnQty
    // 只对当前存在或未来待回货的实际数量要求目标尺码；纯销售历史数量不增加商品门禁。
    const targetSku = replacementQty > 0
      ? resolveTargetSku({ targetSpuCode: input.targetSpuCode, targetColor: input.targetColor, size: sourceLine.size })
      : null
    const source = fallbackSourceIdentity({
      spuCode: order.demandSnapshot.spuCode,
      spuName: order.demandSnapshot.spuName,
      skuCode: sourceLine.skuCode,
      color: sourceLine.color,
      size: sourceLine.size,
    })
    return {
      lineId: `GRP-PREVIEW-${index + 1}-${sourceLine.size}`,
      size: sourceLine.size,
      originalDemandQty: sourceLine.qty,
      ...split,
      source,
      target: targetSku ? identityFromSku(targetSku) : structuredClone(source),
      replacementRequired: replacementQty > 0,
      postRelabeledQty: 0,
    }
  })
  const totals = lines.reduce((result, line) => ({
    soldHistoryQty: result.soldHistoryQty + line.soldHistoryQty,
    finishedWarehouseQty: result.finishedWarehouseQty + line.finishedWarehouseQty,
    postFactoryQty: result.postFactoryQty + line.postFactoryQty,
    remainingReturnQty: result.remainingReturnQty + line.remainingReturnQty,
    originalDemandQty: result.originalDemandQty + line.originalDemandQty,
    replacementQty: result.replacementQty + line.finishedWarehouseQty + line.postFactoryQty + line.remainingReturnQty,
  }), { soldHistoryQty: 0, finishedWarehouseQty: 0, postFactoryQty: 0, remainingReturnQty: 0, originalDemandQty: 0, replacementQty: 0 })
  const firstTarget = lines.find((line) => line.replacementRequired)?.target
  if (!firstTarget) throw new Error('所选颜色当前只有已完成销售出库的历史数量，没有可执行替换的未售或待回货数量。')
  return {
    productionOrderId: order.productionOrderId,
    productionOrderNo: order.productionOrderNo,
    sourceSpuCode: order.demandSnapshot.spuCode,
    sourceSpuName: order.demandSnapshot.spuName,
    sourceColor: input.sourceColor,
    targetSpuCode: firstTarget.spuCode,
    targetSpuName: firstTarget.spuName,
    targetColor: input.targetColor,
    lines,
    totals,
  }
}

export function createGarmentSpuReplacement(input: GarmentSpuReplacementCreateInput): GarmentSpuReplacementRecord {
  if (!input.reason.trim()) throw new Error('必须填写 SPU 替换原因。')
  const preview = buildGarmentReplacementPreview(input)
  if (preview.sourceSpuCode === preview.targetSpuCode && normalize(preview.sourceColor) === normalize(preview.targetColor)) {
    throw new Error('目标 SPU 和颜色不能与源商品完全相同。')
  }
  const snapshot = loadSnapshot()
  const record = appendGarmentSpuReplacementToSnapshot(snapshot, input, preview)
  persistSnapshot(snapshot)
  return structuredClone(record)
}


export function fallbackSourceIdentity(input: {
  spuCode: string
  spuName: string
  skuCode: string
  color: string
  size: string
}): GarmentReplacementIdentity {
  const sku = listSkuArchives().find((item) => item.skuCode === input.skuCode)
  if (sku) return identityFromSku(sku)
  return {
    spuCode: input.spuCode,
    spuName: input.spuName,
    skuCode: input.skuCode,
    color: input.color,
    size: input.size,
    imageUrl: '/tshirt-sample.jpg',
    shipmentBarcode: autoShipmentBarcode('', input.skuCode),
    retailBarcode: input.skuCode,
    suggestedRetailPrice: 0,
    currency: 'IDR',
  }
}

export function listGarmentPrintRows(sourceId: string): GarmentPrintRow[] {
  const snapshot = loadSnapshot()
  const task = snapshot.relabelTasks.find((item) => item.relabelTaskId === sourceId || item.relabelTaskNo === sourceId)
  if (task) {
    return task.lines.map((line) => ({
      replacementId: task.replacementId,
      productionOrderId: task.productionOrderId,
      productionOrderNo: task.productionOrderNo,
      size: line.size,
      qty: line.qty,
      identity: structuredClone(line.target),
      originalIdentity: structuredClone(line.source),
    })).filter((line) => line.qty > 0)
  }

  const directRecord = snapshot.records.find((item) => item.replacementId === sourceId || item.replacementNo === sourceId)
  if (directRecord) {
    return directRecord.lines.map((line) => ({
      replacementId: directRecord.replacementId,
      productionOrderId: directRecord.productionOrderId,
      productionOrderNo: directRecord.productionOrderNo,
      size: line.size,
      qty: line.finishedWarehouseQty + line.postFactoryQty + line.remainingReturnQty,
      identity: structuredClone(line.target),
      originalIdentity: structuredClone(line.source),
    })).filter((line) => line.qty > 0)
  }

  const order = getOrder(sourceId)
  const orderRecords = snapshot.records.filter((item) => (
    item.productionOrderId === order.productionOrderId || item.productionOrderNo === order.productionOrderNo
  ))
  return order.demandSnapshot.skuLines.map((line) => ({
    replacementId: orderRecords.find((record) => normalize(record.sourceColor) === normalize(line.color))?.replacementId || '',
    productionOrderId: order.productionOrderId,
    productionOrderNo: order.productionOrderNo,
    size: line.size,
    qty: (() => {
      const replacementLine = orderRecords
        .find((record) => normalize(record.sourceColor) === normalize(line.color))
        ?.lines.find((item) => item.source.skuCode === line.skuCode || normalize(item.size) === normalize(line.size))
      return replacementLine
        ? replacementLine.finishedWarehouseQty + replacementLine.postFactoryQty + replacementLine.remainingReturnQty
        : line.qty
    })(),
    identity: (() => {
      const replacementLine = orderRecords
        .find((record) => normalize(record.sourceColor) === normalize(line.color))
        ?.lines.find((item) => item.source.skuCode === line.skuCode || normalize(item.size) === normalize(line.size))
      return replacementLine ? structuredClone(replacementLine.target) : fallbackSourceIdentity({
        spuCode: order.demandSnapshot.spuCode,
        spuName: order.demandSnapshot.spuName,
        skuCode: line.skuCode,
        color: line.color,
        size: line.size,
      })
    })(),
    originalIdentity: fallbackSourceIdentity({
      spuCode: order.demandSnapshot.spuCode,
      spuName: order.demandSnapshot.spuName,
      skuCode: line.skuCode,
      color: line.color,
      size: line.size,
    }),
  })).filter((line) => line.qty > 0)
}
