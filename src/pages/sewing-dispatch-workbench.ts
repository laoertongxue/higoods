import { escapeHtml } from '../utils.ts'
import {
  createSewingDispatchWorkbenchDraft,
  listSewingDispatchWorkbenchDrafts,
  listSewingDispatchWorkbenchTasks,
  listSewingFactoryOptions,
  summarizeSewingDispatchWorkbench,
  type SewingDispatchGapType,
  type SewingDispatchKitStatus,
  type SewingDispatchReadinessGroup,
  type SewingDispatchWorkbenchRow,
  type SewingDispatchWorkbenchTask,
} from '../data/fcs/sewing-dispatch-workbench.ts'
import {
  getCutPieceReleaseSummaryForProductionOrder,
  type CutPieceReleaseSummary,
} from '../data/fcs/cut-piece-release.ts'
import { classifySewingDeliverySla, createSewingDeliverySlaSnapshot, formatOperationLocalWallClock, operationWallClockToDateTimeLocal, dateTimeLocalToOperationWallClock } from '../data/fcs/sewing-delivery-sla.ts'
import { sumSewingDeliveryConfirmedReceiptQty } from '../data/fcs/sewing-delivery-receipt-facts.ts'
import { reassignRuntimeSewingTask } from '../data/fcs/runtime-sewing-reassignment.ts'
import { getRuntimeTaskById, listRuntimeProcessTasks } from '../data/fcs/runtime-process-tasks.ts'
import {
  describeDispatchAcceptanceSlaResolution,
  formatDispatchAcceptanceTimeout,
  getDispatchAcceptanceSlaRuleSourceLabel,
  resolveDispatchAcceptanceSlaForTask,
} from '../data/fcs/dispatch-acceptance-sla.ts'
import {
  listProductionOrderSewingFactories,
  productionOrders,
} from '../data/fcs/production-orders.ts'
import {
  getMaterialPrepDispatchReadinessForTask,
  type MaterialPrepDispatchReadiness,
} from '../data/fcs/cutting/production-material-prep.ts'
import {
  PRODUCTION_ORDER_IDENTITY_COLUMN_TITLE,
  renderProductionOrderIdentityCell,
} from '../data/fcs/production-order-identity.ts'
import {
  listFactoryMasterRecords,
} from '../data/fcs/factory-master-store.ts'
import {
  evaluateThirdPartyFactoryDispatchPolicy,
  getThirdPartyFactoryRatingSnapshot,
  type DispatchPolicyDecision,
  type FactoryRatingDocumentTypeLabel,
} from '../data/fcs/third-party-factory-rating.ts'

type KitFilter = '全部' | SewingDispatchKitStatus
type GapFilter = '全部' | SewingDispatchGapType
type MarkerFilter = '全部' | '跨生产单' | '单生产单'

export interface SewingDispatchWorkbenchState {
  keyword: string
  kitFilter: KitFilter
  gapFilter: GapFilter
  markerFilter: MarkerFilter
  page: number
  pageSize: number
  selectedTaskIds: Set<string>
  detailTaskId: string | null
  dispatchOpen: boolean
  dispatchActionType: '直接派单' | '发起竞价'
  dispatchBatchFactoryId: string
  dispatchFactoryIdByRowId: Record<string, string>
  dispatchRiskConfirmedByFactoryId: Record<string, boolean>
  dispatchSupervisorAssignedByFactoryId: Record<string, boolean>
  dispatchSelectedRowIds: Set<string>
  dispatchMainFactoryIdByProductionOrderId: Record<string, string>
  dispatchBusinessAssignedAt: string
  dispatchOperatedAt: string
  dispatchError: string
  feedbackMessage: string
  reassignTaskId: string | null
  reassignFactoryId: string
  reassignBusinessAssignedAt: string
  reassignOperatedAt: string
  reassignReason: string
  reassignError: string
  reassignQueryHandled: boolean
  reassignMainFactoryId: string
}

const state: SewingDispatchWorkbenchState = {
  keyword: '',
  kitFilter: '全部',
  gapFilter: '全部',
  markerFilter: '全部',
  page: 1,
  pageSize: 10,
  selectedTaskIds: new Set<string>(),
  detailTaskId: null,
  dispatchOpen: false,
  dispatchActionType: '直接派单',
  dispatchBatchFactoryId: '',
  dispatchFactoryIdByRowId: {},
  dispatchRiskConfirmedByFactoryId: {},
  dispatchSupervisorAssignedByFactoryId: {},
  dispatchSelectedRowIds: new Set<string>(),
  dispatchMainFactoryIdByProductionOrderId: {},
  dispatchBusinessAssignedAt: '',
  dispatchOperatedAt: '',
  dispatchError: '',
  feedbackMessage: '',
  reassignTaskId: null,
  reassignFactoryId: '',
  reassignBusinessAssignedAt: '',
  reassignOperatedAt: '',
  reassignReason: '',
  reassignError: '',
  reassignQueryHandled: false,
  reassignMainFactoryId: '',
}

let sewingDispatchNowProvider = (): string => formatOperationLocalWallClock()

export function setSewingDispatchWorkbenchNowProviderForTest(provider?: () => string): void {
  sewingDispatchNowProvider = provider ?? (() => formatOperationLocalWallClock())
}

export function captureSewingDispatchWorkbenchPageState(): SewingDispatchWorkbenchState {
  return structuredClone(state)
}

export function restoreSewingDispatchWorkbenchPageState(snapshot: SewingDispatchWorkbenchState): void {
  Object.assign(state, structuredClone(snapshot))
}

function renderReassignmentDialog(): string {
  const task = state.reassignTaskId ? getRuntimeTaskById(state.reassignTaskId) : null
  if (!task) return ''
  const factories = listSewingFactoryOptions().filter((factory) => factory.id !== task.assignedFactoryId)
  const confirmed = sumSewingDeliveryConfirmedReceiptQty(task.taskId)
  const remainingQty = Math.max(task.scopeQty - confirmed, 0)
  const selectedFactory = factories.find((factory) => factory.id === state.reassignFactoryId)
  const mainFactoryOptions = [...listProductionOrderSewingFactories(task.productionOrderId).filter((factory) => factory.id !== task.assignedFactoryId), ...(selectedFactory ? [{ id: selectedFactory.id, name: selectedFactory.name }] : [])].filter((factory, index, list) => list.findIndex((item) => item.id === factory.id) === index)
  const policyFeedback = selectedFactory
    ? renderReassignPolicyFeedback(task, selectedFactory.id, remainingQty)
    : ''
  return `
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <button class="absolute inset-0 bg-slate-900/40" data-sewing-dispatch-action="close-reassign" aria-label="关闭改派弹窗"></button>
      <section class="relative z-10 w-full max-w-xl rounded-lg border bg-background shadow-xl">
        <header class="border-b px-5 py-4">
          <h2 class="text-lg font-semibold">改派独立车缝任务</h2>
          <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(task.taskNo || task.taskId)}</p>
        </header>
        <div class="space-y-3 px-5 py-4">
          ${state.reassignError ? `<div class="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">${escapeHtml(state.reassignError)}</div>` : ''}
          <div class="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm">原工厂：${escapeHtml(task.assignedFactoryName || '未记录')}｜已确认实收 ${formatQty(confirmed)} 件｜剩余 ${formatQty(remainingQty)} 件</div>
          <label class="block text-sm">目标工厂
            <select class="mt-1 h-9 w-full rounded-md border px-3" data-skip-page-rerender="true" data-sewing-dispatch-field="reassignFactoryId">
              <option value="">请选择目标工厂</option>
              ${factories.map((factory) => `<option value="${escapeHtml(factory.id)}" ${factory.id === state.reassignFactoryId ? 'selected' : ''}>${escapeHtml(factory.name)}</option>`).join('')}
            </select>
          </label>
          ${policyFeedback}
          <label class="block text-sm">业务分配时间<input type="datetime-local" class="mt-1 h-9 w-full rounded-md border px-3" value="${escapeHtml(state.reassignBusinessAssignedAt)}" data-skip-page-rerender="true" data-sewing-dispatch-field="reassignBusinessAssignedAt" /></label>
          <label class="block text-sm">改派原因<input class="mt-1 h-9 w-full rounded-md border px-3" value="${escapeHtml(state.reassignReason)}" data-skip-page-rerender="true" data-sewing-dispatch-field="reassignReason" /></label>
          <label class="block text-sm">改派后主工厂<select class="mt-1 h-9 w-full rounded-md border px-3" data-skip-page-rerender="true" data-sewing-dispatch-field="reassignMainFactoryId"><option value="">候选超过一家时请选择</option>${mainFactoryOptions.map((factory) => `<option value="${escapeHtml(factory.id)}" ${factory.id === state.reassignMainFactoryId ? 'selected' : ''}>${escapeHtml(factory.name)}</option>`).join('')}</select></label>
        </div>
        <footer class="flex justify-end gap-2 border-t px-5 py-4">
          <button class="h-9 rounded-md border px-4 text-sm" data-sewing-dispatch-action="close-reassign">取消</button>
          <button class="h-9 rounded-md bg-blue-600 px-4 text-sm text-white" data-sewing-dispatch-action="confirm-reassign">确认改派</button>
        </footer>
      </section>
    </div>
  `
}

function getReassignPolicyDecision(
  task: RuntimeProcessTask,
  factoryId: string,
  dispatchQty: number,
): DispatchPolicyDecision {
  if (!isPageDispatchRatingGovernanceTarget(factoryId)) {
    return createPageAllowDispatchDecision('普通车缝工厂按改派规则处理。', ['可改派'])
  }
  if (!getThirdPartyFactoryRatingSnapshot(factoryId)) {
    return {
      allowed: false,
      severity: 'BLOCK',
      reason: '该三方车缝工厂缺少三方评级快照，不能改派。请先完成评级。',
      displayBadges: ['未评级', '禁止改派'],
      requiresConfirm: false,
      sortPriority: 0,
    }
  }
  const order = productionOrders.find((item) => item.productionOrderId === task.productionOrderId)
  const saleType = order?.demandSnapshot.saleType ?? ''
  const documentTypeLabel: FactoryRatingDocumentTypeLabel =
    saleType.includes('样衣') || saleType.includes('样品') || saleType.includes('小单') ? '试产单' : '常规单'
  return evaluateThirdPartyFactoryDispatchPolicy({
    factoryId,
    actionType: '直接派单',
    documentTypeLabel,
    dispatchQty,
    isUrgentOrder: order?.demandSnapshot.priority === 'URGENT',
    riskConfirmed: state.dispatchRiskConfirmedByFactoryId[factoryId] === true,
    isSupervisorAssigned: state.dispatchSupervisorAssignedByFactoryId[factoryId] === true,
  })
}

function renderReassignPolicyFeedback(task: RuntimeProcessTask, factoryId: string, dispatchQty: number): string {
  const decision = getReassignPolicyDecision(task, factoryId, dispatchQty)
  const tone = decision.severity === 'BLOCK'
    ? 'border-red-200 bg-red-50 text-red-700'
    : decision.severity === 'WARN'
      ? 'border-amber-200 bg-amber-50 text-amber-800'
      : 'border-emerald-200 bg-emerald-50 text-emerald-700'
  const riskConfirm = decision.requiresConfirm && decision.reason.includes('黄牌')
    ? `<label class="mt-2 flex items-center gap-2 text-xs"><input type="checkbox" ${state.dispatchRiskConfirmedByFactoryId[factoryId] ? 'checked' : ''} data-sewing-dispatch-field="dispatchRiskConfirmed" data-factory-id="${escapeHtml(factoryId)}" data-skip-page-rerender="true" />已确认黄牌风险</label>`
    : ''
  const supervisorConfirm = decision.requiresConfirm && decision.reason.includes('主管指定')
    ? `<label class="mt-2 flex items-center gap-2 text-xs"><input type="checkbox" ${state.dispatchSupervisorAssignedByFactoryId[factoryId] ? 'checked' : ''} data-sewing-dispatch-field="dispatchSupervisorAssigned" data-factory-id="${escapeHtml(factoryId)}" data-skip-page-rerender="true" />主管已指定改派</label>`
    : ''
  return `<div class="rounded-md border px-3 py-2 text-xs ${tone}">${escapeHtml(decision.reason)}${riskConfirm}${supervisorConfirm}</div>`
}

function refreshSewingReassignmentDialog(): void {
  if (typeof document === 'undefined') return
  const host = document.querySelector<HTMLElement>('[data-sewing-reassignment-dialog-host]')
  if (host) host.innerHTML = renderReassignmentDialog()
}

const kitBadgeClass: Record<SewingDispatchKitStatus, string> = {
  已齐套: 'border-green-200 bg-green-50 text-green-700',
  有缺口: 'border-amber-200 bg-amber-50 text-amber-700',
}

function formatQty(value: number): string {
  return Number(value || 0).toLocaleString('zh-CN', { maximumFractionDigits: 2 })
}

function renderBadge(label: string, className: string): string {
  return `<span class="inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${className}">${escapeHtml(label)}</span>`
}

function derivePageDispatchDocumentType(row: SewingDispatchWorkbenchRow): FactoryRatingDocumentTypeLabel {
  const order = productionOrders.find((item) => item.productionOrderId === row.productionOrderId)
  const saleType = order?.demandSnapshot.saleType ?? ''
  return saleType.includes('样衣') || saleType.includes('样品') || saleType.includes('小单') ? '试产单' : '常规单'
}

function isPageDispatchUrgent(row: SewingDispatchWorkbenchRow): boolean {
  return productionOrders.find((item) => item.productionOrderId === row.productionOrderId)?.demandSnapshot.priority === 'URGENT'
}

function isPageDispatchRatingGovernanceTarget(factoryId: string): boolean {
  const rating = getThirdPartyFactoryRatingSnapshot(factoryId)
  if (rating) return true
  const factory = listFactoryMasterRecords().find((item) => item.id === factoryId)
  if (!factory) return false
  return factory.factoryTier === 'THIRD_PARTY' &&
    (
      factory.factoryType === 'THIRD_SEWING' ||
      factory.processAbilities.some((ability) => ability.processCode === 'SEW')
    )
}

function createPageAllowDispatchDecision(reason: string, displayBadges: string[], sortPriority = 60): DispatchPolicyDecision {
  return {
    allowed: true,
    severity: 'ALLOW',
    reason,
    displayBadges,
    requiresConfirm: false,
    sortPriority,
  }
}

function getPageDispatchPolicyDecision(row: SewingDispatchWorkbenchRow, factoryId: string): DispatchPolicyDecision {
  if (!isPageDispatchRatingGovernanceTarget(factoryId)) {
    return createPageAllowDispatchDecision('普通车缝工厂按派单齐套规则处理。', ['可派单'])
  }
  if (!getThirdPartyFactoryRatingSnapshot(factoryId)) {
    return {
      allowed: false,
      severity: 'BLOCK',
      reason: '该三方车缝工厂缺少三方评级快照，不能派单。请先完成评级。',
      displayBadges: ['未评级', '禁止派单'],
      requiresConfirm: false,
      sortPriority: 0,
    }
  }
  return evaluateThirdPartyFactoryDispatchPolicy({
    factoryId,
    actionType: state.dispatchActionType,
    documentTypeLabel: derivePageDispatchDocumentType(row),
    dispatchQty: row.remainingQty,
    isUrgentOrder: isPageDispatchUrgent(row),
    riskConfirmed: state.dispatchRiskConfirmedByFactoryId[factoryId] === true,
    isSupervisorAssigned: state.dispatchSupervisorAssignedByFactoryId[factoryId] === true,
  })
}

function renderDispatchFactoryOption(factory: { id: string; name: string }, row?: SewingDispatchWorkbenchRow, selectedFactoryId = ''): string {
  const rating = getThirdPartyFactoryRatingSnapshot(factory.id)
  const decision = row ? getPageDispatchPolicyDecision(row, factory.id) : null
  const disabled = decision?.severity === 'BLOCK'
  const badges = decision?.displayBadges.join(' · ') || (rating ? `${rating.currentGrade}级 · ${rating.cooperationStatusLabel}` : '')
  return `<option value="${escapeHtml(factory.id)}" ${selectedFactoryId === factory.id ? 'selected' : ''} ${disabled ? 'disabled' : ''}>${escapeHtml(`${factory.name}${badges ? ` · ${badges}` : ''}`)}</option>`
}

function renderDispatchPolicyFeedback(row: SewingDispatchWorkbenchRow, factoryId: string): string {
  if (!factoryId) return ''
  const decision = getPageDispatchPolicyDecision(row, factoryId)
  const tone = decision.severity === 'BLOCK'
    ? 'border-red-200 bg-red-50 text-red-700'
    : decision.severity === 'WARN'
      ? 'border-amber-200 bg-amber-50 text-amber-800'
      : 'border-emerald-200 bg-emerald-50 text-emerald-700'
  const riskConfirm = decision.requiresConfirm && decision.reason.includes('黄牌')
    ? `<label class="mt-2 flex items-center gap-2 text-xs"><input type="checkbox" ${state.dispatchRiskConfirmedByFactoryId[factoryId] ? 'checked' : ''} data-sewing-dispatch-field="dispatchRiskConfirmed" data-factory-id="${escapeHtml(factoryId)}" data-skip-page-rerender="true" />已确认黄牌风险</label>`
    : ''
  const supervisorConfirm = decision.requiresConfirm && decision.reason.includes('主管指定')
    ? `<label class="mt-2 flex items-center gap-2 text-xs"><input type="checkbox" ${state.dispatchSupervisorAssignedByFactoryId[factoryId] ? 'checked' : ''} data-sewing-dispatch-field="dispatchSupervisorAssigned" data-factory-id="${escapeHtml(factoryId)}" data-skip-page-rerender="true" />主管已指定派单</label>`
    : ''
  return `<div class="mt-1 rounded-md border px-2 py-1 text-xs ${tone}">${escapeHtml(decision.reason)}${riskConfirm}${supervisorConfirm}</div>`
}

function getCutPieceReleaseBadgeClass(decision: CutPieceReleaseSummary['decision']): string {
  if (decision === '可以做') return 'border-green-200 bg-green-50 text-green-700'
  if (decision === '部分可以做') return 'border-blue-200 bg-blue-50 text-blue-700'
  if (decision === '暂时不能做') return 'border-rose-200 bg-rose-50 text-rose-700'
  return 'border-amber-200 bg-amber-50 text-amber-700'
}

function getTaskCutPieceReleaseSummary(task: SewingDispatchWorkbenchTask): CutPieceReleaseSummary | null {
  return getCutPieceReleaseSummaryForProductionOrder(task.productionOrderId)
}

function renderMetricCard(label: string, value: string, hint: string, tone = 'text-foreground'): string {
  return `
    <div class="rounded-lg border bg-card px-4 py-3">
      <div class="text-sm text-muted-foreground">${escapeHtml(label)}</div>
      <div class="mt-2 text-2xl font-semibold tabular-nums ${tone}">${escapeHtml(value)}</div>
      <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(hint)}</div>
    </div>
  `
}

function renderImage(url: string | undefined, alt: string): string {
  if (!url) return '<div class="flex h-14 w-14 items-center justify-center rounded-md border bg-muted text-[10px] text-muted-foreground">暂无</div>'
  return `<img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" class="h-14 w-14 rounded-md border object-cover" />`
}

function hasCutPieceDemand(task: SewingDispatchWorkbenchTask): boolean {
  return [task.normalPieces, task.auxiliaryPieces, task.specialPieces].some((group) => group.statusLabel !== '不涉及')
}

function getFilteredTasks(): SewingDispatchWorkbenchTask[] {
  const keyword = state.keyword.trim().toLowerCase()
  return listSewingDispatchWorkbenchTasks().filter((task) => {
    if (keyword) {
      const text = [
        task.productionOrderNo,
        task.productionOrderId,
        task.taskNo,
        task.taskId,
        task.spuCode,
        task.spuName,
        ...task.skuRows.flatMap((row) => [row.skuCode, row.colorName, row.sizeCode]),
      ].join(' ').toLowerCase()
      if (!text.includes(keyword)) return false
    }
    if (state.kitFilter !== '全部' && task.kitStatus !== state.kitFilter) return false
    if (state.gapFilter !== '全部' && !task.gapTypes.includes(state.gapFilter)) return false
    if (state.markerFilter === '跨生产单' && !task.markerRisks.some((risk) => risk.isCrossProductionOrder)) return false
    if (state.markerFilter === '单生产单' && task.markerRisks.some((risk) => risk.isCrossProductionOrder)) return false
    return true
  })
}

function getDispatchCandidateRows(tasks: SewingDispatchWorkbenchTask[] = listSewingDispatchWorkbenchTasks()): SewingDispatchWorkbenchRow[] {
  return tasks
    .filter((task) => state.selectedTaskIds.has(task.taskId))
    .flatMap((task) => task.skuRows)
    .filter((row) => row.remainingQty > 0 && row.completeKitQty >= row.remainingQty)
}

function getSelectedDispatchRows(tasks: SewingDispatchWorkbenchTask[] = listSewingDispatchWorkbenchTasks()): SewingDispatchWorkbenchRow[] {
  return getDispatchCandidateRows(tasks)
}

function getSewingMaterialPrepChecks(rows: SewingDispatchWorkbenchRow[]): MaterialPrepDispatchReadiness[] {
  const rowsByTask = new Map<string, SewingDispatchWorkbenchRow>()
  rows.forEach((row) => {
    if (!rowsByTask.has(row.taskId)) rowsByTask.set(row.taskId, row)
  })
  return Array.from(rowsByTask.values())
    .map((row) => getMaterialPrepDispatchReadinessForTask({
      taskId: row.taskId,
      taskNo: row.taskNo,
      productionOrderId: row.productionOrderId,
      processCode: 'PROC_SEWING',
      processBusinessCode: 'SEWING',
      processNameZh: '车缝',
    }))
    .filter((check) => check.hasMaterialPrepScope)
}

function isSewingMaterialPrepReady(checks: MaterialPrepDispatchReadiness[]): boolean {
  return checks.every((check) => check.ready)
}

function formatMaterialPrepQty(value: number, unit: string): string {
  return `${Number(value || 0).toLocaleString('zh-CN', { maximumFractionDigits: 2 })} ${unit}`
}

function formatSewingMaterialPrepError(checks: MaterialPrepDispatchReadiness[]): string {
  const blockingChecks = checks.filter((check) => !check.ready)
  if (!blockingChecks.length) return ''
  return '部分 SKU 的配料前置尚未满足，暂不能派单，请返回列表处理。'
}

function renderSewingMaterialPrepPanel(checks: MaterialPrepDispatchReadiness[]): string {
  if (!checks.length) return ''
  return `
    <section class="mt-4 rounded-md border bg-muted/20 p-3">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <p class="text-sm font-medium">配料前置校验</p>
        <span class="text-xs text-muted-foreground">按车缝任务对应物料明细判断，未配齐不可生成分配</span>
      </div>
      <div class="mt-3 space-y-3">
        ${checks.map((check) => {
          const tone = check.ready
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
            : 'border-amber-200 bg-amber-50 text-amber-800'
          const visibleLines = check.lines.slice(0, 8)
          return `
            <div class="rounded-md border ${tone} p-2">
              <div class="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span class="font-medium">${escapeHtml(check.taskNo)} / ${escapeHtml(check.taskName)}</span>
                <span>${check.ready ? '配料已满足' : `未配齐 ${check.blockingLineCount} 行`}</span>
              </div>
              <div class="mt-2 overflow-x-auto rounded border bg-white/70">
                <table class="w-full min-w-[720px] text-left text-xs">
                  <thead class="text-muted-foreground">
                    <tr>
                      <th class="px-2 py-1">物料</th>
                      <th class="px-2 py-1">需要</th>
                      <th class="px-2 py-1">已配</th>
                      <th class="px-2 py-1">缺口</th>
                      <th class="px-2 py-1">库存</th>
                      <th class="px-2 py-1">上游</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${visibleLines.map((line) => `
                      <tr class="border-t">
                        <td class="px-2 py-1">
                          <div class="font-medium text-foreground">${escapeHtml(line.materialName)}</div>
                          <div class="text-muted-foreground">${escapeHtml(line.materialSku)} / ${escapeHtml(line.color)} / ${escapeHtml(line.spec)}</div>
                        </td>
                        <td class="px-2 py-1">${formatMaterialPrepQty(line.requiredQty, line.unit)}</td>
                        <td class="px-2 py-1">${formatMaterialPrepQty(line.confirmedPrepQty, line.unit)}</td>
                        <td class="px-2 py-1 ${line.ready ? 'text-emerald-700' : 'font-medium text-amber-800'}">${formatMaterialPrepQty(line.remainingPrepQty, line.unit)}</td>
                        <td class="px-2 py-1">${formatMaterialPrepQty(line.availableStockQty, line.unit)}</td>
                        <td class="px-2 py-1">${escapeHtml(line.upstreamProgressStatus)}${line.upstreamDocumentNo ? ` / ${escapeHtml(line.upstreamDocumentNo)}` : ''}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
              ${check.lines.length > visibleLines.length ? `<div class="mt-1 text-xs text-muted-foreground">另有 ${check.lines.length - visibleLines.length} 行物料未展开显示。</div>` : ''}
            </div>
          `
        }).join('')}
      </div>
    </section>
  `
}

function renderDispatchAcceptanceSlaPreview(rows: SewingDispatchWorkbenchRow[], factoryId: string, factoryName?: string): string {
  if (!factoryId || !factoryName) {
    return '<div class="mt-3 rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">选择车缝工厂后，将展示接单时效规则。</div>'
  }
  const taskIds = Array.from(new Set(rows.map((row) => row.taskId)))
  const items = taskIds.map((taskId) => {
    const task = getRuntimeTaskById(taskId)
    if (!task) return ''
    const resolution = resolveDispatchAcceptanceSlaForTask(task, factoryId, factoryName)
    const tone = resolution.ruleSource === 'UNCONFIGURED'
      ? 'border-amber-200 bg-amber-50 text-amber-700'
      : resolution.autoAccept
        ? 'border-green-200 bg-green-50 text-green-700'
        : 'border-blue-200 bg-blue-50 text-blue-700'
    return `
      <div class="rounded-md border px-3 py-2 text-xs ${tone}">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <span class="font-medium">${escapeHtml(task.taskNo || task.taskId)} · ${escapeHtml(task.processNameZh)}${task.craftName ? ` / ${escapeHtml(task.craftName)}` : ''}</span>
          <span class="rounded border bg-background/70 px-2 py-0.5">${escapeHtml(getDispatchAcceptanceSlaRuleSourceLabel(resolution.ruleSource))}</span>
        </div>
        <div class="mt-1">${escapeHtml(describeDispatchAcceptanceSlaResolution(resolution))}</div>
        <div class="mt-1 text-muted-foreground">时效：${escapeHtml(formatDispatchAcceptanceTimeout(resolution.acceptTimeoutHours))}</div>
      </div>
    `
  }).filter(Boolean).join('')
  return `
    <div class="mt-3 rounded-md border bg-muted/20 p-3">
      <div class="mb-2 text-sm font-medium">接单时效规则</div>
      <div class="space-y-2">${items || '<div class="text-sm text-muted-foreground">暂无可计算的车缝任务。</div>'}</div>
    </div>
  `
}

function renderDirectDispatchDeadlines(rows: SewingDispatchWorkbenchRow[]): string {
  if (!state.dispatchBusinessAssignedAt) return ''
  try {
    const acceptedAt = dateTimeLocalToOperationWallClock(state.dispatchBusinessAssignedAt)
    const task = getRuntimeTaskById(rows[0]?.taskId ?? '')
    const slaKind = task ? classifySewingDeliverySla(task) : null
    if (!task || !slaKind) return ''
    const snapshot = createSewingDeliverySlaSnapshot({
      assignmentId: 'SEWING-DISPATCH-PREVIEW',
      runtimeTaskId: task.taskId,
      productionOrderId: task.productionOrderId,
      factoryId: 'PREVIEW',
      factoryName: '预览',
      assignedQty: rows.reduce((sum, row) => sum + row.remainingQty, 0),
      acceptedAt,
      slaKind,
    })
    const [thirty, seventy, hundred] = snapshot.milestones
    const deadlines: Array<[string, string, string]> = [
      ['交付完成', hundred.deadlineAt, '前完成 100%'],
      ['30% 回货', thirty.deadlineAt, '前确认实收达到 30%'],
      ['70% 回货', seventy.deadlineAt, '前确认实收达到 70%'],
      ['100% 回货', hundred.deadlineAt, '前确认实收达到 100%'],
    ]
    return `<section data-sewing-dispatch-deadline-region class="space-y-2 rounded-md border p-3">
      <div class="text-sm font-medium">交付时效与按比例回货要求</div>
      ${deadlines.map(([label, deadlineAt, requirement]) => `<div class="grid gap-1 text-sm sm:grid-cols-[110px_1fr]"><span class="text-muted-foreground">${label}</span><span class="font-medium">${escapeHtml(deadlineAt.slice(0, 16))} ${requirement}</span></div>`).join('')}
      <div class="text-xs text-muted-foreground">以业务分配时间作为自动接单时间，按满 24 小时滚动；仅接收方确认实收计入回货比例。</div>
    </section>`
  } catch {
    return '<section data-sewing-dispatch-deadline-region class="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">请填写有效的业务分配时间。</section>'
  }
}

function getSelectedFactoryCandidatesByProductionOrder(rows: SewingDispatchWorkbenchRow[]): Map<string, Array<{ id: string; name: string }>> {
  const factoriesById = new Map(listSewingFactoryOptions().map((factory) => [factory.id, factory]))
  const result = new Map<string, Array<{ id: string; name: string }>>()
  for (const productionOrderId of new Set(rows.map((row) => row.productionOrderId))) {
    const assigned = rows
      .filter((row) => row.productionOrderId === productionOrderId)
      .map((row) => factoriesById.get(state.dispatchFactoryIdByRowId[row.rowId] ?? ''))
      .filter((factory): factory is { id: string; name: string } => Boolean(factory))
    result.set(productionOrderId, [...listProductionOrderSewingFactories(productionOrderId), ...assigned]
      .filter((factory, index, list) => list.findIndex((item) => item.id === factory.id) === index))
  }
  return result
}

function renderDispatchMainFactoryChoices(rows: SewingDispatchWorkbenchRow[]): string {
  const orderIds = Array.from(new Set(rows.map((row) => row.productionOrderId)))
  if (orderIds.length === 0) return ''
  const candidatesByOrder = getSelectedFactoryCandidatesByProductionOrder(rows)
  return `<section data-sewing-dispatch-main-factory-region class="space-y-2 rounded-md border p-3"><div class="text-sm font-medium">确认主工厂</div>${orderIds.map((productionOrderId) => {
    const order = productionOrders.find((item) => item.productionOrderId === productionOrderId)
    const options = candidatesByOrder.get(productionOrderId) ?? []
    const value = state.dispatchMainFactoryIdByProductionOrderId[productionOrderId] ?? ''
    if (options.length === 1) return `<div class="grid gap-1 text-sm sm:grid-cols-[190px_1fr]"><span>${escapeHtml(order?.productionOrderNo ?? productionOrderId)}</span><span class="font-medium text-green-700">已自动确定：${escapeHtml(options[0].name)}</span></div>`
    return `<label class="grid gap-1 text-sm sm:grid-cols-[190px_1fr] sm:items-center"><span>${escapeHtml(order?.productionOrderNo ?? productionOrderId)}</span><select class="h-9 rounded-md border bg-background px-3" data-sewing-dispatch-field="dispatchMainFactory" data-production-order-id="${escapeHtml(productionOrderId)}" data-skip-page-rerender="true"><option value="">请选择唯一主工厂</option>${options.map((factory) => `<option value="${escapeHtml(factory.id)}" ${value === factory.id ? 'selected' : ''}>${escapeHtml(factory.name)}</option>`).join('')}</select></label>`
  }).join('')}</section>`
}

function getGroupTone(group: SewingDispatchReadinessGroup): string {
  if (group.statusLabel === '已齐套') return 'text-green-700'
  if (group.statusLabel === '不涉及') return 'text-muted-foreground'
  return 'text-amber-700'
}

function renderSkuQtyBreakdown(task: SewingDispatchWorkbenchTask): string {
  return `
    <div class="space-y-2 text-xs">
      <div class="grid grid-cols-2 gap-2 rounded-md border bg-muted/20 p-2">
        <div>需求汇总：<span class="font-semibold text-foreground">${formatQty(task.demandQty)}</span> 件</div>
        <div>待分配：<span class="font-semibold text-blue-700">${formatQty(task.remainingQty)}</span> 件</div>
      </div>
      <div class="space-y-1">
        ${task.skuRows.map((row) => `
          <div class="flex items-center justify-between gap-2 rounded-md border bg-background px-2 py-1">
            <span class="min-w-0 truncate">${escapeHtml(row.skuCode)} · ${escapeHtml(row.colorName)}/${escapeHtml(row.sizeCode)}</span>
            <span class="shrink-0 tabular-nums">需求 ${formatQty(row.demandQty)} / 待分配 ${formatQty(row.remainingQty)}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `
}

function renderSkuReadinessLine(row: SewingDispatchWorkbenchRow, group: SewingDispatchReadinessGroup, label: string): string {
  if (group.statusLabel === '不涉及') {
    return `<div class="text-muted-foreground">${escapeHtml(label)}：不涉及</div>`
  }
  const readyQty = Math.min(row.remainingQty, group.completeQty)
  const gapQty = Math.max(0, row.remainingQty - readyQty)
  const tone = gapQty > 0 ? 'text-amber-700' : 'text-green-700'
  return `
    <div class="${tone}">
      ${escapeHtml(label)}：齐套 ${formatQty(readyQty)} / ${formatQty(row.remainingQty)}，未齐套 ${formatQty(gapQty)}
    </div>
  `
}

function renderSkuReadinessList(
  task: SewingDispatchWorkbenchTask,
  renderLine: (row: SewingDispatchWorkbenchRow) => string,
): string {
  return `
    <div class="space-y-1.5 text-xs">
      ${task.skuRows.map((row) => `
        <div class="rounded-md border bg-background px-2 py-1.5">
          <div class="mb-1 font-medium text-foreground">${escapeHtml(row.colorName)} / ${escapeHtml(row.sizeCode)} · ${formatQty(row.remainingQty)} 件</div>
          ${renderLine(row)}
        </div>
      `).join('')}
    </div>
  `
}

function renderCutPieceProcessSummary(task: SewingDispatchWorkbenchTask): string {
  return renderSkuReadinessList(task, (row) => `
    ${renderSkuReadinessLine(row, row.normalPieces, '普通裁片')}
    ${renderSkuReadinessLine(row, row.auxiliaryPieces, '辅助工艺后')}
  `)
}

function renderWoolPieceSummary(task: SewingDispatchWorkbenchTask): string {
  return renderSkuReadinessList(task, (row) => renderSkuReadinessLine(row, row.woolPieces, '毛织片'))
}

function renderSpecialPieceSummary(task: SewingDispatchWorkbenchTask): string {
  return renderSkuReadinessList(task, (row) => renderSkuReadinessLine(row, row.specialPieces, '特种工艺裁片'))
}

function renderAccessoryStockLine(row: SewingDispatchWorkbenchRow): string {
  if (row.accessories.statusLabel === '不涉及') {
    return '<div class="text-muted-foreground">无辅料需求</div>'
  }
  const availableGarmentQty = Math.min(row.remainingQty, row.accessories.completeQty)
  const gapQty = Math.max(0, row.remainingQty - availableGarmentQty)
  const stockEnough = gapQty <= 0
  const components = row.accessories.components
    .filter((item) => 'materialName' in item)
    .slice(0, 2)
    .map((item) => 'materialName' in item
      ? `${item.materialName} ${formatQty(item.availableQty)}/${formatQty(item.requiredQty)}${item.unit}`
      : '')
    .filter(Boolean)
    .join('；')
  return `
    <div class="${stockEnough ? 'text-green-700' : 'text-amber-700'}">
      ${stockEnough ? '库存足够' : '库存不足'}：可做 ${formatQty(availableGarmentQty)} / ${formatQty(row.remainingQty)} 件，缺口 ${formatQty(gapQty)} 件
    </div>
    ${components ? `<div class="mt-0.5 text-muted-foreground">${escapeHtml(components)}</div>` : ''}
  `
}

function renderAccessorySummary(task: SewingDispatchWorkbenchTask): string {
  return renderSkuReadinessList(task, (row) => renderAccessoryStockLine(row))
}

function renderCompleteKitSummary(task: SewingDispatchWorkbenchTask): string {
  return `
    <div class="space-y-2">
      <div>
        <div class="text-xl font-semibold tabular-nums">${formatQty(task.completeKitQty)} <span class="text-xs font-normal text-muted-foreground">件</span></div>
        <div class="mt-1">${renderBadge(task.kitStatus, kitBadgeClass[task.kitStatus])}</div>
      </div>
      <div class="space-y-1 text-xs">
        ${task.skuRows.map((row) => {
          const gapQty = Math.max(0, row.remainingQty - row.completeKitQty)
          return `
            <div class="flex items-center justify-between gap-2 rounded-md border bg-background px-2 py-1">
              <span>${escapeHtml(row.colorName)} / ${escapeHtml(row.sizeCode)}</span>
              <span class="${gapQty > 0 ? 'text-amber-700' : 'text-green-700'}">齐套 ${formatQty(row.completeKitQty)}，未齐套 ${formatQty(gapQty)}</span>
            </div>
          `
        }).join('')}
      </div>
    </div>
  `
}

function renderCutPieceReleaseSummary(task: SewingDispatchWorkbenchTask): string {
  const summary = getTaskCutPieceReleaseSummary(task)
  if (!summary) {
    return `
      <div class="space-y-1 text-xs">
        ${renderBadge('待判断', 'border-amber-200 bg-amber-50 text-amber-700')}
        <div class="text-muted-foreground">尚未形成裁片放行判断。</div>
      </div>
    `
  }
  return `
    <div class="space-y-1 text-xs">
      ${renderBadge(summary.decision, getCutPieceReleaseBadgeClass(summary.decision))}
      <div class="font-medium">可做 ${formatQty(summary.releaseQty)} 件</div>
      <div class="max-w-[220px] leading-5 text-muted-foreground">${escapeHtml(summary.reason)}</div>
      <div class="text-muted-foreground">${escapeHtml(summary.judgedBy || '待确认')} ${summary.judgedAt ? `· ${escapeHtml(summary.judgedAt.slice(0, 16))}` : ''}</div>
    </div>
  `
}

function renderCutOrderClosure(task: SewingDispatchWorkbenchTask): string {
  const closure = task.cutOrderClosure
  const tone = closure.statusLabel === '全部已关闭'
    ? 'border-green-200 bg-green-50 text-green-700'
    : closure.statusLabel === '不涉及裁片单'
      ? 'border-slate-200 bg-slate-50 text-slate-700'
      : 'border-amber-200 bg-amber-50 text-amber-700'
  return `
    <div class="space-y-1">
      ${renderBadge(closure.statusLabel, tone)}
      <div class="text-xs text-muted-foreground">${escapeHtml(closure.summary)}</div>
      <div class="space-y-1 text-xs">
        ${closure.items.length === 0
          ? '<div class="text-muted-foreground">—</div>'
          : closure.items.map((item) => `
            <div class="flex items-center justify-between gap-2 rounded-md border bg-background px-2 py-1">
              <span class="font-mono">${escapeHtml(item.cutOrderNo)}</span>
              <span class="${item.isClosed ? 'text-green-700' : 'text-amber-700'}">${escapeHtml(item.statusLabel)}</span>
            </div>
          `).join('')}
      </div>
    </div>
  `
}

function renderFilters(): string {
  return `
    <section class="rounded-lg border bg-card p-4">
      <div class="grid gap-3 md:grid-cols-[minmax(260px,1fr)_180px_180px_180px_auto_auto] md:items-end">
        <label class="space-y-1">
          <span class="text-sm font-medium">搜索</span>
          <input class="h-10 w-full rounded-md border bg-background px-3 text-sm" data-sewing-dispatch-field="keyword" data-skip-page-rerender="true" placeholder="车缝任务 / 生产单 / SPU / SKU / 颜色 / 尺码" value="${escapeHtml(state.keyword)}" />
        </label>
        <label class="space-y-1">
          <span class="text-sm font-medium">齐套状态</span>
          <select class="h-10 w-full rounded-md border bg-background px-3 text-sm" data-sewing-dispatch-field="kitFilter">
            ${(['全部', '已齐套', '有缺口'] as KitFilter[]).map((item) => `<option value="${escapeHtml(item)}" ${state.kitFilter === item ? 'selected' : ''}>${escapeHtml(item)}</option>`).join('')}
          </select>
        </label>
        <label class="space-y-1">
          <span class="text-sm font-medium">缺口类型</span>
          <select class="h-10 w-full rounded-md border bg-background px-3 text-sm" data-sewing-dispatch-field="gapFilter">
            ${(['全部', '普通裁片', '毛织片', '辅助工艺裁片', '特种工艺裁片', '辅料'] as GapFilter[]).map((item) => `<option value="${escapeHtml(item)}" ${state.gapFilter === item ? 'selected' : ''}>${escapeHtml(item)}</option>`).join('')}
          </select>
        </label>
        <label class="space-y-1">
          <span class="text-sm font-medium">唛架风险</span>
          <select class="h-10 w-full rounded-md border bg-background px-3 text-sm" data-sewing-dispatch-field="markerFilter">
            ${(['全部', '跨生产单', '单生产单'] as MarkerFilter[]).map((item) => `<option value="${escapeHtml(item)}" ${state.markerFilter === item ? 'selected' : ''}>${escapeHtml(item)}</option>`).join('')}
          </select>
        </label>
        <button class="h-10 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700" data-sewing-dispatch-action="query">查询</button>
        <button class="h-10 rounded-md border px-4 text-sm hover:bg-muted" data-sewing-dispatch-action="reset">重置</button>
      </div>
    </section>
  `
}

function renderTaskTable(tasks: SewingDispatchWorkbenchTask[]): string {
  const pageSize = Math.max(1, state.pageSize)
  const pageCount = Math.max(1, Math.ceil(tasks.length / pageSize))
  const currentPage = Math.min(Math.max(1, state.page), pageCount)
  const pageTasks = tasks.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const pageAllSelected = pageTasks.length > 0 && pageTasks.every((task) => state.selectedTaskIds.has(task.taskId))
  const selectedReadySkuCount = getSelectedDispatchRows(tasks).length

  return `
    <section class="rounded-lg border bg-card">
      <div class="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <div>
          <h2 class="text-base font-semibold">车缝任务齐套列表</h2>
          <p class="mt-0.5 text-xs text-muted-foreground">列表以车缝任务为维度；SKU / 颜色 / 尺码齐套数据在任务明细中展开。</p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-sm text-muted-foreground">已选 ${state.selectedTaskIds.size} 个任务 / ${selectedReadySkuCount} 个可分配 SKU</span>
          <button class="h-9 rounded-md border px-3 text-sm hover:bg-muted ${selectedReadySkuCount === 0 ? 'pointer-events-none opacity-50' : ''}" data-sewing-dispatch-action="open-dispatch" data-dispatch-type="发起竞价" data-skip-page-rerender="true">发起竞价</button>
          <button class="h-9 rounded-md bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700 ${selectedReadySkuCount === 0 ? 'pointer-events-none opacity-50' : ''}" data-sewing-dispatch-action="open-dispatch" data-dispatch-type="直接派单" data-skip-page-rerender="true">直接派单</button>
        </div>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full min-w-[1180px] text-sm">
          <thead>
            <tr class="border-b bg-muted/40 text-xs text-muted-foreground">
              <th class="w-10 px-3 py-3 text-left"><input type="checkbox" data-sewing-dispatch-field="selectAll" ${pageAllSelected ? 'checked' : ''} /></th>
              <th class="px-3 py-3 text-left font-medium">车缝任务 / 生产单</th>
              <th class="px-3 py-3 text-left font-medium">SPU / 款式</th>
              <th class="px-3 py-3 text-left font-medium">SKU 数 / 任务数量</th>
              <th class="px-3 py-3 text-left font-medium">可分配状态</th>
              <th class="px-3 py-3 text-left font-medium">主要阻断原因</th>
              <th class="px-3 py-3 text-left font-medium">分配状态 / 承接工厂</th>
              <th class="px-3 py-3 text-left font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            ${pageTasks.length === 0 ? '<tr><td colspan="8" class="px-3 py-10 text-center text-sm text-muted-foreground">当前筛选范围暂无车缝任务。</td></tr>' : pageTasks.map((task) => renderTaskRow(task)).join('')}
          </tbody>
        </table>
      </div>
      ${renderPagination(tasks.length, currentPage, pageCount, pageSize)}
    </section>
  `
}

function renderTaskRow(task: SewingDispatchWorkbenchTask): string {
  const allocatableRows = task.skuRows.filter((row) => row.remainingQty > 0 && row.completeKitQty >= row.remainingQty)
  const allocatableQty = allocatableRows.reduce((sum, row) => sum + row.remainingQty, 0)
  const blockingReason = allocatableRows.length === task.skuRows.length
    ? '无阻断，可按完整 SKU 分配'
    : task.gapSummary || task.decisionHint || '部分 SKU 尚未完整齐套'
  return `
    <tr class="border-b last:border-b-0">
      <td class="px-3 py-4 align-top"><input type="checkbox" data-sewing-dispatch-field="selectTask" data-task-id="${escapeHtml(task.taskId)}" ${state.selectedTaskIds.has(task.taskId) ? 'checked' : ''} /></td>
      <td class="px-3 py-4 align-top">
        <div class="font-medium">${escapeHtml(task.taskNo)}</div>
        <div class="mt-1">${renderProductionOrderIdentityCell(task.productionOrderNo)}</div>
        <div class="mt-2">${renderBadge(task.assignmentStatusLabel, task.assignmentStatusLabel.includes('待') ? 'border-slate-200 bg-slate-50 text-slate-700' : 'border-blue-200 bg-blue-50 text-blue-700')}</div>
      </td>
      <td class="px-3 py-4 align-top">
        <div class="flex gap-3">
          ${renderImage(task.styleImageUrl, task.spuCode)}
          <div class="min-w-0">
            <div class="font-medium">${escapeHtml(task.spuCode)}</div>
            <div class="mt-0.5 max-w-[180px] text-xs text-muted-foreground">${escapeHtml(task.spuName)}</div>
          </div>
        </div>
      </td>
      <td class="px-3 py-4 align-top"><div class="font-medium">${task.skuRows.length} 个 SKU</div><div class="mt-1 text-xs text-muted-foreground">任务 ${formatQty(task.remainingQty)} 件</div></td>
      <td class="px-3 py-4 align-top"><div class="font-medium ${allocatableRows.length ? 'text-green-700' : 'text-amber-700'}">${allocatableRows.length ? `${allocatableRows.length} 个 SKU 可分配` : '暂无可整量分配 SKU'}</div><div class="mt-1 text-xs text-muted-foreground">${formatQty(allocatableQty)} 件</div></td>
      <td class="max-w-[260px] px-3 py-4 align-top"><div class="text-xs leading-5 ${allocatableRows.length === task.skuRows.length ? 'text-green-700' : 'text-amber-700'}">${escapeHtml(blockingReason)}</div></td>
      <td class="px-3 py-4 align-top"><div>${renderBadge(task.assignmentStatusLabel, 'border-slate-200 bg-slate-50 text-slate-700')}</div><div class="mt-2 text-xs text-muted-foreground">尚未确定承接工厂</div></td>
      <td class="px-3 py-4 align-top">
        <div class="flex flex-col gap-2">
          <button class="h-8 rounded-md border px-3 text-xs hover:bg-muted" data-sewing-dispatch-action="open-detail" data-task-id="${escapeHtml(task.taskId)}">查看详情</button>
          <button class="h-8 rounded-md border px-3 text-xs hover:bg-muted ${allocatableRows.length === 0 ? 'pointer-events-none opacity-50' : ''}" data-sewing-dispatch-action="open-dispatch" data-task-id="${escapeHtml(task.taskId)}" data-dispatch-type="发起竞价" data-skip-page-rerender="true">发起竞价</button>
          <button class="h-8 rounded-md bg-blue-600 px-3 text-xs text-white hover:bg-blue-700 ${allocatableRows.length === 0 ? 'pointer-events-none opacity-50' : ''}" data-sewing-dispatch-action="open-dispatch" data-task-id="${escapeHtml(task.taskId)}" data-dispatch-type="直接派单" data-skip-page-rerender="true">直接派单</button>
        </div>
      </td>
    </tr>
  `
}

function renderPagination(total: number, currentPage: number, pageCount: number, pageSize: number): string {
  return `
    <div class="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3">
      <div class="text-sm text-muted-foreground">第 ${currentPage} 页 / 共 ${pageCount} 页，共 ${total} 个车缝任务</div>
      <div class="flex flex-wrap items-center gap-1">
        <select class="h-8 rounded-md border bg-background px-2 text-xs" data-sewing-dispatch-field="pageSize">
          ${[10, 20, 50].map((size) => `<option value="${size}" ${pageSize === size ? 'selected' : ''}>${size} 条/页</option>`).join('')}
        </select>
        <button class="rounded-md border px-3 py-1 text-sm ${currentPage <= 1 ? 'pointer-events-none opacity-50' : 'hover:bg-muted'}" data-sewing-dispatch-action="prev-page">上一页</button>
        <button class="rounded-md border px-3 py-1 text-sm ${currentPage >= pageCount ? 'pointer-events-none opacity-50' : 'hover:bg-muted'}" data-sewing-dispatch-action="next-page">下一页</button>
      </div>
    </div>
  `
}

function renderDetailDrawer(task: SewingDispatchWorkbenchTask | undefined): string {
  if (!task) return ''
  const releaseSummary = getTaskCutPieceReleaseSummary(task)
  return `
    <div class="fixed inset-0 z-50">
      <button class="absolute inset-0 bg-black/40" data-sewing-dispatch-action="close-detail" aria-label="关闭"></button>
      <aside class="absolute right-0 top-0 flex h-full w-[min(1120px,100vw)] flex-col overflow-hidden border-l bg-background shadow-xl">
        <header class="flex items-start justify-between gap-3 border-b px-5 py-4">
          <div>
            <h3 class="text-lg font-semibold">车缝任务齐套明细</h3>
            <p class="mt-1 text-sm text-muted-foreground">${escapeHtml(task.taskNo)} · ${escapeHtml(task.productionOrderNo)} · ${escapeHtml(task.spuCode)}</p>
          </div>
          <button class="rounded-md p-1 hover:bg-muted" data-sewing-dispatch-action="close-detail"><i data-lucide="x" class="h-4 w-4"></i></button>
        </header>
        <div class="min-h-0 flex-1 overflow-auto p-5">
          <div class="grid gap-3 sm:grid-cols-5">
            ${renderMetricCard('完整齐套数量', `${formatQty(task.completeKitQty)} 件`, `${task.completeSkuCount}/${task.skuCount} 个 SKU 已齐套`, task.kitStatus === '已齐套' ? 'text-green-700' : 'text-amber-700')}
            ${renderMetricCard('裁床判断', releaseSummary?.decision || '待判断', releaseSummary ? `可做 ${formatQty(releaseSummary.releaseQty)} 件` : '尚未形成裁片放行判断', releaseSummary?.decision === '暂时不能做' ? 'text-rose-700' : releaseSummary?.decision === '待判断' ? 'text-amber-700' : 'text-blue-700')}
            ${renderMetricCard('待分配数量', `${formatQty(task.remainingQty)} 件`, task.mainFactoryStatusLabel)}
            ${renderMetricCard('裁片单闭环', `${task.cutOrderClosure.closedCount}/${task.cutOrderClosure.totalCount}`, task.cutOrderClosure.statusLabel)}
            ${renderMetricCard('缺口类型', task.gapTypes.length ? task.gapTypes.join('、') : '无', '仅展示事实，由跟单判断分配节奏')}
          </div>
          <div class="mt-4 space-y-4">
            ${renderCutOrderDetail(task)}
            ${renderSkuReadinessTable(task.skuRows)}
            ${renderMarkerDetail(task)}
          </div>
        </div>
      </aside>
    </div>
  `
}

function renderCutOrderDetail(task: SewingDispatchWorkbenchTask): string {
  return `
    <section class="rounded-lg border">
      <div class="border-b bg-muted/30 px-4 py-3 font-medium">裁片单闭环</div>
      <div class="overflow-x-auto">
        <table class="w-full min-w-[720px] text-sm">
          <thead><tr class="border-b text-xs text-muted-foreground"><th class="px-3 py-2 text-left">裁片单</th><th class="px-3 py-2 text-left">唛架方案</th><th class="px-3 py-2 text-left">状态</th><th class="px-3 py-2 text-left">是否关闭</th></tr></thead>
          <tbody>
            ${task.cutOrderClosure.items.length === 0
              ? '<tr><td colspan="4" class="px-3 py-6 text-center text-sm text-muted-foreground">不涉及裁片单。</td></tr>'
              : task.cutOrderClosure.items.map((item) => `
                <tr class="border-b last:border-b-0">
                  <td class="px-3 py-3 font-medium">${escapeHtml(item.cutOrderNo)}</td>
                  <td class="px-3 py-3">${escapeHtml(item.markerPlanNo || '—')}</td>
                  <td class="px-3 py-3">${escapeHtml(item.statusLabel)}</td>
                  <td class="px-3 py-3">${item.isClosed ? renderBadge('已关闭', 'border-green-200 bg-green-50 text-green-700') : renderBadge('未关闭', 'border-amber-200 bg-amber-50 text-amber-700')}</td>
                </tr>
              `).join('')}
          </tbody>
        </table>
      </div>
    </section>
  `
}

function getGroupReadyQty(row: SewingDispatchWorkbenchRow, group: SewingDispatchReadinessGroup): number {
  if (group.statusLabel === '不涉及') return row.remainingQty
  return Math.min(row.remainingQty, group.completeQty)
}

function getGroupGapQty(row: SewingDispatchWorkbenchRow, group: SewingDispatchReadinessGroup): number {
  if (group.statusLabel === '不涉及') return 0
  return Math.max(0, row.remainingQty - getGroupReadyQty(row, group))
}

function getPieceGapLabels(group: SewingDispatchReadinessGroup): string[] {
  return Array.from(new Set(group.components
    .filter((item) => 'partName' in item && item.statusLabel !== '已齐套')
    .map((item) => 'partName' in item
      ? `${item.partName}${item.craftName ? `（${item.craftName}）` : ''}`
      : '')
    .filter(Boolean)))
}

function getPieceFollowUpTargets(group: SewingDispatchReadinessGroup, fallback: string): string[] {
  const targets = group.components
    .filter((item) => 'partName' in item && item.statusLabel !== '已齐套')
    .map((item) => 'partName' in item ? item.ownerFactoryName || '' : '')
    .filter(Boolean)
  return Array.from(new Set(targets.length ? targets : [fallback]))
}

function renderPieceReadinessCell(
  row: SewingDispatchWorkbenchRow,
  group: SewingDispatchReadinessGroup,
): string {
  if (group.statusLabel === '不涉及') {
    return '<div class="text-xs text-muted-foreground">不涉及</div>'
  }

  const readyQty = getGroupReadyQty(row, group)
  const gapQty = getGroupGapQty(row, group)
  const tone = gapQty > 0 ? 'text-amber-700' : 'text-green-700'
  const gapLabels = getPieceGapLabels(group)

  return `
    <div class="space-y-1 text-xs">
      <div class="font-medium ${tone}">${gapQty > 0 ? '有缺口' : '已满足'}</div>
      <div>可满足 ${formatQty(readyQty)} / ${formatQty(row.remainingQty)} 件</div>
      ${gapQty > 0 ? `<div class="text-amber-700">未齐套 ${formatQty(gapQty)} 件</div>` : ''}
      ${gapQty > 0 && gapLabels.length > 0 ? `<div class="text-muted-foreground">涉及：${escapeHtml(gapLabels.slice(0, 3).join('、'))}</div>` : ''}
    </div>
  `
}

function renderAccessoryReadinessCell(row: SewingDispatchWorkbenchRow): string {
  if (row.accessories.statusLabel === '不涉及') {
    return '<div class="text-xs text-muted-foreground">无辅料需求</div>'
  }

  const readyQty = Math.min(row.remainingQty, row.accessories.completeQty)
  const gapQty = Math.max(0, row.remainingQty - readyQty)
  const stockEnough = gapQty <= 0
  const components = row.accessories.components
    .filter((item) => 'materialName' in item)
    .slice(0, 2)
    .map((item) => 'materialName' in item
      ? `${item.materialName} ${formatQty(item.availableQty)}/${formatQty(item.requiredQty)}${item.unit}`
      : '')
    .filter(Boolean)

  return `
    <div class="space-y-1 text-xs">
      <div class="font-medium ${stockEnough ? 'text-green-700' : 'text-amber-700'}">${stockEnough ? '库存足够' : '库存不足'}</div>
      <div>可做 ${formatQty(readyQty)} / ${formatQty(row.remainingQty)} 件</div>
      ${gapQty > 0 ? `<div class="text-amber-700">缺口 ${formatQty(gapQty)} 件</div>` : ''}
      ${components.length > 0 ? `<div class="text-muted-foreground">${escapeHtml(components.join('；'))}</div>` : ''}
    </div>
  `
}

function getSkuGapReasons(row: SewingDispatchWorkbenchRow): string[] {
  const reasons: string[] = []
  const pieceGroups: Array<{ label: string; group: SewingDispatchReadinessGroup }> = [
    { label: '普通裁片', group: row.normalPieces },
    { label: '毛织片', group: row.woolPieces },
    { label: '辅助工艺', group: row.auxiliaryPieces },
    { label: '特种工艺', group: row.specialPieces },
  ]

  pieceGroups.forEach(({ label, group }) => {
    const gapQty = getGroupGapQty(row, group)
    if (gapQty <= 0) return
    const labels = getPieceGapLabels(group)
    reasons.push(`${label}未齐套 ${formatQty(gapQty)} 件${labels.length ? `，涉及：${labels.slice(0, 3).join('、')}` : ''}`)
  })

  const accessoryReadyQty = Math.min(row.remainingQty, row.accessories.completeQty)
  const accessoryGapQty = row.accessories.statusLabel === '不涉及'
    ? 0
    : Math.max(0, row.remainingQty - accessoryReadyQty)
  if (accessoryGapQty > 0) {
    reasons.push(`辅料库存不足，可做 ${formatQty(accessoryReadyQty)} / ${formatQty(row.remainingQty)} 件，缺 ${formatQty(accessoryGapQty)} 件`)
  }

  return reasons
}

function getSkuFollowUpTargets(row: SewingDispatchWorkbenchRow): string[] {
  const targets: string[] = []
  const pieceGroups: Array<{ group: SewingDispatchReadinessGroup; fallback: string }> = [
    { group: row.normalPieces, fallback: '我方裁床厂' },
    { group: row.woolPieces, fallback: '毛织协同工厂' },
    { group: row.auxiliaryPieces, fallback: '辅助工艺工厂' },
    { group: row.specialPieces, fallback: '特种工艺工厂' },
  ]

  pieceGroups.forEach(({ group, fallback }) => {
    if (getGroupGapQty(row, group) <= 0) return
    targets.push(...getPieceFollowUpTargets(group, fallback))
  })

  const accessoryReadyQty = Math.min(row.remainingQty, row.accessories.completeQty)
  if (row.accessories.statusLabel !== '不涉及' && accessoryReadyQty < row.remainingQty) {
    targets.push('辅料库存')
  }

  return Array.from(new Set(targets))
}

function renderSkuGapTrace(row: SewingDispatchWorkbenchRow): string {
  const reasons = getSkuGapReasons(row)
  if (reasons.length === 0) {
    return '<div class="text-xs text-green-700">无缺口</div>'
  }

  const pieceTraceRows = [
    { label: '普通裁片', group: row.normalPieces },
    { label: '毛织片', group: row.woolPieces },
    { label: '辅助工艺', group: row.auxiliaryPieces },
    { label: '特种工艺', group: row.specialPieces },
  ].flatMap(({ label, group }) => group.components
    .filter((item) => 'partName' in item && item.statusLabel !== '已齐套')
    .map((item) => 'partName' in item ? {
      type: label,
      name: item.partName,
      craft: item.craftName || '-',
      required: `${formatQty(item.requiredPieceQty)} 片`,
      available: `${formatQty(item.availablePieceQty)} 片`,
      ready: `${formatQty(item.completeGarmentQty)} 件`,
      owner: item.ownerFactoryName || '-',
      reason: item.reason,
    } : null)
    .filter((item): item is {
      type: string
      name: string
      craft: string
      required: string
      available: string
      ready: string
      owner: string
      reason: string
    } => Boolean(item)))

  const accessoryTraceRows = row.accessories.components
    .filter((item) => 'materialName' in item && item.gapQty > 0)
    .map((item) => 'materialName' in item ? {
      type: '辅料库存',
      name: item.materialName,
      craft: '-',
      required: `${formatQty(item.requiredQty)} ${item.unit}`,
      available: `${formatQty(item.availableQty)} ${item.unit}`,
      ready: `${formatQty(item.completeGarmentQty)} 件`,
      owner: '辅料库存',
      reason: `库存不足，缺 ${formatQty(item.gapQty)} ${item.unit}`,
    } : null)
    .filter((item): item is {
      type: string
      name: string
      craft: string
      required: string
      available: string
      ready: string
      owner: string
      reason: string
    } => Boolean(item))

  const traceRows = [...pieceTraceRows, ...accessoryTraceRows]

  return `
    <div class="space-y-2 text-xs">
      <div class="space-y-1 text-amber-700">
        ${reasons.map((reason) => `<div>${escapeHtml(reason)}</div>`).join('')}
      </div>
      <details class="rounded-md border bg-muted/20 px-2 py-1">
        <summary class="cursor-pointer font-medium text-blue-700">查看缺口追溯</summary>
        <div class="mt-2 space-y-1">
          ${traceRows.map((item) => `
            <div class="rounded-md border bg-background p-2">
              <div class="font-medium">${escapeHtml(item.type)} · ${escapeHtml(item.name)}</div>
              <div class="mt-1 grid gap-1 text-muted-foreground sm:grid-cols-2">
                <div>工艺：${escapeHtml(item.craft)}</div>
                <div>跟进：${escapeHtml(item.owner)}</div>
                <div>需求：${escapeHtml(item.required)}</div>
                <div>可用：${escapeHtml(item.available)}</div>
                <div>可满足：${escapeHtml(item.ready)}</div>
                <div>${escapeHtml(item.reason)}</div>
              </div>
            </div>
          `).join('')}
        </div>
      </details>
    </div>
  `
}

function renderSkuReadinessTable(rows: SewingDispatchWorkbenchRow[]): string {
  return `
    <section class="rounded-lg border">
      <div class="border-b bg-muted/30 px-4 py-3">
        <div class="font-medium">SKU 齐套决策表</div>
        <div class="mt-1 text-xs text-muted-foreground">按 SKU / 颜色 / 尺码展示需求、完整齐套、未齐套和缺口原因，跟单据此决定分配数量。</div>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full min-w-[1680px] text-sm">
          <thead>
            <tr class="border-b text-xs text-muted-foreground">
              <th class="px-3 py-2 text-left">SKU / 颜色 / 尺码</th>
              <th class="px-3 py-2 text-left">数量</th>
              <th class="px-3 py-2 text-left">完整齐套 / 未齐套</th>
              <th class="px-3 py-2 text-left">普通裁片</th>
              <th class="px-3 py-2 text-left">毛织片</th>
              <th class="px-3 py-2 text-left">辅助工艺</th>
              <th class="px-3 py-2 text-left">特种工艺</th>
              <th class="px-3 py-2 text-left">辅料库存</th>
              <th class="px-3 py-2 text-left">缺口原因 / 跟进对象</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((row) => {
              const unreadyQty = Math.max(0, row.remainingQty - row.completeKitQty)
              const followUpTargets = getSkuFollowUpTargets(row)
              return `
              <tr class="border-b last:border-b-0 align-top">
                <td class="px-3 py-3"><div class="font-medium">${escapeHtml(row.skuCode)}</div><div class="text-xs text-muted-foreground">${escapeHtml(row.colorName)} / ${escapeHtml(row.sizeCode)}</div></td>
                <td class="px-3 py-3 text-xs">
                  <div>需求 ${formatQty(row.demandQty)} 件</div>
                  <div>已分配 ${formatQty(row.assignedQty)} 件</div>
                  <div>待分配 ${formatQty(row.remainingQty)} 件</div>
                </td>
                <td class="px-3 py-3">
                  <div class="font-semibold">${formatQty(row.completeKitQty)} 件</div>
                  <div class="${unreadyQty > 0 ? 'text-amber-700' : 'text-green-700'} text-xs">未齐套 ${formatQty(unreadyQty)} 件</div>
                  <div class="mt-1">${renderBadge(row.kitStatus, kitBadgeClass[row.kitStatus])}</div>
                </td>
                <td class="px-3 py-3">${renderPieceReadinessCell(row, row.normalPieces)}</td>
                <td class="px-3 py-3">${renderPieceReadinessCell(row, row.woolPieces)}</td>
                <td class="px-3 py-3">${renderPieceReadinessCell(row, row.auxiliaryPieces)}</td>
                <td class="px-3 py-3">${renderPieceReadinessCell(row, row.specialPieces)}</td>
                <td class="px-3 py-3">${renderAccessoryReadinessCell(row)}</td>
                <td class="px-3 py-3">
                  <div class="mb-2 text-xs">
                    <div class="${followUpTargets.length > 0 ? 'text-amber-700' : 'text-green-700'}">${followUpTargets.length > 0 ? `跟进：${escapeHtml(followUpTargets.join('、'))}` : '无需跟进'}</div>
                  </div>
                  ${renderSkuGapTrace(row)}
                </td>
              </tr>
            `}).join('')}
          </tbody>
        </table>
      </div>
    </section>
  `
}

function renderMarkerDetail(task: SewingDispatchWorkbenchTask): string {
  return `
    <section class="rounded-lg border">
      <div class="border-b bg-muted/30 px-4 py-3 font-medium">唛架方案</div>
      <div class="space-y-2 p-4">
        ${task.markerRisks.length === 0
          ? `<div class="text-sm text-muted-foreground">${hasCutPieceDemand(task) ? '暂无唛架来源。' : '当前车缝任务不涉及裁片需求，无需唛架方案。'}</div>`
          : task.markerRisks.map((risk) => `
            <div class="rounded-md border bg-background px-3 py-2 text-sm">
              <div class="flex flex-wrap items-center gap-2">
                <span class="font-medium">${escapeHtml(risk.markerPlanNo)}</span>
                ${risk.isCrossProductionOrder ? renderBadge('跨生产单', 'border-amber-200 bg-amber-50 text-amber-700') : renderBadge('单生产单', 'border-slate-200 bg-slate-50 text-slate-700')}
              </div>
              <div class="mt-1 text-xs text-muted-foreground">裁片单：${escapeHtml(risk.sourceCutOrderNos.join('、') || '—')}</div>
              <div class="mt-1 text-xs text-muted-foreground">生产单：${escapeHtml(risk.sourceProductionOrderNos.join('、') || '—')}</div>
              <div class="mt-1 text-xs text-amber-700">${escapeHtml(risk.riskLabel)}</div>
            </div>
          `).join('')}
      </div>
    </section>
  `
}

function renderDispatchCutPieceReleaseNotice(rows: SewingDispatchWorkbenchRow[], tasks: SewingDispatchWorkbenchTask[]): string {
  if (rows.length === 0) return ''
  const taskById = new Map(tasks.map((task) => [task.taskId, task] as const))
  const selectedTasks = Array.from(new Set(rows.map((row) => row.taskId)))
    .map((taskId) => taskById.get(taskId))
    .filter((task): task is SewingDispatchWorkbenchTask => Boolean(task))

  if (selectedTasks.length === 0) return ''

  return `
    <section class="mt-4 rounded-lg border bg-muted/20 p-3">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div class="text-sm font-medium">裁床判断参考</div>
          <div class="mt-0.5 text-xs text-muted-foreground">跟单结合裁床判断、完整齐套数量和辅料库存决定是否生成车缝分配。</div>
        </div>
        <button class="h-8 rounded-md border px-3 text-xs hover:bg-background" data-nav="/fcs/craft/cutting/cut-piece-release">查看裁片放行管理</button>
      </div>
      <div class="mt-3 grid gap-2">
        ${selectedTasks.map((task) => {
          const summary = getTaskCutPieceReleaseSummary(task)
          if (!summary) {
            return `
              <div class="rounded-md border bg-background px-3 py-2 text-xs">
                <div class="font-medium">${escapeHtml(task.productionOrderNo)} · ${escapeHtml(task.taskNo)}</div>
                <div class="mt-1 text-amber-700">裁床判断：待判断</div>
              </div>
            `
          }
          return `
            <div class="rounded-md border bg-background px-3 py-2 text-xs">
              <div class="flex flex-wrap items-center gap-2">
                <span class="font-medium">${escapeHtml(task.productionOrderNo)} · ${escapeHtml(task.taskNo)}</span>
                ${renderBadge(summary.decision, getCutPieceReleaseBadgeClass(summary.decision))}
                <span class="text-blue-700">可做 ${formatQty(summary.releaseQty)} 件</span>
              </div>
              <div class="mt-1 leading-5 text-muted-foreground">${escapeHtml(summary.reason)}</div>
              ${summary.riskNote ? `<div class="mt-1 text-amber-700">${escapeHtml(summary.riskNote)}</div>` : ''}
              <div class="mt-1 text-muted-foreground">确认：${escapeHtml(summary.judgedBy || '待确认')} ${summary.judgedAt ? `· ${escapeHtml(summary.judgedAt.slice(0, 16))}` : ''}</div>
            </div>
          `
        }).join('')}
      </div>
    </section>
  `
}

function renderDispatchErrorRegion(): string {
  return `<div data-sewing-dispatch-error-region>${state.dispatchError ? `<div class="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">${escapeHtml(state.dispatchError)}</div>` : ''}</div>`
}

function renderDirectDispatchFactoryRows(rows: SewingDispatchWorkbenchRow[]): string {
  const factories = listSewingFactoryOptions()
  if (rows.length === 0) return '<tr><td colspan="5" class="px-3 py-8 text-center text-muted-foreground">所选任务暂无可按完整 SKU 分配的明细。</td></tr>'
  return rows.map((row) => {
    const selectedFactoryId = state.dispatchFactoryIdByRowId[row.rowId] ?? ''
    return `<tr class="border-b last:border-b-0">
      <td class="px-3 py-3 text-center"><input type="checkbox" data-sewing-dispatch-field="dispatchRowSelected" data-row-id="${escapeHtml(row.rowId)}" data-skip-page-rerender="true" ${state.dispatchSelectedRowIds.has(row.rowId) ? 'checked' : ''} /></td>
      <td class="px-3 py-3 font-medium">${escapeHtml(row.skuCode)}</td>
      <td class="px-3 py-3">${escapeHtml(row.colorName)} / ${escapeHtml(row.sizeCode)}</td>
      <td class="px-3 py-3 tabular-nums">${formatQty(row.remainingQty)} 件</td>
      <td class="px-3 py-3"><select class="h-9 min-w-[240px] rounded-md border bg-background px-3 text-sm" data-sewing-dispatch-field="dispatchFactoryForRow" data-row-id="${escapeHtml(row.rowId)}" data-skip-page-rerender="true"><option value="">请选择承接工厂</option>${factories.map((factory) => renderDispatchFactoryOption(factory, row, selectedFactoryId)).join('')}</select>${renderDispatchPolicyFeedback(row, selectedFactoryId)}</td>
    </tr>`
  }).join('')
}

function renderDirectDispatchDialog(tasks: SewingDispatchWorkbenchTask[]): string {
  const rows = getDispatchCandidateRows(tasks)
  const factories = listSewingFactoryOptions()
  const missingFactory = rows.some((row) => !state.dispatchFactoryIdByRowId[row.rowId])
  return `<div class="fixed inset-0 z-50" role="dialog" aria-modal="true">
    <button class="absolute inset-0 bg-black/40" data-sewing-dispatch-action="close-dispatch" data-skip-page-rerender="true" aria-label="关闭"></button>
    <section class="absolute left-1/2 top-1/2 max-h-[88vh] w-[min(900px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border bg-background shadow-xl">
      <header class="flex items-start justify-between border-b px-5 py-4"><div><h3 class="text-lg font-semibold">直接派单</h3><p class="mt-1 text-sm text-muted-foreground">为每个完整 SKU 选择一家承接工厂；同一个 SKU 不拆数量。</p></div><button class="rounded-md px-2 py-1 text-lg hover:bg-muted" data-sewing-dispatch-action="close-dispatch" data-skip-page-rerender="true">×</button></header>
      <div class="max-h-[calc(88vh-142px)] space-y-4 overflow-auto p-5">
        <label class="block max-w-sm space-y-1"><span class="text-sm font-medium">业务分配时间</span><input type="datetime-local" class="h-10 w-full rounded-md border bg-background px-3 text-sm" value="${escapeHtml(state.dispatchBusinessAssignedAt)}" data-sewing-dispatch-field="dispatchBusinessAssignedAt" data-skip-page-rerender="true" /><span class="block text-xs text-muted-foreground">可回填，但不能晚于提交时的当前时间；派单后工厂自动接单。</span></label>
        <section class="space-y-3"><div class="flex flex-wrap items-end justify-between gap-3"><div><div class="text-sm font-medium">SKU 与承接工厂</div><div class="mt-1 text-xs text-muted-foreground">勾选仅用于批量设置工厂，所有下列 SKU 均参与本次派单。</div></div><div class="flex items-end gap-2"><label class="space-y-1"><span class="block text-xs text-muted-foreground">批量承接工厂</span><select class="h-9 min-w-[220px] rounded-md border bg-background px-3 text-sm" data-sewing-dispatch-field="dispatchBatchFactoryId" data-skip-page-rerender="true"><option value="">请选择工厂</option>${factories.map((factory) => renderDispatchFactoryOption(factory, undefined, state.dispatchBatchFactoryId)).join('')}</select></label><button class="h-9 rounded-md border px-3 text-sm hover:bg-muted" data-sewing-dispatch-action="apply-batch-factory" data-skip-page-rerender="true">应用到已勾选 SKU</button></div></div>
          <div class="overflow-x-auto rounded-lg border"><table class="w-full min-w-[760px] text-sm"><thead><tr class="border-b bg-muted/40 text-xs text-muted-foreground"><th class="w-14 px-3 py-2">选择</th><th class="px-3 py-2 text-left">SKU</th><th class="px-3 py-2 text-left">颜色 / 尺码</th><th class="px-3 py-2 text-left">任务数量</th><th class="px-3 py-2 text-left">承接工厂</th></tr></thead><tbody data-sewing-dispatch-factory-rows>${renderDirectDispatchFactoryRows(rows)}</tbody></table></div>
        </section>
        ${renderDispatchMainFactoryChoices(rows)}
        ${renderDirectDispatchDeadlines(rows)}
        ${renderDispatchErrorRegion()}
      </div>
      <footer class="flex justify-end gap-2 border-t px-5 py-4"><button class="rounded-md border px-4 py-2 text-sm" data-sewing-dispatch-action="close-dispatch" data-skip-page-rerender="true">取消</button><button class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white ${rows.length === 0 || missingFactory ? 'cursor-not-allowed opacity-50' : ''}" data-sewing-dispatch-action="confirm-dispatch" data-skip-page-rerender="true" ${rows.length === 0 || missingFactory ? 'disabled' : ''}>确认派单</button></footer>
    </section>
  </div>`
}

function renderBiddingDialog(tasks: SewingDispatchWorkbenchTask[]): string {
  const rows = getDispatchCandidateRows(tasks)
  return `<div class="fixed inset-0 z-50" role="dialog" aria-modal="true"><button class="absolute inset-0 bg-black/40" data-sewing-dispatch-action="close-dispatch" data-skip-page-rerender="true" aria-label="关闭"></button><section class="absolute left-1/2 top-1/2 max-h-[82vh] w-[min(680px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border bg-background shadow-xl"><header class="flex items-start justify-between border-b px-5 py-4"><div><h3 class="text-lg font-semibold">发起竞价</h3><p class="mt-1 text-sm text-muted-foreground">所选完整 SKU 将进入竞价，定标后由工厂确认接单。</p></div><button class="rounded-md px-2 py-1 text-lg hover:bg-muted" data-sewing-dispatch-action="close-dispatch" data-skip-page-rerender="true">×</button></header><div class="max-h-[calc(82vh-142px)] space-y-4 overflow-auto p-5"><label class="block max-w-sm space-y-1"><span class="text-sm font-medium">业务分配时间</span><input type="datetime-local" class="h-10 w-full rounded-md border px-3 text-sm" value="${escapeHtml(state.dispatchBusinessAssignedAt)}" data-sewing-dispatch-field="dispatchBusinessAssignedAt" data-skip-page-rerender="true" /></label><div class="rounded-md border"><div class="border-b bg-muted/40 px-3 py-2 text-xs text-muted-foreground">参与竞价的 SKU</div>${rows.map((row) => `<div class="flex items-center justify-between gap-3 border-b px-3 py-2 text-sm last:border-b-0"><span>${escapeHtml(row.skuCode)} · ${escapeHtml(row.colorName)}/${escapeHtml(row.sizeCode)}</span><span class="font-medium">${formatQty(row.remainingQty)} 件</span></div>`).join('') || '<div class="px-3 py-8 text-center text-sm text-muted-foreground">暂无可竞价 SKU</div>'}</div>${renderDispatchErrorRegion()}</div><footer class="flex justify-end gap-2 border-t px-5 py-4"><button class="rounded-md border px-4 py-2 text-sm" data-sewing-dispatch-action="close-dispatch" data-skip-page-rerender="true">取消</button><button class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white ${rows.length === 0 ? 'cursor-not-allowed opacity-50' : ''}" data-sewing-dispatch-action="confirm-dispatch" data-skip-page-rerender="true" ${rows.length === 0 ? 'disabled' : ''}>确认发起竞价</button></footer></section></div>`
}

function renderDispatchDialog(tasks: SewingDispatchWorkbenchTask[]): string {
  if (!state.dispatchOpen) return ''
  return state.dispatchActionType === '直接派单' ? renderDirectDispatchDialog(tasks) : renderBiddingDialog(tasks)
}

function refreshSewingDispatchDialog(): void {
  if (typeof document === 'undefined') return
  const host = document.querySelector<HTMLElement>('[data-sewing-dispatch-dialog-host]')
  if (host) host.innerHTML = renderDispatchDialog(listSewingDispatchWorkbenchTasks())
}

function refreshSewingDispatchFactoryRows(): void {
  if (typeof document === 'undefined') return
  const region = document.querySelector<HTMLElement>('[data-sewing-dispatch-factory-rows]')
  if (region) region.innerHTML = renderDirectDispatchFactoryRows(getDispatchCandidateRows())
  refreshSewingDispatchMainFactoryRegion()
  refreshSewingDispatchErrorRegion()
}

function refreshSewingDispatchMainFactoryRegion(): void {
  if (typeof document === 'undefined') return
  const region = document.querySelector<HTMLElement>('[data-sewing-dispatch-main-factory-region]')
  if (region) region.outerHTML = renderDispatchMainFactoryChoices(getDispatchCandidateRows())
}

function refreshSewingDispatchDeadlineRegion(): void {
  if (typeof document === 'undefined') return
  const region = document.querySelector<HTMLElement>('[data-sewing-dispatch-deadline-region]')
  if (region) region.outerHTML = renderDirectDispatchDeadlines(getDispatchCandidateRows())
}

function refreshSewingDispatchErrorRegion(): void {
  if (typeof document === 'undefined') return
  const region = document.querySelector<HTMLElement>('[data-sewing-dispatch-error-region]')
  if (region) region.outerHTML = renderDispatchErrorRegion()
}

function renderDrafts(): string {
  const drafts = listSewingDispatchWorkbenchDrafts()
  if (drafts.length === 0) return ''
  return `
    <section class="rounded-lg border bg-card">
      <div class="border-b px-4 py-3"><h2 class="text-base font-semibold">分配演示记录</h2></div>
      <div class="divide-y">
        ${drafts.slice(0, 4).map((draft) => `
          <div class="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
            <div>
              <div class="font-medium">${escapeHtml(draft.draftId)} · ${escapeHtml(draft.actionType)}</div>
              <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(draft.skuSummary)} · ${formatQty(draft.qty)} 件 · ${escapeHtml(draft.factoryName || '待竞价')}</div>
            </div>
            ${renderBadge(draft.statusLabel, 'border-blue-200 bg-blue-50 text-blue-700')}
          </div>
        `).join('')}
      </div>
    </section>
  `
}

export function renderSewingDispatchWorkbenchPage(): string {
  if (!state.reassignQueryHandled && typeof window !== 'undefined') {
    state.reassignQueryHandled = true
    const query = new URLSearchParams(window.location.search)
    const taskId = query.get('action') === 'reassign' ? query.get('taskId') : null
    if (taskId && getRuntimeTaskById(taskId)) {
      const operatedAt = sewingDispatchNowProvider()
      state.reassignTaskId = taskId
      state.reassignOperatedAt = operatedAt
      state.reassignBusinessAssignedAt = operationWallClockToDateTimeLocal(operatedAt)
      const order = productionOrders.find((item) => item.productionOrderId === getRuntimeTaskById(taskId)?.productionOrderId)
      const currentStillActive = getRuntimeTaskById(taskId) && listRuntimeProcessTasks().some((candidate) => candidate.taskId !== taskId && candidate.productionOrderId === order?.productionOrderId && candidate.executionEnabled !== false && candidate.assignedFactoryId === order?.mainFactoryId)
      state.reassignMainFactoryId = currentStillActive ? order?.mainFactoryId ?? '' : ''
    }
  }
  const tasks = getFilteredTasks()
  const summary = summarizeSewingDispatchWorkbench(tasks)
  const detailTask = tasks.find((task) => task.taskId === state.detailTaskId)
  return `
    <div class="space-y-4" data-sewing-dispatch-page>
      <header class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 class="text-2xl font-bold">车缝分配工作台</h1>
          <p class="mt-0.5 text-sm text-muted-foreground">按车缝任务核对完整齐套数量、裁片单闭环、毛织片和唛架风险；SKU 明细进入任务内查看。</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button class="h-9 rounded-md border px-3 text-sm hover:bg-muted" data-nav="/fcs/dispatch/non-sewing">非车缝任务分配</button>
          <button class="h-9 rounded-md border px-3 text-sm hover:bg-muted" data-nav="/fcs/dispatch/tenders">招标单管理</button>
        </div>
      </header>
      <div class="grid gap-3 md:grid-cols-5">
        ${renderMetricCard('待分配车缝任务', `${summary.pendingTaskCount}`, '当前筛选范围内任务数')}
        ${renderMetricCard('SKU 明细', `${summary.skuRowCount}`, '任务内 SKU / 颜色 / 尺码')}
        ${renderMetricCard('完整齐套数量', `${formatQty(summary.completeKitQtyTotal)} 件`, '按任务汇总完整齐套数量', 'text-green-700')}
        ${renderMetricCard('裁片单已关闭任务', `${summary.cutOrderClosedTaskCount}`, '全部裁片单已关闭的车缝任务', 'text-blue-700')}
        ${renderMetricCard('跨生产单唛架', `${summary.crossMarkerPlanCount}`, '需要跟单关注承接节奏', 'text-orange-700')}
      </div>
      ${state.feedbackMessage ? `<section class="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">${escapeHtml(state.feedbackMessage)}</section>` : ''}
      ${renderFilters()}
      ${renderTaskTable(tasks)}
      ${renderDrafts()}
      ${renderDetailDrawer(detailTask)}
      <div data-sewing-dispatch-dialog-host>${renderDispatchDialog(tasks)}</div>
      <div data-sewing-reassignment-dialog-host>${renderReassignmentDialog()}</div>
    </div>
  `
}

function updateField(field: string, node: HTMLInputElement | HTMLSelectElement): void {
  if (field === 'keyword') {
    state.keyword = node.value
    state.page = 1
    return
  }
  if (field === 'kitFilter') {
    state.kitFilter = node.value as KitFilter
    state.page = 1
    return
  }
  if (field === 'gapFilter') {
    state.gapFilter = node.value as GapFilter
    state.page = 1
    return
  }
  if (field === 'markerFilter') {
    state.markerFilter = node.value as MarkerFilter
    state.page = 1
    return
  }
  if (field === 'pageSize') {
    const pageSize = Number(node.value)
    state.pageSize = Number.isFinite(pageSize) && pageSize > 0 ? pageSize : 10
    state.page = 1
    return
  }
  if (field === 'reassignFactoryId') state.reassignFactoryId = node.value
  if (field === 'reassignBusinessAssignedAt') state.reassignBusinessAssignedAt = node.value
  if (field === 'reassignReason') state.reassignReason = node.value
  if (field === 'reassignMainFactoryId') state.reassignMainFactoryId = node.value
  if (field === 'selectTask' && node instanceof HTMLInputElement) {
    const taskId = node.dataset.taskId
    if (!taskId) return
    if (node.checked) state.selectedTaskIds.add(taskId)
    else state.selectedTaskIds.delete(taskId)
    return
  }
  if (field === 'selectAll' && node instanceof HTMLInputElement) {
    const tasks = getFilteredTasks()
    const pageTasks = tasks.slice((state.page - 1) * state.pageSize, state.page * state.pageSize)
    if (node.checked) pageTasks.forEach((task) => state.selectedTaskIds.add(task.taskId))
    else pageTasks.forEach((task) => state.selectedTaskIds.delete(task.taskId))
    return
  }
  if (field === 'dispatchBatchFactoryId') {
    state.dispatchBatchFactoryId = node.value
    state.dispatchError = ''
    return
  }
  if (field === 'dispatchFactoryForRow') {
    const rowId = node.dataset.rowId
    if (rowId) state.dispatchFactoryIdByRowId[rowId] = node.value
    state.dispatchError = ''
    refreshSewingDispatchFactoryRows()
    return
  }
  if (field === 'dispatchRiskConfirmed' && node instanceof HTMLInputElement) {
    const factoryId = node.dataset.factoryId
    if (factoryId) state.dispatchRiskConfirmedByFactoryId[factoryId] = node.checked
    state.dispatchError = ''
    refreshSewingDispatchFactoryRows()
    return
  }
  if (field === 'dispatchSupervisorAssigned' && node instanceof HTMLInputElement) {
    const factoryId = node.dataset.factoryId
    if (factoryId) state.dispatchSupervisorAssignedByFactoryId[factoryId] = node.checked
    state.dispatchError = ''
    refreshSewingDispatchFactoryRows()
    return
  }
  if (field === 'dispatchMainFactory') {
    const productionOrderId = node.dataset.productionOrderId
    if (productionOrderId) state.dispatchMainFactoryIdByProductionOrderId[productionOrderId] = node.value
    state.dispatchError = ''
    refreshSewingDispatchErrorRegion()
    return
  }
  if (field === 'dispatchRowSelected' && node instanceof HTMLInputElement) {
    const rowId = node.dataset.rowId
    if (!rowId) return
    if (node.checked) state.dispatchSelectedRowIds.add(rowId)
    else state.dispatchSelectedRowIds.delete(rowId)
    state.dispatchError = ''
    refreshSewingDispatchFactoryRows()
    return
  }
  if (field === 'dispatchBusinessAssignedAt') {
    state.dispatchBusinessAssignedAt = node.value
    state.dispatchError = ''
    refreshSewingDispatchDeadlineRegion()
    refreshSewingDispatchErrorRegion()
  }
}

function openDispatch(taskId: string | undefined, type: string | undefined): void {
  if (taskId) state.selectedTaskIds = new Set([taskId])
  const selectedRows = getDispatchCandidateRows()
  state.dispatchActionType = type === '发起竞价' ? '发起竞价' : '直接派单'
  state.dispatchOpen = selectedRows.length > 0
  state.dispatchBatchFactoryId = ''
  state.dispatchFactoryIdByRowId = Object.fromEntries(selectedRows.map((row) => [row.rowId, '']))
  state.dispatchRiskConfirmedByFactoryId = {}
  state.dispatchSupervisorAssignedByFactoryId = {}
  state.dispatchSelectedRowIds = new Set(selectedRows.map((row) => row.rowId))
  state.dispatchMainFactoryIdByProductionOrderId = Object.fromEntries(Array.from(new Set(selectedRows.map((row) => row.productionOrderId))).map((productionOrderId) => {
    const order = productionOrders.find((item) => item.productionOrderId === productionOrderId)
    return [productionOrderId, order?.mainFactoryStatus === 'CONFIRMED' ? order.mainFactoryId ?? '' : '']
  }))
  state.dispatchOperatedAt = sewingDispatchNowProvider()
  state.dispatchBusinessAssignedAt = operationWallClockToDateTimeLocal(state.dispatchOperatedAt)
  state.dispatchError = ''
  state.feedbackMessage = ''
}

export function handleSewingDispatchWorkbenchEvent(target: HTMLElement, event?: Event): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-sewing-dispatch-field]')
  if (
    (typeof HTMLInputElement !== 'undefined' && fieldNode instanceof HTMLInputElement)
    || (typeof HTMLSelectElement !== 'undefined' && fieldNode instanceof HTMLSelectElement)
  ) {
    const field = fieldNode.dataset.sewingDispatchField
    if (!field) return true
    if (field === 'dispatchRowSelected' && event?.type === 'click') return false
    updateField(field, fieldNode)
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-sewing-dispatch-action]')
  if (!actionNode) return false
  const action = actionNode.dataset.sewingDispatchAction
  if (!action) return false

  if (action === 'query') {
    state.page = 1
    return true
  }
  if (action === 'reset') {
    state.keyword = ''
    state.kitFilter = '全部'
    state.gapFilter = '全部'
    state.markerFilter = '全部'
    state.page = 1
    state.selectedTaskIds = new Set<string>()
    return true
  }
  if (action === 'prev-page') {
    state.page = Math.max(1, state.page - 1)
    return true
  }
  if (action === 'next-page') {
    const pageCount = Math.max(1, Math.ceil(getFilteredTasks().length / state.pageSize))
    state.page = Math.min(pageCount, state.page + 1)
    return true
  }
  if (action === 'open-detail') {
    state.detailTaskId = actionNode.dataset.taskId || null
    return true
  }
  if (action === 'close-detail') {
    state.detailTaskId = null
    return true
  }
  if (action === 'open-dispatch') {
    openDispatch(actionNode.dataset.taskId, actionNode.dataset.dispatchType)
    refreshSewingDispatchDialog()
    return true
  }
  if (action === 'close-dispatch') {
    state.dispatchOpen = false
    refreshSewingDispatchDialog()
    return true
  }
  if (action === 'apply-batch-factory') {
    if (!state.dispatchBatchFactoryId) {
      state.dispatchError = '请先选择批量承接工厂。'
      refreshSewingDispatchErrorRegion()
      return true
    }
    for (const rowId of state.dispatchSelectedRowIds) state.dispatchFactoryIdByRowId[rowId] = state.dispatchBatchFactoryId
    state.dispatchError = ''
    refreshSewingDispatchFactoryRows()
    return true
  }
  if (action === 'close-reassign') {
    state.reassignTaskId = null
    return true
  }
  if (action === 'confirm-reassign') {
    const task = state.reassignTaskId ? getRuntimeTaskById(state.reassignTaskId) : null
    const factory = listSewingFactoryOptions().find((item) => item.id === state.reassignFactoryId)
    if (!task || !factory) { state.reassignError = '请选择目标工厂'; return true }
    try {
      const operatedAt = sewingDispatchNowProvider()
      const result = reassignRuntimeSewingTask({
        sourceTaskId: task.taskId,
        targetFactoryId: factory.id,
        targetFactoryName: factory.name,
        businessAssignedAt: dateTimeLocalToOperationWallClock(state.reassignBusinessAssignedAt),
        operatedAt,
        reason: state.reassignReason,
        by: '跟单A',
        mainFactoryId: state.reassignMainFactoryId || undefined,
        riskConfirmed: state.dispatchRiskConfirmedByFactoryId[factory.id] === true,
        supervisorAssigned: state.dispatchSupervisorAssignedByFactoryId[factory.id] === true,
      })
      if (!result.ok) throw new Error(result.message)
      state.feedbackMessage = `已改派给 ${factory.name}，剩余分配数量 ${formatQty(result.assignedQty || 0)} 件。`
      state.reassignTaskId = null
    } catch (error) {
      state.reassignError = error instanceof Error ? error.message : '改派失败'
      refreshSewingReassignmentDialog()
    }
    return true
  }
  if (action === 'confirm-dispatch') {
    const operatedAt = sewingDispatchNowProvider()
    const selectedRows = getSelectedDispatchRows()
    if (selectedRows.length === 0) {
      state.dispatchError = '请至少选择一个要分配的 SKU。'
      refreshSewingDispatchDialog()
      return true
    }
    const materialPrepChecks = getSewingMaterialPrepChecks(selectedRows)
    if (!isSewingMaterialPrepReady(materialPrepChecks)) {
      state.dispatchError = formatSewingMaterialPrepError(materialPrepChecks)
      refreshSewingDispatchDialog()
      return true
    }
    if (state.dispatchActionType === '直接派单') {
      const missingFactoryRow = selectedRows.find((row) => !state.dispatchFactoryIdByRowId[row.rowId])
      if (missingFactoryRow) {
        state.dispatchError = `${missingFactoryRow.skuCode} 需要选择承接工厂。`
        refreshSewingDispatchErrorRegion()
        return true
      }
    }
    let result: ReturnType<typeof createSewingDispatchWorkbenchDraft>
    try {
      const businessAssignedAt = dateTimeLocalToOperationWallClock(state.dispatchBusinessAssignedAt)
      const directDispatchFactoryIds = [...new Set(
        selectedRows
          .map((row) => state.dispatchFactoryIdByRowId[row.rowId])
          .filter((factoryId): factoryId is string => Boolean(factoryId)),
      )]
      result = createSewingDispatchWorkbenchDraft({
        actionType: state.dispatchActionType,
        rowIds: selectedRows.map((row) => row.rowId),
        factoryIdByRowId: state.dispatchActionType === '直接派单' ? Object.fromEntries(selectedRows.map((row) => [row.rowId, state.dispatchFactoryIdByRowId[row.rowId] ?? ''])) : undefined,
        policyContextByFactoryId: state.dispatchActionType === '直接派单'
          ? Object.fromEntries(directDispatchFactoryIds.map((factoryId) => [factoryId, {
              riskConfirmed: state.dispatchRiskConfirmedByFactoryId[factoryId] === true,
              supervisorAssigned: state.dispatchSupervisorAssignedByFactoryId[factoryId] === true,
            }]))
          : undefined,
        policyOverrideByRowId: Object.fromEntries(selectedRows.map((row) => [row.rowId, {
          documentTypeLabel: derivePageDispatchDocumentType(row),
          isUrgentOrder: isPageDispatchUrgent(row),
        }])),
        businessAssignedAt,
        operatedAt,
        mainFactoryIdByProductionOrderId: state.dispatchMainFactoryIdByProductionOrderId,
        by: '跟单A',
      })
    } catch (error) {
      state.dispatchError = error instanceof Error ? error.message : '业务分配时间格式不正确。'
      refreshSewingDispatchDialog()
      return true
    }
    const factoryCount = new Set(selectedRows.map((row) => state.dispatchFactoryIdByRowId[row.rowId]).filter(Boolean)).size
    state.feedbackMessage = result.ok && state.dispatchActionType === '直接派单'
      ? `已将 ${selectedRows.length} 个 SKU 派给 ${factoryCount} 家工厂，工厂已自动接单。`
      : result.message
    state.dispatchError = result.ok ? '' : result.message
    if (!result.ok) refreshSewingDispatchErrorRegion()
    if (result.ok) {
      state.dispatchOpen = false
      state.selectedTaskIds = new Set<string>()
      refreshSewingDispatchDialog()
    }
    return true
  }

  return false
}

export function isSewingDispatchWorkbenchDialogOpen(): boolean {
  return state.detailTaskId !== null || state.dispatchOpen || state.reassignTaskId !== null
}
