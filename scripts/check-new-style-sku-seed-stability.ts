// E2E-002/014: a new style must not change existing SKU activity or break unrelated production details.
import assert from 'node:assert/strict'
import { listStyleArchives, createStyleArchiveShell } from '../src/data/pcs-style-archive-repository.ts'
import { listSkuArchives, resetSkuArchiveRepository } from '../src/data/pcs-sku-archive-repository.ts'
const original = listSkuArchives().map(sku => ({ id: sku.skuId, code: sku.skuCode, status: sku.archiveStatus, barcode: sku.barcode }))
const style = listStyleArchives()[0]
createStyleArchiveShell({ ...style, styleId: 'style-new-acceptance-stability', styleCode: 'SPU-NEW-ACCEPTANCE-STABILITY', sourceProjectId: 'project-new-acceptance-stability', sourceProjectCode: 'PROJECT-NEW-ACCEPTANCE-STABILITY', sourceProjectName: '独立新增初始款式', sourceProjectNodeId: 'project-new-acceptance-stability-init', updatedAt: '2099-01-01 00:00:00' })
resetSkuArchiveRepository()
const after = new Map(listSkuArchives().map(sku => [sku.skuId, sku]))
for (const sku of original) {
 assert.equal(after.get(sku.id)?.archiveStatus, sku.status, `新增款式不得改变原SKU ${sku.code} 启停状态`)
 assert.equal(after.get(sku.id)?.barcode, sku.barcode, `新增款式不得改变原SKU ${sku.code} 条码`)
}
console.log('new style leaves existing SKU identities and active states unchanged')
