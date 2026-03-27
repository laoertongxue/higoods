import type { CutPieceZoneCode } from './warehouse-runtime.ts'
import type {
  CutPieceWarehouseActionType,
  CutPieceWarehouseWritebackRecord,
  SampleWarehouseActionType,
  SampleWarehouseWritebackLocationType,
  SampleWarehouseWritebackRecord,
} from './warehouse-writeback-ledger.ts'

export interface CuttingWarehouseWritebackOperatorInput {
  operatorAccountId: string
  operatorName: string
  operatorRole: string
  operatorFactoryId: string
  operatorFactoryName: string
}

export interface CuttingWarehouseWritebackSourceInput {
  sourceChannel: 'CUTTING_WAREHOUSE_UI'
  sourceDeviceId: string
  sourceRecordId: string
  sourcePageKey: string
}

export interface CutPieceWarehouseWritebackIdentityInput {
  warehouseRecordId: string
  productionOrderId: string
  productionOrderNo: string
  originalCutOrderId: string
  originalCutOrderNo: string
  mergeBatchId?: string
  mergeBatchNo?: string
  materialSku: string
}

export interface SampleWarehouseWritebackIdentityInput {
  sampleRecordId: string
  productionOrderId: string
  productionOrderNo: string
  originalCutOrderId: string
  originalCutOrderNo: string
  materialSku: string
}

export interface NormalizeCutPieceWarehouseWritebackInput {
  actionType: CutPieceWarehouseActionType
  identity: CutPieceWarehouseWritebackIdentityInput
  zoneCode?: CutPieceZoneCode
  locationCode?: string
  handoverTarget?: string
  note?: string
  actionAt?: string
  operatorName?: string
}

export interface NormalizeSampleWarehouseWritebackInput {
  actionType: SampleWarehouseActionType
  identity: SampleWarehouseWritebackIdentityInput
  locationType?: SampleWarehouseWritebackLocationType
  holder?: string
  note?: string
  actionAt?: string
  operatorName?: string
}

function nowText(date = new Date()): string {
  return date.toISOString().replace('T', ' ').slice(0, 19)
}

function compactTimestamp(value: string): string {
  return value.replace(/[^0-9]/g, '').slice(0, 14)
}

function normalizeNameKey(name: string): string {
  return Array.from(name.trim())
    .map((char) => char.charCodeAt(0).toString(16))
    .join('')
    .slice(0, 16)
}

function buildSyntheticWarehouseOperatorAccountId(factoryId: string, operatorName: string): string {
  return `WH-${factoryId || 'ID-F001'}-${normalizeNameKey(operatorName || '仓务操作员') || 'operator'}`
}

export function resolvePrototypeWarehouseOperator(operatorName = '仓务操作员'): CuttingWarehouseWritebackOperatorInput {
  const normalizedName = operatorName.trim() || '仓务操作员'
  const factoryId = 'ID-F001'
  return {
    operatorAccountId: buildSyntheticWarehouseOperatorAccountId(factoryId, normalizedName),
    operatorName: normalizedName,
    operatorRole: '仓务员',
    operatorFactoryId: factoryId,
    operatorFactoryName: '默认工厂',
  }
}

export function buildCuttingWarehouseWritebackSource(sourcePageKey: string, sourceRecordId: string): CuttingWarehouseWritebackSourceInput {
  return {
    sourceChannel: 'CUTTING_WAREHOUSE_UI',
    sourceDeviceId: 'CUTTING-WAREHOUSE-DESKTOP',
    sourceRecordId,
    sourcePageKey,
  }
}

export function buildCuttingWarehouseWritebackId(actionType: string, recordId: string, actionAt: string): string {
  const compactId = (recordId || 'unknown').replace(/[^a-zA-Z0-9]/g, '').slice(-16) || 'unknown'
  return `WH-${actionType}-${compactTimestamp(actionAt) || '00000000000000'}-${compactId}`
}

export function normalizeCutPieceWarehouseWritebackInput(
  input: NormalizeCutPieceWarehouseWritebackInput,
): CutPieceWarehouseWritebackRecord {
  const actionAt = input.actionAt || nowText()
  const operator = resolvePrototypeWarehouseOperator(input.operatorName)
  const source = buildCuttingWarehouseWritebackSource('CUT_PIECE_WAREHOUSE_PAGE', input.identity.warehouseRecordId)
  return {
    writebackId: buildCuttingWarehouseWritebackId(input.actionType, input.identity.warehouseRecordId, actionAt),
    actionType: input.actionType,
    actionAt,
    submittedAt: actionAt,
    warehouseRecordId: input.identity.warehouseRecordId,
    productionOrderId: input.identity.productionOrderId,
    productionOrderNo: input.identity.productionOrderNo,
    originalCutOrderId: input.identity.originalCutOrderId,
    originalCutOrderNo: input.identity.originalCutOrderNo,
    mergeBatchId: input.identity.mergeBatchId || '',
    mergeBatchNo: input.identity.mergeBatchNo || '',
    materialSku: input.identity.materialSku,
    zoneCode: input.zoneCode || 'UNASSIGNED',
    locationCode: input.locationCode?.trim() || '待补库位',
    handoverTarget: input.handoverTarget?.trim() || '',
    note: input.note?.trim() || '',
    operatorAccountId: operator.operatorAccountId,
    operatorName: operator.operatorName,
    operatorRole: operator.operatorRole,
    operatorFactoryId: operator.operatorFactoryId,
    operatorFactoryName: operator.operatorFactoryName,
    sourceChannel: source.sourceChannel,
    sourceDeviceId: source.sourceDeviceId,
    sourceRecordId: source.sourceRecordId,
    sourcePageKey: source.sourcePageKey,
    status: 'RECORDED',
  }
}

export function normalizeSampleWarehouseWritebackInput(
  input: NormalizeSampleWarehouseWritebackInput,
): SampleWarehouseWritebackRecord {
  const actionAt = input.actionAt || nowText()
  const operator = resolvePrototypeWarehouseOperator(input.operatorName)
  const source = buildCuttingWarehouseWritebackSource('SAMPLE_WAREHOUSE_PAGE', input.identity.sampleRecordId)
  return {
    writebackId: buildCuttingWarehouseWritebackId(input.actionType, input.identity.sampleRecordId, actionAt),
    actionType: input.actionType,
    actionAt,
    submittedAt: actionAt,
    sampleRecordId: input.identity.sampleRecordId,
    productionOrderId: input.identity.productionOrderId,
    productionOrderNo: input.identity.productionOrderNo,
    originalCutOrderId: input.identity.originalCutOrderId,
    originalCutOrderNo: input.identity.originalCutOrderNo,
    mergeBatchId: '',
    mergeBatchNo: '',
    materialSku: input.identity.materialSku,
    locationType: input.locationType || 'production-center',
    holder: input.holder?.trim() || 'PMC 样衣仓',
    note: input.note?.trim() || '',
    operatorAccountId: operator.operatorAccountId,
    operatorName: operator.operatorName,
    operatorRole: operator.operatorRole,
    operatorFactoryId: operator.operatorFactoryId,
    operatorFactoryName: operator.operatorFactoryName,
    sourceChannel: source.sourceChannel,
    sourceDeviceId: source.sourceDeviceId,
    sourceRecordId: source.sourceRecordId,
    sourcePageKey: source.sourcePageKey,
    status: 'RECORDED',
  }
}
