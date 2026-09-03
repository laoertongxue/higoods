// @page-pattern: form

import {
  POST_FINISHING_PROCESS_ITEMS,
  POST_FINISHING_QC_DEFECT_REASON_OPTIONS,
  claimPostFinishingQcTask,
  completePostFinishingQcTask,
  getCurrentPostFinishingActor,
  getPostFinishingFactoryReturn,
  getPostFinishingFullFlowQcTask,
  listPostFinishingQcReworkFactoryOptions,
  releasePostFinishingQcTask,
  type PostFinishingQcTask,
} from '../../../data/fcs/post-finishing-full-flow.ts'
import {
  getPostFinishingSpuTechnicalParameter,
  isPostFinishingSpuTechnicalParameterMaintained,
} from '../../../data/fcs/post-finishing-spu-technical-parameters.ts'
import { appStore } from '../../../state/store.ts'
import { escapeHtml } from '../../../utils.ts'
import { renderPostFinishingPageHeader, renderPostFinishingQcPrintActions, renderPostStatusBadge } from './shared.ts'

let notice = ''
let noticeTone: 'success' | 'error' = 'success'
let releaseConfirmTaskId = ''

function query(): URLSearchParams {
  return typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search)
}

function navigate(taskNo = query().get('taskNo') || ''): void {
  appStore.navigate(`/fcs/craft/post-finishing/qc-workbench?${taskNo ? `taskNo=${encodeURIComponent(taskNo)}&` : ''}refresh=${Date.now()}`)
}

function renderNotice(): string {
  if (!notice) return ''
  return `<div role="status" class="rounded-xl border px-4 py-3 text-sm ${noticeTone === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}">${escapeHtml(notice)}</div>`
}

function renderScanner(): string {
  const actor = getCurrentPostFinishingActor()
  return `<section class="mx-auto max-w-2xl rounded-xl border bg-card p-5 shadow-sm" data-qc-workbench-scan>
    <div class="flex flex-wrap items-start justify-between gap-3"><div><h2 class="text-lg font-semibold">输入完整质检单号</h2><p class="mt-1 text-sm text-muted-foreground">Web 端不调用摄像头；输入完整单号后由当前账号领取。</p></div><div class="text-right text-xs"><div class="font-semibold">当前账号：${escapeHtml(actor.actorName)}</div><div class="mt-1 text-muted-foreground">${escapeHtml(actor.roleName)}</div></div></div>
    <div class="mt-5 flex gap-2"><input autofocus class="h-11 min-w-0 flex-1 rounded-md border px-3 font-mono" placeholder="请输入完整质检单号，例如 PO-QC-202608-001-1" data-post-finishing-field="qc-task-input" /><button type="button" class="rounded-md bg-blue-600 px-5 text-sm font-semibold text-white" data-post-finishing-action="full-flow-claim-qc">领取质检单</button></div>
    <div class="mt-4 text-xs"><a data-nav="/fcs/craft/post-finishing/qc-orders" class="text-slate-600 underline">返回质检单</a></div>
  </section>`
}

function imageButton(task: PostFinishingQcTask, index: number): string {
  const sku = task.lines[index].sku
  const label = `${sku.skuCode} ${sku.colorName} ${sku.sizeName}`
  return `<button type="button" class="relative flex h-14 w-14 shrink-0 cursor-zoom-in items-center justify-center overflow-hidden rounded-lg border bg-slate-50" data-post-finishing-action="full-flow-zoom-image" data-image-url="${escapeHtml(sku.imageUrl)}" data-image-label="${escapeHtml(label)}"><img src="${escapeHtml(sku.imageUrl)}" alt="${escapeHtml(`${sku.spuName} ${sku.colorName} ${sku.sizeName}`)}" class="h-full w-full object-cover" onload="this.nextElementSibling.hidden=true" onerror="this.hidden=true;this.nextElementSibling.textContent='图片加载失败';this.nextElementSibling.hidden=false"/><span class="px-1 text-center text-[10px] text-slate-500">图片加载中…</span></button>`
}

function priorReasonQuantity(task: PostFinishingQcTask, index: number, reason: string): number {
  const line = task.lines[index]
  const prior = task.results?.find((item) => item.sku.skuId === line.sku.skuId)
  const detailed = prior?.defectReasonQuantities?.find((item) => item.reason === reason)?.quantity
  if (detailed !== undefined) return detailed
  if (prior?.defectReason === reason) return prior.defectQty
  if (reason === '其他' && prior?.defectQty && !prior.defectReasonQuantities?.length) return prior.defectQty
  return 0
}

function renderResultLine(task: PostFinishingQcTask, index: number, canEdit: boolean): string {
  const line = task.lines[index]
  const prior = task.results?.find((item) => item.sku.skuId === line.sku.skuId)
  const disabled = canEdit ? '' : 'disabled'
  const reworkQty = prior?.returnQty ?? 0
  const defectQty = POST_FINISHING_QC_DEFECT_REASON_OPTIONS.reduce((sum, reason) => sum + priorReasonQuantity(task, index, reason), 0)
  return `<article class="overflow-hidden rounded-xl border bg-white" data-qc-result-line="${escapeHtml(line.sku.skuId)}" data-expected-qty="${line.expectedQty}">
    <div class="flex gap-3 border-b bg-slate-50/70 p-3">${imageButton(task, index)}<div class="min-w-0 flex-1"><div class="font-semibold">${escapeHtml(line.sku.skuCode)}</div><div class="mt-1 text-xs text-muted-foreground">${escapeHtml(line.sku.spuCode)} · ${escapeHtml(line.sku.colorName)} / ${escapeHtml(line.sku.sizeName)} · 送检 ${line.expectedQty} 件</div></div></div>
    <div class="space-y-4 p-3">
      <section><h4 class="text-sm font-semibold">质检与返工</h4><div class="mt-2 grid gap-3 sm:grid-cols-3">
        <label class="text-xs text-muted-foreground">待质检数量<input value="${line.expectedQty} 件" class="mt-1 h-10 w-full rounded-md border bg-slate-100 px-3" disabled /></label>
        <label class="text-xs text-muted-foreground">合格数量<input type="number" min="0" step="1" value="${prior?.passedQty ?? line.expectedQty}" class="mt-1 h-10 w-full rounded-md border px-3 text-right" data-qc-result-field="passedQty" ${disabled}/></label>
        <label class="text-xs text-muted-foreground">返工数量<input type="number" min="0" step="1" value="${reworkQty}" class="mt-1 h-10 w-full rounded-md border px-3 text-right" data-qc-result-field="returnQty" ${disabled}/></label>
      </div><div class="${reworkQty > 0 ? '' : 'hidden '}mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3" data-qc-rework-factory-block><label class="block text-xs text-amber-900">返工接收工厂（可输入搜索）<input value="${escapeHtml(prior?.returnReceiver || '')}" list="post-finishing-qc-rework-factories" placeholder="请输入工厂名称搜索并选择" class="mt-1 h-10 w-full rounded-md border bg-white px-3 text-sm" data-qc-result-field="returnReceiver" ${reworkQty > 0 && canEdit ? '' : 'disabled'}/></label></div></section>
      <section class="border-t border-dashed pt-4"><div class="flex flex-wrap items-end justify-between gap-3"><div><h4 class="text-sm font-semibold">瑕疵</h4><p class="mt-1 text-xs text-muted-foreground">分别填写各瑕疵原因数量，瑕疵数量由系统自动汇总。</p></div><label class="w-36 text-xs text-muted-foreground">瑕疵数量<input type="number" value="${defectQty}" class="mt-1 h-10 w-full rounded-md border bg-slate-100 px-3 text-right font-semibold" data-qc-result-field="defectQty" readonly /></label></div>
        <div class="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">${POST_FINISHING_QC_DEFECT_REASON_OPTIONS.map((reason) => `<label class="text-xs text-muted-foreground">${escapeHtml(reason)}<input type="number" min="0" step="1" value="${priorReasonQuantity(task, index, reason)}" class="mt-1 h-9 w-full rounded-md border px-2 text-right" data-qc-defect-reason="${escapeHtml(reason)}" ${disabled}/></label>`).join('')}</div>
      </section>
    </div>
  </article>`
}

function renderTechnicalParameterImage(url: string, label: string, className = 'h-40'): string {
  return `<button type="button" class="relative flex ${className} w-full cursor-zoom-in items-center justify-center overflow-hidden rounded-lg border bg-slate-50" data-post-finishing-action="full-flow-zoom-image" data-image-url="${escapeHtml(url)}" data-image-label="${escapeHtml(label)}"><img src="${escapeHtml(url)}" alt="${escapeHtml(label)}" class="h-full w-full object-contain" onload="this.nextElementSibling.hidden=true" onerror="this.hidden=true;this.nextElementSibling.textContent='图片加载失败';this.nextElementSibling.hidden=false"/><span class="text-xs text-slate-500">图片加载中…</span></button>`
}

function renderSpuTechnicalParameters(task: PostFinishingQcTask): string {
  const spuCodes = [...new Set(task.lines.map((line) => line.sku.spuCode))]
  return `<aside class="space-y-3 xl:sticky xl:top-4 xl:self-start" data-qc-spu-technical-parameters><section class="rounded-xl border bg-card p-4"><div class="flex items-start justify-between gap-3"><div><h3 class="font-semibold">SPU 技术参数</h3><p class="mt-1 text-xs text-muted-foreground">颜色对照图、各尺码尺寸</p></div><button type="button" class="rounded-md border px-3 py-2 text-xs text-blue-700" data-post-finishing-action="open-spu-tech-params" data-spu-code="${escapeHtml(spuCodes[0] || '')}" data-skip-page-rerender="true">维护参数</button></div></section>${spuCodes.map((spuCode) => {
    const line = task.lines.find((item) => item.sku.spuCode === spuCode)!
    const record = getPostFinishingSpuTechnicalParameter(spuCode)
    const maintained = isPostFinishingSpuTechnicalParameterMaintained(record)
    if (!record || !maintained) return `<section class="rounded-xl border border-amber-200 bg-amber-50 p-4"><div class="flex gap-3"><img src="${escapeHtml(line.sku.imageUrl)}" alt="${escapeHtml(line.sku.spuName)}" class="h-16 w-16 rounded-lg border object-cover"/><div class="min-w-0"><div class="font-semibold">${escapeHtml(spuCode)}</div><div class="mt-1 text-xs text-muted-foreground">${escapeHtml(line.sku.spuName)}</div><span class="mt-2 inline-flex rounded-full bg-amber-100 px-2 py-1 text-xs text-amber-800">技术参数未维护</span></div></div><button type="button" class="mt-3 h-9 w-full rounded-md bg-amber-600 text-sm font-medium text-white" data-post-finishing-action="open-spu-tech-params" data-spu-code="${escapeHtml(spuCode)}" data-skip-page-rerender="true">立即维护</button></section>`
    return `<section class="space-y-3 rounded-xl border bg-card p-4"><div class="flex gap-3"><img src="${escapeHtml(record.productImageUrl)}" alt="${escapeHtml(record.spuName)}" class="h-16 w-16 rounded-lg border object-cover"/><div class="min-w-0"><div class="font-semibold">${escapeHtml(record.spuCode)}</div><div class="mt-1 text-xs text-muted-foreground">${escapeHtml(record.spuName)}</div><span class="mt-2 inline-flex rounded-full bg-emerald-100 px-2 py-1 text-xs text-emerald-800">技术参数已维护</span></div></div><div><div class="mb-2 text-xs font-medium">颜色对照图</div>${renderTechnicalParameterImage(record.colorReferenceImageUrl, `${record.spuCode} 颜色对照图`)}${record.colorReferenceNote ? `<p class="mt-2 text-xs text-muted-foreground">${escapeHtml(record.colorReferenceNote)}</p>` : ''}</div><div><div class="mb-2 text-xs font-medium">各尺码尺寸</div><div class="overflow-x-auto"><table class="w-full min-w-[430px] text-left text-[11px]"><thead class="bg-slate-50 text-muted-foreground"><tr><th class="px-2 py-2">尺码</th><th class="px-2 py-2">衣长</th><th class="px-2 py-2">肩宽</th><th class="px-2 py-2">胸围</th><th class="px-2 py-2">袖长</th><th class="px-2 py-2">袖口</th></tr></thead><tbody>${record.sizeRows.map((row) => `<tr class="border-t"><td class="px-2 py-2 font-medium">${escapeHtml(row.sizeName)}</td><td class="px-2 py-2">${escapeHtml(row.backLength || '见图')}</td><td class="px-2 py-2">${escapeHtml(row.shoulderWidth || '见图')}</td><td class="px-2 py-2">${escapeHtml(row.bust || '见图')}</td><td class="px-2 py-2">${escapeHtml(row.sleeveLength || '见图')}</td><td class="px-2 py-2">${escapeHtml(row.cuff || '见图')}</td></tr>`).join('')}</tbody></table></div>${record.sizeRows.filter((row) => row.imageUrl).map((row) => `<div class="mt-2"><div class="mb-1 text-xs">${escapeHtml(row.sizeName)} 码尺寸图</div>${renderTechnicalParameterImage(row.imageUrl!, `${record.spuCode} ${row.sizeName} 码尺寸图`, 'h-28')}</div>`).join('')}</div><div class="border-t pt-3 text-[11px] text-muted-foreground">${escapeHtml(record.updatedBy)} · ${escapeHtml(new Date(record.updatedAt).toLocaleString('zh-CN'))}</div></section>`
  }).join('')}</aside>`
}

function renderTask(task: PostFinishingQcTask): string {
  const actor = getCurrentPostFinishingActor()
  const delivery = getPostFinishingFactoryReturn(task.deliveryId)
  const isOwner = task.claimedBy?.actorId === actor.actorId
  const canEdit = Boolean(isOwner && task.status === '质检中')
  const expectedTotal = task.lines.reduce((sum, line) => sum + line.expectedQty, 0)
  const actualTotal = task.results?.reduce((sum, line) => sum + line.passedQty + line.defectQty + line.returnQty, 0) ?? expectedTotal
  const differentSkuCount = task.results?.filter((result) => result.expectedQty !== result.passedQty + result.defectQty + result.returnQty).length ?? 0
  const responsibility = task.responsibility
  const selectedProcessItems = task.frozenProcessItems || responsibility.defaultProcessItems
  const completedTarget = task.postTaskNo ? '后道加工单' : task.recheckOrderNo ? '复检单' : '待生成下游单据'
  const releaseControl = canEdit
    ? releaseConfirmTaskId === task.qcTaskId
      ? `<div class="w-full rounded-lg border border-amber-300 bg-amber-50 p-3" data-qc-release-confirm><div class="text-sm font-semibold text-amber-900">确认退领并放弃当前未提交内容？</div><label class="mt-2 block text-xs text-amber-900">退领原因（可填写）<input class="mt-1 h-9 w-full rounded-md border bg-white px-3" value="错误领取" data-qc-release-reason /></label><div class="mt-2 flex gap-2"><button type="button" class="rounded-md bg-amber-600 px-4 py-2 text-sm text-white" data-post-finishing-action="full-flow-release-qc" data-task-id="${escapeHtml(task.qcTaskId)}">确认退领</button><button type="button" class="rounded-md border bg-white px-4 py-2 text-sm" data-post-finishing-action="full-flow-release-qc-cancel">取消</button></div></div>`
      : `<button type="button" class="rounded-md border border-amber-300 px-4 py-2 text-sm text-amber-800" data-post-finishing-action="full-flow-release-qc-prompt" data-task-id="${escapeHtml(task.qcTaskId)}">错误领取，退回待质检</button>`
    : ''
  return `<div class="space-y-4" data-qc-workbench-task="${escapeHtml(task.qcTaskId)}" data-skip-page-rerender="true">
    <section class="rounded-xl border bg-card p-4"><div class="flex flex-wrap items-start justify-between gap-4"><div><button type="button" data-post-finishing-action="full-flow-qc-clear" class="text-sm text-blue-700 hover:underline">← 输入其他任务</button><h2 class="mt-2 text-xl font-semibold">${escapeHtml(task.qcTaskNo)}</h2><p class="mt-1 text-sm text-muted-foreground">${escapeHtml(task.deliveryOrderNo)} · ${escapeHtml(task.productionOrderNo)} · 第 ${task.returnIndex} 次送货</p><div class="mt-2 flex flex-wrap gap-2 text-xs"><span class="rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-blue-800">${escapeHtml(responsibility.taskTypeLabel)}</span><span class="rounded-full border px-2 py-1">${escapeHtml(responsibility.responsibilityLabel)}</span>${task.status === '质检完成' ? `<span class="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-800">去向：${escapeHtml(completedTarget)}</span>` : ''}</div><p class="mt-2 text-xs text-muted-foreground">送货登记：${escapeHtml(delivery ? new Date(delivery.registeredAt).toLocaleString('zh-CN') : '—')} · 质检单生成：${escapeHtml(new Date(task.createdAt).toLocaleString('zh-CN'))} · 送检：${escapeHtml(task.sentAt ? new Date(task.sentAt).toLocaleString('zh-CN') : '待加工仓尚未送检')}</p></div><div class="text-right">${renderPostStatusBadge(task.status)}<div class="mt-2 text-xs text-muted-foreground">${task.claimedBy ? `质检员：${escapeHtml(task.claimedBy.actorName)}<br/>领取：${escapeHtml(new Date(task.claimedAt || '').toLocaleString('zh-CN'))}` : task.status === '待送检' ? '尚未送检，不能领取' : '尚未领取'}</div></div></div>
      ${task.status === '待送检' ? `<div class="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">质检单已在回货确认时生成，但对应货物尚未从后道待加工仓送检出库。请先完成送检交接，再由质检员领取。</div>` : ''}
      ${task.claimedBy && !isOwner && task.status !== '质检完成' ? `<div class="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">已由 ${escapeHtml(task.claimedBy.actorName)} 质检中。当前账号不能录入或提交。</div>` : ''}
      <div class="mt-4 flex flex-wrap gap-2">${!task.claimedBy && task.status === '待质检' ? `<button type="button" class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white" data-post-finishing-action="full-flow-claim-qc" data-task-no="${escapeHtml(task.qcTaskNo)}">领取质检单</button>` : ''}${task.status === '待送检' ? `<a data-nav="/fcs/craft/post-finishing/wait-process-warehouse?tab=returns&deliveryId=${encodeURIComponent(task.deliveryId)}" class="rounded-md border border-amber-300 px-4 py-2 text-sm text-amber-800">去待加工仓送检</a>` : ''}${releaseControl}${task.status === '质检完成' && task.postTaskNo ? `<a data-nav="/fcs/craft/post-finishing/work-orders?keyword=${encodeURIComponent(task.postTaskNo)}" class="rounded-md border px-4 py-2 text-sm">查看后道加工单</a>` : ''}${task.status === '质检完成' && !task.postTaskNo && task.recheckOrderNo ? `<a data-nav="/fcs/craft/post-finishing/recheck-orders?keyword=${encodeURIComponent(task.recheckOrderNo)}" class="rounded-md border px-4 py-2 text-sm">查看复检单</a>` : ''}</div>
    </section>
    <div class="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.75fr)]"><section class="min-w-0 rounded-xl border bg-card p-4"><div><h3 class="font-semibold">逐 SKU 质检结果</h3><p class="mt-1 text-xs text-muted-foreground">合格 + 瑕疵 + 返工应等于送检数；瑕疵数量由各原因自动汇总，数量存在差异时必须授权。</p></div><div class="mt-3 rounded-lg px-3 py-2 text-sm ${differentSkuCount ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-800'}" data-qc-live-summary>送检 ${expectedTotal} 件 · 当前分类合计 ${actualTotal} 件 · 整单差异 ${actualTotal - expectedTotal} 件 · ${differentSkuCount} 个 SKU 有差异</div><div class="mt-4 space-y-3">${task.lines.map((_, index) => renderResultLine(task, index, canEdit)).join('')}</div>
      ${canEdit ? `<div class="mt-4 space-y-3 rounded-xl border bg-slate-50 p-3"><fieldset class="rounded-lg border bg-white p-3" data-qc-process-items data-process-items-editable="${responsibility.processItemsEditable ? 'true' : 'false'}"><legend class="px-1 text-sm font-medium">后道加工项目</legend><div class="mb-3 rounded-md px-3 py-2 text-xs ${responsibility.processItemsEditable ? 'border border-blue-200 bg-blue-50 text-blue-800' : 'border border-amber-200 bg-amber-50 text-amber-900'}">${responsibility.processItemsEditable ? '第三方工厂已承接烫包；只有质检发现漏做时才勾选。未勾选将直接进入复检。' : '本生产单只外发车缝，以下项目由后道工厂完成，系统已锁定，不能取消。'}</div><div class="grid gap-2 sm:grid-cols-3">${POST_FINISHING_PROCESS_ITEMS.map((item) => `<label class="flex items-center gap-2 rounded-md border p-2 text-sm ${responsibility.processItemsEditable ? '' : 'bg-slate-50'}"><input type="checkbox" value="${escapeHtml(item)}" ${selectedProcessItems.includes(item) ? 'checked' : ''} ${responsibility.processItemsEditable ? '' : 'disabled'} data-qc-process-item />${escapeHtml(item)}</label>`).join('')}</div></fieldset><div class="${differentSkuCount ? '' : 'hidden '}grid gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 md:grid-cols-2" data-qc-difference-authorization><div class="text-sm font-semibold text-amber-900 md:col-span-2">当前存在逐 SKU 数量差异，提交前必须录入授权码。</div><label class="text-sm">差异原因<input class="mt-1 h-10 w-full rounded-md border bg-white px-3" data-qc-difference-reason /></label><label class="text-sm md:col-span-2">录入或粘贴 30 秒动态授权码<textarea class="mt-1 min-h-20 w-full rounded-md border bg-white px-3 py-2 font-mono text-xs" data-qc-authorization></textarea></label></div><button type="button" class="h-11 w-full rounded-md bg-blue-600 font-semibold text-white" data-post-finishing-action="full-flow-complete-qc" data-task-id="${escapeHtml(task.qcTaskId)}" data-qc-complete-label>${selectedProcessItems.length ? '完成质检并生成后道加工单' : '完成质检并进入复检'}</button></div>` : ''}</section>${renderSpuTechnicalParameters(task)}</div>
    <datalist id="post-finishing-qc-rework-factories">${listPostFinishingQcReworkFactoryOptions().map((factory) => `<option value="${escapeHtml(factory.value)}">${escapeHtml(factory.label)}</option>`).join('')}</datalist>
  </div>`
}

export function renderPostFinishingQcWorkbenchPage(): string {
  const taskNo = query().get('taskNo') || ''
  const task = taskNo ? getPostFinishingFullFlowQcTask(taskNo) : undefined
  return `<div class="space-y-4 p-4" data-testid="post-finishing-qc-workbench-page">${renderPostFinishingPageHeader('质检单执行', '输入完整单号领取 · 一单一质检员 · 支持退领', task ? renderPostFinishingQcPrintActions(task.qcTaskNo) : renderPostFinishingQcPrintActions())}${renderNotice()}${task ? renderTask(task) : renderScanner()}</div>`
}

function readValue(root: ParentNode, selector: string): string {
  return root.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(selector)?.value.trim() || ''
}

function collectResults(root: HTMLElement) {
  return Array.from(root.querySelectorAll<HTMLElement>('[data-qc-result-line]')).map((line) => {
    const returnQty = Number(readValue(line, '[data-qc-result-field="returnQty"]') || 0)
    const defectReasonQuantities = Array.from(line.querySelectorAll<HTMLInputElement>('[data-qc-defect-reason]')).flatMap((input) => {
      const quantity = Number(input.value || 0)
      return quantity > 0 ? [{ reason: input.dataset.qcDefectReason || '', quantity }] : []
    })
    return {
      skuId: line.dataset.qcResultLine || '',
      passedQty: Number(readValue(line, '[data-qc-result-field="passedQty"]') || 0),
      defectQty: defectReasonQuantities.reduce((sum, item) => sum + item.quantity, 0),
      defectReasonQuantities,
      returnQty,
      returnReason: returnQty > 0 ? '质检返工' : undefined,
      returnReceiver: returnQty > 0 ? readValue(line, '[data-qc-result-field="returnReceiver"]') : undefined,
    }
  })
}

function updateResultLineState(line: HTMLElement): void {
  const defectQty = Array.from(line.querySelectorAll<HTMLInputElement>('[data-qc-defect-reason]'))
    .reduce((sum, input) => sum + Math.max(0, Number(input.value || 0)), 0)
  const defectTotal = line.querySelector<HTMLInputElement>('[data-qc-result-field="defectQty"]')
  if (defectTotal) defectTotal.value = String(defectQty)
  const returnQty = Math.max(0, Number(readValue(line, '[data-qc-result-field="returnQty"]') || 0))
  const factoryBlock = line.querySelector<HTMLElement>('[data-qc-rework-factory-block]')
  const factoryInput = line.querySelector<HTMLInputElement>('[data-qc-result-field="returnReceiver"]')
  factoryBlock?.classList.toggle('hidden', returnQty === 0)
  if (factoryInput) factoryInput.disabled = returnQty === 0
}

function updateLiveSummary(root: HTMLElement): void {
  const lines = Array.from(root.querySelectorAll<HTMLElement>('[data-qc-result-line]'))
  lines.forEach(updateResultLineState)
  const results = collectResults(root)
  const expected = lines.reduce((sum, line) => sum + Number(line.dataset.expectedQty || 0), 0)
  const actual = results.reduce((sum, line) => sum + line.passedQty + line.defectQty + line.returnQty, 0)
  const differentSkuCount = lines.filter((line, index) => Number(line.dataset.expectedQty || 0) !== results[index].passedQty + results[index].defectQty + results[index].returnQty).length
  const node = root.querySelector<HTMLElement>('[data-qc-live-summary]')
  if (!node) return
  node.textContent = `送检 ${expected} 件 · 当前分类合计 ${actual} 件 · 整单差异 ${actual - expected} 件 · ${differentSkuCount} 个 SKU 有差异`
  node.className = `mt-3 rounded-lg px-3 py-2 text-sm ${differentSkuCount ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-800'}`
  root.querySelector<HTMLElement>('[data-qc-difference-authorization]')?.classList.toggle('hidden', differentSkuCount === 0)
}

export function handlePostFinishingQcWorkbenchEvent(target: HTMLElement, event?: Event): boolean {
  const formRoot = target.closest<HTMLElement>('[data-qc-workbench-task]')
  if (formRoot && event?.type === 'input' && (target.closest('[data-qc-result-field]') || target.closest('[data-qc-defect-reason]'))) {
    updateLiveSummary(formRoot)
    return true
  }
  if (formRoot && event?.type === 'change' && target.closest('[data-qc-process-item]')) {
    const selectedCount = formRoot.querySelectorAll<HTMLInputElement>('[data-qc-process-item]:checked').length
    const button = formRoot.querySelector<HTMLButtonElement>('[data-qc-complete-label]')
    if (button) button.textContent = selectedCount ? '完成质检并生成后道加工单' : '完成质检并进入复检'
    return true
  }
  const actionNode = target.closest<HTMLElement>('[data-post-finishing-action]')
  const scanField = target.closest<HTMLInputElement>('[data-post-finishing-field="qc-task-input"]')
  const action = actionNode?.dataset.postFinishingAction
    || (scanField && event?.type === 'keydown' && (event as KeyboardEvent).key === 'Enter' ? 'full-flow-claim-qc' : undefined)
  if (!action || ![
    'full-flow-claim-qc',
    'full-flow-release-qc-prompt',
    'full-flow-release-qc-cancel',
    'full-flow-release-qc',
    'full-flow-complete-qc',
    'full-flow-qc-clear',
  ].includes(action)) return false
  try {
    if (action === 'full-flow-qc-clear') {
      notice = ''
      releaseConfirmTaskId = ''
      navigate('')
      return true
    }
    if (action === 'full-flow-release-qc-prompt') {
      releaseConfirmTaskId = actionNode?.dataset.taskId || ''
      navigate(query().get('taskNo') || '')
      return true
    }
    if (action === 'full-flow-release-qc-cancel') {
      releaseConfirmTaskId = ''
      navigate(query().get('taskNo') || '')
      return true
    }
    if (action === 'full-flow-claim-qc') {
      const taskNo = actionNode?.dataset.taskNo || scanField?.value || readValue(document, '[data-post-finishing-field="qc-task-input"]')
      const claimed = claimPostFinishingQcTask({ qcTaskNo: taskNo, actor: getCurrentPostFinishingActor() })
      notice = `领取成功：${claimed.qcTaskNo}`
      noticeTone = 'success'
      navigate(claimed.qcTaskNo)
      return true
    }
    if (action === 'full-flow-release-qc') {
      const released = releasePostFinishingQcTask({
        qcTaskId: actionNode?.dataset.taskId || '',
        actor: getCurrentPostFinishingActor(),
        reason: readValue(document, '[data-qc-release-reason]') || '错误领取',
      })
      releaseConfirmTaskId = ''
      notice = `${released.qcTaskNo} 已退回待质检。`
      noticeTone = 'success'
      navigate(released.qcTaskNo)
      return true
    }
    const root = document.querySelector<HTMLElement>('[data-qc-workbench-task]')
    if (!root) throw new Error('未找到质检单表单。')
    const lineNodes = Array.from(root.querySelectorAll<HTMLElement>('[data-qc-result-line]'))
    const results = collectResults(root)
    const hasDifference = lineNodes.some((line, index) => Number(line.dataset.expectedQty || 0) !== results[index].passedQty + results[index].defectQty + results[index].returnQty)
    const processItems = Array.from(root.querySelectorAll<HTMLInputElement>('[data-qc-process-item]:checked')).map((item) => item.value)
    const completed = completePostFinishingQcTask({
      qcTaskId: actionNode?.dataset.taskId || '',
      actor: getCurrentPostFinishingActor(),
      results,
      needPostFinishing: processItems.length > 0,
      processItems,
      authorization: hasDifference
        ? { scanValue: readValue(root, '[data-qc-authorization]'), differenceReason: readValue(root, '[data-qc-difference-reason]') }
        : undefined,
    })
    notice = completed.postTaskNo
      ? `质检完成，已生成后道加工单 ${completed.postTaskNo}`
      : `质检完成，已直接生成复检单 ${completed.recheckOrderNo || ''}`
    noticeTone = 'success'
    navigate(completed.qcTaskNo)
  } catch (error) {
    notice = error instanceof Error ? error.message : '质检操作失败。'
    noticeTone = 'error'
    navigate(query().get('taskNo') || '')
  }
  return true
}
