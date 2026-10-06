import { PMS_STORES, pmsAll } from './idb-storage.ts'
import { getMaterialSkuRecordById } from '../pcs-material-archive-repository.ts'

/** Read-only guard for PCS unit editing. A PMS purchase is never followed by a second PCS write. */
export async function hasMaterialPurchaseReference(materialSkuId: string): Promise<boolean> {
  const sku = getMaterialSkuRecordById(materialSkuId)
  const records = await pmsAll<{
    materialSkuId?: string
    materialCode?: string
    pcsSource?: { materialSkuId: string }
  }>(PMS_STORES.pmsMaterialPurchaseOrderDeltas)
  return records.some(record => record.pcsSource?.materialSkuId === materialSkuId
    || record.materialSkuId === materialSkuId
    || Boolean(sku?.materialSkuCode && record.materialCode === sku.materialSkuCode))
}
