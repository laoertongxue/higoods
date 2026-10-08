import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { timingDocumentHref } from '../../src/data/production-timing/source.ts'

type TaskKind = 'sewing' | 'combined' | 'full'
type Position = 'qc' | 'processing' | 'recheck' | 'delivery' | 'warehouse' | 'unknown'
interface Document {
  id: string; no: string; type: string; status: string; object: string; quantity: number; unit: string
  taskId?: string; batchId?: string; executionScope?: string; processingLocation?: string
  times: Record<string, string | null>; related: string[]; executor: string; receiver: string
  quantities?: Record<string, number | null>; note?: string
  nativePath?: string
  processItems?: string[]; sourceType?: string
  qc?: string; barcodeStatus?: string
  clock?: { kind: string; start: string | null; end: string | null; sla?: number }
}
interface Task {
  id: string; type: TaskKind; held: number; assigned: string; picked: string | null
  receipts: { at: string; qty: number }[]; receiptDocumentIds: string[]
}
interface Batch {
  id: string; taskId: string; qty: number; position: Position; receiveDocumentId: string
  qcDocumentId: string | null; processingDocumentId: string | null
  recheckDocumentId: string | null; outboundDocumentId: string | null; inboundDocumentId: string | null
}
interface Fixture {
  order: {
    key: string; order: string | null; purchases: { qty: number }[]; tasks: Task[]
    warehouse: number | null; warehouseAt: string | null
    processing: { qty: number } | null; inbound: { qty: number } | null
    fullFlow: {
      allocationStatus: string; allocationDocuments: string[]
      execution: { taskId: string; type: TaskKind; steps: { kind: string; documentId: string }[] }[]
      postStatus: string; batches: Batch[]; unlocatedQty: number | null
    }
  }
  branch: { docs: Record<string, Document> }
}
const fixtures = JSON.parse(readFileSync(new URL('../../src/data/production-timing/fixtures.json', import.meta.url), 'utf8')) as Fixture[]
const timestamp = (value: string | null | undefined) => value ? Date.parse(value.replace(' ', 'T') + '+08:00') : null
const asOf = timestamp('2026-10-07 09:00')!
const receiptTotal = (task: Task) => task.receipts.reduce((sum, record) => sum + record.qty, 0)
const sum = (batches: Batch[]) => batches.reduce((total, batch) => total + batch.qty, 0)
const scene = (key: string) => fixtures.find(fixture => fixture.order.key === key)!
const document = (fixture: Fixture, id: string | null) => {
  assert.ok(id, `${fixture.order.key}: expected a registered document`)
  const result = fixture.branch.docs[id]
  assert.ok(result, `${fixture.order.key}: missing ${id}`)
  return result
}

test('FLOW-MOCK-001: all 20 scenarios retain source facts with documented COPY-211 cutting correction', () => {
  const original = structuredClone(fixtures)
  for (const fixture of original) {
    delete (fixture.order as Partial<Fixture['order']>).fullFlow
    for (const id of Object.keys(fixture.branch.docs)) if (id.includes('/full-flow/')) delete fixture.branch.docs[id]
  }
  assert.equal(createHash('sha256').update(JSON.stringify(original)).digest('hex'),
    '3d3ee230d2e7d5f557d66526c334a4e9bbde9b73df196f11b02609fb491ad1a3',
    'purchase, allocation, receipts, warehouse and clocks are preserved; COPY-211 corrects the overlapping fullContract cutting scope')
  assert.equal(fixtures.length, 20)
  assert.equal(new Set(fixtures.map(fixture => fixture.order.key)).size, 20)
})

test('FLOW-MOCK-002: every early-stage scenario has an honest full-flow skeleton and unknown purchase has no invented work', () => {
  for (const fixture of fixtures) {
    const { order } = fixture, flow = order.fullFlow
    assert.ok(flow, `${order.key}: missing full-flow skeleton`)
    if (!order.tasks.length) {
      assert.equal(flow.allocationStatus, order.order ? '尚未分配' : '资料待核实')
      assert.equal(flow.postStatus, order.order ? '尚未进入' : '资料待核实')
      assert.deepEqual(flow.allocationDocuments, [])
      assert.deepEqual(flow.execution, [])
      assert.deepEqual(flow.batches, [])
      assert.equal(Object.keys(fixture.branch.docs).filter(id => id.includes('/full-flow/')).length, 0)
    }
  }
  const pending = scene('unknown')
  assert.equal(Object.values(pending.branch.docs).length, 1)
  assert.equal(Object.values(pending.branch.docs)[0].type, '商品采购单')
  assert.equal(pending.order.fullFlow.unlocatedQty, null)
})

test('FLOW-MOCK-003: allocation and actual sewing are distinct and each of the three contract scopes has only its applicable steps', () => {
  const kinds = new Set<TaskKind>()
  const expected = { sewing: ['车缝'], combined: ['车缝', '烫包'], full: ['裁剪', '车缝', '烫包'] }
  const types = { 车缝: '车缝执行单', 裁剪: '承包裁剪执行单', 烫包: '工厂烫包执行单' }
  for (const fixture of fixtures) {
    const { order } = fixture, flow = order.fullFlow
    assert.equal(flow.execution.length, order.tasks.length)
    assert.equal(flow.allocationDocuments.length, order.tasks.length)
    for (const task of order.tasks) {
      kinds.add(task.type)
      const allocation = flow.allocationDocuments.map(id => document(fixture, id)).find(record => record.object.includes(task.id))!
      assert.ok(allocation)
      assert.equal(allocation.type, '车缝任务分配合同')
      const execution = flow.execution.find(record => record.taskId === task.id)!
      assert.equal(execution.type, task.type)
      assert.deepEqual(execution.steps.map(step => step.kind), expected[task.type])
      for (const step of execution.steps) {
        const record = document(fixture, step.documentId)
        assert.equal(record.taskId, task.id)
        assert.equal(record.type, types[step.kind as keyof typeof types])
        assert.equal(record.quantity, task.held)
        assert.ok(record.related.includes(allocation.id))
        assert.ok(record.related.includes(`${order.order}/pickup-${task.id}`))
        assert.ok(!record.clock?.sla, 'contract return deadlines are not per-process SLAs')
      }
    }
  }
  assert.deepEqual([...kinds].sort(), ['combined', 'full', 'sewing'])
  assert.deepEqual(scene('fullContract').order.fullFlow.execution.map(item => item.type), ['combined', 'full', 'sewing'])
})

test('FLOW-MOCK-004: batches partition original receipts within each task and each source receipt exactly once', () => {
  for (const fixture of fixtures) {
    const { order } = fixture, batches = order.fullFlow.batches
    assert.equal(sum(batches), order.tasks.reduce((total, task) => total + receiptTotal(task), 0), order.key)
    for (const task of order.tasks) {
      assert.equal(sum(batches.filter(batch => batch.taskId === task.id)), receiptTotal(task), `${order.key}/${task.id}`)
      for (let index = 0; index < task.receipts.length; index++) {
        const source = task.receiptDocumentIds[index]
        const children = batches.filter(batch => document(fixture, batch.receiveDocumentId).related.includes(source))
        assert.equal(sum(children), task.receipts[index].qty, `${order.key}/${source}: split receipts must not duplicate or lose quantity`)
        for (const batch of children) {
          assert.equal(document(fixture, batch.receiveDocumentId).times.后道实收, task.receipts[index].at)
        }
      }
    }
  }
})

test('FLOW-MOCK-005: actual positions preserve warehouse, delivery, processing aggregate amounts and explicit unknown remainder', () => {
  for (const { order } of fixtures) {
    const { batches, unlocatedQty } = order.fullFlow
    if (!order.order) continue
    assert.equal(sum(batches.filter(batch => batch.position === 'warehouse')), order.warehouse, order.key)
    assert.equal(sum(batches.filter(batch => batch.position === 'delivery')), order.inbound?.qty ?? 0, order.key)
    assert.equal(sum(batches.filter(batch => ['qc', 'processing', 'recheck'].includes(batch.position))), order.processing?.qty ?? 0, order.key)
    assert.equal(sum(batches.filter(batch => batch.position === 'unknown')), unlocatedQty, order.key)
    const required = order.purchases.reduce((total, purchase) => total + purchase.qty, 0)
    const held = order.tasks.reduce((total, task) => total + task.held, 0)
    const received = order.tasks.reduce((total, task) => total + receiptTotal(task), 0)
    const notYetAllocated = required - held, factoryNotReturned = held - received
    assert.ok(notYetAllocated >= 0 && factoryNotReturned >= 0)
    assert.equal(notYetAllocated + factoryNotReturned + sum(batches), required, order.key)
  }
  assert.equal(scene('partial').order.fullFlow.unlocatedQty, 150)
  assert.ok(scene('partial').order.fullFlow.batches.filter(batch => batch.position === 'unknown').every(batch =>
    !batch.qcDocumentId && !batch.processingDocumentId && !batch.recheckDocumentId && !batch.outboundDocumentId && !batch.inboundDocumentId))
})

test('FLOW-MOCK-006: current QC, processing, recheck, delivery and warehouse positions have distinct document facts', () => {
  const positions = new Set<Position>()
  for (const fixture of fixtures) for (const batch of fixture.order.fullFlow.batches) {
    positions.add(batch.position)
    const receipt = document(fixture, batch.receiveDocumentId)
    assert.equal(receipt.type, '后道实收记录')
    if (batch.position === 'unknown') continue
    const qc = document(fixture, batch.qcDocumentId)
    const recheck = batch.recheckDocumentId ? document(fixture, batch.recheckDocumentId) : null
    const out = batch.outboundDocumentId ? document(fixture, batch.outboundDocumentId) : null
    assert.equal(qc.type, '后道质检单')
    if (recheck) assert.equal(recheck.type, '后道复检单')
    if (out) assert.equal(out.type, '后道交货单')
    if (batch.position === 'qc') {
      assert.ok(['待质检', '质检中'].includes(qc.status))
      assert.equal(qc.times.质检完成, null)
      if (qc.status === '待质检') {
        assert.equal(qc.times.质检开始, null)
        assert.equal(qc.quantities?.已检, 0)
        assert.equal(qc.quantities?.合格, null)
      } else {
        assert.ok(qc.times.质检开始)
        assert.ok(qc.quantities!.已检! > 0 && qc.quantities!.已检! < batch.qty)
      }
    } else assert.ok(qc.times.质检完成)
    if (batch.position === 'processing') {
      assert.ok(batch.processingDocumentId)
      assert.ok(['待后道', '后道中'].includes(document(fixture, batch.processingDocumentId).status))
      assert.equal(recheck, null)
      assert.equal(out, null)
    }
    if (batch.position === 'recheck') {
      assert.ok(batch.processingDocumentId)
      assert.ok(document(fixture, batch.processingDocumentId).times.后道完成)
      assert.equal(recheck!.status, '待复检')
      assert.equal(out, null)
    }
    if (batch.position === 'delivery') {
      if (batch.processingDocumentId) assert.ok(recheck!.times.复检完成)
      else assert.equal(recheck, null)
      assert.ok(out!.times.后道交出)
      assert.equal(out!.times.成衣仓接收, null)
      assert.equal(batch.inboundDocumentId, null)
    }
    if (batch.position === 'warehouse') {
      if (batch.processingDocumentId) assert.ok(recheck!.times.复检完成)
      else assert.equal(recheck, null)
      assert.ok(out!.times.后道交出)
      assert.equal(document(fixture, batch.inboundDocumentId).type, '成衣仓入库单')
    }
  }
  assert.deepEqual([...positions].sort(), ['delivery', 'processing', 'qc', 'recheck', 'unknown', 'warehouse'])
  const live = scene('live').order.fullFlow.batches
  for (const position of ['qc', 'processing', 'recheck']) assert.equal(sum(live.filter(batch => batch.position === position)), 50)
  const qcInProgress = scene('sampleLate').order.fullFlow.batches.find(batch => batch.position === 'qc')!
  assert.equal(document(scene('sampleLate'), qcInProgress.qcDocumentId).status, '质检中')
})

test('FLOW-MOCK-007: batch event chronology is ordered and all recorded actual events precede the fixed viewing time', () => {
  for (const fixture of fixtures) {
    for (const record of Object.values(fixture.branch.docs).filter(record => record.id.includes('/full-flow/'))) {
      for (const value of Object.values(record.times)) if (value) assert.ok(timestamp(value)! <= asOf, `${record.id}: future actual event ${value}`)
      if (record.clock?.start && record.clock.end) assert.ok(timestamp(record.clock.start)! <= timestamp(record.clock.end)!, `${record.id}: reversed clock`)
      assert.equal(record.clock?.sla, undefined)
    }
    for (const batch of fixture.order.fullFlow.batches) {
      const events: (number | null)[] = [timestamp(document(fixture, batch.receiveDocumentId).times.后道实收)]
      if (batch.qcDocumentId) {
        const qc = document(fixture, batch.qcDocumentId)
        events.push(timestamp(qc.times.质检开始), timestamp(qc.times.质检完成))
      }
      if (batch.processingDocumentId) {
        const work = document(fixture, batch.processingDocumentId)
        events.push(timestamp(work.times.后道开始), timestamp(work.times.后道完成))
      }
      if (batch.recheckDocumentId) {
        const recheck = document(fixture, batch.recheckDocumentId)
        events.push(timestamp(recheck.times.复检开始), timestamp(recheck.times.复检完成))
      }
      if (batch.outboundDocumentId) {
        const delivery = document(fixture, batch.outboundDocumentId)
        events.push(timestamp(delivery.times.后道交出), timestamp(delivery.times.成衣仓接收))
      }
      const known = events.filter((value): value is number => value !== null)
      for (let index = 1; index < known.length; index++) assert.ok(known[index] >= known[index - 1], `${fixture.order.key}/${batch.id}: post sequence reversed`)
    }
  }
})

test('FLOW-MOCK-008: completed orders keep complete post history and missing last inbound time is never fabricated', () => {
  for (const key of ['complete', 'completeLate', 'completeUnknown']) {
    const fixture = scene(key), { order } = fixture
    assert.equal(sum(order.fullFlow.batches), 1500)
    assert.ok(order.fullFlow.batches.every(batch => batch.position === 'warehouse'))
    for (const batch of order.fullFlow.batches) {
      assert.ok(batch.qcDocumentId && batch.outboundDocumentId && batch.inboundDocumentId)
      assert.equal(Boolean(batch.recheckDocumentId), Boolean(batch.processingDocumentId))
      if (key === 'completeUnknown') {
        assert.equal(document(fixture, batch.inboundDocumentId).times.实际入库, null)
        assert.equal(document(fixture, batch.outboundDocumentId).times.成衣仓接收, null)
      }
    }
  }
})

test('FLOW-MOCK-009: factory-contracted packing is not assigned again in post, and the no-post-processing route is explicit', () => {
  let directRouteCount = 0, independentPackingCount = 0
  for (const fixture of fixtures) for (const batch of fixture.order.fullFlow.batches) {
    const task = fixture.order.tasks.find(task => task.id === batch.taskId)!
    assert.ok(task)
    if (batch.processingDocumentId) {
      const work = document(fixture, batch.processingDocumentId)
      if (task.type !== 'sewing') {
        assert.deepEqual(work.processItems, ['开扣眼', '装扣子'], `${fixture.order.key}/${batch.id}: actual QC-added processing cannot repeat contracted packing`)
        assert.equal(work.sourceType, '质检补加工')
      } else {
        assert.deepEqual(work.processItems, ['开扣眼', '装扣子', '烫包'])
        assert.equal(work.sourceType, '任务后道')
        independentPackingCount++
      }
    }
    if (batch.qcDocumentId && !batch.processingDocumentId) {
      const qc = document(fixture, batch.qcDocumentId)
      if (qc.times.质检完成) {
        assert.deepEqual(qc.processItems, [])
        assert.match(qc.note!, /无需我方后道加工.*不生成.*复检.*直接交给成衣仓/)
        assert.equal(batch.recheckDocumentId, null)
        assert.ok(batch.outboundDocumentId)
        directRouteCount++
      }
    }
  }
  assert.ok(directRouteCount > 0)
  assert.ok(independentPackingCount > 0)
})

test('FLOW-MOCK-010: every new document is task scoped, batch scoped when applicable, and has valid same-scene relationships', () => {
  const ids = new Set<string>(), types = new Set<string>()
  for (const fixture of fixtures) for (const record of Object.values(fixture.branch.docs)) {
    assert.ok(!ids.has(record.id), `${record.id}: duplicate ID`)
    ids.add(record.id)
    if (!record.id.includes('/full-flow/')) continue
    types.add(record.type)
    assert.ok(record.id.startsWith(fixture.order.order! + '/'))
    assert.equal(record.unit, '件')
    assert.ok(record.quantity > 0)
    assert.ok(record.executor && record.receiver)
    assert.ok(record.taskId && record.object.includes(record.taskId))
    assert.ok(record.executionScope && record.processingLocation)
    if (!/执行单/.test(record.type)) assert.ok(record.batchId && record.object.includes(record.batchId))
    for (const related of record.related) assert.ok(fixture.branch.docs[related], `${record.id} -> ${related}: missing relationship`)
  }
  for (const type of ['车缝执行单', '承包裁剪执行单', '工厂烫包执行单', '后道质检单', '后道加工单', '后道复检单', '后道交货单']) assert.ok(types.has(type), type)
})

test('FLOW-MOCK-011: independent sewing keeps all applicable post items inside one processing document and one overall clock', () => {
  const fixture = scene('fullContract')
  const batch = fixture.order.fullFlow.batches.find(batch => batch.taskId === 'SWT-C-01-0101')!
  assert.ok(batch, 'the existing independent sewing receipt batch must be retained')
  assert.equal(fixture.order.tasks.find(task => task.id === batch.taskId)!.type, 'sewing')
  assert.equal(batch.qty, 60)
  assert.equal(batch.position, 'processing')
  const work = document(fixture, batch.processingDocumentId)
  assert.ok(work.id.endsWith('process-烫包'), 'the first originally registered aggregate processing identity is retained')
  assert.deepEqual(work.processItems, ['开扣眼', '装扣子', '烫包'])
  assert.equal(work.sourceType, '任务后道')
  assert.equal(work.type, '后道加工单')
  assert.equal(work.quantity, 60)
  assert.deepEqual(work.quantities, { 应处理: 60, 已处理: 0, 未处理: 0 })
  assert.equal(work.taskId, batch.taskId)
  assert.equal(work.batchId, batch.id)
  assert.ok(work.executor && work.receiver)
  assert.equal(work.processingLocation, '后道厂')
  assert.equal(timingDocumentHref(work.id), '/fcs/craft/post-finishing/work-orders/' + encodeURIComponent(work.id))
  assert.deepEqual(work.clock, { kind: '加工', start: '2026-10-06 15:06', end: null })
  assert.deepEqual(work.times, { 后道开始: '2026-10-06 15:06', 后道完成: null })
  assert.equal(work.status, '后道中')
  assert.ok(timestamp(work.clock!.start)! >= timestamp(document(fixture, batch.qcDocumentId).times.质检完成)!)
  assert.ok(timestamp(work.clock!.start)! <= asOf)
  assert.deepEqual(work.related, [batch.qcDocumentId])
  assert.equal(batch.recheckDocumentId, null)
  assert.equal(batch.outboundDocumentId, null)
  assert.ok(!fixture.branch.docs[work.id.replace('process-烫包', 'process-trim')])
  assert.ok(!fixture.branch.docs[work.id.replace('process-烫包', 'process-button')])
  assert.equal(fixture.order.processing!.qty, 150, 'the accepted aggregate post amount must remain unchanged')
})

test('FLOW-MOCK-012: each batch has at most one post-processing document with the prototype item, status, quantity and timing contract', () => {
  const allowedItems = ['开扣眼', '装扣子', '烫包'], states = new Set<string>()
  for (const fixture of fixtures) for (const batch of fixture.order.fullFlow.batches) {
    assert.ok(!Object.hasOwn(batch, 'processes'), 'per-item processing chains must be removed')
    assert.ok(Object.hasOwn(batch, 'processingDocumentId'))
    const records = Object.values(fixture.branch.docs).filter(record =>
      record.id.includes('/full-flow/') && record.type === '后道加工单' && record.taskId === batch.taskId && record.batchId === batch.id)
    assert.equal(records.length, batch.processingDocumentId ? 1 : 0, `${fixture.order.key}/${batch.id}: one processing document per batch`)
    if (!batch.processingDocumentId) continue
    const work = document(fixture, batch.processingDocumentId)
    states.add(work.status)
    assert.ok(['待后道', '后道中', '后道完成'].includes(work.status))
    assert.ok(work.processItems?.length)
    assert.equal(new Set(work.processItems).size, work.processItems.length)
    assert.ok(work.processItems.every(item => allowedItems.includes(item)))
    assert.deepEqual(Object.keys(work.quantities!).sort(), ['应处理', '已处理', '未处理'].sort())
    assert.equal(work.quantities!.应处理, batch.qty)
    assert.ok(work.quantities!.已处理! + work.quantities!.未处理! <= batch.qty)
    assert.ok(work.quantities!.已处理! >= 0 && work.quantities!.未处理! >= 0)
    assert.deepEqual(Object.keys(work.times).sort(), ['后道开始', '后道完成'].sort())
    assert.deepEqual(Object.keys(work.clock!).sort(), ['kind', 'start', 'end'].sort())
    assert.equal(work.clock!.kind, '加工')
    assert.equal(work.times.后道开始, work.clock!.start)
    assert.equal(work.times.后道完成, work.clock!.end)
    assert.deepEqual(work.related, [batch.qcDocumentId, ...(batch.recheckDocumentId ? [batch.recheckDocumentId] : [])])
    if (work.status === '待后道') {
      assert.equal(work.clock!.start, null)
      assert.equal(work.clock!.end, null)
      assert.equal(work.quantities!.已处理, 0)
      assert.equal(work.quantities!.未处理, 0)
      assert.equal(batch.recheckDocumentId, null)
      assert.equal(batch.outboundDocumentId, null)
    } else if (work.status === '后道中') {
      assert.ok(work.clock!.start)
      assert.equal(work.clock!.end, null)
      assert.ok(work.quantities!.已处理! + work.quantities!.未处理! < batch.qty, 'unfinished work has quantity awaiting classification rather than a confirmed unprocessed result')
      assert.equal(work.quantities!.未处理, 0)
      assert.equal(batch.recheckDocumentId, null)
      assert.equal(batch.outboundDocumentId, null)
    } else {
      assert.ok(work.clock!.start && work.clock!.end)
      assert.equal(work.quantities!.已处理, batch.qty)
      assert.equal(work.quantities!.未处理, 0)
      assert.equal(work.quantities!.已处理! + work.quantities!.未处理!, batch.qty)
    }
  }
  assert.deepEqual([...states].sort(), ['后道中', '后道完成', '待后道'])
  const waiting = scene('normal').order.fullFlow.batches.find(batch => batch.position === 'processing')!
  const awaitingWork = document(scene('normal'), waiting.processingDocumentId)
  assert.equal(awaitingWork.status, '待后道')
  assert.deepEqual(awaitingWork.clock, { kind: '加工', start: null, end: null })
  assert.ok(document(scene('normal'), waiting.qcDocumentId).times.质检完成)
  for (const fixture of fixtures) for (const recheck of Object.values(fixture.branch.docs).filter(record =>
    record.id.includes('/full-flow/') && record.type === '后道复检单')) {
    assert.deepEqual(Object.keys(recheck.quantities!).sort(), ['应交出', '复核交出', '数量差异'].sort())
    assert.ok(!Object.hasOwn(recheck.quantities!, '合格') && !Object.hasOwn(recheck.quantities!, '不合格'))
    assert.ok(recheck.qc && !/合格|不合格/.test(recheck.qc))
    assert.match(recheck.note!, /按SKU核对交出数量并扫描条码/)
    assert.equal(recheck.quantities!.应交出, recheck.quantity)
    if (recheck.times.复检完成) {
      assert.equal(recheck.quantities!.复核交出, recheck.quantity)
      assert.equal(recheck.quantities!.数量差异, 0)
      assert.equal(recheck.barcodeStatus, '正确')
      assert.equal(recheck.qc, 'SKU数量与条码已核对一致')
    } else {
      assert.equal(recheck.quantities!.复核交出, null)
      assert.equal(recheck.quantities!.数量差异, null)
      assert.equal(recheck.barcodeStatus, '待扫描')
      assert.equal(recheck.qc, '条码待扫描／SKU交出数量尚未录入')
    }
  }
})

test('FLOW-MOCK-013: actual quality results generate only applicable processing, completion generates recheck, and no processing goes straight to warehouse delivery', () => {
  let pendingQuality = 0, ongoingProcessing = 0, processingRecheck = 0, directDelivery = 0
  for (const fixture of fixtures) for (const batch of fixture.order.fullFlow.batches) {
    if (!batch.qcDocumentId) continue
    const qc = document(fixture, batch.qcDocumentId)
    if (!qc.times.质检完成) {
      assert.equal(batch.processingDocumentId, null)
      assert.equal(batch.recheckDocumentId, null)
      assert.equal(batch.outboundDocumentId, null)
      assert.deepEqual(qc.related, [batch.receiveDocumentId])
      assert.ok(!Object.hasOwn(qc, 'processItems'), 'incomplete quality must not freeze a future processing decision')
      pendingQuality++
      continue
    }
    if (!batch.processingDocumentId) {
      assert.deepEqual(qc.processItems, [])
      assert.equal(batch.recheckDocumentId, null)
      assert.ok(batch.outboundDocumentId)
      assert.deepEqual(qc.related, [batch.receiveDocumentId, batch.outboundDocumentId])
      assert.ok(document(fixture, batch.outboundDocumentId).related.includes(qc.id))
      directDelivery++
      continue
    }
    const work = document(fixture, batch.processingDocumentId)
    assert.deepEqual(qc.processItems, work.processItems, 'generated processing reads the frozen quality decision')
    assert.ok(qc.related.includes(work.id))
    if (!work.clock!.end) {
      assert.equal(batch.recheckDocumentId, null)
      assert.equal(batch.outboundDocumentId, null)
      assert.deepEqual(work.related, [qc.id])
      ongoingProcessing++
    } else {
      const recheck = document(fixture, batch.recheckDocumentId)
      assert.equal(recheck.quantity, work.quantities!.已处理)
      assert.ok(recheck.related.includes(work.id))
      if (!recheck.times.复检完成) assert.equal(batch.outboundDocumentId, null)
      processingRecheck++
    }
  }
  assert.ok(pendingQuality > 0 && ongoingProcessing > 0 && processingRecheck > 0 && directDelivery > 0)
})


test('COPY-211: full contract scope does not duplicate in-house cutting or release',()=>{
 const fixture=fixtures.find(x=>x.order.key==='fullContract')!,b=fixture.branch;
 assert.equal(b.releases.length,1);assert.equal(b.docs[b.releases[0]].quantity,1000);
 assert.ok(!b.docs['PO-202610-0101/rel-500']);
 for(const part of b.parts){const expected=part.id==='CUT-S-01'?2000:1000;assert.equal(part.qty,expected);assert.equal(b.docs[part.cutDoc].quantity,expected);
  for(const process of part.process){assert.equal(b.docs[process.work].quantity,expected);assert.equal(process.leg.qty,expected);for(const k of ['id','out','receipt','qc'])assert.equal(b.docs[process.leg[k]].quantity,expected)}}
 const full=fixture.order.fullFlow.execution.find(x=>x.type==='full')!;const cut=b.docs[full.steps.find(x=>x.kind==='裁剪')!.documentId];assert.equal(cut.quantity,500);assert.equal(cut.quantities!.已完成,0);
 assert.equal(fixture.order.warehouse,480);assert.equal(fixture.order.purchases.reduce((n,x)=>n+x.qty,0),1500);
})
