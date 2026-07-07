import {
  listGeneratedCutOrderSourceRecords,
  type GeneratedCutOrderSourceRecord,
} from '../../../data/fcs/cutting/generated-cut-orders.ts'
import { getProductionOrderTechPackSnapshot } from '../../../data/fcs/production-orders.ts'
import type { TechPackPatternFileSnapshot } from '../../../data/fcs/production-tech-pack-snapshot-types.ts'
import type { TechnicalPatternBindingStrip } from '../../../data/pcs-technical-data-version-types.ts'
import type {
  BindingProcessAbnormalItem,
  BindingProcessDifferenceStatus,
  BindingProcessHandoverStatus,
  BindingProcessInboundStatus,
  BindingProcessOrder,
  BindingProcessPrintStatus,
  BindingProcessStatus,
  BindingStripCuttingMethod,
  BindingStripCuttingRecord,
  BindingStripDifferenceRecord,
  BindingStripSufficiencyStatus,
  BindingStripWorkOrderDetail,
} from './special-processes-model.ts'

export const BINDING_STRIP_LOSS_FACTOR = 1.3
export const BINDING_STRIP_MIN_REQUIRED_LENGTH_M = 4

export interface BindingStripRequirementLine {
  requirementId: string
  cutOrderId: string
  cutOrderNo: string
  productionOrderId: string
  productionOrderNo: string
  markerPlanId: string
  markerPlanNo: string
  materialSku: string
  materialName: string
  materialColor: string
  materialAlias: string
  materialImageUrl: string
  materialUnit: string
  patternFileId: string
  patternFileName: string
  patternVersion: string
  patternKind: string
  patternPackageId: string
  patternPackageName: string
  doorWidthCm: number
  bindingStripId: string
  bindingStripNo: string
  bindingStripName: string
  cuttingMethod: BindingStripCuttingMethod
  cuttingMethodIndonesian: string
  plannedGarmentQty: number
  unitBindingLengthM: number
  plannedBindingLengthM: number
  bindingLengthCm: number
  bindingWidthCm: number
  rawRequiredLengthM: number
  requiredLengthM: number
  minRequiredLengthM: number
  minRequiredLengthApplied: boolean
  formulaText: string
}

export interface BindingStripRequirementSummary {
  lines: BindingStripRequirementLine[]
  totalRequiredLengthM: number
  rawTotalRequiredLengthM: number
  minRequiredLengthApplied: boolean
  widthSummaries: Array<{
    materialSku: string
    bindingWidthCm: number
    rawRequiredLengthM: number
    requiredLengthM: number
    minRequiredLengthApplied: boolean
    ticketNos: string[]
  }>
}

function normalizeText(value: string | number | null | undefined): string {
  return String(value ?? '').trim()
}

function slugToken(value: string | number | null | undefined): string {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function roundTo(value: number, precision = 2): number {
  const factor = 10 ** precision
  return Math.round((Number(value) || 0) * factor) / factor
}

function uniqueStrings(values: Array<string | undefined | null>): string[] {
  return Array.from(new Set(values.map((value) => normalizeText(value)).filter(Boolean)))
}

function shouldGenerateBindingProcessOrder(source: GeneratedCutOrderSourceRecord): boolean {
  return source.internalCraftOrderPolicy !== 'DO_NOT_GENERATE' && source.cutReturnMode !== 'THIRD_PARTY_REPORT_ONLY'
}

function resolveBindingStripMaterialImageUrl(
  imageUrl: string | undefined,
  materialSku: string,
  materialName: string,
  materialAlias: string,
): string {
  const existingUrl = normalizeText(imageUrl)
  if (existingUrl) return existingUrl

  const materialText = `${materialSku} ${materialName} ${materialAlias}`.toLowerCase()
  if (materialText.includes('contrast') || materialText.includes('拼接') || materialText.includes('撞色')) {
    return '/materials/fabric-contrast.jpg'
  }
  if (materialText.includes('lining') || materialText.includes('里布')) {
    return '/materials/fabric-lining.jpg'
  }
  return '/materials/fabric-main.jpg'
}

function formatFormulaNumber(value: number, precision = 2): string {
  return Number(value || 0).toFixed(precision)
}

export function calculateBindingStripRawRequiredLengthM(
  plannedBindingLengthM: number,
  widthCm: number,
  doorWidthCm: number,
): number {
  const length = Math.max(Number(plannedBindingLengthM || 0), 0)
  const width = Math.max(Number(widthCm || 0), 0)
  const doorWidth = Math.max(Number(doorWidthCm || 0), 0)
  if (!length || !width || !doorWidth) return 0
  return roundTo(length * width / doorWidth * BINDING_STRIP_LOSS_FACTOR, 2)
}

export function calculateBindingStripRequiredLengthM(
  plannedBindingLengthM: number,
  widthCm: number,
  doorWidthCm: number,
): number {
  const rawLength = calculateBindingStripRawRequiredLengthM(plannedBindingLengthM, widthCm, doorWidthCm)
  if (!rawLength) return 0
  return Math.max(rawLength, BINDING_STRIP_MIN_REQUIRED_LENGTH_M)
}

export function buildBindingStripRequiredLengthFormula(
  plannedBindingLengthM: number,
  widthCm: number,
  doorWidthCm: number,
): string {
  const rawLength = calculateBindingStripRawRequiredLengthM(plannedBindingLengthM, widthCm, doorWidthCm)
  const result = calculateBindingStripRequiredLengthM(plannedBindingLengthM, widthCm, doorWidthCm)
  const rawFormula = `${formatFormulaNumber(plannedBindingLengthM)} m × ${formatFormulaNumber(widthCm)} cm ÷ ${formatFormulaNumber(doorWidthCm)} cm × 1.3 = ${formatFormulaNumber(rawLength)} m`
  if (rawLength > 0 && rawLength < BINDING_STRIP_MIN_REQUIRED_LENGTH_M) {
    return `${formatFormulaNumber(result)} m = max(${rawFormula}, ${formatFormulaNumber(BINDING_STRIP_MIN_REQUIRED_LENGTH_M)} m 起算)；原算不足 4m，按 4m 计算`
  }
  return `${formatFormulaNumber(result)} m = ${rawFormula}`
}

function buildBindingStripRequirementLengthMeta(plannedBindingLengthM: number, widthCm: number, doorWidthCm: number): {
  rawRequiredLengthM: number
  requiredLengthM: number
  minRequiredLengthM: number
  minRequiredLengthApplied: boolean
} {
  const rawRequiredLengthM = calculateBindingStripRawRequiredLengthM(plannedBindingLengthM, widthCm, doorWidthCm)
  const requiredLengthM = calculateBindingStripRequiredLengthM(plannedBindingLengthM, widthCm, doorWidthCm)
  return {
    rawRequiredLengthM,
    requiredLengthM,
    minRequiredLengthM: BINDING_STRIP_MIN_REQUIRED_LENGTH_M,
    minRequiredLengthApplied: rawRequiredLengthM > 0 && requiredLengthM === BINDING_STRIP_MIN_REQUIRED_LENGTH_M && rawRequiredLengthM < BINDING_STRIP_MIN_REQUIRED_LENGTH_M,
  }
}

function resolveBindingStripCuttingMethod(value: unknown, index = 0): BindingStripCuttingMethod {
  if (value === '直切' || value === '横切' || value === '斜切') return value
  const fallback: BindingStripCuttingMethod[] = ['斜切', '直切', '横切']
  return fallback[index % fallback.length]
}

function getCuttingMethodIndonesian(method: BindingStripCuttingMethod): string {
  if (method === '直切') return 'Potongan lurus'
  if (method === '横切') return 'Potongan melintang'
  return 'Potongan serong/miring'
}

function findSourcePatternFile(source: GeneratedCutOrderSourceRecord): TechPackPatternFileSnapshot | null {
  const snapshot = getProductionOrderTechPackSnapshot(source.productionOrderId)
  const patternFiles = snapshot?.patternFiles || []
  if (!patternFiles.length) return null
  const patternId = normalizeText(source.patternIdentity.patternFileId)
  const patternName = normalizeText(source.patternIdentity.patternFileName)
  const materialSku = normalizeText(source.materialSku).toLowerCase()
  const materialName = normalizeText(source.materialName).toLowerCase()

  return (
    patternFiles.find((item) =>
      item.recordKind === 'MATERIAL_ASSOCIATION'
      && (
        normalizeText(item.id) === patternId
        || normalizeText(item.patternFileId) === patternId
        || normalizeText(item.patternFileName) === patternName
        || normalizeText(item.fileName) === patternName
        || normalizeText(item.linkedMaterialSku).toLowerCase() === materialSku
        || normalizeText(item.linkedMaterialName).toLowerCase() === materialName
      )
      && (item.bindingStrips || []).length > 0,
    )
    || patternFiles.find((item) =>
      (
        normalizeText(item.id) === patternId
        || normalizeText(item.patternFileId) === patternId
        || normalizeText(item.patternFileName) === patternName
        || normalizeText(item.fileName) === patternName
      )
      && (item.bindingStrips || []).length > 0,
    )
    || patternFiles.find((item) => (item.bindingStrips || []).length > 0)
    || null
  )
}

function augmentBindingStripsForDemo(
  strips: TechnicalPatternBindingStrip[],
  source: GeneratedCutOrderSourceRecord,
  sourceIndex: number,
): TechnicalPatternBindingStrip[] {
  const seed = strips[0]
  if (!seed || strips.length !== 1) return strips
  const highVolumeDemoLengthByCutOrderNo: Record<string, number> = {
    'CUT-260303-007-01': 18000,
    'CUT-260304-008-01': 26000,
  }
  const highVolumeLengthCm = highVolumeDemoLengthByCutOrderNo[source.cutOrderNo]
  if (highVolumeLengthCm) {
    return [
      {
        ...seed,
        lengthCm: highVolumeLengthCm,
        remark: '演示批量捆条需求：公式结果超过 4m，按实际公式结果计算。',
      },
    ]
  }
  if (sourceIndex !== 0) return strips
  return [
    {
      ...seed,
      cuttingMethod: resolveBindingStripCuttingMethod(seed.cuttingMethod, sourceIndex),
    },
    {
      ...seed,
      bindingStripId: `${seed.bindingStripId}-narrow-demo`,
      bindingStripNo: `${seed.bindingStripNo || 'BIND'}-02`,
      bindingStripName: `${seed.bindingStripName || '捆条'}-窄边`,
      lengthCm: Math.max(roundTo(Number(seed.lengthCm || 0) * 0.72, 0), 60),
      widthCm: Math.max(roundTo(Number(seed.widthCm || 0) + 0.8, 1), 1.2),
      cuttingMethod: '横切',
      remark: '演示多规格捆条明细：同一物料+纸样下存在不同宽度。',
    },
  ]
}

function buildRequirementLinesForSource(
  source: GeneratedCutOrderSourceRecord,
  sourceIndex: number,
): BindingStripRequirementLine[] {
  const patternFile = findSourcePatternFile(source)
  const bindingStrips = augmentBindingStripsForDemo(patternFile?.bindingStrips || [], source, sourceIndex)
  if (!patternFile || !bindingStrips.length) return []
  const doorWidthCm = Math.max(Number(patternFile.widthCm || source.patternIdentity.effectiveWidthValue || 0), 0)
  if (!doorWidthCm) return []

  return bindingStrips.map((strip, stripIndex) => {
    const bindingLengthCm = Math.max(Number(strip.lengthCm || 0), 0)
    const bindingWidthCm = Math.max(Number(strip.widthCm || 0), 0)
    const plannedGarmentQty = Math.max(Number(source.requiredQty || 0), 0)
    const unitBindingLengthM = roundTo(bindingLengthCm / 100, 2)
    const plannedBindingLengthM = roundTo(plannedGarmentQty * unitBindingLengthM, 2)
    const cuttingMethod = resolveBindingStripCuttingMethod(strip.cuttingMethod, stripIndex)
    const lengthMeta = buildBindingStripRequirementLengthMeta(plannedBindingLengthM, bindingWidthCm, doorWidthCm)
    const materialSku = source.materialIdentity.materialSku || source.materialSku
    const materialName = source.materialIdentity.materialName || source.materialName
    const materialAlias = source.materialIdentity.materialAlias || source.materialAlias
    const materialImageUrl = resolveBindingStripMaterialImageUrl(
      source.materialIdentity.materialImageUrl || source.materialImageUrl,
      materialSku,
      materialName,
      materialAlias,
    )
    return {
      requirementId: [
        'binding-req',
        slugToken(source.cutOrderId),
        slugToken(patternFile.patternFileId || patternFile.id),
        slugToken(strip.bindingStripId || strip.bindingStripNo || stripIndex + 1),
      ].join(':'),
      cutOrderId: source.cutOrderId,
      cutOrderNo: source.cutOrderNo,
      productionOrderId: source.productionOrderId,
      productionOrderNo: source.productionOrderNo,
      markerPlanId: source.markerPlanId,
      markerPlanNo: source.markerPlanNo,
      materialSku,
      materialName,
      materialColor: source.materialIdentity.materialColor || source.materialColor,
      materialAlias,
      materialImageUrl,
      materialUnit: source.materialIdentity.materialUnit || source.materialUnit || '米',
      patternFileId: source.patternIdentity.patternFileId || patternFile.patternFileId || patternFile.id,
      patternFileName: source.patternIdentity.patternFileName || patternFile.patternFileName || patternFile.fileName,
      patternVersion: source.patternIdentity.patternVersion || patternFile.patternVersion,
      patternKind: source.patternIdentity.patternKind || patternFile.patternMaterialTypeLabel || '布料纸样',
      patternPackageId: patternFile.sourcePatternPackageId || patternFile.patternFileId || patternFile.id,
      patternPackageName: patternFile.sourcePatternPackageName || patternFile.patternName || patternFile.patternFileName || patternFile.fileName,
      doorWidthCm,
      bindingStripId: strip.bindingStripId || `${source.cutOrderId}-binding-${stripIndex + 1}`,
      bindingStripNo: strip.bindingStripNo || `BIND-${String(stripIndex + 1).padStart(2, '0')}`,
      bindingStripName: strip.bindingStripName || `捆条 ${stripIndex + 1}`,
      cuttingMethod,
      cuttingMethodIndonesian: getCuttingMethodIndonesian(cuttingMethod),
      plannedGarmentQty,
      unitBindingLengthM,
      plannedBindingLengthM,
      bindingLengthCm,
      bindingWidthCm,
      rawRequiredLengthM: lengthMeta.rawRequiredLengthM,
      requiredLengthM: lengthMeta.requiredLengthM,
      minRequiredLengthM: lengthMeta.minRequiredLengthM,
      minRequiredLengthApplied: lengthMeta.minRequiredLengthApplied,
      formulaText: buildBindingStripRequiredLengthFormula(plannedBindingLengthM, bindingWidthCm, doorWidthCm),
    }
  }).filter((line) => line.requiredLengthM > 0 && line.bindingWidthCm > 0 && line.plannedBindingLengthM > 0)
}

export function listBindingStripRequirementLines(
  sourceRecords: GeneratedCutOrderSourceRecord[] = listGeneratedCutOrderSourceRecords(),
): BindingStripRequirementLine[] {
  return sourceRecords.flatMap((source, sourceIndex) =>
    shouldGenerateBindingProcessOrder(source) ? buildRequirementLinesForSource(source, sourceIndex) : [],
  )
}

function buildBindingOrderNo(source: GeneratedCutOrderSourceRecord, index: number): string {
  const sourceNo = normalizeText(source.cutOrderNo).replace(/^CUT-/, '')
  return `BT-${sourceNo}-${String(index + 1).padStart(2, '0')}`
}

function resolveStatus(orderIndex: number): BindingProcessStatus {
  const cycle: BindingProcessStatus[] = ['加工中', '已完成', '已完成', '待加工', '已取消']
  return cycle[orderIndex % cycle.length]
}

function resolvePrintStatus(status: BindingProcessStatus, orderIndex: number): BindingProcessPrintStatus {
  if (status === '待加工') return '待打印'
  if (status === '已取消') return '未生成'
  return orderIndex % 3 === 0 ? '待打印' : '已打印'
}

function resolveInboundStatus(status: BindingProcessStatus, orderIndex: number): BindingProcessInboundStatus {
  if (status !== '已完成') return '未入仓'
  if (orderIndex % 3 === 2) return '部分入仓'
  return '已入仓'
}

function resolveHandoverStatus(inboundStatus: BindingProcessInboundStatus, orderIndex: number): BindingProcessHandoverStatus {
  if (inboundStatus === '未入仓') return '未装袋'
  if (orderIndex % 4 === 1) return '已装袋待交出'
  return inboundStatus === '已入仓' ? '已交出' : '未装袋'
}

function buildCutLengthBreakdown(method: BindingStripCuttingMethod, actualLength: number): Pick<BindingStripCuttingRecord, 'straightCutLength' | 'crossCutLength' | 'biasCutLength'> {
  return {
    straightCutLength: method === '直切' ? actualLength : 0,
    crossCutLength: method === '横切' ? actualLength : 0,
    biasCutLength: method === '斜切' ? actualLength : 0,
  }
}

function estimateRollCount(actualLength: number): number {
  if (actualLength <= 0) return 0
  return Math.max(Math.ceil(actualLength / 120), 1)
}

function buildCuttingLengthByRolls(
  method: BindingStripCuttingMethod,
  targetLength: number,
): Pick<BindingStripCuttingRecord, 'actualLength' | 'straightCutLength' | 'crossCutLength' | 'biasCutLength' | 'rollLength' | 'actualRollCount'> {
  const actualRollCount = estimateRollCount(targetLength)
  const rollLength = actualRollCount ? roundTo(targetLength / actualRollCount, 2) : 0
  const actualLength = roundTo(rollLength * actualRollCount, 2)
  return {
    actualLength,
    ...buildCutLengthBreakdown(method, actualLength),
    rollLength,
    actualRollCount,
  }
}

function buildCuttingRecords(
  detailId: string,
  line: BindingStripRequirementLine,
  status: BindingProcessStatus,
  orderIndex: number,
  detailIndex: number,
): BindingStripCuttingRecord[] {
  if (status === '待加工' || status === '已取消') return []
  const baseAt = `2026-06-${String(5 + (orderIndex % 8)).padStart(2, '0')}`
  if (status === '加工中') {
    const firstLength = roundTo(line.plannedBindingLengthM * (detailIndex === 0 ? 0.32 : 0.22), 2)
    const secondLength = detailIndex === 0 ? roundTo(line.plannedBindingLengthM * 0.28, 2) : 0
    const firstCuttingLength = buildCuttingLengthByRolls(line.cuttingMethod, firstLength)
    const secondCuttingLength = buildCuttingLengthByRolls(line.cuttingMethod, secondLength)
    return [
      {
        recordId: `${detailId}-cut-01`,
        detailId,
        bindingStripId: line.bindingStripId,
        bindingWidth: line.bindingWidthCm,
        cuttingMethod: line.cuttingMethod,
        receivedMaterialLength: roundTo(line.requiredLengthM * 0.7, 2),
        ...firstCuttingLength,
        operatorName: '裁床组长 梁敏',
        operatedAt: `${baseAt} 09:20`,
        remark: `第一批${line.cuttingMethod}，按当前可用面料先做。`,
      },
      ...(secondLength > 0
        ? [{
            recordId: `${detailId}-cut-02`,
            detailId,
            bindingStripId: line.bindingStripId,
            bindingWidth: line.bindingWidthCm,
            cuttingMethod: line.cuttingMethod,
            receivedMaterialLength: roundTo(line.requiredLengthM * 0.3, 2),
            ...secondCuttingLength,
            operatorName: '裁床组员 陈芳',
            operatedAt: `${baseAt} 14:10`,
            remark: `第二批补做，剩余${line.cuttingMethod}长度继续加工。`,
          }]
        : []),
    ]
  }

  const actualRate = orderIndex % 5 === 2 ? 0.82 : 1
  const firstLength = roundTo(line.plannedBindingLengthM * Math.min(actualRate, 0.58), orderIndex % 5 === 2 ? 3 : 2)
  const secondLength = roundTo(Math.max(line.plannedBindingLengthM * actualRate - firstLength, 0), orderIndex % 5 === 2 ? 3 : 2)
  const firstCuttingLength = buildCuttingLengthByRolls(line.cuttingMethod, firstLength)
  const secondCuttingLength = buildCuttingLengthByRolls(line.cuttingMethod, secondLength)
  return [
    {
      recordId: `${detailId}-cut-01`,
      detailId,
      bindingStripId: line.bindingStripId,
      bindingWidth: line.bindingWidthCm,
      cuttingMethod: line.cuttingMethod,
      receivedMaterialLength: roundTo(line.requiredLengthM * 0.62, 2),
      ...firstCuttingLength,
      operatorName: '裁床组长 梁敏',
      operatedAt: `${baseAt} 09:10`,
      remark: `第一批${line.cuttingMethod}。`,
    },
    {
      recordId: `${detailId}-cut-02`,
      detailId,
      bindingStripId: line.bindingStripId,
      bindingWidth: line.bindingWidthCm,
      cuttingMethod: line.cuttingMethod,
      receivedMaterialLength: roundTo(line.requiredLengthM * 0.38, 2),
      ...secondCuttingLength,
      operatorName: '裁床组员 陈芳',
      operatedAt: `${baseAt} 15:40`,
      remark: orderIndex % 5 === 2 ? '手动结束加工，本规格存在短裁差异。' : '本规格累计已完成。',
    },
  ].filter((record) => record.actualLength > 0)
}

function buildDifferenceRecords(
  detailId: string,
  line: BindingStripRequirementLine,
  actualLength: number,
  status: BindingProcessStatus,
  orderIndex: number,
): BindingStripDifferenceRecord[] {
  if (status !== '已完成' || orderIndex % 5 !== 2) return []
  const differenceLength = roundTo(actualLength - line.plannedBindingLengthM, 3)
  return [
    {
      differenceId: `${detailId}-diff-01`,
      detailId,
      bindingStripId: line.bindingStripId,
      differenceType: '手动结束差异',
      plannedLength: line.plannedBindingLengthM,
      actualLength,
      differenceLength,
      reason: '现场按可用面料完成本轮加工，短缺部分只记录差异，不进入异常处理中状态。',
      recordedBy: '裁床核查员 周静',
      recordedAt: `2026-06-${String(5 + (orderIndex % 8)).padStart(2, '0')} 16:20`,
    },
  ]
}

function aggregateStatus<T extends string>(values: T[], done: T, partial: T, empty: T): T {
  if (!values.length) return empty
  if (values.every((value) => value === done)) return done
  if (values.every((value) => value === empty)) return empty
  return partial
}

function buildDetail(
  line: BindingStripRequirementLine,
  bindingOrderNo: string,
  orderIndex: number,
  detailIndex: number,
  status: BindingProcessStatus,
): BindingStripWorkOrderDetail {
  const detailId = `${bindingOrderNo}-D${String(detailIndex + 1).padStart(2, '0')}`
  const cuttingRecords = buildCuttingRecords(detailId, line, status, orderIndex, detailIndex)
  const actualLength = roundTo(cuttingRecords.reduce((sum, record) => sum + record.actualLength, 0), 2)
  const differenceRecords = buildDifferenceRecords(detailId, line, actualLength, status, orderIndex)
  const receivedMaterialLength = roundTo(cuttingRecords.reduce((sum, record) => sum + record.receivedMaterialLength, 0), 2)
  const straightCutLength = roundTo(cuttingRecords.reduce((sum, record) => sum + record.straightCutLength, 0), 2)
  const crossCutLength = roundTo(cuttingRecords.reduce((sum, record) => sum + record.crossCutLength, 0), 2)
  const biasCutLength = roundTo(cuttingRecords.reduce((sum, record) => sum + record.biasCutLength, 0), 2)
  const actualRollCount = cuttingRecords.reduce((sum, record) => sum + record.actualRollCount, 0)
  const rollLength = actualRollCount ? roundTo(actualLength / actualRollCount, 2) : 0
  const shortageLength = roundTo(Math.max(line.plannedBindingLengthM - actualLength, 0), 2)
  const sufficiencyStatus = !actualLength
    ? '待记录'
    : shortageLength > 0
      ? '捆条不足'
      : differenceRecords.length
        ? '有差异'
        : '充足'
  const printStatus = resolvePrintStatus(status, orderIndex)
  const inboundStatus = resolveInboundStatus(status, orderIndex)
  const handoverStatus = resolveHandoverStatus(inboundStatus, orderIndex)
  const feiTicketNo = `FT-${bindingOrderNo}-${String(detailIndex + 1).padStart(3, '0')}`
  return {
    detailId,
    bindingStripId: line.bindingStripId,
    bindingStripNo: line.bindingStripNo,
    bindingStripName: line.bindingStripName,
    cuttingMethod: line.cuttingMethod,
    cuttingMethodIndonesian: line.cuttingMethodIndonesian,
    plannedGarmentQty: line.plannedGarmentQty,
    unitBindingLength: line.unitBindingLengthM,
    plannedBindingLength: line.plannedBindingLengthM,
    bindingWidth: line.bindingWidthCm,
    sourceLengthCm: line.bindingLengthCm,
    doorWidthCm: line.doorWidthCm,
    rawRequiredLength: line.rawRequiredLengthM,
    requiredLength: line.requiredLengthM,
    minRequiredLength: line.minRequiredLengthM,
    minRequiredLengthApplied: line.minRequiredLengthApplied,
    receivedMaterialLength,
    actualLength,
    straightCutLength,
    crossCutLength,
    biasCutLength,
    rollLength,
    actualRollCount,
    latestRecordedAt: cuttingRecords[cuttingRecords.length - 1]?.operatedAt || '',
    sufficiencyStatus,
    shortageLength,
    differenceLength: roundTo(actualLength - line.plannedBindingLengthM, 2),
    printStatus,
    inboundStatus,
    handoverStatus,
    differenceStatus: differenceRecords.length ? '有差异' : '无差异',
    feiTicketId: `fei-${detailId}`,
    feiTicketNo,
    inventoryRecordIds: inboundStatus === '未入仓' ? [] : [`INV-${detailId}`],
    cuttingRecords,
    differenceRecords,
    formulaText: line.formulaText,
  }
}

function buildAbnormalCompatibilityItems(
  order: Pick<BindingProcessOrder, 'bindingOrderId' | 'bindingOrderNo' | 'differenceRecords'>,
): BindingProcessAbnormalItem[] {
  return order.differenceRecords.map((item) => ({
    abnormalId: item.differenceId,
    abnormalType: item.differenceType,
    abnormalLevel: '需处理',
    description: `${item.reason} 计划 ${formatFormulaNumber(item.plannedLength)} m，实际 ${formatFormulaNumber(item.actualLength)} m，差异 ${formatFormulaNumber(item.differenceLength)} m。`,
    targetModule: '裁剪结果核查',
    handlingStatus: '待处理',
    reportedAt: item.recordedAt,
    reportedBy: item.recordedBy,
  }))
}

function summarizeBindingDetails(details: BindingStripWorkOrderDetail[]): {
  requiredMaterialLength: number
  plannedBindingLength: number
  actualLength: number
  receivedMaterialLength: number
  straightCutLength: number
  crossCutLength: number
  biasCutLength: number
  actualRollCount: number
  latestRecordedAt: string
  shortageLength: number
  sufficiencyStatus: BindingStripSufficiencyStatus
} {
  const requiredMaterialLength = roundTo(details.reduce((sum, detail) => sum + detail.requiredLength, 0), 2)
  const plannedBindingLength = roundTo(details.reduce((sum, detail) => sum + detail.plannedBindingLength, 0), 2)
  const actualLength = roundTo(details.reduce((sum, detail) => sum + detail.actualLength, 0), 2)
  const receivedMaterialLength = roundTo(details.reduce((sum, detail) => sum + detail.receivedMaterialLength, 0), 2)
  const straightCutLength = roundTo(details.reduce((sum, detail) => sum + detail.straightCutLength, 0), 2)
  const crossCutLength = roundTo(details.reduce((sum, detail) => sum + detail.crossCutLength, 0), 2)
  const biasCutLength = roundTo(details.reduce((sum, detail) => sum + detail.biasCutLength, 0), 2)
  const actualRollCount = details.reduce((sum, detail) => sum + detail.actualRollCount, 0)
  const recordedTimes = details.map((detail) => detail.latestRecordedAt).filter(Boolean).sort()
  const latestRecordedAt = recordedTimes[recordedTimes.length - 1] || ''
  const shortageLength = roundTo(Math.max(plannedBindingLength - actualLength, 0), 2)
  let sufficiencyStatus: BindingStripSufficiencyStatus = '待记录'
  if (details.some((detail) => detail.sufficiencyStatus === '捆条不足')) sufficiencyStatus = '捆条不足'
  else if (details.length && details.every((detail) => detail.sufficiencyStatus === '充足')) sufficiencyStatus = '充足'
  else if (details.some((detail) => detail.sufficiencyStatus === '有差异')) sufficiencyStatus = '有差异'
  else if (details.some((detail) => detail.actualLength > 0)) sufficiencyStatus = shortageLength > 0 ? '捆条不足' : '充足'
  return {
    requiredMaterialLength,
    plannedBindingLength,
    actualLength,
    receivedMaterialLength,
    straightCutLength,
    crossCutLength,
    biasCutLength,
    actualRollCount,
    latestRecordedAt,
    shortageLength,
    sufficiencyStatus,
  }
}

function resolveMaterialShelfLocation(index: number): string {
  const shelves = ['A-03-02 / 主面料货架', 'B-01-05 / 捆条暂存位', 'C-02-01 / 待裁布料区']
  return shelves[index % shelves.length]
}

function buildFallbackRequirementLine(
  overrides: Partial<BindingStripRequirementLine> & Pick<BindingStripRequirementLine, 'cutOrderId' | 'cutOrderNo' | 'bindingStripId' | 'bindingStripNo' | 'bindingStripName' | 'bindingLengthCm' | 'bindingWidthCm'>,
): BindingStripRequirementLine {
  const doorWidthCm = overrides.doorWidthCm ?? 150
  const plannedGarmentQty = Math.max(Number(overrides.plannedGarmentQty ?? 120), 0)
  const unitBindingLengthM = roundTo(overrides.bindingLengthCm / 100, 2)
  const plannedBindingLengthM = roundTo(Number(overrides.plannedBindingLengthM ?? plannedGarmentQty * unitBindingLengthM), 2)
  const cuttingMethod = resolveBindingStripCuttingMethod(overrides.cuttingMethod, 0)
  const lengthMeta = buildBindingStripRequirementLengthMeta(plannedBindingLengthM, overrides.bindingWidthCm, doorWidthCm)
  const materialSku = overrides.materialSku || 'tdv_demand_SPU_2024_010-bom-black-stretch-twill'
  const materialName = overrides.materialName || 'Black 弹力斜纹主面料'
  const materialAlias = overrides.materialAlias || '待补 · 技术包别名：主面料'
  return {
    requirementId: overrides.requirementId || `binding-req:fallback:${slugToken(overrides.cutOrderId)}:${slugToken(overrides.bindingStripId)}`,
    cutOrderId: overrides.cutOrderId,
    cutOrderNo: overrides.cutOrderNo,
    productionOrderId: overrides.productionOrderId || 'po-260302-004',
    productionOrderNo: overrides.productionOrderNo || 'PO-260302-004',
    markerPlanId: overrides.markerPlanId || 'mkp-260302-004',
    markerPlanNo: overrides.markerPlanNo || 'MKP-260302-004',
    materialSku,
    materialName,
    materialColor: overrides.materialColor || 'Black',
    materialAlias,
    materialImageUrl: resolveBindingStripMaterialImageUrl(overrides.materialImageUrl, materialSku, materialName, materialAlias),
    materialUnit: overrides.materialUnit || '米',
    patternFileId: overrides.patternFileId || 'SPU-2024-010-main-pattern',
    patternFileName: overrides.patternFileName || 'SPU-2024-010 正式纸样',
    patternVersion: overrides.patternVersion || 'v1.0',
    patternKind: overrides.patternKind || '布料纸样',
    patternPackageId: overrides.patternPackageId || 'SPU-2024-010',
    patternPackageName: overrides.patternPackageName || 'SPU-2024-010 正式纸样',
    doorWidthCm,
    bindingStripId: overrides.bindingStripId,
    bindingStripNo: overrides.bindingStripNo,
    bindingStripName: overrides.bindingStripName,
    cuttingMethod,
    cuttingMethodIndonesian: getCuttingMethodIndonesian(cuttingMethod),
    plannedGarmentQty,
    unitBindingLengthM,
    plannedBindingLengthM,
    bindingLengthCm: overrides.bindingLengthCm,
    bindingWidthCm: overrides.bindingWidthCm,
    rawRequiredLengthM: lengthMeta.rawRequiredLengthM,
    requiredLengthM: lengthMeta.requiredLengthM,
    minRequiredLengthM: lengthMeta.minRequiredLengthM,
    minRequiredLengthApplied: lengthMeta.minRequiredLengthApplied,
    formulaText: buildBindingStripRequiredLengthFormula(plannedBindingLengthM, overrides.bindingWidthCm, doorWidthCm),
  }
}

function buildFallbackBindingProcessOrders(): BindingProcessOrder[] {
  const rows = [
    {
      source: {
        cutOrderId: 'fallback-cut-260302-004-01',
        cutOrderNo: 'CUT-260302-004-01',
        productionOrderId: 'po-260302-004',
        productionOrderNo: 'PO-260302-004',
        markerPlanId: 'mkp-260302-004',
        markerPlanNo: 'MKP-260302-004',
      },
      orderNo: 'BT-260302-004-01-01',
      status: '加工中' as BindingProcessStatus,
      details: [
        buildFallbackRequirementLine({
          cutOrderId: 'fallback-cut-260302-004-01',
          cutOrderNo: 'CUT-260302-004-01',
          bindingStripId: 'fallback-binding-32',
          bindingStripNo: 'BIND-01',
          bindingStripName: '领、袖口捆条',
          cuttingMethod: '横切',
          plannedGarmentQty: 600,
          doorWidthCm: 133.7,
          bindingLengthCm: 120,
          bindingWidthCm: 3,
        }),
        buildFallbackRequirementLine({
          cutOrderId: 'fallback-cut-260302-004-01',
          cutOrderNo: 'CUT-260302-004-01',
          bindingStripId: 'fallback-binding-40',
          bindingStripNo: 'BIND-02',
          bindingStripName: '门襟斜切捆条',
          cuttingMethod: '斜切',
          plannedGarmentQty: 60,
          bindingLengthCm: 58,
          bindingWidthCm: 4,
        }),
      ],
    },
    {
      source: {
        cutOrderId: 'fallback-cut-260306-101-01',
        cutOrderNo: 'CUT-260306-101-01',
        productionOrderId: 'po-260306-101',
        productionOrderNo: 'PO-260306-101',
        markerPlanId: 'mkp-260306-101',
        markerPlanNo: 'MKP-260306-101',
      },
      orderNo: 'BT-260306-101-01-02',
      status: '已完成' as BindingProcessStatus,
      details: [
        buildFallbackRequirementLine({
          cutOrderId: 'fallback-cut-260306-101-01',
          cutOrderNo: 'CUT-260306-101-01',
          productionOrderId: 'po-260306-101',
          productionOrderNo: 'PO-260306-101',
          markerPlanId: 'mkp-260306-101',
          markerPlanNo: 'MKP-260306-101',
          bindingStripId: 'fallback-binding-35',
          bindingStripNo: 'BIND-01',
          bindingStripName: '袖口捆条',
          cuttingMethod: '直切',
          plannedGarmentQty: 1,
          bindingLengthCm: 18000,
          bindingWidthCm: 3.5,
        }),
      ],
    },
    {
      source: {
        cutOrderId: 'fallback-cut-260306-102-01',
        cutOrderNo: 'CUT-260306-102-01',
        productionOrderId: 'po-260306-102',
        productionOrderNo: 'PO-260306-102',
        markerPlanId: 'mkp-260306-102',
        markerPlanNo: 'MKP-260306-102',
      },
      orderNo: 'BT-260306-102-01-03',
      status: '待加工' as BindingProcessStatus,
      details: [
        buildFallbackRequirementLine({
          cutOrderId: 'fallback-cut-260306-102-01',
          cutOrderNo: 'CUT-260306-102-01',
          productionOrderId: 'po-260306-102',
          productionOrderNo: 'PO-260306-102',
          markerPlanId: 'mkp-260306-102',
          markerPlanNo: 'MKP-260306-102',
          bindingStripId: 'fallback-binding-28',
          bindingStripNo: 'BIND-01',
          bindingStripName: '下摆捆条',
          cuttingMethod: '斜切',
          plannedGarmentQty: 1,
          bindingLengthCm: 25000,
          bindingWidthCm: 2.8,
        }),
      ],
    },
  ]

  return rows.map((row, orderIndex) => {
    const details = row.details.map((line, detailIndex) => buildDetail(line, row.orderNo, orderIndex, detailIndex, row.status))
    const cuttingRecords = details.flatMap((detail) => detail.cuttingRecords)
    const differenceRecords = details.flatMap((detail) => detail.differenceRecords)
    const executionSummary = summarizeBindingDetails(details)
    const plannedTotalLength = executionSummary.plannedBindingLength
    const actualTotalLength = executionSummary.actualLength
    const lossLength = executionSummary.shortageLength
    const printStatus = aggregateStatus(details.map((detail) => detail.printStatus), '已打印', '待打印', '未生成')
    const inboundStatus = aggregateStatus(details.map((detail) => detail.inboundStatus), '已入仓', '部分入仓', '未入仓')
    const handoverStatus = aggregateStatus(details.map((detail) => detail.handoverStatus), '已交出', '已装袋待交出', '未装袋')
    const differenceStatus: BindingProcessDifferenceStatus = differenceRecords.length ? '有差异' : '无差异'
    const firstLine = row.details[0]
    const firstDetail = details[0]
    const orderDraft: Omit<BindingProcessOrder, 'abnormalItems'> = {
      bindingOrderId: `binding:fallback:${slugToken(row.orderNo)}`,
      bindingOrderNo: row.orderNo,
      processType: '捆条',
      processMode: '裁床内部加工',
      sourceCutOrderId: row.source.cutOrderId,
      sourceCutOrderNo: row.source.cutOrderNo,
      sourceProductionOrderId: row.source.productionOrderId,
      sourceProductionOrderNo: row.source.productionOrderNo,
      sourceMarkerPlanId: row.source.markerPlanId,
      sourceMarkerPlanNo: row.source.markerPlanNo,
      sourceSpreadingOrderId: '',
      sourceSpreadingOrderNo: '',
      sourceFeiTicketIds: details.map((detail) => detail.feiTicketId),
      sourceFeiTicketNos: details.map((detail) => detail.feiTicketNo),
      materialIdentity: {
        materialSku: firstLine.materialSku,
        materialName: firstLine.materialName,
        materialColor: firstLine.materialColor,
        materialAlias: firstLine.materialAlias,
        materialImageUrl: firstLine.materialImageUrl,
        materialUnit: firstLine.materialUnit,
      },
      patternIdentity: {
        patternFileId: firstLine.patternFileId,
        patternFileName: firstLine.patternFileName,
        patternVersion: firstLine.patternVersion,
        patternKind: firstLine.patternKind,
        effectiveWidthText: `${firstLine.doorWidthCm}cm`,
        piecePartNames: ['前片', '后片', '袖片'],
      },
      sourcePatternPackageId: firstLine.patternPackageId,
      sourcePatternPackageName: firstLine.patternPackageName,
      doorWidthCm: firstLine.doorWidthCm,
      bindingSpecificationCount: details.length,
      bindingWidth: firstDetail.bindingWidth,
      materialReceiveStatus: executionSummary.receivedMaterialLength > 0 ? '已领料' : '未领料',
      materialShelfLocation: resolveMaterialShelfLocation(orderIndex),
      requiredMaterialLength: executionSummary.requiredMaterialLength,
      receivedMaterialLength: executionSummary.receivedMaterialLength,
      straightCutLength: executionSummary.straightCutLength,
      crossCutLength: executionSummary.crossCutLength,
      biasCutLength: executionSummary.biasCutLength,
      actualRollCount: executionSummary.actualRollCount,
      latestRecordedAt: executionSummary.latestRecordedAt,
      sufficiencyStatus: executionSummary.sufficiencyStatus,
      shortageLength: executionSummary.shortageLength,
      plannedLength: firstDetail.plannedBindingLength,
      actualLength: firstDetail.actualLength,
      lossLength,
      lossRate: plannedTotalLength ? roundTo((lossLength / plannedTotalLength) * 100, 1) : 0,
      plannedTotalLength,
      actualTotalLength,
      plannedOutputQty: plannedTotalLength,
      actualOutputQty: actualTotalLength,
      unit: '米',
      operatorName: cuttingRecords[0]?.operatorName || '',
      startedAt: cuttingRecords[cuttingRecords.length - 1]?.operatedAt || '',
      completedAt: row.status === '已完成' ? cuttingRecords[0]?.operatedAt || '' : '',
      status: row.status,
      printStatus,
      inboundStatus,
      handoverStatus,
      differenceStatus,
      bindingDetails: details,
      cuttingRecords,
      differenceRecords,
      costItems: [],
      inboundInventoryRecordIds: details.flatMap((detail) => detail.inventoryRecordIds),
      linkedLedgerEventIds: differenceRecords.map((item) => `ledger:fallback:${row.orderNo}:${item.differenceId}`),
      linkedCheckItemIds: differenceRecords.map((item) => `CHECK-${item.differenceId}`),
      externalReceiverFactoryName: '',
      externalHandoverOrderNo: '',
      externalHandoverRecordNo: '',
      externalReturnStatus: '',
      remark: '部署环境兜底演示数据：当上游裁片单投影暂未取到时，仍展示捆条加工单核心链路。',
    }
    return {
      ...orderDraft,
      abnormalItems: buildAbnormalCompatibilityItems(orderDraft),
    }
  })
}

export function buildBindingProcessOrders(
  sourceRecords: GeneratedCutOrderSourceRecord[] = listGeneratedCutOrderSourceRecords(),
): BindingProcessOrder[] {
  const eligibleSourceEntries = sourceRecords
    .map((source, sourceIndex) => ({ source, sourceIndex }))
    .filter(({ source }) => shouldGenerateBindingProcessOrder(source))
  const requirementsByCutOrder = new Map<string, BindingStripRequirementLine[]>()
  listBindingStripRequirementLines(sourceRecords).forEach((line) => {
    requirementsByCutOrder.set(line.cutOrderId, [...(requirementsByCutOrder.get(line.cutOrderId) || []), line])
  })

  const orders = eligibleSourceEntries
    .map(({ source, sourceIndex }) => {
      const lines = requirementsByCutOrder.get(source.cutOrderId) || []
      if (!lines.length) return null
      const status = resolveStatus(sourceIndex)
      const bindingOrderNo = buildBindingOrderNo(source, sourceIndex)
      const bindingOrderId = `binding:${slugToken(source.cutOrderId)}`
      const details = lines.map((line, detailIndex) => buildDetail(line, bindingOrderNo, sourceIndex, detailIndex, status))
      const cuttingRecords = details.flatMap((detail) => detail.cuttingRecords)
      const differenceRecords = details.flatMap((detail) => detail.differenceRecords)
      const executionSummary = summarizeBindingDetails(details)
      const plannedTotalLength = executionSummary.plannedBindingLength
      const actualTotalLength = executionSummary.actualLength
      const lossLength = executionSummary.shortageLength
      const printStatus = aggregateStatus(details.map((detail) => detail.printStatus), '已打印', '待打印', '未生成')
      const inboundStatus = aggregateStatus(details.map((detail) => detail.inboundStatus), '已入仓', '部分入仓', '未入仓')
      const handoverStatus = aggregateStatus(details.map((detail) => detail.handoverStatus), '已交出', '已装袋待交出', '未装袋')
      const differenceStatus: BindingProcessDifferenceStatus = differenceRecords.length ? '有差异' : '无差异'
      const firstLine = lines[0]
      const firstDetail = details[0]
      const orderDraft: Omit<BindingProcessOrder, 'abnormalItems'> = {
        bindingOrderId,
        bindingOrderNo,
        processType: '捆条',
        processMode: '裁床内部加工',
        sourceCutOrderId: source.cutOrderId,
        sourceCutOrderNo: source.cutOrderNo,
        sourceProductionOrderId: source.productionOrderId,
        sourceProductionOrderNo: source.productionOrderNo,
        sourceMarkerPlanId: source.markerPlanId,
        sourceMarkerPlanNo: source.markerPlanNo,
        sourceSpreadingOrderId: '',
        sourceSpreadingOrderNo: '',
        sourceFeiTicketIds: details.map((detail) => detail.feiTicketId),
        sourceFeiTicketNos: details.map((detail) => detail.feiTicketNo),
        materialIdentity: {
          materialSku: source.materialIdentity.materialSku || source.materialSku,
          materialName: source.materialIdentity.materialName || source.materialName,
          materialColor: source.materialIdentity.materialColor || source.materialColor,
          materialAlias: source.materialIdentity.materialAlias || source.materialAlias,
          materialImageUrl: source.materialIdentity.materialImageUrl || source.materialImageUrl,
          materialUnit: source.materialIdentity.materialUnit || source.materialUnit || '米',
        },
        patternIdentity: {
          patternFileId: source.patternIdentity.patternFileId,
          patternFileName: source.patternIdentity.patternFileName,
          patternVersion: source.patternIdentity.patternVersion,
          patternKind: source.patternIdentity.patternKind,
          effectiveWidthText: `${source.patternIdentity.effectiveWidthValue || firstLine.doorWidthCm}${source.patternIdentity.effectiveWidthUnit || 'cm'}`,
          piecePartNames: uniqueStrings(source.patternIdentity.piecePartNames.length ? source.patternIdentity.piecePartNames : source.pieceRows.map((row) => row.partName)),
        },
        sourcePatternPackageId: firstLine.patternPackageId,
        sourcePatternPackageName: firstLine.patternPackageName,
        doorWidthCm: firstLine.doorWidthCm,
        bindingSpecificationCount: details.length,
        bindingWidth: firstDetail.bindingWidth,
        materialReceiveStatus: executionSummary.receivedMaterialLength > 0 ? '已领料' : '未领料',
        materialShelfLocation: resolveMaterialShelfLocation(sourceIndex),
        requiredMaterialLength: executionSummary.requiredMaterialLength,
        receivedMaterialLength: executionSummary.receivedMaterialLength,
        straightCutLength: executionSummary.straightCutLength,
        crossCutLength: executionSummary.crossCutLength,
        biasCutLength: executionSummary.biasCutLength,
        actualRollCount: executionSummary.actualRollCount,
        latestRecordedAt: executionSummary.latestRecordedAt,
        sufficiencyStatus: executionSummary.sufficiencyStatus,
        shortageLength: executionSummary.shortageLength,
        plannedLength: firstDetail.plannedBindingLength,
        actualLength: firstDetail.actualLength,
        lossLength,
        lossRate: plannedTotalLength ? roundTo((lossLength / plannedTotalLength) * 100, 1) : 0,
        plannedTotalLength,
        actualTotalLength,
        plannedOutputQty: plannedTotalLength,
        actualOutputQty: actualTotalLength,
        unit: '米',
        operatorName: cuttingRecords[0]?.operatorName || '',
        startedAt: cuttingRecords[cuttingRecords.length - 1]?.operatedAt || '',
        completedAt: status === '已完成' ? cuttingRecords[0]?.operatedAt || '' : '',
        status,
        printStatus,
        inboundStatus,
        handoverStatus,
        differenceStatus,
        bindingDetails: details,
        cuttingRecords,
        differenceRecords,
        costItems: [],
        inboundInventoryRecordIds: details.flatMap((detail) => detail.inventoryRecordIds),
        linkedLedgerEventIds: differenceRecords.map((item) => `ledger:${bindingOrderId}:${item.differenceId}`),
        linkedCheckItemIds: differenceRecords.map((item) => `CHECK-${item.differenceId}`),
        externalReceiverFactoryName: '',
        externalHandoverOrderNo: '',
        externalHandoverRecordNo: '',
        externalReturnStatus: '',
        remark: '捆条加工单按物料+纸样生成；铺布单不分摊捆条长度，捆条裁剪按本单分批记录。',
      }
      return {
        ...orderDraft,
        abnormalItems: buildAbnormalCompatibilityItems(orderDraft),
      }
    })
    .filter((order): order is BindingProcessOrder => Boolean(order))

  return orders.length ? orders : sourceRecords.length ? [] : buildFallbackBindingProcessOrders()
}

export function getBindingProcessOrderById(bindingOrderId?: string): BindingProcessOrder | null {
  const rows = buildBindingProcessOrders()
  return rows.find((row) => row.bindingOrderId === bindingOrderId) || rows[0] || null
}

export function summarizeBindingStripRequirementsForCutOrders(
  cutOrderIdsOrNos: string[],
  sourceRecords: GeneratedCutOrderSourceRecord[] = listGeneratedCutOrderSourceRecords(),
): BindingStripRequirementSummary {
  const lookup = new Set(cutOrderIdsOrNos.map((item) => normalizeText(item)).filter(Boolean))
  const lines = listBindingStripRequirementLines(sourceRecords).filter((line) =>
    lookup.has(line.cutOrderId) || lookup.has(line.cutOrderNo),
  )
  const rawTotalRequiredLengthM = roundTo(lines.reduce((sum, line) => sum + line.rawRequiredLengthM, 0), 2)
  const totalRequiredLengthM = roundTo(lines.reduce((sum, line) => sum + line.requiredLengthM, 0), 2)
  const summaryMap = new Map<string, BindingStripRequirementSummary['widthSummaries'][number]>()
  const ticketNosByKey = new Map<string, string[]>()
  buildBindingProcessOrders(sourceRecords).forEach((order) => {
    if (!lookup.has(order.sourceCutOrderId) && !lookup.has(order.sourceCutOrderNo)) return
    order.bindingDetails.forEach((detail) => {
      const key = `${order.materialIdentity.materialSku}::${detail.bindingWidth}`
      ticketNosByKey.set(key, [...(ticketNosByKey.get(key) || []), detail.feiTicketNo])
    })
  })
  lines.forEach((line) => {
    const key = `${line.materialSku}::${line.bindingWidthCm}`
    const current = summaryMap.get(key)
    summaryMap.set(key, {
      materialSku: line.materialSku,
      bindingWidthCm: line.bindingWidthCm,
      rawRequiredLengthM: roundTo((current?.rawRequiredLengthM || 0) + line.rawRequiredLengthM, 2),
      requiredLengthM: roundTo((current?.requiredLengthM || 0) + line.requiredLengthM, 2),
      minRequiredLengthApplied: Boolean(current?.minRequiredLengthApplied || line.minRequiredLengthApplied),
      ticketNos: ticketNosByKey.get(key) || [],
    })
  })
  return {
    lines,
    totalRequiredLengthM,
    rawTotalRequiredLengthM,
    minRequiredLengthApplied: lines.some((line) => line.minRequiredLengthApplied),
    widthSummaries: Array.from(summaryMap.values()).sort((left, right) =>
      `${left.materialSku}-${left.bindingWidthCm}`.localeCompare(`${right.materialSku}-${right.bindingWidthCm}`, 'zh-CN'),
    ),
  }
}

export function buildBindingStripReservedLengthFormula(summary: BindingStripRequirementSummary): string {
  const terms = summary.lines.map((line) => {
    const minNote = line.minRequiredLengthApplied ? `，原算 ${formatFormulaNumber(line.rawRequiredLengthM)} m，不足 4m 按 4m` : ''
    return `${formatFormulaNumber(line.requiredLengthM)} m（${line.bindingStripName} / ${formatFormulaNumber(line.bindingWidthCm, 1)} cm / ${line.cuttingMethod} / 捆条需要 ${formatFormulaNumber(line.plannedBindingLengthM)} m${minNote}）`
  })
  const note = summary.minRequiredLengthApplied
    ? `；原算合计 ${formatFormulaNumber(summary.rawTotalRequiredLengthM)} m，含不足 4m 的捆条明细已按 4m 起算`
    : ''
  return `${formatFormulaNumber(summary.totalRequiredLengthM)} m = ${terms.length ? terms.join(' + ') : '0.00 m'}${note}`
}

export function buildBindingStripMaterialTotalUsageFormula(spreadLengthM: number, bindingLengthM: number): string {
  const total = roundTo(Number(spreadLengthM || 0) + Number(bindingLengthM || 0), 2)
  return `${formatFormulaNumber(total)} m = 普通铺布 ${formatFormulaNumber(spreadLengthM)} m + 捆条加工 ${formatFormulaNumber(bindingLengthM)} m（捆条不足 4m 的明细按 4m 起算）`
}
