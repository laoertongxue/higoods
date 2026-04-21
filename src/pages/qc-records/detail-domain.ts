import {
  initialDeductionBasisItems,
  initialReturnInboundBatches,
  normalizeQcForView,
  RETURN_INBOUND_PROCESS_LABEL,
  RETURN_INBOUND_QC_POLICY_LABEL,
  SEW_POST_PROCESS_MODE_LABEL,
  escapeHtml,
  formatDateTime,
  toClassName,
  NEEDS_AFFECTED_QTY,
  RESULT_LABEL,
  RESULT_CLASS,
  STATUS_LABEL,
  STATUS_CLASS,
  DISPOSITION_LABEL,
  DEDUCTION_DECISION_LABEL,
  ROOT_CAUSE_LABEL,
  LIABILITY_LABEL,
  PARTY_TYPE_LABEL,
  processTasks,
  ensureDetailState,
  getCurrentSearchParams,
  getQcById,
  getReturnInboundBatchById,
  requiresFinalDecisionForForm,
  toInputValue,
  type QcDisposition,
  type QcDisplayResult,
  type QcResult,
  type RootCauseType,
  type LiabilityStatus,
  type SettlementPartyType,
  type DeductionBasisItem,
  type QualityInspection,
  type QcStatus,
  type QcRecordDetailState,
} from './context'
import { isDetailReadOnly } from './actions'
import {
  buildDeductionEntryHrefByBasisId,
  buildQcDetailHref,
  getQcChainFactByRouteKey,
  getSettlementImpactLabel,
} from '../../data/fcs/quality-chain-adapter'
import {
  getPlatformQcDetailViewModelByRouteKey,
  type PlatformQcDetailViewModel,
} from '../../data/fcs/quality-deduction-selectors'
import { renderPdaFrame } from '../pda-shell'

const INSPECTION_SCENE_LABEL: Record<string, string> = {
  RETURN_INBOUND: '回货质检',
  SEW_RETURN_RECEIVING_QC: '回货质检',
  POST_FINAL_RECHECK: '后道复检',
  PRINT_RECEIVING_QC: '印花回货质检',
  DYE_RECEIVING_QC: '染色回货质检',
  CUT_PIECE_RECEIVING_QC: '裁片回货质检',
}

const INSPECTION_METHOD_LABEL: Record<string, string> = {
  COUNT_ONLY: '数量复核',
  SAMPLING: '抽检',
  FULL_INSPECTION: '全检',
}

function getInspectionSceneLabel(qc: QualityInspection): string {
  if (!qc.inspectionScene) return '回货质检'
  return INSPECTION_SCENE_LABEL[qc.inspectionScene] ?? '回货质检'
}

function getInspectionMethodLabel(qc: QualityInspection): string {
  if (!qc.inspectionMethod) return '抽检'
  return INSPECTION_METHOD_LABEL[qc.inspectionMethod] ?? '抽检'
}

function renderDispositionOptions(selected: QcDisposition | ''): string {
  return `
    <option value="" ${selected === '' ? 'selected' : ''}>请选择</option>
    ${Object.keys(DISPOSITION_LABEL)
      .map((key) => {
        const disposition = key as QcDisposition
        return `<option value="${disposition}" ${selected === disposition ? 'selected' : ''}>${DISPOSITION_LABEL[disposition]}</option>`
      })
      .join('')}
  `
}

function renderRootCauseOptions(selected: RootCauseType): string {
  return Object.keys(ROOT_CAUSE_LABEL)
    .map((key) => {
      const cause = key as RootCauseType
      return `<option value="${cause}" ${selected === cause ? 'selected' : ''}>${ROOT_CAUSE_LABEL[cause]}</option>`
    })
    .join('')
}

function renderLiabilityStatusOptions(selected: LiabilityStatus): string {
  return Object.keys(LIABILITY_LABEL)
    .map((key) => {
      const status = key as LiabilityStatus
      return `<option value="${status}" ${selected === status ? 'selected' : ''}>${LIABILITY_LABEL[status]}</option>`
    })
    .join('')
}

function renderPartyTypeOptions(selected: SettlementPartyType | ''): string {
  return `
    <option value="" ${selected === '' ? 'selected' : ''}>留空由系统推导</option>
    ${Object.keys(PARTY_TYPE_LABEL)
      .map((key) => {
        const type = key as SettlementPartyType
        return `<option value="${type}" ${selected === type ? 'selected' : ''}>${PARTY_TYPE_LABEL[type]}</option>`
      })
      .join('')}
  `
}

function renderBreakdownCard(detail: QcRecordDetailState, existingQc: QualityInspection): string {
  const target = existingQc.affectedQty
  const sum =
    (Number(detail.bdAcceptDefect) || 0) +
    (Number(detail.bdScrap) || 0) +
    (Number(detail.bdNoDeduct) || 0)
  const delta = target !== undefined ? target - sum : 0
  const valid = target === undefined || delta === 0

  return `
    <section class="rounded-md border bg-card">
      <header class="border-b px-4 py-3">
        <h2 class="text-sm font-semibold">处置数量拆分</h2>
      </header>
      <div class="space-y-4 px-4 py-4">
        ${
          target !== undefined
            ? `<p class="text-sm text-muted-foreground">不合格数量（目标）：<span class="font-semibold text-foreground">${target}</span></p>`
            : ''
        }

        ${
          target !== undefined
            ? `
              <div class="flex flex-wrap gap-2">
                <span class="self-center text-xs text-muted-foreground">快速填充：</span>
                <button class="inline-flex h-7 items-center rounded-md border px-2 text-xs hover:bg-muted" data-qcd-action="quick-fill" data-qcd-fill="defect">全部瑕疵接收</button>
                <button class="inline-flex h-7 items-center rounded-md border px-2 text-xs hover:bg-muted" data-qcd-action="quick-fill" data-qcd-fill="scrap">全部报废</button>
                <button class="inline-flex h-7 items-center rounded-md border px-2 text-xs hover:bg-muted" data-qcd-action="quick-fill" data-qcd-fill="nodeduct">全部无扣款接受</button>
              </div>
            `
            : ''
        }

        <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div class="space-y-1">
            <label class="text-xs text-muted-foreground">接受（瑕疵品）</label>
            <input class="h-8 w-full rounded-md border bg-background px-2 text-sm" type="number" min="0" step="1" data-qcd-breakdown="defect" value="${toInputValue(detail.bdAcceptDefect)}" />
          </div>
          <div class="space-y-1">
            <label class="text-xs text-muted-foreground">报废数量</label>
            <input class="h-8 w-full rounded-md border bg-background px-2 text-sm" type="number" min="0" step="1" data-qcd-breakdown="scrap" value="${toInputValue(detail.bdScrap)}" />
          </div>
          <div class="space-y-1">
            <label class="text-xs text-muted-foreground">接受（无扣款）</label>
            <input class="h-8 w-full rounded-md border bg-background px-2 text-sm" type="number" min="0" step="1" data-qcd-breakdown="nodeduct" value="${toInputValue(detail.bdNoDeduct)}" />
          </div>
        </div>

        <div class="${toClassName(
          'flex flex-wrap gap-4 rounded-md border px-3 py-2 text-sm',
          valid ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50',
        )}">
          <span>合计：<span class="font-semibold">${sum}</span></span>
          ${
            target !== undefined
              ? `
                <span>目标：<span class="font-semibold">${target}</span></span>
                <span>差值：<span class="${delta !== 0 ? 'font-semibold text-red-600' : 'font-semibold'}">${delta}</span></span>
                ${
                  !valid
                    ? '<span class="w-full text-xs font-medium text-red-600">合计必须等于不合格数量</span>'
                    : ''
                }
              `
              : ''
          }
        </div>

        <button
          class="inline-flex h-8 items-center rounded-md bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          data-qcd-action="save-breakdown"
          ${target !== undefined && !valid ? 'disabled' : ''}
        >
          保存拆分
        </button>
      </div>
    </section>
  `
}

function renderChainOverview(params: {
  qc: QualityInspection
  batchId: string
  warehouseName: string
  returnFactoryName: string
  processLabel: string
  basisCount: number
  basisReadyCount: number
  basisFrozenCount: number
  basisAmountTotal: number
  evidenceCount: number
  settlementImpactLabel: string
  settlementSummary: string
  disputeSummary?: string
}): string {
  const {
    qc,
    batchId,
    warehouseName,
    returnFactoryName,
    processLabel,
    basisCount,
    basisReadyCount,
    basisFrozenCount,
    basisAmountTotal,
    evidenceCount,
    settlementImpactLabel,
    settlementSummary,
    disputeSummary,
  } = params

  const decisionText =
    qc.deductionDecision === 'DEDUCT'
      ? `${qc.deductionAmount ?? '-'} ${qc.deductionCurrency ?? 'CNY'}`
      : qc.deductionDecision === 'NO_DEDUCT'
        ? '不扣款'
        : basisCount > 0
          ? '已生成扣款依据，待后续处理'
          : '待同步扣款依据'

  return `
    <section class="grid gap-3 md:grid-cols-3">
      <article class="rounded-md border bg-card px-4 py-3">
        <p class="text-xs text-muted-foreground">${escapeHtml(getInspectionSceneLabel(qc))}</p>
        <p class="mt-1 text-sm font-semibold">${escapeHtml(processLabel)} · ${escapeHtml(batchId || '-')}</p>
        <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(returnFactoryName || '-')} / ${escapeHtml(warehouseName || '-')}</p>
      </article>
      <article class="rounded-md border bg-card px-4 py-3">
        <p class="text-xs text-muted-foreground">责任判定与扣款</p>
        <div class="mt-1 flex flex-wrap items-center gap-2">
          <span class="inline-flex rounded-md border px-2 py-0.5 text-xs ${
            qc.liabilityStatus === 'FACTORY'
              ? 'border-red-200 bg-red-50 text-red-700'
              : qc.liabilityStatus === 'NON_FACTORY'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : qc.liabilityStatus === 'MIXED'
                  ? 'border-blue-200 bg-blue-50 text-blue-700'
                  : qc.liabilityStatus === 'CONFIRMED'
              ? 'border-green-200 bg-green-50 text-green-700'
              : qc.liabilityStatus === 'DISPUTED'
                ? 'border-yellow-200 bg-yellow-50 text-yellow-700'
                : 'border-slate-200 bg-slate-50 text-slate-600'
          }">${escapeHtml(LIABILITY_LABEL[qc.liabilityStatus] ?? qc.liabilityStatus)}</span>
        </div>
        <p class="mt-1 text-sm font-semibold">${escapeHtml(decisionText)}</p>
        <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(disputeSummary ?? qc.deductionDecisionRemark ?? qc.dispositionRemark ?? '按检查结果回写平台判责与扣款链路')}</p>
      </article>
      <article class="rounded-md border bg-card px-4 py-3">
        <p class="text-xs text-muted-foreground">扣款与结算串联</p>
        <p class="mt-1 text-sm font-semibold">${basisCount} 条扣款依据 · ${escapeHtml(settlementImpactLabel)}</p>
        <p class="mt-1 text-xs text-muted-foreground">可进入结算 ${basisReadyCount} 条 · 冻结 ${basisFrozenCount} 条</p>
        ${
          basisAmountTotal > 0
            ? `<p class="mt-1 text-xs text-muted-foreground">扣款金额快照合计 ${basisAmountTotal} CNY · 证据 ${evidenceCount} 份</p>`
            : `<p class="mt-1 text-xs text-muted-foreground">${escapeHtml(settlementSummary || qc.settlementFreezeReason || '结算状态由扣款依据自动维护')}</p>`
        }
      </article>
    </section>
  `
}

function renderDetailNotFound(qcId: string): string {
  return `
    <div class="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-8">
      <button class="inline-flex h-8 w-fit items-center rounded-md border px-3 text-sm hover:bg-muted" data-qcd-action="back-list">
        <i data-lucide="chevron-left" class="mr-1 h-4 w-4"></i>返回质检记录
      </button>
      <section class="rounded-md border bg-card p-6">
        <h1 class="text-lg font-semibold">质检记录不存在</h1>
        <p class="mt-2 text-sm text-muted-foreground">未找到质检单：<span class="font-mono">${escapeHtml(qcId)}</span></p>
      </section>
    </div>
  `
}

type PcDetailField = {
  label: string
  value: string
}

function formatDetailValue(value?: string | number | null): string {
  if (value === undefined || value === null || value === '') return '—'
  return escapeHtml(String(value))
}

function formatRate(value: number): string {
  return `${Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1)}%`
}

function renderPcFieldGrid(items: PcDetailField[], columnsClass = 'md:grid-cols-2 xl:grid-cols-3'): string {
  return `
    <div class="grid gap-4 ${columnsClass}">
      ${items
        .map(
          (item) => `
            <div class="rounded-md border bg-background/80 px-4 py-3">
              <p class="text-xs text-muted-foreground">${escapeHtml(item.label)}</p>
              <div class="mt-1 text-sm font-medium text-foreground">${item.value}</div>
            </div>
          `,
        )
        .join('')}
    </div>
  `
}

function renderPcSection(title: string, description: string, body: string): string {
  return `
    <section class="rounded-lg border bg-card">
      <header class="border-b px-5 py-4">
        <h2 class="text-base font-semibold">${escapeHtml(title)}</h2>
        <p class="mt-1 text-sm text-muted-foreground">${escapeHtml(description)}</p>
      </header>
      <div class="px-5 py-5">
        ${body}
      </div>
    </section>
  `
}

function renderOverviewCard(title: string, rows: PcDetailField[], footer?: string): string {
  return `
    <article class="rounded-lg border bg-card px-5 py-4">
      <p class="text-sm font-semibold text-foreground">${escapeHtml(title)}</p>
      <div class="mt-4 space-y-3">
        ${rows
          .map(
            (row) => `
              <div class="flex items-start justify-between gap-3 text-sm">
                <span class="text-muted-foreground">${escapeHtml(row.label)}</span>
                <span class="text-right font-medium text-foreground">${row.value}</span>
              </div>
            `,
          )
          .join('')}
      </div>
      ${
        footer
          ? `<div class="mt-4 border-t pt-3 text-xs text-muted-foreground">${footer}</div>`
          : ''
      }
    </article>
  `
}

function getResultExplanation(
  result: QcDisplayResult,
  inspectedQty: number,
  qualifiedQty: number,
  unqualifiedQty: number,
): string {
  if (result === 'PASS') {
    return `总检 ${inspectedQty}，全部数量合格，因此判定为合格。`
  }
  if (result === 'PARTIAL_PASS') {
    return `总检 ${inspectedQty}，其中合格 ${qualifiedQty}、不合格 ${unqualifiedQty}，因此判定为部分合格。`
  }
  return `总检 ${inspectedQty}，全部数量不合格，因此判定为不合格。`
}

function formatAuditDetail(detail: string, resultLabel: string): string {
  return escapeHtml(detail).replace(/\bPASS\b/g, '合格').replace(/\bFAIL\b/g, resultLabel)
}

function renderBasisLinkGroup(basisItems: DeductionBasisItem[]): string {
  if (basisItems.length === 0) {
    return '<span class="text-sm text-muted-foreground">未生成扣款依据</span>'
  }

  return `
    <div class="flex flex-wrap gap-2">
      ${basisItems
        .map(
          (basis) => `
            <button
              class="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs text-primary hover:bg-muted"
              data-nav="${escapeHtml(buildDeductionEntryHrefByBasisId(basis.basisId))}"
            >
              ${escapeHtml(basis.basisId)}
              <i data-lucide="external-link" class="h-3 w-3"></i>
            </button>
          `,
        )
        .join('')}
    </div>
  `
}

const FACTORY_RESPONSE_ACTION_LABEL: Record<'CONFIRM' | 'DISPUTE' | 'AUTO_CONFIRM', string> = {
  CONFIRM: '确认',
  DISPUTE: '发起异议',
  AUTO_CONFIRM: '自动确认',
}

const PLATFORM_ADJUDICATION_RESULT_LABEL = {
  UPHELD: '维持当前工厂责任',
  PARTIALLY_ADJUSTED: '调整为部分工厂责任',
  REVERSED: '改判为非工厂责任',
} as const

const EVIDENCE_ASSET_TYPE_LABEL = {
  IMAGE: '图片',
  VIDEO: '视频',
  DOCUMENT: '文档',
} as const

function formatMoney(amount?: number | null): string {
  if (amount === undefined || amount === null) return '—'
  return `${amount} CNY`
}

function renderBadge(label: string, className: string): string {
  return `<span class="inline-flex rounded-md border px-2 py-0.5 text-xs ${className}">${escapeHtml(label)}</span>`
}

function getFactoryResponseBadgeClass(status: string): string {
  switch (status) {
    case 'PENDING_RESPONSE':
      return 'border-orange-200 bg-orange-50 text-orange-700'
    case 'AUTO_CONFIRMED':
      return 'border-blue-200 bg-blue-50 text-blue-700'
    case 'CONFIRMED':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700'
    case 'DISPUTED':
      return 'border-amber-200 bg-amber-50 text-amber-700'
    default:
      return 'border-slate-200 bg-slate-50 text-slate-600'
  }
}

function getDisputeBadgeClass(status: string): string {
  switch (status) {
    case 'PENDING_REVIEW':
    case 'IN_REVIEW':
      return 'border-amber-200 bg-amber-50 text-amber-700'
    case 'PARTIALLY_ADJUSTED':
    case 'REVERSED':
      return 'border-blue-200 bg-blue-50 text-blue-700'
    case 'UPHELD':
      return 'border-red-200 bg-red-50 text-red-700'
    default:
      return 'border-slate-200 bg-slate-50 text-slate-600'
  }
}

function getSettlementBadgeClass(status: string): string {
  switch (status) {
    case 'BLOCKED':
      return 'border-orange-200 bg-orange-50 text-orange-700'
    case 'ELIGIBLE':
    case 'INCLUDED_IN_STATEMENT':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700'
    case 'SETTLED':
      return 'border-blue-200 bg-blue-50 text-blue-700'
    case 'NEXT_CYCLE_ADJUSTMENT_PENDING':
      return 'border-violet-200 bg-violet-50 text-violet-700'
    default:
      return 'border-slate-200 bg-slate-50 text-slate-600'
  }
}

function getLiabilityBadgeClass(status: string): string {
  switch (status) {
    case 'FACTORY':
      return 'border-red-200 bg-red-50 text-red-700'
    case 'NON_FACTORY':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700'
    case 'MIXED':
      return 'border-blue-200 bg-blue-50 text-blue-700'
    default:
      return 'border-slate-200 bg-slate-50 text-slate-600'
  }
}

function getBasisBadgeClass(statusLabel: string): string {
  if (statusLabel === '已生效') return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  if (statusLabel === '已调整') return 'border-blue-200 bg-blue-50 text-blue-700'
  if (statusLabel === '已生成') return 'border-orange-200 bg-orange-50 text-orange-700'
  if (statusLabel === '已取消') return 'border-slate-200 bg-slate-50 text-slate-600'
  return 'border-slate-200 bg-slate-50 text-slate-600'
}

function formatDeadlineSummary(deadline?: string, isOverdue?: boolean): string {
  if (!deadline) return '—'
  const timestamp = new Date(deadline.replace(' ', 'T')).getTime()
  if (!Number.isFinite(timestamp)) return formatDateTime(deadline)
  const diff = timestamp - Date.now()
  const abs = Math.abs(diff)
  const day = 24 * 60 * 60 * 1000
  const hour = 60 * 60 * 1000
  const amount = abs >= day ? Math.ceil(abs / day) : Math.ceil(abs / hour)
  const unit = abs >= day ? '天' : '小时'
  const overdue = isOverdue ?? diff < 0
  const summary = overdue ? `已超时 ${amount}${unit}` : `剩余 ${amount}${unit}`
  return `${formatDateTime(deadline)} · ${summary}`
}

function renderEvidenceAssets(
  assets: Array<{ assetId: string; name: string; assetType: 'IMAGE' | 'VIDEO' | 'DOCUMENT'; url?: string }>,
  emptyText: string,
): string {
  if (assets.length === 0) {
    return `<div class="rounded-md border border-dashed bg-background px-4 py-6 text-sm text-muted-foreground">${escapeHtml(emptyText)}</div>`
  }

  return `
    <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      ${assets
        .map(
          (asset) => `
            <article class="rounded-md border bg-background px-4 py-3">
              <div class="flex items-center justify-between gap-3">
                <span class="text-sm font-medium text-foreground">${escapeHtml(asset.name)}</span>
                <span class="rounded bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">${EVIDENCE_ASSET_TYPE_LABEL[asset.assetType]}</span>
              </div>
              <div class="mt-2 text-xs text-muted-foreground">素材 ID：${escapeHtml(asset.assetId)}</div>
              ${
                asset.url
                  ? `<div class="mt-2 text-xs text-primary underline">${escapeHtml(asset.url)}</div>`
                  : ''
              }
            </article>
          `,
        )
        .join('')}
    </div>
  `
}

function renderAdjudicationResultOptions(selected: QcRecordDetailState['adjudication']['result']): string {
  return `
    <option value="" ${selected === '' ? 'selected' : ''}>请选择裁决结果</option>
    ${Object.entries(PLATFORM_ADJUDICATION_RESULT_LABEL)
      .map(
        ([value, label]) =>
          `<option value="${value}" ${selected === value ? 'selected' : ''}>${label}</option>`,
      )
      .join('')}
  `
}

function renderAdjudicationPanel(
  detailVm: PlatformQcDetailViewModel,
  detail: QcRecordDetailState,
): string {
  if (!detailVm.canHandleDispute || !detailVm.disputeCase) return ''

  const isPartial = detail.adjudication.result === 'PARTIALLY_ADJUSTED'
  const settlementLocked = Boolean(detailVm.settlementImpact.statementLockedAt || detailVm.settlementImpact.settledAt)
  const settlementStageHint = settlementLocked
    ? '当前记录已纳入锁账或预付款批次。若裁决改变金额，本次不会反改历史批次，仅回写正式质量扣款流水的最终结果。'
    : '当前记录尚未锁账。维持当前工厂责任或调整为部分工厂责任后，可直接生成正式质量扣款流水。'

  return `
    <div class="rounded-md border border-amber-200 bg-amber-50/60 px-4 py-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p class="text-sm font-semibold text-amber-900">平台裁决操作</p>
          <p class="mt-1 text-xs leading-5 text-amber-800">${escapeHtml(settlementStageHint)}</p>
        </div>
        <span class="inline-flex rounded-md border border-amber-300 bg-white px-2 py-0.5 text-[11px] text-amber-700">
          当前异议待处理
        </span>
      </div>

      <div class="mt-4 grid gap-4 lg:grid-cols-2">
        <div class="space-y-2">
          <label class="text-xs text-muted-foreground">裁决结果</label>
          <select class="h-10 w-full rounded-md border bg-white px-3 text-sm" data-qcd-adjudication-field="result">
            ${renderAdjudicationResultOptions(detail.adjudication.result)}
          </select>
        </div>
        <div class="space-y-2">
          <label class="text-xs text-muted-foreground">当前责任数量 / 当前金额口径</label>
          <div class="rounded-md border bg-white px-3 py-2 text-sm text-muted-foreground">
            责任数量 ${detailVm.qcRecord.factoryLiabilityQty} 件 · 冻结加工费 ${formatMoney(detailVm.settlementImpact.blockedProcessingFeeAmount)} · 生效质量扣款 ${formatMoney(detailVm.settlementImpact.effectiveQualityDeductionAmount)}
          </div>
        </div>
      </div>

      <div class="mt-4 space-y-2">
        <label class="text-xs text-muted-foreground">裁决意见</label>
        <textarea
          class="min-h-24 w-full rounded-md border bg-white px-3 py-2 text-sm"
          data-qcd-adjudication-field="comment"
          placeholder="请说明最终维持工厂责任、最终部分工厂责任或最终非工厂责任的依据。"
        >${escapeHtml(detail.adjudication.comment)}</textarea>
      </div>

      ${
        isPartial
          ? `
            <div class="mt-4 grid gap-4 lg:grid-cols-3">
              <div class="space-y-2">
                <label class="text-xs text-muted-foreground">调整后责任数量</label>
                <input class="h-10 w-full rounded-md border bg-white px-3 text-sm" type="number" min="0" step="1" data-qcd-adjudication-field="adjustedLiableQty" value="${toInputValue(detail.adjudication.adjustedLiableQty)}" />
              </div>
              <div class="space-y-2">
                <label class="text-xs text-muted-foreground">调整后冻结加工费金额</label>
                <input class="h-10 w-full rounded-md border bg-white px-3 text-sm" type="number" min="0" step="0.01" data-qcd-adjudication-field="adjustedBlockedProcessingFeeAmount" value="${toInputValue(detail.adjudication.adjustedBlockedProcessingFeeAmount)}" />
              </div>
              <div class="space-y-2">
                <label class="text-xs text-muted-foreground">调整后生效质量扣款金额</label>
                <input class="h-10 w-full rounded-md border bg-white px-3 text-sm" type="number" min="0" step="0.01" data-qcd-adjudication-field="adjustedEffectiveQualityDeductionAmount" value="${toInputValue(detail.adjudication.adjustedEffectiveQualityDeductionAmount)}" />
              </div>
            </div>
            <div class="mt-4 space-y-2">
              <label class="text-xs text-muted-foreground">调整说明</label>
              <textarea
                class="min-h-20 w-full rounded-md border bg-white px-3 py-2 text-sm"
                data-qcd-adjudication-field="adjustmentReasonSummary"
                placeholder="请说明数量、冻结加工费或质量扣款金额为何调整。"
              >${escapeHtml(detail.adjudication.adjustmentReasonSummary)}</textarea>
            </div>
          `
          : detail.adjudication.result === 'REVERSED'
            ? `
              <div class="mt-4 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                改判为非工厂责任后，将关闭当前待确认质量扣款记录，并且不生成正式质量扣款流水。
              </div>
            `
            : ''
      }

      ${
        detail.adjudication.errorText
          ? `<div class="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">${escapeHtml(detail.adjudication.errorText)}</div>`
          : ''
      }

      <div class="mt-4 flex flex-wrap gap-3">
        <button class="inline-flex h-9 items-center rounded-md bg-amber-600 px-4 text-sm font-medium text-white hover:bg-amber-700" data-qcd-action="submit-adjudication">
          提交裁决并回写
        </button>
      </div>
    </div>
  `
}

function renderExistingQcPcDetail(detailVm: PlatformQcDetailViewModel, detail: QcRecordDetailState): string {
  const focusSection = getCurrentSearchParams().get('focus')
  const { qcRecord, factoryResponse, deductionBasis, disputeCase, formalLedger, settlementImpact, settlementAdjustment } = detailVm
  const resultLabel = RESULT_LABEL[detailVm.qcResultDisplay]
  const resultClass = RESULT_CLASS[detailVm.qcResultDisplay]
  const statusClass = STATUS_CLASS[qcRecord.qcStatus as QcStatus]
  const statusLabel = STATUS_LABEL[qcRecord.qcStatus as QcStatus]
  const resultExplanation = getResultExplanation(
    detailVm.qcResultDisplay,
    qcRecord.inspectedQty,
    qcRecord.qualifiedQty,
    qcRecord.unqualifiedQty,
  )
  const liabilitySummary =
    qcRecord.responsiblePartyType || qcRecord.responsiblePartyId
      ? `${PARTY_TYPE_LABEL[qcRecord.responsiblePartyType ?? 'OTHER']} / ${escapeHtml(qcRecord.responsiblePartyId ?? '-')}${qcRecord.responsiblePartyName ? `（${escapeHtml(qcRecord.responsiblePartyName)}）` : ''}`
      : '待确认'
  const defectSummary =
    qcRecord.defectItems.length > 0
      ? qcRecord.defectItems.map((item) => `${escapeHtml(item.defectName)} × ${item.qty}`).join('；')
      : escapeHtml(qcRecord.unqualifiedReasonSummary ?? qcRecord.remark ?? '—')
  const ruleVersion = qcRecord.inspectedAt.slice(0, 7).replace('-', '.') || '2026.03'
  const disputeSectionClass =
    focusSection === 'dispute'
      ? 'rounded-lg border border-amber-200 bg-amber-50/40 ring-2 ring-amber-100'
      : 'rounded-lg border bg-card'
  const adjudicationPanel = renderAdjudicationPanel(detailVm, detail)
  const logSection =
    qcRecord.auditLogs.length > 0
      ? renderPcSection(
          '操作日志',
          '保留共享质检事实的操作日志，便于核对提交、判责、异议和结算写回节点。',
          `
            <ol class="space-y-3">
              ${qcRecord.auditLogs
                .map(
                  (log) => `
                    <li class="flex flex-wrap items-start gap-3 rounded-md border bg-background px-4 py-3 text-sm">
                      <span class="shrink-0 font-mono text-xs text-muted-foreground">${escapeHtml(log.at)}</span>
                      <span class="shrink-0 font-medium text-foreground">${escapeHtml(log.by)}</span>
                      <span class="min-w-0 flex-1 text-muted-foreground">${formatAuditDetail(log.detail, resultLabel)}</span>
                    </li>
                  `,
                )
                .join('')}
            </ol>
          `,
        )
      : ''

  return `
    <div class="flex flex-col gap-6 p-6">
      <header class="rounded-lg border bg-card px-5 py-5">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div class="flex min-w-0 items-start gap-3">
            <button class="mt-0.5 rounded-md border p-2 text-muted-foreground hover:bg-muted hover:text-foreground" data-qcd-action="back-list">
              <i data-lucide="chevron-left" class="h-4 w-4"></i>
            </button>
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <h1 class="text-2xl font-semibold leading-tight text-foreground">质检记录 ${escapeHtml(detailVm.qcNo)}</h1>
                ${renderBadge(statusLabel, statusClass)}
                ${renderBadge(resultLabel, resultClass)}
                ${renderBadge(detailVm.factoryResponseStatusLabel, getFactoryResponseBadgeClass(factoryResponse?.factoryResponseStatus ?? 'NOT_REQUIRED'))}
                ${
                  disputeCase
                    ? renderBadge(detailVm.disputeStatusLabel, getDisputeBadgeClass(disputeCase.status))
                    : ''
                }
                ${renderBadge(detailVm.settlementImpactStatusLabel, getSettlementBadgeClass(settlementImpact.status))}
              </div>
              <p class="mt-2 text-sm text-muted-foreground">
                ${escapeHtml(detailVm.sourceTypeLabel)}
                · 回货批次 <span class="font-mono">${formatDetailValue(qcRecord.returnInboundBatchNo)}</span>
                · 生产单 <span class="font-mono">${formatDetailValue(qcRecord.productionOrderNo)}</span>
                ${qcRecord.taskId ? ` · 任务 <span class="font-mono">${escapeHtml(qcRecord.taskId)}</span>` : ''}
              </p>
              <p class="mt-1 text-sm text-muted-foreground">
                ${escapeHtml(qcRecord.processLabel)} · ${escapeHtml(qcRecord.returnFactoryName ?? '-')} · ${escapeHtml(qcRecord.warehouseName ?? '-')}
              </p>
              ${
                detailVm.canHandleDispute
                  ? '<div class="mt-3 inline-flex rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-700">当前记录待平台处理异议，请在下方“工厂响应与异议”完成裁决。</div>'
                  : ''
              }
            </div>
          </div>
          <div class="flex flex-wrap gap-3">
            ${
              detailVm.canHandleDispute
                ? `<button class="inline-flex h-9 items-center rounded-md border border-amber-200 px-4 text-sm text-amber-700 hover:bg-amber-50" data-nav="${buildQcDetailHref(detailVm.qcId)}?focus=dispute">处理异议</button>`
                : ''
            }
            <button class="inline-flex h-9 items-center rounded-md border px-4 text-sm hover:bg-muted" data-qcd-action="back-list">
              返回列表
            </button>
          </div>
        </div>
      </header>

      <section class="grid gap-4 xl:grid-cols-4">
        ${renderOverviewCard(
          '检查现场概况',
          [
            { label: '检查场景', value: escapeHtml(getInspectionSceneLabel(qcRecord)) },
            { label: '回货环节', value: escapeHtml(qcRecord.processLabel) },
            { label: '回货工厂', value: formatDetailValue(qcRecord.returnFactoryName) },
            { label: '接收方', value: formatDetailValue(qcRecord.receiverName ?? qcRecord.warehouseName) },
            { label: '回货批次号', value: `<span class="font-mono">${formatDetailValue(qcRecord.returnInboundBatchNo)}</span>` },
            { label: '检查方式', value: escapeHtml(getInspectionMethodLabel(qcRecord)) },
            { label: '检查人', value: escapeHtml(qcRecord.inspectorUserName) },
            { label: '完成时间', value: escapeHtml(formatDateTime(qcRecord.inspectedAt)) },
          ],
          `来源类型：${escapeHtml(detailVm.sourceTypeLabel)}`,
        )}
        ${renderOverviewCard(
          '数量与结果概况',
          [
            { label: '检查结果', value: renderBadge(resultLabel, resultClass) },
            { label: '工厂交出', value: String(qcRecord.declaredQty ?? qcRecord.inspectedQty) },
            { label: '接收方实收', value: String(qcRecord.receivedQty ?? qcRecord.inspectedQty) },
            { label: '质检数量', value: String(qcRecord.inspectedQty) },
            { label: '合格 / 不合格', value: `${qcRecord.qualifiedQty} / ${qcRecord.unqualifiedQty}` },
            { label: '工厂责任 / 非工厂责任', value: `${qcRecord.factoryLiabilityQty} / ${qcRecord.nonFactoryLiabilityQty}` },
          ],
          escapeHtml(resultExplanation),
        )}
        ${renderOverviewCard(
          '工厂响应概况',
          [
            { label: '是否需要工厂响应', value: detailVm.requiresFactoryResponse ? '需要' : '无需' },
            { label: '当前响应状态', value: renderBadge(detailVm.factoryResponseStatusLabel, getFactoryResponseBadgeClass(factoryResponse?.factoryResponseStatus ?? 'NOT_REQUIRED')) },
            { label: '响应截止 / 剩余', value: escapeHtml(formatDeadlineSummary(factoryResponse?.responseDeadlineAt, factoryResponse?.isOverdue)) },
            { label: '异议状态', value: renderBadge(detailVm.disputeStatusLabel, getDisputeBadgeClass(disputeCase?.status ?? 'NONE')) },
          ],
          escapeHtml(factoryResponse?.responseComment ?? disputeCase?.disputeDescription ?? '当前无工厂补充说明'),
        )}
        ${renderOverviewCard(
          '扣款与结算概况',
          [
            { label: '扣款依据', value: deductionBasis ? `<span class="font-mono">${escapeHtml(deductionBasis.basisId)}</span>` : '未生成' },
            { label: '冻结加工费', value: formatMoney(settlementImpact.blockedProcessingFeeAmount) },
            { label: '生效质量扣款', value: formatMoney(settlementImpact.effectiveQualityDeductionAmount) },
            { label: '结算影响', value: renderBadge(detailVm.settlementImpactStatusLabel, getSettlementBadgeClass(settlementImpact.status)) },
          ],
          escapeHtml(settlementImpact.summary),
        )}
      </section>

      ${renderPcSection(
        '基本信息',
        '平台统一查看检查来源、现场主体和责任对象。',
        renderPcFieldGrid([
          { label: '检查单号', value: `<span class="font-mono">${escapeHtml(detailVm.qcNo)}</span>` },
          { label: '来源类型', value: escapeHtml(detailVm.sourceTypeLabel) },
          { label: '回货批次号', value: `<span class="font-mono">${formatDetailValue(qcRecord.returnInboundBatchNo)}</span>` },
          { label: '生产单号', value: `<span class="font-mono">${formatDetailValue(qcRecord.productionOrderNo)}</span>` },
          { label: '任务ID', value: qcRecord.taskId ? `<span class="font-mono">${escapeHtml(qcRecord.taskId)}</span>` : '—' },
          { label: '检查场景', value: escapeHtml(getInspectionSceneLabel(qcRecord)) },
          { label: '回货环节', value: escapeHtml(qcRecord.processLabel) },
          { label: '回货工厂', value: formatDetailValue(qcRecord.returnFactoryName) },
          { label: '接收方', value: formatDetailValue(qcRecord.receiverName ?? qcRecord.warehouseName) },
          { label: '检查方式', value: escapeHtml(getInspectionMethodLabel(qcRecord)) },
          { label: '检查策略', value: escapeHtml(detailVm.qcPolicyLabel) },
          { label: '检查人', value: escapeHtml(qcRecord.inspectorUserName) },
          { label: '检查时间', value: escapeHtml(formatDateTime(qcRecord.inspectedAt)) },
          {
            label: '来源业务',
            value: `${formatDetailValue(qcRecord.sourceBusinessType)} / ${formatDetailValue(qcRecord.sourceBusinessId)}`,
          },
          {
            label: '车缝后道模式',
            value:
              qcRecord.sewPostProcessMode
                ? escapeHtml(SEW_POST_PROCESS_MODE_LABEL[qcRecord.sewPostProcessMode] ?? qcRecord.sewPostProcessMode)
                : '—',
          },
        ]),
      )}

      ${renderPcSection(
        '数量与结果',
        '用总检、合格、不合格和责任数量直接解释“合格 / 部分合格 / 不合格”三态结果。',
        `
          <div class="space-y-5">
            ${renderPcFieldGrid(
              [
                { label: '总检数量', value: String(qcRecord.inspectedQty) },
                { label: '合格数量', value: String(qcRecord.qualifiedQty) },
                { label: '不合格数量', value: String(qcRecord.unqualifiedQty) },
                { label: '工厂责任数量', value: String(qcRecord.factoryLiabilityQty) },
                { label: '非工厂责任数量', value: String(qcRecord.nonFactoryLiabilityQty) },
                { label: '质检结果', value: renderBadge(resultLabel, resultClass) },
                { label: '合格率', value: formatRate(detailVm.qualifiedRate) },
                { label: '不合格率', value: formatRate(detailVm.unqualifiedRate) },
              ],
              'md:grid-cols-2 xl:grid-cols-4',
            )}
            <div class="rounded-md border bg-background px-4 py-4">
              <div class="flex items-center justify-between gap-3 text-sm">
                <span class="font-medium text-foreground">数量判定依据</span>
                <span class="text-muted-foreground">${escapeHtml(resultExplanation)}</span>
              </div>
              <div class="mt-4 overflow-hidden rounded-full bg-muted">
                <div class="flex h-3 w-full">
                  <div class="bg-green-500" style="width: ${Math.max(detailVm.qualifiedRate, 0)}%"></div>
                  <div class="bg-red-500" style="width: ${Math.max(detailVm.unqualifiedRate, 0)}%"></div>
                </div>
              </div>
              <div class="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
                <span>绿色：合格数量 ${qcRecord.qualifiedQty}</span>
                <span>红色：不合格数量 ${qcRecord.unqualifiedQty}</span>
                <span>工厂责任数量 ${qcRecord.factoryLiabilityQty}</span>
              </div>
            </div>
          </div>
        `,
      )}

      ${renderPcSection(
        '缺陷与检查证据',
        '这里只展示现场缺陷和检查证据，用于先确认发生了什么。',
        `
          <div class="space-y-5">
            ${renderPcFieldGrid(
              [
                {
                  label: '缺陷类型',
                  value:
                    qcRecord.defectItems.length > 0
                      ? qcRecord.defectItems.map((item) => escapeHtml(item.defectName)).join('、')
                      : '—',
                },
                { label: '缺陷描述', value: defectSummary },
                { label: '检查证据数量', value: `${detailVm.warehouseEvidenceCount} 份` },
              ],
            )}
            ${renderEvidenceAssets(qcRecord.evidenceAssets, '当前暂无检查证据素材。')}
          </div>
        `,
      )}

      ${renderPcSection(
        '责任判定与不合格品处理',
        detailVm.showUnqualifiedHandling
          ? '该区块只说明谁负责、责任数量是多少，以及不合格品如何处理。'
          : '该记录全部合格，仅保留责任与金额空态，不展示完整不合格品处理流程。',
        detailVm.showUnqualifiedHandling
          ? `
              <div class="space-y-5">
                ${renderPcFieldGrid(
                  [
                    { label: '责任状态', value: renderBadge(detailVm.liabilityStatusLabel, getLiabilityBadgeClass(qcRecord.liabilityStatus)) },
                    { label: '责任方', value: liabilitySummary },
                    { label: '工厂责任 / 非工厂责任', value: `${qcRecord.factoryLiabilityQty} / ${qcRecord.nonFactoryLiabilityQty}` },
                    {
                      label: '不合格品处置方式',
                      value: qcRecord.unqualifiedDisposition ? escapeHtml(DISPOSITION_LABEL[qcRecord.unqualifiedDisposition] ?? qcRecord.unqualifiedDisposition) : '—',
                    },
                    { label: '责任说明', value: escapeHtml(qcRecord.unqualifiedReasonSummary ?? qcRecord.deductionDecisionRemark ?? qcRecord.dispositionRemark ?? ROOT_CAUSE_LABEL[qcRecord.rootCauseType] ?? qcRecord.rootCauseType) },
                  ],
                )}
              </div>
            `
          : '<div class="rounded-md border border-dashed bg-background px-4 py-6 text-sm text-muted-foreground">当前为合格记录，无不合格品处置，也未形成冻结加工费或质量扣款。</div>',
      )}

      ${renderPcSection(
        '工厂响应与异议',
        '先看工厂是否已响应、是否超时，再顺着看异议提交、平台裁决和回写结果。',
        `
          <div id="qc-dispute-section" class="space-y-5">
            ${
              focusSection === 'dispute' && adjudicationPanel
                ? `
                  <div class="${disputeSectionClass} p-4">
                    <div class="mb-3">
                      <h3 class="text-sm font-semibold text-foreground">异议处理入口</h3>
                      <p class="mt-1 text-xs text-muted-foreground">从列表“处理异议”进入时，直接在这里完成裁决并写回共享链路。</p>
                    </div>
                    ${adjudicationPanel}
                  </div>
                `
                : ''
            }
            <div class="space-y-4">
              <div class="flex items-center justify-between gap-3">
                <h3 class="text-sm font-semibold text-foreground">工厂响应</h3>
                ${renderBadge(detailVm.factoryResponseStatusLabel, getFactoryResponseBadgeClass(factoryResponse?.factoryResponseStatus ?? 'NOT_REQUIRED'))}
              </div>
              ${renderPcFieldGrid(
                [
                  { label: '是否需要工厂响应', value: detailVm.requiresFactoryResponse ? '需要' : '无需' },
                  {
                    label: '响应动作',
                    value: factoryResponse?.responseAction ? FACTORY_RESPONSE_ACTION_LABEL[factoryResponse.responseAction] : '—',
                  },
                  {
                    label: '响应截止时间',
                    value: escapeHtml(formatDeadlineSummary(factoryResponse?.responseDeadlineAt, factoryResponse?.isOverdue)),
                  },
                  { label: '响应时间', value: factoryResponse?.respondedAt ? escapeHtml(formatDateTime(factoryResponse.respondedAt)) : '—' },
                  { label: '自动确认时间', value: factoryResponse?.autoConfirmedAt ? escapeHtml(formatDateTime(factoryResponse.autoConfirmedAt)) : '—' },
                  { label: '响应人', value: formatDetailValue(factoryResponse?.responderUserName) },
                  { label: '是否超时', value: factoryResponse?.isOverdue ? '是' : '否' },
                ],
              )}
              ${
                factoryResponse?.responseComment
                  ? `<div class="rounded-md border bg-background px-4 py-3 text-sm text-muted-foreground">工厂备注：${escapeHtml(factoryResponse.responseComment)}</div>`
                  : '<div class="rounded-md border border-dashed bg-background px-4 py-3 text-sm text-muted-foreground">当前无工厂备注。</div>'
              }
            </div>
            <div class="space-y-4 border-t pt-5">
              <div class="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 class="text-sm font-semibold text-foreground">异议处理结果</h3>
                  <p class="mt-1 text-xs text-muted-foreground">平台在这里查看工厂异议证据、裁决结果和回写结果。</p>
                </div>
                ${
                  detailVm.canHandleDispute
                    ? '<div class="inline-flex rounded-md border border-amber-200 bg-amber-50 px-3 py-1 text-xs text-amber-700">当前待平台处理</div>'
                    : ''
                }
              </div>
              ${
                !disputeCase
                  ? '<div class="rounded-md border border-dashed bg-background px-4 py-6 text-sm text-muted-foreground">当前无异议单。</div>'
                  : `
                      <div class="space-y-5">
                        ${
                          detailVm.canHandleDispute && focusSection !== 'dispute'
                            ? adjudicationPanel
                            : ''
                        }
                        ${renderPcFieldGrid(
                          [
                            { label: '异议单号', value: `<span class="font-mono">${escapeHtml(disputeCase.disputeId)}</span>` },
                            { label: '异议状态', value: renderBadge(detailVm.disputeStatusLabel, getDisputeBadgeClass(disputeCase.status)) },
                            { label: '异议原因', value: escapeHtml(disputeCase.disputeReasonName) },
                            { label: '异议说明', value: escapeHtml(disputeCase.disputeDescription) },
                            { label: '提交时间', value: disputeCase.submittedAt ? escapeHtml(formatDateTime(disputeCase.submittedAt)) : '—' },
                            { label: '提交人', value: formatDetailValue(disputeCase.submittedByUserName) },
                            { label: '平台处理人', value: formatDetailValue(disputeCase.reviewerUserName) },
                            { label: '裁决时间', value: disputeCase.adjudicatedAt ? escapeHtml(formatDateTime(disputeCase.adjudicatedAt)) : '—' },
                            { label: '裁决结果', value: escapeHtml(disputeCase.adjudicationResult ? PLATFORM_ADJUDICATION_RESULT_LABEL[disputeCase.adjudicationResult] : detailVm.disputeStatusLabel) },
                            { label: '裁决意见', value: escapeHtml(disputeCase.adjudicationComment ?? '—') },
                            { label: '回写时间', value: disputeCase.resultWrittenBackAt ? escapeHtml(formatDateTime(disputeCase.resultWrittenBackAt)) : settlementAdjustment?.writtenBackAt ? escapeHtml(formatDateTime(settlementAdjustment.writtenBackAt)) : '—' },
                            {
                              label: '金额变化',
                              value:
                                disputeCase.adjudicatedAmount !== undefined
                                  ? `${disputeCase.requestedAmount ?? 0} → ${disputeCase.adjudicatedAmount} CNY`
                                  : disputeCase.requestedAmount !== undefined
                                    ? `${disputeCase.requestedAmount} CNY`
                                    : '—',
                            },
                          ],
                        )}
                        <div class="space-y-3">
                          <div class="flex items-center justify-between">
                            <h4 class="text-sm font-semibold text-foreground">工厂异议证据</h4>
                            <span class="text-xs text-muted-foreground">${detailVm.disputeEvidenceCount} 份</span>
                          </div>
                          ${renderEvidenceAssets(disputeCase.disputeEvidenceAssets, '当前无工厂异议证据。')}
                        </div>
                      </div>
                    `
              }
            </div>
          </div>
        `,
      )}

      ${renderPcSection(
        '扣款与结算',
        '这里统一查看扣款依据、正式质量扣款流水与预结算衔接，不再混入旧的调整主链口径。',
        `
          <div class="space-y-5">
            <div class="space-y-4 rounded-md border bg-background px-4 py-4">
              <div class="flex flex-wrap items-center justify-between gap-3">
                <h3 class="text-sm font-semibold text-foreground">扣款依据</h3>
                ${
                  deductionBasis
                    ? renderBadge(detailVm.deductionBasisStatusLabel, getBasisBadgeClass(detailVm.deductionBasisStatusLabel))
                    : '<span class="text-sm text-muted-foreground">未生成</span>'
                }
              </div>
              ${
                !deductionBasis
                  ? '<div class="rounded-md border border-dashed px-4 py-6 text-sm text-muted-foreground">当前暂无关联扣款依据。</div>'
                  : `
                      ${renderPcFieldGrid(
                        [
                          { label: '扣款依据编号', value: `<span class="font-mono">${escapeHtml(deductionBasis.basisId)}</span>` },
                          { label: '依据状态', value: renderBadge(detailVm.deductionBasisStatusLabel, getBasisBadgeClass(detailVm.deductionBasisStatusLabel)) },
                          { label: '规则名称', value: '回货入仓质量扣款规则' },
                          { label: '规则版本', value: `${escapeHtml(ruleVersion)} 原型版` },
                          { label: '计扣说明', value: escapeHtml(deductionBasis.summary) },
                          { label: '规则说明', value: escapeHtml(qcRecord.deductionDecisionRemark ?? qcRecord.dispositionRemark ?? '按质检责任与处置结果生成扣款依据') },
                          { label: '冻结加工费金额', value: formatMoney(deductionBasis.blockedProcessingFeeAmount) },
                          { label: '初始质量扣款金额', value: formatMoney(deductionBasis.proposedQualityDeductionAmount) },
                          { label: '生效质量扣款金额', value: formatMoney(deductionBasis.effectiveQualityDeductionAmount) },
                        ],
                      )}
                      <div class="space-y-3">
                        <div class="flex items-center justify-between">
                          <h4 class="text-sm font-semibold text-foreground">引用证据</h4>
                          <span class="text-xs text-muted-foreground">${detailVm.basisEvidenceCount} 份</span>
                        </div>
                        ${renderEvidenceAssets(deductionBasis.evidenceAssets, '当前无引用证据。')}
                      </div>
                    `
              }
            </div>
            <div class="space-y-4 rounded-md border bg-background px-4 py-4">
              <div class="flex flex-wrap items-center justify-between gap-3">
                <h3 class="text-sm font-semibold text-foreground">正式质量扣款流水与预结算衔接</h3>
                ${renderBadge(detailVm.settlementImpactStatusLabel, getSettlementBadgeClass(settlementImpact.status))}
              </div>
              ${renderPcFieldGrid(
                [
                  { label: '结算影响状态', value: renderBadge(detailVm.settlementImpactStatusLabel, getSettlementBadgeClass(settlementImpact.status)) },
                  { label: '是否已形成正式流水', value: formalLedger ? '是' : '否' },
                  { label: '正式流水编号', value: formalLedger ? `<span class="font-mono">${escapeHtml(formalLedger.ledgerNo)}</span>` : '—' },
                  { label: '原币金额', value: formalLedger ? `${formalLedger.originalAmount} ${escapeHtml(formalLedger.originalCurrency)}` : '—' },
                  { label: '预结算币种', value: formalLedger ? escapeHtml(formalLedger.settlementCurrency) : '—' },
                  { label: '预结算金额', value: formalLedger ? `${formalLedger.settlementAmount} ${escapeHtml(formalLedger.settlementCurrency)}` : '—' },
                  { label: '汇率快照', value: formalLedger ? String(formalLedger.fxRate) : '—' },
                  { label: '生成时间', value: formalLedger?.generatedAt ? escapeHtml(formatDateTime(formalLedger.generatedAt)) : '—' },
                  { label: '是否已进入预结算单', value: formalLedger?.includedStatementId ? '是' : '否' },
                  { label: '预结算单号', value: formatDetailValue(formalLedger?.includedStatementId ?? settlementImpact.includedSettlementStatementId) },
                  { label: '预付款批次号', value: formatDetailValue(formalLedger?.includedPrepaymentBatchId ?? settlementImpact.includedSettlementBatchId) },
                  { label: '预付完成时间', value: formalLedger?.prepaidAt ? escapeHtml(formatDateTime(formalLedger.prepaidAt)) : '—' },
                  { label: '最近回写时间', value: settlementImpact.lastWrittenBackAt ? escapeHtml(formatDateTime(settlementImpact.lastWrittenBackAt)) : '—' },
                ],
              )}
              <div class="rounded-md border bg-card px-4 py-3 text-sm text-muted-foreground">${escapeHtml(settlementImpact.summary)}</div>
              ${
                !formalLedger && settlementAdjustment
                  ? `
                    <div class="rounded-md border border-dashed bg-card px-4 py-4 text-sm text-muted-foreground">
                      兼容说明：当前仍保留旧兼容映射字段以保证历史页面可读，但新主链只认正式质量扣款流水；本条记录当前${escapeHtml(
                        settlementAdjustment.summary,
                      )}。
                    </div>
                  `
                  : ''
              }
            </div>
          </div>
        `,
      )}

      ${logSection}
    </div>
  `
}

function renderQcRecordDetailPageByVariant(
  qcId: string,
  variant: 'web' | 'mobile',
): string {
  const detail = ensureDetailState(qcId)
  const platformDetailVm = qcId === 'new' ? null : getPlatformQcDetailViewModelByRouteKey(qcId)
  const chainFact = qcId === 'new' ? null : getQcChainFactByRouteKey(qcId)
  const existingQc = chainFact?.qc ?? (detail.currentQcId ? getQcById(detail.currentQcId) : null)

  if (qcId !== 'new' && !existingQc) {
    return renderDetailNotFound(qcId)
  }

  const selectedBatch = detail.form.refType === 'RETURN_BATCH' ? getReturnInboundBatchById(detail.form.refId) : null
  const inboundView = existingQc ? normalizeQcForView(existingQc, initialReturnInboundBatches, processTasks) : null
  const readOnly = existingQc?.status === 'SUBMITTED' || existingQc?.status === 'CLOSED'
  const isFail = detail.form.result === 'FAIL'
  const needsQty =
    detail.form.disposition !== '' && NEEDS_AFFECTED_QTY.includes(detail.form.disposition)
  const refTask = processTasks.find((item) => item.taskId === detail.form.refId)
  const finalLiabilityRequired = requiresFinalDecisionForForm(detail.form, existingQc)
  const sourceTaskForView =
    (inboundView?.sourceTaskId ? processTasks.find((item) => item.taskId === inboundView.sourceTaskId) ?? null : null) ??
    refTask ??
    null
  const maxQty = selectedBatch?.returnedQty ?? refTask?.qty
  const basisItems = chainFact?.basisItems ?? (detail.currentQcId
    ? initialDeductionBasisItems.filter(
        (item) => item.sourceRefId === detail.currentQcId || item.sourceId === detail.currentQcId,
      )
    : [])
  const basisReadyCount = basisItems.filter((item) => item.settlementReady === true).length
  const basisFrozenCount = basisItems.filter((item) => item.settlementReady === false).length
  const basisAmountTotal = chainFact?.deductionAmountCny ?? basisItems.reduce((sum, item) => sum + (item.deductionAmountSnapshot ?? 0), 0)
  const settlementImpact = chainFact?.settlementImpact ?? null
  const dispute = chainFact?.dispute ?? null
  const evidenceCount = chainFact?.evidenceCount ?? basisItems.reduce((sum, item) => sum + item.evidenceRefs.length, 0)
  const sourceTypeLabel =
    inboundView?.isReturnInbound || detail.form.refType === 'RETURN_BATCH'
      ? '回货入仓批次'
      : detail.form.refType === 'TASK'
        ? '生产任务'
        : '交接事件'

  if (variant === 'web' && platformDetailVm) {
    return renderExistingQcPcDetail(platformDetailVm, detail)
  }

  return `
    <div class="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-6">
      <div class="flex items-start gap-3">
        <button class="mt-0.5 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground" data-qcd-action="back-list">
          <i data-lucide="chevron-left" class="h-5 w-5"></i>
        </button>
        <div class="min-w-0 flex-1">
          <h1 class="text-xl font-semibold leading-tight">
            ${detail.currentQcId ? `质检记录 ${escapeHtml(detail.currentQcId)}` : '新建质检记录'}
          </h1>
          <p class="mt-0.5 text-sm text-muted-foreground">
            ${sourceTypeLabel}
            ${detail.form.refId ? ` · ${escapeHtml(detail.form.refId)}` : ''}
          </p>
        </div>
        ${
          existingQc
            ? `<span class="inline-flex rounded-md border px-2 py-0.5 text-xs ${STATUS_CLASS[existingQc.status as QcStatus]}">${STATUS_LABEL[existingQc.status as QcStatus]}</span>`
            : ''
        }
      </div>

      ${
        existingQc
          ? renderChainOverview({
              qc: existingQc,
              batchId: inboundView?.batchId || selectedBatch?.batchId || '-',
              warehouseName: inboundView?.warehouseName || selectedBatch?.warehouseName || '-',
              returnFactoryName:
                inboundView?.returnFactoryName || selectedBatch?.returnFactoryName || sourceTaskForView?.assignedFactoryName || '-',
              processLabel:
                inboundView?.processLabel ||
                (selectedBatch ? selectedBatch.processLabel ?? RETURN_INBOUND_PROCESS_LABEL[selectedBatch.processType] : '-'),
              basisCount: basisItems.length,
              basisReadyCount,
              basisFrozenCount,
              basisAmountTotal,
              evidenceCount,
              settlementImpactLabel: settlementImpact ? getSettlementImpactLabel(settlementImpact.status) : '未串联',
              settlementSummary: settlementImpact?.summary ?? existingQc.settlementFreezeReason ?? '结算状态由扣款依据自动维护',
              disputeSummary: dispute?.summary,
            })
          : ''
      }

      <section class="rounded-md border bg-card">
        <header class="border-b px-4 py-3">
          <h2 class="text-sm font-semibold">基本信息</h2>
        </header>
        <div class="space-y-4 px-4 py-4">
          <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div class="space-y-1.5">
              <label class="text-sm">引用类型</label>
              <select class="h-9 w-full rounded-md border bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-70" data-qcd-field="refType" ${readOnly ? 'disabled' : ''}>
                <option value="RETURN_BATCH" ${detail.form.refType === 'RETURN_BATCH' ? 'selected' : ''}>回货入仓批次</option>
                <option value="TASK" ${detail.form.refType === 'TASK' ? 'selected' : ''}>生产任务</option>
                <option value="HANDOVER" ${detail.form.refType === 'HANDOVER' ? 'selected' : ''}>交接事件</option>
              </select>
            </div>
            <div class="space-y-1.5">
              <label class="text-sm">${
                detail.form.refType === 'RETURN_BATCH'
                  ? '回货批次号'
                  : detail.form.refType === 'TASK'
                    ? '任务 ID'
                    : '交接事件 ID'
              }</label>
              ${
                detail.form.refType === 'RETURN_BATCH'
                  ? `
                    <select class="h-9 w-full rounded-md border bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-70" data-qcd-field="refId" ${readOnly ? 'disabled' : ''}>
                      <option value="">请选择回货批次</option>
                      ${initialReturnInboundBatches
                        .map(
                          (batch) =>
                            `<option value="${escapeHtml(batch.batchId)}" ${detail.form.refId === batch.batchId ? 'selected' : ''}>${escapeHtml(batch.batchId)} · ${escapeHtml(batch.processLabel ?? RETURN_INBOUND_PROCESS_LABEL[batch.processType])} · ${escapeHtml(batch.productionOrderId)}</option>`,
                        )
                        .join('')}
                    </select>
                  `
                  : `
                    <input class="h-9 w-full rounded-md border bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-70" data-qcd-field="refId" value="${toInputValue(detail.form.refId)}" placeholder="${detail.form.refType === 'TASK' ? 'TASK-xxxx-xxx' : 'HO-xxxx'}" ${readOnly ? 'disabled' : ''} />
                  `
              }
            </div>
          </div>

          <div class="space-y-1.5">
            <label class="text-sm">生产工单号</label>
            <input class="h-9 w-full rounded-md border bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-70" data-qcd-field="productionOrderId" value="${toInputValue(detail.form.productionOrderId)}" placeholder="PO-xxxx（关联任务时自动带入）" ${readOnly ? 'disabled' : ''} />
          </div>

          ${
            detail.form.refType === 'RETURN_BATCH' && selectedBatch
              ? `
                <div class="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
                  已带出：回货环节 ${escapeHtml(selectedBatch.processLabel ?? RETURN_INBOUND_PROCESS_LABEL[selectedBatch.processType])}
                  · 检查策略 ${escapeHtml(RETURN_INBOUND_QC_POLICY_LABEL[selectedBatch.qcPolicy])}
                  · 回货工厂 ${escapeHtml(selectedBatch.returnFactoryName ?? '-')}
                  · 接收方 ${escapeHtml(selectedBatch.receiverName ?? selectedBatch.warehouseName ?? '-')}
                </div>
              `
              : ''
          }

          <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div class="space-y-1.5">
              <label class="text-sm">检查人</label>
              <input class="h-9 w-full rounded-md border bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-70" data-qcd-field="inspector" value="${toInputValue(detail.form.inspector)}" ${readOnly ? 'disabled' : ''} />
            </div>
            <div class="space-y-1.5">
              <label class="text-sm">检查时间</label>
              <input class="h-9 w-full rounded-md border bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-70" data-qcd-field="inspectedAt" value="${toInputValue(detail.form.inspectedAt)}" placeholder="YYYY-MM-DD HH:mm:ss" ${readOnly ? 'disabled' : ''} />
            </div>
          </div>
        </div>
      </section>

      <section class="rounded-md border bg-card">
        <header class="border-b px-4 py-3">
          <h2 class="text-sm font-semibold">来源信息</h2>
        </header>
        <div class="grid grid-cols-1 gap-4 px-4 py-4 text-sm md:grid-cols-2">
          <div>
            <p class="text-xs text-muted-foreground">回货批次号</p>
            <p class="font-mono">${escapeHtml(inboundView?.batchId || selectedBatch?.batchId || '-')}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">生产单号</p>
            <p class="font-mono">${escapeHtml(inboundView?.productionOrderId || detail.form.productionOrderId || '-')}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">回货环节</p>
            <p>${escapeHtml(inboundView?.processLabel || (selectedBatch ? selectedBatch.processLabel ?? RETURN_INBOUND_PROCESS_LABEL[selectedBatch.processType] : '-'))}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">来源任务ID</p>
            <p class="font-mono">${escapeHtml(inboundView?.sourceTaskId || selectedBatch?.sourceTaskId || detail.form.refId || '-')}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">回货工厂</p>
            <p>${escapeHtml(inboundView?.returnFactoryName || selectedBatch?.returnFactoryName || sourceTaskForView?.assignedFactoryName || '-')}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">接收方</p>
            <p>${escapeHtml(inboundView?.receiverName || selectedBatch?.receiverName || inboundView?.warehouseName || selectedBatch?.warehouseName || '-')}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">接收时间</p>
            <p>${escapeHtml(formatDateTime(inboundView?.inboundAt || selectedBatch?.inboundAt || '-'))}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">检查策略</p>
            <p>${
              inboundView
                ? RETURN_INBOUND_QC_POLICY_LABEL[inboundView.qcPolicy]
                : selectedBatch
                  ? RETURN_INBOUND_QC_POLICY_LABEL[selectedBatch.qcPolicy]
                  : '-'
            }</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">检查方式</p>
            <p>${escapeHtml(inboundView?.inspectionMethodLabel || (selectedBatch?.qcPolicy === 'OPTIONAL' ? '抽检' : '全检'))}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">车缝后道模式</p>
            <p>${
              inboundView?.sewPostProcessMode
                ? SEW_POST_PROCESS_MODE_LABEL[inboundView.sewPostProcessMode]
                : selectedBatch?.sewPostProcessMode
                  ? SEW_POST_PROCESS_MODE_LABEL[selectedBatch.sewPostProcessMode]
                  : '-'
            }</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">来源业务</p>
            <p>${escapeHtml(inboundView?.sourceBusinessType || selectedBatch?.sourceType || '-')} / ${escapeHtml(inboundView?.sourceBusinessId || selectedBatch?.sourceId || '-')}</p>
          </div>
        </div>
      </section>

      <section class="rounded-md border bg-card">
        <header class="border-b px-4 py-3">
          <h2 class="text-sm font-semibold">质检结果</h2>
        </header>
        <div class="space-y-4 px-4 py-4">
          <div class="space-y-1.5">
            <label class="text-sm">结果</label>
            <div class="flex gap-3">
              ${(['PASS', 'FAIL'] as QcResult[])
                .map(
                  (result) => `
                    <button
                      class="${toClassName(
                        'rounded-md border px-5 py-2 text-sm font-medium transition-colors',
                        detail.form.result === result
                          ? result === 'PASS'
                            ? 'border-green-600 bg-green-600 text-white'
                            : 'border-red-600 bg-red-600 text-white'
                          : 'bg-background text-muted-foreground hover:border-foreground',
                        readOnly && 'cursor-not-allowed opacity-70',
                      )}"
                      data-qcd-action="set-result"
                      data-qcd-result="${result}"
                      ${readOnly ? 'disabled' : ''}
                    >
                      ${RESULT_LABEL[result]}
                    </button>
                  `,
                )
                .join('')}
            </div>
          </div>

          ${
            isFail
              ? `
                <div class="space-y-4 rounded-md border border-red-200 bg-red-50/40 p-4">
                  <div class="space-y-2">
                    <div class="flex items-center justify-between">
                      <label class="text-sm">缺陷明细 <span class="text-red-600">*</span></label>
                      ${
                        !readOnly
                          ? `
                            <button class="inline-flex h-7 items-center rounded-md border px-2 text-xs hover:bg-muted" data-qcd-action="add-defect">
                              <i data-lucide="plus" class="mr-1 h-3 w-3"></i>添加缺陷
                            </button>
                          `
                          : ''
                      }
                    </div>
                    ${
                      detail.form.defectItems.length === 0
                        ? '<p class="text-xs text-muted-foreground">暂无缺陷条目，请点击“添加缺陷”</p>'
                        : ''
                    }
                    <div class="space-y-2">
                      ${detail.form.defectItems
                        .map(
                          (defect, index) => `
                            <div class="flex items-center gap-2">
                              <input
                                class="h-8 flex-1 rounded-md border bg-background px-2 text-sm disabled:cursor-not-allowed disabled:opacity-70"
                                data-qcd-defect-index="${index}"
                                data-qcd-defect-field="name"
                                value="${toInputValue(defect.defectName)}"
                                placeholder="缺陷名称"
                                ${readOnly ? 'disabled' : ''}
                              />
                              <input
                                class="h-8 w-24 rounded-md border bg-background px-2 text-sm disabled:cursor-not-allowed disabled:opacity-70"
                                type="number"
                                min="1"
                                data-qcd-defect-index="${index}"
                                data-qcd-defect-field="qty"
                                value="${toInputValue(defect.qty || '')}"
                                placeholder="数量"
                                ${readOnly ? 'disabled' : ''}
                              />
                              ${
                                !readOnly
                                  ? `<button class="inline-flex h-8 w-8 items-center justify-center rounded-md text-red-600 hover:bg-red-100" data-qcd-action="remove-defect" data-qcd-index="${index}">
                                      <i data-lucide="trash-2" class="h-3.5 w-3.5"></i>
                                    </button>`
                                  : ''
                              }
                            </div>
                          `,
                        )
                        .join('')}
                    </div>
                  </div>

                  <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div class="space-y-1.5">
                      <label class="text-sm">不合格品处置方式 <span class="text-red-600">*</span></label>
                      <select class="h-9 w-full rounded-md border bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-70" data-qcd-field="disposition" ${readOnly ? 'disabled' : ''}>
                        ${renderDispositionOptions(detail.form.disposition)}
                      </select>
                    </div>

                    ${
                      needsQty
                        ? `
                          <div class="space-y-1.5">
                            <label class="text-sm">
                              受影响数量 <span class="text-red-600">*</span>
                              ${
                                maxQty !== undefined
                                  ? `<span class="ml-1 text-xs font-normal text-muted-foreground">（任务量 ${maxQty}）</span>`
                                  : ''
                              }
                            </label>
                            <input class="h-9 w-full rounded-md border bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-70" type="number" min="1" ${maxQty !== undefined ? `max="${maxQty}"` : ''} data-qcd-field="affectedQty" value="${toInputValue(detail.form.affectedQty)}" ${readOnly ? 'disabled' : ''} />
                          </div>
                        `
                        : ''
                    }
                  </div>

                  <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div class="space-y-1.5">
                      <label class="text-sm">根因类型</label>
                      <select class="h-9 w-full rounded-md border bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-70" data-qcd-field="rootCauseType" ${readOnly ? 'disabled' : ''}>
                        ${renderRootCauseOptions(detail.form.rootCauseType)}
                      </select>
                    </div>
                    <div class="space-y-1.5">
                      <label class="text-sm">责任状态</label>
                      <select class="h-9 w-full rounded-md border bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-70" data-qcd-field="liabilityStatus" ${readOnly ? 'disabled' : ''}>
                        ${renderLiabilityStatusOptions(detail.form.liabilityStatus)}
                      </select>
                    </div>
                  </div>

                  <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div class="space-y-1.5">
                      <label class="text-sm">责任方类型</label>
                      <select class="h-9 w-full rounded-md border bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-70" data-qcd-field="responsiblePartyType" ${readOnly ? 'disabled' : ''}>
                        ${renderPartyTypeOptions(detail.form.responsiblePartyType)}
                      </select>
                    </div>
                    <div class="space-y-1.5">
                      <label class="text-sm">责任方 ID</label>
                      <input class="h-9 w-full rounded-md border bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-70" data-qcd-field="responsiblePartyId" value="${toInputValue(detail.form.responsiblePartyId)}" placeholder="留空由系统推导" ${readOnly ? 'disabled' : ''} />
                    </div>
                  </div>

                  <div class="space-y-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-3">
                    <div class="flex items-center justify-between">
                      <p class="text-sm font-medium text-blue-900">责任判定与扣款决定</p>
                      ${
                        finalLiabilityRequired
                          ? '<span class="inline-flex rounded-md border border-blue-300 bg-white px-2 py-0.5 text-xs text-blue-700">车缝回货入仓最终判定（提交必填）</span>'
                          : '<span class="inline-flex rounded-md border border-blue-200 bg-white px-2 py-0.5 text-xs text-blue-600">当前环节可选填写</span>'
                      }
                    </div>

                    <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div class="space-y-1.5">
                        <label class="text-sm">责任方名称（可选）</label>
                        <input
                          class="h-9 w-full rounded-md border bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-70"
                          data-qcd-field="responsiblePartyName"
                          value="${toInputValue(detail.form.responsiblePartyName)}"
                          placeholder="如：PT Prima Sewing Hub"
                          ${readOnly ? 'disabled' : ''}
                        />
                      </div>
                      <div class="space-y-1.5">
                        <label class="text-sm">是否扣款${finalLiabilityRequired ? ' <span class="text-red-600">*</span>' : ''}</label>
                        <select
                          class="h-9 w-full rounded-md border bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-70"
                          data-qcd-field="deductionDecision"
                          ${readOnly ? 'disabled' : ''}
                        >
                          <option value="" ${detail.form.deductionDecision === '' ? 'selected' : ''}>请选择</option>
                          <option value="DEDUCT" ${detail.form.deductionDecision === 'DEDUCT' ? 'selected' : ''}>${DEDUCTION_DECISION_LABEL.DEDUCT}</option>
                          <option value="NO_DEDUCT" ${detail.form.deductionDecision === 'NO_DEDUCT' ? 'selected' : ''}>${DEDUCTION_DECISION_LABEL.NO_DEDUCT}</option>
                        </select>
                      </div>
                    </div>

                    <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div class="space-y-1.5">
                        <label class="text-sm">扣款金额（元）${detail.form.deductionDecision === 'DEDUCT' && finalLiabilityRequired ? ' <span class="text-red-600">*</span>' : ''}</label>
                        <input
                          class="h-9 w-full rounded-md border bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-70"
                          type="number"
                          min="0"
                          step="0.01"
                          data-qcd-field="deductionAmount"
                          value="${toInputValue(detail.form.deductionAmount)}"
                          placeholder="${detail.form.deductionDecision === 'DEDUCT' ? '请输入扣款金额' : '选择扣款后填写'}"
                          ${readOnly ? 'disabled' : ''}
                        />
                      </div>
                      <div class="space-y-1.5">
                        <label class="text-sm">不合格品处置补充说明</label>
                        <input
                          class="h-9 w-full rounded-md border bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-70"
                          data-qcd-field="dispositionRemark"
                          value="${toInputValue(detail.form.dispositionRemark)}"
                          placeholder="可补充说明不合格品处置方式"
                          ${readOnly ? 'disabled' : ''}
                        />
                      </div>
                    </div>

                    <div class="space-y-1.5">
                      <label class="text-sm">扣款决定说明${detail.form.deductionDecision === 'NO_DEDUCT' && finalLiabilityRequired ? ' <span class="text-red-600">*</span>' : ''}</label>
                      <textarea
                        class="min-h-16 w-full rounded-md border bg-background px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-70"
                        data-qcd-field="deductionDecisionRemark"
                        placeholder="${detail.form.deductionDecision === 'NO_DEDUCT' ? '请选择不扣款时必须填写说明' : '可填写扣款决定说明'}"
                        ${readOnly ? 'disabled' : ''}
                      >${escapeHtml(detail.form.deductionDecisionRemark)}</textarea>
                    </div>
                  </div>
                </div>
              `
              : ''
          }
        </div>
      </section>

      ${
        existingQc && existingQc.result === 'FAIL' && existingQc.status === 'SUBMITTED'
          ? renderBreakdownCard(detail, existingQc)
          : ''
      }

      <section class="rounded-md border bg-card">
        <header class="border-b px-4 py-3">
          <h2 class="text-sm font-semibold">备注</h2>
        </header>
        <div class="px-4 py-4">
          <textarea
            class="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-70"
            data-qcd-field="remark"
            placeholder="可选备注..."
            ${readOnly ? 'disabled' : ''}
          >${escapeHtml(detail.form.remark)}</textarea>
        </div>
      </section>

      ${
        !readOnly
          ? `
            <div class="flex gap-3">
              <button class="inline-flex h-9 items-center rounded-md border px-4 text-sm hover:bg-muted" data-qcd-action="save-draft">保存草稿</button>
              <button class="inline-flex h-9 items-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700" data-qcd-action="submit">提交质检</button>
            </div>
          `
          : `
            <div class="rounded-md bg-muted px-4 py-2.5 text-sm text-muted-foreground">${existingQc?.status === 'CLOSED' ? '已结案，表单只读。' : '已提交，表单只读。'}</div>
          `
      }

      ${
        existingQc && (existingQc.status === 'SUBMITTED' || existingQc.status === 'CLOSED')
          ? `
            <section class="space-y-4 pt-2">
              <div class="border-t pt-4">
                <h2 class="text-sm font-semibold">提交串联产物</h2>
              </div>

              ${
                existingQc.result === 'FAIL'
                  ? `
                    <article class="rounded-md border bg-card">
                      <header class="border-b px-4 py-3">
                        <h3 class="text-sm font-medium">责任判定与扣款决定（结构化）</h3>
                      </header>
                      <div class="grid grid-cols-1 gap-3 px-4 py-4 text-sm md:grid-cols-2">
                        <div>
                          <p class="text-xs text-muted-foreground">判定阶段</p>
                          <p>${existingQc.liabilityDecisionStage === 'SEW_RETURN_INBOUND_FINAL' ? '车缝回货入仓最终判定' : '一般判定'}</p>
                        </div>
                        <div>
                          <p class="text-xs text-muted-foreground">是否强制判定</p>
                          <p>${existingQc.liabilityDecisionRequired ? '是' : '否'}</p>
                        </div>
                        <div>
                          <p class="text-xs text-muted-foreground">责任方</p>
                          <p>${
                            existingQc.responsiblePartyType
                              ? `${PARTY_TYPE_LABEL[existingQc.responsiblePartyType]} / ${escapeHtml(existingQc.responsiblePartyId ?? '-')}`
                              : '-'
                          }</p>
                        </div>
                        <div>
                          <p class="text-xs text-muted-foreground">责任方名称</p>
                          <p>${escapeHtml(existingQc.responsiblePartyName ?? '-')}</p>
                        </div>
                        <div>
                          <p class="text-xs text-muted-foreground">不合格品处置方式</p>
                          <p>${existingQc.disposition ? escapeHtml(DISPOSITION_LABEL[existingQc.disposition] ?? existingQc.disposition) : '-'}</p>
                        </div>
                        <div>
                          <p class="text-xs text-muted-foreground">扣款决定</p>
                          <p>${
                            existingQc.deductionDecision
                              ? escapeHtml(DEDUCTION_DECISION_LABEL[existingQc.deductionDecision] ?? existingQc.deductionDecision)
                              : '-'
                          }</p>
                        </div>
                        <div>
                          <p class="text-xs text-muted-foreground">扣款金额</p>
                          <p>${
                            existingQc.deductionDecision === 'DEDUCT'
                              ? `${existingQc.deductionAmount ?? '-'} ${existingQc.deductionCurrency ?? 'CNY'}`
                              : '-'
                          }</p>
                        </div>
                        <div>
                          <p class="text-xs text-muted-foreground">判定时间</p>
                          <p>${existingQc.liabilityDecidedAt ? escapeHtml(formatDateTime(existingQc.liabilityDecidedAt)) : '-'}</p>
                        </div>
                        <div class="md:col-span-2">
                          <p class="text-xs text-muted-foreground">判定说明</p>
                          <p>${escapeHtml(existingQc.deductionDecisionRemark ?? existingQc.dispositionRemark ?? '-')}</p>
                        </div>
                      </div>
                    </article>
                  `
                  : ''
              }

              <article class="rounded-md border bg-card">
                <header class="border-b px-4 py-3">
                  <h3 class="text-sm font-medium">写回与下游结果</h3>
                </header>
                <div class="grid grid-cols-1 gap-3 px-4 py-4 text-sm md:grid-cols-2">
                  <div>
                    <p class="text-xs text-muted-foreground">可用量写回</p>
                    <p>${existingQc.writebackAvailableQty ?? '-'}</p>
                  </div>
                  <div>
                    <p class="text-xs text-muted-foreground">瑕疵接收量写回</p>
                    <p>${existingQc.writebackAcceptedAsDefectQty ?? '-'}</p>
                  </div>
                  <div>
                    <p class="text-xs text-muted-foreground">报废量写回</p>
                    <p>${existingQc.writebackScrapQty ?? '-'}</p>
                  </div>
                  <div>
                    <p class="text-xs text-muted-foreground">写回完成时间</p>
                    <p>${existingQc.writebackCompletedAt ? escapeHtml(formatDateTime(existingQc.writebackCompletedAt)) : '-'}</p>
                  </div>
                  <div>
                    <p class="text-xs text-muted-foreground">写回执行人</p>
                    <p>${escapeHtml(existingQc.writebackCompletedBy ?? '-')}</p>
                  </div>
                  <div>
                    <p class="text-xs text-muted-foreground">下游是否解锁</p>
                    <p>${existingQc.downstreamUnblocked === undefined ? '-' : existingQc.downstreamUnblocked ? '已解锁' : '未解锁'}</p>
                  </div>
                  <div>
                    <p class="text-xs text-muted-foreground">关联扣款依据</p>
                    <p>${basisItems.length > 0 ? `${basisItems.length} 条` : '-'}</p>
                  </div>
                  <div>
                    <p class="text-xs text-muted-foreground">结算冻结原因</p>
                    <p>${escapeHtml(settlementImpact?.summary ?? existingQc.settlementFreezeReason ?? '-')}</p>
                  </div>
                  <div>
                    <p class="text-xs text-muted-foreground">结算影响状态</p>
                    <p>${escapeHtml(settlementImpact ? getSettlementImpactLabel(settlementImpact.status) : '未串联')}</p>
                  </div>
                  <div>
                    <p class="text-xs text-muted-foreground">争议/申诉</p>
                    <p>${escapeHtml(dispute?.summary ?? '-')}</p>
                  </div>
                  <div>
                    <p class="text-xs text-muted-foreground">证据材料</p>
                    <p>${evidenceCount > 0 ? `${evidenceCount} 份` : '-'}</p>
                  </div>
                </div>
              </article>

              <article class="rounded-md border bg-card">
                <header class="border-b px-4 py-3">
                  <h3 class="text-sm font-medium">扣款依据条目 <span class="ml-1 text-xs font-normal text-muted-foreground">${basisItems.length} 条</span></h3>
                </header>
                <div class="space-y-2 px-4 py-4">
                  ${
                    basisItems.length === 0
                      ? '<p class="text-sm text-muted-foreground">暂无关联扣款依据</p>'
                      : basisItems
                          .map(
                            (basis) => `
                              <div class="space-y-1.5 rounded-md border bg-background px-3 py-2.5 text-sm">
                                <div class="flex flex-wrap items-center gap-2">
                                  <span class="font-mono text-xs font-medium">${escapeHtml(basis.basisId)}</span>
                                  <span class="inline-flex rounded-md border px-2 py-0.5 text-xs">${basis.sourceType === 'QC_FAIL' ? '质检不合格' : basis.sourceType === 'QC_DEFECT_ACCEPT' ? '瑕疵品接收' : '交接差异'}</span>
                                  <span class="inline-flex rounded-md border px-2 py-0.5 text-xs ${
                                    basis.status === 'CONFIRMED'
                                      ? 'border-green-200 bg-green-100 text-green-800'
                                      : basis.status === 'DISPUTED'
                                        ? 'border-yellow-200 bg-yellow-100 text-yellow-800'
                                        : basis.status === 'VOID'
                                          ? 'bg-muted text-muted-foreground'
                                          : 'bg-muted text-muted-foreground'
                                  }">${basis.status === 'CONFIRMED' ? '已确认' : basis.status === 'DISPUTED' ? '争议中' : basis.status === 'VOID' ? '已作废' : '草稿'}</span>
                                </div>
                                ${
                                  basis.summary
                                    ? `<p class="text-xs text-muted-foreground">${escapeHtml(basis.summary)}</p>`
                                    : ''
                                }
                                <div class="text-xs text-muted-foreground">
                                  责任方：${basis.settlementPartyType ? PARTY_TYPE_LABEL[basis.settlementPartyType] : '-'} / ${escapeHtml(basis.settlementPartyId ?? '-')}
                                  · 数量：${basis.qty} ${basis.uom}
                                  ${
                                    basis.deductionQty !== undefined
                                      ? ` · 可扣款数量：${basis.deductionQty}`
                                      : ''
                                  }
                                  ${basis.evidenceRefs.length > 0 ? ` · 证据 ${basis.evidenceRefs.length} 份` : ''}
                                </div>
                                <button class="inline-flex items-center gap-1 text-xs text-primary underline" data-nav="${escapeHtml(buildDeductionEntryHrefByBasisId(basis.basisId))}">
                                  查看扣款依据
                                  <i data-lucide="external-link" class="h-3 w-3"></i>
                                </button>
                              </div>
                            `,
                          )
                          .join('')
                  }
                </div>
              </article>

              ${
                existingQc.auditLogs.length > 0
                  ? `
                    <article class="rounded-md border bg-card">
                      <header class="border-b px-4 py-3">
                        <h3 class="text-sm font-medium">操作日志</h3>
                      </header>
                      <ol class="space-y-2 px-4 py-4">
                        ${existingQc.auditLogs
                          .map(
                            (log) => `
                              <li class="flex gap-3 text-xs text-muted-foreground">
                                <span class="shrink-0 tabular-nums">${escapeHtml(log.at)}</span>
                                <span class="shrink-0 font-medium text-foreground">${escapeHtml(log.by)}</span>
                                <span>${escapeHtml(log.detail)}</span>
                              </li>
                            `,
                          )
                          .join('')}
                      </ol>
                    </article>
                  `
                  : ''
              }
            </section>
          `
          : ''
      }
    </div>
  `
}

export function renderQcRecordDetailPage(qcId: string): string {
  return renderQcRecordDetailPageByVariant(qcId, 'web')
}

export function renderQcRecordMobileDetailPage(qcId: string): string {
  return renderPdaFrame(renderQcRecordDetailPageByVariant(qcId, 'mobile'), 'settlement')
}
