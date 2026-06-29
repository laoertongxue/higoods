import assert from 'node:assert/strict'
import {
  createFirstSampleTaskFromPlate,
  evaluatePlateFirstSampleReadiness,
} from '../src/data/pcs-task-project-relation-writeback.ts'
import {
  listFirstSampleTasks,
  replaceFirstSampleTaskStore,
} from '../src/data/pcs-first-sample-repository.ts'
import {
  listPatternTasks,
  replacePatternTaskStore,
} from '../src/data/pcs-pattern-task-repository.ts'
import {
  getPlateMakingTaskById,
  listPlateMakingTasks,
  replacePlateMakingTaskStore,
} from '../src/data/pcs-plate-making-repository.ts'

const originalPlateTasks = listPlateMakingTasks()
const originalPatternTasks = listPatternTasks()
const originalFirstSampleTasks = listFirstSampleTasks()

try {
  const generatedOnly = evaluatePlateFirstSampleReadiness('PT-20260414-GENERATED')
  assert.equal(generatedOnly.canCreateFirstSample, false)
  assert.ok(generatedOnly.blockingReasons.includes('制版任务未完成'))

  const plateWithExistingSample = getPlateMakingTaskById('PT-20260407-018')
  assert.ok(plateWithExistingSample, '重复创建样例制版任务应存在')
  replaceFirstSampleTaskStore([
    ...originalFirstSampleTasks,
    {
      firstSampleTaskId: 'FS-PT-018-DUP',
      firstSampleTaskCode: 'FS-PT-018-DUP',
      title: '首版样衣打样-已建任务未补齐',
      projectId: plateWithExistingSample.projectId,
      projectCode: plateWithExistingSample.projectCode,
      projectName: plateWithExistingSample.projectName,
      projectNodeId: plateWithExistingSample.projectNodeId,
      workItemTypeCode: 'FIRST_SAMPLE',
      workItemTypeName: '首版样衣打样',
      sourceType: '制版任务',
      upstreamModule: '制版任务',
      upstreamObjectType: '制版任务',
      upstreamObjectId: plateWithExistingSample.plateTaskId,
      upstreamObjectCode: plateWithExistingSample.plateTaskCode,
      factoryId: 'factory-shenzhen-01',
      factoryName: '深圳工厂01',
      targetSite: '深圳',
      sampleCode: '',
      sourceTechPackVersionId: plateWithExistingSample.linkedTechPackVersionId,
      sourceTechPackVersionCode: plateWithExistingSample.linkedTechPackVersionCode,
      sourceTechPackVersionLabel: plateWithExistingSample.linkedTechPackVersionLabel,
      sourceTaskType: '制版任务',
      sourceTaskId: plateWithExistingSample.plateTaskId,
      sourceTaskCode: plateWithExistingSample.plateTaskCode,
      sampleMaterialMode: '正确布',
      samplePurpose: '首版确认',
      sampleImageIds: [],
      reuseAsFirstOrderBasisFlag: false,
      reuseAsFirstOrderBasisConfirmedAt: '',
      reuseAsFirstOrderBasisConfirmedBy: '',
      reuseAsFirstOrderBasisNote: '',
      fitConfirmationSummary: '',
      artworkConfirmationSummary: '',
      productionReadinessNote: '',
      confirmedAt: '',
      status: '打样中',
      ownerId: plateWithExistingSample.ownerId,
      ownerName: plateWithExistingSample.ownerName,
      priorityLevel: plateWithExistingSample.priorityLevel,
      createdAt: '2026-04-25 09:35:00',
      createdBy: '验收脚本',
      updatedAt: '2026-04-25 09:40:00',
      updatedBy: '验收脚本',
      note: '',
      legacyProjectRef: plateWithExistingSample.projectCode,
      legacyUpstreamRef: plateWithExistingSample.plateTaskCode,
    },
  ])
  const existingSample = evaluatePlateFirstSampleReadiness('PT-20260407-018')
  assert.equal(existingSample.canCreateFirstSample, false)
  assert.deepEqual(existingSample.existingFirstSampleTaskCodes, ['FS-PT-018-DUP'])
  assert.ok(existingSample.blockingReasons.includes('已存在首版样衣打样任务'))
  replaceFirstSampleTaskStore(originalFirstSampleTasks)

  replacePatternTaskStore(originalPatternTasks.map((task) => task.patternTaskCode === 'AT-20260109-001'
    ? { ...task, status: '进行中', buyerReviewStatus: '待买手确认', buyerReviewAt: '' }
    : task))
  const blockedByPattern = evaluatePlateFirstSampleReadiness('PT-20260407-018')
  assert.equal(blockedByPattern.canCreateFirstSample, false)
  assert.ok(blockedByPattern.blockingReasons.includes('关联花型任务未完成'))
  assert.deepEqual(blockedByPattern.blockingPatternTaskCodes, ['AT-20260109-001'])

  replacePatternTaskStore(originalPatternTasks)
  replaceFirstSampleTaskStore(originalFirstSampleTasks.filter((task) =>
    task.upstreamObjectId !== 'PT-20260407-018' &&
    task.upstreamObjectCode !== 'PT-20260407-018'
  ))
  const createdResult = createFirstSampleTaskFromPlate('PT-20260407-018', '验收脚本')
  assert.equal(createdResult.ok, true)
  assert.ok(createdResult.task, createdResult.message)
  assert.equal(createdResult.task?.sourceType, '制版任务')
  assert.equal(createdResult.task?.upstreamObjectId, 'PT-20260407-018')
  assert.equal(createdResult.task?.sourceTechPackVersionId, 'tdv_seed_project_018_base')

  const createdTask = listFirstSampleTasks().find((task) => task.upstreamObjectId === 'PT-20260407-018')
  assert.ok(createdTask, '制版完成后应创建首版样衣打样任务')

  const plate = getPlateMakingTaskById('PT-20260407-018')
  assert.ok(plate?.note.includes('已开放首版样衣打样'), '制版任务可见投影应记录样衣入口开放结果')

  console.log('check-pcs-plate-sample-readiness PASS')
} finally {
  replacePlateMakingTaskStore(originalPlateTasks)
  replacePatternTaskStore(originalPatternTasks)
  replaceFirstSampleTaskStore(originalFirstSampleTasks)
}
