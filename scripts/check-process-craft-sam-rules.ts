import {
  CURRENT_STAGE_ALLOWED_FIELD_KEYS,
  FACTORY_SUPPLY_TEMPLATE_BY_CRAFT_NAME,
  getExpectedSamCurrentFieldKeysByTemplate,
  getFactorySupplyFormulaGuide,
  getFactorySupplyFormulaTemplate,
  type FactorySupplyFormulaTemplate,
} from '../src/data/fcs/process-craft-sam-explainer.ts'
import {
  getProcessCraftDictRowByCode,
  listSamFactoryFieldDefinitions,
  processCraftDefinitions,
  processCraftDictRows,
  processDefinitions,
  type ProcessCraftDictRow,
  type SamCurrentFieldKey,
  type SamFactoryFieldKey,
} from '../src/data/fcs/process-craft-dict.ts'

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function sameKeys(left: readonly string[], right: readonly string[]): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function assertCurrentFieldSubset(craftName: string, keys: readonly SamCurrentFieldKey[]): void {
  const allowed = new Set<SamCurrentFieldKey>(CURRENT_STAGE_ALLOWED_FIELD_KEYS)
  for (const key of keys) {
    invariant(allowed.has(key), `${craftName}: 当前阶段字段 ${key} 不在允许集合内`)
  }
}

function assertRow(row: ProcessCraftDictRow): void {
  invariant(row.samEnabled === true, `${row.craftName}: samEnabled 应为 true`)
  invariant(Boolean(row.samCalcMode), `${row.craftName}: 缺少 samCalcMode`)
  invariant(Boolean(row.samDefaultInputUnit), `${row.craftName}: 缺少 samDefaultInputUnit`)
  invariant(Boolean(row.samConstraintSource), `${row.craftName}: 缺少 samConstraintSource`)

  invariant(row.samIdealFieldKeys.length > 0, `${row.craftName}: samIdealFieldKeys 不能为空`)
  invariant(Boolean(row.samIdealReason.trim()), `${row.craftName}: samIdealReason 不能为空`)
  invariant(row.samCurrentFieldKeys.length > 0, `${row.craftName}: samCurrentFieldKeys 不能为空`)
  invariant(Boolean(row.samCurrentReason.trim()), `${row.craftName}: samCurrentReason 不能为空`)
  invariant(row.samCurrentFormulaLines.length > 0, `${row.craftName}: samCurrentFormulaLines 不能为空`)
  invariant(row.samCurrentExplanationLines.length > 0, `${row.craftName}: samCurrentExplanationLines 不能为空`)
  invariant(row.samCurrentExampleLines.length > 0, `${row.craftName}: samCurrentExampleLines 不能为空`)

  const idealDefs = listSamFactoryFieldDefinitions(row.samIdealFieldKeys)
  const currentDefs = listSamFactoryFieldDefinitions(row.samCurrentFieldKeys as SamFactoryFieldKey[])
  invariant(idealDefs.length === row.samIdealFieldKeys.length, `${row.craftName}: samIdealFieldKeys 中存在未定义字段`)
  invariant(currentDefs.length === row.samCurrentFieldKeys.length, `${row.craftName}: samCurrentFieldKeys 中存在未定义字段`)
  invariant(
    row.samIdealFieldText === idealDefs.map((item) => item.label).join('、'),
    `${row.craftName}: samIdealFieldText 与字典不一致`,
  )
  invariant(
    row.samCurrentFieldText === currentDefs.map((item) => item.label).join('、'),
    `${row.craftName}: samCurrentFieldText 与字典不一致`,
  )

  assertCurrentFieldSubset(row.craftName, row.samCurrentFieldKeys)
  invariant(
    sameKeys(row.samFactoryFieldKeys, row.samCurrentFieldKeys),
    `${row.craftName}: samFactoryFieldKeys 应仅作为当前阶段字段别名`,
  )
  invariant(row.samFactoryFieldText === row.samCurrentFieldText, `${row.craftName}: samFactoryFieldText 应等于 samCurrentFieldText`)
  invariant(row.samReason === row.samCurrentReason, `${row.craftName}: samReason 应等于 samCurrentReason`)

  const guide = getFactorySupplyFormulaGuide(row.craftName)
  invariant(sameKeys(guide.currentFieldKeys, row.samCurrentFieldKeys), `${row.craftName}: 当前阶段字段与模板不一致`)
  invariant(
    JSON.stringify(guide.currentFormulaLines) === JSON.stringify(row.samCurrentFormulaLines),
    `${row.craftName}: 当前阶段公式与模板不一致`,
  )
  invariant(
    JSON.stringify(guide.currentExplanationLines) === JSON.stringify(row.samCurrentExplanationLines),
    `${row.craftName}: 当前阶段说明与模板不一致`,
  )
  invariant(
    JSON.stringify(guide.currentExampleLines) === JSON.stringify(row.samCurrentExampleLines),
    `${row.craftName}: 当前阶段示例与模板不一致`,
  )
  invariant(guide.currentReason === row.samCurrentReason, `${row.craftName}: 当前阶段原因与模板不一致`)

  const forbiddenTaskPhrases = ['这批任务', '总量', '一共多少件', '一共多少米', '这笔任务分几批做', '任务总 SAM']
  const textBundle = [
    ...guide.idealFormulaLines,
    ...row.samCurrentFormulaLines,
    ...row.samCurrentExplanationLines,
    ...row.samCurrentExampleLines,
    row.samCurrentReason,
  ].join(' ')
  for (const phrase of forbiddenTaskPhrases) {
    invariant(!textBundle.includes(phrase), `${row.craftName}: 仍残留任务需求侧表述 ${phrase}`)
  }
  invariant(
    row.samCurrentFormulaLines.some((line) => line.includes('默认日可供给发布工时 SAM')),
    `${row.craftName}: 当前阶段公式没有导向默认日可供给发布工时 SAM`,
  )
  invariant(
    row.samCurrentExampleLines.some((line) => line.includes('默认日可供给发布工时 SAM')),
    `${row.craftName}: 当前阶段示例没有导向默认日可供给发布工时 SAM`,
  )
}

function rowByName(craftName: string): ProcessCraftDictRow {
  const row = processCraftDictRows.find((item) => item.craftName === craftName)
  invariant(row, `缺少工艺 ${craftName}`)
  return row
}

function assertTemplate(craftName: string, expectedTemplate: FactorySupplyFormulaTemplate): void {
  const row = rowByName(craftName)
  invariant(getFactorySupplyFormulaTemplate(craftName) === expectedTemplate, `${craftName}: 模板绑定错误`)
  invariant(
    sameKeys(row.samCurrentFieldKeys, getExpectedSamCurrentFieldKeysByTemplate(expectedTemplate)),
    `${craftName}: 当前阶段字段不符合模板 ${expectedTemplate}`,
  )

  if (expectedTemplate === 'A') {
    invariant(row.samCalcMode === 'DISCRETE', `${craftName}: 模板 A 应为离散型`)
    invariant(row.samConstraintSource === 'STAFF', `${craftName}: 模板 A 应为人员约束`)
  }
  if (expectedTemplate === 'B') {
    invariant(row.samCalcMode === 'DISCRETE', `${craftName}: 模板 B 应为离散型`)
    invariant(row.samConstraintSource === 'BOTH', `${craftName}: 模板 B 应为设备+人员共同约束`)
  }
  if (expectedTemplate === 'C') {
    invariant(row.samCalcMode === 'CONTINUOUS', `${craftName}: 模板 C 应为连续型`)
    invariant(row.samConstraintSource === 'BOTH', `${craftName}: 模板 C 应为设备+人员共同约束`)
  }
  if (expectedTemplate === 'D') {
    invariant(row.samCalcMode === 'BATCH', `${craftName}: 模板 D 应为批次型`)
    invariant(row.samConstraintSource === 'BOTH', `${craftName}: 模板 D 应为设备+人员共同约束`)
  }
}

for (const process of processDefinitions) {
  invariant(process.samEnabled === true, `${process.processName}: process samEnabled 应为 true`)
  invariant(process.samIdealFieldKeys.length > 0, `${process.processName}: process samIdealFieldKeys 不能为空`)
  invariant(Boolean(process.samIdealReason.trim()), `${process.processName}: process samIdealReason 不能为空`)
  invariant(process.samCurrentFieldKeys.length > 0, `${process.processName}: process samCurrentFieldKeys 不能为空`)
  invariant(Boolean(process.samCurrentReason.trim()), `${process.processName}: process samCurrentReason 不能为空`)
  invariant(process.samCurrentFormulaLines.length > 0, `${process.processName}: process samCurrentFormulaLines 不能为空`)
}

for (const craft of processCraftDefinitions) {
  invariant(craft.samEnabled === true, `${craft.craftName}: craft samEnabled 应为 true`)
}

invariant(processCraftDictRows.length === processCraftDefinitions.length, '工艺行数量与定义数量不一致')
processCraftDictRows.forEach(assertRow)

const expectedTemplateMap: Record<string, FactorySupplyFormulaTemplate> = {
  丝网印: 'C',
  数码印: 'C',
  匹染: 'D',
  色织: 'D',
  定位裁: 'B',
  定向裁: 'B',
  绣花: 'B',
  贝壳绣: 'B',
  压褶: 'C',
  基础连接: 'A',
  曲牙: 'B',
  打揽: 'B',
  打条: 'C',
  激光切: 'C',
  烫画: 'B',
  直喷: 'B',
  捆条: 'C',
  印花工艺: 'C',
  染色工艺: 'D',
  缩水: 'D',
  洗水: 'D',
  开扣眼: 'B',
  手缝扣: 'A',
  机打扣: 'B',
  四爪扣: 'B',
  布包扣: 'B',
  鸡眼扣: 'B',
  手工盘扣: 'A',
  熨烫: 'B',
  包装: 'A',
}

invariant(
  processCraftDictRows.every((row) => FACTORY_SUPPLY_TEMPLATE_BY_CRAFT_NAME[row.craftName]),
  '存在工艺未绑定当前阶段模板',
)
invariant(
  Object.keys(expectedTemplateMap).length === processCraftDictRows.length,
  '模板映射数量与当前工艺总数不一致',
)

for (const [craftName, template] of Object.entries(expectedTemplateMap)) {
  assertTemplate(craftName, template)
}

const baseConnectRow = rowByName('基础连接')
invariant(baseConnectRow.samCurrentFieldKeys.length === 4, '基础连接当前阶段字段应为模板 A')
invariant(baseConnectRow.samIdealFieldKeys.includes('staffEfficiencyUnit'), '基础连接理想完整字段应保留人员效率单位')

const quyaRow = rowByName('曲牙')
invariant(quyaRow.samCurrentFieldKeys.includes('deviceCount'), '曲牙当前阶段字段应包含设备数量')
invariant(quyaRow.samCurrentFieldKeys.includes('staffEfficiencyValue'), '曲牙当前阶段字段应包含人员标准效率值')

const washingRow = rowByName('洗水')
invariant(washingRow.samCurrentFieldKeys.includes('batchLoadCapacity'), '洗水当前阶段字段应包含单次有效装载量')
invariant(washingRow.samIdealFieldKeys.includes('batchLoadUnit'), '洗水理想完整字段应保留装载量单位')

for (const row of processCraftDictRows) {
  invariant(
    getProcessCraftDictRowByCode(row.craftCode)?.samCurrentReason === row.samCurrentReason,
    `${row.craftName}: 详情查询口径不一致`,
  )
}

console.log(
  `已校验 ${processDefinitions.length} 个工序、${processCraftDictRows.length} 个工艺的理想完整口径与当前阶段口径。`,
)
