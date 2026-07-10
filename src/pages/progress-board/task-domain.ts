import {
  state,
  TASK_RISK_LABEL,
  TASK_STATUS_LABEL,
  PROCESS_STAGE_GROUP_LABEL,
  ASSIGNMENT_STATUS_LABEL,
  ASSIGNMENT_STATUS_COLOR_CLASS,
  BLOCK_REASON_LABEL,
  stageLabels,
  getTaskHandoverSummary,
  getTaskStageGroup,
  getOrderById,
  getFactoryById,
  getTaskRisks,
  getTaskDisplayName,
  getOrderSpuCode,
  getOrderSpuName,
  getTaskTenderId,
  getTenderById,
  getTaskById,
  getTaskKpiStats,
  TASK_LIST_PAGE_SIZE,
  getCurrentSearchParams,
  BLOCK_REASON_OPTIONS,
  renderBadge,
  escapeAttr,
  escapeHtml,
  type TaskSummaryTone,
  type TaskRiskFlag,
  type ProcessTask,
  type TaskTabKey,
} from './context.ts'
import { resolveTaskOutputValueSnapshot } from '../../data/fcs/process-tasks.ts'
import {
  buildTaskDeliveryCardPrintLink,
  buildTaskRouteCardPrintLink,
} from '../../data/fcs/fcs-route-links.ts'
import {
  PLATFORM_PROCESS_STATUS_CLASS,
  getPlatformStatusForRuntimeTask,
} from '../../data/fcs/process-platform-status-adapter.ts'
import { listPlatformProcessResultViews, type PlatformProcessResultView } from '../../data/fcs/platform-process-result-view.ts'
import {
  PRODUCTION_ORDER_IDENTITY_COLUMN_TITLE,
  renderProductionOrderIdentityCell,
} from '../../data/fcs/production-order-identity.ts'
import {
  getSewingDeliverySlaView,
  listSewingDeliverySlaViews,
  type SewingDeliverySlaView,
} from '../../data/fcs/sewing-delivery-sla-view.ts'
import {
  formatOperationLocalWallClock,
  getSewingDeliveryResponsibilityReview,
  listSewingDeliveryResponsibilityReviews,
  recordSewingDeliveryResponsibilityReview,
  type SewingDeliveryResponsibilityConclusion,
} from '../../data/fcs/sewing-delivery-sla.ts'

function getSewingDeliveryResponsibilityConclusionLabel(
  conclusion: SewingDeliveryResponsibilityConclusion,
): string {
  if (conclusion === 'FACTORY') return '工厂责任'
  if (conclusion === 'RECEIVER') return '接收方责任'
  return '双方共同责任'
}

interface SewingDeliveryResponsibilityReviewDraft {
  taskId: string
  milestoneRatio: 0.3 | 0.7 | 1
  conclusion: SewingDeliveryResponsibilityConclusion
  remark: string
  reviewedBy: string
  reviewedAt: string
  error: string
}

let sewingDeliveryResponsibilityReviewDraft: SewingDeliveryResponsibilityReviewDraft | null = null

export function captureSewingDeliveryResponsibilityReviewDraft(): SewingDeliveryResponsibilityReviewDraft | null {
  return sewingDeliveryResponsibilityReviewDraft ? { ...sewingDeliveryResponsibilityReviewDraft } : null
}

export function restoreSewingDeliveryResponsibilityReviewDraft(
  draft: SewingDeliveryResponsibilityReviewDraft | null,
): void {
  sewingDeliveryResponsibilityReviewDraft = draft ? { ...draft } : null
}

export function openSewingDeliveryResponsibilityReview(taskId: string, milestoneRatio: number): void {
  const view = getSewingDeliverySlaView(taskId)
  const milestone = view?.projection.milestones.find((item) => item.ratio === milestoneRatio)
  if (!milestone || milestone.receiverDelayRecordIds.length === 0) throw new Error('当前节点没有接收确认延迟记录，无需复核责任')
  const ratio = milestone.ratio
  const current = getSewingDeliveryResponsibilityReview(taskId, ratio)
  sewingDeliveryResponsibilityReviewDraft = {
    taskId,
    milestoneRatio: ratio,
    conclusion: current?.conclusion || 'RECEIVER',
    remark: current?.remark || '',
    reviewedBy: current?.reviewedBy || '跟单主管',
    reviewedAt: formatOperationLocalWallClock(),
    error: '',
  }
}

export function updateSewingDeliveryResponsibilityReviewField(field: string, value: string): void {
  const draft = sewingDeliveryResponsibilityReviewDraft
  if (!draft) return
  if (field === 'conclusion' && ['FACTORY', 'RECEIVER', 'SHARED'].includes(value)) {
    draft.conclusion = value as SewingDeliveryResponsibilityConclusion
  } else if (field === 'remark') {
    draft.remark = value
  } else if (field === 'reviewedBy') {
    draft.reviewedBy = value
  } else if (field === 'reviewedAt') {
    draft.reviewedAt = value ? `${value.replace('T', ' ')}${value.length === 16 ? ':00' : ''}` : ''
  }
  draft.error = ''
}

export function closeSewingDeliveryResponsibilityReview(): void {
  sewingDeliveryResponsibilityReviewDraft = null
}

export function submitSewingDeliveryResponsibilityReview(): { ok: boolean; message: string } {
  const draft = sewingDeliveryResponsibilityReviewDraft
  if (!draft) return { ok: false, message: '请先打开责任复核' }
  try {
    recordSewingDeliveryResponsibilityReview({
      runtimeTaskId: draft.taskId,
      milestoneRatio: draft.milestoneRatio,
      conclusion: draft.conclusion,
      remark: draft.remark,
      reviewedBy: draft.reviewedBy,
      reviewedAt: draft.reviewedAt,
    })
    sewingDeliveryResponsibilityReviewDraft = null
    return { ok: true, message: '责任复核已保存' }
  } catch (error) {
    const message = error instanceof Error ? error.message : '责任复核保存失败'
    draft.error = message
    return { ok: false, message }
  }
}

export function renderSewingDeliveryResponsibilityReviewDialog(): string {
  const draft = sewingDeliveryResponsibilityReviewDraft
  if (!draft) return ''
  const current = getSewingDeliveryResponsibilityReview(draft.taskId, draft.milestoneRatio)
  const history = listSewingDeliveryResponsibilityReviews(draft.taskId, draft.milestoneRatio)
  return `
    <div class="fixed inset-0 z-[150] flex items-center justify-center bg-black/45 p-4">
      <section class="w-full max-w-lg space-y-4 rounded-lg border bg-background p-4 shadow-xl" role="dialog" aria-modal="true" aria-label="主管复核责任">
        <div><h3 class="font-semibold">主管复核责任</h3><p class="mt-1 text-xs text-muted-foreground">${draft.milestoneRatio * 100}% 节点 · 仅记录责任结论，不改变交出和实收事实。</p></div>
        <div class="rounded-md border bg-muted/30 px-3 py-2 text-sm"><span class="text-muted-foreground">当前结论：</span>${current ? escapeHtml(getSewingDeliveryResponsibilityConclusionLabel(current.conclusion)) : '尚未复核'}</div>
        <label class="block space-y-1 text-sm"><span>责任结论</span><select class="h-9 w-full rounded-md border bg-background px-3" data-progress-field="sewingSlaReview.conclusion" data-skip-page-rerender="true"><option value="RECEIVER" ${draft.conclusion === 'RECEIVER' ? 'selected' : ''}>接收方责任</option><option value="FACTORY" ${draft.conclusion === 'FACTORY' ? 'selected' : ''}>工厂责任</option><option value="SHARED" ${draft.conclusion === 'SHARED' ? 'selected' : ''}>双方共同责任</option></select></label>
        <label class="block space-y-1 text-sm"><span>复核说明</span><textarea class="min-h-[80px] w-full rounded-md border bg-background px-3 py-2" data-progress-field="sewingSlaReview.remark" data-skip-page-rerender="true">${escapeHtml(draft.remark)}</textarea></label>
        <div class="grid gap-3 sm:grid-cols-2"><label class="space-y-1 text-sm"><span>复核人</span><input class="h-9 w-full rounded-md border bg-background px-3" value="${escapeAttr(draft.reviewedBy)}" data-progress-field="sewingSlaReview.reviewedBy" data-skip-page-rerender="true" /></label><label class="space-y-1 text-sm"><span>复核时间</span><input type="datetime-local" class="h-9 w-full rounded-md border bg-background px-3" value="${escapeAttr(draft.reviewedAt.replace(' ', 'T').slice(0, 16))}" data-progress-field="sewingSlaReview.reviewedAt" data-skip-page-rerender="true" /></label></div>
        ${draft.error ? `<div class="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">${escapeHtml(draft.error)}</div>` : ''}
        <section class="space-y-2"><h4 class="text-sm font-medium">复核历史</h4>${history.length > 0 ? `<div class="max-h-44 overflow-auto rounded-md border"><table class="w-full min-w-[620px] text-xs"><thead><tr class="border-b bg-muted/40 text-left"><th class="px-2 py-1.5">结论</th><th class="px-2 py-1.5">说明</th><th class="px-2 py-1.5">复核人</th><th class="px-2 py-1.5">时间</th></tr></thead><tbody>${[...history].reverse().map((review) => `<tr class="border-b last:border-b-0"><td class="px-2 py-1.5">${escapeHtml(getSewingDeliveryResponsibilityConclusionLabel(review.conclusion))}</td><td class="max-w-[240px] px-2 py-1.5">${escapeHtml(review.remark)}</td><td class="px-2 py-1.5">${escapeHtml(review.reviewedBy)}</td><td class="px-2 py-1.5">${escapeHtml(review.reviewedAt)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="rounded-md border border-dashed px-3 py-3 text-xs text-muted-foreground">暂无复核历史</div>'}</section>
        <div class="flex justify-end gap-2"><button class="h-9 rounded-md border px-4 text-sm" data-progress-action="cancel-sewing-sla-review" data-skip-page-rerender="true">取消</button><button class="h-9 rounded-md bg-primary px-4 text-sm text-primary-foreground" data-progress-action="submit-sewing-sla-review" data-skip-page-rerender="true">保存复核</button></div>
      </section>
    </div>
  `
}

function formatOutputValue(value: number | undefined): string {
  if (!Number.isFinite(value) || Number(value) <= 0) return '--'
  return `${Number(value).toLocaleString()} 产值`
}

function formatOutputValuePerUnit(value: number | undefined): string {
  if (!Number.isFinite(value) || Number(value) <= 0) return '--'
  return Number(value).toLocaleString()
}

function formatQtyUnit(unit: ProcessTask['qtyUnit']): string {
  if (unit === 'PIECE') return '件'
  if (unit === 'BUNDLE') return '打'
  return '米'
}

function getTaskHandoverStatusLabel(status: ProcessTask['handoverStatus'] | undefined): string {
  switch (status) {
    case 'AUTO_CREATED':
      return '已自动建单'
    case 'OPEN':
      return '待交出'
    case 'PARTIAL_SUBMITTED':
      return '部分已交出'
    case 'WAIT_RECEIVER_WRITEBACK':
      return '待接收方回写'
    case 'PARTIAL_WRITTEN_BACK':
      return '部分已回写'
    case 'WRITTEN_BACK':
      return '已交出完成'
    case 'DIFF_WAIT_FACTORY_CONFIRM':
      return '差异待工厂确认'
    case 'HAS_OBJECTION':
      return '存在交出异议'
    case 'OBJECTION_PROCESSING':
      return '异议处理中'
    case 'CLOSED':
      return '已关闭'
    default:
      return '未生成交出单'
  }
}

function getTaskHandoverStatusTone(status: ProcessTask['handoverStatus'] | undefined): TaskSummaryTone {
  if (status === 'WRITTEN_BACK' || status === 'CLOSED') return 'green'
  if (status === 'HAS_OBJECTION' || status === 'OBJECTION_PROCESSING' || status === 'DIFF_WAIT_FACTORY_CONFIRM') return 'red'
  if (status === 'NOT_CREATED' || !status) return 'slate'
  if (status === 'WAIT_RECEIVER_WRITEBACK' || status === 'PARTIAL_WRITTEN_BACK') return 'amber'
  return 'blue'
}

function renderTaskRiskBadges(risks: TaskRiskFlag[]): string {
  if (!risks.length) return '<span class="text-xs text-muted-foreground">—</span>'

  const tags = risks.slice(0, 2).map((risk) => renderBadge(TASK_RISK_LABEL[risk], 'border-red-200 bg-red-100 text-red-700'))
  if (risks.length > 2) {
    tags.push(renderBadge(`+${risks.length - 2}`, 'border-border bg-background text-foreground'))
  }

  return `<div class="flex flex-wrap gap-1">${tags.join('')}</div>`
}

let platformResultViewByTaskId: Map<string, PlatformProcessResultView> | null = null

function getPlatformResultViewByTaskId(taskId: string): PlatformProcessResultView | undefined {
  if (!platformResultViewByTaskId) {
    platformResultViewByTaskId = new Map()
    for (const view of listPlatformProcessResultViews()) {
      const taskIdFromLink = view.mobileTaskLink.match(/\/fcs\/pda\/exec\/([^?]+)/)?.[1]
      if (taskIdFromLink) platformResultViewByTaskId.set(decodeURIComponent(taskIdFromLink), view)
    }
  }
  return platformResultViewByTaskId.get(taskId)
}

function getTaskPlatformSummary(task: ProcessTask, includeLinkedResult = true) {
  const platformStatus = getPlatformStatusForRuntimeTask(task)
  const resultView = includeLinkedResult ? getPlatformResultViewByTaskId(task.taskId) : undefined
  const linkedResult = resultView
    ? [
        resultView.hasWaitHandoverRecord ? '待交出仓' : '',
        resultView.hasHandoverRecord ? '交出记录' : '',
        resultView.hasReviewRecord ? '审核记录' : '',
        resultView.hasDifferenceRecord ? '差异记录' : '',
      ].filter(Boolean).join(' / ') || '暂无仓交出结果'
    : includeLinkedResult ? '暂无仓交出结果' : '进入详情查看'
  const quantityText = resultView?.quantityDisplayFields
    .slice(0, 3)
    .map((field) => field.text)
    .join('；') || ''

  return {
    statusLabel: resultView?.platformStatusLabel || platformStatus.platformStatusLabel,
    internalStatusLabel: resultView?.factoryInternalStatusLabel || TASK_STATUS_LABEL[task.status],
    riskLabel: resultView?.platformRiskLabel || platformStatus.platformRiskLabel,
    actionHint: resultView?.platformActionHint || platformStatus.platformActionHint,
    ownerHint: resultView?.platformOwnerHint || platformStatus.platformOwnerHint,
    followUpActionLabel: resultView?.followUpActionLabel || '',
    linkedResult,
    quantityText,
  }
}

function getSummaryToneClass(tone: TaskSummaryTone): string {
  switch (tone) {
    case 'green':
      return 'border-green-200 bg-green-100 text-green-700'
    case 'blue':
      return 'border-blue-200 bg-blue-100 text-blue-700'
    case 'red':
      return 'border-red-200 bg-red-100 text-red-700'
    case 'amber':
      return 'border-amber-200 bg-amber-100 text-amber-700'
    default:
      return 'border-slate-200 bg-slate-100 text-slate-700'
  }
}

function renderPlatformStatusCell(task: ProcessTask): string {
  const summary = getTaskPlatformSummary(task, false)

  return `
    <div class="space-y-1">
      <div>${renderBadge(summary.statusLabel, PLATFORM_PROCESS_STATUS_CLASS[summary.statusLabel])}</div>
      <div class="text-xs text-muted-foreground">内部：${escapeHtml(summary.internalStatusLabel)}</div>
    </div>
  `
}

function formatSewingDeliveryPercent(ratio: number): string {
  return `${Math.round(ratio * 1000) / 10}%`
}

function getSewingDeliveryResultLabel(result: SewingDeliverySlaView['projection']['milestones'][number]['result']): string {
  if (result === 'ON_TIME') return '按时达标'
  if (result === 'OVERDUE_REACHED') return '逾期达标'
  if (result === 'OVERDUE_PENDING') return '已逾期未达标'
  return '进行中'
}

export function renderSewingDeliverySlaListCell(view: SewingDeliverySlaView | undefined | null, unit: string): string {
  if (!view) return '<span class="text-xs text-muted-foreground">—</span>'
  const nextMilestone = view.projection.milestones.find((milestone) => !milestone.firstReachedAt)
  return `
    <div class="min-w-[126px] space-y-1 text-xs">
      <div class="font-medium">${view.confirmedReceivedQty} / ${view.projection.snapshot.assignedQty} ${escapeHtml(unit)}</div>
      <div class="text-primary">${formatSewingDeliveryPercent(view.projection.progressRatio)}</div>
      <div class="text-muted-foreground">${nextMilestone ? `下一节点 ${nextMilestone.ratio * 100}%` : '已完成全部节点'}</div>
    </div>
  `
}

export function renderSewingDeliverySlaDetail(view: SewingDeliverySlaView | undefined | null, unit: string): string {
  if (!view) return ''
  return `
    <section class="space-y-3 rounded-md border bg-muted/20 p-3" data-sewing-delivery-sla-detail="true">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h3 class="text-sm font-medium">交付时效</h3>
        <span class="text-sm font-semibold text-primary">${formatSewingDeliveryPercent(view.projection.progressRatio)}</span>
      </div>
      <div class="grid gap-3 text-xs sm:grid-cols-3">
        <div><span class="text-muted-foreground">分配量：</span>${view.projection.snapshot.assignedQty} ${escapeHtml(unit)}</div>
        <div><span class="text-muted-foreground">累计交出：</span>${view.submittedQty} ${escapeHtml(unit)}</div>
        <div><span class="text-muted-foreground">累计已确认实收：</span>${view.confirmedReceivedQty} ${escapeHtml(unit)}</div>
      </div>
      <div class="overflow-x-auto rounded-md border bg-background">
        <table class="w-full min-w-[760px] text-xs">
          <thead><tr class="border-b bg-muted/40 text-left"><th class="px-3 py-2">节点</th><th class="px-3 py-2">目标</th><th class="px-3 py-2">截止时间</th><th class="px-3 py-2">首次达标</th><th class="px-3 py-2">结果</th><th class="px-3 py-2">接收延迟</th></tr></thead>
          <tbody>${view.projection.milestones.map((milestone) => `
            <tr class="border-b last:border-b-0">
              <td class="px-3 py-2 font-medium">${milestone.ratio * 100}% 节点</td>
              <td class="px-3 py-2">${milestone.targetQty} ${escapeHtml(unit)}</td>
              <td class="px-3 py-2">${escapeHtml(milestone.deadlineAt)}</td>
              <td class="px-3 py-2">${escapeHtml(milestone.firstReachedAt || '未达标')}</td>
              <td class="px-3 py-2">${escapeHtml(getSewingDeliveryResultLabel(milestone.result))}</td>
              <td class="px-3 py-2">${milestone.receiverDelayRecords.length > 0 ? `<div class="min-w-[300px] space-y-2"><div class="text-amber-700">受影响记录 ${milestone.receiverDelayRecords.length} 条</div><div class="space-y-1">${milestone.receiverDelayRecords.map((record) => `<div class="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-800"><div class="font-mono font-medium">${escapeHtml(record.recordId)}</div><div>交出 ${escapeHtml(record.submittedAt)} · 确认 ${escapeHtml(record.receivedAt)}</div><div>受影响 ${record.affectedQty} ${escapeHtml(unit)} · 延迟 ${record.delayHours} 小时</div></div>`).join('')}</div><button class="text-primary hover:underline" data-progress-action="review-sewing-sla-responsibility" data-task-id="${escapeAttr(view.runtimeTaskId)}" data-ratio="${milestone.ratio}" data-skip-page-rerender="true">主管复核责任</button></div>` : '—'}</td>
            </tr>
          `).join('')}</tbody>
        </table>
      </div>
    </section>
    <div data-sewing-sla-review-dialog-host="true">${renderSewingDeliveryResponsibilityReviewDialog()}</div>
  `
}

function renderEmptySubsection(title: string, hint: string): string {
  return `
    <section class="space-y-2">
      <div class="flex items-center justify-between">
        <h4 class="text-sm font-medium">${escapeHtml(title)}</h4>
      </div>
      <div class="rounded-md border border-dashed px-3 py-4 text-sm text-muted-foreground">${escapeHtml(hint)}</div>
    </section>
  `
}

function renderDrawerSectionTable(title: string, headers: string[], rows: string[][], emptyText: string, attrs = ''): string {
  if (!rows.length) return renderEmptySubsection(title, emptyText)

  return `
    <section class="space-y-2" ${attrs}>
      <div class="flex items-center justify-between">
        <h4 class="text-sm font-medium">${escapeHtml(title)}</h4>
      </div>
      <div class="overflow-hidden rounded-md border">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b bg-muted/40 text-left">
              ${headers.map((header) => `<th class="px-3 py-2 font-medium">${escapeHtml(header)}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${rows
              .map(
                (row) => `
                  <tr class="border-b last:border-b-0">
                    ${row.map((cell) => `<td class="px-3 py-2 align-top">${cell}</td>`).join('')}
                  </tr>
                `,
              )
              .join('')}
          </tbody>
        </table>
      </div>
    </section>
  `
}

function renderTaskDeliveryCardAction(recordId: string | undefined): string {
  if (!recordId) {
    return '<button type="button" class="inline-flex cursor-not-allowed items-center rounded-md border px-3 py-1.5 text-sm opacity-50" disabled>打印任务交货卡</button>'
  }

  return `
    <button
      type="button"
      class="inline-flex items-center rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
      data-nav="${escapeAttr(buildTaskDeliveryCardPrintLink(recordId))}"
      data-progress-stop="true"
    >
      打印任务交货卡
    </button>
  `
}

function renderPickupTab(task: ProcessTask): string {
  const hasMaterialRequest = Boolean(task.hasMaterialRequest || task.materialRequestNo)
  const requestStatus = task.materialRequestStatus || (hasMaterialRequest ? '待配料' : '未生成')
  const requestNo = task.materialRequestNo || (hasMaterialRequest ? '草稿待确认' : '暂无领料需求')
  const materialModeLabel = task.materialModeLabel || '按任务配置'
  const canStart = task.mockStartPrerequisiteMet === true || task.status === 'IN_PROGRESS' || task.status === 'DONE'
  const readinessReason = canStart
    ? '领料前置条件已满足，任务可继续开工或执行。'
    : task.blockNoteZh || (hasMaterialRequest ? '仍需完成领料确认后再开工。' : '当前任务暂未生成领料需求。')
  const requestRows = hasMaterialRequest
    ? [[
        escapeHtml(requestNo),
        escapeHtml(`${task.processNameZh} · ${task.qty.toLocaleString()} ${formatQtyUnit(task.qtyUnit)}`),
        escapeHtml(materialModeLabel),
        escapeHtml(requestStatus),
        escapeHtml(task.updatedAt),
      ]]
    : []

  return `
    <div class="space-y-4" data-progress-task-tab-panel="pickup">
      <section class="grid grid-cols-4 gap-4 rounded-md border bg-muted/20 p-4 text-sm">
        <div>
          <p class="text-xs text-muted-foreground">当前任务号</p>
          <p class="mt-1 font-mono">${escapeHtml(task.taskId)}</p>
        </div>
        <div>
          <p class="text-xs text-muted-foreground">领料状态</p>
          <div class="mt-1">${renderBadge(canStart ? '可开工' : '待领料确认', canStart ? 'border-green-200 bg-green-100 text-green-700' : 'border-amber-200 bg-amber-100 text-amber-700')}</div>
        </div>
        <div>
          <p class="text-xs text-muted-foreground">领料需求</p>
          <p class="mt-1 font-semibold">${hasMaterialRequest ? '1 张' : '0 张'}</p>
        </div>
        <div>
          <p class="text-xs text-muted-foreground">领料方式</p>
          <p class="mt-1 font-semibold">${escapeHtml(materialModeLabel)}</p>
        </div>
        <div class="col-span-4">
          <p class="text-xs text-muted-foreground">开工判定说明</p>
          <p class="mt-1">${escapeHtml(readinessReason)}</p>
        </div>
      </section>
      ${renderDrawerSectionTable(
        '领料需求',
        ['领料需求单号', '物料 / 面料概况', '领料方式', '当前状态', '更新时间'],
        requestRows,
        '当前任务暂无领料需求或仍处于草稿阶段。',
        'data-progress-task-pickup-section=\"requests\"',
      )}
      <section class="rounded-md border p-4 text-sm">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 class="font-medium">领料记录明细</h4>
            <p class="mt-1 text-xs text-muted-foreground">详细领料记录、仓库发料执行、差异和异议统一进入领料/配料进度页查看。</p>
          </div>
          <button class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-progress-action="task-action-material" data-po-id="${escapeAttr(task.productionOrderId)}">
            <i data-lucide="package" class="mr-2 h-4 w-4"></i>查看领料/配料进度
          </button>
        </div>
      </section>
    </div>
  `
}

function renderHandoverTab(task: ProcessTask): string {
  const handoverStatusLabel = getTaskHandoverStatusLabel(task.handoverStatus)
  const handoverTone = getTaskHandoverStatusTone(task.handoverStatus)
  const hasHandoverOrder = Boolean(task.handoverOrderId && task.handoverStatus !== 'NOT_CREATED')
  const nextActionLabel =
    task.handoverStatus === 'WRITTEN_BACK' || task.handoverStatus === 'CLOSED'
      ? '交出已完成，无需继续处理'
      : task.handoverStatus === 'HAS_OBJECTION' || task.handoverStatus === 'OBJECTION_PROCESSING'
        ? '优先处理差异 / 异议'
        : hasHandoverOrder
          ? '跟进接收方回写'
          : '任务完成后生成交出单'
  const handoutHeadRows = hasHandoverOrder
    ? [[
        escapeHtml(task.handoverOrderId || '--'),
        escapeHtml(handoverStatusLabel),
        `${task.qty.toLocaleString()} ${formatQtyUnit(task.qtyUnit)}`,
        escapeHtml(task.receiverName || '按任务流转配置'),
        escapeHtml(task.updatedAt),
      ]]
    : []
  const handoutRecordRows = ([] as Array<{ recordId: string }>).map((record) => [
    renderTaskDeliveryCardAction(record.recordId),
  ])

  return `
    <div class="space-y-4" data-progress-task-tab-panel="handover">
      <section class="grid grid-cols-2 gap-4 rounded-md border bg-muted/20 p-4 text-sm">
        <div>
          <p class="text-xs text-muted-foreground">当前任务号</p>
          <p class="mt-1 font-mono">${escapeHtml(task.taskId)}</p>
        </div>
        <div>
          <p class="text-xs text-muted-foreground">交出主状态</p>
          <div class="mt-1">${renderBadge(handoverStatusLabel, getSummaryToneClass(handoverTone))}</div>
        </div>
        <div>
          <p class="text-xs text-muted-foreground">下一步提示</p>
          <p class="mt-1">${escapeHtml(nextActionLabel)}</p>
        </div>
        <div>
          <p class="text-xs text-muted-foreground">接收方</p>
          <p class="mt-1">${escapeHtml(task.receiverName || '按任务流转配置')}</p>
        </div>
        <div class="col-span-2">
          <p class="text-xs text-muted-foreground">当前说明</p>
          <p class="mt-1">${escapeHtml(hasHandoverOrder ? '交出摘要已在任务上同步，完整交出记录、回写和差异处理请进入交接链路页查看。' : '当前任务尚未生成交出单，完成执行后再跟进交出。')}</p>
        </div>
      </section>
      ${renderDrawerSectionTable(
        '交出单',
        ['交出单号', '当前状态', '应交数量', '接收方', '更新时间'],
        handoutHeadRows,
        '当前任务暂无交出单。',
        'data-progress-task-handover-section=\"heads\"',
      )}
      <section class="rounded-md border p-4 text-sm">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 class="font-medium">交出记录明细</h4>
            <p class="mt-1 text-xs text-muted-foreground">完整交出记录、接收方回写、差异和异议统一进入交接链路页查看。</p>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            ${handoutRecordRows[0] || renderTaskDeliveryCardAction(undefined)}
            <button class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-progress-action="task-action-handover" data-task-id="${escapeAttr(task.taskId)}" data-po-id="${escapeAttr(task.productionOrderId)}">
              查看交接链路
            </button>
          </div>
        </div>
      </section>
    </div>
  `
}

function renderTaskActionMenu(task: ProcessTask): string {
  const isOpen = state.taskActionMenuId === task.taskId
  const po = task.productionOrderId

  return `
    <div class="relative inline-flex" data-progress-task-menu="true">
      <button class="inline-flex h-8 w-8 items-center justify-center rounded-md border hover:bg-muted" data-progress-action="toggle-task-menu" data-task-id="${escapeAttr(task.taskId)}" data-progress-stop="true" data-fast-page-render="true">
        <span class="text-base leading-none">...</span>
      </button>
      ${
        isOpen
          ? `
            <div class="absolute right-0 top-9 z-30 w-48 rounded-md border bg-popover p-1 shadow-lg">
              <button class="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted" data-progress-action="task-action-update-progress" data-task-id="${escapeAttr(task.taskId)}" data-progress-stop="true" data-fast-page-render="true">
                <i data-lucide="search" class="mr-2 h-4 w-4"></i>更新进度
              </button>
              <button class="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted" data-progress-action="task-action-view-exception" data-task-id="${escapeAttr(task.taskId)}" data-progress-stop="true">
                <i data-lucide="alert-triangle" class="mr-2 h-4 w-4"></i>异常定位与处理
              </button>
              <button class="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted" data-progress-action="task-action-handover" data-task-id="${escapeAttr(task.taskId)}" data-po-id="${escapeAttr(po)}" data-progress-stop="true">
                <i data-lucide="scan-line" class="mr-2 h-4 w-4"></i>交接链路
              </button>
              <button class="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted" data-progress-action="task-action-material" data-po-id="${escapeAttr(po)}" data-progress-stop="true">
                <i data-lucide="package" class="mr-2 h-4 w-4"></i>领料进度
              </button>
              <button class="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted" data-progress-action="task-action-print-route-card" data-task-id="${escapeAttr(task.taskId)}" data-progress-stop="true">
                <i data-lucide="printer" class="mr-2 h-4 w-4"></i>打印任务流转卡
              </button>
              <div class="my-1 h-px bg-border"></div>
              <button class="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted" data-progress-action="task-action-open-order" data-po-id="${escapeAttr(po)}" data-progress-stop="true">
                <i data-lucide="layers" class="mr-2 h-4 w-4"></i>查看生产单生命周期
              </button>
              <button class="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted" data-progress-action="task-action-dispatch" data-task-id="${escapeAttr(task.taskId)}" data-po-id="${escapeAttr(po)}" data-progress-stop="true">
                <i data-lucide="send" class="mr-2 h-4 w-4"></i>去任务分配
              </button>
            </div>
          `
          : ''
      }
    </div>
  `
}

function renderTaskListView(filteredTasks: ProcessTask[]): string {
  const visibleLimit = Math.max(TASK_LIST_PAGE_SIZE, state.visibleTaskLimit)
  const visibleTasks = filteredTasks.slice(0, visibleLimit)
  const hasMore = visibleTasks.length < filteredTasks.length
  const sewingDeliverySlaByTaskId = new Map(
    listSewingDeliverySlaViews().map((view) => [view.runtimeTaskId, view]),
  )

  return `
    <section class="rounded-lg border bg-card" data-progress-task-list="true">
      <div class="overflow-x-auto">
        <table class="w-full min-w-[1240px] text-sm">
          <thead>
            <tr class="border-b bg-muted/40 text-left">
              <th class="px-3 py-2 font-medium">任务 / ${PRODUCTION_ORDER_IDENTITY_COLUMN_TITLE}</th>
              <th class="px-3 py-2 font-medium">工序</th>
              <th class="px-3 py-2 font-medium">平台状态</th>
              <th class="px-3 py-2 font-medium">风险</th>
              <th class="px-3 py-2 font-medium">下一步动作</th>
              <th class="px-3 py-2 font-medium">责任方</th>
              <th class="px-3 py-2 font-medium">关键结果</th>
              <th class="px-3 py-2 font-medium">交付时效</th>
              <th class="px-3 py-2 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            ${
              filteredTasks.length === 0
                ? `
                  <tr>
                    <td colspan="9" class="px-3 py-10 text-center text-muted-foreground">暂无数据</td>
                  </tr>
                `
                : visibleTasks
                    .map((task) => {
                      const order = getOrderById(task.productionOrderId)
                      const factory = task.assignedFactoryId ? getFactoryById(task.assignedFactoryId) : null
                      const risks = getTaskRisks(task)
                      const platformSummary = getTaskPlatformSummary(task, false)
                      const qtyUnit = formatQtyUnit(task.qtyUnit)

                      return `
                        <tr class="cursor-pointer border-b hover:bg-muted/50" data-nav="/fcs/progress/board/tasks/${encodeURIComponent(task.taskId)}">
                          <td class="px-3 py-2">
                            <div class="space-y-1 text-xs">
                              <div class="flex items-center gap-1">
                                <span class="font-mono font-medium">${escapeHtml(task.taskId)}</span>
                                <button class="inline-flex h-5 items-center rounded px-1 text-[11px] text-primary hover:bg-muted" data-progress-action="copy-task-id" data-task-id="${escapeAttr(task.taskId)}" data-progress-stop="true" data-skip-page-rerender="true">复制</button>
                              </div>
                              <div class="cursor-pointer text-primary hover:underline" data-progress-action="task-action-open-order" data-po-id="${escapeAttr(task.productionOrderId)}" data-progress-stop="true">
                                ${renderProductionOrderIdentityCell(task.productionOrderId)}
                              </div>
                              <div class="max-w-[180px] truncate text-muted-foreground">${escapeHtml(getOrderSpuCode(order, '-'))} / ${escapeHtml(getOrderSpuName(order) || '-')}</div>
                            </div>
                          </td>
                          <td class="px-3 py-2">
                            <div class="space-y-1 text-xs">
                              <div class="font-medium">${escapeHtml(getTaskDisplayName(task))}</div>
                              <div class="text-muted-foreground">${escapeHtml(PROCESS_STAGE_GROUP_LABEL[getTaskStageGroup(task.stage)])} · ${task.qty} ${escapeHtml(qtyUnit)}</div>
                              <div class="text-muted-foreground">工序节点：${escapeHtml(stageLabels[task.stage])}</div>
                              <div class="flex flex-wrap gap-1">
                                ${
                                  task.assignmentMode === 'DIRECT'
                                    ? renderBadge('派单', 'border-slate-200 bg-slate-100 text-slate-700')
                                    : renderBadge('竞价', 'border-blue-200 bg-blue-100 text-blue-700')
                                }
                                ${renderBadge(ASSIGNMENT_STATUS_LABEL[task.assignmentStatus], ASSIGNMENT_STATUS_COLOR_CLASS[task.assignmentStatus])}
                              </div>
                            </div>
                          </td>
                          <td class="px-3 py-2">${renderPlatformStatusCell(task)}</td>
                          <td class="px-3 py-2">
                            <div class="space-y-1 text-xs">
                              <div>${escapeHtml(platformSummary.riskLabel)}</div>
                              ${renderTaskRiskBadges(risks)}
                            </div>
                          </td>
                          <td class="px-3 py-2">
                            <div class="max-w-[180px] space-y-1 text-xs">
                              <div class="font-medium">${escapeHtml(platformSummary.actionHint)}</div>
                              ${platformSummary.followUpActionLabel ? `<div class="text-muted-foreground">跟单：${escapeHtml(platformSummary.followUpActionLabel)}</div>` : ''}
                            </div>
                          </td>
                          <td class="px-3 py-2">
                            <div class="max-w-[160px] space-y-1 text-xs">
                              <div>${escapeHtml(platformSummary.ownerHint)}</div>
                              <div class="truncate text-muted-foreground">${escapeHtml(factory?.name ?? (task.assignmentStatus === 'BIDDING' ? '待定标' : '-'))}</div>
                            </div>
                          </td>
                          <td class="px-3 py-2">
                            <div class="max-w-[220px] space-y-1 text-xs">
                              <button class="inline-flex w-full items-center justify-between rounded border px-2 py-1 text-left hover:bg-muted" data-nav="/fcs/progress/board/tasks/${encodeURIComponent(task.taskId)}?tab=pickup" data-progress-stop="true">
                                <span>领料情况</span>
                                <span class="text-muted-foreground">&gt;</span>
                              </button>
                              <button class="inline-flex w-full items-center justify-between rounded border px-2 py-1 text-left hover:bg-muted" data-nav="/fcs/progress/board/tasks/${encodeURIComponent(task.taskId)}?tab=handover" data-progress-stop="true">
                                <span>交出情况</span>
                                <span class="text-muted-foreground">&gt;</span>
                              </button>
                              <div class="text-muted-foreground">同步：${escapeHtml(platformSummary.linkedResult)}</div>
                              ${platformSummary.quantityText ? `<div class="truncate text-muted-foreground">${escapeHtml(platformSummary.quantityText)}</div>` : ''}
                            </div>
                          </td>
                          <td class="px-3 py-2">${renderSewingDeliverySlaListCell(sewingDeliverySlaByTaskId.get(task.taskId), qtyUnit)}</td>
                          <td class="px-3 py-2 text-right" data-progress-stop="true">${renderTaskActionMenu(task)}</td>
                        </tr>
                      `
                    })
                    .join('')
            }
          </tbody>
        </table>
      </div>
      ${
        filteredTasks.length > 0
          ? `
            <footer class="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-sm">
              <span class="text-muted-foreground">已显示 ${visibleTasks.length} / 共 ${filteredTasks.length} 条</span>
              ${
                hasMore
                  ? `<button class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-progress-action="show-more-tasks" data-fast-page-render="true">继续加载 ${Math.min(TASK_LIST_PAGE_SIZE, filteredTasks.length - visibleTasks.length)} 条</button>`
                  : '<span class="text-xs text-muted-foreground">已显示全部任务</span>'
              }
            </footer>
          `
          : ''
      }
    </section>
  `
}

function renderTaskDimension(filteredTasks: ProcessTask[]): string {
  const kpi = getTaskKpiStats()

  return `
    <section class="space-y-4">
      <div class="grid grid-cols-6 gap-4">
        <button class="rounded-lg border bg-card p-4 text-left transition hover:bg-muted/40" data-progress-action="kpi-filter" data-kpi="notStarted" data-fast-page-render="true">
          <div class="flex items-center justify-between">
            <span class="text-sm text-muted-foreground">待开始</span>
            <span class="h-2 w-2 rounded-full bg-slate-400"></span>
          </div>
          <div class="mt-1 text-2xl font-bold">${kpi.notStarted}</div>
        </button>
        <button class="rounded-lg border bg-card p-4 text-left transition hover:bg-muted/40" data-progress-action="kpi-filter" data-kpi="inProgress" data-fast-page-render="true">
          <div class="flex items-center justify-between">
            <span class="text-sm text-muted-foreground">进行中</span>
            <span class="h-2 w-2 rounded-full bg-blue-500"></span>
          </div>
          <div class="mt-1 text-2xl font-bold text-blue-600">${kpi.inProgress}</div>
        </button>
        <button class="rounded-lg border bg-card p-4 text-left transition hover:bg-muted/40" data-progress-action="kpi-filter" data-kpi="blocked" data-fast-page-render="true">
          <div class="flex items-center justify-between">
            <span class="text-sm text-muted-foreground">生产暂停</span>
            <span class="h-2 w-2 rounded-full bg-red-500"></span>
          </div>
          <div class="mt-1 text-2xl font-bold text-red-600">${kpi.blocked}</div>
        </button>
        <button class="rounded-lg border bg-card p-4 text-left transition hover:bg-muted/40" data-progress-action="kpi-filter" data-kpi="done" data-fast-page-render="true">
          <div class="flex items-center justify-between">
            <span class="text-sm text-muted-foreground">已完成</span>
            <span class="h-2 w-2 rounded-full bg-green-500"></span>
          </div>
          <div class="mt-1 text-2xl font-bold text-green-600">${kpi.done}</div>
        </button>
        <button class="rounded-lg border bg-card p-4 text-left transition hover:bg-muted/40" data-progress-action="kpi-filter" data-kpi="unassigned" data-fast-page-render="true">
          <div class="flex items-center justify-between">
            <span class="text-sm text-muted-foreground">待分配</span>
            <span class="h-2 w-2 rounded-full bg-orange-500"></span>
          </div>
          <div class="mt-1 text-2xl font-bold text-orange-600">${kpi.unassigned}</div>
        </button>
        <button class="rounded-lg border bg-card p-4 text-left transition hover:bg-muted/40" data-progress-action="kpi-filter" data-kpi="tenderOverdue" data-fast-page-render="true">
          <div class="flex items-center justify-between">
            <span class="text-sm text-muted-foreground">竞价逾期</span>
            <span class="h-2 w-2 rounded-full bg-red-500"></span>
          </div>
          <div class="mt-1 text-2xl font-bold text-red-600">${kpi.tenderOverdue}</div>
        </button>
      </div>

      <section class="rounded-lg border bg-card p-4">
        <div class="grid grid-cols-9 gap-3">
          <div class="col-span-2">
            <input
              class="h-9 w-full rounded-md border bg-background px-3 text-sm"
              placeholder="任务ID / 生产单号 / SPU / 工厂"
              value="${escapeAttr(state.keyword)}"
              data-progress-field="keyword"
              data-skip-page-rerender="true"
            />
          </div>
          <select class="h-9 rounded-md border bg-background px-3 text-sm" data-progress-field="statusFilter" data-fast-page-render="true">
            <option value="ALL" ${state.statusFilter === 'ALL' ? 'selected' : ''}>全部状态</option>
            <option value="NOT_STARTED" ${state.statusFilter === 'NOT_STARTED' ? 'selected' : ''}>待开始</option>
            <option value="IN_PROGRESS" ${state.statusFilter === 'IN_PROGRESS' ? 'selected' : ''}>进行中</option>
            <option value="BLOCKED" ${state.statusFilter === 'BLOCKED' ? 'selected' : ''}>生产暂停</option>
            <option value="DONE" ${state.statusFilter === 'DONE' ? 'selected' : ''}>已完成</option>
            <option value="CANCELLED" ${state.statusFilter === 'CANCELLED' ? 'selected' : ''}>已取消</option>
          </select>
          <select class="h-9 rounded-md border bg-background px-3 text-sm" data-progress-field="assignmentStatusFilter" data-fast-page-render="true">
            <option value="ALL" ${state.assignmentStatusFilter === 'ALL' ? 'selected' : ''}>全部分配状态</option>
            <option value="UNASSIGNED" ${state.assignmentStatusFilter === 'UNASSIGNED' ? 'selected' : ''}>待分配</option>
            <option value="ASSIGNING" ${state.assignmentStatusFilter === 'ASSIGNING' ? 'selected' : ''}>分配中</option>
            <option value="ASSIGNED" ${state.assignmentStatusFilter === 'ASSIGNED' ? 'selected' : ''}>已派单</option>
            <option value="BIDDING" ${state.assignmentStatusFilter === 'BIDDING' ? 'selected' : ''}>竞价中</option>
            <option value="AWARDED" ${state.assignmentStatusFilter === 'AWARDED' ? 'selected' : ''}>已中标</option>
          </select>
          <select class="h-9 rounded-md border bg-background px-3 text-sm" data-progress-field="assignmentModeFilter" data-fast-page-render="true">
            <option value="ALL" ${state.assignmentModeFilter === 'ALL' ? 'selected' : ''}>全部分配方式</option>
            <option value="DIRECT" ${state.assignmentModeFilter === 'DIRECT' ? 'selected' : ''}>派单</option>
            <option value="BIDDING" ${state.assignmentModeFilter === 'BIDDING' ? 'selected' : ''}>竞价</option>
          </select>
          <select class="h-9 rounded-md border bg-background px-3 text-sm" data-progress-field="stageFilter" data-fast-page-render="true">
            <option value="ALL" ${state.stageFilter === 'ALL' ? 'selected' : ''}>全部阶段</option>
            ${Object.entries(PROCESS_STAGE_GROUP_LABEL)
              .map(([key, label]) => `<option value="${key}" ${state.stageFilter === key ? 'selected' : ''}>${escapeHtml(label)}</option>`)
              .join('')}
          </select>
          <select class="h-9 rounded-md border bg-background px-3 text-sm" data-progress-field="riskFilter" data-fast-page-render="true">
            <option value="ALL" ${state.riskFilter === 'ALL' ? 'selected' : ''}>全部风险</option>
            <option value="blockedOnly" ${state.riskFilter === 'blockedOnly' ? 'selected' : ''}>仅生产暂停</option>
            <option value="tenderOverdueOnly" ${state.riskFilter === 'tenderOverdueOnly' ? 'selected' : ''}>仅竞价逾期</option>
            <option value="rejectedOnly" ${state.riskFilter === 'rejectedOnly' ? 'selected' : ''}>仅派单拒绝</option>
            <option value="taskOverdueOnly" ${state.riskFilter === 'taskOverdueOnly' ? 'selected' : ''}>仅任务逾期</option>
          </select>
          <button class="h-9 rounded-md border px-3 text-sm hover:bg-muted" data-progress-action="apply-task-filters" data-fast-page-render="true">查询</button>
          <button class="h-9 rounded-md border px-3 text-sm hover:bg-muted" data-progress-action="reset-task-filters" data-fast-page-render="true">重置</button>
        </div>
      </section>

      ${renderTaskListView(filteredTasks)}
    </section>
  `
}

function resolveDetailTab(task: ProcessTask): TaskTabKey {
  const requestedTab = getCurrentSearchParams().get('tab') as TaskTabKey | null
  const availableTabs: TaskTabKey[] = ['basic', 'assignment', 'progress', 'pickup', 'handover', 'block', 'logs']
  if (requestedTab && availableTabs.includes(requestedTab)) {
    state.taskDetailTab = requestedTab
  }

  return task.status === 'BLOCKED'
    ? state.taskDetailTab
    : state.taskDetailTab === 'block'
      ? 'basic'
      : state.taskDetailTab
}

function renderProgressTaskDetailPage(taskIdParam = ''): string {
  const taskId = decodeURIComponent(taskIdParam)
  const task = getTaskById(taskId)
  if (!task) {
    return `
      <div class="space-y-4" data-progress-task-detail-page="true">
        <header class="flex items-center justify-between gap-3">
          <div>
            <h1 class="text-xl font-semibold">任务详情</h1>
            <p class="text-sm text-muted-foreground">未找到任务 ${escapeHtml(taskId || '-')}</p>
          </div>
          <button class="inline-flex h-9 items-center rounded-md border px-4 text-sm hover:bg-muted" data-nav="/fcs/progress/board">
            <i data-lucide="arrow-left" class="mr-2 h-4 w-4"></i>返回列表
          </button>
        </header>
        <section class="rounded-lg border bg-card p-10 text-center text-muted-foreground">当前任务不存在，可能已被筛选或示例数据已调整。</section>
      </div>
    `
  }

  const order = getOrderById(task.productionOrderId)
  const factory = task.assignedFactoryId ? getFactoryById(task.assignedFactoryId) : null
  const taskTenderId = getTaskTenderId(task)
  const tender = taskTenderId ? getTenderById(taskTenderId) : undefined
  const taskRisks = getTaskRisks(task)
  const taskHandoverSummary = getTaskHandoverSummary(task.taskId)
  const outputValue = resolveTaskOutputValueSnapshot(task)
  const platformStatus = getPlatformStatusForRuntimeTask(task)
  const activeTab = resolveDetailTab(task)

  return `
    <div class="space-y-4" data-progress-task-detail-page="true">
      <header class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <button class="mb-2 inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-nav="/fcs/progress/board">
            <i data-lucide="arrow-left" class="mr-2 h-4 w-4"></i>返回任务列表
          </button>
          <h1 class="flex items-center gap-2 text-xl font-semibold">
            任务详情
            ${renderBadge(platformStatus.platformStatusLabel, PLATFORM_PROCESS_STATUS_CLASS[platformStatus.platformStatusLabel])}
          </h1>
          <p class="mt-1 text-sm text-muted-foreground">${escapeHtml(task.taskId)} · ${escapeHtml(getTaskDisplayName(task))}</p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <button class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-progress-action="task-action-open-order" data-po-id="${escapeAttr(task.productionOrderId)}">
            <i data-lucide="layers" class="mr-2 h-4 w-4"></i>生产单生命周期
          </button>
          <button class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-nav="${escapeAttr(buildTaskRouteCardPrintLink('RUNTIME_TASK', task.taskId))}">
            <i data-lucide="printer" class="mr-2 h-4 w-4"></i>打印任务流转卡
          </button>
        </div>
      </header>
      <nav class="flex flex-wrap gap-1 rounded-lg border bg-card p-1 text-sm" data-progress-task-tabs="true">
        <button class="rounded px-2 py-1 ${activeTab === 'basic' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}" data-progress-action="switch-task-tab" data-tab="basic" data-fast-page-render="true">基本信息</button>
        <button class="rounded px-2 py-1 ${activeTab === 'assignment' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}" data-progress-action="switch-task-tab" data-tab="assignment" data-fast-page-render="true">分配信息</button>
        <button class="rounded px-2 py-1 ${activeTab === 'progress' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}" data-progress-action="switch-task-tab" data-tab="progress" data-fast-page-render="true">进度操作</button>
        <button class="rounded px-2 py-1 ${activeTab === 'pickup' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}" data-progress-action="switch-task-tab" data-tab="pickup" data-fast-page-render="true">领料情况</button>
        <button class="rounded px-2 py-1 ${activeTab === 'handover' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}" data-progress-action="switch-task-tab" data-tab="handover" data-fast-page-render="true">交出情况</button>
        ${
          task.status === 'BLOCKED'
            ? `<button class="rounded px-2 py-1 ${activeTab === 'block' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}" data-progress-action="switch-task-tab" data-tab="block" data-fast-page-render="true">生产暂停信息</button>`
            : ''
        }
        <button class="rounded px-2 py-1 ${activeTab === 'logs' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}" data-progress-action="switch-task-tab" data-tab="logs" data-fast-page-render="true">审计日志</button>
      </nav>
      <section class="rounded-lg border bg-card p-5" data-progress-task-detail="true">
        <div class="space-y-5">
          ${
            activeTab === 'basic'
              ? `
                <div class="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p class="text-xs text-muted-foreground">任务ID</p>
                    <p class="font-mono">${escapeHtml(task.taskId)}</p>
                  </div>
                  <div>
                    <p class="text-xs text-muted-foreground">生产单号</p>
                    <button class="inline-flex items-center text-primary hover:underline" data-progress-action="task-action-open-order" data-po-id="${escapeAttr(task.productionOrderId)}">
                      ${escapeHtml(task.productionOrderId)}
                      <i data-lucide="external-link" class="ml-1 h-3 w-3"></i>
                    </button>
                  </div>
                  <div>
                    <p class="text-xs text-muted-foreground">工序</p>
                    <p>${escapeHtml(getTaskDisplayName(task))} (${escapeHtml(task.processCode)})</p>
                  </div>
                  <div>
                    <p class="text-xs text-muted-foreground">阶段</p>
                    <p>${escapeHtml(PROCESS_STAGE_GROUP_LABEL[getTaskStageGroup(task.stage)])}</p>
                  </div>
                  <div>
                    <p class="text-xs text-muted-foreground">平台状态</p>
                    <div class="mt-1">${renderBadge(platformStatus.platformStatusLabel, PLATFORM_PROCESS_STATUS_CLASS[platformStatus.platformStatusLabel])}</div>
                  </div>
                  <div>
                    <p class="text-xs text-muted-foreground">工厂内部状态</p>
                    <p>${escapeHtml(TASK_STATUS_LABEL[task.status])}</p>
                  </div>
                  <div>
                    <p class="text-xs text-muted-foreground">风险提示</p>
                    <p>${escapeHtml(platformStatus.platformRiskLabel)}</p>
                  </div>
                  <div>
                    <p class="text-xs text-muted-foreground">下一步动作</p>
                    <p>${escapeHtml(platformStatus.platformActionHint)}</p>
                  </div>
                  <div>
                    <p class="text-xs text-muted-foreground">任务对象与单位</p>
                    <p>${task.qty} ${task.qtyUnit === 'PIECE' ? '件' : escapeHtml(task.qtyUnit)}</p>
                  </div>
                  <div>
                    <p class="text-xs text-muted-foreground">分配方式</p>
                    <p>${task.assignmentMode === 'DIRECT' ? '派单' : '竞价'}</p>
                  </div>
                  <div>
                    <p class="text-xs text-muted-foreground">单位产值</p>
                    <p>${escapeHtml(formatOutputValuePerUnit(outputValue.outputValuePerUnit))}</p>
                  </div>
                  <div>
                    <p class="text-xs text-muted-foreground">产值单位</p>
                    <p>${escapeHtml(outputValue.outputValueUnit || '--')}</p>
                  </div>
                  <div>
                    <p class="text-xs text-muted-foreground">任务总产值</p>
                    <p>${escapeHtml(formatOutputValue(outputValue.totalOutputValue))}</p>
                  </div>
                  ${
                    task.difficulty
                      ? `<div><p class="text-xs text-muted-foreground">难度</p><p>${task.difficulty === 'EASY' ? '简单' : task.difficulty === 'MEDIUM' ? '中等' : '困难'}</p></div>`
                      : ''
                  }
                </div>
                <div class="rounded-md border bg-blue-50 p-3 text-sm">
                  <p class="text-xs text-blue-700">交接情况</p>
                  <p class="mt-1 text-blue-700">当前状态：${escapeHtml(taskHandoverSummary.processStatusLabel)}</p>
                  <p class="mt-1 text-blue-700">下一步：${escapeHtml(taskHandoverSummary.nextActionHint)}</p>
                  <button class="mt-2 inline-flex h-8 items-center rounded-md border border-blue-200 bg-white px-3 text-sm text-blue-700 hover:bg-blue-100" data-progress-action="task-action-handover" data-task-id="${escapeAttr(task.taskId)}" data-po-id="${escapeAttr(task.productionOrderId)}">
                    <i data-lucide="scan-line" class="mr-1.5 h-4 w-4"></i>查看交接链路
                  </button>
                </div>
                ${
                  task.qcPoints.length > 0
                    ? `
                      <div>
                        <p class="text-xs text-muted-foreground">质检点</p>
                        <div class="mt-1 flex flex-wrap gap-1">${task.qcPoints
                          .map((item) => renderBadge(item, 'border-border bg-background text-foreground'))
                          .join('')}</div>
                      </div>
                    `
                    : ''
                }
                ${
                  task.attachments.length > 0
                    ? `
                      <div>
                        <p class="text-xs text-muted-foreground">附件</p>
                        <div class="mt-1 space-y-1 text-sm">
                          ${task.attachments
                            .map((item) => `<div class="text-blue-600 hover:underline">${escapeHtml(item.name)}</div>`)
                            .join('')}
                        </div>
                      </div>
                    `
                    : ''
                }
              `
              : ''
          }

          ${
            activeTab === 'assignment'
              ? `
                <div class="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p class="text-xs text-muted-foreground">分配方式</p>
                    <p class="mt-1">${
                      task.assignmentMode === 'DIRECT'
                        ? renderBadge('派单', 'border-slate-200 bg-slate-100 text-slate-700')
                        : renderBadge('竞价', 'border-blue-200 bg-blue-100 text-blue-700')
                    }</p>
                  </div>
                  <div>
                    <p class="text-xs text-muted-foreground">分配状态</p>
                    <p class="mt-1">${renderBadge(ASSIGNMENT_STATUS_LABEL[task.assignmentStatus], ASSIGNMENT_STATUS_COLOR_CLASS[task.assignmentStatus])}</p>
                  </div>
                </div>

                ${
                  task.assignedFactoryId
                    ? `
                      <div class="text-sm">
                        <p class="text-xs text-muted-foreground">执行工厂</p>
                        <p>${escapeHtml(factory?.name ?? task.assignedFactoryId)}</p>
                      </div>
                    `
                    : ''
                }

                ${
                  taskTenderId
                    ? `
                      <div class="space-y-2 text-sm">
                        <div>
                          <p class="text-xs text-muted-foreground">竞价ID</p>
                          <p class="font-mono">${escapeHtml(taskTenderId)}</p>
                        </div>
                        ${
                          tender
                            ? `
                              <div>
                                <p class="text-xs text-muted-foreground">竞价截止时间</p>
                                <div class="flex items-center gap-2">
                                  <span>${escapeHtml(tender.deadline)}</span>
                                  ${
                                    tender.status === 'OVERDUE' || parseDateTime(tender.deadline) < Date.now()
                                      ? renderBadge('已逾期', 'border-red-200 bg-red-100 text-red-700')
                                      : ''
                                  }
                                </div>
                              </div>
                            `
                            : ''
                        }
                      </div>
                    `
                    : ''
                }

                <div class="flex flex-wrap gap-2 border-t pt-3">
                  <button class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-progress-action="task-action-dispatch" data-task-id="${escapeAttr(task.taskId)}" data-po-id="${escapeAttr(task.productionOrderId)}">
                    <i data-lucide="send" class="mr-2 h-4 w-4"></i>去任务分配
                  </button>
                  <button class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-progress-action="task-action-material" data-po-id="${escapeAttr(task.productionOrderId)}">
                    <i data-lucide="package" class="mr-2 h-4 w-4"></i>领料进度
                  </button>
                </div>
              `
              : ''
          }

          ${
            activeTab === 'progress'
              ? `
                ${renderSewingDeliverySlaDetail(getSewingDeliverySlaView(task.taskId), formatQtyUnit(task.qtyUnit))}
                <div class="text-sm">
                  <p class="text-xs text-muted-foreground">平台状态</p>
                  <div class="mt-1">${renderBadge(platformStatus.platformStatusLabel, PLATFORM_PROCESS_STATUS_CLASS[platformStatus.platformStatusLabel])}</div>
                  <p class="mt-2 text-xs text-muted-foreground">工厂内部状态：${escapeHtml(TASK_STATUS_LABEL[task.status])}</p>
                </div>
                <div class="grid gap-3 text-sm sm:grid-cols-2">
                  <div class="rounded-md border bg-muted/20 p-3">
                    <div class="flex items-center justify-between gap-3">
                      <p class="text-xs text-muted-foreground">开工信息</p>
                      ${renderBadge(task.startedAt ? '已开工' : '待开工', task.startedAt ? 'border-green-200 bg-green-100 text-green-700' : 'border-amber-200 bg-amber-100 text-amber-700')}
                    </div>
                    <div class="mt-2 space-y-1 text-xs">
                      <p><span class="text-muted-foreground">开工时间：</span>${escapeHtml(task.startedAt || '—')}</p>
                      <p><span class="text-muted-foreground">开工人数：</span>${escapeHtml(task.startHeadcount ? `${task.startHeadcount} 人` : '—')}</p>
                      <p><span class="text-muted-foreground">凭证数量：</span>${escapeHtml(String(task.startProofFiles?.length ?? 0))}</p>
                    </div>
                  </div>
                  <div class="rounded-md border bg-muted/20 p-3">
                    <div class="flex items-center justify-between gap-3">
                      <p class="text-xs text-muted-foreground">关键节点上报</p>
                      ${renderBadge(task.milestoneStatus === 'REPORTED' ? '已上报' : task.milestoneRequired ? '待上报' : '不要求', task.milestoneStatus === 'REPORTED' ? 'border-green-200 bg-green-100 text-green-700' : task.milestoneRequired ? 'border-amber-200 bg-amber-100 text-amber-700' : 'border-slate-200 bg-slate-100 text-slate-600')}
                    </div>
                    <div class="mt-2 space-y-1 text-xs">
                      <p><span class="text-muted-foreground">节点规则：</span>${escapeHtml(task.milestoneRuleLabel || '—')}</p>
                      <p><span class="text-muted-foreground">上报时间：</span>${escapeHtml(task.milestoneReportedAt || '—')}</p>
                      <p><span class="text-muted-foreground">上报数量：</span>${escapeHtml(task.milestoneReportedQty ? `${task.milestoneReportedQty} ${task.milestoneTargetUnit === 'YARD' ? 'Yard' : '件/片'}` : '—')}</p>
                      <p><span class="text-muted-foreground">凭证数量：</span>${escapeHtml(String(task.milestoneProofFiles?.length ?? 0))}</p>
                    </div>
                  </div>
                </div>
                ${
                  taskRisks.length > 0
                    ? `<div><p class="text-xs text-muted-foreground">风险标签</p><div class="mt-1">${renderTaskRiskBadges(taskRisks)}</div></div>`
                    : ''
                }
                <div class="flex flex-wrap gap-2 border-t pt-3">
                  ${
                    task.status === 'NOT_STARTED'
                      ? `<button class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-progress-action="task-status-start" data-task-id="${escapeAttr(task.taskId)}" data-fast-page-render="true"><i data-lucide="play-circle" class="mr-1.5 h-4 w-4"></i>标记开始</button>`
                      : ''
                  }
                  ${
                    task.status === 'IN_PROGRESS'
                      ? `<button class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-progress-action="task-status-finish" data-task-id="${escapeAttr(task.taskId)}" data-fast-page-render="true"><i data-lucide="check-circle-2" class="mr-1.5 h-4 w-4"></i>标记完工</button>`
                      : ''
                  }
                  ${
                    task.status === 'NOT_STARTED' || task.status === 'IN_PROGRESS'
                      ? `<button class="inline-flex h-8 items-center rounded-md border border-red-200 bg-red-50 px-3 text-sm text-red-700 hover:bg-red-100" data-progress-action="task-status-block" data-task-id="${escapeAttr(task.taskId)}" data-fast-page-render="true"><i data-lucide="pause" class="mr-1.5 h-4 w-4"></i>标记生产暂停</button>`
                      : ''
                  }
                  ${
                    task.status === 'BLOCKED'
                      ? `<button class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-progress-action="task-status-unblock" data-task-id="${escapeAttr(task.taskId)}" data-fast-page-render="true"><i data-lucide="play-circle" class="mr-1.5 h-4 w-4"></i>恢复执行</button>`
                      : ''
                  }
                  <button class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-progress-action="task-status-cancel" data-task-id="${escapeAttr(task.taskId)}" data-skip-page-rerender="true"><i data-lucide="x-circle" class="mr-1.5 h-4 w-4"></i>取消任务</button>
                </div>

                ${
                  task.assignedFactoryId && !['DONE', 'CANCELLED'].includes(task.status)
                    ? `
                      <div class="border-t pt-3">
                        <p class="text-xs text-muted-foreground">催办与通知</p>
                        <button class="mt-2 inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-progress-action="task-send-urge" data-task-id="${escapeAttr(task.taskId)}" data-skip-page-rerender="true">
                          <i data-lucide="bell" class="mr-1.5 h-4 w-4"></i>催办工厂
                        </button>
                      </div>
                    `
                    : ''
                }
              `
              : ''
          }

          ${activeTab === 'pickup' ? renderPickupTab(task) : ''}

          ${activeTab === 'handover' ? renderHandoverTab(task) : ''}

          ${
            activeTab === 'block' && task.status === 'BLOCKED'
              ? `
                <div class="space-y-4 text-sm">
                  <div>
                    <p class="text-xs text-muted-foreground">当前无法继续的原因</p>
                    <div class="mt-1">${renderBadge(BLOCK_REASON_LABEL[task.blockReason ?? 'OTHER'], 'border-red-200 bg-red-100 text-red-700')}</div>
                  </div>
                  ${
                    task.blockRemark
                      ? `
                        <div>
                          <p class="text-xs text-muted-foreground">生产暂停备注</p>
                          <div class="mt-1 rounded-md bg-muted p-2">${escapeHtml(task.blockRemark)}</div>
                        </div>
                      `
                      : ''
                  }
                  ${
                    task.blockedAt
                      ? `
                        <div>
                          <p class="text-xs text-muted-foreground">生产暂停开始时间</p>
                          <div class="mt-1">${escapeHtml(task.blockedAt)}</div>
                        </div>
                      `
                      : ''
                  }
                  <div class="border-t pt-3">
                    <button class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-progress-action="task-action-view-exception" data-task-id="${escapeAttr(task.taskId)}">
                      <i data-lucide="file-warning" class="mr-1.5 h-4 w-4"></i>查看异常定位与处理
                    </button>
                  </div>
                </div>
              `
              : ''
          }

          ${
            activeTab === 'logs'
              ? `
                <div class="overflow-hidden rounded-md border">
                  <table class="w-full text-sm">
                    <thead>
                      <tr class="border-b bg-muted/40 text-left">
                        <th class="px-3 py-2 font-medium">动作</th>
                        <th class="px-3 py-2 font-medium">详情</th>
                        <th class="px-3 py-2 font-medium">时间</th>
                        <th class="px-3 py-2 font-medium">操作人</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${
                        task.auditLogs.length === 0
                          ? '<tr><td colspan="4" class="px-3 py-6 text-center text-muted-foreground">暂无数据</td></tr>'
                          : task.auditLogs
                              .map(
                                (log) => `
                                  <tr class="border-b">
                                    <td class="px-3 py-2">${renderBadge(log.action, 'border-border bg-background text-foreground')}</td>
                                    <td class="px-3 py-2">${escapeHtml(log.detail)}</td>
                                    <td class="px-3 py-2 text-xs text-muted-foreground">${escapeHtml(log.at)}</td>
                                    <td class="px-3 py-2 text-xs">${escapeHtml(log.by)}</td>
                                  </tr>
                                `,
                              )
                              .join('')
                      }
                    </tbody>
                  </table>
                </div>
              `
              : ''
          }
        </div>
      </section>
      ${renderBlockDialog()}
    </div>
  `
}


function renderBlockDialog(): string {
  if (!state.blockDialogTaskId) return ''

  const task = getTaskById(state.blockDialogTaskId)
  if (!task) return ''

  return `
    <div class="fixed inset-0 z-[60]" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-progress-action="close-block-dialog" aria-label="关闭"></button>
      <section class="absolute left-1/2 top-1/2 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background p-6 shadow-2xl">
        <header class="space-y-1">
          <h3 class="text-lg font-semibold">标记生产暂停</h3>
          <p class="text-sm text-muted-foreground">任务 ${escapeHtml(task.taskId)} - ${escapeHtml(getTaskDisplayName(task))}</p>
        </header>

        <div class="mt-4 space-y-4">
          <div>
            <label class="text-sm">当前无法继续的原因 *</label>
            <select class="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm" data-progress-field="blockReason" data-skip-page-rerender="true">
              ${BLOCK_REASON_OPTIONS.map((item) => `<option value="${item.value}" ${state.blockReason === item.value ? 'selected' : ''}>${escapeHtml(item.label)}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="text-sm">备注</label>
            <textarea class="mt-1 min-h-[88px] w-full rounded-md border bg-background px-3 py-2 text-sm" placeholder="请输入备注..." data-progress-field="blockRemark" data-skip-page-rerender="true">${escapeHtml(state.blockRemark)}</textarea>
          </div>
        </div>

        <footer class="mt-6 flex justify-end gap-2">
            <button class="inline-flex h-9 items-center rounded-md border px-4 text-sm hover:bg-muted" data-progress-action="close-block-dialog" data-fast-page-render="true">取消</button>
            <button class="inline-flex h-9 items-center rounded-md border border-red-200 bg-red-50 px-4 text-sm text-red-700 hover:bg-red-100" data-progress-action="confirm-block" data-fast-page-render="true">确认</button>
        </footer>
      </section>
    </div>
  `
}

export { renderTaskDimension, renderProgressTaskDetailPage, renderBlockDialog }
