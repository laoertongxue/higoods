import type { ProductPackageSpec, SkuArchiveRecord } from './pcs-sku-archive-types.ts'

/** Legacy dimensions remain a read-only source until the user saves packaging. */
export function productPackages(record: Partial<SkuArchiveRecord>): ProductPackageSpec[] {
  if (record.packageSpecs) return record.packageSpecs.map(row => ({ ...row }))
  if (!(record.lengthCm || record.widthCm || record.heightCm || record.packageGrossWeightKg || record.packageQuantity)) return []
  const lengthCm = record.lengthCm || null, widthCm = record.widthCm || null, heightCm = record.heightCm || null
  return [{ packageSpecId: `legacy-package-${record.skuId}`, ownerSkuId: record.skuId || '', packageTypeId: '包', contentQty: record.packageQuantity || 1,
    contentUnitId: record.pricingUnit || '件', grossWeightKg: record.packageGrossWeightKg ?? null, lengthCm, widthCm, heightCm,
    volumeM3: lengthCm && widthCm && heightCm ? lengthCm * widthCm * heightCm / 1e6 : null,
    measurementBasis: '每包装', version: 1, status: 'ACTIVE' }]
}
export function prepareProductPackages(current: SkuArchiveRecord, incoming: ProductPackageSpec[], mainUnit = current.pricingUnit) {
  const previous = productPackages(current), history = (current.packageSpecHistory || []).map(row => ({ ...row }))
  const seen = new Set<string>()
  const rows = incoming.map(source => {
    if (!source.packageSpecId || seen.has(source.packageSpecId)) throw new Error('包装规格身份重复。')
    seen.add(source.packageSpecId)
    if (!source.packageTypeId.trim() || !Number.isFinite(source.contentQty) || source.contentQty <= 0) throw new Error('请填写包装类型和大于 0 的包装含量。')
    if (source.contentUnitId !== mainUnit) throw new Error('商品包装含量以规格主计量单位表达。')
    if ([source.lengthCm, source.widthCm, source.heightCm].some(value => value != null && (!Number.isFinite(value) || value <= 0))) throw new Error('已知包装尺寸须大于 0，未知请留空。')
    if (source.grossWeightKg != null && (!Number.isFinite(source.grossWeightKg) || source.grossWeightKg < 0)) throw new Error('包装毛重不能为负数。')
    if (!source.measurementBasis.trim()) throw new Error('请明确包装测量基准。')
    const row = { ...source, ownerSkuId: current.skuId, volumeM3: source.lengthCm && source.widthCm && source.heightCm ? Number((source.lengthCm * source.widthCm * source.heightCm / 1e6).toFixed(9)) : null }
    const old = previous.find(value => value.packageSpecId === row.packageSpecId)
    const changed = old && JSON.stringify({ ...old, version: 0 }) !== JSON.stringify({ ...row, version: 0 })
    if (changed) history.push({ ...old })
    row.version = old ? old.version + (changed ? 1 : 0) : 1
    return row
  })
  for (const old of previous) if (!seen.has(old.packageSpecId)) history.push({ ...old })
  return { packageSpecs: rows, packageSpecHistory: history }
}
