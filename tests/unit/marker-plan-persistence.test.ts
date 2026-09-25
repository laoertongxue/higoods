import assert from 'node:assert/strict'
import test from 'node:test'
import { buildMarkerPlanSummaryBuildOptions } from '../../src/pages/process-factory/cutting/marker-plan-projection.ts'
import { buildMarkerPlanViewModel } from '../../src/pages/process-factory/cutting/marker-plan-model.ts'

test('可编辑的演示唛架保存后优先读取用户记录，刷新不恢复原备注和状态', () => {
  const sources = buildMarkerPlanSummaryBuildOptions(undefined, {}, { sourceIdentityOnly: true })
  const initial = buildMarkerPlanViewModel(sources)
  const original = initial.plans.find(plan => plan.confirmationStatus !== '已确认')!
  assert.ok(original?.beds?.length)
  const saved = structuredClone(original)
  saved.beds![0].remark = '已保存的床次备注'
  saved.confirmationStatus = '已确认'
  const reloaded = buildMarkerPlanViewModel(sources, [saved])
  assert.equal(reloaded.plansById[saved.id].beds![0].remark, '已保存的床次备注')
  assert.equal(reloaded.plansById[saved.id].confirmationStatus, '已确认')
  assert.equal(reloaded.plans.length, initial.plans.length)
  saved.status = 'CANCELED'
  assert.equal(buildMarkerPlanViewModel(sources, [saved]).plansById[saved.id].status, 'CANCELED')
})
