import { escapeHtml } from '../utils'
import { buildPdaCuttingRoute, getPdaCuttingTaskDetail, submitCuttingPickupResult } from '../data/fcs/pda-cutting-special'
import { buildPdaCuttingPickupActionView } from '../domain/pickup/page-adapters/pda-cutting-pickup'
import {
  renderPdaCuttingEmptyState,
  renderPdaCuttingPageLayout,
  renderPdaCuttingSection,
  renderPdaCuttingSummaryGrid,
  renderPdaCuttingTaskHero,
} from './pda-cutting-shared'

interface PickupFormState {
  operatorName: string
  actualReceivedQtyText: string
  resultLabel: string
  discrepancyNote: string
  photoProofCount: string
}

const pickupState = new Map<string, PickupFormState>()

function getState(taskId: string): PickupFormState {
  const existing = pickupState.get(taskId)
  if (existing) return existing

  const detail = getPdaCuttingTaskDetail(taskId)
  const initial: PickupFormState = {
    operatorName: detail?.latestPickupOperatorName && detail.latestPickupOperatorName !== '-' ? detail.latestPickupOperatorName : '现场领料员',
    actualReceivedQtyText: detail?.actualReceivedQtyText && detail.actualReceivedQtyText !== '待扫码回写' ? detail.actualReceivedQtyText : detail?.configuredQtyText ?? '',
    resultLabel: detail?.scanResultLabel && detail.scanResultLabel !== '待扫码领取' ? detail.scanResultLabel : '扫码领取成功',
    discrepancyNote: detail?.discrepancyNote && detail.discrepancyNote !== '当前无差异' ? detail.discrepancyNote : '',
    photoProofCount: String(detail?.photoProofCount ?? 0),
  }
  pickupState.set(taskId, initial)
  return initial
}

function renderTaskSnapshot(taskId: string): string {
  const detail = getPdaCuttingTaskDetail(taskId)
  if (!detail) return ''

  return `
    <div class="grid grid-cols-2 gap-3 text-xs">
      <article class="rounded-xl border bg-muted/20 px-3 py-3">
        <div class="text-muted-foreground">当前任务 / 裁片单</div>
        <div class="mt-1 text-sm font-semibold text-foreground">${escapeHtml(detail.taskNo)}</div>
        <div class="mt-1 text-muted-foreground">生产单：${escapeHtml(detail.productionOrderNo)}</div>
        <div class="mt-1 text-muted-foreground">裁片单：${escapeHtml(detail.cutPieceOrderNo)}</div>
      </article>
      <article class="rounded-xl border bg-muted/20 px-3 py-3">
        <div class="text-muted-foreground">面料对象</div>
        <div class="mt-1 text-sm font-semibold text-foreground">${escapeHtml(detail.materialSku)}</div>
        <div class="mt-1 text-muted-foreground">${escapeHtml(detail.materialTypeLabel)}</div>
        <div class="mt-1 text-muted-foreground">下单数量：${escapeHtml(String(detail.orderQty))} 件</div>
      </article>
    </div>
  `
}

function renderPickupStatus(taskId: string): string {
  const detail = getPdaCuttingTaskDetail(taskId)
  const pickupView = buildPdaCuttingPickupActionView(taskId)
  if (!detail) return ''

  return `
    <div class="grid grid-cols-2 gap-3 text-xs">
      <article class="rounded-xl border px-3 py-3">
        <div class="text-muted-foreground">领料结果状态</div>
        <div class="mt-1 text-sm font-semibold text-foreground">${escapeHtml(pickupView?.latestResultLabel || '未扫码回写')}</div>
        <div class="mt-1 text-muted-foreground">回执状态：${escapeHtml(pickupView?.receiptStatusLabel || '未回执')}</div>
      </article>
      <article class="rounded-xl border px-3 py-3">
        <div class="text-muted-foreground">打印与二维码对象</div>
        <div class="mt-1 text-sm font-semibold text-foreground">${escapeHtml(pickupView?.latestPrintVersionNo || '暂无打印版本')}</div>
        <div class="mt-1 text-muted-foreground">${escapeHtml(detail.qrObjectLabel)}：${escapeHtml(pickupView?.qrCodeValue || detail.qrCodeValue)}</div>
      </article>
      <article class="rounded-xl border px-3 py-3">
        <div class="text-muted-foreground">最近一次扫码领取</div>
        <div class="mt-1 text-sm font-semibold text-foreground">${escapeHtml(pickupView?.latestScannedAt || detail.latestReceiveAt)}</div>
        <div class="mt-1 text-muted-foreground">操作人：${escapeHtml(pickupView?.latestScannedBy || detail.latestReceiveBy)}</div>
        <div class="mt-1 text-muted-foreground">回执记录：${escapeHtml(pickupView?.latestScanRecordNo || detail.latestPickupRecordNo)}</div>
      </article>
      <article class="rounded-xl border px-3 py-3">
        <div class="text-muted-foreground">差异与凭证</div>
        <div class="mt-1 text-sm font-semibold text-foreground">${escapeHtml(detail.discrepancyAllowed ? '支持差异处理' : '仅支持正常领取')}</div>
        <div class="mt-1 text-muted-foreground">照片凭证：${escapeHtml(String(pickupView?.photoProofCount ?? 0))} 张</div>
        <div class="mt-1 text-muted-foreground">${pickupView?.needsRecheck ? '当前回执需复核' : '当前无复核提示'}</div>
      </article>
    </div>
  `
}

function renderPickupLogs(taskId: string): string {
  const detail = getPdaCuttingTaskDetail(taskId)
  const pickupView = buildPdaCuttingPickupActionView(taskId)
  if (!detail || !pickupView || !pickupView.scanRecords.length) {
    return renderPdaCuttingEmptyState('暂无扫码领料记录', '后续真实扫码领料完成后，这里会展示扫码时间、领取人、差异结果和照片凭证摘要。')
  }

  return `
    <div class="space-y-2">
      ${pickupView.scanRecords
        .map(
          (log) => `
            <article class="rounded-xl border px-3 py-3 text-xs">
              <div class="flex items-center justify-between gap-2">
                <div class="font-medium text-foreground">${escapeHtml(log.resultStatus === 'MATCHED' ? '扫码领取成功' : log.resultStatus === 'RECHECK_REQUIRED' ? '驳回核对' : log.resultStatus === 'PHOTO_SUBMITTED' ? '带照片提交' : '已取消')}</div>
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
  const detail = getPdaCuttingTaskDetail(taskId)
  const pickupView = buildPdaCuttingPickupActionView(taskId)

  if (!detail) {
    return renderPdaCuttingPageLayout({
      taskId,
      title: '扫码领料',
      subtitle: '扫码领料页承接领料单、二维码与领料结果回写。',
      activeTab: 'exec',
      body: '',
      backHref: buildPdaCuttingRoute(taskId, 'task'),
    })
  }

  const form = getState(taskId)

  const summary = renderPdaCuttingSummaryGrid([
    { label: '领料单号', value: pickupView?.pickupSlipNo || detail.pickupSlipNo },
    { label: '二维码', value: pickupView?.qrCodeValue || detail.qrCodeValue },
    { label: '最新打印版本', value: pickupView?.latestPrintVersionNo || '暂无打印版本' },
    { label: '当前结果', value: pickupView?.latestResultLabel || '未扫码回写', hint: pickupView?.receiptStatusLabel || '未回执' },
  ])

  const scanSection = `
    <div class="space-y-3 text-xs">
      <div class="rounded-xl border border-dashed px-3 py-4 text-center">
        <div class="text-sm font-medium text-foreground">扫码入口区</div>
        <p class="mt-1 text-muted-foreground">当前页聚焦扫码领料确认，真实扫码能力后续补齐，先把现场对象、二维码和值班动作说明清楚。</p>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div class="rounded-xl border px-3 py-3">
          <div class="text-muted-foreground">领料单 / 二维码</div>
          <div class="mt-1 font-medium text-foreground">${escapeHtml(pickupView?.pickupSlipNo || detail.pickupSlipNo)}</div>
          <div class="mt-1 text-muted-foreground">${escapeHtml(pickupView?.qrCodeValue || detail.qrCodeValue)}</div>
        </div>
        <div class="rounded-xl border px-3 py-3">
          <div class="text-muted-foreground">配置数量 vs 实领数量</div>
          <div class="mt-1 font-medium text-foreground">${escapeHtml(pickupView?.slip.configuredQtySummary.summaryText || detail.configuredQtyText)}</div>
          <div class="mt-1 text-muted-foreground">当前实领：${escapeHtml(pickupView?.slip.receivedQtySummary.summaryText || detail.actualReceivedQtyText)}</div>
        </div>
      </div>
      <div class="rounded-xl bg-blue-50 px-3 py-3 text-xs text-blue-800">
        扫码对象是裁片单级二维码，当前二维码与领料单、裁片单号是一一对应关系。若现场发现差异，请走“驳回核对”或“带照片提交”。
      </div>
    </div>
  `

  const formSection = `
    <div class="space-y-3 text-xs">
      <label class="block space-y-1">
        <span class="text-muted-foreground">操作人</span>
        <input class="h-10 w-full rounded-xl border bg-background px-3 text-sm" data-pda-cut-pickup-field="operatorName" value="${escapeHtml(form.operatorName)}" />
      </label>
      <label class="block space-y-1">
        <span class="text-muted-foreground">实领数量摘要</span>
        <input class="h-10 w-full rounded-xl border bg-background px-3 text-sm" data-pda-cut-pickup-field="actualReceivedQtyText" value="${escapeHtml(form.actualReceivedQtyText)}" placeholder="例如：卷数 8 卷 / 长度 318 米" />
      </label>
      <label class="block space-y-1">
        <span class="text-muted-foreground">领料结果</span>
        <select class="h-10 w-full rounded-xl border bg-background px-3 text-sm" data-pda-cut-pickup-field="resultLabel">
          ${['扫码领取成功', '驳回核对', '带照片提交'].map((item) => `<option value="${escapeHtml(item)}" ${form.resultLabel === item ? 'selected' : ''}>${escapeHtml(item)}</option>`).join('')}
        </select>
      </label>
      <label class="block space-y-1">
        <span class="text-muted-foreground">差异说明</span>
        <textarea class="min-h-24 w-full rounded-xl border bg-background px-3 py-2 text-sm" data-pda-cut-pickup-field="discrepancyNote" placeholder="请填写领料数量差异、驳回原因或照片凭证说明">${escapeHtml(form.discrepancyNote)}</textarea>
      </label>
      <label class="block space-y-1">
        <span class="text-muted-foreground">照片凭证数量</span>
        <input class="h-10 w-full rounded-xl border bg-background px-3 text-sm" data-pda-cut-pickup-field="photoProofCount" value="${escapeHtml(form.photoProofCount)}" />
      </label>
      <div class="rounded-xl border bg-muted/20 px-3 py-3">
        <div class="text-muted-foreground">本次回写预览</div>
        <div class="mt-1 text-sm font-semibold text-foreground">${escapeHtml(form.resultLabel)}</div>
        <div class="mt-1 text-muted-foreground">实领数量：${escapeHtml(form.actualReceivedQtyText || '待填写')}</div>
        <div class="mt-1 text-muted-foreground">差异说明：${escapeHtml(form.discrepancyNote || '当前无差异')}</div>
        <div class="mt-1 text-muted-foreground">统一回执状态：${escapeHtml(form.resultLabel === '扫码领取成功' ? '已回执' : form.resultLabel === '驳回核对' ? '待复核' : '已提交照片')}</div>
      </div>
      <div class="rounded-xl bg-amber-50 px-3 py-3 text-xs text-amber-800">
        差异处理入口已预留：若选择“驳回核对”或“带照片提交”，请同步填写差异说明和凭证数量。
      </div>
      <div class="grid grid-cols-2 gap-2">
        <button class="inline-flex min-h-10 items-center justify-center rounded-xl border px-3 py-2 text-xs font-medium hover:bg-muted" data-nav="${escapeHtml(buildPdaCuttingRoute(taskId, 'task'))}">
          返回任务详情
        </button>
        <button class="inline-flex min-h-10 items-center justify-center rounded-xl bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:opacity-90" data-pda-cut-pickup-action="submit" data-task-id="${escapeHtml(taskId)}">
          提交领料结果
        </button>
      </div>
    </div>
  `

  const body = `
    ${renderPdaCuttingTaskHero(detail)}
    ${summary}
    ${renderPdaCuttingSection('当前任务 / 裁片单摘要', '先确认当前正在处理哪张裁片单、哪种面料和哪张领料单。', renderTaskSnapshot(taskId))}
    ${renderPdaCuttingSection('扫码入口与领料单摘要', '强调二维码、领料单和配置数量之间的对应关系。', scanSection)}
    ${renderPdaCuttingSection('差异处理与领料回写', '现场扫码后在此回写领取结果、差异说明和照片凭证位。', formSection)}
    ${renderPdaCuttingSection('领料结果状态', '这里集中展示打印状态、二维码对象、最近一次扫码结果和差异凭证摘要。', renderPickupStatus(taskId))}
    ${renderPdaCuttingSection('最近领料结果', '领料结果只展示工厂端现场回写摘要，不在这里做真实扫码系统。', renderPickupLogs(taskId))}
  `

  return renderPdaCuttingPageLayout({
    taskId,
    title: '扫码领料',
    subtitle: '承接领料单、二维码和领料结果回写，先把现场执行骨架和状态位搭起来。',
    activeTab: 'exec',
    body,
    backHref: buildPdaCuttingRoute(taskId, 'task'),
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
    const form = getState(taskId)
    const field = fieldNode.dataset.pdaCutPickupField
    if (!field) return true

    if (field === 'operatorName') form.operatorName = fieldNode.value
    if (field === 'actualReceivedQtyText') form.actualReceivedQtyText = fieldNode.value
    if (field === 'resultLabel') form.resultLabel = fieldNode.value
    if (field === 'discrepancyNote') form.discrepancyNote = fieldNode.value
    if (field === 'photoProofCount') form.photoProofCount = fieldNode.value
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-pda-cut-pickup-action]')
  if (!actionNode) return false
  const action = actionNode.dataset.pdaCutPickupAction
  const taskId = actionNode.dataset.taskId
  if (!action || !taskId) return false

  if (action === 'submit') {
    const form = getState(taskId)
    submitCuttingPickupResult(taskId, {
      operatorName: form.operatorName.trim() || '现场领料员',
      resultLabel: form.resultLabel,
      actualReceivedQtyText: form.actualReceivedQtyText.trim() || '待补充实领数量',
      discrepancyNote: form.discrepancyNote.trim() || '当前无差异',
      photoProofCount: Number(form.photoProofCount || '0') || 0,
    })
    return true
  }

  return false
}

function appTaskIdFromPath(): string {
  if (typeof window === 'undefined') return ''
  const matched = window.location.pathname.match(/\/fcs\/pda\/cutting\/pickup\/([^/]+)/)
  return matched?.[1] ?? ''
}
