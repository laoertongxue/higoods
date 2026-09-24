import { listConfigDimensionOptions, listProductCategoryNodes, type ProductCategoryNode } from './pcs-config-workspace-repository.ts'
import type { FlatDimensionId } from './pcs-config-dimensions.ts'
import type { StyleArchiveShellRecord } from './pcs-style-archive-types.ts'

export const PRODUCT_CONFIG_FIELDS = {
  brandName: 'brands', categoryTags: 'categories', styleTags: 'styles',
  popularElementTags: 'trendElements', fabricTags: 'fabrics', targetAudienceTags: 'crowds',
  ageTags: 'ages', audiencePositionTags: 'crowdPositioning', productPosition: 'productPositioning',
  categoryCodeName: 'styleCodes',
} as const satisfies Record<string, FlatDimensionId>

export function createStyleProductInformationContext() {
  return {
    options: Object.fromEntries(Object.values(PRODUCT_CONFIG_FIELDS).map((dimension) => [dimension, listConfigDimensionOptions(dimension)])) as Partial<Record<FlatDimensionId, ReturnType<typeof listConfigDimensionOptions>>>,
    categories: listProductCategoryNodes(),
  }
}

/** 商品保存所选配置 ID；名称始终由基础配置解析，不把整个字典当作商品属性。 */
export function resolveStyleProductInformation(style: StyleArchiveShellRecord, context = createStyleProductInformationContext()): StyleArchiveShellRecord {
  const result = { ...style }
  for (const [field, dimension] of Object.entries(PRODUCT_CONFIG_FIELDS)) {
    const ids = style.productConfigRefs?.[dimension]
    if (!ids) continue
    const options = context.options[dimension] || []
    const selected = ids.map((id) => options.find((option) => option.id === id))
    const names = selected.map((option) => option?.name_zh || '配置项已删除')
    Object.assign(result, { [field]: field.endsWith('Tags') ? names : names.join('、') })
    if (dimension === 'brands') result.brandId = ids[0] || ''
    if (dimension === 'styleCodes') result.categoryCode = selected[0]?.code || ''
  }
  if (style.productCategoryId) {
    const nodes = context.categories
    let current = nodes.find((node) => node.id === style.productCategoryId)
    const path: ProductCategoryNode[] = []
    while (current) { path.unshift(current); current = nodes.find((node) => node.id === current!.parentId) }
    result.categoryId = path[0]?.id || ''
    result.categoryName = path[0]?.name || '类目已删除'
    result.subCategoryId = path[1]?.id || ''
    result.subCategoryName = path[1]?.name || '未设二级类目'
    result.thirdCategoryName = path[2]?.name || (nodes.some((node) => node.parentId === path[1]?.id) ? '未指定三级类目' : '未设三级类目')
  }
  return result
}

/** 仅用于仓库既有演示商品的配置绑定，绝不套用于用户新建商品。 */
export function seedStyleProductInformation(style: StyleArchiveShellRecord, buyer?: { id: string; name: string }, context = createStyleProductInformationContext()): StyleArchiveShellRecord {
  const name = style.styleName.toLowerCase()
  const male = /pria|男|polo|jogger|flanel|kemeja|jas /.test(name)
  const skirt = /半裙|短裙|a字裙|rok /.test(name) && !/dress/.test(name)
  const dress = !skirt && /dress|连衣|连体|晚宴|度假裙/.test(name)
  const pants = /裤|celana/.test(name) && !dress
  const outer = /外套|夹克|卫衣|hoodie|jaket|jacket|blazer|jas |cardigan|开衫/.test(name)
  const knit = /毛织|针织|毛衣|sweater|rajut/.test(name)
  const shirt = /衬衫|衬衣|kemeja|blus|blouse/.test(name)
  const category = male ? pants ? '男装裤子' : outer ? '男装外套' : '男装上衣' : dress ? '连衣裙' : skirt ? '半裙' : pants ? '裤子' : outer ? '外套' : knit ? '毛衣' : '上衣'
  const leaf = male ? pants ? 'product-category-14' : outer ? 'product-category-15' : 'product-category-13' : dress ? /长裙|长款|gamis/.test(name) ? 'product-category-8' : 'product-category-6' : skirt ? /长裙/.test(name) ? 'product-category-8' : 'product-category-7' : pants ? /短|pendek/.test(name) ? 'product-category-11' : 'product-category-10' : shirt ? 'product-category-4' : outer || knit ? 'product-category-2' : 'product-category-3'
  const fabric = /牛仔/.test(name) ? '牛仔' : /蕾丝/.test(name) ? '蕾丝' : /棉麻|linen/.test(name) ? '棉麻' : knit ? '毛织' : /flanel|格子/.test(name) ? '法兰绒' : /satin/.test(name) ? '锻面' : dress || skirt || outer ? '涤纶' : '棉'
  const trend = /印花|batik|民族/.test(name) ? '图腾' : /刺绣/.test(name) ? '刺绣' : /百褶/.test(name) ? '百褶' : /拼接/.test(name) ? '拼接' : /撞色/.test(name) ? '撞色' : /运动|jogger/.test(name) ? '运动' : '素色'
  const fashion = /batik|中式/.test(name) ? '中式' : /通勤|商务|formal|blazer/.test(name) ? '通勤' : /度假|夏威夷/.test(name) ? '度假' : dress ? '优雅' : '休闲'
  const refs: NonNullable<StyleArchiveShellRecord['productConfigRefs']> = {}
  const bind = (dimension: FlatDimensionId, label: string) => {
    const option = (context.options[dimension] || []).find((item) => item.name_zh.toLowerCase() === label.toLowerCase())
    if (option) refs[dimension] = [option.id]
  }
  bind('brands', ['Asaya', 'FADFAD', 'Chicmore'].find((brand) => brand.toLowerCase() === style.brandName.toLowerCase()) || (male ? 'FADFAD' : 'Asaya'))
  bind('categories', category); bind('styles', fashion); bind('fabrics', fabric); bind('trendElements', trend)
  bind('crowds', /商务|formal|batik/.test(name) ? '成熟' : '年轻')
  bind('ages', /商务|formal|batik/.test(name) ? '25~45' : '18~30')
  bind('crowdPositioning', dress || /长袖|batik/.test(name) ? '穆斯林友好' : '非穆斯林')
  bind('productPositioning', /设计|印花|batik|蕾丝/.test(name) ? '设计款' : '基础款')
  const codeKeyword = dress ? '连衣裙' : skirt ? '裙' : pants ? '裤' : outer ? '外套' : knit ? '毛织上衣' : shirt ? /batik|印花/.test(name) ? '印花衬衫' : '休闲衬衫' : '短袖上衣'
  const code = (context.options.styleCodes || []).find((item) => item.name_zh.includes(codeKeyword))
  if (code) refs.styleCodes = [code.id]
  return resolveStyleProductInformation({ ...style, productConfigRefs: refs, productCategoryId: leaf,
    productInformationVersion: 1, productType: style.productType || '成衣', materialType: knit ? '毛织' : '非毛织',
    buyerId: buyer?.id || 'buyer-mock-chen', buyerName: buyer?.name || '陈买手',
  }, context)
}
