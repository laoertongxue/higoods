import assert from 'node:assert/strict'
import { listSampleLedgerEvents } from '../src/data/pcs-sample-ledger-repository.ts'
import {
  handlePcsSampleTransferEvent,
  renderPcsSampleTransferPage,
  resetPcsSampleTransferState,
} from '../src/pages/pcs-sample-transfer.ts'

resetPcsSampleTransferState()

const listHtml = renderPcsSampleTransferPage()

assert.match(listHtml, /样衣流转记录/, '列表页应渲染样衣流转记录标题')
assert.match(listHtml, /入库流/, '列表页应渲染流转汇总卡片')
assert.match(listHtml, /查看详情/, '列表页应渲染详情入口')

const firstEvent = listSampleLedgerEvents()[0]
assert.ok(firstEvent, '应存在样衣流转演示记录')

handlePcsSampleTransferEvent({
  dataset: { pcsSampleTransferAction: 'open-detail', eventId: firstEvent.ledgerEventId },
  closest() {
    return this
  },
} as unknown as HTMLElement)

const detailHtml = renderPcsSampleTransferPage()

assert.match(detailHtml, /样衣流转详情/, '详情抽屉应渲染标题')
assert.match(detailHtml, /同样衣时间线/, '详情抽屉应渲染同样衣时间线')
assert.match(detailHtml, /\/pcs\/samples\/ledger/, '详情抽屉应提供台账跳转')

console.log('pcs-sample-transfer.spec.ts PASS')
