import { staticImageThumbnail } from '../utils/static-image-thumbnail.ts'
import { renderReturnBusinessTimeFields } from './ppic-return-business-time-ui.ts'
import { handlePostFinishingStorageEvent, showPostFinishingActionFailure } from './process-factory/post-finishing/storage-notice.ts'
import { runPostFinishingCommand } from '../data/fcs/post-finishing-records.ts'
// @page-pattern: pda

import {
  canDiscardPostFinishingFactoryReturn,
  claimPostFinishingRecheckOrder,
  confirmPostFinishingFactoryReturn,
  discardPostFinishingFactoryReturn,
  appendPostFinishingProcessCompletion,
  completePostFinishingRecheckOrderFullFlow,
  getPostFinishingFactoryReturn,
  getPostFinishingFullFlowPostTask,
  getPostFinishingMaterialReadiness,
  getPostFinishingFullFlowRecheckOrder,
  getPostFinishingProcessProgress,
  listPostFinishingFullFlowRecheckOrders,
  listPostFinishingFullFlowOutboundOrders,
  markPostFinishingRecheckSkuRelabeled,
  releasePostFinishingRecheckOrder,
  scanPostFinishingRecheckSkuBarcode,
  submitPostFinishingForRecheck,
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
const submittingPostIntent = new Set<string>()
const postOperationIntents = new Map<string, { signature: string; operationId: string }>()

function operationIntent(key: string, signature: string): string {
  const previous = postOperationIntents.get(key)
  if (previous?.signature === signature) return previous.operationId
  const operationId = `PDA-POST-${typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`}`
  postOperationIntents.set(key, { signature, operationId })
  return operationId
}

function hasPostUnsavedInput(): boolean {
  return typeof document !== 'undefined' && Array.from(document.querySelectorAll<HTMLInputElement>('[data-post-process-qty], [data-post-recheck-qty]'))
    .some((input) => input.value.trim() !== '0')
}

if (typeof window !== 'undefined') window.addEventListener('beforeunload', (event) => {
  if (!hasPostUnsavedInput()) return
  event.preventDefault()
  event.returnValue = ''
})

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
          ${backHref ? `<button type="button" class="inline-flex h-9 shrink-0 items-center gap-1 rounded-xl border bg-white px-3 text-sm font-medium text-slate-700" data-pda-post-action="leave-post" data-destination="${escapeHtml(backHref)}" data-skip-page-rerender="true" data-testid="pda-post-back"><span aria-hidden="true">←</span>返回</button>` : ''}
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
      <img src="${escapeHtml(staticImageThumbnail(sku.imageUrl))}" alt="${escapeHtml(`${sku.spuName} ${sku.colorName} ${sku.sizeName}`)}" class="h-full w-full object-contain" onload="this.nextElementSibling.hidden=true" onerror="this.hidden=true;this.nextElementSibling.textContent='图片加载失败';this.nextElementSibling.hidden=false" />
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
      ${editable ? renderReturnBusinessTimeFields() : ''}
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
  const progress = getPostFinishingProcessProgress(task)
  const historicalUnsplit = task.executionModel !== 'ITEMS_V1' && !task.legacyCarryover
  const historicalCompletedQty = progress.lines.reduce((sum, line) => sum + line.historyCompletedQty, 0)
  const materialReadiness = getPostFinishingMaterialReadiness(task.productionOrderNo)
  const rechecks = listPostFinishingFullFlowRecheckOrders().filter((item) => item.postTaskId === task.postTaskId)
  const outbounds = listPostFinishingFullFlowOutboundOrders().filter((item) => item.postTaskId === task.postTaskId)
  const canRegister = Boolean(runtime && !progress.legacyPending)
  const firstAvailable = progress.processes.find((item) => item.applicable && item.availableQty > 0)?.processItem
  const processes = progress.processes.map((process) => {
    if (historicalUnsplit) return `<div class="flex items-center justify-between rounded-xl border bg-amber-50 px-3 py-3 text-sm"><span>${escapeHtml(process.processItem)}</span><span class="text-amber-800">历史未分项</span></div>`
    if (!process.applicable) return `<div class="flex items-center justify-between rounded-xl border bg-slate-50 px-3 py-3 text-sm"><span>${escapeHtml(process.processItem)}</span><span class="text-slate-500">不涉及</span></div>`
    const records = progress.records.filter((record) => record.processItem === process.processItem)
    const quantityLines = process.lines.map((line) => `
      <article class="rounded-xl border bg-white p-3" data-post-process-line="${escapeHtml(line.sku.skuId)}">
        <div class="flex gap-3">${image(line.sku)}<div class="min-w-0 flex-1">
          <div class="break-all text-sm font-semibold">${escapeHtml(line.sku.skuCode)}</div>
          <div class="mt-1 text-xs text-slate-500">${escapeHtml(line.sku.spuName)} · ${escapeHtml(line.sku.colorName)} / ${escapeHtml(line.sku.sizeName)}</div>
          <div class="mt-2 text-xs">${historicalUnsplit ? '历史未分项' : `${historicalCompletedQty > 0 ? '新增分项累计' : '累计'} ${line.completedQty} / ${line.expectedQty} 件 · 本次可登记 ${line.availableQty} 件`}</div>
        </div></div>
        <label class="mt-3 block text-xs font-medium">本次完成数量（件）
          <input aria-label="${escapeHtml(`${process.processItem} ${line.sku.skuCode} 本次完成数量`)}" type="number" min="0" max="${line.availableQty}" step="1" inputmode="numeric" value="0" class="mt-1 h-12 w-full rounded-xl border px-3 text-right text-base" data-post-process-qty data-skip-page-rerender="true" ${canRegister && line.availableQty > 0 ? '' : 'disabled'} />
        </label>
        ${line.availableQty === 0 && line.completedQty < line.expectedQty ? '<p class="mt-2 text-xs text-amber-800">前序尚无可登记数量。</p>' : ''}
      </article>`).join('')
    return `<details class="rounded-2xl border bg-white shadow-sm" data-post-process="${escapeHtml(process.processItem)}" ${firstAvailable === process.processItem ? 'open' : ''}>
      <summary class="flex min-h-12 cursor-pointer items-center justify-between gap-2 px-3 py-3 text-sm"><span class="font-semibold">${escapeHtml(process.processItem)}</span><span class="text-right">${historicalUnsplit ? '历史未分项' : `${process.completedQty} / ${process.expectedQty} 件`}<span class="mt-1 block text-xs text-slate-500">${historicalUnsplit ? '历史合并记录' : process.completedQty >= process.expectedQty ? '已完成' : process.completedQty > 0 ? '部分完成' : '待加工'}</span></span></summary>
      <div class="space-y-3 border-t p-3">
        <div class="rounded-xl bg-blue-50 px-3 py-2 text-xs text-blue-900">本次责任人：${escapeHtml(runtime?.userName || '请先登录')} · 录入人：${escapeHtml(runtime?.userName || '—')}</div>
        ${quantityLines}
        ${canRegister && process.availableQty > 0 ? `<button type="button" class="h-12 w-full rounded-xl bg-blue-600 text-sm font-semibold text-white" data-pda-post-action="save-process-completion" data-task-id="${escapeHtml(task.postTaskId)}" data-process-item="${escapeHtml(process.processItem)}">保存本次${escapeHtml(process.processItem)}数量</button>` : ''}
        ${records.length ? `<details class="rounded-xl border px-3 py-2"><summary class="min-h-8 cursor-pointer text-xs font-medium">查看 ${records.length} 次登记</summary><ol class="mt-2 space-y-2">${records.map((record) => `<li class="rounded-lg bg-slate-50 p-2 text-xs"><div class="font-medium">${record.correctionOf ? '订正增减' : '本次完成'} ${record.quantities.reduce((sum, line) => sum + line.quantity, 0)} 件 · 责任人 ${escapeHtml(record.responsible.actorName)}</div><div class="mt-1 text-slate-500">录入 ${escapeHtml(record.recordedBy.actorName)} · ${escapeHtml(record.recordedAt)}</div>${record.reason ? `<div class="mt-1 text-amber-800">订正原因：${escapeHtml(record.reason)}</div>` : ''}${record.quantities.map((entry) => `<div class="mt-1">${escapeHtml(task.lines.find((line) => line.sku.skuId === entry.skuId)?.sku.skuCode || '历史SKU')}：${entry.quantity} 件</div>`).join('')}</li>`).join('')}</ol></details>` : ''}
      </div>
    </details>`
  }).join('')
  return `
    <div class="space-y-4" data-pda-post-task="${escapeHtml(task.postTaskId)}" data-skip-page-rerender="true">
      <div data-pda-post-task-notice>${notice()}</div>
      <section class="rounded-2xl border border-blue-200 bg-blue-50 p-4">
        <button type="button" class="min-h-9 text-xs text-blue-700 underline" data-pda-post-action="clear-post">重新扫描</button>
        <div class="mt-2 flex items-start justify-between gap-3"><div class="min-w-0"><div class="break-all font-mono text-sm font-semibold">${escapeHtml(task.postTaskNo)}</div><div class="mt-1 text-xs text-blue-800">${escapeHtml(task.productionOrderNo)} · 第 ${task.returnIndex} 次回货</div></div><span class="shrink-0 rounded-full bg-white px-3 py-1 text-xs">${escapeHtml(task.status)}</span></div>
        <div class="mt-3 text-xs text-blue-900">实际加工顺序：${task.processItems.map(escapeHtml).join(' → ')}</div>
        <div class="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-white/80 p-3 text-xs"><div>应加工<span class="mt-1 block text-base font-semibold">${progress.totalExpectedQty} 件</span></div><div>全部后道完成<span class="mt-1 block text-base font-semibold">${progress.totalCompletedQty} 件</span></div><div>已交复检占用<span class="mt-1 block text-base font-semibold">${progress.totalReservedQty} 件</span></div><div>可交复检<span class="mt-1 block text-base font-semibold">${progress.availableForRecheckQty} 件</span></div></div>
      </section>
      ${progress.legacyPending ? '<div class="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">历史加工尚未分项，请由主管在管理端核对承接后继续登记；原数量和下游记录保留。</div>' : ''}
      ${historicalCompletedQty > 0 ? `<div class="rounded-2xl border border-slate-200 bg-white p-3 text-xs text-slate-700">历史合并完成 ${historicalCompletedQty} 件，历史未分项；各项数量仅显示剩余新加工范围，不补造历史责任人和时间。</div>` : ''}
      ${materialReadiness.applicable && materialReadiness.status !== '已入库' ? `<section class="rounded-2xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"><strong>后道辅料未到齐。</strong><span class="mt-1 block text-xs">${escapeHtml(materialReadiness.label)}。当前仅提示，不阻断登记。</span></section>` : ''}
      <section class="space-y-2" aria-label="各加工项数量">${processes}</section>
      <details class="rounded-2xl border bg-white" data-post-recheck-form>
        <summary class="min-h-12 cursor-pointer px-4 py-3 text-sm font-semibold text-blue-700">交复检 · 当前可交 ${progress.availableForRecheckQty} 件</summary>
        <div class="space-y-3 border-t p-3">
          <p class="text-xs text-slate-600">仅填写本次交复检数量。确认后立即占用，待领取时也不能重复交出。</p>
          ${progress.lines.map((line) => `<article class="rounded-xl border p-3" data-post-recheck-line="${escapeHtml(line.sku.skuId)}"><div class="flex gap-3">${image(line.sku)}<div class="min-w-0 flex-1"><div class="break-all text-sm font-medium">${escapeHtml(line.sku.skuCode)}</div><div class="mt-1 text-xs text-slate-500">${escapeHtml(line.sku.colorName)} / ${escapeHtml(line.sku.sizeName)}</div><div class="mt-2 text-xs">全部完成 ${line.completedQty} · 已占用 ${line.reservedQty} · 可交 ${line.availableForRecheckQty} 件</div></div></div><label class="mt-3 block text-xs font-medium">本次交复检数量（件）<input aria-label="${escapeHtml(`${line.sku.skuCode} 本次交复检数量`)}" type="number" min="0" max="${line.availableForRecheckQty}" step="1" inputmode="numeric" value="0" class="mt-1 h-12 w-full rounded-xl border px-3 text-right text-base" data-post-recheck-qty data-skip-page-rerender="true" ${canRegister && line.availableForRecheckQty > 0 ? '' : 'disabled'} /></label></article>`).join('')}
          ${canRegister && progress.availableForRecheckQty > 0 ? `<button type="button" class="h-12 w-full rounded-xl bg-blue-600 text-sm font-semibold text-white" data-pda-post-action="submit-for-recheck" data-task-id="${escapeHtml(task.postTaskId)}">核对并交复检</button>` : '<div class="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">当前没有可交复检数量。</div>'}
        </div>
      </details>
      <section class="rounded-2xl border bg-white p-4"><h2 class="text-sm font-semibold">复检记录（${rechecks.length} 张）</h2><div class="mt-3 space-y-2">${rechecks.length ? rechecks.map((record) => `<button type="button" class="block min-h-12 w-full rounded-xl border px-3 py-3 text-left" data-pda-post-action="open-recheck" data-recheck-no="${escapeHtml(record.recheckOrderNo)}"><span class="break-all font-mono text-xs font-medium text-blue-700">${escapeHtml(record.recheckOrderNo)}</span><span class="mt-1 block text-xs">${escapeHtml(record.status)} · 本次 ${record.lines.reduce((sum, line) => sum + line.expectedQty, 0)} 件${record.claimedBy ? ` · ${escapeHtml(record.claimedBy.actorName)}` : ''}</span></button>`).join('') : '<p class="text-xs text-slate-500">尚未交复检。</p>'}</div></section>
      <section class="rounded-2xl border bg-white p-4"><h2 class="text-sm font-semibold">出货记录（${outbounds.length} 张）</h2><div class="mt-3 space-y-2">${outbounds.length ? outbounds.map((record) => `<div class="rounded-xl border p-3 text-xs"><div class="break-all font-mono font-medium">${escapeHtml(record.outboundOrderNo)}</div><div class="mt-1">${escapeHtml(record.status)} · 本次 ${record.lines.reduce((sum, line) => sum + line.outboundQty, 0)} 件</div></div>`).join('') : '<p class="text-xs text-slate-500">尚未生成出货单。</p>'}</div></section>
    </div>
  `
}

function refreshPostTaskLocally(task: PostFinishingPostTask, savedProcess?: string, submittedRecheck = false): void {
  document.querySelector('[data-post-finishing-action-error]')?.remove()
  const previous = document.querySelector<HTMLElement>('[data-pda-post-task]')
  if (!previous) { refresh('/fcs/pda/post-finishing/execute', task.postTaskNo); return }
  const preserved = new Map<string, string>()
  previous.querySelectorAll<HTMLElement>('[data-post-process]').forEach((process) => {
    if (process.dataset.postProcess === savedProcess) return
    process.querySelectorAll<HTMLElement>('[data-post-process-line]').forEach((line) => {
      const input = line.querySelector<HTMLInputElement>('[data-post-process-qty]')
      if (input) preserved.set(`${process.dataset.postProcess}:${line.dataset.postProcessLine}`, input.value)
    })
  })
  if (!submittedRecheck) previous.querySelectorAll<HTMLElement>('[data-post-recheck-line]').forEach((line) => {
    const input = line.querySelector<HTMLInputElement>('[data-post-recheck-qty]')
    if (input) preserved.set(`RECHECK:${line.dataset.postRecheckLine}`, input.value)
  })
  const openProcesses = new Set(Array.from(previous.querySelectorAll<HTMLDetailsElement>('details[data-post-process][open]')).map((details) => details.dataset.postProcess))
  const recheckOpen = previous.querySelector<HTMLDetailsElement>('[data-post-recheck-form]')?.open || false
  const template = document.createElement('template')
  template.innerHTML = renderPostTask(task)
  const next = template.content.firstElementChild as HTMLElement
  next.querySelectorAll<HTMLElement>('[data-post-process]').forEach((process) => {
    const details = process as HTMLDetailsElement
    details.open = openProcesses.has(process.dataset.postProcess)
    process.querySelectorAll<HTMLElement>('[data-post-process-line]').forEach((line) => {
      const input = line.querySelector<HTMLInputElement>('[data-post-process-qty]')
      const value = preserved.get(`${process.dataset.postProcess}:${line.dataset.postProcessLine}`)
      if (input && value !== undefined && !input.disabled) input.value = value
    })
  })
  next.querySelectorAll<HTMLElement>('[data-post-recheck-line]').forEach((line) => {
    const input = line.querySelector<HTMLInputElement>('[data-post-recheck-qty]')
    const value = preserved.get(`RECHECK:${line.dataset.postRecheckLine}`)
    if (input && value !== undefined && !input.disabled) input.value = value
  })
  const recheckDetails = next.querySelector<HTMLDetailsElement>('[data-post-recheck-form]')
  if (recheckDetails) recheckDetails.open = recheckOpen
  previous.replaceWith(next)
}

export function renderPdaPostFinishingSkuAdjustmentPage(): string {
  const task = getPostFinishingFullFlowPostTask(query().get('id') || '')
  const body = `<section class="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">旧整单“未处理数量”登记入口已停用。正常余量由各加工项进度计算；历史记录保留，请返回当前加工单查看。</section><button type="button" class="h-12 w-full rounded-2xl bg-blue-600 text-sm font-semibold text-white" data-pda-post-action="return-to-post" data-task-no="${escapeHtml(task?.postTaskNo || '')}">返回后道加工单</button>`
  return shell('查看当前加工进度', '后道加工', body, 'pda-post-finishing-sku-adjustment-page')
}

export function renderPdaPostFinishingExecutionPage(): string {
  const id = query().get('id') || ''
  const task = id ? getPostFinishingFullFlowPostTask(id) : undefined
  const body = task
    ? renderPostTask(task)
    : scanner({ label: '扫描或输入后道加工单号', placeholder: '生产单号-回货次数-ZJ-HD', action: 'scan-post', field: 'postScan', help: '输入完整加工单号也可查询；加工项由质检确认，按项登记本次数量与责任。' })
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
      <div data-pda-recheck-notice>${notice()}</div>
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
      ${record.status === '待复检' ? `<button type="button" class="h-12 w-full rounded-2xl bg-blue-600 text-base font-semibold text-white" data-pda-post-action="claim-recheck" data-recheck-id="${escapeHtml(record.recheckOrderId)}">领取本张复检单</button>` : ''}
      ${record.status === '复检完成' ? `<div class="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">本次数量与条码已复核，货物已进入后道待交出仓，对应出货单：${escapeHtml(record.outboundOrderNo || '生成中')}</div>` : ''}
    </div>
  `
}

function refreshRecheckTaskLocally(record: PostFinishingRecheckOrder, preserveInput = true): void {
  document.querySelector('[data-post-finishing-action-error]')?.remove()
  const previous = document.querySelector<HTMLElement>('[data-pda-recheck-task]')
  if (!previous) { refresh('/fcs/pda/post-finishing/recheck', record.recheckOrderNo); return }
  const quantities = new Map<string, string>()
  previous.querySelectorAll<HTMLElement>('[data-recheck-result-line]').forEach((line) => {
    const input = line.querySelector<HTMLInputElement>('[data-recheck-result-field="handoverQty"]')
    if (input) quantities.set(line.dataset.recheckResultLine || '', input.value)
  })
  const authorization = readValue(previous, '[data-recheck-authorization]')
  const differenceReason = readValue(previous, '[data-recheck-difference-reason]')
  const template = document.createElement('template')
  template.innerHTML = renderRecheckTask(record)
  const next = template.content.firstElementChild as HTMLElement
  if (preserveInput) {
    next.querySelectorAll<HTMLElement>('[data-recheck-result-line]').forEach((line) => {
      const input = line.querySelector<HTMLInputElement>('[data-recheck-result-field="handoverQty"]')
      const value = quantities.get(line.dataset.recheckResultLine || '')
      if (input && value !== undefined) input.value = value
    })
    const authorizationInput = next.querySelector<HTMLTextAreaElement>('[data-recheck-authorization]')
    const reasonInput = next.querySelector<HTMLInputElement>('[data-recheck-difference-reason]')
    if (authorizationInput) authorizationInput.value = authorization
    if (reasonInput) reasonInput.value = differenceReason
  }
  previous.replaceWith(next)
  updateQuantitySummaries()
}

export function renderPdaPostFinishingRecheckPage(): string {
  const id = query().get('id') || ''
  const record = id ? getPostFinishingFullFlowRecheckOrder(id) : undefined
  const task = !record && id ? getPostFinishingFullFlowPostTask(id) : undefined
  const records = task ? listPostFinishingFullFlowRecheckOrders().filter((item) => item.postTaskId === task.postTaskId) : []
  const body = record
    ? renderRecheckTask(record)
    : task
      ? `<section class="rounded-2xl border bg-white p-4" data-skip-page-rerender="true"><h2 class="text-sm font-semibold">选择本次复检单</h2><div class="mt-2 break-all font-mono text-xs text-slate-500">${escapeHtml(task.postTaskNo)}</div><div class="mt-3 space-y-2">${records.length ? records.map((item) => `<button type="button" class="min-h-12 w-full rounded-xl border p-3 text-left" data-pda-post-action="open-recheck" data-recheck-no="${escapeHtml(item.recheckOrderNo)}"><span class="break-all font-mono text-xs font-medium text-blue-700">${escapeHtml(item.recheckOrderNo)}</span><span class="mt-1 block text-xs">${escapeHtml(item.status)} · ${item.lines.reduce((sum, line) => sum + line.expectedQty, 0)} 件</span></button>`).join('') : '<p class="text-sm text-slate-600">尚未交复检，请先在加工单登记完成量并交复检。</p>'}</div></section>`
      : scanner({ label: '扫描或输入完整复检单号', placeholder: '生产单号-回货次数-ZJ-HD-FJ-001', action: 'scan-recheck', field: 'recheckScan', help: '扫描成功即由当前账号领取本张单；条码错误必须重贴并复扫。' })
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
  const previousFocus = document.activeElement as HTMLElement | null
  const overlay = document.createElement('div')
  overlay.className = 'fixed inset-0 z-[220] flex items-center justify-center bg-black/75 p-4'
  overlay.setAttribute('role', 'dialog')
  overlay.setAttribute('aria-modal', 'true')
  overlay.setAttribute('aria-label', `${label} 原图`)
  overlay.innerHTML = `<button type="button" class="absolute right-4 top-4 rounded-full bg-white px-3 py-2 text-sm">关闭</button><div class="flex min-h-40 min-w-64 items-center justify-center rounded-xl bg-white p-3"><img src="${escapeHtml(url)}" alt="${escapeHtml(label)}" class="max-h-[82vh] max-w-[86vw] rounded-xl object-contain" onload="this.nextElementSibling.hidden=true" onerror="this.hidden=true;this.nextElementSibling.textContent='图片加载失败，请核对原图后重试';this.nextElementSibling.hidden=false" /><span class="p-8 text-sm text-slate-500">图片加载中…</span></div>`
  const close = () => {
    overlay.remove()
    document.removeEventListener('keydown', onKeydown)
    if (previousFocus?.isConnected) previousFocus.focus()
  }
  const onKeydown = (keydownEvent: KeyboardEvent) => { if (keydownEvent.key === 'Escape') close() }
  overlay.addEventListener('click', close)
  document.addEventListener('keydown', onKeydown)
  document.body.appendChild(overlay)
  overlay.querySelector<HTMLButtonElement>('button')?.focus()
}

function setError(error: unknown): void {
  message = error instanceof Error ? error.message : '操作失败，请重新核对。'
  messageTone = 'error'
}

function isQuantityInput(target: HTMLElement, event?: Event): boolean {
  if (event?.type !== 'input' || !(target instanceof HTMLInputElement)) return false
  return target.matches('[data-return-first-count], [data-return-second-count], [data-post-process-qty], [data-post-recheck-qty], [data-recheck-result-field="handoverQty"]')
}

export async function handlePdaPostFinishingFlowEvent(target: HTMLElement, event?: Event): Promise<boolean> {
  if (await handlePostFinishingStorageEvent(target, event)) return true
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
    if (action === 'clear-post') {
      if (hasPostUnsavedInput() && !window.confirm('本次填写的加工或交复检数量尚未保存，重新扫描后需要重新填写。确认重新扫描？')) return true
      refresh('/fcs/pda/post-finishing/execute', '')
      return true
    }
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
      const confirmed = await runPostFinishingCommand(() => confirmPostFinishingFactoryReturn({
        deliveryId: current.deliveryId,
        actualConfirmedAt: readValue(root, '[data-return-business-confirmed-at]') || undefined,
        entryDelayReason: readValue(root, '[data-return-entry-delay-reason]') || undefined,
        firstCounts,
        secondCounts,
        actor: actor('回货确认人员'),
        authorization: current.status === '差异待授权'
          ? { scanValue: readValue(root, '[data-return-authorization]'), differenceReason: readValue(root, '[data-return-difference-reason]') }
          : undefined,
      }))
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
      const discarded = await runPostFinishingCommand(() => discardPostFinishingFactoryReturn({
        deliveryId: current.deliveryId,
        reason,
        actor: actor('回货确认人员'),
      }))
      message = `已废弃 ${discarded.deliveryOrderNo}；明细和原因已保留。`
      messageTone = 'success'
      refresh('/fcs/pda/post-finishing/return-confirm', discarded.deliveryOrderNo)
      return true
    }
    if (action === 'return-to-post') {
      refresh('/fcs/pda/post-finishing/execute', actionNode?.dataset.taskNo || '')
      return true
    }
    if (action === 'leave-post') {
      if (hasPostUnsavedInput() && !window.confirm('本次填写的加工或交复检数量尚未保存，离开后需要重新填写。确认离开？')) return true
      appStore.navigate(actionNode?.dataset.destination || '/fcs/pda/exec')
      return true
    }
    if (action === 'open-recheck') {
      if (hasPostUnsavedInput() && !window.confirm('本次填写的加工或交复检数量尚未保存，前往复检后需要重新填写。确认前往？')) return true
      refresh('/fcs/pda/post-finishing/recheck', actionNode?.dataset.recheckNo || '')
      return true
    }
    if (action === 'scan-post') {
      const scanValue = (field?.value || readValue(document, '[data-pda-post-field="postScan"]')).trim()
      const task = getPostFinishingFullFlowPostTask(scanValue)
      if (!task || task.postTaskNo !== scanValue) throw new Error('未找到完整后道加工单号，请重新扫描或输入完整单号。')
      message = `已识别 ${task.postTaskNo}，请选择加工项填写本次完成数量。`
      messageTone = 'success'
      refresh('/fcs/pda/post-finishing/execute', task.postTaskNo)
      return true
    }
    if (['start-post', 'save-processed-qty', 'save-unprocessed-qty', 'complete-post'].includes(action)) {
      throw new Error('旧整单加工登记已停用。请返回加工单，按实际加工项登记本次完成数量，再独立交复检。')
    }
    if (action === 'save-process-completion' || action === 'submit-for-recheck') {
      if (actionNode && !actionNode.isConnected) return true
      const taskId = actionNode?.dataset.taskId || ''
      const task = getPostFinishingFullFlowPostTask(taskId)
      if (!task) throw new Error('未找到后道加工单，请重新读取。')
      const isSubmission = action === 'submit-for-recheck'
      const processItem = actionNode?.dataset.processItem
      const form = actionNode?.closest<HTMLElement>(isSubmission ? '[data-post-recheck-form]' : '[data-post-process]')
      if (!form) throw new Error('未找到本次登记表单。')
      const lines = Array.from(form.querySelectorAll<HTMLElement>(isSubmission ? '[data-post-recheck-line]' : '[data-post-process-line]'))
      const quantities = lines.map((line) => {
        const input = line.querySelector<HTMLInputElement>(isSubmission ? '[data-post-recheck-qty]' : '[data-post-process-qty]')
        const raw = input?.value.trim() || ''
        if (!input || input.disabled) return { skuId: line.dataset.postRecheckLine || line.dataset.postProcessLine || '', quantity: 0 }
        if (!raw) throw new Error('本次数量不能为空；本次不登记的行填写0。')
        const quantity = Number(raw)
        if (!Number.isSafeInteger(quantity) || quantity < 0) throw new Error('本次数量必须是0或正整数件。')
        return { skuId: line.dataset.postRecheckLine || line.dataset.postProcessLine || '', quantity }
      })
      const total = quantities.reduce((sum, line) => sum + line.quantity, 0)
      if (total <= 0) throw new Error('至少填写一个SKU的正整数数量。')
      const currentActor = actor('后道操作员')
      const key = `${taskId}:${isSubmission ? 'RECHECK' : processItem}`
      if (submittingPostIntent.has(key)) return true
      const signature = JSON.stringify({ taskId, processItem, quantities, actorId: currentActor.actorId })
      const operationId = operationIntent(key, signature)
      if (isSubmission) {
        const detail = quantities.filter((line) => line.quantity > 0).map((entry) => `${task.lines.find((line) => line.sku.skuId === entry.skuId)?.sku.skuCode || 'SKU'}：${entry.quantity} 件`).join('\n')
        if (!window.confirm(`将加工单 ${task.postTaskNo} 的以下数量交复检：\n${detail}\n合计 ${total} 件。创建后立即占用，不可重复交出。确认交复检？`)) return true
      }
      submittingPostIntent.add(key)
      if (actionNode instanceof HTMLButtonElement) actionNode.disabled = true
      try {
        if (isSubmission) {
          const recheck = await runPostFinishingCommand(() => submitPostFinishingForRecheck({ postTaskId: taskId, quantities, actor: currentActor, operationId }))
          message = `已交复检 ${total} 件，复检单 ${recheck.recheckOrderNo}；本次数量已占用。`
          messageTone = 'success'
          refreshPostTaskLocally(getPostFinishingFullFlowPostTask(taskId) || task, undefined, true)
          postOperationIntents.delete(key)
        } else {
          const process = getPostFinishingProcessProgress(task).processes.find((item) => item.processItem === processItem && item.applicable)
          if (!process) throw new Error('该加工项不在质检确认的范围内。')
          const saved = await runPostFinishingCommand(() => appendPostFinishingProcessCompletion({ postTaskId: taskId, processItem: process.processItem, quantities, responsible: currentActor, actor: currentActor, operationId }))
          const progress = getPostFinishingProcessProgress(saved)
          const cumulative = progress.processes.find((item) => item.processItem === process.processItem)?.completedQty || 0
          message = `${process.processItem}本次已保存 ${total} 件，累计 ${cumulative} 件；当前可交复检 ${progress.availableForRecheckQty} 件。`
          messageTone = 'success'
          refreshPostTaskLocally(saved, process.processItem)
          postOperationIntents.delete(key)
        }
      } finally {
        submittingPostIntent.delete(key)
        if (actionNode instanceof HTMLButtonElement) actionNode.disabled = false
      }
      return true
    }
    if (action === 'claim-recheck') {
      const current = getPostFinishingFullFlowRecheckOrder(actionNode?.dataset.recheckId || '')
      if (!current) throw new Error('未找到复检单，请重新读取。')
      const claimed = await runPostFinishingCommand(() => claimPostFinishingRecheckOrder({ recheckOrderNo: current.recheckOrderNo, actor: actor('复检员') }))
      message = `已领取 ${claimed.recheckOrderNo}。`
      messageTone = 'success'
      refresh('/fcs/pda/post-finishing/recheck', claimed.recheckOrderNo)
      return true
    }
    if (action === 'scan-recheck') {
      const record = await runPostFinishingCommand(() => claimPostFinishingRecheckOrder({ recheckOrderNo: (field?.value || readValue(document, '[data-pda-post-field="recheckScan"]')).trim(), actor: actor('复检员') }))
      message = `已领取 ${record.recheckOrderNo}`
      messageTone = 'success'
      refresh('/fcs/pda/post-finishing/recheck', record.recheckOrderNo)
      return true
    }
    if (action === 'scan-recheck-barcode') {
      const card = actionNode?.closest<HTMLElement>('[data-recheck-result-line]')!
      const record = await runPostFinishingCommand(() => scanPostFinishingRecheckSkuBarcode({ recheckOrderId: actionNode?.dataset.recheckId || '', skuId: actionNode?.dataset.skuId || '', scannedBarcode: readValue(card, '[data-recheck-barcode-input]'), actor: actor('复检员') }))
      message = record.status === '条码异常待重贴' ? '条码错误，已阻断出货；请打印正确贴标并重新贴码。' : '条码正确。'
      messageTone = record.status === '条码异常待重贴' ? 'error' : 'success'
      refreshRecheckTaskLocally(record)
      return true
    }
    if (action === 'mark-relabeled') {
      const record = await runPostFinishingCommand(() => markPostFinishingRecheckSkuRelabeled({ recheckOrderId: actionNode?.dataset.recheckId || '', skuId: actionNode?.dataset.skuId || '', actor: actor('复检员') }))
      message = '已记录重新贴码，必须复扫正确后才能完成。'
      messageTone = 'success'
      refreshRecheckTaskLocally(record)
      return true
    }
    if (action === 'release-recheck') {
      if (!window.confirm('释放后由其他复检员领取本张单；本单数量仍占用，未提交的复核输入不保存。确认释放？')) return true
      const record = await runPostFinishingCommand(() => releasePostFinishingRecheckOrder({ recheckOrderId: actionNode?.dataset.recheckId || '', actor: actor('复检员'), reason: '错误领取' }))
      message = '已释放并回到待复检；本单数量占用保留。'
      messageTone = 'success'
      refreshRecheckTaskLocally(record, false)
      return true
    }
    if (action === 'complete-recheck') {
      const root = document.querySelector<HTMLElement>('[data-pda-recheck-task]')!
      const lines = Array.from(root.querySelectorAll<HTMLElement>('[data-recheck-result-line]'))
      const results = lines.map((line) => {
        const raw = readValue(line, '[data-recheck-result-field="handoverQty"]')
        if (!raw || !Number.isSafeInteger(Number(raw)) || Number(raw) < 0) throw new Error('逐SKU实际交出数量须为0或正整数件，不能为空。')
        return { skuId: line.dataset.recheckResultLine || '', handoverQty: Number(raw) }
      })
      const diff = lines.some((line, index) => Number(line.dataset.expectedQty) !== results[index]!.handoverQty)
      const record = await runPostFinishingCommand(() => completePostFinishingRecheckOrderFullFlow({ recheckOrderId: actionNode?.dataset.recheckId || '', actor: actor('复检员'), results, authorization: diff ? { scanValue: readValue(root, '[data-recheck-authorization]'), differenceReason: readValue(root, '[data-recheck-difference-reason]') } : undefined }))
      message = `数量与条码复核完成，已进入后道待交出仓并生成出货单 ${record.outboundOrderNo}`
      messageTone = 'success'
      refreshRecheckTaskLocally(record, false)
      return true
    }
  } catch (error) {
    setError(error)
    const nextStep = action === 'confirm-return' && error instanceof Error && 'code' in error && ['SECOND_COUNT_REQUIRED', 'AUTHORIZATION_REQUIRED'].includes(String(error.code))
    if (!nextStep) {
      showPostFinishingActionFailure(error instanceof Error ? error.message : '本次未保存，请保留输入后重试。', target)
      return true
    }
    refresh(window.location.pathname, query().get('id') || '', { skuId: query().get('skuId') || '' })
    return true
  }
  return false
}
