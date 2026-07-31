import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const sources = [
  '../src/data/pcs-task-project-relation-writeback.ts',
  '../src/data/pcs-first-sample-project-writeback.ts',
  '../src/data/pcs-first-order-sample-project-writeback.ts',
  '../src/data/pcs-project-archive-sync.ts',
  '../src/data/pcs-project-data-consistency.ts',
].map((relativePath) => ({
  relativePath,
  source: readFileSync(new URL(relativePath, import.meta.url), 'utf8'),
}))

sources.forEach(({ relativePath, source }) => {
  assert.doesNotMatch(source, /syncPlateResultToRevisionProjection/, `${relativePath} 不得保留制版结果回写旧节点兼容函数`)
  assert.doesNotMatch(source, /function updateTaskNode/, `${relativePath} 不得保留专业任务节点兼容函数`)
})

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
