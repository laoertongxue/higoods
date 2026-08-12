import assert from 'node:assert/strict'

import {
  createEngineeringMasterOrder,
  getEngineeringMasterOrderById,
  getEngineeringMasterOrderStoreSnapshot,
  publishEngineeringMasterOrder,
  resetEngineeringMasterRepository,
  updateEngineeringTaskRecord,
} from '../src/data/pcs-engineering-master-repository.ts'
import {
  approveTechPackReview,
  listTechPackReviewReturnTargets,
  returnTechPackReviewByModules,
  returnTechPackReviewByTargets,
  startTechPackReview,
} from '../src/data/pcs-tech-pack-review.ts'
import {
  reviewEngineeringMaterialResults,
  submitEngineeringMaterialResults,
} from '../src/data/pcs-engineering-task-review.ts'
import {
  createTechnicalDataVersionDraft,
  getTechnicalDataVersionById,
  getTechnicalDataVersionContent,
  listTechnicalDataVersions,
  resetTechnicalDataVersionRepository,
} from '../src/data/pcs-technical-data-version-repository.ts'
import type {
  TechnicalDataVersionRecord,
  TechnicalReviewNode,
  TechnicalReviewNodeKey,
} from '../src/data/pcs-technical-data-version-types.ts'
import { listStyleArchives } from '../src/data/pcs-style-archive-repository.ts'
import { hasFormalProductionFact } from '../src/data/pcs-engineering-first-production-policy.ts'
import {
  listPatternTasks,
  resetPatternTaskRepository,
  upsertPatternTask,
} from '../src/data/pcs-pattern-task-repository.ts'
import { listTechPackReviewNotifications } from '../src/data/pcs-tech-pack-review-notification-repository.ts'
import { listTechPackVersionLogs } from '../src/data/pcs-tech-pack-version-log-repository.ts'

function reviewNode(nodeKey: TechnicalReviewNodeKey): TechnicalReviewNode {
  const meta = nodeKey === 'BUYER'
    ? { nodeName: '买手审核' as const, role: '买手' as const, id: 'BUYER-001', name: '买手A' }
    : nodeKey === 'PATTERN_MAKER'
    ? { nodeName: '版师审核' as const, role: '版师' as const, id: 'PATTERN-001', name: '版师B' }
    : { nodeName: '跟单审核' as const, role: '跟单' as const, id: 'MERCH-001', name: '跟单C' }
  return {
    nodeKey,
    nodeName: meta.nodeName,
    status: nodeKey === 'MERCHANDISER' ? '审核中' : '审核-已通过',
    reviewerRole: meta.role,
    assignedReviewerId: meta.id,
    assignedReviewerName: meta.name,
    assignedReviewerRole: meta.role,
    assignedReviewerFeishuOpenId: `ou_${meta.id.toLowerCase()}`,
    assignedAt: '2026-08-02 09:00',
    assignedBy: '跟单C',
    reviewedBy: meta.name,
    reviewedAt: '2026-08-02 10:00',
    startedOpinion: '开始审核',
    opinion: '',
    diffSnapshotId: `DIFF-${nodeKey}`,
    diffStatus: '有差异',
    diffSummaryText: '存在变更',
    lastFeishuNotifyAt: '',
    lastFeishuNotifyStatus: '未发送',
    lastFeishuNotifyRecordId: '',
    todayFeishuNotifiedFlag: false,
    todayFeishuNotifyAt: '',
    feishuNotifyCount: 0,
  }
}

resetEngineeringMasterRepository()
resetPatternTaskRepository()
const occupiedStyleIds = new Set(getEngineeringMasterOrderStoreSnapshot().records.filter((item) => !['已关闭', '已终止'].includes(item.status)).map((item) => item.styleId))
const style = listStyleArchives().find((item) => !occupiedStyleIds.has(item.styleId) && !hasFormalProductionFact(item.styleCode))
assert.ok(style)
const master = publishEngineeringMasterOrder(createEngineeringMasterOrder({
  styleId: style.styleId,
  styleCode: style.styleCode,
  merchandiserId: 'MERCH-001',
  merchandiserName: '跟单C',
  createdById: 'MERCH-001',
  createdBy: '跟单C',
  createdByRole: '跟单',
  preparationType: 'PURE_WOVEN',
  qualificationFact: {
    styleCode: style.styleCode,
    formalSaleStatus: 'NO_FORMAL_SALE',
    formalProductionStatus: 'NO_FORMAL_PRODUCTION',
    formalSaleSource: '专项测试销售事实',
    formalProductionSource: '专项测试生产事实',
    checkedAt: '2026-08-02 08:00:00',
  },
  bulkProductionQualification: {
    basisType: 'OTHER_CONFIRMED',
    triggerBusinessObjectType: '专项验证',
    triggerBusinessObjectId: 'TECH-PACK-REWORK-BRIDGE',
    thresholdQuantity: null,
    reachedQuantity: null,
    reachedAt: '2026-08-02 08:00:00',
    reason: '专项验证已确认做大货',
    uniqueTriggerKey: 'TECH-PACK-REWORK-BRIDGE',
  },
  creationReason: '验证技术包退回与原专业任务返工衔接',
}).masterOrderId)
const patternTaskId = `${master.masterOrderId}-PATTERN_ARTWORK`
updateEngineeringTaskRecord(master.masterOrderId, patternTaskId, (task) => {
  task.status = '已完成'
  task.startedAt = '2026-08-02 08:00'
  task.submittedAt = '2026-08-02 09:00'
  task.firstCompletedAt = '2026-08-02 10:00'
  task.effectiveCompletedAt = '2026-08-02 10:00'
  task.materialLines = [{
    materialLineId: 'PATTERN-LINE-1',
    materialSkuId: 'MAT-PATTERN-1',
    materialName: '印花面料',
    materialType: '面料',
    requirementType: '印花',
    status: '正常',
    resultFileIds: ['file://pattern-v1.ai'],
    effectImageIds: ['image://pattern-v1'],
    resultSubmittedBy: '花型团队',
    resultSubmittedAt: '2026-08-02 09:00',
    reviewStatus: '通过',
    reviewReason: '',
    reviewedBy: '买手A',
    reviewedAt: '2026-08-02 10:00',
  }]
})
const patternTaskSeed = listPatternTasks()[0]
assert.ok(patternTaskSeed)
const patternSourceTask = upsertPatternTask({
  ...patternTaskSeed,
  patternTaskId: 'PATTERN-TASK-REWORK-BRIDGE',
  patternTaskCode: 'AT-REWORK-BRIDGE',
  title: '技术包返工桥接花型任务',
  styleId: master.styleId,
  styleCode: master.styleCode,
  styleName: master.styleName,
  productStyleCode: master.styleCode,
  spuCode: master.styleCode,
  upstreamModule: '生产工程管理',
  upstreamObjectType: '工程专业任务',
  upstreamObjectId: patternTaskId,
  upstreamObjectCode: patternTaskId,
  status: '已完成',
})

const seedRecord = listTechnicalDataVersions()[0]
assert.ok(seedRecord)
const seedContent = getTechnicalDataVersionContent(seedRecord.technicalVersionId)
assert.ok(seedContent)
const technicalVersionId = 'TDV-PATTERN-REWORK-BRIDGE'
const version: TechnicalDataVersionRecord = {
  ...seedRecord,
  technicalVersionId,
  technicalVersionCode: 'TP-PATTERN-REWORK-BRIDGE',
  versionLabel: 'V1',
  versionNo: 1,
  styleId: master.styleId,
  styleCode: master.styleCode,
  styleName: master.styleName,
  sourceProjectId: master.masterOrderId,
  sourceProjectCode: master.masterOrderCode,
  sourceProjectName: master.styleName,
  createdFromTaskType: 'ENGINEERING_MASTER',
  createdFromTaskId: `${master.masterOrderId}-TECH_PACK_CONFIRMATION`,
  createdFromTaskCode: `${master.masterOrderId}-TECH_PACK_CONFIRMATION`,
  linkedArtworkTaskIds: [patternSourceTask.patternTaskId],
  versionStatus: 'DRAFT',
  reviewStage: '跟单复核',
  buyerReview: reviewNode('BUYER'),
  patternMakerReview: reviewNode('PATTERN_MAKER'),
  merchandiserReview: reviewNode('MERCHANDISER'),
  reviewUnlockedModuleKeys: [],
  returnedFromMerchandiserFlag: false,
  publishedAt: '',
  publishedBy: '',
}
resetTechnicalDataVersionRepository()
createTechnicalDataVersionDraft(version, { ...seedContent, technicalVersionId })

const versionCountBefore = listTechnicalDataVersions().length
const returned = returnTechPackReviewByModules(
  technicalVersionId,
  ['DESIGN'],
  '花型效果需要重新调整',
  '跟单C',
)
const reopenedTask = getEngineeringMasterOrderById(master.masterOrderId)?.tasks.find(
  (task) => task.taskId === patternTaskId,
)

assert.equal(reopenedTask?.status, '返工中', '花型设计模块打回必须重开原花型任务')
assert.equal(reopenedTask?.reworkRounds.length, 1, '重开原花型任务必须新增一轮返工')
assert.equal(returned.technicalVersionId, technicalVersionId, '打回后必须继续审核同一技术包版本')
assert.equal(getTechnicalDataVersionById(technicalVersionId)?.technicalVersionId, technicalVersionId)
assert.equal(listTechnicalDataVersions().length, versionCountBefore, '打回不得生成新的技术包版本')
const returnedMerchandiser = getTechnicalDataVersionById(technicalVersionId)?.merchandiserReview
assert.ok(returnedMerchandiser)
const merchandiserOperator = {
  id: returnedMerchandiser.assignedReviewerId,
  name: returnedMerchandiser.assignedReviewerName,
}
startTechPackReview(technicalVersionId, 'MERCHANDISER', {
  opinion: '开始复核返工成果',
  operator: merchandiserOperator,
})
assert.throws(
  () => approveTechPackReview(technicalVersionId, 'MERCHANDISER', '确认技术包返工完成', merchandiserOperator),
  /被退回的专业任务尚未重新完成/,
  '原专业任务返工未完成前不得绕过工程闭环通过技术包复审',
)

const colorTaskIds = [
  `${master.masterOrderId}-COLOR_YARN`,
  `${master.masterOrderId}-COLOR_FABRIC`,
]
for (const [index, taskId] of colorTaskIds.entries()) {
  updateEngineeringTaskRecord(master.masterOrderId, taskId, (task) => {
    task.status = '已完成'
    task.startedAt = '2026-08-02 08:00'
    task.submittedAt = '2026-08-02 09:00'
    task.firstCompletedAt = '2026-08-02 10:00'
    task.effectiveCompletedAt = '2026-08-02 10:00'
    task.colorResultCompletedAt = '2026-08-02 10:00'
    task.materialLines = [{
      materialLineId: `COLOR-LINE-${index + 1}`,
      materialSkuId: `MAT-COLOR-${index + 1}`,
      materialName: index === 0 ? '染色纱线' : '染色面料',
      materialType: index === 0 ? '纱线' : '面料',
      requirementType: '染色',
      status: '正常',
      resultFileIds: [`file://color-${index + 1}.pdf`],
      effectImageIds: [`image://color-${index + 1}`],
      resultSubmittedBy: '染厂',
      resultSubmittedAt: '2026-08-02 09:00',
      reviewStatus: '通过',
      reviewReason: '',
      reviewedBy: '买手A',
      reviewedAt: '2026-08-02 10:00',
    }, ...(index === 1 ? [{
      materialLineId: 'COLOR-LINE-3',
      materialSkuId: 'MAT-COLOR-3',
      materialName: '染色里布',
      materialType: '面料',
      requirementType: '染色' as const,
      status: '正常' as const,
      resultFileIds: ['file://color-3.pdf'],
      effectImageIds: ['image://color-3'],
      resultSubmittedBy: '染厂',
      resultSubmittedAt: '2026-08-02 09:00',
      reviewStatus: '通过' as const,
      reviewReason: '',
      reviewedBy: '买手A',
      reviewedAt: '2026-08-02 10:00',
    }] : [])]
  })
}

const colorVersionId = 'TDV-COLOR-REWORK-BRIDGE'
resetTechnicalDataVersionRepository()
createTechnicalDataVersionDraft({
  ...version,
  technicalVersionId: colorVersionId,
  technicalVersionCode: 'TP-COLOR-REWORK-BRIDGE',
}, { ...seedContent, technicalVersionId: colorVersionId })
const colorVersionCountBefore = listTechnicalDataVersions().length
returnTechPackReviewByModules(
  colorVersionId,
  ['COLOR_MATERIAL_MAPPING'],
  '调色成果需要重新确认',
  '跟单C',
)
const colorMaster = getEngineeringMasterOrderById(master.masterOrderId)
for (const taskId of colorTaskIds) {
  const task = colorMaster?.tasks.find((item) => item.taskId === taskId)
  assert.equal(task?.status, '返工中', '款色用料模块打回必须重开原调色任务')
  assert.equal(task?.reworkRounds.length, 1, '每张原调色任务必须新增一轮返工')
  assert.equal(task?.firstCompletedAt, '2026-08-02 10:00', '调色返工必须保留首次完成时间')
  assert.equal(task?.effectiveCompletedAt, '', '调色返工必须清空当前有效完成时间')
  assert.equal(task?.colorResultCompletedAt, '', '调色返工不得继续向生产准备时效投影旧完成时间')
  assert.ok(task?.materialLines.every((line) => line.reviewStatus === '未通过'), '整张任务打回后所有有效成果行进入逐行返工')
}

const fabricTaskId = colorTaskIds[1]
assert.throws(
  () => submitEngineeringMaterialResults({
    masterOrderId: master.masterOrderId,
    taskId: fabricTaskId,
    submittedBy: '染厂A',
    results: [{ materialLineId: 'COLOR-LINE-2', resultFileIds: ['file://color-2-v2.pdf'], effectImageIds: ['image://color-2-v2'] }],
  }),
  /不得遗漏.*COLOR-LINE-3/,
  '整张调色任务返工提交不得遗漏任何未通过行',
)
submitEngineeringMaterialResults({
  masterOrderId: master.masterOrderId,
  taskId: fabricTaskId,
  submittedBy: '染厂A',
  results: [
    { materialLineId: 'COLOR-LINE-2', resultFileIds: ['file://color-2-v2.pdf'], effectImageIds: ['image://color-2-v2'] },
    { materialLineId: 'COLOR-LINE-3', resultFileIds: ['file://color-3-v2.pdf'], effectImageIds: ['image://color-3-v2'] },
  ],
})
const mixedColorReview = reviewEngineeringMaterialResults({
  masterOrderId: master.masterOrderId,
  taskId: fabricTaskId,
  reviewerName: '买手A',
  reviewerRole: '买手',
  decisions: [
    { materialLineId: 'COLOR-LINE-2', decision: '通过', reason: '' },
    { materialLineId: 'COLOR-LINE-3', decision: '未通过', reason: '潘通色号偏差' },
  ],
})
assert.deepEqual(mixedColorReview.lockedPassedLineIds, ['COLOR-LINE-2'], '逐行审核通过的调色成果必须锁定')
assert.deepEqual(mixedColorReview.reworkLineIds, ['COLOR-LINE-3'], '逐行审核未通过的调色成果必须继续返工')
assert.equal(mixedColorReview.firstCompletedAt, '2026-08-02 10:00', '部分未通过后仍须保留首次完成时间')
assert.equal(mixedColorReview.effectiveCompletedAt, '', '部分未通过后不得保留当前有效完成时间')
assert.equal(
  getEngineeringMasterOrderById(master.masterOrderId)?.tasks.find((task) => task.taskId === fabricTaskId)?.colorResultCompletedAt,
  '',
  '部分未通过后不得向生产准备时效投影旧调色完成时间',
)
submitEngineeringMaterialResults({
  masterOrderId: master.masterOrderId,
  taskId: fabricTaskId,
  submittedBy: '染厂A',
  results: [
    { materialLineId: 'COLOR-LINE-3', resultFileIds: ['file://color-3-v3.pdf'], effectImageIds: ['image://color-3-v3'] },
  ],
})
const finalColorReview = reviewEngineeringMaterialResults({
  masterOrderId: master.masterOrderId,
  taskId: fabricTaskId,
  reviewerName: '买手A',
  reviewerRole: '买手',
  decisions: [{ materialLineId: 'COLOR-LINE-3', decision: '通过', reason: '' }],
})
const completedFabricTask = getEngineeringMasterOrderById(master.masterOrderId)?.tasks.find(
  (task) => task.taskId === fabricTaskId,
)
assert.equal(finalColorReview.taskStatus, '已完成', '失败行再次通过后调色任务必须完成')
assert.equal(finalColorReview.firstCompletedAt, '2026-08-02 10:00', '再次通过不得覆盖首次完成时间')
assert.ok(finalColorReview.effectiveCompletedAt, '再次通过必须写入新的有效完成时间')
assert.equal(completedFabricTask?.colorResultCompletedAt, finalColorReview.effectiveCompletedAt, '调色完成时间必须与新的有效完成时间一致')
assert.equal(getTechnicalDataVersionById(colorVersionId)?.technicalVersionId, colorVersionId, '调色返工继续使用原技术包版本')
assert.equal(listTechnicalDataVersions().length, colorVersionCountBefore, '调色返工不得创建新技术包版本')
const colorReturnedMerchandiser = getTechnicalDataVersionById(colorVersionId)?.merchandiserReview
assert.ok(colorReturnedMerchandiser)
const colorMerchandiserOperator = {
  id: colorReturnedMerchandiser.assignedReviewerId,
  name: colorReturnedMerchandiser.assignedReviewerName,
}
startTechPackReview(colorVersionId, 'MERCHANDISER', {
  opinion: '开始复核调色返工成果',
  operator: colorMerchandiserOperator,
})
assert.throws(
  () => approveTechPackReview(colorVersionId, 'MERCHANDISER', '确认调色返工完成', colorMerchandiserOperator),
  /被退回的专业任务尚未重新完成/,
  '两张有效调色任务仅一张重新完成时，另一张返工中必须阻断技术包复审',
)

updateEngineeringTaskRecord(master.masterOrderId, colorTaskIds[0], (task) => {
  task.status = '已完成'
  task.materialLines.forEach((line) => { line.status = '因需求变更结束' })
})
updateEngineeringTaskRecord(master.masterOrderId, colorTaskIds[1], (task) => {
  task.status = '已完成'
  task.materialLines.forEach((line) => { line.status = '正常'; line.reviewStatus = '通过' })
})
const staleColorVersionId = 'TDV-COLOR-STALE-TASK'
resetTechnicalDataVersionRepository()
createTechnicalDataVersionDraft({
  ...version,
  technicalVersionId: staleColorVersionId,
  technicalVersionCode: 'TP-COLOR-STALE-TASK',
}, { ...seedContent, technicalVersionId: staleColorVersionId })
returnTechPackReviewByModules(
  staleColorVersionId,
  ['COLOR_MATERIAL_MAPPING'],
  '仅有效染色物料需要返工',
  '跟单C',
)
const staleColorMaster = getEngineeringMasterOrderById(master.masterOrderId)
assert.equal(
  staleColorMaster?.tasks.find((task) => task.taskId === colorTaskIds[0])?.status,
  '已完成',
  '没有有效染色物料行的历史调色任务必须跳过',
)
assert.equal(
  staleColorMaster?.tasks.find((task) => task.taskId === colorTaskIds[1])?.status,
  '返工中',
  '历史无效任务不得阻断仍有效的调色任务返工',
)

updateEngineeringTaskRecord(master.masterOrderId, patternTaskId, (task) => {
  task.status = '已完成'
})
const concreteReturnVersionId = 'TDV-CONCRETE-DESIGN-RETURN'
resetTechnicalDataVersionRepository()
createTechnicalDataVersionDraft({
  ...version,
  technicalVersionId: concreteReturnVersionId,
  technicalVersionCode: 'TP-CONCRETE-DESIGN-RETURN',
}, { ...seedContent, technicalVersionId: concreteReturnVersionId })
const directDesignTarget = listTechPackReviewReturnTargets(concreteReturnVersionId).find((target) => target.targetType === 'DESIGN_ITEM')
assert.ok(directDesignTarget, '技术包退回必须能选择具体花型资料，而不是只能选择整个设计栏目')
const concreteReturned = returnTechPackReviewByTargets(concreteReturnVersionId, [directDesignTarget.targetId], '只退回这条花型资料', '跟单C')
assert.deepEqual(concreteReturned.reviewReturnTargets?.map((target) => target.targetId), [directDesignTarget.targetId])
assert.equal(
  getEngineeringMasterOrderById(master.masterOrderId)?.tasks.find((task) => task.taskId === patternTaskId)?.status,
  '已完成',
  '退回普通技术资料不得误重开专业任务',
)

updateEngineeringTaskRecord(master.masterOrderId, patternTaskId, (task) => {
  task.status = '已完成'
})
const notificationFailureVersionId = 'TDV-NOTIFICATION-TRANSACTION-ROLLBACK'
resetTechnicalDataVersionRepository()
createTechnicalDataVersionDraft({
  ...version,
  technicalVersionId: notificationFailureVersionId,
  technicalVersionCode: 'TP-NOTIFICATION-TRANSACTION-ROLLBACK',
}, { ...seedContent, technicalVersionId: notificationFailureVersionId })
const engineeringTaskBeforeNotificationFailure = getEngineeringMasterOrderById(master.masterOrderId)?.tasks.find(
  (task) => task.taskId === patternTaskId,
)
const technicalVersionBeforeNotificationFailure = getTechnicalDataVersionById(notificationFailureVersionId)
const versionLogsBeforeNotificationFailure = listTechPackVersionLogs()
const notificationsBeforeNotificationFailure = listTechPackReviewNotifications()
const originalLocalStorageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
const storageValues = new Map<string, string>()
let failNextNotificationWrite = true
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    get length() { return storageValues.size },
    clear() { storageValues.clear() },
    getItem(key: string) { return storageValues.get(key) ?? null },
    key(index: number) { return [...storageValues.keys()][index] ?? null },
    removeItem(key: string) { storageValues.delete(key) },
    setItem(key: string, value: string) {
      if (key === 'higood-pcs-tech-pack-review-notification-store-v1' && failNextNotificationWrite) {
        failNextNotificationWrite = false
        throw new Error('模拟审核通知仓储写入失败')
      }
      storageValues.set(key, value)
    },
  } satisfies Storage,
})
try {
  assert.throws(
    () => returnTechPackReviewByModules(
      notificationFailureVersionId,
      ['DESIGN'],
      '通知失败时必须整体回滚',
      '跟单C',
    ),
    /模拟审核通知仓储写入失败/,
    '原子打回链路的通知仓储写失败必须向上抛出',
  )
  assert.deepEqual(
    getEngineeringMasterOrderById(master.masterOrderId)?.tasks.find((task) => task.taskId === patternTaskId),
    engineeringTaskBeforeNotificationFailure,
    '通知仓储失败必须回滚原工程任务',
  )
  assert.deepEqual(
    getTechnicalDataVersionById(notificationFailureVersionId),
    technicalVersionBeforeNotificationFailure,
    '通知仓储失败必须回滚技术版本状态',
  )
  assert.deepEqual(listTechPackVersionLogs(), versionLogsBeforeNotificationFailure, '通知仓储失败必须回滚版本日志')
  assert.deepEqual(listTechPackReviewNotifications(), notificationsBeforeNotificationFailure, '通知仓储失败必须回滚审核通知')
} finally {
  if (originalLocalStorageDescriptor) {
    Object.defineProperty(globalThis, 'localStorage', originalLocalStorageDescriptor)
  } else {
    delete (globalThis as { localStorage?: Storage }).localStorage
  }
}

updateEngineeringTaskRecord(master.masterOrderId, patternTaskId, (task) => {
  task.status = '已完成'
})
const engineeringStorageFailureVersionId = 'TDV-ENGINEERING-STORAGE-TRANSACTION-ROLLBACK'
resetTechnicalDataVersionRepository()
createTechnicalDataVersionDraft({
  ...version,
  technicalVersionId: engineeringStorageFailureVersionId,
  technicalVersionCode: 'TP-ENGINEERING-STORAGE-TRANSACTION-ROLLBACK',
}, { ...seedContent, technicalVersionId: engineeringStorageFailureVersionId })
const engineeringSnapshotBeforeStorageFailure = getEngineeringMasterOrderStoreSnapshot()
const technicalVersionBeforeEngineeringStorageFailure = getTechnicalDataVersionById(engineeringStorageFailureVersionId)
const versionLogsBeforeEngineeringStorageFailure = listTechPackVersionLogs()
const notificationsBeforeEngineeringStorageFailure = listTechPackReviewNotifications()
const engineeringStorageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
const engineeringStorageValues = new Map<string, string>()
let failEngineeringStorageWrites = false
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    get length() { return engineeringStorageValues.size },
    clear() { engineeringStorageValues.clear() },
    getItem(key: string) { return engineeringStorageValues.get(key) ?? null },
    key(index: number) { return [...engineeringStorageValues.keys()][index] ?? null },
    removeItem(key: string) { engineeringStorageValues.delete(key) },
    setItem(key: string, value: string) {
      if (key === 'higood-pcs-engineering-master-store-v1' && failEngineeringStorageWrites) {
        throw new Error('模拟工程主单仓储持续写入失败')
      }
      engineeringStorageValues.set(key, value)
    },
  } satisfies Storage,
})
try {
  localStorage.setItem('higood-pcs-engineering-master-store-v1', JSON.stringify(engineeringSnapshotBeforeStorageFailure))
  getEngineeringMasterOrderStoreSnapshot()
  failEngineeringStorageWrites = true
  assert.throws(
    () => returnTechPackReviewByModules(
      engineeringStorageFailureVersionId,
      ['DESIGN'],
      '工程仓储失败时必须整体回滚',
      '跟单C',
    ),
    /模拟工程主单仓储持续写入失败/,
    '工程仓储事务写失败必须向内层技术版本事务传播',
  )
  assert.deepEqual(
    getEngineeringMasterOrderStoreSnapshot(),
    engineeringSnapshotBeforeStorageFailure,
    '工程仓储持续失败时必须直接恢复工程内存快照',
  )
  assert.deepEqual(
    getTechnicalDataVersionById(engineeringStorageFailureVersionId),
    technicalVersionBeforeEngineeringStorageFailure,
    '工程仓储失败必须回滚技术版本状态',
  )
  assert.deepEqual(listTechPackVersionLogs(), versionLogsBeforeEngineeringStorageFailure, '工程仓储失败不得提交版本日志')
  assert.deepEqual(
    listTechPackReviewNotifications(),
    notificationsBeforeEngineeringStorageFailure,
    '工程仓储失败不得提交审核通知',
  )
} finally {
  if (engineeringStorageDescriptor) {
    Object.defineProperty(globalThis, 'localStorage', engineeringStorageDescriptor)
  } else {
    delete (globalThis as { localStorage?: Storage }).localStorage
  }
}

const wrongSourceVersionId = 'TDV-WRONG-SOURCE'
resetTechnicalDataVersionRepository()
assert.throws(
  () => createTechnicalDataVersionDraft({
    ...version,
    technicalVersionId: wrongSourceVersionId,
    technicalVersionCode: 'TP-WRONG-SOURCE',
    sourceProjectId: 'EMO-NOT-EXISTS',
  }, { ...seedContent, technicalVersionId: wrongSourceVersionId }),
  /工程主单不存在/,
  '即使款式相同也不得绕过 sourceProjectId 猜测其他工程主单建立技术包',
)

console.log('pcs-tech-pack-engineering-task-rework-bridge.spec.ts PASS')
