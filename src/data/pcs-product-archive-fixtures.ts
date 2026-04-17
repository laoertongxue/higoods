const PRODUCT_IMAGE_POOL = [
  'https://file.higood.id/higood_live/proudcts/2026/04/16/83358027dc8efb43359af8b6996d12fa.jpg',
  'https://file.higood.id/higood_live/proudcts/2026/04/16/4b45b816574f99080d0b06f30c9464af.jpg',
  'https://file.higood.id/higood_live/proudcts/2026/04/16/c74d884c23376156c8dc13a5ff39d3fa.jpg',
  'https://file.higood.id/higood_live/proudcts/2026/04/16/e0f7c7ce28085289101a5aaab57e8b72.jpg',
  'https://file.higood.id/higood_live/proudcts/2026/04/16/291197a6d0717c9d8832fff8b329299e.jpg',
  'https://file.higood.id/higood_live/proudcts/2026/04/16/f8f3566efc82709add4e08fe108b7dfc.jpg',
  'https://file.higood.id/higood_live/proudcts/2026/04/16/2feb56c3b75979a9f839217decc23b74.jpeg',
  'https://file.higood.id/higood_live/proudcts/2026/04/16/766c6496dba8cace985d7b8598a1a5cd.jpg',
]

const PRODUCT_TITLE_POOL = [
  'Atasan Pakaian Wanita Bergaya Kekinian Mode Terbaru',
  'Atasan Pakaian Wanita Kerah Bulat Lengan Panjang Warna Solid Gaya Kekinian',
  'Atasan Kemeja Kerah Polo Gaya Anggun untuk Wanita Kelas Atas',
  'Sweater Longgar Lengan Panjang Model Dua Potong Palsu Motif Kombinasi Trendi',
  'Atasan Wanita dengan Ritsleting Bagian Depan dan Model Kerah Boneka',
  'Kemeja Dua Potong Palsu dengan Lengan Panjang Wanita Kelas Atas',
  'Kemeja Dua Potong Palsu Warna Kontras dengan Lengan Panjang Gaya Minimalis',
  'Sweater Wanita Lengan Panjang Model Terbaru dengan Kerah Polo Gaya Kasual',
]

function hashValue(input: string): number {
  let hash = 0
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 33 + input.charCodeAt(index)) % 2147483647
  }
  return hash
}

function pickBySeed<T>(items: T[], seed: string, offset = 0): T {
  const index = (hashValue(seed) + offset) % items.length
  return items[index]
}

function titleCaseWords(text: string): string {
  return text
    .split(/[\s/]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')
}

function normalizeEnglishName(styleName: string, seed: string): string {
  const raw = styleName.trim()
  if (!raw) return pickBySeed(PRODUCT_TITLE_POOL, seed)
  if (/[A-Za-z]{3,}/.test(raw)) return raw
  return titleCaseWords(raw.replace(/[（()）]/g, ' '))
}

function resolveSizeBoost(size: string): number {
  const normalized = size.trim().toUpperCase()
  if (normalized === 'XS') return -1
  if (normalized === 'S') return 0
  if (normalized === 'M') return 1
  if (normalized === 'L') return 2
  if (normalized === 'XL') return 3
  if (normalized === '2XL') return 4
  if (normalized === '3XL') return 5
  return 1
}

function resolveBaseCost(styleName: string): number {
  if (styleName.includes('外套') || styleName.includes('夹克') || /hoodie|jacket|jas/i.test(styleName)) return 118
  if (styleName.includes('裙') || /dress/i.test(styleName)) return 96
  if (styleName.includes('裤') || /pants|jogger/i.test(styleName)) return 84
  if (styleName.includes('衬衫') || /shirt|kemeja/i.test(styleName)) return 79
  if (styleName.includes('毛衣') || styleName.includes('针织') || /sweater|knit/i.test(styleName)) return 88
  return 68
}

function resolvePackaging(styleName: string): string {
  if (styleName.includes('外套') || styleName.includes('夹克') || /hoodie|jacket|jas/i.test(styleName)) {
    return '独立防尘袋 + 纸卡，建议挂装入箱'
  }
  if (styleName.includes('裙') || /dress/i.test(styleName)) {
    return '折叠入袋 + 领口定型纸，避免压皱'
  }
  if (styleName.includes('裤') || /pants|jogger/i.test(styleName)) {
    return '折叠入袋 + 腰头保护纸'
  }
  return '独立包装袋 + 吊牌，常规折叠入箱'
}

export interface ProductStyleFixture {
  styleNameEn: string
  mainImageUrl: string
  galleryImageUrls: string[]
  sellingPointText: string
  detailDescription: string
  packagingInfo: string
}

export interface ProductSkuFixture {
  skuName: string
  skuNameEn: string
  channelTitle: string
  skuImageUrl: string
  costPrice: number
  freightCost: number
  suggestedRetailPrice: number
  currency: string
  pricingUnit: string
  weightKg: number
  lengthCm: number
  widthCm: number
  heightCm: number
  packagingInfo: string
}

export function buildStyleFixture(styleCode: string, styleName: string): ProductStyleFixture {
  const styleNameEn = normalizeEnglishName(styleName, styleCode)
  const mainImageUrl = pickBySeed(PRODUCT_IMAGE_POOL, styleCode)
  const galleryImageUrls = [
    mainImageUrl,
    pickBySeed(PRODUCT_IMAGE_POOL, styleCode, 1),
    pickBySeed(PRODUCT_IMAGE_POOL, styleCode, 2),
  ]

  return {
    styleNameEn,
    mainImageUrl,
    galleryImageUrls,
    sellingPointText: '主图、标题、规格矩阵、技术资料与渠道映射统一收口到正式档案。',
    detailDescription: `${styleName} 已转入正式款式档案，当前以技术包、规格档案和渠道店铺商品作为后续生产与经营链路的唯一主数据来源。`,
    packagingInfo: resolvePackaging(styleName),
  }
}

export function buildSkuFixture(
  styleCode: string,
  styleName: string,
  colorName: string,
  sizeName: string,
): ProductSkuFixture {
  const seed = `${styleCode}-${colorName}-${sizeName}`
  const styleFixture = buildStyleFixture(styleCode, styleName)
  const baseCost = resolveBaseCost(styleName)
  const sizeBoost = resolveSizeBoost(sizeName)
  const costPrice = Number((baseCost + sizeBoost * 2).toFixed(2))
  const freightCost = Number((costPrice * 0.08).toFixed(2))
  const suggestedRetailPrice = Number((costPrice * 2.8).toFixed(2))
  const weightKg = Number((styleName.includes('外套') ? 0.92 : styleName.includes('裙') ? 0.56 : 0.38 + sizeBoost * 0.02).toFixed(2))
  const lengthCm = styleName.includes('外套') ? 38 : styleName.includes('裙') ? 34 : 30
  const widthCm = styleName.includes('外套') ? 28 : styleName.includes('裙') ? 24 : 22
  const heightCm = styleName.includes('外套') ? 8 : styleName.includes('裙') ? 6 : 4

  return {
    skuName: `${styleName} ${colorName}/${sizeName}`,
    skuNameEn: `${styleFixture.styleNameEn} ${colorName}/${sizeName}`,
    channelTitle: `${styleFixture.styleNameEn} ${colorName} ${sizeName}`.trim(),
    skuImageUrl: pickBySeed(PRODUCT_IMAGE_POOL, seed),
    costPrice,
    freightCost,
    suggestedRetailPrice,
    currency: '人民币',
    pricingUnit: 'PCS',
    weightKg,
    lengthCm,
    widthCm,
    heightCm,
    packagingInfo: styleFixture.packagingInfo,
  }
}
