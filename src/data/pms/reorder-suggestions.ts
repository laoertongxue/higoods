import { PMS_STYLE_IMAGES } from './images.ts'
import { PmsDomainError } from './runtime.ts'

/**
 * 备货参考列表(原型 mock,跟随 manage.higood.ai /pms/reorder/index)。
 * 仅做内存态,业务规则按 SPU 维度记录翻单/采购/库存/销量等备货参考数据。
 */

export type PmsReorderRestockMark = '已标记' | '未标记'

export interface PmsReorderSuggestion {
  spu: string
  productName: string
  imageUrl: string
  restockCount: number
  restockMarked: PmsReorderRestockMark
  markedAt: string
  purchasingQty: number
  auditQty: number
  stockQty: number
  pendingDeliveryAndPackQty: number
  regularRestockQty: number
  suggestedRestockQty: number
  totalSales: number
  recent3DaySales: number
  recent5DaySales: number
  recent7DaySales: number
  remark: string
}

interface ReorderRuntime {
  suggestions: PmsReorderSuggestion[]
}

function getRuntime(): ReorderRuntime {
  return reorderRuntime
}

const reorderRuntime: ReorderRuntime = {
  suggestions: [
    {
      spu: 'ASYZZ26072909',
      productName: '80-Printed Blouse-39-55印花上衣',
      imageUrl: PMS_STYLE_IMAGES.shirt,
      restockCount: 1,
      restockMarked: '已标记',
      markedAt: '2026-10-08 10:30:00',
      purchasingQty: 1,
      auditQty: 0,
      stockQty: 0,
      pendingDeliveryAndPackQty: 3691,
      regularRestockQty: 0,
      suggestedRestockQty: 0,
      totalSales: 8613,
      recent3DaySales: 417,
      recent5DaySales: 771,
      recent7DaySales: 963,
      remark: '',
    },
    {
      spu: 'CHCXX26080306',
      productName: '49-Classic Top-18-30穆斯林设计上衣',
      imageUrl: PMS_STYLE_IMAGES.shirt,
      restockCount: 1,
      restockMarked: '已标记',
      markedAt: '2026-10-08 10:30:00',
      purchasingQty: 2,
      auditQty: 0,
      stockQty: 0,
      pendingDeliveryAndPackQty: 3915,
      regularRestockQty: 0,
      suggestedRestockQty: 0,
      totalSales: 4002,
      recent3DaySales: 238,
      recent5DaySales: 358,
      recent7DaySales: 560,
      remark: '',
    },
    {
      spu: 'CHCKL26072140',
      productName: '1-Casul Shirt-18-30休闲衬衫',
      imageUrl: PMS_STYLE_IMAGES.shirt,
      restockCount: 5,
      restockMarked: '已标记',
      markedAt: '2026-10-09 09:15:00',
      purchasingQty: 71,
      auditQty: 0,
      stockQty: 0,
      pendingDeliveryAndPackQty: 523,
      regularRestockQty: 0,
      suggestedRestockQty: 0,
      totalSales: 10249,
      recent3DaySales: 228,
      recent5DaySales: 313,
      recent7DaySales: 397,
      remark: '',
    },
    {
      spu: 'CHCMY26062204',
      productName: '48-Casul Shirt-30-45宽松衬衫',
      imageUrl: PMS_STYLE_IMAGES.shirt,
      restockCount: 9,
      restockMarked: '已标记',
      markedAt: '2026-10-09 09:15:00',
      purchasingQty: 4171,
      auditQty: 0,
      stockQty: 0,
      pendingDeliveryAndPackQty: 2467,
      regularRestockQty: 0,
      suggestedRestockQty: 1704,
      totalSales: 9245,
      recent3DaySales: 201,
      recent5DaySales: 275,
      recent7DaySales: 360,
      remark: '',
    },
    {
      spu: 'ASYZZ26033020',
      productName: '76-simple pants-18-35简约裤子',
      imageUrl: PMS_STYLE_IMAGES.pants,
      restockCount: 2,
      restockMarked: '已标记',
      markedAt: '2026-10-08 10:30:00',
      purchasingQty: 36,
      auditQty: 0,
      stockQty: 0,
      pendingDeliveryAndPackQty: 393,
      regularRestockQty: 0,
      suggestedRestockQty: 0,
      totalSales: 2580,
      recent3DaySales: 75,
      recent5DaySales: 123,
      recent7DaySales: 222,
      remark: '',
    },
    {
      spu: 'FADUU26070826',
      productName: '53-print shirt-45-60印花衬衫',
      imageUrl: PMS_STYLE_IMAGES.shirt,
      restockCount: 2,
      restockMarked: '已标记',
      markedAt: '2026-10-09 09:15:00',
      purchasingQty: 107,
      auditQty: 0,
      stockQty: 0,
      pendingDeliveryAndPackQty: 286,
      regularRestockQty: 0,
      suggestedRestockQty: 0,
      totalSales: 1833,
      recent3DaySales: 52,
      recent5DaySales: 78,
      recent7DaySales: 100,
      remark: '',
    },
    {
      spu: 'ASYZC26070302',
      productName: '72-Classic Top-18-35纯色上衣',
      imageUrl: PMS_STYLE_IMAGES.shirt,
      restockCount: 1,
      restockMarked: '已标记',
      markedAt: '2026-10-09 09:15:00',
      purchasingQty: 63,
      auditQty: 0,
      stockQty: 0,
      pendingDeliveryAndPackQty: 40,
      regularRestockQty: 0,
      suggestedRestockQty: 23,
      totalSales: 1525,
      recent3DaySales: 12,
      recent5DaySales: 15,
      recent7DaySales: 21,
      remark: '',
    },
    {
      spu: 'FADUU26061807',
      productName: '140-knitted tops-25-35针织上衣',
      imageUrl: PMS_STYLE_IMAGES.shirt,
      restockCount: 7,
      restockMarked: '已标记',
      markedAt: '2026-10-10 11:00:00',
      purchasingQty: 1955,
      auditQty: 0,
      stockQty: 0,
      pendingDeliveryAndPackQty: 22,
      regularRestockQty: 0,
      suggestedRestockQty: 1933,
      totalSales: 549,
      recent3DaySales: 10,
      recent5DaySales: 21,
      recent7DaySales: 32,
      remark: '',
    },
    {
      spu: 'FADAH25120820',
      productName: '100-Dress-30-45复古连衣裙',
      imageUrl: PMS_STYLE_IMAGES.dress,
      restockCount: 38,
      restockMarked: '已标记',
      markedAt: '2026-10-05 14:20:00',
      purchasingQty: 2793,
      auditQty: 0,
      stockQty: 0,
      pendingDeliveryAndPackQty: 2028,
      regularRestockQty: 0,
      suggestedRestockQty: 765,
      totalSales: 10147,
      recent3DaySales: 765,
      recent5DaySales: 964,
      recent7DaySales: 1119,
      remark: '',
    },
    {
      spu: 'TENQU25093001',
      productName: '10-print shirt-45-60印花衬衫',
      imageUrl: PMS_STYLE_IMAGES.shirt,
      restockCount: 44,
      restockMarked: '已标记',
      markedAt: '2026-10-05 14:20:00',
      purchasingQty: 3,
      auditQty: 0,
      stockQty: 0,
      pendingDeliveryAndPackQty: 9383,
      regularRestockQty: 0,
      suggestedRestockQty: 0,
      totalSales: 13818,
      recent3DaySales: 507,
      recent5DaySales: 821,
      recent7DaySales: 1127,
      remark: '',
    },
    {
      spu: 'FADSS25121719',
      productName: '20-Korean Set-30-45韩系套装',
      imageUrl: PMS_STYLE_IMAGES.dress,
      restockCount: 20,
      restockMarked: '已标记',
      markedAt: '2026-10-06 16:40:00',
      purchasingQty: 1497,
      auditQty: 0,
      stockQty: 0,
      pendingDeliveryAndPackQty: 2687,
      regularRestockQty: 0,
      suggestedRestockQty: 0,
      totalSales: 6780,
      recent3DaySales: 327,
      recent5DaySales: 621,
      recent7DaySales: 888,
      remark: '',
    },
    {
      spu: 'CHCKL25062602',
      productName: '4-Short Sleeve Top-18-35短袖上衣',
      imageUrl: PMS_STYLE_IMAGES.shirt,
      restockCount: 30,
      restockMarked: '已标记',
      markedAt: '2026-10-04 09:50:00',
      purchasingQty: 1217,
      auditQty: 0,
      stockQty: 0,
      pendingDeliveryAndPackQty: 605,
      regularRestockQty: 0,
      suggestedRestockQty: 612,
      totalSales: 5422,
      recent3DaySales: 102,
      recent5DaySales: 129,
      recent7DaySales: 157,
      remark: '',
    },
  ],
}

export function listPmsReorderSuggestions(): PmsReorderSuggestion[] {
  return getRuntime().suggestions.slice()
}

export function getPmsReorderSuggestion(spu: string): PmsReorderSuggestion | undefined {
  return getRuntime().suggestions.find((s) => s.spu === spu)
}

export interface PmsReorderFilter {
  spu?: string
  restockMarked?: '' | PmsReorderRestockMark
  recent3DaySalesAtLeast?: number
  recent5DaySalesAtLeast?: number
  stockQtyAtMost?: number
  sortBy?: 'restockCount' | 'recent3DaySales' | 'recent7DaySales' | 'totalSales'
}

export function filterPmsReorderSuggestions(filter: PmsReorderFilter): PmsReorderSuggestion[] {
  const all = listPmsReorderSuggestions()
  const result = all.filter((row) => {
    if (filter.spu && !row.spu.toLowerCase().includes(filter.spu.toLowerCase())) return false
    if (filter.restockMarked && row.restockMarked !== filter.restockMarked) return false
    if (filter.recent3DaySalesAtLeast !== undefined && row.recent3DaySales < filter.recent3DaySalesAtLeast) return false
    if (filter.recent5DaySalesAtLeast !== undefined && row.recent5DaySales < filter.recent5DaySalesAtLeast) return false
    if (filter.stockQtyAtMost !== undefined && row.stockQty > filter.stockQtyAtMost) return false
    return true
  })
  if (filter.sortBy) {
    const key = filter.sortBy
    result.sort((a, b) => b[key] - a[key])
  }
  return result
}

export function totalPmsReorderRestockQty(): number {
  return listPmsReorderSuggestions().reduce((sum, row) => sum + row.regularRestockQty, 0)
}

export function updatePmsReorderMark(spu: string, mark: PmsReorderRestockMark): PmsReorderSuggestion {
  const row = getPmsReorderSuggestion(spu)
  if (!row) throw new PmsDomainError('PMS_REORDER_NOT_FOUND', `备货参考 ${spu} 不存在`)
  row.restockMarked = mark
  row.markedAt = mark === '已标记' ? new Date().toISOString() : ''
  if (mark === '已标记') row.restockCount += 1
  return row
}

export function updatePmsReorderRegularQty(spu: string, regularQty: number): PmsReorderSuggestion {
  if (!Number.isFinite(regularQty) || regularQty < 0) {
    throw new PmsDomainError('PMS_REORDER_INVALID_QTY', `常备数量 ${regularQty} 不合法`)
  }
  const row = getPmsReorderSuggestion(spu)
  if (!row) throw new PmsDomainError('PMS_REORDER_NOT_FOUND', `备货参考 ${spu} 不存在`)
  row.regularRestockQty = Math.round(regularQty)
  return row
}

export interface PmsReorderActInput {
  spu: string
  actorName?: string
  remark?: string
}

export function actPmsReorder(input: PmsReorderActInput): PmsReorderSuggestion {
  const row = getPmsReorderSuggestion(input.spu)
  if (!row) throw new PmsDomainError('PMS_REORDER_NOT_FOUND', `备货参考 ${input.spu} 不存在`)
  if (row.restockMarked !== '已标记') {
    throw new PmsDomainError('PMS_REORDER_NOT_MARKED', `备货参考 ${input.spu} 未标记`)
  }
  // 备货动作:写入备注/触发下游生成商品采购单(原型仅标记 + 留痕,真实生成由 manage.higood.ai 处理)
  row.remark = input.remark ?? row.remark
  return row
}
