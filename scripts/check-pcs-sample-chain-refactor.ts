import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const read = (file: string): string => fs.readFileSync(path.join(process.cwd(), file), 'utf8')
const dispatcher = read('src/pages/pcs-engineering-tasks.ts')
const page = read('src/pages/pcs-engineering-tasks/first-sample-task.ts')

assert.match(page, /PRE_PRODUCTION_SAMPLE/, '产前版样衣必须绑定工程主单任务类型')
assert.match(page, /listEngineeringTasksByType/, '产前版样衣必须从工程主单任务读取')
assert.match(page, /submitEngineeringTaskResult/, '产前版样衣成果必须写入工程主单任务')
assert.match(page, /resultImageIds/, '产前版样衣成果必须维护结果图片')
assert.match(page, /resultQuantity/, '产前版样衣成果必须维护制作数量')
assert.match(dispatcher, /renderPcsFirstOrderSampleTaskPage\s*=\s*renderPcsFirstSampleTaskPage/, '旧路由入口只能别名到产前版样衣')
for (const legacy of ['pcs-first-sample-repository', 'pcs-first-order-sample-repository', 'submit-first-sample-acceptance', 'submit-first-order-conclusion']) {
  assert.ok(!dispatcher.includes(legacy), `任务入口不得保留旧样衣事实或动作：${legacy}`)
}

console.log('check-pcs-sample-chain-refactor PASS')
