import { getFactoryMasterRecordById, listFactoryMasterRecords } from './factory-master-store.ts'
import {
  getProcessCraftDictRowByCode,
  listCraftsByProcessCode,
  listProcessStages,
  listProcessesByStageCode,
  type ProcessCraftDictRow,
  type SamCalcMode,
  type SamFactoryFieldKey,
  type SamInputUnit,
} from './process-craft-dict.ts'
import type {
  CalibrationRecord,
  Factory,
  FactoryCapacityFieldValue,
  FactoryCapacityProfile,
  ProcessCraftAdjustmentRecord,
  ProcessCraftDeviceRecord,
  ProcessCraftStaffRecord,
  ShiftCalendarRecord,
} from './factory-types.ts'

export type CapacityRecordScope = 'device' | 'staff' | 'adjustment'

const DEVICE_FIELD_KEYS: SamFactoryFieldKey[] = [
  'deviceCount',
  'deviceShiftMinutes',
  'deviceEfficiencyValue',
  'deviceEfficiencyUnit',
  'batchLoadCapacity',
  'batchLoadUnit',
  'cycleMinutes',
]

const STAFF_FIELD_KEYS: SamFactoryFieldKey[] = [
  'staffCount',
  'staffShiftMinutes',
  'staffEfficiencyValue',
  'staffEfficiencyUnit',
]

const ADJUSTMENT_FIELD_KEYS: SamFactoryFieldKey[] = ['setupMinutes', 'switchMinutes', 'efficiencyFactor']

const UNIT_FIELD_KEYS = new Set<SamFactoryFieldKey>([
  'deviceEfficiencyUnit',
  'staffEfficiencyUnit',
  'batchLoadUnit',
])

function cloneValues(values: Partial<Record<SamFactoryFieldKey, FactoryCapacityFieldValue>>) {
  return { ...values }
}

function cloneProfile(profile: FactoryCapacityProfile): FactoryCapacityProfile {
  return {
    factoryId: profile.factoryId,
    shiftCalendars: profile.shiftCalendars.map((item) => ({ ...item })),
    processCraftDeviceRecords: profile.processCraftDeviceRecords.map((item) => ({
      processCode: item.processCode,
      craftCode: item.craftCode,
      values: cloneValues(item.values),
    })),
    processCraftStaffRecords: profile.processCraftStaffRecords.map((item) => ({
      processCode: item.processCode,
      craftCode: item.craftCode,
      values: cloneValues(item.values),
    })),
    processCraftAdjustmentRecords: profile.processCraftAdjustmentRecords.map((item) => ({
      processCode: item.processCode,
      craftCode: item.craftCode,
      values: cloneValues(item.values),
    })),
    calibrationRecords: profile.calibrationRecords.map((item) => ({ ...item })),
  }
}

function filterFieldKeysByScope(
  keys: SamFactoryFieldKey[],
  scope: CapacityRecordScope,
): SamFactoryFieldKey[] {
  const allowedKeys =
    scope === 'device' ? DEVICE_FIELD_KEYS : scope === 'staff' ? STAFF_FIELD_KEYS : ADJUSTMENT_FIELD_KEYS
  return keys.filter((key) => allowedKeys.includes(key))
}

function getBaseSeed(factoryId: string, craftCode: string): number {
  return [...`${factoryId}-${craftCode}`].reduce((total, char) => total + char.charCodeAt(0), 0)
}

function getEfficiencyUnitLabel(
  inputUnit: SamInputUnit,
  calcMode: SamCalcMode,
  scope: 'device' | 'staff',
): string {
  if (calcMode === 'BATCH') {
    return scope === 'device' ? '批/班' : '批/人班'
  }

  if (inputUnit === 'METER') {
    return scope === 'device' ? '米/分钟' : '米/小时'
  }

  if (inputUnit === 'KG') {
    return scope === 'device' ? '公斤/批' : '公斤/小时'
  }

  return scope === 'device' ? '件/小时' : '件/小时'
}

function getBatchLoadUnitLabel(inputUnit: SamInputUnit): string {
  if (inputUnit === 'METER') return '米/批'
  if (inputUnit === 'PIECE') return '件/批'
  if (inputUnit === 'BATCH') return '批/次'
  return '公斤/批'
}

function buildDefaultFieldValue(
  key: SamFactoryFieldKey,
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
      if (row.samCalcMode === 'BATCH') return 6 + (seed % 4)
      if (row.samDefaultInputUnit === 'METER') return 12 + (seed % 10)
      if (row.samDefaultInputUnit === 'KG') return 120 + (seed % 80)
      return 55 + (seed % 35)
    case 'deviceEfficiencyUnit':
      return getEfficiencyUnitLabel(row.samDefaultInputUnit, row.samCalcMode, 'device')
    case 'staffCount':
      return 4 + (seed % 10)
    case 'staffShiftMinutes':
      return 480 + (seed % 2) * 60
    case 'staffEfficiencyValue':
      if (row.samCalcMode === 'BATCH') return 3 + (seed % 3)
      if (row.samDefaultInputUnit === 'METER') return 20 + (seed % 12)
      if (row.samDefaultInputUnit === 'KG') return 45 + (seed % 25)
      return 18 + (seed % 16)
    case 'staffEfficiencyUnit':
      return getEfficiencyUnitLabel(row.samDefaultInputUnit, row.samCalcMode, 'staff')
    case 'batchLoadCapacity':
      return row.samDefaultInputUnit === 'KG' ? 240 + (seed % 90) : 120 + (seed % 60)
    case 'batchLoadUnit':
      return getBatchLoadUnitLabel(row.samDefaultInputUnit)
    case 'cycleMinutes':
      return 90 + (seed % 80)
    case 'setupMinutes':
      return 20 + (seed % 35)
    case 'switchMinutes':
      return 10 + (seed % 25)
    case 'efficiencyFactor':
      return Number((0.82 + (seed % 12) * 0.01).toFixed(2))
    default:
      return ''
  }
}

function buildDefaultValues(
  fieldKeys: SamFactoryFieldKey[],
  row: ProcessCraftDictRow,
  factoryId: string,
): Partial<Record<SamFactoryFieldKey, FactoryCapacityFieldValue>> {
  return fieldKeys.reduce<Partial<Record<SamFactoryFieldKey, FactoryCapacityFieldValue>>>((result, key) => {
    result[key] = buildDefaultFieldValue(key, row, factoryId)
    return result
  }, {})
}

function createEmptyProfile(factoryId: string): FactoryCapacityProfile {
  return {
    factoryId,
    shiftCalendars: [],
    processCraftDeviceRecords: [],
    processCraftStaffRecords: [],
    processCraftAdjustmentRecords: [],
    calibrationRecords: [],
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

function createShiftCalendars(factory: Factory): ShiftCalendarRecord[] {
  const primaryProcessCode = factory.processAbilities[0]?.processCode ?? ''
  return [
    {
      date: '2026-04-01',
      scopeType: 'FACTORY',
      scopeCode: factory.id,
      dayShiftMinutes: 480,
      nightShiftMinutes: 0,
      isStopped: false,
      isOvertime: false,
      note: '常规白班',
    },
    {
      date: '2026-04-02',
      scopeType: primaryProcessCode ? 'PROCESS' : 'FACTORY',
      scopeCode: primaryProcessCode || factory.id,
      dayShiftMinutes: 540,
      nightShiftMinutes: 120,
      isStopped: false,
      isOvertime: true,
      note: primaryProcessCode ? '重点工序加班' : '全厂加班',
    },
    {
      date: '2026-04-05',
      scopeType: 'FACTORY',
      scopeCode: factory.id,
      dayShiftMinutes: 0,
      nightShiftMinutes: 0,
      isStopped: true,
      isOvertime: false,
      note: '设备保养停工',
    },
  ]
}

function createCalibrationRecords(factory: Factory, rows: ProcessCraftDictRow[]): CalibrationRecord[] {
  return rows.slice(0, Math.min(rows.length, 3)).map((row, index) => ({
    processCode: row.processCode,
    craftCode: row.craftCode,
    periodLabel: `2026-W${String(index + 11).padStart(2, '0')}`,
    publishedSam: Number((6 + index * 1.2 + (getBaseSeed(factory.id, row.craftCode) % 3) * 0.2).toFixed(1)),
    actualNote: `${row.craftName} 近一周期完成节奏稳定，可作为修正参考。`,
    suggestion: index % 2 === 0 ? '维持当前参数' : '建议微调准备时间与效率系数',
    adopted: index % 2 === 0,
  }))
}

const profilesByFactoryId = new Map<string, FactoryCapacityProfile>()

function ensureDeviceRecord(
  profile: FactoryCapacityProfile,
  row: ProcessCraftDictRow,
): void {
  const fieldKeys = filterFieldKeysByScope(row.samFactoryFieldKeys, 'device')
  if (!fieldKeys.length) return

  const existing = profile.processCraftDeviceRecords.find(
    (item) => item.processCode === row.processCode && item.craftCode === row.craftCode,
  )
  if (existing) return

  profile.processCraftDeviceRecords.push({
    processCode: row.processCode,
    craftCode: row.craftCode,
    values: buildDefaultValues(fieldKeys, row, profile.factoryId),
  })
}

function ensureStaffRecord(
  profile: FactoryCapacityProfile,
  row: ProcessCraftDictRow,
): void {
  const fieldKeys = filterFieldKeysByScope(row.samFactoryFieldKeys, 'staff')
  if (!fieldKeys.length) return

  const existing = profile.processCraftStaffRecords.find(
    (item) => item.processCode === row.processCode && item.craftCode === row.craftCode,
  )
  if (existing) return

  profile.processCraftStaffRecords.push({
    processCode: row.processCode,
    craftCode: row.craftCode,
    values: buildDefaultValues(fieldKeys, row, profile.factoryId),
  })
}

function ensureAdjustmentRecord(
  profile: FactoryCapacityProfile,
  row: ProcessCraftDictRow,
): void {
  const fieldKeys = filterFieldKeysByScope(row.samFactoryFieldKeys, 'adjustment')
  if (!fieldKeys.length) return

  const existing = profile.processCraftAdjustmentRecords.find(
    (item) => item.processCode === row.processCode && item.craftCode === row.craftCode,
  )
  if (existing) return

  profile.processCraftAdjustmentRecords.push({
    processCode: row.processCode,
    craftCode: row.craftCode,
    values: buildDefaultValues(fieldKeys, row, profile.factoryId),
  })
}

function ensureProfile(factoryId: string): FactoryCapacityProfile {
  const factory = getFactoryMasterRecordById(factoryId)
  if (!factory) {
    throw new Error(`未找到工厂主数据：${factoryId}`)
  }

  const current = profilesByFactoryId.get(factoryId) ?? createEmptyProfile(factoryId)
  const next = cloneProfile(current)
  const supportedRows = resolveFactorySupportedCraftRows(factory)

  supportedRows.forEach((row) => {
    ensureDeviceRecord(next, row)
    ensureStaffRecord(next, row)
    ensureAdjustmentRecord(next, row)
  })

  if (!next.shiftCalendars.length) {
    next.shiftCalendars = createShiftCalendars(factory)
  }

  if (!next.calibrationRecords.length) {
    next.calibrationRecords = createCalibrationRecords(factory, supportedRows)
  }

  profilesByFactoryId.set(factoryId, cloneProfile(next))
  return cloneProfile(next)
}

export function listFactoryCapacityProfiles(): FactoryCapacityProfile[] {
  return listFactoryMasterRecords().map((factory) => ensureProfile(factory.id))
}

export function getFactoryCapacityProfileByFactoryId(factoryId: string): FactoryCapacityProfile {
  return ensureProfile(factoryId)
}

export function upsertFactoryCapacityProfile(profile: FactoryCapacityProfile): void {
  profilesByFactoryId.set(profile.factoryId, cloneProfile(profile))
}

export function listFactoryCapacitySupportedCraftRows(factoryId: string): ProcessCraftDictRow[] {
  const factory = getFactoryMasterRecordById(factoryId)
  if (!factory) return []
  return resolveFactorySupportedCraftRows(factory)
}

export function listSamFieldKeysByCapacityScope(
  fieldKeys: SamFactoryFieldKey[],
  scope: CapacityRecordScope,
): SamFactoryFieldKey[] {
  return filterFieldKeysByScope(fieldKeys, scope)
}

function updateRecordValues(
  records: Array<ProcessCraftDeviceRecord | ProcessCraftStaffRecord | ProcessCraftAdjustmentRecord>,
  processCode: string,
  craftCode: string,
  fieldKey: SamFactoryFieldKey,
  value: FactoryCapacityFieldValue,
): void {
  const record = records.find((item) => item.processCode === processCode && item.craftCode === craftCode)
  if (!record) return
  record.values[fieldKey] = value
}

export function updateFactoryCapacityRecordValue(
  factoryId: string,
  scope: CapacityRecordScope,
  processCode: string,
  craftCode: string,
  fieldKey: SamFactoryFieldKey,
  value: FactoryCapacityFieldValue,
): void {
  const profile = ensureProfile(factoryId)

  if (scope === 'device') {
    updateRecordValues(profile.processCraftDeviceRecords, processCode, craftCode, fieldKey, value)
  } else if (scope === 'staff') {
    updateRecordValues(profile.processCraftStaffRecords, processCode, craftCode, fieldKey, value)
  } else {
    updateRecordValues(profile.processCraftAdjustmentRecords, processCode, craftCode, fieldKey, value)
  }

  upsertFactoryCapacityProfile(profile)
}

export function updateFactoryShiftCalendarField(
  factoryId: string,
  index: number,
  field: keyof ShiftCalendarRecord,
  value: ShiftCalendarRecord[keyof ShiftCalendarRecord],
): void {
  const profile = ensureProfile(factoryId)
  if (!profile.shiftCalendars[index]) return
  profile.shiftCalendars[index] = {
    ...profile.shiftCalendars[index],
    [field]: value,
  }
  upsertFactoryCapacityProfile(profile)
}

export function updateFactoryCalibrationField(
  factoryId: string,
  index: number,
  field: keyof CalibrationRecord,
  value: CalibrationRecord[keyof CalibrationRecord],
): void {
  const profile = ensureProfile(factoryId)
  if (!profile.calibrationRecords[index]) return
  profile.calibrationRecords[index] = {
    ...profile.calibrationRecords[index],
    [field]: value,
  }
  upsertFactoryCapacityProfile(profile)
}

export function hasCapacityFieldValue(
  value: FactoryCapacityFieldValue | undefined,
): boolean {
  return value !== undefined && value !== null && String(value).trim() !== ''
}

export { ADJUSTMENT_FIELD_KEYS, DEVICE_FIELD_KEYS, STAFF_FIELD_KEYS, UNIT_FIELD_KEYS }
