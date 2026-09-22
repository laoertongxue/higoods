import type { WebbingEndMethod } from './webbing-specifications.ts'

/**
 * TMF 对象对应参考图（IMG-006～010）。
 * 全部为本地存储的实拍图/厂商产品图，页面必须标注来源身份，不得冒充工厂实拍。
 * 素材来源登记见 docs/product-design/tmf-webbing/evidence/2026-09-22-tmf-image-sources.json。
 */
export const TMF_REFERENCE_IMAGES = {
  webbingRealRoll: '/materials/tmf/webbing-real-roll.jpg',
  webbingRealBox: '/materials/tmf/webbing-real-box.jpg',
  ropeRealBundle: '/materials/tmf/rope-real-bundle.jpg',
  dyedBlue: '/materials/tmf/webbing-dyed-blue.jpg',
  printedPattern: '/materials/tmf/webbing-printed-pattern.jpg',
  tipPlastic: '/materials/tmf/tip-plastic-aglet.jpg',
  tipMetal: '/materials/tmf/tip-metal-aglet.jpg',
  tipSilicone: '/materials/tmf/tip-silicone-dip.jpg',
} as const

export function resolveTmfDyeOutputReference(nameOrSku: string): string {
  if (/绳|CORD|RP/i.test(nameOrSku)) return TMF_REFERENCE_IMAGES.ropeRealBundle
  if (/蓝|BLUE|CBL|色/i.test(nameOrSku)) return TMF_REFERENCE_IMAGES.dyedBlue
  return TMF_REFERENCE_IMAGES.webbingRealBox
}

export function resolveTmfPrintOutputReference(nameOrSku: string): string {
  if (/绳|CORD|RP/i.test(nameOrSku)) return TMF_REFERENCE_IMAGES.ropeRealBundle
  if (/印|PATTERN|花|P\d/i.test(nameOrSku)) return TMF_REFERENCE_IMAGES.printedPattern
  return TMF_REFERENCE_IMAGES.printedPattern
}

export function resolveTmfTipReference(method: WebbingEndMethod | string | undefined): string {
  if (method === 'PLASTIC_WRAP') return TMF_REFERENCE_IMAGES.tipPlastic
  if (method === 'METAL') return TMF_REFERENCE_IMAGES.tipMetal
  if (method === 'SILICONE_DIP') return TMF_REFERENCE_IMAGES.tipSilicone
  return ''
}

export function tmfTipReferenceLabel(method: WebbingEndMethod | string | undefined): string {
  if (method === 'PLASTIC_WRAP') return '塑料包头参考图（厂商/公共来源）'
  if (method === 'METAL') return '金属头参考图（公共来源历史实物）'
  if (method === 'SILICONE_DIP') return '硅胶浸头参考图（厂商产品图）'
  return '端头参考图'
}
