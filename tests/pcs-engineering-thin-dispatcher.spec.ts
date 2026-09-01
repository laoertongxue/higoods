import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync('src/pages/pcs-engineering-tasks.ts', 'utf8')
const routeSource = readFileSync('src/router/route-renderers.ts', 'utf8')
const lineCount = source.split('\n').length

assert.ok(lineCount < 500, `专业任务主文件必须是薄分派层，当前仍有 ${lineCount} 行`)

for (const legacyRepository of [
  'pcs-plate-making-repository',
  'pcs-pattern-task-repository',
  'pcs-first-sample-repository',
  'pcs-first-order-sample-repository',
]) {
  assert.ok(!source.includes(legacyRepository), `薄分派层不得导入旧事实源：${legacyRepository}`)
}

for (const removedAction of [
  'cancel-task',
  'pause-task',
  'submit-first-sample-acceptance',
  'submit-first-order-conclusion',
  'create-revision-from-first-sample',
]) {
  assert.ok(!source.includes(removedAction), `薄分派层不得保留已删除动作：${removedAction}`)
}

assert.doesNotMatch(source, /revision-task\.ts|design-task\.ts/, '设计改款父任务不得混入专业任务分派层')
assert.match(routeSource, /pcs-independent-sampling/, '设计改款必须由统一页面模块承接')
assert.match(source, /renderPcsFirstOrderSampleTaskPage\s*=\s*renderPcsFirstSampleTaskPage/, '旧首单入口只能无文案别名到首单样衣')

console.log('pcs-engineering-thin-dispatcher.spec.ts PASS')
