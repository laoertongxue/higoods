import {
  processDefinitions,
  processCraftDefinitions,
  processCraftDictRows,
  getProcessCraftDictRowByCode,
  listSamFactoryFieldDefinitions,
  type ProcessCraftDictRow,
  type SamFactoryFieldKey,
} from '../src/data/fcs/process-craft-dict.ts'
import { getSamFormulaGuide } from '../src/data/fcs/process-craft-sam-explainer.ts'

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function assertFieldKeys(row: ProcessCraftDictRow): void {
  invariant(row.samEnabled === true, `${row.craftName}: samEnabled 应为 true`)
  invariant(Boolean(row.samCalcMode), `${row.craftName}: 缺少 samCalcMode`)
  invariant(Boolean(row.samDefaultInputUnit), `${row.craftName}: 缺少 samDefaultInputUnit`)
  invariant(Boolean(row.samConstraintSource), `${row.craftName}: 缺少 samConstraintSource`)
  invariant(row.samFactoryFieldKeys.length > 0, `${row.craftName}: samFactoryFieldKeys 不能为空`)
  invariant(Boolean(row.samReason?.trim()), `${row.craftName}: samReason 不能为空`)

  const dictRows = listSamFactoryFieldDefinitions(row.samFactoryFieldKeys)
  invariant(
    dictRows.length === row.samFactoryFieldKeys.length,
    `${row.craftName}: samFactoryFieldKeys 中存在未定义字段`,
  )

  const text = dictRows.map((item) => item.label).join('、')
  invariant(row.samFactoryFieldText === text, `${row.craftName}: samFactoryFieldText 与字段字典不一致`)

  const formulaGuide = getSamFormulaGuide(row.samCalcMode)
  invariant(Boolean(formulaGuide.formulaText.trim()), `${row.craftName}: 缺少公式文本`)
  invariant(formulaGuide.explanationLines.length > 0, `${row.craftName}: 缺少公式说明`)
  invariant(Boolean(formulaGuide.exampleIntro.trim()), `${row.craftName}: 缺少公式示例说明`)
  invariant(Boolean(formulaGuide.exampleResult.trim()), `${row.craftName}: 缺少公式示例结果`)
  invariant(Boolean(formulaGuide.factoryFieldNote.trim()), `${row.craftName}: 缺少字段维护说明`)
}

function assertExactFieldKeys(craftName: string, expected: SamFactoryFieldKey[]): void {
  const row = processCraftDictRows.find((item) => item.craftName === craftName)
  invariant(row, `缺少工艺 ${craftName}`)
  invariant(
    JSON.stringify(row.samFactoryFieldKeys) === JSON.stringify(expected),
    `${craftName}: samFactoryFieldKeys 不符合预期`,
  )
}

for (const process of processDefinitions) {
  invariant(process.samEnabled === true, `${process.processName}: process samEnabled 应为 true`)
  invariant(process.samFactoryFieldKeys.length > 0, `${process.processName}: process samFactoryFieldKeys 不能为空`)
  invariant(Boolean(process.samReason.trim()), `${process.processName}: process samReason 不能为空`)
}

for (const craft of processCraftDefinitions) {
  invariant(craft.samEnabled === true, `${craft.craftName}: craft samEnabled 应为 true`)
}

invariant(processCraftDictRows.length === processCraftDefinitions.length, '工艺行数量与定义数量不一致')
processCraftDictRows.forEach(assertFieldKeys)

const rowByName = (craftName: string): ProcessCraftDictRow => {
  const row = processCraftDictRows.find((item) => item.craftName === craftName)
  invariant(row, `缺少工艺 ${craftName}`)
  return row
}

invariant(rowByName('丝网印').samCalcMode === 'CONTINUOUS', '丝网印应继承印花连续型规则')
invariant(rowByName('匹染').samCalcMode === 'BATCH', '匹染应继承染色批次型规则')
invariant(rowByName('定位裁').samConstraintSource === 'BOTH', '定位裁应继承裁片双约束规则')
invariant(rowByName('绣花').samDefaultInputUnit === 'PIECE', '绣花应继承按件录入口径')
invariant(rowByName('基础连接').samCalcMode === 'DISCRETE', '基础连接应继承车缝离散型规则')
invariant(rowByName('基础连接').samConstraintSource === 'STAFF', '基础连接应继承车缝人员约束规则')
invariant(rowByName('曲牙').samConstraintSource === 'BOTH', '曲牙应覆盖为设备+人员共同约束')
invariant(rowByName('打条').samCalcMode === 'CONTINUOUS', '打条应覆盖为连续型')
invariant(rowByName('洗水').samDefaultInputUnit === 'KG', '洗水应继承按公斤录入口径')
invariant(rowByName('手缝扣').samConstraintSource === 'STAFF', '手缝扣应保持人员约束')
invariant(rowByName('机打扣').samConstraintSource === 'BOTH', '机打扣应覆盖为设备+人员共同约束')
invariant(rowByName('鸡眼扣').samConstraintSource === 'BOTH', '鸡眼扣应继承五金双约束规则')
invariant(rowByName('包装').samConstraintSource === 'STAFF', '包装应继承人员约束规则')
invariant(rowByName('印花工艺').samCalcMode === 'CONTINUOUS', '印花工艺应覆盖为连续型')
invariant(rowByName('染色工艺').samCalcMode === 'BATCH', '染色工艺应覆盖为批次型')

assertExactFieldKeys('基础连接', [
  'staffCount',
  'staffShiftMinutes',
  'staffEfficiencyValue',
  'staffEfficiencyUnit',
  'efficiencyFactor',
])
assertExactFieldKeys('打条', [
  'deviceCount',
  'deviceShiftMinutes',
  'deviceEfficiencyValue',
  'deviceEfficiencyUnit',
  'staffCount',
  'staffShiftMinutes',
  'setupMinutes',
  'efficiencyFactor',
])
assertExactFieldKeys('染色工艺', [
  'deviceCount',
  'deviceShiftMinutes',
  'batchLoadCapacity',
  'batchLoadUnit',
  'cycleMinutes',
  'staffCount',
  'staffShiftMinutes',
  'setupMinutes',
  'switchMinutes',
  'efficiencyFactor',
])

const coveredCrafts = ['丝网印', '匹染', '定位裁', '绣花', '基础连接', '曲牙', '打条', '洗水', '手缝扣', '鸡眼扣', '包装']
for (const craftName of coveredCrafts) {
  const row = rowByName(craftName)
  invariant(getProcessCraftDictRowByCode(row.craftCode)?.samReason === row.samReason, `${craftName}: 详情查询口径不一致`)
}

console.log(`已校验 ${processDefinitions.length} 个工序、${processCraftDictRows.length} 个工艺的 SAM 规则元数据。`)
