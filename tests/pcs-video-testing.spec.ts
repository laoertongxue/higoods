import assert from 'node:assert/strict'

import { listVideoTestRecords } from '../src/data/pcs-video-testing-repository.ts'
import {
  handlePcsVideoTestingEvent,
  renderPcsVideoTestingDetailPage,
  renderPcsVideoTestingListPage,
} from '../src/pages/pcs-video-testing.ts'

const listHtml = renderPcsVideoTestingListPage()
assert.match(listHtml, /短视频记录/)
assert.match(listHtml, /新建记录/)
assert.match(listHtml, /待核对/)
assert.match(listHtml, /测款入账/)

const listRecord = listVideoTestRecords().find((item) => listHtml.includes(item.videoRecordId)) || listVideoTestRecords()[0]
assert.ok(listRecord, '应存在可在列表页展示的短视频记录种子数据')
assert.match(listHtml, new RegExp(listRecord.videoRecordId))
assert.match(listHtml, new RegExp(`/pcs/testing/video/${listRecord.videoRecordId}`))

const record = listVideoTestRecords().find((item) => item.videoRecordId === 'SV-20260122-008') || listRecord
assert.ok(record, '应存在短视频记录种子数据')

const detailHtml = renderPcsVideoTestingDetailPage(record.videoRecordId)
assert.match(detailHtml, /内容条目/)
assert.match(detailHtml, /数据核对/)
assert.match(detailHtml, /证据素材/)
assert.match(detailHtml, /测款入账/)
assert.match(detailHtml, /样衣关联/)
assert.match(detailHtml, /日志审计/)
assert.match(detailHtml, /负责人信息/)
assert.match(detailHtml, /工作项定义核对/)
assert.match(detailHtml, /工作项状态/)
assert.match(detailHtml, /关联短视频测款记录/)
assert.match(detailHtml, /上游渠道商品编码/)
assert.match(detailHtml, /发布渠道/)

handlePcsVideoTestingEvent({ dataset: { pcsVideoTestingAction: 'set-detail-tab', tab: 'items' }, closest() { return this } } as unknown as HTMLElement)
const itemsHtml = renderPcsVideoTestingDetailPage(record.videoRecordId)
assert.match(itemsHtml, /\/pcs\/projects\/prj_/, '测款内容条目的绑定对象应跳转至商品项目')

console.log('pcs-video-testing.spec.ts PASS')
