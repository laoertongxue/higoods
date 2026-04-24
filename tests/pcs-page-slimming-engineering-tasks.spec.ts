import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../src/pages/pcs-engineering-tasks.ts', import.meta.url), 'utf8')

assert.doesNotMatch(source, /字段分层清单|字段模型说明|任务中心说明|任务中心提示/, '工程任务页源码不应再出现说明型文案')
assert.doesNotMatch(source, /任务补齐项|保存实例补齐字段/, '工程任务页不应再保留任务补齐壳')
assert.doesNotMatch(source, /完成校验|每行一个图片地址|每行一个文件地址/, '工程任务页不应再保留说明性校验或文本地址录入文案')
assert.match(source, /保存任务/, '工程任务页应直接保存正式任务')
assert.match(source, /上传图片|上传文件/, '工程任务页应提供正式上传入口')
assert.match(source, /创建方式|关联商品项目|独立任务|款式档案/, '工程任务页应支持项目和独立任务两种创建方式')

console.log('pcs-page-slimming-engineering-tasks.spec.ts PASS')
