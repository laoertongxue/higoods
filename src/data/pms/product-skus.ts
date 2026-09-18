import { PMS_STYLE_IMAGES } from './images.ts'

export type PmsSkuKind = 'garment' | 'sample'
export type PmsSkuStatus = '在售' | '已下架' | '开发中'

export interface PmsProductSkuItem {
  sku: string
  color: string
  size: string
  standardPrice: number
  stockQty: number
  status: PmsSkuStatus
}

export interface PmsProductSkuRow {
  kind: PmsSkuKind
  spu: string
  styleCode: string
  productName: string
  imageUrl: string
  category: string
  season: string
  source: 'PCS 同步' | '样衣开发'
  status: PmsSkuStatus
  updatedAt: string
  skuItems: PmsProductSkuItem[]
}

function sku(spu: string, color: string, size: string, standardPrice: number, stockQty: number, status: PmsSkuStatus = '在售'): PmsProductSkuItem {
  return { sku: `${spu}-${color}-${size}`, color, size, standardPrice, stockQty, status }
}

const rows: PmsProductSkuRow[] = [
  {
    kind: 'garment', spu: 'HG-TS-2601', styleCode: 'TS-2601', productName: '男款圆领T恤', imageUrl: PMS_STYLE_IMAGES.tshirt, category: 'T恤', season: '2026 春夏', source: 'PCS 同步', status: '在售', updatedAt: '2026-05-18 10:00:00',
    skuItems: [sku('HG-TS-2601', 'WH', 'M', 31.5, 1800), sku('HG-TS-2601', 'WH', 'L', 31.5, 2100), sku('HG-TS-2601', 'BK', 'M', 32.2, 1600), sku('HG-TS-2601', 'BK', 'L', 32.2, 1500)],
  },
  {
    kind: 'garment', spu: 'HG-PT-2602', styleCode: 'PT-2602', productName: '女款休闲裤', imageUrl: PMS_STYLE_IMAGES.pants, category: '休闲裤', season: '2026 春夏', source: 'PCS 同步', status: '在售', updatedAt: '2026-05-17 10:00:00',
    skuItems: [sku('HG-PT-2602', 'BK', 'S', 58.6, 900), sku('HG-PT-2602', 'BK', 'M', 58.6, 1200), sku('HG-PT-2602', 'BK', 'L', 58.6, 800)],
  },
  {
    kind: 'garment', spu: 'HG-HD-2603', styleCode: 'HD-2603', productName: '连帽卫衣', imageUrl: PMS_STYLE_IMAGES.hoodie, category: '卫衣', season: '2026 秋冬', source: 'PCS 同步', status: '在售', updatedAt: '2026-05-21 09:30:00',
    skuItems: [sku('HG-HD-2603', 'GY', 'M', 86.2, 600), sku('HG-HD-2603', 'GY', 'L', 86.2, 700), sku('HG-HD-2603', 'NV', 'M', 87.5, 500), sku('HG-HD-2603', 'NV', 'L', 87.5, 550)],
  },
  {
    kind: 'garment', spu: 'HG-JK-2605', styleCode: 'JK-2605', productName: '轻薄夹克', imageUrl: PMS_STYLE_IMAGES.jacket, category: '夹克', season: '2026 秋冬', source: 'PCS 同步', status: '在售', updatedAt: '2026-05-16 15:00:00',
    skuItems: [sku('HG-JK-2605', 'KH', 'M', 112, 400), sku('HG-JK-2605', 'KH', 'L', 112, 420), sku('HG-JK-2605', 'BK', 'L', 116, 380)],
  },
  {
    kind: 'garment', spu: 'HG-SH-2607', styleCode: 'SH-2607', productName: '商务衬衫', imageUrl: PMS_STYLE_IMAGES.shirt, category: '衬衫', season: '2026 春夏', source: 'PCS 同步', status: '在售', updatedAt: '2026-05-20 14:00:00',
    skuItems: [sku('HG-SH-2607', 'WH', 'M', 49, 500), sku('HG-SH-2607', 'WH', 'L', 49, 450)],
  },
  {
    kind: 'garment', spu: 'HG-SK-2604', styleCode: 'SK-2604', productName: '女款连衣裙', imageUrl: PMS_STYLE_IMAGES.dress, category: '连衣裙', season: '2026 春夏', source: 'PCS 同步', status: '在售', updatedAt: '2026-05-19 11:00:00',
    skuItems: [sku('HG-SK-2604', 'NV', 'M', 96, 1400), sku('HG-SK-2604', 'NV', 'L', 96, 1400)],
  },
  {
    kind: 'garment', spu: 'HG-GAR-2601', styleCode: 'GAR-2601', productName: '女款休闲裤成衣', imageUrl: PMS_STYLE_IMAGES.pants, category: '成衣直采', season: '2026 春夏', source: 'PCS 同步', status: '在售', updatedAt: '2026-05-25 13:30:00',
    skuItems: [sku('HG-GAR-2601', 'BK', 'M', 120, 100)],
  },
  {
    kind: 'sample', spu: 'HG-SAM-2601', styleCode: 'SAM-2601', productName: '男款圆领T恤样衣', imageUrl: PMS_STYLE_IMAGES.tshirt, category: '样衣', season: '2026 春夏', source: '样衣开发', status: '开发中', updatedAt: '2026-05-26 18:10:00',
    skuItems: [sku('HG-SAM-2601', 'WH', 'M', 260, 0, '开发中')],
  },
  {
    kind: 'sample', spu: 'HG-SAM-2602', styleCode: 'SAM-2602', productName: '女款连衣裙样衣', imageUrl: PMS_STYLE_IMAGES.dress, category: '样衣', season: '2026 春夏', source: '样衣开发', status: '开发中', updatedAt: '2026-05-27 10:20:00',
    skuItems: [sku('HG-SAM-2602', 'NV', 'M', 320, 0, '开发中')],
  },
]

export function listPmsProductSkus(kind: PmsSkuKind): PmsProductSkuRow[] {
  return rows.filter((row) => row.kind === kind)
}

export function getPmsProductSkuRow(kind: PmsSkuKind, spu: string): PmsProductSkuRow | undefined {
  return rows.find((row) => row.kind === kind && row.spu === spu)
}
