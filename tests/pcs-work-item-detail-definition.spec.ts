import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { listPcsWorkItems } from '../src/data/pcs-work-items.ts'
import { getPcsWorkItemDetailViewModel } from '../src/data/pcs-work-item-library-view-model.ts'

const sampleIds = [
  'PROJECT_INIT',
  'SAMPLE_ACQUIRE',
  'CHANNEL_PRODUCT_LISTING',
  'PROJECT_TRANSFER_PREP',
] as const

const detailPageSource = readFileSync(new URL('../src/pages/pcs-work-item-detail.ts', import.meta.url), 'utf8')
assert.ok(detailPageSource.includes('字段清单'), '工作项详情页源码应保留字段清单区块')
assert.ok(detailPageSource.includes('状态定义'), '工作项详情页源码应保留状态定义区块')
assert.ok(detailPageSource.includes('可操作项'), '工作项详情页源码应保留可操作项区块')
assert.ok(detailPageSource.includes('实例承载方式'), '工作项详情页源码应保留实例承载方式区块')
assert.ok(!detailPageSource.includes('编辑工作项'), '工作项详情页源码不应再出现编辑工作项按钮')

sampleIds.forEach((workItemId) => {
  const workItem = listPcsWorkItems().find((item) => item.code === workItemId)
  assert.ok(workItem, `${workItemId} 应存在于工作项目录`)
  const detail = getPcsWorkItemDetailViewModel(workItem!.id)
  assert.ok(detail, `${workItemId} 应能读取工作项详情 view model`)
  assert.ok(detail!.fieldGroups.length > 0, `${workItemId} 应具备字段清单`)
  assert.ok(detail!.meta.runtimeCarrierLabel, `${workItemId} 应具备实例承载方式`)
  assert.ok(Array.isArray(detail!.statusDefinitions), `${workItemId} 应具备状态定义数组`)
  assert.ok(Array.isArray(detail!.operationDefinitions), `${workItemId} 应具备可操作项数组`)
})

console.log('pcs-work-item-detail-definition.spec.ts PASS')
