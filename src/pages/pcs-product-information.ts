// @page-pattern: detail
import { escapeHtml, localDateTimeText } from '../utils.ts'
import { renderButton } from '../components/ui/button.ts'
import { renderLabeledInput } from '../components/ui/form.ts'
import type { StyleArchiveShellRecord } from '../data/pcs-style-archive-types.ts'
import { getStyleArchiveById, updateStyleArchive } from '../data/pcs-style-archive-repository.ts'
import { isStyleArchiveFormalized } from '../data/pcs-product-lifecycle-governance.ts'

export const PRODUCT_INFORMATION_FIELDS = [
  ['productType', '商品类型', false], ['brandName', '品牌', false],
  ['categoryName', '一级分类', false], ['subCategoryName', '二级分类', false],
  ['thirdCategoryName', '三级分类', false], ['materialType', '材质类型', false],
  ['categoryTags', '品类', true], ['styleTags', '风格', true],
  ['popularElementTags', '流行元素', true], ['fabricTags', '面料', true],
  ['targetAudienceTags', '人群', true], ['ageTags', '年龄', true],
  ['audiencePositionTags', '人群定位', true], ['categoryCode', '品类编号', false],
  ['categoryCodeName', '品类名称', false], ['productPosition', '商品定位', false],
] as const
const protectedFields = new Set(['productType', 'brandName', 'categoryName', 'subCategoryName', 'styleTags', 'targetAudienceTags'])
const choices: Record<string, string[]> = {
  targetAudienceTags: ['年轻', '成熟', '中老年'], ageTags: ['18-30', '25-45', '45-65'],
  audiencePositionTags: ['穆斯林', '穆斯林友好', '非穆斯林'],
  productPosition: ['基础款', '设计款', '设计改款', '低价改款', '低价', '冷启动基础款', '廉价款', '快时尚款'],
  materialType: ['非毛织', '毛织'],
}
function textValue(style: StyleArchiveShellRecord, key: typeof PRODUCT_INFORMATION_FIELDS[number][0]): string {
  const value = style[key]
  return Array.isArray(value) ? value.join('、') : value || ''
}
export function renderProductInformation(style: StyleArchiveShellRecord | null, editable = false, editing = false): string {
  if (!style) return '<div class="rounded-lg border bg-white p-5 text-sm text-amber-700">商品档案不可用，请先核对关联商品。</div>'
  const locked = isStyleArchiveFormalized(style)
  const fieldHtml = (entry: typeof PRODUCT_INFORMATION_FIELDS[number]) => {
    const [key, label, multiple] = entry
    const value = textValue(style, key)
    if (!editing || (locked && protectedFields.has(key) && Boolean(value))) return `<div class="min-w-0"><dt class="text-xs text-slate-500">${label}</dt><dd class="mt-2 break-words text-sm ${value ? 'text-slate-900' : 'text-amber-700'}">${escapeHtml(value || '待完善')}</dd></div>`
    if (choices[key]) {
      const selected = multiple ? (style[key] as string[] || []) : [value]
      const options = [...new Set([...choices[key], ...selected.filter(Boolean)])]
      return `<fieldset class="min-w-0"><legend class="mb-2 text-sm font-medium">${label}</legend><div class="flex flex-wrap gap-x-4 gap-y-2">${(!multiple ? ['', ...options] : options).map((option) => `<label class="flex items-center gap-1.5 text-sm"><input type="${multiple ? 'checkbox' : 'radio'}" name="product-info-${key}" data-product-info-field="${key}" value="${escapeHtml(option)}" ${selected.includes(option) ? 'checked' : ''}>${escapeHtml(option || '待完善')}</label>`).join('')}</div></fieldset>`
    }
    return renderLabeledInput(label, { id: `product-info-${key}`, prefix: 'product-info', field: key, value, placeholder: multiple ? '多个值用顿号或逗号分隔' : `请输入${label}` })
  }
  const button = (label: string, action: string, primary = false) => renderButton({ label, variant: primary ? 'primary' : 'secondary', action: { prefix: 'pcs-product-archive', action, skipPageRerender: true } })
  return `<section data-product-information data-style-id="${escapeHtml(style.styleId)}" class="rounded-lg border bg-white p-5 space-y-5 xl:col-span-2">
    <header class="flex flex-wrap items-center justify-between gap-3"><div><h2 class="font-semibold">商品信息</h2><p class="mt-1 text-xs text-slate-500">来源：商品档案 · ${escapeHtml(style.styleCode)}${editing ? '；多选字段可填写多个标签。' : ''}</p></div><div class="flex gap-2">${editable ? editing ? button('取消', 'cancel-product-information') + button('保存商品信息', 'save-product-information', true) : button('维护商品信息', 'edit-product-information') : `<a class="text-sm text-blue-700 hover:underline" href="/pcs/products/styles/${encodeURIComponent(style.styleId)}" data-nav="/pcs/products/styles/${encodeURIComponent(style.styleId)}">查看商品档案</a>`}</div></header>
    ${editing && locked ? '<p class="text-xs text-slate-500">已正式建档且有值的核心属性只读；缺失属性及商品补充信息可在此完善。</p>' : ''}
    <div data-product-information-feedback role="status" class="text-sm text-amber-700"></div>
    <div><h3 class="mb-3 text-sm font-medium text-slate-700">基本属性</h3><dl class="grid grid-cols-2 gap-x-6 gap-y-4 lg:grid-cols-3">${PRODUCT_INFORMATION_FIELDS.slice(0, 6).map(fieldHtml).join('')}</dl></div>
    <div class="border-t pt-4"><h3 class="mb-3 text-sm font-medium text-slate-700">品类与商品定位</h3><dl class="grid grid-cols-2 gap-x-6 gap-y-4 lg:grid-cols-3">${PRODUCT_INFORMATION_FIELDS.slice(6).map(fieldHtml).join('')}</dl></div>
  </section>`
}
export function handleProductInformationEvent(target: HTMLElement): boolean {
  const action = target.closest<HTMLElement>('[data-pcs-product-archive-action]')?.dataset.pcsProductArchiveAction
  if (!['edit-product-information', 'cancel-product-information', 'save-product-information'].includes(action || '')) return false
  const host = target.closest<HTMLElement>('[data-product-information]')
  const style = host && getStyleArchiveById(host.dataset.styleId || '')
  if (!host || !style) return true
  if (action === 'save-product-information') {
    const patch: Partial<StyleArchiveShellRecord> = {}
    for (const [key, , multiple] of PRODUCT_INFORMATION_FIELDS) {
      if (isStyleArchiveFormalized(style) && protectedFields.has(key) && Boolean(textValue(style, key))) continue
      const controls = [...host.querySelectorAll<HTMLInputElement>(`[data-product-info-field="${key}"]`)]
      const value = choices[key] ? controls.filter((node) => node.checked).map((node) => node.value).join('、') : controls[0]?.value.trim() || ''
      Object.assign(patch, { [key]: multiple ? [...new Set(value.split(/[,，、]/).map((part) => part.trim()).filter(Boolean))] : value })
    }
    if (Boolean(patch.categoryCode) !== Boolean(patch.categoryCodeName)) {
      host.querySelector('[data-product-information-feedback]')!.textContent = '品类编号和品类名称需要同时填写，或同时留空。'
      return true
    }
    if (patch.thirdCategoryName && !(patch.subCategoryName ?? style.subCategoryName)) {
      host.querySelector('[data-product-information-feedback]')!.textContent = '请先在商品档案完善二级分类，再填写三级分类。'
      return true
    }
    updateStyleArchive(style.styleId, { ...patch, updatedAt: localDateTimeText(), updatedBy: '当前用户' })
  }
  host.outerHTML = renderProductInformation(getStyleArchiveById(style.styleId), true, action === 'edit-product-information')
  return true
}
