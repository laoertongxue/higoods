import { WOOL_DEMO_STYLE_IMAGE, WOOL_DEMO_YARN_IMAGE } from './demo-assets.ts'
import type { WoolDomainStore } from './store.ts'
import { replaceWoolStore } from './store.ts'
import type { WoolWorkOrder, WoolExternalPiece, WoolHandoverRecord } from './types.ts'
import { appendStageReport } from './stage-facts.ts'
import { stageReportedQty, stageHandoverQty, stageCompletionBlock } from './stage-rules.ts'
import { woolWarehouseFlowSignedQty } from './warehouse-ledger.ts'

export const WOOL_MOCK_SCENARIO_CODES = ['WHOLE_NO_CRAFT', 'PART_NO_CRAFT', 'MIXED_PIECES', 'MULTI_FACTORY', 'MULTI_STEP', 'PARTIAL_RETURN', 'REPEATED_CRAFT', 'ROUTE_BLOCKED'] as const
export type WoolMockScenarioCode = typeof WOOL_MOCK_SCENARIO_CODES[number]
const AT = '2026-09-18 08:00:00'
const SCENARIOS = ['整件无外加工／纱线待接收', '部位无外加工／待开工', '整件无外加工／自动衔接中', '部位无外加工／加工完成待交出', '整件无外加工／两阶段闭合', '部位外加工／来纱待接收', '整件外加工／横机待开工', '部位外加工／部分横机产出', '整件多工艺／横机已完成、外厂待加工', '部位多厂／部分回货可缝盘', '整件多工艺／部分回货与部分缝盘', '部位混合 SKU／部分外加工与无外加工', '整件同名工艺多节点／全流程闭合', '部位外加工／首工艺未派工']
export function woolDemoNumber(order: WoolWorkOrder): number { return order.demoSource && /^WOOL-STAGE-\d+$/.test(order.pairId) ? Number(order.pairId.split('-').at(-1)) : 0 }

/** Independent new demonstration demands. They never link to nonexistent production documents. */
export function buildWoolFactWorkflowMockStore(): WoolDomainStore {
  const store: WoolDomainStore = {
    workOrders: {}, craftRecords: [], internalReceipts: [], pieceReceipts: [], yarnReceipts: [], yarnIssues: [], yarnReturns: [],
    processReports: [], handovers: [], qtyChangeLogs: [], warehouseFlows: [], completions: [],
    machineAssociations: [], machineAssociationLogs: [], operationLogs: [],
    machines: Array.from({ length: 8 }, (_, i) => ({ machineId: `WM-${String(i + 1).padStart(3, '0')}`, machineNo: `横机-${i + 1}`,
      machineName: `电脑横机 ${i + 1} 号`, machineModel: ['慈星 GE2-52C', '岛精 SES-SWG'][i % 2], needleType: i % 2 ? '14 针' : '12 针',
      status: i === 6 ? 'REPAIR' : i === 7 ? 'DISABLED' : 'IDLE', createdAt: AT, updatedAt: AT })),
  }
  for (let n = 1; n <= 14; n++) {
    const key = String(n).padStart(3, '0'), pairId = `WOOL-STAGE-${key}`
    const sku = 'CARDIGAN-CREAM-M', kind = n % 2 ? 'WHOLE_GARMENT' : 'PART_PANEL'
    const pieces: WoolExternalPiece[] = n > 5 ? [1, 2].map(i => {
      const crafts = n === 13 && i === 1 ? ['绣花', '曲牙绣', '绣花'] : n >= 9 && i === 1 ? ['绣花', '曲牙绣'] : [i === 1 ? '绣花' : '曲牙绣']
      return { pieceKey: `${pairId}:Q${i}:${sku}`, patternPackageId: `${pairId}:pattern`, pieceInstanceId: `Q${i}`,
        pieceName: `Q / 第${i}片`, skuCode: sku, pieceCountPerGarment: 1,
        issues: n === 14 ? ['首工艺尚未分配加工厂'] : [],
        routeNodes: crafts.map((craft, j) => ({
          taskOrderId: `WSC:${pairId}:${pairId}:Q${i}:${sku}:${pairId}:Q${i}:step${j + 1}`,
          sourceEntryId: `${pairId}:Q${i}:step${j + 1}`, predecessorEntryIds: j ? [`${pairId}:Q${i}:step${j}`] : [],
          craftCode: craft === '绣花' ? 'CRAFT_3000001' : 'CRAFT_3000004', craftName: craft,
          factoryId: n === 14 ? '' : craft === '绣花' ? 'FAC-APF' : 'F090',
          factoryName: n === 14 ? '' : craft === '绣花' ? 'APF - 辅助工艺' : '全能力测试工厂',
        })),
      }
    }) : []
    const base = { pairId, sourceTaskId: `TASK-${pairId}`, externalPieces: pieces, generationIssues: [],
      demoSource: { demandNo: `DEMO-MZ-260918-${key}`, demandCreatedAt: '2026-09-17 15:00:00', productionOrderCreatedAt: '2026-09-18 07:30:00', label: SCENARIOS[n - 1] },
      yarnMaterials: [{ sku: 'YARN-COTTON-MIXED', name: '段染棉纱', imageUrl: WOOL_DEMO_YARN_IMAGE }],
      taskNo: `TK-MZ-${key}`, productionOrderId: `PO-STAGE-${key}`, productionOrderNo: `PO-MZ-${key}`,
      styleNo: 'CARDIGAN-CREAM', styleName: '奶油色针织开衫', styleImageUrl: WOOL_DEMO_STYLE_IMAGE, internalStyleCode: 'MZ2609',
      factoryId: 'OWN_WOOL_FACTORY', factoryName: '周哥毛织厂', kind,
      plannedStartAt: '2026-09-18', plannedCompletionAt: '2026-09-25',
      outputPlanLines: [{ outputSkuCode: sku, garmentSkuCode: sku, outputObjectType: kind === 'WHOLE_GARMENT' ? 'GARMENT' : 'WOOL_PANEL',
        colorCode: 'CREAM', colorName: '奶油色', sizeCode: 'M', plannedQty: 100, qtyUnit: '件', requiredYarnSkus: ['YARN-COTTON-MIXED'],
        sourceTechPackVersionId: `${pairId}:TP1`, sourceTechPackVersionCode: 'v1.0', sourceColorMappingIds: [`${pairId}:MAP`], sourceBomItemIds: [`${pairId}:BOM`] }],
      downstreamTarget: kind === 'WHOLE_GARMENT' ? { receiverType: 'DOWNSTREAM_FACTORY', receiverId: 'PF-DEDICATED-001', receiverName: 'HiGood 后道工厂' }
        : { receiverType: 'CUTTING_WAIT_HANDOVER_WAREHOUSE', receiverId: 'WH-CUTTING-WAIT-HANDOVER', receiverName: '裁床待交出仓' },
      sourceTechPackVersionId: `${pairId}:TP1`, sourceTechPackVersionCode: 'v1.0',
      mockScenarioCode: n <= 5 ? (kind === 'WHOLE_GARMENT' ? 'WHOLE_NO_CRAFT' : 'PART_NO_CRAFT') : n === 14 ? 'ROUTE_BLOCKED' : n === 13 ? 'REPEATED_CRAFT' : n === 10 || n === 11 ? 'PARTIAL_RETURN' : n >= 9 ? 'MULTI_STEP' : 'MIXED_PIECES',
      createdAt: AT, updatedAt: AT, createdBy: '两阶段演示数据', updatedBy: '两阶段演示数据',
    }
    const horizontal = { ...structuredClone(base), stage: 'KNITTING', woolOrderId: `${pairId}:KNITTING`, woolOrderNo: `HJ260918-${key}`, taskId: `TASK-${pairId}:KNITTING`, pairedWorkOrderId: `${pairId}:LINKING` } as WoolWorkOrder
    const linking = { ...structuredClone(base), stage: 'LINKING', woolOrderId: `${pairId}:LINKING`, woolOrderNo: `FP260918-${key}`, taskId: `TASK-${pairId}:LINKING`, pairedWorkOrderId: horizontal.woolOrderId } as WoolWorkOrder
    if (n === 12) for (const order of [horizontal, linking]) order.outputPlanLines.push({ ...structuredClone(order.outputPlanLines[0]), outputSkuCode: 'CARDIGAN-CREAM-L', garmentSkuCode: 'CARDIGAN-CREAM-L', sizeCode: 'L', plannedQty: 50 })
    store.workOrders[horizontal.woolOrderId] = horizontal; store.workOrders[linking.woolOrderId] = linking
    if ([1, 2, 6, 7, 14].includes(n)) continue
    for (const line of horizontal.outputPlanLines) {
      const qty = n === 3 || n === 8 ? 40 : line.plannedQty
      const reportId = `${pairId}:report:${line.sizeCode}`
      appendStageReport(store, horizontal, { reportId, woolOrderId: horizontal.woolOrderId, outputSkuCode: line.outputSkuCode, reportedQty: qty,
        reportedAt: '2026-09-18 09:00:00', reportedBy: '横机组长', warehouseInboundFlowId: `WF-${reportId}`, createdAt: '2026-09-18 09:00:00', updatedAt: '2026-09-18 09:00:00' })
    }
    if (n === 3 || n === 8) store.machineAssociations.push({ machineId: n === 3 ? 'WM-001' : 'WM-002', woolOrderId: horizontal.woolOrderId, associatedAt: AT, associatedBy: '横机组长' })
    if (n < 9 || n > 13) continue
    for (const piece of pieces) {
      appendDemoHandover(store, horizontal, 100, piece)
      if (n === 9) continue
      for (const [index, node] of piece.routeNodes.entries()) {
        const at = `2026-09-18 ${String(10 + index).padStart(2, '0')}:30:00`
        for (const action of ['PROCESS_REPORT', 'HANDOVER'] as const) {
          const recordId = `WDEMO-CF:${piece.pieceKey}:${node.sourceEntryId}:${action}`
          const next = piece.routeNodes[index + 1]
          store.craftRecords.push({ recordId, commandId: recordId, taskOrderId: node.taskOrderId!, woolOrderId: horizontal.woolOrderId,
            pieceKey: piece.pieceKey, routeNodeId: node.sourceEntryId, action, qty: 100, operatedAt: at, operatedBy: '工艺厂组长（演示）',
            ...(action === 'HANDOVER' ? { targetFactoryId: next?.factoryId || horizontal.factoryId, targetOrderId: next?.taskOrderId || linking.woolOrderId } : {}) })
        }
      }
    }
  }
  return store
}

function appendDemoHandover(store: WoolDomainStore, order: WoolWorkOrder, qty: number, piece?: WoolExternalPiece, sku = order.outputPlanLines[0].outputSkuCode, confirmed = false): void {
  const line = order.outputPlanLines.find(item => item.outputSkuCode === sku)!
  const handoverId = `WDEMO-HO:${order.woolOrderId}:${piece?.pieceInstanceId || line.sizeCode}`
  if (store.handovers.some(item => item.handoverId === handoverId)) return
  const at = order.stage === 'KNITTING' ? '2026-09-18 09:30:00' : '2026-09-18 15:00:00'
  const target = piece?.routeNodes[0]
  const record: WoolHandoverRecord = { handoverId, woolOrderId: order.woolOrderId, outputSkuCode: sku,
    handoverQty: qty, qtyUnit: piece ? '片' : '件', receiverType: piece ? 'DOWNSTREAM_FACTORY' : order.downstreamTarget.receiverType,
    receiverId: target?.factoryId || order.downstreamTarget.receiverId, receiverName: target?.factoryName || order.downstreamTarget.receiverName,
    handedOverAt: at, handedOverBy: '毛织仓管（演示）', createdAt: at, updatedAt: at, warehouseOutboundFlowId: `WF-${handoverId}`,
    ...(piece ? { pieceKey: piece.pieceKey, routeNodeId: target!.sourceEntryId, targetWorkOrderId: target!.taskOrderId } : {}),
    downstreamReceipt: confirmed ? { receiptConfirmationId: `WDEMO-DR:${handoverId}`, status: 'CONFIRMED', actualReceivedQty: qty, differenceQty: 0, receivedAt: '2026-09-18 16:00:00', receivedBy: '指定下游仓管（演示）' } : { receiptConfirmationId: `WDEMO-DR:${handoverId}`, status: 'PENDING' },
  }
  store.handovers.push(record)
  store.warehouseFlows.push({ flowId: record.warehouseOutboundFlowId, woolOrderId: order.woolOrderId, flowType: 'OUTBOUND', businessType: 'HANDOVER', warehouseMode: 'WAIT_HANDOVER',
    defaultLocationType: piece || order.kind === 'PART_PANEL' ? 'CUT_PIECE' : 'GARMENT', defaultLocationId: piece || order.kind === 'PART_PANEL' ? 'WOOL-WH-CUT-DEFAULT' : 'WOOL-WH-GARMENT-DEFAULT',
    objectSkuCode: piece?.pieceKey || sku, qty, unit: record.qtyUnit, sourceRecordType: 'HANDOVER', sourceRecordId: handoverId, operatedAt: at, operatedBy: record.handedOverBy })
}

/** Run only after shared receiving seeds have projected into this store. */
export function finalizeWoolStageDemoFacts(store: WoolDomainStore): void {
  for (const order of Object.values(store.workOrders).filter(item => item.stage === 'KNITTING' && woolDemoNumber(item) === 13)) {
    for (const piece of order.externalPieces) for (const node of piece.routeNodes) {
      const recordId = `WDEMO-CF:${piece.pieceKey}:${node.sourceEntryId}:COMPLETE`
      if (!store.craftRecords.some(item => item.recordId === recordId)) store.craftRecords.push({ recordId, commandId: recordId,
        taskOrderId: node.taskOrderId!, woolOrderId: order.woolOrderId, pieceKey: piece.pieceKey, routeNodeId: node.sourceEntryId,
        action: 'COMPLETE', qty: 0, operatedAt: '2026-09-18 13:30:00', operatedBy: '工艺厂主管（演示）' })
    }
  }
  for (const order of Object.values(store.workOrders).filter(item => item.stage === 'LINKING')) {
    const n = woolDemoNumber(order)
    if (![5, 11, 12, 13].includes(n)) continue
    for (const line of order.outputPlanLines) {
      if (order.externalPieces.some(piece => piece.skuCode === line.outputSkuCode)) {
        const reportId = `WDEMO-LINK:${order.pairId}:${line.sizeCode}`
        if (!store.processReports.some(item => item.reportId === reportId)) appendStageReport(store, order, { reportId, woolOrderId: order.woolOrderId, outputSkuCode: line.outputSkuCode,
          reportedQty: n === 11 ? 40 : line.plannedQty, reportedAt: '2026-09-18 14:00:00', reportedBy: '缝盘组长（演示）', warehouseInboundFlowId: `WF-${reportId}`, createdAt: '2026-09-18 14:00:00', updatedAt: '2026-09-18 14:00:00' })
      }
      appendDemoHandover(store, order, n === 11 ? 20 : n === 12 ? Math.min(80, line.plannedQty) : line.plannedQty, undefined, line.outputSkuCode, n === 5 || n === 13)
    }
  }
  for (const order of Object.values(store.workOrders)) {
    const n = woolDemoNumber(order)
    if (!(n === 5 || n === 13 || order.stage === 'KNITTING' && [9, 10, 11].includes(n))) continue
    if (store.completions.some(item => item.woolOrderId === order.woolOrderId) || stageCompletionBlock(store, order)) continue
    const handovers = store.handovers.filter(item => item.woolOrderId === order.woolOrderId)
    store.completions.push({ completionId: `WDEMO-COMPLETE:${order.woolOrderId}`, woolOrderId: order.woolOrderId, completedAt: '2026-09-18 16:30:00', completedBy: '毛织主管（演示）',
      remark: order.stage === 'KNITTING' ? '横机阶段闭合；外加工与缝盘继续独立执行' : '缝盘最终交接已闭合', confirmationSnapshot: {
        yarnReceiptSummary: store.yarnReceipts.filter(item => item.woolOrderId === order.woolOrderId).flatMap(item => item.lines.map(line => ({ yarnSkuCode: line.yarnSkuCode, receivedQty: line.receivedQty, qtyUnit: 'kg' as const }))),
        outputReadinessSummary: order.outputPlanLines.map(line => ({ outputSkuCode: line.outputSkuCode, requiredYarnSkus: order.stage === 'KNITTING' ? line.requiredYarnSkus : [], confirmedYarnSkus: order.stage === 'KNITTING' ? line.requiredYarnSkus : [], missingYarnSkus: [] })),
        processReportSummary: order.outputPlanLines.map(line => ({ outputSkuCode: line.outputSkuCode, reportedQty: stageReportedQty(store, order.woolOrderId, line.outputSkuCode), qtyUnit: '件' as const })),
        handoverSummary: handovers.map(item => ({ handoverId: item.handoverId, outputSkuCode: item.outputSkuCode, handoverQty: item.handoverQty, qtyUnit: item.qtyUnit, downstreamActualReceivedQty: item.downstreamReceipt?.actualReceivedQty, downstreamDifferenceQty: item.downstreamReceipt?.differenceQty, downstreamReceivedAt: item.downstreamReceipt?.receivedAt })),
        waitProcessStockSummary: order.stage === 'KNITTING' ? (order.yarnMaterials || []).map(item => ({ yarnSkuCode: item.sku, qtyUnit: 'kg' as const, stockQty: store.warehouseFlows.filter(flow => flow.woolOrderId === order.woolOrderId && flow.objectSkuCode === item.sku).reduce((sum, flow) => sum + woolWarehouseFlowSignedQty(flow), 0) })) : [],
        waitHandoverStockSummary: order.outputPlanLines.map(line => ({ outputSkuCode: line.outputSkuCode, stockQty: stageReportedQty(store, order.woolOrderId, line.outputSkuCode) - stageHandoverQty(store, order.woolOrderId, line.outputSkuCode), qtyUnit: '件' as const })),
        releasedMachineIds: [], releasedMachines: [],
      } })
  }
}
export function resetWoolFactWorkflowMockStore(): WoolDomainStore { return replaceWoolStore(buildWoolFactWorkflowMockStore()) }
