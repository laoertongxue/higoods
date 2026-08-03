import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const read = (file: string): string => fs.readFileSync(path.join(process.cwd(), file), 'utf8')
const dispatcher = read('src/pages/pcs-engineering-tasks.ts')
const page = read('src/pages/pcs-engineering-tasks/plate-making-task.ts')
const common = read('src/pages/pcs-engineering-tasks/master-task-page.ts')

assert.match(page, /createMasterTaskPage/, '制版任务必须使用工程主单任务页面骨架')
for (const type of ['BASE_PATTERN_WOVEN', 'BASE_PATTERN_KNIT', 'SIZE_PATTERN_WOVEN', 'SIZE_PATTERN_KNIT']) {
  assert.ok(page.includes(type), `制版任务必须覆盖工程任务类型：${type}`)
}
assert.match(common, /listEngineeringTasksByType/, '制版任务必须从工程主单任务读取')
assert.match(common, /renderTaskDependencyCard/, '制版任务详情必须展示固定前置依赖')
assert.ok(!dispatcher.includes('pcs-plate-making-repository'), '任务入口不得回退读取旧制版仓储')
assert.ok(!dispatcher.includes('submit-plate-sample-review'), '任务入口不得保留旧样板确认动作')

console.log('check-pcs-plate-making-refactor PASS')
