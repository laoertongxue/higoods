import {
  listFactoryInternalWarehouses,
  listFactoryWaitProcessStockItems,
  listFactoryWarehouseInboundRecords,
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
import { getDyeingQuantityFacts } from './dyeing-quantity-facts.ts'
import { listFactoryReceipts, listFactoryMaterialUses } from './factory-receiving.ts'
import {getDefaultFactoryReceiptPosition,getHistoricalReceiptPosition} from './factory-receiving.ts'
import { DYE_DEMO_DETAILS,dyeFactoryTabLabel } from './dye-work-order-demo-details.ts'
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
  usageRecords: Array<FactoryWaitProcessStockItem & { usedAt: string; usedBy: string }>
}
/** Inventory is a current balance. Date filters apply to movements, never hide older remaining stock. */
export function getDyeingWarehouseView(filters: DyeingWarehouseViewFilters = {}): DyeingWarehouseView {
  const facts = getDyeingQuantityFacts(),
    allWarehouses = listFactoryInternalWarehouses()
  const matches = (row: { factoryId: string; status: string }, tokens: unknown[]) =>
    (!filters.factoryId || row.factoryId === filters.factoryId) &&
    (!filters.status || filters.status === 'ALL' || row.status === filters.status) &&
    (!filters.keyword || tokens.join(' ').toLowerCase().includes(filters.keyword.toLowerCase().trim()))
  const inDate = (at: string) =>
    !filters.timeRange ||
    filters.timeRange === 'ALL' ||
    Date.now() - Date.parse(at.replace(' ', 'T')) <= (filters.timeRange === '7D' ? 7 : 30) * 86400000
  const physicalLines = listFactoryReceipts()
    .filter((r) => r.factoryId !== 'OWN_WOOL_FACTORY')
    .flatMap((r) => r.lines.map((line) => ({ line, receipt: r })))
  const physicalIds = new Set(physicalLines.map((x) => x.line.id))
  const physical = (id: string) => physicalIds.has(id.replace(/^WPS-FIN-|^FIN-/, '').replace(/-\d+$/, ''))
  const waitProcessItems = listFactoryWaitProcessStockItems()
    .filter((r) => physical(r.stockItemId))
    .map((row) => {
      const line = physicalLines.find(
        (x) => x.line.id === row.stockItemId.replace(/^WPS-FIN-/, '').replace(/-\d+$/, ''),
      )?.line
      const order = facts.find((f) => f.order.dyeOrderId === line?.dyeOrderId)?.order
      return {
        ...row,
        sourceRecordId: order?.dyeOrderId || line?.sourceId || row.sourceRecordId,
        taskId: order?.taskId,
        taskNo: order?.taskNo || line?.taskNo || '备料（未关联加工单）',
        factoryName: dyeFactoryTabLabel(row.factoryId, row.factoryName),
      }
    })
  const inboundRecords = listFactoryWarehouseInboundRecords()
    .filter((r) => physical(r.inboundRecordId))
    .map((row) => {
      const line = physicalLines.find(
        (x) => x.line.id === row.inboundRecordId.replace(/^FIN-/, '').replace(/-\d+$/, ''),
      )?.line
      const order = facts.find((f) => f.order.dyeOrderId === line?.dyeOrderId)?.order
      return {
        ...row,
        sourceRecordId: order?.dyeOrderId || line?.sourceId || row.sourceRecordId,
        taskId: order?.taskId,
        taskNo: order?.taskNo || line?.taskNo || '备料（未关联加工单）',
        factoryName: dyeFactoryTabLabel(row.factoryId, row.factoryName),
      }
    })
  const waitHandoverItems: FactoryWaitHandoverStockItem[] = [],
    outboundRecords: FactoryWarehouseOutboundRecord[] = []
  for (const f of facts) {
    const o = f.order
    if (!o.dyeFactoryId) continue
    const inputWarehouse = allWarehouses.find(
      (w) => w.factoryId === o.dyeFactoryId && w.warehouseKind === 'WAIT_PROCESS',
    )
    const outputWarehouse = allWarehouses.find(
      (w) => w.factoryId === o.dyeFactoryId && w.warehouseKind === 'WAIT_HANDOVER',
    )
    const common = {
      factoryId: o.dyeFactoryId,
      factoryName: f.factoryName,
      factoryKind: 'CENTRAL_DYE' as const,
      processCode: 'PROC_DYE',
      processName: '染色',
      craftCode: 'DYE',
      craftName: '染色',
      itemKind: f.kind,
      itemName: f.materialName,
      unit: o.qtyUnit,
      materialSku: f.rawSku,
      fabricColor: f.color,
      taskId: o.taskId,
      taskNo: o.taskNo,
      productionOrderNo: o.sourceProductionOrderNo,
      photoList: f.imageUrl ? [f.imageUrl] : [],
    }
    if (f.legacyReceived > 0) {
      const receipt = o.materialReceipts?.find((r) => !r.receiptId.startsWith('FRP-'))
      const recordId = `DYE-HISTORY-${o.dyeOrderId}`
      const demo=DYE_DEMO_DETAILS[o.dyeOrderId]
      const position=demo?getHistoricalReceiptPosition(o.dyeFactoryId,getDefaultFactoryReceiptPosition(o.dyeFactoryId)):undefined
      const location={areaName:position?.area.areaName||'历史按单汇总',shelfNo:position?.shelf.shelfNo||'原记录未分库位',locationNo:position?.location.locationNo||'原记录未分库位'}
      waitProcessItems.push({
        ...common,
        stockItemId: recordId,
        warehouseId: inputWarehouse?.warehouseId || `${o.dyeFactoryId}-WAIT_PROCESS`,
        warehouseName: `${f.factoryName} · 待加工仓`,
        sourceRecordId: o.dyeOrderId,
        sourceRecordNo: o.dyeOrderNo,
        sourceRecordType: 'TRANSFER_RECEIVE',
        sourceObjectKind: '上游工厂仓',
        sourceObjectName: '历史投入接收',
        expectedQty: f.legacyReceived,
        receivedQty: f.legacyReceived,
        issuedQty: f.legacyUsed,
        availableQty: Math.max(0, f.legacyReceived - f.legacyUsed),
        differenceQty: 0,
        receiverName: receipt?.receiverName || f.factoryName,
        receivedAt: receipt?.receivedAt || o.createdAt,
        status: '已入待加工仓',
        ...location,
        locationText: position?`${position.area.areaName} / ${position.shelf.shelfNo} / ${position.location.locationNo}`:'历史按单汇总，未记录库位',
        fabricRollNo: f.kind==='面料'&&demo?`批次 ${demo.batchNo} · ${demo.preparedRollCount} 卷（按单汇总）`:undefined,
        remark: '历史演示批次的已确认接收及用料，数量沿用原单，不重复增加库存。',
      })
      inboundRecords.push({
        ...common,
        inboundRecordId: recordId,
        inboundRecordNo: receipt?.receiptId || recordId,
        warehouseId: inputWarehouse?.warehouseId || `${o.dyeFactoryId}-WAIT_PROCESS`,
        warehouseName: `${f.factoryName} · 待加工仓`,
        sourceRecordId: o.dyeOrderId,
        sourceRecordNo: o.dyeOrderNo,
        sourceRecordType: 'TRANSFER_RECEIVE',
        sourceObjectName: '历史投入接收',
        expectedQty: f.legacyReceived,
        receivedQty: f.legacyReceived,
        differenceQty: 0,
        receiverName: receipt?.receiverName || f.factoryName,
        receivedAt: receipt?.receivedAt || o.createdAt,
        ...location,
        status: '已入库',
        generatedStockItemId: recordId,
        remark: '历史接收汇总，不重复计入逐卷实收。',
      })
    }
    if (f.packed > 0) {
      waitHandoverItems.push({
        ...common,
        materialSku: f.outputSku,
        stockItemId: `DYE-OUTPUT-${o.dyeOrderId}`,
        warehouseId: outputWarehouse?.warehouseId || `${o.dyeFactoryId}-WAIT_HANDOVER`,
        warehouseName: `${f.factoryName} · 待交出仓`,
        areaName: '包装产出',
        shelfNo: '按原加工单',
        locationNo: '按原加工单',
        locationText: '按加工单汇总；卷码见交出单',
        completedQty: f.packed,
        lossQty: Math.max(0, f.used - f.packed),
        waitHandoverQty: f.availableOutput,
        receiverKind: '裁床厂',
        receiverName: o.receiverName,
        handoverOrderId: o.handoverOrderId,
        handoverOrderNo: o.handoverOrderNo,
        receiverWrittenQty: f.actual.length ? f.downstreamReceived : undefined,
        differenceQty: f.actual.length ? f.difference : undefined,
        status: f.availableOutput > 0 ? '待交出' : f.actual.length === f.records.length ? '已回写' : '已交出',
        remark: '包装完成入仓，实际交出扣仓；下游实收独立记录。',
      })
    }
    for (const r of f.records) {
      const received = Boolean(r.receiverWrittenAt) || Boolean(r.taskReceipts?.length)
      outboundRecords.push({
        ...common,
        materialSku: f.outputSku,
        outboundRecordId: r.recordId,
        outboundRecordNo: r.handoverRecordNo || r.recordId,
        warehouseId: outputWarehouse?.warehouseId || `${o.dyeFactoryId}-WAIT_HANDOVER`,
        warehouseName: `${f.factoryName} · 待交出仓`,
        sourceTaskId: o.taskId,
        sourceTaskNo: o.taskNo,
        sourceRecordId: o.dyeOrderId,
        sourceRecordNo: o.dyeOrderNo,
        handoverOrderId: o.handoverOrderId,
        handoverRecordId: r.recordId,
        handoverRecordNo: r.handoverRecordNo || r.recordId,
        receiverKind: '裁床厂',
        receiverName: o.receiverName,
        outboundQty: r.submittedQty ?? 0,
        receiverWrittenQty: received ? (r.receiverWrittenQty ?? 0) : undefined,
        differenceQty: received ? (r.receiverWrittenQty ?? 0) - (r.submittedQty ?? 0) : undefined,
        operatorName: r.factorySubmittedBy || f.factoryName,
        outboundAt: r.factorySubmittedAt || o.updatedAt,
        status: !received
          ? '已出库'
          : Math.abs((r.receiverWrittenQty ?? 0) - (r.submittedQty ?? 0)) > 0.000001
            ? '差异'
            : '已回写',
        relatedWaitHandoverStockItemId: `DYE-OUTPUT-${o.dyeOrderId}`,
        remark: received ? '下游已登记实际接收' : '已交出，等待下游登记实际接收',
      })
    }
  }
  const stocks = waitProcessItems.filter((x) =>
    matches(x, [x.sourceRecordNo, x.itemName, x.materialSku, x.taskNo, x.fabricRollNo]),
  )
  const outputs = waitHandoverItems.filter((x) => matches(x, [x.taskNo, x.itemName, x.materialSku, x.handoverOrderNo]))
  const inbounds = inboundRecords.filter(
    (x) => matches(x, [x.sourceRecordNo, x.itemName, x.materialSku, x.taskNo]) && inDate(x.receivedAt),
  )
  const outbounds = outboundRecords.filter(
    (x) =>
      matches(x, [x.sourceRecordNo, x.itemName, x.materialSku, x.sourceTaskNo, x.handoverRecordNo]) &&
      inDate(x.outboundAt),
  )
  const usageRecords: Array<FactoryWaitProcessStockItem & { usedAt: string; usedBy: string }> = []
  for (const use of listFactoryMaterialUses())
    for (const line of use.lines) {
      const stock = stocks.find(
        (s) => s.stockItemId.startsWith(`WPS-FIN-${line.receiptLineId}-`) && s.fabricRollNo === line.barcode,
      )
      if (stock)
        usageRecords.push({
          ...stock,
          taskNo: facts.find((f) => f.order.dyeOrderId === use.dyeOrderId)?.order.taskNo || use.waterOrderId || use.dyeOrderId!,
          sourceRecordId: use.waterOrderId || use.dyeOrderId!,
          issuedQty: line.qty,
          usedAt: use.at,
          usedBy: use.operatorName,
        })
    }
  for (const stock of stocks.filter((s) => s.stockItemId.startsWith('DYE-HISTORY-') && (s.issuedQty ?? 0) > 0)) {
    const node = facts.find((f) => f.order.dyeOrderId === stock.sourceRecordId)?.nodes.find((n) => n.nodeCode === 'DYE')
    usageRecords.push({
      ...stock,
      usedAt: node?.startedAt || stock.receivedAt,
      usedBy: node?.operatorName || stock.factoryName,
    })
  }
  const factoryIds = [...new Set([...stocks, ...outputs, ...inbounds, ...outbounds].map((x) => x.factoryId))]
  return {
    usageRecords,
    factoryIds,
    taskIds: facts.map((f) => f.order.taskId),
    dyeOrderIds: facts.map((f) => f.order.dyeOrderId),
    handoverOrderIds: facts.flatMap((f) => (f.order.handoverOrderId ? [f.order.handoverOrderId] : [])),
    waitProcessItems: stocks,
    waitHandoverItems: outputs,
    inboundRecords: inbounds,
    outboundRecords: outbounds,
    warehouses: allWarehouses
      .filter((w) => factoryIds.includes(w.factoryId))
      .map((w) => ({ ...w, factoryName: dyeFactoryTabLabel(w.factoryId, w.factoryName) })),
    nodeRows: factoryIds.flatMap((id) => listFactoryWarehouseNodeRows(id)),
    stocktakeOrders: listFactoryWarehouseStocktakeOrders().filter((o) => factoryIds.includes(o.factoryId)),
  }
}
