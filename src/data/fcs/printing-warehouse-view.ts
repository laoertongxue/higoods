import {
  listFactoryInternalWarehouses,
  listFactoryWarehouseNodeRows,
  listFactoryWarehouseStocktakeOrders,
  type FactoryInternalWarehouse,
  type FactoryWaitHandoverStockItem,
  type FactoryWaitProcessStockItem,
  type FactoryWarehouseInboundRecord,
  type FactoryWarehouseNodeRow,
  type FactoryWarehouseOutboundRecord,
  type FactoryWarehouseStocktakeOrder,
} from './factory-internal-warehouse.ts'
import {
  listProcessHandoverRecords,
  listWaitHandoverWarehouseRecords,
  listWaitProcessWarehouseRecords,
  type ProcessHandoverRecord,
  type ProcessWarehouseRecord,
} from './process-warehouse-domain.ts'

export interface PrintingWarehouseViewFilters {
  factoryId?: string
  status?: string
  keyword?: string
  timeRange?: '7D' | '30D' | 'ALL'
}

export interface PrintingWarehouseView {
  factoryIds: string[]
  taskIds: string[]
  printOrderIds: string[]
  handoverOrderIds: string[]
  waitProcessItems: FactoryWaitProcessStockItem[]
  waitHandoverItems: FactoryWaitHandoverStockItem[]
  inboundRecords: FactoryWarehouseInboundRecord[]
  outboundRecords: FactoryWarehouseOutboundRecord[]
  warehouses: FactoryInternalWarehouse[]
  nodeRows: FactoryWarehouseNodeRow[]
  stocktakeOrders: FactoryWarehouseStocktakeOrder[]
}

function normalizePrintWarehouseReceiptStatus(status: string): string {
  if (status === '有差异' || status === '收货差异') return '收货差异'
  if (status === '已回写' || status === '已全部交出' || status === '全部交出') return '全部交出'
  if (status === '部分交出') return '部分交出'
  if (status === '待回写' || status === '待交出' || status === '已出库') return '交出待收货'
  return status
}

function normalizePrintWarehouseReference(value: string | undefined): string | undefined {
  return value
    ?.replaceAll('待回写', '交出待收货')
    .replaceAll('已回写', '全部交出')
    .replaceAll('有差异', '收货差异')
}

function parseDateValue(value: string | undefined): number {
  if (!value) return 0
  const time = new Date(value.includes('T') ? value : value.replace(' ', 'T')).getTime()
  return Number.isFinite(time) ? time : 0
}

function withinTimeRange(value: string | undefined, timeRange: PrintingWarehouseViewFilters['timeRange']): boolean {
  if (!timeRange || timeRange === 'ALL') return true
  const time = parseDateValue(value)
  if (!time) return true
  const range = timeRange === '7D' ? 7 * 24 * 3600 * 1000 : 30 * 24 * 3600 * 1000
  return Date.now() - time <= range
}

function matchesKeyword(tokens: Array<string | undefined>, keyword: string): boolean {
  if (!keyword) return true
  return tokens.some((token) => token?.toLowerCase().includes(keyword))
}

function matchesStatus(status: string | undefined, filterStatus: string | undefined): boolean {
  if (!filterStatus || filterStatus === 'ALL') return true
  return status === filterStatus
}

function mapWaitProcessRecord(record: ProcessWarehouseRecord): FactoryWaitProcessStockItem {
  return {
    stockItemId: record.warehouseRecordId,
    warehouseId: `${record.targetFactoryId}-PRINT-WAIT-PROCESS`,
    factoryId: record.targetFactoryId,
    factoryName: record.targetFactoryName,
    factoryKind: 'CENTRAL_PRINT',
    warehouseName: record.targetWarehouseName,
    processCode: 'PROC_PRINT',
    processName: '印花',
    craftCode: 'PRINT',
    craftName: record.craftName,
    itemKind: record.objectType === '裁片' ? '裁片' : '面料',
    itemName: record.skuSummary || record.materialName,
    materialSku: record.materialSku,
    fabricRollNo: record.batchNo,
    unit: record.qtyUnit,
    areaName: '印花待加工区',
    shelfNo: record.warehouseLocation.split('-').slice(0, 2).join('-') || record.warehouseLocation,
    locationNo: record.warehouseLocation,
    locationText: record.warehouseLocation,
    photoList: [],
    remark: record.remark,
    sourceRecordId: record.sourceWorkOrderId,
    sourceRecordNo: record.warehouseRecordNo,
    sourceRecordType: 'HANDOVER_RECEIVE',
    sourceObjectKind: '印花厂',
    sourceObjectName: record.sourceWorkOrderNo,
    taskId: record.sourceTaskId,
    taskNo: [record.sourceWorkOrderNo, record.sourceTaskNo].filter(Boolean).join(' / '),
    productionOrderId: record.sourceProductionOrderId,
    productionOrderNo: record.sourceProductionOrderNo,
    expectedQty: record.plannedObjectQty,
    receivedQty: record.receivedObjectQty,
    differenceQty: record.diffObjectQty,
    receiverName: record.targetFactoryName,
    receivedAt: record.inboundAt,
    status: record.status === '有差异' ? '差异待处理' : '已入待加工仓',
  }
}

function mapWaitHandoverRecord(record: ProcessWarehouseRecord): FactoryWaitHandoverStockItem {
  return {
    stockItemId: record.warehouseRecordId,
    warehouseId: `${record.targetFactoryId}-PRINT-WAIT-HANDOVER`,
    factoryId: record.targetFactoryId,
    factoryName: record.targetFactoryName,
    factoryKind: 'CENTRAL_PRINT',
    warehouseName: record.targetWarehouseName,
    processCode: 'PROC_PRINT',
    processName: '印花',
    craftCode: 'PRINT',
    craftName: record.craftName,
    itemKind: record.objectType === '裁片' ? '裁片' : '面料',
    itemName: record.skuSummary || record.materialName,
    materialSku: record.materialSku,
    fabricRollNo: record.batchNo,
    unit: record.qtyUnit,
    areaName: '印花待交出区',
    shelfNo: record.warehouseLocation.split('-').slice(0, 2).join('-') || record.warehouseLocation,
    locationNo: record.warehouseLocation,
    locationText: record.warehouseLocation,
    photoList: [],
    remark: record.remark,
    taskId: record.sourceTaskId,
    taskNo: [record.sourceWorkOrderNo, record.sourceTaskNo].filter(Boolean).join(' / '),
    productionOrderId: record.sourceProductionOrderId,
    productionOrderNo: record.sourceProductionOrderNo,
    completedQty: record.plannedObjectQty,
    lossQty: 0,
    waitHandoverQty: record.availableObjectQty,
    receiverKind: '裁床厂',
    receiverName: record.targetWarehouseName,
    handoverRecordId: normalizePrintWarehouseReference(record.relatedHandoverRecordIds[0]) || record.relatedHandoverRecordIds[0],
    handoverRecordNo: normalizePrintWarehouseReference(record.relatedHandoverRecordIds[0]) || record.relatedHandoverRecordIds[0],
    receiverWrittenQty: record.writtenBackObjectQty,
    differenceQty: record.diffObjectQty,
    status: normalizePrintWarehouseReceiptStatus(record.status),
  }
}

function mapInboundRecord(record: ProcessWarehouseRecord): FactoryWarehouseInboundRecord {
  const item = mapWaitProcessRecord(record)
  return {
    inboundRecordId: record.warehouseRecordId,
    inboundRecordNo: record.warehouseRecordNo,
    warehouseId: item.warehouseId,
    warehouseName: record.targetWarehouseName,
    factoryId: record.targetFactoryId,
    factoryName: record.targetFactoryName,
    factoryKind: 'CENTRAL_PRINT',
    processCode: 'PROC_PRINT',
    processName: '印花',
    craftCode: 'PRINT',
    craftName: record.craftName,
    sourceRecordId: record.sourceWorkOrderId,
    sourceRecordNo: record.sourceWorkOrderNo,
    sourceRecordType: 'HANDOVER_RECEIVE',
    sourceObjectName: record.sourceWorkOrderNo,
    taskId: record.sourceTaskId,
    taskNo: record.sourceTaskNo,
    itemKind: record.objectType === '裁片' ? '裁片' : '面料',
    itemName: record.skuSummary || record.materialName,
    materialSku: record.materialSku,
    fabricRollNo: record.batchNo,
    expectedQty: record.plannedObjectQty,
    receivedQty: record.receivedObjectQty,
    differenceQty: record.diffObjectQty,
    unit: record.qtyUnit,
    receiverName: record.targetFactoryName,
    receivedAt: record.inboundAt,
    areaName: item.areaName,
    shelfNo: item.shelfNo,
    locationNo: item.locationNo,
    status: record.status === '有差异' ? '差异待处理' : '已入库',
    photoList: [],
    generatedStockItemId: record.warehouseRecordId,
    remark: record.remark,
  }
}

function mapOutboundRecord(record: ProcessHandoverRecord): FactoryWarehouseOutboundRecord {
  return {
    outboundRecordId: normalizePrintWarehouseReference(record.handoverRecordId) || record.handoverRecordId,
    outboundRecordNo: normalizePrintWarehouseReference(record.handoverRecordNo) || record.handoverRecordNo,
    warehouseId: record.warehouseRecordId,
    warehouseName: record.receiveWarehouseName,
    factoryId: record.handoverFactoryId,
    factoryName: record.handoverFactoryName,
    factoryKind: 'CENTRAL_PRINT',
    processCode: 'PROC_PRINT',
    processName: '印花',
    craftCode: 'PRINT',
    craftName: record.craftName,
    sourceTaskId: record.sourceTaskId,
    sourceTaskNo: record.sourceTaskNo,
    handoverRecordId: normalizePrintWarehouseReference(record.handoverRecordId) || record.handoverRecordId,
    handoverRecordNo: normalizePrintWarehouseReference(record.handoverRecordNo) || record.handoverRecordNo,
    receiverKind: '裁床厂',
    receiverName: record.receiveFactoryName || record.receiveWarehouseName,
    itemKind: record.objectType === '裁片' ? '裁片' : '面料',
    itemName: record.sourceWorkOrderNo,
    outboundQty: record.handoverObjectQty,
    receiverWrittenQty: record.receiveObjectQty,
    differenceQty: record.diffObjectQty,
    unit: record.qtyUnit,
    operatorName: record.handoverPerson,
    outboundAt: record.handoverAt,
    status: normalizePrintWarehouseReceiptStatus(record.status),
    photoList: [],
    relatedWaitHandoverStockItemId: record.warehouseRecordId,
    remark: record.remark,
  }
}

export function getPrintingWarehouseView(filters: PrintingWarehouseViewFilters = {}): PrintingWarehouseView {
  const keyword = filters.keyword?.trim().toLowerCase() || ''

  const byFactory = (factoryId: string): boolean => !filters.factoryId || factoryId === filters.factoryId

  const waitProcessRecords = listWaitProcessWarehouseRecords({ craftType: 'PRINT' }).filter((item) =>
    byFactory(item.targetFactoryId)
    && matchesStatus(item.status, filters.status)
    && matchesKeyword([item.warehouseRecordNo, item.sourceWorkOrderNo, item.sourceTaskNo, item.batchNo, item.skuSummary], keyword)
    && withinTimeRange(item.inboundAt, filters.timeRange),
  )
  const waitHandoverRecords = listWaitHandoverWarehouseRecords({ craftType: 'PRINT' }).filter((item) =>
    byFactory(item.targetFactoryId)
    && matchesStatus(item.status, filters.status)
    && matchesKeyword([item.warehouseRecordNo, item.sourceWorkOrderNo, item.sourceTaskNo, item.batchNo, item.skuSummary], keyword),
  )
  const handoverRecords = listProcessHandoverRecords({ craftType: 'PRINT' }).filter((item) =>
    byFactory(item.handoverFactoryId)
    && matchesStatus(item.status, filters.status)
    && matchesKeyword([item.handoverRecordNo, item.sourceWorkOrderNo, item.sourceTaskNo], keyword)
    && withinTimeRange(item.handoverAt, filters.timeRange),
  )

  const waitProcessItems = waitProcessRecords.map(mapWaitProcessRecord)
  const waitHandoverItems = waitHandoverRecords.map(mapWaitHandoverRecord)
  const inboundRecords = waitProcessRecords.map(mapInboundRecord)
  const outboundRecords = handoverRecords.map(mapOutboundRecord)
  const taskIds = new Set([
    ...waitProcessRecords.map((record) => record.sourceTaskId),
    ...waitHandoverRecords.map((record) => record.sourceTaskId),
    ...handoverRecords.map((record) => record.sourceTaskId),
  ].filter(Boolean))
  const factoryIds = new Set([
    ...waitProcessRecords.map((record) => record.targetFactoryId),
    ...waitHandoverRecords.map((record) => record.targetFactoryId),
    ...handoverRecords.map((record) => record.handoverFactoryId),
  ].filter(Boolean))
  const printOrderIds = new Set([
    ...waitProcessRecords.map((record) => record.sourceWorkOrderId),
    ...waitHandoverRecords.map((record) => record.sourceWorkOrderId),
    ...handoverRecords.map((record) => record.sourceWorkOrderId),
  ].filter(Boolean))
  const handoverOrderIds = new Set(outboundRecords.map((record) => record.handoverOrderId).filter(Boolean) as string[])

  const visibleFactoryIds = new Set([
    ...Array.from(factoryIds),
    ...waitProcessItems.map((item) => item.factoryId),
    ...waitHandoverItems.map((item) => item.factoryId),
    ...inboundRecords.map((item) => item.factoryId),
    ...outboundRecords.map((item) => item.factoryId),
  ].filter((factoryId) => byFactory(factoryId)))

  return {
    factoryIds: Array.from(visibleFactoryIds),
    taskIds: Array.from(taskIds),
    printOrderIds: Array.from(printOrderIds),
    handoverOrderIds: Array.from(handoverOrderIds),
    waitProcessItems,
    waitHandoverItems,
    inboundRecords,
    outboundRecords,
    warehouses: listFactoryInternalWarehouses().filter((warehouse) => visibleFactoryIds.has(warehouse.factoryId)),
    nodeRows: Array.from(visibleFactoryIds).flatMap((factoryId) => listFactoryWarehouseNodeRows(factoryId)),
    stocktakeOrders: listFactoryWarehouseStocktakeOrders().filter((order) => visibleFactoryIds.has(order.factoryId)),
  }
}
