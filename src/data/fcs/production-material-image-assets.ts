export interface ProductionMaterialImageIdentity {
  materialSku?: string
  materialName?: string
  materialColor?: string
}

const MATERIAL_IMAGE_ROOT = '/materials/fei-ticket'

function normalizeIdentityText(value: string | null | undefined): string {
  return String(value ?? '').trim().toLowerCase()
}

/**
 * 正式物料效果图按“物料身份 + 颜色”解析。
 * 只覆盖已具备对象对应素材的物料；没有对应素材时返回空值，由调用方保留原缺图门禁。
 */
export function resolveProductionMaterialImageUrl(identity: ProductionMaterialImageIdentity): string {
  const sku = normalizeIdentityText(identity.materialSku)
  const name = normalizeIdentityText(identity.materialName)
  const color = normalizeIdentityText(identity.materialColor)
  const identityText = `${sku} ${name}`

  if (identityText.includes('mat-supplement-secondary-010') || identityText.includes('拼接面料')) {
    if (color.includes('black')) return `${MATERIAL_IMAGE_ROOT}/black-splice-fabric.png`
    if (color.includes('charcoal')) return `${MATERIAL_IMAGE_ROOT}/charcoal-splice-fabric.png`
    if (color.includes('navy')) return `${MATERIAL_IMAGE_ROOT}/navy-splice-fabric.png`
    if (color.includes('khaki')) return `${MATERIAL_IMAGE_ROOT}/khaki-splice-fabric.png`
    return ''
  }
  if (identityText.includes('spu_2024_010')) {
    if (color.includes('charcoal') || sku.includes('charcoal')) return `${MATERIAL_IMAGE_ROOT}/charcoal-stretch-twill.png`
    if (color.includes('navy') || sku.includes('navy')) return `${MATERIAL_IMAGE_ROOT}/navy-main-fabric.png`
    if (color.includes('khaki') || sku.includes('khaki')) return `${MATERIAL_IMAGE_ROOT}/khaki-canvas.png`
    if (color.includes('black') || sku.includes('black')) return `${MATERIAL_IMAGE_ROOT}/black-stretch-twill.png`
    return ''
  }
  if (identityText.includes('spu_2024_005')) return `${MATERIAL_IMAGE_ROOT}/grey-main-fabric.png`
  if (identityText.includes('spu_2024_009')) return `${MATERIAL_IMAGE_ROOT}/white-poplin.png`
  if (identityText.includes('spu_2024_017')) return `${MATERIAL_IMAGE_ROOT}/navy-main-fabric.png`
  if (identityText.includes('spu_hoodie_082')) return `${MATERIAL_IMAGE_ROOT}/fog-grey-sweatshirt-fleece.png`
  if (identityText.includes('spu_dress_083')) return `${MATERIAL_IMAGE_ROOT}/red-dress-crepe.png`
  if (identityText.includes('spu_shirt_086')) return `${MATERIAL_IMAGE_ROOT}/blue-white-print-cotton.png`

  return ''
}
