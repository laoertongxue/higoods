import assert from 'node:assert/strict'
import { listSampleLedgerEvents } from '../src/data/pcs-sample-ledger-repository.ts'
import {
  handlePcsSampleLedgerEvent,
  renderPcsSampleLedgerPage,
  resetPcsSampleLedgerState,
} from '../src/pages/pcs-sample-ledger.ts'

resetPcsSampleLedgerState()

const listHtml = renderPcsSampleLedgerPage()

assert.match(listHtml, /样衣台账/, '列表页应渲染样衣台账标题')
assert.match(listHtml, /不可篡改事实账/, '列表页应说明台账定位')
assert.match(listHtml, /全部事件/, '列表页应渲染台账 KPI')
assert.match(listHtml, /待补正式关联/, '列表页应渲染待补正式关联区域')
assert.match(listHtml, /台账记录/, '列表页应渲染台账表格区域')
assert.match(listHtml, /查看详情/, '列表页应提供详情入口')

const event = listSampleLedgerEvents()[0]
assert.ok(event, '应存在样衣台账演示数据')

handlePcsSampleLedgerEvent({
  dataset: { pcsSampleLedgerAction: 'open-detail', eventId: event.ledgerEventId },
  closest() {
    return this
  },
} as unknown as HTMLElement)

const detailHtml = renderPcsSampleLedgerPage()

assert.match(detailHtml, /库存影响/, '详情抽屉应展示库存影响')
assert.match(detailHtml, /来源与绑定/, '详情抽屉应展示来源与绑定')
assert.match(detailHtml, /同样衣事件流/, '详情抽屉应展示同样衣事件流')
assert.match(detailHtml, /样衣台账详情/, '详情抽屉应渲染标题')
assert.match(detailHtml, /\/pcs\/projects\//, '样衣台账应提供商品项目跳转')

console.log('pcs-sample-ledger.spec.ts PASS')
