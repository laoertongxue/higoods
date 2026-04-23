import assert from 'node:assert/strict'

import { PCS_PROJECT_WORK_ITEM_CONTRACTS } from '../src/data/pcs-project-domain-contract.ts'

const firstSample = PCS_PROJECT_WORK_ITEM_CONTRACTS.find((item) => item.workItemTypeCode === 'FIRST_SAMPLE')
const preProduction = PCS_PROJECT_WORK_ITEM_CONTRACTS.find((item) => item.workItemTypeCode === 'PRE_PRODUCTION_SAMPLE')

assert.ok(firstSample, '工作项库必须保留首版样衣打样')
assert.ok(preProduction, '工作项库必须保留产前版样衣')

const firstLabels = firstSample!.fieldDefinitions.map((field) => field.label)
const preProductionLabels = preProduction!.fieldDefinitions.map((field) => field.label)

assert.ok(firstLabels.includes('是否可复用为产前版'), '首版样衣字段定义必须包含产前复用字段')
assert.ok(firstLabels.includes('来源技术包版本编码'), '首版样衣字段定义必须包含技术包引用')
assert.ok(preProductionLabels.includes('样衣链路模式'), '产前版字段定义必须包含链路模式')
assert.ok(preProductionLabels.includes('特殊场景原因'), '产前版字段定义必须包含特殊场景原因')
assert.ok(preProductionLabels.includes('工厂参照样'), '产前版字段定义必须包含工厂参照样')
assert.ok(preProductionLabels.includes('最终参照样衣'), '产前版字段定义必须包含最终参照样衣')

console.log('pcs-sample-chain-work-item-contract.spec.ts PASS')
