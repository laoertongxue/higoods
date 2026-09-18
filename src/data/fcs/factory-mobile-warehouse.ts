import {
  getFactoryWarehouseSummary,
  listFactoryWarehouseInboundRecords,
  listFactoryWarehouseOutboundRecords,
  listFactoryWarehouseStocktakeOrders,
  listFactoryWaitHandoverStockItems,
  listFactoryWaitProcessStockItems,
} from './factory-internal-warehouse.ts'
import { OWN_WOOL_FACTORY_ID, mockFactories } from './factory-mock-data.ts'
import { listCuttingSewingDispatchBatches, listCuttingSewingDispatchOrders, listCuttingSewingTransferBags } from './cutting/sewing-dispatch.ts'
import { listPdaHandoverHeads } from './pda-handover-events.ts'
import {
  getWoolHandoverEffectiveQty,
  listWoolWarehouseStocksFromStore,
  listWoolYarnReceiptLineTracesFromStore,
  readWoolStore,
} from './wool-task-domain.ts'
import {
  listPostFinishingFactoryReturns,
  listPostFinishingWaitHandoverWarehouseMovements,
  listPostFinishingWaitHandoverWarehouseRecords,
  listPostFinishingWaitProcessWarehouseMovements,
  listPostFinishingWaitProcessWarehouseRecords,
} from './post-finishing-full-flow.ts'
import { FULL_CAPABILITY_FACTORY_ID } from './post-finishing-current-read-model.ts'
import { isIndonesiaBusinessDateToday } from './indonesia-business-time.ts'
import { listWoolFactoryWarehouseFlows, summarizeWoolQuantities } from './wool-domain/queries.ts'
import { woolWarehouseFlowSignedQty } from './wool-domain/warehouse-ledger.ts'

export interface FactoryMobileWarehouseOverview {
  waitProcessQtyText?: string
  waitHandoverQtyText?: string
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
  pickupCompletedOrderCount: number
  handoutCompletedOrderCount: number
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
  const factory = mockFactories.find((item) => item.id === factoryId)
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

export function getFactoryMobileWarehouseOverview(
  factoryId: string,
  factoryName: string,
  now: Date = new Date(),
): FactoryMobileWarehouseOverview {
  if (factoryId === OWN_WOOL_FACTORY_ID || mockFactories.some(factory => factory.id === factoryId && factory.factoryType === 'CENTRAL_WOOL')) {
    const store = readWoolStore()
    const factoryFlows = listWoolFactoryWarehouseFlows(store, factoryId)
    const factoryOrderIds = new Set(Object.values(store.workOrders).filter(order => order.factoryId === factoryId).map(order => order.woolOrderId))
    // Filter facts before aggregation: unassigned preparation stock has no order id.
    const factoryStore = { ...store, warehouseFlows: factoryFlows }
    const waitProcessInventory = listWoolWarehouseStocksFromStore(factoryStore, 'WAIT_PROCESS')
      .filter((item) => item.currentQty > 0)
    const waitHandoverInventory = listWoolWarehouseStocksFromStore(factoryStore, 'WAIT_HANDOVER')
      .filter((item) => item.currentQty > 0)
    const receiptLines = [...factoryOrderIds]
      .flatMap((woolOrderId) => listWoolYarnReceiptLineTracesFromStore(store, {
        woolOrderId,
        batchMatch: 'ANY',
      }))
    const handovers = store.handovers.filter(record => factoryOrderIds.has(record.woolOrderId)).map((record) => ({
      record,
      effectiveQty: getWoolHandoverEffectiveQty(store, record),
    }))
    const todayFlows = factoryFlows.filter(flow => isIndonesiaBusinessDateToday(flow.operatedAt, now))
    const inbounds = todayFlows.filter(flow => woolWarehouseFlowSignedQty(flow) > 0)
    const outbounds = todayFlows.filter(flow => woolWarehouseFlowSignedQty(flow) < 0)
    // A scalar is meaningful only within one unit; the UI uses the explicit grouped text.
    const oneUnitTotal = (rows: Array<{ qty: number; unit: string }>) => new Set(rows.map(row => row.unit)).size > 1 ? 0 : rows.reduce((sum, row) => sum + row.qty, 0)
    const processQty = waitProcessInventory.map(row => ({ qty: row.currentQty, unit: row.unit }))
    const handoverQty = waitHandoverInventory.map(row => ({ qty: row.currentQty, unit: row.unit }))
    return {
      factoryId,
      factoryName,
      waitProcessCount: waitProcessInventory.length,
      waitProcessQty: oneUnitTotal(processQty),
      waitProcessQtyText: summarizeWoolQuantities(processQty),
      waitHandoverCount: waitHandoverInventory.length,
      waitHandoverQty: oneUnitTotal(handoverQty),
      waitHandoverQtyText: summarizeWoolQuantities(handoverQty),
      todayInboundCount: inbounds.length,
      todayInboundQty: oneUnitTotal(inbounds.map(flow => ({ ...flow, qty: Math.abs(woolWarehouseFlowSignedQty(flow)) }))),
      todayOutboundCount: outbounds.length,
      todayOutboundQty: oneUnitTotal(outbounds.map(flow => ({ ...flow, qty: Math.abs(woolWarehouseFlowSignedQty(flow)) }))),
      stocktakeCount: 0,
      differenceCount: receiptLines.filter((item) => Boolean(item.differenceNote?.trim())).length,
      objectionCount: handovers.filter(({ record, effectiveQty }) =>
        record.downstreamReceipt?.status === 'CONFIRMED'
        && record.downstreamReceipt.actualReceivedQty !== effectiveQty,
      ).length,
      pickupCompletedOrderCount: new Set(receiptLines.map((item) => item.receiptId)).size,
      handoutCompletedOrderCount: handovers.length,
      stocktakeWaitReviewCount: 0,
      stocktakeAdjustedCount: 0,
      transferBagPackTaskCount: 0,
      pendingTransferBagReceiveCount: 0,
      receivedTransferBagCount: 0,
      feiTicketWritebackCount: 0,
      transferBagDifferenceCount: 0,
      isSewingLightweight: false,
    }
  }

  if (factoryId === FULL_CAPABILITY_FACTORY_ID) {
    const waitProcessRecords = listPostFinishingWaitProcessWarehouseRecords()
    const waitHandoverRecords = listPostFinishingWaitHandoverWarehouseRecords()
    const deliveries = listPostFinishingFactoryReturns()
    const waitProcessMovements = listPostFinishingWaitProcessWarehouseMovements()
    const waitHandoverMovements = listPostFinishingWaitHandoverWarehouseMovements()
    const inboundFlows = waitProcessMovements.filter((flow) => flow.movementType === '确认入库')
    const recheckInboundFlows = waitHandoverMovements.filter((flow) => flow.movementType === '复检完成入仓')
    const outboundFlows = waitHandoverMovements.filter((flow) => flow.movementType === '后道出货交出')
    const activeWaitHandover = waitHandoverRecords.map((record) => record.lines.reduce((sum, line) => sum + line.availableQty, 0))
    return {
      factoryId,
      factoryName,
      waitProcessCount: waitProcessRecords.filter((record) => record.lines.some((line) => line.availableQty > 0)).length,
      waitProcessQty: waitProcessRecords.reduce((sum, record) => sum + record.lines.reduce((lineSum, line) => lineSum + line.availableQty, 0), 0),
      waitHandoverCount: waitHandoverRecords.filter((record, index) => activeWaitHandover[index] > 0).length,
      waitHandoverQty: activeWaitHandover.reduce((sum, qty) => sum + qty, 0),
      todayInboundCount: inboundFlows.length + recheckInboundFlows.length,
      todayInboundQty: [...inboundFlows, ...recheckInboundFlows].reduce((sum, flow) => sum + flow.quantities.reduce((lineSum, line) => lineSum + line.quantity, 0), 0),
      todayOutboundCount: outboundFlows.length,
      todayOutboundQty: outboundFlows.reduce((sum, flow) => sum + flow.quantities.reduce((lineSum, line) => lineSum + line.quantity, 0), 0),
      stocktakeCount: 0,
      differenceCount: deliveries.filter((delivery) => delivery.confirmedAt && delivery.lines.some((line) => line.confirmedQty !== line.registeredQty)).length,
      objectionCount: 0,
      pickupCompletedOrderCount: deliveries.filter((delivery) => Boolean(delivery.confirmedAt)).length,
      handoutCompletedOrderCount: waitHandoverRecords.filter((record) => record.status === '已交出').length,
      stocktakeWaitReviewCount: 0,
      stocktakeAdjustedCount: 0,
      transferBagPackTaskCount: 0,
      pendingTransferBagReceiveCount: 0,
      receivedTransferBagCount: 0,
      feiTicketWritebackCount: 0,
      transferBagDifferenceCount: 0,
      isSewingLightweight: false,
    }
  }

  const waitProcessItems = listFactoryWaitProcessStockItems().filter((item) => item.factoryId === factoryId)
  const waitHandoverItems = listFactoryWaitHandoverStockItems().filter((item) => item.factoryId === factoryId)
  const inboundRecords = listFactoryWarehouseInboundRecords().filter((item) => item.factoryId === factoryId)
  const outboundRecords = listFactoryWarehouseOutboundRecords().filter((item) => item.factoryId === factoryId)
  const stocktakeOrders = listFactoryWarehouseStocktakeOrders().filter((item) => item.factoryId === factoryId)

  const summary = getFactoryWarehouseSummary({ factoryId, timeRange: '7D' })
  const handoverHeads = listPdaHandoverHeads().filter((item) => item.factoryId === factoryId)
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
    pickupCompletedOrderCount: handoverHeads.filter((item) => item.headType === 'PICKUP' && item.completionStatus === 'COMPLETED').length,
    handoutCompletedOrderCount: handoverHeads.filter((item) => item.headType === 'HANDOUT' && item.completionStatus === 'COMPLETED').length,
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
      subText: overview.stocktakeWaitReviewCount > 0 ? `待处理 ${overview.stocktakeWaitReviewCount} 条` : `已调整 ${overview.stocktakeAdjustedCount} 条`,
      route: '/fcs/pda/warehouse/outbound-records?status=差异',
      status: overview.differenceCount > 0 ? 'danger' : 'normal',
    },
  ]
}
