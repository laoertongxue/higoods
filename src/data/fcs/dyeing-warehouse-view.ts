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
import { listDyeWorkOrders } from './dyeing-task-domain.ts'
import {
  listProcessHandoverRecords,
  listWaitHandoverWarehouseRecords,
  listWaitProcessWarehouseRecords,
  type ProcessHandoverRecord,
  type ProcessWarehouseRecord,
} from './process-warehouse-domain.ts'

export interface DyeingWarehouseViewFilters {
  factoryId?: string
  status?: string
  keyword?: string
  timeRange?: '7D' | '30D' | 'ALL'
}

export interface DyeingWarehouseView {
  factoryIds: string[]
  taskIds: string[]
  dyeOrderIds: string[]
  handoverOrderIds: string[]
  waitProcessItems: FactoryWaitProcessStockItem[]
  waitHandoverItems: FactoryWaitHandoverStockItem[]
  inboundRecords: FactoryWarehouseInboundRecord[]
  outboundRecords: FactoryWarehouseOutboundRecord[]
  warehouses: FactoryInternalWarehouse[]
  nodeRows: FactoryWarehouseNodeRow[]
  stocktakeOrders: FactoryWarehouseStocktakeOrder[]
}

function parseDateValue(value: string | undefined): number {
  if (!value) return 0
  const time = new Date(value.includes('T') ? value : value.replace(' ', 'T')).getTime()
  return Number.isFinite(time) ? time : 0
}

function withinTimeRange(value: string | undefined, timeRange: DyeingWarehouseViewFilters['timeRange']): boolean {
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
    warehouseId: `${record.targetFactoryId}-DYE-WAIT-PROCESS`,
    factoryId: record.targetFactoryId,
    factoryName: record.targetFactoryName,
    factoryKind: 'CENTRAL_DYE',
    warehouseName: record.targetWarehouseName,
    processCode: 'PROC_DYE',
    processName: '染色',
    craftCode: 'DYE',
    craftName: record.craftName,
    itemKind: '面料',
    itemName: record.skuSummary || record.materialName,
    materialSku: record.materialSku,
    fabricRollNo: record.batchNo,
    unit: record.qtyUnit,
    areaName: '染色待加工区',
    shelfNo: record.warehouseLocation.split('-').slice(0, 2).join('-') || record.warehouseLocation,
    locationNo: record.warehouseLocation,
    locationText: record.warehouseLocation,
    photoList: [],
    remark: record.remark,
    sourceRecordId: record.sourceWorkOrderId,
    sourceRecordNo: record.warehouseRecordNo,
    sourceRecordType: 'HANDOVER_RECEIVE',
    sourceObjectKind: '染厂',
    sourceObjectName: record.sourceWorkOrderNo,
    taskId: record.sourceTaskId,
    taskNo: record.sourceTaskNo,
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
    warehouseId: `${record.targetFactoryId}-DYE-WAIT-HANDOVER`,
    factoryId: record.targetFactoryId,
    factoryName: record.targetFactoryName,
    factoryKind: 'CENTRAL_DYE',
    warehouseName: record.targetWarehouseName,
    processCode: 'PROC_DYE',
    processName: '染色',
    craftCode: 'DYE',
    craftName: record.craftName,
    itemKind: '面料',
    itemName: record.skuSummary || record.materialName,
    materialSku: record.materialSku,
    fabricRollNo: record.batchNo,
    unit: record.qtyUnit,
    areaName: '染色待交出区',
    shelfNo: record.warehouseLocation.split('-').slice(0, 2).join('-') || record.warehouseLocation,
    locationNo: record.warehouseLocation,
    locationText: record.warehouseLocation,
    photoList: [],
    remark: record.remark,
    taskId: record.sourceTaskId,
    taskNo: record.sourceTaskNo,
    productionOrderId: record.sourceProductionOrderId,
    productionOrderNo: record.sourceProductionOrderNo,
    completedQty: record.plannedObjectQty,
    lossQty: 0,
    waitHandoverQty: record.availableObjectQty,
    receiverKind: '裁床厂',
    receiverName: record.targetWarehouseName,
    handoverRecordId: record.relatedHandoverRecordIds[0],
    handoverRecordNo: record.relatedHandoverRecordIds[0],
    receiverWrittenQty: record.writtenBackObjectQty,
    differenceQty: record.diffObjectQty,
    status: record.status === '有差异' ? '差异' : record.status === '已回写' ? '已回写' : record.status === '已全部交出' ? '已交出' : '待交出',
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
    factoryKind: 'CENTRAL_DYE',
    processCode: 'PROC_DYE',
    processName: '染色',
    craftCode: 'DYE',
    craftName: record.craftName,
    sourceRecordId: record.sourceWorkOrderId,
    sourceRecordNo: record.sourceWorkOrderNo,
    sourceRecordType: 'HANDOVER_RECEIVE',
    sourceObjectName: record.sourceWorkOrderNo,
    taskId: record.sourceTaskId,
    taskNo: record.sourceTaskNo,
    itemKind: '面料',
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
    outboundRecordId: record.handoverRecordId,
    outboundRecordNo: record.handoverRecordNo,
    warehouseId: record.warehouseRecordId,
    warehouseName: record.receiveWarehouseName,
    factoryId: record.handoverFactoryId,
    factoryName: record.handoverFactoryName,
    factoryKind: 'CENTRAL_DYE',
    processCode: 'PROC_DYE',
    processName: '染色',
    craftCode: 'DYE',
    craftName: record.craftName,
    sourceTaskId: record.sourceTaskId,
    sourceTaskNo: record.sourceTaskNo,
    handoverRecordId: record.handoverRecordId,
    handoverRecordNo: record.handoverRecordNo,
    receiverKind: '裁床厂',
    receiverName: record.receiveFactoryName || record.receiveWarehouseName,
    itemKind: '面料',
    itemName: record.sourceWorkOrderNo,
    outboundQty: record.handoverObjectQty,
    receiverWrittenQty: record.receiveObjectQty,
    differenceQty: record.diffObjectQty,
    unit: record.qtyUnit,
    operatorName: record.handoverPerson,
    outboundAt: record.handoverAt,
    status: record.status === '有差异' ? '差异' : record.status === '已回写' ? '已回写' : '已出库',
    photoList: [],
    relatedWaitHandoverStockItemId: record.warehouseRecordId,
    remark: record.remark,
  }
}

export function getDyeingWarehouseView(filters: DyeingWarehouseViewFilters = {}): DyeingWarehouseView {
  const workOrders = listDyeWorkOrders()
  const taskIds = new Set(workOrders.map((order) => order.taskId))
  const factoryIds = new Set(workOrders.map((order) => order.dyeFactoryId))
  const dyeOrderIds = new Set(workOrders.map((order) => order.dyeOrderId))
  const handoverOrderIds = new Set(workOrders.map((order) => order.handoverOrderId).filter(Boolean) as string[])
  const keyword = filters.keyword?.trim().toLowerCase() || ''

  const byFactory = (factoryId: string): boolean => !filters.factoryId || factoryId === filters.factoryId

  const waitProcessRecords = listWaitProcessWarehouseRecords({ craftType: 'DYE' }).filter((item) =>
    byFactory(item.targetFactoryId)
    && matchesStatus(item.status, filters.status)
    && matchesKeyword([item.warehouseRecordNo, item.sourceWorkOrderNo, item.sourceTaskNo, item.batchNo, item.skuSummary], keyword)
    && withinTimeRange(item.inboundAt, filters.timeRange),
  )
  const waitHandoverRecords = listWaitHandoverWarehouseRecords({ craftType: 'DYE' }).filter((item) =>
    byFactory(item.targetFactoryId)
    && matchesStatus(item.status, filters.status)
    && matchesKeyword([item.warehouseRecordNo, item.sourceWorkOrderNo, item.sourceTaskNo, item.batchNo, item.skuSummary], keyword),
  )
  const handoverRecords = listProcessHandoverRecords({ craftType: 'DYE' }).filter((item) =>
    byFactory(item.handoverFactoryId)
    && matchesStatus(item.status, filters.status)
    && matchesKeyword([item.handoverRecordNo, item.sourceWorkOrderNo, item.sourceTaskNo], keyword)
    && withinTimeRange(item.handoverAt, filters.timeRange),
  )

  const waitProcessItems = waitProcessRecords.map(mapWaitProcessRecord)
  const waitHandoverItems = waitHandoverRecords.map(mapWaitHandoverRecord)
  const inboundRecords = waitProcessRecords.map(mapInboundRecord)
  const outboundRecords = handoverRecords.map(mapOutboundRecord)

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
    dyeOrderIds: Array.from(dyeOrderIds),
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
