import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { renderPcsVideoTestingListPage } from '../src/pages/pcs-video-testing.ts'

const source = readFileSync(new URL('../src/pages/pcs-video-testing.ts', import.meta.url), 'utf8')
const listHtml = renderPcsVideoTestingListPage()

assert.match(listHtml, /短视频测款/, '列表页应渲染短视频测款标题')
assert.match(listHtml, /新增短视频测款/, '列表页应提供新增短视频测款入口')
assert.match(listHtml, /短视频测款列表/, '列表页应渲染正式列表标题')

assert.match(source, /内容条目/, '页面源码应保留内容条目区')
assert.match(source, /数据核对/, '页面源码应保留数据核对区')
assert.match(source, /证据素材/, '页面源码应保留证据素材区')
assert.match(source, /测款入账/, '页面源码应保留测款入账区')
assert.match(source, /日志审计/, '页面源码应保留日志审计区')
assert.match(source, /负责人信息/, '页面源码应保留负责人信息区')
assert.match(source, /工作项字段/, '页面源码应保留工作项字段区')
assert.match(source, /工作项状态/, '页面源码应保留工作项状态字段')
assert.match(source, /关联短视频测款记录/, '页面源码应保留正式关联动作')
assert.match(source, /上游渠道商品编码/, '页面源码应保留上游渠道商品编码字段')
assert.match(source, /发布渠道/, '页面源码应保留发布渠道字段')

assert.doesNotMatch(source, /本页用于|该模块用于|用于帮助|字段分层清单|字段模型说明|任务中心说明/, '短视频测款页不应保留无关说明文案')

console.log('pcs-video-testing.spec.ts PASS')
