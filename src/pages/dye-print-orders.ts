import {
  initialAllocationByTaskId,
  initialAllocationEvents,
  initialDeductionBasisItems,
  initialQualityInspections,
  initialReturnInboundBatches,
  listDyePrintOrdersStore,
} from '../data/fcs/store-domain-quality-seeds'
import { applyQualitySeedBootstrap } from '../data/fcs/store-domain-quality-bootstrap'
import { processTasks } from '../data/fcs/process-tasks'
import {
  type DeductionBasisItem,
  type DeductionBasisStatus,
  type DyePrintOrder,
  type DyePrintOrderStatus,
  type DyePrintProcessType,
  type DyePrintReturnBatch,
  type DyePrintReturnResult,
  type QualityInspection,
  type ReturnInboundBatch,
  type ReturnInboundProcessType,
  type SettlementPartyType,
  deriveDyePrintSettlementRelation,
  resolveDefaultReturnInboundQcPolicy,
} from '../data/fcs/store-domain-quality-types'
import {
  applyReturnInboundPassWriteback,
  blockTaskForReturnInboundQc,
  createQcFromReturnInboundBatch,
  createReturnInboundBatchRecord,
  updateReturnInboundBatchStatus,
  upsertDeductionBasisFromReturnInboundQc,
} from '../data/fcs/return-inbound-workflow'
import { escapeHtml, toClassName } from '../utils'

applyQualitySeedBootstrap()

type FilterStatus = DyePrintOrderStatus | 'ALL'
type ReturnDisposition = 'ACCEPT_AS_DEFECT' | 'SCRAP' | 'ACCEPT'

type CreateErrors = Partial<Record<keyof CreateForm, string>>

interface CreateForm {
  productionOrderId: string
  relatedTaskId: string
  processorFactoryId: string
  processorFactoryName: string
  processType: DyePrintProcessType
  plannedQty: string
  remark: string
}

interface ReturnForm {
  qty: string
  result: DyePrintReturnResult
  disposition: ReturnDisposition | ''
  remark: string
}

interface DyePrintOrdersState {
  keyword: string
  filterStatus: FilterStatus
  filterProcessor: string

  createOpen: boolean
  createForm: CreateForm
  createErrors: CreateErrors

  returnTargetId: string | null
  returnForm: ReturnForm

  lastQcByDpId: Record<string, string>
}

const STATUS_LABEL: Record<DyePrintOrderStatus, string> = {
  DRAFT: '草稿',
  PROCESSING: '加工中',
  PARTIAL_RETURNED: '部分回货',
  COMPLETED: '已回齐',
  CLOSED: '已关闭',
}

const STATUS_CLASS: Record<DyePrintOrderStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-600 border-gray-200',
  PROCESSING: 'bg-blue-100 text-blue-700 border-blue-200',
  PARTIAL_RETURNED: 'bg-amber-100 text-amber-700 border-amber-200',
  COMPLETED: 'bg-green-100 text-green-700 border-green-200',
  CLOSED: 'bg-purple-100 text-purple-700 border-purple-200',
}

const DBI_STATUS_LABEL: Record<DeductionBasisStatus, string> = {
  DRAFT: '草稿',
  CONFIRMED: '已确认',
  DISPUTED: '争议中',
  VOID: '已作废',
}

const DBI_STATUS_CLASS: Record<DeductionBasisStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-700 border-gray-200',
  CONFIRMED: 'bg-green-100 text-green-700 border-green-200',
  DISPUTED: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  VOID: 'bg-slate-100 text-slate-500 border-slate-200',
}

const SETTLEMENT_PARTY_LABEL: Record<SettlementPartyType, string> = {
  FACTORY: '工厂',
  PROCESSOR: '加工厂',
  SUPPLIER: '供应商',
  GROUP_INTERNAL: '集团内部',
  OTHER: '其他',
}

const PROCESS_TYPE_LABEL: Record<DyePrintProcessType, string> = {
  PRINT: '印花',
  DYE: '染色',
  DYE_PRINT: '染印',
}

function mapDyePrintToReturnInboundProcessType(processType: DyePrintProcessType): ReturnInboundProcessType {
  if (processType === 'PRINT') return 'PRINT'
  if (processType === 'DYE') return 'DYE'
  return 'DYE_PRINT'
}

const DISPOSITION_LABEL: Record<ReturnDisposition, string> = {
  ACCEPT_AS_DEFECT: '接受B级品',
  SCRAP: '报废',
  ACCEPT: '接受无扣款',
}

const PROCESSOR_OPTIONS = [
  { id: 'ID-F005', name: 'Bandung Print House' },
  { id: 'ID-F006', name: 'Surabaya Embroidery' },
  { id: 'ID-F008', name: 'Solo Button Factory' },
]

const state: DyePrintOrdersState = {
  keyword: '',
  filterStatus: 'ALL',
  filterProcessor: 'ALL',
  createOpen: false,
  createForm: emptyCreateForm(),
  createErrors: {},
  returnTargetId: null,
  returnForm: emptyReturnForm(),
  lastQcByDpId: {},
}

function emptyCreateForm(): CreateForm {
  return {
    productionOrderId: '',
    relatedTaskId: '',
    processorFactoryId: 'ID-F005',
    processorFactoryName: 'Bandung Print House',
    processType: 'PRINT',
    plannedQty: '',
    remark: '',
  }
}

function emptyReturnForm(): ReturnForm {
  return {
    qty: '',
    result: 'PASS',
    disposition: '',
    remark: '',
  }
}

function nowTimestamp(date: Date = new Date()): string {
  return date.toISOString().replace('T', ' ').slice(0, 19)
}

function showDyePrintToast(message: string, tone: 'success' | 'error' = 'success'): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return

  const rootId = 'dye-print-toast-root'
  let root = document.getElementById(rootId)

  if (!root) {
    root = document.createElement('div')
    root.id = rootId
    root.className = 'pointer-events-none fixed right-6 top-20 z-[120] flex max-w-sm flex-col gap-2'
    document.body.appendChild(root)
  }

  const toast = document.createElement('div')
  toast.className =
    tone === 'error'
      ? 'pointer-events-auto rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-md transition-all duration-200'
      : 'pointer-events-auto rounded-md border bg-background px-4 py-3 text-sm text-foreground shadow-md transition-all duration-200'

  toast.textContent = message
  toast.style.opacity = '0'
  toast.style.transform = 'translateY(-6px)'

  root.appendChild(toast)

  window.requestAnimationFrame(() => {
    toast.style.opacity = '1'
    toast.style.transform = 'translateY(0)'
  })

  window.setTimeout(() => {
    toast.style.opacity = '0'
    toast.style.transform = 'translateY(-6px)'
    window.setTimeout(() => {
      toast.remove()
      if (root && root.childElementCount === 0) {
        root.remove()
      }
    }, 180)
  }, 2200)
}

function getOrders(): DyePrintOrder[] {
  return listDyePrintOrdersStore()
}


function getReturnTarget(): DyePrintOrder | null {
  if (!state.returnTargetId) return null
  return getOrders().find((item) => item.dpId === state.returnTargetId) ?? null
}

function replaceOrder(nextOrder: DyePrintOrder): void {
  const orders = getOrders()
  const idx = orders.findIndex((item) => item.dpId === nextOrder.dpId)
  if (idx >= 0) {
    orders[idx] = nextOrder
  }
}

function getProcessorOptions(orders: DyePrintOrder[]): Array<{ id: string; name: string }> {
  const map = new Map(PROCESSOR_OPTIONS.map((item) => [item.id, item.name]))
  for (const order of orders) {
    if (!map.has(order.processorFactoryId)) {
      map.set(order.processorFactoryId, order.processorFactoryName)
    }
  }
  return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
}


function validateCreateForm(): boolean {
  const errors: CreateErrors = {}

  if (!state.createForm.productionOrderId.trim()) {
    errors.productionOrderId = '请填写生产工单号'
  }

  if (!state.createForm.relatedTaskId.trim()) {
    errors.relatedTaskId = '请选择关联当前流程任务'
  }

  if (!state.createForm.processorFactoryId.trim()) {
    errors.processorFactoryId = '请选择承接主体'
  }

  const plannedQty = Number(state.createForm.plannedQty)
  if (!state.createForm.plannedQty || !Number.isInteger(plannedQty) || plannedQty <= 0) {
    errors.plannedQty = '请输入正整数'
  }

  state.createErrors = errors
  return Object.keys(errors).length === 0
}

function createDyePrintOrder(): { ok: boolean; dpId?: string; message?: string } {
  if (!validateCreateForm()) {
    return { ok: false }
  }

  const now = nowTimestamp()
  const seq = String(Date.now()).slice(-4)
  const ym = now.slice(0, 7).replace('-', '')
  const dpId = `DPO-${ym}-${seq}`

  const order: DyePrintOrder = {
    dpId,
    orderId: dpId,
    productionOrderId: state.createForm.productionOrderId.trim(),
    relatedTaskId: state.createForm.relatedTaskId.trim(),
    processorFactoryId: state.createForm.processorFactoryId,
    processorFactoryName: state.createForm.processorFactoryName,
    settlementPartyType: 'PROCESSOR',
    settlementPartyId: state.createForm.processorFactoryId,
    settlementRelation: deriveDyePrintSettlementRelation(
      state.createForm.processorFactoryId,
      'PROCESSOR',
      state.createForm.processorFactoryId,
    ),
    processType: state.createForm.processType,
    plannedQty: Number(state.createForm.plannedQty),
    returnedPassQty: 0,
    returnedFailQty: 0,
    availableQty: 0,
    status: 'DRAFT',
    remark: state.createForm.remark.trim() || undefined,
    returnBatches: [],
    createdAt: now,
    createdBy: '管理员',
    updatedAt: now,
    updatedBy: '管理员',
  }

  getOrders().push(order)
  return { ok: true, dpId }
}

function startDyePrintOrder(dpId: string): { ok: boolean; message?: string } {
  const order = getOrders().find((item) => item.dpId === dpId)
  if (!order) return { ok: false, message: `加工单 ${dpId} 不存在` }
  if (order.status !== 'DRAFT') return { ok: false, message: '只有草稿状态的加工单可以开始加工' }

  replaceOrder({
    ...order,
    status: 'PROCESSING',
    updatedAt: nowTimestamp(),
    updatedBy: '管理员',
  })

  return { ok: true }
}

function closeDyePrintOrder(dpId: string): { ok: boolean; message?: string } {
  const order = getOrders().find((item) => item.dpId === dpId)
  if (!order) return { ok: false, message: `加工单 ${dpId} 不存在` }
  if (order.status === 'CLOSED') return { ok: false, message: '加工单已关闭' }

  replaceOrder({
    ...order,
    status: 'CLOSED',
    updatedAt: nowTimestamp(),
    updatedBy: '管理员',
  })

  return { ok: true }
}

function addDyePrintReturn(
  dpId: string,
  payload: {
    qty: number
    result: DyePrintReturnResult
    disposition?: ReturnDisposition
    remark?: string
  },
): { ok: boolean; returnId?: string; qcId?: string; message?: string } {
  const order = getOrders().find((item) => item.dpId === dpId)
  if (!order) return { ok: false, message: `加工单 ${dpId} 不存在` }
  if (order.status === 'CLOSED') return { ok: false, message: '加工单已关闭，不能登记回货' }
  if (!Number.isInteger(payload.qty) || payload.qty <= 0) {
    return { ok: false, message: '回货数量必须为正整数' }
  }
  if (!order.relatedTaskId) {
    return { ok: false, message: '未关联当前流程任务，无法同步可用量' }
  }
  if (payload.result === 'FAIL' && !payload.disposition) {
    return { ok: false, message: '不合格回货必须选择处置方式' }
  }

  const now = nowTimestamp()
  const returnId = `RB-${dpId}-${Date.now()}`
  const linkedReturnInboundBatchId = `RIB-${returnId}`
  const returnProcessType = mapDyePrintToReturnInboundProcessType(order.processType)
  const returnQcPolicy = resolveDefaultReturnInboundQcPolicy(returnProcessType)
  const returnWarehouseId = 'WH-JKT-01'
  const returnWarehouseName = '雅加达中心仓'

  const inboundBatch = createReturnInboundBatchRecord({
    batches: initialReturnInboundBatches,
    batchId: linkedReturnInboundBatchId,
    productionOrderId: order.productionOrderId,
    sourceTaskId: order.relatedTaskId,
    processType: returnProcessType,
    processLabel: PROCESS_TYPE_LABEL[order.processType],
    returnedQty: payload.qty,
    returnFactoryId: order.processorFactoryId,
    returnFactoryName: order.processorFactoryName,
    warehouseId: returnWarehouseId,
    warehouseName: returnWarehouseName,
    inboundAt: now,
    inboundBy: '管理员',
    qcPolicy: returnQcPolicy,
    qcStatus: payload.result === 'PASS' ? 'PASS_CLOSED' : 'QC_PENDING',
    sourceType: 'DYE_PRINT_ORDER',
    sourceId: order.dpId,
    now,
  })

  let qcId: string | undefined

  if (payload.result === 'FAIL') {
    const qcRecord = createQcFromReturnInboundBatch({
      inspections: initialQualityInspections,
      batch: inboundBatch,
      productionOrderId: order.productionOrderId,
      by: '管理员',
      inspectedAt: now,
      result: 'FAIL',
      disposition: payload.disposition,
      affectedQty: payload.qty,
      remark: payload.remark,
      rootCauseType: 'DYE_PRINT',
      refTypeMode: 'LEGACY_TASK_COMPAT',
      refTaskId: order.relatedTaskId,
      sourceBusinessType: 'DYE_PRINT_ORDER',
      sourceBusinessId: order.dpId,
    })
    qcId = qcRecord.qcId

    upsertDeductionBasisFromReturnInboundQc({
      basisItems: initialDeductionBasisItems,
      qc: qcRecord,
      batch: inboundBatch,
      by: '管理员',
      now,
      taskId: order.relatedTaskId,
      factoryId: order.processorFactoryId,
      settlementPartyType: order.settlementPartyType,
      settlementPartyId: order.settlementPartyId,
      summary: `染印加工单 ${order.dpId} 不合格回货，数量 ${payload.qty}`,
    })

    updateReturnInboundBatchStatus({
      batches: initialReturnInboundBatches,
      batchId: linkedReturnInboundBatchId,
      qcStatus: 'FAIL_IN_QC',
      linkedQcId: qcId,
      by: '管理员',
      now,
    })

    const parentTask = processTasks.find((task) => task.taskId === order.relatedTaskId)
    if (parentTask) {
      blockTaskForReturnInboundQc({
        task: parentTask,
        qcId,
        by: '管理员',
        now,
        remark: `染印加工单 ${order.dpId} 回货不合格，待处理`,
      })
    }
  }

  const batch: DyePrintReturnBatch = {
    returnId,
    returnedAt: now,
    qty: payload.qty,
    result: payload.result,
    disposition: payload.disposition,
    remark: payload.remark,
    qcId,
    linkedReturnInboundBatchId,
  }

  const nextBatches = [...order.returnBatches, batch]
  const passQty = nextBatches
    .filter((item) => item.result === 'PASS')
    .reduce((sum, item) => sum + item.qty, 0)
  const failQty = nextBatches
    .filter((item) => item.result === 'FAIL')
    .reduce((sum, item) => sum + item.qty, 0)
  const totalQty = passQty + failQty

  const nextStatus: DyePrintOrderStatus =
    totalQty >= order.plannedQty ? 'COMPLETED' : totalQty > 0 ? 'PARTIAL_RETURNED' : order.status

  replaceOrder({
    ...order,
    returnBatches: nextBatches,
    returnedPassQty: passQty,
    returnedFailQty: failQty,
    availableQty: passQty,
    status: nextStatus,
    updatedAt: now,
    updatedBy: '管理员',
  })

  if (payload.result === 'PASS') {
    const passResult = applyReturnInboundPassWriteback({
      batch: inboundBatch,
      allocationByTaskId: initialAllocationByTaskId,
      allocationEvents: initialAllocationEvents,
      by: '管理员',
      now,
    })
    if (!passResult.ok) return { ok: false, message: passResult.message }

    updateReturnInboundBatchStatus({
      batches: initialReturnInboundBatches,
      batchId: linkedReturnInboundBatchId,
      qcStatus: 'PASS_CLOSED',
      by: '管理员',
      now,
    })
  }

  return { ok: true, returnId, qcId }
}


function updateField(field: string, node: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): void {
  const value = node.value

  if (field === 'create.productionOrderId') {
    state.createForm.productionOrderId = value
    if (state.createErrors.productionOrderId) delete state.createErrors.productionOrderId
    return
  }

  if (field === 'create.relatedTaskId') {
    state.createForm.relatedTaskId = value
    if (state.createErrors.relatedTaskId) delete state.createErrors.relatedTaskId
    return
  }

  if (field === 'create.processorFactoryId') {
    state.createForm.processorFactoryId = value
    const processorOptions = getProcessorOptions(getOrders())
    const matched = processorOptions.find((item) => item.id === value)
    state.createForm.processorFactoryName = matched?.name ?? value
    if (state.createErrors.processorFactoryId) delete state.createErrors.processorFactoryId
    return
  }

  if (field === 'create.processType') {
    state.createForm.processType = value as DyePrintProcessType
    return
  }

  if (field === 'create.plannedQty') {
    state.createForm.plannedQty = value
    if (state.createErrors.plannedQty) delete state.createErrors.plannedQty
    return
  }

  if (field === 'create.remark') {
    state.createForm.remark = value
    return
  }

  if (field === 'return.qty') {
    state.returnForm.qty = value
    return
  }

  if (field === 'return.disposition') {
    state.returnForm.disposition = value as ReturnDisposition | ''
    return
  }

  if (field === 'return.remark') {
    state.returnForm.remark = value
  }
}

export function handleDyePrintOrdersEvent(target: HTMLElement): boolean {
  const filterNode = target.closest<HTMLElement>('[data-dye-filter]')
  if (filterNode instanceof HTMLInputElement || filterNode instanceof HTMLSelectElement) {
    const field = filterNode.dataset.dyeFilter
    if (!field) return true

    if (field === 'keyword') {
      state.keyword = filterNode.value
      return true
    }

    if (field === 'status') {
      state.filterStatus = filterNode.value as FilterStatus
      return true
    }

    if (field === 'processor') {
      state.filterProcessor = filterNode.value
      return true
    }

    return true
  }

  const fieldNode = target.closest<HTMLElement>('[data-dye-field]')
  if (
    fieldNode instanceof HTMLInputElement ||
    fieldNode instanceof HTMLSelectElement ||
    fieldNode instanceof HTMLTextAreaElement
  ) {
    const field = fieldNode.dataset.dyeField
    if (!field) return true
    updateField(field, fieldNode)
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-dye-action]')
  if (!actionNode) return false

  const action = actionNode.dataset.dyeAction
  if (!action) return false

  if (action === 'open-create') {
    state.createOpen = true
    state.createForm = emptyCreateForm()
    state.createErrors = {}
    return true
  }

  if (action === 'close-create') {
    state.createOpen = false
    state.createErrors = {}
    return true
  }

  if (action === 'close-return') {
    state.returnTargetId = null
    state.returnForm = emptyReturnForm()
    return true
  }

  if (action === 'close-dialog') {
    state.createOpen = false
    state.createErrors = {}
    state.returnTargetId = null
    state.returnForm = emptyReturnForm()
    return true
  }

  if (action === 'reset-filters') {
    state.keyword = ''
    state.filterStatus = 'ALL'
    state.filterProcessor = 'ALL'
    return true
  }

  if (action === 'submit-create') {
    const result = createDyePrintOrder()
    if (result.ok) {
      showDyePrintToast(`染印加工单已创建：${result.dpId}`)
      state.createOpen = false
      state.createForm = emptyCreateForm()
      state.createErrors = {}
    } else if (result.message) {
      showDyePrintToast(result.message, 'error')
    }
    return true
  }

  if (action === 'start-order') {
    const dpId = actionNode.dataset.dpId
    if (!dpId) return true
    const result = startDyePrintOrder(dpId)
    if (result.ok) {
      showDyePrintToast('已开始加工')
    } else {
      showDyePrintToast(result.message ?? '操作失败', 'error')
    }
    return true
  }

  if (action === 'close-order') {
    const dpId = actionNode.dataset.dpId
    if (!dpId) return true
    const result = closeDyePrintOrder(dpId)
    if (result.ok) {
      showDyePrintToast('加工单已关闭')
    } else {
      showDyePrintToast(result.message ?? '操作失败', 'error')
    }
    return true
  }

  if (action === 'open-return') {
    const dpId = actionNode.dataset.dpId
    if (!dpId) return true

    const order = getOrders().find((item) => item.dpId === dpId)
    if (!order) {
      showDyePrintToast('加工单不存在', 'error')
      return true
    }

    state.returnTargetId = order.dpId
    state.returnForm = emptyReturnForm()
    return true
  }

  if (action === 'set-return-result') {
    const result = actionNode.dataset.result as DyePrintReturnResult | undefined
    if (!result) return true
    state.returnForm.result = result
    state.returnForm.disposition = ''
    return true
  }

  if (action === 'submit-return') {
    const targetOrder = getReturnTarget()
    if (!targetOrder) return true

    const qty = Number(state.returnForm.qty)
    if (!state.returnForm.qty || !Number.isInteger(qty) || qty <= 0) {
      showDyePrintToast('回货数量必须为正整数', 'error')
      return true
    }

    if (state.returnForm.result === 'FAIL' && !state.returnForm.disposition) {
      showDyePrintToast('不合格时必须选择处置方式', 'error')
      return true
    }

    const result = addDyePrintReturn(targetOrder.dpId, {
      qty,
      result: state.returnForm.result,
      disposition:
        state.returnForm.result === 'FAIL'
          ? (state.returnForm.disposition as ReturnDisposition)
          : undefined,
      remark: state.returnForm.remark.trim() || undefined,
    })

    if (result.ok) {
      if (state.returnForm.result === 'PASS') {
        showDyePrintToast('合格回货已登记，当前流程可用量已更新')
      } else {
        showDyePrintToast('已生成质检单，结案后将同步更新当前流程可用量')
        if (result.qcId) {
          state.lastQcByDpId[targetOrder.dpId] = result.qcId
        }
      }

      state.returnTargetId = null
      state.returnForm = emptyReturnForm()
    } else {
      showDyePrintToast(result.message ?? '操作失败', 'error')
    }

    return true
  }

  return false
}

export function isDyePrintOrdersDialogOpen(): boolean {
  return state.createOpen || state.returnTargetId !== null
}
