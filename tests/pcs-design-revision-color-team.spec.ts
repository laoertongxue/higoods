import assert from 'node:assert/strict'

import { listEngineeringIndependentSamplingRecords, resetEngineeringIndependentSamplingRepository } from '../src/data/pcs-engineering-master-sampling.ts'
import { resolveDesignRevisionMaterialSku } from '../src/data/pcs-design-revision-material-sku.ts'

resetEngineeringIndependentSamplingRepository(true)
const records = listEngineeringIndependentSamplingRecords()
assert.ok(records.length > 0, '演示数据应包含设计改款任务')
assert.ok(records.every((record) => record.professionalTasks.every((task) =>
  task.taskType === 'BASE_PATTERN' || task.taskType === 'DISPLAY_SAMPLE',
)), '设计改款 Mock 不应生成在线调色或花型任务')

const dyed = resolveDesignRevisionMaterialSku('dr_cotton_dyed')
const printed = resolveDesignRevisionMaterialSku('dr_cotton_dye_print')
assert.equal(dyed.requiresDye, true)
assert.equal(dyed.requiresPrint, false)
assert.ok(dyed.colorName && dyed.pantoneCode, '目标染色 SKU 应带出颜色与潘通号')
assert.equal(printed.requiresDye, true)
assert.equal(printed.requiresPrint, true)
assert.ok(printed.colorName && printed.pantoneCode && printed.patternCode && printed.patternImageUrl,
  '目标染印 SKU 应同时带出染色与花型信息')
assert.equal(printed.dyedSkuCode, dyed.targetSkuCode, '同一份面料先染后印')

console.log('pcs-design-revision-color-team.spec PASS')
