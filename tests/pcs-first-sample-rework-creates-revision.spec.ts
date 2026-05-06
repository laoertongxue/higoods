import assert from 'node:assert/strict'

class MockField {
  dataset: Record<string, string>
  value: string
  type: string
  checked: boolean
  files: unknown[]

  constructor(field: string, value = '', type = 'text') {
    this.dataset = { pcsEngineeringField: field }
    this.value = value
    this.type = type
    this.checked = false
    this.files = []
  }

  closest() {
    return this
  }
}

Object.defineProperty(globalThis, 'HTMLInputElement', { configurable: true, value: MockField })
Object.defineProperty(globalThis, 'HTMLTextAreaElement', { configurable: true, value: MockField })
Object.defineProperty(globalThis, 'HTMLSelectElement', { configurable: true, value: MockField })

const { appStore } = await import('../src/state/store.ts')
const {
  handlePcsEngineeringTaskEvent,
  handlePcsEngineeringTaskInput,
  renderPcsFirstSampleTaskDetailPage,
  renderPcsFirstSampleTaskPage,
  resetPcsEngineeringTaskRepositories,
  resetPcsEngineeringTaskState,
} = await import('../src/pages/pcs-engineering-tasks.ts')
const {
  getFirstSampleTaskById,
  listFirstSampleTasks,
} = await import('../src/data/pcs-first-sample-repository.ts')
const { updateFirstSampleTaskDetailAndSync } = await import('../src/data/pcs-first-sample-project-writeback.ts')
const { listRevisionTasks } = await import('../src/data/pcs-revision-task-repository.ts')
const {
  getProjectNodeRecordByWorkItemTypeCode,
  resetProjectRepository,
} = await import('../src/data/pcs-project-repository.ts')
const { resetProjectRelationRepository } = await import('../src/data/pcs-project-relation-repository.ts')
const { resetStyleArchiveRepository } = await import('../src/data/pcs-style-archive-repository.ts')

function makeActionTarget(action: string, extraDataset: Record<string, string> = {}): HTMLElement {
  return {
    dataset: {
      pcsEngineeringAction: action,
      ...extraDataset,
    },
    closest() {
      return this
    },
  } as unknown as HTMLElement
}

function input(field: string, value: string): void {
  assert.equal(handlePcsEngineeringTaskInput(new MockField(field, value) as unknown as Element), true)
}

resetProjectRepository()
resetProjectRelationRepository()
resetStyleArchiveRepository()
resetPcsEngineeringTaskRepositories()
resetPcsEngineeringTaskState()

const task = listFirstSampleTasks().find((item) => item.firstSampleTaskCode === 'FS-20260425-002')
assert.ok(task, '缺少可用于首版需改版验收的首版样衣任务')
const prepared = updateFirstSampleTaskDetailAndSync(task.firstSampleTaskId, {
  status: '待确认',
  sampleCode: 'FS-RESULT-REWORK-001',
  sampleImageIds: ['mock://sample-result/rework-001'],
  samplePurpose: '首版确认',
  reuseAsFirstOrderBasisFlag: true,
  reuseAsFirstOrderBasisConfirmedAt: '2026-04-25 09:00',
  reuseAsFirstOrderBasisConfirmedBy: '历史确认人',
  reuseAsFirstOrderBasisNote: '历史复用说明',
}, '测试用户')
assert.equal(prepared.ok, true)

handlePcsEngineeringTaskEvent(makeActionTarget('first-sample-advance', { taskId: task.firstSampleTaskId }))
input('first-sample-acceptance-result', '需改版')
input('first-sample-acceptance-confirmed-by', '张娜')
input('first-sample-acceptance-confirmed-at', '2026-04-25 15:20')
input('first-sample-acceptance-note', '肩宽偏窄，腰节位置需要改版。')
input('first-sample-acceptance-artwork-summary', '花型位置偏右，需要同步调整。')
handlePcsEngineeringTaskEvent(makeActionTarget('submit-first-sample-acceptance'))

const updated = getFirstSampleTaskById(task.firstSampleTaskId)
assert.equal(updated?.status, '需改版')
assert.equal(updated?.artworkConfirmationSummary, '花型位置偏右，需要同步调整。')
assert.equal(updated?.reuseAsFirstOrderBasisFlag, false)
assert.equal(updated?.reuseAsFirstOrderBasisConfirmedAt, '')
assert.equal(updated?.reuseAsFirstOrderBasisConfirmedBy, '')
assert.equal(updated?.reuseAsFirstOrderBasisNote, '')
assert.match(updated?.productionReadinessNote || '', /需改版/)

assert.equal(
  listRevisionTasks().some((item) => item.upstreamObjectId === task.firstSampleTaskId),
  false,
  '提交需改版结论后不应自动创建改版任务',
)

const detailBeforeCreate = renderPcsFirstSampleTaskDetailPage(task.firstSampleTaskId)
assert.match(detailBeforeCreate, /改版处理/)
assert.match(detailBeforeCreate, /未创建改版任务/)
assert.match(detailBeforeCreate, /去创建改版任务/)

const passedTask = listFirstSampleTasks().find((item) => item.status === '已通过')
assert.ok(passedTask, '缺少已通过首版样衣任务用于校验改版卡片隐藏')
handlePcsEngineeringTaskEvent(makeActionTarget('close-notice'))
assert.doesNotMatch(renderPcsFirstSampleTaskDetailPage(passedTask.firstSampleTaskId), /改版处理/)

handlePcsEngineeringTaskEvent(makeActionTarget('create-revision-from-first-sample', { taskId: task.firstSampleTaskId }))
const detailWithDialog = renderPcsFirstSampleTaskDetailPage(task.firstSampleTaskId)
assert.match(detailWithDialog, /新建改版任务/)
assert.match(detailWithDialog, /首版样衣打样/)
assert.match(detailWithDialog, /肩宽偏窄/)
assert.match(detailWithDialog, /花型位置偏右/)

handlePcsEngineeringTaskEvent(makeActionTarget('submit-revision-create'))

const revision = listRevisionTasks().find((item) => item.upstreamObjectId === task.firstSampleTaskId)
assert.ok(revision, '点击改版处理入口后应创建关联改版任务')
assert.equal(revision?.upstreamModule, '首版样衣打样')
assert.equal(revision?.upstreamObjectCode, task.firstSampleTaskCode)
assert.match(revision?.issueSummary || '', /肩宽偏窄/)
assert.match(revision?.issueSummary || '', /花型位置偏右/)
assert.ok(revision?.revisionScopeNames.includes('版型结构'), '改版任务应包含版型范围')
assert.ok(revision?.revisionScopeNames.includes('花型'), '填写花型确认说明后应包含花型范围')

const detailAfterCreate = renderPcsFirstSampleTaskDetailPage(task.firstSampleTaskId)
assert.match(detailAfterCreate, new RegExp(revision.revisionTaskCode))
assert.match(detailAfterCreate, /target="_blank"/)
assert.match(renderPcsFirstSampleTaskPage(), new RegExp(revision.revisionTaskCode))

const node = getProjectNodeRecordByWorkItemTypeCode(task.projectId, 'FIRST_SAMPLE')
assert.equal(node?.pendingActionType, '跟进改版任务')

handlePcsEngineeringTaskEvent(makeActionTarget('first-sample-advance', { taskId: task.firstSampleTaskId }))
assert.match(appStore.getState().pathname, /\/pcs\/patterns\/revision\//)
