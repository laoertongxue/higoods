import assert from 'node:assert/strict'

import {
  createEngineeringMasterOrder,
  createEngineeringChangeTask,
  publishEngineeringMasterOrder,
  resetEngineeringChangeRepository,
  resetEngineeringMasterRepository,
  setEngineeringMasterStatus,
} from '../src/data/pcs-engineering-master-repository.ts'
import {
  getRevisionTaskById,
  listRevisionTasks,
  resetRevisionTaskRepository,
} from '../src/data/pcs-revision-task-repository.ts'
import {
  listStyleArchives,
  resetStyleArchiveRepository,
} from '../src/data/pcs-style-archive-repository.ts'
import {
  createTechnicalDataVersionDraft,
  getTechnicalDataVersionById,
  listTechnicalDataVersions,
  resetTechnicalDataVersionRepository,
  updateTechnicalDataVersionRecord,
} from '../src/data/pcs-technical-data-version-repository.ts'
import type {
  TechPackSourceTaskType,
  TechnicalDataVersionRecord,
} from '../src/data/pcs-technical-data-version-types.ts'

resetStyleArchiveRepository()
resetEngineeringMasterRepository()
resetEngineeringChangeRepository()
resetRevisionTaskRepository()
resetTechnicalDataVersionRepository()

const acceptedSourceTypes: TechPackSourceTaskType[] = ['ENGINEERING_MASTER', 'ENGINEERING_CHANGE']
assert.deepEqual(acceptedSourceTypes, ['ENGINEERING_MASTER', 'ENGINEERING_CHANGE'])

const legacyPublished = listTechnicalDataVersions().find((record) =>
  record.versionStatus === 'PUBLISHED' && ['MANUAL', 'REVISION', 'PLATE', 'ARTWORK'].includes(record.createdFromTaskType),
)
assert.ok(legacyPublished, '测试数据必须包含已发布旧来源技术包')
assert.equal(getTechnicalDataVersionById(legacyPublished.technicalVersionId)?.technicalVersionId, legacyPublished.technicalVersionId)

const baseRecord = listTechnicalDataVersions()[0]
assert.ok(baseRecord)

function nextRecord(
  suffix: string,
  patch: Partial<TechnicalDataVersionRecord>,
): TechnicalDataVersionRecord {
  return {
    ...baseRecord,
    technicalVersionId: `TDV-ENGINEERING-SOURCE-${suffix}`,
    technicalVersionCode: `TP-ENGINEERING-SOURCE-${suffix}`,
    versionStatus: 'DRAFT',
    publishedAt: '',
    publishedBy: '',
    ...patch,
  }
}

const masterStyle = listStyleArchives()[0]
assert.ok(masterStyle)
const master = publishEngineeringMasterOrder(createEngineeringMasterOrder({
  styleId: masterStyle.styleId,
  styleCode: masterStyle.styleCode,
  merchandiserName: '跟单A',
}).masterOrderId)
const masterTask = master.tasks.find((task) => task.taskType === 'TECH_PACK_CONFIRMATION')
assert.ok(masterTask)

const masterVersion = createTechnicalDataVersionDraft(nextRecord('MASTER', {
  styleId: master.styleId,
  styleCode: master.styleCode,
  styleName: master.styleName,
  sourceProjectId: master.masterOrderId,
  sourceProjectCode: master.masterOrderCode,
  sourceProjectName: master.styleName,
  createdFromTaskType: 'ENGINEERING_MASTER',
  createdFromTaskId: masterTask.taskId,
  createdFromTaskCode: masterTask.taskId,
}))
assert.equal(masterVersion.createdFromTaskType, 'ENGINEERING_MASTER')

const nonConfirmationTask = master.tasks.find((task) => task.taskType !== 'TECH_PACK_CONFIRMATION')
assert.ok(nonConfirmationTask)
assert.throws(
  () => createTechnicalDataVersionDraft(nextRecord('MASTER-WRONG-TASK-TYPE', {
    styleId: master.styleId,
    styleCode: master.styleCode,
    sourceProjectId: master.masterOrderId,
    createdFromTaskType: 'ENGINEERING_MASTER',
    createdFromTaskId: nonConfirmationTask.taskId,
    createdFromTaskCode: nonConfirmationTask.taskId,
  })),
  /技术包确认任务/,
)

const changeTask = listRevisionTasks().find((task) => Boolean(task.styleId))
assert.ok(changeTask)
assert.ok(getRevisionTaskById(changeTask.revisionTaskId))
setEngineeringMasterStatus(master.masterOrderId, '已关闭')
const engineeringChange = createEngineeringChangeTask({
  sourceMasterOrderId: master.masterOrderId,
  createdBy: '跟单A',
})
const changeVersion = createTechnicalDataVersionDraft(nextRecord('CHANGE', {
  styleId: engineeringChange.styleId,
  styleCode: engineeringChange.styleCode,
  styleName: engineeringChange.styleName,
  sourceProjectId: engineeringChange.engineeringChangeTaskId,
  sourceProjectCode: engineeringChange.engineeringChangeTaskCode,
  sourceProjectName: engineeringChange.title,
  createdFromTaskType: 'ENGINEERING_CHANGE',
  createdFromTaskId: engineeringChange.engineeringChangeTaskId,
  createdFromTaskCode: engineeringChange.engineeringChangeTaskCode,
}))
assert.equal(changeVersion.createdFromTaskType, 'ENGINEERING_CHANGE')

assert.throws(
  () => createTechnicalDataVersionDraft(nextRecord('PLAIN-REVISION-CANNOT-CHANGE', {
    styleId: changeTask.styleId,
    styleCode: changeTask.styleCode,
    sourceProjectId: changeTask.revisionTaskId,
    createdFromTaskType: 'ENGINEERING_CHANGE',
    createdFromTaskId: changeTask.revisionTaskId,
  })),
  /工程变更任务不存在/,
)

for (const sourceType of ['MANUAL', 'REVISION', 'PLATE', 'ARTWORK'] as const) {
  assert.throws(
    () => createTechnicalDataVersionDraft(nextRecord(`LEGACY-${sourceType}`, {
      createdFromTaskType: sourceType as TechnicalDataVersionRecord['createdFromTaskType'],
      sourceProjectId: master.masterOrderId,
      createdFromTaskId: masterTask.taskId,
    })),
    /技术包新版本只能由工程主单或工程变更任务生成/,
  )
}

assert.throws(
  () => createTechnicalDataVersionDraft(nextRecord('MISSING-IDS', {
    createdFromTaskType: 'ENGINEERING_MASTER',
    sourceProjectId: '',
    createdFromTaskId: '',
  })),
  /必须同时记录来源对象和来源任务/,
)
assert.throws(
  () => createTechnicalDataVersionDraft(nextRecord('UNKNOWN-MASTER', {
    createdFromTaskType: 'ENGINEERING_MASTER',
    sourceProjectId: 'EM-NOT-FOUND',
    createdFromTaskId: 'EM-NOT-FOUND-TECH_PACK_CONFIRMATION',
  })),
  /工程主单不存在/,
)
assert.throws(
  () => createTechnicalDataVersionDraft(nextRecord('MASTER-STYLE-MISMATCH', {
    createdFromTaskType: 'ENGINEERING_MASTER',
    styleId: changeTask.styleId,
    styleCode: changeTask.styleCode,
    sourceProjectId: master.masterOrderId,
    createdFromTaskId: masterTask.taskId,
  })),
  /技术包款式与工程主单款式不一致/,
)
assert.throws(
  () => createTechnicalDataVersionDraft(nextRecord('UNKNOWN-CHANGE', {
    createdFromTaskType: 'ENGINEERING_CHANGE',
    sourceProjectId: 'REVISION-NOT-FOUND',
    createdFromTaskId: 'REVISION-NOT-FOUND',
  })),
  /工程变更任务不存在/,
)
assert.throws(
  () => createTechnicalDataVersionDraft(nextRecord('CHANGE-PROJECT-MISMATCH', {
    createdFromTaskType: 'ENGINEERING_CHANGE',
    styleId: engineeringChange.styleId,
    styleCode: engineeringChange.styleCode,
    sourceProjectId: engineeringChange.engineeringChangeTaskId,
    createdFromTaskId: masterTask.taskId,
  })),
  /技术包来源对象与工程变更任务不一致/,
)

const beforeIdentityPatch = getTechnicalDataVersionById(masterVersion.technicalVersionId)
assert.ok(beforeIdentityPatch)
assert.throws(
  () => updateTechnicalDataVersionRecord(masterVersion.technicalVersionId, {
    sourceProjectId: engineeringChange.engineeringChangeTaskId,
  }),
  /来源身份.*禁止修改/,
)
assert.deepEqual(
  getTechnicalDataVersionById(masterVersion.technicalVersionId),
  beforeIdentityPatch,
  '来源身份修改失败不得产生部分写入',
)

console.log('pcs-engineering-tech-pack-linkage.spec.ts PASS')
