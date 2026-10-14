// 成衣管理 > 库存管理 · 面料库存总览演示数据。
// SPU 聚合视图 + 每个 SPU 3-9 条 SKU 明细；数量统一带单位（面料 Yard / 辅料 卷）。
// 图片复用 public/materials 下已有的面料与辅料实拍资产，不使用占位图或纯色块。

export type GarmentInventoryMaterialType = '面料' | '辅料'

export interface GarmentInventorySkuDetail {
  sku: string
  /** 一级仓库库存数 */
  primaryQty: number
  /** 二级仓库库存数 */
  secondaryQty: number
  /** 在途库存数 */
  transitQty: number
  unit: string
}

export interface GarmentInventorySpuRow {
  spu: string
  name: string
  materialType: GarmentInventoryMaterialType
  image: string
  imageAlt: string
  /** 海运标记：true=有标记，false=没标记 */
  seaMark: boolean
  /** 海运入库时间：有海运标记时展示，无标记为空字符串 */
  seaInboundTime: string
  unit: string
  transitQty: number
  primaryQty: number
  secondaryQty: number
  yesterdayConsumption: number
  avg7DayConsumption: number
  skus: GarmentInventorySkuDetail[]
}

interface SpuSeedInput {
  spu: string
  name: string
  materialType: GarmentInventoryMaterialType
  image: string
  seaMark: boolean
  skuCount: number
  unit: string
  primary: number
  secondary: number
  transit: number
  yesterday: number
  avg7: number
}

const FABRIC_IMAGES = [
  '/materials/fabric-main.jpg',
  '/materials/fabric-contrast.jpg',
  '/materials/fabric-lining.jpg',
]
const ACCESSORY_IMAGES = [
  '/materials/accessory-button.jpg',
  '/materials/accessory-zipper.jpg',
  '/materials/accessory-elastic-band.jpg',
  '/materials/accessory-label.jpg',
]

const COLOR_POOL = ['white', 'black', 'navy', 'grey', 'beige', 'blue', 'brown', 'ivory', 'khaki', 'green']

const SPU_INPUTS: SpuSeedInput[] = [
  { spu: 'SPU-MF-20001', name: '全棉平纹布 32S 白', materialType: '面料', image: FABRIC_IMAGES[0], seaMark: true, skuCount: 6, unit: 'Yard', primary: 9800, secondary: 4200, transit: 1200, yesterday: 320.5, avg7: 298.4 },
  { spu: 'SPU-MF-20002', name: '涤纶针织布 40D 黑', materialType: '面料', image: FABRIC_IMAGES[1], seaMark: false, skuCount: 5, unit: 'Yard', primary: 7600, secondary: 3100, transit: 0, yesterday: 245.2, avg7: 260.1 },
  { spu: 'SPU-MF-20003', name: '亚麻棉混纺 20×16 本白', materialType: '面料', image: FABRIC_IMAGES[2], seaMark: true, skuCount: 4, unit: 'Yard', primary: 5400, secondary: 2200, transit: 800, yesterday: 180.0, avg7: 176.3 },
  { spu: 'SPU-MF-20004', name: '氨纶弹力布 20D 藏青', materialType: '面料', image: FABRIC_IMAGES[0], seaMark: false, skuCount: 7, unit: 'Yard', primary: 8900, secondary: 3600, transit: 1500, yesterday: 410.7, avg7: 388.9 },
  { spu: 'SPU-MF-20005', name: '法兰绒格纹布 灰', materialType: '面料', image: FABRIC_IMAGES[1], seaMark: true, skuCount: 5, unit: 'Yard', primary: 6300, secondary: 2700, transit: 600, yesterday: 150.4, avg7: 162.0 },
  { spu: 'SPU-MF-20006', name: '双面绒卫衣布 麻灰', materialType: '面料', image: FABRIC_IMAGES[2], seaMark: false, skuCount: 6, unit: 'Yard', primary: 7200, secondary: 3000, transit: 900, yesterday: 260.8, avg7: 251.5 },
  { spu: 'SPU-MF-20007', name: '天丝牛仔布 14oz 靛蓝', materialType: '面料', image: FABRIC_IMAGES[0], seaMark: true, skuCount: 8, unit: 'Yard', primary: 11200, secondary: 4800, transit: 2000, yesterday: 520.3, avg7: 498.7 },
  { spu: 'SPU-MF-20008', name: '罗马布 涤粘 32S 米白', materialType: '面料', image: FABRIC_IMAGES[1], seaMark: false, skuCount: 5, unit: 'Yard', primary: 6800, secondary: 2900, transit: 0, yesterday: 205.6, avg7: 214.2 },
  { spu: 'SPU-MF-20009', name: '提花蕾丝布 象牙白', materialType: '面料', image: FABRIC_IMAGES[2], seaMark: true, skuCount: 3, unit: 'Yard', primary: 3200, secondary: 1300, transit: 400, yesterday: 96.5, avg7: 102.8 },
  { spu: 'SPU-MF-20010', name: '缎面雪纺 藏青', materialType: '面料', image: FABRIC_IMAGES[0], seaMark: false, skuCount: 6, unit: 'Yard', primary: 7100, secondary: 3050, transit: 750, yesterday: 238.9, avg7: 246.0 },
  { spu: 'SPU-MF-20011', name: '摇粒绒 双面 浅灰', materialType: '面料', image: FABRIC_IMAGES[1], seaMark: true, skuCount: 4, unit: 'Yard', primary: 4600, secondary: 1900, transit: 500, yesterday: 132.4, avg7: 140.6 },
  { spu: 'SPU-MF-20012', name: '抗菌针织布 32S 白', materialType: '面料', image: FABRIC_IMAGES[2], seaMark: false, skuCount: 9, unit: 'Yard', primary: 12600, secondary: 5200, transit: 2400, yesterday: 610.2, avg7: 588.4 },
  { spu: 'SPU-MA-30001', name: '树脂纽扣 11.5mm 白', materialType: '辅料', image: ACCESSORY_IMAGES[0], seaMark: false, skuCount: 4, unit: '卷', primary: 3200, secondary: 1400, transit: 300, yesterday: 88.0, avg7: 92.5 },
  { spu: 'SPU-MA-30002', name: '金属拉链 5# 黑 60cm', materialType: '辅料', image: ACCESSORY_IMAGES[1], seaMark: true, skuCount: 5, unit: '卷', primary: 4100, secondary: 1800, transit: 600, yesterday: 142.6, avg7: 138.9 },
  { spu: 'SPU-MA-30003', name: '松紧带 3cm 白', materialType: '辅料', image: ACCESSORY_IMAGES[2], seaMark: false, skuCount: 3, unit: '卷', primary: 2600, secondary: 1100, transit: 0, yesterday: 74.3, avg7: 78.1 },
  { spu: 'SPU-MA-30004', name: '水洗标 涤纶 白', materialType: '辅料', image: ACCESSORY_IMAGES[3], seaMark: true, skuCount: 6, unit: '卷', primary: 5600, secondary: 2400, transit: 900, yesterday: 190.5, avg7: 184.2 },
]

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

/** 将总量按确定性权重拆成 count 份，保证各份之和等于总量（末项吸收舍入差）。 */
function distribute(total: number, count: number, salt: number): number[] {
  const weights = Array.from({ length: count }, (_, index) => 1 + ((index * 7 + salt * 11) % 5))
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0)
  const values = weights.map((weight) => round2((total * weight) / weightSum))
  const diff = round2(total - values.reduce((sum, value) => sum + value, 0))
  values[values.length - 1] = round2(values[values.length - 1] + diff)
  return values
}

export const garmentInventorySeed: GarmentInventorySpuRow[] = SPU_INPUTS.map((input, inputIndex) => {
  const primary = distribute(input.primary, input.skuCount, inputIndex + 1)
  const secondary = distribute(input.secondary, input.skuCount, inputIndex + 2)
  const transit = distribute(input.transit, input.skuCount, inputIndex + 3)
  const skus: GarmentInventorySkuDetail[] = Array.from({ length: input.skuCount }, (_, index) => ({
    sku: `${input.spu}-${COLOR_POOL[(inputIndex + index) % COLOR_POOL.length]}`,
    primaryQty: primary[index],
    secondaryQty: secondary[index],
    transitQty: transit[index],
    unit: input.unit,
  }))

  // 有海运标记的 SPU 才有海运入库时间，按索引确定性生成。
  const seaInboundTime = input.seaMark
    ? `2026-${String((inputIndex % 6) + 1).padStart(2, '0')}-${String((inputIndex % 27) + 1).padStart(2, '0')} ${String(8 + (inputIndex % 10)).padStart(2, '0')}:${String((inputIndex * 7) % 60).padStart(2, '0')}`
    : ''

  return {
    spu: input.spu,
    name: input.name,
    materialType: input.materialType,
    image: input.image,
    imageAlt: `${input.name}（${input.spu}）`,
    seaMark: input.seaMark,
    seaInboundTime,
    unit: input.unit,
    transitQty: round2(transit.reduce((sum, value) => sum + value, 0)),
    primaryQty: round2(primary.reduce((sum, value) => sum + value, 0)),
    secondaryQty: round2(secondary.reduce((sum, value) => sum + value, 0)),
    yesterdayConsumption: input.yesterday,
    avg7DayConsumption: input.avg7,
    skus,
  }
})
