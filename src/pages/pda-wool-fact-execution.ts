import {
  addWoolHandover,
  addWoolProcessReport,
  addWoolYarnReceipt,
  completeWoolWorkOrder,
  getWoolAllowedActions,
  getWoolHandoverEffectiveQty,
  getWoolOutputHandedOverQty,
  getWoolOutputHandoverAvailableQty,
  getWoolOutputReadiness,
  getWoolOutputReportedQty,
  getWoolProcessingStatus,
  getWoolWorkOrderByTaskId,
  getWoolWorkOrderReadinessProjection,
  listWoolFactRecords,
  readWoolStore,
  type WoolAllowedAction,
  type WoolHandoverRecord,
  type WoolProcessReportRecord,
  type WoolWorkOrder,
  type WoolYarnReceiptRecord,
} from '../data/fcs/wool-task-domain.ts'
import { escapeHtml } from '../utils.ts'

type WoolFactAction = Extract<
  WoolAllowedAction,
  'RECEIVE_YARN' | 'REPORT_PROCESS' | 'HANDOVER' | 'COMPLETE'
>

const ACTION_LABELS: Record<WoolFactAction, string> = {
  RECEIVE_YARN: '确认接收',
  REPORT_PROCESS: '加工填报',
  HANDOVER: '发起交出',
  COMPLETE: '完成加工单',
}

const state: {
  taskId: string
  overlay: null | { action: WoolFactAction; woolOrderId: string; commandId: string }
  factPage: number
  error: string
  feedback: string
} = {
  taskId: '',
  overlay: null,
  factPage: 1,
  error: '',
  feedback: '',
}

let commandSequence = 0

function syncTask(taskId: string): void {
  if (state.taskId === taskId) return
  state.taskId = taskId
  state.overlay = null
  state.factPage = 1
  state.error = ''
  state.feedback = ''
}

function nowText(): string {
  return new Date().toISOString().replace('T', ' ').slice(0, 19)
}

function nextCommandId(action: WoolFactAction, woolOrderId: string): string {
  commandSequence += 1
  return `PDA-${action}-${woolOrderId}-${Date.now()}-${commandSequence}`
}

function primaryAction(actions: WoolAllowedAction[]): WoolFactAction | null {
  for (const action of ['COMPLETE', 'HANDOVER', 'REPORT_PROCESS', 'RECEIVE_YARN'] as const) {
    if (actions.includes(action)) return action
  }
  return null
}

function outputLabel(order: WoolWorkOrder, outputSkuCode: string): string {
  const line = order.outputPlanLines.find((item) => item.outputSkuCode === outputSkuCode)
  if (!line) return outputSkuCode
  return [
    outputSkuCode,
    line.colorName,
    line.sizeCode,
    line.woolPartName,
  ].filter(Boolean).join(' / ')
}

function safeStyleImageUrl(value?: string): string {
  const url = value?.trim() || ''
  return /^(?:https?:\/\/|\/|data:image\/)/i.test(url) ? url : ''
}

function renderStyleIdentity(order: WoolWorkOrder): string {
  const styleImageUrl = safeStyleImageUrl(order.styleImageUrl)
  return `
    <section class="rounded-lg border bg-card p-4">
      <div class="flex gap-3">
        ${
          styleImageUrl
            ? `<img class="h-24 w-24 shrink-0 rounded-lg border object-cover" src="${escapeHtml(styleImageUrl)}" alt="${escapeHtml(`${order.styleName}款式图片`)}">`
            : '<div class="flex h-24 w-24 shrink-0 items-center justify-center rounded-lg border bg-muted text-xs text-muted-foreground">暂无款式图片</div>'
        }
        <div class="min-w-0 flex-1 space-y-1 text-sm">
          <div class="font-semibold">${escapeHtml(order.woolOrderNo)}</div>
          <div>款号：${escapeHtml(order.styleNo)}</div>
          <div>款名：${escapeHtml(order.styleName)}</div>
          <div>内部货号：${escapeHtml(order.internalStyleCode || '—')}</div>
          <div class="text-xs text-muted-foreground">生产单：${escapeHtml(order.productionOrderNo)}</div>
        </div>
      </div>
    </section>
  `
}

function renderOutputReadiness(order: WoolWorkOrder): string {
  const isCompleted = getWoolProcessingStatus(order.woolOrderId) === 'COMPLETED'
  return order.outputPlanLines.map((line) => {
    const readiness = getWoolOutputReadiness(order.woolOrderId, line.outputSkuCode)
    return `
      <article class="rounded-lg border p-3 text-sm">
        <div class="font-medium">${escapeHtml(outputLabel(order, line.outputSkuCode))}</div>
        <div class="mt-2 text-xs ${!isCompleted && readiness.canReport ? 'text-emerald-700' : 'text-amber-700'}">
          ${isCompleted
            ? '加工单已完成，仅可查看'
            : readiness.canReport
            ? `可填报；本次最多 ${readiness.remainingReportQty}${line.qtyUnit}`
            : readiness.missingYarnSkus.length
              ? `缺少纱线：${escapeHtml(readiness.missingYarnSkus.join('、'))}`
              : readiness.remainingReportQty <= 0
                ? '已达到计划数量的 150%'
                : '技术包未配置必需纱线'}
        </div>
        <div class="mt-1 text-xs text-muted-foreground">
          必需纱线：${escapeHtml(readiness.requiredYarnSkus.join('、') || '未配置')}；
          已接收：${escapeHtml(readiness.confirmedYarnSkus.join('、') || '无')}
        </div>
      </article>
    `
  }).join('')
}

function renderFactList(order: WoolWorkOrder): string {
  const items = listWoolFactRecords({
    woolOrderId: order.woolOrderId,
    recordType: ['YARN_RECEIPT', 'PROCESS_REPORT', 'HANDOVER', 'COMPLETION'],
  })
  const pageSize = 5
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize))
  state.factPage = Math.min(Math.max(state.factPage, 1), totalPages)
  const rows = items.slice((state.factPage - 1) * pageSize, state.factPage * pageSize)
  const renderRecord = (item: (typeof items)[number]): string => {
    if (item.recordType === 'YARN_RECEIPT') {
      const record = item.record as WoolYarnReceiptRecord
      return `${record.receiptNo}：${record.lines.map((line) => `${line.yarnSkuCode} ${line.receivedQty}kg`).join('、')}`
    }
    if (item.recordType === 'PROCESS_REPORT') {
      const record = item.record as WoolProcessReportRecord
      return `${record.reportId}：${record.outputSkuCode} ${record.reportedQty}`
    }
    if (item.recordType === 'HANDOVER') {
      const record = item.record as WoolHandoverRecord
      return `${record.handoverId}：${record.outputSkuCode} ${getWoolHandoverEffectiveQty(
        readWoolStore(),
        record,
      )}`
    }
    return `完成加工单：${'completedAt' in item.record ? item.record.completedAt : item.occurredAt}`
  }
  return `
    <details class="rounded-lg border bg-card">
      <summary class="cursor-pointer px-4 py-3 text-sm font-medium">查看完整事实记录（${items.length}）</summary>
      <div class="border-t p-3">
        <div class="space-y-2">
          ${rows.map((item) => `<div class="rounded border px-3 py-2 text-xs">${escapeHtml(renderRecord(item))}<div class="mt-1 text-muted-foreground">${escapeHtml(item.occurredAt)}</div></div>`).join('') || '<div class="text-xs text-muted-foreground">暂无记录</div>'}
        </div>
        <div class="mt-3 flex items-center justify-between text-xs">
          <button type="button" class="rounded border px-3 py-1 disabled:opacity-50" data-pda-wool-action="fact-page" data-page="${state.factPage - 1}" data-skip-page-rerender="true" ${state.factPage <= 1 ? 'disabled' : ''}>上一页</button>
          <span>第 ${state.factPage} / ${totalPages} 页，每页 ${pageSize} 条，共 ${items.length} 条</span>
          <button type="button" class="rounded border px-3 py-1 disabled:opacity-50" data-pda-wool-action="fact-page" data-page="${state.factPage + 1}" data-skip-page-rerender="true" ${state.factPage >= totalPages ? 'disabled' : ''}>下一页</button>
        </div>
      </div>
    </details>
  `
}

function renderReceiptDialog(order: WoolWorkOrder): string {
  const projection = getWoolWorkOrderReadinessProjection(order.woolOrderId)
  const yarns = [...new Set(order.outputPlanLines.flatMap((line) => line.requiredYarnSkus))]
  return `
    <div class="space-y-3 p-4">
      <div class="text-sm font-medium">本次实际收到哪些纱线？</div>
      ${yarns.map((sku) => {
        const aggregate = projection.yarnReceiptsBySku.get(sku)
        return `<label class="grid grid-cols-[24px_1fr_100px] items-center gap-2 rounded border p-3 text-sm">
          <input type="checkbox" data-pda-wool-receive-sku="${escapeHtml(sku)}">
          <span>${escapeHtml(sku)}<span class="block text-xs text-muted-foreground">累计已接收 ${aggregate?.receivedQty || 0} kg</span></span>
          <input type="number" min="0.01" step="0.01" class="h-9 rounded border px-2" placeholder="kg" data-pda-wool-receive-qty="${escapeHtml(sku)}">
        </label>`
      }).join('')}
      <input class="h-9 w-full rounded border px-3 text-sm" placeholder="批次号（可选）" data-pda-wool-field="batchNo">
      <textarea class="min-h-16 w-full rounded border p-3 text-sm" placeholder="备注（可选）" data-pda-wool-field="remark"></textarea>
    </div>
  `
}

function renderReportDialog(order: WoolWorkOrder): string {
  const ready = order.outputPlanLines.filter((line) =>
    getWoolOutputReadiness(order.woolOrderId, line.outputSkuCode).canReport,
  )
  return `
    <div class="space-y-3 p-4">
      <label class="block text-sm">加工后 SKU<select class="mt-1 h-10 w-full rounded border px-3" data-pda-wool-field="outputSkuCode">${ready.map((line) => {
        const item = getWoolOutputReadiness(order.woolOrderId, line.outputSkuCode)
        return `<option value="${escapeHtml(line.outputSkuCode)}">${escapeHtml(outputLabel(order, line.outputSkuCode))}｜最多 ${item.remainingReportQty}${line.qtyUnit}</option>`
      }).join('')}</select></label>
      <label class="block text-sm">本次加工数量<input type="number" min="1" step="1" class="mt-1 h-10 w-full rounded border px-3" data-pda-wool-field="qty"></label>
      <textarea class="min-h-16 w-full rounded border p-3 text-sm" placeholder="备注（可选）" data-pda-wool-field="remark"></textarea>
    </div>
  `
}

function renderHandoverDialog(order: WoolWorkOrder): string {
  const available = order.outputPlanLines.filter((line) =>
    getWoolOutputHandoverAvailableQty(order.woolOrderId, line.outputSkuCode) > 0,
  )
  return `
    <div class="space-y-3 p-4">
      <label class="block text-sm">交出 SKU<select class="mt-1 h-10 w-full rounded border px-3" data-pda-wool-field="outputSkuCode">${available.map((line) => `<option value="${escapeHtml(line.outputSkuCode)}">${escapeHtml(outputLabel(order, line.outputSkuCode))}｜可交 ${getWoolOutputHandoverAvailableQty(order.woolOrderId, line.outputSkuCode)}${line.qtyUnit}</option>`).join('')}</select></label>
      <label class="block text-sm">本次交出数量<input type="number" min="1" step="1" class="mt-1 h-10 w-full rounded border px-3" data-pda-wool-field="qty"></label>
      <div class="rounded border bg-muted/30 p-3 text-sm">接收方：${escapeHtml(order.downstreamTarget.receiverName || '交出去向未配置')}</div>
      <textarea class="min-h-16 w-full rounded border p-3 text-sm" placeholder="备注（可选）" data-pda-wool-field="remark"></textarea>
    </div>
  `
}

function renderCompleteDialog(order: WoolWorkOrder): string {
  const projection = getWoolWorkOrderReadinessProjection(order.woolOrderId)
  return `
    <div class="space-y-3 p-4 text-sm">
      <div class="rounded border border-amber-300 bg-amber-50 p-3 font-medium text-amber-900">系统只展示当前事实，不判断是否应该完成。请业务人员自行核对并确认。</div>
      <section class="rounded border p-3"><div class="font-medium">确认接收的纱线情况</div><div class="mt-2 text-xs">${[...projection.yarnReceiptsBySku.values()].map((item) => `${escapeHtml(item.yarnSkuCode)}：${item.receivedQty}kg`).join('<br>') || '暂无有效确认接收'}</div></section>
      <section class="rounded border p-3"><div class="font-medium">加工填报情况</div><div class="mt-2 text-xs">${order.outputPlanLines.map((line) => `${escapeHtml(line.outputSkuCode)}：${getWoolOutputReportedQty(order.woolOrderId, line.outputSkuCode)}${line.qtyUnit}`).join('<br>')}</div></section>
      <section class="rounded border p-3"><div class="font-medium">发起交出情况</div><div class="mt-2 text-xs">${order.outputPlanLines.map((line) => `${escapeHtml(line.outputSkuCode)}：已交 ${getWoolOutputHandedOverQty(order.woolOrderId, line.outputSkuCode)}${line.qtyUnit}，未交 ${Math.max(getWoolOutputReportedQty(order.woolOrderId, line.outputSkuCode) - getWoolOutputHandedOverQty(order.woolOrderId, line.outputSkuCode), 0)}${line.qtyUnit}`).join('<br>')}</div></section>
      <textarea class="min-h-16 w-full rounded border p-3 text-sm" placeholder="完成备注（可选）" data-pda-wool-field="remark"></textarea>
    </div>
  `
}

function renderOverlay(order: WoolWorkOrder): string {
  if (!state.overlay || state.overlay.woolOrderId !== order.woolOrderId) return ''
  const action = state.overlay.action
  const body = action === 'RECEIVE_YARN'
    ? renderReceiptDialog(order)
    : action === 'REPORT_PROCESS'
      ? renderReportDialog(order)
      : action === 'HANDOVER'
        ? renderHandoverDialog(order)
        : renderCompleteDialog(order)
  return `
    <div class="fixed inset-0 z-[140] flex items-end bg-black/40 sm:items-center sm:p-4">
      <section class="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-background sm:mx-auto sm:max-w-lg sm:rounded-lg">
        <header class="sticky top-0 flex items-center justify-between border-b bg-background px-4 py-3"><h2 class="font-semibold">${ACTION_LABELS[action]}${action === 'COMPLETE' ? '二次确认' : ''}</h2><button type="button" class="rounded border px-3 py-1 text-sm" data-pda-wool-action="close-overlay" data-skip-page-rerender="true">关闭</button></header>
        ${state.error ? `<div class="mx-4 mt-3 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700" data-pda-wool-error>${escapeHtml(state.error)}</div>` : ''}
        ${body}
        <footer class="sticky bottom-0 flex gap-2 border-t bg-background p-4"><button type="button" class="h-10 flex-1 rounded border" data-pda-wool-action="close-overlay" data-skip-page-rerender="true">取消</button><button type="button" class="h-10 flex-1 rounded bg-primary font-medium text-primary-foreground" data-pda-wool-action="save-fact" data-skip-page-rerender="true">${action === 'COMPLETE' ? '确认完成加工单' : `保存${ACTION_LABELS[action]}`}</button></footer>
      </section>
    </div>
  `
}

export function renderPdaWoolExecutionContent(taskId: string): string {
  syncTask(taskId)
  const order = getWoolWorkOrderByTaskId(taskId)
  if (!order) return '<div class="p-4 text-sm text-red-700">当前任务没有唯一对应的毛织加工单，请联系主管处理。</div>'
  const actions = getWoolAllowedActions(order.woolOrderId)
  const primary = primaryAction(actions)
  const secondary = actions.filter((action): action is WoolFactAction =>
    action !== 'DETAIL'
    && action !== 'ASSOCIATE_MACHINE'
    && action !== primary,
  )
  const status = getWoolProcessingStatus(order.woolOrderId)
  return `
    <div class="space-y-3 p-4" data-pda-wool-root data-task-id="${escapeHtml(taskId)}" data-wool-order-id="${escapeHtml(order.woolOrderId)}">
      <button type="button" class="text-sm text-muted-foreground" data-pda-execd-action="back">← 返回</button>
      ${state.feedback ? `<div class="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">${escapeHtml(state.feedback)}</div>` : ''}
      ${renderStyleIdentity(order)}
      <section class="rounded-lg border bg-card p-4"><div class="flex items-center justify-between"><h2 class="font-semibold">可填报 SKU 与纱线</h2><span class="rounded border px-2 py-1 text-xs">${status === 'UNPROCESSED' ? '未加工' : status === 'PROCESSING' ? '加工中' : '已完成'}</span></div><div class="mt-3 space-y-2">${renderOutputReadiness(order)}</div></section>
      ${renderFactList(order)}
      <section class="rounded-lg border bg-card p-4">
        <h2 class="text-sm font-semibold">当前操作</h2>
        ${primary ? `<button type="button" class="mt-3 h-12 w-full rounded-lg bg-primary text-base font-semibold text-primary-foreground" data-pda-wool-action="open-fact" data-wool-fact-action="${primary}" data-wool-order-id="${escapeHtml(order.woolOrderId)}" data-wool-primary-action="true" data-skip-page-rerender="true">${ACTION_LABELS[primary]}</button>` : '<div class="mt-3 rounded border bg-muted/30 p-3 text-sm text-muted-foreground">加工单已完成，只能查看事实记录。</div>'}
        ${secondary.length ? `<details class="mt-3"><summary class="cursor-pointer text-sm text-muted-foreground">其他可操作</summary><div class="mt-2 grid grid-cols-2 gap-2">${secondary.map((action) => `<button type="button" class="h-9 rounded border text-sm" data-pda-wool-action="open-fact" data-wool-fact-action="${action}" data-wool-order-id="${escapeHtml(order.woolOrderId)}" data-skip-page-rerender="true">${ACTION_LABELS[action]}</button>`).join('')}</div></details>` : ''}
      </section>
      <div data-pda-wool-overlay-root>${renderOverlay(order)}</div>
    </div>
  `
}

function field(root: HTMLElement, name: string): string {
  return root.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
    `[data-pda-wool-field="${name}"]`,
  )?.value.trim() || ''
}

function refreshRoot(root: HTMLElement, taskId: string): void {
  root.outerHTML = renderPdaWoolExecutionContent(taskId)
}

function refreshOverlay(root: HTMLElement, order: WoolWorkOrder): void {
  const target = root.querySelector<HTMLElement>('[data-pda-wool-overlay-root]')
  if (target) target.innerHTML = renderOverlay(order)
}

export function handlePdaWoolExecutionEvent(target: HTMLElement): boolean {
  const root = target.closest<HTMLElement>('[data-pda-wool-root]')
  if (!root) return false
  const actionNode = target.closest<HTMLElement>('[data-pda-wool-action]')
  const action = actionNode?.dataset.pdaWoolAction
  if (!actionNode || !action) return false
  const taskId = root.dataset.taskId || ''
  const order = getWoolWorkOrderByTaskId(taskId)
  if (!order) return true

  if (action === 'open-fact') {
    const factAction = actionNode.dataset.woolFactAction as WoolFactAction
    if (!getWoolAllowedActions(order.woolOrderId).includes(factAction)) {
      state.error = '当前业务事实已变化，请按最新页面操作。'
      return true
    }
    state.overlay = {
      action: factAction,
      woolOrderId: order.woolOrderId,
      commandId: nextCommandId(factAction, order.woolOrderId),
    }
    state.error = ''
    refreshOverlay(root, order)
    return true
  }
  if (action === 'close-overlay') {
    state.overlay = null
    state.error = ''
    refreshOverlay(root, order)
    return true
  }
  if (action === 'fact-page') {
    state.factPage = Math.max(1, Number(actionNode.dataset.page || 1))
    refreshRoot(root, taskId)
    return true
  }
  if (action !== 'save-fact' || !state.overlay) return true

  try {
    const operatedAt = nowText()
    const operatedBy = 'PDA 毛织操作员'
    if (state.overlay.action === 'RECEIVE_YARN') {
      const lines = [...root.querySelectorAll<HTMLInputElement>('[data-pda-wool-receive-sku]:checked')].map((checkbox) => {
        const yarnSkuCode = checkbox.dataset.pdaWoolReceiveSku || ''
        const qtyInput = [...root.querySelectorAll<HTMLInputElement>('[data-pda-wool-receive-qty]')]
          .find((input) => input.dataset.pdaWoolReceiveQty === yarnSkuCode)
        const receivedQty = Number(qtyInput?.value || 0)
        return { yarnSkuCode, receivedQty }
      })
      addWoolYarnReceipt(order.woolOrderId, {
        commandId: state.overlay.commandId,
        batchNo: field(root, 'batchNo'),
        receivedAt: operatedAt,
        receivedBy: operatedBy,
        remark: field(root, 'remark'),
        lines,
      })
    } else if (state.overlay.action === 'REPORT_PROCESS') {
      addWoolProcessReport(order.woolOrderId, {
        commandId: state.overlay.commandId,
        outputSkuCode: field(root, 'outputSkuCode'),
        reportedQty: Number(field(root, 'qty')),
        reportedAt: operatedAt,
        reportedBy: operatedBy,
        remark: field(root, 'remark'),
      })
    } else if (state.overlay.action === 'HANDOVER') {
      addWoolHandover(order.woolOrderId, {
        commandId: state.overlay.commandId,
        outputSkuCode: field(root, 'outputSkuCode'),
        handoverQty: Number(field(root, 'qty')),
        handedOverAt: operatedAt,
        handedOverBy: operatedBy,
        remark: field(root, 'remark'),
      })
    } else {
      completeWoolWorkOrder(order.woolOrderId, {
        commandId: state.overlay.commandId,
        completedAt: operatedAt,
        completedBy: operatedBy,
        remark: field(root, 'remark'),
      })
    }
    state.feedback = `${ACTION_LABELS[state.overlay.action]}已保存，Web 端同步更新。`
    state.overlay = null
    state.error = ''
    refreshRoot(root, taskId)
  } catch (error) {
    state.error = error instanceof Error ? error.message : '保存失败，请检查后重试。'
    refreshOverlay(root, order)
  }
  return true
}
