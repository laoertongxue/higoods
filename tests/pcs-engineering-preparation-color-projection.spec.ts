import assert from 'node:assert/strict'

import { listStyleArchives, resetStyleArchiveRepository } from '../src/data/pcs-style-archive-repository.ts'
import {
  createEngineeringMasterOrder,
  publishEngineeringMasterOrder,
  resetEngineeringMasterRepository,
  updateEngineeringTaskRecord,
} from '../src/data/pcs-engineering-master-repository.ts'
import type { EngineeringTaskMaterialLine } from '../src/data/pcs-engineering-master-types.ts'
import { renderProductionPreparationTimingPage } from '../src/pages/production/preparation-timing.ts'

function dyeLine(materialLineId: string): EngineeringTaskMaterialLine {
  return {
    materialLineId,
    materialSkuId: `SKU-${materialLineId}`,
    materialName: `物料-${materialLineId}`,
    materialType: '面料',
    requirementType: '染色',
    status: '正常',
    resultFileIds: ['file://color-result.jpg'],
    effectImageIds: [],
    resultSubmittedBy: '染厂A',
    resultSubmittedAt: '2026-08-01 12:00:00',
    reviewStatus: '通过',
    reviewReason: '',
    reviewedBy: '买手A',
    reviewedAt: '2026-08-01 14:30:00',
  }
}

resetStyleArchiveRepository()
resetEngineeringMasterRepository()

const style = listStyleArchives()[0]
assert.ok(style)
const master = publishEngineeringMasterOrder(createEngineeringMasterOrder({
  styleId: style.styleId,
  styleCode: style.styleCode,
  merchandiserId: 'USER-M-A',
  merchandiserName: '跟单A',
  createdById: 'USER-M-A', createdBy: '跟单A', createdByRole: '跟单', preparationType: 'PURE_WOVEN',
  qualificationFact: { styleCode: style.styleCode, formalSaleStatus: 'NO_FORMAL_SALE', formalProductionStatus: 'NO_FORMAL_PRODUCTION', formalSaleSource: '正式销售订单', formalProductionSource: '正式生产单', checkedAt: '2026-08-04 09:00:00' },
  bulkProductionQualification: { basisType: 'TEST_APPROVED', triggerBusinessObjectType: '测款结果', triggerBusinessObjectId: 'TEST-COLOR', thresholdQuantity: 300, reachedQuantity: 320, reachedAt: '2026-08-04 09:00:00', reason: '已满足做大货要求', uniqueTriggerKey: 'TEST-COLOR' }, creationReason: '跟单核实创建',
}).masterOrderId)
const taskId = `${master.masterOrderId}-COLOR_FABRIC`

updateEngineeringTaskRecord(master.masterOrderId, taskId, (task) => {
  task.status = '已完成'
  task.materialLines = [dyeLine('DYE-FABRIC-1')]
  task.colorRequirementConfirmedBy = '跟单A'
  task.colorRequirementConfirmedAt = '2026-08-01 10:15:00'
  task.colorResultCompletedAt = '2026-08-01 14:30:00'
  task.firstCompletedAt = '2026-08-01 14:30:00'
  task.effectiveCompletedAt = '2026-08-01 14:30:00'
})

const recordId = `engineering-preparation-${master.masterOrderId}`
const html = renderProductionPreparationTimingPage(
  `/fcs/production/preparation-timing?month=2026-08&recordId=${recordId}`,
)
assert.match(html, /固定准备项/)
assert.match(html, /确认染色要求（面料）/)
assert.match(html, /2026-08-01 10:15/, '生产准备时效必须读取跟单确认染色要求完成时间')
assert.match(html, /染色调色（面料）/)
assert.match(html, /2026-08-01 14:30/, '生产准备时效必须读取买手最终审核通过时间')
assert.match(html, new RegExp(master.masterOrderCode), '工程来源准备项必须展示工程主单来源')
assert.doesNotMatch(html, /证据缺失/, '工程主单节点时间本身就是生产准备只读完成证据')

console.log('PCS 调色节点已接入生产准备时效只读视图链路')
