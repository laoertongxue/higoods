import assert from 'node:assert/strict'

class MemoryStorage {
  private readonly values = new Map<string, string>()

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }

  removeItem(key: string): void {
    this.values.delete(key)
  }
}

const storage = new MemoryStorage()
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: storage,
})

const projectRepository = await import('../src/data/pcs-project-repository.ts')
const { createTaskBootstrapSnapshot } = await import('../src/data/pcs-task-bootstrap.ts')
const taskSnapshot = createTaskBootstrapSnapshot()
const project = projectRepository.listProjects()[0]!
const projectNodesBefore = projectRepository.listProjectNodes(project.projectId)

const taskCases = [
  {
    key: 'higood-pcs-revision-task-store-v2',
    version: 2,
    task: { ...taskSnapshot.revisionTasks[0]!, projectId: project.projectId, projectNodeId: 'removed-revision-node' },
    module: '改版任务',
    code: 'REVISION_TASK',
  },
  {
    key: 'higood-pcs-plate-making-store-v2',
    version: 2,
    task: { ...taskSnapshot.plateTasks[0]!, projectId: project.projectId, projectNodeId: 'removed-plate-node' },
    module: '制版任务',
    code: 'PATTERN_TASK',
  },
  {
    key: 'higood-pcs-pattern-task-store-v1',
    version: 1,
    task: { ...taskSnapshot.patternTasks[0]!, projectId: project.projectId, projectNodeId: 'removed-pattern-node' },
    module: '花型任务',
    code: 'PATTERN_ARTWORK_TASK',
  },
  {
    key: 'higood-pcs-first-sample-store-v2',
    version: 2,
    task: { ...taskSnapshot.firstSampleTasks[0]!, projectId: project.projectId, projectNodeId: 'removed-first-sample-node' },
    module: '首版样衣打样',
    code: 'FIRST_SAMPLE',
  },
  {
    key: 'higood-pcs-first-order-sample-store-v2',
    version: 2,
    task: { ...taskSnapshot.firstOrderSampleTasks[0]!, projectId: project.projectId, projectNodeId: 'removed-first-order-node' },
    module: '首单样衣打样',
    code: 'FIRST_ORDER_SAMPLE',
  },
] as const

taskCases.forEach(({ key, version, task }) => {
  storage.setItem(key, JSON.stringify({ version, tasks: [task], pendingItems: [] }))
})

const relationTemplate = {
  projectId: project.projectId,
  projectCode: project.projectCode,
  relationRole: '执行记录',
  sourceLineId: null,
  sourceLineCode: null,
  sourceStatus: '历史记录',
  businessDate: '2026-01-01 10:00',
  ownerName: '历史用户',
  createdAt: '2026-01-01 10:00',
  createdBy: '历史用户',
  updatedAt: '2026-01-01 10:00',
  updatedBy: '历史用户',
  note: '历史专业任务节点关系',
  legacyRefType: 'historical.professionalTask',
  legacyRefValue: '',
}
const legacyRelations = taskCases.map(({ task, module, code }, index) => ({
  ...relationTemplate,
  projectRelationId: `legacy_professional_relation_${index + 1}`,
  projectNodeId: task.projectNodeId,
  stepCode: code,
  stepName: module,
  sourceModule: module,
  sourceObjectType: module === '首版样衣打样' || module === '首单样衣打样' ? `${module}任务` : module,
  sourceObjectId: `legacy_professional_task_${index + 1}`,
  sourceObjectCode: `LEGACY-${index + 1}`,
  sourceTitle: `历史${module}`,
}))
const projectInitNode = projectNodesBefore.find((node) => node.stepCode === 'PROJECT_INIT')!
const legalFixedRelation = {
  ...legacyRelations[0]!,
  projectRelationId: 'legal_fixed_step_relation',
  projectNodeId: projectInitNode.projectNodeId,
  stepCode: projectInitNode.stepCode,
  stepName: projectInitNode.stepName,
  sourceObjectId: 'legal_fixed_step_source',
  sourceObjectCode: 'LEGAL-FIXED-001',
  sourceTitle: '合法固定步骤来源关系',
}
storage.setItem(
  'higood-pcs-project-relation-store-v2',
  JSON.stringify({ version: 2, relations: [...legacyRelations, legalFixedRelation], pendingItems: [] }),
)

const revisionRepository = await import('../src/data/pcs-revision-task-repository.ts')
const plateRepository = await import('../src/data/pcs-plate-making-repository.ts')
const patternRepository = await import('../src/data/pcs-pattern-task-repository.ts')
const firstSampleRepository = await import('../src/data/pcs-first-sample-repository.ts')
const firstOrderRepository = await import('../src/data/pcs-first-order-sample-repository.ts')
const relationRepository = await import('../src/data/pcs-project-relation-repository.ts')
const consistency = await import('../src/data/pcs-project-data-consistency.ts')

const migratedTasks = [
  revisionRepository.listRevisionTasks().find((task) => task.revisionTaskId === taskCases[0].task.revisionTaskId),
  plateRepository.listPlateMakingTasks().find((task) => task.plateTaskId === taskCases[1].task.plateTaskId),
  patternRepository.listPatternTasks().find((task) => task.patternTaskId === taskCases[2].task.patternTaskId),
  firstSampleRepository.listFirstSampleTasks().find((task) => task.firstSampleTaskId === taskCases[3].task.firstSampleTaskId),
  firstOrderRepository.listFirstOrderSampleTasks().find((task) => task.firstOrderSampleTaskId === taskCases[4].task.firstOrderSampleTaskId),
]
migratedTasks.forEach((task, index) => {
  assert.ok(task, `${taskCases[index]!.module}历史任务必须保留`)
  assert.equal(task?.projectId, project.projectId, `${taskCases[index]!.module}项目归属必须保留`)
  assert.equal(task?.projectNodeId, '', `${taskCases[index]!.module}旧专业节点绑定必须清空`)
})

const relations = relationRepository.listProjectRelations()
assert.equal(
  relations.filter((relation) => relation.projectRelationId.startsWith('legacy_professional_relation_')).length,
  0,
  '旧专业节点关系必须从正式关系仓储移除',
)
assert.ok(
  relations.some((relation) => relation.projectRelationId === legalFixedRelation.projectRelationId),
  '指向当前固定步骤节点的合法关系不得因来源模块名称被误删',
)
assert.deepEqual(projectRepository.listProjectNodes(project.projectId), projectNodesBefore, '迁移不得改写商品项目固定节点')
assert.equal(
  consistency.auditPcsProjectDataConsistency().issues.filter((issue) =>
    issue.sourceObjectId.startsWith('legacy_professional_task_'),
  ).length,
  0,
  '迁移后不得残留专业任务悬空节点一致性问题',
)

console.log('pcs-professional-task-node-migration.spec.ts PASS')
