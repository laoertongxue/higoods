import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const sources = [
  '../src/data/pcs-task-project-relation-writeback.ts',
  '../src/data/pcs-first-sample-project-writeback.ts',
  '../src/data/pcs-first-order-sample-project-writeback.ts',
  '../src/data/pcs-project-archive-sync.ts',
  '../src/data/pcs-project-data-consistency.ts',
  '../src/pages/pcs-engineering-tasks.ts',
  '../src/pages/pcs-projects.ts',
  '../src/data/pcs-engineering-task-field-policy.ts',
  '../src/data/pcs-task-bootstrap.ts',
  '../src/pages/pcs-live-testing.ts',
  '../src/pages/pcs-video-testing.ts',
].map((relativePath) => ({
  relativePath,
  source: readFileSync(new URL(relativePath, import.meta.url), 'utf8'),
}))

sources.forEach(({ relativePath, source }) => {
  assert.doesNotMatch(source, /syncPlateResultToRevisionProjection/, `${relativePath} 不得保留制版结果回写旧节点兼容函数`)
  assert.doesNotMatch(source, /function updateTaskNode/, `${relativePath} 不得保留专业任务节点兼容函数`)
})

const taskWritebackSource = sources.find((item) => item.relativePath.endsWith('pcs-task-project-relation-writeback.ts'))!.source
assert.doesNotMatch(taskWritebackSource, /updateProjectNodeRecord|syncProjectNodeInstanceRuntime/)
assert.doesNotMatch(taskWritebackSource, /createWithoutProjectNode|relation:\s*null/)
assert.doesNotMatch(taskWritebackSource, /function createRevision(?:Pattern|FirstSample)TaskWithoutProjectNode/)

const engineeringPageSource = sources.find((item) => item.relativePath.endsWith('pcs-engineering-tasks.ts'))!.source
assert.doesNotMatch(
  engineeringPageSource,
  /未关联项目节点|项目节点已收口|同步项目节点|商品项目节点同步完成|同步更新商品项目节点/,
)

const projectPageSource = sources.find((item) => item.relativePath.endsWith('pcs-projects.ts'))!.source
assert.doesNotMatch(projectPageSource, /create-engineering-task-from-node|submit-engineering-task-create/)
assert.doesNotMatch(projectPageSource, /renderEngineeringTaskCreateDialog|submitEngineeringTaskCreateDialog|openEngineeringTaskCreateDialog/)
assert.doesNotMatch(projectPageSource, /由商品项目节点推进自动创建|商品项目节点只填写创建任务所需的必要信息/)

const taskBootstrapSource = sources.find((item) => item.relativePath.endsWith('pcs-task-bootstrap.ts'))!.source
assert.doesNotMatch(
  taskBootstrapSource,
  /stepCode:\s*'(?:REVISION_TASK|PATTERN_TASK|PATTERN_ARTWORK_TASK|FIRST_SAMPLE|FIRST_ORDER_SAMPLE)'/,
  '专业任务原始种子不得继续携带已删除的项目步骤编码',
)

for (const relativePath of [
  '../src/data/pcs-task-project-relation-writeback.ts',
  '../src/data/pcs-first-sample-project-writeback.ts',
  '../src/data/pcs-first-order-sample-project-writeback.ts',
  '../src/data/pcs-task-bootstrap.ts',
]) {
  const source = sources.find((item) => item.relativePath === relativePath)!.source
  assert.doesNotMatch(
    source,
    /projectNodeId:\s*(?:null|'')|stepCode:\s*''|stepName:\s*''|legacyRefType:\s*''|legacyRefValue:\s*''/,
    `${relativePath} 不得为专业任务关系补空兼容字段`,
  )
}

const fieldPolicySource = sources.find((item) => item.relativePath.endsWith('pcs-engineering-task-field-policy.ts'))!.source
assert.doesNotMatch(fieldPolicySource, /商品项目节点同步完成|同步项目节点/)

for (const pageName of ['pcs-live-testing.ts', 'pcs-video-testing.ts']) {
  const source = sources.find((item) => item.relativePath.endsWith(pageName))!.source
  assert.doesNotMatch(source, /工作项状态/, `${pageName} 不得显示已删除的工作项语义`)
}

for (const relativePath of [
  '../src/data/pcs-first-sample-project-writeback.ts',
  '../src/data/pcs-first-order-sample-project-writeback.ts',
]) {
  const source = sources.find((item) => item.relativePath === relativePath)!.source
  assert.doesNotMatch(
    source,
    /assertFirstSampleProjectNode|assertFirstOrderSampleProjectNode|unlockNextProjectNode|syncProjectNodeInstanceRuntime/,
    `${relativePath} 不得保留首版／首单专业项目节点写回或解锁逻辑`,
  )
  assert.doesNotMatch(source, /stepCode:\s*'FIRST_(?:ORDER_)?SAMPLE'/, `${relativePath} 关系不得保存专业步骤编码`)
}

const archiveSource = sources.find((item) => item.relativePath.endsWith('pcs-project-archive-sync.ts'))!.source
assert.doesNotMatch(archiveSource, /getProjectNodeRecordByStepCode\([^)]*'PROJECT_INIT'/, '项目资料归档运行时不得绑定 PROJECT_INIT')

console.log('pcs-task2-dead-project-node-compatibility.spec.ts PASS')
