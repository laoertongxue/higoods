import { escapeHtml } from '../utils.ts'
import { productionOrders } from '../data/fcs/production-orders.ts'
import {
  completeKolGotoWholeOrderTask,
  getKolGotoHandoutQty,
  listKolGotoHandoutRecords,
  listKolGotoPickupBatches,
  listKolGotoPickupLines,
  listKolGotoTasks,
  submitKolGotoHandout,
  submitKolGotoPickup,
} from '../data/fcs/kol-goto-pda-domain.ts'
import { renderPdaFrame } from './pda-shell.ts'
import { getPdaRuntimeContext } from './pda-runtime.ts'
import { isKolGotoFactory } from '../data/fcs/kol-goto-special-flow.ts'

type KolGotoOverlay = 'NONE' | 'PICKUP' | 'HANDOUT'

const state = {
  activeTaskId: '',
  overlay: 'NONE' as KolGotoOverlay,
  pickupQtyByBomId: {} as Record<string, string>,
  handoutQty: '',
  handoutRemark: '',
  pickupSubmissionId: '',
  handoutSubmissionId: '',
  imageUrl: '',
  imageAlt: '',
  feedback: '',
}

export function closeKolGotoPdaExecDialogsOnEscape(): boolean {
  if (state.imageUrl) {
    state.imageUrl = ''
    state.imageAlt = ''
    return true
  }
  if (state.overlay !== 'NONE') {
    state.overlay = 'NONE'
    return true
  }
  return false
}

function canAccessKolGotoExecution(): boolean {
  return isKolGotoFactory(getPdaRuntimeContext()?.factoryId)
}

function syncTaskState(taskId: string): void {
  if (state.activeTaskId === taskId) return
  state.activeTaskId = taskId
  state.overlay = 'NONE'
  state.pickupQtyByBomId = {}
  state.handoutQty = ''
  state.handoutRemark = ''
  state.pickupSubmissionId = ''
  state.handoutSubmissionId = ''
  state.imageUrl = ''
  state.imageAlt = ''
  state.feedback = ''
}

function nowTimestamp(date = new Date()): string {
  const offsetMs = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offsetMs).toISOString().replace('T', ' ').slice(0, 19)
}

let submissionSequence = 0

function nextClientSubmissionId(prefix: 'PICKUP' | 'HANDOUT'): string {
  submissionSequence += 1
  return `${prefix}-${Date.now()}-${submissionSequence}`
}

function getTask(taskId: string) {
  return listKolGotoTasks().find((task) => task.taskId === taskId) ?? null
}

function renderImage(url: string, alt: string, className: string): string {
  if (!url) {
    return `<div class="${className} flex items-center justify-center rounded-lg border border-dashed bg-muted text-center text-[11px] text-destructive">缺少对应实物图</div>`
  }
  return `<button type="button" class="${className} relative flex items-center justify-center overflow-hidden rounded-lg border bg-muted" data-kol-action="open-image" data-image-url="${escapeHtml(url)}" data-image-alt="${escapeHtml(alt)}"><img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" class="h-full w-full object-cover" onerror="this.hidden=true;this.nextElementSibling.hidden=false" /><span hidden class="px-1 text-center text-[10px] text-red-700">图片加载失败</span></button>`
}

function renderPickupOverlay(taskId: string): string {
  if (state.overlay !== 'PICKUP') return ''
  const lines = listKolGotoPickupLines(taskId)
  const renderLine = (line: (typeof lines)[number]) => `
    <article class="rounded-xl border p-3">
      <div class="flex gap-3">
        ${renderImage(line.materialImageUrl, `${line.materialName}（${line.materialCode}）实物图`, 'h-20 w-20 shrink-0')}
        <div class="min-w-0 flex-1 text-sm">
          <div class="flex items-center justify-between gap-2"><b class="truncate">${escapeHtml(line.materialName)}</b><span class="shrink-0 rounded bg-slate-100 px-2 py-0.5 text-[10px]">${escapeHtml(line.materialType)}</span></div>
          <div class="mt-1 font-mono text-xs text-muted-foreground">${escapeHtml(line.materialCode)}</div>
          <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(line.materialSpec || '规格待确认')}</div>
          <div class="mt-2 grid grid-cols-3 gap-1 text-center text-[11px]"><div class="rounded bg-muted p-1">应领<br><b>${line.plannedQty} ${escapeHtml(line.unit)}</b></div><div class="rounded bg-muted p-1">已领<br><b>${line.pickedQty} ${escapeHtml(line.unit)}</b></div><div class="rounded bg-blue-50 p-1 text-blue-700">剩余<br><b>${line.remainingQty} ${escapeHtml(line.unit)}</b></div></div>
        </div>
      </div>
      <label class="mt-3 block text-xs font-medium">本次领料数量（${escapeHtml(line.unit)}）<input type="number" min="0" max="${line.remainingQty}" step="0.01" class="mt-1 h-11 w-full rounded-xl border px-3 text-base" data-kol-field="pickup:${escapeHtml(line.bomItemId)}" value="${escapeHtml(state.pickupQtyByBomId[line.bomItemId] || '')}" /></label>
    </article>
  `
  const renderGroup = (materialType: '面料' | '辅料') => {
    const scopedLines = lines.filter((line) => line.materialType === materialType)
    return `
      <section class="space-y-2" data-kol-pickup-group="${materialType}">
        <div class="flex items-center justify-between"><h3 class="text-sm font-semibold">${materialType}清单</h3><span class="text-xs text-muted-foreground">${scopedLines.length} 项</span></div>
        ${scopedLines.length ? scopedLines.map(renderLine).join('') : `<div class="rounded-xl border border-dashed p-3 text-xs text-muted-foreground">冻结 BOM 无${materialType}项目。</div>`}
      </section>
    `
  }
  return `
    <div class="fixed inset-0 z-50 flex items-end bg-black/45" data-kol-overlay="pickup">
      <section class="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-background">
        <header class="sticky top-0 z-10 flex items-start justify-between gap-3 border-b bg-background px-4 py-3">
          <div><h2 class="font-semibold">加工领料</h2><p class="mt-1 text-xs text-muted-foreground">根据冻结 BOM 填写本次面料和辅料领料数量；提交后自动入库、自动出库。首次领料同时自动开工。</p></div>
          <button class="rounded-full border px-3 py-1 text-xs" data-kol-action="close-overlay">关闭</button>
        </header>
        <div class="space-y-3 p-4">
          ${renderGroup('面料')}
          ${renderGroup('辅料')}
          ${lines.length === 0 ? '<div class="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">冻结技术包没有面料或辅料 BOM，无法领料。</div>' : ''}
        </div>
        <footer class="sticky bottom-0 border-t bg-background p-4"><button class="h-12 w-full rounded-xl bg-primary text-sm font-semibold text-primary-foreground" data-kol-action="submit-pickup" data-task-id="${escapeHtml(taskId)}">确认加工领料</button></footer>
      </section>
    </div>
  `
}

function renderHandoutOverlay(taskId: string): string {
  if (state.overlay !== 'HANDOUT') return ''
  const task = getTask(taskId)
  if (!task) return ''
  const handedQty = getKolGotoHandoutQty(taskId)
  const remainingQty = Math.max(task.qty - handedQty, 0)
  return `
    <div class="fixed inset-0 z-50 flex items-end bg-black/45" data-kol-overlay="handout">
      <section class="w-full rounded-t-2xl bg-background">
        <header class="flex items-start justify-between gap-3 border-b px-4 py-3"><div><h2 class="font-semibold">发起交出</h2><p class="mt-1 text-xs text-muted-foreground">可多次交出；本次交出数量会直接累计为已加工数量。</p></div><button class="rounded-full border px-3 py-1 text-xs" data-kol-action="close-overlay">关闭</button></header>
        <div class="space-y-4 p-4">
          <div class="grid grid-cols-3 gap-2 text-center text-xs"><div class="rounded-xl bg-muted p-3">任务数量<br><b class="text-base">${task.qty}</b> 件</div><div class="rounded-xl bg-muted p-3">已交出<br><b class="text-base">${handedQty}</b> 件</div><div class="rounded-xl bg-blue-50 p-3 text-blue-700">剩余<br><b class="text-base">${remainingQty}</b> 件</div></div>
          <label class="block text-sm font-medium">本次交出数量（件）<input type="number" min="1" max="${remainingQty}" step="1" class="mt-1 h-12 w-full rounded-xl border px-3 text-lg" data-kol-field="handoutQty" value="${escapeHtml(state.handoutQty)}" /></label>
          <label class="block text-sm font-medium">备注（选填）<textarea class="mt-1 min-h-20 w-full rounded-xl border px-3 py-2" data-kol-field="handoutRemark">${escapeHtml(state.handoutRemark)}</textarea></label>
        </div>
        <footer class="border-t p-4"><button class="h-12 w-full rounded-xl bg-primary text-sm font-semibold text-primary-foreground" data-kol-action="submit-handout" data-task-id="${escapeHtml(taskId)}">确认发起交出</button></footer>
      </section>
    </div>
  `
}

function renderImagePreview(): string {
  if (!state.imageUrl) return ''
  return `<div class="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 p-4" data-kol-action="close-image"><button class="absolute right-4 top-4 rounded-full bg-white px-3 py-2 text-sm" data-kol-action="close-image">关闭</button><img src="${escapeHtml(state.imageUrl)}" alt="${escapeHtml(state.imageAlt)}" class="max-h-[85vh] max-w-full rounded-xl object-contain" onerror="this.hidden=true;this.nextElementSibling.hidden=false" /><div hidden class="rounded-xl bg-white p-8 text-sm text-red-700">图片加载失败，请核对原图素材。</div></div>`
}

function renderKolGotoPdaExecContent(taskId: string): string {
  const task = getTask(taskId)
  if (!task) return '<div class="p-6 text-sm text-destructive">KOL 整单任务不存在或不属于 KOL-GOTO。</div>'
  const order = productionOrders.find((item) => item.productionOrderId === task.productionOrderId)
  const styleImage = order?.techPackSnapshot?.imageSnapshot.styleImages[0]
    || order?.techPackSnapshot?.imageSnapshot.productImages[0]
    || order?.techPackSnapshot?.imageSnapshot.sampleImages[0]
    || ''
  const pickupBatches = listKolGotoPickupBatches(taskId)
  const handoutRecords = listKolGotoHandoutRecords(taskId)
  const handedQty = getKolGotoHandoutQty(taskId)
  const remainingQty = Math.max(task.qty - handedQty, 0)
  const canHandout = task.status === 'IN_PROGRESS' && remainingQty > 0
  const canComplete = task.status !== 'DONE' && handedQty === task.qty
  const content = `
    <div class="min-h-[760px] bg-background pb-28" data-kol-exec-root data-task-id="${escapeHtml(taskId)}" data-skip-page-rerender="true">
      <header class="border-b bg-background px-4 py-3"><button class="text-sm text-muted-foreground" data-kol-action="back">← 返回执行</button><div class="mt-3 flex gap-3">${renderImage(styleImage, `${order?.techPackSnapshot?.styleName || order?.demandSnapshot.spuName || 'KOL样衣'}款式图`, 'h-24 w-24 shrink-0')}<div class="min-w-0 flex-1"><h1 class="text-base font-semibold">KOL 整单任务</h1><div class="mt-1 font-mono text-xs text-muted-foreground">${escapeHtml(task.taskNo || task.taskId)}</div><div class="mt-2 text-sm">${escapeHtml(order?.techPackSnapshot?.styleName || order?.demandSnapshot.spuName || '-')}</div><div class="mt-1 text-xs text-muted-foreground">${escapeHtml(task.saleTypeSnapshot || '-')} · ${task.qty} 件</div><span class="mt-2 inline-flex rounded-full ${task.status === 'DONE' ? 'bg-green-50 text-green-700' : task.status === 'IN_PROGRESS' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'} px-2 py-1 text-[11px]">${task.status === 'DONE' ? '已完成' : task.status === 'IN_PROGRESS' ? '加工中' : '未开工'}</span></div></div></header>
      <main class="space-y-4 p-4">
        ${state.feedback ? `<div class="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">${escapeHtml(state.feedback)}</div>` : ''}
        <section class="grid grid-cols-3 gap-2 text-center text-xs"><div class="rounded-xl border p-3"><b class="text-lg">${pickupBatches.length}</b><div class="text-muted-foreground">领料次数</div></div><div class="rounded-xl border p-3"><b class="text-lg">${handedQty}</b><div class="text-muted-foreground">已加工 / 已交出</div></div><div class="rounded-xl border p-3"><b class="text-lg">${remainingQty}</b><div class="text-muted-foreground">剩余件数</div></div></section>
        <section class="rounded-xl border p-4"><h2 class="font-semibold">操作说明</h2><p class="mt-2 text-sm leading-6 text-muted-foreground">只做加工领料、发起交出和完成。加工领料与发起交出都可多次；第一次领料自动开工。</p></section>
        <section class="rounded-xl border p-4"><div class="flex items-center justify-between"><h2 class="font-semibold">加工领料记录</h2><span class="text-xs text-muted-foreground">${pickupBatches.length} 次</span></div>${pickupBatches.length ? `<div class="mt-3 space-y-2">${pickupBatches.map((batch) => `<div class="rounded-lg bg-muted/50 p-3 text-xs"><div class="font-medium">${escapeHtml(batch.pickupBatchId)} · ${escapeHtml(batch.pickedAt)}</div><div class="mt-1 text-muted-foreground">${batch.lines.map((line) => `${escapeHtml(line.materialName)} ${line.qty} ${escapeHtml(line.unit)}`).join('；')}</div><div class="mt-1 text-green-700">已自动写入 ${batch.inboundRecordIds.length} 条入库 + ${batch.outboundRecordIds.length} 条出库</div></div>`).join('')}</div>` : '<p class="mt-3 text-sm text-muted-foreground">尚未加工领料。</p>'}</section>
        <section class="rounded-xl border p-4"><div class="flex items-center justify-between"><h2 class="font-semibold">交出记录</h2><span class="text-xs text-muted-foreground">${handoutRecords.length} 次</span></div>${handoutRecords.length ? `<div class="mt-3 space-y-2">${handoutRecords.map((record) => `<div class="rounded-lg bg-muted/50 p-3 text-xs"><div class="font-medium">第 ${record.sequenceNo} 次 · ${record.submittedQty} ${escapeHtml(record.qtyUnit || '件')}</div><div class="mt-1 text-muted-foreground">${escapeHtml(record.factorySubmittedAt)} · ${escapeHtml(record.factorySubmittedBy || '-')}</div><div class="mt-1 text-blue-700">交出数量已自动计入加工完成数量</div></div>`).join('')}</div>` : '<p class="mt-3 text-sm text-muted-foreground">尚未发起交出；第一次交出时系统才创建交出单。</p>'}</section>
        <section class="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800"><div class="font-semibold">固定总价</div><div class="mt-1 text-lg font-bold">${Number(task.fixedTotalPrice || 0).toLocaleString()} ${escapeHtml(task.fixedTotalPriceCurrency || 'IDR')} / ${escapeHtml(task.fixedTotalPriceUnit || '整单')}</div><p class="mt-1 text-xs">价格在任务生成时冻结；现场只负责执行，不操作结算。</p></section>
      </main>
      <footer class="absolute inset-x-0 bottom-[72px] z-20 grid grid-cols-3 gap-2 border-t bg-background p-3">
        <button class="min-h-12 rounded-xl border px-2 text-xs font-semibold" data-kol-action="open-pickup" ${task.status === 'DONE' ? 'disabled' : ''}>去加工领料</button>
        <button class="min-h-12 rounded-xl border px-2 text-xs font-semibold ${canHandout ? 'border-blue-300 text-blue-700' : 'opacity-40'}" data-kol-action="open-handout" ${canHandout ? '' : 'disabled'}>发起交出</button>
        <button class="min-h-12 rounded-xl bg-primary px-2 text-xs font-semibold text-primary-foreground ${canComplete ? '' : task.status === 'DONE' ? 'bg-green-600' : 'opacity-40'}" data-kol-action="complete" data-task-id="${escapeHtml(taskId)}" ${canComplete ? '' : 'disabled'}>${task.status === 'DONE' ? '已完成' : '完成'}</button>
      </footer>
      ${renderPickupOverlay(taskId)}${renderHandoutOverlay(taskId)}${renderImagePreview()}
    </div>
  `
  return content
}

export function renderKolGotoPdaExecPage(taskId: string): string {
  if (!canAccessKolGotoExecution()) {
    return renderPdaFrame('<div class="p-6 text-sm text-amber-700">该整单任务只允许 KOL-GOTO 工厂账号执行。</div>', 'exec', { disableTodoAutoOpen: true })
  }
  syncTaskState(taskId)
  return renderPdaFrame(renderKolGotoPdaExecContent(taskId), 'exec', { disableTodoAutoOpen: true })
}

function refresh(taskId: string): void {
  const root = document.querySelector<HTMLElement>('[data-kol-exec-root]')
  if (root) root.outerHTML = renderKolGotoPdaExecContent(taskId)
}

export function handleKolGotoPdaExecEvent(target: HTMLElement): boolean {
  const field = target.closest<HTMLInputElement | HTMLTextAreaElement>('[data-kol-field]')
  const root = target.closest<HTMLElement>('[data-kol-exec-root]') || document.querySelector<HTMLElement>('[data-kol-exec-root]')
  const taskId = root?.dataset.taskId || ''
  if (taskId && !canAccessKolGotoExecution()) return true
  if (field) {
    const key = field.dataset.kolField || ''
    if (key.startsWith('pickup:')) state.pickupQtyByBomId[key.slice('pickup:'.length)] = field.value
    if (key === 'handoutQty') state.handoutQty = field.value
    if (key === 'handoutRemark') state.handoutRemark = field.value
    return true
  }
  const actionNode = target.closest<HTMLElement>('[data-kol-action]')
  if (!actionNode || !taskId) return false
  const action = actionNode.dataset.kolAction
  const actorName = getPdaRuntimeContext()?.userName || 'KOL-GOTO PDA 操作员'
  if (action === 'back') {
    window.history.back()
    return true
  }
  if (action === 'open-pickup') {
    state.overlay = 'PICKUP'
    state.pickupSubmissionId = nextClientSubmissionId('PICKUP')
  }
  if (action === 'open-handout') {
    state.overlay = 'HANDOUT'
    state.handoutSubmissionId = nextClientSubmissionId('HANDOUT')
  }
  if (action === 'close-overlay') state.overlay = 'NONE'
  if (action === 'open-image') {
    state.imageUrl = actionNode.dataset.imageUrl || ''
    state.imageAlt = actionNode.dataset.imageAlt || ''
  }
  if (action === 'close-image') {
    state.imageUrl = ''
    state.imageAlt = ''
  }
  try {
    if (action === 'submit-pickup') {
      submitKolGotoPickup({
        taskId,
        quantities: Object.fromEntries(Object.entries(state.pickupQtyByBomId).map(([key, value]) => [key, Number(value || 0)])),
        pickedAt: nowTimestamp(),
        pickedBy: actorName,
        clientSubmissionId: state.pickupSubmissionId,
      })
      state.overlay = 'NONE'
      state.pickupQtyByBomId = {}
      state.pickupSubmissionId = ''
      state.feedback = '加工领料成功：已自动入库、自动出库；首次领料已自动开工。'
    }
    if (action === 'submit-handout') {
      submitKolGotoHandout({
        taskId,
        qty: Number(state.handoutQty),
        submittedAt: nowTimestamp(),
        submittedBy: actorName,
        remark: state.handoutRemark,
        clientSubmissionId: state.handoutSubmissionId,
      })
      state.overlay = 'NONE'
      state.handoutQty = ''
      state.handoutRemark = ''
      state.handoutSubmissionId = ''
      state.feedback = '交出成功：本次数量已直接计入已加工数量。'
    }
    if (action === 'complete') {
      if (!window.confirm('完成后不能继续加工领料或发起交出，确认完成这张 KOL 整单任务？')) return true
      completeKolGotoWholeOrderTask({ taskId, completedAt: nowTimestamp(), completedBy: actorName })
      state.feedback = 'KOL 整单任务已完成。'
    }
  } catch (error) {
    state.feedback = error instanceof Error ? error.message : '操作失败'
  }
  refresh(taskId)
  return true
}
