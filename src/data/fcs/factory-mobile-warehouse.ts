import {
  getFactoryWarehouseSummary,
  listFactoryWarehouseInboundRecords,
  listFactoryWarehouseOutboundRecords,
  listFactoryWarehouseStocktakeOrders,
  listFactoryWaitHandoverStockItems,
  listFactoryWaitProcessStockItems,
} from './factory-internal-warehouse.ts'

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

export function getFactoryMobileWarehouseOverview(factoryId: string, factoryName: string): FactoryMobileWarehouseOverview {
  const waitProcessItems = listFactoryWaitProcessStockItems().filter((item) => item.factoryId === factoryId)
  const waitHandoverItems = listFactoryWaitHandoverStockItems().filter((item) => item.factoryId === factoryId)
  const inboundRecords = listFactoryWarehouseInboundRecords().filter((item) => item.factoryId === factoryId)
  const outboundRecords = listFactoryWarehouseOutboundRecords().filter((item) => item.factoryId === factoryId)
  const stocktakeOrders = listFactoryWarehouseStocktakeOrders().filter((item) => item.factoryId === factoryId)

  const summary = getFactoryWarehouseSummary({ factoryId, timeRange: '7D' })

  return {
    factoryId,
    factoryName,
    waitProcessCount: waitProcessItems.length,
    waitProcessQty: summary.waitProcessQty,
    waitHandoverCount: waitHandoverItems.length,
    waitHandoverQty: summary.waitHandoverQty,
    todayInboundCount: inboundRecords.filter((item) => isToday(item.receivedAt)).length,
    todayInboundQty: inboundRecords.filter((item) => isToday(item.receivedAt)).reduce((sum, item) => sum + item.receivedQty, 0),
    todayOutboundCount: outboundRecords.filter((item) => isToday(item.outboundAt)).length,
    todayOutboundQty: outboundRecords.filter((item) => isToday(item.outboundAt)).reduce((sum, item) => sum + item.outboundQty, 0),
    stocktakeCount: stocktakeOrders.filter((item) => item.status === '盘点中' || item.status === '待确认').length,
    differenceCount: summary.abnormalCount + summary.stocktakeDifferenceCount,
    objectionCount: waitHandoverItems.filter((item) => item.status === '异议中').length + outboundRecords.filter((item) => item.status === '异议中').length,
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
      subText: '交接差异与盘点差异',
      route: '/fcs/pda/warehouse/outbound-records?status=差异',
      status: overview.differenceCount > 0 ? 'danger' : 'normal',
    },
  ]
}
