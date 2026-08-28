import assert from 'node:assert/strict'

import { listStyleArchives, resetStyleArchiveRepository } from '../src/data/pcs-style-archive-repository.ts'
import {
  createEngineeringMasterOrder,
  publishEngineeringMasterOrder,
  resetEngineeringMasterRepository,
} from '../src/data/pcs-engineering-master-repository.ts'
import { renderPcsFirstSampleTaskPage } from '../src/pages/pcs-engineering-tasks/first-sample-task.ts'
import { renderPcsPatternTaskPage } from '../src/pages/pcs-engineering-tasks/pattern-task.ts'
import { renderPcsPlateMakingTaskPage } from '../src/pages/pcs-engineering-tasks/plate-making-task.ts'

resetStyleArchiveRepository()
resetEngineeringMasterRepository()

const style = listStyleArchives()[0]
assert.ok(style)
const master = publishEngineeringMasterOrder(createEngineeringMasterOrder({
  styleId: style.styleId,
  styleCode: style.styleCode,
  merchandiserId: 'MERCHANDISER-A',
  merchandiserName: '跟单A',
  createdById: 'MERCHANDISER-A',
  createdBy: '跟单A',
  createdByRole: '跟单',
  preparationType: 'PURE_WOVEN',
  qualificationFact: {
    styleCode: style.styleCode,
    formalSaleStatus: 'NO_FORMAL_SALE',
    formalProductionStatus: 'NO_FORMAL_PRODUCTION',
    formalSaleSource: '专项测试固定事实',
    formalProductionSource: '专项测试固定事实',
    checkedAt: '2026-08-27 09:00:00',
  },
  bulkProductionQualification: {
    basisType: 'TEST_APPROVED',
    triggerBusinessObjectType: '专项测试',
    triggerBusinessObjectId: 'PROFESSIONAL-FACT-SOURCE',
    thresholdQuantity: 1,
    reachedQuantity: 1,
    reachedAt: '2026-08-27 09:00:00',
    reason: '专项测试已满足做大货要求',
    uniqueTriggerKey: 'PROFESSIONAL-FACT-SOURCE',
  },
  creationReason: '专项测试创建工程主单',
}).masterOrderId)

const pages = [
  renderPcsPlateMakingTaskPage(),
  renderPcsPatternTaskPage(),
  renderPcsFirstSampleTaskPage(),
]

for (const html of pages) {
  assert.match(html, new RegExp(master.masterOrderCode), '专业任务页必须展示工程主单编号')
  assert.match(html, new RegExp(master.styleCode), '专业任务页必须展示工程主单款式')
  assert.doesNotMatch(html, /异常待处理|已取消|待确认|已确认|待样板确认|样板已通过|样板已驳回/, '专业任务页不得暴露旧任务状态')
}

assert.match(pages[0], new RegExp(`${master.masterOrderId}-BASE_PATTERN_WOVEN`))
assert.match(pages[1], new RegExp(`${master.masterOrderId}-PATTERN_ARTWORK`))
assert.match(pages[2], new RegExp(`${master.masterOrderId}-PRE_PRODUCTION_SAMPLE`))

console.log('pcs-engineering-professional-fact-source.spec.ts PASS')
