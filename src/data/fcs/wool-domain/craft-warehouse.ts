import { woolSkuGenerationIssues } from './stage-rules.ts'
import { listFactoryReceipts, listFactoryReceivingSources, getHistoricalReceiptPosition } from '../factory-receiving.ts'
import { listFactoryInternalWarehouses, type ResolvedFactoryWarehouseLocation } from '../factory-internal-warehouse-locations.ts'
import { listEnabledSpecialCraftOperationDefinitions } from '../special-craft-operations.ts'
import type { FactoryWaitProcessStockItem, FactoryWaitHandoverStockItem, FactoryWarehouseInboundRecord, FactoryWarehouseOutboundRecord } from '../factory-internal-warehouse.ts'
import type { ProcessWarehouseRecord, ProcessHandoverRecord } from '../process-warehouse-domain.ts'
import { readWoolStore, getWoolStoreRevision } from './store.ts'
import { woolCraftOrderId } from './craft-flow.ts'

export const isWoolCraftWarehouseProjectionId = (id: string) => id.startsWith('WCR:')
export interface WoolCraftWarehouseProjection {
  waitProcessStockItems: FactoryWaitProcessStockItem[]
  waitHandoverStockItems: FactoryWaitHandoverStockItem[]
  inboundRecords: FactoryWarehouseInboundRecord[]
  outboundRecords: FactoryWarehouseOutboundRecord[]
  warehouseRecords: ProcessWarehouseRecord[]
  handoverRecords: ProcessHandoverRecord[]
  genericPieceInboundIds: Set<string>
  taskOrderIds: Set<string>
}

function outputPosition(factoryId: string): ResolvedFactoryWarehouseLocation {
  const warehouses = listFactoryInternalWarehouses(factoryId).filter(warehouse => warehouse.warehouseKind === 'WAIT_HANDOVER' && warehouse.isEnabled)
  const warehouse = warehouses.find(warehouse => warehouse.isDefault) ?? warehouses[0]
  if (warehouse) for (const area of warehouse.areaList.filter(area => area.status === 'AVAILABLE')) for (const shelf of area.shelfList.filter(shelf => shelf.status === 'AVAILABLE')) {
    const location = shelf.locationList.find(location => location.status === 'AVAILABLE')
    if (location) return { warehouse, area, shelf, location }
  }
  throw new Error('毛织工艺厂缺少启用的待交出库位，请主管维护本厂库位。')
}

let cachedProjection: WoolCraftWarehouseProjection | undefined
let cachedRevision = ''

// These locally constructed rows contain scalar fields and the listed string arrays.
// Copy their mutable leaves without repeatedly serializing every scalar through
// structuredClone. Callers still receive independent records, arrays and sets.
function copyProjection(source: WoolCraftWarehouseProjection): WoolCraftWarehouseProjection {
  const withPhotos = <T extends { photoList: string[] }>(row: T): T => ({ ...row, photoList: [...row.photoList] })
  return {
    waitProcessStockItems: source.waitProcessStockItems.map(withPhotos),
    waitHandoverStockItems: source.waitHandoverStockItems.map(withPhotos),
    inboundRecords: source.inboundRecords.map(withPhotos),
    outboundRecords: source.outboundRecords.map(withPhotos),
    warehouseRecords: source.warehouseRecords.map(row => ({ ...row,
      relatedFeiTicketIds: [...row.relatedFeiTicketIds],
      relatedHandoverRecordIds: [...row.relatedHandoverRecordIds],
      relatedReviewRecordIds: [...row.relatedReviewRecordIds],
    })),
    handoverRecords: source.handoverRecords.map(row => ({ ...row,
      evidenceUrls: [...row.evidenceUrls], relatedFeiTicketIds: [...row.relatedFeiTicketIds],
    })),
    genericPieceInboundIds: new Set(source.genericPieceInboundIds),
    taskOrderIds: new Set(source.taskOrderIds),
  }
}

/** Both warehouse screens read these projections; no derived stock is saved as a second fact source. */
export function buildWoolCraftWarehouseProjection(): WoolCraftWarehouseProjection {
  const revision = getWoolStoreRevision()
  if (cachedProjection && cachedRevision === revision) return copyProjection(cachedProjection)
  const store = readWoolStore(), receipts = listFactoryReceipts(), sources = new Map(listFactoryReceivingSources(undefined, true).map(source => [source.id, source]))
  const operations = new Map(listEnabledSpecialCraftOperationDefinitions().map(operation => [operation.craftCode, operation]))
  const result: WoolCraftWarehouseProjection = { waitProcessStockItems: [], waitHandoverStockItems: [], inboundRecords: [], outboundRecords: [], warehouseRecords: [], handoverRecords: [], genericPieceInboundIds: new Set(), taskOrderIds: new Set() }
  const receiptLines = receipts.flatMap(receipt => receipt.lines.map(line => ({ receipt, line })))
  for (const { line } of receiptLines) if (line.material.kind === 'WOOL_PIECE') result.genericPieceInboundIds.add(`FIN-${line.id}-1`)
  for (const order of Object.values(store.workOrders).filter(order => order.stage === 'KNITTING')) for (const piece of order.externalPieces) for (let index = 0; index < piece.routeNodes.length; index++) {
    const node = piece.routeNodes[index], taskId = woolCraftOrderId(order, piece, node), operation = operations.get(node.craftCode)
    result.taskOrderIds.add(taskId)
    if (!operation || !node.factoryId || piece.issues.length || woolSkuGenerationIssues(order, piece.skuCode).length) continue
    const plan = order.outputPlanLines.find(line => line.outputSkuCode === piece.skuCode)!
    const facts = store.craftRecords.filter(record => record.taskOrderId === taskId && record.pieceKey === piece.pieceKey && record.routeNodeId === node.sourceEntryId && record.woolOrderId === order.woolOrderId)
    const incoming = receiptLines.filter(({ receipt, line }) => {
      if (receipt.factoryId !== node.factoryId || line.material.kind !== 'WOOL_PIECE' || line.unit !== '片' || line.woolCraftOrderId !== taskId || line.woolPieceKey !== piece.pieceKey || line.woolRouteNodeId !== node.sourceEntryId || line.qty <= 0) return false
      const source = sources.get(line.sourceId)
      if (!source || source.targetFactoryId !== node.factoryId || !source.lines.some(original => original.id === line.sourceLineId && original.woolCraftOrderId === taskId && original.woolPieceKey === piece.pieceKey && original.woolRouteNodeId === node.sourceEntryId)) return false
      return store.handovers.some(record => record.handoverId === source.originalRecordId && record.pieceKey === piece.pieceKey && record.targetWorkOrderId === taskId && record.receiverId === node.factoryId)
        || store.craftRecords.some(record => record.action === 'HANDOVER' && record.recordId === source.originalRecordId && record.pieceKey === piece.pieceKey && record.targetOrderId === taskId && record.targetFactoryId === node.factoryId)
    }).sort((a, b) => a.receipt.receivedAt.localeCompare(b.receipt.receivedAt) || a.line.id.localeCompare(b.line.id))
    const reports = facts.filter(record => record.action === 'PROCESS_REPORT'), handovers = facts.filter(record => record.action === 'HANDOVER')
    const received = incoming.reduce((sum, row) => sum + row.line.qty, 0), processed = reports.reduce((sum, row) => sum + row.qty, 0), handed = handovers.reduce((sum, row) => sum + row.qty, 0)
    if (!received && !processed && !handed) continue
    if (processed > received || handed > processed) throw new Error(`毛织片 ${piece.pieceName} 的实际接收、加工及交出数量不一致，请核查原记录。`)
    const taskNo = `${order.woolOrderNo}-${piece.pieceInstanceId}-${node.sourceEntryId.split(':').at(-1)}`
    const next = piece.routeNodes[index + 1], linking = store.workOrders[order.pairedWorkOrderId]
    const targetId = next?.factoryId ?? linking.factoryId, targetName = next?.factoryName ?? linking.factoryName
    const receiverName = `${targetName} · ${next?.craftName ?? '缝盘加工单'}`
    const output = outputPosition(node.factoryId), warehouse = output.warehouse
    const location = { areaName: output.area.areaName, shelfNo: output.shelf.shelfNo, locationNo: output.location.locationNo, locationText: `${output.area.areaName} / ${output.shelf.shelfNo} / ${output.location.locationNo}` }
    const base = { factoryId: node.factoryId, factoryName: node.factoryName, factoryKind: warehouse.factoryKind, processCode: operation.processCode, processName: operation.processName, craftCode: node.craftCode, craftName: node.craftName, taskId, taskNo, productionOrderId: order.productionOrderId, productionOrderNo: order.productionOrderNo, itemKind: '裁片' as const, itemName: `${piece.pieceName} · 毛织片`, materialSku: piece.pieceKey, partName: piece.pieceName, fabricColor: plan.colorName, sizeCode: plan.sizeCode, unit: '片', photoList: order.styleImageUrl ? [order.styleImageUrl] : [] }
    const stockId = `WCR:WH:${taskId}`
    const batchAccepted = (recordId: string) => receiptLines.filter(({ line }) => sources.get(line.sourceId)?.originalRecordId === recordId && line.woolPieceKey === piece.pieceKey).reduce((sum, row) => sum + row.line.qty, 0)
    const accepted = handovers.reduce((sum, record) => sum + batchAccepted(record.recordId), 0)
    let consumed = processed
    for (const { receipt, line } of incoming) {
      const p = getHistoricalReceiptPosition(receipt.factoryId, line), issued = Math.min(consumed, line.qty)
      consumed -= issued
      const loc = { areaName: p.area.areaName, shelfNo: p.shelf.shelfNo, locationNo: p.location.locationNo, locationText: `${p.area.areaName} / ${p.shelf.shelfNo} / ${p.location.locationNo}` }
      const id = `WCR:IN:${line.id}`, wpId = `WCR:WP:${line.id}`
      const receiptBase = { ...base, warehouseId: p.warehouse.warehouseId, warehouseName: p.warehouse.warehouseName, ...loc, sourceRecordId: receipt.id, sourceRecordNo: line.sourceDocumentNo, sourceRecordType: 'HANDOVER_RECEIVE' as const, sourceObjectName: line.origin.name, expectedQty: line.qty, receivedQty: line.qty, differenceQty: 0, receiverName: receipt.operatorName, operatorUserId: receipt.operatorId, operatorFactoryId: receipt.factoryId, receivedAt: receipt.receivedAt }
      result.inboundRecords.push({ ...receiptBase, inboundRecordId: id, inboundRecordNo: id, generatedStockItemId: wpId, status: '已入库', remark: `原接收 ${receipt.id}；${line.material.batchNo}` })
      result.waitProcessStockItems.push({ ...receiptBase, stockItemId: wpId, sourceObjectKind: '上游工厂仓', issuedQty: issued, availableQty: line.qty - issued, status: issued === line.qty ? '已领用' : '已入待加工仓' })
    }
    // A report consumes received pieces in receipt order and creates the same quantity of processed pieces.
    let receiptIndex = 0, receiptConsumed = 0
    for (const report of reports) {
      let remaining = report.qty
      while (remaining > 0) {
        const { receipt, line } = incoming[receiptIndex], p = getHistoricalReceiptPosition(receipt.factoryId, line)
        const qty = Math.min(remaining, line.qty - receiptConsumed), id = `WCR:USE:${report.recordId}:${line.id}`
        result.outboundRecords.push({ ...base, ...location, warehouseId: p.warehouse.warehouseId, warehouseName: p.warehouse.warehouseName, areaName: p.area.areaName, shelfNo: p.shelf.shelfNo, locationNo: p.location.locationNo,
          outboundRecordId: id, outboundRecordNo: id, sourceTaskId: taskId, sourceTaskNo: taskNo, sourceRecordId: receipt.id, sourceRecordNo: line.sourceDocumentNo, sourceRecordType: 'HANDOVER_RECEIVE', sourceObjectName: line.origin.name,
          receiverKind: '加工任务', receiverName: taskNo, outboundQty: qty, unit: '片', operatorName: report.operatedBy, outboundAt: report.operatedAt, status: '已出库', remark: `加工投入；填报 ${report.recordId}` })
        remaining -= qty; receiptConsumed += qty
        if (receiptConsumed === line.qty) { receiptIndex++; receiptConsumed = 0 }
      }
      const id = `WCR:PRODUCED:${report.recordId}`
      result.inboundRecords.push({ ...base, ...location, warehouseId: warehouse.warehouseId, warehouseName: warehouse.warehouseName, inboundRecordId: id, inboundRecordNo: id, sourceRecordId: report.recordId, sourceRecordNo: report.recordId, sourceRecordType: 'PROCESS_REPORT', sourceObjectName: `${node.factoryName} · ${node.craftName}加工`, expectedQty: report.qty, receivedQty: report.qty, differenceQty: 0, receiverName: report.operatedBy, receivedAt: report.operatedAt, status: '已入库', generatedStockItemId: stockId, remark: '实际加工填报产出；进入本厂待交出仓' })
    }
    if (processed) result.waitHandoverStockItems.push({ ...base, ...location, warehouseId: warehouse.warehouseId, warehouseName: warehouse.warehouseName, stockItemId: stockId, completedQty: processed, lossQty: 0, waitHandoverQty: processed - handed, receiverKind: next ? '特殊工艺厂' : '其他接收方', receiverName, receiverWrittenQty: accepted, inTransitQty: handed - accepted, differenceQty: 0, status: processed > handed ? '待交出' : accepted === handed ? '已回写' : '已交出', remark: `沿技术包逐片路线交至 ${receiverName}` })
    const lastAt = facts.at(-1)?.operatedAt ?? incoming.at(-1)?.receipt.receivedAt ?? order.createdAt
    const common: ProcessWarehouseRecord = { warehouseRecordId: '', warehouseRecordNo: '', recordType: 'WAIT_PROCESS', craftType: 'SPECIAL_CRAFT', craftName: operation.operationName, workOrderId: taskId, workOrderNo: taskNo, sourceTaskOrderId: taskId, sourceWorkOrderNo: taskNo, sourceTaskId: taskId, sourceTaskNo: taskNo, sourceProductionOrderId: order.productionOrderId, sourceProductionOrderNo: order.productionOrderNo, sourceFactoryId: node.factoryId, sourceFactoryName: node.factoryName, targetFactoryId: node.factoryId, targetFactoryName: node.factoryName, targetWarehouseName: '', warehouseLocation: '', skuSummary: `${piece.pieceName} / ${plan.colorName} / ${plan.sizeCode}`, styleNo: order.styleNo, materialSku: piece.pieceKey, materialName: base.itemName, batchNo: '', objectType: '裁片', plannedObjectQty: plan.plannedQty * piece.pieceCountPerGarment, receivedObjectQty: received, availableObjectQty: received - processed, handedOverObjectQty: 0, writtenBackObjectQty: 0, diffObjectQty: 0, qtyUnit: '片', currentActionName: `待${operation.operationName}`, status: received > processed ? '已入仓' : '已领用', inboundAt: incoming[0]?.receipt.receivedAt ?? '', outboundAt: '', createdAt: order.createdAt, updatedAt: lastAt, relatedFeiTicketIds: [], relatedHandoverRecordIds: [], relatedReviewRecordIds: [], remark: '毛织片按实际收货和加工记录计算库存' }
    if (received) result.warehouseRecords.push({ ...common, warehouseRecordId: `WCR:PWP:${taskId}`, warehouseRecordNo: `WCR:PWP:${taskId}`, targetWarehouseName: getHistoricalReceiptPosition(node.factoryId, incoming[0].line).warehouse.warehouseName, warehouseLocation: [...new Set(incoming.map(row => getHistoricalReceiptPosition(node.factoryId, row.line).location.locationNo))].join('、') })
    if (processed) result.warehouseRecords.push({ ...common, warehouseRecordId: `WCR:PWH:${taskId}`, warehouseRecordNo: `WCR:PWH:${taskId}`, recordType: 'WAIT_HANDOVER', targetFactoryId: targetId, targetFactoryName: targetName, targetWarehouseName: warehouse.warehouseName, receiveWarehouseName: `${receiverName} · 待加工仓`, warehouseLocation: location.locationText, receivedObjectQty: processed, availableObjectQty: processed - handed, handedOverObjectQty: handed, writtenBackObjectQty: accepted, inTransitObjectQty: handed - accepted, status: processed > handed ? '待交出' : accepted === handed ? '全部交出' : '交出待收货', currentActionName: `交至${next?.craftName ?? '缝盘'}`, relatedHandoverRecordIds: handovers.map(record => record.recordId) })
    for (const record of handovers) {
      const receivedQty = batchAccepted(record.recordId), actualReceipts = receiptLines.filter(({ line }) => sources.get(line.sourceId)?.originalRecordId === record.recordId && line.woolPieceKey === piece.pieceKey)
      result.outboundRecords.push({ ...base, ...location, warehouseId: warehouse.warehouseId, warehouseName: warehouse.warehouseName, outboundRecordId: `WCR:OUT:${record.recordId}`, outboundRecordNo: record.recordId, sourceTaskId: taskId, sourceTaskNo: taskNo, handoverRecordId: record.recordId, handoverRecordNo: record.recordId, receiverKind: next ? '特殊工艺厂' : '其他接收方', receiverName, outboundQty: record.qty, receiverWrittenQty: receivedQty, inTransitQty: record.qty - receivedQty, differenceQty: 0, operatorName: record.operatedBy, outboundAt: record.operatedAt, status: receivedQty === record.qty ? '已回写' : '已出库', relatedWaitHandoverStockItemId: stockId, remark: `实际交出至 ${receiverName}；尚未实收 ${record.qty - receivedQty} 片` })
      result.handoverRecords.push({ handoverRecordId: record.recordId, handoverRecordNo: record.recordId, warehouseRecordId: `WCR:PWH:${taskId}`, craftType: 'SPECIAL_CRAFT', craftName: operation.operationName, workOrderId: taskId, workOrderNo: taskNo, sourceTaskOrderId: taskId, sourceWorkOrderNo: taskNo, sourceTaskId: taskId, sourceTaskNo: taskNo, sourceProductionOrderId: order.productionOrderId, sourceProductionOrderNo: order.productionOrderNo, handoverFactoryId: node.factoryId, handoverFactoryName: node.factoryName, receiveFactoryId: targetId, receiveFactoryName: targetName, receiveWarehouseName: `${receiverName} · 待加工仓`, objectType: '裁片', handoverObjectQty: record.qty, receiveObjectQty: receivedQty, diffObjectQty: 0, qtyUnit: '片', packageQty: 0, packageUnit: '', handoverPerson: record.operatedBy, operatorUserId: '', operatorFactoryId: node.factoryId, operatorRoleId: '', operatorRoleName: '', handoverAt: record.operatedAt, receivePerson: [...new Set(actualReceipts.map(row => row.receipt.operatorName))].join('、'), receiveAt: actualReceipts.at(-1)?.receipt.receivedAt ?? '', status: receivedQty === record.qty ? '全部交出' : '交出待收货', evidenceUrls: [], relatedReviewRecordId: '', relatedDifferenceRecordId: '', relatedFeiTicketIds: [], remark: `按实际接收计算；在途 ${record.qty - receivedQty} 片` })
    }
  }
  cachedProjection = result
  cachedRevision = getWoolStoreRevision()
  return copyProjection(result)
}
