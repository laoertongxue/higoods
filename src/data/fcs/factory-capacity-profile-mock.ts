import { getFactoryMasterRecordById, listFactoryMasterRecords } from './factory-master-store.ts'
import {
  getProcessCraftDictRowByCode,
  listCraftsByProcessCode,
  listProcessStages,
  listProcessesByStageCode,
  type ProcessCraftDictRow,
  type SamCurrentFieldKey,
} from './process-craft-dict.ts'
import { getFactorySupplyFormulaTemplate, type FactorySupplyFormulaTemplate } from './process-craft-sam-explainer.ts'
import { getSamBusinessFieldLabel } from './sam-field-display.ts'
import type {
  Factory,
  FactoryCapacityEntry,
  FactoryCapacityFieldValue,
  FactoryCapacityProfile,
} from './factory-types.ts'

export interface FactoryCapacityResolvedEntry {
  row: ProcessCraftDictRow
  entry: FactoryCapacityEntry
}

export interface FactoryCapacityComputationLine {
  label: string
  expression: string
  result: number | null
}

export interface FactoryCapacityComputedResult {
  template: FactorySupplyFormulaTemplate
  missingFieldKeys: SamCurrentFieldKey[]
  resultValue: number | null
  lines: FactoryCapacityComputationLine[]
}

export type FactoryCapacityAuditIssueCategory =
  | 'DECLARED_CRAFT_ROW_MISSING'
  | 'DECLARED_PROCESS_MISMATCH'
  | 'MISSING_ENTRY'
  | 'UNEXPECTED_ENTRY'
  | 'MISSING_CURRENT_FIELDS'
  | 'UNEXPECTED_CURRENT_FIELDS'
  | 'CALCULATION_UNAVAILABLE'

export interface FactoryCapacityAuditIssue {
  category: FactoryCapacityAuditIssueCategory
  factoryId: string
  factoryName: string
  processCode: string
  processName: string
  craftCode: string
  craftName: string
  detail: string
}

function cloneEntry(entry: FactoryCapacityEntry): FactoryCapacityEntry {
  return {
    processCode: entry.processCode,
    craftCode: entry.craftCode,
    values: { ...entry.values },
    note: entry.note,
  }
}

function cloneProfile(profile: FactoryCapacityProfile): FactoryCapacityProfile {
  return {
    factoryId: profile.factoryId,
    entries: profile.entries.map((entry) => cloneEntry(entry)),
  }
}

function createEmptyProfile(factoryId: string): FactoryCapacityProfile {
  return {
    factoryId,
    entries: [],
  }
}

function resolveFactorySupportedCraftRows(factory: Factory): ProcessCraftDictRow[] {
  return listProcessStages().flatMap((stage) =>
    listProcessesByStageCode(stage.stageCode).flatMap((process) => {
      const ability = factory.processAbilities.find((item) => item.processCode === process.processCode)
      if (!ability) return []
      const craftSet = new Set(ability.craftCodes)
      return listCraftsByProcessCode(process.processCode)
        .filter((craft) => craftSet.has(craft.craftCode))
        .map((craft) => getProcessCraftDictRowByCode(craft.craftCode))
        .filter((row): row is ProcessCraftDictRow => Boolean(row))
    }),
  )
}

function getBaseSeed(factoryId: string, craftCode: string): number {
  return [...`${factoryId}-${craftCode}`].reduce((total, char) => total + char.charCodeAt(0), 0)
}

function buildDefaultFieldValue(
  key: SamCurrentFieldKey,
  row: ProcessCraftDictRow,
  factoryId: string,
): FactoryCapacityFieldValue {
  const seed = getBaseSeed(factoryId, row.craftCode)

  switch (key) {
    case 'deviceCount':
      return 2 + (seed % 6)
    case 'deviceShiftMinutes':
      return 480 + (seed % 2) * 60
    case 'deviceEfficiencyValue':
      if (row.samCalcMode === 'BATCH') return Number((0.7 + (seed % 4) * 0.05).toFixed(2))
      if (row.samCalcMode === 'CONTINUOUS') return Number((0.72 + (seed % 6) * 0.03).toFixed(2))
      return Number((0.68 + (seed % 7) * 0.04).toFixed(2))
    case 'staffCount':
      return 4 + (seed % 9)
    case 'staffShiftMinutes':
      return 420 + (seed % 2) * 60
    case 'staffEfficiencyValue':
      if (row.samCalcMode === 'BATCH') return Number((0.75 + (seed % 5) * 0.03).toFixed(2))
      if (row.samCalcMode === 'CONTINUOUS') return Number((0.78 + (seed % 4) * 0.03).toFixed(2))
      return Number((0.8 + (seed % 4) * 0.03).toFixed(2))
    case 'batchLoadCapacity':
      return 100 + (seed % 90)
    case 'cycleMinutes':
      return 90 + (seed % 70)
    case 'setupMinutes':
      return 15 + (seed % 20)
    case 'switchMinutes':
      return 10 + (seed % 15)
    case 'efficiencyFactor':
      return Number((0.86 + (seed % 8) * 0.02).toFixed(2))
    default:
      return ''
  }
}

function buildDefaultValues(
  fieldKeys: SamCurrentFieldKey[],
  row: ProcessCraftDictRow,
  factoryId: string,
): Partial<Record<SamCurrentFieldKey, FactoryCapacityFieldValue>> {
  return fieldKeys.reduce<Partial<Record<SamCurrentFieldKey, FactoryCapacityFieldValue>>>((result, key) => {
    result[key] = buildDefaultFieldValue(key, row, factoryId)
    return result
  }, {})
}

function normalizeEntry(
  existingEntry: FactoryCapacityEntry | undefined,
  row: ProcessCraftDictRow,
  factoryId: string,
): FactoryCapacityEntry {
  const baseValues = buildDefaultValues(row.samCurrentFieldKeys, row, factoryId)
  const existingValues = existingEntry?.values ?? {}
  const nextValues = row.samCurrentFieldKeys.reduce<Partial<Record<SamCurrentFieldKey, FactoryCapacityFieldValue>>>(
    (result, key) => {
      result[key] = hasCapacityFieldValue(existingValues[key]) ? existingValues[key] : baseValues[key]
      return result
    },
    {},
  )

  return {
    processCode: row.processCode,
    craftCode: row.craftCode,
    values: nextValues,
    note: existingEntry?.note ?? `${row.craftName} 当前按平台默认口径维护。`,
  }
}

const profilesByFactoryId = new Map<string, FactoryCapacityProfile>()

function pruneOrphanProfiles(): void {
  const activeFactoryIds = new Set(listFactoryMasterRecords().map((factory) => factory.id))
  ;[...profilesByFactoryId.keys()].forEach((factoryId) => {
    if (!activeFactoryIds.has(factoryId)) {
      profilesByFactoryId.delete(factoryId)
    }
  })
}

function ensureProfile(factoryId: string): FactoryCapacityProfile {
  pruneOrphanProfiles()
  const factory = getFactoryMasterRecordById(factoryId)
  if (!factory) {
    throw new Error(`未找到工厂主数据：${factoryId}`)
  }

  const supportedRows = resolveFactorySupportedCraftRows(factory)
  const current = profilesByFactoryId.get(factoryId) ?? createEmptyProfile(factoryId)
  const existingEntryMap = new Map(current.entries.map((entry) => [`${entry.processCode}:${entry.craftCode}`, entry]))

  const next: FactoryCapacityProfile = {
    factoryId,
    entries: supportedRows.map((row) => normalizeEntry(existingEntryMap.get(`${row.processCode}:${row.craftCode}`), row, factoryId)),
  }

  profilesByFactoryId.set(factoryId, cloneProfile(next))
  return cloneProfile(next)
}

export function listFactoryCapacityProfiles(): FactoryCapacityProfile[] {
  pruneOrphanProfiles()
  return listFactoryMasterRecords().map((factory) => ensureProfile(factory.id))
}

export function getFactoryCapacityProfileByFactoryId(factoryId: string): FactoryCapacityProfile {
  return ensureProfile(factoryId)
}

export function listFactoryCapacityProfileStoreIds(): string[] {
  pruneOrphanProfiles()
  return [...profilesByFactoryId.keys()].sort((left, right) => left.localeCompare(right))
}

export function listFactoryCapacitySupportedCraftRows(factoryId: string): ProcessCraftDictRow[] {
  const factory = getFactoryMasterRecordById(factoryId)
  if (!factory) return []
  return resolveFactorySupportedCraftRows(factory)
}

export function listFactoryCapacityEntries(factoryId: string): FactoryCapacityResolvedEntry[] {
  const profile = ensureProfile(factoryId)
  const entryMap = new Map(profile.entries.map((entry) => [`${entry.processCode}:${entry.craftCode}`, entry]))

  return listFactoryCapacitySupportedCraftRows(factoryId)
    .map((row) => {
      const entry = entryMap.get(`${row.processCode}:${row.craftCode}`)
      if (!entry) return null
      return {
        row,
        entry: cloneEntry(entry),
      }
    })
    .filter((item): item is FactoryCapacityResolvedEntry => Boolean(item))
}

function getNumericValue(
  values: Partial<Record<SamCurrentFieldKey, FactoryCapacityFieldValue>>,
  key: SamCurrentFieldKey,
): number | null {
  const value = values[key]
  if (value === undefined || value === null || String(value).trim() === '') return null
  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? numericValue : null
}

function formatResultNumber(value: number): string {
  return Number(value.toFixed(2)).toString()
}

function formatNamedNumber(key: SamCurrentFieldKey, value: number): string {
  return `${getSamBusinessFieldLabel(key)}（${formatResultNumber(value)}）`
}

export function computeFactoryCapacityEntryResult(
  row: ProcessCraftDictRow,
  values: Partial<Record<SamCurrentFieldKey, FactoryCapacityFieldValue>>,
): FactoryCapacityComputedResult {
  const template = getFactorySupplyFormulaTemplate(row.craftName)
  const missingFieldKeys = row.samCurrentFieldKeys.filter((key) => getNumericValue(values, key) === null)
  if (missingFieldKeys.length) {
    return {
      template,
      missingFieldKeys,
      resultValue: null,
      lines: [
        {
          label: '待补充字段',
          expression: `请先补齐：${missingFieldKeys.map((key) => getSamBusinessFieldLabel(key)).join('、')}`,
          result: null,
        },
      ],
    }
  }

  const efficiencyFactor = getNumericValue(values, 'efficiencyFactor') ?? 1

  if (template === 'A') {
    const staffCount = getNumericValue(values, 'staffCount') ?? 0
    const staffShiftMinutes = getNumericValue(values, 'staffShiftMinutes') ?? 0
    const staffEfficiencyValue = getNumericValue(values, 'staffEfficiencyValue') ?? 0
    const baseCapacity = staffCount * staffShiftMinutes * staffEfficiencyValue
    const resultValue = baseCapacity * efficiencyFactor

    return {
      template,
      missingFieldKeys,
      resultValue,
      lines: [
        {
          label: '基础日能力',
          expression: `${formatNamedNumber('staffCount', staffCount)} × ${formatNamedNumber('staffShiftMinutes', staffShiftMinutes)} × ${formatNamedNumber('staffEfficiencyValue', staffEfficiencyValue)}`,
          result: baseCapacity,
        },
        {
          label: '默认日可供给发布工时 SAM',
          expression: `基础日能力（${formatResultNumber(baseCapacity)}）× ${formatNamedNumber('efficiencyFactor', efficiencyFactor)}`,
          result: resultValue,
        },
      ],
    }
  }

  if (template === 'D') {
    const deviceCount = getNumericValue(values, 'deviceCount') ?? 0
    const deviceShiftMinutes = getNumericValue(values, 'deviceShiftMinutes') ?? 0
    const batchLoadCapacity = getNumericValue(values, 'batchLoadCapacity') ?? 0
    const cycleMinutes = getNumericValue(values, 'cycleMinutes') ?? 0
    const staffCount = getNumericValue(values, 'staffCount') ?? 0
    const staffShiftMinutes = getNumericValue(values, 'staffShiftMinutes') ?? 0
    const staffEfficiencyValue = getNumericValue(values, 'staffEfficiencyValue') ?? 0
    const setupMinutes = getNumericValue(values, 'setupMinutes') ?? 0
    const switchMinutes = getNumericValue(values, 'switchMinutes') ?? 0

    const deviceBatchCount = cycleMinutes === 0 ? 0 : deviceShiftMinutes / cycleMinutes
    const deviceCapacity = deviceBatchCount * batchLoadCapacity * deviceCount
    const staffCapacity = staffCount * staffShiftMinutes * staffEfficiencyValue
    const baseCapacity = Math.min(deviceCapacity, staffCapacity)
    const resultValue = (baseCapacity - setupMinutes - switchMinutes) * efficiencyFactor

    return {
      template,
      missingFieldKeys,
      resultValue,
      lines: [
        {
          label: '单台默认日可运行批数',
          expression: `${formatNamedNumber('deviceShiftMinutes', deviceShiftMinutes)} ÷ ${formatNamedNumber('cycleMinutes', cycleMinutes)}`,
          result: deviceBatchCount,
        },
        {
          label: '设备侧日能力',
          expression: `单台默认日可运行批数（${formatResultNumber(deviceBatchCount)}）× ${formatNamedNumber('batchLoadCapacity', batchLoadCapacity)} × ${formatNamedNumber('deviceCount', deviceCount)}`,
          result: deviceCapacity,
        },
        {
          label: '人员侧日能力',
          expression: `${formatNamedNumber('staffCount', staffCount)} × ${formatNamedNumber('staffShiftMinutes', staffShiftMinutes)} × ${formatNamedNumber('staffEfficiencyValue', staffEfficiencyValue)}`,
          result: staffCapacity,
        },
        {
          label: '基础日能力',
          expression: `设备侧日能力（${formatResultNumber(deviceCapacity)}）和人员侧日能力（${formatResultNumber(staffCapacity)}）里较小的那个`,
          result: baseCapacity,
        },
        {
          label: '默认日可供给发布工时 SAM',
          expression: `（基础日能力（${formatResultNumber(baseCapacity)}） - ${formatNamedNumber('setupMinutes', setupMinutes)} - ${formatNamedNumber('switchMinutes', switchMinutes)}）× ${formatNamedNumber('efficiencyFactor', efficiencyFactor)}`,
          result: resultValue,
        },
      ],
    }
  }

  const deviceCount = getNumericValue(values, 'deviceCount') ?? 0
  const deviceShiftMinutes = getNumericValue(values, 'deviceShiftMinutes') ?? 0
  const deviceEfficiencyValue = getNumericValue(values, 'deviceEfficiencyValue') ?? 0
  const staffCount = getNumericValue(values, 'staffCount') ?? 0
  const staffShiftMinutes = getNumericValue(values, 'staffShiftMinutes') ?? 0
  const staffEfficiencyValue = getNumericValue(values, 'staffEfficiencyValue') ?? 0
  const setupMinutes = getNumericValue(values, 'setupMinutes') ?? 0
  const switchMinutes = getNumericValue(values, 'switchMinutes') ?? 0

  const deviceCapacity = deviceCount * deviceShiftMinutes * deviceEfficiencyValue
  const staffCapacity = staffCount * staffShiftMinutes * staffEfficiencyValue
  const baseCapacity = Math.min(deviceCapacity, staffCapacity)
  const resultValue = (baseCapacity - setupMinutes - switchMinutes) * efficiencyFactor

  return {
    template,
    missingFieldKeys,
    resultValue,
    lines: [
      {
        label: '设备侧日能力',
        expression: `${formatNamedNumber('deviceCount', deviceCount)} × ${formatNamedNumber('deviceShiftMinutes', deviceShiftMinutes)} × ${formatNamedNumber('deviceEfficiencyValue', deviceEfficiencyValue)}`,
        result: deviceCapacity,
      },
      {
        label: '人员侧日能力',
        expression: `${formatNamedNumber('staffCount', staffCount)} × ${formatNamedNumber('staffShiftMinutes', staffShiftMinutes)} × ${formatNamedNumber('staffEfficiencyValue', staffEfficiencyValue)}`,
        result: staffCapacity,
      },
      {
        label: '基础日能力',
        expression: `设备侧日能力（${formatResultNumber(deviceCapacity)}）和人员侧日能力（${formatResultNumber(staffCapacity)}）里较小的那个`,
        result: baseCapacity,
      },
      {
        label: '默认日可供给发布工时 SAM',
        expression: `（基础日能力（${formatResultNumber(baseCapacity)}） - ${formatNamedNumber('setupMinutes', setupMinutes)} - ${formatNamedNumber('switchMinutes', switchMinutes)}）× ${formatNamedNumber('efficiencyFactor', efficiencyFactor)}`,
        result: resultValue,
      },
    ],
  }
}

export function updateFactoryCapacityEntryValue(
  factoryId: string,
  processCode: string,
  craftCode: string,
  fieldKey: SamCurrentFieldKey,
  value: FactoryCapacityFieldValue,
): void {
  const profile = ensureProfile(factoryId)
  const next = cloneProfile(profile)
  const entry = next.entries.find((item) => item.processCode === processCode && item.craftCode === craftCode)
  if (!entry) return
  entry.values[fieldKey] = value
  profilesByFactoryId.set(factoryId, cloneProfile(next))
}

export function updateFactoryCapacityEntryNote(
  factoryId: string,
  processCode: string,
  craftCode: string,
  note: string,
): void {
  const profile = ensureProfile(factoryId)
  const next = cloneProfile(profile)
  const entry = next.entries.find((item) => item.processCode === processCode && item.craftCode === craftCode)
  if (!entry) return
  entry.note = note
  profilesByFactoryId.set(factoryId, cloneProfile(next))
}

export function hasCapacityFieldValue(
  value: FactoryCapacityFieldValue | undefined,
): boolean {
  return value !== undefined && value !== null && String(value).trim() !== ''
}

export function calculateFactoryCapacityCompletion(factoryId: string): number {
  const entries = listFactoryCapacityEntries(factoryId)
  let totalFields = 0
  let filledFields = 0

  entries.forEach(({ row, entry }) => {
    row.samCurrentFieldKeys.forEach((fieldKey) => {
      totalFields += 1
      if (hasCapacityFieldValue(entry.values[fieldKey])) {
        filledFields += 1
      }
    })
  })

  if (!totalFields) return 0
  return Math.round((filledFields / totalFields) * 100)
}

export function auditFactoryCapacityProfile(factoryId: string): FactoryCapacityAuditIssue[] {
  const factory = getFactoryMasterRecordById(factoryId)
  if (!factory) return []

  const profile = ensureProfile(factoryId)
  const issues: FactoryCapacityAuditIssue[] = []
  const supportedRows = resolveFactorySupportedCraftRows(factory)
  const supportedPairs = new Set(supportedRows.map((row) => `${row.processCode}:${row.craftCode}`))
  const entryMap = new Map(profile.entries.map((entry) => [`${entry.processCode}:${entry.craftCode}`, entry]))

  factory.processAbilities.forEach((ability) => {
    ability.craftCodes.forEach((craftCode) => {
      const row = getProcessCraftDictRowByCode(craftCode)
      if (!row) {
        issues.push({
          category: 'DECLARED_CRAFT_ROW_MISSING',
          factoryId: factory.id,
          factoryName: factory.name,
          processCode: ability.processCode,
          processName: ability.processCode,
          craftCode,
          craftName: craftCode,
          detail: '工厂档案已声明该工艺，但字典行不存在，页面无法继续渲染。',
        })
        return
      }

      if (row.processCode !== ability.processCode) {
        issues.push({
          category: 'DECLARED_PROCESS_MISMATCH',
          factoryId: factory.id,
          factoryName: factory.name,
          processCode: ability.processCode,
          processName: row.processName,
          craftCode: row.craftCode,
          craftName: row.craftName,
          detail: '工厂档案中的工艺归属工序与字典定义不一致。',
        })
      }

      if (!supportedPairs.has(`${row.processCode}:${row.craftCode}`)) {
        issues.push({
          category: 'DECLARED_CRAFT_ROW_MISSING',
          factoryId: factory.id,
          factoryName: factory.name,
          processCode: row.processCode,
          processName: row.processName,
          craftCode: row.craftCode,
          craftName: row.craftName,
          detail: '工厂档案已声明该工艺，但产能档案支持范围未能解析出该工艺。',
        })
      }
    })
  })

  supportedRows.forEach((row) => {
    const pair = `${row.processCode}:${row.craftCode}`
    const entry = entryMap.get(pair)
    if (!entry) {
      issues.push({
        category: 'MISSING_ENTRY',
        factoryId: factory.id,
        factoryName: factory.name,
        processCode: row.processCode,
        processName: row.processName,
        craftCode: row.craftCode,
        craftName: row.craftName,
        detail: '工厂档案已声明该工艺，但产能档案当前阶段维护记录缺失。',
      })
      return
    }

    const actualKeys = Object.keys(entry.values) as SamCurrentFieldKey[]
    const missingKeys = row.samCurrentFieldKeys.filter((key) => !actualKeys.includes(key))
    const unexpectedKeys = actualKeys.filter((key) => !row.samCurrentFieldKeys.includes(key))

    if (missingKeys.length) {
      issues.push({
        category: 'MISSING_CURRENT_FIELDS',
        factoryId: factory.id,
        factoryName: factory.name,
        processCode: row.processCode,
        processName: row.processName,
        craftCode: row.craftCode,
        craftName: row.craftName,
        detail: `当前阶段记录缺少字段：${missingKeys.join(', ')}`,
      })
    }

    if (unexpectedKeys.length) {
      issues.push({
        category: 'UNEXPECTED_CURRENT_FIELDS',
        factoryId: factory.id,
        factoryName: factory.name,
        processCode: row.processCode,
        processName: row.processName,
        craftCode: row.craftCode,
        craftName: row.craftName,
        detail: `当前阶段记录出现了不属于该工艺的字段：${unexpectedKeys.join(', ')}`,
      })
    }

    const result = computeFactoryCapacityEntryResult(row, entry.values)
    if (result.resultValue === null) {
      issues.push({
        category: 'CALCULATION_UNAVAILABLE',
        factoryId: factory.id,
        factoryName: factory.name,
        processCode: row.processCode,
        processName: row.processName,
        craftCode: row.craftCode,
        craftName: row.craftName,
        detail: `当前阶段结果无法计算，缺少字段：${result.missingFieldKeys.join(', ')}`,
      })
    }
  })

  profile.entries.forEach((entry) => {
    const pair = `${entry.processCode}:${entry.craftCode}`
    if (!supportedPairs.has(pair)) {
      const row = getProcessCraftDictRowByCode(entry.craftCode)
      issues.push({
        category: 'UNEXPECTED_ENTRY',
        factoryId: factory.id,
        factoryName: factory.name,
        processCode: row?.processCode ?? entry.processCode,
        processName: row?.processName ?? entry.processCode,
        craftCode: entry.craftCode,
        craftName: row?.craftName ?? entry.craftCode,
        detail: '产能档案出现了不在工厂档案能力范围内的工艺记录。',
      })
    }
  })

  return issues
}

export function auditAllFactoryCapacityProfiles(): FactoryCapacityAuditIssue[] {
  return listFactoryMasterRecords().flatMap((factory) => auditFactoryCapacityProfile(factory.id))
}
