// @page-pattern: detail

import {
  POST_FINISHING_ACCEPTANCE_ACTORS,
  completePostFinishingPostTaskFromDraft,
  getCurrentPostFinishingActor,
  getPostFinishingFullFlowPostTask,
  getPostFinishingMaterialReadiness,
  setPostFinishingPostProcessedQuantity,
  setPostFinishingPostUnprocessedQuantity,
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
  renderPostStatusBadge,
  renderPostSection,
} from './shared.ts'

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
  if (!line) return renderPostSection('未找到 SKU', `<a data-nav="${escapeHtml(fullFlowDetailHref(task.postTaskId))}" class="text-sm text-blue-700">返回后道加工单</a>`)
  const currentActor = webFallbackActor()
  const editable = task.status === '后道中' && task.startedBy?.actorId === currentActor.actorId
  const draft = task.draftLines?.find((item) => item.skuId === skuId)
  if (!editable) {
    return renderPostSection('SKU 未处理数量', `<div class="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">当前加工单由 ${escapeHtml(task.startedBy?.actorName || '其他操作员')} 处理。请返回加工单详情完成接管后再填写。</div><a data-nav="${escapeHtml(fullFlowDetailHref(task.postTaskId))}" class="mt-3 inline-flex rounded-md border px-4 py-2 text-sm">返回后道加工单</a>`)
  }
  const processedQty = draft?.processedQty ?? 0
  const unprocessedQty = draft?.unprocessedQty ?? 0
  return `
    <div class="space-y-4" data-web-post-adjust-root data-task-id="${escapeHtml(task.postTaskId)}" data-sku-id="${escapeHtml(skuId)}">
      <div class="flex items-center justify-between gap-3"><a data-nav="${escapeHtml(fullFlowDetailHref(task.postTaskId))}" class="text-sm text-blue-700 hover:underline">← 返回后道加工单</a><span class="text-xs text-muted-foreground">加工数据与现场执行端同步</span></div>
      <section class="rounded-xl border bg-card p-4"><div class="flex items-center gap-3">${renderFullFlowSkuImage(task, line)}<div><div class="font-mono text-sm font-semibold">${escapeHtml(line.sku.skuCode)}</div><div class="mt-1 text-xs text-muted-foreground">${escapeHtml(line.sku.spuName)} · ${escapeHtml(line.sku.colorName)} / ${escapeHtml(line.sku.sizeName)}</div><div class="mt-1 text-sm">应处理 ${line.expectedQty} 件 · 已处理 ${processedQty} 件</div></div></div></section>
      <section class="space-y-4 rounded-xl border bg-card p-4">
        <div><h3 class="font-semibold">未处理数量与说明</h3><p class="mt-1 text-xs text-muted-foreground">后道加工不再次判定质量或返厂；只记录本次已处理和未处理数量。未处理数量大于 0 时必须说明现场原因。</p></div>
        <label class="block text-sm">未处理数量<input type="number" min="0" max="${line.expectedQty}" step="1" value="${unprocessedQty}" class="mt-1 h-10 w-full rounded-md border px-3 text-right" data-web-post-adjust-field="unprocessedQty" /></label>
        <label class="block text-sm">未处理说明<textarea class="mt-1 min-h-24 w-full rounded-md border px-3 py-2" placeholder="未处理数量大于 0 时必填" data-web-post-adjust-field="unprocessedReason">${escapeHtml(draft?.unprocessedReason || '')}</textarea></label>
        <div class="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">应处理 ${line.expectedQty} 件 · 已处理 ${processedQty} 件 · 未处理 ${unprocessedQty} 件 · 当前合计 ${processedQty + unprocessedQty} 件</div>
      </section>
      <button type="button" class="rounded-md bg-blue-600 px-5 py-2.5 text-sm font-medium text-white" data-post-finishing-work-order-detail-action="save-unprocessed" data-task-id="${escapeHtml(task.postTaskId)}" data-sku-id="${escapeHtml(skuId)}">保存并返回后道加工单</button>
    </div>
  `
}

function renderFullFlowTaskDetail(task: PostFinishingPostTask): string {
  const skuId = fullFlowQuery().get('skuId') || ''
  if (skuId) return `<div class="space-y-4 p-4">${renderPostFinishingPageHeader('执行后道加工单', `${task.postTaskNo} / SKU 未处理数量`, `<a data-nav="${escapeHtml(fullFlowDetailHref(task.postTaskId))}" class="inline-flex h-9 items-center rounded-md border bg-white px-3 text-sm">返回后道加工单</a>`)}${renderFullFlowMessage()}${renderFullFlowSkuAdjustment(task, skuId)}</div>`
  const actor = webFallbackActor()
  const isStarted = task.status === '后道中'
  const isOwner = Boolean(isStarted && task.startedBy?.actorId === actor.actorId)
  const drafts = task.draftLines ?? []
  const progress = task.lines.map((line) => {
    const result = task.results?.find((item) => item.sku.skuId === line.sku.skuId)
    const draft = drafts.find((item) => item.skuId === line.sku.skuId)
    const processedQty = result?.processedQty ?? draft?.processedQty ?? 0
    const unprocessedQty = result?.unprocessedQty ?? draft?.unprocessedQty ?? 0
    return {
      line,
      result,
      draft,
      processedQty,
      unprocessedQty,
      quantityResolved: processedQty + unprocessedQty === line.expectedQty,
    }
  })
  const completedLineCount = progress.filter((item) => item.quantityResolved).length
  const allCompleted = completedLineCount === task.lines.length
  const totalExpectedQty = task.lines.reduce((sum, line) => sum + line.expectedQty, 0)
  const totalProcessedQty = progress.reduce((sum, item) => sum + item.processedQty, 0)
  const totalUnprocessedQty = progress.reduce((sum, item) => sum + item.unprocessedQty, 0)
  const rows = progress.map(({ line, processedQty, unprocessedQty, quantityResolved }) => {
    return `<article class="rounded-xl border bg-card p-4" data-web-post-completion-line="${escapeHtml(line.sku.skuId)}"><div class="flex items-start gap-3">${renderFullFlowSkuImage(task, line)}<div class="min-w-0 flex-1"><div class="font-mono text-sm font-semibold">${escapeHtml(line.sku.skuCode)}</div><div class="mt-1 text-xs text-muted-foreground">${escapeHtml(line.sku.spuName)} · ${escapeHtml(line.sku.colorName)} / ${escapeHtml(line.sku.sizeName)} · 应处理 ${line.expectedQty} 件</div></div><div class="text-right text-xs"><div class="font-medium">已处理 ${processedQty} 件</div><div class="mt-1 ${quantityResolved ? 'text-emerald-700' : 'text-amber-700'}">未处理 ${unprocessedQty} 件 · 合计 ${processedQty + unprocessedQty} 件</div></div></div><div class="mt-3 flex gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3"><label class="min-w-0 flex-1 text-sm font-medium text-blue-950">已处理数量<input type="number" min="0" max="${line.expectedQty}" step="1" value="${processedQty}" class="mt-1 h-10 w-full rounded-md border bg-white px-3 text-right" data-web-post-processed-qty ${isOwner ? '' : 'disabled'} /></label>${isOwner ? `<button type="button" class="mt-6 h-10 rounded-md bg-blue-600 px-4 text-sm font-medium text-white" data-post-finishing-work-order-detail-action="save-processed-qty" data-task-id="${escapeHtml(task.postTaskId)}" data-sku-id="${escapeHtml(line.sku.skuId)}">保存</button>` : ''}</div>${task.status === '后道中' ? `<div class="mt-3 flex justify-end"><button type="button" data-post-finishing-work-order-detail-action="open-adjustment" data-task-id="${escapeHtml(task.postTaskId)}" data-sku-id="${escapeHtml(line.sku.skuId)}" class="rounded-md border border-blue-300 px-3 py-2 text-xs font-medium text-blue-700">填写未处理数量</button></div>` : ''}</article>`
  }).join('')
  const materialReadiness = getPostFinishingMaterialReadiness(task.productionOrderNo)
  const headerActions = `<div class="flex flex-wrap items-center justify-end gap-2">${task.status === '待后道' ? `<button type="button" class="inline-flex h-9 items-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white" data-post-finishing-work-order-detail-action="start" data-task-no="${escapeHtml(task.postTaskNo)}">开始后道</button>` : ''}<a data-nav="/fcs/craft/post-finishing/work-orders" class="inline-flex h-9 items-center rounded-md border bg-white px-3 text-sm">返回列表</a></div>`
  return `
    <div class="space-y-4 p-4" data-web-post-task="${escapeHtml(task.postTaskId)}" data-skip-page-rerender="true">
      ${renderPostFinishingPageHeader('执行后道加工单', `${task.postTaskNo} / ${task.productionOrderNo}`, headerActions)}
      ${renderFullFlowMessage()}
      ${materialReadiness.applicable && materialReadiness.status !== '已入库' ? `<section class="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900"><strong>后道辅料未到齐。</strong>${escapeHtml(materialReadiness.label)}。当前仅提示，不阻断开始或完成后道加工。${materialReadiness.transferOrderNo ? `<a data-nav="/fcs/craft/post-finishing/material-transfers?keyword=${encodeURIComponent(materialReadiness.transferOrderNo)}" class="ml-2 font-mono text-blue-700 underline">${escapeHtml(materialReadiness.transferOrderNo)}</a>` : ''}</section>` : ''}
      <section class="rounded-xl border bg-card p-4"><div class="flex flex-wrap items-start justify-between gap-4"><div><div class="font-mono text-lg font-semibold">${escapeHtml(task.postTaskNo)}</div><div class="mt-1 text-sm text-muted-foreground">质检单 ${escapeHtml(task.qcTaskNo)} · 根送货单 ${escapeHtml(task.deliveryOrderNo)}</div><div class="mt-2 text-sm"><span class="font-medium">本批后道项目：</span>${task.processItems.map(escapeHtml).join('、')}</div></div><div class="text-right">${renderPostStatusBadge(task.status)}<div class="mt-2 text-xs text-muted-foreground">当前操作人：${escapeHtml(task.startedBy?.actorName || '尚未开始')}</div></div></div><div class="mt-4 grid gap-3 md:grid-cols-4"><div class="rounded-lg bg-slate-50 p-3"><div class="text-xs text-muted-foreground">SKU 数量归类</div><div class="mt-1 font-semibold ${allCompleted ? 'text-emerald-700' : 'text-amber-700'}">${completedLineCount} / ${task.lines.length} 已归类</div></div><div class="rounded-lg bg-slate-50 p-3"><div class="text-xs text-muted-foreground">应处理</div><div class="mt-1 font-semibold">${totalExpectedQty} 件</div></div><div class="rounded-lg bg-slate-50 p-3"><div class="text-xs text-muted-foreground">已处理</div><div class="mt-1 font-semibold">${totalProcessedQty} 件</div></div><div class="rounded-lg bg-slate-50 p-3"><div class="text-xs text-muted-foreground">未处理</div><div class="mt-1 font-semibold">${totalUnprocessedQty} 件</div></div></div></section>
      ${isStarted && !isOwner ? `<section class="rounded-xl border border-amber-200 bg-amber-50 p-4"><h3 class="font-semibold text-amber-900">加工单当前由 ${escapeHtml(task.startedBy?.actorName || '其他操作员')} 处理</h3><p class="mt-1 text-sm text-amber-800">需要由当前 Web 账号继续时，填写接管原因；原操作人和接管原因会进入日志。</p><div class="mt-3 flex gap-2"><input class="h-10 min-w-0 flex-1 rounded-md border bg-white px-3 text-sm" placeholder="请填写 Web 接管原因" data-web-post-takeover-reason /><button type="button" class="rounded-md bg-amber-700 px-4 text-sm font-medium text-white" data-post-finishing-work-order-detail-action="takeover" data-task-id="${escapeHtml(task.postTaskId)}">确认接管</button></div></section>` : ''}
      <section class="grid gap-4 xl:grid-cols-2">${rows}</section>
      ${isOwner ? `<button type="button" class="w-full rounded-md px-5 py-3 text-sm font-semibold ${allCompleted ? 'bg-blue-600 text-white' : 'cursor-not-allowed bg-slate-200 text-slate-500'}" data-post-finishing-work-order-detail-action="complete" data-task-id="${escapeHtml(task.postTaskId)}" ${allCompleted ? '' : 'disabled'}>${allCompleted ? '完成后道并生成处理后交出复核单' : `还有 ${task.lines.length - completedLineCount} 个 SKU 未完成数量归类`}</button>` : ''}
      ${task.status === '后道完成' ? `<section class="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">后道处理已完成，处理后交出复核单：${escapeHtml(task.recheckOrderNo || '生成中')}</section>` : ''}
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
      fullFlowMessage = '后道加工已开始，请逐 SKU 填写已处理和未处理数量。'
      fullFlowMessageTone = 'success'
      refreshFullFlowDetail(task.postTaskId)
      return true
    }
    if (action === 'takeover') {
      const task = takeOverPostFinishingPostTask({ postTaskId: taskId, actor, reason: webField(document, '[data-web-post-takeover-reason]') })
      fullFlowMessage = '后道加工单接管成功，原操作人与接管原因已写入日志。'
      fullFlowMessageTone = 'success'
      refreshFullFlowDetail(task.postTaskId)
      return true
    }
    if (action === 'save-processed-qty') {
      const line = actionNode.closest<HTMLElement>('[data-web-post-completion-line]')
      const task = setPostFinishingPostProcessedQuantity({
        postTaskId: taskId,
        skuId: actionNode.dataset.skuId || '',
        processedQty: webNumber(line || document, '[data-web-post-processed-qty]'),
        actor,
      })
      fullFlowMessage = '已处理数量已保存到 PDA 与 Web 共用草稿。'
      fullFlowMessageTone = 'success'
      refreshFullFlowDetail(task.postTaskId)
      return true
    }
    if (action === 'open-adjustment') {
      appStore.navigate(fullFlowDetailHref(taskId, actionNode.dataset.skuId || ''))
      return true
    }
    if (action === 'save-unprocessed') {
      const root = document.querySelector<HTMLElement>('[data-web-post-adjust-root]')
      if (!root) throw new Error('未找到 SKU 未处理数量表单。')
      const task = setPostFinishingPostUnprocessedQuantity({
        postTaskId: taskId,
        skuId: actionNode.dataset.skuId || '',
        unprocessedQty: webNumber(root, '[data-web-post-adjust-field="unprocessedQty"]'),
        unprocessedReason: webField(root, '[data-web-post-adjust-field="unprocessedReason"]'),
        actor,
      })
      fullFlowMessage = 'SKU 未处理数量与说明已保存到共享草稿。'
      fullFlowMessageTone = 'success'
      refreshFullFlowDetail(task.postTaskId)
      return true
    }
    if (action === 'complete') {
      const task = completePostFinishingPostTaskFromDraft({ postTaskId: taskId, actor })
      fullFlowMessage = `后道处理完成，处理后交出复核单 ${task.recheckOrderNo || '已生成'}。`
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
  return `
    <div class="space-y-4 p-4">
      ${renderPostFinishingPageHeader('后道加工单详情', '', renderPostAction('返回后道加工单列表', '/fcs/craft/post-finishing/work-orders'))}
      ${renderPostSection('未找到当前后道加工单', `
        <div class="space-y-3 text-sm text-muted-foreground">
          <p>当前后道全流程中未找到加工单：${escapeHtml(postOrderId)}</p>
          <p>历史旧后道加工单仅保留迁移审计，不再从本页面继续加工、质检或出货。</p>
          ${renderPostAction('返回后道加工单列表', '/fcs/craft/post-finishing/work-orders')}
        </div>
      `)}
    </div>
  `
}
