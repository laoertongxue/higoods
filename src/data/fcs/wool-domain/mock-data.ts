import type { WoolDomainStore } from './store.ts'
import type {
  WoolCompletionRecord,
  WoolHandoverRecord,
  WoolOutputPlanLine,
  WoolProcessReportRecord,
  WoolWarehouseFlow,
  WoolWorkOrder,
  WoolWorkOrderKind,
  WoolYarnReceiptRecord,
} from './types.ts'
import {
  getWoolHandoverEffectiveQty,
  getWoolProcessReportEffectiveQty,
  getWoolYarnReceiptLineEffectiveQty,
} from './queries.ts'
import { replaceWoolStore } from './store.ts'

export const WOOL_MOCK_SCENARIO_CODES = [
  'NO_YARN_RECEIPT',
  'PARTIAL_YARN_RECEIPT',
  'ONE_COLOR_READY',
  'MULTI_YARN_SINGLE_RECEIPT',
  'SPLIT_BATCH_RECEIPTS',
  'REPORTS_AT_LIMIT',
  'ALL_READY_SKUS_AT_LIMIT',
  'MULTIPLE_HANDOVERS_WITH_STOCK',
  'READY_TO_COMPLETE',
  'COMPLETED_RELEASED_MACHINES',
  'MACHINE_ASSOCIATION_A',
  'MACHINE_UNAVAILABLE',
  'MACHINE_STATUS_AUTO_RELEASE',
  'MACHINE_ASSOCIATION_B',
  'NO_TECH_PACK_MAPPING',
  'PART_PANEL_CAPACITY',
  'REPORT_DEFAULT_LOCATION',
  'QTY_CHANGE_STOCK_SYNC',
  'DOWNSTREAM_CONFIRMED_LOCKED',
  'COMPLETED_WITH_STOCK',
  'TECH_PACK_FALLBACK_REJECTED',
  'INVALID_MAPPING_REJECTED',
  'MIXED_ORDER_KINDS',
  'YARN_ISSUE_RETURN',
  'FIXED_LOCATION_UI',
  'MISSING_DOWNSTREAM_TARGET',
] as const

export type WoolMockScenarioCode = (typeof WOOL_MOCK_SCENARIO_CODES)[number]

const MOCK_AT = '2026-07-30 08:00:00'

function outputLine(
  sequence: number,
  colorCode: 'BLACK' | 'WHITE',
  kind: WoolWorkOrderKind,
  requiredYarnSkus: string[],
  sizeCode: 'M' | 'L' = 'M',
): WoolOutputPlanLine {
  const garmentSkuCode = `HG-WOOL-${String(sequence).padStart(2, '0')}-${colorCode}-${sizeCode}`
  const isPanel = kind === 'PART_PANEL'
  return {
    outputSkuCode: isPanel ? `WP-SLEEVE-${garmentSkuCode}` : garmentSkuCode,
    outputObjectType: isPanel ? 'WOOL_PANEL' : 'GARMENT',
    garmentSkuCode,
    ...(isPanel ? { woolPartCode: 'SLEEVE', woolPartName: '袖片' } : {}),
    colorCode,
    colorName: colorCode === 'BLACK' ? '黑色' : '白色',
    sizeCode,
    plannedQty: 100,
    qtyUnit: '件',
    requiredYarnSkus,
    sourceTechPackVersionId: `TPV-WOOL-${String(sequence).padStart(2, '0')}`,
    sourceTechPackVersionCode: `WOOL-TP-${String(sequence).padStart(2, '0')}-V1`,
    sourceColorMappingIds: requiredYarnSkus.length > 0 ? [`MAP-WOOL-${sequence}-${colorCode}`] : [],
    sourceBomItemIds: requiredYarnSkus.map((sku) => `BOM-${sku}`),
  }
}

function workOrder(sequence: number, code: WoolMockScenarioCode): WoolWorkOrder {
  const kind: WoolWorkOrderKind = code === 'PART_PANEL_CAPACITY' || code === 'MIXED_ORDER_KINDS'
    ? 'PART_PANEL'
    : 'WHOLE_GARMENT'
  const hasInvalidSource = [
    'NO_TECH_PACK_MAPPING',
    'TECH_PACK_FALLBACK_REJECTED',
    'INVALID_MAPPING_REJECTED',
  ].includes(code)
  const outputPlanLines = hasInvalidSource
    ? [outputLine(sequence, 'BLACK', kind, [])]
    : [
        outputLine(sequence, 'BLACK', kind, ['YARN-A', 'YARN-B']),
        outputLine(
          sequence,
          'WHITE',
          kind,
          ['YARN-A', 'YARN-C'],
          code === 'MULTIPLE_HANDOVERS_WITH_STOCK' ? 'L' : 'M',
        ),
      ]
  const sourceFactCode = code === 'NO_TECH_PACK_MAPPING'
    ? 'NO-MAPPING'
    : code === 'TECH_PACK_FALLBACK_REJECTED'
      ? 'DEMAND-FALLBACK-REJECTED'
      : code === 'INVALID_MAPPING_REJECTED'
        ? 'INVALID-MAPPING-REJECTED'
        : ''
  if (sourceFactCode) {
    for (const line of outputPlanLines) {
      line.sourceTechPackVersionId = `TPV-WOOL-${String(sequence).padStart(2, '0')}-${sourceFactCode}`
      line.sourceTechPackVersionCode = `WOOL-TP-${String(sequence).padStart(2, '0')}-${sourceFactCode}`
      if (code === 'INVALID_MAPPING_REJECTED') {
        line.sourceColorMappingIds = [`MAP-INVALID-${sequence}-${line.colorCode}`]
      }
    }
  }
  return {
    woolOrderId: `WOOL-MOCK-${String(sequence).padStart(2, '0')}`,
    woolOrderNo: code === 'ONE_COLOR_READY'
      ? 'WMO-CHECK-READY'
      : `WMO-${String(sequence).padStart(3, '0')}`,
    taskId: `TASK-WOOL-MOCK-${String(sequence).padStart(2, '0')}`,
    taskNo: `MT-WOOL-${String(sequence).padStart(3, '0')}`,
    productionOrderId: `PO-WOOL-MOCK-${String(sequence).padStart(2, '0')}`,
    productionOrderNo: `PO-WOOL-${String(sequence).padStart(3, '0')}`,
    styleNo: `HG-WOOL-${String(sequence).padStart(3, '0')}`,
    styleName: kind === 'PART_PANEL' ? '针织袖片款' : '针织圆领衫',
    styleImageUrl: '/cardigan-sample.jpg',
    internalStyleCode: `W${String(sequence).padStart(3, '0')}`,
    factoryId: 'OWN_WOOL_FACTORY',
    factoryName: '周哥毛织厂',
    plannedStartAt: `2026-08-${String((sequence % 9) + 1).padStart(2, '0')}`,
    plannedCompletionAt: `2026-08-${String((sequence % 18) + 10).padStart(2, '0')}`,
    kind,
    outputPlanLines,
    downstreamTarget: kind === 'PART_PANEL'
      ? {
          receiverType: 'CUTTING_WAIT_HANDOVER_WAREHOUSE',
          receiverId: 'CUTTING-WAIT-HANDOVER',
          receiverName: '裁床待交出仓',
        }
      : {
          receiverType: 'DOWNSTREAM_FACTORY',
          receiverId: code === 'MISSING_DOWNSTREAM_TARGET' ? '' : `DOWNSTREAM-${sequence}`,
          receiverName: code === 'MISSING_DOWNSTREAM_TARGET' ? '' : '后道加工厂',
        },
    sourceTechPackVersionId: outputPlanLines[0].sourceTechPackVersionId,
    sourceTechPackVersionCode: outputPlanLines[0].sourceTechPackVersionCode,
    mockScenarioCode: code,
    createdAt: MOCK_AT,
    createdBy: '毛织 Mock 生成器',
    updatedAt: MOCK_AT,
    updatedBy: '毛织 Mock 生成器',
  }
}

function receipt(
  order: WoolWorkOrder,
  suffix: string,
  yarnSkus: string[],
  batchNo = `BATCH-${suffix}`,
): WoolYarnReceiptRecord {
  return {
    receiptId: `WR-${order.woolOrderId}-${suffix}`,
    receiptNo: `WR-${order.woolOrderNo}-${suffix}`,
    woolOrderId: order.woolOrderId,
    deliveryNo: `DN-${suffix}`,
    batchNo,
    receivedAt: MOCK_AT,
    receivedBy: '毛织仓管',
    lines: yarnSkus.map((yarnSkuCode, index) => ({
      lineId: `WRL-${order.woolOrderId}-${suffix}-${index + 1}`,
      yarnSkuCode,
      yarnName: `${yarnSkuCode} 纱线`,
      receivedQty: 1,
      qtyUnit: 'kg',
      warehouseInboundFlowId: `WF-WR-${order.woolOrderId}-${suffix}-${index + 1}`,
    })),
    createdAt: MOCK_AT,
    updatedAt: MOCK_AT,
  }
}

function report(order: WoolWorkOrder, line: WoolOutputPlanLine, suffix: string, qty: number): WoolProcessReportRecord {
  return {
    reportId: `WPR-${order.woolOrderId}-${suffix}`,
    woolOrderId: order.woolOrderId,
    outputSkuCode: line.outputSkuCode,
    reportedQty: qty,
    reportedAt: MOCK_AT,
    reportedBy: '毛织主管',
    warehouseInboundFlowId: `WF-WPR-${order.woolOrderId}-${suffix}`,
    createdAt: MOCK_AT,
    updatedAt: MOCK_AT,
  }
}

function handover(order: WoolWorkOrder, line: WoolOutputPlanLine, suffix: string, qty: number): WoolHandoverRecord {
  return {
    handoverId: `WHO-${order.woolOrderId}-${suffix}`,
    woolOrderId: order.woolOrderId,
    outputSkuCode: line.outputSkuCode,
    handoverQty: qty,
    qtyUnit: line.qtyUnit,
    ...order.downstreamTarget,
    handedOverAt: MOCK_AT,
    handedOverBy: '毛织主管',
    warehouseOutboundFlowId: `WF-WHO-${order.woolOrderId}-${suffix}`,
    createdAt: MOCK_AT,
    updatedAt: MOCK_AT,
  }
}

function flowForReceipt(order: WoolWorkOrder, record: WoolYarnReceiptRecord): WoolWarehouseFlow[] {
  return record.lines.map((line) => ({
    flowId: line.warehouseInboundFlowId,
    woolOrderId: order.woolOrderId,
    flowType: 'INBOUND',
    businessType: 'YARN_RECEIPT',
    warehouseMode: 'WAIT_PROCESS',
    defaultLocationType: 'YARN',
    defaultLocationId: 'WOOL-WP-YARN-DEFAULT',
    objectSkuCode: line.yarnSkuCode,
    batchNo: record.batchNo,
    qty: line.receivedQty,
    unit: 'kg',
    sourceRecordType: 'YARN_RECEIPT',
    sourceRecordId: line.lineId,
    operatedAt: record.receivedAt,
    operatedBy: record.receivedBy,
  }))
}

function flowForReport(order: WoolWorkOrder, record: WoolProcessReportRecord): WoolWarehouseFlow {
  const line = order.outputPlanLines.find((item) => item.outputSkuCode === record.outputSkuCode)!
  return {
    flowId: record.warehouseInboundFlowId,
    woolOrderId: order.woolOrderId,
    flowType: 'INBOUND',
    businessType: 'PROCESS_REPORT',
    warehouseMode: 'WAIT_HANDOVER',
    defaultLocationType: line.outputObjectType === 'GARMENT' ? 'GARMENT' : 'CUT_PIECE',
    defaultLocationId: line.outputObjectType === 'GARMENT'
      ? 'WOOL-WH-GARMENT-DEFAULT'
      : 'WOOL-WH-CUT-DEFAULT',
    objectSkuCode: line.outputSkuCode,
    qty: record.reportedQty,
    unit: line.qtyUnit,
    sourceRecordType: 'PROCESS_REPORT',
    sourceRecordId: record.reportId,
    operatedAt: record.reportedAt,
    operatedBy: record.reportedBy,
  }
}

function flowForHandover(order: WoolWorkOrder, record: WoolHandoverRecord): WoolWarehouseFlow {
  const line = order.outputPlanLines.find((item) => item.outputSkuCode === record.outputSkuCode)!
  return {
    flowId: record.warehouseOutboundFlowId,
    woolOrderId: order.woolOrderId,
    flowType: 'OUTBOUND',
    businessType: 'HANDOVER',
    warehouseMode: 'WAIT_HANDOVER',
    defaultLocationType: line.outputObjectType === 'GARMENT' ? 'GARMENT' : 'CUT_PIECE',
    defaultLocationId: line.outputObjectType === 'GARMENT'
      ? 'WOOL-WH-GARMENT-DEFAULT'
      : 'WOOL-WH-CUT-DEFAULT',
    objectSkuCode: line.outputSkuCode,
    qty: record.handoverQty,
    unit: line.qtyUnit,
    sourceRecordType: 'HANDOVER',
    sourceRecordId: record.handoverId,
    operatedAt: record.handedOverAt,
    operatedBy: record.handedOverBy,
  }
}

function signedFlowQty(flow: WoolWarehouseFlow): number {
  if (flow.flowType === 'INBOUND') return Math.abs(flow.qty)
  if (flow.flowType === 'OUTBOUND') return -Math.abs(flow.qty)
  if (flow.flowType === 'TRANSFER') {
    if (flow.fromLocationId === flow.defaultLocationId) return -Math.abs(flow.qty)
    if (flow.toLocationId === flow.defaultLocationId) return Math.abs(flow.qty)
    return 0
  }
  return flow.qty
}

function completion(
  store: WoolDomainStore,
  order: WoolWorkOrder,
  releasedMachineIds: string[] = [],
): WoolCompletionRecord {
  const receipts = store.yarnReceipts.filter((item) => item.woolOrderId === order.woolOrderId)
  const confirmedYarnSkus = new Set(
    receipts.flatMap((receiptRecord) =>
      receiptRecord.lines
        .filter((line) => getWoolYarnReceiptLineEffectiveQty(store, receiptRecord, line) > 0)
        .map((line) => line.yarnSkuCode),
    ),
  )
  const yarnReceiptQty = new Map<string, number>()
  for (const receiptRecord of receipts) {
    for (const line of receiptRecord.lines) {
      const effectiveQty = getWoolYarnReceiptLineEffectiveQty(store, receiptRecord, line)
      yarnReceiptQty.set(line.yarnSkuCode, (yarnReceiptQty.get(line.yarnSkuCode) ?? 0) + effectiveQty)
    }
  }
  const reportQty = new Map<string, number>()
  for (const record of store.processReports.filter((item) => item.woolOrderId === order.woolOrderId)) {
    reportQty.set(
      record.outputSkuCode,
      (reportQty.get(record.outputSkuCode) ?? 0) + getWoolProcessReportEffectiveQty(store, record),
    )
  }
  const orderHandovers = store.handovers.filter((item) => item.woolOrderId === order.woolOrderId)
  const stockQty = new Map<string, number>()
  for (const flow of store.warehouseFlows.filter((item) => item.woolOrderId === order.woolOrderId)) {
    stockQty.set(flow.objectSkuCode, (stockQty.get(flow.objectSkuCode) ?? 0) + signedFlowQty(flow))
  }
  return {
    completionId: `WCOMP-MOCK-${encodeURIComponent(order.woolOrderId)}`,
    woolOrderId: order.woolOrderId,
    completedAt: '2026-07-30 18:00:00',
    completedBy: '毛织主管',
    remark: '业务人员已核对当前事实并确认完成',
    confirmationSnapshot: {
      yarnReceiptSummary: [...yarnReceiptQty].map(([yarnSkuCode, receivedQty]) => ({
        yarnSkuCode,
        receivedQty,
        qtyUnit: 'kg',
      })),
      outputReadinessSummary: order.outputPlanLines.map((line) => ({
        outputSkuCode: line.outputSkuCode,
        requiredYarnSkus: [...line.requiredYarnSkus],
        confirmedYarnSkus: line.requiredYarnSkus.filter((sku) => confirmedYarnSkus.has(sku)),
        missingYarnSkus: line.requiredYarnSkus.filter((sku) => !confirmedYarnSkus.has(sku)),
      })),
      processReportSummary: order.outputPlanLines
        .filter((line) => (reportQty.get(line.outputSkuCode) ?? 0) > 0)
        .map((line) => ({
          outputSkuCode: line.outputSkuCode,
          reportedQty: reportQty.get(line.outputSkuCode) ?? 0,
          qtyUnit: line.qtyUnit,
        })),
      handoverSummary: orderHandovers.map((record) => ({
        handoverId: record.handoverId,
        outputSkuCode: record.outputSkuCode,
        handoverQty: getWoolHandoverEffectiveQty(store, record),
        qtyUnit: record.qtyUnit,
        downstreamActualReceivedQty: record.downstreamReceipt?.actualReceivedQty,
        downstreamDifferenceQty: record.downstreamReceipt?.differenceQty,
        downstreamReceivedAt: record.downstreamReceipt?.receivedAt,
      })),
      waitProcessStockSummary: [...stockQty]
        .filter(([objectSkuCode, qty]) =>
          qty !== 0
          && receipts.some((record) => record.lines.some((line) => line.yarnSkuCode === objectSkuCode)),
        )
        .map(([yarnSkuCode, stock]) => ({ yarnSkuCode, stockQty: stock, qtyUnit: 'kg' })),
      waitHandoverStockSummary: order.outputPlanLines
        .filter((line) => (stockQty.get(line.outputSkuCode) ?? 0) !== 0)
        .map((line) => ({
          outputSkuCode: line.outputSkuCode,
          stockQty: stockQty.get(line.outputSkuCode) ?? 0,
          qtyUnit: line.qtyUnit,
        })),
      releasedMachineIds: [...releasedMachineIds],
      releasedMachines: releasedMachineIds.map((machineId) => {
        const machine = store.machines.find((item) => item.machineId === machineId)
        if (!machine) throw new Error(`Mock 完成快照找不到横机设备 ${machineId}`)
        return {
          machineId,
          machineNo: machine.machineNo,
          machineName: machine.machineName,
        }
      }),
    },
  }
}

export function buildWoolFactWorkflowMockStore(_seed = 'DEFAULT'): WoolDomainStore {
  const orders = WOOL_MOCK_SCENARIO_CODES.map((code, index) => workOrder(index + 1, code))
  const mixedPanelOrder = orders.find((order) => order.mockScenarioCode === 'MIXED_ORDER_KINDS')!
  const mixedWholeOrder: WoolWorkOrder = {
    ...mixedPanelOrder,
    woolOrderId: `${mixedPanelOrder.woolOrderId}-WHOLE`,
    woolOrderNo: `${mixedPanelOrder.woolOrderNo}-整件`,
    taskId: `${mixedPanelOrder.taskId}-WHOLE`,
    taskNo: `${mixedPanelOrder.taskNo}-整件`,
    kind: 'WHOLE_GARMENT',
    outputPlanLines: mixedPanelOrder.outputPlanLines.map((panelLine) => {
      const wholeLine: WoolOutputPlanLine = {
        ...panelLine,
        outputSkuCode: panelLine.garmentSkuCode,
        outputObjectType: 'GARMENT',
        plannedQty: Math.floor(panelLine.plannedQty / 2),
        qtyUnit: '件',
      }
      delete wholeLine.woolPartCode
      delete wholeLine.woolPartName
      return wholeLine
    }),
    downstreamTarget: {
      receiverType: 'DOWNSTREAM_FACTORY',
      receiverId: 'DOWNSTREAM-MIXED-WHOLE',
      receiverName: '后道加工厂',
    },
    mockScenarioCode: undefined,
  }
  orders.push(mixedWholeOrder)
  const fixedWholeOrder = orders.find((order) => order.mockScenarioCode === 'FIXED_LOCATION_UI')!
  const fixedPanelOrder: WoolWorkOrder = {
    ...fixedWholeOrder,
    woolOrderId: `${fixedWholeOrder.woolOrderId}-PANEL`,
    woolOrderNo: `${fixedWholeOrder.woolOrderNo}-部位`,
    taskId: `${fixedWholeOrder.taskId}-PANEL`,
    taskNo: `${fixedWholeOrder.taskNo}-部位`,
    kind: 'PART_PANEL',
    outputPlanLines: fixedWholeOrder.outputPlanLines.map((wholeLine) => ({
      ...wholeLine,
      outputSkuCode: `WP-SLEEVE-${wholeLine.garmentSkuCode}`,
      outputObjectType: 'WOOL_PANEL',
      woolPartCode: 'SLEEVE',
      woolPartName: '袖片',
      plannedQty: wholeLine.plannedQty,
      qtyUnit: '件',
    })),
    downstreamTarget: {
      receiverType: 'CUTTING_WAIT_HANDOVER_WAREHOUSE',
      receiverId: 'CUTTING-WAIT-HANDOVER',
      receiverName: '裁床待交出仓',
    },
  }
  orders.push(fixedPanelOrder)
  const store: WoolDomainStore = {
    workOrders: Object.fromEntries(orders.map((order) => [order.woolOrderId, order])),
    yarnReceipts: [],
    yarnIssues: [],
    yarnReturns: [],
    processReports: [],
    handovers: [],
    qtyChangeLogs: [],
    warehouseFlows: [],
    completions: [],
    machines: Array.from({ length: 8 }, (_, index) => ({
      machineId: `WM-${String(index + 1).padStart(3, '0')}`,
      machineNo: `横机-${String(index + 1).padStart(3, '0')}`,
      machineName: `电脑横机 ${index + 1} 号`,
      machineModel: ['慈星 GE2-52C', '岛精 SES-SWG', '慈星 HP2-52C'][index % 3],
      needleType: ['12 针', '14 针', '16 针'][index % 3],
      status: index === 5 ? 'REPAIR' : index === 6 ? 'DISABLED' : 'IDLE',
      createdAt: MOCK_AT,
      updatedAt: MOCK_AT,
    })),
    machineAssociations: [],
    machineAssociationLogs: [],
    operationLogs: [],
  }

  const addReceipt = (order: WoolWorkOrder, suffix: string, yarns: string[], batchNo?: string) => {
    const record = receipt(order, suffix, yarns, batchNo)
    store.yarnReceipts.push(record)
    store.warehouseFlows.push(...flowForReceipt(order, record))
  }
  const addReport = (order: WoolWorkOrder, lineIndex: number, suffix: string, qty: number) => {
    const record = report(order, order.outputPlanLines[lineIndex], suffix, qty)
    store.processReports.push(record)
    store.warehouseFlows.push(flowForReport(order, record))
  }
  const addHandover = (order: WoolWorkOrder, lineIndex: number, suffix: string, qty: number) => {
    const record = handover(order, order.outputPlanLines[lineIndex], suffix, qty)
    store.handovers.push(record)
    store.warehouseFlows.push(flowForHandover(order, record))
    return record
  }

  for (const order of orders) {
    switch (order.mockScenarioCode as WoolMockScenarioCode) {
      case 'PARTIAL_YARN_RECEIPT':
        addReceipt(order, 'A', ['YARN-A'])
        break
      case 'ONE_COLOR_READY':
        addReceipt(order, 'AC', ['YARN-A', 'YARN-C'])
        break
      case 'MULTI_YARN_SINGLE_RECEIPT':
        addReceipt(order, 'ABC', ['YARN-A', 'YARN-B', 'YARN-C'])
        break
      case 'SPLIT_BATCH_RECEIPTS':
        addReceipt(order, 'A1', ['YARN-A'], 'BATCH-A1')
        addReceipt(order, 'A2', ['YARN-A'], 'BATCH-A2')
        addReceipt(order, 'BC', ['YARN-B', 'YARN-C'], 'BATCH-BC')
        break
      case 'REPORTS_AT_LIMIT':
        addReceipt(order, 'ABC', ['YARN-A', 'YARN-B', 'YARN-C'])
        addReport(order, 0, '1', 50)
        addReport(order, 0, '2', 100)
        break
      case 'ALL_READY_SKUS_AT_LIMIT':
        addReceipt(order, 'ABC', ['YARN-A', 'YARN-B', 'YARN-C'])
        addReport(order, 0, 'BLACK-LIMIT', Math.floor(order.outputPlanLines[0].plannedQty * 1.5))
        addReport(order, 1, 'WHITE-LIMIT', Math.floor(order.outputPlanLines[1].plannedQty * 1.5))
        break
      case 'MULTIPLE_HANDOVERS_WITH_STOCK':
        addReceipt(order, 'ABC', ['YARN-A', 'YARN-B', 'YARN-C'])
        addReport(order, 0, 'STOCK-BLACK-M', 100)
        addReport(order, 1, 'STOCK-WHITE-L', 40)
        addHandover(order, 0, '1', 30)
        addHandover(order, 1, '2', 20)
        break
      case 'READY_TO_COMPLETE':
        addReceipt(order, 'AB', ['YARN-A', 'YARN-B'])
        addReport(order, 0, 'READY', 60)
        addHandover(order, 0, 'READY', 40)
        break
      case 'COMPLETED_RELEASED_MACHINES':
        addReceipt(order, 'DONE-ABC', ['YARN-A', 'YARN-B', 'YARN-C'])
        addReport(order, 0, 'DONE', 10)
        addHandover(order, 0, 'DONE', 1)
        store.machineAssociations.push(
          {
            machineId: 'WM-001',
            woolOrderId: order.woolOrderId,
            associatedAt: MOCK_AT,
            associatedBy: '毛织主管',
          },
          {
            machineId: 'WM-002',
            woolOrderId: order.woolOrderId,
            associatedAt: MOCK_AT,
            associatedBy: '毛织主管',
          },
        )
        for (const machineId of ['WM-001', 'WM-002']) {
          store.machineAssociationLogs.push({
            logId: `WMAL-COMPLETED-${machineId}`,
            machineId,
            fromWoolOrderId: order.woolOrderId,
            action: 'UNASSOCIATE',
            reason: 'ORDER_COMPLETED',
            operatedAt: '2026-07-30 18:00:00',
            operatedBy: '毛织主管',
          })
        }
        store.machineAssociations = store.machineAssociations.filter((item) => item.woolOrderId !== order.woolOrderId)
        store.completions.push(completion(store, order, ['WM-001', 'WM-002']))
        break
      case 'MACHINE_ASSOCIATION_A':
        store.machineAssociations.push({
          machineId: 'WM-001',
          woolOrderId: order.woolOrderId,
          associatedAt: '2026-07-30 19:00:00',
          associatedBy: '毛织主管',
        })
        store.machineAssociationLogs.push({
          logId: 'WMAL-MOCK-REASSOCIATE-WM-001',
          machineId: 'WM-001',
          toWoolOrderId: order.woolOrderId,
          action: 'ASSOCIATE',
          reason: 'MANUAL_SAVE',
          operatedAt: '2026-07-30 19:00:00',
          operatedBy: '毛织主管',
        })
        break
      case 'MACHINE_STATUS_AUTO_RELEASE':
        store.machineAssociations.push(
          {
            machineId: 'WM-006',
            woolOrderId: order.woolOrderId,
            associatedAt: '2026-07-30 07:30:00',
            associatedBy: '毛织主管',
          },
          {
            machineId: 'WM-007',
            woolOrderId: order.woolOrderId,
            associatedAt: '2026-07-30 07:30:00',
            associatedBy: '毛织主管',
          },
        )
        store.machines.find((machine) => machine.machineId === 'WM-006')!.status = 'REPAIR'
        store.machines.find((machine) => machine.machineId === 'WM-007')!.status = 'DISABLED'
        store.machineAssociationLogs.push(
          {
            logId: 'WMAL-AUTO-ASSOCIATE-REPAIR',
            machineId: 'WM-006',
            toWoolOrderId: order.woolOrderId,
            action: 'ASSOCIATE',
            reason: 'MANUAL_SAVE',
            operatedAt: '2026-07-30 07:30:00',
            operatedBy: '毛织主管',
          },
          {
            logId: 'WMAL-AUTO-ASSOCIATE-DISABLED',
            machineId: 'WM-007',
            toWoolOrderId: order.woolOrderId,
            action: 'ASSOCIATE',
            reason: 'MANUAL_SAVE',
            operatedAt: '2026-07-30 07:30:00',
            operatedBy: '毛织主管',
          },
          {
            logId: 'WMAL-AUTO-RELEASE-REPAIR',
            machineId: 'WM-006',
            fromWoolOrderId: order.woolOrderId,
            action: 'UNASSOCIATE',
            reason: 'MACHINE_REPAIR',
            operatedAt: MOCK_AT,
            operatedBy: '设备主管',
          },
          {
            logId: 'WMAL-AUTO-RELEASE-DISABLED',
            machineId: 'WM-007',
            fromWoolOrderId: order.woolOrderId,
            action: 'UNASSOCIATE',
            reason: 'MACHINE_DISABLED',
            operatedAt: MOCK_AT,
            operatedBy: '设备主管',
          },
        )
        store.machineAssociations = store.machineAssociations.filter((item) =>
          item.machineId !== 'WM-006' && item.machineId !== 'WM-007',
        )
        break
      case 'MACHINE_ASSOCIATION_B': {
        const fromOrder = orders.find((item) => item.mockScenarioCode === 'MACHINE_ASSOCIATION_A')!
        store.machineAssociations.push({
          machineId: 'WM-002',
          woolOrderId: order.woolOrderId,
          associatedAt: '2026-07-30 19:10:00',
          associatedBy: '毛织主管',
        }, {
          machineId: 'WM-004',
          woolOrderId: order.woolOrderId,
          associatedAt: MOCK_AT,
          associatedBy: '毛织主管',
        })
        store.machineAssociationLogs.push(
          {
            logId: 'WMAL-MOCK-REASSOCIATE-WM-002',
            machineId: 'WM-002',
            toWoolOrderId: order.woolOrderId,
            action: 'ASSOCIATE',
            reason: 'MANUAL_SAVE',
            operatedAt: '2026-07-30 19:10:00',
            operatedBy: '毛织主管',
          },
          {
            logId: 'WMAL-MOCK-ASSOCIATE-OLD',
            machineId: 'WM-004',
            toWoolOrderId: fromOrder.woolOrderId,
            action: 'ASSOCIATE',
            reason: 'MANUAL_SAVE',
            operatedAt: '2026-07-30 07:30:00',
            operatedBy: '毛织主管',
          },
          {
            logId: 'WMAL-MOCK-TRANSFER',
            machineId: 'WM-004',
            fromWoolOrderId: fromOrder.woolOrderId,
            toWoolOrderId: order.woolOrderId,
            action: 'TRANSFER',
            reason: 'MANUAL_SAVE',
            operatedAt: MOCK_AT,
            operatedBy: '毛织主管',
          },
        )
        break
      }
      case 'PART_PANEL_CAPACITY':
      case 'REPORT_DEFAULT_LOCATION':
        addReceipt(order, 'ABC', ['YARN-A', 'YARN-B', 'YARN-C'])
        addReport(order, 0, 'DEFAULT', 10)
        break
      case 'QTY_CHANGE_STOCK_SYNC': {
        addReceipt(order, 'CHANGE-AB', ['YARN-A', 'YARN-B'])
        addReport(order, 0, 'CHANGE', 10)
        const handed = addHandover(order, 0, 'CHANGE', 4)
        const changedReport = store.processReports.find((item) =>
          item.woolOrderId === order.woolOrderId && item.outputSkuCode === handed.outputSkuCode,
        )!
        const reportBaseFlow = store.warehouseFlows.find((flow) =>
          flow.flowId === changedReport.warehouseInboundFlowId,
        )!
        const handoverBaseFlow = store.warehouseFlows.find((flow) =>
          flow.flowId === handed.warehouseOutboundFlowId,
        )!
        store.qtyChangeLogs.push(
          {
            changeId: 'WQC-MOCK-REPORT-STOCK-SYNC',
            recordType: 'PROCESS_REPORT',
            recordId: changedReport.reportId,
            objectSkuCode: changedReport.outputSkuCode,
            beforeQty: 10,
            afterQty: 12,
            qtyUnit: order.outputPlanLines[0].qtyUnit,
            reason: '复核加工填报数量',
            changedAt: MOCK_AT,
            changedBy: '毛织主管',
          },
          {
            changeId: 'WQC-MOCK-HANDOVER-STOCK-SYNC',
            recordType: 'HANDOVER',
            recordId: handed.handoverId,
            objectSkuCode: handed.outputSkuCode,
            beforeQty: 4,
            afterQty: 5,
            qtyUnit: handed.qtyUnit,
            reason: '复核交出数量',
            changedAt: MOCK_AT,
            changedBy: '毛织主管',
          },
        )
        store.warehouseFlows.push(
          {
            ...reportBaseFlow,
            flowId: 'WF-WQC-MOCK-REPORT-STOCK-SYNC',
            flowType: 'ADJUSTMENT',
            businessType: 'STOCK_ADJUSTMENT',
            qty: 2,
            sourceRecordType: 'QTY_CHANGE',
            sourceRecordId: 'WQC-MOCK-REPORT-STOCK-SYNC',
            reason: '加工填报数量由 10 修改为 12',
          },
          {
            ...handoverBaseFlow,
            flowId: 'WF-WQC-MOCK-HANDOVER-STOCK-SYNC',
            flowType: 'ADJUSTMENT',
            businessType: 'STOCK_ADJUSTMENT',
            qty: -1,
            sourceRecordType: 'QTY_CHANGE',
            sourceRecordId: 'WQC-MOCK-HANDOVER-STOCK-SYNC',
            reason: '交出数量由 4 修改为 5',
          },
        )
        store.completions.push(completion(store, order))
        break
      }
      case 'DOWNSTREAM_CONFIRMED_LOCKED': {
        addReceipt(order, 'LOCKED-AB', ['YARN-A', 'YARN-B'])
        addReport(order, 0, 'LOCKED', 10)
        const handed = addHandover(order, 0, 'LOCKED', 8)
        handed.downstreamReceipt = {
          receiptConfirmationId: 'DRC-MOCK-LOCKED',
          status: 'CONFIRMED',
          actualReceivedQty: 7,
          differenceQty: -1,
          receivedAt: MOCK_AT,
          receivedBy: '下游收货员',
        }
        break
      }
      case 'COMPLETED_WITH_STOCK':
        addReceipt(order, 'DONE-STOCK-ABC', ['YARN-A', 'YARN-B', 'YARN-C'])
        addReport(order, 0, 'DONE-STOCK', 30)
        addHandover(order, 0, 'DONE-STOCK', 10)
        store.warehouseFlows.push({
          flowId: 'WF-COMPLETED-STOCK-TRANSFER-OUT-5',
          woolOrderId: order.woolOrderId,
          flowType: 'TRANSFER',
          businessType: 'STOCK_TRANSFER',
          warehouseMode: 'WAIT_HANDOVER',
          defaultLocationType: 'GARMENT',
          defaultLocationId: 'WOOL-WH-GARMENT-DEFAULT',
          objectSkuCode: order.outputPlanLines[0].outputSkuCode,
          qty: 5,
          unit: order.outputPlanLines[0].qtyUnit,
          sourceRecordType: 'STOCK_TRANSFER',
          sourceRecordId: 'STOCK-TRANSFER-COMPLETED-OUT-5',
          fromWarehouseId: 'WOOL-WAIT-HANDOVER',
          fromLocationId: 'WOOL-WH-GARMENT-DEFAULT',
          toWarehouseId: 'FIW-OWN_WOOL_FACTORY-WAIT_HANDOVER',
          toLocationId: 'LOC-A-01-01',
          reason: '完成前转出溢出暂存库位',
          operatedAt: '2026-07-30 17:30:00',
          operatedBy: '毛织仓管',
        })
        store.completions.push(completion(store, order))
        break
      case 'YARN_ISSUE_RETURN':
        addReceipt(order, 'AB', ['YARN-A', 'YARN-B'])
        store.yarnIssues.push(
          {
            issueId: 'WI-MOCK-001',
            issueNo: 'WI-MOCK-001',
            woolOrderId: order.woolOrderId,
            yarnSkuCode: 'YARN-A',
            batchNo: 'BATCH-AB',
            issuedQty: 0.5,
            qtyUnit: 'kg',
            warehouseOutboundFlowId: 'WF-WI-MOCK-001',
            issuedAt: MOCK_AT,
            issuedBy: '毛织仓管',
          },
          {
            issueId: 'WI-MOCK-002',
            issueNo: 'WI-MOCK-002',
            woolOrderId: order.woolOrderId,
            yarnSkuCode: 'YARN-A',
            batchNo: 'BATCH-AB',
            issuedQty: 0.3,
            qtyUnit: 'kg',
            warehouseOutboundFlowId: 'WF-WI-MOCK-002',
            issuedAt: MOCK_AT,
            issuedBy: '毛织仓管',
          },
        )
        store.yarnReturns.push(
          {
            returnId: 'WRT-MOCK-001',
            returnNo: 'WRT-MOCK-001',
            woolOrderId: order.woolOrderId,
            yarnSkuCode: 'YARN-A',
            batchNo: 'BATCH-AB',
            returnedQty: 0.2,
            qtyUnit: 'kg',
            warehouseInboundFlowId: 'WF-WRT-MOCK-001',
            returnedAt: MOCK_AT,
            returnedBy: '毛织仓管',
          },
          {
            returnId: 'WRT-MOCK-002',
            returnNo: 'WRT-MOCK-002',
            woolOrderId: order.woolOrderId,
            yarnSkuCode: 'YARN-A',
            batchNo: 'BATCH-AB',
            returnedQty: 0.1,
            qtyUnit: 'kg',
            warehouseInboundFlowId: 'WF-WRT-MOCK-002',
            returnedAt: MOCK_AT,
            returnedBy: '毛织仓管',
          },
        )
        for (const issue of store.yarnIssues.filter((item) => item.woolOrderId === order.woolOrderId)) {
          store.warehouseFlows.push({
            flowId: issue.warehouseOutboundFlowId,
            woolOrderId: order.woolOrderId,
            flowType: 'OUTBOUND',
            businessType: 'YARN_ISSUE',
            warehouseMode: 'WAIT_PROCESS',
            defaultLocationType: 'YARN',
            defaultLocationId: 'WOOL-WP-YARN-DEFAULT',
            objectSkuCode: issue.yarnSkuCode,
            batchNo: issue.batchNo,
            qty: issue.issuedQty,
            unit: 'kg',
            sourceRecordType: 'YARN_ISSUE',
            sourceRecordId: issue.issueId,
            operatedAt: issue.issuedAt,
            operatedBy: issue.issuedBy,
          })
        }
        for (const returned of store.yarnReturns.filter((item) => item.woolOrderId === order.woolOrderId)) {
          store.warehouseFlows.push({
            flowId: returned.warehouseInboundFlowId,
            woolOrderId: order.woolOrderId,
            flowType: 'INBOUND',
            businessType: 'YARN_RETURN',
            warehouseMode: 'WAIT_PROCESS',
            defaultLocationType: 'YARN',
            defaultLocationId: 'WOOL-WP-YARN-DEFAULT',
            objectSkuCode: returned.yarnSkuCode,
            batchNo: returned.batchNo,
            qty: returned.returnedQty,
            unit: 'kg',
            sourceRecordType: 'YARN_RETURN',
            sourceRecordId: returned.returnId,
            operatedAt: returned.returnedAt,
            operatedBy: returned.returnedBy,
          })
        }
        break
      case 'FIXED_LOCATION_UI': {
        if (order.kind === 'WHOLE_GARMENT') {
          addReceipt(order, 'FIXED-LOCATION-YARN', ['YARN-A', 'YARN-B'], 'BATCH-FIXED-LOCATION')
          addReport(order, 0, 'FIXED-LOCATION-GARMENT', 5)
        } else {
          addReceipt(order, 'FIXED-LOCATION-PANEL-YARN', ['YARN-A', 'YARN-B'], 'BATCH-FIXED-LOCATION-PANEL')
          addReport(order, 0, 'FIXED-LOCATION-CUT', 5)
        }
        break
      }
      default:
        break
    }
  }
  return store
}

export function resetWoolFactWorkflowMock(seed = 'DEFAULT'): WoolDomainStore {
  return replaceWoolStore(buildWoolFactWorkflowMockStore(seed))
}
