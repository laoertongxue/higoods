import type {
  WoolDefaultLocationId,
  WoolQtyUnit,
  WoolWarehouseFlow,
  WoolYarnIssueRecord,
  WoolYarnReturnRecord,
} from './types.ts'

export type WoolWarehouseBatchMatch = 'ANY' | 'EXACT'

export interface WoolWarehouseLedgerKey {
  woolOrderId: string
  objectSkuCode: string
  defaultLocationId: WoolDefaultLocationId
  batchNo?: string
}

export function normalizeWoolBatchNo(batchNo?: string): string | undefined {
  const normalized = batchNo?.trim()
  return normalized || undefined
}

export function woolBatchMatches(
  actualBatchNo: string | undefined,
  expectedBatchNo: string | undefined,
  batchMatch: WoolWarehouseBatchMatch,
): boolean {
  return batchMatch === 'ANY'
    || normalizeWoolBatchNo(actualBatchNo) === normalizeWoolBatchNo(expectedBatchNo)
}

export function woolWarehouseFlowSignedQty(flow: WoolWarehouseFlow): number {
  if (flow.flowType === 'INBOUND') return Math.abs(flow.qty)
  if (flow.flowType === 'OUTBOUND') return -Math.abs(flow.qty)
  if (flow.flowType === 'TRANSFER') {
    if (flow.fromLocationId === flow.defaultLocationId) return -Math.abs(flow.qty)
    if (flow.toLocationId === flow.defaultLocationId) return Math.abs(flow.qty)
    return 0
  }
  return flow.qty
}

export function getWoolWarehouseLedgerBalance(
  flows: readonly WoolWarehouseFlow[],
  key: WoolWarehouseLedgerKey,
  batchMatch: WoolWarehouseBatchMatch = 'EXACT',
): number {
  return flows
    .filter((flow) =>
      flow.woolOrderId === key.woolOrderId
      && flow.objectSkuCode === key.objectSkuCode
      && flow.defaultLocationId === key.defaultLocationId
      && woolBatchMatches(flow.batchNo, key.batchNo, batchMatch),
    )
    .reduce((sum, flow) => sum + woolWarehouseFlowSignedQty(flow), 0)
}

export function requireWoolWarehouseQuantityUnit(
  qty: number,
  unit: WoolQtyUnit,
  label: string,
): void {
  if (!Number.isFinite(qty)) throw new Error(`${label}必须是有限数字`)
  if (unit !== 'kg' && !Number.isInteger(qty)) {
    throw new Error(`${label}按${unit}计量，必须为整数`)
  }
}

interface WoolWarehouseReplayStore {
  warehouseFlows: WoolWarehouseFlow[]
  yarnIssues: WoolYarnIssueRecord[]
  yarnReturns: WoolYarnReturnRecord[]
}

function ledgerKey(flow: WoolWarehouseFlow): string {
  return [
    flow.woolOrderId,
    flow.objectSkuCode,
    normalizeWoolBatchNo(flow.batchNo) ?? '',
    flow.defaultLocationId,
  ].join('\u0000')
}

function yarnFactKey(record: {
  woolOrderId: string
  yarnSkuCode: string
  batchNo?: string
}): string {
  return [
    record.woolOrderId,
    record.yarnSkuCode,
    normalizeWoolBatchNo(record.batchNo) ?? '',
  ].join('\u0000')
}

function publicEndpointKey(flow: WoolWarehouseFlow, warehouseId: string, locationId: string): string {
  return `${ledgerKey(flow)}\u0000${warehouseId}\u0000${locationId}`
}

export function validateWoolWarehouseLedger(store: WoolWarehouseReplayStore): void {
  const defaultBalances = new Map<string, number>()
  const publicBalances = new Map<string, number>()
  // warehouseFlows 是追加式事实数组；数组顺序就是领域命令提交后的稳定因果顺序。
  // operatedAt 是业务录入时间，可能因时区或补录早于前置事实，不能据此重排账本。
  const orderedFlows = store.warehouseFlows.map((flow, index) => ({ flow, index }))

  for (const { flow } of orderedFlows) {
    requireWoolWarehouseQuantityUnit(flow.qty, flow.unit, `仓库流水 ${flow.flowId} 数量`)
    if (flow.flowType !== 'ADJUSTMENT' && flow.qty <= 0) {
      throw new Error(`毛织仓库账本校验失败：流水 ${flow.flowId} 数量必须大于 0`)
    }
    if (flow.flowType === 'ADJUSTMENT' && flow.qty === 0) {
      throw new Error(`毛织仓库账本校验失败：调整流水 ${flow.flowId} 数量不能为 0`)
    }

    const key = ledgerKey(flow)
    const beforeDefault = defaultBalances.get(key) ?? 0
    const afterDefault = beforeDefault + woolWarehouseFlowSignedQty(flow)
    if (!Number.isFinite(afterDefault) || afterDefault < -1e-9) {
      throw new Error(`毛织仓库账本校验失败：流水 ${flow.flowId} 形成负库存`)
    }
    defaultBalances.set(key, Math.abs(afterDefault) < 1e-9 ? 0 : afterDefault)

    if (flow.flowType !== 'TRANSFER') continue
    const isTransferOut = flow.fromLocationId === flow.defaultLocationId
    const publicWarehouseId = isTransferOut ? flow.toWarehouseId : flow.fromWarehouseId
    const publicLocationId = isTransferOut ? flow.toLocationId : flow.fromLocationId
    if (!publicWarehouseId || !publicLocationId) {
      throw new Error(`毛织仓库账本校验失败：转移流水 ${flow.flowId} 缺少公共仓库端`)
    }
    const externalKey = publicEndpointKey(flow, publicWarehouseId, publicLocationId)
    const beforePublic = publicBalances.get(externalKey) ?? 0
    const afterPublic = beforePublic + (isTransferOut ? flow.qty : -flow.qty)
    if (!Number.isFinite(afterPublic) || afterPublic < -1e-9) {
      throw new Error(`毛织仓库账本校验失败：转移流水 ${flow.flowId} 超过公共仓库可转回余额`)
    }
    publicBalances.set(externalKey, Math.abs(afterPublic) < 1e-9 ? 0 : afterPublic)
  }

  const issuedByKey = new Map<string, number>()
  for (const issue of store.yarnIssues) {
    requireWoolWarehouseQuantityUnit(issue.issuedQty, issue.qtyUnit, `领用记录 ${issue.issueId} 数量`)
    if (issue.issuedQty <= 0) throw new Error(`毛织仓库账本校验失败：领用记录 ${issue.issueId} 数量必须大于 0`)
    const key = yarnFactKey(issue)
    issuedByKey.set(key, (issuedByKey.get(key) ?? 0) + issue.issuedQty)
  }
  const returnedByKey = new Map<string, number>()
  for (const returned of store.yarnReturns) {
    requireWoolWarehouseQuantityUnit(returned.returnedQty, returned.qtyUnit, `退回记录 ${returned.returnId} 数量`)
    if (returned.returnedQty <= 0) {
      throw new Error(`毛织仓库账本校验失败：退回记录 ${returned.returnId} 数量必须大于 0`)
    }
    const key = yarnFactKey(returned)
    const nextReturned = (returnedByKey.get(key) ?? 0) + returned.returnedQty
    if (nextReturned > (issuedByKey.get(key) ?? 0) + 1e-9) {
      throw new Error('毛织仓库账本校验失败：同加工单、同纱线和对应批次的累计退回不能超过累计领用')
    }
    returnedByKey.set(key, nextReturned)
  }
}
