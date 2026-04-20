import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { renderPcsLiveTestingListPage } from '../src/pages/pcs-live-testing.ts'

const source = readFileSync(new URL('../src/pages/pcs-live-testing.ts', import.meta.url), 'utf8')
const listHtml = renderPcsLiveTestingListPage()

assert.match(listHtml, /直播测款/, '列表页应渲染直播测款标题')
assert.match(listHtml, /新增直播测款/, '列表页应提供新增直播测款入口')
assert.match(listHtml, /直播测款列表/, '列表页应渲染正式列表标题')

assert.match(source, /测款入账/, '页面源码应保留测款入账区域')
assert.match(source, /日志审计|操作日志/, '页面源码应保留日志区域')
assert.match(source, /关键人/, '页面源码应保留关键人区块')
assert.match(source, /工作项字段/, '页面源码应保留工作项字段区')
assert.match(source, /工作项状态/, '页面源码应保留工作项状态字段')
assert.match(source, /关联直播测款记录/, '页面源码应保留正式关联动作')
assert.match(source, /上游渠道商品编码/, '页面源码应保留上游渠道商品编码字段')
assert.match(source, /直播挂车明细/, '页面源码应保留直播挂车明细字段')

assert.doesNotMatch(source, /本页用于|该模块用于|用于帮助|字段分层清单|字段模型说明|任务中心说明/, '直播测款页不应保留无关说明文案')

console.log('pcs-live-testing.spec.ts PASS')
