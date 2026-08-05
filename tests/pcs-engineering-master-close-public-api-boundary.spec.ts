import assert from 'node:assert/strict'

import * as masterRepositoryPublicApi from '../src/data/pcs-engineering-master-repository.ts'
import {
  closeEngineeringMasterOrder,
  createEngineeringMasterOrder,
  getEngineeringMasterOrderById,
  publishEngineeringMasterOrder,
  resetEngineeringMasterRepository,
  updateEngineeringTaskRecord,
} from '../src/data/pcs-engineering-master-repository.ts'
import { listStyleArchives } from '../src/data/pcs-style-archive-repository.ts'

resetEngineeringMasterRepository()
const style = listStyleArchives()[0]
assert.ok(style)
const master = publishEngineeringMasterOrder(createEngineeringMasterOrder({
  styleId: style.styleId,
  styleCode: style.styleCode,
  merchandiserId: 'USER-M-LX',
  merchandiserName: '跟单-林晓',
  createdById: 'USER-M-LX',
  createdBy: '跟单-林晓',
  createdByRole: '跟单', preparationType: 'PURE_WOVEN',
  qualificationFact: { styleCode: style.styleCode, formalSaleStatus: 'NO_FORMAL_SALE', formalProductionStatus: 'NO_FORMAL_PRODUCTION', formalSaleSource: '正式销售订单', formalProductionSource: '正式生产单', checkedAt: '2026-08-04 09:00:00' },
  bulkProductionQualification: { basisType: 'TEST_APPROVED', triggerBusinessObjectType: '测款结果', triggerBusinessObjectId: 'TEST-CLOSE-PUBLIC', thresholdQuantity: 300, reachedQuantity: 320, reachedAt: '2026-08-04 09:00:00', reason: '已满足做大货要求', uniqueTriggerKey: 'TEST-CLOSE-PUBLIC' }, creationReason: '跟单核实创建',
}).masterOrderId)
for (const task of master.tasks) {
  updateEngineeringTaskRecord(master.masterOrderId, task.taskId, (draft) => {
    draft.status = draft.status === '未启用' ? '因需求变更结束' : '已完成'
  })
}

assert.throws(
  () => closeEngineeringMasterOrder(master.masterOrderId, '跟单-林晓'),
  /正式技术包|审核发布|正式快照/,
  '唯一公开关闭入口必须执行正式技术包与快照门禁',
)

const lowLevelClose = Reflect.get(masterRepositoryPublicApi, 'commitEngineeringMasterOrderClose')
if (typeof lowLevelClose === 'function') {
  lowLevelClose(master.masterOrderId, '跟单-林晓')
}
assert.notEqual(
  getEngineeringMasterOrderById(master.masterOrderId)?.status,
  '已关闭',
  '没有正式技术包时，直接调用任何公开仓储关闭 API 都不能把工程主单关闭',
)
assert.equal(
  typeof lowLevelClose,
  'undefined',
  '工程主单仓储公开 API 不得暴露绕过正式技术包与快照门禁的低层关闭写入口',
)

console.log('pcs-engineering-master-close-public-api-boundary.spec.ts PASS')
