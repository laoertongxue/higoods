/**
 * KOL 库存(原型 mock,跟随 manage.higood.ai /pms/kol_sample_stock/index)。
 *
 * mock 字段:商品信息(SPU/SKU/名称/图片)、品牌、商品定位(低价/低价改款/设计款等)、
 * KOL 库存数量、VKOL 当日手动锁定池、锁定已占用、操作(释放)。
 * 操作:批量锁定、批量释放、单条释放 — 仅为内存模拟,刷新页面回到初始状态。
 */
import { PMS_STYLE_IMAGES } from './images.ts'
import { PmsDomainError } from './runtime.ts'

export type PmsKolBrand = '全部' | 'Asaya' | 'Chicmore' | 'FADFAD' | 'Tendblank' | 'LUXME' | 'MODISH' | 'PRIMA'
export type PmsKolPositioning =
  | '低价'
  | '低价改款'
  | '设计款'
  | '基础款'
  | '主推款'
  | '形象款'
  | '联名款'
  | '专题款'
  | '其他'

export const PmsKolBrandList: PmsKolBrand[] = ['全部', 'Asaya', 'Chicmore', 'FADFAD', 'Tendblank', 'LUXME', 'MODISH', 'PRIMA']
export const PmsKolPositioningList: PmsKolPositioning[] = ['低价', '低价改款', '设计款', '基础款', '主推款', '形象款', '联名款', '专题款', '其他']

export interface PmsKolStockRow {
  sku: string
  spu: string
  productName: string
  imageUrl: string
  brand: Exclude<PmsKolBrand, '全部'>
  positioning: PmsKolPositioning
  kolStock: number
  vkolManualLockedPool: number
  lockedOccupied: number
}

interface KolStockRuntime {
  rows: PmsKolStockRow[]
}

function getRuntime(): KolStockRuntime {
  return kolStockRuntime
}

const kolStockRuntime: KolStockRuntime = {
  rows: [
    {
      sku: 'ASYXL112988-sameasphoto-onesize',
      spu: 'ASYXL112988',
      productName: 'SameAsPhoto/OneSize',
      imageUrl: PMS_STYLE_IMAGES.shirt,
      brand: 'Asaya',
      positioning: '低价改款',
      kolStock: 291,
      vkolManualLockedPool: 0,
      lockedOccupied: 0,
    },
    {
      sku: 'ASYXL102288-sameasphoto-onesize',
      spu: 'ASYXL102288',
      productName: 'SameAsPhoto/OneSize',
      imageUrl: PMS_STYLE_IMAGES.shirt,
      brand: 'Asaya',
      positioning: '低价改款',
      kolStock: 241,
      vkolManualLockedPool: 0,
      lockedOccupied: 0,
    },
    {
      sku: 'ASYUU26071001-sameasphoto-l',
      spu: 'ASYUU26071001',
      productName: 'SameAsPhoto/L',
      imageUrl: PMS_STYLE_IMAGES.shirt,
      brand: 'Asaya',
      positioning: '低价',
      kolStock: 190,
      vkolManualLockedPool: 0,
      lockedOccupied: 0,
    },
    {
      sku: 'ASYZZ26063045-sameasphoto-onesize',
      spu: 'ASYZZ26063045',
      productName: 'SameAsPhoto/OneSize',
      imageUrl: PMS_STYLE_IMAGES.tshirt,
      brand: 'Asaya',
      positioning: '低价',
      kolStock: 190,
      vkolManualLockedPool: 0,
      lockedOccupied: 0,
    },
    {
      sku: 'ASYYC7226-coffee-m',
      spu: 'ASYYC7226',
      productName: 'Coffee/M',
      imageUrl: PMS_STYLE_IMAGES.shirt,
      brand: 'Asaya',
      positioning: '低价改款',
      kolStock: 180,
      vkolManualLockedPool: 0,
      lockedOccupied: 0,
    },
    {
      sku: 'ASYSA26060626-black-xl',
      spu: 'ASYSA26060626',
      productName: 'Black/XL',
      imageUrl: PMS_STYLE_IMAGES.shirt,
      brand: 'Asaya',
      positioning: '低价',
      kolStock: 176,
      vkolManualLockedPool: 0,
      lockedOccupied: 0,
    },
    {
      sku: 'ASYQU26070214-sameasphoto-m',
      spu: 'ASYQU26070214',
      productName: 'SameAsPhoto/M',
      imageUrl: PMS_STYLE_IMAGES.tshirt,
      brand: 'Asaya',
      positioning: '低价',
      kolStock: 168,
      vkolManualLockedPool: 0,
      lockedOccupied: 0,
    },
    {
      sku: 'ASYQU26070221-sameasphoto-l',
      spu: 'ASYQU26070221',
      productName: 'SameAsPhoto/L',
      imageUrl: PMS_STYLE_IMAGES.tshirt,
      brand: 'Asaya',
      positioning: '低价',
      kolStock: 155,
      vkolManualLockedPool: 0,
      lockedOccupied: 0,
    },
    {
      sku: 'ASYQU26070214-sameasphoto-l',
      spu: 'ASYQU26070214',
      productName: 'SameAsPhoto/L',
      imageUrl: PMS_STYLE_IMAGES.tshirt,
      brand: 'Asaya',
      positioning: '低价',
      kolStock: 145,
      vkolManualLockedPool: 0,
      lockedOccupied: 0,
    },
    {
      sku: 'ASYUU25062008-apricot-l',
      spu: 'ASYUU25062008',
      productName: 'Apricot/L',
      imageUrl: PMS_STYLE_IMAGES.shirt,
      brand: 'Asaya',
      positioning: '低价',
      kolStock: 145,
      vkolManualLockedPool: 0,
      lockedOccupied: 0,
    },
    {
      sku: 'ASYQU26070102-gray-m',
      spu: 'ASYQU26070102',
      productName: 'Gray/M',
      imageUrl: PMS_STYLE_IMAGES.tshirt,
      brand: 'Asaya',
      positioning: '低价',
      kolStock: 144,
      vkolManualLockedPool: 0,
      lockedOccupied: 0,
    },
    {
      sku: 'BTSZIDXX24061313-sameasphoto-s',
      spu: 'BTSZIDXX24061313',
      productName: 'SameAsPhoto/S',
      imageUrl: PMS_STYLE_IMAGES.dress,
      brand: 'Chicmore',
      positioning: '设计款',
      kolStock: 139,
      vkolManualLockedPool: 0,
      lockedOccupied: 0,
    },
    {
      sku: 'ASYZC26061905-brown-l',
      spu: 'ASYZC26061905',
      productName: 'Brown/L',
      imageUrl: PMS_STYLE_IMAGES.dress,
      brand: 'Asaya',
      positioning: '低价改款',
      kolStock: 137,
      vkolManualLockedPool: 0,
      lockedOccupied: 0,
    },
    {
      sku: 'ASYUU25061369-pink-l',
      spu: 'ASYUU25061369',
      productName: 'Pink/L',
      imageUrl: PMS_STYLE_IMAGES.shirt,
      brand: 'Asaya',
      positioning: '低价改款',
      kolStock: 129,
      vkolManualLockedPool: 0,
      lockedOccupied: 0,
    },
    {
      sku: 'ASYYC7226-apricot-l',
      spu: 'ASYYC7226',
      productName: 'Apricot/L',
      imageUrl: PMS_STYLE_IMAGES.shirt,
      brand: 'Asaya',
      positioning: '低价改款',
      kolStock: 125,
      vkolManualLockedPool: 0,
      lockedOccupied: 0,
    },
    {
      sku: 'FADYY25100821-sameasphoto-l',
      spu: 'FADYY25100821',
      productName: 'SameAsPhoto/L',
      imageUrl: PMS_STYLE_IMAGES.cardigan,
      brand: 'FADFAD',
      positioning: '设计款',
      kolStock: 124,
      vkolManualLockedPool: 0,
      lockedOccupied: 0,
    },
    {
      sku: 'ASYYC9167-khaki-m',
      spu: 'ASYYC9167',
      productName: 'Khaki/M',
      imageUrl: PMS_STYLE_IMAGES.shirt,
      brand: 'Asaya',
      positioning: '低价改款',
      kolStock: 118,
      vkolManualLockedPool: 0,
      lockedOccupied: 0,
    },
    {
      sku: 'ASYUU25052102-apricot-xl',
      spu: 'ASYUU25052102',
      productName: 'Apricot/XL',
      imageUrl: PMS_STYLE_IMAGES.shirt,
      brand: 'Asaya',
      positioning: '低价改款',
      kolStock: 115,
      vkolManualLockedPool: 0,
      lockedOccupied: 0,
    },
    {
      sku: 'ASYXL110799-sameasphoto-onesize',
      spu: 'ASYXL110799',
      productName: 'SameAsPhoto/OneSize',
      imageUrl: PMS_STYLE_IMAGES.shirt,
      brand: 'Asaya',
      positioning: '低价改款',
      kolStock: 115,
      vkolManualLockedPool: 0,
      lockedOccupied: 0,
    },
    {
      sku: 'FADSA26012303-black-2xl',
      spu: 'FADSA26012303',
      productName: 'Black/2XL',
      imageUrl: PMS_STYLE_IMAGES.cardigan,
      brand: 'FADFAD',
      positioning: '设计款',
      kolStock: 115,
      vkolManualLockedPool: 0,
      lockedOccupied: 0,
    },
  ],
}

export interface PmsKolStockFilter {
  search?: string
  brand?: '' | PmsKolBrand
  positioning?: '' | PmsKolPositioning
  stockAtLeast?: number
  stockAtMost?: number
  lockedStatus?: '' | '全部SKU' | '有锁定'
}

export function listPmsKolStock(): PmsKolStockRow[] {
  return getRuntime().rows.slice()
}

export function filterPmsKolStock(filter: PmsKolStockFilter): PmsKolStockRow[] {
  const search = filter.search?.trim().toLowerCase() ?? ''
  return getRuntime().rows.filter((row) => {
    if (search) {
      const candidates = [row.sku, row.spu, row.productName].join(' ').toLowerCase()
      if (!candidates.includes(search)) return false
    }
    if (filter.brand && filter.brand !== '全部' && row.brand !== filter.brand) return false
    if (filter.positioning && row.positioning !== filter.positioning) return false
    if (filter.stockAtLeast !== undefined && row.kolStock < filter.stockAtLeast) return false
    if (filter.stockAtMost !== undefined && row.kolStock > filter.stockAtMost) return false
    if (filter.lockedStatus === '全部SKU') {
      // no-op
    } else if (filter.lockedStatus === '有锁定') {
      if (row.vkolManualLockedPool <= 0 && row.lockedOccupied <= 0) return false
    }
    return true
  })
}

export interface PmsKolStockStats {
  totalSkus: number
  totalKolStock: number
  totalVkolManualLockedPool: number
  totalLockedOccupied: number
}

export function summarizePmsKolStock(filter: PmsKolStockFilter): PmsKolStockStats {
  const rows = filterPmsKolStock(filter)
  return rows.reduce<PmsKolStockStats>(
    (acc, row) => ({
      totalSkus: acc.totalSkus + 1,
      totalKolStock: acc.totalKolStock + row.kolStock,
      totalVkolManualLockedPool: acc.totalVkolManualLockedPool + row.vkolManualLockedPool,
      totalLockedOccupied: acc.totalLockedOccupied + row.lockedOccupied,
    }),
    { totalSkus: 0, totalKolStock: 0, totalVkolManualLockedPool: 0, totalLockedOccupied: 0 },
  )
}

export function getPmsKolStockRow(sku: string): PmsKolStockRow | undefined {
  return getRuntime().rows.find((row) => row.sku === sku)
}

export interface ReleasePmsKolLockResult {
  released: number
  failedSkus: string[]
}

export function releasePmsKolLock(skus: string[]): ReleasePmsKolLockResult {
  const failed: string[] = []
  let released = 0
  for (const sku of skus) {
    const row = getPmsKolStockRow(sku)
    if (!row) {
      failed.push(sku)
      continue
    }
    if (row.vkolManualLockedPool <= 0 && row.lockedOccupied <= 0) continue
    released += row.vkolManualLockedPool
    row.vkolManualLockedPool = 0
    row.lockedOccupied = 0
  }
  return { released, failedSkus: failed }
}

export interface LockPmsKolStockResult {
  locked: Array<{ sku: string; qty: number }>
  insufficient: Array<{ sku: string; requested: number; available: number }>
}

export function lockPmsKolStockBatch(entries: Array<{ sku: string; qty: number }>): LockPmsKolStockResult {
  const locked: LockPmsKolStockResult['locked'] = []
  const insufficient: LockPmsKolStockResult['insufficient'] = []
  for (const entry of entries) {
    const row = getPmsKolStockRow(entry.sku)
    if (!row) {
      insufficient.push({ sku: entry.sku, requested: entry.qty, available: 0 })
      continue
    }
    const available = row.kolStock - row.vkolManualLockedPool - row.lockedOccupied
    if (entry.qty > available) {
      insufficient.push({ sku: entry.sku, requested: entry.qty, available })
      continue
    }
    row.vkolManualLockedPool += entry.qty
    locked.push({ sku: entry.sku, qty: entry.qty })
  }
  return { locked, insufficient }
}

export interface CreateKolLinkResult {
  linkCode: string
  url: string
}

export function generatePmsKolLinkCode(): CreateKolLinkResult {
  const code = `${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 10)}`
  return { linkCode: code, url: `https://manage.higood.ai/kol_sample/${code}` }
}

export class PmsKolStockEmptySelectionError extends PmsDomainError {
  constructor() {
    super('PMS_KOL_STOCK_EMPTY_SELECTION', '请先选择要操作的 SKU')
  }
}

export class PmsKolStockInvalidSkuError extends PmsDomainError {
  constructor(sku: string) {
    super('PMS_KOL_STOCK_INVALID_SKU', `SKU ${sku} 不存在`)
  }
}
