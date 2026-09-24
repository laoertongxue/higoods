// @page-pattern: detail
import { getProjectCreateCatalog } from '../data/pcs-project-repository.ts'
import { PRODUCT_CONFIG_FIELDS, resolveStyleProductInformation } from '../data/pcs-style-product-information.ts'
import { listConfigDimensionOptions, listProductCategoryNodes } from '../data/pcs-config-workspace-repository.ts'
import type { FlatDimensionId } from '../data/pcs-config-dimensions.ts'
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
const choices: Record<string, string[]> = { materialType: ['非毛织', '毛织'] }
function textValue(style: StyleArchiveShellRecord, key: typeof PRODUCT_INFORMATION_FIELDS[number][0]): string {
  const value = style[key]
  return Array.isArray(value) ? value.join('、') : value || ''
}
export function renderProductInformation(style: StyleArchiveShellRecord | null, editable = false, editing = false): string {
  if (!style) return '<div class="rounded-lg border bg-white p-5 text-sm text-amber-700">商品档案不可用，请先核对关联商品。</div>'
  style = resolveStyleProductInformation(style)
  const locked = isStyleArchiveFormalized(style)
  const fieldHtml = (entry: typeof PRODUCT_INFORMATION_FIELDS[number]) => {
    const [key, label, multiple] = entry
    const value = textValue(style, key)
    if (!editing || ['categoryName', 'subCategoryName', 'thirdCategoryName', 'categoryCode'].includes(key) || (locked && protectedFields.has(key) && Boolean(value))) return `<div class="min-w-0"><dt class="text-xs text-slate-500">${label}</dt><dd class="mt-2 break-words text-sm ${value ? 'text-slate-900' : 'text-amber-700'}">${escapeHtml(value || '待完善')}</dd></div>`
    const dimension = PRODUCT_CONFIG_FIELDS[key as keyof typeof PRODUCT_CONFIG_FIELDS]
    if (dimension) {
      const options = listConfigDimensionOptions(dimension)
      const ids = style!.productConfigRefs?.[dimension] || options.filter((option) => (multiple ? style![key] as string[] : [value]).includes(option.name_zh)).map((option) => option.id)
      const selected = new Set(ids)
      const legacyValues = (multiple ? (style![key] as string[] || []) : [value]).filter((name) => name && !options.some((option) => option.name_zh === name))
      const legacyOptions = !style!.productConfigRefs?.[dimension] ? legacyValues.map((name) => `<option value="${escapeHtml(`legacy:${name}`)}" selected>${escapeHtml(name)}（历史值）</option>`).join('') : ''
      return `<label class="block min-w-0 space-y-2"><span class="text-sm font-medium">${label}</span><select aria-label="${label}" data-product-info-config="${dimension}" ${multiple ? 'multiple size="3"' : ''} class="w-full min-w-0 rounded-md border bg-white p-2 text-sm">${multiple ? '' : '<option value="">请选择</option>'}${legacyOptions}${options.filter((option) => option.status === 'ENABLED' || selected.has(option.id)).map((option) => `<option value="${escapeHtml(option.id)}" ${selected.has(option.id) ? 'selected' : ''} ${option.status === 'DISABLED' ? 'disabled' : ''}>${escapeHtml(dimension === 'styleCodes' ? `${option.code} · ${option.name_zh}` : option.name_zh)}${option.status === 'DISABLED' ? '（已停用）' : ''}</option>`).join('')}</select>${multiple ? '<span class="block text-xs text-slate-500">可按 Ctrl / ⌘ 多选</span>' : ''}</label>`
    }
    if (choices[key]) {
      const selected = multiple ? (style[key] as string[] || []) : [value]
      const options = [...new Set([...choices[key], ...selected.filter(Boolean)])]
      return `<fieldset class="min-w-0"><legend class="mb-2 text-sm font-medium">${label}</legend><div class="flex flex-wrap gap-x-4 gap-y-2">${(!multiple ? ['', ...options] : options).map((option) => `<label class="flex items-center gap-1.5 text-sm"><input type="${multiple ? 'checkbox' : 'radio'}" name="product-info-${key}" data-product-info-field="${key}" value="${escapeHtml(option)}" ${selected.includes(option) ? 'checked' : ''}>${escapeHtml(option || '待完善')}</label>`).join('')}</div></fieldset>`
    }
    return renderLabeledInput(label, { id: `product-info-${key}`, prefix: 'product-info', field: key, value, placeholder: multiple ? '多个值用顿号或逗号分隔' : `请输入${label}` })
  }
  const buyers = editing ? getProjectCreateCatalog().owners : []
  if (style.buyerId && !buyers.some((buyer) => buyer.id === style!.buyerId)) buyers.push({ id: style.buyerId, name: style.buyerName || style.buyerId })
  const button = (label: string, action: string, primary = false) => renderButton({ label, variant: primary ? 'primary' : 'secondary', action: { prefix: 'pcs-product-archive', action, skipPageRerender: true } })
  return `<section data-product-information data-style-id="${escapeHtml(style.styleId)}" class="rounded-lg border bg-white p-5 space-y-5 xl:col-span-2">
    <header class="flex flex-wrap items-center justify-between gap-3"><div><h2 class="font-semibold">商品信息</h2><p class="mt-1 text-xs text-slate-500">来源：商品档案 · ${escapeHtml(style.styleCode)} · 属性名称引用系统设置 / 基础配置${editing ? '；标签从基础配置选择。' : ''}</p></div><div class="flex gap-2">${editable ? editing ? button('取消', 'cancel-product-information') + button('保存商品信息', 'save-product-information', true) : button('维护商品信息', 'edit-product-information') : `<a class="text-sm text-blue-700 hover:underline" href="/pcs/products/styles/${encodeURIComponent(style.styleId)}" data-nav="/pcs/products/styles/${encodeURIComponent(style.styleId)}">查看商品档案</a>`}</div></header>
    ${editing && locked ? '<p class="text-xs text-slate-500">已正式建档且有值的核心属性只读；缺失属性及商品补充信息可在此完善。</p>' : ''}
    <div data-product-information-feedback role="status" class="text-sm text-amber-700"></div>
    <div><div class="mb-4 text-sm">商品买手：${editing ? `<select aria-label="商品买手" data-product-info-buyer class="ml-2 rounded border p-2"><option value="">请选择商品绑定的买手</option>${buyers.map((buyer) => `<option value="${escapeHtml(buyer.id)}" ${buyer.id === style!.buyerId ? 'selected' : ''}>${escapeHtml(buyer.name)}</option>`).join('')}</select>` : escapeHtml(style.buyerName || '商品未绑定买手')}</div><h3 class="mb-3 text-sm font-medium text-slate-700">基本属性</h3>${editing && !locked ? `<label class="mb-4 block text-sm">商品类目<select aria-label="商品类目" data-product-info-category class="ml-3 max-w-full rounded border p-2"><option value="">请选择</option>${listProductCategoryNodes().filter((node) => node.status === 'ENABLED' || node.id === style!.productCategoryId).map((node) => { const path = [node.name]; let parent = listProductCategoryNodes().find((item) => item.id === node.parentId); while (parent) { path.unshift(parent.name); parent = listProductCategoryNodes().find((item) => item.id === parent!.parentId) } return `<option value="${node.id}" ${node.id === style!.productCategoryId ? 'selected' : ''}>${escapeHtml(path.join(' / '))}</option>` }).join('')}</select></label>` : ''}<dl class="grid grid-cols-2 gap-x-6 gap-y-4 lg:grid-cols-3">${PRODUCT_INFORMATION_FIELDS.slice(0, 6).map(fieldHtml).join('')}</dl></div>
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
    const refs = { ...style.productConfigRefs }
    const patch: Partial<StyleArchiveShellRecord> = { productConfigRefs: refs }
    for (const select of host.querySelectorAll<HTMLSelectElement>('[data-product-info-config]')) {
      const dimension = select.dataset.productInfoConfig as FlatDimensionId
      const values = [...select.selectedOptions].map((option) => option.value).filter(Boolean)
      if (values.some((value) => value.startsWith('legacy:'))) {
        delete refs[dimension]
        const options = listConfigDimensionOptions(dimension)
        const names = values.map((value) => value.startsWith('legacy:') ? value.slice(7) : options.find((option) => option.id === value)?.name_zh || '')
        const field = Object.entries(PRODUCT_CONFIG_FIELDS).find(([, item]) => item === dimension)![0]
        Object.assign(patch, { [field]: field.endsWith('Tags') ? names : names.join('、') })
      } else refs[dimension] = values
    }
    const buyer = host.querySelector<HTMLSelectElement>('[data-product-info-buyer]')
    if (buyer) { patch.buyerId = buyer.value; patch.buyerName = buyer.value ? buyer.selectedOptions[0]?.textContent || '' : '' }
    const category = host.querySelector<HTMLSelectElement>('[data-product-info-category]')
    if (category) {
      patch.productCategoryId = category.value
      if (!category.value) Object.assign(patch, { categoryId: '', categoryName: '', subCategoryId: '', subCategoryName: '', thirdCategoryName: '' })
    }
    for (const [key, , multiple] of PRODUCT_INFORMATION_FIELDS) {
      if (isStyleArchiveFormalized(style) && protectedFields.has(key) && Boolean(textValue(style, key))) continue
      if (key in PRODUCT_CONFIG_FIELDS || ['categoryName', 'subCategoryName', 'thirdCategoryName', 'categoryCode'].includes(key)) continue
      const controls = [...host.querySelectorAll<HTMLInputElement>(`[data-product-info-field="${key}"]`)]
      const value = choices[key] ? controls.filter((node) => node.checked).map((node) => node.value).join('、') : controls[0]?.value.trim() || ''
      Object.assign(patch, { [key]: multiple ? [...new Set(value.split(/[,，、]/).map((part) => part.trim()).filter(Boolean))] : value })
    }
    Object.assign(patch, resolveStyleProductInformation({ ...style, ...patch }))
    updateStyleArchive(style.styleId, { ...patch, updatedAt: localDateTimeText(), updatedBy: '当前用户' })
  }
  host.outerHTML = renderProductInformation(getStyleArchiveById(style.styleId), true, action === 'edit-product-information')
  return true
}
