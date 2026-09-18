import { getDefaultFactoryReceiptPosition, listFactoryReceipts, prepareFactoryReceipt, registerFactoryReceivingSource, savePreparedFactoryReceipt, initializeFactoryReceivingDemoBatch } from '../factory-receiving.ts'
import type { FactoryReceivingSource } from '../factory-receiving-types.ts'
import { projectFactoryReceiptsIntoWool } from '../factory-receiving-wool.ts'
import type { WoolDomainStore } from './store.ts'
import { sourceForBatch } from './craft-flow.ts'
import { finalizeWoolStageDemoFacts, woolDemoNumber } from './mock-data.ts'

const INITIALIZED = 'WDEMO-RECEIVING-INITIALIZED-20260918'
let initializing = false

/** Seed only explicit independent demonstration demands, through the same persisted receipt facts as receiving pages. */
export function ensureWoolStageDemoReceivingFacts(store: WoolDomainStore): void {
  if (initializing) return
  const alreadyInitialized = store.operationLogs.some(log => log.operationLogId === INITIALIZED)
  const orders = Object.values(store.workOrders).filter(order => order.stage === 'KNITTING' && woolDemoNumber(order) > 0)
  if (!orders.length) return
  initializing = true
  try {
    initializeFactoryReceivingDemoBatch(() => {
    const existingReceiptIds = new Set(listFactoryReceipts().map(receipt => receipt.id))
    const positions = new Map<string, ReturnType<typeof getDefaultFactoryReceiptPosition>>()
    const receive = (source: FactoryReceivingSource, qty: number, id: string, at: string): void => {
      if (existingReceiptIds.has(id)) return
      const line = source.lines[0]
      let position = positions.get(source.targetFactoryId)
      if (!position) { position = getDefaultFactoryReceiptPosition(source.targetFactoryId); positions.set(source.targetFactoryId, position) }
      const receipt = prepareFactoryReceipt({ id, factoryId: source.targetFactoryId, operatorId: 'WOOL-DEMO-RECEIVER', operatorName: '仓管（演示）', receivedAt: at,
        remark: '独立毛织两阶段演示需求的实际接收记录', lines: [{ sourceId: source.id, sourceLineId: line.id,
          ...position,
          ...(line.material.kind === 'YARN' ? { grossKg: qty + .62, pcs: 10, tubes: { PAPER: 10, CONICAL: 0, PAGODA: 0 } } : { businessQty: qty, businessUnit: '片' }),
        }] })
      savePreparedFactoryReceipt(receipt)
      existingReceiptIds.add(id)
    }
    // A separate unassigned receipt demonstrates allocation without inventing a new demand.
    const stockReceiptId = 'WDEMO-YARN-STOCK-R:20260918'
    if (!existingReceiptIds.has(stockReceiptId)) {
      const order = orders[0], material = order.yarnMaterials![0], id = 'WDEMO-YARN-STOCK:20260918'
      const source: FactoryReceivingSource = { id, documentNo: 'LY-MZ-BEILIAO-001', type: 'TRANSFER',
        origin: { kind: 'WAREHOUSE', id: 'WDEMO-YARN-CENTRAL', name: '毛纱中心仓（演示）', warehouseAttribute: '常规仓' },
        targetFactoryId: order.factoryId, targetFactoryName: order.factoryName, createdAt: '2026-09-18 08:00:00', createdBy: '纱仓仓管（演示）',
        approvedAt: '2026-09-18 08:05:00', approvedBy: '纱仓主管（演示）', handedOutAt: '2026-09-18 08:10:00',
        lines: [{ id: `${id}:line`, material: { sku: material.sku, name: material.name, kind: 'YARN', imageUrl: material.imageUrl, color: '奶油色系', composition: '棉纱', specification: '段染棉纱', batchNo: 'MZ-PREPARATION-10KG' },
          plannedQty: 10, sentQty: 10, unit: 'kg', rolls: [], label: '独立纱线备料，实际收到后按需分配横机单' }] }
      registerFactoryReceivingSource(source)
      receive(source, 10, stockReceiptId, '2026-09-18 08:30:00')
    }
    for (const order of alreadyInitialized ? [] : orders) {
      const n = woolDemoNumber(order), id = `WDEMO-YARN:${order.pairId}`, material = order.yarnMaterials![0]
      const yarn: FactoryReceivingSource = { id, documentNo: `LY-MZ-${String(n).padStart(3, '0')}`, type: 'TRANSFER', approvedAt: '2026-09-18 08:05:00', approvedBy: '纱仓主管（演示）',
        origin: { kind: 'WAREHOUSE', id: 'WDEMO-YARN-CENTRAL', name: '毛纱中心仓（演示）', warehouseAttribute: '常规仓' },
        targetFactoryId: order.factoryId, targetFactoryName: order.factoryName, createdAt: '2026-09-18 08:00:00', createdBy: '纱仓仓管（演示）', handedOutAt: '2026-09-18 08:10:00', workOrderNo: order.woolOrderNo,
        lines: [{ id: `${id}:line`, material: { sku: material.sku, name: material.name, kind: 'YARN', imageUrl: material.imageUrl, color: '奶油色系', composition: '棉纱', specification: '段染棉纱', batchNo: `MZ-YARN-${n}` },
          plannedQty: 25, sentQty: 25, unit: 'kg', rolls: [], label: id, woolOrderId: order.woolOrderId, productionOrderNo: order.productionOrderNo, taskNo: order.taskNo }] }
      registerFactoryReceivingSource(yarn)
      if (![1, 6].includes(n)) receive(yarn, 25, `WDEMO-YARN-R:${order.pairId}`, '2026-09-18 08:30:00')
      for (const handover of store.handovers.filter(record => record.woolOrderId === order.woolOrderId && record.pieceKey)) {
        const piece = order.externalPieces.find(item => item.pieceKey === handover.pieceKey)!, node = piece.routeNodes[0]
        const source = sourceForBatch(order, piece, { id: handover.handoverId, qty: handover.handoverQty, at: handover.handedOverAt, by: handover.handedOverBy,
          factoryId: node.factoryId, factoryName: node.factoryName, target: node, routeNodeId: node.sourceEntryId, sourceFactoryId: order.factoryId, sourceFactoryName: order.factoryName })
        registerFactoryReceivingSource(source)
        receive(source, handover.handoverQty, `WDEMO-R:${handover.handoverId}`, '2026-09-18 10:00:00')
      }
      for (const record of store.craftRecords.filter(record => record.woolOrderId === order.woolOrderId && record.action === 'HANDOVER')) {
        const piece = order.externalPieces.find(item => item.pieceKey === record.pieceKey)!
        const index = piece.routeNodes.findIndex(node => node.sourceEntryId === record.routeNodeId), node = piece.routeNodes[index], next = piece.routeNodes[index + 1] || null
        const source = sourceForBatch(order, piece, { id: record.recordId, qty: record.qty, at: record.operatedAt, by: record.operatedBy,
          factoryId: next?.factoryId || order.factoryId, factoryName: next?.factoryName || order.factoryName, target: next, routeNodeId: node.sourceEntryId,
          sourceFactoryId: node.factoryId, sourceFactoryName: node.factoryName })
        registerFactoryReceivingSource(source)
        const at = `2026-09-18 ${String(11 + index).padStart(2, '0')}:00:00`
        const received = !next && [10, 11].includes(n) && piece.pieceInstanceId === 'Q1' ? 80 : record.qty
        if (!next && n === 13) {
          receive(source, 40, `WDEMO-R:${record.recordId}:1`, at)
          receive(source, received - 40, `WDEMO-R:${record.recordId}:2`, `2026-09-18 ${String(11 + index).padStart(2, '0')}:15:00`)
        } else receive(source, received, `WDEMO-R:${record.recordId}`, at)
      }
    }
    projectFactoryReceiptsIntoWool(store)
    if (!alreadyInitialized) {
      finalizeWoolStageDemoFacts(store)
      store.operationLogs.push({ operationLogId: INITIALIZED, action: 'INITIALIZE_DEMO_RECEIVING', objectType: 'DEMO_SOURCE', objectId: INITIALIZED,
        operatedBy: '两阶段演示数据', operatedAt: '2026-09-18 16:30:00', remark: '仅初始化新演示需求；纱线与毛织片实收来自统一接收记录' })
    }
    })
  } finally { initializing = false }
}
