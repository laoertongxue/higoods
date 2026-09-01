// @page-pattern: form

import {
  POST_FINISHING_DEFECT_REASON_OPTIONS,
  claimPostFinishingQcTask,
  completePostFinishingQcTask,
  getPostFinishingFactoryReturn,
  getCurrentPostFinishingActor,
  getPostFinishingFullFlowQcTask,
  getPostFinishingQcTaskReferences,
  releasePostFinishingQcTask,
  uploadPostFinishingQcTaskReference,
  type PostFinishingQcTask,
} from '../../../data/fcs/post-finishing-full-flow.ts'
import { appStore } from '../../../state/store.ts'
import { escapeHtml } from '../../../utils.ts'
import { renderPostFinishingPageHeader, renderPostStatusBadge } from './shared.ts'

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
    <div class="flex flex-wrap items-start justify-between gap-3"><div><h2 class="text-lg font-semibold">输入完整质检任务号</h2><p class="mt-1 text-sm text-muted-foreground">Web 端不调用摄像头；输入完整任务号后由当前账号领取。</p></div><div class="text-right text-xs"><div class="font-semibold">当前账号：${escapeHtml(actor.actorName)}</div><div class="mt-1 text-muted-foreground">${escapeHtml(actor.roleName)}</div></div></div>
    <div class="mt-5 flex gap-2"><input autofocus class="h-11 min-w-0 flex-1 rounded-md border px-3 font-mono" placeholder="请输入完整任务号，例如 PO-QC-202608-001-1" data-post-finishing-field="qc-task-input" /><button type="button" class="rounded-md bg-blue-600 px-5 text-sm font-semibold text-white" data-post-finishing-action="full-flow-claim-qc">领取任务</button></div>
    <div class="mt-4 text-xs"><a data-nav="/fcs/craft/post-finishing/qc-orders" class="text-slate-600 underline">返回质检任务</a></div>
  </section>`
}

function imageButton(task: PostFinishingQcTask, index: number): string {
  const sku = task.lines[index].sku
  const label = `${sku.skuCode} ${sku.colorName} ${sku.sizeName}`
  return `<button type="button" class="relative flex h-14 w-14 shrink-0 cursor-zoom-in items-center justify-center overflow-hidden rounded-lg border bg-slate-50" data-post-finishing-action="full-flow-zoom-image" data-image-url="${escapeHtml(sku.imageUrl)}" data-image-label="${escapeHtml(label)}"><img src="${escapeHtml(sku.imageUrl)}" alt="${escapeHtml(`${sku.spuName} ${sku.colorName} ${sku.sizeName}`)}" class="h-full w-full object-cover" onload="this.nextElementSibling.hidden=true" onerror="this.hidden=true;this.nextElementSibling.textContent='图片加载失败';this.nextElementSibling.hidden=false"/><span class="px-1 text-center text-[10px] text-slate-500">图片加载中…</span></button>`
}

function renderReferences(task: PostFinishingQcTask): string {
  const references = getPostFinishingQcTaskReferences(task.qcTaskId)
  const cards = references.map((record) => `<article class="rounded-lg border p-3"><div class="text-sm font-semibold">${escapeHtml(record.title)} · v${record.version}</div><div class="mt-1 text-xs text-muted-foreground">${escapeHtml(record.referenceType)} / ${escapeHtml(record.source)} / 实际上传人 ${escapeHtml(record.uploaderName)}</div>${record.sourceNote ? `<div class="mt-1 text-xs text-muted-foreground">资料实际来源：${escapeHtml(record.sourceNote)}</div>` : ''}<p class="mt-2 text-xs">${escapeHtml(record.description)}</p>${record.imageUrl ? `<button type="button" class="relative mt-2 flex h-24 w-full items-center justify-center overflow-hidden rounded-lg border bg-slate-50" data-post-finishing-action="full-flow-zoom-image" data-image-url="${escapeHtml(record.imageUrl)}" data-image-label="${escapeHtml(record.title)}"><img src="${escapeHtml(record.imageUrl)}" alt="${escapeHtml(record.title)}" class="h-full w-full object-cover" onload="this.nextElementSibling.hidden=true" onerror="this.hidden=true;this.nextElementSibling.textContent='图片加载失败';this.nextElementSibling.hidden=false"/><span class="text-xs text-slate-500">图片加载中…</span></button>` : '<div class="mt-2 rounded border border-dashed p-3 text-xs text-muted-foreground">该资料无图片，仅使用文字判断说明。</div>'}</article>`).join('')
  const canUpload = task.status !== '质检完成' && task.claimedBy?.actorId === getCurrentPostFinishingActor().actorId
  return `<section class="rounded-xl border bg-card p-4"><div class="flex items-center justify-between gap-3"><div><h3 class="font-semibold">本次质检参考资料</h3><p class="mt-1 text-xs text-muted-foreground">独立于技术包，绑定本次任务；后续上传不会覆盖既有版本。</p></div><span class="text-xs text-muted-foreground">${references.length} 份</span></div><div class="mt-3 grid gap-3 md:grid-cols-2">${cards || '<div class="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground md:col-span-2">本次未上传色差参考图或尺寸判断标准；系统明确显示未上传，不伪造默认资料，也不阻断质检。</div>'}</div>${canUpload ? `<div class="mt-4 grid gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3 md:grid-cols-2" data-qc-task-reference-form><label class="text-xs text-blue-900">资料类型<select class="mt-1 h-10 w-full rounded-md border bg-white px-3" data-qc-task-reference-type><option>色差参考图</option><option>尺寸判断标准</option></select></label><label class="text-xs text-blue-900">资料名称<input class="mt-1 h-10 w-full rounded-md border bg-white px-3" data-qc-task-reference-title placeholder="填写本批判断资料名称" /></label><label class="text-xs text-blue-900 md:col-span-2">飞书实际来源<input class="mt-1 h-10 w-full rounded-md border bg-white px-3" data-qc-task-reference-source-note placeholder="例如：陈买手通过飞书提供" /></label><label class="text-xs text-blue-900 md:col-span-2">判断说明<textarea class="mt-1 min-h-20 w-full rounded-md border bg-white px-3 py-2" data-qc-task-reference-description></textarea></label><label class="text-xs text-blue-900">选择本批参考图片<input type="file" accept="image/*" class="mt-1 block w-full rounded-md border bg-white p-2" data-qc-task-reference-file /></label><label class="text-xs text-blue-900">或填写原型图片地址<input class="mt-1 h-10 w-full rounded-md border bg-white px-3" data-qc-task-reference-image placeholder="/materials/..." /></label><button type="button" class="h-10 rounded-md bg-blue-600 font-semibold text-white md:col-span-2" data-post-finishing-action="full-flow-upload-qc-reference" data-task-id="${escapeHtml(task.qcTaskId)}">QC 代上传并绑定本次任务</button></div>` : ''}</section>`
}

function renderResultLine(task: PostFinishingQcTask, index: number, canEdit: boolean): string {
  const line = task.lines[index]
  const prior = task.results?.find((item) => item.sku.skuId === line.sku.skuId)
  const disabled = canEdit ? '' : 'disabled'
  return `<article class="rounded-xl border p-3" data-qc-result-line="${escapeHtml(line.sku.skuId)}" data-expected-qty="${line.expectedQty}">
    <div class="flex gap-3">${imageButton(task, index)}<div class="min-w-0 flex-1"><div class="font-semibold">${escapeHtml(line.sku.skuCode)}</div><div class="text-xs text-muted-foreground">${escapeHtml(line.sku.spuCode)} · ${escapeHtml(line.sku.colorName)} / ${escapeHtml(line.sku.sizeName)} · 送检 ${line.expectedQty} 件</div></div></div>
    <div class="mt-3 grid grid-cols-3 gap-2"><label class="text-xs text-muted-foreground">合格<input type="number" min="0" step="1" value="${prior?.passedQty ?? line.expectedQty}" class="mt-1 h-10 w-full rounded-md border px-2 text-right" data-qc-result-field="passedQty" ${disabled}/></label><label class="text-xs text-muted-foreground">瑕疵<input type="number" min="0" step="1" value="${prior?.defectQty ?? 0}" class="mt-1 h-10 w-full rounded-md border px-2 text-right" data-qc-result-field="defectQty" ${disabled}/></label><label class="text-xs text-muted-foreground">返厂<input type="number" min="0" step="1" value="${prior?.returnQty ?? 0}" class="mt-1 h-10 w-full rounded-md border px-2 text-right" data-qc-result-field="returnQty" ${disabled}/></label></div>
    <div class="mt-2 grid gap-2 md:grid-cols-2"><input value="${escapeHtml(prior?.defectReason || '')}" list="post-finishing-defect-reasons" placeholder="有瑕疵时填写瑕疵原因" class="h-9 rounded-md border px-3 text-xs" data-qc-result-field="defectReason" ${disabled}/><input value="${escapeHtml(prior?.responsibleParty || '')}" placeholder="瑕疵责任方" class="h-9 rounded-md border px-3 text-xs" data-qc-result-field="responsibleParty" ${disabled}/><label class="rounded-md border bg-slate-50 p-2 text-[11px] text-muted-foreground">上传瑕疵证据图片<input type="file" accept="image/*" class="mt-1 block w-full text-[11px]" data-qc-result-file="defectImage" ${disabled}/></label><input value="${escapeHtml(prior?.defectImageUrl || '')}" placeholder="或填写瑕疵证据图片地址" class="h-9 self-center rounded-md border px-3 text-xs" data-qc-result-field="defectImageUrl" ${disabled}/><input value="${escapeHtml(prior?.returnReason || '')}" placeholder="有返厂时填写返厂原因" class="h-9 rounded-md border px-3 text-xs" data-qc-result-field="returnReason" ${disabled}/><input value="${escapeHtml(prior?.returnReceiver || '')}" placeholder="返厂接收责任方" class="h-9 rounded-md border px-3 text-xs" data-qc-result-field="returnReceiver" ${disabled}/></div>
  </article>`
}

function renderTask(task: PostFinishingQcTask): string {
  const actor = getCurrentPostFinishingActor()
  const delivery = getPostFinishingFactoryReturn(task.deliveryId)
  const isOwner = task.claimedBy?.actorId === actor.actorId
  const canEdit = Boolean(isOwner && task.status !== '质检完成')
  const expectedTotal = task.lines.reduce((sum, line) => sum + line.expectedQty, 0)
  const actualTotal = task.results?.reduce((sum, line) => sum + line.passedQty + line.defectQty + line.returnQty, 0) ?? expectedTotal
  const differentSkuCount = task.results?.filter((result) => result.expectedQty !== result.passedQty + result.defectQty + result.returnQty).length ?? 0
  const releaseControl = canEdit
    ? releaseConfirmTaskId === task.qcTaskId
      ? `<div class="w-full rounded-lg border border-amber-300 bg-amber-50 p-3" data-qc-release-confirm><div class="text-sm font-semibold text-amber-900">确认退领并放弃当前未提交内容？</div><label class="mt-2 block text-xs text-amber-900">退领原因（可填写）<input class="mt-1 h-9 w-full rounded-md border bg-white px-3" value="错误领取" data-qc-release-reason /></label><div class="mt-2 flex gap-2"><button type="button" class="rounded-md bg-amber-600 px-4 py-2 text-sm text-white" data-post-finishing-action="full-flow-release-qc" data-task-id="${escapeHtml(task.qcTaskId)}">确认退领</button><button type="button" class="rounded-md border bg-white px-4 py-2 text-sm" data-post-finishing-action="full-flow-release-qc-cancel">取消</button></div></div>`
      : `<button type="button" class="rounded-md border border-amber-300 px-4 py-2 text-sm text-amber-800" data-post-finishing-action="full-flow-release-qc-prompt" data-task-id="${escapeHtml(task.qcTaskId)}">错误领取，退回待质检</button>`
    : ''
  return `<div class="space-y-4" data-qc-workbench-task="${escapeHtml(task.qcTaskId)}" data-skip-page-rerender="true">
    <section class="rounded-xl border bg-card p-4"><div class="flex flex-wrap items-start justify-between gap-4"><div><button type="button" data-post-finishing-action="full-flow-qc-clear" class="text-sm text-blue-700 hover:underline">← 输入其他任务</button><h2 class="mt-2 text-xl font-semibold">${escapeHtml(task.qcTaskNo)}</h2><p class="mt-1 text-sm text-muted-foreground">${escapeHtml(task.deliveryOrderNo)} · ${escapeHtml(task.productionOrderNo)} · 第 ${task.returnIndex} 次送货</p><p class="mt-1 text-xs text-muted-foreground">送货登记：${escapeHtml(delivery ? new Date(delivery.registeredAt).toLocaleString('zh-CN') : '—')} · 送检：${escapeHtml(new Date(task.sentAt).toLocaleString('zh-CN'))}</p></div><div class="text-right">${renderPostStatusBadge(task.status)}<div class="mt-2 text-xs text-muted-foreground">${task.claimedBy ? `质检员：${escapeHtml(task.claimedBy.actorName)}<br/>领取：${escapeHtml(new Date(task.claimedAt || '').toLocaleString('zh-CN'))}` : '尚未领取'}</div></div></div>
      ${task.claimedBy && !isOwner && task.status !== '质检完成' ? `<div class="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">已由 ${escapeHtml(task.claimedBy.actorName)} 质检中。当前账号不能录入或提交。</div>` : ''}
      <div class="mt-4 flex flex-wrap gap-2">${!task.claimedBy && task.status !== '质检完成' ? `<button type="button" class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white" data-post-finishing-action="full-flow-claim-qc" data-task-no="${escapeHtml(task.qcTaskNo)}">领取任务</button>` : ''}${releaseControl}${task.status === '质检完成' ? `<a data-nav="${task.postTaskNo ? `/fcs/craft/post-finishing/work-orders?keyword=${encodeURIComponent(task.postTaskNo)}` : `/fcs/craft/post-finishing/recheck-orders?keyword=${encodeURIComponent(task.recheckOrderNo || '')}`}" class="rounded-md border px-4 py-2 text-sm">查看下游单据</a>` : ''}</div>
    </section>
    ${renderReferences(task)}
    <section class="rounded-xl border bg-card p-4"><div><h3 class="font-semibold">逐 SKU 质检结果</h3><p class="mt-1 text-xs text-muted-foreground">合格 + 瑕疵 + 返厂应等于送检数；回货后任一逐 SKU 数量差异都必须授权。</p></div><div class="mt-3 rounded-lg px-3 py-2 text-sm ${differentSkuCount ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-800'}" data-qc-live-summary>送检 ${expectedTotal} 件 · 当前分类合计 ${actualTotal} 件 · 整单差异 ${actualTotal - expectedTotal} 件 · ${differentSkuCount} 个 SKU 有差异</div><div class="mt-4 space-y-3">${task.lines.map((_, index) => renderResultLine(task, index, canEdit)).join('')}</div>
      ${canEdit ? `<div class="mt-4 space-y-3 rounded-xl border bg-slate-50 p-3"><label class="block text-sm">下游处理<select class="mt-1 h-10 w-full rounded-md border bg-white px-3" data-qc-need-post><option value="yes">需要后道加工</option><option value="no">不需要后道，直接复检</option></select></label><div class="${differentSkuCount ? '' : 'hidden '}grid gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 md:grid-cols-2" data-qc-difference-authorization><div class="text-sm font-semibold text-amber-900 md:col-span-2">当前存在逐 SKU 数量差异，提交前必须录入授权码。</div><label class="text-sm">差异原因<input class="mt-1 h-10 w-full rounded-md border bg-white px-3" data-qc-difference-reason /></label><label class="text-sm md:col-span-2">录入或粘贴 30 秒动态授权码<textarea class="mt-1 min-h-20 w-full rounded-md border bg-white px-3 py-2 font-mono text-xs" data-qc-authorization></textarea></label></div><button type="button" class="h-11 w-full rounded-md bg-blue-600 font-semibold text-white" data-post-finishing-action="full-flow-complete-qc" data-task-id="${escapeHtml(task.qcTaskId)}">完成质检并生成下一环节</button></div>` : ''}
    </section>
    <datalist id="post-finishing-defect-reasons">${POST_FINISHING_DEFECT_REASON_OPTIONS.map((reason) => `<option value="${escapeHtml(reason)}"></option>`).join('')}</datalist>
  </div>`
}

export function renderPostFinishingQcWorkbenchPage(): string {
  const taskNo = query().get('taskNo') || ''
  const task = taskNo ? getPostFinishingFullFlowQcTask(taskNo) : undefined
  return `<div class="space-y-4 p-4" data-testid="post-finishing-qc-workbench-page">${renderPostFinishingPageHeader('质检任务执行', '输入完整任务号领取 · 一任务一质检员 · 支持退领')}${renderNotice()}${task ? renderTask(task) : renderScanner()}</div>`
}

function readValue(root: ParentNode, selector: string): string {
  return root.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(selector)?.value.trim() || ''
}

function selectedFileUrl(root: ParentNode, selector: string): string | undefined {
  const file = root.querySelector<HTMLInputElement>(selector)?.files?.[0]
  return file ? URL.createObjectURL(file) : undefined
}

function collectResults(root: HTMLElement, includeFiles = false) {
  return Array.from(root.querySelectorAll<HTMLElement>('[data-qc-result-line]')).map((line) => ({
    skuId: line.dataset.qcResultLine || '',
    passedQty: Number(readValue(line, '[data-qc-result-field="passedQty"]') || 0),
    defectQty: Number(readValue(line, '[data-qc-result-field="defectQty"]') || 0),
    returnQty: Number(readValue(line, '[data-qc-result-field="returnQty"]') || 0),
    defectReason: readValue(line, '[data-qc-result-field="defectReason"]'),
    responsibleParty: readValue(line, '[data-qc-result-field="responsibleParty"]'),
    defectImageUrl: (includeFiles ? selectedFileUrl(line, '[data-qc-result-file="defectImage"]') : undefined)
      || readValue(line, '[data-qc-result-field="defectImageUrl"]')
      || undefined,
    returnReason: readValue(line, '[data-qc-result-field="returnReason"]'),
    returnReceiver: readValue(line, '[data-qc-result-field="returnReceiver"]'),
  }))
}

function updateLiveSummary(root: HTMLElement): void {
  const lines = Array.from(root.querySelectorAll<HTMLElement>('[data-qc-result-line]'))
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
  if (formRoot && event?.type === 'input' && target.closest('[data-qc-result-field]')) {
    updateLiveSummary(formRoot)
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
    'full-flow-upload-qc-reference',
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
    if (action === 'full-flow-upload-qc-reference') {
      const root = document.querySelector<HTMLElement>('[data-qc-task-reference-form]')
      if (!root) throw new Error('未找到质检参考资料上传表单。')
      const reference = uploadPostFinishingQcTaskReference({
        qcTaskId: actionNode?.dataset.taskId || '',
        referenceType: readValue(root, '[data-qc-task-reference-type]') as '色差参考图' | '尺寸判断标准',
        title: readValue(root, '[data-qc-task-reference-title]'),
        description: readValue(root, '[data-qc-task-reference-description]'),
        imageUrl: selectedFileUrl(root, '[data-qc-task-reference-file]')
          || readValue(root, '[data-qc-task-reference-image]')
          || undefined,
        sourceNote: readValue(root, '[data-qc-task-reference-source-note]'),
        actor: getCurrentPostFinishingActor(),
      })
      notice = `已代上传并绑定：${reference.title} v${reference.version}`
      noticeTone = 'success'
      navigate(query().get('taskNo') || '')
      return true
    }
    const root = document.querySelector<HTMLElement>('[data-qc-workbench-task]')
    if (!root) throw new Error('未找到质检任务表单。')
    const lineNodes = Array.from(root.querySelectorAll<HTMLElement>('[data-qc-result-line]'))
    const results = collectResults(root, true)
    const hasDifference = lineNodes.some((line, index) => Number(line.dataset.expectedQty || 0) !== results[index].passedQty + results[index].defectQty + results[index].returnQty)
    const completed = completePostFinishingQcTask({
      qcTaskId: actionNode?.dataset.taskId || '',
      actor: getCurrentPostFinishingActor(),
      results,
      needPostFinishing: readValue(root, '[data-qc-need-post]') !== 'no',
      authorization: hasDifference
        ? { scanValue: readValue(root, '[data-qc-authorization]'), differenceReason: readValue(root, '[data-qc-difference-reason]') }
        : undefined,
    })
    notice = `质检完成，已生成${completed.postTaskNo ? `后道任务 ${completed.postTaskNo}` : `复检单 ${completed.recheckOrderNo}`}`
    noticeTone = 'success'
    navigate(completed.qcTaskNo)
  } catch (error) {
    notice = error instanceof Error ? error.message : '质检操作失败。'
    noticeTone = 'error'
    navigate(query().get('taskNo') || '')
  }
  return true
}
