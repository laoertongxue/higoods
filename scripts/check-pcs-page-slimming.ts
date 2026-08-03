import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

const engineeringSource = read('src/pages/pcs-engineering-tasks.ts')
const projectSource = read('src/pages/pcs-projects.ts')
const techPackSource = read('src/pages/tech-pack/core.ts')

const forbiddenPatterns: Array<[string, string]> = [
  ['字段分层清单', engineeringSource],
  ['字段模型说明', engineeringSource + projectSource + techPackSource],
  ['字段清单说明', engineeringSource + projectSource + techPackSource],
  ['任务中心说明', engineeringSource],
  ['本页用于', read('src/pages/pcs-engineering-tasks.ts') + read('src/pages/pcs-projects.ts') + read('src/pages/pcs-live-testing.ts') + read('src/pages/pcs-video-testing.ts') + read('src/pages/tech-pack/core.ts')],
  ['该模块用于', read('src/pages/pcs-engineering-tasks.ts') + read('src/pages/pcs-projects.ts') + read('src/pages/pcs-channel-products.ts') + read('src/pages/tech-pack/core.ts')],
  ['用于帮助', read('src/pages/pcs-engineering-tasks.ts') + read('src/pages/pcs-projects.ts') + read('src/pages/pcs-channel-products.ts')],
  ['renderFieldLayerSection', engineeringSource],
]

for (const [pattern, source] of forbiddenPatterns) {
  assert.doesNotMatch(source, new RegExp(pattern), `页面瘦身后不应再出现：${pattern}`)
}

assert.match(engineeringSource, /任务补齐项|任务编号|所属项目|当前状态|查看版本日志/, '工程任务页应保留任务本身')
assert.match(projectSource, /全量信息|记录|附件与引用|操作日志/, '项目任务详情应保留任务字段和记录')
assert.match(techPackSource, /技术包版本日志/, '技术包页面应保留版本日志')

console.log('check-pcs-page-slimming.ts PASS')
