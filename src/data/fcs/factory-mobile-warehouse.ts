import {
  getFactoryWarehouseSummary,
  listFactoryWarehouseInboundRecords,
  listFactoryWarehouseOutboundRecords,
  listFactoryWarehouseStocktakeOrders,
  listFactoryWaitHandoverStockItems,
  listFactoryWaitProcessStockItems,
} from './factory-internal-warehouse.ts'
import { mockFactories } from './factory-mock-data.ts'
import { listCuttingSewingDispatchBatches, listCuttingSewingDispatchOrders, listCuttingSewingTransferBags } from './cutting/sewing-dispatch.ts'

export interface FactoryMobileWarehouseOverview {
  factoryId: string
  factoryName: string
  waitProcessCount: number
  waitProcessQty: number
  waitHandoverCount: number
  waitHandoverQty: number
  todayInboundCount: number
  todayInboundQty: number
  todayOutboundCount: number
  todayOutboundQty: number
  stocktakeCount: number
  differenceCount: number
  objectionCount: number
  stocktakeWaitReviewCount: number
  stocktakeAdjustedCount: number
  transferBagPackTaskCount: number
  pendingTransferBagReceiveCount: number
  receivedTransferBagCount: number
  feiTicketWritebackCount: number
  transferBagDifferenceCount: number
  isSewingLightweight: boolean
}

export interface FactoryMobileWarehouseCard {
  cardId: string
  title: string
  countText: string
  subText: string
  route: string
  status: 'normal' | 'warning' | 'danger'
}

function isToday(value?: string): boolean {
  if (!value) return false
  const date = new Date(value.replace(' ', 'T'))
  if (Number.isNaN(date.getTime())) return false
  const now = new Date()
  return (
    date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate()
  )
}

function isSewingFactory(factoryId: string): boolean {
  const factory = mockFactories.find((item) => item.id === factoryId || item.factoryId === factoryId)
  return Boolean(factory?.name.includes('车缝') || factory?.factoryType === 'SATELLITE_SEWING')
}

export function getFactoryMobileTransferBagPackTasks(factoryId: string) {
  const orders = listCuttingSewingDispatchOrders().filter((order) => order.cuttingFactoryId === factoryId)
  const orderIds = new Set(orders.map((order) => order.dispatchOrderId))
  return listCuttingSewingTransferBags().filter(
    (bag) => orderIds.has(bag.dispatchOrderId) && bag.dispatchStatus === '未交出',
  )
}

export function getFactoryMobileTransferBagReceiveTasks(factoryId: string) {
  const orders = listCuttingSewingDispatchOrders().filter((order) => order.sewingFactoryId === factoryId)
  const orderIds = new Set(orders.map((order) => order.dispatchOrderId))
  const batches = listCuttingSewingDispatchBatches().filter((batch) => orderIds.has(batch.dispatchOrderId) && Boolean(batch.handoverRecordId))
  const batchIds = new Set(batches.map((batch) => batch.dispatchBatchId))
  return listCuttingSewingTransferBags().filter((bag) => batchIds.has(bag.dispatchBatchId))
}

export function getFactoryMobileWarehouseOverview(factoryId: string, factoryName: string): FactoryMobileWarehouseOverview {
  const waitProcessItems = listFactoryWaitProcessStockItems().filter((item) => item.factoryId === factoryId)
  const waitHandoverItems = listFactoryWaitHandoverStockItems().filter((item) => item.factoryId === factoryId)
  const inboundRecords = listFactoryWarehouseInboundRecords().filter((item) => item.factoryId === factoryId)
  const outboundRecords = listFactoryWarehouseOutboundRecords().filter((item) => item.factoryId === factoryId)
  const stocktakeOrders = listFactoryWarehouseStocktakeOrders().filter((item) => item.factoryId === factoryId)

  const summary = getFactoryWarehouseSummary({ factoryId, timeRange: '7D' })
  const packTasks = getFactoryMobileTransferBagPackTasks(factoryId)
  const receiveTasks = getFactoryMobileTransferBagReceiveTasks(factoryId)
  const sewingLightweight = isSewingFactory(factoryId)

  return {
    factoryId,
    factoryName,
    waitProcessCount: sewingLightweight ? 0 : waitProcessItems.length,
    waitProcessQty: sewingLightweight ? 0 : summary.waitProcessQty,
    waitHandoverCount: sewingLightweight ? 0 : waitHandoverItems.length,
    waitHandoverQty: sewingLightweight ? 0 : summary.waitHandoverQty,
    todayInboundCount: sewingLightweight ? receiveTasks.filter((item) => item.packStatus === '已扫码接收' || item.packStatus === '已回写').length : inboundRecords.filter((item) => isToday(item.receivedAt)).length,
    todayInboundQty: sewingLightweight ? receiveTasks.reduce((sum, item) => sum + item.contentFeiTicketCount, 0) : inboundRecords.filter((item) => isToday(item.receivedAt)).reduce((sum, item) => sum + item.receivedQty, 0),
    todayOutboundCount: sewingLightweight ? 0 : outboundRecords.filter((item) => isToday(item.outboundAt)).length,
    todayOutboundQty: sewingLightweight ? 0 : outboundRecords.filter((item) => isToday(item.outboundAt)).reduce((sum, item) => sum + item.outboundQty, 0),
    stocktakeCount: stocktakeOrders.filter((item) => item.status === '盘点中' || item.status === '待确认').length,
    differenceCount: sewingLightweight ? receiveTasks.filter((item) => item.packStatus === '差异' || item.status === '差异').length : summary.abnormalCount + summary.stocktakeDifferenceCount,
    objectionCount: sewingLightweight ? receiveTasks.filter((item) => item.packStatus === '异议中').length : waitHandoverItems.filter((item) => item.status === '异议中').length + outboundRecords.filter((item) => item.status === '异议中').length,
    stocktakeWaitReviewCount: sewingLightweight ? 0 : summary.stocktakeWaitReviewCount,
    stocktakeAdjustedCount: sewingLightweight ? 0 : summary.stocktakeAdjustedCount,
    transferBagPackTaskCount: packTasks.length,
    pendingTransferBagReceiveCount: receiveTasks.filter((item) => item.packStatus === '已交出' || item.currentLocation === '下游工厂待接收').length,
    receivedTransferBagCount: receiveTasks.filter((item) => item.packStatus === '已扫码接收' || item.packStatus === '部分回写' || item.packStatus === '已回写').length,
    feiTicketWritebackCount: receiveTasks.reduce((total, item) => total + (item.receivedFeiTicketCount || 0), 0),
    transferBagDifferenceCount: receiveTasks.filter((item) => item.packStatus === '差异' || item.status === '差异').length,
    isSewingLightweight: sewingLightweight,
  }
}

export function getFactoryMobileWarehouseCards(factoryId: string, factoryName: string): FactoryMobileWarehouseCard[] {
  const overview = getFactoryMobileWarehouseOverview(factoryId, factoryName)
  return [
    {
      cardId: 'wait-process',
      title: '待加工仓',
      countText: `${overview.waitProcessCount} 条`,
      subText: '已进入本工厂，待确认加工',
      route: '/fcs/pda/warehouse/wait-process',
      status: overview.waitProcessCount > 0 ? 'warning' : 'normal',
    },
    {
      cardId: 'wait-handover',
      title: '待交出仓',
      countText: `${overview.waitHandoverCount} 条`,
      subText: '已完成加工，等待交给下游',
      route: '/fcs/pda/warehouse/wait-handover',
      status: overview.waitHandoverCount > 0 ? 'warning' : 'normal',
    },
    {
      cardId: 'inbound-records',
      title: '入库记录',
      countText: `${overview.todayInboundCount} 条`,
      subText: '今日待加工仓入库',
      route: '/fcs/pda/warehouse/inbound-records',
      status: 'normal',
    },
    {
      cardId: 'outbound-records',
      title: '出库记录',
      countText: `${overview.todayOutboundCount} 条`,
      subText: '今日待交出仓出库',
      route: '/fcs/pda/warehouse/outbound-records',
      status: 'normal',
    },
    {
      cardId: 'stocktake',
      title: '盘点',
      countText: `${overview.stocktakeCount} 单`,
      subText: '只支持全盘',
      route: '/fcs/pda/warehouse/stocktake',
      status: overview.stocktakeCount > 0 ? 'warning' : 'normal',
    },
    {
      cardId: 'difference',
      title: '差异',
      countText: `${overview.differenceCount} 条`,
      subText: overview.stocktakeWaitReviewCount > 0 ? `待审核 ${overview.stocktakeWaitReviewCount} 条` : `已调整 ${overview.stocktakeAdjustedCount} 条`,
      route: '/fcs/pda/warehouse/outbound-records?status=差异',
      status: overview.differenceCount > 0 ? 'danger' : 'normal',
    },
  ]
}
