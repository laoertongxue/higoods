import assert from 'node:assert/strict'

import { listStyleArchives, resetStyleArchiveRepository } from '../src/data/pcs-style-archive-repository.ts'
import {
  createEngineeringMasterOrder,
  getEngineeringMasterOrderById,
  publishEngineeringMasterOrder,
  resetEngineeringMasterRepository,
  submitEngineeringTaskResult,
} from '../src/data/pcs-engineering-master-repository.ts'
import {
  renderPcsFirstSampleTaskDetailPage,
  submitEngineeringFirstSampleResult,
} from '../src/pages/pcs-engineering-tasks/first-sample-task.ts'

resetStyleArchiveRepository()
resetEngineeringMasterRepository()

const style = listStyleArchives()[0]
assert.ok(style)
const master = publishEngineeringMasterOrder(createEngineeringMasterOrder({
  styleId: style.styleId,
  styleCode: style.styleCode,
  merchandiserName: '跟单A',
}).masterOrderId)

submitEngineeringTaskResult(master.masterOrderId, `${master.masterOrderId}-BASE_PATTERN_WOVEN`)
submitEngineeringTaskResult(master.masterOrderId, `${master.masterOrderId}-BASE_PATTERN_KNIT`)

const taskId = `${master.masterOrderId}-PRE_PRODUCTION_SAMPLE`
assert.throws(
  () => submitEngineeringFirstSampleResult(taskId, {
    resultImageIds: [],
    resultQuantity: 2,
    submittedBy: '制作团队A',
  }),
  /至少上传一张结果图片/,
)
assert.throws(
  () => submitEngineeringFirstSampleResult(taskId, {
    resultImageIds: ['mock://first-sample/front'],
    resultQuantity: 0,
    submittedBy: '制作团队A',
  }),
  /制作数量必须大于 0/,
)
assert.throws(
  () => submitEngineeringFirstSampleResult(taskId, {
    resultImageIds: ['mock://first-sample/front'],
    resultQuantity: 2,
    submittedBy: '   ',
  }),
  /请填写提交人/,
)
const submitted = submitEngineeringFirstSampleResult(taskId, {
  resultImageIds: ['mock://first-sample/front', 'mock://first-sample/back'],
  resultQuantity: 2,
  submittedBy: '制作团队A',
})

assert.equal(submitted.status, '已完成')
assert.deepEqual(submitted.resultImageIds, ['mock://first-sample/front', 'mock://first-sample/back'])
assert.equal(submitted.resultQuantity, 2)
assert.equal(submitted.resultSubmittedBy, '制作团队A')
assert.ok(submitted.submittedAt)
assert.equal(submitted.startedAt, submitted.submittedAt)

const stored = getEngineeringMasterOrderById(master.masterOrderId)?.tasks.find((task) => task.taskId === taskId)
assert.deepEqual(stored, submitted)

const html = renderPcsFirstSampleTaskDetailPage(taskId)
assert.match(html, /已完成/)
assert.match(html, /2 件/)
assert.match(html, /2 张/)
assert.doesNotMatch(html, /验收|待确认|确认人|首单复用|需改版/)

console.log('pcs-first-sample-engineering-result.spec.ts PASS')
