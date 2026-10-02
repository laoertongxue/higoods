import {
  checkPmsLogisticsReconciliationGenerate,
  checkPmsMaterialReconciliationGenerate,
  markPmsMaterialReconciliationPaymentRequest,
  pmsApplyPaymentRequestNoToLogistics,
  pmsApplyPaymentRequestNoToMaterial,
} from './reconciliations.ts'
import { PMS_STORES, pmsAll, pmsDelete, pmsGetVersionMap, pmsPersistEntity, pmsPut, pmsTx } from './idb-storage.ts'
import { appendPmsLog, appendPmsLogInMemory, PmsDomainError, roundPmsQty, type PmsActorRole } from './runtime.ts'

/**
 * 请款单 IDB hydrate 状态机(race-condition 防御同 runtime.ts):
 * - 启动期 hydrate 未就绪时,业务写入的草稿/请求进入 pending 队列,等 hydrate 完成后由 hydrate 接管 put。
 * - hydrate 完成后业务写入 fire-and-forget put,pmsPut 内部事务 oncomplete 后 broadcast 通知多标签页。
 */
let paymentHydrationStarted = false
let paymentHydrationPromise: Promise<void> | null = null
let paymentHydrationReady = false
type PendingPaymentWrite =
  | { kind: 'request'; entity: PmsPaymentRequest }
  | { kind: 'draft'; draftKey: 'material' | 'logistics'; entity: PmsPaymentDraft }
  | { kind: 'delete-draft'; draftKey: 'material' | 'logistics' }
const pendingHydrationPayment: PendingPaymentWrite[] = []

/**
 * 启动期加载:从 IDB 把已保存的请款单与草稿搬回内存。
 * 加载未完成时 listPmsPaymentRequests/getPmsPaymentRequest 返回种子;hydrate 后用 IDB 数据覆盖内存。
 */
export function hydratePmsPaymentFromIdb(): Promise<void> {
  if (paymentHydrationStarted) return paymentHydrationPromise ?? Promise.resolve()
  paymentHydrationStarted = true
  paymentHydrationPromise = (async () => {
    try {
      const [storedRequests, storedDrafts] = await Promise.all([
        pmsAll<PmsPaymentRequest>(PMS_STORES.pmsPaymentRequests),
        pmsAll<PmsPaymentDraft & { draftKey: 'material' | 'logistics' }>(PMS_STORES.pmsPaymentDrafts),
      ])
      // 收集 hydrate 期间已声明要删除的草稿键,避免从 IDB 拉回覆盖内存(已消费)状态。
      const deletedDraftKeys = new Set<'material' | 'logistics'>()
      for (const pending of pendingHydrationPayment) {
        if (pending.kind === 'delete-draft') deletedDraftKeys.add(pending.draftKey)
      }
      const rt = getRuntime()
      for (const saved of storedRequests) {
        const existing = rt.requests.find((r) => r.requestNo === saved.requestNo)
        if (existing) Object.assign(existing, saved)
        else rt.requests.push(saved)
      }
      for (const saved of storedDrafts) {
        if (deletedDraftKeys.has(saved.draftKey)) continue
        const { draftKey, ...draft } = saved
        if (draftKey === 'material') materialDraft = draft
        else if (draftKey === 'logistics') logisticsDraft = draft
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown'
      console.error('[PMS_IDB_LOAD_FAILED] 请款加载失败', { message })
    } finally {
      paymentHydrationReady = true
      const pending = pendingHydrationPayment.splice(0)
      for (const item of pending) {
        try {
          if (item.kind === 'request') {
            await pmsPut(PMS_STORES.pmsPaymentRequests, item.entity)
          } else if (item.kind === 'draft') {
            await pmsPut(PMS_STORES.pmsPaymentDrafts, { ...item.entity, draftKey: item.draftKey })
          } else {
            await pmsDelete(PMS_STORES.pmsPaymentDrafts, item.draftKey)
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : 'unknown'
          console.error('[PMS_IDB_SAVE_FAILED] 请款 IDB 写入失败(hydration 后)', { kind: item.kind, message })
        }
      }
    }
  })()
  return paymentHydrationPromise
}

function persistPmsPaymentRequest(request: PmsPaymentRequest): void {
  if (paymentHydrationReady) {
    pmsPut(PMS_STORES.pmsPaymentRequests, request).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'unknown'
      console.error('[PMS_IDB_SAVE_FAILED] 请款单 IDB 写入失败', { requestNo: request.requestNo, message })
    })
  } else {
    pendingHydrationPayment.push({ kind: 'request', entity: request })
  }
}

function persistPmsPaymentDraft(draftKey: 'material' | 'logistics', draft: PmsPaymentDraft): void {
  if (paymentHydrationReady) {
    pmsPut(PMS_STORES.pmsPaymentDrafts, { ...draft, draftKey }).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'unknown'
      console.error('[PMS_IDB_SAVE_FAILED] 请款草稿 IDB 写入失败', { draftKey, message })
    })
  } else {
    pendingHydrationPayment.push({ kind: 'draft', draftKey, entity: draft })
  }
}

function deletePmsPaymentDraftFromIdb(draftKey: 'material' | 'logistics'): void {
  if (paymentHydrationReady) {
    pmsDelete(PMS_STORES.pmsPaymentDrafts, draftKey).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'unknown'
      console.error('[PMS_IDB_SAVE_FAILED] 请款草稿 IDB 删除失败', { draftKey, message })
    })
  } else {
    // race condition 防御:hydrate 未就绪就消费草稿,必须记录删除意图,
    // 防止 hydrate 完成后从 IDB 拉回旧的 draft 覆盖内存中的"已消费"状态。
    pendingHydrationPayment.push({ kind: 'delete-draft', draftKey })
  }
}

export type PmsPaymentRequestType = 'material' | 'logistics'
export type PmsPaymentRequestStatus = '未请款' | '部分请款' | '已请款' | '已完成' | '已作废'
export type PmsPaymentStatus = '未付款' | '部分付款' | '已付款'

export interface PmsPaymentSourceRow {
  sourceId: string
  sourceLabel: string
  amount: number
}

export interface PmsPaymentAttachment {
  name: string
  description: string
  uploadedBy: string
  uploadedAt: string
}

export interface PmsPaymentPayee {
  name: string
  shortName: string
  currency: 'RMB' | 'USD' | 'IDR'
  bankName: string
  bankAccount: string
  swiftCode: string
  address: string
  contactName: string
  contactPhone: string
}

export interface PmsPaymentInfo {
  paymentType: '全款' | '部分付款'
  payerEntity: string
  method: '银行转账' | '承兑' | '现金'
  nature: '材料款' | '物流费' | '其他'
  applicant: string
  applicantDept: string
  note: string
}

export interface PmsPaymentAmountInfo {
  exchangeRate: number
  baseCurrencyAmount: number
}

export interface PmsPaymentNarrative {
  purpose: string
  feeDetail: string
  supplement: string
}

export interface PmsPaymentRequestRecord {
  at: string
  amount: number
  note: string
  operator: string
}

export interface PmsPaymentRecord {
  at: string
  amount: number
  method: '银行转账' | '承兑' | '现金'
  voucherNo: string
  note: string
  operator: string
}

export interface PmsPaymentRequest {
  requestNo: string
  type: PmsPaymentRequestType
  objectName: string
  currency: 'RMB' | 'USD' | 'IDR'
  payableAmount: number
  requestedAmount: number
  paidAmount: number
  status: PmsPaymentRequestStatus
  paymentStatus: PmsPaymentStatus
  sourceRows: PmsPaymentSourceRow[]
  attachments: PmsPaymentAttachment[]
  payee: PmsPaymentPayee
  paymentInfo: PmsPaymentInfo
  amountInfo: PmsPaymentAmountInfo
  narrative: PmsPaymentNarrative
  requestRecords: PmsPaymentRequestRecord[]
  paymentRecords: PmsPaymentRecord[]
  remark: string
  voidReason: string
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface PmsPaymentDraft {
  type: PmsPaymentRequestType
  objectName: string
  currency: 'RMB' | 'USD' | 'IDR'
  rows: PmsPaymentSourceRow[]
  totalAmount: number
  createdAt: string
}

interface PmsPaymentRuntime {
  requests: PmsPaymentRequest[]
}

let runtime: PmsPaymentRuntime | null = null
let materialDraft: PmsPaymentDraft | null = null
let logisticsDraft: PmsPaymentDraft | null = null
let materialSequence = 5
let logisticsSequence = 3

function deriveStatus(request: PmsPaymentRequest): PmsPaymentRequestStatus {
  if (request.voidReason) return '已作废'
  if (request.paidAmount >= request.payableAmount && request.payableAmount > 0) return '已完成'
  if (request.requestedAmount >= request.payableAmount && request.payableAmount > 0) return '已请款'
  if (request.requestedAmount > 0) return '部分请款'
  return '未请款'
}

function derivePaymentStatus(request: PmsPaymentRequest): PmsPaymentStatus {
  if (request.paidAmount <= 0) return '未付款'
  if (request.paidAmount >= request.requestedAmount) return '已付款'
  return '部分付款'
}

function refresh(request: PmsPaymentRequest): PmsPaymentRequest {
  request.status = deriveStatus(request)
  request.paymentStatus = derivePaymentStatus(request)
  return request
}

function buildRequest(
  requestNo: string,
  type: PmsPaymentRequestType,
  objectName: string,
  currency: 'RMB' | 'USD' | 'IDR',
  sourceRows: PmsPaymentSourceRow[],
  payableAmount: number,
  requestedAmount: number,
  paidAmount: number,
  extra: {
    remark?: string
    voidReason?: string
    attachments?: PmsPaymentAttachment[]
    createdAt?: string
    payee?: Partial<PmsPaymentPayee>
    paymentInfo?: Partial<PmsPaymentInfo>
    amountInfo?: Partial<PmsPaymentAmountInfo>
    narrative?: Partial<PmsPaymentNarrative>
    requestRecords?: PmsPaymentRequestRecord[]
    paymentRecords?: PmsPaymentRecord[]
  } = {},
): PmsPaymentRequest {
  const request: PmsPaymentRequest = {
    requestNo,
    type,
    objectName,
    currency,
    payableAmount,
    requestedAmount,
    paidAmount,
    status: '未请款',
    paymentStatus: '未付款',
    sourceRows,
    attachments: extra.attachments ?? [],
    payee: {
      name: objectName,
      shortName: '',
      currency,
      bankName: '',
      bankAccount: '',
      swiftCode: '',
      address: '',
      contactName: '',
      contactPhone: '',
      ...extra.payee,
    },
    paymentInfo: {
      paymentType: '全款',
      payerEntity: '深圳市海谷科技有限公司',
      method: '银行转账',
      nature: type === 'material' ? '材料款' : '物流费',
      applicant: '刘财务',
      applicantDept: '财务部',
      note: '',
      ...extra.paymentInfo,
    },
    amountInfo: {
      exchangeRate: 1,
      baseCurrencyAmount: payableAmount,
      ...extra.amountInfo,
    },
    narrative: {
      purpose: '',
      feeDetail: sourceRows.map((row) => `${row.sourceId} ${row.sourceLabel}`).join('；'),
      supplement: extra.remark ?? '',
      ...extra.narrative,
    },
    requestRecords: extra.requestRecords ?? [],
    paymentRecords: extra.paymentRecords ?? [],
    remark: extra.remark ?? '',
    voidReason: extra.voidReason ?? '',
    createdBy: '刘财务',
    createdAt: extra.createdAt ?? '2026-06-16 09:00:00',
    updatedAt: extra.createdAt ?? '2026-06-16 09:00:00',
  }
  return refresh(request)
}

function buildInitialRuntime(): PmsPaymentRuntime {
  const requests: PmsPaymentRequest[] = [
    buildRequest('PAY-M-2026-0001', 'material', '广州华盛面料有限公司', 'RMB', [{ sourceId: 'MR-2026-0001', sourceLabel: '180g 纯棉针织布（CGF-2026-0001）', amount: 15008 }], 15008, 15008, 0, { createdAt: '2026-06-14 10:30:00' }),
    buildRequest('PAY-M-2026-0002', 'material', '东莞宏远辅料有限公司', 'RMB', [{ sourceId: 'MR-2026-0002', sourceLabel: '黑色四眼纽扣（CGF-2026-0002）', amount: 389.28 }], 389.28, 200, 100, {
      createdAt: '2026-06-14 11:00:00',
      payee: { shortName: '宏远辅料', bankName: '中国建设银行东莞分行', bankAccount: '6217 0038 8899 0001', swiftCode: 'PCBCCNBJGDX', address: '广东省东莞市虎门镇辅料城 8 栋', contactName: '陈宏', contactPhone: '13900001111' },
      paymentInfo: { paymentType: '部分付款', note: '先付 200，余款月底结清' },
      narrative: { purpose: '黑色四眼纽扣 5 月采购款', feeDetail: 'MR-2026-0002 · 采购货款 389.28', supplement: '供应商已开具增值税发票' },
      requestRecords: [{ at: '2026-06-14 11:20:00', amount: 200, note: '首次请款 200', operator: '刘财务' }],
      paymentRecords: [{ at: '2026-06-15 16:00:00', amount: 100, method: '银行转账', voucherNo: 'BK-20260615-001', note: '先付 100，余款下周', operator: '刘财务' }],
    }),
    buildRequest('PAY-M-2026-0003', 'material', '广州华盛面料有限公司', 'RMB', [{ sourceId: 'MR-2026-0003', sourceLabel: '180g 纯棉针织布（CGF-2026-0003）', amount: 38810.4 }], 38810.4, 38810.4, 38810.4, {
      createdAt: '2026-06-10 09:00:00',
      requestRecords: [{ at: '2026-06-10 09:30:00', amount: 38810.4, note: '全额请款', operator: '刘财务' }],
      paymentRecords: [{ at: '2026-06-12 14:00:00', amount: 38810.4, method: '银行转账', voucherNo: 'BK-20260612-004', note: '全额付款', operator: '刘财务' }],
    }),
    buildRequest('PAY-M-2026-0004', 'material', '中山针织制衣有限公司', 'RMB', [{ sourceId: 'MR-2026-0005', sourceLabel: '涤纶缝纫线（CGF-2026-0005）', amount: 780 }], 780, 0, 0, { createdAt: '2026-06-16 09:00:00', remark: '待提交请款' }),
    buildRequest('PAY-M-2026-0005', 'material', '苏州恒润包装材料有限公司', 'RMB', [{ sourceId: 'MR-2026-0008', sourceLabel: '40×60cm 透明胶袋（CGF-2026-0008）', amount: 2400 }], 2400, 0, 0, { createdAt: '2026-06-12 09:00:00', voidReason: '供应商账单金额有误，已撤回重开' }),
    buildRequest('PAY-L-2026-0001', 'logistics', '广州市洋帆国际货运代理有限公司', 'RMB', [{ sourceId: 'LR-2026-0001', sourceLabel: '广州-雅加达 海运整柜（FL-2026-0002）', amount: 29020 }], 29020, 29020, 0, { createdAt: '2026-06-15 14:00:00' }),
    buildRequest('PAY-L-2026-0002', 'logistics', '深圳市迅达国际物流有限公司', 'RMB', [{ sourceId: 'LR-2026-0002', sourceLabel: '深圳-雅加达 海派专线（FL-2026-0001）', amount: 5430 }], 5430, 3000, 1500, {
      createdAt: '2026-06-15 15:00:00',
      paymentInfo: { paymentType: '部分付款', method: '银行转账', note: '按票结算，先付一半' },
      requestRecords: [{ at: '2026-06-15 15:30:00', amount: 3000, note: '首期请款 3000', operator: '刘财务' }],
      paymentRecords: [{ at: '2026-06-16 10:00:00', amount: 1500, method: '银行转账', voucherNo: 'BK-20260616-002', note: '首笔付款 1500', operator: '刘财务' }],
    }),
  ]
  markPmsMaterialReconciliationPaymentRequest(['MR-2026-0005'], 'PAY-M-2026-0004')
  return { requests }
}

function getRuntime(): PmsPaymentRuntime {
  if (!runtime) {
    runtime = buildInitialRuntime()
    const pendingMaterial = runtime.requests.find((request) => request.requestNo === 'PAY-M-2026-0001')
    if (pendingMaterial) pendingMaterial.attachments = [{ name: '供应商对账单-华盛-2026-05.pdf', description: '供应商盖章对账单', uploadedBy: '刘财务', uploadedAt: '2026-06-14 10:35:00' }]
    const partial = runtime.requests.find((request) => request.requestNo === 'PAY-M-2026-0002')
    if (partial) partial.attachments = [{ name: '付款回单-200元.jpg', description: '首笔付款回单', uploadedBy: '刘财务', uploadedAt: '2026-06-15 16:00:00' }]
  }
  return runtime
}

export function listPmsPaymentRequests(type?: PmsPaymentRequestType): PmsPaymentRequest[] {
  const requests = getRuntime().requests
  return type ? requests.filter((request) => request.type === type) : requests
}

export function getPmsPaymentRequest(requestNo: string): PmsPaymentRequest | undefined {
  return getRuntime().requests.find((request) => request.requestNo === requestNo)
}

export function setPmsMaterialPaymentDraft(ids: string[]): PmsPaymentDraft {
  const check = checkPmsMaterialReconciliationGenerate(ids)
  if (!check.ok) throw new PmsDomainError('PAYMENT_DRAFT_BLOCKED', check.reason)
  const rows = check.rows
  materialDraft = {
    type: 'material',
    objectName: rows[0].supplierName,
    currency: rows[0].currency,
    rows: rows.map((row) => ({ sourceId: row.id, sourceLabel: `${row.materialName}（${row.purchaseOrderNos.join('、')}）`, amount: row.finalPayable })),
    totalAmount: roundPmsQty(rows.reduce((sum, row) => sum + row.finalPayable, 0), 2),
    createdAt: new Date().toISOString(),
  }
  persistPmsPaymentDraft('material', materialDraft)
  return materialDraft
}

export function setPmsLogisticsPaymentDraft(ids: string[]): PmsPaymentDraft {
  const check = checkPmsLogisticsReconciliationGenerate(ids)
  if (!check.ok) throw new PmsDomainError('PAYMENT_DRAFT_BLOCKED', check.reason)
  const rows = check.rows
  logisticsDraft = {
    type: 'logistics',
    objectName: rows[0].carrierName,
    currency: rows[0].currency,
    rows: rows.map((row) => ({ sourceId: row.id, sourceLabel: `${row.channelName}（${row.batchNo}）`, amount: row.actualTotal || row.estimatedTotal })),
    totalAmount: roundPmsQty(rows.reduce((sum, row) => sum + (row.actualTotal || row.estimatedTotal), 0), 2),
    createdAt: new Date().toISOString(),
  }
  persistPmsPaymentDraft('logistics', logisticsDraft)
  return logisticsDraft
}

export function consumePmsPaymentDraft(type: PmsPaymentRequestType): PmsPaymentDraft | null {
  if (type === 'material') {
    const draft = materialDraft
    materialDraft = null
    if (draft) deletePmsPaymentDraftFromIdb('material')
    return draft
  }
  const draft = logisticsDraft
  logisticsDraft = null
  if (draft) deletePmsPaymentDraftFromIdb('logistics')
  return draft
}

export interface PmsPaymentRequestInfoInput {
  payee?: Partial<PmsPaymentPayee>
  paymentInfo?: Partial<PmsPaymentInfo>
  amountInfo?: Partial<PmsPaymentAmountInfo>
  narrative?: Partial<PmsPaymentNarrative>
}

export function createPmsPaymentRequestFromDraft(draft: PmsPaymentDraft, actor: { id: string; name: string; role: PmsActorRole }, info: PmsPaymentRequestInfoInput = {}): PmsPaymentRequest {
  if (draft.rows.length === 0) throw new PmsDomainError('PAYMENT_DRAFT_EMPTY', '请款草稿没有对账明细')
  if (draft.totalAmount <= 0) throw new PmsDomainError('PAYMENT_AMOUNT_INVALID', '请款金额必须大于 0')
  const requestNo = draft.type === 'material'
    ? `PAY-M-2026-${String((materialSequence += 1)).padStart(4, '0')}`
    : `PAY-L-2026-${String((logisticsSequence += 1)).padStart(4, '0')}`
  const request = buildRequest(requestNo, draft.type, draft.objectName, draft.currency, draft.rows, draft.totalAmount, 0, 0, {
    createdAt: new Date().toISOString(),
    payee: info.payee,
    paymentInfo: info.paymentInfo,
    amountInfo: info.amountInfo,
    narrative: info.narrative,
  })
  request.createdBy = actor.name
  getRuntime().requests.unshift(request)
  const ids = draft.rows.map((row) => row.sourceId)
  // § 2.4.3.3 原子提交:同一 IDB 事务内 put request + 关联 reconciliations + log。
  const modifiedReconciliations = draft.type === 'material'
    ? pmsApplyPaymentRequestNoToMaterial(ids, requestNo)
    : pmsApplyPaymentRequestNoToLogistics(ids, requestNo)
  const log = appendPmsLogInMemory({ objectType: 'payment-request', objectId: requestNo, action: '创建请款单', beforeValue: '', afterValue: `${draft.objectName} · ${draft.currency} ${draft.totalAmount}`, reason: '由对账明细生成', actorId: actor.id, actorName: actor.name, actorRole: actor.role })
  // § 2.4.3.3 原子提交:fire-and-forget 异步 IDB 事务,内存态已同步,失败由 unhandledrejection banner 暴露。
  void pmsTx([PMS_STORES.pmsPaymentRequests, PMS_STORES.pmsReconciliations, PMS_STORES.pmsOperationLogs], 'readwrite', (tx) => {
    tx.objectStore(PMS_STORES.pmsPaymentRequests).put(request)
    for (const row of modifiedReconciliations) {
      tx.objectStore(PMS_STORES.pmsReconciliations).put(row)
    }
    tx.objectStore(PMS_STORES.pmsOperationLogs).put(log)
  }).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'unknown'
    console.error('[PMS_IDB_SAVE_FAILED] 创建请款单 IDB 写入失败', { requestNo, message })
  })
  return request
}

export interface PmsPaymentEditScope {
  level: 'full' | 'attachment-only' | 'readonly'
  reason: string
}

export function checkPmsPaymentRequestEditScope(requestNo: string): PmsPaymentEditScope {
  const request = getPmsPaymentRequest(requestNo)
  if (!request) return { level: 'readonly', reason: '请款单不存在' }
  if (request.status === '已完成' || request.status === '已作废') return { level: 'readonly', reason: `${request.status}的请款单不允许修改` }
  if (request.status === '未请款') return { level: 'full', reason: '' }
  return { level: 'attachment-only', reason: '部分请款/已请款的请款单只能补充附件与备注' }
}

export function updatePmsPaymentRequestInfo(
  requestNo: string,
  patch: PmsPaymentRequestInfoInput,
  actor: { id: string; name: string; role: PmsActorRole },
): PmsPaymentRequest {
  const request = getPmsPaymentRequest(requestNo)
  if (!request) throw new PmsDomainError('PAYMENT_NOT_FOUND', `请款单 ${requestNo} 不存在`)
  const scope = checkPmsPaymentRequestEditScope(requestNo)
  if (scope.level !== 'full') throw new PmsDomainError('PAYMENT_LOCKED', scope.reason || '当前状态不允许修改请款信息')
  if (patch.payee) {
    if (patch.payee.name !== undefined && !patch.payee.name.trim()) throw new PmsDomainError('PAYMENT_PAYEE_REQUIRED', '收款人名称不能为空')
    request.payee = { ...request.payee, ...patch.payee }
    if (patch.payee.currency !== undefined) request.payee.currency = patch.payee.currency
  }
  if (patch.paymentInfo) request.paymentInfo = { ...request.paymentInfo, ...patch.paymentInfo }
  if (patch.amountInfo) {
    if (patch.amountInfo.exchangeRate !== undefined && (!Number.isFinite(patch.amountInfo.exchangeRate) || patch.amountInfo.exchangeRate <= 0)) {
      throw new PmsDomainError('PAYMENT_EXCHANGE_INVALID', '汇率必须是大于 0 的数字')
    }
    if (patch.amountInfo.baseCurrencyAmount !== undefined && (!Number.isFinite(patch.amountInfo.baseCurrencyAmount) || patch.amountInfo.baseCurrencyAmount < 0)) {
      throw new PmsDomainError('PAYMENT_BASE_AMOUNT_INVALID', '折算本位币金额不能为负数')
    }
    request.amountInfo = { ...request.amountInfo, ...patch.amountInfo }
  }
  if (patch.narrative) request.narrative = { ...request.narrative, ...patch.narrative }
  request.updatedAt = new Date().toISOString()
  appendPmsLog({ objectType: 'payment-request', objectId: requestNo, action: '更新请款信息', beforeValue: '', afterValue: `${request.payee.name} · ${request.paymentInfo.paymentType}`, reason: '', actorId: actor.id, actorName: actor.name, actorRole: actor.role })
  persistPmsPaymentRequest(request)
  return request
}

export function submitPmsPaymentRequest(requestNo: string, amount: number, actor: { id: string; name: string; role: PmsActorRole }, note = '', at = ''): PmsPaymentRequest {
  const request = getPmsPaymentRequest(requestNo)
  if (!request) throw new PmsDomainError('PAYMENT_NOT_FOUND', `请款单 ${requestNo} 不存在`)
  if (request.status === '已完成' || request.status === '已作废') throw new PmsDomainError('PAYMENT_LOCKED', `${request.status}的请款单不能提交请款`)
  if (!Number.isFinite(amount) || amount <= 0) throw new PmsDomainError('PAYMENT_AMOUNT_INVALID', '请款金额必须大于 0')
  const pending = roundPmsQty(request.payableAmount - request.requestedAmount, 2)
  if (amount > pending) throw new PmsDomainError('PAYMENT_AMOUNT_OVER', `请款金额不能超过待请款金额 ${pending}`)
  request.requestedAmount = roundPmsQty(request.requestedAmount + amount, 2)
  request.requestRecords.unshift({ at: at.trim() ? at.trim() : new Date().toISOString(), amount: roundPmsQty(amount, 2), note: note.trim(), operator: actor.name })
  request.updatedAt = new Date().toISOString()
  refresh(request)
  appendPmsLog({ objectType: 'payment-request', objectId: requestNo, action: '提交请款', beforeValue: `已请款 ${request.requestedAmount - amount}`, afterValue: `已请款 ${request.requestedAmount} · ${request.status}`, reason: '', actorId: actor.id, actorName: actor.name, actorRole: actor.role })
  persistPmsPaymentRequest(request)
  return request
}

export function registerPmsPayment(
  requestNo: string,
  patch: { amount: number; method: '银行转账' | '承兑' | '现金'; note?: string; voucherNo?: string; paidAt?: string },
  actor: { id: string; name: string; role: PmsActorRole },
): PmsPaymentRequest {
  const request = getPmsPaymentRequest(requestNo)
  if (!request) throw new PmsDomainError('PAYMENT_NOT_FOUND', `请款单 ${requestNo} 不存在`)
  if (request.voidReason) throw new PmsDomainError('PAYMENT_VOIDED', '已作废的请款单不能付款')
  if (request.status === '未请款') throw new PmsDomainError('PAYMENT_NOT_REQUESTED', '请先提交请款再登记付款')
  if (!Number.isFinite(patch.amount) || patch.amount <= 0) throw new PmsDomainError('PAYMENT_AMOUNT_INVALID', '付款金额必须大于 0')
  const remaining = roundPmsQty(request.requestedAmount - request.paidAmount, 2)
  if (patch.amount > remaining) throw new PmsDomainError('PAYMENT_AMOUNT_OVER', `付款金额不能超过未付金额 ${remaining}`)
  request.paidAmount = roundPmsQty(request.paidAmount + patch.amount, 2)
  request.paymentRecords.unshift({
    at: patch.paidAt && patch.paidAt.trim() ? patch.paidAt.trim() : new Date().toISOString(),
    amount: roundPmsQty(patch.amount, 2),
    method: patch.method,
    voucherNo: (patch.voucherNo ?? '').trim(),
    note: (patch.note ?? '').trim(),
    operator: actor.name,
  })
  request.updatedAt = new Date().toISOString()
  refresh(request)
  appendPmsLog({
    objectType: 'payment-request',
    objectId: requestNo,
    action: '付款登记',
    beforeValue: `已付款 ${request.paidAmount - patch.amount}`,
    afterValue: `已付款 ${request.paidAmount} · ${patch.method}${patch.note ? ` · ${patch.note}` : ''}`,
    reason: patch.note ?? '',
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    secondConfirmation: true,
  })
  persistPmsPaymentRequest(request)
  return request
}

export function voidPmsPaymentRequest(requestNo: string, reason: string, actor: { id: string; name: string; role: PmsActorRole }): PmsPaymentRequest {
  const request = getPmsPaymentRequest(requestNo)
  if (!request) throw new PmsDomainError('PAYMENT_NOT_FOUND', `请款单 ${requestNo} 不存在`)
  if (!reason.trim()) throw new PmsDomainError('PAYMENT_REASON_REQUIRED', '作废必须填写原因')
  if (request.paidAmount > 0) throw new PmsDomainError('PAYMENT_VOID_BLOCKED', '已有付款记录，不能作废')
  const before = request.status
  request.voidReason = reason.trim()
  request.updatedAt = new Date().toISOString()
  refresh(request)
  const ids = request.sourceRows.map((row) => row.sourceId)
  // § 2.4.3.3 原子提交:同一 IDB 事务内 put request + unmark reconciliations + log。
  const modifiedReconciliations = request.type === 'material'
    ? pmsApplyPaymentRequestNoToMaterial(ids, '')
    : pmsApplyPaymentRequestNoToLogistics(ids, '')
  const log = appendPmsLogInMemory({ objectType: 'payment-request', objectId: requestNo, action: '作废', beforeValue: before, afterValue: '已作废', reason: reason.trim(), actorId: actor.id, actorName: actor.name, actorRole: actor.role, secondConfirmation: true })
  void pmsTx([PMS_STORES.pmsPaymentRequests, PMS_STORES.pmsReconciliations, PMS_STORES.pmsOperationLogs], 'readwrite', (tx) => {
    tx.objectStore(PMS_STORES.pmsPaymentRequests).put(request)
    for (const row of modifiedReconciliations) {
      tx.objectStore(PMS_STORES.pmsReconciliations).put(row)
    }
    tx.objectStore(PMS_STORES.pmsOperationLogs).put(log)
  }).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'unknown'
    console.error('[PMS_IDB_SAVE_FAILED] 作废请款单 IDB 写入失败', { requestNo, message })
  })
  return request
}

export function addPmsPaymentAttachment(requestNo: string, name: string, actor: { id: string; name: string; role: PmsActorRole }, description = ''): PmsPaymentRequest {
  const request = getPmsPaymentRequest(requestNo)
  if (!request) throw new PmsDomainError('PAYMENT_NOT_FOUND', `请款单 ${requestNo} 不存在`)
  const scope = checkPmsPaymentRequestEditScope(requestNo)
  if (scope.level === 'readonly') throw new PmsDomainError('PAYMENT_LOCKED', scope.reason)
  if (!name.trim()) throw new PmsDomainError('PAYMENT_ATTACHMENT_REQUIRED', '附件名称不能为空')
  request.attachments.unshift({ name: name.trim(), description: description.trim(), uploadedBy: actor.name, uploadedAt: new Date().toISOString() })
  request.updatedAt = new Date().toISOString()
  appendPmsLog({ objectType: 'payment-request', objectId: requestNo, action: '添加附件', beforeValue: '', afterValue: name.trim(), reason: description.trim(), actorId: actor.id, actorName: actor.name, actorRole: actor.role })
  persistPmsPaymentRequest(request)
  return request
}

export function removePmsPaymentAttachment(requestNo: string, index: number, actor: { id: string; name: string; role: PmsActorRole }): PmsPaymentRequest {
  const request = getPmsPaymentRequest(requestNo)
  if (!request) throw new PmsDomainError('PAYMENT_NOT_FOUND', `请款单 ${requestNo} 不存在`)
  const scope = checkPmsPaymentRequestEditScope(requestNo)
  if (scope.level === 'readonly') throw new PmsDomainError('PAYMENT_LOCKED', scope.reason)
  if (!Number.isInteger(index) || index < 0 || index >= request.attachments.length) throw new PmsDomainError('PAYMENT_ATTACHMENT_NOT_FOUND', '附件不存在或已删除')
  const [removed] = request.attachments.splice(index, 1)
  request.updatedAt = new Date().toISOString()
  appendPmsLog({ objectType: 'payment-request', objectId: requestNo, action: '删除附件', beforeValue: removed.name, afterValue: '', reason: '', actorId: actor.id, actorName: actor.name, actorRole: actor.role })
  persistPmsPaymentRequest(request)
  return request
}

export function updatePmsPaymentRemark(requestNo: string, remark: string, actor: { id: string; name: string; role: PmsActorRole }): PmsPaymentRequest {
  const request = getPmsPaymentRequest(requestNo)
  if (!request) throw new PmsDomainError('PAYMENT_NOT_FOUND', `请款单 ${requestNo} 不存在`)
  const scope = checkPmsPaymentRequestEditScope(requestNo)
  if (scope.level === 'readonly') throw new PmsDomainError('PAYMENT_LOCKED', scope.reason)
  request.remark = remark.trim()
  request.updatedAt = new Date().toISOString()
  appendPmsLog({ objectType: 'payment-request', objectId: requestNo, action: '更新备注', beforeValue: '', afterValue: request.remark, reason: '', actorId: actor.id, actorName: actor.name, actorRole: actor.role })
  persistPmsPaymentRequest(request)
  return request
}
