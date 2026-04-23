import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../src/pages/pcs-engineering-tasks.ts', import.meta.url), 'utf8')

assert.doesNotMatch(source, /字段分层清单|字段模型说明|任务中心说明|任务中心提示/, '工程任务页源码不应再出现说明型文案')
assert.doesNotMatch(source, /任务补齐项|保存实例补齐字段/, '工程任务页不应再保留任务补齐壳')
assert.match(source, /完成校验/, '工程任务页应展示完成校验摘要')
assert.match(source, /保存任务/, '工程任务页应直接保存正式任务')
assert.match(source, /关联技术包/, '工程任务页应保留关联技术包内容')
assert.match(source, /查看版本日志/, '工程任务页应保留版本日志入口')

console.log('pcs-page-slimming-engineering-tasks.spec.ts PASS')
