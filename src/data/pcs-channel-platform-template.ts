import type { ChannelContent, ChannelPlatformTemplate, ChannelStore, ChannelVariant } from './pcs-channel-catalog-types.ts'
import type { StyleArchiveShellRecord } from './pcs-style-archive-types.ts'

export const CHANNEL_TEMPLATE_FIELD_LABELS = { platformCategoryId: '平台类目', platformBrandId: '平台品牌', handle: 'Handle' } as const
export const CHANNEL_VARIANT_REQUIRED_LABELS = { sellerSku: '商家 SKU', displayColor: '平台颜色', displaySize: '平台尺码', displayPattern: '平台花型', imageId: '规格图片' } as const
export const CHANNEL_ATTRIBUTE_SOURCE_LABELS = { materialType: '材质类型', brandName: '品牌名称', categoryName: '一级类目', subCategoryName: '二级类目', yearTag: '年份', seasonTags: '季节', styleTags: '风格' } as const
/** 店铺级原型规则，不声称代表实时平台接口规范。未配置的旧记录使用明确的演示默认值。 */
export function getChannelPlatformTemplate(store: ChannelStore): ChannelPlatformTemplate {
  const template: ChannelPlatformTemplate = { version: 1, requiredFields: ['platformCategoryId'], requiredAttributes: [], categoryMappings: {}, brandMappings: {}, attributeMappings: {}, defaultBrandId: '', defaultAttributes: {}, attributeUnits: {}, requiredMediaRoles: ['主图'], requiredVariantFields: [], requiredVariantAttributes: [], ...store.platformTemplate }
  return structuredClone(template)
}
export function channelPlatformTemplateVersion(store: ChannelStore): string { return store.platformTemplate ? `${store.id}:platform-template:v${store.platformTemplate.version}` : 'R1-apparel-demo-v1' }
export function validateChannelPlatformTemplate(template: ChannelPlatformTemplate): void {
  if (!Number.isInteger(template.version) || template.version < 1) throw new Error('平台字段模板版本须为正整数。')
  if (template.requiredFields.some(key => !(key in CHANNEL_TEMPLATE_FIELD_LABELS))) throw new Error('平台模板包含不能设置为必填的字段。')
  for (const values of [template.categoryMappings, template.brandMappings, template.attributeMappings, template.defaultAttributes, template.attributeUnits]) {
    if (!values || Object.entries(values).some(([key, value]) => !key.trim() || typeof value !== 'string' || !value.trim())) throw new Error('平台映射和属性请按“键=值”完整填写。')
  }
  if (template.requiredAttributes.some(key => !key.trim())) throw new Error('必填平台属性名称不能为空。')
  if (template.requiredMediaRoles?.some(role => !['主图','详情图','尺码图','视频'].includes(role))) throw new Error('请选择已有的刊登媒体用途。')
  if (template.requiredVariantFields?.some(key => !(key in CHANNEL_VARIANT_REQUIRED_LABELS))) throw new Error('请选择已有的平台规格字段。')
  if (template.requiredVariantAttributes?.some(key => !key.trim())) throw new Error('必填规格属性名称不能为空。')
  if (Object.values(template.attributeMappings).some(source => !(source in CHANNEL_ATTRIBUTE_SOURCE_LABELS))) throw new Error('平台属性映射请选择已有的款式属性字段。')
}
/** 类目、品牌使用显式 ID 映射；没有映射时只取店铺默认值，不把内部名称当作平台 ID。 */
export function initializeChannelPlatformContent(store: ChannelStore, style: StyleArchiveShellRecord): Pick<ChannelContent, 'platformCategoryId' | 'platformBrandId' | 'platformAttributes' | 'platformAttributeSchemaVersion' | 'platformAttributeUnits'> {
  const template = getChannelPlatformTemplate(store), attributes = { ...template.defaultAttributes }
  for (const [target, source] of Object.entries(template.attributeMappings)) {
    const value = style[source as keyof StyleArchiveShellRecord]
    if (typeof value === 'string' && value.trim()) attributes[target] = value
    else if (Array.isArray(value) && value.length) attributes[target] = value.join('、')
  }
  return { platformCategoryId: [style.productCategoryId, style.subCategoryId, style.categoryId].map(id => id && template.categoryMappings[id]).find(Boolean) || store.defaultCategoryId, platformBrandId: template.brandMappings[style.brandId] || template.defaultBrandId, platformAttributes: attributes, platformAttributeSchemaVersion: channelPlatformTemplateVersion(store), platformAttributeUnits: { ...template.attributeUnits } }
}
export function assertChannelPlatformContentReady(store: ChannelStore, content: ChannelContent, variants: readonly ChannelVariant[]): void {
  const template = getChannelPlatformTemplate(store)
  const missing: string[] = template.requiredFields.filter(key => !content[key]?.trim()).map(key => CHANNEL_TEMPLATE_FIELD_LABELS[key])
  missing.push(...template.requiredAttributes.filter(key => !content.platformAttributes[key]?.trim()).map(key => `平台属性“${key}”`))
  for (const role of new Set(['主图', ...(template.requiredMediaRoles || [])])) if (!content.media.some(media => media.role === role && media.id && media.url)) missing.push(role)
  for (const variant of variants.filter(value => value.active)) {
    const label = variant.sellerSku || variant.platformVariantId || variant.id
    for (const key of template.requiredVariantFields || []) if (!variant[key]?.trim() || (key === 'imageId' && !variant.imageUrl?.trim())) missing.push(`${label} 的${CHANNEL_VARIANT_REQUIRED_LABELS[key]}`)
    for (const key of template.requiredVariantAttributes || []) if (!variant.platformAttributeValues[key]?.trim()) missing.push(`${label} 的规格属性“${key}”`)
  }
  if (missing.length) throw new Error(`当前店铺模板要求补齐：${missing.join('、')}。草稿可以先保存。`)
  if (content.platformAttributeSchemaVersion !== channelPlatformTemplateVersion(store)) throw new Error('店铺平台字段模板已更新，请在渠道内容编辑页重新应用当前模板并核对字段。')
}
