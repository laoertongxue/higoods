import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const read = (file: string): string => fs.readFileSync(path.join(process.cwd(), file), 'utf8')
const dispatcher = read('src/pages/pcs-engineering-tasks.ts')
const page = read('src/pages/pcs-engineering-tasks/pattern-task.ts')
const common = read('src/pages/pcs-engineering-tasks/master-task-page.ts')

assert.match(page, /createMasterTaskPage/, '花型任务必须使用工程主单任务页面骨架')
assert.match(page, /PATTERN_ARTWORK/, '花型任务必须绑定工程主单的花型任务类型')
assert.match(common, /listEngineeringTasksByType/, '花型任务必须从工程主单任务读取')
assert.match(common, /renderTaskReworkRoundsCard/, '花型任务详情必须展示返工轮次')
assert.ok(!dispatcher.includes('pcs-pattern-task-repository'), '任务入口不得回退读取旧花型仓储')
assert.ok(!dispatcher.includes('submit-pattern-buyer-review'), '任务入口不得保留旧花型审核动作')
assert.ok(!dispatcher.includes('pattern-master-task'), '任务入口不得保留花型第二页面')

console.log('check-pcs-pattern-task-refactor PASS')
