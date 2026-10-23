import assert from 'node:assert/strict'
import test from 'node:test'
import { getDefaultSewingSampleApprovalRecords, ensureSewingOutsourcingSampleDemo } from '../../src/data/fcs/sewing-outsourcing-demo.ts'
import { captureSewingSampleState, listSewingSampleApprovalRecords, resetSewingSampleApprovalSuggestionsForTests } from '../../src/data/fcs/sewing-sample-approval-suggestion.ts'
import { buildSampleQualitySummaryIndex, projectSampleQualityRecord, sampleQualityReadSource } from '../../src/data/fcs/sample-quality-read-source.ts'
import { openCuttingRecordDatabase, readCuttingRecordRevision } from '../../src/data/fcs/cutting/cutting-record-repository.ts'
import { installPmsMemoryIdb } from '../helpers/pms-memory-idb.ts'
import { assertProductionContextSourceReadable, PRODUCTION_CONTEXT_KEYS } from '../../src/data/fcs/production-context-records.ts'

const prefix = 'production-context:samples:'
const row = (record: ReturnType<typeof getDefaultSewingSampleApprovalRecords>[number]) => ({ id: `${prefix}${record.assignmentId}`, collection: 'production-context:samples', value: record })

test('当前样衣读取不读取旧演示键，也不依赖旧迁移标记', () => {
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'localStorage')
  let reads=0
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem(){reads++;throw Error('旧存储禁用')}}})
  try { assert.doesNotThrow(()=>assertProductionContextSourceReadable(PRODUCTION_CONTEXT_KEYS.samples)); assert.equal(reads,0) }
  finally {if(descriptor)Object.defineProperty(globalThis,'localStorage',descriptor);else Reflect.deleteProperty(globalThis,'localStorage')}
})

test('只读静态三件与原demo的完整样衣事实一致，不捕获或改写live记录', () => {
  resetSewingSampleApprovalSuggestionsForTests()
  const before = captureSewingSampleState()
  const defaults = getDefaultSewingSampleApprovalRecords()
  assert.equal(defaults.length, 3)
  assert.deepEqual(captureSewingSampleState(), before)
  ensureSewingOutsourcingSampleDemo()
  const live = listSewingSampleApprovalRecords()
  for (const expected of defaults) assert.deepEqual(live.find(record => record.assignmentId === expected.assignmentId), expected)
  defaults[2].sample.styleName = '外部副本不得修改静态基准'
  assert.notEqual(getDefaultSewingSampleApprovalRecords()[2].sample.styleName, defaults[2].sample.styleName)
})

test('列表只投影轻摘要，问题名来自本件冻结标准，首次意见结束连续48小时', () => {
  const record = getDefaultSewingSampleApprovalRecords()[2]
  const first = record.suggestionVersions[0]
  record.sample.approverReceivedInstant = '2026-10-16T08:15:00.000Z'
  first.uploadedInstant = '2026-10-18T08:15:00.000Z'
  first.uploadedAt = '2026-10-18 15:15:00'
  first.feedbackSentAt = '2026-10-22 18:00:00'
  const latest = structuredClone(first)
  latest.suggestionVersionId = 'OLD-SECOND'
  latest.uploadedInstant = '2026-10-20T08:00:00.000Z'
  record.suggestionVersions.push(latest)
  record.latestSuggestionVersionId = latest.suggestionVersionId
  const formatter = Intl.DateTimeFormat
  Intl.DateTimeFormat = function () { throw new Error('列表不得逐行格式化工厂时间') } as unknown as typeof Intl.DateTimeFormat
  let summary: ReturnType<typeof projectSampleQualityRecord>
  try { summary = projectSampleQualityRecord(record) } finally { Intl.DateTimeFormat = formatter }
  assert.equal(summary!.quantity, 1)
  assert.equal(summary!.sampleResult, 'HAS_ISSUE')
  assert.equal(summary!.completedAt, first.uploadedInstant)
  assert.equal(summary!.dueAt, '2026-10-18T08:15:00.000Z')
  assert.equal(summary!.timeZone, 'Asia/Jakarta')
  assert.equal(summary!.snapshot, undefined)
  assert.equal(summary!.rounds, undefined)
  assert.equal(summary!.inspectedQty, undefined)
  assert.equal(summary!.issueNames![first.issues![0].itemId], record.inspectionStandardSnapshot!.items[0].name)
  assert.equal(projectSampleQualityRecord(record, true).snapshot!.id, record.inspectionStandardSnapshot!.id)
  delete first.uploadedInstant
  assert.equal(projectSampleQualityRecord(record).dueAt, undefined, '旧首次意见墙钟无证据，不推定为绝对时间')
  delete record.sample.approverReceivedInstant
  assert.equal(projectSampleQualityRecord(record).dueAt, undefined)
})

test('原持久覆盖优先且canonical别名不增件，重复样衣身份及错行明确拒绝', () => {
  const defaults = getDefaultSewingSampleApprovalRecords(), saved = structuredClone(defaults[0])
  saved.sample.status = 'PPIC_RECEIVED'
  saved.assignmentAliases!.push({ assignmentId: 'SKU-PROJECTION-ALIAS', runtimeTaskId: 'SKU-PROJECTION-TASK' })
  const index = buildSampleQualitySummaryIndex(defaults, [row(saved)])
  assert.equal(index.summaries.length, 3)
  assert.equal(index.summaries.find(item => item.id === saved.sample.sampleId)!.status, '待转交批版')
  assert.equal(index.assignmentsBySampleId.get(saved.sample.sampleId), saved.assignmentId)
  const duplicate = structuredClone(defaults[1])
  duplicate.sample.sampleId = defaults[0].sample.sampleId
  assert.throws(() => buildSampleQualitySummaryIndex(defaults, [row(duplicate)]), /重复样衣编号/)
  assert.throws(() => buildSampleQualitySummaryIndex(defaults, [{ ...row(saved), id: `${prefix}wrong` }]), /保存身份/)
  assert.throws(() => buildSampleQualitySummaryIndex(defaults, [{ ...row(saved), collection: 'production-context:orders' }]), /保存身份/)
})

test('原库窄只读：冷详情任意sampleId、仅本件附件、revision刷新、失败不冒充静态或空源', async () => {
  const memory = installPmsMemoryIdb()
  const oldRange = Object.getOwnPropertyDescriptor(globalThis, 'IDBKeyRange')
  Object.defineProperty(globalThis, 'IDBKeyRange', { configurable: true, value: { bound: (lower: string, upper: string) => ({ lower, upper }) } })
  const db = await openCuttingRecordDatabase()
  const originalTransaction = db.transaction.bind(db)
  let writes = 0, fullReads = 0, prefixReads = 0, fileReads = 0
  db.transaction = ((names: string | string[], mode: IDBTransactionMode) => {
    if (mode === 'readwrite') writes++
    const tx = originalTransaction(names, mode), objectStore = tx.objectStore.bind(tx)
    tx.objectStore = ((name: string) => {
      const store = objectStore(name), getAll = store.getAll.bind(store), get = store.get.bind(store)
      store.getAll = ((range?: { lower: string; upper: string }) => {
        if (name === 'records') { if (range) prefixReads++; else fullReads++ }
        const request = getAll()
        if (!range) return request
        return new Proxy(request, { set(target, field, value) {
          if (field === 'onsuccess') { target.onsuccess = () => { (target as any).result = (target.result as Array<{ id: string }>).filter(item => item.id >= range.lower && item.id <= range.upper); value() }; return true }
          return Reflect.set(target, field, value)
        } })
      }) as IDBObjectStore['getAll']
      store.get = ((id: IDBValidKey | IDBKeyRange) => { if (name === 'files') fileReads++; return get(id) }) as IDBObjectStore['get']
      return store
    }) as IDBTransaction['objectStore']
    return tx
  }) as IDBDatabase['transaction']
  const save = async (records: unknown[], revision: number, files: Array<{ id: string; blob: Blob }> = []) => {
    const tx = db.transaction(['records', 'meta', 'files'], 'readwrite')
    const done = new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error) })
    for (const item of records) tx.objectStore('records').put(item)
    for (const item of files) tx.objectStore('files').put(item)
    tx.objectStore('meta').put({ id: 'revision', value: revision })
    await done
  }
  try {
    const sample = getDefaultSewingSampleApprovalRecords()[2]
    sample.assignmentId = 'COLD-ASG'; sample.sample.assignmentId = sample.assignmentId
    sample.sample.sampleId = 'arbitrary-old-sample-id'; sample.sample.runtimeTaskId = 'COLD-TASK'
    sample.sample.productionOrderId = 'COLD-ORDER'; sample.sample.productionOrderNo = 'COLD-ORDER'
    sample.assignmentAliases = [{ assignmentId: sample.assignmentId, runtimeTaskId: sample.sample.runtimeTaskId }]
    const first = sample.suggestionVersions[0]
    first.assignmentId = sample.assignmentId; first.sampleId = sample.sample.sampleId; first.runtimeTaskId = sample.sample.runtimeTaskId
    const fileId = `production-context-file:${'a'.repeat(64)}`
    sample.inspectionStandardSnapshot!.references = [{ id: 'own-image', name: '本件标准图', kind: 'DOCUMENT', imageUrl: { $productionFile: fileId } as unknown as string }]
    sample.inspectionStandardSnapshot!.items[0].references = [{ id: 'same-own-image', name: '同一原图的项目依据', kind: 'DOCUMENT', imageUrl: { $productionFile: fileId } as unknown as string }]
    const other = structuredClone(sample)
    other.assignmentId = 'OTHER-ASG'; other.sample.assignmentId = other.assignmentId; other.sample.sampleId = 'other-sample'
    other.sample.productionOrderId = 'OTHER-ORDER'; other.sample.productionOrderNo = 'OTHER-ORDER'
    other.inspectionStandardSnapshot!.references[0].imageUrl = { $productionFile: `production-context-file:${'b'.repeat(64)}` } as unknown as string
    await save([row(sample), row(other), { id: 'production-context:orders:unrelated', collection: 'production-context:orders', value: { noFullHydration: true } }], 1, [{ id: fileId, blob: new Blob(['matching-standard-image'], { type: 'image/png' }) }])
    const initialWrites = writes
    await sampleQualityReadSource.prepareDetail!(sample.sample.sampleId)
    assert.equal(fullReads, 0); assert.equal(prefixReads, 1); assert.equal(fileReads, 1)
    assert.equal(sampleQualityReadSource.get!(sample.sample.sampleId)!.snapshot!.references[0].imageUrl!.startsWith('blob:'), true)
    assert.equal(await readCuttingRecordRevision(), 1)
    await sampleQualityReadSource.prepare!()
    assert.equal(prefixReads, 1, '冷详情已建立薄摘要，随后同revision列表不重扫')
    assert.equal(sampleQualityReadSource.list().length, 5)
    assert.equal(sampleQualityReadSource.list().find(item => item.id === sample.sample.sampleId)!.snapshot, undefined)
    assert.equal(writes, initialWrites, '普通原源读取零业务写')
    sample.sample.status = 'FEEDBACK_SENT'
    await save([row(sample)], 2)
    const nextWrites = writes
    await sampleQualityReadSource.prepare!()
    assert.equal(sampleQualityReadSource.list().find(item => item.id === sample.sample.sampleId)!.status, '已反馈工厂')
    assert.equal(writes, nextWrites)
    await sampleQualityReadSource.prepareDetail!('other-sample').then(() => assert.fail('缺附件不应成功'), error => assert.match(error.message, /附件缺失/))
    assert.equal(sampleQualityReadSource.get!('other-sample'), undefined)
    assert.equal(writes, nextWrites)
  } finally {
    if (oldRange) Object.defineProperty(globalThis, 'IDBKeyRange', oldRange); else Reflect.deleteProperty(globalThis, 'IDBKeyRange')
    memory.restore()
  }
})
