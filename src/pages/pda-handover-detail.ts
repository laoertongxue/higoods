import { appStore } from '../state/store'
import { escapeHtml } from '../utils'
import { renderRealQrPlaceholder } from '../components/real-qr'
import {
  renderProductionObjectCodeButton,
  type ProductionObjectCodeType,
} from '../data/fcs/production-order-identity.ts'
import { resolveProductionObjectRequest } from '../data/fcs/production-object-overview.ts'
import type { ProcessTask } from '../data/fcs/process-tasks'
import {
  acceptHandoverRecordDiff,
  canCompletePdaHandoutHead,
  canCompletePdaPickupHead,
  confirmPdaPickupRecordReceived,
  createFactoryHandoverRecord,
  deriveHandoutObjectProfile,
  deriveHandoutRecordProfile,
  findPdaHandoverHead,
  findPdaHandoverRecord,
  getPdaHeadRuntimeTask,
  getPdaHeadSourceExecutionDoc,
  getPdaHandoverSourceDisplay,
  findPdaPickupRecord,
  getPdaPickupRecordsByHead,
  getPdaHandoverRecordsByHead,
  listHandoverOrdersByTaskId,
  validateWaterSolubleHandoverScan,
  reportPdaHandoverQtyObjection,
  rejectPdaPickupRecord,
  markPdaHandoutHeadCompleted,
  markPdaPickupHeadCompleted,
  writeBackHandoverRecord,
  type HandoverProofFile,
  type PdaPickupRecord,
  type PdaHandoverHead,
  type PdaHandoverRecord,
  type HandoverPartyKind,
} from '../data/fcs/pda-handover-events'
import {
  formatOperationLocalWallClock,
  getSewingDeliverySlaSnapshot,
  projectSewingDeliverySla,
  type SewingDeliveryReceiptFact,
  type SewingDeliverySlaProjection,
} from '../data/fcs/sewing-delivery-sla.ts'
import { getSewingDeliverySlaView } from '../data/fcs/sewing-delivery-sla-view.ts'
import {
  canHandleDiff,
  canReceiverWriteback,
  getHandoverObjectTypeLabel,
  getHandoverOrderQrDisplayValue,
  getHandoverOrderStatusLabel,
  getHandoverRecordQrDisplayValue,
  getHandoverRecordStatusLabel,
  getRecordDiffQty,
  getRecordReceiverWrittenAt,
  getRecordReceiverWrittenQty,
  getReceiverDisplayName,
} from '../data/fcs/task-handover-domain'
import {
  findFactoryInternalWarehouseByFactoryAndKind,
  findFactoryWarehouseInboundRecordBySourceRecordId,
  findFactoryWarehouseOutboundRecordByHandoverRecordId,
} from '../data/fcs/factory-internal-warehouse.ts'
import {
  linkHandoverReceiveToInboundRecord,
  linkHandoverRecordToOutboundRecord,
  linkPickupConfirmToInboundRecord,
  syncQuantityObjectionToOutboundRecord,
  syncReceiverWritebackToOutboundRecord,
} from '../data/fcs/factory-warehouse-linkage.ts'
import {
  getSpecialCraftBindingByPickupRecordId,
  getSpecialCraftFeiTicketScanSummary,
  getSpecialCraftReturnBindingsByHandoverRecordId,
  isSpecialCraftDispatchPickupRecord,
  isSpecialCraftReturnHandoverRecord,
  markSpecialCraftFactoryReceivedFromHandover,
  receiveSpecialCraftReturnToCuttingWaitHandoverWarehouse,
  syncSpecialCraftReturnObjectionByHandoverRecord,
} from '../data/fcs/cutting/special-craft-fei-ticket-flow.ts'
import {
  getCuttingSewingDispatchByHandoverRecordId,
  getTransferBagContentDisplayItems,
} from '../data/fcs/cutting/sewing-dispatch.ts'
import {
  FULL_CAPABILITY_FACTORY_ID,
  confirmPostFinishingSewingSelfReturnWarehouseRecord,
  confirmPostFinishingWarehouseReceipt,
  listPostFinishingWarehouseAreas,
  listPostFinishingWarehouseLocations,
} from '../data/fcs/post-finishing-domain.ts'
import {
  ACTION_PERMISSION_DENIED_TEXT,
  canAcceptDiffAction,
  canCreateHandoverRecord,
  canRaiseQuantityObjection,
  canReceiverWritebackAction,
  resolveFcsDemoRole,
} from '../data/fcs/action-permissions.ts'
import { createPdaPickupDisputeCase } from '../helpers/fcs-pda-pickup-dispute'
import { getTaskChainTaskById } from '../data/fcs/page-adapters/task-chain-pages-adapter'
import { renderPdaFrame } from './pda-shell'
import { getPdaRuntimeContext } from './pda-runtime'
import { getWaterSolubleWorkOrderByTaskId, WATER_SOLUBLE_STATUS_LABEL } from '../data/fcs/water-soluble-task-domain.ts'
import { canWaterSolubleRolePerform } from '../data/fcs/water-soluble-pda-actor.ts'
import { getCurrentPdaUser, getPdaSession } from '../data/fcs/store-domain-pda.ts'

interface ProofFile {
  id: string
  type: 'IMAGE' | 'VIDEO'
  name: string
  uploadedAt: string
}

interface PdaHandoverDetailState {
  initializedKey: string
  selectedPickupRecordId: string
  pickupDisputeRecordId: string
  pickupDisputeQty: string
  pickupDisputeReason: string
  pickupDisputeRemark: string
  pickupDisputeProofFiles: ProofFile[]
  pickupRejectRecordId: string
  pickupRejectReason: string
  pickupRejectRemark: string
  objectionRecordId: string
  objectionReason: string
  objectionRemark: string
  objectionProofFiles: ProofFile[]
  newRecordOpen: boolean
  newRecordObjectType: 'MATERIAL' | 'FABRIC' | 'CUT_PIECE' | 'SEMI_FINISHED_GARMENT' | 'FINISHED_GARMENT'
  newRecordScanCode: string
  newRecordQty: string
  newRecordUnit: string
  newRecordRemark: string
  writebackRecordId: string
  writebackQty: string
  writebackReason: string
  writebackRemark: string
  writebackPreviewConfirmedAt: string
  writebackSyncWarning: string
  waterHandoverConfirm: {
    token: string
    handoverId: string
    orderId: string
    taskId: string
    factoryId: string
    actorUserId: string
    approvedQty: number
    expectedStatus: 'WAIT_HANDOVER'
  } | null
}

const detailState: PdaHandoverDetailState = {
  initializedKey: '',
  selectedPickupRecordId: '',
  pickupDisputeRecordId: '',
  pickupDisputeQty: '',
  pickupDisputeReason: '',
  pickupDisputeRemark: '',
  pickupDisputeProofFiles: [],
  pickupRejectRecordId: '',
  pickupRejectReason: '',
  pickupRejectRemark: '',
  objectionRecordId: '',
  objectionReason: '',
  objectionRemark: '',
  objectionProofFiles: [],
  newRecordOpen: false,
  newRecordObjectType: 'FINISHED_GARMENT',
  newRecordScanCode: '',
  newRecordQty: '',
  newRecordUnit: '件',
  newRecordRemark: '',
  writebackRecordId: '',
  writebackQty: '',
  writebackReason: '',
  writebackRemark: '',
  writebackPreviewConfirmedAt: '',
  writebackSyncWarning: '',
  waterHandoverConfirm: null,
}

let receiverWritebackNowProvider = (): string => formatOperationLocalWallClock()
let receiverWritebackLinkageProbe: (() => void) | null = null

export function setReceiverWritebackNowProvider(provider: () => string): () => void {
  const previous = receiverWritebackNowProvider
  receiverWritebackNowProvider = provider
  return () => {
    receiverWritebackNowProvider = previous
  }
}

export function setReceiverWritebackLinkageProbe(probe: (() => void) | null): () => void {
  const previous = receiverWritebackLinkageProbe
  receiverWritebackLinkageProbe = probe
  return () => {
    receiverWritebackLinkageProbe = previous
  }
}

export function captureReceiverWritebackDraftState(): Pick<
  PdaHandoverDetailState,
  'writebackRecordId' | 'writebackQty' | 'writebackReason' | 'writebackRemark' | 'writebackPreviewConfirmedAt' | 'writebackSyncWarning'
> {
  return {
    writebackRecordId: detailState.writebackRecordId,
    writebackQty: detailState.writebackQty,
    writebackReason: detailState.writebackReason,
    writebackRemark: detailState.writebackRemark,
    writebackPreviewConfirmedAt: detailState.writebackPreviewConfirmedAt,
    writebackSyncWarning: detailState.writebackSyncWarning,
  }
}

let waterHandoverConfirmSequence = 0

function isWaterSolubleHandoverHead(head: PdaHandoverHead | undefined): head is PdaHandoverHead {
  return head?.headType === 'HANDOUT' && head.sourceBusinessType === 'WATER_SOLUBLE_WORK_ORDER'
}

function getWaterHandoverAccess(head: PdaHandoverHead): { ok: boolean; message: string; actorUserId?: string } {
  if (!isWaterSolubleHandoverHead(head)) return { ok: true, message: '' }
  const session = getPdaSession()
  const user = getCurrentPdaUser()
  const runtime = getPdaRuntimeContext()
  if (!session || !user || user.status !== 'ACTIVE' || !runtime || runtime.userId !== user.userId) {
    return { ok: false, message: '当前未登录或账号已失效，不能操作水溶交出单。' }
  }
  if (runtime.factoryId !== head.factoryId) return { ok: false, message: '该水溶交出单不属于当前工厂，不能操作。' }
  if (!canWaterSolubleRolePerform(session.roleId, 'HANDOVER')) {
    return { ok: false, message: '当前角色不能操作水溶交出单，请由交接员或管理员处理。' }
  }
  const order = getWaterSolubleWorkOrderByTaskId(head.taskId)
  if (!order || order.waterOrderId !== head.sourceDocId || order.factoryId !== runtime.factoryId) {
    return { ok: false, message: '水溶加工单与当前交出单或工厂不一致，不能操作。' }
  }
  if (order.status !== 'WAIT_HANDOVER') {
    return { ok: false, message: `水溶加工单当前为“${WATER_SOLUBLE_STATUS_LABEL[order.status]}”，不能重复交出。` }
  }
  return { ok: true, message: '', actorUserId: runtime.userId }
}

function clearWaterHandoverConfirm(): void {
  detailState.waterHandoverConfirm = null
}

function openWaterHandoverConfirm(head: PdaHandoverHead): { ok: boolean; message: string } {
  const access = getWaterHandoverAccess(head)
  if (!access.ok || !access.actorUserId) return { ok: false, message: access.message }
  const order = getWaterSolubleWorkOrderByTaskId(head.taskId)
  if (!order?.handoverQty) return { ok: false, message: '当前水溶加工单缺少批准交出数量。' }
  waterHandoverConfirmSequence += 1
  detailState.waterHandoverConfirm = {
    token: `${head.handoverId}:${access.actorUserId}:${waterHandoverConfirmSequence}`,
    handoverId: head.handoverId,
    orderId: order.waterOrderId,
    taskId: head.taskId,
    factoryId: head.factoryId,
    actorUserId: access.actorUserId,
    approvedQty: order.handoverQty,
    expectedStatus: 'WAIT_HANDOVER',
  }
  return { ok: true, message: '' }
}

function validateWaterHandoverConfirm(head: PdaHandoverHead, token: string | undefined): { ok: boolean; message: string } {
  const confirm = detailState.waterHandoverConfirm
  const order = getWaterSolubleWorkOrderByTaskId(head.taskId)
  if (
    !confirm
    || !token
    || confirm.token !== token
    || confirm.handoverId !== head.handoverId
    || confirm.orderId !== order?.waterOrderId
    || confirm.taskId !== head.taskId
    || confirm.factoryId !== head.factoryId
    || confirm.approvedQty !== order?.handoverQty
    || confirm.expectedStatus !== order?.status
  ) {
    return { ok: false, message: '当前水溶交出确认已失效，请重新打开确认。' }
  }
  const access = getWaterHandoverAccess(head)
  if (!access.ok || !access.actorUserId) return { ok: false, message: access.message }
  if (confirm.actorUserId !== access.actorUserId) {
    return { ok: false, message: '当前水溶交出确认已失效，请重新打开确认。' }
  }
  return { ok: true, message: '' }
}

const LINKED_QR_FIELD = ['handoverRecord', 'QrValue'].join('')

function getLinkedQrValue(source: Record<string, unknown>): string | undefined {
  const value = source[LINKED_QR_FIELD]
  return typeof value === 'string' ? value : undefined
}

function nowTimestamp(date: Date = new Date()): string {
  return date.toISOString().replace('T', ' ').slice(0, 19)
}

function nowDisplayTimestamp(date: Date = new Date()): string {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const mi = String(date.getMinutes()).padStart(2, '0')
  const ss = String(date.getSeconds()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`
}

function escapeAttr(value: string): string {
  return escapeHtml(value)
}

function getCurrentDetailQueryAction(): string {
  const pathname = appStore.getState().pathname || ''
  const query = pathname.split('?')[1] || ''
  return new URLSearchParams(query).get('action') || ''
}

function cloneProofFiles(files: ProofFile[]): ProofFile[] {
  return files.map((file) => ({ ...file }))
}

function addObjectionProofFile(type: 'IMAGE' | 'VIDEO'): void {
  const ext = type === 'IMAGE' ? 'jpg' : 'mp4'
  const index = detailState.objectionProofFiles.length + 1
  detailState.objectionProofFiles = [
    ...detailState.objectionProofFiles,
    {
      id: `opf-${Date.now()}`,
      type,
      name: `异议凭证_${String(index).padStart(2, '0')}.${ext}`,
      uploadedAt: nowDisplayTimestamp(),
    },
  ]
}

function removeObjectionProofFile(id: string): void {
  detailState.objectionProofFiles = detailState.objectionProofFiles.filter((file) => file.id !== id)
}

function syncHandoutState(handoverId: string): void {
  const pathname = appStore.getState().pathname
  const key = `head:${handoverId}|${pathname}`
  if (detailState.initializedKey === key) return

  detailState.initializedKey = key
  detailState.selectedPickupRecordId = ''
  detailState.pickupDisputeRecordId = ''
  detailState.pickupDisputeQty = ''
  detailState.pickupDisputeReason = ''
  detailState.pickupDisputeRemark = ''
  detailState.pickupDisputeProofFiles = []
  detailState.pickupRejectRecordId = ''
  detailState.pickupRejectReason = ''
  detailState.pickupRejectRemark = ''
  detailState.objectionRecordId = ''
  detailState.objectionReason = ''
  detailState.objectionRemark = ''
  detailState.objectionProofFiles = []
  detailState.newRecordOpen = false
  detailState.newRecordObjectType = 'FINISHED_GARMENT'
  detailState.newRecordScanCode = ''
  detailState.newRecordQty = ''
  detailState.newRecordUnit = '件'
  detailState.newRecordRemark = ''
  detailState.writebackRecordId = ''
  detailState.writebackQty = ''
  detailState.writebackReason = ''
  detailState.writebackRemark = ''
  detailState.writebackPreviewConfirmedAt = ''
  detailState.writebackSyncWarning = ''
  clearWaterHandoverConfirm()
}

function syncPickupState(head: PdaHandoverHead): void {
  const pathname = appStore.getState().pathname
  const key = `pickup:${head.handoverId}|${pathname}`
  if (detailState.initializedKey === key) return

  const records = getPdaPickupRecordsByHead(head.handoverId)
  const currentRecord =
    records.find((record) => record.status === 'PENDING_FACTORY_CONFIRM') ??
    records.find((record) => record.status === 'OBJECTION_REPORTED' || record.status === 'OBJECTION_PROCESSING') ??
    records[0]

  detailState.initializedKey = key
  detailState.selectedPickupRecordId = currentRecord?.recordId || ''
  detailState.pickupDisputeRecordId = ''
  detailState.pickupDisputeQty = currentRecord && typeof currentRecord.warehouseHandedQty === 'number' ? String(currentRecord.warehouseHandedQty) : ''
  detailState.pickupDisputeReason = ''
  detailState.pickupDisputeRemark = ''
  detailState.pickupDisputeProofFiles = []
  detailState.pickupRejectRecordId = ''
  detailState.pickupRejectReason = ''
  detailState.pickupRejectRemark = ''
  detailState.objectionRecordId = ''
  detailState.objectionReason = ''
  detailState.objectionRemark = ''
  detailState.objectionProofFiles = []
  detailState.newRecordOpen = false
  detailState.newRecordObjectType = 'FINISHED_GARMENT'
  detailState.newRecordScanCode = ''
  detailState.newRecordQty = ''
  detailState.newRecordUnit = head.qtyUnit || '件'
  detailState.newRecordRemark = ''
  detailState.writebackRecordId = ''
  detailState.writebackQty = ''
  detailState.writebackReason = ''
  detailState.writebackRemark = ''
  detailState.writebackPreviewConfirmedAt = ''
  detailState.writebackSyncWarning = ''
  clearWaterHandoverConfirm()
}

function showPdaHandoverDetailToast(message: string): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return

  const rootId = 'pda-handover-detail-toast-root'
  let root = document.getElementById(rootId)

  if (!root) {
    root = document.createElement('div')
    root.id = rootId
    root.className = 'pointer-events-none fixed right-6 top-20 z-[130] flex max-w-sm flex-col gap-2'
    document.body.appendChild(root)
  }

  const toast = document.createElement('div')
  toast.className =
    'pointer-events-auto rounded-md border bg-background px-4 py-3 text-sm text-foreground shadow-md transition-all duration-200'
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

function renderFieldRow(label: string, value: string, highlight = false): string {
  return `
    <div>
      <span class="text-muted-foreground">${escapeHtml(label)}：</span>
      <span class="${highlight ? 'font-medium text-primary' : 'font-medium'}">${escapeHtml(value)}</span>
    </div>
  `
}

function renderFieldHtmlRow(label: string, valueHtml: string, highlight = false): string {
  return `
    <div>
      <span class="text-muted-foreground">${escapeHtml(label)}：</span>
      <span class="${highlight ? 'font-medium text-primary' : 'font-medium'}">${valueHtml}</span>
    </div>
  `
}

function renderPdaHandoverObjectCode({
  objectType,
  objectId,
  label,
  relatedProductionOrderNo,
}: {
  objectType: ProductionObjectCodeType
  objectId?: string | null
  label?: string | null
  relatedProductionOrderNo?: string | null
}): string {
  const objectCode = (label || objectId || '').trim()
  const targetId = (objectId || '').trim()
  if (!targetId || !objectCode) return escapeHtml(objectCode || '-')

  const preferred = resolveProductionObjectRequest({ objectType, objectId: targetId, relatedProductionOrderNo })
  const resolved = preferred.status === 'READY' || !relatedProductionOrderNo
    ? preferred
    : resolveProductionObjectRequest({ objectType, objectId: targetId })
  // Only render clickable IDs that open a real overview; unresolved PDA refs stay plain text.
  if (resolved.status !== 'READY') return escapeHtml(objectCode)

  return renderProductionObjectCodeButton({
    objectType: resolved.indexItem.objectType,
    objectId: resolved.indexItem.primaryNo,
    label: objectCode,
    relatedProductionOrderNo: resolved.indexItem.relatedProductionOrderNo,
    defaultTab: resolved.clickedRef.defaultTab,
    highlightKey: resolved.clickedRef.highlightKey,
    className: 'text-left font-mono text-blue-600 hover:underline',
  })
}

function getPdaHandoverProductionRelation(head: PdaHandoverHead): { relatedProductionOrderNo: string } | Record<string, never> {
  if (head.sourceType === 'STOCK') return {}
  const source = getPdaHandoverSourceDisplay(head)
  return source.value === '—' ? {} : { relatedProductionOrderNo: source.value }
}

function renderPdaHandoverSourceIdentity(head: PdaHandoverHead): string {
  const source = getPdaHandoverSourceDisplay(head)
  if (head.sourceType === 'STOCK') return renderFieldRow(source.label, source.value)
  return renderFieldHtmlRow(source.label, renderPdaHandoverObjectCode({
    objectType: 'PRODUCTION_ORDER',
    objectId: source.value,
    ...getPdaHandoverProductionRelation(head),
  }))
}

function renderCuttingHandoverSummaryPanel(record: PdaHandoverRecord): string {
  const summary = record.cuttingHandoverSummary
  if (!summary) return ''
  const gapPreview = summary.gapLines.slice(0, 5)
  const restCount = Math.max(summary.gapLines.length - gapPreview.length, 0)
  const resultLabel =
    summary.completeAfterSubmit
      ? summary.overPieceQtyTotal > 0
        ? '已齐套，有超出'
        : '已齐套'
      : '仍有缺口'
  const panelTone = summary.completeAfterSubmit ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'
  return `
    <div class="rounded-md border p-2 text-xs ${panelTone}">
      <div class="mb-1 font-medium">裁床交出缺口</div>
      <div class="grid grid-cols-2 gap-x-4 gap-y-1">
        ${renderFieldRow('之前已交', `${summary.previousSubmittedPieceQty} 片`, summary.previousSubmittedPieceQty > 0)}
        ${renderFieldRow('本次交出', `${summary.currentSubmittedPieceQty} 片`, true)}
        ${renderFieldRow('累计交出', `${summary.cumulativeSubmittedPieceQty} 片`, true)}
        ${renderFieldRow('交出后结果', resultLabel, !summary.completeAfterSubmit)}
      </div>
      ${
        gapPreview.length
          ? `
            <div class="mt-2 space-y-1">
              <div class="font-medium">还差</div>
              ${gapPreview
                .map((line) => {
                  const qtyText =
                    line.missingPieceQty > 0
                      ? `缺 ${line.missingPieceQty} 片`
                      : line.overPieceQty > 0
                        ? `多 ${line.overPieceQty} 片`
                        : `已交 ${line.cumulativeSubmittedPieceQty}/${line.requiredPieceQty} 片`
                  return `
                    <div class="rounded border border-current/20 bg-white/70 px-2 py-1">
                      <span class="font-medium">${escapeHtml(`${line.skuCode} / ${line.partName}`)}</span>
                      <span class="ml-1">${escapeHtml(qtyText)}</span>
                      <span class="ml-1 text-muted-foreground">${escapeHtml(line.statusLabel)}</span>
                    </div>
                  `
                })
                .join('')}
              ${restCount > 0 ? `<div class="text-[11px]">另 ${restCount} 项缺口</div>` : ''}
            </div>
          `
          : '<div class="mt-2 rounded border border-current/20 bg-white/70 px-2 py-1">还差：无</div>'
      }
    </div>
  `
}

function renderTransferBagMobilePanel(record: PdaHandoverRecord): string {
  const sewingDispatch = getCuttingSewingDispatchByHandoverRecordId(record.handoverRecordId || record.recordId)
  if (!sewingDispatch.dispatchBatch || !sewingDispatch.transferBags.length) return ''
  const isReceiverSide = Boolean(record.receiverWrittenAt || record.receiverWrittenQty)
  return `
    <div class="rounded-md border border-blue-200 bg-blue-50 p-2 text-xs text-blue-800">
      <div class="mb-2 flex items-center justify-between gap-2">
        <div class="font-medium">中转袋</div>
        <span class="rounded-full bg-white px-2 py-0.5">${escapeHtml(sewingDispatch.dispatchBatch.transferOrderNo)}</span>
      </div>
      <div class="mb-2 grid grid-cols-2 gap-1">
        ${renderFieldRow('待装袋', String(sewingDispatch.transferBags.filter((bag) => bag.packStatus === '待装袋').length))}
        ${renderFieldRow('装袋中', String(sewingDispatch.transferBags.filter((bag) => bag.packStatus === '装袋中').length))}
        ${renderFieldRow('已装袋待交出', String(sewingDispatch.transferBags.filter((bag) => bag.packStatus === '已装袋').length))}
        ${renderFieldRow('待收中转袋', String(sewingDispatch.transferBags.filter((bag) => bag.currentLocation === '下游工厂待接收').length))}
      </div>
      <div class="space-y-2">
        ${sewingDispatch.transferBags
          .map((bag) => {
            const contentItems = getTransferBagContentDisplayItems(bag.transferBagId)
            return `
              <article class="rounded-lg border bg-white p-2">
                <div class="flex items-center justify-between gap-2">
                  <div class="font-medium">${escapeHtml(bag.transferBagNo)}</div>
                  <span class="rounded-full border px-2 py-0.5">${escapeHtml(bag.packStatus)}</span>
                </div>
                <div class="mt-1 grid grid-cols-2 gap-1 text-[11px] text-muted-foreground">
                  <div>是否混装：${escapeHtml(bag.bagMode)}</div>
                  <div>内容项数：${bag.contentItemCount}</div>
                  <div>菲票数：${bag.contentFeiTicketCount}</div>
                  <div>当前所在：${escapeHtml(bag.currentLocation)}</div>
                </div>
                <div class="mt-2 space-y-1 text-[11px]">
                  ${contentItems
                    .slice(0, 4)
                    .map((item) => `<div>${escapeHtml(item.feiTicketNo || item.sourceNo || '-')} / ${escapeHtml(item.colorName || '-')} / ${escapeHtml(item.sizeCode || '-')} / ${escapeHtml(item.partName || '-')} / ${item.currentQty} ${escapeHtml(item.unit)}</div>`)
                    .join('')}
                  ${contentItems.length > 4 ? `<div class="text-muted-foreground">另 ${contentItems.length - 4} 条袋内明细</div>` : ''}
                </div>
                <div class="mt-2 flex flex-wrap gap-1.5">
                  <button type="button" class="rounded border bg-white px-2 py-1 text-[11px]" data-nav="/fcs/pda/transfer-bag-detail?bagNo=${escapeAttr(bag.transferBagNo)}">查看袋内明细</button>
                  ${
                    bag.editableBeforeHandover
                      ? `
                        <span class="rounded border bg-white px-2 py-1 text-[11px] text-muted-foreground">交出前可扫码装袋</span>
                      `
                      : '<span class="rounded border bg-muted px-2 py-1 text-[11px] text-muted-foreground">已交出后锁定</span>'
                  }
                </div>
              </article>
            `
          })
          .join('')}
      </div>
      <div class="mt-2 rounded border bg-white px-2 py-1 text-[11px] text-muted-foreground">${escapeHtml(isReceiverSide ? '接收方已确认收货' : '等待交出记录确认')}</div>
    </div>
  `
}

function renderSpecialCraftTicketSummary(ticketNos: string[]): string {
  const summaries = Array.from(new Set(ticketNos.filter(Boolean))).map((feiTicketNo) => getSpecialCraftFeiTicketScanSummary(feiTicketNo))
  if (summaries.length === 0 || summaries.every((summary) => !summary.hasSpecialCraft)) return ''

  return `
    <div class="rounded-md border border-blue-200 bg-blue-50 p-2 text-xs text-blue-800">
      <div class="mb-1 font-medium">特殊工艺菲票</div>
      <div class="space-y-1.5">
        ${summaries
          .filter((summary) => summary.hasSpecialCraft)
          .map(
            (summary) => `
              <div class="rounded border border-blue-100 bg-white/70 px-2 py-1">
                <div class="flex items-center justify-between gap-2">
                  <span class="font-medium">${escapeHtml(summary.feiTicketNo)}</span>
                  <span>${escapeHtml(summary.currentFlowStatus)}</span>
                </div>
                <div class="mt-1 grid grid-cols-2 gap-x-3 gap-y-1">
                  ${renderFieldRow('原数量', String(summary.originalQty), true)}
                  ${renderFieldRow('当前数量', String(summary.currentQty), true)}
                  ${renderFieldRow('报废数量', String(summary.cumulativeScrapQty))}
                  ${renderFieldRow('货损数量', String(summary.cumulativeDamageQty))}
                  ${renderFieldRow('已完成特殊工艺', summary.completedOperationNames.join('、') || '无')}
                  ${renderFieldRow('差异状态', summary.hasOpenReceiveDifference || summary.hasOpenReturnDifference ? '差异待处理' : '无')}
                </div>
              </div>
            `,
          )
          .join('')}
      </div>
    </div>
  `
}

function renderSectionCard(title: string, body: string): string {
  return `
    <article class="rounded-lg border bg-card">
      <header class="border-b px-3 py-2.5">
        <h2 class="text-sm font-semibold">${escapeHtml(title)}</h2>
      </header>
      <div class="space-y-2 px-3 pb-3 pt-2.5">
        ${body}
      </div>
    </article>
  `
}

function renderPartyRow(label: string, kind: HandoverPartyKind, name: string): string {
  return `
    <div class="flex items-center gap-2 text-sm">
      <span class="w-20 shrink-0 text-muted-foreground">${escapeHtml(label)}：</span>
      <span class="inline-flex items-center gap-1">
        <i data-lucide="${kind === 'WAREHOUSE' ? 'warehouse' : 'factory'}" class="h-3.5 w-3.5 text-muted-foreground"></i>
        <span class="font-medium">${escapeHtml(name)}</span>
      </span>
    </div>
  `
}

function appendTaskAudit(taskId: string, action: string, detail: string, by: string): void {
  const task = getTaskChainTaskById(taskId) as ProcessTask | undefined
  if (!task) return

  const now = nowTimestamp()
  task.updatedAt = now
  task.auditLogs = [
    ...task.auditLogs,
    {
      id: `AL-HO-${Date.now()}`,
      action,
      detail,
      at: now,
      by,
    },
  ]
}

function parsePostFinishingPickupRecord(record: PdaPickupRecord): { handoverRecordNo: string; handoverLineId: string } | null {
  const prefix = 'POST_FINISHING_PICKUP|'
  if (!record.qrCodeValue.startsWith(prefix)) return null
  const [, handoverRecordNo, handoverLineId] = record.qrCodeValue.split('|')
  if (!handoverRecordNo || !handoverLineId) return null
  return { handoverRecordNo, handoverLineId }
}

function parsePostFinishingSelfReturnPickupRecord(record: PdaPickupRecord): { selfReturnRecordNo: string; itemId: string; warehouseRecordId: string } | null {
  const prefix = 'POST_FINISHING_SELF_RETURN_PICKUP|'
  if (!record.qrCodeValue.startsWith(prefix)) return null
  const [, selfReturnRecordNo, itemId, warehouseRecordId] = record.qrCodeValue.split('|')
  if (!selfReturnRecordNo || !itemId || !warehouseRecordId) return null
  return { selfReturnRecordNo, itemId, warehouseRecordId }
}

function isPostFinishingPickupHead(head: PdaHandoverHead | undefined): boolean {
  return Boolean(head && head.headType === 'PICKUP' && head.processBusinessCode === 'POST_FINISHING' && head.targetKind === 'FACTORY')
}

function getPickupPartyDisplay(head: PdaHandoverHead): {
  sourceLabel: string
  sourceKind: HandoverPartyKind
  targetLabel: string
  targetKind: HandoverPartyKind
} {
  if (isPostFinishingPickupHead(head)) {
    return {
      sourceLabel: '来源车缝厂',
      sourceKind: 'FACTORY',
      targetLabel: '后道工厂',
      targetKind: 'FACTORY',
    }
  }
  return {
    sourceLabel: '来源仓库',
    sourceKind: 'WAREHOUSE',
    targetLabel: '领料工厂',
    targetKind: head.targetKind,
  }
}

function isPostFinishingHandoutHead(head: PdaHandoverHead | undefined): boolean {
  return Boolean(head && head.headType === 'HANDOUT' && head.processBusinessCode === 'POST_FINISHING')
}

function isPostFinishingHandoutRecord(record: PdaHandoverRecord | undefined): boolean {
  if (!record) return false
  return isPostFinishingHandoutHead(findPdaHandoverHead(record.handoverId))
}

function getRecordStatusMeta(status: PdaHandoverRecord['status']): { label: string; className: string } {
  if (status === 'PENDING_WRITEBACK') {
    return { label: '待收货确认', className: 'border-amber-200 bg-amber-50 text-amber-700' }
  }
  if (status === 'WRITTEN_BACK') {
    return { label: '已确认收货', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' }
  }
  if (status === 'OBJECTION_REPORTED') {
    return { label: '已发起异议', className: 'border-red-200 bg-red-50 text-red-700' }
  }
  if (status === 'OBJECTION_PROCESSING') {
    return { label: '异议处理中', className: 'border-blue-200 bg-blue-50 text-blue-700' }
  }
  return { label: '异议已处理', className: 'border-zinc-200 bg-zinc-100 text-zinc-700' }
}

function getPickupRecordStatusMeta(status: PdaPickupRecord['status']): { label: string; className: string } {
  if (status === 'PENDING_WAREHOUSE_DISPATCH') {
    return { label: '待仓库发出', className: 'border-amber-200 bg-amber-50 text-amber-700' }
  }
  if (status === 'PENDING_FACTORY_PICKUP') {
    return { label: '待自提', className: 'border-blue-200 bg-blue-50 text-blue-700' }
  }
  if (status === 'PENDING_FACTORY_CONFIRM') {
    return { label: '待工厂确认', className: 'border-violet-200 bg-violet-50 text-violet-700' }
  }
  if (status === 'RECEIVED') {
    return { label: '已确认领料', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' }
  }
  if (status === 'REJECTED') {
    return { label: '已驳回', className: 'border-slate-200 bg-slate-100 text-slate-700' }
  }
  if (status === 'OBJECTION_REPORTED') {
    return { label: '已发起数量差异', className: 'border-red-200 bg-red-50 text-red-700' }
  }
  if (status === 'OBJECTION_PROCESSING') {
    return { label: '差异处理中', className: 'border-blue-200 bg-blue-50 text-blue-700' }
  }
  return { label: '平台已裁定', className: 'border-zinc-200 bg-zinc-100 text-zinc-700' }
}

function getPickupCurrentGuide(
  record: PdaPickupRecord,
): { title: string; hint: string; panelClass: string } {
  const postFinishingPickup = parsePostFinishingPickupRecord(record)
  const selfReturnPickup = parsePostFinishingSelfReturnPickupRecord(record)
  const postFinishingSource = Boolean(postFinishingPickup || selfReturnPickup)
  if (record.status === 'PENDING_FACTORY_CONFIRM') {
    return {
      title: '当前等待你确认',
      hint: '请确认本次领料，或发起数量差异。',
      panelClass: 'border-violet-200 bg-violet-50',
    }
  }
  if (record.status === 'OBJECTION_REPORTED' || record.status === 'OBJECTION_PROCESSING') {
    return {
      title: '当前等待平台处理',
      hint: '查看异常单进度与处理结果。',
      panelClass: 'border-red-200 bg-red-50',
    }
  }
  if (record.status === 'OBJECTION_RESOLVED') {
    return {
      title: '当前结果已确定',
      hint: '平台已给出最终结果。',
      panelClass: 'border-zinc-200 bg-zinc-50',
    }
  }
  if (record.status === 'RECEIVED') {
    return {
      title: '当前记录已确认',
      hint: '本次领料已确认完成。',
      panelClass: 'border-emerald-200 bg-emerald-50',
    }
  }
  if (record.status === 'REJECTED') {
    return {
      title: '当前记录已驳回',
      hint: '本次领料已驳回，不会进入待加工仓。',
      panelClass: 'border-slate-200 bg-slate-50',
    }
  }
  return {
    title: postFinishingSource ? '当前等待车缝厂送达' : '当前等待仓库交付',
    hint: postFinishingSource ? '先查看记录与二维码，待车缝厂送达后再处理。' : '先查看记录与二维码。',
    panelClass: 'border-blue-200 bg-blue-50',
  }
}

function formatPickupQty(qty: number | undefined, unit: string): string {
  return typeof qty === 'number' ? `${qty} ${unit}` : '—'
}

function renderPickupCurrentMetric(label: string, value: string, emphasis = false): string {
  return `
    <div class="min-w-0">
      <div class="text-[11px] text-muted-foreground">${escapeHtml(label)}</div>
      <div class="mt-1 ${emphasis ? 'text-sm' : 'text-xs'} font-semibold leading-5">${escapeHtml(value)}</div>
    </div>
  `
}

function getPickupWarehouseSourceStatus(record: PdaPickupRecord): string {
  if (record.status === 'REJECTED') return '已驳回'
  if (record.status === 'OBJECTION_REPORTED' || record.status === 'OBJECTION_PROCESSING' || record.status === 'OBJECTION_RESOLVED') {
    return '差异待处理'
  }
  if (record.status === 'RECEIVED') return '已确认'
  return '未入库'
}

function renderWarehouseLinkRow(label: string, value: string, href?: string): string {
  const content = href
    ? `<button type="button" class="text-blue-700 hover:underline" data-nav="${escapeAttr(href)}">${escapeHtml(value)}</button>`
    : `<span class="font-medium">${escapeHtml(value)}</span>`
  return `
    <div class="flex items-center justify-between gap-3 text-xs">
      <span class="text-muted-foreground">${escapeHtml(label)}</span>
      ${content}
    </div>
  `
}

function renderPickupCurrentPanel(
  record: PdaPickupRecord,
  showPickupDisputeForm: boolean,
  showPickupRejectForm: boolean,
): string {
  const warehouseQtyValue = formatPickupQty(record.warehouseHandedQty, record.qtyUnit)
  const expectedQtyValue = formatPickupQty(record.qtyExpected, record.qtyUnit)
  const confirmedQtyValue = formatPickupQty(record.factoryConfirmedQty, record.qtyUnit)
  const reportedQtyValue = formatPickupQty(record.factoryReportedQty, record.qtyUnit)
  const finalQtyValue = formatPickupQty(record.finalResolvedQty, record.qtyUnit)
  const linkedInboundRecord = getLinkedInboundRecord(record.recordId)
  const postFinishingPickup = parsePostFinishingPickupRecord(record)
  const selfReturnPickup = parsePostFinishingSelfReturnPickupRecord(record)
  const postFinishingSource = Boolean(postFinishingPickup || selfReturnPickup)
  const linkedInboundLabel = linkedInboundRecord?.inboundRecordNo || (postFinishingSource && record.status === 'RECEIVED' ? '后道待加工仓已入库' : '未入库')
  const linkedInboundHref = linkedInboundRecord ? buildInboundRecordRoute(record.recordId) : ''
  const sourceStatusLabel = postFinishingSource && record.status === 'RECEIVED' ? '已入后道待加工仓' : getPickupWarehouseSourceStatus(record)
  const sourceQtyLabel = postFinishingSource ? '车缝厂交付数量' : '仓库交付数量'
  const sourceTimeLabel = postFinishingSource ? '车缝厂交付时间' : '仓库交付时间'
  const waitSourceText = postFinishingSource ? '待车缝厂送达' : '待仓库扫码交付'
  const shouldShowExpectedInPendingConfirm =
    typeof record.warehouseHandedQty === 'number' && record.warehouseHandedQty !== record.qtyExpected

  if (record.status === 'PENDING_FACTORY_CONFIRM') {
    return `
      <div class="grid gap-x-3 gap-y-2 rounded-md bg-background/70 px-2.5 py-2 sm:grid-cols-2 ${shouldShowExpectedInPendingConfirm ? 'lg:grid-cols-3' : ''}">
        ${renderPickupCurrentMetric(sourceQtyLabel, warehouseQtyValue, true)}
        ${renderPickupCurrentMetric(sourceTimeLabel, record.warehouseHandedAt || waitSourceText)}
        ${
          shouldShowExpectedInPendingConfirm
            ? renderPickupCurrentMetric('本次应领物料对象', expectedQtyValue)
            : ''
        }
      </div>

      <div class="flex flex-wrap gap-2 pt-1">
        <button
          type="button"
          class="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          data-pda-handoverd-action="confirm-pickup-record"
          data-record-id="${escapeHtml(record.recordId)}"
        >确认本次领料</button>
        <button
          type="button"
          class="inline-flex h-9 items-center rounded-md border border-red-200 bg-background px-4 text-sm text-red-700 hover:bg-red-50"
          data-pda-handoverd-action="open-pickup-record-objection"
          data-record-id="${escapeHtml(record.recordId)}"
        >数量有差异</button>
        <button
          type="button"
          class="inline-flex h-9 items-center rounded-md border border-slate-200 bg-background px-4 text-sm text-slate-700 hover:bg-slate-100"
          data-pda-handoverd-action="open-pickup-record-reject"
          data-record-id="${escapeHtml(record.recordId)}"
        >驳回</button>
      </div>

      ${
        showPickupDisputeForm
          ? `
              <div class="space-y-3 border-t border-dashed border-red-200 pt-3">
                <div class="grid gap-3 md:grid-cols-2">
                  <label class="space-y-1">
                    <span class="text-xs font-medium">工厂实际收到数量 *</span>
                    <input
                      class="h-9 w-full rounded-md border bg-background px-3 text-sm"
                      type="number"
                      value="${escapeHtml(detailState.pickupDisputeQty)}"
                      data-pda-handoverd-field="pickupDisputeQty"
                    />
                  </label>
                  <label class="space-y-1">
                    <span class="text-xs font-medium">差异原因 *</span>
                    <input
                      class="h-9 w-full rounded-md border bg-background px-3 text-sm"
                      value="${escapeHtml(detailState.pickupDisputeReason)}"
                      data-pda-handoverd-field="pickupDisputeReason"
                      placeholder="${postFinishingSource ? '例如：实际到货少于车缝厂交付数量' : '例如：实际到货少于仓库交付数量'}"
                    />
                  </label>
                </div>
                <label class="space-y-1">
                  <span class="text-xs font-medium">差异说明</span>
                  <textarea
                    class="min-h-[84px] w-full rounded-md border bg-background px-3 py-2 text-sm"
                    data-pda-handoverd-field="pickupDisputeRemark"
                    placeholder="补充现场复点结果、包装异常或短少说明"
                  >${escapeHtml(detailState.pickupDisputeRemark)}</textarea>
                </label>
                <div class="space-y-1">
                  <span class="text-xs font-medium">图片 / 视频证据</span>
                  ${renderPickupProofFiles(detailState.pickupDisputeProofFiles)}
                </div>
                <div class="flex flex-wrap gap-2">
                  <button
                    type="button"
                    class="inline-flex h-9 items-center rounded-md bg-red-600 px-4 text-sm font-medium text-white hover:bg-red-700"
                    data-pda-handoverd-action="submit-pickup-record-objection"
                    data-record-id="${escapeHtml(record.recordId)}"
                  >提交数量差异</button>
                  <button
                    type="button"
                    class="inline-flex h-9 items-center rounded-md border px-4 text-sm hover:bg-muted"
                    data-pda-handoverd-action="cancel-pickup-record-objection"
                  >取消</button>
                </div>
              </div>
            `
          : ''
      }

      ${
        showPickupRejectForm
          ? `
              <div class="space-y-3 border-t border-dashed border-slate-200 pt-3">
                <label class="space-y-1">
                  <span class="text-xs font-medium">驳回原因 *</span>
                  <input
                    class="h-9 w-full rounded-md border bg-background px-3 text-sm"
                    value="${escapeHtml(detailState.pickupRejectReason)}"
                    data-pda-handoverd-field="pickupRejectReason"
                    placeholder="例如：到货与领料内容不符"
                  />
                </label>
                <label class="space-y-1">
                  <span class="text-xs font-medium">驳回说明</span>
                  <textarea
                    class="min-h-[84px] w-full rounded-md border bg-background px-3 py-2 text-sm"
                    data-pda-handoverd-field="pickupRejectRemark"
                    placeholder="补充驳回说明"
                  >${escapeHtml(detailState.pickupRejectRemark)}</textarea>
                </label>
                <div class="flex flex-wrap gap-2">
                  <button
                    type="button"
                    class="inline-flex h-9 items-center rounded-md bg-slate-700 px-4 text-sm font-medium text-white hover:bg-slate-800"
                    data-pda-handoverd-action="submit-pickup-record-reject"
                    data-record-id="${escapeHtml(record.recordId)}"
                  >确认驳回</button>
                  <button
                    type="button"
                    class="inline-flex h-9 items-center rounded-md border px-4 text-sm hover:bg-muted"
                    data-pda-handoverd-action="cancel-pickup-record-reject"
                  >取消</button>
                </div>
              </div>
            `
          : ''
      }
    `
  }

  if (record.status === 'RECEIVED') {
    return `
      <div class="grid gap-x-3 gap-y-2 rounded-md bg-background/70 px-2.5 py-2 sm:grid-cols-2">
        ${renderPickupCurrentMetric('已确认数量', confirmedQtyValue, true)}
        ${renderPickupCurrentMetric('确认时间', record.factoryConfirmedAt || record.receivedAt || '—')}
      </div>
      <div class="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-2">
        <div class="space-y-1.5">
          ${renderWarehouseLinkRow('入库记录', linkedInboundLabel, linkedInboundHref)}
          ${renderWarehouseLinkRow('来源状态', sourceStatusLabel)}
        </div>
      </div>
      <div class="text-xs text-emerald-700">本次领料已确认完成。</div>
    `
  }

  if (record.status === 'OBJECTION_REPORTED' || record.status === 'OBJECTION_PROCESSING') {
    return `
      <div class="grid gap-x-3 gap-y-2 rounded-md bg-background/70 px-2.5 py-2 sm:grid-cols-2 lg:grid-cols-3">
        ${renderPickupCurrentMetric(sourceQtyLabel, warehouseQtyValue, true)}
        ${renderPickupCurrentMetric('工厂申报数量', reportedQtyValue)}
        ${renderPickupCurrentMetric('异常单号', record.exceptionCaseId || '待生成')}
      </div>
      <div class="rounded-md border border-red-200 bg-red-50 px-2.5 py-2">
        <div class="space-y-1.5">
          ${renderWarehouseLinkRow('入库记录', linkedInboundLabel, linkedInboundHref)}
          ${renderWarehouseLinkRow('来源状态', sourceStatusLabel)}
        </div>
      </div>
      <div class="space-y-2 pt-1 text-xs text-red-700">
        ${record.followUpRemark ? `<p>处理进度：${escapeHtml(record.followUpRemark)}</p>` : ''}
        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            class="inline-flex h-9 items-center rounded-md border border-red-200 bg-background px-4 text-sm hover:bg-red-100"
            data-pda-handoverd-action="goto-pickup-record-exception"
            data-record-id="${escapeHtml(record.recordId)}"
          >去异常定位与处理</button>
        </div>
      </div>
    `
  }

  if (record.status === 'OBJECTION_RESOLVED') {
    return `
      <div class="grid gap-x-3 gap-y-2 rounded-md bg-background/70 px-2.5 py-2 sm:grid-cols-2">
        ${renderPickupCurrentMetric('最终确认数量', finalQtyValue, true)}
        ${renderPickupCurrentMetric('裁定时间', record.finalResolvedAt || '—')}
      </div>
      <div class="rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-2">
        <div class="space-y-1.5">
          ${renderWarehouseLinkRow('入库记录', linkedInboundLabel, linkedInboundHref)}
          ${renderWarehouseLinkRow('来源状态', sourceStatusLabel)}
        </div>
      </div>
      <div class="space-y-1 pt-1 text-xs text-zinc-700">
        ${record.resolvedRemark ? `<p>处理记录：${escapeHtml(record.resolvedRemark)}</p>` : ''}
      </div>
    `
  }

  if (record.status === 'REJECTED') {
    return `
      <div class="grid gap-x-3 gap-y-2 rounded-md bg-background/70 px-2.5 py-2 sm:grid-cols-2">
        ${renderPickupCurrentMetric(sourceQtyLabel, warehouseQtyValue, true)}
        ${renderPickupCurrentMetric('本次应领物料对象', expectedQtyValue)}
      </div>
      <div class="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2">
        <div class="space-y-1.5">
          ${renderWarehouseLinkRow('入库记录', '未入库')}
          ${renderWarehouseLinkRow('来源状态', sourceStatusLabel)}
        </div>
      </div>
      <div class="space-y-1 pt-1 text-xs text-slate-700">
        ${record.objectionReason ? `<p>驳回原因：${escapeHtml(record.objectionReason)}</p>` : ''}
        ${record.objectionRemark ? `<p>驳回记录：${escapeHtml(record.objectionRemark)}</p>` : ''}
      </div>
    `
  }

  return `
    <div class="grid gap-x-3 gap-y-2 rounded-md bg-background/70 px-2.5 py-2 sm:grid-cols-2">
      ${renderPickupCurrentMetric('本次应领物料对象', expectedQtyValue, true)}
      ${
        record.warehouseHandedAt
          ? renderPickupCurrentMetric(sourceTimeLabel, record.warehouseHandedAt)
          : ''
      }
    </div>
    <div class="pt-1 text-xs text-blue-700">${postFinishingSource ? '当前先查看记录与二维码，待车缝厂送达后再处理。' : '当前先查看记录与二维码，待仓库交付后再处理。'}</div>
  `
}

function renderPickupProofFiles(files: ProofFile[]): string {
  return `
    <div class="space-y-2">
      <div class="flex gap-2">
        <button
          type="button"
          class="inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-md border border-dashed text-xs hover:bg-muted"
          data-pda-handoverd-action="add-pickup-dispute-proof-image"
        >
          <i data-lucide="image" class="h-3.5 w-3.5 text-blue-500"></i>上传图片
        </button>
        <button
          type="button"
          class="inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-md border border-dashed text-xs hover:bg-muted"
          data-pda-handoverd-action="add-pickup-dispute-proof-video"
        >
          <i data-lucide="video" class="h-3.5 w-3.5 text-purple-500"></i>上传视频
        </button>
      </div>
      ${
        files.length === 0
          ? '<div class="text-xs text-muted-foreground">暂无差异证据，可先提交说明后再补充。</div>'
          : files
              .map(
                (file) => `
                  <div class="flex items-center gap-2 rounded-md border bg-muted/30 px-2.5 py-1.5">
                    <i data-lucide="${file.type === 'IMAGE' ? 'image' : 'video'}" class="h-3.5 w-3.5 ${file.type === 'IMAGE' ? 'text-blue-500' : 'text-purple-500'}"></i>
                    <span class="min-w-0 flex-1 truncate text-xs">${escapeHtml(file.name)}</span>
                    <button
                      type="button"
                      class="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-destructive"
                      data-pda-handoverd-action="remove-pickup-dispute-proof"
                      data-proof-id="${escapeHtml(file.id)}"
                    >
                      <i data-lucide="trash-2" class="h-3 w-3"></i>
                    </button>
                  </div>
                `,
              )
              .join('')
      }
    </div>
  `
}

function selectPickupRecord(record: PdaPickupRecord | undefined): void {
  detailState.selectedPickupRecordId = record?.recordId || ''
  detailState.pickupDisputeRecordId = ''
  detailState.pickupDisputeQty =
    record && typeof record.warehouseHandedQty === 'number'
      ? String(record.warehouseHandedQty)
      : record && typeof record.factoryReportedQty === 'number'
      ? String(record.factoryReportedQty)
      : ''
  detailState.pickupDisputeReason = record?.objectionReason || ''
  detailState.pickupDisputeRemark = record?.objectionRemark || ''
  detailState.pickupDisputeProofFiles = cloneProofFiles(record?.objectionProofFiles ?? [])
  detailState.pickupRejectRecordId = ''
  detailState.pickupRejectReason = record?.objectionReason || ''
  detailState.pickupRejectRemark = record?.objectionRemark || ''
}

function isWarehouseLinkageSkippableError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes('未找到工厂内部仓所属工厂') || message.includes('未找到待加工仓') || message.includes('未找到待交出仓')
}

function getLinkedInboundRecord(sourceRecordId: string) {
  return findFactoryWarehouseInboundRecordBySourceRecordId(sourceRecordId)
}

function getLinkedOutboundRecord(handoverRecordId: string) {
  return findFactoryWarehouseOutboundRecordByHandoverRecordId(handoverRecordId)
}

function buildInboundRecordRoute(sourceRecordId: string): string {
  const inboundRecord = getLinkedInboundRecord(sourceRecordId)
  if (!inboundRecord) return '/fcs/pda/warehouse/inbound-records'
  return `/fcs/pda/warehouse/inbound-records?recordId=${encodeURIComponent(inboundRecord.inboundRecordId)}`
}

function buildOutboundRecordRoute(handoverRecordId: string): string {
  const outboundRecord = getLinkedOutboundRecord(handoverRecordId)
  if (!outboundRecord) return '/fcs/pda/warehouse/outbound-records'
  return `/fcs/pda/warehouse/outbound-records?recordId=${encodeURIComponent(outboundRecord.outboundRecordId)}`
}

function renderPickupRecordItem(record: PdaPickupRecord): string {
  const meta = getPickupRecordStatusMeta(record.status)
  const selected = detailState.selectedPickupRecordId === record.recordId
  const linkedInboundRecord = getLinkedInboundRecord(record.recordId)
  const postFinishingPickup = parsePostFinishingPickupRecord(record)
  const selfReturnPickup = parsePostFinishingSelfReturnPickupRecord(record)
  const postFinishingSource = Boolean(postFinishingPickup || selfReturnPickup)
  const linkedInboundLabel = linkedInboundRecord?.inboundRecordNo || (postFinishingSource && record.status === 'RECEIVED' ? '后道待加工仓已入库' : '未入库')
  const linkedInboundHref = linkedInboundRecord ? buildInboundRecordRoute(record.recordId) : ''
  const sourceStatusLabel = postFinishingSource && record.status === 'RECEIVED' ? '已入后道待加工仓' : getPickupWarehouseSourceStatus(record)
  const platformRemark =
    record.status === 'OBJECTION_PROCESSING' || record.status === 'OBJECTION_RESOLVED'
      ? (record.resolvedRemark || record.followUpRemark || '').trim()
      : ''
  const warehouseQtyValue = formatPickupQty(record.warehouseHandedQty, record.qtyUnit)
  const sourceQtyLabel = postFinishingSource ? '车缝厂交付数量' : '仓库交付数量'
  const sourceTimeLabel = postFinishingSource ? '车缝厂交付时间' : '仓库交付时间'
  const skuLineQtyValue = formatPickupQty(record.warehouseHandedQty ?? record.qtyExpected, record.qtyUnit)
  const factoryQtyValue = typeof record.factoryConfirmedQty === 'number' ? formatPickupQty(record.factoryConfirmedQty, record.qtyUnit) : ''
  const finalQtyValue = typeof record.finalResolvedQty === 'number' ? formatPickupQty(record.finalResolvedQty, record.qtyUnit) : ''
  const specialCraftBinding = getSpecialCraftBindingByPickupRecordId(record.recordId)
  const specialCraftSummary = specialCraftBinding ? renderSpecialCraftTicketSummary([specialCraftBinding.feiTicketNo]) : ''
  const progressFields = [
    factoryQtyValue ? renderFieldRow('工厂确认数量', factoryQtyValue, true) : '',
    finalQtyValue ? renderFieldRow('最终确认数量', finalQtyValue, true) : '',
    renderFieldRow('入库记录', linkedInboundLabel, Boolean(linkedInboundRecord)),
    renderFieldRow('来源状态', sourceStatusLabel, sourceStatusLabel !== '未入库'),
    record.warehouseHandedAt ? renderFieldRow(sourceTimeLabel, record.warehouseHandedAt) : '',
    record.factoryConfirmedAt || record.receivedAt
      ? renderFieldRow('工厂确认时间', record.factoryConfirmedAt || record.receivedAt || '')
      : '',
    record.exceptionCaseId ? renderFieldRow('异常单号', record.exceptionCaseId, true) : '',
  ].filter(Boolean)
  const resultTitle =
    record.status === 'REJECTED'
      ? '驳回结果'
      : record.status === 'OBJECTION_RESOLVED'
        ? '平台处理结果'
        : '数量差异处理'
  const shouldShowResultZone = Boolean(record.objectionReason || record.objectionRemark || record.resolvedRemark || record.followUpRemark)

  return `
    <article data-testid="pickup-record-card" class="space-y-2.5 rounded-lg border ${selected ? 'border-primary bg-primary/5 ring-1 ring-primary/10 shadow-sm' : 'bg-card shadow-sm'} p-3">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="flex items-center gap-2">
          <span class="inline-flex items-center rounded border border-border bg-muted px-1.5 py-0 text-[10px]">第 ${record.sequenceNo} 次领料</span>
          <span class="inline-flex items-center rounded border px-1.5 py-0 text-[10px] ${meta.className}">${escapeHtml(meta.label)}</span>
        </div>
        <button
          type="button"
          class="inline-flex h-7 items-center rounded-md border px-2.5 text-[11px] ${selected ? 'border-primary text-primary' : 'hover:bg-muted'}"
          data-pda-handoverd-action="select-pickup-record"
          data-record-id="${escapeHtml(record.recordId)}"
        >${selected ? '当前处理中' : '查看本条记录'}</button>
      </div>

      <div class="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        ${renderFieldRow('领料方式', record.pickupModeLabel)}
        ${renderFieldRow('本次应领物料对象', formatPickupQty(record.qtyExpected, record.qtyUnit), true)}
        ${renderFieldRow(sourceQtyLabel, warehouseQtyValue, true)}
      </div>

      ${
        progressFields.length > 0
          ? `
              <div class="h-px bg-border"></div>
              <div class="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                ${progressFields.join('')}
              </div>
            `
          : ''
      }

      <div class="h-px bg-border"></div>
      <div class="space-y-1.5 text-xs">
        <div class="font-medium text-muted-foreground">明细</div>
        <div class="overflow-hidden rounded-md border bg-background">
          <div class="grid grid-cols-[1.35fr_.7fr_.8fr_.7fr] gap-2 bg-muted/40 px-2.5 py-1.5 text-[11px] text-muted-foreground">
            <div>SKU</div>
            <div>尺码</div>
            <div>颜色</div>
            <div>数量</div>
          </div>
          <div class="grid grid-cols-[1.35fr_.7fr_.8fr_.7fr] gap-2 px-2.5 py-2 font-medium">
            <div class="break-words">${escapeHtml(record.skuCode || '-')}</div>
            <div>${escapeHtml(record.skuSize || '-')}</div>
            <div>${escapeHtml(record.skuColor || '-')}</div>
            <div>${escapeHtml(skuLineQtyValue)}</div>
          </div>
        </div>
      </div>

      ${specialCraftSummary}

      <div class="h-px bg-border"></div>
      <div class="flex items-center justify-between gap-3 text-xs">
        <span class="text-muted-foreground">入库记录</span>
        ${
          linkedInboundRecord
            ? `<button type="button" class="text-blue-700 hover:underline" data-nav="${escapeAttr(linkedInboundHref)}">${escapeHtml(linkedInboundLabel)}</button>`
            : '<span class="font-medium">未入库</span>'
        }
      </div>
      <div class="flex items-center justify-between gap-3 text-xs">
        <span class="text-muted-foreground">来源状态</span>
        <span class="font-medium">${escapeHtml(sourceStatusLabel)}</span>
      </div>

      <div class="h-px bg-border"></div>
      <div data-testid="pickup-record-qr" class="flex flex-wrap items-start justify-between gap-2 text-xs">
        <div class="space-y-1">
          <p class="text-[11px] font-medium text-muted-foreground">领料记录二维码</p>
          <div class="flex items-center gap-2">
            <i data-lucide="qr-code" class="h-4 w-4 text-primary"></i>
            <span class="text-xs">${record.qrCodeValue ? '已绑定二维码' : '待生成二维码'}</span>
          </div>
        </div>
        <p class="max-w-[220px] text-[11px] text-muted-foreground">${postFinishingSource ? '后道确认对象固定为领料记录。' : '仓库扫码对象固定为领料记录。'}</p>
      </div>

      ${
        shouldShowResultZone
          ? `
            <div class="h-px bg-border"></div>
            <div class="rounded-md border ${
              record.status === 'OBJECTION_RESOLVED' ? 'border-zinc-200 bg-zinc-50 text-zinc-700' : 'border-red-200 bg-red-50 text-red-700'
            } px-2.5 py-2 text-xs" data-testid="pickup-record-result">
              <div class="font-medium">${escapeHtml(resultTitle)}</div>
              ${
                linkedInboundRecord
                  ? `<div class="mt-1">入库记录：<button type="button" class="text-blue-700 hover:underline" data-nav="${escapeAttr(linkedInboundHref)}">${escapeHtml(linkedInboundLabel)}</button></div>`
                  : ''
              }
              ${record.objectionReason ? `<div>差异原因：${escapeHtml(record.objectionReason)}</div>` : ''}
              ${record.objectionRemark ? `<div class="mt-1">差异记录：${escapeHtml(record.objectionRemark)}</div>` : ''}
              ${
                record.objectionProofFiles && record.objectionProofFiles.length > 0
                  ? `<div class="mt-1">证据数量：${record.objectionProofFiles.length}</div>`
                  : ''
              }
              ${record.followUpRemark ? `<div class="mt-1">处理进度：${escapeHtml(record.followUpRemark)}</div>` : ''}
              ${platformRemark ? `<div class="mt-1">处理记录：${escapeHtml(platformRemark)}</div>` : ''}
            </div>
          `
          : ''
      }
    </article>
  `
}

function renderPickupTraceabilitySection(head: PdaHandoverHead, sourceDoc: ReturnType<typeof getPdaHeadSourceExecutionDoc>, runtimeTask: ReturnType<typeof getPdaHeadRuntimeTask>): string {
  return `
    <details class="rounded-lg border bg-card" data-testid="pickup-traceability">
      <summary class="cursor-pointer list-none px-3 py-2 text-sm font-medium">
        <span class="flex items-center justify-between gap-2">
          <span>来源与追溯信息</span>
          <i data-lucide="chevron-down" class="h-4 w-4 text-muted-foreground"></i>
        </span>
      </summary>
      <div class="space-y-3 border-t px-3 py-3">
        <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          ${renderFieldHtmlRow('原始任务', renderPdaHandoverObjectCode({
            objectType: 'PROCESS_DOC',
            objectId: head.rootTaskNo || head.taskNo,
            ...getPdaHandoverProductionRelation(head),
          }))}
          ${sourceDoc?.docNo ? renderFieldHtmlRow('来源执行单', renderPdaHandoverObjectCode({
            objectType: 'WAREHOUSE_DOC',
            objectId: sourceDoc.docNo,
            ...getPdaHandoverProductionRelation(head),
          })) : renderFieldRow('来源执行单', '—')}
          ${renderFieldRow('来源类型', sourceDoc?.docType === 'ISSUE' ? '仓库发料单' : sourceDoc?.docType ? '其他单据' : '—')}
          ${renderFieldRow('交接范围', head.scopeLabel || '整单')}
        ${renderFieldHtmlRow('关联任务号', renderPdaHandoverObjectCode({
          objectType: 'PROCESS_DOC',
          objectId: runtimeTask?.taskNo || runtimeTask?.taskId || head.taskNo,
          ...getPdaHandoverProductionRelation(head),
        }))}
        </div>
      </div>
    </details>
  `
}

function renderPickupHeadDetail(head: PdaHandoverHead): string {
  const records = getPdaPickupRecordsByHead(head.handoverId)
  const isCompleted = head.completionStatus === 'COMPLETED'
  const completionCheck = canCompletePdaPickupHead(head.handoverId)
  const sourceDoc = getPdaHeadSourceExecutionDoc(head.handoverId)
  const runtimeTask = getPdaHeadRuntimeTask(head.handoverId)
  const currentRecord = detailState.selectedPickupRecordId
    ? records.find((record) => record.recordId === detailState.selectedPickupRecordId) ?? records[0]
    : records[0]
  const currentRecordMeta = currentRecord ? getPickupRecordStatusMeta(currentRecord.status) : null
  const currentGuide = currentRecord ? getPickupCurrentGuide(currentRecord) : null
  const partyDisplay = getPickupPartyDisplay(head)
  const postFinishingPickup = isPostFinishingPickupHead(head)
  const showPickupDisputeForm =
    currentRecord &&
    currentRecord.status === 'PENDING_FACTORY_CONFIRM' &&
    detailState.pickupDisputeRecordId === currentRecord.recordId
  const showPickupRejectForm =
    currentRecord &&
    currentRecord.status === 'PENDING_FACTORY_CONFIRM' &&
    detailState.pickupRejectRecordId === currentRecord.recordId

  return `
    ${renderSectionCard(
      '领料单',
      `
      <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        ${renderFieldHtmlRow('任务编号', renderPdaHandoverObjectCode({
          objectType: 'PROCESS_DOC',
          objectId: head.taskNo,
          ...getPdaHandoverProductionRelation(head),
        }))}
        ${renderPdaHandoverSourceIdentity(head)}
        ${renderFieldRow('当前工序', head.processName)}
      </div>
      <div class="h-px bg-border"></div>
      ${renderPartyRow(partyDisplay.sourceLabel, partyDisplay.sourceKind, head.sourceFactoryName)}
      ${renderPartyRow(partyDisplay.targetLabel, partyDisplay.targetKind, head.targetName)}
      <div class="h-px bg-border"></div>
      <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        ${renderFieldRow('累计领料记录', `${head.recordCount} 次`)}
        ${renderFieldRow('待处理记录', `${head.pendingWritebackCount} 次`)}
        ${renderFieldRow('应领总量', `${head.qtyExpectedTotal} ${head.qtyUnit}`)}
        ${renderFieldRow('累计最终确认总量', `${head.qtyActualTotal} ${head.qtyUnit}`)}
      </div>
      <div class="rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs text-blue-700">
        ${
          isCompleted
            ? `领料单已完成；已有领料记录的差异和异议可继续处理。`
            : '完成领料单后不再新增领料记录；已有差异和异议可继续处理。'
        }
      </div>
      <div class="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/20 px-2.5 py-2 text-xs">
        <span>${escapeHtml(isCompleted ? '领料单已完成' : completionCheck.message)}</span>
        ${
          isCompleted
            ? ''
            : `<button type="button" class="inline-flex h-8 items-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90" data-pda-handoverd-action="complete-pickup-head" data-handover-id="${escapeHtml(head.handoverId)}">完成领料单</button>`
        }
      </div>
    `,
    )}

    ${renderSectionCard(
      '当前记录处理区',
      !currentRecord
        ? '<div class="py-4 text-center text-xs text-muted-foreground">当前暂无可处理的领料记录</div>'
        : `
            <div data-testid="pickup-current-panel-card" class="space-y-3 rounded-lg border ${currentGuide?.panelClass || 'border-primary/20 bg-primary/5'} px-3 py-3 shadow-sm">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <p class="text-sm font-semibold">当前处理记录</p>
                <span class="inline-flex items-center rounded border px-2 py-1 text-xs ${currentRecordMeta?.className || ''}">${escapeHtml(currentRecordMeta?.label || '—')}</span>
              </div>
              <p class="text-xs text-muted-foreground">${escapeHtml(currentGuide?.hint || '查看当前记录并继续处理。')}</p>
              ${renderPickupCurrentPanel(currentRecord, showPickupDisputeForm, showPickupRejectForm)}
            </div>
          `,
    )}

    ${renderSectionCard(
      postFinishingPickup ? '车缝厂送达的领料记录' : '仓库已生成的领料记录',
      records.length === 0
        ? `<div class="py-4 text-center text-xs text-muted-foreground">${postFinishingPickup ? '暂无车缝厂送达后的领料记录' : '暂无仓库送料后的领料记录'}</div>`
        : `<div class="space-y-2">${records.map((record) => renderPickupRecordItem(record)).join('')}</div>`,
    )}

    ${renderPickupTraceabilitySection(head, sourceDoc, runtimeTask)}
  `
}

function renderObjectionProofSection(): string {
  return `
    <div class="space-y-2">
      <div class="flex gap-2">
        <button
          type="button"
          class="inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-md border border-dashed text-xs hover:bg-muted"
          data-pda-handoverd-action="add-objection-proof-image"
        >
          <i data-lucide="image" class="h-3.5 w-3.5 text-blue-500"></i>上传图片
        </button>
        <button
          type="button"
          class="inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-md border border-dashed text-xs hover:bg-muted"
          data-pda-handoverd-action="add-objection-proof-video"
        >
          <i data-lucide="video" class="h-3.5 w-3.5 text-purple-500"></i>上传视频
        </button>
      </div>
      ${
        detailState.objectionProofFiles.length === 0
          ? '<div class="text-xs text-muted-foreground">暂无异议凭证（选填）</div>'
          : detailState.objectionProofFiles
              .map(
                (file) => `
                  <div class="flex items-center gap-2 rounded-md border bg-muted/30 px-2.5 py-1.5">
                    <i data-lucide="${file.type === 'IMAGE' ? 'image' : 'video'}" class="h-3.5 w-3.5 ${
                      file.type === 'IMAGE' ? 'text-blue-500' : 'text-purple-500'
                    }"></i>
                    <span class="min-w-0 flex-1 truncate text-xs">${escapeHtml(file.name)}</span>
                    <button
                      type="button"
                      class="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-destructive"
                      data-pda-handoverd-action="remove-objection-proof"
                      data-proof-id="${escapeHtml(file.id)}"
                    >
                      <i data-lucide="trash-2" class="h-3 w-3"></i>
                    </button>
                  </div>
                `,
              )
              .join('')
      }
    </div>
  `
}

function renderHandoutQrBlock(head: PdaHandoverHead, objectTypeLabel: string): string {
  const qrValue = getHandoverOrderQrDisplayValue(head)
  if (!qrValue) return ''

  return `
    <div data-testid="handout-head-qr" class="shrink-0 rounded-md border bg-white p-2">
      ${renderRealQrPlaceholder({
        value: qrValue,
        size: 132,
        title: `交出单二维码 ${head.handoverId}`,
        label: `交出单 ${head.handoverId} 二维码`,
      })}
      <div class="mt-2 space-y-1 text-[11px] leading-tight text-muted-foreground">
        <div>交出单号：${renderPdaHandoverObjectCode({
          objectType: 'HANDOVER_ORDER',
          objectId: head.handoverOrderNo || head.handoverId,
          ...getPdaHandoverProductionRelation(head),
        })}</div>
        <div>任务编号：${renderPdaHandoverObjectCode({
          objectType: 'PROCESS_DOC',
          objectId: head.taskNo,
          ...getPdaHandoverProductionRelation(head),
        })}</div>
        <div>交出物类型：${escapeHtml(objectTypeLabel)}</div>
      </div>
    </div>
  `
}

function renderHandoutRecordInfoChips(lines: string[]): string {
  if (lines.length === 0) {
    return '<div class="text-xs text-muted-foreground">当前暂无可读的交出物明细</div>'
  }

  return `
    <div class="flex flex-wrap gap-1.5">
      ${lines
        .map(
          (line) =>
            `<span class="inline-flex items-center rounded border border-border bg-muted/30 px-2 py-0.5 text-[11px] text-muted-foreground">${escapeHtml(line)}</span>`,
        )
        .join('')}
    </div>
  `
}

function renderCutPiecePartGroups(profile: ReturnType<typeof deriveHandoutRecordProfile>): string {
  const groups = profile.cutPiecePartGroups ?? []
  if (groups.length === 0) {
    return renderHandoutRecordInfoChips(profile.infoLines)
  }

  return `
    <div class="space-y-2" data-testid="cut-piece-part-groups">
      ${groups
        .map(
          (group) => `
            <div data-testid="cut-piece-part-group" class="space-y-2 rounded-md border bg-muted/20 px-2.5 py-2">
              <div class="flex flex-wrap items-center gap-2 text-xs">
                <span class="inline-flex items-center rounded border border-border bg-background px-1.5 py-0 text-[10px]">部位：${escapeHtml(group.partLabel)}</span>
                <span>本次交出裁片片数（片）：<span class="font-medium text-foreground">${group.totalPieceQty} 片</span></span>
                <span>可折算成衣件数（件）：<span class="font-medium text-foreground">${group.totalGarmentEquivalentQty} 件</span></span>
              </div>
              <div class="space-y-1.5">
                ${group.skuLines
                  .map(
                    (line) => `
                      <div data-testid="cut-piece-sku-line" class="grid grid-cols-2 gap-x-4 gap-y-1 rounded-md border bg-background px-2.5 py-2 text-xs">
                        ${renderFieldRow('SKU 编码', line.garmentSkuCode, true)}
                        ${renderFieldRow('颜色 / 尺码', `${line.colorLabel || '—'} / ${line.sizeLabel || '—'}`)}
                        ${renderFieldRow('裁片片数（片）', `${line.pieceQty} 片`, true)}
                        ${renderFieldRow('可折算成衣件数（件）', `${line.garmentEquivalentQty} 件`, true)}
                      </div>
                    `,
                  )
                  .join('')}
              </div>
            </div>
          `,
        )
        .join('')}
    </div>
  `
}

function renderNewHandoutRecordForm(head: PdaHandoverHead): string {
  if (!detailState.newRecordOpen) return ''
  if (head.completionStatus === 'COMPLETED') {
    return '<div class="rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground">交出单已完成，不允许新增交出记录。</div>'
  }
  const waterConfirm = isWaterSolubleHandoverHead(head) ? detailState.waterHandoverConfirm : null
  if (isWaterSolubleHandoverHead(head) && (!waterConfirm || waterConfirm.handoverId !== head.handoverId)) return ''

  return `
    <div class="space-y-3 rounded-md border bg-muted/20 p-3" data-testid="handout-new-record-form">
      <div class="grid gap-3 md:grid-cols-2">
        <div class="space-y-1">
          <span class="text-xs font-medium">交出对象</span>
          <div class="flex h-8 items-center rounded-md border bg-background px-2.5 text-xs font-medium">${escapeHtml(getHandoverObjectTypeLabel(detailState.newRecordObjectType))}</div>
        </div>
        <label class="space-y-1">
          <span class="text-xs font-medium">扫码内容</span>
          <input
            class="h-8 w-full rounded-md border bg-background px-2.5 text-xs"
            value="${escapeAttr(detailState.newRecordScanCode)}"
            placeholder="扫描中转袋 / 菲票 / 交出物码"
            data-pda-handoverd-field="newRecordScanCode"
          />
        </label>
        <label class="space-y-1">
          <span class="text-xs font-medium">本次交出数量</span>
          <input
            class="h-8 w-full rounded-md border bg-background px-2.5 text-xs"
            type="number"
            value="${escapeAttr(detailState.newRecordQty)}"
            placeholder="输入数量"
            data-pda-handoverd-field="newRecordQty"
          />
        </label>
        ${
          isWaterSolubleHandoverHead(head)
            ? `<div class="space-y-1"><span class="text-xs font-medium">单位</span><div data-testid="water-handover-readonly-unit" class="flex h-8 items-center rounded-md border bg-muted/40 px-2.5 text-xs font-medium">${escapeHtml(head.qtyUnit)}</div></div>`
            : `<label class="space-y-1">
                <span class="text-xs font-medium">单位</span>
                <input class="h-8 w-full rounded-md border bg-background px-2.5 text-xs" value="${escapeAttr(detailState.newRecordUnit || head.qtyUnit || '件')}" placeholder="例如：件 / 米 / 片" data-pda-handoverd-field="newRecordUnit" />
              </label>`
        }
      </div>
      <div class="flex justify-end gap-2">
        <button
          class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted"
          data-pda-handoverd-action="cancel-new-handout-record"
        >取消</button>
        <button
          class="inline-flex h-8 items-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          data-pda-handoverd-action="submit-new-handout-record"
          data-handover-id="${escapeHtml(head.handoverId)}"
          ${waterConfirm ? `data-water-handover-confirm-token="${escapeAttr(waterConfirm.token)}"` : ''}
        >确认交出</button>
      </div>
    </div>
  `
}

function renderReceiverWritebackForm(record: PdaHandoverRecord): string {
  if (detailState.writebackRecordId !== record.recordId) return ''

  return `
    <div class="space-y-3 rounded-md border bg-muted/20 p-3" data-testid="handout-writeback-form">
      <div class="grid gap-3 md:grid-cols-2">
        <label class="space-y-1">
          <span class="text-xs font-medium">实收对象数量</span>
          <input
            class="h-8 w-full rounded-md border bg-background px-2.5 text-xs"
            type="number"
            value="${escapeAttr(detailState.writebackQty)}"
            placeholder="请输入实收对象数量"
            data-skip-page-rerender="true"
            data-pda-handoverd-field="writebackQty"
          />
        </label>
        <label class="space-y-1">
          <span class="text-xs font-medium">差异原因</span>
          <input
            class="h-8 w-full rounded-md border bg-background px-2.5 text-xs"
            value="${escapeAttr(detailState.writebackReason)}"
            placeholder="有差异时填写"
            data-pda-handoverd-field="writebackReason"
          />
        </label>
        <label class="space-y-1 md:col-span-2">
          <span class="text-xs font-medium">备注</span>
          <textarea
            class="min-h-[64px] w-full rounded-md border bg-background px-2.5 py-1.5 text-xs"
            placeholder="补充实收说明"
            data-pda-handoverd-field="writebackRemark"
          >${escapeHtml(detailState.writebackRemark)}</textarea>
        </label>
        <label class="space-y-1 md:col-span-2">
          <span class="text-xs font-medium">凭证</span>
          <div class="flex h-8 items-center rounded-md border bg-background px-2.5 text-xs text-muted-foreground">可选，当前原型不限制上传</div>
        </label>
      </div>
      <div data-sewing-sla-writeback-preview="true" data-record-id="${escapeHtml(record.recordId)}">
        ${renderReceiverWritebackSlaPreviewContent(record.recordId)}
      </div>
      <div class="flex justify-end gap-2">
        <button
          class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted"
          data-pda-handoverd-action="cancel-receiver-writeback"
        >取消</button>
        <button
          class="inline-flex h-8 items-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          data-pda-handoverd-action="submit-receiver-writeback"
          data-record-id="${escapeHtml(record.recordId)}"
          data-skip-page-rerender="true"
        >确认收货</button>
      </div>
    </div>
  `
}

export interface ReceiverWritebackSlaPreview {
  readonly confirmedReceivedQty: number
  readonly progressRatio: number
  readonly newlyReachedRatios: readonly number[]
  readonly unit: string
  readonly projection: SewingDeliverySlaProjection
}

function toSewingDeliveryReceipt(record: PdaHandoverRecord): SewingDeliveryReceiptFact | null {
  const submittedQty = record.submittedQty ?? record.plannedQty
  if (
    typeof submittedQty !== 'number'
    || !Number.isFinite(submittedQty)
    || submittedQty < 0
    || typeof record.receiverWrittenQty !== 'number'
    || !Number.isFinite(record.receiverWrittenQty)
    || record.receiverWrittenQty < 0
    || !record.receiverWrittenAt
  ) return null
  return {
    recordId: record.handoverRecordId || record.recordId,
    submittedQty,
    submittedAt: record.factorySubmittedAt,
    receivedQty: record.receiverWrittenQty,
    receivedAt: record.receiverWrittenAt,
    voided: record.handoverRecordStatus === 'VOIDED',
  }
}

export function buildReceiverWritebackSlaPreview(
  recordId: string,
  receiverWrittenQty: number,
  confirmedAt: string,
): ReceiverWritebackSlaPreview | null {
  if (!Number.isFinite(receiverWrittenQty) || receiverWrittenQty < 0) return null
  const record = findPdaHandoverRecord(recordId)
  const runtimeTaskId = record?.taskId || record?.sourceTaskId
  const snapshot = runtimeTaskId ? getSewingDeliverySlaSnapshot(runtimeTaskId) : null
  if (!record || !runtimeTaskId || !snapshot?.active) return null
  const records = listHandoverOrdersByTaskId(runtimeTaskId)
    .flatMap((head) => getPdaHandoverRecordsByHead(head.handoverId))
  const baseReceipts = records
    .map(toSewingDeliveryReceipt)
    .filter((receipt): receipt is SewingDeliveryReceiptFact => receipt !== null)
  const receiptsWithoutCurrent = baseReceipts.filter((receipt) => receipt.recordId !== (record.handoverRecordId || record.recordId))
  const baseProjection = projectSewingDeliverySla(snapshot, receiptsWithoutCurrent, confirmedAt)
  const submittedQty = record.submittedQty ?? record.plannedQty ?? 0
  const previewProjection = projectSewingDeliverySla(snapshot, [
    ...receiptsWithoutCurrent,
    {
      recordId: record.handoverRecordId || record.recordId,
      submittedQty,
      submittedAt: record.factorySubmittedAt,
      receivedQty: receiverWrittenQty,
      receivedAt: confirmedAt,
    },
  ], confirmedAt)
  const newlyReachedRatios = previewProjection.milestones
    .filter((milestone, index) => milestone.firstReachedAt && !baseProjection.milestones[index]?.firstReachedAt)
    .map((milestone) => milestone.ratio)
  return Object.freeze({
    confirmedReceivedQty: previewProjection.confirmedReceivedQty,
    progressRatio: previewProjection.progressRatio,
    newlyReachedRatios: Object.freeze(newlyReachedRatios),
    unit: record.qtyUnit || '件',
    projection: previewProjection,
  })
}

export function renderReceiverWritebackSlaPreview(
  recordId: string,
  receiverWrittenQty: number,
  confirmedAt: string,
): string {
  const preview = buildReceiverWritebackSlaPreview(recordId, receiverWrittenQty, confirmedAt)
  if (!preview) return ''
  const impact = preview.newlyReachedRatios.length > 0
    ? `本次将达到 ${preview.newlyReachedRatios.map((ratio) => `${ratio * 100}%`).join('、')} 节点`
    : '本次不会新增达标节点'
  return `
    <div class="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
      <div class="font-medium">确认后累计实收 ${preview.confirmedReceivedQty} ${escapeHtml(preview.unit)} · ${Math.round(preview.progressRatio * 1000) / 10}%</div>
      <div class="mt-1">节点影响：${escapeHtml(impact)}</div>
    </div>
  `
}

function renderReceiverWritebackSlaPreviewContent(recordId: string): string {
  if (!detailState.writebackPreviewConfirmedAt) return ''
  return `${renderReceiverWritebackSlaPreview(recordId, Number(detailState.writebackQty), detailState.writebackPreviewConfirmedAt)}<div class="mt-1 text-xs text-muted-foreground">预估确认时间：${escapeHtml(detailState.writebackPreviewConfirmedAt)}；提交时按实际时间重新计算</div>`
}

function refreshReceiverWritebackSlaPreview(recordId: string): void {
  if (typeof document === 'undefined') return
  const host = document.querySelector<HTMLElement>(`[data-sewing-sla-writeback-preview][data-record-id="${escapeCssAttributeValue(recordId)}"]`)
  if (!host) return
  host.innerHTML = renderReceiverWritebackSlaPreviewContent(recordId)
}

function renderHandoverSlaSummary(taskId: string, unit: string): string {
  const view = getSewingDeliverySlaView(taskId)
  if (!view) return ''
  return `<div class="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700" data-sewing-sla-handover-summary="${escapeHtml(taskId)}">累计已确认实收 ${view.confirmedReceivedQty} ${escapeHtml(unit)} · ${Math.round(view.projection.progressRatio * 1000) / 10}%</div>`
}

function escapeCssAttributeValue(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(value)
  return value.replace(/[\\"]/g, (character) => `\\${character}`)
}

function renderHandoutHeadLiveSummary(head: PdaHandoverHead): string {
  const unit = head.qtyUnit || '件'
  return `<div class="rounded-md border bg-muted/20 px-3 py-2 text-xs" data-handout-head-live-summary="${escapeHtml(head.handoverId)}"><div class="grid grid-cols-3 gap-2"><div><span class="text-muted-foreground">累计实收</span><div class="font-medium">${head.writtenBackQtyTotal} ${escapeHtml(unit)}</div></div><div><span class="text-muted-foreground">待收货</span><div class="font-medium">${head.pendingWritebackCount} 条</div></div><div><span class="text-muted-foreground">累计差异</span><div class="font-medium">${head.qtyDiffTotal} ${escapeHtml(unit)}</div></div></div>${detailState.writebackSyncWarning ? `<div class="mt-2 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-amber-700">${escapeHtml(detailState.writebackSyncWarning)}，请叫主管处理。</div>` : ''}</div>`
}

function refreshHandoutRecordAndSlaSummary(updated: PdaHandoverRecord): void {
  if (typeof document === 'undefined') return
  const head = findPdaHandoverHead(updated.handoverId)
  if (!head) return
  const recordHost = document.querySelector<HTMLElement>(`[data-handout-record-id="${escapeCssAttributeValue(updated.recordId)}"]`)
  if (recordHost) {
    recordHost.outerHTML = renderHandoutRecordItem(
      updated,
      head,
      getPdaHeadRuntimeTask(head.handoverId),
      getPdaHeadSourceExecutionDoc(head.handoverId),
    )
  }
  const taskId = updated.taskId || updated.sourceTaskId
  const summaryHost = taskId
    ? document.querySelector<HTMLElement>(`[data-sewing-sla-handover-summary="${escapeCssAttributeValue(taskId)}"]`)
    : null
  if (summaryHost && taskId) summaryHost.outerHTML = renderHandoverSlaSummary(taskId, updated.qtyUnit || '件')
  const currentHead = findPdaHandoverHead(updated.handoverId)
  const headSummaryHost = document.querySelector<HTMLElement>(`[data-handout-head-live-summary="${escapeCssAttributeValue(updated.handoverId)}"]`)
  if (currentHead && headSummaryHost) headSummaryHost.outerHTML = renderHandoutHeadLiveSummary(currentHead)
}

function renderHandoutRecordItem(
  record: PdaHandoverRecord,
  head: PdaHandoverHead,
  runtimeTask: ReturnType<typeof getPdaHeadRuntimeTask>,
  sourceDoc: ReturnType<typeof getPdaHeadSourceExecutionDoc>,
): string {
  const demoRole = resolveFcsDemoRole('FACTORY')
  const meta = getRecordStatusMeta(record.status)
  const profile = deriveHandoutRecordProfile(record, head, runtimeTask, sourceDoc)
  const receiverWrittenQty = getRecordReceiverWrittenQty(record)
  const receiverWrittenAt = getRecordReceiverWrittenAt(record)
  const diffQty = getRecordDiffQty(record)
  const canWriteback = canReceiverWriteback(record) && canReceiverWritebackAction(demoRole)
  const canDiff = canHandleDiff(record) && canAcceptDiffAction(demoRole)
  const canObjection = canHandleDiff(record) && canRaiseQuantityObjection(demoRole)
  const showObjectionForm = detailState.objectionRecordId === record.recordId && canObjection
  const qrValue = getHandoverRecordQrDisplayValue(record)
  const linkedOutboundRecord = getLinkedOutboundRecord(record.handoverRecordId || record.recordId)
  const linkedOutboundLabel = linkedOutboundRecord?.outboundRecordNo || '未出库'
  const linkedOutboundHref = linkedOutboundRecord ? buildOutboundRecordRoute(record.handoverRecordId || record.recordId) : ''
  const sewingDispatch = getCuttingSewingDispatchByHandoverRecordId(record.handoverRecordId || record.recordId)
  const sewingBatch = sewingDispatch.dispatchBatch
  const sewingBags = sewingDispatch.transferBags
  const sewingPieceQty = sewingBags
    .flatMap((bag) => bag.pieceLines)
    .reduce((total, line) => total + line.scannedPieceQty, 0)
  const handoverRecordId = record.handoverRecordId || record.recordId
  const returnBindings = getSpecialCraftReturnBindingsByHandoverRecordId(handoverRecordId)
  const specialCraftTicketNos =
    returnBindings.length > 0
      ? returnBindings.map((binding) => binding.feiTicketNo)
      : record.cutPieceLines?.map((line) => line.feiTicketNo).filter(Boolean) || []
  const specialCraftSummary = renderSpecialCraftTicketSummary(specialCraftTicketNos)

  return `
    <article data-testid="handout-record-card" data-handout-record-id="${escapeHtml(record.recordId)}" class="space-y-2 rounded-lg border bg-card p-3">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="flex items-center gap-2">
          <span class="inline-flex items-center rounded border border-border bg-muted px-1.5 py-0 text-[10px]">第 ${record.sequenceNo} 次交出</span>
          <span class="inline-flex items-center rounded border px-1.5 py-0 text-[10px] ${meta.className}">${escapeHtml(meta.label)}</span>
        </div>
        <span class="text-[11px] text-muted-foreground">工厂提交时间：${escapeHtml(record.factorySubmittedAt)}</span>
      </div>

      <div class="space-y-2 text-xs">
        <div class="flex flex-wrap items-center gap-1.5">
          <span class="inline-flex items-center rounded border border-border bg-muted px-1.5 py-0 text-[10px]">${escapeHtml(profile.objectTypeLabel)}</span>
          <span class="font-medium">${escapeHtml(profile.itemTitle)}</span>
          ${
            profile.objectType === 'CUT_PIECE' && profile.cutPieceRecordSummary
              ? `
                <span class="inline-flex items-center rounded border border-border bg-background px-1.5 py-0 text-[10px]">涉及部位：${profile.cutPieceRecordSummary.involvedPartCount} 种</span>
                <span class="inline-flex items-center rounded border border-border bg-background px-1.5 py-0 text-[10px]">涉及 SKU：${profile.cutPieceRecordSummary.involvedSkuCount} 个</span>
              `
              : ''
          }
          ${
            typeof profile.garmentEquivalentQty === 'number'
              ? `<span class="inline-flex items-center rounded border border-blue-200 bg-blue-50 px-1.5 py-0 text-[10px] text-blue-700">可折算成衣件数（件）：${profile.garmentEquivalentQty} 件</span>`
              : ''
          }
        </div>
        ${profile.objectType === 'CUT_PIECE' ? renderCutPiecePartGroups(profile) : renderHandoutRecordInfoChips(profile.infoLines)}
      </div>

      <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        ${renderFieldRow('交出记录号', record.handoverRecordNo || record.recordId, true)}
        ${renderFieldRow('状态', getHandoverRecordStatusLabel(record.handoverRecordStatus || record.status))}
        ${renderFieldRow('交出对象数量', `${record.submittedQty ?? record.plannedQty ?? 0} ${record.qtyUnit}`, true)}
        ${renderFieldRow('实收对象数量', typeof receiverWrittenQty === 'number' ? `${receiverWrittenQty} ${record.qtyUnit}` : '待收货确认', true)}
        ${renderFieldRow('差异', typeof diffQty === 'number' ? `${diffQty > 0 ? '+' : ''}${diffQty} ${record.qtyUnit}` : '待收货确认', typeof diffQty === 'number' && diffQty !== 0)}
        ${renderFieldRow('接收方确认时间', receiverWrittenAt || '待收货确认')}
        ${renderFieldRow('工厂提交时间', record.factorySubmittedAt)}
        ${renderFieldRow('出库记录', linkedOutboundLabel, Boolean(linkedOutboundRecord))}
        ${renderFieldRow('备注', record.receiverRemark || record.factoryRemark || '—')}
      </div>

      ${renderCuttingHandoverSummaryPanel(record)}

      ${
        sewingBatch
          ? `
            <div class="rounded-md border border-blue-200 bg-blue-50 p-2 text-xs text-blue-800">
              <div class="mb-1 font-medium">交出单</div>
              <div class="grid grid-cols-2 gap-x-4 gap-y-1">
                ${renderFieldRow('中转单', sewingBatch.transferOrderNo, true)}
                ${renderFieldRow('中转袋', sewingBags.map((bag) => bag.transferBagNo).join('、') || '—', true)}
                ${renderFieldRow('菲票数', `${sewingBatch.feiTicketNos.length} 张`)}
                ${renderFieldRow('本次交出件数', `${sewingBatch.plannedGarmentQty} 件`)}
                ${renderFieldRow('裁片数量', `${sewingPieceQty} 片`)}
                ${renderFieldRow('车缝厂实收', typeof sewingBatch.receiverWrittenQty === 'number' ? `${sewingBatch.receiverWrittenQty} 件` : '待收货确认')}
              </div>
              <div class="mt-2 flex flex-wrap gap-2">
                <button type="button" class="rounded border bg-white px-2 py-1 text-[11px] text-blue-700 hover:bg-blue-100" data-nav="/fcs/craft/cutting/warehouse-management/wait-handover?tab=handoverOrders">查看交出单</button>
                <button type="button" class="rounded border bg-white px-2 py-1 text-[11px] text-blue-700 hover:bg-blue-100" data-nav="/fcs/craft/cutting/transfer-bags">查看中转袋</button>
              </div>
            </div>
          `
          : ''
      }

      ${renderTransferBagMobilePanel(record)}

      ${specialCraftSummary}

      <div class="flex items-center justify-between gap-3 text-xs">
        <span class="text-muted-foreground">出库记录</span>
        ${
          linkedOutboundRecord
            ? `<button type="button" class="text-blue-700 hover:underline" data-nav="${escapeAttr(linkedOutboundHref)}">${escapeHtml(linkedOutboundLabel)}</button>`
            : '<span class="font-medium">未出库</span>'
        }
      </div>

      <div data-testid="handover-record-qr" class="flex flex-wrap items-start justify-between gap-2 rounded-md border bg-white p-2">
        <div>
          <p class="text-[11px] font-medium text-muted-foreground">交出记录二维码</p>
          <p class="mt-1 text-[11px] text-muted-foreground">记录号：${escapeHtml(record.handoverRecordNo || record.recordId)}</p>
        </div>
        ${renderRealQrPlaceholder({
          value: qrValue,
          size: 88,
          title: `交出记录二维码 ${record.recordId}`,
          label: `交出记录 ${record.recordId} 二维码`,
        })}
      </div>

      ${
        record.objectionReason
          ? `
            <div class="rounded-md border border-red-200 bg-red-50 px-2.5 py-2 text-xs text-red-700">
              <div>异议原因：${escapeHtml(record.objectionReason)}</div>
              ${record.objectionRemark ? `<div class="mt-1">异议记录：${escapeHtml(record.objectionRemark)}</div>` : ''}
              ${record.followUpRemark ? `<div class="mt-1">平台跟进：${escapeHtml(record.followUpRemark)}</div>` : ''}
              ${record.resolvedRemark ? `<div class="mt-1">处理结果：${escapeHtml(record.resolvedRemark)}</div>` : ''}
            </div>
          `
          : ''
      }

      ${
        canWriteback
          ? '<div class="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-700">当前等待接收方确认实收对象数量。</div>'
          : ''
      }

      <div class="flex flex-wrap items-center justify-end gap-2">
        ${
          canWriteback
            ? `
              <button
                class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted"
                data-pda-handoverd-action="open-receiver-writeback"
                data-record-id="${escapeHtml(record.recordId)}"
              >确认收货</button>
            `
            : ''
        }
        ${
          canDiff
            ? `
              <button
                class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted"
                data-pda-handoverd-action="accept-record-diff"
                data-record-id="${escapeHtml(record.recordId)}"
              >接受差异</button>
            `
            : ''
        }
        ${
          canObjection
            ? `
              <button
                class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted"
                data-pda-handoverd-action="open-record-objection"
                data-record-id="${escapeHtml(record.recordId)}"
              >发起异议</button>
            `
            : ''
        }
      </div>

      ${renderReceiverWritebackForm(record)}

      ${
        showObjectionForm
          ? `
            <div class="space-y-2 rounded-md border bg-muted/20 p-3">
              <div class="space-y-1">
                <label class="text-xs font-medium">异议原因 *</label>
                <input
                  class="h-8 w-full rounded-md border bg-background px-2.5 text-xs"
                  placeholder="例如：实收对象与工厂交接单不一致"
                  value="${escapeHtml(detailState.objectionReason)}"
                  data-pda-handoverd-field="objectionReason"
                />
              </div>
              <div class="space-y-1">
                <label class="text-xs">异议说明</label>
                <textarea
                  class="min-h-[64px] w-full rounded-md border bg-background px-2.5 py-1.5 text-xs"
                  placeholder="可补充差异明细或现场说明"
                  data-pda-handoverd-field="objectionRemark"
                >${escapeHtml(detailState.objectionRemark)}</textarea>
              </div>
              ${renderObjectionProofSection()}
              <div class="flex justify-end gap-2">
                <button
                  class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted"
                  data-pda-handoverd-action="cancel-record-objection"
                >取消</button>
                <button
                  class="inline-flex h-8 items-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                  data-pda-handoverd-action="submit-record-objection"
                  data-record-id="${escapeHtml(record.recordId)}"
                >确认发起异议</button>
              </div>
            </div>
          `
          : ''
      }
    </article>
  `
}

function renderHandoutHeadDetail(head: PdaHandoverHead): string {
  const waterAccess = isWaterSolubleHandoverHead(head) ? getWaterHandoverAccess(head) : null
  const canCreateRecord = waterAccess ? waterAccess.ok : canCreateHandoverRecord(resolveFcsDemoRole('FACTORY'))
  const isCompleted = head.completionStatus === 'COMPLETED'
  const completionCheck = canCompletePdaHandoutHead(head.handoverId)
  const records = getPdaHandoverRecordsByHead(head.handoverId)
  const sourceDoc = getPdaHeadSourceExecutionDoc(head.handoverId)
  const runtimeTask = getPdaHeadRuntimeTask(head.handoverId)
  const profile = deriveHandoutObjectProfile(head, records, runtimeTask, sourceDoc)
  const detailLines = profile.objectInfoLines.length
    ? profile.objectInfoLines
        .map((line) => `<div class="truncate">${escapeHtml(line)}</div>`)
        .join('')
    : '<div>当前暂无交出记录</div>'

  return `
    ${renderHandoverSlaSummary(head.taskId, head.qtyUnit || '件')}
    ${renderHandoutHeadLiveSummary(head)}
    ${renderSectionCard(
      '交出单',
      `
      <div class="flex flex-col gap-3 lg:flex-row">
        <div class="min-w-0 flex-1 space-y-2.5">
          <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            ${renderFieldHtmlRow('任务编号', renderPdaHandoverObjectCode({
              objectType: 'PROCESS_DOC',
              objectId: head.taskNo,
              ...getPdaHandoverProductionRelation(head),
            }))}
            ${renderFieldHtmlRow('交出单号', renderPdaHandoverObjectCode({
              objectType: 'HANDOVER_ORDER',
              objectId: head.handoverOrderNo || head.handoverId,
              ...getPdaHandoverProductionRelation(head),
            }))}
            ${renderFieldHtmlRow('原始任务', renderPdaHandoverObjectCode({
              objectType: 'PROCESS_DOC',
              objectId: head.rootTaskNo || head.taskNo,
              ...getPdaHandoverProductionRelation(head),
            }))}
            ${renderPdaHandoverSourceIdentity(head)}
            ${renderFieldRow('当前工序', head.processName)}
            ${renderFieldRow('状态', getHandoverOrderStatusLabel(head.handoverOrderStatus || head.status))}
          </div>
          <div class="h-px bg-border"></div>
          ${renderPartyRow('交出工厂', 'FACTORY', head.sourceFactoryName)}
          ${renderPartyRow('接收方', head.targetKind, getReceiverDisplayName(head))}
          <div class="h-px bg-border"></div>
          <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            ${sourceDoc?.docNo ? renderFieldHtmlRow('来源执行单', renderPdaHandoverObjectCode({
              objectType: 'WAREHOUSE_DOC',
              objectId: sourceDoc.docNo,
              ...getPdaHandoverProductionRelation(head),
            })) : renderFieldRow('来源执行单', '—')}
            ${renderFieldRow('来源类型', head.sourceBusinessType === 'WATER_SOLUBLE_WORK_ORDER' ? '水溶加工单' : head.sourceBusinessType === 'DYE_WORK_ORDER' ? '染色加工单' : sourceDoc?.docType === 'RETURN' ? '工序回货单' : sourceDoc?.docType ? '其他单据' : '—')}
            ${head.sourceBusinessType === 'WATER_SOLUBLE_WORK_ORDER' ? renderFieldRow('物料', `${head.materialName || '—'} / ${head.materialCode || '—'}`) : ''}
            ${renderFieldRow('交接范围', head.scopeLabel || '整单')}
            ${renderFieldHtmlRow('关联任务号', renderPdaHandoverObjectCode({
              objectType: 'PROCESS_DOC',
              objectId: runtimeTask?.taskNo || runtimeTask?.taskId || head.taskNo,
              ...getPdaHandoverProductionRelation(head),
            }))}
          </div>
        </div>
        ${renderHandoutQrBlock(head, profile.objectTypeLabel)}
      </div>
      <div class="h-px bg-border"></div>
      <div data-testid="handout-head-object-profile" class="space-y-2 rounded-md border bg-muted/20 px-2.5 py-2 text-xs">
        <div class="flex flex-wrap items-center gap-1.5">
          <span class="inline-flex items-center rounded border border-border bg-background px-1.5 py-0 text-[10px]">交出物类型：${escapeHtml(profile.objectTypeLabel)}</span>
          ${
            profile.objectType === 'CUT_PIECE' && profile.cutPieceRecordSummary
              ? `
                <span class="inline-flex items-center rounded border border-border bg-background px-1.5 py-0 text-[10px]">涉及部位：${profile.cutPieceRecordSummary.involvedPartCount} 种</span>
                <span class="inline-flex items-center rounded border border-border bg-background px-1.5 py-0 text-[10px]">涉及 SKU：${profile.cutPieceRecordSummary.involvedSkuCount} 个</span>
              `
              : ''
          }
          ${
            typeof profile.garmentEquivalentQtyTotal === 'number'
              ? `<span class="inline-flex items-center rounded border border-blue-200 bg-blue-50 px-1.5 py-0 text-[10px] text-blue-700">可折算成衣件数（件）：${profile.garmentEquivalentQtyTotal} 件</span>`
              : ''
          }
        </div>
        <div class="space-y-0.5 text-muted-foreground">${detailLines}</div>
        <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          ${renderFieldRow(profile.primaryQtyLabel, `${profile.totalPlannedQty} ${profile.displayUnit}`, true)}
          ${renderFieldRow(profile.writtenQtyLabel, `${profile.totalWrittenQty} ${profile.displayUnit}`, true)}
          ${renderFieldRow(profile.pendingQtyLabel, `${profile.totalPendingQty} ${profile.displayUnit}`, true)}
          ${renderFieldRow('数量异议', `${head.objectionCount} 条`)}
          ${renderFieldRow('累计交出次数', `${head.recordCount} 次`)}
          ${renderFieldRow('待收货', `${head.pendingWritebackCount} 条`)}
        </div>
      </div>
      <div class="rounded-md border ${head.qtyDiffTotal !== 0 ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'} px-2.5 py-1.5 text-xs">
        ${head.qtyDiffTotal !== 0 ? `数量有差异（差异 ${head.qtyDiffTotal > 0 ? '-' : '+'}${Math.abs(head.qtyDiffTotal)} ${profile.displayUnit}）` : '数量一致'}
      </div>
      <div class="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/20 px-2.5 py-2 text-xs">
        <span>${escapeHtml(isCompleted ? '交出单已完成；接收方收货确认和异议仍可继续' : completionCheck.message)}</span>
        ${
          isCompleted || (waterAccess !== null && !waterAccess.ok)
            ? ''
            : `<button type="button" class="inline-flex h-8 items-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90" data-pda-handoverd-action="complete-handout-head" data-handover-id="${escapeHtml(head.handoverId)}">完成交出单</button>`
        }
      </div>
      <div class="flex flex-wrap items-center justify-between gap-2 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs text-blue-700">
        <span>交出记录</span>
        ${
          waterAccess !== null && !waterAccess.ok
            ? ''
            : `<button class="inline-flex h-7 items-center rounded-md border border-blue-200 bg-white px-2.5 text-xs text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50" data-pda-handoverd-action="open-new-handout-record" data-handover-id="${escapeHtml(head.handoverId)}" ${canCreateRecord && !isCompleted ? '' : `title="${isCompleted ? '交出单已完成，不允许新增交出记录' : ACTION_PERMISSION_DENIED_TEXT}" disabled`}>新增交出记录</button>`
        }
      </div>
      ${waterAccess && !waterAccess.ok ? `<div data-testid="water-handover-access-denied" class="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-700">${escapeHtml(waterAccess.message)}</div>` : ''}
      ${renderNewHandoutRecordForm(head)}
    `,
    )}

    ${renderSectionCard(
      '交出记录列表',
      records.length === 0
        ? '<div class="py-4 text-center text-xs text-muted-foreground">当前暂无交出记录</div>'
        : `<div class="space-y-2">${records.map((record) => renderHandoutRecordItem(record, head, runtimeTask, sourceDoc)).join('')}</div>`,
    )}
  `
}

export function renderPdaHandoverDetailPage(eventId: string): string {
  const head = findPdaHandoverHead(eventId)

  if (!head) {
    const content = `
      <div class="space-y-4 p-4">
        <button class="inline-flex h-8 items-center rounded-md px-2 text-sm text-muted-foreground hover:bg-muted" data-pda-handoverd-action="back">
          <i data-lucide="arrow-left" class="mr-2 h-4 w-4"></i>返回
        </button>
        <article class="rounded-lg border bg-card py-8 text-center text-sm text-muted-foreground">未找到交接单</article>
      </div>
    `
    return renderPdaFrame(content, 'handover')
  }

  const runtime = getPdaRuntimeContext()
  if (
    runtime?.factoryId === FULL_CAPABILITY_FACTORY_ID
    && head.processBusinessCode !== 'POST_FINISHING'
    && head.factoryId !== runtime.factoryId
  ) {
    const content = `
      <div class="space-y-4 p-4">
        <button class="inline-flex h-8 items-center rounded-md px-2 text-sm text-muted-foreground hover:bg-muted" data-pda-handoverd-action="back">
          <i data-lucide="arrow-left" class="mr-2 h-4 w-4"></i>返回
        </button>
        <article class="rounded-lg border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
          当前工厂为后道工厂，只能处理后道交接单。
        </article>
      </div>
    `
    return renderPdaFrame(content, 'handover')
  }

  const pathname = appStore.getState().pathname || ''
  const handoutStateKey = `head:${head.handoverId}|${pathname}`
  const shouldAutoOpenNewRecord = head.headType === 'HANDOUT'
    && !isWaterSolubleHandoverHead(head)
    && detailState.initializedKey !== handoutStateKey
    && getCurrentDetailQueryAction() === 'new-record'

  if (head.headType === 'PICKUP') {
    syncPickupState(head)
  } else {
    syncHandoutState(head.handoverId)
    if (shouldAutoOpenNewRecord) {
      const records = getPdaHandoverRecordsByHead(head.handoverId)
      const runtimeTask = getPdaHeadRuntimeTask(head.handoverId)
      const sourceDoc = getPdaHeadSourceExecutionDoc(head.handoverId)
      const profile = deriveHandoutObjectProfile(head, records, runtimeTask, sourceDoc)
      detailState.newRecordOpen = true
      detailState.newRecordObjectType =
        profile.objectType === 'GARMENT' ? 'FINISHED_GARMENT' : profile.objectType
      detailState.newRecordScanCode = ''
      detailState.newRecordUnit = profile.displayUnit || head.qtyUnit || '件'
    }
  }

  const content = `
    <div class="space-y-3 bg-background p-4 pb-6">
      <div class="flex items-center justify-between">
        <button
          class="inline-flex h-8 items-center rounded-md px-2 text-sm hover:bg-muted"
          data-pda-handoverd-action="back"
        >
          <i data-lucide="arrow-left" class="mr-2 h-4 w-4"></i>返回
        </button>
        <div class="flex items-center gap-2">
          <span class="text-sm font-semibold">${escapeHtml(head.headType === 'PICKUP' ? '领料详情' : '交出单详情')}</span>
        </div>
        <div class="w-16"></div>
      </div>

      <div class="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2 text-sm">
        <span class="inline-flex items-center gap-1">
          <i data-lucide="${head.headType === 'PICKUP' ? 'warehouse' : 'factory'}" class="h-3.5 w-3.5 text-muted-foreground"></i>
          <span class="text-muted-foreground">${escapeHtml(head.sourceFactoryName)}</span>
        </span>
        <i data-lucide="arrow-right" class="h-4 w-4 shrink-0 text-muted-foreground"></i>
        <span class="inline-flex items-center gap-1">
          <i data-lucide="${head.targetKind === 'WAREHOUSE' ? 'warehouse' : 'factory'}" class="h-3.5 w-3.5 text-primary"></i>
          <span class="font-medium text-primary">${escapeHtml(getReceiverDisplayName(head))}</span>
        </span>
      </div>

      ${head.headType === 'PICKUP' ? renderPickupHeadDetail(head) : renderHandoutHeadDetail(head)}
    </div>
  `

  return renderPdaFrame(content, 'handover')
}

export function handlePdaHandoverDetailEvent(target: HTMLElement): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-pda-handoverd-field]')
  if (
    fieldNode instanceof HTMLInputElement ||
    fieldNode instanceof HTMLTextAreaElement ||
    fieldNode instanceof HTMLSelectElement
  ) {
    const field = fieldNode.dataset.pdaHandoverdField
    if (!field) return true

    if (field === 'pickupDisputeQty') {
      detailState.pickupDisputeQty = fieldNode.value
      return true
    }

    if (field === 'pickupDisputeReason') {
      detailState.pickupDisputeReason = fieldNode.value
      return true
    }

    if (field === 'pickupDisputeRemark') {
      detailState.pickupDisputeRemark = fieldNode.value
      return true
    }

    if (field === 'pickupRejectReason') {
      detailState.pickupRejectReason = fieldNode.value
      return true
    }

    if (field === 'pickupRejectRemark') {
      detailState.pickupRejectRemark = fieldNode.value
      return true
    }

    if (field === 'objectionReason') {
      detailState.objectionReason = fieldNode.value
      return true
    }

    if (field === 'objectionRemark') {
      detailState.objectionRemark = fieldNode.value
      return true
    }

    if (
      field === 'newRecordObjectType' &&
      fieldNode instanceof HTMLSelectElement &&
      ['MATERIAL', 'FABRIC', 'CUT_PIECE', 'SEMI_FINISHED_GARMENT', 'FINISHED_GARMENT'].includes(fieldNode.value)
    ) {
      detailState.newRecordObjectType = fieldNode.value as PdaHandoverDetailState['newRecordObjectType']
      return true
    }

    if (field === 'newRecordQty') {
      detailState.newRecordQty = fieldNode.value
      return true
    }

    if (field === 'newRecordScanCode') {
      detailState.newRecordScanCode = fieldNode.value
      return true
    }

    if (field === 'newRecordUnit') {
      if (detailState.waterHandoverConfirm) {
        showPdaHandoverDetailToast('水溶交出单位来自原 BOM，不能修改。')
        return true
      }
      detailState.newRecordUnit = fieldNode.value
      return true
    }

    if (field === 'newRecordRemark') {
      detailState.newRecordRemark = fieldNode.value
      return true
    }

    if (field === 'writebackQty') {
      detailState.writebackQty = fieldNode.value
      const receiverWrittenQty = Number(fieldNode.value)
      detailState.writebackPreviewConfirmedAt = Number.isFinite(receiverWrittenQty) && receiverWrittenQty >= 0
        ? receiverWritebackNowProvider()
        : ''
      const record = detailState.writebackRecordId
        ? findPdaHandoverRecord(detailState.writebackRecordId)
        : undefined
      if (record) refreshReceiverWritebackSlaPreview(record.recordId)
      return true
    }

    if (field === 'writebackReason') {
      detailState.writebackReason = fieldNode.value
      return true
    }

    if (field === 'writebackRemark') {
      detailState.writebackRemark = fieldNode.value
      return true
    }
  }

  const actionNode = target.closest<HTMLElement>('[data-pda-handoverd-action]')
  if (!actionNode) return false

  const action = actionNode.dataset.pdaHandoverdAction
  if (!action) return false

  if (action === 'back') {
    appStore.navigate('/fcs/pda/handover')
    return true
  }

  if (action === 'complete-pickup-head') {
    const handoverId = actionNode.dataset.handoverId
    if (!handoverId) return true
    const result = markPdaPickupHeadCompleted(handoverId, nowTimestamp())
    showPdaHandoverDetailToast(result.message)
    return true
  }

  if (action === 'complete-handout-head') {
    const handoverId = actionNode.dataset.handoverId
    if (!handoverId) return true
    const head = findPdaHandoverHead(handoverId)
    if (isWaterSolubleHandoverHead(head)) {
      const access = getWaterHandoverAccess(head)
      if (!access.ok) {
        showPdaHandoverDetailToast(access.message)
        return true
      }
    }
    const result = markPdaHandoutHeadCompleted(handoverId, nowTimestamp())
    showPdaHandoverDetailToast(result.message)
    return true
  }

  if (action === 'add-objection-proof-image' || action === 'add-objection-proof-video') {
    const type = action === 'add-objection-proof-image' ? 'IMAGE' : 'VIDEO'
    addObjectionProofFile(type)
    showPdaHandoverDetailToast(type === 'IMAGE' ? '异议图片已添加' : '异议视频已添加')
    return true
  }

  if (action === 'remove-objection-proof') {
    const proofId = actionNode.dataset.proofId
    if (proofId) {
      removeObjectionProofFile(proofId)
    }
    return true
  }

  if (action === 'add-pickup-dispute-proof-image' || action === 'add-pickup-dispute-proof-video') {
    const type = action === 'add-pickup-dispute-proof-image' ? 'IMAGE' : 'VIDEO'
    const ext = type === 'IMAGE' ? 'jpg' : 'mp4'
    const index = detailState.pickupDisputeProofFiles.length + 1
    detailState.pickupDisputeProofFiles = [
      ...detailState.pickupDisputeProofFiles,
      {
        id: `pdf-${Date.now()}`,
        type,
        name: `领料差异凭证_${String(index).padStart(2, '0')}.${ext}`,
        uploadedAt: nowDisplayTimestamp(),
      },
    ]
    showPdaHandoverDetailToast(type === 'IMAGE' ? '差异图片已添加' : '差异视频已添加')
    return true
  }

  if (action === 'remove-pickup-dispute-proof') {
    const proofId = actionNode.dataset.proofId
    if (proofId) {
      detailState.pickupDisputeProofFiles = detailState.pickupDisputeProofFiles.filter((file) => file.id !== proofId)
    }
    return true
  }

  if (action === 'open-new-handout-record') {
    const handoverId = actionNode.dataset.handoverId
    const head = handoverId ? findPdaHandoverHead(handoverId) : undefined
    if (!head || head.headType !== 'HANDOUT') {
      showPdaHandoverDetailToast('未找到交出单')
      return true
    }
    if (head.completionStatus === 'COMPLETED') {
      showPdaHandoverDetailToast('交出单已完成，不允许新增交出记录')
      return true
    }
    if (isWaterSolubleHandoverHead(head)) {
      const opened = openWaterHandoverConfirm(head)
      if (!opened.ok) {
        showPdaHandoverDetailToast(opened.message)
        return true
      }
    } else if (!canCreateHandoverRecord(resolveFcsDemoRole('FACTORY'))) {
      showPdaHandoverDetailToast(ACTION_PERMISSION_DENIED_TEXT)
      return true
    }
    const records = getPdaHandoverRecordsByHead(head.handoverId)
    const runtimeTask = getPdaHeadRuntimeTask(head.handoverId)
    const sourceDoc = getPdaHeadSourceExecutionDoc(head.handoverId)
    const profile = deriveHandoutObjectProfile(head, records, runtimeTask, sourceDoc)
    detailState.newRecordOpen = true
    detailState.newRecordObjectType =
      profile.objectType === 'GARMENT'
        ? 'FINISHED_GARMENT'
        : profile.objectType
    detailState.newRecordScanCode = ''
    detailState.newRecordQty = ''
    detailState.newRecordUnit = profile.displayUnit || head.qtyUnit || '件'
    detailState.newRecordRemark = ''
    return true
  }

  if (action === 'cancel-new-handout-record') {
    detailState.newRecordOpen = false
    detailState.newRecordObjectType = 'FINISHED_GARMENT'
    detailState.newRecordScanCode = ''
    detailState.newRecordQty = ''
    detailState.newRecordUnit = '件'
    detailState.newRecordRemark = ''
    clearWaterHandoverConfirm()
    return true
  }

  if (action === 'submit-new-handout-record') {
    const handoverId = actionNode.dataset.handoverId
    const head = handoverId ? findPdaHandoverHead(handoverId) : undefined
    if (!head || head.headType !== 'HANDOUT') {
      showPdaHandoverDetailToast('未找到交出单')
      return true
    }
    if (head.completionStatus === 'COMPLETED') {
      showPdaHandoverDetailToast('交出单已完成，不允许新增交出记录')
      return true
    }
    if (isWaterSolubleHandoverHead(head)) {
      const confirmation = validateWaterHandoverConfirm(head, actionNode.dataset.waterHandoverConfirmToken)
      if (!confirmation.ok) {
        showPdaHandoverDetailToast(confirmation.message)
        return true
      }
    } else if (!canCreateHandoverRecord(resolveFcsDemoRole('FACTORY'))) {
      showPdaHandoverDetailToast(ACTION_PERMISSION_DENIED_TEXT)
      return true
    }

    const submittedQty = Number(detailState.newRecordQty)
    const scanCode = detailState.newRecordScanCode.trim()
    if (!scanCode) {
      showPdaHandoverDetailToast('请先扫码')
      return true
    }
    if (isWaterSolubleHandoverHead(head)) {
      const scanError = validateWaterSolubleHandoverScan(head, scanCode)
      if (scanError) {
        actionNode.dataset.skipPageRerender = 'true'
        showPdaHandoverDetailToast(scanError)
        document.querySelector<HTMLInputElement>('[data-pda-handoverd-field="newRecordScanCode"]')?.focus()
        return true
      }
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        actionNode.dataset.skipPageRerender = 'true'
        showPdaHandoverDetailToast('当前网络不可用，请联网后重试')
        document.querySelector<HTMLInputElement>('[data-pda-handoverd-field="newRecordQty"]')?.focus()
        return true
      }
    }
    if (!Number.isFinite(submittedQty) || submittedQty <= 0) {
      showPdaHandoverDetailToast('请先填写有效交出数量')
      return true
    }
    const qtyUnit = isWaterSolubleHandoverHead(head) ? head.qtyUnit : detailState.newRecordUnit.trim() || head.qtyUnit || '件'

    try {
      const created = createFactoryHandoverRecord({
        handoverOrderId: head.handoverOrderId || head.handoverId,
        submittedQty,
        qtyUnit,
        factorySubmittedAt: nowTimestamp(),
        factorySubmittedBy: isWaterSolubleHandoverHead(head) ? getPdaRuntimeContext()?.userName || '交接员' : '工厂操作员',
        factoryRemark: [`扫码：${scanCode}`, detailState.newRecordRemark.trim()].filter(Boolean).join('；') || undefined,
        factoryProofFiles: [],
        objectType: detailState.newRecordObjectType,
        scanCode,
        actor: isWaterSolubleHandoverHead(head) ? getPdaSession() || undefined : undefined,
      })

      appendTaskAudit(
        created.taskId,
        'HANDOUT_RECORD_CREATE',
        `已新增交出记录：${created.submittedQty ?? 0} ${created.qtyUnit}`,
        '工厂端移动应用',
      )

      detailState.newRecordOpen = false
      detailState.newRecordObjectType = 'FINISHED_GARMENT'
      detailState.newRecordScanCode = ''
      detailState.newRecordQty = ''
      detailState.newRecordUnit = qtyUnit
      detailState.newRecordRemark = ''
      clearWaterHandoverConfirm()
      if (!isPostFinishingHandoutHead(head) && head.sourceBusinessType !== 'WATER_SOLUBLE_WORK_ORDER') {
        try {
          const outboundLinkInput = {
            handoverOrderId: head.handoverOrderId || head.handoverId,
            handoverOrderNo: head.handoverOrderNo || head.handoverId,
            handoverRecordId: created.handoverRecordId || created.recordId,
            handoverRecordNo: created.handoverRecordNo || created.recordId,
            [LINKED_QR_FIELD]: getLinkedQrValue(created),
            taskId: created.taskId,
            taskNo: head.taskNo,
            factoryId: head.factoryId,
            factoryName: head.sourceFactoryName,
            receiverKind: head.targetKind === 'WAREHOUSE' ? '中转仓' : '其他接收方',
            receiverName: head.receiverName || head.targetName,
            itemKind:
              detailState.newRecordObjectType === 'FABRIC'
                ? '面料'
                : detailState.newRecordObjectType === 'CUT_PIECE'
                  ? '裁片'
                  : detailState.newRecordObjectType === 'SEMI_FINISHED_GARMENT'
                    ? '成衣半成品'
                    : '其他半成品',
            itemName: created.handoutItemLabel || created.materialName || head.processName,
            materialSku: created.materialCode || created.skuCode,
            partName: created.pieceName,
            fabricColor: created.skuColor,
            sizeCode: created.skuSize,
            submittedQty: created.submittedQty ?? created.plannedQty ?? submittedQty,
            unit: created.qtyUnit,
            operatorName: '工厂端移动应用',
            submittedAt: created.factorySubmittedAt,
          }
          linkHandoverRecordToOutboundRecord(
            outboundLinkInput as Parameters<typeof linkHandoverRecordToOutboundRecord>[0],
          )
        } catch (error) {
          if (!isWarehouseLinkageSkippableError(error)) {
            throw error
          }
        }
      }
      showPdaHandoverDetailToast(isPostFinishingHandoutHead(head) ? '已生成后道交出记录' : '已生成出库记录')
    } catch (error) {
      const message = error instanceof Error ? error.message : '交出记录新增失败'
      showPdaHandoverDetailToast(message)
    }
    return true
  }

  if (action === 'open-receiver-writeback') {
    if (!canReceiverWritebackAction(resolveFcsDemoRole('RECEIVER'))) {
      showPdaHandoverDetailToast(ACTION_PERMISSION_DENIED_TEXT)
      return true
    }
    const recordId = actionNode.dataset.recordId
    const record = recordId ? findPdaHandoverRecord(recordId) : undefined
    if (!record || !canReceiverWriteback(record)) {
      showPdaHandoverDetailToast('当前记录暂不可确认收货')
      return true
    }
    detailState.writebackRecordId = record.recordId
    detailState.writebackQty = typeof getRecordReceiverWrittenQty(record) === 'number'
      ? String(getRecordReceiverWrittenQty(record))
      : String(record.submittedQty ?? record.plannedQty ?? '')
    detailState.writebackReason = record.diffReason || ''
    detailState.writebackRemark = record.receiverRemark || ''
    detailState.writebackPreviewConfirmedAt = receiverWritebackNowProvider()
    return true
  }

  if (action === 'cancel-receiver-writeback') {
    detailState.writebackRecordId = ''
    detailState.writebackQty = ''
    detailState.writebackReason = ''
    detailState.writebackRemark = ''
    detailState.writebackPreviewConfirmedAt = ''
    return true
  }

  if (action === 'submit-receiver-writeback') {
    if (!canReceiverWritebackAction(resolveFcsDemoRole('RECEIVER'))) {
      showPdaHandoverDetailToast(ACTION_PERMISSION_DENIED_TEXT)
      return true
    }
    const recordId = actionNode.dataset.recordId
    const record = recordId ? findPdaHandoverRecord(recordId) : undefined
    if (!record || !canReceiverWriteback(record)) {
      showPdaHandoverDetailToast('当前记录暂不可确认收货')
      return true
    }
    const receiverWrittenQty = Number(detailState.writebackQty)
    if (!Number.isFinite(receiverWrittenQty) || receiverWrittenQty < 0) {
      showPdaHandoverDetailToast('请先填写有效实收对象数量')
      return true
    }
    const submittedQty = record.submittedQty ?? record.plannedQty ?? 0
    if (receiverWrittenQty !== submittedQty && !detailState.writebackReason.trim()) {
      showPdaHandoverDetailToast('数量有差异时请填写差异原因')
      return true
    }
    if (!detailState.writebackPreviewConfirmedAt) {
      showPdaHandoverDetailToast('请重新输入实收数量，生成本次确认时间')
      return true
    }

    const confirmedAt = receiverWritebackNowProvider()
    const currentSnapshot = getSewingDeliverySlaSnapshot(record.taskId || record.sourceTaskId)
    if (currentSnapshot?.active && !buildReceiverWritebackSlaPreview(record.recordId, receiverWrittenQty, confirmedAt)) {
      showPdaHandoverDetailToast('履约投影校验失败，请重新确认')
      return true
    }

    let updated: PdaHandoverRecord
    try {
      updated = writeBackHandoverRecord({
        handoverRecordId: record.recordId,
        receiverWrittenQty,
        receiverWrittenAt: confirmedAt,
        receiverWrittenBy: '接收方扫码员',
        receiverRemark: detailState.writebackRemark.trim() || undefined,
        diffReason: detailState.writebackReason.trim() || undefined,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : '接收方确认收货失败'
      showPdaHandoverDetailToast(message)
      return true
    }

    detailState.writebackRecordId = ''
    detailState.writebackQty = ''
    detailState.writebackReason = ''
    detailState.writebackRemark = ''
    detailState.writebackPreviewConfirmedAt = ''
    detailState.writebackSyncWarning = ''

    const handoverRecordId = updated.handoverRecordId || updated.recordId
    const isPrompt7ReturnFlow = isSpecialCraftReturnHandoverRecord(handoverRecordId)
    const isPostFinishingReturnFlow = isPostFinishingHandoutRecord(updated)
    try {
      receiverWritebackLinkageProbe?.()

      appendTaskAudit(
        updated.taskId,
        'HANDOUT_RECORD_WRITEBACK',
        `接收方已确认实收对象数量 ${updated.receiverWrittenQty ?? 0} ${updated.qtyUnit}`,
        '工厂端移动应用',
      )

      if (isPrompt7ReturnFlow) {
        try {
          const returnBindings = getSpecialCraftReturnBindingsByHandoverRecordId(handoverRecordId)
          const receivedFeiTicketNos =
            returnBindings.length > 0
              ? returnBindings.map((item) => item.feiTicketNo)
              : updated.cutPieceLines?.map((line) => line.feiTicketNo).filter(Boolean) || []
          receiveSpecialCraftReturnToCuttingWaitHandoverWarehouse({
            returnHandoverRecordId: handoverRecordId,
            receivedFeiTicketNos,
            receiverWrittenQty: updated.receiverWrittenQty ?? receiverWrittenQty,
            receiverName: updated.receiverWrittenBy || '接收方扫码员',
            receivedAt: updated.receiverWrittenAt || nowTimestamp(),
            differenceReason: updated.diffReason || undefined,
          })
        } catch (error) {
          if (!isWarehouseLinkageSkippableError(error)) {
            throw error
          }
        }
      } else if (isPostFinishingReturnFlow) {
        // 后道交出已由 post-finishing-domain 同步待交出仓，不再写通用工厂内部仓。
      } else {
        try {
          syncReceiverWritebackToOutboundRecord({
            handoverRecordId,
            receiverWrittenQty: updated.receiverWrittenQty ?? receiverWrittenQty,
            receiverWrittenAt: updated.receiverWrittenAt || nowTimestamp(),
            receiverWrittenBy: updated.receiverWrittenBy || '接收方扫码员',
            differenceQty: getRecordDiffQty(updated) ?? receiverWrittenQty - submittedQty,
          })
        } catch (error) {
          if (!isWarehouseLinkageSkippableError(error)) {
            throw error
          }
        }

        const linkedHead = findPdaHandoverHead(updated.handoverId)
        if (linkedHead?.targetKind === 'FACTORY') {
          try {
            const receiverFactoryId = linkedHead.receiverId || ''
            const canLinkInbound =
              !!receiverFactoryId
                ? !!findFactoryInternalWarehouseByFactoryAndKind(receiverFactoryId, 'WAIT_PROCESS')
                : true
            if (canLinkInbound) {
              linkHandoverReceiveToInboundRecord({
                handoverOrderId: linkedHead.handoverOrderId || linkedHead.handoverId,
                handoverRecordId,
                factoryId: receiverFactoryId,
                factoryName: linkedHead.receiverName || linkedHead.targetName,
                receiverWrittenQty: updated.receiverWrittenQty ?? receiverWrittenQty,
                sourceFactoryName: linkedHead.sourceFactoryName,
                itemKind:
                  updated.handoutObjectType === 'FABRIC'
                    ? '面料'
                    : updated.handoutObjectType === 'CUT_PIECE'
                      ? '裁片'
                      : updated.handoutObjectType === 'SEMI_FINISHED_GARMENT'
                        ? '成衣半成品'
                        : '其他半成品',
                itemName: updated.handoutItemLabel || updated.materialName || linkedHead.processName,
                materialSku: updated.materialCode || updated.skuCode,
                partName: updated.pieceName,
                fabricColor: updated.skuColor,
                sizeCode: updated.skuSize,
                feiTicketNo: updated.cutPieceLines?.[0]?.feiTicketNo,
                transferBagNo: updated.cutPieceLines?.[0]?.bundleNo,
                fabricRollNo: updated.materialSpec,
                unit: updated.qtyUnit,
                receivedAt: updated.receiverWrittenAt || nowTimestamp(),
                receiverName: updated.receiverWrittenBy || '接收方扫码员',
                abnormalReason: updated.diffReason,
              })
            }
          } catch (error) {
            if (!isWarehouseLinkageSkippableError(error)) {
              throw error
            }
          }
        }
      }

    } catch (error) {
      const reason = error instanceof Error ? error.message : '未知异常'
      detailState.writebackSyncWarning = `确认成功，仓库同步待处理：${reason}`
    }

    refreshHandoutRecordAndSlaSummary(updated)
    if (detailState.writebackSyncWarning) {
      showPdaHandoverDetailToast(detailState.writebackSyncWarning)
    } else {
      showPdaHandoverDetailToast(
        isPrompt7ReturnFlow
          ? receiverWrittenQty === submittedQty
            ? '已回仓'
            : '已收货，回仓差异待处理'
          : isPostFinishingReturnFlow
            ? receiverWrittenQty === submittedQty
              ? '后道交出收货已同步'
              : '后道交出收货有差异，待处理'
          : receiverWrittenQty === submittedQty
            ? '接收方收货确认已完成'
            : '接收方已确认收货，待工厂确认差异',
      )
    }
    return true
  }

  if (action === 'open-record-objection') {
    if (!canRaiseQuantityObjection(resolveFcsDemoRole('FACTORY'))) {
      showPdaHandoverDetailToast(ACTION_PERMISSION_DENIED_TEXT)
      return true
    }
    const recordId = actionNode.dataset.recordId
    if (!recordId) return true
    const record = findPdaHandoverRecord(recordId)
    if (!record || !canHandleDiff(record)) {
      showPdaHandoverDetailToast('当前记录暂不可发起异议')
      return true
    }
    detailState.objectionRecordId = recordId
    detailState.objectionReason = ''
    detailState.objectionRemark = ''
    detailState.objectionProofFiles = []
    return true
  }

  if (action === 'cancel-record-objection') {
    detailState.objectionRecordId = ''
    detailState.objectionReason = ''
    detailState.objectionRemark = ''
    detailState.objectionProofFiles = []
    return true
  }

  if (action === 'confirm-pickup-record') {
    const recordId = actionNode.dataset.recordId
    if (!recordId) return true
    const currentRecord = findPdaPickupRecord(recordId)
    if (!currentRecord) {
      showPdaHandoverDetailToast('未找到领料记录')
      return true
    }
    if (currentRecord.status !== 'PENDING_FACTORY_CONFIRM') {
      showPdaHandoverDetailToast('当前记录暂不可确认领料')
      return true
    }
    const currentPostFinishingPickup = parsePostFinishingPickupRecord(currentRecord)
    const currentSelfReturnPickup = parsePostFinishingSelfReturnPickupRecord(currentRecord)
    if (typeof currentRecord.warehouseHandedQty !== 'number' || currentRecord.warehouseHandedQty < 0) {
      showPdaHandoverDetailToast(currentPostFinishingPickup || currentSelfReturnPickup ? '当前记录缺少车缝厂交付数量' : '当前记录缺少仓库交付数量')
      return true
    }
    const updated = confirmPdaPickupRecordReceived(recordId, {
      factoryConfirmedQty: currentRecord.warehouseHandedQty,
      factoryConfirmedAt: nowTimestamp(),
    })
    if (!updated) {
      showPdaHandoverDetailToast('当前记录暂不可确认领料')
      return true
    }
    selectPickupRecord(updated)
    appendTaskAudit(
      updated.taskId,
      'PICKUP_RECORD_CONFIRM',
      `已确认领料数量 ${updated.factoryConfirmedQty ?? updated.qtyExpected} ${updated.qtyUnit}`,
      '工厂端移动应用',
    )
    const postFinishingPickup = parsePostFinishingPickupRecord(updated)
    const selfReturnPickup = parsePostFinishingSelfReturnPickupRecord(updated)
    const isPrompt7Dispatch = isSpecialCraftDispatchPickupRecord(updated.recordId)
    try {
      if (selfReturnPickup) {
        confirmPostFinishingSewingSelfReturnWarehouseRecord({
          warehouseRecordId: selfReturnPickup.warehouseRecordId,
          confirmedQty: updated.factoryConfirmedQty ?? updated.warehouseHandedQty ?? updated.qtyExpected,
          confirmerName: '工厂端移动应用',
          remark: 'PDA 交接待领料确认车缝自助回货。',
        })
      } else if (postFinishingPickup) {
        const area = listPostFinishingWarehouseAreas('wait-process')[0]
        if (!area) {
          showPdaHandoverDetailToast('请先维护后道待加工仓库区')
          return true
        }
        const location = listPostFinishingWarehouseLocations('wait-process').find((item) => item.areaId === area.areaId)
        confirmPostFinishingWarehouseReceipt({
          handoverRecordNo: postFinishingPickup.handoverRecordNo,
          receiverName: '工厂端移动应用',
          lines: [{
            handoverLineId: postFinishingPickup.handoverLineId,
            actualQty: updated.factoryConfirmedQty ?? updated.warehouseHandedQty ?? updated.qtyExpected,
            areaId: area.areaId,
            locationId: location?.locationId,
          }],
        })
      } else if (isPrompt7Dispatch) {
        const binding = getSpecialCraftBindingByPickupRecordId(updated.recordId)
        if (binding?.dispatchHandoverRecordId) {
          markSpecialCraftFactoryReceivedFromHandover({
            handoverRecordId: binding.dispatchHandoverRecordId,
            receivedFeiTicketNos: [binding.feiTicketNo],
            receiverWrittenQty: updated.factoryConfirmedQty ?? updated.warehouseHandedQty ?? updated.qtyExpected,
            receiverName: '工厂端移动应用',
            receivedAt: updated.factoryConfirmedAt || nowTimestamp(),
          })
        }
      } else {
        linkPickupConfirmToInboundRecord({
          pickupRecordId: updated.recordId,
          pickupRecordNo: updated.recordId,
          expectedQty: updated.qtyExpected,
          receivedQty: updated.factoryConfirmedQty ?? updated.warehouseHandedQty,
          receiverName: '工厂端移动应用',
          receivedAt: updated.factoryConfirmedAt || nowTimestamp(),
        })
      }
    } catch (error) {
      if (!isWarehouseLinkageSkippableError(error)) {
        throw error
      }
    }
    showPdaHandoverDetailToast(selfReturnPickup || postFinishingPickup ? '已入后道待加工仓' : '已入待加工仓')
    return true
  }

  if (action === 'select-pickup-record') {
    const recordId = actionNode.dataset.recordId
    if (!recordId) return true
    selectPickupRecord(findPdaPickupRecord(recordId))
    return true
  }

  if (action === 'open-pickup-record-objection') {
    if (!canRaiseQuantityObjection(resolveFcsDemoRole('FACTORY'))) {
      showPdaHandoverDetailToast(ACTION_PERMISSION_DENIED_TEXT)
      return true
    }
    const recordId = actionNode.dataset.recordId
    if (!recordId) return true
    const currentRecord = findPdaPickupRecord(recordId)
    if (!currentRecord || currentRecord.status !== 'PENDING_FACTORY_CONFIRM') {
      showPdaHandoverDetailToast('当前记录暂不可发起数量差异')
      return true
    }
    detailState.pickupDisputeRecordId = recordId
    detailState.pickupDisputeQty =
      typeof currentRecord.warehouseHandedQty === 'number'
        ? String(currentRecord.warehouseHandedQty)
        : String(currentRecord.qtyExpected)
    detailState.pickupDisputeReason = ''
    detailState.pickupDisputeRemark = ''
    detailState.pickupDisputeProofFiles = []
    detailState.pickupRejectRecordId = ''
    return true
  }

  if (action === 'cancel-pickup-record-objection') {
    detailState.pickupDisputeRecordId = ''
    detailState.pickupDisputeQty = ''
    detailState.pickupDisputeReason = ''
    detailState.pickupDisputeRemark = ''
    detailState.pickupDisputeProofFiles = []
    return true
  }

  if (action === 'open-pickup-record-reject') {
    const recordId = actionNode.dataset.recordId
    if (!recordId) return true
    const currentRecord = findPdaPickupRecord(recordId)
    if (!currentRecord || currentRecord.status !== 'PENDING_FACTORY_CONFIRM') {
      showPdaHandoverDetailToast('当前记录暂不可驳回')
      return true
    }
    detailState.pickupRejectRecordId = recordId
    detailState.pickupRejectReason = ''
    detailState.pickupRejectRemark = ''
    detailState.pickupDisputeRecordId = ''
    return true
  }

  if (action === 'cancel-pickup-record-reject') {
    detailState.pickupRejectRecordId = ''
    detailState.pickupRejectReason = ''
    detailState.pickupRejectRemark = ''
    return true
  }

  if (action === 'submit-pickup-record-objection') {
    if (!canRaiseQuantityObjection(resolveFcsDemoRole('FACTORY'))) {
      showPdaHandoverDetailToast(ACTION_PERMISSION_DENIED_TEXT)
      return true
    }
    const recordId = actionNode.dataset.recordId
    if (!recordId) return true
    const currentRecord = findPdaPickupRecord(recordId)
    if (!currentRecord || currentRecord.status !== 'PENDING_FACTORY_CONFIRM') {
      showPdaHandoverDetailToast('当前记录暂不可发起数量差异')
      return true
    }
    const factoryReportedQty = Number(detailState.pickupDisputeQty)
    if (!Number.isFinite(factoryReportedQty) || factoryReportedQty < 0) {
      showPdaHandoverDetailToast('请先填写工厂实际收到数量')
      return true
    }
    if (!detailState.pickupDisputeReason.trim()) {
      showPdaHandoverDetailToast('请先填写差异原因')
      return true
    }

    const result = createPdaPickupDisputeCase(recordId, {
      factoryReportedQty,
      objectionReason: detailState.pickupDisputeReason.trim(),
      objectionRemark: detailState.pickupDisputeRemark.trim() || undefined,
      objectionProofFiles: cloneProofFiles(detailState.pickupDisputeProofFiles) as HandoverProofFile[],
    })

    if (!result.record || !result.exceptionCase) {
      showPdaHandoverDetailToast(result.issues.join('；') || '数量差异提交失败')
      return true
    }

    appendTaskAudit(
      result.record.taskId,
      'PICKUP_QTY_OBJECTION',
      '已发起领料数量差异，请等待处理',
      '工厂端移动应用',
    )
    try {
      const binding = getSpecialCraftBindingByPickupRecordId(result.record.recordId)
      if (binding?.dispatchHandoverRecordId) {
        markSpecialCraftFactoryReceivedFromHandover({
          handoverRecordId: binding.dispatchHandoverRecordId,
          receivedFeiTicketNos: [binding.feiTicketNo],
          receiverWrittenQty: result.record.factoryReportedQty ?? factoryReportedQty,
          receiverName: '工厂端移动应用',
          receivedAt: nowTimestamp(),
          differenceReason: detailState.pickupDisputeReason.trim(),
        })
      } else {
        linkPickupConfirmToInboundRecord({
          pickupRecordId: result.record.recordId,
          pickupRecordNo: result.record.recordId,
          expectedQty: result.record.qtyExpected,
          receivedQty: result.record.factoryReportedQty ?? factoryReportedQty,
          receiverName: '工厂端移动应用',
          receivedAt: nowTimestamp(),
          abnormalReason: detailState.pickupDisputeReason.trim(),
          photoList: detailState.pickupDisputeProofFiles.map((file) => file.name),
        })
      }
    } catch (error) {
      if (!isWarehouseLinkageSkippableError(error)) {
        throw error
      }
    }
    selectPickupRecord(result.record)
    showPdaHandoverDetailToast('已入待加工仓 · 差异待处理')
    return true
  }

  if (action === 'submit-pickup-record-reject') {
    const recordId = actionNode.dataset.recordId
    if (!recordId) return true
    const currentRecord = findPdaPickupRecord(recordId)
    if (!currentRecord || currentRecord.status !== 'PENDING_FACTORY_CONFIRM') {
      showPdaHandoverDetailToast('当前记录暂不可驳回')
      return true
    }
    if (!detailState.pickupRejectReason.trim()) {
      showPdaHandoverDetailToast('请先填写驳回原因')
      return true
    }

    const updated = rejectPdaPickupRecord(recordId, {
      rejectedAt: nowTimestamp(),
      rejectedBy: '工厂端移动应用',
      rejectReason: detailState.pickupRejectReason.trim(),
      rejectRemark: detailState.pickupRejectRemark.trim() || undefined,
    })
    if (!updated) {
      showPdaHandoverDetailToast('当前记录暂不可驳回')
      return true
    }

    appendTaskAudit(
      updated.taskId,
      'PICKUP_RECORD_REJECT',
      `已驳回待领料记录：${detailState.pickupRejectReason.trim()}`,
      '工厂端移动应用',
    )

    selectPickupRecord(updated)
    detailState.pickupRejectRecordId = ''
    detailState.pickupRejectReason = ''
    detailState.pickupRejectRemark = ''
    showPdaHandoverDetailToast('已驳回')
    return true
  }

  if (action === 'submit-record-objection') {
    if (!canRaiseQuantityObjection(resolveFcsDemoRole('FACTORY'))) {
      showPdaHandoverDetailToast(ACTION_PERMISSION_DENIED_TEXT)
      return true
    }
    const recordId = actionNode.dataset.recordId
    if (!recordId) return true

    if (!detailState.objectionReason.trim()) {
      showPdaHandoverDetailToast('请先填写异议原因')
      return true
    }

    const updated = reportPdaHandoverQtyObjection(recordId, {
      objectionReason: detailState.objectionReason,
      objectionRemark: detailState.objectionRemark,
      objectionProofFiles: cloneProofFiles(detailState.objectionProofFiles),
    })

    if (!updated) {
      showPdaHandoverDetailToast('当前记录暂不可发起异议')
      return true
    }

    appendTaskAudit(
      updated.taskId,
      'HANDOUT_QTY_OBJECTION',
      `已发起交出对象数量异议：${updated.objectionReason}`,
      '工厂端移动应用',
    )

    try {
      const handoverRecordId = updated.handoverRecordId || updated.recordId
      if (isSpecialCraftReturnHandoverRecord(handoverRecordId)) {
        syncSpecialCraftReturnObjectionByHandoverRecord({
          handoverRecordId,
          objectionId: updated.quantityObjectionId || `OBJ-${updated.recordId}`,
          objectionStatus: '异议中',
        })
      } else {
        syncQuantityObjectionToOutboundRecord({
          handoverRecordId,
          objectionId: updated.quantityObjectionId || `OBJ-${updated.recordId}`,
          objectionStatus: '异议中',
        })
      }
    } catch (error) {
      if (!isWarehouseLinkageSkippableError(error)) {
        throw error
      }
    }

    detailState.objectionRecordId = ''
    detailState.objectionReason = ''
    detailState.objectionRemark = ''
    detailState.objectionProofFiles = []
    showPdaHandoverDetailToast('数量异议已提交，等待平台处理')
    return true
  }

  if (action === 'accept-record-diff') {
    if (!canAcceptDiffAction(resolveFcsDemoRole('FACTORY'))) {
      showPdaHandoverDetailToast(ACTION_PERMISSION_DENIED_TEXT)
      return true
    }
    const recordId = actionNode.dataset.recordId
    if (!recordId) return true
    const updated = acceptHandoverRecordDiff(recordId)
    if (!updated) {
      showPdaHandoverDetailToast('当前记录暂不可接受差异')
      return true
    }
    appendTaskAudit(
      updated.taskId,
      'HANDOUT_DIFF_ACCEPTED',
      `已接受差异对象数量 ${updated.diffQty ?? 0} ${updated.qtyUnit}`,
      '工厂端移动应用',
    )
    showPdaHandoverDetailToast('当前差异已接受')
    return true
  }

  if (action === 'goto-pickup-record-exception') {
    const recordId = actionNode.dataset.recordId
    const record = recordId ? findPdaPickupRecord(recordId) : undefined
    if (!record?.exceptionCaseId) {
      showPdaHandoverDetailToast('当前记录尚未绑定异常单')
      return true
    }
    appStore.navigate(`/fcs/progress/exceptions?caseId=${encodeURIComponent(record.exceptionCaseId)}`)
    return true
  }

  return false
}
