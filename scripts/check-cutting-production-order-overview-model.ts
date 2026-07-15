import assert from 'node:assert/strict'
import {
  buildFactoryLines,
  summarizeDyeStatus,
  summarizePrintStatus,
  summarizeThreeStageStatus,
} from '../src/pages/process-factory/cutting/production-order-overview-model.ts'

assert.equal(summarizeThreeStageStatus([], false), '—')
assert.equal(summarizeThreeStageStatus(['NOT_STARTED', 'NOT_STARTED'], true), '未开始')
assert.equal(summarizeThreeStageStatus(['DONE', 'NOT_STARTED'], true), '进行中')
assert.equal(summarizeThreeStageStatus(['DONE', 'DONE'], true), '已完成')
assert.equal(summarizePrintStatus(false, []), '无需印花')
assert.equal(summarizePrintStatus(true, ['PRINTING']), '进行中')
assert.equal(summarizeDyeStatus(false, []), '无需染色')
assert.equal(summarizeDyeStatus(true, ['DYEING']), '进行中')
assert.deepEqual(
  buildFactoryLines([
    {
      factoryId: 'F1',
      factoryName: '泗水中央裁床厂',
      factoryTypeLabel: '中央工厂',
      accepted: true,
      requiredQty: 100,
      pickedQty: 40,
    },
  ]),
  [
    {
      factoryId: 'F1',
      factoryName: '泗水中央裁床厂',
      factoryTypeLabel: '中央工厂',
      acceptanceLabel: '已接单',
      pickupLabel: '部分领取',
    },
  ],
)

console.log('cutting production order overview model checks passed')
