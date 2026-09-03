import {
  getPostFinishingReturnSourceScanValue,
  listPostFinishingFactoryReturns,
  registerPostFinishingFactoryReturn,
  resolvePostFinishingReturnRegistrationSource,
  type PostFinishingAcceptanceProductionOrder,
} from '../data/fcs/post-finishing-full-flow.ts'
import { appStore } from '../state/store.ts'
import { escapeHtml } from '../utils.ts'
import { getPdaRuntimeContext, renderPdaLoginRedirect } from './pda-runtime.ts'
import { clearPdaSewingSelfReturnMode } from '../data/fcs/pda-sewing-self-return-mode.ts'

interface SewingReturnPageState {
  scanValue: string
  resolvedOrder?: PostFinishingAcceptanceProductionOrder
  returnIndex?: number
  quantities: Record<string, string>
  deliveryPersonName: string
  deliveryPersonPhone: string
  evidenceImages: Array<{ name: string; previewUrl: string }>
  errorText: string
  successText: string
}

const state: SewingReturnPageState = {
  scanValue: '',
  quantities: {},
  deliveryPersonName: '',
  deliveryPersonPhone: '',
  evidenceImages: [],
  errorText: '',
  successText: '',
}

function refreshPage(): void {
  appStore.navigate(`/fcs/pda/handover/sewing-self-return?refresh=${Date.now()}`)
}

function renderNotice(text: string, tone: 'error' | 'success'): string {
  if (!text) return ''
  const toneClass = tone === 'error'
    ? 'border-red-200 bg-red-50 text-red-700'
    : 'border-emerald-200 bg-emerald-50 text-emerald-700'
  return `<div class="rounded-xl border px-3 py-2 text-sm ${toneClass}" role="status">${escapeHtml(text)}</div>`
}

function renderScanSection(): string {
  if (!state.resolvedOrder || !state.returnIndex) {
    return `<section class="rounded-2xl border bg-white p-4 shadow-sm">
      <div class="flex items-start gap-3">
        <div class="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-700"><i data-lucide="scan-line" class="h-5 w-5"></i></div>
        <div><h2 class="text-base font-semibold">扫描本次回货来源码</h2><p class="mt-1 text-xs text-slate-500">必须扫描完整生产单回货码；不展示待办列表。</p></div>
      </div>
      <div class="mt-4 flex gap-2">
        <input class="h-11 min-w-0 flex-1 rounded-xl border px-3 text-sm" value="${escapeHtml(state.scanValue)}" placeholder="PFRETURN:生产单号:回货序号" data-pda-sewing-self-return-field="scanValue" data-pda-scan-enter="true" data-skip-page-rerender="true" />
        <button type="button" class="h-11 shrink-0 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white" data-pda-sewing-self-return-action="scan">识别</button>
      </div>
      <button type="button" class="mt-3 text-xs text-blue-700 underline" data-pda-sewing-self-return-action="load-demo">加载验收示例码</button>
    </section>`
  }
  return `<section class="rounded-2xl border border-blue-200 bg-blue-50 p-4">
    <div class="flex items-start justify-between gap-3">
      <div><div class="text-xs text-blue-700">已识别本次回货</div><h2 class="mt-1 font-semibold text-blue-950">${escapeHtml(state.resolvedOrder.productionOrderNo)} · 第 ${state.returnIndex} 次回货</h2><p class="mt-1 text-xs text-blue-800">${escapeHtml(state.resolvedOrder.styleName)} / ${escapeHtml(state.resolvedOrder.sewingFactoryName)}</p><p class="mt-1 text-xs text-blue-800">车缝任务 ${escapeHtml(state.resolvedOrder.sewingTaskNo)} · 暂存 ${escapeHtml(state.resolvedOrder.defaultStagingLocation)}</p></div>
      <button type="button" class="rounded-full border border-blue-300 bg-white px-3 py-1 text-xs text-blue-800" data-pda-sewing-self-return-action="reset">重新扫码</button>
    </div>
  </section>`
}

function renderSkuCards(): string {
  if (!state.resolvedOrder) return ''
  return `<section class="space-y-3" data-testid="return-sku-list">
    <div><h2 class="text-base font-semibold">登记 5 个 SKU 回货数量</h2><p class="mt-1 text-xs text-slate-500">每个 SKU 都必须大于 0 件，不能用其他 SKU 的数量抵消。</p></div>
    <div role="alert" data-return-quantity-error class="${state.errorText ? '' : 'hidden '}rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">${escapeHtml(state.errorText)}</div>
    ${state.resolvedOrder.skus.map((sku) => `<article class="rounded-2xl border bg-white p-3 shadow-sm" data-return-sku-card="${escapeHtml(sku.skuId)}">
      <div class="flex gap-3">
        <button type="button" class="relative flex h-16 w-16 shrink-0 cursor-zoom-in items-center justify-center overflow-hidden rounded-xl border bg-slate-50" data-pda-sewing-self-return-action="zoom-image" data-image-url="${escapeHtml(sku.imageUrl)}" data-image-label="${escapeHtml(`${sku.skuCode} ${sku.colorName} ${sku.sizeName}`)}"><img src="${escapeHtml(sku.imageUrl)}" alt="${escapeHtml(`${sku.spuName} ${sku.colorName} ${sku.sizeName}`)}" class="h-full w-full object-cover" onload="this.nextElementSibling.hidden=true" onerror="this.hidden=true;this.nextElementSibling.textContent='图片加载失败';this.nextElementSibling.hidden=false" /><span class="px-1 text-center text-[10px] text-slate-500">图片加载中…</span></button>
        <div class="min-w-0 flex-1"><div class="truncate text-sm font-semibold">${escapeHtml(sku.skuCode)}</div><div class="mt-1 text-xs text-slate-500">${escapeHtml(sku.colorName)} / ${escapeHtml(sku.sizeName)}</div><div class="mt-1 text-[11px] text-slate-500">生产计划 ${sku.plannedQty} 件</div><div class="mt-1 truncate text-[11px] text-slate-400">${escapeHtml(sku.barcode)}</div></div>
        <label class="w-28 text-xs font-medium text-slate-600">本次登记<input type="number" min="1" step="1" inputmode="numeric" value="${escapeHtml(state.quantities[sku.skuId] || '')}" class="mt-1 h-11 w-full rounded-xl border px-3 text-right text-base font-semibold" data-pda-sewing-self-return-field="quantity" data-sku-id="${escapeHtml(sku.skuId)}" data-skip-page-rerender="true" aria-invalid="${state.quantities[sku.skuId] !== '' && Number(state.quantities[sku.skuId]) === 0 ? 'true' : 'false'}" placeholder="件" /></label>
      </div>
    </article>`).join('')}
  </section>`
}

function renderEvidence(): string {
  if (!state.resolvedOrder) return ''
  return `<section class="rounded-2xl border bg-white p-4 shadow-sm">
    <h2 class="text-base font-semibold">送货人与现场凭证</h2>
    <div class="mt-3 grid gap-3">
      <label class="text-xs text-slate-600">送货人姓名<input class="mt-1 h-11 w-full rounded-xl border px-3 text-sm" value="${escapeHtml(state.deliveryPersonName)}" data-pda-sewing-self-return-field="deliveryPersonName" data-skip-page-rerender="true" /></label>
      <label class="text-xs text-slate-600">联系方式<input class="mt-1 h-11 w-full rounded-xl border px-3 text-sm" value="${escapeHtml(state.deliveryPersonPhone)}" data-pda-sewing-self-return-field="deliveryPersonPhone" data-skip-page-rerender="true" /></label>
      <label class="text-xs text-slate-600">上传现场凭证图片<input type="file" accept="image/*" class="mt-1 block w-full rounded-xl border p-2 text-xs" data-pda-sewing-self-return-field="evidenceFile" /></label>
      <button type="button" class="h-10 rounded-xl border border-blue-200 bg-blue-50 text-sm font-medium text-blue-800" data-pda-sewing-self-return-action="load-evidence">加载原型验收凭证</button>
      <div class="grid grid-cols-3 gap-2">${state.evidenceImages.map((image) => `<button type="button" class="relative flex h-20 cursor-zoom-in items-center justify-center overflow-hidden rounded-xl border bg-slate-50" data-pda-sewing-self-return-action="zoom-image" data-image-url="${escapeHtml(image.previewUrl)}" data-image-label="${escapeHtml(image.name)}"><img src="${escapeHtml(image.previewUrl)}" alt="现场凭证 ${escapeHtml(image.name)}" class="h-full w-full object-cover" onload="this.nextElementSibling.hidden=true" onerror="this.hidden=true;this.nextElementSibling.textContent='图片加载失败';this.nextElementSibling.hidden=false" /><span class="px-1 text-center text-[10px] text-slate-500">图片加载中…</span></button>`).join('')}</div>
    </div>
  </section>`
}

function renderRecent(): string {
  const recent = listPostFinishingFactoryReturns().slice(-3).reverse()
  if (!recent.length) return ''
  return `<section class="rounded-2xl border bg-white p-4 shadow-sm"><h2 class="text-sm font-semibold">最近登记</h2><div class="mt-3 space-y-2">${recent.map((record) => `<div class="rounded-xl bg-slate-50 px-3 py-2 text-xs"><div class="font-mono font-semibold">${escapeHtml(record.deliveryOrderNo)}</div><div class="mt-1 text-slate-500">${escapeHtml(record.productionOrderNo)} · 第 ${record.returnIndex} 次 · ${record.lines.reduce((sum, line) => sum + line.registeredQty, 0)} 件 · ${escapeHtml(record.status)}</div></div>`).join('')}</div></section>`
}

export function renderPdaSewingSelfReturnPage(): string {
  const runtime = getPdaRuntimeContext()
  if (!runtime) return renderPdaLoginRedirect('后道公共 PDA 回货登记')
  return `<div class="min-h-screen bg-slate-100 pb-8" data-testid="pda-sewing-self-return-page">
    <header class="sticky top-0 z-20 border-b bg-white px-4 py-3 shadow-sm"><div class="mx-auto flex max-w-[480px] items-center justify-between gap-3"><div><div class="text-[11px] text-slate-500">后道公共 PDA</div><h1 class="text-base font-semibold">车缝现场交货登记模式</h1></div><div class="flex items-center gap-2"><span class="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">锁定中</span><button type="button" class="rounded-full border px-3 py-1 text-xs text-slate-600" data-pda-sewing-self-return-action="admin-exit">管理员退出</button></div></div></header>
    <main class="mx-auto max-w-[480px] space-y-4 p-4">
      ${renderNotice(state.errorText, 'error')}${renderNotice(state.successText, 'success')}
      ${renderScanSection()}${renderSkuCards()}${renderEvidence()}
      ${state.resolvedOrder ? `<button type="button" class="h-12 w-full rounded-2xl bg-blue-600 text-base font-semibold text-white shadow-sm" data-pda-sewing-self-return-action="submit">提交本次回货登记</button>` : ''}
      ${renderRecent()}
    </main>
  </div>`
}

function resolveCurrentScan(): void {
  const source = resolvePostFinishingReturnRegistrationSource(state.scanValue)
  state.resolvedOrder = source.productionOrder
  state.returnIndex = source.returnIndex
  state.quantities = Object.fromEntries(source.productionOrder.skus.map((sku) => [sku.skuId, '']))
  state.errorText = ''
  state.successText = ''
}

function showImage(url: string, label: string): void {
  const overlay = document.createElement('div')
  overlay.className = 'fixed inset-0 z-[200] flex items-center justify-center bg-black/75 p-4'
  overlay.setAttribute('role', 'dialog')
  overlay.setAttribute('aria-modal', 'true')
  overlay.innerHTML = `<button type="button" class="absolute right-4 top-4 rounded-full bg-white px-3 py-2 text-sm" aria-label="关闭大图">关闭</button><div class="flex min-h-40 min-w-64 items-center justify-center rounded-xl bg-white p-3"><img src="${escapeHtml(url)}" alt="${escapeHtml(label)}" class="max-h-[82vh] max-w-[86vw] rounded-xl object-contain" onload="this.nextElementSibling.hidden=true" onerror="this.hidden=true;this.nextElementSibling.textContent='图片加载失败，请核对原图后重试';this.nextElementSibling.hidden=false" /><span class="p-8 text-sm text-slate-500">图片加载中…</span></div>`
  const close = () => {
    overlay.remove()
    document.removeEventListener('keydown', onKeydown)
  }
  const onKeydown = (keydownEvent: KeyboardEvent) => { if (keydownEvent.key === 'Escape') close() }
  overlay.addEventListener('click', close)
  document.addEventListener('keydown', onKeydown)
  document.body.appendChild(overlay)
}

export function handlePdaSewingSelfReturnEvent(target: HTMLElement, event?: Event): boolean {
  const fieldNode = target.closest<HTMLInputElement>('[data-pda-sewing-self-return-field]')
  if (fieldNode) {
    const field = fieldNode.dataset.pdaSewingSelfReturnField
    if (field === 'scanValue') {
      state.scanValue = fieldNode.value
      if (event?.type === 'keydown' && (event as KeyboardEvent).key === 'Enter') {
        try { resolveCurrentScan() } catch (error) { state.errorText = error instanceof Error ? error.message : '识别失败' }
        refreshPage()
      }
      return true
    }
    if (field === 'deliveryPersonName') state.deliveryPersonName = fieldNode.value
    if (field === 'deliveryPersonPhone') state.deliveryPersonPhone = fieldNode.value
    if (field === 'quantity' && fieldNode.dataset.skuId) {
      state.quantities[fieldNode.dataset.skuId] = fieldNode.value
      const hasZeroQuantity = Object.values(state.quantities).some((value) => value !== '' && Number(value) === 0)
      state.errorText = hasZeroQuantity ? '回货登记数量必须大于 0，不能静默忽略。' : ''
      fieldNode.setAttribute('aria-invalid', Number(fieldNode.value) === 0 ? 'true' : 'false')
      const errorNode = document.querySelector<HTMLElement>('[data-return-quantity-error]')
      if (errorNode) {
        errorNode.textContent = state.errorText
        errorNode.classList.toggle('hidden', !state.errorText)
      }
    }
    if (field === 'evidenceFile' && event?.type === 'change' && fieldNode.files?.[0]) {
      const file = fieldNode.files[0]
      state.evidenceImages = [{ name: file.name, previewUrl: URL.createObjectURL(file) }]
      refreshPage()
    }
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-pda-sewing-self-return-action]')
  const action = actionNode?.dataset.pdaSewingSelfReturnAction
  if (!action) return false
  try {
    if (action === 'admin-exit') {
      clearPdaSewingSelfReturnMode()
      state.resolvedOrder = undefined
      state.returnIndex = undefined
      state.quantities = {}
      state.errorText = ''
      state.successText = ''
      appStore.navigate('/fcs/pda/handover?tab=pickup')
      return true
    }
    if (action === 'scan') resolveCurrentScan()
    if (action === 'load-demo') {
      state.scanValue = getPostFinishingReturnSourceScanValue('PO-QC-202608-001', 1)
      resolveCurrentScan()
    }
    if (action === 'reset') {
      state.scanValue = ''
      state.resolvedOrder = undefined
      state.returnIndex = undefined
      state.quantities = {}
      state.errorText = ''
    }
    if (action === 'load-evidence') state.evidenceImages = [{ name: '现场回货凭证.jpg', previewUrl: '/shirt-sample.jpg' }]
    if (action === 'zoom-image' && actionNode?.dataset.imageUrl) showImage(actionNode.dataset.imageUrl, actionNode.dataset.imageLabel || '图片大图')
    if (action === 'submit') {
      const runtime = getPdaRuntimeContext()
      if (!runtime || !state.resolvedOrder || !state.returnIndex) throw new Error('请先扫描本次回货来源码。')
      const record = registerPostFinishingFactoryReturn({
        productionOrderNo: state.resolvedOrder.productionOrderNo,
        returnIndex: state.returnIndex,
        triggerSource: '公共PDA自助回货',
        idempotencyKey: `PUBLIC-PDA:${state.resolvedOrder.productionOrderNo}:${state.returnIndex}`,
        quantities: state.resolvedOrder.skus.map((sku) => ({ skuId: sku.skuId, registeredQty: Number(state.quantities[sku.skuId]) })),
        deliveryPersonName: state.deliveryPersonName,
        deliveryPersonPhone: state.deliveryPersonPhone,
        evidenceImageUrls: state.evidenceImages.map((image) => image.previewUrl),
        actor: { actorId: runtime.userId, actorName: runtime.userName, roleName: runtime.roleId },
      })
      state.successText = `登记成功：${record.deliveryOrderNo}，等待后道二次点数。`
      state.errorText = ''
      state.resolvedOrder = undefined
      state.returnIndex = undefined
      state.scanValue = ''
      state.quantities = {}
      state.deliveryPersonName = ''
      state.deliveryPersonPhone = ''
      state.evidenceImages = []
    }
  } catch (error) {
    state.errorText = error instanceof Error ? error.message : '操作失败，请重新核对。'
    state.successText = ''
  }
  refreshPage()
  return true
}
