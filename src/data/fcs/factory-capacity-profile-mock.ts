import { getFactoryMasterRecordById, listFactoryMasterRecords } from './factory-master-store.ts'
import {
  getCapacityProcessCraftOptions,
  getProcessDefinitionByCode,
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
  FactoryCapacityEquipment,
  FactoryCapacityEquipmentAbility,
  FactoryCapacityFieldValue,
  FactoryCapacityProfile,
  FactoryCapacityEquipmentStatus,
  FactoryDyeVatCapacity,
  FactoryPostCapacityNode,
  FactoryPostCapacityNodeCode,
  FactoryPrintMachineCapacity,
} from './factory-types.ts'

const POST_CAPACITY_NODE_CODES = ['BUTTONHOLE', 'BUTTON_ATTACH', 'IRONING', 'PACKAGING'] as const satisfies FactoryPostCapacityNodeCode[]
const POST_CAPACITY_NODE_MACHINE_TYPE: Record<FactoryPostCapacityNodeCode, string> = {
  BUTTONHOLE: '锁眼机',
  BUTTON_ATTACH: '装扣机',
  IRONING: '整烫工位',
  PACKAGING: '包装工位',
}
const POST_CAPACITY_NODE_REFERENCE_CRAFTS: Record<FactoryPostCapacityNodeCode, string[]> = {
  BUTTONHOLE: ['开扣眼'],
  BUTTON_ATTACH: ['机打扣', '四爪扣', '布包扣', '手缝扣'],
  IRONING: ['熨烫'],
  PACKAGING: ['包装'],
}

function isPostCapacityNodeProcess(processCode: string): processCode is FactoryPostCapacityNodeCode {
  return POST_CAPACITY_NODE_CODES.includes(processCode as FactoryPostCapacityNodeCode)
}

function buildPostCapacityNodeRow(processCode: FactoryPostCapacityNodeCode): ProcessCraftDictRow {
  const process = getProcessDefinitionByCode(processCode)
  const availableRows = listCraftsByProcessCode(processCode)
    .map((craft) => getProcessCraftDictRowByCode(craft.craftCode))
    .filter((row): row is ProcessCraftDictRow => Boolean(row))
  const referenceRow = POST_CAPACITY_NODE_REFERENCE_CRAFTS[processCode]
    .map((craftName) => availableRows.find((row) => row.craftName === craftName))
    .find((row): row is ProcessCraftDictRow => Boolean(row))
    ?? availableRows[0]

  if (!process || !referenceRow) {
    throw new Error(`缺少后道产能节点定义：${processCode}`)
  }

  const parentProcess = getProcessDefinitionByCode(process.parentProcessCode ?? 'POST_FINISHING')

  return {
    ...referenceRow,
    processCode: parentProcess?.processCode ?? 'POST_FINISHING',
    processName: parentProcess?.processName ?? '后道',
    craftCode: processCode,
    craftName: process.processName,
    systemProcessCode: process.systemProcessCode,
    legacyCraftName: process.processName,
    processRole: process.processRole,
    processRoleLabel: '产能节点',
    taskScopeLabel: '产能节点',
    generatesExternalTask: false,
    generatesExternalTaskLabel: '否',
    parentProcessCode: process.parentProcessCode,
  }
}

function resolveAbilitySupportedRows(ability: Factory['processAbilities'][number]): ProcessCraftDictRow[] {
  if ((ability.status ?? 'ACTIVE') === 'DISABLED') return []

  if (ability.processCode === 'POST_FINISHING') {
    const nodeCodes = ability.capacityNodeCodes?.length ? ability.capacityNodeCodes : POST_CAPACITY_NODE_CODES
    return nodeCodes.map((nodeCode) => buildPostCapacityNodeRow(nodeCode))
  }

  const craftSet = new Set(ability.craftCodes)
  return listCraftsByProcessCode(ability.processCode)
    .filter((craft) => craftSet.has(craft.craftCode))
    .map((craft) => getProcessCraftDictRowByCode(craft.craftCode))
    .filter((row): row is ProcessCraftDictRow => Boolean(row))
}

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

export interface FactoryCapacityEquipmentSummary {
  factoryId: string
  processCode: string
  craftCode: string
  totalEquipmentCount: number
  countableEquipmentCount: number
  maintenanceEquipmentCount: number
  stoppedEquipmentCount: number
  frozenEquipmentCount: number
  eligibleShiftMinutesTotal: number
  eligibleDeviceCapacityTotal: number
  averageSingleShiftMinutes: number
  weightedEfficiencyValue: number
  efficiencyUnit: string
  matchedEquipments: FactoryCapacityEquipment[]
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

function cloneEquipmentAbility(ability: FactoryCapacityEquipmentAbility): FactoryCapacityEquipmentAbility {
  return {
    processCode: ability.processCode,
    processName: ability.processName,
    craftCode: ability.craftCode,
    craftName: ability.craftName,
    efficiencyValue: ability.efficiencyValue,
    efficiencyUnit: ability.efficiencyUnit,
  }
}

function cloneEquipment(equipment: FactoryCapacityEquipment): FactoryCapacityEquipment {
  return {
    equipmentId: equipment.equipmentId,
    factoryId: equipment.factoryId,
    equipmentName: equipment.equipmentName,
    equipmentNo: equipment.equipmentNo,
    equipmentType: equipment.equipmentType,
    abilityList: equipment.abilityList.map((ability) => cloneEquipmentAbility(ability)),
    quantity: equipment.quantity,
    singleShiftMinutes: equipment.singleShiftMinutes,
    status: equipment.status,
    displaySpecValue: equipment.displaySpecValue,
    displaySpecUnit: equipment.displaySpecUnit,
    supportedMaterialTypes: equipment.supportedMaterialTypes ? [...equipment.supportedMaterialTypes] : undefined,
    remark: equipment.remark,
  }
}

function createEmptyProfile(factoryId: string): FactoryCapacityProfile {
  return {
    factoryId,
    entries: [],
  }
}

function cloneEquipments(equipments: FactoryCapacityEquipment[]): FactoryCapacityEquipment[] {
  return equipments.map((item) => cloneEquipment(item))
}

function resolveFactorySupportedCraftRows(factory: Factory): ProcessCraftDictRow[] {
  const stageWeight = new Map(listProcessStages().map((stage, index) => [stage.stageCode, index] as const))

  return factory.processAbilities
    .flatMap((ability) => resolveAbilitySupportedRows(ability))
    .sort((left, right) => {
      const stageCompare = (stageWeight.get(left.stageCode) ?? 0) - (stageWeight.get(right.stageCode) ?? 0)
      if (stageCompare !== 0) return stageCompare
      const processCompare = left.processName.localeCompare(right.processName)
      if (processCompare !== 0) return processCompare
      return left.craftName.localeCompare(right.craftName)
    })
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

function getSeedNumericValue(
  values: Partial<Record<SamCurrentFieldKey, FactoryCapacityFieldValue>>,
  key: SamCurrentFieldKey,
): number {
  const rawValue = values[key]
  const numericValue = Number(rawValue)
  return Number.isFinite(numericValue) ? numericValue : 0
}

function resolveEquipmentEfficiencyUnit(row: ProcessCraftDictRow): string {
  if (row.processCode === 'PRINT') return '米/分钟'
  if (row.processCode === 'DYE') return '批/分钟'
  return '件/分钟'
}

function resolveEquipmentEfficiencyUnitByCodes(processCode: string, craftCode: string): string {
  const row = getProcessCraftDictRowByCode(craftCode)
  if (row) return resolveEquipmentEfficiencyUnit(row)
  if (processCode === 'PRINT') return '米/分钟'
  if (processCode === 'DYE') return '批/分钟'
  return '件/分钟'
}

function buildEquipmentAbilityFromRow(
  row: ProcessCraftDictRow,
  efficiencyValue: number,
  efficiencyUnit = resolveEquipmentEfficiencyUnit(row),
): FactoryCapacityEquipmentAbility {
  return {
    processCode: row.processCode,
    processName: row.processName,
    craftCode: row.craftCode,
    craftName: row.craftName,
    efficiencyValue,
    efficiencyUnit,
  }
}

function buildEquipmentAbilityFromCodes(
  processCode: string,
  craftCode: string,
  efficiencyValue: number,
  efficiencyUnit: string,
): FactoryCapacityEquipmentAbility {
  const row = getProcessCraftDictRowByCode(craftCode)
  const processName = getProcessDefinitionByCode(processCode)?.processName ?? row?.processName ?? processCode
  const craftName = row?.craftName ?? getProcessDefinitionByCode(craftCode)?.processName ?? craftCode

  return {
    processCode,
    processName,
    craftCode,
    craftName,
    efficiencyValue,
    efficiencyUnit,
  }
}

function isCountableEquipmentStatus(status: FactoryCapacityEquipmentStatus): boolean {
  return status === 'AVAILABLE' || status === 'IN_USE'
}

function buildDerivedEquipmentFromEntry(
  factoryId: string,
  row: ProcessCraftDictRow,
  entry: FactoryCapacityEntry,
): FactoryCapacityEquipment {
  const quantity = Math.max(1, getSeedNumericValue(entry.values, 'deviceCount'))
  const singleShiftMinutes = Math.max(
    1,
    getSeedNumericValue(entry.values, 'deviceShiftMinutes') || getSeedNumericValue(entry.values, 'staffShiftMinutes'),
  )
  const efficiencyValue = Math.max(
    0.01,
    getSeedNumericValue(entry.values, 'deviceEfficiencyValue') || getSeedNumericValue(entry.values, 'staffEfficiencyValue'),
  )

  return {
    equipmentId: `${factoryId}::${row.processCode}::${row.craftCode}`,
    factoryId,
    equipmentName: `${row.craftName}设备`,
    equipmentNo: `${row.craftCode}-${factoryId.split('-').at(-1) ?? '01'}`,
    equipmentType: row.processCode === 'PRINT' ? 'PRINT_MACHINE' : row.processCode === 'DYE' ? 'DYE_VAT' : isPostCapacityNodeProcess(row.craftCode) ? 'POST_NODE' : 'GENERAL',
    abilityList: [buildEquipmentAbilityFromRow(row, efficiencyValue)],
    quantity,
    singleShiftMinutes,
    status: 'AVAILABLE',
    displaySpecValue: efficiencyValue,
    displaySpecUnit: resolveEquipmentEfficiencyUnit(row),
  }
}

function buildCustomFactoryEquipments(factoryId: string): FactoryCapacityEquipment[] {
  if (factoryId === 'ID-F002') {
    return [
      {
        equipmentId: 'EQUIP-ID-F002-PR01',
        factoryId,
        equipmentName: '印花打印机 A',
        equipmentNo: 'PR-01',
        equipmentType: 'PRINT_MACHINE',
        abilityList: [
          buildEquipmentAbilityFromCodes('PRINT', 'CRAFT_2000001', 3.0, '米/分钟'),
          buildEquipmentAbilityFromCodes('PRINT', 'CRAFT_2000002', 2.4, '米/分钟'),
        ],
        quantity: 1,
        singleShiftMinutes: 540,
        status: 'AVAILABLE',
        displaySpecValue: 180,
        displaySpecUnit: '米/小时',
        remark: '主线机台',
      },
      {
        equipmentId: 'EQUIP-ID-F002-PR02',
        factoryId,
        equipmentName: '印花打印机 B',
        equipmentNo: 'PR-02',
        equipmentType: 'PRINT_MACHINE',
        abilityList: [
          buildEquipmentAbilityFromCodes('PRINT', 'CRAFT_2000001', 2.8, '米/分钟'),
          buildEquipmentAbilityFromCodes('PRINT', 'CRAFT_2000002', 2.0, '米/分钟'),
        ],
        quantity: 1,
        singleShiftMinutes: 480,
        status: 'MAINTENANCE',
        displaySpecValue: 120,
        displaySpecUnit: '米/小时',
        remark: '当前做喷头保养',
      },
    ]
  }

  if (factoryId === 'ID-F003') {
    return [
      {
        equipmentId: 'EQUIP-ID-F003-VAT01',
        factoryId,
        equipmentName: '染缸 A',
        equipmentNo: 'VAT-01',
        equipmentType: 'DYE_VAT',
        abilityList: [
          buildEquipmentAbilityFromCodes('DYE', 'CRAFT_2000003', 0.95, '批/分钟'),
          buildEquipmentAbilityFromCodes('DYE', 'CRAFT_2000004', 0.85, '批/分钟'),
        ],
        quantity: 1,
        singleShiftMinutes: 540,
        status: 'AVAILABLE',
        displaySpecValue: 650,
        displaySpecUnit: 'kg/缸',
        supportedMaterialTypes: ['针织棉', '涤棉'],
        remark: '常规深色批次',
      },
      {
        equipmentId: 'EQUIP-ID-F003-VAT02',
        factoryId,
        equipmentName: '染缸 B',
        equipmentNo: 'VAT-02',
        equipmentType: 'DYE_VAT',
        abilityList: [
          buildEquipmentAbilityFromCodes('DYE', 'CRAFT_2000003', 1.05, '批/分钟'),
          buildEquipmentAbilityFromCodes('DYE', 'CRAFT_2000004', 0.92, '批/分钟'),
        ],
        quantity: 1,
        singleShiftMinutes: 600,
        status: 'FROZEN',
        displaySpecValue: 900,
        displaySpecUnit: 'kg/缸',
        supportedMaterialTypes: ['牛仔布', '厚磅梭织'],
        remark: '当前等待排期释放',
      },
    ]
  }

  return []
}

function ensureFactoryEquipmentArchive(
  factoryId: string,
  entries: FactoryCapacityEntry[],
  supportedRows: ProcessCraftDictRow[],
): FactoryCapacityEquipment[] {
  pruneOrphanProfiles()
  const existing = equipmentsByFactoryId.get(factoryId)
  if (existing) return cloneEquipments(existing)

  const customEquipments = buildCustomFactoryEquipments(factoryId)
  const coveredKeys = new Set(
    customEquipments.flatMap((equipment) =>
      equipment.abilityList.map((ability) => `${ability.processCode}::${ability.craftCode}`),
    ),
  )

  const rowMap = new Map(supportedRows.map((row) => [`${row.processCode}::${row.craftCode}`, row] as const))
  const generatedEquipments = entries
    .map((entry) => {
      const row = rowMap.get(`${entry.processCode}::${entry.craftCode}`)
      if (!row) return null
      if (coveredKeys.has(`${row.processCode}::${row.craftCode}`)) return null
      return buildDerivedEquipmentFromEntry(factoryId, row, entry)
    })
    .filter((item): item is FactoryCapacityEquipment => Boolean(item))

  const next = [...customEquipments, ...generatedEquipments]
  equipmentsByFactoryId.set(factoryId, cloneEquipments(next))
  return cloneEquipments(next)
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
const equipmentsByFactoryId = new Map<string, FactoryCapacityEquipment[]>()

function pruneOrphanProfiles(): void {
  const activeFactoryIds = new Set(listFactoryMasterRecords().map((factory) => factory.id))
  ;[...profilesByFactoryId.keys()].forEach((factoryId) => {
    if (!activeFactoryIds.has(factoryId)) {
      profilesByFactoryId.delete(factoryId)
    }
  })
  ;[...equipmentsByFactoryId.keys()].forEach((factoryId) => {
    if (!activeFactoryIds.has(factoryId)) {
      equipmentsByFactoryId.delete(factoryId)
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
  ensureFactoryEquipmentArchive(factoryId, next.entries, supportedRows)
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
      const nextEntry = cloneEntry(entry)
      const equipmentSummary = getFactoryCapacityEquipmentSummary(factoryId, row.processCode, row.craftCode)
      if (row.samCurrentFieldKeys.includes('deviceCount')) {
        nextEntry.values.deviceCount = equipmentSummary.countableEquipmentCount
      }
      if (row.samCurrentFieldKeys.includes('deviceShiftMinutes')) {
        nextEntry.values.deviceShiftMinutes = Number(equipmentSummary.averageSingleShiftMinutes.toFixed(2))
      }
      if (row.samCurrentFieldKeys.includes('deviceEfficiencyValue')) {
        nextEntry.values.deviceEfficiencyValue = Number(equipmentSummary.weightedEfficiencyValue.toFixed(4))
      }
      return {
        row,
        entry: nextEntry,
      }
    })
    .filter((item): item is FactoryCapacityResolvedEntry => Boolean(item))
}

export function listFactoryCapacityEquipments(factoryId?: string): FactoryCapacityEquipment[] {
  if (factoryId) {
    const profile = ensureProfile(factoryId)
    const supportedRows = listFactoryCapacitySupportedCraftRows(factoryId)
    return ensureFactoryEquipmentArchive(factoryId, profile.entries, supportedRows)
  }

  return listFactoryMasterRecords().flatMap((factory) => {
    const profile = ensureProfile(factory.id)
    const supportedRows = listFactoryCapacitySupportedCraftRows(factory.id)
    return ensureFactoryEquipmentArchive(factory.id, profile.entries, supportedRows)
  })
}

function findMatchedEquipmentAbility(
  equipment: FactoryCapacityEquipment,
  processCode: string,
  craftCode: string,
): FactoryCapacityEquipmentAbility | undefined {
  return equipment.abilityList.find((ability) =>
    ability.processCode === processCode && ability.craftCode === craftCode,
  )
}

export function getFactoryCapacityEquipmentSummary(
  factoryId: string,
  processCode: string,
  craftCode: string,
): FactoryCapacityEquipmentSummary {
  const equipments = listFactoryCapacityEquipments(factoryId)
  const matchedEquipments = equipments.filter((equipment) =>
    equipment.abilityList.some((ability) => ability.processCode === processCode && ability.craftCode === craftCode),
  )

  const summary = matchedEquipments.reduce<FactoryCapacityEquipmentSummary>((result, equipment) => {
    const ability = findMatchedEquipmentAbility(equipment, processCode, craftCode)
    if (!ability) return result

    const quantity = Math.max(0, equipment.quantity)
    result.totalEquipmentCount += quantity

    if (equipment.status === 'MAINTENANCE') result.maintenanceEquipmentCount += quantity
    if (equipment.status === 'STOPPED') result.stoppedEquipmentCount += quantity
    if (equipment.status === 'FROZEN') result.frozenEquipmentCount += quantity

    if (isCountableEquipmentStatus(equipment.status)) {
      const shiftMinutesTotal = quantity * equipment.singleShiftMinutes
      const deviceCapacityTotal = shiftMinutesTotal * ability.efficiencyValue

      result.countableEquipmentCount += quantity
      result.eligibleShiftMinutesTotal += shiftMinutesTotal
      result.eligibleDeviceCapacityTotal += deviceCapacityTotal
    }

    result.matchedEquipments.push(cloneEquipment(equipment))
    if (!result.efficiencyUnit) result.efficiencyUnit = ability.efficiencyUnit
    return result
  }, {
    factoryId,
    processCode,
    craftCode,
    totalEquipmentCount: 0,
    countableEquipmentCount: 0,
    maintenanceEquipmentCount: 0,
    stoppedEquipmentCount: 0,
    frozenEquipmentCount: 0,
    eligibleShiftMinutesTotal: 0,
    eligibleDeviceCapacityTotal: 0,
    averageSingleShiftMinutes: 0,
    weightedEfficiencyValue: 0,
    efficiencyUnit: '',
    matchedEquipments: [],
  })

  if (summary.countableEquipmentCount > 0) {
    summary.averageSingleShiftMinutes = Number(
      (summary.eligibleShiftMinutesTotal / summary.countableEquipmentCount).toFixed(2),
    )
  }
  if (summary.eligibleShiftMinutesTotal > 0) {
    summary.weightedEfficiencyValue = Number(
      (summary.eligibleDeviceCapacityTotal / summary.eligibleShiftMinutesTotal).toFixed(4),
    )
  }
  if (!summary.efficiencyUnit) {
    summary.efficiencyUnit = resolveEquipmentEfficiencyUnitByCodes(processCode, craftCode)
  }

  return summary
}

export function replaceFactoryCapacityEquipments(factoryId: string, equipments: FactoryCapacityEquipment[]): void {
  const sanitized = cloneEquipments(equipments).map((equipment, index) => ({
    ...equipment,
    factoryId,
    equipmentId: equipment.equipmentId || `${factoryId}::EQUIPMENT::${index + 1}`,
    quantity: Math.max(0, equipment.quantity),
    singleShiftMinutes: Math.max(0, equipment.singleShiftMinutes),
    abilityList: equipment.abilityList.filter((ability) =>
      getCapacityProcessCraftOptions().some((option) =>
        option.processCode === ability.processCode && option.craftCode === ability.craftCode,
      ),
    ),
  }))
  equipmentsByFactoryId.set(factoryId, sanitized)
}

export function replaceFactoryCapacityProfileEntries(factoryId: string, entries: FactoryCapacityEntry[]): void {
  const profile = ensureProfile(factoryId)
  const supportedPairSet = new Set(
    listFactoryCapacitySupportedCraftRows(factoryId).map((row) => `${row.processCode}:${row.craftCode}`),
  )
  const next: FactoryCapacityProfile = {
    factoryId,
    entries: entries
      .filter((entry) => supportedPairSet.has(`${entry.processCode}:${entry.craftCode}`))
      .map((entry) => cloneEntry(entry)),
  }
  profilesByFactoryId.set(factoryId, cloneProfile(next))
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

function isEquipmentLinkedField(key: SamCurrentFieldKey): boolean {
  return key === 'deviceCount' || key === 'deviceShiftMinutes' || key === 'deviceEfficiencyValue'
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
  equipmentSummary?: FactoryCapacityEquipmentSummary,
): FactoryCapacityComputedResult {
  const template = getFactorySupplyFormulaTemplate(row.craftName)
  const deviceCountFromArchive = equipmentSummary?.countableEquipmentCount ?? 0
  const deviceShiftMinutesFromArchive = equipmentSummary?.averageSingleShiftMinutes ?? 0
  const deviceEfficiencyFromArchive = equipmentSummary?.weightedEfficiencyValue ?? 0
  const missingFieldKeys = row.samCurrentFieldKeys.filter((key) => {
    if (!equipmentSummary || !isEquipmentLinkedField(key)) {
      return getNumericValue(values, key) === null
    }
    return false
  })
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
    const deviceCount = equipmentSummary ? deviceCountFromArchive : (getNumericValue(values, 'deviceCount') ?? 0)
    const deviceShiftMinutes = equipmentSummary ? deviceShiftMinutesFromArchive : (getNumericValue(values, 'deviceShiftMinutes') ?? 0)
    const batchLoadCapacity = getNumericValue(values, 'batchLoadCapacity') ?? 0
    const cycleMinutes = getNumericValue(values, 'cycleMinutes') ?? 0
    const staffCount = getNumericValue(values, 'staffCount') ?? 0
    const staffShiftMinutes = getNumericValue(values, 'staffShiftMinutes') ?? 0
    const staffEfficiencyValue = getNumericValue(values, 'staffEfficiencyValue') ?? 0
    const setupMinutes = getNumericValue(values, 'setupMinutes') ?? 0
    const switchMinutes = getNumericValue(values, 'switchMinutes') ?? 0

    const deviceBatchCount = cycleMinutes === 0
      ? 0
      : equipmentSummary
        ? equipmentSummary.eligibleShiftMinutesTotal / cycleMinutes
        : deviceShiftMinutes / cycleMinutes
    const deviceCapacity = equipmentSummary
      ? deviceBatchCount * batchLoadCapacity
      : deviceBatchCount * batchLoadCapacity * deviceCount
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
          expression: equipmentSummary
            ? `可计入设备总单班时长（${formatResultNumber(equipmentSummary.eligibleShiftMinutesTotal)}）÷ ${formatNamedNumber('cycleMinutes', cycleMinutes)}`
            : `${formatNamedNumber('deviceShiftMinutes', deviceShiftMinutes)} ÷ ${formatNamedNumber('cycleMinutes', cycleMinutes)}`,
          result: deviceBatchCount,
        },
        {
          label: '设备侧日能力',
          expression: equipmentSummary
            ? `单台默认日可运行批数（${formatResultNumber(deviceBatchCount)}）× ${formatNamedNumber('batchLoadCapacity', batchLoadCapacity)}`
            : `单台默认日可运行批数（${formatResultNumber(deviceBatchCount)}）× ${formatNamedNumber('batchLoadCapacity', batchLoadCapacity)} × ${formatNamedNumber('deviceCount', deviceCount)}`,
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

  const deviceCount = equipmentSummary ? deviceCountFromArchive : (getNumericValue(values, 'deviceCount') ?? 0)
  const deviceShiftMinutes = equipmentSummary ? deviceShiftMinutesFromArchive : (getNumericValue(values, 'deviceShiftMinutes') ?? 0)
  const deviceEfficiencyValue = equipmentSummary ? deviceEfficiencyFromArchive : (getNumericValue(values, 'deviceEfficiencyValue') ?? 0)
  const staffCount = getNumericValue(values, 'staffCount') ?? 0
  const staffShiftMinutes = getNumericValue(values, 'staffShiftMinutes') ?? 0
  const staffEfficiencyValue = getNumericValue(values, 'staffEfficiencyValue') ?? 0
  const setupMinutes = getNumericValue(values, 'setupMinutes') ?? 0
  const switchMinutes = getNumericValue(values, 'switchMinutes') ?? 0

  const deviceCapacity = equipmentSummary
    ? equipmentSummary.eligibleDeviceCapacityTotal
    : deviceCount * deviceShiftMinutes * deviceEfficiencyValue
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
        expression: equipmentSummary
          ? `可计入设备（${deviceCount}）逐台汇总`
          : `${formatNamedNumber('deviceCount', deviceCount)} × ${formatNamedNumber('deviceShiftMinutes', deviceShiftMinutes)} × ${formatNamedNumber('deviceEfficiencyValue', deviceEfficiencyValue)}`,
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

function getEntryNumericValue(
  entry: FactoryCapacityEntry,
  fieldKey: SamCurrentFieldKey,
): number | undefined {
  const value = entry.values[fieldKey]
  if (value === undefined || value === null || String(value).trim() === '') return undefined
  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? numericValue : undefined
}

function resolveEquipmentStatus(factoryId: string, processCode: string): FactoryEquipmentStatus {
  const factory = getFactoryMasterRecordById(factoryId)
  if (!factory) return 'STOPPED'
  if ((factory.processAbilities.find((item) => item.processCode === processCode)?.status ?? 'ACTIVE') === 'PAUSED') return 'FROZEN'
  if (factory.status === 'paused') return 'FROZEN'
  if (factory.status === 'inactive' || factory.status === 'blacklist') return 'STOPPED'
  return 'AVAILABLE'
}

export function listFactoryPostCapacityNodes(factoryId: string): FactoryPostCapacityNode[] {
  const entries = new Map(
    listFactoryCapacityEntries(factoryId)
      .filter(({ row }) => isPostCapacityNodeProcess(row.craftCode))
      .map(({ row, entry }) => [row.craftCode, { row, entry }] as const),
  )
  const equipments = listFactoryCapacityEquipments(factoryId)

  return POST_CAPACITY_NODE_CODES.flatMap((nodeCode) => {
    const resolved = entries.get(nodeCode)
    if (!resolved) return []

    const matchedEquipments = equipments.filter((equipment) =>
      equipment.abilityList.some((ability) => ability.processCode === 'POST_FINISHING' && ability.craftCode === nodeCode),
    )
    const summary = getFactoryCapacityEquipmentSummary(factoryId, 'POST_FINISHING', nodeCode)
    const { row, entry } = resolved
    const operatorCount = getEntryNumericValue(entry, 'staffCount')
    const efficiencyValue = summary.weightedEfficiencyValue || getEntryNumericValue(entry, 'staffEfficiencyValue')

    return [{
      capacityNodeId: `${factoryId}::${nodeCode}`,
      factoryId,
      parentProcessCode: 'POST_FINISHING',
      nodeCode,
      nodeName: row.craftName,
      machineType: POST_CAPACITY_NODE_MACHINE_TYPE[nodeCode],
      machineCount: summary.countableEquipmentCount,
      operatorCount,
      shiftMinutes: Math.round(summary.averageSingleShiftMinutes || getEntryNumericValue(entry, 'staffShiftMinutes') || 0),
      efficiencyValue,
      efficiencyUnit: efficiencyValue == null ? undefined : (summary.efficiencyUnit || '件/分钟'),
      setupMinutes: getEntryNumericValue(entry, 'setupMinutes'),
      switchMinutes: getEntryNumericValue(entry, 'switchMinutes'),
      status: matchedEquipments.some((equipment) => isCountableEquipmentStatus(equipment.status)) ? 'AVAILABLE' : resolveEquipmentStatus(factoryId, 'POST_FINISHING'),
      effectiveFrom: getFactoryMasterRecordById(factoryId)?.updatedAt,
    }]
  })
}

export function listFactoryPrintMachineCapacities(factoryId?: string): FactoryPrintMachineCapacity[] {
  return listFactoryCapacityEquipments(factoryId)
    .filter((equipment) => equipment.equipmentType === 'PRINT_MACHINE')
    .map((equipment) => ({
      printerId: equipment.equipmentId,
      factoryId: equipment.factoryId,
      printerNo: equipment.equipmentNo,
      printerName: equipment.equipmentName,
      speedValue: equipment.displaySpecValue ?? equipment.abilityList[0]?.efficiencyValue ?? 0,
      speedUnit: equipment.displaySpecUnit ?? equipment.abilityList[0]?.efficiencyUnit ?? '米/分钟',
      shiftMinutes: equipment.singleShiftMinutes,
      status: equipment.status,
      remark: equipment.remark,
    }))
}

export function listFactoryDyeVatCapacities(factoryId?: string): FactoryDyeVatCapacity[] {
  return listFactoryCapacityEquipments(factoryId)
    .filter((equipment) => equipment.equipmentType === 'DYE_VAT')
    .map((equipment) => ({
      dyeVatId: equipment.equipmentId,
      factoryId: equipment.factoryId,
      dyeVatNo: equipment.equipmentNo,
      capacityQty: equipment.displaySpecValue ?? equipment.abilityList[0]?.efficiencyValue ?? 0,
      capacityUnit: equipment.displaySpecUnit ?? equipment.abilityList[0]?.efficiencyUnit ?? 'kg/缸',
      supportedMaterialTypes: [...(equipment.supportedMaterialTypes ?? [])],
      shiftMinutes: equipment.singleShiftMinutes,
      status: equipment.status,
      remark: equipment.remark,
    }))
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

    const result = computeFactoryCapacityEntryResult(
      row,
      entry.values,
      getFactoryCapacityEquipmentSummary(factory.id, row.processCode, row.craftCode),
    )
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
