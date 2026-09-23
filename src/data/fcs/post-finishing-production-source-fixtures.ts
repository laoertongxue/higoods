// 后道验收样本的生产主线唯一来源。仅用于原型 Mock，不代表真实工厂订单。
import { reviewedStyleImage } from '../pcs-reviewed-image-catalog.ts'
// 生产需求、生产单与后道回货共用身份和 SKU 数量，避免为质检借用无关生产单。
const colors = ['黑色', '白色', '雾蓝', '卡其', '酒红']
const sizes = ['S', 'M', 'L', 'XL', '2XL']
const seeds = [
  { no: 'PO-QC-202608-001', styleNo: 'HG-QC-001', styleName: '后道验收衬衫', imageUrl: '/shirt-sample.jpg', spuCode: 'SPU-QC-001', styleGrade: 'C', buyerName: '臻臻', productionOrderType: '首单', tagPrice: 264000, factoryId: 'ID-F021', factoryName: 'CV Micro Sewing Jakarta Pusat' },
  { no: 'PO-QC-202608-002', styleNo: 'HG-QC-002', styleName: '后道验收连衣裙', imageUrl: '/dress-sample-1.jpg', spuCode: 'SPU-QC-002', styleGrade: 'B', buyerName: '阿乐', productionOrderType: '翻单', tagPrice: 289000, factoryId: 'ID-F022', factoryName: 'CV Micro Sewing Bandung Utara' },
  { no: 'PO-QC-202608-003', styleNo: 'HG-QC-003', styleName: '后道验收外套', imageUrl: '/jacket-sample.jpg', spuCode: 'SPU-QC-003', styleGrade: 'B', buyerName: '小雨', productionOrderType: '首单', tagPrice: 319000, factoryId: 'ID-F024', factoryName: 'CV Micro Sewing Semarang Timur' },
] as const

export const POST_FINISHING_PRODUCTION_SOURCE_FIXTURES = seeds.map((seed, orderIndex) => ({
  ...seed,
  imageUrl: reviewedStyleImage(seed.spuCode),
  productionOrderId: `PF-ACCEPT-PO-${orderIndex + 1}`,
  demandId: `DEM-QC-202608-${String(orderIndex + 1).padStart(3, '0')}`,
  sewingTaskNo: `SEW-TASK-QC-${String(orderIndex + 1).padStart(3, '0')}`,
  demandCreatedAt: '2026-08-24T08:00:00+07:00',
  orderCreatedAt: '2026-08-24T09:00:00+07:00',
  skus: sizes.map((sizeName, skuIndex) => ({
    skuId: `${seed.spuCode}-${sizeName}`,
    skuCode: `${seed.spuCode}-${String(skuIndex + 1).padStart(2, '0')}`,
    spuCode: seed.spuCode,
    spuName: seed.styleName,
    colorName: colors[skuIndex],
    sizeName,
    imageUrl: reviewedStyleImage(seed.spuCode, colors[skuIndex]),
    barcode: `SKU-${orderIndex + 1}${String(skuIndex + 1).padStart(2, '0')}-202608`,
    plannedQty: 100,
    qtyUnit: '件' as const,
  })),
}))

// 只修正这 15 个验收 SKU 的旧示意图；数量、质检结果、日志和用户图片原样保留。
// 已解析的历史快照包含回货/QC/后道/出货多处冻结 SKU，因此逐处修正同一图片字段。
export function migratePostFinishingMockImages(snapshot: unknown): void {
  if (!snapshot || typeof snapshot !== 'object') return
  if (Array.isArray(snapshot)) {
    snapshot.forEach(migratePostFinishingMockImages)
    return
  }
  const record = snapshot as Record<string, unknown>
  const source = POST_FINISHING_PRODUCTION_SOURCE_FIXTURES.find((item) => item.spuCode === record.spuCode)
  const legacy = seeds.find((item) => item.spuCode === record.spuCode)
  const sku = source?.skus.find((item) => item.skuCode === record.skuCode && item.colorName === record.colorName && item.sizeName === record.sizeName)
  if (sku && record.imageUrl === legacy?.imageUrl) record.imageUrl = sku.imageUrl
  Object.values(record).forEach(migratePostFinishingMockImages)
}
