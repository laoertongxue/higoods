import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  projectEngineeringMasterToPreparation,
  projectEngineeringMastersToPreparation,
} from '../src/data/pcs-engineering-preparation-projection.ts'
import {
  EMPTY_PREPARATION_RUNTIME_STATE,
  getPreparationRecordCapabilities,
  mergePreparationRuntimeRecords,
} from '../src/data/fcs/production-preparation-timing-runtime.ts'
import {
  buildMonthlyPreparationCompletionDetails,
  buildProductionPreparationKpis,
} from '../src/data/fcs/production-preparation-timing.ts'
import type {
  EngineeringMasterOrderRecord,
  EngineeringTaskRecord,
  EngineeringTaskType,
} from '../src/data/pcs-engineering-master-types.ts'

const TASK_TYPES: EngineeringTaskType[] = [
  'BASE_PATTERN_WOVEN',
  'BASE_PATTERN_KNIT',
  'PRE_PRODUCTION_SAMPLE',
  'SIZE_PATTERN_WOVEN',
  'SIZE_PATTERN_KNIT',
  'PATTERN_ARTWORK',
  'COLOR_YARN',
  'COLOR_FABRIC',
  'ACCESSORY_PURCHASE',
  'TECH_PACK_CONFIRMATION',
]

function task(taskType: EngineeringTaskType, patch: Partial<EngineeringTaskRecord> = {}): EngineeringTaskRecord {
  return {
    taskId: `EM-TEST-${taskType}`,
    masterOrderId: 'EM-TEST',
    taskType,
    taskName: taskType,
    status: '已完成',
    dependsOnTaskIds: [],
    ownerTeamName: '测试团队',
    materialLines: [],
    reworkRounds: [],
    startedAt: '2026-07-30 08:00',
    submittedAt: '2026-07-30 10:00',
    firstCompletedAt: '2026-07-30 10:00',
    effectiveCompletedAt: '2026-07-30 10:00',
    completedAt: '2026-07-30 10:00',
    boundPurchaseOrderNos: taskType === 'ACCESSORY_PURCHASE' ? ['CG-TEST-001'] : [],
    resultImageIds: [],
    resultQuantity: 1,
    resultSubmittedBy: '测试人员',
    materialReviewRounds: [],
    colorRequirementConfirmedBy: '跟单-测试',
    colorRequirementConfirmedAt: '2026-07-30 09:00',
    colorResultCompletedAt: '2026-07-30 10:00',
    ...patch,
  }
}

function master(patch: Partial<EngineeringMasterOrderRecord> = {}): EngineeringMasterOrderRecord {
  return {
    masterOrderId: 'EM-TEST',
    masterOrderCode: 'EM-TEST-001',
    styleId: 'STYLE-TEST',
    styleCode: 'SPU-TEST-001',
    styleName: '测试款式',
    status: '进行中',
    merchandiserName: '跟单-测试',
    tasks: TASK_TYPES.map((type) => task(type)),
    priorResultReuseLines: [],
    createdAt: '2026-07-30 07:30',
    createdBy: '跟单-测试',
    publishedAt: '2026-07-30 08:00',
    closedAt: '',
    terminatedAt: '',
    terminateReason: '',
    ...patch,
  }
}

const first = projectEngineeringMasterToPreparation(master())
const second = projectEngineeringMasterToPreparation(master())

assert.equal(first.items.length, 11, '工程主单必须完整投影 11 个固定准备项')
assert.deepEqual(second, first, '重复投影必须幂等')
assert.equal(new Set(first.items.map((item) => item.itemType)).size, 11, '重复任务事件不能重复累计准备项')

const missingPredecessors = master({
  tasks: [task('SIZE_PATTERN_WOVEN')],
})
const completedProjection = projectEngineeringMasterToPreparation(missingPredecessors)
assert.equal(completedProjection.items.length, 11, '缺少事件时也必须自动补齐固定准备项')
const wovenSize = completedProjection.items.find((item) => item.itemType === '梭织齐码纸样')!
const sample = completedProjection.items.find((item) => item.itemType === '版衣制作')!
assert.deepEqual(wovenSize.dependsOnItemIds, [sample.itemId], '固定依赖必须由策略生成，不能读取可变输入')
const missingTaskItem = completedProjection.items.find((item) => item.itemType === '毛织基码纸样')!
assert.equal(missingTaskItem.taskId, '', '缺少真实专业任务时不得合成 taskId')
assert.equal(missingTaskItem.taskHref, '', '缺少真实专业任务时不得生成可点击链接')

const reused = projectEngineeringMasterToPreparation(master({
  priorResultReuseLines: [{
    resultType: 'SIZE_PATTERN_WOVEN',
    resultLabel: '梭织齐码纸样',
    decision: '复用',
    sourceTaskId: 'PRIOR-SIZE-WOVEN',
    sourceTaskLabel: '前期梭织齐码纸样',
  }],
}))
const reusedItem = reused.items.find((item) => item.itemType === '梭织齐码纸样')!
assert.equal(reusedItem.reusedPriorResult, true)
assert.equal(reusedItem.actualStartAt, '')
assert.equal(reusedItem.actualFinishAt, '')
assert.equal(reusedItem.includedInDurationStats, false)

const reworked = projectEngineeringMasterToPreparation(master({
  tasks: TASK_TYPES.map((type) => type === 'BASE_PATTERN_WOVEN'
    ? task(type, {
        firstCompletedAt: '2026-07-30 10:00',
        effectiveCompletedAt: '2026-07-30 14:30',
        reworkRounds: [
          { roundNo: 2, reason: '纸样复核', startedAt: '2026-07-30 11:00', submittedAt: '2026-07-30 14:00', passedAt: '2026-07-30 14:30' },
          { roundNo: 2, reason: '重复事件', startedAt: '2026-07-30 11:00', submittedAt: '2026-07-30 14:00', passedAt: '2026-07-30 14:30' },
        ],
      })
    : task(type)),
}))
const reworkedItem = reworked.items.find((item) => item.itemType === '梭织基码纸样')!
assert.equal(reworkedItem.firstFinishedAt, '2026-07-30 10:00')
assert.equal(reworkedItem.effectiveFinishedAt, '2026-07-30 14:30')
assert.equal(reworkedItem.latestRoundNo, 2)
assert.equal(reworkedItem.eventKeys.length, 2, '重复轮次事件必须按 masterOrderId + taskId + roundNo 去重')

const completedWithMissingStart = projectEngineeringMasterToPreparation(master({
  tasks: TASK_TYPES.map((type) => type === 'BASE_PATTERN_WOVEN'
    ? task(type, { startedAt: '' })
    : task(type)),
}))
const missingStartKpis = buildProductionPreparationKpis([completedWithMissingStart])
assert.equal(
  missingStartKpis.find((kpi) => kpi.key === 'required-items')?.value,
  11,
  '非复用完成项缺开始时间时仍必须计入已选准备项',
)
assert.equal(
  missingStartKpis.find((kpi) => kpi.key === 'completion-rate')?.value,
  100,
  '非复用完成项缺开始时间时仍必须计入完成率',
)
const missingStartDetails = buildMonthlyPreparationCompletionDetails(
  '2026-07',
  {},
  [completedWithMissingStart],
)
assert.equal(missingStartDetails.length, 11, '缺开始时间的普通完成项仍必须保留在完成数量明细')
const missingStartDetail = missingStartDetails.find((item) => item.itemType === '梭织基码纸样')!
assert.equal(
  (missingStartDetail as typeof missingStartDetail & { timingDataComplete?: boolean }).timingDataComplete,
  false,
  '缺开始时间的完成项应标记时效数据缺失，不得从完成明细消失',
)

const originalClosedMaster = master({
  masterOrderId: 'EM-FIRST-CLOSED',
  masterOrderCode: 'EM-FIRST-CLOSED-001',
  status: '已关闭',
  createdAt: '2026-07-01 08:00',
  publishedAt: '2026-07-01 09:00',
  closedAt: '2026-07-31 18:00',
  tasks: TASK_TYPES.map((type) => task(type, {
    taskId: `EM-FIRST-CLOSED-${type}`,
    masterOrderId: 'EM-FIRST-CLOSED',
  })),
})
const illegalLaterActiveMaster = master({
  masterOrderId: 'EM-LATER-ACTIVE',
  masterOrderCode: 'EM-LATER-ACTIVE-001',
  status: '进行中',
  createdAt: '2026-08-01 08:00',
  publishedAt: '2026-08-01 09:00',
  tasks: TASK_TYPES.map((type) => task(type, {
    taskId: `EM-LATER-ACTIVE-${type}`,
    masterOrderId: 'EM-LATER-ACTIVE',
  })),
})
const sameStyleLegacy = structuredClone(first)
sameStyleLegacy.recordId = 'legacy-same-style'
sameStyleLegacy.sourceKind = undefined
sameStyleLegacy.masterOrderId = undefined
const uniqueFirstOrderRecords = projectEngineeringMastersToPreparation(
  [illegalLaterActiveMaster, originalClosedMaster],
  [sameStyleLegacy],
)
assert.equal(uniqueFirstOrderRecords.length, 1, '同一 SPU 只能投影一张最初首单主单，legacy 也只能替换一次')
assert.equal(uniqueFirstOrderRecords[0].masterOrderId, originalClosedMaster.masterOrderId, '后来非法 active 主单不得覆盖原始首单事实')
assert.equal(uniqueFirstOrderRecords[0].status, '已关闭', '已关闭首单必须投影为已关闭记录')
assert.equal(
  buildProductionPreparationKpis(uniqueFirstOrderRecords).find((kpi) => kpi.key === 'active-records')?.value,
  0,
  '已关闭首单不得进入 active KPI',
)

assert.equal(first.masterOrderHref, '/pcs/engineering/masters/EM-TEST')
assert.ok(first.items.every((item) => item.taskHref), '每个准备项必须保留专业任务查看链接')
assert.equal(first.items.find((item) => item.itemType === '辅料下单')?.purchaseOrderHref, '/pms/purchase-order?purchaseOrderNo=CG-TEST-001')
assert.equal(first.techPackHref, '/pcs/engineering/tech-pack/EM-TEST-TECH_PACK_CONFIRMATION')

const capabilities = getPreparationRecordCapabilities(first)
assert.deepEqual(capabilities, {
  confirmItems: false,
  modifyItems: false,
  uploadResult: false,
  maintainDyeRequirement: false,
  reviewResult: false,
})
const maliciousRuntime = {
  ...EMPTY_PREPARATION_RUNTIME_STATE,
  confirmedRecords: {
    [first.recordId]: { confirmedBy: '伪造用户', confirmedAt: '2026-08-01 12:00' },
  },
  uploads: [{
    uploadId: 'forged-upload',
    recordId: first.recordId,
    itemId: first.items[0].itemId,
    itemType: first.items[0].itemType,
    fileName: '伪造成果.pdf',
    fileType: 'application/pdf',
    fileSize: 1,
    fileDataUrl: 'data:application/pdf;base64,',
    uploadedBy: '伪造用户',
    uploadedAt: '2026-08-01 12:00',
    note: '',
  }],
}
assert.deepEqual(mergePreparationRuntimeRecords([first], maliciousRuntime), [first], '旧运行态不得修改工程来源投影')

const pageSource = readFileSync('src/pages/production/preparation-timing.ts', 'utf8')
assert.ok(pageSource.includes('getPreparationRecordCapabilities'), '页面必须按记录能力阻断工程来源编辑入口')
assert.ok(pageSource.includes('projectEngineeringMastersToPreparation'), '页面必须直接读取工程主单投影')
assert.ok(
  pageSource.includes('前期成果复用 / 不计本次时效'),
  '复用项必须显示只读复用说明，不得落入旧凭证异常提示',
)
assert.ok(
  pageSource.includes("item.reusedPriorResult ? renderReusedResultNotice(item)"),
  '复用说明必须优先于旧记录的异常/补传分支，且不生成上传动作',
)

console.log('pcs engineering preparation projection tests passed')
