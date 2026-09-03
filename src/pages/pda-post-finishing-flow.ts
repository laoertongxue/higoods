// @page-pattern: pda

import {
  POST_FINISHING_DEFECT_REASON_OPTIONS,
  claimPostFinishingRecheckOrder,
  confirmPostFinishingFactoryReturn,
  completePostFinishingPostTaskFromDraft,
  completePostFinishingRecheckOrderFullFlow,
  getPostFinishingFactoryReturn,
  getPostFinishingFullFlowOutboundOrder,
  getPostFinishingFullFlowPostTask,
  getPostFinishingFullFlowQcTask,
  getPostFinishingFullFlowRecheckOrder,
  listPostFinishingPostReturnReceiverOptions,
  markPostFinishingRecheckSkuRelabeled,
  receivePostFinishingOutboundOrder,
  releasePostFinishingRecheckOrder,
  listPostFinishingWarehouseReceipts,
  scanPostFinishingRecheckSkuBarcode,
  savePostFinishingPostSkuAdjustment,
  setPostFinishingPostCompletedQuantity,
  startPostFinishingPostTask,
  type PostFinishingActor,
  type PostFinishingFactoryReturnDelivery,
  type PostFinishingPostTask,
  type PostFinishingRecheckOrder,
} from '../data/fcs/post-finishing-full-flow.ts'
import { appStore } from '../state/store.ts'
import { escapeHtml } from '../utils.ts'
import { getPdaRuntimeContext, renderPdaLoginRedirect } from './pda-runtime.ts'

let message = ''
let messageTone: 'success' | 'error' = 'success'

function query(): URLSearchParams {
  return typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search)
}

function actor(roleName: string): PostFinishingActor {
  const runtime = getPdaRuntimeContext()
  if (!runtime) throw new Error('请先登录 PDA。')
  return { actorId: runtime.userId, actorName: runtime.userName, roleName }
}

function refresh(path: string, id = query().get('id') || '', extra: Record<string, string> = {}): void {
  const search = new URLSearchParams({ refresh: String(Date.now()) })
  if (id) search.set('id', id)
  Object.entries(extra).forEach(([key, value]) => {
    if (value) search.set(key, value)
  })
  appStore.navigate(`${path}?${search.toString()}`)
}

function notice(): string {
  if (!message) return ''
  const tone = messageTone === 'error'
    ? 'border-red-200 bg-red-50 text-red-700'
    : 'border-emerald-200 bg-emerald-50 text-emerald-700'
  return `<div role="status" class="rounded-2xl border px-3 py-2 text-sm ${tone}">${escapeHtml(message)}</div>`
}

function shell(title: string, subtitle: string, body: string, testId: string): string {
  const runtime = getPdaRuntimeContext()
  if (!runtime) return renderPdaLoginRedirect(title)
  return `
    <div class="min-h-screen bg-slate-100 pb-8" data-testid="${testId}">
      <header class="sticky top-0 z-20 border-b bg-white px-4 py-3 shadow-sm">
        <div class="mx-auto max-w-[480px]">
          <div class="text-[11px] text-slate-500">${escapeHtml(subtitle)} · ${escapeHtml(runtime.userName)}</div>
          <h1 class="text-base font-semibold">${escapeHtml(title)}</h1>
        </div>
      </header>
      <main class="mx-auto max-w-[480px] space-y-4 p-4">${notice()}${body}</main>
    </div>
  `
}

function scanner(input: { label: string; placeholder: string; action: string; field: string; help: string }): string {
  return `
    <section class="rounded-2xl border bg-white p-4 shadow-sm">
      <h2 class="font-semibold">${escapeHtml(input.label)}</h2>
      <p class="mt-1 text-xs text-slate-500">${escapeHtml(input.help)}</p>
      <div class="mt-4 flex gap-2">
        <input autofocus class="h-12 min-w-0 flex-1 rounded-xl border px-3 font-mono text-sm" placeholder="${escapeHtml(input.placeholder)}" data-pda-post-field="${escapeHtml(input.field)}" data-pda-scan-enter="true" data-skip-page-rerender="true" />
        <button type="button" class="shrink-0 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white" data-pda-post-action="${escapeHtml(input.action)}">查询</button>
      </div>
    </section>
  `
}

function image(sku: { imageUrl: string; skuCode: string; spuName: string; colorName: string; sizeName: string }): string {
  const label = `${sku.skuCode} ${sku.colorName} ${sku.sizeName}`
  return `
    <button type="button" class="relative flex h-16 w-16 shrink-0 cursor-zoom-in items-center justify-center overflow-hidden rounded-xl border bg-white" data-pda-post-action="zoom-image" data-image-url="${escapeHtml(sku.imageUrl)}" data-image-label="${escapeHtml(label)}">
      <img src="${escapeHtml(sku.imageUrl)}" alt="${escapeHtml(`${sku.spuName} ${sku.colorName} ${sku.sizeName}`)}" class="h-full w-full object-cover" onload="this.nextElementSibling.hidden=true" onerror="this.hidden=true;this.nextElementSibling.textContent='图片加载失败';this.nextElementSibling.hidden=false" />
      <span class="px-1 text-center text-[10px] text-slate-500">图片加载中…</span>
    </button>
  `
}

function authorizationBlock(prefix: string, visible = true): string {
  return `
    <div class="${visible ? '' : 'hidden '}rounded-2xl border border-amber-200 bg-amber-50 p-3" data-difference-authorization-block="${escapeHtml(prefix)}">
      <div class="text-xs font-semibold text-amber-900">逐 SKU 数量存在任何差异时必须授权</div>
      <label class="mt-2 block text-xs text-amber-900">差异原因
        <input class="mt-1 h-10 w-full rounded-xl border bg-white px-3" data-${prefix}-difference-reason data-skip-page-rerender="true" />
      </label>
      <label class="mt-2 block text-xs text-amber-900">扫描指定人员的 30 秒动态授权码
        <textarea class="mt-1 min-h-20 w-full rounded-xl border bg-white px-3 py-2 font-mono text-[11px]" data-${prefix}-authorization data-skip-page-rerender="true"></textarea>
      </label>
    </div>
  `
}

function initialSummary(expectedQty: number, actualQty: number, detail: string, testId: string): string {
  const difference = actualQty - expectedQty
  const tone = difference === 0 ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-700'
  const differenceText = difference === 0 ? '数量一致' : `${difference > 0 ? '多' : '少'} ${Math.abs(difference)} 件，提交前需授权`
  return `<div class="mt-2 rounded-xl border px-3 py-2 text-xs ${tone}" data-quantity-summary="${testId}">${escapeHtml(detail)}；${differenceText}</div>`
}

function renderReturnConfirmation(record: PostFinishingFactoryReturnDelivery): string {
  const editable = ['待后道确认', '待二次点数', '差异待授权'].includes(record.status)
  const showSecond = ['待二次点数', '差异待授权'].includes(record.status)
  const showAuthorization = record.status === '差异待授权'
  const registeredTotal = record.lines.reduce((sum, line) => sum + line.registeredQty, 0)
  const currentTotal = record.lines.reduce((sum, line) => sum + (showSecond
    ? (line.secondCountQty ?? line.firstCountQty ?? line.registeredQty)
    : (line.firstCountQty ?? line.registeredQty)), 0)
  const lines = record.lines.map((line) => {
    const firstQty = line.firstCountQty ?? line.registeredQty
    const currentQty = showSecond ? (line.secondCountQty ?? firstQty) : firstQty
    return `
      <article class="rounded-2xl border bg-white p-3 shadow-sm" data-return-confirm-line="${escapeHtml(line.sku.skuId)}" data-expected-qty="${line.registeredQty}">
        <div class="flex gap-3">
          ${image(line.sku)}
          <div class="min-w-0 flex-1">
            <div class="truncate text-sm font-semibold">SPU ${escapeHtml(line.sku.spuCode)}</div>
            <div class="truncate text-xs font-medium">SKU ${escapeHtml(line.sku.skuCode)}</div>
            <div class="mt-1 text-xs text-slate-500">${escapeHtml(line.sku.colorName)} / ${escapeHtml(line.sku.sizeName)}</div>
            <div class="mt-1 text-xs font-semibold">工厂登记 ${line.registeredQty} 件</div>
          </div>
        </div>
        ${editable ? `<div class="mt-3 grid ${showSecond ? 'grid-cols-2' : 'grid-cols-1'} gap-2">
          ${showSecond ? `<label class="text-[11px] text-slate-500">第一次点数<input type="number" value="${firstQty}" disabled class="mt-1 h-10 w-full rounded-xl border bg-slate-100 px-2 text-right" data-return-first-count /></label>` : ''}
          <label class="text-[11px] text-slate-500">${showSecond ? '第二次点数' : '第一次点数'}<input type="number" min="0" step="1" inputmode="numeric" value="${currentQty}" class="mt-1 h-10 w-full rounded-xl border px-2 text-right text-base font-semibold" ${showSecond ? 'data-return-second-count' : 'data-return-first-count'} /></label>
        </div>${initialSummary(line.registeredQty, currentQty, `本行点数 ${currentQty} 件；差异率分母 ${line.registeredQty} 件`, 'return-line')}` : `<div class="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-800">最终确认 ${line.confirmedQty ?? line.registeredQty} 件</div>`}
      </article>
    `
  }).join('')
  return `
    <div class="space-y-4" data-pda-return-confirm="${escapeHtml(record.deliveryId)}" data-skip-page-rerender="true">
      <section class="rounded-2xl border border-blue-200 bg-blue-50 p-4">
        <button type="button" class="text-xs text-blue-700 underline" data-pda-post-action="clear-return">重新扫描</button>
        <div class="mt-2 flex items-start justify-between gap-3">
          <div><div class="font-mono text-sm font-semibold">${escapeHtml(record.deliveryOrderNo)}</div><div class="mt-1 text-xs text-blue-800">${escapeHtml(record.productionOrderNo)} · 第 ${record.returnIndex} 次回货</div></div>
          <span class="rounded-full bg-white px-3 py-1 text-xs">${escapeHtml(record.status)}</span>
        </div>
        <div class="mt-3 text-xs text-blue-900">送货人：${escapeHtml(record.deliveryPersonName)} · 登记人：${escapeHtml(record.registeredBy.actorName)}</div>
        <div class="mt-2 rounded-xl bg-white/80 px-3 py-2 text-xs text-blue-900">首次逐 SKU 差异率不超过 5%直接确认；超过 5%必须二次点数，二次仍超过 5%才扫描授权码。分母固定为工厂登记数量。</div>
      </section>
      ${lines}
      ${editable ? `${initialSummary(registeredTotal, currentTotal, `整单登记 ${registeredTotal} 件，当前点数 ${currentTotal} 件`, 'return-total')}${showAuthorization ? authorizationBlock('return') : ''}<button type="button" class="h-12 w-full rounded-2xl bg-blue-600 text-base font-semibold text-white" data-pda-post-action="confirm-return" data-delivery-id="${escapeHtml(record.deliveryId)}">${showAuthorization ? '授权并确认回货' : showSecond ? '提交第二次点数' : '提交第一次点数'}</button>` : `<div class="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">回货已由 ${escapeHtml(record.confirmedBy?.actorName || '回货确认人员')} 确认并进入后道待加工仓。送检操作请在 Web“后道待加工仓”完成。</div>`}
    </div>
  `
}

export function renderPdaPostFinishingReturnConfirmationPage(): string {
  const id = query().get('id') || ''
  const record = id ? getPostFinishingFactoryReturn(id) : undefined
  const body = record
    ? renderReturnConfirmation(record)
    : scanner({ label: '扫描后道送货单号', placeholder: 'SH-…', action: 'scan-return', field: 'returnScan', help: '只按完整送货单号查询；初始不展示待确认任务池。' })
  return shell('回货点数确认', '后道仓库 PDA', body, 'pda-post-finishing-return-confirm-page')
}

function renderPostTask(task: PostFinishingPostTask): string {
  const runtime = getPdaRuntimeContext()
  const isStarted = task.status === '后道中'
  const isOwner = Boolean(runtime && task.startedBy?.actorId === runtime.userId)
  const qcTask = getPostFinishingFullFlowQcTask(task.qcTaskId)
  const drafts = task.draftLines ?? []
  const lineProgress = task.lines.map((line) => {
    const draft = drafts.find((item) => item.skuId === line.sku.skuId)
    const finalResult = task.results?.find((item) => item.sku.skuId === line.sku.skuId)
    const completedQty = finalResult?.completedQty ?? draft?.completedQty ?? 0
    const defectQty = finalResult?.defectQty ?? draft?.defectQty ?? 0
    const returnQty = finalResult?.returnQty ?? draft?.returnQty ?? 0
    const adjustedQty = defectQty + returnQty
    const resolvedQty = completedQty > 0 ? completedQty : adjustedQty
    return {
      line,
      completedQty,
      defectQty,
      returnQty,
      resolvedQty,
      quantityResolved: line.expectedQty === 0 || completedQty > 0 || adjustedQty === line.expectedQty,
      draft,
      finalResult,
    }
  })
  const completedLineCount = lineProgress.filter((item) => item.quantityResolved).length
  const allCompletedQuantitiesFilled = completedLineCount === task.lines.length
  const totalExpectedQty = task.lines.reduce((sum, line) => sum + line.expectedQty, 0)
  const totalResolvedQty = lineProgress.reduce((sum, item) => sum + item.resolvedQty, 0)
  const hasAnyDifference = allCompletedQuantitiesFilled && lineProgress.some(({ line, resolvedQty }) => {
    const qcResult = qcTask?.results?.find((item) => item.sku.skuId === line.sku.skuId)
    const fullChainActual = resolvedQty + (qcResult?.defectQty ?? 0) + (qcResult?.returnQty ?? 0)
    return resolvedQty !== line.expectedQty || fullChainActual !== (qcResult?.expectedQty ?? line.expectedQty)
  })
  const lines = lineProgress.map(({ line, completedQty, defectQty, returnQty, resolvedQty, quantityResolved, finalResult }) => {
    const passedQty = finalResult?.passedQty ?? Math.max(0, resolvedQty - defectQty - returnQty)
    const canEdit = isStarted && isOwner
    return `
      <article class="rounded-2xl border bg-white p-3 shadow-sm" data-post-completion-line="${escapeHtml(line.sku.skuId)}">
        <div class="flex gap-3">
          ${image(line.sku)}
          <div class="min-w-0 flex-1">
            <div class="truncate text-sm font-semibold">${escapeHtml(line.sku.spuCode)} / ${escapeHtml(line.sku.skuCode)}</div>
            <div class="mt-1 text-xs text-slate-500">${escapeHtml(line.sku.spuName)} · ${escapeHtml(line.sku.colorName)} / ${escapeHtml(line.sku.sizeName)}</div>
            <div class="mt-1 text-xs font-medium">需加工 ${line.expectedQty} 件</div>
          </div>
        </div>
        <div class="mt-3 rounded-xl border border-blue-200 bg-blue-50 p-3">
          <label class="block text-sm font-semibold text-blue-950">完成数量</label>
          <div class="mt-2 flex gap-2">
            <input type="number" min="0" max="${line.expectedQty}" step="1" inputmode="numeric" value="${completedQty || ''}" placeholder="填写完成件数" class="h-12 min-w-0 flex-1 rounded-xl border bg-white px-3 text-right text-base font-semibold" data-post-completed-qty data-skip-page-rerender="true" ${canEdit ? '' : 'disabled'} />
            ${canEdit ? `<button type="button" class="shrink-0 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white" data-pda-post-action="save-completed-qty" data-task-id="${escapeHtml(task.postTaskId)}" data-sku-id="${escapeHtml(line.sku.skuId)}">保存</button>` : ''}
          </div>
          <div class="mt-2 text-xs text-blue-800">完成数量和瑕疵可按现场先后填写；整批均为瑕疵时无需先填完成数量。</div>
        </div>
        <div class="mt-3 flex items-center justify-between gap-3 rounded-xl border px-3 py-2">
          <div class="min-w-0 text-xs text-slate-600"><div>${completedQty > 0 ? `完成 ${completedQty} 件` : quantityResolved ? '整批已归为瑕疵或返厂' : '完成数量未填写'} · 合格 ${passedQty} 件</div>${defectQty || returnQty ? `<div class="mt-1 text-amber-700">瑕疵 ${defectQty} 件 · 返厂 ${returnQty} 件</div>` : '<div class="mt-1 text-emerald-700">未记录瑕疵或返厂</div>'}</div>
          ${task.status === '后道中' ? `<a data-nav="/fcs/pda/post-finishing/sku-adjustment?id=${encodeURIComponent(task.postTaskNo)}&skuId=${encodeURIComponent(line.sku.skuId)}" class="shrink-0 rounded-xl border border-blue-300 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700">调整瑕疵</a>` : ''}
        </div>
      </article>
    `
  }).join('')
  return `
    <div class="space-y-4" data-pda-post-task="${escapeHtml(task.postTaskId)}" data-skip-page-rerender="true">
      <section class="rounded-2xl border border-blue-200 bg-blue-50 p-4">
        <button type="button" class="text-xs text-blue-700 underline" data-pda-post-action="clear-post">重新扫描</button>
        <div class="mt-2 flex items-start justify-between gap-3">
          <div><div class="font-mono text-sm font-semibold">${escapeHtml(task.postTaskNo)}</div><div class="mt-1 text-xs text-blue-800">${escapeHtml(task.productionOrderNo)} · 第 ${task.returnIndex} 次</div></div>
          <span class="rounded-full bg-white px-3 py-1 text-xs font-medium text-blue-800">${escapeHtml(task.status)}</span>
        </div>
        <div class="mt-3 rounded-xl bg-white/70 px-3 py-2 text-xs text-blue-900"><span class="font-semibold">质检已确认加工项目：</span>${task.processItems.map(escapeHtml).join('、')}</div>
        ${task.startedBy && isStarted ? `<div class="mt-2 text-xs text-blue-900">开始人：${escapeHtml(task.startedBy.actorName)} · ${escapeHtml(task.startedAt || '')}</div>` : ''}
        ${task.startedBy && isStarted && !isOwner ? `<div class="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">已由 ${escapeHtml(task.startedBy.actorName)} 加工中。请由本人继续，错误领取请联系主管处理。</div>` : ''}
      </section>
      ${lines}
      ${task.status === '待后道' ? `<button type="button" class="h-12 w-full rounded-2xl bg-blue-600 text-base font-semibold text-white" data-pda-post-action="start-post" data-task-no="${escapeHtml(task.postTaskNo)}">核对无误，开始后道</button>` : ''}
      ${isStarted && isOwner ? `<section class="rounded-2xl border bg-white p-3"><div class="flex items-center justify-between gap-3 text-sm"><span class="font-semibold">本批数量归类</span><span class="${allCompletedQuantitiesFilled ? 'text-emerald-700' : 'text-amber-700'}">${completedLineCount} / ${task.lines.length} 个 SKU</span></div><div class="mt-2 text-xs text-slate-600">已处理 ${totalResolvedQty} / 应加工 ${totalExpectedQty} 件</div></section>${authorizationBlock('post', hasAnyDifference)}<button type="button" class="h-12 w-full rounded-2xl text-base font-semibold ${allCompletedQuantitiesFilled ? 'bg-blue-600 text-white' : 'cursor-not-allowed bg-slate-200 text-slate-500'}" data-pda-post-action="complete-post" data-task-id="${escapeHtml(task.postTaskId)}" ${allCompletedQuantitiesFilled ? '' : 'disabled'}>${allCompletedQuantitiesFilled ? '完成后道并生成复检单' : `还有 ${task.lines.length - completedLineCount} 个 SKU 未完成数量归类`}</button>` : ''}
      ${task.status === '后道完成' ? `<div class="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">已完成，复检单：${escapeHtml(task.recheckOrderNo || '生成中')}</div>` : ''}
    </div>
  `
}

export function renderPdaPostFinishingSkuAdjustmentPage(): string {
  const id = query().get('id') || ''
  const skuId = query().get('skuId') || ''
  const task = id ? getPostFinishingFullFlowPostTask(id) : undefined
  const line = task?.lines.find((item) => item.sku.skuId === skuId)
  if (!task || !line) {
    return shell('调整瑕疵数量', '后道加工', '<div class="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">未找到后道加工单或 SKU。请返回重新扫描。</div><a data-nav="/fcs/pda/post-finishing/execute" class="block rounded-2xl bg-blue-600 px-4 py-3 text-center text-sm font-semibold text-white">返回后道加工</a>', 'pda-post-finishing-sku-adjustment-page')
  }
  const runtime = getPdaRuntimeContext()
  const isOwner = Boolean(runtime && task.status === '后道中' && task.startedBy?.actorId === runtime.userId)
  const draft = task.draftLines?.find((item) => item.skuId === skuId)
  const defectQty = draft?.defectQty ?? 0
  const returnQty = draft?.returnQty ?? 0
  const completedQty = draft?.completedQty ?? 0
  const adjustedQty = defectQty + returnQty
  const returnReceiverOptions = listPostFinishingPostReturnReceiverOptions(task.postTaskId)
  const currentDefectSummary = draft?.defectReasonQuantities?.length
    ? draft.defectReasonQuantities.map((item) => `${item.reason} ${item.quantity} 件`).join('、')
    : '暂无瑕疵'
  const body = `
    <div class="space-y-4" data-post-sku-adjustment-root data-task-id="${escapeHtml(task.postTaskId)}" data-sku-id="${escapeHtml(skuId)}" data-skip-page-rerender="true">
      <a data-nav="/fcs/pda/post-finishing/execute?id=${encodeURIComponent(task.postTaskNo)}" class="inline-flex min-h-10 items-center text-sm font-medium text-blue-700">← 返回后道加工单</a>
      <section class="rounded-2xl border bg-white p-3 shadow-sm"><div class="flex gap-3">${image(line.sku)}<div class="min-w-0 flex-1"><div class="font-mono text-sm font-semibold">${escapeHtml(line.sku.skuCode)}</div><div class="mt-1 text-xs text-slate-500">${escapeHtml(line.sku.spuName)} · ${escapeHtml(line.sku.colorName)} / ${escapeHtml(line.sku.sizeName)}</div><div class="mt-2 text-sm font-medium">应加工 ${line.expectedQty} 件 · ${completedQty > 0 ? `已填完成 ${completedQty} 件` : '完成数量未填写'}</div></div></div></section>
      ${isOwner ? `
        <section class="rounded-2xl border bg-white p-4 shadow-sm">
          <h2 class="font-semibold">调整瑕疵</h2>
          <p class="mt-1 text-xs text-slate-500">先选增加或减少，再按每种瑕疵原因填写本次数量。</p>
          <div class="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-700"><span class="font-semibold">当前瑕疵 ${defectQty} 件：</span>${escapeHtml(currentDefectSummary)}</div>
          <div class="mt-3 grid grid-cols-2 gap-2" role="radiogroup" aria-label="瑕疵调整方式">
            <label class="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-blue-300 bg-blue-50 font-semibold text-blue-800"><input type="radio" name="post-defect-adjustment-mode" value="INCREASE" checked data-post-defect-adjustment-mode />增加瑕疵</label>
            <label class="flex min-h-12 items-center justify-center gap-2 rounded-xl border bg-white font-semibold text-slate-700"><input type="radio" name="post-defect-adjustment-mode" value="DECREASE" data-post-defect-adjustment-mode />减少瑕疵</label>
          </div>
          <div class="mt-3 divide-y rounded-xl border bg-white">
            ${POST_FINISHING_DEFECT_REASON_OPTIONS.map((reason) => {
              const currentQty = draft?.defectReasonQuantities?.find((item) => item.reason === reason)?.quantity ?? 0
              return `<label class="flex min-h-14 items-center justify-between gap-3 px-3 py-2"><span class="text-sm font-medium">${escapeHtml(reason)}<span class="ml-1 text-xs font-normal text-slate-400">当前 ${currentQty}</span></span><input type="number" min="0" max="${line.expectedQty}" step="1" inputmode="numeric" value="0" class="h-10 w-24 rounded-xl border px-2 text-right text-base" data-post-defect-reason-qty data-reason="${escapeHtml(reason)}" data-skip-page-rerender="true" /></label>`
            }).join('')}
          </div>
        </section>
        <details class="rounded-2xl border bg-white p-4 shadow-sm" ${returnQty ? 'open' : ''}><summary class="cursor-pointer font-semibold">返厂处理（没有可不填）</summary><label class="mt-4 block text-sm">返厂数量<input type="number" min="0" max="${line.expectedQty}" step="1" value="${returnQty || 0}" class="mt-1 h-12 w-full rounded-xl border px-3 text-right text-base" data-post-adjust-field="returnQty" data-skip-page-rerender="true" /></label><label class="mt-3 block text-sm">返厂原因<input value="${escapeHtml(draft?.returnReason || '')}" class="mt-1 h-11 w-full rounded-xl border px-3" data-post-adjust-field="returnReason" /></label><details class="mt-3 rounded-xl border bg-slate-50 p-3" data-return-receiver-picker><summary class="cursor-pointer text-sm font-medium">接收对象：<span data-return-receiver-label>${escapeHtml(draft?.returnReceiver || '请选择')}</span></summary><input type="hidden" value="${escapeHtml(draft?.returnReceiver || '')}" data-post-adjust-field="returnReceiver" /><input autocomplete="off" value="" placeholder="搜索工厂名称" class="mt-3 h-11 w-full rounded-xl border bg-white px-3 text-sm" data-pda-post-action="filter-return-receiver" data-return-receiver-search data-skip-page-rerender="true" /><div class="mt-2 max-h-52 space-y-2 overflow-y-auto" data-return-receiver-options>${returnReceiverOptions.map((option) => `<button type="button" class="w-full rounded-xl border bg-white px-3 py-3 text-left" data-pda-post-action="select-return-receiver" data-return-receiver-value="${escapeHtml(option.value)}" data-return-receiver-search-text="${escapeHtml(`${option.label} ${option.description}`.toLowerCase())}"><span class="block text-sm font-semibold">${escapeHtml(option.label)}</span><span class="mt-1 block text-xs text-slate-500">${escapeHtml(option.description)}</span></button>`).join('')}<div class="hidden px-3 py-4 text-center text-sm text-slate-500" data-return-receiver-empty>没有匹配的接收对象</div></div></details></details>
        <div class="rounded-2xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">当前已记录瑕疵/返厂 ${adjustedQty} / ${line.expectedQty} 件。可先登记瑕疵；若整批均为瑕疵或返厂，无需再填写完成数量。</div>
        <button type="button" class="h-12 w-full rounded-2xl bg-blue-600 text-base font-semibold text-white" data-pda-post-action="save-sku-adjustment" data-task-id="${escapeHtml(task.postTaskId)}" data-sku-id="${escapeHtml(skuId)}">保存并返回后道加工单</button>
      ` : `<div class="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">当前任务由 ${escapeHtml(task.startedBy?.actorName || '其他操作员')} 处理，不能修改该 SKU。</div>`}
    </div>
  `
  return shell('调整瑕疵数量', '后道加工', body, 'pda-post-finishing-sku-adjustment-page')
}

export function renderPdaPostFinishingExecutionPage(): string {
  const id = query().get('id') || ''
  const task = id ? getPostFinishingFullFlowPostTask(id) : undefined
  const body = task
    ? renderPostTask(task)
    : scanner({ label: '扫描后道加工单号', placeholder: 'HD-…', action: 'scan-post', field: 'postScan', help: '只按完整后道加工单号查询；加工项目已由质检确认，后道只填完成数量。' })
  return shell('后道加工', '精确扫描后道加工单', body, 'pda-post-finishing-execution-page')
}

function renderRecheckTask(record: PostFinishingRecheckOrder): string {
  const runtime = getPdaRuntimeContext()
  const isOwner = Boolean(runtime && record.claimedBy?.actorId === runtime.userId)
  const expectedTotal = record.lines.reduce((sum, line) => sum + line.expectedQty, 0)
  const actualTotal = record.lines.reduce((sum, line) => sum + (line.passedQty ?? line.expectedQty) + (line.defectQty ?? 0), 0)
  const hasDifference = record.lines.some((line) => line.expectedQty !== (line.passedQty ?? line.expectedQty) + (line.defectQty ?? 0))
  const editable = isOwner && record.status !== '复检完成'
  const lines = record.lines.map((line) => {
    const passedQty = line.passedQty ?? line.expectedQty
    const defectQty = line.defectQty ?? 0
    return `
      <article class="rounded-2xl border bg-white p-3 shadow-sm" data-recheck-result-line="${escapeHtml(line.sku.skuId)}" data-expected-qty="${line.expectedQty}">
        <div class="flex gap-3">
          ${image(line.sku)}
          <div class="min-w-0 flex-1">
            <div class="truncate text-sm font-semibold">${escapeHtml(line.sku.spuCode)} / ${escapeHtml(line.sku.skuCode)}</div>
            <div class="mt-1 text-xs text-slate-500">${escapeHtml(line.sku.colorName)} / ${escapeHtml(line.sku.sizeName)} · 交接 ${line.expectedQty} 件</div>
            <div class="mt-1 text-xs text-slate-500">条码状态：${escapeHtml(line.barcodeStatus)}</div>
            <div class="mt-1 truncate font-mono text-[10px] text-slate-400">${escapeHtml(line.sku.barcode)}</div>
          </div>
        </div>
        ${editable ? `
          <div class="mt-3 flex gap-2">
            <input class="h-10 min-w-0 flex-1 rounded-xl border px-3 font-mono text-xs" placeholder="扫描实物 SKU 条码" data-recheck-barcode-input />
            <button type="button" class="rounded-xl border border-blue-300 px-3 text-xs font-medium text-blue-700" data-pda-post-action="scan-recheck-barcode" data-recheck-id="${escapeHtml(record.recheckOrderId)}" data-sku-id="${escapeHtml(line.sku.skuId)}">比对</button>
          </div>
          ${line.barcodeStatus === '错误待重贴' ? `<div class="mt-2 flex gap-2"><a data-nav="/fcs/craft/post-finishing/print?type=SKU_LABEL&id=${encodeURIComponent(record.recheckOrderId)}&skuId=${encodeURIComponent(line.sku.skuId)}" class="flex-1 rounded-xl border px-3 py-2 text-center text-xs">打印正确 SKU 贴标</a><button type="button" class="rounded-xl bg-amber-600 px-3 py-2 text-xs font-medium text-white" data-pda-post-action="mark-relabeled" data-recheck-id="${escapeHtml(record.recheckOrderId)}" data-sku-id="${escapeHtml(line.sku.skuId)}">已重新贴码</button></div>` : ''}
          <div class="mt-3 grid grid-cols-2 gap-2">
            <label class="text-[11px] text-slate-500">复检合格<input type="number" min="0" step="1" value="${passedQty}" class="mt-1 h-10 w-full rounded-xl border px-2 text-right" data-recheck-result-field="passedQty" /></label>
            <label class="text-[11px] text-slate-500">复检瑕疵<input type="number" min="0" step="1" value="${defectQty || ''}" class="mt-1 h-10 w-full rounded-xl border px-2 text-right" placeholder="0" data-recheck-result-field="defectQty" /></label>
          </div>
          ${initialSummary(line.expectedQty, passedQty + defectQty, `本行 ${passedQty} + ${defectQty} = ${passedQty + defectQty} 件`, 'recheck-line')}
        ` : ''}
      </article>
    `
  }).join('')
  return `
    <div class="space-y-4" data-pda-recheck-task="${escapeHtml(record.recheckOrderId)}" data-skip-page-rerender="true">
      <section class="rounded-2xl border border-blue-200 bg-blue-50 p-4">
        <button type="button" class="text-xs text-blue-700 underline" data-pda-post-action="clear-recheck">重新扫描</button>
        <div class="mt-2 flex items-start justify-between gap-3">
          <div><div class="font-mono text-sm font-semibold">${escapeHtml(record.recheckOrderNo)}</div><div class="mt-1 text-xs text-blue-800">${escapeHtml(record.productionOrderNo)} · ${escapeHtml(record.postTaskNo || '后道加工单待同步')}</div><div class="mt-1 text-xs text-blue-800">送货 ${escapeHtml(record.deliveryOrderNo)} · 质检 ${escapeHtml(record.qcTaskNo)}</div></div>
          <span class="rounded-full bg-white px-3 py-1 text-xs">${escapeHtml(record.status)}</span>
        </div>
        ${record.claimedBy && !isOwner && record.status !== '复检完成' ? `<div class="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">已由 ${escapeHtml(record.claimedBy.actorName)} 复检中，当前账号不能继续。</div>` : ''}
      </section>
      ${lines}
      ${editable ? `${initialSummary(expectedTotal, actualTotal, `整单交接 ${expectedTotal} 件，当前复检合计 ${actualTotal} 件`, 'recheck-total')}${authorizationBlock('recheck', hasDifference)}<div class="grid grid-cols-2 gap-2"><button type="button" class="h-11 rounded-2xl border border-amber-300 text-sm text-amber-800" data-pda-post-action="release-recheck" data-recheck-id="${escapeHtml(record.recheckOrderId)}">错误领取，释放</button><button type="button" class="h-11 rounded-2xl bg-blue-600 text-sm font-semibold text-white" data-pda-post-action="complete-recheck" data-recheck-id="${escapeHtml(record.recheckOrderId)}">完成复检</button></div>` : ''}
      ${record.status === '复检完成' ? `<div class="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">复检合格品已进入后道待交出仓，并生成唯一出货单：${escapeHtml(record.outboundOrderNo || '生成中')}</div>` : ''}
    </div>
  `
}

export function renderPdaPostFinishingRecheckPage(): string {
  const id = query().get('id') || ''
  const record = id ? getPostFinishingFullFlowRecheckOrder(id) : undefined
  const body = record
    ? renderRecheckTask(record)
    : scanner({ label: '扫描复检单号', placeholder: 'FC-…', action: 'scan-recheck', field: 'recheckScan', help: '扫描成功即由当前账号领取；条码错误必须重贴并复扫。' })
  return shell('后道复检', '数量清点与 SKU 条码核对', body, 'pda-post-finishing-recheck-page')
}

function renderRecentWarehouseReceipts(): string {
  const runtime = getPdaRuntimeContext()
  if (!runtime) return ''
  const records = listPostFinishingWarehouseReceipts()
    .filter((record) => record.receivedBy.actorId === runtime.userId)
    .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))
    .slice(0, 3)
  return `<section class="rounded-2xl border bg-white p-4 shadow-sm"><h2 class="text-sm font-semibold">本人最近收货</h2><div class="mt-3 space-y-2">${records.map((record) => `<div class="rounded-xl bg-slate-50 px-3 py-2 text-xs"><div class="font-mono font-semibold">${escapeHtml(record.outboundOrderNo)}</div><div class="mt-1 text-slate-500">${record.lines.reduce((sum, line) => sum + line.receivedQty, 0)} 件 · ${escapeHtml(new Date(record.receivedAt).toLocaleString('zh-CN'))}</div></div>`).join('') || '<div class="text-xs text-slate-500">暂无本人已完成的后道出货收货记录。</div>'}</div></section>`
}

function renderOutboundReceive(): string {
  const id = query().get('id') || ''
  const outbound = id ? getPostFinishingFullFlowOutboundOrder(id) : undefined
  if (!outbound) {
    return `${scanner({ label: '扫描后道出货单条码', placeholder: 'FCK-…', action: 'scan-outbound', field: 'outboundScan', help: '只接受完整 FCK 后道出货单号；复检单和内部交接号均不接受。' })}${renderRecentWarehouseReceipts()}`
  }
  const delivery = getPostFinishingFactoryReturn(outbound.deliveryId)
  const expectedTotal = outbound.lines.reduce((sum, line) => sum + line.outboundQty, 0)
  const actualTotal = outbound.lines.reduce((sum, line) => sum + (line.receivedQty ?? line.outboundQty), 0)
  const hasDifference = outbound.lines.some((line) => line.outboundQty !== (line.receivedQty ?? line.outboundQty))
  const editable = outbound.status === '待仓库接收'
  const lines = outbound.lines.map((line) => {
    const receivedQty = line.receivedQty ?? line.outboundQty
    return `
      <article class="rounded-2xl border bg-white p-3 shadow-sm" data-outbound-result-line="${escapeHtml(line.sku.skuId)}" data-expected-qty="${line.outboundQty}">
        <div class="flex gap-3">
          ${image(line.sku)}
          <div class="min-w-0 flex-1">
            <div class="truncate text-sm font-semibold">SPU ${escapeHtml(line.sku.spuCode)}</div>
            <div class="truncate text-xs font-medium">SKU ${escapeHtml(line.sku.skuCode)}</div>
            <div class="mt-1 text-xs text-slate-500">${escapeHtml(line.sku.spuName)} · ${escapeHtml(line.sku.colorName)} / ${escapeHtml(line.sku.sizeName)}</div>
            <div class="mt-1 text-xs font-medium">应收 ${line.outboundQty} 件</div>
          </div>
          <label class="w-24 text-[11px] text-slate-500">实际接收<input type="number" min="0" step="1" value="${receivedQty}" class="mt-1 h-11 w-full rounded-xl border px-2 text-right text-base font-semibold" data-outbound-result-field="receivedQty" ${editable ? '' : 'disabled'} /></label>
        </div>
        ${editable ? initialSummary(line.outboundQty, receivedQty, `本行实收 ${receivedQty} 件`, 'warehouse-line') : ''}
      </article>
    `
  }).join('')
  return `
    <div class="space-y-4" data-pda-outbound-task="${escapeHtml(outbound.outboundOrderId)}" data-skip-page-rerender="true">
      <section class="rounded-2xl border border-blue-200 bg-blue-50 p-4">
        <button type="button" class="text-xs text-blue-700 underline" data-pda-post-action="clear-outbound">重新扫描</button>
        <div class="mt-2 flex items-start justify-between gap-3">
          <div><div class="font-mono text-sm font-semibold">${escapeHtml(outbound.outboundOrderNo)}</div><div class="mt-1 text-xs text-blue-800">${escapeHtml(outbound.productionOrderNo)} · ${escapeHtml(outbound.recheckOrderNo)}</div><div class="mt-1 text-xs text-blue-800">送货 ${escapeHtml(outbound.deliveryOrderNo)} · 质检 ${escapeHtml(outbound.qcTaskNo)} · ${escapeHtml(outbound.postTaskNo || '无后道加工单')}</div></div>
          <span class="rounded-full bg-white px-3 py-1 text-xs">${escapeHtml(outbound.status)}</span>
        </div>
        <div class="mt-3 text-xs">来源后道工厂：${escapeHtml(delivery?.managedPostFactoryName || '—')} · 出货时间 ${escapeHtml(new Date(outbound.createdAt).toLocaleString('zh-CN'))}</div><div class="mt-1 text-xs">待接收 ${expectedTotal} 件 / ${outbound.lines.length} SKU</div>
      </section>
      ${lines}
      ${editable ? `<div class="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">确认后，后道待交出仓按本出货单的应出数量完成交出扣减；实际接收数量单独记录，不反向改写交出库存。</div>${initialSummary(expectedTotal, actualTotal, `整单应收 ${expectedTotal} 件，当前实收 ${actualTotal} 件`, 'warehouse-total')}${authorizationBlock('warehouse', hasDifference)}<button type="button" class="h-12 w-full rounded-2xl bg-blue-600 text-base font-semibold text-white" data-pda-post-action="receive-outbound" data-outbound-no="${escapeHtml(outbound.outboundOrderNo)}">确认收货入库</button>` : `<div class="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">后道待交出仓已按出货数量完成交出扣减；该出货单已由 ${escapeHtml(outbound.receivedBy?.actorName || '仓库人员')} 接收入库。重复扫描仅只读展示，不会重复入库。</div>`}
    </div>
  `
}

export function renderPdaPostFinishingOutboundReceivePage(): string {
  return shell('后道出货收货', '仓库 PDA', renderOutboundReceive(), 'pda-post-finishing-outbound-receive-page')
}

function readValue(root: ParentNode, selector: string): string {
  return root.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)?.value.trim() || ''
}

function numberValue(root: ParentNode, selector: string): number {
  return Number(readValue(root, selector) || 0)
}

function filterReturnReceiverOptions(input: HTMLInputElement): void {
  const picker = input.closest<HTMLElement>('[data-return-receiver-picker]')
  if (!picker) return
  const keyword = input.value.trim().toLowerCase()
  const options = Array.from(picker.querySelectorAll<HTMLElement>('[data-return-receiver-value]'))
  let visibleCount = 0
  options.forEach((option) => {
    const visible = !keyword || (option.dataset.returnReceiverSearchText || '').includes(keyword)
    option.classList.toggle('hidden', !visible)
    if (visible) visibleCount += 1
  })
  picker.querySelector<HTMLElement>('[data-return-receiver-empty]')?.classList.toggle('hidden', visibleCount > 0)
}

function selectReturnReceiver(option: HTMLElement): void {
  const picker = option.closest<HTMLDetailsElement>('[data-return-receiver-picker]')
  if (!picker) return
  const value = option.dataset.returnReceiverValue || ''
  const field = picker.querySelector<HTMLInputElement>('[data-post-adjust-field="returnReceiver"]')
  const label = picker.querySelector<HTMLElement>('[data-return-receiver-label]')
  const search = picker.querySelector<HTMLInputElement>('[data-return-receiver-search]')
  if (field) field.value = value
  if (label) label.textContent = value || '请选择'
  if (search) search.value = ''
  picker.open = false
}

function setSummary(element: HTMLElement | null, expectedQty: number, actualQty: number, detail: string): void {
  if (!element) return
  const difference = actualQty - expectedQty
  element.textContent = `${detail}；${difference === 0 ? '数量一致' : `${difference > 0 ? '多' : '少'} ${Math.abs(difference)} 件，提交前需授权`}`
  element.className = `mt-2 rounded-xl border px-3 py-2 text-xs ${difference === 0 ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-700'}`
}

function toggleAuthorizationBlock(root: ParentNode, prefix: string, visible: boolean): void {
  root.querySelector<HTMLElement>(`[data-difference-authorization-block="${prefix}"]`)?.classList.toggle('hidden', !visible)
}

function updateQuantitySummaries(): void {
  const returnRoot = document.querySelector<HTMLElement>('[data-pda-return-confirm]')
  if (returnRoot) {
    let expectedTotal = 0
    let actualTotal = 0
    returnRoot.querySelectorAll<HTMLElement>('[data-return-confirm-line]').forEach((line) => {
      const expected = Number(line.dataset.expectedQty || 0)
      const actual = line.querySelector('[data-return-second-count]')
        ? numberValue(line, '[data-return-second-count]')
        : numberValue(line, '[data-return-first-count]')
      expectedTotal += expected
      actualTotal += actual
      const rate = expected > 0 ? Math.abs(actual - expected) / expected : 0
      setSummary(line.querySelector('[data-quantity-summary="return-line"]'), expected, actual, `本行点数 ${actual} 件；差异率 ${(rate * 100).toFixed(2)}%，分母 ${expected} 件`)
    })
    setSummary(returnRoot.querySelector('[data-quantity-summary="return-total"]'), expectedTotal, actualTotal, `整单登记 ${expectedTotal} 件，当前点数 ${actualTotal} 件`)
  }
  const postRoot = document.querySelector<HTMLElement>('[data-pda-post-task]')
  if (postRoot) {
    let expectedTotal = 0
    let actualTotal = 0
    let fullChainExpectedTotal = 0
    let fullChainActualTotal = 0
    let hasDifference = false
    postRoot.querySelectorAll<HTMLElement>('[data-post-result-line]').forEach((line) => {
      const expected = Number(line.dataset.expectedQty || 0)
      const fullChainExpected = Number(line.dataset.chainExpectedQty || expected)
      const qcExcluded = Number(line.dataset.qcExcludedQty || 0)
      const passed = numberValue(line, '[data-post-result-field="passedQty"]')
      const defect = numberValue(line, '[data-post-result-field="defectQty"]')
      const returned = numberValue(line, '[data-post-result-field="returnQty"]')
      const actual = passed + defect + returned
      const fullChainActual = actual + qcExcluded
      expectedTotal += expected
      actualTotal += actual
      fullChainExpectedTotal += fullChainExpected
      fullChainActualTotal += fullChainActual
      hasDifference ||= actual !== expected || fullChainActual !== fullChainExpected
      setSummary(line.querySelector('[data-quantity-summary="post-line"]'), expected, actual, `本行 ${passed} + ${defect} + ${returned} = ${actual} 件`)
      setSummary(line.querySelector('[data-quantity-summary="post-chain-line"]'), fullChainExpected, fullChainActual, `全链：后道 ${actual} + 质检瑕疵/返厂 ${qcExcluded} = ${fullChainActual} 件`)
    })
    setSummary(postRoot.querySelector('[data-quantity-summary="post-total"]'), expectedTotal, actualTotal, `整单应加工 ${expectedTotal} 件，当前分类合计 ${actualTotal} 件`)
    setSummary(postRoot.querySelector('[data-quantity-summary="post-chain-total"]'), fullChainExpectedTotal, fullChainActualTotal, `整单全链应有 ${fullChainExpectedTotal} 件，当前全链合计 ${fullChainActualTotal} 件`)
    toggleAuthorizationBlock(postRoot, 'post', hasDifference)
  }
  const recheckRoot = document.querySelector<HTMLElement>('[data-pda-recheck-task]')
  if (recheckRoot) {
    let expectedTotal = 0
    let actualTotal = 0
    let hasDifference = false
    recheckRoot.querySelectorAll<HTMLElement>('[data-recheck-result-line]').forEach((line) => {
      const expected = Number(line.dataset.expectedQty || 0)
      const passed = numberValue(line, '[data-recheck-result-field="passedQty"]')
      const defect = numberValue(line, '[data-recheck-result-field="defectQty"]')
      const actual = passed + defect
      expectedTotal += expected
      actualTotal += actual
      hasDifference ||= actual !== expected
      setSummary(line.querySelector('[data-quantity-summary="recheck-line"]'), expected, actual, `本行 ${passed} + ${defect} = ${actual} 件`)
    })
    setSummary(recheckRoot.querySelector('[data-quantity-summary="recheck-total"]'), expectedTotal, actualTotal, `整单交接 ${expectedTotal} 件，当前复检合计 ${actualTotal} 件`)
    toggleAuthorizationBlock(recheckRoot, 'recheck', hasDifference)
  }
  const warehouseRoot = document.querySelector<HTMLElement>('[data-pda-outbound-task]')
  if (warehouseRoot) {
    let expectedTotal = 0
    let actualTotal = 0
    let hasDifference = false
    warehouseRoot.querySelectorAll<HTMLElement>('[data-outbound-result-line]').forEach((line) => {
      const expected = Number(line.dataset.expectedQty || 0)
      const actual = numberValue(line, '[data-outbound-result-field="receivedQty"]')
      expectedTotal += expected
      actualTotal += actual
      hasDifference ||= actual !== expected
      setSummary(line.querySelector('[data-quantity-summary="warehouse-line"]'), expected, actual, `本行实收 ${actual} 件`)
    })
    setSummary(warehouseRoot.querySelector('[data-quantity-summary="warehouse-total"]'), expectedTotal, actualTotal, `整单应收 ${expectedTotal} 件，当前实收 ${actualTotal} 件`)
    toggleAuthorizationBlock(warehouseRoot, 'warehouse', hasDifference)
  }
}

function showImage(url: string, label: string): void {
  const overlay = document.createElement('div')
  overlay.className = 'fixed inset-0 z-[220] flex items-center justify-center bg-black/75 p-4'
  overlay.setAttribute('role', 'dialog')
  overlay.setAttribute('aria-modal', 'true')
  overlay.innerHTML = `<button type="button" class="absolute right-4 top-4 rounded-full bg-white px-3 py-2 text-sm">关闭</button><div class="flex min-h-40 min-w-64 items-center justify-center rounded-xl bg-white p-3"><img src="${escapeHtml(url)}" alt="${escapeHtml(label)}" class="max-h-[82vh] max-w-[86vw] rounded-xl object-contain" onload="this.nextElementSibling.hidden=true" onerror="this.hidden=true;this.nextElementSibling.textContent='图片加载失败，请核对原图后重试';this.nextElementSibling.hidden=false" /><span class="p-8 text-sm text-slate-500">图片加载中…</span></div>`
  const close = () => {
    overlay.remove()
    document.removeEventListener('keydown', onKeydown)
  }
  const onKeydown = (keydownEvent: KeyboardEvent) => { if (keydownEvent.key === 'Escape') close() }
  overlay.addEventListener('click', close)
  document.addEventListener('keydown', onKeydown)
  document.body.appendChild(overlay)
}

function setError(error: unknown): void {
  message = error instanceof Error ? error.message : '操作失败，请重新核对。'
  messageTone = 'error'
}

function isQuantityInput(target: HTMLElement, event?: Event): boolean {
  if (event?.type !== 'input' || !(target instanceof HTMLInputElement)) return false
  return target.matches('[data-return-first-count], [data-return-second-count], [data-post-completed-qty], [data-post-defect-reason-qty], [data-post-adjust-field="returnQty"], [data-post-result-field="passedQty"], [data-post-result-field="defectQty"], [data-post-result-field="returnQty"], [data-recheck-result-field="passedQty"], [data-recheck-result-field="defectQty"], [data-outbound-result-field="receivedQty"]')
}

export function handlePdaPostFinishingFlowEvent(target: HTMLElement, event?: Event): boolean {
  if (isQuantityInput(target, event)) {
    target.dataset.skipPageRerender = 'true'
    updateQuantitySummaries()
    return true
  }
  const actionNode = target.closest<HTMLElement>('[data-pda-post-action]')
  let action = actionNode?.dataset.pdaPostAction
  const field = target.closest<HTMLInputElement>('[data-pda-post-field]')
  if (!action && field && event?.type === 'keydown' && (event as KeyboardEvent).key === 'Enter') {
    action = field.dataset.pdaPostField === 'returnScan'
      ? 'scan-return'
      : field.dataset.pdaPostField === 'postScan'
        ? 'scan-post'
        : field.dataset.pdaPostField === 'recheckScan'
          ? 'scan-recheck'
          : 'scan-outbound'
  }
  if (!action) return Boolean(field)
  try {
    if (action === 'zoom-image' && actionNode?.dataset.imageUrl) {
      showImage(actionNode.dataset.imageUrl, actionNode.dataset.imageLabel || '产品图片')
      return true
    }
    if (action === 'clear-return') { refresh('/fcs/pda/post-finishing/return-confirm', ''); return true }
    if (action === 'clear-post') { refresh('/fcs/pda/post-finishing/execute', ''); return true }
    if (action === 'clear-recheck') { refresh('/fcs/pda/post-finishing/recheck', ''); return true }
    if (action === 'clear-outbound') { refresh('/fcs/pda/post-finishing/outbound-receive', ''); return true }
    if (action === 'scan-return') {
      const scanValue = (field?.value || readValue(document, '[data-pda-post-field="returnScan"]')).trim()
      const record = getPostFinishingFactoryReturn(scanValue)
      if (!record || record.deliveryOrderNo !== scanValue) throw new Error('未找到完整后道送货单号，请重新扫描送货单条码。')
      message = `已识别 ${record.deliveryOrderNo}，请逐 SKU 点数。`
      messageTone = 'success'
      refresh('/fcs/pda/post-finishing/return-confirm', record.deliveryOrderNo)
      return true
    }
    if (action === 'confirm-return') {
      const root = document.querySelector<HTMLElement>('[data-pda-return-confirm]')!
      const current = getPostFinishingFactoryReturn(actionNode?.dataset.deliveryId || '')
      if (!current) throw new Error('未找到送货单。')
      const lines = Array.from(root.querySelectorAll<HTMLElement>('[data-return-confirm-line]'))
      const firstCounts = lines.map((line, index) => ({
        skuId: line.dataset.returnConfirmLine || '',
        actualQty: current.lines[index]?.firstCountQty ?? numberValue(line, '[data-return-first-count]'),
      }))
      const showSecond = ['待二次点数', '差异待授权'].includes(current.status)
      const secondCounts = showSecond
        ? lines.map((line) => ({ skuId: line.dataset.returnConfirmLine || '', actualQty: numberValue(line, '[data-return-second-count]') }))
        : undefined
      const confirmed = confirmPostFinishingFactoryReturn({
        deliveryId: current.deliveryId,
        firstCounts,
        secondCounts,
        actor: actor('回货确认人员'),
        authorization: current.status === '差异待授权'
          ? { scanValue: readValue(root, '[data-return-authorization]'), differenceReason: readValue(root, '[data-return-difference-reason]') }
          : undefined,
      })
      message = `回货确认成功：${confirmed.deliveryOrderNo}；质检单 ${confirmed.qcTaskNo || '—'} 已自动生成，等待待加工仓送检。`
      messageTone = 'success'
      refresh('/fcs/pda/post-finishing/return-confirm', confirmed.deliveryOrderNo)
      return true
    }
    if (action === 'scan-post') {
      const scanValue = (field?.value || readValue(document, '[data-pda-post-field="postScan"]')).trim()
      const task = getPostFinishingFullFlowPostTask(scanValue)
      if (!task || task.postTaskNo !== scanValue) throw new Error('未找到完整后道加工单号，请重新扫描加工单条码。')
      message = `已识别 ${task.postTaskNo}，请核对产品并填写各 SKU 完成数量。`
      messageTone = 'success'
      refresh('/fcs/pda/post-finishing/execute', task.postTaskNo)
      return true
    }
    if (action === 'start-post') {
      const task = startPostFinishingPostTask({ postTaskNo: actionNode?.dataset.taskNo || '', actor: actor('后道操作员') })
      message = '已开始后道，请逐 SKU 填写完成数量。'
      messageTone = 'success'
      refresh('/fcs/pda/post-finishing/execute', task.postTaskNo)
      return true
    }
    if (action === 'save-completed-qty') {
      const line = actionNode?.closest<HTMLElement>('[data-post-completion-line]')
      const task = setPostFinishingPostCompletedQuantity({
        postTaskId: actionNode?.dataset.taskId || '',
        skuId: actionNode?.dataset.skuId || '',
        completedQty: numberValue(line || document, '[data-post-completed-qty]'),
        actor: actor('后道操作员'),
      })
      message = '完成数量已保存。'
      messageTone = 'success'
      refresh('/fcs/pda/post-finishing/execute', task.postTaskNo)
      return true
    }
    if (action === 'filter-return-receiver') {
      filterReturnReceiverOptions(actionNode as HTMLInputElement)
      return true
    }
    if (action === 'select-return-receiver') {
      if (actionNode) selectReturnReceiver(actionNode)
      return true
    }
    if (action === 'save-sku-adjustment') {
      const root = document.querySelector<HTMLElement>('[data-post-sku-adjustment-root]')
      if (!root) throw new Error('未找到当前 SKU 调整表单。')
      const adjustmentMode = root.querySelector<HTMLInputElement>('[data-post-defect-adjustment-mode]:checked')?.value === 'DECREASE'
        ? 'DECREASE'
        : 'INCREASE'
      const task = savePostFinishingPostSkuAdjustment({
        postTaskId: actionNode?.dataset.taskId || '',
        skuId: actionNode?.dataset.skuId || '',
        adjustmentMode,
        defectReasonQuantities: Array.from(root.querySelectorAll<HTMLInputElement>('[data-post-defect-reason-qty]')).map((input) => ({
          reason: input.dataset.reason || '',
          quantity: Number(input.value || 0),
        })),
        returnQty: numberValue(root, '[data-post-adjust-field="returnQty"]'),
        returnReason: readValue(root, '[data-post-adjust-field="returnReason"]'),
        returnReceiver: readValue(root, '[data-post-adjust-field="returnReceiver"]'),
        actor: actor('后道操作员'),
      })
      message = '当前 SKU 的瑕疵原因数量与返厂信息已保存。'
      messageTone = 'success'
      refresh('/fcs/pda/post-finishing/execute', task.postTaskNo)
      return true
    }
    if (action === 'complete-post') {
      const root = document.querySelector<HTMLElement>('[data-pda-post-task]')!
      const authorizationValue = readValue(root, '[data-post-authorization]')
      const completed = completePostFinishingPostTaskFromDraft({
        postTaskId: actionNode?.dataset.taskId || '',
        actor: actor('后道操作员'),
        authorization: authorizationValue
          ? { scanValue: authorizationValue, differenceReason: readValue(root, '[data-post-difference-reason]') }
          : undefined,
      })
      message = `后道完成，复检单 ${completed.recheckOrderNo}`
      messageTone = 'success'
      refresh('/fcs/pda/post-finishing/execute', completed.postTaskNo)
      return true
    }
    if (action === 'scan-recheck') {
      const record = claimPostFinishingRecheckOrder({ recheckOrderNo: (field?.value || readValue(document, '[data-pda-post-field="recheckScan"]')).trim(), actor: actor('复检员') })
      message = `已领取 ${record.recheckOrderNo}`
      messageTone = 'success'
      refresh('/fcs/pda/post-finishing/recheck', record.recheckOrderNo)
      return true
    }
    if (action === 'scan-recheck-barcode') {
      const card = actionNode?.closest<HTMLElement>('[data-recheck-result-line]')!
      const record = scanPostFinishingRecheckSkuBarcode({ recheckOrderId: actionNode?.dataset.recheckId || '', skuId: actionNode?.dataset.skuId || '', scannedBarcode: readValue(card, '[data-recheck-barcode-input]'), actor: actor('复检员') })
      message = record.status === '条码异常待重贴' ? '条码错误，已阻断出货；请打印正确贴标并重新贴码。' : '条码正确。'
      messageTone = record.status === '条码异常待重贴' ? 'error' : 'success'
      refresh('/fcs/pda/post-finishing/recheck', record.recheckOrderNo)
      return true
    }
    if (action === 'mark-relabeled') {
      const record = markPostFinishingRecheckSkuRelabeled({ recheckOrderId: actionNode?.dataset.recheckId || '', skuId: actionNode?.dataset.skuId || '', actor: actor('复检员') })
      message = '已记录重新贴码，必须复扫正确后才能完成。'
      messageTone = 'success'
      refresh('/fcs/pda/post-finishing/recheck', record.recheckOrderNo)
      return true
    }
    if (action === 'release-recheck') {
      const record = releasePostFinishingRecheckOrder({ recheckOrderId: actionNode?.dataset.recheckId || '', actor: actor('复检员'), reason: '错误领取' })
      message = '已释放并回到待复检。'
      messageTone = 'success'
      refresh('/fcs/pda/post-finishing/recheck', record.recheckOrderNo)
      return true
    }
    if (action === 'complete-recheck') {
      const root = document.querySelector<HTMLElement>('[data-pda-recheck-task]')!
      const lines = Array.from(root.querySelectorAll<HTMLElement>('[data-recheck-result-line]'))
      const results = lines.map((line) => ({ skuId: line.dataset.recheckResultLine || '', passedQty: numberValue(line, '[data-recheck-result-field="passedQty"]'), defectQty: numberValue(line, '[data-recheck-result-field="defectQty"]') }))
      const diff = lines.some((line, index) => Number(line.dataset.expectedQty) !== results[index]!.passedQty + results[index]!.defectQty)
      const record = completePostFinishingRecheckOrderFullFlow({ recheckOrderId: actionNode?.dataset.recheckId || '', actor: actor('复检员'), results, authorization: diff ? { scanValue: readValue(root, '[data-recheck-authorization]'), differenceReason: readValue(root, '[data-recheck-difference-reason]') } : undefined })
      message = `复检完成，已进入后道待交出仓并生成出货单 ${record.outboundOrderNo}`
      messageTone = 'success'
      refresh('/fcs/pda/post-finishing/recheck', record.recheckOrderNo)
      return true
    }
    if (action === 'scan-outbound') {
      const scanValue = (field?.value || readValue(document, '[data-pda-post-field="outboundScan"]')).trim()
      const outbound = getPostFinishingFullFlowOutboundOrder(scanValue)
      if (!outbound || outbound.outboundOrderNo !== scanValue) throw new Error('只接受完整 FCK 后道出货单号，不接受复检单或内部交接号。')
      message = `已识别 ${outbound.outboundOrderNo}`
      messageTone = 'success'
      refresh('/fcs/pda/post-finishing/outbound-receive', outbound.outboundOrderNo)
      return true
    }
    if (action === 'receive-outbound') {
      const root = document.querySelector<HTMLElement>('[data-pda-outbound-task]')!
      const lines = Array.from(root.querySelectorAll<HTMLElement>('[data-outbound-result-line]'))
      const receivedQuantities = lines.map((line) => ({ skuId: line.dataset.outboundResultLine || '', receivedQty: numberValue(line, '[data-outbound-result-field="receivedQty"]') }))
      const diff = lines.some((line, index) => Number(line.dataset.expectedQty) !== receivedQuantities[index]!.receivedQty)
      const result = receivePostFinishingOutboundOrder({ outboundOrderNo: actionNode?.dataset.outboundNo || '', actor: actor('仓库收货人员'), receivedQuantities, authorization: diff ? { scanValue: readValue(root, '[data-warehouse-authorization]'), differenceReason: readValue(root, '[data-warehouse-difference-reason]') } : undefined })
      message = result.alreadyReceived ? '该出货单已接收，本次仅展示原记录。' : '收货入库成功；后道待交出仓已按出货数量完成交出扣减。'
      messageTone = 'success'
      refresh('/fcs/pda/post-finishing/outbound-receive', result.outbound.outboundOrderNo)
      return true
    }
  } catch (error) {
    setError(error)
    refresh(window.location.pathname, query().get('id') || '', { skuId: query().get('skuId') || '' })
    return true
  }
  return false
}
