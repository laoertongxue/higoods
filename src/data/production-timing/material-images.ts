export interface TimingMaterialImage {
  name: string
  imageUrl: string | null
  alt: string
  source: string | null
  sha256: string | null
  note: string
}

// Only bind the material before processing. A target color or print does not
// establish the identity of its input material; missing photos remain explicit.
// Existing PCS effect images are prototype references, not proof of real goods.
export const TIMING_MATERIAL_IMAGES: Readonly<Record<string, TimingMaterialImage>> = {
  F01: {
    name: '主面料白坯布',
    imageUrl: '/materials/fei-ticket/white-poplin.png',
    alt: '白坯布原料效果图（复用 PCS 原型素材）',
    source: 'src/data/pcs-material-r1-seeds.ts · MAT-FB-00000002-B01；public/materials/fei-ticket/sources.json · white-poplin.png',
    sha256: '458870c433109166715b3386fc95775f334ce482d8c122397965765f214cddf3',
    note: 'PCS 已有白色府绸原料效果图；仅示意加工前白坯，蓝底 C01 与花型 A/B 是加工目标，不把完工花布当原料。具体物料规格与本款实物照片待补。',
  },
  F02: {
    name: '捆条布',
    imageUrl: '/images/production-timing/F02-effect.jpg',
    alt: '原型捆条布原料效果图；藏青C02仍是染色目标。',
    source: 'imagegen 内置工具生成的 Mock 物料效果图 · 2026-10-08',
    sha256: 'f4de4b37d0e263654fa356f1c919444a312b3ac5bfcaace8d1c5b76b243780ef',
    note: '原型捆条布原料效果图；藏青C02仍是染色目标。仅用于原型对象识别，不代表真实采购实物或已确认规格。',
  },
  A01: {
    name: '纽扣',
    imageUrl: '/images/production-timing/A01-effect.jpg',
    alt: '原型蓝白衬衫配套纽扣效果图。未确认的规格不由图片补填。',
    source: 'imagegen 内置工具生成的 Mock 物料效果图 · 2026-10-08',
    sha256: '09edecd07728f2c78184e5fba55009255b9928a2103c6a8bf7deea4b90241113',
    note: '原型蓝白衬衫配套纽扣效果图。未确认的规格不由图片补填。仅用于原型对象识别，不代表真实采购实物或已确认规格。',
  },
  A02: {
    name: '衬布',
    imageUrl: '/images/production-timing/A02-effect.jpg',
    alt: '原型领／门襟衬布效果图，区别于里布。',
    source: 'imagegen 内置工具生成的 Mock 物料效果图 · 2026-10-08',
    sha256: '7372ede2cbbb4a9341d95a1f84e284b831bcb98bac587ecd9ca96cf95d78d09f',
    note: '原型领／门襟衬布效果图，区别于里布。仅用于原型对象识别，不代表真实采购实物或已确认规格。',
  },
  A03: {
    name: '织标',
    imageUrl: '/images/production-timing/A03-effect.jpg',
    alt: '原型本款织标效果图，区别于洗水唛；不含品牌身份。',
    source: 'imagegen 内置工具生成的 Mock 物料效果图 · 2026-10-08',
    sha256: '67a773ed8ef9a958867819007378267d392f58ed1c9b2d543ec9aaaa42959d47',
    note: '原型本款织标效果图，区别于洗水唛；不含品牌身份。仅用于原型对象识别，不代表真实采购实物或已确认规格。',
  },
}

export function getTimingMaterialImage(materialId: string): TimingMaterialImage | null {
  return TIMING_MATERIAL_IMAGES[materialId] || null
}
