import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { pcsRecordStore } from '../src/data/pcs-record-runtime.ts'
import * as repo from '../src/data/pcs-material-archive-repository.ts'
import { buildMaterialBusinessTemplate, materialTransferHeaders, materialRowsToCsv, parseMaterialBusinessCsv, previewMaterialBusinessImport, runMaterialBusinessImportBatch, type MaterialImportCommit } from '../src/data/pcs-material-transfer.ts'
import { renderMaterialImportResults } from '../src/pages/pcs-material-archives.ts'

const baseline = repo.getMaterialArchiveBaseline()
beforeEach(() => { pcsRecordStore.setItem(repo.MATERIAL_ARCHIVE_STORAGE_KEY, JSON.stringify(baseline)); repo.resetMaterialArchiveCache() })
const sample = (code: string) => {
  const [headers, row] = parseMaterialBusinessCsv(buildMaterialBusinessTemplate('fabric', 'archives'))
  return { ...Object.fromEntries(headers.map((header, index) => [header, row[index]])), '物料编码': code }
}
const previewRows = (rows: Record<string, string>[]) => {
  const headers = materialTransferHeaders('archives')
  return previewMaterialBusinessImport('fabric', 'archives', materialRowsToCsv([headers, ...rows.map(row => headers.map(header => row[header] || ''))]))
}
function atomicCommit(calls: string[], failKey?: string): MaterialImportCommit {
  return async (recipe, operationId) => {
    calls.push(operationId)
    const before = repo.getMaterialArchiveStoreSnapshot()
    try {
      const result = recipe()
      await Promise.resolve()
      if (failKey && operationId.endsWith(`:${encodeURIComponent(failKey)}`)) throw new Error('事务中止：本组存储未完成')
      return result
    } catch (error) {
      pcsRecordStore.setItem(repo.MATERIAL_ARCHIVE_STORAGE_KEY, JSON.stringify(before))
      repo.resetMaterialArchiveCache()
      throw error
    }
  }
}

test('GOV-008: a middle group persistence failure preserves other groups and retry skips saved roots', async () => {
  const first = sample('CSV-INDEPENDENT-A'), failed = sample('CSV-INDEPENDENT-B'), last = sample('CSV-INDEPENDENT-C')
  const preview = previewRows([first, { ...first, 'SKU颜色': '黑色', 'SKU颜色编码': 'black' }, failed, last])
  const calls: string[] = []
  const results = await runMaterialBusinessImportBatch(preview, 'import-batch', [], atomicCommit(calls, failed['物料编码']))
  assert.deepEqual(results.map(row => row.ok), [true, false, true])
  assert.equal(new Set(calls).size, 3)
  assert.equal(repo.listMaterialSkuRecordsByMaterialId(repo.getMaterialArchiveByCode(first['物料编码'])!.materialId).length, 2)
  assert.equal(repo.getMaterialArchiveByCode(failed['物料编码']), null)
  assert.ok(repo.getMaterialArchiveByCode(last['物料编码']))
  assert.deepEqual(results[1].codes, [])
  assert.match(results[1].message, /事务中止/)
  const html = renderMaterialImportResults(results)
  assert.match(html, /共 3 组，已保存 2 组，未保存 1 组/)
  assert.match(html, /源文件行号/)
  assert.match(html, /CSV-INDEPENDENT-B/)
  assert.match(html, /本组存储未完成/)
  const failedOperation = calls[1]
  const retried = await runMaterialBusinessImportBatch(preview, 'import-batch', results, atomicCommit(calls))
  assert.ok(retried.every(row => row.ok))
  assert.equal(calls.length, 4)
  assert.equal(calls[3], failedOperation)
  assert.equal(repo.listMaterialSkuRecordsByMaterialId(repo.getMaterialArchiveByCode(first['物料编码'])!.materialId).length, 2)
  await runMaterialBusinessImportBatch(preview, 'import-batch', retried, atomicCommit(calls))
  assert.equal(calls.length, 4)
})

test('GOV-008: a late child failure rolls back its entire root and keeps the exact failed line', async () => {
  const row = sample('CSV-LATE-CHILD'), other = sample('CSV-AFTER-CHILD')
  const preview = previewRows([row, { ...row, 'SKU颜色': '黑色', 'SKU颜色编码': 'black' }, other])
  assert.equal(preview.validGroups, 2)
  preview.groups[0].rows[1].values['SKU颜色编码'] = 'white'
  const results = await runMaterialBusinessImportBatch(preview, 'late-child', [], atomicCommit([]))
  assert.deepEqual(results.map(result => result.ok), [false, true])
  assert.match(results[0].message, /第 3 行.*身份规格已存在/)
  assert.deepEqual(results[0].lineNumbers, [2, 3])
  assert.equal(repo.getMaterialArchiveByCode(row['物料编码']), null)
  assert.ok(!repo.getMaterialArchiveStoreSnapshot().skuRecords.some(sku => sku.materialCode === row['物料编码']))
  assert.ok(repo.getMaterialArchiveByCode(other['物料编码']))
})

test('GOV-008: prepared groups commit without full preview replay and invalid rows stay visible', async () => {
  const bad = { ...sample('CSV-PRECHECK-BAD'), '主计量单位': '不存在' }, good = sample('CSV-PRECHECK-GOOD')
  const preview = previewRows([bad, good]), calls: string[] = []
  assert.equal(preview.failedRows, 1)
  Object.defineProperty(preview, 'rows', { get: () => { throw new Error('不能重新扫描完整预览行') } })
  const results = await runMaterialBusinessImportBatch(preview, 'reuse-preview', [], atomicCommit(calls))
  assert.equal(calls.length, 1)
  assert.deepEqual(results.map(result => result.ok), [false, true])
  assert.match(results[0].message, /未提交：第 2 行/)
  assert.equal(repo.getMaterialArchiveByCode(bad['物料编码']), null)
  assert.ok(repo.getMaterialArchiveByCode(good['物料编码']))
})

test('GOV-008: the next import group and success result wait for transaction completion', async () => {
  const preview = previewRows([sample('CSV-WAIT-FIRST'), sample('CSV-WAIT-NEXT')]), calls: string[] = []
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  let settled = false
  const pending = runMaterialBusinessImportBatch(preview, 'wait-import', [], async (recipe, operationId) => {
    calls.push(operationId)
    if (calls.length === 1) await gate
    return atomicCommit([])(recipe, operationId)
  }).then(results => { settled = true; return results })
  await Promise.resolve()
  assert.equal(calls.length, 1)
  assert.equal(settled, false)
  release()
  const results = await pending
  assert.equal(calls.length, 2)
  assert.ok(results.every(result => result.ok))
})
