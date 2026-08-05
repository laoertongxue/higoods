import assert from 'node:assert/strict'

import { listStyleArchives, resetStyleArchiveRepository } from '../src/data/pcs-style-archive-repository.ts'
import {
  createEngineeringMasterOrder,
  getEngineeringMasterOrderById,
  publishEngineeringMasterOrder,
  resetEngineeringMasterRepository,
  submitEngineeringTaskResult,
  updateEngineeringTaskRecord,
} from '../src/data/pcs-engineering-master-repository.ts'
import { renderPcsPlateMakingTaskDetailPage } from '../src/pages/pcs-engineering-tasks/plate-making-task.ts'
import { startEngineeringTaskFromDetail } from '../src/pages/pcs-engineering-tasks/master-task-common.ts'

resetStyleArchiveRepository()
resetEngineeringMasterRepository()

const style = listStyleArchives().find((item) => item.mainImageUrl)
assert.ok(style, '应存在带真实主图的款式档案')

const master = createEngineeringMasterOrder({
  styleId: style.styleId,
  styleCode: style.styleCode,
  merchandiserId: 'USER-MERCHANDISER',
  merchandiserName: '跟单-林晓',
  createdById: 'USER-MERCHANDISER',
  createdBy: '跟单-林晓',
  createdByRole: '跟单',
  preparationType: 'PURE_WOVEN',
  qualificationFact: {
    styleCode: style.styleCode,
    formalSaleStatus: 'NO_FORMAL_SALE',
    formalProductionStatus: 'NO_FORMAL_PRODUCTION',
    formalSaleSource: '正式销售订单事实',
    formalProductionSource: '正式生产单事实',
    checkedAt: '2026-08-04 09:00:00',
  },
  bulkProductionQualification: {
    basisType: 'TEST_APPROVED',
    triggerBusinessObjectType: '测款结果',
    triggerBusinessObjectId: `TEST-${style.styleCode}`,
    thresholdQuantity: 300,
    reachedQuantity: 320,
    reachedAt: '2026-08-04 09:00:00',
    reason: '已满足做大货要求',
    uniqueTriggerKey: `WORKBENCH-${style.styleCode}`,
  },
  creationReason: '验证专业任务工作台',
})
const published = publishEngineeringMasterOrder(master.masterOrderId)
const plateTask = published.tasks.find((task) => task.taskType === 'BASE_PATTERN_WOVEN')
assert.ok(plateTask, '纯梭织主单应生成梭织基码纸样任务')

const beforeStartHtml = renderPcsPlateMakingTaskDetailPage(plateTask.taskId)
assert.match(beforeStartHtml, /当前动作/)
assert.match(beforeStartHtml, /开始任务/)
assert.match(beforeStartHtml, /data-engineering-task-action="start"[^>]*data-skip-page-rerender="true"/, '开始任务应局部刷新，不得被全页重绘覆盖结果或错误提示')
assert.match(beforeStartHtml, new RegExp(style.mainImageUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), '任务头部应展示目标款式真实图片')
assert.doesNotMatch(beforeStartHtml, /data-plate-form=/, '未开始前不得越过开始动作直接提交成果')
assert.throws(
  () => submitEngineeringTaskResult(master.masterOrderId, plateTask.taskId, { submittedBy: '版师' }),
  /请先点击“开始任务”/,
)

// 兼容当前原型中已持久化、但早于“生产准备类型”字段生成的已发布主单。
updateEngineeringTaskRecord(master.masterOrderId, plateTask.taskId, (_task, storedMaster) => {
  storedMaster.preparationType = ''
})
startEngineeringTaskFromDetail(plateTask.taskId)
const startedTask = getEngineeringMasterOrderById(master.masterOrderId)?.tasks.find((task) => task.taskId === plateTask.taskId)
assert.equal(startedTask?.status, '进行中')
assert.equal(startedTask?.assigneeName, '版师负责人')

const afterStartHtml = renderPcsPlateMakingTaskDetailPage(plateTask.taskId)
assert.match(afterStartHtml, /提交纸样成果/)
assert.match(afterStartHtml, /提交并完成任务/)
assert.doesNotMatch(afterStartHtml, /成果提交人.*input/, '提交人应从当前任务负责人自动记录，不要求业务重复填写')

console.log('pcs-engineering-task-workbench.spec.ts PASS')
