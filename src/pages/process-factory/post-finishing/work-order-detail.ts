// @page-pattern: detail

import { buildUnifiedPrintPreviewRouteLink } from '../../../data/fcs/fcs-route-links.ts'
import {
  completePostFinishingProjectLine,
  getPostFinishingSourceLabel,
  getPostFinishingWorkOrderById,
  startPostFinishingProjectLine,
  type PostFinishingWorkOrder,
} from '../../../data/fcs/post-finishing-domain.ts'
import {
  POST_FINISHING_ACCEPTANCE_ACTORS,
  POST_FINISHING_DEFECT_REASON_OPTIONS,
  completePostFinishingPostTaskFromDraft,
  getCurrentPostFinishingActor,
  getPostFinishingFullFlowPostTask,
  getPostFinishingFullFlowQcTask,
  listPostFinishingPostReturnReceiverOptions,
  savePostFinishingPostSkuAdjustment,
  setPostFinishingPostCompletedQuantity,
  startPostFinishingPostTask,
  takeOverPostFinishingPostTask,
  type PostFinishingActor,
  type PostFinishingPostTask,
} from '../../../data/fcs/post-finishing-full-flow.ts'
import { appStore } from '../../../state/store.ts'
import { escapeHtml } from '../../../utils.ts'
import {
  formatGarmentQty,
  renderPostAction,
  renderPostFinishingPageHeader,
  renderPostSection,
  renderPostStatusBadge,
  renderPostTable,
} from './shared.ts'

type PostFinishingDetailTab = 'base' | 'sku' | 'items' | 'result'

const DETAIL_TABS: Array<{ key: PostFinishingDetailTab; label: string }> = [
  { key: 'base', label: '基本信息' },
  { key: 'sku', label: 'SKU 明细' },
  { key: 'items', label: '实际工序' },
  { key: 'result', label: '执行结果' },
]

function getCurrentTab(): PostFinishingDetailTab {
  if (typeof window === 'undefined') return 'base'
  const value = new URLSearchParams(window.location.search).get('tab') || 'base'
  return DETAIL_TABS.some((tab) => tab.key === value) ? (value as PostFinishingDetailTab) : 'base'
}

function buildDetailHref(postOrderId: string, tab: PostFinishingDetailTab): string {
  return `/fcs/craft/post-finishing/work-orders/${encodeURIComponent(postOrderId)}?tab=${tab}`
}

function renderTabs(postOrderId: string, activeTab: PostFinishingDetailTab): string {
  return `
    <nav class="inline-flex flex-wrap gap-1 rounded-md bg-muted p-1">
      ${DETAIL_TABS.map((tab) => {
        const active = tab.key === activeTab
        return `
          <button
            type="button"
            class="rounded px-3 py-1.5 text-sm ${active ? 'bg-background font-medium text-foreground shadow-sm' : 'text-muted-foreground hover:bg-background/60 hover:text-foreground'}"
            data-nav="${escapeHtml(buildDetailHref(postOrderId, tab.key))}"
          >
            ${escapeHtml(tab.label)}
          </button>
        `
      }).join('')}
    </nav>
  `
}

function renderInfoGrid(rows: Array<[string, string]>): string {
  return `
    <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      ${rows.map(([label, value]) => `
        <div class="rounded-lg border bg-slate-50 px-3 py-2">
          <div class="text-xs text-muted-foreground">${escapeHtml(label)}</div>
          <div class="mt-1 text-sm font-medium text-foreground">${escapeHtml(value)}</div>
        </div>
      `).join('')}
    </div>
  `
}

function renderEmptyRow(colspan: number, text: string): string {
  return `<tr><td colspan="${colspan}" class="px-3 py-6 text-center text-sm text-muted-foreground">${escapeHtml(text)}</td></tr>`
}

function registerPostWorkOrderDetailActions(): void {
  if (typeof window === 'undefined') return
  const win = window as Window & {
    __startPostFinishingProjectLine?: (postOrderId: string, projectLineId: string) => void
    __completePostFinishingProjectLine?: (postOrderId: string, projectLineId: string, plannedQty: number) => void
    __reportPostFinishingWorkOrderException?: (postOrderNo: string) => void
  }
  win.__startPostFinishingProjectLine = (postOrderId: string, projectLineId: string) => {
    const updated = startPostFinishingProjectLine({ postOrderId, projectLineId, operatorName: '后道操作员' })
    appStore.navigate(`${buildDetailHref(updated.postOrderId, 'items')}&refresh=${Date.now()}`)
  }
  win.__completePostFinishingProjectLine = (postOrderId: string, projectLineId: string, plannedQty: number) => {
    const updated = completePostFinishingProjectLine({ postOrderId, projectLineId, completedQty: plannedQty, operatorName: '后道操作员' })
    appStore.navigate(`${buildDetailHref(updated.postOrderId, updated.postStatus === '后道完成' ? 'result' : 'items')}&refresh=${Date.now()}`)
  }
  win.__reportPostFinishingWorkOrderException = (postOrderNo: string) => {
    window.alert(`已记录后道异常：${postOrderNo}`)
  }
}

function renderActionBar(order: PostFinishingWorkOrder): string {
  return `
    <div class="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-white p-3">
      ${renderTabs(order.postOrderId, getCurrentTab())}
      <div class="flex flex-wrap gap-2">
        ${renderPostAction('返回后道单列表', '/fcs/craft/post-finishing/work-orders')}
        <button type="button" class="rounded-md border px-3 py-1.5 text-sm hover:bg-muted" onclick="window.__reportPostFinishingWorkOrderException('${escapeHtml(order.postOrderNo)}')">上报异常</button>
        ${renderPostAction('打印后道单', buildUnifiedPrintPreviewRouteLink({ documentType: 'TASK_ROUTE_CARD', sourceType: 'POST_FINISHING_WORK_ORDER', sourceId: order.postOrderId }))}
      </div>
    </div>
  `
}

function renderSkuRows(order: PostFinishingWorkOrder): string {
  return order.skuLines.map((line) => `
    <tr class="align-top">
      <td class="px-3 py-3 font-mono text-xs">${escapeHtml(line.skuCode)}</td>
      <td class="px-3 py-3 text-sm"><div class="font-medium">${escapeHtml(line.spuName)}</div><div class="text-xs text-muted-foreground">${escapeHtml(line.spuCode)}</div></td>
      <td class="px-3 py-3 text-sm">${escapeHtml(line.colorName)}</td>
      <td class="px-3 py-3 text-sm">${escapeHtml(line.sizeName)}</td>
      <td class="px-3 py-3 text-sm font-medium">${formatGarmentQty(line.plannedQty, line.qtyUnit)}</td>
    </tr>
  `).join('')
}

function renderPostItemRows(order: PostFinishingWorkOrder): string {
  const rows = order.postProjectLines.map((line) => `
    <tr class="align-top">
      <td class="px-3 py-3 text-sm"><div class="font-semibold">${escapeHtml(line.skuCode)}</div><div class="text-xs text-muted-foreground">${escapeHtml(line.colorName)} / ${escapeHtml(line.sizeName)}</div></td>
      <td class="px-3 py-3 text-sm font-medium">${escapeHtml(line.projectName)}</td>
      <td class="px-3 py-3 text-sm">${formatGarmentQty(line.plannedQty, line.qtyUnit)}</td>
      <td class="px-3 py-3 text-sm">${formatGarmentQty(line.completedQty, line.qtyUnit)}</td>
      <td class="px-3 py-3">${renderPostStatusBadge(line.status)}</td>
      <td class="px-3 py-3 text-sm">${escapeHtml(line.startedAt || '—')}</td>
      <td class="px-3 py-3 text-sm">${escapeHtml(line.finishedAt || '—')}</td>
      <td class="px-3 py-3">
        <div class="flex flex-wrap gap-2">
          ${line.status === '待开始' ? `<button type="button" class="rounded-md border px-2 py-1 text-xs hover:bg-slate-50" onclick="window.__startPostFinishingProjectLine('${escapeHtml(order.postOrderId)}','${escapeHtml(line.projectLineId)}')">开始${escapeHtml(line.projectName)}</button>` : ''}
          ${line.status !== '已完成' ? `<button type="button" class="rounded-md border px-2 py-1 text-xs hover:bg-slate-50" onclick="window.__completePostFinishingProjectLine('${escapeHtml(order.postOrderId)}','${escapeHtml(line.projectLineId)}',${line.plannedQty})">完成${escapeHtml(line.projectName)}</button>` : ''}
        </div>
      </td>
    </tr>
  `).join('')
  return rows || renderEmptyRow(8, '暂无实际工序')
}

function renderResultRows(order: PostFinishingWorkOrder): string {
  const action = order.postAction
  return `
    <tr class="align-top">
      <td class="px-3 py-3">${renderPostStatusBadge(action.status)}</td>
      <td class="px-3 py-3 text-sm">${escapeHtml(action.operatorName || '—')}</td>
      <td class="px-3 py-3 text-sm">${escapeHtml(action.startedAt || '—')}</td>
      <td class="px-3 py-3 text-sm">${escapeHtml(action.finishedAt || '—')}</td>
      <td class="px-3 py-3 text-sm">${formatGarmentQty(action.submittedGarmentQty, action.qtyUnit)}</td>
      <td class="px-3 py-3 text-sm">${formatGarmentQty(action.completedPostGarmentQty ?? action.acceptedGarmentQty, action.qtyUnit)}</td>
      <td class="px-3 py-3 text-sm">${formatGarmentQty(action.rejectedGarmentQty, action.qtyUnit)}</td>
      <td class="px-3 py-3 text-sm">${escapeHtml(action.remark || '—')}</td>
    </tr>
  `
}

function renderTabBody(order: PostFinishingWorkOrder): string {
  const activeTab = getCurrentTab()
  if (activeTab === 'sku') {
    return renderPostSection('SKU 明细', renderPostTable(
      ['SKU', '款式衣服', '颜色', '尺码', '待处理数量'],
      renderSkuRows(order) || renderEmptyRow(5, '暂无 SKU 明细'),
      'min-w-[980px]',
    ))
  }
  if (activeTab === 'items') {
    return renderPostSection('实际工序', renderPostTable(
      ['SKU', '实际工序', '计划数量', '完成数量', '状态', '开始时间', '完成时间', '操作'],
      renderPostItemRows(order),
      'min-w-[1180px]',
    ))
  }
  if (activeTab === 'result') {
    return renderPostSection('执行结果', renderPostTable(
      ['执行状态', '操作人', '开始时间', '完成时间', '待处理数量', '完成数量', '异常数量', '备注'],
      renderResultRows(order),
      'min-w-[1160px]',
    ))
  }

  const baseRows: Array<[string, string]> = [
    ['后道单号', order.postOrderNo],
    ['来源质检单', order.qcOrderNo],
    ['生产单', order.sourceProductionOrderNo],
    ['来源任务', order.sourceTaskNo],
    ['来源工厂', order.sourceSewingFactoryName],
    ['后道工厂', order.currentFactoryName],
    ['款式 / SPU', `${order.spuCode} / ${order.spuName}`],
    ['阶段来源', getPostFinishingSourceLabel(order)],
    ['待处理数量', formatGarmentQty(order.plannedGarmentQty, order.plannedGarmentQtyUnit)],
    ['阶段状态', order.postStatus],
    ['创建时间', order.createdAt],
    ['最近更新', order.updatedAt],
  ]
  return renderPostSection('基本信息', renderInfoGrid(baseRows))
}

let fullFlowMessage = ''
let fullFlowMessageTone: 'success' | 'error' = 'success'

function fullFlowQuery(): URLSearchParams {
  return typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search)
}

function webFallbackActor(): PostFinishingActor {
  return getCurrentPostFinishingActor(POST_FINISHING_ACCEPTANCE_ACTORS.postOperator.actorId)
}

function fullFlowDetailHref(taskId: string, skuId = ''): string {
  const params = new URLSearchParams()
  if (skuId) params.set('skuId', skuId)
  const suffix = params.toString()
  return `/fcs/craft/post-finishing/work-orders/${encodeURIComponent(taskId)}${suffix ? `?${suffix}` : ''}`
}

function refreshFullFlowDetail(taskId: string, skuId = ''): void {
  const params = new URLSearchParams({ refresh: String(Date.now()) })
  if (skuId) params.set('skuId', skuId)
  appStore.navigate(`/fcs/craft/post-finishing/work-orders/${encodeURIComponent(taskId)}?${params.toString()}`)
}

function renderFullFlowMessage(): string {
  if (!fullFlowMessage) return ''
  const tone = fullFlowMessageTone === 'error'
    ? 'border-red-200 bg-red-50 text-red-700'
    : 'border-emerald-200 bg-emerald-50 text-emerald-800'
  return `<div role="status" class="rounded-lg border px-4 py-3 text-sm ${tone}">${escapeHtml(fullFlowMessage)}</div>`
}

function renderFullFlowSkuImage(task: PostFinishingPostTask, line: PostFinishingPostTask['lines'][number]): string {
  const label = `${line.sku.skuCode} ${line.sku.colorName} ${line.sku.sizeName}`
  return `<button type="button" class="relative flex h-14 w-14 shrink-0 cursor-zoom-in items-center justify-center overflow-hidden rounded-lg border bg-slate-50" data-post-finishing-action="full-flow-zoom-image" data-image-url="${escapeHtml(line.sku.imageUrl)}" data-image-label="${escapeHtml(label)}"><img src="${escapeHtml(line.sku.imageUrl)}" alt="${escapeHtml(`${line.sku.spuName} ${line.sku.colorName} ${line.sku.sizeName}`)}" class="h-full w-full object-cover" onload="this.nextElementSibling.hidden=true" onerror="this.hidden=true;this.nextElementSibling.textContent='图片加载失败';this.nextElementSibling.hidden=false"/><span class="px-1 text-center text-[9px] text-slate-500">图片加载中…</span></button>`
}

function renderFullFlowSkuAdjustment(task: PostFinishingPostTask, skuId: string): string {
  const line = task.lines.find((item) => item.sku.skuId === skuId)
  if (!line) return renderPostSection('未找到 SKU', `<a data-nav="${escapeHtml(fullFlowDetailHref(task.postTaskId))}" class="text-sm text-blue-700">返回后道单</a>`)
  const currentActor = webFallbackActor()
  const editable = task.status === '后道中' && task.startedBy?.actorId === currentActor.actorId
  const draft = task.draftLines?.find((item) => item.skuId === skuId)
  if (!editable) {
    return renderPostSection('SKU 瑕疵调整', `<div class="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">当前任务由 ${escapeHtml(task.startedBy?.actorName || '其他操作员')} 处理。请返回任务详情完成 Web 应急接管后再调整。</div><a data-nav="${escapeHtml(fullFlowDetailHref(task.postTaskId))}" class="mt-3 inline-flex rounded-md border px-4 py-2 text-sm">返回后道单</a>`)
  }
  const completedQty = draft?.completedQty ?? 0
  const adjustedQty = (draft?.defectQty ?? 0) + (draft?.returnQty ?? 0)
  const receiverListId = `post-return-receiver-${task.postTaskId}-${skuId}`
  const receiverOptions = listPostFinishingPostReturnReceiverOptions(task.postTaskId)
  const currentDefectSummary = draft?.defectReasonQuantities?.length
    ? draft.defectReasonQuantities.map((item) => `${item.reason} ${item.quantity} 件`).join('、')
    : '暂无瑕疵'
  return `
    <div class="space-y-4" data-web-post-adjust-root data-task-id="${escapeHtml(task.postTaskId)}" data-sku-id="${escapeHtml(skuId)}">
      <div class="flex items-center justify-between gap-3"><a data-nav="${escapeHtml(fullFlowDetailHref(task.postTaskId))}" class="text-sm text-blue-700 hover:underline">← 返回后道单</a><span class="text-xs text-muted-foreground">Web 应急调整 · 与 PDA 共用草稿</span></div>
      <section class="rounded-xl border bg-card p-4"><div class="flex items-center gap-3">${renderFullFlowSkuImage(task, line)}<div><div class="font-mono text-sm font-semibold">${escapeHtml(line.sku.skuCode)}</div><div class="mt-1 text-xs text-muted-foreground">${escapeHtml(line.sku.spuName)} · ${escapeHtml(line.sku.colorName)} / ${escapeHtml(line.sku.sizeName)}</div><div class="mt-1 text-sm">应加工 ${line.expectedQty} 件 · ${completedQty > 0 ? `已填完成 ${completedQty} 件` : '完成数量未填写'}</div></div></div></section>
      <section class="grid gap-4 rounded-xl border bg-card p-4 lg:grid-cols-2">
        <div class="space-y-3"><div><h3 class="font-semibold">调整瑕疵</h3><p class="mt-1 text-xs text-muted-foreground">选择增加或减少，并逐项填写各瑕疵原因的本次数量。</p></div><div class="rounded-lg bg-slate-50 p-3 text-sm"><span class="font-medium">当前瑕疵 ${draft?.defectQty ?? 0} 件：</span>${escapeHtml(currentDefectSummary)}</div><div class="grid grid-cols-2 gap-2"><label class="flex min-h-10 items-center justify-center gap-2 rounded-md border border-blue-300 bg-blue-50 text-sm font-medium text-blue-800"><input type="radio" name="web-post-defect-mode" value="INCREASE" checked data-web-post-defect-adjustment-mode />增加瑕疵</label><label class="flex min-h-10 items-center justify-center gap-2 rounded-md border text-sm font-medium"><input type="radio" name="web-post-defect-mode" value="DECREASE" data-web-post-defect-adjustment-mode />减少瑕疵</label></div><div class="grid gap-2 sm:grid-cols-2">${POST_FINISHING_DEFECT_REASON_OPTIONS.map((reason) => { const currentQty = draft?.defectReasonQuantities?.find((item) => item.reason === reason)?.quantity ?? 0; return `<label class="flex items-center justify-between gap-3 rounded-md border p-2 text-sm"><span>${escapeHtml(reason)}<span class="ml-1 text-xs text-muted-foreground">当前 ${currentQty}</span></span><input type="number" min="0" max="${line.expectedQty}" step="1" value="0" class="h-9 w-20 rounded-md border px-2 text-right" data-web-post-defect-reason-qty data-reason="${escapeHtml(reason)}" /></label>` }).join('')}</div></div>
        <div class="space-y-3"><div><h3 class="font-semibold">返厂处理</h3><p class="mt-1 text-xs text-muted-foreground">没有返厂时保持 0；接收对象必须从可搜索列表选择。</p></div><label class="block text-sm">返厂数量<input type="number" min="0" max="${line.expectedQty}" step="1" value="${draft?.returnQty ?? 0}" class="mt-1 h-10 w-full rounded-md border px-3 text-right" data-web-post-adjust-field="returnQty" /></label><label class="block text-sm">返厂原因<input value="${escapeHtml(draft?.returnReason || '')}" class="mt-1 h-10 w-full rounded-md border px-3" data-web-post-adjust-field="returnReason" /></label><label class="block text-sm">接收对象<input list="${escapeHtml(receiverListId)}" value="${escapeHtml(draft?.returnReceiver || '')}" placeholder="输入名称搜索并选择" class="mt-1 h-10 w-full rounded-md border px-3" data-web-post-adjust-field="returnReceiver" /><datalist id="${escapeHtml(receiverListId)}">${receiverOptions.map((option) => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.description)}</option>`).join('')}</datalist></label><div class="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">当前已记录瑕疵/返厂 ${adjustedQty} / ${line.expectedQty} 件。整批均为瑕疵或返厂时，无需先填完成数量。</div></div>
      </section>
      <button type="button" class="rounded-md bg-blue-600 px-5 py-2.5 text-sm font-medium text-white" data-post-finishing-work-order-detail-action="save-adjustment" data-task-id="${escapeHtml(task.postTaskId)}" data-sku-id="${escapeHtml(skuId)}">保存并返回后道单</button>
    </div>
  `
}

function renderFullFlowTaskDetail(task: PostFinishingPostTask): string {
  const skuId = fullFlowQuery().get('skuId') || ''
  if (skuId) return `<div class="space-y-4 p-4">${renderPostFinishingPageHeader('后道单 Web 应急处理', `${task.postTaskNo} / SKU 调整`)}${renderFullFlowMessage()}${renderFullFlowSkuAdjustment(task, skuId)}</div>`
  const actor = webFallbackActor()
  const isStarted = task.status === '后道中'
  const isOwner = Boolean(isStarted && task.startedBy?.actorId === actor.actorId)
  const drafts = task.draftLines ?? []
  const progress = task.lines.map((line) => {
    const result = task.results?.find((item) => item.sku.skuId === line.sku.skuId)
    const draft = drafts.find((item) => item.skuId === line.sku.skuId)
    const completedQty = result?.completedQty ?? draft?.completedQty ?? 0
    const defectQty = result?.defectQty ?? draft?.defectQty ?? 0
    const returnQty = result?.returnQty ?? draft?.returnQty ?? 0
    const adjustedQty = defectQty + returnQty
    const resolvedQty = completedQty > 0 ? completedQty : adjustedQty
    return {
      line,
      result,
      draft,
      completedQty,
      defectQty,
      returnQty,
      resolvedQty,
      quantityResolved: line.expectedQty === 0 || completedQty > 0 || adjustedQty === line.expectedQty,
    }
  })
  const completedLineCount = progress.filter((item) => item.quantityResolved).length
  const allCompleted = completedLineCount === task.lines.length
  const totalExpectedQty = task.lines.reduce((sum, line) => sum + line.expectedQty, 0)
  const totalResolvedQty = progress.reduce((sum, item) => sum + item.resolvedQty, 0)
  const rows = progress.map(({ line, result, completedQty, defectQty, returnQty, resolvedQty, quantityResolved }) => {
    const passedQty = result?.passedQty ?? Math.max(0, resolvedQty - defectQty - returnQty)
    return `<article class="rounded-xl border bg-card p-4" data-web-post-completion-line="${escapeHtml(line.sku.skuId)}"><div class="flex items-start gap-3">${renderFullFlowSkuImage(task, line)}<div class="min-w-0 flex-1"><div class="font-mono text-sm font-semibold">${escapeHtml(line.sku.skuCode)}</div><div class="mt-1 text-xs text-muted-foreground">${escapeHtml(line.sku.spuName)} · ${escapeHtml(line.sku.colorName)} / ${escapeHtml(line.sku.sizeName)} · 应加工 ${line.expectedQty} 件</div></div><div class="text-right text-xs"><div class="font-medium">${completedQty > 0 ? `完成 ${completedQty} 件` : quantityResolved ? '整批已归为瑕疵或返厂' : '完成数量未填写'} · 合格 ${passedQty} 件</div><div class="mt-1 ${defectQty || returnQty ? 'text-amber-700' : 'text-emerald-700'}">瑕疵 ${defectQty} / 返厂 ${returnQty}</div></div></div><div class="mt-3 flex gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3"><label class="min-w-0 flex-1 text-sm font-medium text-blue-950">完成数量<input type="number" min="0" max="${line.expectedQty}" step="1" value="${completedQty || ''}" placeholder="填写完成件数" class="mt-1 h-10 w-full rounded-md border bg-white px-3 text-right" data-web-post-completed-qty ${isOwner ? '' : 'disabled'} /></label>${isOwner ? `<button type="button" class="mt-6 h-10 rounded-md bg-blue-600 px-4 text-sm font-medium text-white" data-post-finishing-work-order-detail-action="save-completed-qty" data-task-id="${escapeHtml(task.postTaskId)}" data-sku-id="${escapeHtml(line.sku.skuId)}">保存</button>` : ''}</div>${task.status === '后道中' ? `<div class="mt-3 flex justify-end"><button type="button" data-post-finishing-work-order-detail-action="open-adjustment" data-task-id="${escapeHtml(task.postTaskId)}" data-sku-id="${escapeHtml(line.sku.skuId)}" class="rounded-md border border-blue-300 px-3 py-2 text-xs font-medium text-blue-700">调整瑕疵</button></div>` : ''}</article>`
  }).join('')
  const qcTask = getPostFinishingFullFlowQcTask(task.qcTaskId)
  const hasDifference = allCompleted && progress.some(({ line, resolvedQty }) => {
    const qcResult = qcTask?.results?.find((item) => item.sku.skuId === line.sku.skuId)
    return resolvedQty !== line.expectedQty
      || resolvedQty + (qcResult?.defectQty ?? 0) + (qcResult?.returnQty ?? 0) !== (qcResult?.expectedQty ?? line.expectedQty)
  })
  return `
    <div class="space-y-4 p-4" data-web-post-task="${escapeHtml(task.postTaskId)}" data-skip-page-rerender="true">
      ${renderPostFinishingPageHeader('后道单 Web 应急处理', `${task.postTaskNo} / ${task.productionOrderNo}`)}
      ${renderFullFlowMessage()}
      <section class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4"><div><div class="font-semibold text-blue-950">现场优先使用 PDA</div><p class="mt-1 text-sm text-blue-800">PDA 不可用时，可在本页继续同一张后道单；完成数量、瑕疵原因明细、操作人和时间共用同一事实。</p></div><div class="flex gap-2"><a data-nav="/fcs/pda/post-finishing/execute?id=${encodeURIComponent(task.postTaskNo)}" class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white">打开 PDA（优先）</a><a data-nav="/fcs/craft/post-finishing/work-orders" class="rounded-md border bg-white px-4 py-2 text-sm">返回列表</a></div></section>
      <section class="rounded-xl border bg-card p-4"><div class="flex flex-wrap items-start justify-between gap-4"><div><div class="font-mono text-lg font-semibold">${escapeHtml(task.postTaskNo)}</div><div class="mt-1 text-sm text-muted-foreground">质检单 ${escapeHtml(task.qcTaskNo)} · 根送货单 ${escapeHtml(task.deliveryOrderNo)}</div><div class="mt-2 text-sm"><span class="font-medium">质检已确认加工项目：</span>${task.processItems.map(escapeHtml).join('、')}</div></div><div class="text-right">${renderPostStatusBadge(task.status)}<div class="mt-2 text-xs text-muted-foreground">当前操作人：${escapeHtml(task.startedBy?.actorName || '尚未开始')}</div></div></div><div class="mt-4 grid gap-3 md:grid-cols-3"><div class="rounded-lg bg-slate-50 p-3"><div class="text-xs text-muted-foreground">SKU 数量归类</div><div class="mt-1 font-semibold ${allCompleted ? 'text-emerald-700' : 'text-amber-700'}">${completedLineCount} / ${task.lines.length} 已处理</div></div><div class="rounded-lg bg-slate-50 p-3"><div class="text-xs text-muted-foreground">应加工</div><div class="mt-1 font-semibold">${totalExpectedQty} 件</div></div><div class="rounded-lg bg-slate-50 p-3"><div class="text-xs text-muted-foreground">已处理</div><div class="mt-1 font-semibold">${totalResolvedQty} 件</div></div></div></section>
      ${task.status === '待后道' ? `<button type="button" class="rounded-md bg-amber-600 px-5 py-2.5 text-sm font-medium text-white" data-post-finishing-work-order-detail-action="start" data-task-no="${escapeHtml(task.postTaskNo)}">PDA 故障，使用 Web 开始后道</button>` : ''}
      ${isStarted && !isOwner ? `<section class="rounded-xl border border-amber-200 bg-amber-50 p-4"><h3 class="font-semibold text-amber-900">任务当前由 ${escapeHtml(task.startedBy?.actorName || '其他操作员')} 处理</h3><p class="mt-1 text-sm text-amber-800">确认 PDA 已不可用且需要 Web 继续时，填写原因后应急接管；原操作人和接管原因会进入日志。</p><div class="mt-3 flex gap-2"><input class="h-10 min-w-0 flex-1 rounded-md border bg-white px-3 text-sm" placeholder="例如：PDA损坏，改由Web继续" data-web-post-takeover-reason /><button type="button" class="rounded-md bg-amber-700 px-4 text-sm font-medium text-white" data-post-finishing-work-order-detail-action="takeover" data-task-id="${escapeHtml(task.postTaskId)}">确认应急接管</button></div></section>` : ''}
      <section class="grid gap-4 xl:grid-cols-2">${rows}</section>
      ${isOwner ? `${hasDifference ? `<section class="grid gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 md:grid-cols-2"><label class="text-sm text-amber-900">差异原因<input class="mt-1 h-10 w-full rounded-md border bg-white px-3" data-web-post-difference-reason /></label><label class="text-sm text-amber-900">动态授权码<textarea class="mt-1 min-h-20 w-full rounded-md border bg-white px-3 py-2 font-mono text-xs" data-web-post-authorization></textarea></label></section>` : ''}<button type="button" class="w-full rounded-md px-5 py-3 text-sm font-semibold ${allCompleted ? 'bg-blue-600 text-white' : 'cursor-not-allowed bg-slate-200 text-slate-500'}" data-post-finishing-work-order-detail-action="complete" data-task-id="${escapeHtml(task.postTaskId)}" ${allCompleted ? '' : 'disabled'}>${allCompleted ? '完成后道并生成复检单' : `还有 ${task.lines.length - completedLineCount} 个 SKU 未完成数量归类`}</button>` : ''}
      ${task.status === '后道完成' ? `<section class="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">后道已完成，复检单：${escapeHtml(task.recheckOrderNo || '生成中')}</section>` : ''}
    </div>
  `
}

function webField(root: ParentNode, selector: string): string {
  return root.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(selector)?.value.trim() || ''
}

function webNumber(root: ParentNode, selector: string): number {
  return Number(webField(root, selector) || 0)
}

export function handlePostFinishingWorkOrderDetailEvent(target: HTMLElement): boolean {
  if (typeof window === 'undefined' || !window.location.pathname.startsWith('/fcs/craft/post-finishing/work-orders/')) return false
  const actionNode = target.closest<HTMLElement>('[data-post-finishing-work-order-detail-action]')
  const action = actionNode?.dataset.postFinishingWorkOrderDetailAction
  if (!action) return false
  const taskId = actionNode?.dataset.taskId || window.location.pathname.split('/').pop() || ''
  try {
    const actor = webFallbackActor()
    if (action === 'start') {
      const task = startPostFinishingPostTask({ postTaskNo: actionNode?.dataset.taskNo || '', actor })
      fullFlowMessage = 'Web 应急处理已开始，请逐 SKU 填写完成数量。'
      fullFlowMessageTone = 'success'
      refreshFullFlowDetail(task.postTaskId)
      return true
    }
    if (action === 'takeover') {
      const task = takeOverPostFinishingPostTask({ postTaskId: taskId, actor, reason: webField(document, '[data-web-post-takeover-reason]') })
      fullFlowMessage = 'Web 应急接管成功，原操作人与原因已写入日志。'
      fullFlowMessageTone = 'success'
      refreshFullFlowDetail(task.postTaskId)
      return true
    }
    if (action === 'save-completed-qty') {
      const line = actionNode.closest<HTMLElement>('[data-web-post-completion-line]')
      const task = setPostFinishingPostCompletedQuantity({
        postTaskId: taskId,
        skuId: actionNode.dataset.skuId || '',
        completedQty: webNumber(line || document, '[data-web-post-completed-qty]'),
        actor,
      })
      fullFlowMessage = '完成数量已保存到 PDA 与 Web 共用草稿。'
      fullFlowMessageTone = 'success'
      refreshFullFlowDetail(task.postTaskId)
      return true
    }
    if (action === 'open-adjustment') {
      appStore.navigate(fullFlowDetailHref(taskId, actionNode.dataset.skuId || ''))
      return true
    }
    if (action === 'save-adjustment') {
      const root = document.querySelector<HTMLElement>('[data-web-post-adjust-root]')
      if (!root) throw new Error('未找到 SKU 调整表单。')
      const adjustmentMode = root.querySelector<HTMLInputElement>('[data-web-post-defect-adjustment-mode]:checked')?.value === 'DECREASE'
        ? 'DECREASE'
        : 'INCREASE'
      const task = savePostFinishingPostSkuAdjustment({
        postTaskId: taskId,
        skuId: actionNode.dataset.skuId || '',
        adjustmentMode,
        defectReasonQuantities: Array.from(root.querySelectorAll<HTMLInputElement>('[data-web-post-defect-reason-qty]')).map((input) => ({
          reason: input.dataset.reason || '',
          quantity: Number(input.value || 0),
        })),
        returnQty: webNumber(root, '[data-web-post-adjust-field="returnQty"]'),
        returnReason: webField(root, '[data-web-post-adjust-field="returnReason"]'),
        returnReceiver: webField(root, '[data-web-post-adjust-field="returnReceiver"]'),
        actor,
      })
      fullFlowMessage = 'SKU 瑕疵原因数量与返厂信息已保存到共享草稿。'
      fullFlowMessageTone = 'success'
      refreshFullFlowDetail(task.postTaskId)
      return true
    }
    if (action === 'complete') {
      const authorization = webField(document, '[data-web-post-authorization]')
      const task = completePostFinishingPostTaskFromDraft({ postTaskId: taskId, actor, authorization: authorization ? { scanValue: authorization, differenceReason: webField(document, '[data-web-post-difference-reason]') } : undefined })
      fullFlowMessage = `后道完成，复检单 ${task.recheckOrderNo || '已生成'}。`
      fullFlowMessageTone = 'success'
      refreshFullFlowDetail(task.postTaskId)
      return true
    }
  } catch (error) {
    fullFlowMessage = error instanceof Error ? error.message : String(error)
    fullFlowMessageTone = 'error'
    refreshFullFlowDetail(taskId, fullFlowQuery().get('skuId') || '')
    return true
  }
  return false
}

export function renderPostFinishingWorkOrderDetailPage(postOrderId: string): string {
  const fullFlowTask = getPostFinishingFullFlowPostTask(postOrderId)
  if (fullFlowTask) return renderFullFlowTaskDetail(fullFlowTask)
  registerPostWorkOrderDetailActions()
  const order = getPostFinishingWorkOrderById(postOrderId)
  if (!order) {
    return `
      <div class="space-y-4 p-4">
        ${renderPostFinishingPageHeader('后道单详情')}
        ${renderPostSection('未找到后道单', `
          <div class="space-y-3 text-sm text-muted-foreground">
            <p>未找到后道单：${escapeHtml(postOrderId)}</p>
            ${renderPostAction('返回后道单列表', '/fcs/craft/post-finishing/work-orders')}
          </div>
        `)}
      </div>
    `
  }

  return `
    <div class="space-y-4 p-4">
      ${renderPostFinishingPageHeader('后道单详情', `${order.postOrderNo} / ${order.currentFactoryName}`)}
      ${renderActionBar(order)}
      ${renderTabBody(order)}
    </div>
  `
}
