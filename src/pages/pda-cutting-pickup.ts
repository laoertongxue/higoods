import { escapeHtml } from '../utils'
import { buildPdaCuttingPickupActionView } from '../domain/pickup/page-adapters/pda-cutting-pickup'
import { buildPdaCuttingPickupProjection } from './pda-cutting-pickup-projection'
import {
  buildClaimDisputeEvidenceFiles,
  computeClaimDisputeQty,
  getClaimDisputeEvidenceHint,
  getClaimDisputeStatusMeta,
  parseLengthQtyFromText,
} from '../helpers/fcs-claim-dispute'
import {
  buildPdaCuttingWritebackSource,
  resolvePdaCuttingWritebackIdentity,
  resolvePdaCuttingWritebackOperator,
} from '../data/fcs/pda-cutting-writeback-inputs.ts'
import { writePdaPickupToFcs } from '../domain/cutting-pda-writeback/bridge.ts'
import {
  createClaimDispute,
  getLatestClaimDisputeByOriginalCutOrderNo,
  getLatestClaimDisputeByTaskId,
} from '../state/fcs-claim-dispute-store'
import {
  renderPdaCuttingFeedbackNotice,
  buildPdaCuttingExecutionStateKey,
  renderPdaCuttingEmptyState,
  renderPdaCuttingExecutionHero,
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

interface PickupFormState {
  operatorName: string
  actualClaimQtyText: string
  actualReceivedQtyText: string
  resultLabel: string
  disputeReason: string
  discrepancyNote: string
  photoProofCount: string
  imageProofNames: string[]
  videoProofNames: string[]
  feedbackMessage: string
  feedbackTone: 'default' | 'success' | 'warning'
  backHrefOverride: string
}

const pickupState = new Map<string, PickupFormState>()

function getPickupDetail(taskId: string, executionKey?: string | null) {
  return buildPdaCuttingPickupProjection(taskId, executionKey ?? undefined)?.detail ?? null
}

function getState(taskId: string, executionOrderId?: string | null, executionOrderNo?: string | null): PickupFormState {
  const stateKey = buildPdaCuttingExecutionStateKey(taskId, executionOrderId, executionOrderNo)
  const existing = pickupState.get(stateKey)
  if (existing) return existing

  const detail = getPickupDetail(taskId, executionOrderId ?? executionOrderNo ?? undefined)
  const initial: PickupFormState = {
    operatorName: detail?.latestPickupOperatorName && detail.latestPickupOperatorName !== '-' ? detail.latestPickupOperatorName : '现场领料员',
    actualClaimQtyText: detail ? String(parseLengthQtyFromText(detail.actualReceivedQtyText || detail.configuredQtyText || '')) : '',
    actualReceivedQtyText:
      detail?.actualReceivedQtyText &&
      detail.actualReceivedQtyText !== '待扫码回写' &&
      detail.actualReceivedQtyText !== '待回写'
        ? detail.actualReceivedQtyText
        : detail?.configuredQtyText ?? '',
    resultLabel:
      detail?.scanResultLabel && !['待扫码领取', '待领料确认'].includes(detail.scanResultLabel)
        ? getPickupResultLabel(detail.scanResultLabel)
        : '领取成功',
    disputeReason: '',
    discrepancyNote: detail?.discrepancyNote && detail.discrepancyNote !== '当前无差异' ? detail.discrepancyNote : '',
    photoProofCount: String(detail?.photoProofCount ?? 0),
    imageProofNames: [],
    videoProofNames: [],
    feedbackMessage: '',
    feedbackTone: 'default',
    backHrefOverride: '',
  }
  pickupState.set(stateKey, initial)
  return initial
}

function formatQty(value: number): string {
  return `${Number.isFinite(value) ? value : 0} 米`
}

function getExpectedClaimQty(taskId: string, executionKey?: string | null): number {
  const detail = getPickupDetail(taskId, executionKey)
  return detail ? parseLengthQtyFromText(detail.configuredQtyText) : 0
}

function getActualClaimQty(taskId: string, executionOrderId?: string | null, executionOrderNo?: string | null): number {
  const form = getState(taskId, executionOrderId, executionOrderNo)
  return Number(form.actualClaimQtyText || '0') || 0
}

function hasDisputeMismatch(taskId: string, executionOrderId?: string | null, executionOrderNo?: string | null): boolean {
  return getActualClaimQty(taskId, executionOrderId, executionOrderNo) !== getExpectedClaimQty(taskId, executionOrderId ?? executionOrderNo)
}

function syncActualSummaryText(taskId: string, executionOrderId?: string | null, executionOrderNo?: string | null): void {
  const detail = getPickupDetail(taskId, executionOrderId ?? executionOrderNo ?? undefined)
  const form = getState(taskId, executionOrderId, executionOrderNo)
  const rollCount = detail ? detail.configuredQtyText.match(/卷数\\s*([0-9]+\\s*卷)/)?.[1] || '卷数待补' : '卷数待补'
  const actualClaimQty = getActualClaimQty(taskId, executionOrderId, executionOrderNo)
  form.actualReceivedQtyText = `${rollCount} / 长度 ${actualClaimQty || 0} 米`
  form.photoProofCount = String(form.imageProofNames.length + form.videoProofNames.length)
}

function getPickupResultLabel(value: string): string {
  if (value === '扫码领取成功' || value === '领取成功') return '领取成功'
  if (value === '驳回核对' || value === '驳回复核') return '驳回复核'
  if (value === '带照片提交' || value === '提交凭证') return '提交凭证'
  if (value === '待扫码领取' || value === '待领料确认') return '待领料确认'
  if (value === '未扫码回写' || value === '待回写') return '待回写'
  return value
}

function renderDisputeStatus(taskId: string, executionOrderId?: string | null, executionOrderNo?: string | null): string {
  const detail = getPickupDetail(taskId, executionOrderId ?? executionOrderNo ?? undefined)
  const originalCutOrderNo =
    detail?.cutPieceOrders.find((item) => item.executionOrderId === executionOrderId || item.executionOrderNo === executionOrderNo)
      ?.originalCutOrderNo || detail?.originalCutOrderNo || executionOrderNo
  const latestDispute =
    (originalCutOrderNo ? getLatestClaimDisputeByOriginalCutOrderNo(originalCutOrderNo) : null) ||
    getLatestClaimDisputeByTaskId(taskId)
  if (!latestDispute) return ''
  const meta = getClaimDisputeStatusMeta(latestDispute.status)
  return `
    <div class="rounded-xl border border-blue-200 bg-blue-50 px-3 py-3 text-xs">
      <div class="flex items-center justify-between gap-2">
        <div class="text-sm font-medium text-foreground">当前领料异议</div>
        <span class="inline-flex items-center rounded-full border px-2 py-0.5 ${meta.className}">${escapeHtml(meta.label)}</span>
      </div>
      <div class="mt-2 space-y-1 text-muted-foreground">
        <p>差异数量：${escapeHtml(formatQty(latestDispute.discrepancyQty))}</p>
        <p>证据数量：${escapeHtml(String(latestDispute.evidenceCount))} 个</p>
        <p>平台处理：${escapeHtml(latestDispute.handleConclusion || '待平台处理')}</p>
        <p>处理说明：${escapeHtml(latestDispute.handleNote || '待平台回写')}</p>
      </div>
    </div>
  `
}

function renderPickupCurrentStatus(
  taskId: string,
  detail: NonNullable<ReturnType<typeof getPickupDetail>>,
  executionKey?: string | null,
): string {
  const pickupView = buildPdaCuttingPickupActionView(taskId, executionKey ?? detail.executionOrderId)
  if (!detail) return ''

  return renderPdaCuttingSummaryGrid([
    { label: '当前领料状态', value: getPickupResultLabel(pickupView?.latestResultLabel || detail.currentReceiveStatus), hint: pickupView?.receiptStatusLabel || detail.currentReceiveStatus },
    { label: '领料单号', value: pickupView?.pickupSlipNo || detail.pickupSlipNo },
    { label: '裁片单主码', value: pickupView?.qrCodeValue || detail.qrCodeValue },
    { label: '最新打印版本', value: pickupView?.latestPrintVersionNo || '暂无打印版本' },
  ])
}

function renderPickupLogs(
  taskId: string,
  detail: NonNullable<ReturnType<typeof getPickupDetail>>,
  executionKey?: string | null,
): string {
  const pickupView = buildPdaCuttingPickupActionView(taskId, executionKey ?? detail.executionOrderId)
  if (!detail || !pickupView || !pickupView.scanRecords.length) {
    return renderPdaCuttingEmptyState('当前裁片单暂无领料记录', '')
  }

  return `
    <div class="space-y-2">
      ${pickupView.scanRecords
        .map(
          (log) => `
            <article class="rounded-xl border px-3 py-3 text-xs">
              <div class="flex items-center justify-between gap-2">
                <div class="font-medium text-foreground">${escapeHtml(log.resultStatus === 'MATCHED' ? '领取成功' : log.resultStatus === 'RECHECK_REQUIRED' ? '驳回复核' : log.resultStatus === 'PHOTO_SUBMITTED' ? '提交凭证' : '已取消')}</div>
                <div class="text-muted-foreground">${escapeHtml(log.scannedAt)}</div>
              </div>
              <div class="mt-2 text-muted-foreground">领取人：${escapeHtml(log.scannedBy)}</div>
              <div class="mt-1 text-muted-foreground">实领摘要：${escapeHtml(log.receivedQtySummary.summaryText)}</div>
              <div class="mt-1 text-muted-foreground">备注：${escapeHtml(log.note || '无')}</div>
              <div class="mt-1 text-muted-foreground">照片凭证：${escapeHtml(String(log.photoProofCount))} 张</div>
            </article>
          `,
        )
        .join('')}
    </div>
  `
}

export function renderPdaCuttingPickupPage(taskId: string): string {
  const context = buildPdaCuttingExecutionContext(taskId, 'pickup')
  const detail = context.detail
  const pickupView = buildPdaCuttingPickupActionView(taskId, context.selectedExecutionOrderId ?? context.selectedExecutionOrderNo ?? undefined)

  if (!detail) {
    return renderPdaCuttingPageLayout({
      taskId,
      title: '扫码领料',
      subtitle: '',
      activeTab: 'exec',
      body: '',
      backHref: context.backHref,
    })
  }

  if (context.requiresCutPieceOrderSelection) {
    return renderPdaCuttingPageLayout({
      taskId,
      title: '扫码领料',
      subtitle: '',
      activeTab: 'exec',
      body: renderPdaCuttingOrderSelectionPrompt(detail, context.backHref, context.selectionNotice || undefined),
      backHref: context.backHref,
    })
  }

  const form = getState(taskId, context.selectedExecutionOrderId, context.selectedExecutionOrderNo)
  const pageBackHref = form.backHrefOverride || context.backHref
  const expectedClaimQty = getExpectedClaimQty(taskId, context.selectedExecutionOrderId ?? context.selectedExecutionOrderNo)
  const actualClaimQty = getActualClaimQty(taskId, context.selectedExecutionOrderId, context.selectedExecutionOrderNo)
  const discrepancyQty = computeClaimDisputeQty(actualClaimQty, expectedClaimQty)
  const mismatch = hasDisputeMismatch(taskId, context.selectedExecutionOrderId, context.selectedExecutionOrderNo)

  const formSection = `
    <div class="space-y-3 text-xs">
      <label class="block space-y-1">
        <span class="text-muted-foreground">操作人</span>
        <input class="h-10 w-full rounded-xl border bg-background px-3 text-sm" data-pda-cut-pickup-field="operatorName" value="${escapeHtml(form.operatorName)}" />
      </label>
      <div class="grid grid-cols-2 gap-3">
        <label class="block space-y-1">
          <span class="text-muted-foreground">默认应领数量（米）</span>
          <input class="h-10 w-full rounded-xl border bg-muted/20 px-3 text-sm" value="${escapeHtml(String(expectedClaimQty))}" readonly />
        </label>
        <label class="block space-y-1">
          <span class="text-muted-foreground">实际领取数量（米）</span>
          <input type="number" min="0" step="1" class="h-10 w-full rounded-xl border bg-background px-3 text-sm" data-pda-cut-pickup-field="actualClaimQtyText" value="${escapeHtml(form.actualClaimQtyText)}" placeholder="请输入实际领取数量" />
        </label>
      </div>
      <div class="rounded-xl border px-3 py-3">
        <div class="text-muted-foreground">差异数量</div>
        <div class="mt-1 text-sm font-semibold text-foreground">${escapeHtml(formatQty(discrepancyQty))}</div>
        <div class="mt-1 text-muted-foreground">${mismatch ? '当前实领数量与仓库配置数量不一致，可发起数量异议。' : '当前实领数量与默认应领数量一致，可正常确认领料成功。'}</div>
      </div>
      <label class="block space-y-1">
        <span class="text-muted-foreground">实领数量摘要</span>
        <input class="h-10 w-full rounded-xl border bg-muted/20 px-3 text-sm" data-pda-cut-pickup-field="actualReceivedQtyText" value="${escapeHtml(form.actualReceivedQtyText)}" placeholder="例如：卷数 8 卷 / 长度 318 米" readonly />
      </label>
      <label class="block space-y-1">
        <span class="text-muted-foreground">领料结果</span>
        <select class="h-10 w-full rounded-xl border bg-background px-3 text-sm" data-pda-cut-pickup-field="resultLabel">
          ${['领取成功', '驳回复核', '提交凭证'].map((item) => `<option value="${escapeHtml(item)}" ${form.resultLabel === item ? 'selected' : ''}>${escapeHtml(getPickupResultLabel(item))}</option>`).join('')}
        </select>
      </label>
      <label class="block space-y-1">
        <span class="text-muted-foreground">异议原因</span>
        <select class="h-10 w-full rounded-xl border bg-background px-3 text-sm" data-pda-cut-pickup-field="disputeReason">
          ${['', '数量不符', '少卷 / 少米数', '现场复点异常', '其他数量异议'].map((item) => `<option value="${escapeHtml(item)}" ${form.disputeReason === item ? 'selected' : ''}>${escapeHtml(item || '请选择异议原因')}</option>`).join('')}
        </select>
      </label>
      <label class="block space-y-1">
        <span class="text-muted-foreground">差异说明</span>
        <textarea class="min-h-24 w-full rounded-xl border bg-background px-3 py-2 text-sm" data-pda-cut-pickup-field="discrepancyNote" placeholder="请填写领料数量差异、驳回原因或照片凭证说明">${escapeHtml(form.discrepancyNote)}</textarea>
      </label>
      <div class="rounded-xl border px-3 py-3">
        <div class="flex flex-wrap items-center gap-2">
          <button class="inline-flex min-h-9 items-center justify-center rounded-xl border px-3 py-2 text-xs font-medium hover:bg-muted" data-pda-cut-pickup-action="add-image-proof" data-task-id="${escapeHtml(taskId)}">
            添加图片凭证
          </button>
          <button class="inline-flex min-h-9 items-center justify-center rounded-xl border px-3 py-2 text-xs font-medium hover:bg-muted" data-pda-cut-pickup-action="add-video-proof" data-task-id="${escapeHtml(taskId)}">
            添加视频凭证
          </button>
          <span class="text-muted-foreground">证据数量：${escapeHtml(form.photoProofCount)} 个</span>
        </div>
        <p class="mt-2 text-[11px] text-muted-foreground">${escapeHtml(getClaimDisputeEvidenceHint())}</p>
        ${
          form.imageProofNames.length || form.videoProofNames.length
            ? `
              <div class="mt-3 space-y-2">
                ${[...form.imageProofNames.map((name) => ({ type: 'IMAGE' as const, name })), ...form.videoProofNames.map((name) => ({ type: 'VIDEO' as const, name }))]
                  .map(
                    (file) => `
                      <div class="flex items-center justify-between gap-2 rounded-lg border bg-muted/10 px-3 py-2">
                        <div class="text-xs text-muted-foreground">${escapeHtml(file.type === 'IMAGE' ? '图片' : '视频')}：${escapeHtml(file.name)}</div>
                        <button class="text-xs text-rose-600 hover:underline" data-pda-cut-pickup-action="remove-proof" data-task-id="${escapeHtml(taskId)}" data-file-type="${file.type}" data-file-name="${escapeHtml(file.name)}">移除</button>
                      </div>
                    `,
                  )
                  .join('')}
              </div>
            `
            : ''
        }
      </div>
      <div class="rounded-xl border bg-muted/20 px-3 py-3">
        <div class="text-muted-foreground">本次回写预览</div>
        <div class="mt-1 text-sm font-semibold text-foreground">${escapeHtml(getPickupResultLabel(form.resultLabel))}</div>
        <div class="mt-1 text-muted-foreground">实领数量：${escapeHtml(form.actualReceivedQtyText || '待填写')}</div>
        <div class="mt-1 text-muted-foreground">差异说明：${escapeHtml(form.discrepancyNote || '当前无差异')}</div>
        <div class="mt-1 text-muted-foreground">统一回执状态：${escapeHtml(form.resultLabel === '领取成功' ? '已回执' : form.resultLabel === '驳回复核' ? '待复核' : '已提交照片')}</div>
      </div>
      <div class="rounded-xl bg-amber-50 px-3 py-3 text-xs text-amber-800">
        若实际领取数量与默认应领数量不一致，必须走“数量异议发起”路径，并至少上传图片或视频之一。
      </div>
      ${
        form.feedbackMessage
          ? renderPdaCuttingFeedbackNotice(form.feedbackMessage, form.feedbackTone === 'warning' ? 'warning' : form.feedbackTone === 'success' ? 'success' : 'default')
          : ''
      }
      ${renderDisputeStatus(taskId, context.selectedExecutionOrderId, context.selectedExecutionOrderNo)}
      <div class="grid grid-cols-2 gap-2">
        <button class="inline-flex min-h-10 items-center justify-center rounded-xl border px-3 py-2 text-xs font-medium hover:bg-muted" data-nav="${escapeHtml(pageBackHref)}">
          返回裁片任务
        </button>
        <button class="inline-flex min-h-10 items-center justify-center rounded-xl bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:opacity-90" data-pda-cut-pickup-action="submit" data-task-id="${escapeHtml(taskId)}">
          确认领料
        </button>
        <button class="inline-flex min-h-10 items-center justify-center rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 hover:bg-amber-100" data-pda-cut-pickup-action="submit-dispute" data-task-id="${escapeHtml(taskId)}">
          提交数量异议
        </button>
      </div>
    </div>
  `

  const body = `
    ${renderPdaCuttingExecutionHero('扫码领料', detail)}
    ${renderPdaCuttingSection('当前情况', '', renderPickupCurrentStatus(taskId, detail, context.selectedExecutionOrderId ?? context.selectedExecutionOrderNo))}
    ${renderPdaCuttingSection('领料确认', '', formSection)}
    ${renderPdaCuttingSection('最近领料记录', '', renderPickupLogs(taskId, detail, context.selectedExecutionOrderId ?? context.selectedExecutionOrderNo))}
  `

  return renderPdaCuttingPageLayout({
    taskId,
    title: '扫码领料',
    subtitle: '',
    activeTab: 'exec',
    body,
    backHref: pageBackHref,
  })
}

export function handlePdaCuttingPickupEvent(target: HTMLElement): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-pda-cut-pickup-field]')
  if (
    fieldNode instanceof HTMLInputElement ||
    fieldNode instanceof HTMLSelectElement ||
    fieldNode instanceof HTMLTextAreaElement
  ) {
    const taskId = fieldNode.closest<HTMLElement>('[data-task-id]')?.dataset.taskId || appTaskIdFromPath()
    if (!taskId) return true
    const selectedExecutionOrderId = readSelectedExecutionOrderIdFromLocation()
    const selectedExecutionOrderNo = readSelectedExecutionOrderNoFromLocation()
    const form = getState(taskId, selectedExecutionOrderId, selectedExecutionOrderNo)
    const field = fieldNode.dataset.pdaCutPickupField
    if (!field) return true

    if (field === 'operatorName') form.operatorName = fieldNode.value
    if (field === 'actualClaimQtyText') {
      form.actualClaimQtyText = fieldNode.value
      syncActualSummaryText(taskId, selectedExecutionOrderId, selectedExecutionOrderNo)
    }
    if (field === 'actualReceivedQtyText') form.actualReceivedQtyText = fieldNode.value
    if (field === 'resultLabel') form.resultLabel = fieldNode.value
    if (field === 'disputeReason') form.disputeReason = fieldNode.value
    if (field === 'discrepancyNote') form.discrepancyNote = fieldNode.value
    if (field === 'photoProofCount') form.photoProofCount = fieldNode.value
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-pda-cut-pickup-action]')
  if (!actionNode) return false
  const action = actionNode.dataset.pdaCutPickupAction
  const taskId = actionNode.dataset.taskId
  if (!action || !taskId) return false
  const selectedExecutionOrderId = readSelectedExecutionOrderIdFromLocation()
  const selectedExecutionOrderNo = readSelectedExecutionOrderNoFromLocation()

  if (action === 'submit') {
    const form = getState(taskId, selectedExecutionOrderId, selectedExecutionOrderNo)
    const context = buildPdaCuttingExecutionContext(taskId, 'pickup')
    const expectedClaimQty = getExpectedClaimQty(taskId, selectedExecutionOrderId ?? selectedExecutionOrderNo)
    const actualClaimQty = getActualClaimQty(taskId, selectedExecutionOrderId, selectedExecutionOrderNo)
    if (hasDisputeMismatch(taskId, selectedExecutionOrderId, selectedExecutionOrderNo)) {
      form.feedbackMessage = '当前实领数量与默认应领数量不一致，请走“提交数量异议”路径。'
      form.feedbackTone = 'warning'
      return true
    }
    const identity = resolvePdaCuttingWritebackIdentity(taskId, {
      executionOrderId: context.selectedExecutionOrderId || undefined,
      executionOrderNo: context.selectedExecutionOrderNo || undefined,
      originalCutOrderId: context.selectedExecutionOrder?.originalCutOrderId || undefined,
      originalCutOrderNo: context.selectedExecutionOrder?.originalCutOrderNo || undefined,
      mergeBatchId: context.selectedExecutionOrder?.mergeBatchId || undefined,
      mergeBatchNo: context.selectedExecutionOrder?.mergeBatchNo || undefined,
      materialSku: context.selectedExecutionOrder?.materialSku || undefined,
    })
    const operator = resolvePdaCuttingWritebackOperator(taskId, form.operatorName.trim() || '现场领料员')
    if (!identity || !operator) {
      form.feedbackMessage = '当前执行对象或操作人无法识别，不能提交领料结果。'
      form.feedbackTone = 'warning'
      return true
    }
    const result = writePdaPickupToFcs({
      identity,
      operator,
      source: buildPdaCuttingWritebackSource('pickup', identity.executionOrderId),
      resultLabel: '领取成功',
      actualReceivedQtyText: form.actualReceivedQtyText.trim() || `长度 ${expectedClaimQty || actualClaimQty} 米`,
      discrepancyNote: form.discrepancyNote.trim() || '当前无差异',
      photoProofCount: Number(form.photoProofCount || '0') || 0,
    })
    if (!result.success) {
      form.feedbackMessage = result.issues.join('；')
      form.feedbackTone = 'warning'
      return true
    }
    form.feedbackMessage = '领料结果已按一致数量回写。'
    form.feedbackTone = 'success'
    form.backHrefOverride = buildPdaCuttingCompletedReturnHref(
      taskId,
      context.selectedExecutionOrderId,
      context.selectedExecutionOrderNo,
      context.navContext,
      'pickup',
    )
    return true
  }

  if (action === 'add-image-proof' || action === 'add-video-proof') {
    const form = getState(taskId, selectedExecutionOrderId, selectedExecutionOrderNo)
    const nowSuffix = new Date().toISOString().replace(/[^0-9]/g, '').slice(-6)
    if (action === 'add-image-proof') {
      form.imageProofNames = [...form.imageProofNames, `领料异议图片-${nowSuffix}.jpg`]
    } else {
      form.videoProofNames = [...form.videoProofNames, `领料异议视频-${nowSuffix}.mp4`]
    }
    syncActualSummaryText(taskId, selectedExecutionOrderId, selectedExecutionOrderNo)
    form.feedbackMessage = ''
    return true
  }

  if (action === 'remove-proof') {
    const form = getState(taskId, selectedExecutionOrderId, selectedExecutionOrderNo)
    const fileType = actionNode.dataset.fileType
    const fileName = actionNode.dataset.fileName
    if (fileType === 'IMAGE') {
      form.imageProofNames = form.imageProofNames.filter((item) => item !== fileName)
    }
    if (fileType === 'VIDEO') {
      form.videoProofNames = form.videoProofNames.filter((item) => item !== fileName)
    }
    syncActualSummaryText(taskId, selectedExecutionOrderId, selectedExecutionOrderNo)
    return true
  }

  if (action === 'submit-dispute') {
    const detail = getPickupDetail(taskId, selectedExecutionOrderId ?? selectedExecutionOrderNo ?? undefined)
    const form = getState(taskId, selectedExecutionOrderId, selectedExecutionOrderNo)
    const context = buildPdaCuttingExecutionContext(taskId, 'pickup')
    if (!detail) return true
    if (!hasDisputeMismatch(taskId, selectedExecutionOrderId, selectedExecutionOrderNo)) {
      form.feedbackTone = 'warning'
      form.feedbackMessage = '当前没有数量差异，无需提交数量异议。'
      return true
    }

    const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
    const imageFiles = buildClaimDisputeEvidenceFiles(form.imageProofNames, 'IMAGE', now)
    const videoFiles = buildClaimDisputeEvidenceFiles(form.videoProofNames, 'VIDEO', now)
    const result = createClaimDispute({
      sourceTaskId: taskId,
      sourceTaskNo: detail.taskNo,
      originalCutOrderNo: context.selectedExecutionOrder?.originalCutOrderNo || detail.originalCutOrderNo,
      productionOrderNo: detail.productionOrderNo,
      relatedClaimRecordNo: detail.latestPickupRecordNo || detail.pickupSlipNo,
      materialSku: detail.materialSku,
      materialCategory: detail.materialTypeLabel,
      materialAttr: detail.qrObjectLabel,
      configuredQty: getExpectedClaimQty(taskId, selectedExecutionOrderId ?? selectedExecutionOrderNo),
      actualClaimQty: getActualClaimQty(taskId, selectedExecutionOrderId, selectedExecutionOrderNo),
      disputeReason: form.disputeReason.trim(),
      disputeNote: form.discrepancyNote.trim(),
      submittedBy: form.operatorName.trim() || '现场领料员',
      submittedAt: now,
      imageFiles,
      videoFiles,
      note: '移动端发起裁片领料数量异议',
    })

    if (!result.record) {
      form.feedbackMessage = result.issues.join('；')
      form.feedbackTone = 'warning'
      return true
    }

    const identity = resolvePdaCuttingWritebackIdentity(taskId, {
      executionOrderId: context.selectedExecutionOrderId || undefined,
      executionOrderNo: context.selectedExecutionOrderNo || undefined,
      originalCutOrderId: context.selectedExecutionOrder?.originalCutOrderId || undefined,
      originalCutOrderNo: context.selectedExecutionOrder?.originalCutOrderNo || undefined,
      mergeBatchId: context.selectedExecutionOrder?.mergeBatchId || undefined,
      mergeBatchNo: context.selectedExecutionOrder?.mergeBatchNo || undefined,
      materialSku: context.selectedExecutionOrder?.materialSku || undefined,
    })
    const operator = resolvePdaCuttingWritebackOperator(taskId, form.operatorName.trim() || '现场领料员')
    if (!identity || !operator) {
      form.feedbackMessage = '当前执行对象或操作人无法识别，不能提交数量异议。'
      form.feedbackTone = 'warning'
      return true
    }
    const submitResult = writePdaPickupToFcs({
      identity,
      operator,
      source: buildPdaCuttingWritebackSource('pickup', identity.executionOrderId),
      resultLabel: '已发起数量异议',
      actualReceivedQtyText: form.actualReceivedQtyText.trim() || `长度 ${getActualClaimQty(taskId, selectedExecutionOrderId, selectedExecutionOrderNo)} 米`,
      discrepancyNote: form.discrepancyNote.trim() || form.disputeReason.trim(),
      photoProofCount: result.record.evidenceCount,
      claimDisputeId: result.record.disputeId,
      claimDisputeNo: result.record.disputeNo,
    })
    if (!submitResult.success) {
      form.feedbackMessage = submitResult.issues.join('；')
      form.feedbackTone = 'warning'
      return true
    }

    form.resultLabel = '已发起数量异议'
    form.photoProofCount = String(result.record.evidenceCount)
    form.feedbackMessage = `数量异议已提交：${result.record.disputeNo}`
    form.feedbackTone = 'success'
    form.backHrefOverride = buildPdaCuttingCompletedReturnHref(
      taskId,
      context.selectedExecutionOrderId,
      context.selectedExecutionOrderNo,
      context.navContext,
      'pickup',
    )
    return true
  }

  return false
}

function appTaskIdFromPath(): string {
  if (typeof window === 'undefined') return ''
  const matched = window.location.pathname.match(/\/fcs\/pda\/cutting\/pickup\/([^/]+)/)
  return matched?.[1] ?? ''
}
