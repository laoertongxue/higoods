import assert from 'node:assert/strict'
import test from 'node:test'
import {
  findTimingDocument, getTimingBranch, getTimingCaseByScene, getTimingFacts,
  getTimingIssues, listTimingCases, timingCaseHref, timingDocumentHref,
  timingMs, timingReceiptTotal, TIMING_AS_OF, type TimingDocument,
} from '../../src/data/production-timing/source.ts'
import {
  renderTimingDiagramBody, renderTimingSourceSummaryForCase,
  setTimingDiagramScene, timingDiagramState,
} from '../../src/pages/production-fulfillment/production-order-diagrams.ts'
import {
  calculateSewingReturnDeadlineDate, SEWING_RETURN_COUNTING_DAYS,
} from '../../src/data/fcs/sewing-return-calendar.ts'

const DAY = 86_400_000
const BASE_SCENES = [
  'late', 'normal', 'complete', 'completeLate', 'completeUnknown', 'partial',
  'reordered', 'reachedLate', 'positioning', 'prepPending', 'sampleLate',
  'samplePending', 'fullContract', 'materialBatches', 'materialPartial',
  'live', 'unknown', 'unassigned', 'sameFactory',
] as const
const SCENES = [...BASE_SCENES, 'handoverPartial'] as const
interface Clock { kind: string; start: string | null; end: string | null; sla?: number }
function branch(scene: typeof SCENES[number]) {
  const result = getTimingBranch(getTimingCaseByScene(scene))
  assert.ok(result, `${scene}: registered source branch missing`)
  return result
}
function clock(document: TimingDocument): Clock {
  assert.ok(document.clock, `${document.no}: clock missing`)
  return document.clock as Clock
}
function documentBySuffix(scene: typeof SCENES[number], suffix: string): TimingDocument {
  const document = Object.values(branch(scene).docs).find(record => record.id.endsWith('/' + suffix))
  assert.ok(document, `${scene}: ${suffix} missing`)
  return document
}
function render(scene: typeof SCENES[number], expanded = false): string {
  setTimingDiagramScene(scene)
  timingDiagramState().expanded = { prep: expanded, supply: expanded, craft: expanded }
  timingDiagramState().queue = expanded
  return renderTimingDiagramBody()
}
function dateTimestamp(value: string): number {
  return value.length === 10 ? Date.parse(value + 'T00:00:00+08:00') : timingMs(value)
}

test('PAGE-001 / SCENE-17 / 20: 19 unique production orders plus one purchase awaiting association preserve the 19 accepted base scenes', () => {
  const cases = listTimingCases()
  assert.deepEqual(cases.slice(0, BASE_SCENES.length).map(record => record.key), [...BASE_SCENES], 'the supplemental partial handover may not replace an accepted scene')
  assert.deepEqual(cases.map(record => record.key), [...SCENES])
  assert.equal(new Set(cases.map(record => record.id)).size, 20)
  assert.equal(cases.filter(record => record.order).length, 19)
  const pending = getTimingCaseByScene('unknown')
  assert.equal(pending.order, null)
  assert.equal(pending.id, '240776')
  assert.equal(pending.warehouse, null)
  assert.equal(getTimingFacts(pending).remaining, null)
  assert.equal(getTimingFacts(pending).balance, null)
  assert.match(timingCaseHref(pending), /\/pending-purchases\/240776$/)
  assert.equal(Object.values(branch('unknown').docs).length, 1, 'missing preparation/execution records must not be fabricated')
  assert.equal(Object.values(branch('unknown').docs)[0].type, '商品采购单')
  const purchaseOwners = new Map<string, string>()
  for (const record of cases) for (const purchase of record.purchases) {
    assert.ok(!purchaseOwners.has(purchase.id), `${purchase.id}: merchandise purchase split between production orders`)
    purchaseOwners.set(purchase.id, record.id)
  }
})

test('MASTER-001 / SCENE-07: reversing purchase order input retains earliest precise start and 28-day deadline', () => {
  const record = getTimingCaseByScene('reordered')
  assert.equal(record.purchases[0].at, '2026-09-25 09:00', 'fixture must actually be in reverse chronological order')
  const before = getTimingFacts(record), reversed = structuredClone(record)
  reversed.purchases.reverse()
  const after = getTimingFacts(reversed)
  assert.equal(before.first.at, '2026-09-20 09:00')
  assert.equal(before.deadline, timingMs('2026-10-18 09:00'))
  assert.equal(before.required, 1500)
  assert.equal(after.first.at, before.first.at)
  assert.equal(after.deadline, before.deadline)
  assert.equal(after.required, before.required)
  assert.equal(clock(branch('reordered').docs[branch('reordered').master]).start, '2026-09-20 09:00')
})

test('MASTER-002: full warehouse completion at the exact deadline is timely; one minute later is late', () => {
  const record = structuredClone(getTimingCaseByScene('completeLate'))
  record.warehouseAt = '2026-10-05 09:00'
  assert.equal(getTimingFacts(record).deadline, timingMs('2026-10-05 09:00'))
  assert.equal(getTimingFacts(record).result, '已全部入库 · 按期')
  record.warehouseAt = '2026-10-05 09:01'
  assert.equal(getTimingFacts(record).result, '已全部入库 · 晚1分钟')
  record.warehouse = 1499
  assert.equal(getTimingFacts(record).complete, false, '1499 of 1500 is not a completed production order')
  assert.equal(getTimingFacts(record).remaining, 1)
})

test('SCENE-03—05: warehouse facts establish completion separately from final timestamp and stale upstream records', () => {
  const complete = getTimingFacts(getTimingCaseByScene('complete'))
  assert.equal(complete.required, 1500)
  assert.equal(complete.complete, true)
  assert.equal(complete.remaining, 0)
  assert.equal(complete.result, '已全部入库 · 按期')
  const late = getTimingFacts(getTimingCaseByScene('completeLate'))
  assert.equal(late.complete, true)
  assert.equal(late.result, '已全部入库 · 晚1天6小时')
  const unknown = getTimingFacts(getTimingCaseByScene('completeUnknown'))
  assert.equal(unknown.complete, true)
  assert.equal(unknown.remaining, 0)
  assert.equal(unknown.result, '已全部入库 · 是否按期待核实')
  assert.ok(getTimingIssues(getTimingCaseByScene('completeUnknown')).every(issue => issue.category === 'facts'))
  const stale = structuredClone(getTimingCaseByScene('complete'))
  stale.tasks[0].receipts = []
  stale.processing = { id: 'old-upstream-record', qty: 150 }
  const projected = getTimingFacts(stale)
  assert.equal(projected.complete, true)
  assert.equal(projected.remaining, 0)
  assert.ok(projected.conflicts.some((message: string) => message.includes('上游任务或批次仍保留旧未完成记录')))
})

test('SCENE-06 / 16 / 18: quantity positions conserve pieces while missing position and task ownership remain distinct', () => {
  const live = getTimingFacts(getTimingCaseByScene('live'))
  assert.deepEqual(live.balance, { factory: 600, processing: 150, handover: 150, unknown: 0, waiting: 0, position: 0 })
  assert.equal(live.remaining, 900)
  assert.equal(live.required, 1500)
  const partial = getTimingCaseByScene('partial'), partialFacts = getTimingFacts(partial)
  assert.equal(partial.processing, null)
  assert.equal(partialFacts.balance.position, 150)
  assert.equal(partialFacts.balance.handover, 150)
  assert.equal(partialFacts.balance.unknown, 0)
  assert.match(render('partial'), /150件已实收、后道当前位置待核实/)
  const unassigned = getTimingFacts(getTimingCaseByScene('unassigned'))
  assert.equal(unassigned.held, 1200)
  assert.equal(unassigned.balance.unknown, 300)
  assert.equal(unassigned.balance.waiting, 0, 'unknown ownership is not confirmed unallocated production')
  assert.match(render('unassigned'), /300件任务归属待核实/)
  for (const record of listTimingCases()) {
    const facts = getTimingFacts(record)
    if (facts.balance && facts.conflicts.length === 0) assert.equal(Object.values(facts.balance).reduce<number>((sum, quantity) => sum + Number(quantity), 0) + record.warehouse!, facts.required, record.key)
  }
})

test('CONTRACT-002 / SCENE-13: three return contracts use calendar days including Sunday and their actual held quantities', () => {
  assert.deepEqual(SEWING_RETURN_COUNTING_DAYS.INDEPENDENT_SEWING, [4, 8, 9])
  assert.deepEqual(SEWING_RETURN_COUNTING_DAYS.SEWING_TO_IRON_PACK, [5, 9, 10])
  assert.deepEqual(SEWING_RETURN_COUNTING_DAYS.CUTTING_TO_IRON_PACK, [6, 9, 12])
  assert.equal(calculateSewingReturnDeadlineDate('2026-09-30', 5), '2026-10-04', 'Sunday remains a counted calendar day')
  assert.equal(calculateSewingReturnDeadlineDate('2026-10-03', 4), '2026-10-06')
  const record = getTimingCaseByScene('fullContract')
  assert.deepEqual(record.tasks.map(task => [task.type, task.held]), [['combined', 800], ['full', 500], ['sewing', 200]])
  const html = render('fullContract')
  for (const expected of ['累计目标240件', '累计目标150件', '累计目标60件', '截止2026-10-04 23:59', '截止2026-10-06 23:59', '截止2026-10-12 23:59']) assert.ok(html.includes(expected), expected)
  assert.ok(!html.includes('累计目标450件'), '30% must not use the whole 1500-piece procurement denominator')
})

test('SCENE-19: B factory total 40% cannot cover the independently overdue B01 task', () => {
  const record = getTimingCaseByScene('sameFactory')
  const b01 = record.tasks.find(task => task.id.startsWith('SWT-B-01'))
  const b02 = record.tasks.find(task => task.id.startsWith('SWT-B-02'))
  assert.equal(b01.held, 300)
  assert.equal(timingReceiptTotal(b01), 0)
  assert.equal(b02.held, 200)
  assert.equal(timingReceiptTotal(b02), 200)
  const current = getTimingIssues(record).filter(issue => issue.category === 'work' && issue.tone === 'bad')
  assert.equal(current.length, 1)
  assert.match(current[0].title, /SWT-B-01.*30%节点欠90件/)
  const html = render('sameFactory')
  assert.ok(html.includes('B厂汇总200／500＝40%'), 'sameFactory: expected factory 200/500 = 40% context missing from the diagram')
  assert.ok(html.includes('欠90件'), 'sameFactory: B01 individual 90-piece gap missing')
  assert.ok(html.includes('不能冲抵其他任务'), 'sameFactory: independent-task warning missing')
})

test('SCENE-02 / 08: timely returns and late reached milestone differ from a currently overdue unmet milestone', () => {
  const normal = getTimingCaseByScene('normal'), lateReached = getTimingCaseByScene('reachedLate')
  assert.equal(normal.warehouse, 750)
  assert.equal(lateReached.warehouse, 750)
  assert.ok(getTimingIssues(normal).every(issue => issue.category !== 'work' || issue.tone !== 'bad'))
  assert.ok(getTimingIssues(lateReached).every(issue => issue.category !== 'work' || issue.tone !== 'bad'))
  const html = render('reachedLate')
  assert.match(html, /class="history-band"/)
  assert.match(html, /class="history-actual"/)
  assert.match(html, /晚12小时.*该节点差额0件/)
  assert.match(html, /已达标 · 晚于截止/)
  assert.ok(!html.includes('B厂 SWT-B-01-0096 · 30%节点欠150件'))
})

test('SCENE-09 / 10: preparation is a parallel four/five-day stage with separately recorded production and handover', () => {
  const regular = branch('live'), positioning = branch('positioning'), pending = branch('prepPending')
  assert.equal(clock(regular.docs[regular.master]).sla, 4)
  const positionedClock = clock(positioning.docs[positioning.master])
  assert.equal(positionedClock.sla, 5)
  assert.equal(positionedClock.start, '2026-10-02 21:00')
  assert.equal(positionedClock.end, null)
  assert.equal(timingMs(TIMING_AS_OF) - timingMs(positionedClock.start!), 4.5 * DAY)
  assert.ok(getTimingIssues(getTimingCaseByScene('positioning')).every(issue => issue.tone !== 'bad'))
  assert.equal(regular.prep.length, 5, 'two color, two artwork and accessory ordering lanes')
  const text = render('live', true)
  for (const expected of ['技术调色准备', '印花技术准备', '基码前期复用', '两个专业任务可并行', '辅料下单']) assert.ok(text.includes(expected), expected)
  const color = Object.values(pending.docs).find(doc => doc.type === '调色任务（面料）' && doc.object.includes('蓝底'))!
  assert.equal(clock(color).end, '2026-10-06 14:40')
  assert.equal(color.handoverClock.start, '2026-10-06 15:00')
  assert.equal(color.handoverClock.end, null)
  assert.equal(pending.docs[pending.pack].times.发布, null)
  assert.equal(clock(pending.docs[pending.master]).end, null)
  assert.match(render('prepPending', true), /制作.*交接/)
})

test('SCENE-11 / 12: sample date is pickup plus three; failed or unsubmitted sample does not move the return deadline', () => {
  const late = getTimingCaseByScene('sampleLate'), pending = getTimingCaseByScene('samplePending')
  const lateTask = late.tasks.find(task => task.id.startsWith('SWT-B-01'))!
  const pendingTask = pending.tasks.find(task => task.id.startsWith('SWT-B-01'))!
  const lateDoc = Object.values(branch('sampleLate').docs).find(doc => doc.type === '工厂产前版样衣' && doc.object.includes(lateTask.id))!
  const pendingDoc = Object.values(branch('samplePending').docs).find(doc => doc.type === '工厂产前版样衣' && doc.object.includes(pendingTask.id))!
  assert.equal(lateTask.picked, '2026-10-02 10:00')
  assert.equal(lateDoc.sampleTiming.due, '2026-10-05')
  assert.equal(lateDoc.times.样衣交出, '2026-10-06 10:00')
  assert.equal(lateTask.sampleResult, '未通过')
  assert.equal(lateDoc.sampleTiming.late, true)
  assert.equal(lateDoc.sampleTiming.done, true)
  assert.equal(pendingDoc.times.样衣交出, null)
  assert.equal(pendingDoc.times.下游接收, null)
  assert.equal(pendingDoc.sampleTiming.late, true)
  assert.equal(pendingDoc.sampleTiming.done, false)
  for (const key of ['sampleLate', 'samplePending'] as const) {
    const html = render(key)
    assert.match(html, /30% 未达标，已超时，差150件 截止2026-10-04 23:59 累计目标150件/)
    assert.match(html, /样衣结果不改变合同节点/)
    const detail = renderTimingSourceSummaryForCase(getTimingCaseByScene(key), key === 'sampleLate' ? lateDoc.id : pendingDoc.id)
    assert.match(detail, /日期口径；日内截止时刻待确认/)
  }
})

test('SCENE-14: stock 600 meters advances before the independent 900-meter purchase batch, with three work/handover records each', () => {
  const record = getTimingCaseByScene('materialBatches'), b = branch('materialBatches'), fabric = b.materials.find(material => material.id === 'F01')!
  assert.equal(record.purchases.length, 1, 'the merchandise purchase remains unsplit')
  assert.equal(record.purchases[0].qty, 1500)
  assert.deepEqual(fabric.batches.map((batch: any) => batch.qty), [600, 900])
  assert.equal(b.docs[fabric.batches[0].transfer].times.下游接收, '2026-09-24 09:30')
  assert.equal(b.docs[fabric.receive].times.接收入库, '2026-09-30 12:00')
  assert.equal(b.docs[fabric.po].quantity, 900)
  const workIds = new Set<string>()
  for (const batch of fabric.batches) {
    assert.equal(batch.process.length, 3)
    for (const process of batch.process) {
      assert.ok(!workIds.has(process.work), 'independent batches must not share processing documents')
      workIds.add(process.work)
      assert.equal(b.docs[process.work].quantity, batch.qty)
      assert.equal(b.docs[process.leg.id].quantities!.实收, batch.qty)
      for (const id of [process.leg.id, process.leg.out, process.leg.receipt, process.leg.qc]) assert.ok(b.docs[id], `${batch.id}: handover evidence ${id} missing`)
    }
  }
  assert.match(render('materialBatches', true), /600米库存批＋900米补采批/)
  assert.match(render('materialBatches', true), /不强制等待汇合/)
})

test('SCENE-15: known 600-meter receipt is preserved while the 900-meter purchase remains unknown and currently late', () => {
  const b = branch('materialPartial'), fabric = b.materials.find(material => material.id === 'F01')!
  assert.equal(b.docs[fabric.stockTransfer].quantities!.实收, 600)
  assert.equal(b.docs[fabric.po].quantity, 900)
  assert.equal(b.docs[fabric.po].quantities!.仓库实收, null)
  assert.equal(clock(b.docs[fabric.po]).end, null)
  assert.equal(fabric.receive, null)
  assert.equal(fabric.purchaseTransfer, null)
  assert.equal(fabric.process.length, 0, 'no full 1500-meter production facts can be fabricated')
  const html = render('materialPartial', true)
  assert.match(html, /已确认600米/)
  assert.match(html, /其余900米实收待核实/)
  assert.match(html, /未入仓 · 已超时8天21小时/)
})

test('SCENE-20: partial factory handover retains 2400 sleeve pieces received and 600 disputed without closing the handover or converting to garments', () => {
  const record = getTimingCaseByScene('handoverPartial')
  const handover = documentBySuffix('handoverPartial', 'partial-sleeve-handover')
  assert.equal(handover.unit, '片')
  assert.equal(handover.quantity, 3000)
  assert.deepEqual(handover.quantities, { 应交: 3000, 实交: 3000, 实收: 2400, 数量差异: 600 })
  assert.equal(handover.times.交出, '2026-10-06 10:10')
  assert.equal(handover.times.部分接收, '2026-10-06 11:00')
  assert.equal(clock(handover).start, '2026-10-06 10:10')
  assert.equal(clock(handover).end, null, 'the confirmed partial receipt cannot close the full handover')
  assert.equal(clock(handover).sla, undefined, 'no handover standard has been agreed')
  const outgoing = documentBySuffix('handoverPartial', 'partial-sleeve-handover-out')
  const receipt = documentBySuffix('handoverPartial', 'partial-sleeve-handover-receipt')
  const qc = documentBySuffix('handoverPartial', 'partial-sleeve-handover-qc')
  assert.equal(outgoing.type, '交出记录')
  assert.equal(outgoing.quantity, 3000)
  assert.equal(receipt.type, '接收记录')
  assert.equal(receipt.quantity, 2400, 'receipt document must carry confirmed quantity instead of the requested quantity')
  assert.equal(qc.type, '质检交接记录')
  assert.equal(qc.quantities!.接收核对, 2400)
  assert.equal(qc.quantities!.数量差异, 600)
  for (const document of [outgoing, receipt, qc]) assert.ok(handover.related.includes(document.id), `${document.type}: independent source evidence missing`)
  const facts = getTimingFacts(record)
  assert.equal(facts.required, 1500)
  assert.equal(record.warehouse, 0)
  assert.equal(facts.received, 0, 'sleeve reception is not a sewing-return quantity')
  assert.equal(facts.remaining, 1500)
  assert.equal(facts.balance.waiting, 1500, '2400 sleeve pieces do not become 2400 finished garments')
  const issues = getTimingIssues(record)
  assert.equal(issues.length, 1)
  assert.equal(issues[0].tone, 'warn', 'quantity discrepancy must not invent a current time breach')
  assert.match(issues[0].title, /已收2400片／余600片差异待确认/)
  const html = render('handoverPartial', true)
  assert.match(html, /部分实收 10-06 11:00 · 2400片 · 数量差异600片待确认/)
  assert.match(html, /交接 等待接收已用22小时50分钟 · 未确认时效要求，无法判定是否超时/)
  const summary = renderTimingSourceSummaryForCase(record, handover.id)
  assert.match(summary, /实收<\/small><b>2400片/)
  assert.match(summary, /数量差异<\/small><b>600片/)
  assert.ok(!summary.includes('当前逾期'), 'unconfigured handover clock records waiting without an overdue judgement')
})

test('SCENE-01: completed preparation/material delays remain history while sleeve work has a current 600-piece gap', () => {
  const b = branch('late'), prep = clock(b.docs[b.master]), fabric = b.materials.find(material => material.id === 'F01')!
  assert.equal(timingMs(prep.end!) - timingMs(prep.start!) - 4 * DAY, DAY)
  const materialClock = clock(b.docs[fabric.po])
  assert.equal(timingMs(materialClock.end!) - timingMs(materialClock.start!) - 8 * DAY, 2 * DAY)
  const sleeve = b.parts.find(part => part.part === '袖片'), embroidery = sleeve.process.at(-1)
  const sleeveDocument = b.docs[embroidery.work]
  assert.equal(sleeveDocument.quantity, 3000)
  assert.equal(sleeveDocument.unit, '片')
  assert.equal(sleeveDocument.quantities!.已完成, 2400)
  assert.equal(sleeveDocument.quantities!.未完成, 600)
  assert.equal(clock(sleeveDocument).end, null)
  assert.equal(timingMs(TIMING_AS_OF) - timingMs(clock(sleeveDocument).start!) - 3 * DAY, DAY)
  const html = render('late', true)
  for (const expected of ['已完成 · 晚1天', '1个采购批已入仓 · 晚2天', '1道未完成 · 已超时，最长1天', '600片', '范围待核对']) assert.ok(html.includes(expected), expected)
  assert.match(html, /600袖片不换算为600件成衣/, 'sleeve pieces must not become garment quantity')
})

test('PREP / CRAFT: auxiliary work is three days each; bulk dye/print/wash and handovers have no invented SLA', () => {
  const b = branch('live')
  const front = b.parts.find(part => part.part === '前片'), back = b.parts.find(part => part.part === '后片'), sleeves = b.parts.find(part => part.part === '袖片'), collar = b.parts.find(part => part.part === '领片')
  assert.deepEqual([front.process.length, back.process.length, sleeves.process.length, collar.process.length], [2, 1, 2, 0])
  for (const part of b.parts) for (const process of part.process) assert.equal(clock(b.docs[process.work]).sla, 3)
  for (const material of b.materials) for (const process of material.process) assert.equal(clock(b.docs[process.work]).sla, undefined, `${b.docs[process.work].type}: bulk work cannot borrow auxiliary SLA`)
  const transfers = Object.values(b.docs).filter(doc => doc.clock?.kind === '交接')
  assert.ok(transfers.length > 10)
  for (const transfer of transfers) {
    assert.equal(clock(transfer).sla, undefined)
    const summary = renderTimingSourceSummaryForCase(getTimingCaseByScene('live'), transfer.id)
    assert.match(summary, /未确认时效要求，无法判定是否超时/)
    assert.ok(!summary.includes('当前逾期'), transfer.no + ' must not be declared late without SLA')
  }
  assert.equal(b.releases.length, 2)
  for (const releaseId of b.releases) assert.equal(b.docs[releaseId].type, '裁片放行记录')
  assert.match(render('live', true), /业务人员人工放行/)
})

test('SOURCE / UI: document IDs, related ownership, native routes and source summaries are coherent without read mutation', () => {
  const ids = new Set<string>(), before = JSON.stringify(listTimingCases())
  for (const record of listTimingCases()) {
    const b = getTimingBranch(record)!
    for (const document of Object.values(b.docs)) {
      assert.ok(!ids.has(document.id), `duplicate global source ID ${document.id}`)
      ids.add(document.id)
      assert.equal(document.production, record.order)
      assert.equal(findTimingDocument(document.id)!.document, document)
      for (const relatedId of document.related) {
        const related = findTimingDocument(relatedId)
        assert.ok(related, `${document.id}: broken related source ${relatedId}`)
        assert.equal(related.order.id, record.id, `${document.id}: related source crosses scenario/order`)
      }
      const href = timingDocumentHref(document.id)
      assert.match(href, /^\/(pcs|pms|fcs|pfos|wls)\//)
      assert.ok(href.endsWith(encodeURIComponent(document.id)))
      assert.ok(!href.includes('localhost') && !href.includes('/dds/'))
    }
    for (const purchase of record.purchases) {
      const source = findTimingDocument(purchase.documentId)!.document
      assert.equal(source.type, '商品采购单')
      assert.equal(source.quantity, purchase.qty)
      assert.equal(source.times.下单, purchase.at)
    }
  }
  assert.ok(ids.size > 1500, 'all required mock source documents must be registered')
  for (const scene of SCENES) render(scene, true)
  assert.equal(JSON.stringify(listTimingCases()), before, 'ordinary rendering may not mutate the business facts')
})

test('SOURCE: there are no future actual events or reversed processing/handover times in the fixed demonstration', () => {
  const asOf = timingMs(TIMING_AS_OF)
  for (const record of listTimingCases()) {
    if (record.warehouseAt) assert.ok(timingMs(record.warehouseAt) <= asOf, record.key + ': warehouse timestamp is in the future')
    for (const task of record.tasks) {
      if (task.picked) assert.ok(timingMs(task.picked) <= asOf)
      for (const receipt of task.receipts) assert.ok(timingMs(receipt.at) <= asOf)
    }
    for (const document of Object.values(getTimingBranch(record)!.docs)) {
      for (const [name, value] of Object.entries(document.times)) {
        if (!value || /要求|截止|应完成|预计/.test(name)) continue
        const timestamp = dateTimestamp(value)
        assert.ok(Number.isFinite(timestamp), `${document.id}: invalid ${name} ${value}`)
        assert.ok(timestamp <= asOf, `${document.id}: future actual ${name} ${value}`)
      }
      for (const possibleClock of [document.clock, document.handoverClock] as (Clock | undefined)[]) if (possibleClock?.start && possibleClock.end) assert.ok(timingMs(possibleClock.end) >= timingMs(possibleClock.start), `${document.id}: ${possibleClock.kind} ended before it started`)
    }
  }
  const futureReceipt = structuredClone(getTimingCaseByScene('normal').tasks.find(task => task.id.startsWith('SWT-B-01')))
  futureReceipt.receipts.push({ qty: 350, at: '2026-10-08 12:00' })
  assert.equal(timingReceiptTotal(futureReceipt), 150, 'future receipt cannot count toward current return completion')
})

const expectedSceneText: Record<typeof SCENES[number], string[]> = {
  late: ['袖片绣花 · 未完成 · 已超时1天', '剩余600片', '已完成 · 晚'],
  normal: ['750', '已达标 · 按期', '未到期'],
  complete: ['已全部入库 · 按期', '全部应完成数量已入库 · 剩余0件'],
  completeLate: ['已全部入库 · 晚1天6小时', '2026-10-05 09:00'],
  completeUnknown: ['已全部入库 · 是否按期待核实', '全量入库的最后时间待核实'],
  partial: ['后道当前位置待核实', '150'],
  reordered: ['2张采购单', '2026-10-18 09:00'],
  reachedLate: ['已达标 · 晚于截止', '晚12小时', '该节点差额0件'],
  positioning: ['有定位印', '阶段整体5自然日', '未完成 · 截止未到'],
  prepPending: ['生产准备未完成 · 已超时13天', '尚未发布', '已交出待接收'],
  sampleLate: ['工厂产前版样衣', '未通过', '已交出 · 晚于要求日期'],
  samplePending: ['工厂产前版样衣', '尚未交出', '要求日期已过'],
  fullContract: ['独立车缝', '车缝＋烫包', '裁剪＋车缝＋烫包'],
  materialBatches: ['600米库存批＋900米补采批', '三道各自记录数量和交接'],
  materialPartial: ['已确认600米', '其余900米实收待核实'],
  live: ['工厂实领、后道尚未实收', '后道加工', '已交出待接收', '成衣仓已入库'],
  unknown: ['已入成衣仓数量未取得，不能按0件判断', '当前位置及历史入库待核实'],
  unassigned: ['300件任务归属待核实', '任务归属待核实'],
  sameFactory: ['B厂汇总200／500＝40%', '欠90件', '不能冲抵其他任务'],
  handoverPartial: ['已收2400片／余600片差异待确认', '部分实收', '未确认时效要求，无法判定是否超时'],
}
for (const scene of SCENES) test(`SCENE ${scene}: expanded accepted diagram retains its business nodes and source documents`, () => {
  const html = render(scene, true)
  assert.ok(!/NaN|undefined|Infinity|工程BOM/.test(html), scene + ': invalid or obsolete output')
  for (const text of expectedSceneText[scene]) assert.ok(html.includes(text), `${scene}: missing ${text}`)
  for (const marker of ['class="summary"', 'class="stage-risk-overview"', 'class="branch-nav"', 'class="chart"', 'id="branch-prep"', 'id="branch-supply"', 'id="branch-craft"']) assert.ok(html.includes(marker), `${scene}: missing graph structure ${marker}`)
  assert.ok(html.indexOf('class="summary"') < html.indexOf('class="stage-risk-overview"'))
  assert.ok(html.indexOf('class="stage-risk-overview"') < html.indexOf('class="chart"'))
  for (const [, id] of html.matchAll(/data-document="([^"]+)"/g)) assert.ok(findTimingDocument(id), `${scene}: clickable document ${id} is not a source record`)
  assert.ok(!html.includes('独立跳转样例'), 'unrelated source sample must not appear as a linked production fact')
})

test('PREP-005: supplemental scene retains disabled and change-ended documents without creating active clocks or blocking valid preparation', () => {
  const b = branch('handoverPartial')
  assert.equal(b.inactivePreparation.length, 2)
  const records = b.inactivePreparation.map((id: string) => b.docs[id])
  assert.deepEqual(records.map((d: TimingDocument) => d.status), ['未启用', '需求变更结束'])
  for (const d of records) {
    assert.equal(d.timingApplicable, false)
    assert.equal(d.clock, undefined)
    assert.equal(d.handoverClock, undefined)
    assert.match(d.timingExclusionReason, /不计作当前未完成工作/)
    assert.ok(findTimingDocument(d.id))
    assert.ok(timingDocumentHref(d.id).startsWith('/pcs/production-preparation/'))
    assert.ok(b.docs[b.master].related.includes(d.id))
  }
  const html = render('handoverPartial', true)
  assert.match(html, /不纳入当前准备要求的记录/)
  for (const d of records) assert.ok(html.includes(d.no))
  assert.equal(b.docs[b.master].status, '已关闭')
  assert.ok(!getTimingIssues(getTimingCaseByScene('handoverPartial')).some(i=>records.some((d: TimingDocument)=>i.documentId===d.id)))
})
