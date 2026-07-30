import { buildWoolFactWorkflowMockStore } from './mock-data.ts'
import type {
  WoolCompletionRecord,
  WoolHandoverRecord,
  WoolMachine,
  WoolMachineAssociation,
  WoolMachineAssociationLog,
  WoolOperationLog,
  WoolOutputPlanLine,
  WoolProcessReportRecord,
  WoolQtyChangeLog,
  WoolWarehouseFlow,
  WoolWorkOrder,
  WoolYarnIssueRecord,
  WoolYarnReceiptRecord,
  WoolYarnReturnRecord,
} from './types.ts'

export const WOOL_DOMAIN_STORE_KEY = 'higood-fcs-wool-domain-store-v2'

export interface WoolDomainStore {
  workOrders: Record<string, WoolWorkOrder>
  yarnReceipts: WoolYarnReceiptRecord[]
  yarnIssues: WoolYarnIssueRecord[]
  yarnReturns: WoolYarnReturnRecord[]
  processReports: WoolProcessReportRecord[]
  handovers: WoolHandoverRecord[]
  qtyChangeLogs: WoolQtyChangeLog[]
  warehouseFlows: WoolWarehouseFlow[]
  completions: WoolCompletionRecord[]
  machines: WoolMachine[]
  machineAssociations: WoolMachineAssociation[]
  machineAssociationLogs: WoolMachineAssociationLog[]
  operationLogs: WoolOperationLog[]
}

type WoolStorage = Pick<Storage, 'getItem' | 'setItem'>

let memoryStore: WoolDomainStore | undefined

function cloneStore(store: WoolDomainStore): WoolDomainStore {
  return structuredClone(store)
}

function getStorage(): WoolStorage | null {
  try {
    const candidate = (globalThis as { localStorage?: WoolStorage }).localStorage
    return candidate?.getItem && candidate?.setItem ? candidate : null
  } catch {
    return null
  }
}

function validateRecordArray(store: WoolDomainStore, field: keyof WoolDomainStore): void {
  if (!Array.isArray(store[field])) throw new Error(`毛织存储校验失败：${field} 必须是数组`)
}

function assertUniqueIds<T>(
  records: T[],
  getId: (record: T) => string,
  label: string,
): void {
  const seen = new Set<string>()
  for (const record of records) {
    const id = getId(record)
    if (!id) throw new Error(`毛织存储校验失败：${label} ID 不能为空`)
    if (seen.has(id)) throw new Error(`毛织存储校验失败：${label}存在重复 ID ${id}`)
    seen.add(id)
  }
}

export function validateWoolStore(store: WoolDomainStore): void {
  if (!store || typeof store !== 'object') throw new Error('毛织存储校验失败：存储对象无效')
  if (!store.workOrders || typeof store.workOrders !== 'object' || Array.isArray(store.workOrders)) {
    throw new Error('毛织存储校验失败：workOrders 必须是对象')
  }
  for (const [woolOrderId, order] of Object.entries(store.workOrders)) {
    if (!woolOrderId || order.woolOrderId !== woolOrderId || !order.woolOrderNo) {
      throw new Error(`毛织存储校验失败：加工单 ${woolOrderId || '未知'} 身份无效`)
    }
    if (!Array.isArray(order.outputPlanLines) || order.outputPlanLines.length === 0) {
      throw new Error(`毛织存储校验失败：加工单 ${woolOrderId} 缺少加工后 SKU`)
    }
    assertUniqueIds(order.outputPlanLines, (line) => line.outputSkuCode, `加工单 ${woolOrderId} 加工后 SKU`)
  }
  for (const field of [
    'yarnReceipts',
    'yarnIssues',
    'yarnReturns',
    'processReports',
    'handovers',
    'qtyChangeLogs',
    'warehouseFlows',
    'completions',
    'machines',
    'machineAssociations',
    'machineAssociationLogs',
    'operationLogs',
  ] as const) {
    validateRecordArray(store, field)
  }

  assertUniqueIds(store.yarnReceipts, (item) => item.receiptId, '纱线接收记录')
  assertUniqueIds(store.yarnReceipts.flatMap((item) => item.lines), (item) => item.lineId, '纱线接收明细')
  assertUniqueIds(
    store.yarnReceipts.flatMap((item) => item.lines),
    (item) => item.warehouseInboundFlowId,
    '接收明细仓库流水一对一引用',
  )
  assertUniqueIds(store.yarnIssues, (item) => item.issueId, '纱线领用记录')
  assertUniqueIds(store.yarnIssues, (item) => item.warehouseOutboundFlowId, '领用记录仓库流水一对一引用')
  assertUniqueIds(store.yarnReturns, (item) => item.returnId, '纱线退回记录')
  assertUniqueIds(store.yarnReturns, (item) => item.warehouseInboundFlowId, '退回记录仓库流水一对一引用')
  assertUniqueIds(store.processReports, (item) => item.reportId, '加工填报记录')
  assertUniqueIds(store.processReports, (item) => item.warehouseInboundFlowId, '加工填报仓库流水一对一引用')
  assertUniqueIds(store.handovers, (item) => item.handoverId, '交出记录')
  assertUniqueIds(store.handovers, (item) => item.warehouseOutboundFlowId, '交出记录仓库流水一对一引用')
  assertUniqueIds(store.qtyChangeLogs, (item) => item.changeId, '数量修改记录')
  assertUniqueIds(store.warehouseFlows, (item) => item.flowId, '仓库流水')
  assertUniqueIds(
    store.warehouseFlows,
    (item) => `${item.sourceRecordType}\u0000${item.sourceRecordId}`,
    '仓库流水来源事实',
  )
  assertUniqueIds(store.completions, (item) => item.woolOrderId, '完成记录')
  assertUniqueIds(store.machines, (item) => item.machineId, '横机设备')
  assertUniqueIds(store.machineAssociations, (item) => item.machineId, '当前横机关联')
  assertUniqueIds(store.machineAssociationLogs, (item) => item.logId, '横机关联日志')
  assertUniqueIds(store.operationLogs, (item) => item.operationLogId, '操作日志')

  const requireOrder = (woolOrderId: string, label: string): WoolWorkOrder => {
    const order = store.workOrders[woolOrderId]
    if (!order) throw new Error(`毛织存储校验失败：${label}引用的加工单 ${woolOrderId} 不存在`)
    return order
  }
  const requireOutput = (woolOrderId: string, outputSkuCode: string, label: string): WoolOutputPlanLine => {
    const order = requireOrder(woolOrderId, label)
    const line = order.outputPlanLines.find((item) => item.outputSkuCode === outputSkuCode)
    if (!line) {
      throw new Error(`毛织存储校验失败：${label}的加工后 SKU ${outputSkuCode} 不属于加工单 ${woolOrderId}`)
    }
    return line
  }
  const requiredYarns = (order: WoolWorkOrder): Set<string> =>
    new Set(order.outputPlanLines.flatMap((line) => line.requiredYarnSkus))

  for (const receipt of store.yarnReceipts) {
    const order = requireOrder(receipt.woolOrderId, `接收记录 ${receipt.receiptId}`)
    const yarns = requiredYarns(order)
    for (const line of receipt.lines) {
      if (!yarns.has(line.yarnSkuCode)) {
        throw new Error(`毛织存储校验失败：接收明细 ${line.lineId} 的纱线 SKU 不属于加工单`)
      }
      const flow = store.warehouseFlows.find((item) => item.flowId === line.warehouseInboundFlowId)
      if (
        !flow
        || flow.businessType !== 'YARN_RECEIPT'
        || flow.sourceRecordId !== line.lineId
        || flow.woolOrderId !== receipt.woolOrderId
        || flow.objectSkuCode !== line.yarnSkuCode
      ) {
        throw new Error(`毛织存储校验失败：接收明细 ${line.lineId} 缺少有效仓库流水`)
      }
    }
  }
  for (const issue of store.yarnIssues) {
    const order = requireOrder(issue.woolOrderId, `领用记录 ${issue.issueId}`)
    if (!requiredYarns(order).has(issue.yarnSkuCode)) {
      throw new Error(`毛织存储校验失败：领用记录 ${issue.issueId} 的纱线 SKU 不属于加工单`)
    }
    const flow = store.warehouseFlows.find((item) => item.flowId === issue.warehouseOutboundFlowId)
    if (
      !flow
      || flow.businessType !== 'YARN_ISSUE'
      || flow.sourceRecordId !== issue.issueId
      || flow.woolOrderId !== issue.woolOrderId
      || flow.objectSkuCode !== issue.yarnSkuCode
    ) {
      throw new Error(`毛织存储校验失败：领用记录 ${issue.issueId} 缺少有效仓库流水`)
    }
  }
  for (const returned of store.yarnReturns) {
    const order = requireOrder(returned.woolOrderId, `退回记录 ${returned.returnId}`)
    if (!requiredYarns(order).has(returned.yarnSkuCode)) {
      throw new Error(`毛织存储校验失败：退回记录 ${returned.returnId} 的纱线 SKU 不属于加工单`)
    }
    const flow = store.warehouseFlows.find((item) => item.flowId === returned.warehouseInboundFlowId)
    if (
      !flow
      || flow.businessType !== 'YARN_RETURN'
      || flow.sourceRecordId !== returned.returnId
      || flow.woolOrderId !== returned.woolOrderId
      || flow.objectSkuCode !== returned.yarnSkuCode
    ) {
      throw new Error(`毛织存储校验失败：退回记录 ${returned.returnId} 缺少有效仓库流水`)
    }
  }
  for (const report of store.processReports) {
    requireOutput(report.woolOrderId, report.outputSkuCode, `加工填报 ${report.reportId}`)
    const flow = store.warehouseFlows.find((item) => item.flowId === report.warehouseInboundFlowId)
    if (
      !flow
      || flow.businessType !== 'PROCESS_REPORT'
      || flow.sourceRecordId !== report.reportId
      || flow.woolOrderId !== report.woolOrderId
      || flow.objectSkuCode !== report.outputSkuCode
    ) {
      throw new Error(`毛织存储校验失败：加工填报 ${report.reportId} 缺少有效仓库流水`)
    }
  }
  for (const handover of store.handovers) {
    requireOutput(handover.woolOrderId, handover.outputSkuCode, `交出记录 ${handover.handoverId}`)
    const flow = store.warehouseFlows.find((item) => item.flowId === handover.warehouseOutboundFlowId)
    if (
      !flow
      || flow.businessType !== 'HANDOVER'
      || flow.sourceRecordId !== handover.handoverId
      || flow.woolOrderId !== handover.woolOrderId
      || flow.objectSkuCode !== handover.outputSkuCode
    ) {
      throw new Error(`毛织存储校验失败：交出记录 ${handover.handoverId} 缺少有效仓库流水`)
    }
  }
  for (const change of store.qtyChangeLogs) {
    const target = change.recordType === 'YARN_RECEIPT'
      ? store.yarnReceipts.find((item) =>
          item.receiptId === change.recordId
          && (!change.recordLineId || item.lines.some((line) => line.lineId === change.recordLineId)),
        )
      : change.recordType === 'PROCESS_REPORT'
        ? store.processReports.find((item) => item.reportId === change.recordId)
        : store.handovers.find((item) => item.handoverId === change.recordId)
    if (!target) {
      throw new Error(`毛织存储校验失败：数量修改目标 ${change.recordId} 不存在`)
    }
    const targetSku = change.recordType === 'YARN_RECEIPT'
      ? (target as WoolYarnReceiptRecord).lines.find((line) =>
          !change.recordLineId || line.lineId === change.recordLineId,
        )?.yarnSkuCode
      : change.recordType === 'PROCESS_REPORT'
        ? (target as WoolProcessReportRecord).outputSkuCode
        : (target as WoolHandoverRecord).outputSkuCode
    if (targetSku !== change.objectSkuCode) {
      throw new Error(`毛织存储校验失败：数量修改目标 ${change.recordId} 的对象 SKU 不一致`)
    }
  }
  for (const flow of store.warehouseFlows) {
    const order = requireOrder(flow.woolOrderId, `仓库流水 ${flow.flowId}`)
    const outputLine = order.outputPlanLines.find((line) => line.outputSkuCode === flow.objectSkuCode)
    const knownSku = Boolean(outputLine) || requiredYarns(order).has(flow.objectSkuCode)
    if (!knownSku) {
      throw new Error(`毛织存储校验失败：仓库流水 ${flow.flowId} 的对象 SKU 不属于加工单`)
    }
    const requiredFlowType = {
      YARN_RECEIPT: 'INBOUND',
      YARN_ISSUE: 'OUTBOUND',
      YARN_RETURN: 'INBOUND',
      PROCESS_REPORT: 'INBOUND',
      HANDOVER: 'OUTBOUND',
      STOCK_ADJUSTMENT: 'ADJUSTMENT',
      STOCK_TRANSFER: 'TRANSFER',
    }[flow.businessType]
    if (!requiredFlowType || flow.flowType !== requiredFlowType) {
      throw new Error(`毛织存储校验失败：仓库流水 ${flow.flowId} 的业务类型与流水方向不一致`)
    }
    if (['YARN_RECEIPT', 'YARN_ISSUE', 'YARN_RETURN'].includes(flow.businessType)) {
      if (
        flow.warehouseMode !== 'WAIT_PROCESS'
        || flow.defaultLocationType !== 'YARN'
        || flow.defaultLocationId !== 'WOOL-WP-YARN-DEFAULT'
      ) {
        throw new Error(`毛织存储校验失败：纱线流水 ${flow.flowId} 的待加工仓或默认库位无效`)
      }
    }
    if (flow.businessType === 'PROCESS_REPORT' || flow.businessType === 'HANDOVER') {
      const expectedLocationType = order.kind === 'WHOLE_GARMENT' ? 'GARMENT' : 'CUT_PIECE'
      const expectedLocationId = order.kind === 'WHOLE_GARMENT'
        ? 'WOOL-WH-GARMENT-DEFAULT'
        : 'WOOL-WH-CUT-DEFAULT'
      if (
        !outputLine
        || flow.warehouseMode !== 'WAIT_HANDOVER'
        || flow.defaultLocationType !== expectedLocationType
        || flow.defaultLocationId !== expectedLocationId
      ) {
        throw new Error(`毛织存储校验失败：仓库流水 ${flow.flowId} 的加工后对象与默认库位不一致`)
      }
    }
    const locationRule = {
      YARN: {
        warehouseMode: 'WAIT_PROCESS',
        defaultLocationId: 'WOOL-WP-YARN-DEFAULT',
      },
      CUT_PIECE: {
        warehouseMode: 'WAIT_HANDOVER',
        defaultLocationId: 'WOOL-WH-CUT-DEFAULT',
      },
      GARMENT: {
        warehouseMode: 'WAIT_HANDOVER',
        defaultLocationId: 'WOOL-WH-GARMENT-DEFAULT',
      },
    }[flow.defaultLocationType]
    if (
      !locationRule
      || flow.warehouseMode !== locationRule.warehouseMode
      || flow.defaultLocationId !== locationRule.defaultLocationId
    ) {
      throw new Error(`毛织存储校验失败：仓库流水 ${flow.flowId} 的仓库模式或默认库位无效`)
    }
    if (!flow.sourceRecordType || !flow.sourceRecordId) {
      throw new Error(`毛织存储校验失败：仓库流水 ${flow.flowId} 的来源类型和来源 ID 不能为空`)
    }
    if (flow.flowType === 'TRANSFER') {
      if (
        !flow.fromLocationId
        || !flow.toLocationId
        || flow.fromLocationId === flow.toLocationId
        || (
          flow.fromLocationId !== flow.defaultLocationId
          && flow.toLocationId !== flow.defaultLocationId
        )
      ) {
        throw new Error(`毛织存储校验失败：转移流水 ${flow.flowId} 的起止库位无效`)
      }
    }
    const isSelfDescribingStockFact =
      (flow.businessType === 'STOCK_ADJUSTMENT'
        && flow.flowType === 'ADJUSTMENT'
        && flow.sourceRecordType === 'STOCK_ADJUSTMENT')
      || (flow.businessType === 'STOCK_TRANSFER'
        && flow.flowType === 'TRANSFER'
        && flow.sourceRecordType === 'STOCK_TRANSFER')
    const sourceExists =
      isSelfDescribingStockFact
      || (flow.sourceRecordType === 'YARN_RECEIPT'
        && store.yarnReceipts.some((item) =>
          item.lines.some((line) => line.lineId === flow.sourceRecordId),
        ))
      || (flow.sourceRecordType === 'YARN_ISSUE'
        && store.yarnIssues.some((item) => item.issueId === flow.sourceRecordId))
      || (flow.sourceRecordType === 'YARN_RETURN'
        && store.yarnReturns.some((item) => item.returnId === flow.sourceRecordId))
      || (flow.sourceRecordType === 'PROCESS_REPORT'
        && store.processReports.some((item) => item.reportId === flow.sourceRecordId))
      || (flow.sourceRecordType === 'HANDOVER'
        && store.handovers.some((item) => item.handoverId === flow.sourceRecordId))
      || (flow.sourceRecordType === 'QTY_CHANGE'
        && store.qtyChangeLogs.some((item) => item.changeId === flow.sourceRecordId))
    if (!sourceExists) {
      throw new Error(`毛织存储校验失败：仓库流水 ${flow.flowId} 的来源记录 ${flow.sourceRecordId} 不存在`)
    }
    if (flow.sourceRecordType === 'QTY_CHANGE') {
      const change = store.qtyChangeLogs.find((item) => item.changeId === flow.sourceRecordId)!
      const target = change.recordType === 'YARN_RECEIPT'
        ? store.yarnReceipts.find((item) => item.receiptId === change.recordId)
        : change.recordType === 'PROCESS_REPORT'
          ? store.processReports.find((item) => item.reportId === change.recordId)
          : store.handovers.find((item) => item.handoverId === change.recordId)
      const originalFlowId = change.recordType === 'YARN_RECEIPT'
        ? store.yarnReceipts
            .find((item) => item.receiptId === change.recordId)
            ?.lines.find((line) => line.lineId === change.recordLineId)
            ?.warehouseInboundFlowId
        : change.recordType === 'PROCESS_REPORT'
          ? store.processReports
              .find((item) => item.reportId === change.recordId)
              ?.warehouseInboundFlowId
          : store.handovers
              .find((item) => item.handoverId === change.recordId)
              ?.warehouseOutboundFlowId
      const originalFlow = store.warehouseFlows.find((item) => item.flowId === originalFlowId)
      const targetOrderId = target?.woolOrderId
      const stockDelta = (change.afterQty - change.beforeQty)
        * (change.recordType === 'HANDOVER' ? -1 : 1)
      if (
        flow.businessType !== 'STOCK_ADJUSTMENT'
        || flow.flowType !== 'ADJUSTMENT'
        || flow.woolOrderId !== targetOrderId
        || flow.objectSkuCode !== change.objectSkuCode
        || flow.qty !== stockDelta
      ) {
        throw new Error(`毛织存储校验失败：数量修改 ${change.changeId} 的库存差额不符合目标事实`)
      }
      if (
        !originalFlow
        || flow.warehouseMode !== originalFlow.warehouseMode
        || flow.defaultLocationType !== originalFlow.defaultLocationType
        || flow.defaultLocationId !== originalFlow.defaultLocationId
        || flow.unit !== originalFlow.unit
        || flow.batchNo !== originalFlow.batchNo
      ) {
        throw new Error(`毛织存储校验失败：数量修改 ${change.changeId} 未继承目标事实的原始仓库流水`)
      }
    }
  }
  for (const completion of store.completions) {
    requireOrder(completion.woolOrderId, '完成记录')
    for (const machineId of completion.confirmationSnapshot.releasedMachineIds) {
      if (!store.machines.some((item) => item.machineId === machineId)) {
        throw new Error(`毛织存储校验失败：完成快照引用的设备 ${machineId} 不存在`)
      }
    }
  }
  for (const association of store.machineAssociations) {
    if (!store.machines.some((item) => item.machineId === association.machineId)) {
      throw new Error(`毛织存储校验失败：当前横机关联引用的设备 ${association.machineId} 不存在`)
    }
    requireOrder(association.woolOrderId, '当前横机关联')
  }
  for (const log of store.machineAssociationLogs) {
    if (!store.machines.some((item) => item.machineId === log.machineId)) {
      throw new Error(`毛织存储校验失败：横机关联日志引用的设备 ${log.machineId} 不存在`)
    }
    if (log.fromWoolOrderId) requireOrder(log.fromWoolOrderId, `横机关联日志 ${log.logId}`)
    if (log.toWoolOrderId) requireOrder(log.toWoolOrderId, `横机关联日志 ${log.logId}`)
  }
  for (const log of store.operationLogs) requireOrder(log.woolOrderId, `操作日志 ${log.operationLogId}`)
}

function readPersistedStore(): WoolDomainStore | undefined {
  try {
    const raw = getStorage()?.getItem(WOOL_DOMAIN_STORE_KEY)
    if (!raw) return undefined
    const parsed = JSON.parse(raw) as WoolDomainStore
    validateWoolStore(parsed)
    return parsed
  } catch {
    return undefined
  }
}

export function readWoolStore(): WoolDomainStore {
  if (!memoryStore) {
    memoryStore = readPersistedStore() ?? buildWoolFactWorkflowMockStore()
    validateWoolStore(memoryStore)
  }
  return cloneStore(memoryStore)
}

export function clearWoolStoreMemoryCache(): void {
  memoryStore = undefined
}

export function replaceWoolStore(nextStore: WoolDomainStore): WoolDomainStore {
  const draft = cloneStore(nextStore)
  validateWoolStore(draft)
  const serialized = JSON.stringify(draft)
  getStorage()?.setItem(WOOL_DOMAIN_STORE_KEY, serialized)
  memoryStore = draft
  return cloneStore(draft)
}

export function commitWoolStore(
  mutator: (draft: WoolDomainStore) => void,
): WoolDomainStore {
  const draft = readWoolStore()
  mutator(draft)
  validateWoolStore(draft)
  const serialized = JSON.stringify(draft)
  getStorage()?.setItem(WOOL_DOMAIN_STORE_KEY, serialized)
  memoryStore = draft
  return cloneStore(draft)
}
