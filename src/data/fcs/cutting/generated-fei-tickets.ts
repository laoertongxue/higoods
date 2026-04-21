import {
  getProductionOrderCutPieceParts,
  getProductionOrderProcessEntries,
  getProductionOrderTechPackSnapshot,
} from '../production-order-tech-pack-runtime.ts'
import {
  listGeneratedOriginalCutOrderSourceRecords,
  type GeneratedOriginalCutOrderPieceRow,
  type GeneratedOriginalCutOrderSkuScopeLine,
  type GeneratedOriginalCutOrderSourceRecord,
} from './generated-original-cut-orders.ts'
import { encodeFeiTicketQr } from './qr-codes.ts'
import type { FeiTicketQrPayload } from './qr-payload.ts'
import { readMarkerSpreadingPrototypeData } from '../../../pages/process-factory/cutting/marker-spreading-utils.ts'
import type { SpreadingSession } from '../../../pages/process-factory/cutting/marker-spreading-model.ts'

export interface SpreadingPieceOutputLine {
  outputLineId: string
  spreadingSessionId: string
  sourceMarkerId: string
  sourceMarkerLineItemId: string
  originalCutOrderId: string
  originalCutOrderNo: string
  mergeBatchId?: string
  mergeBatchNo?: string
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
  pieceCountPerGarment: number
  bundleNo: string
  bundleQty: number
  layerCount: number
  actualCutPieceQty: number
  actualCutGarmentQty: number
  assemblyGroupKey: string
  sourceBasisType: 'SPREADING_RESULT' | 'HISTORICAL_FALLBACK'
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
  originalCutOrderId: string
  originalCutOrderNo: string
  productionOrderId: string
  productionOrderNo: string
  sourceMergeBatchId: string
  sourceMergeBatchNo: string
  fabricRollId: string
  fabricRollNo: string
  fabricColor: string
  materialSku: string
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
  bundleNo: string
  bundleQty: number
  actualCutPieceQty: number
  assemblyGroupKey: string
  siblingPartTicketNos: string[]
  printStatus: 'WAIT_PRINT' | 'PRINTED' | 'REPRINTED' | 'VOIDED'
  qty: number
  garmentQty: number
  sourceTraceCompleteness: 'COMPLETE' | 'FALLBACK_INCOMPLETE'
  secondaryCrafts: string[]
  craftSequenceVersion: string
  currentCraftStage: string
  sourceTechPackSpuCode: string
  sourceBasisType: 'SPREADING_RESULT' | 'HISTORICAL_FALLBACK'
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
  sourceMergeBatchId: string
  sourceMergeBatchNo: string
  originalCutOrderId: string
  originalCutOrderNo: string
  fabricRollNo: string
  fabricColor: string
  materialSku: string
  color: string
  size: string
  partName: string
  bundleNo: string
  bundleQty: number
  assemblyGroupKey: string
  siblingPartTicketNos: string[]
  garmentQty: number
  sourceBasisType: 'SPREADING_RESULT' | 'HISTORICAL_FALLBACK'
  sourceTraceCompleteness: 'COMPLETE' | 'FALLBACK_INCOMPLETE'
  sourceWritebackId: string
}

function normalizeText(value: string | null | undefined): string {
  return String(value || '').trim()
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)))
}

function normalizeBusinessText(value: string | null | undefined, fallback: string): string {
  return normalizeText(value) || fallback
}

function compareFeiRecords(left: GeneratedFeiTicketSourceRecord, right: GeneratedFeiTicketSourceRecord): number {
  const orderCompare = left.originalCutOrderNo.localeCompare(right.originalCutOrderNo, 'zh-CN')
  if (orderCompare !== 0) return orderCompare
  const sessionCompare = left.sourceSpreadingSessionNo.localeCompare(right.sourceSpreadingSessionNo, 'zh-CN')
  if (sessionCompare !== 0) return sessionCompare
  return left.feiTicketNo.localeCompare(right.feiTicketNo, 'zh-CN')
}

function compareOutputLines(left: SpreadingPieceOutputLine, right: SpreadingPieceOutputLine): number {
  return (
    left.originalCutOrderNo.localeCompare(right.originalCutOrderNo, 'zh-CN')
    || left.fabricRollNo.localeCompare(right.fabricRollNo, 'zh-CN')
    || left.fabricColor.localeCompare(right.fabricColor, 'zh-CN')
    || left.sizeCode.localeCompare(right.sizeCode, 'zh-CN')
    || left.bundleNo.localeCompare(right.bundleNo, 'zh-CN')
    || left.partName.localeCompare(right.partName, 'zh-CN')
  )
}

function buildAssemblyGroupKey(options: {
  originalCutOrderId: string
  fabricRollNo: string
  fabricColor: string
  sizeCode: string
  bundleNo: string
}): string {
  return [
    options.originalCutOrderId,
    normalizeBusinessText(options.fabricRollNo, 'ROLL'),
    normalizeBusinessText(options.fabricColor, 'COLOR'),
    normalizeBusinessText(options.sizeCode, 'SIZE'),
    normalizeBusinessText(options.bundleNo, 'BUNDLE'),
  ].join('__')
}

function resolveDemoCutPieceParts(productionOrderId: string): Array<{
  partCode: string
  partName: string
  pieceCountPerGarment: number
  actualCutPieceQty: number
}> {
  const techPackParts = getProductionOrderCutPieceParts(productionOrderId)
  const preferredParts = ['前片', '后片', '袖子']
  const matchedParts = preferredParts
    .map((partName) => techPackParts.find((item) => item.partNameCn === partName))
    .filter((item): item is NonNullable<typeof techPackParts[number]> => Boolean(item))
    .map((item) => ({
      partCode: item.partCode,
      partName: item.partNameCn,
      pieceCountPerGarment: item.pieceCountPerGarment,
      actualCutPieceQty: item.partNameCn === '袖子' ? 30 : 15,
    }))

  if (matchedParts.length >= 3) return matchedParts

  return [
    { partCode: 'tee-front', partName: '前片', pieceCountPerGarment: 1, actualCutPieceQty: 15 },
    { partCode: 'tee-back', partName: '后片', pieceCountPerGarment: 1, actualCutPieceQty: 15 },
    { partCode: 'tee-sleeve', partName: '袖子', pieceCountPerGarment: 2, actualCutPieceQty: 30 },
  ]
}

function buildDemoSpreadingOutputLines(): SpreadingPieceOutputLine[] {
  const originalCutOrderId = 'CUT-260308-081-01'
  const originalCutOrderNo = 'CUT-260308-081-01'
  const productionOrderId = 'PO-202603-081'
  const productionOrderNo = 'PO-202603-081'
  const spreadingSessionId = 'spreading-demo-roll-a'
  const sourceMarkerId = 'marker-demo-roll-a'
  const sourceMarkerLineItemId = 'marker-demo-roll-a-line-1'
  const fabricRollId = 'ROLL-A'
  const fabricRollNo = '卷A'
  const fabricColor = '红色'
  const garmentSkuId = 'SKU-ST081-RED-M'
  const garmentColor = '红色'
  const sizeCode = 'M'
  const bundleNo = 'BUNDLE-001'
  const bundleQty = 15
  const layerCount = 15
  const assemblyGroupKey = buildAssemblyGroupKey({
    originalCutOrderId,
    fabricRollNo,
    fabricColor,
    sizeCode,
    bundleNo,
  })

  return resolveDemoCutPieceParts(productionOrderId).map((part, index) => ({
    outputLineId: `${spreadingSessionId}-${String(index + 1).padStart(3, '0')}`,
    spreadingSessionId,
    sourceMarkerId,
    sourceMarkerLineItemId,
    originalCutOrderId,
    originalCutOrderNo,
    mergeBatchId: 'MB-202603-081',
    mergeBatchNo: 'MB-202603-081',
    productionOrderId,
    productionOrderNo,
    fabricRollId,
    fabricRollNo,
    fabricColor,
    materialSku: 'FAB-SKU-PRINT-001',
    garmentSkuId,
    garmentColor,
    sizeCode,
    partCode: part.partCode,
    partName: part.partName,
    pieceCountPerGarment: part.pieceCountPerGarment,
    bundleNo,
    bundleQty,
    layerCount,
    actualCutPieceQty: part.actualCutPieceQty,
    actualCutGarmentQty: bundleQty,
    assemblyGroupKey,
    sourceBasisType: 'SPREADING_RESULT',
    createdBy: '裁床组长',
    createdAt: '2026-04-20 09:30',
  }))
}

function resolveSecondaryCrafts(productionOrderId: string): {
  secondaryCrafts: string[]
  craftSequenceVersion: string
} {
  const snapshot = getProductionOrderTechPackSnapshot(productionOrderId)
  const processEntries = getProductionOrderProcessEntries(productionOrderId)
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

function makeBundleScope(index: number): string {
  return `BUNDLE-${String(index + 1).padStart(3, '0')}`
}

function buildFallbackSkuScope(record: GeneratedOriginalCutOrderSourceRecord): GeneratedOriginalCutOrderSkuScopeLine[] {
  if (record.skuScopeLines.length) return record.skuScopeLines
  return [
    {
      skuCode: record.originalCutOrderNo,
      color: record.colorScope[0] || '待补颜色',
      size: '均码',
      plannedQty: Math.max(record.requiredQty, 1),
    },
  ]
}

function buildFallbackPieceRows(record: GeneratedOriginalCutOrderSourceRecord): GeneratedOriginalCutOrderPieceRow[] {
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

function selectApplicableSkuLines(
  skuScopeLines: GeneratedOriginalCutOrderSkuScopeLine[],
  pieceRow: GeneratedOriginalCutOrderPieceRow,
): GeneratedOriginalCutOrderSkuScopeLine[] {
  if (!pieceRow.applicableSkuCodes.length) return skuScopeLines
  const matched = skuScopeLines.filter((line) => pieceRow.applicableSkuCodes.includes(line.skuCode))
  return matched.length ? matched : skuScopeLines
}

function buildFeiTicketNo(originalCutOrderNo: string, sequenceNo: number): string {
  return `FT-${originalCutOrderNo}-${String(sequenceNo).padStart(3, '0')}`
}

function toIssuedAt(record: GeneratedOriginalCutOrderSourceRecord): string {
  return `${record.originalCutOrderNo.slice(4, 10).replace(/(\d{2})(\d{2})(\d{2})/, '20$1-$2-$3')} 08:00`
}

function buildSourceRecordKey(record: Pick<GeneratedOriginalCutOrderSourceRecord, 'originalCutOrderId' | 'materialSku'>): string {
  return `${record.originalCutOrderId}::${record.materialSku}`
}

function buildFallbackSkuCoverageKey(options: {
  originalCutOrderId: string
  materialSku: string
  color: string
  size: string
}): string {
  return [
    options.originalCutOrderId,
    normalizeText(options.materialSku),
    normalizeText(options.color) || '待补颜色',
    normalizeText(options.size) || '均码',
  ].join('::')
}

function buildCoveredFallbackSkuKeySet(spreadingDrivenFeiTickets: GeneratedFeiTicketSourceRecord[]): Set<string> {
  return new Set(
    spreadingDrivenFeiTickets
      .filter((record) => record.sourceBasisType === 'SPREADING_RESULT')
      .map((record) =>
        buildFallbackSkuCoverageKey({
          originalCutOrderId: record.originalCutOrderId,
          materialSku: record.materialSku,
          color: record.skuColor,
          size: record.skuSize,
        }),
      ),
  )
}

function resolveUncoveredFallbackSkuKeys(
  record: GeneratedOriginalCutOrderSourceRecord,
  coveredSkuKeys: Set<string>,
): Set<string> {
  return new Set(
    buildFallbackSkuScope(record)
      .map((line) =>
        buildFallbackSkuCoverageKey({
          originalCutOrderId: record.originalCutOrderId,
          materialSku: record.materialSku,
          color: line.color,
          size: line.size,
        }),
      )
      .filter((key) => !coveredSkuKeys.has(key)),
  )
}

function filterFallbackSourceRecordsBySpreadingCoverage(
  sourceRecords: GeneratedOriginalCutOrderSourceRecord[],
  spreadingDrivenFeiTickets: GeneratedFeiTicketSourceRecord[],
): GeneratedOriginalCutOrderSourceRecord[] {
  const coveredSourceKeys = new Set(spreadingDrivenFeiTickets.map((record) => buildSourceRecordKey(record)))
  return sourceRecords.filter((record) => !coveredSourceKeys.has(buildSourceRecordKey(record)))
}

function normalizePositiveInteger(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(Math.round(value), 0)
}

function isReadyForFeiGeneration(session: SpreadingSession): boolean {
  if (session.status !== 'DONE') return false
  const warning = session.replenishmentWarning
  if (!warning) return true
  if (warning.suggestedAction === '无需补料') return true
  return Boolean(warning.handled)
}

function resolveSourceRecordForLine(
  sourceRecords: GeneratedOriginalCutOrderSourceRecord[],
  line: {
    originalCutOrderId: string
    materialSku: string
  },
): GeneratedOriginalCutOrderSourceRecord | null {
  return (
    sourceRecords.find(
      (record) =>
        record.originalCutOrderId === line.originalCutOrderId &&
        normalizeText(record.materialSku) === normalizeText(line.materialSku),
    ) ||
    sourceRecords.find((record) => record.originalCutOrderId === line.originalCutOrderId) ||
    null
  )
}

function resolveColorScopedSkuLines(
  sourceRecord: GeneratedOriginalCutOrderSourceRecord,
  color: string,
): GeneratedOriginalCutOrderSkuScopeLine[] {
  const scoped = buildFallbackSkuScope(sourceRecord).filter((line) => normalizeText(line.color) === normalizeText(color))
  return scoped.length ? scoped : buildFallbackSkuScope(sourceRecord)
}

function splitGarmentQtyBySize(
  skuScopeLines: GeneratedOriginalCutOrderSkuScopeLine[],
  targetGarmentQty: number,
): Array<{ skuCode: string; color: string; size: string; garmentQty: number }> {
  const normalizedTarget = normalizePositiveInteger(targetGarmentQty)
  if (!normalizedTarget) return []

  const normalizedLines = (skuScopeLines.length ? skuScopeLines : buildFallbackSkuScope({
    originalCutOrderId: '',
    originalCutOrderNo: '',
    productionOrderId: '',
    productionOrderNo: '',
    materialSku: '',
    colorScope: ['待补颜色'],
    skuScopeLines: [],
    pieceRows: [],
    requiredQty: normalizedTarget,
    pieceSummary: '',
    sourceTechPackSpuCode: '',
  } as GeneratedOriginalCutOrderSourceRecord)).map((line, index) => ({
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

function findPieceRowsForSku(
  sourceRecord: GeneratedOriginalCutOrderSourceRecord,
  skuCode: string,
): GeneratedOriginalCutOrderPieceRow[] {
  const pieceRows = buildFallbackPieceRows(sourceRecord)
  const matched = pieceRows.filter((pieceRow) => {
    if (!pieceRow.applicableSkuCodes.length) return true
    return pieceRow.applicableSkuCodes.includes(skuCode)
  })
  return matched.length ? matched : pieceRows
}

function buildSpreadingPieceOutputLinesFromSessions(
  sourceRecords: GeneratedOriginalCutOrderSourceRecord[],
): SpreadingPieceOutputLine[] {
  const { store } = readMarkerSpreadingPrototypeData()
  const outputLines: SpreadingPieceOutputLine[] = []

  store.sessions
    .filter(isReadyForFeiGeneration)
    .forEach((session) => {
      const warningLines = session.replenishmentWarning?.lines || []
      warningLines.forEach((line, lineIndex) => {
        const sourceRecord = resolveSourceRecordForLine(sourceRecords, line)
        const roll =
          session.rolls.find(
            (item) =>
              normalizeText(item.materialSku) === normalizeText(line.materialSku)
              && normalizeText(item.color) === normalizeText(line.color),
          ) || session.rolls[0] || null
        if (!sourceRecord || !roll) return

        const splitRows = splitGarmentQtyBySize(resolveColorScopedSkuLines(sourceRecord, line.color), line.actualCutGarmentQty)
        splitRows.forEach((sizeRow, sizeIndex) => {
          const bundleNo = buildBundleNo(sizeIndex)
          const assemblyGroupKey = buildAssemblyGroupKey({
            originalCutOrderId: sourceRecord.originalCutOrderId,
            fabricRollNo: normalizeBusinessText(roll.rollNo, '待补卷号'),
            fabricColor: normalizeBusinessText(line.color || roll.color, '待补颜色'),
            sizeCode: normalizeBusinessText(sizeRow.size, '均码'),
            bundleNo,
          })

          findPieceRowsForSku(sourceRecord, sizeRow.skuCode).forEach((pieceRow, partIndex) => {
            outputLines.push({
              outputLineId: [
                session.spreadingSessionId,
                normalizeText(roll.rollRecordId) || `roll-${lineIndex + 1}`,
                normalizeText(sizeRow.size) || `size-${sizeIndex + 1}`,
                normalizeText(pieceRow.partCode) || `part-${partIndex + 1}`,
                bundleNo,
              ].join('__'),
              spreadingSessionId: session.spreadingSessionId,
              sourceMarkerId: session.sourceMarkerId || session.markerId || '',
              sourceMarkerLineItemId: `${session.spreadingSessionId}-${lineIndex + 1}`,
              originalCutOrderId: sourceRecord.originalCutOrderId,
              originalCutOrderNo: sourceRecord.originalCutOrderNo,
              mergeBatchId: session.mergeBatchId || sourceRecord.mergeBatchId || '',
              mergeBatchNo: session.mergeBatchNo || sourceRecord.mergeBatchNo || '',
              productionOrderId: sourceRecord.productionOrderId,
              productionOrderNo: sourceRecord.productionOrderNo,
              fabricRollId: roll.rollRecordId,
              fabricRollNo: normalizeBusinessText(roll.rollNo, '待补卷号'),
              fabricColor: normalizeBusinessText(line.color || roll.color, '待补颜色'),
              materialSku: normalizeBusinessText(line.materialSku, sourceRecord.materialSku),
              garmentSkuId: normalizeBusinessText(sizeRow.skuCode, sourceRecord.originalCutOrderNo),
              garmentColor: normalizeBusinessText(sizeRow.color, line.color || roll.color || '待补颜色'),
              sizeCode: normalizeBusinessText(sizeRow.size, '均码'),
              partCode: normalizeBusinessText(pieceRow.partCode, pieceRow.partName),
              partName: normalizeBusinessText(pieceRow.partName, '整单裁片'),
              pieceCountPerGarment: Math.max(Number(pieceRow.pieceCountPerUnit || 0), 1),
              bundleNo,
              bundleQty: Math.max(sizeRow.garmentQty, 1),
              layerCount: Math.max(Number(roll.layerCount || 0), 1),
              actualCutPieceQty: Math.max(sizeRow.garmentQty, 1) * Math.max(Number(pieceRow.pieceCountPerUnit || 0), 1),
              actualCutGarmentQty: Math.max(sizeRow.garmentQty, 1),
              assemblyGroupKey,
              sourceBasisType: 'SPREADING_RESULT',
              createdBy: session.completedBy || session.updatedBy || '裁床组长',
              createdAt: session.completedAt || session.updatedAt || '',
            })
          })
        })
      })
    })

  return outputLines
}

interface SpreadingFeiSeed {
  sourceRecordKey: string
  originalCutOrderId: string
  originalCutOrderNo: string
  productionOrderId: string
  productionOrderNo: string
  sourceSpreadingSessionId: string
  sourceSpreadingSessionNo: string
  sourceMarkerId: string
  sourceMarkerNo: string
  sourceMergeBatchId: string
  sourceMergeBatchNo: string
  materialSku: string
  skuCode: string
  skuColor: string
  skuSize: string
  garmentQty: number
  secondaryCrafts: string[]
  craftSequenceVersion: string
  currentCraftStage: string
  sourceTechPackSpuCode: string
  issuedAt: string
}

function buildSpreadingFeiSeeds(
  sourceRecords: GeneratedOriginalCutOrderSourceRecord[],
): SpreadingFeiSeed[] {
  const { store } = readMarkerSpreadingPrototypeData()
  const seeds: SpreadingFeiSeed[] = []

  store.sessions
    .filter(isReadyForFeiGeneration)
    .forEach((session) => {
      const warningLines = session.replenishmentWarning?.lines || []
      const issuedAt = session.completionLinkage?.completedAt || session.updatedAt || ''

      warningLines.forEach((line) => {
        const actualCutGarmentQty = normalizePositiveInteger(line.actualCutGarmentQty)
        if (!actualCutGarmentQty) return
        const sourceRecord = resolveSourceRecordForLine(sourceRecords, line)
        if (!sourceRecord) return

        const { secondaryCrafts, craftSequenceVersion } = resolveSecondaryCrafts(sourceRecord.productionOrderId)
        splitGarmentQtyBySize(resolveColorScopedSkuLines(sourceRecord, line.color), actualCutGarmentQty).forEach((sizeLine) => {
          seeds.push({
            sourceRecordKey: buildSourceRecordKey(sourceRecord),
            originalCutOrderId: sourceRecord.originalCutOrderId,
            originalCutOrderNo: sourceRecord.originalCutOrderNo,
            productionOrderId: sourceRecord.productionOrderId,
            productionOrderNo: sourceRecord.productionOrderNo,
            sourceSpreadingSessionId: session.spreadingSessionId,
            sourceSpreadingSessionNo: session.sessionNo || session.spreadingSessionId,
            sourceMarkerId: session.sourceMarkerId || session.markerId || '',
            sourceMarkerNo: session.sourceMarkerNo || session.markerNo || '',
            sourceMergeBatchId: session.mergeBatchId || '',
            sourceMergeBatchNo: session.mergeBatchNo || '',
            materialSku: normalizeText(line.materialSku) || sourceRecord.materialSku,
            skuCode: sizeLine.skuCode,
            skuColor: sizeLine.color,
            skuSize: sizeLine.size,
            garmentQty: sizeLine.garmentQty,
            secondaryCrafts,
            craftSequenceVersion,
            currentCraftStage: secondaryCrafts[0] || '',
            sourceTechPackSpuCode: sourceRecord.sourceTechPackSpuCode,
            issuedAt,
          })
        })
      })
    })

  return seeds
}

function buildFeiRecordsFromSpreadingSessions(
  sourceRecords: GeneratedOriginalCutOrderSourceRecord[],
): GeneratedFeiTicketSourceRecord[] {
  const outputLines = listSpreadingPieceOutputLines(sourceRecords)
  const secondaryCraftMetaByProductionOrderId = new Map<string, ReturnType<typeof resolveSecondaryCrafts>>()

  const records = outputLines.map((line, index) => {
    const sourceRecord =
      sourceRecords.find((item) => item.originalCutOrderId === line.originalCutOrderId && item.productionOrderId === line.productionOrderId)
      || sourceRecords.find((item) => item.originalCutOrderId === line.originalCutOrderId)
      || null
    const sourceTechPackSpuCode = sourceRecord?.sourceTechPackSpuCode || ''
    const secondaryCraftMeta =
      secondaryCraftMetaByProductionOrderId.get(line.productionOrderId)
      || resolveSecondaryCrafts(line.productionOrderId)
    secondaryCraftMetaByProductionOrderId.set(line.productionOrderId, secondaryCraftMeta)

    const sequenceNo = index + 1
    const feiTicketId = line.outputLineId
    const feiTicketNo = buildFeiTicketNo(line.originalCutOrderNo, sequenceNo)
    const pieceScope = unique([line.fabricRollNo, line.fabricColor, line.sizeCode, line.partName])
    const pieceGroup = line.assemblyGroupKey
    const bundleScope = `${line.fabricRollNo}-${line.fabricColor}-${line.sizeCode}-${line.bundleNo}`
    const qty = Math.max(line.bundleQty, 1)
    const encoded = encodeFeiTicketQr({
      feiTicketId,
      feiTicketNo,
      originalCutOrderId: line.originalCutOrderId,
      originalCutOrderNo: line.originalCutOrderNo,
      productionOrderId: line.productionOrderId,
      productionOrderNo: line.productionOrderNo,
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
      bundleNo: line.bundleNo,
      bundleQty: line.bundleQty,
      actualCutPieceQty: line.actualCutPieceQty,
      assemblyGroupKey: line.assemblyGroupKey,
      qty,
      secondaryCrafts: secondaryCraftMeta.secondaryCrafts,
      craftSequenceVersion: secondaryCraftMeta.craftSequenceVersion,
      currentCraftStage: secondaryCraftMeta.secondaryCrafts[0] || '',
      issuedAt: line.createdAt,
    })

    return {
      feiTicketId,
      feiTicketNo,
      sourceOutputLineId: line.outputLineId,
      sourceSpreadingSessionId: line.spreadingSessionId,
      sourceSpreadingSessionNo: line.spreadingSessionId,
      sourceMarkerId: line.sourceMarkerId,
      sourceMarkerNo: line.sourceMarkerId,
      originalCutOrderId: line.originalCutOrderId,
      originalCutOrderNo: line.originalCutOrderNo,
      productionOrderId: line.productionOrderId,
      productionOrderNo: line.productionOrderNo,
      sourceMergeBatchId: line.mergeBatchId || '',
      sourceMergeBatchNo: line.mergeBatchNo || '',
      fabricRollId: line.fabricRollId,
      fabricRollNo: line.fabricRollNo,
      fabricColor: line.fabricColor,
      materialSku: line.materialSku,
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
      bundleNo: line.bundleNo,
      bundleQty: line.bundleQty,
      actualCutPieceQty: line.actualCutPieceQty,
      assemblyGroupKey: line.assemblyGroupKey,
      siblingPartTicketNos: [],
      printStatus: 'WAIT_PRINT',
      qty,
      garmentQty: Math.max(line.actualCutGarmentQty, 1),
      sourceTraceCompleteness: 'COMPLETE',
      secondaryCrafts: secondaryCraftMeta.secondaryCrafts,
      craftSequenceVersion: secondaryCraftMeta.craftSequenceVersion,
      currentCraftStage: secondaryCraftMeta.secondaryCrafts[0] || '',
      sourceTechPackSpuCode,
      sourceBasisType: 'SPREADING_RESULT',
      issuedAt: line.createdAt,
      qrPayload: encoded.payload,
      qrValue: encoded.qrValue,
    } satisfies GeneratedFeiTicketSourceRecord
  })

  const siblingNosByGroup = records.reduce<Record<string, string[]>>((accumulator, record) => {
    if (!record.assemblyGroupKey) return accumulator
    if (!accumulator[record.assemblyGroupKey]) accumulator[record.assemblyGroupKey] = []
    accumulator[record.assemblyGroupKey].push(record.feiTicketNo)
    return accumulator
  }, {})

  return records.map((record) => ({
    ...record,
    siblingPartTicketNos: (siblingNosByGroup[record.assemblyGroupKey] || []).filter((ticketNo) => ticketNo !== record.feiTicketNo),
  }))
}

function buildFeiRecordsForOriginalOrder(
  record: GeneratedOriginalCutOrderSourceRecord,
  uncoveredFallbackSkuKeys?: Set<string>,
): GeneratedFeiTicketSourceRecord[] {
  const skuScopeLines = buildFallbackSkuScope(record)
  const pieceRows = buildFallbackPieceRows(record)
  const { secondaryCrafts, craftSequenceVersion } = resolveSecondaryCrafts(record.productionOrderId)
  const issuedAt = toIssuedAt(record)
  const results: GeneratedFeiTicketSourceRecord[] = []
  let sequenceNo = 1
  const restrictToUncoveredSkuKeys = Boolean(uncoveredFallbackSkuKeys && uncoveredFallbackSkuKeys.size > 0)

  pieceRows.forEach((pieceRow) => {
    const applicableSkuLines = selectApplicableSkuLines(skuScopeLines, pieceRow).filter((skuLine) => {
      if (!restrictToUncoveredSkuKeys) return true
      return uncoveredFallbackSkuKeys!.has(
        buildFallbackSkuCoverageKey({
          originalCutOrderId: record.originalCutOrderId,
          materialSku: record.materialSku,
          color: skuLine.color,
          size: skuLine.size,
        }),
      )
    })
    applicableSkuLines.forEach((skuLine) => {
      const feiTicketId = `${record.originalCutOrderId}::${String(sequenceNo).padStart(3, '0')}`
      const feiTicketNo = buildFeiTicketNo(record.originalCutOrderNo, sequenceNo)
      const pieceScope = unique([pieceRow.partCode, pieceRow.partName].filter(Boolean))
      const pieceGroup = normalizeText(pieceRow.partName) || normalizeText(pieceRow.partCode) || '整单裁片'
      const bundleScope = makeBundleScope(sequenceNo - 1)
      const qty = Math.max(Number(pieceRow.pieceCountPerUnit || 0), 1)
      const encoded = encodeFeiTicketQr({
        feiTicketId,
        feiTicketNo,
        originalCutOrderId: record.originalCutOrderId,
        originalCutOrderNo: record.originalCutOrderNo,
        productionOrderId: record.productionOrderId,
        productionOrderNo: record.productionOrderNo,
        sourceOutputLineId: '',
        fabricRollId: '',
        fabricRollNo: '',
        fabricColor: normalizeText(skuLine.color) || '待补颜色',
        materialSku: record.materialSku,
        garmentSkuId: normalizeText(skuLine.skuCode),
        garmentColor: normalizeText(skuLine.color) || '待补颜色',
        pieceScope,
        pieceGroup,
        bundleScope,
        skuColor: normalizeText(skuLine.color) || '待补颜色',
        skuSize: normalizeText(skuLine.size) || '均码',
        partCode: normalizeText(pieceRow.partCode) || normalizeText(pieceRow.partName),
        partName: normalizeText(pieceRow.partName) || '整单裁片',
        bundleNo: bundleScope,
        bundleQty: qty,
        actualCutPieceQty: qty,
        assemblyGroupKey: '',
        qty,
        secondaryCrafts,
        craftSequenceVersion,
        currentCraftStage: secondaryCrafts[0] || '',
        issuedAt,
      })

      results.push({
        feiTicketId,
        feiTicketNo,
        sourceSpreadingSessionId: '',
        sourceSpreadingSessionNo: '',
        sourceMarkerId: '',
        sourceMarkerNo: '',
        originalCutOrderId: record.originalCutOrderId,
        originalCutOrderNo: record.originalCutOrderNo,
        productionOrderId: record.productionOrderId,
        productionOrderNo: record.productionOrderNo,
        sourceMergeBatchId: record.mergeBatchId || '',
        sourceMergeBatchNo: record.mergeBatchNo || '',
        sourceOutputLineId: '',
        fabricRollId: '',
        fabricRollNo: '',
        fabricColor: normalizeText(skuLine.color) || '待补颜色',
        materialSku: record.materialSku,
        garmentSkuId: normalizeText(skuLine.skuCode),
        garmentColor: normalizeText(skuLine.color) || '待补颜色',
        pieceScope,
        pieceGroup,
        bundleScope,
        skuCode: normalizeText(skuLine.skuCode),
        skuColor: normalizeText(skuLine.color) || '待补颜色',
        skuSize: normalizeText(skuLine.size) || '均码',
        partCode: normalizeText(pieceRow.partCode) || normalizeText(pieceRow.partName),
        partName: normalizeText(pieceRow.partName) || '整单裁片',
        bundleNo: bundleScope,
        bundleQty: qty,
        actualCutPieceQty: qty,
        assemblyGroupKey: '',
        siblingPartTicketNos: [],
        printStatus: 'WAIT_PRINT',
        qty,
        garmentQty: qty,
        sourceTraceCompleteness: 'FALLBACK_INCOMPLETE',
        secondaryCrafts,
        craftSequenceVersion,
        currentCraftStage: secondaryCrafts[0] || '',
        sourceTechPackSpuCode: record.sourceTechPackSpuCode,
        sourceBasisType: 'HISTORICAL_FALLBACK',
        issuedAt,
        qrPayload: encoded.payload,
        qrValue: encoded.qrValue,
      })
      sequenceNo += 1
    })
  })

  return results
}

interface GeneratedFeiTicketDataset {
  generatedFeiTickets: GeneratedFeiTicketSourceRecord[]
  feiTicketsById: Record<string, GeneratedFeiTicketSourceRecord>
  feiTicketsByNo: Record<string, GeneratedFeiTicketSourceRecord>
  feiTicketsByOriginalCutOrderId: Record<string, GeneratedFeiTicketSourceRecord[]>
  feiTicketsBySpreadingSessionId: Record<string, GeneratedFeiTicketSourceRecord[]>
}

function buildGeneratedFeiTicketDataset(records: GeneratedFeiTicketSourceRecord[]): GeneratedFeiTicketDataset {
  const generatedFeiTickets = [...records].sort(compareFeiRecords)
  return {
    generatedFeiTickets,
    feiTicketsById: Object.fromEntries(generatedFeiTickets.map((record) => [record.feiTicketId, record])),
    feiTicketsByNo: Object.fromEntries(generatedFeiTickets.map((record) => [record.feiTicketNo, record])),
    feiTicketsByOriginalCutOrderId: generatedFeiTickets.reduce<Record<string, GeneratedFeiTicketSourceRecord[]>>((acc, record) => {
      if (!acc[record.originalCutOrderId]) acc[record.originalCutOrderId] = []
      acc[record.originalCutOrderId].push(record)
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

function buildFallbackFeiTickets(sourceRecords: GeneratedOriginalCutOrderSourceRecord[]): GeneratedFeiTicketSourceRecord[] {
  return sourceRecords.flatMap((record) => buildFeiRecordsForOriginalOrder(record))
}

export function listSpreadingPieceOutputLines(
  sourceRecords: GeneratedOriginalCutOrderSourceRecord[] = listGeneratedOriginalCutOrderSourceRecords(),
): SpreadingPieceOutputLine[] {
  const generatedLines = buildSpreadingPieceOutputLinesFromSessions(sourceRecords)
  const demoLines = buildDemoSpreadingOutputLines()
  const lineMap = new Map<string, SpreadingPieceOutputLine>()
  ;[...demoLines, ...generatedLines].forEach((line) => {
    if (!lineMap.has(line.outputLineId)) {
      lineMap.set(line.outputLineId, line)
    }
  })
  return Array.from(lineMap.values()).sort(compareOutputLines)
}

let generatedFeiTicketDatasetCache: GeneratedFeiTicketDataset | null = null
let computingGeneratedFeiTicketDataset = false

function getGeneratedFeiTicketDataset(): GeneratedFeiTicketDataset {
  if (generatedFeiTicketDatasetCache) return generatedFeiTicketDatasetCache

  const sourceRecords = listGeneratedOriginalCutOrderSourceRecords()
  const fallbackDataset = buildGeneratedFeiTicketDataset(buildFallbackFeiTickets(sourceRecords))
  if (computingGeneratedFeiTicketDataset) return fallbackDataset

  computingGeneratedFeiTicketDataset = true
  try {
    const spreadingDrivenFeiTickets = buildFeiRecordsFromSpreadingSessions(sourceRecords)
    const coveredFallbackSkuKeys = buildCoveredFallbackSkuKeySet(spreadingDrivenFeiTickets)
    const fallbackFeiTickets = sourceRecords.flatMap((record) => {
      const sourceKeyCovered = !filterFallbackSourceRecordsBySpreadingCoverage([record], spreadingDrivenFeiTickets).length
      const uncoveredFallbackSkuKeys = resolveUncoveredFallbackSkuKeys(record, coveredFallbackSkuKeys)
      if (sourceKeyCovered && uncoveredFallbackSkuKeys.size === 0) return []
      return buildFeiRecordsForOriginalOrder(record, sourceKeyCovered ? uncoveredFallbackSkuKeys : undefined)
    })
    generatedFeiTicketDatasetCache = buildGeneratedFeiTicketDataset([...spreadingDrivenFeiTickets, ...fallbackFeiTickets])
    return generatedFeiTicketDatasetCache
  } finally {
    computingGeneratedFeiTicketDataset = false
  }
}

function cloneGeneratedFeiRecord(record: GeneratedFeiTicketSourceRecord): GeneratedFeiTicketSourceRecord {
  return {
    ...record,
    pieceScope: [...record.pieceScope],
    siblingPartTicketNos: [...record.siblingPartTicketNos],
    secondaryCrafts: [...record.secondaryCrafts],
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

export function listGeneratedFeiTicketsByOriginalCutOrderId(originalCutOrderId: string): GeneratedFeiTicketSourceRecord[] {
  return (getGeneratedFeiTicketDataset().feiTicketsByOriginalCutOrderId[originalCutOrderId] || []).map((record) => cloneGeneratedFeiRecord(record))
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

export function getGeneratedFeiTicketMapByOriginalCutOrderId(): Record<string, GeneratedFeiTicketSourceRecord[]> {
  return Object.fromEntries(
    Object.entries(getGeneratedFeiTicketDataset().feiTicketsByOriginalCutOrderId).map(([key, records]) => [
      key,
      records.map((record) => cloneGeneratedFeiRecord(record)),
    ]),
  )
}

export function listGeneratedFeiTicketsByProductionOrderId(productionOrderId: string): GeneratedFeiTicketSourceRecord[] {
  return getGeneratedFeiTicketDataset().generatedFeiTickets
    .filter((record) => record.productionOrderId === productionOrderId)
    .map((record) => cloneGeneratedFeiRecord(record))
}

export function buildGeneratedFeiTicketTraceMatrix(
  records: GeneratedFeiTicketSourceRecord[] = listGeneratedFeiTickets(),
): GeneratedFeiTicketTraceMatrixRow[] {
  const { store } = readMarkerSpreadingPrototypeData()
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
        sourceMergeBatchId: record.sourceMergeBatchId,
        sourceMergeBatchNo: record.sourceMergeBatchNo,
        originalCutOrderId: record.originalCutOrderId,
        originalCutOrderNo: record.originalCutOrderNo,
        fabricRollNo: record.fabricRollNo,
        fabricColor: record.fabricColor,
        materialSku: record.materialSku,
        color: record.skuColor,
        size: record.skuSize,
        partName: record.partName,
        bundleNo: record.bundleNo,
        bundleQty: record.bundleQty,
        assemblyGroupKey: record.assemblyGroupKey,
        siblingPartTicketNos: [...record.siblingPartTicketNos],
        garmentQty: record.garmentQty,
        sourceBasisType: record.sourceBasisType,
        sourceTraceCompleteness: record.sourceTraceCompleteness,
        sourceWritebackId: session?.sourceWritebackId || '',
      }
    })
    .sort(
      (left, right) =>
        left.sourceSpreadingSessionNo.localeCompare(right.sourceSpreadingSessionNo, 'zh-CN')
        || left.originalCutOrderNo.localeCompare(right.originalCutOrderNo, 'zh-CN')
        || left.color.localeCompare(right.color, 'zh-CN')
        || left.size.localeCompare(right.size, 'zh-CN'),
    )
}

export function buildSpreadingDrivenFeiTicketTraceMatrix(
  records: GeneratedFeiTicketSourceRecord[] = listGeneratedFeiTickets(),
): GeneratedFeiTicketTraceMatrixRow[] {
  return buildGeneratedFeiTicketTraceMatrix(records).filter(
    (record) => record.sourceBasisType === 'SPREADING_RESULT' && Boolean(record.sourceSpreadingSessionId),
  )
}
