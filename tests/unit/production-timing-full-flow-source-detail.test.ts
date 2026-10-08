import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getTimingBranch, getTimingCaseByScene, listTimingCases, timingCaseHref, timingDocumentHref, timingClockHasCompletionFact, timingPostPositionLabel,
} from '../../src/data/production-timing/source'
import { resolveTimingSourceDetail } from '../../src/pages/production-fulfillment/source-document-detail'

const nativePaths = {
  车缝执行单: '/fcs/sewing-outsourcing/tasks/',
  承包裁剪执行单: '/fcs/sewing-outsourcing/tasks/',
  工厂烫包执行单: '/fcs/sewing-outsourcing/tasks/',
  后道质检单: '/fcs/craft/post-finishing/qc-orders/',
  后道加工单: '/fcs/craft/post-finishing/work-orders/',
  后道复检单: '/fcs/craft/post-finishing/recheck-orders/',
  后道交货单: '/fcs/craft/post-finishing/outbound-orders/',
}

test('every sewing and post-finishing document type opens its actual native module detail', () => {
  const counts = new Map<string, number>()
  for (const order of listTimingCases()) {
    for (const document of Object.values(getTimingBranch(order)!.docs)) {
      const prefix = nativePaths[document.type as keyof typeof nativePaths]
      if (!prefix) continue
      counts.set(document.type, (counts.get(document.type) ?? 0) + 1)
      const path = timingDocumentHref(document.id)
      assert.equal(path, prefix + encodeURIComponent(document.id))
      const html = resolveTimingSourceDetail(path)
      assert.ok(html, `Unresolved native detail: ${document.id}`)
      for (const value of [document.no, document.status, document.executor, document.receiver, timingCaseHref(order)]) assert.ok(html.includes(value), `Lost shared source fact: ${document.id}: ${value}`)
      for (const at of Object.values(document.times).filter(Boolean)) assert.ok(html.includes(at!), `Lost actual timestamp: ${document.id}`)
      assert.doesNotMatch(html, /\bundefined\b|\bNaN\b/)
    }
  }
  for (const type of Object.keys(nativePaths)) assert.ok(counts.get(type), `Missing complete-flow mock: ${type}`)
})

test('sewing task execution preserves the matching contract rather than entering the allocation workbench', () => {
  const order = getTimingCaseByScene('fullContract')
  const branch = getTimingBranch(order)!
  const types = new Set<string>()
  for (const task of order.tasks) {
    const executionDocuments = Object.values(branch.docs).filter(document => document.taskId === task.id && ['车缝执行单', '承包裁剪执行单', '工厂烫包执行单'].includes(document.type))
    assert.ok(executionDocuments.length, `No execution facts for ${task.id}`)
    for (const document of executionDocuments) {
      const path = timingDocumentHref(document.id)
      assert.ok(path.startsWith('/fcs/sewing-outsourcing/tasks/'))
      assert.ok(!path.includes('/dispatch/workbench/'))
      const html = resolveTimingSourceDetail(path)!
      assert.ok(html.includes(task.id) && html.includes(task.factory))
      assert.ok(html.includes(task.type === 'sewing' ? '独立车缝' : task.type === 'combined' ? '车缝＋烫包' : '裁剪＋车缝＋烫包'))
      assert.ok(html.includes(document.processingLocation), `Missing actual processing location: ${document.id}`)
      assert.ok(html.includes('业务分配日为第1天，全部自然日'))
      assert.ok(html.includes('工厂实领量') && html.includes('后道实收量'))
    }
    types.add(task.type)
  }
  assert.deepEqual([...types].sort(), ['combined', 'full', 'sewing'])
})

test('post-finishing QC and recheck retain their own task results, batches, and downstream documents', () => {
  let checked = 0
  for (const order of listTimingCases()) {
    const branch = getTimingBranch(order)!
    for (const document of Object.values(branch.docs).filter(document => ['后道质检单', '后道复检单'].includes(document.type))) {
      const html = resolveTimingSourceDetail(timingDocumentHref(document.id))!
      assert.ok(html.includes(document.type === '后道质检单' ? '本批次后道质检结果' : '处理后交出复核（复检）'))
      assert.ok(document.batchId && html.includes(document.batchId), `No batch attribution: ${document.id}`)
      assert.ok(document.taskId && html.includes(document.taskId), `No sewing task attribution: ${document.id}`)
      for (const name of Object.keys(document.quantities ?? {})) assert.ok(html.includes(name), `Lost inspection quantity: ${document.id}: ${name}`)
      for (const related of document.related) assert.ok(html.includes(timingDocumentHref(related)), `No downstream detail: ${document.id}`)
      assert.ok(!timingDocumentHref(document.id).includes('handover-records'))
      checked++
    }
  }
  assert.ok(checked, 'No independently recorded QC or recheck examples')
})

test('post delivery shows actual outgoing and finished-goods receipt separately', () => {
  const documents = listTimingCases().flatMap(order => Object.values(getTimingBranch(order)!.docs)).filter(document => document.type === '后道交货单')
  assert.ok(documents.length)
  for (const document of documents) {
    const html = resolveTimingSourceDetail(timingDocumentHref(document.id))!
    assert.ok(html.includes('实际交出') && html.includes('下游实收'))
    assert.ok(html.includes('后道实际交出计至成衣仓实际接收'))
    assert.ok(html.includes('本单据时效') || !document.clock && !document.handoverClock)
    const unknownStandards = [document.clock, document.handoverClock].filter(clock => clock && clock.sla == null && clock.days == null)
    if (unknownStandards.length) assert.ok(html.includes('时效要求未确认'))
  }
})

test('completed orders retain the recorded post-finishing document history', () => {
  for (const scene of ['complete', 'completeLate']) {
    const order = getTimingCaseByScene(scene)
    const documents = Object.values(getTimingBranch(order)!.docs).filter(document => ['后道质检单', '后道复检单', '后道交货单'].includes(document.type))
    assert.ok(documents.length, `No completed history: ${scene}`)
    for (const document of documents) assert.ok(resolveTimingSourceDetail(timingDocumentHref(document.id))!.includes(document.no))
  }
})

test('unknown or wrongly routed full-flow documents do not produce invented detail pages', () => {
  assert.equal(timingDocumentHref('NO-SUCH-DOCUMENT'), '')
  assert.equal(resolveTimingSourceDetail('/fcs/craft/post-finishing/qc-orders/' + encodeURIComponent('PO-FAKE/QC-FAKE')), null)
  const document = listTimingCases().flatMap(order => Object.values(getTimingBranch(order)!.docs)).find(document => document.type === '后道复检单')!
  assert.ok(document)
  assert.equal(resolveTimingSourceDetail('/fcs/craft/post-finishing/qc-orders/' + encodeURIComponent(document.id)), null)
})

test('recorded finished-goods receipt without its time stops the handover clock rather than creating current waiting', () => {
  const order = getTimingCaseByScene('completeUnknown')
  const documents = Object.values(getTimingBranch(order)!.docs).filter(document => document.type === '后道交货单')
  assert.equal(documents.length, 2)
  for (const document of documents) {
    assert.equal(document.status, '成衣仓已接收')
    assert.equal(document.clock?.end, null)
    assert.equal(timingClockHasCompletionFact(document), true)
    const html = resolveTimingSourceDetail(timingDocumentHref(document.id))!
    assert.ok(html.includes('已接收，实际接收时间待核实'))
    assert.ok(html.includes('已全部接收 · 实际接收时间待核实 · 耗时无法判定'))
    assert.doesNotMatch(html, /尚未全部接收|尚无实际接收时间|从开始至查看时点|已超时/)
  }
})

test('clock completion matches its own final business event across work and handover', () => {
  const clock = { kind: '交接', start: '2026-10-06 16:00', end: null }
  assert.equal(timingClockHasCompletionFact({ status: '已交出待接收', clock }), false)
  assert.equal(timingClockHasCompletionFact({ status: '成衣仓已接收', clock }), true)
  assert.equal(timingClockHasCompletionFact({ status: '加工完成', clock }), false)
  assert.equal(timingClockHasCompletionFact({ status: '已交出待接收', clock: { ...clock, end: '2026-10-07 08:00' } }), true)
  assert.equal(timingClockHasCompletionFact({ status: '已质检', clock: { ...clock, kind: '制作' } }), true)
  assert.equal(timingClockHasCompletionFact({ status: '已复检', clock: { ...clock, kind: '制作' } }), true)
  assert.equal(timingClockHasCompletionFact({ status: '尚未开始', clock: { ...clock, kind: '制作' } }), false)
  assert.equal(timingClockHasCompletionFact({ status: '已下单', clock: { ...clock, kind: '采购到仓' } }), false)
  assert.equal(timingClockHasCompletionFact({ status: '已收齐入库', clock: { ...clock, kind: '采购到仓' } }), true)
})

test('native post document uses the same Chinese current-position label as the diagram', () => {
  for (const order of listTimingCases()) {
    for (const batch of order.fullFlow.batches) {
      if (!batch.qcDocumentId) continue
      const html = resolveTimingSourceDetail(timingDocumentHref(batch.qcDocumentId))!
      assert.ok(html.includes(timingPostPositionLabel(batch.position,getTimingBranch(order)!.docs[batch.processingDocumentId!]?.status)), `${order.key}: ${batch.position}`)
      assert.doesNotMatch(html, /<td[^>]*>(qc|processing|recheck|delivery|warehouse|unknown)<\/td>/)
    }
  }
})

test('explicitly pending work is not mislabeled as missing actual start time in native clocks', () => {
 const order=getTimingCaseByScene('live'), docs=Object.values(getTimingBranch(order)!.docs).filter(d=>/^(待质检|待复检|尚未交出)$/.test(d.status))
 assert.ok(docs.length)
 for(const doc of docs){const html=resolveTimingSourceDetail(timingDocumentHref(doc.id))!;assert.ok(html.includes('未开始计时'));assert.ok(html.includes('尚未发生'));assert.doesNotMatch(html,/开始时间缺失|耗时无法计算/)}
})


test('native post work detail keeps one project set, one clock and classified quantities',()=>{
 const order=getTimingCaseByScene('fullContract'),branch=getTimingBranch(order)!,batch=order.fullFlow.batches.find(b=>branch.docs[b.processingDocumentId!]?.processItems?.length===3)!
 const doc=branch.docs[batch.processingDocumentId!],html=resolveTimingSourceDetail(timingDocumentHref(doc.id))!
 assert.ok(html.includes('开扣眼、装扣子、烫包')&&html.includes('本单后道项目')&&html.includes(doc.sourceType!))
 for(const label of ['应处理','已处理','已确认未处理','尚待记录处理结果','60件'])assert.ok(html.includes(label),label)
 assert.ok(html.includes('前置尚未完成，单据尚未生成'))
 assert.doesNotMatch(html,/下一道加工|剪线|钉扣/)
})

test('post recheck describes SKU quantity and barcode verification rather than a second quality inspection',()=>{
 const order=getTimingCaseByScene('live'),doc=Object.values(getTimingBranch(order)!.docs).find(d=>d.type==='后道复检单')!
 const html=resolveTimingSourceDetail(timingDocumentHref(doc.id))!
 assert.ok(html.includes('本单只复核SKU数量与条码')&&html.includes('复核完成才生成后道交货单'))
 assert.doesNotMatch(html,/本批次后道复检结果|已记录检验结论|检验负责人/)
})

test('original post work documents preserve their recorded completed quantities without requiring new project fields',()=>{
 const originals=listTimingCases().flatMap(order=>Object.values(getTimingBranch(order)!.docs)).filter(d=>d.type==='后道加工单'&&d.quantities?.应加工!=null)
 assert.equal(originals.length,10)
 for(const doc of originals){
  const html=resolveTimingSourceDetail(timingDocumentHref(doc.id))!
  assert.ok(html.includes('加工对象明细')&&html.includes('实际完成量'))
  assert.ok(html.includes(`${doc.quantities!.已完成}件`))
  assert.doesNotMatch(html,/整单后道处理结果|尚待记录处理结果|本单后道项目/)
 }
})


test('delivery awaiting warehouse receipt is not described as an unfinished upstream prerequisite',()=>{
 const order=getTimingCaseByScene('live'),branch=getTimingBranch(order)!,batch=order.fullFlow.batches.find(b=>b.position==='delivery')!
 const html=resolveTimingSourceDetail(timingDocumentHref(batch.outboundDocumentId!))!
 const warehouseRow=html.match(/<tr[^>]*><td[^>]*>成衣仓接收<\/td>[\s\S]*?<\/tr>/)![0]
 assert.ok(warehouseRow.includes('成衣仓尚未接收，入库单尚未生成'))
 assert.ok(warehouseRow.includes(`待接收 ${batch.qty}件`))
 assert.doesNotMatch(warehouseRow,/前置尚未完成|本次不生成|数量待核实/)
})
