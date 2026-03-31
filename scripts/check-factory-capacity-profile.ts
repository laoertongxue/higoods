import {
  auditAllFactoryCapacityProfiles,
  computeFactoryCapacityEntryResult,
  listFactoryCapacityEntries,
  listFactoryCapacityProfiles,
  listFactoryCapacityProfileStoreIds,
  listFactoryCapacitySupportedCraftRows,
} from '../src/data/fcs/factory-capacity-profile-mock.ts'
import { listFactoryMasterRecords } from '../src/data/fcs/factory-master-store.ts'
import { processCraftDictRows } from '../src/data/fcs/process-craft-dict.ts'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

const factories = listFactoryMasterRecords()
const profiles = listFactoryCapacityProfiles()
const profileStoreIds = listFactoryCapacityProfileStoreIds()
const auditIssues = auditAllFactoryCapacityProfiles()
const craftCoverage = new Map<string, Set<string>>()

assert(factories.length === profiles.length, '产能档案数量必须与工厂主数据数量一致')
assert(
  auditIssues.length === 0,
  `产能档案存在一致性问题：\n${auditIssues
    .map(
      (issue) =>
        `- [${issue.category}] ${issue.factoryName} / ${issue.processName} / ${issue.craftName}：${issue.detail}`,
    )
    .join('\n')}`,
)

profiles.forEach((profile) => {
  assert('entries' in profile, `${profile.factoryId} 缺少 entries 结构`)
  assert(!('shiftCalendars' in (profile as Record<string, unknown>)), `${profile.factoryId} 仍残留 shiftCalendars`)
  assert(
    !('processCraftDeviceRecords' in (profile as Record<string, unknown>)),
    `${profile.factoryId} 仍残留 processCraftDeviceRecords`,
  )
  assert(
    !('processCraftStaffRecords' in (profile as Record<string, unknown>)),
    `${profile.factoryId} 仍残留 processCraftStaffRecords`,
  )
  assert(
    !('processCraftAdjustmentRecords' in (profile as Record<string, unknown>)),
    `${profile.factoryId} 仍残留 processCraftAdjustmentRecords`,
  )
  assert(
    !('calibrationRecords' in (profile as Record<string, unknown>)),
    `${profile.factoryId} 仍残留 calibrationRecords`,
  )

  const supportedRows = listFactoryCapacitySupportedCraftRows(profile.factoryId)
  const entries = listFactoryCapacityEntries(profile.factoryId)

  assert(entries.length === supportedRows.length, `${profile.factoryId} 的 entries 数量与支持工艺数量不一致`)

  entries.forEach(({ row, entry }) => {
    const actualKeys = Object.keys(entry.values).sort()
    const expectedKeys = [...row.samCurrentFieldKeys].sort()
    assert(
      JSON.stringify(actualKeys) === JSON.stringify(expectedKeys),
      `${row.craftName} 当前阶段字段与字典 samCurrentFieldKeys 不一致`,
    )
    assert(
      !('defaultDailyPublishedSam' in (entry as Record<string, unknown>)),
      `${row.craftName} 不应把默认日可供给发布工时 SAM 作为人工录入字段存储`,
    )

    const result = computeFactoryCapacityEntryResult(row, entry.values)
    assert(result.resultValue !== null, `${row.craftName} 当前阶段结果无法自动计算`)

    if (!craftCoverage.has(row.craftCode)) {
      craftCoverage.set(row.craftCode, new Set())
    }
    craftCoverage.get(row.craftCode)?.add(profile.factoryId)
  })
})

assert(
  profileStoreIds.length === profiles.length,
  '产能档案缓存数量必须与当前 profile 数量一致',
)

const missingCrafts = processCraftDictRows.filter((row) => !craftCoverage.has(row.craftCode))
assert(
  missingCrafts.length === 0,
  `存在未进入任何产能档案的工艺：${missingCrafts.map((row) => row.craftName).join('、')}`,
)

const coverageSummary = factories
  .map((factory) => ({
    id: factory.id,
    name: factory.name,
    craftCount: listFactoryCapacitySupportedCraftRows(factory.id).length,
  }))
  .sort((left, right) => right.craftCount - left.craftCount)

assert(
  coverageSummary[0]?.craftCount < processCraftDictRows.length,
  '存在单一工厂覆盖全部工艺，违反多工厂分布要求',
)

assert(
  coverageSummary.filter((item) => item.craftCount > 0).length > 1,
  '工艺覆盖没有分布到多个工厂',
)

console.log(
  JSON.stringify(
    {
      factoryCount: factories.length,
      profileCount: profiles.length,
      craftCount: processCraftDictRows.length,
      auditIssueCount: auditIssues.length,
      topCoverageFactory: coverageSummary[0],
    },
    null,
    2,
  ),
)
