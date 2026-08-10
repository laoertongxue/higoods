// @page-pattern: detail
import {
  cancelLaceProductionOrder,
  completeLaceProduction,
  createLaceCompletionReport,
  createLaceHandover,
  getLaceProductionOrderView,
  listLaceCompletionReports,
  listLaceHandovers,
  listLaceOperationLogs,
  LACE_FACTORY_OPERATOR,
  LACE_FACTORY_SUPERVISOR,
  PLATFORM_ADMIN,
  restoreCancelledLaceProductionOrder,
  startLaceProduction,
  undoLaceProductionCompletion,
  updateLaceProcessingInputs,
  updateLaceCompletionReport,
  LaceDomainError,
  type CreateLaceCompletionCommand,
  type LaceActor,
  type LaceProductionOrderView,
  type LaceProcessingInputUpdate,
  type UpdateLaceCompletionCommand,
} from '../../../../data/fcs/lace-factory-domain.ts'
import { LACE_INPUT_MATERIAL_CATALOG } from '../../../../data/fcs/lace-factory-purchase-projection.ts'
import { renderTabs } from '../../../../components/ui/tabs.ts'
import { escapeHtml } from '../../../../utils.ts'
import {
  formatJakartaTime,
  formatLaceQty,
  handleLaceCommonImageEvent,
  hydrateLaceSurface,
  nextLaceClientActionId,
  readNumberField,
  readTextField,
  renderLaceBusinessImage,
  renderLaceFeedback,
  renderLaceImagePreview,
  renderLaceSourceStyles,
  renderLaceStatusBadge,
} from './shared.ts'
import {
  listExecutableLaceWorkOrderActions,
  type LaceWorkOrderAction,
  type LaceWorkOrderActionKey,
} from './work-order-action-policy.ts'

type DetailTab = 'production' | 'fulfillment' | 'logs'

type DetailOverlay =
  | { kind: 'input' }
  | { kind: 'report'; clientActionId: string }
  | { kind: 'edit-report'; reportId: string }
  | { kind: 'overproduction-confirm'; command: CreateLaceCompletionCommand | UpdateLaceCompletionCommand; mode: 'create' | 'edit' }
  | { kind: 'complete' }
  | { kind: 'undo-complete' }
  | { kind: 'handover'; clientActionId: string }
  | { kind: 'cancel' }
  | { kind: 'restore' }

const state: {
  workOrderId: string
  entryKey: string
  overlay: DetailOverlay | null
  overlayError: string
  feedback: string
  feedbackOk: boolean
  actorRole: '花边厂业务员' | '花边厂主管' | '平台主管'
  activeTab: DetailTab
} = {
  workOrderId: '',
  entryKey: '',
  overlay: null,
  overlayError: '',
  feedback: '',
  feedbackOk: true,
  actorRole: '花边厂业务员',
  activeTab: 'production',
}

const ROOT_SELECTOR = '[data-lace-work-order-detail-root]'
let detailEscapeBound = false

function ensureLaceDetailEscapeBinding(): void {
  if (detailEscapeBound || typeof document === 'undefined') return
  detailEscapeBound = true
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !state.overlay || !rootElement()) return
    state.overlay = null
    state.overlayError = ''
    refreshOverlays()
    event.preventDefault()
    event.stopImmediatePropagation()
  }, true)
}

function currentLaceDetailActor(): LaceActor {
  if (state.actorRole === '花边厂主管') return LACE_FACTORY_SUPERVISOR
  if (state.actorRole === '平台主管') return PLATFORM_ADMIN
  return LACE_FACTORY_OPERATOR
}

function currentActorQueryRole(): 'operator' | 'supervisor' | 'platform' {
  if (state.actorRole === '花边厂主管') return 'supervisor'
  if (state.actorRole === '平台主管') return 'platform'
  return 'operator'
}

function currentOrder(): LaceProductionOrderView | undefined {
  return getLaceProductionOrderView(state.workOrderId, currentLaceDetailActor())
}

function productionTone(status: LaceProductionOrderView['status']): 'blue' | 'green' | 'red' | 'slate' {
  if (status === '加工中') return 'blue'
  if (status === '已完结') return 'green'
  if (status === '已取消') return 'red'
  return 'slate'
}

function detailActionName(action: LaceWorkOrderActionKey): string {
  const mapping: Partial<Record<LaceWorkOrderActionKey, string>> = {
    'start-production': 'start-production',
    'report-completion': 'open-report',
    'complete-production': 'open-complete',
    handover: 'open-handover',
    'undo-completion': 'open-undo-complete',
    'cancel-order': 'open-cancel',
    'restore-order': 'open-restore',
  }
  return mapping[action] ?? ''
}

function detailActionClass(action: LaceWorkOrderAction): string {
  if (action.tone === 'primary') return 'border-blue-600 bg-blue-600 text-white hover:bg-blue-700'
  if (action.tone === 'warning') return 'border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100'
  if (action.tone === 'success') return 'border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700'
  if (action.tone === 'danger') return 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100'
  return 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
}

function renderHeaderActions(order: LaceProductionOrderView): string {
  return listExecutableLaceWorkOrderActions(order, currentLaceDetailActor(), false)
    .map((action) => `<button type="button" class="rounded-md border px-3 py-2 text-sm font-medium ${detailActionClass(action)}" data-lace-detail-action="${escapeHtml(detailActionName(action.key))}" data-skip-page-rerender="true">${escapeHtml(action.label)}</button>`)
    .join('')
}

function renderChangeBanner(order: LaceProductionOrderView): string {
  const pending = order.purchaseChangeStatus === '待查看'
  const classes = pending
    ? 'border-amber-300 bg-amber-50 text-amber-950'
    : 'border-slate-200 bg-slate-50 text-slate-700'
  const title = pending ? `采购单 ${order.purchaseOrderNo} 已变更，当前待查看` : `采购单 ${order.purchaseOrderNo} 变更状态：${order.purchaseChangeStatus}`
  const description = pending
    ? `当前生产单已同步到采购 V${order.purchaseVersion}。请先查看前后值及数量影响；查看仅代表已读，不表示审批或接受。`
    : `当前生产单读取采购 V${order.purchaseVersion}；生产、交出和收货状态仍独立计算。`
  return `<section class="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3 ${classes}" data-lace-detail-section="purchase-change-banner"><div><strong>${escapeHtml(title)}</strong><p class="mt-1 text-xs">${escapeHtml(description)}</p></div><button type="button" class="rounded-md border bg-white px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-50" data-nav="/fcs/craft/accessory/lace/purchase-demands?actor=${encodeURIComponent(currentActorQueryRole())}&viewChange=1&purchaseOrderId=${encodeURIComponent(order.purchaseOrderId)}">查看采购变更</button></section>`
}

function renderInputSection(order: LaceProductionOrderView): string {
  const rows = order.inputLines.length > 0
    ? order.inputLines.map((line) => `<article class="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 first:border-t-0"><div class="flex items-center gap-3">${renderLaceBusinessImage(line.imageUrl, `${line.inputMaterialName}（${line.inputMaterialSku}）实物图`, 'h-11 w-11')}<div><div class="font-medium">${escapeHtml(line.inputMaterialName)}</div><div class="text-xs text-slate-500">${escapeHtml(line.inputMaterialSku)} · ${escapeHtml(line.specification)} · ${escapeHtml(line.color)}</div></div></div><div class="grid min-w-[22rem] grid-cols-2 gap-3 text-sm"><div><span class="block text-xs text-slate-500">单位用量</span><strong>${line.unitUsage} ${escapeHtml(line.unit)}/${escapeHtml(order.unit)}</strong></div><div><span class="block text-xs text-slate-500">计划投入</span><strong>${formatLaceQty(order.planQty, order.unit)} × ${line.unitUsage} = ${formatLaceQty(line.plannedQty, line.unit)}</strong></div></div></article>`).join('')
    : '<div class="px-4 py-6 text-sm text-red-800"><strong>默认加工投入缺失</strong><p class="mt-1">该异常应在自动生成前被拦截，请返回采购需求处理生成异常。</p></div>'
  const canEdit = ['待接收', '加工中'].includes(order.status)
  const action = canEdit ? '<button type="button" class="rounded-md border px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-50" data-lace-detail-action="open-input" data-skip-page-rerender="true">修改加工投入</button>' : '<span class="text-xs text-slate-500">已完结或已取消时不可修改</span>'
  return `<section class="overflow-hidden rounded-lg border bg-white" data-lace-detail-section="processing-input"><header class="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3"><div><h2 class="font-semibold">加工投入</h2><p class="mt-1 text-xs text-slate-500">系统已按默认用料关系带入；例外时只允许修改投入 SKU 和单位用量，计划投入自动计算。</p></div>${action}</header>${rows}</section>`
}

function renderSourceSection(order: LaceProductionOrderView): string {
  const source = order.demandSource
  return `<section class="rounded-lg border bg-white"><header class="border-b px-4 py-3"><h2 class="font-semibold">需求来源</h2><p class="mt-1 text-xs text-slate-500">来源快照只读，由 PMS 采购事实同步；同一采购单 SKU 的多个款式来源仍合并为一张生产单。</p></header><div class="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4"><div><span class="text-xs text-slate-500">采购单／版本</span><div class="mt-1 font-medium">${escapeHtml(source.purchaseOrderNo)} · V${source.purchaseVersion}</div><div class="text-xs text-slate-500">采购员：${escapeHtml(source.buyerName)}</div></div><div><span class="text-xs text-slate-500">供应商／花边厂</span><div class="mt-1 font-medium">${escapeHtml(source.supplierName)}</div><div class="text-xs text-slate-500">${escapeHtml(source.factoryName)}</div></div><div><span class="text-xs text-slate-500">采购数量／交期</span><div class="mt-1 font-medium">${formatLaceQty(source.planQty, source.unit)}</div><div class="text-xs text-slate-500">${escapeHtml(source.dueDate)}</div></div><div><span class="text-xs text-slate-500">目标仓库</span><div class="mt-1 font-medium">${escapeHtml(source.targetWarehouseName)}</div></div><div class="sm:col-span-2"><span class="text-xs text-slate-500">全部关联款式</span><div class="mt-2">${renderLaceSourceStyles(source.sourceLines, 'h-14 w-14')}</div></div><div class="sm:col-span-2"><span class="text-xs text-slate-500">来源行／采购备注</span><div class="mt-1 text-sm">${escapeHtml(source.sourceLineIds.join('、'))}</div><div class="mt-1 text-sm text-slate-600">${escapeHtml(source.sourceNote || '无')}</div></div></div><div class="flex flex-wrap items-center justify-between gap-3 border-t bg-slate-50 px-4 py-3"><div>${order.purchaseChangeStatus === '待查看' ? renderLaceStatusBadge('采购已变更 · 待查看', 'yellow') : order.purchaseChangeStatus === '已查看' ? renderLaceStatusBadge('采购变更 · 已查看', 'slate') : renderLaceStatusBadge('无新变更', 'slate')}</div><button type="button" class="text-sm font-medium text-blue-700 hover:underline" data-nav="/fcs/craft/accessory/lace/purchase-demands?actor=${encodeURIComponent(currentActorQueryRole())}&viewChange=1&purchaseOrderId=${encodeURIComponent(order.purchaseOrderId)}">查看该采购单完整变更</button></div></section>`
}

function renderOutputSection(order: LaceProductionOrderView): string {
  const output = order.processingOutput
  return `<section class="rounded-lg border bg-white"><header class="border-b px-4 py-3"><h2 class="font-semibold">加工产出</h2><p class="mt-1 text-xs text-slate-500">本生产单只对应当前采购 SKU；完工、交出和中央仓实收分别累计。</p></header><div class="flex flex-col gap-5 p-4 lg:flex-row lg:items-center"><div class="flex min-w-[18rem] items-center gap-4">${renderLaceBusinessImage(output.materialImageUrl, `${output.materialName}（${output.skuCode}）实物图`, 'h-20 w-20')}<div><div class="font-semibold">${escapeHtml(output.materialName)}</div><div class="text-sm text-slate-500">${escapeHtml(output.skuCode)}</div><div class="mt-1 text-sm">${escapeHtml(output.specification)} · ${escapeHtml(output.color)}</div></div></div><div class="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-5"><div class="rounded-md bg-slate-50 p-3"><span class="text-xs text-slate-500">计划数量</span><strong class="mt-1 block">${formatLaceQty(output.planQty, output.unit)}</strong></div><div class="rounded-md bg-blue-50 p-3"><span class="text-xs text-blue-700">累计完工</span><strong class="mt-1 block text-blue-900">${formatLaceQty(order.completedQty, output.unit)}</strong></div><div class="rounded-md bg-emerald-50 p-3"><span class="text-xs text-emerald-700">累计交出</span><strong class="mt-1 block text-emerald-900">${formatLaceQty(order.handedOverQty, output.unit)}</strong></div><div class="rounded-md bg-violet-50 p-3"><span class="text-xs text-violet-700">累计实收</span><strong class="mt-1 block text-violet-900">${formatLaceQty(order.receivedQty, output.unit)}</strong></div><div class="rounded-md bg-amber-50 p-3"><span class="text-xs text-amber-700">剩余可交出</span><strong class="mt-1 block text-amber-900">${formatLaceQty(order.remainingHandoverQty, output.unit)}</strong></div></div></div><div class="flex flex-wrap gap-2 border-t px-4 py-3">${renderLaceStatusBadge(`生产：${order.status}`, productionTone(order.status))}${renderLaceStatusBadge(`交出：${order.handoverStatus}`, order.handoverStatus === '已全部交出' ? 'green' : order.handoverStatus === '部分交出' ? 'yellow' : 'slate')}${renderLaceStatusBadge(`收货：${order.receiptStatus}`, order.receiptStatus === '已收货' ? 'green' : order.receiptStatus === '部分收货' ? 'yellow' : 'slate')}${order.hasReceiptDifference ? renderLaceStatusBadge('存在收货差异', 'red') : ''}</div></section>`
}

function renderCompletionRecords(order: LaceProductionOrderView): string {
  const reports = listLaceCompletionReports(order.workOrderId, currentLaceDetailActor())
  return `<section class="overflow-hidden rounded-lg border bg-white"><header class="flex items-center justify-between border-b px-4 py-3"><div><h2 class="font-semibold">加工填报记录</h2><p class="mt-1 text-xs text-slate-500">多次填报累计完工为 ${formatLaceQty(order.completedQty, order.unit)}；记录不物理删除。</p></div></header><div class="overflow-x-auto"><table class="w-full min-w-[760px] text-left text-sm"><thead class="bg-slate-50 text-xs text-slate-500"><tr><th class="px-4 py-3">记录号</th><th class="px-4 py-3">本次完工</th><th class="px-4 py-3">填报人／时间</th><th class="px-4 py-3">备注</th><th class="px-4 py-3">修改历史</th><th class="px-4 py-3">操作</th></tr></thead><tbody>${reports.length ? reports.map((report) => `<tr class="border-t"><td class="px-4 py-3 font-mono text-xs">${escapeHtml(report.reportId)}</td><td class="px-4 py-3 font-semibold">${formatLaceQty(report.qty, report.unit)}</td><td class="px-4 py-3"><div>${escapeHtml(report.reporterName)}</div><div class="text-xs text-slate-500">${formatJakartaTime(report.reportedAt)}</div></td><td class="px-4 py-3">${escapeHtml(report.note || '—')}</td><td class="px-4 py-3 text-xs">${report.revisions.length ? report.revisions.map((revision) => `${formatLaceQty(revision.previousQty, report.unit)} → ${formatLaceQty(revision.revisedQty, report.unit)}｜${revision.reason}`).join('<br>') : '无'}</td><td class="px-4 py-3">${order.status === '加工中' ? `<button type="button" class="rounded-md border px-2 py-1 text-xs hover:bg-slate-50" data-lace-detail-action="open-edit-report" data-report-id="${escapeHtml(report.reportId)}" data-skip-page-rerender="true">修改</button>` : '<span class="text-xs text-slate-400">当前状态已锁定</span>'}</td></tr>`).join('') : '<tr><td colspan="6" class="px-4 py-10 text-center text-slate-500">暂无加工填报</td></tr>'}</tbody></table></div></section>`
}

function renderHandoverRecords(order: LaceProductionOrderView): string {
  const handovers = listLaceHandovers(order.workOrderId, currentLaceDetailActor())
  return `<section class="overflow-hidden rounded-lg border bg-white"><header class="border-b px-4 py-3"><h2 class="font-semibold">交出记录</h2><p class="mt-1 text-xs text-slate-500">每次成功交出生成一条独立记录；一次性交出全部也只有一条。</p></header><div class="overflow-x-auto"><table class="w-full min-w-[900px] text-left text-sm"><thead class="bg-slate-50 text-xs text-slate-500"><tr><th class="px-4 py-3">交出单</th><th class="px-4 py-3">本次／前后累计</th><th class="px-4 py-3">双方</th><th class="px-4 py-3">包装／送货</th><th class="px-4 py-3">时间</th><th class="px-4 py-3">下游</th></tr></thead><tbody>${handovers.length ? handovers.map((handover) => `<tr class="border-t"><td class="px-4 py-3 font-medium">${escapeHtml(handover.handoverNo)}</td><td class="px-4 py-3"><strong>${formatLaceQty(handover.qty, handover.unit)}</strong><div class="text-xs text-slate-500">${formatLaceQty(handover.cumulativeBefore, handover.unit)} → ${formatLaceQty(handover.cumulativeAfter, handover.unit)}</div></td><td class="px-4 py-3"><div>${escapeHtml(handover.fromFactoryName)}</div><div class="text-xs text-slate-500">→ ${escapeHtml(handover.toWarehouseName)}</div></td><td class="px-4 py-3"><div>${escapeHtml(handover.deliveryNo)} · ${handover.packageCount} 包</div><div class="text-xs text-slate-500">${escapeHtml(handover.packageNote || '无')}</div></td><td class="px-4 py-3">${formatJakartaTime(handover.handedOverAt)}</td><td class="px-4 py-3">${renderLaceStatusBadge(handover.receiptStatus, handover.receiptStatus === '已收货' ? 'green' : 'yellow')}</td></tr>`).join('') : '<tr><td colspan="6" class="px-4 py-10 text-center text-slate-500">暂无交出记录</td></tr>'}</tbody></table></div></section>`
}

function renderLogs(order: LaceProductionOrderView): string {
  const logs = listLaceOperationLogs({ workOrderId: order.workOrderId })
  return `<section class="overflow-hidden rounded-lg border bg-white" data-lace-detail-section="operation-logs"><header class="border-b px-4 py-3"><h2 class="font-semibold">操作日志（${logs.length}）</h2><p class="mt-1 text-xs text-slate-500">按时间倒序展示完整操作事实，日志只读且不可删除。</p></header><div class="max-h-[36rem] overflow-y-auto">${logs.map((log) => `<article class="grid gap-2 border-b px-4 py-3 text-sm last:border-b-0 md:grid-cols-[160px_220px_1fr]"><div><strong>${escapeHtml(log.action)}</strong><div class="text-xs text-slate-500">${escapeHtml(log.objectType)} · ${escapeHtml(log.objectId)}</div></div><div><span>${escapeHtml(log.actorName)}</span><div class="text-xs text-slate-500">${escapeHtml(log.actorRole)} · ${escapeHtml(log.actorOrgId)}</div><div class="text-xs text-slate-500">${formatJakartaTime(log.occurredAt, true)} · ${escapeHtml(log.timeZone)}</div></div><div><div>${escapeHtml(log.beforeValue)} → ${escapeHtml(log.afterValue)}</div><div class="mt-1 text-xs text-slate-500">原因：${escapeHtml(log.reason || '—')} · 来源：${escapeHtml(log.source)}</div><div class="mt-1 text-xs text-slate-500">关联：${escapeHtml(log.relatedObjectType)} · ${escapeHtml(log.relatedObjectId)}${log.relatedPurchaseVersion ? ` · 采购 V${log.relatedPurchaseVersion}` : ''} · 二次确认：${escapeHtml(log.secondConfirmation)}</div></div></article>`).join('')}</div></section>`
}

function dialog(title: string, body: string, submitAction: string, submitLabel: string, submitTone = 'blue'): string {
  return `<div class="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4" role="dialog" aria-modal="true"><section class="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-xl bg-white shadow-2xl"><header class="flex items-center justify-between border-b px-5 py-4"><h2 class="font-semibold">${escapeHtml(title)}</h2><button type="button" class="rounded-md border px-3 py-1.5 text-sm" data-lace-detail-action="close-overlay" data-skip-page-rerender="true">关闭</button></header><div class="max-h-[68vh] overflow-y-auto p-5"><div data-lace-detail-overlay-error>${state.overlayError ? `<div class="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">${escapeHtml(state.overlayError)}</div>` : ''}</div>${body}<p class="mt-4 text-xs text-slate-500">未看到成功提示即表示本次未保存；网络恢复或修正内容后，可保留当前单据重新提交。</p></div><footer class="flex justify-end gap-2 border-t px-5 py-4"><button type="button" class="rounded-md border px-4 py-2 text-sm" data-lace-detail-action="close-overlay" data-skip-page-rerender="true">取消</button><button type="button" class="rounded-md px-4 py-2 text-sm font-medium text-white ${submitTone === 'red' ? 'bg-red-600 hover:bg-red-700' : submitTone === 'green' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'}" data-lace-detail-action="${escapeHtml(submitAction)}" data-skip-page-rerender="true">${escapeHtml(submitLabel)}</button></footer></section></div>`
}

function renderInputMaintenanceBody(order: LaceProductionOrderView): string {
  const options = LACE_INPUT_MATERIAL_CATALOG.map((material) => `<option value="${escapeHtml(material.inputMaterialId)}">${escapeHtml(material.inputMaterialSku)} · ${escapeHtml(material.inputMaterialName)} · ${escapeHtml(material.unit)}</option>`).join('')
  const rows = order.inputLines.map((line) => `<article class="rounded-md border p-3" data-lace-input-row data-current-input-material-id="${escapeHtml(line.inputMaterialId)}">
    <div class="flex items-start gap-3">${renderLaceBusinessImage(line.imageUrl, `${line.inputMaterialName}（${line.inputMaterialSku}）实物图`, 'h-12 w-12')}<div><strong class="block">${escapeHtml(line.inputMaterialName)}</strong><span class="text-xs text-slate-500">当前 ${escapeHtml(line.inputMaterialSku)} · ${escapeHtml(line.specification)} · ${escapeHtml(line.color)}</span></div></div>
    <div class="mt-3 grid gap-3 sm:grid-cols-2">
      <label><span class="mb-1 block text-xs text-slate-500">投入 SKU</span><select class="h-9 w-full rounded-md border bg-white px-3 text-sm" data-lace-input-material>${options.replace(`value="${escapeHtml(line.inputMaterialId)}"`, `value="${escapeHtml(line.inputMaterialId)}" selected`)}</select></label>
      <label><span class="mb-1 block text-xs text-slate-500">单位用量</span><div class="flex items-center gap-2"><input type="number" min="0.0001" step="0.0001" class="h-9 w-full rounded-md border px-3" value="${line.unitUsage}" data-lace-input-unit-usage><span class="whitespace-nowrap text-sm text-slate-500">投入单位／${escapeHtml(order.unit)}</span></div></label>
    </div>
    <p class="mt-2 text-xs text-slate-500">当前计划：${formatLaceQty(order.planQty, order.unit)} × ${line.unitUsage} = ${formatLaceQty(line.plannedQty, line.unit)}；保存后按新 SKU 基础单位与新单位用量自动重算。</p>
  </article>`).join('')
  const catalog = LACE_INPUT_MATERIAL_CATALOG.map((material) => `<div class="flex items-center gap-2 rounded-md border bg-slate-50 p-2">${renderLaceBusinessImage(material.imageUrl, `${material.inputMaterialName}（${material.inputMaterialSku}）实物图`, 'h-9 w-9')}<div><div class="text-xs font-medium">${escapeHtml(material.inputMaterialName)}</div><div class="text-[11px] text-slate-500">${escapeHtml(material.inputMaterialSku)} · ${escapeHtml(material.unit)}</div></div></div>`).join('')
  return `<p class="mb-4 text-sm text-slate-600">默认投入已经带入；如需例外调整，请仅修改投入 SKU 或单位用量，原有投入行数保持不变。</p><div class="space-y-3">${rows}</div><div class="mt-4"><div class="mb-2 text-xs font-medium text-slate-600">可选投入物料档案</div><div class="grid gap-2 sm:grid-cols-2">${catalog}</div></div><label class="mt-4 block"><span class="mb-1 block text-xs text-slate-500">修改原因</span><textarea class="min-h-20 w-full rounded-md border p-3" data-lace-detail-field="inputReason" placeholder="必填；只用于操作日志"></textarea></label>`
}

function renderOverlay(order: LaceProductionOrderView): string {
  if (!state.overlay) return ''
  if (state.overlay.kind === 'input') {
    return dialog('修改加工投入', renderInputMaintenanceBody(order), 'save-input', '保存修改')
  }
  if (state.overlay.kind === 'report') {
    return dialog('加工填报', `<div class="grid gap-4 sm:grid-cols-2"><label><span class="mb-1 block text-xs text-slate-500">本次完工数量</span><div class="flex items-center gap-2"><input type="number" min="0.01" step="0.01" class="h-9 w-full rounded-md border px-3" data-lace-detail-field="reportQty"><span>${escapeHtml(order.unit)}</span></div></label><label><span class="mb-1 block text-xs text-slate-500">填报人</span><input class="h-9 w-full rounded-md border bg-slate-50 px-3" value="${escapeHtml(currentLaceDetailActor().actorName)}" disabled></label></div><label class="mt-4 block"><span class="mb-1 block text-xs text-slate-500">备注</span><textarea class="min-h-20 w-full rounded-md border p-3" data-lace-detail-field="reportNote"></textarea></label><p class="mt-3 text-xs text-slate-500">提交后累计达到或超过计划的 1.5 倍时，系统会再弹出一次确认；少产和普通超产不限制。</p>`, 'save-report', '保存加工填报')
  }
  if (state.overlay.kind === 'edit-report') {
    const reportId = state.overlay.reportId
    const report = listLaceCompletionReports(order.workOrderId, currentLaceDetailActor()).find((item) => item.reportId === reportId)
    if (!report) return ''
    return dialog('修改加工填报', `<label class="block"><span class="mb-1 block text-xs text-slate-500">修改后数量</span><div class="flex items-center gap-2"><input type="number" min="0.01" step="0.01" class="h-9 w-full rounded-md border px-3" value="${report.qty}" data-lace-detail-field="reportQty"><span>${escapeHtml(order.unit)}</span></div></label><label class="mt-4 block"><span class="mb-1 block text-xs text-slate-500">修改原因</span><textarea class="min-h-20 w-full rounded-md border p-3" data-lace-detail-field="revisionReason" placeholder="必填；日志保留修改前后值"></textarea></label>`, 'save-edit-report', '保存修改')
  }
  if (state.overlay.kind === 'overproduction-confirm') {
    const overlay = state.overlay
    const submittedQty = overlay.command.qty
    const resulting = overlay.mode === 'create'
      ? order.completedQty + (overlay.command as CreateLaceCompletionCommand).qty
      : order.completedQty - (listLaceCompletionReports(order.workOrderId, currentLaceDetailActor()).find((item) => item.reportId === (overlay.command as UpdateLaceCompletionCommand).reportId)?.qty ?? 0) + (overlay.command as UpdateLaceCompletionCommand).qty
    const excessQty = Math.max(0, resulting - order.planQty)
    const ratio = order.planQty > 0 ? `${((resulting / order.planQty) * 100).toFixed(2)}%` : '—'
    return dialog('超量完工二次确认', `<div class="rounded-md border border-amber-300 bg-amber-50 p-4 text-amber-950"><strong>累计完工达到计划的 1.5 倍，请核对后再保存</strong><div class="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3"><div><span class="block text-xs text-amber-800">计划数量</span><strong>${formatLaceQty(order.planQty, order.unit)}</strong></div><div><span class="block text-xs text-amber-800">提交前累计完工</span><strong>${formatLaceQty(order.completedQty, order.unit)}</strong></div><div><span class="block text-xs text-amber-800">本次完工数量</span><strong>${formatLaceQty(submittedQty, order.unit)}</strong></div><div><span class="block text-xs text-amber-800">提交后累计完工</span><strong>${formatLaceQty(resulting, order.unit)}</strong></div><div><span class="block text-xs text-amber-800">超出计划数量</span><strong>${formatLaceQty(excessQty, order.unit)}</strong></div><div><span class="block text-xs text-amber-800">相对计划比例</span><strong>${ratio}</strong></div></div><p class="mt-3 text-sm">确认业务数量无误后仍可保存；本动作不增加审批状态。</p></div>`, 'confirm-overproduction', '仍要提交')
  }
  if (state.overlay.kind === 'complete') {
    const completionDifference = order.completedQty - order.planQty
    const differenceText = completionDifference === 0 ? `一致 0 ${order.unit}` : completionDifference > 0 ? `多产 ${formatLaceQty(completionDifference, order.unit)}` : `少产 ${formatLaceQty(Math.abs(completionDifference), order.unit)}`
    return dialog('完成加工单', `<div class="rounded-md border bg-slate-50 p-3 text-sm"><div class="grid grid-cols-2 gap-3 sm:grid-cols-5"><div><span class="block text-xs text-slate-500">计划数量</span><strong>${formatLaceQty(order.planQty, order.unit)}</strong></div><div><span class="block text-xs text-slate-500">累计完工</span><strong>${formatLaceQty(order.completedQty, order.unit)}</strong></div><div><span class="block text-xs text-slate-500">累计交出</span><strong>${formatLaceQty(order.handedOverQty, order.unit)}</strong></div><div><span class="block text-xs text-slate-500">剩余可交出</span><strong>${formatLaceQty(order.remainingHandoverQty, order.unit)}</strong></div><div><span class="block text-xs text-slate-500">完工差异</span><strong>${differenceText}</strong></div></div><p class="mt-3 text-slate-600">少产、等量和超产都可完成加工单；完成后进入已完结并锁定新增加工填报，但仍可交出剩余有效完工数量。</p></div><label class="mt-4 block"><span class="mb-1 block text-xs text-slate-500">完成备注</span><textarea class="min-h-20 w-full rounded-md border p-3" data-lace-detail-field="completeReason"></textarea></label>`, 'save-complete', '确认完成')
  }
  if (state.overlay.kind === 'undo-complete') {
    return dialog('撤销完成二次确认', '<p class="mb-4 text-sm text-slate-600">撤销后回到加工中；历史完工、交出和收货事实不会回滚。本次“确认撤销”将作为主管二次确认写入日志。</p><label class="block"><span class="mb-1 block text-xs text-slate-500">撤销原因</span><textarea class="min-h-20 w-full rounded-md border p-3" data-lace-detail-field="undoReason" placeholder="必填"></textarea></label>', 'save-undo-complete', '确认撤销')
  }
  if (state.overlay.kind === 'handover') {
    return dialog('发起交出', `<div class="mb-4 rounded-md border bg-slate-50 p-3 text-sm">累计完工 ${formatLaceQty(order.completedQty, order.unit)} · 已交出 ${formatLaceQty(order.handedOverQty, order.unit)} · <strong>剩余可交出 ${formatLaceQty(order.remainingHandoverQty, order.unit)}</strong></div><div class="grid gap-4 sm:grid-cols-2"><label><span class="mb-1 block text-xs text-slate-500">本次交出数量</span><div class="flex items-center gap-2"><input type="number" min="0.01" max="${order.remainingHandoverQty}" step="0.01" class="h-9 w-full rounded-md border px-3" value="${order.remainingHandoverQty}" data-lace-detail-field="handoverQty"><span>${escapeHtml(order.unit)}</span></div></label><label><span class="mb-1 block text-xs text-slate-500">送货单号</span><input class="h-9 w-full rounded-md border px-3" value="RJ-SJ-${Date.now().toString().slice(-5)}" data-lace-detail-field="deliveryNo"></label><label><span class="mb-1 block text-xs text-slate-500">包装数量（包）</span><input type="number" min="1" step="1" class="h-9 w-full rounded-md border px-3" value="1" data-lace-detail-field="packageCount"></label><label><span class="mb-1 block text-xs text-slate-500">预计接收方</span><input class="h-9 w-full rounded-md border px-3" value="中央辅料仓" data-lace-detail-field="receiverName"></label></div><label class="mt-4 block"><span class="mb-1 block text-xs text-slate-500">包装说明</span><textarea class="min-h-20 w-full rounded-md border p-3" data-lace-detail-field="packageNote">防潮袋封装，外贴采购单与 SKU 标签</textarea></label>`, 'save-handover', '确认交出', 'green')
  }
  if (state.overlay.kind === 'cancel') {
    const hasDownstream = order.handedOverQty > 0
    return dialog('取消花边生产单', `<p class="mb-4 text-sm text-slate-600">取消生产单由花边厂主管执行。</p>${hasDownstream ? '<div class="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">该生产单已有交出或收货事实，第一阶段禁止直接取消。</div>' : order.status !== '待接收' ? '<div class="mb-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">该生产单已经进入加工，必须由花边厂主管二次确认；既有加工填报事实不会删除。</div>' : ''}<label class="block"><span class="mb-1 block text-xs text-slate-500">取消原因</span><textarea class="min-h-20 w-full rounded-md border p-3" data-lace-detail-field="cancelReason" placeholder="必填"></textarea></label>${order.status !== '待接收' ? '<label class="mt-4 flex items-start gap-2 rounded-md border p-3 text-sm"><input type="checkbox" class="mt-0.5" data-lace-detail-field="cancelConfirmed"><span>花边厂主管已复核，确认取消该已进入加工的生产单。</span></label>' : ''}`, 'save-cancel', '确认取消', 'red')
  }
  return dialog('恢复误取消生产单', '<p class="mb-4 text-sm text-slate-600">恢复原生产单和原唯一键，不会重新生成第二张生产单。此动作仅平台主管可执行。</p><label class="block"><span class="mb-1 block text-xs text-slate-500">恢复原因</span><textarea class="min-h-20 w-full rounded-md border p-3" data-lace-detail-field="restoreReason" placeholder="必填"></textarea></label>', 'save-restore', '确认恢复')
}

function renderOverlays(order: LaceProductionOrderView): string {
  return `${renderOverlay(order)}${renderLaceImagePreview()}`
}

function renderPersistentSummary(order: LaceProductionOrderView): string {
  return `<section class="rounded-lg border bg-white p-4" data-lace-detail-summary><div class="flex flex-wrap items-center gap-2">${renderLaceStatusBadge(`生产：${order.status}`, productionTone(order.status))}${renderLaceStatusBadge(`交出：${order.handoverStatus}`, order.handoverStatus === '已全部交出' ? 'green' : order.handoverStatus === '部分交出' ? 'yellow' : 'slate')}${renderLaceStatusBadge(`收货：${order.receiptStatus}`, order.receiptStatus === '已收货' ? 'green' : order.receiptStatus === '部分收货' ? 'yellow' : 'slate')}${order.hasReceiptDifference ? renderLaceStatusBadge('存在收货差异', 'red') : ''}</div><div class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"><div class="rounded-md bg-slate-50 p-3"><span class="text-xs text-slate-500">计划数量</span><strong class="mt-1 block tabular-nums">${formatLaceQty(order.planQty, order.unit)}</strong></div><div class="rounded-md bg-blue-50 p-3"><span class="text-xs text-blue-700">累计完工</span><strong class="mt-1 block tabular-nums text-blue-900">${formatLaceQty(order.completedQty, order.unit)}</strong></div><div class="rounded-md bg-emerald-50 p-3"><span class="text-xs text-emerald-700">累计交出</span><strong class="mt-1 block tabular-nums text-emerald-900">${formatLaceQty(order.handedOverQty, order.unit)}</strong></div><div class="rounded-md bg-violet-50 p-3"><span class="text-xs text-violet-700">累计实收</span><strong class="mt-1 block tabular-nums text-violet-900">${formatLaceQty(order.receivedQty, order.unit)}</strong></div><div class="rounded-md bg-amber-50 p-3"><span class="text-xs text-amber-700">剩余可交出</span><strong class="mt-1 block tabular-nums text-amber-900">${formatLaceQty(order.remainingHandoverQty, order.unit)}</strong></div></div></section>`
}

function renderDetailTabs(): string {
  return renderTabs({
    tabs: [
      { key: 'production', label: '生产信息' },
      { key: 'fulfillment', label: '完工与交出' },
      { key: 'logs', label: '操作日志', count: listLaceOperationLogs({ workOrderId: state.workOrderId }).length },
    ],
    activeKey: state.activeTab,
    variant: 'underline',
    prefix: 'lace-detail',
    action: 'content-tab',
  })
}

function renderActiveTabContent(order: LaceProductionOrderView): string {
  if (state.activeTab === 'fulfillment') {
    return `<div class="space-y-4">${renderCompletionRecords(order)}${renderHandoverRecords(order)}</div>`
  }
  if (state.activeTab === 'logs') return renderLogs(order)
  return `<div class="space-y-4">${renderInputSection(order)}${renderSourceSection(order)}${renderOutputSection(order)}</div>`
}

function renderInner(): string {
  const order = currentOrder()
  if (!order) return '<section class="rounded-lg border border-red-200 bg-red-50 p-6 text-red-800"><h1 class="font-semibold">花边生产单不存在</h1><button class="mt-3 text-blue-700 underline" data-nav="/fcs/craft/accessory/lace/work-orders">返回列表</button></section>'
  return `<div class="space-y-4">
    <header class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <button type="button" class="mb-2 text-sm text-blue-700 hover:underline" data-nav="/fcs/craft/accessory/lace/work-orders">← 返回花边生产单</button>
        <div class="flex flex-wrap items-center gap-2"><h1 class="text-2xl font-semibold">${escapeHtml(order.workOrderNo)}</h1>${renderLaceStatusBadge(order.status, productionTone(order.status))}</div>
        <p class="mt-1 text-sm text-slate-500">${escapeHtml(order.demandSource.factoryName)} · 采购单 ${escapeHtml(order.demandSource.purchaseOrderNo)} · ${escapeHtml(order.processingOutput.skuCode)}</p>
      </div>
      <div class="flex flex-col items-end gap-2">
        <label class="flex items-center gap-2 text-xs text-slate-500"><span>当前操作身份</span><select class="h-8 rounded-md border bg-white px-2 text-sm text-slate-800" data-lace-detail-field="actorRole" data-skip-page-rerender="true"><option value="花边厂业务员" ${state.actorRole === '花边厂业务员' ? 'selected' : ''}>花边厂业务员</option><option value="花边厂主管" ${state.actorRole === '花边厂主管' ? 'selected' : ''}>花边厂主管</option><option value="平台主管" ${state.actorRole === '平台主管' ? 'selected' : ''}>平台主管（兜底）</option></select></label>
        <div class="flex flex-wrap justify-end gap-2">${renderHeaderActions(order)}</div>
      </div>
    </header>
    <div data-lace-detail-feedback>${renderLaceFeedback(state.feedback, state.feedbackOk)}</div>
    ${renderChangeBanner(order)}
    ${renderPersistentSummary(order)}
    <section class="overflow-hidden rounded-lg border bg-white" data-lace-detail-tab-shell>
      <div class="px-4" data-lace-detail-tabs-surface>${renderDetailTabs()}</div>
      <div class="bg-slate-50/40 p-4" data-lace-detail-tab-content>${renderActiveTabContent(order)}</div>
    </section>
    <div data-lace-detail-overlays>${renderOverlays(order)}</div>
  </div>`
}

function rootElement(): HTMLElement | null {
  return typeof document === 'undefined' ? null : document.querySelector<HTMLElement>(ROOT_SELECTOR)
}

function refreshDetailTabSurfaces(): void {
  const order = currentOrder()
  const root = rootElement()
  const tabs = root?.querySelector<HTMLElement>('[data-lace-detail-tabs-surface]')
  const content = root?.querySelector<HTMLElement>('[data-lace-detail-tab-content]')
  if (!order || !tabs || !content) return
  tabs.innerHTML = renderDetailTabs()
  content.innerHTML = renderActiveTabContent(order)
  hydrateLaceSurface(tabs)
  hydrateLaceSurface(content)
}

function refreshAll(): void {
  const root = rootElement()
  if (!root) return
  const scrollTop = typeof window === 'undefined' ? 0 : window.scrollY
  root.innerHTML = renderInner()
  hydrateLaceSurface(root)
  if (typeof window !== 'undefined') window.scrollTo({ top: scrollTop, behavior: 'auto' })
}

function refreshOverlays(): void {
  const order = currentOrder()
  const surface = rootElement()?.querySelector<HTMLElement>('[data-lace-detail-overlays]')
  if (!surface || !order) return
  surface.innerHTML = renderOverlays(order)
  hydrateLaceSurface(surface)
}

function closeOverlayWithFeedback(message: string): void {
  state.overlay = null
  state.overlayError = ''
  state.feedback = message
  state.feedbackOk = true
  refreshAll()
}

function showError(error: unknown): void {
  state.feedbackOk = false
  state.overlayError = `未保存：${error instanceof Error ? error.message : String(error)}。请修正后重新提交。`
  if (state.overlay) refreshOverlays()
  else {
    state.feedback = state.overlayError
    refreshAll()
  }
}

export function renderLaceWorkOrderDetailPage(workOrderId: string): string {
  ensureLaceDetailEscapeBinding()
  const isDifferentOrder = state.workOrderId !== workOrderId
  const isFreshEntry = !rootElement()
  const params = typeof window === 'undefined' ? new URLSearchParams() : new URL(window.location.href).searchParams
  const entryKey = `${workOrderId}|${params.get('actor') ?? ''}|${params.get('action') ?? ''}`
  if (isDifferentOrder || isFreshEntry || state.entryKey !== entryKey) {
    state.workOrderId = workOrderId
    state.entryKey = entryKey
    state.overlay = null
    state.overlayError = ''
    state.feedback = ''
    state.feedbackOk = true
    state.activeTab = 'production'

    const actor = params.get('actor')
    if (actor === 'supervisor') state.actorRole = '花边厂主管'
    else if (actor === 'platform') state.actorRole = '平台主管'
    else state.actorRole = '花边厂业务员'

    const queryAction = params.get('action')
    const actionMap: Partial<Record<string, { key: LaceWorkOrderActionKey; tab: DetailTab; overlay: DetailOverlay }>> = {
      report: { key: 'report-completion', tab: 'fulfillment', overlay: { kind: 'report', clientActionId: nextLaceClientActionId('LACE-REPORT') } },
      complete: { key: 'complete-production', tab: 'fulfillment', overlay: { kind: 'complete' } },
      handover: { key: 'handover', tab: 'fulfillment', overlay: { kind: 'handover', clientActionId: nextLaceClientActionId('LACE-HANDOVER') } },
      'undo-complete': { key: 'undo-completion', tab: 'fulfillment', overlay: { kind: 'undo-complete' } },
      cancel: { key: 'cancel-order', tab: 'production', overlay: { kind: 'cancel' } },
      restore: { key: 'restore-order', tab: 'production', overlay: { kind: 'restore' } },
    }
    const intent = queryAction ? actionMap[queryAction] : undefined
    const order = currentOrder()
    if (intent && order) {
      const executable = listExecutableLaceWorkOrderActions(order, currentLaceDetailActor(), false)
        .some((action) => action.key === intent.key)
      if (executable) {
        state.activeTab = intent.tab
        state.overlay = intent.overlay
      } else {
        state.feedback = '当前身份或生产单状态不可执行该操作；页面未打开操作弹窗。'
        state.feedbackOk = false
      }
    }
  }
  return `<div data-lace-work-order-detail-root data-skip-page-rerender="true">${renderInner()}</div>`
}

export function handleLaceWorkOrderDetailEvent(target: HTMLElement, event?: Event): boolean {
  if (!rootElement() && typeof window !== 'undefined') return false
  if (handleLaceCommonImageEvent(target, event, refreshOverlays)) return true
  if (event?.type === 'keydown' && event instanceof KeyboardEvent && event.key === 'Escape' && state.overlay) {
    state.overlay = null
    state.overlayError = ''
    refreshOverlays()
    return true
  }
  const actorField = target.closest<HTMLSelectElement>('[data-lace-detail-field="actorRole"]')
  if (actorField) {
    state.actorRole = actorField.value as typeof state.actorRole
    state.overlay = null
    state.overlayError = ''
    state.feedback = `当前操作身份已切换为${currentLaceDetailActor().actorName}；所有动作按该身份校验并写入日志。`
    state.feedbackOk = true
    refreshAll()
    return true
  }
  const actionNode = target.closest<HTMLElement>('[data-lace-detail-action]')
  const action = actionNode?.dataset.laceDetailAction
  if (!actionNode || !action) return false
  if (action.startsWith('content-tab:')) {
    const nextTab = action.slice('content-tab:'.length) as DetailTab
    if (nextTab === 'production' || nextTab === 'fulfillment' || nextTab === 'logs') {
      state.activeTab = nextTab
      refreshDetailTabSurfaces()
    }
    return true
  }
  const order = currentOrder()
  if (!order) return false
  try {
    if (action === 'start-production') {
      startLaceProduction(order.workOrderId, currentLaceDetailActor())
      closeOverlayWithFeedback('已确认接收生产任务并进入加工中；默认加工投入保持不变。')
      return true
    }
    if (action === 'open-input') state.overlay = { kind: 'input' }
    if (action === 'open-report') state.overlay = { kind: 'report', clientActionId: nextLaceClientActionId('LACE-REPORT') }
    if (action === 'open-edit-report') state.overlay = { kind: 'edit-report', reportId: actionNode.dataset.reportId || '' }
    if (action === 'open-complete') state.overlay = { kind: 'complete' }
    if (action === 'open-undo-complete') state.overlay = { kind: 'undo-complete' }
    if (action === 'open-handover') state.overlay = { kind: 'handover', clientActionId: nextLaceClientActionId('LACE-HANDOVER') }
    if (action === 'open-cancel') state.overlay = { kind: 'cancel' }
    if (action === 'open-restore') state.overlay = { kind: 'restore' }
    if (action.startsWith('open-')) {
      state.overlayError = ''
      refreshOverlays()
      return true
    }
    if (action === 'close-overlay') {
      state.overlay = null
      state.overlayError = ''
      refreshOverlays()
      return true
    }
    const scope = rootElement() ?? document
    if (action === 'save-input') {
      const updates: LaceProcessingInputUpdate[] = []
      rootElement()?.querySelectorAll<HTMLElement>('[data-lace-input-row]').forEach((row) => {
        updates.push({
          currentInputMaterialId: row.dataset.currentInputMaterialId || '',
          nextInputMaterialId: row.querySelector<HTMLSelectElement>('[data-lace-input-material]')?.value || '',
          unitUsage: Number(row.querySelector<HTMLInputElement>('[data-lace-input-unit-usage]')?.value),
        })
      })
      updateLaceProcessingInputs(
        order.workOrderId,
        updates,
        readTextField(scope, '[data-lace-detail-field="inputReason"]'),
        currentLaceDetailActor(),
      )
      closeOverlayWithFeedback('加工投入的 SKU 与单位用量已保存；计划投入已自动重算，生产状态未改变。')
      return true
    }
    if (action === 'save-report' && state.overlay?.kind === 'report') {
      const command: CreateLaceCompletionCommand = {
        workOrderId: order.workOrderId,
        qty: readNumberField(scope, '[data-lace-detail-field="reportQty"]'),
        note: readTextField(scope, '[data-lace-detail-field="reportNote"]'),
        clientActionId: state.overlay.clientActionId,
        actor: currentLaceDetailActor(),
      }
      try {
        createLaceCompletionReport(command)
        closeOverlayWithFeedback('本次加工填报已保存；生产单仍保持加工中，需人员执行完成加工单。')
      } catch (error) {
        if (error instanceof LaceDomainError && error.code === 'OVERPRODUCTION_CONFIRM_REQUIRED') {
          state.overlay = { kind: 'overproduction-confirm', command, mode: 'create' }
          state.overlayError = ''
          refreshOverlays()
        } else throw error
      }
      return true
    }
    if (action === 'save-edit-report' && state.overlay?.kind === 'edit-report') {
      const command: UpdateLaceCompletionCommand = {
        reportId: state.overlay.reportId,
        qty: readNumberField(scope, '[data-lace-detail-field="reportQty"]'),
        reason: readTextField(scope, '[data-lace-detail-field="revisionReason"]'),
        actor: currentLaceDetailActor(),
      }
      try {
        updateLaceCompletionReport(command)
        closeOverlayWithFeedback('加工填报已修改，修改前后值和原因已写入日志。')
      } catch (error) {
        if (error instanceof LaceDomainError && error.code === 'OVERPRODUCTION_CONFIRM_REQUIRED') {
          state.overlay = { kind: 'overproduction-confirm', command, mode: 'edit' }
          state.overlayError = ''
          refreshOverlays()
        } else throw error
      }
      return true
    }
    if (action === 'confirm-overproduction' && state.overlay?.kind === 'overproduction-confirm') {
      if (state.overlay.mode === 'create') createLaceCompletionReport({ ...(state.overlay.command as CreateLaceCompletionCommand), overproductionConfirmed: true })
      else updateLaceCompletionReport({ ...(state.overlay.command as UpdateLaceCompletionCommand), overproductionConfirmed: true })
      closeOverlayWithFeedback('超量完工已二次确认并保存。')
      return true
    }
    if (action === 'save-complete') {
      completeLaceProduction(order.workOrderId, readTextField(scope, '[data-lace-detail-field="completeReason"]'), currentLaceDetailActor())
      closeOverlayWithFeedback('花边生产单已完结；历史记录保留，剩余有效完工仍可交出。')
      return true
    }
    if (action === 'save-undo-complete') {
      undoLaceProductionCompletion(order.workOrderId, readTextField(scope, '[data-lace-detail-field="undoReason"]'), currentLaceDetailActor())
      closeOverlayWithFeedback('已撤销完成并回到加工中；完工、交出和收货事实未回滚。')
      return true
    }
    if (action === 'save-handover' && state.overlay?.kind === 'handover') {
      createLaceHandover({
        workOrderId: order.workOrderId,
        qty: readNumberField(scope, '[data-lace-detail-field="handoverQty"]'),
        deliveryNo: readTextField(scope, '[data-lace-detail-field="deliveryNo"]'),
        packageCount: readNumberField(scope, '[data-lace-detail-field="packageCount"]'),
        packageNote: readTextField(scope, '[data-lace-detail-field="packageNote"]'),
        expectedReceiverName: readTextField(scope, '[data-lace-detail-field="receiverName"]'),
        clientActionId: state.overlay.clientActionId,
        actor: currentLaceDetailActor(),
      })
      closeOverlayWithFeedback('交出成功：已生成一条交出记录和一条 WLS 待收货记录。')
      return true
    }
    if (action === 'save-cancel') {
      const checkbox = scope.querySelector<HTMLInputElement>('[data-lace-detail-field="cancelConfirmed"]')
      cancelLaceProductionOrder({
        workOrderId: order.workOrderId,
        reason: readTextField(scope, '[data-lace-detail-field="cancelReason"]'),
        actor: currentLaceDetailActor(),
        secondConfirmed: Boolean(checkbox?.checked),
      })
      closeOverlayWithFeedback('花边生产单已取消，历史事实和日志均保留。')
      return true
    }
    if (action === 'save-restore') {
      restoreCancelledLaceProductionOrder(order.workOrderId, readTextField(scope, '[data-lace-detail-field="restoreReason"]'), currentLaceDetailActor())
      closeOverlayWithFeedback('已恢复原生产单；系统未生成第二张生产单。')
      return true
    }
  } catch (error) {
    showError(error)
    return true
  }
  return false
}
