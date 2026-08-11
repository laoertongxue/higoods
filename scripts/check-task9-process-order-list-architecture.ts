import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const controllerConsumers = [
  'src/pages/process-print-orders.ts',
  'src/pages/process-dye-orders.ts',
  'src/pages/process-factory/printing/work-orders.ts',
]
const sourceDetailConsumers = [
  'src/pages/process-print-orders.ts',
  'src/pages/process-dye-orders.ts',
  'src/pages/process-factory/dyeing/work-order-detail.ts',
]

for (const path of controllerConsumers) {
  assert.match(read(path), /createProcessOrderListController/, `${path} 必须复用印染标准列表控制器`)
}
for (const path of sourceDetailConsumers) {
  assert.match(read(path), /getProcessWorkOrderSourceDetailRows/, `${path} 必须复用加工单来源详情 helper`)
}
const redesignedPrintingDetail = read('src/pages/process-factory/printing/work-order-detail.ts')
assert.match(redesignedPrintingDetail, /PRINTING_DEMAND_SOURCE_LABEL/, '印花工厂详情必须读取印花加工单四类需求来源事实')
assert.match(redesignedPrintingDetail, /getPrintingWorkOrderById/, '印花工厂详情必须读取投入、固定产出与双状态统一模型')
assert.doesNotMatch(redesignedPrintingDetail, /getProcessWorkOrderSourceDetailRows/, '印花工厂详情不得回退到缺少采购来源的旧加工单来源 helper')

const sourceLabelDefinition = 'src/data/fcs/process-work-order-domain.ts'
const productionFiles = [
  ...controllerConsumers,
  ...sourceDetailConsumers,
  'src/pages/process-factory/cutting/supplement-management.ts',
  'src/data/fcs/page-adapters/process-prep-pages-adapter.ts',
].filter((path, index, paths) => paths.indexOf(path) === index)
for (const path of productionFiles) {
  for (const label of ['生产单自动生成', '备货手动创建', '裁片补料生成']) {
    assert.equal(read(path).includes(`'${label}'`) || read(path).includes(`"${label}"`), false, `${path} 不得硬编码来源标签 ${label}，应读取 ${sourceLabelDefinition}`)
  }
}

console.log('[check-task9-process-order-list-architecture] passed')
