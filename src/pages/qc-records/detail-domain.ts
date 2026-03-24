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
  STATUS_LABEL,
  STATUS_CLASS,
  DISPOSITION_LABEL,
  DEDUCTION_DECISION_LABEL,
  ROOT_CAUSE_LABEL,
  LIABILITY_LABEL,
  PARTY_TYPE_LABEL,
  processTasks,
  ensureDetailState,
  getQcById,
  getReturnInboundBatchById,
  requiresFinalDecisionForForm,
  toInputValue,
  type QcDisposition,
  type QcResult,
  type RootCauseType,
  type LiabilityStatus,
  type SettlementPartyType,
  type QualityInspection,
  type QcStatus,
  type QcRecordDetailState,
} from './context'
import { isDetailReadOnly } from './actions'
import {
  getQcChainFactByRouteKey,
  getSettlementImpactLabel,
} from '../../data/fcs/quality-chain-adapter'

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
        <p class="text-xs text-muted-foreground">仓库质检现场</p>
        <p class="mt-1 text-sm font-semibold">${escapeHtml(processLabel)} · ${escapeHtml(batchId || '-')}</p>
        <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(returnFactoryName || '-')} / ${escapeHtml(warehouseName || '-')}</p>
      </article>
      <article class="rounded-md border bg-card px-4 py-3">
        <p class="text-xs text-muted-foreground">责任判定与扣款</p>
        <div class="mt-1 flex flex-wrap items-center gap-2">
          <span class="inline-flex rounded-md border px-2 py-0.5 text-xs ${
            qc.liabilityStatus === 'CONFIRMED'
              ? 'border-green-200 bg-green-50 text-green-700'
              : qc.liabilityStatus === 'DISPUTED'
                ? 'border-yellow-200 bg-yellow-50 text-yellow-700'
                : 'border-slate-200 bg-slate-50 text-slate-600'
          }">${escapeHtml(LIABILITY_LABEL[qc.liabilityStatus] ?? qc.liabilityStatus)}</span>
        </div>
        <p class="mt-1 text-sm font-semibold">${escapeHtml(decisionText)}</p>
        <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(disputeSummary ?? qc.deductionDecisionRemark ?? qc.dispositionRemark ?? '按仓库质检结果回写平台判责与扣款链路')}</p>
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

export function renderQcRecordDetailPage(qcId: string): string {
  const detail = ensureDetailState(qcId)
  const chainFact = qcId === 'new' ? null : getQcChainFactByRouteKey(qcId)
  const existingQc = chainFact?.qc ?? (detail.currentQcId ? getQcById(detail.currentQcId) : null)

  if (qcId !== 'new' && !existingQc) {
    return renderDetailNotFound(qcId)
  }

  const readOnly = existingQc?.status === 'SUBMITTED' || existingQc?.status === 'CLOSED'
  const isFail = detail.form.result === 'FAIL'
  const needsQty =
    detail.form.disposition !== '' && NEEDS_AFFECTED_QTY.includes(detail.form.disposition)
  const refTask = processTasks.find((item) => item.taskId === detail.form.refId)
  const selectedBatch = detail.form.refType === 'RETURN_BATCH' ? getReturnInboundBatchById(detail.form.refId) : null
  const inboundView = existingQc ? normalizeQcForView(existingQc, initialReturnInboundBatches, processTasks) : null
  const finalLiabilityRequired = requiresFinalDecisionForForm(detail.form, existingQc)
  const sourceTaskForView =
    (inboundView?.sourceTaskId ? processTasks.find((item) => item.taskId === inboundView.sourceTaskId) : null) ??
    refTask
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
      ? '来源类型：回货入仓批次'
      : detail.form.refType === 'TASK'
        ? '来源类型：生产任务'
        : '来源类型：交接事件'

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
                  · 质检策略 ${escapeHtml(RETURN_INBOUND_QC_POLICY_LABEL[selectedBatch.qcPolicy])}
                  · 回货工厂 ${escapeHtml(selectedBatch.returnFactoryName ?? '-')}
                  · 入仓仓库 ${escapeHtml(selectedBatch.warehouseName ?? '-')}
                </div>
              `
              : ''
          }

          <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div class="space-y-1.5">
              <label class="text-sm">质检员</label>
              <input class="h-9 w-full rounded-md border bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-70" data-qcd-field="inspector" value="${toInputValue(detail.form.inspector)}" ${readOnly ? 'disabled' : ''} />
            </div>
            <div class="space-y-1.5">
              <label class="text-sm">质检时间</label>
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
            <p class="text-xs text-muted-foreground">入仓仓库</p>
            <p>${escapeHtml(inboundView?.warehouseName || selectedBatch?.warehouseName || '-')}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">入仓时间</p>
            <p>${escapeHtml(formatDateTime(inboundView?.inboundAt || selectedBatch?.inboundAt || '-'))}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">质检策略</p>
            <p>${
              inboundView
                ? RETURN_INBOUND_QC_POLICY_LABEL[inboundView.qcPolicy]
                : selectedBatch
                  ? RETURN_INBOUND_QC_POLICY_LABEL[selectedBatch.qcPolicy]
                  : '-'
            }</p>
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
                      <label class="text-sm">处置方式 <span class="text-red-600">*</span></label>
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
                        <label class="text-sm">处置补充说明</label>
                        <input
                          class="h-9 w-full rounded-md border bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-70"
                          data-qcd-field="dispositionRemark"
                          value="${toInputValue(detail.form.dispositionRemark)}"
                          placeholder="可补充说明处理方式"
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
                          <p class="text-xs text-muted-foreground">处理方式</p>
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
                                <button class="inline-flex items-center gap-1 text-xs text-primary underline" data-nav="/fcs/quality/deduction-calc/${escapeHtml(basis.basisId)}">
                                  去扣款计算查看
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
