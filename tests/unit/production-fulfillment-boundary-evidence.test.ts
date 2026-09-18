import assert from 'node:assert/strict'
import test from 'node:test'
import { boundaryFacts, boundaryResults, renderBoundaryEvidence } from '../../src/pages/production-fulfillment/boundary-evidence'
import { tasks } from '../../src/pages/production-fulfillment/fixtures'

test('BOM uses formally reduced quantity and leaves unsupported conversion unknown', () => {
  const result = boundaryResults()
  assert.equal(result.effectiveGarmentQty, 900)
  assert.equal(result.materialDemandM, 1134)
  assert.equal(result.convertedDemand, null)
  assert.equal(boundaryFacts.bom.conversionEvidenceId, null)
})
test('reuse retains one shared source instance and adds no duplicate processing duration', () => {
  assert.equal(boundaryResults().reuse.referenceCount, 2)
  assert.equal(boundaryResults().reuse.globalInstanceCount, 1)
  assert.equal(boundaryResults().reuse.additionalProcessingDays, 0)
  assert.ok(boundaryFacts.preparation.reuseEvidence)
  assert.notEqual(boundaryFacts.preparation.originalDemand, boundaryFacts.preparation.reusedByDemand)
})
test('a new rework/recheck round extends the dependency path two days and conserves qualified pieces', () => {
  const result = boundaryResults().rework
  assert.equal(result.baselineDays, 4)
  assert.equal(result.latestPathDays, 6)
  assert.equal(result.addedDays, 2)
  assert.equal(result.nodes['REWORK-R2'].start, 3)
  assert.equal(result.nodes['RECHECK-R2'].finish, 5)
  assert.equal(result.qualifiedQty, 100)
  assert.equal(result.originalRejectedQty, 20)
  assert.equal(result.eventCount, 2)
})
test('date-only source is not coerced to a precise instant or exact deadline', () => {
  assert.equal(boundaryFacts.dateOnly.sourceValue, '2026-09-17')
  assert.equal(boundaryResults().dateOnly.exactStartAt, null)
  assert.equal(boundaryResults().dateOnly.exactDueAt, null)
})
test('known order shipment can be timed without crediting an unknown production source', () => {
  const result = boundaryResults()
  assert.equal(result.missingOrigin.orderActualDays, 10)
  assert.equal(result.missingOrigin.orderOverdueDays, 3)
  assert.equal(result.missingOrigin.creditedToSpecificTaskQty, 0)
  assert.equal(result.missingOrderTime.actualDays, null)
  assert.equal(result.missingOrderTime.overdueDays, null)
})
test('waiting for actual fulfillment can be overall late while factory completion stays on time', () => {
  const result = boundaryResults().awaitingFulfillment
  assert.equal(result.factoryOverdueDays, 0)
  assert.equal(result.overallOverdueDays, 1)
  assert.equal(result.responsibleTeam, '销售／履约团队')
})
test('all six named cards render directly checkable evidence without changing production task facts', () => {
  const before = JSON.stringify(tasks)
  const html = renderBoundaryEvidence()
  for (const id of ['BOM', 'REUSE', 'REWORK', 'DATE-PRECISION', 'SHIPMENT-IDENTITY', 'AWAITING-FULFILLMENT']) assert.ok(html.includes(`data-pf-boundary="${id}"`), id)
  assert.match(html, /1,134 M/)
  assert.match(html, /REWORK-R2/)
  assert.match(html, /2026-09-17（仅日期）/)
  assert.match(html, /产品设计第07.1节/)
  assert.match(html, /DDS不提供手工造完工/)
  assert.equal(JSON.stringify(tasks), before)
})
