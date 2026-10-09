import assert from 'node:assert/strict'
import test from 'node:test'
import { getTimingCaseByScene, getTimingBranch, listTimingCases } from '../../src/data/production-timing/source.ts'
import { setTimingDiagramScene, timingDiagramState, renderTimingDiagramBody } from '../../src/pages/production-fulfillment/production-order-diagrams.ts'
import { fullFlowRail } from '../../src/pages/production-fulfillment/full-flow-diagrams.ts'

for (const c of listTimingCases()) test(`POST-FOLD ${c.key}: post work is nested and the sewing label is unified`, () => {
  setTimingDiagramScene(c.key)
  let html = renderTimingDiagramBody()
  assert.ok(html.includes('<strong>车缝执行</strong>'))
  assert.ok(!html.includes('具体车缝执行'))
  for (const label of ['后道质检', '后道加工', '后道复检', '后道交货']) assert.ok(!html.includes(`<strong>${label}</strong>`), label)
  timingDiagramState().expanded.post = true
  html = renderTimingDiagramBody()
  const start = html.indexOf('id="branch-post"')
  const end = html.indexOf('<strong>成衣仓入库</strong>', start)
  const branch = html.slice(start, end)
  for (const label of ['后道质检', '后道加工', '后道复检', '后道交货']) assert.ok(branch.includes(`<strong>${label}</strong>`), label)
})

test('POST-TIME: completed and active work show actual times and longest own clock without inventing an SLA', () => {
  for (const kind of ['sewing', 'qc', 'processing', 'recheck', 'delivery', 'post']) {
    const html = fullFlowRail(getTimingCaseByScene('fullContract'), kind, (_start, _end, label) => label)
    assert.match(html, /实际开始|首批实收/)
    assert.match(html, /已用|耗时/)
    assert.match(html, /时效要求未确认/)
    assert.ok(!html.includes('已超时') && !html.includes('按期完成'))
  }
  const lateHistory = fullFlowRail(getTimingCaseByScene('completeLate'), 'post', (_a, _b, label) => label)
  assert.match(lateHistory, /实际完成/)
  const missing = fullFlowRail(getTimingCaseByScene('completeUnknown'), 'delivery', (_a, _b, label) => label)
  assert.match(missing, /完成时间待核实/)
  assert.ok(!missing.includes('待接收 · 已用'))
})

test('POST-TIME: known document requirements distinguish unfinished late work from completed late history', () => {
  const c = getTimingCaseByScene('fullContract'), branch = getTimingBranch(c)!
  const batch = c.fullFlow.batches.find((b: any) => branch.docs[b.processingDocumentId]?.clock?.end)!
  const d = branch.docs[batch.processingDocumentId], clock = d.clock!, old = { ...clock }, status = d.status
  try {
    Object.assign(clock, { sla: 1 / 1440 })
    let html = fullFlowRail(c, 'processing', (_a, _b, label) => label)
    assert.match(html, /1项已完成.*晚/)
    clock.end = null
    d.status = '后道中'
    html = fullFlowRail(c, 'processing', (_a, _b, label) => label)
    assert.match(html, /1项未完成.*已超时/)
  } finally {
    Object.assign(clock, old)
    delete clock.sla
    d.status = status
  }
})
