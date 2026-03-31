import {
  ADJUSTMENT_FIELD_KEYS,
  DEVICE_FIELD_KEYS,
  STAFF_FIELD_KEYS,
  listFactoryCapacityProfiles,
  listFactoryCapacitySupportedCraftRows,
} from '../src/data/fcs/factory-capacity-profile-mock.ts'
import { listFactoryMasterRecords } from '../src/data/fcs/factory-master-store.ts'
import {
  getProcessCraftDictRowByCode,
  processCraftDictRows,
  type SamFactoryFieldKey,
} from '../src/data/fcs/process-craft-dict.ts'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function asSortedList(values: Iterable<string>): string[] {
  return [...values].sort((left, right) => left.localeCompare(right))
}

function checkRecordKeys(
  values: Partial<Record<SamFactoryFieldKey, number | string>>,
  allowedKeys: SamFactoryFieldKey[],
  label: string,
): void {
  const actualKeys = Object.keys(values) as SamFactoryFieldKey[]
  const illegalKeys = actualKeys.filter((key) => !allowedKeys.includes(key))
  assert(
    illegalKeys.length === 0,
    `${label} 存在不属于当前字段分组的 key：${illegalKeys.join(', ')}`,
  )
}

const factories = listFactoryMasterRecords()
const profiles = listFactoryCapacityProfiles()
const masterIds = new Set(factories.map((factory) => factory.id))
const forbiddenFactoryFields = ['name', 'factoryName', 'factoryType', 'status', 'contact', 'processAbilities']
const craftCoverage = new Map<string, Set<string>>()

assert(factories.length === profiles.length, '产能档案数量必须与工厂主数据数量一致')

profiles.forEach((profile) => {
  assert(masterIds.has(profile.factoryId), `产能档案引用了不存在的工厂：${profile.factoryId}`)

  forbiddenFactoryFields.forEach((field) => {
    assert(!(field in (profile as Record<string, unknown>)), `产能档案重复维护了工厂主数据字段：${field}`)
  })

  const supportedRows = listFactoryCapacitySupportedCraftRows(profile.factoryId)
  const devicePairs = new Set(profile.processCraftDeviceRecords.map((item) => `${item.processCode}:${item.craftCode}`))
  const staffPairs = new Set(profile.processCraftStaffRecords.map((item) => `${item.processCode}:${item.craftCode}`))
  const adjustmentPairs = new Set(
    profile.processCraftAdjustmentRecords.map((item) => `${item.processCode}:${item.craftCode}`),
  )

  supportedRows.forEach((row) => {
    if (!craftCoverage.has(row.craftCode)) {
      craftCoverage.set(row.craftCode, new Set())
    }
    craftCoverage.get(row.craftCode)?.add(profile.factoryId)

    const recordKey = `${row.processCode}:${row.craftCode}`
    const deviceKeys = row.samFactoryFieldKeys.filter((key) => DEVICE_FIELD_KEYS.includes(key))
    const staffKeys = row.samFactoryFieldKeys.filter((key) => STAFF_FIELD_KEYS.includes(key))
    const adjustmentKeys = row.samFactoryFieldKeys.filter((key) => ADJUSTMENT_FIELD_KEYS.includes(key))

    if (deviceKeys.length) {
      assert(devicePairs.has(recordKey), `${row.craftName} 缺少设备台账记录`)
      const record = profile.processCraftDeviceRecords.find((item) => `${item.processCode}:${item.craftCode}` === recordKey)
      assert(record, `${row.craftName} 缺少设备台账值`)
      checkRecordKeys(record.values, deviceKeys, `${row.craftName} 设备台账`)
    }

    if (staffKeys.length) {
      assert(staffPairs.has(recordKey), `${row.craftName} 缺少人员台账记录`)
      const record = profile.processCraftStaffRecords.find((item) => `${item.processCode}:${item.craftCode}` === recordKey)
      assert(record, `${row.craftName} 缺少人员台账值`)
      checkRecordKeys(record.values, staffKeys, `${row.craftName} 人员台账`)
    }

    if (adjustmentKeys.length) {
      assert(adjustmentPairs.has(recordKey), `${row.craftName} 缺少工时修正记录`)
      const record = profile.processCraftAdjustmentRecords.find((item) => `${item.processCode}:${item.craftCode}` === recordKey)
      assert(record, `${row.craftName} 缺少工时修正值`)
      checkRecordKeys(record.values, adjustmentKeys, `${row.craftName} 工时修正`)
    }
  })
})

const missingCrafts = processCraftDictRows
  .filter((row) => !craftCoverage.has(row.craftCode))
  .map((row) => `${row.processName} / ${row.craftName}`)

assert(missingCrafts.length === 0, `存在未进入任何产能档案维护入口的工艺：${missingCrafts.join('；')}`)

const baseConnectRow = processCraftDictRows.find((row) => row.craftName === '基础连接')
assert(baseConnectRow, '工序工艺字典缺少基础连接工艺')
assert(baseConnectRow.processCode === 'SEW', '基础连接必须归属车缝工序')
assert(baseConnectRow.samConstraintSource === 'STAFF', '基础连接必须继承车缝人员约束规则')

const factoriesWithBaseConnectAbility = factories.filter((factory) =>
  factory.processAbilities.some(
    (ability) =>
      ability.processCode === 'SEW' &&
      ability.craftCodes.includes(baseConnectRow.craftCode) &&
      ability.craftCodes.every((craftCode) => Boolean(getProcessCraftDictRowByCode(craftCode))),
  ),
)
assert(factoriesWithBaseConnectAbility.length > 0, '至少应有一个合理的车缝工厂具备基础连接能力')

profiles.forEach((profile) => {
  const hasBaseConnectRecord =
    profile.processCraftDeviceRecords.some((item) => item.craftCode === baseConnectRow.craftCode) ||
    profile.processCraftStaffRecords.some((item) => item.craftCode === baseConnectRow.craftCode) ||
    profile.processCraftAdjustmentRecords.some((item) => item.craftCode === baseConnectRow.craftCode)

  const factoryHasBaseConnectAbility = factoriesWithBaseConnectAbility.some((factory) => factory.id === profile.factoryId)
  assert(
    hasBaseConnectRecord === factoryHasBaseConnectAbility,
    `${profile.factoryId} 的基础连接产能记录与工厂档案能力声明不一致`,
  )
})

const coverageSummary = factories
  .map((factory) => ({
    id: factory.id,
    name: factory.name,
    craftCount: listFactoryCapacitySupportedCraftRows(factory.id).length,
  }))
  .sort((left, right) => right.craftCount - left.craftCount)

assert(
  coverageSummary[0]?.craftCount < processCraftDictRows.length,
  '存在单一工厂覆盖了全部工序工艺，违反多工厂分布要求',
)

assert(
  coverageSummary.filter((item) => item.craftCount > 0).length > 1,
  '产能档案工艺覆盖没有分布到多个工厂',
)

console.log(
  JSON.stringify(
    {
      factoryCount: factories.length,
      profileCount: profiles.length,
      craftCount: processCraftDictRows.length,
      fullyCoveredCraftCodes: asSortedList(craftCoverage.keys()),
      topCoverageFactory: coverageSummary[0],
    },
    null,
    2,
  ),
)
