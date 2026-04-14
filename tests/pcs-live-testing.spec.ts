import assert from 'node:assert/strict'
import {
  handlePcsLiveTestingEvent,
  renderPcsLiveTestingDetailPage,
  renderPcsLiveTestingListPage,
} from '../src/pages/pcs-live-testing.ts'
import { listLiveSessionRecords } from '../src/data/pcs-live-testing-repository.ts'

const listHtml = renderPcsLiveTestingListPage()

assert.match(listHtml, /直播场次/, '列表页应渲染直播场次标题')
assert.match(listHtml, /新建场次/, '列表页应提供新建场次入口')
assert.match(listHtml, /LS-20260122-001|LS-20260404-011/, '列表页应包含演示场次编号')
assert.match(listHtml, /\/pcs\/testing\/live\/LS-20260122-001|\/pcs\/testing\/live\/LS-20260404-011/, '列表页应包含详情跳转')

const session = listLiveSessionRecords()[0]
assert.ok(session, '应存在直播场次演示数据')

const detailHtml = renderPcsLiveTestingDetailPage(session.liveSessionId)

assert.match(detailHtml, /场次明细/, '详情页应渲染场次明细页签')
assert.match(detailHtml, /测款入账/, '详情页应渲染测款入账页签')
assert.match(detailHtml, /样衣关联/, '详情页应渲染样衣关联页签')
assert.match(detailHtml, /日志审计|操作日志/, '详情页应渲染日志审计区域')
assert.match(detailHtml, /关键人/, '详情页应渲染右侧关键人信息')
assert.match(detailHtml, /工作项定义核对/, '详情页应补充工作项字段核对区域')
assert.match(detailHtml, /工作项状态/, '详情页应显示工作项状态映射')
assert.match(detailHtml, /关联直播测款记录/, '详情页应提供正式关联操作')
assert.match(detailHtml, /上游渠道商品编码/, '详情页应覆盖上游渠道商品编码字段')
assert.match(detailHtml, /直播挂车明细/, '详情页应覆盖直播挂车明细字段')

handlePcsLiveTestingEvent({ dataset: { pcsLiveTestingAction: 'set-detail-tab', tab: 'items' }, closest() { return this } } as unknown as HTMLElement)
const itemsHtml = renderPcsLiveTestingDetailPage(session.liveSessionId)
assert.match(itemsHtml, /\/pcs\/projects\/prj_/, '测款明细的绑定对象应跳转至商品项目')

console.log('pcs-live-testing.spec.ts PASS')
