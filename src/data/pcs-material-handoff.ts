import { getMaterialArchiveById, getMaterialSkuRecordById, getMaterialProcessDefinition, materialProcessOrderIntent, isMaterialSkuAvailableForNewUse } from './pcs-material-archive-repository.ts'
import type { MaterialProcessDefinition, MaterialSkuRecord } from './pcs-material-archive-types.ts'

/** Stable IDs are the handoff contract. The receiving domain owns its document and validation. */
export interface PcsMaterialHandoff {
  kind: 'PURCHASE' | 'PROCESS'
  target: MaterialSkuRecord
  input?: MaterialSkuRecord
  process?: MaterialProcessDefinition
  returnPath: string
}
export function materialPurchaseHandoffPath(skuId: string): string {
  const sku = getMaterialSkuRecordById(skuId)
  if (!isMaterialSkuAvailableForNewUse(sku)) throw new Error('物料 SKU 及其主档须已审核并启用，才能发起采购。')
  return `/pms/material-purchase-orders?${new URLSearchParams({ pcsIntent: 'purchase', materialSkuId: skuId })}`
}
export function materialProcessHandoffPath(skuId: string): string {
  const intent = materialProcessOrderIntent(skuId)
  return `/fcs/process/material-plans/new?${new URLSearchParams({ pcsIntent: 'process', inputSkuId: intent.inputSkuId, outputSkuId: intent.outputSkuId, processDefinitionId: intent.processDefinitionId, processVersionId: intent.processVersionId })}`
}
export function readPcsMaterialHandoff(search = typeof window === 'undefined' ? '' : window.location.search): PcsMaterialHandoff | null {
  const params = new URLSearchParams(search), intent = params.get('pcsIntent')
  if (intent !== 'purchase' && intent !== 'process') return null
  const sku = getMaterialSkuRecordById(params.get(intent === 'purchase' ? 'materialSkuId' : 'outputSkuId') || '')
  const root = sku && getMaterialArchiveById(sku.materialId)
  if (!sku || !root) throw new Error('来源物料不存在，请返回物料档案重新选择。')
  const returnPath = `/pcs/materials/${root.kind}/${root.materialId}/skus/${sku.materialSkuId}`
  if (intent === 'purchase') {
    if (!isMaterialSkuAvailableForNewUse(sku)) throw new Error('物料 SKU 及其主档须已审核并启用，才能发起采购。')
    return { kind: 'PURCHASE', target: sku, returnPath }
  }
  materialProcessOrderIntent(sku.materialSkuId)
  const process = getMaterialProcessDefinition(sku.materialSkuId)
  const input = process && getMaterialSkuRecordById(process.inputSkuId)
  if (!input || !process || process.processDefinitionId !== params.get('processDefinitionId') || input.materialSkuId !== params.get('inputSkuId')) throw new Error('投入料、目标料与加工定义不一致，请返回目标物料重新发起。')
  if (params.get('processVersionId') && process.processVersionId !== params.get('processVersionId')) throw new Error('加工资料版本已变化，请返回目标物料重新发起。')
  return { kind: 'PROCESS', target: sku, input, process, returnPath }
}
