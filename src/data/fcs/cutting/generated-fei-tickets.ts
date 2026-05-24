import {
  getProductionOrderTechPackSnapshot,
} from '../production-orders.ts'
import {
  getDedicatedSpecialCraftFactorySeed,
  type SpecialCraftDedicatedFactorySeed,
} from '../special-craft-dedicated-factories.ts'
import {
  listGeneratedCutOrderSourceRecords,
  type GeneratedCutOrderPieceRow,
  type GeneratedCutOrderSkuScopeLine,
  type GeneratedCutOrderSourceRecord,
} from './generated-cut-orders.ts'
import { encodeFeiTicketQr } from './qr-codes.ts'
import type { FeiTicketQrPayload } from './qr-payload.ts'
import {
  createEmptyStore,
  CUTTING_MARKER_SPREADING_LEDGER_STORAGE_KEY,
  deserializeMarkerSpreadingStorage,
  type MarkerModeKey,
  type MarkerSpreadingStore,
  type SpreadingSession,
} from '../../../pages/process-factory/cutting/marker-spreading-model.ts'
import type { CuttingMaterialIdentity, CuttingPatternIdentity } from './types.ts'
import {
  listSpreadingDifferencesBySpreadingOrder,
  type SpreadingDifference,
} from './spreading-differences.ts'

export const FEI_TICKET_SOURCE_BASIS = '实际裁剪产出' as const
export const FEI_TICKET_SOURCE_BASIS_TYPE = 'ACTUAL_CUTTING_OUTPUT' as const
export const FEI_TICKET_WAITING_SOURCE_BASIS_TYPE = 'WAITING_ACTUAL_CUTTING_OUTPUT' as const

export type FeiTicketSourceBasis = typeof FEI_TICKET_SOURCE_BASIS
export type FeiTicketSourceBasisType = typeof FEI_TICKET_SOURCE_BASIS_TYPE
export type WaitingFeiTicketSourceBasisType = typeof FEI_TICKET_WAITING_SOURCE_BASIS_TYPE
export type FeiTicketSpecialCraftCategory = '辅助工艺' | '特种工艺'
export type FeiTicketSpecialCraftReceiverFactoryType = '辅助工艺厂' | '特种工艺厂' | '内部裁床工艺' | '其他'
export type FeiTicketSpecialCraftRequirementSource = '技术包' | '人工修正' | '裁片单明细' | '实际裁剪产出'

export interface FeiTicketSpecialCraft {
  specialCraftId: string
  craftCategory: FeiTicketSpecialCraftCategory
  craftType: string
  craftName: string
  receiverFactoryId: string
  receiverFactoryCode: string
  receiverFactoryName: string
  receiverFactoryType: FeiTicketSpecialCraftReceiverFactoryType
  affectedPartCode: string
  affectedPartName: string
  affectedSize: string
  affectedPieceQty: number
  requirementSource: FeiTicketSpecialCraftRequirementSource
  handoverStatus: '未交出' | '待交出' | '已交出'
  returnStatus: '未回仓' | '待回仓' | '已回仓'
  remark: string
}

export interface PieceSequenceRange {
  basis: '床次层序'
  ruleVersion: 'piece-sequence-v1'
  spreadingOrderId: string
  spreadingOrderNo: string
  markerPlanId: string
  markerPlanNo: string
  markerNumber: string
  bedNo: string
  markerMode: MarkerModeKey
  size: string
  sizeGroupId: string
  partCode: string
  partName: string
  partInstanceNo: string
  startNo: number
  endNo: number
  rangeLabel: string
  actualLayerCount: number
  actualLayerSource: '实铺层数' | '实际裁剪产出'
  actualPieceQty: number
  unit: '片'
  generatedAt: string
}
export type FeiTicketGenerationReasonCode =
  | 'SPREADING_ORDER_NOT_FOUND'
  | 'SPREADING_NOT_CUT_DONE'
  | 'MISSING_ACTUAL_OUTPUT'
  | 'ACTUAL_OUTPUT_ZERO'
  | 'MISSING_CUT_ORDER'
  | 'MISSING_MATERIAL_IDENTITY'
  | 'MISSING_PATTERN_IDENTITY'
  | 'DIFFERENCE_PENDING'
  | 'FEI_TICKET_ALREADY_GENERATED'

export interface FeiTicketGenerationEligibility {
  sourceOutputId: string
  canGenerate: boolean
  reasonCodes: FeiTicketGenerationReasonCode[]
  reasonTexts: string[]
}

export interface CuttingActualOutput {
  outputId: string
  outputNo: string
  productionOrderId: string
  productionOrderNo: string
  cutOrderId: string
  cutOrderNo: string
  markerPlanId: string
  markerPlanNo: string
  markerNumber: string
  bedNo: string
  spreadingOrderId: string
  spreadingOrderNo: string
  materialIdentity: CuttingMaterialIdentity
  patternIdentity: CuttingPatternIdentity
  spuId: string
  spuCode: string
  styleId: string
  styleName: string
  color: string
  size: string
  partCode: string
  partName: string
  plannedGarmentQty: number
  plannedPieceQty: number
  actualGarmentQty: number
  actualPieceQty: number
  actualLayerCount: number
  actualMaterialUsage: number
  actualMaterialUsageUnit: string
  cuttingCompletedAt: string
  cuttingCompletedBy: string
  differenceHandlingStatus: '无差异' | '待处理' | '仅记录差异' | '继续补排' | '关闭裁片单' | '需要补录'
  canGenerateFeiTicket: boolean
  generatedFeiTicketIds: string[]
}

export interface FeiTicketGenerationEligibilityRow {
  scenarioLabel: string
  output: CuttingActualOutput | null
  eligibility: FeiTicketGenerationEligibility
}

export interface PieceSequenceRangeScenarioRow {
  scenarioLabel: string
  feiTicketNo: string
  markerModeLabel: string
  partName: string
  size: string
  pieceSequenceRange: PieceSequenceRange | null
  pieceSequenceLabel: string
  pieceSequenceCannotGenerateReason: string
}

export interface SpreadingPieceOutputLine {
  outputLineId: string
  spreadingSessionId: string
  sourceSpreadingSessionNo: string
  sourceMarkerId: string
  sourceMarkerNo: string
  sourceMarkerLineItemId: string
  cutOrderId: string
  cutOrderNo: string
  markerPlanId?: string
  markerPlanNo?: string
  productionOrderId: string
  productionOrderNo: string
  fabricRollId: string
  fabricRollNo: string
  fabricColor: string
  materialSku: string
  garmentSkuId: string
  garmentColor: string
  sizeCode: string
  partCode: string
  partName: string
  partInstanceNo: string
  pieceCountPerGarment: number
  bundleNo: string
  bundleQty: number
  pieceSetNoStart: number
  pieceSetNoEnd: number
  pieceSetNoRange: string
  bundleTicketType: string
  layerCount: number
  markerMode: MarkerModeKey
  sizeGroupId: string
  actualCutPieceQty: number
  actualCutGarmentQty: number
  sourceBasis: FeiTicketSourceBasis
  sourceBasisType: FeiTicketSourceBasisType
  createdBy: string
  createdAt: string
}

export interface GeneratedFeiTicketSourceRecord {
  feiTicketId: string
  feiTicketNo: string
  sourceOutputLineId: string
  sourceSpreadingSessionId: string
  sourceSpreadingSessionNo: string
  sourceMarkerId: string
  sourceMarkerNo: string
  cutOrderId: string
  cutOrderNo: string
  productionOrderId: string
  productionOrderNo: string
  sourceMarkerPlanId: string
  sourceMarkerPlanNo: string
  fabricRollId: string
  fabricRollNo: string
  fabricColor: string
  materialSku: string
  materialIdentity: CuttingMaterialIdentity
  patternIdentity: CuttingPatternIdentity
  garmentSkuId: string
  garmentColor: string
  pieceScope: string[]
  pieceGroup: string
  bundleScope: string
  skuCode: string
  skuColor: string
  skuSize: string
  partCode: string
  partName: string
  partInstanceNo: string
  bundleNo: string
  bundleQty: number
  pieceSetNoStart: number
  pieceSetNoEnd: number
  pieceSetNoRange: string
  bundleTicketType: string
  actualCutPieceQty: number
  printStatus: 'WAIT_PRINT' | 'PRINTED' | 'REPRINTED' | 'VOIDED'
  qty: number
  garmentQty: number
  sourceTraceCompleteness: 'COMPLETE'
  secondaryCrafts: string[]
  craftSequenceVersion: string
  currentCraftStage: string
  hasSpecialCraft: boolean
  specialCrafts: FeiTicketSpecialCraft[]
  specialCraftDisplayLabel: string
  pieceSequenceRange: PieceSequenceRange | null
  pieceSequenceLabel: string
  pieceSequenceCannotGenerateReason: string
  sourceTechPackSpuCode: string
  sourceBasis: FeiTicketSourceBasis
  sourceBasisType: FeiTicketSourceBasisType
  markerNumber: string
  bedNo: string
  spreadingOrderId: string
  spreadingOrderNo: string
  issuedAt: string
  qrPayload: FeiTicketQrPayload
  qrValue: string
}

export interface GeneratedFeiTicketTraceMatrixRow {
  feiTicketId: string
  feiTicketNo: string
  sourceOutputLineId: string
  sourceSpreadingSessionId: string
  sourceSpreadingSessionNo: string
  sourceMarkerId: string
  sourceMarkerNo: string
  sourceMarkerPlanId: string
  sourceMarkerPlanNo: string
  cutOrderId: string
  cutOrderNo: string
  fabricRollNo: string
  fabricColor: string
  materialSku: string
  color: string
  size: string
  partName: string
  partInstanceNo: string
  bundleNo: string
  bundleQty: number
  pieceSetNoStart: number
  pieceSetNoEnd: number
  pieceSetNoRange: string
  bundleTicketType: string
  garmentQty: number
  sourceBasis: FeiTicketSourceBasis
  sourceBasisType: FeiTicketSourceBasisType
  sourceTraceCompleteness: 'COMPLETE'
  sourceWritebackId: string
  hasSpecialCraft: boolean
  specialCraftDisplayLabel: string
  pieceSequenceLabel: string
  pieceSequenceCannotGenerateReason: string
}

function normalizeText(value: string | null | undefined): string {
  return String(value || '').trim()
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)))
}

function normalizeBusinessText(value: string | null | undefined, defaultText: string): string {
  return normalizeText(value) || defaultText
}

function formatPieceSetRange(start: number, end: number): string {
  const safeStart = Math.max(Math.floor(start || 1), 1)
  const safeEnd = Math.max(Math.floor(end || safeStart), safeStart)
  return safeStart === safeEnd ? String(safeStart) : `${safeStart}-${safeEnd}`
}

function formatPieceSequenceRangeLabel(startNo: number, endNo: number): string {
  if (startNo <= 0 || endNo <= 0 || endNo < startNo) return ''
  return startNo === endNo ? String(startNo) : `${startNo}-${endNo}`
}

function getMarkerModeLabel(mode: MarkerModeKey): string {
  const map: Record<MarkerModeKey, string> = {
    normal: '普通模式',
    high_low: '高低层模式',
    fold_normal: '对折普通模式',
    fold_high_low: '对折高低层模式',
  }
  return map[mode] || '普通模式'
}

function isHighLowPieceSequenceMode(mode: MarkerModeKey): boolean {
  return mode === 'high_low' || mode === 'fold_high_low'
}

function compareFeiRecords(left: GeneratedFeiTicketSourceRecord, right: GeneratedFeiTicketSourceRecord): number {
  const orderCompare = left.cutOrderNo.localeCompare(right.cutOrderNo, 'zh-CN')
  if (orderCompare !== 0) return orderCompare
  const sessionCompare = left.sourceSpreadingSessionNo.localeCompare(right.sourceSpreadingSessionNo, 'zh-CN')
  if (sessionCompare !== 0) return sessionCompare
  return left.feiTicketNo.localeCompare(right.feiTicketNo, 'zh-CN')
}

function compareOutputLines(left: SpreadingPieceOutputLine, right: SpreadingPieceOutputLine): number {
  return (
    left.cutOrderNo.localeCompare(right.cutOrderNo, 'zh-CN')
    || left.fabricRollNo.localeCompare(right.fabricRollNo, 'zh-CN')
    || left.fabricColor.localeCompare(right.fabricColor, 'zh-CN')
    || left.sizeCode.localeCompare(right.sizeCode, 'zh-CN')
    || left.bundleNo.localeCompare(right.bundleNo, 'zh-CN')
    || left.partName.localeCompare(right.partName, 'zh-CN')
  )
}

const feiTicketGenerationReasonTextMap: Record<FeiTicketGenerationReasonCode, string> = {
  SPREADING_ORDER_NOT_FOUND: '铺布单不存在',
  SPREADING_NOT_CUT_DONE: '铺布单尚未完成裁剪',
  MISSING_ACTUAL_OUTPUT: '缺少实际裁剪产出',
  ACTUAL_OUTPUT_ZERO: '实际裁片数量为 0',
  MISSING_CUT_ORDER: '缺少裁片单',
  MISSING_MATERIAL_IDENTITY: '缺少面料信息',
  MISSING_PATTERN_IDENTITY: '缺少纸样信息',
  DIFFERENCE_PENDING: '差异尚未处理',
  FEI_TICKET_ALREADY_GENERATED: '已生成菲票',
}

function hasMaterialIdentity(identity: CuttingMaterialIdentity | null | undefined): boolean {
  return Boolean(
    normalizeText(identity?.materialSku)
    && normalizeText(identity?.materialName)
    && normalizeText(identity?.materialColor),
  )
}

function hasPatternIdentity(identity: CuttingPatternIdentity | null | undefined): boolean {
  return Boolean(
    normalizeText(identity?.patternFileId)
    && normalizeText(identity?.patternFileName)
    && normalizeText(identity?.patternVersion),
  )
}

function hasPendingBlockingDifference(differences: SpreadingDifference[]): boolean {
  return differences.some((difference) =>
    difference.differenceLevel === '需处理' &&
    (difference.handlingStatus === '待处理' || difference.handlingStatus === '处理中'),
  )
}

function resolveDifferenceHandlingStatusForSession(session: SpreadingSession): CuttingActualOutput['differenceHandlingStatus'] {
  const differences = listSpreadingDifferencesBySpreadingOrder(session.spreadingSessionId, {
    sessions: [session],
  }).filter((difference) => {
    if (difference.differenceId.includes('pda-feedback')) return false
    if (difference.differenceId.includes('-seed-') && session.sessionNo !== 'PB-2440') return false
    return true
  })
  if (!differences.length) return '无差异'
  if (hasPendingBlockingDifference(differences)) return '待处理'
  if (differences.some((difference) => difference.handlingStatus === '仅记录')) return '仅记录差异'
  return '继续补排'
}

function hasBlockingDifferenceForFeiGeneration(session: SpreadingSession): boolean {
  return resolveDifferenceHandlingStatusForSession(session) === '待处理'
}

export function evaluateFeiTicketGenerationEligibility(
  output: CuttingActualOutput | null,
): FeiTicketGenerationEligibility {
  const reasonCodes: FeiTicketGenerationReasonCode[] = []
  if (!output) {
    reasonCodes.push('MISSING_ACTUAL_OUTPUT')
    return {
      sourceOutputId: '',
      canGenerate: false,
      reasonCodes,
      reasonTexts: reasonCodes.map((code) => feiTicketGenerationReasonTextMap[code]),
    }
  }

  if (!normalizeText(output.spreadingOrderId)) reasonCodes.push('SPREADING_ORDER_NOT_FOUND')
  if (!normalizeText(output.cuttingCompletedAt)) reasonCodes.push('SPREADING_NOT_CUT_DONE')
  if (normalizePositiveInteger(output.actualPieceQty) <= 0) reasonCodes.push('ACTUAL_OUTPUT_ZERO')
  if (!normalizeText(output.cutOrderId)) reasonCodes.push('MISSING_CUT_ORDER')
  if (!hasMaterialIdentity(output.materialIdentity)) reasonCodes.push('MISSING_MATERIAL_IDENTITY')
  if (!hasPatternIdentity(output.patternIdentity)) reasonCodes.push('MISSING_PATTERN_IDENTITY')
  if (output.differenceHandlingStatus === '待处理' || output.differenceHandlingStatus === '需要补录') {
    reasonCodes.push('DIFFERENCE_PENDING')
  }
  if (output.generatedFeiTicketIds.length) reasonCodes.push('FEI_TICKET_ALREADY_GENERATED')

  return {
    sourceOutputId: output.outputId,
    canGenerate: reasonCodes.length === 0,
    reasonCodes,
    reasonTexts: reasonCodes.map((code) => feiTicketGenerationReasonTextMap[code]),
  }
}

function resolveSecondaryCrafts(productionOrderId: string): {
  secondaryCrafts: string[]
  craftSequenceVersion: string
} {
  const snapshot = getProductionOrderTechPackSnapshot(productionOrderId)
  const processEntries = snapshot?.processEntries || []
  const secondaryCrafts = unique(
    processEntries
      .filter((entry) => entry.isSpecialCraft)
      .map((entry) => normalizeText(entry.craftName) || normalizeText(entry.processName))
      .filter(Boolean),
  )

  return {
    secondaryCrafts,
    craftSequenceVersion: `${normalizeText(snapshot?.sourceTechPackVersionLabel) || 'v0'}:${secondaryCrafts.length || 0}`,
  }
}

function getReceiverFactoryType(
  category: FeiTicketSpecialCraftCategory,
  seed?: SpecialCraftDedicatedFactorySeed,
): FeiTicketSpecialCraftReceiverFactoryType {
  if (seed?.factoryType === 'CENTRAL_SPECIAL') return '特种工艺厂'
  if (seed?.factoryType === 'CENTRAL_AUX') return '辅助工艺厂'
  return category === '特种工艺' ? '特种工艺厂' : '辅助工艺厂'
}

function getSpecialCraftReceiverFactory(
  operationId: string | undefined,
  category: FeiTicketSpecialCraftCategory,
): Pick<
  FeiTicketSpecialCraft,
  'receiverFactoryId' | 'receiverFactoryCode' | 'receiverFactoryName' | 'receiverFactoryType'
> {
  if (!operationId) {
    return {
      receiverFactoryId: 'PENDING-SPECIAL-CRAFT-FACTORY',
      receiverFactoryCode: '待补充',
      receiverFactoryName: '承接工厂待补充',
      receiverFactoryType: '其他',
    }
  }

  if (operationId === 'CUTTING-INTERNAL-BINDING-STRIP') {
    return {
      receiverFactoryId: 'CUTTING-INTERNAL-CRAFT-GROUP',
      receiverFactoryCode: 'CUT-INTERNAL-001',
      receiverFactoryName: '裁床内部工艺组',
      receiverFactoryType: '内部裁床工艺',
    }
  }

  const seed = getDedicatedSpecialCraftFactorySeed(operationId)
  if (!seed) {
    return {
      receiverFactoryId: 'PENDING-SPECIAL-CRAFT-FACTORY',
      receiverFactoryCode: '待补充',
      receiverFactoryName: '承接工厂待补充',
      receiverFactoryType: '其他',
    }
  }

  return {
    receiverFactoryId: seed.factoryId,
    receiverFactoryCode: seed.factoryCode,
    receiverFactoryName: seed.factoryName,
    receiverFactoryType: getReceiverFactoryType(category, seed),
  }
}

function createFeiTicketSpecialCraft(
  line: SpreadingPieceOutputLine,
  options: {
    index: number
    craftCategory: FeiTicketSpecialCraftCategory
    craftType: string
    operationId?: string
    requirementSource: FeiTicketSpecialCraftRequirementSource
    remark?: string
  },
): FeiTicketSpecialCraft {
  const receiverFactory = getSpecialCraftReceiverFactory(options.operationId, options.craftCategory)
  return {
    specialCraftId: `${line.outputLineId}-special-craft-${String(options.index + 1).padStart(2, '0')}`,
    craftCategory: options.craftCategory,
    craftType: options.craftType,
    craftName: options.craftType,
    ...receiverFactory,
    affectedPartCode: line.partCode,
    affectedPartName: line.partName,
    affectedSize: line.sizeCode,
    affectedPieceQty: Math.max(line.actualCutPieceQty || line.bundleQty || 1, 1),
    requirementSource: options.requirementSource,
    handoverStatus: '未交出',
    returnStatus: '未回仓',
    remark: options.remark || '',
  }
}

function buildFeiTicketSpecialCrafts(
  line: SpreadingPieceOutputLine,
  sequenceNo: number,
): FeiTicketSpecialCraft[] {
  const scenarioIndex = (sequenceNo - 1) % 8
  const seedCrafts: Array<Omit<Parameters<typeof createFeiTicketSpecialCraft>[1], 'index'>> = []

  if (scenarioIndex === 1) {
    seedCrafts.push({
      craftCategory: '辅助工艺',
      craftType: '绣花',
      operationId: 'AUX-OP-EMBROIDERY',
      requirementSource: '技术包',
    })
  }

  if (scenarioIndex === 2) {
    seedCrafts.push({
      craftCategory: '特种工艺',
      craftType: '模板工序',
      operationId: 'SPC-OP-TEMPLATE-PROCESS',
      requirementSource: '裁片单明细',
    })
  }

  if (scenarioIndex === 3) {
    seedCrafts.push(
      {
        craftCategory: '辅助工艺',
        craftType: '绣花',
        operationId: 'AUX-OP-EMBROIDERY',
        requirementSource: '技术包',
      },
      {
        craftCategory: '辅助工艺',
        craftType: '压褶',
        operationId: 'AUX-OP-PLEATING',
        requirementSource: '裁片单明细',
      },
      {
        craftCategory: '特种工艺',
        craftType: '模板工序',
        operationId: 'SPC-OP-TEMPLATE-PROCESS',
        requirementSource: '实际裁剪产出',
      },
    )
  }

  if (scenarioIndex === 4) {
    seedCrafts.push(
      {
        craftCategory: '辅助工艺',
        craftType: '压褶',
        operationId: 'AUX-OP-PLEATING',
        requirementSource: '裁片单明细',
      },
      {
        craftCategory: '特种工艺',
        craftType: '激光开袋',
        operationId: 'SPC-OP-LASER-POCKET',
        requirementSource: '实际裁剪产出',
      },
    )
  }

  if (scenarioIndex === 5) {
    seedCrafts.push({
      craftCategory: '特种工艺',
      craftType: '激光定位裁',
      requirementSource: '人工修正',
      remark: '工艺类型明确，承接工厂尚未维护。',
    })
  }

  if (scenarioIndex === 6) {
    seedCrafts.push({
      craftCategory: '辅助工艺',
      craftType: '捆条',
      operationId: 'CUTTING-INTERNAL-BINDING-STRIP',
      requirementSource: '裁片单明细',
      remark: '捆条在裁床内部工艺组承接。',
    })
  }

  if (scenarioIndex === 7) {
    seedCrafts.push({
      craftCategory: '辅助工艺',
      craftType: '直喷',
      operationId: 'AUX-OP-DIRECT-PRINT',
      requirementSource: '技术包',
    })
  }

  return seedCrafts.map((craft, index) => createFeiTicketSpecialCraft(line, { ...craft, index }))
}

export function formatFeiTicketSpecialCraftDisplayLabel(crafts: FeiTicketSpecialCraft[]): string {
  if (!crafts.length) return '无'
  return crafts
    .map((craft) => `${craft.craftType} / ${craft.receiverFactoryName || '承接工厂待补充'}`)
    .join('；')
}

function derivePieceSequenceMarkerMode(sequenceNo: number, fallbackMode: MarkerModeKey): MarkerModeKey {
  const scenarioIndex = (sequenceNo - 1) % 8
  if (scenarioIndex === 2 || scenarioIndex === 3) return 'high_low'
  if (scenarioIndex === 4) return 'fold_normal'
  if (scenarioIndex === 5) return 'fold_high_low'
  return fallbackMode
}

function derivePieceSequenceSizeGroupId(size: string, markerMode: MarkerModeKey, sequenceNo = 1): string {
  if (!isHighLowPieceSequenceMode(markerMode)) return '整床'
  const scenarioIndex = (sequenceNo - 1) % 8
  if (scenarioIndex === 2) return 'S组'
  if (scenarioIndex === 3) return 'M组'
  if (scenarioIndex === 5) return 'S组'
  return `${normalizeText(size) || '均码'}组`
}

function derivePieceSequenceLayerCount(
  line: SpreadingPieceOutputLine,
  markerMode: MarkerModeKey,
  sequenceNo: number,
): { actualLayerCount: number; actualLayerSource: PieceSequenceRange['actualLayerSource']; reason: string } {
  if (isHighLowPieceSequenceMode(markerMode)) {
    const scenarioIndex = (sequenceNo - 1) % 8
    if (scenarioIndex === 2 || scenarioIndex === 5) {
      return { actualLayerCount: 40, actualLayerSource: '实铺层数', reason: '' }
    }
    if (scenarioIndex === 3) {
      return { actualLayerCount: 60, actualLayerSource: '实铺层数', reason: '' }
    }
  }

  const actualLayerCount = normalizePositiveInteger(line.layerCount || 0)
  if (actualLayerCount > 0) {
    return { actualLayerCount, actualLayerSource: '实铺层数', reason: '' }
  }

  const actualPieceQty = normalizePositiveInteger(line.actualCutPieceQty || 0)
  if (actualPieceQty > 0) {
    return { actualLayerCount: actualPieceQty, actualLayerSource: '实际裁剪产出', reason: '' }
  }

  return { actualLayerCount: 0, actualLayerSource: '实际裁剪产出', reason: '缺少实铺层数和实际裁剪产出' }
}

function buildPieceSequenceRange(
  line: SpreadingPieceOutputLine,
  sequenceNo: number,
  issuedAt: string,
): { range: PieceSequenceRange | null; label: string; reason: string } {
  const markerMode = derivePieceSequenceMarkerMode(sequenceNo, line.markerMode)
  const { actualLayerCount, actualLayerSource, reason } = derivePieceSequenceLayerCount(line, markerMode, sequenceNo)
  if (reason || actualLayerCount <= 0) {
    return { range: null, label: '不可生成', reason: reason || '缺少实际裁剪产出' }
  }

  const startNo = 1
  const endNo = actualLayerCount
  const rangeLabel = formatPieceSequenceRangeLabel(startNo, endNo)
  return {
    label: rangeLabel,
    reason: '',
    range: {
      basis: '床次层序',
      ruleVersion: 'piece-sequence-v1',
      spreadingOrderId: line.spreadingSessionId,
      spreadingOrderNo: line.sourceSpreadingSessionNo,
      markerPlanId: line.markerPlanId || '',
      markerPlanNo: line.markerPlanNo || '',
      markerNumber: line.sourceMarkerNo,
      bedNo: line.sourceMarkerNo,
      markerMode,
      size: line.sizeCode,
      sizeGroupId: derivePieceSequenceSizeGroupId(line.sizeCode, markerMode, sequenceNo),
      partCode: line.partCode,
      partName: line.partName,
      partInstanceNo: line.partInstanceNo,
      startNo,
      endNo,
      rangeLabel,
      actualLayerCount,
      actualLayerSource,
      actualPieceQty: Math.max(line.actualCutPieceQty || line.bundleQty || 1, 1),
      unit: '片',
      generatedAt: issuedAt,
    },
  }
}

function buildFallbackSkuScope(record: GeneratedCutOrderSourceRecord): GeneratedCutOrderSkuScopeLine[] {
  if (record.skuScopeLines.length) return record.skuScopeLines
  return [
    {
      skuCode: record.cutOrderNo,
      color: record.colorScope[0] || '待补颜色',
      size: '均码',
      plannedQty: Math.max(record.requiredQty, 1),
    },
  ]
}

function buildFallbackPieceRows(record: GeneratedCutOrderSourceRecord): GeneratedCutOrderPieceRow[] {
  if (record.pieceRows.length) return record.pieceRows
  return [
    {
      partCode: record.materialSku,
      partName: record.pieceSummary || '整单裁片',
      pieceCountPerUnit: 1,
      patternId: '',
      patternName: '',
      applicableSkuCodes: [],
    },
  ]
}

function buildFeiTicketNo(cutOrderNo: string, sequenceNo: number): string {
  return `FT-${cutOrderNo}-${String(sequenceNo).padStart(3, '0')}`
}

function normalizePositiveInteger(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(Math.round(value), 0)
}

function hasActualCutOutput(session: SpreadingSession): boolean {
  const sessionActual = normalizePositiveInteger((session.actualCutGarmentQty ?? session.actualCutPieceQty) || 0)
  if (sessionActual > 0) return true
  return (session.rolls || []).some((roll) =>
    normalizePositiveInteger((roll.actualCutGarmentQty ?? roll.actualCutPieceQty) || 0) > 0 ||
    normalizePositiveInteger(roll.layerCount || 0) > 0,
  )
}

function isReadyForFeiGeneration(session: SpreadingSession): boolean {
  if (session.status !== 'DONE') return false
  if (session.cuttingStatus !== 'CUTTING_DONE') return false
  if (!hasActualCutOutput(session)) return false
  if (hasBlockingDifferenceForFeiGeneration(session)) return false
  const warning = session.replenishmentWarning
  if (!warning) return true
  if (warning.suggestedAction === '无需补料') return true
  return Boolean(warning.handled)
}

function resolveSourceRecordForLine(
  sourceRecords: GeneratedCutOrderSourceRecord[],
  line: {
    cutOrderId: string
    materialSku: string
  },
): GeneratedCutOrderSourceRecord | null {
  return (
    sourceRecords.find(
      (record) =>
        record.cutOrderId === line.cutOrderId &&
        normalizeText(record.materialSku) === normalizeText(line.materialSku),
    ) ||
    sourceRecords.find((record) => record.cutOrderId === line.cutOrderId) ||
    null
  )
}

function resolveColorScopedSkuLines(
  sourceRecord: GeneratedCutOrderSourceRecord,
  color: string,
): GeneratedCutOrderSkuScopeLine[] {
  const scoped = buildFallbackSkuScope(sourceRecord).filter((line) => normalizeText(line.color) === normalizeText(color))
  return scoped.length ? scoped : buildFallbackSkuScope(sourceRecord)
}

function splitGarmentQtyBySize(
  skuScopeLines: GeneratedCutOrderSkuScopeLine[],
  targetGarmentQty: number,
): Array<{ skuCode: string; color: string; size: string; garmentQty: number }> {
  const normalizedTarget = normalizePositiveInteger(targetGarmentQty)
  if (!normalizedTarget) return []

  const normalizedLines = (skuScopeLines.length ? skuScopeLines : buildFallbackSkuScope(({
    cutOrderId: '',
    cutOrderNo: '',
    productionOrderId: '',
    productionOrderNo: '',
    materialSku: '',
    colorScope: ['待补颜色'],
    skuScopeLines: [],
    pieceRows: [],
    requiredQty: normalizedTarget,
    pieceSummary: '',
    sourceTechPackSpuCode: '',
  } as unknown) as GeneratedCutOrderSourceRecord)).map((line, index) => ({
    skuCode: normalizeText(line.skuCode) || `SKU-${index + 1}`,
    color: normalizeText(line.color) || '待补颜色',
    size: normalizeText(line.size) || '均码',
    plannedQty: Math.max(Number(line.plannedQty || 0), 0),
  }))

  const plannedTotal = normalizedLines.reduce((sum, line) => sum + line.plannedQty, 0)
  if (plannedTotal <= 0) {
    return [
      {
        skuCode: normalizedLines[0]?.skuCode || 'SKU-001',
        color: normalizedLines[0]?.color || '待补颜色',
        size: normalizedLines[0]?.size || '均码',
        garmentQty: normalizedTarget,
      },
    ]
  }

  const rawRows = normalizedLines.map((line, index) => {
    const rawQty = (line.plannedQty / plannedTotal) * normalizedTarget
    const floorQty = Math.floor(rawQty)
    return {
      index,
      skuCode: line.skuCode,
      color: line.color,
      size: line.size,
      floorQty,
      fraction: rawQty - floorQty,
    }
  })

  let remainder = normalizedTarget - rawRows.reduce((sum, row) => sum + row.floorQty, 0)
  rawRows
    .slice()
    .sort((left, right) => right.fraction - left.fraction || right.floorQty - left.floorQty || left.index - right.index)
    .forEach((row) => {
      if (remainder <= 0) return
      rawRows[row.index] = {
        ...rawRows[row.index],
        floorQty: rawRows[row.index].floorQty + 1,
      }
      remainder -= 1
    })

  return rawRows
    .filter((row) => row.floorQty > 0)
    .map((row) => ({
      skuCode: row.skuCode,
      color: row.color,
      size: row.size,
      garmentQty: row.floorQty,
    }))
}

function buildBundleNo(index: number): string {
  return `BUNDLE-${String(index + 1).padStart(3, '0')}`
}

function readStoredMarkerSpreadingStore(): MarkerSpreadingStore {
  const storage = typeof localStorage !== 'undefined' && typeof localStorage.getItem === 'function'
    ? localStorage
    : null
  if (!storage) return createEmptyStore()
  const raw = storage.getItem(CUTTING_MARKER_SPREADING_LEDGER_STORAGE_KEY)
  if (!raw) return createEmptyStore()
  try {
    return deserializeMarkerSpreadingStorage(raw)
  } catch {
    return createEmptyStore()
  }
}

function buildCompletedSpreadingSeedStore(sourceRecords: GeneratedCutOrderSourceRecord[]): MarkerSpreadingStore {
  const seedRecords = ['CUT-260307-102-01', 'CUT-260307-102-02']
    .map((cutOrderNo) => sourceRecords.find((record) => record.cutOrderNo === cutOrderNo || record.cutOrderId === cutOrderNo))
    .filter((record): record is GeneratedCutOrderSourceRecord => Boolean(record))
  if (!seedRecords.length) return createEmptyStore()

  const sessionId = 'spreading-session-marker-plan-ref-marker-plan-ref-mb-030102-02-planned-100-actual-80-c'
  const sessionNo = 'PB-2440'
  const markerPlanId = seedRecords[0]?.markerPlanId || 'marker-plan-ref:MB-030102-02'
  const markerPlanNo = seedRecords[0]?.markerPlanNo || 'MB-030102-02'
  const completedAt = '2026-03-14 20:00'
  const actualCutQuantities = [557, 613]
  const rolls = seedRecords.map((record, index) => {
    const color = record.colorScope[0] || (index === 0 ? 'Navy' : 'Khaki')
    const layerCount = index === 0 ? 50 : 30
    return {
      rollRecordId: `roll-step12-${record.cutOrderId}`,
      rollNo: `ROLL-STEP12-${index + 1}`,
      materialSku: record.materialSku,
      color,
      planUnitId: `plan-unit-step12-${record.cutOrderId}`,
      layerCount,
      actualCutGarmentQty: actualCutQuantities[index] || 0,
      actualCutPieceQty: actualCutQuantities[index] || 0,
      actualLength: index === 0 ? 35 : 31,
    }
  })
  const session = {
    spreadingSessionId: sessionId,
    sessionNo,
    status: 'DONE',
    cuttingStatus: 'CUTTING_DONE',
    cutOrderIds: seedRecords.map((record) => record.cutOrderId),
    cutOrderNos: seedRecords.map((record) => record.cutOrderNo),
    contextType: 'marker-plan-ref',
    markerPlanId,
    markerPlanNo,
    sourceMarkerId: 'seed-marker-marker-plan-ref-marker-plan-ref:MB-030102-02',
    sourceMarkerNo: 'A-1',
    markerId: 'seed-marker-marker-plan-ref-marker-plan-ref:MB-030102-02',
    markerNo: 'A-1',
    plannedLayers: 100,
    actualLayers: 80,
    actualCutPieceQty: actualCutQuantities.reduce((sum, value) => sum + value, 0),
    actualCutGarmentQty: actualCutQuantities.reduce((sum, value) => sum + value, 0),
    planUnits: seedRecords.map((record, index) => ({
      planUnitId: `plan-unit-step12-${record.cutOrderId}`,
      materialSku: record.materialSku,
      color: record.colorScope[0] || '',
      garmentQtyPerUnit: index === 0 ? 18 : 9,
      plannedRepeatCount: 100,
      plannedCutGarmentQty: index === 0 ? 1800 : 900,
    })),
    rolls,
    completionLinkage: {
      linkedCutOrderIds: seedRecords.map((record) => record.cutOrderId),
      linkedCutOrderNos: seedRecords.map((record) => record.cutOrderNo),
      completedAt,
      completedBy: '现场主管',
      generatedWarning: false,
    },
    replenishmentWarning: {
      warningId: `warning-${sessionId}`,
      spreadingSessionId: sessionId,
      sessionNo,
      cutOrderNos: seedRecords.map((record) => record.cutOrderNo),
      productionOrderNos: unique(seedRecords.map((record) => record.productionOrderNo)),
      materialSku: seedRecords.map((record) => record.materialSku).join(' / '),
      materialAttr: '',
      requiredQty: 0,
      actualCutQty: actualCutQuantities.reduce((sum, value) => sum + value, 0),
      actualCutGarmentQty: actualCutQuantities.reduce((sum, value) => sum + value, 0),
      shortageQty: 0,
      varianceLength: 0,
      warningLevel: '低',
      suggestedAction: '无需补料',
      handled: true,
      lines: seedRecords.map((record, index) => ({
        lineId: `spread-warning-line-step12-${index + 1}`,
        cutOrderId: record.cutOrderId,
        cutOrderNo: record.cutOrderNo,
        materialSku: record.materialSku,
        color: record.colorScope[0] || '',
        actualCutGarmentQty: actualCutQuantities[index] || 0,
      })),
      createdAt: completedAt,
      note: 'prototype：计划 100 层，按实际实铺 80 层完成裁剪。',
    },
    completedAt,
    completedBy: '现场主管',
    updatedAt: completedAt,
    updatedBy: '现场主管',
  } as unknown as SpreadingSession

  const cleanSessionId = 'spreading-session-fei-actual-output-ready-001'
  const cleanSessionNo = 'PB-2450'
  const cleanCompletedAt = '2026-03-20 17:40'
  const cleanActualCutQuantities = [620, 580]
  const cleanRolls = seedRecords.map((record, index) => {
    const color = record.colorScope[0] || (index === 0 ? 'Navy' : 'Khaki')
    return {
      rollRecordId: `roll-fei-ready-${record.cutOrderId}`,
      rollNo: `ROLL-FEI-READY-${index + 1}`,
      materialSku: record.materialSku,
      color,
      planUnitId: `plan-unit-fei-ready-${record.cutOrderId}`,
      layerCount: 80,
      actualCutGarmentQty: cleanActualCutQuantities[index] || 0,
      actualCutPieceQty: cleanActualCutQuantities[index] || 0,
      actualLength: index === 0 ? 72 : 68,
    }
  })
  const cleanSession = {
    spreadingSessionId: cleanSessionId,
    sessionNo: cleanSessionNo,
    status: 'DONE',
    cuttingStatus: 'CUTTING_DONE',
    cutOrderIds: seedRecords.map((record) => record.cutOrderId),
    cutOrderNos: seedRecords.map((record) => record.cutOrderNo),
    contextType: 'marker-plan-ref',
    markerPlanId,
    markerPlanNo,
    sourceMarkerId: 'seed-marker-fei-ready-bed-B-1',
    sourceMarkerNo: 'B-1',
    markerId: 'seed-marker-fei-ready-bed-B-1',
    markerNo: 'B-1',
    plannedLayers: 80,
    actualLayers: 80,
    actualCutPieceQty: cleanActualCutQuantities.reduce((sum, value) => sum + value, 0),
    actualCutGarmentQty: cleanActualCutQuantities.reduce((sum, value) => sum + value, 0),
    totalActualLength: 140,
    theoreticalSpreadTotalLength: 140,
    planUnits: seedRecords.map((record, index) => ({
      planUnitId: `plan-unit-fei-ready-${record.cutOrderId}`,
      materialSku: record.materialSku,
      color: record.colorScope[0] || '',
      garmentQtyPerUnit: 10,
      plannedRepeatCount: 60,
      plannedCutGarmentQty: cleanActualCutQuantities[index] || 0,
    })),
    rolls: cleanRolls,
    completionLinkage: {
      linkedCutOrderIds: seedRecords.map((record) => record.cutOrderId),
      linkedCutOrderNos: seedRecords.map((record) => record.cutOrderNo),
      completedAt: cleanCompletedAt,
      completedBy: '裁剪组长',
      generatedWarning: false,
    },
    replenishmentWarning: {
      warningId: `warning-${cleanSessionId}`,
      spreadingSessionId: cleanSessionId,
      sessionNo: cleanSessionNo,
      cutOrderNos: seedRecords.map((record) => record.cutOrderNo),
      productionOrderNos: unique(seedRecords.map((record) => record.productionOrderNo)),
      materialSku: seedRecords.map((record) => record.materialSku).join(' / '),
      materialAttr: '',
      requiredQty: cleanActualCutQuantities.reduce((sum, value) => sum + value, 0),
      actualCutQty: cleanActualCutQuantities.reduce((sum, value) => sum + value, 0),
      actualCutGarmentQty: cleanActualCutQuantities.reduce((sum, value) => sum + value, 0),
      shortageQty: 0,
      varianceLength: 0,
      warningLevel: '低',
      suggestedAction: '无需补料',
      handled: true,
      lines: seedRecords.map((record, index) => ({
        lineId: `spread-warning-line-fei-ready-${index + 1}`,
        cutOrderId: record.cutOrderId,
        cutOrderNo: record.cutOrderNo,
        materialSku: record.materialSku,
        color: record.colorScope[0] || '',
        actualCutGarmentQty: cleanActualCutQuantities[index] || 0,
      })),
      createdAt: cleanCompletedAt,
      note: 'prototype：实际裁剪产出已确认，无关键差异。',
    },
    completedAt: cleanCompletedAt,
    completedBy: '裁剪组长',
    updatedAt: cleanCompletedAt,
    updatedBy: '裁剪组长',
  } as unknown as SpreadingSession

  return {
    markers: [],
    sessions: [session, cleanSession],
  }
}

function readMarkerSpreadingStoreForFeiTickets(sourceRecords: GeneratedCutOrderSourceRecord[]): MarkerSpreadingStore {
  const store = readStoredMarkerSpreadingStore()
  const prototypeStore = buildCompletedSpreadingSeedStore(sourceRecords)
  const markersById = new Map<string, MarkerSpreadingStore['markers'][number]>()
  prototypeStore.markers.forEach((marker) => markersById.set(marker.markerId, marker))
  store.markers.forEach((marker) => markersById.set(marker.markerId, marker))

  const sessionsById = new Map<string, SpreadingSession>()
  prototypeStore.sessions.forEach((session) => sessionsById.set(session.spreadingSessionId, session))
  store.sessions.forEach((session) => sessionsById.set(session.spreadingSessionId, session))

  return {
    markers: Array.from(markersById.values()),
    sessions: Array.from(sessionsById.values()),
  }
}

type SpreadingOutputSourceLine = {
  cutOrderId: string
  cutOrderNo?: string
  materialSku: string
  color: string
  actualCutGarmentQty: number
  rollRecordId?: string
}

function findPieceRowsForSku(
  sourceRecord: GeneratedCutOrderSourceRecord,
  skuCode: string,
): GeneratedCutOrderPieceRow[] {
  const pieceRows = buildFallbackPieceRows(sourceRecord)
  const matched = pieceRows.filter((pieceRow) => {
    if (!pieceRow.applicableSkuCodes.length) return true
    return pieceRow.applicableSkuCodes.includes(skuCode)
  })
  return matched.length ? matched : pieceRows
}

function listSessionSourceRecords(
  session: SpreadingSession,
  sourceRecords: GeneratedCutOrderSourceRecord[],
): GeneratedCutOrderSourceRecord[] {
  const cutOrderIds = new Set([
    ...(session.cutOrderIds || []),
    ...(session.completionLinkage?.linkedCutOrderIds || []),
  ].map(normalizeText).filter(Boolean))
  const cutOrderNos = new Set((session.completionLinkage?.linkedCutOrderNos || []).map(normalizeText).filter(Boolean))

  const matched = sourceRecords.filter((record) =>
    cutOrderIds.has(record.cutOrderId) ||
    cutOrderNos.has(record.cutOrderNo),
  )
  if (matched.length) return matched

  const sessionMaterialSkus = new Set([
    ...(session.planUnits || []).map((unit) => unit.materialSku),
    ...(session.rolls || []).map((roll) => roll.materialSku),
    session.materialSkuSummary || '',
  ].map(normalizeText).filter(Boolean))
  const sessionColors = new Set([
    ...(session.planUnits || []).map((unit) => unit.color),
    ...(session.rolls || []).map((roll) => roll.color || ''),
    ...(session.colorSummary || '').split('/'),
  ].map(normalizeText).filter(Boolean))

  return sourceRecords.filter((record) => {
    const materialMatched = sessionMaterialSkus.has(normalizeText(record.materialSku))
    const colorMatched = record.colorScope.some((color) => sessionColors.has(normalizeText(color)))
    return materialMatched && colorMatched
  })
}

function findSourceRecordForRoll(
  session: SpreadingSession,
  sourceRecords: GeneratedCutOrderSourceRecord[],
  roll: SpreadingSession['rolls'][number],
): GeneratedCutOrderSourceRecord | null {
  const candidates = listSessionSourceRecords(session, sourceRecords)
  if (!candidates.length) return null

  const rollMaterialSku = normalizeText(roll.materialSku)
  const rollColor = normalizeText(roll.color || '')
  return (
    candidates.find(
      (record) =>
        normalizeText(record.materialSku) === rollMaterialSku &&
        record.colorScope.some((color) => normalizeText(color) === rollColor),
    ) ||
    candidates.find((record) => normalizeText(record.materialSku) === rollMaterialSku) ||
    candidates.find((record) => record.colorScope.some((color) => normalizeText(color) === rollColor)) ||
    candidates[0] ||
    null
  )
}

function deriveRollActualGarmentQty(session: SpreadingSession, roll: SpreadingSession['rolls'][number]): number {
  const explicitQty = normalizePositiveInteger((roll.actualCutGarmentQty ?? roll.actualCutPieceQty) || 0)
  if (explicitQty > 0) return explicitQty
  const planUnit = (session.planUnits || []).find((unit) => unit.planUnitId === roll.planUnitId) || session.planUnits?.[0] || null
  return normalizePositiveInteger(Number(roll.layerCount || 0) * Number(planUnit?.garmentQtyPerUnit || 0))
}

function buildFallbackOutputSourceLines(
  session: SpreadingSession,
  sourceRecords: GeneratedCutOrderSourceRecord[],
): SpreadingOutputSourceLine[] {
  return (session.rolls || [])
    .map((roll): SpreadingOutputSourceLine | null => {
      const sourceRecord = findSourceRecordForRoll(session, sourceRecords, roll)
      const actualCutGarmentQty = deriveRollActualGarmentQty(session, roll)
      if (!sourceRecord || !actualCutGarmentQty) return null
      return {
        cutOrderId: sourceRecord.cutOrderId,
        cutOrderNo: sourceRecord.cutOrderNo,
        materialSku: normalizeText(roll.materialSku) || sourceRecord.materialSku,
        color: normalizeText(roll.color || '') || sourceRecord.colorScope[0] || '待补颜色',
        actualCutGarmentQty,
        rollRecordId: roll.rollRecordId,
      }
    })
    .filter((line): line is SpreadingOutputSourceLine => Boolean(line))
}

function listOutputSourceLinesForSession(
  session: SpreadingSession,
  sourceRecords: GeneratedCutOrderSourceRecord[],
): SpreadingOutputSourceLine[] {
  const warningLines = (session.replenishmentWarning?.lines || [])
    .map((line) => ({
      cutOrderId: line.cutOrderId,
      cutOrderNo: line.cutOrderNo,
      materialSku: line.materialSku,
      color: line.color,
      actualCutGarmentQty: normalizePositiveInteger(line.actualCutGarmentQty || 0),
    }))
    .filter((line) => line.actualCutGarmentQty > 0)
  return warningLines.length ? warningLines : buildFallbackOutputSourceLines(session, sourceRecords)
}

function normalizePieceSequenceMarkerMode(value: string | undefined): MarkerModeKey {
  if (value === 'high_low' || value === 'HIGH_LOW' || value === 'high-low') return 'high_low'
  if (value === 'fold_normal' || value === 'FOLD_NORMAL' || value === 'FOLD' || value === 'folded') return 'fold_normal'
  if (value === 'fold_high_low' || value === 'FOLD_HIGH_LOW') return 'fold_high_low'
  return 'normal'
}

function buildSpreadingPieceOutputLinesFromSessions(
  sourceRecords: GeneratedCutOrderSourceRecord[],
): SpreadingPieceOutputLine[] {
  const store = readMarkerSpreadingStoreForFeiTickets(sourceRecords)
  const outputLines: SpreadingPieceOutputLine[] = []

  store.sessions
    .filter(isReadyForFeiGeneration)
    .forEach((session) => {
      const outputSourceLines = listOutputSourceLinesForSession(session, sourceRecords)
      outputSourceLines.forEach((line, lineIndex) => {
        const sourceRecord = resolveSourceRecordForLine(sourceRecords, line)
        const roll =
          (line.rollRecordId ? session.rolls.find((item) => item.rollRecordId === line.rollRecordId) : null) ||
          session.rolls.find(
            (item) =>
              normalizeText(item.materialSku) === normalizeText(line.materialSku)
              && normalizeText(item.color) === normalizeText(line.color),
          ) || session.rolls[0] || null
        if (!sourceRecord || !roll) return

        const splitRows = splitGarmentQtyBySize(resolveColorScopedSkuLines(sourceRecord, line.color), line.actualCutGarmentQty)
        splitRows.forEach((sizeRow, sizeIndex) => {
          const bundleNo = buildBundleNo(sizeIndex)
          const pieceSetNoStart = 1
          const pieceSetNoEnd = Math.max(sizeRow.garmentQty, 1)
          const pieceSetNoRange = formatPieceSetRange(pieceSetNoStart, pieceSetNoEnd)
          const baseMarkerMode = normalizePieceSequenceMarkerMode(session.sourceBedMode || session.spreadingMode)
          findPieceRowsForSku(sourceRecord, sizeRow.skuCode).forEach((pieceRow, partIndex) => {
            const pieceRepeatCount = Math.max(Number(pieceRow.pieceCountPerUnit || 0), 1)
            Array.from({ length: pieceRepeatCount }, (_, instanceIndex) => instanceIndex + 1).forEach((partInstanceNo) => {
              const partInstanceLabel = pieceRepeatCount > 1 ? String(partInstanceNo) : ''
              outputLines.push({
                outputLineId: [
                  session.spreadingSessionId,
                  normalizeText(roll.rollRecordId) || `roll-${lineIndex + 1}`,
                  normalizeText(sizeRow.size) || `size-${sizeIndex + 1}`,
                  normalizeText(pieceRow.partCode) || `part-${partIndex + 1}`,
                  partInstanceLabel || 'single',
                  bundleNo,
                ].join('__'),
                spreadingSessionId: session.spreadingSessionId,
                sourceSpreadingSessionNo: session.sessionNo || session.spreadingSessionId,
                sourceMarkerId: session.sourceMarkerId || session.markerId || '',
                sourceMarkerNo: session.sourceMarkerNo || session.markerNo || session.sourceBedNo || session.sourceSchemeNo || session.markerId || '',
                sourceMarkerLineItemId: `${session.spreadingSessionId}-${lineIndex + 1}`,
                cutOrderId: sourceRecord.cutOrderId,
                cutOrderNo: sourceRecord.cutOrderNo,
                markerPlanId: session.markerPlanId || sourceRecord.markerPlanId || '',
                markerPlanNo: session.markerPlanNo || sourceRecord.markerPlanNo || '',
                productionOrderId: sourceRecord.productionOrderId,
                productionOrderNo: sourceRecord.productionOrderNo,
                fabricRollId: roll.rollRecordId,
                fabricRollNo: normalizeBusinessText(roll.rollNo, '待补卷号'),
                fabricColor: normalizeBusinessText(line.color || roll.color, '待补颜色'),
                materialSku: normalizeBusinessText(line.materialSku, sourceRecord.materialSku),
                garmentSkuId: normalizeBusinessText(sizeRow.skuCode, sourceRecord.cutOrderNo),
                garmentColor: normalizeBusinessText(sizeRow.color, line.color || roll.color || '待补颜色'),
                sizeCode: normalizeBusinessText(sizeRow.size, '均码'),
                partCode: normalizeBusinessText(pieceRow.partCode, pieceRow.partName),
                partName: normalizeBusinessText(pieceRow.partName, '整单裁片'),
                partInstanceNo: partInstanceLabel,
                pieceCountPerGarment: 1,
                bundleNo,
                bundleQty: Math.max(sizeRow.garmentQty, 1),
                pieceSetNoStart,
                pieceSetNoEnd,
                pieceSetNoRange,
                bundleTicketType: '扎束菲票',
                layerCount: Math.max(Number(roll.layerCount || 0), 0),
                markerMode: baseMarkerMode,
                sizeGroupId: derivePieceSequenceSizeGroupId(sizeRow.size, baseMarkerMode),
                actualCutPieceQty: Math.max(sizeRow.garmentQty, 1),
                actualCutGarmentQty: Math.max(sizeRow.garmentQty, 1),
                sourceBasis: FEI_TICKET_SOURCE_BASIS,
                sourceBasisType: FEI_TICKET_SOURCE_BASIS_TYPE,
                createdBy: (session as { completedBy?: string; updatedBy?: string }).completedBy || (session as { completedBy?: string; updatedBy?: string }).updatedBy || '裁床组长',
                createdAt: (session as { completedAt?: string; updatedAt?: string }).completedAt || session.updatedAt || '',
              })
            })
          })
        })
      })
    })

  return outputLines
}

function buildCuttingActualOutputFromLine(
  line: SpreadingPieceOutputLine,
  sourceRecord: GeneratedCutOrderSourceRecord | null,
): CuttingActualOutput {
  const outputNo = `OUT-${line.cutOrderNo}-${line.sourceSpreadingSessionNo}-${line.sizeCode}-${line.partCode}`.replace(/\s+/g, '-')
  return {
    outputId: line.outputLineId,
    outputNo,
    productionOrderId: line.productionOrderId,
    productionOrderNo: line.productionOrderNo,
    cutOrderId: line.cutOrderId,
    cutOrderNo: line.cutOrderNo,
    markerPlanId: line.markerPlanId || '',
    markerPlanNo: line.markerPlanNo || '',
    markerNumber: line.sourceMarkerNo || '',
    bedNo: line.sourceMarkerNo || '',
    spreadingOrderId: line.spreadingSessionId,
    spreadingOrderNo: line.sourceSpreadingSessionNo,
    materialIdentity: sourceRecord?.materialIdentity || {
      materialSku: line.materialSku,
      materialName: line.materialSku,
      materialColor: line.fabricColor,
      materialAlias: line.materialSku,
      materialImageUrl: '',
      materialUnit: '米',
    },
    patternIdentity: sourceRecord?.patternIdentity || {
      patternFileId: '',
      patternFileName: '待补纸样文件',
      patternVersion: '待补',
      patternKind: '待补纸样类型',
      effectiveWidthValue: 0,
      effectiveWidthUnit: 'cm',
      piecePartCodes: [],
      piecePartNames: [],
    },
    spuId: sourceRecord?.spuCode || '',
    spuCode: sourceRecord?.spuCode || '',
    styleId: sourceRecord?.styleId || '',
    styleName: sourceRecord?.styleName || '',
    color: line.fabricColor,
    size: line.sizeCode,
    partCode: line.partCode,
    partName: line.partName,
    plannedGarmentQty: sourceRecord?.requiredQty || line.actualCutGarmentQty,
    plannedPieceQty: sourceRecord?.requiredQty || line.actualCutPieceQty,
    actualGarmentQty: line.actualCutGarmentQty,
    actualPieceQty: line.actualCutPieceQty,
    actualLayerCount: line.layerCount,
    actualMaterialUsage: 0,
    actualMaterialUsageUnit: sourceRecord?.materialIdentity.materialUnit || '米',
    cuttingCompletedAt: line.createdAt,
    cuttingCompletedBy: line.createdBy,
    differenceHandlingStatus: '无差异',
    canGenerateFeiTicket: true,
    generatedFeiTicketIds: [],
  }
}

export function listCuttingActualOutputs(
  sourceRecords: GeneratedCutOrderSourceRecord[] = listGeneratedCutOrderSourceRecords(),
): CuttingActualOutput[] {
  return listSpreadingPieceOutputLines(sourceRecords).map((line) => {
    const sourceRecord =
      sourceRecords.find((record) => record.cutOrderId === line.cutOrderId && record.productionOrderId === line.productionOrderId)
      || sourceRecords.find((record) => record.cutOrderId === line.cutOrderId)
      || null
    const output = buildCuttingActualOutputFromLine(line, sourceRecord)
    const eligibility = evaluateFeiTicketGenerationEligibility(output)
    return {
      ...output,
      canGenerateFeiTicket: eligibility.canGenerate,
    }
  })
}

function cloneActualOutput(output: CuttingActualOutput, overrides: Partial<CuttingActualOutput>): CuttingActualOutput {
  return {
    ...output,
    ...overrides,
    materialIdentity: {
      ...output.materialIdentity,
      ...(overrides.materialIdentity || {}),
    },
    patternIdentity: {
      ...output.patternIdentity,
      ...(overrides.patternIdentity || {}),
      piecePartCodes: [...(overrides.patternIdentity?.piecePartCodes || output.patternIdentity.piecePartCodes)],
      piecePartNames: [...(overrides.patternIdentity?.piecePartNames || output.patternIdentity.piecePartNames)],
    },
    generatedFeiTicketIds: [...(overrides.generatedFeiTicketIds || output.generatedFeiTicketIds)],
  }
}

export function listFeiTicketGenerationEligibilityRows(): FeiTicketGenerationEligibilityRow[] {
  const baseOutput = listCuttingActualOutputs()[0]
  if (!baseOutput) {
    const eligibility = evaluateFeiTicketGenerationEligibility(null)
    return [{ scenarioLabel: '缺少实际裁剪产出', output: null, eligibility }]
  }

  const rows: Array<{ scenarioLabel: string; output: CuttingActualOutput | null }> = [
    { scenarioLabel: '已裁剪且有实际裁剪产出', output: baseOutput },
    {
      scenarioLabel: '铺布单未裁剪',
      output: cloneActualOutput(baseOutput, {
        outputId: `${baseOutput.outputId}__not-cut`,
        spreadingOrderId: `${baseOutput.spreadingOrderId}-not-cut`,
        cuttingCompletedAt: '',
        actualPieceQty: Math.max(baseOutput.actualPieceQty, 1),
        generatedFeiTicketIds: [],
      }),
    },
    {
      scenarioLabel: '实际裁片数量为 0',
      output: cloneActualOutput(baseOutput, {
        outputId: `${baseOutput.outputId}__zero-output`,
        actualPieceQty: 0,
        actualGarmentQty: 0,
        generatedFeiTicketIds: [],
      }),
    },
    {
      scenarioLabel: '缺少裁片单',
      output: cloneActualOutput(baseOutput, {
        outputId: `${baseOutput.outputId}__missing-cut-order`,
        cutOrderId: '',
        cutOrderNo: '',
        generatedFeiTicketIds: [],
      }),
    },
    {
      scenarioLabel: '缺少面料或纸样',
      output: cloneActualOutput(baseOutput, {
        outputId: `${baseOutput.outputId}__missing-identity`,
        materialIdentity: {
          ...baseOutput.materialIdentity,
          materialSku: '',
          materialName: '',
          materialColor: '',
        },
        patternIdentity: {
          ...baseOutput.patternIdentity,
          patternFileId: '',
          patternFileName: '',
          patternVersion: '',
        },
        generatedFeiTicketIds: [],
      }),
    },
    {
      scenarioLabel: '差异尚未处理',
      output: cloneActualOutput(baseOutput, {
        outputId: `${baseOutput.outputId}__pending-difference`,
        differenceHandlingStatus: '待处理',
        generatedFeiTicketIds: [],
      }),
    },
    {
      scenarioLabel: '差异已处理为仅记录差异',
      output: cloneActualOutput(baseOutput, {
        outputId: `${baseOutput.outputId}__record-only`,
        differenceHandlingStatus: '仅记录差异',
        generatedFeiTicketIds: [],
      }),
    },
    {
      scenarioLabel: '差异已处理为继续补排',
      output: cloneActualOutput(baseOutput, {
        outputId: `${baseOutput.outputId}__continue-recut`,
        differenceHandlingStatus: '继续补排',
        generatedFeiTicketIds: [],
      }),
    },
    {
      scenarioLabel: '同一实际裁剪产出已生成菲票',
      output: cloneActualOutput(baseOutput, {
        outputId: `${baseOutput.outputId}__already-generated`,
        generatedFeiTicketIds: [`ticket-${baseOutput.outputId}`],
      }),
    },
  ]

  return rows.map((row) => ({
    scenarioLabel: row.scenarioLabel,
    output: row.output,
    eligibility: evaluateFeiTicketGenerationEligibility(row.output),
  }))
}

function buildFeiRecordsFromSpreadingSessions(
  sourceRecords: GeneratedCutOrderSourceRecord[],
): GeneratedFeiTicketSourceRecord[] {
  const outputLines = listSpreadingPieceOutputLines(sourceRecords)
  const secondaryCraftMetaByProductionOrderId = new Map<string, ReturnType<typeof resolveSecondaryCrafts>>()

  const records = outputLines.map((line, index) => {
    const sourceRecord =
      sourceRecords.find((item) => item.cutOrderId === line.cutOrderId && item.productionOrderId === line.productionOrderId)
      || sourceRecords.find((item) => item.cutOrderId === line.cutOrderId)
      || null
    const sourceTechPackSpuCode = sourceRecord?.sourceTechPackSpuCode || ''
    const secondaryCraftMeta =
      secondaryCraftMetaByProductionOrderId.get(line.productionOrderId)
      || resolveSecondaryCrafts(line.productionOrderId)
    secondaryCraftMetaByProductionOrderId.set(line.productionOrderId, secondaryCraftMeta)

    const sequenceNo = index + 1
    const feiTicketId = line.outputLineId
    const feiTicketNo = buildFeiTicketNo(line.cutOrderNo, sequenceNo)
    const pieceScope = unique([line.fabricRollNo, line.fabricColor, line.sizeCode, line.partName])
    const pieceGroup = normalizeText(line.partName) || normalizeText(line.partCode) || '整单裁片'
    const bundleScope = `${line.fabricRollNo}-${line.fabricColor}-${line.sizeCode}-${line.bundleNo}`
    const qty = Math.max(line.bundleQty, 1)
    const materialIdentity = sourceRecord?.materialIdentity || {
      materialSku: line.materialSku,
      materialName: line.materialSku,
      materialColor: line.fabricColor,
      materialAlias: line.materialSku,
      materialImageUrl: '',
      materialUnit: '米',
    }
    const patternIdentity = sourceRecord?.patternIdentity || {
      patternFileId: '',
      patternFileName: '待补纸样文件',
      patternVersion: '待补',
      patternKind: '待补纸样类型',
      effectiveWidthValue: 0,
      effectiveWidthUnit: 'cm',
      piecePartCodes: [],
      piecePartNames: [],
    }
    const specialCrafts = buildFeiTicketSpecialCrafts(line, sequenceNo)
    const secondaryCrafts = unique(specialCrafts.map((craft) => craft.craftName))
    const craftSequenceVersion = specialCrafts.length
      ? `actual-output-special-craft:${secondaryCrafts.join('+')}`
      : secondaryCraftMeta.craftSequenceVersion
    const currentCraftStage = secondaryCrafts[0] || ''
    const specialCraftDisplayLabel = formatFeiTicketSpecialCraftDisplayLabel(specialCrafts)
    const pieceSequence = buildPieceSequenceRange(line, sequenceNo, line.createdAt)
    const encoded = encodeFeiTicketQr({
      feiTicketId,
      feiTicketNo,
      cutOrderId: line.cutOrderId,
      cutOrderNo: line.cutOrderNo,
      productionOrderId: line.productionOrderId,
      productionOrderNo: line.productionOrderNo,
      markerPlanId: line.markerPlanId || '',
      markerPlanNo: line.markerPlanNo || '',
      markerNumber: line.sourceMarkerNo,
      bedNo: line.sourceMarkerNo,
      spreadingOrderId: line.spreadingSessionId,
      spreadingOrderNo: line.sourceSpreadingSessionNo,
      spuCode: sourceTechPackSpuCode,
      styleName: sourceRecord.styleName || sourceTechPackSpuCode,
      color: line.fabricColor,
      size: line.sizeCode,
      sourceOutputLineId: line.outputLineId,
      fabricRollId: line.fabricRollId,
      fabricRollNo: line.fabricRollNo,
      fabricColor: line.fabricColor,
      materialSku: line.materialSku,
      garmentSkuId: line.garmentSkuId,
      garmentColor: line.garmentColor,
      pieceScope,
      pieceGroup,
      bundleScope,
      skuColor: line.fabricColor,
      skuSize: line.sizeCode,
      partCode: line.partCode,
      partName: line.partName,
      pieceQty: line.actualCutPieceQty,
      garmentQty: Math.max(line.actualCutGarmentQty, 1),
      pieceSequenceLabel: pieceSequence.label,
      pieceSequenceStartNo: pieceSequence.range?.startNo || 0,
      pieceSequenceEndNo: pieceSequence.range?.endNo || 0,
      bundleNo: line.bundleNo,
      bundleQty: line.bundleQty,
      pieceSetNoStart: line.pieceSetNoStart,
      pieceSetNoEnd: line.pieceSetNoEnd,
      pieceSetNoRange: line.pieceSetNoRange,
      bundleTicketType: line.bundleTicketType,
      actualCutPieceQty: line.actualCutPieceQty,
      qty,
      hasSpecialCraft: specialCrafts.length > 0,
      specialCrafts: specialCrafts.map((craft) => ({
        craftCategory: craft.craftCategory,
        craftType: craft.craftType,
        receiverFactoryCode: craft.receiverFactoryCode,
        receiverFactoryName: craft.receiverFactoryName,
      })),
      feiTicketVersion: 'V1',
      secondaryCrafts,
      craftSequenceVersion,
      currentCraftStage,
      issuedAt: line.createdAt,
    })

    return {
      feiTicketId,
      feiTicketNo,
      sourceOutputLineId: line.outputLineId,
      sourceSpreadingSessionId: line.spreadingSessionId,
      sourceSpreadingSessionNo: line.sourceSpreadingSessionNo,
      sourceMarkerId: line.sourceMarkerId,
      sourceMarkerNo: line.sourceMarkerNo,
      cutOrderId: line.cutOrderId,
      cutOrderNo: line.cutOrderNo,
      productionOrderId: line.productionOrderId,
      productionOrderNo: line.productionOrderNo,
      sourceMarkerPlanId: line.markerPlanId || '',
      sourceMarkerPlanNo: line.markerPlanNo || '',
      fabricRollId: line.fabricRollId,
      fabricRollNo: line.fabricRollNo,
      fabricColor: line.fabricColor,
      materialSku: line.materialSku,
      materialIdentity,
      patternIdentity,
      garmentSkuId: line.garmentSkuId,
      garmentColor: line.garmentColor,
      pieceScope,
      pieceGroup,
      bundleScope,
      skuCode: line.garmentSkuId,
      skuColor: line.fabricColor,
      skuSize: line.sizeCode,
      partCode: line.partCode,
      partName: line.partName,
      partInstanceNo: line.partInstanceNo,
      bundleNo: line.bundleNo,
      bundleQty: line.bundleQty,
      pieceSetNoStart: line.pieceSetNoStart,
      pieceSetNoEnd: line.pieceSetNoEnd,
      pieceSetNoRange: line.pieceSetNoRange,
      bundleTicketType: line.bundleTicketType,
      actualCutPieceQty: line.actualCutPieceQty,
      printStatus: 'WAIT_PRINT',
      qty,
      garmentQty: Math.max(line.actualCutGarmentQty, 1),
      sourceTraceCompleteness: 'COMPLETE',
      secondaryCrafts,
      craftSequenceVersion,
      currentCraftStage,
      hasSpecialCraft: specialCrafts.length > 0,
      specialCrafts,
      specialCraftDisplayLabel,
      pieceSequenceRange: pieceSequence.range,
      pieceSequenceLabel: pieceSequence.label,
      pieceSequenceCannotGenerateReason: pieceSequence.reason,
      sourceTechPackSpuCode,
      sourceBasis: FEI_TICKET_SOURCE_BASIS,
      sourceBasisType: FEI_TICKET_SOURCE_BASIS_TYPE,
      markerNumber: line.sourceMarkerNo,
      bedNo: line.sourceMarkerNo,
      spreadingOrderId: line.spreadingSessionId,
      spreadingOrderNo: line.sourceSpreadingSessionNo,
      issuedAt: line.createdAt,
      qrPayload: encoded.payload,
      qrValue: encoded.qrValue,
    } satisfies GeneratedFeiTicketSourceRecord
  })

  return records
}

interface GeneratedFeiTicketDataset {
  generatedFeiTickets: GeneratedFeiTicketSourceRecord[]
  feiTicketsById: Record<string, GeneratedFeiTicketSourceRecord>
  feiTicketsByNo: Record<string, GeneratedFeiTicketSourceRecord>
  feiTicketsByProductionOrderId: Record<string, GeneratedFeiTicketSourceRecord[]>
  spreadingResultFeiTicketsByProductionOrderId: Record<string, GeneratedFeiTicketSourceRecord[]>
  feiTicketsByCutOrderId: Record<string, GeneratedFeiTicketSourceRecord[]>
  feiTicketsBySpreadingSessionId: Record<string, GeneratedFeiTicketSourceRecord[]>
}

function buildGeneratedFeiTicketDataset(records: GeneratedFeiTicketSourceRecord[]): GeneratedFeiTicketDataset {
  const generatedFeiTickets = [...records].sort(compareFeiRecords)
  return {
    generatedFeiTickets,
    feiTicketsById: Object.fromEntries(generatedFeiTickets.map((record) => [record.feiTicketId, record])),
    feiTicketsByNo: Object.fromEntries(generatedFeiTickets.map((record) => [record.feiTicketNo, record])),
    feiTicketsByProductionOrderId: generatedFeiTickets.reduce<Record<string, GeneratedFeiTicketSourceRecord[]>>((acc, record) => {
      if (!acc[record.productionOrderId]) acc[record.productionOrderId] = []
      acc[record.productionOrderId].push(record)
      return acc
    }, {}),
    spreadingResultFeiTicketsByProductionOrderId: generatedFeiTickets.reduce<Record<string, GeneratedFeiTicketSourceRecord[]>>((acc, record) => {
      if (record.sourceBasisType !== FEI_TICKET_SOURCE_BASIS_TYPE) return acc
      if (!acc[record.productionOrderId]) acc[record.productionOrderId] = []
      acc[record.productionOrderId].push(record)
      return acc
    }, {}),
    feiTicketsByCutOrderId: generatedFeiTickets.reduce<Record<string, GeneratedFeiTicketSourceRecord[]>>((acc, record) => {
      if (!acc[record.cutOrderId]) acc[record.cutOrderId] = []
      acc[record.cutOrderId].push(record)
      return acc
    }, {}),
    feiTicketsBySpreadingSessionId: generatedFeiTickets.reduce<Record<string, GeneratedFeiTicketSourceRecord[]>>((acc, record) => {
      if (!record.sourceSpreadingSessionId) return acc
      if (!acc[record.sourceSpreadingSessionId]) acc[record.sourceSpreadingSessionId] = []
      acc[record.sourceSpreadingSessionId].push(record)
      return acc
    }, {}),
  }
}

export function listSpreadingPieceOutputLines(
  sourceRecords: GeneratedCutOrderSourceRecord[] = listGeneratedCutOrderSourceRecords(),
): SpreadingPieceOutputLine[] {
  const generatedLines = buildSpreadingPieceOutputLinesFromSessions(sourceRecords)
  const lineMap = new Map<string, SpreadingPieceOutputLine>()
  generatedLines.forEach((line) => {
    if (!lineMap.has(line.outputLineId)) {
      lineMap.set(line.outputLineId, line)
    }
  })
  return Array.from(lineMap.values()).sort(compareOutputLines)
}

let computingGeneratedFeiTicketDataset = false
const EMPTY_GENERATED_FEI_TICKET_DATASET = buildGeneratedFeiTicketDataset([])
let generatedFeiTicketDatasetCache: {
  signature: string
  dataset: GeneratedFeiTicketDataset
} | null = null

function getGeneratedFeiTicketRuntimeSignature(): string {
  const storage = typeof localStorage !== 'undefined' && typeof localStorage.getItem === 'function'
    ? localStorage
    : null
  if (!storage) return ''
  return [
    'cuttingMarkerSpreadingLedger',
    'cuttingMarkerPlanRefLedger',
  ]
    .map((key) => `${key}:${storage.getItem(key) || ''}`)
    .join('\n')
}

function buildGeneratedFeiTicketDatasetSignature(sourceRecords: GeneratedCutOrderSourceRecord[]): string {
  const sourceSignature = sourceRecords
    .map((record) => [
      record.cutOrderId,
      record.cutOrderNo,
      record.productionOrderNo,
      record.materialSku,
      record.patternIdentity.patternFileId,
      record.patternIdentity.patternVersion,
      record.patternIdentity.effectiveWidthValue,
      record.requiredQty,
    ].join(':'))
    .join('|')

  return `${sourceSignature}\n${getGeneratedFeiTicketRuntimeSignature()}`
}

function getGeneratedFeiTicketDataset(): GeneratedFeiTicketDataset {
  const sourceRecords = listGeneratedCutOrderSourceRecords()
  if (computingGeneratedFeiTicketDataset) return EMPTY_GENERATED_FEI_TICKET_DATASET

  const signature = buildGeneratedFeiTicketDatasetSignature(sourceRecords)
  if (generatedFeiTicketDatasetCache?.signature === signature) {
    return generatedFeiTicketDatasetCache.dataset
  }

  computingGeneratedFeiTicketDataset = true
  try {
    const spreadingDrivenFeiTickets = buildFeiRecordsFromSpreadingSessions(sourceRecords)
    const dataset = buildGeneratedFeiTicketDataset(spreadingDrivenFeiTickets)
    generatedFeiTicketDatasetCache = { signature, dataset }
    return dataset
  } finally {
    computingGeneratedFeiTicketDataset = false
  }
}

function cloneGeneratedFeiRecord(record: GeneratedFeiTicketSourceRecord): GeneratedFeiTicketSourceRecord {
  return {
    ...record,
    materialIdentity: { ...record.materialIdentity },
    patternIdentity: {
      ...record.patternIdentity,
      piecePartCodes: [...record.patternIdentity.piecePartCodes],
      piecePartNames: [...record.patternIdentity.piecePartNames],
    },
    pieceScope: [...record.pieceScope],
    secondaryCrafts: [...record.secondaryCrafts],
    specialCrafts: record.specialCrafts.map((craft) => ({ ...craft })),
    pieceSequenceRange: record.pieceSequenceRange ? { ...record.pieceSequenceRange } : null,
    qrPayload: {
      ...record.qrPayload,
      pieceScope: [...record.qrPayload.pieceScope],
      secondaryCrafts: [...record.qrPayload.secondaryCrafts],
    },
  }
}

export function listGeneratedFeiTickets(): GeneratedFeiTicketSourceRecord[] {
  return getGeneratedFeiTicketDataset().generatedFeiTickets.map((record) => cloneGeneratedFeiRecord(record))
}

function buildSyntheticPieceSequenceRange(
  base: GeneratedFeiTicketSourceRecord,
  overrides: Partial<PieceSequenceRange>,
): PieceSequenceRange {
  const startNo = overrides.startNo ?? 1
  const endNo = overrides.endNo ?? 1
  return {
    basis: '床次层序',
    ruleVersion: 'piece-sequence-v1',
    spreadingOrderId: base.spreadingOrderId,
    spreadingOrderNo: base.spreadingOrderNo,
    markerPlanId: base.sourceMarkerPlanId,
    markerPlanNo: base.sourceMarkerPlanNo,
    markerNumber: base.markerNumber,
    bedNo: base.bedNo,
    markerMode: 'normal',
    size: base.skuSize,
    sizeGroupId: '整床',
    partCode: base.partCode,
    partName: base.partName,
    partInstanceNo: base.partInstanceNo,
    startNo,
    endNo,
    rangeLabel: formatPieceSequenceRangeLabel(startNo, endNo),
    actualLayerCount: endNo,
    actualLayerSource: '实铺层数',
    actualPieceQty: base.actualCutPieceQty,
    unit: '片',
    generatedAt: base.issuedAt,
    ...overrides,
  }
}

export function listPieceSequenceRangeScenarioRows(): PieceSequenceRangeScenarioRow[] {
  const tickets = listGeneratedFeiTickets()
  const firstTicket = tickets[0]
  if (!firstTicket) return []

  const findTicket = (predicate: (ticket: GeneratedFeiTicketSourceRecord) => boolean): GeneratedFeiTicketSourceRecord =>
    tickets.find((ticket) => ticket.pieceSequenceRange && predicate(ticket)) || firstTicket

  const normalTicket = findTicket((ticket) => ticket.pieceSequenceRange?.markerMode === 'normal' && ticket.pieceSequenceLabel === '1-80')
  const highLowSTicket = findTicket((ticket) => ticket.pieceSequenceRange?.markerMode === 'high_low' && ticket.pieceSequenceRange.sizeGroupId.startsWith('S'))
  const highLowMTicket = findTicket((ticket) => ticket.pieceSequenceRange?.markerMode === 'high_low' && !ticket.pieceSequenceRange.sizeGroupId.startsWith('S'))
  const foldNormalTicket = findTicket((ticket) => ticket.pieceSequenceRange?.markerMode === 'fold_normal')
  const foldHighLowTicket = findTicket((ticket) => ticket.pieceSequenceRange?.markerMode === 'fold_high_low')
  const repeatedPartTicket = findTicket((ticket) => Boolean(ticket.partInstanceNo))
  const fallbackRange = buildSyntheticPieceSequenceRange(firstTicket, {
    spreadingOrderId: 'piece-seq-fallback-output',
    spreadingOrderNo: 'PB-FALLBACK-实际裁剪产出',
    markerMode: 'normal',
    endNo: 42,
    rangeLabel: '1-42',
    actualLayerCount: 42,
    actualLayerSource: '实际裁剪产出',
    actualPieceQty: 42,
  })

  const baseRows: PieceSequenceRangeScenarioRow[] = [
    { scenarioLabel: '普通模式：同床次多个部位编号一致', feiTicketNo: normalTicket.feiTicketNo, markerModeLabel: getMarkerModeLabel(normalTicket.pieceSequenceRange?.markerMode || 'normal'), partName: normalTicket.partName, size: normalTicket.skuSize, pieceSequenceRange: normalTicket.pieceSequenceRange, pieceSequenceLabel: normalTicket.pieceSequenceLabel, pieceSequenceCannotGenerateReason: normalTicket.pieceSequenceCannotGenerateReason },
    { scenarioLabel: '高低层模式：S 组 40 层', feiTicketNo: highLowSTicket.feiTicketNo, markerModeLabel: getMarkerModeLabel(highLowSTicket.pieceSequenceRange?.markerMode || 'high_low'), partName: highLowSTicket.partName, size: highLowSTicket.skuSize, pieceSequenceRange: highLowSTicket.pieceSequenceRange, pieceSequenceLabel: highLowSTicket.pieceSequenceLabel, pieceSequenceCannotGenerateReason: highLowSTicket.pieceSequenceCannotGenerateReason },
    { scenarioLabel: '高低层模式：M 组 60 层', feiTicketNo: highLowMTicket.feiTicketNo, markerModeLabel: getMarkerModeLabel(highLowMTicket.pieceSequenceRange?.markerMode || 'high_low'), partName: highLowMTicket.partName, size: highLowMTicket.skuSize, pieceSequenceRange: highLowMTicket.pieceSequenceRange, pieceSequenceLabel: highLowMTicket.pieceSequenceLabel, pieceSequenceCannotGenerateReason: highLowMTicket.pieceSequenceCannotGenerateReason },
    { scenarioLabel: '对折普通模式：不按对折倍数放大', feiTicketNo: foldNormalTicket.feiTicketNo, markerModeLabel: getMarkerModeLabel(foldNormalTicket.pieceSequenceRange?.markerMode || 'fold_normal'), partName: foldNormalTicket.partName, size: foldNormalTicket.skuSize, pieceSequenceRange: foldNormalTicket.pieceSequenceRange, pieceSequenceLabel: foldNormalTicket.pieceSequenceLabel, pieceSequenceCannotGenerateReason: foldNormalTicket.pieceSequenceCannotGenerateReason },
    { scenarioLabel: '对折高低层模式：按尺码组编号', feiTicketNo: foldHighLowTicket.feiTicketNo, markerModeLabel: getMarkerModeLabel(foldHighLowTicket.pieceSequenceRange?.markerMode || 'fold_high_low'), partName: foldHighLowTicket.partName, size: foldHighLowTicket.skuSize, pieceSequenceRange: foldHighLowTicket.pieceSequenceRange, pieceSequenceLabel: foldHighLowTicket.pieceSequenceLabel, pieceSequenceCannotGenerateReason: foldHighLowTicket.pieceSequenceCannotGenerateReason },
    { scenarioLabel: '重复片数：部位实例不扩大范围', feiTicketNo: repeatedPartTicket.feiTicketNo, markerModeLabel: getMarkerModeLabel(repeatedPartTicket.pieceSequenceRange?.markerMode || 'normal'), partName: `${repeatedPartTicket.partName}-${repeatedPartTicket.partInstanceNo || '1'}`, size: repeatedPartTicket.skuSize, pieceSequenceRange: repeatedPartTicket.pieceSequenceRange, pieceSequenceLabel: repeatedPartTicket.pieceSequenceLabel, pieceSequenceCannotGenerateReason: repeatedPartTicket.pieceSequenceCannotGenerateReason },
    { scenarioLabel: '缺实铺层数：按实际裁剪产出生成', feiTicketNo: 'FT-PIECE-SEQUENCE-FALLBACK', markerModeLabel: getMarkerModeLabel(fallbackRange.markerMode), partName: fallbackRange.partName, size: fallbackRange.size, pieceSequenceRange: fallbackRange, pieceSequenceLabel: fallbackRange.rangeLabel, pieceSequenceCannotGenerateReason: '' },
    { scenarioLabel: '缺少实际数据：不生成错误范围', feiTicketNo: 'FT-PIECE-SEQUENCE-MISSING', markerModeLabel: '普通模式', partName: '待补部位', size: '待补尺码', pieceSequenceRange: null, pieceSequenceLabel: '不可生成', pieceSequenceCannotGenerateReason: '缺少实铺层数和实际裁剪产出' },
  ]

  return baseRows
}

export function listSpreadingResultGeneratedFeiTickets(): GeneratedFeiTicketSourceRecord[] {
  return listGeneratedFeiTickets().filter((record) => record.sourceBasisType === FEI_TICKET_SOURCE_BASIS_TYPE)
}

export function listActualCuttingOutputGeneratedFeiTickets(): GeneratedFeiTicketSourceRecord[] {
  return listSpreadingResultGeneratedFeiTickets()
}

export function listGeneratedFeiTicketsByCutOrderId(cutOrderId: string): GeneratedFeiTicketSourceRecord[] {
  return (getGeneratedFeiTicketDataset().feiTicketsByCutOrderId[cutOrderId] || []).map((record) => cloneGeneratedFeiRecord(record))
}

export function listSpreadingResultGeneratedFeiTicketsByCutOrderId(cutOrderId: string): GeneratedFeiTicketSourceRecord[] {
  return listGeneratedFeiTicketsByCutOrderId(cutOrderId).filter((record) => record.sourceBasisType === FEI_TICKET_SOURCE_BASIS_TYPE)
}

export function listActualCuttingOutputGeneratedFeiTicketsByCutOrderId(cutOrderId: string): GeneratedFeiTicketSourceRecord[] {
  return listSpreadingResultGeneratedFeiTicketsByCutOrderId(cutOrderId)
}

export function listGeneratedFeiTicketsBySpreadingSessionId(spreadingSessionId: string): GeneratedFeiTicketSourceRecord[] {
  return (getGeneratedFeiTicketDataset().feiTicketsBySpreadingSessionId[spreadingSessionId] || []).map((record) => cloneGeneratedFeiRecord(record))
}

export function getFeiTicketById(feiTicketId: string): GeneratedFeiTicketSourceRecord | null {
  const record = getGeneratedFeiTicketDataset().feiTicketsById[feiTicketId]
  return record ? cloneGeneratedFeiRecord(record) : null
}

export function getFeiTicketByNo(feiTicketNo: string): GeneratedFeiTicketSourceRecord | null {
  const record = getGeneratedFeiTicketDataset().feiTicketsByNo[feiTicketNo]
  return record ? cloneGeneratedFeiRecord(record) : null
}

export function getGeneratedFeiTicketMapByCutOrderId(): Record<string, GeneratedFeiTicketSourceRecord[]> {
  return Object.fromEntries(
    Object.entries(getGeneratedFeiTicketDataset().feiTicketsByCutOrderId).map(([key, records]) => [
      key,
      records.map((record) => cloneGeneratedFeiRecord(record)),
    ]),
  )
}

export function listGeneratedFeiTicketsByProductionOrderId(productionOrderId: string): GeneratedFeiTicketSourceRecord[] {
  return (getGeneratedFeiTicketDataset().feiTicketsByProductionOrderId[productionOrderId] || [])
    .map((record) => cloneGeneratedFeiRecord(record))
}

export function listSpreadingResultGeneratedFeiTicketsByProductionOrderId(productionOrderId: string): GeneratedFeiTicketSourceRecord[] {
  return (getGeneratedFeiTicketDataset().spreadingResultFeiTicketsByProductionOrderId[productionOrderId] || [])
    .map((record) => cloneGeneratedFeiRecord(record))
}

export function buildGeneratedFeiTicketTraceMatrix(
  records: GeneratedFeiTicketSourceRecord[] = listGeneratedFeiTickets(),
): GeneratedFeiTicketTraceMatrixRow[] {
  const store = readMarkerSpreadingStoreForFeiTickets(listGeneratedCutOrderSourceRecords())
  const sessionById = Object.fromEntries(store.sessions.map((session) => [session.spreadingSessionId, session]))
  return records
    .map((record) => {
      const session = sessionById[record.sourceSpreadingSessionId]
      return {
        feiTicketId: record.feiTicketId,
        feiTicketNo: record.feiTicketNo,
        sourceOutputLineId: record.sourceOutputLineId,
        sourceSpreadingSessionId: record.sourceSpreadingSessionId,
        sourceSpreadingSessionNo: record.sourceSpreadingSessionNo,
        sourceMarkerId: record.sourceMarkerId,
        sourceMarkerNo: record.sourceMarkerNo,
        sourceMarkerPlanId: record.sourceMarkerPlanId,
        sourceMarkerPlanNo: record.sourceMarkerPlanNo,
        cutOrderId: record.cutOrderId,
        cutOrderNo: record.cutOrderNo,
        fabricRollNo: record.fabricRollNo,
        fabricColor: record.fabricColor,
        materialSku: record.materialSku,
        color: record.skuColor,
        size: record.skuSize,
        partName: record.partName,
        partInstanceNo: record.partInstanceNo,
        bundleNo: record.bundleNo,
        bundleQty: record.bundleQty,
        pieceSetNoStart: record.pieceSetNoStart,
        pieceSetNoEnd: record.pieceSetNoEnd,
        pieceSetNoRange: record.pieceSetNoRange,
        bundleTicketType: record.bundleTicketType,
        garmentQty: record.garmentQty,
        sourceBasis: record.sourceBasis,
        sourceBasisType: record.sourceBasisType,
        sourceTraceCompleteness: record.sourceTraceCompleteness,
        sourceWritebackId: session?.sourceWritebackId || '',
        hasSpecialCraft: record.hasSpecialCraft,
        specialCraftDisplayLabel: record.specialCraftDisplayLabel,
        pieceSequenceLabel: record.pieceSequenceLabel,
        pieceSequenceCannotGenerateReason: record.pieceSequenceCannotGenerateReason,
      }
    })
    .sort(
      (left, right) =>
        left.sourceSpreadingSessionNo.localeCompare(right.sourceSpreadingSessionNo, 'zh-CN')
        || left.cutOrderNo.localeCompare(right.cutOrderNo, 'zh-CN')
        || left.color.localeCompare(right.color, 'zh-CN')
        || left.size.localeCompare(right.size, 'zh-CN'),
    )
}

export function buildSpreadingDrivenFeiTicketTraceMatrix(
  records: GeneratedFeiTicketSourceRecord[] = listGeneratedFeiTickets(),
): GeneratedFeiTicketTraceMatrixRow[] {
  return buildGeneratedFeiTicketTraceMatrix(records).filter(
    (record) => record.sourceBasisType === FEI_TICKET_SOURCE_BASIS_TYPE && Boolean(record.sourceSpreadingSessionId),
  )
}
