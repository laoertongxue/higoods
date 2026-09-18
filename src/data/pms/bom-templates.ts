import { PMS_MATERIAL_IMAGES, PMS_STYLE_IMAGES } from './images.ts'
import { roundPmsQty } from './runtime.ts'

export interface PmsBomMaterialLine {
  materialCode: string
  materialName: string
  materialType: string
  imageUrl: string
  unit: string
  usagePerPiece: number
  lossRate: number
  stockQty: number
  purchasingQty: number
  supplierName: string
  warehouse: string
}

export interface PmsBomTemplate {
  spu: string
  productName: string
  styleCode: string
  imageUrl: string
  version: string
  status: '已发布' | '草稿' | '未匹配'
  updatedAt: string
  materials: PmsBomMaterialLine[]
}

export function computePlannedUsage(usagePerPiece: number, lossRate: number): number {
  return roundPmsQty(usagePerPiece * (1 + lossRate), 4)
}

export function computeBomDemand(skuQty: number, usagePerPiece: number, lossRate: number): number {
  return roundPmsQty(skuQty * computePlannedUsage(usagePerPiece, lossRate), 2)
}

export function computeMaterialSuggestedQty(bomDemand: number, stockQty: number, purchasingQty: number): number {
  return roundPmsQty(Math.max(0, bomDemand - stockQty - purchasingQty), 2)
}

export const pmsBomTemplates: PmsBomTemplate[] = [
  {
    spu: 'HG-TS-2601',
    productName: '男款圆领T恤',
    styleCode: 'TS-2601',
    imageUrl: PMS_STYLE_IMAGES.tshirt,
    version: 'V3',
    status: '已发布',
    updatedAt: '2026-05-12 10:20:00',
    materials: [
      { materialCode: 'FAB-2026-0001', materialName: '180g 纯棉针织布', materialType: '面料', imageUrl: PMS_MATERIAL_IMAGES.cottonJersey, unit: '米', usagePerPiece: 0.35, lossRate: 0.05, stockQty: 1200, purchasingQty: 600, supplierName: '广州华盛面料有限公司', warehouse: '广州原料仓' },
      { materialCode: 'ACC-2026-0003', materialName: '白色织唛', materialType: '辅料', imageUrl: PMS_MATERIAL_IMAGES.label, unit: '个', usagePerPiece: 1, lossRate: 0, stockQty: 4000, purchasingQty: 2000, supplierName: '东莞宏远辅料有限公司', warehouse: '广州原料仓' },
      { materialCode: 'ACC-2026-0004', materialName: '涤纶缝纫线', materialType: '辅料', imageUrl: PMS_MATERIAL_IMAGES.stitchingYarn, unit: '卷', usagePerPiece: 0.02, lossRate: 0.03, stockQty: 50, purchasingQty: 20, supplierName: '泉州瑞达服装辅料有限公司', warehouse: '广州原料仓' },
      { materialCode: 'PKG-2026-0002', materialName: '40×60cm 透明胶袋', materialType: '包材', imageUrl: PMS_MATERIAL_IMAGES.polyBag, unit: '个', usagePerPiece: 1, lossRate: 0.01, stockQty: 4000, purchasingQty: 2000, supplierName: '深圳优品包材有限公司', warehouse: '广州原料仓' },
    ],
  },
  {
    spu: 'HG-PT-2602',
    productName: '女款休闲裤',
    styleCode: 'PT-2602',
    imageUrl: PMS_STYLE_IMAGES.pants,
    version: 'V2',
    status: '已发布',
    updatedAt: '2026-05-10 15:40:00',
    materials: [
      { materialCode: 'FAB-2026-0002', materialName: '220g 涤棉卫衣布', materialType: '面料', imageUrl: PMS_MATERIAL_IMAGES.fleece, unit: '米', usagePerPiece: 0.88, lossRate: 0.06, stockQty: 900, purchasingQty: 400, supplierName: '绍兴锦达纺织有限公司', warehouse: '广州原料仓' },
      { materialCode: 'ACC-2026-0001', materialName: 'YKK 5号尼龙拉链', materialType: '辅料', imageUrl: PMS_MATERIAL_IMAGES.zipper, unit: '个', usagePerPiece: 1, lossRate: 0.01, stockQty: 3000, purchasingQty: 1500, supplierName: '东莞宏远辅料有限公司', warehouse: '广州原料仓' },
      { materialCode: 'ACC-2026-0002', materialName: '黑色四眼纽扣', materialType: '辅料', imageUrl: PMS_MATERIAL_IMAGES.button, unit: '个', usagePerPiece: 1, lossRate: 0.01, stockQty: 6000, purchasingQty: 3000, supplierName: '东莞宏远辅料有限公司', warehouse: '广州原料仓' },
      { materialCode: 'ACC-2026-0004', materialName: '涤纶缝纫线', materialType: '辅料', imageUrl: PMS_MATERIAL_IMAGES.stitchingYarn, unit: '卷', usagePerPiece: 0.03, lossRate: 0.03, stockQty: 50, purchasingQty: 20, supplierName: '泉州瑞达服装辅料有限公司', warehouse: '广州原料仓' },
    ],
  },
  {
    spu: 'HG-HD-2603',
    productName: '连帽卫衣',
    styleCode: 'HD-2603',
    imageUrl: PMS_STYLE_IMAGES.hoodie,
    version: 'V4',
    status: '已发布',
    updatedAt: '2026-05-15 09:10:00',
    materials: [
      { materialCode: 'FAB-2026-0002', materialName: '220g 涤棉卫衣布', materialType: '面料', imageUrl: PMS_MATERIAL_IMAGES.fleece, unit: '米', usagePerPiece: 1.15, lossRate: 0.07, stockQty: 900, purchasingQty: 400, supplierName: '绍兴锦达纺织有限公司', warehouse: '广州原料仓' },
      { materialCode: 'ACC-2026-0001', materialName: 'YKK 5号尼龙拉链', materialType: '辅料', imageUrl: PMS_MATERIAL_IMAGES.zipper, unit: '个', usagePerPiece: 1, lossRate: 0.01, stockQty: 3000, purchasingQty: 1500, supplierName: '东莞宏远辅料有限公司', warehouse: '广州原料仓' },
      { materialCode: 'ACC-2026-0003', materialName: '白色织唛', materialType: '辅料', imageUrl: PMS_MATERIAL_IMAGES.label, unit: '个', usagePerPiece: 2, lossRate: 0, stockQty: 4000, purchasingQty: 2000, supplierName: '东莞宏远辅料有限公司', warehouse: '广州原料仓' },
      { materialCode: 'ACC-2026-0004', materialName: '涤纶缝纫线', materialType: '辅料', imageUrl: PMS_MATERIAL_IMAGES.stitchingYarn, unit: '卷', usagePerPiece: 0.04, lossRate: 0.03, stockQty: 50, purchasingQty: 20, supplierName: '泉州瑞达服装辅料有限公司', warehouse: '广州原料仓' },
    ],
  },
  {
    spu: 'HG-JK-2605',
    productName: '轻薄夹克',
    styleCode: 'JK-2605',
    imageUrl: PMS_STYLE_IMAGES.jacket,
    version: 'V1',
    status: '未匹配',
    updatedAt: '2026-04-28 11:30:00',
    materials: [
      { materialCode: 'FAB-2026-0002', materialName: '220g 涤棉卫衣布', materialType: '面料', imageUrl: PMS_MATERIAL_IMAGES.fleece, unit: '米', usagePerPiece: 1.4, lossRate: 0.06, stockQty: 900, purchasingQty: 400, supplierName: '绍兴锦达纺织有限公司', warehouse: '广州原料仓' },
      { materialCode: 'ACC-2026-0001', materialName: 'YKK 5号尼龙拉链', materialType: '辅料', imageUrl: PMS_MATERIAL_IMAGES.zipper, unit: '个', usagePerPiece: 1, lossRate: 0.01, stockQty: 3000, purchasingQty: 1500, supplierName: '东莞宏远辅料有限公司', warehouse: '广州原料仓' },
    ],
  },
  {
    spu: 'HG-SH-2607',
    productName: '商务衬衫',
    styleCode: 'SH-2607',
    imageUrl: PMS_STYLE_IMAGES.shirt,
    version: 'V2',
    status: '已发布',
    updatedAt: '2026-05-09 14:00:00',
    materials: [
      { materialCode: 'FAB-2026-0001', materialName: '180g 纯棉针织布', materialType: '面料', imageUrl: PMS_MATERIAL_IMAGES.cottonJersey, unit: '米', usagePerPiece: 1.6, lossRate: 0.05, stockQty: 1200, purchasingQty: 600, supplierName: '广州华盛面料有限公司', warehouse: '广州原料仓' },
      { materialCode: 'ACC-2026-0002', materialName: '黑色四眼纽扣', materialType: '辅料', imageUrl: PMS_MATERIAL_IMAGES.button, unit: '个', usagePerPiece: 7, lossRate: 0.02, stockQty: 6000, purchasingQty: 3000, supplierName: '东莞宏远辅料有限公司', warehouse: '广州原料仓' },
      { materialCode: 'ACC-2026-0004', materialName: '涤纶缝纫线', materialType: '辅料', imageUrl: PMS_MATERIAL_IMAGES.stitchingYarn, unit: '卷', usagePerPiece: 0.03, lossRate: 0.03, stockQty: 50, purchasingQty: 20, supplierName: '泉州瑞达服装辅料有限公司', warehouse: '广州原料仓' },
      { materialCode: 'ACC-2026-0003', materialName: '白色织唛', materialType: '辅料', imageUrl: PMS_MATERIAL_IMAGES.label, unit: '个', usagePerPiece: 2, lossRate: 0.01, stockQty: 4000, purchasingQty: 2000, supplierName: '东莞宏远辅料有限公司', warehouse: '广州原料仓' },
    ],
  },
  {
    spu: 'HG-SK-2604',
    productName: '女款连衣裙',
    styleCode: 'SK-2604',
    imageUrl: PMS_STYLE_IMAGES.dress,
    version: 'V2',
    status: '已发布',
    updatedAt: '2026-05-18 16:20:00',
    materials: [
      { materialCode: 'FAB-2026-0001', materialName: '180g 纯棉针织布', materialType: '面料', imageUrl: PMS_MATERIAL_IMAGES.cottonJersey, unit: '米', usagePerPiece: 1.8, lossRate: 0.06, stockQty: 1200, purchasingQty: 600, supplierName: '广州华盛面料有限公司', warehouse: '广州原料仓' },
      { materialCode: 'ACC-2026-0001', materialName: 'YKK 5号尼龙拉链', materialType: '辅料', imageUrl: PMS_MATERIAL_IMAGES.zipper, unit: '个', usagePerPiece: 1, lossRate: 0.01, stockQty: 3000, purchasingQty: 1500, supplierName: '东莞宏远辅料有限公司', warehouse: '广州原料仓' },
      { materialCode: 'ACC-2026-0003', materialName: '白色织唛', materialType: '辅料', imageUrl: PMS_MATERIAL_IMAGES.label, unit: '个', usagePerPiece: 1, lossRate: 0, stockQty: 4000, purchasingQty: 2000, supplierName: '东莞宏远辅料有限公司', warehouse: '广州原料仓' },
      { materialCode: 'ACC-2026-0004', materialName: '涤纶缝纫线', materialType: '辅料', imageUrl: PMS_MATERIAL_IMAGES.stitchingYarn, unit: '卷', usagePerPiece: 0.04, lossRate: 0.03, stockQty: 50, purchasingQty: 20, supplierName: '泉州瑞达服装辅料有限公司', warehouse: '广州原料仓' },
    ],
  },
  {
    spu: 'HG-GAR-2601',
    productName: '女款休闲裤成衣',
    styleCode: 'GAR-2601',
    imageUrl: PMS_STYLE_IMAGES.pants,
    version: 'V1',
    status: '已发布',
    updatedAt: '2026-05-02 09:40:00',
    materials: [],
  },
  {
    spu: 'HG-SAM-2601',
    productName: '男款圆领T恤样衣',
    styleCode: 'SAM-2601',
    imageUrl: PMS_STYLE_IMAGES.tshirt,
    version: 'V1',
    status: '已发布',
    updatedAt: '2026-05-02 09:50:00',
    materials: [],
  },
]

export function listPmsBomTemplates(): PmsBomTemplate[] {
  return pmsBomTemplates
}

export function getPmsBomTemplate(spu: string): PmsBomTemplate | undefined {
  return pmsBomTemplates.find((template) => template.spu === spu)
}

export function updatePmsBomMaterialUsage(
  spu: string,
  materialCode: string,
  patch: { usagePerPiece?: number; lossRate?: number },
  actor: { id: string; name: string; role: '采购员' | '采购主管' | '财务' | '系统' },
): PmsBomTemplate {
  const template = getPmsBomTemplate(spu)
  if (!template) throw new Error(`BOM 模板 ${spu} 不存在`)
  if (template.status === '未匹配') throw new Error('BOM 未匹配，不能修改物料用量')
  const line = template.materials.find((material) => material.materialCode === materialCode)
  if (!line) throw new Error(`物料 ${materialCode} 不在该 BOM 中`)
  if (patch.usagePerPiece !== undefined) {
    if (!Number.isFinite(patch.usagePerPiece) || patch.usagePerPiece <= 0) throw new Error('单件用量必须大于 0')
    line.usagePerPiece = patch.usagePerPiece
  }
  if (patch.lossRate !== undefined) {
    if (!Number.isFinite(patch.lossRate) || patch.lossRate < 0 || patch.lossRate > 1) throw new Error('损耗率必须在 0 到 1 之间')
    line.lossRate = patch.lossRate
  }
  template.updatedAt = new Date().toISOString()
  appendBomLog(spu, '修改物料用量', `${materialCode} 用量 ${line.usagePerPiece} · 损耗 ${(line.lossRate * 100).toFixed(0)}%`, actor)
  return template
}

export function publishPmsBomTemplate(spu: string, actor: { id: string; name: string; role: '采购员' | '采购主管' | '财务' | '系统' }): PmsBomTemplate {
  const template = getPmsBomTemplate(spu)
  if (!template) throw new Error(`BOM 模板 ${spu} 不存在`)
  if (template.status === '已发布') return template
  if (template.materials.length === 0) throw new Error('BOM 没有物料明细，不能发布')
  template.status = '已发布'
  template.updatedAt = new Date().toISOString()
  appendBomLog(spu, '发布 BOM', '未匹配 → 已发布', actor)
  return template
}

function appendBomLog(spu: string, action: string, detail: string, actor: { id: string; name: string; role: '采购员' | '采购主管' | '财务' | '系统' }): void {
  bomLogs.unshift({
    spu,
    action,
    detail,
    actorName: actor.name,
    actorRole: actor.role,
    occurredAt: new Date().toISOString(),
  })
}

export interface PmsBomLog {
  spu: string
  action: string
  detail: string
  actorName: string
  actorRole: string
  occurredAt: string
}

const bomLogs: PmsBomLog[] = []

export function listPmsBomLogs(spu: string): PmsBomLog[] {
  return bomLogs.filter((log) => log.spu === spu)
}
