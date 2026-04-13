export type LegacyType = 'ID_PURCHASE' | 'GOODS_PURCHASE'
export type SourceSystem = 'LEGACY' | 'NEW'
export type Priority = 'URGENT' | 'HIGH' | 'NORMAL'
export type DemandStatus = 'PENDING_CONVERT' | 'CONVERTED' | 'HOLD' | 'CANCELLED'
export type TechPackStatus = 'INCOMPLETE' | 'RELEASED'

export interface SkuLine {
  skuCode: string
  size: string
  color: string
  qty: number
}

export interface ProductionDemand {
  demandId: string
  legacyType: LegacyType
  legacyOrderNo: string
  sourceSystem: SourceSystem
  spuCode: string
  spuName: string
  imageUrl: string
  category?: string
  marketScopes: string[]
  priority: Priority
  demandStatus: DemandStatus
  // 需求侧只展示当前生效技术包版本信息，不直接承载 FCS 快照入口。
  techPackStatus: TechPackStatus
  techPackVersionLabel: string
  requiredDeliveryDate: string | null
  requiredQtyTotal: number
  constraintsNote: string
  skuLines: SkuLine[]
  hasProductionOrder: boolean
  productionOrderId: string | null
  createdAt: string
  updatedAt: string
}

function createDemandSeed(input: Omit<ProductionDemand, 'requiredQtyTotal'> & { requiredQtyTotal?: number }): ProductionDemand {
  const requiredQtyTotal = input.requiredQtyTotal ?? input.skuLines.reduce((sum, line) => sum + line.qty, 0)
  return {
    ...input,
    requiredQtyTotal,
  }
}

const seedProductionDemands: ProductionDemand[] = [
  createDemandSeed({
    demandId: 'DEM-202603-0001', legacyType: 'ID_PURCHASE', legacyOrderNo: '240776', sourceSystem: 'LEGACY',
    spuCode: 'SPU-2024-001', spuName: 'Kemeja Batik Pria Modern', imageUrl: '/placeholder.svg?height=80&width=80',
    category: 'Mens Shirt', marketScopes: ['ID'], priority: 'URGENT', demandStatus: 'PENDING_CONVERT', techPackStatus: 'RELEASED', techPackVersionLabel: 'v1.0',
    requiredDeliveryDate: '2026-04-15', constraintsNote: 'Bahan harus 100% katun. Warna tidak boleh luntur setelah 5x cuci.',
    skuLines: [
      { skuCode: 'SKU-001-S-BLK', size: 'S', color: 'Black', qty: 300 },
      { skuCode: 'SKU-001-M-BLK', size: 'M', color: 'Black', qty: 400 },
      { skuCode: 'SKU-001-L-BLK', size: 'L', color: 'Black', qty: 500 },
      { skuCode: 'SKU-001-XL-BLK', size: 'XL', color: 'Black', qty: 300 },
    ],
    hasProductionOrder: false, productionOrderId: null, createdAt: '2026-03-01 09:00:00', updatedAt: '2026-03-01 09:00:00',
  }),
  createDemandSeed({
    demandId: 'DEM-202603-0002', legacyType: 'GOODS_PURCHASE', legacyOrderNo: '240777', sourceSystem: 'LEGACY',
    spuCode: 'SPU-2024-002', spuName: 'Dress Wanita Casual', imageUrl: '/placeholder.svg?height=80&width=80',
    category: 'Womens Dress', marketScopes: ['ID', 'TH'], priority: 'HIGH', demandStatus: 'PENDING_CONVERT', techPackStatus: 'INCOMPLETE', techPackVersionLabel: 'beta',
    requiredDeliveryDate: '2026-04-20', constraintsNote: 'Jahitan harus rapi。Label harus terpasang dengan benar。',
    skuLines: [
      { skuCode: 'SKU-002-S-RED', size: 'S', color: 'Red', qty: 500 },
      { skuCode: 'SKU-002-M-RED', size: 'M', color: 'Red', qty: 600 },
      { skuCode: 'SKU-002-L-RED', size: 'L', color: 'Red', qty: 500 },
      { skuCode: 'SKU-002-XL-RED', size: 'XL', color: 'Red', qty: 400 },
    ],
    hasProductionOrder: false, productionOrderId: null, createdAt: '2026-03-01 10:30:00', updatedAt: '2026-03-01 10:30:00',
  }),
  createDemandSeed({
    demandId: 'DEM-202603-0003', legacyType: 'ID_PURCHASE', legacyOrderNo: '240778', sourceSystem: 'LEGACY',
    spuCode: 'SPU-2024-003', spuName: 'Celana Panjang Formal', imageUrl: '/placeholder.svg?height=80&width=80',
    category: 'Mens Pants', marketScopes: ['ID'], priority: 'URGENT', demandStatus: 'PENDING_CONVERT', techPackStatus: 'RELEASED', techPackVersionLabel: 'v1.0',
    requiredDeliveryDate: '2026-04-10', constraintsNote: 'Wajib ada label ukuran。Resleting YKK。',
    skuLines: [
      { skuCode: 'SKU-003-30-NVY', size: '30', color: 'Navy', qty: 600 },
      { skuCode: 'SKU-003-32-NVY', size: '32', color: 'Navy', qty: 800 },
      { skuCode: 'SKU-003-34-NVY', size: '34', color: 'Navy', qty: 900 },
      { skuCode: 'SKU-003-36-NVY', size: '36', color: 'Navy', qty: 700 },
    ],
    hasProductionOrder: false, productionOrderId: null, createdAt: '2026-03-02 08:00:00', updatedAt: '2026-03-02 14:00:00',
  }),
  createDemandSeed({
    demandId: 'DEM-202603-0004', legacyType: 'GOODS_PURCHASE', legacyOrderNo: '240779', sourceSystem: 'LEGACY',
    spuCode: 'SPU-2024-004', spuName: 'Kaos Polos Premium', imageUrl: '/placeholder.svg?height=80&width=80',
    category: 'Mens T-Shirt', marketScopes: ['ID', 'VN'], priority: 'HIGH', demandStatus: 'CONVERTED', techPackStatus: 'RELEASED', techPackVersionLabel: 'v1.0',
    requiredDeliveryDate: '2026-04-25', constraintsNote: 'Cotton combed 30s. Warna harus sesuai Pantone.',
    skuLines: [
      { skuCode: 'SKU-004-S-WHT', size: 'S', color: 'White', qty: 1000 },
      { skuCode: 'SKU-004-M-WHT', size: 'M', color: 'White', qty: 1500 },
      { skuCode: 'SKU-004-L-WHT', size: 'L', color: 'White', qty: 1500 },
      { skuCode: 'SKU-004-XL-WHT', size: 'XL', color: 'White', qty: 1000 },
    ],
    hasProductionOrder: true, productionOrderId: 'PO-202603-0001', createdAt: '2026-03-02 09:00:00', updatedAt: '2026-03-02 16:00:00',
  }),
  createDemandSeed({
    demandId: 'DEM-202603-0005', legacyType: 'ID_PURCHASE', legacyOrderNo: '240780', sourceSystem: 'LEGACY',
    spuCode: 'SPU-2024-005', spuName: 'Jaket Hoodie Unisex', imageUrl: '/placeholder.svg?height=80&width=80',
    category: 'Outerwear', marketScopes: ['ID'], priority: 'NORMAL', demandStatus: 'CONVERTED', techPackStatus: 'RELEASED', techPackVersionLabel: 'v2.1',
    requiredDeliveryDate: '2026-05-01', constraintsNote: 'Fleece 280gsm. Resleting harus kuat.',
    skuLines: [
      { skuCode: 'SKU-005-S-GRY', size: 'S', color: 'Grey', qty: 500 },
      { skuCode: 'SKU-005-M-GRY', size: 'M', color: 'Grey', qty: 700 },
      { skuCode: 'SKU-005-L-GRY', size: 'L', color: 'Grey', qty: 800 },
      { skuCode: 'SKU-005-XL-GRY', size: 'XL', color: 'Grey', qty: 500 },
    ],
    hasProductionOrder: true, productionOrderId: 'PO-202603-0002', createdAt: '2026-03-03 08:00:00', updatedAt: '2026-03-03 15:00:00',
  }),
  createDemandSeed({
    demandId: 'DEM-202603-0006', legacyType: 'GOODS_PURCHASE', legacyOrderNo: '240781', sourceSystem: 'LEGACY',
    spuCode: 'SPU-2024-006', spuName: 'Rok Mini Plisket', imageUrl: '/placeholder.svg?height=80&width=80',
    category: 'Womens Skirt', marketScopes: ['ID', 'TH', 'VN'], priority: 'NORMAL', demandStatus: 'HOLD', techPackStatus: 'INCOMPLETE', techPackVersionLabel: 'beta',
    requiredDeliveryDate: null, constraintsNote: 'Menunggu konfirmasi warna dari buyer.',
    skuLines: [
      { skuCode: 'SKU-006-S-PNK', size: 'S', color: 'Pink', qty: 400 },
      { skuCode: 'SKU-006-M-PNK', size: 'M', color: 'Pink', qty: 500 },
      { skuCode: 'SKU-006-L-PNK', size: 'L', color: 'Pink', qty: 500 },
      { skuCode: 'SKU-006-XL-PNK', size: 'XL', color: 'Pink', qty: 400 },
    ],
    hasProductionOrder: false, productionOrderId: null, createdAt: '2026-03-03 10:00:00', updatedAt: '2026-03-03 10:00:00',
  }),
  createDemandSeed({
    demandId: 'DEM-202603-0007', legacyType: 'ID_PURCHASE', legacyOrderNo: '240782', sourceSystem: 'LEGACY',
    spuCode: 'SPU-2024-007', spuName: 'Blazer Wanita Formal', imageUrl: '/placeholder.svg?height=80&width=80',
    category: 'Womens Blazer', marketScopes: ['ID'], priority: 'HIGH', demandStatus: 'CANCELLED', techPackStatus: 'INCOMPLETE', techPackVersionLabel: 'beta',
    requiredDeliveryDate: '2026-04-30', constraintsNote: 'Dibatalkan karena perubahan koleksi。',
    skuLines: [
      { skuCode: 'SKU-007-S-BLK', size: 'S', color: 'Black', qty: 300 },
      { skuCode: 'SKU-007-M-BLK', size: 'M', color: 'Black', qty: 400 },
      { skuCode: 'SKU-007-L-BLK', size: 'L', color: 'Black', qty: 300 },
      { skuCode: 'SKU-007-XL-BLK', size: 'XL', color: 'Black', qty: 200 },
    ],
    hasProductionOrder: false, productionOrderId: null, createdAt: '2026-03-04 09:00:00', updatedAt: '2026-03-04 14:00:00',
  }),
  createDemandSeed({
    demandId: 'DEM-202603-0008', legacyType: 'GOODS_PURCHASE', legacyOrderNo: '240783', sourceSystem: 'LEGACY',
    spuCode: 'SPU-2024-008', spuName: 'Kemeja Flanel Pria', imageUrl: '/placeholder.svg?height=80&width=80',
    category: 'Mens Shirt', marketScopes: ['ID'], priority: 'URGENT', demandStatus: 'PENDING_CONVERT', techPackStatus: 'RELEASED', techPackVersionLabel: 'v1.0',
    requiredDeliveryDate: '2026-04-08', constraintsNote: 'Pattern harus align di bagian depan. Kancing kayu.',
    skuLines: [
      { skuCode: 'SKU-008-S-PLB', size: 'S', color: 'Plaid Blue', qty: 800 },
      { skuCode: 'SKU-008-M-PLB', size: 'M', color: 'Plaid Blue', qty: 1200 },
      { skuCode: 'SKU-008-L-PLB', size: 'L', color: 'Plaid Blue', qty: 1200 },
      { skuCode: 'SKU-008-XL-PLB', size: 'XL', color: 'Plaid Blue', qty: 800 },
    ],
    hasProductionOrder: false, productionOrderId: null, createdAt: '2026-03-04 11:00:00', updatedAt: '2026-03-04 11:00:00',
  }),
  createDemandSeed({
    demandId: 'DEM-202603-0009', legacyType: 'ID_PURCHASE', legacyOrderNo: '240784', sourceSystem: 'LEGACY',
    spuCode: 'SPU-2024-009', spuName: 'Polo Shirt Pique', imageUrl: '/placeholder.svg?height=80&width=80',
    category: 'Mens Polo', marketScopes: ['ID', 'TH'], priority: 'HIGH', demandStatus: 'CONVERTED', techPackStatus: 'RELEASED', techPackVersionLabel: 'v1.2',
    requiredDeliveryDate: '2026-03-25', constraintsNote: 'Logo bordir dada kiri. Kerah harus kaku.',
    skuLines: [
      { skuCode: 'SKU-009-S-WHT', size: 'S', color: 'White', qty: 1200 },
      { skuCode: 'SKU-009-M-WHT', size: 'M', color: 'White', qty: 1800 },
      { skuCode: 'SKU-009-L-WHT', size: 'L', color: 'White', qty: 1800 },
      { skuCode: 'SKU-009-XL-WHT', size: 'XL', color: 'White', qty: 1200 },
    ],
    hasProductionOrder: true, productionOrderId: 'PO-202603-0003', createdAt: '2026-02-20 08:00:00', updatedAt: '2026-03-01 10:00:00',
  }),
  createDemandSeed({
    demandId: 'DEM-202603-0010', legacyType: 'GOODS_PURCHASE', legacyOrderNo: '240785', sourceSystem: 'LEGACY',
    spuCode: 'SPU-2024-010', spuName: 'Celana Jogger Pria', imageUrl: '/placeholder.svg?height=80&width=80',
    category: 'Mens Pants', marketScopes: ['ID'], priority: 'NORMAL', demandStatus: 'CONVERTED', techPackStatus: 'RELEASED', techPackVersionLabel: 'v1.0',
    requiredDeliveryDate: '2026-03-10', constraintsNote: 'Elastis pinggang harus kuat. Saku samping resleting.',
    skuLines: [
      { skuCode: 'SKU-010-S-BLK', size: 'S', color: 'Black', qty: 700 },
      { skuCode: 'SKU-010-M-BLK', size: 'M', color: 'Black', qty: 1000 },
      { skuCode: 'SKU-010-L-BLK', size: 'L', color: 'Black', qty: 1100 },
      { skuCode: 'SKU-010-XL-BLK', size: 'XL', color: 'Black', qty: 700 },
    ],
    hasProductionOrder: true, productionOrderId: 'PO-202603-0004', createdAt: '2026-02-15 09:00:00', updatedAt: '2026-03-02 16:00:00',
  }),
  createDemandSeed({
    demandId: 'DEM-202603-0011', legacyType: 'ID_PURCHASE', legacyOrderNo: '240786', sourceSystem: 'LEGACY',
    spuCode: 'SPU-2024-011', spuName: 'Sweater Rajut Wanita', imageUrl: '/placeholder.svg?height=80&width=80',
    category: 'Womens Knitwear', marketScopes: ['ID', 'VN'], priority: 'URGENT', demandStatus: 'CONVERTED', techPackStatus: 'RELEASED', techPackVersionLabel: 'v1.1',
    requiredDeliveryDate: '2026-04-18', constraintsNote: 'Rajutan harus rapat. Tidak boleh melar.',
    skuLines: [
      { skuCode: 'SKU-011-S-CRM', size: 'S', color: 'Cream', qty: 500 },
      { skuCode: 'SKU-011-M-CRM', size: 'M', color: 'Cream', qty: 600 },
      { skuCode: 'SKU-011-L-CRM', size: 'L', color: 'Cream', qty: 600 },
      { skuCode: 'SKU-011-XL-CRM', size: 'XL', color: 'Cream', qty: 500 },
    ],
    hasProductionOrder: true, productionOrderId: 'PO-202603-0005', createdAt: '2026-03-01 08:00:00', updatedAt: '2026-03-01 14:00:00',
  }),
  createDemandSeed({
    demandId: 'DEM-202603-0012', legacyType: 'GOODS_PURCHASE', legacyOrderNo: '240787', sourceSystem: 'LEGACY',
    spuCode: 'SPU-2024-012', spuName: 'Cardigan Wanita', imageUrl: '/placeholder.svg?height=80&width=80',
    category: 'Womens Knitwear', marketScopes: ['ID'], priority: 'HIGH', demandStatus: 'CONVERTED', techPackStatus: 'RELEASED', techPackVersionLabel: 'v1.0',
    requiredDeliveryDate: '2026-04-22', constraintsNote: 'Kancing mutiara. Rajutan halus.',
    skuLines: [
      { skuCode: 'SKU-012-S-BEG', size: 'S', color: 'Beige', qty: 400 },
      { skuCode: 'SKU-012-M-BEG', size: 'M', color: 'Beige', qty: 400 },
      { skuCode: 'SKU-012-L-BEG', size: 'L', color: 'Beige', qty: 400 },
      { skuCode: 'SKU-012-XL-BEG', size: 'XL', color: 'Beige', qty: 400 },
    ],
    hasProductionOrder: true, productionOrderId: 'PO-202603-0006', createdAt: '2026-03-02 10:00:00', updatedAt: '2026-03-02 15:00:00',
  }),
  createDemandSeed({
    demandId: 'DEM-202603-0013', legacyType: 'ID_PURCHASE', legacyOrderNo: '240788', sourceSystem: 'LEGACY',
    spuCode: 'SPU-2024-013', spuName: 'Jas Pria Formal', imageUrl: '/placeholder.svg?height=80&width=80',
    category: 'Mens Suit', marketScopes: ['ID'], priority: 'URGENT', demandStatus: 'CONVERTED', techPackStatus: 'RELEASED', techPackVersionLabel: 'v1.5',
    requiredDeliveryDate: '2026-05-10', constraintsNote: 'Wool blend. Lapel harus tajam.',
    skuLines: [
      { skuCode: 'SKU-013-S-NVY', size: 'S', color: 'Navy', qty: 150 },
      { skuCode: 'SKU-013-M-NVY', size: 'M', color: 'Navy', qty: 250 },
      { skuCode: 'SKU-013-L-NVY', size: 'L', color: 'Navy', qty: 250 },
      { skuCode: 'SKU-013-XL-NVY', size: 'XL', color: 'Navy', qty: 150 },
    ],
    hasProductionOrder: true, productionOrderId: 'PO-202603-0007', createdAt: '2026-02-28 09:00:00', updatedAt: '2026-03-03 11:00:00',
  }),
  createDemandSeed({
    demandId: 'DEM-202603-0014', legacyType: 'GOODS_PURCHASE', legacyOrderNo: '240789', sourceSystem: 'LEGACY',
    spuCode: 'SPU-2024-014', spuName: 'Rompi Pria Casual', imageUrl: '/placeholder.svg?height=80&width=80',
    category: 'Mens Vest', marketScopes: ['ID', 'TH'], priority: 'NORMAL', demandStatus: 'CONVERTED', techPackStatus: 'RELEASED', techPackVersionLabel: 'v1.0',
    requiredDeliveryDate: '2026-04-28', constraintsNote: '主布与里布须同步过色。',
    skuLines: [
      { skuCode: 'SKU-014-S-GRN', size: 'S', color: 'Green', qty: 200 },
      { skuCode: 'SKU-014-M-GRN', size: 'M', color: 'Green', qty: 300 },
      { skuCode: 'SKU-014-L-GRN', size: 'L', color: 'Green', qty: 300 },
      { skuCode: 'SKU-014-XL-GRN', size: 'XL', color: 'Green', qty: 200 },
    ],
    hasProductionOrder: true, productionOrderId: 'PO-202603-0008', createdAt: '2026-02-25 10:00:00', updatedAt: '2026-03-04 09:00:00',
  }),
  createDemandSeed({
    demandId: 'DEM-202603-0015', legacyType: 'ID_PURCHASE', legacyOrderNo: '240790', sourceSystem: 'LEGACY',
    spuCode: 'SPU-2024-015', spuName: 'Kemeja Linen Pria', imageUrl: '/placeholder.svg?height=80&width=80',
    category: 'Mens Shirt', marketScopes: ['ID'], priority: 'HIGH', demandStatus: 'CONVERTED', techPackStatus: 'RELEASED', techPackVersionLabel: 'v1.3',
    requiredDeliveryDate: '2026-05-05', constraintsNote: 'Linen premium. Jahitan Perancis.',
    skuLines: [
      { skuCode: 'SKU-015-S-WHT', size: 'S', color: 'White', qty: 600 },
      { skuCode: 'SKU-015-M-WHT', size: 'M', color: 'White', qty: 800 },
      { skuCode: 'SKU-015-L-WHT', size: 'L', color: 'White', qty: 800 },
      { skuCode: 'SKU-015-XL-WHT', size: 'XL', color: 'White', qty: 600 },
    ],
    hasProductionOrder: true, productionOrderId: 'PO-202603-0009', createdAt: '2026-03-04 14:00:00', updatedAt: '2026-03-04 14:30:00',
  }),
  createDemandSeed({
    demandId: 'DEM-202603-0016', legacyType: 'GOODS_PURCHASE', legacyOrderNo: '240791', sourceSystem: 'LEGACY',
    spuCode: 'SPU-2024-016', spuName: 'Blus Wanita Satin', imageUrl: '/placeholder.svg?height=80&width=80',
    category: 'Womens Blouse', marketScopes: ['ID', 'VN'], priority: 'URGENT', demandStatus: 'CONVERTED', techPackStatus: 'RELEASED', techPackVersionLabel: 'v1.1',
    requiredDeliveryDate: '2026-03-28', constraintsNote: 'Satin silk blend. Tidak boleh kusut.',
    skuLines: [
      { skuCode: 'SKU-016-S-CHP', size: 'S', color: 'Champagne', qty: 700 },
      { skuCode: 'SKU-016-M-CHP', size: 'M', color: 'Champagne', qty: 900 },
      { skuCode: 'SKU-016-L-CHP', size: 'L', color: 'Champagne', qty: 900 },
      { skuCode: 'SKU-016-XL-CHP', size: 'XL', color: 'Champagne', qty: 700 },
    ],
    hasProductionOrder: true, productionOrderId: 'PO-202603-0010', createdAt: '2026-02-22 09:00:00', updatedAt: '2026-03-01 16:00:00',
  }),
  createDemandSeed({
    demandId: 'DEM-202603-0017', legacyType: 'GOODS_PURCHASE', legacyOrderNo: '240792', sourceSystem: 'LEGACY',
    spuCode: 'SPU-2024-017', spuName: 'Celana Pendek Pria', imageUrl: '/placeholder.svg?height=80&width=80',
    category: 'Mens Shorts', marketScopes: ['ID', 'TH'], priority: 'HIGH', demandStatus: 'CONVERTED', techPackStatus: 'RELEASED', techPackVersionLabel: 'v2.2',
    requiredDeliveryDate: '2026-04-05', constraintsNote: 'Kain quick-dry. Saku内袋需同步过色。',
    skuLines: [
      { skuCode: 'SKU-017-S-NVY', size: 'S', color: 'Navy', qty: 500 },
      { skuCode: 'SKU-017-M-NVY', size: 'M', color: 'Navy', qty: 700 },
      { skuCode: 'SKU-017-L-NVY', size: 'L', color: 'Navy', qty: 700 },
      { skuCode: 'SKU-017-XL-NVY', size: 'XL', color: 'Navy', qty: 500 },
    ],
    hasProductionOrder: true, productionOrderId: 'PO-202603-0014', createdAt: '2026-02-26 15:00:00', updatedAt: '2026-03-06 09:00:00',
  }),
  createDemandSeed({
    demandId: 'DEM-202603-0018', legacyType: 'ID_PURCHASE', legacyOrderNo: '240793', sourceSystem: 'LEGACY',
    spuCode: 'SPU-2024-001', spuName: '春季休闲T恤', imageUrl: '/placeholder.svg?height=80&width=80',
    category: 'Mens T-Shirt', marketScopes: ['ID'], priority: 'URGENT', demandStatus: 'CONVERTED', techPackStatus: 'RELEASED', techPackVersionLabel: 'v1.0',
    requiredDeliveryDate: '2026-04-12', constraintsNote: '白黑双色同批，含激光切和打揽特殊工艺。',
    skuLines: [
      { skuCode: 'SKU-001-S-WHT', size: 'S', color: 'White', qty: 300 },
      { skuCode: 'SKU-001-M-WHT', size: 'M', color: 'White', qty: 400 },
      { skuCode: 'SKU-001-L-BLK', size: 'L', color: 'Black', qty: 450 },
      { skuCode: 'SKU-001-XL-BLK', size: 'XL', color: 'Black', qty: 250 },
    ],
    hasProductionOrder: true, productionOrderId: 'PO-202603-0015', createdAt: '2026-03-15 09:00:00', updatedAt: '2026-03-16 10:05:00',
  }),
  createDemandSeed({
    demandId: 'DEM-202603-0081', legacyType: 'GOODS_PURCHASE', legacyOrderNo: '26030881', sourceSystem: 'NEW',
    spuCode: 'SPU-TSHIRT-081', spuName: '春季休闲印花短袖 T 恤', imageUrl: '/placeholder.svg?height=80&width=80',
    category: 'Mens T-Shirt', marketScopes: ['ID', 'VN'], priority: 'URGENT', demandStatus: 'CONVERTED', techPackStatus: 'RELEASED', techPackVersionLabel: 'v2.0',
    requiredDeliveryDate: '2026-03-24', constraintsNote: '印花主布、领口拼接布、里布分料执行。',
    skuLines: [
      { skuCode: 'SKU-001-M-WHT', size: 'M', color: 'White', qty: 1400 },
      { skuCode: 'SKU-001-L-WHT', size: 'L', color: 'White', qty: 1400 },
      { skuCode: 'SKU-001-M-BLK', size: 'M', color: 'Black', qty: 1200 },
      { skuCode: 'SKU-001-L-BLK', size: 'L', color: 'Black', qty: 1200 },
    ],
    hasProductionOrder: true, productionOrderId: 'PO-202603-081', createdAt: '2026-03-08 08:00:00', updatedAt: '2026-03-08 08:30:00',
  }),
  createDemandSeed({
    demandId: 'DEM-202603-0082', legacyType: 'GOODS_PURCHASE', legacyOrderNo: '26030982', sourceSystem: 'NEW',
    spuCode: 'SPU-HOODIE-082', spuName: '连帽拉链卫衣套装', imageUrl: '/placeholder.svg?height=80&width=80',
    category: 'Outerwear', marketScopes: ['ID'], priority: 'HIGH', demandStatus: 'CONVERTED', techPackStatus: 'RELEASED', techPackVersionLabel: 'v1.0',
    requiredDeliveryDate: '2026-03-28', constraintsNote: '主布与侧缝里布需同步染配。',
    skuLines: [
      { skuCode: 'SKU-082-S-GRY', size: 'S', color: '雾霾灰', qty: 800 },
      { skuCode: 'SKU-082-M-GRY', size: 'M', color: '雾霾灰', qty: 1000 },
      { skuCode: 'SKU-082-L-GRY', size: 'L', color: '雾霾灰', qty: 1000 },
      { skuCode: 'SKU-082-XL-GRY', size: 'XL', color: '雾霾灰', qty: 800 },
    ],
    hasProductionOrder: true, productionOrderId: 'PO-202603-082', createdAt: '2026-03-09 08:20:00', updatedAt: '2026-03-09 09:00:00',
  }),
  createDemandSeed({
    demandId: 'DEM-202603-0083', legacyType: 'GOODS_PURCHASE', legacyOrderNo: '26031083', sourceSystem: 'NEW',
    spuCode: 'SPU-DRESS-083', spuName: '春季定位印花连衣裙', imageUrl: '/placeholder.svg?height=80&width=80',
    category: 'Womens Dress', marketScopes: ['ID'], priority: 'HIGH', demandStatus: 'CONVERTED', techPackStatus: 'RELEASED', techPackVersionLabel: 'v1.0',
    requiredDeliveryDate: '2026-03-31', constraintsNote: '定位印主布与门襟拼色布分单裁剪。',
    skuLines: [
      { skuCode: 'SKU-083-S-RED', size: 'S', color: 'Red', qty: 1200 },
      { skuCode: 'SKU-083-M-RED', size: 'M', color: 'Red', qty: 1500 },
      { skuCode: 'SKU-083-L-RED', size: 'L', color: 'Red', qty: 1400 },
    ],
    hasProductionOrder: true, productionOrderId: 'PO-202603-083', createdAt: '2026-03-10 08:10:00', updatedAt: '2026-03-10 09:10:00',
  }),
  createDemandSeed({
    demandId: 'DEM-202603-0084', legacyType: 'ID_PURCHASE', legacyOrderNo: '26031184', sourceSystem: 'NEW',
    spuCode: 'SPU-TEE-084', spuName: '针织撞色短袖上衣', imageUrl: '/placeholder.svg?height=80&width=80',
    category: 'Mens T-Shirt', marketScopes: ['ID'], priority: 'NORMAL', demandStatus: 'CONVERTED', techPackStatus: 'RELEASED', techPackVersionLabel: 'v1.0',
    requiredDeliveryDate: '2026-04-05', constraintsNote: '染色针织主布与弹力网布里料并行准备。',
    skuLines: [
      { skuCode: 'SKU-084-S-CRL', size: 'S', color: '珊瑚粉', qty: 700 },
      { skuCode: 'SKU-084-M-CRL', size: 'M', color: '珊瑚粉', qty: 700 },
      { skuCode: 'SKU-084-L-CRL', size: 'L', color: '珊瑚粉', qty: 700 },
      { skuCode: 'SKU-084-XL-CRL', size: 'XL', color: '珊瑚粉', qty: 700 },
    ],
    hasProductionOrder: true, productionOrderId: 'PO-202603-084', createdAt: '2026-03-11 08:30:00', updatedAt: '2026-03-11 09:00:00',
  }),
  createDemandSeed({
    demandId: 'DEM-202603-0085', legacyType: 'ID_PURCHASE', legacyOrderNo: '26031285', sourceSystem: 'NEW',
    spuCode: 'SPU-JACKET-085', spuName: '户外轻量夹克', imageUrl: '/placeholder.svg?height=80&width=80',
    category: 'Outerwear', marketScopes: ['ID'], priority: 'NORMAL', demandStatus: 'CONVERTED', techPackStatus: 'RELEASED', techPackVersionLabel: 'v1.0',
    requiredDeliveryDate: '2026-04-10', constraintsNote: '主布与内袋布拆分执行，存在补料风险。',
    skuLines: [
      { skuCode: 'SKU-085-S-OLV', size: 'S', color: '军绿', qty: 1100 },
      { skuCode: 'SKU-085-M-OLV', size: 'M', color: '军绿', qty: 1200 },
      { skuCode: 'SKU-085-L-OLV', size: 'L', color: '军绿', qty: 1200 },
      { skuCode: 'SKU-085-XL-OLV', size: 'XL', color: '军绿', qty: 1100 },
    ],
    hasProductionOrder: true, productionOrderId: 'PO-202603-085', createdAt: '2026-03-12 08:10:00', updatedAt: '2026-03-12 08:50:00',
  }),
  createDemandSeed({
    demandId: 'DEM-202603-0086', legacyType: 'ID_PURCHASE', legacyOrderNo: '26031386', sourceSystem: 'NEW',
    spuCode: 'SPU-SHIRT-086', spuName: '商务修身长袖衬衫', imageUrl: '/placeholder.svg?height=80&width=80',
    category: 'Mens Shirt', marketScopes: ['ID'], priority: 'HIGH', demandStatus: 'CONVERTED', techPackStatus: 'RELEASED', techPackVersionLabel: 'v1.0',
    requiredDeliveryDate: '2026-03-29', constraintsNote: '满印主布与下摆辅布配套裁剪。',
    skuLines: [
      { skuCode: 'SKU-086-S-BLU', size: 'S', color: '蓝白印花', qty: 600 },
      { skuCode: 'SKU-086-M-BLU', size: 'M', color: '蓝白印花', qty: 900 },
      { skuCode: 'SKU-086-L-BLU', size: 'L', color: '蓝白印花', qty: 900 },
      { skuCode: 'SKU-086-XL-BLU', size: 'XL', color: '蓝白印花', qty: 600 },
    ],
    hasProductionOrder: true, productionOrderId: 'PO-202603-086', createdAt: '2026-03-13 08:00:00', updatedAt: '2026-03-13 08:35:00',
  }),
  createDemandSeed({
    demandId: 'DEM-202603-0087', legacyType: 'GOODS_PURCHASE', legacyOrderNo: '26031487', sourceSystem: 'NEW',
    spuCode: 'SPU-TSHIRT-081', spuName: '春季休闲印花短袖 T 恤', imageUrl: '/placeholder.svg?height=80&width=80',
    category: 'Mens T-Shirt', marketScopes: ['ID'], priority: 'HIGH', demandStatus: 'CONVERTED', techPackStatus: 'RELEASED', techPackVersionLabel: 'v2.0',
    requiredDeliveryDate: '2026-03-30', constraintsNote: '玫瑰红版本拆分为独立生产单。',
    skuLines: [
      { skuCode: 'SKU-081-M-RSE', size: 'M', color: '玫瑰红', qty: 1200 },
      { skuCode: 'SKU-081-L-RSE', size: 'L', color: '玫瑰红', qty: 1200 },
    ],
    hasProductionOrder: true, productionOrderId: 'PO-202603-087', createdAt: '2026-03-14 09:20:00', updatedAt: '2026-03-14 09:50:00',
  }),
  createDemandSeed({
    demandId: 'DEM-202603-0088', legacyType: 'GOODS_PURCHASE', legacyOrderNo: '26031588', sourceSystem: 'NEW',
    spuCode: 'SPU-TSHIRT-081', spuName: '春季休闲印花短袖 T 恤', imageUrl: '/placeholder.svg?height=80&width=80',
    category: 'Mens T-Shirt', marketScopes: ['ID'], priority: 'HIGH', demandStatus: 'CONVERTED', techPackStatus: 'RELEASED', techPackVersionLabel: 'v2.0',
    requiredDeliveryDate: '2026-04-02', constraintsNote: '同款补单，允许与既有原始裁片单做执行层合批。',
    skuLines: [
      { skuCode: 'SKU-081-M-RSE-2', size: 'M', color: '玫瑰红', qty: 900 },
      { skuCode: 'SKU-081-L-RSE-2', size: 'L', color: '玫瑰红', qty: 900 },
    ],
    hasProductionOrder: true, productionOrderId: 'PO-202603-088', createdAt: '2026-03-15 08:40:00', updatedAt: '2026-03-15 09:10:00',
  }),
]

function normalizeReleasedVersionLabel(versionLabel: string): string {
  const trimmed = versionLabel.trim()
  if (!trimmed || trimmed === '-' || trimmed.toLowerCase() === 'beta') {
    return 'v1.0'
  }
  return trimmed
}

function normalizeDemandSeed(demand: ProductionDemand): ProductionDemand {
  const actualTechPackStatus: TechPackStatus = demand.techPackStatus

  if (demand.hasProductionOrder && demand.demandStatus !== 'CONVERTED') {
    throw new Error(`需求 ${demand.demandId} 已绑定生产单，但状态不是 CONVERTED`)
  }

  if (demand.hasProductionOrder && !demand.productionOrderId) {
    throw new Error(`需求 ${demand.demandId} 标记了 hasProductionOrder，但缺少 productionOrderId`)
  }

  return {
    ...demand,
    techPackStatus: actualTechPackStatus,
    techPackVersionLabel: actualTechPackStatus === 'RELEASED'
      ? normalizeReleasedVersionLabel(demand.techPackVersionLabel)
      : 'beta',
  }
}

export const productionDemands: ProductionDemand[] = seedProductionDemands.map(normalizeDemandSeed)

export const demandStatusConfig: Record<DemandStatus, { label: string; color: string }> = {
  PENDING_CONVERT: { label: '待转单', color: 'bg-blue-100 text-blue-700' },
  CONVERTED:       { label: '已转单', color: 'bg-green-100 text-green-700' },
  HOLD:            { label: '暂停', color: 'bg-yellow-100 text-yellow-700' },
  CANCELLED:       { label: '已取消', color: 'bg-red-100 text-red-700' },
}

export const techPackStatusConfig: Record<TechPackStatus, { label: string; color: string }> = {
  INCOMPLETE: { label: '待完善', color: 'bg-orange-100 text-orange-700' },
  RELEASED:   { label: '已发布', color: 'bg-green-100 text-green-700' },
}

export const priorityConfig: Record<Priority, { label: string; color: string }> = {
  URGENT: { label: '紧急', color: 'bg-red-100 text-red-700' },
  HIGH:   { label: '高', color: 'bg-orange-100 text-orange-700' },
  NORMAL: { label: '普通', color: 'bg-blue-100 text-blue-700' },
}
