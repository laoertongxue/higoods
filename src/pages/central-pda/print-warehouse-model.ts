import { getPrintingWarehouseView } from '../../data/fcs/printing-warehouse-view.ts'
import { listFactoryInternalWarehouses } from '../../data/fcs/factory-internal-warehouse.ts'
import { listFactoryReceipts, listFactoryReceivingSources, listFactoryMaterialUses, convertReceiptQuantity } from '../../data/fcs/factory-receiving.ts'
import { findPdaHandoverRecord } from '../../data/fcs/pda-handover-events.ts'
import { getPrintingWorkOrderById } from '../../data/fcs/printing-task-domain.ts'
import { getFactoryMasterRecordById } from '../../data/fcs/factory-master-store.ts'
import { isCentralPdaFactory } from '../../data/fcs/pda-experience-scope.ts'
import { withFactoryProcessStaticRead } from '../../data/fcs/factory-process-storage.ts'
import { printingEventTimestamp } from '../../data/fcs/printing-statistics.ts'

/** Read-only physical presentation. Original Web quantities and record ownership remain unchanged. */
export function readCentralPrintWarehouse(factoryId: string) {
  const factory = getFactoryMasterRecordById(factoryId)
  if (!factory || !isCentralPdaFactory(factory)) throw new Error('PRINT_centralOnly')
  return withFactoryProcessStaticRead(() => {
    const view = getPrintingWarehouseView({ factoryId })
    const warehouses = listFactoryInternalWarehouses().filter(warehouse => warehouse.factoryId === factoryId)
    const positions = warehouses.flatMap(warehouse => warehouse.areaList.flatMap(area =>
      area.shelfList.flatMap(shelf => shelf.locationList.map(location => ({
        key: JSON.stringify([warehouse.warehouseId, location.locationId]),
        areaKey: JSON.stringify([warehouse.warehouseId, area.areaId]),
        warehouse, area, shelf, location,
      })))))
    const receipts = listFactoryReceipts(), sources = listFactoryReceivingSources(), uses = listFactoryMaterialUses()
    const lines = new Map(receipts.flatMap(receipt => receipt.lines.map(line => [line.id, { receipt, line }] as const)))
    const input = view.waitProcessItems.flatMap(stock => {
      const saved = lines.get(stock.receiptLineId)
      if (stock.rolls.length) return stock.rolls.filter(roll => roll.remainingQty > 0).map(roll => {
        const actual = saved?.line.rolls?.find(row => row.barcode === roll.barcode)
        const position = positions.find(row => row.warehouse.warehouseId === actual?.warehouseId && row.location.locationId === actual?.locationId)
        return { key: JSON.stringify([stock.receiptLineId, roll.barcode]), stock, barcode: roll.barcode,
          quantity: roll.remainingQty, position, recordedLocation: roll.location }
      })
      const matches = positions.filter(row => row.warehouse.warehouseId === stock.warehouseId
        && row.area.areaName === stock.areaName && row.shelf.shelfNo === stock.shelfNo && row.location.locationNo === stock.locationNo)
      return [{ key: stock.stockItemId, stock, barcode: stock.fabricRollNo || '', quantity: stock.availableQty,
        position: matches.length === 1 ? matches[0] : undefined, recordedLocation: stock.locationText }]
    })
    const output = view.waitHandoverItems.map(stock => {
      const matches = positions.filter(row => row.warehouse.warehouseId === stock.warehouseId
        && row.area.areaName === stock.areaName && row.shelf.shelfNo === stock.shelfNo && row.location.locationNo === stock.locationNo)
      return { key: stock.stockItemId, stock, barcode: stock.fabricRollNo || '', quantity: stock.waitHandoverQty,
        position: matches.length === 1 ? matches[0] : undefined, recordedLocation: stock.locationText }
    })
    // Same original Web remainder, kept separate from measured physical rolls.
    const pendingOutput = view.printOrderIds.flatMap(id => {
      const order = getPrintingWorkOrderById(id)
      if (!order) return []
      const quantity = Math.max(0, order.output.completedQty - order.barcodes
        .filter(roll => roll.quantityConfirmed === true || !!roll.handoverRecordId).reduce((sum, roll) => sum + roll.lengthY, 0))
      return quantity > 0 ? [{ order, quantity }] : []
    })
    const usageRecords = view.usageRecords.map(row => {
      const use = uses.find(use => use.lines.some(line => use.id + ':' + line.receiptLineId + ':' + (line.barcode || '') === row.id))
      const order = row.workOrderId ? getPrintingWorkOrderById(row.workOrderId) : undefined
      const operatorUserId = order?.operationLogs.find(log => !!log.confirmationId && 'CENTRAL-PRINT-' + log.confirmationId === use?.id)?.operatorUserId
      return { ...row, operatorUserId }
    }).sort((a, b) => (printingEventTimestamp(b.at, b.factoryId) ?? 0) - (printingEventTimestamp(a.at, a.factoryId) ?? 0))
    const inboundRecords = view.inboundRecords.map(row => ({ ...row,
      receiverUserId: lines.get(row.inboundRecordId)?.receipt.operatorId }))
      .sort((a, b) => (printingEventTimestamp(b.receivedAt, b.factoryId) ?? 0) - (printingEventTimestamp(a.receivedAt, a.factoryId) ?? 0))
    const outboundRecords = view.outboundRecords.map(row => {
      const record = row.handoverRecordId ? findPdaHandoverRecord(row.handoverRecordId) : undefined
      const aliases = new Set([row.handoverRecordId, record?.recordId, record?.handoverRecordId].filter(Boolean))
      const sourceIds = new Set(sources.filter(source => !!source.originalRecordId && aliases.has(source.originalRecordId)).map(source => source.id))
      const actualReceipts = receipts.flatMap(receipt => receipt.lines.filter(line => sourceIds.has(line.sourceId)).map(line => ({
        id: line.id, quantity: convertReceiptQuantity(line.businessQty ?? line.qty, line.businessUnit || line.unit, row.unit),
        rawQuantity: line.businessQty ?? line.qty, rawUnit: line.businessUnit || line.unit,
        by: receipt.operatorName, userId: receipt.operatorId, at: receipt.receivedAt,
      })))
      const order = row.sourceRecordId ? getPrintingWorkOrderById(row.sourceRecordId) : undefined
      return { ...row, targetId: order?.receivingTargetId || '', senderUserId: record?.factorySubmittedByUserId || row.operatorUserId,
        actualBy: record?.receiverWrittenBy,
        actualAt: record?.receiverWrittenAt || record?.warehouseWrittenAt, actualReceipts }
    }).sort((a, b) => (printingEventTimestamp(b.outboundAt, b.factoryId) ?? 0) - (printingEventTimestamp(a.outboundAt, a.factoryId) ?? 0))
    return { ...view, warehouses, positions, input, output, pendingOutput, inboundRecords, outboundRecords, usageRecords }
  })
}
export type CentralPrintWarehouse = ReturnType<typeof readCentralPrintWarehouse>
