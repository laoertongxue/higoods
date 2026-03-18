import {
  initialAllocationByTaskId,
  initialAllocationEvents,
  initialDeductionBasisItems,
  initialDyePrintOrders,
  initialQualityInspections,
  initialReturnInboundBatches,
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
  return initialDyePrintOrders
}

function getQcRecords(): QualityInspection[] {
  return initialQualityInspections
}

function getDeductionBasisItems(): DeductionBasisItem[] {
  return initialDeductionBasisItems
}

function getReturnTarget(): DyePrintOrder | null {
  if (!state.returnTargetId) return null
  return getOrders().find((item) => item.dpId === state.returnTargetId) ?? null
}

function replaceOrder(nextOrder: DyePrintOrder): void {
  const idx = initialDyePrintOrders.findIndex((item) => item.dpId === nextOrder.dpId)
  if (idx >= 0) {
    initialDyePrintOrders[idx] = nextOrder
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

function getBasisByDpId(
  orders: DyePrintOrder[],
  basisItems: DeductionBasisItem[],
): Map<string, DeductionBasisItem> {
  const map = new Map<string, DeductionBasisItem>()

  for (const order of orders) {
    let candidates = basisItems.filter((item) => item.sourceOrderId === order.dpId)

    if (candidates.length === 0) {
      candidates = basisItems.filter(
        (item) =>
          item.sourceProcessType === 'DYE_PRINT' &&
          item.processorFactoryId === order.processorFactoryId &&
          item.productionOrderId === order.productionOrderId,
      )
    }

    if (candidates.length > 0) {
      const sorted = [...candidates].sort((a, b) =>
        (b.updatedAt ?? b.createdAt).localeCompare(a.updatedAt ?? a.createdAt),
      )
      map.set(order.dpId, sorted[0])
    }
  }

  return map
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

  initialDyePrintOrders.push(order)
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

function renderStatCard(label: string, value: number, valueClass = ''): string {
  return `
    <article class="rounded-lg border bg-card">
      <div class="px-4 py-4">
        <p class="text-xs text-muted-foreground">${escapeHtml(label)}</p>
        <p class="mt-1 text-2xl font-bold ${valueClass}">${value.toLocaleString()}</p>
      </div>
    </article>
  `
}

function renderCreateDialog(processorOptions: Array<{ id: string; name: string }>): string {
  if (!state.createOpen) return ''

  return `
    <div class="fixed inset-0 z-50" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-dye-action="close-create" aria-label="关闭"></button>
      <div class="absolute left-1/2 top-1/2 max-h-[86vh] w-full max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border bg-background p-6 shadow-2xl" data-dialog-panel="true">
        <button class="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100" data-dye-action="close-create" aria-label="关闭">
          <i data-lucide="x" class="h-4 w-4"></i>
        </button>

        <h3 class="text-lg font-semibold">新建染印加工单</h3>

        <div class="mt-4 space-y-4">
          <div class="space-y-1.5">
            <label class="text-sm font-medium">生产工单号 <span class="text-red-600">*</span></label>
            <input
              class="h-9 w-full rounded-md border bg-background px-3 text-sm"
              placeholder="PO-xxxx"
              data-dye-field="create.productionOrderId"
              value="${escapeHtml(state.createForm.productionOrderId)}"
            />
            ${
              state.createErrors.productionOrderId
                ? `<p class="text-xs text-red-600">${escapeHtml(state.createErrors.productionOrderId)}</p>`
                : ''
            }
          </div>

          <div class="space-y-1.5">
            <label class="text-sm font-medium">关联工序任务 <span class="text-red-600">*</span></label>
            <input
              class="h-9 w-full rounded-md border bg-background px-3 text-sm"
              placeholder="TASK-xxxx-xxx"
              data-dye-field="create.relatedTaskId"
              value="${escapeHtml(state.createForm.relatedTaskId)}"
            />
            ${
              state.createErrors.relatedTaskId
                ? `<p class="text-xs text-red-600">${escapeHtml(state.createErrors.relatedTaskId)}</p>`
                : '<p class="text-xs text-muted-foreground">用于 PASS 回货直接写入当前流程可用量，FAIL 时生成质检单</p>'
            }
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-1.5">
              <label class="text-sm font-medium">承接主体 <span class="text-red-600">*</span></label>
              <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-dye-field="create.processorFactoryId">
                ${processorOptions
                  .map(
                    (item) =>
                      `<option value="${escapeHtml(item.id)}" ${
                        item.id === state.createForm.processorFactoryId ? 'selected' : ''
                      }>${escapeHtml(item.name)}</option>`,
                  )
                  .join('')}
              </select>
              ${
                state.createErrors.processorFactoryId
                  ? `<p class="text-xs text-red-600">${escapeHtml(state.createErrors.processorFactoryId)}</p>`
                  : ''
              }
            </div>

            <div class="space-y-1.5">
              <label class="text-sm font-medium">工艺类型</label>
              <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-dye-field="create.processType">
                <option value="PRINT" ${state.createForm.processType === 'PRINT' ? 'selected' : ''}>印花</option>
                <option value="DYE" ${state.createForm.processType === 'DYE' ? 'selected' : ''}>染色</option>
                <option value="DYE_PRINT" ${state.createForm.processType === 'DYE_PRINT' ? 'selected' : ''}>染印</option>
              </select>
            </div>
          </div>

          <div class="space-y-1.5">
            <label class="text-sm font-medium">计划数量 <span class="text-red-600">*</span></label>
            <input
              class="h-9 w-full rounded-md border bg-background px-3 text-sm"
              type="number"
              min="1"
              placeholder="请输入正整数"
              data-dye-field="create.plannedQty"
              value="${escapeHtml(state.createForm.plannedQty)}"
            />
            ${
              state.createErrors.plannedQty
                ? `<p class="text-xs text-red-600">${escapeHtml(state.createErrors.plannedQty)}</p>`
                : ''
            }
          </div>

          <div class="space-y-1.5">
            <label class="text-sm font-medium">备注</label>
            <textarea
              rows="2"
              class="w-full rounded-md border bg-background px-3 py-2 text-sm"
              placeholder="可选"
              data-dye-field="create.remark"
            >${escapeHtml(state.createForm.remark)}</textarea>
          </div>
        </div>

        <div class="mt-6 flex justify-end gap-2">
          <button class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-dye-action="close-create">取消</button>
          <button class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700" data-dye-action="submit-create">创建</button>
        </div>
      </div>
    </div>
  `
}

function renderReturnDialog(order: DyePrintOrder | null): string {
  if (!order) return ''

  return `
    <div class="fixed inset-0 z-50" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-dye-action="close-return" aria-label="关闭"></button>
      <div class="absolute left-1/2 top-1/2 max-h-[86vh] w-full max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border bg-background p-6 shadow-2xl" data-dialog-panel="true">
        <button class="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100" data-dye-action="close-return" aria-label="关闭">
          <i data-lucide="x" class="h-4 w-4"></i>
        </button>

        <h3 class="text-lg font-semibold">登记回货 - ${escapeHtml(order.dpId)}</h3>

        <div class="mt-4 space-y-4">
          <div class="space-y-1 rounded-md bg-muted/50 p-3 text-sm">
            <div>计划量：<span class="font-medium">${order.plannedQty}</span></div>
            <div>已回货（合格）：<span class="font-medium text-green-700">${order.returnedPassQty}</span></div>
            <div>已回货（不合格）：<span class="font-medium text-red-600">${order.returnedFailQty}</span></div>
          </div>

          <div class="space-y-1.5">
            <label class="text-sm font-medium">回货数量 <span class="text-red-600">*</span></label>
            <input
              class="h-9 w-full rounded-md border bg-background px-3 text-sm"
              type="number"
              min="1"
              placeholder="请输入正整数"
              data-dye-field="return.qty"
              value="${escapeHtml(state.returnForm.qty)}"
            />
          </div>

          <div class="space-y-1.5">
            <label class="text-sm font-medium">质检结果 <span class="text-red-600">*</span></label>
            <div class="flex gap-3">
              <button
                class="${toClassName(
                  'flex-1 rounded-md border py-2 text-sm font-medium transition-colors',
                  state.returnForm.result === 'PASS'
                    ? 'border-green-600 bg-green-600 text-white'
                    : 'bg-background text-muted-foreground hover:border-foreground',
                )}"
                data-dye-action="set-return-result"
                data-result="PASS"
              >
                合格
              </button>
              <button
                class="${toClassName(
                  'flex-1 rounded-md border py-2 text-sm font-medium transition-colors',
                  state.returnForm.result === 'FAIL'
                    ? 'border-red-600 bg-red-600 text-white'
                    : 'bg-background text-muted-foreground hover:border-foreground',
                )}"
                data-dye-action="set-return-result"
                data-result="FAIL"
              >
                不合格
              </button>
            </div>

            ${
              state.returnForm.result === 'PASS'
                ? '<p class="rounded bg-green-50 px-2 py-1 text-xs text-green-700">合格回货会直接写入当前流程可用量，并触发下一步条件重算</p>'
                : '<p class="rounded bg-amber-50 px-2 py-1 text-xs text-amber-700">不合格回货会生成质检单；需完成判责、处置拆分并结案后，才会写入当前流程可用量</p>'
            }
          </div>

          ${
            state.returnForm.result === 'FAIL'
              ? `
                <div class="space-y-1.5">
                  <label class="text-sm font-medium">处置方式 <span class="text-red-600">*</span></label>
                  <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-dye-field="return.disposition">
                    <option value="" ${state.returnForm.disposition === '' ? 'selected' : ''}>请选择处置</option>
                    ${Object.entries(DISPOSITION_LABEL)
                      .map(
                        ([value, label]) =>
                          `<option value="${escapeHtml(value)}" ${
                            state.returnForm.disposition === value ? 'selected' : ''
                          }>${escapeHtml(label)}</option>`,
                      )
                      .join('')}
                  </select>
                </div>
              `
              : ''
          }

          <div class="space-y-1.5">
            <label class="text-sm font-medium">备注</label>
            <textarea
              rows="2"
              class="w-full rounded-md border bg-background px-3 py-2 text-sm"
              placeholder="可选"
              data-dye-field="return.remark"
            >${escapeHtml(state.returnForm.remark)}</textarea>
          </div>
        </div>

        <div class="mt-6 flex justify-end gap-2">
          <button class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-dye-action="close-return">取消</button>
          <button class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700" data-dye-action="submit-return">确认登记</button>
        </div>
      </div>
    </div>
  `
}

export function renderDyePrintOrdersPage(): string {
  const orders = getOrders()
  const qcRecords = getQcRecords()
  const basisItems = getDeductionBasisItems()
  const processorOptions = getProcessorOptions(orders)
  const basisByDpId = getBasisByDpId(orders, basisItems)

  const stats = {
    total: orders.length,
    basisCreated: orders.filter((item) => basisByDpId.has(item.dpId)).length,
    ready: orders.filter((item) => basisByDpId.get(item.dpId)?.settlementReady === true).length,
    frozen: orders.filter((item) => basisByDpId.has(item.dpId)).length -
      orders.filter((item) => basisByDpId.get(item.dpId)?.settlementReady === true).length,
  }

  const keyword = state.keyword.trim().toLowerCase()

  const filtered = orders
    .filter((item) => {
      if (state.filterStatus !== 'ALL' && item.status !== state.filterStatus) return false
      if (state.filterProcessor !== 'ALL' && item.processorFactoryId !== state.filterProcessor) return false

      if (keyword) {
        const haystack = `${item.dpId} ${item.productionOrderId} ${item.relatedTaskId} ${item.processorFactoryName}`.toLowerCase()
        if (!haystack.includes(keyword)) return false
      }

      return true
    })
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  const returnTarget = getReturnTarget()

  return `
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-xl font-semibold">染印加工单</h1>
          <p class="mt-0.5 text-sm text-muted-foreground">管理印花、染色、染印等相关流程工单</p>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-sm text-muted-foreground">${filtered.length} 条</span>
          <button class="inline-flex h-9 items-center rounded-md bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700" data-dye-action="open-create">
            <i data-lucide="plus" class="mr-1 h-4 w-4"></i>
            新建
          </button>
        </div>
      </div>

      <section class="grid grid-cols-2 gap-3 sm:grid-cols-4">
        ${renderStatCard('染印工单总数', stats.total)}
        ${renderStatCard('已生成扣款依据数', stats.basisCreated)}
        ${renderStatCard('可进入结算数', stats.ready, 'text-green-700')}
        ${renderStatCard('冻结中数', stats.frozen, 'text-orange-600')}
      </section>

      <section class="rounded-lg border bg-card">
        <div class="p-4">
          <div class="flex flex-wrap items-end gap-3">
            <div class="min-w-[200px] flex-1">
              <input
                class="h-9 w-full rounded-md border bg-background px-3 text-sm"
                data-dye-filter="keyword"
                value="${escapeHtml(state.keyword)}"
                placeholder="搜索单号 / 生产单 / 任务 / 承接主体"
              />
            </div>

            <div class="w-36">
              <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-dye-filter="status">
                <option value="ALL" ${state.filterStatus === 'ALL' ? 'selected' : ''}>全部状态</option>
                ${Object.entries(STATUS_LABEL)
                  .map(
                    ([status, label]) =>
                      `<option value="${escapeHtml(status)}" ${
                        state.filterStatus === status ? 'selected' : ''
                      }>${escapeHtml(label)}</option>`,
                  )
                  .join('')}
              </select>
            </div>

            <div class="w-48">
              <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-dye-filter="processor">
                <option value="ALL" ${state.filterProcessor === 'ALL' ? 'selected' : ''}>全部承接主体</option>
                ${processorOptions
                  .map(
                    (item) =>
                      `<option value="${escapeHtml(item.id)}" ${
                        state.filterProcessor === item.id ? 'selected' : ''
                      }>${escapeHtml(item.name)}</option>`,
                  )
                  .join('')}
              </select>
            </div>

            <button class="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted" data-dye-action="reset-filters">
              <i data-lucide="rotate-ccw" class="mr-1 h-4 w-4"></i>
              重置
            </button>
          </div>
        </div>
      </section>

      ${
        filtered.length === 0
          ? `
            <section class="rounded-lg border bg-card">
              <div class="py-16 text-center text-sm text-muted-foreground">暂无染印加工单</div>
            </section>
          `
          : `
            <section class="rounded-lg border bg-card">
              <div class="overflow-x-auto">
                <table class="w-full min-w-[1960px] text-sm">
                  <thead>
                    <tr class="border-b bg-muted/40 text-left">
                      <th class="px-3 py-2 font-medium">单号</th>
                      <th class="px-3 py-2 font-medium">生产单</th>
                      <th class="px-3 py-2 font-medium">关联任务</th>
                      <th class="px-3 py-2 font-medium">承接主体</th>
                      <th class="px-3 py-2 font-medium">工艺类型</th>
                      <th class="px-3 py-2 text-right font-medium">计划量</th>
                      <th class="px-3 py-2 text-right font-medium">合格回货</th>
                      <th class="px-3 py-2 text-right font-medium">不合格</th>
                      <th class="px-3 py-2 text-right font-medium">可用量</th>
                      <th class="px-3 py-2 font-medium">是否可继续</th>
                      <th class="px-3 py-2 text-right font-medium">当前流程可用量</th>
                      <th class="px-3 py-2 font-medium">当前生产流程是否可继续</th>
                      <th class="px-3 py-2 font-medium">最近处理结果</th>
                      <th class="px-3 py-2 font-medium">状态</th>
                      <th class="px-3 py-2 font-medium">更新时间</th>
                      <th class="px-3 py-2 font-medium">扣款依据状态</th>
                      <th class="px-3 py-2 font-medium">结算对象</th>
                      <th class="px-3 py-2 font-medium">结算状态</th>
                      <th class="px-3 py-2 font-medium">冻结原因</th>
                      <th class="px-3 py-2 font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${filtered
                      .map((order) => {
                        const mainAvailable = initialAllocationByTaskId[order.relatedTaskId]?.availableQty ?? 0

                        const latestBatch =
                          order.returnBatches.length > 0
                            ? order.returnBatches[order.returnBatches.length - 1]
                            : null

                        let recentResult = '—'
                        if (latestBatch) {
                          if (latestBatch.result === 'PASS') {
                            recentResult = '合格可继续'
                          } else if (!latestBatch.qcId) {
                            recentResult = '不合格待建单'
                          } else {
                            const linked = qcRecords.find((item) => item.qcId === latestBatch.qcId)
                            recentResult = linked?.status === 'CLOSED' ? '不合格已结案' : '不合格处理中'
                          }
                        }

                        const failBatch = [...order.returnBatches]
                          .reverse()
                          .find((item) => item.result === 'FAIL' && item.qcId)
                        const activeQcId = failBatch?.qcId ?? state.lastQcByDpId[order.dpId]

                        const basis = basisByDpId.get(order.dpId)
                        const settlementParty = basis
                          ? `${SETTLEMENT_PARTY_LABEL[basis.settlementPartyType ?? 'OTHER']} / ${basis.settlementPartyId ?? '—'}`
                          : '—'

                        return `
                          <tr class="border-b last:border-0">
                            <td class="px-3 py-2 font-mono text-sm font-medium text-primary">${escapeHtml(order.dpId)}</td>
                            <td class="px-3 py-2 font-mono text-sm">${escapeHtml(order.productionOrderId)}</td>
                            <td class="px-3 py-2 text-sm text-muted-foreground">${escapeHtml(order.relatedTaskId || '—')}</td>
                            <td class="px-3 py-2 text-sm">${escapeHtml(order.processorFactoryName)}</td>
                            <td class="px-3 py-2">
                              <span class="inline-flex rounded-md border px-2 py-0.5 text-xs">${escapeHtml(
                                PROCESS_TYPE_LABEL[order.processType],
                              )}</span>
                            </td>
                            <td class="px-3 py-2 text-right font-mono text-sm">${order.plannedQty}</td>
                            <td class="px-3 py-2 text-right font-mono text-sm text-green-700">${order.returnedPassQty}</td>
                            <td class="px-3 py-2 text-right font-mono text-sm text-red-600">${
                              order.returnedFailQty > 0 ? order.returnedFailQty : '—'
                            }</td>
                            <td class="px-3 py-2 text-right font-mono text-sm font-semibold">${order.availableQty}</td>
                            <td class="px-3 py-2">
                              ${
                                order.availableQty > 0
                                  ? '<span class="inline-flex rounded-md border border-green-200 bg-green-100 px-2 py-0.5 text-xs text-green-700">可继续</span>'
                                  : '<span class="inline-flex rounded-md border px-2 py-0.5 text-xs text-muted-foreground">生产暂停</span>'
                              }
                            </td>
                            <td class="px-3 py-2 text-right font-mono text-sm font-semibold">${mainAvailable}</td>
                            <td class="px-3 py-2">
                              ${
                                mainAvailable > 0
                                  ? '<span class="inline-flex rounded-md border border-green-200 bg-green-100 px-2 py-0.5 text-xs text-green-700">可继续</span>'
                                  : '<span class="inline-flex rounded-md border px-2 py-0.5 text-xs text-muted-foreground">生产暂停</span>'
                              }
                            </td>
                            <td class="whitespace-nowrap px-3 py-2 text-xs">
                              <span class="${
                                recentResult === '合格可继续'
                                  ? 'font-medium text-green-700'
                                  : recentResult === '不合格已结案'
                                    ? 'text-blue-700'
                                    : recentResult === '不合格处理中'
                                      ? 'text-orange-600'
                                      : recentResult === '不合格待建单'
                                        ? 'text-red-600'
                                        : 'text-muted-foreground'
                              }">${escapeHtml(recentResult)}</span>
                            </td>
                            <td class="px-3 py-2">
                              <span class="inline-flex rounded-md border px-2 py-0.5 text-xs ${STATUS_CLASS[order.status]}">${escapeHtml(
                                STATUS_LABEL[order.status],
                              )}</span>
                            </td>
                            <td class="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">${escapeHtml(
                              order.updatedAt ?? order.createdAt,
                            )}</td>
                            <td class="px-3 py-2">
                              ${
                                basis
                                  ? `<span class="inline-flex rounded-md border px-2 py-0.5 text-xs ${DBI_STATUS_CLASS[basis.status]}">${escapeHtml(DBI_STATUS_LABEL[basis.status])}</span>`
                                  : '<span class="text-xs text-muted-foreground">未生成</span>'
                              }
                            </td>
                            <td class="px-3 py-2 text-xs text-muted-foreground">${escapeHtml(settlementParty)}</td>
                            <td class="px-3 py-2">
                              ${
                                basis
                                  ? `<span class="inline-flex rounded-md border px-2 py-0.5 text-xs ${
                                      basis.settlementReady
                                        ? 'border-green-200 bg-green-50 text-green-700'
                                        : 'border-orange-200 bg-orange-50 text-orange-700'
                                    }">${basis.settlementReady ? '可进入结算' : '冻结中'}</span>`
                                  : '<span class="text-xs text-muted-foreground">—</span>'
                              }
                            </td>
                            <td class="max-w-[160px] truncate px-3 py-2 text-xs text-muted-foreground">${escapeHtml(
                              basis?.settlementFreezeReason ?? '—',
                            )}</td>
                            <td class="px-3 py-2">
                              <div class="flex items-center gap-1">
                                ${
                                  order.status === 'DRAFT'
                                    ? `<button class="inline-flex h-7 items-center rounded-md border px-2 text-xs hover:bg-muted" data-dye-action="start-order" data-dp-id="${escapeHtml(order.dpId)}">开始加工</button>`
                                    : ''
                                }

                                ${
                                  order.status === 'PROCESSING' || order.status === 'PARTIAL_RETURNED'
                                    ? `<button class="inline-flex h-7 items-center rounded-md border px-2 text-xs hover:bg-muted" data-dye-action="open-return" data-dp-id="${escapeHtml(order.dpId)}">登记回货</button>`
                                    : ''
                                }

                                ${
                                  order.status !== 'CLOSED' && order.status !== 'DRAFT'
                                    ? `<button class="inline-flex h-7 items-center rounded-md px-2 text-xs text-muted-foreground hover:bg-muted" data-dye-action="close-order" data-dp-id="${escapeHtml(order.dpId)}">关闭</button>`
                                    : ''
                                }

                                ${
                                  activeQcId
                                    ? `<button class="inline-flex h-7 items-center rounded-md px-2 text-xs text-blue-600 hover:bg-blue-50 hover:text-blue-700" data-nav="/fcs/quality/qc-records/${escapeHtml(activeQcId)}">查看质检<i data-lucide="external-link" class="ml-1 h-3 w-3"></i></button>`
                                    : ''
                                }

                                ${
                                  basis
                                    ? `<button class="inline-flex h-7 items-center rounded-md px-2 text-xs text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700" data-nav="/fcs/quality/deduction-calc/${escapeHtml(basis.basisId)}">查看扣款<i data-lucide="external-link" class="ml-1 h-3 w-3"></i></button>`
                                    : ''
                                }
                              </div>
                            </td>
                          </tr>
                        `
                      })
                      .join('')}
                  </tbody>
                </table>
              </div>
            </section>
          `
      }

      ${renderCreateDialog(processorOptions)}
      ${renderReturnDialog(returnTarget)}
    </div>
  `
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
