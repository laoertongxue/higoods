import { appStore } from '../state/store'
import {
  confirmQualityDeductionFactoryResponse,
  submitQualityDeductionDispute,
} from '../data/fcs/quality-deduction-repository'
import {
  getFutureMobileFactoryQcDetail,
  getFutureMobileFactoryQcSummary,
  listFutureMobileFactoryQcBuckets,
  type FutureMobileFactoryQcDetail,
  type FutureMobileFactoryQcListItem,
} from '../data/fcs/quality-deduction-selectors'
import type { QualityEvidenceAsset } from '../data/fcs/quality-deduction-domain'
import { escapeHtml, formatDateTime } from '../utils'
import { renderPdaFrame } from './pda-shell'
import {
  ensurePdaSessionForAction,
  getPdaRuntimeContext,
  renderPdaLoginRedirect,
} from './pda-runtime'

type QualityViewKey = 'pending' | 'disputing' | 'processed' | 'history'

interface PdaQualityState {
  selectedFactoryId: string
  activeView: QualityViewKey
  keyword: string
  confirmQcId: string | null
  disputeQcId: string | null
  disputeForm: {
    reasonCode: string
    reasonName: string
    description: string
    evidenceAssets: QualityEvidenceAsset[]
    errorText: string
  }
}

const QUALITY_VIEWS: Array<{ key: QualityViewKey; label: string }> = [
  { key: 'pending', label: '待处理' },
  { key: 'disputing', label: '异议中' },
  { key: 'processed', label: '已处理' },
  { key: 'history', label: '历史' },
]

const DISPUTE_REASON_OPTIONS = [
  { code: 'QTY_DISAGREEMENT', name: '责任数量异议' },
  { code: 'MATERIAL_VARIANCE', name: '来料偏差异议' },
  { code: 'PROCESS_JUDGEMENT', name: '责任判定异议' },
  { code: 'EVIDENCE_MISMATCH', name: '证据判定异议' },
]

const state: PdaQualityState = {
  selectedFactoryId: '',
  activeView: 'pending',
  keyword: '',
  confirmQcId: null,
  disputeQcId: null,
  disputeForm: {
    reasonCode: '',
    reasonName: '',
    description: '',
    evidenceAssets: [],
    errorText: '',
  },
}

function escapeAttr(value: string): string {
  return escapeHtml(value)
}

function getCurrentQueryString(): string {
  const pathname = appStore.getState().pathname
  const [, query] = pathname.split('?')
  return query || ''
}

function getCurrentSearchParams(): URLSearchParams {
  return new URLSearchParams(getCurrentQueryString())
}

function getCurrentFactoryId(): string {
  const runtime = getPdaRuntimeContext()
  state.selectedFactoryId = runtime?.factoryId ?? ''
  return state.selectedFactoryId
}

function getCurrentFactoryOperatorName(factoryId: string): string {
  const runtime = getPdaRuntimeContext()
  if (runtime?.userName) return runtime.userName
  return factoryId ? '工厂处理人' : ''
}

function getBackPath(): string {
  const params = getCurrentSearchParams()
  const view = params.get('view')
  const cycleId = params.get('cycleId')
  const search = new URLSearchParams()
  search.set('tab', 'quality')
  if (view && ['pending', 'soon', 'disputing', 'processed', 'history'].includes(view)) {
    search.set('view', view)
  }
  if (cycleId) {
    search.set('cycleId', cycleId)
  }
  return `/fcs/pda/settlement?${search.toString()}`
}

function buildPdaQualityDetailHref(qcId: string): string {
  const params = getCurrentSearchParams()
  const search = new URLSearchParams()
  const view = params.get('view')
  const cycleId = params.get('cycleId')
  if (view && ['pending', 'soon', 'disputing', 'processed', 'history'].includes(view)) {
    search.set('view', view)
  }
  if (cycleId) {
    search.set('cycleId', cycleId)
  }
  const query = search.toString()
  return `/fcs/pda/quality/${encodeURIComponent(qcId)}${query ? `?${query}` : ''}`
}

function nowTimestamp(date: Date = new Date()): string {
  return date.toISOString().replace('T', ' ').slice(0, 19)
}

function parseDateMs(value?: string): number | null {
  if (!value) return null
  const timestamp = new Date(value.replace(' ', 'T')).getTime()
  return Number.isFinite(timestamp) ? timestamp : null
}

function formatCny(amount: number): string {
  return `${amount.toLocaleString('zh-CN')} CNY`
}

function formatQty(amount: number): string {
  return `${amount.toLocaleString('zh-CN')} 件`
}

function getRemainingDeadlineSummary(deadline?: string): string {
  const deadlineMs = parseDateMs(deadline)
  if (deadlineMs === null) return '无需响应'
  const diff = deadlineMs - Date.now()
  if (diff <= 0) return '已超时'
  const hours = Math.ceil(diff / (3600 * 1000))
  if (hours < 24) return `剩余 ${hours} 小时`
  const days = Math.floor(hours / 24)
  const remainHours = hours % 24
  return `剩余 ${days} 天 ${remainHours} 小时`
}

function getBadgeClass(kind: 'blue' | 'amber' | 'red' | 'green' | 'gray' | 'purple'): string {
  switch (kind) {
    case 'blue':
      return 'border-blue-200 bg-blue-50 text-blue-700'
    case 'amber':
      return 'border-amber-200 bg-amber-50 text-amber-700'
    case 'red':
      return 'border-red-200 bg-red-50 text-red-700'
    case 'green':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700'
    case 'purple':
      return 'border-purple-200 bg-purple-50 text-purple-700'
    default:
      return 'border-zinc-200 bg-zinc-100 text-zinc-700'
  }
}

function getResultBadgeClass(label: string): string {
  if (label === '合格') return getBadgeClass('green')
  if (label === '部分合格') return getBadgeClass('amber')
  return getBadgeClass('red')
}

function getResponseBadgeClass(label: string): string {
  if (label.includes('待工厂处理')) return getBadgeClass('amber')
  if (label.includes('自动确认')) return getBadgeClass('purple')
  if (label.includes('已确认')) return getBadgeClass('green')
  if (label.includes('异议')) return getBadgeClass('red')
  return getBadgeClass('gray')
}

function getDisputeBadgeClass(label: string): string {
  if (label === '无异议') return getBadgeClass('gray')
  if (label === '待平台处理' || label === '平台处理中') return getBadgeClass('amber')
  if (label === '最终部分工厂责任') return getBadgeClass('blue')
  if (label === '最终非工厂责任') return getBadgeClass('purple')
  if (label === '最终维持工厂责任') return getBadgeClass('red')
  return getBadgeClass('gray')
}

function getSettlementBadgeClass(label: string): string {
  if (label.includes('待确认') || label.includes('待平台处理')) return getBadgeClass('amber')
  if (label.includes('正式质量扣款流水')) return getBadgeClass('green')
  if (label.includes('预结算单')) return getBadgeClass('blue')
  if (label.includes('预付款批次')) return getBadgeClass('purple')
  return getBadgeClass('gray')
}

function renderStatusBadge(label: string, className: string): string {
  return `<span class="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${className}">${escapeHtml(label)}</span>`
}

function renderSectionCard(title: string, body: string, _description?: string): string {
  return `
    <section class="rounded-2xl border bg-card px-4 py-4 shadow-sm">
      <div class="mb-3">
        <h2 class="text-sm font-semibold text-foreground">${escapeHtml(title)}</h2>
      </div>
      ${body}
    </section>
  `
}

function renderInfoGrid(items: Array<{ label: string; value: string }>): string {
  return `
    <dl class="grid grid-cols-2 gap-x-3 gap-y-3 text-xs">
      ${items
        .map(
          (item) => `
            <div class="rounded-xl bg-muted/40 px-3 py-2">
              <dt class="text-muted-foreground">${escapeHtml(item.label)}</dt>
              <dd class="mt-1 break-words font-medium text-foreground">${item.value}</dd>
            </div>
          `,
        )
        .join('')}
    </dl>
  `
}

function renderEvidenceAssets(
  assets: QualityEvidenceAsset[],
  emptyText: string,
  prefix: '检查证据' | '工厂异议证据',
): string {
  if (assets.length === 0) {
    return `<div class="rounded-xl border border-dashed px-3 py-4 text-xs text-muted-foreground">${escapeHtml(emptyText)}</div>`
  }

  return `
    <div class="space-y-2">
      ${assets
        .map(
          (asset) => `
            <article class="rounded-xl border bg-background px-3 py-3">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <div class="text-sm font-medium text-foreground">${escapeHtml(asset.name)}</div>
                  <div class="mt-1 text-[11px] text-muted-foreground">${escapeHtml(prefix)} · ${
                    asset.assetType === 'IMAGE' ? '图片' : asset.assetType === 'VIDEO' ? '视频' : '文档'
                  }</div>
                </div>
                <span class="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">${escapeHtml(asset.assetType === 'IMAGE' ? '图片' : asset.assetType === 'VIDEO' ? '视频' : '文档')}</span>
              </div>
            </article>
          `,
        )
        .join('')}
    </div>
  `
}

function matchesKeyword(item: FutureMobileFactoryQcListItem, keyword: string): boolean {
  const normalized = keyword.trim()
  if (!normalized) return true
  return [
    item.qcNo,
    item.returnInboundBatchNo,
    item.productionOrderNo,
    item.processLabel,
  ].some((value) => value.toLowerCase().includes(normalized.toLowerCase()))
}

function getListItemsByView(factoryId: string, view: QualityViewKey): FutureMobileFactoryQcListItem[] {
  const buckets = listFutureMobileFactoryQcBuckets(factoryId)
  switch (view) {
    case 'disputing':
      return buckets.disputing
    case 'processed':
      return buckets.processed
    case 'history':
      return buckets.history
    default:
      return buckets.pending
  }
}

function getViewCount(factoryId: string, view: QualityViewKey): number {
  return getListItemsByView(factoryId, view).length
}

function resetDisputeForm(): void {
  state.disputeForm = {
    reasonCode: '',
    reasonName: '',
    description: '',
    evidenceAssets: [],
    errorText: '',
  }
}

function openDisputeSheet(qcId: string): void {
  state.disputeQcId = qcId
  resetDisputeForm()
}

function closeDisputeSheet(): void {
  state.disputeQcId = null
  resetDisputeForm()
}

function closeConfirmDialog(): void {
  state.confirmQcId = null
}

function showPdaQualityToast(message: string): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return

  const rootId = 'pda-quality-toast-root'
  let root = document.getElementById(rootId)
  if (!root) {
    root = document.createElement('div')
    root.id = rootId
    root.className = 'pointer-events-none fixed right-4 top-20 z-[140] flex max-w-sm flex-col gap-2'
    document.body.appendChild(root)
  }

  const toast = document.createElement('div')
  toast.className =
    'pointer-events-auto rounded-xl border bg-background px-4 py-3 text-sm text-foreground shadow-lg transition-all duration-200'
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
      if (root && root.childElementCount === 0) root.remove()
    }, 180)
  }, 2200)
}

function renderSummaryCards(factoryId: string): string {
  const summary = getFutureMobileFactoryQcSummary(factoryId)
  const cards = [
    { label: '待处理', value: summary.pendingCount, hint: '需在 SLA 内确认或异议' },
    { label: '即将超时', value: summary.soonOverdueCount, hint: '48 小时窗口内到期' },
    { label: '异议中', value: summary.disputingCount, hint: '等待平台裁决' },
  ]

  return `
    <div class="grid grid-cols-3 gap-2">
      ${cards
        .map(
          (card) => `
            <article class="rounded-2xl border bg-card px-3 py-3 shadow-sm">
              <div class="text-[11px] text-muted-foreground">${escapeHtml(card.label)}</div>
              <div class="mt-2 text-xl font-semibold text-foreground">${card.value}</div>
              <div class="mt-1 text-[11px] leading-5 text-muted-foreground">${escapeHtml(card.hint)}</div>
            </article>
          `,
        )
        .join('')}
    </div>
  `
}

function renderViewTabs(factoryId: string): string {
  return `
    <div class="flex gap-2 overflow-x-auto pb-1">
      ${QUALITY_VIEWS.map((view) => {
        const active = state.activeView === view.key
        return `
          <button
            class="inline-flex shrink-0 items-center rounded-full border px-3 py-1.5 text-xs font-medium ${
              active ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-muted-foreground'
            }"
            data-pda-quality-action="set-view"
            data-view="${view.key}"
          >
            ${escapeHtml(view.label)} · ${getViewCount(factoryId, view.key)}
          </button>
        `
      }).join('')}
    </div>
  `
}

function renderListCard(item: FutureMobileFactoryQcListItem): string {
  const pendingHint =
    item.factoryResponseStatus === 'PENDING_RESPONSE'
      ? item.isOverdue
        ? '当前已超时，平台会继续按共享事实源跟踪处理。'
        : '当前可确认处理，也可先进入详情补充证据后发起异议。'
      : item.disputeStatus !== 'NONE'
        ? `异议状态：${item.disputeStatusLabel}`
        : `当前状态：${item.caseStatusLabel}`

  return `
    <article class="rounded-2xl border bg-card px-4 py-4 shadow-sm">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0 flex-1">
          <div class="text-sm font-semibold text-foreground">${escapeHtml(item.qcNo)}</div>
          <div class="mt-1 text-[11px] leading-5 text-muted-foreground">${escapeHtml(item.returnInboundBatchNo)} · ${escapeHtml(item.productionOrderNo)}</div>
          <div class="text-[11px] text-muted-foreground">${escapeHtml(item.processLabel)} · ${escapeHtml(formatDateTime(item.inspectedAt))}</div>
        </div>
        ${renderStatusBadge(item.qcResultLabel, getResultBadgeClass(item.qcResultLabel))}
      </div>

      <div class="mt-3 flex flex-wrap gap-1.5">
        ${renderStatusBadge(item.factoryResponseStatusLabel, getResponseBadgeClass(item.factoryResponseStatusLabel))}
        ${renderStatusBadge(item.disputeStatusLabel, getDisputeBadgeClass(item.disputeStatusLabel))}
        ${renderStatusBadge(item.settlementImpactStatusLabel, getSettlementBadgeClass(item.settlementImpactStatusLabel))}
      </div>

      <dl class="mt-3 grid grid-cols-2 gap-2 text-[11px]">
        <div class="rounded-xl bg-muted/40 px-3 py-2">
          <dt class="text-muted-foreground">数量概况</dt>
          <dd class="mt-1 font-medium text-foreground">${formatQty(item.inspectedQty)} / 合格 ${formatQty(item.qualifiedQty)} / 不合格 ${formatQty(item.unqualifiedQty)}</dd>
        </div>
        <div class="rounded-xl bg-muted/40 px-3 py-2">
          <dt class="text-muted-foreground">工厂责任对象数量</dt>
          <dd class="mt-1 font-medium text-foreground">${formatQty(item.factoryLiabilityQty)}</dd>
        </div>
        <div class="rounded-xl bg-muted/40 px-3 py-2">
          <dt class="text-muted-foreground">冻结加工费</dt>
          <dd class="mt-1 font-medium text-foreground">${formatCny(item.blockedProcessingFeeAmount)}</dd>
        </div>
        <div class="rounded-xl bg-muted/40 px-3 py-2">
          <dt class="text-muted-foreground">生效质量扣款</dt>
          <dd class="mt-1 font-medium text-foreground">${formatCny(item.effectiveQualityDeductionAmount)}</dd>
        </div>
      </dl>

      <div class="mt-3 rounded-xl border border-dashed px-3 py-2 text-[11px] leading-5 text-muted-foreground">
        <div>响应截止：${item.responseDeadlineAt ? escapeHtml(formatDateTime(item.responseDeadlineAt)) : '无需响应'}</div>
        <div>${escapeHtml(item.responseDeadlineAt ? getRemainingDeadlineSummary(item.responseDeadlineAt) : pendingHint)}</div>
        ${item.responseDeadlineAt ? `<div>${escapeHtml(pendingHint)}</div>` : ''}
      </div>

      ${
        item.canConfirm || item.canDispute
          ? `
            <div class="mt-3 rounded-xl border border-primary/20 bg-primary/5 px-3 py-3">
              <div class="text-[11px] leading-5 text-muted-foreground">当前需要工厂处理，可先核对检查证据和金额影响。</div>
              <div class="mt-3 grid grid-cols-2 gap-2">
                ${
                  item.canDispute
                    ? `
                      <button
                        class="rounded-xl border border-primary px-3 py-2 text-xs font-medium text-primary hover:bg-primary/5"
                        data-pda-quality-action="go-dispute"
                        data-qc-id="${escapeAttr(item.qcId)}"
                      >
                        发起异议
                      </button>
                    `
                    : ''
                }
                ${
                  item.canConfirm
                    ? `
                      <button
                        class="rounded-xl bg-primary px-3 py-2 text-xs font-medium text-primary-foreground"
                        data-pda-quality-action="go-confirm"
                        data-qc-id="${escapeAttr(item.qcId)}"
                      >
                        确认处理
                      </button>
                    `
                    : ''
                }
              </div>
            </div>
          `
          : ''
      }

      <div class="mt-3 flex gap-2">
        <button
          class="flex-1 rounded-xl border px-3 py-2 text-xs font-medium hover:bg-muted"
          data-nav="${buildPdaQualityDetailHref(item.qcId)}"
        >
          查看详情
        </button>
      </div>
    </article>
  `
}

function renderListEmptyState(viewLabel: string): string {
  return `
    <div class="rounded-2xl border border-dashed bg-card px-4 py-8 text-center">
      <div class="text-sm font-medium text-foreground">${escapeHtml(viewLabel)}暂无记录</div>
      <div class="mt-2 text-xs leading-5 text-muted-foreground">当前视图会统一承接工厂待处理、异议查看、已处理结果和历史记录，不再拆成多套独立入口。</div>
    </div>
  `
}

export function renderPdaQualityPage(): string {
  if (!getPdaRuntimeContext()) {
    return renderPdaLoginRedirect()
  }

  const factoryId = getCurrentFactoryId()
  const activeLabel = QUALITY_VIEWS.find((item) => item.key === state.activeView)?.label ?? '待处理'
  const items = getListItemsByView(factoryId, state.activeView).filter((item) => matchesKeyword(item, state.keyword))

  return renderPdaFrame(
    `
      <div class="space-y-4 px-4 pb-5 pt-4">
        <header class="rounded-2xl border bg-card px-4 py-4 shadow-sm">
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="text-lg font-semibold text-foreground">检查记录</div>
              <div class="mt-1 text-xs text-muted-foreground">查看回货质检、后道复检、异议进度和金额影响。</div>
            </div>
            <div class="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">${escapeHtml(factoryId)}</div>
          </div>
        </header>

        ${renderSummaryCards(factoryId)}

        <section class="rounded-2xl border bg-card px-4 py-4 shadow-sm">
          ${renderViewTabs(factoryId)}
          <div class="mt-3">
            <label class="text-[11px] text-muted-foreground">关键词</label>
            <input
              class="mt-1 h-10 w-full rounded-xl border bg-background px-3 text-sm"
              placeholder="输入检查单号 / 回货批次号 / 生产单号"
              data-pda-quality-field="keyword"
              value="${escapeAttr(state.keyword)}"
            />
          </div>
        </section>

        <section class="space-y-3">
          ${
            items.length > 0
              ? items.map((item) => renderListCard(item)).join('')
              : renderListEmptyState(activeLabel)
          }
        </section>
      </div>
    `,
    'settlement',
  )
}

function renderDetailHeader(detail: FutureMobileFactoryQcDetail): string {
  return `
    <header class="rounded-2xl border bg-card px-4 py-4 shadow-sm">
      <button class="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground" data-pda-quality-action="back-list">
        <i data-lucide="arrow-left" class="h-3.5 w-3.5"></i>返回结算
      </button>
      <div class="text-lg font-semibold text-foreground">${escapeHtml(detail.qcNo)}</div>
      <div class="mt-1 text-xs leading-5 text-muted-foreground">${escapeHtml(detail.returnInboundBatchNo)} · ${escapeHtml(detail.productionOrderNo)} · ${escapeHtml(detail.processLabel)}</div>
      <div class="mt-3 flex flex-wrap gap-1.5">
        ${renderStatusBadge(detail.qcResultLabel, getResultBadgeClass(detail.qcResultLabel))}
        ${renderStatusBadge(detail.factoryResponseStatusLabel, getResponseBadgeClass(detail.factoryResponseStatusLabel))}
        ${renderStatusBadge(detail.disputeStatusLabel, getDisputeBadgeClass(detail.disputeStatusLabel))}
        ${renderStatusBadge(detail.settlementImpactStatusLabel, getSettlementBadgeClass(detail.settlementImpactStatusLabel))}
      </div>
      ${
        detail.responseDeadlineAt && detail.availableActions.length > 0
          ? `
            <div class="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-700">
              <div>响应截止：${escapeHtml(formatDateTime(detail.responseDeadlineAt))}</div>
              <div>${escapeHtml(getRemainingDeadlineSummary(detail.responseDeadlineAt))}</div>
            </div>
          `
          : ''
      }
    </header>
  `
}

function renderDetailSections(detail: FutureMobileFactoryQcDetail): string {
  const responseSummary = detail.requiresFactoryResponse
    ? `状态：${detail.factoryResponseStatusLabel}${detail.responseActionLabel ? ` · 动作：${detail.responseActionLabel}` : ''}`
    : '当前无需工厂响应'

  const disputeSummary = detail.disputeId
    ? detail.platformAdjudicationSummary
    : '尚未发起异议。若对工厂责任对象数量或证据判定有异议，请在响应窗口内上传图片 / 视频后提交。'

  return [
    renderSectionCard(
      '基本信息',
      renderInfoGrid([
        { label: '检查单号', value: escapeHtml(detail.qcNo) },
        { label: '来源类型', value: escapeHtml(detail.sourceTypeLabel) },
        { label: '回货批次号', value: escapeHtml(detail.returnInboundBatchNo) },
        { label: '生产单号', value: escapeHtml(detail.productionOrderNo) },
        { label: '检查场景', value: escapeHtml(detail.inspectionSceneLabel ?? '回货质检') },
        { label: '检查类型', value: escapeHtml(detail.inspectionTypeLabel ?? '质检') },
        { label: '检查方式', value: escapeHtml(detail.inspectionMethodLabel ?? '抽检') },
        { label: '回货环节', value: escapeHtml(detail.processLabel) },
        { label: '工厂', value: escapeHtml(detail.returnFactoryName) },
        { label: '接收方', value: escapeHtml(detail.receiverName) },
        { label: '检查人', value: escapeHtml(detail.inspectorUserName) },
        { label: '完成时间', value: escapeHtml(formatDateTime(detail.inspectedAt)) },
      ]),
    ),
    renderSectionCard(
      '数量与责任',
      renderInfoGrid([
        { label: '工厂交出', value: formatQty(detail.declaredQty) },
        { label: '接收方实收', value: formatQty(detail.receivedQty) },
        { label: '质检数量', value: formatQty(detail.inspectedQty) },
        { label: '合格数量', value: formatQty(detail.qualifiedQty) },
        { label: '不合格数量', value: formatQty(detail.unqualifiedQty) },
        { label: '检查结果', value: renderStatusBadge(detail.qcResultLabel, getResultBadgeClass(detail.qcResultLabel)) },
        { label: '工厂责任对象数量', value: formatQty(detail.factoryLiabilityQty) },
        { label: '非工厂责任对象数量', value: formatQty(detail.nonFactoryLiabilityQty) },
        { label: '责任状态', value: renderStatusBadge(detail.liabilityStatusLabel, getBadgeClass(detail.liabilityStatus === 'FACTORY' ? 'red' : detail.liabilityStatus === 'MIXED' ? 'amber' : detail.liabilityStatus === 'NON_FACTORY' ? 'green' : 'gray')) },
        { label: '责任说明', value: escapeHtml(detail.responsibilitySummary) },
      ]),
    ),
    renderSectionCard(
      '缺陷与检查证据',
      `
        <div class="rounded-xl bg-muted/40 px-3 py-3 text-xs leading-5 text-foreground">
          <div class="font-medium">缺陷说明</div>
          <div class="mt-1 text-muted-foreground">${escapeHtml(
            detail.unqualifiedReasonSummary || detail.defectItems.map((item) => `${item.defectName}×${item.qty}`).join('、') || '当前无额外缺陷说明',
          )}</div>
        </div>
        <div class="mt-3 text-[11px] text-muted-foreground">检查证据 ${detail.warehouseEvidenceCount} 份</div>
        <div class="mt-2">${renderEvidenceAssets(detail.warehouseEvidenceAssets, '当前无检查证据。', '检查证据')}</div>
      `,
    ),
    renderSectionCard(
      '工厂处理与金额影响',
      renderInfoGrid([
        { label: '是否需要响应', value: escapeHtml(detail.requiresFactoryResponse ? '需要' : '无需') },
        { label: '响应状态', value: renderStatusBadge(detail.factoryResponseStatusLabel, getResponseBadgeClass(detail.factoryResponseStatusLabel)) },
        { label: '响应动作', value: escapeHtml(detail.responseActionLabel ?? '—') },
        { label: '响应截止时间', value: escapeHtml(detail.responseDeadlineAt ? formatDateTime(detail.responseDeadlineAt) : '—') },
        { label: '响应时间', value: escapeHtml(detail.respondedAt ? formatDateTime(detail.respondedAt) : '—') },
        { label: '自动确认时间', value: escapeHtml(detail.autoConfirmedAt ? formatDateTime(detail.autoConfirmedAt) : '—') },
        { label: '响应人', value: escapeHtml(detail.responderUserName ?? '—') },
        { label: '状态说明', value: escapeHtml(detail.isOverdue ? '已超时' : responseSummary) },
        { label: '结算影响状态', value: renderStatusBadge(detail.settlementImpactStatusLabel, getSettlementBadgeClass(detail.settlementImpactStatusLabel)) },
        { label: '冻结数量', value: formatQty(detail.blockedSettlementQty) },
        { label: '冻结加工费金额', value: formatCny(detail.blockedProcessingFeeAmount) },
        { label: '生效质量扣款金额', value: formatCny(detail.effectiveQualityDeductionAmount) },
        { label: '正式流水编号', value: escapeHtml(detail.formalLedgerNo ?? '—') },
        { label: '结算单号', value: escapeHtml(detail.includedSettlementStatementId ?? '—') },
        { label: '预付款批次号', value: escapeHtml(detail.includedSettlementBatchId ?? '—') },
        {
          label: '正式质量扣款流水说明',
          value: escapeHtml(
            detail.formalLedgerStatusLabel ??
              detail.pendingRecordStatusLabel ??
              detail.settlementAdjustmentSummary ??
              '当前尚未形成正式质量扣款流水',
          ),
        },
      ]),
      (detail.responseComment
        ? `<div class="mt-3 rounded-xl bg-muted/40 px-3 py-3 text-xs leading-5 text-muted-foreground">${escapeHtml(detail.responseComment)}</div>`
        : '') +
        '',
    ),
    renderSectionCard(
      '异议与平台处理结果',
      `
        <div class="rounded-xl bg-muted/40 px-3 py-3 text-xs leading-5 text-muted-foreground">${escapeHtml(disputeSummary)}</div>
        ${
          detail.disputeId
            ? `
              <div class="mt-3">${renderInfoGrid([
                { label: '异议单号', value: escapeHtml(detail.disputeId) },
                { label: '异议状态', value: renderStatusBadge(detail.disputeStatusLabel, getDisputeBadgeClass(detail.disputeStatusLabel)) },
                { label: '异议原因', value: escapeHtml(detail.disputeReasonName ?? '—') },
                { label: '提交时间', value: escapeHtml(detail.submittedAt ? formatDateTime(detail.submittedAt) : '—') },
                { label: '提交人', value: escapeHtml(detail.submittedByUserName ?? '—') },
                { label: '裁决结果', value: escapeHtml(detail.adjudicationResultLabel ?? '待平台处理') },
                { label: '平台处理人', value: escapeHtml(detail.reviewerUserName ?? '—') },
                { label: '回写时间', value: escapeHtml(detail.resultWrittenBackAt ? formatDateTime(detail.resultWrittenBackAt) : '—') },
              ])}</div>
              ${
                detail.disputeDescription
                  ? `<div class="mt-3 rounded-xl border px-3 py-3 text-xs leading-5 text-muted-foreground"><div class="font-medium text-foreground">异议说明</div><div class="mt-1">${escapeHtml(detail.disputeDescription)}</div></div>`
                  : ''
              }
              ${
                detail.adjudicationComment
                  ? `<div class="mt-3 rounded-xl border px-3 py-3 text-xs leading-5 text-muted-foreground"><div class="font-medium text-foreground">平台裁决意见</div><div class="mt-1">${escapeHtml(detail.adjudicationComment)}</div></div>`
                  : ''
              }
              <div class="mt-3 text-[11px] text-muted-foreground">工厂异议证据 ${detail.submittedDisputeEvidenceAssets.length} 份</div>
              <div class="mt-2">${renderEvidenceAssets(detail.submittedDisputeEvidenceAssets, '当前无工厂异议证据。', '工厂异议证据')}</div>
            `
            : `
              <div class="mt-3 rounded-xl border border-dashed px-3 py-4 text-xs text-muted-foreground">
                当前还未发起异议。若需提交异议，必须填写异议原因与说明，并至少上传 1 个图片或视频证据。
              </div>
            `
        }
      `,
    ),
  ].join('')
}

function renderBottomActionBar(detail: FutureMobileFactoryQcDetail): string {
  if (detail.availableActions.length === 0) return ''

  return `
    <div class="sticky bottom-0 z-20 mt-4 rounded-t-2xl border border-border bg-background/95 px-4 py-3 backdrop-blur">
      <div class="mb-2 text-[11px] text-muted-foreground">当前需要工厂处理，请先核对数量与证据。</div>
      <div class="flex gap-2">
        <button
          class="flex-1 rounded-xl border border-primary px-3 py-3 text-sm font-medium text-primary hover:bg-primary/5"
          data-pda-quality-action="open-dispute"
          data-qc-id="${escapeAttr(detail.qcId)}"
        >
          发起异议
        </button>
        <button
          class="flex-1 rounded-xl bg-primary px-3 py-3 text-sm font-medium text-primary-foreground"
          data-pda-quality-action="open-confirm"
          data-qc-id="${escapeAttr(detail.qcId)}"
        >
          确认处理
        </button>
      </div>
    </div>
  `
}

function renderConfirmDialog(detail: FutureMobileFactoryQcDetail): string {
  if (state.confirmQcId !== detail.qcId) return ''

  return `
    <div class="fixed inset-0 z-[120]">
      <button class="absolute inset-0 bg-black/45" data-pda-quality-action="close-confirm" aria-label="关闭确认弹层"></button>
      <section class="absolute bottom-[72px] left-0 right-0 rounded-t-3xl border bg-background px-4 py-4 shadow-2xl">
        <div class="text-base font-semibold text-foreground">确认处理</div>
        <div class="mt-2 text-sm leading-6 text-muted-foreground">确认后会同步工厂处理时间，并更新对应金额链路。</div>
        <div class="mt-4 rounded-xl bg-muted/40 px-3 py-3 text-xs leading-5">
          <div>工厂责任对象数量：${formatQty(detail.factoryLiabilityQty)}</div>
          <div>冻结加工费金额：${formatCny(detail.blockedProcessingFeeAmount)}</div>
          <div>生效质量扣款金额：${formatCny(detail.effectiveQualityDeductionAmount)}</div>
        </div>
        <div class="mt-4 flex gap-2">
          <button class="flex-1 rounded-xl border px-3 py-2.5 text-sm hover:bg-muted" data-pda-quality-action="close-confirm">取消</button>
          <button
            class="flex-1 rounded-xl bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground"
            data-pda-quality-action="submit-confirm"
            data-qc-id="${escapeAttr(detail.qcId)}"
          >
            确认处理
          </button>
        </div>
      </section>
    </div>
  `
}

function renderDisputeSheet(detail: FutureMobileFactoryQcDetail): string {
  if (state.disputeQcId !== detail.qcId) return ''

  return `
    <div class="fixed inset-0 z-[130]">
      <button class="absolute inset-0 bg-black/45" data-pda-quality-action="close-dispute" aria-label="关闭异议表单"></button>
      <section class="absolute inset-x-0 bottom-[72px] top-14 overflow-y-auto rounded-t-3xl border bg-background shadow-2xl">
        <div class="sticky top-0 z-10 border-b bg-background px-4 py-4">
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="text-base font-semibold text-foreground">发起异议</div>
              <div class="mt-1 text-xs leading-5 text-muted-foreground">必须填写异议原因与说明，并至少上传 1 个图片或视频证据。提交后平台端会同步看到异议单与证据。</div>
            </div>
            <button class="rounded-full border px-2.5 py-1 text-xs text-muted-foreground" data-pda-quality-action="close-dispute">关闭</button>
          </div>
        </div>

        <div class="space-y-4 px-4 py-4">
          <section class="rounded-2xl border bg-card px-4 py-4 shadow-sm">
            <label class="text-xs font-medium text-foreground">异议原因 *</label>
            <select class="mt-2 h-10 w-full rounded-xl border bg-background px-3 text-sm" data-pda-quality-field="disputeReasonCode">
              <option value="">请选择异议原因</option>
              ${DISPUTE_REASON_OPTIONS.map(
                (option) => `
                  <option value="${escapeAttr(option.code)}" ${
                    state.disputeForm.reasonCode === option.code ? 'selected' : ''
                  }>
                    ${escapeHtml(option.name)}
                  </option>
                `,
              ).join('')}
            </select>

            <label class="mt-4 block text-xs font-medium text-foreground">异议说明 *</label>
            <textarea
              class="mt-2 min-h-24 w-full rounded-xl border bg-background px-3 py-2 text-sm"
              data-pda-quality-field="disputeDescription"
              placeholder="请说明为什么判定有误、需要平台复核的数量或证据点。"
            >${escapeHtml(state.disputeForm.description)}</textarea>
          </section>

          <section class="rounded-2xl border bg-card px-4 py-4 shadow-sm">
            <div class="text-xs font-medium text-foreground">异议证据 *</div>
            <div class="mt-1 text-[11px] leading-5 text-muted-foreground">至少上传 1 个图片或视频证据。原型阶段点击按钮会模拟上传并写入共享素材列表。</div>
            <div class="mt-3 flex gap-2">
              <button class="flex-1 rounded-xl border px-3 py-2.5 text-xs hover:bg-muted" data-pda-quality-action="add-evidence" data-asset-type="IMAGE">
                <i data-lucide="image" class="mr-1 inline-block h-3.5 w-3.5"></i>上传图片
              </button>
              <button class="flex-1 rounded-xl border px-3 py-2.5 text-xs hover:bg-muted" data-pda-quality-action="add-evidence" data-asset-type="VIDEO">
                <i data-lucide="video" class="mr-1 inline-block h-3.5 w-3.5"></i>上传视频
              </button>
            </div>

            <div class="mt-3 space-y-2">
              ${
                state.disputeForm.evidenceAssets.length > 0
                  ? state.disputeForm.evidenceAssets
                      .map(
                        (asset, index) => `
                          <div class="flex items-center justify-between rounded-xl border px-3 py-2 text-xs">
                            <div>
                              <div class="font-medium text-foreground">${escapeHtml(asset.name)}</div>
                              <div class="mt-0.5 text-muted-foreground">${escapeHtml(asset.assetType === 'IMAGE' ? '图片' : '视频')}</div>
                            </div>
                            <button class="rounded-full border px-2 py-1 text-[11px] text-muted-foreground" data-pda-quality-action="remove-evidence" data-index="${index}">移除</button>
                          </div>
                        `,
                      )
                      .join('')
                  : '<div class="rounded-xl border border-dashed px-3 py-4 text-xs text-muted-foreground">当前尚未上传证据。</div>'
              }
            </div>

            ${
              state.disputeForm.errorText
                ? `<div class="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">${escapeHtml(state.disputeForm.errorText)}</div>`
                : ''
            }
          </section>
        </div>

        <div class="sticky bottom-0 border-t bg-background px-4 py-3">
          <div class="flex gap-2">
            <button class="flex-1 rounded-xl border px-3 py-2.5 text-sm hover:bg-muted" data-pda-quality-action="close-dispute">取消</button>
            <button
              class="flex-1 rounded-xl bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground"
              data-pda-quality-action="submit-dispute"
              data-qc-id="${escapeAttr(detail.qcId)}"
            >
              提交异议
            </button>
          </div>
        </div>
      </section>
    </div>
  `
}

function renderDetailEmptyState(): string {
  return renderPdaFrame(
    `
      <div class="px-4 py-6">
        <div class="rounded-2xl border border-dashed bg-card px-4 py-10 text-center">
          <div class="text-base font-medium text-foreground">未找到对应质检记录</div>
          <div class="mt-2 text-xs leading-5 text-muted-foreground">请返回“结算”中的质检扣款处理分组重新选择记录，或确认当前登录工厂是否有权限查看该记录。</div>
          <button class="mt-4 rounded-xl border px-4 py-2 text-sm hover:bg-muted" data-pda-quality-action="back-list">返回</button>
        </div>
      </div>
    `,
    'settlement',
  )
}

export function renderPdaQualityDetailPage(qcId: string): string {
  if (!getPdaRuntimeContext()) {
    return renderPdaLoginRedirect()
  }

  const detail = getFutureMobileFactoryQcDetail(qcId, getCurrentFactoryId())
  if (!detail) return renderDetailEmptyState()

  return renderPdaFrame(
    `
      <div class="space-y-4 px-4 pb-5 pt-4">
        ${renderDetailHeader(detail)}
        ${renderDetailSections(detail)}
        ${renderBottomActionBar(detail)}
      </div>
      ${renderConfirmDialog(detail)}
      ${renderDisputeSheet(detail)}
    `,
    'settlement',
  )
}

export function handlePdaQualityEvent(target: HTMLElement): boolean {
  if (!ensurePdaSessionForAction()) return true

  const fieldNode = target.closest<HTMLElement>('[data-pda-quality-field]')
  if (
    fieldNode instanceof HTMLInputElement ||
    fieldNode instanceof HTMLSelectElement ||
    fieldNode instanceof HTMLTextAreaElement
  ) {
    const field = fieldNode.dataset.pdaQualityField
    if (field === 'keyword' && fieldNode instanceof HTMLInputElement) {
      state.keyword = fieldNode.value
      return true
    }

    if (field === 'disputeReasonCode' && fieldNode instanceof HTMLSelectElement) {
      state.disputeForm.reasonCode = fieldNode.value
      const matched = DISPUTE_REASON_OPTIONS.find((item) => item.code === fieldNode.value)
      state.disputeForm.reasonName = matched?.name ?? ''
      state.disputeForm.errorText = ''
      return true
    }

    if (field === 'disputeDescription' && fieldNode instanceof HTMLTextAreaElement) {
      state.disputeForm.description = fieldNode.value
      state.disputeForm.errorText = ''
      return true
    }
  }

  const actionNode = target.closest<HTMLElement>('[data-pda-quality-action]')
  if (!actionNode) return false

  const action = actionNode.dataset.pdaQualityAction
  if (!action) return false

  if (action === 'set-view') {
    const view = actionNode.dataset.view as QualityViewKey | undefined
    if (view) state.activeView = view
    return true
  }

  if (action === 'back-list') {
    closeConfirmDialog()
    closeDisputeSheet()
    appStore.navigate(getBackPath())
    return true
  }

  if (action === 'go-confirm') {
    const qcId = actionNode.dataset.qcId
    if (!qcId) return true
    closeDisputeSheet()
    state.confirmQcId = qcId
    appStore.navigate(buildPdaQualityDetailHref(qcId))
    return true
  }

  if (action === 'go-dispute') {
    const qcId = actionNode.dataset.qcId
    if (!qcId) return true
    closeConfirmDialog()
    openDisputeSheet(qcId)
    appStore.navigate(buildPdaQualityDetailHref(qcId))
    return true
  }

  if (action === 'open-confirm') {
    state.confirmQcId = actionNode.dataset.qcId ?? null
    return true
  }

  if (action === 'close-confirm') {
    closeConfirmDialog()
    return true
  }

  if (action === 'submit-confirm') {
    const qcId = actionNode.dataset.qcId
    if (!qcId) return true
    const result = confirmQualityDeductionFactoryResponse({
      qcId,
      responderUserName: getCurrentFactoryOperatorName(getCurrentFactoryId()),
      respondedAt: nowTimestamp(),
      responseComment: '工厂在移动端确认处理',
    })
    if (!result.ok) {
      showPdaQualityToast(result.message)
      return true
    }

    closeConfirmDialog()
    showPdaQualityToast('已确认处理，平台端已同步更新')
    return true
  }

  if (action === 'open-dispute') {
    const qcId = actionNode.dataset.qcId
    if (qcId) openDisputeSheet(qcId)
    return true
  }

  if (action === 'close-dispute') {
    closeDisputeSheet()
    return true
  }

  if (action === 'add-evidence') {
    const assetType = actionNode.dataset.assetType === 'VIDEO' ? 'VIDEO' : 'IMAGE'
    const suffix = Date.now().toString().slice(-6)
    state.disputeForm.evidenceAssets = [
      ...state.disputeForm.evidenceAssets,
      {
        assetId: `FORM-ASSET-${suffix}`,
        name: assetType === 'IMAGE' ? `工厂异议图片-${suffix}.jpg` : `工厂异议视频-${suffix}.mp4`,
        assetType,
      },
    ]
    state.disputeForm.errorText = ''
    return true
  }

  if (action === 'remove-evidence') {
    const index = Number(actionNode.dataset.index)
    if (!Number.isNaN(index)) {
      state.disputeForm.evidenceAssets = state.disputeForm.evidenceAssets.filter((_, itemIndex) => itemIndex !== index)
    }
    return true
  }

  if (action === 'submit-dispute') {
    const qcId = actionNode.dataset.qcId
    if (!qcId) return true

    if (!state.disputeForm.reasonCode || !state.disputeForm.reasonName) {
      state.disputeForm.errorText = '请先选择异议原因'
      return true
    }

    if (!state.disputeForm.description.trim()) {
      state.disputeForm.errorText = '请补充异议说明'
      return true
    }

    if (state.disputeForm.evidenceAssets.length === 0) {
      state.disputeForm.errorText = '请至少上传 1 个图片或视频证据'
      return true
    }

    const result = submitQualityDeductionDispute({
      qcId,
      submittedByUserName: getCurrentFactoryOperatorName(getCurrentFactoryId()),
      submittedAt: nowTimestamp(),
      disputeReasonCode: state.disputeForm.reasonCode,
      disputeReasonName: state.disputeForm.reasonName,
      disputeDescription: state.disputeForm.description.trim(),
      disputeEvidenceAssets: state.disputeForm.evidenceAssets,
    })

    if (!result.ok) {
      state.disputeForm.errorText = result.message
      return true
    }

    closeDisputeSheet()
    showPdaQualityToast('异议已提交，平台端已同步可见')
    return true
  }

  return false
}
