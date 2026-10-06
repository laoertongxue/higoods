import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { pcsRecordStore } from '../src/data/pcs-record-runtime.ts'
import * as repo from '../src/data/pcs-material-archive-repository.ts'
import { renderMaterialApprovalBatchResults, renderPcsMaterialArchiveEditPage, buildMaterialRootEditorDraft } from '../src/pages/pcs-material-archives.ts'

const baseline = repo.getMaterialArchiveBaseline()
beforeEach(() => {
  pcsRecordStore.setItem(repo.MATERIAL_ARCHIVE_STORAGE_KEY, JSON.stringify(baseline))
  repo.resetMaterialArchiveCache()
})

test('GOV-005: editing an approved material name or remark preserves exact locked technical values', () => {
  const root = repo.getMaterialArchiveById('material-r1-MAT-FB-00000001')!
  assert.equal(root.approvalStatus, 'APPROVED')
  renderPcsMaterialArchiveEditPage(root.kind, root.materialId)
  const input = buildMaterialRootEditorDraft()
  const saved = repo.updateMaterialArchive(root.materialId, { ...input, remark: '仅补充备注' })
  assert.equal(saved.remark, '仅补充备注')
  for (const key of ['composition', 'widthText', 'gramWeightText', 'compositionItems', 'categoryAttributes', 'equipmentCompatibility', 'equipmentCompatibilityDetails', 'templateId', 'templateVersion'] as const) {
    assert.equal(JSON.stringify(saved[key]), JSON.stringify(root[key]), `备注修改不得重算 ${key}`)
  }
  assert.throws(() => repo.updateMaterialArchive(root.materialId, { ...saved, widthText: '999 cm' }), /技术规格/)
})

function ropeDraft(extra: Partial<repo.MaterialArchiveDraft> = {}): repo.MaterialArchiveDraft {
  return { kind: 'accessory', materialName: '3 mm 编织绳', materialNameEn: 'Cord', categoryName: '绳子', specSummary: '直径 3 mm',
    composition: '', processTags: [], widthText: '', gramWeightText: '', pricingUnit: 'M', mainImageUrl: '/materials/tmf/rope-real-bundle.jpg',
    barcodeTemplateCode: 'material-label-r1', remark: '', categoryAttributes: { material: '涤纶', construction: '编织', diameter: 3 }, ...extra }
}

test('MAT: rope diameter uses the structured 3 mm template field and survives rereading', () => {
  const root = repo.createMaterialArchive(ropeDraft())
  assert.equal(root.categoryAttributes?.diameter, 3)
  assert.equal(root.categoryAttributes?.width, undefined)
  repo.resetMaterialArchiveCache()
  const reread = repo.getMaterialArchiveById(root.materialId)!
  assert.equal(reread.categoryAttributes?.diameter, 3)
  const saved = repo.updateMaterialArchive(root.materialId, { ...reread, materialName: '3 mm 编织绳（名称调整）' })
  assert.equal(saved.categoryAttributes?.diameter, 3)
})

test('MAT: existing rope text dimensions remain editable without inventing a numeric diameter', () => {
  const root = repo.createMaterialArchive(ropeDraft({ categoryAttributes: { material: '涤纶' }, widthText: '直径 3 mm' }))
  const saved = repo.updateMaterialArchive(root.materialId, { ...root, remark: '仅补充说明' })
  assert.equal(saved.widthText, '直径 3 mm')
  assert.equal(saved.categoryAttributes?.diameter, undefined)
  const webbing = repo.createMaterialArchive(ropeDraft({ categoryName: '织带', categoryAttributes: { width: 20 }, widthText: '' }))
  assert.equal(webbing.categoryAttributes?.width, 20)
})

test('MAT: invalid explicit rope diameters cannot pass using an old width text value', () => {
  for (const diameter of [0, -3, '3 mm', ['3'], Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(() => repo.createMaterialArchive(ropeDraft({ categoryAttributes: { diameter }, widthText: '3 mm' })), /绳子直径/)
  }
  assert.throws(() => repo.createMaterialArchive(ropeDraft({ categoryAttributes: {}, widthText: '绳径待确认' })), /正数和单位/)
  assert.throws(() => repo.createMaterialArchive(ropeDraft({ categoryAttributes: {}, widthText: '-3 mm' })), /正数和单位/)
})

function archive(code: string) {
  const source = repo.getMaterialArchiveById('material-r1-MAT-FB-00000001')!
  const sku = repo.getMaterialSkuRecordById('material-r1-MAT-FB-00000001-B01')!
  return repo.createMaterialArchive({ ...source, materialCode: code, materialName: code, firstSku: { ...sku, purchaseStandardCny: null, transportStandardCny: null } })
}

/** The real runtime owns IndexedDB; this seam models its per-command rollback. */
function atomicCommit(failOperation?: string, calls: string[] = []) {
  return async (recipe: () => void, operationId: string) => {
    calls.push(operationId)
    const before = repo.getMaterialArchiveStoreSnapshot()
    try {
      recipe()
      await Promise.resolve()
      if (operationId.endsWith(`:${failOperation}`)) throw new Error('事务未完成：模拟存储失败')
    } catch (error) {
      pcsRecordStore.setItem(repo.MATERIAL_ARCHIVE_STORAGE_KEY, JSON.stringify(before))
      repo.resetMaterialArchiveCache()
      throw error
    }
  }
}

test('GOV-022: first validation failure does not cancel later material approvals; each item has its own result', async () => {
  const invalid = archive('BATCH-DRAFT'), first = archive('BATCH-PENDING-1'), second = archive('BATCH-PENDING-2')
  repo.setMaterialApproval(first.materialId, 'SUBMIT')
  repo.setMaterialApproval(second.materialId, 'SUBMIT')
  const calls: string[] = []
  const results = await repo.runMaterialApprovalBatch([invalid.materialId, first.materialId, second.materialId], 'APPROVE', 'batch-1', atomicCommit(undefined, calls))
  assert.deepEqual(results.map(item => item.ok), [false, true, true])
  assert.match(results[0].message, /先提交审核/)
  assert.deepEqual(results.map(item => item.code), ['BATCH-DRAFT', 'BATCH-PENDING-1', 'BATCH-PENDING-2'])
  assert.equal(new Set(calls).size, 3)
  assert.equal(repo.getMaterialArchiveById(invalid.materialId)?.approvalStatus, 'DRAFT')
  assert.equal(repo.getMaterialArchiveById(second.materialId)?.approvalStatus, 'APPROVED')
  const html = renderMaterialApprovalBatchResults(results, 3)
  assert.match(html, /本次选中 3 项，已保存 2 项，未保存 1 项/)
  assert.match(html, /BATCH-DRAFT/)
  assert.match(html, /请先提交审核/)
})

test('GOV-022: a failed persistence completion is not a success and cannot undo other items', async () => {
  const first = archive('BATCH-SAVED-1'), failed = archive('BATCH-ABORTED'), last = archive('BATCH-SAVED-2')
  for (const item of [first, failed, last]) repo.setMaterialApproval(item.materialId, 'SUBMIT')
  const beforeLogs = repo.listMaterialLogRecordsByMaterialId(failed.materialId).length
  const results = await repo.runMaterialApprovalBatch([first.materialId, failed.materialId, last.materialId], 'APPROVE', 'batch-2', atomicCommit(failed.materialId))
  assert.deepEqual(results.map(item => item.ok), [true, false, true])
  assert.match(results[1].message, /事务未完成/)
  assert.equal(repo.getMaterialArchiveById(failed.materialId)?.approvalStatus, 'PENDING')
  assert.equal(repo.listMaterialLogRecordsByMaterialId(failed.materialId).length, beforeLogs)
  assert.equal(repo.getMaterialArchiveById(first.materialId)?.approvalStatus, 'APPROVED')
  assert.equal(repo.getMaterialArchiveById(last.materialId)?.approvalStatus, 'APPROVED')
})

test('GOV-022: each selected root and its child SKUs succeed or fail together', async () => {
  const failed = archive('BATCH-BAD-CHILD'), good = archive('BATCH-GOOD-CHILD')
  const firstSku = repo.listMaterialSkuRecordsByMaterialId(failed.materialId)[0]
  const badSku = repo.createMaterialSkuRecord(failed.materialId, { ...firstSku, colorName: '黑色', colorCode: 'black' })!
  repo.updateMaterialSkuRecord(badSku.materialSkuId, { ...badSku, skuImageUrl: '' })
  const results = await repo.runMaterialApprovalBatch([failed.materialId, good.materialId], 'SUBMIT', 'batch-3', atomicCommit())
  assert.deepEqual(results.map(item => item.ok), [false, true])
  assert.match(results[0].message, /识别图/)
  assert.equal(repo.getMaterialArchiveById(failed.materialId)?.approvalStatus, 'DRAFT')
  assert.ok(repo.listMaterialSkuRecordsByMaterialId(failed.materialId).every(item => item.approvalStatus === 'DRAFT'))
  assert.equal(repo.getMaterialArchiveById(good.materialId)?.approvalStatus, 'PENDING')
})

test('GOV-022: next item and batch results wait for prior transaction completion', async () => {
  const first = archive('BATCH-WAIT-1'), next = archive('BATCH-WAIT-2')
  const calls: string[] = []
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  let completed = false
  const pending = repo.runMaterialApprovalBatch([first.materialId, next.materialId], 'SUBMIT', 'batch-4', async (recipe, operationId) => {
    calls.push(operationId)
    if (calls.length === 1) await gate
    await atomicCommit()(recipe, operationId)
  }).then(results => { completed = true; return results })
  await Promise.resolve()
  assert.equal(calls.length, 1)
  assert.equal(completed, false)
  release()
  const results = await pending
  assert.equal(calls.length, 2)
  assert.ok(results.every(item => item.ok))
})

test('GOV-019: list rows and statistics follow the same search and status scope', () => {
  const source = repo.getMaterialArchiveById('material-r1-MAT-FB-00000001')!
  const sku = repo.getMaterialSkuRecordById('material-r1-MAT-FB-00000001-B01')!
  const root = repo.createMaterialArchive({ ...source, materialCode: 'LIST-SCOPE-ONE', materialName: '查询专用', firstSku: { ...sku, purchaseStandardCny: null, transportStandardCny: null } })
  const other = repo.createMaterialArchive({ ...source, materialCode: 'LIST-SCOPE-EMPTY', materialName: '空主档', firstSku: undefined })
  const query = repo.queryMaterialArchiveList('fabric', { view: 'root', search: 'LIST-SCOPE-ONE' })
  assert.deepEqual(query.roots.map(row => row.materialId), [root.materialId])
  assert.deepEqual(query.stats, { total: 1, skuCount: 1, pending: 0, incompleteCost: 1 })
  assert.equal(repo.queryMaterialArchiveList('fabric', { view: 'root', search: 'LIST-SCOPE', status: 'ACTIVE' }).stats.total, 0)
  assert.ok(repo.queryMaterialArchiveList('fabric', { view: 'root', search: 'LIST-SCOPE' }).roots.some(row => row.materialId === other.materialId))
  assert.equal(repo.queryMaterialArchiveList('fabric', { view: 'sku', search: 'LIST-SCOPE-EMPTY' }).stats.total, 0)
  query.roots[0].materialName = '不能改写真实资料'
  query.skus[0].materialSkuCode = '不能改写规格'
  assert.equal(repo.getMaterialArchiveById(root.materialId)?.materialName, '查询专用')
  assert.notEqual(repo.listMaterialSkuRecordsByMaterialId(root.materialId)[0].materialSkuCode, query.skus[0].materialSkuCode)
})

test('GOV-019: material process filters use explicit predecessors and never infer from code', () => {
  const query = repo.queryMaterialArchiveList('fabric', { view: 'sku', process: 'DYEING' })
  assert.ok(query.skus.length > 0)
  for (const sku of query.skus) assert.ok(repo.listMaterialSkuLineage(sku.materialSkuId).some(row => row.stage === 'DYEING'))
  assert.equal(query.stats.skuCount, query.skus.length)
  assert.equal(query.stats.incompleteCost, query.skus.filter(sku => repo.getMaterialStandardCost(sku.materialSkuId).completeness.length).length)
})
