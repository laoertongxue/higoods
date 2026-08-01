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
  merchandiserName: '跟单A',
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
