import {
  listFactoryInternalWarehouses,
  listFactoryWaitHandoverStockItems,
  listFactoryWaitProcessStockItems,
  listFactoryWarehouseInboundRecords,
  listFactoryWarehouseNodeRows,
  listFactoryWarehouseOutboundRecords,
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

function isDyeingProcess(processCode?: string, processName?: string): boolean {
  const code = (processCode || '').toUpperCase()
  const name = processName || ''
  return code === 'DYE' || code === 'PROC_DYE' || code.includes('DYE') || name.includes('染色')
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

function shouldKeepByTaskOrProcess(input: {
  taskId?: string
  processCode?: string
  processName?: string
}, taskIds: Set<string>): boolean {
  if (input.taskId && taskIds.has(input.taskId)) return true
  return !input.taskId && isDyeingProcess(input.processCode, input.processName)
}

export function getDyeingWarehouseView(filters: DyeingWarehouseViewFilters = {}): DyeingWarehouseView {
  const workOrders = listDyeWorkOrders()
  const taskIds = new Set(workOrders.map((order) => order.taskId))
  const factoryIds = new Set(workOrders.map((order) => order.dyeFactoryId))
  const dyeOrderIds = new Set(workOrders.map((order) => order.dyeOrderId))
  const handoverOrderIds = new Set(workOrders.map((order) => order.handoverOrderId).filter(Boolean) as string[])
  const keyword = filters.keyword?.trim().toLowerCase() || ''

  const byFactory = (factoryId: string): boolean => !filters.factoryId || factoryId === filters.factoryId

  const waitProcessItems = listFactoryWaitProcessStockItems().filter((item) =>
    byFactory(item.factoryId)
    && shouldKeepByTaskOrProcess(item, taskIds)
    && matchesStatus(item.status, filters.status)
    && matchesKeyword([item.sourceRecordNo, item.taskNo, item.feiTicketNo, item.transferBagNo, item.fabricRollNo, item.itemName], keyword)
    && withinTimeRange(item.receivedAt, filters.timeRange),
  )
  const waitHandoverItems = listFactoryWaitHandoverStockItems().filter((item) =>
    byFactory(item.factoryId)
    && shouldKeepByTaskOrProcess(item, taskIds)
    && matchesStatus(item.status, filters.status)
    && matchesKeyword([item.taskNo, item.handoverOrderNo, item.handoverRecordNo, item.feiTicketNo, item.transferBagNo, item.fabricRollNo, item.itemName], keyword),
  )
  const inboundRecords = listFactoryWarehouseInboundRecords().filter((item) =>
    byFactory(item.factoryId)
    && shouldKeepByTaskOrProcess(item, taskIds)
    && matchesStatus(item.status, filters.status)
    && matchesKeyword([item.inboundRecordNo, item.sourceRecordNo, item.taskNo, item.feiTicketNo, item.transferBagNo, item.fabricRollNo, item.itemName], keyword)
    && withinTimeRange(item.receivedAt, filters.timeRange),
  )
  const outboundRecords = listFactoryWarehouseOutboundRecords().filter((item) =>
    byFactory(item.factoryId)
    && shouldKeepByTaskOrProcess(
      { taskId: item.sourceTaskId, processCode: item.processCode, processName: item.processName },
      taskIds,
    )
    && matchesStatus(item.status, filters.status)
    && matchesKeyword([item.outboundRecordNo, item.sourceTaskNo, item.handoverOrderNo, item.handoverRecordNo, item.feiTicketNo, item.transferBagNo, item.fabricRollNo, item.itemName], keyword)
    && withinTimeRange(item.outboundAt, filters.timeRange),
  )

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
