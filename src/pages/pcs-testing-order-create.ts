// @page-pattern: form
import { escapeHtml } from '../utils.ts'
import { appStore } from '../state/store.ts'
import { renderButton } from '../components/ui/button.ts'
import { renderLabeledSelect } from '../components/ui/form.ts'
import { getStyleArchiveById, listStyleArchives } from '../data/pcs-style-archive-repository.ts'
import { listSkuArchives } from '../data/pcs-sku-archive-repository.ts'
import { createTestingOrder, listTestingOrders } from '../data/pcs-testing-order-repository.ts'
import { renderProductInformation } from './pcs-product-information.ts'

const state = { styleId: '', skuCodes: [] as string[] }
function selectedProduct(): string {
  const style = getStyleArchiveById(state.styleId)
  if (!style) return '<section class="rounded-lg border border-dashed bg-white p-12 text-center text-sm text-slate-500">选择商品后，自动展示商品档案信息与可测款 SKU。</section>'
  const skus = listSkuArchives().filter((sku) => sku.styleId === style.styleId)
  return `<section class="rounded-lg border bg-white p-5"><div class="flex items-center gap-4">
    <button type="button" class="relative h-20 w-20 shrink-0 overflow-hidden rounded border" data-pda-image-preview-url="${escapeHtml(style.mainImageUrl)}" data-pda-image-preview-title="${escapeHtml(style.styleName)}" data-skip-page-rerender="true" aria-label="查看商品大图"><img data-create-style-image src="${escapeHtml(style.mainImageUrl)}" alt="${escapeHtml(style.styleName)}" class="h-full w-full object-cover" onload="this.nextElementSibling.hidden=true" onerror="this.hidden=true;this.nextElementSibling.textContent='图片加载失败'"/><span class="absolute inset-0 flex items-center justify-center bg-white text-xs text-slate-500">图片加载中</span></button>
    <div><h2 class="font-semibold">${escapeHtml(style.styleName)}</h2><p class="mt-1 text-sm text-slate-500">${escapeHtml(style.styleCode)}</p><p class="mt-2 text-xs text-slate-500">请选择本次测款的 SKU，商品属性由下方档案提供。</p></div></div>
    <fieldset class="mt-4 border-t pt-4"><legend class="text-sm font-medium">测款 SKU</legend><div class="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">${skus.map((sku) => `<div class="flex items-center gap-2 rounded border p-3 text-sm"><button type="button" class="relative h-10 w-10 shrink-0 overflow-hidden rounded border" data-pda-image-preview-url="${escapeHtml(sku.skuImageUrl || style.mainImageUrl)}" data-pda-image-preview-title="${escapeHtml(sku.skuCode)}" data-skip-page-rerender="true" aria-label="查看 ${escapeHtml(sku.skuCode)} 大图"><img src="${escapeHtml(sku.skuImageUrl || style.mainImageUrl)}" alt="${escapeHtml(sku.skuCode)}" class="h-full w-full object-cover" onload="this.nextElementSibling.hidden=true" onerror="this.hidden=true;this.nextElementSibling.textContent='图片失败'"/><span class="absolute inset-0 bg-white text-[10px]">加载中</span></button><label class="flex min-w-0 items-center gap-2"><input type="checkbox" data-testing-create-field="sku" value="${escapeHtml(sku.skuCode)}" ${state.skuCodes.includes(sku.skuCode) ? 'checked' : ''}><span class="min-w-0 break-words">${escapeHtml(sku.skuCode)}<span class="mt-1 block text-xs text-slate-500">${escapeHtml(sku.colorName)} / ${escapeHtml(sku.sizeName)}</span></span></label></div>`).join('') || '<p class="text-amber-700">该商品尚无 SKU，请先到商品档案维护规格。</p>'}</div></fieldset>
  </section>${renderProductInformation(style)}`
}
export function renderPcsTestingOrderCreatePage(): string {
  const busy = new Set(listTestingOrders().filter((order) => order.status === '进行中').map((order) => order.styleId))
  return `<div data-testing-create-page data-skip-page-rerender="true" class="space-y-3 p-4">
    <header class="flex items-center justify-between"><div><h1 class="text-xl font-semibold">新建测款单</h1><p class="mt-1 text-sm text-slate-500">关联商品档案，自动带出商品买手并选择本次测款规格。</p></div><a data-nav="/pcs/testing/orders" href="/pcs/testing/orders" class="text-sm text-slate-600 hover:text-blue-700">返回测款单列表</a></header>
    <section class="rounded-lg border bg-white p-5"><h2 class="mb-4 font-semibold">测款安排</h2><div class="grid gap-5 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      ${renderLabeledSelect('商品档案', { id: 'testing-create-style', prefix: 'testing-create', field: 'style', value: state.styleId, placeholder: '请选择已有商品档案', options: listStyleArchives().map((style) => ({ value: style.styleId, label: `${style.styleCode} · ${style.styleName}${busy.has(style.styleId) ? '（已有进行中测款单）' : ''}`, disabled: busy.has(style.styleId) })) }, true)}
      <div class="space-y-1"><span class="text-sm font-medium">商品买手</span><div data-testing-create-buyer class="flex h-9 items-center rounded-md border bg-slate-50 px-3 text-sm">${escapeHtml(getStyleArchiveById(state.styleId)?.buyerName || (state.styleId ? '商品未绑定买手' : '选择商品后自动带出'))}</div><p class="text-xs text-slate-500">随商品档案自动带出</p></div>
    </div><p class="mt-3 text-xs text-slate-500">未找到商品？请先在 <a data-nav="/pcs/products/styles" href="/pcs/products/styles" class="text-blue-700 hover:underline">商品档案</a> 建档并维护规格。同一商品同时只能有一张进行中测款单。</p></section>
    <div data-testing-create-product class="space-y-4">${selectedProduct()}</div>
    <footer class="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-white p-4 shadow-sm"><p data-testing-create-feedback role="status" class="text-sm text-amber-700"></p><div class="ml-auto flex gap-3"><a data-nav="/pcs/testing/orders" href="/pcs/testing/orders" class="inline-flex h-9 items-center rounded-md border px-4 text-sm">取消</a>${renderButton({ label: '创建测款单', variant: 'primary', action: { prefix: 'testing-create', action: 'submit', skipPageRerender: true } })}</div></footer>
  </div>`
}
export function handlePcsTestingOrderCreateInput(target: Element): boolean {
  const field = target.getAttribute('data-testing-create-field')
  if (!field) return false
  if (field === 'sku') state.skuCodes = [...document.querySelectorAll<HTMLInputElement>('[data-testing-create-field="sku"]:checked')].map((node) => node.value)
  if (field === 'style') {
    const id = (target as HTMLSelectElement).value
    if (id === state.styleId) return true
    state.styleId = id
    const buyer = document.querySelector('[data-testing-create-buyer]')
    if (buyer) buyer.textContent = getStyleArchiveById(id)?.buyerName || (id ? '商品未绑定买手' : '选择商品后自动带出')
    state.skuCodes = listSkuArchives().filter((sku) => sku.styleId === id).map((sku) => sku.skuCode)
    const region = document.querySelector('[data-testing-create-product]')
    if (region) region.innerHTML = selectedProduct()
    const feedback = document.querySelector('[data-testing-create-feedback]')
    if (feedback) feedback.textContent = ''
  }
  return true
}
export function handlePcsTestingOrderCreateEvent(target: HTMLElement): boolean {
  if (!target.closest('[data-testing-create-action="submit"]')) return false
  const feedback = document.querySelector('[data-testing-create-feedback]')!
  if (!state.styleId) { feedback.textContent = '请选择商品档案。'; return true }
  if (!getStyleArchiveById(state.styleId)?.buyerName) { feedback.textContent = '商品尚未绑定买手，请先完善商品档案的买手关系。'; return true }
  if (!state.skuCodes.length) { feedback.textContent = '请至少选择一个测款 SKU。'; return true }
  const picture = document.querySelector<HTMLImageElement>('[data-create-style-image]')
  if (!picture?.complete || !picture.naturalWidth) { feedback.textContent = '商品图片尚未成功加载，请核对商品档案图片后重试。'; return true }
  const result = createTestingOrder({ styleId: state.styleId, skuCodes: state.skuCodes })
  if (!result.ok || !result.order) { feedback.textContent = result.message || '创建失败，请核对商品档案。'; return true }
  state.styleId = ''; state.skuCodes = []
  appStore.navigate(`/pcs/testing/orders/${encodeURIComponent(result.order.testingOrderId)}`)
  return true
}
