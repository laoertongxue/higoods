import assert from 'node:assert/strict'
import { listSampleAssets } from '../src/data/pcs-sample-asset-repository.ts'
import {
  handlePcsSampleViewEvent,
  renderPcsSampleViewPage,
  resetPcsSampleViewState,
} from '../src/pages/pcs-sample-view.ts'

resetPcsSampleViewState()

const listHtml = renderPcsSampleViewPage()

assert.match(listHtml, /样衣视图/, '页面应渲染样衣视图标题')
assert.match(listHtml, /卡片|看板|列表/, '页面应提供多视图切换')
assert.match(listHtml, /发起使用申请/, '页面应提供批量申请入口')

const sample = listSampleAssets()[0]
assert.ok(sample, '应存在样衣视图演示数据')

handlePcsSampleViewEvent({
  dataset: { pcsSampleViewAction: 'toggle-select-sample', sampleAssetId: sample.sampleAssetId },
  closest() {
    return this
  },
} as unknown as HTMLElement)

handlePcsSampleViewEvent({
  dataset: { pcsSampleViewAction: 'batch-apply' },
  closest() {
    return this
  },
} as unknown as HTMLElement)

assert.match(renderPcsSampleViewPage(), /请前往样衣使用申请继续提交|请至少选择一件样衣/, '批量申请应反馈操作结果')

handlePcsSampleViewEvent({
  dataset: { pcsSampleViewAction: 'open-detail', sampleAssetId: sample.sampleAssetId },
  closest() {
    return this
  },
} as unknown as HTMLElement)

const detailHtml = renderPcsSampleViewPage()

assert.match(detailHtml, /样衣详情/, '详情抽屉应渲染标题')
assert.match(detailHtml, /查看台账/, '详情抽屉应提供台账跳转')
assert.match(detailHtml, /\/pcs\/samples\/application/, '详情抽屉应提供申请跳转')

console.log('pcs-sample-view.spec.ts PASS')
