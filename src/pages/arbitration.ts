import { applyQualitySeedBootstrap } from '../data/fcs/store-domain-quality-bootstrap'
import {
  initialDeductionBasisItems,
  initialQualityInspections,
} from '../data/fcs/store-domain-quality-seeds'
import type {
  DeductionBasisItem,
  QualityInspection,
  SettlementPartyType,
} from '../data/fcs/store-domain-quality-types'
import { escapeHtml } from '../utils'

applyQualitySeedBootstrap()

type ArbitrationResult = 'UPHOLD' | 'REASSIGN' | 'VOID_DEDUCTION'
type SourceFilter = 'ALL' | 'DYE_PRINT' | 'OTHER'
type SettlementFilter = 'ALL' | 'READY' | 'FROZEN'
type ResultFilter = 'ALL' | 'UNHANDLED' | ArbitrationResult

interface ArbitrationForm {
  result: ArbitrationResult | ''
  remark: string
  liablePartyType: SettlementPartyType | ''
  liablePartyId: string
  settlementPartyType: SettlementPartyType | ''
  settlementPartyId: string
}

interface ArbitrationState {
  keyword: string
  sourceFilter: SourceFilter
  settlementFilter: SettlementFilter
  resultFilter: ResultFilter
  dialogQcId: string | null
  form: ArbitrationForm
  submitting: boolean
}

interface ArbitrationRow {
  qc: QualityInspection
  basis: DeductionBasisItem | null
}

const RESULT_ZH: Record<ArbitrationResult, string> = {
  UPHOLD: '维持原判',
  REASSIGN: '改判责任方',
  VOID_DEDUCTION: '作废扣款依据',
}

const RESULT_BADGE: Record<ArbitrationResult, string> = {
  UPHOLD: 'bg-green-100 text-green-700 border-green-200',
  REASSIGN: 'bg-orange-100 text-orange-700 border-orange-200',
  VOID_DEDUCTION: 'bg-red-100 text-red-700 border-red-200',
}

const LIABILITY_ZH: Record<string, string> = {
  DRAFT: '草稿',
  CONFIRMED: '已确认',
  DISPUTED: '争议中',
  VOID: '已作废',
}

const LIABILITY_BADGE: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-600 border-gray-200',
  CONFIRMED: 'bg-green-100 text-green-700 border-green-200',
  DISPUTED: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  VOID: 'bg-red-100 text-red-600 border-red-200',
}

const BASIS_STATUS_ZH: Record<string, string> = {
  DRAFT: '草稿',
  CONFIRMED: '已确认',
  DISPUTED: '争议中',
  VOID: '已作废',
}

const PARTY_TYPE_ZH: Record<SettlementPartyType, string> = {
  FACTORY: '工厂',
  SUPPLIER: '供应商',
  PROCESSOR: '加工方',
  GROUP_INTERNAL: '集团内部',
  OTHER: '其他',
}

const PARTY_TYPES: SettlementPartyType[] = [
  'FACTORY',
  'SUPPLIER',
  'PROCESSOR',
  'GROUP_INTERNAL',
  'OTHER',
]

const EMPTY_FORM: ArbitrationForm = {
  result: '',
  remark: '',
  liablePartyType: '',
  liablePartyId: '',
  settlementPartyType: '',
  settlementPartyId: '',
}

const state: ArbitrationState = {
  keyword: '',
  sourceFilter: 'ALL',
  settlementFilter: 'ALL',
  resultFilter: 'ALL',
  dialogQcId: null,
  form: { ...EMPTY_FORM },
  submitting: false,
}

function nowTimestamp(date: Date = new Date()): string {
  return date.toISOString().replace('T', ' ').slice(0, 19)
}

function randomSuffix(length = 4): string {
  return Math.random().toString(36).slice(2, 2 + length).toUpperCase()
}

function showArbitrationToast(message: string, tone: 'success' | 'error' = 'success'): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return

  const rootId = 'arbitration-toast-root'
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

function getRows(): ArbitrationRow[] {
  return initialQualityInspections
    .filter((qc) => qc.liabilityStatus === 'DISPUTED')
    .map((qc) => {
      const basis =
        initialDeductionBasisItems.find(
          (item) => item.sourceRefId === qc.qcId || item.sourceId === qc.qcId,
        ) ?? null
      return { qc, basis }
    })
}

function getStats(rows: ArbitrationRow[]): {
  total: number
  dyePrint: number
  frozen: number
  done: number
} {
  const dyePrint = rows.filter(
    (row) =>
      row.basis?.sourceProcessType === 'DYE_PRINT' || row.qc.rootCauseType === 'DYE_PRINT',
  ).length
  const frozen = rows.filter(
    (row) =>
      Boolean(row.basis) &&
      !row.basis?.settlementReady &&
      row.basis?.status !== 'VOID',
  ).length
  const done = initialQualityInspections.filter((qc) => qc.arbitrationResult != null).length
  return { total: rows.length, dyePrint, frozen, done }
}

function getFilteredRows(rows: ArbitrationRow[]): ArbitrationRow[] {
  const keyword = state.keyword.trim().toLowerCase()

  return rows.filter(({ qc, basis }) => {
    if (keyword) {
      const haystack = [
        qc.qcId,
        qc.productionOrderId,
        basis?.basisId ?? '',
        qc.liablePartyId ?? '',
        qc.responsiblePartyId ?? '',
      ]
        .join(' ')
        .toLowerCase()
      if (!haystack.includes(keyword)) return false
    }

    if (state.sourceFilter === 'DYE_PRINT') {
      if (qc.rootCauseType !== 'DYE_PRINT' && basis?.sourceProcessType !== 'DYE_PRINT') {
        return false
      }
    } else if (state.sourceFilter === 'OTHER') {
      if (qc.rootCauseType === 'DYE_PRINT' || basis?.sourceProcessType === 'DYE_PRINT') {
        return false
      }
    }

    if (state.settlementFilter === 'READY') {
      if (!basis?.settlementReady) return false
    } else if (state.settlementFilter === 'FROZEN') {
      if (!basis || basis.settlementReady || basis.status === 'VOID') return false
    }

    if (state.resultFilter === 'UNHANDLED') {
      if (qc.arbitrationResult != null) return false
    } else if (state.resultFilter !== 'ALL') {
      if (qc.arbitrationResult !== state.resultFilter) return false
    }

    return true
  })
}

function openDialog(qcId: string): void {
  state.dialogQcId = qcId
  state.form = { ...EMPTY_FORM }
}

function closeDialog(): void {
  state.dialogQcId = null
  state.form = { ...EMPTY_FORM }
}

function getDialogQc(): QualityInspection | null {
  if (!state.dialogQcId) return null
  return initialQualityInspections.find((qc) => qc.qcId === state.dialogQcId) ?? null
}

function getRelatedBasis(qcId: string): DeductionBasisItem[] {
  return initialDeductionBasisItems.filter(
    (item) => item.sourceRefId === qcId || item.sourceId === qcId,
  )
}

function arbitrateDispute(input: {
  qcId: string
  result: ArbitrationResult
  remark: string
  liablePartyType?: SettlementPartyType
  liablePartyId?: string
  settlementPartyType?: SettlementPartyType
  settlementPartyId?: string
}, by: string): { ok: boolean; message?: string } {
  const qc = initialQualityInspections.find((item) => item.qcId === input.qcId)
  if (!qc) return { ok: false, message: `质检单 ${input.qcId} 不存在` }
  if (qc.liabilityStatus !== 'DISPUTED') return { ok: false, message: '仅争议中的质检单可执行仲裁' }
  if (!input.remark.trim()) return { ok: false, message: '仲裁说明不能为空' }

  if (input.result === 'REASSIGN') {
    if (!input.liablePartyType || !input.liablePartyId?.trim()) {
      return { ok: false, message: '改判责任方时，责任方不能为空' }
    }
    if (!input.settlementPartyType || !input.settlementPartyId?.trim()) {
      return { ok: false, message: '改判责任方时，扣款对象不能为空' }
    }
  }

  const ts = nowTimestamp()
  const relatedBasis = getRelatedBasis(input.qcId)

  qc.liabilityStatus = 'CONFIRMED'
  qc.arbitrationResult = input.result
  qc.arbitrationRemark = input.remark
  qc.arbitratedAt = ts
  qc.arbitratedBy = by
  qc.updatedAt = ts
  qc.auditLogs = [
    ...qc.auditLogs,
    {
      id: `AL-QC-ARB-${Date.now()}-${randomSuffix(4)}`,
      action: 'ARBITRATE_DISPUTE',
      detail: `仲裁结果：${input.result}，说明：${input.remark}`,
      at: ts,
      by,
    },
  ]

  if (input.result === 'REASSIGN') {
    qc.liablePartyType = input.liablePartyType
    qc.liablePartyId = input.liablePartyId
    qc.settlementPartyType = input.settlementPartyType
    qc.settlementPartyId = input.settlementPartyId
  }

  const settlement = {
    ready: qc.status === 'CLOSED',
    reason: qc.status === 'CLOSED' ? '' : '质检未结案',
    editable: qc.status === 'CLOSED',
  }

  for (const basis of relatedBasis) {
    if (input.result === 'VOID_DEDUCTION') {
      basis.status = 'VOID'
      basis.arbitrationResult = 'VOID_DEDUCTION'
      basis.arbitrationRemark = input.remark
      basis.arbitratedAt = ts
      basis.arbitratedBy = by
      basis.settlementReady = false
      basis.settlementFreezeReason = '已作废'
      basis.deductionAmountEditable = false
      basis.updatedAt = ts
      basis.updatedBy = by
      basis.auditLogs = [
        ...basis.auditLogs,
        {
          id: `AL-DBI-ARB-${Date.now()}-${randomSuffix(4)}`,
          action: 'ARBITRATE_DISPUTE_FROM_QC',
          detail: `仲裁作废，来源 ${input.qcId}`,
          at: ts,
          by,
        },
      ]
      continue
    }

    if (basis.status === 'DISPUTED') {
      basis.status = 'CONFIRMED'
    }
    basis.liabilityStatusSnapshot = 'CONFIRMED'
    basis.arbitrationResult = input.result
    basis.arbitrationRemark = input.remark
    basis.arbitratedAt = ts
    basis.arbitratedBy = by
    basis.settlementReady = settlement.ready
    basis.settlementFreezeReason = settlement.reason
    basis.deductionAmountEditable = settlement.editable
    basis.updatedAt = ts
    basis.updatedBy = by

    if (input.result === 'REASSIGN') {
      basis.liablePartyType = input.liablePartyType
      basis.liablePartyId = input.liablePartyId
      basis.settlementPartyType = input.settlementPartyType
      basis.settlementPartyId = input.settlementPartyId
    }

    basis.auditLogs = [
      ...basis.auditLogs,
      {
        id: `AL-DBI-ARB-${Date.now()}-${randomSuffix(4)}`,
        action: 'ARBITRATE_DISPUTE_FROM_QC',
        detail: `仲裁结果：${input.result}，来源 ${input.qcId}`,
        at: ts,
        by,
      },
    ]
  }

  return { ok: true }
}

function validateAndSubmitArbitration(): { ok: boolean; message?: string } {
  if (!state.dialogQcId) return { ok: false, message: '未选择仲裁对象' }
  if (!state.form.result) return { ok: false, message: '请选择仲裁结果' }
  if (!state.form.remark.trim()) return { ok: false, message: '仲裁说明不能为空' }

  if (state.form.result === 'REASSIGN') {
    if (!state.form.liablePartyType || !state.form.liablePartyId.trim()) {
      return { ok: false, message: '改判责任方时，责任方不能为空' }
    }
    if (!state.form.settlementPartyType || !state.form.settlementPartyId.trim()) {
      return { ok: false, message: '改判责任方时，扣款对象不能为空' }
    }
  }

  state.submitting = true
  const result = arbitrateDispute(
    {
      qcId: state.dialogQcId,
      result: state.form.result,
      remark: state.form.remark.trim(),
      liablePartyType: state.form.liablePartyType || undefined,
      liablePartyId: state.form.liablePartyId.trim() || undefined,
      settlementPartyType: state.form.settlementPartyType || undefined,
      settlementPartyId: state.form.settlementPartyId.trim() || undefined,
    },
    '管理员',
  )
  state.submitting = false
  return result
}

function renderDialog(): string {
  if (!state.dialogQcId) return ''

  const qc = getDialogQc()
  if (!qc) return ''

  return `
    <div class="fixed inset-0 z-50" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-arb-action="close-dialog" aria-label="关闭"></button>
      <section class="absolute left-1/2 top-1/2 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background p-6 shadow-2xl" data-dialog-panel="true">
        <button class="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100" data-arb-action="close-dialog" aria-label="关闭">
          <i data-lucide="x" class="h-4 w-4"></i>
        </button>

        <header class="space-y-1">
          <h3 class="text-lg font-semibold">仲裁处理</h3>
          <p class="text-xs text-muted-foreground">QC：<span class="font-mono">${escapeHtml(qc.qcId)}</span> · 生产单：<span class="font-mono">${escapeHtml(qc.productionOrderId)}</span></p>
        </header>

        <div class="mt-4 space-y-4">
          <div class="space-y-1.5">
            <label class="text-sm font-medium">仲裁结果 <span class="text-red-600">*</span></label>
            <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-arb-field="result">
              <option value="" ${state.form.result === '' ? 'selected' : ''}>请选择仲裁结果</option>
              <option value="UPHOLD" ${state.form.result === 'UPHOLD' ? 'selected' : ''}>维持原判</option>
              <option value="REASSIGN" ${state.form.result === 'REASSIGN' ? 'selected' : ''}>改判责任方</option>
              <option value="VOID_DEDUCTION" ${state.form.result === 'VOID_DEDUCTION' ? 'selected' : ''}>作废扣款依据</option>
            </select>
          </div>

          ${
            state.form.result === 'REASSIGN'
              ? `
                <div class="grid grid-cols-2 gap-3">
                  <div class="space-y-1.5">
                    <label class="text-sm font-medium">责任方类型 <span class="text-red-600">*</span></label>
                    <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-arb-field="liablePartyType">
                      <option value="" ${state.form.liablePartyType === '' ? 'selected' : ''}>选择类型</option>
                      ${PARTY_TYPES
                        .map(
                          (type) =>
                            `<option value="${type}" ${state.form.liablePartyType === type ? 'selected' : ''}>${PARTY_TYPE_ZH[type]}</option>`,
                        )
                        .join('')}
                    </select>
                  </div>
                  <div class="space-y-1.5">
                    <label class="text-sm font-medium">责任方 ID <span class="text-red-600">*</span></label>
                    <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-arb-field="liablePartyId" placeholder="责任方 ID" value="${escapeHtml(state.form.liablePartyId)}" />
                  </div>
                </div>

                <div class="grid grid-cols-2 gap-3">
                  <div class="space-y-1.5">
                    <label class="text-sm font-medium">扣款对象类型 <span class="text-red-600">*</span></label>
                    <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-arb-field="settlementPartyType">
                      <option value="" ${state.form.settlementPartyType === '' ? 'selected' : ''}>选择类型</option>
                      ${PARTY_TYPES
                        .map(
                          (type) =>
                            `<option value="${type}" ${state.form.settlementPartyType === type ? 'selected' : ''}>${PARTY_TYPE_ZH[type]}</option>`,
                        )
                        .join('')}
                    </select>
                  </div>
                  <div class="space-y-1.5">
                    <label class="text-sm font-medium">扣款对象 ID <span class="text-red-600">*</span></label>
                    <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-arb-field="settlementPartyId" placeholder="扣款对象 ID" value="${escapeHtml(state.form.settlementPartyId)}" />
                  </div>
                </div>
              `
              : ''
          }

          <div class="space-y-1.5">
            <label class="text-sm font-medium">仲裁说明 <span class="text-red-600">*</span></label>
            <textarea
              rows="3"
              class="w-full rounded-md border bg-background px-3 py-2 text-sm"
              data-arb-field="remark"
              placeholder="请填写仲裁说明..."
            >${escapeHtml(state.form.remark)}</textarea>
          </div>
        </div>

        <footer class="mt-6 flex justify-end gap-2">
          <button class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-arb-action="close-dialog">取消</button>
          <button class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50" data-arb-action="submit-dialog" ${state.submitting ? 'disabled' : ''}>
            ${state.submitting ? '提交中...' : '提交仲裁'}
          </button>
        </footer>
      </section>
    </div>
  `
}

export function renderArbitrationPage(): string {
  const rows = getRows()
  const stats = getStats(rows)
  const filtered = getFilteredRows(rows)

  return `
    <div class="flex flex-col gap-6 p-6">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-semibold text-foreground">争议处理（兼容页）</h1>
          <p class="mt-1 text-sm text-muted-foreground">该入口已从主导航收起，后续围绕质检记录统一承接争议处理。当前共 ${rows.length} 条争议。</p>
        </div>
      </div>

      <section class="grid grid-cols-2 gap-4 md:grid-cols-4">
        <article class="rounded-lg border bg-card">
          <div class="p-4">
            <p class="text-sm text-muted-foreground">争议中数</p>
            <p class="mt-1 text-2xl font-bold text-foreground">${stats.total}</p>
          </div>
        </article>
        <article class="rounded-lg border bg-card">
          <div class="p-4">
            <p class="text-sm text-muted-foreground">染印来源争议数</p>
            <p class="mt-1 text-2xl font-bold text-foreground">${stats.dyePrint}</p>
          </div>
        </article>
        <article class="rounded-lg border bg-card">
          <div class="p-4">
            <p class="text-sm text-muted-foreground">冻结中数</p>
            <p class="mt-1 text-2xl font-bold text-foreground">${stats.frozen}</p>
          </div>
        </article>
        <article class="rounded-lg border bg-card">
          <div class="p-4">
            <p class="text-sm text-muted-foreground">已处理数</p>
            <p class="mt-1 text-2xl font-bold text-foreground">${stats.done}</p>
          </div>
        </article>
      </section>

      <section class="flex flex-wrap items-center gap-3">
        <div class="relative">
          <i data-lucide="search" class="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"></i>
          <input
            class="h-9 w-72 rounded-md border bg-background pl-8 pr-3 text-sm"
            data-arb-filter="keyword"
            placeholder="关键词（QC单号/生产单/扣款依据/责任方）"
            value="${escapeHtml(state.keyword)}"
          />
        </div>

        <select class="h-9 w-36 rounded-md border bg-background px-3 text-sm" data-arb-filter="source">
          <option value="ALL" ${state.sourceFilter === 'ALL' ? 'selected' : ''}>全部来源</option>
          <option value="DYE_PRINT" ${state.sourceFilter === 'DYE_PRINT' ? 'selected' : ''}>染印加工单</option>
          <option value="OTHER" ${state.sourceFilter === 'OTHER' ? 'selected' : ''}>其他</option>
        </select>

        <select class="h-9 w-36 rounded-md border bg-background px-3 text-sm" data-arb-filter="settlement">
          <option value="ALL" ${state.settlementFilter === 'ALL' ? 'selected' : ''}>全部结算状态</option>
          <option value="FROZEN" ${state.settlementFilter === 'FROZEN' ? 'selected' : ''}>冻结中</option>
          <option value="READY" ${state.settlementFilter === 'READY' ? 'selected' : ''}>可进入结算</option>
        </select>

        <select class="h-9 w-36 rounded-md border bg-background px-3 text-sm" data-arb-filter="result">
          <option value="ALL" ${state.resultFilter === 'ALL' ? 'selected' : ''}>全部结果</option>
          <option value="UNHANDLED" ${state.resultFilter === 'UNHANDLED' ? 'selected' : ''}>未处理</option>
          <option value="UPHOLD" ${state.resultFilter === 'UPHOLD' ? 'selected' : ''}>维持原判</option>
          <option value="REASSIGN" ${state.resultFilter === 'REASSIGN' ? 'selected' : ''}>改判责任方</option>
          <option value="VOID_DEDUCTION" ${state.resultFilter === 'VOID_DEDUCTION' ? 'selected' : ''}>作废扣款依据</option>
        </select>

        <button class="inline-flex h-8 items-center rounded-md px-3 text-sm hover:bg-muted" data-arb-action="reset-filters">
          <i data-lucide="rotate-ccw" class="mr-1 h-4 w-4"></i>
          重置
        </button>
      </section>

      ${
        filtered.length === 0
          ? `
            <section class="rounded-md border bg-card">
              <div class="py-16 text-center text-muted-foreground">暂无争议事项</div>
            </section>
          `
          : `
            <section class="rounded-md border bg-card">
              <div class="overflow-x-auto">
                <table class="w-full min-w-[1380px] text-sm">
                  <thead>
                    <tr class="border-b bg-muted/40 text-left">
                      <th class="px-4 py-2 font-medium">QC单号</th>
                      <th class="px-4 py-2 font-medium">生产单</th>
                      <th class="px-4 py-2 font-medium">来源流程</th>
                      <th class="px-4 py-2 font-medium">当前责任状态</th>
                      <th class="px-4 py-2 font-medium">当前判定</th>
                      <th class="px-4 py-2 font-medium">扣款依据状态</th>
                      <th class="px-4 py-2 font-medium">结算状态</th>
                      <th class="px-4 py-2 font-medium">冻结原因</th>
                      <th class="px-4 py-2 font-medium">最近仲裁结果</th>
                      <th class="px-4 py-2 font-medium">更新时间</th>
                      <th class="px-4 py-2 font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${filtered
                      .map(({ qc, basis }) => {
                        const sourceZh =
                          qc.rootCauseType === 'DYE_PRINT' || basis?.sourceProcessType === 'DYE_PRINT'
                            ? '染印加工单'
                            : '其他'
                        const settlementZh = basis
                          ? basis.status === 'VOID'
                            ? '已作废'
                            : basis.settlementReady
                              ? '可进入结算'
                              : '冻结中'
                          : '—'
                        const settlementBadge = basis
                          ? basis.status === 'VOID'
                            ? 'bg-red-100 text-red-600 border-red-200'
                            : basis.settlementReady
                              ? 'bg-green-100 text-green-700 border-green-200'
                              : 'bg-yellow-100 text-yellow-700 border-yellow-200'
                          : ''

                        return `
                          <tr class="border-b last:border-b-0">
                            <td class="px-4 py-3 font-mono text-xs">${escapeHtml(qc.qcId)}</td>
                            <td class="px-4 py-3 text-xs">${escapeHtml(qc.productionOrderId)}</td>
                            <td class="px-4 py-3 text-xs">${escapeHtml(sourceZh)}</td>
                            <td class="px-4 py-3">
                              <span class="inline-flex rounded-md border px-2 py-0.5 text-xs ${LIABILITY_BADGE[qc.liabilityStatus] ?? ''}">
                                ${escapeHtml(LIABILITY_ZH[qc.liabilityStatus] ?? qc.liabilityStatus)}
                              </span>
                            </td>
                            <td class="px-4 py-3 text-xs text-muted-foreground">
                              ${
                                qc.liabilityDecisionStage === 'SEW_RETURN_INBOUND_FINAL'
                                  ? `
                                    <div>责任：${escapeHtml(qc.responsiblePartyType ? PARTY_TYPE_ZH[qc.responsiblePartyType] ?? qc.responsiblePartyType : '-')} / ${escapeHtml(qc.responsiblePartyId ?? '-')}</div>
                                    <div>扣款：${
                                      qc.deductionDecision === 'DEDUCT'
                                        ? `扣款 ${qc.deductionAmount ?? '-'} ${qc.deductionCurrency ?? 'CNY'}`
                                        : qc.deductionDecision === 'NO_DEDUCT'
                                          ? '不扣款'
                                          : '-'
                                    }</div>
                                  `
                                  : '<span class="text-muted-foreground">-</span>'
                              }
                            </td>
                            <td class="px-4 py-3">
                              ${
                                basis
                                  ? `
                                    <span class="inline-flex rounded-md border px-2 py-0.5 text-xs ${LIABILITY_BADGE[basis.status] ?? ''}">
                                      ${escapeHtml(BASIS_STATUS_ZH[basis.status] ?? basis.status)}
                                    </span>
                                  `
                                  : '<span class="text-xs text-muted-foreground">—</span>'
                              }
                            </td>
                            <td class="px-4 py-3">
                              ${
                                basis
                                  ? `
                                    <span class="inline-flex rounded-md border px-2 py-0.5 text-xs ${settlementBadge}">
                                      ${escapeHtml(settlementZh)}
                                    </span>
                                  `
                                  : '<span class="text-xs text-muted-foreground">—</span>'
                              }
                            </td>
                            <td class="max-w-32 truncate px-4 py-3 text-xs text-muted-foreground" title="${escapeHtml(basis?.settlementFreezeReason ?? '')}">
                              ${escapeHtml(basis?.settlementFreezeReason || '—')}
                            </td>
                            <td class="px-4 py-3">
                              ${
                                qc.arbitrationResult
                                  ? `
                                    <span class="inline-flex rounded-md border px-2 py-0.5 text-xs ${RESULT_BADGE[qc.arbitrationResult as ArbitrationResult] ?? ''}">
                                      ${escapeHtml(RESULT_ZH[qc.arbitrationResult as ArbitrationResult] ?? qc.arbitrationResult)}
                                    </span>
                                  `
                                  : '<span class="text-xs text-muted-foreground">未处理</span>'
                              }
                            </td>
                            <td class="px-4 py-3 text-xs text-muted-foreground">${escapeHtml(qc.updatedAt)}</td>
                            <td class="px-4 py-3">
                              <div class="flex items-center gap-1.5">
                                <button class="inline-flex h-7 items-center rounded-md px-2 text-xs hover:bg-muted" data-nav="/fcs/quality/qc-records/${escapeHtml(qc.qcId)}">
                                  <i data-lucide="external-link" class="mr-1 h-3 w-3"></i>查看质检
                                </button>
                                ${
                                  basis
                                    ? `
                                      <button class="inline-flex h-7 items-center rounded-md px-2 text-xs hover:bg-muted" data-nav="/fcs/quality/deduction-calc/${escapeHtml(basis.basisId)}">
                                        <i data-lucide="external-link" class="mr-1 h-3 w-3"></i>查看扣款
                                      </button>
                                    `
                                    : '<span class="px-2 text-xs text-muted-foreground">—</span>'
                                }
                                <button class="inline-flex h-7 items-center rounded-md border px-2 text-xs hover:bg-muted" data-arb-action="open-dialog" data-qc-id="${escapeHtml(qc.qcId)}">
                                  <i data-lucide="gavel" class="mr-1 h-3 w-3"></i>仲裁处理
                                </button>
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

      ${renderDialog()}
    </div>
  `
}

export function handleArbitrationEvent(target: HTMLElement): boolean {
  const filterNode = target.closest<HTMLElement>('[data-arb-filter]')
  if (filterNode instanceof HTMLInputElement || filterNode instanceof HTMLSelectElement) {
    const field = filterNode.dataset.arbFilter
    if (field === 'keyword') {
      state.keyword = filterNode.value
      return true
    }
    if (field === 'source') {
      state.sourceFilter = filterNode.value as SourceFilter
      return true
    }
    if (field === 'settlement') {
      state.settlementFilter = filterNode.value as SettlementFilter
      return true
    }
    if (field === 'result') {
      state.resultFilter = filterNode.value as ResultFilter
      return true
    }
    return true
  }

  const fieldNode = target.closest<HTMLElement>('[data-arb-field]')
  if (
    fieldNode instanceof HTMLInputElement ||
    fieldNode instanceof HTMLSelectElement ||
    fieldNode instanceof HTMLTextAreaElement
  ) {
    const field = fieldNode.dataset.arbField
    if (!field) return true

    if (field === 'result') {
      const next = fieldNode.value as ArbitrationResult | ''
      state.form.result = next
      state.form.liablePartyType = ''
      state.form.liablePartyId = ''
      state.form.settlementPartyType = ''
      state.form.settlementPartyId = ''
      return true
    }
    if (field === 'remark') {
      state.form.remark = fieldNode.value
      return true
    }
    if (field === 'liablePartyType') {
      state.form.liablePartyType = fieldNode.value as SettlementPartyType | ''
      return true
    }
    if (field === 'liablePartyId') {
      state.form.liablePartyId = fieldNode.value
      return true
    }
    if (field === 'settlementPartyType') {
      state.form.settlementPartyType = fieldNode.value as SettlementPartyType | ''
      return true
    }
    if (field === 'settlementPartyId') {
      state.form.settlementPartyId = fieldNode.value
      return true
    }
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-arb-action]')
  if (!actionNode) return false

  const action = actionNode.dataset.arbAction
  if (!action) return false

  if (action === 'reset-filters') {
    state.keyword = ''
    state.sourceFilter = 'ALL'
    state.settlementFilter = 'ALL'
    state.resultFilter = 'ALL'
    return true
  }

  if (action === 'open-dialog') {
    const qcId = actionNode.dataset.qcId
    if (qcId) {
      openDialog(qcId)
    }
    return true
  }

  if (action === 'close-dialog') {
    closeDialog()
    return true
  }

  if (action === 'submit-dialog') {
    const result = validateAndSubmitArbitration()
    if (!result.ok) {
      showArbitrationToast(result.message ?? '仲裁失败', 'error')
      return true
    }
    showArbitrationToast('仲裁处理已完成')
    closeDialog()
    return true
  }

  return true
}

export function isArbitrationDialogOpen(): boolean {
  return state.dialogQcId !== null
}
