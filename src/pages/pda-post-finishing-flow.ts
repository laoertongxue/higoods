// @page-pattern: pda

import {
  canDiscardPostFinishingFactoryReturn,
  claimPostFinishingRecheckOrder,
  confirmPostFinishingFactoryReturn,
  discardPostFinishingFactoryReturn,
  completePostFinishingPostTaskFromDraft,
  completePostFinishingRecheckOrderFullFlow,
  getPostFinishingFactoryReturn,
  getPostFinishingFullFlowPostTask,
  getPostFinishingMaterialReadiness,
  getPostFinishingFullFlowRecheckOrder,
  markPostFinishingRecheckSkuRelabeled,
  releasePostFinishingRecheckOrder,
  scanPostFinishingRecheckSkuBarcode,
  setPostFinishingPostProcessedQuantity,
  setPostFinishingPostUnprocessedQuantity,
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

function shell(title: string, subtitle: string, body: string, testId: string, backHref = ''): string {
  const runtime = getPdaRuntimeContext()
  if (!runtime) return renderPdaLoginRedirect(title)
  return `
    <div class="min-h-screen bg-slate-100 pb-8" data-testid="${testId}">
      <header class="sticky top-0 z-20 border-b bg-white px-4 py-3 shadow-sm">
        <div class="mx-auto flex max-w-[480px] items-center gap-3">
          ${backHref ? `<button type="button" class="inline-flex h-9 shrink-0 items-center gap-1 rounded-xl border bg-white px-3 text-sm font-medium text-slate-700" data-nav="${escapeHtml(backHref)}" data-testid="pda-post-back"><span aria-hidden="true">←</span>返回</button>` : ''}
          <div class="min-w-0">
            <div class="truncate text-[11px] text-slate-500">${escapeHtml(subtitle)} · ${escapeHtml(runtime.userName)}</div>
            <h1 class="text-base font-semibold">${escapeHtml(title)}</h1>
          </div>
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

function authorizationBlock(prefix: string, visible = true, ruleText = '逐 SKU 数量存在任何差异时必须授权'): string {
  return `
    <div class="${visible ? '' : 'hidden '}rounded-2xl border border-amber-200 bg-amber-50 p-3" data-difference-authorization-block="${escapeHtml(prefix)}">
      <div class="text-xs font-semibold text-amber-900">${escapeHtml(ruleText)}</div>
      <label class="mt-2 block text-xs text-amber-900">差异原因
        <input class="mt-1 h-10 w-full rounded-xl border bg-white px-3" data-${prefix}-difference-reason data-skip-page-rerender="true" />
      </label>
      <label class="mt-2 block text-xs text-amber-900">扫描指定人员的 30 秒动态授权码
        <textarea class="mt-1 min-h-20 w-full rounded-xl border bg-white px-3 py-2 font-mono text-[11px]" data-${prefix}-authorization data-skip-page-rerender="true"></textarea>
      </label>
    </div>
  `
}

function initialSummary(expectedQty: number, actualQty: number, detail: string, testId: string, policy: 'any' | 'return-line' | 'return-total' = 'any'): string {
  const difference = actualQty - expectedQty
  const rate = expectedQty > 0 ? Math.abs(difference) / expectedQty : 0
  const differenceText = policy === 'return-total'
    ? '整单合计仅供核对，是否复点和授权以每个 SKU 为准'
    : difference === 0
      ? '数量一致'
      : policy === 'return-line'
        ? `${difference > 0 ? '多' : '少'} ${Math.abs(difference)} 件，${rate > 0.05 ? '超过 5%，需按规则复点或授权' : '不超过 5%，可直接确认'}`
        : `${difference > 0 ? '多' : '少'} ${Math.abs(difference)} 件，提交前需授权`
  const tone = policy === 'return-total'
    ? 'border-blue-200 bg-blue-50 text-blue-800'
    : difference === 0
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
      : policy === 'return-line' && rate <= 0.05
        ? 'border-amber-200 bg-amber-50 text-amber-800'
        : 'border-red-200 bg-red-50 text-red-700'
  return `<div class="mt-2 rounded-xl border px-3 py-2 text-xs ${tone}" data-quantity-summary="${testId}" data-summary-policy="${policy}">${escapeHtml(detail)}；${differenceText}</div>`
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
        </div>${initialSummary(line.registeredQty, currentQty, `本行点数 ${currentQty} 件；差异率分母 ${line.registeredQty} 件`, 'return-line', 'return-line')}` : `<div class="mt-3 rounded-xl ${record.status === '已废弃' ? 'bg-slate-100 text-slate-600' : 'bg-emerald-50 text-emerald-800'} px-3 py-2 text-xs">${record.status === '已废弃' ? `登记 ${line.registeredQty} 件 · 未形成最终确认` : `最终确认 ${line.confirmedQty ?? line.registeredQty} 件`}</div>`}
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
      ${editable ? `${initialSummary(registeredTotal, currentTotal, `整单登记 ${registeredTotal} 件，当前点数 ${currentTotal} 件`, 'return-total', 'return-total')}${showAuthorization ? authorizationBlock('return', true, '任一 SKU 二次点数与登记数量的差异率仍超过 5%时必须授权') : ''}<button type="button" class="h-12 w-full rounded-2xl bg-blue-600 text-base font-semibold text-white" data-pda-post-action="confirm-return" data-delivery-id="${escapeHtml(record.deliveryId)}">${showAuthorization ? '授权并确认回货' : showSecond ? '提交第二次点数' : '提交第一次点数'}</button>${canDiscardPostFinishingFactoryReturn(record) ? `<button type="button" class="h-11 w-full rounded-2xl border border-red-200 bg-white text-sm font-medium text-red-700" data-pda-post-action="discard-return" data-delivery-id="${escapeHtml(record.deliveryId)}">废弃本次回货</button>` : ''}` : record.status === '已废弃' ? `<div class="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700"><strong>本次回货已废弃。</strong><span class="mt-1 block text-xs">${escapeHtml(record.discardReason || '未填写原因')} · ${escapeHtml(record.discardedBy?.actorName || '—')} · ${escapeHtml(record.discardedAt || '—')}</span></div>` : `<div class="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">回货已由 ${escapeHtml(record.confirmedBy?.actorName || '回货确认人员')} 确认并进入后道待加工仓。质检单 ${escapeHtml(record.qcTaskNo || '—')} 已自动生成；送检操作请在 Web“后道待加工仓”完成。</div>`}
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
  const materialReadiness = getPostFinishingMaterialReadiness(task.productionOrderNo)
  const drafts = task.draftLines ?? []
  const lineProgress = task.lines.map((line) => {
    const draft = drafts.find((item) => item.skuId === line.sku.skuId)
    const finalResult = task.results?.find((item) => item.sku.skuId === line.sku.skuId)
    const processedQty = finalResult?.processedQty ?? draft?.processedQty ?? 0
    const unprocessedQty = finalResult?.unprocessedQty ?? draft?.unprocessedQty ?? 0
    return {
      line,
      processedQty,
      unprocessedQty,
      quantityResolved: processedQty + unprocessedQty === line.expectedQty,
    }
  })
  const completedLineCount = lineProgress.filter((item) => item.quantityResolved).length
  const allCompletedQuantitiesFilled = completedLineCount === task.lines.length
  const totalExpectedQty = task.lines.reduce((sum, line) => sum + line.expectedQty, 0)
  const totalProcessedQty = lineProgress.reduce((sum, item) => sum + item.processedQty, 0)
  const totalUnprocessedQty = lineProgress.reduce((sum, item) => sum + item.unprocessedQty, 0)
  const lines = lineProgress.map(({ line, processedQty, unprocessedQty, quantityResolved }) => {
    const canEdit = isStarted && isOwner
    return `
      <article class="rounded-2xl border bg-white p-3 shadow-sm" data-post-completion-line="${escapeHtml(line.sku.skuId)}">
        <div class="flex gap-3">
          ${image(line.sku)}
          <div class="min-w-0 flex-1">
            <div class="truncate text-sm font-semibold">${escapeHtml(line.sku.spuCode)} / ${escapeHtml(line.sku.skuCode)}</div>
            <div class="mt-1 text-xs text-slate-500">${escapeHtml(line.sku.spuName)} · ${escapeHtml(line.sku.colorName)} / ${escapeHtml(line.sku.sizeName)}</div>
            <div class="mt-1 text-xs font-medium">应处理 ${line.expectedQty} 件</div>
          </div>
        </div>
        <div class="mt-3 rounded-xl border border-blue-200 bg-blue-50 p-3">
          <label class="block text-sm font-semibold text-blue-950">已处理数量</label>
          <div class="mt-2 flex gap-2">
            <input type="number" min="0" max="${line.expectedQty}" step="1" inputmode="numeric" value="${processedQty}" class="h-12 min-w-0 flex-1 rounded-xl border bg-white px-3 text-right text-base font-semibold" data-post-processed-qty data-skip-page-rerender="true" ${canEdit ? '' : 'disabled'} />
            ${canEdit ? `<button type="button" class="shrink-0 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white" data-pda-post-action="save-processed-qty" data-task-id="${escapeHtml(task.postTaskId)}" data-sku-id="${escapeHtml(line.sku.skuId)}">保存</button>` : ''}
          </div>
          <div class="mt-2 text-xs text-blue-800">后道只记录处理数量，不在这里再次质检或决定返厂。</div>
        </div>
        <div class="mt-3 flex items-center justify-between gap-3 rounded-xl border px-3 py-2">
          <div class="min-w-0 text-xs text-slate-600"><div>已处理 ${processedQty} 件 · 未处理 ${unprocessedQty} 件</div><div class="mt-1 ${quantityResolved ? 'text-emerald-700' : 'text-amber-700'}">合计 ${processedQty + unprocessedQty} / ${line.expectedQty} 件</div></div>
          ${task.status === '后道中' ? `<a data-nav="/fcs/pda/post-finishing/sku-adjustment?id=${encodeURIComponent(task.postTaskNo)}&skuId=${encodeURIComponent(line.sku.skuId)}" class="shrink-0 rounded-xl border border-blue-300 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700">填写未处理</a>` : ''}
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
        <div class="mt-3 rounded-xl bg-white/70 px-3 py-2 text-xs text-blue-900"><div><span class="font-semibold">任务范围：</span>${escapeHtml(task.responsibility.taskTypeLabel)} · ${escapeHtml(task.responsibility.responsibilityLabel)}</div><div class="mt-1"><span class="font-semibold">加工来源：</span>${escapeHtml(task.sourceType)}</div><div class="mt-1"><span class="font-semibold">本批后道项目（质检已确认）：</span>${task.processItems.map(escapeHtml).join('、')}</div></div>
        ${task.startedBy && isStarted ? `<div class="mt-2 text-xs text-blue-900">开始人：${escapeHtml(task.startedBy.actorName)} · ${escapeHtml(task.startedAt || '')}</div>` : ''}
        ${task.startedBy && isStarted && !isOwner ? `<div class="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">已由 ${escapeHtml(task.startedBy.actorName)} 加工中。请由本人继续，错误领取请联系主管处理。</div>` : ''}
      </section>
      ${materialReadiness.applicable && materialReadiness.status !== '已入库' ? `<section class="rounded-2xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"><strong>后道辅料未到齐。</strong><span class="mt-1 block text-xs">${escapeHtml(materialReadiness.label)}。当前仅提示，不阻断开始或完成加工。</span></section>` : ''}
      ${lines}
      ${task.status === '待后道' ? `<button type="button" class="h-12 w-full rounded-2xl bg-blue-600 text-base font-semibold text-white" data-pda-post-action="start-post" data-task-no="${escapeHtml(task.postTaskNo)}">核对无误，开始后道</button>` : ''}
      ${isStarted && isOwner ? `<section class="rounded-2xl border bg-white p-3"><div class="flex items-center justify-between gap-3 text-sm"><span class="font-semibold">本批数量归类</span><span class="${allCompletedQuantitiesFilled ? 'text-emerald-700' : 'text-amber-700'}">${completedLineCount} / ${task.lines.length} 个 SKU</span></div><div class="mt-2 text-xs text-slate-600">应处理 ${totalExpectedQty} 件 · 已处理 ${totalProcessedQty} 件 · 未处理 ${totalUnprocessedQty} 件</div></section><button type="button" class="h-12 w-full rounded-2xl text-base font-semibold ${allCompletedQuantitiesFilled ? 'bg-blue-600 text-white' : 'cursor-not-allowed bg-slate-200 text-slate-500'}" data-pda-post-action="complete-post" data-task-id="${escapeHtml(task.postTaskId)}" ${allCompletedQuantitiesFilled ? '' : 'disabled'}>${allCompletedQuantitiesFilled ? '完成并生成处理后交出复核单' : `还有 ${task.lines.length - completedLineCount} 个 SKU 未完成数量归类`}</button>` : ''}
      ${task.status === '后道完成' ? `<div class="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">后道处理已完成，处理后交出复核单：${escapeHtml(task.recheckOrderNo || '生成中')}</div>` : ''}
    </div>
  `
}

export function renderPdaPostFinishingSkuAdjustmentPage(): string {
  const id = query().get('id') || ''
  const skuId = query().get('skuId') || ''
  const task = id ? getPostFinishingFullFlowPostTask(id) : undefined
  const line = task?.lines.find((item) => item.sku.skuId === skuId)
  if (!task || !line) {
    return shell('填写未处理数量', '后道加工', '<div class="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">未找到后道加工单或 SKU。请返回重新扫描。</div><a data-nav="/fcs/pda/post-finishing/execute" class="block rounded-2xl bg-blue-600 px-4 py-3 text-center text-sm font-semibold text-white">返回后道加工</a>', 'pda-post-finishing-sku-adjustment-page')
  }
  const runtime = getPdaRuntimeContext()
  const isOwner = Boolean(runtime && task.status === '后道中' && task.startedBy?.actorId === runtime.userId)
  const draft = task.draftLines?.find((item) => item.skuId === skuId)
  const processedQty = draft?.processedQty ?? 0
  const unprocessedQty = draft?.unprocessedQty ?? 0
  const body = `
    <div class="space-y-4" data-post-sku-adjustment-root data-task-id="${escapeHtml(task.postTaskId)}" data-sku-id="${escapeHtml(skuId)}" data-skip-page-rerender="true">
      <a data-nav="/fcs/pda/post-finishing/execute?id=${encodeURIComponent(task.postTaskNo)}" class="inline-flex min-h-10 items-center text-sm font-medium text-blue-700">← 返回后道加工单</a>
      <section class="rounded-2xl border bg-white p-3 shadow-sm"><div class="flex gap-3">${image(line.sku)}<div class="min-w-0 flex-1"><div class="font-mono text-sm font-semibold">${escapeHtml(line.sku.skuCode)}</div><div class="mt-1 text-xs text-slate-500">${escapeHtml(line.sku.spuName)} · ${escapeHtml(line.sku.colorName)} / ${escapeHtml(line.sku.sizeName)}</div><div class="mt-2 text-sm font-medium">应处理 ${line.expectedQty} 件 · 已处理 ${processedQty} 件</div></div></div></section>
      ${isOwner ? `
        <section class="rounded-2xl border bg-white p-4 shadow-sm">
          <h2 class="font-semibold">未处理数量与说明</h2>
          <p class="mt-1 text-xs text-slate-500">这里不做质量或返厂判断；只说明本次后道没有处理的数量。</p>
          <label class="mt-4 block text-sm">未处理数量<input type="number" min="0" max="${line.expectedQty}" step="1" inputmode="numeric" value="${unprocessedQty}" class="mt-1 h-12 w-full rounded-xl border px-3 text-right text-base" data-post-adjust-field="unprocessedQty" data-skip-page-rerender="true" /></label>
          <label class="mt-3 block text-sm">未处理说明<textarea class="mt-1 min-h-24 w-full rounded-xl border px-3 py-2" placeholder="未处理数量大于 0 时必填" data-post-adjust-field="unprocessedReason">${escapeHtml(draft?.unprocessedReason || '')}</textarea></label>
        </section>
        <div class="rounded-2xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">应处理 ${line.expectedQty} 件 · 已处理 ${processedQty} 件 · 未处理 ${unprocessedQty} 件 · 当前合计 ${processedQty + unprocessedQty} 件</div>
        <button type="button" class="h-12 w-full rounded-2xl bg-blue-600 text-base font-semibold text-white" data-pda-post-action="save-unprocessed-qty" data-task-id="${escapeHtml(task.postTaskId)}" data-sku-id="${escapeHtml(skuId)}">保存并返回后道加工单</button>
      ` : `<div class="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">当前任务由 ${escapeHtml(task.startedBy?.actorName || '其他操作员')} 处理，不能修改该 SKU。</div>`}
    </div>
  `
  return shell('填写未处理数量', '后道加工', body, 'pda-post-finishing-sku-adjustment-page')
}

export function renderPdaPostFinishingExecutionPage(): string {
  const id = query().get('id') || ''
  const task = id ? getPostFinishingFullFlowPostTask(id) : undefined
  const body = task
    ? renderPostTask(task)
    : scanner({ label: '扫描后道加工单号', placeholder: 'HD-…', action: 'scan-post', field: 'postScan', help: '只按完整后道加工单号查询；加工项目已由质检确认，后道只填已处理和未处理数量。' })
  return shell('后道加工', '精确扫描后道加工单', body, 'pda-post-finishing-execution-page', '/fcs/pda/exec')
}

function renderRecheckTask(record: PostFinishingRecheckOrder): string {
  const runtime = getPdaRuntimeContext()
  const isOwner = Boolean(runtime && record.claimedBy?.actorId === runtime.userId)
  const expectedTotal = record.lines.reduce((sum, line) => sum + line.expectedQty, 0)
  const actualTotal = record.lines.reduce((sum, line) => sum + (line.handoverQty ?? line.expectedQty), 0)
  const hasDifference = record.lines.some((line) => line.expectedQty !== (line.handoverQty ?? line.expectedQty))
  const editable = isOwner && record.status !== '复检完成'
  const lines = record.lines.map((line) => {
    const handoverQty = line.handoverQty ?? line.expectedQty
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
          <label class="mt-3 block text-[11px] text-slate-500">实际交出数量<input type="number" min="0" step="1" value="${handoverQty}" class="mt-1 h-10 w-full rounded-xl border px-2 text-right" data-recheck-result-field="handoverQty" /></label>
          ${initialSummary(line.expectedQty, handoverQty, `本行交出 ${handoverQty} 件`, 'recheck-line')}
        ` : ''}
      </article>
    `
  }).join('')
  return `
    <div class="space-y-4" data-pda-recheck-task="${escapeHtml(record.recheckOrderId)}" data-skip-page-rerender="true">
      <section class="rounded-2xl border border-blue-200 bg-blue-50 p-4">
        <button type="button" class="text-xs text-blue-700 underline" data-pda-post-action="clear-recheck">重新扫描</button>
        <div class="mt-2 flex items-start justify-between gap-3">
          <div><div class="font-mono text-sm font-semibold">${escapeHtml(record.recheckOrderNo)}</div><div class="mt-1 text-xs text-blue-800">${escapeHtml(record.productionOrderNo)} · ${escapeHtml(record.postTaskNo || '后道加工单不适用')}</div><div class="mt-1 text-xs font-medium text-blue-900">来源：${escapeHtml(record.sourceType)}</div><div class="mt-1 text-xs text-blue-800">送货 ${escapeHtml(record.deliveryOrderNo)} · 质检 ${escapeHtml(record.qcTaskNo)}</div></div>
          <span class="rounded-full bg-white px-3 py-1 text-xs">${escapeHtml(record.status)}</span>
        </div>
        ${record.claimedBy && !isOwner && record.status !== '复检完成' ? `<div class="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">已由 ${escapeHtml(record.claimedBy.actorName)} 复检中，当前账号不能继续。</div>` : ''}
      </section>
      ${lines}
      ${editable ? `${initialSummary(expectedTotal, actualTotal, `整单应交 ${expectedTotal} 件，当前交出 ${actualTotal} 件`, 'recheck-total')}${authorizationBlock('recheck', hasDifference)}<div class="grid grid-cols-2 gap-2"><button type="button" class="h-11 rounded-2xl border border-amber-300 text-sm text-amber-800" data-pda-post-action="release-recheck" data-recheck-id="${escapeHtml(record.recheckOrderId)}">错误领取，释放</button><button type="button" class="h-11 rounded-2xl bg-blue-600 text-sm font-semibold text-white" data-pda-post-action="complete-recheck" data-recheck-id="${escapeHtml(record.recheckOrderId)}">确认数量条码并交出</button></div>` : ''}
      ${record.status === '复检完成' ? `<div class="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">处理后数量与条码已复核，货物已进入后道待交出仓，并生成唯一出货单：${escapeHtml(record.outboundOrderNo || '生成中')}</div>` : ''}
    </div>
  `
}

export function renderPdaPostFinishingRecheckPage(): string {
  const id = query().get('id') || ''
  const record = id ? getPostFinishingFullFlowRecheckOrder(id) : undefined
  const body = record
    ? renderRecheckTask(record)
    : scanner({ label: '扫描复检单号', placeholder: 'FC-…', action: 'scan-recheck', field: 'recheckScan', help: '扫描成功即由当前账号领取；条码错误必须重贴并复扫。' })
  return shell('处理后交出复核', '数量清点与 SKU 条码核对', body, 'pda-post-finishing-recheck-page', '/fcs/pda/exec')
}

function readValue(root: ParentNode, selector: string): string {
  return root.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)?.value.trim() || ''
}

function numberValue(root: ParentNode, selector: string): number {
  return Number(readValue(root, selector) || 0)
}

function setSummary(element: HTMLElement | null, expectedQty: number, actualQty: number, detail: string): void {
  if (!element) return
  const difference = actualQty - expectedQty
  const policy = element.dataset.summaryPolicy || 'any'
  const rate = expectedQty > 0 ? Math.abs(difference) / expectedQty : 0
  const differenceText = policy === 'return-total'
    ? '整单合计仅供核对，是否复点和授权以每个 SKU 为准'
    : difference === 0
      ? '数量一致'
      : policy === 'return-line'
        ? `${difference > 0 ? '多' : '少'} ${Math.abs(difference)} 件，${rate > 0.05 ? '超过 5%，需按规则复点或授权' : '不超过 5%，可直接确认'}`
        : `${difference > 0 ? '多' : '少'} ${Math.abs(difference)} 件，提交前需授权`
  const tone = policy === 'return-total'
    ? 'border-blue-200 bg-blue-50 text-blue-800'
    : difference === 0
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
      : policy === 'return-line' && rate <= 0.05
        ? 'border-amber-200 bg-amber-50 text-amber-800'
        : 'border-red-200 bg-red-50 text-red-700'
  element.textContent = `${detail}；${differenceText}`
  element.className = `mt-2 rounded-xl border px-3 py-2 text-xs ${tone}`
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
  const recheckRoot = document.querySelector<HTMLElement>('[data-pda-recheck-task]')
  if (recheckRoot) {
    let expectedTotal = 0
    let actualTotal = 0
    let hasDifference = false
    recheckRoot.querySelectorAll<HTMLElement>('[data-recheck-result-line]').forEach((line) => {
      const expected = Number(line.dataset.expectedQty || 0)
      const actual = numberValue(line, '[data-recheck-result-field="handoverQty"]')
      expectedTotal += expected
      actualTotal += actual
      hasDifference ||= actual !== expected
      setSummary(line.querySelector('[data-quantity-summary="recheck-line"]'), expected, actual, `本行交出 ${actual} 件`)
    })
    setSummary(recheckRoot.querySelector('[data-quantity-summary="recheck-total"]'), expectedTotal, actualTotal, `整单应交 ${expectedTotal} 件，当前交出 ${actualTotal} 件`)
    toggleAuthorizationBlock(recheckRoot, 'recheck', hasDifference)
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
  return target.matches('[data-return-first-count], [data-return-second-count], [data-post-processed-qty], [data-post-adjust-field="unprocessedQty"], [data-recheck-result-field="handoverQty"]')
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
          : undefined
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
    if (action === 'discard-return') {
      const current = getPostFinishingFactoryReturn(actionNode?.dataset.deliveryId || '')
      if (!current) throw new Error('未找到送货单。')
      const reason = window.prompt('请填写废弃原因。废弃后只保留审计，不进入待加工仓，也不会生成质检单。')?.trim() || ''
      if (!reason) throw new Error('已取消废弃：必须填写废弃原因。')
      if (!window.confirm(`确认废弃本次回货？\n${reason}`)) return true
      const discarded = discardPostFinishingFactoryReturn({
        deliveryId: current.deliveryId,
        reason,
        actor: actor('回货确认人员'),
      })
      message = `已废弃 ${discarded.deliveryOrderNo}；明细和原因已保留。`
      messageTone = 'success'
      refresh('/fcs/pda/post-finishing/return-confirm', discarded.deliveryOrderNo)
      return true
    }
    if (action === 'scan-post') {
      const scanValue = (field?.value || readValue(document, '[data-pda-post-field="postScan"]')).trim()
      const task = getPostFinishingFullFlowPostTask(scanValue)
      if (!task || task.postTaskNo !== scanValue) throw new Error('未找到完整后道加工单号，请重新扫描加工单条码。')
      message = `已识别 ${task.postTaskNo}，请核对产品并填写各 SKU 已处理和未处理数量。`
      messageTone = 'success'
      refresh('/fcs/pda/post-finishing/execute', task.postTaskNo)
      return true
    }
    if (action === 'start-post') {
      const task = startPostFinishingPostTask({ postTaskNo: actionNode?.dataset.taskNo || '', actor: actor('后道操作员') })
      message = '已开始后道，请逐 SKU 填写已处理和未处理数量。'
      messageTone = 'success'
      refresh('/fcs/pda/post-finishing/execute', task.postTaskNo)
      return true
    }
    if (action === 'save-processed-qty') {
      const line = actionNode?.closest<HTMLElement>('[data-post-completion-line]')
      const task = setPostFinishingPostProcessedQuantity({
        postTaskId: actionNode?.dataset.taskId || '',
        skuId: actionNode?.dataset.skuId || '',
        processedQty: numberValue(line || document, '[data-post-processed-qty]'),
        actor: actor('后道操作员'),
      })
      message = '已处理数量已保存。'
      messageTone = 'success'
      refresh('/fcs/pda/post-finishing/execute', task.postTaskNo)
      return true
    }
    if (action === 'save-unprocessed-qty') {
      const root = document.querySelector<HTMLElement>('[data-post-sku-adjustment-root]')
      if (!root) throw new Error('未找到当前 SKU 未处理数量表单。')
      const task = setPostFinishingPostUnprocessedQuantity({
        postTaskId: actionNode?.dataset.taskId || '',
        skuId: actionNode?.dataset.skuId || '',
        unprocessedQty: numberValue(root, '[data-post-adjust-field="unprocessedQty"]'),
        unprocessedReason: readValue(root, '[data-post-adjust-field="unprocessedReason"]'),
        actor: actor('后道操作员'),
      })
      message = '当前 SKU 的未处理数量与说明已保存。'
      messageTone = 'success'
      refresh('/fcs/pda/post-finishing/execute', task.postTaskNo)
      return true
    }
    if (action === 'complete-post') {
      const completed = completePostFinishingPostTaskFromDraft({
        postTaskId: actionNode?.dataset.taskId || '',
        actor: actor('后道操作员'),
      })
      message = `后道处理完成，处理后交出复核单 ${completed.recheckOrderNo}`
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
      const results = lines.map((line) => ({ skuId: line.dataset.recheckResultLine || '', handoverQty: numberValue(line, '[data-recheck-result-field="handoverQty"]') }))
      const diff = lines.some((line, index) => Number(line.dataset.expectedQty) !== results[index]!.handoverQty)
      const record = completePostFinishingRecheckOrderFullFlow({ recheckOrderId: actionNode?.dataset.recheckId || '', actor: actor('复检员'), results, authorization: diff ? { scanValue: readValue(root, '[data-recheck-authorization]'), differenceReason: readValue(root, '[data-recheck-difference-reason]') } : undefined })
      message = `数量与条码复核完成，已进入后道待交出仓并生成出货单 ${record.outboundOrderNo}`
      messageTone = 'success'
      refresh('/fcs/pda/post-finishing/recheck', record.recheckOrderNo)
      return true
    }
  } catch (error) {
    setError(error)
    refresh(window.location.pathname, query().get('id') || '', { skuId: query().get('skuId') || '' })
    return true
  }
  return false
}
