import assert from 'node:assert/strict'
import { getSampleAssetById, listSampleAssets } from '../src/data/pcs-sample-asset-repository.ts'
import {
  handlePcsSampleInventoryEvent,
  renderPcsSampleInventoryPage,
  resetPcsSampleInventoryState,
} from '../src/pages/pcs-sample-inventory.ts'

resetPcsSampleInventoryState()

const listHtml = renderPcsSampleInventoryPage()

assert.match(listHtml, /样衣库存/, '列表页应渲染样衣库存标题')
assert.match(listHtml, /以样衣资产为主视角/, '列表页应说明库存页定位')
assert.match(listHtml, /总量/, '列表页应渲染库存汇总卡片')
assert.match(listHtml, /今日需归还/, '列表页应渲染快捷筛选开关')
assert.match(listHtml, /预占锁定|借出占用|在途待签收/, '列表页应展示库存状态分布')
assert.match(listHtml, /查看完整台账|external-link/, '列表页应提供台账跳转入口')

const sample = listSampleAssets().find((item) => item.projectId) || listSampleAssets()[0]
assert.ok(sample, '应存在样衣库存演示数据')

handlePcsSampleInventoryEvent({
  dataset: { pcsSampleInventoryAction: 'open-detail', sampleAssetId: sample.sampleAssetId },
  closest() {
    return this
  },
} as unknown as HTMLElement)

const detailHtml = renderPcsSampleInventoryPage()

assert.match(detailHtml, /样衣库存详情/, '详情抽屉应渲染标题')
assert.match(detailHtml, /快捷操作/, '详情抽屉应提供快捷操作')
assert.match(detailHtml, /最近台账事件/, '详情抽屉应展示最近台账事件')
assert.match(detailHtml, /\/pcs\/samples\/ledger/, '详情抽屉应提供样衣台账跳转')
assert.match(detailHtml, /\/pcs\/projects\//, '详情抽屉应提供商品项目跳转')

const reservedSample = listSampleAssets().find((item) => item.inventoryStatus === '预占锁定')
assert.ok(reservedSample, '应存在预占中的样衣库存演示数据')

handlePcsSampleInventoryEvent({
  dataset: { pcsSampleInventoryAction: 'release-reserve', sampleAssetId: reservedSample.sampleAssetId },
  closest() {
    return this
  },
} as unknown as HTMLElement)

assert.equal(getSampleAssetById(reservedSample.sampleAssetId)?.inventoryStatus, '在库可用', '释放预占后应回到在库可用')
assert.match(renderPcsSampleInventoryPage(), /已释放预占：/, '释放预占后应反馈操作结果')

console.log('pcs-sample-inventory.spec.ts PASS')
