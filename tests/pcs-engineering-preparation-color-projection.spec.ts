import assert from 'node:assert/strict'

import { listStyleArchives, resetStyleArchiveRepository } from '../src/data/pcs-style-archive-repository.ts'
import {
  createEngineeringMasterOrder,
  publishEngineeringMasterOrder,
  resetEngineeringMasterRepository,
  updateEngineeringTaskRecord,
} from '../src/data/pcs-engineering-master-repository.ts'
import type { EngineeringTaskMaterialLine } from '../src/data/pcs-engineering-master-types.ts'
import { productionPreparationRecords } from '../src/data/fcs/production-preparation-timing.ts'
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
  merchandiserName: '跟单A',
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

const baseRecord = productionPreparationRecords.find((record) =>
  record.items.some((item) => item.itemType === '确认染色要求（面料）') &&
  record.items.some((item) => item.itemType === '染色调色（面料）'),
)
assert.ok(baseRecord)

const testRecord = structuredClone(baseRecord)
testRecord.recordId = 'prep-engineering-color-projection'
testRecord.recordNo = 'PREP-ENGINEERING-COLOR'
testRecord.spuCode = style.styleCode
testRecord.spuName = style.styleName
testRecord.enteredAt = '2026-08-01 09:00:00'
testRecord.workItemsConfirmedBy = '跟单A'
testRecord.workItemsConfirmedAt = '2026-08-01 09:05:00'
testRecord.items = testRecord.items.map((item) => {
  if (item.itemType !== '确认染色要求（面料）' && item.itemType !== '染色调色（面料）') return item
  return {
    ...item,
    recordId: testRecord.recordId,
    actualFinishAt: '',
    status: '待开始',
    evidenceSummary: '旧生产准备运行态未记录工程节点时间',
  }
})

productionPreparationRecords.push(testRecord)
try {
  const html = renderProductionPreparationTimingPage(
    `/fcs/production/preparation-timing?month=2026-08&recordId=${testRecord.recordId}`,
  )
  assert.match(html, /确认染色要求（面料）/)
  assert.match(html, /2026-08-01 10:15/, '生产准备时效必须读取跟单确认染色要求完成时间')
  assert.match(html, /染色调色（面料）/)
  assert.match(html, /2026-08-01 14:30/, '生产准备时效必须读取买手最终审核通过时间')
  assert.match(html, new RegExp(master.masterOrderCode), '工程来源准备项必须展示工程主单来源')
  assert.doesNotMatch(html, /证据缺失/, '工程主单节点时间本身就是生产准备只读完成证据')
} finally {
  productionPreparationRecords.splice(productionPreparationRecords.indexOf(testRecord), 1)
}

console.log('PCS 调色节点已接入生产准备时效只读视图链路')
