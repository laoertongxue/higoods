import { pcsRecordStore, readPcsMaterialSnapshot } from './pcs-record-runtime.ts'
import { migrateMaterialMockImage } from './pcs-reviewed-image-catalog.ts'
import type { MaterialArchiveStoreSnapshot } from './pcs-material-archive-types.ts'

/** Read only the two identity fields used by physical-object displays. The
 * authoritative PCS read view supplies saved overrides/deletions; this module
 * does not initialize seeds or import material editing/reference workflows. */
export interface PcsMaterialSkuIdentity { materialSkuCode: string; skuImageUrl: string }
const key = 'higood-pcs-material-archive-store-v2'
let indexedSource: object | string | undefined
let identities = new Map<string, PcsMaterialSkuIdentity>()
function index(value: unknown): Map<string, PcsMaterialSkuIdentity> {
  const source = value as MaterialArchiveStoreSnapshot
  if (!Array.isArray(source?.records) || !Array.isArray(source?.skuRecords)) throw new Error('物料档案格式不完整，已保留原数据，请重新读取。')
  return new Map(source.skuRecords.map(sku => [sku.materialSkuId, {
    materialSkuCode: sku.materialSkuCode,
    skuImageUrl: migrateMaterialMockImage(sku.materialSkuCode, sku.skuImageUrl, 'sku'),
  }]))
}
export function readPcsMaterialSkuIdentity(materialSkuId: string): PcsMaterialSkuIdentity | null {
  const prepared = readPcsMaterialSnapshot()
  const source = prepared?.token ?? pcsRecordStore.getItem(key)
  if (source === null) throw new Error('当前页面所需物料资料尚未读取，请重新读取后重试。')
  if (source !== indexedSource) {
    const next = prepared ? prepared.project(index) : index(JSON.parse(source as string))
    identities = next
    indexedSource = source
  }
  const identity = identities.get(materialSkuId)
  return identity ? { ...identity } : null
}
