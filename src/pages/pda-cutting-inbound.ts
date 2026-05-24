import { escapeHtml } from '../utils'
import { buildPdaCuttingInboundProjection } from './pda-cutting-inbound-projection'
import { buildTransferBagsProjection } from './process-factory/cutting/transfer-bags-projection.ts'
import {
  getTransferBagTicketPrintStatusLabel,
  type TransferBagTicketCandidate,
} from './process-factory/cutting/transfer-bags-model.ts'
import {
  buildPdaCuttingWritebackSource,
  resolvePdaCuttingWritebackIdentity,
  resolvePdaCuttingWritebackOperator,
} from '../data/fcs/pda-cutting-writeback-inputs.ts'
import { writePdaInboundToFcs } from '../domain/cutting-pda-writeback/bridge.ts'
import {
  buildPdaCuttingExecutionStateKey,
  renderPdaCuttingEmptyState,
  renderPdaCuttingExecutionHero,
  renderPdaCuttingFeedbackNotice,
  renderPdaCuttingOrderSelectionPrompt,
  renderPdaCuttingPageLayout,
  renderPdaCuttingSection,
  renderPdaCuttingSummaryGrid,
} from './pda-cutting-shared'
import {
  buildPdaCuttingExecutionContext,
  readSelectedExecutionOrderIdFromLocation,
  readSelectedExecutionOrderNoFromLocation,
} from './pda-cutting-context'
import { buildPdaCuttingCompletedReturnHref } from './pda-cutting-nav-context'

interface InboundFormState {
  operatorName: string
  zoneCode: 'A' | 'B' | 'C'
  locationLabel: string
  carrierCode: string
  scanCode: string
  inboundQty: string
  scannedTicketNos: string[]
  note: string
  feedbackMessage: string
  syncStatus: '' | '待同步' | '已同步' | '同步失败'
  backHrefOverride: string
}

declare global {
  interface Window {
    __higoodPdaCuttingInboundState?: Map<string, InboundFormState>
  }
}

const fallbackInboundState = new Map<string, InboundFormState>()

function getInboundStateStore(): Map<string, InboundFormState> {
  if (typeof window === 'undefined') return fallbackInboundState
  if (!window.__higoodPdaCuttingInboundState) {
    window.__higoodPdaCuttingInboundState = new Map<string, InboundFormState>()
  }
  return window.__higoodPdaCuttingInboundState
}

function getInboundDetail(taskId: string, executionKey?: string | null) {
  return buildPdaCuttingInboundProjection(taskId, executionKey ?? undefined)
}

function getState(taskId: string, executionOrderId?: string | null, executionOrderNo?: string | null): InboundFormState {
  const stateKey = buildPdaCuttingExecutionStateKey(taskId, executionOrderId, executionOrderNo)
  const inboundState = getInboundStateStore()
  const existing = inboundState.get(stateKey)
  if (existing) return existing
  const initial: InboundFormState = {
    operatorName: '仓务操作员',
    zoneCode: 'B',
    locationLabel: 'B-02 临时位',
    carrierCode: '',
    scanCode: '',
    inboundQty: '',
    scannedTicketNos: [],
    note: '',
    feedbackMessage: '',
    syncStatus: '',
    backHrefOverride: '',
  }
  inboundState.set(stateKey, initial)
  return initial
}

function resolveInboundEventState(taskId: string): {
  form: InboundFormState
  selectedExecutionOrderId: string | null
  selectedExecutionOrderNo: string | null
} {
  const locationExecutionOrderId = readSelectedExecutionOrderIdFromLocation()
  const locationExecutionOrderNo = readSelectedExecutionOrderNoFromLocation()
  if (locationExecutionOrderId || locationExecutionOrderNo) {
    return {
      form: getState(taskId, locationExecutionOrderId, locationExecutionOrderNo),
      selectedExecutionOrderId: locationExecutionOrderId,
      selectedExecutionOrderNo: locationExecutionOrderNo,
    }
  }
  const context = buildPdaCuttingExecutionContext(taskId, 'inbound')
  return {
    form: getState(taskId, context.selectedExecutionOrderId, context.selectedExecutionOrderNo),
    selectedExecutionOrderId: context.selectedExecutionOrderId,
    selectedExecutionOrderNo: context.selectedExecutionOrderNo,
  }
}

function syncInboundFormFromControls(form: InboundFormState, container: HTMLElement | null): void {
  if (!container) return
  const carrierCodeNode = container.querySelector<HTMLInputElement>('[data-pda-cut-inbound-field="carrierCode"]')
  const scanCodeNode = container.querySelector<HTMLInputElement>('[data-pda-cut-inbound-field="scanCode"]')
  const zoneCodeNode = container.querySelector<HTMLSelectElement>('[data-pda-cut-inbound-field="zoneCode"]')
  const locationLabelNode = container.querySelector<HTMLInputElement>('[data-pda-cut-inbound-field="locationLabel"]')
  if (carrierCodeNode) form.carrierCode = carrierCodeNode.value
  if (scanCodeNode) form.scanCode = scanCodeNode.value
  if (zoneCodeNode) form.zoneCode = zoneCodeNode.value as 'A' | 'B' | 'C'
  if (locationLabelNode) form.locationLabel = locationLabelNode.value
}

function resolveInboundFormContainer(actionNode: HTMLElement): HTMLElement | null {
  const currentScope = actionNode.closest<HTMLElement>('[data-task-id]')
  if (currentScope && currentScope !== actionNode) return currentScope
  return actionNode.parentElement?.closest<HTMLElement>('[data-task-id]') || currentScope
}

function listInboundTicketCandidates(): TransferBagTicketCandidate[] {
  return buildTransferBagsProjection().viewModel.ticketCandidates
}

function resolveInboundScanTicket(scanCode: string): TransferBagTicketCandidate | null {
  const normalized = scanCode.trim().toUpperCase()
  if (!normalized) return null
  return (
    listInboundTicketCandidates().find((ticket) =>
      [ticket.ticketNo, ticket.feiTicketId, ticket.ticketRecordId].some((value) => String(value || '').toUpperCase() === normalized),
    ) || null
  )
}

function validateInboundScan(form: InboundFormState, scanCode: string): { ok: boolean; reason: string; ticket: TransferBagTicketCandidate | null } {
  const normalized = scanCode.trim().toUpperCase()
  if (!normalized) return { ok: false, reason: '请先扫描菲票二维码。', ticket: null }
  if (normalized.includes('WAIT') || normalized.includes('未首打')) return { ok: false, reason: '菲票未首打，不能入仓。', ticket: null }
  if (normalized.includes('VOID') || normalized.includes('作废')) return { ok: false, reason: '菲票已作废，不能入仓。', ticket: null }
  const ticket = resolveInboundScanTicket(scanCode)
  if (!ticket) return { ok: false, reason: '菲票不存在，不能入仓。', ticket: null }
  if (ticket.ticketStatus === 'VOIDED' || ticket.printStatus === 'VOIDED') return { ok: false, reason: '菲票已作废，不能入仓。', ticket }
  if (ticket.printStatus === 'WAIT_PRINT' && ticket.ticketStatus !== 'PRINTED') return { ok: false, reason: '菲票未首打，不能入仓。', ticket }
  if (form.scannedTicketNos.includes(ticket.ticketNo)) return { ok: false, reason: `${ticket.ticketNo} 已扫描，本次入仓不能重复。`, ticket }
  return { ok: true, reason: '', ticket }
}

function renderScannedTickets(form: InboundFormState): string {
  const candidatesByNo = Object.fromEntries(listInboundTicketCandidates().map((ticket) => [ticket.ticketNo, ticket]))
  const scannedTickets = form.scannedTicketNos.map((ticketNo) => candidatesByNo[ticketNo]).filter((ticket): ticket is TransferBagTicketCandidate => Boolean(ticket))
  const totalQty = scannedTickets.reduce((sum, ticket) => sum + Number(ticket.actualCutPieceQty || ticket.qty || 0), 0)
  const productionOrderCount = new Set(scannedTickets.map((ticket) => ticket.productionOrderNo).filter(Boolean)).size
  const partCount = new Set(scannedTickets.map((ticket) => ticket.partName).filter(Boolean)).size
  const hasSpecialCraft = scannedTickets.some((ticket) => ticket.hasSpecialCraft)
  return `
    <div class="rounded-xl border bg-muted/20 px-3 py-3 text-xs" data-pda-cut-inbound-scanned-summary>
      <div class="text-muted-foreground">已扫菲票</div>
      <div class="mt-1 text-sm font-semibold text-foreground">${scannedTickets.length} 张 / ${totalQty} 片</div>
      <div class="mt-1 text-muted-foreground">涉及 ${productionOrderCount} 个生产单 / ${partCount} 个部位 / ${hasSpecialCraft ? '包含特殊工艺裁片' : '无特殊工艺'}</div>
      <div class="mt-2 space-y-1">
        ${
          scannedTickets.length
            ? scannedTickets.map((ticket) => `
                <div class="rounded-lg border bg-background px-2 py-2">
                  <div class="font-medium text-foreground">${escapeHtml(ticket.ticketNo)}</div>
                  <div class="mt-1 text-muted-foreground">${escapeHtml(ticket.productionOrderNo)} / ${escapeHtml(ticket.spuCode)} / ${escapeHtml(ticket.color)} / ${escapeHtml(ticket.size)} / ${escapeHtml(ticket.partName)} / ${ticket.actualCutPieceQty || ticket.qty} 片</div>
                </div>
              `).join('')
            : '<div class="text-muted-foreground">暂无已扫菲票。</div>'
        }
      </div>
    </div>
  `
}

function renderInboundHistory(detail: NonNullable<ReturnType<typeof getInboundDetail>>): string {
  if (!detail || !detail.inboundRecords.length) {
    return renderPdaCuttingEmptyState('当前裁片单暂无入仓记录', '')
  }

  return `
    <div class="space-y-2">
      ${detail.inboundRecords
        .map(
          (record) => `
            <article class="rounded-xl border px-3 py-3 text-xs">
              <div class="flex items-center justify-between gap-2">
                <div class="font-medium text-foreground">${escapeHtml(record.id)} / ${escapeHtml(record.zoneCode)} 区 / ${escapeHtml(record.locationLabel)}</div>
                <div class="text-muted-foreground">${escapeHtml(record.scannedAt)}</div>
              </div>
              <div class="mt-2 grid grid-cols-2 gap-1 text-muted-foreground">
                <div>操作人：${escapeHtml(record.operatorName)}</div>
                <div>暂存方式：可混装</div>
              </div>
              <div class="mt-1 text-muted-foreground">记录：${escapeHtml(record.note || '无')}</div>
            </article>
          `,
        )
        .join('')}
    </div>
  `
}

function renderInboundStatus(detail: NonNullable<ReturnType<typeof getInboundDetail>>): string {
  return renderPdaCuttingSummaryGrid([
    { label: '当前入仓状态', value: detail.currentInboundStatus },
    { label: '暂存阶段', value: '入仓暂存，可混装' },
    { label: '当前库位', value: detail.inboundLocationLabel },
    { label: '最近入仓记录', value: detail.latestInboundRecordNo || '暂无记录', hint: detail.latestInboundAt },
  ])
}

export function renderPdaCuttingInboundPage(taskId: string): string {
  const context = buildPdaCuttingExecutionContext(taskId, 'inbound')
  const detail = context.detail

  if (!detail) {
    return renderPdaCuttingPageLayout({
      taskId,
      title: '入仓扫码',
      subtitle: '',
      activeTab: 'exec',
      body: '',
      backHref: context.backHref,
    })
  }

  if (context.requiresCutPieceOrderSelection) {
    return renderPdaCuttingPageLayout({
      taskId,
      title: '入仓扫码',
      subtitle: '',
      activeTab: 'exec',
      body: renderPdaCuttingOrderSelectionPrompt(detail, context.backHref, context.selectionNotice || undefined),
      backHref: context.backHref,
    })
  }

  const form = getState(taskId, context.selectedExecutionOrderId, context.selectedExecutionOrderNo)
  const pageBackHref = form.backHrefOverride || context.backHref

  const confirmSection = `
    <div class="space-y-3 text-xs" data-task-id="${escapeHtml(taskId)}">
      <label class="block space-y-1">
        <span class="text-muted-foreground">暂存袋 / 周转箱码</span>
        <input class="h-10 w-full rounded-xl border bg-background px-3 text-sm" data-pda-cut-inbound-field="carrierCode" value="${escapeHtml(form.carrierCode)}" placeholder="扫描或输入暂存袋码" />
      </label>
      <label class="block space-y-1">
        <span class="text-muted-foreground">菲票 / 裁片码</span>
        <input class="h-10 w-full rounded-xl border bg-background px-3 text-sm" data-pda-cut-inbound-field="scanCode" value="${escapeHtml(form.scanCode)}" placeholder="扫描菲票或裁片码" />
      </label>
      <button class="inline-flex min-h-10 w-full items-center justify-center rounded-xl border px-3 py-2 text-xs font-medium hover:bg-muted" data-pda-cut-inbound-action="add-ticket" data-task-id="${escapeHtml(taskId)}">
        加入菲票
      </button>
      <label class="block space-y-1">
        <span class="text-muted-foreground">区域</span>
        <select class="h-10 w-full rounded-xl border bg-background px-3 text-sm" data-pda-cut-inbound-field="zoneCode">
          ${['A', 'B', 'C'].map((item) => `<option value="${item}" ${form.zoneCode === item ? 'selected' : ''}>${item} 区</option>`).join('')}
        </select>
      </label>
      <label class="block space-y-1">
        <span class="text-muted-foreground">库位</span>
        <input class="h-10 w-full rounded-xl border bg-background px-3 text-sm" data-pda-cut-inbound-field="locationLabel" value="${escapeHtml(form.locationLabel)}" placeholder="例如：A-01 临时位" />
      </label>
      ${renderScannedTickets(form)}
      <div class="rounded-xl border bg-muted/20 px-3 py-3 text-xs">
        <div class="text-muted-foreground">本次入仓预览</div>
        <div class="mt-1 text-sm font-semibold text-foreground">${escapeHtml(form.carrierCode || '待扫袋码')} / ${form.scannedTicketNos.length} 张菲票</div>
        <div class="mt-1 text-muted-foreground">${escapeHtml(form.zoneCode)} 区 / ${escapeHtml(form.locationLabel || '待填写位置')} / 入仓暂存袋允许混装</div>
      </div>
      <div class="rounded-xl border bg-background px-3 py-2 text-xs">同步状态：<span class="font-medium text-foreground">${escapeHtml(form.syncStatus || '待提交')}</span></div>
      ${form.feedbackMessage ? renderPdaCuttingFeedbackNotice(form.feedbackMessage, 'success') : ''}
      <div class="grid grid-cols-2 gap-2">
        <button class="inline-flex min-h-10 items-center justify-center rounded-xl border px-3 py-2 text-xs font-medium hover:bg-muted" data-nav="${escapeHtml(pageBackHref)}">
          返回裁片任务
        </button>
        <button class="inline-flex min-h-10 items-center justify-center rounded-xl bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:opacity-90" data-pda-cut-inbound-action="confirm" data-task-id="${escapeHtml(taskId)}">
          提交入仓
        </button>
      </div>
    </div>
  `

  const body = `
    ${renderPdaCuttingExecutionHero('入仓扫码', detail)}
    ${renderPdaCuttingSection('当前情况', '', renderInboundStatus(detail))}
    ${renderPdaCuttingSection('入仓扫码', '', confirmSection)}
    ${renderPdaCuttingSection('最近入仓记录', '', renderInboundHistory(detail))}
  `

  return renderPdaCuttingPageLayout({
    taskId,
    title: '入仓扫码',
    subtitle: '',
    activeTab: 'exec',
    body,
    backHref: pageBackHref,
  })
}

export function handlePdaCuttingInboundEvent(target: HTMLElement): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-pda-cut-inbound-field]')
  if (
    fieldNode instanceof HTMLInputElement ||
    fieldNode instanceof HTMLSelectElement ||
    fieldNode instanceof HTMLTextAreaElement
  ) {
    const taskId = fieldNode.closest<HTMLElement>('[data-task-id]')?.dataset.taskId || appTaskIdFromPath()
    if (!taskId) return true
    const { form } = resolveInboundEventState(taskId)
    const field = fieldNode.dataset.pdaCutInboundField
    if (!field) return true

    if (field === 'operatorName') form.operatorName = fieldNode.value
    if (field === 'zoneCode' && fieldNode instanceof HTMLSelectElement) form.zoneCode = fieldNode.value as 'A' | 'B' | 'C'
    if (field === 'locationLabel') form.locationLabel = fieldNode.value
    if (field === 'carrierCode') form.carrierCode = fieldNode.value
    if (field === 'scanCode') form.scanCode = fieldNode.value
    if (field === 'inboundQty') form.inboundQty = fieldNode.value
    if (field === 'note') form.note = fieldNode.value
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-pda-cut-inbound-action]')
  if (!actionNode) return false
  const action = actionNode.dataset.pdaCutInboundAction
  const taskId = actionNode.dataset.taskId
  if (!action || !taskId) return false
  const {
    form,
    selectedExecutionOrderId,
    selectedExecutionOrderNo,
  } = resolveInboundEventState(taskId)
  syncInboundFormFromControls(form, resolveInboundFormContainer(actionNode))

  if (action === 'add-ticket') {
    const validation = validateInboundScan(form, form.scanCode)
    if (!validation.ok || !validation.ticket) {
      form.feedbackMessage = validation.reason
      form.syncStatus = ''
      return true
    }
    form.scannedTicketNos.push(validation.ticket.ticketNo)
    form.scanCode = ''
    form.inboundQty = String(
      form.scannedTicketNos
        .map((ticketNo) => resolveInboundScanTicket(ticketNo))
        .filter((ticket): ticket is TransferBagTicketCandidate => Boolean(ticket))
        .reduce((sum, ticket) => sum + Number(ticket.actualCutPieceQty || ticket.qty || 0), 0),
    )
    form.feedbackMessage = `${validation.ticket.ticketNo} 已加入；${getTransferBagTicketPrintStatusLabel(validation.ticket)}，允许与不同生产单、SKU、部位菲票混装。`
    form.syncStatus = ''
    return true
  }

  if (action === 'confirm') {
    const context = buildPdaCuttingExecutionContext(taskId, 'inbound')
    const identity = resolvePdaCuttingWritebackIdentity(taskId, {
      executionOrderId: context.selectedExecutionOrderId || undefined,
      executionOrderNo: context.selectedExecutionOrderNo || undefined,
      cutOrderId: context.selectedExecutionOrder?.cutOrderId || undefined,
      cutOrderNo: context.selectedExecutionOrder?.cutOrderNo || undefined,
      markerPlanId: context.selectedExecutionOrder?.markerPlanId || undefined,
      markerPlanNo: context.selectedExecutionOrder?.markerPlanNo || undefined,
      materialSku: context.selectedExecutionOrder?.materialSku || undefined,
    })
    const operator = resolvePdaCuttingWritebackOperator(taskId, form.operatorName.trim() || '仓务操作员')
    if (!identity || !operator) {
      form.feedbackMessage = '当前执行对象或操作人无法识别，不能确认入仓。'
      return true
    }
    if (!form.carrierCode.trim()) {
      form.feedbackMessage = '请先扫描入仓暂存袋袋码。'
      return true
    }
    if (!form.scannedTicketNos.length) {
      form.feedbackMessage = '请先扫描并加入至少一张菲票。'
      return true
    }
    const inboundTickets = form.scannedTicketNos
      .map((ticketNo) => resolveInboundScanTicket(ticketNo))
      .filter((ticket): ticket is TransferBagTicketCandidate => Boolean(ticket))
    const inboundQty = inboundTickets.reduce((sum, ticket) => sum + Number(ticket.actualCutPieceQty || ticket.qty || 0), 0)
    const result = writePdaInboundToFcs({
      identity,
      operator,
      source: buildPdaCuttingWritebackSource('inbound', identity.executionOrderId),
      zoneCode: form.zoneCode,
      locationLabel: form.locationLabel.trim() || `${form.zoneCode}-01 临时位`,
      note: [
        `暂存袋：${form.carrierCode.trim()}`,
        `菲票：${form.scannedTicketNos.join('、')}`,
        `数量：${inboundQty} 片`,
        '入仓暂存袋允许混装',
        form.note.trim(),
      ].filter(Boolean).join('；'),
    })
    if (!result.success) {
      form.feedbackMessage = result.issues.join('；')
      form.syncStatus = '同步失败'
      return true
    }
    form.scanCode = ''
    form.inboundQty = ''
    form.scannedTicketNos = []
    form.feedbackMessage = `入仓已提交，已形成裁床待交出仓库存：${inboundQty} 片。`
    form.syncStatus = '已同步'
    form.backHrefOverride = buildPdaCuttingCompletedReturnHref(
      taskId,
      context.selectedExecutionOrderId,
      context.selectedExecutionOrderNo,
      context.navContext,
      'inbound',
    )
    return true
  }

  return false
}

function appTaskIdFromPath(): string {
  if (typeof window === 'undefined') return ''
  const matched = window.location.pathname.match(/\/fcs\/pda\/cutting\/inbound\/([^/]+)/)
  return matched?.[1] ?? ''
}
