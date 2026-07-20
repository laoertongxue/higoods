import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  assessMarkerPlanVoid,
  buildSpreadingVoidImpact,
  createMarkerVoidAuditRecord,
  isMarkerPlanSelectableForSpreading,
  validateMarkerVoidInput,
} from '../src/data/fcs/cutting/marker-plan-void-domain.ts'

const spreadingPageSource = readFileSync(new URL('../src/pages/process-factory/cutting/marker-spreading.ts', import.meta.url), 'utf8')

const refs = {
  productionOrderIds: ['po-14671'],
  productionOrderNos: ['PO14671'],
  cutOrderIds: ['cut-14671-a'],
  cutOrderNos: ['CUT14671-A'],
  markerPlanId: 'plan-1',
  markerPlanNo: 'MKP-20260719-001',
  spreadingOrderNo: 'PB-14671-A-01',
  releaseMatrixRecordId: 'cpr-po-14671',
}

assert.equal(validateMarkerVoidInput({ entityType: 'marker-plan', entityId: 'p', entityNo: 'MKP-1', reason: '', operator: '计划员', occurredAt: '2026-07-19', sourceRefs: refs, quantityPolicy: '不回滚' }).allowed, false)
assert.equal(assessMarkerPlanVoid({ status: 'READY_FOR_SPREADING', hasSpreadingReference: false, activeSpreadingCount: 0, hasStartedSpreading: false }).allowed, true)
assert.equal(assessMarkerPlanVoid({ status: 'READY_FOR_SPREADING', hasSpreadingReference: true, activeSpreadingCount: 0, hasStartedSpreading: false }).messages[0], '方案已被历史铺布引用，作废后保留历史引用，不能再新建铺布。')
assert.equal(assessMarkerPlanVoid({ status: 'READY_FOR_SPREADING', hasSpreadingReference: true, activeSpreadingCount: 1, hasStartedSpreading: false }).allowed, false)
assert.equal(assessMarkerPlanVoid({ status: 'READY_FOR_SPREADING', hasSpreadingReference: true, activeSpreadingCount: 0, hasStartedSpreading: true }).allowed, false)
assert.equal(isMarkerPlanSelectableForSpreading('CANCELED'), false)
assert.match(spreadingPageSource, /无有效裁片事实，未产生数量回滚/)
assert.match(spreadingPageSource, /来源生产单缺失.*阻断作废铺布/)
assert.match(spreadingPageSource, /按幂等处理，未重复写入日志或数量/)
const audit = createMarkerVoidAuditRecord({ eventId: 'void-1', entityType: 'marker-plan', entityId: 'p', entityNo: ' MKP-1 ', status: '已作废', reason: '重新排唛架', operator: '计划员', occurredAt: '2026-07-19 10:00', sourceRefs: refs, quantityPolicy: '不回滚', impactSummary: '保留引用' })
assert.equal(audit.entityNo, 'MKP-1')
assert.match(buildSpreadingVoidImpact({ spreadingOrderNo: 'PB-1', sourceCutOrderNos: ['CUT-1'], plannedGarmentQty: 200, actualGarmentQty: 198, quantityPolicy: '按反向冲销', frozenCutOrderNos: ['CUT-2'] }), /198.*反向冲销|反向冲销.*198/)
console.log(JSON.stringify({ 唛架作废边界: '通过', 作废审计字段: '通过', 铺布冲销口径: '通过', 历史冻结提示: '通过' }, null, 2))
