import { getPmsMaterialPurchaseOrder, listPmsMaterialLogisticsRecords, listPmsMaterialPurchaseOrders } from './material-purchase-orders.ts'
import { getPmsFirstLegBatch, listPmsFirstLegBatches, type PmsFirstLegTransportMethod } from './first-leg-logistics.ts'
import { appendPmsLog, PmsDomainError, roundPmsQty, type PmsActorRole } from './runtime.ts'

export type PmsReconciliationStatus = '待确认' | '部分确认' | '已确认'

export type PmsMaterialFeeKey = 'purchaseAmount' | 'domesticLogisticsFee' | 'supplierBillAmount' | 'adjustment'

export const PMS_MATERIAL_FEE_ITEMS: Array<{ key: PmsMaterialFeeKey; label: string }> = [
  { key: 'purchaseAmount', label: '采购货款' },
  { key: 'domesticLogisticsFee', label: '国内物流费' },
  { key: 'supplierBillAmount', label: '供应商账单' },
  { key: 'adjustment', label: '调整金额' },
]

export interface PmsMaterialReconciliation {
  id: string
  supplierName: string
  materialCode: string
  materialName: string
  purchaseOrderNos: string[]
  currency: 'RMB' | 'USD'
  orderedQty: number
  estimatedUnitPrice: number
  purchaseAmount: number
  actualUnitPrice: number | null
  actualPurchaseAmount: number | null
  domesticLogisticsFee: number
  actualDomesticLogisticsFee: number | null
  adjustment: number
  feeConfirmations: PmsMaterialFeeKey[]
  remark: string
  finalPayable: number
  supplierBillAmount: number
  difference: number
  differenceConfirmed: boolean
  status: PmsReconciliationStatus
  confirmedBy: string
  confirmedAt: string
  paymentRequestNo: string
  invoiceNo: string
  updatedAt: string
}

export type PmsLogisticsFeeKey = 'freight' | 'firstLegLogistics' | 'customsDuty' | 'vat' | 'clearance' | 'additional' | 'customsDeclaration'

export interface PmsLogisticsFeeItem {
  key: PmsLogisticsFeeKey
  label: string
  estimated: number
  actual: number
  confirmed: boolean
}

export const PMS_LOGISTICS_FEE_ITEMS: Array<{ key: PmsLogisticsFeeKey; label: string }> = [
  { key: 'freight', label: '头程运费' },
  { key: 'firstLegLogistics', label: '头程物流费' },
  { key: 'customsDuty', label: '关税' },
  { key: 'vat', label: '增值税' },
  { key: 'clearance', label: '清关费' },
  { key: 'additional', label: '附加费' },
  { key: 'customsDeclaration', label: '报关费' },
]

export interface PmsLogisticsReconciliation {
  id: string
  batchNo: string
  carrierName: string
  channelName: string
  currency: 'RMB' | 'USD' | 'IDR'
  carrierId: string
  transportMethod: PmsFirstLegTransportMethod | ''
  fees: PmsLogisticsFeeItem[]
  estimatedTotal: number
  actualTotal: number
  feeDifference: number
  supplierBillAmount: number
  difference: number
  remark: string
  shipmentNo: string
  differenceConfirmed: boolean
  status: PmsReconciliationStatus
  confirmedBy: string
  confirmedAt: string
  paymentRequestNo: string
  importedAt: string
  updatedAt: string
}

interface PmsReconciliationRuntime {
  materialRows: PmsMaterialReconciliation[]
  logisticsRows: PmsLogisticsReconciliation[]
}

let runtime: PmsReconciliationRuntime | null = null

interface PmsMaterialRowPatch {
  adjustment?: number
  billDelta?: number
  confirmed?: boolean
  paymentRequestNo?: string
  invoiceNo?: string
  actualUnitPrice?: number
  actualPurchaseAmount?: number
  actualDomesticLogisticsFee?: number
  feeConfirmations?: PmsMaterialFeeKey[]
  remark?: string
}

function materialRow(id: string, orderNo: string, patch: PmsMaterialRowPatch = {}): PmsMaterialReconciliation {
  const order = listPmsMaterialPurchaseOrders().find((item) => item.purchaseOrderNo === orderNo)
  if (!order) throw new Error(`面辅料采购单不存在: ${orderNo}`)
  const purchaseAmount = roundPmsQty(order.orderedQty * order.unitPrice, 2)
  const domesticLogisticsFee = roundPmsQty(
    listPmsMaterialLogisticsRecords()
      .filter((record) => record.purchaseOrderNo === orderNo)
      .reduce((sum, record) => sum + record.fee, 0),
    2,
  )
  const adjustment = patch.adjustment ?? 0
  const row: PmsMaterialReconciliation = {
    id,
    supplierName: order.supplierName,
    materialCode: order.materialCode,
    materialName: order.materialName,
    purchaseOrderNos: [orderNo],
    currency: order.currency,
    orderedQty: order.orderedQty,
    estimatedUnitPrice: order.unitPrice,
    purchaseAmount,
    actualUnitPrice: patch.actualUnitPrice ?? null,
    actualPurchaseAmount: patch.actualPurchaseAmount ?? null,
    domesticLogisticsFee,
    actualDomesticLogisticsFee: patch.actualDomesticLogisticsFee ?? null,
    adjustment,
    feeConfirmations: patch.feeConfirmations ?? (patch.confirmed ? PMS_MATERIAL_FEE_ITEMS.map((item) => item.key) : []),
    remark: patch.remark ?? '',
    finalPayable: 0,
    supplierBillAmount: 0,
    difference: 0,
    differenceConfirmed: patch.confirmed ?? false,
    status: '待确认',
    confirmedBy: patch.confirmed ? '刘财务' : '',
    confirmedAt: patch.confirmed ? '2026-06-14 10:00:00' : '',
    paymentRequestNo: patch.paymentRequestNo ?? '',
    invoiceNo: patch.invoiceNo ?? '',
    updatedAt: '2026-06-13 16:00:00',
  }
  recalcMaterialRow(row)
  row.supplierBillAmount = roundPmsQty(row.finalPayable + (patch.billDelta ?? 0), 2)
  recalcMaterialRow(row)
  refreshMaterialStatus(row)
  return row
}

export function pmsMaterialEffectivePurchaseAmount(row: PmsMaterialReconciliation): number {
  if (row.actualPurchaseAmount !== null) return row.actualPurchaseAmount
  if (row.actualUnitPrice !== null) return roundPmsQty(row.actualUnitPrice * row.orderedQty, 2)
  return row.purchaseAmount
}

export function pmsMaterialEffectiveLogisticsFee(row: PmsMaterialReconciliation): number {
  return row.actualDomesticLogisticsFee !== null ? row.actualDomesticLogisticsFee : row.domesticLogisticsFee
}

function refreshMaterialStatus(row: PmsMaterialReconciliation): void {
  if (row.confirmedBy) {
    row.status = '已确认'
    return
  }
  row.status = row.feeConfirmations.length > 0 ? '部分确认' : '待确认'
}

function logisticsRow(
  id: string,
  batchNo: string,
  estimated: Partial<Record<PmsLogisticsFeeKey, number>>,
  actual: Partial<Record<PmsLogisticsFeeKey, number>>,
  patch: { billDelta?: number; confirmed?: boolean; paymentRequestNo?: string; remark?: string; shipmentNo?: string } = {},
): PmsLogisticsReconciliation {
  const batch = listPmsFirstLegBatches().find((item) => item.batchNo === batchNo)
  const fees = PMS_LOGISTICS_FEE_ITEMS.map((item) => ({
    key: item.key,
    label: item.label,
    estimated: estimated[item.key] ?? 0,
    actual: actual[item.key] ?? 0,
    confirmed: patch.confirmed ?? false,
  }))
  const estimatedTotal = roundPmsQty(fees.reduce((sum, item) => sum + item.estimated, 0), 2)
  const actualTotal = roundPmsQty(fees.reduce((sum, item) => sum + item.actual, 0), 2)
  const supplierBillAmount = roundPmsQty((actualTotal || estimatedTotal) + (patch.billDelta ?? 0), 2)
  const confirmed = patch.confirmed ?? false
  const row: PmsLogisticsReconciliation = {
    id,
    batchNo,
    carrierName: batch?.carrierName ?? '未知物流商',
    carrierId: batch?.carrierId ?? '',
    channelName: batch?.channelName ?? '未知渠道',
    transportMethod: batch?.transportMethod ?? '',
    currency: (batch?.feeCurrency ?? 'RMB') as 'RMB' | 'USD' | 'IDR',
    fees,
    estimatedTotal,
    actualTotal,
    feeDifference: roundPmsQty(actualTotal - estimatedTotal, 2),
    supplierBillAmount,
    difference: roundPmsQty(supplierBillAmount - (actualTotal || estimatedTotal), 2),
    differenceConfirmed: confirmed,
    status: confirmed ? '已确认' : '待确认',
    remark: patch.remark ?? '',
    shipmentNo: patch.shipmentNo ?? '',
    confirmedBy: confirmed ? '刘财务' : '',
    confirmedAt: confirmed ? '2026-06-15 11:00:00' : '',
    paymentRequestNo: patch.paymentRequestNo ?? '',
    importedAt: Object.keys(actual).length > 0 ? '2026-06-14 18:00:00' : '',
    updatedAt: '2026-06-14 18:00:00',
  }
  return row
}

function refreshLogisticsStatus(row: PmsLogisticsReconciliation): void {
  if (row.confirmedBy) {
    row.status = '已确认'
    return
  }
  row.status = row.fees.some((item) => item.confirmed) ? '部分确认' : '待确认'
}

function buildInitialRuntime(): PmsReconciliationRuntime {
  const materialRows: PmsMaterialReconciliation[] = [
    materialRow('MR-2026-0001', 'CGF-2026-0001', { confirmed: true, paymentRequestNo: 'PAY-M-2026-0001' }),
    materialRow('MR-2026-0002', 'CGF-2026-0002', { billDelta: 26, confirmed: true, paymentRequestNo: 'PAY-M-2026-0002' }),
    materialRow('MR-2026-0003', 'CGF-2026-0003', { confirmed: true, paymentRequestNo: 'PAY-M-2026-0003' }),
    materialRow('MR-2026-0004', 'CGF-2026-0004', { billDelta: -18, actualPurchaseAmount: roundPmsQty((listPmsMaterialPurchaseOrders().find((order) => order.purchaseOrderNo === 'CGF-2026-0004')?.orderedQty ?? 0) * (listPmsMaterialPurchaseOrders().find((order) => order.purchaseOrderNo === 'CGF-2026-0004')?.unitPrice ?? 0) - 12, 2), actualDomesticLogisticsFee: listPmsMaterialLogisticsRecords().filter((record) => record.purchaseOrderNo === 'CGF-2026-0004').reduce((sum, record) => sum + record.fee, 0) + 6, feeConfirmations: ['purchaseAmount', 'domesticLogisticsFee'], remark: '实际货款较预计低 12，物流费多 6' }),
    materialRow('MR-2026-0005', 'CGF-2026-0005', { confirmed: true }),
    materialRow('MR-2026-0006', 'CGF-2026-0006'),
    materialRow('MR-2026-0007', 'CGF-2026-0007', { adjustment: 30, billDelta: 30 }),
    materialRow('MR-2026-0008', 'CGF-2026-0008'),
  ]
  const logisticsRows: PmsLogisticsReconciliation[] = [
    logisticsRow('LR-2026-0001', 'FL-2026-0002', { freight: 26800, firstLegLogistics: 600, clearance: 800, customsDeclaration: 420, additional: 400 }, { freight: 27200, firstLegLogistics: 600, clearance: 820, additional: 400 }, { confirmed: true, paymentRequestNo: 'PAY-L-2026-0001' }),
    logisticsRow('LR-2026-0002', 'FL-2026-0001', { freight: 4800, clearance: 300, additional: 180 }, { freight: 4950, clearance: 300, additional: 180 }, { confirmed: true, paymentRequestNo: 'PAY-L-2026-0002' }),
    logisticsRow('LR-2026-0003', 'FL-2026-0003', { freight: 780, customsDuty: 50, clearance: 20, vat: 10 }, {}, {}),
  ]
  return { materialRows, logisticsRows }
}

function getRuntime(): PmsReconciliationRuntime {
  if (!runtime) {
    listPmsMaterialPurchaseOrders()
    listPmsFirstLegBatches()
    runtime = buildInitialRuntime()
  }
  return runtime
}

export function listPmsMaterialReconciliations(): PmsMaterialReconciliation[] {
  return getRuntime().materialRows
}

export function getPmsMaterialReconciliation(id: string): PmsMaterialReconciliation | undefined {
  return getRuntime().materialRows.find((row) => row.id === id)
}

export function listPmsLogisticsReconciliations(): PmsLogisticsReconciliation[] {
  return getRuntime().logisticsRows
}

export function getPmsLogisticsReconciliation(id: string): PmsLogisticsReconciliation | undefined {
  return getRuntime().logisticsRows.find((row) => row.id === id)
}

function recalcMaterialRow(row: PmsMaterialReconciliation): void {
  row.finalPayable = roundPmsQty(pmsMaterialEffectivePurchaseAmount(row) + pmsMaterialEffectiveLogisticsFee(row) + row.adjustment, 2)
  row.difference = roundPmsQty(row.supplierBillAmount - row.finalPayable, 2)
}

export interface PmsUpdateMaterialReconciliationPatch {
  actualUnitPrice?: number | null
  actualPurchaseAmount?: number | null
  actualDomesticLogisticsFee?: number | null
  adjustment?: number
  supplierBillAmount?: number
  invoiceNo?: string
  remark?: string
}

function validateActualAmount(value: number | null, label: string): void {
  if (value === null) return
  if (!Number.isFinite(value) || value < 0) throw new PmsDomainError('RECONCILIATION_FEE_INVALID', `${label}不能为负数`)
}

function revokeMaterialFeeConfirmations(row: PmsMaterialReconciliation, keys: PmsMaterialFeeKey[]): void {
  row.feeConfirmations = row.feeConfirmations.filter((key) => !keys.includes(key))
}

export function updatePmsMaterialReconciliation(
  id: string,
  patch: PmsUpdateMaterialReconciliationPatch,
  actor: { id: string; name: string; role: PmsActorRole },
): PmsMaterialReconciliation {
  const row = getPmsMaterialReconciliation(id)
  if (!row) throw new PmsDomainError('RECONCILIATION_NOT_FOUND', `对账记录 ${id} 不存在`)
  if (row.status === '已确认') throw new PmsDomainError('RECONCILIATION_LOCKED', '已确认的对账记录不能再修改费用')
  if (patch.actualUnitPrice !== undefined) {
    validateActualAmount(patch.actualUnitPrice, '实际单价')
    row.actualUnitPrice = patch.actualUnitPrice
    row.actualPurchaseAmount = null
    revokeMaterialFeeConfirmations(row, ['purchaseAmount'])
  }
  if (patch.actualPurchaseAmount !== undefined) {
    validateActualAmount(patch.actualPurchaseAmount, '实际采购货款')
    row.actualPurchaseAmount = patch.actualPurchaseAmount
    revokeMaterialFeeConfirmations(row, ['purchaseAmount'])
  }
  if (patch.actualDomesticLogisticsFee !== undefined) {
    validateActualAmount(patch.actualDomesticLogisticsFee, '实际国内物流费')
    row.actualDomesticLogisticsFee = patch.actualDomesticLogisticsFee
    revokeMaterialFeeConfirmations(row, ['domesticLogisticsFee'])
  }
  if (patch.adjustment !== undefined) {
    if (!Number.isFinite(patch.adjustment)) throw new PmsDomainError('RECONCILIATION_ADJUSTMENT_INVALID', '调整金额必须是数字')
    row.adjustment = roundPmsQty(patch.adjustment, 2)
    revokeMaterialFeeConfirmations(row, ['adjustment'])
  }
  if (patch.supplierBillAmount !== undefined) {
    if (!Number.isFinite(patch.supplierBillAmount) || patch.supplierBillAmount < 0) throw new PmsDomainError('RECONCILIATION_BILL_INVALID', '供应商账单金额不能为负数')
    row.supplierBillAmount = roundPmsQty(patch.supplierBillAmount, 2)
    revokeMaterialFeeConfirmations(row, ['supplierBillAmount'])
  }
  if (patch.invoiceNo !== undefined) row.invoiceNo = patch.invoiceNo.trim()
  if (patch.remark !== undefined) row.remark = patch.remark.trim()
  row.differenceConfirmed = false
  recalcMaterialRow(row)
  refreshMaterialStatus(row)
  row.updatedAt = new Date().toISOString()
  appendPmsLog({ objectType: 'material-reconciliation', objectId: id, action: '调整对账费用', beforeValue: '', afterValue: `最终应付 ${row.finalPayable} · 差异 ${row.difference}`, reason: '', actorId: actor.id, actorName: actor.name, actorRole: actor.role })
  return row
}

export function confirmPmsMaterialReconciliationFees(
  id: string,
  keys: PmsMaterialFeeKey[],
  actor: { id: string; name: string; role: PmsActorRole },
): PmsMaterialReconciliation {
  const row = getPmsMaterialReconciliation(id)
  if (!row) throw new PmsDomainError('RECONCILIATION_NOT_FOUND', `对账记录 ${id} 不存在`)
  if (row.status === '已确认') throw new PmsDomainError('RECONCILIATION_LOCKED', '已确认的对账记录不能再修改费用')
  if (keys.length === 0) throw new PmsDomainError('RECONCILIATION_FEE_EMPTY_SELECTION', '请至少选择一个费用项确认')
  const invalid = keys.find((key) => !PMS_MATERIAL_FEE_ITEMS.some((item) => item.key === key))
  if (invalid) throw new PmsDomainError('RECONCILIATION_FEE_NOT_FOUND', `费用项 ${invalid} 不存在`)
  keys.forEach((key) => {
    if (!row.feeConfirmations.includes(key)) row.feeConfirmations.push(key)
  })
  row.differenceConfirmed = false
  refreshMaterialStatus(row)
  row.updatedAt = new Date().toISOString()
  const labels = keys.map((key) => PMS_MATERIAL_FEE_ITEMS.find((item) => item.key === key)?.label ?? key).join('、')
  appendPmsLog({ objectType: 'material-reconciliation', objectId: id, action: '分项确认费用', beforeValue: '', afterValue: `${labels} 已确认`, reason: '', actorId: actor.id, actorName: actor.name, actorRole: actor.role })
  return row
}

export function confirmAllPmsMaterialReconciliationFees(id: string, actor: { id: string; name: string; role: PmsActorRole }): PmsMaterialReconciliation {
  return confirmPmsMaterialReconciliationFees(id, PMS_MATERIAL_FEE_ITEMS.map((item) => item.key), actor)
}

export interface PmsReconciliationBatchOutcome {
  updated: string[]
  skipped: Array<{ id: string; reason: string }>
}

export function batchConfirmPmsMaterialReconciliationFees(
  ids: string[],
  keys: PmsMaterialFeeKey[],
  actor: { id: string; name: string; role: PmsActorRole },
): PmsReconciliationBatchOutcome {
  const outcome: PmsReconciliationBatchOutcome = { updated: [], skipped: [] }
  ids.forEach((id) => {
    const row = getPmsMaterialReconciliation(id)
    if (!row) {
      outcome.skipped.push({ id, reason: '对账记录不存在' })
      return
    }
    if (row.status === '已确认') {
      outcome.skipped.push({ id, reason: '对账已确认' })
      return
    }
    try {
      confirmPmsMaterialReconciliationFees(id, keys, actor)
      outcome.updated.push(id)
    } catch (error) {
      outcome.skipped.push({ id, reason: error instanceof PmsDomainError ? error.message : '确认失败' })
    }
  })
  if (outcome.updated.length === 0) throw new PmsDomainError('RECONCILIATION_BATCH_EMPTY', '选中的对账记录都不能确认费用，请检查状态')
  return outcome
}

export function confirmPmsMaterialReconciliationDifference(id: string, actor: { id: string; name: string; role: PmsActorRole }): PmsMaterialReconciliation {
  const row = getPmsMaterialReconciliation(id)
  if (!row) throw new PmsDomainError('RECONCILIATION_NOT_FOUND', `对账记录 ${id} 不存在`)
  if (row.status === '已确认') throw new PmsDomainError('RECONCILIATION_LOCKED', '对账记录已确认')
  row.differenceConfirmed = true
  row.updatedAt = new Date().toISOString()
  appendPmsLog({ objectType: 'material-reconciliation', objectId: id, action: '确认差异', beforeValue: '', afterValue: `差异 ${row.difference}`, reason: '差异确认后才能确认对账', actorId: actor.id, actorName: actor.name, actorRole: actor.role, secondConfirmation: true })
  return row
}

export function confirmPmsMaterialReconciliation(id: string, actor: { id: string; name: string; role: PmsActorRole }): PmsMaterialReconciliation {
  const row = getPmsMaterialReconciliation(id)
  if (!row) throw new PmsDomainError('RECONCILIATION_NOT_FOUND', `对账记录 ${id} 不存在`)
  if (row.status === '已确认') throw new PmsDomainError('RECONCILIATION_CONFIRMED', '对账记录已确认')
  if (row.feeConfirmations.length < PMS_MATERIAL_FEE_ITEMS.length) throw new PmsDomainError('RECONCILIATION_FEE_UNCONFIRMED', '存在未确认的费用项，请逐项确认或点击“确认全部费用”')
  if (row.difference !== 0 && !row.differenceConfirmed) throw new PmsDomainError('RECONCILIATION_DIFF_UNCONFIRMED', '存在差异，必须先确认差异才能确认对账')
  const beforeStatus = row.status
  row.status = '已确认'
  row.confirmedBy = actor.name
  row.confirmedAt = new Date().toISOString()
  row.updatedAt = row.confirmedAt
  appendPmsLog({ objectType: 'material-reconciliation', objectId: id, action: '确认对账', beforeValue: beforeStatus, afterValue: '已确认', reason: '', actorId: actor.id, actorName: actor.name, actorRole: actor.role, secondConfirmation: true })
  return row
}

export function checkPmsMaterialReconciliationGenerate(ids: string[]): { ok: boolean; reason: string; rows: PmsMaterialReconciliation[] } {
  if (ids.length === 0) return { ok: false, reason: '请至少选择一条对账记录', rows: [] }
  const rows = ids.map((id) => getPmsMaterialReconciliation(id)).filter((row): row is PmsMaterialReconciliation => Boolean(row))
  if (rows.length !== ids.length) return { ok: false, reason: '存在无法找到的对账记录', rows: [] }
  const unconfirmed = rows.find((row) => row.status !== '已确认')
  if (unconfirmed) return { ok: false, reason: `${unconfirmed.id} 尚未确认对账，不能生成请款单`, rows: [] }
  const hasRequest = rows.find((row) => row.paymentRequestNo)
  if (hasRequest) return { ok: false, reason: `${hasRequest.id} 已生成请款单 ${hasRequest.paymentRequestNo}`, rows: [] }
  const supplier = rows[0].supplierName
  const currency = rows[0].currency
  const mixed = rows.find((row) => row.supplierName !== supplier || row.currency !== currency)
  if (mixed) return { ok: false, reason: '生成请款单要求同一供应商与同一币种', rows: [] }
  return { ok: true, reason: '', rows }
}

export function markPmsMaterialReconciliationPaymentRequest(ids: string[], requestNo: string): void {
  ids.forEach((id) => {
    const row = getPmsMaterialReconciliation(id)
    if (row) row.paymentRequestNo = requestNo
  })
}

export function unmarkPmsMaterialReconciliationPaymentRequest(ids: string[]): void {
  ids.forEach((id) => {
    const row = getPmsMaterialReconciliation(id)
    if (row) row.paymentRequestNo = ''
  })
}

function recalcLogisticsRow(row: PmsLogisticsReconciliation): void {
  row.estimatedTotal = roundPmsQty(row.fees.reduce((sum, item) => sum + item.estimated, 0), 2)
  row.actualTotal = roundPmsQty(row.fees.reduce((sum, item) => sum + item.actual, 0), 2)
  row.feeDifference = roundPmsQty(row.actualTotal - row.estimatedTotal, 2)
  row.difference = roundPmsQty(row.supplierBillAmount - (row.actualTotal || row.estimatedTotal), 2)
}

export function updatePmsLogisticsReconciliationFee(
  id: string,
  key: PmsLogisticsFeeKey,
  patch: { estimated?: number; actual?: number },
  actor: { id: string; name: string; role: PmsActorRole },
): PmsLogisticsReconciliation {
  const row = getPmsLogisticsReconciliation(id)
  if (!row) throw new PmsDomainError('RECONCILIATION_NOT_FOUND', `物流对账记录 ${id} 不存在`)
  if (row.status === '已确认') throw new PmsDomainError('RECONCILIATION_LOCKED', '已确认的对账记录不能再修改费用')
  const item = row.fees.find((fee) => fee.key === key)
  if (!item) throw new PmsDomainError('RECONCILIATION_FEE_NOT_FOUND', `费用项 ${key} 不存在`)
  if (patch.estimated !== undefined) {
    if (!Number.isFinite(patch.estimated) || patch.estimated < 0) throw new PmsDomainError('RECONCILIATION_FEE_INVALID', '预计费用不能为负数')
    item.estimated = roundPmsQty(patch.estimated, 2)
  }
  if (patch.actual !== undefined) {
    if (!Number.isFinite(patch.actual) || patch.actual < 0) throw new PmsDomainError('RECONCILIATION_FEE_INVALID', '实际费用不能为负数')
    item.actual = roundPmsQty(patch.actual, 2)
    item.confirmed = false
  }
  row.differenceConfirmed = false
  recalcLogisticsRow(row)
  refreshLogisticsStatus(row)
  row.updatedAt = new Date().toISOString()
  appendPmsLog({ objectType: 'logistics-reconciliation', objectId: id, action: '调整物流费用', beforeValue: item.label, afterValue: `实际 ${item.actual}`, reason: '', actorId: actor.id, actorName: actor.name, actorRole: actor.role })
  return row
}

export function confirmPmsLogisticsReconciliationFeeItem(
  id: string,
  key: PmsLogisticsFeeKey,
  actor: { id: string; name: string; role: PmsActorRole },
): PmsLogisticsReconciliation {
  const row = getPmsLogisticsReconciliation(id)
  if (!row) throw new PmsDomainError('RECONCILIATION_NOT_FOUND', `物流对账记录 ${id} 不存在`)
  if (row.status === '已确认') throw new PmsDomainError('RECONCILIATION_LOCKED', '已确认的对账记录不能再修改费用')
  const item = row.fees.find((fee) => fee.key === key)
  if (!item) throw new PmsDomainError('RECONCILIATION_FEE_NOT_FOUND', `费用项 ${key} 不存在`)
  if (item.actual <= 0) throw new PmsDomainError('RECONCILIATION_FEE_EMPTY', `${item.label} 还没有实际金额，不能确认`)
  item.confirmed = true
  row.differenceConfirmed = false
  refreshLogisticsStatus(row)
  row.updatedAt = new Date().toISOString()
  appendPmsLog({ objectType: 'logistics-reconciliation', objectId: id, action: '分项确认费用', beforeValue: item.label, afterValue: `实际 ${item.actual} 已确认`, reason: '', actorId: actor.id, actorName: actor.name, actorRole: actor.role })
  return row
}

export function confirmAllPmsLogisticsReconciliationFees(
  id: string,
  actor: { id: string; name: string; role: PmsActorRole },
): PmsLogisticsReconciliation {
  const row = getPmsLogisticsReconciliation(id)
  if (!row) throw new PmsDomainError('RECONCILIATION_NOT_FOUND', `物流对账记录 ${id} 不存在`)
  if (row.status === '已确认') throw new PmsDomainError('RECONCILIATION_LOCKED', '已确认的对账记录不能再修改费用')
  if (row.actualTotal <= 0) throw new PmsDomainError('RECONCILIATION_ACTUAL_REQUIRED', '请先录入实际费用再确认')
  row.fees.forEach((item) => {
    item.confirmed = true
  })
  row.differenceConfirmed = false
  refreshLogisticsStatus(row)
  row.updatedAt = new Date().toISOString()
  appendPmsLog({ objectType: 'logistics-reconciliation', objectId: id, action: '确认全部费用', beforeValue: '', afterValue: `7 项费用已确认 · 实际 ${row.actualTotal}`, reason: '', actorId: actor.id, actorName: actor.name, actorRole: actor.role })
  return row
}

export function updatePmsLogisticsReconciliationBill(
  id: string,
  amount: number,
  actor: { id: string; name: string; role: PmsActorRole },
): PmsLogisticsReconciliation {
  const row = getPmsLogisticsReconciliation(id)
  if (!row) throw new PmsDomainError('RECONCILIATION_NOT_FOUND', `物流对账记录 ${id} 不存在`)
  if (row.status === '已确认') throw new PmsDomainError('RECONCILIATION_LOCKED', '已确认的对账记录不能再修改供应商账单')
  if (!Number.isFinite(amount) || amount < 0) throw new PmsDomainError('RECONCILIATION_BILL_INVALID', '供应商账单金额不能为负数')
  row.supplierBillAmount = roundPmsQty(amount, 2)
  row.differenceConfirmed = false
  recalcLogisticsRow(row)
  row.updatedAt = new Date().toISOString()
  appendPmsLog({ objectType: 'logistics-reconciliation', objectId: id, action: '调整供应商账单', beforeValue: '', afterValue: `账单 ${row.supplierBillAmount} · 差异 ${row.difference}`, reason: '', actorId: actor.id, actorName: actor.name, actorRole: actor.role })
  return row
}

export function confirmPmsLogisticsReconciliationDifference(id: string, actor: { id: string; name: string; role: PmsActorRole }): PmsLogisticsReconciliation {
  const row = getPmsLogisticsReconciliation(id)
  if (!row) throw new PmsDomainError('RECONCILIATION_NOT_FOUND', `物流对账记录 ${id} 不存在`)
  if (row.status === '已确认') throw new PmsDomainError('RECONCILIATION_LOCKED', '对账记录已确认')
  row.differenceConfirmed = true
  row.updatedAt = new Date().toISOString()
  appendPmsLog({ objectType: 'logistics-reconciliation', objectId: id, action: '确认差异', beforeValue: '', afterValue: `差异 ${row.difference}`, reason: '差异确认后才能确认对账', actorId: actor.id, actorName: actor.name, actorRole: actor.role, secondConfirmation: true })
  return row
}

export function confirmPmsLogisticsReconciliation(id: string, actor: { id: string; name: string; role: PmsActorRole }): PmsLogisticsReconciliation {
  const row = getPmsLogisticsReconciliation(id)
  if (!row) throw new PmsDomainError('RECONCILIATION_NOT_FOUND', `物流对账记录 ${id} 不存在`)
  if (row.status === '已确认') throw new PmsDomainError('RECONCILIATION_CONFIRMED', '对账记录已确认')
  if (row.actualTotal <= 0) throw new PmsDomainError('RECONCILIATION_ACTUAL_REQUIRED', '请先录入实际费用（可导入费用文件）')
  if (!row.fees.every((fee) => fee.confirmed)) throw new PmsDomainError('RECONCILIATION_FEE_UNCONFIRMED', '存在未确认的费用项，请逐项确认或点击“确认全部费用”')
  if (row.difference !== 0 && !row.differenceConfirmed) throw new PmsDomainError('RECONCILIATION_DIFF_UNCONFIRMED', '存在差异，必须先确认差异才能确认对账')
  row.status = '已确认'
  row.confirmedBy = actor.name
  row.confirmedAt = new Date().toISOString()
  row.updatedAt = row.confirmedAt
  appendPmsLog({ objectType: 'logistics-reconciliation', objectId: id, action: '确认对账', beforeValue: '待确认', afterValue: '已确认', reason: '', actorId: actor.id, actorName: actor.name, actorRole: actor.role, secondConfirmation: true })
  return row
}

export function checkPmsLogisticsReconciliationGenerate(ids: string[]): { ok: boolean; reason: string; rows: PmsLogisticsReconciliation[] } {
  if (ids.length === 0) return { ok: false, reason: '请至少选择一条物流对账记录', rows: [] }
  const rows = ids.map((id) => getPmsLogisticsReconciliation(id)).filter((row): row is PmsLogisticsReconciliation => Boolean(row))
  if (rows.length !== ids.length) return { ok: false, reason: '存在无法找到的物流对账记录', rows: [] }
  const unconfirmed = rows.find((row) => row.status !== '已确认')
  if (unconfirmed) return { ok: false, reason: `${unconfirmed.id} 尚未确认对账，不能生成请款单`, rows: [] }
  const hasRequest = rows.find((row) => row.paymentRequestNo)
  if (hasRequest) return { ok: false, reason: `${hasRequest.id} 已生成请款单 ${hasRequest.paymentRequestNo}`, rows: [] }
  const carrier = rows[0].carrierName
  const currency = rows[0].currency
  const mixed = rows.find((row) => row.carrierName !== carrier || row.currency !== currency)
  if (mixed) return { ok: false, reason: '生成请款单要求同一物流商与同一币种', rows: [] }
  return { ok: true, reason: '', rows }
}

export function markPmsLogisticsReconciliationPaymentRequest(ids: string[], requestNo: string): void {
  ids.forEach((id) => {
    const row = getPmsLogisticsReconciliation(id)
    if (row) row.paymentRequestNo = requestNo
  })
}

export function unmarkPmsLogisticsReconciliationPaymentRequest(ids: string[]): void {
  ids.forEach((id) => {
    const row = getPmsLogisticsReconciliation(id)
    if (row) row.paymentRequestNo = ''
  })
}

export interface PmsLogisticsActualImportRow {
  batchNo: string
  carrierName?: string
  trackingNos?: string
  shipmentNo?: string
  fees: Partial<Record<PmsLogisticsFeeKey, number>>
  remark?: string
}

export const PMS_LOGISTICS_IMPORT_HEADERS = ['头程单号', '物流商', '运单号', '货件号', ...PMS_LOGISTICS_FEE_ITEMS.map((item) => item.label), '备注']

export function validatePmsLogisticsActualImportRow(row: PmsLogisticsActualImportRow, seenBatchNos: Set<string>): string {
  if (!row.batchNo.trim()) return '缺少头程单号'
  const match = getRuntime().logisticsRows.find((item) => item.batchNo === row.batchNo.trim())
  if (!match) return `头程单 ${row.batchNo} 不在物流对账列表中`
  if (match.status === '已确认') return `头程单 ${row.batchNo} 的对账已确认，不能再导入实际费用`
  if (seenBatchNos.has(row.batchNo.trim())) return `头程单 ${row.batchNo} 在本次导入中重复`
  if (row.carrierName && row.carrierName.trim() && row.carrierName.trim() !== match.carrierName) return `物流商与头程单 ${row.batchNo} 不一致`
  if (row.trackingNos && row.trackingNos.trim()) {
    const batch = getPmsFirstLegBatch(row.batchNo.trim())
    const known = new Set(batch?.records.map((record) => record.trackingNo) ?? [])
    const unknown = row.trackingNos.split(/[、,，/]/).map((value) => value.trim()).filter(Boolean).find((value) => !known.has(value))
    if (unknown) return `运单号 ${unknown} 不属于头程单 ${row.batchNo}`
  }
  const invalid = PMS_LOGISTICS_FEE_ITEMS.find((item) => {
    const value = row.fees[item.key]
    return value !== undefined && (!Number.isFinite(value) || value < 0)
  })
  if (invalid) return `${invalid.label}必须是非负数字`
  return ''
}

export function importPmsLogisticsActualFees(
  rows: PmsLogisticsActualImportRow[],
  actor: { id: string; name: string; role: PmsActorRole },
): number {
  const seen = new Set<string>()
  rows.forEach((row) => {
    const error = validatePmsLogisticsActualImportRow(row, seen)
    if (error) throw new PmsDomainError('RECONCILIATION_IMPORT_INVALID', error)
    seen.add(row.batchNo.trim())
  })
  let imported = 0
  rows.forEach((row) => {
    const match = getRuntime().logisticsRows.find((item) => item.batchNo === row.batchNo.trim())
    if (!match) return
    match.fees.forEach((item) => {
      const value = row.fees[item.key]
      if (value !== undefined) {
        item.actual = roundPmsQty(value, 2)
        item.confirmed = false
      }
    })
    if (row.remark !== undefined) match.remark = row.remark.trim()
    if (row.shipmentNo !== undefined) match.shipmentNo = row.shipmentNo.trim()
    recalcLogisticsRow(match)
    match.differenceConfirmed = false
    refreshLogisticsStatus(match)
    match.importedAt = new Date().toISOString()
    match.updatedAt = match.importedAt
    imported += 1
    appendPmsLog({ objectType: 'logistics-reconciliation', objectId: match.id, action: '导入实际费用', beforeValue: '', afterValue: `实际合计 ${match.actualTotal} · 预计/实际差异 ${match.feeDifference}`, reason: '导入只覆盖实际层，不自动确认', actorId: actor.id, actorName: actor.name, actorRole: actor.role })
  })
  return imported
}

export interface PmsMaterialBillImportRow {
  purchaseOrderNo: string
  materialCode: string
  actualUnitPrice?: number
  actualPurchaseAmount?: number
  actualDomesticLogisticsFee?: number
  supplierBillAmount?: number
  adjustment?: number
  remark?: string
  reconciliationId?: string
}

export const PMS_MATERIAL_BILL_IMPORT_HEADERS = ['采购单号', '物料编码', '实际单价', '实际采购货款', '实际国内物流费', '供应商账单', '调整金额', '备注', '对账记录']

function findMaterialReconciliationByOrder(planNo: string, materialCode: string): PmsMaterialReconciliation | undefined {
  return getRuntime().materialRows.find((row) => row.purchaseOrderNos.includes(planNo) && row.materialCode === materialCode)
}

export function validatePmsMaterialBillImportRow(row: PmsMaterialBillImportRow, seenKeys: Set<string>): string {
  const purchaseOrderNo = row.purchaseOrderNo.trim()
  const materialCode = row.materialCode.trim()
  if (!purchaseOrderNo) return '缺少采购单号'
  if (!materialCode) return '缺少物料编码'
  const match = findMaterialReconciliationByOrder(purchaseOrderNo, materialCode)
  if (!match) return `采购单 ${purchaseOrderNo} + ${materialCode} 不在对账列表中`
  if (row.reconciliationId && row.reconciliationId.trim() && row.reconciliationId.trim() !== match.id) return `对账记录 ${row.reconciliationId} 与采购单不匹配`
  if (match.status === '已确认') return `${match.id} 的对账已确认，不能再导入账单`
  const key = `${purchaseOrderNo}::${materialCode}`
  if (seenKeys.has(key)) return `采购单 ${purchaseOrderNo} + ${materialCode} 在本次导入中重复`
  const numericFields: Array<{ value: number | undefined; label: string; allowNegative?: boolean }> = [
    { value: row.actualUnitPrice, label: '实际单价' },
    { value: row.actualPurchaseAmount, label: '实际采购货款' },
    { value: row.actualDomesticLogisticsFee, label: '实际国内物流费' },
    { value: row.supplierBillAmount, label: '供应商账单' },
    { value: row.adjustment, label: '调整金额', allowNegative: true },
  ]
  const invalid = numericFields.find((field) => field.value !== undefined && (!Number.isFinite(field.value) || (!field.allowNegative && field.value < 0)))
  if (invalid) return `${invalid.label}${invalid.allowNegative ? '必须是数字' : '必须是非负数字'}`
  if (numericFields.every((field) => field.value === undefined)) return '至少要填写一项费用'
  return ''
}

export function importPmsMaterialSupplierBills(
  rows: PmsMaterialBillImportRow[],
  actor: { id: string; name: string; role: PmsActorRole },
): number {
  const seen = new Set<string>()
  rows.forEach((row) => {
    const error = validatePmsMaterialBillImportRow(row, seen)
    if (error) throw new PmsDomainError('RECONCILIATION_IMPORT_INVALID', error)
    seen.add(`${row.purchaseOrderNo.trim()}::${row.materialCode.trim()}`)
  })
  let imported = 0
  rows.forEach((row) => {
    const match = findMaterialReconciliationByOrder(row.purchaseOrderNo.trim(), row.materialCode.trim())
    if (!match) return
    if (row.actualUnitPrice !== undefined) {
      match.actualUnitPrice = roundPmsQty(row.actualUnitPrice, 2)
      match.actualPurchaseAmount = null
      revokeMaterialFeeConfirmations(match, ['purchaseAmount'])
    }
    if (row.actualPurchaseAmount !== undefined) {
      match.actualPurchaseAmount = roundPmsQty(row.actualPurchaseAmount, 2)
      revokeMaterialFeeConfirmations(match, ['purchaseAmount'])
    }
    if (row.actualDomesticLogisticsFee !== undefined) {
      match.actualDomesticLogisticsFee = roundPmsQty(row.actualDomesticLogisticsFee, 2)
      revokeMaterialFeeConfirmations(match, ['domesticLogisticsFee'])
    }
    if (row.supplierBillAmount !== undefined) {
      match.supplierBillAmount = roundPmsQty(row.supplierBillAmount, 2)
      revokeMaterialFeeConfirmations(match, ['supplierBillAmount'])
    }
    if (row.adjustment !== undefined) {
      match.adjustment = roundPmsQty(row.adjustment, 2)
      revokeMaterialFeeConfirmations(match, ['adjustment'])
    }
    if (row.remark !== undefined) match.remark = row.remark.trim()
    match.differenceConfirmed = false
    recalcMaterialRow(match)
    refreshMaterialStatus(match)
    match.updatedAt = new Date().toISOString()
    imported += 1
    appendPmsLog({ objectType: 'material-reconciliation', objectId: match.id, action: '导入供应商账单', beforeValue: '', afterValue: `最终应付 ${match.finalPayable} · 差异 ${match.difference}`, reason: '导入只覆盖实际层，不自动确认', actorId: actor.id, actorName: actor.name, actorRole: actor.role })
  })
  return imported
}

export interface PmsLogisticsShipmentRow {
  recordNo: string
  trackingNo: string
  boxCount: number
  issuedQty: number
  signedQty: number
  unit: string
}

export function listPmsLogisticsReconciliationShipments(batchNo: string): PmsLogisticsShipmentRow[] {
  const batch = getPmsFirstLegBatch(batchNo)
  if (!batch) return []
  const signedMap = new Map(listPmsMaterialLogisticsRecords().map((record) => [record.recordNo, record]))
  return batch.records.map((record) => {
    const source = signedMap.get(record.recordNo)
    return {
      recordNo: record.recordNo,
      trackingNo: record.trackingNo,
      boxCount: record.boxCount,
      issuedQty: record.qty,
      signedQty: source?.headSigned ? record.qty : 0,
      unit: record.unit,
    }
  })
}


export interface PmsReconciliationPurchaseRow {
  purchaseOrderNo: string
  materialCode: string
  materialName: string
  styleName: string
  qty: number
  unit: string
  unitPrice: number
  amount: number
  supplierName: string
  status: string
  orderedAt: string
}

export function listPmsLogisticsReconciliationPurchases(batchNo: string): PmsReconciliationPurchaseRow[] {
  const orderNos = [...new Set(
    listPmsMaterialLogisticsRecords()
      .filter((record) => record.headBatchNo === batchNo)
      .map((record) => record.purchaseOrderNo),
  )]
  return orderNos
    .map((orderNo) => getPmsMaterialPurchaseOrder(orderNo))
    .filter((order): order is NonNullable<typeof order> => Boolean(order))
    .map((order) => ({
      purchaseOrderNo: order.purchaseOrderNo,
      materialCode: order.materialCode,
      materialName: order.materialName,
      styleName: order.styleName,
      qty: order.orderedQty,
      unit: order.unit,
      unitPrice: order.unitPrice,
      amount: roundPmsQty(order.orderedQty * order.unitPrice, 2),
      supplierName: order.supplierName,
      status: order.status,
      orderedAt: order.orderDate,
    }))
}
